import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import {
  parseAndInspectPcm16WavBuffer,
  synthesizeGoldenPcm16Wav,
} from "@aether-forge/audio-engine";
import {
  computeCanonicalPlanHash,
  SCHEMA_VERSION_V1,
} from "@aether-forge/contracts";
import { OpaPolicyDecisionPoint } from "@aether-forge/policy";
import {
  sampleExecutionPlan,
  sampleRequestContext,
} from "@aether-forge/test-fixtures";

describe("PHASE 12 — Performance and latency budget gate", () => {
  it("evaluates 200 OPA policy decisions and canonical plan hashes within deterministic latency budgets", () => {
    const pdp = new OpaPolicyDecisionPoint();
    const iterations = 200;

    const startMs = performance.now();
    for (let i = 0; i < iterations; i += 1) {
      const decision = pdp.evaluate({
        schemaVersion: SCHEMA_VERSION_V1,
        tenantId: "tenant-alpha",
        projectId: "proj-synth-01",
        actor: sampleRequestContext.actor,
        actionClass: "write_workspace",
        classification: "CONFIDENTIAL",
      });
      expect(decision.decision).toBe("requireApproval");
      const hash = computeCanonicalPlanHash(sampleExecutionPlan);
      expect(hash).toBe(sampleExecutionPlan.planHash);
    }
    const elapsedMs = performance.now() - startMs;
    const avgMs = elapsedMs / iterations;

    // Budget: average policy evaluation + canonical SHA-256 plan hash < 2.0 ms per iteration
    expect(avgMs).toBeLessThan(2.0);
  });

  it("synthesizes and inspects 1 second of 48kHz stereo PCM16 WAV (192 KB) in under 50ms", () => {
    const startMs = performance.now();
    const wavBuffer = synthesizeGoldenPcm16Wav({
      sampleRate: 48_000,
      channels: 2,
      frameCount: 48_000,
      frequencyHz: 440,
      peakAmplitudeInt16: 16_384,
    });
    const inspectRes = parseAndInspectPcm16WavBuffer(
      wavBuffer,
      "stems/perf_1sec.wav",
      "trace-perf-01",
    );
    const elapsedMs = performance.now() - startMs;

    expect(inspectRes.ok).toBe(true);
    expect(elapsedMs).toBeLessThan(50);
  });
});
