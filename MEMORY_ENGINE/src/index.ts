import { createHash } from "node:crypto";
import { type SpecialistAgentId } from "../../SPECIFICATION_SCHEMAS/compiler-schemas.ts";
import { PersistentKnowledgeEngine } from "../../KNOWLEDGE_ENGINE/src/index.ts";

/**
 * AETHER FORGE — PERSISTENT PROJECT, ADR, HISTORY & AGENT MEMORY ENGINE (ARCH-08)
 */

export interface AdrMemoryRecord {
  adrId: string;
  tenantId: string;
  projectId: string;
  title: string;
  status: "ACCEPTED" | "SUPERSEDED" | "DEPRECATED";
  supersedesAdrId: string | null;
  decisionSummary: string;
  consequences: string[];
  governingSubsystemIds: string[];
  sourceUri: string;
  sha256: string;
  recordedAt: string;
}

export interface EngineeringHistoryEvent {
  eventId: string;
  tenantId: string;
  projectId: string;
  category: "ARCHITECTURE_BASELINE" | "WORKFLOW_EXECUTION" | "RELEASE_PROMOTION" | "ROLLBACK_RECOVERY";
  agentId: SpecialistAgentId;
  summary: string;
  artifactSha256: string;
  prevEventHash: string;
  eventHash: string;
  timestamp: string;
}

export interface AgentMemoryEntry {
  namespaceUri: string;
  tenantId: string;
  projectId: string;
  agentId: SpecialistAgentId;
  key: string;
  value: string;
  epistemicStatus: "WORKING_HYPOTHESIS" | "VERIFIED_OBSERVATION";
  updatedAt: string;
}

const GENESIS_HISTORY_HASH = "0".repeat(64);

function sha256Hex(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex").toUpperCase();
}

export class PersistentMemoryEngine {
  private readonly knowledgeEngine: PersistentKnowledgeEngine;
  private readonly adrStore = new Map<string, AdrMemoryRecord>();
  private readonly engineeringHistory: EngineeringHistoryEvent[] = [];
  private readonly agentScratchpad = new Map<string, AgentMemoryEntry>();
  private historyHeadHash = GENESIS_HISTORY_HASH;

  public constructor(knowledgeEngine: PersistentKnowledgeEngine) {
    this.knowledgeEngine = knowledgeEngine;
  }

  public recordAdrDecision(params: {
    adrId: string;
    tenantId: string;
    projectId: string;
    title: string;
    status: "ACCEPTED" | "SUPERSEDED" | "DEPRECATED";
    supersedesAdrId?: string | null;
    decisionSummary: string;
    consequences: string[];
    governingSubsystemIds: string[];
    sourceUri: string;
  }): AdrMemoryRecord {
    const sha256 = sha256Hex(`${params.adrId}:${params.title}:${params.decisionSummary}`);
    const recordedAt = new Date().toISOString();

    if (params.supersedesAdrId) {
      const oldAdr = this.adrStore.get(params.supersedesAdrId);
      if (oldAdr) {
        oldAdr.status = "SUPERSEDED";
      }
    }

    const adr: AdrMemoryRecord = {
      adrId: params.adrId,
      tenantId: params.tenantId,
      projectId: params.projectId,
      title: params.title,
      status: params.status,
      supersedesAdrId: params.supersedesAdrId ?? null,
      decisionSummary: params.decisionSummary,
      consequences: params.consequences,
      governingSubsystemIds: params.governingSubsystemIds,
      sourceUri: params.sourceUri,
      sha256,
      recordedAt,
    };
    this.adrStore.set(params.adrId, adr);

    // Sync into Layer 4 (ENGINEERING_DECISION) of PersistentKnowledgeEngine
    this.knowledgeEngine.upsertRecord({
      recordId: params.adrId,
      tenantId: params.tenantId,
      projectId: params.projectId,
      layer: "ENGINEERING_DECISION",
      scope: "ARCHITECTURE_DECISION_RECORD",
      title: `${params.adrId}: ${params.title}`,
      content: `${params.decisionSummary}\n\nConsequences:\n${params.consequences.map((c) => `- ${c}`).join("\n")}`,
      canonicalSubject: params.adrId,
      canonicalPredicate: "architectural_decision",
      canonicalValue: params.decisionSummary,
      tags: ["adr", ...params.governingSubsystemIds],
      authorAgentId: "AGT-01",
      verifierAgentId: "AGT-19",
      supersedesRecordId: params.supersedesAdrId ?? null,
      sourceRef: {
        sourceUri: params.sourceUri,
        sourceSha256: sha256,
        lineStart: 1,
        lineEnd: 25,
        capturedAt: recordedAt,
      },
    });

    return adr;
  }

  public listActiveAdrs(tenantId: string, projectId: string): AdrMemoryRecord[] {
    return Array.from(this.adrStore.values()).filter(
      (a) => a.tenantId === tenantId && a.projectId === projectId && a.status === "ACCEPTED"
    );
  }

  public appendEngineeringHistory(params: {
    tenantId: string;
    projectId: string;
    category: EngineeringHistoryEvent["category"];
    agentId: SpecialistAgentId;
    summary: string;
    artifactSha256: string;
  }): EngineeringHistoryEvent {
    const seq = this.engineeringHistory.length + 1;
    const eventId = `HIST-${String(seq).padStart(5, "0")}`;
    const prevEventHash = this.historyHeadHash;
    const timestamp = new Date().toISOString();

    const eventHash = sha256Hex(
      JSON.stringify({
        eventId,
        tenantId: params.tenantId,
        projectId: params.projectId,
        category: params.category,
        agentId: params.agentId,
        summary: params.summary,
        artifactSha256: params.artifactSha256,
        prevEventHash,
      })
    );

    const ev: EngineeringHistoryEvent = {
      eventId,
      tenantId: params.tenantId,
      projectId: params.projectId,
      category: params.category,
      agentId: params.agentId,
      summary: params.summary,
      artifactSha256: params.artifactSha256,
      prevEventHash,
      eventHash,
      timestamp,
    };

    this.engineeringHistory.push(ev);
    this.historyHeadHash = eventHash;
    return ev;
  }

  public listEngineeringHistory(tenantId: string, projectId: string): EngineeringHistoryEvent[] {
    return this.engineeringHistory.filter((e) => e.tenantId === tenantId && e.projectId === projectId);
  }

  /**
   * Isolated Agent Scratchpad Memory: Agent A cannot overwrite or read Agent B's private scratchpad directly.
   */
  public writeAgentScratchpad(params: {
    tenantId: string;
    projectId: string;
    callerAgentId: SpecialistAgentId;
    targetAgentId: SpecialistAgentId;
    key: string;
    value: string;
    epistemicStatus?: "WORKING_HYPOTHESIS" | "VERIFIED_OBSERVATION";
  }): AgentMemoryEntry {
    if (params.callerAgentId !== params.targetAgentId) {
      throw new Error(
        `AGENT_MEMORY_ISOLATION_VIOLATION: Agent ${params.callerAgentId} cannot mutate private scratchpad of ${params.targetAgentId}.`
      );
    }

    const namespaceUri = `memory://${params.tenantId}/${params.projectId}/${params.targetAgentId}/${params.key}`;
    const entry: AgentMemoryEntry = {
      namespaceUri,
      tenantId: params.tenantId,
      projectId: params.projectId,
      agentId: params.targetAgentId,
      key: params.key,
      value: params.value,
      epistemicStatus: params.epistemicStatus ?? "WORKING_HYPOTHESIS",
      updatedAt: new Date().toISOString(),
    };
    this.agentScratchpad.set(namespaceUri, entry);
    return entry;
  }

  public readAgentScratchpad(params: {
    tenantId: string;
    projectId: string;
    callerAgentId: SpecialistAgentId;
    targetAgentId: SpecialistAgentId;
    key: string;
  }): AgentMemoryEntry | undefined {
    // Only the owning agent or AGT-19 (Independent Verification Agent) can inspect an agent's private scratchpad
    if (params.callerAgentId !== params.targetAgentId && params.callerAgentId !== "AGT-19") {
      throw new Error(
        `AGENT_MEMORY_ISOLATION_VIOLATION: Agent ${params.callerAgentId} cannot read private scratchpad of ${params.targetAgentId}.`
      );
    }
    const namespaceUri = `memory://${params.tenantId}/${params.projectId}/${params.targetAgentId}/${params.key}`;
    return this.agentScratchpad.get(namespaceUri);
  }
}
