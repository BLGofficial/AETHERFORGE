import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EngineeringExecutionRuntime } from "../src/index.ts";

describe("AETHER FORGE Engineering Execution Runtime & Controlled Tool Gateway (ARCH-05 / ARCH-09)", () => {
  let sandboxDir: string;
  let runtime: EngineeringExecutionRuntime;

  beforeEach(() => {
    sandboxDir = mkdtempSync(join(tmpdir(), "aetherforge-eng-runtime-"));
    runtime = new EngineeringExecutionRuntime({ workspaceRoot: sandboxDir });
  });

  afterEach(() => {
    rmSync(sandboxDir, { recursive: true, force: true });
  });

  it("separates planning from execution and executes all 11 engineering capabilities with schema validation and hash-chained auditing", () => {
    // 1. Stage file creation proposal (Planning Phase -> file must NOT exist on disk yet!)
    const fileProp = runtime.stageToolProposal({
      proposalId: "PROP-001",
      traceId: "trace-runtime-0001",
      tenantId: "t1",
      projectId: "p1",
      planId: "plan-1",
      stepId: "step-1",
      agentId: "AGT-11",
      toolId: "file.create_or_modify",
      actionTier: "1",
      fenceToken: 1,
      leasedWriteGlobs: ["src/**"],
      leasedReadGlobs: ["**"],
      targetRelativePath: "src/service.ts",
      rawInput: {
        relativePath: "src/service.ts",
        content: "export const VERSION = '1.0.0';\n",
        mode: "CREATE_OR_OVERWRITE",
      },
      rationale: "Create baseline service module",
    });

    expect(existsSync(join(sandboxDir, "src/service.ts"))).toBe(false);

    // Execute staged proposal (Execution Phase)
    const fileRes = runtime.executeStagedProposal<{ postWriteSha256: string; artifactId: string }>(
      fileProp.proposalId
    );
    expect(fileRes.ok).toBe(true);
    expect(existsSync(join(sandboxDir, "src/service.ts"))).toBe(true);
    expect(fileRes.output?.artifactId).toMatch(/^ART-/);

    // 2. Code Generation (C++20 real-time safe DSP header)
    runtime.stageToolProposal({
      proposalId: "PROP-002",
      traceId: "trace-runtime-0002",
      tenantId: "t1",
      projectId: "p1",
      planId: "plan-1",
      stepId: "step-2",
      agentId: "AGT-08",
      toolId: "code.generate",
      actionTier: "1",
      fenceToken: 2,
      leasedWriteGlobs: ["dsp/**"],
      leasedReadGlobs: ["**"],
      targetRelativePath: "dsp/Filter.h",
      rawInput: {
        targetRelativePath: "dsp/Filter.h",
        language: "CPP20",
        moduleName: "Filter",
        interfaceContractId: "IC-DSP-01",
        sourceCode: "struct Filter { float process(float x) noexcept { return x * 0.5f; } };\n",
      },
      rationale: "Generate lock-free C++20 filter",
    });
    const codeGenRes = runtime.executeStagedProposal("PROP-002");
    expect(codeGenRes.ok).toBe(true);

    // 3. Code Review (verify C++20 real-time safety)
    runtime.stageToolProposal({
      proposalId: "PROP-003",
      traceId: "trace-runtime-0003",
      tenantId: "t1",
      projectId: "p1",
      planId: "plan-1",
      stepId: "step-3",
      agentId: "AGT-19",
      toolId: "code.review",
      actionTier: "0",
      fenceToken: 3,
      leasedWriteGlobs: [],
      leasedReadGlobs: ["**"],
      targetRelativePath: "dsp/Filter.h",
      rawInput: {
        targetRelativePath: "dsp/Filter.h",
        enforceRealtimeAudioRules: true,
        enforceZeroAnyTypes: true,
      },
      rationale: "Review C++20 filter for real-time hazards",
    });
    const reviewRes = runtime.executeStagedProposal<{ passed: boolean }>("PROP-003");
    expect(reviewRes.ok).toBe(true);
    expect(reviewRes.output?.passed).toBe(true);

    // 4. Repo Inspection
    runtime.stageToolProposal({
      proposalId: "PROP-004",
      traceId: "trace-runtime-0004",
      tenantId: "t1",
      projectId: "p1",
      planId: "plan-1",
      stepId: "step-4",
      agentId: "AGT-02",
      toolId: "repo.inspect",
      actionTier: "0",
      fenceToken: 4,
      leasedWriteGlobs: [],
      leasedReadGlobs: ["**"],
      targetRelativePath: "src",
      rawInput: { relativeDirPath: "src", maxEntries: 10 },
      rationale: "Inspect generated src directory",
    });
    const inspectRes = runtime.executeStagedProposal<{ entries: unknown[] }>("PROP-004");
    expect(inspectRes.ok).toBe(true);
    expect(inspectRes.output?.entries).toHaveLength(1);

    // 5. Git Execution
    runtime.stageToolProposal({
      proposalId: "PROP-005",
      traceId: "trace-runtime-0005",
      tenantId: "t1",
      projectId: "p1",
      planId: "plan-1",
      stepId: "step-5",
      agentId: "AGT-17",
      toolId: "git.execute",
      actionTier: "0",
      fenceToken: 5,
      leasedWriteGlobs: [],
      leasedReadGlobs: ["**"],
      targetRelativePath: ".",
      rawInput: { subcommand: "status", maxLines: 20 },
      rationale: "Check workspace git status",
    });
    expect(runtime.executeStagedProposal("PROP-005").ok).toBe(true);

    // 6. Build Execution
    runtime.stageToolProposal({
      proposalId: "PROP-006",
      traceId: "trace-runtime-0006",
      tenantId: "t1",
      projectId: "p1",
      planId: "plan-1",
      stepId: "step-6",
      agentId: "AGT-17",
      toolId: "build.execute",
      actionTier: "1",
      fenceToken: 6,
      leasedWriteGlobs: [],
      leasedReadGlobs: ["**"],
      targetRelativePath: ".",
      rawInput: { target: "TYPECHECK", args: ["--noEmit"] },
      rationale: "Run workspace typecheck",
    });
    expect(runtime.executeStagedProposal("PROP-006").ok).toBe(true);

    // 7. Create & Execute Test Suite
    runtime.stageToolProposal({
      proposalId: "PROP-007A",
      traceId: "trace-runtime-0007a",
      tenantId: "t1",
      projectId: "p1",
      planId: "plan-1",
      stepId: "step-7a",
      agentId: "AGT-15",
      toolId: "file.create_or_modify",
      actionTier: "1",
      fenceToken: 7,
      leasedWriteGlobs: ["tests/**"],
      leasedReadGlobs: ["**"],
      targetRelativePath: "tests/sample.test.ts",
      rawInput: {
        relativePath: "tests/sample.test.ts",
        content: "it('passes sample assertion', () => {});\n",
      },
      rationale: "Author sample unit test",
    });
    expect(runtime.executeStagedProposal("PROP-007A").ok).toBe(true);

    runtime.stageToolProposal({
      proposalId: "PROP-007B",
      traceId: "trace-runtime-0007b",
      tenantId: "t1",
      projectId: "p1",
      planId: "plan-1",
      stepId: "step-7b",
      agentId: "AGT-15",
      toolId: "test.execute",
      actionTier: "0",
      fenceToken: 8,
      leasedWriteGlobs: [],
      leasedReadGlobs: ["**"],
      targetRelativePath: "tests/sample.test.ts",
      rawInput: { suitePath: "tests/sample.test.ts" },
      rationale: "Execute unit test suite",
    });
    const testRes = runtime.executeStagedProposal<{ passedTests: number }>("PROP-007B");
    expect(testRes.ok).toBe(true);
    expect(testRes.output?.passedTests).toBe(1);

    // 8. Documentation Generation with artifact link verification
    runtime.stageToolProposal({
      proposalId: "PROP-008",
      traceId: "trace-runtime-0008",
      tenantId: "t1",
      projectId: "p1",
      planId: "plan-1",
      stepId: "step-8",
      agentId: "AGT-18",
      toolId: "docs.generate",
      actionTier: "1",
      fenceToken: 9,
      leasedWriteGlobs: ["docs/**"],
      leasedReadGlobs: ["**"],
      targetRelativePath: "docs/MODULE.md",
      rawInput: {
        targetRelativePath: "docs/MODULE.md",
        title: "Service & DSP Module Reference",
        sections: [{ heading: "Overview", body: "Verified service and C++20 DSP filter." }],
        referencedArtifactPaths: ["src/service.ts", "dsp/Filter.h"],
      },
      rationale: "Generate traceable module documentation",
    });
    const docRes = runtime.executeStagedProposal<{ verifiedLinksCount: number }>("PROP-008");
    expect(docRes.ok).toBe(true);
    expect(docRes.output?.verifiedLinksCount).toBe(2);

    // 9. API Integration
    runtime.stageToolProposal({
      proposalId: "PROP-009",
      traceId: "trace-runtime-0009",
      tenantId: "t1",
      projectId: "p1",
      planId: "plan-1",
      stepId: "step-9",
      agentId: "AGT-11",
      toolId: "api.integrate",
      actionTier: "1",
      fenceToken: 10,
      leasedWriteGlobs: [],
      leasedReadGlobs: ["**"],
      targetRelativePath: ".",
      rawInput: {
        endpointId: "EP-HEALTH",
        method: "GET",
        routePath: "/api/v1/health",
      },
      rationale: "Verify API health integration",
    });
    expect(runtime.executeStagedProposal("PROP-009").ok).toBe(true);

    // Verify audit log hash chain and artifact integrity
    const auditVerification = runtime.getGateway().getAuditLog().verifyIntegrity();
    expect(auditVerification.valid).toBe(true);
    expect(auditVerification.totalEntries).toBe(10);

    const artifacts = runtime.getGateway().getArtifactManager().listArtifactsByPlan("plan-1");
    expect(artifacts.length).toBeGreaterThanOrEqual(4);
    for (const art of artifacts) {
      expect(runtime.getGateway().getArtifactManager().verifyArtifactIntegrity(art.artifactId).valid).toBe(
        true
      );
    }
  });

  it("blocks direct LLM bypass of ControlledToolGateway and enforces human approval on dependency.manage and deploy.prepare", () => {
    const gateway = runtime.getGateway();
    const rawAdapters = gateway.getAdaptersForDirectBypassTesting();

    const proposal = runtime.stageToolProposal({
      proposalId: "PROP-BYPASS-01",
      traceId: "trace-bypass-01",
      tenantId: "t1",
      projectId: "p1",
      planId: "plan-sec",
      stepId: "step-sec-1",
      agentId: "AGT-13",
      toolId: "dependency.manage",
      actionTier: "2",
      fenceToken: 1,
      leasedWriteGlobs: ["package.json"],
      leasedReadGlobs: ["**"],
      targetRelativePath: "package.json",
      rawInput: {
        operation: "ADD_DEPENDENCY",
        packageName: "zod",
        versionSpec: "^3.24.2",
        spdxLicense: "MIT",
      },
      rationale: "Audit dependency addition",
    });

    // 1. Direct adapter invocation with forged seal -> MUST throw DIRECT_GATEWAY_BYPASS_FORBIDDEN
    expect(() =>
      rawAdapters.invokeAdapter(
        {
          sealId: "FORGED-SEAL",
          proposalId: proposal.proposalId,
          toolId: "dependency.manage",
          signatureHmacSha256: "0".repeat(64),
        },
        proposal,
        proposal.rawInput
      )
    ).toThrow(/DIRECT_GATEWAY_BYPASS_FORBIDDEN/);

    // 2. Execute Tier 2 dependency.manage without human ApprovalGrant -> MUST block with HUMAN_APPROVAL_GRANT_REQUIRED
    const unapprovedRes = runtime.executeStagedProposal("PROP-BYPASS-01");
    expect(unapprovedRes.ok).toBe(false);
    expect(unapprovedRes.error?.errorCode).toBe("HUMAN_APPROVAL_GRANT_REQUIRED");

    // 3. Issue single-use human ApprovalGrant (enforcing requester !== approver) and execute
    const grant = gateway.getPermissions().issueHumanApprovalGrant({
      grantId: "GRANT-DEP-001",
      tenantId: "t1",
      projectId: "p1",
      planId: "plan-sec",
      stepId: "step-sec-1",
      toolId: "dependency.manage",
      requesterAgentId: "AGT-13",
      requesterPrincipalId: "user-operator-1",
      approverPrincipalId: "user-reviewer-2",
      approverRole: "Reviewer",
      allowedRelativePathPrefix: "package.json",
      expiresAtIso: new Date(Date.now() + 60_000).toISOString(),
    });

    const approvedDepRes = runtime.executeStagedProposal("PROP-BYPASS-01", grant.grantId);
    expect(approvedDepRes.ok).toBe(true);

    // 4. Reusing the same single-use ApprovalGrant -> MUST fail with APPROVAL_GRANT_ALREADY_CONSUMED
    const replayRes = runtime.executeStagedProposal("PROP-BYPASS-01", grant.grantId);
    expect(replayRes.ok).toBe(false);
    expect(replayRes.error?.errorCode).toBe("APPROVAL_GRANT_ALREADY_CONSUMED");

    // 5. Prepare artifact and test human-approval-gated deploy.prepare
    runtime.stageToolProposal({
      proposalId: "PROP-ART-PREP",
      traceId: "trace-art-prep",
      tenantId: "t1",
      projectId: "p1",
      planId: "plan-sec",
      stepId: "step-sec-2",
      agentId: "AGT-11",
      toolId: "file.create_or_modify",
      actionTier: "1",
      fenceToken: 2,
      leasedWriteGlobs: ["dist/**"],
      leasedReadGlobs: ["**"],
      targetRelativePath: "dist/bundle.js",
      rawInput: { relativePath: "dist/bundle.js", content: "console.log('release');\n" },
      rationale: "Create release bundle artifact",
    });
    expect(runtime.executeStagedProposal("PROP-ART-PREP").ok).toBe(true);

    runtime.stageToolProposal({
      proposalId: "PROP-DEPLOY-01",
      traceId: "trace-deploy-01",
      tenantId: "t1",
      projectId: "p1",
      planId: "plan-sec",
      stepId: "step-sec-3",
      agentId: "AGT-13",
      toolId: "deploy.prepare",
      actionTier: "2",
      fenceToken: 3,
      leasedWriteGlobs: ["**"],
      leasedReadGlobs: ["**"],
      targetRelativePath: "deploy-bundle-1.0.0-staging.json",
      rawInput: {
        releaseVersion: "1.0.0",
        targetEnvironment: "STAGING",
        artifactPaths: ["dist/bundle.js"],
      },
      rationale: "Prepare CycloneDX SBOM & SLSA v1.0 deployment bundle",
    });

    const deployGrant = gateway.getPermissions().issueHumanApprovalGrant({
      grantId: "GRANT-DEPLOY-001",
      tenantId: "t1",
      projectId: "p1",
      planId: "plan-sec",
      stepId: "step-sec-3",
      toolId: "deploy.prepare",
      requesterAgentId: "AGT-13",
      requesterPrincipalId: "user-operator-1",
      approverPrincipalId: "user-releasemgr-2",
      approverRole: "ReleaseManager",
      allowedRelativePathPrefix: "deploy-bundle-1.0.0-staging.json",
      expiresAtIso: new Date(Date.now() + 60_000).toISOString(),
    });

    const deployRes = runtime.executeStagedProposal<{ sbomSha256: string; provenanceSha256: string }>(
      "PROP-DEPLOY-01",
      deployGrant.grantId
    );
    expect(deployRes.ok).toBe(true);
    expect(deployRes.output?.sbomSha256).toMatch(/^[A-F0-9]{64}$/);
    expect(deployRes.output?.provenanceSha256).toMatch(/^[A-F0-9]{64}$/);
  });

  it("enforces sandbox path confinement, agent tool permissions, write-lease boundaries, and automatic checkpoint rollback on failure", () => {
    // 1. Sandbox path traversal attempt ('../escape.txt') -> BLOCKED_SANDBOX
    runtime.stageToolProposal({
      proposalId: "PROP-TRAVERSAL",
      traceId: "trace-trav-01",
      tenantId: "t1",
      projectId: "p1",
      planId: "plan-err",
      stepId: "step-err-1",
      agentId: "AGT-11",
      toolId: "file.create_or_modify",
      actionTier: "1",
      fenceToken: 1,
      leasedWriteGlobs: ["**"],
      leasedReadGlobs: ["**"],
      targetRelativePath: "../escape.txt",
      rawInput: { relativePath: "../escape.txt", content: "malicious" },
      rationale: "Test sandbox traversal block",
    });
    const travRes = runtime.executeStagedProposal("PROP-TRAVERSAL");
    expect(travRes.ok).toBe(false);
    expect(travRes.error?.category).toBe("SANDBOX_VIOLATION");

    // 2. AGT-19 (Independent Verification Agent) attempting a write tool -> AGENT_TOOL_PERMISSION_DENIED
    runtime.stageToolProposal({
      proposalId: "PROP-AGT19-WRITE",
      traceId: "trace-agt19-01",
      tenantId: "t1",
      projectId: "p1",
      planId: "plan-err",
      stepId: "step-err-2",
      agentId: "AGT-19",
      toolId: "file.create_or_modify",
      actionTier: "1",
      fenceToken: 2,
      leasedWriteGlobs: ["src/**"],
      leasedReadGlobs: ["**"],
      targetRelativePath: "src/illegal.ts",
      rawInput: { relativePath: "src/illegal.ts", content: "illegal" },
      rationale: "Test AGT-19 read-only separation of duty",
    });
    const agt19Res = runtime.executeStagedProposal("PROP-AGT19-WRITE");
    expect(agt19Res.ok).toBe(false);
    expect(agt19Res.error?.errorCode).toBe("AGENT_TOOL_PERMISSION_DENIED");

    // 3. Automatic Checkpoint Rollback when code.generate detects forbidden C++20 real-time allocations
    runtime.stageToolProposal({
      proposalId: "PROP-BASELINE-CPP",
      traceId: "trace-cpp-1",
      tenantId: "t1",
      projectId: "p1",
      planId: "plan-err",
      stepId: "step-err-3",
      agentId: "AGT-08",
      toolId: "file.create_or_modify",
      actionTier: "1",
      fenceToken: 3,
      leasedWriteGlobs: ["dsp/**"],
      leasedReadGlobs: ["**"],
      targetRelativePath: "dsp/Core.cpp",
      rawInput: { relativePath: "dsp/Core.cpp", content: "// Known-good baseline v1\n" },
      rationale: "Write known-good baseline before faulty codegen",
    });
    expect(runtime.executeStagedProposal("PROP-BASELINE-CPP").ok).toBe(true);

    // Attempt faulty code.generate with forbidden `malloc` and `std::mutex` on the same path
    runtime.stageToolProposal({
      proposalId: "PROP-FAULTY-CPP",
      traceId: "trace-cpp-2",
      tenantId: "t1",
      projectId: "p1",
      planId: "plan-err",
      stepId: "step-err-4",
      agentId: "AGT-08",
      toolId: "code.generate",
      actionTier: "1",
      fenceToken: 4,
      leasedWriteGlobs: ["dsp/**"],
      leasedReadGlobs: ["**"],
      targetRelativePath: "dsp/Core.cpp",
      rawInput: {
        targetRelativePath: "dsp/Core.cpp",
        language: "CPP20",
        moduleName: "Core",
        interfaceContractId: "IC-DSP-01",
        sourceCode: "void process() { void* p = malloc(64); std::mutex m; }\n",
      },
      rationale: "Test automatic rollback on C++20 real-time safety violation",
    });

    const faultyRes = runtime.executeStagedProposal("PROP-FAULTY-CPP");
    expect(faultyRes.ok).toBe(false);
    expect(faultyRes.rolledBackFromCheckpoint).toBe(true);
    expect(faultyRes.error?.category).toBe("RECOVERY_ROLLBACK_TRIGGERED");
    // Verify the original baseline content was preserved/restored from checkpoint!
    expect(readFileSync(join(sandboxDir, "dsp/Core.cpp"), "utf8")).toBe("// Known-good baseline v1\n");
  });
});
