# AETHER FORGE — Platform Scope & Capability Boundaries

**Version:** 1.0.0  
**Date:** 2026-11-23  
**Cross-References:** [PROJECT_CHARTER.md](./PROJECT_CHARTER.md) · [SYSTEM_VISION.md](./SYSTEM_VISION.md) · [RELEASE-CANDIDATE-v1.0.0-rc1.md](./RELEASE-CANDIDATE-v1.0.0-rc1.md) · [docs/daws/fl-studio-2025-qualification.md](./docs/daws/fl-studio-2025-qualification.md)

---

## 1. In-Scope & Verified Operational Capabilities (`v1.0.0-rc1`)

1. **Typed Protocol & Schema Generation (`@aether-forge/contracts`, `@aether-forge/sdk`):**
   - Versioned Zod schemas (`schemaVersion: "1.0.0"`), CloudEvents 1.0 envelopes, deterministic SHA-256 `computeCanonicalPlanHash`, generated JSON Schema Draft 2020-12 ([contracts/generated/json-schema.json](./contracts/generated/json-schema.json)) and OpenAPI 3.1.0 ([contracts/generated/openapi.json](./contracts/generated/openapi.json)).
2. **Governance, Multi-Tenant Security & Policy-as-Code (`@aether-forge/api`, `@aether-forge/policy`, `@aether-forge/audit`):**
   - OIDC token verification seam, tenant-before-data isolation (`404 NOT_FOUND`), role authorization (`Owner`, `Builder`, `Reviewer`, `ReleaseManager`, `WorkerOperator`), idempotency deduplication, OPA Rego v1 policy evaluation across 11 governed action classes, approval state machine with `planHash`/`policyVersion` drift invalidation (`INV-03`), and Emergency Stop (`423 Locked`).
3. **Durable Temporal Orchestration & Web Control Plane (`@aether-forge/orchestration`, `@aether-forge/web`):**
   - Replay-deterministic workflow state machine, transient activity retry, duplicate signal deduplication, 4-screen HTML Control Plane UI (`/`, `/ui/submit-brief`, `/ui/approve`, `/ui/emergency-stop`), and OpenAPI 3.1 JSON REST endpoints (`/api/v1/health`, `/api/v1/briefs`, `/api/v1/plans`, `/api/v1/approvals/{id}/decision`, `/api/v1/system/emergency-stop`).
4. **Provider Gateway, Bounded Planner & Evidence-Addressable Knowledge (`@aether-forge/provider-gateway`, `@aether-forge/knowledge`):**
   - Prompt template SHA-256 registry, pre-egress credential/path redaction fence, tenant token/cost quotas, `ToolManifest`-bounded planner, Postgres 16 + `pgvector` schema migration, immutable object store, chunk provenance citations, synchronous deletion propagation, and prompt-injection/malware quarantine.
5. **Windows Worker Trust Boundary, Offline Audio DSP & Qualified FL Studio 2025 Adapter (`@aether-forge/windows-host`, `@aether-forge/filesystem`, `@aether-forge/git`, `@aether-forge/audio-engine`, `@aether-forge/fl-studio-2025`):**
   - DPAPI-backed identity store, outbound mTLS session & heartbeat, signed `JobManifest` verification, path traversal / NTFS junction / TOCTOU defenses, golden PCM16 WAV inspection & `<0.01 dB` gain normalization, and qualified FL Studio 2025 (`25.1.6.4997`) `inspect` and backup-mandatory `non_destructive_edit` verified against real Image-Line factory `.flp` files (`NewStuff.flp`, `Breakbeat.flp`).
6. **Observability & Supply-Chain Integrity (`@aether-forge/observability`, `@aether-forge/artifact-registry`):**
   - W3C `traceparent` 5-boundary correlation (`web → api → temporal → worker → adapter`), CycloneDX 1.5 SBOM, dependency license scan, workspace secret scan, SLSA v1.0 provenance attestation, signed artifact verification, and rehearsed rollback.

---

## 2. Explicitly Gated / Blocked Capabilities on Current Workstation

| Capability | Current Gate Status | Evidence & Unblock Requirement |
|---|---|---|
| **FL Studio 2025 `session_mutation` & `render`** | **BLOCKED (`DOMAIN_DAW_CAPABILITY_UNQUALIFIED`)** | Blocked per [ADR-0009](./docs/adr/0009-fl-studio-2025-qualification-layer.md) & `INV-04` to prevent binary `.flp` corruption or ASIO/modal contention from a background service. |
| **Native `.vst3` Binary (`AetherForgeProcessor.vst3`)** | **BLOCKED (`BLOCKED_MISSING_PREREQUISITES`)** | C++20 source ([plugins/vst3/AetherForgeProcessor/AetherForgeProcessor.h](./plugins/vst3/AetherForgeProcessor/AetherForgeProcessor.h)) and static zero-I/O audit pass; native compilation requires installing MSVC `cl.exe` / `clang++`, `JUCE_SOURCE_DIR`, `VST3_SDK_DIR`, and `pluginval`. |
| **Native `.NET 8` MSIX & Rust `.exe` Compilation** | **BLOCKED ON HOST TOOLCHAIN** | [AetherForge.WindowsWorker.csproj](./workers/windows-host/AetherForge.WindowsWorker.csproj) and [workers/audio-engine/Cargo.toml](./workers/audio-engine/Cargo.toml) exist; host compilation requires installing `.NET 8 SDK` and `rustup`/`cargo`. |
| **Live External LLM Provider Endpoints** | **GATED (`DOMAIN_PROVIDER_NOT_CONFIGURED`)** | `openai`, `anthropic`, `google`, and `self-hosted-openai-compat` remain disabled until cloud secret manager API keys and vendor data-residency approval are supplied. |

---

## 3. Explicit Non-Goals (Out of Scope for v1.0)

- Inbound remote-desktop or unconstrained shell control of customer workstations.
- Exposing provider API keys in browser clients or local worker processes.
- Unqualified DAW adapters (Ableton Live, Cubase, Reaper, Pro Tools, Logic Pro) or macOS/Linux local workers.
- Real-time multi-user collaborative editing or cloud GPU audio rendering by default.
