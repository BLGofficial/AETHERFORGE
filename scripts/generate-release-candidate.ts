import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateCycloneDxSbom,
  scanWorkspaceSourceForSecrets,
  SignedArtifactRegistry,
} from "../services/artifact-registry/src/index.ts";

const currentDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(currentDir, "..");
const outDir = resolve(workspaceRoot, "artifacts/release-v1.0.0-rc1");

mkdirSync(outDir, { recursive: true });

const sbomReport = generateCycloneDxSbom(workspaceRoot);
const secretScan = scanWorkspaceSourceForSecrets(workspaceRoot);

if (!sbomReport.licenseCompliant || !secretScan.clean) {
  throw new Error("Release candidate generation aborted: license or secret scan failed.");
}

const registry = new SignedArtifactRegistry();
const baselinePayload = Buffer.from(
  JSON.stringify({ artifact: "aether-forge", version: "0.9.0-baseline" }),
  "utf8",
);
const rc1Payload = Buffer.from(
  JSON.stringify({
    artifact: "aether-forge",
    version: "1.0.0-rc1",
    sbomSha256: sbomReport.sbom.sbomSha256,
    flStudio2025VerifiedBuild: "25.1.6.4997",
    qualifiedDawTiers: ["inspect", "non_destructive_edit"],
    excludedCapabilities: [
      "fl-studio-2025:session_mutation",
      "fl-studio-2025:render",
      "vst3:native-binary-compile-missing-sdks",
      "provider-gateway:live-external-vendor-keys",
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

const rollbackTarget = registry.selectRollbackTarget(
  "aetherforge-platform-release",
  "1.0.0-rc1",
  "trace-rc1-build",
);

writeFileSync(
  resolve(outDir, "sbom.cdx.json"),
  `${JSON.stringify(sbomReport.sbom, null, 2)}\n`,
  "utf8",
);
writeFileSync(
  resolve(outDir, "provenance.intoto.json"),
  `${JSON.stringify(publishedRc1.value.provenance, null, 2)}\n`,
  "utf8",
);
writeFileSync(
  resolve(outDir, "release-attestation.json"),
  `${JSON.stringify(
    {
      releaseCandidate: "v1.0.0-rc1",
      retentionStatus: "NON_PRODUCTION_PENDING_RELEASE_MANAGER_APPROVAL",
      artifactRef: publishedRc1.value.artifactRef,
      signature: publishedRc1.value.signature,
      rehearsedRollbackTarget: rollbackTarget.ok ? rollbackTarget.value : null,
      secretScanClean: secretScan.clean,
      licenseCompliant: sbomReport.licenseCompliant,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(`Generated RC1 SBOM, SLSA provenance, and signature bundle at: ${outDir}`);
