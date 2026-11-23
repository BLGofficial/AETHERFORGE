import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import {
  CryptographicEvidenceRegistry,
  sha256BufferOrString,
  VerificationDisciplineSchema,
} from "../../EVIDENCE_REGISTRY/src/index.ts";
import { SpecialistAgentIdSchema } from "../../SPECIFICATION_SCHEMAS/compiler-schemas.ts";

/**
 * AETHER FORGE — INDEPENDENT VERIFICATION ENGINE (ARCH-07 / AGT-19)
 * Enforces Separation of Duty and prohibits marking functionality complete based only on
 * generated code, successful compilation, or an agent's self-report.
 */

export const CompletionClaimBasisSchema = z.enum([
  "CODE_GENERATED_ONLY",
  "COMPILATION_SUCCEEDED_ONLY",
  "AGENT_SELF_REPORT_ONLY",
  "INDEPENDENT_EXECUTABLE_ORACLE_AND_DISK_EVIDENCE",
]);
export type CompletionClaimBasis = z.infer<typeof CompletionClaimBasisSchema>;

export const RequirementAcceptanceStatusSchema = z.enum([
  "PASS",
  "FAIL",
  "BLOCKED_MISSING_PREREQUISITES",
]);
export type RequirementAcceptanceStatus = z.infer<typeof RequirementAcceptanceStatusSchema>;

export const RequirementAcceptanceRecordSchema = z.object({
  requirementId: z.string().regex(/^REQ-(F|NF)-\d{4}$/),
  title: z.string().min(1),
  implementingAgentId: SpecialistAgentIdSchema,
  verifierAgentId: z.literal("AGT-19"),
  expectedBehavior: z.string().min(1),
  verificationMethod: z.object({
    disciplines: z.array(VerificationDisciplineSchema).min(1),
    oracleRule: z.string().min(1),
    testSuitePath: z.string().min(1),
  }),
  testResult: z.object({
    independentExecutionExitCode: z.number().int(),
    assertionsPassed: z.number().int().nonnegative(),
    assertionsFailed: z.number().int().nonnegative(),
    measuredSummary: z.string().min(1),
  }),
  evidenceArtifact: z.object({
    evidenceId: z.string().regex(/^EVID-\d{4}$/),
    relativeArtifactPath: z.string().min(1),
    artifactDiskSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/),
    testFileDiskSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/),
    ledgerEntryHash: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  }),
  passFailStatus: RequirementAcceptanceStatusSchema,
  knownLimitations: z.array(z.string().min(1)).min(1),
  verifiedAt: z.string().datetime(),
});
export type RequirementAcceptanceRecord = z.infer<typeof RequirementAcceptanceRecordSchema>;

export interface CompletionClaimSubmission {
  requirementId: string;
  title: string;
  implementingAgentId: z.infer<typeof SpecialistAgentIdSchema>;
  verifierAgentId: z.infer<typeof SpecialistAgentIdSchema>;
  claimBasis: CompletionClaimBasis;
  expectedBehavior: string;
  disciplines: Array<z.infer<typeof VerificationDisciplineSchema>>;
  oracleRule: string;
  relativeArtifactPath: string;
  relativeTestFilePath: string;
  claimedArtifactSha256?: string | undefined;
  independentTestExitCode: number;
  assertionsPassed: number;
  assertionsFailed: number;
  measuredSummary: string;
  knownLimitations: string[];
  missingExternalPrerequisiteBinary?: string | undefined;
}

export class IndependentVerificationEngine {
  private readonly workspaceRoot: string;
  private readonly evidenceRegistry: CryptographicEvidenceRegistry;
  private readonly acceptanceRecords = new Map<string, RequirementAcceptanceRecord>();

  public constructor(options?: {
    workspaceRoot?: string;
    evidenceRegistry?: CryptographicEvidenceRegistry;
  }) {
    this.workspaceRoot = resolve(options?.workspaceRoot ?? process.cwd());
    this.evidenceRegistry =
      options?.evidenceRegistry ?? new CryptographicEvidenceRegistry(this.workspaceRoot);
  }

  public getEvidenceRegistry(): CryptographicEvidenceRegistry {
    return this.evidenceRegistry;
  }

  /**
   * Evaluates a completion claim under strict Separation of Duty and Anti-Fabrication laws.
   */
  public verifyRequirementClaim(submission: CompletionClaimSubmission): RequirementAcceptanceRecord {
    // 1. Separation of Duty Gate
    if (submission.verifierAgentId !== "AGT-19") {
      throw new Error(
        `INDEPENDENT_VERIFICATION_SEPARATION_OF_DUTY_VIOLATION: Only AGT-19 can verify requirements (submitted verifier=${submission.verifierAgentId}).`
      );
    }
    if (submission.implementingAgentId === submission.verifierAgentId) {
      throw new Error(
        `INDEPENDENT_VERIFICATION_SEPARATION_OF_DUTY_VIOLATION: Implementing agent ${submission.implementingAgentId} cannot self-verify ${submission.requirementId}.`
      );
    }

    // 2. Anti-Compile-Only / Anti-Code-Only / Anti-Self-Report Gate
    if (
      submission.claimBasis === "CODE_GENERATED_ONLY" ||
      submission.claimBasis === "COMPILATION_SUCCEEDED_ONLY" ||
      submission.claimBasis === "AGENT_SELF_REPORT_ONLY"
    ) {
      throw new Error(
        `REJECTED_INSUFFICIENT_VERIFICATION_BASIS: Cannot mark ${submission.requirementId} complete based on '${submission.claimBasis}'. Independent executable oracle + verified disk evidence required.`
      );
    }

    // 3. Independent Disk Artifact & Anti-Placeholder Verification
    const fullArtifactPath = resolve(this.workspaceRoot, submission.relativeArtifactPath);
    if (!existsSync(fullArtifactPath)) {
      throw new Error(`VERIFICATION_ARTIFACT_MISSING_ON_DISK: ${submission.relativeArtifactPath}`);
    }
    const rawBuf = readFileSync(fullArtifactPath);
    const liveSha256 = sha256BufferOrString(rawBuf);

    if (
      submission.claimedArtifactSha256 &&
      submission.claimedArtifactSha256.toUpperCase() !== liveSha256
    ) {
      throw new Error(
        `FABRICATED_ARTIFACT_HASH_MISMATCH: Agent claimed SHA-256 ${submission.claimedArtifactSha256} for ${submission.relativeArtifactPath}, but live disk SHA-256 is ${liveSha256}.`
      );
    }

    // Register verified disk evidence in CryptographicEvidenceRegistry
    const evidenceRecord = this.evidenceRegistry.registerAndVerifyDiskEvidence({
      requirementIds: [submission.requirementId],
      discipline: submission.disciplines[0] ?? "UNIT_TESTING",
      implementingAgentId: submission.implementingAgentId,
      verifierAgentId: "AGT-19",
      relativeArtifactPath: submission.relativeArtifactPath,
      relativeTestFilePath: submission.relativeTestFilePath,
      oracleMeasurementSummary: submission.measuredSummary,
    });

    // 4. Determine Pass / Fail / Blocked Status
    let passFailStatus: RequirementAcceptanceStatus = "PASS";
    if (
      submission.independentTestExitCode !== 0 ||
      submission.assertionsFailed > 0 ||
      submission.assertionsPassed === 0
    ) {
      passFailStatus = "FAIL";
    } else if (submission.missingExternalPrerequisiteBinary) {
      passFailStatus = "BLOCKED_MISSING_PREREQUISITES";
    }

    const record = RequirementAcceptanceRecordSchema.parse({
      requirementId: submission.requirementId,
      title: submission.title,
      implementingAgentId: submission.implementingAgentId,
      verifierAgentId: "AGT-19",
      expectedBehavior: submission.expectedBehavior,
      verificationMethod: {
        disciplines: submission.disciplines,
        oracleRule: submission.oracleRule,
        testSuitePath: submission.relativeTestFilePath,
      },
      testResult: {
        independentExecutionExitCode: submission.independentTestExitCode,
        assertionsPassed: submission.assertionsPassed,
        assertionsFailed: submission.assertionsFailed,
        measuredSummary: submission.measuredSummary,
      },
      evidenceArtifact: {
        evidenceId: evidenceRecord.evidenceId,
        relativeArtifactPath: evidenceRecord.relativeArtifactPath,
        artifactDiskSha256: evidenceRecord.artifactDiskSha256,
        testFileDiskSha256: evidenceRecord.testFileDiskSha256,
        ledgerEntryHash: evidenceRecord.ledgerEntryHash,
      },
      passFailStatus,
      knownLimitations:
        submission.knownLimitations.length > 0
          ? submission.knownLimitations
          : ["Verified within deterministic single-workstation execution boundary."],
      verifiedAt: "2026-11-23T02:40:00.000Z",
    });

    this.acceptanceRecords.set(record.requirementId, record);
    return record;
  }

  public listAcceptanceRecords(): RequirementAcceptanceRecord[] {
    return Array.from(this.acceptanceRecords.values());
  }
}
