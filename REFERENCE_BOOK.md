# AETHER FORGE — Persistent Engineering Reference Book

**Version:** 1.0.0  
**Date:** 2026-11-23  
**Status:** Canonical Living Engineering Reference (`v1.0.0-rc1`)  
**Companion Index:** [REFERENCE-BOOK.md](./REFERENCE-BOOK.md) (synchronized Blueprint v1.0 index)  
**Cross-References:** [PROJECT_CHARTER.md](./PROJECT_CHARTER.md) · [SYSTEM_VISION.md](./SYSTEM_VISION.md) · [SCOPE.md](./SCOPE.md) · [ENGINEERING_PRINCIPLES.md](./ENGINEERING_PRINCIPLES.md) · [GOVERNANCE.md](./GOVERNANCE.md) · [MASTER_ROADMAP.md](./MASTER_ROADMAP.md) · [PRD.md](./PRD.md) · [SRS.md](./SRS.md) · [CAPABILITY_MATRIX.md](./CAPABILITY_MATRIX.md) · [REQUIREMENTS_TRACEABILITY.md](./REQUIREMENTS_TRACEABILITY.md) · [ACCEPTANCE_CRITERIA.md](./ACCEPTANCE_CRITERIA.md)

---

## 1. Verified Development Environment & Discovered Constraints

Direct empirical inspection of the Windows 11 workstation (`C:\Users\blago\Desktop\AETHERFORGE`) established:

| Resource / Toolchain | Verified Status | Exact Evidence / Constraint |
|---|---|---|
| **Operating System** | Windows 11 x64 (`10.0.26200+`) | PowerShell 5.1 (`.ps1` execution policy disabled; invoke `.cmd` shims or `node`) |
| **Node.js & Package Manager** | Node.js `v26.13.0` · `pnpm.cmd` `10.30.3` · `npm.cmd` `11.14.1` | Supports native `--experimental-strip-types` TypeScript execution |
| **Git VCS** | Initialized (`main` branch) | Commits `ff90ec0`, `ec592cd`, `9948308` verified clean |
| **FL Studio 2025 (Target DAW)** | **INSTALLED (`25.1.6.4997`)** | `C:\Program Files\Image-Line\FL Studio 2025\FL64.exe` (`1,120,112` bytes, SHA-256 `273ECDC1C2421628`) & `FLEngine_x64.dll` (`63,013,744` bytes, SHA-256 `7753BB8B16752F0B`) |
| **FL Studio 2026 (Co-installed)** | **INSTALLED (`26.1.1.5547`)** | `C:\Program Files\Image-Line\FL Studio 2026\FL64.exe` + factory `.flp` projects (`NewStuff.flp`, `Breakbeat.flp`) |
| **CMake** | **INSTALLED** | `C:\Program Files\CMake\bin\cmake.exe` |
| **C++20 Compiler (`cl.exe` / `clang++` / `g++`)** | **ABSENT (Constraint)** | Blocks native `.vst3` binary compile on this host until MSVC BuildTools or LLVM is installed |
| **JUCE 8.x & Steinberg VST3 SDKs & `pluginval`** | **ABSENT (Constraint)** | `C:\JUCE`, `C:\VST_SDK`, and `pluginval.exe` not present; native `.vst3` target marked `BLOCKED_MISSING_PREREQUISITES` |
| **.NET 8 SDK (`dotnet`) / Native C# (`csc.exe`)** | **`csc.exe` INSTALLED & VERIFIED; `.NET 8 SDK` ABSENT** | Compiled `artifacts/native/AetherForge.WindowsWorker.exe` via `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe` with live Windows DPAPI & `FileAttributes.ReparsePoint` verification (`phase13-native-compilation.test.ts`) |
| **Python 3.14 (FL Studio Scripting Runtime)** | **INSTALLED (`C:\Python314\python.exe`)** | Verified `adapters/fl-studio-2025/scripts/device_aetherforge_inspect.py` read-only controller script |
| **Rust Toolchain (`cargo` / `rustc`)** | **ABSENT (Constraint)** | Not installed (`no cargo/rustc`); `workers/audio-engine/src/lib.rs` includes `gain_normalize_pcm16_wav` and `#[cfg(test)]` suite |

---

## 2. Monorepo Package & Module Ownership Registry (26 Workspace Projects)

| Package / Path | Domain | Responsibility | Verification Suite |
|---|---|---|---|
| `@aether-forge/contracts` (`contracts/`) | DOM-09 | Versioned Zod v1.0.0 schemas, `computeCanonicalPlanHash`, JSON Schema & OpenAPI 3.1 generator | `contracts/tests/compatibility/compatibility.test.ts` |
| `@aether-forge/api` (`apps/api/`) | DOM-01 / DOM-08 | OIDC seam, tenant-before-data 404 isolation, idempotency middleware, approval state machine, Emergency Stop | `tests/security/src/phase02-governance.test.ts` |
| `@aether-forge/web` (`apps/web/`) | DOM-08 | 4-screen HTML Control Plane UI + OpenAPI 3.1 JSON REST server + `pnpm dev` runner (`:4100`) | `tests/e2e/src/phase04-vertical-slice.test.ts`, `tests/contract/src/api-boundaries.test.ts` |
| `@aether-forge/audit` (`services/audit/`) | DOM-01 | Immutable append-only `AuditEvent` store & correlation trace reconstruction | `tests/security/src/phase02-governance.test.ts` |
| `@aether-forge/policy` (`services/policy/`) | DOM-01 | Signed OPA Rego v1 bundle (`governance.rego`) & fail-closed `OpaPolicyDecisionPoint` | `tests/security/src/phase03-policy-approvals.test.ts` |
| `@aether-forge/orchestration` (`services/orchestration/`) | DOM-03 | `DurableTemporalOrchestrator`, deterministic replay, activity retries, at-most-once ledger | `tests/e2e/src/phase04-vertical-slice.test.ts` |
| `@aether-forge/provider-gateway` (`services/provider-gateway/`) | DOM-02 | Prompt SHA-256 registry, pre-egress redaction fence, quotas, `ToolManifestRegistry`, `BoundedExecutionPlanner` | `tests/security/src/phase05-provider-planner.test.ts` |
| `@aether-forge/knowledge` (`services/knowledge/`) | DOM-09 | Postgres 16 + `pgvector` migration, immutable object store, chunk provenance citations, deletion & quarantine | `tests/security/src/phase07-knowledge-substrate.test.ts` |
| `@aether-forge/artifact-registry` (`services/artifact-registry/`) | DOM-10 | CycloneDX 1.5 SBOM, license & secret scanner, SLSA v1.0 provenance, signed artifact verification & rollback | `tests/security/src/phase11-observability-abuse.test.ts` |
| `@aether-forge/windows-host` (`workers/windows-host/`) | DOM-03 / DOM-07 | DPAPI identity store, outbound mTLS session, signed `JobManifest` verification, local job dispatch (+ `.NET 8` `.csproj`) | `tests/security/src/phase06-windows-worker.test.ts` |
| `@aether-forge/audio-engine` (`workers/audio-engine/`) | DOM-04 / DOM-07 | Offline PCM16 RIFF/WAVE inspection & `<0.01 dB` gain normalization (+ Rust `Cargo.toml`/`lib.rs`) | `tests/security/src/phase08-audio-engine.test.ts` |
| `@aether-forge/filesystem` (`adapters/filesystem/`) | DOM-03 | Canonical root confinement, NTFS junction/symlink detection, TOCTOU hash check, atomic `.tmp-*` write | `tests/security/src/phase06-windows-worker.test.ts` |
| `@aether-forge/git` (`adapters/git/`) | DOM-09 | Constrained Git workspace canonical path verifier | `tests/security/src/phase09-fl-studio-2025.test.ts` |
| `@aether-forge/daw-contract` (`adapters/daw-contract/`) | DOM-06 | Tiered DAW capability discovery & execution proof contract | `tests/security/src/phase09-fl-studio-2025.test.ts` |
| `@aether-forge/fl-studio-2025` (`adapters/fl-studio-2025/`) | DOM-06 | Empirically qualified FL Studio 2025 (`25.1.6.4997`) `.flp` (`FLhd`/`FLdt` + `0xC7`) `inspect` & `non_destructive_edit` | `tests/security/src/phase09-fl-studio-2025.test.ts` |
| `@aether-forge/vst3` (`plugins/vst3/`) | DOM-05 / DOM-07 | C++20 real-time processor (`AetherForgeProcessor.h/.cpp`), CMake build, static zero-I/O audit, 16-byte POD state round-trip | `tests/security/src/phase10-vst3-boundary.test.ts` |
| `@aether-forge/observability` (`packages/observability/`) | DOM-09 / DOM-10 | W3C `traceparent` 5-boundary span collector, alert engine, end-to-end job dashboard correlator | `tests/security/src/phase11-observability-abuse.test.ts` |
| `@aether-forge/sdk`, `@aether-forge/config`, `@aether-forge/ui`, `@aether-forge/test-fixtures` | DOM-08 / DOM-10 | Shared client SDK, environment config schema, UI helpers, and canonical test fixtures | `tests/contract/src/api-boundaries.test.ts` |

---

## 3. Core Invariants (`INV-01`..`INV-05`) & ADR Cross-Reference

1. **INV-01 ([ADR-0002](./docs/adr/0002-controlled-autonomy-policy-engine.md)):** No side effect without `requestId`, `traceId`, `idempotencyKey`, policy evaluation result (`policyVersion`), and immutable `AuditEvent`.
2. **INV-02 ([ADR-0001](./docs/adr/0001-hybrid-control-plane.md), [ADR-0010](./docs/adr/0010-release-integrity.md)):** No local job without enrolled worker identity, signed `JobManifest`, scoped `CapabilityGrant`, and valid expiry.
3. **INV-03 ([ADR-0002](./docs/adr/0002-controlled-autonomy-policy-engine.md)):** No approved action survives a `planHash` or `policyVersion` change.
4. **INV-04 ([ADR-0009](./docs/adr/0009-fl-studio-2025-qualification-layer.md)):** No claim of DAW capability without empirical qualification evidence for its exact version and capability tier ([docs/daws/fl-studio-2025-qualification.md](./docs/daws/fl-studio-2025-qualification.md)).
5. **INV-05 ([ADR-0010](./docs/adr/0010-release-integrity.md)):** No release artifact without CycloneDX SBOM, cryptographic signature, SLSA v1.0 provenance attestation, and passing test evidence ([RELEASE-CANDIDATE-v1.0.0-rc1.md](./RELEASE-CANDIDATE-v1.0.0-rc1.md)).

---

## 4. Product & Requirements Engineering Baseline Index

- **Product Requirements Document ([PRD.md](./PRD.md)):** Product capabilities, 5 personas (`Owner`, `Builder`, `Reviewer`, `ReleaseManager`, `WorkerOperator`), 6 project categories (`CAT-01`..`CAT-06`), 6 engineering workflows (`WF-01`..`WF-06`), and 4 deterministic agent autonomy levels (`Level 0`..`Level 3`).
- **Software Requirements Specification ([SRS.md](./SRS.md)):** Trust boundaries (`TB-1`..`TB-7`), operational constraints (`CON-01`..`CON-04`), 20 measurable functional requirements (`REQ-F-0001`..`REQ-F-0020`), and 14 measurable non-functional requirements (`REQ-NF-0001`..`REQ-NF-0014`).
- **Capability Matrix ([CAPABILITY_MATRIX.md](./CAPABILITY_MATRIX.md)):** 4-column matrix mapping Native Platform Capabilities, External Tool Capabilities, Human-Approval-Gated Capabilities, and Unsupported/Blocked Capabilities across all 11 capability areas.
- **Requirements Traceability Matrix ([REQUIREMENTS_TRACEABILITY.md](./REQUIREMENTS_TRACEABILITY.md)):** 100% bidirectional traceability mapping `REQ-F-0001..0020` and `REQ-NF-0001..0014` to governing ADRs/invariants, implementing packages/files, Zod contract schemas, and automated test suites.
- **Acceptance Criteria Ledger ([ACCEPTANCE_CRITERIA.md](./ACCEPTANCE_CRITERIA.md)):** Given/When/Then acceptance criteria (`AC-F-0001`..`AC-F-0020`, `AC-NF-0001`..`AC-NF-0014`) verified across `17` test suites (`52/52` passing tests).
