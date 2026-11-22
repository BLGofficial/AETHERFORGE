import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type CapabilityGrant,
  SCHEMA_VERSION_V1,
  type WorkerJob,
} from "@aether-forge/contracts";
import {
  computeGrantSignature,
  computeJobManifestSignature,
  MockWorkerGateway,
  WindowsWorkerHost,
} from "@aether-forge/windows-host";
import { SAMPLE_SHA256 } from "@aether-forge/test-fixtures";

describe("PHASE 06 — Windows Worker trust boundary and adversarial filesystem gate", () => {
  let tempRootDir: string;
  let grantedWorkspaceDir: string;
  let outsideSecretDir: string;

  beforeEach(() => {
    tempRootDir = mkdtempSync(join(tmpdir(), "aetherforge-p06-"));
    grantedWorkspaceDir = join(tempRootDir, "granted-workspace");
    outsideSecretDir = join(tempRootDir, "outside-secret");
    mkdirSync(grantedWorkspaceDir, { recursive: true });
    mkdirSync(outsideSecretDir, { recursive: true });
    writeFileSync(join(outsideSecretDir, "secret.txt"), "TOP_SECRET_HOST_FILE", "utf8");
    writeFileSync(
      join(grantedWorkspaceDir, "manifest.json"),
      JSON.stringify({ project: "proj-synth-01", version: 1 }),
      "utf8",
    );
  });

  afterEach(() => {
    rmSync(tempRootDir, { recursive: true, force: true });
  });

  function buildSignedWriteJob(params: {
    readonly gateway: MockWorkerGateway;
    readonly workerId?: string;
    readonly tenantId?: string;
    readonly canonicalPathScope?: readonly string[];
    readonly targetRelativePath: string;
    readonly contentUtf8: string;
    readonly expectedPriorSha256?: string;
    readonly expiresAt?: string;
    readonly revoked?: boolean;
  }): WorkerJob {
    const unsignedGrant: Omit<CapabilityGrant, "signature"> = {
      schemaVersion: SCHEMA_VERSION_V1,
      grantId: "grant-p06-0001",
      tenantId: params.tenantId ?? "tenant-alpha",
      projectId: "proj-synth-01",
      workerId: params.workerId ?? "worker-win11-01",
      planId: "plan-0001",
      planHash: SAMPLE_SHA256,
      stepId: "step-02-write",
      actionClass: "write_workspace",
      canonicalPathScope: [...(params.canonicalPathScope ?? [grantedWorkspaceDir])],
      policyVersion: "opa-bundle-2026.11.22-v1",
      issuedAt: "2026-11-22T20:00:00Z",
      expiresAt: params.expiresAt ?? "2026-11-23T20:00:00Z",
      revoked: params.revoked ?? false,
    };
    const grantSignature = computeGrantSignature(
      unsignedGrant,
      params.gateway.controlPlaneSigningSecret,
    );
    const grant: CapabilityGrant = {
      ...unsignedGrant,
      signature: grantSignature,
    };

    const unsignedJob: Omit<WorkerJob, "manifestSignature"> = {
      schemaVersion: SCHEMA_VERSION_V1,
      jobId: "job-p06-0001",
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      idempotencyKey: "idem-p06-0001",
      stepId: "step-02-write",
      grant,
      payload: {
        kind: "workspace_write",
        targetRelativePath: params.targetRelativePath,
        contentUtf8: params.contentUtf8,
        ...(params.expectedPriorSha256 !== undefined
          ? { expectedPriorSha256: params.expectedPriorSha256 }
          : {}),
      },
    };

    return {
      ...unsignedJob,
      manifestSignature: computeJobManifestSignature(
        unsignedJob,
        params.gateway.controlPlaneSigningSecret,
      ),
    };
  }

  it("enrolls worker in DPAPI store, records mTLS heartbeat, inspects manifest, and executes atomic write inside granted workspace", () => {
    const gateway = new MockWorkerGateway();
    const worker = new WindowsWorkerHost(gateway);

    expect(
      worker.enrollAndConnect({
        workerId: "worker-win11-01",
        tenantId: "tenant-alpha",
        machineThumbprint: "thumb-win11-workstation-01",
      }),
    ).toBe(true);

    const hb = worker.sendHeartbeat();
    expect(hb.ok).toBe(true);
    expect(gateway.getHeartbeats()).toHaveLength(1);

    // 1. Inspect manifest inside granted workspace
    const readGrantBase: Omit<CapabilityGrant, "signature"> = {
      schemaVersion: SCHEMA_VERSION_V1,
      grantId: "grant-read-01",
      tenantId: "tenant-alpha",
      projectId: "proj-synth-01",
      workerId: "worker-win11-01",
      planId: "plan-0001",
      planHash: SAMPLE_SHA256,
      stepId: "step-01-read",
      actionClass: "read_allowlisted",
      canonicalPathScope: [grantedWorkspaceDir],
      policyVersion: "opa-bundle-2026.11.22-v1",
      issuedAt: "2026-11-22T20:00:00Z",
      expiresAt: "2026-11-23T20:00:00Z",
      revoked: false,
    };
    const readGrant: CapabilityGrant = {
      ...readGrantBase,
      signature: computeGrantSignature(readGrantBase, gateway.controlPlaneSigningSecret),
    };

    const inspectRes = worker.inspectGrantedManifest({
      grant: readGrant,
      relativePath: "manifest.json",
      traceId: "trace-inspect-01",
      nowMs: Date.parse("2026-11-22T21:00:00Z"),
    });
    expect(inspectRes.ok).toBe(true);
    if (inspectRes.ok) {
      expect(inspectRes.value.contentUtf8).toContain("proj-synth-01");
    }

    // 2. Execute atomic workspace write
    const payloadText = JSON.stringify({ status: "atomic-write-verified" });
    const expectedSha = createHash("sha256").update(payloadText, "utf8").digest("hex");
    const job = buildSignedWriteJob({
      gateway,
      targetRelativePath: "outputs/build-output.json",
      contentUtf8: payloadText,
    });

    const execRes = worker.executeJobManifest(job, {
      nowMs: Date.parse("2026-11-22T21:00:00Z"),
    });
    expect(execRes.ok).toBe(true);
    if (execRes.ok) {
      expect(execRes.value.status).toBe("COMPLETED");
      expect(execRes.value.evidence[0]?.artifactHash).toBe(expectedSha);
    }

    const diskContent = readFileSync(
      join(grantedWorkspaceDir, "outputs", "build-output.json"),
      "utf8",
    );
    expect(diskContent).toBe(payloadText);
  });

  it("fails closed on unenrolled worker, unsigned/tampered job manifest, expired grant, or revoked grant", () => {
    const gateway = new MockWorkerGateway();
    const unenrolledWorker = new WindowsWorkerHost(gateway);

    const validJob = buildSignedWriteJob({
      gateway,
      targetRelativePath: "outputs/test.json",
      contentUtf8: "{}",
    });

    // 1. Unenrolled worker rejects job
    const unenrolledRes = unenrolledWorker.executeJobManifest(validJob);
    expect(unenrolledRes.ok).toBe(false);
    if (!unenrolledRes.ok) {
      expect(unenrolledRes.error.code).toBe("DOMAIN_WORKER_UNENROLLED");
    }

    // Enroll worker for remaining negative checks
    const worker = new WindowsWorkerHost(gateway);
    worker.enrollAndConnect({
      workerId: "worker-win11-01",
      tenantId: "tenant-alpha",
      machineThumbprint: "thumb-01",
    });

    // 2. Tampered / unsigned JobManifest fails closed
    const tamperedManifestJob: WorkerJob = {
      ...validJob,
      payload: {
        kind: "workspace_write",
        targetRelativePath: "outputs/tampered.json",
        contentUtf8: "malicious",
      },
    };
    const unsignedRes = worker.executeJobManifest(tamperedManifestJob);
    expect(unsignedRes.ok).toBe(false);
    if (!unsignedRes.ok) {
      expect(unsignedRes.error.code).toBe("DOMAIN_WORKER_MANIFEST_SIGNATURE_INVALID");
    }

    // 3. Expired grant fails closed
    const expiredJob = buildSignedWriteJob({
      gateway,
      targetRelativePath: "outputs/expired.json",
      contentUtf8: "{}",
      expiresAt: "2026-11-22T20:05:00Z",
    });
    const expiredRes = worker.executeJobManifest(expiredJob, {
      nowMs: Date.parse("2026-11-22T21:00:00Z"),
    });
    expect(expiredRes.ok).toBe(false);
    if (!expiredRes.ok) {
      expect(expiredRes.error.code).toBe("DOMAIN_WORKER_GRANT_EXPIRED");
    }

    // 4. Revoked grant fails closed
    gateway.revokeGrant(validJob.grant.grantId);
    const revokedRes = worker.executeJobManifest(validJob, {
      nowMs: Date.parse("2026-11-22T21:00:00Z"),
    });
    expect(revokedRes.ok).toBe(false);
    if (!revokedRes.ok) {
      expect(revokedRes.error.code).toBe("DOMAIN_WORKER_GRANT_REVOKED");
    }
  });

  it("defends against adversarial path traversal, absolute/UNC paths, symlinks/reparse points, TOCTOU races, and cleans up on cancellation", () => {
    const gateway = new MockWorkerGateway();
    const worker = new WindowsWorkerHost(gateway);
    worker.enrollAndConnect({
      workerId: "worker-win11-01",
      tenantId: "tenant-alpha",
      machineThumbprint: "thumb-01",
    });
    const nowMs = Date.parse("2026-11-22T21:00:00Z");

    // 1. Directory traversal (`../outside-secret/pwn.txt` and `..\outside-secret\pwn.txt`)
    for (const traversalPath of [
      "../outside-secret/pwn.txt",
      "..\\outside-secret\\pwn.txt",
      "sub/../../outside-secret/pwn.txt",
      "C:\\Windows\\System32\\drivers\\etc\\hosts",
      "\\\\localhost\\c$\\pwn.txt",
    ]) {
      const traversalJob = buildSignedWriteJob({
        gateway,
        targetRelativePath: traversalPath,
        contentUtf8: "escaped",
      });
      const res = worker.executeJobManifest(traversalJob, { nowMs });
      expect(res.ok, `Expected traversal path '${traversalPath}' to fail closed`).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe("DOMAIN_WORKER_PATH_ESCAPE_DENIED");
      }
    }
    expect(existsSync(join(outsideSecretDir, "pwn.txt"))).toBe(false);

    // 2. Windows junction / directory symlink inside granted workspace pointing to outsideSecretDir
    const junctionPath = join(grantedWorkspaceDir, "linked-escape");
    try {
      symlinkSync(outsideSecretDir, junctionPath, "junction");
    } catch {
      // Fallback if OS privilege restricts symlink creation
    }

    if (existsSync(junctionPath)) {
      const junctionJob = buildSignedWriteJob({
        gateway,
        targetRelativePath: "linked-escape/secret.txt",
        contentUtf8: "OVERWRITTEN_VIA_JUNCTION",
      });
      const junctionRes = worker.executeJobManifest(junctionJob, { nowMs });
      expect(junctionRes.ok).toBe(false);
      if (!junctionRes.ok) {
        expect(junctionRes.error.code).toBe("DOMAIN_WORKER_REPARSE_POINT_DENIED");
      }
      // Verify outside secret file was never touched
      expect(readFileSync(join(outsideSecretDir, "secret.txt"), "utf8")).toBe(
        "TOP_SECRET_HOST_FILE",
      );
    }

    // 3. TOCTOU defense: concurrent modification of target file before atomic commit fails closed
    const toctouTarget = join(grantedWorkspaceDir, "manifest.json");
    const originalSha = createHash("sha256")
      .update(readFileSync(toctouTarget))
      .digest("hex");

    const toctouJob = buildSignedWriteJob({
      gateway,
      targetRelativePath: "manifest.json",
      contentUtf8: JSON.stringify({ project: "proj-synth-01", version: 2 }),
      expectedPriorSha256: originalSha,
    });

    const toctouRes = worker.executeJobManifest(toctouJob, {
      nowMs,
      beforeCommitHook: () => {
        // Simulate concurrent external modification between temp write and atomic rename
        writeFileSync(toctouTarget, JSON.stringify({ concurrentChange: true }), "utf8");
      },
    });
    expect(toctouRes.ok).toBe(false);
    if (!toctouRes.ok) {
      expect(toctouRes.error.code).toBe("DOMAIN_WORKER_TOCTOU_CONFLICT");
    }

    // 4. Cancellation mid-write removes temporary staging file and leaves zero partial output
    const cancelJob = buildSignedWriteJob({
      gateway,
      targetRelativePath: "outputs/cancelled-output.json",
      contentUtf8: "should-not-be-published",
    });
    const cancelRes = worker.executeJobManifest(cancelJob, {
      nowMs,
      beforeCommitHook: () => {
        worker.cancelJob(cancelJob.jobId);
      },
    });
    expect(cancelRes.ok).toBe(false);
    if (!cancelRes.ok) {
      expect(cancelRes.error.code).toBe("DOMAIN_WORKER_JOB_CANCELLED");
    }
    expect(existsSync(join(grantedWorkspaceDir, "outputs", "cancelled-output.json"))).toBe(false);
    const leftoverTmp = readdirSync(join(grantedWorkspaceDir, "outputs")).filter((f) =>
      f.includes(".tmp-"),
    );
    expect(leftoverTmp).toHaveLength(0);
  });
});
