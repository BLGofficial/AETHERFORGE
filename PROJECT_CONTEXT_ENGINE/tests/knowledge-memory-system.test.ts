import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PersistentKnowledgeEngine, computeSha256Hex } from "../../KNOWLEDGE_ENGINE/src/index.ts";
import { PersistentMemoryEngine } from "../../MEMORY_ENGINE/src/index.ts";
import { KnowledgeDocumentIngestionPipeline } from "../../DOCUMENT_INGESTION/src/index.ts";
import { HybridKnowledgeRetrievalEngine } from "../../RETRIEVAL_ENGINE/src/index.ts";
import { ProjectContextAssemblyEngine } from "../src/index.ts";

describe("AETHER FORGE Persistent Knowledge & Memory System (ARCH-02 / ARCH-08)", () => {
  let vaultDir: string;
  let knowledgeEngine: PersistentKnowledgeEngine;
  let memoryEngine: PersistentMemoryEngine;
  let ingestion: KnowledgeDocumentIngestionPipeline;
  let retrieval: HybridKnowledgeRetrievalEngine;
  let contextAssembler: ProjectContextAssemblyEngine;

  beforeEach(() => {
    vaultDir = mkdtempSync(join(tmpdir(), "aetherforge-obsidian-vault-"));
    knowledgeEngine = new PersistentKnowledgeEngine();
    memoryEngine = new PersistentMemoryEngine(knowledgeEngine);
    ingestion = new KnowledgeDocumentIngestionPipeline(knowledgeEngine);
    retrieval = new HybridKnowledgeRetrievalEngine(knowledgeEngine);
    contextAssembler = new ProjectContextAssemblyEngine({
      knowledgeEngine,
      memoryEngine,
      retrievalEngine: retrieval,
    });
  });

  afterEach(() => {
    rmSync(vaultDir, { recursive: true, force: true });
  });

  it("separates all 6 epistemic layers, quarantines unverified GENERATED_ARTIFACT content from authoritative retrieval, and promotes only upon AGT-19 execution evidence", () => {
    const now = new Date().toISOString();

    // 1. Ingest real Domain Knowledge Pack (VERIFIED_FACT, ENGINEERING_DECISION, EXTRACTED_KNOWLEDGE)
    const packPath = resolve(process.cwd(), "DOMAIN_KNOWLEDGE_PACKS/audio-domain-knowledge-pack.json");
    const packRecords = ingestion.ingestDomainKnowledgePackFile({
      filePath: packPath,
      tenantId: "tenant-01",
      projectId: "proj-audio",
    });
    expect(packRecords.length).toBeGreaterThanOrEqual(4);

    // 2. Attempt to directly mark a GENERATED_ARTIFACT as authoritative -> MUST throw UNVERIFIED_GENERATED_CONTENT_AUTHORITY_DENIED
    expect(() =>
      knowledgeEngine.upsertRecord({
        recordId: "GEN-DRAFT-001",
        tenantId: "tenant-01",
        projectId: "proj-audio",
        layer: "GENERATED_ARTIFACT",
        scope: "PROJECT_MEMORY",
        title: "LLM Generated Unverified Biquad Claim",
        content: "Unverified generated draft claiming biquad cutoff is 99999 Hz.",
        canonicalSubject: "biquad_filter",
        canonicalPredicate: "max_cutoff_hz",
        canonicalValue: "99999",
        authorAgentId: "AGT-07",
        claimAuthoritative: true,
        sourceRef: {
          sourceUri: "workspace://drafts/gen.md",
          sourceSha256: computeSha256Hex("draft"),
          lineStart: 1,
          lineEnd: 1,
          capturedAt: now,
        },
      })
    ).toThrow(/UNVERIFIED_GENERATED_CONTENT_AUTHORITY_DENIED/);

    // 3. Insert GENERATED_ARTIFACT properly (quarantined: isAuthoritative === false)
    const quarantinedDraft = knowledgeEngine.upsertRecord({
      recordId: "GEN-DRAFT-001",
      tenantId: "tenant-01",
      projectId: "proj-audio",
      layer: "GENERATED_ARTIFACT",
      scope: "PROJECT_MEMORY",
      title: "LLM Generated Unverified Biquad Claim",
      content: "Unverified generated draft claiming biquad cutoff is 99999 Hz.",
      canonicalSubject: "biquad_filter",
      canonicalPredicate: "max_cutoff_hz",
      canonicalValue: "99999",
      authorAgentId: "AGT-07",
      sourceRef: {
        sourceUri: "workspace://drafts/gen.md",
        sourceSha256: computeSha256Hex("draft"),
        lineStart: 1,
        lineEnd: 1,
        capturedAt: now,
      },
    });
    expect(quarantinedDraft.isAuthoritative).toBe(false);

    // 4. Query retrieval engine for "biquad" -> must return authoritative DKP-DSP-001 and exclude GEN-DRAFT-001
    const hits = retrieval.retrieve({
      tenantId: "tenant-01",
      projectId: "proj-audio",
      query: "biquad filter denormal",
      authoritativeOnly: true,
    });
    expect(hits.some((h) => h.record.recordId === "DKP-DSP-001")).toBe(true);
    expect(hits.some((h) => h.record.recordId === "GEN-DRAFT-001")).toBe(false);

    // 5. Attempt to promote GEN-DRAFT-001 without AGT-19 execution evidence -> MUST fail
    expect(() =>
      knowledgeEngine.promoteToVerifiedFact({
        targetRecordId: "GEN-DRAFT-001",
        executionEvidenceRecordId: "MISSING-EVIDENCE",
        verifierAgentId: "AGT-07",
      })
    ).toThrow(/UNVERIFIED_GENERATED_CONTENT_PROMOTION_DENIED/);

    // 6. Record Layer 6 EXECUTION_EVIDENCE from AGT-19 and promote GEN-DRAFT-001 to VERIFIED_FACT (v2)
    const evidenceRec = knowledgeEngine.upsertRecord({
      recordId: "EVID-AGT19-001",
      tenantId: "tenant-01",
      projectId: "proj-audio",
      layer: "EXECUTION_EVIDENCE",
      scope: "RESEARCH_EVIDENCE",
      title: "AGT-19 Independent Verification of GEN-DRAFT-001",
      content: "Verified viaAUDIO_TEST_FRAMEWORK exitCode === 0",
      canonicalSubject: "GEN-DRAFT-001",
      canonicalPredicate: "verification_verdict",
      canonicalValue: "PASS",
      authorAgentId: "AGT-19",
      verifierAgentId: "AGT-19",
      sourceRef: {
        sourceUri: "workspace://AUDIO_TEST_FRAMEWORK",
        sourceSha256: quarantinedDraft.recordSha256,
        lineStart: 1,
        lineEnd: 1,
        capturedAt: now,
      },
    });

    const promoted = knowledgeEngine.promoteToVerifiedFact({
      targetRecordId: "GEN-DRAFT-001",
      executionEvidenceRecordId: evidenceRec.recordId,
      verifierAgentId: "AGT-19",
    });
    expect(promoted.layer).toBe("VERIFIED_FACT");
    expect(promoted.isAuthoritative).toBe(true);
    expect(promoted.version).toBe(2);
    expect(promoted.previousVersionHash).toBe(quarantinedDraft.recordSha256);
    expect(knowledgeEngine.getVersionHistory("GEN-DRAFT-001")).toHaveLength(2);
  });

  it("supports Obsidian-compatible Markdown (YAML frontmatter, [[Wikilinks]], backlinks, vault export/import) and detects authoritative knowledge conflicts", () => {
    const now = new Date().toISOString();

    // 1. Record ADR-0008 and a linked requirement note containing [[ADR-0008]]
    memoryEngine.recordAdrDecision({
      adrId: "ADR-0008",
      tenantId: "tenant-01",
      projectId: "proj-audio",
      title: "Real-Time VST3 Thread Separation",
      status: "ACCEPTED",
      decisionSummary: "Zero network or heap allocations inside IAudioProcessor::process().",
      consequences: ["Lock-free SPSC queues required"],
      governingSubsystemIds: ["ARCH-05", "ARCH-07"],
      sourceUri: "file:///C:/Users/blago/Desktop/AETHERFORGE/docs/adr/0008-realtime-vst3-separation.md",
    });

    knowledgeEngine.upsertRecord({
      recordId: "FACT-VST3-QUEUE",
      tenantId: "tenant-01",
      projectId: "proj-audio",
      layer: "VERIFIED_FACT",
      scope: "GLOBAL_TECHNICAL_KNOWLEDGE",
      title: "VST3 Atomic Parameter Queue Binding",
      content: "Implements lock-free parameter transfer governed by [[ADR-0008]] and [[DKP-VST3-001]].",
      canonicalSubject: "vst3_audio_thread",
      canonicalPredicate: "heap_allocations_allowed",
      canonicalValue: "0",
      tags: ["vst3", "realtime"],
      authorAgentId: "AGT-09",
      verifierAgentId: "AGT-19",
      sourceRef: {
        sourceUri: "file:///C:/Users/blago/Desktop/AETHERFORGE/VST3_ENGINE/src/index.ts",
        sourceSha256: computeSha256Hex("vst3"),
        lineStart: 1,
        lineEnd: 50,
        capturedAt: now,
      },
    });

    // Verify Obsidian backlink resolution: ADR-0008 should list FACT-VST3-QUEUE as a backlink
    expect(knowledgeEngine.getBacklinks("ADR-0008")).toContain("FACT-VST3-QUEUE");

    // Export ADR-0008 to Obsidian Markdown and sync vault directory
    const obsidianMd = knowledgeEngine.exportToObsidianMarkdown("ADR-0008");
    expect(obsidianMd).toContain('recordId: "ADR-0008"');
    expect(obsidianMd).toContain("AUTHORITATIVE ENGINEERING_DECISION");
    expect(obsidianMd).toContain("- [[FACT-VST3-QUEUE]]");

    const vaultFiles = knowledgeEngine.syncVaultToDirectory(vaultDir, "tenant-01");
    expect(vaultFiles.length).toBeGreaterThanOrEqual(2);
    expect(existsSync(vaultFiles[0]!)).toBe(true);

    // Re-import exported Obsidian Markdown note and verify round-trip
    const reimported = ingestion.importObsidianMarkdownNote({
      markdownNote: readFileSync(vaultFiles[0]!, "utf8"),
      sourceUri: vaultFiles[0]!,
    });
    expect(reimported.version).toBe(2);

    // 2. Test Conflict Detection: insert a conflicting VERIFIED_FACT claiming vst3_audio_thread heap_allocations_allowed = "UNLIMITED"
    knowledgeEngine.upsertRecord({
      recordId: "FACT-CONFLICTING-RT",
      tenantId: "tenant-01",
      projectId: "proj-audio",
      layer: "VERIFIED_FACT",
      scope: "PROJECT_MEMORY",
      title: "Conflicting Heap Allocation Claim",
      content: "Contradictory claim that heap allocations are unlimited on audio thread.",
      canonicalSubject: "vst3_audio_thread",
      canonicalPredicate: "heap_allocations_allowed",
      canonicalValue: "UNLIMITED",
      tags: ["conflict-test"],
      authorAgentId: "AGT-08",
      verifierAgentId: "AGT-19",
      sourceRef: {
        sourceUri: "workspace://conflict",
        sourceSha256: computeSha256Hex("conflict"),
        lineStart: 1,
        lineEnd: 1,
        capturedAt: now,
      },
    });

    const conflicts = knowledgeEngine.detectConflicts("tenant-01");
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.canonicalSubject).toBe("vst3_audio_thread");

    // Context assembly must block when unresolved authoritative conflicts exist
    expect(() =>
      contextAssembler.assembleAgentContext({
        tenantId: "tenant-01",
        projectId: "proj-audio",
        targetAgentId: "AGT-09",
        query: "vst3 parameter queue",
        failOnKnowledgeConflict: true,
      })
    ).toThrow(/KNOWLEDGE_CONFLICT_BLOCKING_CONTEXT_ASSEMBLY/);
  });

  it("enforces per-agent memory isolation and assembles token-budgeted project context packets with provenance", () => {
    // 1. Agent memory isolation: AGT-08 writes to its own scratchpad; AGT-12 cannot read or overwrite AGT-08's scratchpad
    memoryEngine.writeAgentScratchpad({
      tenantId: "tenant-01",
      projectId: "proj-audio",
      callerAgentId: "AGT-08",
      targetAgentId: "AGT-08",
      key: "simd_alignment_note",
      value: "Use 32-byte AVX2 alignment for Float64 state arrays.",
      epistemicStatus: "VERIFIED_OBSERVATION",
    });

    expect(() =>
      memoryEngine.readAgentScratchpad({
        tenantId: "tenant-01",
        projectId: "proj-audio",
        callerAgentId: "AGT-12",
        targetAgentId: "AGT-08",
        key: "simd_alignment_note",
      })
    ).toThrow(/AGENT_MEMORY_ISOLATION_VIOLATION/);

    // AGT-19 (Independent Verification Agent) IS permitted to inspect AGT-08's scratchpad
    const agt19Inspect = memoryEngine.readAgentScratchpad({
      tenantId: "tenant-01",
      projectId: "proj-audio",
      callerAgentId: "AGT-19",
      targetAgentId: "AGT-08",
      key: "simd_alignment_note",
    });
    expect(agt19Inspect?.value).toContain("AVX2");

    // 2. Ingest markdown docs (1 authoritative source doc + 1 unverified generated draft), record history, and assemble context
    ingestion.ingestMarkdownDocument({
      documentId: "DOC-ARCH-SUMMARY",
      tenantId: "tenant-01",
      projectId: "proj-audio",
      scope: "DOCUMENTATION_INDEX",
      sourceUri: "file:///C:/Users/blago/Desktop/AETHERFORGE/MASTER_ARCHITECTURE.md",
      markdownContent: "# Master Architecture\n\n## Real-Time DSP\nLock-free C++20 audio core with [[ADR-0008]].",
      authorAgentId: "AGT-01",
      isGeneratedDraft: false,
    });

    ingestion.ingestMarkdownDocument({
      documentId: "DRAFT-UNVERIFIED-IDEA",
      tenantId: "tenant-01",
      projectId: "proj-audio",
      scope: "PROJECT_MEMORY",
      sourceUri: "workspace://scratch/idea.md",
      markdownContent: "# Unverified Idea\n\nTemporary unverified draft.",
      authorAgentId: "AGT-05",
      isGeneratedDraft: true,
    });

    memoryEngine.appendEngineeringHistory({
      tenantId: "tenant-01",
      projectId: "proj-audio",
      category: "ARCHITECTURE_BASELINE",
      agentId: "AGT-01",
      summary: "Committed Master Architecture and Audio Domain subsystems",
      artifactSha256: computeSha256Hex("commit-50ed8fb"),
    });

    const packet = contextAssembler.assembleAgentContext({
      tenantId: "tenant-01",
      projectId: "proj-audio",
      targetAgentId: "AGT-08",
      query: "Real-Time DSP Lock-free C++20",
      tokenBudgetMax: 2_000,
      scratchpadKeysToInclude: ["simd_alignment_note"],
    });

    expect(packet.targetAgentId).toBe("AGT-08");
    expect(packet.estimatedTokensUsed).toBeLessThanOrEqual(2_000);
    expect(packet.unverifiedGeneratedArtifactsExcludedCount).toBeGreaterThanOrEqual(1);
    expect(packet.authoritativeRetrievalHits.every((h) => h.record.isAuthoritative)).toBe(true);
    expect(packet.agentScratchpadNotes).toHaveLength(1);
    expect(packet.recentHistory).toHaveLength(1);
    expect(packet.contextSnapshotSha256).toMatch(/^[A-F0-9]{64}$/);
  });
});
