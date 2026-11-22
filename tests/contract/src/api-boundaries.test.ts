import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import {
  ConfigurableOidcVerifier,
  GovernedDomainApiService,
  TenantMembershipRegistry,
} from "@aether-forge/api";
import { DurableTemporalOrchestrator } from "@aether-forge/orchestration";
import {
  CreatePlanRequestSchema,
  CreatePlanResponseSchema,
  DecideApprovalRequestSchema,
  DecideApprovalResponseSchema,
  SubmitBriefRequestSchema,
  SubmitBriefResponseSchema,
  TriggerEmergencyStopRequestSchema,
  TriggerEmergencyStopResponseSchema,
} from "@aether-forge/sdk";
import {
  sampleApproval,
  sampleBrief,
  samplePlanHash,
  sampleProductSpec,
  sampleRequestContext,
} from "@aether-forge/test-fixtures";
import { createWebControlPlaneServer } from "@aether-forge/web";

describe("Cross-module API & SDK contract boundary suite", () => {
  it("validates SubmitBriefRequest, CreatePlanRequest, DecideApprovalRequest, and TriggerEmergencyStopRequest", () => {
    const submitBrief = SubmitBriefRequestSchema.parse({
      context: sampleRequestContext,
      brief: sampleBrief,
    });
    expect(submitBrief.brief.briefId).toBe("brief-0001");

    const createPlan = CreatePlanRequestSchema.parse({
      context: sampleRequestContext,
      spec: sampleProductSpec,
    });
    expect(createPlan.spec.specId).toBe("spec-0001");

    const decideApproval = DecideApprovalRequestSchema.parse({
      context: sampleRequestContext,
      approvalId: sampleApproval.approvalId,
      planId: sampleApproval.planId,
      planHash: samplePlanHash,
      stepId: sampleApproval.stepId,
      policyVersion: sampleApproval.policyVersion,
      decision: "APPROVED",
      rationale: sampleApproval.rationale,
    });
    expect(decideApproval.decision).toBe("APPROVED");

    const emergencyStop = TriggerEmergencyStopRequestSchema.parse({
      context: sampleRequestContext,
      scope: "PROJECT",
      targetId: "proj-synth-01",
      reason: "Manual operator verification of emergency stop contract",
    });
    expect(emergencyStop.scope).toBe("PROJECT");
  });

  it("serves all OpenAPI 3.1 JSON REST endpoints (/api/v1/health, /api/v1/briefs, /api/v1/plans, /api/v1/approvals/{id}/decision, /api/v1/system/emergency-stop) with contract-valid Result<T> envelopes", async () => {
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

    oidcVerifier.registerToken("token-alpha-owner", {
      sub: "actor-owner-01",
      tenantId: "tenant-alpha",
      roles: ["Owner"],
      projectIds: ["proj-synth-01"],
      expUnixSeconds: 4_000_000_000,
    });
    membershipRegistry.registerMember({
      tenantId: "tenant-alpha",
      actorId: "actor-owner-01",
      roles: ["Owner"],
      projectIds: ["proj-synth-01"],
    });

    const api = new GovernedDomainApiService({ oidcVerifier, membershipRegistry });
    const orchestrator = new DurableTemporalOrchestrator(api);
    const { server } = createWebControlPlaneServer({
      api,
      orchestrator,
      defaultTenantId: "tenant-alpha",
      defaultProjectId: "proj-synth-01",
      defaultBearerToken: "token-alpha-builder",
      ownerBearerToken: "token-alpha-owner",
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      // 1. GET /api/v1/health
      const healthRes = await fetch(`${baseUrl}/api/v1/health`);
      expect(healthRes.status).toBe(200);
      const healthJson = (await healthRes.json()) as { ok: boolean; schemaVersion: string };
      expect(healthJson.ok).toBe(true);

      // 2. POST /api/v1/briefs
      const briefRes = await fetch(`${baseUrl}/api/v1/briefs`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer token-alpha-builder",
        },
        body: JSON.stringify({
          context: sampleRequestContext,
          brief: sampleBrief,
        }),
      });
      expect(briefRes.status).toBe(200);
      const briefEnvelope = SubmitBriefResponseSchema.parse(await briefRes.json());
      expect(briefEnvelope.ok).toBe(true);

      // 3. POST /api/v1/plans
      const planRes = await fetch(`${baseUrl}/api/v1/plans`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer token-alpha-builder",
        },
        body: JSON.stringify({
          context: { ...sampleRequestContext, idempotencyKey: "idem-rest-plan-01" },
          spec: sampleProductSpec,
        }),
      });
      expect(planRes.status).toBe(200);
      const planEnvelope = CreatePlanResponseSchema.parse(await planRes.json());
      expect(planEnvelope.ok).toBe(true);
      if (!planEnvelope.ok) return;

      // 4. POST /api/v1/approvals/{approvalId}/decision
      api.approvals.createPendingApproval({
        approvalId: "appr-rest-01",
        tenantId: "tenant-alpha",
        projectId: "proj-synth-01",
        planId: planEnvelope.value.planId,
        planHash: planEnvelope.value.planHash,
        stepId: planEnvelope.value.steps[1]!.stepId,
        actionClass: "write_workspace",
        policyVersion: api.getPolicyVersion(),
        canonicalPathScope: ["C:/AetherForgeWorkspaces/proj-synth-01"],
      });

      const decisionRes = await fetch(`${baseUrl}/api/v1/approvals/appr-rest-01/decision`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer token-alpha-builder",
        },
        body: JSON.stringify({
          context: { ...sampleRequestContext, idempotencyKey: "idem-rest-appr-01" },
          approvalId: "appr-rest-01",
          planId: planEnvelope.value.planId,
          planHash: planEnvelope.value.planHash,
          stepId: planEnvelope.value.steps[1]!.stepId,
          policyVersion: api.getPolicyVersion(),
          decision: "APPROVED",
          rationale: "REST OpenAPI 3.1 contract verification",
        }),
      });
      expect(decisionRes.status).toBe(200);
      const decisionEnvelope = DecideApprovalResponseSchema.parse(await decisionRes.json());
      expect(decisionEnvelope.ok).toBe(true);

      // 5. POST /api/v1/system/emergency-stop (returns 423 on subsequent brief submission)
      const stopRes = await fetch(`${baseUrl}/api/v1/system/emergency-stop`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer token-alpha-owner",
        },
        body: JSON.stringify({
          context: {
            ...sampleRequestContext,
            actor: {
              actorId: "actor-owner-01",
              principalType: "human",
              roles: ["Owner"],
            },
            idempotencyKey: "idem-rest-stop-01",
          },
          scope: "PROJECT",
          targetId: "proj-synth-01",
          reason: "REST OpenAPI 3.1 emergency stop verification",
        }),
      });
      expect(stopRes.status).toBe(200);
      const stopEnvelope = TriggerEmergencyStopResponseSchema.parse(await stopRes.json());
      expect(stopEnvelope.ok).toBe(true);

      // Subsequent POST /api/v1/briefs returns HTTP 423 Locked
      const lockedRes = await fetch(`${baseUrl}/api/v1/briefs`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer token-alpha-builder",
        },
        body: JSON.stringify({
          context: { ...sampleRequestContext, idempotencyKey: "idem-rest-after-stop" },
          brief: sampleBrief,
        }),
      });
      expect(lockedRes.status).toBe(423);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    }
  });
});
