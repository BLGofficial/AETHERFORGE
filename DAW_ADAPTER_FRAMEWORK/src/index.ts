import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

/**
 * AETHER FORGE — MULTI-DAW ADAPTER FRAMEWORK (SUBSYSTEM C)
 * Reusable ports-and-adapters framework supporting multiple DAWs (FL Studio 2025 primary target,
 * plus replaceable REAPER adapter) with strict capability negotiation and zero undocumented hacks.
 */

export type DawCapabilityKey =
  | "project_binary_readonly_inspect"
  | "midi_controller_script_bridge"
  | "vst3_plugin_parameter_host_automation"
  | "mixer_track_routing_inspect"
  | "midi_pattern_offline_transform"
  | "direct_flp_binary_mutation"
  | "fl_engine_dll_memory_injection"
  | "undocumented_window_message_spoofing";

export type DawCapabilitySupportLevel =
  | "SUPPORTED_READONLY"
  | "SUPPORTED_CONTROLLER_BRIDGE"
  | "SUPPORTED_EXPORT_IMPORT"
  | "UNSUPPORTED_FORBIDDEN";

export interface DawCapabilityDescriptor {
  capability: DawCapabilityKey;
  supportLevel: DawCapabilitySupportLevel;
  mechanism: string;
  rationale: string;
}

export interface DawProjectInspectionReport {
  dawId: string;
  projectPath: string;
  projectFormatSignature: string;
  dawVersionString: string;
  ppq: number;
  channelOrTrackCount: number;
  sourceSha256: string;
  sourceBytesModified: 0;
}

export interface DawTrackNode {
  trackId: string;
  name: string;
  role: "INSTRUMENT" | "AUDIO" | "BUS" | "MASTER";
  gainDb: number;
  pan: number; // -1.0 (L) to +1.0 (R)
  muted: boolean;
  routedToTrackIds: string[];
  insertedPluginIds: string[];
}

export interface MidiNoteEvent {
  noteId: string;
  pitchMidi: number; // 0..127
  startTick: number;
  durationTicks: number;
  velocity: number; // 1..127
  channel: number; // 1..16
}

export interface DawAutomationCommandResult {
  allowed: boolean;
  dawId: string;
  capability: DawCapabilityKey;
  errorCode?: string;
  artifactType?: "PYTHON_MIDI_CONTROLLER_SCRIPT" | "READONLY_INSPECTION_REPORT" | "MIDI_TRANSFORM_RESULT";
  payload?: string;
  payloadSha256?: string;
}

export interface IDawAdapter {
  readonly dawId: string;
  readonly displayName: string;
  readonly targetVersion: string;
  getCapabilities(): DawCapabilityDescriptor[];
  supportsCapability(capability: DawCapabilityKey): boolean;
  inspectProjectReadOnly(projectFilePath: string): DawProjectInspectionReport;
  executeCapabilityOperation(params: {
    capability: DawCapabilityKey;
    parameters: Record<string, string | number>;
  }): DawAutomationCommandResult;
}

function sha256Hex(payload: string | Buffer): string {
  return createHash("sha256").update(payload).digest("hex").toUpperCase();
}

export class DawCapabilityRegistry {
  private readonly adapters = new Map<string, IDawAdapter>();

  public registerAdapter(adapter: IDawAdapter): this {
    this.adapters.set(adapter.dawId, adapter);
    return this;
  }

  public getAdapter(dawId: string): IDawAdapter {
    const adapter = this.adapters.get(dawId);
    if (!adapter) {
      throw new Error(`UNREGISTERED_DAW_ADAPTER: ${dawId}`);
    }
    return adapter;
  }

  public listAdapters(): IDawAdapter[] {
    return Array.from(this.adapters.values());
  }
}

/**
 * Production Target #1: FL Studio 2025 Replaceable Domain Adapter (ADR-0009)
 * Strictly refuses undocumented APIs, direct .flp binary mutation, or FLEngine_x64.dll injection.
 */
export class FlStudio2025DomainAdapter implements IDawAdapter {
  public readonly dawId = "fl-studio-2025";
  public readonly displayName = "Image-Line FL Studio 2025";
  public readonly targetVersion = "25.1.6.4997";

  public getCapabilities(): DawCapabilityDescriptor[] {
    return [
      {
        capability: "project_binary_readonly_inspect",
        supportLevel: "SUPPORTED_READONLY",
        mechanism: "Read-only FLhd / FLdt chunk parser (0xC7 FLP_Version event)",
        rationale: "Non-destructive binary header and event stream inspection.",
      },
      {
        capability: "midi_controller_script_bridge",
        supportLevel: "SUPPORTED_CONTROLLER_BRIDGE",
        mechanism: "Official FL Studio Python MIDI Controller Scripting API (transport, channels, mixer, plugins)",
        rationale: "Sanctioned Image-Line Python scripting bridge.",
      },
      {
        capability: "vst3_plugin_parameter_host_automation",
        supportLevel: "SUPPORTED_CONTROLLER_BRIDGE",
        mechanism: "Steinberg VST3 IParamValueQueue + FL Studio plugins.setParamValue()",
        rationale: "Standard VST3 parameter automation.",
      },
      {
        capability: "mixer_track_routing_inspect",
        supportLevel: "SUPPORTED_READONLY",
        mechanism: "Mixer routing DAG validator & Python mixer.getTrackInfo()",
        rationale: "Read-only mixer state verification.",
      },
      {
        capability: "midi_pattern_offline_transform",
        supportLevel: "SUPPORTED_EXPORT_IMPORT",
        mechanism: "Deterministic MIDI tick/velocity quantizer",
        rationale: "Safe out-of-project MIDI pattern transformation.",
      },
      {
        capability: "direct_flp_binary_mutation",
        supportLevel: "UNSUPPORTED_FORBIDDEN",
        mechanism: "BLOCKED",
        rationale: "Proprietary .flp binary mutation risks silent project corruption (ADR-0009).",
      },
      {
        capability: "fl_engine_dll_memory_injection",
        supportLevel: "UNSUPPORTED_FORBIDDEN",
        mechanism: "BLOCKED",
        rationale: "Process memory hooking into FLEngine_x64.dll violates platform security governance.",
      },
      {
        capability: "undocumented_window_message_spoofing",
        supportLevel: "UNSUPPORTED_FORBIDDEN",
        mechanism: "BLOCKED",
        rationale: "Fragile UI message spoofing is forbidden in production workflows.",
      },
    ];
  }

  public supportsCapability(capability: DawCapabilityKey): boolean {
    const desc = this.getCapabilities().find((c) => c.capability === capability);
    return desc !== undefined && desc.supportLevel !== "UNSUPPORTED_FORBIDDEN";
  }

  public inspectProjectReadOnly(projectFilePath: string): DawProjectInspectionReport {
    if (!existsSync(projectFilePath)) {
      throw new Error(`FLP_FILE_NOT_FOUND: ${projectFilePath}`);
    }
    const buf = readFileSync(projectFilePath);
    const sourceSha256 = sha256Hex(buf);

    if (buf.byteLength < 22 || buf.toString("ascii", 0, 4) !== "FLhd") {
      throw new Error("INVALID_FLP_HEADER_MAGIC");
    }
    const headerLen = buf.readUInt32LE(4);
    const channelCount = buf.readUInt16LE(10);
    const ppq = buf.readUInt16LE(12);

    const fldtOffset = 8 + headerLen;
    if (buf.toString("ascii", fldtOffset, fldtOffset + 4) !== "FLdt") {
      throw new Error("MISSING_FLDT_DATA_CHUNK");
    }

    // Scan first event in FLdt for 0xC7 (199 = FLP_Version)
    let dawVersionString = "unknown";
    let cursor = fldtOffset + 8;
    const maxScan = Math.min(buf.byteLength, cursor + 256);
    while (cursor < maxScan) {
      const eventId = buf[cursor]!;
      cursor += 1;
      if (eventId < 64) {
        cursor += 1;
      } else if (eventId < 128) {
        cursor += 2;
      } else if (eventId < 192) {
        cursor += 4;
      } else {
        // Variable length text/data event
        let len = 0;
        let shift = 0;
        while (cursor < maxScan) {
          const b = buf[cursor]!;
          cursor += 1;
          len |= (b & 0x7f) << shift;
          if ((b & 0x80) === 0) break;
          shift += 7;
        }
        if (eventId === 199 && cursor + len <= buf.byteLength) {
          dawVersionString = buf
            .subarray(cursor, cursor + len)
            .toString("utf8")
            .replace(/\0+$/, "");
          break;
        }
        cursor += len;
      }
    }

    return {
      dawId: this.dawId,
      projectPath: projectFilePath,
      projectFormatSignature: "FLhd/FLdt",
      dawVersionString,
      ppq,
      channelOrTrackCount: channelCount,
      sourceSha256,
      sourceBytesModified: 0,
    };
  }

  public executeCapabilityOperation(params: {
    capability: DawCapabilityKey;
    parameters: Record<string, string | number>;
  }): DawAutomationCommandResult {
    if (!this.supportsCapability(params.capability)) {
      return {
        allowed: false,
        dawId: this.dawId,
        capability: params.capability,
        errorCode: "DAW_CAPABILITY_UNSUPPORTED",
      };
    }

    if (
      params.capability === "midi_controller_script_bridge" ||
      params.capability === "vst3_plugin_parameter_host_automation"
    ) {
      const trackIndex = Number(params.parameters["trackIndex"] ?? 1);
      const slotIndex = Number(params.parameters["slotIndex"] ?? 0);
      const paramIndex = Number(params.parameters["paramIndex"] ?? 0);
      const normalizedValue = Number(params.parameters["normalizedValue"] ?? 0.5);

      const script = [
        "# name=AetherForge Governed Controller Bridge",
        "import mixer",
        "import plugins",
        "import transport",
        "",
        "def OnInit():",
        `    if plugins.isValid(${trackIndex}, ${slotIndex}):`,
        `        plugins.setParamValue(${normalizedValue.toFixed(4)}, ${paramIndex}, ${trackIndex}, ${slotIndex})`,
        "",
      ].join("\n");

      return {
        allowed: true,
        dawId: this.dawId,
        capability: params.capability,
        artifactType: "PYTHON_MIDI_CONTROLLER_SCRIPT",
        payload: script,
        payloadSha256: sha256Hex(script),
      };
    }

    const summary = JSON.stringify({ dawId: this.dawId, capability: params.capability, parameters: params.parameters });
    return {
      allowed: true,
      dawId: this.dawId,
      capability: params.capability,
      artifactType: "READONLY_INSPECTION_REPORT",
      payload: summary,
      payloadSha256: sha256Hex(summary),
    };
  }
}

/**
 * Replaceable Multi-DAW Target #2: Cockos REAPER (.rpp) Read-Only Domain Adapter
 * Proves that DAW_ADAPTER_FRAMEWORK is multi-DAW replaceable without hardcoding FL Studio.
 */
export class ReaperRppDomainAdapter implements IDawAdapter {
  public readonly dawId = "cockos-reaper";
  public readonly displayName = "Cockos REAPER";
  public readonly targetVersion = "7.x";

  public getCapabilities(): DawCapabilityDescriptor[] {
    return [
      {
        capability: "project_binary_readonly_inspect",
        supportLevel: "SUPPORTED_READONLY",
        mechanism: "Read-only <REAPER_PROJECT> S-expression parser",
        rationale: "Non-destructive .rpp project inspection.",
      },
      {
        capability: "vst3_plugin_parameter_host_automation",
        supportLevel: "SUPPORTED_CONTROLLER_BRIDGE",
        mechanism: "ReaScript / OSC parameter automation bridge",
        rationale: "Sanctioned REAPER automation API.",
      },
      {
        capability: "direct_flp_binary_mutation",
        supportLevel: "UNSUPPORTED_FORBIDDEN",
        mechanism: "BLOCKED",
        rationale: "Foreign DAW format mutation unsupported.",
      },
    ];
  }

  public supportsCapability(capability: DawCapabilityKey): boolean {
    const desc = this.getCapabilities().find((c) => c.capability === capability);
    return desc !== undefined && desc.supportLevel !== "UNSUPPORTED_FORBIDDEN";
  }

  public inspectProjectReadOnly(rppTextOrPath: string): DawProjectInspectionReport {
    const content = existsSync(rppTextOrPath) ? readFileSync(rppTextOrPath, "utf8") : rppTextOrPath;
    if (!content.includes("<REAPER_PROJECT")) {
      throw new Error("INVALID_REAPER_RPP_HEADER");
    }
    const trackMatches = content.match(/<TRACK\b/g) ?? [];
    const versionMatch = content.match(/<REAPER_PROJECT\s+[\d.]+\s+"([^"]+)"/);
    return {
      dawId: this.dawId,
      projectPath: rppTextOrPath,
      projectFormatSignature: "<REAPER_PROJECT>",
      dawVersionString: versionMatch?.[1] ?? "7.0",
      ppq: 960,
      channelOrTrackCount: trackMatches.length,
      sourceSha256: sha256Hex(content),
      sourceBytesModified: 0,
    };
  }

  public executeCapabilityOperation(params: {
    capability: DawCapabilityKey;
    parameters: Record<string, string | number>;
  }): DawAutomationCommandResult {
    if (!this.supportsCapability(params.capability)) {
      return {
        allowed: false,
        dawId: this.dawId,
        capability: params.capability,
        errorCode: "DAW_CAPABILITY_UNSUPPORTED",
      };
    }
    const payload = JSON.stringify({ dawId: this.dawId, capability: params.capability, parameters: params.parameters });
    return {
      allowed: true,
      dawId: this.dawId,
      capability: params.capability,
      artifactType: "READONLY_INSPECTION_REPORT",
      payload,
      payloadSha256: sha256Hex(payload),
    };
  }
}

/**
 * Track & Mixer Routing Graph Validator (Detects feedback loops and dangling buses)
 */
export function validateTrackRoutingGraph(tracks: DawTrackNode[]): {
  valid: boolean;
  hasFeedbackLoop: boolean;
  danglingTargetIds: string[];
  masterTrackReachable: boolean;
} {
  const trackMap = new Map<string, DawTrackNode>();
  for (const t of tracks) {
    trackMap.set(t.trackId, t);
  }

  const danglingTargetIds: string[] = [];
  for (const t of tracks) {
    for (const targetId of t.routedToTrackIds) {
      if (!trackMap.has(targetId)) {
        danglingTargetIds.push(targetId);
      }
    }
  }

  // DFS cycle detection
  const visited = new Set<string>();
  const inStack = new Set<string>();
  let hasFeedbackLoop = false;

  function dfs(nodeId: string): void {
    if (inStack.has(nodeId)) {
      hasFeedbackLoop = true;
      return;
    }
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    inStack.add(nodeId);
    const node = trackMap.get(nodeId);
    for (const nextId of node?.routedToTrackIds ?? []) {
      if (trackMap.has(nextId)) dfs(nextId);
    }
    inStack.delete(nodeId);
  }

  for (const t of tracks) {
    dfs(t.trackId);
  }

  const masterPresent = tracks.some((t) => t.role === "MASTER");
  return {
    valid: !hasFeedbackLoop && danglingTargetIds.length === 0 && masterPresent,
    hasFeedbackLoop,
    danglingTargetIds,
    masterTrackReachable: masterPresent,
  };
}

/**
 * Deterministic MIDI Pattern Quantization, Velocity Compression & Transposition
 */
export function transformMidiPattern(params: {
  notes: MidiNoteEvent[];
  quantizeGridTicks: number;
  transposeSemitones: number;
  velocityScale: number;
}): { notes: MidiNoteEvent[]; patternSha256: string } {
  const grid = Math.max(1, params.quantizeGridTicks);
  const transformed = params.notes.map((n) => {
    const quantizedStart = Math.round(n.startTick / grid) * grid;
    const clampedPitch = Math.max(0, Math.min(127, n.pitchMidi + params.transposeSemitones));
    const clampedVel = Math.max(1, Math.min(127, Math.round(n.velocity * params.velocityScale)));
    return {
      ...n,
      pitchMidi: clampedPitch,
      startTick: quantizedStart,
      velocity: clampedVel,
    };
  });

  return {
    notes: transformed,
    patternSha256: sha256Hex(JSON.stringify(transformed)),
  };
}
