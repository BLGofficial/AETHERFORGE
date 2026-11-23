import { z } from "zod";
import { ActionTierSchema, SpecialistAgentIdSchema } from "../../SPECIFICATION_SCHEMAS/compiler-schemas.ts";

/**
 * AETHER FORGE — ENGINEERING TOOL SCHEMAS (v1.0.0)
 * Strict input and output contracts for all 11 engineering capabilities,
 * planning proposals, gateway seals, and 7-field error reports.
 */

export const EngineeringToolIdSchema = z.enum([
  "repo.inspect",
  "file.create_or_modify",
  "code.generate",
  "code.review",
  "git.execute",
  "build.execute",
  "test.execute",
  "dependency.manage",
  "docs.generate",
  "api.integrate",
  "deploy.prepare",
]);
export type EngineeringToolId = z.infer<typeof EngineeringToolIdSchema>;

export const RuntimeErrorCategorySchema = z.enum([
  "VALIDATION_ERROR",
  "PERMISSION_DENIED",
  "APPROVAL_REQUIRED",
  "SANDBOX_VIOLATION",
  "GATEWAY_BYPASS_ATTEMPT",
  "EXECUTION_FAILURE",
  "RECOVERY_ROLLBACK_TRIGGERED",
]);

export const RuntimeErrorReportSchema = z.object({
  errorCode: z.string().min(1),
  category: RuntimeErrorCategorySchema,
  message: z.string().min(1),
  traceId: z.string().min(8),
  retryable: z.boolean(),
  remediationHint: z.string().min(1),
  details: z.record(z.string(), z.string()).default({}),
});
export type RuntimeErrorReport = z.infer<typeof RuntimeErrorReportSchema>;

// 1. repo.inspect
export const RepoInspectInputSchema = z.object({
  relativeDirPath: z.string().min(1).default("."),
  maxEntries: z.number().int().min(1).max(500).default(100),
});
export const RepoInspectOutputSchema = z.object({
  canonicalDirPath: z.string().min(1),
  entries: z.array(
    z.object({
      name: z.string().min(1),
      kind: z.enum(["FILE", "DIRECTORY"]),
      bytes: z.number().int().nonnegative(),
      sha256: z.string().regex(/^[A-Fa-f0-9]{64}$/).nullable(),
    })
  ),
  treeDigestSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/),
});

// 2. file.create_or_modify
export const FileCreateOrModifyInputSchema = z.object({
  relativePath: z.string().min(1),
  content: z.string(),
  mode: z.enum(["CREATE_OR_OVERWRITE", "APPEND"]).default("CREATE_OR_OVERWRITE"),
  expectedPreWriteSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/).nullable().optional(),
});
export const FileCreateOrModifyOutputSchema = z.object({
  canonicalPath: z.string().min(1),
  preWriteSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/).nullable(),
  postWriteSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  bytesWritten: z.number().int().nonnegative(),
  artifactId: z.string().min(1),
});

// 3. code.generate
export const CodeGenerateInputSchema = z.object({
  targetRelativePath: z.string().min(1),
  language: z.enum(["TYPESCRIPT", "CPP20", "RUST", "PYTHON", "REGO"]),
  moduleName: z.string().min(1),
  interfaceContractId: z.string().min(1),
  sourceCode: z.string().min(1),
});
export const CodeGenerateOutputSchema = z.object({
  canonicalPath: z.string().min(1),
  language: z.enum(["TYPESCRIPT", "CPP20", "RUST", "PYTHON", "REGO"]),
  sourceSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  staticSafetyCheckPassed: z.boolean(),
  forbiddenTokensDetected: z.array(z.string()),
  artifactId: z.string().min(1),
});

// 4. code.review
export const CodeReviewInputSchema = z.object({
  targetRelativePath: z.string().min(1),
  enforceRealtimeAudioRules: z.boolean().default(false),
  enforceZeroAnyTypes: z.boolean().default(true),
});
export const CodeReviewOutputSchema = z.object({
  canonicalPath: z.string().min(1),
  inspectedSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  passed: z.boolean(),
  findings: z.array(
    z.object({
      ruleId: z.string().min(1),
      severity: z.enum(["ERROR", "WARNING"]),
      message: z.string().min(1),
    })
  ),
});

// 5. git.execute
export const GitExecuteInputSchema = z.object({
  subcommand: z.enum(["status", "diff", "log", "branch_current"]),
  maxLines: z.number().int().min(1).max(200).default(50),
});
export const GitExecuteOutputSchema = z.object({
  subcommand: z.enum(["status", "diff", "log", "branch_current"]),
  exitCode: z.number().int(),
  stdout: z.string(),
  outputSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/),
});

// 6. build.execute
export const BuildExecuteInputSchema = z.object({
  target: z.enum(["TYPECHECK", "SCHEMA_CODEGEN", "NATIVE_TOOLCHAIN_VERIFY"]),
  args: z.array(z.string()).default([]),
});
export const BuildExecuteOutputSchema = z.object({
  target: z.enum(["TYPECHECK", "SCHEMA_CODEGEN", "NATIVE_TOOLCHAIN_VERIFY"]),
  exitCode: z.number().int(),
  durationMs: z.number().nonnegative(),
  stdoutSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  succeeded: z.boolean(),
});

// 7. test.execute
export const TestExecuteInputSchema = z.object({
  suitePath: z.string().min(1),
  filterPattern: z.string().optional(),
});
export const TestExecuteOutputSchema = z.object({
  suitePath: z.string().min(1),
  exitCode: z.number().int(),
  passedTests: z.number().int().nonnegative(),
  failedTests: z.number().int().nonnegative(),
  reportSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/),
});

// 8. dependency.manage
export const DependencyManageInputSchema = z.object({
  operation: z.enum(["AUDIT_MANIFEST", "ADD_DEPENDENCY", "REMOVE_DEPENDENCY"]),
  packageName: z.string().min(1),
  versionSpec: z.string().min(1),
  spdxLicense: z.string().min(1),
});
export const DependencyManageOutputSchema = z.object({
  operation: z.enum(["AUDIT_MANIFEST", "ADD_DEPENDENCY", "REMOVE_DEPENDENCY"]),
  packageName: z.string().min(1),
  versionSpec: z.string().min(1),
  licenseApproved: z.boolean(),
  manifestSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/),
});

// 9. docs.generate
export const DocsGenerateInputSchema = z.object({
  targetRelativePath: z.string().min(1),
  title: z.string().min(1),
  sections: z.array(
    z.object({
      heading: z.string().min(1),
      body: z.string().min(1),
    })
  ).min(1),
  referencedArtifactPaths: z.array(z.string()).default([]),
});
export const DocsGenerateOutputSchema = z.object({
  canonicalPath: z.string().min(1),
  docSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  verifiedLinksCount: z.number().int().nonnegative(),
  artifactId: z.string().min(1),
});

// 10. api.integrate
export const ApiIntegrateInputSchema = z.object({
  endpointId: z.string().min(1),
  method: z.enum(["GET", "POST"]),
  routePath: z.string().startsWith("/api/v1/"),
  payload: z.record(z.string(), z.unknown()).default({}),
});
export const ApiIntegrateOutputSchema = z.object({
  endpointId: z.string().min(1),
  httpStatus: z.number().int(),
  responseSchemaValid: z.boolean(),
  responseSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/),
});

// 11. deploy.prepare
export const DeployPrepareInputSchema = z.object({
  releaseVersion: z.string().regex(/^\d+\.\d+\.\d+(-rc\d+)?$/),
  targetEnvironment: z.enum(["STAGING", "PRODUCTION"]),
  artifactPaths: z.array(z.string().min(1)).min(1),
});
export const DeployPrepareOutputSchema = z.object({
  releaseVersion: z.string().min(1),
  targetEnvironment: z.enum(["STAGING", "PRODUCTION"]),
  sbomSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  provenanceSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  manifestArtifactId: z.string().min(1),
});

// Declarative Planning Proposal (Planning Phase -> separated from Execution Phase)
export const PlannedToolInvocationProposalSchema = z.object({
  proposalId: z.string().min(1),
  traceId: z.string().min(8),
  tenantId: z.string().min(1),
  projectId: z.string().min(1),
  planId: z.string().min(1),
  stepId: z.string().min(1),
  agentId: SpecialistAgentIdSchema,
  toolId: EngineeringToolIdSchema,
  actionTier: ActionTierSchema,
  fenceToken: z.number().int().positive(),
  leasedWriteGlobs: z.array(z.string()),
  leasedReadGlobs: z.array(z.string()).min(1),
  targetRelativePath: z.string().default("."),
  rawInput: z.unknown(),
  approvalGrantId: z.string().nullable().default(null),
  rationale: z.string().min(1),
});
export type PlannedToolInvocationProposal = z.output<typeof PlannedToolInvocationProposalSchema>;
export type PlannedToolInvocationProposalInput = z.input<typeof PlannedToolInvocationProposalSchema>;
