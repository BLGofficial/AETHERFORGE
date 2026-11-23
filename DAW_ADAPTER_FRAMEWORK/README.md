# AETHER FORGE — MULTI-DAW ADAPTER FRAMEWORK (`DAW_ADAPTER_FRAMEWORK/README.md`)

Reusable, capability-negotiated **AI DAW Systems Framework (`SUBSYSTEM C`)** decoupling DAW domain operations from any single host via replaceable adapters (`IDawAdapter`).

## Core Capabilities

- **DAW Capability Registry (`DawCapabilityRegistry`):** Negotiates supported vs. unsupported operations (`SUPPORTED_READONLY`, `SUPPORTED_CONTROLLER_BRIDGE`, `SUPPORTED_EXPORT_IMPORT`, `UNSUPPORTED_FORBIDDEN`) before execution.
- **Production Adapter #1 — FL Studio 2025 (`FlStudio2025DomainAdapter`):**
  - Verifies installed FL Studio 2025 (`25.1.6.4997` at `C:\Program Files\Image-Line\FL Studio 2025\FL64.exe`).
  - Performs strictly read-only `.flp` (`FLhd`/`FLdt` + `0xC7` version event) project inspection.
  - Generates deterministic FL Studio Python MIDI Controller automation scripts (`transport`, `channels`, `mixer`, `patterns`, `plugins`).
  - **Zero Undocumented Assumptions:** Fail-closed refusal (`DAW_CAPABILITY_UNSUPPORTED`) on `direct_flp_binary_mutation`, `fl_engine_dll_memory_injection`, or undocumented IPC spoofing.
- **Replaceable Adapter #2 — Cockos REAPER (`ReaperRppDomainAdapter`):** Demonstrates multi-DAW replaceability through the identical `IDawAdapter` contract.
- **Track & Mixer Routing Model (`validateTrackRoutingGraph`):** Validates audio/MIDI/bus/master routing DAGs and detects feedback loops.
- **MIDI & Plugin Control Operations (`transformMidiPattern`, `buildPluginParameterAutomationBridge`).**

## Entry Point

- **[src/index.ts](file:///C:/Users/blago/Desktop/AETHERFORGE/DAW_ADAPTER_FRAMEWORK/src/index.ts)**
