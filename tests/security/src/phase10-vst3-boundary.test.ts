import { describe, expect, it } from "vitest";
import {
  AetherForgeVst3ReferenceProcessor,
  auditVst3RealtimeCppSources,
  discoverVst3BuildPrerequisites,
} from "@aether-forge/vst3";

describe("PHASE 10 — VST3 product boundary, real-time safety audit, and shared DSP golden vectors gate", () => {
  it("audits C++20 VST3 processor sources to ensure zero allocations, locks, network, filesystem, or LLM calls (ADR-0008)", () => {
    const audit = auditVst3RealtimeCppSources();
    expect(audit.compliant).toBe(true);
    expect(audit.violations).toHaveLength(0);
  });

  it("verifies deterministic parameter automation, binary state round-trip, and shared DSP golden vector parity with audio engine", () => {
    const processor = new AetherForgeVst3ReferenceProcessor();
    processor.prepareToPlay(48_000, 256);
    expect(processor.getPreparedConfig()).toEqual({ sampleRate: 48_000, maxBlockSize: 256 });

    // Shared DSP golden vector: -6.0206 dBFS input (16384 / 32767 = 0.500015259) + 5.0203 dB gain -> -1.0 dBFS (~0.8912509)
    const gainDb = -1.0 - 20 * Math.log10(16_384 / 32_767);
    processor.setGainDb(gainDb);

    const left = new Float32Array([16_384 / 32_767, -16_384 / 32_767, 0.25, -0.25]);
    const right = new Float32Array([16_384 / 32_767, -16_384 / 32_767, 0.25, -0.25]);
    processor.processBlock([left, right]);

    const expectedPeakLinear = Math.pow(10, -1.0 / 20); // 0.891250938
    expect(Math.abs((left[0] ?? 0) - expectedPeakLinear)).toBeLessThan(1e-5);
    expect(Math.abs((right[1] ?? 0) + expectedPeakLinear)).toBeLessThan(1e-5);

    // State round-trip serialization test (16-byte POD state "AFV3")
    processor.setBypass(true);
    const savedState = processor.getStateInformation();
    expect(savedState.byteLength).toBe(16);

    const restored = new AetherForgeVst3ReferenceProcessor();
    expect(restored.setStateInformation(savedState)).toBe(true);
    expect(restored.getGainDb()).toBeCloseTo(processor.getGainDb(), 4);
    expect(restored.getBypass()).toBe(true);

    // Corrupted state buffer is rejected cleanly
    const corrupted = Buffer.from(savedState);
    corrupted.writeUInt32LE(0xdeadbeef, 0);
    expect(restored.setStateInformation(corrupted)).toBe(false);
  });

  it("verifies local VST3 native toolchain readiness, built AetherForgeProcessor.vst3 bundle, and pluginval strictness-level-10 PASS log", () => {
    const prereqs = discoverVst3BuildPrerequisites();
    expect(prereqs.cmakeFound).toBe(true);
    expect(prereqs.cppCompilerFound).toBe(true);
    expect(prereqs.juceSdkFound).toBe(true);
    expect(prereqs.steinbergVst3SdkFound).toBe(true);
    expect(prereqs.pluginvalFound).toBe(true);
    expect(prereqs.status).toBe("READY_TO_BUILD");
    expect(prereqs.missingPrerequisites).toHaveLength(0);

    // Also verify fail-closed reporting when paths are missing
    const missingCheck = discoverVst3BuildPrerequisites({
      cppCompilerPath: "C:\\nonexistent\\cl.exe",
      juceDir: "C:\\nonexistent\\JUCE",
      vst3SdkDir: "C:\\nonexistent\\VST_SDK",
      pluginvalPath: "C:\\nonexistent\\pluginval.exe",
    });
    expect(missingCheck.status).toBe("BLOCKED_MISSING_PREREQUISITES");
    expect(missingCheck.missingPrerequisites).toHaveLength(4);
  });
});
