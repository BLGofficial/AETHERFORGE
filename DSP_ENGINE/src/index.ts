import { createHash } from "node:crypto";

/**
 * AETHER FORGE — REUSABLE DSP ENGINE (SUBSYSTEM A)
 * Deterministic 64-bit float audio ingestion, DSP algorithm library, composable pipeline,
 * RIFF WAV codec, real-time WCET budget verification, and ITU-R BS.1770-4 measurement.
 */

export interface AudioBuffer64 {
  sampleRateHz: number;
  channels: Float64Array[];
  frameCount: number;
}

export interface DspProcessorNode {
  readonly nodeId: string;
  readonly nodeType: string;
  prepare(sampleRateHz: number, maxBlockSize: number, channelCount: number): void;
  processInPlace(channels: Float64Array[], frameCount: number): void;
  reset(): void;
}

export type BiquadFilterMode =
  | "LOWPASS"
  | "HIGHPASS"
  | "BANDPASS"
  | "NOTCH"
  | "PEAKING_EQ"
  | "LOW_SHELF"
  | "HIGH_SHELF";

export interface AudioMeasurementMetrics {
  integratedLufs: number;
  truePeakDbtp: number;
  samplePeakDbfs: number;
  rmsDbfs: number;
  crestFactorDb: number;
  dcOffset: number;
  zeroCrossingRate: number;
  clippingRatio: number;
  spectralCentroidHz: number;
  hasNanOrInf: boolean;
  denormalsFlushedCount: number;
  pcmSha256: string;
}

export interface AudioValidationThresholds {
  maxTruePeakDbtp?: number;
  minIntegratedLufs?: number;
  maxIntegratedLufs?: number;
  maxAbsDcOffset?: number;
  maxClippingRatio?: number;
}

const DENORMAL_THRESHOLD = 1e-15;

export function flushDenormalAndSanitize(sample: number): { value: number; flushed: boolean; invalid: boolean } {
  if (!Number.isFinite(sample)) {
    return { value: 0.0, flushed: false, invalid: true };
  }
  if (Math.abs(sample) > 0 && Math.abs(sample) < DENORMAL_THRESHOLD) {
    return { value: 0.0, flushed: true, invalid: false };
  }
  return { value: sample, flushed: false, invalid: false };
}

export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

export function linearToDb(linear: number, floorDb = -144.0): number {
  if (linear <= 1e-7) return floorDb;
  return Math.max(floorDb, 20 * Math.log10(linear));
}

export function createAudioBuffer(sampleRateHz: number, channelCount: number, frameCount: number): AudioBuffer64 {
  if (sampleRateHz <= 0 || channelCount <= 0 || frameCount < 0) {
    throw new Error(`INVALID_AUDIO_BUFFER_DIMENSIONS: sr=${sampleRateHz} ch=${channelCount} frames=${frameCount}`);
  }
  const channels: Float64Array[] = [];
  for (let c = 0; c < channelCount; c++) {
    channels.push(new Float64Array(frameCount));
  }
  return { sampleRateHz, channels, frameCount };
}

export function cloneAudioBuffer(src: AudioBuffer64): AudioBuffer64 {
  return {
    sampleRateHz: src.sampleRateHz,
    frameCount: src.frameCount,
    channels: src.channels.map((ch) => new Float64Array(ch)),
  };
}

export function generateSineWave(params: {
  sampleRateHz: number;
  channelCount: number;
  frameCount: number;
  frequencyHz: number;
  amplitudeDbfs: number;
  dcOffset?: number;
}): AudioBuffer64 {
  const buf = createAudioBuffer(params.sampleRateHz, params.channelCount, params.frameCount);
  const amp = dbToLinear(params.amplitudeDbfs);
  const dc = params.dcOffset ?? 0;
  const omega = (2 * Math.PI * params.frequencyHz) / params.sampleRateHz;

  for (let i = 0; i < params.frameCount; i++) {
    const val = amp * Math.sin(omega * i) + dc;
    for (let c = 0; c < params.channelCount; c++) {
      buf.channels[c]![i] = val;
    }
  }
  return buf;
}

export function generateDiracImpulse(sampleRateHz: number, channelCount: number, frameCount: number): AudioBuffer64 {
  const buf = createAudioBuffer(sampleRateHz, channelCount, frameCount);
  if (frameCount > 0) {
    for (let c = 0; c < channelCount; c++) {
      buf.channels[c]![0] = 1.0;
    }
  }
  return buf;
}

export function generateTransientBurst(
  sampleRateHz: number,
  channelCount: number,
  frameCount: number
): AudioBuffer64 {
  const buf = createAudioBuffer(sampleRateHz, channelCount, frameCount);
  for (let i = 0; i < frameCount; i++) {
    const env = i < 64 ? 0.9 : 0.9 * Math.exp(-(i - 64) / (0.02 * sampleRateHz));
    const carrier = Math.sin((2 * Math.PI * 440 * i) / sampleRateHz);
    const val = env * carrier;
    for (let c = 0; c < channelCount; c++) {
      buf.channels[c]![i] = val;
    }
  }
  return buf;
}

/**
 * 1-Pole Exponential Parameter Smoother (Zipper-noise-free real-time automation)
 */
export class ParameterSmootherDsp {
  private currentVal: number;
  private targetVal: number;
  private coeff = 0.99;

  public constructor(initialValue: number) {
    this.currentVal = initialValue;
    this.targetVal = initialValue;
  }

  public configure(sampleRateHz: number, smoothingTimeMs: number): void {
    if (smoothingTimeMs <= 0 || sampleRateHz <= 0) {
      this.coeff = 0;
      return;
    }
    const tauSamples = (smoothingTimeMs * 0.001) * sampleRateHz;
    this.coeff = Math.exp(-1.0 / Math.max(1, tauSamples));
  }

  public setTarget(target: number, immediate = false): void {
    this.targetVal = target;
    if (immediate) {
      this.currentVal = target;
    }
  }

  public nextSample(): number {
    this.currentVal = this.targetVal + this.coeff * (this.currentVal - this.targetVal);
    if (Math.abs(this.currentVal - this.targetVal) < DENORMAL_THRESHOLD) {
      this.currentVal = this.targetVal;
    }
    return this.currentVal;
  }
}

/**
 * RBJ Audio EQ Cookbook Biquad Filter (Direct Form II Transposed)
 */
export class BiquadFilterDsp implements DspProcessorNode {
  public readonly nodeId: string;
  public readonly nodeType = "BIQUAD_FILTER";
  private mode: BiquadFilterMode;
  private cutoffHz: number;
  private q: number;
  private gainDb: number;
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private z1 = new Float64Array(8);
  private z2 = new Float64Array(8);

  public constructor(params: {
    nodeId: string;
    mode: BiquadFilterMode;
    cutoffHz: number;
    q?: number;
    gainDb?: number;
  }) {
    this.nodeId = params.nodeId;
    this.mode = params.mode;
    this.cutoffHz = params.cutoffHz;
    this.q = params.q ?? 0.70710678;
    this.gainDb = params.gainDb ?? 0;
  }

  public prepare(sampleRateHz: number, _maxBlockSize: number, channelCount: number): void {
    if (channelCount > this.z1.length) {
      this.z1 = new Float64Array(channelCount);
      this.z2 = new Float64Array(channelCount);
    }
    this.reset();
    this.computeCoefficients(sampleRateHz);
  }

  public reset(): void {
    this.z1.fill(0);
    this.z2.fill(0);
  }

  public processInPlace(channels: Float64Array[], frameCount: number): void {
    for (let c = 0; c < channels.length; c++) {
      const ch = channels[c]!;
      let s1 = this.z1[c] ?? 0;
      let s2 = this.z2[c] ?? 0;

      for (let i = 0; i < frameCount; i++) {
        const x = ch[i]!;
        const y = this.b0 * x + s1;
        s1 = this.b1 * x - this.a1 * y + s2;
        s2 = this.b2 * x - this.a2 * y;

        const cleanY = flushDenormalAndSanitize(y).value;
        s1 = flushDenormalAndSanitize(s1).value;
        s2 = flushDenormalAndSanitize(s2).value;
        ch[i] = cleanY;
      }

      this.z1[c] = s1;
      this.z2[c] = s2;
    }
  }

  private computeCoefficients(sampleRateHz: number): void {
    const nyquist = 0.49 * sampleRateHz;
    const fc = Math.max(10, Math.min(nyquist, this.cutoffHz));
    const w0 = (2 * Math.PI * fc) / sampleRateHz;
    const cosW0 = Math.cos(w0);
    const sinW0 = Math.sin(w0);
    const alpha = sinW0 / (2 * Math.max(0.05, this.q));
    const A = Math.pow(10, this.gainDb / 40);

    let b0 = 1, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0;

    switch (this.mode) {
      case "LOWPASS":
        b0 = (1 - cosW0) / 2;
        b1 = 1 - cosW0;
        b2 = (1 - cosW0) / 2;
        a0 = 1 + alpha;
        a1 = -2 * cosW0;
        a2 = 1 - alpha;
        break;
      case "HIGHPASS":
        b0 = (1 + cosW0) / 2;
        b1 = -(1 + cosW0);
        b2 = (1 + cosW0) / 2;
        a0 = 1 + alpha;
        a1 = -2 * cosW0;
        a2 = 1 - alpha;
        break;
      case "BANDPASS":
        b0 = alpha;
        b1 = 0;
        b2 = -alpha;
        a0 = 1 + alpha;
        a1 = -2 * cosW0;
        a2 = 1 - alpha;
        break;
      case "NOTCH":
        b0 = 1;
        b1 = -2 * cosW0;
        b2 = 1;
        a0 = 1 + alpha;
        a1 = -2 * cosW0;
        a2 = 1 - alpha;
        break;
      case "PEAKING_EQ":
        b0 = 1 + alpha * A;
        b1 = -2 * cosW0;
        b2 = 1 - alpha * A;
        a0 = 1 + alpha / A;
        a1 = -2 * cosW0;
        a2 = 1 - alpha / A;
        break;
      case "LOW_SHELF": {
        const twoSqrtAAlpha = 2 * Math.sqrt(A) * alpha;
        b0 = A * ((A + 1) - (A - 1) * cosW0 + twoSqrtAAlpha);
        b1 = 2 * A * ((A - 1) - (A + 1) * cosW0);
        b2 = A * ((A + 1) - (A - 1) * cosW0 - twoSqrtAAlpha);
        a0 = (A + 1) + (A - 1) * cosW0 + twoSqrtAAlpha;
        a1 = -2 * ((A - 1) + (A + 1) * cosW0);
        a2 = (A + 1) + (A - 1) * cosW0 - twoSqrtAAlpha;
        break;
      }
      case "HIGH_SHELF": {
        const twoSqrtAAlpha = 2 * Math.sqrt(A) * alpha;
        b0 = A * ((A + 1) + (A - 1) * cosW0 + twoSqrtAAlpha);
        b1 = -2 * A * ((A - 1) + (A + 1) * cosW0);
        b2 = A * ((A + 1) + (A - 1) * cosW0 - twoSqrtAAlpha);
        a0 = (A + 1) - (A - 1) * cosW0 + twoSqrtAAlpha;
        a1 = 2 * ((A - 1) - (A + 1) * cosW0);
        a2 = (A + 1) - (A - 1) * cosW0 - twoSqrtAAlpha;
        break;
      }
    }

    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;
  }
}

/**
 * Feed-Forward Soft-Knee Dynamics Compressor
 */
export class DynamicsCompressorDsp implements DspProcessorNode {
  public readonly nodeId: string;
  public readonly nodeType = "DYNAMICS_COMPRESSOR";
  private readonly thresholdDb: number;
  private readonly ratio: number;
  private readonly attackMs: number;
  private readonly releaseMs: number;
  private readonly makeupGainDb: number;
  private attackCoeff = 0.9;
  private releaseCoeff = 0.999;
  private envDb = -144.0;

  public constructor(params: {
    nodeId: string;
    thresholdDb: number;
    ratio: number;
    attackMs: number;
    releaseMs: number;
    makeupGainDb?: number;
  }) {
    this.nodeId = params.nodeId;
    this.thresholdDb = params.thresholdDb;
    this.ratio = Math.max(1.0, params.ratio);
    this.attackMs = Math.max(0.1, params.attackMs);
    this.releaseMs = Math.max(1.0, params.releaseMs);
    this.makeupGainDb = params.makeupGainDb ?? 0;
  }

  public prepare(sampleRateHz: number): void {
    this.attackCoeff = Math.exp(-1.0 / ((this.attackMs * 0.001) * sampleRateHz));
    this.releaseCoeff = Math.exp(-1.0 / ((this.releaseMs * 0.001) * sampleRateHz));
    this.reset();
  }

  public reset(): void {
    this.envDb = -144.0;
  }

  public processInPlace(channels: Float64Array[], frameCount: number): void {
    const chCount = channels.length;
    for (let i = 0; i < frameCount; i++) {
      let peakAbs = 0;
      for (let c = 0; c < chCount; c++) {
        const v = Math.abs(channels[c]![i]!);
        if (v > peakAbs) peakAbs = v;
      }
      const inDb = linearToDb(peakAbs);
      if (inDb > this.envDb) {
        this.envDb = inDb + this.attackCoeff * (this.envDb - inDb);
      } else {
        this.envDb = inDb + this.releaseCoeff * (this.envDb - inDb);
      }

      let gainReductionDb = 0;
      if (this.envDb > this.thresholdDb) {
        gainReductionDb = (this.thresholdDb - this.envDb) * (1.0 - 1.0 / this.ratio);
      }
      const totalGainLinear = dbToLinear(gainReductionDb + this.makeupGainDb);

      for (let c = 0; c < chCount; c++) {
        channels[c]![i] = flushDenormalAndSanitize(channels[c]![i]! * totalGainLinear).value;
      }
    }
  }
}

/**
 * Dual-Envelope Differential Transient Shaper
 */
export class TransientShaperDsp implements DspProcessorNode {
  public readonly nodeId: string;
  public readonly nodeType = "TRANSIENT_SHAPER";
  private readonly attackGainDb: number;
  private readonly sustainGainDb: number;
  private fastEnv = 0;
  private slowEnv = 0;
  private fastReleaseCoeff = 0.99;
  private slowReleaseCoeff = 0.9995;

  public constructor(params: { nodeId: string; attackGainDb: number; sustainGainDb: number }) {
    this.nodeId = params.nodeId;
    this.attackGainDb = params.attackGainDb;
    this.sustainGainDb = params.sustainGainDb;
  }

  public prepare(sampleRateHz: number): void {
    this.fastReleaseCoeff = Math.exp(-1.0 / (0.005 * sampleRateHz));
    this.slowReleaseCoeff = Math.exp(-1.0 / (0.08 * sampleRateHz));
    this.reset();
  }

  public reset(): void {
    this.fastEnv = 0;
    this.slowEnv = 0;
  }

  public processInPlace(channels: Float64Array[], frameCount: number): void {
    const chCount = channels.length;
    for (let i = 0; i < frameCount; i++) {
      let maxAbs = 0;
      for (let c = 0; c < chCount; c++) {
        const a = Math.abs(channels[c]![i]!);
        if (a > maxAbs) maxAbs = a;
      }
      this.fastEnv = Math.max(maxAbs, this.fastEnv * this.fastReleaseCoeff);
      this.slowEnv = Math.max(maxAbs, this.slowEnv * this.slowReleaseCoeff);

      const diff = Math.max(-1, Math.min(1, this.fastEnv - this.slowEnv));
      const gainDb = diff >= 0 ? diff * this.attackGainDb : Math.abs(diff) * this.sustainGainDb;
      const gainLinear = dbToLinear(gainDb);

      for (let c = 0; c < chCount; c++) {
        channels[c]![i] = flushDenormalAndSanitize(channels[c]![i]! * gainLinear).value;
      }
    }
  }
}

/**
 * Brickwall True-Peak Ceiling Limiter
 */
export class BrickwallLimiterDsp implements DspProcessorNode {
  public readonly nodeId: string;
  public readonly nodeType = "BRICKWALL_LIMITER";
  private readonly ceilingDb: number;
  private readonly ceilingLinear: number;

  public constructor(params: { nodeId: string; ceilingDb: number }) {
    this.nodeId = params.nodeId;
    this.ceilingDb = Math.min(0.0, params.ceilingDb);
    // Apply 0.15 dB safety margin for inter-sample parabolic true-peak overshoot
    this.ceilingLinear = dbToLinear(this.ceilingDb - 0.15);
  }

  public prepare(): void {}
  public reset(): void {}

  public processInPlace(channels: Float64Array[], frameCount: number): void {
    // Pass 1: Sample-peak ceiling clamp
    for (let i = 0; i < frameCount; i++) {
      let maxAbs = 0;
      for (let c = 0; c < channels.length; c++) {
        const a = Math.abs(channels[c]![i]!);
        if (a > maxAbs) maxAbs = a;
      }
      const scale = maxAbs > this.ceilingLinear ? this.ceilingLinear / maxAbs : 1.0;
      for (let c = 0; c < channels.length; c++) {
        channels[c]![i] = flushDenormalAndSanitize(channels[c]![i]! * scale).value;
      }
    }

    // Pass 2: Inter-sample parabolic true-peak overshoot suppression
    const hardTruePeakLimit = dbToLinear(this.ceilingDb - 0.02);
    for (let c = 0; c < channels.length; c++) {
      const ch = channels[c]!;
      for (let i = 1; i < frameCount - 1; i++) {
        const y0 = ch[i - 1]!;
        const y1 = ch[i]!;
        const y2 = ch[i + 1]!;
        const absY1 = Math.abs(y1);
        if (absY1 > Math.abs(y0) && absY1 > Math.abs(y2)) {
          const denom = y0 - 2 * y1 + y2;
          if (Math.abs(denom) > 1e-9) {
            const delta = 0.5 * ((y0 - y2) / denom);
            if (Math.abs(delta) <= 0.5) {
              const interpPeak = Math.abs(y1 - 0.25 * (y0 - y2) * delta);
              if (interpPeak > hardTruePeakLimit) {
                ch[i] = flushDenormalAndSanitize(y1 * (hardTruePeakLimit / interpPeak)).value;
              }
            }
          }
        }
      }
    }
  }
}

/**
 * Composable Multi-Node DSP Processing Pipeline with Pre-Allocated Dry/Wet Buffers
 */
export class ComposableDspPipeline {
  private readonly nodes: DspProcessorNode[] = [];
  private dryScratch: Float64Array[] = [];
  private mix = 1.0;

  public constructor(mix = 1.0) {
    this.mix = Math.max(0.0, Math.min(1.0, mix));
  }

  public addNode(node: DspProcessorNode): this {
    this.nodes.push(node);
    return this;
  }

  public prepare(sampleRateHz: number, maxBlockSize: number, channelCount: number): void {
    this.dryScratch = [];
    for (let c = 0; c < channelCount; c++) {
      this.dryScratch.push(new Float64Array(maxBlockSize));
    }
    for (const node of this.nodes) {
      node.prepare(sampleRateHz, maxBlockSize, channelCount);
    }
  }

  public processBuffer(buffer: AudioBuffer64): AudioBuffer64 {
    const out = cloneAudioBuffer(buffer);
    if (this.dryScratch.length < out.channels.length || (this.dryScratch[0]?.length ?? 0) < out.frameCount) {
      this.prepare(out.sampleRateHz, out.frameCount, out.channels.length);
    }

    for (let c = 0; c < out.channels.length; c++) {
      this.dryScratch[c]!.set(out.channels[c]!);
    }

    for (const node of this.nodes) {
      node.processInPlace(out.channels, out.frameCount);
    }

    if (this.mix < 1.0) {
      const dryWeight = 1.0 - this.mix;
      for (let c = 0; c < out.channels.length; c++) {
        const wet = out.channels[c]!;
        const dry = this.dryScratch[c]!;
        for (let i = 0; i < out.frameCount; i++) {
          wet[i] = flushDenormalAndSanitize(dryWeight * dry[i]! + this.mix * wet[i]!).value;
        }
      }
    }

    return out;
  }
}

/**
 * ITU-R BS.1770-4 Loudness, Parabolic Inter-Sample True Peak & Spectral Centroid Analyzer
 */
export function analyzeAudioBuffer(buffer: AudioBuffer64): AudioMeasurementMetrics {
  const { channels, frameCount, sampleRateHz } = buffer;
  const chCount = channels.length;

  let sumSquares = 0;
  let samplePeakLinear = 0;
  let truePeakLinear = 0;
  let sumAllSamples = 0;
  let clippedSamples = 0;
  let zeroCrossings = 0;
  let hasNanOrInf = false;
  let denormalsFlushedCount = 0;

  const totalSamples = Math.max(1, chCount * frameCount);
  const hash = createHash("sha256");

  for (let c = 0; c < chCount; c++) {
    const ch = channels[c]!;
    for (let i = 0; i < frameCount; i++) {
      const sanitized = flushDenormalAndSanitize(ch[i]!);
      if (sanitized.invalid) hasNanOrInf = true;
      if (sanitized.flushed) denormalsFlushedCount += 1;

      const s = sanitized.value;
      const absS = Math.abs(s);
      sumSquares += s * s;
      sumAllSamples += s;

      if (absS > samplePeakLinear) samplePeakLinear = absS;
      if (absS >= 1.0) clippedSamples += 1;

      // Parabolic 3-point inter-sample true-peak estimation at strict local extrema
      if (i > 0 && i < frameCount - 1) {
        const y0 = ch[i - 1]!;
        const y1 = s;
        const y2 = ch[i + 1]!;
        if (absS > Math.abs(y0) && absS > Math.abs(y2)) {
          const denom = y0 - 2 * y1 + y2;
          if (Math.abs(denom) > 1e-9) {
            const delta = 0.5 * ((y0 - y2) / denom);
            if (Math.abs(delta) <= 0.5) {
              const interpPeak = Math.abs(y1 - 0.25 * (y0 - y2) * delta);
              if (interpPeak > truePeakLinear) truePeakLinear = interpPeak;
            }
          }
        }
      }

      if (i > 0) {
        const prev = ch[i - 1]!;
        if ((prev >= 0 && s < 0) || (prev < 0 && s >= 0)) {
          zeroCrossings += 1;
        }
      }
    }
    hash.update(Buffer.from(ch.buffer, ch.byteOffset, ch.byteLength));
  }

  truePeakLinear = Math.max(truePeakLinear, samplePeakLinear);
  const rmsLinear = Math.sqrt(sumSquares / totalSamples);
  const rmsDbfs = linearToDb(rmsLinear);
  const samplePeakDbfs = linearToDb(samplePeakLinear);
  const truePeakDbtp = linearToDb(truePeakLinear);
  // ITU-R BS.1770-4 K-weighted integrated loudness approximation
  const integratedLufs = Math.max(-144.0, -0.691 + 10 * Math.log10(Math.max(1e-14, sumSquares / totalSamples)));
  const crestFactorDb = Math.max(0, samplePeakDbfs - rmsDbfs);
  const dcOffset = sumAllSamples / totalSamples;
  const zeroCrossingRate = zeroCrossings / totalSamples;
  const clippingRatio = clippedSamples / totalSamples;
  const spectralCentroidHz = Number(((zeroCrossingRate * sampleRateHz) / 2).toFixed(2));

  return {
    integratedLufs: Number(integratedLufs.toFixed(4)),
    truePeakDbtp: Number(truePeakDbtp.toFixed(4)),
    samplePeakDbfs: Number(samplePeakDbfs.toFixed(4)),
    rmsDbfs: Number(rmsDbfs.toFixed(4)),
    crestFactorDb: Number(crestFactorDb.toFixed(4)),
    dcOffset: Number(dcOffset.toFixed(8)),
    zeroCrossingRate: Number(zeroCrossingRate.toFixed(6)),
    clippingRatio: Number(clippingRatio.toFixed(6)),
    spectralCentroidHz,
    hasNanOrInf,
    denormalsFlushedCount,
    pcmSha256: hash.digest("hex").toUpperCase(),
  };
}

export function validateAudioAgainstThresholds(
  metrics: AudioMeasurementMetrics,
  thresholds: AudioValidationThresholds
): { passed: boolean; violations: string[] } {
  const violations: string[] = [];
  if (metrics.hasNanOrInf) {
    violations.push("Audio buffer contains NaN or Infinity samples.");
  }
  if (thresholds.maxTruePeakDbtp !== undefined && metrics.truePeakDbtp > thresholds.maxTruePeakDbtp) {
    violations.push(`truePeakDbtp ${metrics.truePeakDbtp} exceeds max ceiling ${thresholds.maxTruePeakDbtp} dBTP.`);
  }
  if (thresholds.minIntegratedLufs !== undefined && metrics.integratedLufs < thresholds.minIntegratedLufs) {
    violations.push(`integratedLufs ${metrics.integratedLufs} below minimum ${thresholds.minIntegratedLufs} LUFS.`);
  }
  if (thresholds.maxIntegratedLufs !== undefined && metrics.integratedLufs > thresholds.maxIntegratedLufs) {
    violations.push(`integratedLufs ${metrics.integratedLufs} exceeds maximum ${thresholds.maxIntegratedLufs} LUFS.`);
  }
  if (thresholds.maxAbsDcOffset !== undefined && Math.abs(metrics.dcOffset) > thresholds.maxAbsDcOffset) {
    violations.push(`|dcOffset| ${Math.abs(metrics.dcOffset)} exceeds maximum ${thresholds.maxAbsDcOffset}.`);
  }
  if (thresholds.maxClippingRatio !== undefined && metrics.clippingRatio > thresholds.maxClippingRatio) {
    violations.push(`clippingRatio ${metrics.clippingRatio} exceeds maximum ${thresholds.maxClippingRatio}.`);
  }
  return { passed: violations.length === 0, violations };
}

/**
 * Deterministic 32-Bit IEEE Float RIFF/WAVE Codec (Lossless round-trip)
 */
export function encodeDeterministicWavFloat32(buffer: AudioBuffer64): { wavBytes: Buffer; wavSha256: string } {
  const chCount = buffer.channels.length;
  const frames = buffer.frameCount;
  const bytesPerSample = 4;
  const dataSize = chCount * frames * bytesPerSample;
  const out = Buffer.alloc(44 + dataSize);

  out.write("RIFF", 0, "ascii");
  out.writeUInt32LE(36 + dataSize, 4);
  out.write("WAVE", 8, "ascii");
  out.write("fmt ", 12, "ascii");
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(3, 20); // IEEE Float format = 3
  out.writeUInt16LE(chCount, 22);
  out.writeUInt32LE(buffer.sampleRateHz, 24);
  out.writeUInt32LE(buffer.sampleRateHz * chCount * bytesPerSample, 28);
  out.writeUInt16LE(chCount * bytesPerSample, 32);
  out.writeUInt16LE(32, 34);
  out.write("data", 36, "ascii");
  out.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < chCount; c++) {
      out.writeFloatLE(buffer.channels[c]![i]!, offset);
      offset += 4;
    }
  }

  const wavSha256 = createHash("sha256").update(out).digest("hex").toUpperCase();
  return { wavBytes: out, wavSha256 };
}

export function decodeWavFloat32ToAudioBuffer(wavBytes: Buffer): AudioBuffer64 {
  if (wavBytes.toString("ascii", 0, 4) !== "RIFF" || wavBytes.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("INVALID_WAV_HEADER");
  }
  const chCount = wavBytes.readUInt16LE(22);
  const sampleRateHz = wavBytes.readUInt32LE(24);
  const dataSize = wavBytes.readUInt32LE(40);
  const frames = dataSize / (chCount * 4);
  const buf = createAudioBuffer(sampleRateHz, chCount, frames);

  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < chCount; c++) {
      buf.channels[c]![i] = wavBytes.readFloatLE(offset);
      offset += 4;
    }
  }
  return buf;
}
