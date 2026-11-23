import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { SpecialistAgentIdSchema } from "../../SPECIFICATION_SCHEMAS/compiler-schemas.ts";

/**
 * AETHER FORGE — CRYPTOGRAPHIC EVIDENCE REGISTRY (ARCH-07)
 * Verifies live on-disk SHA-256 hashes of implementation, test, and attestation artifacts
 * and maintains a hash-chained evidence ledger.
 */

export const VerificationDisciplineSchema = z.enum([
  "REQUIREMENT_COVERAGE_ANALYSIS",
  "UNIT_TESTING",
  "INTEGRATION_TESTING",
  "END_TO_END_TESTING",
  "STATIC_ANALYSIS",
  "SECURITY_ANALYSIS",
  "PERFORMANCE_TESTING",
  "AGENT_BEHAVIOR_EVALUATION",
  "WORKFLOW_CORRECTNESS_TESTING",
  "AUDIO_QUALITY_TESTING",
  "VST3_COMPATIBILITY_TESTING",
  "REGRESSION_TESTING",
]);
export type VerificationDiscipline = z.infer<typeof VerificationDisciplineSchema>;

export const EvidenceArtifactRecordSchema = z.object({
  evidenceId: z.string().regex(/^EVID-\d{4}$/),
  requirementIds: z.array(z.string().regex(/^REQ-(F|NF)-\d{4}$/)).min(1),
  discipline: VerificationDisciplineSchema,
  implementingAgentId: SpecialistAgentIdSchema,
  verifierAgentId: z.literal("AGT-19"),
  relativeArtifactPath: z.string().min(1),
  relativeTestFilePath: z.string().min(1),
  artifactBytes: z.number().int().positive(),
  artifactDiskSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  testFileDiskSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  oracleMeasurementSummary: z.string().min(1),
  prevLedgerHash: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  ledgerEntryHash: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  verifiedAt: z.string().datetime(),
});
export type EvidenceArtifactRecord = z.infer<typeof EvidenceArtifactRecordSchema>;

const GENESIS_EVIDENCE_HASH = "0".repeat(64);

export function sha256BufferOrString(payload: Buffer | string): string {
  return createHash("sha256").update(payload).digest("hex").toUpperCase();
}

export class CryptographicEvidenceRegistry {
  private readonly workspaceRoot: string;
  private readonly records: EvidenceArtifactRecord[] = [];
  private headHash = GENESIS_EVIDENCE_HASH;

  public constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = resolve(workspaceRoot);
  }

  public registerAndVerifyDiskEvidence(params: {
    requirementIds: string[];
    discipline: VerificationDiscipline;
    implementingAgentId: z.infer<typeof SpecialistAgentIdSchema>;
    verifierAgentId: z.infer<typeof SpecialistAgentIdSchema>;
    relativeArtifactPath: string;
    relativeTestFilePath: string;
    oracleMeasurementSummary: string;
  }): EvidenceArtifactRecord {
    if (params.verifierAgentId !== "AGT-19") {
      throw new Error(
        `INDEPENDENT_VERIFICATION_SEPARATION_OF_DUTY_VIOLATION: Only AGT-19 can register verified evidence (got ${params.verifierAgentId}).`
      );
    }
    if (params.implementingAgentId === params.verifierAgentId) {
      throw new Error(
        `INDEPENDENT_VERIFICATION_SEPARATION_OF_DUTY_VIOLATION: Implementing agent (${params.implementingAgentId}) cannot verify its own evidence.`
      );
    }

    const fullArtifactPath = resolve(this.workspaceRoot, params.relativeArtifactPath);
    const fullTestPath = resolve(this.workspaceRoot, params.relativeTestFilePath);

    if (!existsSync(fullArtifactPath)) {
      throw new Error(`EVIDENCE_ARTIFACT_MISSING_ON_DISK: ${params.relativeArtifactPath}`);
    }
    if (!existsSync(fullTestPath)) {
      throw new Error(`EVIDENCE_TEST_FILE_MISSING_ON_DISK: ${params.relativeTestFilePath}`);
    }

    const artifactStat = statSync(fullArtifactPath);
    if (artifactStat.size === 0) {
      throw new Error(`EVIDENCE_ARTIFACT_EMPTY_FILE: ${params.relativeArtifactPath}`);
    }

    const artifactDiskSha256 = sha256BufferOrString(readFileSync(fullArtifactPath));
    const testFileDiskSha256 = sha256BufferOrString(readFileSync(fullTestPath));

    const evidenceId = `EVID-${String(this.records.length + 1).padStart(4, "0")}`;
    const prevLedgerHash = this.headHash;
    const verifiedAt = "2026-11-23T02:40:00.000Z";

    const canonical = JSON.stringify({
      evidenceId,
      requirementIds: params.requirementIds,
      discipline: params.discipline,
      implementingAgentId: params.implementingAgentId,
      verifierAgentId: "AGT-19",
      relativeArtifactPath: params.relativeArtifactPath,
      relativeTestFilePath: params.relativeTestFilePath,
      artifactBytes: artifactStat.size,
      artifactDiskSha256,
      testFileDiskSha256,
      oracleMeasurementSummary: params.oracleMeasurementSummary,
      prevLedgerHash,
    });

    const ledgerEntryHash = sha256BufferOrString(canonical);
    const record = EvidenceArtifactRecordSchema.parse({
      evidenceId,
      requirementIds: params.requirementIds,
      discipline: params.discipline,
      implementingAgentId: params.implementingAgentId,
      verifierAgentId: "AGT-19",
      relativeArtifactPath: params.relativeArtifactPath,
      relativeTestFilePath: params.relativeTestFilePath,
      artifactBytes: artifactStat.size,
      artifactDiskSha256,
      testFileDiskSha256,
      oracleMeasurementSummary: params.oracleMeasurementSummary,
      prevLedgerHash,
      ledgerEntryHash,
      verifiedAt,
    });

    this.records.push(record);
    this.headHash = ledgerEntryHash;
    return record;
  }

  public verifyLedgerAndLiveDiskIntegrity(): {
    valid: boolean;
    totalEvidenceRecords: number;
    headHash: string;
    failures: string[];
  } {
    let prev = GENESIS_EVIDENCE_HASH;
    const failures: string[] = [];

    for (let i = 0; i < this.records.length; i++) {
      const rec = this.records[i]!;
      const fullArt = resolve(this.workspaceRoot, rec.relativeArtifactPath);
      const fullTest = resolve(this.workspaceRoot, rec.relativeTestFilePath);

      if (!existsSync(fullArt)) {
        failures.push(`Missing artifact on disk: ${rec.relativeArtifactPath}`);
        continue;
      }
      if (!existsSync(fullTest)) {
        failures.push(`Missing test file on disk: ${rec.relativeTestFilePath}`);
        continue;
      }

      const liveArtHash = sha256BufferOrString(readFileSync(fullArt));
      const liveTestHash = sha256BufferOrString(readFileSync(fullTest));
      if (liveArtHash !== rec.artifactDiskSha256) {
        failures.push(`Artifact hash drift on ${rec.relativeArtifactPath}`);
      }
      if (liveTestHash !== rec.testFileDiskSha256) {
        failures.push(`Test file hash drift on ${rec.relativeTestFilePath}`);
      }

      const expectedHash = sha256BufferOrString(
        JSON.stringify({
          evidenceId: rec.evidenceId,
          requirementIds: rec.requirementIds,
          discipline: rec.discipline,
          implementingAgentId: rec.implementingAgentId,
          verifierAgentId: "AGT-19",
          relativeArtifactPath: rec.relativeArtifactPath,
          relativeTestFilePath: rec.relativeTestFilePath,
          artifactBytes: rec.artifactBytes,
          artifactDiskSha256: rec.artifactDiskSha256,
          testFileDiskSha256: rec.testFileDiskSha256,
          oracleMeasurementSummary: rec.oracleMeasurementSummary,
          prevLedgerHash: prev,
        })
      );

      if (rec.prevLedgerHash !== prev || rec.ledgerEntryHash !== expectedHash) {
        failures.push(`Ledger hash chain tampered at ${rec.evidenceId}`);
      }
      prev = rec.ledgerEntryHash;
    }

    return {
      valid: failures.length === 0,
      totalEvidenceRecords: this.records.length,
      headHash: this.headHash,
      failures,
    };
  }

  public listRecords(): readonly EvidenceArtifactRecord[] {
    return this.records;
  }
}
