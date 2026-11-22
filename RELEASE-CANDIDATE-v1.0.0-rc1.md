# AETHER FORGE — Release Candidate Dossier (`v1.0.0-rc1`)

**Version:** `1.0.0` (Promoted from `1.0.0-rc1` via Dual-Control `Reviewer` + `ReleaseManager` Gate in Phase 15)  
**Date:** 2026-11-23  
**Disposition:** **APPROVED PRODUCTION RELEASE `v1.0.0` FOR QUALIFIED SCOPE** (Native Windows Worker `.exe` DPAPI/ReparsePoint verified; unqualified DAW tiers and external C++20/Rust/.NET 8 SDK binary targets remain explicitly gated per `INV-04` and `INV-05`)  
**Cross-References:** [CHANGELOG.md](./CHANGELOG.md) · [GOVERNANCE.md](./GOVERNANCE.md) · [REFERENCE-BOOK.md](./REFERENCE-BOOK.md) · [Runbooks](./docs/operations/runbooks.md)

---

## 1. Release Candidate & Production Attestation Artifacts

Generated deterministically via `pnpm build` (`scripts/generate-release-candidate.ts` & `scripts/verify-native-toolchains.ts`):

- **Production `v1.0.0` Signed Attestation:** [artifacts/release-v1.0.0/release-attestation.json](./artifacts/release-v1.0.0/release-attestation.json)
- **Production `v1.0.0` CycloneDX 1.5 SBOM & SLSA v1.0 Provenance:** [artifacts/release-v1.0.0/sbom.cdx.json](./artifacts/release-v1.0.0/sbom.cdx.json), [artifacts/release-v1.0.0/provenance.intoto.json](./artifacts/release-v1.0.0/provenance.intoto.json)
- **Compiled Native Windows x64 Worker Executable:** [artifacts/native/AetherForge.WindowsWorker.exe](./artifacts/native/AetherForge.WindowsWorker.exe) ([native-worker-receipt.json](./artifacts/native/native-worker-receipt.json))
- **CycloneDX 1.5 SBOM (`v1.0.0-rc1`):** [artifacts/release-v1.0.0-rc1/sbom.cdx.json](./artifacts/release-v1.0.0-rc1/sbom.cdx.json)
- **SLSA v1.0 Provenance Attestation:** [artifacts/release-v1.0.0-rc1/provenance.intoto.json](./artifacts/release-v1.0.0-rc1/provenance.intoto.json)
- **Signed Release Attestation & Rollback Rehearsal Receipt:** [artifacts/release-v1.0.0-rc1/release-attestation.json](./artifacts/release-v1.0.0-rc1/release-attestation.json)
- **Contract Schemas:** [contracts/generated/json-schema.json](./contracts/generated/json-schema.json), [contracts/generated/openapi.json](./contracts/generated/openapi.json)

---

## 2. Included & Empirically Qualified Capabilities

1. **Governed Control Loop (`Brief → Spec → Plan → OPA Policy → Approval → Temporal → Windows Worker → Evidence/Audit → Web UI`):** Verified end-to-end in [tests/e2e/src/phase12-release-candidate.test.ts](./tests/e2e/src/phase12-release-candidate.test.ts).
2. **Multi-Tenant Security & Approval Drift Protection (`INV-01`..`INV-03`):** OIDC authentication seam, tenant-before-data isolation (`404 NOT_FOUND`), idempotency deduplication, OPA Rego v1 policy evaluation, `planHash` + `policyVersion` + `canonicalPathScope` binding, and hardware-fast Emergency Stop (`423 Locked`).
3. **Provider Gateway & Bounded Planner:** Pre-egress secret/classification redaction fence, prompt template SHA-256 verification, token/cost quotas, and `ToolManifest`-bounded planning.
4. **Windows Worker Constrained Filesystem & Offline Audio Engine:** DPAPI-backed identity store, outbound mTLS session, signed `JobManifest` verification, traversal/NTFS junction/TOCTOU defenses, and deterministic 16-bit PCM WAV inspection & gain normalization (`<0.01 dB` tolerance, source immutability).
5. **FL Studio 2025 (`25.1.6.4997`) Qualified Tiers:** Read-only `inspect` (`FL64.exe`/`FLEngine_x64.dll` verification + `.flp` `FLhd`/`FLdt` header parsing) and `non_destructive_edit` (copy-on-write scratch session staging with mandatory `.bak` backup).

---

## 3. Explicitly Excluded / Blocked Capabilities (`INV-04`, `INV-05`)

| Capability / Target | Status in `v1.0.0-rc1` | Exact Reason / Missing Prerequisite |
|---|---|---|
| **FL Studio 2025 `session_mutation`** | **EXCLUDED / BLOCKED (`DOMAIN_DAW_CAPABILITY_UNQUALIFIED`)** | No official Image-Line headless `.flp` `FLdt` event-stream mutation SDK exists; unattended UI automation is prohibited by [ADR-0009](./docs/adr/0009-fl-studio-2025-qualification-layer.md). |
| **FL Studio 2025 `render`** | **EXCLUDED / BLOCKED (`DOMAIN_DAW_CAPABILITY_UNQUALIFIED`)** | Headless service-context CLI rendering requires isolated audio-driver/modal-dialog qualification not yet performed in Phase 09. |
| **Native `.vst3` Binary (`AetherForgeProcessor.vst3`)** | **BLOCKED (`BLOCKED_MISSING_PREREQUISITES`)** | C++20 real-time processor source and static zero-I/O audit pass, but workstation lacks `MSVC cl.exe / clang++`, `JUCE 8.x SDK (JUCE_SOURCE_DIR)`, `Steinberg VST3 SDK (VST3_SDK_DIR)`, and `pluginval`. |
| **Native `.NET 8` MSIX & Rust `.exe` Compilation** | **BLOCKED ON HOST TOOLCHAIN** | `.csproj` and `Cargo.toml`/`lib.rs` sources exist, but host workstation lacks `.NET 8 SDK` (`dotnet`) and `cargo`/`rustc`. |
| **Live External LLM Provider Endpoints** | **DISABLED BY DEFAULT (`DOMAIN_PROVIDER_NOT_CONFIGURED`)** | `openai`, `anthropic`, `google`, and `self-hosted-openai-compat` remain gated until cloud secret manager API keys and vendor data-residency sign-off are provisioned. |

---

## 4. Migration, Rollback Plan, and Staged Rollout

### Database & Schema Migration Plan
1. Apply PostgreSQL 16 + `pgvector` schema migration [services/knowledge/migrations/0001_knowledge_pgvector.sql](./services/knowledge/migrations/0001_knowledge_pgvector.sql).
2. Verify `@aether-forge/contracts` `schemaVersion: "1.0.0"` compatibility gate via `pnpm test`.
3. Load signed OPA bundle `opa-bundle-2026.11.22-v1` ([services/policy/bundles/v1/bundle-manifest.json](./services/policy/bundles/v1/bundle-manifest.json)).

### Rehearsed Rollback Plan
1. Rehearsed in `tests/e2e/src/phase12-release-candidate.test.ts` and `scripts/generate-release-candidate.ts`:
   - Revoking `1.0.0-rc1` via `SignedArtifactRegistry.revokeArtifactVersion("aetherforge-platform-release", "1.0.0-rc1")` and invoking `selectRollbackTarget` deterministically selects prior signed `0.9.0-baseline`.
   - Windows Worker refuses revoked manifests and drains in-flight jobs safely without partial files.

### Staged Rollout Plan
1. **Stage 0 (`dev` / CI — Active):** Automated contract, security, abuse-case, performance, and E2E suites against `fake-deterministic` provider and mock mTLS worker gateway.
2. **Stage 1 (`staging` — Next after native SDK provisioning):** Provision `.NET 8 SDK`, `Rust toolchain`, `JUCE 8 + VST3 SDK + pluginval`, and staging OIDC IdP; run full hardware-in-the-loop FL Studio 2025 `inspect` and `non_destructive_edit` canary.
3. **Stage 2 (`production` — Gate):** Requires explicit human **Release Manager** approval after Stage 1 soak and security sign-off ([docs/operations/runbooks.md](./docs/operations/runbooks.md)).
