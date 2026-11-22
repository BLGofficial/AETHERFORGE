# AETHER FORGE — Engineering Principles

**Version:** 1.0.0  
**Date:** 2026-11-23  
**Cross-References:** [PROJECT_CHARTER.md](./PROJECT_CHARTER.md) · [GOVERNANCE.md](./GOVERNANCE.md) · [REFERENCE_BOOK.md](./REFERENCE_BOOK.md)

---

## 1. Ten Operating Principles & Enforcement Mechanisms

| # | Principle | Concrete Architectural & CI Enforcement in AETHER FORGE |
|---|---|---|
| **1** | **Architecture before implementation** | Every subsystem boundary is governed by [ADR-0001](./docs/adr/0001-hybrid-control-plane.md) through [ADR-0010](./docs/adr/0010-release-integrity.md) and indexed in [REFERENCE_BOOK.md](./REFERENCE_BOOK.md) before runtime code is written. |
| **2** | **Evidence before assumptions** | Every delivery and runtime result separates `verified_facts`, `decisions`, and `assumptions`, and attaches an immutable `EvidenceRef` (UUID, producer, SHA-256 `artifactHash`, `verifiableLocation`). |
| **3** | **Explicit contracts between modules** | All cross-process payloads validate at runtime against versioned Zod schemas in `@aether-forge/contracts` (`schemaVersion: "1.0.0"`). Static CI test prohibits `any` or `ZodTypeAny` in `contracts/src/**/*.ts`. |
| **4** | **Modular and replaceable components** | 26 isolated workspace packages across `contracts`, `apps/*`, `services/*`, `workers/*`, `adapters/*`, `plugins/*`, `packages/*`, and `tests/*` communicating strictly through typed interfaces. |
| **5** | **Provider-agnostic intelligence** | All LLM calls route through `@aether-forge/provider-gateway` behind a unified `ProviderAdapter` contract with prompt-template SHA-256 verification, pre-egress redaction, and token/cost budgets. |
| **6** | **Deterministic execution wherever possible** | Canonical SHA-256 plan hashing (`computeCanonicalPlanHash`), OPA Rego v1 policy evaluation, replay-safe Temporal workflows, and bit-exact PCM16 WAV gain normalization. |
| **7** | **Independent verification** | 14 automated Vitest suites (`47` tests across contract compatibility, security boundaries, abuse cases, E2E HTTP/UI flows, and latency benchmarks) verify every claim independently of authoring code. |
| **8** | **Traceable engineering decisions** | Every state mutation requires `requestId`, W3C `traceId`/`traceparent`, `idempotencyKey`, `policyVersion`, `planHash`, and an append-only `AuditEvent` (`INV-01`). |
| **9** | **No fabricated capabilities** | Missing host SDKs (`.NET 8 SDK`, `cargo`, `MSVC/JUCE/VST3 SDK/pluginval`) and unqualified DAW tiers (`session_mutation`, `render`) are explicitly detected and blocked (`INV-04`, `INV-05`). |
| **10** | **No silent destructive operations** | Source WAV files (`DOMAIN_AUDIO_OVERWRITE_SOURCE_FORBIDDEN`) and primary `.flp` sessions (`DOMAIN_DAW_OVERWRITE_SOURCE_FORBIDDEN`) are immutable; workspace writes use exclusive `.tmp-*` staging + TOCTOU hash checks. |

---

## 2. Baseline Architecture Decision Process (ADR Lifecycle)

1. **Trigger:** Any proposal that alters a trust boundary, contract major version, action taxonomy rule, data classification egress policy, or native runtime boundary requires an ADR in `docs/adr/NNNN-<slug>.md`.
2. **Required Sections:** `Status`, `Date`, `Phase`, `Related Documents`, `Context`, `Decision`, `Explicit Boundary Rule`, `Alternatives Considered`, and `Consequences`.
3. **Verification Gate:** An ADR is not `Accepted` until its boundary rule is linked to an invariant (`INV-01`..`INV-05`) in [REFERENCE_BOOK.md](./REFERENCE_BOOK.md) and enforced by an automated negative/security test in `tests/security/` or `contracts/tests/compatibility/`.
