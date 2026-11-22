# Antigravity Prompt — PHASE 05: Provider Gateway and Bounded Planner

Source: [AETHER-FORGE-Engineering-Blueprint-v1.0.md](../../../AETHER-FORGE-Engineering-Blueprint-v1.0.md#phase-05--provider-gateway-and-bounded-planner)

```text
Implement Provider Gateway interface with fake provider plus adapters only when official credentials/docs are available. Add model routing policy, redaction/classification checks, token/cost budgets, structured-output validation, prompt/template version registry and response audit metadata. Keys remain server-side.

Implement planner that produces ExecutionPlan using registered ToolManifest entries, never direct shell/DAW calls. Build evaluation fixtures for valid, malformed, over-budget and unsafe plans. Gate: unsafe/malformed output cannot create executable job; every accepted plan validates against contract.
```
