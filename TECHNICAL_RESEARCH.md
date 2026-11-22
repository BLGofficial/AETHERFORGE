# AETHER FORGE — Chief Technical Research Dossier

**Version:** 1.0.0  
**Date:** 2026-11-23  
**Status:** Verified Technical Foundation Baseline (`v1.0.0`)  
**Cross-References:** [TECHNOLOGY_COMPARISON.md](./TECHNOLOGY_COMPARISON.md) · [DEPENDENCY_REGISTER.md](./DEPENDENCY_REGISTER.md) · [LICENSING_REVIEW.md](./LICENSING_REVIEW.md) · [TECHNOLOGY_DECISIONS.md](./TECHNOLOGY_DECISIONS.md) · [REFERENCE_BOOK.md](./REFERENCE_BOOK.md) · [SRS.md](./SRS.md)

---

## 0. Epistemic Classification Standard

Per AETHER FORGE governance ([GOVERNANCE.md §5](./GOVERNANCE.md)), all technical research claims are tagged:
- **`[VERIFIED FACT]`**: Directly observed on the Windows 11 host (`C:\Users\blago\Desktop\AETHERFORGE`), in `pnpm-lock.yaml`, PE binary headers, or standard specification behavior verified by passing tests (`17` suites, `52/52` tests).
- **`[ENGINEERING RECOMMENDATION]`**: Architectural choice adopted for AETHER FORGE based on determinism, security boundary isolation, and YAGNI principles rather than framework popularity.
- **`[UNVERIFIED ASSUMPTION]`**: External vendor, commercial, or third-party SDK condition requiring empirical confirmation before production claims.

---

## 1. Domain-by-Domain Technical Research (13 Research Domains)

### Domain 1: AI Agent Frameworks and Orchestration
- **Authoritative Docs:** Anthropic Model Context Protocol & Tool Use Specifications; Temporal Deterministic Workflow Docs (`https://docs.temporal.io`); AETHER FORGE [ADR-0005](./docs/adr/0005-bounded-agent-roles.md).
- **Verified Capabilities & Versions:** `[VERIFIED FACT]` Implemented in `@aether-forge/provider-gateway` (`BoundedExecutionPlanner`, `ToolManifestRegistry`) on Node.js `v26.13.0` + Zod `3.25.76`.
- **Technical Limitations:** General-purpose third-party agent frameworks (LangChain, AutoGen, CrewAI) rely on unconstrained multi-turn loops, mutable hidden state, and dynamic code/tool dispatch that break deterministic plan hashing (`computeCanonicalPlanHash`) and complicate OPA policy binding.
- **Compatibility & Complexity:** Low complexity (`~200 LOC` in `services/provider-gateway/src/index.ts`), 100% compatible with TypeScript strict mode (`noImplicitAny`) and Temporal replay determinism.
- **Recommended Role:** `[ENGINEERING RECOMMENDATION]` Use a **zero-framework Bounded Planner + Registered `ToolManifest` DAG** (`BoundedExecutionPlanner`). Reject heavy wrapper frameworks; keep agent intelligence strictly as a schema-validated planner proposing steps for OPA + Temporal execution.

### Domain 2: LLM Provider Abstraction
- **Authoritative Docs:** OpenAI Structured Outputs API (`json_schema`), Anthropic Messages API (`tool_use`), Google Gemini Structured Outputs (`responseSchema`), OpenAI-compatible vLLM/Ollama specifications; [ADR-0006](./docs/adr/0006-provider-gateway-redaction-routing.md).
- **Verified Capabilities & Versions:** `[VERIFIED FACT]` `ProviderGatewayService`, `ServerSideSecretManager`, `PromptTemplateRegistry`, `TenantBudgetTracker`, and `ManagedVendorProviderAdapter` (`openai`, `anthropic`, `google`, `self-hosted-openai-compat`) are implemented and verified in `tests/security/src/phase05-provider-planner.test.ts` and `phase14-staging-providers.test.ts`.
- **Technical Limitations:** Vendor SDKs differ in streaming token usage reporting, retry headers, and JSON schema subset restrictions (e.g., recursive `$ref` limits). `[UNVERIFIED ASSUMPTION]` Live vendor commercial quotas and data-residency SLAs require enterprise agreement review prior to production traffic.
- **Recommended Role:** `[ENGINEERING RECOMMENDATION]` Route 100% of LLM calls through `@aether-forge/provider-gateway` behind the pre-egress redaction fence (`inspectAndRedactForEgress`), prompt SHA-256 registry, and server-side secret manager.

### Domain 3: MCP (Model Context Protocol) and Tool Execution
- **Authoritative Docs:** Model Context Protocol Specification (`https://modelcontextprotocol.io/specification`); CloudEvents 1.0 (`https://cloudevents.io`).
- **Verified Capabilities & Versions:** `[VERIFIED FACT]` All tools in AETHER FORGE are declared as typed `ToolManifest` entries (`toolId`, `version`, `actionClass`, `inputSchemaRef`, `outputSchemaRef`, `maxDurationMs`, `requiresLocalWorker`) validated by `ToolManifestSchema` in `contracts/src/tools/index.ts`.
- **Technical Limitations:** Direct MCP stdio/SSE tool execution from an LLM client bypasses durable workflow persistence and human approval unless mediated by a policy engine.
- **Recommended Role:** `[ENGINEERING RECOMMENDATION]` Treat MCP/tool schemas as **declarative `ToolManifest` descriptors** consumed by the Planner, while routing all actual side-effecting tool execution through `OPA Policy → Approval → Temporal → Signed WorkerJob`.

### Domain 4: Workflow Engines
- **Authoritative Docs:** Temporal TypeScript SDK Documentation (`https://docs.temporal.io/develop/typescript`); [ADR-0003](./docs/adr/0003-temporal-durable-orchestration.md).
- **Verified Capabilities & Versions:** `[VERIFIED FACT]` `DurableTemporalOrchestrator` (`@aether-forge/orchestration`) and `infra/temporal/namespace-and-archival.yaml` enforce deterministic event history (`WorkflowExecutionStarted`, `ActivityTaskCompleted`, `ActivityTaskRetried`, `WorkflowExecutionSignaled`, `WorkflowExecutionCompleted`, `WorkflowExecutionCancelled`), mid-wait worker restart replay, and at-most-once execution ledger (`executedStepLedger`).
- **Technical Limitations:** Workflow code must be strictly deterministic (no direct system clock, random number, or network I/O outside Activities); Temporal history payload size is capped (typically `2 MB` per event, `50 MB` per history).
- **Recommended Role:** `[ENGINEERING RECOMMENDATION]` Use Temporal for durable orchestration of approval waits, retries, and compensation; never pass raw audio buffers, `.flp` files, or secrets through Temporal history (`forbidRawLocalFileBytesInPayload: true`).

### Domain 5: Context Engineering and Persistent Memory
- **Authoritative Docs:** PostgreSQL 16 Documentation (`https://www.postgresql.org/docs/16/`); `pgvector` Extension (`https://github.com/pgvector/pgvector`); S3 Object Lock Specification; [ADR-0007](./docs/adr/0007-evidence-addressable-knowledge.md).
- **Verified Capabilities & Versions:** `[VERIFIED FACT]` Canonical SQL migration (`services/knowledge/migrations/0001_knowledge_pgvector.sql`), `EvidenceAddressableKnowledgeService`, and `ImmutableLocalObjectStore` enforce SHA-256 `contentHash`, line-range provenance citations (`<sourceId>#L<start>-L<end>`), `ON DELETE CASCADE` deletion propagation, and prompt-injection quarantine (`DOMAIN_KNOWLEDGE_INPUT_QUARANTINED`).
- **Technical Limitations:** Approximate nearest-neighbor vector indexes (HNSW / IVFFlat) can return semantically similar but outdated or cross-domain chunks if relational metadata filtering is not applied pre-filter.
- **Recommended Role:** `[ENGINEERING RECOMMENDATION]` Use **PostgreSQL 16 + `pgvector` + Immutable Object Store** as the single evidence-addressable knowledge substrate; require every retrieved chunk to carry `{ sourceId, contentHash, location, classification, extractionVersion }` and label uncited statements `model_inference`.

### Domain 6: Software Engineering Automation
- **Authoritative Docs:** Node.js `v26` TypeScript Strip-Types (`https://nodejs.org/api/typescript.html`), `pnpm` Workspaces (`https://pnpm.io/workspaces`), Turborepo (`https://turbo.build/repo/docs`), TypeScript `5.9` Compiler Options.
- **Verified Capabilities & Versions:** `[VERIFIED FACT]` Host runs Node.js `v26.13.0`, `pnpm` `10.30.3`, TypeScript `5.9.3`, Zod `3.25.76`. Full 26-package workspace typecheck (`tsc -p tsconfig.json --noEmit`) completes in `<1.5s`.
- **Technical Limitations:** Node `--experimental-strip-types` strips type annotations without emitting `.d.ts` files and requires explicit `.ts` import extensions + `"rewriteRelativeImportExtensions": true` in `tsconfig.base.json`.
- **Recommended Role:** `[ENGINEERING RECOMMENDATION]` Use `pnpm` workspaces + single-pass `tsc --noEmit` + Node v26 native strip-types for zero-transpile-overhead schema, SBOM, and RC artifact generation.

### Domain 7: C++ and CMake
- **Authoritative Docs:** ISO C++20 Standard (`ISO/IEC 14882:2020`); CMake 3.24+ Documentation (`https://cmake.org/cmake/help/latest/`); [ADR-0008](./docs/adr/0008-local-audio-engine-separate-from-vst3.md).
- **Verified Capabilities & Versions:** `[VERIFIED FACT]` CMake `4.4.1` is installed at `C:\Program Files\CMake\bin\cmake.exe`. C++20 real-time processor core is authored in [plugins/vst3/AetherForgeProcessor/AetherForgeProcessor.h](./plugins/vst3/AetherForgeProcessor/AetherForgeProcessor.h) and [plugins/vst3/CMakeLists.txt](./plugins/vst3/CMakeLists.txt). `[VERIFIED FACT]` Host currently lacks `cl.exe` (MSVC), `clang++.exe`, and `g++.exe`.
- **Technical Limitations:** C++20 standard library features like `std::filesystem`, `std::mutex`, exceptions, and dynamic allocations violate real-time audio thread determinism if used inside `processBlock`.
- **Recommended Role:** `[ENGINEERING RECOMMENDATION]` Enforce a strict real-time C++20 subset (`noexcept`, `std::atomic` lock-free primitives, fixed-size POD structs, `static_assert`) verified by static source scanning (`auditVst3RealtimeCppSources`) before CMake compilation.

### Domain 8: JUCE and Steinberg VST3 SDK
- **Authoritative Docs:** Steinberg VST 3 Developer Portal (`https://steinbergmedia.github.io/vst3_doc/`); JUCE 8 CMake API (`https://github.com/juce-framework/JUCE/blob/master/docs/CMake%20API.md`); `pluginval` (`https://github.com/Tracktion/pluginval`).
- **Verified Capabilities & Versions:** `[VERIFIED FACT]` `C:\Program Files\Common Files\VST3` exists on host; `C:\JUCE`, `C:\VST_SDK`, and `pluginval.exe` are currently absent on host (`discoverVst3BuildPrerequisites()` returns `BLOCKED_MISSING_PREREQUISITES`).
- **Technical Limitations & Licensing:** Both JUCE 8 (AGPLv3 / Commercial dual license) and Steinberg VST3 SDK (GPLv3 / Proprietary Steinberg VST3 License dual license) carry strict copyleft or commercial redistribution obligations (detailed in [LICENSING_REVIEW.md](./LICENSING_REVIEW.md)).
- **Recommended Role:** `[ENGINEERING RECOMMENDATION]` Keep `AetherForgeRealtimeCore` pure standard C++20 (zero JUCE/Steinberg header dependency in the DSP math core) and wrap it with JUCE `juce_add_plugin` in `plugins/vst3/CMakeLists.txt` only when commercial/open-source licensing and SDK paths are provisioned.

### Domain 9: DSP and Real-Time Audio Processing
- **Authoritative Docs:** RIFF/WAVE Audio File Format Specification (IBM/Microsoft PCM Format `0x0001`); Rust Audio Ecosystem (`symphonia`, `rubato`, `realfft`); EBU R 128 / ITU-R BS.1770 Peak & Loudness Standards; [ADR-0008](./docs/adr/0008-local-audio-engine-separate-from-vst3.md).
- **Verified Capabilities & Versions:** `[VERIFIED FACT]` `@aether-forge/audio-engine` ([workers/audio-engine/src/index.ts](./workers/audio-engine/src/index.ts)) and Rust crate [workers/audio-engine/src/lib.rs](./workers/audio-engine/src/lib.rs) implement bit-exact 16-bit linear PCM RIFF/WAVE header parsing, peak dBFS measurement (`20 * log10(maxAbs / 32767)`), and deterministic gain normalization within `<0.01 dB` tolerance, sharing golden vectors with `@aether-forge/vst3` (`<1e-5` linear error).
- **Technical Limitations:** Floating-point transcendental operations (`pow`, `log10`) can vary by `1 ULP` across CPU architectures/compilers if not clamped and rounded deterministically (`Math.round` + `[-32767, 32767]` clamp for PCM16).
- **Recommended Role:** `[ENGINEERING RECOMMENDATION]` Separate **offline batch DSP** (Rust / Node worker process with file quotas, atomic `.tmp-*` output, and cancellation) from **real-time in-DAW DSP** (lock-free C++20 VST3 audio callback), linked by shared golden vector tests.

### Domain 10: DAW APIs and Scripting (FL Studio 2025)
- **Authoritative Docs:** Image-Line FL Studio MIDI Controller Scripting API (`general`, `transport`, `channels`, `mixer`, `patterns`, `ui`); FLP Binary Format (`FLhd` 6-byte header chunk + `FLdt` event stream chunk); [ADR-0009](./docs/adr/0009-fl-studio-2025-qualification-layer.md); [docs/daws/fl-studio-2025-qualification.md](./docs/daws/fl-studio-2025-qualification.md).
- **Verified Capabilities & Versions:** `[VERIFIED FACT]` FL Studio 2025 (`25.1.6.4997`) is installed at `C:\Program Files\Image-Line\FL Studio 2025\FL64.exe` (`1,120,112` bytes, SHA-256 `273ECDC1C2421628`) and `FLEngine_x64.dll` (`63,013,744` bytes, SHA-256 `7753BB8B16752F0B`); Python `3.14` is installed at `C:\Python314\python.exe`; real factory `.flp` files (`NewStuff.flp` `45` ch / `96` PPQ; `Breakbeat.flp` `11` ch / `48` PPQ) are verified by `FlStudio2025Adapter`.
- **Technical Limitations:** `[VERIFIED FACT]` Image-Line does not provide an official headless project-mutation C++/Rust/JS SDK for `.flp` `FLdt` binary event streams, and background Windows Services cannot safely invoke ASIO-bound GUI render sessions without audio driver or modal dialog contention.
- **Recommended Role:** `[ENGINEERING RECOMMENDATION]` Enforce the 4-tier qualification contract (`@aether-forge/daw-contract`): enable `inspect` (`FLhd`/`FLdt` + `0xC7` `FLP_Version` parsing + read-only Python controller script `device_aetherforge_inspect.py`) and backup-mandatory `non_destructive_edit`, while hard-blocking `session_mutation`, headless `render`, and unattended UI automation (`INV-04`).

### Domain 11: Repository Automation
- **Authoritative Docs:** Git `2.54` Documentation (`https://git-scm.com/doc`); Constrained Filesystem & Reparse-Point Security Guidelines; [ADR-0001](./docs/adr/0001-hybrid-control-plane.md).
- **Verified Capabilities & Versions:** `[VERIFIED FACT]` Git `2.54.0.windows.1` is active on `main`; `@aether-forge/git` (`verifyGrantedGitWorkspace`) and `@aether-forge/filesystem` (`resolveAndVerifyGrantedPath`, `atomicWriteWorkspaceFile`) enforce canonical root confinement, NTFS junction/symlink blocking, and TOCTOU prior-hash verification.
- **Technical Limitations:** Executing arbitrary git hooks or submodules from untrusted repositories can trigger arbitrary code execution if not confined to a verified workspace root.
- **Recommended Role:** `[ENGINEERING RECOMMENDATION]` Confine all repository automation to `CapabilityGrant.canonicalPathScope` verified by both Node (`lstatSync` + `realpathSync.native`) and the compiled native Windows executable (`AetherForge.WindowsWorker.exe --verify-path`).

### Domain 12: CI/CD and Testing
- **Authoritative Docs:** Vitest `3.x` Documentation (`https://vitest.dev/`); CycloneDX `1.5` Specification (`https://cyclonedx.org/specification/overview/`); SLSA `v1.0` Provenance (`https://slsa.dev/spec/v1.0/provenance`); GitHub Actions Security Hardening; [ADR-0010](./docs/adr/0010-release-integrity.md).
- **Verified Capabilities & Versions:** `[VERIFIED FACT]` Vitest `3.2.7` executes `17` test suites (`52/52` tests across contract compatibility, API boundaries, security governance, OPA policy, Provider Gateway, Windows Worker, Knowledge, Audio DSP, FL Studio 2025, VST3, OpenTelemetry + 6 abuse cases, performance benchmarks, E2E vertical slice, native `.exe` DPAPI/ReparsePoint compilation, staging providers, and dual-control v1.0.0 promotion) in `~1.8s`.
- **Technical Limitations:** Running only unit tests with mocked filesystems misses Windows-specific NTFS junction/reparse-point and DPAPI behaviors.
- **Recommended Role:** `[ENGINEERING RECOMMENDATION]` Combine fast in-process contract/policy/replay tests with real Windows OS filesystem/junction/DPAPI tests (`phase06`, `phase13`), live HTTP E2E tests (`phase04`, `api-boundaries`), and mandatory SBOM + SLSA v1.0 provenance generation in `.github/workflows/ci.yml`.

### Domain 13: Infrastructure and Security
- **Authoritative Docs:** Open Policy Agent Rego v1 (`https://www.openpolicyagent.org/docs/latest/`); W3C Trace Context (`https://www.w3.org/TR/trace-context/`); Microsoft DPAPI (`ProtectedData`); Kubernetes Pod Security Standards (Restricted Profile); Terraform `1.6+`; [Threat Model](./docs/security/threat-model.md).
- **Verified Capabilities & Versions:** `[VERIFIED FACT]` Implemented across `@aether-forge/policy`, `@aether-forge/observability`, `@aether-forge/artifact-registry`, `workers/windows-host/NativeWorkerCli.cs` (compiled via `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe` into `artifacts/native/AetherForge.WindowsWorker.exe`), and `infra/{terraform,kubernetes,temporal,monitoring}`.
- **Technical Limitations:** Local DPAPI (`DataProtectionScope.CurrentUser`) binds encrypted secrets to the specific Windows user profile on that physical machine and cannot be migrated across hosts without re-enrollment.
- **Recommended Role:** `[ENGINEERING RECOMMENDATION]` Enforce defense-in-depth across all 7 trust boundaries (`TB-1`..`TB-7`): OIDC + tenant-before-data 404 isolation at API ingress, OPA Rego v1 fail-closed policy, constant-time `timingSafeEqual` HMAC/Ed25519 manifest signatures, outbound-only worker mTLS with DPAPI identity storage, and dual-control `Reviewer` + `ReleaseManager` release promotion.
