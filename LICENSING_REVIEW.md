# AETHER FORGE — Licensing & Intellectual Property Compliance Review

**Version:** 1.0.0  
**Date:** 2026-11-23  
**Status:** Verified License Compliance Ledger (`v1.0.0`)  
**Cross-References:** [TECHNICAL_RESEARCH.md](./TECHNICAL_RESEARCH.md) · [DEPENDENCY_REGISTER.md](./DEPENDENCY_REGISTER.md) · [TECHNOLOGY_DECISIONS.md](./TECHNOLOGY_DECISIONS.md) · [artifacts/release-v1.0.0/sbom.cdx.json](./artifacts/release-v1.0.0/sbom.cdx.json)

---

## 1. Automated SBOM License Gate Summary (`REQ-NF-0012`)

`generateCycloneDxSbom` in `@aether-forge/artifact-registry` ([services/artifact-registry/src/index.ts](./services/artifact-registry/src/index.ts)) enforces an allowlist of permissive open-source licenses (`MIT`, `Apache-2.0`, `ISC`, `BSD-3-Clause`, `0BSD`) across all bundled workspace dependencies:
- **Verified Status (`[VERIFIED FACT]`):** `licenseCompliant: true`, `unapprovedPackages: []` (`0` copyleft or unapproved packages in the TypeScript/Node control plane and worker runtime).

---

## 2. Component & SDK Licensing Matrix

| Component / SDK | License Type | Redistribution & Commercial Implications | Mandatory Compliance Action in AETHER FORGE |
|---|---|---|---|
| **Active NPM Dependencies (`zod`, `vitest`, `@types/node`)** | `MIT` | Permissive; allows commercial and proprietary use, modification, and distribution with copyright notice preservation. | Retain license notices in CycloneDX 1.5 SBOM ([artifacts/release-v1.0.0/sbom.cdx.json](./artifacts/release-v1.0.0/sbom.cdx.json)). |
| **TypeScript Compiler (`typescript`)** | `Apache-2.0` | Permissive with explicit patent grant; build-time dev dependency only. | Retain in SBOM; not redistributed in binary worker outputs. |
| **Node.js Runtime (`v26.13.0`) & `.NET Framework / .NET 8` Runtime** | `MIT` (Node.js / .NET Runtime) | Permissive runtime execution and commercial deployment. | Standard OS/container runtime attribution. |
| **Open Policy Agent (OPA / Rego)** | `Apache-2.0` | Permissive; signed Rego policy bundles (`governance.rego`) are proprietary to AETHER FORGE. | None beyond standard Apache-2.0 notice if embedding OPA binary. |
| **Temporal Server & TypeScript SDK** | `MIT` | Permissive; both Temporal SDK and Temporal Server (MIT) allow self-hosted or Temporal Cloud commercial use. | None beyond standard MIT notice. |
| **PostgreSQL 16 & `pgvector`** | `PostgreSQL License` (BSD/MIT-like) | Permissive open-source license; zero copyleft restrictions on schema migrations or stored data. | None. |
| **JUCE 8 Framework (`plugins/vst3/CMakeLists.txt`)** | **Dual License:** `AGPLv3` **or** `JUCE Commercial / Indie / Pro License` | **CRITICAL GATE:** Linking against JUCE 8 under `AGPLv3` requires releasing the entire VST3 plugin source code under AGPLv3 if distributed. Commercial closed-source distribution requires an active paid JUCE seat per developer. |1. Keep `AetherForgeRealtimeCore` ([AetherForgeProcessor.h](./plugins/vst3/AetherForgeProcessor/AetherForgeProcessor.h)) pure standard C++20 with zero JUCE headers so core DSP IP remains 100% unencumbered.<br>2. Block native `.vst3` binary packaging (`BLOCKED_MISSING_PREREQUISITES`) until JUCE license tier (Commercial vs. AGPLv3) is formally recorded by `Owner` + `ReleaseManager`. |
| **Steinberg VST3 SDK (`VST3_SDK_DIR`)** | **Dual License:** `GPLv3` **or** `Proprietary Steinberg VST3 License Agreement` | **CRITICAL GATE:** Distributing a proprietary `.vst3` binary requires executing the free-of-charge **Steinberg VST3 License Agreement** and displaying the required Steinberg VST3 trademark notice/logo in documentation and plugin About box. | Do not distribute compiled `.vst3` binaries until the countersigned Steinberg VST3 License Agreement is archived in the release dossier. |
| **Image-Line FL Studio 2025 (`25.1.6.4997`)** | **Proprietary Commercial EULA (Customer-Licensed)** | FL Studio binaries (`FL64.exe`, `FLEngine_x64.dll`) are proprietary to Image-Line and licensed to the end user. Reverse-engineering or patching proprietary binary executables violates the EULA. | 1. **Never redistribute** Image-Line binaries or DLLs.<br>2. Operate strictly on customer-installed licenses (`C:\Program Files\Image-Line\FL Studio 2025`) via documented `.flp` chunk inspection and official Python MIDI controller scripting (`device_aetherforge_inspect.py`). |
| **Rust Audio Crates (Planned Native Sidecar: `symphonia`, `rubato`, `realfft`)** | `MPL-2.0` (`symphonia`) / `MIT` (`rubato`, `realfft`) | `MIT` is permissive; `MPL-2.0` (file-level weak copyleft) permits static/dynamic linking in proprietary binaries provided any modifications to `symphonia`'s own source files are shared. Current `workers/audio-engine/src/lib.rs` uses **zero external crates** (100% Rust `std`). | Prefer zero-crate Rust `std` for PCM16 WAV operations (`workers/audio-engine/src/lib.rs`); if `symphonia` is added for multi-codec decoding, keep it as an unmodified Cargo dependency. |
