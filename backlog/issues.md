# AETHER FORGE — Actionable Engineering Backlog

**Version:** 1.0.0  
**Status:** Phase 00 Baseline  
**Cross-References:** [README.md](../README.md) · [GOVERNANCE.md](../GOVERNANCE.md) · [REFERENCE-BOOK.md](../REFERENCE-BOOK.md) · [Requirements](../docs/product/requirements.md) · [contracts/README.md](../contracts/README.md)

> **Execution Rule:** Work proceeds strictly one phase gate at a time (`PHASE 00` → `PHASE 12`). No item in Phase `N+1` starts until Phase `N` meets the [Definition of Done](../GOVERNANCE.md#6-definition-of-ready-dor-and-definition-of-done-dod) with verified command output and evidence.

---

## 1. Phase 00 — Foundation & Actionable Baseline (COMPLETE)

- [x] **AF-001:** Inspect actual workspace (`C:\Users\blago\Desktop\AETHERFORGE`), record exact file paths/sizes, and document conflict with Blueprint §0 (`work/` and `outputs/` absent; `0.26.0` and `AETHER-FORGE-Engineering-Blueprint-v1.0.md` present).
- [x] **AF-002:** Establish product boundary, control loop, and explicit non-goals in [README.md](../README.md) and [docs/product/requirements.md](../docs/product/requirements.md).
- [x] **AF-003:** Define human actors, system principals, action taxonomy, approval matrix, emergency stop semantics, evidence standard, and DoR/DoD in [GOVERNANCE.md](../GOVERNANCE.md).
- [x] **AF-004:** Author [ADR-0001](../docs/adr/0001-hybrid-control-plane.md) through [ADR-0010](../docs/adr/0010-release-integrity.md) in `docs/adr/`.
- [x] **AF-005:** Author [docs/security/threat-model.md](../docs/security/threat-model.md) and [docs/security/data-classification.md](../docs/security/data-classification.md).
- [x] **AF-006:** Author contract specification index and compatibility rules in [contracts/README.md](../contracts/README.md).
- [x] **AF-007:** Author living architecture index, invariant matrix, capability matrix, and risk register in [REFERENCE-BOOK.md](../REFERENCE-BOOK.md).

---

## 2. First Vertical Slice Backlog (Phases 01–04, Extended in Phase 06)

### Phase 01 — Repository Bootstrap & Versioned Contracts (COMPLETE)

- [x] **AF-101: Monorepo Skeleton & Strict TypeScript Tooling**
  - **Scope:** Create `pnpm-workspace.yaml`, `turbo.json`, root `package.json`, `tsconfig.base.json` (`strict: true`, `noImplicitAny: true`), and empty package skeletons for `contracts`, `apps/web`, `apps/api`, `services/orchestration`, `workers/windows-host`, `adapters/daw-contract`, `packages/sdk`, `packages/test-fixtures`, `infra`, `tests`.
  - **Acceptance Criteria:** `pnpm install` and `pnpm typecheck` succeed with zero placeholder business logic.
- [x] **AF-102: Core Domain & Protocol Zod Contracts (`@aether-forge/contracts`)**
  - **Scope:** Implement versioned Zod schemas (`schemaVersion: "1.0.0"`) for `RequestContext`, `Result<T>`, `Brief`, `ProductSpec`, `ExecutionPlan`, `PlanStep`, `ToolManifest`, `CapabilityGrant`, `Approval`, `WorkerJob`, `DawCommand`, `AudioJob`, `EvidenceRef`, `ArtifactRef`, `AuditEvent`, `DomainError`, and CloudEvents 1.0 envelopes.
  - **Acceptance Criteria:** Runtime parsing rejects malformed fixtures and untyped inputs; JSON Schema / OpenAPI artifacts generate cleanly.
- [x] **AF-103: Contract Compatibility Test Suite**
  - **Scope:** Implement automated compatibility tests in `contracts/tests/compatibility/` verifying additive changes pass and breaking changes fail.
  - **Acceptance Criteria:** `pnpm --filter @aether-forge/contracts test` passes with 100% schema coverage.

### Phase 02 — Identity, Tenancy & Governance Enforcement (COMPLETE)

- [x] **AF-201: OIDC Seam, Tenant Isolation & Role Middleware**
  - **Scope:** Implement configurable OIDC authentication seam, tenant/project membership check prior to data access, and role authorization (`Owner`, `Builder`, `Reviewer`, `Release Manager`, `Worker Operator`).
  - **Acceptance Criteria:** Cross-tenant requests return `404` and emit a denial `AuditEvent`.
- [x] **AF-202: Correlation, Idempotency & Immutable Audit Append**
  - **Scope:** Enforce `requestId`, `traceId`, and `idempotencyKey` middleware; implement append-only `AuditEvent` store.
  - **Acceptance Criteria:** Duplicate mutating requests with identical `idempotencyKey` return cached `Result<T>` without re-executing side effects.
- [x] **AF-203: Approval State Machine & Emergency Stop Control**
  - **Scope:** Implement approval lifecycle (`PENDING → APPROVED | REJECTED | EXPIRED | INVALIDATED`) bound to `planHash` and `policyVersion`, plus tenant/project `EmergencyStop` freeze and cancellation signaling.
  - **Acceptance Criteria:** Plan hash mutation invalidates active approvals; Emergency Stop blocks dispatch immediately (`423 Locked`).

### Phase 03 — Policy-as-Code (OPA) & Approval Binding (COMPLETE)

- [x] **AF-301: Versioned OPA Policy Bundles & Decision Service**
  - **Scope:** Implement OPA rules and Policy Decision Point (`evaluate(PolicyInput) → Decision {allow, requireApproval, deny}`) covering all 12 action classes in [GOVERNANCE.md §3](../GOVERNANCE.md) with unknown actions defaulting to `deny`.
  - **Acceptance Criteria:** Fail-closed tests, stale approval tests, revoked grant tests, and UI-safe policy explanation tests pass.

### Phase 04 — Durable Temporal Workflow & First Governed Vertical Slice (COMPLETE)

- [x] **AF-401: Temporal Governed Workflow (`runPlan`)**
  - **Scope:** Implement deterministic Temporal workflow and activities for `submitBrief → sample ExecutionPlan → policy evaluation → approval wait signal → simulated execution → EvidenceRef → completion`.
  - **Acceptance Criteria:** Temporal worker restart mid-approval and duplicate signal tests pass idempotently.
- [x] **AF-402: Web Control Plane Vertical Slice Screens (`apps/web`)**
  - **Scope:** Build typed UI screens for brief submission, plan & policy review, approval decision, emergency stop button, and evidence/audit timeline.
  - **Acceptance Criteria:** E2E happy-path and approval-gated write tests pass end-to-end.

---

## 3. Subsequent Platform Phases (Phases 05–12 Summary Backlog)

- [x] **AF-501 (Phase 05 — COMPLETE):** Provider Gateway with redaction/classification fence, budgets, fake provider adapter, and bounded Planner with valid/malformed/unsafe evaluation fixtures.
- [x] **AF-601 (Phase 06 — COMPLETE):** .NET 8 Windows Worker skeleton (enrollment, outbound mTLS, DPAPI identity, signed `JobManifest` verification, constrained workspace atomic write, adversarial path/symlink/TOCTOU tests).
- [x] **AF-701 (Phase 07 — COMPLETE):** Evidence-addressable Knowledge Service (ingestion metadata, SHA-256 hash, local/S3 object store, Postgres + `pgvector` provenance citations, deletion propagation tests).
- [x] **AF-801 (Phase 08 — COMPLETE):** Local Rust offline Audio Engine (`inspect_wav` + deterministic `gain_normalize` to atomic output inside granted workspace, quotas, golden WAV tolerance tests).
- [x] **AF-901 (Phase 09 — COMPLETE):** FL Studio 2025 empirical discovery and tiered qualification (`docs/daws/fl-studio-2025-qualification.md`), qualifying read-only `inspect` and backup-mandatory `non_destructive_edit` while blocking unqualified `session_mutation` and `render`.
- [x] **AF-1001 (Phase 10 — COMPLETE WITH RECORDED NATIVE SDK BLOCK):** Isolated C++20/JUCE VST3 processor target (`plugins/vst3/AetherForgeProcessor`), CMake build, static real-time safety audit, state round-trip, and shared DSP golden vectors verified; native `.vst3` compilation marked `BLOCKED_MISSING_PREREQUISITES` (missing `C++20 compiler`, `JUCE 8.x SDK`, `Steinberg VST3 SDK`, `pluginval`).
- [x] **AF-1101 (Phase 11 — COMPLETE):** OpenTelemetry end-to-end trace propagation, abuse-case test suite (prompt injection, forged job, replayed approval, path escape, malicious artifact, provider outage), SBOM, signing, and operational runbooks (`docs/operations/runbooks.md`).
- [x] **AF-1201 (Phase 12 — COMPLETE):** Complete end-to-end release candidate (`v1.0.0-rc1`) integrating qualified vertical slice, SBOM, cryptographic signatures, provenance, rollback rehearsal, and Release Manager gate (`RELEASE-CANDIDATE-v1.0.0-rc1.md`, retained as non-production pending human Release Manager sign-off and native SDK provisioning).

---

## 4. Open Discovery Questions & Risk Blockers (Tracked from Blueprint §0 & §8)

1. **ODQ-01 (Tenancy & Compliance):** Confirm target tenancy isolation model (shared schema with RLS vs. schema-per-tenant), deployment region, RPO/RTO, and audit retention beyond the 365-day baseline.
2. **ODQ-02 (FL Studio 2025 Environment):** Confirm exact licensed FL Studio 2025 build number installed on the qualification workstation prior to Phase 09.
3. **ODQ-03 (VST3 / JUCE Licensing & SDK):** Confirm local presence and license tier of Steinberg VST3 SDK and JUCE prior to Phase 10.
4. **ODQ-04 (LLM Provider Commercial Approval):** Confirm approved provider endpoints and data-residency agreements prior to enabling live adapters in Phase 05 (fake provider is used until confirmed).
