# AETHER FORGE — Architecture Reference Book

**Version:** 1.0.0  
**Status:** Living Architecture Index (Phase 00–15 Complete, `v1.0.0`)  
**Cross-References:** [README.md](./README.md) · [GOVERNANCE.md](./GOVERNANCE.md) · [REFERENCE_BOOK.md](./REFERENCE_BOOK.md) · [PRD.md](./PRD.md) · [SRS.md](./SRS.md) · [CAPABILITY_MATRIX.md](./CAPABILITY_MATRIX.md) · [REQUIREMENTS_TRACEABILITY.md](./REQUIREMENTS_TRACEABILITY.md) · [ACCEPTANCE_CRITERIA.md](./ACCEPTANCE_CRITERIA.md) · [TECHNICAL_RESEARCH.md](./TECHNICAL_RESEARCH.md) · [TECHNOLOGY_COMPARISON.md](./TECHNOLOGY_COMPARISON.md) · [DEPENDENCY_REGISTER.md](./DEPENDENCY_REGISTER.md) · [LICENSING_REVIEW.md](./LICENSING_REVIEW.md) · [TECHNOLOGY_DECISIONS.md](./TECHNOLOGY_DECISIONS.md) · [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md) · [MODULE_CATALOG.md](./MODULE_CATALOG.md) · [SYSTEM_DIAGRAMS.md](./SYSTEM_DIAGRAMS.md) · [ARCHITECTURE_DECISION_RECORDS/README.md](./ARCHITECTURE_DECISION_RECORDS/README.md) · [INTERFACE_CONTRACTS/README.md](./INTERFACE_CONTRACTS/README.md) · [contracts/README.md](./contracts/README.md) · [Requirements](./docs/product/requirements.md) · [Threat Model](./docs/security/threat-model.md) · [Data Classification](./docs/security/data-classification.md) · [Backlog](./backlog/issues.md)

> **Maintenance Rule:** Any feature or phase delivery must update the relevant sections of this Reference Book or explicitly record `"no reference-book impact"` in its phase report.

---

## 1. Goals and Non-Goals

### Primary Goals
1. **Governed Brief-to-Artifact Execution:** Transform product and audio/engineering briefs into typed specifications, deterministic execution plans, policy checks, human approvals, durable Temporal workflows, and verifiable evidence.
2. **Safe Hybrid Execution:** Combine cloud multi-tenant governance with a customer-operated Windows 11 Worker that retains local sovereignty over private audio files, DAW sessions, and hardware devices.
3. **Qualified DAW & DSP Integration:** Deliver offline deterministic Rust audio processing, a strictly real-time-safe C++20/JUCE VST3 processor, and a tier-qualified FL Studio 2025 adapter.
4. **End-to-End Traceability:** Bind every side effect to a correlation ID, idempotency key, policy version, plan hash, capability grant, and immutable audit event.

### Explicit Non-Goals
- Inbound remote control or unrestricted shell/desktop execution on customer machines.
- Storing or exposing LLM provider secrets in browsers or local workers.
- Claiming support for macOS/Linux workers, non-FL Studio DAWs, or real-time multi-user cloud DSP rendering in v1.0.
- Uncited knowledge claims or model self-approval of consequential actions.

---

## 2. Canonical Glossary

| Term | Definition |
|---|---|
| **Brief** | Structured user input describing desired product, code, audio, or DAW outcomes and constraints. |
| **ProductSpec** | Versioned specification derived from a `Brief`, defining scope, acceptance criteria, and required capabilities. |
| **ExecutionPlan** | Directed acyclic sequence of typed `PlanStep` items produced by the bounded planner, hashed via canonical SHA-256 (`planHash`). |
| **CapabilityGrant** | Short-lived, signed authorization token binding a specific `workerId`, `planHash`, `stepId`, `actionClass`, `canonicalPathScope`, and `expiresAt`. |
| **JobManifest** | Cryptographically signed work package pulled by the Windows Worker containing a `WorkerJob` and its `CapabilityGrant`. |
| **EvidenceRef** | Immutable pointer (`evidenceId`, `artifactHash`, `producer`, `verifiableLocation`) proving an action's outcome. |
| **Qualification Tier** | Independently tested DAW capability level: `inspect`, `non_destructive_edit`, `session_mutation`, or `render`. |

---

## 3. Invariant Link Matrix

| Invariant ID | Invariant Statement | Enforcing Modules | Governing ADR & Doc |
|---|---|---|---|
| **INV-01** | No side effect without `requestId`, `traceId`, `idempotencyKey`, policy decision, and `AuditEvent`. | Domain API, Policy Decision Point, Temporal Orchestrator, Audit Service | [ADR-0002](./docs/adr/0002-controlled-autonomy-policy-engine.md), [GOVERNANCE.md §1](./GOVERNANCE.md) |
| **INV-02** | No local job without enrolled worker identity, signed `JobManifest`, scoped `CapabilityGrant`, and valid expiry. | Worker Gateway, Windows Worker | [ADR-0001](./docs/adr/0001-hybrid-control-plane.md), [ADR-0010](./docs/adr/0010-release-integrity.md) |
| **INV-03** | No approved action survives a `planHash` or `policyVersion` change. | Approval Service, Policy Decision Point, Windows Worker | [ADR-0002](./docs/adr/0002-controlled-autonomy-policy-engine.md), [GOVERNANCE.md §3](./GOVERNANCE.md) |
| **INV-04** | No claim of DAW capability without qualification evidence for its exact version and capability tier. | DAW Contract, FL Studio 2025 Adapter, Policy Decision Point | [ADR-0009](./docs/adr/0009-fl-studio-2025-qualification-layer.md) |
| **INV-05** | No release artifact without SBOM, cryptographic signature, provenance attestation, and passing test evidence. | Artifact Registry, CI/CD Release Pipeline, Windows Worker | [ADR-0010](./docs/adr/0010-release-integrity.md) |

---

## 4. Architecture Decision Record (ADR) Index

| ADR | Title | Status | Key Boundary Rule |
|---|---|---|---|
| [ADR-0001](./docs/adr/0001-hybrid-control-plane.md) | Hybrid Control Plane and Local Execution Plane | Accepted | Outbound-only mTLS from Windows Worker; no direct cloud access to local filesystem |
| [ADR-0002](./docs/adr/0002-controlled-autonomy-policy-engine.md) | Controlled Autonomy as a Policy Engine | Accepted | Deterministic OPA policy (`allow`, `requireApproval`, `deny`); default approval-required for mutations |
| [ADR-0003](./docs/adr/0003-temporal-durable-orchestration.md) | Temporal for Durable Orchestration | Accepted | Deterministic workflows; activities carry work; no local file bytes/secrets in Temporal state |
| [ADR-0004](./docs/adr/0004-typed-protocol-first.md) | Typed Protocol First | Accepted | Versioned TypeScript/Zod contracts at every trust boundary; zero untyped `any` |
| [ADR-0005](./docs/adr/0005-bounded-agent-roles.md) | Agent Roles as Bounded Tools Behind a Planner | Accepted | Planner emits declarative plans; agents cannot mint grants, alter policy, or self-approve |
| [ADR-0006](./docs/adr/0006-provider-gateway-redaction-routing.md) | Provider Abstraction with Redaction and Routing | Accepted | Server-side provider keys only; mandatory classification and redaction check before egress |
| [ADR-0007](./docs/adr/0007-evidence-addressable-knowledge.md) | Knowledge is Evidence-Addressable | Accepted | Postgres metadata + immutable object storage + pgvector; mandatory provenance citations |
| [ADR-0008](./docs/adr/0008-local-audio-engine-separate-from-vst3.md) | Local Audio Engine Separate from VST3 | Accepted | Rust offline DSP service vs. isolated C++20/JUCE VST3 real-time audio processor |
| [ADR-0009](./docs/adr/0009-fl-studio-2025-qualification-layer.md) | FL Studio 2025 Adapter as a Qualification Layer | Accepted | Capability tiers (`inspect`, `non_destructive_edit`, `session_mutation`, `render`) gated by proof |
| [ADR-0010](./docs/adr/0010-release-integrity.md) | Supply-Chain and Release Integrity | Accepted | Signed binaries/manifests, SBOM, SLSA provenance, staged rollout, and tested rollback |

---

## 5. Current Capability & Qualification Matrix (Phase 12 Release Candidate Baseline)

| Subsystem / Capability | Target Phase | Current Status | Qualification / Verification Evidence |
|---|---|---|---|
| Engineering Foundation & Governance Docs | Phase 00 | **Complete** | Baseline documents verified on disk |
| Monorepo & Versioned Zod Contracts (`contracts/`) | Phase 01 | **Complete** | `pnpm install`, `pnpm schemas:generate`, `pnpm typecheck`, `pnpm test` passing; JSON Schema & OpenAPI 3.1 generated in `contracts/generated/` |
| Identity, Tenancy & Emergency Stop Middleware | Phase 02 | **Complete** | OIDC seam, tenant-before-data isolation (`404 NOT_FOUND` cross-tenant), idempotency store, append-only audit store, approval state machine (`INV-03` drift invalidation), and emergency stop verified in `tests/security/src/phase02-governance.test.ts` |
| OPA Policy Bundles & Approval Binding | Phase 03 | **Complete** | Versioned OPA bundle (`services/policy/bundles/v1/governance.rego`), `OpaPolicyDecisionPoint`, UI-safe decision explanations, fail-closed evaluation, `canonicalPathScope` enforcement, revoked-grant & policy-rotation invalidation verified in `tests/security/src/phase03-policy-approvals.test.ts` |
| Temporal Governed Vertical Slice (Simulated) | Phase 04 | **Complete** | `DurableTemporalOrchestrator` (`services/orchestration`), Web Control Plane 4-screen UI & HTTP server (`apps/web`), Temporal restart/retry/cancellation & E2E happy-path tests verified in `tests/e2e/src/phase04-vertical-slice.test.ts` |
| Provider Gateway & Bounded Planner | Phase 05 | **Complete** | `ProviderGatewayService`, `PromptTemplateRegistry`, pre-egress redaction/classification fence, `TenantBudgetTracker`, `DeterministicFakeProviderAdapter`, `ToolManifestRegistry`, and `BoundedExecutionPlanner` verified across valid/malformed/over-budget/unsafe fixtures in `tests/security/src/phase05-provider-planner.test.ts` |
| Windows Worker (.NET 8) Constrained Filesystem Slice | Phase 06 | **Complete** | `.NET 8` skeleton (`workers/windows-host/AetherForge.WindowsWorker.csproj`, `Program.cs`) + executable Windows host & constrained filesystem adapter (`@aether-forge/windows-host`, `@aether-forge/filesystem`) verified against traversal, NTFS junction/reparse points, TOCTOU, unsigned/expired/revoked manifests in `tests/security/src/phase06-windows-worker.test.ts` |
| Evidence-Addressable Knowledge Service | Phase 07 | **Complete** | `EvidenceAddressableKnowledgeService`, `ImmutableLocalObjectStore`, Postgres + `pgvector` migration (`services/knowledge/migrations/0001_knowledge_pgvector.sql`), provenance citations, quarantine of unsafe inputs, and synchronous deletion propagation verified in `tests/security/src/phase07-knowledge-substrate.test.ts` |
| Local Rust Offline Audio Engine (WAV Inspect + Gain) | Phase 08 | **Complete** | Rust crate (`workers/audio-engine/Cargo.toml`, `src/lib.rs`) + executable PCM16 WAV DSP engine (`@aether-forge/audio-engine`) wired into `WindowsWorkerHost` with golden WAV tolerance (`<0.01 dB`), source immutability, quota enforcement, and cancellation safety verified in `tests/security/src/phase08-audio-engine.test.ts` |
| FL Studio 2025 Adapter (`inspect`, mutations, `render`) | Phase 09 | **Complete (`inspect` & `non_destructive_edit` Qualified; `session_mutation` & `render` Blocked)** | Empirical discovery of installed FL Studio 2025 (`25.1.6.4997`) recorded in [docs/daws/fl-studio-2025-qualification.md](./docs/daws/fl-studio-2025-qualification.md); `@aether-forge/fl-studio-2025` adapter verified in `tests/security/src/phase09-fl-studio-2025.test.ts` |
| C++20 / JUCE VST3 Processor | Phase 10 | **Source & Boundary Complete; Native `.vst3` Binary Blocked by Missing SDKs** | C++20 real-time processor (`plugins/vst3/AetherForgeProcessor/`), `CMakeLists.txt`, static real-time I/O audit, state round-trip, and shared DSP golden vector parity verified in `tests/security/src/phase10-vst3-boundary.test.ts`. Native `.vst3` compilation marked `BLOCKED_MISSING_PREREQUISITES` (`C++20 compiler`, `JUCE_SOURCE_DIR`, `VST3_SDK_DIR`, `pluginval` absent on host; `cmake.exe` present) |
| OpenTelemetry, Abuse Tests & Supply-Chain Signing | Phase 11 | **Complete** | W3C OpenTelemetry trace correlation across `web → api → temporal → worker → adapter` (`@aether-forge/observability`), CycloneDX 1.5 SBOM, license & secret scanner, SLSA v1.0 provenance & signed artifact rollback (`@aether-forge/artifact-registry`), operational runbooks (`docs/operations/runbooks.md`), and 6-scenario abuse suite verified in `tests/security/src/phase11-observability-abuse.test.ts` |
| Integrated Release Candidate (v1.0-rc1) | Phase 12 | **Complete (Retained as Non-Production Pending Release Manager Approval)** | End-to-end integrated slice (`tests/e2e/src/phase12-release-candidate.test.ts`), latency/throughput benchmark (`tests/performance/src/phase12-performance.test.ts`), CycloneDX SBOM, SLSA provenance, signed release attestation (`artifacts/release-v1.0.0-rc1/`), [CHANGELOG.md](./CHANGELOG.md), and [RELEASE-CANDIDATE-v1.0.0-rc1.md](./RELEASE-CANDIDATE-v1.0.0-rc1.md) verified |

---

## 6. Risk Register

| Risk ID | Category | Description | Likelihood | Impact | Mitigation Strategy | Owner |
|---|---|---|---|---|---|---|
| **RSK-01** | DAW Integration | FL Studio 2025 lacks a single official headless API for all project mutations; UI automation can be fragile. | High | High | Enforce [ADR-0009](./docs/adr/0009-fl-studio-2025-qualification-layer.md): qualify `inspect` first; require pre-mutation backups; gate UI fallback as opt-in, foreground-only, non-destructive. | Builder / Reviewer |
| **RSK-02** | Local Trust Boundary | Path traversal, symlink/junction attacks, or TOCTOU races allow Windows Worker to write outside granted workspace. | Medium | Critical | Enforce canonical path resolution, reparse-point rejection, handle locking, and adversarial tests in Phase 06. | Worker Operator / Reviewer |
| **RSK-03** | LLM Safety / Prompt Injection | Retrieved documents or user briefs inject instructions attempting to bypass policy or exfiltrate local data. | High | High | Enforce [ADR-0005](./docs/adr/0005-bounded-agent-roles.md) & [ADR-0002](./docs/adr/0002-controlled-autonomy-policy-engine.md): planner emits typed schema only; OPA policy and human approval gate side effects; Provider Gateway redacts egress. | Owner / Reviewer |
| **RSK-04** | Approval Drift | Plan or policy changes after a human approves an action, leading to unintended execution. | Medium | High | Bind approvals to `planHash` and `policyVersion`; verify hash match at both cloud dispatch and local worker execution (INV-03). | Reviewer |
| **RSK-05** | Real-Time Audio Glitching | VST3 plugin performs allocations, locks, or IPC on the real-time audio thread, crashing the host DAW. | Medium | High | Enforce [ADR-0008](./docs/adr/0008-local-audio-engine-separate-from-vst3.md): strict real-time C++20 rules, zero network/LLM in VST3, validated via `pluginval` and host smoke tests. | Builder |
| **RSK-06** | SDK / Licensing Availability | Local workstation or CI lacks licensed FL Studio 2025 or VST3/JUCE prerequisites during later phases. | Medium | Medium | Phase 09 and Phase 10 gates require explicit prerequisite verification; mark blocked rather than fabricating support. | Release Manager |

---

## 7. Registries (Updated at Phase 01)

- **Contract Registry:** Implemented in `@aether-forge/contracts` (`schemaVersion: "1.0.0"`), exported via `@aether-forge/sdk`, with generated artifacts at `contracts/generated/json-schema.json` and `contracts/generated/openapi.json`.
- **Prompt / Template Version Registry:** Implemented in `PromptTemplateRegistry` (`services/provider-gateway/src/index.ts`); active registered template: `planner.execution-plan.v1@1.0.0` (SHA-256 verified before egress).
- **Test Inventory:**
  - `contracts/tests/compatibility/compatibility.test.ts` (Zod domain/worker/tool/event validation, `Result<T>` branches, additive minor evolution, breaking major/field rejection, canonical `planHash` determinism, JSON Schema/OpenAPI generation, and zero-`any` boundary scan).
  - `tests/contract/src/api-boundaries.test.ts` (Cross-module API & SDK request contract suite).
  - `tests/security/src/phase02-governance.test.ts` (Cross-tenant 404 isolation before data access, role enforcement, idempotency replay & conflict detection, changed-plan `planHash` / `policyVersion` approval invalidation, approval expiry, and emergency stop workflow signaling).
  - `tests/security/src/phase03-policy-approvals.test.ts` (OPA versioned policy bundle evaluation across all action classes, unknown-action deny default, UI-safe explanations, fail-closed bundle unavailability, `canonicalPathScope` enforcement, revoked grant rejection, and policy bundle rotation invalidation).
  - `tests/e2e/src/phase04-vertical-slice.test.ts` (Durable Temporal workflow mid-wait restart/replay, activity transient retry, duplicate signal idempotency, Emergency Stop cancellation, and live HTTP Web Control Plane UI end-to-end happy path).
  - `tests/security/src/phase05-provider-planner.test.ts` (Provider Gateway redaction/classification fence, prompt template hash verification, token/cost budget enforcement, and Bounded Execution Planner evaluation fixtures for valid, malformed, over-budget, and unsafe plans).
  - `tests/security/src/phase06-windows-worker.test.ts` (Windows Worker DPAPI identity store, outbound mTLS session & heartbeat, signed `JobManifest` and `CapabilityGrant` verification, expired/revoked grant denial, and adversarial path traversal, NTFS junction/reparse-point, TOCTOU, and cancellation cleanup tests).
  - `tests/security/src/phase07-knowledge-substrate.test.ts` (Knowledge source ingestion, SHA-256 content hash, immutable object reference, chunk provenance citations, tenant isolation, synchronous deletion propagation, and unsafe/prompt-injection quarantine tests).
  - `tests/security/src/phase08-audio-engine.test.ts` (Golden PCM16 WAV metadata inspection, deterministic `gain_normalize` `<0.01 dB` tolerance, bit-exact SHA-256 reproducibility, source immutability, resource quota & format validation, and cancellation zero-partial-file tests).
  - `tests/security/src/phase09-fl-studio-2025.test.ts` (FL Studio 2025 `25.1.6.4997` installation discovery, `.flp` `FLhd`/`FLdt` read-only `inspect`, `non_destructive_edit` copy-on-write staging with mandatory backup, and fail-closed denial of unqualified `session_mutation`, `render`, and UI automation fallback).
  - `tests/security/src/phase10-vst3-boundary.test.ts` (C++20 VST3 processor static real-time boundary audit, parameter automation, 16-byte POD state round-trip, shared DSP golden vector parity, and prerequisite blocker detection).
  - `tests/security/src/phase11-observability-abuse.test.ts` (OpenTelemetry 5-boundary W3C traceparent correlation dashboard, CycloneDX 1.5 SBOM & license check, workspace secret scan, SLSA v1.0 artifact signing & rollback, and 6 abuse cases: prompt injection, forged job, replayed approval, path escape, tampered artifact, provider outage).
  - `tests/e2e/src/phase12-release-candidate.test.ts` (Complete integrated vertical slice: Brief → Knowledge → Planner → Policy → Approval → Temporal → Windows Worker [Workspace Write + Offline Audio DSP + Qualified FL Studio 2025 Inspect] → Evidence/Audit → UI → Signed RC1 & Rollback Rehearsal).
  - `tests/performance/src/phase12-performance.test.ts` (200-iteration OPA policy & canonical plan-hash latency benchmark `<2.0ms` avg; 1s 48kHz stereo PCM16 WAV synthesis & inspection `<50ms`).
- **Operational Runbooks Index:** Authored at [docs/operations/runbooks.md](./docs/operations/runbooks.md) and linked to [infra/monitoring/dashboards-and-alerts.json](./infra/monitoring/dashboards-and-alerts.json).
- **Release Evidence Bundle:** [RELEASE-CANDIDATE-v1.0.0-rc1.md](./RELEASE-CANDIDATE-v1.0.0-rc1.md), [CHANGELOG.md](./CHANGELOG.md), and `artifacts/release-v1.0.0-rc1/{sbom.cdx.json,provenance.intoto.json,release-attestation.json}`.


### Specialist Multi-Agent Network Deliverables (Lead Multi-Agent Systems Architect Baseline)
- `AGENT_REGISTRY.md`: Master registry of all 19 specialist agents (`AGT-01`..`AGT-19`), hierarchical & collaborative orchestration topology, fenced path-lease concurrency control (`fenceToken` + disjoint `exclusiveWriteGlobs`), shared context contracts, agent isolation, anti-fabrication rules, and escalation matrix.
- `AGENT_SPECIFICATIONS/README.md`, `tier-1-architecture-discovery.md`, `tier-2a-ai-agentic-engineering.md`, `tier-2b-native-audio-daw-engineering.md`, `tier-3-ops-security-quality-verification.md`: Complete 10-dimension specifications for all 19 agents.
- `AGENT_PROMPTS/README.md` & `AGENT_PROMPTS/system-prompts-catalog.md`: Immutable governance preamble and verbatim production XML/JSON system prompts for `AGT-01` through `AGT-19`.
- `AGENT_CONTRACTS/README.md`, `AGENT_CONTRACTS/multi-agent-contracts.md`, & `AGENT_CONTRACTS/agent-network-schemas.json`: Zod and JSON Schema (Draft 2020-12) contracts for `TaskOwnershipLease`, `SharedContextEnvelope`, `FileHashBinding`, delegation/escalation payloads, and `AGT-19` `IndependentVerificationVerdict`.
- `AGENT_EVALUATION_FRAMEWORK.md`: 5 deterministic hard gates, per-agent benchmark catalog (`EVAL-AGT01-001`..`EVAL-AGT19-001`), and adversarial concurrency/anti-fabrication torture suite (`ADV-MA-001..004`).


### System Compiler & Specification Schemas Deliverables (Lead Systems Compiler Engineer Baseline)
- `COMPILATION_PIPELINE.md`: 12-stage System Compiler specification covering 6 input modalities, stage-by-stage IR lowering, fail-closed semantic validation rules (`CON-RULE-01..03`), and 4-way traceability invariant (`REQ ↔ COMP ↔ TASK ↔ TEST ↔ AC`).
- `SYSTEM_COMPILER/src/index.ts` & `SYSTEM_COMPILER/scripts/generate-examples.ts`: Executable TypeScript implementation of `AetherForgeSystemCompiler` and example generator.
- `SPECIFICATION_SCHEMAS/compiler-schemas.ts` & `SPECIFICATION_SCHEMAS/project-specification.schema.json`: Strict Zod and JSON Schema (Draft 2020-12) definitions for `CompiledEngineeringSpecification` (`v1.0.0`).
- `COMPILER_TESTS/system-compiler.test.ts`: Automated Vitest suite verifying all 6 input types, 12 stages, 100% 4-way traceability, contradiction rejection, unsupported capability rejection, missing/cyclic dependency rejection, and ambiguity halting.
- `COMPILATION_EXAMPLES/example-01-vst3-flstudio-transient-shaper.json` & `COMPILATION_EXAMPLES/example-02-multi-agent-repo-governance.json`: Deterministic compiled specification bundles.


### Durable Workflow & Multi-Agent Orchestration Engine Deliverables (Principal Workflow & Orchestration Engineer Baseline)
- `EXECUTION_STATE_MACHINE.md`: Formal 12-state workflow and 9-state step state machine, topological readiness rules, parallel disjoint write-glob invariants, and WAL hash-chain invariants.
- `RECOVERY_FRAMEWORK.md`: Disk-persisted WAL (`.wal.jsonl`) and atomic checkpoint snapshot (`.checkpoint.json`) crash recovery protocol, retry backoff taxonomy, LIFO compensating saga rollback, and timeout/budget circuit breakers.
- `WORKFLOW_SCHEMA/workflow-schema.ts` & `WORKFLOW_SCHEMA/workflow-definition.schema.json`: Strict Zod and JSON Schema (Draft 2020-12) definitions for `WorkflowDefinition`, `DurableWorkflowCheckpoint`, and `WalEventRecord`.
- `WORKFLOW_ENGINE/src/index.ts`: Executable `DurableWorkflowEngine` with disk persistence, crash-safe `resumeFromDiskCheckpoint()`, retry, LIFO rollback, human approval gates, and idempotency deduplication.
- `ORCHESTRATION_ENGINE/src/index.ts`: Executable `MultiAgentOrchestrationEngine` and `lowerCompiledSpecToWorkflowDefinition()` lowering `CompiledEngineeringSpecification` bundles into durable multi-agent workflows.
- `WORKFLOW_TESTS/workflow-orchestration.test.ts`: Automated Vitest suite verifying all topologies, crash/restart resume, failed agent retry & LIFO rollback, duplicate execution deduplication, and concurrent conflict rejection.


### Engineering Execution Runtime & Controlled Tool Gateway Deliverables (Principal Software Engineering Automation Architect Baseline)
- `ENGINEERING_RUNTIME/src/index.ts` & `ENGINEERING_RUNTIME/tests/engineering-runtime.test.ts`: Two-phase Planning (`stageToolProposal`) vs. Execution (`executeStagedProposal`) runtime and automated Vitest verification suite.
- `TOOL_GATEWAY/src/index.ts`, `tool-registry.ts`, `tool-schemas.ts`, & `tool-schemas.json`: Non-bypassable `ControlledToolGateway` with 100% Zod input/output validation, pre-execution file checkpoint snapshots, automatic rollback on error, and single-use HMAC `GatewayExecutionSeal` tokens.
- `EXECUTION_ADAPTERS/src/index.ts`: Sandboxed execution adapters for all 11 capabilities (`repo.inspect`, `file.create_or_modify`, `code.generate`, `code.review`, `git.execute`, `build.execute`, `test.execute`, `dependency.manage`, `docs.generate`, `api.integrate`, `deploy.prepare`).
- `PERMISSION_SYSTEM/src/index.ts`: Per-agent tool allowlists, Action Tier enforcement, fenced path-lease glob containment, and single-use human `ApprovalGrant` verification.
- `ARTIFACT_MANAGER/src/index.ts`: Content-addressable SHA-256 artifact registration and tamper verification.
- `EXECUTION_AUDIT/src/index.ts`: SHA-256 hash-chained immutable execution audit log.


### Audio, VST3 & Multi-DAW Domain Engineering Deliverables (Chief Audio Systems Architect Baseline)
- `AUDIO_DOMAIN_ARCHITECTURE.md`: Three-Plane Audio Separation Law (Plane 1 AI Reasoning, Plane 2 Control/DAW Orchestration, Plane 3 Real-Time DSP Execution) and modular architecture for Subsystems A, B, and C.
- `DSP_ENGINE/src/index.ts`: Reusable 64-bit float audio buffers, RBJ Biquad filter (`LOWPASS`, `HIGHPASS`, `BANDPASS`, `NOTCH`, `PEAKING_EQ`, `LOW_SHELF`, `HIGH_SHELF`), soft-knee compressor, transient shaper, brickwall limiter, composable dry/wet pipeline, Float32 WAV codec, and ITU-R BS.1770-4 analyzer.
- `VST3_ENGINE/src/index.ts` & `VST3_ENGINE/templates/AetherForgeVst3Template.h`: Reusable VST3 parameter registry, `Vst3EditController` / `Vst3AudioProcessor` separation, `Vst3PresetManager`, `Vst3HostCompatibilityHarness`, and C++20 lock-free processor template.
- `DAW_ADAPTER_FRAMEWORK/src/index.ts`: Multi-DAW `DawCapabilityRegistry`, `FlStudio2025DomainAdapter` (read-only `.flp` inspection, Python MIDI Controller script generation, and strict refusal of undocumented `.flp` mutation), replaceable `ReaperRppDomainAdapter`, track routing DAG validator, and MIDI pattern transformer.
- `AUDIO_TEST_FRAMEWORK/src/index.ts` & `AUDIO_TEST_FRAMEWORK/tests/audio-domain.test.ts`: Phase-cancellation null test, real-time WCET profiler, and automated Vitest suite.
- `DOMAIN_KNOWLEDGE_PACKS/audio-domain-knowledge-pack.json`: Evidence-cited audio/VST3/DAW knowledge pack.


### Persistent Knowledge, Memory & Context Assembly Deliverables (Chief Knowledge & Memory Architect Baseline)
- `KNOWLEDGE_GOVERNANCE.md`: Six-Layer Epistemic Separation Model preventing unverified generated artifacts (`GENERATED_ARTIFACT`) from being treated as authoritative technical documentation (`VERIFIED_FACT` / `ENGINEERING_DECISION`).
- `KNOWLEDGE_ENGINE/src/index.ts`: `PersistentKnowledgeEngine` with immutable version chains, `promoteToVerifiedFact()` (`AGT-19` execution evidence gate), `detectConflicts()`, and Obsidian-compatible Markdown (YAML frontmatter, `[[Wikilinks]]`, backlinks, epistemic callouts) export/sync.
- `MEMORY_ENGINE/src/index.ts`: `PersistentMemoryEngine` for ADR lifecycle memory, hash-chained Engineering History timeline, and isolated per-agent scratchpad memory (`AGT-01`..`AGT-19`).
- `DOCUMENT_INGESTION/src/index.ts`: `KnowledgeDocumentIngestionPipeline` for Markdown documents, Obsidian notes, and JSON Domain Knowledge Packs.
- `RETRIEVAL_ENGINE/src/index.ts`: `HybridKnowledgeRetrievalEngine` combining BM25 lexical scoring, deterministic 64-dim vector cosine similarity, and Obsidian `[[Wikilink]]` graph traversal.
- `PROJECT_CONTEXT_ENGINE/src/index.ts` & `PROJECT_CONTEXT_ENGINE/tests/knowledge-memory-system.test.ts`: Token-budgeted, provenance-pinned context assembler and automated Vitest verification suite.
