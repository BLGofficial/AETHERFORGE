# AETHER FORGE — Engineering Blueprint

**Version:** 1.0.0  
**Status:** approved foundation / implementation-ready  
**Date:** 2026-11-22  
**Product configuration:** hybrid deployment · controlled autonomy · web interface · complete platform scope  
**First production DAW adapter:** FL Studio 2025

## 0. Evidence, decisions, assumptions

### Verified facts

- Confirmed configuration is hybrid, controlled autonomy, web, complete scope.
- FL Studio 2025 is first production DAW target.
- Inspected workspace: only empty `work/` and `outputs/` directories existed. No repository, source, build files, tests, secrets, or prior architecture artifacts were present.

### Decisions in this blueprint

- Cloud control plane owns identity, projects, policy, audit, approvals, metadata, and provider routing.
- Durable orchestration is Temporal Cloud/self-hosted Temporal. It schedules; it never directly accesses local files, DAWs, plugins, or audio devices.
- Windows Worker is a signed, outbound-connected local agent. It owns machine-local execution and enforces a deny-by-default capability grant.
- Every consequential action needs a typed plan, policy evaluation, explicit approval when required, immutable audit event, idempotency key, and resumable workflow state.
- Audio/DSP rendering occurs locally for private assets and DAW access. Cloud rendering is opt-in and policy-gated.
- VST3 is a separate native C++ product/runtime, isolated from orchestration and never loaded into the control plane.

### Assumptions to validate during discovery

- Target customers possess licensed Windows 11 machines, FL Studio 2025 licenses, and compatible third-party plugins where those plugins are used.
- FL Studio control will require a supported integration route: scripting/MIDI/OSC/UI automation only after legal, technical, and reliability qualification. No undocumented API is assumed.
- Initial provider set: OpenAI, Anthropic, Google, and a self-hostable model endpoint. Final commercial terms, data residency, and model availability require vendor review.
- Accounts, tenancy model, geographic region, RPO/RTO, supported audio formats, and commercial release channels remain product decisions.

### Future capabilities — not scope claims

- macOS/Linux workers; Ableton, Cubase, Reaper, Pro Tools, Logic adapters; real-time multi-user sessions; cloud GPU audio render; autonomous long-running agent execution; marketplace; plugin sandbox farm.

## 1. Product boundary

AETHER FORGE converts a governed product brief into a traceable build program and, where allowed, executes approved work through cloud tools and the owner’s Windows workstation. It produces architecture, implementation tasks, code changes, tests, build artifacts, audio-processing chains, DAW projects, VST3 packages, evidence, and release candidates.

It is **not** an unrestricted remote-desktop agent, a credential vault for raw provider secrets, a DAW replacement, or a promise that any third-party DAW/plugin can be controlled without a qualified adapter.

### Control loop

```text
Brief → specification → decomposition → plan → policy check → approval
  → durable workflow → capability-scoped execution → evidence → validation
  → review/release decision → immutable audit trail
```

## 2. Architecture Decision Records

### ADR-001 — Hybrid control plane and local execution plane

**Decision:** SaaS web control plane plus customer-operated Windows Worker; outbound TLS connection from worker to cloud.

**Rationale:** cloud gives shared governance and orchestration; local worker preserves DAW, plugin, audio-device, project-file, and private-asset access.

**Alternatives:** cloud-only (cannot reliably access local DAW/assets); local-only (weak collaboration, audit, and durable coordination); inbound remote desktop (large attack surface).

**Consequences:** worker installation, update, enrollment, heartbeat, and offline semantics required. Local actions remain unavailable while disconnected. Customer controls local storage and permissions.

**Explicit decision:** no inbound control-plane connection to workers; no direct cloud access to local filesystem.

### ADR-002 — Controlled autonomy as a policy engine, not prompt wording

**Decision:** action classes and policy-as-code decide whether an action is auto-allowed, approval-required, or denied.

**Rationale:** LLM intent is non-deterministic; authorization must be deterministic and auditable.

**Alternatives:** blanket full autonomy (unsafe); approval for every read (unusable); model self-approval (invalid trust boundary).

**Consequences:** slower execution for high-impact actions, but predictable safety. Policy version is attached to every decision.

**Explicit decision:** default = approval-required for file writes, commands, DAW mutations, installs, uploads, releases, and external side effects. Reads are allowlisted and tenant-scoped.

### ADR-003 — Temporal for durable orchestration

**Decision:** Temporal workflows coordinate long-running plans; activities invoke cloud services or worker jobs.

**Rationale:** retries, timers, state recovery, signals, compensation, and audit correlation survive browser refreshes and process failures.

**Alternatives:** in-process queues (state loss); cron/polling (poor control); custom workflow engine (unnecessary risk).

**Consequences:** workflow schemas and versioning discipline required. Workflow code stays deterministic.

**Explicit decision:** Temporal receives opaque job references/capabilities, never raw local credentials or project files.

### ADR-004 — Typed protocol first

**Decision:** TypeScript schemas in a versioned contracts package generate/validate REST, events, worker RPC, and tool input/output.

**Rationale:** prevents drift among web, orchestration, agents, and native adapters.

**Alternatives:** prose contracts (drift); per-service schemas (duplication); protobuf-only (slower web ergonomics).

**Consequences:** schema compatibility gates in CI; additive changes preferred; breaking changes require new major contract version.

**Explicit decision:** runtime validation at every trust boundary with Zod/JSON Schema; no untyped `any` crossing process boundaries.

### ADR-005 — Agent roles are bounded tools behind a planner

**Decision:** planner creates a declarative execution plan; specialized agents may propose or execute only registered tools with typed permissions.

**Rationale:** tool-level isolation improves reliability, traceability, and evaluation.

**Alternatives:** one super-agent (opaque); peer-agent free chat (unbounded); direct shell from model (unsafe).

**Consequences:** agent registry, evaluation fixtures, tool manifests, and prompt versions required.

**Explicit decision:** agents cannot mint capability grants, alter policy, approve actions, or access secrets.

### ADR-006 — Provider abstraction with redaction and routing

**Decision:** Provider Gateway normalizes model calls, applies tenant policy/redaction/budgets, records metadata, and supports approved providers.

**Rationale:** avoid provider lock-in and prevent raw local/private data leakage.

**Alternatives:** browser-to-provider (key exposure); provider-specific code throughout product (lock-in); one provider only (availability/product risk).

**Consequences:** least-common-denominator capabilities; provider adapters must be independently tested.

**Explicit decision:** no provider key reaches browser or worker. Secrets reside in cloud secret manager; local private contexts are summarized/redacted unless transfer is approved.

### ADR-007 — Knowledge is evidence-addressable

**Decision:** Postgres stores canonical metadata; object storage stores immutable artifacts; vector index enables retrieval; provenance is mandatory.

**Rationale:** generated decisions need reproducible source links, not merely semantic recall.

**Alternatives:** vector DB only (weak transactions); files only (weak retrieval); graph-first database (premature).

**Consequences:** ingestion pipeline, retention policies, embedding versioning, and deletion propagation required.

**Explicit decision:** retrieval results include source ID, hash, location, classification, and extraction version. Uncited claims are labelled as model inference.

### ADR-008 — Local audio engine separate from VST3

**Decision:** Rust audio job engine processes offline files/chains; C++20/JUCE VST3 plugin is a separate native target; shared DSP algorithms have test vectors.

**Rationale:** local service safety/performance differs from DAW plugin lifecycle and SDK constraints.

**Alternatives:** web audio only (not production DSP); one plugin process for all processing (host crash risk); JavaScript DSP (insufficient real-time guarantees).

**Consequences:** cross-language golden tests and artifact signing required.

**Explicit decision:** no network, LLM, filesystem scans, or orchestration calls from the VST3 audio thread.

### ADR-009 — FL Studio 2025 adapter is a qualification layer

**Decision:** adapter exposes capability levels: `inspect`, `non_destructive_edit`, `session_mutation`, `render`. Each level is independently qualified and policy-gated.

**Rationale:** DAW integration surfaces vary in safety and reliability.

**Alternatives:** claim universal full control (unreliable); raw UI automation as core API (fragile); wait for universal APIs (blocks product).

**Consequences:** every action returns proof plus reversible/irreversible classification; unsupported operations fail explicitly.

**Explicit decision:** first release guarantees only capabilities proven by automated/manual acceptance suite on FL Studio 2025; UI automation is last-resort, opt-in, foreground-only, and never used for destructive actions without user confirmation.

### ADR-010 — Supply-chain and release integrity

**Decision:** signed worker/plugin/build artifacts, SBOM, provenance attestations, dependency scanning, staged rollout, and rollback.

**Rationale:** local executable and audio plugin distribution is a high-trust channel.

**Alternatives:** unsigned downloads (unsafe); manual release uploads only (not reproducible).

**Consequences:** code-signing certificates and release process are operational prerequisites.

**Explicit decision:** worker refuses unsigned or revoked job manifests; release is blocked without test evidence and policy approval.

## 3. Repository structure

```text
aether-forge/
  README.md                         # product boundary, local bootstrap
  GOVERNANCE.md                     # approval classes, ownership, change control
  REFERENCE-BOOK.md                 # architecture index, glossary, invariant links
  docs/
    adr/0001-hybrid-control-plane.md ... 0010-release-integrity.md
    product/requirements.md
    security/threat-model.md
    security/data-classification.md
    operations/runbooks.md
    daws/fl-studio-2025-qualification.md
    prompts/antigravity/phase-00.md ... phase-12.md
  contracts/
    src/{api,events,worker,tools,domain}/
    tests/compatibility/
  apps/
    web/                             # Next.js control plane UI
    api/                             # NestJS BFF/domain API
  services/
    orchestration/                   # Temporal workers/workflows
    policy/                          # OPA bundles + decision service
    provider-gateway/
    knowledge/
    audit/
    artifact-registry/
  workers/
    windows-host/                    # .NET 8 service + Rust execution bridge
    audio-engine/                    # Rust offline DSP workers
  adapters/
    daw-contract/
    fl-studio-2025/
    filesystem/
    git/
  plugins/
    vst3/
      AetherForgeProcessor/          # C++20/JUCE
      tests/
  packages/
    sdk/
    ui/
    config/
    observability/
    test-fixtures/
  infra/
    terraform/{modules,environments}/
    kubernetes/
    temporal/
    monitoring/
  scripts/
  tests/
    e2e/
    security/
    contract/
    performance/
  .github/workflows/
  pnpm-workspace.yaml
  turbo.json
  Cargo.toml
```

Ownership: `contracts` is owned by architecture/API; each runtime owns its folder; `adapters/daw-contract` owns capability semantics; `infra` owns deployable environment definitions. Cross-boundary change requires contract compatibility test plus ADR when behaviour/security boundary changes.

## 4. Module contracts

Shared envelope:

```ts
type RequestContext = {
  requestId: string; tenantId: string; actor: ActorRef; projectId?: string;
  traceId: string; idempotencyKey: string; classification: DataClassification;
};
type Result<T> = { ok: true; value: T; evidence: EvidenceRef[] } |
  { ok: false; error: DomainError; retryable: boolean };
```

| Module | Responsibility; typed I/O | Dependencies; events | Failure/security boundary | Acceptance test |
|---|---|---|---|---|
| Web Control Plane | `submitBrief(ctx, Brief)→Result<SpecRef>`; approvals, projects, evidence UI | API; OIDC. Emits `brief.submitted`, `approval.decided` | Browser is untrusted. No secrets or execution permissions in client | User submits brief, sees plan/evidence, cannot call worker directly |
| Domain API | validates commands; `createPlan(ctx, SpecRef)→Result<PlanRef>` | Postgres, Policy, Audit, Orchestration | rejects invalid schema/tenant mismatch; authorization before data read | Cross-tenant IDs return 404; duplicate idempotency key returns same result |
| Planner/Agent Registry | `proposePlan(PlanningInput)→Result<ExecutionPlan>`; registry resolves permitted tools | Provider Gateway, Knowledge, contracts | model/tool output untrusted; schema, budget, provenance checks | Malformed plan rejected; proposed destructive step gets approval gate |
| Policy Decision Point | `evaluate(PolicyInput)→Decision {allow, requireApproval, deny}` | OPA bundles, identity claims | fail closed; policy version/audit mandatory | Policy denial prevents job creation even if agent asks |
| Temporal Orchestrator | `runPlan(PlanRef)→WorkflowId`; state, retries, compensation | Temporal, API, Worker Gateway | never handles local file bytes/secrets; non-determinism prohibited | Restart during wait resumes once; duplicate signal is idempotent |
| Approval Service | `decide(ctx, ApprovalId, Decision)→Result<ActionGrant>` | Domain API, Audit, Policy | expiry, actor role, plan hash binding | Changed plan invalidates prior grant |
| Worker Gateway | `dispatch(WorkerJob)→Result<JobReceipt>`; mTLS session registry | Temporal, Worker protocol | worker identity/capability checked; offline queue TTL | Unenrolled worker receives no job; reconnect preserves idempotency |
| Windows Worker | `execute(JobManifest)→Result<JobEvidence>`; bounded filesystem/command/DAW/audio operations | local keystore, adapters, Rust engine | local trust boundary; only signed manifests/capability paths | Job cannot write outside granted workspace; revoked grant stops next action |
| DAW Contract + FL Studio 2025 | `invoke(DawCommand)→Result<DawEvidence>`; capability discovery | Worker, FL integration route | unsupported capability explicit; foreground/UI fallback gated | Qualified `inspect` command returns version/session evidence; mutation creates backup and proof |
| Audio Engine | `process(AudioJob)→Result<AudioArtifact>`; offline DSP | Worker storage, DSP library | validates format, resource quotas, atomic output | Golden WAV test matches tolerance; cancel leaves no partial published asset |
| VST3 | `prepareToPlay`, `process(AudioBuffer)`; parameters/state | JUCE, VST3 SDK | real-time boundary: no allocation/lock/network/blocking | pluginval + host smoke test; automation deterministic |
| Provider Gateway | `complete(ModelRequest)→Result<ModelResponse>`; routing/redaction/budgets | secret manager, providers, audit | provider boundary; redact/classify before egress | disallowed classification denies call; key absent from logs/client |
| Knowledge Service | `ingest(Source)→Result<KnowledgeRef>`; `retrieve(Query)→Result<GroundedContext>` | object store, Postgres, vector index | malware/type/classification scan; citations required | deleted source no longer retrieves; every chunk returns provenance |
| Artifact Registry | `publish(BuildArtifact)→Result<ArtifactRef>` | object storage, signer, SBOM scanner | only signed, attested artifacts distributable | tampered artifact rejected; rollback selects prior signed version |
| Audit/Evidence | `append(AuditEvent)→Result<EventRef>`; immutable query | append-only store, SIEM | actor/timestamp/plan/policy hashes mandatory | action sequence reconstructs from correlation ID |

Core domain types: `Brief`, `ProductSpec`, `ExecutionPlan`, `PlanStep`, `ToolManifest`, `CapabilityGrant`, `Approval`, `WorkerJob`, `DawCommand`, `AudioJob`, `EvidenceRef`, `ArtifactRef`, `AuditEvent`, `DomainError` live in `contracts/src/domain`. Every type has a stable `schemaVersion`.

## 5. Runtime and technology stack

| Boundary | Chosen stack | Rule |
|---|---|---|
| Web control plane | Next.js + React + TypeScript; OIDC/OAuth2; WebAuthn for sensitive approvals | UI is command/evidence client only |
| API/domain | NestJS on Node.js 22; REST/OpenAPI; Zod; PostgreSQL 16 | Stateless horizontally scalable service |
| Durable orchestration | Temporal TypeScript SDK; Temporal Cloud first, self-host option | workflows deterministic; activities carry work |
| Policy | Open Policy Agent/Rego; signed/versioned bundles | policy evaluated server-side and worker-side for local enforcement |
| Local Windows worker | .NET 8 Windows Service; Rust sidecar for audio/process isolation; MSIX installer | mTLS outbound WebSocket/gRPC; Windows Credential Manager/DPAPI |
| AI | Provider Gateway adapters: OpenAI, Anthropic, Google, OpenAI-compatible self-hosted endpoint | vendor APIs only behind gateway; no raw credentials outside secret manager |
| Knowledge | PostgreSQL + pgvector; S3-compatible object storage; extraction service | canonical metadata in Postgres, originals immutable in object store |
| Audio/DSP | Rust + `symphonia`/`rubato`/`realfft` as appropriate; FFmpeg invoked only through constrained wrapper | offline work, deterministic presets, golden audio fixtures |
| VST3 | C++20, JUCE, Steinberg VST3 SDK, CMake | separate binary lifecycle and realtime rules |
| DAW adapter | TypeScript/.NET contract boundary; FL Studio 2025 qualified integration implementation | capability discovery before each execution class |
| Testing | Vitest; Playwright; Pact-compatible contract tests; Temporal test environment; Rust `cargo test`; Catch2; pluginval | test evidence attached to release candidate |
| Observability | OpenTelemetry, Prometheus, Grafana, Loki, Tempo/Sentry | trace ID crosses browser→API→workflow→worker→adapter |
| Deployment | Terraform, Kubernetes for cloud services, managed Postgres/object storage/secret manager, GitHub Actions, cosign/SLSA | staged dev→staging→production; immutable release artifacts |

## 6. Governance and reference book

`GOVERNANCE.md` is mandatory before implementation. It defines roles (Owner, Builder, Reviewer, Release Manager, Worker Operator), action taxonomy, approval SLA/expiry, data classification, retention, emergency stop, incident handling, and change approval.

`REFERENCE-BOOK.md` is the living index: goals; non-goals; glossary; ADR index; contract matrix; threat model; current capability matrix; FL Studio qualification results; prompt/version registry; test inventory; operational runbooks; release evidence. Any feature PR updates relevant entries or explicitly records “no reference-book impact.”

Invariants:

1. No side effect without correlation ID, idempotency key, policy result, and audit event.
2. No local job without enrolled worker identity, signed manifest, scoped capability grant, and expiry.
3. No approved action survives a plan-hash or policy-version change.
4. No claim of DAW capability without qualification evidence for its exact version/capability level.
5. No release artifact without SBOM, signature, provenance, and test evidence.

## 7. Google Antigravity sequential prompt sequence

Use one phase at a time. Paste its output into the repository before moving forward. Replace bracketed fields with evidence. Antigravity must not invent repository state, API support, test results, or vendor facts. Every phase output includes: `verified_facts`, `decisions`, `assumptions`, `open_risks`, `changed_files`, `commands_run`, `results`, `next_gate`.

### PHASE 00 — Foundation and actionable baseline

```text
You are the lead engineer for AETHER FORGE. Create its engineering foundation only; do not implement product functionality yet.

Fixed decisions: hybrid deployment; controlled autonomy; web control plane; complete platform scope; FL Studio 2025 is first production DAW adapter. Cloud owns identity, policy, audit, metadata and orchestration. Local Windows Worker owns DAW, local files, audio devices, private project assets and local execution. Temporal is durable orchestration. Default consequential actions require approval. Do not weaken these choices.

First inspect the actual workspace/repository. Report exact paths and evidence. If empty or absent, say so plainly. Never claim inspection, implementation, provider support, API support, or passing tests without direct evidence.

Create only baseline artifacts: README.md, GOVERNANCE.md, REFERENCE-BOOK.md, docs/adr/ directory with ADR-0001 through ADR-0010 stubs or full entries, docs/product/requirements.md, docs/security/{threat-model,data-classification}.md, contracts/ directory with a concise contract index, and a root backlog/issues.md. Use the supplied AETHER FORGE Blueprint v1.0 as source decisions; record any conflict instead of silently changing it.

Define: product boundary; non-goals; actors; data classes; action classes; approval matrix; stop button semantics; evidence standard; contract versioning; definition of ready/done; risk register; first vertical slice and acceptance criteria. Make no secrets, no cloud resources, no provider calls, no DAW/UI automation, no dependencies unless already required by repository evidence.

Return a compact evidence table and a phase gate. Gate passes only when foundation documents exist, cross-link decisions, distinguish verified facts/decisions/assumptions, and contain an actionable first-slice backlog.
```

### PHASE 01 — Repository bootstrap and contracts

```text
Inspect PHASE 00 artifacts and existing repository state. Create the monorepo skeleton only if absent: pnpm workspace, TypeScript strict configuration, apps/web, apps/api, services/orchestration, workers/windows-host, adapters/daw-contract, packages/sdk, packages/test-fixtures, contracts, infra, tests. Do not add placeholder business logic.

Implement versioned Zod contracts for RequestContext, Result<T>, Brief, ProductSpec, ExecutionPlan, PlanStep, CapabilityGrant, Approval, WorkerJob, EvidenceRef, AuditEvent and DomainError. Generate OpenAPI/JSON Schema where practical. Add compatibility tests for additive and breaking changes. Define event names and CloudEvents envelope. No `any` at process boundaries.

Output file list, exact commands/results, contract compatibility policy, unresolved boundary questions. Gate: clean install, typecheck and contract tests actually pass.
```

### PHASE 02 — Identity, tenancy, governance enforcement

```text
Read contracts and governance. Implement minimal web/API identity boundary: OIDC integration seam, tenant/project membership authorization, role checks, correlation/idempotency middleware, audit event creation, action taxonomy and approval state machine. Use test doubles/configuration seams rather than provisioning a real identity provider without credentials.

Enforce tenant isolation before data access. Implement emergency stop that blocks new dispatch and signals cancellable workflows. Add authorization, idempotency, expiry and audit tests. Do not implement agents or workers yet. Gate: security tests prove cross-tenant denial and changed-plan approval invalidation.
```

### PHASE 03 — Policy-as-code and approvals

```text
Implement OPA policy integration and versioned policy bundles. Define allow, requireApproval, deny decisions for read, write, command, DAW mutation, external upload, package install and release. Bind approvals to tenant, actor, plan hash, policy version, capability scope and expiry. Default unknown action to deny.

Add decision explanation suitable for user UI without exposing sensitive rules. Test fail-closed behavior, stale approval, revoked grant and policy change. Gate: no dispatch path bypasses policy/audit/approval.
```

### PHASE 04 — Durable workflow and first governed vertical slice

```text
Implement Temporal workflow and activities for: submit brief → create deterministic sample plan → policy evaluation → approval wait → simulated execution → evidence → completion. Do not call a real LLM or workstation. Preserve workflow versioning rules and idempotency.

Create web screens for brief submission, plan review, approval and evidence timeline. Use typed API only. Add Temporal restart/retry/cancellation tests and Playwright happy-path test. Gate: controlled simulated write completes once after approval and leaves complete audit trail.
```

### PHASE 05 — Provider gateway and bounded planner

```text
Implement Provider Gateway interface with fake provider plus adapters only when official credentials/docs are available. Add model routing policy, redaction/classification checks, token/cost budgets, structured-output validation, prompt/template version registry and response audit metadata. Keys remain server-side.

Implement planner that produces ExecutionPlan using registered ToolManifest entries, never direct shell/DAW calls. Build evaluation fixtures for valid, malformed, over-budget and unsafe plans. Gate: unsafe/malformed output cannot create executable job; every accepted plan validates against contract.
```

### PHASE 06 — Windows Worker trust boundary

```text
Implement .NET 8 Windows Worker skeleton with enrollment, machine identity, outbound mTLS session, signed JobManifest verification, DPAPI-backed local identity storage, heartbeat, capability grant validation, cancellation and evidence return. Use a mock gateway in tests; do not require a live cloud environment.

Implement a constrained workspace filesystem operation as the first real worker activity: read manifest and atomic write only inside an explicitly granted canonical path. Defend against traversal, symlinks/reparse points, TOCTOU and expired/revoked grants. Gate: adversarial path tests pass; unenrolled, unsigned, expired and out-of-scope jobs fail closed.
```

### PHASE 07 — Knowledge and evidence substrate

```text
Implement source ingestion metadata, classification, content hash, immutable object reference, extraction version, chunk provenance, deletion propagation and retrieval response with citations. Start with local/test object-store implementation. Add pgvector only after Postgres migration exists.

Reject or quarantine unsafe/unsupported inputs according to policy. Test provenance, tenant filtering and deletion. Gate: every retrieval chunk is attributable; deleted or cross-tenant content cannot be returned.
```

### PHASE 08 — Audio/DSP offline vertical slice

```text
Implement local Rust audio engine contract and one safe offline operation: inspect WAV metadata, then optional deterministic gain-normalization to a new atomic output inside granted workspace. Include resource limits, cancellation, format validation and evidence hash. No cloud audio transfer by default.

Use golden fixtures and audio-tolerance tests. Wire approved AudioJob through worker and orchestration. Gate: original never changes; cancellation produces no published partial file; output/provenance are reproducible.
```

### PHASE 09 — FL Studio 2025 discovery and qualification

```text
Do not assume FL Studio APIs. Research only via locally installed/versioned evidence and official documentation supplied to the repository. Implement DAW contract and capability discovery first. Record exact FL Studio 2025 version, integration route, operating prerequisites, limitations, rollback/backup behavior and reproducibility evidence in docs/daws/fl-studio-2025-qualification.md.

Begin with read-only inspect capability. Add non-destructive edit/session mutation/render only after preceding capability passes its dedicated acceptance suite. Any UI automation must be explicit opt-in, foreground-only, observable, abortable, and prohibited for destructive actions without final confirmation. Gate: no capability is advertised absent qualification record and passing evidence.
```

### PHASE 10 — VST3 product boundary

```text
Create C++20/JUCE VST3 target only after licensing/SDK availability is confirmed. Implement minimal processor with deterministic parameter/state handling and no network, blocking, locks, allocations, filesystem scanning or model calls in audio callback. Keep orchestration outside plugin process.

Add CMake build, pluginval validation, host smoke test, parameter automation test, state round-trip test and DSP golden vectors shared with audio engine where meaningful. Gate: target builds and validation results are recorded; otherwise mark blocked with precise missing prerequisite.
```

### PHASE 11 — Security, observability and operations

```text
Implement OpenTelemetry trace propagation across web, API, Temporal, worker and adapters; structured audit query; metrics/log dashboards; alert conditions; secret scanning; SBOM; dependency/license scans; artifact signing/provenance; backup/restore and incident runbooks. Threat-model every external and local trust boundary.

Run abuse-case tests: prompt injection through knowledge, forged worker job, replayed approval, path escape, malicious artifact and provider outage. Gate: high-severity findings have remediation or explicit release block; dashboards correlate one end-to-end job.
```

### PHASE 12 — Integration, validation and release candidate

```text
Assemble one complete, controlled vertical slice: brief → planner → policy → approval → Temporal → Windows Worker → approved safe local operation → evidence/audit → UI result. Include FL Studio operation only if PHASE 09 qualification proves it. Include VST3 only if PHASE 10 passes.

Produce release candidate only after typecheck, unit, contract, integration, E2E, security, performance and manual acceptance evidence actually exists. Generate SBOM, signatures, provenance, changelog, migration/rollback plan, staged rollout plan and support runbook. Clearly list excluded/blocked capabilities. Gate: release manager approval; otherwise retain RC as non-production.
```

## 8. Initial actionable baseline backlog

1. Create Phase 00 documents and approve action taxonomy.
2. Confirm tenancy, region, compliance, retention, supported Windows/FL Studio versions and provider policy.
3. Establish repository and contracts; CI requires format, lint, typecheck, tests, secret scan.
4. Deliver simulated governed workflow before provider, worker, DAW, or DSP integrations.
5. Qualify Windows Worker filesystem boundary before any general command execution.
6. Qualify FL Studio 2025 `inspect` capability before promising mutations or render.

## 9. Definition of release-ready

- All implemented claims map to contract, acceptance test, audit evidence, and owner.
- Security review accepts residual risk; high-severity open issue blocks production.
- All real side effects are approval/policy/audit guarded and stoppable.
- FL Studio and VST3 claims are limited to qualified versions/capabilities.
- Signed, traceable artifacts and rollback have been rehearsed.

