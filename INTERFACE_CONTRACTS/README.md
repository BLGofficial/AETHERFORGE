# AETHER FORGE — Interface Contracts Directory

**Version:** 1.0.0  
**Date:** 2026-11-23  
**Status:** Verified Contract Specification & Schema Index (`v1.0.0`)  
**Executable Contract Package:** `@aether-forge/contracts` ([contracts/](../contracts/))  
**Generated Artifacts:** [json-schema.json](../contracts/generated/json-schema.json) · [openapi.json](../contracts/generated/openapi.json)  
**Cross-References:** [MASTER_ARCHITECTURE.md](../MASTER_ARCHITECTURE.md) · [MODULE_CATALOG.md](../MODULE_CATALOG.md) · [SYSTEM_DIAGRAMS.md](../SYSTEM_DIAGRAMS.md) · [core-contracts.md](./core-contracts.md)

---

## 1. Interface Contract Governance (`ADR-0004`)

1. **Single Executable Source of Truth:** All cross-process interfaces are authored as versioned Zod schemas (`schemaVersion: "1.0.0"`) in `contracts/src/{domain,tools,worker,events,api}/index.ts` and exported via `@aether-forge/contracts` and `@aether-forge/sdk`.
2. **Runtime Boundary Enforcement:** Every trust boundary (`Web → API`, `API → Policy`, `API → Temporal`, `Planner → Provider Gateway`, `Worker Gateway → Windows Worker`, `Windows Worker → Filesystem/Audio/FL Studio 2025`, `Artifact Registry → Release Bundle`) parses incoming and outgoing payloads at runtime using `.parse()` / `.safeParse()`.
3. **Zero Untyped Crossings:** Static CI test in [compatibility.test.ts](../contracts/tests/compatibility/compatibility.test.ts) scans `contracts/src/**/*.ts` and fails the build if any `any` or `ZodTypeAny` token is present.
4. **Compatibility Evolution Rules:**
   - **Additive (`1.x.y`):** Optional fields with safe defaults pass `SchemaVersionV1Schema` (`^1\.\d+\.\d+$`).
   - **Breaking (`2.0.0`):** Removing required fields, narrowing enums, or changing canonical `planHash` serialization is rejected by v1 readers and requires a major version bump + ADR.

---

## 2. Contract Specification Files

- [core-contracts.md](./core-contracts.md) — Formal TypeScript & JSON Schema contract definitions for all 11 architectural engines (Envelopes, Domain Entities, Policy & Approvals, Planner & Provider Gateway, Knowledge & Provenance, Worker & Adapters, CloudEvents 1.0, and OpenAPI 3.1 REST Endpoints).
- [contracts/src/domain/index.ts](../contracts/src/domain/index.ts) — Executable domain, policy, approval, knowledge, and audit Zod schemas.
- [contracts/src/tools/index.ts](../contracts/src/tools/index.ts) — Executable `ToolManifest`, `PlanningInput`, `PromptTemplateRef`, `ModelRequest`, and `ModelResponse` Zod schemas.
- [contracts/src/worker/index.ts](../contracts/src/worker/index.ts) — Executable `WorkerJob`, `JobReceipt`, `DawCommand`, and `AudioJob` Zod schemas.
- [contracts/src/events/index.ts](../contracts/src/events/index.ts) — Executable CloudEvents 1.0 envelope and 11 canonical event schemas.
- [contracts/src/api/index.ts](../contracts/src/api/index.ts) — Executable REST request/response schemas and deterministic JSON Schema Draft 2020-12 / OpenAPI 3.1.0 generators.
