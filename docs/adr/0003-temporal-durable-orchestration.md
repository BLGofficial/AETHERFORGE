# ADR-0003 — Temporal for Durable Orchestration

- **Status:** Accepted
- **Date:** 2026-11-22
- **Phase:** 00
- **Related Documents:** [ADR-0001](./0001-hybrid-control-plane.md) · [ADR-0002](./0002-controlled-autonomy-policy-engine.md) · [contracts/README.md](../../contracts/README.md)

## Context

AETHER FORGE execution plans span minutes to hours, involving asynchronous human approvals, temporary Windows Worker disconnections, bounded retries, emergency stops, and compensation/rollback steps.

## Decision

We use **Temporal** (Temporal TypeScript SDK; Temporal Cloud with self-hosted compatibility) for durable workflow orchestration:
1. Workflows coordinate deterministic state transitions: plan validation → policy evaluation → approval wait (`Signal`) → worker/cloud activity dispatch → evidence verification → completion or compensation.
2. All side-effecting calls (database reads/writes, policy checks, worker dispatches, audit appends) execute inside idempotent Temporal **Activities**.

**Explicit Boundary Rule:** Temporal workflows and history payloads receive **opaque job references, hashes, and capability metadata only**—never raw local file contents, audio buffers, or provider/local credentials.

## Alternatives Considered

- **In-process memory queues:** Rejected due to state loss on process crash or deployment restart.
- **Stateless cron/database polling:** Rejected due to poor signal handling, complex timer management, and race conditions around approval expiry and cancellation.
- **Custom workflow state machine over Redis/Postgres:** Rejected due to unnecessary engineering risk reinventing replay determinism, timers, and compensation.

## Consequences

- **Positive:** Browser refreshes, API restarts, and transient worker drops do not corrupt plan execution; approval timeouts and emergency stop signals are durable and idempotent.
- **Negative / Trade-offs:** Strict determinism rules apply to workflow code; workflow changes require explicit versioning/patching discipline.
