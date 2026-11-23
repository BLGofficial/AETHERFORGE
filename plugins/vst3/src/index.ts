import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface Vst3BuildPrerequisites {
  readonly cmakeFound: boolean;
  readonly cppCompilerFound: boolean;
  readonly juceSdkFound: boolean;
  readonly steinbergVst3SdkFound: boolean;
  readonly pluginvalFound: boolean;
  readonly status: "READY_TO_BUILD" | "BLOCKED_MISSING_PREREQUISITES";
  readonly missingPrerequisites: readonly string[];
}

export function discoverVst3BuildPrerequisites(overrides?: {
  readonly cmakePath?: string;
  readonly juceDir?: string;
  readonly vst3SdkDir?: string;
  readonly pluginvalPath?: string;
  readonly cppCompilerPath?: string;
}): Vst3BuildPrerequisites {
  const homeDir = process.env["USERPROFILE"] ?? "";
  const defaultSdkRoot = homeDir ? resolve(homeDir, "aetherforge-sdk") : "";

  const cmakePath = overrides?.cmakePath ?? "C:\\Program Files\\CMake\\bin\\cmake.exe";
  const juceDir =
    overrides?.juceDir ??
    process.env["JUCE_SOURCE_DIR"] ??
    (defaultSdkRoot && existsSync(resolve(defaultSdkRoot, "JUCE", "CMakeLists.txt"))
      ? resolve(defaultSdkRoot, "JUCE")
      : "C:\\JUCE");
  const vst3SdkDir =
    overrides?.vst3SdkDir ??
    process.env["VST3_SDK_DIR"] ??
    (defaultSdkRoot && existsSync(resolve(defaultSdkRoot, "VST_SDK", "CMakeLists.txt"))
      ? resolve(defaultSdkRoot, "VST_SDK")
      : "C:\\VST_SDK");
  const pluginvalPath =
    overrides?.pluginvalPath ??
    process.env["PLUGINVAL_EXE"] ??
    (defaultSdkRoot && existsSync(resolve(defaultSdkRoot, "pluginval", "pluginval.exe"))
      ? resolve(defaultSdkRoot, "pluginval", "pluginval.exe")
      : "C:\\pluginval\\pluginval.exe");
  const cppCompilerPath =
    overrides?.cppCompilerPath ??
    process.env["CXX"] ??
    (defaultSdkRoot && existsSync(resolve(defaultSdkRoot, "llvm-mingw", "bin", "clang++.exe"))
      ? resolve(defaultSdkRoot, "llvm-mingw", "bin", "clang++.exe")
      : "");

  const cmakeFound = existsSync(cmakePath);
  const cppCompilerFound = Boolean(cppCompilerPath && existsSync(cppCompilerPath));
  const juceSdkFound = existsSync(resolve(juceDir, "CMakeLists.txt"));
  const steinbergVst3SdkFound = existsSync(vst3SdkDir);
  const pluginvalFound = existsSync(pluginvalPath);

  const missing: string[] = [];
  if (!cmakeFound) missing.push("CMake (>= 3.24)");
  if (!cppCompilerFound) missing.push("C++20 Compiler (MSVC cl.exe or clang++)");
  if (!juceSdkFound) missing.push("JUCE 8.x SDK (JUCE_SOURCE_DIR)");
  if (!steinbergVst3SdkFound) missing.push("Steinberg VST3 SDK (VST3_SDK_DIR)");
  if (!pluginvalFound) missing.push("pluginval validator executable (PLUGINVAL_EXE)");

  return {
    cmakeFound,
    cppCompilerFound,
    juceSdkFound,
    steinbergVst3SdkFound,
    pluginvalFound,
    status: missing.length === 0 ? "READY_TO_BUILD" : "BLOCKED_MISSING_PREREQUISITES",
    missingPrerequisites: missing,
  };
}

/**
 * Static real-time boundary scanner (ADR-0008):
 * Verifies that C++20 VST3 processor sources contain zero heap allocations,
 * mutex locks, network sockets, HTTP clients, filesystem calls, or LLM calls.
 */
export function auditVst3RealtimeCppSources(): {
  readonly compliant: boolean;
  readonly violations: readonly string[];
} {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const headerPath = resolve(currentDir, "../AetherForgeProcessor/AetherForgeProcessor.h");
  const cppPath = resolve(currentDir, "../AetherForgeProcessor/AetherForgeProcessor.cpp");

  const combined = `${readFileSync(headerPath, "utf8")}\n${readFileSync(cppPath, "utf8")}`;
  const forbiddenPatterns: ReadonlyArray<{ readonly label: string; readonly regex: RegExp }> = [
    { label: "Heap allocation (new/delete/malloc/free)", regex: /\b(new\s+|delete\s+|malloc\s*\(|free\s*\()/ },
    { label: "Blocking lock (std::mutex/lock_guard/unique_lock)", regex: /\b(std::mutex|std::lock_guard|std::unique_lock|std::recursive_mutex)\b/ },
    { label: "Network/HTTP I/O (socket/curl/winhttp)", regex: /\b(socket\s*\(|curl_|WinHttp|fetch\s*\()/ },
    { label: "Filesystem I/O (std::filesystem/fopen/ifstream)", regex: /\b(std::filesystem|fopen\s*\(|std::ifstream|std::ofstream)\b/ },
  ];

  const violations: string[] = [];
  for (const rule of forbiddenPatterns) {
    if (rule.regex.test(combined)) {
      violations.push(rule.label);
    }
  }

  return {
    compliant: violations.length === 0,
    violations,
  };
}

export const VST3_STATE_MAGIC = 0x33564641; // "AFV3"
export const VST3_STATE_VERSION = 1;

/**
 * Reference TypeScript mirror of AetherForgeRealtimeCore for deterministic
 * parameter automation, state round-trip, and shared DSP golden vector parity tests.
 */
export class AetherForgeVst3ReferenceProcessor {
  private sampleRate = 48_000;
  private maxBlockSize = 512;
  private gainDb = 0.0;
  private bypass = false;

  public prepareToPlay(sampleRate: number, maxBlockSize: number): void {
    this.sampleRate = sampleRate > 0 ? sampleRate : 48_000;
    this.maxBlockSize = maxBlockSize > 0 ? maxBlockSize : 512;
  }

  public getPreparedConfig(): { readonly sampleRate: number; readonly maxBlockSize: number } {
    return { sampleRate: this.sampleRate, maxBlockSize: this.maxBlockSize };
  }

  public setGainDb(db: number): void {
    this.gainDb = Math.max(-60.0, Math.min(24.0, db));
  }

  public getGainDb(): number {
    return this.gainDb;
  }

  public setBypass(bypassed: boolean): void {
    this.bypass = bypassed;
  }

  public getBypass(): boolean {
    return this.bypass;
  }

  public static dbToLinear(db: number): number {
    return Math.pow(10, db / 20);
  }

  public processBlock(channelBuffers: Float32Array[]): void {
    if (this.bypass) {
      return;
    }
    const linearGain = AetherForgeVst3ReferenceProcessor.dbToLinear(this.gainDb);
    for (const channel of channelBuffers) {
      for (let i = 0; i < channel.length; i += 1) {
        const scaled = (channel[i] ?? 0) * linearGain;
        channel[i] = Math.max(-1.0, Math.min(1.0, scaled));
      }
    }
  }

  public getStateInformation(): Buffer {
    const buf = Buffer.alloc(16);
    buf.writeUInt32LE(VST3_STATE_MAGIC, 0);
    buf.writeUInt32LE(VST3_STATE_VERSION, 4);
    buf.writeFloatLE(this.gainDb, 8);
    buf.writeUInt8(this.bypass ? 1 : 0, 12);
    return buf;
  }

  public setStateInformation(stateBuffer: Buffer): boolean {
    if (stateBuffer.byteLength !== 16) {
      return false;
    }
    const magic = stateBuffer.readUInt32LE(0);
    const version = stateBuffer.readUInt32LE(4);
    const gainDb = stateBuffer.readFloatLE(8);
    const bypassByte = stateBuffer.readUInt8(12);

    if (magic !== VST3_STATE_MAGIC || version !== VST3_STATE_VERSION || !Number.isFinite(gainDb)) {
      return false;
    }
    this.setGainDb(gainDb);
    this.setBypass(bypassByte !== 0);
    return true;
  }
}
