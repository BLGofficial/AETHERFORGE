import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  analyzeAudioBuffer,
  BiquadFilterDsp,
  BrickwallLimiterDsp,
  ComposableDspPipeline,
  decodeWavFloat32ToAudioBuffer,
  DynamicsCompressorDsp,
  encodeDeterministicWavFloat32,
  generateSineWave,
  generateTransientBurst,
  TransientShaperDsp,
  validateAudioAgainstThresholds,
} from "../../DSP_ENGINE/src/index.ts";
import {
  Vst3AudioProcessor,
  Vst3EditController,
  Vst3HostCompatibilityHarness,
} from "../../VST3_ENGINE/src/index.ts";
import {
  DawCapabilityRegistry,
  FlStudio2025DomainAdapter,
  ReaperRppDomainAdapter,
  transformMidiPattern,
  validateTrackRoutingGraph,
} from "../../DAW_ADAPTER_FRAMEWORK/src/index.ts";
import {
  profileRealtimeAudioCallbackWcet,
  runPhaseCancellationNullTest,
} from "../src/index.ts";

describe("AETHER FORGE Specialized Audio, VST3 & Multi-DAW Domain Architecture", () => {
  it("SUBSYSTEM A (DSP_ENGINE): processes composable DSP pipelines deterministically, enforces True-Peak ceiling, and round-trips RIFF WAV losslessly", () => {
    // 1. Generate 1 kHz +3 dBFS hot sine wave and pass through Highpass + Compressor + Transient Shaper + -1.0 dBTP Brickwall Limiter
    const hotInput = generateSineWave({
      sampleRateHz: 48_000,
      channelCount: 2,
      frameCount: 4_800,
      frequencyHz: 1_000,
      amplitudeDbfs: 3.0,
    });

    const createChain = () =>
      new ComposableDspPipeline(1.0)
        .addNode(new BiquadFilterDsp({ nodeId: "HPF-80", mode: "HIGHPASS", cutoffHz: 80 }))
        .addNode(
          new DynamicsCompressorDsp({
            nodeId: "COMP-1",
            thresholdDb: -12,
            ratio: 4,
            attackMs: 5,
            releaseMs: 50,
            makeupGainDb: 1.5,
          })
        )
        .addNode(new TransientShaperDsp({ nodeId: "TS-1", attackGainDb: 2.0, sustainGainDb: -1.0 }))
        .addNode(new BrickwallLimiterDsp({ nodeId: "LIM-1", ceilingDb: -1.0 }));

    const outA = createChain().processBuffer(hotInput);
    const outB = createChain().processBuffer(hotInput);

    // Null test between two independent runs -> bit-identical (0 residual, -144 dBFS)
    const nullTest = runPhaseCancellationNullTest(outA, outB);
    expect(nullTest.bitIdentical).toBe(true);
    expect(nullTest.nullResidualPeakDbfs).toBe(-144);

    // Verify limiter enforced True-Peak ceiling <= -1.0 dBTP and zero clipping/NaN/Inf
    const metrics = analyzeAudioBuffer(outA);
    const validation = validateAudioAgainstThresholds(metrics, {
      maxTruePeakDbtp: -1.0,
      maxAbsDcOffset: 0.01,
      maxClippingRatio: 0,
    });
    expect(validation.passed).toBe(true);

    // Verify lowpass filter attenuates a 10 kHz tone while passing a 200 Hz tone
    const lowTone = generateSineWave({
      sampleRateHz: 48_000,
      channelCount: 1,
      frameCount: 2_400,
      frequencyHz: 200,
      amplitudeDbfs: -6,
    });
    const highTone = generateSineWave({
      sampleRateHz: 48_000,
      channelCount: 1,
      frameCount: 2_400,
      frequencyHz: 10_000,
      amplitudeDbfs: -6,
    });
    const lpf = new ComposableDspPipeline(1.0).addNode(
      new BiquadFilterDsp({ nodeId: "LPF-1K", mode: "LOWPASS", cutoffHz: 1_000 })
    );
    const lowFilteredMetrics = analyzeAudioBuffer(lpf.processBuffer(lowTone));
    const highFilteredMetrics = analyzeAudioBuffer(lpf.processBuffer(highTone));
    expect(lowFilteredMetrics.rmsDbfs).toBeGreaterThan(highFilteredMetrics.rmsDbfs + 20);

    // Verify RIFF WAV Float32 lossless encode/decode round-trip
    const transientSignal = generateTransientBurst(48_000, 2, 1_024);
    const encoded = encodeDeterministicWavFloat32(transientSignal);
    const decoded = decodeWavFloat32ToAudioBuffer(encoded.wavBytes);
    expect(decoded.sampleRateHz).toBe(48_000);
    expect(decoded.frameCount).toBe(1_024);
    expect(encodeDeterministicWavFloat32(decoded).wavSha256).toBe(encoded.wavSha256);
  });

  it("SUBSYSTEM B (VST3_ENGINE): enforces Plane 2 IEditController vs. Plane 3 IAudioProcessor separation, passes host torture tests, and meets WCET budget", () => {
    const processor = new Vst3AudioProcessor();
    const controller = new Vst3EditController(processor.getRegistry());

    // Plane 2 UI / AI Copilot queues parameter automation points
    controller.setParamPlainFromUiOrAiCopilot("inputGainDb", 3.0, 0);
    controller.setParamPlainFromUiOrAiCopilot("ceilingDb", -0.5, 16);
    const queue = controller.drainAutomationQueueForNextAudioBlock();
    expect(queue).toHaveLength(2);

    // Plane 3 audio thread consumes parameter queue and updates lock-free GUI meters
    processor.setupProcessing(48_000, 256, 2);
    const inBuf = generateSineWave({
      sampleRateHz: 48_000,
      channelCount: 2,
      frameCount: 256,
      frequencyHz: 440,
      amplitudeDbfs: -6.0,
    });
    const outBuf = processor.processBlock(inBuf, queue);
    const outMetrics = analyzeAudioBuffer(outBuf);
    expect(outMetrics.truePeakDbtp).toBeLessThanOrEqual(-0.5);

    const meters = processor.readGuiMeterSnapshotLockFree();
    expect(meters.activeBypass).toBe(false);
    expect(meters.outputPeakDbfs).toBeLessThanOrEqual(-0.5);

    // Run full VST3 Host Compatibility & Torture Harness (block sizes 1..4096, sample rates 44.1..96kHz, NaN/denormal bursts, preset roundtrip)
    const harness = new Vst3HostCompatibilityHarness();
    const hostReport = harness.runHostTortureSuite(processor);
    expect(hostReport.passed).toBe(true);
    expect(hostReport.zeroLengthBlockHandled).toBe(true);
    expect(hostReport.denormalNanBurstClean).toBe(true);
    expect(hostReport.stateRoundtripVerified).toBe(true);

    // Profile Real-Time WCET against 256-sample buffer deadline at 48 kHz (5,333.33 us deadline)
    const wcetReport = profileRealtimeAudioCallbackWcet({
      sampleRateHz: 48_000,
      blockSizeSamples: 256,
      iterations: 20,
      callback: (block) => {
        processor.processBlock(block);
      },
    });
    expect(wcetReport.withinRealtimeBudget).toBe(true);
    expect(wcetReport.utilizationRatio).toBeLessThan(0.3);
  });

  it("SUBSYSTEM C (DAW_ADAPTER_FRAMEWORK): supports multi-DAW replaceable adapters (FL Studio 2025 + REAPER), inspects real .flp projects read-only, and blocks undocumented mutations", () => {
    const registry = new DawCapabilityRegistry()
      .registerAdapter(new FlStudio2025DomainAdapter())
      .registerAdapter(new ReaperRppDomainAdapter());

    expect(registry.listAdapters()).toHaveLength(2);

    const flAdapter = registry.getAdapter("fl-studio-2025");
    const reaperAdapter = registry.getAdapter("cockos-reaper");

    // 1. Verify FL Studio 2025 read-only inspection on real factory .flp file if installed
    const factoryFlpPath = "C:\\Program Files\\Image-Line\\FL Studio 2025\\Data\\Demo projects\\NewStuff.flp";
    if (existsSync(factoryFlpPath)) {
      const report = flAdapter.inspectProjectReadOnly(factoryFlpPath);
      expect(report.projectFormatSignature).toBe("FLhd/FLdt");
      expect(report.channelOrTrackCount).toBe(45);
      expect(report.ppq).toBe(96);
      expect(report.sourceBytesModified).toBe(0);
    }

    // 2. Verify FL Studio 2025 Python MIDI Controller script generation for supported capability
    const bridgeRes = flAdapter.executeCapabilityOperation({
      capability: "vst3_plugin_parameter_host_automation",
      parameters: { trackIndex: 1, slotIndex: 0, paramIndex: 2, normalizedValue: 0.75 },
    });
    expect(bridgeRes.allowed).toBe(true);
    expect(bridgeRes.payload).toContain("plugins.setParamValue(0.7500, 2, 1, 0)");

    // 3. Verify FL Studio 2025 strictly refuses undocumented/destructive capabilities
    for (const forbidden of [
      "direct_flp_binary_mutation",
      "fl_engine_dll_memory_injection",
      "undocumented_window_message_spoofing",
    ] as const) {
      const denied = flAdapter.executeCapabilityOperation({
        capability: forbidden,
        parameters: {},
      });
      expect(denied.allowed).toBe(false);
      expect(denied.errorCode).toBe("DAW_CAPABILITY_UNSUPPORTED");
    }

    // 4. Verify multi-DAW replaceability via Cockos REAPER .rpp inspection
    const sampleRpp = [
      '<REAPER_PROJECT 0.1 "7.15/win64" 1710000000',
      "  <TRACK {1111}",
      '    NAME "Kick"',
      "  >",
      "  <TRACK {2222}",
      '    NAME "Bass"',
      "  >",
      ">",
    ].join("\n");
    const reaperReport = reaperAdapter.inspectProjectReadOnly(sampleRpp);
    expect(reaperReport.dawId).toBe("cockos-reaper");
    expect(reaperReport.channelOrTrackCount).toBe(2);
    expect(reaperReport.dawVersionString).toBe("7.15/win64");

    // 5. Verify Track & Mixer Routing DAG validation (valid DAG vs. feedback cycle detection)
    const validRouting = validateTrackRoutingGraph([
      {
        trackId: "TRK-1",
        name: "Lead Synth",
        role: "INSTRUMENT",
        gainDb: -3,
        pan: 0,
        muted: false,
        routedToTrackIds: ["BUS-1"],
        insertedPluginIds: ["AETHER-VST3"],
      },
      {
        trackId: "BUS-1",
        name: "Synth Bus",
        role: "BUS",
        gainDb: 0,
        pan: 0,
        muted: false,
        routedToTrackIds: ["MASTER"],
        insertedPluginIds: [],
      },
      {
        trackId: "MASTER",
        name: "Master Out",
        role: "MASTER",
        gainDb: 0,
        pan: 0,
        muted: false,
        routedToTrackIds: [],
        insertedPluginIds: ["AETHER-LIMITER"],
      },
    ]);
    expect(validRouting.valid).toBe(true);
    expect(validRouting.hasFeedbackLoop).toBe(false);

    const cyclicRouting = validateTrackRoutingGraph([
      {
        trackId: "BUS-A",
        name: "Bus A",
        role: "BUS",
        gainDb: 0,
        pan: 0,
        muted: false,
        routedToTrackIds: ["BUS-B"],
        insertedPluginIds: [],
      },
      {
        trackId: "BUS-B",
        name: "Bus B",
        role: "BUS",
        gainDb: 0,
        pan: 0,
        muted: false,
        routedToTrackIds: ["BUS-A"],
        insertedPluginIds: [],
      },
      {
        trackId: "MASTER",
        name: "Master",
        role: "MASTER",
        gainDb: 0,
        pan: 0,
        muted: false,
        routedToTrackIds: [],
        insertedPluginIds: [],
      },
    ]);
    expect(cyclicRouting.valid).toBe(false);
    expect(cyclicRouting.hasFeedbackLoop).toBe(true);

    // 6. Verify MIDI pattern quantization & transposition
    const midiOut = transformMidiPattern({
      notes: [{ noteId: "N1", pitchMidi: 60, startTick: 93, durationTicks: 96, velocity: 100, channel: 1 }],
      quantizeGridTicks: 96,
      transposeSemitones: 12,
      velocityScale: 1.1,
    });
    expect(midiOut.notes[0]?.startTick).toBe(96);
    expect(midiOut.notes[0]?.pitchMidi).toBe(72);
    expect(midiOut.notes[0]?.velocity).toBe(110);

    // 7. Verify DOMAIN_KNOWLEDGE_PACKS epistemic schema integrity
    const packRaw = readFileSync(
      resolve(process.cwd(), "DOMAIN_KNOWLEDGE_PACKS/audio-domain-knowledge-pack.json"),
      "utf8"
    );
    const pack = JSON.parse(packRaw) as { entries: Array<{ epistemicTag: string }> };
    expect(pack.entries.length).toBeGreaterThanOrEqual(4);
    expect(pack.entries.map((e) => e.epistemicTag)).toEqual(
      expect.arrayContaining(["verified_facts", "engineering_recommendations", "unverified_assumptions"])
    );
  });
});
