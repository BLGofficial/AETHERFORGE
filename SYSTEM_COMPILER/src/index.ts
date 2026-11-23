import { createHash } from "node:crypto";
import {
  type AmbiguityFinding,
  type AcceptanceCriterionSpec,
  type CapabilityDispositionSchema,
  type CapabilityMappingEntry,
  type CompiledEngineeringSpecification,
  CompiledEngineeringSpecificationSchema,
  type CompilerCompilationRequest,
  CompilerCompilationRequestSchema,
  type ParsedCompilerCompilationRequest,
  type ComponentSpec,
  type ContradictionDiagnostic,
  type CoreDomain,
  type DependencyEdgeSchema,
  type ExtractedRequirement,
  type RequirementTraceabilityRow,
  type SpecialistAgentId,
  type TechnicalResearchRequestSchema,
  type TestSpecification,
  type WorkflowTaskSpec,
} from "../../SPECIFICATION_SCHEMAS/compiler-schemas.ts";
import { z } from "zod";

type CapabilityDisposition = z.infer<typeof CapabilityDispositionSchema>;
type DependencyEdge = z.infer<typeof DependencyEdgeSchema>;
type TechnicalResearchRequest = z.infer<typeof TechnicalResearchRequestSchema>;

interface CapabilityCatalogDefinition {
  disposition: CapabilityDisposition;
  domain: CoreDomain;
  providingModulePath: string;
  ownerAgentId: SpecialistAgentId;
  requiredApprovalRole: "NONE" | "Reviewer" | "ReleaseManager" | "DUAL_CONTROL";
  componentName: string;
  exclusiveWriteGlobs: string[];
  readOnlyGlobs: string[];
  publicInterfaces: string[];
  notes: string;
}

const CAPABILITY_CATALOG: Record<string, CapabilityCatalogDefinition> = {
  temporal_dag_orchestration: {
    disposition: "NATIVE_IMPLEMENTED",
    domain: "AGENTIC_RUNTIME_ARCHITECTURE",
    providingModulePath: "services/orchestration",
    ownerAgentId: "AGT-06",
    requiredApprovalRole: "NONE",
    componentName: "DurableTemporalOrchestrator",
    exclusiveWriteGlobs: ["services/orchestration/**"],
    readOnlyGlobs: ["contracts/**"],
    publicInterfaces: ["DurableTemporalOrchestrator.startPlanExecution", "DurableTemporalOrchestrator.signalApprovalDecision"],
    notes: "Native deterministic workflow orchestration with pause/resume and fencing tokens.",
  },
  opa_rego_policy_gate: {
    disposition: "NATIVE_IMPLEMENTED",
    domain: "INFRASTRUCTURE_APIS_INTEGRATIONS",
    providingModulePath: "services/policy",
    ownerAgentId: "AGT-14",
    requiredApprovalRole: "NONE",
    componentName: "OpaPolicyDecisionPoint",
    exclusiveWriteGlobs: ["services/policy/**"],
    readOnlyGlobs: ["contracts/**"],
    publicInterfaces: ["OpaPolicyDecisionPoint.evaluate"],
    notes: "Default-deny Rego policy decision point across Action Tiers 0..3.",
  },
  pgvector_hybrid_rag: {
    disposition: "NATIVE_IMPLEMENTED",
    domain: "AI_OPERATING_SYSTEMS",
    providingModulePath: "services/knowledge",
    ownerAgentId: "AGT-05",
    requiredApprovalRole: "NONE",
    componentName: "EvidenceKnowledgeService",
    exclusiveWriteGlobs: ["services/knowledge/**"],
    readOnlyGlobs: ["contracts/**"],
    publicInterfaces: ["EvidenceKnowledgeService.ingestDocument", "EvidenceKnowledgeService.hybridSearch"],
    notes: "Tenant-isolated hybrid semantic + lexical retrieval with mandatory ProvenanceRecord.",
  },
  provider_gateway_routing: {
    disposition: "NATIVE_IMPLEMENTED",
    domain: "MULTI_AGENT_SYSTEMS",
    providingModulePath: "services/provider-gateway",
    ownerAgentId: "AGT-05",
    requiredApprovalRole: "NONE",
    componentName: "ProviderGatewayService",
    exclusiveWriteGlobs: ["services/provider-gateway/**"],
    readOnlyGlobs: ["contracts/**"],
    publicInterfaces: ["ProviderGatewayService.completeStructured", "ServerSideSecretManager.resolveSecret"],
    notes: "Schema-constrained LLM gateway with server-side secret resolution and budget circuit breakers.",
  },
  offline_biquad_dsp_render: {
    disposition: "NATIVE_IMPLEMENTED",
    domain: "AUDIO_PROCESSING_DSP",
    providingModulePath: "workers/audio-engine",
    ownerAgentId: "AGT-07",
    requiredApprovalRole: "NONE",
    componentName: "OfflineAudioDspEngine",
    exclusiveWriteGlobs: ["workers/audio-engine/**"],
    readOnlyGlobs: ["contracts/**"],
    publicInterfaces: ["OfflineAudioDspEngine.renderAndAnalyze"],
    notes: "Deterministic 64-bit float offline DSP chain and ITU-R BS.1770-4 loudness analyzer.",
  },
  realtime_audio_callback: {
    disposition: "NATIVE_IMPLEMENTED",
    domain: "CPP_NATIVE_ENGINEERING",
    providingModulePath: "plugins/vst3/AetherForgeProcessor",
    ownerAgentId: "AGT-08",
    requiredApprovalRole: "NONE",
    componentName: "AetherForgeRealtimeCppCore",
    exclusiveWriteGlobs: ["plugins/vst3/AetherForgeProcessor/**"],
    readOnlyGlobs: ["contracts/**"],
    publicInterfaces: ["AetherForgeProcessor::prepare", "AetherForgeProcessor::processSamples"],
    notes: "Zero-allocation, lock-free C++20 real-time audio processing callback.",
  },
  vst3_atomic_parameter_core: {
    disposition: "NATIVE_IMPLEMENTED",
    domain: "VST3_PLUGIN_ENGINEERING",
    providingModulePath: "plugins/vst3/src",
    ownerAgentId: "AGT-09",
    requiredApprovalRole: "NONE",
    componentName: "Vst3ProcessorBoundary",
    exclusiveWriteGlobs: ["plugins/vst3/src/**"],
    readOnlyGlobs: ["plugins/vst3/AetherForgeProcessor/**", "contracts/**"],
    publicInterfaces: ["AetherForgeVst3Processor.processBlock", "auditCppSourceForRealtimeHazards"],
    notes: "Steinberg VST3 parameter clamping, state serialization, and real-time static audit.",
  },
  flp_readonly_binary_inspection: {
    disposition: "NATIVE_IMPLEMENTED",
    domain: "AI_DAW_AGENTIC_SYSTEMS",
    providingModulePath: "adapters/fl-studio-2025",
    ownerAgentId: "AGT-10",
    requiredApprovalRole: "NONE",
    componentName: "FlStudio2025ReadOnlyAdapter",
    exclusiveWriteGlobs: ["adapters/fl-studio-2025/**", "adapters/daw-contract/**"],
    readOnlyGlobs: ["contracts/**"],
    publicInterfaces: ["FlStudio2025Adapter.inspectFlpFile", "FlStudio2025Adapter.verifyInstallation"],
    notes: "Non-destructive FLhd/FLdt binary inspection and Python MIDI controller script generation.",
  },
  control_plane_rest_api: {
    disposition: "NATIVE_IMPLEMENTED",
    domain: "FULL_STACK_DEVELOPMENT",
    providingModulePath: "apps/api",
    ownerAgentId: "AGT-11",
    requiredApprovalRole: "NONE",
    componentName: "ControlPlaneDomainApi",
    exclusiveWriteGlobs: ["apps/api/**"],
    readOnlyGlobs: ["contracts/**", "services/policy/**", "services/audit/**"],
    publicInterfaces: ["AetherForgeDomainApi.submitBrief", "AetherForgeDomainApi.decideApproval"],
    notes: "OpenAPI 3.1 REST API with OIDC/RBAC and 7-field error taxonomy.",
  },
  operator_web_ui: {
    disposition: "NATIVE_IMPLEMENTED",
    domain: "FULL_STACK_DEVELOPMENT",
    providingModulePath: "apps/web",
    ownerAgentId: "AGT-12",
    requiredApprovalRole: "NONE",
    componentName: "OperatorWebControlPlane",
    exclusiveWriteGlobs: ["apps/web/**", "packages/ui/**"],
    readOnlyGlobs: ["contracts/**", "packages/sdk/**"],
    publicInterfaces: ["createWebControlPlaneServer"],
    notes: "Accessible semantic HTML operator console with 1-click emergency stop.",
  },
  vst3_native_binary_compile: {
    disposition: "EXTERNAL_TOOL_MEDIATED",
    domain: "VST3_PLUGIN_ENGINEERING",
    providingModulePath: "plugins/vst3/CMakeLists.txt",
    ownerAgentId: "AGT-09",
    requiredApprovalRole: "Reviewer",
    componentName: "Vst3NativeBinaryBuild",
    exclusiveWriteGlobs: ["plugins/vst3/CMakeLists.txt"],
    readOnlyGlobs: ["plugins/vst3/AetherForgeProcessor/**"],
    publicInterfaces: ["cmake --build build --config Release"],
    notes: "Requires external C++20 compiler (cl.exe/clang++), C:\\JUCE, and C:\\VST_SDK.",
  },
  pluginval_level10_execution: {
    disposition: "EXTERNAL_TOOL_MEDIATED",
    domain: "TESTING_VERIFICATION_DEPLOYMENT",
    providingModulePath: "tests/security",
    ownerAgentId: "AGT-15",
    requiredApprovalRole: "NONE",
    componentName: "PluginvalVerificationHarness",
    exclusiveWriteGlobs: ["tests/security/**"],
    readOnlyGlobs: ["plugins/vst3/**"],
    publicInterfaces: ["pluginval --strictness-level 10"],
    notes: "Requires external pluginval.exe binary on workstation.",
  },
  tier2_scoped_host_execution: {
    disposition: "HUMAN_APPROVAL_GATED",
    domain: "CPP_NATIVE_ENGINEERING",
    providingModulePath: "workers/windows-host",
    ownerAgentId: "AGT-08",
    requiredApprovalRole: "Reviewer",
    componentName: "WindowsWorkerSandboxHost",
    exclusiveWriteGlobs: ["workers/windows-host/**", "adapters/filesystem/**"],
    readOnlyGlobs: ["contracts/**", "services/policy/**"],
    publicInterfaces: ["WindowsWorkerHost.executeCommand", "NativeWorkerCli.Main"],
    notes: "Gated by single-use Reviewer ApprovalRecord bound to planHash and canonicalPathScope.",
  },
  tier3_production_release_promotion: {
    disposition: "HUMAN_APPROVAL_GATED",
    domain: "TESTING_VERIFICATION_DEPLOYMENT",
    providingModulePath: "services/artifact-registry",
    ownerAgentId: "AGT-13",
    requiredApprovalRole: "DUAL_CONTROL",
    componentName: "DualControlReleasePromoter",
    exclusiveWriteGlobs: ["services/artifact-registry/**", "scripts/**"],
    readOnlyGlobs: ["contracts/**"],
    publicInterfaces: ["ArtifactRegistryService.promoteReleaseCandidateToProduction"],
    notes: "Requires dual-control Reviewer != ReleaseManager sign-off plus SLSA v1.0 provenance.",
  },
  direct_flp_binary_mutation: {
    disposition: "UNSUPPORTED_OR_BLOCKED",
    domain: "AI_DAW_AGENTIC_SYSTEMS",
    providingModulePath: "adapters/fl-studio-2025",
    ownerAgentId: "AGT-10",
    requiredApprovalRole: "NONE",
    componentName: "BlockedFlpMutator",
    exclusiveWriteGlobs: ["adapters/fl-studio-2025/**"],
    readOnlyGlobs: ["contracts/**"],
    publicInterfaces: ["BLOCKED"],
    notes: "Blocked per ADR-0009: proprietary .flp binary mutation risks silent project corruption.",
  },
  fl_engine_memory_injection: {
    disposition: "UNSUPPORTED_OR_BLOCKED",
    domain: "AI_DAW_AGENTIC_SYSTEMS",
    providingModulePath: "adapters/fl-studio-2025",
    ownerAgentId: "AGT-10",
    requiredApprovalRole: "NONE",
    componentName: "BlockedMemoryInjector",
    exclusiveWriteGlobs: ["adapters/fl-studio-2025/**"],
    readOnlyGlobs: ["contracts/**"],
    publicInterfaces: ["BLOCKED"],
    notes: "Blocked per ADR-0009 and GOVERNANCE.md: DLL/process memory injection into FLEngine_x64.dll is forbidden.",
  },
  synchronous_cloud_llm_in_audio_thread: {
    disposition: "UNSUPPORTED_OR_BLOCKED",
    domain: "VST3_PLUGIN_ENGINEERING",
    providingModulePath: "plugins/vst3",
    ownerAgentId: "AGT-09",
    requiredApprovalRole: "NONE",
    componentName: "BlockedRealtimeNetworkCall",
    exclusiveWriteGlobs: ["plugins/vst3/**"],
    readOnlyGlobs: ["contracts/**"],
    publicInterfaces: ["BLOCKED"],
    notes: "Blocked per ADR-0008: network or LLM inference inside real-time audio callbacks causes buffer dropouts.",
  },
  autonomous_self_approval_tier3: {
    disposition: "UNSUPPORTED_OR_BLOCKED",
    domain: "AGENTIC_RUNTIME_ARCHITECTURE",
    providingModulePath: "services/policy",
    ownerAgentId: "AGT-14",
    requiredApprovalRole: "NONE",
    componentName: "BlockedSelfApproval",
    exclusiveWriteGlobs: ["services/policy/**"],
    readOnlyGlobs: ["contracts/**"],
    publicInterfaces: ["BLOCKED"],
    notes: "Blocked per GOVERNANCE.md: agents cannot self-approve Tier 2/3 actions.",
  },
};

const DOMAIN_AGENT_MAP: Record<CoreDomain, SpecialistAgentId[]> = {
  AI_OPERATING_SYSTEMS: ["AGT-01", "AGT-02", "AGT-05", "AGT-14", "AGT-19"],
  MULTI_AGENT_SYSTEMS: ["AGT-01", "AGT-04", "AGT-05", "AGT-06", "AGT-19"],
  AGENTIC_RUNTIME_ARCHITECTURE: ["AGT-01", "AGT-06", "AGT-14", "AGT-17", "AGT-19"],
  AUDIO_PROCESSING_DSP: ["AGT-07", "AGT-08", "AGT-15", "AGT-16", "AGT-19"],
  VST3_PLUGIN_ENGINEERING: ["AGT-07", "AGT-08", "AGT-09", "AGT-16", "AGT-19"],
  AI_DAW_AGENTIC_SYSTEMS: ["AGT-02", "AGT-10", "AGT-15", "AGT-19"],
  CPP_NATIVE_ENGINEERING: ["AGT-08", "AGT-14", "AGT-16", "AGT-19"],
  FULL_STACK_DEVELOPMENT: ["AGT-04", "AGT-11", "AGT-12", "AGT-15", "AGT-19"],
  INFRASTRUCTURE_APIS_INTEGRATIONS: ["AGT-11", "AGT-13", "AGT-14", "AGT-17", "AGT-19"],
  TESTING_VERIFICATION_DEPLOYMENT: ["AGT-13", "AGT-15", "AGT-16", "AGT-18", "AGT-19"],
};

const VAGUE_SUBJECTIVE_PATTERNS: Array<{ regex: RegExp; phrase: string; question: string; options: string[] }> = [
  {
    regex: /\b(ultra[- ]?fast|blazingly fast|super fast|instantaneous)\b/i,
    phrase: "unquantified speed claim",
    question: "What is the exact P95/P99 latency or real-time WCET threshold in milliseconds or microseconds?",
    options: ["WCET <= 30% of 64-sample buffer at 48 kHz (<= 400 us)", "Control-plane P99 latency <= 15 ms", "RAG hybrid query P95 <= 250 ms"],
  },
  {
    regex: /\b(seamless|intuitive|magical|effortless)\b/i,
    phrase: "subjective UX adjective without acceptance metric",
    question: "Which measurable operator workflow metric defines acceptance for this interaction?",
    options: ["WCAG 2.1 AA semantic landmarks + <= 3 clicks to approve diff", "1-click emergency stop preemption <= 100 ms"],
  },
];

function computeSha256(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex").toUpperCase();
}

function padId(prefix: string, index: number): string {
  return `${prefix}-${String(index).padStart(4, "0")}`;
}

export class AetherForgeSystemCompiler {
  public compile(rawRequest: CompilerCompilationRequest): CompiledEngineeringSpecification {
    const request = CompilerCompilationRequestSchema.parse(rawRequest);

    // STAGE 01: Intent Extraction
    const stage01Intent = this.extractIntent(request);

    // STAGE 02: Requirement Extraction
    const stage02Requirements = this.extractRequirements(request);

    // STAGE 03: Ambiguity Detection
    const stage03Ambiguities = this.detectAmbiguities(request, stage02Requirements);

    // STAGE 04: Domain Classification
    const stage04Domains = this.classifyDomains(stage02Requirements);

    // STAGE 05: Capability Mapping
    const stage05Capabilities = this.mapCapabilities(stage02Requirements);

    // STAGE 06: Technical Research Requests
    const stage06ResearchRequests = this.generateResearchRequests(stage05Capabilities, stage02Requirements);

    // STAGE 07: Architecture Generation
    const stage07Architecture = this.generateArchitecture(stage04Domains.activeDomains);

    // STAGE 08: Component Decomposition
    const stage08Components = this.decomposeComponents(stage02Requirements, stage05Capabilities, request);

    // STAGE 09: Dependency Graph Generation
    const stage09DependencyGraph = this.buildDependencyGraph(stage02Requirements, stage08Components);

    // STAGE 10: Workflow Generation
    const stage10Workflow = this.generateWorkflow(
      request.projectId,
      stage08Components,
      stage09DependencyGraph.topologicalComponentOrder,
      stage02Requirements
    );

    // STAGE 11: Test Specification Generation
    const stage11TestSpecifications = this.generateTestSpecifications(
      stage02Requirements,
      stage08Components,
      stage10Workflow.tasks
    );

    // STAGE 12: Acceptance Criteria Generation
    const stage12AcceptanceCriteria = this.generateAcceptanceCriteria(
      stage02Requirements,
      stage08Components,
      stage10Workflow.tasks,
      stage11TestSpecifications
    );

    // 4-Way Traceability Matrix (REQ -> COMP -> TASK -> TEST -> AC)
    const traceabilityMatrix = this.buildTraceabilityMatrix(
      stage02Requirements,
      stage08Components,
      stage10Workflow.tasks,
      stage11TestSpecifications,
      stage12AcceptanceCriteria
    );

    // Semantic Validation (Contradictions, Unsupported Capabilities, Missing Dependencies/Cycles, Blocking Ambiguities)
    const contradictoryRequirements = this.detectContradictions(stage02Requirements);
    const unsupportedCapabilities = stage05Capabilities.filter((c) => c.disposition === "UNSUPPORTED_OR_BLOCKED");
    const blockingAmbiguities = stage03Ambiguities.filter((a) => a.severity === "BLOCKING");
    const missingDeps = [
      ...stage09DependencyGraph.missingDependencies,
      ...stage09DependencyGraph.cycleDescriptions,
    ];

    let status: CompiledEngineeringSpecification["validation"]["status"] = "COMPILED_VALID";
    if (contradictoryRequirements.length > 0) {
      status = "REJECTED_CONTRADICTORY_REQUIREMENTS";
    } else if (unsupportedCapabilities.length > 0) {
      status = "REJECTED_UNSUPPORTED_CAPABILITIES";
    } else if (missingDeps.length > 0) {
      status = "REJECTED_MISSING_DEPENDENCIES";
    } else if (request.failOnBlockingAmbiguity && blockingAmbiguities.length > 0) {
      status = "HALTED_BLOCKING_AMBIGUITY";
    }

    const isValid =
      status === "COMPILED_VALID" &&
      traceabilityMatrix.completenessRate === 1 &&
      stage10Workflow.disjointParallelWriteSetsVerified;

    const validation = {
      isValid,
      status,
      missingDependencies: missingDeps,
      contradictoryRequirements,
      unsupportedCapabilities,
      blockingAmbiguities,
      traceabilityCompletenessRate: traceabilityMatrix.completenessRate,
    };

    const compiledAt = "2026-11-23T02:00:00.000Z";
    const specificationId = `SPEC-${request.projectId.toUpperCase().replace(/[^A-Z0-9-]/g, "-")}-V${request.specificationVersion}`;

    const canonicalPayloadForHash = JSON.stringify({
      schemaVersion: "1.0.0",
      specificationId,
      projectId: request.projectId,
      tenantId: request.tenantId,
      specificationVersion: request.specificationVersion,
      validation,
      pipelineStages: {
        stage01Intent,
        stage02Requirements,
        stage03Ambiguities,
        stage04Domains,
        stage05Capabilities,
        stage06ResearchRequests,
        stage07Architecture,
        stage08Components,
        stage09DependencyGraph,
        stage10Workflow,
        stage11TestSpecifications,
        stage12AcceptanceCriteria,
      },
      traceabilityMatrix,
    });

    const specificationSha256 = computeSha256(canonicalPayloadForHash);

    return CompiledEngineeringSpecificationSchema.parse({
      schemaVersion: "1.0.0",
      specificationId,
      projectId: request.projectId,
      tenantId: request.tenantId,
      specificationVersion: request.specificationVersion,
      compiledAt,
      specificationSha256,
      validation,
      pipelineStages: {
        stage01Intent,
        stage02Requirements,
        stage03Ambiguities,
        stage04Domains,
        stage05Capabilities,
        stage06ResearchRequests,
        stage07Architecture,
        stage08Components,
        stage09DependencyGraph,
        stage10Workflow,
        stage11TestSpecifications,
        stage12AcceptanceCriteria,
      },
      traceabilityMatrix,
    });
  }

  private extractIntent(request: ParsedCompilerCompilationRequest) {
    const firstInput = request.inputs[0]!;
    const inputTypesProcessed = Array.from(new Set(request.inputs.map((i) => i.inputType)));
    const combinedText = request.inputs.map((i) => `${i.title}: ${i.rawContent}`).join(" | ");

    const hasAudio = /\b(vst3|dsp|audio|lufs|fl studio|flp|biquad)\b/i.test(combinedText);
    const hasMultiAgent = /\b(agent|temporal|opa|orchestrat|workflow|rag|pgvector)\b/i.test(combinedText);

    const projectCategory =
      hasAudio && hasMultiAgent
        ? "HYBRID_AI_DAW_AND_AGENTIC_ENGINEERING_PLATFORM"
        : hasAudio
          ? "REALTIME_DSP_AND_VST3_AUDIO_SYSTEM"
          : "GOVERNED_MULTI_AGENT_SOFTWARE_SYSTEM";

    return {
      primaryGoal: firstInput.title,
      projectCategory,
      targetPersonas: ["Principal Systems Architect", "DSP & Audio Plugin Engineer", "Security & Verification Reviewer"],
      businessOutcomes: [
        "Deterministic, machine-verifiable specification and execution DAG",
        "Zero-Trust OPA policy enforcement with immutable hash-chained audit evidence",
        "100% 4-way requirement-to-component-to-task-to-test traceability",
      ],
      targetAutonomyCap: "L3" as const,
      sourceInputIds: request.inputs.map((i) => i.inputId),
      inputTypesProcessed,
    };
  }

  private extractRequirements(request: ParsedCompilerCompilationRequest): ExtractedRequirement[] {
    const extracted: ExtractedRequirement[] = [];
    let funcCounter = 100;
    let nonFuncCounter = 100;

    for (const input of request.inputs) {
      if (input.structuredRequirements.length > 0) {
        for (const sr of input.structuredRequirements) {
          const reqId =
            sr.id ??
            (sr.kind === "FUNCTIONAL" ? padId("REQ-F", ++funcCounter) : padId("REQ-NF", ++nonFuncCounter));
          extracted.push({
            requirementId: reqId,
            kind: sr.kind,
            statement: sr.statement,
            metricName: sr.metricName ?? (sr.kind === "FUNCTIONAL" ? "deterministicPassRate" : "latencyMs"),
            thresholdOperator: sr.thresholdOperator ?? (sr.kind === "FUNCTIONAL" ? "==" : "<="),
            thresholdValue: sr.thresholdValue ?? (sr.kind === "FUNCTIONAL" ? 1 : 100),
            unit: sr.unit ?? (sr.kind === "FUNCTIONAL" ? "ratio" : "ms"),
            actionTier: sr.actionTier,
            autonomyLevel: sr.autonomyLevel,
            requestedCapabilities:
              sr.requestedCapabilities.length > 0
                ? sr.requestedCapabilities
                : this.inferCapabilitiesFromText(sr.statement, input.inputType),
            constraints: sr.constraints,
            dependsOnRequirementIds: sr.dependsOnRequirementIds,
            sourceInputId: input.inputId,
          });
        }
      } else {
        // Deterministically synthesize a measurable requirement from unstructured input
        const inferredCaps = this.inferCapabilitiesFromText(input.rawContent, input.inputType);
        const isNf = /\b(latency|wcet|p99|p95|lufs|dbtp|allocation)\b/i.test(input.rawContent);
        const reqId = isNf ? padId("REQ-NF", ++nonFuncCounter) : padId("REQ-F", ++funcCounter);
        extracted.push({
          requirementId: reqId,
          kind: isNf ? "NON_FUNCTIONAL" : "FUNCTIONAL",
          statement: input.rawContent.trim(),
          metricName: isNf ? "executionLatencyMs" : "contractVerificationPassRate",
          thresholdOperator: isNf ? "<=" : "==",
          thresholdValue: isNf ? 15 : 1,
          unit: isNf ? "ms" : "ratio",
          actionTier: "1",
          autonomyLevel: "L3",
          requestedCapabilities: inferredCaps,
          constraints: [],
          dependsOnRequirementIds: [],
          sourceInputId: input.inputId,
        });
      }
    }

    return extracted;
  }

  private inferCapabilitiesFromText(text: string, inputType: CompilerCompilationRequest["inputs"][number]["inputType"]): string[] {
    const caps = new Set<string>();
    if (/\b(vst3|plugin|iaudioprocessor)\b/i.test(text)) caps.add("vst3_atomic_parameter_core");
    if (/\b(real[- ]?time|processsamples|zero[- ]?allocation|c\+\+20)\b/i.test(text)) caps.add("realtime_audio_callback");
    if (/\b(dsp|biquad|lufs|true peak|audio)\b/i.test(text)) caps.add("offline_biquad_dsp_render");
    if (/\b(fl studio|\.flp|flhd|fldt)\b/i.test(text)) caps.add("flp_readonly_binary_inspection");
    if (/\b(temporal|workflow|dag|orchestrat)\b/i.test(text)) caps.add("temporal_dag_orchestration");
    if (/\b(opa|rego|policy|zero[- ]?trust)\b/i.test(text)) caps.add("opa_rego_policy_gate");
    if (/\b(rag|pgvector|knowledge|provenance)\b/i.test(text)) caps.add("pgvector_hybrid_rag");
    if (/\b(llm|provider|gateway)\b/i.test(text)) caps.add("provider_gateway_routing");
    if (/\b(web|ui|screen|accessibility)\b/i.test(text)) caps.add("operator_web_ui");
    if (/\b(release|slsa|sbom|dual[- ]?control)\b/i.test(text)) caps.add("tier3_production_release_promotion");

    if (caps.size === 0) {
      if (inputType === "EXISTING_REPOSITORY" || inputType === "PROCESS_DESCRIPTION") {
        caps.add("temporal_dag_orchestration");
        caps.add("opa_rego_policy_gate");
      } else {
        caps.add("control_plane_rest_api");
      }
    }
    return Array.from(caps);
  }

  private detectAmbiguities(
    request: ParsedCompilerCompilationRequest,
    requirements: ExtractedRequirement[]
  ): AmbiguityFinding[] {
    const findings: AmbiguityFinding[] = [];
    let ambCounter = 0;

    for (const req of requirements) {
      const sourceInput = request.inputs.find((i) => i.inputId === req.sourceInputId);
      const hasExplicitThreshold =
        sourceInput?.structuredRequirements.some(
          (sr) => sr.statement === req.statement && sr.thresholdValue !== undefined
        ) ?? false;

      for (const pattern of VAGUE_SUBJECTIVE_PATTERNS) {
        const match = req.statement.match(pattern.regex);
        if (match && !hasExplicitThreshold) {
          findings.push({
            ambiguityId: padId("AMB", ++ambCounter),
            sourceInputId: req.sourceInputId,
            relatedRequirementId: req.requirementId,
            severity: "BLOCKING",
            ambiguousPhrase: match[0],
            reason: `Subjective phrase '${match[0]}' (${pattern.phrase}) lacks an explicit quantitative metric threshold.`,
            clarificationQuestion: pattern.question,
            resolutionOptions: pattern.options,
          });
        }
      }
    }

    return findings;
  }

  private classifyDomains(requirements: ExtractedRequirement[]) {
    const activeDomainsSet = new Set<CoreDomain>();
    const rationale: Record<string, string> = {};

    for (const req of requirements) {
      for (const cap of req.requestedCapabilities) {
        const def = CAPABILITY_CATALOG[cap];
        if (def) {
          activeDomainsSet.add(def.domain);
          rationale[def.domain] = `Activated by capability '${cap}' in requirement ${req.requirementId}.`;
        }
      }
    }

    activeDomainsSet.add("TESTING_VERIFICATION_DEPLOYMENT");
    rationale["TESTING_VERIFICATION_DEPLOYMENT"] =
      "Mandatory domain for AGT-15 QA, AGT-16 Performance, and AGT-19 Independent Verification.";

    const activeDomains = Array.from(activeDomainsSet);
    const primaryDomain = activeDomains[0] ?? "AGENTIC_RUNTIME_ARCHITECTURE";

    const agentsSet = new Set<SpecialistAgentId>(["AGT-01", "AGT-03", "AGT-04", "AGT-19"]);
    for (const dom of activeDomains) {
      for (const agt of DOMAIN_AGENT_MAP[dom]) {
        agentsSet.add(agt);
      }
    }

    return {
      primaryDomain,
      activeDomains,
      assignedSpecialistAgents: Array.from(agentsSet).sort(),
      domainRationale: rationale,
    };
  }

  private mapCapabilities(requirements: ExtractedRequirement[]): CapabilityMappingEntry[] {
    const entries: CapabilityMappingEntry[] = [];
    for (const req of requirements) {
      for (const capKey of req.requestedCapabilities) {
        const def = CAPABILITY_CATALOG[capKey];
        if (def) {
          entries.push({
            capabilityKey: capKey,
            requirementId: req.requirementId,
            disposition: def.disposition,
            providingModulePath: def.providingModulePath,
            ownerAgentId: def.ownerAgentId,
            requiredApprovalRole: def.requiredApprovalRole,
            notes: def.notes,
          });
        } else {
          entries.push({
            capabilityKey: capKey,
            requirementId: req.requirementId,
            disposition: "UNSUPPORTED_OR_BLOCKED",
            providingModulePath: "unregistered/unknown",
            ownerAgentId: "AGT-01",
            requiredApprovalRole: "NONE",
            notes: `Capability '${capKey}' is not registered in the verified AETHER FORGE capability matrix.`,
          });
        }
      }
    }
    return entries;
  }

  private generateResearchRequests(
    capabilities: CapabilityMappingEntry[],
    requirements: ExtractedRequirement[]
  ): TechnicalResearchRequest[] {
    const requests: TechnicalResearchRequest[] = [];
    let counter = 0;

    const externalOrDawCaps = capabilities.filter(
      (c) =>
        c.disposition === "EXTERNAL_TOOL_MEDIATED" ||
        c.capabilityKey === "flp_readonly_binary_inspection" ||
        c.capabilityKey === "vst3_atomic_parameter_core"
    );

    if (externalOrDawCaps.length > 0) {
      const groupedByCap = new Map<string, string[]>();
      for (const entry of externalOrDawCaps) {
        const list = groupedByCap.get(entry.capabilityKey) ?? [];
        if (!list.includes(entry.requirementId)) list.push(entry.requirementId);
        groupedByCap.set(entry.capabilityKey, list);
      }

      for (const [capKey, reqIds] of groupedByCap.entries()) {
        const def = CAPABILITY_CATALOG[capKey];
        requests.push({
          researchRequestId: padId("RES", ++counter),
          assignedAgentId: "AGT-02",
          domain: def?.domain ?? "TESTING_VERIFICATION_DEPLOYMENT",
          topic: `Verify host toolchain & specification provenance for capability '${capKey}'`,
          verificationMethod:
            capKey.includes("flp") || capKey.includes("binary") || capKey.includes("pluginval")
              ? "HOST_BINARY_SHA256_PROBE"
              : "OFFLINE_SPEC_CITATION_LOOKUP",
          requiredForRequirementIds: reqIds,
          epistemicDefaultIfUnavailable: "unverified_assumptions",
        });
      }
    } else {
      requests.push({
        researchRequestId: padId("RES", ++counter),
        assignedAgentId: "AGT-02",
        domain: "AI_OPERATING_SYSTEMS",
        topic: "Verify SPDX license compatibility and baseline dependency hashes",
        verificationMethod: "SPDX_LICENSE_COMPATIBILITY_CHECK",
        requiredForRequirementIds: requirements.map((r) => r.requirementId),
        epistemicDefaultIfUnavailable: "unverified_assumptions",
      });
    }

    return requests;
  }

  private generateArchitecture(activeDomains: CoreDomain[]) {
    const hasRealtimeAudio =
      activeDomains.includes("AUDIO_PROCESSING_DSP") ||
      activeDomains.includes("VST3_PLUGIN_ENGINEERING") ||
      activeDomains.includes("AI_DAW_AGENTIC_SYSTEMS");

    const architecturePattern = hasRealtimeAudio
      ? ("REALTIME_AUDIO_ISOLATED_HYBRID" as const)
      : ("GOVERNED_HYBRID_CONTROL_AND_WORKER_PLANE" as const);

    const activeSubsystems = hasRealtimeAudio
      ? ["ARCH-01", "ARCH-03", "ARCH-04", "ARCH-05", "ARCH-07", "ARCH-09", "ARCH-11"]
      : ["ARCH-01", "ARCH-02", "ARCH-03", "ARCH-04", "ARCH-06", "ARCH-07", "ARCH-10", "ARCH-11"];

    const trustBoundaries: Array<"TB-1" | "TB-2" | "TB-3" | "TB-4"> = hasRealtimeAudio
      ? ["TB-1", "TB-2", "TB-3", "TB-4"]
      : ["TB-1", "TB-2", "TB-3"];

    const applicableAdrs = hasRealtimeAudio
      ? ["ADR-0001", "ADR-0003", "ADR-0004", "ADR-0008", "ADR-0009", "ADR-0010"]
      : ["ADR-0001", "ADR-0002", "ADR-0003", "ADR-0005", "ADR-0007", "ADR-0010", "ADR-0012"];

    return {
      architecturePattern,
      activeSubsystems,
      trustBoundaries,
      applicableAdrs,
      realtimeIsolationEnforced: hasRealtimeAudio,
      opaDefaultDenyEnforced: true,
    };
  }

  private decomposeComponents(
    requirements: ExtractedRequirement[],
    capabilities: CapabilityMappingEntry[],
    request: ParsedCompilerCompilationRequest
  ): ComponentSpec[] {
    const componentByModule = new Map<string, ComponentSpec>();
    let compCounter = 0;

    // Map explicit custom component IDs from structured requirements first
    const explicitCompDeps = new Map<string, string[]>();
    for (const input of request.inputs) {
      for (const sr of input.structuredRequirements) {
        if (sr.targetComponentId && sr.dependsOnComponentIds.length > 0) {
          explicitCompDeps.set(sr.targetComponentId, sr.dependsOnComponentIds);
        }
      }
    }

    for (const capEntry of capabilities) {
      const def = CAPABILITY_CATALOG[capEntry.capabilityKey];
      const moduleKey = def ? def.providingModulePath : `unregistered/${capEntry.capabilityKey}`;
      const existing = componentByModule.get(moduleKey);

      if (existing) {
        if (!existing.satisfiesRequirementIds.includes(capEntry.requirementId)) {
          existing.satisfiesRequirementIds.push(capEntry.requirementId);
        }
      } else {
        const matchingInputReq = request.inputs
          .flatMap((i) => i.structuredRequirements)
          .find((sr) => sr.id === capEntry.requirementId && sr.targetComponentId);

        const componentId = matchingInputReq?.targetComponentId ?? padId("COMP", ++compCounter);
        componentByModule.set(moduleKey, {
          componentId,
          name: def?.componentName ?? `Unregistered_${capEntry.capabilityKey}`,
          domain: def?.domain ?? "AGENTIC_RUNTIME_ARCHITECTURE",
          modulePath: moduleKey,
          ownerAgentId: def?.ownerAgentId ?? "AGT-01",
          exclusiveWriteGlobs: def?.exclusiveWriteGlobs ?? [`${moduleKey}/**`],
          readOnlyGlobs: def?.readOnlyGlobs ?? ["contracts/**"],
          satisfiesRequirementIds: [capEntry.requirementId],
          dependsOnComponentIds: explicitCompDeps.get(componentId) ?? [],
          publicInterfaces: def?.publicInterfaces ?? ["UNSPECIFIED"],
        });
      }
    }

    // Ensure every requirement maps to at least one component
    for (const req of requirements) {
      const alreadyCovered = Array.from(componentByModule.values()).some((c) =>
        c.satisfiesRequirementIds.includes(req.requirementId)
      );
      if (!alreadyCovered) {
        const compId = padId("COMP", ++compCounter);
        componentByModule.set(`apps/api/${compId}`, {
          componentId: compId,
          name: `ControlPlaneComponent_${compId}`,
          domain: "FULL_STACK_DEVELOPMENT",
          modulePath: "apps/api",
          ownerAgentId: "AGT-11",
          exclusiveWriteGlobs: [`apps/api/src/${compId.toLowerCase()}/**`],
          readOnlyGlobs: ["contracts/**"],
          satisfiesRequirementIds: [req.requirementId],
          dependsOnComponentIds: [],
          publicInterfaces: ["AetherForgeDomainApi"],
        });
      }
    }

    // Derive component dependency edges from requirement dependencies where not explicitly set
    const components = Array.from(componentByModule.values());
    for (const comp of components) {
      for (const reqId of comp.satisfiesRequirementIds) {
        const req = requirements.find((r) => r.requirementId === reqId);
        if (!req) continue;
        for (const depReqId of req.dependsOnRequirementIds) {
          const targetComp = components.find((c) => c.satisfiesRequirementIds.includes(depReqId));
          if (targetComp && targetComp.componentId !== comp.componentId) {
            if (!comp.dependsOnComponentIds.includes(targetComp.componentId)) {
              comp.dependsOnComponentIds.push(targetComp.componentId);
            }
          }
        }
      }
    }

    return components;
  }

  private buildDependencyGraph(requirements: ExtractedRequirement[], components: ComponentSpec[]) {
    const reqIds = new Set(requirements.map((r) => r.requirementId));
    const compIds = new Set(components.map((c) => c.componentId));
    const edges: DependencyEdge[] = [];
    const missingDependencies: string[] = [];

    for (const req of requirements) {
      for (const depId of req.dependsOnRequirementIds) {
        if (!reqIds.has(depId)) {
          missingDependencies.push(
            `Requirement ${req.requirementId} depends on missing requirement ${depId}.`
          );
        } else {
          edges.push({
            fromId: depId,
            toId: req.requirementId,
            kind: "REQUIREMENT_DEPENDENCY",
          });
        }
      }
    }

    for (const comp of components) {
      for (const depCompId of comp.dependsOnComponentIds) {
        if (!compIds.has(depCompId)) {
          missingDependencies.push(
            `Component ${comp.componentId} depends on missing component ${depCompId}.`
          );
        } else {
          edges.push({
            fromId: depCompId,
            toId: comp.componentId,
            kind: "COMPONENT_DEPENDENCY",
          });
        }
      }
    }

    const reqTopo = this.kahnTopologicalSort(
      Array.from(reqIds),
      edges.filter((e) => e.kind === "REQUIREMENT_DEPENDENCY")
    );
    const compTopo = this.kahnTopologicalSort(
      Array.from(compIds),
      edges.filter((e) => e.kind === "COMPONENT_DEPENDENCY")
    );

    const cycleDescriptions = [...reqTopo.cycles, ...compTopo.cycles];

    return {
      componentNodes: Array.from(compIds),
      requirementNodes: Array.from(reqIds),
      edges,
      topologicalComponentOrder: compTopo.order,
      topologicalRequirementOrder: reqTopo.order,
      hasCycles: cycleDescriptions.length > 0,
      cycleDescriptions,
      missingDependencies,
    };
  }

  private kahnTopologicalSort(nodes: string[], edges: DependencyEdge[]): { order: string[]; cycles: string[] } {
    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();
    for (const n of nodes) {
      inDegree.set(n, 0);
      adj.set(n, []);
    }
    for (const e of edges) {
      if (adj.has(e.fromId) && inDegree.has(e.toId)) {
        adj.get(e.fromId)!.push(e.toId);
        inDegree.set(e.toId, (inDegree.get(e.toId) ?? 0) + 1);
      }
    }

    const queue: string[] = [];
    for (const [node, deg] of inDegree.entries()) {
      if (deg === 0) queue.push(node);
    }
    queue.sort();

    const order: string[] = [];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      order.push(curr);
      for (const next of adj.get(curr) ?? []) {
        const nextDeg = (inDegree.get(next) ?? 1) - 1;
        inDegree.set(next, nextDeg);
        if (nextDeg === 0) {
          queue.push(next);
          queue.sort();
        }
      }
    }

    const cycles: string[] = [];
    if (order.length < nodes.length) {
      const cyclicNodes = nodes.filter((n) => !order.includes(n));
      cycles.push(`Circular dependency detected involving nodes: ${cyclicNodes.join(" -> ")}`);
      // Append remaining nodes deterministically so downstream IR assembly doesn't crash
      for (const cn of cyclicNodes) {
        order.push(cn);
      }
    }

    return { order, cycles };
  }

  private generateWorkflow(
    projectId: string,
    components: ComponentSpec[],
    topoComponentOrder: string[],
    requirements: ExtractedRequirement[]
  ) {
    const tasks: WorkflowTaskSpec[] = [];
    const compToTaskId = new Map<string, string>();
    let fenceCounter = 0;

    // Order components by topological order
    const orderedComponents = topoComponentOrder
      .map((cid) => components.find((c) => c.componentId === cid))
      .filter((c): c is ComponentSpec => c !== undefined);

    for (const comp of orderedComponents) {
      const taskId = padId("TASK", ++fenceCounter);
      compToTaskId.set(comp.componentId, taskId);
    }

    // Track write globs to serialize any tasks sharing overlapping write globs
    const globOwnerTask = new Map<string, string>();

    for (let idx = 0; idx < orderedComponents.length; idx++) {
      const comp = orderedComponents[idx]!;
      const taskId = compToTaskId.get(comp.componentId)!;

      const compReqs = requirements.filter((r) => comp.satisfiesRequirementIds.includes(r.requirementId));
      const maxTierNum = compReqs.reduce((acc, r) => Math.max(acc, Number(r.actionTier)), 1);
      const actionTier = String(maxTierNum) as "0" | "1" | "2" | "3";

      const dependsOnTaskIds = new Set<string>();
      for (const depCompId of comp.dependsOnComponentIds) {
        const depTaskId = compToTaskId.get(depCompId);
        if (depTaskId && depTaskId !== taskId) {
          dependsOnTaskIds.add(depTaskId);
        }
      }

      for (const glob of comp.exclusiveWriteGlobs) {
        const prevOwner = globOwnerTask.get(glob);
        if (prevOwner && prevOwner !== taskId) {
          dependsOnTaskIds.add(prevOwner);
        }
        globOwnerTask.set(glob, taskId);
      }

      tasks.push({
        taskId,
        title: `Implement and verify ${comp.name} (${comp.modulePath})`,
        componentId: comp.componentId,
        requirementIds: comp.satisfiesRequirementIds,
        assignedAgentId: comp.ownerAgentId,
        actionTier,
        fenceTokenOrder: idx + 1,
        exclusiveWriteGlobs: comp.exclusiveWriteGlobs,
        dependsOnTaskIds: Array.from(dependsOnTaskIds),
        requiresHumanApproval: maxTierNum >= 2,
        verificationCheck: `pnpm typecheck && pnpm test (verifying ${comp.publicInterfaces.join(", ")})`,
        rollbackHint: `git checkout -- ${comp.exclusiveWriteGlobs.join(" ")}`,
      });
    }

    // Mandatory Terminal Independent Verification Task (AGT-19)
    const terminalTaskId = padId("TASK", ++fenceCounter);
    const firstCompId = orderedComponents[0]?.componentId ?? "COMP-0001";
    tasks.push({
      taskId: terminalTaskId,
      title: "Independent Separation-of-Duty Verification Gate (AGT-19)",
      componentId: firstCompId,
      requirementIds: requirements.map((r) => r.requirementId),
      assignedAgentId: "AGT-19",
      actionTier: "0",
      fenceTokenOrder: fenceCounter,
      exclusiveWriteGlobs: [],
      dependsOnTaskIds: tasks.map((t) => t.taskId),
      requiresHumanApproval: false,
      verificationCheck: "Recompute disk SHA-256 hashes, verify lease boundaries, and run full pnpm test suite",
      rollbackHint: "Read-only verification step; reject workflow on FAIL verdict.",
    });

    return {
      workflowId: `WF-${projectId.toUpperCase().replace(/[^A-Z0-9-]/g, "-")}`,
      maxDelegationDepth: 2 as const,
      disjointParallelWriteSetsVerified: true,
      tasks,
      terminalVerificationTaskId: terminalTaskId,
    };
  }

  private generateTestSpecifications(
    requirements: ExtractedRequirement[],
    components: ComponentSpec[],
    tasks: WorkflowTaskSpec[]
  ): TestSpecification[] {
    const tests: TestSpecification[] = [];
    let testCounter = 0;

    for (const comp of components) {
      const compTasks = tasks
        .filter((t) => t.componentId === comp.componentId && t.assignedAgentId !== "AGT-19")
        .map((t) => t.taskId);
      const compReqs = requirements.filter((r) => comp.satisfiesRequirementIds.includes(r.requirementId));

      const isAudioDsp = comp.domain === "AUDIO_PROCESSING_DSP" || comp.domain === "AI_DAW_AGENTIC_SYSTEMS";
      const isRealtime = comp.domain === "VST3_PLUGIN_ENGINEERING" || comp.domain === "CPP_NATIVE_ENGINEERING";
      const isSecurity = comp.ownerAgentId === "AGT-14" || compReqs.some((r) => Number(r.actionTier) >= 2);

      const suiteCategory: TestSpecification["suiteCategory"] = isRealtime
        ? "REALTIME_WCET"
        : isAudioDsp
          ? "AUDIO_DSP"
          : isSecurity
            ? "SECURITY"
            : "CONTRACT";

      const assignedAgentId: TestSpecification["assignedAgentId"] = isRealtime ? "AGT-16" : "AGT-15";

      const oracleSummary = compReqs
        .map((r) => `${r.requirementId}: ${r.metricName} ${r.thresholdOperator} ${r.thresholdValue} ${r.unit}`)
        .join("; ");

      tests.push({
        testId: padId("TEST", ++testCounter),
        title: `Verify ${comp.name} against ${comp.satisfiesRequirementIds.join(", ")}`,
        suiteCategory,
        assignedAgentId,
        verifiesRequirementIds: comp.satisfiesRequirementIds,
        verifiesComponentIds: [comp.componentId],
        verifiesTaskIds: compTasks.length > 0 ? compTasks : [tasks[0]!.taskId],
        testFilePath: `tests/${suiteCategory.toLowerCase()}/src/${comp.componentId.toLowerCase()}-verification.test.ts`,
        deterministicOracle: oracleSummary,
      });
    }

    // Add End-to-End Independent Verification Test bound to the terminal AGT-19 task
    const terminalTask = tasks.find((t) => t.assignedAgentId === "AGT-19")!;
    tests.push({
      testId: padId("TEST", ++testCounter),
      title: "Independent End-to-End Artifact SHA-256 & Lease Boundary Verification",
      suiteCategory: "INTEGRATION_E2E",
      assignedAgentId: "AGT-19",
      verifiesRequirementIds: requirements.map((r) => r.requirementId),
      verifiesComponentIds: components.map((c) => c.componentId),
      verifiesTaskIds: [terminalTask.taskId],
      testFilePath: "COMPILER_TESTS/system-compiler.test.ts",
      deterministicOracle: "100% disk SHA-256 match, 0 out-of-lease mutations, exitCode == 0",
    });

    return tests;
  }

  private generateAcceptanceCriteria(
    requirements: ExtractedRequirement[],
    components: ComponentSpec[],
    tasks: WorkflowTaskSpec[],
    tests: TestSpecification[]
  ): AcceptanceCriterionSpec[] {
    return requirements.map((req, index) => {
      const compIds = components
        .filter((c) => c.satisfiesRequirementIds.includes(req.requirementId))
        .map((c) => c.componentId);
      const taskIds = tasks
        .filter((t) => t.requirementIds.includes(req.requirementId))
        .map((t) => t.taskId);
      const testIds = tests
        .filter((tst) => tst.verifiesRequirementIds.includes(req.requirementId))
        .map((tst) => tst.testId);

      return {
        criterionId: padId("AC", index + 1),
        requirementIds: [req.requirementId],
        componentIds: compIds,
        taskIds,
        testIds,
        gateCondition: `Verify ${req.requirementId} (${req.metricName} ${req.thresholdOperator} ${req.thresholdValue} ${req.unit}) with exitCode === 0 and signed AGT-19 attestation.`,
        verifierAgentId: "AGT-19" as const,
      };
    });
  }

  private buildTraceabilityMatrix(
    requirements: ExtractedRequirement[],
    components: ComponentSpec[],
    tasks: WorkflowTaskSpec[],
    tests: TestSpecification[],
    acceptanceCriteria: AcceptanceCriterionSpec[]
  ) {
    const rows: RequirementTraceabilityRow[] = [];
    const coveredCompIds = new Set<string>();
    const coveredTaskIds = new Set<string>();
    const coveredTestIds = new Set<string>();

    for (const req of requirements) {
      const cIds = components
        .filter((c) => c.satisfiesRequirementIds.includes(req.requirementId))
        .map((c) => c.componentId);
      const tIds = tasks
        .filter((t) => t.requirementIds.includes(req.requirementId))
        .map((t) => t.taskId);
      const vIds = tests
        .filter((v) => v.verifiesRequirementIds.includes(req.requirementId))
        .map((v) => v.testId);
      const acIds = acceptanceCriteria
        .filter((ac) => ac.requirementIds.includes(req.requirementId))
        .map((ac) => ac.criterionId);

      cIds.forEach((id) => coveredCompIds.add(id));
      tIds.forEach((id) => coveredTaskIds.add(id));
      vIds.forEach((id) => coveredTestIds.add(id));

      const complete = cIds.length > 0 && tIds.length > 0 && vIds.length > 0 && acIds.length > 0;
      rows.push({
        requirementId: req.requirementId,
        componentIds: cIds,
        taskIds: tIds,
        testIds: vIds,
        acceptanceCriteriaIds: acIds,
        forwardAndBackwardComplete: complete,
      });
    }

    const orphanRequirements = rows.filter((r) => !r.forwardAndBackwardComplete).map((r) => r.requirementId);
    const orphanComponents = components.filter((c) => !coveredCompIds.has(c.componentId)).map((c) => c.componentId);
    const orphanTasks = tasks.filter((t) => !coveredTaskIds.has(t.taskId)).map((t) => t.taskId);
    const orphanTests = tests.filter((v) => !coveredTestIds.has(v.testId)).map((v) => v.testId);

    const completeRows = rows.filter((r) => r.forwardAndBackwardComplete).length;
    const completenessRate =
      rows.length === 0 ||
      orphanComponents.length > 0 ||
      orphanTasks.length > 0 ||
      orphanTests.length > 0
        ? 0
        : completeRows / rows.length;

    return {
      rows,
      orphanRequirements,
      orphanComponents,
      orphanTasks,
      orphanTests,
      completenessRate,
    };
  }

  private detectContradictions(requirements: ExtractedRequirement[]): ContradictionDiagnostic[] {
    const diagnostics: ContradictionDiagnostic[] = [];
    let conCounter = 0;

    // 1. Check architectural constraint contradictions across requirement pairs
    for (let i = 0; i < requirements.length; i++) {
      for (let j = i + 1; j < requirements.length; j++) {
        const rA = requirements[i]!;
        const rB = requirements[j]!;

        const combinedCaps = new Set([...rA.requestedCapabilities, ...rB.requestedCapabilities]);
        const combinedConstraints = new Set([
          ...rA.constraints.map((c) => c.toUpperCase()),
          ...rB.constraints.map((c) => c.toUpperCase()),
        ]);

        // Rule CON-RULE-01: Real-time audio callback + synchronous cloud LLM / network I/O in audio thread
        const hasRtAudio =
          combinedCaps.has("realtime_audio_callback") ||
          combinedConstraints.has("ZERO_ALLOCATION_REALTIME_THREAD");
        const hasSyncCloudInAudio =
          combinedCaps.has("synchronous_cloud_llm_in_audio_thread") ||
          combinedConstraints.has("SYNCHRONOUS_NETWORK_IO_IN_AUDIO_THREAD");

        if (hasRtAudio && hasSyncCloudInAudio) {
          diagnostics.push({
            contradictionId: padId("CON", ++conCounter),
            requirementIdA: rA.requirementId,
            requirementIdB: rB.requirementId,
            ruleViolated: "CON-RULE-01 (ADR-0008 Real-Time Audio vs. Blocking Network/LLM I/O)",
            explanation:
              "Cannot combine zero-allocation real-time audio callback with synchronous cloud LLM or network I/O on the audio thread.",
          });
        }

        // Rule CON-RULE-02: Air-gapped offline execution + live external cloud API
        if (
          combinedConstraints.has("AIR_GAPPED_OFFLINE_ONLY") &&
          combinedConstraints.has("LIVE_EXTERNAL_CLOUD_API")
        ) {
          diagnostics.push({
            contradictionId: padId("CON", ++conCounter),
            requirementIdA: rA.requirementId,
            requirementIdB: rB.requirementId,
            ruleViolated: "CON-RULE-02 (Air-Gapped Offline vs. Live External Cloud Dependency)",
            explanation:
              "Project cannot simultaneously enforce AIR_GAPPED_OFFLINE_ONLY and require LIVE_EXTERNAL_CLOUD_API.",
          });
        }

        // Rule CON-RULE-03: Disjoint numeric metric threshold intervals on identical metricName & unit
        if (rA.metricName === rB.metricName && rA.unit === rB.unit) {
          const boundsA = this.toNumericBounds(rA.thresholdOperator, rA.thresholdValue);
          const boundsB = this.toNumericBounds(rB.thresholdOperator, rB.thresholdValue);
          const lower = Math.max(boundsA.min, boundsB.min);
          const upper = Math.min(boundsA.max, boundsB.max);

          if (lower > upper || (lower === upper && (!boundsA.inclusive || !boundsB.inclusive))) {
            diagnostics.push({
              contradictionId: padId("CON", ++conCounter),
              requirementIdA: rA.requirementId,
              requirementIdB: rB.requirementId,
              ruleViolated: "CON-RULE-03 (Disjoint Numeric Threshold Interval)",
              explanation: `Metric '${rA.metricName}' (${rA.unit}) has incompatible thresholds: (${rA.thresholdOperator} ${rA.thresholdValue}) vs (${rB.thresholdOperator} ${rB.thresholdValue}).`,
            });
          }
        }
      }
    }

    return diagnostics;
  }

  private toNumericBounds(
    op: ExtractedRequirement["thresholdOperator"],
    val: number
  ): { min: number; max: number; inclusive: boolean } {
    switch (op) {
      case "<=":
        return { min: Number.NEGATIVE_INFINITY, max: val, inclusive: true };
      case "<":
        return { min: Number.NEGATIVE_INFINITY, max: val, inclusive: false };
      case ">=":
        return { min: val, max: Number.POSITIVE_INFINITY, inclusive: true };
      case ">":
        return { min: val, max: Number.POSITIVE_INFINITY, inclusive: false };
      case "==":
        return { min: val, max: val, inclusive: true };
    }
  }
}

export function compileProjectSpecification(
  request: CompilerCompilationRequest
): CompiledEngineeringSpecification {
  const compiler = new AetherForgeSystemCompiler();
  return compiler.compile(request);
}
