# AETHER FORGE — Security Threat Model

**Version:** 1.0.0  
**Status:** Phase 00 Baseline  
**Cross-References:** [GOVERNANCE.md](../../GOVERNANCE.md) · [Data Classification](./data-classification.md) · [ADR-0001](../adr/0001-hybrid-control-plane.md) · [ADR-0002](../adr/0002-controlled-autonomy-policy-engine.md) · [ADR-0006](../adr/0006-provider-gateway-redaction-routing.md) · [ADR-0010](../adr/0010-release-integrity.md)

---

## 1. Trust Boundaries

```text
[TB-1: Untrusted Browser Client]
       │ HTTPS (OIDC JWT + WebAuthn step-up, untrusted inputs)
       ▼
[TB-2: Cloud Control Plane (Domain API, Policy OPA, Approval, Audit)]
       │───► [TB-3: Durable Orchestration (Temporal - metadata/refs only)]
       │───► [TB-4: External LLM Providers (via Provider Gateway redaction/budget fence)]
       │
       ▲ Outbound-only mTLS (enrolled worker cert + signed JobManifest)
       │
[TB-5: Customer Windows 11 Workstation (Windows Worker .NET 8)]
       ├───► [TB-6: Constrained Local Workspace & Offline Rust Audio Engine]
       └───► [TB-7: Qualified DAW Adapter (FL Studio 2025) & Isolated VST3 Audio Thread]
```

### Trust Boundary Rules

- **TB-1 (Browser → Cloud API):** Browser is completely untrusted. No provider secrets, policy bundles, or worker capability signing keys exist in client code. All commands are schema-validated and tenant-checked before database access.
- **TB-2 / TB-3 (Cloud API ↔ Temporal):** Temporal stores workflow state and opaque references (`PlanRef`, `ApprovalId`, `EvidenceRef`). Raw local files, audio buffers, and secrets never enter Temporal history.
- **TB-2 / TB-4 (Provider Gateway → External LLMs):** External model providers are untrusted with `RESTRICTED_LOCAL` and `SECRET_CREDENTIAL` data. Outputs from LLMs are treated as untrusted user input and validated against strict Zod schemas.
- **TB-2 / TB-5 (Worker Gateway ← Windows Worker):** Outbound-only mTLS initiated by the Windows Worker. The cloud cannot open inbound connections to the customer workstation.
- **TB-5 / TB-6 & TB-7 (Windows Worker → Local OS / DAW / Audio):** The Windows Worker enforces a local deny-by-default capability boundary. It verifies the cloud signature on `JobManifest`, checks `expiresAt`, canonicalizes target paths, blocks symlinks/reparse points, and enforces child-process resource quotas.

---

## 2. STRIDE Threat & Abuse-Case Matrix

| Threat ID | Threat / Abuse Case | STRIDE | Target Boundary | Mandatory Mitigation | Verification Gate |
|---|---|---|---|---|---|
| **THR-01** | **Prompt Injection via Brief or Knowledge Chunk:** Malicious instructions in an ingested document attempt to trick the Planner into scheduling unauthorized shell commands or file exfiltration. | Tampering / Elevation of Privilege | TB-4 → TB-2 | Planner can only output typed `PlanStep` items matching registered `ToolManifest` schemas ([ADR-0005](../adr/0005-bounded-agent-roles.md)); OPA policy ([ADR-0002](../adr/0002-controlled-autonomy-policy-engine.md)) requires human approval for writes/commands/uploads regardless of model intent. | Phase 05 & Phase 11 prompt-injection abuse tests |
| **THR-02** | **Forged or Tampered `JobManifest`:** An attacker or compromised queue injects a job into the worker stream to execute arbitrary local actions. | Spoofing / Tampering | TB-2 → TB-5 | Windows Worker verifies cryptographic signature over `JobManifest` using pinned control-plane public key, checks worker enrollment ID, and rejects unsigned/tampered payloads ([ADR-0010](../adr/0010-release-integrity.md)). | Phase 06 & Phase 11 forged-job tests |
| **THR-03** | **Replayed or Stale Approval:** A previously approved `ActionGrant` is replayed after the underlying plan was modified or after the grant expired. | Spoofing / Elevation of Privilege | TB-2 → TB-5 | Approvals bind cryptographically to `planHash`, `policyVersion`, `idempotencyKey`, and `expiresAt` (INV-03). Both cloud dispatch and local worker reject mismatched hashes or expired grants. | Phase 02, 03, 06, 11 replay/stale-grant tests |
| **THR-04** | **Local Path Escape / Symlink / TOCTOU Attack:** A job attempts to write outside the granted workspace via `..\..\`, NTFS junctions, symlinks, or race conditions. | Elevation of Privilege / Tampering | TB-5 → TB-6 | Windows Worker resolves canonical paths, inspects file attributes for `ReparsePoint`, opens directories with restricted sharing handles, and writes atomically inside the verified root. | Phase 06 adversarial filesystem test suite |
| **THR-05** | **Cross-Tenant Data / Artifact Leakage:** Actor in Tenant A guesses or enumerates IDs belonging to Tenant B (specs, knowledge chunks, approvals, audit logs). | Information Disclosure | TB-1 → TB-2 | Mandatory tenant scoping on every repository query and vector search filter prior to data retrieval; cross-tenant references return `404` and log a security event. | Phase 02 & Phase 07 cross-tenant isolation tests |
| **THR-06** | **Private Asset or Secret Egress to LLM Provider:** Local private file paths, credentials, or raw unapproved project files are included in an LLM prompt. | Information Disclosure | TB-2 → TB-4 | Provider Gateway runs pre-egress classification and secret/pattern redaction ([ADR-0006](../adr/0006-provider-gateway-redaction-routing.md)); calls carrying `SECRET_CREDENTIAL` or unapproved `RESTRICTED_LOCAL` data are hard-denied. | Phase 05 egress redaction & classification tests |
| **THR-07** | **Runaway Local Execution / Unwanted DAW Mutation:** An approved workflow behaves unexpectedly or user needs immediate halt during local execution. | Denial of Service / Tampering | TB-5 → TB-7 | Hardware-fast Emergency Stop in Web UI and local Windows Worker immediately revokes grants, cancels Temporal workflows, kills child DSP processes, cleans temp files, and aborts DAW adapters ([GOVERNANCE.md §4](../../GOVERNANCE.md)). | Phase 02, 04, 06, 09 emergency-stop tests |
| **THR-08** | **Malicious or Corrupted Media / Artifact Upload:** Crafted WAV or document triggers parser memory corruption or resource exhaustion. | Denial of Service / Elevation of Privilege | TB-6 & TB-2 | Strict format header validation, size/duration quotas, memory-safe Rust audio decoders (`symphonia`), and timeout-bounded worker sandboxes. | Phase 07 & Phase 08 malformed-input tests |
| **THR-09** | **VST3 Real-Time Thread Starvation or Host Crash:** Plugin performs blocking I/O or network call inside DAW audio thread. | Denial of Service | TB-7 | Architectural separation ([ADR-0008](../adr/0008-local-audio-engine-separate-from-vst3.md)): VST3 binary contains zero network/LLM/orchestration code and is verified with `pluginval` strictness level. | Phase 10 `pluginval` & real-time allocation checks |

---

## 3. Fail-Closed Security Requirements

1. **Policy Evaluation Failure:** If the OPA bundle is unavailable, corrupted, or returns an evaluation error, the Policy Decision Point returns `deny`.
2. **Signature / Keystore Failure:** If the Windows Worker cannot access its DPAPI keystore or fails signature verification on a `JobManifest` or policy bundle, it refuses execution and enters a `QUARANTINED` state.
3. **Audit Failure:** If the Audit Service cannot durably append the required pre-execution `AuditEvent`, the mutating API or dispatch operation aborts before side effects occur.
