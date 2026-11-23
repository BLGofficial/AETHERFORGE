import { createHash } from "node:crypto";
import { type SpecialistAgentId } from "../../SPECIFICATION_SCHEMAS/compiler-schemas.ts";
import { type EngineeringToolId } from "../../TOOL_GATEWAY/src/tool-schemas.ts";

export interface ExecutionAuditEntry {
  sequenceNumber: number;
  proposalId: string;
  traceId: string;
  tenantId: string;
  projectId: string;
  planId: string;
  stepId: string;
  agentId: SpecialistAgentId;
  toolId: EngineeringToolId;
  actionTier: "0" | "1" | "2" | "3";
  fenceToken: number;
  outcome: "EXECUTED_SUCCESS" | "BLOCKED_PERMISSION" | "BLOCKED_SANDBOX" | "FAILED_AND_ROLLED_BACK" | "GATEWAY_BYPASS_REJECTED";
  inputSha256: string;
  outputSha256: string;
  errorCode: string | null;
  prevHash: string;
  entryHash: string;
  timestamp: string;
}

const GENESIS_AUDIT_HASH = "0".repeat(64);

function sha256Hex(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex").toUpperCase();
}

export class EngineeringExecutionAuditLog {
  private readonly entries: ExecutionAuditEntry[] = [];
  private headHash = GENESIS_AUDIT_HASH;

  public record(params: Omit<ExecutionAuditEntry, "sequenceNumber" | "prevHash" | "entryHash" | "timestamp">): ExecutionAuditEntry {
    const sequenceNumber = this.entries.length + 1;
    const prevHash = this.headHash;
    const timestamp = new Date().toISOString();

    const canonical = JSON.stringify({
      sequenceNumber,
      proposalId: params.proposalId,
      traceId: params.traceId,
      tenantId: params.tenantId,
      projectId: params.projectId,
      planId: params.planId,
      stepId: params.stepId,
      agentId: params.agentId,
      toolId: params.toolId,
      actionTier: params.actionTier,
      fenceToken: params.fenceToken,
      outcome: params.outcome,
      inputSha256: params.inputSha256,
      outputSha256: params.outputSha256,
      errorCode: params.errorCode,
      prevHash,
    });

    const entryHash = sha256Hex(canonical);
    const entry: ExecutionAuditEntry = {
      ...params,
      sequenceNumber,
      prevHash,
      entryHash,
      timestamp,
    };

    this.entries.push(entry);
    this.headHash = entryHash;
    return entry;
  }

  public verifyIntegrity(): { valid: boolean; totalEntries: number; headHash: string } {
    let prev = GENESIS_AUDIT_HASH;
    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i]!;
      const expected = sha256Hex(
        JSON.stringify({
          sequenceNumber: i + 1,
          proposalId: e.proposalId,
          traceId: e.traceId,
          tenantId: e.tenantId,
          projectId: e.projectId,
          planId: e.planId,
          stepId: e.stepId,
          agentId: e.agentId,
          toolId: e.toolId,
          actionTier: e.actionTier,
          fenceToken: e.fenceToken,
          outcome: e.outcome,
          inputSha256: e.inputSha256,
          outputSha256: e.outputSha256,
          errorCode: e.errorCode,
          prevHash: prev,
        })
      );
      if (e.prevHash !== prev || e.entryHash !== expected) {
        return { valid: false, totalEntries: this.entries.length, headHash: this.headHash };
      }
      prev = e.entryHash;
    }
    return { valid: true, totalEntries: this.entries.length, headHash: this.headHash };
  }

  public listEntries(): readonly ExecutionAuditEntry[] {
    return this.entries;
  }
}
