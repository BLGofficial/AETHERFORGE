# Antigravity Prompt — PHASE 08: Audio/DSP Offline Vertical Slice

Source: [AETHER-FORGE-Engineering-Blueprint-v1.0.md](../../../AETHER-FORGE-Engineering-Blueprint-v1.0.md#phase-08--audiodsp-offline-vertical-slice)

```text
Implement local Rust audio engine contract and one safe offline operation: inspect WAV metadata, then optional deterministic gain-normalization to a new atomic output inside granted workspace. Include resource limits, cancellation, format validation and evidence hash. No cloud audio transfer by default.

Use golden fixtures and audio-tolerance tests. Wire approved AudioJob through worker and orchestration. Gate: original never changes; cancellation produces no published partial file; output/provenance are reproducible.
```
