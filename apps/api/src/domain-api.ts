import {
  type Brief,
  type CapabilityGrant,
  computeCanonicalPlanHash,
  type CreatePlanRequest,
  CreatePlanRequestSchema,
  type CreatePlanResponse,
  type DecideApprovalRequest,
  DecideApprovalRequestSchema,
  type DecideApprovalResponse,
  EVENT_NAMES,
  type EvidenceRef,
  type ExecutionPlan,
  type HumanRole,
  type ProductSpec,
  type RequestContext,
  type Result,
  SCHEMA_VERSION_V1,
  type SpecRef,
  type SubmitBriefRequest,
  SubmitBriefRequestSchema,
  type SubmitBriefResponse,
  type TriggerEmergencyStopRequest,
  TriggerEmergencyStopRequestSchema,
  type TriggerEmergencyStopResponse,
} from "@aether-forge/contracts";
import { AppendOnlyAuditStore, computePayloadSha256 } from "@aether-forge/audit";
import {
  loadDefaultV1OpaPolicyBundle,
  OpaPolicyDecisionPoint,
} from "@aether-forge/policy";
import { ApprovalStateMachine } from "./approvals.ts";
import {
  EmergencyStopController,
  WorkflowCancellationCoordinator,
} from "./emergency-stop.ts";
import {
  authorizeTenantAndRole,
  type OidcVerifierSeam,
  type TenantMembershipRegistry,
} from "./identity.ts";
import { CorrelationAndIdempotencyMiddleware } from "./middleware.ts";

export interface AuthenticatedCommandOptions {
  readonly bearerToken: string;
  readonly nowMs?: number;
}

/**
 * Governed Domain API implementation for Phase 02.
 * Enforces OIDC verification, tenant isolation BEFORE data access, role checks,
 * idempotency deduplication, emergency stop freeze, approval binding, and immutable audit events.
 */
export class GovernedDomainApiService {
  private readonly briefsById = new Map<string, Brief>();
  private readonly specsById = new Map<string, ProductSpec>();
  private readonly plansById = new Map<string, ExecutionPlan>();
  private sequenceCounter = 0;

  public readonly oidcVerifier: OidcVerifierSeam;
  public readonly membershipRegistry: TenantMembershipRegistry;
  public readonly auditStore: AppendOnlyAuditStore;
  public readonly idempotency: CorrelationAndIdempotencyMiddleware;
  public readonly approvals: ApprovalStateMachine;
  public readonly emergencyStop: EmergencyStopController;
  public readonly workflowCoordinator: WorkflowCancellationCoordinator;
  public readonly policyDecisionPoint: OpaPolicyDecisionPoint;

  public constructor(deps: {
    readonly oidcVerifier: OidcVerifierSeam;
    readonly membershipRegistry: TenantMembershipRegistry;
    readonly auditStore?: AppendOnlyAuditStore;
    readonly idempotency?: CorrelationAndIdempotencyMiddleware;
    readonly approvals?: ApprovalStateMachine;
    readonly emergencyStop?: EmergencyStopController;
    readonly workflowCoordinator?: WorkflowCancellationCoordinator;
    readonly policyDecisionPoint?: OpaPolicyDecisionPoint;
  }) {
    this.oidcVerifier = deps.oidcVerifier;
    this.membershipRegistry = deps.membershipRegistry;
    this.auditStore = deps.auditStore ?? new AppendOnlyAuditStore();
    this.idempotency = deps.idempotency ?? new CorrelationAndIdempotencyMiddleware();
    this.approvals = deps.approvals ?? new ApprovalStateMachine();
    this.emergencyStop = deps.emergencyStop ?? new EmergencyStopController();
    this.workflowCoordinator = deps.workflowCoordinator ?? new WorkflowCancellationCoordinator();
    this.policyDecisionPoint = deps.policyDecisionPoint ?? new OpaPolicyDecisionPoint();
  }

  private nextId(prefix: string): string {
    this.sequenceCounter += 1;
    return `${prefix}-${String(this.sequenceCounter).padStart(4, "0")}`;
  }

  public getPolicyVersion(): string {
    return this.policyDecisionPoint.getPolicyVersion();
  }

  public setPolicyVersion(nextPolicyVersion: string): void {
    this.policyDecisionPoint.rotateBundle(loadDefaultV1OpaPolicyBundle(nextPolicyVersion));
  }

  private createEvidence(
    traceId: string,
    classification: RequestContext["classification"],
    payload: unknown,
    location: string,
  ): EvidenceRef {
    return {
      schemaVersion: SCHEMA_VERSION_V1,
      evidenceId: this.nextId("ev"),
      traceId,
      producer: "api",
      artifactHash: computePayloadSha256(payload),
      classification,
      createdAt: new Date().toISOString(),
      verifiableLocation: location,
    };
  }

  public submitBrief(
    rawRequest: SubmitBriefRequest,
    options: AuthenticatedCommandOptions,
  ): SubmitBriefResponse {
    const parsed = SubmitBriefRequestSchema.safeParse(rawRequest);
    if (!parsed.success) {
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_BRIEF_SCHEMA_INVALID",
          message: parsed.error.issues.map((i) => i.message).join("; "),
          category: "VALIDATION",
          traceId: rawRequest?.context?.traceId ?? "invalid-trace",
        },
      };
    }

    const { context, brief } = parsed.data;
    const nowUnix = options.nowMs ? Math.floor(options.nowMs / 1000) : undefined;
    const claims = this.oidcVerifier.verifyBearerToken(options.bearerToken, nowUnix);

    const auth = authorizeTenantAndRole({
      context,
      claims,
      membershipRegistry: this.membershipRegistry,
      resourceTenantId: brief.tenantId,
      resourceProjectId: brief.projectId,
      requiredRoles: ["Owner", "Builder"],
    });

    if (!auth.authorized) {
      this.auditStore.append({
        eventId: this.nextId("audit"),
        tenantId: context.tenantId,
        projectId: brief.projectId,
        actor: context.actor,
        traceId: context.traceId,
        idempotencyKey: context.idempotencyKey,
        eventType: EVENT_NAMES.BRIEF_SUBMITTED,
        policyVersion: this.getPolicyVersion(),
        outcome: "DENIED",
        payload: { briefId: brief.briefId, reason: auth.error.code },
      });
      return { ok: false, retryable: false, error: auth.error };
    }

    const stopCheck = this.emergencyStop.checkDispatchAllowed({
      tenantId: context.tenantId,
      projectId: brief.projectId,
      traceId: context.traceId,
    });
    if (!stopCheck.allowed) {
      this.auditStore.append({
        eventId: this.nextId("audit"),
        tenantId: context.tenantId,
        projectId: brief.projectId,
        actor: context.actor,
        traceId: context.traceId,
        idempotencyKey: context.idempotencyKey,
        eventType: EVENT_NAMES.BRIEF_SUBMITTED,
        policyVersion: this.getPolicyVersion(),
        outcome: "HALTED",
        payload: { briefId: brief.briefId },
      });
      return { ok: false, retryable: false, error: stopCheck.error };
    }

    return this.idempotency.executeIdempotent<SpecRef>({
      context,
      operation: "submitBrief",
      payload: brief,
      handler: () => {
        this.briefsById.set(brief.briefId, brief);
        const specRef: SpecRef = {
          schemaVersion: SCHEMA_VERSION_V1,
          specId: `spec-${brief.briefId}`,
          briefId: brief.briefId,
          specHash: computePayloadSha256(brief),
        };
        this.auditStore.append({
          eventId: this.nextId("audit"),
          tenantId: context.tenantId,
          projectId: brief.projectId,
          actor: context.actor,
          traceId: context.traceId,
          idempotencyKey: context.idempotencyKey,
          eventType: EVENT_NAMES.BRIEF_SUBMITTED,
          policyVersion: this.getPolicyVersion(),
          outcome: "EXECUTED",
          payload: specRef,
        });
        return {
          ok: true,
          value: specRef,
          evidence: [
            this.createEvidence(
              context.traceId,
              context.classification,
              specRef,
              `aetherforge://tenants/${context.tenantId}/specs/${specRef.specId}`,
            ),
          ],
        };
      },
    });
  }

  /**
   * Enforces tenant isolation BEFORE reading brief metadata.
   * Cross-tenant IDs return NOT_FOUND (404) without leaking existence.
   */
  public getBrief(
    context: RequestContext,
    briefId: string,
    options: AuthenticatedCommandOptions,
  ): Result<Brief> {
    const nowUnix = options.nowMs ? Math.floor(options.nowMs / 1000) : undefined;
    const claims = this.oidcVerifier.verifyBearerToken(options.bearerToken, nowUnix);

    const auth = authorizeTenantAndRole({
      context,
      claims,
      membershipRegistry: this.membershipRegistry,
      resourceTenantId: context.tenantId,
      resourceProjectId: context.projectId,
      requiredRoles: ["Owner", "Builder", "Reviewer", "ReleaseManager"],
    });
    if (!auth.authorized) {
      this.auditStore.append({
        eventId: this.nextId("audit"),
        tenantId: context.tenantId,
        projectId: context.projectId,
        actor: context.actor,
        traceId: context.traceId,
        idempotencyKey: context.idempotencyKey,
        eventType: "aetherforge.brief.read.v1",
        actionClass: "read_allowlisted",
        policyVersion: this.getPolicyVersion(),
        outcome: "DENIED",
        payload: { briefId, reason: auth.error.code },
      });
      return { ok: false, retryable: false, error: auth.error };
    }

    const stored = this.briefsById.get(briefId);
    if (!stored || stored.tenantId !== context.tenantId) {
      this.auditStore.append({
        eventId: this.nextId("audit"),
        tenantId: context.tenantId,
        projectId: context.projectId,
        actor: context.actor,
        traceId: context.traceId,
        idempotencyKey: context.idempotencyKey,
        eventType: "aetherforge.brief.read.v1",
        actionClass: "read_allowlisted",
        policyVersion: this.getPolicyVersion(),
        outcome: "DENIED",
        payload: { briefId, reason: "DOMAIN_RESOURCE_NOT_FOUND" },
      });
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_RESOURCE_NOT_FOUND",
          message: "Brief not found in caller tenant scope.",
          category: "NOT_FOUND",
          traceId: context.traceId,
        },
      };
    }

    return { ok: true, value: stored, evidence: [] };
  }

  public createPlan(
    rawRequest: CreatePlanRequest,
    options: AuthenticatedCommandOptions,
  ): CreatePlanResponse {
    const parsed = CreatePlanRequestSchema.safeParse(rawRequest);
    if (!parsed.success) {
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_PLAN_REQUEST_INVALID",
          message: parsed.error.issues.map((i) => i.message).join("; "),
          category: "VALIDATION",
          traceId: rawRequest?.context?.traceId ?? "invalid-trace",
        },
      };
    }

    const { context, spec } = parsed.data;
    const nowUnix = options.nowMs ? Math.floor(options.nowMs / 1000) : undefined;
    const claims = this.oidcVerifier.verifyBearerToken(options.bearerToken, nowUnix);

    const auth = authorizeTenantAndRole({
      context,
      claims,
      membershipRegistry: this.membershipRegistry,
      resourceTenantId: spec.tenantId,
      resourceProjectId: spec.projectId,
      requiredRoles: ["Owner", "Builder"],
    });
    if (!auth.authorized) {
      this.auditStore.append({
        eventId: this.nextId("audit"),
        tenantId: context.tenantId,
        projectId: spec.projectId,
        actor: context.actor,
        traceId: context.traceId,
        idempotencyKey: context.idempotencyKey,
        eventType: EVENT_NAMES.PLAN_PROPOSED,
        policyVersion: this.getPolicyVersion(),
        outcome: "DENIED",
        payload: { specId: spec.specId, reason: auth.error.code },
      });
      return { ok: false, retryable: false, error: auth.error };
    }

    const stopCheck = this.emergencyStop.checkDispatchAllowed({
      tenantId: context.tenantId,
      projectId: spec.projectId,
      traceId: context.traceId,
    });
    if (!stopCheck.allowed) {
      return { ok: false, retryable: false, error: stopCheck.error };
    }

    const stepDecisions = new Map<string, ReturnType<OpaPolicyDecisionPoint["evaluate"]>>();
    for (const cap of spec.requiredCapabilities) {
      const decision = this.policyDecisionPoint.evaluate({
        schemaVersion: SCHEMA_VERSION_V1,
        tenantId: context.tenantId,
        projectId: spec.projectId,
        actor: context.actor,
        actionClass: cap,
        classification: context.classification,
      });
      stepDecisions.set(cap, decision);

      if (decision.decision === "deny") {
        this.auditStore.append({
          eventId: this.nextId("audit"),
          tenantId: context.tenantId,
          projectId: spec.projectId,
          actor: context.actor,
          traceId: context.traceId,
          idempotencyKey: context.idempotencyKey,
          eventType: EVENT_NAMES.POLICY_EVALUATED,
          actionClass: cap,
          policyVersion: decision.policyVersion,
          outcome: "DENIED",
          payload: {
            specId: spec.specId,
            capability: cap,
            reasonCode: decision.reasonCode,
            bundleDigest: decision.bundleDigest,
          },
        });
        return {
          ok: false,
          retryable: false,
          error: {
            schemaVersion: SCHEMA_VERSION_V1,
            code: "DOMAIN_CAPABILITY_DENIED_OR_UNQUALIFIED",
            message: decision.userExplanation,
            category: "POLICY_DENIED",
            traceId: context.traceId,
          },
        };
      }
    }

    return this.idempotency.executeIdempotent<ExecutionPlan>({
      context,
      operation: "createPlan",
      payload: spec,
      handler: () => {
        this.specsById.set(spec.specId, spec);
        const steps = spec.requiredCapabilities.map((actionClass, idx) => {
          const decision = stepDecisions.get(actionClass)!;
          return {
            schemaVersion: SCHEMA_VERSION_V1,
            stepId: `step-${idx + 1}-${actionClass}`,
            orderIndex: idx,
            toolId: `tool.${actionClass}`,
            actionClass,
            description: `Execute governed ${actionClass} step`,
            input: { projectId: spec.projectId },
            expectedOutputs: [`${actionClass}.evidence`],
            requiresApproval: decision.decision === "requireApproval",
            dependsOnStepIds: idx === 0 ? [] : [`step-${idx}-${spec.requiredCapabilities[idx - 1]!}`],
          };
        });

        const planId = `plan-${spec.specId}`;
        const planHash = computeCanonicalPlanHash({
          planId,
          specId: spec.specId,
          tenantId: spec.tenantId,
          projectId: spec.projectId,
          steps,
        });

        const plan: ExecutionPlan = {
          schemaVersion: SCHEMA_VERSION_V1,
          planId,
          specId: spec.specId,
          tenantId: spec.tenantId,
          projectId: spec.projectId,
          steps,
          planHash,
          policyVersion: this.getPolicyVersion(),
          createdAt: new Date(options.nowMs ?? Date.now()).toISOString(),
        };

        this.plansById.set(plan.planId, plan);
        this.auditStore.append({
          eventId: this.nextId("audit"),
          tenantId: context.tenantId,
          projectId: spec.projectId,
          actor: context.actor,
          traceId: context.traceId,
          idempotencyKey: context.idempotencyKey,
          eventType: EVENT_NAMES.PLAN_PROPOSED,
          policyVersion: this.getPolicyVersion(),
          planHash: plan.planHash,
          outcome: "EXECUTED",
          payload: plan,
        });

        return {
          ok: true,
          value: plan,
          evidence: [
            this.createEvidence(
              context.traceId,
              context.classification,
              plan,
              `aetherforge://tenants/${context.tenantId}/plans/${plan.planId}`,
            ),
          ],
        };
      },
    });
  }

  public updatePlanSteps(planId: string, mutatedPlan: ExecutionPlan): void {
    const recomputedHash = computeCanonicalPlanHash(mutatedPlan);
    this.plansById.set(planId, {
      ...mutatedPlan,
      planHash: recomputedHash,
    });
  }

  public decideApproval(
    rawRequest: DecideApprovalRequest,
    options: AuthenticatedCommandOptions,
  ): DecideApprovalResponse {
    const parsed = DecideApprovalRequestSchema.safeParse(rawRequest);
    if (!parsed.success) {
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_APPROVAL_REQUEST_INVALID",
          message: parsed.error.issues.map((i) => i.message).join("; "),
          category: "VALIDATION",
          traceId: rawRequest?.context?.traceId ?? "invalid-trace",
        },
      };
    }

    const { context, approvalId, planId, planHash, stepId, policyVersion, decision, rationale } =
      parsed.data;
    const nowUnix = options.nowMs ? Math.floor(options.nowMs / 1000) : undefined;
    const claims = this.oidcVerifier.verifyBearerToken(options.bearerToken, nowUnix);

    const pendingRecord = this.approvals.getPendingWithinTenant(context.tenantId, approvalId);
    const targetTenantId = pendingRecord?.tenantId ?? "__non_existent_tenant__";
    const targetProjectId = pendingRecord?.projectId;

    const auth = authorizeTenantAndRole({
      context,
      claims,
      membershipRegistry: this.membershipRegistry,
      resourceTenantId: targetTenantId,
      resourceProjectId: targetProjectId,
      requiredRoles: ["Owner", "Builder", "Reviewer", "ReleaseManager", "WorkerOperator"],
    });

    if (!auth.authorized) {
      this.auditStore.append({
        eventId: this.nextId("audit"),
        tenantId: context.tenantId,
        projectId: context.projectId,
        actor: context.actor,
        traceId: context.traceId,
        idempotencyKey: context.idempotencyKey,
        eventType: EVENT_NAMES.APPROVAL_DECIDED,
        policyVersion: this.getPolicyVersion(),
        outcome: "DENIED",
        payload: { approvalId, reason: auth.error.code },
      });
      return { ok: false, retryable: false, error: auth.error };
    }

    const stopCheck = this.emergencyStop.checkDispatchAllowed({
      tenantId: context.tenantId,
      projectId: targetProjectId,
      traceId: context.traceId,
    });
    if (!stopCheck.allowed) {
      return { ok: false, retryable: false, error: stopCheck.error };
    }

    return this.idempotency.executeIdempotent({
      context,
      operation: `decideApproval:${approvalId}`,
      payload: { approvalId, planId, planHash, stepId, policyVersion, decision, rationale },
      handler: () => {
        const currentPlan = this.plansById.get(planId);
        const authoritativePlanHash = currentPlan ? currentPlan.planHash : planHash;

        const outcome = this.approvals.decide({
          approvalId,
          tenantId: context.tenantId,
          actor: context.actor,
          expectedPlanId: planId,
          expectedPlanHash:
            authoritativePlanHash === planHash ? planHash : authoritativePlanHash,
          expectedStepId: stepId,
          expectedPolicyVersion: this.getPolicyVersion(),
          decision,
          rationale,
          traceId: context.traceId,
          ...(options.nowMs !== undefined ? { nowMs: options.nowMs } : {}),
        });

        if (!outcome.ok) {
          this.auditStore.append({
            eventId: this.nextId("audit"),
            tenantId: context.tenantId,
            projectId: targetProjectId,
            actor: context.actor,
            traceId: context.traceId,
            idempotencyKey: context.idempotencyKey,
            eventType: EVENT_NAMES.APPROVAL_DECIDED,
            policyVersion: this.getPolicyVersion(),
            planHash,
            outcome: "DENIED",
            payload: { approvalId, error: outcome.error.code },
          });
          return { ok: false, retryable: false, error: outcome.error };
        }

        this.auditStore.append({
          eventId: this.nextId("audit"),
          tenantId: context.tenantId,
          projectId: targetProjectId,
          actor: context.actor,
          traceId: context.traceId,
          idempotencyKey: context.idempotencyKey,
          eventType: EVENT_NAMES.APPROVAL_DECIDED,
          actionClass: outcome.approval.actionClass,
          policyVersion: this.getPolicyVersion(),
          planHash: outcome.approval.planHash,
          outcome: outcome.approval.decision === "APPROVED" ? "ALLOWED" : "DENIED",
          payload: outcome,
        });

        return {
          ok: true,
          value: {
            approval: outcome.approval,
            ...(outcome.grant !== undefined ? { grant: outcome.grant } : {}),
          },
          evidence: [
            this.createEvidence(
              context.traceId,
              context.classification,
              outcome.approval,
              `aetherforge://tenants/${context.tenantId}/approvals/${approvalId}`,
            ),
          ],
        };
      },
    });
  }

  /**
   * Verifies whether a plan step is permitted to dispatch right now.
   * Re-checks Emergency Stop, OPA policy evaluation, current planHash, current policyVersion,
   * canonicalPathScope, and grant expiry (INV-01..INV-03). No dispatch path can bypass policy, audit, or approval.
   */
  public verifyStepDispatchGate(params: {
    readonly context: RequestContext;
    readonly planId: string;
    readonly approvalId: string;
    readonly requestedPath?: string | undefined;
    readonly bearerToken: string;
    readonly nowMs?: number;
  }): Result<CapabilityGrant> {
    const nowUnix = params.nowMs ? Math.floor(params.nowMs / 1000) : undefined;
    const claims = this.oidcVerifier.verifyBearerToken(params.bearerToken, nowUnix);
    const plan = this.plansById.get(params.planId);

    const auth = authorizeTenantAndRole({
      context: params.context,
      claims,
      membershipRegistry: this.membershipRegistry,
      resourceTenantId: plan?.tenantId ?? "__missing__",
      resourceProjectId: plan?.projectId,
      requiredRoles: ["Owner", "Builder"],
    });
    if (!auth.authorized || !plan) {
      return {
        ok: false,
        retryable: false,
        error: auth.authorized
          ? {
              schemaVersion: SCHEMA_VERSION_V1,
              code: "DOMAIN_PLAN_NOT_FOUND",
              message: "Plan not found in caller tenant scope.",
              category: "NOT_FOUND",
              traceId: params.context.traceId,
            }
          : auth.error,
      };
    }

    const stopCheck = this.emergencyStop.checkDispatchAllowed({
      tenantId: params.context.tenantId,
      projectId: plan.projectId,
      traceId: params.context.traceId,
    });
    if (!stopCheck.allowed) {
      this.auditStore.append({
        eventId: this.nextId("audit"),
        tenantId: params.context.tenantId,
        projectId: plan.projectId,
        actor: params.context.actor,
        traceId: params.context.traceId,
        idempotencyKey: params.context.idempotencyKey,
        eventType: EVENT_NAMES.WORKER_JOB_DISPATCHED,
        policyVersion: this.getPolicyVersion(),
        planHash: plan.planHash,
        outcome: "HALTED",
        payload: { planId: plan.planId, approvalId: params.approvalId },
      });
      return { ok: false, retryable: false, error: stopCheck.error };
    }

    const approvalRecord = this.approvals.getDecidedWithinTenant(
      params.context.tenantId,
      params.approvalId,
    );
    const stepActionClass = approvalRecord?.actionClass ?? "unknown";

    const livePolicyDecision = this.policyDecisionPoint.evaluate({
      schemaVersion: SCHEMA_VERSION_V1,
      tenantId: params.context.tenantId,
      projectId: plan.projectId,
      actor: params.context.actor,
      actionClass: stepActionClass,
      classification: params.context.classification,
      planId: plan.planId,
      planHash: plan.planHash,
    });

    if (livePolicyDecision.decision === "deny") {
      this.auditStore.append({
        eventId: this.nextId("audit"),
        tenantId: params.context.tenantId,
        projectId: plan.projectId,
        actor: params.context.actor,
        traceId: params.context.traceId,
        idempotencyKey: params.context.idempotencyKey,
        eventType: EVENT_NAMES.POLICY_EVALUATED,
        policyVersion: livePolicyDecision.policyVersion,
        planHash: plan.planHash,
        outcome: "DENIED",
        payload: {
          planId: plan.planId,
          approvalId: params.approvalId,
          reasonCode: livePolicyDecision.reasonCode,
        },
      });
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: livePolicyDecision.reasonCode,
          message: livePolicyDecision.userExplanation,
          category: "POLICY_DENIED",
          traceId: params.context.traceId,
        },
      };
    }

    const grantCheck = this.approvals.verifyApprovalForDispatch({
      approvalId: params.approvalId,
      tenantId: params.context.tenantId,
      currentPlanHash: plan.planHash,
      currentPolicyVersion: this.getPolicyVersion(),
      ...(params.requestedPath !== undefined ? { requestedPath: params.requestedPath } : {}),
      traceId: params.context.traceId,
      ...(params.nowMs !== undefined ? { nowMs: params.nowMs } : {}),
    });

    this.auditStore.append({
      eventId: this.nextId("audit"),
      tenantId: params.context.tenantId,
      projectId: plan.projectId,
      actor: params.context.actor,
      traceId: params.context.traceId,
      idempotencyKey: params.context.idempotencyKey,
      eventType: EVENT_NAMES.WORKER_JOB_DISPATCHED,
      policyVersion: this.getPolicyVersion(),
      planHash: plan.planHash,
      outcome: grantCheck.ok ? "ALLOWED" : "DENIED",
      payload: grantCheck.ok
        ? { grantId: grantCheck.value.grantId }
        : { errorCode: grantCheck.error.code },
    });

    return grantCheck;
  }

  public triggerEmergencyStop(
    rawRequest: TriggerEmergencyStopRequest,
    options: AuthenticatedCommandOptions,
  ): TriggerEmergencyStopResponse {
    const parsed = TriggerEmergencyStopRequestSchema.safeParse(rawRequest);
    if (!parsed.success) {
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_EMERGENCY_STOP_REQUEST_INVALID",
          message: parsed.error.issues.map((i) => i.message).join("; "),
          category: "VALIDATION",
          traceId: rawRequest?.context?.traceId ?? "invalid-trace",
        },
      };
    }

    const { context, scope, targetId, reason } = parsed.data;
    const nowUnix = options.nowMs ? Math.floor(options.nowMs / 1000) : undefined;
    const claims = this.oidcVerifier.verifyBearerToken(options.bearerToken, nowUnix);

    const allowedRoles: HumanRole[] =
      scope === "WORKER" ? ["Owner", "WorkerOperator"] : ["Owner"];

    const auth = authorizeTenantAndRole({
      context,
      claims,
      membershipRegistry: this.membershipRegistry,
      resourceTenantId: context.tenantId,
      resourceProjectId: scope === "PROJECT" ? targetId : context.projectId,
      requiredRoles: allowedRoles,
    });
    if (!auth.authorized) {
      this.auditStore.append({
        eventId: this.nextId("audit"),
        tenantId: context.tenantId,
        projectId: context.projectId,
        actor: context.actor,
        traceId: context.traceId,
        idempotencyKey: context.idempotencyKey,
        eventType: EVENT_NAMES.EMERGENCY_STOP_TRIGGERED,
        policyVersion: this.getPolicyVersion(),
        outcome: "DENIED",
        payload: { scope, targetId, reason: auth.error.code },
      });
      return { ok: false, retryable: false, error: auth.error };
    }

    const haltedAtIso = new Date(options.nowMs ?? Date.now()).toISOString();
    const revokedGrantCount = this.approvals.revokeGrantsForScope({
      tenantId: context.tenantId,
      ...(scope === "PROJECT" ? { projectId: targetId } : {}),
      ...(scope === "WORKER" ? { workerId: targetId } : {}),
    });
    const signaledWorkflowCount = this.workflowCoordinator.signalEmergencyStop({
      tenantId: context.tenantId,
      scope,
      targetId,
      reason,
      haltedAtIso,
    });

    const receipt = this.emergencyStop.triggerStop({
      stopId: this.nextId("stop"),
      tenantId: context.tenantId,
      scope,
      targetId,
      revokedGrantCount,
      signaledWorkflowCount,
      haltedAtIso,
    });

    this.auditStore.append({
      eventId: this.nextId("audit"),
      tenantId: context.tenantId,
      projectId: context.projectId,
      actor: context.actor,
      traceId: context.traceId,
      idempotencyKey: context.idempotencyKey,
      eventType: EVENT_NAMES.EMERGENCY_STOP_TRIGGERED,
      policyVersion: this.getPolicyVersion(),
      outcome: "HALTED",
      payload: receipt,
    });

    return {
      ok: true,
      value: receipt,
      evidence: [
        this.createEvidence(
          context.traceId,
          context.classification,
          receipt,
          `aetherforge://tenants/${context.tenantId}/emergency-stops/${receipt.stopId}`,
        ),
      ],
    };
  }
}
