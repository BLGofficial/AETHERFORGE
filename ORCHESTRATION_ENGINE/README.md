# AETHER FORGE — MULTI-AGENT ORCHESTRATION ENGINE (`ORCHESTRATION_ENGINE/README.md`)

Executable Multi-Agent Orchestration Coordinator bridging the **12-Stage System Compiler (`SYSTEM_COMPILER`)**, the **19-Agent Specialist Network (`AGT-01` .. `AGT-19`)**, and the **Durable Workflow Engine (`WORKFLOW_ENGINE`)**.

## Capabilities

- **Compiler-to-Workflow Lowering (`lowerCompiledSpecToWorkflowDefinition`):** Converts any valid `CompiledEngineeringSpecification` directly into an executable `WorkflowDefinition` with preconditions, budgets, fenced write globs, human approval gates, and terminal `AGT-19` verification.
- **Specialist Agent Delegation & Tool Permission Guard:** Validates that each step's `responsibleAgentId` (`AGT-01`..`AGT-19`) is authorized for the step's `requiredTools` and `actionTier`, and enforces `AGT-19` separation of duty (`authorAgentId !== "AGT-19"`).

## Entry Point

- **[src/index.ts](file:///C:/Users/blago/Desktop/AETHERFORGE/ORCHESTRATION_ENGINE/src/index.ts)**: `MultiAgentOrchestrationEngine` and `lowerCompiledSpecToWorkflowDefinition()`.
