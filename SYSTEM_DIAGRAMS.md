# AETHER FORGE — System Architecture Diagrams

**Version:** 1.0.0  
**Date:** 2026-11-23  
**Status:** Verified Architecture Visualizations (`v1.0.0`)  
**Cross-References:** [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md) · [MODULE_CATALOG.md](./MODULE_CATALOG.md) · [INTERFACE_CONTRACTS/README.md](./INTERFACE_CONTRACTS/README.md) · [REFERENCE_BOOK.md](./REFERENCE_BOOK.md)

---

## 1. Hybrid System Architecture & Trust Boundaries (`TB-1` .. `TB-7`)

```mermaid
flowchart TB
  subgraph TB1["TB-1: Untrusted Browser Client"]
    UI["Web Control Plane UI (4 Semantic Screens & REST Client)"]
  end

  subgraph TB2["TB-2: Cloud Control Plane (Stateless K8s Pods)"]
    API["Governed Domain API (@aether-forge/api)"]
    OPA["Policy Decision Point (OPA Rego v1 @aether-forge/policy)"]
    AUD["Append-Only Audit Store (@aether-forge/audit)"]
    KNOW["Expert Knowledge Engine (@aether-forge/knowledge)"]
    REG["Signed Artifact Registry (@aether-forge/artifact-registry)"]
    OBS["5-Boundary OpenTelemetry Collector (@aether-forge/observability)"]
  end

  subgraph TB3["TB-3: Durable Orchestration Plane"]
    TEMP["Temporal Orchestrator (@aether-forge/orchestration)"]
  end

  subgraph TB4["TB-4: Intelligence & Provider Fence"]
    PLAN["Bounded Execution Planner (ToolManifest DAG)"]
    PGW["Provider Gateway (Redaction Fence, Quotas & ServerSideSecretManager)"]
    LLM["Approved LLM Providers (Fake / OpenAI / Anthropic / Google / Self-Hosted)"]
  end

  subgraph TB5["TB-5: Customer Windows 11 Workstation (Outbound-Only mTLS)"]
    WHOST["Windows Worker Host (@aether-forge/windows-host & AetherForge.WindowsWorker.exe)"]
    DPAPI["Windows OS DPAPI Keystore (ProtectedData)"]
  end

  subgraph TB6["TB-6: Constrained Local Workspace & Offline Audio Engine"]
    FS["Constrained Filesystem & Git (@aether-forge/filesystem & @aether-forge/git)"]
    AUDIO["Offline PCM16 WAV & Rust Audio Engine (@aether-forge/audio-engine)"]
  end

  subgraph TB7["TB-7: Qualified DAW Adapter & Isolated Real-Time VST3"]
    FL["FL Studio 2025 Adapter (25.1.6.4997 inspect & non_destructive_edit)"]
    VST3["Isolated C++20 VST3 Realtime Core (Zero Allocations / Locks / IO)"]
  end

  UI -->|"HTTPS + OIDC JWT + W3C traceparent"| API
  API -->|"PolicyInput"| OPA
  API -->|"Append Frozen AuditEvent"| AUD
  API -->|"Ingest / Cite Retrieval"| KNOW
  API -->|"Start / Signal / Emergency Stop"| TEMP
  TEMP -->|"Propose Bounded Plan"| PLAN
  PLAN -->|"ToolManifest Check"| OPA
  PLAN -->|"ModelRequest"| PGW
  PGW -->|"Redacted & Budgeted Egress"| LLM
  WHOST -->|"Outbound-Only mTLS + Heartbeat"| TEMP
  WHOST -->|"Encrypt / Decrypt Identity"| DPAPI
  WHOST -->|"Canonical & Reparse-Guarded IO"| FS
  WHOST -->|"Atomic Offline Gain Normalize"| AUDIO
  WHOST -->|"FLhd/FLdt Parse & .bak Staging"| FL
  API -->|"Dual-Control v1.0.0 Promotion"| REG
  OBS -->|"Correlate Spans + Audit + Evidence"| API
```

---

## 2. Monorepo Module Dependency Graph

```mermaid
flowchart LR
  CON["@aether-forge/contracts (Zod v1.0.0)"]
  AUD["@aether-forge/audit"]
  POL["@aether-forge/policy"]
  OBS["@aether-forge/observability"]
  CFG["@aether-forge/config"]
  UIP["@aether-forge/ui"]
  SDK["@aether-forge/sdk"]
  FS["@aether-forge/filesystem"]
  GIT["@aether-forge/git"]
  DAWC["@aether-forge/daw-contract"]
  FL["@aether-forge/fl-studio-2025"]
  AUDENG["@aether-forge/audio-engine"]
  VST3["@aether-forge/vst3"]
  WHOST["@aether-forge/windows-host"]
  KNOW["@aether-forge/knowledge"]
  PGW["@aether-forge/provider-gateway"]
  REG["@aether-forge/artifact-registry"]
  API["@aether-forge/api"]
  ORCH["@aether-forge/orchestration"]
  WEB["@aether-forge/web"]

  AUD --> CON
  POL --> CON
  OBS --> CON
  CFG --> CON
  UIP --> CON
  SDK --> CON
  FS --> CON
  GIT --> CON
  GIT --> FS
  DAWC --> CON
  FL --> CON
  FL --> DAWC
  FL --> FS
  AUDENG --> CON
  AUDENG --> FS
  VST3 --> CON
  WHOST --> CON
  WHOST --> FS
  WHOST --> AUDENG
  WHOST --> FL
  KNOW --> CON
  KNOW --> AUD
  PGW --> CON
  PGW --> AUD
  PGW --> POL
  REG --> CON
  REG --> AUD
  API --> CON
  API --> AUD
  API --> POL
  ORCH --> CON
  ORCH --> API
  ORCH --> AUD
  ORCH --> POL
  WEB --> SDK
  WEB --> API
  WEB --> ORCH
  WEB --> WHOST
```

---

## 3. Data Flow & Evidence Provenance Architecture

```mermaid
erDiagram
  TENANT ||--o{ BRIEF : "owns (404 isolated)"
  BRIEF ||--|| PRODUCT_SPEC : "decomposes into (specHash)"
  PRODUCT_SPEC ||--|| EXECUTION_PLAN : "compiles to (planHash SHA-256)"
  EXECUTION_PLAN ||--|{ PLAN_STEP : "contains ordered DAG"
  PLAN_STEP }o--|| TOOL_MANIFEST : "bound to registered tool"
  PLAN_STEP ||--|| POLICY_DECISION : "evaluated by OPA (policyVersion)"
  PLAN_STEP ||--o| APPROVAL : "requires human sign-off"
  APPROVAL ||--|| CAPABILITY_GRANT : "mints HMAC-signed grant"
  CAPABILITY_GRANT ||--|| WORKER_JOB : "authorizes local execution"
  WORKER_JOB ||--|{ EVIDENCE_REF : "produces SHA-256 proof"
  KNOWLEDGE_SOURCE ||--|{ KNOWLEDGE_CHUNK : "ON DELETE CASCADE (pgvector)"
  KNOWLEDGE_CHUNK ||--|| GROUNDED_CITATION : "cites sourceContentHash & line range"
  EXECUTION_PLAN }o--o{ GROUNDED_CITATION : "grounded by"
  TENANT ||--|{ AUDIT_EVENT : "append-only traceId ledger"
  ARTIFACT_REF ||--|| SLSA_PROVENANCE : "attested by CycloneDX SBOM & dual-control"
```

---

## 4. End-to-End Governed Execution Lifecycle

```mermaid
sequenceDiagram
  autonumber
  actor Builder as "Builder / Owner"
  participant Web as "Web Control Plane (@aether-forge/web)"
  participant API as "Governed Domain API (@aether-forge/api)"
  participant Know as "Knowledge Engine (@aether-forge/knowledge)"
  participant Plan as "Bounded Planner & Provider Gateway"
  participant OPA as "OPA Policy Engine (@aether-forge/policy)"
  participant Temp as "Temporal Orchestrator (@aether-forge/orchestration)"
  participant Work as "Windows 11 Worker (AetherForge.WindowsWorker.exe)"
  participant Aud as "Append-Only Audit Store (@aether-forge/audit)"

  Builder->>Web: Submit Brief (title, objective, constraints, traceId)
  Web->>API: POST /api/v1/briefs (Bearer OIDC JWT + RequestContext)
  API->>API: Verify OIDC, Tenant Isolation (404), Emergency Stop (423), Idempotency (409)
  API->>Know: Retrieve cited GroundedContextChunks (sourceId, contentHash, #Lstart-Lend)
  API->>Plan: proposePlan(PlanningInput + ToolManifestRegistry)
  Plan->>Plan: Pre-egress redaction fence + prompt SHA-256 check + token/cost quota
  Plan->>OPA: Evaluate each proposed PlanStep (allow / requireApproval / deny)
  OPA-->>Plan: PolicyDecision (policyVersion, bundleDigest, userExplanation)
  Plan-->>API: Canonical ExecutionPlan (planHash SHA-256)
  API->>Temp: startBriefWorkflow(ExecutionPlan)
  Temp->>Temp: Auto-execute allowlisted read step once -> pause in WAITING_FOR_APPROVAL
  Temp-->>Web: Render Plan Review, Policy Explanation & Pending Approval Form
  Builder->>Web: Approve Step (bound to planHash, policyVersion, canonicalPathScope)
  Web->>Temp: signalApprovalDecision(signalId, approvalId, APPROVED)
  Temp->>API: verifyStepDispatchGate (re-check Stop, OPA, planHash, policyVersion, expiry, pathScope)
  API-->>Temp: Signed CapabilityGrant
  Temp->>Work: Dispatch signed WorkerJob over outbound mTLS
  Work->>Work: Verify manifest & grant signatures (timingSafeEqual) + DPAPI identity
  Work->>Work: Enforce canonical path, NTFS ReparsePoint guard & TOCTOU prior-hash check
  Work->>Work: Execute atomic workspace write / PCM16 WAV gain_normalize / FL Studio 2025 inspect
  Work-->>Temp: JobReceipt + EvidenceRef (SHA-256 artifactHash)
  Temp->>Aud: Append worker.job.completed.v1 & evidence.recorded.v1
  Temp-->>Web: Render COMPLETED status, SHA-256 Evidence List & 5-Boundary Correlated Audit Trail
```

---

## 5. Approval & Workflow State Machine (`INV-03`)

```mermaid
stateDiagram-v2
  [*] --> SUBMITTED: submitBrief (OIDC & Tenant 404 Verified)
  SUBMITTED --> PLANNING: createPlan / BoundedExecutionPlanner
  PLANNING --> POLICY_EVALUATED: OpaPolicyDecisionPoint.evaluate
  POLICY_EVALUATED --> WAITING_FOR_APPROVAL: step requiresApproval == true
  POLICY_EVALUATED --> EXECUTING: step decision == allow
  WAITING_FOR_APPROVAL --> INVALIDATED: planHash or policyVersion drift (INV-03)
  WAITING_FOR_APPROVAL --> EXPIRED: now >= expiresAt SLA
  WAITING_FOR_APPROVAL --> REJECTED: human decision == REJECTED
  WAITING_FOR_APPROVAL --> CANCELLED_BY_EMERGENCY_STOP: Emergency Stop triggered (HTTP 423)
  WAITING_FOR_APPROVAL --> EXECUTING: APPROVED + verifyStepDispatchGate passed
  EXECUTING --> CANCELLED_BY_EMERGENCY_STOP: Mid-flight Emergency Stop (purges .tmp-* files)
  EXECUTING --> COMPLETED: Signed WorkerJob executed once + EvidenceRef & AuditEvent recorded
  INVALIDATED --> [*]
  EXPIRED --> [*]
  REJECTED --> [*]
  CANCELLED_BY_EMERGENCY_STOP --> [*]
  COMPLETED --> [*]
```
