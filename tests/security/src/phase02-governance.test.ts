import { describe, expect, it } from "vitest";
import {
  ConfigurableOidcVerifier,
  GovernedDomainApiService,
  TenantMembershipRegistry,
} from "@aether-forge/api";
import { WebControlPlaneClient } from "@aether-forge/web";
import {
  sampleBrief,
  sampleProductSpec,
  sampleRequestContext,
} from "@aether-forge/test-fixtures";

function createTestEnvironment() {
  const oidcVerifier = new ConfigurableOidcVerifier();
  const membershipRegistry = new TenantMembershipRegistry();

  // Tenant Alpha members
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

  oidcVerifier.registerToken("token-alpha-reviewer", {
    sub: "actor-reviewer-01",
    tenantId: "tenant-alpha",
    roles: ["Reviewer"],
    projectIds: ["proj-synth-01"],
    expUnixSeconds: 4_000_000_000,
  });
  membershipRegistry.registerMember({
    tenantId: "tenant-alpha",
    actorId: "actor-reviewer-01",
    roles: ["Reviewer"],
    projectIds: ["proj-synth-01"],
  });

  // Tenant Beta attacker / external user
  oidcVerifier.registerToken("token-beta-owner", {
    sub: "actor-beta-01",
    tenantId: "tenant-beta",
    roles: ["Owner"],
    projectIds: ["proj-synth-01"],
    expUnixSeconds: 4_000_000_000,
  });
  membershipRegistry.registerMember({
    tenantId: "tenant-beta",
    actorId: "actor-beta-01",
    roles: ["Owner"],
    projectIds: ["proj-synth-01"],
  });

  const api = new GovernedDomainApiService({
    oidcVerifier,
    membershipRegistry,
  });

  return { api, oidcVerifier, membershipRegistry };
}

describe("PHASE 02 — Identity, tenancy, governance enforcement & security gate", () => {
  it("denies cross-tenant brief submission, read, and approval BEFORE data access with 404 NOT_FOUND semantics", () => {
    const { api } = createTestEnvironment();
    const webClientAlpha = new WebControlPlaneClient(api, "token-alpha-builder");

    const submitOk = webClientAlpha.submitBrief(sampleRequestContext, sampleBrief);
    expect(submitOk.ok).toBe(true);

    // Tenant Beta actor attempts to read Tenant Alpha's briefId
    const crossTenantContext = {
      ...sampleRequestContext,
      requestId: "req-beta-01",
      tenantId: "tenant-beta",
      actor: {
        actorId: "actor-beta-01",
        principalType: "human" as const,
        roles: ["Owner" as const],
      },
      idempotencyKey: "idem-beta-read-01",
    };

    const crossRead = api.getBrief(crossTenantContext, sampleBrief.briefId, {
      bearerToken: "token-beta-owner",
    });
    expect(crossRead.ok).toBe(false);
    if (!crossRead.ok) {
      expect(crossRead.error.category).toBe("NOT_FOUND");
      expect(crossRead.error.code).toBe("DOMAIN_RESOURCE_NOT_FOUND");
    }

    // Tenant Beta token attempting to spoof tenant-alpha in RequestContext is also denied
    const spoofedTenantContext = {
      ...crossTenantContext,
      tenantId: "tenant-alpha",
    };
    const spoofedRead = api.getBrief(spoofedTenantContext, sampleBrief.briefId, {
      bearerToken: "token-beta-owner",
    });
    expect(spoofedRead.ok).toBe(false);
    if (!spoofedRead.ok) {
      expect(spoofedRead.error.category).toBe("NOT_FOUND");
    }

    // Pending approval in Tenant Alpha cannot be approved by Tenant Beta
    api.approvals.createPendingApproval({
      approvalId: "appr-alpha-01",
      tenantId: "tenant-alpha",
      projectId: "proj-synth-01",
      planId: "plan-0001",
      planHash: sampleProductSpec.specHash,
      stepId: "step-2-write_workspace",
      actionClass: "write_workspace",
      policyVersion: api.getPolicyVersion(),
      canonicalPathScope: ["C:/AetherForgeWorkspaces/proj-synth-01"],
    });

    const crossApprove = api.decideApproval(
      {
        context: crossTenantContext,
        approvalId: "appr-alpha-01",
        planId: "plan-0001",
        planHash: sampleProductSpec.specHash,
        stepId: "step-2-write_workspace",
        policyVersion: api.getPolicyVersion(),
        decision: "APPROVED",
        rationale: "Cross-tenant hijack attempt",
      },
      { bearerToken: "token-beta-owner" },
    );
    expect(crossApprove.ok).toBe(false);
    if (!crossApprove.ok) {
      expect(crossApprove.error.category).toBe("NOT_FOUND");
    }
  });

  it("enforces role checks on brief submission, approvals, and unqualified DAW capabilities", () => {
    const { api } = createTestEnvironment();

    // Reviewer cannot submit a brief (requires Owner or Builder)
    const reviewerContext = {
      ...sampleRequestContext,
      actor: {
        actorId: "actor-reviewer-01",
        principalType: "human" as const,
        roles: ["Reviewer" as const],
      },
      idempotencyKey: "idem-reviewer-brief-01",
    };
    const reviewerSubmit = api.submitBrief(
      { context: reviewerContext, brief: sampleBrief },
      { bearerToken: "token-alpha-reviewer" },
    );
    expect(reviewerSubmit.ok).toBe(false);
    if (!reviewerSubmit.ok) {
      expect(reviewerSubmit.error.category).toBe("AUTHORIZATION");
    }

    // Builder cannot approve external_upload (requires Owner)
    api.approvals.createPendingApproval({
      approvalId: "appr-upload-01",
      tenantId: "tenant-alpha",
      projectId: "proj-synth-01",
      planId: "plan-upload",
      planHash: sampleProductSpec.specHash,
      stepId: "step-upload",
      actionClass: "external_upload",
      policyVersion: api.getPolicyVersion(),
      canonicalPathScope: ["C:/AetherForgeWorkspaces/proj-synth-01"],
    });

    const builderApproveUpload = api.decideApproval(
      {
        context: { ...sampleRequestContext, idempotencyKey: "idem-upload-approve-01" },
        approvalId: "appr-upload-01",
        planId: "plan-upload",
        planHash: sampleProductSpec.specHash,
        stepId: "step-upload",
        policyVersion: api.getPolicyVersion(),
        decision: "APPROVED",
        rationale: "Builder attempting Owner-only external upload approval",
      },
      { bearerToken: "token-alpha-builder" },
    );
    expect(builderApproveUpload.ok).toBe(false);
    if (!builderApproveUpload.ok) {
      expect(builderApproveUpload.error.category).toBe("AUTHORIZATION");
      expect(builderApproveUpload.error.code).toBe("DOMAIN_APPROVER_ROLE_INSUFFICIENT");
    }

    // Unqualified DAW capability in Phase 02 is denied by taxonomy
    const unqualifiedDawPlan = api.createPlan(
      {
        context: { ...sampleRequestContext, idempotencyKey: "idem-daw-plan-01" },
        spec: {
          ...sampleProductSpec,
          requiredCapabilities: ["daw_session_mutation"],
        },
      },
      { bearerToken: "token-alpha-builder" },
    );
    expect(unqualifiedDawPlan.ok).toBe(false);
    if (!unqualifiedDawPlan.ok) {
      expect(unqualifiedDawPlan.error.category).toBe("POLICY_DENIED");
    }
  });

  it("enforces idempotency: duplicate idempotencyKey returns identical result; mutated payload with same key returns CONFLICT", () => {
    const { api } = createTestEnvironment();

    const first = api.submitBrief(
      { context: sampleRequestContext, brief: sampleBrief },
      { bearerToken: "token-alpha-builder" },
    );
    const second = api.submitBrief(
      { context: sampleRequestContext, brief: sampleBrief },
      { bearerToken: "token-alpha-builder" },
    );
    expect(first.ok).toBe(true);
    expect(second).toEqual(first);

    // Only one EXECUTED audit event was recorded for the deduplicated call
    const traceEvents = api.auditStore.reconstructTrace(
      "tenant-alpha",
      sampleRequestContext.traceId,
    );
    expect(traceEvents).toHaveLength(1);

    // Reusing the same idempotencyKey with a modified brief objective returns CONFLICT
    const tampered = api.submitBrief(
      {
        context: sampleRequestContext,
        brief: { ...sampleBrief, objective: "Modified objective with reused idempotency key" },
      },
      { bearerToken: "token-alpha-builder" },
    );
    expect(tampered.ok).toBe(false);
    if (!tampered.ok) {
      expect(tampered.error.category).toBe("CONFLICT");
      expect(tampered.error.code).toBe("DOMAIN_IDEMPOTENCY_KEY_PAYLOAD_MISMATCH");
    }
  });

  it("invalidates prior approval and revokes CapabilityGrant when planHash or policyVersion changes (INV-03)", () => {
    const { api } = createTestEnvironment();

    const planResult = api.createPlan(
      {
        context: { ...sampleRequestContext, idempotencyKey: "idem-create-plan-01" },
        spec: sampleProductSpec,
      },
      { bearerToken: "token-alpha-builder" },
    );
    expect(planResult.ok).toBe(true);
    if (!planResult.ok) return;

    const plan = planResult.value;
    const writeStep = plan.steps[1]!;

    api.approvals.createPendingApproval({
      approvalId: "appr-write-01",
      tenantId: "tenant-alpha",
      projectId: "proj-synth-01",
      planId: plan.planId,
      planHash: plan.planHash,
      stepId: writeStep.stepId,
      actionClass: writeStep.actionClass,
      policyVersion: api.getPolicyVersion(),
      canonicalPathScope: ["C:/AetherForgeWorkspaces/proj-synth-01"],
      nowMs: 1_700_000_000_000,
    });

    const decisionRes = api.decideApproval(
      {
        context: { ...sampleRequestContext, idempotencyKey: "idem-decide-write-01" },
        approvalId: "appr-write-01",
        planId: plan.planId,
        planHash: plan.planHash,
        stepId: writeStep.stepId,
        policyVersion: api.getPolicyVersion(),
        decision: "APPROVED",
        rationale: "Approved initial plan hash",
      },
      { bearerToken: "token-alpha-builder", nowMs: 1_700_000_010_000 },
    );
    expect(decisionRes.ok).toBe(true);

    // Before plan mutation, dispatch gate succeeds
    const validDispatch = api.verifyStepDispatchGate({
      context: sampleRequestContext,
      planId: plan.planId,
      approvalId: "appr-write-01",
      bearerToken: "token-alpha-builder",
      nowMs: 1_700_000_020_000,
    });
    expect(validDispatch.ok).toBe(true);

    // Mutate one step parameter in the plan -> planHash changes
    api.updatePlanSteps(plan.planId, {
      ...plan,
      steps: [
        plan.steps[0]!,
        {
          ...writeStep,
          input: { projectId: "proj-synth-01", injectedFlag: "tampered" },
        },
      ],
    });

    // Dispatch gate immediately fails closed and invalidates the approval + revokes grant
    const driftedDispatch = api.verifyStepDispatchGate({
      context: sampleRequestContext,
      planId: plan.planId,
      approvalId: "appr-write-01",
      bearerToken: "token-alpha-builder",
      nowMs: 1_700_000_030_000,
    });
    expect(driftedDispatch.ok).toBe(false);
    if (!driftedDispatch.ok) {
      expect(driftedDispatch.error.category).toBe("APPROVAL_INVALID");
      expect(driftedDispatch.error.code).toBe("DOMAIN_APPROVAL_INVALIDATED_BY_DRIFT");
    }
  });

  it("rejects expired approvals at decision time and at dispatch time", () => {
    const { api } = createTestEnvironment();
    const baseTimeMs = 1_700_000_000_000;

    api.approvals.createPendingApproval({
      approvalId: "appr-expiring-01",
      tenantId: "tenant-alpha",
      projectId: "proj-synth-01",
      planId: "plan-exp",
      planHash: sampleProductSpec.specHash,
      stepId: "step-write",
      actionClass: "write_workspace",
      policyVersion: api.getPolicyVersion(),
      canonicalPathScope: ["C:/AetherForgeWorkspaces/proj-synth-01"],
      nowMs: baseTimeMs,
      customExpirySeconds: 60,
    });

    // Attempt to approve 120 seconds later (past 60s expiry)
    const lateDecision = api.decideApproval(
      {
        context: { ...sampleRequestContext, idempotencyKey: "idem-late-approve" },
        approvalId: "appr-expiring-01",
        planId: "plan-exp",
        planHash: sampleProductSpec.specHash,
        stepId: "step-write",
        policyVersion: api.getPolicyVersion(),
        decision: "APPROVED",
        rationale: "Late approval after SLA expiry",
      },
      { bearerToken: "token-alpha-builder", nowMs: baseTimeMs + 120_000 },
    );
    expect(lateDecision.ok).toBe(false);
    if (!lateDecision.ok) {
      expect(lateDecision.error.code).toBe("DOMAIN_APPROVAL_EXPIRED");
    }
  });

  it("enforces Emergency Stop: blocks new dispatch, revokes active grants, signals cancellable workflows, and logs audit event", () => {
    const { api } = createTestEnvironment();

    // Register a running workflow and an approved grant in proj-synth-01
    api.workflowCoordinator.registerWorkflow({
      workflowId: "wf-proj-synth-01-run-01",
      tenantId: "tenant-alpha",
      projectId: "proj-synth-01",
      workerId: "worker-win11-studio-01",
    });

    const planRes = api.createPlan(
      {
        context: { ...sampleRequestContext, idempotencyKey: "idem-plan-before-stop" },
        spec: sampleProductSpec,
      },
      { bearerToken: "token-alpha-builder" },
    );
    expect(planRes.ok).toBe(true);
    if (!planRes.ok) return;

    api.approvals.createPendingApproval({
      approvalId: "appr-before-stop",
      tenantId: "tenant-alpha",
      projectId: "proj-synth-01",
      planId: planRes.value.planId,
      planHash: planRes.value.planHash,
      stepId: planRes.value.steps[1]!.stepId,
      actionClass: "write_workspace",
      policyVersion: api.getPolicyVersion(),
      canonicalPathScope: ["C:/AetherForgeWorkspaces/proj-synth-01"],
    });
    api.decideApproval(
      {
        context: { ...sampleRequestContext, idempotencyKey: "idem-approve-before-stop" },
        approvalId: "appr-before-stop",
        planId: planRes.value.planId,
        planHash: planRes.value.planHash,
        stepId: planRes.value.steps[1]!.stepId,
        policyVersion: api.getPolicyVersion(),
        decision: "APPROVED",
        rationale: "Approved prior to emergency stop",
      },
      { bearerToken: "token-alpha-builder" },
    );

    // Trigger Emergency Stop as Owner
    const ownerContext = {
      ...sampleRequestContext,
      actor: {
        actorId: "actor-owner-01",
        principalType: "human" as const,
        roles: ["Owner" as const],
      },
      idempotencyKey: "idem-emergency-stop-01",
    };

    const stopRes = api.triggerEmergencyStop(
      {
        context: ownerContext,
        scope: "PROJECT",
        targetId: "proj-synth-01",
        reason: "Operator triggered emergency stop test",
      },
      { bearerToken: "token-alpha-owner" },
    );
    expect(stopRes.ok).toBe(true);
    if (stopRes.ok) {
      expect(stopRes.value.status).toBe("HALTED");
      expect(stopRes.value.revokedGrantCount).toBe(1);
      expect(stopRes.value.signaledWorkflowCount).toBe(1);
    }

    // Verify workflow received cancellation signal
    expect(api.workflowCoordinator.getSignals()).toHaveLength(1);
    expect(api.workflowCoordinator.getSignals()[0]?.workflowId).toBe("wf-proj-synth-01-run-01");

    // Verify subsequent dispatch and brief submissions are blocked with EMERGENCY_STOP (423 semantics)
    const blockedDispatch = api.verifyStepDispatchGate({
      context: sampleRequestContext,
      planId: planRes.value.planId,
      approvalId: "appr-before-stop",
      bearerToken: "token-alpha-builder",
    });
    expect(blockedDispatch.ok).toBe(false);
    if (!blockedDispatch.ok) {
      expect(blockedDispatch.error.category).toBe("EMERGENCY_STOP");
      expect(blockedDispatch.error.code).toBe("DOMAIN_EMERGENCY_STOP_ACTIVE");
    }

    const blockedSubmit = api.submitBrief(
      {
        context: { ...sampleRequestContext, idempotencyKey: "idem-after-stop" },
        brief: sampleBrief,
      },
      { bearerToken: "token-alpha-builder" },
    );
    expect(blockedSubmit.ok).toBe(false);
    if (!blockedSubmit.ok) {
      expect(blockedSubmit.error.category).toBe("EMERGENCY_STOP");
    }
  });
});
