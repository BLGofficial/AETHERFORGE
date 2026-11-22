import {
  type DomainError,
  type EmergencyStopReceipt,
  type EmergencyStopScope,
  SCHEMA_VERSION_V1,
} from "@aether-forge/contracts";

export interface RunningWorkflowRegistration {
  readonly workflowId: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly workerId?: string | undefined;
}

export interface WorkflowCancellationSignal {
  readonly workflowId: string;
  readonly tenantId: string;
  readonly reason: string;
  readonly signaledAt: string;
}

/**
 * Seam for signaling Temporal workflows to cancel/halt when Emergency Stop is triggered.
 */
export class WorkflowCancellationCoordinator {
  private readonly activeWorkflows = new Map<string, RunningWorkflowRegistration>();
  private readonly sentSignals: WorkflowCancellationSignal[] = [];

  public registerWorkflow(workflow: RunningWorkflowRegistration): void {
    this.activeWorkflows.set(workflow.workflowId, workflow);
  }

  public getSignals(): readonly WorkflowCancellationSignal[] {
    return this.sentSignals;
  }

  public signalEmergencyStop(params: {
    readonly tenantId: string;
    readonly scope: EmergencyStopScope;
    readonly targetId: string;
    readonly reason: string;
    readonly haltedAtIso: string;
  }): number {
    let signaled = 0;
    for (const [workflowId, wf] of this.activeWorkflows.entries()) {
      if (wf.tenantId !== params.tenantId) {
        continue;
      }
      const matches =
        (params.scope === "TENANT" && wf.tenantId === params.targetId) ||
        (params.scope === "PROJECT" && wf.projectId === params.targetId) ||
        (params.scope === "WORKFLOW" && wf.workflowId === params.targetId) ||
        (params.scope === "WORKER" && wf.workerId === params.targetId);

      if (matches) {
        this.sentSignals.push({
          workflowId,
          tenantId: wf.tenantId,
          reason: params.reason,
          signaledAt: params.haltedAtIso,
        });
        this.activeWorkflows.delete(workflowId);
        signaled += 1;
      }
    }
    return signaled;
  }
}

/**
 * Emergency Stop Controller (GOVERNANCE.md §4).
 * Blocks new dispatch in halted scopes and coordinates grant revocation + workflow signals.
 */
export class EmergencyStopController {
  private readonly haltedTenants = new Set<string>();
  private readonly haltedProjects = new Set<string>();
  private readonly haltedWorkflows = new Set<string>();
  private readonly haltedWorkers = new Set<string>();

  private static projectKey(tenantId: string, projectId: string): string {
    return `${tenantId}::${projectId}`;
  }

  public triggerStop(params: {
    readonly stopId: string;
    readonly tenantId: string;
    readonly scope: EmergencyStopScope;
    readonly targetId: string;
    readonly revokedGrantCount: number;
    readonly signaledWorkflowCount: number;
    readonly haltedAtIso?: string;
  }): EmergencyStopReceipt {
    const haltedAt = params.haltedAtIso ?? new Date().toISOString();
    switch (params.scope) {
      case "TENANT":
        this.haltedTenants.add(params.tenantId);
        break;
      case "PROJECT":
        this.haltedProjects.add(
          EmergencyStopController.projectKey(params.tenantId, params.targetId),
        );
        break;
      case "WORKFLOW":
        this.haltedWorkflows.add(params.targetId);
        break;
      case "WORKER":
        this.haltedWorkers.add(params.targetId);
        break;
    }

    return {
      schemaVersion: SCHEMA_VERSION_V1,
      stopId: params.stopId,
      scope: params.scope,
      targetId: params.targetId,
      status: "HALTED",
      revokedGrantCount: params.revokedGrantCount,
      signaledWorkflowCount: params.signaledWorkflowCount,
      haltedAt,
    };
  }

  public checkDispatchAllowed(params: {
    readonly tenantId: string;
    readonly projectId?: string | undefined;
    readonly workflowId?: string | undefined;
    readonly workerId?: string | undefined;
    readonly traceId: string;
  }): { readonly allowed: true } | { readonly allowed: false; readonly error: DomainError } {
    if (
      this.haltedTenants.has(params.tenantId) ||
      (params.projectId !== undefined &&
        this.haltedProjects.has(
          EmergencyStopController.projectKey(params.tenantId, params.projectId),
        )) ||
      (params.workflowId !== undefined && this.haltedWorkflows.has(params.workflowId)) ||
      (params.workerId !== undefined && this.haltedWorkers.has(params.workerId))
    ) {
      return {
        allowed: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_EMERGENCY_STOP_ACTIVE",
          message: "Dispatch blocked: Emergency Stop is active for this scope (HTTP 423 Locked).",
          category: "EMERGENCY_STOP",
          traceId: params.traceId,
        },
      };
    }
    return { allowed: true };
  }
}
