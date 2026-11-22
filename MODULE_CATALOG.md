# AETHER FORGE — Complete Module Catalog

**Version:** 1.0.0  
**Date:** 2026-11-23  
**Status:** Verified 18-Module Specification (`v1.0.0`)  
**Cross-References:** [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md) · [SYSTEM_DIAGRAMS.md](./SYSTEM_DIAGRAMS.md) · [INTERFACE_CONTRACTS/README.md](./INTERFACE_CONTRACTS/README.md) · [REQUIREMENTS_TRACEABILITY.md](./REQUIREMENTS_TRACEABILITY.md) · [REFERENCE_BOOK.md](./REFERENCE_BOOK.md)

---

## Module Specification Catalog

Every module in the 26-package AETHER FORGE monorepo is specified below with its exact responsibility, typed inputs, typed outputs, dependencies, public interfaces, internal components, failure conditions, and testing requirements.

---

### MOD-01: `@aether-forge/contracts` (`contracts/`)
- **Responsibility:** Canonical source of truth for all versioned (`schemaVersion: "1.0.0"`) domain, API, event, tool, and worker schemas, deterministic SHA-256 plan hashing, and JSON Schema / OpenAPI 3.1 generation.
- **Inputs:** Untyped raw JSON / unknown boundary values; `ExecutionPlan` step structures for canonical hashing.
- **Outputs:** Validated TypeScript types (`RequestContext`, `Result<T>`, `Brief`, `ProductSpec`, `ExecutionPlan`, `PlanStep`, `ToolManifest`, `CapabilityGrant`, `Approval`, `WorkerJob`, `DawCommand`, `AudioJob`, `EvidenceRef`, `ArtifactRef`, `AuditEvent`, `DomainError`, `CloudEventEnvelope<T>`); `contracts/generated/json-schema.json`; `contracts/generated/openapi.json`.
- **Dependencies:** `zod` (`3.25.76`), Node `node:crypto`, `node:fs`.
- **Public Interfaces:** `contracts/src/index.ts` (`*Schema`, `createResultSchema`, `createCloudEventSchema`, `computeCanonicalPlanHash`, `buildJsonSchemaCatalog`, `buildOpenApiSpec`).
- **Internal Components:** `src/domain/index.ts`, `src/tools/index.ts`, `src/worker/index.ts`, `src/events/index.ts`, `src/api/index.ts`, `scripts/generate-schemas.ts`.
- **Failure Conditions:** `ZodError` on major version mismatch (`2.0.0`), missing required fields, malformed SHA-256 hex, invalid W3C `traceparent`, or unknown `ActionClass`.
- **Testing Requirements:** `contracts/tests/compatibility/compatibility.test.ts` (7 tests: canonical fixture validation, `Result<T>` branches, additive `1.2.4` evolution, breaking `2.0.0` rejection, `planHash` determinism, JSON Schema/OpenAPI generation, and zero-`any` source scan).

---

### MOD-02: `@aether-forge/audit` (`services/audit/`)
- **Responsibility:** Immutable append-only governance audit ledger (`INV-01`) with tenant-scoped querying and correlation trace reconstruction.
- **Inputs:** `AppendAuditInput` (`eventId`, `tenantId`, `projectId?`, `actor`, `traceId`, `idempotencyKey`, `eventType`, `actionClass?`, `policyVersion`, `planHash?`, `outcome`, `payload`).
- **Outputs:** Frozen `AuditEvent` (`Object.freeze`) with SHA-256 `payloadHash`; ordered `readonly AuditEvent[]` per tenant or `(tenantId, traceId)`.
- **Dependencies:** `@aether-forge/contracts`, `node:crypto`.
- **Public Interfaces:** `AppendOnlyAuditStore` (`append`, `listByTenant`, `reconstructTrace`, `setSimulateFailure`), `computePayloadSha256`.
- **Internal Components:** In-memory/persistent frozen event log array, SHA-256 payload serializer, schema validator (`AuditEventSchema.parse`).
- **Failure Conditions:** Throws `AUDIT_STORE_UNAVAILABLE` when store is unavailable or in fail-closed simulation mode, aborting caller mutations before side effects occur.
- **Testing Requirements:** `tests/security/src/phase02-governance.test.ts` and `phase04-vertical-slice.test.ts` (trace reconstruction and cross-tenant isolation).

---

### MOD-03: `@aether-forge/policy` (`services/policy/`)
- **Responsibility:** Deterministic Policy Decision Point (`ADR-0002`) evaluating signed, versioned OPA Rego v1 bundles across all 11 governed action classes with fail-closed defaults and sanitized UI explanations.
- **Inputs:** `unknown` raw input validated against `PolicyInputSchema` (`tenantId`, `projectId`, `actor`, `actionClass`, `classification`, `dawCapabilityQualified`).
- **Outputs:** `PolicyDecision` (`decision: "allow" | "requireApproval" | "deny"`, `policyVersion`, `bundleDigest`, `reasonCode`, `userExplanation`, `requiredApproverRoles`, `approvalExpirySeconds`).
- **Dependencies:** `@aether-forge/contracts`, `node:crypto`, `node:fs`.
- **Public Interfaces:** `OpaPolicyDecisionPoint` (`evaluate`, `getActiveBundle`, `getPolicyVersion`, `rotateBundle`, `setSimulateEvaluationError`), `loadDefaultV1OpaPolicyBundle`.
- **Internal Components:** `bundles/v1/governance.rego`, `bundles/v1/bundle-manifest.json`, SHA-256 bundle digest computer, 11-class rule table (`DEFAULT_V1_RULES`), UI explanation sanitizer.
- **Failure Conditions:** Fails closed (`decision: "deny"`) on unloaded bundle (`POLICY_BUNDLE_UNAVAILABLE_FAIL_CLOSED`), malformed input (`POLICY_INPUT_INVALID_FAIL_CLOSED`), unknown action (`POLICY_UNKNOWN_ACTION_DENIED`), `SECRET_CREDENTIAL` (`POLICY_SECRET_CREDENTIAL_DENIED`), restricted egress (`POLICY_RESTRICTED_LOCAL_EGRESS_DENIED`), or unqualified DAW tier (`POLICY_DAW_CAPABILITY_UNQUALIFIED`).
- **Testing Requirements:** `tests/security/src/phase03-policy-approvals.test.ts` (4 tests) and `tests/performance/src/phase12-performance.test.ts` (`<2.0 ms` avg latency).

---

### MOD-04: `@aether-forge/api` (`apps/api/`)
- **Responsibility:** Governed Domain API enforcing OIDC authentication, tenant-before-data isolation (`404 NOT_FOUND`), role authorization, idempotency deduplication, approval state machine (`INV-03`), and Emergency Stop (`423 Locked`).
- **Inputs:** `SubmitBriefRequest`, `CreatePlanRequest`, `DecideApprovalRequest`, `TriggerEmergencyStopRequest` + `AuthenticatedCommandOptions` (`bearerToken`, `nowMs`).
- **Outputs:** `SubmitBriefResponse` (`Result<SpecRef>`), `CreatePlanResponse` (`Result<ExecutionPlan>`), `DecideApprovalResponse` (`Result<{ approval, grant? }>`), `TriggerEmergencyStopResponse` (`Result<EmergencyStopReceipt>`), `Result<CapabilityGrant>` (`verifyStepDispatchGate`).
- **Dependencies:** `@aether-forge/contracts`, `@aether-forge/audit`, `@aether-forge/policy`, `node:crypto`.
- **Public Interfaces:** `GovernedDomainApiService`, `ConfigurableOidcVerifier`, `TenantMembershipRegistry`, `authorizeTenantAndRole`, `CorrelationAndIdempotencyMiddleware`, `ApprovalStateMachine`, `EmergencyStopController`, `WorkflowCancellationCoordinator`, `ACTION_TAXONOMY`.
- **Internal Components:** `src/identity.ts`, `src/middleware.ts`, `src/taxonomy.ts`, `src/approvals.ts`, `src/emergency-stop.ts`, `src/domain-api.ts`.
- **Failure Conditions:** `DOMAIN_OIDC_AUTHENTICATION_FAILED`, `DOMAIN_RESOURCE_NOT_FOUND` (404), `DOMAIN_ROLE_AUTHORIZATION_DENIED` (403), `DOMAIN_IDEMPOTENCY_KEY_PAYLOAD_MISMATCH` (409), `DOMAIN_APPROVAL_EXPIRED`, `DOMAIN_APPROVAL_INVALIDATED_BY_DRIFT` (409), `DOMAIN_CAPABILITY_SCOPE_VIOLATION`, `DOMAIN_EMERGENCY_STOP_ACTIVE` (423).
- **Testing Requirements:** `tests/security/src/phase02-governance.test.ts` (6 tests), `phase03-policy-approvals.test.ts`, and `tests/contract/src/api-boundaries.test.ts`.

---

### MOD-05: `@aether-forge/orchestration` (`services/orchestration/`)
- **Responsibility:** Durable Temporal workflow engine (`ADR-0003`) coordinating brief submission, plan creation, step policy evaluation, human approval waits, transient activity retries, worker restart replay, and Emergency Stop cancellation.
- **Inputs:** `{ context, brief, bearerToken, canonicalPathScope? }` (`startBriefWorkflow`); `ApprovalSignalInput` (`signalApprovalDecision`); `workflowId` (`simulateWorkerRestartAndReplay`).
- **Outputs:** `Result<GovernedWorkflowState>` (`status`, `plan`, `stepEvaluations`, `pendingApprovalId`, `executedStepIds`, `simulatedWriteCount`, `evidence`, `history`).
- **Dependencies:** `@aether-forge/contracts`, `@aether-forge/api`, `@aether-forge/audit`, `@aether-forge/policy`.
- **Public Interfaces:** `DurableTemporalOrchestrator`, `verifyTemporalStagingNamespaceConfig`, `GOVERNED_WORKFLOW_VERSION`.
- **Internal Components:** Append-only `WorkflowHistoryEvent` log, `executedStepLedger` (`(tenantId, workflowId, stepId)` at-most-once guard), `processedSignalIds` deduplicator, `syncEmergencyStopState`.
- **Failure Conditions:** `DOMAIN_WORKFLOW_NOT_FOUND`, `DOMAIN_WORKFLOW_CANCELLED_BY_EMERGENCY_STOP`, `DOMAIN_APPROVAL_NOT_BOUND_TO_WORKFLOW`, `TEMPORAL_NON_DETERMINISM_DETECTED`.
- **Testing Requirements:** `tests/e2e/src/phase04-vertical-slice.test.ts` (3 tests) and `phase15-production-promotion.test.ts` (5/5 canary soak).

---

### MOD-06: `@aether-forge/provider-gateway` (`services/provider-gateway/`)
- **Responsibility:** Central Intelligence Core & Specialist Agent Planner (`ADR-0005`, `ADR-0006`): prompt template SHA-256 verification, pre-egress credential/path redaction, tenant token/cost quotas, server-side secret isolation, and `ToolManifest`-bounded execution planning.
- **Inputs:** `ModelRequest` (`complete`); `{ context, planningInput, maxCostUsdMicros? }` (`proposePlan`).
- **Outputs:** `Result<ModelResponse>` (with `ModelUsageAuditMetadata`); `Result<ExecutionPlan>`.
- **Dependencies:** `@aether-forge/contracts`, `@aether-forge/audit`, `@aether-forge/policy`, `node:crypto`, `zod`.
- **Public Interfaces:** `ProviderGatewayService`, `ServerSideSecretManager`, `ManagedVendorProviderAdapter`, `DeterministicFakeProviderAdapter`, `PromptTemplateRegistry`, `TenantBudgetTracker`, `inspectAndRedactForEgress`, `ToolManifestRegistry`, `createDefaultToolManifestRegistry`, `BoundedExecutionPlanner`.
- **Internal Components:** Regex secret & user-path redaction scanner, token/cost reservation tracker, `ProposedPlanDraftSchema` validator, tool registry & `actionClass` cross-checker.
- **Failure Conditions:** `DOMAIN_PROMPT_TEMPLATE_UNREGISTERED`, `DOMAIN_EGRESS_SECRET_CLASSIFICATION_DENIED`, `DOMAIN_EGRESS_RESTRICTED_LOCAL_DENIED`, `DOMAIN_EGRESS_RAW_SECRET_DETECTED`, `DOMAIN_PROVIDER_NOT_CONFIGURED`, `DOMAIN_PROVIDER_BUDGET_EXCEEDED`, `DOMAIN_PLANNER_MALFORMED_OUTPUT`, `DOMAIN_PLANNER_UNREGISTERED_OR_UNSAFE_TOOL`, `DOMAIN_PLANNER_TOOL_ACTION_CLASS_MISMATCH`.
- **Testing Requirements:** `tests/security/src/phase05-provider-planner.test.ts` (4 tests) and `phase14-staging-providers.test.ts` (2 tests).

---

### MOD-07: `@aether-forge/knowledge` (`services/knowledge/`)
- **Responsibility:** Evidence-Addressable Knowledge Engine (`ADR-0007`) enforcing MIME/classification gates, malware/prompt-injection quarantine, SHA-256 content hashing, immutable object storage, line-range chunk provenance citations, and synchronous deletion propagation.
- **Inputs:** `{ context, sourceId, projectId, title, mimeType, classification, contentUtf8 }` (`ingestSource`); `{ context, sourceId }` (`deleteSource`); `{ context, projectId, query, topK? }` (`retrieve`).
- **Outputs:** `Result<KnowledgeSourceMetadata>`, `Result<GroundedContextResponse>` (with `uncitedInferenceLabel: "model_inference"`), `PostgresMigrationVerificationReceipt`.
- **Dependencies:** `@aether-forge/contracts`, `@aether-forge/audit`, `node:crypto`, `node:fs`.
- **Public Interfaces:** `EvidenceAddressableKnowledgeService`, `ImmutableLocalObjectStore`, `verifyPostgresPgvectorMigrationSql`.
- **Internal Components:** `migrations/0001_knowledge_pgvector.sql`, `UNSAFE_CONTENT_PATTERNS` quarantine scanner, line-range chunker (`10` lines/chunk), lexical overlap scorer.
- **Failure Conditions:** `DOMAIN_KNOWLEDGE_SECRET_CLASSIFICATION_DENIED`, `DOMAIN_KNOWLEDGE_UNSUPPORTED_MIME_TYPE`, `DOMAIN_KNOWLEDGE_INPUT_QUARANTINED`, `DOMAIN_KNOWLEDGE_SOURCE_NOT_FOUND`.
- **Testing Requirements:** `tests/security/src/phase07-knowledge-substrate.test.ts` (3 tests) and `phase14-staging-providers.test.ts`.

---

### MOD-08: `@aether-forge/filesystem` & `@aether-forge/git` (`adapters/filesystem/`, `adapters/git/`)
- **Responsibility:** Constrained local workstation filesystem and Git repository boundary (`ADR-0001`) defending against path traversal, drive/UNC injection, symlinks, Windows NTFS junctions/reparse points, TOCTOU races, and partial files on cancellation.
- **Inputs:** `{ grantedCanonicalRoots, relativeTargetPath, traceId }` (`resolveAndVerifyGrantedPath`, `inspectWorkspaceFile`); `{ ..., contentUtf8, expectedPriorSha256?, isCancelled? }` (`atomicWriteWorkspaceFile`).
- **Outputs:** `Result<{ canonicalRoot, canonicalTarget }>`, `Result<WorkspaceManifestInspection>`, `Result<AtomicWriteOutcome>`, `Result<GitWorkspaceVerification>`.
- **Dependencies:** `@aether-forge/contracts`, `node:fs`, `node:path`, `node:crypto`.
- **Public Interfaces:** `resolveAndVerifyGrantedPath`, `inspectWorkspaceFile`, `atomicWriteWorkspaceFile`, `verifyGrantedGitWorkspace`.
- **Internal Components:** `hasSymlinkOrReparsePointInChain` (`lstatSync` + `realpathSync.native`), exclusive `.tmp-<random>` staging writer (`openSync(..., "wx")` + `fsyncSync`), pre-commit TOCTOU SHA-256 verifier, atomic `renameSync`.
- **Failure Conditions:** `DOMAIN_WORKER_PATH_ESCAPE_DENIED`, `DOMAIN_WORKER_REPARSE_POINT_DENIED`, `DOMAIN_WORKER_TOCTOU_CONFLICT`, `DOMAIN_WORKER_JOB_CANCELLED`.
- **Testing Requirements:** `tests/security/src/phase06-windows-worker.test.ts` and `phase09-fl-studio-2025.test.ts`.

---

### MOD-09: `@aether-forge/windows-host` & `AetherForge.WindowsWorker.exe` (`workers/windows-host/`)
- **Responsibility:** Local Windows 11 Worker trust boundary (`ADR-0001`, `ADR-0010`, `INV-02`): DPAPI-backed machine identity storage, outbound mTLS session & heartbeat, constant-time `JobManifest` and `CapabilityGrant` signature verification, and dispatch to constrained filesystem, offline audio DSP, and FL Studio 2025 adapters.
- **Inputs:** Signed `WorkerJob` (`executeJobManifest`); `CapabilityGrant` (`inspectGrantedManifest`); CLI flags `--self-test` / `--verify-path <root> <target>` (`AetherForge.WindowsWorker.exe`).
- **Outputs:** `Result<JobReceipt>` (with `EvidenceRef[]`); `Result<HeartbeatRecord>`.
- **Dependencies:** `@aether-forge/contracts`, `@aether-forge/filesystem`, `@aether-forge/audio-engine`, `@aether-forge/fl-studio-2025`, Windows Framework64 `csc.exe` + `System.Security.dll` (`ProtectedData`).
- **Public Interfaces:** `WindowsWorkerHost`, `DpapiBackedIdentityStore`, `MockWorkerGateway`, `computeGrantSignature`, `computeJobManifestSignature`, `NativeWorkerCli` (`NativeWorkerCli.cs`).
- **Internal Components:** `src/index.ts`, `NativeWorkerCli.cs`, `Program.cs`, `AetherForge.WindowsWorker.csproj`, `artifacts/native/AetherForge.WindowsWorker.exe`.
- **Failure Conditions:** `DOMAIN_WORKER_UNENROLLED`, `DOMAIN_WORKER_MANIFEST_SIGNATURE_INVALID`, `DOMAIN_WORKER_GRANT_SIGNATURE_INVALID`, `DOMAIN_WORKER_GRANT_EXPIRED`, `DOMAIN_WORKER_GRANT_REVOKED`, `DOMAIN_WORKER_GRANT_ACTION_CLASS_MISMATCH`.
- **Testing Requirements:** `tests/security/src/phase06-windows-worker.test.ts` (3 tests) and `phase13-native-compilation.test.ts` (2 tests).

---

### MOD-10: `@aether-forge/audio-engine` (`workers/audio-engine/`)
- **Responsibility:** Local offline deterministic audio DSP engine (`ADR-0008`) performing 16-bit linear PCM RIFF/WAVE header inspection and `<0.01 dB` peak gain normalization to new atomic output files within resource quotas.
- **Inputs:** `AudioJob` (`operation: "inspect_wav" | "gain_normalize"`, `inputPath`, `outputPath?`, `targetPeakDbfs?`, `quotas`).
- **Outputs:** `Result<AudioArtifactResult>` (`inspection`, `outputSha256`, `outputPeakDbfs`, `gainAppliedDb`, `canonicalOutputPath`) + `EvidenceRef` (`producer: "audio-engine"`, `classification: "RESTRICTED_LOCAL"`).
- **Dependencies:** `@aether-forge/contracts`, `@aether-forge/filesystem`, `node:fs`, `node:crypto` (+ Rust crate `workers/audio-engine/src/lib.rs`).
- **Public Interfaces:** `executeOfflineAudioJob`, `parseAndInspectPcm16WavBuffer`, `synthesizeGoldenPcm16Wav` (+ Rust `parse_pcm16_wav_header`, `gain_normalize_pcm16_wav`).
- **Internal Components:** 44-byte RIFF/WAVE PCM16 parser, byte/duration/execution-time quota guard, source-overwrite blocker, sample-accurate linear gain scaler, atomic `.tmp-*` writer.
- **Failure Conditions:** `DOMAIN_AUDIO_FORMAT_INVALID`, `DOMAIN_AUDIO_QUOTA_EXCEEDED`, `DOMAIN_AUDIO_OVERWRITE_SOURCE_FORBIDDEN`, `DOMAIN_AUDIO_JOB_CANCELLED`.
- **Testing Requirements:** `tests/security/src/phase08-audio-engine.test.ts` (2 tests) and `tests/performance/src/phase12-performance.test.ts` (`<50 ms` for 1s 48 kHz stereo WAV).

---

### MOD-11: `@aether-forge/daw-contract` & `@aether-forge/fl-studio-2025` (`adapters/daw-contract/`, `adapters/fl-studio-2025/`)
- **Responsibility:** Tier-qualified FL Studio 2025 (`25.1.6.4997`) adapter (`ADR-0009`, `INV-04`) supporting read-only binary & `.flp` (`FLhd`/`FLdt` + `0xC7` `FLP_Version`) `inspect` and backup-mandatory `non_destructive_edit` while hard-blocking unqualified `session_mutation`, `render`, and unattended UI automation.
- **Inputs:** `DawCommand` (`dawTarget: "fl-studio-2025"`, `capabilityTier`, `operation`, `backupRequired`, `foregroundUiFallbackOptIn`, `parameters`) + `DawInvokeOptions` (`grantedCanonicalRoots`, `traceId`, `isCancelled?`).
- **Outputs:** `Result<readonly DawCapabilityDescriptor[]>` (`discoverCapabilities`); `Result<DawExecutionProof>` (`invoke`) + `EvidenceRef` (`producer: "daw-adapter"`).
- **Dependencies:** `@aether-forge/contracts`, `@aether-forge/daw-contract`, `@aether-forge/filesystem`, local FL Studio 2025 (`C:\Program Files\Image-Line\FL Studio 2025`), Python `3.14`.
- **Public Interfaces:** `DawAdapterContract`, `FlStudio2025Adapter`, `parseFlpHeaderBuffer`, `synthesizeMinimalFlpBuffer`, `device_aetherforge_inspect.py`.
- **Internal Components:** Host binary prober (`FL64.exe` / `FLEngine_x64.dll`), `FLhd`/`FLdt` + varint `0xC7` version parser, `.bak` backup & scratch copy stager, UI automation blocker.
- **Failure Conditions:** `DOMAIN_DAW_CAPABILITY_UNQUALIFIED`, `DOMAIN_DAW_UI_AUTOMATION_PROHIBITED`, `DOMAIN_DAW_BACKUP_REQUIRED`, `DOMAIN_DAW_OVERWRITE_SOURCE_FORBIDDEN`, `DOMAIN_DAW_FLP_FORMAT_INVALID`.
- **Testing Requirements:** `tests/security/src/phase09-fl-studio-2025.test.ts` (4 tests including real `NewStuff.flp`) and `phase13-native-compilation.test.ts`.

---

### MOD-12: `@aether-forge/vst3` (`plugins/vst3/`)
- **Responsibility:** Isolated C++20 real-time VST3 processor core (`ADR-0008`), static real-time C++20 source auditor, 16-byte `"AFV3"` POD state round-trip serializer, and native SDK prerequisite gate.
- **Inputs:** Multi-channel `Float32Array[]` / `float* const*` audio blocks, `gainDb` (`[-60, +24]`), `bypass`, 16-byte state buffers.
- **Outputs:** Gain-processed audio buffers, 16-byte serialized state, `Vst3BuildPrerequisites`, real-time C++20 audit report (`{ compliant, violations }`).
- **Dependencies:** `@aether-forge/contracts`, CMake `4.4.1` (+ external C++20 compiler, JUCE 8, Steinberg VST3 SDK, `pluginval` when provisioned).
- **Public Interfaces:** `AetherForgeRealtimeCore` (`AetherForgeProcessor.h`), `AetherForgeVst3ReferenceProcessor`, `auditVst3RealtimeCppSources`, `discoverVst3BuildPrerequisites`.
- **Internal Components:** `AetherForgeProcessor/AetherForgeProcessor.h`, `AetherForgeProcessor.cpp`, `CMakeLists.txt`, `tests/AetherForgeProcessorTests.cpp`, `src/index.ts`.
- **Failure Conditions:** Rejects corrupted state buffers (`magic !== 0x33564641` or `version !== 1`); reports `BLOCKED_MISSING_PREREQUISITES` when native SDKs are absent.
- **Testing Requirements:** `tests/security/src/phase10-vst3-boundary.test.ts` (3 tests).

---

### MOD-13: `@aether-forge/web`, `@aether-forge/ui`, `@aether-forge/sdk`, `@aether-forge/config` (`apps/web/`, `packages/*`)
- **Responsibility:** User Interface & Client SDK boundary rendering the 4 governed Web Control Plane screens and serving the 5 OpenAPI 3.1 JSON REST endpoints without holding provider secrets.
- **Inputs:** Browser HTTP `GET /`, `POST /ui/submit-brief`, `POST /ui/approve`, `POST /ui/emergency-stop`, `GET /api/v1/health`, `POST /api/v1/briefs`, `POST /api/v1/plans`, `POST /api/v1/approvals/:id/decision`, `POST /api/v1/system/emergency-stop`.
- **Outputs:** Semantic, XSS-escaped HTML5 dashboard (`renderControlPlaneDashboardHtml`) and contract-validated JSON `Result<T>` responses.
- **Dependencies:** `@aether-forge/contracts`, `@aether-forge/api`, `@aether-forge/orchestration`, `@aether-forge/windows-host`, `node:http`.
- **Public Interfaces:** `createWebControlPlaneServer`, `renderControlPlaneDashboardHtml`, `WebControlPlaneClient`, `formatPolicyDecisionBadgeLabel`, `PlatformConfigSchema`, `DEFAULT_PLATFORM_CONFIG`.
- **Internal Components:** `apps/web/src/screens.ts`, `apps/web/src/server.ts`, `apps/web/src/dev-server.ts`, `packages/ui/src/index.ts`, `packages/config/src/index.ts`, `packages/sdk/src/index.ts`.
- **Failure Conditions:** Returns HTTP `400` on invalid JSON/form body, `403` on role/policy denial, `404` on cross-tenant/missing resource, `409` on idempotency conflict or stale approval drift, and `423` when Emergency Stop is active.
- **Testing Requirements:** `tests/e2e/src/phase04-vertical-slice.test.ts` and `tests/contract/src/api-boundaries.test.ts`.

---

### MOD-14: `@aether-forge/observability` & `@aether-forge/artifact-registry` (`packages/observability/`, `services/artifact-registry/`)
- **Responsibility:** 5-boundary W3C OpenTelemetry trace correlation, high-severity alert engine, CycloneDX 1.5 SBOM generation, workspace secret scanning, SLSA v1.0 provenance attestation, constant-time artifact signature verification, dual-control `Reviewer` + `ReleaseManager` production promotion, and deterministic rollback selection (`ADR-0010`, `INV-05`).
- **Inputs:** Boundary span records, `AuditEvent[]`, `EvidenceRef[]`, release binary payloads, dual-control `Approval` pairs.
- **Outputs:** `CorrelatedJobDashboardView`, `AlertFiring[]`, `CycloneDxSbom`, `PublishedArtifactRecord` (`ArtifactRef` + `SlsaProvenanceAttestation`), rollback `ArtifactRef`.
- **Dependencies:** `@aether-forge/contracts`, `@aether-forge/audit`, `node:crypto`, `node:fs`.
- **Public Interfaces:** `OtelTraceCollector`, `ObservabilityMetricsEngine`, `correlateEndToEndJobDashboard`, `generateCycloneDxSbom`, `scanWorkspaceSourceForSecrets`, `SignedArtifactRegistry`.
- **Internal Components:** W3C `traceparent` parser/formatter, CycloneDX 1.5 dependency builder, secret regex walker, HMAC/cosign provenance signer, dual-control actor separator.
- **Failure Conditions:** `DOMAIN_ARTIFACT_MISSING_TEST_EVIDENCE`, `DOMAIN_ARTIFACT_TAMPERED_OR_UNSIGNED`, `DOMAIN_ARTIFACT_REVOKED`, `DOMAIN_RELEASE_CANARY_SOAK_REQUIRED`, `DOMAIN_RELEASE_DUAL_CONTROL_VIOLATION`, `DOMAIN_RELEASE_APPROVAL_BINDING_INVALID`.
- **Testing Requirements:** `tests/security/src/phase11-observability-abuse.test.ts` (3 tests), `tests/e2e/src/phase12-release-candidate.test.ts`, and `phase15-production-promotion.test.ts`.
