import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { SpecialistAgentIdSchema } from "../../SPECIFICATION_SCHEMAS/compiler-schemas.ts";

/**
 * AETHER FORGE — PERSISTENT KNOWLEDGE ENGINE (ARCH-02)
 * Enforces strict separation across the 6 epistemic layers:
 * 1. SOURCE_DOCUMENT
 * 2. EXTRACTED_KNOWLEDGE
 * 3. VERIFIED_FACT
 * 4. ENGINEERING_DECISION
 * 5. GENERATED_ARTIFACT (Quarantined from authoritative retrieval)
 * 6. EXECUTION_EVIDENCE
 */

export const EpistemicLayerSchema = z.enum([
  "SOURCE_DOCUMENT",
  "EXTRACTED_KNOWLEDGE",
  "VERIFIED_FACT",
  "ENGINEERING_DECISION",
  "GENERATED_ARTIFACT",
  "EXECUTION_EVIDENCE",
]);
export type EpistemicLayer = z.infer<typeof EpistemicLayerSchema>;

export const KnowledgeScopeSchema = z.enum([
  "GLOBAL_TECHNICAL_KNOWLEDGE",
  "DOMAIN_KNOWLEDGE_PACK",
  "PROJECT_MEMORY",
  "ARCHITECTURE_DECISION_RECORD",
  "ENGINEERING_HISTORY",
  "AGENT_SCRATCHPAD_MEMORY",
  "RESEARCH_EVIDENCE",
  "DOCUMENTATION_INDEX",
]);
export type KnowledgeScope = z.infer<typeof KnowledgeScopeSchema>;

export const SourceReferenceSchema = z.object({
  sourceUri: z.string().min(1),
  sourceSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  lineStart: z.number().int().positive().default(1),
  lineEnd: z.number().int().positive().default(1),
  capturedAt: z.string().datetime(),
});
export type SourceReference = z.infer<typeof SourceReferenceSchema>;

export const KnowledgeRecordSchema = z.object({
  recordId: z.string().min(1),
  tenantId: z.string().min(1),
  projectId: z.string().min(1),
  layer: EpistemicLayerSchema,
  scope: KnowledgeScopeSchema,
  version: z.number().int().positive(),
  previousVersionHash: z.string().regex(/^[A-Fa-f0-9]{64}$/).nullable(),
  supersedesRecordId: z.string().nullable().default(null),
  title: z.string().min(1),
  content: z.string().min(1),
  canonicalSubject: z.string().min(1),
  canonicalPredicate: z.string().min(1),
  canonicalValue: z.string().min(1),
  wikilinks: z.array(z.string()),
  tags: z.array(z.string()),
  authorAgentId: SpecialistAgentIdSchema,
  verifierAgentId: SpecialistAgentIdSchema.nullable(),
  executionEvidenceRecordId: z.string().nullable(),
  isAuthoritative: z.boolean(),
  sourceRef: SourceReferenceSchema,
  recordSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  createdAt: z.string().datetime(),
});
export type KnowledgeRecord = z.infer<typeof KnowledgeRecordSchema>;

export interface KnowledgeConflictDiagnostic {
  conflictId: string;
  canonicalSubject: string;
  canonicalPredicate: string;
  recordIdA: string;
  valueA: string;
  recordIdB: string;
  valueB: string;
  severity: "CRITICAL_AUTHORITY_CONFLICT" | "ADVISORY_DRIFT";
  explanation: string;
}

const GENESIS_HASH = "0".repeat(64);

export function computeSha256Hex(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex").toUpperCase();
}

export function extractObsidianWikilinks(markdownText: string): string[] {
  const matches = markdownText.matchAll(/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g);
  const links = new Set<string>();
  for (const m of matches) {
    if (m[1]) links.add(m[1].trim());
  }
  return Array.from(links);
}

export class PersistentKnowledgeEngine {
  private readonly recordsById = new Map<string, KnowledgeRecord[]>(); // Full version history per recordId
  private readonly backlinksIndex = new Map<string, Set<string>>();

  /**
   * Adds a new record or appends a new version to an existing recordId.
   * Enforces the Anti-Hallucination Authority Law:
   * - GENERATED_ARTIFACT records ALWAYS have isAuthoritative = false.
   * - Attempting to directly insert a GENERATED_ARTIFACT with isAuthoritative = true throws UNVERIFIED_GENERATED_CONTENT_AUTHORITY_DENIED.
   */
  public upsertRecord(params: {
    recordId: string;
    tenantId: string;
    projectId: string;
    layer: EpistemicLayer;
    scope: KnowledgeScope;
    title: string;
    content: string;
    canonicalSubject: string;
    canonicalPredicate: string;
    canonicalValue: string;
    tags?: string[];
    authorAgentId: z.infer<typeof SpecialistAgentIdSchema>;
    verifierAgentId?: z.infer<typeof SpecialistAgentIdSchema> | null;
    executionEvidenceRecordId?: string | null;
    supersedesRecordId?: string | null;
    claimAuthoritative?: boolean;
    sourceRef: SourceReference;
  }): KnowledgeRecord {
    // Hard gate: Generated artifacts cannot claim authoritative status directly
    if (params.layer === "GENERATED_ARTIFACT" && params.claimAuthoritative === true) {
      throw new Error(
        `UNVERIFIED_GENERATED_CONTENT_AUTHORITY_DENIED: Record '${params.recordId}' is a GENERATED_ARTIFACT and cannot be marked authoritative without independent AGT-19 execution evidence.`
      );
    }

    // Hard gate: If authorAgentId === verifierAgentId on a VERIFIED_FACT, reject self-verification
    if (
      params.layer === "VERIFIED_FACT" &&
      params.verifierAgentId &&
      params.authorAgentId === params.verifierAgentId
    ) {
      throw new Error(
        `KNOWLEDGE_SELF_VERIFICATION_FORBIDDEN: Agent ${params.authorAgentId} cannot self-verify record '${params.recordId}'.`
      );
    }

    const history = this.recordsById.get(params.recordId) ?? [];
    const latest = history.at(-1);
    const version = latest ? latest.version + 1 : 1;
    const previousVersionHash = latest ? latest.recordSha256 : null;

    const isAuthoritative =
      params.layer === "VERIFIED_FACT" ||
      params.layer === "ENGINEERING_DECISION" ||
      params.layer === "SOURCE_DOCUMENT" ||
      params.layer === "EXECUTION_EVIDENCE";

    const wikilinks = extractObsidianWikilinks(params.content);
    const createdAt = new Date().toISOString();

    const canonicalPayload = JSON.stringify({
      recordId: params.recordId,
      tenantId: params.tenantId,
      projectId: params.projectId,
      layer: params.layer,
      scope: params.scope,
      version,
      previousVersionHash,
      supersedesRecordId: params.supersedesRecordId ?? null,
      title: params.title,
      content: params.content,
      canonicalSubject: params.canonicalSubject,
      canonicalPredicate: params.canonicalPredicate,
      canonicalValue: params.canonicalValue,
      wikilinks,
      tags: params.tags ?? [],
      authorAgentId: params.authorAgentId,
      verifierAgentId: params.verifierAgentId ?? null,
      executionEvidenceRecordId: params.executionEvidenceRecordId ?? null,
      isAuthoritative,
      sourceRef: params.sourceRef,
    });

    const recordSha256 = computeSha256Hex(canonicalPayload);
    const record = KnowledgeRecordSchema.parse({
      recordId: params.recordId,
      tenantId: params.tenantId,
      projectId: params.projectId,
      layer: params.layer,
      scope: params.scope,
      version,
      previousVersionHash,
      supersedesRecordId: params.supersedesRecordId ?? null,
      title: params.title,
      content: params.content,
      canonicalSubject: params.canonicalSubject,
      canonicalPredicate: params.canonicalPredicate,
      canonicalValue: params.canonicalValue,
      wikilinks,
      tags: params.tags ?? [],
      authorAgentId: params.authorAgentId,
      verifierAgentId: params.verifierAgentId ?? null,
      executionEvidenceRecordId: params.executionEvidenceRecordId ?? null,
      isAuthoritative,
      sourceRef: params.sourceRef,
      recordSha256,
      createdAt,
    });

    history.push(record);
    this.recordsById.set(params.recordId, history);

    // Update Obsidian backlinks index
    for (const target of wikilinks) {
      const set = this.backlinksIndex.get(target) ?? new Set<string>();
      set.add(record.recordId);
      this.backlinksIndex.set(target, set);
    }

    return record;
  }

  /**
   * Controlled promotion gate: A GENERATED_ARTIFACT or EXTRACTED_KNOWLEDGE record can ONLY be promoted
   * to a VERIFIED_FACT if an EXECUTION_EVIDENCE record verified by AGT-19 exists and matches the artifact's SHA-256.
   */
  public promoteToVerifiedFact(params: {
    targetRecordId: string;
    executionEvidenceRecordId: string;
    verifierAgentId: z.infer<typeof SpecialistAgentIdSchema>;
  }): KnowledgeRecord {
    if (params.verifierAgentId !== "AGT-19") {
      throw new Error(
        `UNVERIFIED_GENERATED_CONTENT_PROMOTION_DENIED: Only AGT-19 (Independent Verification Agent) can promote '${params.targetRecordId}' to VERIFIED_FACT.`
      );
    }

    const target = this.getLatestRecord(params.targetRecordId);
    if (!target) {
      throw new Error(`KNOWLEDGE_RECORD_NOT_FOUND: ${params.targetRecordId}`);
    }

    const evidence = this.getLatestRecord(params.executionEvidenceRecordId);
    if (
      !evidence ||
      evidence.layer !== "EXECUTION_EVIDENCE" ||
      evidence.authorAgentId !== "AGT-19" ||
      evidence.canonicalValue !== "PASS"
    ) {
      throw new Error(
        `UNVERIFIED_GENERATED_CONTENT_PROMOTION_DENIED: Valid AGT-19 PASS EXECUTION_EVIDENCE record '${params.executionEvidenceRecordId}' is required.`
      );
    }

    return this.upsertRecord({
      recordId: target.recordId,
      tenantId: target.tenantId,
      projectId: target.projectId,
      layer: "VERIFIED_FACT",
      scope: target.scope,
      title: target.title,
      content: target.content,
      canonicalSubject: target.canonicalSubject,
      canonicalPredicate: target.canonicalPredicate,
      canonicalValue: target.canonicalValue,
      tags: [...new Set([...target.tags, "promoted-verified-fact"])],
      authorAgentId: target.authorAgentId,
      verifierAgentId: "AGT-19",
      executionEvidenceRecordId: evidence.recordId,
      supersedesRecordId: target.supersedesRecordId,
      sourceRef: target.sourceRef,
    });
  }

  public getLatestRecord(recordId: string): KnowledgeRecord | undefined {
    return this.recordsById.get(recordId)?.at(-1);
  }

  public getVersionHistory(recordId: string): KnowledgeRecord[] {
    return [...(this.recordsById.get(recordId) ?? [])];
  }

  public getBacklinks(targetId: string): string[] {
    return Array.from(this.backlinksIndex.get(targetId) ?? []);
  }

  public listLatestRecords(filter?: {
    tenantId?: string;
    projectId?: string;
    layer?: EpistemicLayer;
    scope?: KnowledgeScope;
    authoritativeOnly?: boolean;
  }): KnowledgeRecord[] {
    const allLatest: KnowledgeRecord[] = [];
    for (const history of this.recordsById.values()) {
      const latest = history.at(-1);
      if (latest) allLatest.push(latest);
    }

    // Identify superseded records
    const supersededIds = new Set(
      allLatest.map((r) => r.supersedesRecordId).filter((id): id is string => id !== null)
    );

    return allLatest.filter((rec) => {
      if (supersededIds.has(rec.recordId)) return false;
      if (filter?.tenantId && rec.tenantId !== filter.tenantId) return false;
      if (filter?.projectId && rec.projectId !== filter.projectId && rec.scope !== "GLOBAL_TECHNICAL_KNOWLEDGE") {
        return false;
      }
      if (filter?.layer && rec.layer !== filter.layer) return false;
      if (filter?.scope && rec.scope !== filter.scope) return false;
      if (filter?.authoritativeOnly && !rec.isAuthoritative) return false;
      return true;
    });
  }

  /**
   * Detects contradictory claims on the same (canonicalSubject, canonicalPredicate) across active authoritative records.
   */
  public detectConflicts(tenantId: string): KnowledgeConflictDiagnostic[] {
    const activeAuthoritative = this.listLatestRecords({
      tenantId,
      authoritativeOnly: true,
    });

    const conflicts: KnowledgeConflictDiagnostic[] = [];
    let counter = 0;

    for (let i = 0; i < activeAuthoritative.length; i++) {
      for (let j = i + 1; j < activeAuthoritative.length; j++) {
        const a = activeAuthoritative[i]!;
        const b = activeAuthoritative[j]!;
        if (
          a.canonicalSubject === b.canonicalSubject &&
          a.canonicalPredicate === b.canonicalPredicate &&
          a.canonicalValue !== b.canonicalValue
        ) {
          counter += 1;
          conflicts.push({
            conflictId: `KCON-${String(counter).padStart(4, "0")}`,
            canonicalSubject: a.canonicalSubject,
            canonicalPredicate: a.canonicalPredicate,
            recordIdA: a.recordId,
            valueA: a.canonicalValue,
            recordIdB: b.recordId,
            valueB: b.canonicalValue,
            severity: "CRITICAL_AUTHORITY_CONFLICT",
            explanation: `Authoritative conflict on (${a.canonicalSubject}, ${a.canonicalPredicate}): '${a.recordId}' asserts '${a.canonicalValue}' vs '${b.recordId}' asserting '${b.canonicalValue}'.`,
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Exports a KnowledgeRecord to portable Obsidian-compatible Markdown with YAML frontmatter,
   * epistemic callout banner, [[Wikilinks]], and backlinks footer.
   */
  public exportToObsidianMarkdown(recordId: string): string {
    const rec = this.getLatestRecord(recordId);
    if (!rec) {
      throw new Error(`KNOWLEDGE_RECORD_NOT_FOUND: ${recordId}`);
    }
    const backlinks = this.getBacklinks(recordId);
    const calloutType = rec.isAuthoritative ? "IMPORTANT" : "WARNING";
    const authorityBanner = rec.isAuthoritative
      ? `> [!${calloutType}] AUTHORITATIVE ${rec.layer} (v${rec.version} | SHA-256: \`${rec.recordSha256.slice(0, 16)}\`)`
      : `> [!${calloutType}] QUARANTINED ${rec.layer} — UNVERIFIED GENERATED CONTENT (Excluded from Authoritative Technical Docs)`;

    const yamlFrontmatter = [
      "---",
      `recordId: "${rec.recordId}"`,
      `tenantId: "${rec.tenantId}"`,
      `projectId: "${rec.projectId}"`,
      `layer: "${rec.layer}"`,
      `scope: "${rec.scope}"`,
      `version: ${rec.version}`,
      `previousVersionHash: "${rec.previousVersionHash ?? GENESIS_HASH}"`,
      `isAuthoritative: ${String(rec.isAuthoritative)}`,
      `authorAgentId: "${rec.authorAgentId}"`,
      `verifierAgentId: "${rec.verifierAgentId ?? "NONE"}"`,
      `canonicalSubject: "${rec.canonicalSubject}"`,
      `canonicalPredicate: "${rec.canonicalPredicate}"`,
      `canonicalValue: "${rec.canonicalValue}"`,
      `sourceUri: "${rec.sourceRef.sourceUri}"`,
      `sourceSha256: "${rec.sourceRef.sourceSha256}"`,
      `recordSha256: "${rec.recordSha256}"`,
      `tags: [${rec.tags.map((t) => `"${t}"`).join(", ")}]`,
      "---",
    ].join("\n");

    const backlinkSection =
      backlinks.length > 0
        ? ["", "## Backlinks", ...backlinks.map((b) => `- [[${b}]]`)].join("\n")
        : "";

    return [
      yamlFrontmatter,
      "",
      `# ${rec.title}`,
      "",
      authorityBanner,
      "",
      rec.content,
      backlinkSection,
      "",
    ].join("\n");
  }

  public syncVaultToDirectory(vaultRootDir: string, tenantId: string): string[] {
    const writtenFiles: string[] = [];
    const records = this.listLatestRecords({ tenantId });
    for (const rec of records) {
      const layerDir = resolve(vaultRootDir, rec.layer);
      if (!existsSync(layerDir)) {
        mkdirSync(layerDir, { recursive: true });
      }
      const filePath = resolve(layerDir, `${rec.recordId}.md`);
      writeFileSync(filePath, this.exportToObsidianMarkdown(rec.recordId), "utf8");
      writtenFiles.push(filePath);
    }
    return writtenFiles;
  }
}
