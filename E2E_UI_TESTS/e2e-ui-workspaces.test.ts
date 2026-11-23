import { mkdtempSync, rmSync } from "node:fs";
import { type AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AetherForgeApplicationController } from "../API_INTEGRATION/src/index.ts";
import { WORKSPACE_NAVIGATION_ITEMS } from "../COMPONENT_LIBRARY/src/index.ts";
import { createAetherForgeFrontendServer } from "../FRONTEND_APPLICATION/src/server.ts";

describe("AETHER FORGE 11-Workspace Frontend Application E2E Verification", () => {
  let checkpointDir: string;
  let baseUrl: string;
  let closeServer: () => Promise<void>;

  beforeEach(async () => {
    checkpointDir = mkdtempSync(join(tmpdir(), "aetherforge-ui-e2e-"));
    const controller = new AetherForgeApplicationController({
      workspaceRoot: process.cwd(),
      checkpointDir,
    });
    const server = createAetherForgeFrontendServer(controller);
    await new Promise<void>((resolveListen) => {
      server.listen(0, "127.0.0.1", () => resolveListen());
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
    closeServer = () =>
      new Promise<void>((resolveClose) => {
        server.close(() => resolveClose());
      });
  });

  afterEach(async () => {
    await closeServer();
    rmSync(checkpointDir, { recursive: true, force: true });
  });

  it("renders all 11 semantic, accessible workspaces backed by authoritative backend state SHA-256", async () => {
    for (const item of WORKSPACE_NAVIGATION_ITEMS) {
      const res = await fetch(`${baseUrl}${item.route}`);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("<main");
      expect(html).toContain("<nav");
      expect(html).toContain(item.title);
      expect(html).toContain('aria-current="page"');
      expect(html).toContain("Authoritative Backend State SHA-256:");
    }
  });

  it("executes real backend interactions across Project Creation, Workflow Approval, Tool Console, Knowledge Search, DAW Integration, and Emergency Stop", async () => {
    // 1. Project Creation Studio: compile new natural language project
    const compileRes = await fetch(`${baseUrl}/api/v1/ui/compile-project`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: "ui-e2e-vst3-app",
        title: "UI Compiled VST3 Mastering Limiter",
        inputType: "NATURAL_LANGUAGE_REQUIREMENTS",
        naturalLanguagePrompt:
          "Implement a VST3 real-time C++20 limiter and FL Studio 2025 .flp inspector with OPA policy checks.",
      }),
    });
    expect(compileRes.status).toBe(201);
    const compiledPayload = (await compileRes.json()) as {
      ok: boolean;
      specification: { specificationId: string; specificationSha256: string };
    };
    expect(compiledPayload.ok).toBe(true);
    expect(compiledPayload.specification.specificationSha256).toMatch(/^[A-F0-9]{64}$/);

    // 2. Workflow Studio: start Tier 2 approval-gated durable workflow -> pauses in WAITING_FOR_APPROVAL
    const startWfRes = await fetch(`${baseUrl}/api/v1/ui/workflows/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        executionId: "EXEC-UI-E2E-1",
        requesterPrincipalId: "human-operator-01",
        includeTier2ApprovalStep: true,
      }),
    });
    expect(startWfRes.status).toBe(201);
    const wfPaused = (await startWfRes.json()) as { checkpoint: { status: string } };
    expect(wfPaused.checkpoint.status).toBe("WAITING_FOR_APPROVAL");

    // Approve workflow with distinct Reviewer principal -> completes through AGT-19
    const approveRes = await fetch(`${baseUrl}/api/v1/ui/workflows/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        executionId: "EXEC-UI-E2E-1",
        stepId: "TASK-0002-APPROVAL",
        decision: "APPROVED",
        approverPrincipalId: "human-reviewer-02",
      }),
    });
    expect(approveRes.status).toBe(200);
    const wfCompleted = (await approveRes.json()) as { checkpoint: { status: string } };
    expect(wfCompleted.checkpoint.status).toBe("COMPLETED");

    // 3. Engineering Console: execute real code.review via ControlledToolGateway
    const toolRes = await fetch(`${baseUrl}/api/v1/ui/tools/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agentId: "AGT-19",
        toolId: "code.review",
        targetRelativePath: "contracts/src/index.ts",
      }),
    });
    expect(toolRes.status).toBe(200);
    const toolBody = (await toolRes.json()) as { ok: boolean; output: { passed: boolean } };
    expect(toolBody.ok).toBe(true);
    expect(toolBody.output.passed).toBe(true);

    // 4. Knowledge Center: execute real hybrid authoritative search
    const searchRes = await fetch(`${baseUrl}/api/v1/ui/knowledge/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "ADR-0008 real-time audio" }),
    });
    expect(searchRes.status).toBe(200);
    const searchBody = (await searchRes.json()) as { hits: Array<{ record: { isAuthoritative: boolean } }> };
    expect(searchBody.hits.length).toBeGreaterThanOrEqual(1);
    expect(searchBody.hits.every((h) => h.record.isAuthoritative)).toBe(true);

    // 5. Integration Center: inspect DAW project via replaceable REAPER adapter
    const dawRes = await fetch(`${baseUrl}/api/v1/ui/daw/inspect`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dawId: "cockos-reaper",
        projectPathOrPayload: '<REAPER_PROJECT 0.1 "7.20/win64"\n<TRACK {A}\n>\n>',
      }),
    });
    expect(dawRes.status).toBe(200);
    const dawBody = (await dawRes.json()) as { report: { channelOrTrackCount: number } };
    expect(dawBody.report.channelOrTrackCount).toBe(1);

    // 6. System Monitor: activate Emergency Stop -> mutating requests return HTTP 423 WORKSPACE_LOCKED_EMERGENCY_STOP
    const stopRes = await fetch(`${baseUrl}/api/v1/ui/system/emergency-stop`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: true, reason: "E2E preemption drill" }),
    });
    expect(stopRes.status).toBe(200);

    const blockedCompile = await fetch(`${baseUrl}/api/v1/ui/compile-project`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: "blocked-during-stop",
        title: "Blocked",
        inputType: "PRODUCT_DIRECTION",
        naturalLanguagePrompt: "Should be blocked",
      }),
    });
    expect(blockedCompile.status).toBe(423);

    // Verify Command Center SSR reflects Emergency Stop banner authoritatively
    const cmdHtml = await (await fetch(`${baseUrl}/workspaces/command-center`)).text();
    expect(cmdHtml).toContain("EMERGENCY STOP ACTIVE (HTTP 423)");
    expect(cmdHtml).toContain("ui-e2e-vst3-app");
  });
});
