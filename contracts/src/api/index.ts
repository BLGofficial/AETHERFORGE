import { z } from "zod";
import {
  ApprovalDecisionSchema,
  ApprovalSchema,
  BriefSchema,
  CapabilityGrantSchema,
  createResultSchema,
  ExecutionPlanSchema,
  IsoUtcTimestampSchema,
  NonEmptyIdSchema,
  ProductSpecSchema,
  RequestContextSchema,
  SCHEMA_VERSION_V1,
  SchemaVersionV1Schema,
  Sha256HexSchema,
} from "../domain/index.ts";

export const SubmitBriefRequestSchema = z.object({
  context: RequestContextSchema,
  brief: BriefSchema,
});
export type SubmitBriefRequest = z.infer<typeof SubmitBriefRequestSchema>;

export const SpecRefSchema = z.object({
  schemaVersion: SchemaVersionV1Schema,
  specId: NonEmptyIdSchema,
  briefId: NonEmptyIdSchema,
  specHash: Sha256HexSchema,
});
export type SpecRef = z.infer<typeof SpecRefSchema>;

export const SubmitBriefResponseSchema = createResultSchema(SpecRefSchema);
export type SubmitBriefResponse = z.infer<typeof SubmitBriefResponseSchema>;

export const CreatePlanRequestSchema = z.object({
  context: RequestContextSchema,
  spec: ProductSpecSchema,
});
export type CreatePlanRequest = z.infer<typeof CreatePlanRequestSchema>;

export const CreatePlanResponseSchema = createResultSchema(ExecutionPlanSchema);
export type CreatePlanResponse = z.infer<typeof CreatePlanResponseSchema>;

export const DecideApprovalRequestSchema = z.object({
  context: RequestContextSchema,
  approvalId: NonEmptyIdSchema,
  planId: NonEmptyIdSchema,
  planHash: Sha256HexSchema,
  stepId: NonEmptyIdSchema,
  policyVersion: NonEmptyIdSchema,
  decision: ApprovalDecisionSchema,
  rationale: z.string().min(3).max(2000),
});
export type DecideApprovalRequest = z.infer<typeof DecideApprovalRequestSchema>;

export const DecideApprovalResponseSchema = createResultSchema(
  z.object({
    approval: ApprovalSchema,
    grant: CapabilityGrantSchema.optional(),
  }),
);
export type DecideApprovalResponse = z.infer<typeof DecideApprovalResponseSchema>;

export const EmergencyStopScopeSchema = z.enum(["TENANT", "PROJECT", "WORKFLOW", "WORKER"]);
export type EmergencyStopScope = z.infer<typeof EmergencyStopScopeSchema>;

export const TriggerEmergencyStopRequestSchema = z.object({
  context: RequestContextSchema,
  scope: EmergencyStopScopeSchema,
  targetId: NonEmptyIdSchema,
  reason: z.string().min(3).max(1000),
});
export type TriggerEmergencyStopRequest = z.infer<typeof TriggerEmergencyStopRequestSchema>;

export const EmergencyStopReceiptSchema = z.object({
  schemaVersion: SchemaVersionV1Schema,
  stopId: NonEmptyIdSchema,
  scope: EmergencyStopScopeSchema,
  targetId: NonEmptyIdSchema,
  status: z.literal("HALTED"),
  revokedGrantCount: z.number().int().nonnegative(),
  signaledWorkflowCount: z.number().int().nonnegative(),
  haltedAt: IsoUtcTimestampSchema,
});
export type EmergencyStopReceipt = z.infer<typeof EmergencyStopReceiptSchema>;

export const TriggerEmergencyStopResponseSchema = createResultSchema(EmergencyStopReceiptSchema);
export type TriggerEmergencyStopResponse = z.infer<typeof TriggerEmergencyStopResponseSchema>;

export interface JsonSchemaDefinition {
  $schema: string;
  $id: string;
  title: string;
  version: string;
  definitions: Record<string, Record<string, unknown>>;
}

/**
 * Generates deterministic JSON Schema Draft 2020-12 definitions for core AETHER FORGE v1.0.0 contracts.
 */
export function buildJsonSchemaCatalog(): JsonSchemaDefinition {
  const stringField = (pattern?: string) =>
    pattern ? { type: "string", pattern } : { type: "string" };

  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://schemas.aetherforge.internal/v1/contracts.json",
    title: "AETHER FORGE Core Contracts Catalog",
    version: SCHEMA_VERSION_V1,
    definitions: {
      RequestContext: {
        type: "object",
        additionalProperties: false,
        required: [
          "schemaVersion",
          "requestId",
          "tenantId",
          "actor",
          "traceId",
          "idempotencyKey",
          "classification",
        ],
        properties: {
          schemaVersion: stringField("^1\\.\\d+\\.\\d+$"),
          requestId: stringField("^[A-Za-z0-9._:-]+$"),
          tenantId: stringField("^[A-Za-z0-9._:-]+$"),
          projectId: stringField("^[A-Za-z0-9._:-]+$"),
          traceId: stringField("^[A-Za-z0-9._:-]+$"),
          idempotencyKey: stringField("^[A-Za-z0-9._:-]+$"),
          classification: {
            type: "string",
            enum: ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED_LOCAL", "SECRET_CREDENTIAL"],
          },
          actor: {
            type: "object",
            required: ["actorId", "principalType", "roles"],
            properties: {
              actorId: stringField("^[A-Za-z0-9._:-]+$"),
              principalType: { type: "string", enum: ["human", "service", "worker"] },
              roles: {
                type: "array",
                minItems: 1,
                items: {
                  type: "string",
                  enum: ["Owner", "Builder", "Reviewer", "ReleaseManager", "WorkerOperator"],
                },
              },
            },
          },
        },
      },
      Brief: {
        type: "object",
        required: [
          "schemaVersion",
          "briefId",
          "tenantId",
          "projectId",
          "title",
          "objective",
          "constraints",
          "classification",
          "createdBy",
          "createdAt",
        ],
        properties: {
          schemaVersion: stringField("^1\\.\\d+\\.\\d+$"),
          briefId: stringField("^[A-Za-z0-9._:-]+$"),
          tenantId: stringField("^[A-Za-z0-9._:-]+$"),
          projectId: stringField("^[A-Za-z0-9._:-]+$"),
          title: { type: "string", minLength: 3, maxLength: 240 },
          objective: { type: "string", minLength: 10, maxLength: 10000 },
          constraints: { type: "array", minItems: 1, items: { type: "string" } },
          classification: {
            type: "string",
            enum: ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED_LOCAL", "SECRET_CREDENTIAL"],
          },
          createdBy: stringField("^[A-Za-z0-9._:-]+$"),
          createdAt: { type: "string", format: "date-time" },
        },
      },
      ExecutionPlan: {
        type: "object",
        required: [
          "schemaVersion",
          "planId",
          "specId",
          "tenantId",
          "projectId",
          "steps",
          "planHash",
          "policyVersion",
          "createdAt",
        ],
        properties: {
          schemaVersion: stringField("^1\\.\\d+\\.\\d+$"),
          planId: stringField("^[A-Za-z0-9._:-]+$"),
          specId: stringField("^[A-Za-z0-9._:-]+$"),
          tenantId: stringField("^[A-Za-z0-9._:-]+$"),
          projectId: stringField("^[A-Za-z0-9._:-]+$"),
          planHash: stringField("^[a-fA-F0-9]{64}$"),
          policyVersion: stringField("^[A-Za-z0-9._:-]+$"),
          createdAt: { type: "string", format: "date-time" },
          steps: {
            type: "array",
            minItems: 1,
            items: { $ref: "#/definitions/PlanStep" },
          },
        },
      },
      PlanStep: {
        type: "object",
        required: [
          "schemaVersion",
          "stepId",
          "orderIndex",
          "toolId",
          "actionClass",
          "description",
          "input",
          "expectedOutputs",
          "requiresApproval",
        ],
        properties: {
          schemaVersion: stringField("^1\\.\\d+\\.\\d+$"),
          stepId: stringField("^[A-Za-z0-9._:-]+$"),
          orderIndex: { type: "integer", minimum: 0 },
          toolId: stringField("^[A-Za-z0-9._:-]+$"),
          actionClass: {
            type: "string",
            enum: [
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
            ],
          },
          description: { type: "string", minLength: 3, maxLength: 1000 },
          input: { type: "object" },
          expectedOutputs: { type: "array", minItems: 1, items: { type: "string" } },
          requiresApproval: { type: "boolean" },
        },
      },
      CapabilityGrant: {
        type: "object",
        required: [
          "schemaVersion",
          "grantId",
          "tenantId",
          "projectId",
          "workerId",
          "planId",
          "planHash",
          "stepId",
          "actionClass",
          "canonicalPathScope",
          "policyVersion",
          "issuedAt",
          "expiresAt",
          "signature",
        ],
        properties: {
          schemaVersion: stringField("^1\\.\\d+\\.\\d+$"),
          grantId: stringField("^[A-Za-z0-9._:-]+$"),
          tenantId: stringField("^[A-Za-z0-9._:-]+$"),
          projectId: stringField("^[A-Za-z0-9._:-]+$"),
          workerId: stringField("^[A-Za-z0-9._:-]+$"),
          planId: stringField("^[A-Za-z0-9._:-]+$"),
          planHash: stringField("^[a-fA-F0-9]{64}$"),
          stepId: stringField("^[A-Za-z0-9._:-]+$"),
          actionClass: { type: "string" },
          canonicalPathScope: { type: "array", minItems: 1, items: { type: "string" } },
          policyVersion: stringField("^[A-Za-z0-9._:-]+$"),
          issuedAt: { type: "string", format: "date-time" },
          expiresAt: { type: "string", format: "date-time" },
          revoked: { type: "boolean" },
          signature: { type: "string", minLength: 32 },
        },
      },
      Approval: {
        type: "object",
        required: [
          "schemaVersion",
          "approvalId",
          "tenantId",
          "projectId",
          "actor",
          "planId",
          "planHash",
          "stepId",
          "actionClass",
          "policyVersion",
          "canonicalPathScope",
          "decision",
          "status",
          "rationale",
          "decidedAt",
          "expiresAt",
        ],
      },
      WorkerJob: {
        type: "object",
        required: [
          "schemaVersion",
          "jobId",
          "traceId",
          "idempotencyKey",
          "stepId",
          "grant",
          "payload",
          "manifestSignature",
        ],
      },
      EvidenceRef: {
        type: "object",
        required: [
          "schemaVersion",
          "evidenceId",
          "traceId",
          "producer",
          "artifactHash",
          "classification",
          "createdAt",
          "verifiableLocation",
        ],
      },
      AuditEvent: {
        type: "object",
        required: [
          "schemaVersion",
          "eventId",
          "timestamp",
          "tenantId",
          "actor",
          "traceId",
          "idempotencyKey",
          "eventType",
          "policyVersion",
          "outcome",
          "payloadHash",
        ],
      },
      DomainError: {
        type: "object",
        required: ["schemaVersion", "code", "message", "category", "traceId"],
      },
    },
  };
}

/**
 * Generates the OpenAPI 3.1.0 specification for the AETHER FORGE Domain API boundary.
 */
export function buildOpenApiSpec(): Record<string, unknown> {
  const catalog = buildJsonSchemaCatalog();
  return {
    openapi: "3.1.0",
    info: {
      title: "AETHER FORGE Control Plane Domain API",
      version: SCHEMA_VERSION_V1,
      description:
        "Typed protocol boundary for governed brief submission, execution planning, approval binding, and emergency stop.",
    },
    paths: {
      "/api/v1/briefs": {
        post: {
          operationId: "submitBrief",
          summary: "Submit a governed product or audio engineering brief",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["context", "brief"],
                  properties: {
                    context: { $ref: "#/components/schemas/RequestContext" },
                    brief: { $ref: "#/components/schemas/Brief" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Result<SpecRef> envelope" },
            "403": { description: "Policy or authorization denial" },
            "423": { description: "Emergency stop active" },
          },
        },
      },
      "/api/v1/plans": {
        post: {
          operationId: "createPlan",
          summary: "Create a deterministic ExecutionPlan from a ProductSpec",
          responses: {
            "200": { description: "Result<ExecutionPlan> envelope" },
          },
        },
      },
      "/api/v1/approvals/{approvalId}/decision": {
        post: {
          operationId: "decideApproval",
          summary: "Record human approval or rejection bound to planHash and policyVersion",
          responses: {
            "200": { description: "Result<{ approval, grant? }> envelope" },
            "409": { description: "Stale planHash or policyVersion invalidated approval" },
          },
        },
      },
      "/api/v1/system/emergency-stop": {
        post: {
          operationId: "triggerEmergencyStop",
          summary: "Immediately halt dispatch, revoke active grants, and signal running workflows",
          responses: {
            "200": { description: "Result<EmergencyStopReceipt> envelope" },
          },
        },
      },
    },
    components: {
      schemas: catalog.definitions,
    },
  };
}
