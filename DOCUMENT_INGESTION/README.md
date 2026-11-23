# AETHER FORGE — DOCUMENT & DOMAIN PACK INGESTION PIPELINE (`DOCUMENT_INGESTION/README.md`)

Ingests source documents, Obsidian Markdown notes (YAML frontmatter + `[[Wikilinks]]`), Architecture Decision Records, and JSON Domain Knowledge Packs into the **Persistent Knowledge Engine (`KNOWLEDGE_ENGINE`)** while preserving strict separation between `SOURCE_DOCUMENT`, `EXTRACTED_KNOWLEDGE`, `VERIFIED_FACT`, and `GENERATED_ARTIFACT`.

## Entry Point

- **[src/index.ts](file:///C:/Users/blago/Desktop/AETHERFORGE/DOCUMENT_INGESTION/src/index.ts)**: `KnowledgeDocumentIngestionPipeline`.
