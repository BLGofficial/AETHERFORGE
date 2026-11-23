# AETHER FORGE — PROJECT CONTEXT ASSEMBLY ENGINE (`PROJECT_CONTEXT_ENGINE/README.md`)

Assembles token-budgeted, provenance-pinned, conflict-checked **Agent Context Packets (`AssembledAgentContextPacket`)** for any specialist agent (`AGT-01` .. `AGT-19`) by combining:
1. Authoritative Technical Knowledge & Domain Knowledge Packs (`VERIFIED_FACT`)
2. Active Architecture Decision Records (`ENGINEERING_DECISION`)
3. Recent Engineering History Timeline
4. The Requesting Agent's Isolated Scratchpad Memory
5. Verified Execution Evidence (`EXECUTION_EVIDENCE`)

Strictly excludes unverified `GENERATED_ARTIFACT` records and blocks context assembly if unresolved authoritative knowledge conflicts exist (`KNOWLEDGE_CONFLICT_BLOCKING_CONTEXT_ASSEMBLY`).

## Entry Points

- **[src/index.ts](file:///C:/Users/blago/Desktop/AETHERFORGE/PROJECT_CONTEXT_ENGINE/src/index.ts)**: `ProjectContextAssemblyEngine`.
- **[tests/knowledge-memory-system.test.ts](file:///C:/Users/blago/Desktop/AETHERFORGE/PROJECT_CONTEXT_ENGINE/tests/knowledge-memory-system.test.ts)**: Automated Vitest verification suite.
