# AETHER FORGE

**Version:** 1.0.0-phase00  
**Status:** Phase 00 — Engineering Foundation & Actionable Baseline  
**Configuration:** Hybrid deployment · Controlled autonomy · Web control plane · Complete platform scope  
**First Production DAW Target:** FL Studio 2025 (Windows 11)

---

## 1. Product Boundary

AETHER FORGE converts a governed product brief into a traceable build program and, where permitted by policy and explicit human approval, executes approved work through cloud tools and the customer-operated Windows workstation. It produces:

- Architecture specifications and decomposed execution plans
- Code changes, tests, and signed build artifacts
- Offline audio-processing chains and rendered audio artifacts
- Qualified DAW inspection/session tasks (targeting FL Studio 2025 first)
- Isolated C++20/JUCE VST3 processor packages
- Immutable audit events, provenance records, and release candidates

### Control Loop

```text
Brief → specification → decomposition → plan → policy check → approval
  → durable workflow → capability-scoped execution → evidence → validation
  → review/release decision → immutable audit trail
```

### Explicit Non-Goals

AETHER FORGE is **not**:

1. **An unrestricted remote-desktop agent:** There is no inbound network connection from the cloud control plane to the user's workstation, and no unconstrained shell or screen control.
2. **A credential vault for raw provider secrets on client devices:** No LLM or cloud provider API key ever reaches the browser or the local Windows Worker.
3. **A DAW replacement:** Audio composition and interactive mixing remain inside the customer's licensed DAW; AETHER FORGE operates only through qualified adapter contracts.
4. **A promise of universal third-party DAW/plugin control:** Only explicitly qualified versions and capability tiers (`inspect`, `non_destructive_edit`, `session_mutation`, `render`) with passing evidence are supported.
5. **An autonomous unmonitored background mutator:** Every consequential action requires a typed plan, deterministic policy evaluation, explicit approval (by default), idempotency key, and audit trail.

---

## 2. Verified Workspace Baseline (Phase 00 Inspection)

Direct inspection of `C:\Users\blago\Desktop\AETHERFORGE` prior to Phase 00 artifact creation established:

| Category | Verified State | Evidence / Notes |
|---|---|---|
| Source specification | `AETHER-FORGE-Engineering-Blueprint-v1.0.md` (31,785 bytes) | Present at workspace root |
| Ancillary root file | `0.26.0` (0 bytes) | Empty file present at workspace root |
| Prior directories (`work/`, `outputs/`) | Absent | **Recorded conflict with Blueprint §0:** Blueprint noted empty `work/` and `outputs/` directories during blueprint authoring; actual Phase 00 workspace contains `AETHER-FORGE-Engineering-Blueprint-v1.0.md` and `0.26.0` only |
| Git repository / `.git` | Absent | No VCS history initialized yet |
| Source code / build manifests / tests / secrets | Absent | No `package.json`, `Cargo.toml`, `.sln`, tests, or credentials exist in Phase 00 |

---

## 3. Architecture & Governance Index

- [AETHER-FORGE-Engineering-Blueprint-v1.0.md](./AETHER-FORGE-Engineering-Blueprint-v1.0.md) — Source engineering blueprint
- [GOVERNANCE.md](./GOVERNANCE.md) — Actors, action taxonomy, approval matrix, emergency stop semantics, evidence standard, Definition of Ready/Done
- [REFERENCE-BOOK.md](./REFERENCE-BOOK.md) — Master living index, glossary, invariant links, capability matrix, risk register
- [contracts/README.md](./contracts/README.md) — Versioned contract index, shared envelopes, schema compatibility rules
- [docs/product/requirements.md](./docs/product/requirements.md) — Product requirements, actor workflows, first vertical slice, acceptance criteria
- [docs/security/threat-model.md](./docs/security/threat-model.md) — Trust boundaries, threat matrix, abuse cases, mitigations
- [docs/security/data-classification.md](./docs/security/data-classification.md) — Data classes, handling rules, egress/redaction policy, retention
- [backlog/issues.md](./backlog/issues.md) — Phase-gated actionable backlog and first vertical slice breakdown

### Architecture Decision Records (`docs/adr/`)

- [ADR-0001: Hybrid Control Plane and Local Execution Plane](./docs/adr/0001-hybrid-control-plane.md)
- [ADR-0002: Controlled Autonomy as a Policy Engine](./docs/adr/0002-controlled-autonomy-policy-engine.md)
- [ADR-0003: Temporal for Durable Orchestration](./docs/adr/0003-temporal-durable-orchestration.md)
- [ADR-0004: Typed Protocol First](./docs/adr/0004-typed-protocol-first.md)
- [ADR-0005: Agent Roles as Bounded Tools Behind a Planner](./docs/adr/0005-bounded-agent-roles.md)
- [ADR-0006: Provider Abstraction with Redaction and Routing](./docs/adr/0006-provider-gateway-redaction-routing.md)
- [ADR-0007: Knowledge is Evidence-Addressable](./docs/adr/0007-evidence-addressable-knowledge.md)
- [ADR-0008: Local Audio Engine Separate from VST3](./docs/adr/0008-local-audio-engine-separate-from-vst3.md)
- [ADR-0009: FL Studio 2025 Adapter as a Qualification Layer](./docs/adr/0009-fl-studio-2025-qualification-layer.md)
- [ADR-0010: Supply-Chain and Release Integrity](./docs/adr/0010-release-integrity.md)

---

## 4. Repository Bootstrap Policy

Phase 00 establishes engineering governance, architecture decisions, security boundaries, contract specifications, and the actionable backlog only. Monorepo scaffolding (`pnpm-workspace.yaml`, TypeScript packages, Zod schemas, and contract compatibility tests) begins in **Phase 01** after the Phase 00 gate is verified.
