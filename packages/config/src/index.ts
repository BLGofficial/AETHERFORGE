import { z } from "zod";
import { SCHEMA_VERSION_V1 } from "@aether-forge/contracts";

export const PlatformEnvironmentSchema = z.enum(["dev", "staging", "production"]);
export type PlatformEnvironment = z.infer<typeof PlatformEnvironmentSchema>;

export const PlatformConfigSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION_V1),
  environment: PlatformEnvironmentSchema,
  auditRetentionDays: z.number().int().min(365),
  defaultApprovalExpirySeconds: z.number().int().positive(),
  allowCloudAudioEgressByDefault: z.literal(false),
});
export type PlatformConfig = z.infer<typeof PlatformConfigSchema>;

export const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  schemaVersion: SCHEMA_VERSION_V1,
  environment: "dev",
  auditRetentionDays: 365,
  defaultApprovalExpirySeconds: 14_400,
  allowCloudAudioEgressByDefault: false,
};
