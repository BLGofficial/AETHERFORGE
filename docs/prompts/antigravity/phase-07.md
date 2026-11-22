# Antigravity Prompt — PHASE 07: Knowledge and Evidence Substrate

Source: [AETHER-FORGE-Engineering-Blueprint-v1.0.md](../../../AETHER-FORGE-Engineering-Blueprint-v1.0.md#phase-07--knowledge-and-evidence-substrate)

```text
Implement source ingestion metadata, classification, content hash, immutable object reference, extraction version, chunk provenance, deletion propagation and retrieval response with citations. Start with local/test object-store implementation. Add pgvector only after Postgres migration exists.

Reject or quarantine unsafe/unsupported inputs according to policy. Test provenance, tenant filtering and deletion. Gate: every retrieval chunk is attributable; deleted or cross-tenant content cannot be returned.
```
