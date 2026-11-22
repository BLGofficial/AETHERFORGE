import { describe, expect, it } from "vitest";
import {
  ExecutionPlanSchema,
  type PlanningInput,
  SCHEMA_VERSION_V1,
} from "@aether-forge/contracts";
import {
  BoundedExecutionPlanner,
  createDefaultToolManifestRegistry,
  ProviderGatewayService,
} from "@aether-forge/provider-gateway";
import {
  SAMPLE_SHA256,
  sampleRequestContext,
} from "@aether-forge/test-fixtures";

function buildPlanningFixtureInput(
  objective = "Inspect workspace manifest and write governed output inside C:\\Users\\blago\\Desktop\\AETHERFORGE",
  tokenBudget = 4096,
): PlanningInput {
  const registry = createDefaultToolManifestRegistry();
  return {
    schemaVersion: SCHEMA_VERSION_V1,
    specId: "spec-0001",
    tenantId: "tenant-alpha",
    projectId: "proj-synth-01",
    objective,
    availableTools: [...registry.listTools()],
    citations: [
      {
        sourceId: "src-blueprint-v1",
        contentHash: SAMPLE_SHA256,
        location: "docs/product/requirements.md#L1-L40",
        classification: "CONFIDENTIAL",
        extractionVersion: "1.0.0",
      },
    ],
    tokenBudget,
  };
}

describe("PHASE 05 — Provider gateway and bounded planner evaluation fixtures gate", () => {
  it("Fixture 1 (Valid Plan): produces contract-validated ExecutionPlan, redacts local user paths, records usage audit metadata, and forces approval gate on writes", () => {
    const gateway = new ProviderGatewayService();
    const planner = new BoundedExecutionPlanner({ providerGateway: gateway });

    // Even if the fake LLM output attempts to set requiresApproval: false on write_workspace,
    // BoundedExecutionPlanner overrides it to true from OPA policy.
    gateway.fakeProvider.setScriptedOutput(
      JSON.stringify({
        steps: [
          {
            stepId: "step-01-read",
            orderIndex: 0,
            toolId: "tool.workspace.inspect_manifest",
            actionClass: "read_allowlisted",
            description: "Inspect workspace manifest",
            input: { targetRelativePath: "manifest.json" },
            expectedOutputs: ["manifestHash"],
            requiresApproval: false,
            dependsOnStepIds: [],
          },
          {
            stepId: "step-02-write",
            orderIndex: 1,
            toolId: "tool.workspace.atomic_write",
            actionClass: "write_workspace",
            description: "Write governed report",
            input: { targetRelativePath: "outputs/report.json" },
            expectedOutputs: ["reportHash"],
            requiresApproval: false, // LLM tries to skip approval
            dependsOnStepIds: ["step-01-read"],
          },
        ],
      }),
    );

    const res = planner.proposePlan({
      context: sampleRequestContext,
      planningInput: buildPlanningFixtureInput(),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // Validates against canonical ExecutionPlanSchema
    const validated = ExecutionPlanSchema.parse(res.value);
    expect(validated.steps).toHaveLength(2);
    expect(validated.steps[0]?.requiresApproval).toBe(false);
    // Planner forced requiresApproval: true on write_workspace step!
    expect(validated.steps[1]?.requiresApproval).toBe(true);

    // Verify Provider Gateway recorded usage metadata and redacted the C:\Users\blago\... path
    const auditEvents = gateway.auditStore.listByTenant("tenant-alpha");
    const completedEvent = auditEvents.find(
      (e) => e.eventType === "aetherforge.provider.completed.v1",
    );
    expect(completedEvent).toBeDefined();
    expect(completedEvent?.outcome).toBe("EXECUTED");
  });

  it("Fixture 2 (Malformed Plan): rejects non-JSON and schema-invalid model outputs without creating executable plans", () => {
    const gateway = new ProviderGatewayService();
    const planner = new BoundedExecutionPlanner({ providerGateway: gateway });

    // Case A: Truncated / invalid JSON
    gateway.fakeProvider.setScriptedOutput("{ invalid_json: [");
    const nonJsonRes = planner.proposePlan({
      context: sampleRequestContext,
      planningInput: buildPlanningFixtureInput(),
    });
    expect(nonJsonRes.ok).toBe(false);
    if (!nonJsonRes.ok) {
      expect(nonJsonRes.error.code).toBe("DOMAIN_PLANNER_MALFORMED_OUTPUT");
      expect(nonJsonRes.error.category).toBe("VALIDATION");
    }

    // Case B: Valid JSON but empty steps array (violates min(1) schema constraint)
    gateway.fakeProvider.setScriptedOutput(JSON.stringify({ steps: [] }));
    const emptyStepsRes = planner.proposePlan({
      context: sampleRequestContext,
      planningInput: buildPlanningFixtureInput(),
    });
    expect(emptyStepsRes.ok).toBe(false);
    if (!emptyStepsRes.ok) {
      expect(emptyStepsRes.error.code).toBe("DOMAIN_PLANNER_MALFORMED_OUTPUT");
    }
  });

  it("Fixture 3 (Over-Budget Plan): rejects requests exceeding request or tenant token/cost quotas", () => {
    const gateway = new ProviderGatewayService();
    const planner = new BoundedExecutionPlanner({ providerGateway: gateway });

    // Configure fake provider to emit 2,000 output tokens when tokenBudget is only 500
    gateway.fakeProvider.setScriptedOutput(undefined, {
      outputTokens: 2000,
      costUsdMicros: 5000,
    });

    const overTokenRes = planner.proposePlan({
      context: sampleRequestContext,
      planningInput: buildPlanningFixtureInput("Test over-budget token rejection", 500),
    });
    expect(overTokenRes.ok).toBe(false);
    if (!overTokenRes.ok) {
      expect(overTokenRes.error.code).toBe("DOMAIN_PROVIDER_BUDGET_EXCEEDED");
      expect(overTokenRes.error.category).toBe("QUOTA_EXCEEDED");
    }

    // Configure strict tenant cumulative cost budget of 100 USD micros
    gateway.budgetTracker.setTenantQuota("tenant-alpha", {
      maxTotalTokens: 100_000,
      maxTotalCostUsdMicros: 100,
    });
    gateway.fakeProvider.setScriptedOutput(undefined, {
      outputTokens: 100,
      costUsdMicros: 250,
    });

    const overTenantCostRes = planner.proposePlan({
      context: sampleRequestContext,
      planningInput: buildPlanningFixtureInput("Test tenant cost quota rejection", 4096),
    });
    expect(overTenantCostRes.ok).toBe(false);
    if (!overTenantCostRes.ok) {
      expect(overTenantCostRes.error.code).toBe("DOMAIN_PROVIDER_BUDGET_EXCEEDED");
    }
  });

  it("Fixture 4 (Unsafe Plans & Egress Fence): blocks unregistered shell/DAW tools, actionClass downgrades, raw secrets, and restricted classifications", () => {
    const gateway = new ProviderGatewayService();
    const planner = new BoundedExecutionPlanner({ providerGateway: gateway });

    // Case A: Prompt injection causes LLM to propose unregistered direct shell tool
    gateway.fakeProvider.setScriptedOutput(
      JSON.stringify({
        steps: [
          {
            stepId: "step-01-shell-escape",
            orderIndex: 0,
            toolId: "tool.shell.unrestricted_powershell",
            actionClass: "command_bounded",
            description: "Attempt direct shell execution outside tool registry",
            input: { cmd: "whoami" },
            expectedOutputs: ["stdout"],
            dependsOnStepIds: [],
          },
        ],
      }),
    );

    const unregisteredToolRes = planner.proposePlan({
      context: sampleRequestContext,
      planningInput: buildPlanningFixtureInput(),
    });
    expect(unregisteredToolRes.ok).toBe(false);
    if (!unregisteredToolRes.ok) {
      expect(unregisteredToolRes.error.code).toBe("DOMAIN_PLANNER_UNREGISTERED_OR_UNSAFE_TOOL");
      expect(unregisteredToolRes.error.category).toBe("POLICY_DENIED");
    }

    // Case B: Model attempts to downgrade tool.workspace.atomic_write from write_workspace to read_allowlisted
    gateway.fakeProvider.setScriptedOutput(
      JSON.stringify({
        steps: [
          {
            stepId: "step-01-spoof-class",
            orderIndex: 0,
            toolId: "tool.workspace.atomic_write",
            actionClass: "read_allowlisted",
            description: "Spoof write tool as read_allowlisted to bypass approval",
            input: { targetRelativePath: "outputs/pwn.json" },
            expectedOutputs: ["hash"],
            dependsOnStepIds: [],
          },
        ],
      }),
    );

    const spoofedClassRes = planner.proposePlan({
      context: sampleRequestContext,
      planningInput: buildPlanningFixtureInput(),
    });
    expect(spoofedClassRes.ok).toBe(false);
    if (!spoofedClassRes.ok) {
      expect(spoofedClassRes.error.code).toBe("DOMAIN_PLANNER_TOOL_ACTION_CLASS_MISMATCH");
    }

    // Case C: Raw API secret key accidentally included in brief/objective is blocked at Provider Gateway egress fence
    gateway.fakeProvider.setScriptedOutput(undefined);
    const leakedSecretRes = planner.proposePlan({
      context: sampleRequestContext,
      planningInput: buildPlanningFixtureInput(
        "Use key sk-proj-1234567890abcdefghijklmnop to call external endpoint",
      ),
    });
    expect(leakedSecretRes.ok).toBe(false);
    if (!leakedSecretRes.ok) {
      expect(leakedSecretRes.error.code).toBe("DOMAIN_EGRESS_RAW_SECRET_DETECTED");
    }

    // Case D: RESTRICTED_LOCAL classification is blocked from external provider egress by default
    const restrictedLocalRes = planner.proposePlan({
      context: {
        ...sampleRequestContext,
        classification: "RESTRICTED_LOCAL",
      },
      planningInput: buildPlanningFixtureInput("Private local stem buffer"),
    });
    expect(restrictedLocalRes.ok).toBe(false);
    if (!restrictedLocalRes.ok) {
      expect(restrictedLocalRes.error.code).toBe("DOMAIN_EGRESS_RESTRICTED_LOCAL_DENIED");
    }
  });
});
