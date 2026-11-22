# AETHER FORGE — Product Requirements Document (PRD)

**Version:** 1.0.0  
**Date:** 2026-11-23  
**Status:** Baseline Product Specification (`v1.0.0`)  
**Cross-References:** [SRS.md](./SRS.md) · [CAPABILITY_MATRIX.md](./CAPABILITY_MATRIX.md) · [REQUIREMENTS_TRACEABILITY.md](./REQUIREMENTS_TRACEABILITY.md) · [ACCEPTANCE_CRITERIA.md](./ACCEPTANCE_CRITERIA.md) · [PROJECT_CHARTER.md](./PROJECT_CHARTER.md) · [GOVERNANCE.md](./GOVERNANCE.md) · [REFERENCE_BOOK.md](./REFERENCE_BOOK.md)

---

## 1. Product Purpose & Capabilities Overview

AETHER FORGE transforms governed engineering briefs into verified software systems, audio DSP pipelines, native VST3 processor targets, and tier-qualified DAW sessions. Core product capabilities:

1. **Governed Brief-to-Specification Decomposition:** Converts structured briefs into versioned `ProductSpec` artifacts with explicit acceptance criteria, required action classes, and SHA-256 content hashes (`REQ-F-0001`, `REQ-F-0002`).
2. **Bounded Multi-Agent Planning (`ToolManifest` DAG):** Produces deterministic `ExecutionPlan` DAGs exclusively over registered tools behind a redaction and token/cost budget fence (`REQ-F-0003`..`REQ-F-0006`).
3. **Deterministic Policy-as-Code & Cryptographic Approval Binding:** Evaluates every plan step via signed OPA Rego v1 bundles (`allow`, `requireApproval`, `deny`) and binds human approvals to `(tenantId, projectId, planHash, policyVersion, canonicalPathScope, expiresAt)` (`REQ-F-0007`..`REQ-F-0010`).
4. **Durable Hybrid Orchestration & Emergency Stop:** Coordinates long-running plans via Temporal with deterministic history replay, activity retry, at-most-once execution ledger, and instant Emergency Stop (`REQ-F-0011`, `REQ-F-0012`).
5. **Sovereign Local Workstation Execution:** Executes signed `JobManifest` packages on an outbound-connected Windows 11 Worker (`AetherForge.WindowsWorker.exe` / `@aether-forge/windows-host`) enforcing DPAPI identity, canonical path confinement, NTFS reparse-point rejection, and TOCTOU checks (`REQ-F-0013`, `REQ-F-0014`).
6. **Evidence-Addressable Knowledge Substrate:** Ingests technical documents with malware/prompt-injection quarantine, immutable object references, PostgreSQL 16 + `pgvector` indexing, mandatory chunk provenance citations, and synchronous deletion propagation (`REQ-F-0015`, `REQ-F-0016`).
7. **Deterministic Offline Audio DSP & Qualified FL Studio 2025 Integration:** Inspects and gain-normalizes 16-bit PCM WAV stems within `<0.01 dB` tolerance without modifying source files, and executes qualified FL Studio 2025 (`25.1.6.4997`) `inspect` and backup-mandatory `non_destructive_edit` operations (`REQ-F-0017`, `REQ-F-0018`).
8. **Real-Time VST3 Product Boundary & Signed Supply Chain:** Isolates C++20/JUCE real-time audio processing from orchestration and enforces CycloneDX 1.5 SBOM, SLSA v1.0 provenance, dual-control `Reviewer` + `ReleaseManager` release promotion, and rehearsed rollback (`REQ-F-0019`, `REQ-F-0020`).

---

## 2. User Personas & Interaction Models

| Persona | Role Enum | Primary Goals | Interaction Surfaces | Authorization & Autonomy Boundary |
|---|---|---|---|---|
| **Platform / Tenant Owner** | `Owner` | Configure tenant policy bundles, approve external uploads/package installs, trigger or clear Emergency Stop | Web Control Plane UI (`/ui/*`), OpenAPI 3.1 REST (`/api/v1/*`) | Full tenant approval authority; cannot bypass immutable audit logging or unsigned manifest checks |
| **Systems / Audio Builder** | `Builder` | Submit briefs for full-stack apps, agentic runtimes, DSP chains, or DAW sessions; review plans and approve workspace writes | Web Control Plane UI, REST API, local workspace directory (`local-workspace/`) | May approve `write_workspace`, `command_bounded`, `audio_dsp`, `daw_non_destructive_edit`; denied `release_publish` and `external_upload` |
| **Independent Reviewer** | `Reviewer` | Audit execution evidence, SHA-256 hashes, security test reports, and Reference Book updates | Evidence & Audit Timeline UI, OpenTelemetry dashboard, Git diffs | Required co-signer (with `ReleaseManager`) for dual-control production release promotion; cannot self-approve own plans |
| **Release Manager** | `ReleaseManager` | Verify CycloneDX SBOM, SLSA v1.0 provenance, canary soak, and rollback target before promoting release candidates | Artifact Registry service, `/api/v1/approvals/{id}/decision`, CI pipeline | Co-approves `release_publish` with `Reviewer`; blocked if test evidence, signature, or canary soak is missing |
| **Workstation / Studio Operator** | `WorkerOperator` | Enroll Windows 11 workstation, configure local canonical workspace roots, monitor mTLS heartbeats, trigger local hard stop | Native Windows Worker CLI (`AetherForge.WindowsWorker.exe`), local filesystem | Controls physical workstation and local workspace grants; holds zero cloud provider API keys |

---

## 3. Supported Project Categories

AETHER FORGE supports six project categories across complexity tiers—from single-purpose utilities to full agentic operating systems:

| Category ID | Project Category | Scale & Target Outputs | Required Platform Subsystems |
|---|---|---|---|
| **CAT-01** | **Individual Developer Tools & CLI Utilities** | Single-package CLI tools, schema generators, constrained file/git automation scripts | `@aether-forge/contracts`, `@aether-forge/filesystem`, `@aether-forge/git`, `@aether-forge/windows-host` |
| **CAT-02** | **Offline Audio DSP Pipelines & Batch Processors** | Deterministic stem inspection, gain normalization, batch mastering chains, golden WAV test suites | `@aether-forge/audio-engine`, `workers/audio-engine` (Rust crate), `@aether-forge/windows-host` |
| **CAT-03** | **Native Real-Time Audio Plugins (VST3)** | Lock-free C++20/JUCE VST3 processors (`AetherForgeProcessor`), parameter automation, POD state serialization | `@aether-forge/vst3`, `plugins/vst3/AetherForgeProcessor`, CMake + `pluginval` gate |
| **CAT-04** | **Qualified AI DAW Agentic Workflows** | FL Studio 2025 (`25.1.6.4997`) `.flp` session inspection, read-only Python controller telemetry, copy-on-write scratch session staging | `@aether-forge/daw-contract`, `@aether-forge/fl-studio-2025`, `device_aetherforge_inspect.py` |
| **CAT-05** | **Full-Stack Web & API Applications** | Typed Next.js/React web control planes, NestJS/Node domain APIs, OpenAPI 3.1 + Postgres 16 + `pgvector` backends | `@aether-forge/web`, `@aether-forge/api`, `@aether-forge/knowledge`, `@aether-forge/sdk` |
| **CAT-06** | **Complex Multi-Agent & Agentic Operating Systems** | Governed hybrid control planes combining bounded planners, OPA policy engines, Temporal durable workflows, mTLS workers, and 5-boundary OpenTelemetry observability | All 26 workspace packages + `infra/{terraform,kubernetes,temporal,monitoring}` |

---

## 4. Supported Engineering Workflows

1. **WF-01 (Brief-to-Verified-Build Workflow):** `submitBrief → ProductSpec → BoundedExecutionPlanner.proposePlan → OpaPolicyDecisionPoint.evaluate → Human Approval → DurableTemporalOrchestrator → Signed WorkerJob → Constrained Atomic Write / Command → EvidenceRef & AuditEvent`.
2. **WF-02 (Evidence-Grounded Architecture & Knowledge Workflow):** `ingestSource (MIME + malware + prompt-injection scan) → SHA-256 contentHash + ImmutableLocalObjectStore → line-addressed chunking → retrieve with GroundedCitation → Planner citation binding (uncited claims labeled model_inference)`.
3. **WF-03 (Offline Audio Stem Processing Workflow):** `AudioJob (inspect_wav | gain_normalize) → quota & RIFF/WAVE PCM16 validation → deterministic linear gain scaling → atomic .tmp-* write & rename → SHA-256 output provenance (<0.01 dB tolerance, source immutable)`.
4. **WF-04 (Tier-Qualified FL Studio 2025 Workflow):** `discoverCapabilities (probe FL64.exe 25.1.6.4997) → DawCommand (inspect | non_destructive_edit) → parse FLhd/FLdt + 0xC7 FLP_Version → mandatory .bak backup on staging → DawExecutionProof`.
5. **WF-05 (Emergency Stop & Quarantine Workflow):** `triggerEmergencyStop (TENANT | PROJECT | WORKFLOW | WORKER) → 423 Locked dispatch freeze → revoke active CapabilityGrants → signal Temporal workflows CANCELLED_BY_EMERGENCY_STOP → abort worker step & purge .tmp-* files`.
6. **WF-06 (Dual-Control Release Promotion & Rollback Workflow):** `generateCycloneDxSbom + scanWorkspaceSourceForSecrets → publishSignedArtifact (1.0.0-rc1 with SLSA v1.0 provenance) → 5-iteration Stage 1 canary soak → independent Reviewer + ReleaseManager approvals → promoteReleaseCandidateToProduction (1.0.0) → rehearsed selectRollbackTarget`.

---

## 5. Agent Autonomy Levels

Autonomy in AETHER FORGE is **never** governed by prompt wording; it is enforced deterministically by `OpaPolicyDecisionPoint` (`services/policy/bundles/v1/governance.rego`) and `ApprovalStateMachine`:

| Autonomy Level | Policy Decision | Permitted Action Classes | Execution & Cryptographic Gate |
|---|---|---|---|
| **Level 0 — Prohibited / Hard-Blocked (`deny`)** | `deny` | Unknown action classes; any action on `SECRET_CREDENTIAL`; `external_upload` on `RESTRICTED_LOCAL`; unqualified DAW tiers (`daw_session_mutation`, `daw_render`); unattended UI automation (`foregroundUiFallbackOptIn: true`) | Immediate fail-closed rejection at planner, API, and worker boundaries; emits `DENIED` `AuditEvent`. |
| **Level 1 — Governed Auto-Allowed (`allow`)** | `allow` | `read_allowlisted` (within caller tenant/project scope); `daw_inspect` (only when `dawCapabilityQualified === true` on verified FL Studio 2025 `25.1.6.4997` host) | Executes automatically inside Temporal workflow; still requires valid OIDC identity, tenant check, and immutable `AuditEvent`. |
| **Level 2 — Single-Approver Human-Gated (`requireApproval`)** | `requireApproval` | `write_workspace`, `command_bounded`, `audio_dsp`, `daw_non_destructive_edit` (`Owner` or `Builder`); `external_upload` (`Owner`); `package_install` (`Owner` or `WorkerOperator`) | Workflow pauses in `WAITING_FOR_APPROVAL`; requires human approval bound to `planHash`, `policyVersion`, `canonicalPathScope`, and SLA `expiresAt`. |
| **Level 3 — Dual-Control High-Assurance (`requireApproval` + 2 Distinct Roles)** | `requireApproval` (Dual-Control) | `release_publish` (`promoteReleaseCandidateToProduction`) | Requires two distinct human actors (`Reviewer` ≠ `ReleaseManager`), matching `planHash` & `policyVersion`, passing canary soak, SBOM, and SLSA v1.0 provenance. |
