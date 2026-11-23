# AETHER FORGE — SYSTEM COMPILER SPECIFICATION SCHEMAS (`SPECIFICATION_SCHEMAS/README.md`)

This directory contains the normative TypeScript/Zod schemas and JSON Schema (Draft 2020-12) definitions for the **AETHER FORGE System Compiler (`ARCH-04`)**.

## Schema Artifacts

1. **[compiler-schemas.ts](file:///C:/Users/blago/Desktop/AETHERFORGE/SPECIFICATION_SCHEMAS/compiler-schemas.ts)**
   - Executable Zod schemas (`zod@3.24.2`, zero `any` types) covering:
     - **6 Input Types:** `PRODUCT_DIRECTION`, `NATURAL_LANGUAGE_REQUIREMENTS`, `PROCESS_DESCRIPTION`, `EXISTING_REPOSITORY`, `TECHNICAL_DOCUMENT`, `EXISTING_SYSTEM_ARCHITECTURE`.
     - **12 Compilation Pipeline Intermediate Representations (IRs):** Intent Extraction, Requirement Extraction, Ambiguity Detection, Domain Classification, Capability Mapping, Technical Research Requests, Architecture Generation, Component Decomposition, Dependency Graph Generation, Workflow Generation, Test Specification Generation, and Acceptance Criteria Generation.
     - **4-Way Traceability Matrix:** `REQ-F/NF-XXXX ↔ COMP-XXXX ↔ TASK-XXXX ↔ TEST-XXXX ↔ AC-XXXX`.
     - **Semantic Validation Diagnostics:** Missing dependency detection, cycle detection, contradictory requirement rejection, and unsupported capability blocking.
2. **[project-specification.schema.json](file:///C:/Users/blago/Desktop/AETHERFORGE/SPECIFICATION_SCHEMAS/project-specification.schema.json)**
   - Machine-readable JSON Schema (Draft 2020-12) validating `CompiledEngineeringSpecification` bundles produced by `SYSTEM_COMPILER`.
