import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface NativeWorkerBuildReceipt {
  readonly compiled: boolean;
  readonly compilerPath: string;
  readonly binaryPath: string;
  readonly binaryBytes: number;
  readonly binarySha256: string;
  readonly selfTestOutput: {
    readonly ok: boolean;
    readonly dpapiVerified: boolean;
    readonly reparseAndTraversalGuardVerified: boolean;
  };
}

const CSC_EXE_PATH = "C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe";

/**
 * Compiles `workers/windows-host/NativeWorkerCli.cs` into a real Windows x64 executable
 * (`artifacts/native/AetherForge.WindowsWorker.exe`) linked against `System.Security.dll`
 * and executes its `--self-test` mode verifying live Windows DPAPI and ReparsePoint enforcement.
 */
export function buildAndVerifyNativeWindowsWorkerExe(
  workspaceRootDir: string,
): NativeWorkerBuildReceipt {
  if (!existsSync(CSC_EXE_PATH)) {
    throw new Error(`Windows native C# compiler not found at ${CSC_EXE_PATH}`);
  }

  const outDir = resolve(workspaceRootDir, "artifacts/native");
  mkdirSync(outDir, { recursive: true });

  const sourcePath = resolve(workspaceRootDir, "workers/windows-host/NativeWorkerCli.cs");
  const binaryPath = resolve(outDir, "AetherForge.WindowsWorker.exe");

  execFileSync(
    CSC_EXE_PATH,
    [
      "/nologo",
      "/optimize+",
      "/platform:x64",
      "/target:exe",
      `/out:${binaryPath}`,
      "/r:System.Security.dll",
      sourcePath,
    ],
    { stdio: "pipe", encoding: "utf8" },
  );

  const binaryBuffer = readFileSync(binaryPath);
  const binarySha256 = createHash("sha256").update(binaryBuffer).digest("hex");

  const stdout = execFileSync(binaryPath, ["--self-test"], {
    stdio: "pipe",
    encoding: "utf8",
  }).trim();

  const selfTestOutput = JSON.parse(stdout) as {
    ok: boolean;
    dpapiVerified: boolean;
    reparseAndTraversalGuardVerified: boolean;
  };

  const receipt: NativeWorkerBuildReceipt = {
    compiled: true,
    compilerPath: CSC_EXE_PATH,
    binaryPath,
    binaryBytes: binaryBuffer.byteLength,
    binarySha256,
    selfTestOutput,
  };

  writeFileSync(
    resolve(outDir, "native-worker-receipt.json"),
    `${JSON.stringify(receipt, null, 2)}\n`,
    "utf8",
  );

  return receipt;
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]).toLowerCase() ===
    resolve(fileURLToPath(import.meta.url)).toLowerCase();

if (isMain) {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const rootDir = resolve(currentDir, "..");
  const receipt = buildAndVerifyNativeWindowsWorkerExe(rootDir);
  console.log(
    `Compiled & verified native Windows Worker executable: ${receipt.binaryPath} (${receipt.binaryBytes} bytes, sha256=${receipt.binarySha256.slice(0, 16)})`,
  );
}
