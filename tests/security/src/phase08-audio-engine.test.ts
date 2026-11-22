import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  executeOfflineAudioJob,
  parseAndInspectPcm16WavBuffer,
  synthesizeGoldenPcm16Wav,
} from "@aether-forge/audio-engine";
import {
  type AudioJob,
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

describe("PHASE 08 — Audio/DSP offline vertical slice gate", () => {
  let workspaceDir: string;
  let goldenWavPath: string;
  let goldenWavSha256: string;

  beforeEach(() => {
    workspaceDir = mkdtempSync(join(tmpdir(), "aetherforge-p08-audio-"));
    mkdirSync(join(workspaceDir, "stems"), { recursive: true });
    mkdirSync(join(workspaceDir, "renders"), { recursive: true });

    // Golden 48kHz stereo 16-bit PCM WAV with peak amplitude 16384 (~ -6.0206 dBFS)
    const goldenBuffer = synthesizeGoldenPcm16Wav({
      sampleRate: 48_000,
      channels: 2,
      frameCount: 4_800, // 0.10s duration
      frequencyHz: 440,
      peakAmplitudeInt16: 16_384,
    });
    goldenWavPath = join(workspaceDir, "stems", "golden_lead.wav");
    writeFileSync(goldenWavPath, goldenBuffer);
    goldenWavSha256 = createHash("sha256").update(goldenBuffer).digest("hex");
  });

  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true });
  });

  function buildSignedAudioWorkerJob(
    gateway: MockWorkerGateway,
    audioJob: AudioJob,
  ): WorkerJob {
    const unsignedGrant: Omit<CapabilityGrant, "signature"> = {
      schemaVersion: SCHEMA_VERSION_V1,
      grantId: `grant-${audioJob.audioJobId}`,
      tenantId: "tenant-alpha",
      projectId: "proj-synth-01",
      workerId: "worker-win11-audio-01",
      planId: "plan-audio-01",
      planHash: SAMPLE_SHA256,
      stepId: "step-audio-01",
      actionClass: "audio_dsp",
      canonicalPathScope: [workspaceDir],
      policyVersion: "opa-bundle-2026.11.22-v1",
      issuedAt: "2026-11-22T20:00:00Z",
      expiresAt: "2026-11-23T20:00:00Z",
      revoked: false,
    };
    const grant: CapabilityGrant = {
      ...unsignedGrant,
      signature: computeGrantSignature(unsignedGrant, gateway.controlPlaneSigningSecret),
    };

    const unsignedJob: Omit<WorkerJob, "manifestSignature"> = {
      schemaVersion: SCHEMA_VERSION_V1,
      jobId: `job-${audioJob.audioJobId}`,
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      idempotencyKey: `idem-${audioJob.audioJobId}`,
      stepId: "step-audio-01",
      grant,
      payload: {
        kind: "audio_job",
        audioJob,
      },
    };

    return {
      ...unsignedJob,
      manifestSignature: computeJobManifestSignature(
        unsignedJob,
        gateway.controlPlaneSigningSecret,
      ),
    };
  }

  it("inspects golden WAV metadata and executes deterministic gain_normalize through Windows Worker with reproducible SHA-256 and <0.01 dB tolerance while keeping original immutable", () => {
    const gateway = new MockWorkerGateway();
    const worker = new WindowsWorkerHost(gateway);
    worker.enrollAndConnect({
      workerId: "worker-win11-audio-01",
      tenantId: "tenant-alpha",
      machineThumbprint: "thumb-audio-01",
    });

    // 1. Inspect WAV metadata
    const inspectRes = executeOfflineAudioJob({
      grantedCanonicalRoots: [workspaceDir],
      rawAudioJob: {
        schemaVersion: SCHEMA_VERSION_V1,
        audioJobId: "audio-inspect-01",
        operation: "inspect_wav",
        inputPath: "stems/golden_lead.wav",
        quotas: {
          maxDurationSeconds: 60,
          maxInputBytes: 10_000_000,
          maxExecutionTimeMs: 10_000,
        },
      },
      traceId: "trace-audio-01",
    });
    expect(inspectRes.ok).toBe(true);
    if (!inspectRes.ok) return;

    expect(inspectRes.value.inspection.sampleRate).toBe(48_000);
    expect(inspectRes.value.inspection.channels).toBe(2);
    expect(inspectRes.value.inspection.bitsPerSample).toBe(16);
    expect(inspectRes.value.inspection.frameCount).toBe(4_800);
    expect(inspectRes.value.inspection.peakDbfs).toBeCloseTo(-6.0203, 3);
    expect(inspectRes.value.inspection.inputSha256).toBe(goldenWavSha256);

    // 2. Execute approved gain_normalize (-1.0 dBFS target) through Windows Worker twice to prove bit-exact reproducibility
    const normJob1 = buildSignedAudioWorkerJob(gateway, {
      schemaVersion: SCHEMA_VERSION_V1,
      audioJobId: "audio-norm-run1",
      operation: "gain_normalize",
      inputPath: "stems/golden_lead.wav",
      outputPath: "renders/golden_lead_norm_run1.wav",
      targetPeakDbfs: -1.0,
      quotas: {
        maxDurationSeconds: 60,
        maxInputBytes: 10_000_000,
        maxExecutionTimeMs: 10_000,
      },
    });
    const normJob2 = buildSignedAudioWorkerJob(gateway, {
      schemaVersion: SCHEMA_VERSION_V1,
      audioJobId: "audio-norm-run2",
      operation: "gain_normalize",
      inputPath: "stems/golden_lead.wav",
      outputPath: "renders/golden_lead_norm_run2.wav",
      targetPeakDbfs: -1.0,
      quotas: {
        maxDurationSeconds: 60,
        maxInputBytes: 10_000_000,
        maxExecutionTimeMs: 10_000,
      },
    });

    const nowMs = Date.parse("2026-11-22T21:00:00Z");
    const res1 = worker.executeJobManifest(normJob1, { nowMs });
    const res2 = worker.executeJobManifest(normJob2, { nowMs });
    expect(res1.ok).toBe(true);
    expect(res2.ok).toBe(true);
    if (!res1.ok || !res2.ok) return;

    // Reproducibility gate: run 1 and run 2 produce identical SHA-256 artifact hashes
    const hash1 = res1.value.evidence[0]!.artifactHash;
    const hash2 = res2.value.evidence[0]!.artifactHash;
    expect(hash1).toBe(hash2);
    expect(res1.value.evidence[0]?.classification).toBe("RESTRICTED_LOCAL");

    // Verify rendered output WAV peak is within 0.01 dB tolerance of -1.0 dBFS
    const renderedBytes = readFileSync(
      join(workspaceDir, "renders", "golden_lead_norm_run1.wav"),
    );
    const renderedInspect = parseAndInspectPcm16WavBuffer(
      renderedBytes,
      "renders/golden_lead_norm_run1.wav",
      "trace-verify",
    );
    expect(renderedInspect.ok).toBe(true);
    if (renderedInspect.ok) {
      expect(Math.abs(renderedInspect.value.peakDbfs - -1.0)).toBeLessThan(0.01);
    }

    // Immutability gate: original source WAV file never changed
    const currentInputHash = createHash("sha256")
      .update(readFileSync(goldenWavPath))
      .digest("hex");
    expect(currentInputHash).toBe(goldenWavSha256);
  });

  it("blocks overwriting source file, enforces format & resource quotas, and cleans up temp file on cancellation with zero partial published output", () => {
    const gateway = new MockWorkerGateway();
    const worker = new WindowsWorkerHost(gateway);
    worker.enrollAndConnect({
      workerId: "worker-win11-audio-01",
      tenantId: "tenant-alpha",
      machineThumbprint: "thumb-audio-01",
    });
    const nowMs = Date.parse("2026-11-22T21:00:00Z");

    // 1. Attempting to overwrite source inputPath is denied
    const overwriteSourceRes = executeOfflineAudioJob({
      grantedCanonicalRoots: [workspaceDir],
      rawAudioJob: {
        schemaVersion: SCHEMA_VERSION_V1,
        audioJobId: "audio-overwrite-attempt",
        operation: "gain_normalize",
        inputPath: "stems/golden_lead.wav",
        outputPath: "stems/golden_lead.wav",
        targetPeakDbfs: -1.0,
        quotas: {
          maxDurationSeconds: 60,
          maxInputBytes: 10_000_000,
          maxExecutionTimeMs: 10_000,
        },
      },
      traceId: "trace-overwrite",
    });
    expect(overwriteSourceRes.ok).toBe(false);
    if (!overwriteSourceRes.ok) {
      expect(overwriteSourceRes.error.code).toBe("DOMAIN_AUDIO_OVERWRITE_SOURCE_FORBIDDEN");
    }

    // 2. Resource quota enforcement (maxInputBytes smaller than file size)
    const quotaExceededRes = executeOfflineAudioJob({
      grantedCanonicalRoots: [workspaceDir],
      rawAudioJob: {
        schemaVersion: SCHEMA_VERSION_V1,
        audioJobId: "audio-quota-exceeded",
        operation: "inspect_wav",
        inputPath: "stems/golden_lead.wav",
        quotas: {
          maxDurationSeconds: 60,
          maxInputBytes: 100, // golden WAV is 19,244 bytes
          maxExecutionTimeMs: 10_000,
        },
      },
      traceId: "trace-quota",
    });
    expect(quotaExceededRes.ok).toBe(false);
    if (!quotaExceededRes.ok) {
      expect(quotaExceededRes.error.code).toBe("DOMAIN_AUDIO_QUOTA_EXCEEDED");
    }

    // 3. Corrupted / non-WAV format rejection
    writeFileSync(join(workspaceDir, "stems", "corrupted.wav"), "NOT_A_VALID_RIFF_WAVE_FILE");
    const badFormatRes = executeOfflineAudioJob({
      grantedCanonicalRoots: [workspaceDir],
      rawAudioJob: {
        schemaVersion: SCHEMA_VERSION_V1,
        audioJobId: "audio-corrupt",
        operation: "inspect_wav",
        inputPath: "stems/corrupted.wav",
        quotas: {
          maxDurationSeconds: 60,
          maxInputBytes: 10_000_000,
          maxExecutionTimeMs: 10_000,
        },
      },
      traceId: "trace-corrupt",
    });
    expect(badFormatRes.ok).toBe(false);
    if (!badFormatRes.ok) {
      expect(badFormatRes.error.code).toBe("DOMAIN_AUDIO_FORMAT_INVALID");
    }

    // 4. Mid-flight cancellation produces no published partial file and leaves original untouched
    const cancelWorkerJob = buildSignedAudioWorkerJob(gateway, {
      schemaVersion: SCHEMA_VERSION_V1,
      audioJobId: "audio-cancel-01",
      operation: "gain_normalize",
      inputPath: "stems/golden_lead.wav",
      outputPath: "renders/cancelled_norm.wav",
      targetPeakDbfs: -1.0,
      quotas: {
        maxDurationSeconds: 60,
        maxInputBytes: 10_000_000,
        maxExecutionTimeMs: 10_000,
      },
    });

    const cancelRes = worker.executeJobManifest(cancelWorkerJob, {
      nowMs,
      beforeCommitHook: () => {
        worker.cancelJob(cancelWorkerJob.jobId);
      },
    });
    expect(cancelRes.ok).toBe(false);
    if (!cancelRes.ok) {
      expect(cancelRes.error.code).toBe("DOMAIN_AUDIO_JOB_CANCELLED");
    }
    expect(existsSync(join(workspaceDir, "renders", "cancelled_norm.wav"))).toBe(false);
    const leftoverTmp = readdirSync(join(workspaceDir, "renders")).filter((f) =>
      f.includes(".tmp-"),
    );
    expect(leftoverTmp).toHaveLength(0);
  });
});
