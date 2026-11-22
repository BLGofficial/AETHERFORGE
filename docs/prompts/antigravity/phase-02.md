# Antigravity Prompt — PHASE 02: Identity, Tenancy, Governance Enforcement

Source: [AETHER-FORGE-Engineering-Blueprint-v1.0.md](../../../AETHER-FORGE-Engineering-Blueprint-v1.0.md#phase-02--identity-tenancy-governance-enforcement)

```text
Read contracts and governance. Implement minimal web/API identity boundary: OIDC integration seam, tenant/project membership authorization, role checks, correlation/idempotency middleware, audit event creation, action taxonomy and approval state machine. Use test doubles/configuration seams rather than provisioning a real identity provider without credentials.

Enforce tenant isolation before data access. Implement emergency stop that blocks new dispatch and signals cancellable workflows. Add authorization, idempotency, expiry and audit tests. Do not implement agents or workers yet. Gate: security tests prove cross-tenant denial and changed-plan approval invalidation.
```
