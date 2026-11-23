# AETHER FORGE — ARCHITECTURE REFERENCE BOOK (`ARCHITECTURE_REFERENCE_BOOK.md`)

- **Version:** `1.0.0` | **Master Index of Normative Architectural Specifications**

## 1. Core Architectural Blueprints
- **[MASTER_ARCHITECTURE.md](file:///C:/Users/blago/Desktop/AETHERFORGE/MASTER_ARCHITECTURE.md):** 11 Core Subsystems (`ARCH-01`..`ARCH-11`), 3-Plane Hybrid Architecture, Zero-Trust Boundaries (`TB-1`..`TB-4`), Data Architecture, and Scalability Strategy.
- **[MODULE_CATALOG.md](file:///C:/Users/blago/Desktop/AETHERFORGE/MODULE_CATALOG.md):** 16 Module Specifications (`MOD-01`..`MOD-16`) covering inputs, outputs, public interfaces, failure conditions, and testing requirements.
- **[SYSTEM_DIAGRAMS.md](file:///C:/Users/blago/Desktop/AETHERFORGE/SYSTEM_DIAGRAMS.md):** 5 Mermaid structural, dependency DAG, data lineage, lifecycle state machine, and real-time threading diagrams.
- **[ARCHITECTURE_DECISION_RECORDS/README.md](file:///C:/Users/blago/Desktop/AETHERFORGE/ARCHITECTURE_DECISION_RECORDS/README.md):** Normative ADR catalog (`ADR-0001`..`ADR-0012`).
- **[INTERFACE_CONTRACTS/core-contracts.md](file:///C:/Users/blago/Desktop/AETHERFORGE/INTERFACE_CONTRACTS/core-contracts.md):** Cross-module Zod, OpenAPI 3.1, CloudEvents 1.0, and C++20 ABI contracts.

## 2. Specialized Subsystem Architectures
- **Multi-Agent Architecture:** [AGENT_REGISTRY.md](file:///C:/Users/blago/Desktop/AETHERFORGE/AGENT_REGISTRY.md) (`AGT-01`..`AGT-19`), [AGENT_SPECIFICATIONS/](file:///C:/Users/blago/Desktop/AETHERFORGE/AGENT_SPECIFICATIONS/README.md), [AGENT_PROMPTS/](file:///C:/Users/blago/Desktop/AETHERFORGE/AGENT_PROMPTS/README.md), [AGENT_CONTRACTS/](file:///C:/Users/blago/Desktop/AETHERFORGE/AGENT_CONTRACTS/README.md), [AGENT_EVALUATION_FRAMEWORK.md](file:///C:/Users/blago/Desktop/AETHERFORGE/AGENT_EVALUATION_FRAMEWORK.md).
- **System Compiler:** [COMPILATION_PIPELINE.md](file:///C:/Users/blago/Desktop/AETHERFORGE/COMPILATION_PIPELINE.md) (12 stages, 6 input types, 4-way traceability).
- **Workflow & Recovery:** [EXECUTION_STATE_MACHINE.md](file:///C:/Users/blago/Desktop/AETHERFORGE/EXECUTION_STATE_MACHINE.md) & [RECOVERY_FRAMEWORK.md](file:///C:/Users/blago/Desktop/AETHERFORGE/RECOVERY_FRAMEWORK.md).
- **Audio, VST3 & Multi-DAW:** [AUDIO_DOMAIN_ARCHITECTURE.md](file:///C:/Users/blago/Desktop/AETHERFORGE/AUDIO_DOMAIN_ARCHITECTURE.md) (Three-Plane Audio Separation Law).
- **Knowledge & Memory Governance:** [KNOWLEDGE_GOVERNANCE.md](file:///C:/Users/blago/Desktop/AETHERFORGE/KNOWLEDGE_GOVERNANCE.md) (Six-Layer Epistemic Separation & Obsidian Markdown portability).
- **Quality Gates & Independent Verification:** [QUALITY_GATES.md](file:///C:/Users/blago/Desktop/AETHERFORGE/QUALITY_GATES.md) (12 QA Disciplines & Separation of Duty).
