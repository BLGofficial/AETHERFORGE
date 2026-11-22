# AETHER FORGE — System Vision

**Version:** 1.0.0  
**Date:** 2026-11-23  
**Cross-References:** [PROJECT_CHARTER.md](./PROJECT_CHARTER.md) · [SCOPE.md](./SCOPE.md) · [ENGINEERING_PRINCIPLES.md](./ENGINEERING_PRINCIPLES.md) · [REFERENCE_BOOK.md](./REFERENCE_BOOK.md)

---

## 1. Architectural Vision

AETHER FORGE bridges the gap between **high-assurance cloud systems engineering** and **sovereign local creative/native execution**. Rather than treating AI agents as unconstrained chat loops or unsafe remote-desktop macros, AETHER FORGE models autonomous product construction as a **deterministic, governed control loop**:

```text
Brief → Specification → Bounded Plan (ToolManifest DAG) → OPA Policy Decision
  → Cryptographically Bound Human Approval (planHash + policyVersion + pathScope)
  → Durable Temporal Workflow → Outbound-Connected Windows 11 Worker
  → Constrained Local Adapters (Filesystem, Git, Rust Audio DSP, FL Studio 2025)
  → Verifiable Evidence (SHA-256) + W3C OpenTelemetry Trace + Append-Only Audit Trail
  → Signed Release Candidate (CycloneDX SBOM + SLSA v1.0 Provenance + Rehearsed Rollback)
```

---

## 2. Hybrid Two-Plane Topology

### Cloud Control Plane (`apps/web`, `apps/api`, `services/*`)
- **Web Control Plane (`@aether-forge/web`):** Command and evidence surface only. Holds zero provider secrets and never connects directly to customer workstations.
- **Governed Domain API (`@aether-forge/api`):** Enforces OIDC authentication, tenant isolation **before** data reads (`404 NOT_FOUND` cross-tenant semantics), idempotency deduplication, and hardware-fast Emergency Stop (`423 Locked`).
- **Policy Decision Point (`@aether-forge/policy`):** Evaluates signed OPA Rego v1 bundles (`allow`, `requireApproval`, `deny`) with fail-closed defaults and UI-safe explanations.
- **Durable Orchestrator (`@aether-forge/orchestration`):** Temporal workflow engine managing long-running approval waits, deterministic history replay, transient activity retries, and at-most-once side-effect execution.
- **Provider Gateway & Bounded Planner (`@aether-forge/provider-gateway`):** Server-side LLM abstraction enforcing prompt-template SHA-256 verification, pre-egress credential/path redaction, tenant token/cost quotas, and `ToolManifest`-bounded plan generation.
- **Evidence-Addressable Knowledge (`@aether-forge/knowledge`):** PostgreSQL 16 metadata + immutable object storage + `pgvector` retrieval where every chunk carries mandatory provenance citations (`sourceId`, `contentHash`, `location`, `classification`, `extractionVersion`).

### Local Execution Plane (`workers/*`, `adapters/*`, `plugins/vst3`)
- **Windows Worker Host (`@aether-forge/windows-host` / .NET 8):** Outbound-only mTLS connection to cloud gateway, DPAPI-protected machine identity, constant-time `JobManifest` and `CapabilityGrant` signature verification, and immediate cancellation cleanup.
- **Constrained Filesystem & Git Adapters (`@aether-forge/filesystem`, `@aether-forge/git`):** Canonical path confinement, `lstatSync`/`realpathSync.native` NTFS junction & symlink rejection, TOCTOU prior-hash verification, and atomic `.tmp-*` rename commits.
- **Offline Audio/DSP Engine (`@aether-forge/audio-engine` / Rust):** Deterministic 16-bit linear PCM RIFF/WAVE inspection and `<0.01 dB` gain normalization to new atomic files inside granted workspaces without cloud audio upload.
- **Tier-Qualified DAW Adapter (`@aether-forge/fl-studio-2025`):** Empirically qualified against local FL Studio 2025 (`25.1.6.4997`) for read-only `.flp` (`FLhd`/`FLdt` + `0xC7` `FLP_Version`) inspection and backup-mandatory non-destructive session staging.
- **Isolated Real-Time VST3 Processor (`@aether-forge/vst3` / C++20 JUCE):** Separate native binary lifecycle with lock-free `std::atomic` parameter automation, 16-byte POD state serialization (`"AFV3"`), and zero allocations, locks, network, filesystem, or LLM calls on the real-time audio thread.
