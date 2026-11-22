# ADR-0001 — Hybrid Control Plane and Local Execution Plane

- **Status:** Accepted
- **Date:** 2026-11-22
- **Phase:** 00
- **Related Documents:** [GOVERNANCE.md](../../GOVERNANCE.md) · [REFERENCE-BOOK.md](../../REFERENCE-BOOK.md) · [Threat Model](../security/threat-model.md)

## Context

AETHER FORGE requires shared cloud governance (identity, multi-project tracking, policy evaluation, durable orchestration, audit trails, and provider routing) while also operating on private local audio assets, audio hardware, and licensed desktop applications such as FL Studio 2025 on Windows 11.

## Decision

We adopt a **hybrid architecture** consisting of:
1. **Cloud Control Plane:** Multi-tenant SaaS web UI, Domain API, Policy Decision Point, Temporal Orchestrator, Provider Gateway, Knowledge Service, Artifact Registry, and immutable Audit Service.
2. **Local Execution Plane (Windows Worker):** A signed, customer-operated .NET 8 Windows Service with a Rust sidecar for isolated offline audio/process tasks.
3. **Outbound-Only Transport:** The Windows Worker establishes an outbound mTLS connection (WebSocket/gRPC) to the cloud Worker Gateway.

**Explicit Boundary Rule:** There is **no inbound connection** from the cloud control plane to customer workstations, and **no direct cloud access** to the local filesystem, DAW process, or audio devices.

## Alternatives Considered

- **Cloud-only execution:** Rejected because cloud containers cannot legally or technically access the user's local FL Studio 2025 installation, audio interface, hardware dongles, or private multi-gigabyte stem folders without bulk upload.
- **Local-only desktop app:** Rejected because it weakens centralized policy governance, immutable audit integrity, durable orchestration across restarts, and team review workflows.
- **Inbound remote-desktop / VPN agent:** Rejected due to unacceptable attack surface on customer workstations.

## Consequences

- **Positive:** Customer retains physical and logical control over local storage, DAW sessions, and private assets; cloud plane enforces centralized policy and auditability.
- **Negative / Trade-offs:** Requires worker installer (MSIX), machine enrollment, certificate rotation, heartbeat tracking, and explicit offline queue/TTL semantics. Local actions are unavailable when the worker is disconnected or paused.
