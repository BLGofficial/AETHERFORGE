# AETHER FORGE — Master Systems Architecture

**Version:** 1.0.0  
**Date:** 2026-11-23  
**Status:** Complete Systems Architecture Baseline (`v1.0.0`)  
**Cross-References:** [MODULE_CATALOG.md](./MODULE_CATALOG.md) · [SYSTEM_DIAGRAMS.md](./SYSTEM_DIAGRAMS.md) · [ARCHITECTURE_DECISION_RECORDS/README.md](./ARCHITECTURE_DECISION_RECORDS/README.md) · [INTERFACE_CONTRACTS/README.md](./INTERFACE_CONTRACTS/README.md) · [PRD.md](./PRD.md) · [SRS.md](./SRS.md) · [TECHNICAL_RESEARCH.md](./TECHNICAL_RESEARCH.md) · [REFERENCE_BOOK.md](./REFERENCE_BOOK.md)

---

## 1. Mapping of the 11 Core Architecture Engines

| # | Architectural Engine | Owning Workspace Package(s) & Runtime Boundary | Primary Responsibility |
|---|---|---|---|
| **1** | **Central Intelligence Core** | `@aether-forge/provider-gateway` ([services/provider-gateway/src/index.ts](./services/provider-gateway/src/index.ts)) | Server-side LLM routing (`ProviderGatewayService`), `ServerSideSecretManager`, `PromptTemplateRegistry` (SHA-256 verified), pre-egress credential/path redaction fence (`inspectAndRedactForEgress`), and `TenantBudgetTracker`. |
| **2** | **Expert Knowledge Engine** | `@aether-forge/knowledge` ([services/knowledge/src/index.ts](./services/knowledge/src/index.ts)) | Evidence-addressable document ingestion, MIME/malware/prompt-injection quarantine (`DOMAIN_KNOWLEDGE_INPUT_QUARANTINED`), line-range chunking (`<sourceId>#L<start>-L<end>`), and provenance-cited retrieval (`GroundedContextResponse`). |
| **3** | **Specialist Agent Network** | `@aether-forge/provider-gateway` (`BoundedExecutionPlanner`) | Bounded specialist planning roles (Specification Analyst, Code/Test Planner, Audio DSP Planner, DAW Qualification Planner) operating strictly behind `BoundedExecutionPlanner` over registered `ToolManifest` schemas ([ADR-0005](./docs/adr/0005-bounded-agent-roles.md)). |
| **4** | **System Compiler** | `@aether-forge/contracts` + `apps/api` (`createPlan`, `computeCanonicalPlanHash`) | Compiles a `Brief` → `ProductSpec` → canonically hashed `ExecutionPlan` DAG (`planHash` SHA-256), binding each `PlanStep` to a deterministic `ActionClass`, OPA `PolicyDecision`, and `CapabilityGrant` scope. |
| **5** | **Engineering Execution Engine** | `@aether-forge/windows-host`, `@aether-forge/audio-engine`, `@aether-forge/vst3`, `AetherForge.WindowsWorker.exe` | Local Windows 11 execution plane: DPAPI identity, outbound mTLS session, constant-time `JobManifest` verification, atomic workspace writes, offline PCM16 WAV `<0.01 dB` gain normalization, and isolated C++20 VST3 real-time core. |
| **6** | **Integration and Orchestration Engine** | `@aether-forge/orchestration` ([services/orchestration/src/index.ts](./services/orchestration/src/index.ts)) | `DurableTemporalOrchestrator`: replay-deterministic workflow state machine (`GOVERNED_WORKFLOW_VERSION`), approval wait signals, transient activity retry loops, at-most-once execution ledger (`executedStepLedger`), and Emergency Stop cancellation. |
| **7** | **Quality and Verification Engine** | `@aether-forge/artifact-registry` + `tests/{contract,security,e2e,performance}` | 17 automated test suites (`52` tests), static C++20 real-time source auditor (`auditVst3RealtimeCppSources`), CycloneDX 1.5 SBOM generator, workspace secret scanner, SLSA v1.0 provenance attestation, and dual-control `Reviewer` + `ReleaseManager` release promotion. |
| **8** | **Project Memory** | PostgreSQL 16 + `pgvector` ([0001_knowledge_pgvector.sql](./services/knowledge/migrations/0001_knowledge_pgvector.sql)) + `ImmutableLocalObjectStore` + `AppendOnlyAuditStore` | Transactional relational metadata (`briefs`, `specs`, `plans`, `approvals`, `knowledge_sources`, `knowledge_chunks` with `ON DELETE CASCADE`), content-addressable immutable object storage (`s3://aetherforge-knowledge/`), and append-only audit history. |
| **9** | **Tool Gateway** | `ToolManifestRegistry` (`@aether-forge/provider-gateway`) + `@aether-forge/filesystem`, `@aether-forge/git`, `@aether-forge/daw-contract`, `@aether-forge/fl-studio-2025` | Enforceable catalog of bounded tools (`tool.workspace.inspect_manifest`, `tool.workspace.atomic_write`, `tool.command.run_tests`, `tool.audio.gain_normalize`, `FlStudio2025Adapter.invoke`) with strict schema, duration, and path-scope guards. |
| **10** | **User Interface** | `@aether-forge/web`, `@aether-forge/ui`, `@aether-forge/sdk` ([apps/web/src/screens.ts](./apps/web/src/screens.ts), [server.ts](./apps/web/src/server.ts)) | 4-screen semantic HTML Web Control Plane (Brief Submission, Plan & Policy Review, Approval & Emergency Stop, Evidence & Correlated Audit Timeline) + OpenAPI 3.1 JSON REST endpoints (`/api/v1/*`). |
| **11** | **Observability and Governance** | `@aether-forge/policy`, `@aether-forge/audit`, `@aether-forge/observability` ([packages/observability/src/index.ts](./packages/observability/src/index.ts)) | Signed OPA Rego v1 policy evaluation (`governance.rego`), W3C `traceparent` 5-boundary propagation (`web → api → temporal → worker → adapter`), `ObservabilityMetricsEngine`, high-severity security alerts, and `correlateEndToEndJobDashboard`. |

---

## 2. Logical, Physical, and Runtime Architecture

### 2.1 Logical Architecture
AETHER FORGE separates **intent formation** (Untrusted Browser UI + Bounded Planner), **deterministic authorization** (Domain API + OPA Policy Engine + Human Approval State Machine), **durable coordination** (Temporal Orchestrator), **evidence & memory** (Postgres 16 + `pgvector` + Immutable Object Store + Append-Only Audit Store), and **capability-scoped execution** (Windows 11 Worker + Constrained Filesystem/Git/Audio/FL Studio 2025 Adapters + Isolated C++20 VST3 Processor).

### 2.2 Physical Architecture
- **Cloud Control Plane Tier:** Stateless Kubernetes pods (`infra/kubernetes/control-plane-deployment.yaml`, `runAsNonRoot: true`, `readOnlyRootFilesystem: true`, default-deny `NetworkPolicy`) connected to managed PostgreSQL 16 (`pgvector`), S3-compatible immutable object buckets (`aetherforge-knowledge-*`, `aetherforge-artifacts-*`), Cloud Secret Manager, and Temporal Cloud namespace `aetherforge-governed-orchestration`.
- **Customer Workstation Tier (Windows 11 x64):** Customer-operated machine running the enrolled Windows Worker (`AetherForge.WindowsWorker.exe` / `@aether-forge/windows-host`), offline Rust/PCM16 Audio Engine (`workers/audio-engine`), licensed FL Studio 2025 (`25.1.6.4997` at `C:\Program Files\Image-Line\FL Studio 2025`), Python `3.14` controller script (`device_aetherforge_inspect.py`), and local project workspaces (`local-workspace/`).
- **Network Link:** Outbound-only mTLS connection initiated by the Windows Worker to the cloud Worker Gateway (`ADR-0001`). Zero inbound ports are opened on the customer workstation.

### 2.3 Runtime Architecture
- **Control Plane Process:** Node.js `v26.13.0` executing strict TypeScript modules with Zod runtime validation at every ingress/egress call.
- **Worker Host Process:** Verifies HMAC/Ed25519 signatures over `WorkerJob` and `CapabilityGrant` using constant-time `timingSafeEqual`, decrypts machine identity via Windows OS DPAPI (`ProtectedData.Unprotect`), validates target paths against NTFS `FileAttributes.ReparsePoint` and `realpathSync.native`, and spawns isolated bounded child operations.
- **VST3 Audio Thread:** Standalone native C++20 binary (`AetherForgeRealtimeCore`) loaded into the host DAW process. Communicates parameter changes solely via lock-free `std::atomic<float>` / `std::atomic<bool>` variables; never interacts with the worker or control plane on the real-time audio callback.

---

## 3. Data Architecture & Communication Protocols

### 3.1 Canonical Data Stores
1. **Relational & Vector Store (PostgreSQL 16 + `pgvector`):** Stores tenant-partitioned rows for `briefs`, `specs`, `plans`, `approvals`, `capability_grants`, `knowledge_sources`, and 16-D/1536-D `knowledge_chunks` (`ON DELETE CASCADE`).
2. **Immutable Object Store (`s3://aetherforge-knowledge/`, `s3://aetherforge-artifacts/`):** Stores content-addressed raw knowledge sources (`<tenantId>/<sourceId>/<contentHash>`) and signed release bundles (`artifact.sig`, `sbom.cdx.json`, `provenance.intoto.json`).
3. **Append-Only Audit Store (`@aether-forge/audit`):** Stores frozen `AuditEvent` records containing `eventId`, `timestamp`, `tenantId`, `actor`, `traceId`, `idempotencyKey`, `eventType`, `policyVersion`, `planHash`, `outcome`, and SHA-256 `payloadHash`.
4. **Local Workstation Keystore & Workspace:** Windows DPAPI-protected identity blob + granted canonical workspace directories (`stems/`, `renders/`, `sessions/`, `backups/`, `scratch/`, `outputs/`).

### 3.2 Communication Protocols
- **Browser ↔ Domain API:** HTTPS REST (`OpenAPI 3.1.0`, `application/json` and `application/x-www-form-urlencoded`) authenticated via `Authorization: Bearer <OIDC_JWT>` and carrying `RequestContext` (`requestId`, `traceId`, `idempotencyKey`, `classification`).
- **Domain Events:** CloudEvents 1.0 JSON envelope (`specversion: "1.0"`, `traceparent: "00-<traceId>-<spanId>-01"`, `tenantid`, `idempotencykey`, `type: "aetherforge.*.v1"`).
- **Orchestrator ↔ Worker Gateway ↔ Windows Worker:** Outbound mTLS transport carrying signed `WorkerJob` manifests and returning signed `JobReceipt` + `EvidenceRef[]` metadata (never raw private audio stems or `.flp` files unless an `external_upload` step is explicitly approved by `Owner`).

---

## 4. Execution Lifecycle & Failure Recovery

### 4.1 10-Stage Governed Execution Lifecycle
1. **Ingress & Context Validation:** Validate `RequestContextSchema`, OIDC token, tenant/project membership (`404 NOT_FOUND` on mismatch), Emergency Stop status (`423 Locked`), and idempotency key (`409 Conflict` on payload mismatch).
2. **Brief & Grounded Knowledge Retrieval:** Persist `Brief`, retrieve tenant-scoped `GroundedContextChunk[]` with mandatory provenance citations (`sourceId`, `contentHash`, `location`).
3. **Bounded Planning (System Compilation):** `BoundedExecutionPlanner` invokes `ProviderGatewayService` (applying pre-egress redaction and token/cost quotas), validates output against `ToolManifestRegistry`, and computes canonical SHA-256 `planHash`.
4. **OPA Policy Evaluation:** `OpaPolicyDecisionPoint` evaluates each `PlanStep` against `governance.rego` (`allow`, `requireApproval`, `deny`) and attaches `policyVersion`, `bundleDigest`, and `userExplanation`.
5. **Durable Workflow Start & Auto-Allowed Steps:** `DurableTemporalOrchestrator` records `WorkflowExecutionStarted`, executes `allow` steps (e.g., `read_allowlisted`) at most once, and transitions to `WAITING_FOR_APPROVAL` for `requireApproval` steps.
6. **Cryptographically Bound Human Approval:** Authorized human role (`Owner`, `Builder`, `Reviewer`, `ReleaseManager`, `WorkerOperator`) submits `Approval` bound to `(planHash, policyVersion, canonicalPathScope, expiresAt)`, minting a signed `CapabilityGrant`.
7. **Pre-Dispatch Re-Verification Gate (`verifyStepDispatchGate`):** Re-checks Emergency Stop, live OPA policy decision, `planHash` match, `policyVersion` match, `canonicalPathScope` confinement, and grant expiry/revocation (`INV-03`).
8. **Signed Worker Execution:** `WindowsWorkerHost` verifies manifest & grant signatures (`timingSafeEqual`), checks canonical path & NTFS reparse points, executes atomic workspace write / offline PCM16 WAV DSP / qualified FL Studio 2025 `inspect` or `non_destructive_edit`, and returns `JobReceipt` + SHA-256 `EvidenceRef`.
9. **Audit & Telemetry Correlation:** `AppendOnlyAuditStore` records `worker.job.completed.v1` and `evidence.recorded.v1`; `correlateEndToEndJobDashboard` links all 5 W3C `traceparent` spans (`web → api → temporal → worker → adapter`).
10. **Dual-Control Release Promotion:** `Reviewer` and `ReleaseManager` (two distinct actors) verify 17 test suites, CycloneDX 1.5 SBOM, SLSA v1.0 provenance, and 5/5 canary soak before promoting `1.0.0-rc1 → 1.0.0`.

### 4.2 Failure Recovery & Compensation Matrix

| Failure Mode | Detection Mechanism | Deterministic Recovery / Fail-Closed Action |
|---|---|---|
| **Temporal Worker Crash Mid-Wait** | Workflow history replay (`simulateWorkerRestartAndReplay`) | Rehydrates workflow state from event log, verifies `planHash` determinism, resumes waiting for approval signal without re-running completed activities. |
| **Transient Activity Error** | Activity failure count in `DurableTemporalOrchestrator` | Records `ActivityTaskRetried` in workflow history; retries idempotently using `executedStepLedger` so side effects occur at most once. |
| **Local Write Interrupted / Cancelled** | `isCancelled()` check or exception before `renameSync` | Deletes temporary `.tmp-<random>` staging file immediately in `try/finally`; committed user files and source WAV/`.flp` files remain untouched. |
| **TOCTOU Concurrent File Modification** | Prior file SHA-256 re-check before `renameSync` | Aborts commit (`DOMAIN_WORKER_TOCTOU_CONFLICT`), purges `.tmp-*` file, and logs failure audit event. |
| **OPA Bundle Missing or Corrupted** | Signature/digest check in `OpaPolicyDecisionPoint` | Returns `decision: "deny"`, `reasonCode: "POLICY_BUNDLE_UNAVAILABLE_FAIL_CLOSED"`. |
| **Audit Store Write Failure** | Exception in `AppendOnlyAuditStore.append` | Aborts mutating command before side effects execute (`AUDIT_STORE_UNAVAILABLE`). |
| **Faulty Release Candidate (`v1.x`)** | `ALERT_ARTIFACT_TAMPER_DETECTED` or canary regression | `revokeArtifactVersion` + `selectRollbackTarget` deterministically selects the prior non-revoked signed release (`1.0.0-rc1` or `0.9.0-baseline`). |

---

## 5. Security Boundaries, Deployment Topology & Scalability Strategy

### 5.1 Security Boundaries (`TB-1` .. `TB-7`)
- Detailed in [docs/security/threat-model.md](./docs/security/threat-model.md) and [SRS.md §1](./SRS.md): untrusted browser client (`TB-1`), tenant-isolated control plane (`TB-2`), metadata-only Temporal history (`TB-3`), redaction-fenced Provider Gateway (`TB-4`), outbound-only mTLS Windows Worker (`TB-5`), canonical/reparse-guarded local workspace & audio engine (`TB-6`), and tier-qualified FL Studio 2025 / zero-I/O C++20 VST3 audio callback (`TB-7`).

### 5.2 Deployment Topology (`dev → staging → production`)
- **Stage 0 (`dev` / Local Workstation):** `pnpm dev` (`apps/web/src/dev-server.ts` on `http://127.0.0.1:4100`) paired with local `WindowsWorkerHost`, `AetherForge.WindowsWorker.exe`, `local-workspace/`, and local FL Studio 2025 (`25.1.6.4997`).
- **Stage 1 (`staging`):** Declarative Terraform (`infra/terraform/environments/staging/main.tf`), Kubernetes deployment (`infra/kubernetes/control-plane-deployment.yaml`), managed Postgres 16 (`0001_knowledge_pgvector.sql`), and Temporal namespace `aetherforge-governed-orchestration` (`infra/temporal/namespace-and-archival.yaml`).
- **Stage 2 (`production`):** Promoted strictly via dual-control `Reviewer` + `ReleaseManager` approval (`promoteReleaseCandidateToProduction`) after 5/5 canary soak, CycloneDX 1.5 SBOM, and SLSA v1.0 provenance verification.

### 5.3 Scalability Strategy
1. **Stateless Horizontal API Scaling:** `@aether-forge/api`, `@aether-forge/policy`, and `@aether-forge/provider-gateway` hold zero in-process session affinity in production; Kubernetes HPA scales replicas horizontally behind ingress while idempotency keys and tenant isolation are enforced transactionally.
2. **Sharded Temporal Task Queues:** Workflows shard across Temporal history partitions by `(tenantId, workflowId)`; local workstation jobs route to per-worker task queues (`workerId`) over outbound mTLS.
3. **Partitioned Knowledge & Vector Indexes:** PostgreSQL 16 composite indexes (`idx_knowledge_sources_tenant_project`, `idx_knowledge_chunks_tenant_project`) pre-filter by `(tenant_id, project_id)` before vector similarity scoring, preventing cross-tenant index scan degradation.
4. **Local Workstation Offload:** Compute-heavy PCM16 WAV DSP normalization and DAW `.flp` staging execute on the customer's local Windows 11 hardware (`workers/audio-engine`, `workers/windows-host`), keeping cloud control-plane CPU/memory footprint minimal and independent of audio file size.
