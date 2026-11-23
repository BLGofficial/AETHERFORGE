import { describe, expect, it } from "vitest";
import { IndependentVerificationEngine } from "../../VERIFICATION_ENGINE/src/index.ts";
import { QualityAssuranceFramework } from "../src/index.ts";

describe("AETHER FORGE Independent Verification & 12-Discipline QA System (ARCH-07 / AGT-19)", () => {
  it("enforces Separation of Duty (implementingAgentId !== verifierAgentId && verifierAgentId === AGT-19)", () => {
    const engine = new IndependentVerificationEngine();

    // 1. Implementing agent (AGT-08) attempts to verify its own feature -> MUST throw
    expect(() =>
      engine.verifyRequirementClaim({
        requirementId: "REQ-F-0801",
        title: "Self-Verification Attempt by Implementing Agent",
        implementingAgentId: "AGT-08",
        verifierAgentId: "AGT-08",
        claimBasis: "INDEPENDENT_EXECUTABLE_ORACLE_AND_DISK_EVIDENCE",
        expectedBehavior: "Zero heap allocations",
        disciplines: ["UNIT_TESTING"],
        oracleRule: "allocs === 0",
        relativeArtifactPath: "DSP_ENGINE/src/index.ts",
        relativeTestFilePath: "AUDIO_TEST_FRAMEWORK/tests/audio-domain.test.ts",
        independentTestExitCode: 0,
        assertionsPassed: 5,
        assertionsFailed: 0,
        measuredSummary: "Self-verified",
        knownLimitations: ["None"],
      })
    ).toThrow(/INDEPENDENT_VERIFICATION_SEPARATION_OF_DUTY_VIOLATION/);

    // 2. AGT-19 attempts to verify an artifact where AGT-19 is listed as the implementing agent -> MUST throw
    expect(() =>
      engine.verifyRequirementClaim({
        requirementId: "REQ-F-0802",
        title: "AGT-19 Authoring and Self-Verifying Conflict",
        implementingAgentId: "AGT-19",
        verifierAgentId: "AGT-19",
        claimBasis: "INDEPENDENT_EXECUTABLE_ORACLE_AND_DISK_EVIDENCE",
        expectedBehavior: "Read-only verification",
        disciplines: ["UNIT_TESTING"],
        oracleRule: "pass === true",
        relativeArtifactPath: "DSP_ENGINE/src/index.ts",
        relativeTestFilePath: "AUDIO_TEST_FRAMEWORK/tests/audio-domain.test.ts",
        independentTestExitCode: 0,
        assertionsPassed: 5,
        assertionsFailed: 0,
        measuredSummary: "Self-verified by AGT-19",
        knownLimitations: ["None"],
      })
    ).toThrow(/INDEPENDENT_VERIFICATION_SEPARATION_OF_DUTY_VIOLATION/);
  });

  it("never marks functionality complete based only on generated code, successful compilation, or an agent's self-report, and rejects fabricated disk SHA-256 hashes", () => {
    const engine = new IndependentVerificationEngine();

    for (const insufficientBasis of [
      "CODE_GENERATED_ONLY",
      "COMPILATION_SUCCEEDED_ONLY",
      "AGENT_SELF_REPORT_ONLY",
    ] as const) {
      expect(() =>
        engine.verifyRequirementClaim({
          requirementId: "REQ-F-0803",
          title: `Insufficient Basis (${insufficientBasis})`,
          implementingAgentId: "AGT-11",
          verifierAgentId: "AGT-19",
          claimBasis: insufficientBasis,
          expectedBehavior: "API endpoint responds with 200",
          disciplines: ["UNIT_TESTING"],
          oracleRule: "status === 200",
          relativeArtifactPath: "DSP_ENGINE/src/index.ts",
          relativeTestFilePath: "AUDIO_TEST_FRAMEWORK/tests/audio-domain.test.ts",
          independentTestExitCode: 0,
          assertionsPassed: 1,
          assertionsFailed: 0,
          measuredSummary: "Compiled or self-reported only",
          knownLimitations: ["None"],
        })
      ).toThrow(/REJECTED_INSUFFICIENT_VERIFICATION_BASIS/);
    }

    // Fabricated artifact SHA-256 hash mismatch -> MUST throw FABRICATED_ARTIFACT_HASH_MISMATCH
    expect(() =>
      engine.verifyRequirementClaim({
        requirementId: "REQ-F-0804",
        title: "Fabricated Artifact Hash Claim",
        implementingAgentId: "AGT-11",
        verifierAgentId: "AGT-19",
        claimBasis: "INDEPENDENT_EXECUTABLE_ORACLE_AND_DISK_EVIDENCE",
        expectedBehavior: "Verify live disk SHA-256",
        disciplines: ["SECURITY_ANALYSIS"],
        oracleRule: "diskSha256 === claimedSha256",
        relativeArtifactPath: "DSP_ENGINE/src/index.ts",
        relativeTestFilePath: "AUDIO_TEST_FRAMEWORK/tests/audio-domain.test.ts",
        claimedArtifactSha256: "F".repeat(64),
        independentTestExitCode: 0,
        assertionsPassed: 3,
        assertionsFailed: 0,
        measuredSummary: "Agent submitted fake hash",
        knownLimitations: ["None"],
      })
    ).toThrow(/FABRICATED_ARTIFACT_HASH_MISMATCH/);
  });

  it("executes all 12 QA disciplines across the platform, verifies 100% requirement coverage, and validates the hash-chained cryptographic evidence registry", () => {
    const qa = new QualityAssuranceFramework(process.cwd());
    const report = qa.executeFullPlatformVerification();

    expect(report.verifierAgentId).toBe("AGT-19");
    expect(report.allTwelveDisciplinesPassed).toBe(true);
    expect(report.disciplineVerdicts).toHaveLength(12);
    expect(report.coverageRate).toBe(1);
    expect(report.failedRequirementsCount).toBe(0);
    expect(report.requirementRecords.length).toBeGreaterThanOrEqual(9);

    // Verify every single requirement record has all 6 mandatory fields populated and valid disk SHA-256 hashes
    for (const rec of report.requirementRecords) {
      expect(rec.implementingAgentId).not.toBe(rec.verifierAgentId);
      expect(rec.expectedBehavior.length).toBeGreaterThan(10);
      expect(rec.verificationMethod.disciplines.length).toBeGreaterThanOrEqual(1);
      expect(rec.testResult.independentExecutionExitCode).toBe(0);
      expect(rec.evidenceArtifact.artifactDiskSha256).toMatch(/^[A-F0-9]{64}$/);
      expect(rec.passFailStatus).toBe("PASS");
      expect(rec.knownLimitations.length).toBeGreaterThanOrEqual(1);
    }

    const ledgerCheck = qa
      .getVerificationEngine()
      .getEvidenceRegistry()
      .verifyLedgerAndLiveDiskIntegrity();
    expect(ledgerCheck.valid).toBe(true);
    expect(ledgerCheck.totalEvidenceRecords).toBe(report.requirementRecords.length);
  });
});
