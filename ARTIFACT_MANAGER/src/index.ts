import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { type SpecialistAgentId } from "../../SPECIFICATION_SCHEMAS/compiler-schemas.ts";
import { type EngineeringToolId } from "../../TOOL_GATEWAY/src/tool-schemas.ts";

export interface ManagedArtifactRecord {
  artifactId: string;
  tenantId: string;
  projectId: string;
  planId: string;
  stepId: string;
  producerAgentId: SpecialistAgentId;
  producerToolId: EngineeringToolId;
  fenceToken: number;
  canonicalPath: string;
  sha256: string;
  bytes: number;
  createdAt: string;
}

function computeBufferSha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex").toUpperCase();
}

export class EngineeringArtifactManager {
  private readonly artifacts = new Map<string, ManagedArtifactRecord>();
  private counter = 0;

  public registerDiskArtifact(params: {
    tenantId: string;
    projectId: string;
    planId: string;
    stepId: string;
    producerAgentId: SpecialistAgentId;
    producerToolId: EngineeringToolId;
    fenceToken: number;
    canonicalPath: string;
  }): ManagedArtifactRecord {
    if (!existsSync(params.canonicalPath)) {
      throw new Error(`ARTIFACT_FILE_MISSING_ON_DISK: ${params.canonicalPath}`);
    }
    const buf = readFileSync(params.canonicalPath);
    const sha256 = computeBufferSha256(buf);
    this.counter += 1;
    const artifactId = `ART-${String(this.counter).padStart(5, "0")}-${sha256.slice(0, 12)}`;

    const record: ManagedArtifactRecord = {
      artifactId,
      tenantId: params.tenantId,
      projectId: params.projectId,
      planId: params.planId,
      stepId: params.stepId,
      producerAgentId: params.producerAgentId,
      producerToolId: params.producerToolId,
      fenceToken: params.fenceToken,
      canonicalPath: params.canonicalPath,
      sha256,
      bytes: buf.byteLength,
      createdAt: new Date().toISOString(),
    };

    this.artifacts.set(artifactId, record);
    return record;
  }

  public verifyArtifactIntegrity(artifactId: string): { valid: boolean; reason?: string } {
    const rec = this.artifacts.get(artifactId);
    if (!rec) {
      return { valid: false, reason: `Artifact ${artifactId} not found in registry.` };
    }
    if (!existsSync(rec.canonicalPath)) {
      return { valid: false, reason: `Artifact file missing on disk: ${rec.canonicalPath}` };
    }
    const actualSha256 = computeBufferSha256(readFileSync(rec.canonicalPath));
    if (actualSha256 !== rec.sha256) {
      return {
        valid: false,
        reason: `Artifact SHA-256 mismatch: expected=${rec.sha256} actual=${actualSha256}`,
      };
    }
    return { valid: true };
  }

  public listArtifactsByPlan(planId: string): ManagedArtifactRecord[] {
    return Array.from(this.artifacts.values()).filter((a) => a.planId === planId);
  }
}
