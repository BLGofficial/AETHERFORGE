import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  formatRequirementCoverageMarkdown,
  QualityAssuranceFramework,
} from "../src/index.ts";

const qa = new QualityAssuranceFramework(process.cwd());
const report = qa.executeFullPlatformVerification();
const ledgerRecords = qa.getVerificationEngine().getEvidenceRegistry().listRecords();

const covDir = resolve(process.cwd(), "REQUIREMENT_COVERAGE_REPORT");
const evidDir = resolve(process.cwd(), "EVIDENCE_REGISTRY");
mkdirSync(covDir, { recursive: true });
mkdirSync(evidDir, { recursive: true });

writeFileSync(
  resolve(covDir, "requirement-coverage-report.json"),
  JSON.stringify(report, null, 2) + "\n",
  "utf8"
);
writeFileSync(
  resolve(covDir, "requirement-coverage-matrix.md"),
  formatRequirementCoverageMarkdown(report),
  "utf8"
);
writeFileSync(
  resolve(evidDir, "verified-evidence-ledger.json"),
  JSON.stringify(
    {
      schemaVersion: "1.0.0",
      verifierAgentId: "AGT-19",
      totalRecords: ledgerRecords.length,
      headHash: report.evidenceLedgerHeadHash,
      records: ledgerRecords,
    },
    null,
    2
  ) + "\n",
  "utf8"
);

console.log(
  `Generated QA Coverage & Evidence Ledger: requirements=${report.totalRequirementsEvaluated} passed=${report.passedRequirementsCount} headHash=${report.evidenceLedgerHeadHash.slice(0, 16)}`
);
