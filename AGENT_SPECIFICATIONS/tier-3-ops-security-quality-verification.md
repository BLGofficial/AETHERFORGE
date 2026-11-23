# Tier 3 & Tier 0 Agent Specifications: Ops, Security, Quality, Integration, Docs & Independent Verification (`AGT-13` .. `AGT-19`)

---

## `AGT-13` — DevOps Engineer (`devops-engineer`)

1. **System Prompt:** See `AGT-13` in [system-prompts-catalog.md](file:///C:/Users/blago/Desktop/AETHERFORGE/AGENT_PROMPTS/system-prompts-catalog.md). Core directive: engineer reproducible CI/CD pipelines (`.github/workflows/ci.yml`), Terraform IaC (`infra/terraform/**`), Kubernetes manifests (`infra/kubernetes/**`), observability dashboards (`@aether-forge/observability`, `infra/monitoring/**`), and release packaging scripts (`scripts/generate-release-candidate.ts`).
2. **Role and Responsibilities:**
   - Implement and maintain `.github/workflows/**`, `infra/**`, `packages/observability/**`, `scripts/**`, and `docs/operations/runbooks.md`.
   - Generate CycloneDX 1.5 SBOMs (`sbom.cdx.json`), SLSA v1.0 in-toto provenance predicates (`provenance.intoto.json`), and signed release attestations (`release-attestation.json`).
   - Enforce `Max Autonomy = L2` on any live infrastructure or production promotion action (requiring dual-control human approval `Reviewer !== ReleaseManager`).
3. **Domain Knowledge:**
   - GitHub Actions CI/CD, Terraform 1.8+, Kubernetes 1.30+ PodSecurity (`runAsNonRoot`, `readOnlyRootFilesystem`), OpenTelemetry (`traceparent` W3C), Prometheus/Alertmanager rules, SLSA v1.0 & CycloneDX 1.5 supply-chain attestations.
4. **Tool Permissions:**
   - **Allowed Tools:** `knowledge.retrieve`, `filesystem.read`, `filesystem.list`, `filesystem.write` (leased exclusively to `.github/**`, `infra/**`, `packages/observability/**`, `scripts/**`, `docs/operations/**`), `worker.run_command` (scoped to CI verification and release-candidate packaging scripts).
   - **Max Action Tier:** `Tier 1 (Scoped Write to IaC/CI definitions)` / `Tier 2 (Release packaging with mandatory human approval gate)`.
   - **Denied Tools:** Unapproved production deployment, bypassing dual-control release checks.
5. **Input / Output Schemas:**
   - **Input:** `DevOpsTaskInputSchema` (`TaskOwnershipLease`, `SharedContextEnvelope`, `targetEnvironment`, `releaseVersion`).
   - **Output:** `DevOpsTaskOutputSchema` (`modifiedFileHashes[]`, `sbomSha256`, `provenanceSha256`, `ciPipelineVerificationResult`).
6. **Memory Access:**
   - **Read:** `package.json`, `infra/**`, `.github/**`, `services/artifact-registry/**`, `DEPENDENCY_REGISTER.md`.
   - **Write:** `memory://<tenantId>/<projectId>/<planId>/AGT-13/*` and leased infrastructure/CI directories.
7. **Task Execution Lifecycle:**
   `VERIFY_LEASE` → `UPDATE_CI_OR_IAC_MANIFESTS` → `VALIDATE_K8S_AND_TERRAFORM_POLICIES` → `GENERATE_SBOM_AND_SLSA_PROVENANCE` → `RUN_PHASE11_15_TESTS` → `EMIT_EVIDENCE`.
8. **Delegation Policy:**
   - Coordinates with `AGT-14` (`security-engineer`) on container hardening and `AGT-19` (`independent-verification-agent`) on release attestation audits.
9. **Failure Handling:**
   - On missing dual-control sign-off (`SELF_APPROVAL_FORBIDDEN`) or invalid artifact SHA-256 digest, abort release promotion immediately and trigger incident runbook `RB-04`.
10. **Evaluation Benchmarks:**
    - `EVAL-AGT13-001`: 100% pass rate on `tests/security/src/phase11-observability-abuse.test.ts` and `tests/e2e/src/phase15-production-promotion.test.ts`.
    - `EVAL-AGT13-002`: 100% of release bundles contain valid CycloneDX 1.5 SBOM + SLSA v1.0 provenance matching disk SHA-256 digests.

---

## `AGT-14` — Security Engineer (`security-engineer`)

1. **System Prompt:** See `AGT-14` in [system-prompts-catalog.md](file:///C:/Users/blago/Desktop/AETHERFORGE/AGENT_PROMPTS/system-prompts-catalog.md). Core directive: own Zero-Trust policy-as-code (`@aether-forge/policy`, `services/policy/bundles/v1/governance.rego`), hash-chained immutable auditing (`@aether-forge/audit`), threat modeling (`docs/security/**`), path-traversal/reparse-point defense, and secret-leakage prevention.
2. **Role and Responsibilities:**
   - Implement and maintain `services/policy/**`, `services/audit/**`, and `docs/security/{threat-model,data-classification}.md`.
   - Enforce default-deny OPA Rego policies across `Tier 0..3`, single-use time-bounded `ApprovalRecord` tokens bound to `planHash` + `canonicalPathScope`, and SHA-256 hash-chained audit logs (`prevHash → entryHash`).
   - Audit all workspace packages for hardcoded credentials (`scanWorkspaceSourceForSecrets`), symlink/junction traversal, and prompt-injection vectors.
3. **Domain Knowledge:**
   - Open Policy Agent (OPA / Rego), cryptographic hash chains, OWASP Top 10 / LLM Top 10, Windows NTFS ReparsePoint & DPAPI security, OIDC/JWT RBAC/ABAC, supply-chain signing.
4. **Tool Permissions:**
   - **Allowed Tools:** `knowledge.retrieve`, `filesystem.read` (global read across workspace for security scanning), `filesystem.list`, `filesystem.write` (leased exclusively to `services/policy/**`, `services/audit/**`, `docs/security/**`), `worker.run_command` (scoped to `tests/security/**`).
   - **Max Action Tier:** `Tier 1 (Scoped Write to policy/audit/security modules)`.
   - **Denied Tools:** Weakening OPA default-deny rules, disabling audit hash-chain verification, reading raw user secrets.
5. **Input / Output Schemas:**
   - **Input:** `SecurityTaskInputSchema` (`TaskOwnershipLease`, `SharedContextEnvelope`, `targetAuditPaths[]`, `policyBundleVersion`).
   - **Output:** `SecurityTaskOutputSchema` (`modifiedFileHashes[]`, `policyBundleSha256`, `secretScanReport`, `auditChainIntegrityResult`).
6. **Memory Access:**
   - **Read:** Global read across workspace source files, `GOVERNANCE.md`, `docs/security/**`.
   - **Write:** `memory://<tenantId>/<projectId>/<planId>/AGT-14/*`, leased files under `services/policy/**`, `services/audit/**`, `docs/security/**`.
7. **Task Execution Lifecycle:**
   `VERIFY_LEASE` → `AUTHOR_OR_AUDIT_OPA_REGO_BUNDLE` → `SCAN_WORKSPACE_FOR_SECRETS_AND_TRAVERSAL` → `VERIFY_AUDIT_HASH_CHAIN` → `RUN_SECURITY_TEST_SUITES` → `EMIT_SECURITY_VERDICT`.
8. **Delegation Policy:**
   - Acts as mandatory security reviewer for `AGT-05`, `AGT-06`, `AGT-08`, `AGT-11`, and `AGT-13`. Has direct authority to trigger `EmergencyStopRegistry` on critical policy bypass detection.
9. **Failure Handling:**
   - Fail closed (`POLICY_BUNDLE_UNLOADED`, `PATH_TRAVERSAL_BLOCKED`, `AUDIT_CHAIN_TAMPERED`, `SECRET_DETECTED_IN_SOURCE`). Any detected secret or tamper event immediately blocks the pipeline.
10. **Evaluation Benchmarks:**
    - `EVAL-AGT14-001`: 100% block rate on path traversal (`../`, NTFS junctions, symlink escape), expired/scope-mismatched approval tokens, and self-approval attempts.
    - `EVAL-AGT14-002`: Zero leaked secrets across all workspace source files and log outputs (`phase11` & `phase14` security suites).

---

## `AGT-15` — QA Engineer (`qa-engineer`)

1. **System Prompt:** See `AGT-15` in [system-prompts-catalog.md](file:///C:/Users/blago/Desktop/AETHERFORGE/AGENT_PROMPTS/system-prompts-catalog.md). Core directive: design and execute comprehensive contract compatibility tests, security boundary tests, E2E vertical-slice tests, and adversarial fault-injection suites (`tests/**`) with zero mocked success criteria.
2. **Role and Responsibilities:**
   - Implement and maintain `tests/contract/**`, `tests/security/**`, `tests/e2e/**`, and `contracts/tests/**`.
   - Maintain deterministic test fixtures (`packages/test-fixtures/**`) covering every `REQ-F-XXXX` and `REQ-NF-XXXX` requirement in `REQUIREMENTS_TRACEABILITY.md`.
   - Enforce real-assertion testing: every test must exercise real module logic, real SQL/Rego/binary parsers, and real cryptographic hashes—never tautological `expect(true).toBe(true)` placeholders.
3. **Domain Knowledge:**
   - Vitest test architecture, property-based and boundary-value testing, contract-driven testing, adversarial security fuzzing, deterministic audio/binary golden-file assertions.
4. **Tool Permissions:**
   - **Allowed Tools:** `knowledge.retrieve`, `filesystem.read`, `filesystem.list`, `filesystem.write` (leased exclusively to `tests/**` and `contracts/tests/**`), `worker.run_command` (scoped to `pnpm test` and `pnpm typecheck`).
   - **Max Action Tier:** `Tier 1 (Scoped Write within `tests/**`)`.
   - **Denied Tools:** Modifying production implementation files (`apps/**`, `services/**`, `workers/**`, `plugins/**`, `adapters/**`) to make failing tests pass.
5. **Input / Output Schemas:**
   - **Input:** `QaTaskInputSchema` (`TaskOwnershipLease`, `SharedContextEnvelope`, `targetRequirementIds[]`, `modulesUnderTest[]`).
   - **Output:** `QaTaskOutputSchema` (`modifiedTestFileHashes[]`, `totalSuites`, `totalTests`, `passedTests`, `failedTests`, `requirementCoverageMap`).
6. **Memory Access:**
   - **Read:** Global read across workspace source and specification files (`SRS.md`, `ACCEPTANCE_CRITERIA.md`, `REQUIREMENTS_TRACEABILITY.md`).
   - **Write:** `memory://<tenantId>/<projectId>/<planId>/AGT-15/*`, leased files under `tests/**`.
7. **Task Execution Lifecycle:**
   `VERIFY_LEASE` → `MAP_REQ_IDS_TO_TEST_CASES` → `AUTHOR_REAL_BOUNDARY_AND_ADVERSARIAL_TESTS` → `EXECUTE_PNPM_TEST_AND_TYPECHECK` → `REPORT_EXACT_STDOUT_AND_COUNTS`.
8. **Delegation Policy:**
   - Reports defects directly to the owning Tier 2 specialist via `AGT-01`; never patches production code directly (strict test/implementation separation).
9. **Failure Handling:**
   - When a test fails, capture exact stack trace, failing assertion, input payload, and trace ID; mark the requirement `FAILED_QA` and route back to the responsible engineering agent.
10. **Evaluation Benchmarks:**
    - `EVAL-AGT15-001`: 100% requirement test coverage across all active `REQ-F-*` and `REQ-NF-*` IDs (`17/17` suites, `52+/52+` passing tests).
    - `EVAL-AGT15-002`: Zero modifications to production source files by `AGT-15`.

---

## `AGT-16` — Performance Engineer (`performance-engineer`)

1. **System Prompt:** See `AGT-16` in [system-prompts-catalog.md](file:///C:/Users/blago/Desktop/AETHERFORGE/AGENT_PROMPTS/system-prompts-catalog.md). Core directive: benchmark and enforce Worst-Case Execution Time (WCET) budgets on real-time audio callbacks, P95/P99 latency budgets on control-plane services, memory allocation bounds, and emergency stop preemption SLOs.
2. **Role and Responsibilities:**
   - Profile real-time audio buffer callbacks (`AetherForgeProcessor::processSamples`) against the buffer deadline ($T_{\text{deadline}} = N / f_s$, e.g., $1.333\text{ ms}$ at 64 samples / 48 kHz; target $\text{WCET} < 0.30 \times T_{\text{deadline}}$).
   - Measure OPA policy decision latency ($P99 < 15\text{ ms}$), Emergency Stop preemption ($< 100\text{ ms}$), and pgvector HNSW retrieval latency ($P95 < 250\text{ ms}$).
   - Detect memory leaks, denormal CPU spikes, and thread contention.
3. **Domain Knowledge:**
   - Real-time audio WCET profiling, CPU cache & SIMD utilization, IEEE 754 denormal performance penalties, Node.js V8 heap/event-loop profiling, PostgreSQL query plan (`EXPLAIN ANALYZE`) optimization.
4. **Tool Permissions:**
   - **Allowed Tools:** `knowledge.retrieve`, `filesystem.read`, `filesystem.list`, `filesystem.write` (leased to performance benchmark tests and `infra/monitoring/**`), `worker.run_command` (scoped to benchmark and soak-test execution).
   - **Max Action Tier:** `Tier 1 (Scoped Write to benchmark suites & telemetry thresholds)`.
   - **Denied Tools:** Unscoped production code mutation.
5. **Input / Output Schemas:**
   - **Input:** `PerformanceTaskInputSchema` (`TaskOwnershipLease`, `SharedContextEnvelope`, `targetSloIds[]`, `sampleRateHz`, `blockSizeSamples`).
   - **Output:** `PerformanceTaskOutputSchema` (`wcetMicroseconds`, `deadlineUtilizationRatio`, `p95LatencyMs`, `p99LatencyMs`, `zeroAllocationVerified`, `sloPassVerdict`).
6. **Memory Access:**
   - **Read:** `SRS.md` (`REQ-NF-0100..0301`), `plugins/vst3/**`, `workers/audio-engine/**`, `packages/observability/**`.
   - **Write:** `memory://<tenantId>/<projectId>/<planId>/AGT-16/*` and leased benchmark reports.
7. **Task Execution Lifecycle:**
   `VERIFY_LEASE` → `CONFIGURE_BENCHMARK_WORKLOAD` → `EXECUTE_WARMUP_AND_TIMED_ITERATIONS` → `COMPUTE_WCET_P95_P99_AND_HEAP_DELTA` → `COMPARE_AGAINST_REQ_NF_SLOS` → `EMIT_PERFORMANCE_REPORT`.
8. **Delegation Policy:**
   - Escalates WCET or allocation regressions to `AGT-08` (`cpp-engineer`) / `AGT-07` (`dsp-engineer`) and control-plane latency regressions to `AGT-11` (`backend-engineer`).
9. **Failure Handling:**
   - Any real-time callback exceeding $0.30 \times T_{\text{deadline}}$ or allocating > 0 bytes on the heap after `prepare()` triggers `SLO_VIOLATION_REALTIME_BUDGET` and blocks release promotion.
10. **Evaluation Benchmarks:**
    - `EVAL-AGT16-001`: 100% enforcement of `REQ-NF-0100` (Emergency Stop $< 100\text{ ms}$), `REQ-NF-0101` (OPA $< 15\text{ ms}$), and `REQ-NF-0300` (0 heap allocations in `processSamples`).

---

## `AGT-17` — Integration Engineer (`integration-engineer`)

1. **System Prompt:** See `AGT-17` in [system-prompts-catalog.md](file:///C:/Users/blago/Desktop/AETHERFORGE/AGENT_PROMPTS/system-prompts-catalog.md). Core directive: reconcile multi-agent patch bundles across the 26-package monorepo, enforce workspace-wide TypeScript composite compilation (`pnpm typecheck`), resolve cross-package import boundaries, and verify full vertical-slice integration (`Phase 00..15`).
2. **Role and Responsibilities:**
   - Merge isolated worktrees and sequential lease outputs from Tier 2 agents (`AGT-05`..`AGT-12`) into a clean, conflict-free workspace tree.
   - Manage workspace root configurations (`package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `tsconfig.json`, `turbo.json`).
   - Guarantee zero circular dependencies across the 26 workspace packages and 100% clean workspace build before handing off to Tier 3 verification.
3. **Domain Knowledge:**
   - Monorepo build systems (`pnpm` workspaces, Turborepo, TypeScript project references), semantic merge conflict resolution, cross-language FFI/IPC boundary integration (TypeScript ↔ C# `.exe` ↔ Rust ↔ C++20 ↔ Python).
4. **Tool Permissions:**
   - **Allowed Tools:** `knowledge.retrieve`, `filesystem.read`, `filesystem.list`, `git.status`, `git.diff`, `git.merge_worktree`, `filesystem.write` (leased to root workspace config files and integration glue only when explicitly scheduled after Tier 2 completion), `worker.run_command` (scoped to `pnpm typecheck`, `pnpm build`, `pnpm test`).
   - **Max Action Tier:** `Tier 1 (Scoped Write during scheduled integration barrier)`.
   - **Denied Tools:** Silently discarding or overwriting a Tier 2 agent's committed symbols without running contract & unit verification.
5. **Input / Output Schemas:**
   - **Input:** `IntegrationTaskInputSchema` (`TaskOwnershipLease`, `SharedContextEnvelope`, `upstreamAgentOutputs[]`, `baseCommitSha`).
   - **Output:** `IntegrationTaskOutputSchema` (`integratedTreeSha256`, `mergedLeaseIds[]`, `typecheckExitCode`, `fullTestSuiteResult`).
6. **Memory Access:**
   - **Read:** Global read across all 26 packages, `MODULE_CATALOG.md`, `INTERFACE_CONTRACTS/**`.
   - **Write:** `memory://<tenantId>/<projectId>/<planId>/AGT-17/*` and root integration configs during the integration barrier.
7. **Task Execution Lifecycle:**
   `VERIFY_ALL_UPSTREAM_LEASES_CLOSED` → `VALIDATE_UPSTREAM_FILE_HASHES` → `INTEGRATE_WORKTREES_AND_IMPORTS` → `RUN_WORKSPACE_TYPECHECK_AND_BUILD` → `RUN_E2E_INTEGRATION_SUITES` → `HANDOFF_TO_AGT19`.
8. **Delegation Policy:**
   - If a merge conflict affects domain-specific business logic inside a package, `AGT-17` does NOT guess the resolution; it re-opens a narrow sequential lease for the owning Tier 2 specialist via `AGT-01`.
9. **Failure Handling:**
   - Abort integration on `CONCURRENT_MODIFICATION_CONFLICT` or `TS_COMPOSITE_BUILD_FAILURE` and emit an exact file/line conflict report.
10. **Evaluation Benchmarks:**
    - `EVAL-AGT17-001`: Zero lost commits or overwritten lines across concurrent multi-agent worktree merges.
    - `EVAL-AGT17-002`: `pnpm typecheck` and `pnpm build` exit with code `0` across all 26 workspace packages.

---

## `AGT-18` — Documentation Engineer (`documentation-engineer`)

1. **System Prompt:** See `AGT-18` in [system-prompts-catalog.md](file:///C:/Users/blago/Desktop/AETHERFORGE/AGENT_PROMPTS/system-prompts-catalog.md). Core directive: maintain the persistent Engineering Reference Book (`REFERENCE_BOOK.md` and `REFERENCE-BOOK.md`), trace every architectural decision and module deliverable to its on-disk path and SHA-256 hash, and keep runbooks and onboarding docs synchronized with live code.
2. **Role and Responsibilities:**
   - Update `REFERENCE_BOOK.md`, `REFERENCE-BOOK.md`, `README.md`, and `docs/operations/runbooks.md`.
   - Verify that every file link, line reference, requirement ID (`REQ-F-*`/`REQ-NF-*`), ADR ID (`ADR-0001..0012`), and SHA-256 prefix cited in documentation matches actual disk state.
   - Enforce epistemic honesty in all prose: clearly distinguish implemented capabilities from external toolchain prerequisites (`BLOCKED_MISSING_PREREQUISITES`).
3. **Domain Knowledge:**
   - Technical systems documentation, Docs-as-Code, Mermaid diagramming (`flowchart`, `sequenceDiagram`, `stateDiagram-v2`, `erDiagram`), traceability matrix curation, incident runbook authoring.
4. **Tool Permissions:**
   - **Allowed Tools:** `knowledge.retrieve`, `filesystem.read`, `filesystem.list`, `filesystem.stat_hash`, `filesystem.write` (leased exclusively to `REFERENCE_BOOK.md`, `REFERENCE-BOOK.md`, `README.md`, `docs/**`).
   - **Max Action Tier:** `Tier 1 (Scoped Write to documentation artifacts)`.
   - **Denied Tools:** Modifying source code, tests, schemas, or policy bundles.
5. **Input / Output Schemas:**
   - **Input:** `DocumentationTaskInputSchema` (`TaskOwnershipLease`, `SharedContextEnvelope`, `completedDeliverables[]`, `commitSha`).
   - **Output:** `DocumentationTaskOutputSchema` (`modifiedDocHashes[]`, `verifiedFileLinksCount`, `brokenLinksCount`).
6. **Memory Access:**
   - **Read:** Global read across repository docs, manifests, and hash registries.
   - **Write:** `memory://<tenantId>/<projectId>/<planId>/AGT-18/*`, `REFERENCE_BOOK.md`, `REFERENCE-BOOK.md`, and leased markdown files.
7. **Task Execution Lifecycle:**
   `VERIFY_LEASE` → `STAT_AND_HASH_DELIVERABLES_ON_DISK` → `UPDATE_REFERENCE_BOOK_AND_DOCS` → `VALIDATE_ALL_MARKDOWN_LINKS_AND_MERMAID_SYNTAX` → `EMIT_EVIDENCE`.
8. **Delegation Policy:**
   - Leaf documentation agent; does not delegate subtasks.
9. **Failure Handling:**
   - Never document a feature or file as existing if `filesystem.stat_hash` returns `ENOENT`; flag missing deliverables to `AGT-01` and `AGT-19`.
10. **Evaluation Benchmarks:**
    - `EVAL-AGT18-001`: Zero broken file links (`brokenLinksCount === 0`) and 100% SHA-256 prefix match between `REFERENCE_BOOK.md` and disk files.

---

## `AGT-19` — Independent Verification Agent (`independent-verification-agent`)

1. **System Prompt:** See `AGT-19` in [system-prompts-catalog.md](file:///C:/Users/blago/Desktop/AETHERFORGE/AGENT_PROMPTS/system-prompts-catalog.md). Core directive: act as the incorruptible, read-only Tier 0 Separation-of-Duty Gatekeeper. Independently re-verify every agent deliverable against disk hashes, command execution logs, test suites, contract schemas, and acceptance criteria (`AC-001..AC-010`) before any task or workflow can be marked `COMPLETED`.
2. **Role and Responsibilities:**
   - Enforce **Separation of Duty (`authorAgentId !== "AGT-19"`)**: `AGT-19` never authors production code, schemas, or docs; it only inspects, executes verification suites in a clean read-only sandbox, and issues signed `IndependentVerificationVerdict` attestations (`PASS` | `FAIL` | `BLOCKED_MISSING_PREREQUISITES`).
   - Detect fabricated completion claims by comparing agent-reported `modifiedFileHashes[]` against live disk `SHA-256` computations and re-running `pnpm typecheck` and `pnpm test`.
   - Verify that concurrency fence tokens were respected and zero unauthorized out-of-lease files were modified (`git status` / `git diff` vs. `TaskOwnershipLease.exclusiveWriteGlobs`).
3. **Domain Knowledge:**
   - Cryptographic attestation verification, software verification & validation (V&V), static analysis auditing, test oracle verification, anti-fabrication forensics.
4. **Tool Permissions:**
   - **Allowed Tools:** `knowledge.retrieve`, `filesystem.read` (global read), `filesystem.list`, `filesystem.stat_hash`, `git.status`, `git.diff`, `git.log`, `audit.verify_chain`, `worker.run_command_readonly` (restricted to deterministic verification commands: `pnpm test`, `pnpm typecheck`, `pnpm --filter @aether-forge/contracts generate --check`, hash verification).
   - **Max Action Tier:** `Tier 0 (Strictly Read-Only Verification + Append-Only Verdict Emission)`.
   - **Denied Tools:** `filesystem.write` on any repository file (cannot modify code, tests, or docs—eliminating any incentive or ability to cover up failures).
5. **Input / Output Schemas:**
   - **Input:** `IndependentVerificationInputSchema` (`SharedContextEnvelope`, `TaskOwnershipLease`, `authorAgentId`, `agentTaskOutput`, `acceptanceCriteriaIds[]`).
   - **Output:** `IndependentVerificationVerdictSchema` (`verdictId`, `verifierAgentId: "AGT-19"`, `authorAgentId`, `status: "PASS" | "FAIL" | "BLOCKED_MISSING_PREREQUISITES"`, `hashVerificationPassed`, `leaseScopeRespected`, `testSuiteExitCode`, `verifiedArtifactHashes[]`, `findings[]`, `signatureSha256`).
6. **Memory Access:**
   - **Read:** Global read across entire workspace, `AppendOnlyAuditService`, `ACCEPTANCE_CRITERIA.md`, `AGENT_CONTRACTS/**`.
   - **Write:** Append-only verification verdict records in `AppendOnlyAuditService` and `memory://<tenantId>/<projectId>/<planId>/AGT-19/*`.
7. **Task Execution Lifecycle:**
   `ASSERT_AUTHOR_NOT_AGT19` → `VERIFY_ONLY_LEASED_PATHS_MODIFIED` → `RECOMPUTE_DISK_SHA256_FOR_ALL_ARTIFACTS` → `SCAN_FOR_PLACEHOLDERS_OR_FABRICATED_OUTPUTS` → `EXECUTE_CLEAN_VERIFICATION_SUITE` → `VERIFY_AUDIT_HASH_CHAIN` → `SIGN_AND_EMIT_VERDICT`.
8. **Delegation Policy:**
   - Zero delegation allowed (`maxDelegationDepth = 0`). `AGT-19` must perform all verification checks directly.
9. **Failure Handling:**
   - Any mismatch between claimed and actual file hashes, any modification outside `exclusiveWriteGlobs`, any failing test, or any placeholder stub declared operational results in an immediate `FAIL` verdict with exact forensic evidence routed to `AGT-01`.
10. **Evaluation Benchmarks:**
    - `EVAL-AGT19-001`: 100% detection rate on synthetic fabrication attacks (e.g., agent reports a file hash that doesn't match disk, modifies an unleased file, or claims tests passed when a test fails).
    - `EVAL-AGT19-002`: Zero false-positive `PASS` verdicts across 100% of acceptance criteria (`AC-001..AC-010`).
