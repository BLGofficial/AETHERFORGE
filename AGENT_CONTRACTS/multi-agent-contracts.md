# AETHER FORGE — MULTI-AGENT ORCHESTRATION, OWNERSHIP & CONCURRENCY CONTRACTS (`AGENT_CONTRACTS/multi-agent-contracts.md`)

- **Version:** `1.0.0`
- **Status:** Normative Multi-Agent Interface Specification
- **Enforced By:** `@aether-forge/orchestration`, `@aether-forge/policy`, `@aether-forge/filesystem`, `AGT-19` (`independent-verification-agent`)

---

## 1. Agent Identity & Capability Contract (`AgentIdentitySchema`)

```typescript
import { z } from "zod";

export const AgentIdSchema = z.enum([
  "AGT-01", // chief-systems-architect
  "AGT-02", // research-agent
  "AGT-03", // requirements-engineer
  "AGT-04", // software-architecture-agent
  "AGT-05", // ai-systems-engineer
  "AGT-06", // agentic-systems-engineer
  "AGT-07", // dsp-engineer
  "AGT-08", // cpp-engineer
  "AGT-09", // vst3-engineer
  "AGT-10", // daw-integration-engineer
  "AGT-11", // backend-engineer
  "AGT-12", // frontend-engineer
  "AGT-13", // devops-engineer
  "AGT-14", // security-engineer
  "AGT-15", // qa-engineer
  "AGT-16", // performance-engineer
  "AGT-17", // integration-engineer
  "AGT-18", // documentation-engineer
  "AGT-19", // independent-verification-agent
]);

export const AgentTierSchema = z.enum(["TIER_0_VERIFICATION", "TIER_1_ARCHITECTURE", "TIER_2A_FULLSTACK_AI", "TIER_2B_NATIVE_AUDIO_DAW", "TIER_3_OPS_QUALITY"]);
```

---

## 2. Explicit Task Ownership Lease & Concurrency Fencing (`TaskOwnershipLeaseSchema`)

Prevents race conditions, lost updates, and cross-agent file overwrites.

```typescript
export const FileHashBindingSchema = z.object({
  canonicalPath: z.string().min(1),
  preExecutionSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/).nullable(), // null if newly created file
  postExecutionSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  bytes: z.number().int().nonnegative(),
});

export const TaskOwnershipLeaseSchema = z.object({
  leaseId: z.string().uuid(),
  tenantId: z.string().min(1),
  projectId: z.string().min(1),
  planId: z.string().min(1),
  stepId: z.string().min(1),
  ownerAgentId: AgentIdSchema,
  fenceToken: z.number().int().positive(), // Monotonically increasing per workspace; stale tokens rejected
  actionTier: z.enum(["0", "1", "2", "3"]),
  exclusiveWriteGlobs: z.array(z.string().min(1)), // Empty array [] for Tier 0 read-only agents (AGT-19)
  readOnlyGlobs: z.array(z.string().min(1)).min(1),
  baseTreeSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  approvalTokenId: z.string().nullable(), // Mandatory when actionTier is "2" or "3"
});
```

### Concurrency Validation Rules
1. **Disjoint Parallel Leases:** Before the Temporal Coordinator activates parallel steps $S_1, \dots, S_k$, it verifies pairwise disjointness of `exclusiveWriteGlobs`. Any overlap throws `LEASE_GLOB_COLLISION_DETECTED`.
2. **Fenced Write Verification:** Every `filesystem.write` call checks:
   - Target path matches `lease.exclusiveWriteGlobs` (otherwise `OUT_OF_LEASE_WRITE_DENIED`).
   - `lease.fenceToken >= pathMaxFenceToken[canonicalPath]` (otherwise `STALE_FENCE_TOKEN_REJECTED`).
   - Current disk SHA-256 equals `expectedPreWriteSha256` from `baseTreeSha256` (otherwise `CONCURRENT_MODIFICATION_CONFLICT`).

---

## 3. Shared Context Envelope Contract (`SharedContextEnvelopeSchema`)

Provides deterministic, read-only upstream context to each specialist while isolating their private scratchpad.

```typescript
export const UpstreamArtifactRefSchema = z.object({
  producerAgentId: AgentIdSchema,
  stepId: z.string().min(1),
  canonicalPath: z.string().min(1),
  sha256: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  epistemicTag: z.enum(["verified_facts", "engineering_recommendations", "unverified_assumptions"]),
});

export const SharedContextEnvelopeSchema = z.object({
  envelopeId: z.string().uuid(),
  tenantId: z.string().min(1),
  projectId: z.string().min(1),
  traceId: z.string().min(16),
  planId: z.string().min(1),
  stepId: z.string().min(1),
  briefSnapshotHash: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  knowledgeSnapshotId: z.string().min(1),
  contractVersionHash: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  requirementIds: z.array(z.string().regex(/^REQ-(F|NF)-\d{4}$/)).min(1),
  upstreamArtifacts: z.array(UpstreamArtifactRefSchema),
  agentScratchpadNamespace: z.string().regex(/^memory:\/\/[^/]+\/[^/]+\/[^/]+\/AGT-\d{2}\/$/),
});
```

---

## 4. Universal Agent Task Input & Anti-Fabrication Output Contract

Every specialist agent's domain-specific input/output extends the universal base envelope:

```typescript
export const CommandExecutionEvidenceSchema = z.object({
  executionId: z.string().min(1),
  command: z.string().min(1),
  args: z.array(z.string()),
  exitCode: z.number().int(),
  stdoutSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  stderrSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  durationMs: z.number().nonnegative(),
  auditEntryHash: z.string().regex(/^[A-Fa-f0-9]{64}$/),
});

export const AgentTaskInputBaseSchema = z.object({
  agentId: AgentIdSchema,
  lease: TaskOwnershipLeaseSchema,
  context: SharedContextEnvelopeSchema,
  delegationDepth: z.number().int().min(0).max(2),
  domainPayload: z.record(z.unknown()),
});

export const AgentTaskOutputBaseSchema = z.object({
  agentId: AgentIdSchema,
  leaseId: z.string().uuid(),
  fenceToken: z.number().int().positive(),
  status: z.enum([
    "PROVISIONAL_READY_FOR_AGT19",
    "BLOCKED_MISSING_PREREQUISITES",
    "WAITING_FOR_APPROVAL",
    "CLARIFICATION_REQUIRED",
    "FAILED",
  ]),
  epistemicSummary: z.object({
    verifiedFacts: z.array(z.string()),
    engineeringRecommendations: z.array(z.string()),
    unverifiedAssumptions: z.array(z.string()),
  }),
  modifiedFileHashes: z.array(FileHashBindingSchema),
  commandEvidence: z.array(CommandExecutionEvidenceSchema),
  missingPrerequisites: z.array(z.string()), // Populated when status === "BLOCKED_MISSING_PREREQUISITES"
  domainResult: z.record(z.unknown()),
  completedAt: z.string().datetime(),
});
```

---

## 5. Delegation & Escalation Contracts (`AgentDelegationRequestSchema`, `EscalationEventSchema`)

```typescript
export const AgentDelegationRequestSchema = z.object({
  requestId: z.string().uuid(),
  parentAgentId: AgentIdSchema,
  targetAgentId: AgentIdSchema,
  currentDepth: z.number().int().min(0).max(1), // Resulting child depth <= 2
  mode: z.enum(["HIERARCHICAL_DAG_STEP", "READONLY_PEER_CONSULTATION"]),
  requestedRequirementIds: z.array(z.string().regex(/^REQ-(F|NF)-\d{4}$/)),
  proposedWriteGlobs: z.array(z.string()), // Must be empty [] if mode === "READONLY_PEER_CONSULTATION"
}).refine(
  (req) => req.mode !== "READONLY_PEER_CONSULTATION" || req.proposedWriteGlobs.length === 0,
  { message: "Peer consultations at depth 2 must be strictly read-only (empty proposedWriteGlobs)." }
);

export const EscalationEventSchema = z.object({
  escalationId: z.string().uuid(),
  sourceAgentId: AgentIdSchema,
  targetAuthority: z.enum(["AGT-01", "AGT-14", "AGT-17", "AGT-19", "HUMAN_OPERATOR", "EMERGENCY_STOP_REGISTRY"]),
  severity: z.enum(["INFO", "WARNING", "CRITICAL_BLOCKER", "SECURITY_EMERGENCY"]),
  reasonCode: z.enum([
    "AMBIGUOUS_REQUIREMENT",
    "LEASE_CONFLICT_DETECTED",
    "TIER2_3_APPROVAL_REQUIRED",
    "MISSING_HOST_TOOLCHAIN_PREREQUISITE",
    "REALTIME_AUDIO_WCET_OR_ALLOCATION_VIOLATION",
    "VERIFICATION_FAILURE_MAX_RETRIES_EXCEEDED",
    "SECURITY_OR_TRAVERSAL_VIOLATION",
  ]),
  evidenceRefs: z.array(z.string()),
  remediationOptions: z.array(z.string()).min(1),
});
```

---

## 6. Independent Verification Verdict Contract (`IndependentVerificationVerdictSchema`)

Enforces **Separation of Duty (`authorAgentId !== verifierAgentId` and `verifierAgentId === "AGT-19"`)**.

```typescript
export const IndependentVerificationVerdictSchema = z.object({
  verdictId: z.string().uuid(),
  planId: z.string().min(1),
  stepId: z.string().min(1),
  leaseId: z.string().uuid(),
  authorAgentId: AgentIdSchema,
  verifierAgentId: z.literal("AGT-19"),
  status: z.enum(["PASS", "FAIL", "BLOCKED_MISSING_PREREQUISITES"]),
  checks: z.object({
    separationOfDutyVerified: z.boolean(),
    leaseGlobsRespected: z.boolean(),
    diskSha256MatchesClaimed: z.boolean(),
    zeroPlaceholderFabrication: z.boolean(),
    commandExitCodesVerified: z.boolean(),
    auditChainIntact: z.boolean(),
  }),
  verifiedArtifacts: z.array(FileHashBindingSchema),
  acceptanceCriteriaChecked: z.array(z.string().regex(/^AC-\d{3}$/)),
  findings: z.array(z.string()),
  auditEntryHash: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  verifiedAt: z.string().datetime(),
}).refine(
  (v) => v.authorAgentId !== v.verifierAgentId,
  { message: "Separation-of-Duty violation: AGT-19 cannot verify its own authored artifacts." }
);
```
