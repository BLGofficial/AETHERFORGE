import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import {
  type ApprovalDecision,
  type Brief,
  type CapabilityGrant,
  type EvidenceRef,
  type RequestContext,
  SCHEMA_VERSION_V1,
  type WorkerJob,
} from "@aether-forge/sdk";
import type { GovernedDomainApiService } from "@aether-forge/api";
import type { DurableTemporalOrchestrator } from "@aether-forge/orchestration";
import {
  computeGrantSignature,
  computeJobManifestSignature,
  type MockWorkerGateway,
  type WindowsWorkerHost,
} from "@aether-forge/windows-host";
import { renderControlPlaneDashboardHtml } from "./screens.ts";

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export interface WebControlPlaneServerDeps {
  readonly api: GovernedDomainApiService;
  readonly orchestrator: DurableTemporalOrchestrator;
  readonly defaultTenantId: string;
  readonly defaultProjectId: string;
  readonly defaultBearerToken: string;
  readonly ownerBearerToken?: string | undefined;
  readonly localWorker?: {
    readonly workerHost: WindowsWorkerHost;
    readonly workerGateway: MockWorkerGateway;
    readonly workerId: string;
    readonly localWorkspaceDir: string;
  } | undefined;
}

/**
 * Starts a local HTTP server rendering the 4 governed Web Control Plane screens
 * and processing Brief Submission, Approval Decisions, and Emergency Stop exclusively
 * through the typed Domain API and Temporal Orchestrator boundaries.
 */
export function createWebControlPlaneServer(deps: WebControlPlaneServerDeps): {
  readonly server: Server;
  getActiveWorkflowId(): string | undefined;
} {
  let activeWorkflowId: string | undefined;
  let activeTraceId = "4bf92f3577b34da6a3ce929d0e0e4736";
  let lastErrorBanner: string | undefined;
  let requestCounter = 0;
  const localWorkerEvidence: EvidenceRef[] = [];

  function nextIdempotencyKey(prefix: string): string {
    requestCounter += 1;
    return `${prefix}-${String(requestCounter).padStart(4, "0")}`;
  }

  function buildContext(
    idempotencyKey: string,
    role: "Builder" | "Owner" = "Builder",
  ): RequestContext {
    return {
      schemaVersion: SCHEMA_VERSION_V1,
      requestId: `req-${idempotencyKey}`,
      tenantId: deps.defaultTenantId,
      projectId: deps.defaultProjectId,
      actor: {
        actorId: role === "Owner" ? "actor-owner-01" : "actor-builder-01",
        principalType: "human",
        roles: [role],
      },
      traceId: activeTraceId,
      idempotencyKey,
      classification: "CONFIDENTIAL",
    };
  }

  function renderPage(res: ServerResponse, statusCode = 200): void {
    const rawWorkflow = activeWorkflowId
      ? deps.orchestrator.getWorkflowState(deps.defaultTenantId, activeWorkflowId)
      : undefined;
    const workflow = rawWorkflow
      ? {
          ...rawWorkflow,
          evidence: [...rawWorkflow.evidence, ...localWorkerEvidence],
        }
      : undefined;
    const auditTimeline = deps.api.auditStore.reconstructTrace(
      deps.defaultTenantId,
      activeTraceId,
    );

    const html = renderControlPlaneDashboardHtml({
      tenantId: deps.defaultTenantId,
      projectId: deps.defaultProjectId,
      workflow,
      auditTimeline,
      errorBanner: lastErrorBanner,
    });

    res.writeHead(statusCode, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    });
    res.end(html);
  }

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "/";

    if (req.method === "GET" && (url === "/" || url.startsWith("/ui"))) {
      renderPage(res, 200);
      return;
    }

    if (req.method === "POST" && url === "/ui/submit-brief") {
      const bodyRaw = await readRequestBody(req);
      const params = new URLSearchParams(bodyRaw);
      const title = params.get("title") ?? "Governed Brief";
      const objective =
        params.get("objective") ??
        "Inspect workspace metadata and execute one approval-gated simulated write.";
      const constraint =
        params.get("constraint") ?? "Require explicit approval before workspace write";

      const idem = nextIdempotencyKey("ui-brief");
      const context = buildContext(idem, "Builder");
      const brief: Brief = {
        schemaVersion: SCHEMA_VERSION_V1,
        briefId: `brief-${idem}`,
        tenantId: deps.defaultTenantId,
        projectId: deps.defaultProjectId,
        title,
        objective,
        constraints: [constraint],
        classification: "CONFIDENTIAL",
        createdBy: context.actor.actorId,
        createdAt: new Date().toISOString(),
      };

      const startRes = deps.orchestrator.startBriefWorkflow({
        context,
        brief,
        bearerToken: deps.defaultBearerToken,
        ...(deps.localWorker
          ? { canonicalPathScope: [deps.localWorker.localWorkspaceDir] }
          : {}),
      });

      if (!startRes.ok) {
        lastErrorBanner = `${startRes.error.code}: ${startRes.error.message}`;
        renderPage(res, 400);
        return;
      }

      lastErrorBanner = undefined;
      localWorkerEvidence.length = 0;
      activeWorkflowId = startRes.value.workflowId;
      renderPage(res, 200);
      return;
    }

    if (req.method === "POST" && url === "/ui/approve") {
      const bodyRaw = await readRequestBody(req);
      const params = new URLSearchParams(bodyRaw);
      const workflowId = params.get("workflowId") ?? activeWorkflowId ?? "";
      const approvalId = params.get("approvalId") ?? "";
      const decision = (params.get("decision") ?? "APPROVED") as ApprovalDecision;
      const rationale = params.get("rationale") ?? "Approved via Web Control Plane UI";

      const idem = nextIdempotencyKey("ui-approve");
      const context = buildContext(idem, "Builder");
      const signalRes = deps.orchestrator.signalApprovalDecision(workflowId, {
        signalId: `sig-${approvalId}-${decision}`,
        context,
        approvalId,
        decision,
        rationale,
        bearerToken: deps.defaultBearerToken,
      });

      if (!signalRes.ok) {
        lastErrorBanner = `${signalRes.error.code}: ${signalRes.error.message}`;
        renderPage(res, 400);
        return;
      }

      if (decision === "APPROVED" && deps.localWorker && localWorkerEvidence.length === 0) {
        const lw = deps.localWorker;
        const plan = signalRes.value.plan;
        const makeGrant = (
          grantId: string,
          stepId: string,
          actionClass: CapabilityGrant["actionClass"],
        ): CapabilityGrant => {
          const base: Omit<CapabilityGrant, "signature"> = {
            schemaVersion: SCHEMA_VERSION_V1,
            grantId,
            tenantId: deps.defaultTenantId,
            projectId: deps.defaultProjectId,
            workerId: lw.workerId,
            planId: plan.planId,
            planHash: plan.planHash,
            stepId,
            actionClass,
            canonicalPathScope: [lw.localWorkspaceDir],
            policyVersion: deps.api.getPolicyVersion(),
            issuedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
            revoked: false,
          };
          return {
            ...base,
            signature: computeGrantSignature(base, lw.workerGateway.controlPlaneSigningSecret),
          };
        };

        const jobs: Array<Omit<WorkerJob, "manifestSignature">> = [
          {
            schemaVersion: SCHEMA_VERSION_V1,
            jobId: `job-write-${idem}`,
            traceId: activeTraceId,
            idempotencyKey: `idem-write-${idem}`,
            stepId: "step-2-write_workspace",
            grant: makeGrant(`grant-write-${idem}`, "step-2-write_workspace", "write_workspace"),
            payload: {
              kind: "workspace_write",
              targetRelativePath: "outputs/approved-build-report.json",
              contentUtf8: JSON.stringify(
                {
                  workflowId,
                  approvalId,
                  rationale,
                  completedAt: new Date().toISOString(),
                },
                null,
                2,
              ),
            },
          },
          {
            schemaVersion: SCHEMA_VERSION_V1,
            jobId: `job-audio-${idem}`,
            traceId: activeTraceId,
            idempotencyKey: `idem-audio-${idem}`,
            stepId: "step-3-audio_dsp",
            grant: makeGrant(`grant-audio-${idem}`, "step-3-audio_dsp", "audio_dsp"),
            payload: {
              kind: "audio_job",
              audioJob: {
                schemaVersion: SCHEMA_VERSION_V1,
                audioJobId: `audio-${idem}`,
                operation: "gain_normalize",
                inputPath: "stems/lead_stem.wav",
                outputPath: "renders/lead_stem_norm.wav",
                targetPeakDbfs: -1.0,
                quotas: {
                  maxDurationSeconds: 300,
                  maxInputBytes: 50_000_000,
                  maxExecutionTimeMs: 30_000,
                },
              },
            },
          },
          {
            schemaVersion: SCHEMA_VERSION_V1,
            jobId: `job-daw-${idem}`,
            traceId: activeTraceId,
            idempotencyKey: `idem-daw-${idem}`,
            stepId: "step-4-daw_inspect",
            grant: makeGrant(`grant-daw-${idem}`, "step-4-daw_inspect", "daw_inspect"),
            payload: {
              kind: "daw_command",
              dawCommand: {
                schemaVersion: SCHEMA_VERSION_V1,
                commandId: `daw-${idem}`,
                dawTarget: "fl-studio-2025",
                capabilityTier: "inspect",
                operation: "inspect_version_and_session_header",
                backupRequired: false,
                foregroundUiFallbackOptIn: false,
                parameters: { projectRelativePath: "sessions/fl2025_demo.flp" },
              },
            },
          },
        ];

        for (const unsignedJob of jobs) {
          const signedJob: WorkerJob = {
            ...unsignedJob,
            manifestSignature: computeJobManifestSignature(
              unsignedJob,
              lw.workerGateway.controlPlaneSigningSecret,
            ),
          };
          const receipt = lw.workerHost.executeJobManifest(signedJob);
          if (receipt.ok) {
            localWorkerEvidence.push(...receipt.evidence);
          }
        }
      }

      lastErrorBanner = undefined;
      renderPage(res, 200);
      return;
    }

    if (req.method === "POST" && url === "/ui/emergency-stop") {
      const idem = nextIdempotencyKey("ui-stop");
      const context = buildContext(idem, "Owner");
      const stopRes = deps.api.triggerEmergencyStop(
        {
          context,
          scope: "PROJECT",
          targetId: deps.defaultProjectId,
          reason: "Operator clicked Emergency Stop in Web Control Plane UI",
        },
        { bearerToken: deps.ownerBearerToken ?? deps.defaultBearerToken },
      );

      if (!stopRes.ok) {
        lastErrorBanner = `${stopRes.error.code}: ${stopRes.error.message}`;
        renderPage(res, 400);
        return;
      }

      lastErrorBanner = undefined;
      renderPage(res, 200);
      return;
    }

    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not Found");
  });

  return {
    server,
    getActiveWorkflowId: () => activeWorkflowId,
  };
}
