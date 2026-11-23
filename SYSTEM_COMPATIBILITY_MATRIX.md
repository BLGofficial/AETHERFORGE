# AETHER FORGE — SYSTEM COMPATIBILITY MATRIX (`SYSTEM_COMPATIBILITY_MATRIX.md`)

- **Version:** `1.0.0`
- **Verified Workstation OS:** Windows 11 AMD64 (`10.0.26300.0`)

| Component / External Target | Verified Version / Path | Compatibility Status | Operational Verification Scope | External Prerequisite Required? |
| :--- | :--- | :--- | :--- | :--- |
| **Node.js Runtime** | `v26.13.0` (`--experimental-strip-types`) | `VERIFIED_COMPATIBLE` | All 25 TypeScript suites, HTTP servers, CLI scripts | None |
| **Package Manager (`pnpm`)** | `10.30.3` (via `pnpm.cmd`) | `VERIFIED_COMPATIBLE` | 26-package workspace resolution & test runner | Use `pnpm.cmd` under restricted PowerShell ExecutionPolicy |
| **TypeScript / Zod / Vitest** | `5.8.2` / `3.24.2` / `3.2.7` | `VERIFIED_COMPATIBLE` | Strict `noEmit` typecheck (`exactOptionalPropertyTypes: true`), zero `any` | None |
| **Windows Framework64 C# Compiler** | `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe` | `VERIFIED_COMPATIBLE` | Compiled x64 `AetherForge.WindowsWorker.exe` (`6,144` bytes) with live DPAPI + NTFS ReparsePoint blocking | None (native Windows component) |
| **Python Runtime** | `Python 3.14` (`C:\Python314\python.exe`) | `VERIFIED_COMPATIBLE` | Compiled & executed FL Studio 2025 read-only controller script | None |
| **Image-Line FL Studio 2025** | `25.1.6.4997` (`C:\Program Files\Image-Line\FL Studio 2025\FL64.exe`, SHA-256 `273ECDC1C2421628`) | `VERIFIED_COMPATIBLE` | Read-only `.flp` (`FLhd`/`FLdt` + `0xC7`) parsing on `NewStuff.flp` & `Breakbeat.flp`, Python MIDI Controller Scripting | Direct `.flp` mutation intentionally forbidden (`ADR-0009`) |
| **Cockos REAPER Adapter** | `7.x` (`ReaperRppDomainAdapter`) | `CONTRACT_VERIFIED` | Read-only `<REAPER_PROJECT>` parser & capability negotiation | Live host installation optional |
| **CMake** | `4.4.1` (`C:\Program Files\CMake\bin\cmake.exe`) | `VERIFIED_PRESENT` | CMake configuration ready | Requires C++20 compiler (`cl.exe`/`clang++`) |
| **Native VST3 Binary Build (`cl.exe` + JUCE 8 + VST3 SDK + `pluginval`)** | Not installed on workstation | `BLOCKED_MISSING_PREREQUISITES` | C++20 source static audit & TypeScript host torture harness pass 100%; native `.vst3` DLL link blocked | Install Visual Studio Build Tools (`cl.exe`), `C:\JUCE`, `C:\VST_SDK`, `pluginval.exe` |
| **Rust Native Audio Crate (`cargo`/`rustc`)** | Not installed on workstation | `BLOCKED_MISSING_PREREQUISITES` | `workers/audio-engine/src/lib.rs` authored; TypeScript 64-bit float engine verified | Install `rustup` / `cargo` for native Rust binary build |
| **Production Cloud Backing Services (PostgreSQL 16 + pgvector, Temporal Cluster, OPA Daemon, Cloud KMS/Vault)** | Terraform & K8s manifests authored in `infra/` | `DEPLOYMENT_PROVISIONING_REQUIRED` | Local/in-process deterministic stores and SQL migrations verified | Provision staging/prod cluster via `infra/terraform/` & `infra/kubernetes/` |
