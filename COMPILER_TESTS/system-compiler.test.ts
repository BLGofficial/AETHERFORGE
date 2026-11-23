import { describe, expect, it } from "vitest";
import { compileProjectSpecification } from "../SYSTEM_COMPILER/src/index.ts";
import { CompiledEngineeringSpecificationSchema } from "../SPECIFICATION_SCHEMAS/compiler-schemas.ts";

describe("AETHER FORGE 12-Stage System Compiler (ARCH-04)", () => {
  it("compiles all 6 input types through all 12 pipeline stages with 100% 4-way traceability", () => {
    const spec = compileProjectSpecification({
      projectId: "aether-hybrid-suite",
      tenantId: "tenant-prod-01",
      specificationVersion: "1.0.0",
      failOnBlockingAmbiguity: true,
      inputs: [
        {
          inputId: "IN-01",
          inputType: "PRODUCT_DIRECTION",
          title: "Governed Hybrid AI DAW & Multi-Agent Engineering Platform",
          rawContent: "Build a deterministic VST3 and FL Studio 2025 inspection platform with Temporal orchestration.",
          sourceUri: "workspace://PROJECT_CHARTER.md",
          structuredRequirements: [
            {
              id: "REQ-F-0101",
              kind: "FUNCTIONAL",
              statement: "Orchestrate multi-agent DAG workflows with durable pause/resume on Tier 2 approvals.",
              metricName: "workflowDeterminismRate",
              thresholdOperator: "==",
              thresholdValue: 1,
              unit: "ratio",
              actionTier: "1",
              autonomyLevel: "L3",
              requestedCapabilities: ["temporal_dag_orchestration"],
              constraints: [],
              dependsOnRequirementIds: [],
            },
          ],
          metadata: {},
        },
        {
          inputId: "IN-02",
          inputType: "NATURAL_LANGUAGE_REQUIREMENTS",
          title: "OPA Zero-Trust Policy Latency Requirement",
          rawContent: "All tool invocations MUST pass OPA policy evaluation within 15 ms at P99.",
          sourceUri: "workspace://SRS.md",
          structuredRequirements: [
            {
              id: "REQ-NF-0101",
              kind: "NON_FUNCTIONAL",
              statement: "OPA policy decision point evaluation latency MUST be <= 15 ms at P99.",
              metricName: "opaEvaluationP99Ms",
              thresholdOperator: "<=",
              thresholdValue: 15,
              unit: "ms",
              actionTier: "1",
              autonomyLevel: "L3",
              requestedCapabilities: ["opa_rego_policy_gate"],
              constraints: [],
              dependsOnRequirementIds: ["REQ-F-0101"],
            },
          ],
          metadata: {},
        },
        {
          inputId: "IN-03",
          inputType: "PROCESS_DESCRIPTION",
          title: "Dual-Control Release Promotion Process",
          rawContent: "Production promotion requires Reviewer != ReleaseManager dual-control sign-off and SLSA v1.0 provenance.",
          sourceUri: "workspace://GOVERNANCE.md",
          structuredRequirements: [
            {
              id: "REQ-F-0102",
              kind: "FUNCTIONAL",
              statement: "Enforce dual-control Reviewer != ReleaseManager release promotion with SLSA provenance.",
              metricName: "dualControlEnforcementRate",
              thresholdOperator: "==",
              thresholdValue: 1,
              unit: "ratio",
              actionTier: "3",
              autonomyLevel: "L2",
              requestedCapabilities: ["tier3_production_release_promotion"],
              constraints: [],
              dependsOnRequirementIds: ["REQ-NF-0101"],
            },
          ],
          metadata: {},
        },
        {
          inputId: "IN-04",
          inputType: "EXISTING_REPOSITORY",
          title: "FL Studio 2025 Read-Only .flp Adapter",
          rawContent: "Existing adapters/fl-studio-2025 package inspecting FLhd/FLdt headers non-destructively.",
          sourceUri: "workspace://adapters/fl-studio-2025",
          structuredRequirements: [
            {
              id: "REQ-F-0103",
              kind: "FUNCTIONAL",
              statement: "Decode FL Studio 2025 .flp FLhd and FLdt chunks in strictly read-only mode.",
              metricName: "mutatedFlpBytes",
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
          metadata: {},
        },
        {
          inputId: "IN-05",
          inputType: "TECHNICAL_DOCUMENT",
          title: "ITU-R BS.1770-4 Offline DSP Engine Spec",
          rawContent: "64-bit float biquad + limiter offline render computing LUFS and True Peak dBTP.",
          sourceUri: "workspace://TECHNICAL_RESEARCH.md",
          structuredRequirements: [
            {
              id: "REQ-NF-0102",
              kind: "NON_FUNCTIONAL",
              statement: "Offline DSP limiter true peak ceiling MUST be <= -0.1 dBTP.",
              metricName: "truePeakDbtp",
              thresholdOperator: "<=",
              thresholdValue: -0.1,
              unit: "dBTP",
              actionTier: "1",
              autonomyLevel: "L3",
              requestedCapabilities: ["offline_biquad_dsp_render"],
              constraints: [],
              dependsOnRequirementIds: [],
            },
          ],
          metadata: {},
        },
        {
          inputId: "IN-06",
          inputType: "EXISTING_SYSTEM_ARCHITECTURE",
          title: "Lock-Free C++20 VST3 Real-Time Audio Core",
          rawContent: "ADR-0008 separation between real-time processSamples() and control plane.",
          sourceUri: "workspace://MASTER_ARCHITECTURE.md",
          structuredRequirements: [
            {
              id: "REQ-NF-0103",
              kind: "NON_FUNCTIONAL",
              statement: "Real-time audio callback heap allocations after prepare() MUST equal 0 bytes.",
              metricName: "realtimeHeapAllocations",
              thresholdOperator: "==",
              thresholdValue: 0,
              unit: "bytes",
              actionTier: "1",
              autonomyLevel: "L3",
              requestedCapabilities: ["realtime_audio_callback", "vst3_atomic_parameter_core"],
              constraints: ["ZERO_ALLOCATION_REALTIME_THREAD"],
              dependsOnRequirementIds: ["REQ-NF-0102"],
            },
          ],
          metadata: {},
        },
      ],
    });

    const parsed = CompiledEngineeringSpecificationSchema.parse(spec);
    expect(parsed.validation.isValid).toBe(true);
    expect(parsed.validation.status).toBe("COMPILED_VALID");
    expect(parsed.pipelineStages.stage01Intent.inputTypesProcessed).toHaveLength(6);
    expect(parsed.pipelineStages.stage02Requirements).toHaveLength(6);
    expect(parsed.pipelineStages.stage03Ambiguities).toHaveLength(0);
    expect(parsed.pipelineStages.stage04Domains.assignedSpecialistAgents).toContain("AGT-19");
    expect(parsed.pipelineStages.stage08Components.length).toBeGreaterThanOrEqual(6);
    expect(parsed.pipelineStages.stage09DependencyGraph.hasCycles).toBe(false);
    expect(parsed.pipelineStages.stage10Workflow.tasks.at(-1)?.assignedAgentId).toBe("AGT-19");
    expect(parsed.traceabilityMatrix.completenessRate).toBe(1);
    expect(parsed.traceabilityMatrix.orphanRequirements).toHaveLength(0);
    expect(parsed.traceabilityMatrix.orphanComponents).toHaveLength(0);
    expect(parsed.traceabilityMatrix.orphanTasks).toHaveLength(0);
    expect(parsed.traceabilityMatrix.orphanTests).toHaveLength(0);
    expect(parsed.specificationSha256).toMatch(/^[A-F0-9]{64}$/);
  });

  it("rejects contradictory requirements (real-time audio callback + synchronous cloud LLM & disjoint numeric bounds)", () => {
    const spec = compileProjectSpecification({
      projectId: "contradictory-vst3",
      tenantId: "tenant-prod-01",
      specificationVersion: "1.0.0",
      failOnBlockingAmbiguity: true,
      inputs: [
        {
          inputId: "IN-CON-1",
          inputType: "NATURAL_LANGUAGE_REQUIREMENTS",
          title: "Conflicting Real-Time and Latency Spec",
          rawContent: "Test contradiction detection",
          sourceUri: "workspace://inline",
          structuredRequirements: [
            {
              id: "REQ-NF-0201",
              kind: "NON_FUNCTIONAL",
              statement: "Audio callback MUST be zero-allocation real-time with latency <= 2 ms.",
              metricName: "callbackLatencyMs",
              thresholdOperator: "<=",
              thresholdValue: 2,
              unit: "ms",
              actionTier: "1",
              autonomyLevel: "L3",
              requestedCapabilities: ["realtime_audio_callback"],
              constraints: ["ZERO_ALLOCATION_REALTIME_THREAD"],
              dependsOnRequirementIds: [],
            },
            {
              id: "REQ-F-0202",
              kind: "FUNCTIONAL",
              statement: "Audio callback MUST make synchronous cloud LLM calls requiring >= 50 ms.",
              metricName: "callbackLatencyMs",
              thresholdOperator: ">=",
              thresholdValue: 50,
              unit: "ms",
              actionTier: "1",
              autonomyLevel: "L3",
              requestedCapabilities: ["realtime_audio_callback"],
              constraints: ["SYNCHRONOUS_NETWORK_IO_IN_AUDIO_THREAD"],
              dependsOnRequirementIds: [],
            },
          ],
          metadata: {},
        },
      ],
    });

    expect(spec.validation.isValid).toBe(false);
    expect(spec.validation.status).toBe("REJECTED_CONTRADICTORY_REQUIREMENTS");
    expect(spec.validation.contradictoryRequirements.length).toBeGreaterThanOrEqual(2);
    expect(
      spec.validation.contradictoryRequirements.some((c) => c.ruleViolated.includes("CON-RULE-01"))
    ).toBe(true);
    expect(
      spec.validation.contradictoryRequirements.some((c) => c.ruleViolated.includes("CON-RULE-03"))
    ).toBe(true);
  });

  it("rejects unsupported capabilities (direct_flp_binary_mutation and fl_engine_memory_injection)", () => {
    const spec = compileProjectSpecification({
      projectId: "unsupported-daw-hack",
      tenantId: "tenant-prod-01",
      specificationVersion: "1.0.0",
      failOnBlockingAmbiguity: true,
      inputs: [
        {
          inputId: "IN-UNSUP-1",
          inputType: "PRODUCT_DIRECTION",
          title: "In-place FLP Binary Mutator",
          rawContent: "Directly overwrite .flp files and hook FLEngine_x64.dll.",
          sourceUri: "workspace://inline",
          structuredRequirements: [
            {
              id: "REQ-F-0301",
              kind: "FUNCTIONAL",
              statement: "Overwrite user .flp binaries in-place and inject hooks into FLEngine_x64.dll.",
              metricName: "injectionSuccess",
              thresholdOperator: "==",
              thresholdValue: 1,
              unit: "bool",
              actionTier: "2",
              autonomyLevel: "L3",
              requestedCapabilities: ["direct_flp_binary_mutation", "fl_engine_memory_injection"],
              constraints: [],
              dependsOnRequirementIds: [],
            },
          ],
          metadata: {},
        },
      ],
    });

    expect(spec.validation.isValid).toBe(false);
    expect(spec.validation.status).toBe("REJECTED_UNSUPPORTED_CAPABILITIES");
    expect(spec.validation.unsupportedCapabilities).toHaveLength(2);
    expect(spec.validation.unsupportedCapabilities.map((u) => u.capabilityKey)).toEqual([
      "direct_flp_binary_mutation",
      "fl_engine_memory_injection",
    ]);
  });

  it("rejects missing dependencies and circular dependency cycles in the dependency graph", () => {
    const spec = compileProjectSpecification({
      projectId: "cyclic-missing-deps",
      tenantId: "tenant-prod-01",
      specificationVersion: "1.0.0",
      failOnBlockingAmbiguity: true,
      inputs: [
        {
          inputId: "IN-DEP-1",
          inputType: "EXISTING_SYSTEM_ARCHITECTURE",
          title: "Cyclic and Missing Dependency Test",
          rawContent: "Test missing and cyclic requirement edges",
          sourceUri: "workspace://inline",
          structuredRequirements: [
            {
              id: "REQ-F-0401",
              kind: "FUNCTIONAL",
              statement: "Step A depends on Step B and non-existent REQ-F-9999.",
              metricName: "passRate",
              thresholdOperator: "==",
              thresholdValue: 1,
              unit: "ratio",
              actionTier: "1",
              autonomyLevel: "L3",
              requestedCapabilities: ["temporal_dag_orchestration"],
              constraints: [],
              dependsOnRequirementIds: ["REQ-F-0402", "REQ-F-9999"],
            },
            {
              id: "REQ-F-0402",
              kind: "FUNCTIONAL",
              statement: "Step B depends back on Step A creating a cycle.",
              metricName: "passRate",
              thresholdOperator: "==",
              thresholdValue: 1,
              unit: "ratio",
              actionTier: "1",
              autonomyLevel: "L3",
              requestedCapabilities: ["opa_rego_policy_gate"],
              constraints: [],
              dependsOnRequirementIds: ["REQ-F-0401"],
            },
          ],
          metadata: {},
        },
      ],
    });

    expect(spec.validation.isValid).toBe(false);
    expect(spec.validation.status).toBe("REJECTED_MISSING_DEPENDENCIES");
    expect(spec.pipelineStages.stage09DependencyGraph.hasCycles).toBe(true);
    expect(
      spec.validation.missingDependencies.some((m) => m.includes("REQ-F-9999"))
    ).toBe(true);
    expect(
      spec.validation.missingDependencies.some((m) => m.includes("Circular dependency detected"))
    ).toBe(true);
  });

  it("halts compilation on blocking unquantified ambiguities when failOnBlockingAmbiguity is enabled", () => {
    const spec = compileProjectSpecification({
      projectId: "ambiguous-brief",
      tenantId: "tenant-prod-01",
      specificationVersion: "1.0.0",
      failOnBlockingAmbiguity: true,
      inputs: [
        {
          inputId: "IN-AMB-1",
          inputType: "NATURAL_LANGUAGE_REQUIREMENTS",
          title: "Vague Marketing Brief",
          rawContent: "The system must be blazingly fast and provide a magical, effortless UI.",
          sourceUri: "workspace://inline",
          structuredRequirements: [],
          metadata: {},
        },
      ],
    });

    expect(spec.validation.isValid).toBe(false);
    expect(spec.validation.status).toBe("HALTED_BLOCKING_AMBIGUITY");
    expect(spec.validation.blockingAmbiguities.length).toBeGreaterThanOrEqual(2);
    expect(spec.validation.blockingAmbiguities[0]?.resolutionOptions.length).toBeGreaterThanOrEqual(2);
  });
});
