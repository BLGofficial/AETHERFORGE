import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ConfigurableOidcVerifier,
  GovernedDomainApiService,
  TenantMembershipRegistry,
} from "@aether-forge/api";
import { synthesizeGoldenPcm16Wav } from "@aether-forge/audio-engine";
import { synthesizeMinimalFlpBuffer } from "@aether-forge/fl-studio-2025";
import { DurableTemporalOrchestrator } from "@aether-forge/orchestration";
import {
  MockWorkerGateway,
  WindowsWorkerHost,
} from "@aether-forge/windows-host";
import { createWebControlPlaneServer } from "./server.ts";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, "../../..");
const localWorkspaceDir = resolve(repoRoot, "local-workspace");

// 1. Seed governed local-workspace directory with golden WAV stem, FL Studio 2025 .flp session, and manifest
mkdirSync(join(localWorkspaceDir, "stems"), { recursive: true });
mkdirSync(join(localWorkspaceDir, "renders"), { recursive: true });
mkdirSync(join(localWorkspaceDir, "sessions"), { recursive: true });
mkdirSync(join(localWorkspaceDir, "backups"), { recursive: true });
mkdirSync(join(localWorkspaceDir, "outputs"), { recursive: true });

writeFileSync(
  join(localWorkspaceDir, "manifest.json"),
  JSON.stringify(
    {
      workspace: "AETHER FORGE Local Workstation Sandbox",
      flStudio2025Target: "25.1.6.4997",
      seededAt: new Date().toISOString(),
    },
    null,
    2,
  ),
  "utf8",
);
writeFileSync(
  join(localWorkspaceDir, "stems", "lead_stem.wav"),
  synthesizeGoldenPcm16Wav({
    sampleRate: 48_000,
    channels: 2,
    frameCount: 24_000,
    frequencyHz: 440,
    peakAmplitudeInt16: 16_384,
  }),
);
writeFileSync(
  join(localWorkspaceDir, "sessions", "fl2025_demo.flp"),
  synthesizeMinimalFlpBuffer({
    channelCount: 8,
    ppq: 96,
  }),
);

// 2. Initialize OIDC seam, Tenant Membership, Domain API, Temporal Orchestrator, and Enrolled Windows Worker
const oidcVerifier = new ConfigurableOidcVerifier();
const membershipRegistry = new TenantMembershipRegistry();

oidcVerifier.registerToken("token-alpha-builder", {
  sub: "actor-builder-01",
  tenantId: "tenant-alpha",
  roles: ["Builder"],
  projectIds: ["proj-synth-01"],
  expUnixSeconds: 4_000_000_000,
});
membershipRegistry.registerMember({
  tenantId: "tenant-alpha",
  actorId: "actor-builder-01",
  roles: ["Builder"],
  projectIds: ["proj-synth-01"],
});

oidcVerifier.registerToken("token-alpha-owner", {
  sub: "actor-owner-01",
  tenantId: "tenant-alpha",
  roles: ["Owner"],
  projectIds: ["proj-synth-01"],
  expUnixSeconds: 4_000_000_000,
});
membershipRegistry.registerMember({
  tenantId: "tenant-alpha",
  actorId: "actor-owner-01",
  roles: ["Owner"],
  projectIds: ["proj-synth-01"],
});

const api = new GovernedDomainApiService({ oidcVerifier, membershipRegistry });
const orchestrator = new DurableTemporalOrchestrator(api);
const workerGateway = new MockWorkerGateway();
const workerHost = new WindowsWorkerHost(workerGateway);

workerHost.enrollAndConnect({
  workerId: "worker-win11-local",
  tenantId: "tenant-alpha",
  machineThumbprint: "thumb-local-win11",
});
workerHost.sendHeartbeat();

const port = Number(process.env["PORT"] ?? 4100);
const { server } = createWebControlPlaneServer({
  api,
  orchestrator,
  defaultTenantId: "tenant-alpha",
  defaultProjectId: "proj-synth-01",
  defaultBearerToken: "token-alpha-builder",
  ownerBearerToken: "token-alpha-owner",
  localWorker: {
    workerHost,
    workerGateway,
    workerId: "worker-win11-local",
    localWorkspaceDir,
  },
});

server.listen(port, "127.0.0.1", () => {
  console.log(`AETHER FORGE Web Control Plane listening at http://127.0.0.1:${port}`);
  console.log(`Seeded local workspace root: ${localWorkspaceDir}`);
  console.log(
    `FL Studio 2025 probe: ${JSON.stringify(workerHost.dawAdapter.probeInstallation())}`,
  );
});
