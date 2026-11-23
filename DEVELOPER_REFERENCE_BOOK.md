# AETHER FORGE — DEVELOPER REFERENCE BOOK (`DEVELOPER_REFERENCE_BOOK.md`)

- **Version:** `1.0.0` | **Workspace:** 26 `pnpm` packages + 19 domain/runtime modules (`tsconfig.json`)

## 1. Repository Layout & Authoritative Entry Points
- **Contracts & Schemas:** `contracts/src/**` (`@aether-forge/contracts`), `SPECIFICATION_SCHEMAS/compiler-schemas.ts`, `WORKFLOW_SCHEMA/workflow-schema.ts`, `TOOL_GATEWAY/src/tool-schemas.ts`, `AGENT_CONTRACTS/agent-network-schemas.json`.
- **12-Stage System Compiler:** `SYSTEM_COMPILER/src/index.ts` (`compileProjectSpecification()`).
- **Durable Workflow & Multi-Agent Orchestration:** `WORKFLOW_ENGINE/src/index.ts` (`DurableWorkflowEngine`), `ORCHESTRATION_ENGINE/src/index.ts` (`MultiAgentOrchestrationEngine`).
- **Engineering Runtime & Tool Gateway:** `ENGINEERING_RUNTIME/src/index.ts`, `TOOL_GATEWAY/src/index.ts`, `EXECUTION_ADAPTERS/src/index.ts`, `PERMISSION_SYSTEM/src/index.ts`, `ARTIFACT_MANAGER/src/index.ts`, `EXECUTION_AUDIT/src/index.ts`.
- **Audio, VST3 & Multi-DAW Engines:** `DSP_ENGINE/src/index.ts`, `VST3_ENGINE/src/index.ts`, `VST3_ENGINE/templates/AetherForgeVst3Template.h`, `DAW_ADAPTER_FRAMEWORK/src/index.ts`, `AUDIO_TEST_FRAMEWORK/src/index.ts`.
- **Knowledge & Memory System:** `KNOWLEDGE_ENGINE/src/index.ts`, `MEMORY_ENGINE/src/index.ts`, `DOCUMENT_INGESTION/src/index.ts`, `RETRIEVAL_ENGINE/src/index.ts`, `PROJECT_CONTEXT_ENGINE/src/index.ts`.
- **Independent QA & Verification:** `VERIFICATION_ENGINE/src/index.ts`, `QA_FRAMEWORK/src/index.ts`, `EVIDENCE_REGISTRY/src/index.ts`.
- **11-Workspace UI:** `DESIGN_SYSTEM/src/index.ts`, `COMPONENT_LIBRARY/src/index.ts`, `API_INTEGRATION/src/index.ts`, `FRONTEND_APPLICATION/src/server.ts`.

## 2. Mandatory Contributor Rules
1. **Strict TypeScript:** Zero `: any`, `as any`, or `<any>` across `contracts/` and core engines; `exactOptionalPropertyTypes: true` enforced (`pnpm.cmd typecheck`).
2. **Real-Time Audio Safety (`ADR-0008`):** Zero heap allocations, locks, exceptions, or I/O inside `processSamples() noexcept`.
3. **Never Bypass `ControlledToolGateway`:** All tool adapters require a single-use HMAC `GatewayExecutionSeal`.
4. **Independent Verification (`AGT-19`):** Never mark a requirement `PASS` without an independent test oracle (`exitCode === 0`) and verified disk `SHA-256` evidence entry.
