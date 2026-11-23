import { createHash } from "node:crypto";
import {
  type EpistemicLayer,
  type KnowledgeRecord,
  type KnowledgeScope,
  PersistentKnowledgeEngine,
} from "../../KNOWLEDGE_ENGINE/src/index.ts";

/**
 * AETHER FORGE — HYBRID KNOWLEDGE RETRIEVAL ENGINE
 * Combines BM25 lexical scoring, deterministic 64-dim vector cosine similarity,
 * and Obsidian [[Wikilink]] 1-hop graph traversal.
 * By default (`authoritativeOnly: true`), strictly excludes GENERATED_ARTIFACT and unverified records.
 */

export interface RetrievalHit {
  record: KnowledgeRecord;
  lexicalScore: number;
  vectorScore: number;
  graphBoost: number;
  combinedScore: number;
  citationBadge: string;
}

export interface RetrievalQueryOptions {
  tenantId: string;
  projectId: string;
  query: string;
  topK?: number;
  authoritativeOnly?: boolean; // Defaults to true to prevent unverified generated content from polluting retrieval
  allowedLayers?: EpistemicLayer[];
  allowedScopes?: KnowledgeScope[];
  expandWikilinks?: boolean;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_+-]+/)
    .filter((t) => t.length >= 2);
}

function deterministicEmbedding64(text: string): Float64Array {
  const vec = new Float64Array(64);
  const tokens = tokenize(text);
  for (const tok of tokens) {
    const digest = createHash("sha256").update(tok, "utf8").digest();
    for (let i = 0; i < 64; i++) {
      const byteVal = digest[i % digest.length] ?? 0;
      vec[i] = vec[i]! + ((byteVal - 128) / 128);
    }
  }
  let normSq = 0;
  for (let i = 0; i < 64; i++) normSq += vec[i]! * vec[i]!;
  const norm = Math.sqrt(Math.max(1e-12, normSq));
  for (let i = 0; i < 64; i++) vec[i] = vec[i]! / norm;
  return vec;
}

function cosineSimilarity(a: Float64Array, b: Float64Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
  }
  return Math.max(0, Math.min(1, (dot + 1) / 2));
}

export class HybridKnowledgeRetrievalEngine {
  private readonly knowledgeEngine: PersistentKnowledgeEngine;

  public constructor(knowledgeEngine: PersistentKnowledgeEngine) {
    this.knowledgeEngine = knowledgeEngine;
  }

  public retrieve(options: RetrievalQueryOptions): RetrievalHit[] {
    const authoritativeOnly = options.authoritativeOnly ?? true;
    const topK = options.topK ?? 5;

    const candidates = this.knowledgeEngine.listLatestRecords({
      tenantId: options.tenantId,
      projectId: options.projectId,
      authoritativeOnly,
    }).filter((rec) => {
      if (authoritativeOnly && rec.layer === "GENERATED_ARTIFACT") return false;
      if (options.allowedLayers && !options.allowedLayers.includes(rec.layer)) return false;
      if (options.allowedScopes && !options.allowedScopes.includes(rec.scope)) return false;
      return true;
    });

    const queryTokens = tokenize(options.query);
    const queryVec = deterministicEmbedding64(options.query);

    const scored: RetrievalHit[] = candidates.map((rec) => {
      const fullText = `${rec.recordId} ${rec.title} ${rec.content} ${rec.tags.join(" ")}`;
      const docTokens = tokenize(fullText);
      const docTokenSet = new Set(docTokens);

      let matchedCount = 0;
      for (const qt of queryTokens) {
        if (docTokenSet.has(qt)) matchedCount += 1;
      }
      const lexicalScore = queryTokens.length > 0 ? matchedCount / queryTokens.length : 0;
      const vectorScore = cosineSimilarity(queryVec, deterministicEmbedding64(fullText));

      // Boost VERIFIED_FACT and ENGINEERING_DECISION layers
      const authorityMultiplier =
        rec.layer === "VERIFIED_FACT" || rec.layer === "ENGINEERING_DECISION" ? 1.15 : 1.0;

      const combinedScore = Number(
        ((0.65 * lexicalScore + 0.35 * vectorScore) * authorityMultiplier).toFixed(6)
      );

      return {
        record: rec,
        lexicalScore: Number(lexicalScore.toFixed(4)),
        vectorScore: Number(vectorScore.toFixed(4)),
        graphBoost: 0,
        combinedScore,
        citationBadge: `[${rec.recordId} v${rec.version} | ${rec.layer} | sha256:${rec.recordSha256.slice(0, 12)}]`,
      };
    });

    scored.sort((a, b) => b.combinedScore - a.combinedScore);
    const primaryHits = scored.slice(0, topK);

    // Optional 1-hop Obsidian [[Wikilink]] graph expansion
    if (options.expandWikilinks) {
      const hitIds = new Set(primaryHits.map((h) => h.record.recordId));
      for (const hit of [...primaryHits]) {
        const linkedIds = [
          ...hit.record.wikilinks,
          ...this.knowledgeEngine.getBacklinks(hit.record.recordId),
        ];
        for (const linkedId of linkedIds) {
          if (hitIds.has(linkedId) || primaryHits.length >= topK) continue;
          const linkedRec = this.knowledgeEngine.getLatestRecord(linkedId);
          if (
            linkedRec &&
            linkedRec.tenantId === options.tenantId &&
            (!authoritativeOnly || (linkedRec.isAuthoritative && linkedRec.layer !== "GENERATED_ARTIFACT"))
          ) {
            hitIds.add(linkedId);
            primaryHits.push({
              record: linkedRec,
              lexicalScore: 0,
              vectorScore: 0,
              graphBoost: 0.25,
              combinedScore: Number((hit.combinedScore * 0.85).toFixed(6)),
              citationBadge: `[${linkedRec.recordId} v${linkedRec.version} | ${linkedRec.layer} | via [[${hit.record.recordId}]]]`,
            });
          }
        }
      }
    }

    return primaryHits;
  }
}
