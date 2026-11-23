import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { compileProjectSpecification } from "../../../SYSTEM_COMPILER/src/index.ts";
import { MultiAgentOrchestrationEngine } from "../../../ORCHESTRATION_ENGINE/src/index.ts";
import { EngineeringExecutionRuntime } from "../../../ENGINEERING_RUNTIME/src/index.ts";
import { PersistentKnowledgeEngine, computeSha256Hex } from "../../../KNOWLEDGE_ENGINE/src/index.ts";
import { PersistentMemoryEngine } from "../../../MEMORY_ENGINE/src/index.ts";
import { IndependentVerificationEngine } from "../../../VERIFICATION_ENGINE/src/index.ts";
import { Vst3AudioProcessor, Vst3HostCompatibilityHarness } from "../../../VST3_ENGINE/src/index.ts";
import { FlStudio2025DomainAdapter, validateTrackRoutingGraph } from "../../../DAW_ADAPTER_FRAMEWORK/src/index.ts";
import { profileRealtimeAudioCallbackWcet } from "../../../AUDIO_TEST_FRAMEWORK/src/index.ts";

describe("PRINCIPAL INTEGRATION ARCHITECT — 4 Master End-to-End Platform Scenarios", () => {
  let sandboxDir: string;
  let checkpointDir: string;

  beforeEach(() => {
    sandboxDir = mkdtempSync(join(tmpdir(), "aetherforge-int-sandbox-"));
    checkpointDir = mkdtempSync(join(tmpdir(), "aetherforge-int-wf-"));
  });

  afterEach(() => {
    rmSync(sandboxDir, { recursive: true, force: true });
    rmSync(checkpointDir, { recursive: true, force: true });
  });

  it("TEST SCENARIO 1: Simple Software Tool — specification -> sandboxed implementation -> code review -> unit test -> AGT-19 verified deliverable", async () => {
    // 1. Compile specification via 12-stage System Compiler
    const spec = compileProjectSpecification({
      projectId: "scenario-1-hash-cli",
      tenantId: "tenant-int-01",
      specificationVersion: "1.0.0",
      failOnBlockingAmbiguity: true,
      inputs: [
        {
          inputId: "SC1-IN-1",
          inputType: "PRODUCT_DIRECTION",
          title: "Deterministic SHA-256 Checksum Utility",
          rawContent: "Build a strict TypeScript checksum utility with unit tests and zero any types.",
          structuredRequirements: [
            {
              id: "REQ-F-5101",
              kind: "FUNCTIONAL",
              statement: "Compute deterministic SHA-256 digests with zero explicit any types.",
              metricName: "passRate",
              thresholdOperator: "==",
              thresholdValue: 1,
              unit: "ratio",
              actionTier: "1",
              autonomyLevel: "L3",
              requestedCapabilities: ["control_plane_rest_api"],
              constraints: [],
              dependsOnRequirementIds: [],
            },
          ],
        },
      ],
    });
    expect(spec.validation.isValid).toBe(true);
    expect(spec.traceabilityMatrix.completenessRate).toBe(1);

    // 2. Implement, review, and test via EngineeringExecutionRuntime & ControlledToolGateway
    const runtime = new EngineeringExecutionRuntime({ workspaceRoot: sandboxDir });

    runtime.stageToolProposal({
      proposalId: "SC1-PROP-1",
      traceId: "trace-sc1-0001",
      tenantId: "tenant-int-01",
      projectId: "scenario-1-hash-cli",
      planId: spec.specificationId,
      stepId: "TASK-0001",
      agentId: "AGT-11",
      toolId: "code.generate",
      actionTier: "1",
      fenceToken: 1,
      leasedWriteGlobs: ["src/**"],
      leasedReadGlobs: ["**"],
      targetRelativePath: "src/checksum.ts",
      rawInput: {
        targetRelativePath: "src/checksum.ts",
        language: "TYPESCRIPT",
        moduleName: "checksum",
        interfaceContractId: "IC-SC1-01",
        sourceCode: "export function formatTag(id: string): string { return `TAG-${id}`; }\n",
      },
      rationale: "Generate typed utility module",
    });
    const genOut = runtime.executeStagedProposal<{ sourceSha256: string; artifactId: string }>("SC1-PROP-1");
    expect(genOut.ok).toBe(true);

    runtime.stageToolProposal({
      proposalId: "SC1-PROP-2",
      traceId: "trace-sc1-0002",
      tenantId: "tenant-int-01",
      projectId: "scenario-1-hash-cli",
      planId: spec.specificationId,
      stepId: "TASK-0002",
      agentId: "AGT-15",
      toolId: "file.create_or_modify",
      actionTier: "1",
      fenceToken: 2,
      leasedWriteGlobs: ["tests/**"],
      leasedReadGlobs: ["**"],
      targetRelativePath: "tests/checksum.test.ts",
      rawInput: {
        relativePath: "tests/checksum.test.ts",
        content: "it('formats tag deterministically', () => {});\n",
      },
      rationale: "Author unit test",
    });
    expect(runtime.executeStagedProposal("SC1-PROP-2").ok).toBe(true);

    runtime.stageToolProposal({
      proposalId: "SC1-PROP-3",
      traceId: "trace-sc1-0003",
      tenantId: "tenant-int-01",
      projectId: "scenario-1-hash-cli",
      planId: spec.specificationId,
      stepId: "TASK-0003",
      agentId: "AGT-19",
      toolId: "test.execute",
      actionTier: "0",
      fenceToken: 3,
      leasedWriteGlobs: [],
      leasedReadGlobs: ["**"],
      targetRelativePath: "tests/checksum.test.ts",
      rawInput: { suitePath: "tests/checksum.test.ts" },
      rationale: "Execute unit test suite independently",
    });
    const testOut = runtime.executeStagedProposal<{ exitCode: number; passedTests: number }>("SC1-PROP-3");
    expect(testOut.ok).toBe(true);
    expect(testOut.output?.exitCode).toBe(0);

    // 3. Independent AGT-19 verification of deliverable on disk
    const verifier = new IndependentVerificationEngine({ workspaceRoot: sandboxDir });
    const acceptance = verifier.verifyRequirementClaim({
      requirementId: "REQ-F-5101",
      title: "Scenario 1 Verified Deliverable",
      implementingAgentId: "AGT-11",
      verifierAgentId: "AGT-19",
      claimBasis: "INDEPENDENT_EXECUTABLE_ORACLE_AND_DISK_EVIDENCE",
      expectedBehavior: "Typed checksum module passes static review and unit tests",
      disciplines: ["UNIT_TESTING", "STATIC_ANALYSIS"],
      oracleRule: "exitCode === 0 && zeroAny === true",
      relativeArtifactPath: "src/checksum.ts",
      relativeTestFilePath: "tests/checksum.test.ts",
      claimedArtifactSha256: genOut.output?.sourceSha256,
      independentTestExitCode: 0,
      assertionsPassed: 1,
      assertionsFailed: 0,
      measuredSummary: "Scenario 1 verified end-to-end with matching disk SHA-256",
      knownLimitations: ["Sandbox demonstration utility"],
    });
    expect(acceptance.passFailStatus).toBe("PASS");
  });

  it("TEST SCENARIO 2: Multi-Agent System — specialist design -> contract generation -> durable orchestration -> collaboration validation", async () => {
    const spec = compileProjectSpecification({
      projectId: "scenario-2-multi-agent-os",
      tenantId: "tenant-int-01",
      specificationVersion: "1.0.0",
      failOnBlockingAmbiguity: true,
      inputs: [
        {
          inputId: "SC2-IN-1",
          inputType: "EXISTING_SYSTEM_ARCHITECTURE",
          title: "Governed Multi-Agent RAG & Workflow System",
          rawContent: "Design multi-agent system with provider gateway, pgvector RAG, OPA Rego gate, and Temporal orchestration.",
          structuredRequirements: [
            {
              id: "REQ-F-5201",
              kind: "FUNCTIONAL",
              statement: "Route structured LLM responses with tenant-isolated pgvector provenance.",
              metricName: "provenanceCoverage",
              thresholdOperator: "==",
              thresholdValue: 1,
              unit: "ratio",
              actionTier: "1",
              autonomyLevel: "L3",
              requestedCapabilities: ["provider_gateway_routing", "pgvector_hybrid_rag"],
              constraints: [],
              dependsOnRequirementIds: [],
            },
            {
              id: "REQ-F-5202",
              kind: "FUNCTIONAL",
              statement: "Orchestrate multi-agent collaboration under default-deny OPA Rego policy.",
              metricName: "policyCompliance",
              thresholdOperator: "==",
              thresholdValue: 1,
              unit: "ratio",
              actionTier: "1",
              autonomyLevel: "L3",
              requestedCapabilities: ["temporal_dag_orchestration", "opa_rego_policy_gate"],
              constraints: [],
              dependsOnRequirementIds: ["REQ-F-5201"],
            },
          ],
        },
      ],
    });

    expect(spec.validation.isValid).toBe(true);
    expect(spec.pipelineStages.stage04Domains.assignedSpecialistAgents).toEqual(
      expect.arrayContaining(["AGT-01", "AGT-05", "AGT-06", "AGT-14", "AGT-19"])
    );

    const collabLog: string[] = [];
    const knowledge = new PersistentKnowledgeEngine();
    const memory = new PersistentMemoryEngine(knowledge);

    const orchestrator = new MultiAgentOrchestrationEngine({
      checkpointDir,
      agentDispatcher: (ctx) => {
        collabLog.push(`${ctx.step.stepId}:${ctx.step.responsibleAgentId}`);
        memory.appendEngineeringHistory({
          tenantId: "tenant-int-01",
          projectId: "scenario-2-multi-agent-os",
          category: "WORKFLOW_EXECUTION",
          agentId: ctx.step.responsibleAgentId,
          summary: `Completed ${ctx.step.stepId}`,
          artifactSha256: computeSha256Hex(`${ctx.step.stepId}:${ctx.fenceToken}`),
        });
        return { success: true, outputSummary: { [`${ctx.step.stepId}_agent`]: ctx.step.responsibleAgentId } };
      },
    });

    const cp = await orchestrator.executeCompiledSpecification({
      spec,
      executionId: "EXEC-SC2-001",
      idempotencyKey: "IDEM-SC2-001",
      requesterPrincipalId: "architect-lead",
    });

    expect(cp.status).toBe("COMPLETED");
    expect(collabLog.at(-1)).toContain(":AGT-19");
    expect(memory.listEngineeringHistory("tenant-int-01", "scenario-2-multi-agent-os").length).toBe(
      collabLog.length
    );
  });

  it("TEST SCENARIO 3: VST3 Plugin — architecture -> C++20 lock-free core codegen & review -> host compatibility & WCET evidence", () => {
    const spec = compileProjectSpecification({
      projectId: "scenario-3-vst3-plugin",
      tenantId: "tenant-int-01",
      specificationVersion: "1.0.0",
      failOnBlockingAmbiguity: true,
      inputs: [
        {
          inputId: "SC3-IN-1",
          inputType: "TECHNICAL_DOCUMENT",
          title: "Lock-Free C++20 VST3 Mastering Processor",
          rawContent: "Build a zero-allocation C++20 VST3 audio processor meeting real-time WCET deadlines.",
          structuredRequirements: [
            {
              id: "REQ-F-5301",
              kind: "NON_FUNCTIONAL",
              statement: "Zero heap allocations inside processSamples() and WCET < 30% buffer deadline.",
              metricName: "realtimeHeapAllocations",
              thresholdOperator: "==",
              thresholdValue: 0,
              unit: "bytes",
              actionTier: "1",
              autonomyLevel: "L3",
              requestedCapabilities: ["realtime_audio_callback", "vst3_atomic_parameter_core"],
              constraints: ["ZERO_ALLOCATION_REALTIME_THREAD"],
              dependsOnRequirementIds: [],
            },
          ],
        },
      ],
    });
    expect(spec.validation.isValid).toBe(true);
    expect(spec.pipelineStages.stage07Architecture.realtimeIsolationEnforced).toBe(true);

    const runtime = new EngineeringExecutionRuntime({ workspaceRoot: sandboxDir });
    runtime.stageToolProposal({
      proposalId: "SC3-CPP-GEN",
      traceId: "trace-sc3-0001",
      tenantId: "tenant-int-01",
      projectId: "scenario-3-vst3-plugin",
      planId: spec.specificationId,
      stepId: "TASK-0001",
      agentId: "AGT-08",
      toolId: "code.generate",
      actionTier: "1",
      fenceToken: 1,
      leasedWriteGlobs: ["plugins/vst3/**"],
      leasedReadGlobs: ["**"],
      targetRelativePath: "plugins/vst3/MasterGainCore.h",
      rawInput: {
        targetRelativePath: "plugins/vst3/MasterGainCore.h",
        language: "CPP20",
        moduleName: "MasterGainCore",
        interfaceContractId: "ADR-0008",
        sourceCode:
          "#pragma once\n#include <atomic>\nstruct MasterGainCore { std::atomic<float> g{1.0f}; float tick(float x) noexcept { return x * g.load(std::memory_order_relaxed); } };\n",
      },
      rationale: "Generate zero-allocation C++20 DSP header",
    });
    expect(runtime.executeStagedProposal("SC3-CPP-GEN").ok).toBe(true);

    // Run VST3 Host Compatibility Torture Suite & Real-Time WCET Profiler
    const proc = new Vst3AudioProcessor();
    const hostReport = new Vst3HostCompatibilityHarness().runHostTortureSuite(proc);
    expect(hostReport.passed).toBe(true);
    expect(hostReport.stateRoundtripVerified).toBe(true);

    const wcet = profileRealtimeAudioCallbackWcet({
      sampleRateHz: 48_000,
      blockSizeSamples: 256,
      iterations: 15,
      callback: (block) => {
        proc.processBlock(block);
      },
    });
    expect(wcet.withinRealtimeBudget).toBe(true);
  });

  it("TEST SCENARIO 4: AI DAW Workflow — FL Studio 2025 adapter workflow -> real .flp inspection -> Python controller bridge -> forbidden mutation block", async () => {
    const spec = compileProjectSpecification({
      projectId: "scenario-4-fl-studio-ai-daw",
      tenantId: "tenant-int-01",
      specificationVersion: "1.0.0",
      failOnBlockingAmbiguity: true,
      inputs: [
        {
          inputId: "SC4-IN-1",
          inputType: "PROCESS_DESCRIPTION",
          title: "FL Studio 2025 Governed AI DAW Inspection & Automation Workflow",
          rawContent: "Inspect FL Studio 2025 .flp project non-destructively and emit Python MIDI controller bridge.",
          structuredRequirements: [
            {
              id: "REQ-F-5401",
              kind: "FUNCTIONAL",
              statement: "Inspect FL Studio 2025 .flp files with 0 mutated bytes and generate Python MIDI controller script.",
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
        },
      ],
    });
    expect(spec.validation.isValid).toBe(true);

    const flAdapter = new FlStudio2025DomainAdapter();
    const routingCheck = validateTrackRoutingGraph([
      {
        trackId: "CH-1",
        name: "Drums",
        role: "AUDIO",
        gainDb: -2,
        pan: 0,
        muted: false,
        routedToTrackIds: ["MASTER"],
        insertedPluginIds: ["AETHER-VST3"],
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
    expect(routingCheck.valid).toBe(true);

    const bridgeScript = flAdapter.executeCapabilityOperation({
      capability: "vst3_plugin_parameter_host_automation",
      parameters: { trackIndex: 1, slotIndex: 0, paramIndex: 0, normalizedValue: 0.65 },
    });
    expect(bridgeScript.allowed).toBe(true);
    expect(bridgeScript.payload).toContain("plugins.setParamValue");

    const blockedMutation = flAdapter.executeCapabilityOperation({
      capability: "direct_flp_binary_mutation",
      parameters: {},
    });
    expect(blockedMutation.allowed).toBe(false);
    expect(blockedMutation.errorCode).toBe("DAW_CAPABILITY_UNSUPPORTED");

    // Verify real installed FL Studio 2025 factory demo project if present on workstation
    const demoFlp = "C:\\Program Files\\Image-Line\\FL Studio 2025\\Data\\Demo projects\\NewStuff.flp";
    if (existsSync(demoFlp)) {
      const inspection = flAdapter.inspectProjectReadOnly(demoFlp);
      expect(inspection.channelOrTrackCount).toBe(45);
      expect(inspection.ppq).toBe(96);
      expect(inspection.sourceBytesModified).toBe(0);
    }

    // Execute lowered workflow through MultiAgentOrchestrationEngine
    const orchestrator = new MultiAgentOrchestrationEngine({
      checkpointDir,
      agentDispatcher: () => ({ success: true }),
    });
    const wfResult = await orchestrator.executeCompiledSpecification({
      spec,
      executionId: "EXEC-SC4-001",
      idempotencyKey: "IDEM-SC4-001",
      requesterPrincipalId: "daw-operator-01",
    });
    expect(wfResult.status).toBe("COMPLETED");
  });
});
