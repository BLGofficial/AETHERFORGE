# Antigravity Prompt — PHASE 04: Durable Workflow and First Governed Vertical Slice

Source: [AETHER-FORGE-Engineering-Blueprint-v1.0.md](../../../AETHER-FORGE-Engineering-Blueprint-v1.0.md#phase-04--durable-workflow-and-first-governed-vertical-slice)

```text
Implement Temporal workflow and activities for: submit brief → create deterministic sample plan → policy evaluation → approval wait → simulated execution → evidence → completion. Do not call a real LLM or workstation. Preserve workflow versioning rules and idempotency.

Create web screens for brief submission, plan review, approval and evidence timeline. Use typed API only. Add Temporal restart/retry/cancellation tests and Playwright happy-path test. Gate: controlled simulated write completes once after approval and leaves complete audit trail.
```
