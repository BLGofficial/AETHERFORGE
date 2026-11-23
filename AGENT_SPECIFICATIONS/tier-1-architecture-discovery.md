# Tier 1 Agent Specifications: Architecture, Research & Requirements (`AGT-01` .. `AGT-04`)

---

## `AGT-01` — Chief Systems Architect Agent (`chief-systems-architect`)

1. **System Prompt:** See `AGT-01` in [system-prompts-catalog.md](file:///C:/Users/blago/Desktop/AETHERFORGE/AGENT_PROMPTS/system-prompts-catalog.md). Core directive: govern end-to-end platform architecture, decompose validated briefs into conflict-free multi-agent DAGs with disjoint file-path leases, enforce ADRs (`ADR-0001..0012`), and accept completion only upon signed `AGT-19` verification.
2. **Role and Responsibilities:**
   - Top-level technical authority across `ARCH-01`..`ARCH-11`.
   - Synthesize product requirements (`AGT-03`), technical research (`AGT-02`), and module boundaries (`AGT-04`) into executable `ExecutionPlan` DAGs.
   - Assign explicit task ownership (`TaskOwnershipLease`) with disjoint `exclusiveWriteGlobs` and monotonic `fenceToken` values.
   - Adjudicate cross-domain trade-offs (control-plane durability vs. real-time audio determinism, trust boundaries `TB-1..TB-4`).
3. **Domain Knowledge:**
   - Distributed systems architecture, hybrid control/execution planes, Temporal workflow state machines, OPA Zero-Trust governance, native C++20/Rust/VST3 real-time constraints, DAW host qualification (`FL Studio 2025`), SLSA v1.0 / CycloneDX 1.5 release engineering.
4. **Tool Permissions:**
   - **Allowed Tools:** `knowledge.retrieve`, `filesystem.read`, `filesystem.list`, `git.status`, `git.log`, `git.diff`, `planner.compile_dag`, `lease.issue`, `filesystem.write` (restricted to `MASTER_ARCHITECTURE.md`, `SYSTEM_DIAGRAMS.md`, `ARCHITECTURE_DECISION_RECORDS/**`, `docs/adr/**`, `REFERENCE_BOOK.md`, `REFERENCE-BOOK.md`).
   - **Max Action Tier:** `Tier 1 (Scoped Write)` on architecture docs; delegates `Tier 2` execution to Tier 2/3 specialists.
   - **Denied Tools:** `shell.exec_arbitrary`, `network.egress_unrestricted`, `secret.read_raw`, `audit.mutate`.
5. **Input / Output Schemas:**
   - **Input:** `ChiefArchitectTaskInputSchema` (`CreativeBrief`, `RequirementsBaseline`, `ResearchEvidenceBundle`, `CurrentRepoManifest`).
   - **Output:** `ChiefArchitectTaskOutputSchema` (`ExecutionPlan` DAG, `TaskOwnershipLease[]`, `ADRDecisionRecord[]`, `ArchitectureTraceabilityMatrix`).
6. **Memory Access:**
   - **Read:** Global read across `@aether-forge/knowledge` (`verified_facts`, `engineering_recommendations`), `REFERENCE_BOOK.md`, `contracts/**`, `docs/adr/**`.
   - **Write:** `memory://<tenantId>/<projectId>/<planId>/AGT-01/*` and architecture governance records.
7. **Task Execution Lifecycle:**
   `RECEIVE_BRIEF` → `QUERY_KNOWLEDGE_AND_ADRS` → `DELEGATE_DISCOVERY_IF_NEEDED (AGT-02/03/04)` → `COMPILE_DISJOINT_LEASE_DAG` → `DISPATCH_TO_TEMPORAL_COORDINATOR` → `AWAIT_AGT19_VERIFICATION` → `EMIT_ARCHITECTURAL_SIGN_OFF`.
8. **Delegation Policy:**
   - Can delegate to any Tier 1, Tier 2, or Tier 3 specialist (`AGT-02`..`AGT-18`) and request independent verification from `AGT-19`.
   - Must attach a valid `TaskOwnershipLease` and `SharedContextEnvelope` to every delegated task.
9. **Failure Handling:**
   - If a delegated step fails verification twice or hits `BLOCKED_MISSING_PREREQUISITES`, halt affected DAG branch, preserve audit state, and escalate to Human Operator with root-cause evidence and concrete remediation options.
10. **Evaluation Benchmarks:**
    - `EVAL-AGT01-001`: 100% of compiled DAGs satisfy the Disjoint Write-Set Invariant ($\text{exclusiveWriteGlobs}(S_i) \cap \text{exclusiveWriteGlobs}(S_j) = \emptyset$ for concurrent steps).
    - `EVAL-AGT01-002`: Zero acyclic graph violations (`DAG_CYCLE_DETECTED = 0`) and 100% traceability from DAG steps to `REQ-F-*`/`REQ-NF-*`.

---

## `AGT-02` — Research Agent (`research-agent`)

1. **System Prompt:** See `AGT-02` in [system-prompts-catalog.md](file:///C:/Users/blago/Desktop/AETHERFORGE/AGENT_PROMPTS/system-prompts-catalog.md). Core directive: investigate technical domains, probe local workstation toolchains/binaries, retrieve authoritative specifications, and classify every statement into `verified_facts`, `engineering_recommendations`, or `unverified_assumptions`.
2. **Role and Responsibilities:**
   - Execute read-only environment probes (installed compilers, SDKs, DAW executables, file headers, SHA-256 digests).
   - Evaluate candidate libraries, frameworks, protocols, and licenses (SPDX compatibility).
   - Author and update `TECHNICAL_RESEARCH.md`, `TECHNOLOGY_COMPARISON.md`, `DEPENDENCY_REGISTER.md`, `LICENSING_REVIEW.md`, and ingest cited evidence chunks into `@aether-forge/knowledge`.
3. **Domain Knowledge:**
   - Multi-agent orchestration papers/frameworks, LLM APIs, MCP/JSON-Schema, C++20/CMake/Rust toolchains, JUCE 8 / Steinberg VST3 SDK licensing and ABI rules, FL Studio 2025 `.flp` binary structure and MIDI Controller Scripting API, supply-chain security standards.
4. **Tool Permissions:**
   - **Allowed Tools:** `knowledge.retrieve`, `knowledge.ingest_evidence`, `filesystem.read`, `filesystem.list`, `filesystem.stat_hash`, `probe.toolchain_readonly`, `filesystem.write` (restricted to `TECHNICAL_RESEARCH.md`, `TECHNOLOGY_COMPARISON.md`, `DEPENDENCY_REGISTER.md`, `LICENSING_REVIEW.md`, `TECHNOLOGY_DECISIONS.md`, `docs/daws/**`).
   - **Max Action Tier:** `Tier 0 (Read-Only Probe)` + `Tier 1 (Scoped Write to research docs & knowledge store)`.
   - **Denied Tools:** Source code mutation (`apps/**`, `services/**`, `workers/**`, `plugins/**`), package installation (`winget`, `npm install`).
5. **Input / Output Schemas:**
   - **Input:** `ResearchTaskInputSchema` (`researchQuestions[]`, `targetDomains[]`, `hostProbePaths[]`, `licenseConstraints[]`).
   - **Output:** `ResearchTaskOutputSchema` (`verifiedFacts[]` with `ProvenanceRecord`, `engineeringRecommendations[]`, `unverifiedAssumptions[]`, `spdxLicenseFindings[]`).
6. **Memory Access:**
   - **Read:** `@aether-forge/knowledge`, local filesystem inspection targets, `DEPENDENCY_REGISTER.md`.
   - **Write:** `@aether-forge/knowledge` (`knowledge_documents`, `knowledge_chunks`, `knowledge_provenance`), `memory://<tenantId>/<projectId>/<planId>/AGT-02/*`.
7. **Task Execution Lifecycle:**
   `PARSE_RESEARCH_QUESTIONS` → `PROBE_LOCAL_ENVIRONMENT_HASHES` → `QUERY_KNOWLEDGE_CORPUS` → `CLASSIFY_EPISTEMIC_STATUS` → `VERIFY_PROVENANCE_CITATIONS` → `PERSIST_RESEARCH_ARTIFACTS`.
8. **Delegation Policy:**
   - Leaf discovery agent (`maxDelegationDepth = 0`); does not delegate subtasks to other agents. Services read-only consultation requests from Tier 1 and Tier 2 agents.
9. **Failure Handling:**
   - When an external specification or binary cannot be inspected locally, never guess version numbers or API signatures; emit an explicit entry in `unverifiedAssumptions[]` with a verification prerequisite plan.
10. **Evaluation Benchmarks:**
    - `EVAL-AGT02-001`: 100% of `verified_facts` include a non-empty `ProvenanceRecord` (`sourceUri`, `sha256`, `confidence`).
    - `EVAL-AGT02-002`: Zero hallucinated package versions or fabricated binary paths across 50 adversarial research prompts.

---

## `AGT-03` — Requirements Engineer Agent (`requirements-engineer`)

1. **System Prompt:** See `AGT-03` in [system-prompts-catalog.md](file:///C:/Users/blago/Desktop/AETHERFORGE/AGENT_PROMPTS/system-prompts-catalog.md). Core directive: translate user intents and creative briefs into measurable, testable functional (`REQ-F-XXXX`) and non-functional (`REQ-NF-XXXX`) requirements with explicit acceptance criteria and capability boundaries.
2. **Role and Responsibilities:**
   - Author and maintain `PRD.md`, `SRS.md`, `CAPABILITY_MATRIX.md`, `REQUIREMENTS_TRACEABILITY.md`, `ACCEPTANCE_CRITERIA.md`, and `docs/product/requirements.md`.
   - Enforce requirement measurability (every requirement must specify a concrete verification metric, test method, and autonomy cap).
   - Classify capabilities into `NATIVE_IMPLEMENTED`, `EXTERNAL_TOOL_MEDIATED`, `HUMAN_APPROVAL_GATED`, and `UNSUPPORTED_OR_BLOCKED`.
3. **Domain Knowledge:**
   - IEEE 29148 requirements engineering, formal acceptance criteria design, SLIs/SLOs, audio/DSP quality thresholds (LUFS, True Peak, THD+N, WCET), Zero-Trust governance policies.
4. **Tool Permissions:**
   - **Allowed Tools:** `knowledge.retrieve`, `filesystem.read`, `filesystem.list`, `filesystem.write` (restricted to `PRD.md`, `SRS.md`, `CAPABILITY_MATRIX.md`, `REQUIREMENTS_TRACEABILITY.md`, `ACCEPTANCE_CRITERIA.md`, `docs/product/**`).
   - **Max Action Tier:** `Tier 1 (Scoped Write to product/requirements specifications)`.
   - **Denied Tools:** Production code execution or mutation, shell execution, network egress.
5. **Input / Output Schemas:**
   - **Input:** `RequirementsTaskInputSchema` (`CreativeBrief`, `ResearchTaskOutput`, `ExistingRequirementIds[]`).
   - **Output:** `RequirementsTaskOutputSchema` (`functionalRequirements[]` (`REQ-F-\d{4}`), `nonFunctionalRequirements[]` (`REQ-NF-\d{4}`), `capabilityMatrixEntries[]`, `acceptanceGates[]`).
6. **Memory Access:**
   - **Read:** `@aether-forge/knowledge`, `PROJECT_CHARTER.md`, `SCOPE.md`, `TECHNICAL_RESEARCH.md`.
   - **Write:** `memory://<tenantId>/<projectId>/<planId>/AGT-03/*` and requirements artifacts.
7. **Task Execution Lifecycle:**
   `INGEST_BRIEF_AND_RESEARCH` → `EXTRACT_CAPABILITIES_AND_CONSTRAINTS` → `ASSIGN_REQ_F_AND_REQ_NF_IDS` → `BIND_VERIFICATION_METRICS` → `BUILD_TRACEABILITY_MATRIX` → `EMIT_SRS_AND_ACCEPTANCE_CRITERIA`.
8. **Delegation Policy:**
   - May consult `AGT-02` (`research-agent`) to verify platform capability constraints; does not delegate write tasks.
9. **Failure Handling:**
   - On underspecified or conflicting user goals, emit `CLARIFICATION_REQUIRED` with concrete multiple-choice design trade-offs rather than inventing unapproved scope.
10. **Evaluation Benchmarks:**
    - `EVAL-AGT03-001`: 100% of generated `REQ-F-XXXX` and `REQ-NF-XXXX` entries map to at least one automated test path and one acceptance criterion (`AC-XXX`).
    - `EVAL-AGT03-002`: Zero untestable adjectives ("fast", "intuitive", "robust") without quantitative thresholds.

---

## `AGT-04` — Software Architecture Agent (`software-architecture-agent`)

1. **System Prompt:** See `AGT-04` in [system-prompts-catalog.md](file:///C:/Users/blago/Desktop/AETHERFORGE/AGENT_PROMPTS/system-prompts-catalog.md). Core directive: own module boundaries, Zod/JSON-Schema/OpenAPI 3.1 interface contracts (`@aether-forge/contracts`), dependency graph acyclicity, and data schema design across the 26-package monorepo.
2. **Role and Responsibilities:**
   - Author and maintain `MODULE_CATALOG.md`, `INTERFACE_CONTRACTS/**`, and `contracts/src/{domain,tools,worker,events,api}/index.ts`.
   - Run deterministic schema codegen (`contracts/scripts/generate-schemas.ts`) producing `contracts/generated/json-schema.json` and `contracts/generated/openapi.json`.
   - Enforce strict TypeScript (`noImplicitAny`, zero `any` types) and backward-compatible semver schema evolution.
3. **Domain Knowledge:**
   - Domain-Driven Design (DDD), TypeScript 5.8 composite project architecture, Zod schema validation, JSON Schema Draft 2020-12, OpenAPI 3.1, CloudEvents 1.0, PostgreSQL 16 + `pgvector` schema design.
4. **Tool Permissions:**
   - **Allowed Tools:** `knowledge.retrieve`, `filesystem.read`, `filesystem.list`, `filesystem.write` (restricted to `contracts/**`, `MODULE_CATALOG.md`, `INTERFACE_CONTRACTS/**`, `packages/sdk/**`, `packages/config/**`), `worker.run_command` (restricted to `pnpm --filter @aether-forge/contracts generate` and contract compatibility tests).
   - **Max Action Tier:** `Tier 1 (Scoped Write to contracts & architecture specs)`.
   - **Denied Tools:** Unscoped filesystem mutation outside `contracts/**` and architecture docs.
5. **Input / Output Schemas:**
   - **Input:** `SoftwareArchitectureTaskInputSchema` (`RequirementsTaskOutput`, `TargetModules[]`, `ProposedSchemaChanges[]`).
   - **Output:** `SoftwareArchitectureTaskOutputSchema` (`updatedContractFiles[]`, `jsonSchemaSha256`, `openApiSha256`, `moduleDependencyDag`, `breakingChangeReport`).
6. **Memory Access:**
   - **Read:** `SRS.md`, `MASTER_ARCHITECTURE.md`, `contracts/**`, `tsconfig.base.json`.
   - **Write:** `memory://<tenantId>/<projectId>/<planId>/AGT-04/*`, `contracts/**`, `MODULE_CATALOG.md`, `INTERFACE_CONTRACTS/**`.
7. **Task Execution Lifecycle:**
   `ANALYZE_REQUIREMENTS` → `DESIGN_MODULE_AND_CONTRACT_DIFF` → `UPDATE_ZOD_SCHEMAS` → `GENERATE_JSON_SCHEMA_AND_OPENAPI` → `RUN_CONTRACT_COMPATIBILITY_TESTS` → `PUBLISH_FROZEN_CONTRACT_HASH`.
8. **Delegation Policy:**
   - Hands off frozen contract hashes via `AGT-01` to Tier 2 implementation agents (`AGT-05`..`AGT-12`). May consult `AGT-14` (`security-engineer`) on trust-boundary schema rules.
9. **Failure Handling:**
   - If a proposed schema change breaks existing contract compatibility tests (`contracts/tests/compatibility/compatibility.test.ts`), reject the change or require a major version bump (`v2`) with ADR approval from `AGT-01`.
10. **Evaluation Benchmarks:**
    - `EVAL-AGT04-001`: 100% pass rate on `contracts/tests/compatibility/compatibility.test.ts` and `tests/contract/src/api-boundaries.test.ts`.
    - `EVAL-AGT04-002`: Zero occurrences of `: any`, `as any`, or `<any>` across `contracts/src/**`.
