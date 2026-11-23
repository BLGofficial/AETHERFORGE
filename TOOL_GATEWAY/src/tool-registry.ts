import { z } from "zod";
import { type SpecialistAgentId } from "../../SPECIFICATION_SCHEMAS/compiler-schemas.ts";
import {
  ApiIntegrateInputSchema,
  ApiIntegrateOutputSchema,
  BuildExecuteInputSchema,
  BuildExecuteOutputSchema,
  CodeGenerateInputSchema,
  CodeGenerateOutputSchema,
  CodeReviewInputSchema,
  CodeReviewOutputSchema,
  DependencyManageInputSchema,
  DependencyManageOutputSchema,
  DeployPrepareInputSchema,
  DeployPrepareOutputSchema,
  DocsGenerateInputSchema,
  DocsGenerateOutputSchema,
  type EngineeringToolId,
  FileCreateOrModifyInputSchema,
  FileCreateOrModifyOutputSchema,
  GitExecuteInputSchema,
  GitExecuteOutputSchema,
  RepoInspectInputSchema,
  RepoInspectOutputSchema,
  TestExecuteInputSchema,
  TestExecuteOutputSchema,
} from "./tool-schemas.ts";

export interface ToolDescriptor {
  toolId: EngineeringToolId;
  description: string;
  minimumActionTier: "0" | "1" | "2" | "3";
  requiresWriteLease: boolean;
  requiresHumanApproval: boolean;
  allowedAgents: SpecialistAgentId[];
  inputSchema: z.ZodTypeAny;
  outputSchema: z.ZodTypeAny;
}

export class EngineeringToolRegistry {
  private readonly tools = new Map<EngineeringToolId, ToolDescriptor>();

  public constructor() {
    this.registerDefaults();
  }

  public getTool(toolId: EngineeringToolId): ToolDescriptor {
    const desc = this.tools.get(toolId);
    if (!desc) {
      throw new Error(`UNREGISTERED_TOOL: ${toolId}`);
    }
    return desc;
  }

  public listTools(): ToolDescriptor[] {
    return Array.from(this.tools.values());
  }

  private registerDefaults(): void {
    const allAgents: SpecialistAgentId[] = [
      "AGT-01", "AGT-02", "AGT-03", "AGT-04", "AGT-05",
      "AGT-06", "AGT-07", "AGT-08", "AGT-09", "AGT-10",
      "AGT-11", "AGT-12", "AGT-13", "AGT-14", "AGT-15",
      "AGT-16", "AGT-17", "AGT-18", "AGT-19",
    ];
    const authoringAgents: SpecialistAgentId[] = allAgents.filter((a) => a !== "AGT-19");

    const descriptors: ToolDescriptor[] = [
      {
        toolId: "repo.inspect",
        description: "Read-only repository directory and SHA-256 file tree inspection.",
        minimumActionTier: "0",
        requiresWriteLease: false,
        requiresHumanApproval: false,
        allowedAgents: allAgents,
        inputSchema: RepoInspectInputSchema,
        outputSchema: RepoInspectOutputSchema,
      },
      {
        toolId: "file.create_or_modify",
        description: "Scoped file creation or modification inside leased write globs with pre-write hash checkpointing.",
        minimumActionTier: "1",
        requiresWriteLease: true,
        requiresHumanApproval: false,
        allowedAgents: authoringAgents,
        inputSchema: FileCreateOrModifyInputSchema,
        outputSchema: FileCreateOrModifyOutputSchema,
      },
      {
        toolId: "code.generate",
        description: "Generate static-safety-verified source code (TypeScript, C++20, Rust, Python, Rego) within leased paths.",
        minimumActionTier: "1",
        requiresWriteLease: true,
        requiresHumanApproval: false,
        allowedAgents: ["AGT-04", "AGT-05", "AGT-06", "AGT-07", "AGT-08", "AGT-09", "AGT-10", "AGT-11", "AGT-12", "AGT-13", "AGT-14", "AGT-15", "AGT-17"],
        inputSchema: CodeGenerateInputSchema,
        outputSchema: CodeGenerateOutputSchema,
      },
      {
        toolId: "code.review",
        description: "Static AST/token code review enforcing real-time C++20 rules and zero-any TypeScript invariants.",
        minimumActionTier: "0",
        requiresWriteLease: false,
        requiresHumanApproval: false,
        allowedAgents: ["AGT-01", "AGT-04", "AGT-08", "AGT-09", "AGT-14", "AGT-15", "AGT-16", "AGT-19"],
        inputSchema: CodeReviewInputSchema,
        outputSchema: CodeReviewOutputSchema,
      },
      {
        toolId: "git.execute",
        description: "Controlled Git inspection operations (status, diff, log, branch_current).",
        minimumActionTier: "0",
        requiresWriteLease: false,
        requiresHumanApproval: false,
        allowedAgents: allAgents,
        inputSchema: GitExecuteInputSchema,
        outputSchema: GitExecuteOutputSchema,
      },
      {
        toolId: "build.execute",
        description: "Sandboxed build and schema codegen verification.",
        minimumActionTier: "1",
        requiresWriteLease: false,
        requiresHumanApproval: false,
        allowedAgents: ["AGT-04", "AGT-08", "AGT-09", "AGT-11", "AGT-12", "AGT-13", "AGT-17", "AGT-19"],
        inputSchema: BuildExecuteInputSchema,
        outputSchema: BuildExecuteOutputSchema,
      },
      {
        toolId: "test.execute",
        description: "Deterministic test suite execution and oracle verification.",
        minimumActionTier: "0",
        requiresWriteLease: false,
        requiresHumanApproval: false,
        allowedAgents: ["AGT-05", "AGT-06", "AGT-07", "AGT-08", "AGT-09", "AGT-10", "AGT-11", "AGT-12", "AGT-14", "AGT-15", "AGT-16", "AGT-17", "AGT-19"],
        inputSchema: TestExecuteInputSchema,
        outputSchema: TestExecuteOutputSchema,
      },
      {
        toolId: "dependency.manage",
        description: "Dependency manifest audit and human-approval-gated package additions/removals.",
        minimumActionTier: "2",
        requiresWriteLease: true,
        requiresHumanApproval: true,
        allowedAgents: ["AGT-04", "AGT-11", "AGT-13", "AGT-17"],
        inputSchema: DependencyManageInputSchema,
        outputSchema: DependencyManageOutputSchema,
      },
      {
        toolId: "docs.generate",
        description: "Traceable Markdown documentation and Reference Book generation with link verification.",
        minimumActionTier: "1",
        requiresWriteLease: true,
        requiresHumanApproval: false,
        allowedAgents: ["AGT-01", "AGT-02", "AGT-03", "AGT-04", "AGT-18"],
        inputSchema: DocsGenerateInputSchema,
        outputSchema: DocsGenerateOutputSchema,
      },
      {
        toolId: "api.integrate",
        description: "Schema-validated internal Control Plane OpenAPI 3.1 endpoint integration.",
        minimumActionTier: "1",
        requiresWriteLease: false,
        requiresHumanApproval: false,
        allowedAgents: ["AGT-05", "AGT-06", "AGT-11", "AGT-12", "AGT-15", "AGT-17"],
        inputSchema: ApiIntegrateInputSchema,
        outputSchema: ApiIntegrateOutputSchema,
      },
      {
        toolId: "deploy.prepare",
        description: "Human-approval-gated CycloneDX 1.5 SBOM and SLSA v1.0 provenance deployment bundle preparation.",
        minimumActionTier: "2",
        requiresWriteLease: true,
        requiresHumanApproval: true,
        allowedAgents: ["AGT-13"],
        inputSchema: DeployPrepareInputSchema,
        outputSchema: DeployPrepareOutputSchema,
      },
    ];

    for (const d of descriptors) {
      this.tools.set(d.toolId, d);
    }
  }
}
