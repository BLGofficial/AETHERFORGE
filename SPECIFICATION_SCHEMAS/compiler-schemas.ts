import { z } from "zod";

/**
 * AETHER FORGE — SYSTEM COMPILER SPECIFICATION SCHEMAS (v1.0.0)
 * Strict typed contracts for all 6 input categories, 12 compilation pipeline stages,
 * semantic validation diagnostics, and 4-way REQ -> COMP -> TASK -> TEST traceability.
 */

export const CompilerSchemaVersionSchema = z.literal("1.0.0");

export const CompilerInputTypeSchema = z.enum([
  "PRODUCT_DIRECTION",
  "NATURAL_LANGUAGE_REQUIREMENTS",
  "PROCESS_DESCRIPTION",
  "EXISTING_REPOSITORY",
  "TECHNICAL_DOCUMENT",
  "EXISTING_SYSTEM_ARCHITECTURE",
]);
export type CompilerInputType = z.infer<typeof CompilerInputTypeSchema>;

export const CoreDomainSchema = z.enum([
  "AI_OPERATING_SYSTEMS",
  "MULTI_AGENT_SYSTEMS",
  "AGENTIC_RUNTIME_ARCHITECTURE",
  "AUDIO_PROCESSING_DSP",
  "VST3_PLUGIN_ENGINEERING",
  "AI_DAW_AGENTIC_SYSTEMS",
  "CPP_NATIVE_ENGINEERING",
  "FULL_STACK_DEVELOPMENT",
  "INFRASTRUCTURE_APIS_INTEGRATIONS",
  "TESTING_VERIFICATION_DEPLOYMENT",
]);
export type CoreDomain = z.infer<typeof CoreDomainSchema>;

export const SpecialistAgentIdSchema = z.enum([
  "AGT-01", "AGT-02", "AGT-03", "AGT-04", "AGT-05",
  "AGT-06", "AGT-07", "AGT-08", "AGT-09", "AGT-10",
  "AGT-11", "AGT-12", "AGT-13", "AGT-14", "AGT-15",
  "AGT-16", "AGT-17", "AGT-18", "AGT-19",
]);
export type SpecialistAgentId = z.infer<typeof SpecialistAgentIdSchema>;

export const ActionTierSchema = z.enum(["0", "1", "2", "3"]);
export const AutonomyLevelSchema = z.enum(["L1", "L2", "L3", "L4"]);
export const ThresholdOperatorSchema = z.enum(["<=", ">=", "==", "<", ">"]);

export const ExplicitRequirementInputSchema = z.object({
  id: z.string().regex(/^REQ-(F|NF)-\d{4}$/).optional(),
  kind: z.enum(["FUNCTIONAL", "NON_FUNCTIONAL"]),
  statement: z.string().min(5),
  metricName: z.string().min(1).optional(),
  thresholdOperator: ThresholdOperatorSchema.optional(),
  thresholdValue: z.number().optional(),
  unit: z.string().min(1).optional(),
  actionTier: ActionTierSchema.default("1"),
  autonomyLevel: AutonomyLevelSchema.default("L3"),
  requestedCapabilities: z.array(z.string().min(1)).default([]),
  constraints: z.array(z.string().min(1)).default([]),
  dependsOnRequirementIds: z.array(z.string().regex(/^REQ-(F|NF)-\d{4}$/)).default([]),
  targetComponentId: z.string().regex(/^COMP-\d{4}$/).optional(),
  dependsOnComponentIds: z.array(z.string().regex(/^COMP-\d{4}$/)).default([]),
});
export type ExplicitRequirementInput = z.infer<typeof ExplicitRequirementInputSchema>;

export const CompilerInputArtifactSchema = z.object({
  inputId: z.string().min(1),
  inputType: CompilerInputTypeSchema,
  title: z.string().min(1),
  rawContent: z.string().min(1),
  sourceUri: z.string().min(1).default("workspace://inline"),
  structuredRequirements: z.array(ExplicitRequirementInputSchema).default([]),
  metadata: z.record(z.string(), z.string()).default({}),
});
export type CompilerInputArtifact = z.infer<typeof CompilerInputArtifactSchema>;

export const CompilerCompilationRequestSchema = z.object({
  projectId: z.string().min(1),
  tenantId: z.string().min(1),
  specificationVersion: z.string().regex(/^\d+\.\d+\.\d+$/).default("1.0.0"),
  failOnBlockingAmbiguity: z.boolean().default(true),
  inputs: z.array(CompilerInputArtifactSchema).min(1),
});
export type CompilerCompilationRequest = z.input<typeof CompilerCompilationRequestSchema>;
export type ParsedCompilerCompilationRequest = z.output<typeof CompilerCompilationRequestSchema>;

// Stage 1: Intent Extraction
export const IntentExtractionIrSchema = z.object({
  primaryGoal: z.string().min(1),
  projectCategory: z.string().min(1),
  targetPersonas: z.array(z.string().min(1)).min(1),
  businessOutcomes: z.array(z.string().min(1)).min(1),
  targetAutonomyCap: AutonomyLevelSchema,
  sourceInputIds: z.array(z.string().min(1)).min(1),
  inputTypesProcessed: z.array(CompilerInputTypeSchema).min(1),
});

// Stage 2: Requirement Extraction
export const ExtractedRequirementSchema = z.object({
  requirementId: z.string().regex(/^REQ-(F|NF)-\d{4}$/),
  kind: z.enum(["FUNCTIONAL", "NON_FUNCTIONAL"]),
  statement: z.string().min(5),
  metricName: z.string().min(1),
  thresholdOperator: ThresholdOperatorSchema,
  thresholdValue: z.number(),
  unit: z.string().min(1),
  actionTier: ActionTierSchema,
  autonomyLevel: AutonomyLevelSchema,
  requestedCapabilities: z.array(z.string().min(1)),
  constraints: z.array(z.string().min(1)),
  dependsOnRequirementIds: z.array(z.string().regex(/^REQ-(F|NF)-\d{4}$/)),
  sourceInputId: z.string().min(1),
});
export type ExtractedRequirement = z.infer<typeof ExtractedRequirementSchema>;

// Stage 3: Ambiguity Detection
export const AmbiguityFindingSchema = z.object({
  ambiguityId: z.string().regex(/^AMB-\d{4}$/),
  sourceInputId: z.string().min(1),
  relatedRequirementId: z.string().regex(/^REQ-(F|NF)-\d{4}$/).nullable(),
  severity: z.enum(["BLOCKING", "ADVISORY"]),
  ambiguousPhrase: z.string().min(1),
  reason: z.string().min(1),
  clarificationQuestion: z.string().min(1),
  resolutionOptions: z.array(z.string().min(1)).min(2),
});
export type AmbiguityFinding = z.infer<typeof AmbiguityFindingSchema>;

// Stage 4: Domain Classification
export const DomainClassificationIrSchema = z.object({
  primaryDomain: CoreDomainSchema,
  activeDomains: z.array(CoreDomainSchema).min(1),
  assignedSpecialistAgents: z.array(SpecialistAgentIdSchema).min(1),
  domainRationale: z.record(z.string(), z.string()),
});

// Stage 5: Capability Mapping
export const CapabilityDispositionSchema = z.enum([
  "NATIVE_IMPLEMENTED",
  "EXTERNAL_TOOL_MEDIATED",
  "HUMAN_APPROVAL_GATED",
  "UNSUPPORTED_OR_BLOCKED",
]);

export const CapabilityMappingEntrySchema = z.object({
  capabilityKey: z.string().min(1),
  requirementId: z.string().regex(/^REQ-(F|NF)-\d{4}$/),
  disposition: CapabilityDispositionSchema,
  providingModulePath: z.string().min(1),
  ownerAgentId: SpecialistAgentIdSchema,
  requiredApprovalRole: z.enum(["NONE", "Reviewer", "ReleaseManager", "DUAL_CONTROL"]),
  notes: z.string().min(1),
});
export type CapabilityMappingEntry = z.infer<typeof CapabilityMappingEntrySchema>;

// Stage 6: Technical Research Requests
export const TechnicalResearchRequestSchema = z.object({
  researchRequestId: z.string().regex(/^RES-\d{4}$/),
  assignedAgentId: z.literal("AGT-02"),
  domain: CoreDomainSchema,
  topic: z.string().min(1),
  verificationMethod: z.enum([
    "HOST_BINARY_SHA256_PROBE",
    "OFFLINE_SPEC_CITATION_LOOKUP",
    "SPDX_LICENSE_COMPATIBILITY_CHECK",
  ]),
  requiredForRequirementIds: z.array(z.string().regex(/^REQ-(F|NF)-\d{4}$/)).min(1),
  epistemicDefaultIfUnavailable: z.literal("unverified_assumptions"),
});

// Stage 7: Architecture Generation
export const GeneratedArchitectureIrSchema = z.object({
  architecturePattern: z.enum([
    "GOVERNED_HYBRID_CONTROL_AND_WORKER_PLANE",
    "REALTIME_AUDIO_ISOLATED_HYBRID",
    "MULTI_AGENT_REPOSITORY_AUTOMATION",
  ]),
  activeSubsystems: z.array(z.string().regex(/^ARCH-\d{2}$/)).min(1),
  trustBoundaries: z.array(z.enum(["TB-1", "TB-2", "TB-3", "TB-4"])).min(1),
  applicableAdrs: z.array(z.string().regex(/^ADR-\d{4}$/)).min(1),
  realtimeIsolationEnforced: z.boolean(),
  opaDefaultDenyEnforced: z.boolean(),
});

// Stage 8: Component Decomposition
export const ComponentSpecSchema = z.object({
  componentId: z.string().regex(/^COMP-\d{4}$/),
  name: z.string().min(1),
  domain: CoreDomainSchema,
  modulePath: z.string().min(1),
  ownerAgentId: SpecialistAgentIdSchema,
  exclusiveWriteGlobs: z.array(z.string().min(1)).min(1),
  readOnlyGlobs: z.array(z.string().min(1)).min(1),
  satisfiesRequirementIds: z.array(z.string().regex(/^REQ-(F|NF)-\d{4}$/)).min(1),
  dependsOnComponentIds: z.array(z.string().regex(/^COMP-\d{4}$/)),
  publicInterfaces: z.array(z.string().min(1)).min(1),
});
export type ComponentSpec = z.infer<typeof ComponentSpecSchema>;

// Stage 9: Dependency Graph Generation
export const DependencyEdgeSchema = z.object({
  fromId: z.string().min(1),
  toId: z.string().min(1),
  kind: z.enum(["REQUIREMENT_DEPENDENCY", "COMPONENT_DEPENDENCY", "TASK_DEPENDENCY"]),
});

export const DependencyGraphIrSchema = z.object({
  componentNodes: z.array(z.string().regex(/^COMP-\d{4}$/)),
  requirementNodes: z.array(z.string().regex(/^REQ-(F|NF)-\d{4}$/)),
  edges: z.array(DependencyEdgeSchema),
  topologicalComponentOrder: z.array(z.string().regex(/^COMP-\d{4}$/)),
  topologicalRequirementOrder: z.array(z.string().regex(/^REQ-(F|NF)-\d{4}$/)),
  hasCycles: z.boolean(),
  cycleDescriptions: z.array(z.string()),
  missingDependencies: z.array(z.string()),
});

// Stage 10: Workflow Generation
export const WorkflowTaskSpecSchema = z.object({
  taskId: z.string().regex(/^TASK-\d{4}$/),
  title: z.string().min(1),
  componentId: z.string().regex(/^COMP-\d{4}$/),
  requirementIds: z.array(z.string().regex(/^REQ-(F|NF)-\d{4}$/)).min(1),
  assignedAgentId: SpecialistAgentIdSchema,
  actionTier: ActionTierSchema,
  fenceTokenOrder: z.number().int().positive(),
  exclusiveWriteGlobs: z.array(z.string().min(1)),
  dependsOnTaskIds: z.array(z.string().regex(/^TASK-\d{4}$/)),
  requiresHumanApproval: z.boolean(),
  verificationCheck: z.string().min(1),
  rollbackHint: z.string().min(1),
});
export type WorkflowTaskSpec = z.infer<typeof WorkflowTaskSpecSchema>;

export const CompiledWorkflowIrSchema = z.object({
  workflowId: z.string().min(1),
  maxDelegationDepth: z.literal(2),
  disjointParallelWriteSetsVerified: z.boolean(),
  tasks: z.array(WorkflowTaskSpecSchema).min(1),
  terminalVerificationTaskId: z.string().regex(/^TASK-\d{4}$/),
});

// Stage 11: Test Specification Generation
export const TestSpecificationSchema = z.object({
  testId: z.string().regex(/^TEST-\d{4}$/),
  title: z.string().min(1),
  suiteCategory: z.enum(["CONTRACT", "SECURITY", "AUDIO_DSP", "REALTIME_WCET", "INTEGRATION_E2E"]),
  assignedAgentId: z.enum(["AGT-15", "AGT-16", "AGT-19"]),
  verifiesRequirementIds: z.array(z.string().regex(/^REQ-(F|NF)-\d{4}$/)).min(1),
  verifiesComponentIds: z.array(z.string().regex(/^COMP-\d{4}$/)).min(1),
  verifiesTaskIds: z.array(z.string().regex(/^TASK-\d{4}$/)).min(1),
  testFilePath: z.string().min(1),
  deterministicOracle: z.string().min(1),
});
export type TestSpecification = z.infer<typeof TestSpecificationSchema>;

// Stage 12: Acceptance Criteria Generation
export const AcceptanceCriterionSpecSchema = z.object({
  criterionId: z.string().regex(/^AC-\d{4}$/),
  requirementIds: z.array(z.string().regex(/^REQ-(F|NF)-\d{4}$/)).min(1),
  componentIds: z.array(z.string().regex(/^COMP-\d{4}$/)).min(1),
  taskIds: z.array(z.string().regex(/^TASK-\d{4}$/)).min(1),
  testIds: z.array(z.string().regex(/^TEST-\d{4}$/)).min(1),
  gateCondition: z.string().min(1),
  verifierAgentId: z.literal("AGT-19"),
});
export type AcceptanceCriterionSpec = z.infer<typeof AcceptanceCriterionSpecSchema>;

// 4-Way Traceability Mechanism (REQ -> COMP -> TASK -> TEST -> AC)
export const RequirementTraceabilityRowSchema = z.object({
  requirementId: z.string().regex(/^REQ-(F|NF)-\d{4}$/),
  componentIds: z.array(z.string().regex(/^COMP-\d{4}$/)).min(1),
  taskIds: z.array(z.string().regex(/^TASK-\d{4}$/)).min(1),
  testIds: z.array(z.string().regex(/^TEST-\d{4}$/)).min(1),
  acceptanceCriteriaIds: z.array(z.string().regex(/^AC-\d{4}$/)).min(1),
  forwardAndBackwardComplete: z.boolean(),
});
export type RequirementTraceabilityRow = z.infer<typeof RequirementTraceabilityRowSchema>;

export const TraceabilityMatrixIrSchema = z.object({
  rows: z.array(RequirementTraceabilityRowSchema),
  orphanRequirements: z.array(z.string()),
  orphanComponents: z.array(z.string()),
  orphanTasks: z.array(z.string()),
  orphanTests: z.array(z.string()),
  completenessRate: z.number().min(0).max(1),
});

// Semantic Validation Diagnostics
export const ContradictionDiagnosticSchema = z.object({
  contradictionId: z.string().regex(/^CON-\d{4}$/),
  requirementIdA: z.string().regex(/^REQ-(F|NF)-\d{4}$/),
  requirementIdB: z.string().regex(/^REQ-(F|NF)-\d{4}$/),
  ruleViolated: z.string().min(1),
  explanation: z.string().min(1),
});
export type ContradictionDiagnostic = z.infer<typeof ContradictionDiagnosticSchema>;

export const CompilerValidationStatusSchema = z.enum([
  "COMPILED_VALID",
  "REJECTED_CONTRADICTORY_REQUIREMENTS",
  "REJECTED_UNSUPPORTED_CAPABILITIES",
  "REJECTED_MISSING_DEPENDENCIES",
  "HALTED_BLOCKING_AMBIGUITY",
]);

export const CompilerValidationReportSchema = z.object({
  isValid: z.boolean(),
  status: CompilerValidationStatusSchema,
  missingDependencies: z.array(z.string()),
  contradictoryRequirements: z.array(ContradictionDiagnosticSchema),
  unsupportedCapabilities: z.array(CapabilityMappingEntrySchema),
  blockingAmbiguities: z.array(AmbiguityFindingSchema),
  traceabilityCompletenessRate: z.number().min(0).max(1),
});

// Final Compiled Engineering Specification Bundle
export const CompiledEngineeringSpecificationSchema = z.object({
  schemaVersion: CompilerSchemaVersionSchema,
  specificationId: z.string().min(1),
  projectId: z.string().min(1),
  tenantId: z.string().min(1),
  specificationVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  compiledAt: z.string().datetime(),
  specificationSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  validation: CompilerValidationReportSchema,
  pipelineStages: z.object({
    stage01Intent: IntentExtractionIrSchema,
    stage02Requirements: z.array(ExtractedRequirementSchema),
    stage03Ambiguities: z.array(AmbiguityFindingSchema),
    stage04Domains: DomainClassificationIrSchema,
    stage05Capabilities: z.array(CapabilityMappingEntrySchema),
    stage06ResearchRequests: z.array(TechnicalResearchRequestSchema),
    stage07Architecture: GeneratedArchitectureIrSchema,
    stage08Components: z.array(ComponentSpecSchema),
    stage09DependencyGraph: DependencyGraphIrSchema,
    stage10Workflow: CompiledWorkflowIrSchema,
    stage11TestSpecifications: z.array(TestSpecificationSchema),
    stage12AcceptanceCriteria: z.array(AcceptanceCriterionSpecSchema),
  }),
  traceabilityMatrix: TraceabilityMatrixIrSchema,
});
export type CompiledEngineeringSpecification = z.infer<typeof CompiledEngineeringSpecificationSchema>;
