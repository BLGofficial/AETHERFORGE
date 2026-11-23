import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  type DurableStepRuntimeState,
  type DurableWorkflowCheckpoint,
  DurableWorkflowCheckpointSchema,
  type StepExecutionEvidence,
  type WalEventRecord,
  WalEventRecordSchema,
  type WorkflowDefinition,
  WorkflowDefinitionSchema,
  type WorkflowDefinitionInput,
  type WorkflowStepSpec,
} from "../../WORKFLOW_SCHEMA/workflow-schema.ts";

export interface StepAgentExecutionContext {
  executionId: string;
  workflowId: string;
  step: WorkflowStepSpec;
  attemptNumber: number;
  fenceToken: number;
  inputContext: Record<string, string>;
  outputContext: Record<string, string>;
}

export interface StepAgentExecutionResult {
  success: boolean;
  outputArtifactSha256?: string;
  commandExitCode?: number;
  tokensConsumed?: number;
  costUsdConsumed?: number;
   simulatedDurationMs?: number;
  outputSummary?: Record<string, string>;
  errorCode?: string;
  errorMessage?: string;
  pauseAfterStepForCheckpointTest?: boolean;
}

export type StepAgentHandler = (
  ctx: StepAgentExecutionContext
) => Promise<StepAgentExecutionResult> | StepAgentExecutionResult;

export type StepRollbackHandler = (
  step: WorkflowStepSpec,
  stepState: DurableStepRuntimeState,
  executionId: string
) => Promise<void> | void;

export interface DurableWorkflowEngineOptions {
  checkpointDir: string;
  agentHandler: StepAgentHandler;
  rollbackHandler?: StepRollbackHandler | undefined;
  isEmergencyStopped?: (() => boolean) | undefined;
}

const GENESIS_WAL_HASH = "0".repeat(64);

function sha256Hex(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex").toUpperCase();
}

export class DurableWorkflowEngine {
  private readonly checkpointDir: string;
  private readonly agentHandler: StepAgentHandler;
  private readonly rollbackHandler: StepRollbackHandler | undefined;
  private readonly isEmergencyStopped: () => boolean;
  private readonly registeredWorkflows = new Map<string, WorkflowDefinition>();
  private readonly idempotencyKeyToExecutionId = new Map<string, string>();
  private readonly activePathLeases = new Map<string, { stepId: string; fenceToken: number }>();
  private readonly maxSeenFenceTokenByPath = new Map<string, number>();

  public constructor(options: DurableWorkflowEngineOptions) {
    this.checkpointDir = options.checkpointDir;
    this.agentHandler = options.agentHandler;
    this.rollbackHandler = options.rollbackHandler;
    this.isEmergencyStopped = options.isEmergencyStopped ?? (() => false);
    if (!existsSync(this.checkpointDir)) {
      mkdirSync(this.checkpointDir, { recursive: true });
    }
  }

  public registerWorkflow(definitionInput: WorkflowDefinitionInput): WorkflowDefinition {
    const parsed = WorkflowDefinitionSchema.parse(definitionInput);
    this.registeredWorkflows.set(parsed.workflowId, parsed);
    return parsed;
  }

  public async startWorkflow(params: {
    executionId: string;
    idempotencyKey: string;
    workflowId: string;
    inputContext: Record<string, string>;
    requesterPrincipalId: string;
    nestingDepth?: number;
    parentExecutionId?: string | null;
  }): Promise<DurableWorkflowCheckpoint> {
    // 1. Idempotency deduplication across memory and disk checkpoints
    const existingExecId = this.idempotencyKeyToExecutionId.get(params.idempotencyKey);
    if (existingExecId && existsSync(this.getCheckpointPath(existingExecId))) {
      const existingCheckpoint = this.readAndVerifyCheckpointFromDisk(existingExecId);
      this.appendWalEvent(
        existingCheckpoint,
        "DUPLICATE_EXECUTION_DEDUPLICATED",
        null,
        `Deduplicated duplicate start request for idempotencyKey=${params.idempotencyKey}`
      );
      this.saveCheckpointToDisk(existingCheckpoint);
      return existingCheckpoint;
    }

    if (existsSync(this.getCheckpointPath(params.executionId))) {
      const diskCheckpoint = this.readAndVerifyCheckpointFromDisk(params.executionId);
      if (diskCheckpoint.idempotencyKey === params.idempotencyKey) {
        this.appendWalEvent(
          diskCheckpoint,
          "DUPLICATE_EXECUTION_DEDUPLICATED",
          null,
          `Deduplicated duplicate executionId=${params.executionId}`
        );
        this.saveCheckpointToDisk(diskCheckpoint);
        return diskCheckpoint;
      }
    }

    const definition = this.registeredWorkflows.get(params.workflowId);
    if (!definition) {
      throw new Error(`WORKFLOW_NOT_REGISTERED: ${params.workflowId}`);
    }

    const nestingDepth = params.nestingDepth ?? 0;
    if (nestingDepth > 2) {
      throw new Error(`MAX_NESTING_DEPTH_EXCEEDED: depth=${nestingDepth} > 2`);
    }

    const now = new Date().toISOString();
    const stepStates: Record<string, DurableStepRuntimeState> = {};
    for (const step of definition.steps) {
      stepStates[step.stepId] = {
        stepId: step.stepId,
        status: "PENDING",
        attempts: 0,
        assignedFenceToken: 0,
        lastErrorCode: null,
        lastErrorMessage: null,
        approvalTokenId: null,
        approverPrincipalId: null,
        evidence: null,
        startedAt: null,
        completedAt: null,
        rolledBackAt: null,
      };
    }

    const checkpoint: DurableWorkflowCheckpoint = {
      schemaVersion: "1.0.0",
      executionId: params.executionId,
      idempotencyKey: params.idempotencyKey,
      workflowId: definition.workflowId,
      tenantId: definition.tenantId,
      projectId: definition.projectId,
      status: "CREATED",
      currentFenceToken: 0,
      nestingDepth,
      parentExecutionId: params.parentExecutionId ?? null,
      inputContext: { ...params.inputContext, __requesterPrincipalId: params.requesterPrincipalId },
      outputContext: {},
      consumedTokens: 0,
      consumedCostUsd: 0,
      elapsedDurationMs: 0,
      stepStates,
      processedIdempotencyKeys: [params.idempotencyKey],
      rolledBackStepIds: [],
      walHeadHash: GENESIS_WAL_HASH,
      walSequenceNumber: 0,
      checkpointSha256: GENESIS_WAL_HASH,
      updatedAt: now,
    };

    this.idempotencyKeyToExecutionId.set(params.idempotencyKey, params.executionId);
    this.appendWalEvent(checkpoint, "WORKFLOW_CREATED", null, `Created workflow ${definition.workflowId}`);

    // 2. Validate Preconditions
    checkpoint.status = "VALIDATING_PRECONDITIONS";
    for (const pre of definition.preconditions) {
      const actualVal = checkpoint.inputContext[pre.requiredContextKey];
      if (actualVal === undefined || (pre.expectedValue !== undefined && actualVal !== pre.expectedValue)) {
        checkpoint.status = "FAILED";
        this.appendWalEvent(
          checkpoint,
          "WORKFLOW_FAILED",
          null,
          `Precondition failed: ${pre.preconditionId} (${pre.requiredContextKey})`
        );
        this.saveCheckpointToDisk(checkpoint);
        return checkpoint;
      }
    }

    this.appendWalEvent(checkpoint, "PRECONDITIONS_VERIFIED", null, "All workflow preconditions satisfied.");
    checkpoint.status = "RUNNING";
    this.saveCheckpointToDisk(checkpoint);

    return this.driveExecutionLoop(definition, checkpoint);
  }

  public async resumeFromDiskCheckpoint(executionId: string): Promise<DurableWorkflowCheckpoint> {
    const checkpoint = this.readAndVerifyCheckpointFromDisk(executionId);
    this.verifyWalChainOnDisk(executionId, checkpoint.walHeadHash, checkpoint.walSequenceNumber);

    const definition = this.registeredWorkflows.get(checkpoint.workflowId);
    if (!definition) {
      throw new Error(`WORKFLOW_NOT_REGISTERED: ${checkpoint.workflowId}`);
    }

    if (
      checkpoint.status === "COMPLETED" ||
      checkpoint.status === "ROLLED_BACK" ||
      checkpoint.status === "FAILED" ||
      checkpoint.status === "BUDGET_EXCEEDED" ||
      checkpoint.status === "TIMED_OUT"
    ) {
      return checkpoint;
    }

    if (checkpoint.status === "WAITING_FOR_APPROVAL") {
      return checkpoint;
    }

    checkpoint.status = "RUNNING";
    this.saveCheckpointToDisk(checkpoint);
    return this.driveExecutionLoop(definition, checkpoint);
  }

  public async signalApprovalDecision(params: {
    executionId: string;
    stepId: string;
    signalIdempotencyKey: string;
    decision: "APPROVED" | "REJECTED";
    approverPrincipalId: string;
    approvalTokenId: string;
  }): Promise<DurableWorkflowCheckpoint> {
    const checkpoint = this.readAndVerifyCheckpointFromDisk(params.executionId);
    if (checkpoint.processedIdempotencyKeys.includes(params.signalIdempotencyKey)) {
      this.appendWalEvent(
        checkpoint,
        "DUPLICATE_EXECUTION_DEDUPLICATED",
        params.stepId,
        `Deduplicated duplicate approval signal ${params.signalIdempotencyKey}`
      );
      this.saveCheckpointToDisk(checkpoint);
      return checkpoint;
    }

    const definition = this.registeredWorkflows.get(checkpoint.workflowId);
    if (!definition) {
      throw new Error(`WORKFLOW_NOT_REGISTERED: ${checkpoint.workflowId}`);
    }

    const stepSpec = definition.steps.find((s) => s.stepId === params.stepId);
    const stepState = checkpoint.stepStates[params.stepId];
    if (!stepSpec || !stepState || stepState.status !== "WAITING_FOR_APPROVAL") {
      throw new Error(`STEP_NOT_WAITING_FOR_APPROVAL: ${params.stepId}`);
    }

    const requesterId = checkpoint.inputContext["__requesterPrincipalId"] ?? "";
    if (requesterId === params.approverPrincipalId) {
      throw new Error(`SELF_APPROVAL_FORBIDDEN: requesterId=${requesterId} cannot approve own workflow step.`);
    }

    checkpoint.processedIdempotencyKeys.push(params.signalIdempotencyKey);

    if (params.decision === "REJECTED") {
      this.appendWalEvent(
        checkpoint,
        "APPROVAL_REJECTED",
        params.stepId,
        `Approval rejected by ${params.approverPrincipalId}`
      );
      stepState.status = "FAILED";
      stepState.lastErrorCode = "HUMAN_APPROVAL_REJECTED";
      stepState.lastErrorMessage = `Rejected by ${params.approverPrincipalId}`;
      if (stepSpec.failurePolicy.rollbackSupported) {
        await this.executeLifoRollback(definition, checkpoint, `Human rejected step ${params.stepId}`);
      } else {
        checkpoint.status = "FAILED";
      }
      this.saveCheckpointToDisk(checkpoint);
      return checkpoint;
    }

    // Approved
    stepState.approvalTokenId = params.approvalTokenId;
    stepState.approverPrincipalId = params.approverPrincipalId;
    this.appendWalEvent(
      checkpoint,
      "APPROVAL_GRANTED",
      params.stepId,
      `Approval granted by ${params.approverPrincipalId} (token=${params.approvalTokenId})`
    );

    if (stepSpec.kind === "HUMAN_APPROVAL_GATE") {
      stepState.status = "COMPLETED";
      stepState.completedAt = new Date().toISOString();
      stepState.evidence = {
        stepId: stepSpec.stepId,
        attemptNumber: 1,
        agentId: stepSpec.responsibleAgentId,
        fenceToken: stepState.assignedFenceToken,
        outputArtifactSha256: sha256Hex(params.approvalTokenId),
        commandExitCode: 0,
        tokensConsumed: 0,
        costUsdConsumed: 0,
        durationMs: 1,
        auditEntryHash: checkpoint.walHeadHash,
        outputSummary: { approvedBy: params.approverPrincipalId, tokenId: params.approvalTokenId },
      };
      this.appendWalEvent(checkpoint, "STEP_COMPLETED", stepSpec.stepId, "Human approval gate satisfied.");
    } else {
      // Tier 2/3 action step now ready to execute its agent handler with the approval token attached
      stepState.status = "READY";
    }

    checkpoint.status = "RUNNING";
    this.saveCheckpointToDisk(checkpoint);
    return this.driveExecutionLoop(definition, checkpoint);
  }

  public validateFenceTokenWrite(canonicalPath: string, fenceToken: number): void {
    const maxSeen = this.maxSeenFenceTokenByPath.get(canonicalPath) ?? 0;
    if (fenceToken < maxSeen) {
      throw new Error(
        `STALE_FENCE_TOKEN_REJECTED: path=${canonicalPath} presented fenceToken=${fenceToken} < maxSeen=${maxSeen}`
      );
    }
    this.maxSeenFenceTokenByPath.set(canonicalPath, fenceToken);
  }

  private async driveExecutionLoop(
    definition: WorkflowDefinition,
    checkpoint: DurableWorkflowCheckpoint
  ): Promise<DurableWorkflowCheckpoint> {
    while (checkpoint.status === "RUNNING") {
      if (this.isEmergencyStopped()) {
        checkpoint.status = "ABORTED_EMERGENCY_STOP";
        this.appendWalEvent(checkpoint, "WORKFLOW_FAILED", null, "Preempted by EmergencyStopRegistry.");
        this.saveCheckpointToDisk(checkpoint);
        return checkpoint;
      }

      // Check if all steps are terminal (COMPLETED or SKIPPED_CONDITION_FALSE)
      const allSteps = definition.steps;
      const allDone = allSteps.every((s) => {
        const st = checkpoint.stepStates[s.stepId]?.status;
        return st === "COMPLETED" || st === "SKIPPED_CONDITION_FALSE";
      });

      if (allDone) {
        checkpoint.status = "COMPLETED";
        this.appendWalEvent(checkpoint, "WORKFLOW_COMPLETED", null, `Workflow ${definition.workflowId} completed.`);
        this.saveCheckpointToDisk(checkpoint);
        return checkpoint;
      }

      // Find ready steps whose dependencies are all COMPLETED or SKIPPED_CONDITION_FALSE
      const readySteps = allSteps.filter((s) => {
        const st = checkpoint.stepStates[s.stepId]!;
        if (st.status !== "PENDING" && st.status !== "READY") return false;
        return s.dependsOnStepIds.every((depId) => {
          const depStatus = checkpoint.stepStates[depId]?.status;
          return depStatus === "COMPLETED" || depStatus === "SKIPPED_CONDITION_FALSE";
        });
      });

      if (readySteps.length === 0) {
        // Check if any step is WAITING_FOR_APPROVAL
        const anyWaiting = allSteps.some((s) => checkpoint.stepStates[s.stepId]?.status === "WAITING_FOR_APPROVAL");
        if (anyWaiting) {
          checkpoint.status = "WAITING_FOR_APPROVAL";
          this.saveCheckpointToDisk(checkpoint);
          return checkpoint;
        }
        checkpoint.status = "FAILED";
        this.appendWalEvent(checkpoint, "WORKFLOW_FAILED", null, "Deadlock or unresolved dependency in workflow.");
        this.saveCheckpointToDisk(checkpoint);
        return checkpoint;
      }

      // If multiple steps are ready concurrently, verify disjoint exclusiveWriteGlobs before parallel dispatch
      if (readySteps.length > 1) {
        const conflict = this.detectWriteGlobConflict(readySteps);
        if (conflict) {
          this.appendWalEvent(checkpoint, "CONCURRENT_CONFLICT_REJECTED", null, conflict);
          checkpoint.status = "FAILED";
          this.saveCheckpointToDisk(checkpoint);
          return checkpoint;
        }

        // Execute ready frontier in parallel
        let shouldPauseForCheckpointTest = false;
        const results = await Promise.all(
          readySteps.map((step) => this.executeSingleStep(definition, checkpoint, step))
        );

        for (const r of results) {
          if (r.pauseRequested) shouldPauseForCheckpointTest = true;
          if (checkpoint.status !== "RUNNING") break;
        }

        if (shouldPauseForCheckpointTest && checkpoint.status === "RUNNING") {
          checkpoint.status = "PAUSED_CHECKPOINTED";
          this.appendWalEvent(checkpoint, "CHECKPOINT_SAVED", null, "Paused at durable checkpoint boundary.");
          this.saveCheckpointToDisk(checkpoint);
          return checkpoint;
        }
      } else {
        const step = readySteps[0]!;
        const res = await this.executeSingleStep(definition, checkpoint, step);
        if (res.pauseRequested && checkpoint.status === "RUNNING") {
          checkpoint.status = "PAUSED_CHECKPOINTED";
          this.appendWalEvent(checkpoint, "CHECKPOINT_SAVED", step.stepId, "Paused at durable checkpoint boundary.");
          this.saveCheckpointToDisk(checkpoint);
          return checkpoint;
        }
      }
    }

    return checkpoint;
  }

  private detectWriteGlobConflict(steps: WorkflowStepSpec[]): string | null {
    for (let i = 0; i < steps.length; i++) {
      for (let j = i + 1; j < steps.length; j++) {
        const sA = steps[i]!;
        const sB = steps[j]!;
        for (const gA of sA.exclusiveWriteGlobs) {
          for (const gB of sB.exclusiveWriteGlobs) {
            if (gA === gB || gA.startsWith(gB.replace("/**", "")) || gB.startsWith(gA.replace("/**", ""))) {
              return `CONCURRENT_WRITE_GLOB_CONFLICT: Parallel steps ${sA.stepId} (${sA.responsibleAgentId}) and ${sB.stepId} (${sB.responsibleAgentId}) contend on overlapping write glob '${gA}' vs '${gB}'.`;
            }
          }
        }
      }
    }
    return null;
  }

  private async executeSingleStep(
    definition: WorkflowDefinition,
    checkpoint: DurableWorkflowCheckpoint,
    step: WorkflowStepSpec
  ): Promise<{ pauseRequested: boolean }> {
    const stepState = checkpoint.stepStates[step.stepId]!;

    // Assign monotonic fence token if not already assigned
    if (stepState.assignedFenceToken === 0) {
      checkpoint.currentFenceToken += 1;
      stepState.assignedFenceToken = checkpoint.currentFenceToken;
    }

    // 1. Human approval gate check (either HUMAN_APPROVAL_GATE step kind or Tier 2/3 without approval token)
    const requiresApproval = step.kind === "HUMAN_APPROVAL_GATE" || Number(step.actionTier) >= 2;
    if (requiresApproval && !stepState.approvalTokenId) {
      stepState.status = "WAITING_FOR_APPROVAL";
      checkpoint.status = "WAITING_FOR_APPROVAL";
      this.appendWalEvent(
        checkpoint,
        "STEP_WAITING_FOR_APPROVAL",
        step.stepId,
        `Step ${step.stepId} (Tier ${step.actionTier}) suspended awaiting human approval.`
      );
      this.saveCheckpointToDisk(checkpoint);
      return { pauseRequested: false };
    }

    // 2. Conditional branch evaluation
    if (step.kind === "CONDITIONAL_BRANCH" && step.condition) {
      const cond = step.condition;
      const actualVal = checkpoint.outputContext[cond.contextKey] ?? checkpoint.inputContext[cond.contextKey] ?? "";
      const conditionPassed =
        cond.operator === "EQUALS"
          ? actualVal === cond.value
          : cond.operator === "NOT_EQUALS"
            ? actualVal !== cond.value
            : cond.value.split(",").includes(actualVal);

      const skippedBranchIds = conditionPassed ? cond.elseStepIds : cond.thenStepIds;
      for (const skipId of skippedBranchIds) {
        const skipState = checkpoint.stepStates[skipId];
        if (skipState && skipState.status === "PENDING") {
          skipState.status = "SKIPPED_CONDITION_FALSE";
          this.appendWalEvent(
            checkpoint,
            "STEP_SKIPPED",
            skipId,
            `Skipped branch step ${skipId} because condition (${cond.contextKey} ${cond.operator} ${cond.value}) evaluated to ${String(conditionPassed)}.`
          );
        }
      }

      stepState.status = "COMPLETED";
      stepState.attempts = 1;
      stepState.startedAt = new Date().toISOString();
      stepState.completedAt = stepState.startedAt;
      stepState.evidence = {
        stepId: step.stepId,
        attemptNumber: 1,
        agentId: step.responsibleAgentId,
        fenceToken: stepState.assignedFenceToken,
        outputArtifactSha256: sha256Hex(`${step.stepId}:${String(conditionPassed)}`),
        commandExitCode: 0,
        tokensConsumed: 10,
        costUsdConsumed: 0.001,
        durationMs: 1,
        auditEntryHash: checkpoint.walHeadHash,
        outputSummary: { conditionEvaluated: String(conditionPassed) },
      };
      this.appendWalEvent(checkpoint, "STEP_COMPLETED", step.stepId, `Conditional gate evaluated: ${String(conditionPassed)}`);
      this.saveCheckpointToDisk(checkpoint);
      return { pauseRequested: false };
    }

    // 3. Nested Workflow Execution
    if (step.kind === "NESTED_WORKFLOW" && step.nestedWorkflowId) {
      stepState.status = "RUNNING";
      stepState.attempts += 1;
      stepState.startedAt = new Date().toISOString();
      this.appendWalEvent(
        checkpoint,
        "STEP_STARTED",
        step.stepId,
        `Spawning nested workflow ${step.nestedWorkflowId} at depth ${checkpoint.nestingDepth + 1}`
      );

      const childExecId = `${checkpoint.executionId}__sub__${step.stepId}`;
      const childCheckpoint = await this.startWorkflow({
        executionId: childExecId,
        idempotencyKey: `${checkpoint.idempotencyKey}__sub__${step.stepId}`,
        workflowId: step.nestedWorkflowId,
        inputContext: { ...checkpoint.inputContext, ...checkpoint.outputContext },
        requesterPrincipalId: checkpoint.inputContext["__requesterPrincipalId"] ?? "system",
        nestingDepth: checkpoint.nestingDepth + 1,
        parentExecutionId: checkpoint.executionId,
      });

      checkpoint.consumedTokens += childCheckpoint.consumedTokens;
      checkpoint.consumedCostUsd += childCheckpoint.consumedCostUsd;
      checkpoint.elapsedDurationMs += childCheckpoint.elapsedDurationMs;

      if (childCheckpoint.status !== "COMPLETED") {
        stepState.status = "FAILED";
        stepState.lastErrorCode = `NESTED_WORKFLOW_${childCheckpoint.status}`;
        stepState.lastErrorMessage = `Nested workflow ${step.nestedWorkflowId} ended in ${childCheckpoint.status}`;
        await this.handleStepTerminalFailure(definition, checkpoint, step, stepState);
        return { pauseRequested: false };
      }

      Object.assign(checkpoint.outputContext, childCheckpoint.outputContext);
      stepState.status = "COMPLETED";
      stepState.completedAt = new Date().toISOString();
      stepState.evidence = {
        stepId: step.stepId,
        attemptNumber: stepState.attempts,
        agentId: step.responsibleAgentId,
        fenceToken: stepState.assignedFenceToken,
        outputArtifactSha256: childCheckpoint.checkpointSha256,
        commandExitCode: 0,
        tokensConsumed: childCheckpoint.consumedTokens,
        costUsdConsumed: childCheckpoint.consumedCostUsd,
        durationMs: childCheckpoint.elapsedDurationMs,
        auditEntryHash: childCheckpoint.walHeadHash,
        outputSummary: { nestedExecutionId: childExecId, nestedStatus: childCheckpoint.status },
      };
      this.appendWalEvent(checkpoint, "STEP_COMPLETED", step.stepId, `Nested workflow ${step.nestedWorkflowId} completed.`);
      this.saveCheckpointToDisk(checkpoint);
      return { pauseRequested: false };
    }

    // 4. Standard / Parallel / Verification Agent Task Execution with Retry & Timeout
    const maxAttempts = step.failurePolicy.onFailure === "RETRY_WITH_BACKOFF" ? step.failurePolicy.maxAttempts : 1;

    while (stepState.attempts < maxAttempts) {
      stepState.attempts += 1;
      stepState.status = "RUNNING";
      stepState.startedAt = new Date().toISOString();

      // Enforce fenced write-lock validation on all exclusiveWriteGlobs
      for (const glob of step.exclusiveWriteGlobs) {
        this.validateFenceTokenWrite(glob, stepState.assignedFenceToken);
        this.activePathLeases.set(glob, { stepId: step.stepId, fenceToken: stepState.assignedFenceToken });
      }

      this.appendWalEvent(
        checkpoint,
        "STEP_STARTED",
        step.stepId,
        `Attempt ${stepState.attempts}/${maxAttempts} by ${step.responsibleAgentId} (fenceToken=${stepState.assignedFenceToken})`
      );
      this.saveCheckpointToDisk(checkpoint);

      const t0 = Date.now();
      let result: StepAgentExecutionResult;
      try {
        result = await this.agentHandler({
          executionId: checkpoint.executionId,
          workflowId: checkpoint.workflowId,
          step,
          attemptNumber: stepState.attempts,
          fenceToken: stepState.assignedFenceToken,
          inputContext: checkpoint.inputContext,
          outputContext: checkpoint.outputContext,
        });
      } catch (err) {
        result = {
          success: false,
          errorCode: "AGENT_HANDLER_EXCEPTION",
          errorMessage: err instanceof Error ? err.message : String(err),
        };
      }

      const durationMs = result.simulatedDurationMs ?? Math.max(1, Date.now() - t0);
      const tokens = result.tokensConsumed ?? step.estimatedTokens;
      const costUsd = result.costUsdConsumed ?? step.estimatedCostUsd;

      checkpoint.consumedTokens += tokens;
      checkpoint.consumedCostUsd = Number((checkpoint.consumedCostUsd + costUsd).toFixed(6));
      checkpoint.elapsedDurationMs += durationMs;

      // Release active path lease
      for (const glob of step.exclusiveWriteGlobs) {
        this.activePathLeases.delete(glob);
      }

      // Check step timeout
      if (durationMs > step.timeoutMs || checkpoint.elapsedDurationMs > definition.budget.maxDurationMs) {
        stepState.status = "TIMED_OUT";
        stepState.lastErrorCode = "STEP_TIMEOUT_EXCEEDED";
        stepState.lastErrorMessage = `Step ${step.stepId} duration ${durationMs}ms exceeded timeout ${step.timeoutMs}ms`;
        this.appendWalEvent(checkpoint, "STEP_TIMED_OUT", step.stepId, stepState.lastErrorMessage);
        if (step.failurePolicy.rollbackSupported && step.failurePolicy.onFailure === "ROLLBACK_COMPLETED_STEPS") {
          await this.executeLifoRollback(definition, checkpoint, stepState.lastErrorMessage);
        } else {
          checkpoint.status = "TIMED_OUT";
          this.appendWalEvent(checkpoint, "WORKFLOW_TIMED_OUT", step.stepId, stepState.lastErrorMessage);
        }
        this.saveCheckpointToDisk(checkpoint);
        return { pauseRequested: false };
      }

      // Check token / USD budget limits
      if (
        checkpoint.consumedTokens > definition.budget.maxTotalTokens ||
        checkpoint.consumedCostUsd > definition.budget.maxTotalCostUsd
      ) {
        stepState.status = "FAILED";
        stepState.lastErrorCode = "EXECUTION_BUDGET_EXCEEDED";
        stepState.lastErrorMessage = `Consumed tokens=${checkpoint.consumedTokens}/${definition.budget.maxTotalTokens}, cost=$${checkpoint.consumedCostUsd}/$${definition.budget.maxTotalCostUsd}`;
        checkpoint.status = "BUDGET_EXCEEDED";
        this.appendWalEvent(checkpoint, "WORKFLOW_BUDGET_EXCEEDED", step.stepId, stepState.lastErrorMessage);
        this.saveCheckpointToDisk(checkpoint);
        return { pauseRequested: false };
      }

      if (result.success) {
        const evidence: StepExecutionEvidence = {
          stepId: step.stepId,
          attemptNumber: stepState.attempts,
          agentId: step.responsibleAgentId,
          fenceToken: stepState.assignedFenceToken,
          outputArtifactSha256:
            result.outputArtifactSha256 ?? sha256Hex(`${checkpoint.executionId}:${step.stepId}:${stepState.attempts}`),
          commandExitCode: result.commandExitCode ?? 0,
          tokensConsumed: tokens,
          costUsdConsumed: costUsd,
          durationMs,
          auditEntryHash: checkpoint.walHeadHash,
          outputSummary: result.outputSummary ?? {},
        };

        stepState.status = "COMPLETED";
        stepState.completedAt = new Date().toISOString();
        stepState.lastErrorCode = null;
        stepState.lastErrorMessage = null;
        stepState.evidence = evidence;
        if (result.outputSummary) {
          Object.assign(checkpoint.outputContext, result.outputSummary);
        }

        this.appendWalEvent(
          checkpoint,
          "STEP_COMPLETED",
          step.stepId,
          `Completed step ${step.stepId} on attempt ${stepState.attempts} (sha256=${evidence.outputArtifactSha256.slice(0, 16)})`
        );
        this.saveCheckpointToDisk(checkpoint);
        return { pauseRequested: result.pauseAfterStepForCheckpointTest === true };
      }

      // Failed attempt
      stepState.lastErrorCode = result.errorCode ?? "STEP_EXECUTION_FAILED";
      stepState.lastErrorMessage = result.errorMessage ?? `Step ${step.stepId} failed on attempt ${stepState.attempts}`;

      if (stepState.attempts < maxAttempts) {
        this.appendWalEvent(
          checkpoint,
          "STEP_RETRY_SCHEDULED",
          step.stepId,
          `Retrying ${step.stepId} after attempt ${stepState.attempts} failure: ${stepState.lastErrorMessage}`
        );
        this.saveCheckpointToDisk(checkpoint);
        if (step.failurePolicy.backoffMs > 0) {
          await new Promise((r) => setTimeout(r, Math.min(step.failurePolicy.backoffMs, 25)));
        }
      }
    }

    // All retry attempts exhausted
    stepState.status = "FAILED";
    this.appendWalEvent(
      checkpoint,
      "STEP_FAILED",
      step.stepId,
      `Step ${step.stepId} failed after ${stepState.attempts} attempt(s): ${stepState.lastErrorMessage}`
    );
    await this.handleStepTerminalFailure(definition, checkpoint, step, stepState);
    return { pauseRequested: false };
  }

  private async handleStepTerminalFailure(
    definition: WorkflowDefinition,
    checkpoint: DurableWorkflowCheckpoint,
    step: WorkflowStepSpec,
    stepState: DurableStepRuntimeState
  ): Promise<void> {
    if (step.failurePolicy.onFailure === "ESCALATE_TO_HUMAN") {
      stepState.status = "WAITING_FOR_APPROVAL";
      checkpoint.status = "WAITING_FOR_APPROVAL";
      this.appendWalEvent(
        checkpoint,
        "STEP_WAITING_FOR_APPROVAL",
        step.stepId,
        `Escalated failed step ${step.stepId} to human operator.`
      );
      this.saveCheckpointToDisk(checkpoint);
      return;
    }

    if (
      step.failurePolicy.rollbackSupported &&
      (step.failurePolicy.onFailure === "ROLLBACK_COMPLETED_STEPS" ||
        step.failurePolicy.onFailure === "RETRY_WITH_BACKOFF")
    ) {
      await this.executeLifoRollback(definition, checkpoint, stepState.lastErrorMessage ?? "Step failure");
      this.saveCheckpointToDisk(checkpoint);
      return;
    }

    checkpoint.status = "FAILED";
    this.appendWalEvent(
      checkpoint,
      "WORKFLOW_FAILED",
      step.stepId,
      `Workflow aborted due to step ${step.stepId} failure.`
    );
    this.saveCheckpointToDisk(checkpoint);
  }

  private async executeLifoRollback(
    definition: WorkflowDefinition,
    checkpoint: DurableWorkflowCheckpoint,
    reason: string
  ): Promise<void> {
    checkpoint.status = "ROLLING_BACK";
    const completedSteps = definition.steps
      .filter((s) => {
        const st = checkpoint.stepStates[s.stepId];
        return st?.status === "COMPLETED" && s.failurePolicy.rollbackSupported;
      })
      .sort((a, b) => {
        const fA = checkpoint.stepStates[a.stepId]?.assignedFenceToken ?? 0;
        const fB = checkpoint.stepStates[b.stepId]?.assignedFenceToken ?? 0;
        return fB - fA; // Strict LIFO reverse order
      });

    for (const step of completedSteps) {
      const st = checkpoint.stepStates[step.stepId]!;
      if (this.rollbackHandler) {
        await this.rollbackHandler(step, st, checkpoint.executionId);
      }
      st.status = "ROLLED_BACK";
      st.rolledBackAt = new Date().toISOString();
      checkpoint.rolledBackStepIds.push(step.stepId);
      this.appendWalEvent(
        checkpoint,
        "STEP_ROLLED_BACK",
        step.stepId,
        `Compensated step ${step.stepId} via '${step.failurePolicy.rollbackCommandHint}'`
      );
    }

    checkpoint.status = "ROLLED_BACK";
    this.appendWalEvent(checkpoint, "WORKFLOW_ROLLED_BACK", null, `Completed LIFO rollback: ${reason}`);
  }

  private getCheckpointPath(executionId: string): string {
    return resolve(this.checkpointDir, `${executionId}.checkpoint.json`);
  }

  private getWalPath(executionId: string): string {
    return resolve(this.checkpointDir, `${executionId}.wal.jsonl`);
  }

  private appendWalEvent(
    checkpoint: DurableWorkflowCheckpoint,
    eventType: WalEventRecord["eventType"],
    stepId: string | null,
    detail: string
  ): WalEventRecord {
    const seq = checkpoint.walSequenceNumber + 1;
    const prevWalHash = checkpoint.walHeadHash;
    const timestamp = new Date().toISOString();
    const canonicalPayload = JSON.stringify({
      sequenceNumber: seq,
      executionId: checkpoint.executionId,
      eventType,
      stepId,
      fenceToken: checkpoint.currentFenceToken,
      detail,
      prevWalHash,
    });
    const walEntryHash = sha256Hex(canonicalPayload);

    const record = WalEventRecordSchema.parse({
      sequenceNumber: seq,
      executionId: checkpoint.executionId,
      eventType,
      stepId,
      fenceToken: checkpoint.currentFenceToken,
      detail,
      prevWalHash,
      walEntryHash,
      timestamp,
    });

    appendFileSync(this.getWalPath(checkpoint.executionId), JSON.stringify(record) + "\n", "utf8");
    checkpoint.walSequenceNumber = seq;
    checkpoint.walHeadHash = walEntryHash;
    checkpoint.updatedAt = timestamp;
    return record;
  }

  private saveCheckpointToDisk(checkpoint: DurableWorkflowCheckpoint): void {
    checkpoint.updatedAt = new Date().toISOString();
    const { checkpointSha256: _ignored, ...rest } = checkpoint;
    checkpoint.checkpointSha256 = sha256Hex(JSON.stringify(rest));
    const validated = DurableWorkflowCheckpointSchema.parse(checkpoint);
    writeFileSync(this.getCheckpointPath(checkpoint.executionId), JSON.stringify(validated, null, 2) + "\n", "utf8");
  }

  public readAndVerifyCheckpointFromDisk(executionId: string): DurableWorkflowCheckpoint {
    const raw = readFileSync(this.getCheckpointPath(executionId), "utf8");
    const parsed = DurableWorkflowCheckpointSchema.parse(JSON.parse(raw));
    const { checkpointSha256, ...rest } = parsed;
    const expectedHash = sha256Hex(JSON.stringify(rest));
    if (checkpointSha256 !== expectedHash) {
      throw new Error(`CHECKPOINT_TAMPER_DETECTED: expected=${expectedHash} actual=${checkpointSha256}`);
    }
    return parsed;
  }

  public verifyWalChainOnDisk(
    executionId: string,
    expectedHeadHash: string,
    expectedSequenceNumber: number
  ): WalEventRecord[] {
    const rawLines = readFileSync(this.getWalPath(executionId), "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    let prevHash = GENESIS_WAL_HASH;
    const records: WalEventRecord[] = [];

    for (let i = 0; i < rawLines.length; i++) {
      const rec = WalEventRecordSchema.parse(JSON.parse(rawLines[i]!));
      if (rec.sequenceNumber !== i + 1 || rec.prevWalHash !== prevHash) {
        throw new Error(`WAL_HASH_CHAIN_TAMPERED at sequence=${rec.sequenceNumber}`);
      }
      const expectedEntryHash = sha256Hex(
        JSON.stringify({
          sequenceNumber: rec.sequenceNumber,
          executionId: rec.executionId,
          eventType: rec.eventType,
          stepId: rec.stepId,
          fenceToken: rec.fenceToken,
          detail: rec.detail,
          prevWalHash: rec.prevWalHash,
        })
      );
      if (rec.walEntryHash !== expectedEntryHash) {
        throw new Error(`WAL_ENTRY_HASH_MISMATCH at sequence=${rec.sequenceNumber}`);
      }
      prevHash = rec.walEntryHash;
      records.push(rec);
    }

    if (prevHash !== expectedHeadHash || records.length !== expectedSequenceNumber) {
      throw new Error(
        `WAL_CHECKPOINT_DIVERGENCE: walCount=${records.length} expected=${expectedSequenceNumber}`
      );
    }
    return records;
  }
}
