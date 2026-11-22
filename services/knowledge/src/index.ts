import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type DataClassification,
  type GroundedContextChunk,
  type GroundedContextResponse,
  GroundedContextResponseSchema,
  type KnowledgeChunk,
  KnowledgeChunkSchema,
  type KnowledgeSourceMetadata,
  KnowledgeSourceMetadataSchema,
  type RequestContext,
  type Result,
  SCHEMA_VERSION_V1,
} from "@aether-forge/contracts";
import { AppendOnlyAuditStore, computePayloadSha256 } from "@aether-forge/audit";

const ALLOWED_MIME_TYPES = new Set([
  "text/markdown",
  "text/plain",
  "application/json",
]);

const UNSAFE_CONTENT_PATTERNS: ReadonlyArray<{ readonly reason: string; readonly regex: RegExp }> = [
  {
    reason: "Raw credential or private key material detected in knowledge source",
    regex: /(sk-[A-Za-z0-9_-]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|AIza[0-9A-Za-z_-]{20,})/,
  },
  {
    reason: "Executable binary header or active script payload detected",
    regex: /(^MZ[\x00-\xff]|^\x7fELF|<script\b[^>]*>)/i,
  },
  {
    reason: "Prompt-injection policy-override directive detected",
    regex: /(IGNORE\s+ALL\s+PREVIOUS\s+INSTRUCTIONS|SYSTEM_OVERRIDE_BYPASS_POLICY)/i,
  },
];

export interface PostgresMigrationVerificationReceipt {
  readonly migrationId: "0001_knowledge_pgvector";
  readonly sqlSha256: string;
  readonly pgvectorExtensionDeclared: boolean;
  readonly cascadeDeleteDeclared: boolean;
  readonly verifiedTables: readonly string[];
}

export function verifyPostgresPgvectorMigrationSql(): PostgresMigrationVerificationReceipt {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const sqlPath = resolve(currentDir, "../migrations/0001_knowledge_pgvector.sql");
  const sql = readFileSync(sqlPath, "utf8");
  const sqlSha256 = createHash("sha256").update(sql, "utf8").digest("hex");

  const pgvectorExtensionDeclared = /CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+vector/i.test(sql);
  const cascadeDeleteDeclared = /REFERENCES\s+knowledge_sources\(source_id\)\s+ON\s+DELETE\s+CASCADE/i.test(sql);
  const verifiedTables: string[] = [];
  if (/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+knowledge_sources/i.test(sql)) {
    verifiedTables.push("knowledge_sources");
  }
  if (/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+knowledge_chunks/i.test(sql)) {
    verifiedTables.push("knowledge_chunks");
  }

  return {
    migrationId: "0001_knowledge_pgvector",
    sqlSha256,
    pgvectorExtensionDeclared,
    cascadeDeleteDeclared,
    verifiedTables,
  };
}

/**
 * Local/test immutable content-addressable object store (ADR-0007).
 */
export class ImmutableLocalObjectStore {
  private readonly objects = new Map<string, string>();

  public putImmutableObject(params: {
    readonly tenantId: string;
    readonly sourceId: string;
    readonly contentHash: string;
    readonly contentUtf8: string;
  }): string {
    const uri = `s3://aetherforge-knowledge/${params.tenantId}/${params.sourceId}/${params.contentHash}`;
    if (!this.objects.has(uri)) {
      this.objects.set(uri, params.contentUtf8);
    }
    return uri;
  }

  public getObject(uri: string): string | undefined {
    return this.objects.get(uri);
  }

  public deleteObject(uri: string): boolean {
    return this.objects.delete(uri);
  }
}

interface IndexedChunkRecord {
  readonly chunk: KnowledgeChunk;
  readonly tokens: ReadonlySet<string>;
}

function tokenizeText(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9_]+/)
      .filter((t) => t.length >= 2),
  );
}

/**
 * Evidence-Addressable Knowledge Service (ADR-0007).
 * Enforces ingestion policy/malware/injection quarantine, immutable object references,
 * extraction versioning, chunk provenance citations, strict tenant filtering, and synchronous deletion propagation.
 */
export class EvidenceAddressableKnowledgeService {
  public readonly objectStore: ImmutableLocalObjectStore;
  public readonly auditStore: AppendOnlyAuditStore;
  private readonly sourcesById = new Map<string, KnowledgeSourceMetadata>();
  private readonly chunksBySourceId = new Map<string, IndexedChunkRecord[]>();
  private sequence = 0;

  public constructor(deps?: {
    readonly objectStore?: ImmutableLocalObjectStore;
    readonly auditStore?: AppendOnlyAuditStore;
  }) {
    this.objectStore = deps?.objectStore ?? new ImmutableLocalObjectStore();
    this.auditStore = deps?.auditStore ?? new AppendOnlyAuditStore();
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${String(this.sequence).padStart(4, "0")}`;
  }

  public ingestSource(params: {
    readonly context: RequestContext;
    readonly sourceId: string;
    readonly projectId: string;
    readonly title: string;
    readonly mimeType: string;
    readonly classification: DataClassification;
    readonly contentUtf8: string;
    readonly extractionVersion?: string;
  }): Result<KnowledgeSourceMetadata> {
    const { context } = params;
    const extractionVersion = params.extractionVersion ?? "extractor-v1.0.0";
    const nowIso = new Date().toISOString();

    if (params.classification === "SECRET_CREDENTIAL") {
      this.auditStore.append({
        eventId: this.nextId("audit-kn"),
        tenantId: context.tenantId,
        projectId: params.projectId,
        actor: context.actor,
        traceId: context.traceId,
        idempotencyKey: context.idempotencyKey,
        eventType: "aetherforge.knowledge.rejected.v1",
        policyVersion: "knowledge-policy-v1",
        outcome: "DENIED",
        payload: { sourceId: params.sourceId, reason: "SECRET_CREDENTIAL_FORBIDDEN" },
      });
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_KNOWLEDGE_SECRET_CLASSIFICATION_DENIED",
          message: "Knowledge ingestion denied: SECRET_CREDENTIAL sources cannot be indexed.",
          category: "POLICY_DENIED",
          traceId: context.traceId,
        },
      };
    }

    if (!ALLOWED_MIME_TYPES.has(params.mimeType)) {
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_KNOWLEDGE_UNSUPPORTED_MIME_TYPE",
          message: `Unsupported MIME type '${params.mimeType}'.`,
          category: "VALIDATION",
          traceId: context.traceId,
        },
      };
    }

    const contentHash = createHash("sha256").update(params.contentUtf8, "utf8").digest("hex");

    for (const pattern of UNSAFE_CONTENT_PATTERNS) {
      if (pattern.regex.test(params.contentUtf8)) {
        const quarantinedMeta: KnowledgeSourceMetadata = KnowledgeSourceMetadataSchema.parse({
          schemaVersion: SCHEMA_VERSION_V1,
          sourceId: params.sourceId,
          tenantId: context.tenantId,
          projectId: params.projectId,
          title: params.title,
          mimeType: params.mimeType,
          classification: params.classification,
          contentHash,
          immutableObjectRef: `quarantine://${context.tenantId}/${params.sourceId}/${contentHash}`,
          extractionVersion,
          status: "QUARANTINED",
          createdAt: nowIso,
          quarantineReason: pattern.reason,
        });
        this.sourcesById.set(params.sourceId, quarantinedMeta);

        this.auditStore.append({
          eventId: this.nextId("audit-kn"),
          tenantId: context.tenantId,
          projectId: params.projectId,
          actor: context.actor,
          traceId: context.traceId,
          idempotencyKey: context.idempotencyKey,
          eventType: "aetherforge.knowledge.quarantined.v1",
          policyVersion: "knowledge-policy-v1",
          outcome: "DENIED",
          payload: quarantinedMeta,
        });

        return {
          ok: false,
          retryable: false,
          error: {
            schemaVersion: SCHEMA_VERSION_V1,
            code: "DOMAIN_KNOWLEDGE_INPUT_QUARANTINED",
            message: `Source quarantined by policy: ${pattern.reason}`,
            category: "POLICY_DENIED",
            traceId: context.traceId,
          },
        };
      }
    }

    const immutableObjectRef = this.objectStore.putImmutableObject({
      tenantId: context.tenantId,
      sourceId: params.sourceId,
      contentHash,
      contentUtf8: params.contentUtf8,
    });

    const lines = params.contentUtf8.split(/\r?\n/);
    const linesPerChunk = 10;
    const indexedChunks: IndexedChunkRecord[] = [];

    for (let i = 0; i < lines.length; i += linesPerChunk) {
      const slice = lines.slice(i, i + linesPerChunk);
      const chunkText = slice.join("\n").trim();
      if (!chunkText) {
        continue;
      }
      const startLine = i + 1;
      const endLine = Math.min(i + linesPerChunk, lines.length);
      const chunkIndex = indexedChunks.length;
      const chunkHash = createHash("sha256").update(chunkText, "utf8").digest("hex");

      const chunk: KnowledgeChunk = KnowledgeChunkSchema.parse({
        schemaVersion: SCHEMA_VERSION_V1,
        chunkId: `${params.sourceId}-chk-${chunkIndex}`,
        sourceId: params.sourceId,
        tenantId: context.tenantId,
        projectId: params.projectId,
        chunkIndex,
        text: chunkText,
        chunkHash,
        sourceContentHash: contentHash,
        location: `${params.sourceId}#L${startLine}-L${endLine}`,
        classification: params.classification,
        extractionVersion,
      });

      indexedChunks.push({
        chunk,
        tokens: tokenizeText(chunkText),
      });
    }

    const metadata: KnowledgeSourceMetadata = KnowledgeSourceMetadataSchema.parse({
      schemaVersion: SCHEMA_VERSION_V1,
      sourceId: params.sourceId,
      tenantId: context.tenantId,
      projectId: params.projectId,
      title: params.title,
      mimeType: params.mimeType,
      classification: params.classification,
      contentHash,
      immutableObjectRef,
      extractionVersion,
      status: "ACTIVE",
      createdAt: nowIso,
    });

    this.sourcesById.set(params.sourceId, metadata);
    this.chunksBySourceId.set(params.sourceId, indexedChunks);

    this.auditStore.append({
      eventId: this.nextId("audit-kn"),
      tenantId: context.tenantId,
      projectId: params.projectId,
      actor: context.actor,
      traceId: context.traceId,
      idempotencyKey: context.idempotencyKey,
      eventType: "aetherforge.knowledge.ingested.v1",
      policyVersion: "knowledge-policy-v1",
      outcome: "EXECUTED",
      payload: {
        sourceId: metadata.sourceId,
        contentHash: metadata.contentHash,
        chunkCount: indexedChunks.length,
      },
    });

    return {
      ok: true,
      value: metadata,
      evidence: [
        {
          schemaVersion: SCHEMA_VERSION_V1,
          evidenceId: this.nextId("ev-kn"),
          traceId: context.traceId,
          producer: "api",
          artifactHash: contentHash,
          classification: params.classification,
          createdAt: nowIso,
          verifiableLocation: immutableObjectRef,
        },
      ],
    };
  }

  public deleteSource(params: {
    readonly context: RequestContext;
    readonly sourceId: string;
  }): Result<KnowledgeSourceMetadata> {
    const existing = this.sourcesById.get(params.sourceId);
    if (!existing || existing.tenantId !== params.context.tenantId) {
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_KNOWLEDGE_SOURCE_NOT_FOUND",
          message: "Knowledge source not found in caller tenant scope.",
          category: "NOT_FOUND",
          traceId: params.context.traceId,
        },
      };
    }

    const deletedAt = new Date().toISOString();
    const tombstone: KnowledgeSourceMetadata = KnowledgeSourceMetadataSchema.parse({
      ...existing,
      status: "DELETED",
      deletedAt,
    });

    // Synchronous deletion propagation across metadata, object store, and chunk vector index
    this.sourcesById.set(params.sourceId, tombstone);
    this.chunksBySourceId.delete(params.sourceId);
    this.objectStore.deleteObject(existing.immutableObjectRef);

    this.auditStore.append({
      eventId: this.nextId("audit-kn"),
      tenantId: params.context.tenantId,
      projectId: existing.projectId,
      actor: params.context.actor,
      traceId: params.context.traceId,
      idempotencyKey: params.context.idempotencyKey,
      eventType: "aetherforge.knowledge.deleted.v1",
      policyVersion: "knowledge-policy-v1",
      outcome: "EXECUTED",
      payload: { sourceId: params.sourceId, deletedAt },
    });

    return {
      ok: true,
      value: tombstone,
      evidence: [
        {
          schemaVersion: SCHEMA_VERSION_V1,
          evidenceId: this.nextId("ev-kn-del"),
          traceId: params.context.traceId,
          producer: "api",
          artifactHash: computePayloadSha256(tombstone),
          classification: existing.classification,
          createdAt: deletedAt,
          verifiableLocation: `tombstone://${existing.tenantId}/${existing.sourceId}`,
        },
      ],
    };
  }

  public retrieve(params: {
    readonly context: RequestContext;
    readonly projectId: string;
    readonly query: string;
    readonly topK?: number;
  }): Result<GroundedContextResponse> {
    const queryTokens = tokenizeText(params.query);
    const topK = params.topK ?? 5;
    const matches: GroundedContextChunk[] = [];

    for (const [sourceId, sourceMeta] of this.sourcesById.entries()) {
      // Strictly enforce tenant isolation, project match, and ACTIVE status
      if (
        sourceMeta.tenantId !== params.context.tenantId ||
        sourceMeta.projectId !== params.projectId ||
        sourceMeta.status !== "ACTIVE"
      ) {
        continue;
      }

      const chunks = this.chunksBySourceId.get(sourceId) ?? [];
      for (const record of chunks) {
        let overlap = 0;
        for (const qToken of queryTokens) {
          if (record.tokens.has(qToken)) {
            overlap += 1;
          }
        }
        if (overlap === 0 && queryTokens.size > 0) {
          continue;
        }
        const score =
          queryTokens.size > 0
            ? Math.min(1, Number((overlap / queryTokens.size).toFixed(4)))
            : 1;

        matches.push({
          chunk: record.chunk,
          score,
          citation: {
            sourceId: record.chunk.sourceId,
            contentHash: record.chunk.sourceContentHash,
            location: record.chunk.location,
            classification: record.chunk.classification,
            extractionVersion: record.chunk.extractionVersion,
          },
        });
      }
    }

    matches.sort((a, b) => b.score - a.score || a.chunk.chunkIndex - b.chunk.chunkIndex);

    const response: GroundedContextResponse = GroundedContextResponseSchema.parse({
      schemaVersion: SCHEMA_VERSION_V1,
      tenantId: params.context.tenantId,
      projectId: params.projectId,
      query: params.query,
      chunks: matches.slice(0, topK),
      uncitedInferenceLabel: "model_inference",
    });

    return {
      ok: true,
      value: response,
      evidence: [],
    };
  }
}
