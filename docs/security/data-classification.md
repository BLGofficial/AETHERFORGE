# AETHER FORGE — Data Classification & Handling Policy

**Version:** 1.0.0  
**Status:** Phase 00 Baseline  
**Cross-References:** [GOVERNANCE.md](../../GOVERNANCE.md) · [Threat Model](./threat-model.md) · [ADR-0006](../adr/0006-provider-gateway-redaction-routing.md) · [ADR-0007](../adr/0007-evidence-addressable-knowledge.md)

---

## 1. Data Classification Tiers

Every `RequestContext`, `Brief`, `KnowledgeSource`, `WorkerJob`, `EvidenceRef`, and `ModelRequest` carries an explicit `DataClassification` enum value. Unclassified data defaults to **`RESTRICTED_LOCAL`** on the worker and **`CONFIDENTIAL`** in the cloud control plane (fail-safe high classification).

| Classification | Definition | Examples | Storage & Encryption Rule | External LLM Provider Egress Rule |
|---|---|---|---|---|
| `PUBLIC` | Explicitly approved public documentation or open specifications | Public SDK docs, open-source contract schemas, published public marketing briefs | Standard TLS in transit; encrypted at rest; immutable hash recorded | Permitted via Provider Gateway with audit logging |
| `INTERNAL` | Operational system telemetry and non-sensitive workflow metadata | Generic service metrics, schema version registries, anonymized latency traces | Tenant-tagged where applicable; encrypted at rest | Permitted via Provider Gateway within tenant budget |
| `CONFIDENTIAL` | Customer intellectual property managed in the cloud control plane | Product briefs, generated `ProductSpec`, `ExecutionPlan`, source code diffs, audit logs | Strict tenant-isolated Postgres rows & S3 prefixes; envelope encryption at rest | Permitted **only** to tenant-approved providers after automated secret/PII redaction check |
| `RESTRICTED_LOCAL` | Private workstation assets that must remain on the customer's Windows machine by default | Local `.flp` DAW project files, private multi-track WAV stems, local filesystem paths outside workspace, hardware device identifiers | Remains on customer disk; only SHA-256 hashes, structural summaries, and bounded `EvidenceRef` metadata sync to cloud | **Denied by default.** Summarized/redacted transfer requires explicit `external_upload` policy allowance and `Owner` approval |
| `SECRET_CREDENTIAL` | Authentication tokens, private keys, API keys, and signing material | LLM provider API keys, worker mTLS private keys, OIDC client secrets, signing certificates | Cloud Secret Manager or Windows DPAPI/Credential Manager only; **never** written to Postgres, logs, Temporal history, or artifacts | **Strictly Denied (`deny`).** Never transmitted to any model, browser, or log stream |

---

## 2. Redaction & Egress Rules (Provider Gateway & Worker Boundary)

1. **Pre-Egress Redaction Fence ([ADR-0006](../adr/0006-provider-gateway-redaction-routing.md)):**
   - Before any `ModelRequest` is dispatched to an external provider, the Provider Gateway scans all prompt segments and context chunks for:
     - High-entropy secret patterns and credential headers (API keys, bearer tokens, private key blocks).
     - Windows local user profile paths (`C:\Users\<username>\...` normalized to `<WORKSPACE_ROOT>/...`).
     - Any chunk tagged `SECRET_CREDENTIAL` or unapproved `RESTRICTED_LOCAL`.
   - If a prohibited classification or unredacted credential is detected, the gateway aborts the call, returns `DOMAIN_EGRESS_POLICY_DENIED`, and emits a high-priority security `AuditEvent`.
2. **Local-to-Cloud Evidence Minimality ([ADR-0001](../adr/0001-hybrid-control-plane.md), [ADR-0008](../adr/0008-local-audio-engine-separate-from-vst3.md)):**
   - When the Windows Worker completes a local filesystem, audio DSP, or DAW job, it returns structured metadata (`EvidenceRef`: file SHA-256 hash, sample rate, duration, peak/LUFS metrics, backup hash, exit status) rather than uploading raw private audio files or `.flp` sessions unless an explicit `external_upload` step was approved.

---

## 3. Retention, Deletion Propagation, and Provenance

| Data Category | Default Retention | Deletion & Revocation Behavior |
|---|---|---|
| Immutable `AuditEvent` & `Approval` Records | 365 days minimum (append-only) | Retained for compliance/forensics; tenant offboarding follows legal hold/crypto-shredding policy |
| Knowledge Sources & Vector Chunks ([ADR-0007](../adr/0007-evidence-addressable-knowledge.md)) | Active project lifetime | Deleting a source marks a transactional tombstone in Postgres, purges the S3 object, and synchronously removes all linked `pgvector` embeddings so subsequent queries return zero chunks from that source |
| Windows Worker Staging / Temp Files (`.tmp-*`) | Duration of active job step only | Deleted immediately upon atomic commit, job failure, or Emergency Stop |
| Pre-Mutation DAW / Workspace Backups | Configurable local retention (default: last 10 snapshots or 30 days on local disk) | Managed locally by `Worker Operator`; never deleted automatically by remote cloud commands without explicit approval |
| Signed Release Artifacts & SBOMs | Retained across supported release lifecycle | Immutable once published; revoked artifacts are flagged `REVOKED` in Artifact Registry to block download/execution |
