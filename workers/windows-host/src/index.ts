import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import {
  type CapabilityGrant,
  type EvidenceRef,
  type JobReceipt,
  JobReceiptSchema,
  type Result,
  SCHEMA_VERSION_V1,
  type WorkerJob,
  WorkerJobSchema,
} from "@aether-forge/contracts";
import {
  atomicWriteWorkspaceFile,
  inspectWorkspaceFile,
  type WorkspaceManifestInspection,
} from "@aether-forge/filesystem";
import { executeOfflineAudioJob } from "@aether-forge/audio-engine";
import { FlStudio2025Adapter } from "@aether-forge/fl-studio-2025";

export interface EnrolledMachineIdentity {
  readonly workerId: string;
  readonly tenantId: string;
  readonly machineThumbprint: string;
  readonly clientCertPem: string;
  readonly enrolledAt: string;
}

/**
 * DPAPI-backed local identity store envelope (AES-256-GCM bound to Windows user/machine entropy seam).
 */
export class DpapiBackedIdentityStore {
  private readonly machineKey = randomBytes(32);
  private encryptedBlob: Buffer | undefined;
  private iv: Buffer | undefined;
  private authTag: Buffer | undefined;

  public saveIdentity(identity: EnrolledMachineIdentity): void {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.machineKey, iv);
    const plaintext = Buffer.from(JSON.stringify(identity), "utf8");
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    this.encryptedBlob = encrypted;
    this.iv = iv;
    this.authTag = cipher.getAuthTag();
  }

  public loadIdentity(): EnrolledMachineIdentity | undefined {
    if (!this.encryptedBlob || !this.iv || !this.authTag) {
      return undefined;
    }
    const decipher = createDecipheriv("aes-256-gcm", this.machineKey, this.iv);
    decipher.setAuthTag(this.authTag);
    const decrypted = Buffer.concat([decipher.update(this.encryptedBlob), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8")) as EnrolledMachineIdentity;
  }

  public clear(): void {
    this.encryptedBlob = undefined;
    this.iv = undefined;
    this.authTag = undefined;
  }
}

export function computeGrantSignature(grant: Omit<CapabilityGrant, "signature">, secret: string): string {
  const payload = JSON.stringify({
    grantId: grant.grantId,
    tenantId: grant.tenantId,
    projectId: grant.projectId,
    workerId: grant.workerId,
    planId: grant.planId,
    planHash: grant.planHash,
    stepId: grant.stepId,
    actionClass: grant.actionClass,
    canonicalPathScope: grant.canonicalPathScope,
    policyVersion: grant.policyVersion,
    issuedAt: grant.issuedAt,
    expiresAt: grant.expiresAt,
  });
  return `sig-grant-hmac256-${createHmac("sha256", secret).update(payload, "utf8").digest("hex")}`;
}

export function computeJobManifestSignature(
  job: Omit<WorkerJob, "manifestSignature">,
  secret: string,
): string {
  const payload = JSON.stringify({
    jobId: job.jobId,
    traceId: job.traceId,
    idempotencyKey: job.idempotencyKey,
    stepId: job.stepId,
    grantId: job.grant.grantId,
    grantSignature: job.grant.signature,
    payload: job.payload,
  });
  return `sig-manifest-hmac256-${createHmac("sha256", secret).update(payload, "utf8").digest("hex")}`;
}

function safeCompareSignature(expected: string, actual: string): boolean {
  const bufA = Buffer.from(expected, "utf8");
  const bufB = Buffer.from(actual, "utf8");
  if (bufA.byteLength !== bufB.byteLength) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export interface HeartbeatRecord {
  readonly workerId: string;
  readonly tenantId: string;
  readonly timestamp: string;
  readonly activeMtlsSessionId: string;
}

/**
 * Mock Cloud Worker Gateway for Phase 06 tests (no live cloud required).
 */
export class MockWorkerGateway {
  public readonly controlPlaneSigningSecret = "aetherforge-control-plane-manifest-signing-secret-v1";
  private readonly enrolledWorkers = new Map<string, EnrolledMachineIdentity>();
  private readonly activeMtlsSessions = new Map<string, string>();
  private readonly revokedGrantIds = new Set<string>();
  private readonly heartbeats: HeartbeatRecord[] = [];

  public enrollWorker(params: {
    readonly workerId: string;
    readonly tenantId: string;
    readonly machineThumbprint: string;
  }): EnrolledMachineIdentity {
    const identity: EnrolledMachineIdentity = {
      workerId: params.workerId,
      tenantId: params.tenantId,
      machineThumbprint: params.machineThumbprint,
      clientCertPem: `-----BEGIN CERTIFICATE-----\nMTLS-${params.workerId}-${params.machineThumbprint}\n-----END CERTIFICATE-----`,
      enrolledAt: new Date().toISOString(),
    };
    this.enrolledWorkers.set(params.workerId, identity);
    return identity;
  }

  public connectOutboundMtls(identity: EnrolledMachineIdentity): string | undefined {
    const registered = this.enrolledWorkers.get(identity.workerId);
    if (
      !registered ||
      registered.tenantId !== identity.tenantId ||
      registered.clientCertPem !== identity.clientCertPem
    ) {
      return undefined;
    }
    const sessionId = `mtls-session-${identity.workerId}-${Date.now()}`;
    this.activeMtlsSessions.set(identity.workerId, sessionId);
    return sessionId;
  }

  public recordHeartbeat(identity: EnrolledMachineIdentity): Result<HeartbeatRecord> {
    const sessionId = this.activeMtlsSessions.get(identity.workerId);
    if (!sessionId) {
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_WORKER_MTLS_SESSION_INACTIVE",
          message: "Worker has no active outbound mTLS session.",
          category: "WORKER_TRUST_BOUNDARY",
          traceId: "heartbeat-trace",
        },
      };
    }
    const hb: HeartbeatRecord = {
      workerId: identity.workerId,
      tenantId: identity.tenantId,
      timestamp: new Date().toISOString(),
      activeMtlsSessionId: sessionId,
    };
    this.heartbeats.push(hb);
    return { ok: true, value: hb, evidence: [] };
  }

  public getHeartbeats(): readonly HeartbeatRecord[] {
    return this.heartbeats;
  }

  public revokeGrant(grantId: string): void {
    this.revokedGrantIds.add(grantId);
  }

  public isGrantRevoked(grantId: string): boolean {
    return this.revokedGrantIds.has(grantId);
  }
}

/**
 * Local Windows Worker Host (ADR-0001, ADR-0010, INV-02).
 * Enforces enrollment, outbound mTLS session, signed JobManifest & CapabilityGrant verification,
 * expiry/revocation checks, cancellation, and constrained workspace filesystem operations.
 */
export class WindowsWorkerHost {
  public readonly keystore: DpapiBackedIdentityStore;
  public readonly gateway: MockWorkerGateway;
  public readonly dawAdapter: FlStudio2025Adapter;
  private mtlsSessionId: string | undefined;
  private readonly cancelledJobIds = new Set<string>();
  private sequence = 0;

  public constructor(
    gateway: MockWorkerGateway,
    keystore: DpapiBackedIdentityStore = new DpapiBackedIdentityStore(),
    dawAdapter: FlStudio2025Adapter = new FlStudio2025Adapter(),
  ) {
    this.gateway = gateway;
    this.keystore = keystore;
    this.dawAdapter = dawAdapter;
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${String(this.sequence).padStart(4, "0")}`;
  }

  public enrollAndConnect(params: {
    readonly workerId: string;
    readonly tenantId: string;
    readonly machineThumbprint: string;
  }): boolean {
    const identity = this.gateway.enrollWorker(params);
    this.keystore.saveIdentity(identity);
    this.mtlsSessionId = this.gateway.connectOutboundMtls(identity);
    return Boolean(this.mtlsSessionId);
  }

  public sendHeartbeat(): Result<HeartbeatRecord> {
    const identity = this.keystore.loadIdentity();
    if (!identity) {
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_WORKER_UNENROLLED",
          message: "Worker is not enrolled in DPAPI identity store.",
          category: "WORKER_TRUST_BOUNDARY",
          traceId: "heartbeat-trace",
        },
      };
    }
    return this.gateway.recordHeartbeat(identity);
  }

  public cancelJob(jobId: string): void {
    this.cancelledJobIds.add(jobId);
  }

  public inspectGrantedManifest(params: {
    readonly grant: CapabilityGrant;
    readonly relativePath: string;
    readonly traceId: string;
    readonly nowMs?: number;
  }): Result<WorkspaceManifestInspection> {
    const grantVerification = this.verifyIdentityAndGrant(
      params.grant,
      "read_allowlisted",
      params.traceId,
      params.nowMs ?? Date.now(),
    );
    if (!grantVerification.ok) {
      return grantVerification;
    }

    return inspectWorkspaceFile({
      grantedCanonicalRoots: params.grant.canonicalPathScope,
      relativeTargetPath: params.relativePath,
      traceId: params.traceId,
    });
  }

  public executeJobManifest(
    rawJob: unknown,
    options?: {
      readonly nowMs?: number;
      readonly beforeCommitHook?: () => void;
    },
  ): Result<JobReceipt> {
    const parsedJob = WorkerJobSchema.safeParse(rawJob);
    if (!parsedJob.success) {
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_WORKER_MANIFEST_SCHEMA_INVALID",
          message: parsedJob.error.issues.map((i) => i.message).join("; "),
          category: "WORKER_TRUST_BOUNDARY",
          traceId: "invalid-job-manifest",
        },
      };
    }

    const job = parsedJob.data;
    const nowMs = options?.nowMs ?? Date.now();

    // 1. Verify signed JobManifest cryptographic integrity
    const expectedManifestSig = computeJobManifestSignature(
      job,
      this.gateway.controlPlaneSigningSecret,
    );
    if (!safeCompareSignature(expectedManifestSig, job.manifestSignature)) {
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_WORKER_MANIFEST_SIGNATURE_INVALID",
          message: "Worker refused unsigned or tampered JobManifest (ADR-0010).",
          category: "WORKER_TRUST_BOUNDARY",
          traceId: job.traceId,
        },
      };
    }

    // 2. Verify worker enrollment, mTLS session, and CapabilityGrant signature/expiry/revocation
    const expectedActionClass: CapabilityGrant["actionClass"] =
      job.payload.kind === "workspace_write"
        ? "write_workspace"
        : job.payload.kind === "audio_job"
          ? "audio_dsp"
          : (`daw_${job.payload.dawCommand.capabilityTier}` as CapabilityGrant["actionClass"]);

    const grantCheck = this.verifyIdentityAndGrant(
      job.grant,
      expectedActionClass,
      job.traceId,
      nowMs,
    );
    if (!grantCheck.ok) {
      return grantCheck;
    }

    if (job.stepId !== job.grant.stepId) {
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_WORKER_GRANT_STEP_MISMATCH",
          message: "WorkerJob stepId does not match CapabilityGrant stepId.",
          category: "WORKER_TRUST_BOUNDARY",
          traceId: job.traceId,
        },
      };
    }

    const identity = grantCheck.value;
    const completedIso = new Date(nowMs).toISOString();

    if (job.payload.kind === "daw_command") {
      const dawRes = this.dawAdapter.invoke(job.payload.dawCommand, {
        grantedCanonicalRoots: job.grant.canonicalPathScope,
        traceId: job.traceId,
        isCancelled: () => this.cancelledJobIds.has(job.jobId),
      });
      if (!dawRes.ok) {
        return dawRes;
      }

      const receipt: JobReceipt = JobReceiptSchema.parse({
        schemaVersion: SCHEMA_VERSION_V1,
        jobId: job.jobId,
        workerId: identity.workerId,
        status: "COMPLETED",
        completedAt: completedIso,
        evidence: dawRes.evidence,
      });

      return {
        ok: true,
        value: receipt,
        evidence: dawRes.evidence,
      };
    }

    if (job.payload.kind === "audio_job") {
      const audioRes = executeOfflineAudioJob({
        grantedCanonicalRoots: job.grant.canonicalPathScope,
        rawAudioJob: job.payload.audioJob,
        traceId: job.traceId,
        beforeCommitHook: options?.beforeCommitHook,
        isCancelled: () => this.cancelledJobIds.has(job.jobId),
      });
      if (!audioRes.ok) {
        return audioRes;
      }

      const receipt: JobReceipt = JobReceiptSchema.parse({
        schemaVersion: SCHEMA_VERSION_V1,
        jobId: job.jobId,
        workerId: identity.workerId,
        status: "COMPLETED",
        completedAt: completedIso,
        evidence: audioRes.evidence,
      });

      return {
        ok: true,
        value: receipt,
        evidence: audioRes.evidence,
      };
    }

    // 3. Execute constrained workspace filesystem write activity
    if (job.payload.kind !== "workspace_write") {
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_WORKER_PAYLOAD_UNSUPPORTED_IN_PHASE08",
          message: "Only workspace_write and audio_job payloads are enabled prior to Phase 09.",
          category: "WORKER_TRUST_BOUNDARY",
          traceId: job.traceId,
        },
      };
    }

    const writeRes = atomicWriteWorkspaceFile({
      grantedCanonicalRoots: job.grant.canonicalPathScope,
      relativeTargetPath: job.payload.targetRelativePath,
      contentUtf8: job.payload.contentUtf8,
      expectedPriorSha256: job.payload.expectedPriorSha256,
      beforeCommitHook: options?.beforeCommitHook,
      isCancelled: () => this.cancelledJobIds.has(job.jobId),
      traceId: job.traceId,
    });

    if (!writeRes.ok) {
      return writeRes;
    }

    const evidence: EvidenceRef = {
      schemaVersion: SCHEMA_VERSION_V1,
      evidenceId: this.nextId("ev-worker"),
      traceId: job.traceId,
      producer: "worker",
      artifactHash: writeRes.value.sha256,
      classification: "CONFIDENTIAL",
      createdAt: completedIso,
      verifiableLocation: `file://${writeRes.value.canonicalTargetPath}`,
      summary: `Atomic workspace write (${writeRes.value.bytesWritten} bytes) verified inside granted canonical root.`,
    };

    const receipt: JobReceipt = JobReceiptSchema.parse({
      schemaVersion: SCHEMA_VERSION_V1,
      jobId: job.jobId,
      workerId: identity.workerId,
      status: "COMPLETED",
      completedAt: completedIso,
      evidence: [evidence],
    });

    return {
      ok: true,
      value: receipt,
      evidence: [evidence],
    };
  }

  private verifyIdentityAndGrant(
    grant: CapabilityGrant,
    requiredActionClass: CapabilityGrant["actionClass"],
    traceId: string,
    nowMs: number,
  ): Result<EnrolledMachineIdentity> {
    const identity = this.keystore.loadIdentity();
    if (!identity || !this.mtlsSessionId) {
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_WORKER_UNENROLLED",
          message: "Worker is unenrolled or lacks an active outbound mTLS session (INV-02).",
          category: "WORKER_TRUST_BOUNDARY",
          traceId,
        },
      };
    }

    if (grant.workerId !== identity.workerId || grant.tenantId !== identity.tenantId) {
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_WORKER_GRANT_IDENTITY_MISMATCH",
          message: "CapabilityGrant workerId or tenantId does not match enrolled worker identity.",
          category: "WORKER_TRUST_BOUNDARY",
          traceId,
        },
      };
    }

    const expectedGrantSig = computeGrantSignature(
      grant,
      this.gateway.controlPlaneSigningSecret,
    );
    if (!safeCompareSignature(expectedGrantSig, grant.signature)) {
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_WORKER_GRANT_SIGNATURE_INVALID",
          message: "CapabilityGrant cryptographic signature verification failed.",
          category: "WORKER_TRUST_BOUNDARY",
          traceId,
        },
      };
    }

    if (grant.revoked || this.gateway.isGrantRevoked(grant.grantId)) {
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_WORKER_GRANT_REVOKED",
          message: "CapabilityGrant has been revoked.",
          category: "WORKER_TRUST_BOUNDARY",
          traceId,
        },
      };
    }

    if (nowMs >= Date.parse(grant.expiresAt)) {
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_WORKER_GRANT_EXPIRED",
          message: "CapabilityGrant has expired.",
          category: "WORKER_TRUST_BOUNDARY",
          traceId,
        },
      };
    }

    if (grant.actionClass !== requiredActionClass) {
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_WORKER_GRANT_ACTION_CLASS_MISMATCH",
          message: `CapabilityGrant actionClass '${grant.actionClass}' does not permit '${requiredActionClass}'.`,
          category: "WORKER_TRUST_BOUNDARY",
          traceId,
        },
      };
    }

    return {
      ok: true,
      value: identity,
      evidence: [],
    };
  }
}
