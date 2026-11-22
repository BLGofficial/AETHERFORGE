import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ConfigurableOidcVerifier,
  GovernedDomainApiService,
  TenantMembershipRegistry,
} from "@aether-forge/api";
import {
  generateCycloneDxSbom,
  SignedArtifactRegistry,
} from "@aether-forge/artifact-registry";
import {
  type Approval,
  SCHEMA_VERSION_V1,
} from "@aether-forge/contracts";
import { DurableTemporalOrchestrator } from "@aether-forge/orchestration";
import {
  sampleBrief,
  sampleRequestContext,
} from "@aether-forge/test-fixtures";

const currentDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(currentDir, "../../..");

describe("PHASE 15 — Stage 1 canary soak and dual-control Release Manager production promotion (v1.0.0) gate", () => {
  it("runs Stage 1 multi-workflow canary soak with zero errors, enforces dual-control Reviewer + ReleaseManager separation, promotes 1.0.0-rc1 to 1.0.0, and rehearses rollback", () => {
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

    // 1. Stage 1 Canary Soak: execute 5 governed workflows back-to-back with 100% completion and 0 duplicate writes
    for (let i = 1; i <= 5; i += 1) {
      const ctx = {
        ...sampleRequestContext,
        requestId: `req-canary-${i}`,
        traceId: `4bf92f3577b34da6a3ce929d0e0e473${i}`,
        idempotencyKey: `idem-canary-start-${i}`,
      };
      const brief = {
        ...sampleBrief,
        briefId: `brief-canary-${i}`,
      };

      const startRes = orchestrator.startBriefWorkflow({
        context: ctx,
        brief,
        bearerToken: "token-alpha-builder",
      });
      expect(startRes.ok).toBe(true);
      if (!startRes.ok) return;

      const approveRes = orchestrator.signalApprovalDecision(startRes.value.workflowId, {
        signalId: `sig-canary-${i}`,
        context: { ...ctx, idempotencyKey: `idem-canary-approve-${i}` },
        approvalId: startRes.value.pendingApprovalId!,
        decision: "APPROVED",
        rationale: `Canary soak iteration ${i}`,
        bearerToken: "token-alpha-builder",
      });
      expect(approveRes.ok).toBe(true);
      if (approveRes.ok) {
        expect(approveRes.value.status).toBe("COMPLETED");
        expect(approveRes.value.simulatedWriteCount).toBe(1);
      }
    }

    // 2. Prepare signed 0.9.0-baseline and 1.0.0-rc1 artifacts
    const sbomReport = generateCycloneDxSbom(workspaceRoot);
    const registry = new SignedArtifactRegistry();
    const rcPayload = Buffer.from(
      JSON.stringify({ artifact: "aether-forge", version: "1.0.0" }),
      "utf8",
    );

    registry.publishSignedArtifact({
      artifactId: "aetherforge-platform-release",
      version: "0.9.0-baseline",
      payloadBytes: Buffer.from("baseline-0.9.0", "utf8"),
      sbomSha256: sbomReport.sbom.sbomSha256,
      testEvidencePassed: true,
      traceId: sampleRequestContext.traceId,
    });
    registry.publishSignedArtifact({
      artifactId: "aetherforge-platform-release",
      version: "1.0.0-rc1",
      payloadBytes: rcPayload,
      sbomSha256: sbomReport.sbom.sbomSha256,
      testEvidencePassed: true,
      traceId: sampleRequestContext.traceId,
    });

    const reviewerApproval: Approval = {
      schemaVersion: SCHEMA_VERSION_V1,
      approvalId: "appr-reviewer-p15",
      tenantId: "tenant-alpha",
      projectId: "proj-synth-01",
      actor: {
        actorId: "actor-reviewer-01",
        principalType: "human",
        roles: ["Reviewer"],
      },
      planId: "plan-prod-v1",
      planHash: sbomReport.sbom.sbomSha256,
      stepId: "step-release-publish",
      actionClass: "release_publish",
      policyVersion: api.getPolicyVersion(),
      canonicalPathScope: ["C:/AetherForgeWorkspaces/proj-synth-01"],
      decision: "APPROVED",
      status: "APPROVED",
      rationale: "Independent Reviewer sign-off after 5/5 canary soak",
      decidedAt: "2026-11-23T01:40:00Z",
      expiresAt: "2026-11-24T01:40:00Z",
    };

    // 3. Negative Gate: Single actor attempting to self-approve as both Reviewer and ReleaseManager fails closed
    const selfApproveAttempt = registry.promoteReleaseCandidateToProduction({
      artifactId: "aetherforge-platform-release",
      rcVersion: "1.0.0-rc1",
      targetProductionVersion: "1.0.0",
      rcPayloadBytes: rcPayload,
      reviewerApproval,
      releaseManagerApproval: {
        ...reviewerApproval,
        actor: {
          actorId: "actor-reviewer-01", // same actorId!
          principalType: "human",
          roles: ["Reviewer", "ReleaseManager"],
        },
      },
      canarySoakPassed: true,
      traceId: sampleRequestContext.traceId,
    });
    expect(selfApproveAttempt.ok).toBe(false);
    if (!selfApproveAttempt.ok) {
      expect(selfApproveAttempt.error.code).toBe("DOMAIN_RELEASE_DUAL_CONTROL_VIOLATION");
    }

    // 4. Positive Gate: Distinct Reviewer + ReleaseManager actors promote 1.0.0-rc1 -> 1.0.0
    const releaseManagerApproval: Approval = {
      ...reviewerApproval,
      approvalId: "appr-rm-p15",
      actor: {
        actorId: "actor-release-manager-01",
        principalType: "human",
        roles: ["ReleaseManager"],
      },
      rationale: "Release Manager approved production promotion to v1.0.0",
    };

    const promotedRes = registry.promoteReleaseCandidateToProduction({
      artifactId: "aetherforge-platform-release",
      rcVersion: "1.0.0-rc1",
      targetProductionVersion: "1.0.0",
      rcPayloadBytes: rcPayload,
      reviewerApproval,
      releaseManagerApproval,
      canarySoakPassed: true,
      traceId: sampleRequestContext.traceId,
    });
    expect(promotedRes.ok).toBe(true);
    if (!promotedRes.ok) return;

    expect(promotedRes.value.artifactRef.version).toBe("1.0.0");

    // 5. Verify instant rollback target from 1.0.0 selects 1.0.0-rc1
    const rollbackRes = registry.selectRollbackTarget(
      "aetherforge-platform-release",
      "1.0.0",
      sampleRequestContext.traceId,
    );
    expect(rollbackRes.ok).toBe(true);
    if (rollbackRes.ok) {
      expect(rollbackRes.value.version).toBe("1.0.0-rc1");
    }
  });
});
