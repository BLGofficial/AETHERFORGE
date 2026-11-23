# AETHER FORGE — AUDIO, VST3 & DAW DOMAIN KNOWLEDGE PACKS (`DOMAIN_KNOWLEDGE_PACKS/README.md`)

Evidence-tagged (`verified_facts`, `engineering_recommendations`, `unverified_assumptions`) domain knowledge packs for ingestion into `@aether-forge/knowledge` (`ARCH-02`).

## Artifacts

- **[audio-domain-knowledge-pack.json](file:///C:/Users/blago/Desktop/AETHERFORGE/DOMAIN_KNOWLEDGE_PACKS/audio-domain-knowledge-pack.json)**: Curated knowledge corpus covering:
  1. **Subsystem A (Audio/DSP):** ITU-R BS.1770-4 loudness equations, RBJ Biquad Direct Form II Transposed stability, IEEE 754 denormal flushing (`FTZ`/`DAZ`), and inter-sample true-peak limiting.
  2. **Subsystem B (VST3 & JUCE 8):** Steinberg VST3 `IAudioProcessor` vs. `IEditController` thread isolation (`ADR-0008`), lock-free SPSC parameter queues, and `pluginval` strictness level 10 requirements.
  3. **Subsystem C (AI DAW Systems & FL Studio 2025):** Verified `FL64.exe` (`25.1.6.4997`) binary fingerprints, `.flp` `FLhd`/`FLdt` chunk structure, official FL Studio Python MIDI Controller Scripting API modules, and explicit prohibition of undocumented `.flp` binary mutation.
