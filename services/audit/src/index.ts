import { createHash } from "node:crypto";
import {
  type ActionClass,
  type ActorRef,
  type AuditEvent,
  AuditEventSchema,
  SCHEMA_VERSION_V1,
} from "@aether-forge/contracts";

export interface AppendAuditInput {
  readonly eventId: string;
  readonly timestamp?: string;
  readonly tenantId: string;
  readonly projectId?: string | undefined;
  readonly actor: ActorRef;
  readonly traceId: string;
  readonly idempotencyKey: string;
  readonly eventType: string;
  readonly actionClass?: ActionClass | undefined;
  readonly policyVersion: string;
  readonly planHash?: string | undefined;
  readonly outcome: AuditEvent["outcome"];
  readonly payload: unknown;
}

export function computePayloadSha256(payload: unknown): string {
  const serialized = typeof payload === "string" ? payload : JSON.stringify(payload ?? {});
  return createHash("sha256").update(serialized, "utf8").digest("hex");
}

/**
 * Append-only immutable audit event store (INV-01).
 * Never exposes mutation or deletion of recorded events.
 */
export class AppendOnlyAuditStore {
  private readonly events: AuditEvent[] = [];
  private simulateFailure = false;

  public setSimulateFailure(fail: boolean): void {
    this.simulateFailure = fail;
  }

  public append(input: AppendAuditInput): AuditEvent {
    if (this.simulateFailure) {
      throw new Error("AUDIT_STORE_UNAVAILABLE: Fail-closed audit write failure");
    }

    const candidate: AuditEvent = {
      schemaVersion: SCHEMA_VERSION_V1,
      eventId: input.eventId,
      timestamp: input.timestamp ?? new Date().toISOString(),
      tenantId: input.tenantId,
      ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
      actor: input.actor,
      traceId: input.traceId,
      idempotencyKey: input.idempotencyKey,
      eventType: input.eventType,
      ...(input.actionClass !== undefined ? { actionClass: input.actionClass } : {}),
      policyVersion: input.policyVersion,
      ...(input.planHash !== undefined ? { planHash: input.planHash } : {}),
      outcome: input.outcome,
      payloadHash: computePayloadSha256(input.payload),
    };

    const validated = AuditEventSchema.parse(candidate);
    this.events.push(Object.freeze(validated));
    return validated;
  }

  /**
   * Tenant-scoped query: only returns events belonging to the caller's verified tenantId.
   */
  public listByTenant(tenantId: string): readonly AuditEvent[] {
    return this.events.filter((e) => e.tenantId === tenantId);
  }

  /**
   * Reconstructs the ordered action sequence for a correlation traceId within a tenant boundary.
   */
  public reconstructTrace(tenantId: string, traceId: string): readonly AuditEvent[] {
    return this.events.filter((e) => e.tenantId === tenantId && e.traceId === traceId);
  }
}
