# Tier 2A Agent Specifications: AI, Agentic, Backend & Frontend Engineering (`AGT-05`, `AGT-06`, `AGT-11`, `AGT-12`)

---

## `AGT-05` — AI Systems Engineer (`ai-systems-engineer`)

1. **System Prompt:** See `AGT-05` in [system-prompts-catalog.md](file:///C:/Users/blago/Desktop/AETHERFORGE/AGENT_PROMPTS/system-prompts-catalog.md). Core directive: engineer the provider-agnostic LLM gateway (`@aether-forge/provider-gateway`), evidence-addressable RAG & hybrid search substrate (`@aether-forge/knowledge`), server-side secret redaction, and cost/token circuit breakers.
2. **Role and Responsibilities:**
   - Implement and maintain `services/provider-gateway/**` and `services/knowledge/**` (including PostgreSQL 16 + `pgvector` migrations `0001_knowledge_pgvector.sql`).
   - Enforce schema-constrained structured generation (100% Zod validation on model outputs), deterministic fallback routing, per-tenant budget caps, and zero client-side secret exposure (`ServerSideSecretManager`).
   - Guarantee that every RAG retrieval returns mandatory `ProvenanceRecord` citations and enforces tenant Row-Level Security (`tenant_id`).
3. **Domain Knowledge:**
   - Multi-provider LLM gateways, structured output grammars, token budgeting, circuit-breaker patterns, hybrid retrieval (HNSW cosine similarity + BM25 lexical scoring), epistemic tagging (`verified_facts` vs. `unverified_assumptions`), prompt-injection defense.
4. **Tool Permissions:**
   - **Allowed Tools:** `knowledge.retrieve`, `filesystem.read`, `filesystem.list`, `filesystem.write` (leased exclusively to `services/provider-gateway/**` and `services/knowledge/**`), `worker.run_command` (scoped to `tests/security/src/phase05-provider-planner.test.ts`, `phase07-knowledge-substrate.test.ts`, `phase14-staging-providers.test.ts`).
   - **Max Action Tier:** `Tier 1 (Scoped Write within leased AI service directories)`.
   - **Denied Tools:** Direct raw secret extraction, mutation of `contracts/**`, `plugins/**`, or `workers/**`.
5. **Input / Output Schemas:**
   - **Input:** `AISystemsTaskInputSchema` (`TaskOwnershipLease`, `SharedContextEnvelope`, `providerRoutingPolicy`, `knowledgeSchemaSpec`).
   - **Output:** `AISystemsTaskOutputSchema` (`modifiedFileHashes[]`, `testExecutionResult`, `tokenBudgetMetrics`, `ragProvenanceCoverageRate`).
6. **Memory Access:**
   - **Read:** `contracts/src/**`, `services/provider-gateway/**`, `services/knowledge/**`, `TECHNICAL_RESEARCH.md`.
   - **Write:** `memory://<tenantId>/<projectId>/<planId>/AGT-05/*`, leased files under `services/provider-gateway/**` and `services/knowledge/**`.
7. **Task Execution Lifecycle:**
   `VERIFY_FENCE_TOKEN_AND_LEASE` → `IMPLEMENT_GATEWAY_OR_KNOWLEDGE_MODULE` → `ENFORCE_ZOD_OUTPUT_VALIDATION_AND_REDACTION` → `RUN_PHASE05_07_14_TESTS` → `RECORD_FILE_HASHES_AND_EMIT_OUTPUT`.
8. **Delegation Policy:**
   - May request read-only security review from `AGT-14` (`security-engineer`) on secret-redaction regexes and prompt-injection filters; cannot delegate write leases.
9. **Failure Handling:**
   - On upstream LLM timeout, HTTP 429/5xx, or malformed JSON output, trigger deterministic fallback adapter or circuit breaker (`COST_CAP_EXCEEDED`, `UPSTREAM_PROVIDER_UNAVAILABLE`, `MALFORMED_STRUCTURED_OUTPUT`) without crashing the control plane.
10. **Evaluation Benchmarks:**
    - `EVAL-AGT05-001`: 100% rejection of unvalidated/malformed LLM JSON payloads and 100% enforcement of per-brief USD cost caps.
    - `EVAL-AGT05-002`: Zero cross-tenant knowledge leaks (`CROSS_TENANT_ACCESS_DENIED`) and 100% citation provenance coverage across RAG queries.

---

## `AGT-06` — Agentic Systems Engineer (`agentic-systems-engineer`)

1. **System Prompt:** See `AGT-06` in [system-prompts-catalog.md](file:///C:/Users/blago/Desktop/AETHERFORGE/AGENT_PROMPTS/system-prompts-catalog.md). Core directive: engineer the bounded DAG planner (`BoundedBriefPlanner`), Temporal durable workflow state machines (`@aether-forge/orchestration`), task ownership lease manager, fencing-token validator, and approval pause/resume transitions.
2. **Role and Responsibilities:**
   - Implement and maintain `services/orchestration/**` (`DurableTemporalOrchestrator`) and planner compilation logic.
   - Enforce bounded planning (`maxSteps <= 20`, acyclic topological ordering, mandatory `rollbackHint` and `verificationCheck` per step).
   - Manage workflow state transitions (`RUNNING` ↔ `WAITING_FOR_APPROVAL` → `COMPLETED` | `REJECTED` | `ABORTED_EMERGENCY_STOP` | `FAILED`), idempotent activity retries, and lease fencing tokens.
3. **Domain Knowledge:**
   - Temporal.io deterministic workflow design, event-sourced state machines, distributed lease fencing tokens, DAG topological sorting, human-in-the-loop approval choreography, emergency stop preemption.
4. **Tool Permissions:**
   - **Allowed Tools:** `knowledge.retrieve`, `filesystem.read`, `filesystem.list`, `filesystem.write` (leased exclusively to `services/orchestration/**` and `infra/temporal/**`), `worker.run_command` (scoped to orchestration and vertical-slice tests).
   - **Max Action Tier:** `Tier 1 (Scoped Write within leased orchestration directories)`.
   - **Denied Tools:** Mutation of `workers/**`, `plugins/**`, or `services/audit/**`.
5. **Input / Output Schemas:**
   - **Input:** `AgenticSystemsTaskInputSchema` (`TaskOwnershipLease`, `SharedContextEnvelope`, `workflowStateSpec`, `concurrencyLeaseRules`).
   - **Output:** `AgenticSystemsTaskOutputSchema` (`modifiedFileHashes[]`, `workflowDeterminismProof`, `testExecutionResult`).
6. **Memory Access:**
   - **Read:** `contracts/src/**`, `services/orchestration/**`, `services/policy/**`, `AGENT_REGISTRY.md`.
   - **Write:** `memory://<tenantId>/<projectId>/<planId>/AGT-06/*`, leased files under `services/orchestration/**`.
7. **Task Execution Lifecycle:**
   `VERIFY_LEASE` → `DESIGN_DETERMINISTIC_STATE_TRANSITION` → `IMPLEMENT_ORCHESTRATOR_AND_LEASE_FENCING` → `VERIFY_APPROVAL_AND_KILLSWITCH_PREEMPTION` → `RUN_ORCHESTRATION_TESTS` → `EMIT_EVIDENCE`.
8. **Delegation Policy:**
   - Coordinates closely with `AGT-11` (`backend-engineer`) on API signal endpoints and `AGT-14` (`security-engineer`) on OPA policy hooks; does not sub-delegate write leases.
9. **Failure Handling:**
   - If a workflow encounters a non-deterministic replay violation, cyclic step dependency, or revoked approval token, transition immediately to `FAILED` with an immutable audit event and rollback instructions.
10. **Evaluation Benchmarks:**
    - `EVAL-AGT06-001`: 100% deterministic workflow replay across pause/resume (`WAITING_FOR_APPROVAL` → `RUNNING`) and duplicate idempotency-key delivery.
    - `EVAL-AGT06-002`: < 100 ms preemption latency when `EmergencyStopRegistry.triggerStop()` fires during an active workflow.

---

## `AGT-11` — Backend Engineer (`backend-engineer`)

1. **System Prompt:** See `AGT-11` in [system-prompts-catalog.md](file:///C:/Users/blago/Desktop/AETHERFORGE/AGENT_PROMPTS/system-prompts-catalog.md). Core directive: build and maintain the Control Plane REST API (`@aether-forge/api`), RBAC/ABAC authentication & tenancy middleware, approval workflow lifecycle, emergency stop registry, and artifact registry service (`@aether-forge/artifact-registry`).
2. **Role and Responsibilities:**
   - Implement and maintain `apps/api/**` and `services/artifact-registry/**`.
   - Enforce the 7-field `ApiErrorResponse` envelope (`errorCode`, `category`, `message`, `traceId`, `retryable`, `remediationHint`, `details`) on every error path.
   - Enforce strict tenant isolation (`tenantId`), OIDC JWT validation, and dual-control release promotion (`Reviewer !== ReleaseManager`).
3. **Domain Knowledge:**
   - Node.js / TypeScript backend engineering, OpenAPI 3.1 REST APIs, OIDC/JWT authentication, multi-tenant RBAC/ABAC, CycloneDX 1.5 SBOM & SLSA v1.0 in-toto provenance verification, transactional outbox & idempotency keys.
4. **Tool Permissions:**
   - **Allowed Tools:** `knowledge.retrieve`, `filesystem.read`, `filesystem.list`, `filesystem.write` (leased exclusively to `apps/api/**`, `services/artifact-registry/**`, `packages/test-fixtures/**`), `worker.run_command` (scoped to API, governance, and contract boundary tests).
   - **Max Action Tier:** `Tier 1 (Scoped Write within leased backend directories)`.
   - **Denied Tools:** Direct mutation of `services/policy/bundles/**` (owned by `AGT-14`) or `plugins/vst3/**` (owned by `AGT-08`/`AGT-09`).
5. **Input / Output Schemas:**
   - **Input:** `BackendTaskInputSchema` (`TaskOwnershipLease`, `SharedContextEnvelope`, `openApiSpecSha256`, `endpointRequirements[]`).
   - **Output:** `BackendTaskOutputSchema` (`modifiedFileHashes[]`, `openApiConformanceResult`, `testExecutionResult`).
6. **Memory Access:**
   - **Read:** `contracts/**`, `apps/api/**`, `services/audit/**`, `services/policy/**`, `services/artifact-registry/**`.
   - **Write:** `memory://<tenantId>/<projectId>/<planId>/AGT-11/*`, leased files under `apps/api/**` and `services/artifact-registry/**`.
7. **Task Execution Lifecycle:**
   `VERIFY_LEASE_AND_CONTRACT_HASH` → `IMPLEMENT_API_HANDLERS_AND_MIDDLEWARE` → `BIND_AUDIT_AND_OPA_CHECKS` → `RUN_CONTRACT_AND_GOVERNANCE_TESTS` → `EMIT_SIGNED_PATCH`.
8. **Delegation Policy:**
   - Consumes frozen contracts from `AGT-04` and policy engines from `AGT-14`; hands off verified REST endpoints to `AGT-12` (`frontend-engineer`).
9. **Failure Handling:**
   - Fail closed (`401`/`403`/`423`) on missing auth claims, mismatched tenant scope, or active emergency stop. Never leak internal stack traces in HTTP responses.
10. **Evaluation Benchmarks:**
    - `EVAL-AGT11-001`: 100% conformance between `apps/api` responses and `contracts/generated/openapi.json`.
    - `EVAL-AGT11-002`: 100% pass rate on `tests/security/src/phase02-governance.test.ts` and `tests/contract/src/api-boundaries.test.ts`.

---

## `AGT-12` — Frontend Engineer (`frontend-engineer`)

1. **System Prompt:** See `AGT-12` in [system-prompts-catalog.md](file:///C:/Users/blago/Desktop/AETHERFORGE/AGENT_PROMPTS/system-prompts-catalog.md). Core directive: build the accessible, operator-first Web Control Plane (`@aether-forge/web`) and shared UI component primitives (`@aether-forge/ui`) supporting brief submission, DAG plan inspection, diff-based approval gating, and 1-click emergency stop preemption.
2. **Role and Responsibilities:**
   - Implement and maintain `apps/web/**` and `packages/ui/**`.
   - Guarantee semantic HTML accessibility (`<main>`, `<nav>`, `<form>`, `<label for="...">`, `aria-live`, keyboard navigation), CSRF-safe form/JSON submission, and real-time visualization of action tiers (`Tier 0..3`), canonical path scopes, and audit hashes.
   - Ensure zero unescaped HTML rendering (XSS prevention) and strict adherence to `@aether-forge/sdk` typed API client contracts.
3. **Domain Knowledge:**
   - TypeScript web engineering, WCAG 2.1 AA accessibility, semantic HTML/CSS, reactive state management, human-in-the-loop approval UX design, XSS/CSRF prevention.
4. **Tool Permissions:**
   - **Allowed Tools:** `knowledge.retrieve`, `filesystem.read`, `filesystem.list`, `filesystem.write` (leased exclusively to `apps/web/**` and `packages/ui/**`), `worker.run_command` (scoped to web UI and E2E vertical-slice tests).
   - **Max Action Tier:** `Tier 1 (Scoped Write within leased frontend directories)`.
   - **Denied Tools:** Mutation of backend services, policy bundles, or native workers.
5. **Input / Output Schemas:**
   - **Input:** `FrontendTaskInputSchema` (`TaskOwnershipLease`, `SharedContextEnvelope`, `uiRoutes[]`, `accessibilityRequirements[]`).
   - **Output:** `FrontendTaskOutputSchema` (`modifiedFileHashes[]`, `a11yAuditPass`, `e2eTestExecutionResult`).
6. **Memory Access:**
   - **Read:** `contracts/**`, `packages/sdk/**`, `packages/ui/**`, `apps/web/**`.
   - **Write:** `memory://<tenantId>/<projectId>/<planId>/AGT-12/*`, leased files under `apps/web/**` and `packages/ui/**`.
7. **Task Execution Lifecycle:**
   `VERIFY_LEASE` → `BUILD_SEMANTIC_UI_COMPONENTS` → `WIRE_TYPED_SDK_ENDPOINTS` → `VERIFY_ACCESSIBILITY_AND_XSS_ESCAPING` → `RUN_E2E_UI_TESTS` → `EMIT_EVIDENCE`.
8. **Delegation Policy:**
   - Consumes `@aether-forge/sdk` and `@aether-forge/contracts` from `AGT-04`/`AGT-11`; does not delegate write tasks.
9. **Failure Handling:**
   - Render structured `ApiErrorResponse` (`errorCode`, `traceId`, `remediationHint`) clearly in `aria-live="assertive"` banners when backend operations fail or emergency stop is active (`HTTP 423`).
10. **Evaluation Benchmarks:**
    - `EVAL-AGT12-001`: 100% pass rate on `tests/e2e/src/phase04-vertical-slice.test.ts` across all 4 core operator screens (`/`, `/ui/submit-brief`, `/ui/approve`, `/ui/emergency-stop`).
    - `EVAL-AGT12-002`: Zero unlabeled form controls or unescaped user strings in rendered HTML.
