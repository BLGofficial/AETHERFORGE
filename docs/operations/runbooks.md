# AETHER FORGE — Operational, Backup/Restore, and Incident Runbooks

**Version:** 1.0.0  
**Status:** Phase 11 Operational Baseline  
**Cross-References:** [GOVERNANCE.md](../../GOVERNANCE.md) · [Threat Model](../security/threat-model.md) · [Dashboards & Alerts](../../infra/monitoring/dashboards-and-alerts.json)

---

## 1. Emergency Stop & Workstation Quarantine Recovery

- **Trigger:** Operator clicks `EMERGENCY STOP` in Web Control Plane or local Windows Worker tray (`ALERT_EMERGENCY_STOP_ACTIVE`).
- **Automated System Behavior:**
  1. Target scope (`TENANT`, `PROJECT`, `WORKFLOW`, or `WORKER`) transitions immediately to `HALTED` (`HTTP 423 Locked`).
  2. All active `CapabilityGrant` tokens in scope are marked `revoked: true`.
  3. Running Temporal workflows receive cancellation signals (`CANCELLED_BY_EMERGENCY_STOP`).
  4. Windows Worker aborts active steps and deletes incomplete `.tmp-*` staging files.
- **Recovery Procedure:**
  1. Inspect correlated audit trail by `traceId` in `AppendOnlyAuditStore`.
  2. Verify local workspace integrity (confirm `.bak` backups and zero `.tmp-*` files).
  3. `Owner` (and `Worker Operator` for workstation stops) issues explicit resume command; any unexecuted plan steps require fresh approval bound to the current `planHash` and `policyVersion`.

---

## 2. Forged Manifest / Compromised Worker Identity Incident

- **Trigger:** `ALERT_FORGED_MANIFEST_DETECTED` (`DOMAIN_WORKER_MANIFEST_SIGNATURE_INVALID` or `DOMAIN_WORKER_GRANT_SIGNATURE_INVALID`).
- **Containment & Remediation:**
  1. Windows Worker automatically refuses execution (`fail closed`).
  2. Trigger `WORKER`-scoped Emergency Stop to revoke active mTLS session and outstanding grants.
  3. Rotate control-plane manifest signing key and re-enroll workstation DPAPI identity (`DpapiBackedIdentityStore.clear()` → `enrollAndConnect`).

---

## 3. Backup and Restore Runbook (Postgres, Object Store, Local Workspace)

- **Cloud Metadata (PostgreSQL 16 + `pgvector`):**
  - Continuous WAL archiving + daily encrypted snapshot (`RPO <= 15m`, `RTO <= 1h`).
  - Restore: provision clean Postgres 16 instance, apply snapshot + WAL replay, run `0001_knowledge_pgvector.sql` schema verification, and verify `audit_events` hash chain.
- **Immutable Object Store (Knowledge & Artifacts):**
  - Object versioning and bucket lock enabled (`s3://aetherforge-knowledge/`, `s3://aetherforge-artifacts/`).
  - Restore: verify object SHA-256 against canonical Postgres `content_hash` / `ArtifactRef.sha256`.
- **Local Windows Workstation (`.flp` & Audio Stems):**
  - Source audio files are never overwritten (`DOMAIN_AUDIO_OVERWRITE_SOURCE_FORBIDDEN`).
  - Pre-mutation `.flp` backups (`backups/*.bak`) are verified by SHA-256 prior to any `non_destructive_edit` staging.

---

## 4. Staged Rollout & Signed Artifact Rollback

- **Trigger:** Release candidate regression or `ALERT_ARTIFACT_TAMPER_DETECTED` (`DOMAIN_ARTIFACT_TAMPERED_OR_UNSIGNED`).
- **Procedure:**
  1. `Release Manager` calls `SignedArtifactRegistry.revokeArtifactVersion(artifactId, faultyVersion)`.
  2. Call `SignedArtifactRegistry.selectRollbackTarget(artifactId, faultyVersion, traceId)` to select the most recent non-revoked, signature-verified prior version.
  3. Verify rollback target SHA-256, CycloneDX SBOM digest, and SLSA v1.0 provenance attestation before redeploying across `staging → production`.

---

## 5. LLM Provider Outage & Failover

- **Trigger:** `ALERT_PROVIDER_OUTAGE` (upstream provider timeout/5xx).
- **Procedure:**
  1. `ProviderGatewayService` fails closed on malformed/incomplete outputs (`DOMAIN_PLANNER_MALFORMED_OUTPUT`) so partial model responses never create executable plans.
  2. Route tenant traffic to secondary approved provider adapter or self-hosted endpoint via `ProviderGatewayService.setDefaultProvider(...)` while preserving identical pre-egress redaction and budget fences.
