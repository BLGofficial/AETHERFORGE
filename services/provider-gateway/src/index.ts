import { createHash } from "node:crypto";
import { z } from "zod";
import {
  ActionClassSchema,
  computeCanonicalPlanHash,
  EVENT_NAMES,
  type ExecutionPlan,
  ExecutionPlanSchema,
  type ModelRequest,
  ModelRequestSchema,
  type ModelResponse,
  ModelResponseSchema,
  type PlanningInput,
  PlanningInputSchema,
  type PlanStep,
  type PromptTemplateRef,
  type ProviderId,
  type RequestContext,
  type Result,
  SCHEMA_VERSION_V1,
  StructuredParamsSchema,
  type ToolManifest,
} from "@aether-forge/contracts";
import { AppendOnlyAuditStore, computePayloadSha256 } from "@aether-forge/audit";
import { OpaPolicyDecisionPoint } from "@aether-forge/policy";

export interface RegisteredPromptTemplate {
  readonly templateId: string;
  readonly templateVersion: string;
  readonly systemInstructionTemplate: string;
  readonly templateSha256: string;
}

export class PromptTemplateRegistry {
  private readonly templates = new Map<string, RegisteredPromptTemplate>();

  private static key(templateId: string, version: string): string {
    return `${templateId}@${version}`;
  }

  public registerTemplate(params: {
    readonly templateId: string;
    readonly templateVersion: string;
    readonly systemInstructionTemplate: string;
  }): RegisteredPromptTemplate {
    const templateSha256 = createHash("sha256")
      .update(params.systemInstructionTemplate, "utf8")
      .digest("hex");
    const entry: RegisteredPromptTemplate = {
      templateId: params.templateId,
      templateVersion: params.templateVersion,
      systemInstructionTemplate: params.systemInstructionTemplate,
      templateSha256,
    };
    this.templates.set(
      PromptTemplateRegistry.key(entry.templateId, entry.templateVersion),
      entry,
    );
    return entry;
  }

  public verifyTemplateRef(ref: PromptTemplateRef): boolean {
    const registered = this.templates.get(
      PromptTemplateRegistry.key(ref.templateId, ref.templateVersion),
    );
    return Boolean(registered && registered.templateSha256 === ref.templateSha256);
  }
}

export interface RedactionCheckOutcome {
  readonly allowed: boolean;
  readonly denyCode?: string;
  readonly denyMessage?: string;
  readonly sanitizedSystemInstruction: string;
  readonly sanitizedUserPrompt: string;
  readonly redactedPatternCount: number;
}

const RAW_SECRET_REGEX =
  /(sk-[A-Za-z0-9_-]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|AIza[0-9A-Za-z_-]{20,}|Bearer\s+[A-Za-z0-9._-]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})/;
const WINDOWS_USER_PATH_REGEX = /[A-Za-z]:\\Users\\[^\\\s"']+/g;
const UNIX_USER_PATH_REGEX = /\/Users\/[^/\s"']+/g;

/**
 * Pre-Egress Data Classification & Redaction Fence (ADR-0006, Data Classification §2).
 * Blocks SECRET_CREDENTIAL, blocks unapproved RESTRICTED_LOCAL, blocks raw secret tokens,
 * and normalizes local workstation user paths before egress.
 */
export function inspectAndRedactForEgress(
  request: ModelRequest,
  allowRestrictedLocalSummarizedEgress = false,
): RedactionCheckOutcome {
  if (request.context.classification === "SECRET_CREDENTIAL") {
    return {
      allowed: false,
      denyCode: "DOMAIN_EGRESS_SECRET_CLASSIFICATION_DENIED",
      denyMessage: "Model egress denied: SECRET_CREDENTIAL classification can never leave the control plane.",
      sanitizedSystemInstruction: "",
      sanitizedUserPrompt: "",
      redactedPatternCount: 0,
    };
  }

  if (
    request.context.classification === "RESTRICTED_LOCAL" &&
    !allowRestrictedLocalSummarizedEgress
  ) {
    return {
      allowed: false,
      denyCode: "DOMAIN_EGRESS_RESTRICTED_LOCAL_DENIED",
      denyMessage:
        "Model egress denied: RESTRICTED_LOCAL data requires explicit external_upload approval before transfer.",
      sanitizedSystemInstruction: "",
      sanitizedUserPrompt: "",
      redactedPatternCount: 0,
    };
  }

  if (
    RAW_SECRET_REGEX.test(request.systemInstruction) ||
    RAW_SECRET_REGEX.test(request.userPrompt)
  ) {
    return {
      allowed: false,
      denyCode: "DOMAIN_EGRESS_RAW_SECRET_DETECTED",
      denyMessage:
        "Model egress denied: potential raw credential or private key material detected in prompt payload.",
      sanitizedSystemInstruction: "",
      sanitizedUserPrompt: "",
      redactedPatternCount: 0,
    };
  }

  let redactedCount = 0;
  const redactPaths = (text: string): string =>
    text
      .replace(WINDOWS_USER_PATH_REGEX, () => {
        redactedCount += 1;
        return "<REDACTED_WORKSPACE_ROOT>";
      })
      .replace(UNIX_USER_PATH_REGEX, () => {
        redactedCount += 1;
        return "<REDACTED_WORKSPACE_ROOT>";
      });

  return {
    allowed: true,
    sanitizedSystemInstruction: redactPaths(request.systemInstruction),
    sanitizedUserPrompt: redactPaths(request.userPrompt),
    redactedPatternCount: redactedCount,
  };
}

export interface ProviderAdapter {
  readonly providerId: ProviderId;
  readonly modelName: string;
  complete(params: {
    readonly systemInstruction: string;
    readonly userPrompt: string;
    readonly maxOutputTokens: number;
  }): {
    readonly structuredJsonOutput: string;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly estimatedCostUsdMicros: number;
  };
}

/**
 * Deterministic Fake Provider Adapter for CI, evaluation fixtures, and offline verification.
 */
export class DeterministicFakeProviderAdapter implements ProviderAdapter {
  public readonly providerId: ProviderId = "fake-deterministic";
  public readonly modelName = "aetherforge-fake-planner-v1";
  private scriptedResponseJson: string | undefined;
  private scriptedOutputTokens = 180;
  private scriptedCostUsdMicros = 450;

  public setScriptedOutput(
    jsonOutput: string | undefined,
    options?: { readonly outputTokens?: number; readonly costUsdMicros?: number },
  ): void {
    this.scriptedResponseJson = jsonOutput;
    this.scriptedOutputTokens = options?.outputTokens ?? 180;
    this.scriptedCostUsdMicros = options?.costUsdMicros ?? 450;
  }

  public complete(params: {
    readonly systemInstruction: string;
    readonly userPrompt: string;
    readonly maxOutputTokens: number;
  }): {
    readonly structuredJsonOutput: string;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly estimatedCostUsdMicros: number;
  } {
    const inputTokens = Math.max(
      10,
      Math.ceil((params.systemInstruction.length + params.userPrompt.length) / 4),
    );
    const defaultDraft = JSON.stringify({
      steps: [
        {
          stepId: "step-01-inspect",
          orderIndex: 0,
          toolId: "tool.workspace.inspect_manifest",
          actionClass: "read_allowlisted",
          description: "Inspect allowlisted project workspace manifest",
          input: { targetRelativePath: "manifest.json" },
          expectedOutputs: ["manifestHash"],
          requiresApproval: false,
          dependsOnStepIds: [],
        },
        {
          stepId: "step-02-write",
          orderIndex: 1,
          toolId: "tool.workspace.atomic_write",
          actionClass: "write_workspace",
          description: "Write governed build report to workspace",
          input: { targetRelativePath: "outputs/build-report.json" },
          expectedOutputs: ["reportFileHash"],
          requiresApproval: true,
          dependsOnStepIds: ["step-01-inspect"],
        },
      ],
    });

    return {
      structuredJsonOutput: this.scriptedResponseJson ?? defaultDraft,
      inputTokens,
      outputTokens: this.scriptedOutputTokens,
      estimatedCostUsdMicros: this.scriptedCostUsdMicros,
    };
  }
}

export interface TenantBudgetQuota {
  readonly maxTotalTokens: number;
  readonly maxTotalCostUsdMicros: number;
}

export class TenantBudgetTracker {
  private readonly quotas = new Map<string, TenantBudgetQuota>();
  private readonly usedTokens = new Map<string, number>();
  private readonly usedCostMicros = new Map<string, number>();

  public setTenantQuota(tenantId: string, quota: TenantBudgetQuota): void {
    this.quotas.set(tenantId, quota);
  }

  public getTenantQuota(tenantId: string): TenantBudgetQuota {
    return (
      this.quotas.get(tenantId) ?? {
        maxTotalTokens: 100_000,
        maxTotalCostUsdMicros: 10_000_000,
      }
    );
  }

  public checkAndReserve(params: {
    readonly tenantId: string;
    readonly requestedTokens: number;
    readonly requestedCostMicros: number;
  }): boolean {
    const quota = this.getTenantQuota(params.tenantId);
    const nextTokens = (this.usedTokens.get(params.tenantId) ?? 0) + params.requestedTokens;
    const nextCost = (this.usedCostMicros.get(params.tenantId) ?? 0) + params.requestedCostMicros;

    if (nextTokens > quota.maxTotalTokens || nextCost > quota.maxTotalCostUsdMicros) {
      return false;
    }
    this.usedTokens.set(params.tenantId, nextTokens);
    this.usedCostMicros.set(params.tenantId, nextCost);
    return true;
  }
}

/**
 * Provider Gateway (ADR-0006).
 * Enforces prompt registry verification, pre-egress redaction & classification checks,
 * tenant token/cost budgets, provider routing, and audit metadata logging.
 */
export class ProviderGatewayService {
  public readonly templateRegistry: PromptTemplateRegistry;
  public readonly budgetTracker: TenantBudgetTracker;
  public readonly auditStore: AppendOnlyAuditStore;
  public readonly fakeProvider: DeterministicFakeProviderAdapter;
  private readonly adapters = new Map<ProviderId, ProviderAdapter>();
  private defaultProviderId: ProviderId = "fake-deterministic";
  private sequence = 0;

  public constructor(deps?: {
    readonly templateRegistry?: PromptTemplateRegistry;
    readonly budgetTracker?: TenantBudgetTracker;
    readonly auditStore?: AppendOnlyAuditStore;
    readonly fakeProvider?: DeterministicFakeProviderAdapter;
  }) {
    this.templateRegistry = deps?.templateRegistry ?? new PromptTemplateRegistry();
    this.budgetTracker = deps?.budgetTracker ?? new TenantBudgetTracker();
    this.auditStore = deps?.auditStore ?? new AppendOnlyAuditStore();
    this.fakeProvider = deps?.fakeProvider ?? new DeterministicFakeProviderAdapter();
    this.adapters.set("fake-deterministic", this.fakeProvider);
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${String(this.sequence).padStart(4, "0")}`;
  }

  public setDefaultProvider(providerId: ProviderId): void {
    this.defaultProviderId = providerId;
  }

  public complete(rawRequest: ModelRequest): Result<ModelResponse> {
    const parsed = ModelRequestSchema.safeParse(rawRequest);
    if (!parsed.success) {
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_MODEL_REQUEST_INVALID",
          message: parsed.error.issues.map((i) => i.message).join("; "),
          category: "VALIDATION",
          traceId: rawRequest?.context?.traceId ?? "invalid-trace",
        },
      };
    }

    const request = parsed.data;
    const { context } = request;

    // 1. Verify prompt template version & SHA-256 hash against registry
    if (!this.templateRegistry.verifyTemplateRef(request.promptTemplate)) {
      this.auditStore.append({
        eventId: this.nextId("audit-pg"),
        tenantId: context.tenantId,
        projectId: context.projectId,
        actor: context.actor,
        traceId: context.traceId,
        idempotencyKey: context.idempotencyKey,
        eventType: "aetherforge.provider.denied.v1",
        policyVersion: "provider-gateway-v1",
        outcome: "DENIED",
        payload: { reason: "UNREGISTERED_PROMPT_TEMPLATE", template: request.promptTemplate },
      });
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_PROMPT_TEMPLATE_UNREGISTERED",
          message: "Model request references an unregistered or hash-mismatched prompt template.",
          category: "POLICY_DENIED",
          traceId: context.traceId,
        },
      };
    }

    // 2. Pre-egress classification & secret/path redaction check
    const egressCheck = inspectAndRedactForEgress(request);
    if (!egressCheck.allowed) {
      this.auditStore.append({
        eventId: this.nextId("audit-pg"),
        tenantId: context.tenantId,
        projectId: context.projectId,
        actor: context.actor,
        traceId: context.traceId,
        idempotencyKey: context.idempotencyKey,
        eventType: "aetherforge.provider.denied.v1",
        policyVersion: "provider-gateway-v1",
        outcome: "DENIED",
        payload: { reason: egressCheck.denyCode },
      });
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: egressCheck.denyCode ?? "DOMAIN_EGRESS_POLICY_DENIED",
          message: egressCheck.denyMessage ?? "Blocked by Provider Gateway egress fence.",
          category: "POLICY_DENIED",
          traceId: context.traceId,
        },
      };
    }

    // 3. Route to approved provider adapter
    const targetProviderId = request.preferredProvider ?? this.defaultProviderId;
    const adapter = this.adapters.get(targetProviderId);
    if (!adapter) {
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_PROVIDER_NOT_CONFIGURED",
          message: `Provider '${targetProviderId}' is not configured with server-side credentials in this environment.`,
          category: "POLICY_DENIED",
          traceId: context.traceId,
        },
      };
    }

    // 4. Execute completion and enforce request + tenant token/cost budgets
    const rawCompletion = adapter.complete({
      systemInstruction: egressCheck.sanitizedSystemInstruction,
      userPrompt: egressCheck.sanitizedUserPrompt,
      maxOutputTokens: request.maxOutputTokens,
    });

    const totalTokens = rawCompletion.inputTokens + rawCompletion.outputTokens;
    const withinRequestBudget =
      rawCompletion.outputTokens <= request.maxOutputTokens &&
      rawCompletion.estimatedCostUsdMicros <= request.maxCostUsdMicros;
    const withinTenantBudget =
      withinRequestBudget &&
      this.budgetTracker.checkAndReserve({
        tenantId: context.tenantId,
        requestedTokens: totalTokens,
        requestedCostMicros: rawCompletion.estimatedCostUsdMicros,
      });

    if (!withinRequestBudget || !withinTenantBudget) {
      this.auditStore.append({
        eventId: this.nextId("audit-pg"),
        tenantId: context.tenantId,
        projectId: context.projectId,
        actor: context.actor,
        traceId: context.traceId,
        idempotencyKey: context.idempotencyKey,
        eventType: "aetherforge.provider.denied.v1",
        policyVersion: "provider-gateway-v1",
        outcome: "DENIED",
        payload: {
          reason: "DOMAIN_PROVIDER_BUDGET_EXCEEDED",
          outputTokens: rawCompletion.outputTokens,
          estimatedCostUsdMicros: rawCompletion.estimatedCostUsdMicros,
        },
      });
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_PROVIDER_BUDGET_EXCEEDED",
          message: "Model request exceeded request or tenant token/cost budget.",
          category: "QUOTA_EXCEEDED",
          traceId: context.traceId,
        },
      };
    }

    const response: ModelResponse = ModelResponseSchema.parse({
      schemaVersion: SCHEMA_VERSION_V1,
      requestId: context.requestId,
      traceId: context.traceId,
      structuredJsonOutput: rawCompletion.structuredJsonOutput,
      usageMetadata: {
        providerId: adapter.providerId,
        modelName: adapter.modelName,
        promptTemplateId: request.promptTemplate.templateId,
        promptTemplateVersion: request.promptTemplate.templateVersion,
        inputTokens: rawCompletion.inputTokens,
        outputTokens: rawCompletion.outputTokens,
        estimatedCostUsdMicros: rawCompletion.estimatedCostUsdMicros,
        redactedPatternCount: egressCheck.redactedPatternCount,
        latencyMs: 1,
      },
    });

    this.auditStore.append({
      eventId: this.nextId("audit-pg"),
      tenantId: context.tenantId,
      projectId: context.projectId,
      actor: context.actor,
      traceId: context.traceId,
      idempotencyKey: context.idempotencyKey,
      eventType: "aetherforge.provider.completed.v1",
      policyVersion: "provider-gateway-v1",
      outcome: "EXECUTED",
      payload: response.usageMetadata,
    });

    return {
      ok: true,
      value: response,
      evidence: [
        {
          schemaVersion: SCHEMA_VERSION_V1,
          evidenceId: this.nextId("ev-model"),
          traceId: context.traceId,
          producer: "api",
          artifactHash: computePayloadSha256(response),
          classification: context.classification,
          createdAt: new Date().toISOString(),
          verifiableLocation: `aetherforge://tenants/${context.tenantId}/model-calls/${context.requestId}`,
        },
      ],
    };
  }
}

export class ToolManifestRegistry {
  private readonly tools = new Map<string, ToolManifest>();

  public registerTool(manifest: ToolManifest): void {
    this.tools.set(manifest.toolId, manifest);
  }

  public getTool(toolId: string): ToolManifest | undefined {
    return this.tools.get(toolId);
  }

  public listTools(): readonly ToolManifest[] {
    return [...this.tools.values()];
  }
}

export function createDefaultToolManifestRegistry(): ToolManifestRegistry {
  const registry = new ToolManifestRegistry();
  const defaultTools: ToolManifest[] = [
    {
      schemaVersion: SCHEMA_VERSION_V1,
      toolId: "tool.workspace.inspect_manifest",
      version: "1.0.0",
      actionClass: "read_allowlisted",
      description: "Read-only inspection of allowlisted project workspace manifest",
      inputSchemaRef: "https://schemas.aetherforge.internal/v1/tools/inspect-manifest.json",
      outputSchemaRef: "https://schemas.aetherforge.internal/v1/tools/inspect-manifest-out.json",
      maxDurationMs: 10_000,
      requiresLocalWorker: true,
    },
    {
      schemaVersion: SCHEMA_VERSION_V1,
      toolId: "tool.workspace.atomic_write",
      version: "1.0.0",
      actionClass: "write_workspace",
      description: "Atomic file write strictly inside granted canonical workspace directory",
      inputSchemaRef: "https://schemas.aetherforge.internal/v1/tools/atomic-write.json",
      outputSchemaRef: "https://schemas.aetherforge.internal/v1/tools/atomic-write-out.json",
      maxDurationMs: 30_000,
      requiresLocalWorker: true,
    },
    {
      schemaVersion: SCHEMA_VERSION_V1,
      toolId: "tool.command.run_tests",
      version: "1.0.0",
      actionClass: "command_bounded",
      description: "Execute bounded project test suite inside workspace",
      inputSchemaRef: "https://schemas.aetherforge.internal/v1/tools/run-tests.json",
      outputSchemaRef: "https://schemas.aetherforge.internal/v1/tools/run-tests-out.json",
      maxDurationMs: 120_000,
      requiresLocalWorker: true,
    },
    {
      schemaVersion: SCHEMA_VERSION_V1,
      toolId: "tool.audio.gain_normalize",
      version: "1.0.0",
      actionClass: "audio_dsp",
      description: "Offline Rust audio engine deterministic WAV gain normalization",
      inputSchemaRef: "https://schemas.aetherforge.internal/v1/tools/audio-gain.json",
      outputSchemaRef: "https://schemas.aetherforge.internal/v1/tools/audio-gain-out.json",
      maxDurationMs: 60_000,
      requiresLocalWorker: true,
    },
  ];
  for (const tool of defaultTools) {
    registry.registerTool(tool);
  }
  return registry;
}

const ProposedDraftStepSchema = z.object({
  stepId: z.string().min(1).max(128),
  orderIndex: z.number().int().nonnegative(),
  toolId: z.string().min(1).max(128),
  actionClass: ActionClassSchema,
  description: z.string().min(3).max(1000),
  input: StructuredParamsSchema,
  expectedOutputs: z.array(z.string().min(1).max(512)).min(1),
  requiresApproval: z.boolean().optional(),
  dependsOnStepIds: z.array(z.string().min(1).max(128)).default([]),
});

const ProposedPlanDraftSchema = z.object({
  steps: z.array(ProposedDraftStepSchema).min(1),
});

export const PLANNER_PROMPT_TEMPLATE_ID = "planner.execution-plan.v1" as const;
export const PLANNER_PROMPT_TEMPLATE_VERSION = "1.0.0" as const;
export const PLANNER_SYSTEM_INSTRUCTION =
  "You are the AETHER FORGE Bounded Execution Planner. Emit only valid JSON matching ProposedPlanDraftSchema using registered ToolManifest IDs. Never emit direct shell or unqualified DAW commands." as const;

/**
 * Bounded Execution Planner (ADR-0005).
 * Produces ExecutionPlan strictly over registered ToolManifest entries and OPA policy checks.
 * Unsafe, unregistered, policy-denied, or malformed model outputs fail closed.
 */
export class BoundedExecutionPlanner {
  public readonly providerGateway: ProviderGatewayService;
  public readonly toolRegistry: ToolManifestRegistry;
  public readonly policyDecisionPoint: OpaPolicyDecisionPoint;
  public readonly plannerPromptRef: PromptTemplateRef;
  private sequence = 0;

  public constructor(deps?: {
    readonly providerGateway?: ProviderGatewayService;
    readonly toolRegistry?: ToolManifestRegistry;
    readonly policyDecisionPoint?: OpaPolicyDecisionPoint;
  }) {
    this.providerGateway = deps?.providerGateway ?? new ProviderGatewayService();
    this.toolRegistry = deps?.toolRegistry ?? createDefaultToolManifestRegistry();
    this.policyDecisionPoint = deps?.policyDecisionPoint ?? new OpaPolicyDecisionPoint();

    const registered = this.providerGateway.templateRegistry.registerTemplate({
      templateId: PLANNER_PROMPT_TEMPLATE_ID,
      templateVersion: PLANNER_PROMPT_TEMPLATE_VERSION,
      systemInstructionTemplate: PLANNER_SYSTEM_INSTRUCTION,
    });
    this.plannerPromptRef = {
      schemaVersion: SCHEMA_VERSION_V1,
      templateId: registered.templateId,
      templateVersion: registered.templateVersion,
      templateSha256: registered.templateSha256,
    };
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${String(this.sequence).padStart(4, "0")}`;
  }

  public proposePlan(params: {
    readonly context: RequestContext;
    readonly planningInput: PlanningInput;
    readonly maxCostUsdMicros?: number;
  }): Result<ExecutionPlan> {
    const parsedInput = PlanningInputSchema.safeParse(params.planningInput);
    if (!parsedInput.success) {
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_PLANNING_INPUT_INVALID",
          message: parsedInput.error.issues.map((i) => i.message).join("; "),
          category: "VALIDATION",
          traceId: params.context.traceId,
        },
      };
    }

    const input = parsedInput.data;
    const modelRes = this.providerGateway.complete({
      schemaVersion: SCHEMA_VERSION_V1,
      context: params.context,
      promptTemplate: this.plannerPromptRef,
      systemInstruction: PLANNER_SYSTEM_INSTRUCTION,
      userPrompt: JSON.stringify({
        specId: input.specId,
        objective: input.objective ?? "Generate governed execution plan",
        availableToolIds: input.availableTools.map((t) => t.toolId),
        citations: input.citations,
      }),
      maxOutputTokens: input.tokenBudget,
      maxCostUsdMicros: params.maxCostUsdMicros ?? 500_000,
    });

    if (!modelRes.ok) {
      return modelRes;
    }

    let rawJson: unknown;
    try {
      rawJson = JSON.parse(modelRes.value.structuredJsonOutput);
    } catch {
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_PLANNER_MALFORMED_OUTPUT",
          message: "Model output was not valid JSON.",
          category: "VALIDATION",
          traceId: params.context.traceId,
        },
      };
    }

    const parsedDraft = ProposedPlanDraftSchema.safeParse(rawJson);
    if (!parsedDraft.success) {
      return {
        ok: false,
        retryable: false,
        error: {
          schemaVersion: SCHEMA_VERSION_V1,
          code: "DOMAIN_PLANNER_MALFORMED_OUTPUT",
          message: `Model output failed structured schema validation: ${parsedDraft.error.issues.map((i) => i.message).join("; ")}`,
          category: "VALIDATION",
          traceId: params.context.traceId,
        },
      };
    }

    const validatedSteps: PlanStep[] = [];
    for (const draftStep of parsedDraft.data.steps) {
      // Verify tool is registered in ToolManifestRegistry AND supplied in PlanningInput.availableTools
      const registeredTool = this.toolRegistry.getTool(draftStep.toolId);
      const allowedInInput = input.availableTools.some((t) => t.toolId === draftStep.toolId);

      if (!registeredTool || !allowedInInput) {
        return {
          ok: false,
          retryable: false,
          error: {
            schemaVersion: SCHEMA_VERSION_V1,
            code: "DOMAIN_PLANNER_UNREGISTERED_OR_UNSAFE_TOOL",
            message: `Planner proposed unregistered or unpermitted tool '${draftStep.toolId}'.`,
            category: "POLICY_DENIED",
            traceId: params.context.traceId,
          },
        };
      }

      // Prevent model from downgrading a tool's actionClass (e.g. claiming atomic_write is read_allowlisted)
      if (draftStep.actionClass !== registeredTool.actionClass) {
        return {
          ok: false,
          retryable: false,
          error: {
            schemaVersion: SCHEMA_VERSION_V1,
            code: "DOMAIN_PLANNER_TOOL_ACTION_CLASS_MISMATCH",
            message: `Tool '${draftStep.toolId}' requires actionClass '${registeredTool.actionClass}', but planner proposed '${draftStep.actionClass}'.`,
            category: "POLICY_DENIED",
            traceId: params.context.traceId,
          },
        };
      }

      // Evaluate step against OPA policy engine
      const policyDecision = this.policyDecisionPoint.evaluate({
        schemaVersion: SCHEMA_VERSION_V1,
        tenantId: input.tenantId,
        projectId: input.projectId,
        actor: params.context.actor,
        actionClass: registeredTool.actionClass,
        classification: params.context.classification,
      });

      if (policyDecision.decision === "deny") {
        return {
          ok: false,
          retryable: false,
          error: {
            schemaVersion: SCHEMA_VERSION_V1,
            code: "DOMAIN_PLANNER_UNSAFE_STEP_POLICY_DENIED",
            message: `Proposed step '${draftStep.stepId}' denied by policy: ${policyDecision.userExplanation}`,
            category: "POLICY_DENIED",
            traceId: params.context.traceId,
          },
        };
      }

      // Enforce approval requirement deterministically from OPA policy, never trusting LLM output
      validatedSteps.push({
        schemaVersion: SCHEMA_VERSION_V1,
        stepId: draftStep.stepId,
        orderIndex: draftStep.orderIndex,
        toolId: registeredTool.toolId,
        actionClass: registeredTool.actionClass,
        description: draftStep.description,
        input: draftStep.input,
        expectedOutputs: draftStep.expectedOutputs,
        requiresApproval: policyDecision.decision === "requireApproval",
        dependsOnStepIds: draftStep.dependsOnStepIds,
      });
    }

    const planId = this.nextId("plan");
    const planHash = computeCanonicalPlanHash({
      planId,
      specId: input.specId,
      tenantId: input.tenantId,
      projectId: input.projectId,
      steps: validatedSteps,
    });

    const plan: ExecutionPlan = ExecutionPlanSchema.parse({
      schemaVersion: SCHEMA_VERSION_V1,
      planId,
      specId: input.specId,
      tenantId: input.tenantId,
      projectId: input.projectId,
      steps: validatedSteps,
      planHash,
      policyVersion: this.policyDecisionPoint.getPolicyVersion(),
      createdAt: new Date().toISOString(),
    });

    this.providerGateway.auditStore.append({
      eventId: this.nextId("audit-plan"),
      tenantId: input.tenantId,
      projectId: input.projectId,
      actor: params.context.actor,
      traceId: params.context.traceId,
      idempotencyKey: params.context.idempotencyKey,
      eventType: EVENT_NAMES.PLAN_PROPOSED,
      policyVersion: plan.policyVersion,
      planHash: plan.planHash,
      outcome: "EXECUTED",
      payload: plan,
    });

    return {
      ok: true,
      value: plan,
      evidence: modelRes.evidence,
    };
  }
}
