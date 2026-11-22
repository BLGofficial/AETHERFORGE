# AETHER FORGE — Governance Charter

**Version:** 1.0.0  
**Status:** Mandatory Baseline (Phase 00)  
**Cross-References:** [README.md](./README.md) · [REFERENCE-BOOK.md](./REFERENCE-BOOK.md) · [ADR-0002](./docs/adr/0002-controlled-autonomy-policy-engine.md) · [Data Classification](./docs/security/data-classification.md) · [Threat Model](./docs/security/threat-model.md)

---

## 1. Core Invariants

1. **No side effect without full traceability:** Every state-changing operation requires a `requestId`, `traceId`, `idempotencyKey`, policy evaluation result (`policyVersion`), and immutable `AuditEvent`.
2. **No local job without cryptographic & capability binding:** The Windows Worker rejects any job lacking an enrolled worker identity, valid signature over `JobManifest`, scoped `CapabilityGrant`, and non-expired timestamp.
3. **No stale approval survival:** Any change to `planHash` or `policyVersion` immediately invalidates existing `Approval` and `ActionGrant` records.
4. **No unqualified DAW capability claims:** An operation on FL Studio 2025 (or any future DAW) cannot be enabled or advertised without recorded qualification evidence for the exact DAW version and capability tier.
5. **No unverified release artifact:** Release candidates require passing test evidence, SBOM, cryptographic signature, and provenance attestation.

---

## 2. Actors and Roles

### Human Roles

| Role | Responsibilities | Permitted Authority | Prohibited Actions |
|---|---|---|---|
| **Owner** | Tenant governance, policy configuration, emergency stop, high-impact approvals, worker enrollment authorization | Approve all action classes; trigger/clear emergency stop; manage tenant roles | Cannot bypass immutable audit logging or unsigned manifest checks |
| **Builder** | Submit briefs, review generated specs/plans, approve standard project writes and non-destructive local tasks | Submit briefs; approve `write`, `audio_dsp`, `daw_non_destructive_edit` within assigned projects | Cannot approve production releases, policy downgrades, or cross-tenant actions |
| **Reviewer** | Inspect execution evidence, diffs, audio/DAW proofs, and security/test reports | Approve/reject code, plan steps, and validation gates | Cannot self-approve plans they authored when dual-control policy applies |
| **Release Manager** | Verify SBOM, signatures, provenance, rollback plan, and full test evidence | Approve `release` action class and staged rollout progression | Cannot release unsigned artifacts or override high-severity security blocks |
| **Worker Operator** | Install, enroll, monitor, pause, or revoke the Windows Worker on a customer workstation | Enroll/unenroll local worker; configure local workspace path allowlists; trigger local hard stop | Cannot mint cloud policy decisions or access cloud provider secrets |

### System Principals (Non-Human)

| Principal | Boundary | Authority Limit |
|---|---|---|
| **Bounded Planner / Agent** | Cloud Control Plane | May propose `ExecutionPlan` using registered `ToolManifest` schemas only. **Cannot** mint `CapabilityGrant`, alter policy, self-approve, or invoke shell/DAW directly. |
| **Policy Decision Point (OPA)** | Cloud & Local Worker | Deterministic evaluation of `PolicyInput → Decision {allow, requireApproval, deny}`. Fail-closed on missing input or bundle error. |
| **Temporal Orchestrator** | Cloud Orchestration Plane | Coordinates workflow state, timers, retries, signals, and compensation. Never handles raw local file bytes or provider API keys. |
| **Windows Worker** | Customer Workstation | Pulls signed `JobManifest` over outbound mTLS; enforces local capability grants, path canonicalization, and resource quotas. |

---

## 3. Action Taxonomy & Approval Matrix

All tool invocations and workflow activities map deterministically to an `ActionClass`. Any unknown or unclassified action defaults to **`deny`**.

| Action Class | Description | Default Policy Decision | Required Approver Role | Approval SLA / Expiry | Local Backup / Reversibility Requirement |
|---|---|---|---|---|---|
| `read_allowlisted` | Read tenant-scoped project metadata or allowlisted local workspace metadata | `allow` | N/A (policy-logged) | Immediate | Read-only; no mutation |
| `write_workspace` | Create/modify files inside an explicitly granted canonical local workspace directory | `requireApproval` | Builder / Owner | 4 hours (`14400s`) | Atomic write via temp file + prior version hash/backup |
| `command_bounded` | Execute a registered, parameter-validated local build/test command | `requireApproval` | Builder / Owner | 2 hours (`7200s`) | Sandboxed working directory; full stdout/stderr/exit capture |
| `audio_dsp` | Offline Rust audio engine inspection or deterministic transformation to new output file | `requireApproval` (inspect-only may be policy-configured to `allow` per project) | Builder / Owner | 4 hours (`14400s`) | Never overwrites source audio; writes new atomic output file |
| `daw_inspect` | Read-only inspection of FL Studio 2025 version, project metadata, or state | `allow` (only after Phase 09 qualification passes; `deny` until qualified) | Builder (if policy-gated) | 2 hours (`7200s`) | Strictly read-only |
| `daw_non_destructive_edit` | Non-destructive edit in copy/scratch session or parameter preset staging | `requireApproval` (`deny` until qualified) | Builder / Owner | 1 hour (`3600s`) | Automated pre-action project backup copy + hash verification |
| `daw_session_mutation` | Direct mutation of active DAW session or arrangement | `requireApproval` (`deny` until qualified) | Owner / Builder (explicit foreground confirmation if UI fallback used) | 30 minutes (`1800s`) | Mandatory timestamped `.flp` backup + reversible proof |
| `daw_render` | Trigger local DAW audio export/render inside granted output path | `requireApproval` (`deny` until qualified) | Builder / Owner | 1 hour (`3600s`) | Atomic output verification; no overwrite of existing renders |
| `external_upload` | Transfer local summaries, redacted context, or artifacts to cloud/provider | `requireApproval` (`deny` for `RESTRICTED_LOCAL` / `SECRET_CREDENTIAL`) | Owner | 1 hour (`3600s`) | Redaction scan + data classification gate before egress |
| `package_install` | Install or update local toolchain, dependency, or plugin component | `requireApproval` | Owner + Worker Operator | 30 minutes (`1800s`) | Signature/checksum verification + rollback snapshot |
| `release_publish` | Publish signed build, worker installer, or VST3 release candidate | `requireApproval` | Release Manager + Reviewer | 24 hours (`86400s`) | Immutable artifact registry + tested rollback target |
| `unknown` | Any action not matching a registered schema and action class | `deny` | None (hard blocked) | N/A | Fail closed |

### Approval Binding Rules

Every `Approval` record and resulting `CapabilityGrant` is cryptographically bound to:
- `tenantId` and `projectId`
- `planId` and `planHash` (SHA-256 of canonical `ExecutionPlan`)
- `stepId` and `actionClass`
- `policyVersion` (OPA bundle digest)
- `workerId` (for local execution jobs)
- `canonicalPathScope` (exact normalized root paths permitted)
- `expiresAt` (UTC timestamp; checked at dispatch AND before local worker execution)

---

## 4. Emergency Stop Button Semantics

The Emergency Stop (`STOP`) control exists in both the **Web Control Plane** (tenant/project/workflow level) and the **Windows Worker Tray/Service CLI** (workstation level).

1. **Immediate Dispatch Freeze:** Flips tenant/project or worker state to `HALTED`. Worker Gateway and Domain API immediately reject new job dispatches (`HTTP 423 Locked` / `DOMAIN_EMERGENCY_STOP_ACTIVE`).
2. **Capability Grant Revocation:** All active `CapabilityGrant` tokens for the halted scope are marked `REVOKED`.
3. **Temporal Workflow Signal:** Sends high-priority `emergencyStop` signal to all running workflows in the scope, transitioning waiting approval timers and retry loops into `CANCELLED_BY_EMERGENCY_STOP`.
4. **Local Worker Abort Protocol:**
   - Worker receives cancellation over outbound mTLS channel (or immediately via local stop command).
   - Worker stops launching any queued steps.
   - In-flight filesystem or offline audio jobs terminate child threads/processes, delete incomplete temporary staging files (`.tmp-*`), and leave existing committed user files untouched.
   - If any foreground DAW operation is active, worker aborts the adapter sequence immediately and records `ABORTED_SAFE_STATE` or `MANUAL_INSPECTION_REQUIRED` evidence.
5. **Audit & Recovery:** Emits an immutable `system.emergency_stop.triggered` audit event. Resuming requires an explicit `Owner` (and `Worker Operator` if halted locally) clear action, which forces re-approval of any unexecuted plan steps.

---

## 5. Evidence Standard

Every phase delivery, automated workflow step, and architectural claim must maintain strict epistemic separation:

- **`verified_facts`**: Directly observed repository files, command outputs, exit codes, hashes, and test results captured during execution.
- **`decisions`**: Explicit architectural or governance commitments adopted by the system (traceable to an ADR or Blueprint section).
- **`assumptions`**: Unverified external conditions (e.g., customer licensing, third-party DAW integration behaviors prior to Phase 09 qualification) that require empirical validation before production claims are made.

### Mandatory Execution Evidence Fields

Every `EvidenceRef` attached to a `Result<T>` must contain:
- `evidenceId` (UUIDv7)
- `correlationId` / `traceId`
- `producer` (`web`, `api`, `policy`, `temporal`, `worker`, `daw-adapter`, `audio-engine`)
- `artifactHash` (SHA-256 of payload or output file)
- `classification` (`DataClassification`)
- `createdAt` (ISO-8601 UTC)
- `verifiableLocation` (immutable object store URI or local workspace digest reference)

---

## 6. Definition of Ready (DoR) and Definition of Done (DoD)

### Definition of Ready (before starting any Phase or Backlog Item)

1. Target module boundary and owning folder in the repository structure are identified.
2. Input/output types are defined in `contracts/` (or scheduled as the first deliverable of that item).
3. Action classes, data classifications, and policy rules affected by the item are specified.
4. Security trust boundaries and failure modes are listed.
5. Acceptance criteria and verification commands are stated deterministically.

### Definition of Done (before passing any Phase Gate or merging a PR)

1. All code compiles with strict typechecking (`noImplicitAny`, zero untyped `any` across process boundaries).
2. Runtime Zod/schema validation enforces contract boundaries.
3. Unit, contract compatibility, and security/negative tests exist and pass with captured command output.
4. No secrets, raw credentials, or unapproved external calls exist in code, tests, or logs.
5. `REFERENCE-BOOK.md` is updated (or explicit "no reference-book impact" is recorded).
6. Phase gate report includes `verified_facts`, `decisions`, `assumptions`, `open_risks`, `changed_files`, `commands_run`, `results`, and `next_gate`.

---

## 7. Incident Handling, Retention, and Change Control

- **Audit Retention:** Immutable audit logs and approval records are retained for a minimum of 365 days (configurable per enterprise tenant compliance policy).
- **Artifact Retention:** Signed release artifacts and SBOMs are retained indefinitely for rollback integrity; temporary staging files on the Windows Worker are purged immediately upon step completion or cancellation.
- **Change Control:** Any modification to `GOVERNANCE.md`, `contracts/` major versions, OPA policy default rules, or trust boundary definitions requires an ADR update, compatibility test verification, and `Owner` + `Reviewer` sign-off.
