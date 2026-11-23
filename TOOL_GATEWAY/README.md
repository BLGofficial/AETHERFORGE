# AETHER FORGE — CONTROLLED TOOL GATEWAY (`TOOL_GATEWAY/README.md`)

Normative Tool Registry, Input/Output Zod Schemas, and Non-Bypassable Execution Gateway (`ARCH-09`) for the 11 engineering automation capabilities.

## Architectural Guarantees

1. **Strict Planning vs. Execution Separation:** Agents in the Planning Phase can only construct declarative `PlannedToolInvocationProposal` objects. Actual execution requires routing through `ControlledToolGateway.executeProposal()`, which issues an internal HMAC/SHA-256 `GatewayExecutionSeal` verified by every adapter in `EXECUTION_ADAPTERS`. Direct adapter calls without a valid gateway seal throw `DIRECT_GATEWAY_BYPASS_FORBIDDEN`.
2. **100% Input & Output Schema Validation:** Every tool call is validated against its registered `inputSchema` before permission/sandbox checks and against its `outputSchema` before returning results or committing artifacts.

## Files

- **[src/tool-schemas.ts](file:///C:/Users/blago/Desktop/AETHERFORGE/TOOL_GATEWAY/src/tool-schemas.ts)**: Zod schemas for all 11 engineering capabilities, proposals, and 7-field error envelopes.
- **[src/tool-registry.ts](file:///C:/Users/blago/Desktop/AETHERFORGE/TOOL_GATEWAY/src/tool-registry.ts)**: `EngineeringToolRegistry` registering metadata, action tiers (`0..3`), allowed agents (`AGT-01`..`AGT-19`), and I/O schemas for all 11 tools.
- **[src/index.ts](file:///C:/Users/blago/Desktop/AETHERFORGE/TOOL_GATEWAY/src/index.ts)**: `ControlledToolGateway`.
- **[tool-schemas.json](file:///C:/Users/blago/Desktop/AETHERFORGE/TOOL_GATEWAY/tool-schemas.json)**: Machine-readable JSON Schema (Draft 2020-12) catalog of all 11 tools.
