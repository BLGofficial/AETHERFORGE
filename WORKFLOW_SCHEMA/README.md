# AETHER FORGE — WORKFLOW SCHEMAS (`WORKFLOW_SCHEMA/README.md`)

Normative TypeScript/Zod (`zod@3.24.2`, zero `any` types) and JSON Schema (Draft 2020-12) definitions for the **AETHER FORGE Durable Workflow and Orchestration Engine (`ARCH-06`)**.

## Schema Artifacts

1. **[workflow-schema.ts](file:///C:/Users/blago/Desktop/AETHERFORGE/WORKFLOW_SCHEMA/workflow-schema.ts)**
   - Typed contracts for:
     - `WorkflowDefinitionSchema`: Typed input/output contracts, preconditions, execution budgets (`maxTokens`, `maxCostUsd`, `maxDurationMs`), completion conditions, evidence requirements, and DAG steps.
     - `WorkflowStepSpecSchema`: Supports `SEQUENTIAL_TASK`, `PARALLEL_GROUP`, `CONDITIONAL_BRANCH`, `NESTED_WORKFLOW`, `HUMAN_APPROVAL_GATE`, and `INDEPENDENT_VERIFICATION_GATE`.
     - `StepFailurePolicySchema`: `RETRY_WITH_BACKOFF`, `ROLLBACK_COMPLETED_STEPS`, `ESCALATE_TO_HUMAN`, and `ABORT_IMMEDIATELY`.
     - `DurableWorkflowCheckpointSchema` & `WalEventRecordSchema`: Disk-persisted Write-Ahead Log (WAL) and checkpoint snapshot schemas guaranteeing crash-safe resume across process restarts.
2. **[workflow-definition.schema.json](file:///C:/Users/blago/Desktop/AETHERFORGE/WORKFLOW_SCHEMA/workflow-definition.schema.json)**
   - Machine-readable JSON Schema (Draft 2020-12).
