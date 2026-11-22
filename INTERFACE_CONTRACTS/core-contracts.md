# AETHER FORGE — Core Interface Contracts Specification

**Version:** 1.0.0 (`schemaVersion: "1.0.0"`)  
**Date:** 2026-11-23  
**Cross-References:** [INTERFACE_CONTRACTS/README.md](./README.md) · [MASTER_ARCHITECTURE.md](../MASTER_ARCHITECTURE.md) · [MODULE_CATALOG.md](../MODULE_CATALOG.md) · [contracts/src/index.ts](../contracts/src/index.ts)

---

## 1. Shared Boundary Envelopes (`RequestContext` & `Result<T>`)

```ts
export type DataClassification =
  | "PUBLIC"
  | "INTERNAL"
  | "CONFIDENTIAL"
  | "RESTRICTED_LOCAL"
  | "SECRET_CREDENTIAL";

export type HumanRole =
  | "Owner"
  | "Builder"
  | "Reviewer"
  | "ReleaseManager"
  | "WorkerOperator";

export type ActionClass =
  | "read_allowlisted"
  | "write_workspace"
  | "command_bounded"
  | "audio_dsp"
  | "daw_inspect"
  | "daw_non_destructive_edit"
  | "daw_session_mutation"
  | "daw_render"
  | "external_upload"
  | "package_install"
  | "release_publish";

export interface ActorRef {
  readonly actorId: string;
  readonly principalType: "human" | "service" | "worker";
  readonly roles: readonly HumanRole[];
  readonly displayName?: string;
}

export interface RequestContext {
  readonly schemaVersion: `1.${number}.${number}`;
  readonly requestId: string;
  readonly tenantId: string;
  readonly actor: ActorRef;
  readonly projectId?: string;
  readonly traceId: string;
  readonly idempotencyKey: string;
  readonly classification: DataClassification;
}

export type Result<T> =
  | { readonly ok: true; readonly value: T; readonly evidence: readonly EvidenceRef[] }
  | { readonly ok: false; readonly error: DomainError; readonly retryable: boolean };
```

---

## 2. System Compiler & Execution Plan Contracts (`Brief`, `ProductSpec`, `ExecutionPlan`)

```ts
export interface Brief {
  readonly schemaVersion: `1.${number}.${number}`;
  readonly briefId: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly title: string;
  readonly objective: string;
  readonly constraints: readonly string[];
  readonly classification: DataClassification;
  readonly createdBy: string;
  readonly createdAt: string; // ISO-8601 UTC
}

export interface ProductSpec {
  readonly schemaVersion: `1.${number}.${number}`;
  readonly specId: string;
  readonly briefId: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly summary: string;
  readonly acceptanceCriteria: readonly string[];
  readonly requiredCapabilities: readonly ActionClass[];
  readonly specHash: string; // 64-hex SHA-256
  readonly createdAt: string;
}

export interface PlanStep {
  readonly schemaVersion: `1.${number}.${number}`;
  readonly stepId: string;
  readonly orderIndex: number;
  readonly toolId: string;
  readonly actionClass: ActionClass;
  readonly description: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly expectedOutputs: readonly string[];
  readonly requiresApproval: boolean;
  readonly dependsOnStepIds: readonly string[];
}

export interface ExecutionPlan {
  readonly schemaVersion: `1.${number}.${number}`;
  readonly planId: string;
  readonly specId: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly steps: readonly PlanStep[];
  readonly planHash: string; // Canonical SHA-256 via computeCanonicalPlanHash
  readonly policyVersion: string;
  readonly createdAt: string;
}
```

---

## 3. Policy, Approval & Capability Grant Contracts (`INV-02`, `INV-03`)

```ts
export interface PolicyInput {
  readonly schemaVersion: `1.${number}.${number}`;
  readonly tenantId: string;
  readonly projectId: string;
  readonly actor: ActorRef;
  readonly actionClass: string;
  readonly classification: DataClassification;
  readonly planId?: string;
  readonly planHash?: string;
  readonly stepId?: string;
  readonly canonicalPathScope?: readonly string[];
  readonly dawCapabilityQualified?: boolean;
}

export interface PolicyDecision {
  readonly schemaVersion: `1.${number}.${number}`;
  readonly decision: "allow" | "requireApproval" | "deny";
  readonly policyVersion: string;
  readonly bundleDigest: string; // 64-hex SHA-256
  readonly reasonCode: string;
  readonly userExplanation: string; // Sanitized UI explanation
  readonly requiredApproverRoles: readonly HumanRole[];
  readonly approvalExpirySeconds: number;
}

export interface CapabilityGrant {
  readonly schemaVersion: `1.${number}.${number}`;
  readonly grantId: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly workerId: string;
  readonly planId: string;
  readonly planHash: string; // Bound to ExecutionPlan.planHash (INV-03)
  readonly stepId: string;
  readonly actionClass: ActionClass;
  readonly canonicalPathScope: readonly string[];
  readonly policyVersion: string; // Bound to active OPA bundle version (INV-03)
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly revoked: boolean;
  readonly signature: string; // Constant-time verified HMAC/Ed25519 signature
}
```

---

## 4. Central Intelligence Core & Tool Gateway Contracts (`ToolManifest`, `ModelRequest`, `ModelResponse`)

```ts
export interface ToolManifest {
  readonly schemaVersion: `1.${number}.${number}`;
  readonly toolId: string;
  readonly version: `${number}.${number}.${number}`;
  readonly actionClass: ActionClass;
  readonly description: string;
  readonly inputSchemaRef: string;
  readonly outputSchemaRef: string;
  readonly maxDurationMs: number;
  readonly requiresLocalWorker: boolean;
}

export interface PromptTemplateRef {
  readonly schemaVersion: `1.${number}.${number}`;
  readonly templateId: string;
  readonly templateVersion: `${number}.${number}.${number}`;
  readonly templateSha256: string; // 64-hex SHA-256 verified against PromptTemplateRegistry
}

export interface ModelRequest {
  readonly schemaVersion: `1.${number}.${number}`;
  readonly context: RequestContext;
  readonly promptTemplate: PromptTemplateRef;
  readonly systemInstruction: string;
  readonly userPrompt: string;
  readonly maxOutputTokens: number;
  readonly maxCostUsdMicros: number;
  readonly preferredProvider?:
    | "fake-deterministic"
    | "openai"
    | "anthropic"
    | "google"
    | "self-hosted-openai-compat";
}
```

---

## 5. Windows Worker, Audio DSP & FL Studio 2025 Contracts (`WorkerJob`, `AudioJob`, `DawCommand`)

```ts
export interface AudioJob {
  readonly schemaVersion: `1.${number}.${number}`;
  readonly audioJobId: string;
  readonly operation: "inspect_wav" | "gain_normalize";
  readonly inputPath: string;
  readonly outputPath?: string; // Must never equal inputPath
  readonly targetPeakDbfs?: number;
  readonly quotas: {
    readonly maxDurationSeconds: number;
    readonly maxInputBytes: number;
    readonly maxExecutionTimeMs: number;
  };
}

export interface DawCommand {
  readonly schemaVersion: `1.${number}.${number}`;
  readonly commandId: string;
  readonly dawTarget: "fl-studio-2025";
  readonly capabilityTier: "inspect" | "non_destructive_edit" | "session_mutation" | "render";
  readonly operation: string;
  readonly backupRequired: boolean;
  readonly foregroundUiFallbackOptIn: boolean;
  readonly parameters: Readonly<Record<string, unknown>>;
}

export interface WorkerJob {
  readonly schemaVersion: `1.${number}.${number}`;
  readonly jobId: string;
  readonly traceId: string;
  readonly idempotencyKey: string;
  readonly stepId: string;
  readonly grant: CapabilityGrant;
  readonly payload:
    | {
        readonly kind: "workspace_write";
        readonly targetRelativePath: string;
        readonly contentUtf8: string;
        readonly expectedPriorSha256?: string;
      }
    | { readonly kind: "audio_job"; readonly audioJob: AudioJob }
    | { readonly kind: "daw_command"; readonly dawCommand: DawCommand };
  readonly manifestSignature: string; // Constant-time verified by WindowsWorkerHost
}
```

---

## 6. OpenAPI 3.1 REST Endpoint Contract Summary (`apps/web/src/server.ts`)

| HTTP Method & Path | Operation ID | Request Schema | Response Schema | Error Status Mapping |
|---|---|---|---|---|
| `GET /api/v1/health` | `getHealth` | None | `{ ok: true, service, schemaVersion, policyVersion }` | `200 OK` |
| `POST /api/v1/briefs` | `submitBrief` | `SubmitBriefRequestSchema` | `SubmitBriefResponseSchema` (`Result<SpecRef>`) | `400` Validation · `403` Auth/Policy · `404` Cross-Tenant · `409` Idempotency Conflict · `423` Emergency Stop |
| `POST /api/v1/plans` | `createPlan` | `CreatePlanRequestSchema` | `CreatePlanResponseSchema` (`Result<ExecutionPlan>`) | `400` Validation · `403` Auth/Policy · `404` Cross-Tenant · `423` Emergency Stop |
| `POST /api/v1/approvals/{approvalId}/decision` | `decideApproval` | `DecideApprovalRequestSchema` | `DecideApprovalResponseSchema` (`Result<{ approval, grant? }>`) | `403` Role Denied · `404` Not Found · `409` Stale `planHash`/`policyVersion` Drift (`INV-03`) · `423` Emergency Stop |
| `POST /api/v1/system/emergency-stop` | `triggerEmergencyStop` | `TriggerEmergencyStopRequestSchema` | `TriggerEmergencyStopResponseSchema` (`Result<EmergencyStopReceipt>`) | `403` Non-Owner Denied · `404` Cross-Tenant |
