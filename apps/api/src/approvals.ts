import { createHmac } from "node:crypto";
import {
  type ActionClass,
  type ActorRef,
  type Approval,
  type ApprovalDecision,
  ApprovalSchema,
  type CapabilityGrant,
  CapabilityGrantSchema,
  type DomainError,
  type Result,
  SCHEMA_VERSION_V1,
} from "@aether-forge/contracts";
import { resolveActionTaxonomyRule } from "./taxonomy.ts";

export interface PendingApprovalRecord {
  readonly approvalId: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly planId: string;
  readonly planHash: string;
  readonly stepId: string;
  readonly actionClass: ActionClass;
  readonly policyVersion: string;
  readonly canonicalPathScope: readonly string[];
  readonly workerId: string;
  readonly createdAtMs: number;
  readonly expiresAtMs: number;
}

/**
 * Approval State Machine & CapabilityGrant Lifecycle (INV-02, INV-03).
 * Binds approvals to tenantId, projectId, planHash, policyVersion, canonicalPathScope, and expiry.
 */
export class ApprovalStateMachine {
  private readonly pending = new Map<string, PendingApprovalRecord>();
  private readonly decided = new Map<string, Approval>();
  private readonly grantsByApprovalId = new Map<string, CapabilityGrant>();
  private readonly signingSecret = "phase02-local-test-seam-hmac-signing-key-32bytes";

  public createPendingApproval(params: {
    readonly approvalId: string;
    readonly tenantId: string;
    readonly projectId: string;
    readonly planId: string;
    readonly planHash: string;
    readonly stepId: string;
    readonly actionClass: ActionClass;
    readonly policyVersion: string;
    readonly canonicalPathScope: readonly string[];
    readonly workerId?: string;
    readonly nowMs?: number;
    readonly customExpirySeconds?: number;
  }): PendingApprovalRecord {
    const rule = resolveActionTaxonomyRule(params.actionClass);
    const expirySeconds =
      params.customExpirySeconds ?? (rule && rule.approvalExpirySeconds > 0 ? rule.approvalExpirySeconds : 3_600);
    const nowMs = params.nowMs ?? Date.now();
    const record: PendingApprovalRecord = {
      approvalId: params.approvalId,
      tenantId: params.tenantId,
      projectId: params.projectId,
      planId: params.planId,
      planHash: params.planHash,
      stepId: params.stepId,
      actionClass: params.actionClass,
      policyVersion: params.policyVersion,
      canonicalPathScope: [...params.canonicalPathScope],
      workerId: params.workerId ?? "worker-win11-default",
      createdAtMs: nowMs,
      expiresAtMs: nowMs + expirySeconds * 1000,
    };
    this.pending.set(record.approvalId, record);
    return record;
  }

  public getPendingWithinTenant(
    tenantId: string,
    approvalId: string,
  ): PendingApprovalRecord | undefined {
    const record = this.pending.get(approvalId);
    if (!record || record.tenantId !== tenantId) {
      return undefined;
    }
    return record;
  }

  public getDecidedWithinTenant(tenantId: string, approvalId: string): Approval | undefined {
    const record = this.decided.get(approvalId);
    if (!record || record.tenantId !== tenantId) {
      return undefined;
    }
    return record;
  }

  public decide(params: {
    readonly approvalId: string;
    readonly tenantId: string;
    readonly actor: ActorRef;
    readonly expectedPlanId: string;
    readonly expectedPlanHash: string;
    readonly expectedStepId: string;
    readonly expectedPolicyVersion: string;
    readonly decision: ApprovalDecision;
    readonly rationale: string;
    readonly traceId: string;
    readonly nowMs?: number;
  }):
    | { readonly ok: true; readonly approval: Approval; readonly grant?: CapabilityGrant }
    | { readonly ok: false; readonly error: DomainError } {
    const nowMs = params.nowMs ?? Date.now();
    const pendingRecord = this.getPendingWithinTenant(params.tenantId, params.approvalId);

    if (!pendingRecord) {
      return {
        ok: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_APPROVAL_NOT_FOUND",
          message: "Approval request does not exist in caller tenant scope.",
          category: "NOT_FOUND",
          traceId: params.traceId,
        },
      };
    }

    const rule = resolveActionTaxonomyRule(pendingRecord.actionClass);
    if (!rule || rule.defaultDecision === "deny" || !rule.qualifiedInPhase02) {
      return {
        ok: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_ACTION_CLASS_DENIED",
          message: `Action class '${pendingRecord.actionClass}' is denied by taxonomy or unqualified.`,
          category: "POLICY_DENIED",
          traceId: params.traceId,
        },
      };
    }

    const canApprove = params.actor.roles.some((r) => rule.allowedApproverRoles.includes(r));
    if (!canApprove) {
      return {
        ok: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_APPROVER_ROLE_INSUFFICIENT",
          message: `Action class '${pendingRecord.actionClass}' requires approver role in [${rule.allowedApproverRoles.join(", ")}].`,
          category: "AUTHORIZATION",
          traceId: params.traceId,
        },
      };
    }

    if (nowMs >= pendingRecord.expiresAtMs) {
      const expiredApproval: Approval = ApprovalSchema.parse({
        schemaVersion: SCHEMA_VERSION_V1,
        approvalId: pendingRecord.approvalId,
        tenantId: pendingRecord.tenantId,
        projectId: pendingRecord.projectId,
        actor: params.actor,
        planId: pendingRecord.planId,
        planHash: pendingRecord.planHash,
        stepId: pendingRecord.stepId,
        actionClass: pendingRecord.actionClass,
        policyVersion: pendingRecord.policyVersion,
        canonicalPathScope: [...pendingRecord.canonicalPathScope],
        decision: "REJECTED",
        status: "EXPIRED",
        rationale: "Approval request expired prior to decision.",
        decidedAt: new Date(nowMs).toISOString(),
        expiresAt: new Date(pendingRecord.expiresAtMs).toISOString(),
      });
      this.decided.set(expiredApproval.approvalId, expiredApproval);
      return {
        ok: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_APPROVAL_EXPIRED",
          message: "Approval request has expired.",
          category: "APPROVAL_INVALID",
          traceId: params.traceId,
        },
      };
    }

    if (
      pendingRecord.planId !== params.expectedPlanId ||
      pendingRecord.planHash !== params.expectedPlanHash ||
      pendingRecord.stepId !== params.expectedStepId ||
      pendingRecord.policyVersion !== params.expectedPolicyVersion
    ) {
      const invalidated: Approval = ApprovalSchema.parse({
        schemaVersion: SCHEMA_VERSION_V1,
        approvalId: pendingRecord.approvalId,
        tenantId: pendingRecord.tenantId,
        projectId: pendingRecord.projectId,
        actor: params.actor,
        planId: pendingRecord.planId,
        planHash: pendingRecord.planHash,
        stepId: pendingRecord.stepId,
        actionClass: pendingRecord.actionClass,
        policyVersion: pendingRecord.policyVersion,
        canonicalPathScope: [...pendingRecord.canonicalPathScope],
        decision: "REJECTED",
        status: "INVALIDATED",
        rationale: "Invalidated due to planHash or policyVersion drift (INV-03).",
        decidedAt: new Date(nowMs).toISOString(),
        expiresAt: new Date(pendingRecord.expiresAtMs).toISOString(),
      });
      this.decided.set(invalidated.approvalId, invalidated);
      return {
        ok: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_APPROVAL_PLAN_OR_POLICY_DRIFT",
          message: "Approval binding mismatched current planHash or policyVersion (INV-03).",
          category: "APPROVAL_INVALID",
          traceId: params.traceId,
        },
      };
    }

    const status = params.decision === "APPROVED" ? "APPROVED" : "REJECTED";
    const decidedIso = new Date(nowMs).toISOString();
    const expiresIso = new Date(pendingRecord.expiresAtMs).toISOString();

    const approval = ApprovalSchema.parse({
      schemaVersion: SCHEMA_VERSION_V1,
      approvalId: pendingRecord.approvalId,
      tenantId: pendingRecord.tenantId,
      projectId: pendingRecord.projectId,
      actor: params.actor,
      planId: pendingRecord.planId,
      planHash: pendingRecord.planHash,
      stepId: pendingRecord.stepId,
      actionClass: pendingRecord.actionClass,
      policyVersion: pendingRecord.policyVersion,
      canonicalPathScope: [...pendingRecord.canonicalPathScope],
      decision: params.decision,
      status,
      rationale: params.rationale,
      decidedAt: decidedIso,
      expiresAt: expiresIso,
    });
    this.decided.set(approval.approvalId, approval);

    if (params.decision !== "APPROVED") {
      return { ok: true, approval };
    }

    const signaturePayload = `${approval.approvalId}:${approval.tenantId}:${approval.planHash}:${approval.stepId}:${approval.policyVersion}:${expiresIso}`;
    const signature = `hmac-sha256-${createHmac("sha256", this.signingSecret).update(signaturePayload).digest("hex")}`;

    const grant = CapabilityGrantSchema.parse({
      schemaVersion: SCHEMA_VERSION_V1,
      grantId: `grant-${approval.approvalId}`,
      tenantId: approval.tenantId,
      projectId: approval.projectId,
      workerId: pendingRecord.workerId,
      planId: approval.planId,
      planHash: approval.planHash,
      stepId: approval.stepId,
      actionClass: approval.actionClass,
      canonicalPathScope: [...approval.canonicalPathScope],
      policyVersion: approval.policyVersion,
      issuedAt: decidedIso,
      expiresAt: expiresIso,
      revoked: false,
      signature,
    });

    this.grantsByApprovalId.set(approval.approvalId, grant);
    return { ok: true, approval, grant };
  }

  /**
   * Verifies at dispatch time that an existing approval and its CapabilityGrant remain valid,
   * non-expired, non-revoked, within canonicalPathScope, and strictly bound to current planHash and policyVersion (INV-03).
   */
  public verifyApprovalForDispatch(params: {
    readonly approvalId: string;
    readonly tenantId: string;
    readonly currentPlanHash: string;
    readonly currentPolicyVersion: string;
    readonly requestedPath?: string | undefined;
    readonly traceId: string;
    readonly nowMs?: number;
  }): Result<CapabilityGrant> {
    const nowMs = params.nowMs ?? Date.now();
    const approval = this.getDecidedWithinTenant(params.tenantId, params.approvalId);
    const grant = this.grantsByApprovalId.get(params.approvalId);

    if (!approval || !grant || grant.tenantId !== params.tenantId) {
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_APPROVAL_GRANT_NOT_FOUND",
          message: "No active approved CapabilityGrant found for step in tenant scope.",
          category: "APPROVAL_INVALID",
          traceId: params.traceId,
        },
      };
    }

    if (grant.revoked || approval.status === "INVALIDATED") {
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_CAPABILITY_GRANT_REVOKED",
          message: "CapabilityGrant has been revoked or invalidated.",
          category: "APPROVAL_INVALID",
          traceId: params.traceId,
        },
      };
    }

    if (nowMs >= Date.parse(approval.expiresAt)) {
      this.decided.set(approval.approvalId, { ...approval, status: "EXPIRED" });
      this.grantsByApprovalId.set(approval.approvalId, { ...grant, revoked: true });
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_APPROVAL_GRANT_EXPIRED",
          message: "CapabilityGrant expired before execution dispatch.",
          category: "APPROVAL_INVALID",
          traceId: params.traceId,
        },
      };
    }

    if (
      approval.planHash !== params.currentPlanHash ||
      approval.policyVersion !== params.currentPolicyVersion
    ) {
      this.decided.set(approval.approvalId, { ...approval, status: "INVALIDATED" });
      this.grantsByApprovalId.set(approval.approvalId, { ...grant, revoked: true });
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_APPROVAL_INVALIDATED_BY_DRIFT",
          message:
            "Changed planHash or policyVersion invalidated prior approval and revoked grant (INV-03).",
          category: "APPROVAL_INVALID",
          traceId: params.traceId,
        },
      };
    }

    if (params.requestedPath !== undefined) {
      const normalizedTarget = params.requestedPath.replace(/\\/g, "/");
      const hasTraversal =
        normalizedTarget.includes("../") || normalizedTarget.endsWith("/..");
      const withinScope =
        !hasTraversal &&
        grant.canonicalPathScope.some((root) => {
          const normalizedRoot = root.replace(/\\/g, "/").replace(/\/+$/, "");
          return (
            normalizedTarget === normalizedRoot ||
            normalizedTarget.startsWith(`${normalizedRoot}/`)
          );
        });

      if (!withinScope) {
        return {
          ok: false,
          retryable: false,
          error: {
            schemaVersion: SCHEMA_VERSION_V1,
            code: "DOMAIN_CAPABILITY_SCOPE_VIOLATION",
            message:
              "Requested target path falls outside the approval's granted canonicalPathScope.",
            category: "WORKER_TRUST_BOUNDARY",
            traceId: params.traceId,
          },
        };
      }
    }

    return {
      ok: true,
      value: grant,
      evidence: [],
    };
  }

  public revokeGrantByApprovalId(tenantId: string, approvalId: string): boolean {
    const grant = this.grantsByApprovalId.get(approvalId);
    if (!grant || grant.tenantId !== tenantId) {
      return false;
    }
    this.grantsByApprovalId.set(approvalId, { ...grant, revoked: true });
    const existingApproval = this.decided.get(approvalId);
    if (existingApproval) {
      this.decided.set(approvalId, { ...existingApproval, status: "INVALIDATED" });
    }
    return true;
  }

  /**
   * Revokes all active CapabilityGrants matching an Emergency Stop scope.
   */
  public revokeGrantsForScope(params: {
    readonly tenantId: string;
    readonly projectId?: string | undefined;
    readonly workerId?: string | undefined;
  }): number {
    let count = 0;
    for (const [approvalId, grant] of this.grantsByApprovalId.entries()) {
      if (grant.revoked || grant.tenantId !== params.tenantId) {
        continue;
      }
      if (params.projectId !== undefined && grant.projectId !== params.projectId) {
        continue;
      }
      if (params.workerId !== undefined && grant.workerId !== params.workerId) {
        continue;
      }
      this.grantsByApprovalId.set(approvalId, { ...grant, revoked: true });
      const existingApproval = this.decided.get(approvalId);
      if (existingApproval) {
        this.decided.set(approvalId, { ...existingApproval, status: "INVALIDATED" });
      }
      count += 1;
    }
    return count;
  }
}
