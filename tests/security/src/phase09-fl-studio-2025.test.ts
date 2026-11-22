import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_PLATFORM_CONFIG,
  PlatformConfigSchema,
} from "@aether-forge/config";
import {
  type CapabilityGrant,
  type DawCommand,
  SCHEMA_VERSION_V1,
  type WorkerJob,
} from "@aether-forge/contracts";
import {
  FlStudio2025Adapter,
  QUALIFICATION_DOC_REF,
  synthesizeMinimalFlpBuffer,
} from "@aether-forge/fl-studio-2025";
import { verifyGrantedGitWorkspace } from "@aether-forge/git";
import { formatPolicyDecisionBadgeLabel } from "@aether-forge/ui";
import {
  computeGrantSignature,
  computeJobManifestSignature,
  MockWorkerGateway,
  WindowsWorkerHost,
} from "@aether-forge/windows-host";
import { SAMPLE_SHA256 } from "@aether-forge/test-fixtures";

describe("PHASE 09 — FL Studio 2025 discovery and tiered qualification gate", () => {
  let workspaceDir: string;
  let sampleFlpPath: string;
  let sampleFlpSha256: string;

  beforeEach(() => {
    workspaceDir = mkdtempSync(join(tmpdir(), "aetherforge-p09-fl-"));
    mkdirSync(join(workspaceDir, "sessions"), { recursive: true });
    mkdirSync(join(workspaceDir, "backups"), { recursive: true });
    mkdirSync(join(workspaceDir, "scratch"), { recursive: true });

    const flpBuffer = synthesizeMinimalFlpBuffer({
      formatVersion: 0,
      channelCount: 8,
      ppq: 96,
    });
    sampleFlpPath = join(workspaceDir, "sessions", "synthwave_demo.flp");
    writeFileSync(sampleFlpPath, flpBuffer);
    sampleFlpSha256 = createHash("sha256").update(flpBuffer).digest("hex");
  });

  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true });
  });

  function buildSignedDawWorkerJob(
    gateway: MockWorkerGateway,
    dawCommand: DawCommand,
  ): WorkerJob {
    const actionClass = `daw_${dawCommand.capabilityTier}` as CapabilityGrant["actionClass"];
    const unsignedGrant: Omit<CapabilityGrant, "signature"> = {
      schemaVersion: SCHEMA_VERSION_V1,
      grantId: `grant-${dawCommand.commandId}`,
      tenantId: "tenant-alpha",
      projectId: "proj-synth-01",
      workerId: "worker-win11-daw-01",
      planId: "plan-daw-01",
      planHash: SAMPLE_SHA256,
      stepId: `step-${dawCommand.commandId}`,
      actionClass,
      canonicalPathScope: [workspaceDir],
      policyVersion: "opa-bundle-2026.11.22-v1",
      issuedAt: "2026-11-22T20:00:00Z",
      expiresAt: "2026-11-23T20:00:00Z",
      revoked: false,
    };
    const grant: CapabilityGrant = {
      ...unsignedGrant,
      signature: computeGrantSignature(unsignedGrant, gateway.controlPlaneSigningSecret),
    };

    const unsignedJob: Omit<WorkerJob, "manifestSignature"> = {
      schemaVersion: SCHEMA_VERSION_V1,
      jobId: `job-${dawCommand.commandId}`,
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      idempotencyKey: `idem-${dawCommand.commandId}`,
      stepId: `step-${dawCommand.commandId}`,
      grant,
      payload: {
        kind: "daw_command",
        dawCommand,
      },
    };

    return {
      ...unsignedJob,
      manifestSignature: computeJobManifestSignature(
        unsignedJob,
        gateway.controlPlaneSigningSecret,
      ),
    };
  }

  it("discovers local FL Studio 2025 installation (25.1.6.4997) and advertises only empirically qualified capability tiers (INV-04)", () => {
    const adapter = new FlStudio2025Adapter();
    const installation = adapter.probeInstallation();

    expect(installation.fl64ExePresent).toBe(true);
    expect(installation.flEngineDllPresent).toBe(true);
    expect(installation.verifiedBuildVersion).toBe("25.1.6.4997");

    const discovery = adapter.discoverCapabilities();
    expect(discovery.ok).toBe(true);
    if (!discovery.ok) return;

    const byTier = Object.fromEntries(discovery.value.map((d) => [d.tier, d]));
    expect(byTier["inspect"]?.qualified).toBe(true);
    expect(byTier["inspect"]?.qualificationDocRef).toBe(QUALIFICATION_DOC_REF);
    expect(byTier["non_destructive_edit"]?.qualified).toBe(true);

    // Unqualified tiers must never be advertised as qualified
    expect(byTier["session_mutation"]?.qualified).toBe(false);
    expect(byTier["render"]?.qualified).toBe(false);
  });

  it("executes qualified `inspect` and `non_destructive_edit` (with mandatory backup) through Windows Worker while keeping source .flp immutable", () => {
    const gateway = new MockWorkerGateway();
    const worker = new WindowsWorkerHost(gateway);
    worker.enrollAndConnect({
      workerId: "worker-win11-daw-01",
      tenantId: "tenant-alpha",
      machineThumbprint: "thumb-daw-01",
    });
    const nowMs = Date.parse("2026-11-22T21:00:00Z");

    // 1. Qualified read-only inspect
    const inspectJob = buildSignedDawWorkerJob(gateway, {
      schemaVersion: SCHEMA_VERSION_V1,
      commandId: "daw-inspect-01",
      dawTarget: "fl-studio-2025",
      capabilityTier: "inspect",
      operation: "inspect_version_and_session_header",
      backupRequired: false,
      foregroundUiFallbackOptIn: false,
      parameters: {
        projectRelativePath: "sessions/synthwave_demo.flp",
      },
    });

    const inspectRes = worker.executeJobManifest(inspectJob, { nowMs });
    expect(inspectRes.ok).toBe(true);
    if (inspectRes.ok) {
      expect(inspectRes.value.status).toBe("COMPLETED");
      expect(inspectRes.value.evidence[0]?.producer).toBe("daw-adapter");
      expect(inspectRes.value.evidence[0]?.artifactHash).toBe(sampleFlpSha256);
      expect(inspectRes.value.evidence[0]?.summary).toContain("25.1.6.4997");
      expect(inspectRes.value.evidence[0]?.summary).toContain("8ch, 96 PPQ");
    }

    // 2. Qualified non_destructive_edit with mandatory backup
    const nonDestructiveJob = buildSignedDawWorkerJob(gateway, {
      schemaVersion: SCHEMA_VERSION_V1,
      commandId: "daw-stage-01",
      dawTarget: "fl-studio-2025",
      capabilityTier: "non_destructive_edit",
      operation: "stage_non_destructive_session_copy",
      backupRequired: true,
      foregroundUiFallbackOptIn: false,
      parameters: {
        projectRelativePath: "sessions/synthwave_demo.flp",
        backupRelativePath: "backups/synthwave_demo.flp.bak",
        stagedRelativePath: "scratch/synthwave_demo_staged.flp.b64",
      },
    });

    const stageRes = worker.executeJobManifest(nonDestructiveJob, { nowMs });
    expect(stageRes.ok).toBe(true);
    expect(existsSync(join(workspaceDir, "backups", "synthwave_demo.flp.bak"))).toBe(true);
    expect(existsSync(join(workspaceDir, "scratch", "synthwave_demo_staged.flp.b64"))).toBe(true);

    // Original .flp file never changed
    const currentFlpSha = createHash("sha256")
      .update(readFileSync(sampleFlpPath))
      .digest("hex");
    expect(currentFlpSha).toBe(sampleFlpSha256);
  });

  it("fails closed on unqualified `session_mutation` or `render` tiers, missing backup on `non_destructive_edit`, or UI automation opt-in", () => {
    const adapter = new FlStudio2025Adapter();

    // 1. Unqualified session_mutation fails closed (INV-04)
    const mutateRes = adapter.invoke(
      {
        schemaVersion: SCHEMA_VERSION_V1,
        commandId: "daw-unqualified-mutate",
        dawTarget: "fl-studio-2025",
        capabilityTier: "session_mutation",
        operation: "mutate_mixer_routing",
        backupRequired: true,
        foregroundUiFallbackOptIn: false,
        parameters: { projectRelativePath: "sessions/synthwave_demo.flp" },
      },
      { grantedCanonicalRoots: [workspaceDir], traceId: "trace-daw-neg-1" },
    );
    expect(mutateRes.ok).toBe(false);
    if (!mutateRes.ok) {
      expect(mutateRes.error.code).toBe("DOMAIN_DAW_CAPABILITY_UNQUALIFIED");
      expect(mutateRes.error.category).toBe("DAW_UNQUALIFIED");
    }

    // 2. Unqualified render fails closed (INV-04)
    const renderRes = adapter.invoke(
      {
        schemaVersion: SCHEMA_VERSION_V1,
        commandId: "daw-unqualified-render",
        dawTarget: "fl-studio-2025",
        capabilityTier: "render",
        operation: "headless_cli_render",
        backupRequired: false,
        foregroundUiFallbackOptIn: false,
        parameters: { projectRelativePath: "sessions/synthwave_demo.flp" },
      },
      { grantedCanonicalRoots: [workspaceDir], traceId: "trace-daw-neg-2" },
    );
    expect(renderRes.ok).toBe(false);
    if (!renderRes.ok) {
      expect(renderRes.error.code).toBe("DOMAIN_DAW_CAPABILITY_UNQUALIFIED");
    }

    // 3. UI automation opt-in fails closed without foreground interactive confirmation gate
    const uiAutomationRes = adapter.invoke(
      {
        schemaVersion: SCHEMA_VERSION_V1,
        commandId: "daw-ui-fallback",
        dawTarget: "fl-studio-2025",
        capabilityTier: "inspect",
        operation: "inspect_version_and_session_header",
        backupRequired: false,
        foregroundUiFallbackOptIn: true,
        parameters: { projectRelativePath: "sessions/synthwave_demo.flp" },
      },
      { grantedCanonicalRoots: [workspaceDir], traceId: "trace-daw-neg-3" },
    );
    expect(uiAutomationRes.ok).toBe(false);
    if (!uiAutomationRes.ok) {
      expect(uiAutomationRes.error.code).toBe("DOMAIN_DAW_UI_AUTOMATION_PROHIBITED");
    }

    // 4. non_destructive_edit without backupRequired=true fails closed
    const missingBackupRes = adapter.invoke(
      {
        schemaVersion: SCHEMA_VERSION_V1,
        commandId: "daw-no-backup",
        dawTarget: "fl-studio-2025",
        capabilityTier: "non_destructive_edit",
        operation: "stage_non_destructive_session_copy",
        backupRequired: false,
        foregroundUiFallbackOptIn: false,
        parameters: {
          projectRelativePath: "sessions/synthwave_demo.flp",
          backupRelativePath: "backups/b.bak",
          stagedRelativePath: "scratch/s.flp",
        },
      },
      { grantedCanonicalRoots: [workspaceDir], traceId: "trace-daw-neg-4" },
    );
    expect(missingBackupRes.ok).toBe(false);
    if (!missingBackupRes.ok) {
      expect(missingBackupRes.error.code).toBe("DOMAIN_DAW_BACKUP_REQUIRED");
    }
  });

  it("qualifies real Image-Line factory .flp project files (NewStuff.flp) and verifies @aether-forge/git, @aether-forge/config, and @aether-forge/ui boundaries", () => {
    const adapter = new FlStudio2025Adapter();
    const factoryFlpPath =
      "C:\\Program Files\\Image-Line\\FL Studio 2026\\Data\\Demo projects\\NewStuff.flp";

    if (existsSync(factoryFlpPath)) {
      const localCopyPath = join(workspaceDir, "sessions", "NewStuff.flp");
      copyFileSync(factoryFlpPath, localCopyPath);

      const inspectFactory = adapter.invoke(
        {
          schemaVersion: SCHEMA_VERSION_V1,
          commandId: "daw-factory-newstuff",
          dawTarget: "fl-studio-2025",
          capabilityTier: "inspect",
          operation: "inspect_version_and_session_header",
          backupRequired: false,
          foregroundUiFallbackOptIn: false,
          parameters: { projectRelativePath: "sessions/NewStuff.flp" },
        },
        { grantedCanonicalRoots: [workspaceDir], traceId: "trace-factory-flp" },
      );

      expect(inspectFactory.ok).toBe(true);
      if (inspectFactory.ok) {
        expect(inspectFactory.value.flpHeader.validFlpMagic).toBe(true);
        expect(inspectFactory.value.flpHeader.channelCount).toBe(45);
        expect(inspectFactory.value.flpHeader.ppq).toBe(96);
        expect(inspectFactory.value.flpHeader.dataChunkBytes).toBe(313_334);
        expect(inspectFactory.value.flpHeader.savedByFlVersion).toBeDefined();
      }
    }

    // Verify @aether-forge/git boundary
    const gitValid = verifyGrantedGitWorkspace({
      grantedCanonicalRoots: [workspaceDir],
      repoRelativePath: "sessions",
      traceId: "trace-git-01",
    });
    expect(gitValid.ok).toBe(true);

    const gitEscape = verifyGrantedGitWorkspace({
      grantedCanonicalRoots: [workspaceDir],
      repoRelativePath: "../../outside",
      traceId: "trace-git-02",
    });
    expect(gitEscape.ok).toBe(false);

    // Verify @aether-forge/config and @aether-forge/ui boundaries
    expect(PlatformConfigSchema.parse(DEFAULT_PLATFORM_CONFIG)).toEqual(DEFAULT_PLATFORM_CONFIG);
    expect(formatPolicyDecisionBadgeLabel("requireApproval")).toBe("APPROVAL REQUIRED");
  });
});
