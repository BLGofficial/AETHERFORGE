# AETHER FORGE — Product Requirements & First Vertical Slice

**Version:** 1.0.0  
**Status:** Phase 00 Baseline  
**Cross-References:** [README.md](../../README.md) · [GOVERNANCE.md](../../GOVERNANCE.md) · [REFERENCE-BOOK.md](../../REFERENCE-BOOK.md) · [contracts/README.md](../../contracts/README.md) · [Backlog](../../backlog/issues.md)

---

## 1. Product Purpose & Scope

AETHER FORGE is a hybrid, governed engineering and audio-production platform. It takes a structured **Brief** through specification, planning, policy evaluation, human approval, durable orchestration (Temporal), and capability-scoped local execution on a Windows 11 workstation (including offline Rust audio DSP, qualified FL Studio 2025 adapter tiers, and an isolated C++20/JUCE VST3 processor), producing verifiable **Evidence** and an immutable **Audit Trail**.

### Epistemic Classification of Requirements

- **Verified Facts (`verified_facts`):**
  - Product configuration is hybrid deployment, controlled autonomy, web control plane, complete platform scope, with FL Studio 2025 as the first production DAW target.
  - Direct Phase 00 inspection of `C:\Users\blago\Desktop\AETHERFORGE` confirmed only `AETHER-FORGE-Engineering-Blueprint-v1.0.md` (31,785 bytes) and `0.26.0` (0 bytes) existed prior to Phase 00 execution.
- **Architectural Decisions (`decisions`):**
  - Governed by [ADR-0001](../adr/0001-hybrid-control-plane.md) through [ADR-0010](../adr/0010-release-integrity.md) and [GOVERNANCE.md](../../GOVERNANCE.md).
- **Discovery Assumptions to Validate (`assumptions`):**
  - **ASM-01:** Target customer workstations run licensed Windows 11 with licensed FL Studio 2025 and compatible audio drivers/plugins.
  - **ASM-02:** FL Studio 2025 automation/inspection routes (CLI/Python controller scripting/MIDI/OSC/project parser/foreground UI fallback) will be empirically qualified in Phase 09; zero undocumented FL Studio APIs are assumed in Phase 00.
  - **ASM-03:** Commercial terms, data residency, and model quotas for OpenAI, Anthropic, Google, and self-hosted endpoints will be confirmed prior to external provider activation in Phase 05.
  - **ASM-04:** Multi-tenant account hierarchy, primary deployment region, RPO/RTO targets, and code-signing certificate provisioning will be finalized before production release (Phase 12).

---

## 2. Functional Requirements by Boundary

### FR-01: Web Control Plane (`apps/web`)
1. Authenticate actors via OIDC/OAuth2 and require step-up verification (WebAuthn seam) for high-impact approvals (`release_publish`, `package_install`, `daw_session_mutation`).
2. Allow `Builder` or `Owner` to submit a structured `Brief` with data classification and target project scope.
3. Render generated `ProductSpec` and `ExecutionPlan` steps, displaying each step's `actionClass`, policy decision (`allow`, `requireApproval`, `deny`), human-readable policy explanation, and `planHash`.
4. Provide explicit **Approve**, **Reject**, and **Emergency Stop (`STOP`)** controls.
5. Render a live **Evidence & Audit Timeline** correlating `traceId` across API, Policy, Temporal, and Windows Worker events.
6. Never store provider API keys or connect directly to the local Windows Worker.

### FR-02: Domain API, Policy & Approvals (`apps/api`, `services/policy`, `services/audit`)
1. Enforce tenant isolation before any database read or workflow query (cross-tenant access returns `404 Not Found` / explicit denial audit).
2. Require `idempotencyKey` on all mutating endpoints; duplicate requests with identical parameters return the original `Result<T>`.
3. Evaluate every plan step via OPA versioned bundles (`PolicyInput → Decision`).
4. Bind `Approval` records to `tenantId`, `actor`, `planHash`, `policyVersion`, `canonicalPathScope`, and `expiresAt`. Invalidate approvals automatically if `planHash` or `policyVersion` changes.
5. Append immutable `AuditEvent` records for every command, policy check, approval decision, emergency stop, and job completion.

### FR-03: Durable Orchestration (`services/orchestration`)
1. Execute plans via deterministic Temporal workflows (`runPlan(PlanRef) → WorkflowId`).
2. Wait durably on human approval signals with configurable SLA expiry timers.
3. Handle process restarts, duplicate signals, and worker reconnects idempotently without duplicate side effects.
4. Immediately halt active waits and trigger compensation/cancellation activities upon receiving an `emergencyStop` signal.

### FR-04: Bounded Planner, Provider Gateway & Knowledge (`services/provider-gateway`, `services/knowledge`)
1. Route all LLM requests through Provider Gateway with server-side secret storage, per-tenant token/cost budgets, and mandatory pre-egress classification/redaction checks.
2. Restrict the Planner to emitting Zod-validated `ExecutionPlan` objects referencing registered `ToolManifest` schemas only.
3. Require every retrieved knowledge chunk (`GroundedContext`) to carry `sourceId`, `contentHash`, `location`, `classification`, and `extractionVersion`; label uncited claims as `model_inference`.

### FR-05: Windows Worker & Local File/Audio Execution (`workers/windows-host`, `workers/audio-engine`)
1. Enroll workstation identity using DPAPI-protected local credentials and connect outbound via mTLS to Worker Gateway.
2. Verify cryptographic signature, expiry, `planHash`, `policyVersion`, and `canonicalPathScope` on every `JobManifest` before execution.
3. Prevent directory traversal (`..`), symlink/junction/reparse-point escapes, and TOCTOU races on all local filesystem operations.
4. Execute offline Rust audio jobs (starting with WAV metadata inspection and deterministic gain normalization to a new atomic file) within CPU/memory/time quotas.

### FR-06: FL Studio 2025 Qualification Adapter & VST3 (`adapters/fl-studio-2025`, `plugins/vst3`)
1. Discover and report local FL Studio 2025 installation evidence without assuming unsupported capabilities.
2. Gate each DAW tier (`inspect`, `non_destructive_edit`, `session_mutation`, `render`) behind passing qualification evidence (`docs/daws/fl-studio-2025-qualification.md`).
3. Maintain strict real-time safety in the C++20/JUCE VST3 processor (zero allocations, locks, network, filesystem scans, or LLM calls in the audio callback).

---

## 3. First Vertical Slice Specification (Target: Phases 01–04, Extended to Worker in Phase 06)

### Slice Scope: Governed Brief-to-Approved Execution with Complete Evidence Trail

1. **Cloud Governed Vertical Slice (Phase 04 Gate):**
   - `Builder` submits a `Brief` via the Web Control Plane (`submitBrief(ctx, Brief)`).
   - Domain API validates tenant membership, idempotency key, and schema, emitting `brief.submitted` and creating a deterministic sample `ExecutionPlan` containing one `read_allowlisted` step and one `write_workspace` step.
   - Policy Decision Point evaluates both steps via OPA bundle: `read_allowlisted → allow`, `write_workspace → requireApproval`.
   - Temporal workflow starts (`runPlan`), executes the allowed read step, and pauses waiting for approval on the `write_workspace` step.
   - `Builder`/`Owner` reviews the plan and policy explanation in the Web UI and submits an `Approval` bound to `planHash` and `policyVersion`.
   - Temporal receives the approval signal, verifies hash binding, runs the simulated execution activity once, records an `EvidenceRef` (with SHA-256 hash), and transitions the workflow to `COMPLETED`.
2. **Local Worker Extension (Phase 06 Gate):**
   - Replaces the simulated write activity with an enrolled .NET 8 Windows Worker pulling a signed `JobManifest` and performing an atomic file write strictly inside an explicitly granted canonical local workspace directory.

### First Vertical Slice Acceptance Criteria

| ID | Criterion | Verification Method |
|---|---|---|
| **AC-01** | Every boundary payload validates against `contracts/` Zod schemas (`schemaVersion: "1.0.0"`) with zero untyped `any`. | `pnpm --filter @aether-forge/contracts test` |
| **AC-02** | Cross-tenant read/approve attempts are rejected before data access and recorded in audit logs. | Phase 02 security integration test |
| **AC-03** | Duplicate `idempotencyKey` on brief submission or approval returns the original result without creating duplicate workflows or jobs. | Phase 02/04 idempotency test |
| **AC-04** | Modifying the plan (`planHash` mismatch) or upgrading the OPA policy (`policyVersion` mismatch) after approval causes dispatch to fail closed (`deny`). | Phase 03/04 stale-approval test |
| **AC-05** | Temporal worker restart while waiting for approval resumes cleanly; duplicate approval signal executes the write step at most once. | Phase 04 Temporal replay/restart test |
| **AC-06** | Triggering Emergency Stop while a workflow is waiting or running immediately blocks dispatch, cancels the workflow, and logs `system.emergency_stop.triggered`. | Phase 02/04 emergency stop test |
| **AC-07** | End-to-end correlation ID (`traceId`) reconstructs the complete sequence (`brief.submitted → plan.created → policy.evaluated → approval.decided → job.completed`) in the UI evidence timeline. | Phase 04 Playwright E2E test |
