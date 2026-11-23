import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileProjectSpecification } from "../src/index.ts";

const example01 = compileProjectSpecification({
  projectId: "vst3-flstudio-transient-shaper",
  tenantId: "tenant-audio-labs",
  specificationVersion: "1.0.0",
  failOnBlockingAmbiguity: true,
  inputs: [
    {
      inputId: "EX01-IN-01",
      inputType: "PRODUCT_DIRECTION",
      title: "AETHER FORGE VST3 Transient Shaper & FL Studio 2025 Companion",
      rawContent:
        "Deliver a lock-free C++20 VST3 audio processor paired with deterministic offline ITU-R BS.1770-4 loudness verification and read-only FL Studio 2025 .flp project inspection.",
      sourceUri: "workspace://PROJECT_CHARTER.md",
      structuredRequirements: [
        {
          id: "REQ-F-1001",
          kind: "FUNCTIONAL",
          statement: "Decode FL Studio 2025 .flp FLhd and FLdt binary chunks non-destructively.",
          metricName: "mutatedSourceBytes",
          thresholdOperator: "==",
          thresholdValue: 0,
          unit: "bytes",
          actionTier: "0",
          autonomyLevel: "L3",
          requestedCapabilities: ["flp_readonly_binary_inspection"],
          constraints: [],
          dependsOnRequirementIds: [],
        },
      ],
      metadata: { targetDaw: "FL Studio 2025 (25.1.6.4997)" },
    },
    {
      inputId: "EX01-IN-02",
      inputType: "NATURAL_LANGUAGE_REQUIREMENTS",
      title: "Real-Time Audio Thread Safety Constraint",
      rawContent: "Zero heap allocations or blocking calls inside processSamples() real-time callback.",
      sourceUri: "workspace://SRS.md",
      structuredRequirements: [
        {
          id: "REQ-NF-1001",
          kind: "NON_FUNCTIONAL",
          statement: "Real-time C++20 VST3 callback heap allocations after prepare() MUST equal 0 bytes.",
          metricName: "realtimeHeapAllocations",
          thresholdOperator: "==",
          thresholdValue: 0,
          unit: "bytes",
          actionTier: "1",
          autonomyLevel: "L3",
          requestedCapabilities: ["realtime_audio_callback", "vst3_atomic_parameter_core"],
          constraints: ["ZERO_ALLOCATION_REALTIME_THREAD"],
          dependsOnRequirementIds: ["REQ-F-1001"],
        },
      ],
      metadata: {},
    },
    {
      inputId: "EX01-IN-03",
      inputType: "TECHNICAL_DOCUMENT",
      title: "Offline 64-Bit Float DSP Loudness & True Peak Ceiling",
      rawContent: "ITU-R BS.1770-4 K-weighted loudness and brickwall true-peak limiting <= -0.1 dBTP.",
      sourceUri: "workspace://TECHNICAL_RESEARCH.md",
      structuredRequirements: [
        {
          id: "REQ-NF-1002",
          kind: "NON_FUNCTIONAL",
          statement: "Offline DSP limiter true peak output MUST NOT exceed -0.1 dBTP.",
          metricName: "truePeakDbtp",
          thresholdOperator: "<=",
          thresholdValue: -0.1,
          unit: "dBTP",
          actionTier: "1",
          autonomyLevel: "L3",
          requestedCapabilities: ["offline_biquad_dsp_render"],
          constraints: [],
          dependsOnRequirementIds: ["REQ-NF-1001"],
        },
      ],
      metadata: {},
    },
  ],
});

const example02 = compileProjectSpecification({
  projectId: "multi-agent-repo-governance",
  tenantId: "tenant-enterprise-core",
  specificationVersion: "1.0.0",
  failOnBlockingAmbiguity: true,
  inputs: [
    {
      inputId: "EX02-IN-01",
      inputType: "EXISTING_REPOSITORY",
      title: "26-Package Governed Monorepo & Provider Gateway",
      rawContent: "Existing pnpm workspace with schema-constrained provider gateway and pgvector knowledge store.",
      sourceUri: "workspace://package.json",
      structuredRequirements: [
        {
          id: "REQ-F-2001",
          kind: "FUNCTIONAL",
          statement: "Enforce 100% ProvenanceRecord citation coverage on hybrid pgvector RAG retrieval.",
          metricName: "provenanceCoverageRate",
          thresholdOperator: "==",
          thresholdValue: 1,
          unit: "ratio",
          actionTier: "1",
          autonomyLevel: "L3",
          requestedCapabilities: ["pgvector_hybrid_rag", "provider_gateway_routing"],
          constraints: [],
          dependsOnRequirementIds: [],
        },
      ],
      metadata: {},
    },
    {
      inputId: "EX02-IN-02",
      inputType: "EXISTING_SYSTEM_ARCHITECTURE",
      title: "Temporal Durable Orchestration & OPA Default-Deny Policy Gate",
      rawContent: "Temporal workflow orchestration gated by OPA Rego v1 policy decision point.",
      sourceUri: "workspace://MASTER_ARCHITECTURE.md",
      structuredRequirements: [
        {
          id: "REQ-NF-2001",
          kind: "NON_FUNCTIONAL",
          statement: "OPA policy evaluation P99 latency MUST be <= 15 ms with default-deny enforcement.",
          metricName: "opaEvaluationP99Ms",
          thresholdOperator: "<=",
          thresholdValue: 15,
          unit: "ms",
          actionTier: "1",
          autonomyLevel: "L3",
          requestedCapabilities: ["temporal_dag_orchestration", "opa_rego_policy_gate"],
          constraints: [],
          dependsOnRequirementIds: ["REQ-F-2001"],
        },
      ],
      metadata: {},
    },
    {
      inputId: "EX02-IN-03",
      inputType: "PROCESS_DESCRIPTION",
      title: "Dual-Control SLSA v1.0 & CycloneDX 1.5 Production Release Promotion",
      rawContent: "Promote release candidates only when Reviewer != ReleaseManager and SLSA provenance passes.",
      sourceUri: "workspace://GOVERNANCE.md",
      structuredRequirements: [
        {
          id: "REQ-F-2002",
          kind: "FUNCTIONAL",
          statement: "Require dual-control Reviewer != ReleaseManager approval and SLSA v1.0 attestation for Tier 3 release.",
          metricName: "dualControlVerified",
          thresholdOperator: "==",
          thresholdValue: 1,
          unit: "ratio",
          actionTier: "3",
          autonomyLevel: "L2",
          requestedCapabilities: ["tier3_production_release_promotion"],
          constraints: [],
          dependsOnRequirementIds: ["REQ-NF-2001"],
        },
      ],
      metadata: {},
    },
  ],
});

const outDir = resolve(process.cwd(), "COMPILATION_EXAMPLES");
writeFileSync(
  resolve(outDir, "example-01-vst3-flstudio-transient-shaper.json"),
  JSON.stringify(example01, null, 2) + "\n",
  "utf8"
);
writeFileSync(
  resolve(outDir, "example-02-multi-agent-repo-governance.json"),
  JSON.stringify(example02, null, 2) + "\n",
  "utf8"
);
console.log(
  `Generated COMPILATION_EXAMPLES: EX01=${example01.specificationSha256.slice(0, 16)} EX02=${example02.specificationSha256.slice(0, 16)}`
);
