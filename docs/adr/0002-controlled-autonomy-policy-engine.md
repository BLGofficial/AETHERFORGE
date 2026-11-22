# ADR-0002 — Controlled Autonomy as a Policy Engine, Not Prompt Wording

- **Status:** Accepted
- **Date:** 2026-11-22
- **Phase:** 00
- **Related Documents:** [GOVERNANCE.md](../../GOVERNANCE.md) · [ADR-0005](./0005-bounded-agent-roles.md) · [Threat Model](../security/threat-model.md)

## Context

LLM outputs and agent plans are probabilistic and susceptible to prompt injection or hallucination. Relying on system-prompt instructions ("please ask the user before deleting files") is not a valid security boundary.

## Decision

Controlled autonomy is enforced deterministically through **action classes** and **policy-as-code (Open Policy Agent / Rego)**:
1. Every proposed plan step and tool invocation is mapped to a typed `ActionClass`.
2. The Policy Decision Point evaluates `PolicyInput` against signed, versioned OPA bundles and returns a deterministic `Decision`: `allow`, `requireApproval`, or `deny`.
3. Any unrecognized action class or malformed policy input fails closed (`deny`).
4. Both the cloud Worker Gateway and the local Windows Worker verify the policy decision and cryptographic approval binding (`planHash` + `policyVersion`) before execution.

**Explicit Boundary Rule:** By default, all file writes, bounded commands, DAW mutations/renders, package installs, external uploads, and releases require explicit human approval (`requireApproval`). Reads are allowlisted and tenant-scoped. Models and agents can never self-approve.

## Alternatives Considered

- **Blanket full autonomy:** Rejected as unsafe for local filesystems, DAW projects, and production releases.
- **Manual approval for every read operation:** Rejected due to severe approval fatigue that degrades operator vigilance.
- **Prompt-enforced or model-judged approval:** Rejected because an untrusted model cannot serve as its own authorization boundary.

## Consequences

- **Positive:** Predictable, auditable authorization; prompt injection cannot bypass OPA policy or forge a signed `CapabilityGrant`.
- **Negative / Trade-offs:** High-impact steps pause workflow execution waiting for human approval; every decision must record and verify `policyVersion`.
