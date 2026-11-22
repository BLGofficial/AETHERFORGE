import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import {
  ConfigurableOidcVerifier,
  GovernedDomainApiService,
  TenantMembershipRegistry,
} from "@aether-forge/api";
import { EVENT_NAMES } from "@aether-forge/contracts";
import {
  DurableTemporalOrchestrator,
  GOVERNED_WORKFLOW_VERSION,
} from "@aether-forge/orchestration";
import { createWebControlPlaneServer } from "@aether-forge/web";
import { sampleBrief, sampleRequestContext } from "@aether-forge/test-fixtures";

function createVerticalSliceHarness() {
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

  const api = new GovernedDomainApiService({
    oidcVerifier,
    membershipRegistry,
  });
  const orchestrator = new DurableTemporalOrchestrator(api);

  return { api, orchestrator };
}

describe("PHASE 04 — Durable Temporal workflow and first governed vertical slice gate", () => {
  it("survives Temporal worker restart during approval wait, retries transient activity errors, deduplicates signals, and executes simulated write exactly once", () => {
    const { api, orchestrator } = createVerticalSliceHarness();

    // 1. Start workflow: submit brief -> create deterministic sample plan -> policy evaluation -> pause at approval wait
    const startRes = orchestrator.startBriefWorkflow({
      context: sampleRequestContext,
      brief: sampleBrief,
      bearerToken: "token-alpha-builder",
      nowMs: 1_700_000_000_000,
    });
    expect(startRes.ok).toBe(true);
    if (!startRes.ok) return;

    const initialWf = startRes.value;
    expect(initialWf.workflowVersion).toBe(GOVERNED_WORKFLOW_VERSION);
    expect(initialWf.status).toBe("WAITING_FOR_APPROVAL");
    expect(initialWf.executedStepIds).toEqual(["step-1-read_allowlisted"]);
    expect(initialWf.simulatedWriteCount).toBe(0);
    expect(initialWf.pendingApprovalId).toBeDefined();

    // 2. Simulate Temporal worker restart & history replay while waiting for approval
    const rehydrated = orchestrator.simulateWorkerRestartAndReplay(initialWf.workflowId);
    expect(rehydrated).toBeDefined();
    expect(rehydrated?.status).toBe("WAITING_FOR_APPROVAL");
    expect(rehydrated?.plan.planHash).toBe(initialWf.plan.planHash);

    // 3. Configure 2 simulated transient activity failures to verify Temporal activity retry handling
    orchestrator.setSimulatedTransientActivityFailures(2);

    // 4. Send approval signal
    const approvalSignal = {
      signalId: "sig-approve-0001",
      context: {
        ...sampleRequestContext,
        requestId: "req-approve-0001",
        idempotencyKey: "idem-approve-0001",
      },
      approvalId: initialWf.pendingApprovalId!,
      decision: "APPROVED" as const,
      rationale: "Approved simulated write after plan review",
      bearerToken: "token-alpha-builder",
      nowMs: 1_700_000_010_000,
    };

    const completedRes = orchestrator.signalApprovalDecision(initialWf.workflowId, approvalSignal);
    expect(completedRes.ok).toBe(true);
    if (!completedRes.ok) return;

    expect(completedRes.value.status).toBe("COMPLETED");
    expect(completedRes.value.simulatedWriteCount).toBe(1);
    expect(completedRes.value.executedStepIds).toEqual([
      "step-1-read_allowlisted",
      "step-2-write_workspace",
    ]);

    // Verify activity retries were recorded in workflow history
    const retryEvents = completedRes.value.history.filter(
      (h) => h.eventType === "ActivityTaskRetried",
    );
    expect(retryEvents).toHaveLength(2);

    // 5. Deliver duplicate approval signal (with same or new signalId) -> idempotent, simulatedWriteCount stays 1
    const duplicateRes = orchestrator.signalApprovalDecision(initialWf.workflowId, approvalSignal);
    expect(duplicateRes.ok).toBe(true);
    if (duplicateRes.ok) {
      expect(duplicateRes.value.simulatedWriteCount).toBe(1);
    }

    // 6. Verify complete end-to-end audit trail reconstructed by traceId
    const auditTrail = api.auditStore.reconstructTrace(
      "tenant-alpha",
      sampleRequestContext.traceId,
    );
    const eventTypes = auditTrail.map((a) => a.eventType);
    expect(eventTypes).toEqual(
      expect.arrayContaining([
        EVENT_NAMES.BRIEF_SUBMITTED,
        EVENT_NAMES.PLAN_PROPOSED,
        EVENT_NAMES.WORKFLOW_STARTED,
        EVENT_NAMES.POLICY_EVALUATED,
        EVENT_NAMES.APPROVAL_REQUESTED,
        EVENT_NAMES.APPROVAL_DECIDED,
        EVENT_NAMES.WORKER_JOB_DISPATCHED,
        EVENT_NAMES.WORKER_JOB_COMPLETED,
        EVENT_NAMES.EVIDENCE_RECORDED,
      ]),
    );
  });

  it("cancels waiting Temporal workflow immediately on Emergency Stop and blocks late approval execution", () => {
    const { api, orchestrator } = createVerticalSliceHarness();

    const startRes = orchestrator.startBriefWorkflow({
      context: sampleRequestContext,
      brief: sampleBrief,
      bearerToken: "token-alpha-builder",
    });
    expect(startRes.ok).toBe(true);
    if (!startRes.ok) return;

    const wfId = startRes.value.workflowId;
    const pendingApprovalId = startRes.value.pendingApprovalId!;

    // Owner triggers Emergency Stop on project while workflow is waiting for approval
    const stopRes = api.triggerEmergencyStop(
      {
        context: {
          ...sampleRequestContext,
          actor: {
            actorId: "actor-owner-01",
            principalType: "human",
            roles: ["Owner"],
          },
          idempotencyKey: "idem-stop-wf-01",
        },
        scope: "PROJECT",
        targetId: "proj-synth-01",
        reason: "Emergency stop during approval wait",
      },
      { bearerToken: "token-alpha-owner" },
    );
    expect(stopRes.ok).toBe(true);

    // Workflow state reflects cancellation
    const cancelledState = orchestrator.getWorkflowState("tenant-alpha", wfId);
    expect(cancelledState?.status).toBe("CANCELLED_BY_EMERGENCY_STOP");
    expect(cancelledState?.simulatedWriteCount).toBe(0);

    // Attempting to signal approval on the cancelled workflow fails closed
    const lateSignal = orchestrator.signalApprovalDecision(wfId, {
      signalId: "sig-late-01",
      context: {
        ...sampleRequestContext,
        idempotencyKey: "idem-late-signal-01",
      },
      approvalId: pendingApprovalId,
      decision: "APPROVED",
      rationale: "Attempting approval after emergency stop",
      bearerToken: "token-alpha-builder",
    });
    expect(lateSignal.ok).toBe(false);
    if (!lateSignal.ok) {
      expect(lateSignal.error.category).toBe("EMERGENCY_STOP");
    }
  });

  it("executes the end-to-end Web Control Plane UI happy path (Brief Submission -> Plan Review -> Approval -> Evidence & Audit Timeline)", async () => {
    const { api, orchestrator } = createVerticalSliceHarness();
    const { server } = createWebControlPlaneServer({
      api,
      orchestrator,
      defaultTenantId: "tenant-alpha",
      defaultProjectId: "proj-synth-01",
      defaultBearerToken: "token-alpha-builder",
      ownerBearerToken: "token-alpha-owner",
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      // Step 1: Load initial dashboard and verify all 4 screen landmarks exist
      const homeRes = await fetch(`${baseUrl}/`);
      expect(homeRes.status).toBe(200);
      const homeHtml = await homeRes.text();
      expect(homeHtml).toContain('data-testid="screen-brief-submission"');
      expect(homeHtml).toContain('data-testid="screen-plan-review"');
      expect(homeHtml).toContain('data-testid="screen-approval"');
      expect(homeHtml).toContain('data-testid="screen-evidence-timeline"');

      // Step 2: Submit brief via Web UI form POST
      const submitBody = new URLSearchParams({
        title: "E2E UI Governed Stem Write Brief",
        objective: "Verify read allowlist and approval-gated simulated write in Web UI.",
        constraint: "Require human approval for workspace writes",
      });
      const submitRes = await fetch(`${baseUrl}/ui/submit-brief`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: submitBody.toString(),
      });
      expect(submitRes.status).toBe(200);
      const planHtml = await submitRes.text();

      // Verify Plan Review screen shows policy decisions and UI-safe explanations
      expect(planHtml).toContain('data-testid="workflow-status">WAITING_FOR_APPROVAL</span>');
      expect(planHtml).toContain('data-testid="decision-step-1-read_allowlisted">allow</td>');
      expect(planHtml).toContain(
        'data-testid="decision-step-2-write_workspace">requireApproval</td>',
      );
      expect(planHtml).toContain(
        "Writing files to the project workspace requires approval from an Owner or Builder.",
      );
      expect(planHtml).toContain('data-testid="simulated-write-count">0</span>');

      // Extract pending approvalId from the rendered approval form
      const approvalMatch = planHtml.match(
        /data-testid="pending-approval-id">([^<]+)<\/code>/,
      );
      expect(approvalMatch?.[1]).toBeDefined();
      const pendingApprovalId = approvalMatch![1]!;

      // Step 3: Approve the waiting step via Web UI form POST
      const approveBody = new URLSearchParams({
        approvalId: pendingApprovalId,
        decision: "APPROVED",
        rationale: "E2E operator verified planHash and policy explanation in UI",
      });
      const approveRes = await fetch(`${baseUrl}/ui/approve`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: approveBody.toString(),
      });
      expect(approveRes.status).toBe(200);
      const completedHtml = await approveRes.text();

      // Step 4: Verify Evidence & Audit Timeline screen shows COMPLETED, write count = 1, evidence hashes, and full audit trail
      expect(completedHtml).toContain('data-testid="workflow-status">COMPLETED</span>');
      expect(completedHtml).toContain('data-testid="simulated-write-count">1</span>');
      expect(completedHtml).toContain('data-testid="no-pending-approvals"');
      expect(completedHtml).toContain(EVENT_NAMES.BRIEF_SUBMITTED);
      expect(completedHtml).toContain(EVENT_NAMES.PLAN_PROPOSED);
      expect(completedHtml).toContain(EVENT_NAMES.POLICY_EVALUATED);
      expect(completedHtml).toContain(EVENT_NAMES.APPROVAL_DECIDED);
      expect(completedHtml).toContain(EVENT_NAMES.WORKER_JOB_COMPLETED);
      expect(completedHtml).toContain(EVENT_NAMES.EVIDENCE_RECORDED);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    }
  });
});
