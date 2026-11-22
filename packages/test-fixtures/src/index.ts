import {
  type Approval,
  type ArtifactRef,
  type AudioJob,
  type AuditEvent,
  type Brief,
  type CapabilityGrant,
  type CloudEventEnvelope,
  computeCanonicalPlanHash,
  type DawCommand,
  type DomainError,
  EVENT_NAMES,
  type EvidenceRef,
  type ExecutionPlan,
  type PlanStep,
  type ProductSpec,
  type RequestContext,
  SCHEMA_VERSION_V1,
  type ToolManifest,
  type WorkerJob,
} from "@aether-forge/contracts";

export const SAMPLE_SHA256 =
  "a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0" as const;

export const sampleRequestContext: RequestContext = {
  schemaVersion: SCHEMA_VERSION_V1,
  requestId: "req-0001",
  tenantId: "tenant-alpha",
  actor: {
    actorId: "actor-builder-01",
    principalType: "human",
    roles: ["Builder"],
    displayName: "Lead Builder",
  },
  projectId: "proj-synth-01",
  traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
  idempotencyKey: "idem-brief-submit-0001",
  classification: "CONFIDENTIAL",
};

export const sampleBrief: Brief = {
  schemaVersion: SCHEMA_VERSION_V1,
  briefId: "brief-0001",
  tenantId: "tenant-alpha",
  projectId: "proj-synth-01",
  title: "Normalize stem levels and verify FL Studio 2025 project metadata",
  objective:
    "Inspect workspace WAV stem headers and write a deterministic gain-normalized stem inside the granted local workspace.",
  constraints: [
    "Do not overwrite original WAV stem",
    "Require explicit Builder approval before writing normalized file",
  ],
  classification: "CONFIDENTIAL",
  createdBy: "actor-builder-01",
  createdAt: "2026-11-22T20:00:00Z",
};

export const sampleProductSpec: ProductSpec = {
  schemaVersion: SCHEMA_VERSION_V1,
  specId: "spec-0001",
  briefId: "brief-0001",
  tenantId: "tenant-alpha",
  projectId: "proj-synth-01",
  summary:
    "Two-step governed workflow: read-only allowlisted metadata check followed by approval-gated workspace file write.",
  acceptanceCriteria: [
    "Read step executes automatically under allow policy",
    "Write step pauses until Builder approval bound to planHash and policyVersion",
  ],
  requiredCapabilities: ["read_allowlisted", "write_workspace"],
  specHash: SAMPLE_SHA256,
  createdAt: "2026-11-22T20:01:00Z",
};

export const samplePlanSteps: PlanStep[] = [
  {
    schemaVersion: SCHEMA_VERSION_V1,
    stepId: "step-01-read",
    orderIndex: 0,
    toolId: "tool.workspace.inspect_manifest",
    actionClass: "read_allowlisted",
    description: "Inspect workspace manifest metadata",
    input: { targetRelativePath: "manifest.json" },
    expectedOutputs: ["manifestHash"],
    requiresApproval: false,
    dependsOnStepIds: [],
  },
  {
    schemaVersion: SCHEMA_VERSION_V1,
    stepId: "step-02-write",
    orderIndex: 1,
    toolId: "tool.workspace.atomic_write",
    actionClass: "write_workspace",
    description: "Write governed output summary inside granted workspace",
    input: { targetRelativePath: "outputs/report.json" },
    expectedOutputs: ["outputFileHash"],
    requiresApproval: true,
    dependsOnStepIds: ["step-01-read"],
  },
];

export const samplePlanHash = computeCanonicalPlanHash({
  planId: "plan-0001",
  specId: "spec-0001",
  tenantId: "tenant-alpha",
  projectId: "proj-synth-01",
  steps: samplePlanSteps,
});

export const sampleExecutionPlan: ExecutionPlan = {
  schemaVersion: SCHEMA_VERSION_V1,
  planId: "plan-0001",
  specId: "spec-0001",
  tenantId: "tenant-alpha",
  projectId: "proj-synth-01",
  steps: samplePlanSteps,
  planHash: samplePlanHash,
  policyVersion: "opa-bundle-2026.11.22-v1",
  createdAt: "2026-11-22T20:02:00Z",
};

export const sampleToolManifest: ToolManifest = {
  schemaVersion: SCHEMA_VERSION_V1,
  toolId: "tool.workspace.atomic_write",
  version: "1.0.0",
  actionClass: "write_workspace",
  description: "Performs an atomic file write strictly inside a granted canonical workspace directory",
  inputSchemaRef: "https://schemas.aetherforge.internal/v1/tools/workspace-write-input.json",
  outputSchemaRef: "https://schemas.aetherforge.internal/v1/tools/workspace-write-output.json",
  maxDurationMs: 30_000,
  requiresLocalWorker: true,
};

export const sampleCapabilityGrant: CapabilityGrant = {
  schemaVersion: SCHEMA_VERSION_V1,
  grantId: "grant-0001",
  tenantId: "tenant-alpha",
  projectId: "proj-synth-01",
  workerId: "worker-win11-studio-01",
  planId: "plan-0001",
  planHash: samplePlanHash,
  stepId: "step-02-write",
  actionClass: "write_workspace",
  canonicalPathScope: ["C:/AetherForgeWorkspaces/proj-synth-01"],
  policyVersion: "opa-bundle-2026.11.22-v1",
  issuedAt: "2026-11-22T20:05:00Z",
  expiresAt: "2026-11-23T00:05:00Z",
  revoked: false,
  signature: "sig-ed25519-base64url-signed-grant-payload-verification-token-0001",
};

export const sampleApproval: Approval = {
  schemaVersion: SCHEMA_VERSION_V1,
  approvalId: "appr-0001",
  tenantId: "tenant-alpha",
  projectId: "proj-synth-01",
  actor: sampleRequestContext.actor,
  planId: "plan-0001",
  planHash: samplePlanHash,
  stepId: "step-02-write",
  actionClass: "write_workspace",
  policyVersion: "opa-bundle-2026.11.22-v1",
  canonicalPathScope: ["C:/AetherForgeWorkspaces/proj-synth-01"],
  decision: "APPROVED",
  status: "APPROVED",
  rationale: "Verified target path is within project workspace and non-destructive.",
  decidedAt: "2026-11-22T20:05:00Z",
  expiresAt: "2026-11-23T00:05:00Z",
};

export const sampleWorkerJob: WorkerJob = {
  schemaVersion: SCHEMA_VERSION_V1,
  jobId: "job-0001",
  traceId: sampleRequestContext.traceId,
  idempotencyKey: "idem-job-0001",
  stepId: "step-02-write",
  grant: sampleCapabilityGrant,
  payload: {
    kind: "workspace_write",
    targetRelativePath: "outputs/report.json",
    contentUtf8: JSON.stringify({ status: "verified" }),
  },
  manifestSignature: "sig-ed25519-base64url-signed-job-manifest-payload-token-0001",
};

export const sampleDawCommand: DawCommand = {
  schemaVersion: SCHEMA_VERSION_V1,
  commandId: "daw-cmd-0001",
  dawTarget: "fl-studio-2025",
  capabilityTier: "inspect",
  operation: "inspect_version_and_session_header",
  backupRequired: false,
  foregroundUiFallbackOptIn: false,
  parameters: { projectRelativePath: "sessions/demo.flp" },
};

export const sampleAudioJob: AudioJob = {
  schemaVersion: SCHEMA_VERSION_V1,
  audioJobId: "audio-job-0001",
  operation: "gain_normalize",
  inputPath: "stems/lead_synth.wav",
  outputPath: "renders/lead_synth_norm.wav",
  targetPeakDbfs: -1.0,
  quotas: {
    maxDurationSeconds: 600,
    maxInputBytes: 104_857_600,
    maxExecutionTimeMs: 30_000,
  },
};

export const sampleEvidenceRef: EvidenceRef = {
  schemaVersion: SCHEMA_VERSION_V1,
  evidenceId: "ev-0001",
  traceId: sampleRequestContext.traceId,
  producer: "worker",
  artifactHash: SAMPLE_SHA256,
  classification: "CONFIDENTIAL",
  createdAt: "2026-11-22T20:06:00Z",
  verifiableLocation: "workspace://proj-synth-01/outputs/report.json",
  summary: "Atomic workspace write completed and SHA-256 verified.",
};

export const sampleArtifactRef: ArtifactRef = {
  schemaVersion: SCHEMA_VERSION_V1,
  artifactId: "art-worker-msix-0001",
  version: "1.0.0",
  sha256: SAMPLE_SHA256,
  signatureRef: "s3://aetherforge-artifacts/releases/1.0.0/worker.msix.sig",
  sbomRef: "s3://aetherforge-artifacts/releases/1.0.0/worker.cdx.json",
  provenanceRef: "s3://aetherforge-artifacts/releases/1.0.0/worker.intoto.jsonl",
  createdAt: "2026-11-22T20:10:00Z",
};

export const sampleAuditEvent: AuditEvent = {
  schemaVersion: SCHEMA_VERSION_V1,
  eventId: "audit-0001",
  timestamp: "2026-11-22T20:05:01Z",
  tenantId: "tenant-alpha",
  projectId: "proj-synth-01",
  actor: sampleRequestContext.actor,
  traceId: sampleRequestContext.traceId,
  idempotencyKey: "idem-approval-0001",
  eventType: EVENT_NAMES.APPROVAL_DECIDED,
  actionClass: "write_workspace",
  policyVersion: "opa-bundle-2026.11.22-v1",
  planHash: samplePlanHash,
  outcome: "ALLOWED",
  payloadHash: SAMPLE_SHA256,
};

export const sampleDomainError: DomainError = {
  schemaVersion: SCHEMA_VERSION_V1,
  code: "DOMAIN_APPROVAL_PLAN_HASH_MISMATCH",
  message: "Approval planHash does not match current ExecutionPlan hash (INV-03).",
  category: "APPROVAL_INVALID",
  traceId: sampleRequestContext.traceId,
  details: {
    expectedPlanHash: samplePlanHash,
    policyVersion: "opa-bundle-2026.11.22-v1",
  },
};

export const sampleBriefSubmittedCloudEvent: CloudEventEnvelope<Brief> = {
  specversion: "1.0",
  id: "evt-0001",
  source: "urn:aetherforge:control-plane:api",
  type: EVENT_NAMES.BRIEF_SUBMITTED,
  time: "2026-11-22T20:00:01Z",
  datacontenttype: "application/json",
  subject: sampleBrief.briefId,
  traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
  tenantid: sampleBrief.tenantId,
  idempotencykey: sampleRequestContext.idempotencyKey,
  data: sampleBrief,
};
