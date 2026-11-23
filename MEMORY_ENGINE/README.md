# AETHER FORGE — PERSISTENT PROJECT & AGENT MEMORY ENGINE (`MEMORY_ENGINE/README.md`)

Manages structured **Project Memory**, **Architecture Decision Record (ADR) Memory**, **Engineering History Timeline**, and isolated per-agent **Agent Scratchpad Memory (`AGT-01` .. `AGT-19`)** (`ARCH-08`).

## Capabilities

- **Project-Specific Memory:** Stores versioned project state, active invariants, and environment constraints per `(tenantId, projectId)`.
- **ADR Lifecycle Memory:** Tracks `ADR-0001..0012` decisions, supersession chains, and governing subsystem bindings.
- **Engineering History Ledger:** Hash-chained chronological timeline of architectural milestones, workflow executions, and release promotions.
- **Isolated Agent Memory:** Scoped namespace `memory://<tenantId>/<projectId>/<agentId>/<key>` preventing cross-agent memory contamination.

## Entry Point

- **[src/index.ts](file:///C:/Users/blago/Desktop/AETHERFORGE/MEMORY_ENGINE/src/index.ts)**: `PersistentMemoryEngine`.
