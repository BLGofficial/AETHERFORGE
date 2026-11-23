import { createHash, createHmac, randomBytes } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { EngineeringArtifactManager } from "../../ARTIFACT_MANAGER/src/index.ts";
import { EngineeringExecutionAuditLog } from "../../EXECUTION_AUDIT/src/index.ts";
import { ControlledExecutionAdapters, type GatewayExecutionSeal } from "../../EXECUTION_ADAPTERS/src/index.ts";
import { EngineeringPermissionManager } from "../../PERMISSION_SYSTEM/src/index.ts";
import { EngineeringToolRegistry } from "./tool-registry.ts";
import {
  type EngineeringToolId,
  type PlannedToolInvocationProposal,
  PlannedToolInvocationProposalSchema,
  type RuntimeErrorReport,
} from "./tool-schemas.ts";

export interface GatewayExecutionOutcome<TOutput = unknown> {
  ok: boolean;
  proposalId: string;
  toolId: EngineeringToolId;
  output?: TOutput;
  error?: RuntimeErrorReport;
  auditEntryHash: string;
  rolledBackFromCheckpoint: boolean;
}

interface FileSnapshotCheckpoint {
  canonicalPath: string;
  existedBefore: boolean;
  previousContent: Buffer | null;
}

function sha256Hex(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex").toUpperCase();
}

export class ControlledToolGateway {
  private readonly gatewaySecret = randomBytes(32);
  private readonly activeSeals = new Map<string, GatewayExecutionSeal>();
  private readonly registry: EngineeringToolRegistry;
  private readonly permissions: EngineeringPermissionManager;
  private readonly auditLog: EngineeringExecutionAuditLog;
  private readonly artifactManager: EngineeringArtifactManager;
  private readonly adapters: ControlledExecutionAdapters;

  public constructor(options: {
    workspaceRoot: string;
    registry?: EngineeringToolRegistry;
    permissions?: EngineeringPermissionManager;
    auditLog?: EngineeringExecutionAuditLog;
    artifactManager?: EngineeringArtifactManager;
  }) {
    this.registry = options.registry ?? new EngineeringToolRegistry();
    this.permissions = options.permissions ?? new EngineeringPermissionManager();
    this.auditLog = options.auditLog ?? new EngineeringExecutionAuditLog();
    this.artifactManager = options.artifactManager ?? new EngineeringArtifactManager();
    this.adapters = new ControlledExecutionAdapters({
      workspaceRoot: options.workspaceRoot,
      artifactManager: this.artifactManager,
      verifyGatewaySeal: (seal, proposalId, toolId) => this.consumeAndVerifySeal(seal, proposalId, toolId),
    });
  }

  public getRegistry(): EngineeringToolRegistry {
    return this.registry;
  }

  public getPermissions(): EngineeringPermissionManager {
    return this.permissions;
  }

  public getAuditLog(): EngineeringExecutionAuditLog {
    return this.auditLog;
  }

  public getArtifactManager(): EngineeringArtifactManager {
    return this.artifactManager;
  }

  public getAdaptersForDirectBypassTesting(): ControlledExecutionAdapters {
    return this.adapters;
  }

  public executeProposal<TOutput = unknown>(
    rawProposal: PlannedToolInvocationProposal
  ): GatewayExecutionOutcome<TOutput> {
    const proposal = PlannedToolInvocationProposalSchema.parse(rawProposal);
    const toolDescriptor = this.registry.getTool(proposal.toolId);
    const inputSha256 = sha256Hex(JSON.stringify(proposal.rawInput ?? {}));

    // 1. Validate tool input against strict Zod inputSchema
    const inputParse = toolDescriptor.inputSchema.safeParse(proposal.rawInput);
    if (!inputParse.success) {
      const errReport: RuntimeErrorReport = {
        errorCode: "TOOL_INPUT_SCHEMA_INVALID",
        category: "VALIDATION_ERROR",
        message: `Input validation failed for '${proposal.toolId}': ${inputParse.error.message}`,
        traceId: proposal.traceId,
        retryable: false,
        remediationHint: "Conform tool input payload to the registered Zod inputSchema.",
        details: { toolId: proposal.toolId },
      };
      const audit = this.auditLog.record({
        proposalId: proposal.proposalId,
        traceId: proposal.traceId,
        tenantId: proposal.tenantId,
        projectId: proposal.projectId,
        planId: proposal.planId,
        stepId: proposal.stepId,
        agentId: proposal.agentId,
        toolId: proposal.toolId,
        actionTier: proposal.actionTier,
        fenceToken: proposal.fenceToken,
        outcome: "BLOCKED_PERMISSION",
        inputSha256,
        outputSha256: "0".repeat(64),
        errorCode: errReport.errorCode,
      });
      return {
        ok: false,
        proposalId: proposal.proposalId,
        toolId: proposal.toolId,
        error: errReport,
        auditEntryHash: audit.entryHash,
        rolledBackFromCheckpoint: false,
      };
    }

    // 2. Evaluate Permissions, Write-Lease Globs, Fence Tokens & Human Approval Grants
    const permDecision = this.permissions.authorizeProposal(proposal, toolDescriptor);
    if (!permDecision.allowed && permDecision.error) {
      const audit = this.auditLog.record({
        proposalId: proposal.proposalId,
        traceId: proposal.traceId,
        tenantId: proposal.tenantId,
        projectId: proposal.projectId,
        planId: proposal.planId,
        stepId: proposal.stepId,
        agentId: proposal.agentId,
        toolId: proposal.toolId,
        actionTier: proposal.actionTier,
        fenceToken: proposal.fenceToken,
        outcome: "BLOCKED_PERMISSION",
        inputSha256,
        outputSha256: "0".repeat(64),
        errorCode: permDecision.error.errorCode,
      });
      return {
        ok: false,
        proposalId: proposal.proposalId,
        toolId: proposal.toolId,
        error: permDecision.error,
        auditEntryHash: audit.entryHash,
        rolledBackFromCheckpoint: false,
      };
    }

    // 3. Sandbox Path Containment Check & Pre-Execution Task Checkpoint Snapshot
    let checkpointSnapshot: FileSnapshotCheckpoint | null = null;
    try {
      const targetCanonical = this.adapters.resolveConfinedPath(proposal.targetRelativePath);
      if (toolDescriptor.requiresWriteLease) {
        const existed = existsSync(targetCanonical);
        checkpointSnapshot = {
          canonicalPath: targetCanonical,
          existedBefore: existed,
          previousContent: existed ? readFileSync(targetCanonical) : null,
        };
      }
    } catch (sandboxErr) {
      const msg = sandboxErr instanceof Error ? sandboxErr.message : String(sandboxErr);
      const errReport: RuntimeErrorReport = {
        errorCode: "SANDBOX_CONFINEMENT_VIOLATION",
        category: "SANDBOX_VIOLATION",
        message: msg,
        traceId: proposal.traceId,
        retryable: false,
        remediationHint: "Use a canonical relative path inside the workspace root without symlinks or '../' segments.",
        details: { targetRelativePath: proposal.targetRelativePath },
      };
      const audit = this.auditLog.record({
        proposalId: proposal.proposalId,
        traceId: proposal.traceId,
        tenantId: proposal.tenantId,
        projectId: proposal.projectId,
        planId: proposal.planId,
        stepId: proposal.stepId,
        agentId: proposal.agentId,
        toolId: proposal.toolId,
        actionTier: proposal.actionTier,
        fenceToken: proposal.fenceToken,
        outcome: "BLOCKED_SANDBOX",
        inputSha256,
        outputSha256: "0".repeat(64),
        errorCode: errReport.errorCode,
      });
      return {
        ok: false,
        proposalId: proposal.proposalId,
        toolId: proposal.toolId,
        error: errReport,
        auditEntryHash: audit.entryHash,
        rolledBackFromCheckpoint: false,
      };
    }

    // 4. Issue Single-Use Gateway Execution Seal & Invoke Adapter
    const seal = this.mintSingleUseSeal(proposal.proposalId, proposal.toolId);
    try {
      const rawOutput = this.adapters.invokeAdapter(seal, proposal, inputParse.data);

      // 5. Validate Adapter Output against strict Zod outputSchema
      const outputParse = toolDescriptor.outputSchema.safeParse(rawOutput);
      if (!outputParse.success) {
        throw new Error(`TOOL_OUTPUT_SCHEMA_INVALID: ${outputParse.error.message}`);
      }

      const outputSha256 = sha256Hex(JSON.stringify(outputParse.data));
      const audit = this.auditLog.record({
        proposalId: proposal.proposalId,
        traceId: proposal.traceId,
        tenantId: proposal.tenantId,
        projectId: proposal.projectId,
        planId: proposal.planId,
        stepId: proposal.stepId,
        agentId: proposal.agentId,
        toolId: proposal.toolId,
        actionTier: proposal.actionTier,
        fenceToken: proposal.fenceToken,
        outcome: "EXECUTED_SUCCESS",
        inputSha256,
        outputSha256,
        errorCode: null,
      });

      return {
        ok: true,
        proposalId: proposal.proposalId,
        toolId: proposal.toolId,
        output: outputParse.data as TOutput,
        auditEntryHash: audit.entryHash,
        rolledBackFromCheckpoint: false,
      };
    } catch (execErr) {
      // Automatic Recovery Mechanism: restore pre-execution file checkpoint on failure
      let rolledBack = false;
      if (checkpointSnapshot) {
        if (checkpointSnapshot.existedBefore && checkpointSnapshot.previousContent !== null) {
          writeFileSync(checkpointSnapshot.canonicalPath, checkpointSnapshot.previousContent);
          rolledBack = true;
        } else if (!checkpointSnapshot.existedBefore && existsSync(checkpointSnapshot.canonicalPath)) {
          rmSync(checkpointSnapshot.canonicalPath, { force: true });
          rolledBack = true;
        }
      }

      const msg = execErr instanceof Error ? execErr.message : String(execErr);
      const errReport: RuntimeErrorReport = {
        errorCode: msg.split(":")[0] ?? "TOOL_EXECUTION_FAILED",
        category: rolledBack ? "RECOVERY_ROLLBACK_TRIGGERED" : "EXECUTION_FAILURE",
        message: msg,
        traceId: proposal.traceId,
        retryable: false,
        remediationHint: "Inspect error details; any partial file mutation was automatically rolled back from checkpoint.",
        details: { toolId: proposal.toolId, rolledBack: String(rolledBack) },
      };

      const audit = this.auditLog.record({
        proposalId: proposal.proposalId,
        traceId: proposal.traceId,
        tenantId: proposal.tenantId,
        projectId: proposal.projectId,
        planId: proposal.planId,
        stepId: proposal.stepId,
        agentId: proposal.agentId,
        toolId: proposal.toolId,
        actionTier: proposal.actionTier,
        fenceToken: proposal.fenceToken,
        outcome: "FAILED_AND_ROLLED_BACK",
        inputSha256,
        outputSha256: "0".repeat(64),
        errorCode: errReport.errorCode,
      });

      return {
        ok: false,
        proposalId: proposal.proposalId,
        toolId: proposal.toolId,
        error: errReport,
        auditEntryHash: audit.entryHash,
        rolledBackFromCheckpoint: rolledBack,
      };
    }
  }

  private mintSingleUseSeal(proposalId: string, toolId: EngineeringToolId): GatewayExecutionSeal {
    const sealId = `SEAL-${proposalId}-${Date.now()}`;
    const signatureHmacSha256 = createHmac("sha256", this.gatewaySecret)
      .update(`${sealId}:${proposalId}:${toolId}`, "utf8")
      .digest("hex")
      .toUpperCase();
    const seal: GatewayExecutionSeal = {
      sealId,
      proposalId,
      toolId,
      signatureHmacSha256,
    };
    this.activeSeals.set(sealId, seal);
    return seal;
  }

  private consumeAndVerifySeal(
    seal: GatewayExecutionSeal,
    expectedProposalId: string,
    expectedToolId: EngineeringToolId
  ): boolean {
    const stored = this.activeSeals.get(seal.sealId);
    if (!stored) return false;
    this.activeSeals.delete(seal.sealId); // Single-use consumption

    const expectedSig = createHmac("sha256", this.gatewaySecret)
      .update(`${seal.sealId}:${expectedProposalId}:${expectedToolId}`, "utf8")
      .digest("hex")
      .toUpperCase();

    return (
      stored.proposalId === expectedProposalId &&
      stored.toolId === expectedToolId &&
      seal.signatureHmacSha256 === expectedSig
    );
  }
}
