import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { AetherForgeApplicationController } from "../../API_INTEGRATION/src/index.ts";
import {
  WORKSPACE_NAVIGATION_ITEMS,
  type WorkspaceSlug,
} from "../../COMPONENT_LIBRARY/src/index.ts";
import { type CompilerInputType, type SpecialistAgentId } from "../../SPECIFICATION_SCHEMAS/compiler-schemas.ts";
import { type EngineeringToolId } from "../../TOOL_GATEWAY/src/tool-schemas.ts";
import { renderWorkspaceBySlug } from "./workspaces.ts";

async function readRequestBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};

  const contentType = req.headers["content-type"] ?? "";
  if (contentType.includes("application/json")) {
    return JSON.parse(raw) as Record<string, unknown>;
  }
  const params = new URLSearchParams(raw);
  const obj: Record<string, unknown> = {};
  for (const [k, v] of params.entries()) {
    obj[k] = v;
  }
  return obj;
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

function sendHtml(res: ServerResponse, status: number, html: string): void {
  res.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "content-length": Buffer.byteLength(html),
  });
  res.end(html);
}

export function createAetherForgeFrontendServer(controller: AetherForgeApplicationController): Server {
  const validSlugs = new Set<string>(WORKSPACE_NAVIGATION_ITEMS.map((w) => w.slug));

  return createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const pathname = url.pathname;
    const method = req.method ?? "GET";

    try {
      // Root redirects or renders Command Center
      if (method === "GET" && pathname === "/") {
        const state = controller.getAuthoritativeWorkspaceState();
        sendHtml(res, 200, renderWorkspaceBySlug("command-center", state));
        return;
      }

      // 11 Workspace SSR Routes
      if (method === "GET" && pathname.startsWith("/workspaces/")) {
        const slug = pathname.slice("/workspaces/".length);
        if (validSlugs.has(slug)) {
          const state = controller.getAuthoritativeWorkspaceState();
          sendHtml(res, 200, renderWorkspaceBySlug(slug as WorkspaceSlug, state));
          return;
        }
      }

      // Authoritative State Snapshot JSON API
      if (method === "GET" && pathname === "/api/v1/ui/state") {
        sendJson(res, 200, controller.getAuthoritativeWorkspaceState());
        return;
      }

      // Workspace 2: Compile Project
      if (method === "POST" && pathname === "/api/v1/ui/compile-project") {
        const body = await readRequestBody(req);
        const spec = controller.compileNewProjectFromNaturalLanguage({
          projectId: String(body["projectId"] ?? "ui-project"),
          title: String(body["title"] ?? "Compiled Project"),
          inputType: (body["inputType"] ?? "PRODUCT_DIRECTION") as CompilerInputType,
          naturalLanguagePrompt: String(body["naturalLanguagePrompt"] ?? "Build governed software"),
        });
        sendJson(res, 201, { ok: true, specification: spec });
        return;
      }

      // Workspace 5: Start Durable Workflow
      if (method === "POST" && pathname === "/api/v1/ui/workflows/start") {
        const body = await readRequestBody(req);
        const includeApproval =
          body["includeTier2ApprovalStep"] === true || body["includeTier2ApprovalStep"] === "true";
        const checkpoint = await controller.startDurableWorkflowFromLatestSpec({
          executionId: String(body["executionId"] ?? `EXEC-UI-${Date.now()}`),
          includeTier2ApprovalStep: includeApproval,
          requesterPrincipalId: String(body["requesterPrincipalId"] ?? "human-operator-01"),
        });
        sendJson(res, 201, { ok: true, checkpoint });
        return;
      }

      // Workspace 5: Submit Human Approval Decision
      if (method === "POST" && pathname === "/api/v1/ui/workflows/approve") {
        const body = await readRequestBody(req);
        const checkpoint = await controller.submitWorkflowApprovalDecision({
          executionId: String(body["executionId"] ?? ""),
          stepId: String(body["stepId"] ?? ""),
          decision: body["decision"] === "REJECTED" ? "REJECTED" : "APPROVED",
          approverPrincipalId: String(body["approverPrincipalId"] ?? "human-reviewer-02"),
        });
        sendJson(res, 200, { ok: true, checkpoint });
        return;
      }

      // Workspace 6: Execute Controlled Engineering Tool
      if (method === "POST" && pathname === "/api/v1/ui/tools/execute") {
        const body = await readRequestBody(req);
        const toolId = String(body["toolId"] ?? "repo.inspect") as EngineeringToolId;
        const targetPath = String(body["targetRelativePath"] ?? "contracts");
        const rawInput =
          toolId === "repo.inspect"
            ? { relativeDirPath: targetPath, maxEntries: 25 }
            : toolId === "code.review"
              ? { targetRelativePath: targetPath, enforceZeroAnyTypes: true, enforceRealtimeAudioRules: false }
              : body["rawInput"] ?? {};

        const outcome = controller.stageAndExecuteEngineeringTool({
          agentId: String(body["agentId"] ?? "AGT-02") as SpecialistAgentId,
          toolId,
          actionTier: "0",
          targetRelativePath: targetPath,
          rawInput,
          rationale: String(body["rationale"] ?? "Operator Engineering Console invocation"),
        });
        sendJson(res, outcome.ok ? 200 : 400, outcome);
        return;
      }

      // Workspace 7: Search Authoritative Knowledge
      if (method === "POST" && pathname === "/api/v1/ui/knowledge/search") {
        const body = await readRequestBody(req);
        const hits = controller.searchAuthoritativeKnowledge(String(body["query"] ?? "VST3"));
        sendJson(res, 200, { ok: true, hits });
        return;
      }

      // Workspace 9: Inspect DAW Project Read-Only
      if (method === "POST" && pathname === "/api/v1/ui/daw/inspect") {
        const body = await readRequestBody(req);
        const report = controller.inspectDawProject({
          dawId: String(body["dawId"] ?? "cockos-reaper"),
          projectPathOrPayload: String(body["projectPathOrPayload"] ?? ""),
        });
        sendJson(res, 200, { ok: true, report });
        return;
      }

      // Workspace 10: Emergency Stop Toggle
      if (method === "POST" && pathname === "/api/v1/ui/system/emergency-stop") {
        const body = await readRequestBody(req);
        const active = body["active"] === true || body["active"] === "true";
        const result = controller.setEmergencyStop(active, String(body["reason"] ?? "Operator intervention"));
        sendJson(res, 200, { ok: true, ...result });
        return;
      }

      sendJson(res, 404, { errorCode: "ROUTE_NOT_FOUND", pathname });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = msg.includes("WORKSPACE_LOCKED_EMERGENCY_STOP") ? 423 : 400;
      sendJson(res, status, { ok: false, errorCode: msg.split(":")[0], message: msg });
    }
  });
}
