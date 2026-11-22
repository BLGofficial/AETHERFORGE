# ADR-0006 — Provider Abstraction with Redaction and Routing

- **Status:** Accepted
- **Date:** 2026-11-22
- **Phase:** 00
- **Related Documents:** [Data Classification](../security/data-classification.md) · [Threat Model](../security/threat-model.md) · [ADR-0005](./0005-bounded-agent-roles.md)

## Context

AETHER FORGE relies on LLM providers (initially targeting OpenAI, Anthropic, Google, and an OpenAI-compatible self-hosted endpoint, subject to commercial/vendor review) while handling confidential product briefs and sensitive local workstation metadata.

## Decision

All model calls route exclusively through the cloud **Provider Gateway**:
1. The Provider Gateway normalizes requests (`ModelRequest → Result<ModelResponse>`), enforces tenant token/cost budgets, validates structured outputs against Zod schemas, and logs prompt/template versions and token audit metadata.
2. Before any payload leaves the gateway, a **Data Classification & Redaction Check** inspects the request context:
   - `SECRET_CREDENTIAL` and `RESTRICTED_LOCAL` payloads are strictly blocked from external provider egress.
   - Local paths, machine identifiers, and private project data are redacted or summarized according to tenant policy unless explicit transfer approval exists.

**Explicit Boundary Rule:** No LLM provider API key ever reaches the browser or the Windows Worker. All provider secrets reside exclusively in the cloud secret manager accessible only to the Provider Gateway.

## Alternatives Considered

- **Direct browser-to-provider or worker-to-provider calls:** Rejected because it exposes API keys on client devices and bypasses central redaction, budgeting, and audit logging.
- **Hardcoding a single LLM vendor throughout services:** Rejected due to availability risk and vendor lock-in.

## Consequences

- **Positive:** Zero client-side secret exposure; centralized cost controls, redaction enforcement, and provider failover/testing via deterministic fake adapters in CI.
- **Negative / Trade-offs:** Feature set across providers must conform to typed gateway contracts; each provider adapter requires independent contract and redaction tests.
