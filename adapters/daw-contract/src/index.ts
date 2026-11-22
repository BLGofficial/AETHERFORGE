import type {
  DawCapabilityTier,
  DawCommand,
  Result,
} from "@aether-forge/contracts";

export type DawReversibility = "reversible" | "irreversible";

export interface DawCapabilityDescriptor {
  readonly dawTarget: "fl-studio-2025";
  readonly tier: DawCapabilityTier;
  readonly qualified: boolean;
  readonly qualifiedOperations: readonly string[];
  readonly qualificationDocRef: string;
}

export interface FlpHeaderMetadata {
  readonly validFlpMagic: boolean;
  readonly formatVersion: number;
  readonly channelCount: number;
  readonly ppq: number;
  readonly dataChunkBytes: number;
  readonly sha256: string;
}

export interface FlStudioInstallationEvidence {
  readonly installRoot: string;
  readonly fl64ExePresent: boolean;
  readonly flEngineDllPresent: boolean;
  readonly fl64ExeBytes: number;
  readonly flEngineDllBytes: number;
  readonly verifiedBuildVersion: string;
}

export interface DawExecutionProof {
  readonly commandId: string;
  readonly dawTarget: "fl-studio-2025";
  readonly capabilityTier: DawCapabilityTier;
  readonly operation: string;
  readonly reversibility: DawReversibility;
  readonly installation: FlStudioInstallationEvidence;
  readonly flpHeader: FlpHeaderMetadata;
  readonly sourceHash: string;
  readonly backupPath?: string | undefined;
  readonly backupHash?: string | undefined;
  readonly outputPath?: string | undefined;
  readonly outputHash?: string | undefined;
}

export interface DawInvokeOptions {
  readonly grantedCanonicalRoots: readonly string[];
  readonly traceId: string;
  readonly isCancelled?: (() => boolean) | undefined;
}

export interface DawAdapterContract {
  discoverCapabilities(): Result<readonly DawCapabilityDescriptor[]>;
  invoke(command: DawCommand, options: DawInvokeOptions): Result<DawExecutionProof>;
}
