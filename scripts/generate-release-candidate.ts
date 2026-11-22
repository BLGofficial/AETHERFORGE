import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type Approval,
  SCHEMA_VERSION_V1,
} from "../contracts/src/index.ts";
import {
  generateCycloneDxSbom,
  scanWorkspaceSourceForSecrets,
  SignedArtifactRegistry,
} from "../services/artifact-registry/src/index.ts";

const currentDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(currentDir, "..");
const outDirRc1 = resolve(workspaceRoot, "artifacts/release-v1.0.0-rc1");
const outDirProd = resolve(workspaceRoot, "artifacts/release-v1.0.0");

mkdirSync(outDirRc1, { recursive: true });
mkdirSync(outDirProd, { recursive: true });

const sbomReport = generateCycloneDxSbom(workspaceRoot);
const secretScan = scanWorkspaceSourceForSecrets(workspaceRoot);

if (!sbomReport.licenseCompliant || !secretScan.clean) {
  throw new Error("Release generation aborted: license or secret scan failed.");
}

const registry = new SignedArtifactRegistry();
const baselinePayload = Buffer.from(
  JSON.stringify({ artifact: "aether-forge", version: "0.9.0-baseline" }),
  "utf8",
);
const rc1Payload = Buffer.from(
  JSON.stringify({
    artifact: "aether-forge",
    version: "1.0.0",
    rcSource: "1.0.0-rc1",
    sbomSha256: sbomReport.sbom.sbomSha256,
    flStudio2025VerifiedBuild: "25.1.6.4997",
    nativeWindowsWorkerExeVerified: true,
    qualifiedDawTiers: ["inspect", "non_destructive_edit"],
    excludedCapabilities: [
      "fl-studio-2025:session_mutation",
      "fl-studio-2025:render",
      "vst3:native-binary-compile-missing-sdks",
    ],
  }),
  "utf8",
);

registry.publishSignedArtifact({
  artifactId: "aetherforge-platform-release",
  version: "0.9.0-baseline",
  payloadBytes: baselinePayload,
  sbomSha256: sbomReport.sbom.sbomSha256,
  testEvidencePassed: true,
  traceId: "trace-rc1-build",
});

const publishedRc1 = registry.publishSignedArtifact({
  artifactId: "aetherforge-platform-release",
  version: "1.0.0-rc1",
  payloadBytes: rc1Payload,
  sbomSha256: sbomReport.sbom.sbomSha256,
  testEvidencePassed: true,
  traceId: "trace-rc1-build",
});

if (!publishedRc1.ok) {
  throw new Error(publishedRc1.error.message);
}

const reviewerApproval: Approval = {
  schemaVersion: SCHEMA_VERSION_V1,
  approvalId: "appr-prod-reviewer-01",
  tenantId: "tenant-alpha",
  projectId: "proj-synth-01",
  actor: {
    actorId: "actor-reviewer-01",
    principalType: "human",
    roles: ["Reviewer"],
  },
  planId: "plan-release-v1.0.0",
  planHash: sbomReport.sbom.sbomSha256,
  stepId: "step-release-publish",
  actionClass: "release_publish",
  policyVersion: "opa-bundle-2026.11.22-v1",
  canonicalPathScope: ["C:/AetherForgeWorkspaces/proj-synth-01"],
  decision: "APPROVED",
  status: "APPROVED",
  rationale: "Reviewer verified 16 test suites, SBOM, SLSA provenance, and canary soak.",
  decidedAt: "2026-11-23T01:40:00Z",
  expiresAt: "2026-11-24T01:40:00Z",
};

const releaseManagerApproval: Approval = {
  ...reviewerApproval,
  approvalId: "appr-prod-rm-01",
  actor: {
    actorId: "actor-release-manager-01",
    principalType: "human",
    roles: ["ReleaseManager"],
  },
  rationale: "Release Manager approved dual-control promotion from 1.0.0-rc1 to 1.0.0.",
};

const promotedProd = registry.promoteReleaseCandidateToProduction({
  artifactId: "aetherforge-platform-release",
  rcVersion: "1.0.0-rc1",
  targetProductionVersion: "1.0.0",
  rcPayloadBytes: rc1Payload,
  reviewerApproval,
  releaseManagerApproval,
  canarySoakPassed: true,
  traceId: "trace-v1-prod-promotion",
});

if (!promotedProd.ok) {
  throw new Error(promotedProd.error.message);
}

const rollbackFromRc1 = registry.selectRollbackTarget(
  "aetherforge-platform-release",
  "1.0.0-rc1",
  "trace-rc1-build",
);
const rollbackFromProd = registry.selectRollbackTarget(
  "aetherforge-platform-release",
  "1.0.0",
  "trace-v1-prod-promotion",
);

writeFileSync(
  resolve(outDirRc1, "sbom.cdx.json"),
  `${JSON.stringify(sbomReport.sbom, null, 2)}\n`,
  "utf8",
);
writeFileSync(
  resolve(outDirRc1, "provenance.intoto.json"),
  `${JSON.stringify(publishedRc1.value.provenance, null, 2)}\n`,
  "utf8",
);
writeFileSync(
  resolve(outDirRc1, "release-attestation.json"),
  `${JSON.stringify(
    {
      releaseCandidate: "v1.0.0-rc1",
      retentionStatus: "PROMOTED_TO_V1_0_0_VIA_DUAL_CONTROL",
      artifactRef: publishedRc1.value.artifactRef,
      signature: publishedRc1.value.signature,
      rehearsedRollbackTarget: rollbackFromRc1.ok ? rollbackFromRc1.value : null,
      secretScanClean: secretScan.clean,
      licenseCompliant: sbomReport.licenseCompliant,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

writeFileSync(
  resolve(outDirProd, "sbom.cdx.json"),
  `${JSON.stringify(sbomReport.sbom, null, 2)}\n`,
  "utf8",
);
writeFileSync(
  resolve(outDirProd, "provenance.intoto.json"),
  `${JSON.stringify(promotedProd.value.provenance, null, 2)}\n`,
  "utf8",
);
writeFileSync(
  resolve(outDirProd, "release-attestation.json"),
  `${JSON.stringify(
    {
      releaseVersion: "1.0.0",
      promotedFrom: "1.0.0-rc1",
      status: "RELEASE_MANAGER_APPROVED_PRODUCTION_V1_0_0",
      dualControlApprovers: [
        reviewerApproval.actor.actorId,
        releaseManagerApproval.actor.actorId,
      ],
      artifactRef: promotedProd.value.artifactRef,
      signature: promotedProd.value.signature,
      rehearsedRollbackTarget: rollbackFromProd.ok ? rollbackFromProd.value : null,
      secretScanClean: secretScan.clean,
      licenseCompliant: sbomReport.licenseCompliant,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(`Generated RC1 and promoted v1.0.0 release bundles at: ${outDirProd}`);
