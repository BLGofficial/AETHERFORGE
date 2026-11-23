# AETHER FORGE — INDEPENDENT QUALITY GATES & ACCEPTANCE FRAMEWORK (`QUALITY_GATES.md`)

- **Version:** `1.0.0`
- **Authority:** Chief Verification and Quality Engineering Officer (`ARCH-07` Quality and Verification Engine, `AGT-19` Independent Verification Agent)
- **Traceability:** `REQ-F-0100..0502`, `REQ-NF-0100..0501`, `AC-001..AC-010`, `ADR-0008`, `ADR-0010`, `ADR-0012`
- **Subsystems:** [VERIFICATION_ENGINE/](file:///C:/Users/blago/Desktop/AETHERFORGE/VERIFICATION_ENGINE/README.md), [QA_FRAMEWORK/](file:///C:/Users/blago/Desktop/AETHERFORGE/QA_FRAMEWORK/README.md), [TEST_CATALOG/](file:///C:/Users/blago/Desktop/AETHERFORGE/TEST_CATALOG/README.md), [REQUIREMENT_COVERAGE_REPORT/](file:///C:/Users/blago/Desktop/AETHERFORGE/REQUIREMENT_COVERAGE_REPORT/README.md), [EVIDENCE_REGISTRY/](file:///C:/Users/blago/Desktop/AETHERFORGE/EVIDENCE_REGISTRY/README.md)

---

## 1. Fundamental Verification Laws

### Law 1 — Strict Separation of Duty (`implementingAgentId !== verifierAgentId`)
No agent that authored, compiled, or integrated a feature (`AGT-01` .. `AGT-18`) is permitted to verify or certify that feature. Only **`AGT-19` (`independent-verification-agent`)**, operating in a read-only Tier 0 context with zero write permissions to repository files, can issue an authoritative `RequirementAcceptanceRecord` or `VerificationGateCertificate`. Any attempt where `implementingAgentId === verifierAgentId` or `verifierAgentId !== "AGT-19"` fails closed with `INDEPENDENT_VERIFICATION_SEPARATION_OF_DUTY_VIOLATION`.

### Law 2 — Prohibition of Code-Only, Compile-Only, or Self-Reported Completion
A feature or requirement MUST NEVER be marked `PASS` based solely on:
1. **`CODE_GENERATED_ONLY`:** Existence of generated source files on disk without behavioral execution.
2. **`COMPILATION_SUCCEEDED_ONLY`:** Passing `tsc --noEmit` or a native compiler build without running functional, boundary, and adversarial test assertions.
3. **`AGENT_SELF_REPORT_ONLY`:** Uncorroborated prose or JSON claims emitted by the implementing agent.

Every `PASS` verdict requires **all three empirical proofs** simultaneously:
$$\text{Verdict} = \text{PASS} \iff \text{DiskArtifactSha256Verified} \;\land\; \text{IndependentTestOracleExitZero} \;\land\; \text{StaticAndSecurityAnalysisClean}$$

### Law 3 — Explicit Honesty on Known Limitations & External Prerequisites
Every requirement evaluation must explicitly record `knownLimitations`. When an external workstation binary (such as `cl.exe`, `cargo`, `pluginval.exe`, `C:\JUCE`, or `C:\VST_SDK`) is absent on the host, the native binary packaging portion is recorded transparently in `knownLimitations` and tagged `BLOCKED_MISSING_PREREQUISITES`—never masked by a mock binary.

---

## 2. The 12 Mandatory Verification Disciplines

| Gate ID | Verification Discipline | Executing Engine / Suite | Quantitative Pass Threshold |
| :--- | :--- | :--- | :--- |
| **`QG-01`** | **Requirement Coverage Analysis** | `QA_FRAMEWORK` (`analyzeRequirementCoverage`) | `100%` of `REQ-F-XXXX` and `REQ-NF-XXXX` IDs bound to $\ge 1$ component, $\ge 1$ executable test, and $\ge 1$ verified evidence artifact (`orphanRequirements === 0`). |
| **`QG-02`** | **Unit Testing** | Vitest unit assertions across all 26 packages | `100%` pass rate (`exitCode === 0`), zero tautological `expect(true).toBe(true)` assertions. |
| **`QG-03`** | **Integration Testing** | Cross-module boundary & adapter tests | `100%` schema and state hand-off conformance across API, Policy, Audit, Knowledge, Workflow, and Runtime modules. |
| **`QG-04`** | **End-to-End Testing** | `phase04-vertical-slice`, `phase12-release-candidate`, `phase15-production-promotion` | Full brief → plan → OPA gate → human approval → execution → dual-control promotion passes end-to-end. |
| **`QG-05`** | **Static Analysis** | `runStaticAnalysisGate()` | `0` TypeScript `: any` / `as any` / `<any>` tokens in contracts & modules; `0` C++20 real-time hazards (`malloc`/`new`/`mutex`/`printf`) in `processSamples()`; `0` placeholder stubs declared operational. |
| **`QG-06`** | **Security Analysis** | `phase02`, `phase03`, `phase06`, `phase11`, `phase13`, `phase14` | `100%` block on path traversal, NTFS junctions, self-approval, expired tokens, unloaded OPA bundles, and direct tool-gateway bypass; `0` hardcoded secrets in source or logs. |
| **`QG-07`** | **Performance Testing** | `phase12-performance` & `AUDIO_TEST_FRAMEWORK` WCET profiler | Emergency Stop preemption $< 100\text{ ms}$; OPA evaluation $P99 < 15\text{ ms}$; pgvector hybrid RAG $P95 < 250\text{ ms}$; real-time audio callback $\text{WCET} < 0.30 \times T_{\text{deadline}}$. |
| **`QG-08`** | **Agent Behavior Evaluation** | `AGENT_EVALUATION_FRAMEWORK` & `VERIFICATION_ENGINE` | `100%` adherence to fenced write leases (`exclusiveWriteGlobs`), monotonic `fenceToken` ordering, epistemic tagging, and separation of duty. |
| **`QG-09`** | **Workflow Correctness Testing** | `WORKFLOW_TESTS/workflow-orchestration.test.ts` | Crash-safe disk WAL + checkpoint resume across process restart, bounded retry, LIFO compensating rollback, idempotency deduplication, and budget circuit breaking. |
| **`QG-10`** | **Audio Quality Testing** | `DSP_ENGINE` & `AUDIO_TEST_FRAMEWORK` | Bit-identical phase-cancellation null test ($\le -144\text{ dBFS}$ residual), ITU-R BS.1770-4 LUFS & parabolic inter-sample True Peak within ceiling ($\le -0.1\text{ dBTP}$), `0` `NaN`/`Inf`/denormals. |
| **`QG-11`** | **VST3 Compatibility Testing** | `VST3_ENGINE` (`Vst3HostCompatibilityHarness`) & `phase10` | `IAudioProcessor` / `IEditController` thread isolation (`ADR-0008`), variable block sizes ($1..4096$), zero-length block safety, sample-rate sweeps ($44.1..96\text{ kHz}$), lossless preset state round-trip. |
| **`QG-12`** | **Regression Testing** | `QA_FRAMEWORK` (`runRegressionBaselineCheck`) | `0` regressions against pinned artifact SHA-256 digests, contract schemas (`json-schema.json`, `openapi.json`), and passing test counts (`23/23` suites). |

---

## 3. Six-Field Requirement Acceptance Record Standard

Every requirement in `REQUIREMENT_COVERAGE_REPORT/` is evaluated into a 6-field `RequirementAcceptanceRecord`:
1. **`expectedBehavior`:** Quantitative functional or non-functional specification from `SRS.md`.
2. **`verificationMethod`:** Exact subset of the 12 disciplines (`UNIT_TESTING`, `STATIC_ANALYSIS`, `SECURITY_ANALYSIS`, `AUDIO_QUALITY_TESTING`, etc.) and deterministic oracle rule.
3. **`testResult`:** Empirical execution measurement (e.g., `"5/5 tests passed; truePeakDbtp = -1.02 dBTP <= -1.0 dBTP; nullResidual = -144 dBFS"`).
4. **`evidenceArtifact`:** Canonical repository path and live on-disk `SHA-256` digest registered in `EVIDENCE_REGISTRY/`.
5. **`passFailStatus`:** `"PASS" | "FAIL" | "BLOCKED_MISSING_PREREQUISITES"`.
6. **`knownLimitations`:** Explicit declaration of environmental boundaries or external binary prerequisites.
