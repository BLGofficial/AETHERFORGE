# AETHER FORGE — REUSABLE VST3 PLUGIN ENGINE (`VST3_ENGINE/README.md`)

Reusable **Steinberg VST3 (`3.7.x`) & JUCE (`8.0.x`) Plugin Engineering Subsystem (`SUBSYSTEM B`)** implementing the strict `IAudioProcessor` vs. `IEditController` split, normalized $[0, 1] \leftrightarrow$ physical parameter laws, sample-accurate automation queues, SHA-256-authenticated preset persistence, lock-free UI meter ring buffers, and host compatibility testing.

## Artifacts

- **[src/index.ts](file:///C:/Users/blago/Desktop/AETHERFORGE/VST3_ENGINE/src/index.ts)**: `Vst3ParameterRegistry`, `Vst3EditController`, `Vst3AudioProcessor`, `Vst3PresetManager`, and `Vst3HostCompatibilityHarness`.
- **[templates/AetherForgeVst3Template.h](file:///C:/Users/blago/Desktop/AETHERFORGE/VST3_ENGINE/templates/AetherForgeVst3Template.h)**: Reusable C++20 lock-free VST3 DSP processor template enforcing zero heap allocations, zero locks, and IEEE 754 denormal flushing on the audio thread.
