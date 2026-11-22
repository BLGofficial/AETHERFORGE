import { createHash } from "node:crypto";
import { z } from "zod";

export const SCHEMA_VERSION_V1 = "1.0.0" as const;

/**
 * Accepts every 1.x.y semantic version string (additive compatible within major v1),
 * rejecting major breaking versions (e.g. "2.0.0" or "0.x.y").
 */
export const SchemaVersionV1Schema = z
  .string()
  .regex(/^1\.\d+\.\d+$/, "Expected major v1 semantic version (1.x.y)");

export const NonEmptyIdSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/);
export const Sha256HexSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{64}$/, "Expected 64-character SHA-256 hex digest");
export const IsoUtcTimestampSchema = z.string().datetime({ offset: true });

export const DataClassificationSchema = z.enum([
  "PUBLIC",
  "INTERNAL",
  "CONFIDENTIAL",
  "RESTRICTED_LOCAL",
  "SECRET_CREDENTIAL",
]);
export type DataClassification = z.infer<typeof DataClassificationSchema>;

export const HumanRoleSchema = z.enum([
  "Owner",
  "Builder",
  "Reviewer",
  "ReleaseManager",
  "WorkerOperator",
]);
export type HumanRole = z.infer<typeof HumanRoleSchema>;

export const PrincipalTypeSchema = z.enum(["human", "service", "worker"]);
export type PrincipalType = z.infer<typeof PrincipalTypeSchema>;

export const ActionClassSchema = z.enum([
  "read_allowlisted",
  "write_workspace",
  "command_bounded",
  "audio_dsp",
  "daw_inspect",
  "daw_non_destructive_edit",
  "daw_session_mutation",
  "daw_render",
  "external_upload",
  "package_install",
  "release_publish",
]);
export type ActionClass = z.infer<typeof ActionClassSchema>;

export const PolicyDecisionKindSchema = z.enum(["allow", "requireApproval", "deny"]);
export type PolicyDecisionKind = z.infer<typeof PolicyDecisionKindSchema>;

export const ActorRefSchema = z.object({
  actorId: NonEmptyIdSchema,
  principalType: PrincipalTypeSchema,
  roles: z.array(HumanRoleSchema).min(1),
  displayName: z.string().min(1).max(200).optional(),
});
export type ActorRef = z.infer<typeof ActorRefSchema>;

export const PolicyInputSchema = z.object({
  schemaVersion: SchemaVersionV1Schema,
  tenantId: NonEmptyIdSchema,
  projectId: NonEmptyIdSchema,
  actor: ActorRefSchema,
  actionClass: z.string().min(1).max(128),
  classification: DataClassificationSchema,
  planId: NonEmptyIdSchema.optional(),
  planHash: Sha256HexSchema.optional(),
  stepId: NonEmptyIdSchema.optional(),
  canonicalPathScope: z.array(z.string().min(1).max(512)).optional(),
  dawCapabilityQualified: z.boolean().default(false),
});
export type PolicyInput = z.infer<typeof PolicyInputSchema>;

export const PolicyDecisionSchema = z.object({
  schemaVersion: SchemaVersionV1Schema,
  decision: PolicyDecisionKindSchema,
  policyVersion: NonEmptyIdSchema,
  bundleDigest: Sha256HexSchema,
  reasonCode: z.string().min(3).max(96).regex(/^[A-Z0-9_]+$/),
  userExplanation: z.string().min(5).max(500),
  requiredApproverRoles: z.array(HumanRoleSchema),
  approvalExpirySeconds: z.number().int().nonnegative(),
});
export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;

export const RequestContextSchema = z.object({
  schemaVersion: SchemaVersionV1Schema,
  requestId: NonEmptyIdSchema,
  tenantId: NonEmptyIdSchema,
  actor: ActorRefSchema,
  projectId: NonEmptyIdSchema.optional(),
  traceId: NonEmptyIdSchema,
  idempotencyKey: NonEmptyIdSchema,
  classification: DataClassificationSchema,
});
export type RequestContext = z.infer<typeof RequestContextSchema>;

export const DomainErrorCategorySchema = z.enum([
  "VALIDATION",
  "AUTHENTICATION",
  "AUTHORIZATION",
  "POLICY_DENIED",
  "APPROVAL_INVALID",
  "EMERGENCY_STOP",
  "CONFLICT",
  "NOT_FOUND",
  "QUOTA_EXCEEDED",
  "WORKER_TRUST_BOUNDARY",
  "DAW_UNQUALIFIED",
  "INTERNAL",
]);
export type DomainErrorCategory = z.infer<typeof DomainErrorCategorySchema>;

export const DomainErrorSchema = z.object({
  schemaVersion: SchemaVersionV1Schema,
  code: z.string().min(3).max(96).regex(/^[A-Z0-9_]+$/),
  message: z.string().min(1).max(2000),
  category: DomainErrorCategorySchema,
  traceId: NonEmptyIdSchema,
  details: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});
export type DomainError = z.infer<typeof DomainErrorSchema>;

export const EvidenceProducerSchema = z.enum([
  "web",
  "api",
  "policy",
  "temporal",
  "worker",
  "daw-adapter",
  "audio-engine",
  "artifact-registry",
]);
export type EvidenceProducer = z.infer<typeof EvidenceProducerSchema>;

export const EvidenceRefSchema = z.object({
  schemaVersion: SchemaVersionV1Schema,
  evidenceId: NonEmptyIdSchema,
  traceId: NonEmptyIdSchema,
  producer: EvidenceProducerSchema,
  artifactHash: Sha256HexSchema,
  classification: DataClassificationSchema,
  createdAt: IsoUtcTimestampSchema,
  verifiableLocation: z.string().min(1).max(1024),
  summary: z.string().min(1).max(1000).optional(),
});
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

export const ArtifactRefSchema = z.object({
  schemaVersion: SchemaVersionV1Schema,
  artifactId: NonEmptyIdSchema,
  version: z.string().min(1).max(64),
  sha256: Sha256HexSchema,
  signatureRef: z.string().min(1).max(1024),
  sbomRef: z.string().min(1).max(1024),
  provenanceRef: z.string().min(1).max(1024),
  createdAt: IsoUtcTimestampSchema,
});
export type ArtifactRef = z.infer<typeof ArtifactRefSchema>;

export type Result<T> =
  | { ok: true; value: T; evidence: EvidenceRef[] }
  | { ok: false; error: DomainError; retryable: boolean };

export function createResultSchema<T extends z.ZodType<unknown>>(
  valueSchema: T,
): z.ZodType<Result<z.infer<T>>> {
  const okBranch = z.object({
    ok: z.literal(true),
    value: valueSchema,
    evidence: z.array(EvidenceRefSchema),
  });
  const errBranch = z.object({
    ok: z.literal(false),
    error: DomainErrorSchema,
    retryable: z.boolean(),
  });
  return z.discriminatedUnion("ok", [okBranch, errBranch]) as unknown as z.ZodType<
    Result<z.infer<T>>
  >;
}

export const BriefSchema = z.object({
  schemaVersion: SchemaVersionV1Schema,
  briefId: NonEmptyIdSchema,
  tenantId: NonEmptyIdSchema,
  projectId: NonEmptyIdSchema,
  title: z.string().min(3).max(240),
  objective: z.string().min(10).max(10000),
  constraints: z.array(z.string().min(1).max(1000)).min(1),
  classification: DataClassificationSchema,
  createdBy: NonEmptyIdSchema,
  createdAt: IsoUtcTimestampSchema,
});
export type Brief = z.infer<typeof BriefSchema>;

export const ProductSpecSchema = z.object({
  schemaVersion: SchemaVersionV1Schema,
  specId: NonEmptyIdSchema,
  briefId: NonEmptyIdSchema,
  tenantId: NonEmptyIdSchema,
  projectId: NonEmptyIdSchema,
  summary: z.string().min(10).max(10000),
  acceptanceCriteria: z.array(z.string().min(3).max(1000)).min(1),
  requiredCapabilities: z.array(ActionClassSchema).min(1),
  specHash: Sha256HexSchema,
  createdAt: IsoUtcTimestampSchema,
});
export type ProductSpec = z.infer<typeof ProductSpecSchema>;

export const StructuredScalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const StructuredParamsSchema = z.record(
  z.string(),
  z.union([StructuredScalarSchema, z.array(StructuredScalarSchema)]),
);

export const PlanStepSchema = z.object({
  schemaVersion: SchemaVersionV1Schema,
  stepId: NonEmptyIdSchema,
  orderIndex: z.number().int().nonnegative(),
  toolId: NonEmptyIdSchema,
  actionClass: ActionClassSchema,
  description: z.string().min(3).max(1000),
  input: StructuredParamsSchema,
  expectedOutputs: z.array(z.string().min(1).max(512)).min(1),
  requiresApproval: z.boolean(),
  dependsOnStepIds: z.array(NonEmptyIdSchema).default([]),
});
export type PlanStep = z.infer<typeof PlanStepSchema>;

export const ExecutionPlanSchema = z.object({
  schemaVersion: SchemaVersionV1Schema,
  planId: NonEmptyIdSchema,
  specId: NonEmptyIdSchema,
  tenantId: NonEmptyIdSchema,
  projectId: NonEmptyIdSchema,
  steps: z.array(PlanStepSchema).min(1),
  planHash: Sha256HexSchema,
  policyVersion: NonEmptyIdSchema,
  createdAt: IsoUtcTimestampSchema,
});
export type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>;

/**
 * Deterministically computes the canonical SHA-256 hash of a plan's immutable structure
 * so approval bindings (INV-03) invalidate immediately on step or parameter modification.
 */
export function computeCanonicalPlanHash(
  input: Pick<ExecutionPlan, "planId" | "specId" | "tenantId" | "projectId" | "steps">,
): string {
  const canonicalSteps = [...input.steps]
    .sort((a, b) => a.orderIndex - b.orderIndex || a.stepId.localeCompare(b.stepId))
    .map((step) => ({
      stepId: step.stepId,
      orderIndex: step.orderIndex,
      toolId: step.toolId,
      actionClass: step.actionClass,
      input: Object.keys(step.input)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = step.input[key];
          return acc;
        }, {}),
      expectedOutputs: [...step.expectedOutputs],
      requiresApproval: step.requiresApproval,
      dependsOnStepIds: [...step.dependsOnStepIds].sort(),
    }));

  const payload = JSON.stringify({
    planId: input.planId,
    specId: input.specId,
    tenantId: input.tenantId,
    projectId: input.projectId,
    steps: canonicalSteps,
  });

  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export const CapabilityGrantSchema = z.object({
  schemaVersion: SchemaVersionV1Schema,
  grantId: NonEmptyIdSchema,
  tenantId: NonEmptyIdSchema,
  projectId: NonEmptyIdSchema,
  workerId: NonEmptyIdSchema,
  planId: NonEmptyIdSchema,
  planHash: Sha256HexSchema,
  stepId: NonEmptyIdSchema,
  actionClass: ActionClassSchema,
  canonicalPathScope: z.array(z.string().min(1).max(512)).min(1),
  policyVersion: NonEmptyIdSchema,
  issuedAt: IsoUtcTimestampSchema,
  expiresAt: IsoUtcTimestampSchema,
  revoked: z.boolean().default(false),
  signature: z.string().min(32).max(2048),
});
export type CapabilityGrant = z.infer<typeof CapabilityGrantSchema>;

export const ApprovalDecisionSchema = z.enum(["APPROVED", "REJECTED"]);
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;

export const ApprovalStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "INVALIDATED",
]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const ApprovalSchema = z.object({
  schemaVersion: SchemaVersionV1Schema,
  approvalId: NonEmptyIdSchema,
  tenantId: NonEmptyIdSchema,
  projectId: NonEmptyIdSchema,
  actor: ActorRefSchema,
  planId: NonEmptyIdSchema,
  planHash: Sha256HexSchema,
  stepId: NonEmptyIdSchema,
  actionClass: ActionClassSchema,
  policyVersion: NonEmptyIdSchema,
  canonicalPathScope: z.array(z.string().min(1).max(512)).min(1),
  decision: ApprovalDecisionSchema,
  status: ApprovalStatusSchema,
  rationale: z.string().min(3).max(2000),
  decidedAt: IsoUtcTimestampSchema,
  expiresAt: IsoUtcTimestampSchema,
});
export type Approval = z.infer<typeof ApprovalSchema>;

export const AuditEventSchema = z.object({
  schemaVersion: SchemaVersionV1Schema,
  eventId: NonEmptyIdSchema,
  timestamp: IsoUtcTimestampSchema,
  tenantId: NonEmptyIdSchema,
  projectId: NonEmptyIdSchema.optional(),
  actor: ActorRefSchema,
  traceId: NonEmptyIdSchema,
  idempotencyKey: NonEmptyIdSchema,
  eventType: z.string().min(3).max(160),
  actionClass: ActionClassSchema.optional(),
  policyVersion: NonEmptyIdSchema,
  planHash: Sha256HexSchema.optional(),
  outcome: z.enum(["ALLOWED", "APPROVAL_REQUIRED", "DENIED", "EXECUTED", "FAILED", "HALTED"]),
  payloadHash: Sha256HexSchema,
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

export const KnowledgeSourceStatusSchema = z.enum(["ACTIVE", "QUARANTINED", "DELETED"]);
export type KnowledgeSourceStatus = z.infer<typeof KnowledgeSourceStatusSchema>;

export const KnowledgeSourceMetadataSchema = z.object({
  schemaVersion: SchemaVersionV1Schema,
  sourceId: NonEmptyIdSchema,
  tenantId: NonEmptyIdSchema,
  projectId: NonEmptyIdSchema,
  title: z.string().min(1).max(300),
  mimeType: z.string().min(3).max(128),
  classification: DataClassificationSchema,
  contentHash: Sha256HexSchema,
  immutableObjectRef: z.string().min(1).max(1024),
  extractionVersion: z.string().min(1).max(64),
  status: KnowledgeSourceStatusSchema,
  createdAt: IsoUtcTimestampSchema,
  deletedAt: IsoUtcTimestampSchema.optional(),
  quarantineReason: z.string().min(1).max(500).optional(),
});
export type KnowledgeSourceMetadata = z.infer<typeof KnowledgeSourceMetadataSchema>;

export const KnowledgeChunkSchema = z.object({
  schemaVersion: SchemaVersionV1Schema,
  chunkId: NonEmptyIdSchema,
  sourceId: NonEmptyIdSchema,
  tenantId: NonEmptyIdSchema,
  projectId: NonEmptyIdSchema,
  chunkIndex: z.number().int().nonnegative(),
  text: z.string().min(1).max(20000),
  chunkHash: Sha256HexSchema,
  sourceContentHash: Sha256HexSchema,
  location: z.string().min(1).max(512),
  classification: DataClassificationSchema,
  extractionVersion: z.string().min(1).max(64),
});
export type KnowledgeChunk = z.infer<typeof KnowledgeChunkSchema>;

export const GroundedContextChunkSchema = z.object({
  chunk: KnowledgeChunkSchema,
  score: z.number().min(0).max(1),
  citation: z.object({
    sourceId: NonEmptyIdSchema,
    contentHash: Sha256HexSchema,
    location: z.string().min(1).max(512),
    classification: DataClassificationSchema,
    extractionVersion: z.string().min(1).max(64),
  }),
});
export type GroundedContextChunk = z.infer<typeof GroundedContextChunkSchema>;

export const GroundedContextResponseSchema = z.object({
  schemaVersion: SchemaVersionV1Schema,
  tenantId: NonEmptyIdSchema,
  projectId: NonEmptyIdSchema,
  query: z.string().min(1).max(2000),
  chunks: z.array(GroundedContextChunkSchema),
  uncitedInferenceLabel: z.literal("model_inference"),
});
export type GroundedContextResponse = z.infer<typeof GroundedContextResponseSchema>;
