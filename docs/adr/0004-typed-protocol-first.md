# ADR-0004 — Typed Protocol First

- **Status:** Accepted
- **Date:** 2026-11-22
- **Phase:** 00
- **Related Documents:** [contracts/README.md](../../contracts/README.md) · [REFERENCE-BOOK.md](../../REFERENCE-BOOK.md)

## Context

AETHER FORGE crosses multiple language and runtime boundaries: Next.js (TypeScript), NestJS (TypeScript), Temporal (TypeScript), OPA (JSON/Rego), Windows Worker (.NET 8 / C#), Audio Engine (Rust), and DAW Adapters. Untyped payloads or duplicated schema definitions inevitably cause silent drift and security bypasses.

## Decision

All cross-boundary data structures are defined in a single versioned **`contracts/`** package:
1. Canonical schemas are authored in TypeScript using **Zod** with explicit `schemaVersion` fields.
2. JSON Schema and OpenAPI specifications are generated from `contracts/` for consumption by .NET 8, Rust, OPA, and contract test suites.
3. Every trust boundary performs **runtime validation** against the contract schema before processing data.

**Explicit Boundary Rule:** No untyped `any` or unvalidated JSON payload may cross a process, network, or tool boundary. Breaking schema changes require a major contract version increment; additive changes must pass automated backward-compatibility tests in CI.

## Alternatives Considered

- **Prose documentation contracts:** Rejected due to guaranteed drift between specification and implementation.
- **Independent per-service schema files:** Rejected due to duplication and divergent validation semantics.
- **Protobuf-only across all tiers:** Rejected because TypeScript/Zod + generated JSON Schema/OpenAPI provides superior ergonomics for web, REST, and LLM structured-output validation while still supporting strict schema generation for .NET and Rust.

## Consequences

- **Positive:** Single source of truth for REST endpoints, CloudEvents, Worker RPC manifests, and agent tool manifests; malformed payloads fail immediately at ingress.
- **Negative / Trade-offs:** Contract updates require schema generation and compatibility test passes before consumer services can change.
