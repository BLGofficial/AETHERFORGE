import type { Result } from "@aether-forge/contracts";
import { resolveAndVerifyGrantedPath } from "@aether-forge/filesystem";

export interface GitWorkspaceVerification {
  readonly canonicalRepoRoot: string;
}

/**
 * Constrained Git workspace boundary adapter (Blueprint §3).
 * Ensures any local git operation is strictly confined to a granted canonical workspace root.
 */
export function verifyGrantedGitWorkspace(params: {
  readonly grantedCanonicalRoots: readonly string[];
  readonly repoRelativePath: string;
  readonly traceId: string;
}): Result<GitWorkspaceVerification> {
  const res = resolveAndVerifyGrantedPath({
    grantedCanonicalRoots: params.grantedCanonicalRoots,
    relativeTargetPath: params.repoRelativePath,
    traceId: params.traceId,
  });
  if (!res.ok) {
    return res;
  }
  return {
    ok: true,
    value: { canonicalRepoRoot: res.value.canonicalTarget },
    evidence: [],
  };
}
