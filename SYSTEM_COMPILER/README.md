# AETHER FORGE — SYSTEM COMPILER (`SYSTEM_COMPILER/README.md`)

Executable TypeScript implementation of the **12-Stage System Compiler (`ARCH-04`)** that transforms heterogeneous engineering inputs (`PRODUCT_DIRECTION`, `NATURAL_LANGUAGE_REQUIREMENTS`, `PROCESS_DESCRIPTION`, `EXISTING_REPOSITORY`, `TECHNICAL_DOCUMENT`, `EXISTING_SYSTEM_ARCHITECTURE`) into versioned, cryptographically hashed, machine-readable `CompiledEngineeringSpecification` bundles.

## Core Capabilities

- **12-Stage Deterministic Pipeline:** Intent Extraction → Requirement Extraction → Ambiguity Detection → Domain Classification → Capability Mapping → Technical Research Requests → Architecture Generation → Component Decomposition → Dependency Graph Generation → Workflow Generation → Test Specification Generation → Acceptance Criteria Generation.
- **Fail-Closed Semantic Validation:**
  - `REJECTED_CONTRADICTORY_REQUIREMENTS` (e.g., real-time audio callback + synchronous cloud LLM/network I/O, disjoint numeric threshold intervals, or air-gapped offline + live cloud API).
  - `REJECTED_UNSUPPORTED_CAPABILITIES` (e.g., `direct_flp_binary_mutation`, `fl_engine_memory_injection`, `kernel_ring0_driver_execution`, `autonomous_self_approval_tier3`).
  - `REJECTED_MISSING_DEPENDENCIES` (dangling requirement/component references or dependency cycles).
  - `HALTED_BLOCKING_AMBIGUITY` (unquantified subjective requirements when `failOnBlockingAmbiguity === true`).
- **4-Way Traceability Engine:** Enforces `100%` forward and backward traceability across `REQ-F/NF-XXXX ↔ COMP-XXXX ↔ TASK-XXXX ↔ TEST-XXXX ↔ AC-XXXX`.

## Entry Points

- **[src/index.ts](file:///C:/Users/blago/Desktop/AETHERFORGE/SYSTEM_COMPILER/src/index.ts)**: `AetherForgeSystemCompiler` class and `compileProjectSpecification()` helper.
- **[COMPILER_TESTS/system-compiler.test.ts](file:///C:/Users/blago/Desktop/AETHERFORGE/COMPILER_TESTS/system-compiler.test.ts)**: Automated Vitest verification suite.
