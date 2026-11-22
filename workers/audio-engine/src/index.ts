import { createHash, randomBytes } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, sep } from "node:path";
import {
  type AudioJob,
  AudioJobSchema,
  type DomainError,
  type EvidenceRef,
  type Result,
  SCHEMA_VERSION_V1,
} from "@aether-forge/contracts";
import { resolveAndVerifyGrantedPath } from "@aether-forge/filesystem";

export interface WavMetadataInspection {
  readonly sampleRate: number;
  readonly channels: number;
  readonly bitsPerSample: number;
  readonly frameCount: number;
  readonly durationSeconds: number;
  readonly peakDbfs: number;
  readonly inputSha256: string;
  readonly canonicalInputPath: string;
}

export interface AudioArtifactResult {
  readonly audioJobId: string;
  readonly operation: AudioJob["operation"];
  readonly inspection: WavMetadataInspection;
  readonly outputSha256?: string | undefined;
  readonly outputPeakDbfs?: number | undefined;
  readonly gainAppliedDb?: number | undefined;
  readonly canonicalOutputPath?: string | undefined;
}

function audioError(
  code: string,
  message: string,
  category: DomainError["category"],
  traceId: string,
): Result<never> {
  return {
    ok: false,
    retryable: false,
    error: {
      schemaVersion: SCHEMA_VERSION_V1,
      code,
      message,
      category,
      traceId,
    },
  };
}

/**
 * Generates a deterministic 16-bit linear PCM RIFF/WAVE buffer for golden fixture verification.
 */
export function synthesizeGoldenPcm16Wav(params: {
  readonly sampleRate: number;
  readonly channels: number;
  readonly frameCount: number;
  readonly frequencyHz: number;
  readonly peakAmplitudeInt16: number;
}): Buffer {
  const { sampleRate, channels, frameCount, frequencyHz, peakAmplitudeInt16 } = params;
  const dataBytes = frameCount * channels * 2;
  const buffer = Buffer.alloc(44 + dataBytes);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16); // PCM fmt chunk size
  buffer.writeUInt16LE(1, 20); // AudioFormat = 1 (Linear PCM)
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * 2, 28); // ByteRate
  buffer.writeUInt16LE(channels * 2, 32); // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample = 16
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataBytes, 40);

  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    // Ensure frame 0 or quarter-wave hits exact peakAmplitudeInt16 for deterministic peak testing
    const value =
      frame === 0
        ? peakAmplitudeInt16
        : Math.round(
            peakAmplitudeInt16 * Math.sin((2 * Math.PI * frequencyHz * frame) / sampleRate),
          );
    const clamped = Math.max(-32767, Math.min(32767, value));
    for (let ch = 0; ch < channels; ch += 1) {
      buffer.writeInt16LE(clamped, offset);
      offset += 2;
    }
  }

  return buffer;
}

export function parseAndInspectPcm16WavBuffer(
  buffer: Buffer,
  canonicalInputPath: string,
  traceId: string,
): Result<WavMetadataInspection> {
  if (buffer.byteLength < 44) {
    return audioError(
      "DOMAIN_AUDIO_FORMAT_INVALID",
      "WAV buffer is smaller than 44-byte RIFF/WAVE header.",
      "VALIDATION",
      traceId,
    );
  }

  const riff = buffer.toString("ascii", 0, 4);
  const wave = buffer.toString("ascii", 8, 12);
  const fmt = buffer.toString("ascii", 12, 16);
  if (riff !== "RIFF" || wave !== "WAVE" || fmt !== "fmt ") {
    return audioError(
      "DOMAIN_AUDIO_FORMAT_INVALID",
      "Invalid RIFF/WAVE/fmt magic headers.",
      "VALIDATION",
      traceId,
    );
  }

  const audioFormat = buffer.readUInt16LE(20);
  const channels = buffer.readUInt16LE(22);
  const sampleRate = buffer.readUInt32LE(24);
  const bitsPerSample = buffer.readUInt16LE(34);
  const dataMarker = buffer.toString("ascii", 36, 40);
  const dataBytes = buffer.readUInt32LE(40);

  if (
    audioFormat !== 1 ||
    bitsPerSample !== 16 ||
    channels < 1 ||
    channels > 8 ||
    sampleRate < 8000 ||
    sampleRate > 192000 ||
    dataMarker !== "data" ||
    44 + dataBytes > buffer.byteLength ||
    dataBytes % (channels * 2) !== 0
  ) {
    return audioError(
      "DOMAIN_AUDIO_FORMAT_INVALID",
      "Only valid 16-bit linear PCM RIFF/WAVE files are supported.",
      "VALIDATION",
      traceId,
    );
  }

  const frameCount = dataBytes / (channels * 2);
  const durationSeconds = frameCount / sampleRate;

  let maxAbs = 0;
  for (let offset = 44; offset < 44 + dataBytes; offset += 2) {
    const sample = Math.abs(buffer.readInt16LE(offset));
    if (sample > maxAbs) {
      maxAbs = sample;
    }
  }

  const peakDbfs =
    maxAbs === 0 ? -120.0 : Number((20 * Math.log10(maxAbs / 32767)).toFixed(6));
  const inputSha256 = createHash("sha256").update(buffer).digest("hex");

  return {
    ok: true,
    value: {
      sampleRate,
      channels,
      bitsPerSample,
      frameCount,
      durationSeconds,
      peakDbfs,
      inputSha256,
      canonicalInputPath,
    },
    evidence: [],
  };
}

/**
 * Executes a local offline AudioJob (inspect_wav or deterministic gain_normalize)
 * inside the granted canonical workspace roots (ADR-0008).
 * Never modifies the original source WAV and never uploads raw audio to the cloud.
 */
export function executeOfflineAudioJob(params: {
  readonly grantedCanonicalRoots: readonly string[];
  readonly rawAudioJob: unknown;
  readonly traceId: string;
  readonly beforeCommitHook?: (() => void) | undefined;
  readonly isCancelled?: (() => boolean) | undefined;
}): Result<AudioArtifactResult> {
  const parsed = AudioJobSchema.safeParse(params.rawAudioJob);
  if (!parsed.success) {
    return audioError(
      "DOMAIN_AUDIO_JOB_SCHEMA_INVALID",
      parsed.error.issues.map((i) => i.message).join("; "),
      "VALIDATION",
      params.traceId,
    );
  }

  const job = parsed.data;
  const startTimeMs = Date.now();

  // 1. Validate input path strictly inside granted canonical workspace
  const inputPathRes = resolveAndVerifyGrantedPath({
    grantedCanonicalRoots: params.grantedCanonicalRoots,
    relativeTargetPath: job.inputPath,
    traceId: params.traceId,
  });
  if (!inputPathRes.ok) {
    return inputPathRes;
  }

  const { canonicalTarget: canonicalInput } = inputPathRes.value;
  if (!existsSync(canonicalInput)) {
    return audioError(
      "DOMAIN_AUDIO_INPUT_NOT_FOUND",
      "Input WAV file does not exist inside granted workspace.",
      "NOT_FOUND",
      params.traceId,
    );
  }

  if (lstatSync(canonicalInput).isSymbolicLink()) {
    return audioError(
      "DOMAIN_WORKER_REPARSE_POINT_DENIED",
      "Input WAV file cannot be a symbolic link or reparse point.",
      "WORKER_TRUST_BOUNDARY",
      params.traceId,
    );
  }

  // 2. Enforce input byte quota before reading buffer
  const stat = statSync(canonicalInput);
  if (stat.size > job.quotas.maxInputBytes) {
    return audioError(
      "DOMAIN_AUDIO_QUOTA_EXCEEDED",
      `Input file size (${stat.size} bytes) exceeds quota (${job.quotas.maxInputBytes} bytes).`,
      "QUOTA_EXCEEDED",
      params.traceId,
    );
  }

  const inputBuffer = readFileSync(canonicalInput);
  const inspectRes = parseAndInspectPcm16WavBuffer(
    inputBuffer,
    canonicalInput.split(sep).join("/"),
    params.traceId,
  );
  if (!inspectRes.ok) {
    return inspectRes;
  }

  const inspection = inspectRes.value;
  if (inspection.durationSeconds > job.quotas.maxDurationSeconds) {
    return audioError(
      "DOMAIN_AUDIO_QUOTA_EXCEEDED",
      `Audio duration (${inspection.durationSeconds}s) exceeds quota (${job.quotas.maxDurationSeconds}s).`,
      "QUOTA_EXCEEDED",
      params.traceId,
    );
  }

  if (job.operation === "inspect_wav") {
    const evidence: EvidenceRef = {
      schemaVersion: SCHEMA_VERSION_V1,
      evidenceId: `ev-audio-${job.audioJobId}`,
      traceId: params.traceId,
      producer: "audio-engine",
      artifactHash: inspection.inputSha256,
      classification: "RESTRICTED_LOCAL",
      createdAt: new Date().toISOString(),
      verifiableLocation: `file://${inspection.canonicalInputPath}`,
      summary: `WAV inspect: ${inspection.sampleRate}Hz, ${inspection.channels}ch, ${inspection.bitsPerSample}bit, peak ${inspection.peakDbfs} dBFS`,
    };
    return {
      ok: true,
      value: {
        audioJobId: job.audioJobId,
        operation: "inspect_wav",
        inspection,
      },
      evidence: [evidence],
    };
  }

  // 3. Deterministic gain_normalize operation to a new atomic output file
  if (!job.outputPath) {
    return audioError(
      "DOMAIN_AUDIO_OUTPUT_PATH_REQUIRED",
      "gain_normalize operation requires an explicit outputPath.",
      "VALIDATION",
      params.traceId,
    );
  }

  const outputPathRes = resolveAndVerifyGrantedPath({
    grantedCanonicalRoots: params.grantedCanonicalRoots,
    relativeTargetPath: job.outputPath,
    traceId: params.traceId,
  });
  if (!outputPathRes.ok) {
    return outputPathRes;
  }

  const { canonicalTarget: canonicalOutput } = outputPathRes.value;
  if (canonicalOutput.toLowerCase() === canonicalInput.toLowerCase()) {
    return audioError(
      "DOMAIN_AUDIO_OVERWRITE_SOURCE_FORBIDDEN",
      "Audio engine must never overwrite or mutate the source audio file.",
      "POLICY_DENIED",
      params.traceId,
    );
  }

  const targetPeakDbfs = job.targetPeakDbfs ?? -1.0;
  const gainAppliedDb =
    inspection.peakDbfs <= -120 ? 0 : Number((targetPeakDbfs - inspection.peakDbfs).toFixed(6));
  const linearGain = Math.pow(10, gainAppliedDb / 20);

  const outputBuffer = Buffer.from(inputBuffer);
  const dataBytes = outputBuffer.readUInt32LE(40);
  let outputMaxAbs = 0;

  for (let offset = 44; offset < 44 + dataBytes; offset += 2) {
    const sample = outputBuffer.readInt16LE(offset);
    const scaled = Math.round(sample * linearGain);
    const clamped = Math.max(-32767, Math.min(32767, scaled));
    const abs = Math.abs(clamped);
    if (abs > outputMaxAbs) {
      outputMaxAbs = abs;
    }
    outputBuffer.writeInt16LE(clamped, offset);
  }

  if (Date.now() - startTimeMs > job.quotas.maxExecutionTimeMs) {
    return audioError(
      "DOMAIN_AUDIO_QUOTA_EXCEEDED",
      "Audio DSP execution exceeded maxExecutionTimeMs quota.",
      "QUOTA_EXCEEDED",
      params.traceId,
    );
  }

  mkdirSync(dirname(canonicalOutput), { recursive: true });
  const tempPath = `${canonicalOutput}.tmp-${randomBytes(6).toString("hex")}`;

  try {
    const fd = openSync(tempPath, "wx", 0o600);
    try {
      writeFileSync(fd, outputBuffer);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }

    if (params.beforeCommitHook) {
      params.beforeCommitHook();
    }

    if (params.isCancelled && params.isCancelled()) {
      rmSync(tempPath, { force: true });
      return audioError(
        "DOMAIN_AUDIO_JOB_CANCELLED",
        "Audio job cancelled before atomic publish; temporary staging WAV removed.",
        "WORKER_TRUST_BOUNDARY",
        params.traceId,
      );
    }

    renameSync(tempPath, canonicalOutput);
  } catch (err) {
    rmSync(tempPath, { force: true });
    return audioError(
      "DOMAIN_AUDIO_ATOMIC_WRITE_FAILED",
      err instanceof Error ? err.message : "Failed to write atomic audio output.",
      "WORKER_TRUST_BOUNDARY",
      params.traceId,
    );
  }

  const outputSha256 = createHash("sha256").update(outputBuffer).digest("hex");
  const outputPeakDbfs =
    outputMaxAbs === 0 ? -120.0 : Number((20 * Math.log10(outputMaxAbs / 32767)).toFixed(6));
  const normalizedCanonicalOutput = canonicalOutput.split(sep).join("/");

  const evidence: EvidenceRef = {
    schemaVersion: SCHEMA_VERSION_V1,
    evidenceId: `ev-audio-${job.audioJobId}`,
    traceId: params.traceId,
    producer: "audio-engine",
    artifactHash: outputSha256,
    classification: "RESTRICTED_LOCAL",
    createdAt: new Date().toISOString(),
    verifiableLocation: `file://${normalizedCanonicalOutput}`,
    summary: `Deterministic WAV gain_normalize: inputSha256=${inspection.inputSha256}, outputSha256=${outputSha256}, peak ${inspection.peakDbfs}dBFS -> ${outputPeakDbfs}dBFS`,
  };

  return {
    ok: true,
    value: {
      audioJobId: job.audioJobId,
      operation: "gain_normalize",
      inspection,
      outputSha256,
      outputPeakDbfs,
      gainAppliedDb,
      canonicalOutputPath: normalizedCanonicalOutput,
    },
    evidence: [evidence],
  };
}
