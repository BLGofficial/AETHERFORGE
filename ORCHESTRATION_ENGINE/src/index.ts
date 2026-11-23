import { type CompiledEngineeringSpecification } from "../../SPECIFICATION_SCHEMAS/compiler-schemas.ts";
import {
  type DurableWorkflowCheckpoint,
  type WorkflowDefinition,
  WorkflowDefinitionSchema,
} from "../../WORKFLOW_SCHEMA/workflow-schema.ts";
import {
  DurableWorkflowEngine,
  type StepAgentExecutionContext,
  type StepAgentExecutionResult,
  type StepRollbackHandler,
} from "../../WORKFLOW_ENGINE/src/index.ts";

/**
 * Multi-Agent Orchestration Engine bridging SYSTEM_COMPILER, AGENT_REGISTRY (AGT-01..19),
 * and WORKFLOW_ENGINE with Separation-of-Duty verification.
 */

export function lowerCompiledSpecToWorkflowDefinition(
  spec: CompiledEngineeringSpecification
): WorkflowDefinition {
  if (!spec.validation.isValid) {
    throw new Error(`CANNOT_LOWER_INVALID_SPECIFICATION: status=${spec.validation.status}`);
  }

  return WorkflowDefinitionSchema.parse({
    schemaVersion: "1.0.0",
    workflowId: spec.pipelineStages.stage10Workflow.workflowId,
    name: `Compiled Workflow for ${spec.projectId}`,
    version: spec.specificationVersion,
    tenantId: spec.tenantId,
    projectId: spec.projectId,
    inputContractSchemaId: `${spec.specificationId}#InputContract`,
    outputContractSchemaId: `${spec.specificationId}#OutputContract`,
    preconditions: [
      {
        preconditionId: "PRE-SPEC-SHA256",
        description: "Verify compiled specification SHA-256 matches expected digest",
        requiredContextKey: "specificationSha256",
        expectedValue: spec.specificationSha256,
      },
    ],
    budget: {
      maxTotalTokens: 100_000,
      maxTotalCostUsd: 10.0,
      maxDurationMs: 60_000,
      maxSteps: 30,
    },
    steps: spec.pipelineStages.stage10Workflow.tasks.map((task) => ({
      stepId: task.taskId,
      title: task.title,
      kind:
        task.assignedAgentId === "AGT-19"
          ? ("INDEPENDENT_VERIFICATION_GATE" as const)
          : ("SEQUENTIAL_TASK" as const),
      responsibleAgentId: task.assignedAgentId,
      actionTier: task.actionTier,
      requiredTools:
        task.assignedAgentId === "AGT-19"
          ? ["filesystem.stat_hash", "worker.run_command_readonly", "audit.verify_chain"]
          : ["filesystem.read", "filesystem.write", "worker.run_command"],
      exclusiveWriteGlobs: task.exclusiveWriteGlobs,
      readOnlyGlobs: ["contracts/**"],
      dependsOnStepIds: task.dependsOnTaskIds,
      timeoutMs: 5_000,
      estimatedTokens: 600,
      estimatedCostUsd: 0.01,
      failurePolicy: {
        onFailure: "RETRY_WITH_BACKOFF" as const,
        maxAttempts: 2,
        backoffMs: 5,
        rollbackSupported: task.assignedAgentId !== "AGT-19",
        rollbackCommandHint: task.rollbackHint,
      },
      completionCondition: task.verificationCheck,
      evidenceRequirements: [
        {
          evidenceKind:
            task.assignedAgentId === "AGT-19"
              ? ("AGT19_VERIFICATION_VERDICT" as const)
              : ("FILE_SHA256_BINDING" as const),
          minimumCount: 1,
          description: `Evidence binding for ${task.taskId}`,
        },
      ],
    })),
    completionConditions: ["All DAG tasks COMPLETED and AGT-19 Independent Verification Verdict === PASS"],
    evidenceRequirements: [
      {
        evidenceKind: "AGT19_VERIFICATION_VERDICT",
        minimumCount: 1,
        description: "Signed Separation-of-Duty PASS verdict from AGT-19",
      },
    ],
  });
}

export class MultiAgentOrchestrationEngine {
  private readonly workflowEngine: DurableWorkflowEngine;

  public constructor(options: {
    checkpointDir: string;
    agentDispatcher: (ctx: StepAgentExecutionContext) => Promise<StepAgentExecutionResult> | StepAgentExecutionResult;
    rollbackHandler?: StepRollbackHandler;
    isEmergencyStopped?: () => boolean;
  }) {
    this.workflowEngine = new DurableWorkflowEngine({
      checkpointDir: options.checkpointDir,
      agentHandler: async (ctx) => {
        // Separation-of-Duty gate: AGT-19 is strictly read-only (zero exclusiveWriteGlobs allowed)
        if (ctx.step.responsibleAgentId === "AGT-19" && ctx.step.exclusiveWriteGlobs.length > 0) {
          return {
            success: false,
            errorCode: "SEPARATION_OF_DUTY_VIOLATION",
            errorMessage: "AGT-19 (Independent Verification Agent) cannot hold write globs.",
          };
        }
        return options.agentDispatcher(ctx);
      },
      rollbackHandler: options.rollbackHandler,
      isEmergencyStopped: options.isEmergencyStopped,
    });
  }

  public getEngine(): DurableWorkflowEngine {
    return this.workflowEngine;
  }

  public async executeCompiledSpecification(params: {
    spec: CompiledEngineeringSpecification;
    executionId: string;
    idempotencyKey: string;
    requesterPrincipalId: string;
  }): Promise<DurableWorkflowCheckpoint> {
    const workflowDef = lowerCompiledSpecToWorkflowDefinition(params.spec);
    this.workflowEngine.registerWorkflow(workflowDef);
    return this.workflowEngine.startWorkflow({
      executionId: params.executionId,
      idempotencyKey: params.idempotencyKey,
      workflowId: workflowDef.workflowId,
      inputContext: {
        specificationSha256: params.spec.specificationSha256,
        projectId: params.spec.projectId,
      },
      requesterPrincipalId: params.requesterPrincipalId,
    });
  }
}
