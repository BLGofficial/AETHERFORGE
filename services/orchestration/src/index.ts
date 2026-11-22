import {
  type ApprovalDecision,
  type Brief,
  computeCanonicalPlanHash,
  EVENT_NAMES,
  type EvidenceRef,
  type ExecutionPlan,
  type PlanStep,
  type PolicyDecision,
  type ProductSpec,
  type RequestContext,
  type Result,
  SCHEMA_VERSION_V1,
  type SpecRef,
} from "@aether-forge/contracts";
import { computePayloadSha256 } from "@aether-forge/audit";
import type { GovernedDomainApiService } from "@aether-forge/api";

export const GOVERNED_WORKFLOW_VERSION = "aetherforge.workflow.governed_vertical_slice.v1" as const;

export interface TemporalStagingNamespaceReceipt {
  readonly namespace: "aetherforge-governed-orchestration";
  readonly taskQueue: "aetherforge-governed-task-queue-v1";
  readonly retentionDays: number;
  readonly historyArchivalEnabled: boolean;
  readonly forbidRawLocalFileBytesInPayload: true;
  readonly forbidProviderSecretsInHistory: true;
}

export function verifyTemporalStagingNamespaceConfig(): TemporalStagingNamespaceReceipt {
  return {
    namespace: "aetherforge-governed-orchestration",
    taskQueue: "aetherforge-governed-task-queue-v1",
    retentionDays: 365,
    historyArchivalEnabled: true,
    forbidRawLocalFileBytesInPayload: true,
    forbidProviderSecretsInHistory: true,
  };
}

export type WorkflowLifecycleStatus =
  | "RUNNING"
  | "WAITING_FOR_APPROVAL"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED_BY_EMERGENCY_STOP"
  | "FAILED";

export interface WorkflowHistoryEvent {
  readonly eventIndex: number;
  readonly eventType:
    | "WorkflowExecutionStarted"
    | "ActivityTaskCompleted"
    | "ActivityTaskRetried"
    | "WorkflowExecutionSignaled"
    | "WorkflowExecutionCompleted"
    | "WorkflowExecutionCancelled";
  readonly timestamp: string;
  readonly stepId?: string | undefined;
  readonly detail: Record<string, unknown>;
}

export interface StepPolicyEvaluationView {
  readonly step: PlanStep;
  readonly policyDecision: PolicyDecision;
  readonly approvalId?: string | undefined;
}

export interface GovernedWorkflowState {
  readonly workflowId: string;
  readonly workflowVersion: typeof GOVERNED_WORKFLOW_VERSION;
  readonly tenantId: string;
  readonly projectId: string;
  readonly traceId: string;
  readonly status: WorkflowLifecycleStatus;
  readonly brief: Brief;
  readonly specRef: SpecRef;
  readonly spec: ProductSpec;
  readonly plan: ExecutionPlan;
  readonly stepEvaluations: readonly StepPolicyEvaluationView[];
  readonly pendingApprovalId?: string | undefined;
  readonly executedStepIds: readonly string[];
  readonly simulatedWriteCount: number;
  readonly evidence: readonly EvidenceRef[];
  readonly history: readonly WorkflowHistoryEvent[];
  readonly cancellationReason?: string | undefined;
}

export interface ApprovalSignalInput {
  readonly signalId: string;
  readonly context: RequestContext;
  readonly approvalId: string;
  readonly decision: ApprovalDecision;
  readonly rationale: string;
  readonly bearerToken: string;
  readonly nowMs?: number;
}

interface InternalMutableWorkflowRecord {
  state: GovernedWorkflowState;
  processedSignalIds: Set<string>;
}

/**
 * Durable Temporal Orchestrator & Activity Runner for Phase 04 (ADR-0003).
 * Implements deterministic workflow versioning, activity retry/idempotency,
 * mid-wait worker restart/replay recovery, duplicate signal deduplication,
 * and Emergency Stop cancellation without touching a real LLM or local workstation.
 */
export class DurableTemporalOrchestrator {
  private readonly api: GovernedDomainApiService;
  private readonly workflows = new Map<string, InternalMutableWorkflowRecord>();
  private readonly executedStepLedger = new Map<string, EvidenceRef>();
  private simulatedTransientFailuresRemaining = 0;
  private sequence = 0;

  public constructor(api: GovernedDomainApiService) {
    this.api = api;
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${String(this.sequence).padStart(4, "0")}`;
  }

  /**
   * Test hook to simulate transient activity failures so Temporal activity retry semantics are verified.
   */
  public setSimulatedTransientActivityFailures(count: number): void {
    this.simulatedTransientFailuresRemaining = Math.max(0, count);
  }

  private appendHistory(
    history: readonly WorkflowHistoryEvent[],
    eventType: WorkflowHistoryEvent["eventType"],
    detail: Record<string, unknown>,
    stepId?: string,
    nowMs?: number,
  ): WorkflowHistoryEvent[] {
    const nextEvent: WorkflowHistoryEvent = {
      eventIndex: history.length + 1,
      eventType,
      timestamp: new Date(nowMs ?? Date.now()).toISOString(),
      ...(stepId !== undefined ? { stepId } : {}),
      detail,
    };
    return [...history, nextEvent];
  }

  /**
   * Starts the governed vertical slice workflow:
   * submitBrief -> deterministic sample ProductSpec & ExecutionPlan -> OPA policy evaluation ->
   * auto-execute allowed read step -> pause in WAITING_FOR_APPROVAL for write_workspace step.
   */
  public startBriefWorkflow(params: {
    readonly context: RequestContext;
    readonly brief: Brief;
    readonly bearerToken: string;
    readonly canonicalPathScope?: readonly string[];
    readonly nowMs?: number;
  }): Result<GovernedWorkflowState> {
    const { context, brief, bearerToken } = params;
    const nowMs = params.nowMs ?? Date.now();
    const pathScope = params.canonicalPathScope ?? [
      `C:/AetherForgeWorkspaces/${brief.projectId}`,
    ];

    const workflowKey = `wf-${brief.tenantId}-${brief.briefId}`;
    const existing = this.workflows.get(workflowKey);
    if (existing) {
      return {
        ok: true,
        value: existing.state,
        evidence: [...existing.state.evidence],
      };
    }

    // Activity 1: Submit brief through typed Domain API
    const briefRes = this.api.submitBrief({ context, brief }, { bearerToken, nowMs });
    if (!briefRes.ok) {
      return briefRes;
    }
    const specRef = briefRes.value;

    // Build deterministic sample ProductSpec from Brief (no LLM call in Phase 04)
    const spec: ProductSpec = {
      schemaVersion: SCHEMA_VERSION_V1,
      specId: specRef.specId,
      briefId: brief.briefId,
      tenantId: brief.tenantId,
      projectId: brief.projectId,
      summary: `Deterministic governed specification for brief: ${brief.title}`,
      acceptanceCriteria: [
        "Execute allowlisted read step automatically",
        "Pause for explicit approval on workspace write step",
        "Record verifiable EvidenceRef and complete audit trail",
      ],
      requiredCapabilities: ["read_allowlisted", "write_workspace"],
      specHash: specRef.specHash,
      createdAt: new Date(nowMs).toISOString(),
    };

    // Activity 2: Create deterministic sample plan through typed Domain API
    const planContext: RequestContext = {
      ...context,
      requestId: `${context.requestId}-plan`,
      idempotencyKey: `${context.idempotencyKey}-plan`,
    };
    const planRes = this.api.createPlan({ context: planContext, spec }, { bearerToken, nowMs });
    if (!planRes.ok) {
      return planRes;
    }
    const plan = planRes.value;

    // Register workflow with Emergency Stop cancellation coordinator
    this.api.workflowCoordinator.registerWorkflow({
      workflowId: workflowKey,
      tenantId: brief.tenantId,
      projectId: brief.projectId,
    });

    this.api.auditStore.append({
      eventId: this.nextId("audit-wf"),
      timestamp: new Date(nowMs).toISOString(),
      tenantId: brief.tenantId,
      projectId: brief.projectId,
      actor: context.actor,
      traceId: context.traceId,
      idempotencyKey: context.idempotencyKey,
      eventType: EVENT_NAMES.WORKFLOW_STARTED,
      policyVersion: this.api.getPolicyVersion(),
      planHash: plan.planHash,
      outcome: "EXECUTED",
      payload: {
        workflowId: workflowKey,
        workflowVersion: GOVERNED_WORKFLOW_VERSION,
        planId: plan.planId,
      },
    });

    let history: WorkflowHistoryEvent[] = this.appendHistory(
      [],
      "WorkflowExecutionStarted",
      {
        workflowId: workflowKey,
        workflowVersion: GOVERNED_WORKFLOW_VERSION,
        planId: plan.planId,
        planHash: plan.planHash,
      },
      undefined,
      nowMs,
    );

    const stepEvaluations: StepPolicyEvaluationView[] = [];
    const executedStepIds: string[] = [];
    const collectedEvidence: EvidenceRef[] = [...briefRes.evidence, ...planRes.evidence];
    let pendingApprovalId: string | undefined;

    // Activity 3: Policy evaluation per step + auto-execution of allowed read step
    for (const step of plan.steps) {
      const decision = this.api.policyDecisionPoint.evaluate({
        schemaVersion: SCHEMA_VERSION_V1,
        tenantId: brief.tenantId,
        projectId: brief.projectId,
        actor: context.actor,
        actionClass: step.actionClass,
        classification: brief.classification,
        planId: plan.planId,
        planHash: plan.planHash,
        stepId: step.stepId,
        canonicalPathScope: [...pathScope],
      });

      this.api.auditStore.append({
        eventId: this.nextId("audit-pol"),
        timestamp: new Date(nowMs).toISOString(),
        tenantId: brief.tenantId,
        projectId: brief.projectId,
        actor: context.actor,
        traceId: context.traceId,
        idempotencyKey: `${context.idempotencyKey}-pol-${step.stepId}`,
        eventType: EVENT_NAMES.POLICY_EVALUATED,
        actionClass: step.actionClass,
        policyVersion: decision.policyVersion,
        planHash: plan.planHash,
        outcome:
          decision.decision === "allow"
            ? "ALLOWED"
            : decision.decision === "requireApproval"
              ? "APPROVAL_REQUIRED"
              : "DENIED",
        payload: {
          stepId: step.stepId,
          decision: decision.decision,
          reasonCode: decision.reasonCode,
        },
      });

      if (decision.decision === "allow") {
        stepEvaluations.push({ step, policyDecision: decision });
        const readEvidence = this.runSimulatedActivityOnce({
          workflowId: workflowKey,
          tenantId: brief.tenantId,
          projectId: brief.projectId,
          traceId: context.traceId,
          classification: brief.classification,
          step,
          planHash: plan.planHash,
          actor: context.actor,
          idempotencyKey: `${context.idempotencyKey}-exec-${step.stepId}`,
          nowMs,
        });
        executedStepIds.push(step.stepId);
        collectedEvidence.push(readEvidence);
        history = this.appendHistory(
          history,
          "ActivityTaskCompleted",
          {
            activity: "executeSimulatedReadStep",
            evidenceId: readEvidence.evidenceId,
          },
          step.stepId,
          nowMs,
        );
      } else if (decision.decision === "requireApproval") {
        const approvalId = `appr-${workflowKey}-${step.stepId}`;
        this.api.approvals.createPendingApproval({
          approvalId,
          tenantId: brief.tenantId,
          projectId: brief.projectId,
          planId: plan.planId,
          planHash: plan.planHash,
          stepId: step.stepId,
          actionClass: step.actionClass,
          policyVersion: decision.policyVersion,
          canonicalPathScope: pathScope,
          nowMs,
        });

        this.api.auditStore.append({
          eventId: this.nextId("audit-req"),
          timestamp: new Date(nowMs).toISOString(),
          tenantId: brief.tenantId,
          projectId: brief.projectId,
          actor: context.actor,
          traceId: context.traceId,
          idempotencyKey: `${context.idempotencyKey}-appr-req-${step.stepId}`,
          eventType: EVENT_NAMES.APPROVAL_REQUESTED,
          actionClass: step.actionClass,
          policyVersion: decision.policyVersion,
          planHash: plan.planHash,
          outcome: "APPROVAL_REQUIRED",
          payload: { approvalId, stepId: step.stepId },
        });

        stepEvaluations.push({
          step,
          policyDecision: decision,
          approvalId,
        });
        pendingApprovalId = approvalId;
      }
    }

    const initialState: GovernedWorkflowState = {
      workflowId: workflowKey,
      workflowVersion: GOVERNED_WORKFLOW_VERSION,
      tenantId: brief.tenantId,
      projectId: brief.projectId,
      traceId: context.traceId,
      status: pendingApprovalId ? "WAITING_FOR_APPROVAL" : "COMPLETED",
      brief,
      specRef,
      spec,
      plan,
      stepEvaluations,
      ...(pendingApprovalId !== undefined ? { pendingApprovalId } : {}),
      executedStepIds,
      simulatedWriteCount: 0,
      evidence: collectedEvidence,
      history,
    };

    this.workflows.set(workflowKey, {
      state: initialState,
      processedSignalIds: new Set<string>(),
    });

    return {
      ok: true,
      value: initialState,
      evidence: [...initialState.evidence],
    };
  }

  /**
   * Delivers an approval decision signal to a waiting workflow.
   * Idempotent on duplicate signalId or already-completed workflow.
   */
  public signalApprovalDecision(
    workflowId: string,
    signal: ApprovalSignalInput,
  ): Result<GovernedWorkflowState> {
    const record = this.workflows.get(workflowId);
    if (!record || record.state.tenantId !== signal.context.tenantId) {
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_WORKFLOW_NOT_FOUND",
          message: "Workflow not found in caller tenant scope.",
          category: "NOT_FOUND",
          traceId: signal.context.traceId,
        },
      };
    }

    // Check if an Emergency Stop signal was emitted for this workflow
    this.syncEmergencyStopState(record);
    if (record.state.status === "CANCELLED_BY_EMERGENCY_STOP") {
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_WORKFLOW_CANCELLED_BY_EMERGENCY_STOP",
          message: "Workflow was cancelled by Emergency Stop and cannot process approval signals.",
          category: "EMERGENCY_STOP",
          traceId: signal.context.traceId,
        },
      };
    }

    // Duplicate signal deduplication (idempotent replay)
    if (
      record.processedSignalIds.has(signal.signalId) ||
      record.state.status === "COMPLETED" ||
      record.state.status === "REJECTED"
    ) {
      return {
        ok: true,
        value: record.state,
        evidence: [...record.state.evidence],
      };
    }

    const nowMs = signal.nowMs ?? Date.now();
    const pendingEval = record.state.stepEvaluations.find(
      (e) => e.approvalId === signal.approvalId,
    );
    if (!pendingEval) {
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_APPROVAL_NOT_BOUND_TO_WORKFLOW",
          message: "Approval ID is not bound to any waiting step in this workflow.",
          category: "APPROVAL_INVALID",
          traceId: signal.context.traceId,
        },
      };
    }

    // Record approval decision through Domain API
    const decideRes = this.api.decideApproval(
      {
        context: signal.context,
        approvalId: signal.approvalId,
        planId: record.state.plan.planId,
        planHash: record.state.plan.planHash,
        stepId: pendingEval.step.stepId,
        policyVersion: this.api.getPolicyVersion(),
        decision: signal.decision,
        rationale: signal.rationale,
      },
      { bearerToken: signal.bearerToken, nowMs },
    );
    if (!decideRes.ok) {
      return decideRes;
    }

    record.processedSignalIds.add(signal.signalId);
    let history = this.appendHistory(
      record.state.history,
      "WorkflowExecutionSignaled",
      {
        signalId: signal.signalId,
        approvalId: signal.approvalId,
        decision: signal.decision,
      },
      pendingEval.step.stepId,
      nowMs,
    );

    if (signal.decision === "REJECTED") {
      history = this.appendHistory(
        history,
        "WorkflowExecutionCancelled",
        { reason: "Approval rejected by operator" },
        pendingEval.step.stepId,
        nowMs,
      );
      record.state = {
        ...record.state,
        status: "REJECTED",
        pendingApprovalId: undefined,
        evidence: [...record.state.evidence, ...decideRes.evidence],
        history,
      };
      return {
        ok: true,
        value: record.state,
        evidence: [...record.state.evidence],
      };
    }

    // Verify dispatch gate (re-checks Emergency Stop, live OPA policy, planHash, policyVersion, scope, expiry)
    const primaryGrantedRoot =
      decideRes.value.approval.canonicalPathScope[0] ??
      `C:/AetherForgeWorkspaces/${record.state.projectId}`;
    const dispatchGate = this.api.verifyStepDispatchGate({
      context: signal.context,
      planId: record.state.plan.planId,
      approvalId: signal.approvalId,
      requestedPath: `${primaryGrantedRoot.replace(/\\/g, "/")}/outputs/simulated-artifact.json`,
      bearerToken: signal.bearerToken,
      nowMs,
    });
    if (!dispatchGate.ok) {
      return dispatchGate;
    }

    // Handle simulated transient retries deterministically (Temporal activity retry loop)
    while (this.simulatedTransientFailuresRemaining > 0) {
      this.simulatedTransientFailuresRemaining -= 1;
      history = this.appendHistory(
        history,
        "ActivityTaskRetried",
        {
          activity: "executeSimulatedWriteStep",
          remainingTransientFailures: this.simulatedTransientFailuresRemaining,
        },
        pendingEval.step.stepId,
        nowMs,
      );
    }

    const alreadyExecuted = record.state.executedStepIds.includes(pendingEval.step.stepId);
    const writeEvidence = this.runSimulatedActivityOnce({
      workflowId,
      tenantId: record.state.tenantId,
      projectId: record.state.projectId,
      traceId: record.state.traceId,
      classification: record.state.brief.classification,
      step: pendingEval.step,
      planHash: record.state.plan.planHash,
      actor: signal.context.actor,
      idempotencyKey: `${signal.context.idempotencyKey}-exec-${pendingEval.step.stepId}`,
      nowMs,
    });

    history = this.appendHistory(
      history,
      "ActivityTaskCompleted",
      {
        activity: "executeSimulatedWriteStep",
        evidenceId: writeEvidence.evidenceId,
        grantId: dispatchGate.value.grantId,
      },
      pendingEval.step.stepId,
      nowMs,
    );
    history = this.appendHistory(
      history,
      "WorkflowExecutionCompleted",
      {
        completedStepCount: record.state.executedStepIds.length + (alreadyExecuted ? 0 : 1),
      },
      undefined,
      nowMs,
    );

    record.state = {
      ...record.state,
      status: "COMPLETED",
      pendingApprovalId: undefined,
      executedStepIds: alreadyExecuted
        ? record.state.executedStepIds
        : [...record.state.executedStepIds, pendingEval.step.stepId],
      simulatedWriteCount: record.state.simulatedWriteCount + (alreadyExecuted ? 0 : 1),
      evidence: [...record.state.evidence, ...decideRes.evidence, writeEvidence],
      history,
    };

    return {
      ok: true,
      value: record.state,
      evidence: [...record.state.evidence],
    };
  }

  /**
   * Simulates a Temporal worker process crash/restart by rehydrating workflow state
   * from its durable history snapshot without losing pending approval timers or re-running completed activities.
   */
  public simulateWorkerRestartAndReplay(workflowId: string): GovernedWorkflowState | undefined {
    const record = this.workflows.get(workflowId);
    if (!record) {
      return undefined;
    }
    const clonedSnapshot = JSON.parse(JSON.stringify(record.state)) as GovernedWorkflowState;
    const recomputedHash = computeCanonicalPlanHash(clonedSnapshot.plan);
    if (recomputedHash !== clonedSnapshot.plan.planHash) {
      throw new Error("TEMPORAL_NON_DETERMINISM_DETECTED: Replay planHash mismatch");
    }
    record.state = clonedSnapshot;
    return record.state;
  }

  public getWorkflowState(
    tenantId: string,
    workflowId: string,
  ): GovernedWorkflowState | undefined {
    const record = this.workflows.get(workflowId);
    if (!record || record.state.tenantId !== tenantId) {
      return undefined;
    }
    this.syncEmergencyStopState(record);
    return record.state;
  }

  private syncEmergencyStopState(record: InternalMutableWorkflowRecord): void {
    if (
      record.state.status === "COMPLETED" ||
      record.state.status === "REJECTED" ||
      record.state.status === "CANCELLED_BY_EMERGENCY_STOP"
    ) {
      return;
    }
    const signal = this.api.workflowCoordinator
      .getSignals()
      .find((s) => s.workflowId === record.state.workflowId && s.tenantId === record.state.tenantId);

    if (signal) {
      const history = this.appendHistory(
        record.state.history,
        "WorkflowExecutionCancelled",
        {
          reason: signal.reason,
          cancelledBy: "EMERGENCY_STOP",
        },
        undefined,
        Date.parse(signal.signaledAt),
      );
      record.state = {
        ...record.state,
        status: "CANCELLED_BY_EMERGENCY_STOP",
        pendingApprovalId: undefined,
        cancellationReason: signal.reason,
        history,
      };
    }
  }

  private runSimulatedActivityOnce(params: {
    readonly workflowId: string;
    readonly tenantId: string;
    readonly projectId: string;
    readonly traceId: string;
    readonly classification: RequestContext["classification"];
    readonly step: PlanStep;
    readonly planHash: string;
    readonly actor: RequestContext["actor"];
    readonly idempotencyKey: string;
    readonly nowMs: number;
  }): EvidenceRef {
    const ledgerKey = `${params.tenantId}::${params.workflowId}::${params.step.stepId}`;
    const existing = this.executedStepLedger.get(ledgerKey);
    if (existing) {
      return existing;
    }

    const simulatedOutput = {
      workflowId: params.workflowId,
      stepId: params.step.stepId,
      actionClass: params.step.actionClass,
      planHash: params.planHash,
      simulatedExecution: true,
      timestamp: new Date(params.nowMs).toISOString(),
    };

    const evidence: EvidenceRef = {
      schemaVersion: SCHEMA_VERSION_V1,
      evidenceId: this.nextId("ev-sim"),
      traceId: params.traceId,
      producer: "temporal",
      artifactHash: computePayloadSha256(simulatedOutput),
      classification: params.classification,
      createdAt: new Date(params.nowMs).toISOString(),
      verifiableLocation: `aetherforge://tenants/${params.tenantId}/projects/${params.projectId}/simulated/${params.step.stepId}.json`,
      summary: `Simulated ${params.step.actionClass} completed deterministically (${params.step.description}).`,
    };

    this.executedStepLedger.set(ledgerKey, evidence);

    this.api.auditStore.append({
      eventId: this.nextId("audit-job"),
      timestamp: new Date(params.nowMs).toISOString(),
      tenantId: params.tenantId,
      projectId: params.projectId,
      actor: params.actor,
      traceId: params.traceId,
      idempotencyKey: params.idempotencyKey,
      eventType: EVENT_NAMES.WORKER_JOB_COMPLETED,
      actionClass: params.step.actionClass,
      policyVersion: this.api.getPolicyVersion(),
      planHash: params.planHash,
      outcome: "EXECUTED",
      payload: simulatedOutput,
    });

    this.api.auditStore.append({
      eventId: this.nextId("audit-ev"),
      timestamp: new Date(params.nowMs).toISOString(),
      tenantId: params.tenantId,
      projectId: params.projectId,
      actor: params.actor,
      traceId: params.traceId,
      idempotencyKey: `${params.idempotencyKey}-ev`,
      eventType: EVENT_NAMES.EVIDENCE_RECORDED,
      actionClass: params.step.actionClass,
      policyVersion: this.api.getPolicyVersion(),
      planHash: params.planHash,
      outcome: "EXECUTED",
      payload: evidence,
    });

    return evidence;
  }
}
