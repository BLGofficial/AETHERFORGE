import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildAndVerifyNativeWindowsWorkerExe } from "../../../scripts/verify-native-toolchains.ts";

const currentDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(currentDir, "../../..");

describe("PHASE 13 — Native Windows Worker executable compilation, DPAPI, and NTFS reparse-point gate", () => {
  it("compiles AetherForge.WindowsWorker.exe via Windows Framework64 csc.exe and passes live Windows DPAPI & path-confinement self-test", () => {
    const receipt = buildAndVerifyNativeWindowsWorkerExe(workspaceRoot);
    expect(receipt.compiled).toBe(true);
    expect(receipt.binaryBytes).toBeGreaterThan(2048);
    expect(receipt.binarySha256).toMatch(/^[a-f0-9]{64}$/);
    expect(receipt.selfTestOutput).toEqual({
      ok: true,
      dpapiVerified: true,
      reparseAndTraversalGuardVerified: true,
    });

    // Test the compiled native executable directly against a live Windows NTFS junction escape
    const tempBase = mkdtempSync(join(tmpdir(), "af-p13-native-"));
    const grantedRoot = join(tempBase, "granted");
    const outsideDir = join(tempBase, "outside");
    mkdirSync(grantedRoot, { recursive: true });
    mkdirSync(outsideDir, { recursive: true });

    try {
      // 1. Valid path inside granted root exits 0
      const validOut = execFileSync(
        receipt.binaryPath,
        ["--verify-path", grantedRoot, join(grantedRoot, "sub", "file.txt")],
        { encoding: "utf8" },
      ).trim();
      expect(JSON.parse(validOut)).toEqual({ ok: true });

      // 2. NTFS junction inside granted root pointing to outsideDir exits non-zero with DOMAIN_WORKER_REPARSE_POINT_DENIED
      const junctionDir = join(grantedRoot, "junction-escape");
      symlinkSync(outsideDir, junctionDir, "junction");

      let junctionBlocked = false;
      try {
        execFileSync(
          receipt.binaryPath,
          ["--verify-path", grantedRoot, join(junctionDir, "secret.txt")],
          { stdio: "pipe", encoding: "utf8" },
        );
      } catch (err) {
        const stderr =
          err && typeof err === "object" && "stderr" in err ? String(err.stderr) : "";
        junctionBlocked = stderr.includes("DOMAIN_WORKER_REPARSE_POINT_DENIED");
      }
      expect(junctionBlocked).toBe(true);
    } finally {
      rmSync(tempBase, { recursive: true, force: true });
    }
  });

  it("compiles and executes the read-only FL Studio 2025 Python controller script via local Python 3.14 runtime", () => {
    const scriptPath = resolve(
      workspaceRoot,
      "adapters/fl-studio-2025/scripts/device_aetherforge_inspect.py",
    );
    const out = execFileSync("python", [scriptPath, "--self-test"], {
      encoding: "utf8",
    }).trim();
    const parsed = JSON.parse(out) as {
      ok: boolean;
      snapshot: {
        dawTarget: string;
        capabilityTier: string;
        apiVersion: number;
        channelCount: number;
      };
    };
    expect(parsed.ok).toBe(true);
    expect(parsed.snapshot.dawTarget).toBe("fl-studio-2025");
    expect(parsed.snapshot.capabilityTier).toBe("inspect");
    expect(parsed.snapshot.apiVersion).toBe(25);
  });
});
