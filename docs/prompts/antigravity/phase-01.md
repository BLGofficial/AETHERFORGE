# Antigravity Prompt — PHASE 01: Repository Bootstrap and Contracts

Source: [AETHER-FORGE-Engineering-Blueprint-v1.0.md](../../../AETHER-FORGE-Engineering-Blueprint-v1.0.md#phase-01--repository-bootstrap-and-contracts)

```text
Inspect PHASE 00 artifacts and existing repository state. Create the monorepo skeleton only if absent: pnpm workspace, TypeScript strict configuration, apps/web, apps/api, services/orchestration, workers/windows-host, adapters/daw-contract, packages/sdk, packages/test-fixtures, contracts, infra, tests. Do not add placeholder business logic.

Implement versioned Zod contracts for RequestContext, Result<T>, Brief, ProductSpec, ExecutionPlan, PlanStep, CapabilityGrant, Approval, WorkerJob, EvidenceRef, AuditEvent and DomainError. Generate OpenAPI/JSON Schema where practical. Add compatibility tests for additive and breaking changes. Define event names and CloudEvents envelope. No `any` at process boundaries.

Output file list, exact commands/results, contract compatibility policy, unresolved boundary questions. Gate: clean install, typecheck and contract tests actually pass.
```
