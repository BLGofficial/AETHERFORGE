import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ConfigurableOidcVerifier,
  GovernedDomainApiService,
  TenantMembershipRegistry,
} from "@aether-forge/api";
import {
  generateCycloneDxSbom,
  SignedArtifactRegistry,
} from "@aether-forge/artifact-registry";
import { synthesizeGoldenPcm16Wav } from "@aether-forge/audio-engine";
import {
  type CapabilityGrant,
  SCHEMA_VERSION_V1,
  type WorkerJob,
} from "@aether-forge/contracts";
import { synthesizeMinimalFlpBuffer } from "@aether-forge/fl-studio-2025";
import { EvidenceAddressableKnowledgeService } from "@aether-forge/knowledge";
import {
  correlateEndToEndJobDashboard,
  OtelTraceCollector,
} from "@aether-forge/observability";
import { DurableTemporalOrchestrator } from "@aether-forge/orchestration";
import { BoundedExecutionPlanner } from "@aether-forge/provider-gateway";
import { discoverVst3BuildPrerequisites } from "@aether-forge/vst3";
import { renderControlPlaneDashboardHtml } from "@aether-forge/web";
import {
  computeGrantSignature,
  computeJobManifestSignature,
  MockWorkerGateway,
  WindowsWorkerHost,
} from "@aether-forge/windows-host";
import { sampleBrief, sampleRequestContext } from "@aether-forge/test-fixtures";

const currentDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(currentDir, "../../..");

describe("PHASE 12 — Full integrated vertical slice and release candidate verification gate", () => {
  let localWorkspaceDir: string;

  beforeEach(() => {
    localWorkspaceDir = mkdtempSync(join(tmpdir(), "aetherforge-p12-rc-"));
    mkdirSync(join(localWorkspaceDir, "stems"), { recursive: true });
    mkdirSync(join(localWorkspaceDir, "renders"), { recursive: true });
    mkdirSync(join(localWorkspaceDir, "sessions"), { recursive: true });
    mkdirSync(join(localWorkspaceDir, "backups"), { recursive: true });
    mkdirSync(join(localWorkspaceDir, "scratch"), { recursive: true });
    mkdirSync(join(localWorkspaceDir, "outputs"), { recursive: true });

    writeFileSync(
      join(localWorkspaceDir, "stems", "lead.wav"),
      synthesizeGoldenPcm16Wav({
        sampleRate: 48_000,
        channels: 2,
        frameCount: 2_400,
        frequencyHz: 440,
        peakAmplitudeInt16: 16_384,
      }),
    );
    writeFileSync(
      join(localWorkspaceDir, "sessions", "rc1_project.flp"),
      synthesizeMinimalFlpBuffer({ channelCount: 12, ppq: 96 }),
    );
  });

  afterEach(() => {
    rmSync(localWorkspaceDir, { recursive: true, force: true });
  });

  it("executes complete vertical slice: Brief -> Knowledge -> Planner -> Policy -> Approval -> Temporal -> Windows Worker (Filesystem + Audio DSP + Qualified FL Studio 2025 Inspect) -> Evidence/Audit -> UI -> Signed RC & Rollback Rehearsal", () => {
    const traceCollector = new OtelTraceCollector();
    const oidcVerifier = new ConfigurableOidcVerifier();
    const membershipRegistry = new TenantMembershipRegistry();

    oidcVerifier.registerToken("token-alpha-builder", {
      sub: "actor-builder-01",
      tenantId: "tenant-alpha",
      roles: ["Builder"],
      projectIds: ["proj-synth-01"],
      expUnixSeconds: 4_000_000_000,
    });
    membershipRegistry.registerMember({
      tenantId: "tenant-alpha",
      actorId: "actor-builder-01",
      roles: ["Builder"],
      projectIds: ["proj-synth-01"],
    });

    const api = new GovernedDomainApiService({ oidcVerifier, membershipRegistry });
    const orchestrator = new DurableTemporalOrchestrator(api);
    const knowledge = new EvidenceAddressableKnowledgeService({ auditStore: api.auditStore });
    const planner = new BoundedExecutionPlanner({
      policyDecisionPoint: api.policyDecisionPoint,
    });
    const workerGateway = new MockWorkerGateway();
    const worker = new WindowsWorkerHost(workerGateway);

    expect(
      worker.enrollAndConnect({
        workerId: "worker-win11-rc1",
        tenantId: "tenant-alpha",
        machineThumbprint: "thumb-rc1-workstation",
      }),
    ).toBe(true);

    const traceId = sampleRequestContext.traceId;

    // 1. Web Span: Ingest grounded reference knowledge & retrieve citations
    const webSpan = traceCollector.recordSpan({
      traceId,
      boundary: "web",
      operationName: "web.submitBriefWithKnowledge",
      tenantId: "tenant-alpha",
      projectId: "proj-synth-01",
    });

    const ingestRes = knowledge.ingestSource({
      context: sampleRequestContext,
      sourceId: "src-rc1-spec",
      projectId: "proj-synth-01",
      title: "RC1 Audio & FL Studio 2025 Specification",
      mimeType: "text/markdown",
      classification: "CONFIDENTIAL",
      contentUtf8: "Normalize lead.wav to -1.0 dBFS and inspect rc1_project.flp in FL Studio 2025.",
    });
    expect(ingestRes.ok).toBe(true);
    if (!ingestRes.ok) return;

    const retrieval = knowledge.retrieve({
      context: sampleRequestContext,
      projectId: "proj-synth-01",
      query: "Normalize lead.wav FL Studio 2025",
    });
    expect(retrieval.ok).toBe(true);
    if (!retrieval.ok) return;
    expect(retrieval.value.chunks).toHaveLength(1);

    // 2. API & Planner Span: Propose bounded execution plan with citations
    const apiSpan = traceCollector.recordSpan({
      traceId,
      parentTraceparent: webSpan.traceparent,
      boundary: "api",
      operationName: "api.proposeBoundedPlan",
      tenantId: "tenant-alpha",
      projectId: "proj-synth-01",
    });

    const proposedPlanRes = planner.proposePlan({
      context: sampleRequestContext,
      planningInput: {
        schemaVersion: SCHEMA_VERSION_V1,
        specId: "spec-rc1",
        tenantId: "tenant-alpha",
        projectId: "proj-synth-01",
        objective: sampleBrief.objective,
        availableTools: [...planner.toolRegistry.listTools()],
        citations: retrieval.value.chunks.map((c) => c.citation),
        tokenBudget: 4096,
      },
    });
    expect(proposedPlanRes.ok).toBe(true);
    if (!proposedPlanRes.ok) return;

    // 3. Temporal Span: Run durable workflow, pause for approval, then approve
    const temporalSpan = traceCollector.recordSpan({
      traceId,
      parentTraceparent: apiSpan.traceparent,
      boundary: "temporal",
      operationName: "temporal.executeGovernedWorkflow",
      tenantId: "tenant-alpha",
      projectId: "proj-synth-01",
    });

    const wfStart = orchestrator.startBriefWorkflow({
      context: sampleRequestContext,
      brief: sampleBrief,
      bearerToken: "token-alpha-builder",
      canonicalPathScope: [localWorkspaceDir],
    });
    expect(wfStart.ok).toBe(true);
    if (!wfStart.ok) return;
    expect(wfStart.value.status).toBe("WAITING_FOR_APPROVAL");

    const wfCompleted = orchestrator.signalApprovalDecision(wfStart.value.workflowId, {
      signalId: "sig-rc1-approve",
      context: { ...sampleRequestContext, idempotencyKey: "idem-rc1-approve" },
      approvalId: wfStart.value.pendingApprovalId!,
      decision: "APPROVED",
      rationale: "RC1 vertical slice approval",
      bearerToken: "token-alpha-builder",
    });
    expect(wfCompleted.ok).toBe(true);
    if (!wfCompleted.ok) return;
    expect(wfCompleted.value.status).toBe("COMPLETED");

    // 4. Windows Worker & Adapters Span: Execute signed local Workspace Write, Offline Audio DSP, and Qualified FL Studio 2025 Inspect
    const workerSpan = traceCollector.recordSpan({
      traceId,
      parentTraceparent: temporalSpan.traceparent,
      boundary: "worker",
      operationName: "worker.executeApprovedLocalJobs",
      tenantId: "tenant-alpha",
      projectId: "proj-synth-01",
    });
    traceCollector.recordSpan({
      traceId,
      parentTraceparent: workerSpan.traceparent,
      boundary: "adapter",
      operationName: "adapter.filesystem_audio_flstudio2025",
      tenantId: "tenant-alpha",
      projectId: "proj-synth-01",
    });

    const makeSignedGrant = (
      grantId: string,
      stepId: string,
      actionClass: CapabilityGrant["actionClass"],
    ): CapabilityGrant => {
      const unsignedGrant: Omit<CapabilityGrant, "signature"> = {
        schemaVersion: SCHEMA_VERSION_V1,
        grantId,
        tenantId: "tenant-alpha",
        projectId: "proj-synth-01",
        workerId: "worker-win11-rc1",
        planId: wfCompleted.value.plan.planId,
        planHash: wfCompleted.value.plan.planHash,
        stepId,
        actionClass,
        canonicalPathScope: [localWorkspaceDir],
        policyVersion: api.getPolicyVersion(),
        issuedAt: "2026-11-22T20:00:00Z",
        expiresAt: "2026-11-23T20:00:00Z",
        revoked: false,
      };
      return {
        ...unsignedGrant,
        signature: computeGrantSignature(unsignedGrant, workerGateway.controlPlaneSigningSecret),
      };
    };

    const nowMs = Date.parse("2026-11-22T21:00:00Z");

    // 4a. Local Constrained Workspace Write
    const writeGrant = makeSignedGrant("grant-rc1-write", "step-2-write_workspace", "write_workspace");
    const writeJobBase: Omit<WorkerJob, "manifestSignature"> = {
      schemaVersion: SCHEMA_VERSION_V1,
      jobId: "job-rc1-write",
      traceId,
      idempotencyKey: "idem-rc1-write",
      stepId: "step-2-write_workspace",
      grant: writeGrant,
      payload: {
        kind: "workspace_write",
        targetRelativePath: "outputs/rc1-summary.json",
        contentUtf8: JSON.stringify({ releaseCandidate: "v1.0.0-rc1", verified: true }),
      },
    };
    const writeReceipt = worker.executeJobManifest(
      {
        ...writeJobBase,
        manifestSignature: computeJobManifestSignature(
          writeJobBase,
          workerGateway.controlPlaneSigningSecret,
        ),
      },
      { nowMs },
    );
    expect(writeReceipt.ok).toBe(true);

    // 4b. Local Offline Audio Engine Gain Normalization
    const audioGrant = makeSignedGrant("grant-rc1-audio", "step-3-audio_dsp", "audio_dsp");
    const audioJobBase: Omit<WorkerJob, "manifestSignature"> = {
      schemaVersion: SCHEMA_VERSION_V1,
      jobId: "job-rc1-audio",
      traceId,
      idempotencyKey: "idem-rc1-audio",
      stepId: "step-3-audio_dsp",
      grant: audioGrant,
      payload: {
        kind: "audio_job",
        audioJob: {
          schemaVersion: SCHEMA_VERSION_V1,
          audioJobId: "audio-rc1-norm",
          operation: "gain_normalize",
          inputPath: "stems/lead.wav",
          outputPath: "renders/lead_norm.wav",
          targetPeakDbfs: -1.0,
          quotas: {
            maxDurationSeconds: 120,
            maxInputBytes: 20_000_000,
            maxExecutionTimeMs: 15_000,
          },
        },
      },
    };
    const audioReceipt = worker.executeJobManifest(
      {
        ...audioJobBase,
        manifestSignature: computeJobManifestSignature(
          audioJobBase,
          workerGateway.controlPlaneSigningSecret,
        ),
      },
      { nowMs },
    );
    expect(audioReceipt.ok).toBe(true);

    // 4c. Qualified FL Studio 2025 (25.1.6.4997) Read-Only Inspect (included because Phase 09 qualified it)
    const dawGrant = makeSignedGrant("grant-rc1-daw", "step-4-daw_inspect", "daw_inspect");
    const dawJobBase: Omit<WorkerJob, "manifestSignature"> = {
      schemaVersion: SCHEMA_VERSION_V1,
      jobId: "job-rc1-daw",
      traceId,
      idempotencyKey: "idem-rc1-daw",
      stepId: "step-4-daw_inspect",
      grant: dawGrant,
      payload: {
        kind: "daw_command",
        dawCommand: {
          schemaVersion: SCHEMA_VERSION_V1,
          commandId: "daw-rc1-inspect",
          dawTarget: "fl-studio-2025",
          capabilityTier: "inspect",
          operation: "inspect_version_and_session_header",
          backupRequired: false,
          foregroundUiFallbackOptIn: false,
          parameters: { projectRelativePath: "sessions/rc1_project.flp" },
        },
      },
    };
    const dawReceipt = worker.executeJobManifest(
      {
        ...dawJobBase,
        manifestSignature: computeJobManifestSignature(
          dawJobBase,
          workerGateway.controlPlaneSigningSecret,
        ),
      },
      { nowMs },
    );
    expect(dawReceipt.ok).toBe(true);
    if (!writeReceipt.ok || !audioReceipt.ok || !dawReceipt.ok) return;

    // 4d. VST3 binary check: verify Phase 10 prerequisite gate keeps native .vst3 binary explicitly blocked
    const vst3Prereqs = discoverVst3BuildPrerequisites();
    expect(vst3Prereqs.status).toBe("BLOCKED_MISSING_PREREQUISITES");

    // 5. Verify Web UI result rendering and 5-Boundary OpenTelemetry Dashboard correlation
    const allEvidence = [
      ...wfCompleted.value.evidence,
      ...writeReceipt.evidence,
      ...audioReceipt.evidence,
      ...dawReceipt.evidence,
    ];
    const auditTrail = api.auditStore.reconstructTrace("tenant-alpha", traceId);

    const uiHtml = renderControlPlaneDashboardHtml({
      tenantId: "tenant-alpha",
      projectId: "proj-synth-01",
      workflow: {
        ...wfCompleted.value,
        evidence: allEvidence,
      },
      auditTimeline: auditTrail,
    });
    expect(uiHtml).toContain('data-testid="workflow-status">COMPLETED</span>');
    expect(uiHtml).toContain("25.1.6.4997");
    expect(uiHtml).toContain("Deterministic WAV gain_normalize");

    const dashboard = correlateEndToEndJobDashboard({
      tenantId: "tenant-alpha",
      traceId,
      traceCollector,
      auditEvents: auditTrail,
      evidence: allEvidence,
    });
    expect(dashboard.allFiveBoundariesCorrelated).toBe(true);

    // 6. Generate SBOM, publish signed Release Candidate v1.0.0-rc1, and rehearse rollback to v0.9.0-baseline
    const sbomReport = generateCycloneDxSbom(workspaceRoot);
    expect(sbomReport.licenseCompliant).toBe(true);

    const artifactRegistry = new SignedArtifactRegistry();
    const baselineBytes = Buffer.from("aetherforge-release-bundle-v0.9.0-baseline", "utf8");
    const rc1Bytes = Buffer.from(
      readFileSync(join(localWorkspaceDir, "outputs", "rc1-summary.json")),
    );

    const pubBaseline = artifactRegistry.publishSignedArtifact({
      artifactId: "aetherforge-platform-bundle",
      version: "0.9.0-baseline",
      payloadBytes: baselineBytes,
      sbomSha256: sbomReport.sbom.sbomSha256,
      testEvidencePassed: true,
      traceId,
    });
    const pubRc1 = artifactRegistry.publishSignedArtifact({
      artifactId: "aetherforge-platform-bundle",
      version: "1.0.0-rc1",
      payloadBytes: rc1Bytes,
      sbomSha256: sbomReport.sbom.sbomSha256,
      testEvidencePassed: true,
      traceId,
    });
    expect(pubBaseline.ok).toBe(true);
    expect(pubRc1.ok).toBe(true);

    // Verify RC1 signature and rehearse rollback
    const verifyRc1 = artifactRegistry.verifyArtifactForDistribution({
      artifactId: "aetherforge-platform-bundle",
      version: "1.0.0-rc1",
      candidateBytes: rc1Bytes,
      traceId,
    });
    expect(verifyRc1.ok).toBe(true);

    const rollbackRehearsal = artifactRegistry.selectRollbackTarget(
      "aetherforge-platform-bundle",
      "1.0.0-rc1",
      traceId,
    );
    expect(rollbackRehearsal.ok).toBe(true);
    if (rollbackRehearsal.ok) {
      expect(rollbackRehearsal.value.version).toBe("0.9.0-baseline");
    }

    // 7. Release Manager Gate: Builder cannot approve release_publish; ReleaseManager role succeeds
    oidcVerifier.registerToken("token-alpha-release-manager", {
      sub: "actor-rm-01",
      tenantId: "tenant-alpha",
      roles: ["ReleaseManager"],
      projectIds: ["proj-synth-01"],
      expUnixSeconds: 4_000_000_000,
    });
    membershipRegistry.registerMember({
      tenantId: "tenant-alpha",
      actorId: "actor-rm-01",
      roles: ["ReleaseManager"],
      projectIds: ["proj-synth-01"],
    });

    api.approvals.createPendingApproval({
      approvalId: "appr-rc1-release-gate",
      tenantId: "tenant-alpha",
      projectId: "proj-synth-01",
      planId: wfCompleted.value.plan.planId,
      planHash: wfCompleted.value.plan.planHash,
      stepId: "step-release-publish",
      actionClass: "release_publish",
      policyVersion: api.getPolicyVersion(),
      canonicalPathScope: [localWorkspaceDir],
    });

    const builderReleaseAttempt = api.decideApproval(
      {
        context: { ...sampleRequestContext, idempotencyKey: "idem-rm-builder-fail" },
        approvalId: "appr-rc1-release-gate",
        planId: wfCompleted.value.plan.planId,
        planHash: wfCompleted.value.plan.planHash,
        stepId: "step-release-publish",
        policyVersion: api.getPolicyVersion(),
        decision: "APPROVED",
        rationale: "Builder attempting ReleaseManager gate",
      },
      { bearerToken: "token-alpha-builder" },
    );
    expect(builderReleaseAttempt.ok).toBe(false);
    if (!builderReleaseAttempt.ok) {
      expect(builderReleaseAttempt.error.code).toBe("DOMAIN_APPROVER_ROLE_INSUFFICIENT");
    }

    const releaseManagerApprove = api.decideApproval(
      {
        context: {
          ...sampleRequestContext,
          actor: {
            actorId: "actor-rm-01",
            principalType: "human",
            roles: ["ReleaseManager"],
          },
          idempotencyKey: "idem-rm-approve-rc1",
        },
        approvalId: "appr-rc1-release-gate",
        planId: wfCompleted.value.plan.planId,
        planHash: wfCompleted.value.plan.planHash,
        stepId: "step-release-publish",
        policyVersion: api.getPolicyVersion(),
        decision: "APPROVED",
        rationale: "Release Manager approved v1.0.0-rc1 after SBOM, provenance, and rollback verification.",
      },
      { bearerToken: "token-alpha-release-manager" },
    );
    expect(releaseManagerApprove.ok).toBe(true);
  });
});
