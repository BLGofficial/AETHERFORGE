# ADR-0008 — Local Audio Engine Separate from VST3

- **Status:** Accepted
- **Date:** 2026-11-22
- **Phase:** 00
- **Related Documents:** [ADR-0001](./0001-hybrid-control-plane.md) · [ADR-0010](./0010-release-integrity.md) · [REFERENCE-BOOK.md](../../REFERENCE-BOOK.md)

## Context

AETHER FORGE supports both offline audio batch/chain processing (inspecting WAV metadata, gain normalization, spectral analysis, offline stem rendering) and real-time in-DAW processing via a VST3 plugin. Combining orchestration/file batch processing and real-time DAW audio callbacks in a single runtime violates real-time audio deadlines and risks crashing the host DAW.

## Decision

We separate the audio stack into two distinct native targets that share deterministic DSP reference test vectors:
1. **Local Offline Audio Engine (Rust):** Executed as an isolated sidecar under the Windows Worker (`workers/audio-engine/`). Handles file validation, resource quotas, cancellation, and atomic file output using libraries such as `symphonia`, `rubato`, and `realfft` (with FFmpeg invoked only via a constrained wrapper if required).
2. **VST3 Real-Time Processor (C++20 / JUCE / Steinberg VST3 SDK):** Standalone binary (`plugins/vst3/AetherForgeProcessor/`) loaded by the customer's DAW. Implements `prepareToPlay` and `process(AudioBuffer)` with deterministic parameter/state serialization.

**Explicit Boundary Rule:** The VST3 real-time audio thread must **never** perform heap allocations, mutex locks, network calls, LLM requests, filesystem scans, or orchestration IPC.

## Alternatives Considered

- **Web Audio API only:** Rejected as insufficient for local private high-resolution audio workflows and native DAW hosting.
- **Embedding orchestration inside the VST3 plugin process:** Rejected because network timeouts or worker restarts inside a plugin can freeze or crash FL Studio 2025.
- **Node.js / JavaScript DSP:** Rejected due to garbage-collection pauses and lack of real-time thread safety.

## Consequences

- **Positive:** Host DAW stability is protected by strict C++20 real-time rules; offline Rust engine safely enforces CPU/memory quotas and atomic output files.
- **Negative / Trade-offs:** Shared DSP algorithms require cross-language golden WAV test vectors (`Rust cargo test` + C++ `Catch2` + `pluginval`).
