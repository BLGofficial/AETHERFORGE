# AETHER FORGE — REUSABLE DSP ENGINE (`DSP_ENGINE/README.md`)

Reusable, deterministic Digital Signal Processing (DSP) subsystem (`SUBSYSTEM A`) providing audio ingestion, analytical signal synthesis, composable 64-bit float DSP algorithms, RIFF WAV rendering, real-time WCET deadline analysis, and ITU-R BS.1770-4 measurement.

## Components

- **Audio Ingestion & Rendering:** `createAudioBuffer()`, `encodeDeterministicWavPcm24()`, `decodeWavToAudioBuffer()`, `generateSineWave()`, `generateDiracImpulse()`, `generateTransientBurst()`.
- **DSP Algorithm Library:**
  - `BiquadFilterDsp` (RBJ Audio EQ Cookbook: `LOWPASS`, `HIGHPASS`, `BANDPASS`, `NOTCH`, `PEAKING_EQ`, `LOW_SHELF`, `HIGH_SHELF`)
  - `DynamicsCompressorDsp` (Feed-forward soft-knee compressor with attack/release ballistics)
  - `TransientShaperDsp` (Dual-envelope differential attack/sustain shaper)
  - `BrickwallLimiterDsp` (True-peak ceiling limiter with exponential release)
  - `ParameterSmootherDsp` (1-pole exponential parameter smoother)
- **Composable Processing Pipeline:** `ComposableDspPipeline` with dry/wet mix, IEEE 754 denormal flushing (`< 1e-15`), and `NaN`/`Inf` sanitization.
- **Measurement & Validation:** `analyzeAudioBuffer()` and `validateAudioAgainstThresholds()`.

## Entry Point

- **[src/index.ts](file:///C:/Users/blago/Desktop/AETHERFORGE/DSP_ENGINE/src/index.ts)**
