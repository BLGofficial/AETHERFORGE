# Antigravity Prompt — PHASE 03: Policy-as-Code and Approvals

Source: [AETHER-FORGE-Engineering-Blueprint-v1.0.md](../../../AETHER-FORGE-Engineering-Blueprint-v1.0.md#phase-03--policy-as-code-and-approvals)

```text
Implement OPA policy integration and versioned policy bundles. Define allow, requireApproval, deny decisions for read, write, command, DAW mutation, external upload, package install and release. Bind approvals to tenant, actor, plan hash, policy version, capability scope and expiry. Default unknown action to deny.

Add decision explanation suitable for user UI without exposing sensitive rules. Test fail-closed behavior, stale approval, revoked grant and policy change. Gate: no dispatch path bypasses policy/audit/approval.
```
