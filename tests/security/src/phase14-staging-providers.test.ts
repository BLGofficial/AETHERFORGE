import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION_V1 } from "@aether-forge/contracts";
import { verifyPostgresPgvectorMigrationSql } from "@aether-forge/knowledge";
import { verifyTemporalStagingNamespaceConfig } from "@aether-forge/orchestration";
import {
  BoundedExecutionPlanner,
  createDefaultToolManifestRegistry,
  ProviderGatewayService,
} from "@aether-forge/provider-gateway";
import { sampleRequestContext } from "@aether-forge/test-fixtures";

describe("PHASE 14 — Cloud staging infrastructure and server-side provider integration gate", () => {
  it("verifies PostgreSQL 16 + pgvector migration DDL and Temporal Cloud namespace archival/security config", () => {
    const migration = verifyPostgresPgvectorMigrationSql();
    expect(migration.migrationId).toBe("0001_knowledge_pgvector");
    expect(migration.pgvectorExtensionDeclared).toBe(true);
    expect(migration.cascadeDeleteDeclared).toBe(true);
    expect(migration.verifiedTables).toEqual(["knowledge_sources", "knowledge_chunks"]);
    expect(migration.sqlSha256).toMatch(/^[a-f0-9]{64}$/);

    const temporalCfg = verifyTemporalStagingNamespaceConfig();
    expect(temporalCfg.namespace).toBe("aetherforge-governed-orchestration");
    expect(temporalCfg.retentionDays).toBe(365);
    expect(temporalCfg.forbidRawLocalFileBytesInPayload).toBe(true);
    expect(temporalCfg.forbidProviderSecretsInHistory).toBe(true);
  });

  it("enrolls openai, anthropic, google, and self-hosted-openai-compat adapters via ServerSideSecretManager, verifies zero secret leakage in logs/audit/evidence, and disables immediately on secret revocation", () => {
    const gateway = new ProviderGatewayService();
    const planner = new BoundedExecutionPlanner({ providerGateway: gateway });
    const registry = createDefaultToolManifestRegistry();

    const secretFixtures = [
      {
        providerId: "openai" as const,
        modelName: "gpt-4.1-structured",
        secretId: "sec-openai-staging-01",
        secretValue: "SERVER_SECRET_OPENAI_KEY_DO_NOT_LEAK_998877",
      },
      {
        providerId: "anthropic" as const,
        modelName: "claude-sonnet-4-structured",
        secretId: "sec-anthropic-staging-01",
        secretValue: "SERVER_SECRET_ANTHROPIC_KEY_DO_NOT_LEAK_112233",
      },
      {
        providerId: "google" as const,
        modelName: "gemini-2.5-pro-structured",
        secretId: "sec-google-staging-01",
        secretValue: "SERVER_SECRET_GOOGLE_KEY_DO_NOT_LEAK_445566",
      },
      {
        providerId: "self-hosted-openai-compat" as const,
        modelName: "aetherforge-vllm-qwen-coder",
        secretId: "sec-selfhosted-staging-01",
        secretValue: "SERVER_SECRET_SELFHOSTED_KEY_DO_NOT_LEAK_778899",
      },
    ];

    for (const item of secretFixtures) {
      gateway.enrollProviderWithServerSecret(item);
      gateway.setDefaultProvider(item.providerId);

      const planRes = planner.proposePlan({
        context: {
          ...sampleRequestContext,
          requestId: `req-${item.providerId}`,
          idempotencyKey: `idem-${item.providerId}`,
        },
        planningInput: {
          schemaVersion: SCHEMA_VERSION_V1,
          specId: `spec-${item.providerId}`,
          tenantId: "tenant-alpha",
          projectId: "proj-synth-01",
          availableTools: [...registry.listTools()],
          citations: [],
          tokenBudget: 4096,
        },
      });
      expect(planRes.ok, `Expected enrolled provider ${item.providerId} to succeed`).toBe(true);

      // Verify zero secret leakage in plan, evidence, audit events, or secretManager JSON serialization
      const serializedPlan = JSON.stringify(planRes);
      const serializedAudit = JSON.stringify(gateway.auditStore.listByTenant("tenant-alpha"));
      const serializedSecretMgr = JSON.stringify(gateway.secretManager);

      expect(serializedPlan).not.toContain(item.secretValue);
      expect(serializedAudit).not.toContain(item.secretValue);
      expect(serializedSecretMgr).not.toContain(item.secretValue);
    }

    // Revoking a provider secret immediately disables that provider adapter (fail closed)
    gateway.revokeProviderSecret("openai", "sec-openai-staging-01");
    gateway.setDefaultProvider("openai");

    const revokedRes = planner.proposePlan({
      context: {
        ...sampleRequestContext,
        requestId: "req-openai-revoked",
        idempotencyKey: "idem-openai-revoked",
      },
      planningInput: {
        schemaVersion: SCHEMA_VERSION_V1,
        specId: "spec-revoked",
        tenantId: "tenant-alpha",
        projectId: "proj-synth-01",
        availableTools: [...registry.listTools()],
        citations: [],
        tokenBudget: 4096,
      },
    });
    expect(revokedRes.ok).toBe(false);
    if (!revokedRes.ok) {
      expect(revokedRes.error.code).toBe("DOMAIN_PROVIDER_NOT_CONFIGURED");
    }
  });
});
