import {
  type AudioBuffer64,
  analyzeAudioBuffer,
  createAudioBuffer,
  linearToDb,
} from "../../DSP_ENGINE/src/index.ts";

/**
 * AETHER FORGE — SPECIALIZED AUDIO & REAL-TIME WCET TEST HARNESS
 */

export function runPhaseCancellationNullTest(
  bufferA: AudioBuffer64,
  bufferB: AudioBuffer64
): { nullResidualPeakDbfs: number; bitIdentical: boolean } {
  if (
    bufferA.frameCount !== bufferB.frameCount ||
    bufferA.channels.length !== bufferB.channels.length
  ) {
    throw new Error("NULL_TEST_DIMENSION_MISMATCH");
  }

  let maxAbsDiff = 0;
  for (let c = 0; c < bufferA.channels.length; c++) {
    const chA = bufferA.channels[c]!;
    const chB = bufferB.channels[c]!;
    for (let i = 0; i < bufferA.frameCount; i++) {
      const diff = Math.abs(chA[i]! - chB[i]!);
      if (diff > maxAbsDiff) maxAbsDiff = diff;
    }
  }

  const nullResidualPeakDbfs = linearToDb(maxAbsDiff, -144.0);
  return {
    nullResidualPeakDbfs,
    bitIdentical: maxAbsDiff === 0,
  };
}

export function profileRealtimeAudioCallbackWcet(params: {
  sampleRateHz: number;
  blockSizeSamples: number;
  iterations: number;
  callback: (block: AudioBuffer64) => void;
}): {
  bufferDeadlineMicroseconds: number;
  maxWcetMicroseconds: number;
  averageMicroseconds: number;
  utilizationRatio: number;
  withinRealtimeBudget: boolean;
} {
  const block = createAudioBuffer(params.sampleRateHz, 2, params.blockSizeSamples);
  for (let i = 0; i < params.blockSizeSamples; i++) {
    block.channels[0]![i] = 0.25 * Math.sin((2 * Math.PI * 440 * i) / params.sampleRateHz);
    block.channels[1]![i] = block.channels[0]![i]!;
  }

  // Warmup
  for (let w = 0; w < 5; w++) {
    params.callback(block);
  }

  let maxNs = 0n;
  let totalNs = 0n;
  const iters = Math.max(1, params.iterations);

  for (let k = 0; k < iters; k++) {
    const t0 = process.hrtime.bigint();
    params.callback(block);
    const elapsedNs = process.hrtime.bigint() - t0;
    if (elapsedNs > maxNs) maxNs = elapsedNs;
    totalNs += elapsedNs;
  }

  const bufferDeadlineMicroseconds = (params.blockSizeSamples / params.sampleRateHz) * 1_000_000;
  const maxWcetMicroseconds = Number(maxNs) / 1_000;
  const averageMicroseconds = Number(totalNs / BigInt(iters)) / 1_000;
  const utilizationRatio = averageMicroseconds / bufferDeadlineMicroseconds;

  const metrics = analyzeAudioBuffer(block);
  return {
    bufferDeadlineMicroseconds: Number(bufferDeadlineMicroseconds.toFixed(2)),
    maxWcetMicroseconds: Number(maxWcetMicroseconds.toFixed(2)),
    averageMicroseconds: Number(averageMicroseconds.toFixed(2)),
    utilizationRatio: Number(utilizationRatio.toFixed(4)),
    withinRealtimeBudget: utilizationRatio < 0.3 && !metrics.hasNanOrInf,
  };
}
