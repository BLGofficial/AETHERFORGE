# AETHER FORGE — Dependency & Toolchain Register

**Version:** 1.0.0  
**Date:** 2026-11-23  
**Status:** Verified Dependency & Host Toolchain Inventory (`v1.0.0`)  
**Cross-References:** [TECHNICAL_RESEARCH.md](./TECHNICAL_RESEARCH.md) · [TECHNOLOGY_COMPARISON.md](./TECHNOLOGY_COMPARISON.md) · [LICENSING_REVIEW.md](./LICENSING_REVIEW.md) · [TECHNOLOGY_DECISIONS.md](./TECHNOLOGY_DECISIONS.md) · [artifacts/release-v1.0.0/sbom.cdx.json](./artifacts/release-v1.0.0/sbom.cdx.json)

---

## 1. Direct NPM Workspace Dependencies (`package.json` & `pnpm-lock.yaml`)

Following the Chisle efficiency ladder (*Stdlib first → zero unnecessary dependencies*), the entire 26-package AETHER FORGE monorepo uses **only 1 runtime dependency (`zod`)** and **3 development dependencies (`typescript`, `vitest`, `@types/node`)**, keeping supply-chain attack surface minimal.

| Package Name | Pinned Range (`package.json`) | Resolved Version (`pnpm-lock.yaml`) | Scope | PURL (`sbom.cdx.json`) | License | Owning Workspace Packages | Purpose |
|---|---|---|---|---|---|---|---|
| `zod` | `^3.24.2` | `3.25.76` | Runtime & Dev | `pkg:npm/zod@3.24.2` | `MIT` | `@aether-forge/contracts`, `@aether-forge/provider-gateway`, `@aether-forge/config` | Runtime contract validation at every trust boundary ([ADR-0004](./docs/adr/0004-typed-protocol-first.md)) |
| `typescript` | `^5.8.2` | `5.9.3` | Dev / Build | `pkg:npm/typescript@5.8.2` | `Apache-2.0` | Root workspace (`tsconfig.base.json`) | Strict static typechecking (`noImplicitAny`, `exactOptionalPropertyTypes`) |
| `vitest` | `^3.0.8` | `3.2.7` | Dev / Test | `pkg:npm/vitest@3.0.8` | `MIT` | Root workspace (`tests/*`, `contracts/tests/*`) | Execution of 17 contract, security, abuse, E2E, and performance test suites |
| `@types/node` | `^22.13.0` | `22.20.5` | Dev / Types | `pkg:npm/%40types/node@22.13.0` | `MIT` | Root workspace | Type definitions for Node.js stdlib (`node:crypto`, `node:fs`, `node:http`, `node:child_process`) |

---

## 2. Node.js Standard Library Modules Used (Zero-Dependency Core)

| Stdlib Module | Replacing External Package | Security / Engineering Role |
|---|---|---|
| `node:crypto` (`createHash`, `createHmac`, `createCipheriv`, `timingSafeEqual`, `randomBytes`) | `jsonwebtoken`, `bcrypt`, `crypto-js`, `uuid` | Canonical SHA-256 plan/artifact/chunk hashing, constant-time HMAC signature verification, AES-256-GCM keystore encryption |
| `node:fs` (`openSync`, `fsyncSync`, `renameSync`, `lstatSync`, `realpathSync.native`) | `fs-extra`, `graceful-fs`, `tmp` | Atomic `.tmp-*` workspace & WAV writes, NTFS junction/symlink detection, TOCTOU prior-hash checks |
| `node:http` (`createServer`) | `express`, `fastify`, `koa` | Zero-dependency Web Control Plane HTML UI server + OpenAPI 3.1 JSON REST server (`apps/web/src/server.ts`) |
| `node:child_process` (`execFileSync`) | `execa`, `cross-spawn` | Argument-array-isolated invocation of `csc.exe`, `AetherForge.WindowsWorker.exe`, and `python.exe` (immune to shell injection) |

---

## 3. Verified Host Toolchains & External Target Dependencies

| Toolchain / SDK | Version / Target | Host Presence (`verified_facts`) | Exact Path / Identifier | Status & Gate |
|---|---|---|---|---|
| **Node.js Runtime** | `v26.13.0` (Engine `>=22.0.0`) | **INSTALLED** | `C:\Program Files\nodejs\node.exe` | Active (`--experimental-strip-types`) |
| **pnpm Package Manager** | `10.30.3` | **INSTALLED** | `pnpm.cmd` | Active (`packageManager: pnpm@10.30.3`) |
| **Git VCS** | `2.54.0.windows.1` | **INSTALLED** | `git.exe` | Active (`main` branch, tag `v1.0.0`) |
| **Windows Native C# Compiler (`csc.exe`)** | `.NET Framework 4.8 x64` + `System.Security.dll` | **INSTALLED** | `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe` | Active — compiles `artifacts/native/AetherForge.WindowsWorker.exe` with live Windows DPAPI & `ReparsePoint` checks |
| **Python Runtime** | `3.14` | **INSTALLED** | `C:\Python314\python.exe` | Active — verifies `adapters/fl-studio-2025/scripts/device_aetherforge_inspect.py` |
| **CMake Build Generator** | `4.4.1` (`>=3.24` required) | **INSTALLED** | `C:\Program Files\CMake\bin\cmake.exe` | Active for `plugins/vst3/CMakeLists.txt` |
| **FL Studio 2025 (Production DAW Target)** | `25.1.6.4997` | **INSTALLED** | `C:\Program Files\Image-Line\FL Studio 2025\FL64.exe` & `FLEngine_x64.dll` | Active — qualified for `inspect` and `non_destructive_edit` |
| **.NET 8 SDK (`dotnet`)** | `net8.0-windows` (`System.Security.Cryptography.ProtectedData 8.0.0`) | **ABSENT ON HOST** | `workers/windows-host/AetherForge.WindowsWorker.csproj` | Gated on `package_install` approval (`winget install Microsoft.DotNet.SDK.8`) |
| **Rust Toolchain (`cargo` / `rustc`)** | Edition `2021` (`aetherforge-audio-engine 1.0.0`) | **ABSENT ON HOST** | `workers/audio-engine/Cargo.toml` | Gated on `package_install` approval (`winget install Rustlang.Rustup`) |
| **C++20 Compiler (`cl.exe` / `clang++`)** | ISO C++20 | **ABSENT ON HOST** | `plugins/vst3/AetherForgeProcessor/` | Gated on `package_install` approval (`winget install LLVM.LLVM` or MSVC BuildTools) |
| **JUCE 8.x & Steinberg VST3 SDK & `pluginval`** | JUCE `8.x`, VST3 SDK `3.7.x`, `pluginval` `1.0+` | **ABSENT ON HOST** | `JUCE_SOURCE_DIR`, `VST3_SDK_DIR`, `PLUGINVAL_EXE` | Marked `BLOCKED_MISSING_PREREQUISITES` until SDK paths and commercial/open-source licenses are provisioned |
