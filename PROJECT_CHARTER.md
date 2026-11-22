# AETHER FORGE — Project Charter

**Version:** 1.0.0  
**Date:** 2026-11-23  
**Status:** Active Foundation & Verified v1.0.0-rc1 Baseline  
**Repository Root:** `C:\Users\blago\Desktop\AETHERFORGE`  
**Cross-References:** [SYSTEM_VISION.md](./SYSTEM_VISION.md) · [SCOPE.md](./SCOPE.md) · [ENGINEERING_PRINCIPLES.md](./ENGINEERING_PRINCIPLES.md) · [GOVERNANCE.md](./GOVERNANCE.md) · [MASTER_ROADMAP.md](./MASTER_ROADMAP.md) · [REFERENCE_BOOK.md](./REFERENCE_BOOK.md)

---

## 1. Mission Statement

Build and operate **AETHER FORGE**: a production-oriented, governed AI Systems Engineering and Autonomous Product Construction Platform capable of designing, architecting, implementing, integrating, testing, validating, and delivering complex software, audio DSP chains, native VST3 processors, and qualified DAW agentic workflows with deterministic policy enforcement and immutable evidence.

---

## 2. Project Identity & Core Domains

| Domain ID | Core Engineering Domain | Repository Boundary | Verified Baseline Status |
|---|---|---|---|
| **DOM-01** | AI Operating Systems | `apps/api`, `services/policy`, `services/audit` | **Operational (`v1.0.0-rc1`)** — Tenant-isolated control loop, OPA Rego v1 policy engine, append-only audit ledger |
| **DOM-02** | Multi-Agent Systems | `services/provider-gateway` (`BoundedExecutionPlanner`, `ToolManifestRegistry`) | **Operational (`v1.0.0-rc1`)** — Bounded planner over registered tool manifests; zero unconstrained peer-agent chat |
| **DOM-03** | Agentic Runtime Architecture | `services/orchestration` (`DurableTemporalOrchestrator`), `workers/windows-host` | **Operational (`v1.0.0-rc1`)** — Durable Temporal workflow replay, approval signal wait, signed `JobManifest` dispatch |
| **DOM-04** | Audio Processing and DSP | `workers/audio-engine` (Rust crate + `@aether-forge/audio-engine`) | **Operational (`v1.0.0-rc1` JS/PCM16; Native Rust crate authored)** — Deterministic WAV inspect & `<0.01 dB` gain normalization |
| **DOM-05** | VST3 Plugin Engineering | `plugins/vst3/AetherForgeProcessor` (C++20/JUCE + `@aether-forge/vst3`) | **Source & Real-Time Audit Complete; Native Binary Blocked** — Zero-allocation/zero-lock C++20 core verified; native compile awaits JUCE/VST3 SDKs |
| **DOM-06** | AI DAW Agentic Systems | `adapters/daw-contract`, `adapters/fl-studio-2025`, `docs/daws/fl-studio-2025-qualification.md` | **Qualified for `inspect` & `non_destructive_edit`** — Verified against installed FL Studio 2025 (`25.1.6.4997`) and real factory `.flp` files |
| **DOM-07** | C++ and Native Software Engineering | `plugins/vst3/`, `workers/audio-engine/src/lib.rs`, `workers/windows-host/Program.cs` | **Sources Authored; Host Compilers Pending** — `cmake.exe` present; `cl.exe`/`clang++`, `cargo`, and `dotnet` SDK pending install |
| **DOM-08** | Full-Stack Software Development | `apps/web`, `apps/api`, `packages/sdk`, `packages/ui`, `packages/config` | **Operational (`v1.0.0-rc1`)** — 4-screen Web Control Plane + OpenAPI 3.1 JSON REST endpoints |
| **DOM-09** | Infrastructure, APIs and Integrations | `contracts/`, `infra/{terraform,kubernetes,temporal,monitoring}`, `services/knowledge` | **Operational (`v1.0.0-rc1`)** — Zod v1.0.0 contracts, OpenAPI 3.1, JSON Schema, Postgres 16 + `pgvector` migration, W3C OpenTelemetry |
| **DOM-10** | Testing, Verification and Deployment | `tests/{contract,security,e2e,performance}`, `services/artifact-registry`, `.github/workflows/ci.yml` | **Operational (`v1.0.0-rc1`)** — `14` test suites (`47/47` passing tests), CycloneDX 1.5 SBOM, SLSA v1.0 provenance, rollback rehearsal |

---

## 3. Stakeholders & Authority Structure

- **Owner:** Final authority on tenant governance, OPA policy bundles, emergency stop clearance, and external data egress approvals.
- **Builder:** Authors product briefs, reviews decomposed plans, and approves standard workspace writes, offline audio DSP jobs, and non-destructive DAW staging.
- **Reviewer:** Independently audits code diffs, test outputs, security abuse-case results, and Reference Book updates.
- **Release Manager:** Exercises dual-control approval over `release_publish` only after SBOM, cryptographic signature, SLSA provenance, and rollback rehearsal evidence pass.
- **Worker Operator:** Enrolls, monitors, or halts the customer-operated Windows 11 Worker (`workers/windows-host`).

---

## 4. Charter Commitments

1. **No Fabricated Capabilities:** Capabilities lacking local SDKs, vendor credentials, or empirical DAW qualification are marked `BLOCKED` or `UNQUALIFIED` and fail closed at runtime.
2. **No Silent Destructive Operations:** Source audio stems and primary `.flp` DAW project files are never overwritten; all consequential mutations require policy evaluation, human approval bound to `planHash` + `policyVersion`, and pre-action backups.
3. **No Completion Claims Without Evidence:** Every engineering delivery records `verified_facts`, `decisions`, `assumptions`, `open_risks`, `changed_files`, `commands_run`, `results`, and `next_gate`.
