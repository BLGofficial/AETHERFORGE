# AETHER FORGE — ENGINEERING EXECUTION RUNTIME (`ENGINEERING_RUNTIME/README.md`)

Top-level **Engineering Execution Runtime (`ARCH-05`)** enforcing strict separation between the **Planning Phase** (where agents submit declarative `PlannedToolInvocationProposal` objects) and the **Execution Phase** (where `ControlledToolGateway` validates schemas, permissions, write-lease globs, human approvals, and sandbox confinement before invoking `ControlledExecutionAdapters`).

## Core Subsystems

1. **[TOOL_GATEWAY/](file:///C:/Users/blago/Desktop/AETHERFORGE/TOOL_GATEWAY/README.md)**: Tool registry, Zod + JSON-Schema input/output validation, and non-bypassable HMAC seal verification.
2. **[EXECUTION_ADAPTERS/](file:///C:/Users/blago/Desktop/AETHERFORGE/EXECUTION_ADAPTERS/README.md)**: Sandboxed adapters for all 11 capabilities (`repo.inspect`, `file.create_or_modify`, `code.generate`, `code.review`, `git.execute`, `build.execute`, `test.execute`, `dependency.manage`, `docs.generate`, `api.integrate`, `deploy.prepare`).
3. **[PERMISSION_SYSTEM/](file:///C:/Users/blago/Desktop/AETHERFORGE/PERMISSION_SYSTEM/README.md)**: Agent allowlists, action tiers (`0..3`), fenced path-lease globs, and single-use human `ApprovalGrant` tokens (`requesterId !== approverId`).
4. **[ARTIFACT_MANAGER/](file:///C:/Users/blago/Desktop/AETHERFORGE/ARTIFACT_MANAGER/README.md)**: Content-addressable SHA-256 artifact registry and disk integrity verifier.
5. **[EXECUTION_AUDIT/](file:///C:/Users/blago/Desktop/AETHERFORGE/EXECUTION_AUDIT/README.md)**: SHA-256 hash-chained immutable execution audit log.

## Entry Points

- **[src/index.ts](file:///C:/Users/blago/Desktop/AETHERFORGE/ENGINEERING_RUNTIME/src/index.ts)**: `EngineeringExecutionRuntime`.
- **[tests/engineering-runtime.test.ts](file:///C:/Users/blago/Desktop/AETHERFORGE/ENGINEERING_RUNTIME/tests/engineering-runtime.test.ts)**: Automated Vitest verification suite.
