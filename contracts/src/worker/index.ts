import { z } from "zod";
import {
  CapabilityGrantSchema,
  EvidenceRefSchema,
  IsoUtcTimestampSchema,
  NonEmptyIdSchema,
  SchemaVersionV1Schema,
  Sha256HexSchema,
  StructuredParamsSchema,
} from "../domain/index.ts";

export const DawCapabilityTierSchema = z.enum([
  "inspect",
  "non_destructive_edit",
  "session_mutation",
  "render",
]);
export type DawCapabilityTier = z.infer<typeof DawCapabilityTierSchema>;

export const DawCommandSchema = z.object({
  schemaVersion: SchemaVersionV1Schema,
  commandId: NonEmptyIdSchema,
  dawTarget: z.literal("fl-studio-2025"),
  capabilityTier: DawCapabilityTierSchema,
  operation: z.string().min(2).max(120),
  backupRequired: z.boolean(),
  foregroundUiFallbackOptIn: z.boolean().default(false),
  parameters: StructuredParamsSchema,
});
export type DawCommand = z.infer<typeof DawCommandSchema>;

export const AudioOperationSchema = z.enum(["inspect_wav", "gain_normalize"]);
export type AudioOperation = z.infer<typeof AudioOperationSchema>;

export const AudioJobQuotasSchema = z.object({
  maxDurationSeconds: z.number().positive().max(7200),
  maxInputBytes: z.number().int().positive().max(2_147_483_648),
  maxExecutionTimeMs: z.number().int().positive().max(600_000),
});
export type AudioJobQuotas = z.infer<typeof AudioJobQuotasSchema>;

export const AudioJobSchema = z.object({
  schemaVersion: SchemaVersionV1Schema,
  audioJobId: NonEmptyIdSchema,
  operation: AudioOperationSchema,
  inputPath: z.string().min(1).max(512),
  outputPath: z.string().min(1).max(512).optional(),
  targetPeakDbfs: z.number().min(-60).max(0).optional(),
  quotas: AudioJobQuotasSchema,
});
export type AudioJob = z.infer<typeof AudioJobSchema>;

export const WorkspaceWritePayloadSchema = z.object({
  kind: z.literal("workspace_write"),
  targetRelativePath: z.string().min(1).max(512),
  contentUtf8: z.string().max(5_000_000),
  expectedPriorSha256: Sha256HexSchema.optional(),
});
export type WorkspaceWritePayload = z.infer<typeof WorkspaceWritePayloadSchema>;

export const WorkerJobPayloadSchema = z.discriminatedUnion("kind", [
  WorkspaceWritePayloadSchema,
  z.object({
    kind: z.literal("audio_job"),
    audioJob: AudioJobSchema,
  }),
  z.object({
    kind: z.literal("daw_command"),
    dawCommand: DawCommandSchema,
  }),
]);
export type WorkerJobPayload = z.infer<typeof WorkerJobPayloadSchema>;

export const WorkerJobSchema = z.object({
  schemaVersion: SchemaVersionV1Schema,
  jobId: NonEmptyIdSchema,
  traceId: NonEmptyIdSchema,
  idempotencyKey: NonEmptyIdSchema,
  stepId: NonEmptyIdSchema,
  grant: CapabilityGrantSchema,
  payload: WorkerJobPayloadSchema,
  manifestSignature: z.string().min(32).max(2048),
});
export type WorkerJob = z.infer<typeof WorkerJobSchema>;

export const JobReceiptSchema = z.object({
  schemaVersion: SchemaVersionV1Schema,
  jobId: NonEmptyIdSchema,
  workerId: NonEmptyIdSchema,
  status: z.enum(["ACCEPTED", "COMPLETED", "FAILED", "ABORTED_SAFE_STATE"]),
  completedAt: IsoUtcTimestampSchema,
  evidence: z.array(EvidenceRefSchema),
});
export type JobReceipt = z.infer<typeof JobReceiptSchema>;
