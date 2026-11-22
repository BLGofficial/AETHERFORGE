# ADR-0010 — Supply-Chain and Release Integrity

- **Status:** Accepted
- **Date:** 2026-11-22
- **Phase:** 00
- **Related Documents:** [GOVERNANCE.md](../../GOVERNANCE.md) · [ADR-0001](./0001-hybrid-control-plane.md) · [Threat Model](../security/threat-model.md)

## Context

AETHER FORGE distributes privileged executables—a .NET 8 Windows Worker service, a Rust audio sidecar, and a native C++20 VST3 binary—onto customer workstations, and dispatches execution manifests from the cloud control plane. A compromised binary or forged job manifest would directly threaten customer machines.

## Decision

We enforce end-to-end **supply-chain and execution integrity**:
1. **Artifact Signing & Attestation:** All release binaries (MSIX worker installer, Rust sidecar, VST3 plugin, and OPA policy bundles) must be cryptographically signed and accompanied by an SBOM (CycloneDX/SPDX) and SLSA provenance attestation.
2. **Signed Job Manifests:** Every `JobManifest` dispatched to a Windows Worker is signed by the cloud control plane and includes `planHash`, `policyVersion`, `workerId`, `canonicalPathScope`, and `expiresAt`.
3. **Worker Verification:** The Windows Worker verifies manifest signatures and revocation status locally before executing any activity.
4. **Staged Rollout & Rollback:** Releases progress through `dev → staging → production` with rehearsed rollback to the prior signed artifact version.

**Explicit Boundary Rule:** The Windows Worker refuses unsigned, tampered, expired, or revoked `JobManifest` payloads (`fail closed`). The Artifact Registry blocks publication of any release candidate missing test evidence, SBOM, signature, or Release Manager approval.

## Alternatives Considered

- **Unsigned binary builds or raw script downloads:** Rejected due to unacceptable supply-chain and remote-code-execution risk.
- **Manual ad-hoc developer uploads:** Rejected because builds are non-reproducible and lack verifiable provenance.

## Consequences

- **Positive:** Cryptographic trust chain from CI build to local workstation execution; deterministic rollback to known-good signed versions.
- **Negative / Trade-offs:** Code-signing infrastructure (cosign / Windows Authenticode), SBOM generation, and signature verification tests are mandatory release prerequisites.
