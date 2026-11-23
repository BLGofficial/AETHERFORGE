import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DurableWorkflowEngine,
  type StepAgentExecutionContext,
} from "../WORKFLOW_ENGINE/src/index.ts";
import { MultiAgentOrchestrationEngine } from "../ORCHESTRATION_ENGINE/src/index.ts";
import { compileProjectSpecification } from "../SYSTEM_COMPILER/src/index.ts";

describe("AETHER FORGE Durable Workflow & Multi-Agent Orchestration Engine (ARCH-06)", () => {
  let tempCheckpointDir: string;

  beforeEach(() => {
    tempCheckpointDir = mkdtempSync(join(tmpdir(), "aetherforge-wf-test-"));
  });

  afterEach(() => {
    rmSync(tempCheckpointDir, { recursive: true, force: true });
  });

  it("executes sequential, parallel, conditional branching, nested sub-workflows, and human approval gates", async () => {
    const executedSteps: string[] = [];

    const engine = new DurableWorkflowEngine({
      checkpointDir: tempCheckpointDir,
      agentHandler: (ctx: StepAgentExecutionContext) => {
        executedSteps.push(`${ctx.step.stepId}:${ctx.step.responsibleAgentId}`);
        return {
          success: true,
          outputSummary: { [`${ctx.step.stepId}_done`]: "true", targetMode: "VST3_FAST_PATH" },
        };
      },
    });

    // Register nested child workflow
    engine.registerWorkflow({
      workflowId: "WF-CHILD-DSP-VERIFY",
      name: "Nested DSP Filter Coefficient Verification",
      tenantId: "tenant-01",
      projectId: "proj-audio",
      inputContractSchemaId: "DspChildInput",
      outputContractSchemaId: "DspChildOutput",
      steps: [
        {
          stepId: "SUB-STEP-01",
          title: "Verify Biquad Stability Poles",
          kind: "SEQUENTIAL_TASK",
          responsibleAgentId: "AGT-07",
          actionTier: "1",
          requiredTools: ["worker.run_command"],
          exclusiveWriteGlobs: ["workers/audio-engine/sub/**"],
          evidenceRequirements: [{ evidenceKind: "FILE_SHA256_BINDING", description: "DSP poles hash" }],
        },
      ],
      completionConditions: ["SUB-STEP-01 === COMPLETED"],
      evidenceRequirements: [{ evidenceKind: "FILE_SHA256_BINDING", description: "Child DSP hash" }],
    });

    // Register parent workflow with Sequential -> Conditional -> Parallel + Nested -> Human Approval -> AGT-19 Verification
    engine.registerWorkflow({
      workflowId: "WF-PARENT-COMPOSITE",
      name: "Composite Engineering Workflow",
      tenantId: "tenant-01",
      projectId: "proj-audio",
      inputContractSchemaId: "ParentInput",
      outputContractSchemaId: "ParentOutput",
      preconditions: [
        {
          preconditionId: "PRE-01",
          description: "Require workspaceReady === true",
          requiredContextKey: "workspaceReady",
          expectedValue: "true",
        },
      ],
      steps: [
        {
          stepId: "STEP-01-ARCH",
          title: "Freeze Contract Schemas",
          kind: "SEQUENTIAL_TASK",
          responsibleAgentId: "AGT-04",
          actionTier: "1",
          requiredTools: ["filesystem.write"],
          exclusiveWriteGlobs: ["contracts/src/**"],
          evidenceRequirements: [{ evidenceKind: "FILE_SHA256_BINDING", description: "Contracts hash" }],
        },
        {
          stepId: "STEP-02-COND",
          title: "Branch on targetMode",
          kind: "CONDITIONAL_BRANCH",
          responsibleAgentId: "AGT-01",
          actionTier: "0",
          requiredTools: ["planner.compile_dag"],
          dependsOnStepIds: ["STEP-01-ARCH"],
          condition: {
            contextKey: "targetMode",
            operator: "EQUALS",
            value: "VST3_FAST_PATH",
            thenStepIds: ["STEP-03A-PAR-CPP"],
            elseStepIds: ["STEP-03B-SKIPPED-LEGACY"],
          },
          evidenceRequirements: [{ evidenceKind: "AUDIT_CHAIN_HASH", description: "Branch audit" }],
        },
        {
          stepId: "STEP-03A-PAR-CPP",
          title: "Parallel C++20 Core Implementation",
          kind: "SEQUENTIAL_TASK",
          responsibleAgentId: "AGT-08",
          actionTier: "1",
          requiredTools: ["filesystem.write"],
          exclusiveWriteGlobs: ["plugins/vst3/AetherForgeProcessor/**"],
          dependsOnStepIds: ["STEP-02-COND"],
          evidenceRequirements: [{ evidenceKind: "FILE_SHA256_BINDING", description: "CPP hash" }],
        },
        {
          stepId: "STEP-03B-SKIPPED-LEGACY",
          title: "Skipped Legacy Branch",
          kind: "SEQUENTIAL_TASK",
          responsibleAgentId: "AGT-11",
          actionTier: "1",
          requiredTools: ["filesystem.write"],
          exclusiveWriteGlobs: ["apps/legacy/**"],
          dependsOnStepIds: ["STEP-02-COND"],
          evidenceRequirements: [{ evidenceKind: "FILE_SHA256_BINDING", description: "Legacy hash" }],
        },
        {
          stepId: "STEP-03C-PAR-NESTED-DSP",
          title: "Parallel Nested DSP Verification Sub-Workflow",
          kind: "NESTED_WORKFLOW",
          responsibleAgentId: "AGT-07",
          actionTier: "1",
          requiredTools: ["worker.run_command"],
          exclusiveWriteGlobs: ["workers/audio-engine/**"],
          dependsOnStepIds: ["STEP-02-COND"],
          nestedWorkflowId: "WF-CHILD-DSP-VERIFY",
          evidenceRequirements: [{ evidenceKind: "FILE_SHA256_BINDING", description: "Nested DSP hash" }],
        },
        {
          stepId: "STEP-04-APPROVAL",
          title: "Tier 2 Release Packaging Approval Gate",
          kind: "HUMAN_APPROVAL_GATE",
          responsibleAgentId: "AGT-13",
          actionTier: "2",
          requiredTools: ["worker.run_command"],
          dependsOnStepIds: ["STEP-03A-PAR-CPP", "STEP-03B-SKIPPED-LEGACY", "STEP-03C-PAR-NESTED-DSP"],
          evidenceRequirements: [{ evidenceKind: "HUMAN_APPROVAL_TOKEN", description: "Reviewer sign-off" }],
        },
        {
          stepId: "STEP-05-AGT19",
          title: "Independent Verification Gate",
          kind: "INDEPENDENT_VERIFICATION_GATE",
          responsibleAgentId: "AGT-19",
          actionTier: "0",
          requiredTools: ["filesystem.stat_hash"],
          dependsOnStepIds: ["STEP-04-APPROVAL"],
          evidenceRequirements: [{ evidenceKind: "AGT19_VERIFICATION_VERDICT", description: "AGT-19 PASS" }],
        },
      ],
      completionConditions: ["STEP-05-AGT19 === COMPLETED"],
      evidenceRequirements: [{ evidenceKind: "AGT19_VERIFICATION_VERDICT", description: "Final verdict" }],
    });

    // Start workflow -> should run through STEP-01, STEP-02 (skipping 03B), parallel 03A + nested 03C, and pause at STEP-04-APPROVAL
    const paused = await engine.startWorkflow({
      executionId: "EXEC-COMPOSITE-001",
      idempotencyKey: "IDEM-COMPOSITE-001",
      workflowId: "WF-PARENT-COMPOSITE",
      inputContext: { workspaceReady: "true" },
      requesterPrincipalId: "user-architect-01",
    });

    expect(paused.status).toBe("WAITING_FOR_APPROVAL");
    expect(paused.stepStates["STEP-03B-SKIPPED-LEGACY"]?.status).toBe("SKIPPED_CONDITION_FALSE");
    expect(paused.stepStates["STEP-03A-PAR-CPP"]?.status).toBe("COMPLETED");
    expect(paused.stepStates["STEP-03C-PAR-NESTED-DSP"]?.status).toBe("COMPLETED");
    expect(executedSteps).toContain("SUB-STEP-01:AGT-07");

    // Attempt self-approval -> must fail
    await expect(
      engine.signalApprovalDecision({
        executionId: "EXEC-COMPOSITE-001",
        stepId: "STEP-04-APPROVAL",
        signalIdempotencyKey: "SIG-SELF-01",
        decision: "APPROVED",
        approverPrincipalId: "user-architect-01",
        approvalTokenId: "APR-TOKEN-001",
      })
    ).rejects.toThrow(/SELF_APPROVAL_FORBIDDEN/);

    // Approve with distinct Reviewer principal -> completes workflow through AGT-19
    const completed = await engine.signalApprovalDecision({
      executionId: "EXEC-COMPOSITE-001",
      stepId: "STEP-04-APPROVAL",
      signalIdempotencyKey: "SIG-REVIEWER-01",
      decision: "APPROVED",
      approverPrincipalId: "user-reviewer-02",
      approvalTokenId: "APR-TOKEN-001",
    });

    expect(completed.status).toBe("COMPLETED");
    expect(completed.stepStates["STEP-05-AGT19"]?.status).toBe("COMPLETED");
  });

  it("survives simulated process crash mid-workflow and resumes safely from disk checkpoint without re-running completed steps", async () => {
    const stepInvocationCounts: Record<string, number> = {};

    // Process Instance #1: runs STEP-1 and pauses at checkpoint boundary (simulating process termination right after STEP-1)
    const engineProcess1 = new DurableWorkflowEngine({
      checkpointDir: tempCheckpointDir,
      agentHandler: (ctx) => {
        stepInvocationCounts[ctx.step.stepId] = (stepInvocationCounts[ctx.step.stepId] ?? 0) + 1;
        return {
          success: true,
          pauseAfterStepForCheckpointTest: ctx.step.stepId === "STEP-1",
          outputSummary: { [`${ctx.step.stepId}_committed`]: "yes" },
        };
      },
    });

    const wfDef = {
      workflowId: "WF-CRASH-RECOVERY",
      name: "Crash Recovery Durable Workflow",
      tenantId: "tenant-01",
      projectId: "proj-recovery",
      inputContractSchemaId: "In",
      outputContractSchemaId: "Out",
      steps: [
        {
          stepId: "STEP-1",
          title: "First Step Before Process Crash",
          kind: "SEQUENTIAL_TASK" as const,
          responsibleAgentId: "AGT-11" as const,
          actionTier: "1" as const,
          requiredTools: ["filesystem.write"],
          exclusiveWriteGlobs: ["apps/api/**"],
          evidenceRequirements: [{ evidenceKind: "FILE_SHA256_BINDING" as const, description: "Step 1 hash" }],
        },
        {
          stepId: "STEP-2",
          title: "Second Step After Process Restart",
          kind: "SEQUENTIAL_TASK" as const,
          responsibleAgentId: "AGT-12" as const,
          actionTier: "1" as const,
          requiredTools: ["filesystem.write"],
          exclusiveWriteGlobs: ["apps/web/**"],
          dependsOnStepIds: ["STEP-1"],
          evidenceRequirements: [{ evidenceKind: "FILE_SHA256_BINDING" as const, description: "Step 2 hash" }],
        },
        {
          stepId: "STEP-3-VERIFY",
          title: "Terminal AGT-19 Verification",
          kind: "INDEPENDENT_VERIFICATION_GATE" as const,
          responsibleAgentId: "AGT-19" as const,
          actionTier: "0" as const,
          requiredTools: ["filesystem.stat_hash"],
          dependsOnStepIds: ["STEP-2"],
          evidenceRequirements: [{ evidenceKind: "AGT19_VERIFICATION_VERDICT" as const, description: "Verdict" }],
        },
      ],
      completionConditions: ["STEP-3-VERIFY === COMPLETED"],
      evidenceRequirements: [{ evidenceKind: "AGT19_VERIFICATION_VERDICT" as const, description: "Verdict" }],
    };

    engineProcess1.registerWorkflow(wfDef);
    const interrupted = await engineProcess1.startWorkflow({
      executionId: "EXEC-CRASH-001",
      idempotencyKey: "IDEM-CRASH-001",
      workflowId: "WF-CRASH-RECOVERY",
      inputContext: {},
      requesterPrincipalId: "op-1",
    });

    expect(interrupted.status).toBe("PAUSED_CHECKPOINTED");
    expect(interrupted.stepStates["STEP-1"]?.status).toBe("COMPLETED");
    expect(interrupted.stepStates["STEP-2"]?.status).toBe("PENDING");
    expect(stepInvocationCounts["STEP-1"]).toBe(1);

    // Process Instance #2: brand-new engine instance reading only from tempCheckpointDir on disk
    const engineProcess2 = new DurableWorkflowEngine({
      checkpointDir: tempCheckpointDir,
      agentHandler: (ctx) => {
        stepInvocationCounts[ctx.step.stepId] = (stepInvocationCounts[ctx.step.stepId] ?? 0) + 1;
        return {
          success: true,
          outputSummary: { [`${ctx.step.stepId}_committed`]: "yes" },
        };
      },
    });
    engineProcess2.registerWorkflow(wfDef);

    const resumed = await engineProcess2.resumeFromDiskCheckpoint("EXEC-CRASH-001");
    expect(resumed.status).toBe("COMPLETED");
    // STEP-1 must NOT have been re-executed!
    expect(stepInvocationCounts["STEP-1"]).toBe(1);
    expect(stepInvocationCounts["STEP-2"]).toBe(1);
    expect(stepInvocationCounts["STEP-3-VERIFY"]).toBe(1);
    expect(resumed.outputContext["STEP-1_committed"]).toBe("yes");
    expect(resumed.outputContext["STEP-2_committed"]).toBe("yes");
  });

  it("handles transient agent failure via retry and permanent agent failure via LIFO compensating rollback", async () => {
    const rolledBackOrder: string[] = [];
    let step2Attempts = 0;

    const engine = new DurableWorkflowEngine({
      checkpointDir: tempCheckpointDir,
      agentHandler: (ctx) => {
        if (ctx.step.stepId === "STEP-2-TRANSIENT") {
          step2Attempts += 1;
          if (step2Attempts === 1) {
            return { success: false, errorCode: "TRANSIENT_TIMEOUT", errorMessage: "First attempt transient error" };
          }
          return { success: true };
        }
        if (ctx.step.stepId === "STEP-3-PERMANENT-FAIL") {
          return { success: false, errorCode: "FATAL_COMPILATION_ERROR", errorMessage: "Unrecoverable syntax error" };
        }
        return { success: true };
      },
      rollbackHandler: (step) => {
        rolledBackOrder.push(step.stepId);
      },
    });

    engine.registerWorkflow({
      workflowId: "WF-RETRY-AND-ROLLBACK",
      name: "Retry and LIFO Rollback Test",
      tenantId: "tenant-01",
      projectId: "proj-rollback",
      inputContractSchemaId: "In",
      outputContractSchemaId: "Out",
      steps: [
        {
          stepId: "STEP-1-OK",
          title: "Step 1 Succeeds",
          kind: "SEQUENTIAL_TASK",
          responsibleAgentId: "AGT-04",
          actionTier: "1",
          requiredTools: ["filesystem.write"],
          exclusiveWriteGlobs: ["contracts/**"],
          evidenceRequirements: [{ evidenceKind: "FILE_SHA256_BINDING", description: "H1" }],
        },
        {
          stepId: "STEP-2-TRANSIENT",
          title: "Step 2 Fails Once Then Succeeds on Retry",
          kind: "SEQUENTIAL_TASK",
          responsibleAgentId: "AGT-11",
          actionTier: "1",
          requiredTools: ["filesystem.write"],
          exclusiveWriteGlobs: ["apps/api/**"],
          dependsOnStepIds: ["STEP-1-OK"],
          failurePolicy: {
            onFailure: "RETRY_WITH_BACKOFF",
            maxAttempts: 3,
            backoffMs: 1,
            rollbackSupported: true,
            rollbackCommandHint: "git checkout -- apps/api/**",
          },
          evidenceRequirements: [{ evidenceKind: "FILE_SHA256_BINDING", description: "H2" }],
        },
        {
          stepId: "STEP-3-PERMANENT-FAIL",
          title: "Step 3 Exhausts Retries and Triggers LIFO Rollback",
          kind: "SEQUENTIAL_TASK",
          responsibleAgentId: "AGT-08",
          actionTier: "1",
          requiredTools: ["filesystem.write"],
          exclusiveWriteGlobs: ["plugins/vst3/**"],
          dependsOnStepIds: ["STEP-2-TRANSIENT"],
          failurePolicy: {
            onFailure: "RETRY_WITH_BACKOFF",
            maxAttempts: 2,
            backoffMs: 1,
            rollbackSupported: true,
            rollbackCommandHint: "git checkout -- plugins/vst3/**",
          },
          evidenceRequirements: [{ evidenceKind: "FILE_SHA256_BINDING", description: "H3" }],
        },
      ],
      completionConditions: ["STEP-3-PERMANENT-FAIL === COMPLETED"],
      evidenceRequirements: [{ evidenceKind: "FILE_SHA256_BINDING", description: "Final" }],
    });

    const outcome = await engine.startWorkflow({
      executionId: "EXEC-ROLLBACK-001",
      idempotencyKey: "IDEM-ROLLBACK-001",
      workflowId: "WF-RETRY-AND-ROLLBACK",
      inputContext: {},
      requesterPrincipalId: "op-1",
    });

    expect(step2Attempts).toBe(2);
    expect(outcome.stepStates["STEP-3-PERMANENT-FAIL"]?.attempts).toBe(2);
    expect(outcome.status).toBe("ROLLED_BACK");
    // Strict LIFO reverse order: STEP-2-TRANSIENT (fenceToken 2) rolled back before STEP-1-OK (fenceToken 1)
    expect(rolledBackOrder).toEqual(["STEP-2-TRANSIENT", "STEP-1-OK"]);
    expect(outcome.stepStates["STEP-2-TRANSIENT"]?.status).toBe("ROLLED_BACK");
    expect(outcome.stepStates["STEP-1-OK"]?.status).toBe("ROLLED_BACK");
  });

  it("prevents duplicate execution via idempotency keys and rejects concurrent task write-glob & stale fence-token conflicts", async () => {
    let runCount = 0;
    const engine = new DurableWorkflowEngine({
      checkpointDir: tempCheckpointDir,
      agentHandler: () => {
        runCount += 1;
        return { success: true };
      },
    });

    engine.registerWorkflow({
      workflowId: "WF-IDEMPOTENT",
      name: "Idempotent Workflow",
      tenantId: "t1",
      projectId: "p1",
      inputContractSchemaId: "In",
      outputContractSchemaId: "Out",
      steps: [
        {
          stepId: "S1",
          title: "Single Step",
          kind: "SEQUENTIAL_TASK",
          responsibleAgentId: "AGT-11",
          actionTier: "1",
          requiredTools: ["filesystem.write"],
          exclusiveWriteGlobs: ["apps/api/**"],
          evidenceRequirements: [{ evidenceKind: "FILE_SHA256_BINDING", description: "H1" }],
        },
      ],
      completionConditions: ["S1 === COMPLETED"],
      evidenceRequirements: [{ evidenceKind: "FILE_SHA256_BINDING", description: "H1" }],
    });

    const firstRun = await engine.startWorkflow({
      executionId: "EXEC-IDEM-1",
      idempotencyKey: "KEY-UNIQUE-100",
      workflowId: "WF-IDEMPOTENT",
      inputContext: {},
      requesterPrincipalId: "op-1",
    });
    const duplicateRun = await engine.startWorkflow({
      executionId: "EXEC-IDEM-2",
      idempotencyKey: "KEY-UNIQUE-100",
      workflowId: "WF-IDEMPOTENT",
      inputContext: {},
      requesterPrincipalId: "op-1",
    });

    expect(firstRun.status).toBe("COMPLETED");
    expect(duplicateRun.executionId).toBe("EXEC-IDEM-1");
    expect(runCount).toBe(1);

    // Concurrent task write-glob conflict test: two parallel ready steps contending on "apps/api/**"
    engine.registerWorkflow({
      workflowId: "WF-PARALLEL-CONFLICT",
      name: "Parallel Write Conflict Workflow",
      tenantId: "t1",
      projectId: "p1",
      inputContractSchemaId: "In",
      outputContractSchemaId: "Out",
      steps: [
        {
          stepId: "PAR-A",
          title: "Parallel Task A writing to apps/api/**",
          kind: "SEQUENTIAL_TASK",
          responsibleAgentId: "AGT-11",
          actionTier: "1",
          requiredTools: ["filesystem.write"],
          exclusiveWriteGlobs: ["apps/api/**"],
          evidenceRequirements: [{ evidenceKind: "FILE_SHA256_BINDING", description: "HA" }],
        },
        {
          stepId: "PAR-B",
          title: "Parallel Task B illegally contending on apps/api/src/**",
          kind: "SEQUENTIAL_TASK",
          responsibleAgentId: "AGT-05",
          actionTier: "1",
          requiredTools: ["filesystem.write"],
          exclusiveWriteGlobs: ["apps/api/src/**"],
          evidenceRequirements: [{ evidenceKind: "FILE_SHA256_BINDING", description: "HB" }],
        },
      ],
      completionConditions: ["PAR-A && PAR-B"],
      evidenceRequirements: [{ evidenceKind: "FILE_SHA256_BINDING", description: "H" }],
    });

    const conflictResult = await engine.startWorkflow({
      executionId: "EXEC-CONFLICT-1",
      idempotencyKey: "KEY-CONFLICT-1",
      workflowId: "WF-PARALLEL-CONFLICT",
      inputContext: {},
      requesterPrincipalId: "op-1",
    });

    expect(conflictResult.status).toBe("FAILED");
    const walRecords = engine.verifyWalChainOnDisk(
      "EXEC-CONFLICT-1",
      conflictResult.walHeadHash,
      conflictResult.walSequenceNumber
    );
    expect(walRecords.some((w) => w.eventType === "CONCURRENT_CONFLICT_REJECTED")).toBe(true);

    // Stale fence token rejection test
    engine.validateFenceTokenWrite("services/policy/**", 5);
    expect(() => engine.validateFenceTokenWrite("services/policy/**", 4)).toThrow(
      /STALE_FENCE_TOKEN_REJECTED/
    );
  });

  it("enforces step timeouts, execution budgets, and lowers CompiledEngineeringSpecification end-to-end via MultiAgentOrchestrationEngine", async () => {
    const engine = new DurableWorkflowEngine({
      checkpointDir: tempCheckpointDir,
      agentHandler: (ctx) => {
        if (ctx.step.stepId === "STEP-BUDGET-BLOWOUT") {
          return {
            success: true,
            tokensConsumed: 50_000,
            costUsdConsumed: 25.0,
          };
        }
        return { success: true };
      },
    });

    engine.registerWorkflow({
      workflowId: "WF-BUDGET-CAP",
      name: "Budget Circuit Breaker Test",
      tenantId: "t1",
      projectId: "p1",
      inputContractSchemaId: "In",
      outputContractSchemaId: "Out",
      budget: {
        maxTotalTokens: 10_000,
        maxTotalCostUsd: 5.0,
        maxDurationMs: 10_000,
        maxSteps: 10,
      },
      steps: [
        {
          stepId: "STEP-BUDGET-BLOWOUT",
          title: "Exceed Token and Cost Budget",
          kind: "SEQUENTIAL_TASK",
          responsibleAgentId: "AGT-05",
          actionTier: "1",
          requiredTools: ["provider.complete"],
          evidenceRequirements: [{ evidenceKind: "AUDIT_CHAIN_HASH", description: "H" }],
        },
      ],
      completionConditions: ["STEP-BUDGET-BLOWOUT === COMPLETED"],
      evidenceRequirements: [{ evidenceKind: "AUDIT_CHAIN_HASH", description: "H" }],
    });

    const budgetExceeded = await engine.startWorkflow({
      executionId: "EXEC-BUDGET-1",
      idempotencyKey: "KEY-BUDGET-1",
      workflowId: "WF-BUDGET-CAP",
      inputContext: {},
      requesterPrincipalId: "op-1",
    });

    expect(budgetExceeded.status).toBe("BUDGET_EXCEEDED");

    // End-to-End Compiler -> MultiAgentOrchestrationEngine lowering & execution
    const compiledSpec = compileProjectSpecification({
      projectId: "e2e-compiled-orchestration",
      tenantId: "tenant-01",
      specificationVersion: "1.0.0",
      failOnBlockingAmbiguity: true,
      inputs: [
        {
          inputId: "IN-E2E-1",
          inputType: "PRODUCT_DIRECTION",
          title: "Compiled Multi-Agent Workflow Execution",
          rawContent: "Verify end-to-end compilation to durable multi-agent execution.",
          sourceUri: "workspace://inline",
          structuredRequirements: [
            {
              id: "REQ-F-0901",
              kind: "FUNCTIONAL",
              statement: "Inspect FL Studio 2025 .flp header non-destructively and verify via AGT-19.",
              metricName: "mutatedBytes",
              thresholdOperator: "==",
              thresholdValue: 0,
              unit: "bytes",
              actionTier: "0",
              autonomyLevel: "L3",
              requestedCapabilities: ["flp_readonly_binary_inspection"],
              constraints: [],
              dependsOnRequirementIds: [],
            },
          ],
          metadata: {},
        },
      ],
    });

    const orchestrator = new MultiAgentOrchestrationEngine({
      checkpointDir: tempCheckpointDir,
      agentDispatcher: (ctx) => ({
        success: true,
        outputSummary: { [`${ctx.step.stepId}_verifiedBy`]: ctx.step.responsibleAgentId },
      }),
    });

    const finalCheckpoint = await orchestrator.executeCompiledSpecification({
      spec: compiledSpec,
      executionId: "EXEC-COMPILED-E2E-001",
      idempotencyKey: "IDEM-COMPILED-E2E-001",
      requesterPrincipalId: "principal-architect",
    });

    expect(finalCheckpoint.status).toBe("COMPLETED");
    expect(finalCheckpoint.outputContext["TASK-0002_verifiedBy"]).toBe("AGT-19");
  });
});
