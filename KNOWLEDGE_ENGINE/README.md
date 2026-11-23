# AETHER FORGE — PERSISTENT KNOWLEDGE ENGINE (`KNOWLEDGE_ENGINE/README.md`)

Implements the **Six-Layer Epistemic Knowledge Store (`ARCH-02`)** with cryptographic provenance, immutable version chains, conflict detection, anti-hallucination authority quarantine (`GENERATED_ARTIFACT` vs. `VERIFIED_FACT`), and bidirectional **Obsidian-compatible Markdown** serialization.

## Core Capabilities

- **6 Epistemic Layers:** `SOURCE_DOCUMENT`, `EXTRACTED_KNOWLEDGE`, `VERIFIED_FACT`, `ENGINEERING_DECISION`, `GENERATED_ARTIFACT`, `EXECUTION_EVIDENCE`.
- **Quarantine Guard (`promoteGeneratedArtifactToVerifiedFact`):** Blocks any promotion of a `GENERATED_ARTIFACT` to `VERIFIED_FACT` unless accompanied by a matching `EXECUTION_EVIDENCE` record verified by `AGT-19` (`UNVERIFIED_GENERATED_CONTENT_PROMOTION_DENIED`).
- **Conflict Detector (`detectConflicts`):** Flags contradictory `(canonicalSubject, canonicalPredicate, canonicalValue)` triples across active authoritative records.
- **Obsidian Markdown Portability (`exportToObsidianMarkdown`, `importFromObsidianMarkdown`, ` syncToObsidianVaultDir`):** Full YAML frontmatter, `[[Wikilinks]]` graph indexing, and backlink resolution.

## Entry Point

- **[src/index.ts](file:///C:/Users/blago/Desktop/AETHERFORGE/KNOWLEDGE_ENGINE/src/index.ts)**: `PersistentKnowledgeEngine`.
