import { existsSync, readFileSync } from "node:fs";
import {
  computeSha256Hex,
  type EpistemicLayer,
  type KnowledgeRecord,
  type KnowledgeScope,
  PersistentKnowledgeEngine,
} from "../../KNOWLEDGE_ENGINE/src/index.ts";
import { type SpecialistAgentId } from "../../SPECIFICATION_SCHEMAS/compiler-schemas.ts";

/**
 * AETHER FORGE — DOCUMENT & OBSIDIAN MARKDOWN INGESTION PIPELINE
 * Separates Layer 1 (SOURCE_DOCUMENT) from Layer 2 (EXTRACTED_KNOWLEDGE)
 * and parses Obsidian YAML frontmatter, [[Wikilinks]], and JSON Domain Knowledge Packs.
 */

export interface DomainKnowledgePackJson {
  packId: string;
  version: string;
  domain: string;
  entries: Array<{
    entryId: string;
    subsystem: string;
    title: string;
    epistemicTag: "verified_facts" | "engineering_recommendations" | "unverified_assumptions";
    statement: string;
    provenance: {
      sourceUri: string;
      sha256Prefix: string;
      authority: string;
    };
  }>;
}

export class KnowledgeDocumentIngestionPipeline {
  private readonly knowledgeEngine: PersistentKnowledgeEngine;
  private docCounter = 0;

  public constructor(knowledgeEngine: PersistentKnowledgeEngine) {
    this.knowledgeEngine = knowledgeEngine;
  }

  /**
   * Ingests a raw Markdown document into Layer 1 (SOURCE_DOCUMENT) and extracts
   * heading-delimited chunks into Layer 2 (EXTRACTED_KNOWLEDGE) with exact line provenance.
   */
  public ingestMarkdownDocument(params: {
    documentId: string;
    tenantId: string;
    projectId: string;
    scope: KnowledgeScope;
    sourceUri: string;
    markdownContent: string;
    authorAgentId: SpecialistAgentId;
    isGeneratedDraft?: boolean;
  }): { sourceRecord: KnowledgeRecord; extractedRecords: KnowledgeRecord[] } {
    const sourceSha256 = computeSha256Hex(params.markdownContent);
    const lines = params.markdownContent.split(/\r?\n/);
    const capturedAt = new Date().toISOString();

    const sourceLayer: EpistemicLayer = params.isGeneratedDraft ? "GENERATED_ARTIFACT" : "SOURCE_DOCUMENT";

    const sourceRecord = this.knowledgeEngine.upsertRecord({
      recordId: params.documentId,
      tenantId: params.tenantId,
      projectId: params.projectId,
      layer: sourceLayer,
      scope: params.scope,
      title: `Source Document: ${params.documentId}`,
      content: params.markdownContent,
      canonicalSubject: params.documentId,
      canonicalPredicate: "raw_source_digest",
      canonicalValue: sourceSha256,
      tags: ["source-document", params.scope.toLowerCase()],
      authorAgentId: params.authorAgentId,
      sourceRef: {
        sourceUri: params.sourceUri,
        sourceSha256,
        lineStart: 1,
        lineEnd: Math.max(1, lines.length),
        capturedAt,
      },
    });

    // Split by Markdown H1/H2/H3 headings with line numbers
    const extractedRecords: KnowledgeRecord[] = [];
    let currentHeading = params.documentId;
    let chunkStartLine = 1;
    let chunkBuffer: string[] = [];

    const flushChunk = (endLine: number) => {
      const body = chunkBuffer.join("\n").trim();
      if (body.length === 0) return;
      this.docCounter += 1;
      const chunkId = `${params.documentId}__CHUNK_${String(this.docCounter).padStart(3, "0")}`;
      const chunkLayer: EpistemicLayer = params.isGeneratedDraft ? "GENERATED_ARTIFACT" : "EXTRACTED_KNOWLEDGE";

      const rec = this.knowledgeEngine.upsertRecord({
        recordId: chunkId,
        tenantId: params.tenantId,
        projectId: params.projectId,
        layer: chunkLayer,
        scope: params.scope,
        title: currentHeading,
        content: body,
        canonicalSubject: `${params.documentId}#${currentHeading.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
        canonicalPredicate: "section_summary",
        canonicalValue: body.slice(0, 120),
        tags: ["extracted-chunk", params.documentId],
        authorAgentId: params.authorAgentId,
        sourceRef: {
          sourceUri: params.sourceUri,
          sourceSha256,
          lineStart: chunkStartLine,
          lineEnd: Math.max(chunkStartLine, endLine),
          capturedAt,
        },
      });
      extractedRecords.push(rec);
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
      if (headingMatch) {
        flushChunk(i);
        currentHeading = headingMatch[1]!.trim();
        chunkStartLine = i + 1;
        chunkBuffer = [line];
      } else {
        chunkBuffer.push(line);
      }
    }
    flushChunk(lines.length);

    return { sourceRecord, extractedRecords };
  }

  /**
   * Imports an Obsidian-compatible Markdown note with YAML frontmatter (`--- ... ---`)
   * back into PersistentKnowledgeEngine while enforcing the GENERATED_ARTIFACT quarantine rule.
   */
  public importObsidianMarkdownNote(params: {
    markdownNote: string;
    sourceUri: string;
  }): KnowledgeRecord {
    const fmMatch = params.markdownNote.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!fmMatch) {
      throw new Error("INVALID_OBSIDIAN_FRONTMATTER: Missing YAML frontmatter block.");
    }

    const yamlText = fmMatch[1]!;
    const bodyText = fmMatch[2]!.trim();
    const fields: Record<string, string> = {};

    for (const line of yamlText.split(/\r?\n/)) {
      const kv = line.match(/^([A-Za-z0-9_]+):\s*(.+)$/);
      if (kv && kv[1] && kv[2]) {
        fields[kv[1]] = kv[2].replace(/^"(.*)"$/, "$1");
      }
    }

    const layer = (fields["layer"] ?? "EXTRACTED_KNOWLEDGE") as EpistemicLayer;
    const claimAuthoritative = fields["isAuthoritative"] === "true";

    return this.knowledgeEngine.upsertRecord({
      recordId: fields["recordId"] ?? `OBS-${Date.now()}`,
      tenantId: fields["tenantId"] ?? "default-tenant",
      projectId: fields["projectId"] ?? "default-project",
      layer,
      scope: (fields["scope"] ?? "DOCUMENTATION_INDEX") as KnowledgeScope,
      title: fields["recordId"] ?? "Obsidian Note",
      content: bodyText,
      canonicalSubject: fields["canonicalSubject"] ?? "obsidian_note",
      canonicalPredicate: fields["canonicalPredicate"] ?? "content",
      canonicalValue: fields["canonicalValue"] ?? computeSha256Hex(bodyText).slice(0, 16),
      authorAgentId: (fields["authorAgentId"] ?? "AGT-18") as SpecialistAgentId,
      verifierAgentId:
        fields["verifierAgentId"] && fields["verifierAgentId"] !== "NONE"
          ? (fields["verifierAgentId"] as SpecialistAgentId)
          : null,
      claimAuthoritative,
      sourceRef: {
        sourceUri: params.sourceUri,
        sourceSha256: computeSha256Hex(params.markdownNote),
        lineStart: 1,
        lineEnd: params.markdownNote.split(/\r?\n/).length,
        capturedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Ingests a structured JSON Domain Knowledge Pack (e.g., DOMAIN_KNOWLEDGE_PACKS/audio-domain-knowledge-pack.json),
   * routing verified_facts to VERIFIED_FACT, engineering_recommendations to ENGINEERING_DECISION,
   * and unverified_assumptions to EXTRACTED_KNOWLEDGE (non-authoritative).
   */
  public ingestDomainKnowledgePackFile(params: {
    filePath: string;
    tenantId: string;
    projectId: string;
  }): KnowledgeRecord[] {
    if (!existsSync(params.filePath)) {
      throw new Error(`DOMAIN_KNOWLEDGE_PACK_NOT_FOUND: ${params.filePath}`);
    }
    const raw = readFileSync(params.filePath, "utf8");
    const packSha256 = computeSha256Hex(raw);
    const pack = JSON.parse(raw) as DomainKnowledgePackJson;
    const ingested: KnowledgeRecord[] = [];
    const capturedAt = new Date().toISOString();

    for (const entry of pack.entries) {
      const layer: EpistemicLayer =
        entry.epistemicTag === "verified_facts"
          ? "VERIFIED_FACT"
          : entry.epistemicTag === "engineering_recommendations"
            ? "ENGINEERING_DECISION"
            : "EXTRACTED_KNOWLEDGE";

      const rec = this.knowledgeEngine.upsertRecord({
        recordId: entry.entryId,
        tenantId: params.tenantId,
        projectId: params.projectId,
        layer,
        scope: "DOMAIN_KNOWLEDGE_PACK",
        title: entry.title,
        content: `${entry.statement} (Authority: ${entry.provenance.authority} | Ref: [[${pack.packId}]])`,
        canonicalSubject: entry.entryId,
        canonicalPredicate: entry.subsystem,
        canonicalValue: entry.epistemicTag,
        tags: [pack.domain.toLowerCase(), entry.subsystem.toLowerCase(), entry.epistemicTag],
        authorAgentId: "AGT-02",
        verifierAgentId: layer === "VERIFIED_FACT" ? "AGT-19" : null,
        sourceRef: {
          sourceUri: entry.provenance.sourceUri,
          sourceSha256: packSha256,
          lineStart: 1,
          lineEnd: 1,
          capturedAt,
        },
      });
      ingested.push(rec);
    }

    return ingested;
  }
}
