# AETHER FORGE — DURABLE WORKFLOW ENGINE (`WORKFLOW_ENGINE/README.md`)

Executable TypeScript implementation of the **Durable Workflow Engine (`ARCH-06`)** with disk-persisted hash-chained Write-Ahead Logs (`.wal.jsonl`) and atomic checkpoint snapshots (`.checkpoint.json`).

## Capabilities

- **Execution Topologies:** Sequential (`SEQUENTIAL_TASK`), Parallel (`PARALLEL_GROUP`), Conditional Branching (`CONDITIONAL_BRANCH`), Nested Workflows (`NESTED_WORKFLOW`, up to depth 2), Human Approval Gates (`HUMAN_APPROVAL_GATE`), and Independent Verification Gates (`INDEPENDENT_VERIFICATION_GATE`).
- **Crash-Safe Disk Persistence:** Every step transition is flushed to `<checkpointDir>/<executionId>.wal.jsonl` and `<executionId>.checkpoint.json`. A new process instance can call `resumeFromDiskCheckpoint(executionId)` to verify the WAL SHA-256 chain and resume from the exact interrupted step without re-running completed steps.
- **Resilience & Governance:** Precondition verification, bounded retry with backoff, LIFO compensating saga rollback, step/workflow timeout enforcement, token/cost budget circuit breakers, and idempotency-key deduplication.

## Entry Point

- **[src/index.ts](file:///C:/Users/blago/Desktop/AETHERFORGE/WORKFLOW_ENGINE/src/index.ts)**: `DurableWorkflowEngine`.
