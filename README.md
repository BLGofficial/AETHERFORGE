# AETHER FORGE (`v1.0.0`)

**AI Systems Engineering & Autonomous Product Construction Platform**

- **Release Status:** **`CONDITIONALLY READY`** ([PRODUCTION_READINESS_AUDIT.md](./PRODUCTION_READINESS_AUDIT.md)) — All local software, native C++20/VST3, Rust, C# x64 DPAPI/NTFS, Python 3.14, and FL Studio 2025 verification gates pass; cloud staging/prod infrastructure (`BLK-002`) and live vendor LLM API keys (`BLK-004`) remain external deployment prerequisites ([RELEASE_BLOCKERS.md](./RELEASE_BLOCKERS.md)).
- **Verification Baseline:** `tsc -p tsconfig.json --noEmit` (`0` errors) · **`26/26` Vitest suites (`82/82` tests passed)** · `81/81` JSON files valid · Rust `cargo test --release` (`1/1` passed) · **`pluginval --strictness-level 10` (`SUCCESS`)** on both `AetherForgeProcessor.vst3` and flagship product `AetherPunch.vst3`.
- **First Production DAW Target:** Image-Line **FL Studio 2025** (`25.1.6.4997`, Windows 11 x64) + replaceable multi-DAW adapter framework (Cockos REAPER `.rpp`).

---

## 1. Platform Overview & Three-Plane Architecture

AETHER FORGE transforms product briefs, natural language requirements, technical specs, and existing repositories into typed specifications, multi-agent execution DAGs, verified software, native C++20 VST3 plugins, offline DSP pipelines, and governed DAW workflows—under strict Zero-Trust policy and independent separation-of-duty verification (`AGT-19`).

```text
Plane 1 (AI Reasoning & Compilation):
  6-Modal Input → 12-Stage System Compiler → 19 Specialist Agents (AGT-01..19) → 6-Layer Epistemic Knowledge Engine

Plane 2 (Governed Control & Orchestration):
  OPA Default-Deny Policy → Single-Use Human Approval Gates → Durable Disk-WAL Workflow Engine
  → Non-Bypassable Controlled Tool Gateway (HMAC Seals) → 11-Workspace Studio UI

Plane 3 (Isolated Native & Real-Time Execution):
  Windows x64 Sandbox Worker (DPAPI + NTFS ReparsePoint Guard) | Rust/TS 64-Bit DSP Engine
  | Lock-Free C++20 VST3 Audio Core (0 Allocs / 0 Locks / 0 I/O) | FL Studio 2025 Read-Only Adapter
```

### Explicit Non-Goals & Safety Laws
1. **No LLM Bypass of the Tool Gateway:** Direct execution adapter calls without a single-use HMAC `GatewayExecutionSeal` fail closed (`DIRECT_GATEWAY_BYPASS_FORBIDDEN`).
2. **No Self-Verification or Code-Only Completion:** Implementing agents (`AGT-01..18`) cannot certify their own deliverables; only read-only **`AGT-19`** can emit `PASS` upon verified disk `SHA-256` hashes and executable test oracles.
3. **No Hallucinated Authority:** Unverified `GENERATED_ARTIFACT` entries are quarantined from authoritative technical documentation (`VERIFIED_FACT` / `ENGINEERING_DECISION`) until promoted via `AGT-19` `EXECUTION_EVIDENCE`.
4. **No Real-Time Audio Thread Violations (`ADR-0008`):** Zero heap allocations, zero locks, zero network/LLM calls inside C++20 `processBlock()` / `processSamples()`.
5. **No Undocumented DAW Binary Mutation (`ADR-0009`):** In-place `.flp` overwrites and `FLEngine_x64.dll` memory injection are deterministically refused (`DAW_CAPABILITY_UNSUPPORTED`).

---

## 2. Quickstart (Windows 11 x64)

> **PowerShell Note:** Under restricted Windows ExecutionPolicy, invoke `.cmd` shims (`pnpm.cmd`, `npm.cmd`) or direct executables (`node`, `git`).

```powershell
# 1. Install dependencies & verify workspace
pnpm.cmd install --frozen-lockfile
pnpm.cmd build       # tsc --noEmit + OpenAPI/JSON-Schema codegen + native Windows worker + RC/v1.0.0 attestations
pnpm.cmd test        # Runs all 26 Vitest suites (82 executable tests)

# 2. Launch the 11-Workspace AETHER FORGE Studio UI
pnpm.cmd studio
```

Open **`http://127.0.0.1:4173/workspaces/command-center`** to access all 11 live workspaces (`Command Center`, `Project Creation Studio`, `Architecture Studio`, `Agent Studio`, `Workflow Studio`, `Engineering Console`, `Knowledge Center`, `Testing Center`, `Integration Center`, `System Monitor`, `Reference Library`).

---

## 3. Core Platform Subsystems

| Subsystem | Directory | Key Capabilities |
| :--- | :--- | :--- |
| **12-Stage System Compiler** | [SYSTEM_COMPILER/](./SYSTEM_COMPILER/README.md), [SPECIFICATION_SCHEMAS/](./SPECIFICATION_SCHEMAS/README.md), [COMPILATION_PIPELINE.md](./COMPILATION_PIPELINE.md) | Compiles 6 input types across 12 stages; rejects contradictions, cycles, missing dependencies, and unsupported capabilities; enforces `100%` 4-way traceability (`REQ ↔ COMP ↔ TASK ↔ TEST ↔ AC`). |
| **19-Agent Specialist Network** | [AGENT_REGISTRY.md](./AGENT_REGISTRY.md), [AGENT_SPECIFICATIONS/](./AGENT_SPECIFICATIONS/README.md), [AGENT_PROMPTS/](./AGENT_PROMPTS/README.md), [AGENT_CONTRACTS/](./AGENT_CONTRACTS/README.md) | Hierarchical & peer-collaborative orchestration (`AGT-01`..`AGT-19`), pairwise disjoint `exclusiveWriteGlobs`, monotonic `fenceToken` locks, and `AGT-19` gatekeeper. |
| **Durable Workflow & Orchestration** | [WORKFLOW_ENGINE/](./WORKFLOW_ENGINE/README.md), [ORCHESTRATION_ENGINE/](./ORCHESTRATION_ENGINE/README.md), [EXECUTION_STATE_MACHINE.md](./EXECUTION_STATE_MACHINE.md), [RECOVERY_FRAMEWORK.md](./RECOVERY_FRAMEWORK.md) | Sequential, parallel, conditional, and nested workflows; hash-chained disk `.wal.jsonl` + `.checkpoint.json` crash recovery; retry backoff; LIFO saga rollback; token/USD budget circuit breakers. |
| **Engineering Execution Runtime** | [ENGINEERING_RUNTIME/](./ENGINEERING_RUNTIME/README.md), [TOOL_GATEWAY/](./TOOL_GATEWAY/README.md), [EXECUTION_ADAPTERS/](./EXECUTION_ADAPTERS/README.md), [PERMISSION_SYSTEM/](./PERMISSION_SYSTEM/README.md), [ARTIFACT_MANAGER/](./ARTIFACT_MANAGER/README.md), [EXECUTION_AUDIT/](./EXECUTION_AUDIT/README.md) | Planning vs. execution split, Zod I/O schemas for 11 tools, single-use human `ApprovalGrant`, pre-write checkpoint auto-rollback, and hash-chained audit logs. |
| **Audio, VST3 & Multi-DAW Domain** | [AUDIO_DOMAIN_ARCHITECTURE.md](./AUDIO_DOMAIN_ARCHITECTURE.md), [DSP_ENGINE/](./DSP_ENGINE/README.md), [VST3_ENGINE/](./VST3_ENGINE/README.md), [DAW_ADAPTER_FRAMEWORK/](./DAW_ADAPTER_FRAMEWORK/README.md), [AUDIO_TEST_FRAMEWORK/](./AUDIO_TEST_FRAMEWORK/README.md), [DOMAIN_KNOWLEDGE_PACKS/](./DOMAIN_KNOWLEDGE_PACKS/README.md) | 64-bit float RBJ Biquad/Compressor/Transient Shaper/True-Peak Limiter, ITU-R BS.1770-4 analyzer, Steinberg VST3 `3.8.1` C++20 core, FL Studio 2025 & REAPER replaceable adapters, phase-cancellation null tests & WCET profiling. |
| **6-Layer Knowledge & Memory** | [KNOWLEDGE_GOVERNANCE.md](./KNOWLEDGE_GOVERNANCE.md), [KNOWLEDGE_ENGINE/](./KNOWLEDGE_ENGINE/README.md), [MEMORY_ENGINE/](./MEMORY_ENGINE/README.md), [DOCUMENT_INGESTION/](./DOCUMENT_INGESTION/README.md), [RETRIEVAL_ENGINE/](./RETRIEVAL_ENGINE/README.md), [PROJECT_CONTEXT_ENGINE/](./PROJECT_CONTEXT_ENGINE/README.md) | Separates Source Docs, Extracted Knowledge, Verified Facts, ADRs, Quarantined Generated Artifacts, and Execution Evidence; Obsidian Markdown YAML frontmatter + `[[Wikilinks]]` + backlinks; hybrid BM25/vector retrieval & conflict detection. |
| **Independent Verification & QA** | [QUALITY_GATES.md](./QUALITY_GATES.md), [VERIFICATION_ENGINE/](./VERIFICATION_ENGINE/README.md), [QA_FRAMEWORK/](./QA_FRAMEWORK/README.md), [TEST_CATALOG/](./TEST_CATALOG/README.md), [REQUIREMENT_COVERAGE_REPORT/](./REQUIREMENT_COVERAGE_REPORT/README.md), [EVIDENCE_REGISTRY/](./EVIDENCE_REGISTRY/README.md) | 12 QA disciplines (`QG-01..12`), 6-field requirement acceptance matrices, cryptographic disk `SHA-256` evidence ledger, and strict anti-fabrication enforcement. |
| **11-Workspace Studio UI** | [FRONTEND_APPLICATION/](./FRONTEND_APPLICATION/README.md), [DESIGN_SYSTEM/](./DESIGN_SYSTEM/README.md), [COMPONENT_LIBRARY/](./COMPONENT_LIBRARY/README.md), [API_INTEGRATION/](./API_INTEGRATION/README.md), [E2E_UI_TESTS/](./E2E_UI_TESTS/README.md) | Accessible dark-mode engineering interface backed strictly by authoritative backend state (`HTTP 423` Emergency Stop lock, real forms & JSON APIs). |
| **Governed Control Plane & Native Workers** | `apps/api`, `apps/web`, `contracts/`, `services/{audit,policy,orchestration,provider-gateway,knowledge,artifact-registry}`, `workers/{windows-host,audio-engine}`, `adapters/{fl-studio-2025,filesystem,git}`, `plugins/vst3` | 26-package `pnpm` monorepo, OPA Rego v1 policy bundle, native Windows x64 `AetherForge.WindowsWorker.exe` (OS DPAPI + NTFS junction guard), Rust `aetherforge-audio-engine`, and native `AetherForgeProcessor.vst3`. |

---

## 4. Flagship Product Built Inside AETHER FORGE

### **Aether Punch (`v1.0.0`)** — Native Windows x64 VST3 Plugin ([products/aether-punch-vst3/](./products/aether-punch-vst3/README.md))
- **DSP Chain:** Lock-free C++20 stereo-linked dual-envelope transient shaper (`Attack`, `Sustain`) → auto-compensated analog `tanh` soft-clip saturator (`Drive`) → brickwall true-peak limiter (`Ceiling`) → parallel `Mix` & `Bypass`.
- **Verified Standalone Bundle:** `products/aether-punch-vst3/dist/AetherPunch.vst3` (`788,992` bytes, SHA-256 `9FA24B84C509D2A9`, statically linked `-static`).
- **Empirical Proofs:** `AetherPunchCoreTests.exe` (`4/4` DSP suites PASS) · **`pluginval.exe --strictness-level 10` (`SUCCESS`, `exitCode = 0`, `13 secs`)** · `AGT-19` independent verification (`aether-punch-verification.test.ts`).
- **Load in FL Studio 2025:** Add `C:\Users\blago\Desktop\AETHERFORGE\products\aether-punch-vst3\dist` in FL Studio 2025 **Options → Manage Plugins → Plugin search paths** → **Find installed plugins** → load **`Aether Punch`**.

---

## 5. Documentation & Governance Reference Index

- **Charter, Vision & Requirements:** [PROJECT_CHARTER.md](./PROJECT_CHARTER.md) · [SYSTEM_VISION.md](./SYSTEM_VISION.md) · [SCOPE.md](./SCOPE.md) · [GOVERNANCE.md](./GOVERNANCE.md) · [PRD.md](./PRD.md) · [SRS.md](./SRS.md) · [CAPABILITY_MATRIX.md](./CAPABILITY_MATRIX.md) · [ACCEPTANCE_CRITERIA.md](./ACCEPTANCE_CRITERIA.md)
- **Research & Architecture:** [TECHNICAL_RESEARCH.md](./TECHNICAL_RESEARCH.md) · [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md) · [MODULE_CATALOG.md](./MODULE_CATALOG.md) · [SYSTEM_DIAGRAMS.md](./SYSTEM_DIAGRAMS.md) · [ARCHITECTURE_DECISION_RECORDS/README.md](./ARCHITECTURE_DECISION_RECORDS/README.md) (`ADR-0001..0012`) · [INTERFACE_CONTRACTS/core-contracts.md](./INTERFACE_CONTRACTS/core-contracts.md)
- **Integration, Audit & Operations:** [INTEGRATION_REPORT.md](./INTEGRATION_REPORT.md) · [E2E_TEST_RESULTS.md](./E2E_TEST_RESULTS.md) · [SYSTEM_COMPATIBILITY_MATRIX.md](./SYSTEM_COMPATIBILITY_MATRIX.md) · [RELEASE_BLOCKERS.md](./RELEASE_BLOCKERS.md) · [PRODUCTION_READINESS_AUDIT.md](./PRODUCTION_READINESS_AUDIT.md) · [RELEASE_REPORT.md](./RELEASE_REPORT.md)
- **Manuals & Reference Books:** [INSTALLATION_GUIDE.md](./INSTALLATION_GUIDE.md) · [CONFIGURATION_GUIDE.md](./CONFIGURATION_GUIDE.md) · [PRODUCTION_DEPLOYMENT_GUIDE.md](./PRODUCTION_DEPLOYMENT_GUIDE.md) · [OPERATOR_MANUAL.md](./OPERATOR_MANUAL.md) · [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md) · [DEVELOPER_REFERENCE_BOOK.md](./DEVELOPER_REFERENCE_BOOK.md) · [ARCHITECTURE_REFERENCE_BOOK.md](./ARCHITECTURE_REFERENCE_BOOK.md) · [REFERENCE_BOOK.md](./REFERENCE_BOOK.md)
