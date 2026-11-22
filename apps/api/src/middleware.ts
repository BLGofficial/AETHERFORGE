import {
  type DomainError,
  type RequestContext,
  RequestContextSchema,
  type Result,
  SCHEMA_VERSION_V1,
} from "@aether-forge/contracts";
import { computePayloadSha256 } from "@aether-forge/audit";

interface StoredIdempotentResponse {
  readonly payloadHash: string;
  readonly result: Result<unknown>;
}

/**
 * Enforces correlation validation (requestId, traceId, idempotencyKey) and idempotent command replay.
 */
export class CorrelationAndIdempotencyMiddleware {
  private readonly records = new Map<string, StoredIdempotentResponse>();

  private static composeKey(tenantId: string, operation: string, idempotencyKey: string): string {
    return `${tenantId}::${operation}::${idempotencyKey}`;
  }

  public validateContext(rawContext: unknown):
    | { readonly ok: true; readonly context: RequestContext }
    | { readonly ok: false; readonly error: DomainError } {
    const parsed = RequestContextSchema.safeParse(rawContext);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_INVALID_REQUEST_CONTEXT",
          message: parsed.error.issues.map((i) => i.message).join("; "),
          category: "VALIDATION",
          traceId: "invalid-trace-context",
        },
      };
    }
    return { ok: true, context: parsed.data };
  }

  public executeIdempotent<T>(params: {
    readonly context: RequestContext;
    readonly operation: string;
    readonly payload: unknown;
    readonly handler: () => Result<T>;
  }): Result<T> {
    const { context, operation, payload, handler } = params;
    const key = CorrelationAndIdempotencyMiddleware.composeKey(
      context.tenantId,
      operation,
      context.idempotencyKey,
    );
    const incomingHash = computePayloadSha256(payload);
    const existing = this.records.get(key);

    if (existing) {
      if (existing.payloadHash !== incomingHash) {
        return {
          ok: false,
          retryable: false,
          error: {
            schemaVersion: SCHEMA_VERSION_V1,
            code: "DOMAIN_IDEMPOTENCY_KEY_PAYLOAD_MISMATCH",
            message:
              "Idempotency key was already used with a different request payload in this tenant.",
            category: "CONFLICT",
            traceId: context.traceId,
          },
        };
      }
      return existing.result as Result<T>;
    }

    const result = handler();
    if (result.ok) {
      this.records.set(key, {
        payloadHash: incomingHash,
        result: result as Result<unknown>,
      });
    }
    return result;
  }
}
