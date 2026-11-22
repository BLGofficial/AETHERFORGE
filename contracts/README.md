# AETHER FORGE — Contracts Index (`@aether-forge/contracts`)

**Version:** 1.0.0 (Phase 00 Contract Specification Baseline)  
**Target Implementation Phase:** Phase 01  
**Cross-References:** [ADR-0004](../docs/adr/0004-typed-protocol-first.md) · [GOVERNANCE.md](../GOVERNANCE.md) · [REFERENCE-BOOK.md](../REFERENCE-BOOK.md)

> **Phase 00 Note:** Per Phase 00 rules, this file defines the concise contract index, shared envelopes, versioning policy, and directory layout. Executable TypeScript/Zod schemas and compatibility test suites are implemented in **Phase 01**.

---

## 1. Planned Directory Layout (Phase 01 Bootstrap)

```text
contracts/
  README.md                    # This contract index and compatibility policy
  generated/
    json-schema.json           # Generated JSON Schema Draft 2020-12 catalog
    openapi.json               # Generated OpenAPI 3.1.0 specification
  scripts/
    generate-schemas.ts        # Deterministic schema generator
  src/
    api/                       # REST request/response schemas & OpenAPI generators
    events/                    # CloudEvents 1.0 envelope & domain event payloads
    worker/                    # JobManifest, WorkerJob, JobReceipt, mTLS heartbeat schemas
    tools/                     # ToolManifest, bounded planner input/output schemas
    domain/                    # Core domain entities, RequestContext, Result<T>, DomainError
  tests/
    compatibility/             # Additive vs. breaking schema evolution tests & fixtures
```

---

## 2. Shared Protocol Envelopes

Every service boundary, REST endpoint, Temporal activity payload, and worker RPC uses these canonical envelopes:

```ts
export type DataClassification =
  | "PUBLIC"
  | "INTERNAL"
  | "CONFIDENTIAL"
  | "RESTRICTED_LOCAL"
  | "SECRET_CREDENTIAL";

export type RequestContext = {
  schemaVersion: "1.0.0";
  requestId: string;
  tenantId: string;
  actor: ActorRef;
  projectId?: string;
  traceId: string;
  idempotencyKey: string;
  classification: DataClassification;
};

export type Result<T> =
  | { ok: true; value: T; evidence: EvidenceRef[] }
  | { ok: false; error: DomainError; retryable: boolean };
```

---

## 3. Core Domain Contract Catalog (`contracts/src/domain`)

Every domain type includes a required `schemaVersion: string` field (Semantic Versioning `MAJOR.MINOR.PATCH`).

| Contract Type | Owning Boundary | Purpose | Key Required Fields |
|---|---|---|---|
| `Brief` | `domain` / `api` | Governed user input brief | `schemaVersion`, `briefId`, `tenantId`, `projectId`, `title`, `objective`, `constraints`, `classification` |
| `ProductSpec` | `domain` / `api` | Structured specification derived from a `Brief` | `schemaVersion`, `specId`, `briefId`, `acceptanceCriteria`, `requiredCapabilities`, `specHash` |
| `ExecutionPlan` | `domain` / `tools` | Declarative DAG of bounded steps | `schemaVersion`, `planId`, `specId`, `steps: PlanStep[]`, `planHash` (SHA-256) |
| `PlanStep` | `domain` / `tools` | Single step bound to a registered tool | `schemaVersion`, `stepId`, `toolId`, `actionClass`, `input`, `expectedOutputs`, `requiresApproval` |
| `ToolManifest` | `tools` | Registered capability definition for Planner | `schemaVersion`, `toolId`, `version`, `actionClass`, `inputSchemaRef`, `outputSchemaRef`, `maxDurationMs` |
| `CapabilityGrant` | `domain` / `worker` | Short-lived cryptographic execution grant | `schemaVersion`, `grantId`, `tenantId`, `workerId`, `planHash`, `stepId`, `actionClass`, `canonicalPathScope`, `policyVersion`, `expiresAt`, `signature` |
| `Approval` | `domain` / `api` | Human decision bound to plan & policy state | `schemaVersion`, `approvalId`, `tenantId`, `actor`, `planId`, `planHash`, `stepId`, `policyVersion`, `decision`, `expiresAt` |
| `WorkerJob` | `worker` | Signed work unit dispatched to Windows Worker | `schemaVersion`, `jobId`, `traceId`, `idempotencyKey`, `stepId`, `grant: CapabilityGrant`, `payload`, `manifestSignature` |
| `DawCommand` | `worker` / `daw-contract` | Tiered DAW adapter command | `schemaVersion`, `commandId`, `dawTarget: "fl-studio-2025"`, `capabilityTier`, `operation`, `backupRequired`, `parameters` |
| `AudioJob` | `worker` | Offline Rust audio engine job | `schemaVersion`, `audioJobId`, `operation: "inspect_wav" \| "gain_normalize"`, `inputPath`, `outputPath`, `quotas` |
| `EvidenceRef` | `domain` | Immutable proof of execution outcome | `schemaVersion`, `evidenceId`, `traceId`, `producer`, `artifactHash`, `classification`, `createdAt`, `verifiableLocation` |
| `ArtifactRef` | `domain` | Signed build or release artifact metadata | `schemaVersion`, `artifactId`, `version`, `sha256`, `signatureRef`, `sbomRef`, `provenanceRef` |
| `AuditEvent` | `domain` / `events` | Append-only governance event | `schemaVersion`, `eventId`, `timestamp`, `tenantId`, `actor`, `traceId`, `idempotencyKey`, `eventType`, `planHash?`, `policyVersion`, `payloadHash` |
| `DomainError` | `domain` | Structured error taxonomy | `schemaVersion`, `code`, `message`, `category`, `traceId`, `details?` |

---

## 4.Canonical Domain Event Names (`contracts/src/events`)

All events are wrapped in a CloudEvents 1.0 envelope (`specversion: "1.0"`, `id`, `source`, `type`, `time`, `datacontenttype: "application/json"`, `subject`, `traceparent`, `data`):

- `aetherforge.brief.submitted.v1`
- `aetherforge.spec.created.v1`
- `aetherforge.plan.proposed.v1`
- `aetherforge.policy.evaluated.v1`
- `aetherforge.approval.requested.v1`
- `aetherforge.approval.decided.v1`
- `aetherforge.workflow.started.v1`
- `aetherforge.worker.job.dispatched.v1`
- `aetherforge.worker.job.completed.v1`
- `aetherforge.evidence.recorded.v1`
- `aetherforge.system.emergency_stop.triggered.v1`

---

## 5. Contract Versioning & Compatibility Rules

1. **Zero Untyped Crossings:** Every ingress and egress point validates payloads via Zod at runtime. TypeScript `any` across process boundaries is a CI failure.
2. **Additive Changes (`MINOR` / `PATCH`):** Optional fields with safe defaults may be added without incrementing `MAJOR`, provided all existing consumer fixtures in `contracts/tests/compatibility/` pass.
3. **Breaking Changes (`MAJOR`):** Removing a required field, narrowing an input type, changing an enum value, or altering `planHash` canonical serialization requires a new major `schemaVersion` (e.g., `"2.0.0"`), an updated ADR/Reference Book entry, and dual-version support during migration.
