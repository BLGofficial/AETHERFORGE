import { createHash, randomBytes } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, parse, relative, resolve, sep } from "node:path";
import {
  type DomainError,
  type Result,
  SCHEMA_VERSION_V1,
} from "@aether-forge/contracts";

export interface AtomicWriteOutcome {
  readonly canonicalTargetPath: string;
  readonly bytesWritten: number;
  readonly sha256: string;
}

export interface WorkspaceManifestInspection {
  readonly canonicalTargetPath: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly contentUtf8: string;
}

function makeBoundaryError(code: string, message: string, traceId: string): Result<never> {
  const error: DomainError = {
    schemaVersion: SCHEMA_VERSION_V1,
    code,
    message,
    category: "WORKER_TRUST_BOUNDARY",
    traceId,
  };
  return { ok: false, retryable: false, error };
}

/**
 * Walks every path segment from root to target and verifies via `lstatSync`
 * that no segment is a symbolic link or Windows NTFS junction/reparse point.
 */
function hasSymlinkOrReparsePointInChain(rootDir: string, targetPath: string): boolean {
  const rootStat = lstatSync(rootDir);
  if (rootStat.isSymbolicLink()) {
    return true;
  }
  const rootReal = realpathSync.native(rootDir);
  if (normalizeWindowsPath(rootReal) !== normalizeWindowsPath(resolve(rootDir))) {
    return true;
  }

  const rel = relative(rootDir, targetPath);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) {
    return false;
  }

  const segments = rel.split(/[\\/]+/).filter(Boolean);
  let cursor = rootDir;
  for (const seg of segments) {
    cursor = resolve(cursor, seg);
    if (existsSync(cursor)) {
      const st = lstatSync(cursor);
      if (st.isSymbolicLink()) {
        return true;
      }
      const realCursor = realpathSync.native(cursor);
      if (normalizeWindowsPath(realCursor) !== normalizeWindowsPath(cursor)) {
        return true;
      }
    }
  }
  return false;
}

function normalizeWindowsPath(p: string): string {
  return resolve(p).replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

/**
 * Validates that `relativeTargetPath` resolves strictly inside one of the `grantedCanonicalRoots`,
 * blocking traversal (`..`), absolute path injection, drive changes, and symlinks/reparse points.
 */
export function resolveAndVerifyGrantedPath(params: {
  readonly grantedCanonicalRoots: readonly string[];
  readonly relativeTargetPath: string;
  readonly traceId: string;
}): Result<{ readonly canonicalRoot: string; readonly canonicalTarget: string }> {
  const { grantedCanonicalRoots, relativeTargetPath, traceId } = params;

  if (
    !relativeTargetPath ||
    relativeTargetPath.includes("\0") ||
    isAbsolute(relativeTargetPath) ||
    /^[A-Za-z]:/.test(relativeTargetPath) ||
    relativeTargetPath.startsWith("\\\\")
  ) {
    return makeBoundaryError(
      "DOMAIN_WORKER_PATH_ESCAPE_DENIED",
      "Target path must be a relative path without drive letters or UNC prefixes.",
      traceId,
    );
  }

  for (const rawRoot of grantedCanonicalRoots) {
    const resolvedRoot = resolve(rawRoot);
    if (!existsSync(resolvedRoot)) {
      continue;
    }

    if (lstatSync(resolvedRoot).isSymbolicLink()) {
      return makeBoundaryError(
        "DOMAIN_WORKER_REPARSE_POINT_DENIED",
        "Granted workspace root cannot be a symbolic link or reparse point.",
        traceId,
      );
    }

    const candidateTarget = resolve(resolvedRoot, relativeTargetPath);
    const rel = relative(resolvedRoot, candidateTarget);

    if (!rel || rel.startsWith("..") || isAbsolute(rel) || parse(resolvedRoot).root !== parse(candidateTarget).root) {
      return makeBoundaryError(
        "DOMAIN_WORKER_PATH_ESCAPE_DENIED",
        "Target path escapes granted canonical workspace root.",
        traceId,
      );
    }

    if (hasSymlinkOrReparsePointInChain(resolvedRoot, candidateTarget)) {
      return makeBoundaryError(
        "DOMAIN_WORKER_REPARSE_POINT_DENIED",
        "Symbolic link or NTFS junction/reparse point detected in target path hierarchy.",
        traceId,
      );
    }

    const normRoot = normalizeWindowsPath(realpathSync.native(resolvedRoot));
    const parentDir = dirname(candidateTarget);
    if (existsSync(parentDir)) {
      const normParentReal = normalizeWindowsPath(realpathSync.native(parentDir));
      if (normParentReal !== normRoot && !normParentReal.startsWith(`${normRoot}/`)) {
        return makeBoundaryError(
          "DOMAIN_WORKER_REPARSE_POINT_DENIED",
          "Parent directory resolves outside granted workspace via reparse point.",
          traceId,
        );
      }
    }

    return {
      ok: true,
      value: {
        canonicalRoot: resolvedRoot,
        canonicalTarget: candidateTarget,
      },
      evidence: [],
    };
  }

  return makeBoundaryError(
    "DOMAIN_WORKER_WORKSPACE_ROOT_UNAVAILABLE",
    "None of the granted canonical workspace roots exist on the local workstation.",
    traceId,
  );
}

/**
 * Constrained read-only manifest inspection inside a granted canonical workspace root.
 */
export function inspectWorkspaceFile(params: {
  readonly grantedCanonicalRoots: readonly string[];
  readonly relativeTargetPath: string;
  readonly traceId: string;
}): Result<WorkspaceManifestInspection> {
  const pathCheck = resolveAndVerifyGrantedPath(params);
  if (!pathCheck.ok) {
    return pathCheck;
  }

  const { canonicalTarget } = pathCheck.value;
  if (!existsSync(canonicalTarget)) {
    return makeBoundaryError(
      "DOMAIN_WORKER_FILE_NOT_FOUND",
      "Requested workspace file does not exist.",
      params.traceId,
    );
  }

  if (lstatSync(canonicalTarget).isSymbolicLink()) {
    return makeBoundaryError(
      "DOMAIN_WORKER_REPARSE_POINT_DENIED",
      "Target file is a symbolic link or reparse point.",
      params.traceId,
    );
  }

  const bytes = readFileSync(canonicalTarget);
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  return {
    ok: true,
    value: {
      canonicalTargetPath: canonicalTarget.split(sep).join("/"),
      sizeBytes: bytes.byteLength,
      sha256,
      contentUtf8: bytes.toString("utf8"),
    },
    evidence: [],
  };
}

/**
 * Constrained atomic file write inside a granted canonical workspace root.
 * Defends against traversal, symlinks/reparse points, TOCTOU prior-hash drift, and cancellation partial files.
 */
export function atomicWriteWorkspaceFile(params: {
  readonly grantedCanonicalRoots: readonly string[];
  readonly relativeTargetPath: string;
  readonly contentUtf8: string;
  readonly expectedPriorSha256?: string | undefined;
  readonly beforeCommitHook?: (() => void) | undefined;
  readonly isCancelled?: (() => boolean) | undefined;
  readonly traceId: string;
}): Result<AtomicWriteOutcome> {
  const pathCheck = resolveAndVerifyGrantedPath(params);
  if (!pathCheck.ok) {
    return pathCheck;
  }

  const { canonicalRoot, canonicalTarget } = pathCheck.value;
  const parentDir = dirname(canonicalTarget);
  mkdirSync(parentDir, { recursive: true });

  // Re-verify parent chain after mkdirSync to prevent symlink race
  if (hasSymlinkOrReparsePointInChain(canonicalRoot, canonicalTarget)) {
    return makeBoundaryError(
      "DOMAIN_WORKER_REPARSE_POINT_DENIED",
      "Reparse point detected after directory creation.",
      params.traceId,
    );
  }

  const readPriorSha256 = (): string | undefined => {
    if (!existsSync(canonicalTarget)) {
      return undefined;
    }
    if (lstatSync(canonicalTarget).isSymbolicLink()) {
      throw new Error("REPARSE_POINT_ON_TARGET");
    }
    return createHash("sha256").update(readFileSync(canonicalTarget)).digest("hex");
  };

  let initialPriorHash: string | undefined;
  try {
    initialPriorHash = readPriorSha256();
  } catch {
    return makeBoundaryError(
      "DOMAIN_WORKER_REPARSE_POINT_DENIED",
      "Target file is a symbolic link or reparse point.",
      params.traceId,
    );
  }

  if (
    params.expectedPriorSha256 !== undefined &&
    initialPriorHash !== params.expectedPriorSha256
  ) {
    return makeBoundaryError(
      "DOMAIN_WORKER_TOCTOU_CONFLICT",
      "Target file prior SHA-256 did not match expectedPriorSha256 before write.",
      params.traceId,
    );
  }

  const tempPath = `${canonicalTarget}.tmp-${randomBytes(6).toString("hex")}`;
  const payloadBuffer = Buffer.from(params.contentUtf8, "utf8");

  try {
    const fd = openSync(tempPath, "wx", 0o600);
    try {
      writeFileSync(fd, payloadBuffer);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }

    if (params.beforeCommitHook) {
      params.beforeCommitHook();
    }

    if (params.isCancelled && params.isCancelled()) {
      rmSync(tempPath, { force: true });
      return makeBoundaryError(
        "DOMAIN_WORKER_JOB_CANCELLED",
        "Job was cancelled before atomic commit; temporary staging file removed.",
        params.traceId,
      );
    }

    // TOCTOU re-verification immediately prior to atomic rename
    if (hasSymlinkOrReparsePointInChain(canonicalRoot, canonicalTarget)) {
      rmSync(tempPath, { force: true });
      return makeBoundaryError(
        "DOMAIN_WORKER_TOCTOU_REPARSE_DETECTED",
        "TOCTOU race: target or parent became a symlink/reparse point prior to commit.",
        params.traceId,
      );
    }

    const preCommitPriorHash = readPriorSha256();
    if (preCommitPriorHash !== initialPriorHash) {
      rmSync(tempPath, { force: true });
      return makeBoundaryError(
        "DOMAIN_WORKER_TOCTOU_CONFLICT",
        "TOCTOU race: target file was modified concurrently before atomic rename.",
        params.traceId,
      );
    }

    renameSync(tempPath, canonicalTarget);
  } catch (err) {
    rmSync(tempPath, { force: true });
    return makeBoundaryError(
      "DOMAIN_WORKER_ATOMIC_WRITE_FAILED",
      err instanceof Error ? err.message : "Atomic workspace write failed.",
      params.traceId,
    );
  }

  const sha256 = createHash("sha256").update(payloadBuffer).digest("hex");
  return {
    ok: true,
    value: {
      canonicalTargetPath: canonicalTarget.split(sep).join("/"),
      bytesWritten: payloadBuffer.byteLength,
      sha256,
    },
    evidence: [],
  };
}
