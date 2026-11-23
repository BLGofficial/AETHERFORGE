# AETHER FORGE — Persistent Engineering Reference Book

**Version:** 1.0.0  
**Date:** 2026-11-23  
**Status:** Canonical Living Engineering Reference (`v1.0.0-rc1`)  
**Companion Index:** [REFERENCE-BOOK.md](./REFERENCE-BOOK.md) (synchronized Blueprint v1.0 index)  
**Cross-References:** [PROJECT_CHARTER.md](./PROJECT_CHARTER.md) · [SYSTEM_VISION.md](./SYSTEM_VISION.md) · [SCOPE.md](./SCOPE.md) · [ENGINEERING_PRINCIPLES.md](./ENGINEERING_PRINCIPLES.md) · [GOVERNANCE.md](./GOVERNANCE.md) · [MASTER_ROADMAP.md](./MASTER_ROADMAP.md) · [PRD.md](./PRD.md) · [SRS.md](./SRS.md) · [CAPABILITY_MATRIX.md](./CAPABILITY_MATRIX.md) · [REQUIREMENTS_TRACEABILITY.md](./REQUIREMENTS_TRACEABILITY.md) · [ACCEPTANCE_CRITERIA.md](./ACCEPTANCE_CRITERIA.md) · [TECHNICAL_RESEARCH.md](./TECHNICAL_RESEARCH.md) · [TECHNOLOGY_COMPARISON.md](./TECHNOLOGY_COMPARISON.md) · [DEPENDENCY_REGISTER.md](./DEPENDENCY_REGISTER.md) · [LICENSING_REVIEW.md](./LICENSING_REVIEW.md) · [TECHNOLOGY_DECISIONS.md](./TECHNOLOGY_DECISIONS.md) · [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md) · [MODULE_CATALOG.md](./MODULE_CATALOG.md) · [SYSTEM_DIAGRAMS.md](./SYSTEM_DIAGRAMS.md) · [ARCHITECTURE_DECISION_RECORDS/README.md](./ARCHITECTURE_DECISION_RECORDS/README.md) · [INTERFACE_CONTRACTS/README.md](./INTERFACE_CONTRACTS/README.md)

---

## 1. Verified Development Environment & Discovered Constraints

Direct empirical inspection of the Windows 11 workstation (`C:\Users\blago\Desktop\AETHERFORGE`) established:

| Resource / Toolchain | Verified Status | Exact Evidence / Constraint |
|---|---|---|
| **Operating System** | Windows 11 x64 (`10.0.26200+`) | PowerShell 5.1 (`.ps1` execution policy disabled; invoke `.cmd` shims or `node`) |
| **Node.js & Package Manager** | Node.js `v26.13.0` · `pnpm.cmd` `10.30.3` · `npm.cmd` `11.14.1` | Supports native `--experimental-strip-types` TypeScript execution |
| **Git VCS** | Initialized (`main` branch) | Commits `ff90ec0`, `ec592cd`, `9948308` verified clean |
| **FL Studio 2025 (Target DAW)** | **INSTALLED (`25.1.6.4997`)** | `C:\Program Files\Image-Line\FL Studio 2025\FL64.exe` (`1,120,112` bytes, SHA-256 `273ECDC1C2421628`) & `FLEngine_x64.dll` (`63,013,744` bytes, SHA-256 `7753BB8B16752F0B`) |
| **FL Studio 2026 (Co-installed)** | **INSTALLED (`26.1.1.5547`)** | `C:\Program Files\Image-Line\FL Studio 2026\FL64.exe` + factory `.flp` projects (`NewStuff.flp`, `Breakbeat.flp`) |
| **CMake** | **INSTALLED** | `C:\Program Files\CMake\bin\cmake.exe` |
| **C++20 Compiler (`cl.exe` / `clang++` / `g++`)** | **ABSENT (Constraint)** | Blocks native `.vst3` binary compile on this host until MSVC BuildTools or LLVM is installed |
| **JUCE 8.x & Steinberg VST3 SDKs & `pluginval`** | **ABSENT (Constraint)** | `C:\JUCE`, `C:\VST_SDK`, and `pluginval.exe` not present; native `.vst3` target marked `BLOCKED_MISSING_PREREQUISITES` |
| **.NET 8 SDK (`dotnet`) / Native C# (`csc.exe`)** | **`csc.exe` INSTALLED & VERIFIED; `.NET 8 SDK` ABSENT** | Compiled `artifacts/native/AetherForge.WindowsWorker.exe` via `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe` with live Windows DPAPI & `FileAttributes.ReparsePoint` verification (`phase13-native-compilation.test.ts`) |
| **Python 3.14 (FL Studio Scripting Runtime)** | **INSTALLED (`C:\Python314\python.exe`)** | Verified `adapters/fl-studio-2025/scripts/device_aetherforge_inspect.py` read-only controller script |
| **Rust Toolchain (`cargo` / `rustc`)** | **ABSENT (Constraint)** | Not installed (`no cargo/rustc`); `workers/audio-engine/src/lib.rs` includes `gain_normalize_pcm16_wav` and `#[cfg(test)]` suite |

---

## 2. Monorepo Package & Module Ownership Registry (26 Workspace Projects)

| Package / Path | Domain | Responsibility | Verification Suite |
|---|---|---|---|
| `@aether-forge/contracts` (`contracts/`) | DOM-09 | Versioned Zod v1.0.0 schemas, `computeCanonicalPlanHash`, JSON Schema & OpenAPI 3.1 generator | `contracts/tests/compatibility/compatibility.test.ts` |
| `@aether-forge/api` (`apps/api/`) | DOM-01 / DOM-08 | OIDC seam, tenant-before-data 404 isolation, idempotency middleware, approval state machine, Emergency Stop | `tests/security/src/phase02-governance.test.ts` |
| `@aether-forge/web` (`apps/web/`) | DOM-08 | 4-screen HTML Control Plane UI + OpenAPI 3.1 JSON REST server + `pnpm dev` runner (`:4100`) | `tests/e2e/src/phase04-vertical-slice.test.ts`, `tests/contract/src/api-boundaries.test.ts` |
| `@aether-forge/audit` (`services/audit/`) | DOM-01 | Immutable append-only `AuditEvent` store & correlation trace reconstruction | `tests/security/src/phase02-governance.test.ts` |
| `@aether-forge/policy` (`services/policy/`) | DOM-01 | Signed OPA Rego v1 bundle (`governance.rego`) & fail-closed `OpaPolicyDecisionPoint` | `tests/security/src/phase03-policy-approvals.test.ts` |
| `@aether-forge/orchestration` (`services/orchestration/`) | DOM-03 | `DurableTemporalOrchestrator`, deterministic replay, activity retries, at-most-once ledger | `tests/e2e/src/phase04-vertical-slice.test.ts` |
| `@aether-forge/provider-gateway` (`services/provider-gateway/`) | DOM-02 | Prompt SHA-256 registry, pre-egress redaction fence, quotas, `ToolManifestRegistry`, `BoundedExecutionPlanner` | `tests/security/src/phase05-provider-planner.test.ts` |
| `@aether-forge/knowledge` (`services/knowledge/`) | DOM-09 | Postgres 16 + `pgvector` migration, immutable object store, chunk provenance citations, deletion & quarantine | `tests/security/src/phase07-knowledge-substrate.test.ts` |
| `@aether-forge/artifact-registry` (`services/artifact-registry/`) | DOM-10 | CycloneDX 1.5 SBOM, license & secret scanner, SLSA v1.0 provenance, signed artifact verification & rollback | `tests/security/src/phase11-observability-abuse.test.ts` |
| `@aether-forge/windows-host` (`workers/windows-host/`) | DOM-03 / DOM-07 | DPAPI identity store, outbound mTLS session, signed `JobManifest` verification, local job dispatch (+ `.NET 8` `.csproj`) | `tests/security/src/phase06-windows-worker.test.ts` |
| `@aether-forge/audio-engine` (`workers/audio-engine/`) | DOM-04 / DOM-07 | Offline PCM16 RIFF/WAVE inspection & `<0.01 dB` gain normalization (+ Rust `Cargo.toml`/`lib.rs`) | `tests/security/src/phase08-audio-engine.test.ts` |
| `@aether-forge/filesystem` (`adapters/filesystem/`) | DOM-03 | Canonical root confinement, NTFS junction/symlink detection, TOCTOU hash check, atomic `.tmp-*` write | `tests/security/src/phase06-windows-worker.test.ts` |
| `@aether-forge/git` (`adapters/git/`) | DOM-09 | Constrained Git workspace canonical path verifier | `tests/security/src/phase09-fl-studio-2025.test.ts` |
| `@aether-forge/daw-contract` (`adapters/daw-contract/`) | DOM-06 | Tiered DAW capability discovery & execution proof contract | `tests/security/src/phase09-fl-studio-2025.test.ts` |
| `@aether-forge/fl-studio-2025` (`adapters/fl-studio-2025/`) | DOM-06 | Empirically qualified FL Studio 2025 (`25.1.6.4997`) `.flp` (`FLhd`/`FLdt` + `0xC7`) `inspect` & `non_destructive_edit` | `tests/security/src/phase09-fl-studio-2025.test.ts` |
| `@aether-forge/vst3` (`plugins/vst3/`) | DOM-05 / DOM-07 | C++20 real-time processor (`AetherForgeProcessor.h/.cpp`), CMake build, static zero-I/O audit, 16-byte POD state round-trip | `tests/security/src/phase10-vst3-boundary.test.ts` |
| `@aether-forge/observability` (`packages/observability/`) | DOM-09 / DOM-10 | W3C `traceparent` 5-boundary span collector, alert engine, end-to-end job dashboard correlator | `tests/security/src/phase11-observability-abuse.test.ts` |
| `@aether-forge/sdk`, `@aether-forge/config`, `@aether-forge/ui`, `@aether-forge/test-fixtures` | DOM-08 / DOM-10 | Shared client SDK, environment config schema, UI helpers, and canonical test fixtures | `tests/contract/src/api-boundaries.test.ts` |

---

## 3. Core Invariants (`INV-01`..`INV-05`) & ADR Cross-Reference

1. **INV-01 ([ADR-0002](./docs/adr/0002-controlled-autonomy-policy-engine.md)):** No side effect without `requestId`, `traceId`, `idempotencyKey`, policy evaluation result (`policyVersion`), and immutable `AuditEvent`.
2. **INV-02 ([ADR-0001](./docs/adr/0001-hybrid-control-plane.md), [ADR-0010](./docs/adr/0010-release-integrity.md)):** No local job without enrolled worker identity, signed `JobManifest`, scoped `CapabilityGrant`, and valid expiry.
3. **INV-03 ([ADR-0002](./docs/adr/0002-controlled-autonomy-policy-engine.md)):** No approved action survives a `planHash` or `policyVersion` change.
4. **INV-04 ([ADR-0009](./docs/adr/0009-fl-studio-2025-qualification-layer.md)):** No claim of DAW capability without empirical qualification evidence for its exact version and capability tier ([docs/daws/fl-studio-2025-qualification.md](./docs/daws/fl-studio-2025-qualification.md)).
5. **INV-05 ([ADR-0010](./docs/adr/0010-release-integrity.md)):** No release artifact without CycloneDX SBOM, cryptographic signature, SLSA v1.0 provenance attestation, and passing test evidence ([RELEASE-CANDIDATE-v1.0.0-rc1.md](./RELEASE-CANDIDATE-v1.0.0-rc1.md)).

---

## 4. Product & Requirements Engineering Baseline Index

- **Product Requirements Document ([PRD.md](./PRD.md)):** Product capabilities, 5 personas (`Owner`, `Builder`, `Reviewer`, `ReleaseManager`, `WorkerOperator`), 6 project categories (`CAT-01`..`CAT-06`), 6 engineering workflows (`WF-01`..`WF-06`), and 4 deterministic agent autonomy levels (`Level 0`..`Level 3`).
- **Software Requirements Specification ([SRS.md](./SRS.md)):** Trust boundaries (`TB-1`..`TB-7`), operational constraints (`CON-01`..`CON-04`), 20 measurable functional requirements (`REQ-F-0001`..`REQ-F-0020`), and 14 measurable non-functional requirements (`REQ-NF-0001`..`REQ-NF-0014`).
- **Capability Matrix ([CAPABILITY_MATRIX.md](./CAPABILITY_MATRIX.md)):** 4-column matrix mapping Native Platform Capabilities, External Tool Capabilities, Human-Approval-Gated Capabilities, and Unsupported/Blocked Capabilities across all 11 capability areas.
- **Requirements Traceability Matrix ([REQUIREMENTS_TRACEABILITY.md](./REQUIREMENTS_TRACEABILITY.md)):** 100% bidirectional traceability mapping `REQ-F-0001..0020` and `REQ-NF-0001..0014` to governing ADRs/invariants, implementing packages/files, Zod contract schemas, and automated test suites.
- **Acceptance Criteria Ledger ([ACCEPTANCE_CRITERIA.md](./ACCEPTANCE_CRITERIA.md)):** Given/When/Then acceptance criteria (`AC-F-0001`..`AC-F-0020`, `AC-NF-0001`..`AC-NF-0014`) verified across `17` test suites (`52/52` passing tests).

---

## 5. Technical Research & Technology Decisions Index

- **Chief Technical Research Dossier ([TECHNICAL_RESEARCH.md](./TECHNICAL_RESEARCH.md)):** Evaluation of all 13 research domains distinguishing `[VERIFIED FACT]`, `[ENGINEERING RECOMMENDATION]`, and `[UNVERIFIED ASSUMPTION]`.
- **Technology Comparison Matrix ([TECHNOLOGY_COMPARISON.md](./TECHNOLOGY_COMPARISON.md)):** Decisive architectural tradeoffs across 13 domains (Bounded Planner vs. LangChain/AutoGen, OPA Rego vs. prompt judges, Temporal vs. queues, Postgres+`pgvector` vs. standalone vector DBs, C++20 lock-free VST3 vs. GC runtimes).
- **Dependency & Toolchain Register ([DEPENDENCY_REGISTER.md](./DEPENDENCY_REGISTER.md)):** Complete inventory of direct NPM dependencies (`zod`, `typescript`, `vitest`, `@types/node`), Node.js stdlib replacements, and verified vs. gated host toolchains.
- **Licensing & IP Compliance Review ([LICENSING_REVIEW.md](./LICENSING_REVIEW.md)):** Permissive SBOM license verification (`MIT`/`Apache-2.0`) plus dual-licensing gates for JUCE 8 (`AGPLv3` vs. Commercial), Steinberg VST3 SDK (`GPLv3` vs. Steinberg License), and Image-Line FL Studio 2025 EULA boundaries.
- **Technology Decisions Ledger ([TECHNOLOGY_DECISIONS.md](./TECHNOLOGY_DECISIONS.md)):** 13 binding technology decisions (`TD-01`..`TD-13`) traced to ADRs and runtime verification suites.

---

## 6. Master Systems Architecture & Contracts Index

- **Master Systems Architecture ([MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md)):** Complete logical, physical, runtime, data, protocol, lifecycle, failure-recovery, security-boundary, deployment, and scalability architecture across all 11 core engines.
- **Module Catalog ([MODULE_CATALOG.md](./MODULE_CATALOG.md)):** Detailed specification of responsibility, typed inputs/outputs, dependencies, public interfaces, internal components, failure conditions, and test suites for every workspace module (`MOD-01`..`MOD-14`).
- **System Diagrams ([SYSTEM_DIAGRAMS.md](./SYSTEM_DIAGRAMS.md)):** Mermaid diagrams for Hybrid Trust Boundaries (`TB-1`..`TB-7`), Monorepo Module Dependency Graph, Entity-Relationship & Evidence Provenance Data Flow, 10-Stage Governed Execution Sequence, and `INV-03` Approval/Workflow State Machine.
- **Architecture Decision Records ([ARCHITECTURE_DECISION_RECORDS/README.md](./ARCHITECTURE_DECISION_RECORDS/README.md) & [docs/adr/](./docs/adr/)):** Master registry linking `ADR-0001` through `ADR-0010` to invariants (`INV-01`..`INV-05`) and test suites.
- **Interface Contracts ([INTERFACE_CONTRACTS/README.md](./INTERFACE_CONTRACTS/README.md) & [core-contracts.md](./INTERFACE_CONTRACTS/core-contracts.md)):** Formal interface specifications synchronized with `@aether-forge/contracts`, [json-schema.json](./contracts/generated/json-schema.json), and [openapi.json](./contracts/generated/openapi.json).


---

## 7. Specialist Multi-Agent Network & Orchestration Contracts (Lead Multi-Agent Systems Architect Baseline)

| Artifact | Purpose | Path |
| :--- | :--- | :--- |
| **Agent Registry** | Complete roster of all 19 specialist agents (`AGT-01`..`AGT-19`), hierarchical & collaborative orchestration model, fenced path-lease concurrency control, shared context contracts, agent isolation, anti-fabrication rules, and escalation matrix | `C:\Users\blago\Desktop\AETHERFORGE\AGENT_REGISTRY.md` |
| **Agent Specifications** | Full 10-dimension specifications (system prompt, role, domain knowledge, tool permissions, I/O schemas, memory access, lifecycle, delegation policy, failure handling, evaluation benchmarks) across Tiers 0, 1, 2A, 2B, and 3 | `C:\Users\blago\Desktop\AETHERFORGE\AGENT_SPECIFICATIONS\README.md` (`tier-1`, `tier-2a`, `tier-2b`, `tier-3`) |
| **Agent Prompts** | Immutable governance preamble and verbatim production XML/JSON system prompts for all 19 specialist agents (`AGT-01`..`AGT-19`) | `C:\Users\blago\Desktop\AETHERFORGE\AGENT_PROMPTS\README.md` & `C:\Users\blago\Desktop\AETHERFORGE\AGENT_PROMPTS\system-prompts-catalog.md` |
| **Agent Contracts** | Zod and JSON Schema (Draft 2020-12) definitions for `TaskOwnershipLease`, monotonic `fenceToken`, `SharedContextEnvelope`, anti-fabrication `FileHashBinding`, delegation/escalation requests, and `AGT-19` `IndependentVerificationVerdict` | `C:\Users\blago\Desktop\AETHERFORGE\AGENT_CONTRACTS\README.md`, `multi-agent-contracts.md`, `agent-network-schemas.json` |
| **Agent Evaluation Framework** | 5 deterministic hard gates, per-agent benchmark catalog (`EVAL-AGT01-001`..`EVAL-AGT19-001`), and 4 adversarial concurrency/anti-fabrication torture scenarios (`ADV-MA-001..004`) | `C:\Users\blago\Desktop\AETHERFORGE\AGENT_EVALUATION_FRAMEWORK.md` |


---

## 8. System Compiler & Specification Schemas Index (Lead Systems Compiler Engineer Baseline)

| Artifact | Purpose | Path |
| :--- | :--- | :--- |
| **Compilation Pipeline Specification** | Architecture and formal transformation rules for the 12-stage System Compiler (`ARCH-04`), 6 input modalities, fail-closed semantic validation rules (`CON-RULE-01..03`), and 4-way traceability equations | `C:\Users\blago\Desktop\AETHERFORGE\COMPILATION_PIPELINE.md` |
| **System Compiler Engine** | Executable TypeScript 12-stage compiler (`AetherForgeSystemCompiler`) with Kahn topological sort, cycle/missing-dependency detector, contradiction validator, unsupported capability blocker, and 4-way traceability matrix builder | `C:\Users\blago\Desktop\AETHERFORGE\SYSTEM_COMPILER\src\index.ts` & `C:\Users\blago\Desktop\AETHERFORGE\SYSTEM_COMPILER\README.md` |
| **Specification Schemas** | Zod (`compiler-schemas.ts`) and JSON Schema Draft 2020-12 (`project-specification.schema.json`) contracts for all 6 input types, 12 pipeline stage IRs, validation reports, and `CompiledEngineeringSpecification` | `C:\Users\blago\Desktop\AETHERFORGE\SPECIFICATION_SCHEMAS\compiler-schemas.ts` & `C:\Users\blago\Desktop\AETHERFORGE\SPECIFICATION_SCHEMAS\project-specification.schema.json` |
| **Compiler Verification Suite** | Executable Vitest suite verifying all 6 input types, all 12 stages, 100% 4-way traceability (`REQ ↔ COMP ↔ TASK ↔ TEST ↔ AC`), contradiction rejection, unsupported capability blocking, missing/cyclic dependency rejection, and blocking ambiguity halting | `C:\Users\blago\Desktop\AETHERFORGE\COMPILER_TESTS\system-compiler.test.ts` |
| **Compilation Examples** | Machine-readable compiled specifications for a VST3/DSP + FL Studio 2025 audio system and a Multi-Agent Repository Governance workflow | `C:\Users\blago\Desktop\AETHERFORGE\COMPILATION_EXAMPLES\example-01-vst3-flstudio-transient-shaper.json` & `example-02-multi-agent-repo-governance.json` |


---

## 9. Durable Workflow & Multi-Agent Orchestration Engine Index (Principal Workflow & Orchestration Engineer Baseline)

| Artifact | Purpose | Path |
| :--- | :--- | :--- |
| **Execution State Machine Specification** | 12-state workflow lifecycle, 9-state step lifecycle, sequential/parallel/conditional/nested execution semantics, monotonic fencing tokens (`INV-SM-02`), and hash-chained disk WAL invariants (`INV-SM-03`) | `C:\Users\blago\Desktop\AETHERFORGE\EXECUTION_STATE_MACHINE.md` |
| **Recovery & Rollback Framework** | Two-tier disk persistence (`.wal.jsonl` + `.checkpoint.json`), crash recovery sequence across process restarts, bounded retry backoff, LIFO compensating saga rollback, and timeout/token/USD budget circuit breakers | `C:\Users\blago\Desktop\AETHERFORGE\RECOVERY_FRAMEWORK.md` |
| **Workflow Schema Contracts** | Zod (`workflow-schema.ts`) and JSON Schema Draft 2020-12 (`workflow-definition.schema.json`) contracts for workflow definitions, preconditions, failure policies, execution budgets, WAL events, and durable checkpoints | `C:\Users\blago\Desktop\AETHERFORGE\WORKFLOW_SCHEMA\workflow-schema.ts` & `C:\Users\blago\Desktop\AETHERFORGE\WORKFLOW_SCHEMA\workflow-definition.schema.json` |
| **Durable Workflow Engine** | Executable `DurableWorkflowEngine` supporting sequential, parallel, conditional branching, nested sub-workflows, human approval gates, disk checkpoint resume, retry, LIFO rollback, and idempotency deduplication | `C:\Users\blago\Desktop\AETHERFORGE\WORKFLOW_ENGINE\src\index.ts` & `C:\Users\blago\Desktop\AETHERFORGE\WORKFLOW_ENGINE\README.md` |
| **Multi-Agent Orchestration Engine** | `MultiAgentOrchestrationEngine` & `lowerCompiledSpecToWorkflowDefinition()` bridging `SYSTEM_COMPILER`, `AGT-01`..`AGT-19`, and `WORKFLOW_ENGINE` with `AGT-19` separation-of-duty enforcement | `C:\Users\blago\Desktop\AETHERFORGE\ORCHESTRATION_ENGINE\src\index.ts` & `C:\Users\blago\Desktop\AETHERFORGE\ORCHESTRATION_ENGINE\README.md` |
| **Workflow & Orchestration Verification Suite** | Executable Vitest suite testing sequential/parallel/conditional/nested flows, process crash & disk checkpoint resume, transient retry & permanent LIFO rollback, duplicate idempotency prevention, concurrent write-glob & fence-token conflicts, and budget caps | `C:\Users\blago\Desktop\AETHERFORGE\WORKFLOW_TESTS\workflow-orchestration.test.ts` |


---

## 10. Engineering Execution Runtime & Controlled Tool Gateway Index (Principal Software Engineering Automation Architect Baseline)

| Artifact | Purpose | Path |
| :--- | :--- | :--- |
| **Engineering Execution Runtime** | Top-level two-phase runtime (`stageToolProposal` Planning Phase vs. `executeStagedProposal` Execution Phase) preventing direct LLM execution and wiring checkpoints, rollback, and auditing | `C:\Users\blago\Desktop\AETHERFORGE\ENGINEERING_RUNTIME\src\index.ts` & `C:\Users\blago\Desktop\AETHERFORGE\ENGINEERING_RUNTIME\README.md` |
| **Controlled Tool Gateway & Schemas** | Tool registry (`EngineeringToolRegistry`), Zod + JSON-Schema input/output validation for all 11 tools (`tool-schemas.ts`, `tool-schemas.json`), pre-write snapshot checkpointing, and single-use HMAC `GatewayExecutionSeal` issuance | `C:\Users\blago\Desktop\AETHERFORGE\TOOL_GATEWAY\src\index.ts`, `tool-registry.ts`, `tool-schemas.ts`, `tool-schemas.json` |
| **Controlled Execution Adapters** | Concrete sandboxed execution adapters for `repo.inspect`, `file.create_or_modify`, `code.generate`, `code.review`, `git.execute`, `build.execute`, `test.execute`, `dependency.manage`, `docs.generate`, `api.integrate`, and `deploy.prepare` | `C:\Users\blago\Desktop\AETHERFORGE\EXECUTION_ADAPTERS\src\index.ts` & `C:\Users\blago\Desktop\AETHERFORGE\EXECUTION_ADAPTERS\README.md` |
| **Permission & Approval System** | Per-agent tool allowlists (`AGT-01`..`AGT-19`), Action Tier floors (`0..3`), fenced path-lease glob matching, and single-use human `ApprovalGrant` enforcement (`requesterId !== approverId`) | `C:\Users\blago\Desktop\AETHERFORGE\PERMISSION_SYSTEM\src\index.ts` & `C:\Users\blago\Desktop\AETHERFORGE\PERMISSION_SYSTEM\README.md` |
| **Artifact Manager** | Content-addressable SHA-256 artifact registry (`ART-XXXXX-<hash>`) with lineage binding and disk integrity verification | `C:\Users\blago\Desktop\AETHERFORGE\ARTIFACT_MANAGER\src\index.ts` & `C:\Users\blago\Desktop\AETHERFORGE\ARTIFACT_MANAGER\README.md` |
| **Execution Audit Log** | SHA-256 hash-chained append-only tool execution audit trail (`EngineeringExecutionAuditLog`) | `C:\Users\blago\Desktop\AETHERFORGE\EXECUTION_AUDIT\src\index.ts` & `C:\Users\blago\Desktop\AETHERFORGE\EXECUTION_AUDIT\README.md` |
| **Runtime Verification Suite** | Executable Vitest suite testing all 11 capabilities, planning/execution separation, direct gateway bypass rejection, human approval grants, sandbox traversal blocking, and automatic checkpoint rollback | `C:\Users\blago\Desktop\AETHERFORGE\ENGINEERING_RUNTIME\tests\engineering-runtime.test.ts` |


---

## 11. Audio, VST3 & Multi-DAW Domain Engineering Index (Chief Audio Systems Architect Baseline)

| Artifact | Purpose | Path |
| :--- | :--- | :--- |
| **Audio Domain Architecture** | Formal Three-Plane Audio Separation Law (Plane 1 AI Reasoning vs. Plane 2 Control/DAW Orchestration vs. Plane 3 Real-Time DSP Execution) and Subsystem A/B/C specifications | `C:\Users\blago\Desktop\AETHERFORGE\AUDIO_DOMAIN_ARCHITECTURE.md` |
| **DSP Engine (Subsystem A)** | Reusable 64-bit float audio ingestion, RBJ Direct Form II Transposed Biquad filter, soft-knee compressor, transient shaper, brickwall true-peak limiter, composable DSP pipeline, RIFF WAV Float32 codec, and ITU-R BS.1770-4 analyzer | `C:\Users\blago\Desktop\AETHERFORGE\DSP_ENGINE\src\index.ts` & `C:\Users\blago\Desktop\AETHERFORGE\DSP_ENGINE\README.md` |
| **VST3 Engine (Subsystem B)** | Reusable VST3 `IAudioProcessor` / `IEditController` split, normalized $[0,1] \leftrightarrow$ plain parameter registry, sample-accurate automation queue, preset persistence (`Vst3PresetManager`), host compatibility harness, and C++20 lock-free template | `C:\Users\blago\Desktop\AETHERFORGE\VST3_ENGINE\src\index.ts`, `templates\AetherForgeVst3Template.h`, `README.md` |
| **DAW Adapter Framework (Subsystem C)** | Capability-negotiated multi-DAW adapter registry (`IDawAdapter`), FL Studio 2025 production adapter (`FlStudio2025DomainAdapter`), replaceable Cockos REAPER adapter (`ReaperRppDomainAdapter`), routing graph cycle detector, and MIDI pattern transformer | `C:\Users\blago\Desktop\AETHERFORGE\DAW_ADAPTER_FRAMEWORK\src\index.ts` & `C:\Users\blago\Desktop\AETHERFORGE\DAW_ADAPTER_FRAMEWORK\README.md` |
| **Audio Test Framework** | Phase-cancellation null test ($\le -120\text{ dBFS}$), real-time callback WCET deadline profiler, and comprehensive Vitest verification suite across Subsystems A, B, and C | `C:\Users\blago\Desktop\AETHERFORGE\AUDIO_TEST_FRAMEWORK\src\index.ts` & `C:\Users\blago\Desktop\AETHERFORGE\AUDIO_TEST_FRAMEWORK\tests\audio-domain.test.ts` |
| **Domain Knowledge Packs** | Epistemically tagged (`verified_facts`, `engineering_recommendations`, `unverified_assumptions`) audio/VST3/FL Studio 2025 knowledge corpus | `C:\Users\blago\Desktop\AETHERFORGE\DOMAIN_KNOWLEDGE_PACKS\audio-domain-knowledge-pack.json` & `README.md` |


---

## 12. Persistent Knowledge, Memory & Context Assembly Index (Chief Knowledge & Memory Architect Baseline)

| Artifact | Purpose | Path |
| :--- | :--- | :--- |
| **Knowledge Governance Specification** | Formal Six-Layer Epistemic Partition (`SOURCE_DOCUMENT`, `EXTRACTED_KNOWLEDGE`, `VERIFIED_FACT`, `ENGINEERING_DECISION`, `GENERATED_ARTIFACT` quarantine, `EXECUTION_EVIDENCE`), versioning, provenance, conflict detection, and Obsidian Markdown portability rules | `C:\Users\blago\Desktop\AETHERFORGE\KNOWLEDGE_GOVERNANCE.md` |
| **Persistent Knowledge Engine** | `PersistentKnowledgeEngine` implementing 6-layer epistemic storage, immutable version history, `promoteToVerifiedFact()` (`AGT-19` execution evidence gate), `detectConflicts()`, and Obsidian Markdown YAML frontmatter + `[[Wikilinks]]` + backlinks vault export/import | `C:\Users\blago\Desktop\AETHERFORGE\KNOWLEDGE_ENGINE\src\index.ts` & `C:\Users\blago\Desktop\AETHERFORGE\KNOWLEDGE_ENGINE\README.md` |
| **Persistent Memory Engine** | `PersistentMemoryEngine` managing ADR lifecycle memory (`ACCEPTED`/`SUPERSEDED`), hash-chained Engineering History timeline, and isolated per-agent scratchpad memory (`memory://<tenant>/<project>/<agentId>/<key>`) | `C:\Users\blago\Desktop\AETHERFORGE\MEMORY_ENGINE\src\index.ts` & `C:\Users\blago\Desktop\AETHERFORGE\MEMORY_ENGINE\README.md` |
| **Document & Domain Pack Ingestion** | `KnowledgeDocumentIngestionPipeline` ingesting Markdown files, Obsidian notes, and JSON Domain Knowledge Packs with line-range and SHA-256 provenance | `C:\Users\blago\Desktop\AETHERFORGE\DOCUMENT_INGESTION\src\index.ts` & `C:\Users\blago\Desktop\AETHERFORGE\DOCUMENT_INGESTION\README.md` |
| **Hybrid Retrieval Engine** | `HybridKnowledgeRetrievalEngine` combining BM25 lexical scoring, deterministic 64-dim vector cosine similarity, and 1-hop Obsidian `[[Wikilink]]` graph expansion with `authoritativeOnly: true` quarantine enforcement | `C:\Users\blago\Desktop\AETHERFORGE\RETRIEVAL_ENGINE\src\index.ts` & `C:\Users\blago\Desktop\AETHERFORGE\RETRIEVAL_ENGINE\README.md` |
| **Project Context Assembly Engine & Tests** | `ProjectContextAssemblyEngine` building token-budgeted, conflict-checked `AssembledAgentContextPacket` envelopes for `AGT-01`..`AGT-19`, verified by Vitest suite | `C:\Users\blago\Desktop\AETHERFORGE\PROJECT_CONTEXT_ENGINE\src\index.ts` & `tests\knowledge-memory-system.test.ts` |


---

## 13. Independent Verification, 12-Discipline QA & Evidence Registry Index (Chief Verification & Quality Engineering Officer Baseline)

| Artifact | Purpose | Path |
| :--- | :--- | :--- |
| **Quality Gates Specification** | Formal Separation-of-Duty Law (`implementingAgentId !== verifierAgentId`), Anti-Compile-Only / Anti-Self-Report Completion Law, 12 verification disciplines (`QG-01..12`), and 6-field Requirement Acceptance Standard | `C:\Users\blago\Desktop\AETHERFORGE\QUALITY_GATES.md` |
| **Independent Verification Engine** | `IndependentVerificationEngine` (`AGT-19`) rejecting self-verification, code-only/compile-only/self-report completion claims, and fabricated disk hashes while issuing signed `RequirementAcceptanceRecord` certifications | `C:\Users\blago\Desktop\AETHERFORGE\VERIFICATION_ENGINE\src\index.ts` & `C:\Users\blago\Desktop\AETHERFORGE\VERIFICATION_ENGINE\README.md` |
| **12-Discipline QA Framework & Tests** | `QualityAssuranceFramework` executing Requirement Coverage, Unit, Integration, E2E, Static, Security, Performance, Agent Behavior, Workflow, Audio Quality, VST3 Compatibility, and Regression gates | `C:\Users\blago\Desktop\AETHERFORGE\QA_FRAMEWORK\src\index.ts`, `scripts\generate-qa-reports.ts`, `tests\independent-qa-verification.test.ts` |
| **Master Automated Test Catalog** | Complete catalog of all 23 automated Vitest suites (`74` executable tests) mapped to QA disciplines, implementing agents, and verified requirements | `C:\Users\blago\Desktop\AETHERFORGE\TEST_CATALOG\master-test-catalog.md` & `README.md` |
| **Requirement Coverage Report** | Machine-generated 6-field requirement acceptance report (`Expected Behavior`, `Verification Method`, `Test Result`, `Evidence Artifact`, `Pass/Fail Status`, `Known Limitations`) across all core platform requirements | `C:\Users\blago\Desktop\AETHERFORGE\REQUIREMENT_COVERAGE_REPORT\requirement-coverage-matrix.md` & `requirement-coverage-report.json` |
| **Cryptographic Evidence Registry** | Hash-chained on-disk SHA-256 evidence registry (`CryptographicEvidenceRegistry`) and verified ledger | `C:\Users\blago\Desktop\AETHERFORGE\EVIDENCE_REGISTRY\src\index.ts` & `verified-evidence-ledger.json` |


---

## 14. 11-Workspace Frontend Application & Design System Index (Principal Product Designer & Frontend Architect Baseline)

| Artifact | Purpose | Path |
| :--- | :--- | :--- |
| **Design System** | Aether Obsidian Slate industrial tokens, WCAG 2.1 AA badge semantics, and studio CSS generator | `C:\Users\blago\Desktop\AETHERFORGE\DESIGN_SYSTEM\src\index.ts` |
| **Component Library** | XSS-safe semantic HTML5 primitives (`renderWorkspaceShell`, `renderMetricCard`, `renderDataTable`, `renderStatusBadge`, `renderHashPill`) | `C:\Users\blago\Desktop\AETHERFORGE\COMPONENT_LIBRARY\src\index.ts` |
| **Authoritative API Integration** | `AetherForgeApplicationController` wiring all 11 workspaces directly to real backend engines with cryptographic state hashing | `C:\Users\blago\Desktop\AETHERFORGE\API_INTEGRATION\src\index.ts` |
| **11-Workspace Frontend Application** | HTTP server & SSR renderers for Command Center, Project Creation Studio, Architecture Studio, Agent Studio, Workflow Studio, Engineering Console, Knowledge Center, Testing Center, Integration Center, System Monitor, and Reference Library | `C:\Users\blago\Desktop\AETHERFORGE\FRONTEND_APPLICATION\src\{workspaces,server,index}.ts` |
| **E2E UI Tests** | Live HTTP E2E suite verifying all 11 SSR routes and real JSON mutation/query workflows including HTTP 423 Emergency Stop lock | `C:\Users\blago\Desktop\AETHERFORGE\E2E_UI_TESTS\e2e-ui-workspaces.test.ts` |

---

## 15. System Integration & Production-Readiness Audit Index (Principal Integration Architect & Independent Principal Systems Auditor Baseline)

| Artifact | Purpose | Path |
| :--- | :--- | :--- |
| **Integration Report & 4-Scenario E2E Results** | 10-subsystem integration validation, 4 resolved integration defects (`INT-DEF-001..004`), and full `25/25` (`80/80`) test results across Scenarios 1–4 | `C:\Users\blago\Desktop\AETHERFORGE\INTEGRATION_REPORT.md`, `E2E_TEST_RESULTS.md`, `tests\e2e\src\master-4-scenario-integration.test.ts` |
| **Compatibility Matrix & Release Blockers** | Verified host compatibility matrix and transparent external prerequisite blockers (`BLK-001..004`) | `C:\Users\blago\Desktop\AETHERFORGE\SYSTEM_COMPATIBILITY_MATRIX.md` & `RELEASE_BLOCKERS.md` |
| **Production-Readiness Audit** | Complete 14-point audit and Final Acceptance Matrix issuing the evidence-justified **`CONDITIONALLY READY`** verdict | `C:\Users\blago\Desktop\AETHERFORGE\PRODUCTION_READINESS_AUDIT.md` |
| **Production Operations & Reference Manuals** | Deployment, Installation, Configuration, Operator Manual, Developer Reference Book, Architecture Reference Book, Troubleshooting Guide, and Master Release Report | `PRODUCTION_DEPLOYMENT_GUIDE.md`, `INSTALLATION_GUIDE.md`, `CONFIGURATION_GUIDE.md`, `OPERATOR_MANUAL.md`, `DEVELOPER_REFERENCE_BOOK.md`, `ARCHITECTURE_REFERENCE_BOOK.md`, `TROUBLESHOOTING_GUIDE.md`, `RELEASE_REPORT.md` |


---

## 16. Flagship Products Built Inside AETHER FORGE

| Product | Deliverable Path | Binary / Verification Proof |
| :--- | :--- | :--- |
| **Aether Punch (`v1.0.0`)** — Native C++20 VST3 Transient Shaper, Analog `tanh` Saturator & True-Peak Limiter | `C:\Users\blago\Desktop\AETHERFORGE\products\aether-punch-vst3\dist\AetherPunch.vst3` | Windows x64 standalone `.vst3` (`788,992` bytes, SHA-256 `9FA24B84C509D2A9`), `AetherPunchCoreTests.exe` (`4/4` DSP suites PASS), **`pluginval.exe --strictness-level 10` `SUCCESS`**, certified by `AGT-19`. |
