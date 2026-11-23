import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileProjectSpecification } from "../../../SYSTEM_COMPILER/src/index.ts";

const spec = compileProjectSpecification({
  projectId: "aether-punch-vst3",
  tenantId: "tenant-audio-labs",
  specificationVersion: "1.0.0",
  failOnBlockingAmbiguity: true,
  inputs: [
    {
      inputId: "AP-IN-01",
      inputType: "PRODUCT_DIRECTION",
      title: "Aether Punch — Native C++20 VST3 Transient Shaper, Saturator & True-Peak Limiter",
      rawContent:
        "Build a production Windows x64 VST3 3.8.1 dynamics plugin combining stereo-linked dual-envelope transient shaping, auto-compensated analog tanh saturation, brickwall true-peak ceiling limiting, and parallel dry/wet mix.",
      sourceUri: "workspace://products/aether-punch-vst3/README.md",
      structuredRequirements: [
        {
          id: "REQ-F-6001",
          kind: "FUNCTIONAL",
          statement:
            "Shape drum/bus attack and sustain via stereo-linked dual-envelope differential detection (-18..+18 dB) with zero stereo drift.",
          metricName: "attackBoostRatio",
          thresholdOperator: ">=",
          thresholdValue: 1.25,
          unit: "ratio",
          actionTier: "1",
          autonomyLevel: "L3",
          requestedCapabilities: ["offline_biquad_dsp_render", "vst3_atomic_parameter_core"],
          constraints: ["ZERO_ALLOCATION_REALTIME_THREAD"],
          dependsOnRequirementIds: [],
        },
        {
          id: "REQ-NF-6001",
          kind: "NON_FUNCTIONAL",
          statement:
            "Enforce zero heap allocations and zero locks inside AetherPunchCore::processBlock() noexcept and pass pluginval strictness level 10.",
          metricName: "realtimeHeapAllocations",
          thresholdOperator: "==",
          thresholdValue: 0,
          unit: "bytes",
          actionTier: "1",
          autonomyLevel: "L3",
          requestedCapabilities: ["realtime_audio_callback", "vst3_native_binary_compile", "pluginval_level10_execution"],
          constraints: ["ZERO_ALLOCATION_REALTIME_THREAD"],
          dependsOnRequirementIds: ["REQ-F-6001"],
        },
        {
          id: "REQ-NF-6002",
          kind: "NON_FUNCTIONAL",
          statement: "Enforce brickwall limiter ceiling <= -1.0 dBTP on +6 dBFS input with 0 NaN/Inf/subnormal leaks.",
          metricName: "truePeakDbtp",
          thresholdOperator: "<=",
          thresholdValue: -1.0,
          unit: "dBTP",
          actionTier: "1",
          autonomyLevel: "L3",
          requestedCapabilities: ["realtime_audio_callback"],
          constraints: [],
          dependsOnRequirementIds: ["REQ-NF-6001"],
        },
      ],
    },
  ],
});

const specDir = resolve(process.cwd(), "products/aether-punch-vst3/spec");
mkdirSync(specDir, { recursive: true });
writeFileSync(resolve(specDir, "aether-punch-spec.json"), JSON.stringify(spec, null, 2) + "\n", "utf8");
console.log(
  `Compiled Aether Punch Spec: status=${spec.validation.status} traceability=${spec.traceabilityMatrix.completenessRate} sha256=${spec.specificationSha256.slice(0, 16)}`
);
