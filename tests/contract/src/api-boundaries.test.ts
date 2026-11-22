import { describe, expect, it } from "vitest";
import {
  CreatePlanRequestSchema,
  DecideApprovalRequestSchema,
  SubmitBriefRequestSchema,
  TriggerEmergencyStopRequestSchema,
} from "@aether-forge/sdk";
import {
  sampleApproval,
  sampleBrief,
  samplePlanHash,
  sampleProductSpec,
  sampleRequestContext,
} from "@aether-forge/test-fixtures";

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
});
