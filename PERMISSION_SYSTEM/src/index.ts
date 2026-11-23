import { type SpecialistAgentId } from "../../SPECIFICATION_SCHEMAS/compiler-schemas.ts";
import { type ToolDescriptor } from "../../TOOL_GATEWAY/src/tool-registry.ts";
import {
  type EngineeringToolId,
  type PlannedToolInvocationProposal,
  type RuntimeErrorReport,
} from "../../TOOL_GATEWAY/src/tool-schemas.ts";

export interface HumanApprovalGrant {
  grantId: string;
  tenantId: string;
  projectId: string;
  planId: string;
  stepId: string;
  toolId: EngineeringToolId;
  requesterAgentId: SpecialistAgentId;
  requesterPrincipalId: string;
  approverPrincipalId: string;
  approverRole: "Reviewer" | "ReleaseManager";
  allowedRelativePathPrefix: string;
  expiresAtIso: string;
  consumed: boolean;
}

export interface PermissionDecision {
  allowed: boolean;
  error?: RuntimeErrorReport;
}

export class EngineeringPermissionManager {
  private readonly approvalGrants = new Map<string, HumanApprovalGrant>();
  private readonly maxFenceTokenByPath = new Map<string, number>();

  public issueHumanApprovalGrant(grant: Omit<HumanApprovalGrant, "consumed">): HumanApprovalGrant {
    if (grant.requesterPrincipalId === grant.approverPrincipalId) {
      throw new Error(
        `SELF_APPROVAL_FORBIDDEN: requesterPrincipalId=${grant.requesterPrincipalId} cannot approve own sensitive operation.`
      );
    }
    const record: HumanApprovalGrant = { ...grant, consumed: false };
    this.approvalGrants.set(record.grantId, record);
    return record;
  }

  public authorizeProposal(
    proposal: PlannedToolInvocationProposal,
    toolDescriptor: ToolDescriptor
  ): PermissionDecision {
    // 1. Check agent allowlist for tool
    if (!toolDescriptor.allowedAgents.includes(proposal.agentId)) {
      return {
        allowed: false,
        error: {
          errorCode: "AGENT_TOOL_PERMISSION_DENIED",
          category: "PERMISSION_DENIED",
          message: `Agent ${proposal.agentId} is not permitted to invoke tool '${proposal.toolId}'.`,
          traceId: proposal.traceId,
          retryable: false,
          remediationHint: `Delegate '${proposal.toolId}' to an authorized specialist agent (${toolDescriptor.allowedAgents.join(", ")}).`,
          details: { agentId: proposal.agentId, toolId: proposal.toolId },
        },
      };
    }

    // 2. Check action tier floor
    if (Number(proposal.actionTier) < Number(toolDescriptor.minimumActionTier)) {
      return {
        allowed: false,
        error: {
          errorCode: "INSUFFICIENT_ACTION_TIER",
          category: "PERMISSION_DENIED",
          message: `Tool '${proposal.toolId}' requires minimum Action Tier ${toolDescriptor.minimumActionTier}, but proposal declared Tier ${proposal.actionTier}.`,
          traceId: proposal.traceId,
          retryable: false,
          remediationHint: `Elevate step actionTier to >= ${toolDescriptor.minimumActionTier} and attach required approval grant.`,
          details: { declaredTier: proposal.actionTier, requiredTier: toolDescriptor.minimumActionTier },
        },
      };
    }

    // 3. Check write lease globs and monotonic fence token for mutating tools
    if (toolDescriptor.requiresWriteLease) {
      const normalizedTarget = proposal.targetRelativePath.replace(/\\/g, "/").replace(/^\.\//, "");
      const matchesLease = proposal.leasedWriteGlobs.some((glob) => this.matchesGlob(normalizedTarget, glob));

      if (!matchesLease) {
        return {
          allowed: false,
          error: {
            errorCode: "OUT_OF_LEASE_WRITE_DENIED",
            category: "PERMISSION_DENIED",
            message: `Agent ${proposal.agentId} attempted to mutate '${normalizedTarget}' outside leased write globs [${proposal.leasedWriteGlobs.join(", ")}].`,
            traceId: proposal.traceId,
            retryable: false,
            remediationHint: "Restrict file mutations to paths covered by TaskOwnershipLease.exclusiveWriteGlobs.",
            details: { targetPath: normalizedTarget },
          },
        };
      }

      const maxSeenFence = this.maxFenceTokenByPath.get(normalizedTarget) ?? 0;
      if (proposal.fenceToken < maxSeenFence) {
        return {
          allowed: false,
          error: {
            errorCode: "STALE_FENCE_TOKEN_REJECTED",
            category: "PERMISSION_DENIED",
            message: `Stale fenceToken=${proposal.fenceToken} < maxSeen=${maxSeenFence} for path '${normalizedTarget}'.`,
            traceId: proposal.traceId,
            retryable: false,
            remediationHint: "Refresh TaskOwnershipLease from orchestrator before retrying.",
            details: { targetPath: normalizedTarget, fenceToken: String(proposal.fenceToken) },
          },
        };
      }
      this.maxFenceTokenByPath.set(normalizedTarget, proposal.fenceToken);
    }

    // 4. Enforce Human Approval for sensitive operations (Tier 2/3 or toolDescriptor.requiresHumanApproval)
    const needsHumanApproval =
      toolDescriptor.requiresHumanApproval || Number(proposal.actionTier) >= 2;

    if (needsHumanApproval) {
      if (!proposal.approvalGrantId) {
        return {
          allowed: false,
          error: {
            errorCode: "HUMAN_APPROVAL_GRANT_REQUIRED",
            category: "APPROVAL_REQUIRED",
            message: `Sensitive operation '${proposal.toolId}' (Tier ${proposal.actionTier}) requires a signed human ApprovalGrant.`,
            traceId: proposal.traceId,
            retryable: true,
            remediationHint: "Suspend workflow and request Reviewer/ReleaseManager sign-off via issueHumanApprovalGrant().",
            details: { toolId: proposal.toolId, stepId: proposal.stepId },
          },
        };
      }

      const grant = this.approvalGrants.get(proposal.approvalGrantId);
      if (!grant) {
        return {
          allowed: false,
          error: {
            errorCode: "APPROVAL_GRANT_NOT_FOUND",
            category: "APPROVAL_REQUIRED",
            message: `Approval grant '${proposal.approvalGrantId}' does not exist.`,
            traceId: proposal.traceId,
            retryable: false,
            remediationHint: "Obtain a valid ApprovalGrant ID from EngineeringPermissionManager.",
            details: { approvalGrantId: proposal.approvalGrantId },
          },
        };
      }

      if (grant.consumed) {
        return {
          allowed: false,
          error: {
            errorCode: "APPROVAL_GRANT_ALREADY_CONSUMED",
            category: "APPROVAL_REQUIRED",
            message: `Single-use approval grant '${grant.grantId}' has already been consumed.`,
            traceId: proposal.traceId,
            retryable: false,
            remediationHint: "Issue a fresh single-use ApprovalGrant for each sensitive tool invocation.",
            details: { approvalGrantId: grant.grantId },
          },
        };
      }

      if (new Date(grant.expiresAtIso).getTime() <= Date.now()) {
        return {
          allowed: false,
          error: {
            errorCode: "APPROVAL_GRANT_EXPIRED",
            category: "APPROVAL_REQUIRED",
            message: `Approval grant '${grant.grantId}' expired at ${grant.expiresAtIso}.`,
            traceId: proposal.traceId,
            retryable: false,
            remediationHint: "Request a new time-bounded approval grant.",
            details: { expiresAt: grant.expiresAtIso },
          },
        };
      }

      const normalizedTarget = proposal.targetRelativePath.replace(/\\/g, "/").replace(/^\.\//, "");
      const allowedPrefix = grant.allowedRelativePathPrefix.replace(/\\/g, "/").replace(/^\.\//, "");

      if (
        grant.planId !== proposal.planId ||
        grant.stepId !== proposal.stepId ||
        grant.toolId !== proposal.toolId ||
        !normalizedTarget.startsWith(allowedPrefix)
      ) {
        return {
          allowed: false,
          error: {
            errorCode: "APPROVAL_GRANT_SCOPE_MISMATCH",
            category: "PERMISSION_DENIED",
            message: `Approval grant '${grant.grantId}' scope does not match proposal (planId/stepId/toolId/path).`,
            traceId: proposal.traceId,
            retryable: false,
            remediationHint: "Ensure approval grant is bound to the exact planId, stepId, toolId, and target path prefix.",
            details: { targetPath: normalizedTarget, allowedPrefix },
          },
        };
      }

      // Consume single-use grant
      grant.consumed = true;
    }

    return { allowed: true };
  }

  private matchesGlob(normalizedPath: string, globPattern: string): boolean {
    const cleanGlob = globPattern.replace(/\\/g, "/").replace(/^\.\//, "");
    if (cleanGlob === "**" || cleanGlob === "*") return true;
    if (cleanGlob.endsWith("/**")) {
      const prefix = cleanGlob.slice(0, -3);
      return normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`);
    }
    return normalizedPath === cleanGlob;
  }
}
