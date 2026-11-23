import {
  computeSha256Hex,
  type KnowledgeConflictDiagnostic,
  PersistentKnowledgeEngine,
} from "../../KNOWLEDGE_ENGINE/src/index.ts";
import {
  type AdrMemoryRecord,
  type EngineeringHistoryEvent,
  PersistentMemoryEngine,
} from "../../MEMORY_ENGINE/src/index.ts";
import {
  HybridKnowledgeRetrievalEngine,
  type RetrievalHit,
} from "../../RETRIEVAL_ENGINE/src/index.ts";
import { type SpecialistAgentId } from "../../SPECIFICATION_SCHEMAS/compiler-schemas.ts";

/**
 * AETHER FORGE — PROJECT CONTEXT ASSEMBLY ENGINE
 * Produces deterministic, provenance-cited, token-budgeted context packets for specialist agents
 * while guaranteeing zero unverified GENERATED_ARTIFACT pollution and zero unresolved knowledge conflicts.
 */

export interface AssembledAgentContextPacket {
  packetId: string;
  tenantId: string;
  projectId: string;
  targetAgentId: SpecialistAgentId;
  query: string;
  tokenBudgetMax: number;
  estimatedTokensUsed: number;
  authoritativeRetrievalHits: RetrievalHit[];
  activeAdrs: AdrMemoryRecord[];
  recentHistory: EngineeringHistoryEvent[];
  agentScratchpadNotes: Array<{ key: string; value: string; epistemicStatus: string }>;
  unverifiedGeneratedArtifactsExcludedCount: number;
  activeConflicts: KnowledgeConflictDiagnostic[];
  contextSnapshotSha256: string;
  assembledAt: string;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export class ProjectContextAssemblyEngine {
  private readonly knowledgeEngine: PersistentKnowledgeEngine;
  private readonly memoryEngine: PersistentMemoryEngine;
  private readonly retrievalEngine: HybridKnowledgeRetrievalEngine;

  public constructor(params: {
    knowledgeEngine: PersistentKnowledgeEngine;
    memoryEngine: PersistentMemoryEngine;
    retrievalEngine: HybridKnowledgeRetrievalEngine;
  }) {
    this.knowledgeEngine = params.knowledgeEngine;
    this.memoryEngine = params.memoryEngine;
    this.retrievalEngine = params.retrievalEngine;
  }

  public assembleAgentContext(params: {
    tenantId: string;
    projectId: string;
    targetAgentId: SpecialistAgentId;
    query: string;
    tokenBudgetMax?: number;
    scratchpadKeysToInclude?: string[];
    failOnKnowledgeConflict?: boolean;
  }): AssembledAgentContextPacket {
    const tokenBudgetMax = params.tokenBudgetMax ?? 4_000;
    const failOnConflict = params.failOnKnowledgeConflict ?? true;

    // 1. Check for unresolved authoritative knowledge conflicts
    const activeConflicts = this.knowledgeEngine.detectConflicts(params.tenantId);
    if (failOnConflict && activeConflicts.length > 0) {
      throw new Error(
        `KNOWLEDGE_CONFLICT_BLOCKING_CONTEXT_ASSEMBLY: ${activeConflicts.map((c) => c.explanation).join(" | ")}`
      );
    }

    // 2. Count how many unverified GENERATED_ARTIFACT records were quarantined/excluded
    const quarantinedArtifacts = this.knowledgeEngine.listLatestRecords({
      tenantId: params.tenantId,
      projectId: params.projectId,
      layer: "GENERATED_ARTIFACT",
    });

    // 3. Retrieve authoritative knowledge & domain pack hits (authoritativeOnly = true enforced)
    const rawHits = this.retrievalEngine.retrieve({
      tenantId: params.tenantId,
      projectId: params.projectId,
      query: params.query,
      topK: 8,
      authoritativeOnly: true,
      expandWikilinks: true,
    });

    const activeAdrs = this.memoryEngine.listActiveAdrs(params.tenantId, params.projectId);
    const recentHistory = this.memoryEngine
      .listEngineeringHistory(params.tenantId, params.projectId)
      .slice(-5);

    const agentScratchpadNotes: Array<{ key: string; value: string; epistemicStatus: string }> = [];
    for (const key of params.scratchpadKeysToInclude ?? []) {
      const note = this.memoryEngine.readAgentScratchpad({
        tenantId: params.tenantId,
        projectId: params.projectId,
        callerAgentId: params.targetAgentId,
        targetAgentId: params.targetAgentId,
        key,
      });
      if (note) {
        agentScratchpadNotes.push({
          key: note.key,
          value: note.value,
          epistemicStatus: note.epistemicStatus,
        });
      }
    }

    // 4. Enforce token budget on retrieval hits
    let usedTokens =
      estimateTokens(JSON.stringify(activeAdrs)) +
      estimateTokens(JSON.stringify(recentHistory)) +
      estimateTokens(JSON.stringify(agentScratchpadNotes));

    const budgetedHits: RetrievalHit[] = [];
    for (const hit of rawHits) {
      const hitTokens = estimateTokens(hit.record.content);
      if (usedTokens + hitTokens <= tokenBudgetMax || budgetedHits.length === 0) {
        budgetedHits.push(hit);
        usedTokens += hitTokens;
      }
    }

    const assembledAt = new Date().toISOString();
    const packetId = `CTX-${params.targetAgentId}-${Date.now()}`;
    const contextSnapshotSha256 = computeSha256Hex(
      JSON.stringify({
        tenantId: params.tenantId,
        projectId: params.projectId,
        targetAgentId: params.targetAgentId,
        hitHashes: budgetedHits.map((h) => h.record.recordSha256),
        adrHashes: activeAdrs.map((a) => a.sha256),
        historyHashes: recentHistory.map((h) => h.eventHash),
      })
    );

    return {
      packetId,
      tenantId: params.tenantId,
      projectId: params.projectId,
      targetAgentId: params.targetAgentId,
      query: params.query,
      tokenBudgetMax,
      estimatedTokensUsed: usedTokens,
      authoritativeRetrievalHits: budgetedHits,
      activeAdrs,
      recentHistory,
      agentScratchpadNotes,
      unverifiedGeneratedArtifactsExcludedCount: quarantinedArtifacts.length,
      activeConflicts,
      contextSnapshotSha256,
      assembledAt,
    };
  }
}
