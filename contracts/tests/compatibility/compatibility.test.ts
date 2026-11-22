import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ApprovalSchema,
  ArtifactRefSchema,
  AudioJobSchema,
  AuditEventSchema,
  BriefSchema,
  BriefSubmittedEventSchema,
  buildJsonSchemaCatalog,
  buildOpenApiSpec,
  CapabilityGrantSchema,
  computeCanonicalPlanHash,
  createResultSchema,
  DawCommandSchema,
  DomainErrorSchema,
  EvidenceRefSchema,
  ExecutionPlanSchema,
  PlanStepSchema,
  ProductSpecSchema,
  RequestContextSchema,
  SpecRefSchema,
  ToolManifestSchema,
  WorkerJobSchema,
} from "../../src/index.ts";
import {
  SAMPLE_SHA256,
  sampleApproval,
  sampleArtifactRef,
  sampleAudioJob,
  sampleAuditEvent,
  sampleBrief,
  sampleBriefSubmittedCloudEvent,
  sampleCapabilityGrant,
  sampleDawCommand,
  sampleDomainError,
  sampleEvidenceRef,
  sampleExecutionPlan,
  samplePlanSteps,
  sampleProductSpec,
  sampleRequestContext,
  sampleToolManifest,
  sampleWorkerJob,
} from "./fixtures.ts";

describe("@aether-forge/contracts v1.0.0 schema validation & compatibility gate", () => {
  it("validates all canonical domain, tool, worker, and CloudEvents fixtures", () => {
    expect(RequestContextSchema.parse(sampleRequestContext)).toEqual(sampleRequestContext);
    expect(BriefSchema.parse(sampleBrief)).toEqual(sampleBrief);
    expect(ProductSpecSchema.parse(sampleProductSpec)).toEqual(sampleProductSpec);
    expect(PlanStepSchema.parse(samplePlanSteps[0])).toEqual(samplePlanSteps[0]);
    expect(ExecutionPlanSchema.parse(sampleExecutionPlan)).toEqual(sampleExecutionPlan);
    expect(ToolManifestSchema.parse(sampleToolManifest)).toEqual(sampleToolManifest);
    expect(CapabilityGrantSchema.parse(sampleCapabilityGrant)).toEqual(sampleCapabilityGrant);
    expect(ApprovalSchema.parse(sampleApproval)).toEqual(sampleApproval);
    expect(WorkerJobSchema.parse(sampleWorkerJob)).toEqual(sampleWorkerJob);
    expect(DawCommandSchema.parse(sampleDawCommand)).toEqual(sampleDawCommand);
    expect(AudioJobSchema.parse(sampleAudioJob)).toEqual(sampleAudioJob);
    expect(EvidenceRefSchema.parse(sampleEvidenceRef)).toEqual(sampleEvidenceRef);
    expect(ArtifactRefSchema.parse(sampleArtifactRef)).toEqual(sampleArtifactRef);
    expect(AuditEventSchema.parse(sampleAuditEvent)).toEqual(sampleAuditEvent);
    expect(DomainErrorSchema.parse(sampleDomainError)).toEqual(sampleDomainError);
    expect(BriefSubmittedEventSchema.parse(sampleBriefSubmittedCloudEvent)).toEqual(
      sampleBriefSubmittedCloudEvent,
    );
  });

  it("validates Result<T> discriminated union for both ok:true and ok:false envelopes", () => {
    const SpecResultSchema = createResultSchema(SpecRefSchema);

    const okResult = SpecResultSchema.parse({
      ok: true,
      value: {
        schemaVersion: "1.0.0",
        specId: "spec-0001",
        briefId: "brief-0001",
        specHash: SAMPLE_SHA256,
      },
      evidence: [sampleEvidenceRef],
    });
    expect(okResult.ok).toBe(true);

    const errResult = SpecResultSchema.parse({
      ok: false,
      error: sampleDomainError,
      retryable: false,
    });
    expect(errResult.ok).toBe(false);
  });

  it("accepts additive minor/patch schema evolution (1.1.0 / optional fields / producer metadata)", () => {
    const additiveBrief = {
      ...sampleBrief,
      schemaVersion: "1.2.4",
      unknownFutureOptionalField: "tolerated-by-v1-reader",
    };
    const parsed = BriefSchema.parse(additiveBrief);
    expect(parsed.schemaVersion).toBe("1.2.4");
    expect(parsed.briefId).toBe(sampleBrief.briefId);
  });

  it("rejects breaking schema changes (major version bump 2.0.0, missing required fields, unknown actionClass)", () => {
    expect(() =>
      BriefSchema.parse({
        ...sampleBrief,
        schemaVersion: "2.0.0",
      }),
    ).toThrow(/Expected major v1 semantic version/);

    expect(() =>
      PlanStepSchema.parse({
        ...samplePlanSteps[0],
        actionClass: "unregistered_shell_exec",
      }),
    ).toThrow();

    const { idempotencyKey: _omitted, ...contextWithoutIdempotency } = sampleRequestContext;
    expect(() => RequestContextSchema.parse(contextWithoutIdempotency)).toThrow();
  });

  it("computes deterministic canonical planHash and changes hash immediately upon any step mutation (INV-03)", () => {
    const hashA = computeCanonicalPlanHash(sampleExecutionPlan);
    const reversedStepsPlan = {
      ...sampleExecutionPlan,
      steps: [...sampleExecutionPlan.steps].reverse(),
    };
    const hashB = computeCanonicalPlanHash(reversedStepsPlan);
    expect(hashA).toBe(hashB);

    const mutatedStepPlan = {
      ...sampleExecutionPlan,
      steps: [
        samplePlanSteps[0]!,
        {
          ...samplePlanSteps[1]!,
          input: { targetRelativePath: "outputs/tampered.json" },
        },
      ],
    };
    const mutatedHash = computeCanonicalPlanHash(mutatedStepPlan);
    expect(mutatedHash).not.toBe(hashA);
  });

  it("generates valid JSON Schema Draft 2020-12 and OpenAPI 3.1.0 documents", () => {
    const catalog = buildJsonSchemaCatalog();
    expect(catalog.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(Object.keys(catalog.definitions)).toEqual(
      expect.arrayContaining([
        "RequestContext",
        "Brief",
        "ExecutionPlan",
        "PlanStep",
        "CapabilityGrant",
        "Approval",
        "WorkerJob",
        "EvidenceRef",
        "AuditEvent",
        "DomainError",
      ]),
    );

    const openApi = buildOpenApiSpec();
    expect(openApi["openapi"]).toBe("3.1.0");
    expect(openApi["paths"]).toHaveProperty("/api/v1/briefs");
    expect(openApi["paths"]).toHaveProperty("/api/v1/system/emergency-stop");
  });

  it("enforces ADR-0004 rule: no untyped `any` token in contracts/src/**/*.ts", () => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const srcDir = resolve(currentDir, "../../src");

    function collectTsFiles(dir: string): string[] {
      const entries = readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...collectTsFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith(".ts")) {
          files.push(fullPath);
        }
      }
      return files;
    }

    const tsFiles = collectTsFiles(srcDir);
    expect(tsFiles.length).toBeGreaterThan(0);

    const explicitAnyRegex = /(:\s*any\b|<any>|as\s+any\b|\bany\[\]|\bZodTypeAny\b)/;
    for (const file of tsFiles) {
      const content = readFileSync(file, "utf8");
      expect(
        explicitAnyRegex.test(content),
        `Prohibited 'any' token found in ${file}`,
      ).toBe(false);
    }
  });
});
