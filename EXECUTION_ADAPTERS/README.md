# AETHER FORGE — CONTROLLED EXECUTION ADAPTERS (`EXECUTION_ADAPTERS/README.md`)

Concrete, sandboxed execution adapters for all **11 engineering automation capabilities**:
1. `repo.inspect`
2. `file.create_or_modify`
3. `code.generate`
4. `code.review`
5. `git.execute`
6. `build.execute`
7. `test.execute`
8. `dependency.manage`
9. `docs.generate`
10. `api.integrate`
11. `deploy.prepare`

## Non-Bypassable Gateway Enforcement

Every adapter method in `ControlledExecutionAdapters` requires a single-use cryptographic `GatewayExecutionSeal` minted exclusively by `ControlledToolGateway`. Any attempt by an LLM or external caller to invoke an adapter directly without a valid gateway seal throws `DIRECT_GATEWAY_BYPASS_FORBIDDEN`.

## Entry Point

- **[src/index.ts](file:///C:/Users/blago/Desktop/AETHERFORGE/EXECUTION_ADAPTERS/src/index.ts)**: `ControlledExecutionAdapters`.
