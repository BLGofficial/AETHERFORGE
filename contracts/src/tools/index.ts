import { z } from "zod";
import {
  ActionClassSchema,
  DataClassificationSchema,
  NonEmptyIdSchema,
  RequestContextSchema,
  SchemaVersionV1Schema,
  Sha256HexSchema,
} from "../domain/index.ts";

export const ToolManifestSchema = z.object({
  schemaVersion: SchemaVersionV1Schema,
  toolId: NonEmptyIdSchema,
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  actionClass: ActionClassSchema,
  description: z.string().min(5).max(1000),
  inputSchemaRef: z.string().min(1).max(256),
  outputSchemaRef: z.string().min(1).max(256),
  maxDurationMs: z.number().int().positive().max(3_600_000),
  requiresLocalWorker: z.boolean(),
});
export type ToolManifest = z.infer<typeof ToolManifestSchema>;

export const GroundedCitationSchema = z.object({
  sourceId: NonEmptyIdSchema,
  contentHash: Sha256HexSchema,
  location: z.string().min(1).max(512),
  classification: DataClassificationSchema,
  extractionVersion: z.string().min(1).max(64),
});
export type GroundedCitation = z.infer<typeof GroundedCitationSchema>;

export const PlanningInputSchema = z.object({
  schemaVersion: SchemaVersionV1Schema,
  specId: NonEmptyIdSchema,
  tenantId: NonEmptyIdSchema,
  projectId: NonEmptyIdSchema,
  objective: z.string().min(5).max(10000).optional(),
  availableTools: z.array(ToolManifestSchema).min(1),
  citations: z.array(GroundedCitationSchema),
  tokenBudget: z.number().int().positive().max(1_000_000),
});
export type PlanningInput = z.infer<typeof PlanningInputSchema>;

export const ProviderIdSchema = z.enum([
  "fake-deterministic",
  "openai",
  "anthropic",
  "google",
  "self-hosted-openai-compat",
]);
export type ProviderId = z.infer<typeof ProviderIdSchema>;

export const PromptTemplateRefSchema = z.object({
  schemaVersion: SchemaVersionV1Schema,
  templateId: NonEmptyIdSchema,
  templateVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  templateSha256: Sha256HexSchema,
});
export type PromptTemplateRef = z.infer<typeof PromptTemplateRefSchema>;

export const ModelRequestSchema = z.object({
  schemaVersion: SchemaVersionV1Schema,
  context: RequestContextSchema,
  promptTemplate: PromptTemplateRefSchema,
  systemInstruction: z.string().min(1).max(20000),
  userPrompt: z.string().min(1).max(50000),
  maxOutputTokens: z.number().int().positive().max(64000),
  maxCostUsdMicros: z.number().int().positive().max(50_000_000),
  preferredProvider: ProviderIdSchema.optional(),
});
export type ModelRequest = z.infer<typeof ModelRequestSchema>;

export const ModelUsageAuditMetadataSchema = z.object({
  providerId: ProviderIdSchema,
  modelName: z.string().min(1).max(128),
  promptTemplateId: NonEmptyIdSchema,
  promptTemplateVersion: z.string().min(1).max(64),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  estimatedCostUsdMicros: z.number().int().nonnegative(),
  redactedPatternCount: z.number().int().nonnegative(),
  latencyMs: z.number().nonnegative(),
});
export type ModelUsageAuditMetadata = z.infer<typeof ModelUsageAuditMetadataSchema>;

export const ModelResponseSchema = z.object({
  schemaVersion: SchemaVersionV1Schema,
  requestId: NonEmptyIdSchema,
  traceId: NonEmptyIdSchema,
  structuredJsonOutput: z.string().min(2),
  usageMetadata: ModelUsageAuditMetadataSchema,
});
export type ModelResponse = z.infer<typeof ModelResponseSchema>;
