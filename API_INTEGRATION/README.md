# AETHER FORGE — AUTHORITATIVE BACKEND API INTEGRATION (`API_INTEGRATION/README.md`)

Wires all **11 AETHER FORGE UI Workspaces** directly to the real repository execution engines:
- `AetherForgeSystemCompiler` (`SYSTEM_COMPILER`)
- `MultiAgentOrchestrationEngine` & `DurableWorkflowEngine` (`ORCHESTRATION_ENGINE` / `WORKFLOW_ENGINE`)
- `EngineeringExecutionRuntime` & `ControlledToolGateway` (`ENGINEERING_RUNTIME` / `TOOL_GATEWAY`)
- `PersistentKnowledgeEngine`, `PersistentMemoryEngine`, `KnowledgeDocumentIngestionPipeline`, & `HybridKnowledgeRetrievalEngine` (`KNOWLEDGE_ENGINE` / `MEMORY_ENGINE` / `RETRIEVAL_ENGINE`)
- `QualityAssuranceFramework` & `IndependentVerificationEngine` (`QA_FRAMEWORK` / `VERIFICATION_ENGINE`)
- `FlStudio2025DomainAdapter`, `ReaperRppDomainAdapter`, & `Vst3AudioProcessor` (`DAW_ADAPTER_FRAMEWORK` / `VST3_ENGINE`)

Every UI view and action endpoint reads and mutates authoritative backend state with cryptographic SHA-256 verification.

## Entry Point

- **[src/index.ts](file:///C:/Users/blago/Desktop/AETHERFORGE/API_INTEGRATION/src/index.ts)**: `AetherForgeApplicationController`.
