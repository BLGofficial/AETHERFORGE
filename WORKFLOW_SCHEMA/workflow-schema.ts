import { z } from "zod";
import { ActionTierSchema, SpecialistAgentIdSchema } from "../SPECIFICATION_SCHEMAS/compiler-schemas.ts";

/**
 * AETHER FORGE — DURABLE WORKFLOW & ORCHESTRATION SCHEMAS (v1.0.0)
 * Strict typed contracts for sequential, parallel, conditional, and nested workflows,
 * durable disk checkpoints, Write-Ahead Logs (WAL), retry/rollback policies, and budgets.
 */

export const WorkflowSchemaVersionSchema = z.literal("1.0.0");

export const WorkflowLifecycleStateSchema = z.enum([
  "CREATED",
  "VALIDATING_PRECONDITIONS",
  "RUNNING",
  "WAITING_FOR_APPROVAL",
  "PAUSED_CHECKPOINTED",
  "ROLLING_BACK",
  "ROLLED_BACK",
  "COMPLETED",
  "FAILED",
  "TIMED_OUT",
  "BUDGET_EXCEEDED",
  "ABORTED_EMERGENCY_STOP",
]);
export type WorkflowLifecycleState = z.infer<typeof WorkflowLifecycleStateSchema>;

export const StepLifecycleStateSchema = z.enum([
  "PENDING",
  "READY",
  "RUNNING",
  "WAITING_FOR_APPROVAL",
  "COMPLETED",
  "SKIPPED_CONDITION_FALSE",
  "FAILED",
  "TIMED_OUT",
  "ROLLED_BACK",
]);
export type StepLifecycleState = z.infer<typeof StepLifecycleStateSchema>;

export const StepExecutionKindSchema = z.enum([
  "SEQUENTIAL_TASK",
  "PARALLEL_GROUP",
  "CONDITIONAL_BRANCH",
  "NESTED_WORKFLOW",
  "HUMAN_APPROVAL_GATE",
  "INDEPENDENT_VERIFICATION_GATE",
]);
export type StepExecutionKind = z.infer<typeof StepExecutionKindSchema>;

export const FailureActionPolicySchema = z.enum([
  "RETRY_WITH_BACKOFF",
  "ROLLBACK_COMPLETED_STEPS",
  "ESCALATE_TO_HUMAN",
  "ABORT_IMMEDIATELY",
]);
export type FailureActionPolicy = z.infer<typeof FailureActionPolicySchema>;

export const StepFailurePolicySchema = z.object({
  onFailure: FailureActionPolicySchema.default("RETRY_WITH_BACKOFF"),
  maxAttempts: z.number().int().min(1).max(5).default(3),
  backoffMs: z.number().int().nonnegative().default(10),
  rollbackSupported: z.boolean().default(true),
  rollbackCommandHint: z.string().min(1).default("git checkout -- <leased-paths>"),
});
export type StepFailurePolicy = z.infer<typeof StepFailurePolicySchema>;

export const WorkflowBudgetSpecSchema = z.object({
  maxTotalTokens: z.number().int().positive().default(100_000),
  maxTotalCostUsd: z.number().positive().default(10.0),
  maxDurationMs: z.number().int().positive().default(60_000),
  maxSteps: z.number().int().min(1).max(50).default(25),
});
export type WorkflowBudgetSpec = z.infer<typeof WorkflowBudgetSpecSchema>;

export const PreconditionSpecSchema = z.object({
  preconditionId: z.string().min(1),
  description: z.string().min(1),
  requiredContextKey: z.string().min(1),
  expectedValue: z.string().optional(),
});
export type PreconditionSpec = z.infer<typeof PreconditionSpecSchema>;

export const EvidenceRequirementSpecSchema = z.object({
  evidenceKind: z.enum([
    "FILE_SHA256_BINDING",
    "COMMAND_EXIT_CODE_ZERO",
    "AUDIT_CHAIN_HASH",
    "HUMAN_APPROVAL_TOKEN",
    "AGT19_VERIFICATION_VERDICT",
  ]),
  minimumCount: z.number().int().min(1).default(1),
  description: z.string().min(1),
});
export type EvidenceRequirementSpec = z.infer<typeof EvidenceRequirementSpecSchema>;

export const ConditionalExpressionSchema = z.object({
  contextKey: z.string().min(1),
  operator: z.enum(["EQUALS", "NOT_EQUALS", "IN"]),
  value: z.string().min(1),
  thenStepIds: z.array(z.string().min(1)).min(1),
  elseStepIds: z.array(z.string().min(1)).default([]),
});
export type ConditionalExpression = z.infer<typeof ConditionalExpressionSchema>;

export const WorkflowStepSpecSchema = z.object({
  stepId: z.string().min(1),
  title: z.string().min(1),
  kind: StepExecutionKindSchema,
  responsibleAgentId: SpecialistAgentIdSchema,
  actionTier: ActionTierSchema.default("1"),
  requiredTools: z.array(z.string().min(1)).min(1),
  exclusiveWriteGlobs: z.array(z.string().min(1)).default([]),
  readOnlyGlobs: z.array(z.string().min(1)).default(["contracts/**"]),
  dependsOnStepIds: z.array(z.string().min(1)).default([]),
  timeoutMs: z.number().int().positive().default(5_000),
  estimatedTokens: z.number().int().nonnegative().default(500),
  estimatedCostUsd: z.number().nonnegative().default(0.02),
  failurePolicy: StepFailurePolicySchema.default({}),
  completionCondition: z.string().min(1).default("exitCode === 0 && outputSha256Verified"),
  evidenceRequirements: z.array(EvidenceRequirementSpecSchema).min(1),
  // Optional fields for specialized step kinds:
  parallelBranchStepIds: z.array(z.string().min(1)).default([]),
  condition: ConditionalExpressionSchema.optional(),
  nestedWorkflowId: z.string().min(1).optional(),
});
export type WorkflowStepSpec = z.output<typeof WorkflowStepSpecSchema>;
export type WorkflowStepSpecInput = z.input<typeof WorkflowStepSpecSchema>;

export const WorkflowDefinitionSchema = z.object({
  schemaVersion: WorkflowSchemaVersionSchema.default("1.0.0"),
  workflowId: z.string().min(1),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/).default("1.0.0"),
  tenantId: z.string().min(1),
  projectId: z.string().min(1),
  inputContractSchemaId: z.string().min(1),
  outputContractSchemaId: z.string().min(1),
  preconditions: z.array(PreconditionSpecSchema).default([]),
  budget: WorkflowBudgetSpecSchema.default({}),
  steps: z.array(WorkflowStepSpecSchema).min(1),
  completionConditions: z.array(z.string().min(1)).min(1),
  evidenceRequirements: z.array(EvidenceRequirementSpecSchema).min(1),
});
export type WorkflowDefinition = z.output<typeof WorkflowDefinitionSchema>;
export type WorkflowDefinitionInput = z.input<typeof WorkflowDefinitionSchema>;

export const StepExecutionEvidenceSchema = z.object({
  stepId: z.string().min(1),
  attemptNumber: z.number().int().positive(),
  agentId: SpecialistAgentIdSchema,
  fenceToken: z.number().int().positive(),
  outputArtifactSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  commandExitCode: z.number().int(),
  tokensConsumed: z.number().int().nonnegative(),
  costUsdConsumed: z.number().nonnegative(),
  durationMs: z.number().nonnegative(),
  auditEntryHash: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  outputSummary: z.record(z.string(), z.string()).default({}),
});
export type StepExecutionEvidence = z.infer<typeof StepExecutionEvidenceSchema>;

export const DurableStepRuntimeStateSchema = z.object({
  stepId: z.string().min(1),
  status: StepLifecycleStateSchema,
  attempts: z.number().int().nonnegative(),
  assignedFenceToken: z.number().int().nonnegative(),
  lastErrorCode: z.string().nullable(),
  lastErrorMessage: z.string().nullable(),
  approvalTokenId: z.string().nullable(),
  approverPrincipalId: z.string().nullable(),
  evidence: StepExecutionEvidenceSchema.nullable(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  rolledBackAt: z.string().datetime().nullable(),
});
export type DurableStepRuntimeState = z.infer<typeof DurableStepRuntimeStateSchema>;

export const WalEventRecordSchema = z.object({
  sequenceNumber: z.number().int().positive(),
  executionId: z.string().min(1),
  eventType: z.enum([
    "WORKFLOW_CREATED",
    "PRECONDITIONS_VERIFIED",
    "STEP_STARTED",
    "STEP_RETRY_SCHEDULED",
    "STEP_WAITING_FOR_APPROVAL",
    "APPROVAL_GRANTED",
    "APPROVAL_REJECTED",
    "STEP_COMPLETED",
    "STEP_SKIPPED",
    "STEP_FAILED",
    "STEP_TIMED_OUT",
    "STEP_ROLLED_BACK",
    "CHECKPOINT_SAVED",
    "WORKFLOW_COMPLETED",
    "WORKFLOW_FAILED",
    "WORKFLOW_ROLLED_BACK",
    "WORKFLOW_BUDGET_EXCEEDED",
    "WORKFLOW_TIMED_OUT",
    "DUPLICATE_EXECUTION_DEDUPLICATED",
    "CONCURRENT_CONFLICT_REJECTED",
  ]),
  stepId: z.string().nullable(),
  fenceToken: z.number().int().nonnegative(),
  detail: z.string().min(1),
  prevWalHash: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  walEntryHash: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  timestamp: z.string().datetime(),
});
export type WalEventRecord = z.infer<typeof WalEventRecordSchema>;

export const DurableWorkflowCheckpointSchema = z.object({
  schemaVersion: WorkflowSchemaVersionSchema,
  executionId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  workflowId: z.string().min(1),
  tenantId: z.string().min(1),
  projectId: z.string().min(1),
  status: WorkflowLifecycleStateSchema,
  currentFenceToken: z.number().int().nonnegative(),
  nestingDepth: z.number().int().min(0).max(2),
  parentExecutionId: z.string().nullable(),
  inputContext: z.record(z.string(), z.string()),
  outputContext: z.record(z.string(), z.string()),
  consumedTokens: z.number().int().nonnegative(),
  consumedCostUsd: z.number().nonnegative(),
  elapsedDurationMs: z.number().nonnegative(),
  stepStates: z.record(z.string(), DurableStepRuntimeStateSchema),
  processedIdempotencyKeys: z.array(z.string()),
  rolledBackStepIds: z.array(z.string()),
  walHeadHash: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  walSequenceNumber: z.number().int().nonnegative(),
  checkpointSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  updatedAt: z.string().datetime(),
});
export type DurableWorkflowCheckpoint = z.infer<typeof DurableWorkflowCheckpointSchema>;
