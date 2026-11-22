import { describe, expect, it } from "vitest";
import {
  ConfigurableOidcVerifier,
  GovernedDomainApiService,
  TenantMembershipRegistry,
} from "@aether-forge/api";
import {
  loadDefaultV1OpaPolicyBundle,
  OpaPolicyDecisionPoint,
} from "@aether-forge/policy";
import { SCHEMA_VERSION_V1 } from "@aether-forge/contracts";
import {
  sampleProductSpec,
  sampleRequestContext,
} from "@aether-forge/test-fixtures";

function buildGovernedTestContext() {
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

  const policyDecisionPoint = new OpaPolicyDecisionPoint();
  const api = new GovernedDomainApiService({
    oidcVerifier,
    membershipRegistry,
    policyDecisionPoint,
  });

  return { api, policyDecisionPoint };
}

describe("PHASE 03 — Policy-as-code (OPA) and approvals gate", () => {
  it("evaluates allow, requireApproval, and deny across all governed action classes and defaults unknown action to deny", () => {
    const pdp = new OpaPolicyDecisionPoint();

    const baseInput = {
      schemaVersion: SCHEMA_VERSION_V1,
      tenantId: "tenant-alpha",
      projectId: "proj-synth-01",
      actor: sampleRequestContext.actor,
      classification: "CONFIDENTIAL" as const,
    };

    // 1. Read -> allow
    const readRes = pdp.evaluate({ ...baseInput, actionClass: "read_allowlisted" });
    expect(readRes.decision).toBe("allow");
    expect(readRes.policyVersion).toBe("opa-bundle-2026.11.22-v1");

    // 2. Write, command, audio_dsp, external_upload, package_install, release_publish -> requireApproval
    for (const actionClass of [
      "write_workspace",
      "command_bounded",
      "audio_dsp",
      "external_upload",
      "package_install",
      "release_publish",
    ]) {
      const res = pdp.evaluate({ ...baseInput, actionClass });
      expect(res.decision, `Expected requireApproval for ${actionClass}`).toBe("requireApproval");
      expect(res.requiredApproverRoles.length).toBeGreaterThan(0);
      expect(res.approvalExpirySeconds).toBeGreaterThan(0);
    }

    // 3. DAW mutation/inspect/render -> deny when unqualified, allow/requireApproval when qualified
    const unqualifiedDaw = pdp.evaluate({
      ...baseInput,
      actionClass: "daw_session_mutation",
      dawCapabilityQualified: false,
    });
    expect(unqualifiedDaw.decision).toBe("deny");
    expect(unqualifiedDaw.reasonCode).toBe("POLICY_DAW_CAPABILITY_UNQUALIFIED");

    const qualifiedDawInspect = pdp.evaluate({
      ...baseInput,
      actionClass: "daw_inspect",
      dawCapabilityQualified: true,
    });
    expect(qualifiedDawInspect.decision).toBe("allow");

    const qualifiedDawMutate = pdp.evaluate({
      ...baseInput,
      actionClass: "daw_session_mutation",
      dawCapabilityQualified: true,
    });
    expect(qualifiedDawMutate.decision).toBe("requireApproval");

    // 4. Restricted local or secret credential external upload -> deny
    const restrictedUpload = pdp.evaluate({
      ...baseInput,
      actionClass: "external_upload",
      classification: "RESTRICTED_LOCAL",
    });
    expect(restrictedUpload.decision).toBe("deny");
    expect(restrictedUpload.reasonCode).toBe("POLICY_RESTRICTED_LOCAL_EGRESS_DENIED");

    const secretRead = pdp.evaluate({
      ...baseInput,
      actionClass: "read_allowlisted",
      classification: "SECRET_CREDENTIAL",
    });
    expect(secretRead.decision).toBe("deny");
    expect(secretRead.reasonCode).toBe("POLICY_SECRET_CREDENTIAL_DENIED");

    // 5. Unknown action class -> default deny
    const unknownAction = pdp.evaluate({
      ...baseInput,
      actionClass: "unregistered_arbitrary_shell",
    });
    expect(unknownAction.decision).toBe("deny");
    expect(unknownAction.reasonCode).toBe("POLICY_UNKNOWN_ACTION_DENIED");
  });

  it("produces UI-safe decision explanations without exposing internal Rego syntax, file paths, or signing secrets", () => {
    const pdp = new OpaPolicyDecisionPoint();
    const actions = [
      "read_allowlisted",
      "write_workspace",
      "command_bounded",
      "daw_session_mutation",
      "external_upload",
      "package_install",
      "release_publish",
      "unknown_action",
    ];

    for (const actionClass of actions) {
      const res = pdp.evaluate({
        schemaVersion: SCHEMA_VERSION_V1,
        tenantId: "tenant-alpha",
        projectId: "proj-synth-01",
        actor: sampleRequestContext.actor,
        actionClass,
        classification: "CONFIDENTIAL",
      });
      expect(res.userExplanation.length).toBeGreaterThan(15);
      expect(res.userExplanation).not.toMatch(/package aetherforge|rego|ed25519|hmac|C:\\|\/bundles\//i);
    }
  });

  it("fails closed (`deny`) when policy bundle is unavailable, unsigned, or evaluation errors occur", () => {
    const pdp = new OpaPolicyDecisionPoint(null);
    const unloadedRes = pdp.evaluate({
      schemaVersion: SCHEMA_VERSION_V1,
      tenantId: "tenant-alpha",
      projectId: "proj-synth-01",
      actor: sampleRequestContext.actor,
      actionClass: "read_allowlisted",
      classification: "PUBLIC",
    });
    expect(unloadedRes.decision).toBe("deny");
    expect(unloadedRes.reasonCode).toBe("POLICY_BUNDLE_UNAVAILABLE_FAIL_CLOSED");

    const loadedPdp = new OpaPolicyDecisionPoint();
    loadedPdp.setSimulateEvaluationError(true);
    const simulatedErrRes = loadedPdp.evaluate({
      schemaVersion: SCHEMA_VERSION_V1,
      tenantId: "tenant-alpha",
      projectId: "proj-synth-01",
      actor: sampleRequestContext.actor,
      actionClass: "read_allowlisted",
      classification: "PUBLIC",
    });
    expect(simulatedErrRes.decision).toBe("deny");
    expect(simulatedErrRes.reasonCode).toBe("POLICY_BUNDLE_UNAVAILABLE_FAIL_CLOSED");

    // Malformed input fails closed
    loadedPdp.setSimulateEvaluationError(false);
    const malformedRes = loadedPdp.evaluate({ invalid: "payload" });
    expect(malformedRes.decision).toBe("deny");
    expect(malformedRes.reasonCode).toBe("POLICY_INPUT_INVALID_FAIL_CLOSED");
  });

  it("enforces policy version change invalidation, revoked grant blocking, and canonicalPathScope binding at dispatch", () => {
    const { api, policyDecisionPoint } = buildGovernedTestContext();

    const planRes = api.createPlan(
      {
        context: { ...sampleRequestContext, idempotencyKey: "idem-p03-plan-01" },
        spec: sampleProductSpec,
      },
      { bearerToken: "token-alpha-builder" },
    );
    expect(planRes.ok).toBe(true);
    if (!planRes.ok) return;

    const plan = planRes.value;
    const writeStep = plan.steps[1]!;

    // Create and approve a grant scoped to C:/AetherForgeWorkspaces/proj-synth-01
    api.approvals.createPendingApproval({
      approvalId: "appr-p03-01",
      tenantId: "tenant-alpha",
      projectId: "proj-synth-01",
      planId: plan.planId,
      planHash: plan.planHash,
      stepId: writeStep.stepId,
      actionClass: writeStep.actionClass,
      policyVersion: api.getPolicyVersion(),
      canonicalPathScope: ["C:/AetherForgeWorkspaces/proj-synth-01"],
    });

    const approveRes = api.decideApproval(
      {
        context: { ...sampleRequestContext, idempotencyKey: "idem-p03-approve-01" },
        approvalId: "appr-p03-01",
        planId: plan.planId,
        planHash: plan.planHash,
        stepId: writeStep.stepId,
        policyVersion: api.getPolicyVersion(),
        decision: "APPROVED",
        rationale: "Approved within workspace scope",
      },
      { bearerToken: "token-alpha-builder" },
    );
    expect(approveRes.ok).toBe(true);

    // 1. Dispatch within granted canonicalPathScope succeeds
    const inScopeDispatch = api.verifyStepDispatchGate({
      context: sampleRequestContext,
      planId: plan.planId,
      approvalId: "appr-p03-01",
      requestedPath: "C:/AetherForgeWorkspaces/proj-synth-01/outputs/report.json",
      bearerToken: "token-alpha-builder",
    });
    expect(inScopeDispatch.ok).toBe(true);

    // 2. Dispatch outside granted canonicalPathScope (or with path traversal) is denied
    const outOfScopeDispatch = api.verifyStepDispatchGate({
      context: sampleRequestContext,
      planId: plan.planId,
      approvalId: "appr-p03-01",
      requestedPath: "C:/Windows/System32/cmd.exe",
      bearerToken: "token-alpha-builder",
    });
    expect(outOfScopeDispatch.ok).toBe(false);
    if (!outOfScopeDispatch.ok) {
      expect(outOfScopeDispatch.error.code).toBe("DOMAIN_CAPABILITY_SCOPE_VIOLATION");
    }

    // 3. Explicit grant revocation blocks dispatch immediately
    api.approvals.revokeGrantByApprovalId("tenant-alpha", "appr-p03-01");
    const revokedDispatch = api.verifyStepDispatchGate({
      context: sampleRequestContext,
      planId: plan.planId,
      approvalId: "appr-p03-01",
      requestedPath: "C:/AetherForgeWorkspaces/proj-synth-01/outputs/report.json",
      bearerToken: "token-alpha-builder",
    });
    expect(revokedDispatch.ok).toBe(false);
    if (!revokedDispatch.ok) {
      expect(revokedDispatch.error.code).toBe("DOMAIN_CAPABILITY_GRANT_REVOKED");
    }

    // 4. Create a second approved grant, then rotate OPA policy bundle version -> stale policyVersion invalidates approval
    api.approvals.createPendingApproval({
      approvalId: "appr-p03-02",
      tenantId: "tenant-alpha",
      projectId: "proj-synth-01",
      planId: plan.planId,
      planHash: plan.planHash,
      stepId: writeStep.stepId,
      actionClass: writeStep.actionClass,
      policyVersion: api.getPolicyVersion(),
      canonicalPathScope: ["C:/AetherForgeWorkspaces/proj-synth-01"],
    });
    api.decideApproval(
      {
        context: { ...sampleRequestContext, idempotencyKey: "idem-p03-approve-02" },
        approvalId: "appr-p03-02",
        planId: plan.planId,
        planHash: plan.planHash,
        stepId: writeStep.stepId,
        policyVersion: api.getPolicyVersion(),
        decision: "APPROVED",
        rationale: "Approved under v1 bundle",
      },
      { bearerToken: "token-alpha-builder" },
    );

    // Rotate active policy bundle to v2
    policyDecisionPoint.rotateBundle(loadDefaultV1OpaPolicyBundle("opa-bundle-2026.11.22-v2"));

    const stalePolicyDispatch = api.verifyStepDispatchGate({
      context: sampleRequestContext,
      planId: plan.planId,
      approvalId: "appr-p03-02",
      bearerToken: "token-alpha-builder",
    });
    expect(stalePolicyDispatch.ok).toBe(false);
    if (!stalePolicyDispatch.ok) {
      expect(stalePolicyDispatch.error.code).toBe("DOMAIN_APPROVAL_INVALIDATED_BY_DRIFT");
    }
  });
});
