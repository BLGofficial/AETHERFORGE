# AETHER FORGE — PRODUCTION DEPLOYMENT GUIDE (`PRODUCTION_DEPLOYMENT_GUIDE.md`)

- **Version:** `1.0.0` | **Status:** `CONDITIONALLY READY` (pending `BLK-001..004` provisioning)

## 1. Target Topology & Infrastructure Provisioning
1. **Cloud Foundation (`infra/terraform/environments/staging/main.tf`):** Provision VPC-isolated PostgreSQL 16 (`pgvector` + Row-Level Security via `services/knowledge/migrations/0001_knowledge_pgvector.sql`), Temporal Server cluster (`infra/temporal/namespace-and-archival.yaml`), standalone OPA bundle server, and KMS/Vault secret store.
2. **Hardened Kubernetes Workload (`infra/kubernetes/control-plane-deployment.yaml`):**
   - Deploy `apps/api`, `apps/web`, `FRONTEND_APPLICATION`, `services/orchestration`, `services/provider-gateway`, and `services/knowledge` with `runAsNonRoot: true`, `readOnlyRootFilesystem: true`, `allowPrivilegeEscalation: false`, and `capabilities.drop: ["ALL"]`.
3. **Isolated Windows Native Worker Host (`workers/windows-host/`):**
   - Deploy signed `artifacts/native/AetherForge.WindowsWorker.exe` (`6,144` bytes) on dedicated Windows 11/Server x64 worker nodes bound to the workstation FL Studio 2025 (`25.1.6.4997`) or C++/VST3 build runner.
4. **Native C++20 / VST3 / Rust CI Build Runner (Resolves `BLK-001` & `BLK-003`):**
   - Provision Windows CI agent with Visual Studio Build Tools (`cl.exe`), CMake `4.4.1`, `C:\JUCE`, `C:\VST_SDK`, `pluginval.exe`, and `rustup`/`cargo`.
   - Build `plugins/vst3/CMakeLists.txt` and execute `pluginval.exe --strictness-level 10 --validate <AetherForge.vst3>`.

## 2. Dual-Control Production Promotion Gate (`ADR-0012`)
1. Run full CI verification (`pnpm.cmd build && pnpm.cmd test` — 25/25 suites, 80/80 tests).
2. Generate release candidate bundle (`pnpm.cmd rc:generate`) producing `sbom.cdx.json`, `provenance.intoto.json`, and `release-attestation.json`.
3. Execute 5/5 canary soak verification (`phase15-production-promotion.test.ts`).
4. Obtain independent sign-offs from two distinct principals (`Reviewer !== ReleaseManager`) before promoting `v1.0.0-rc1` → `v1.0.0`.
