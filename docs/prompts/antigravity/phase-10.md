# Antigravity Prompt — PHASE 10: VST3 Product Boundary

Source: [AETHER-FORGE-Engineering-Blueprint-v1.0.md](../../../AETHER-FORGE-Engineering-Blueprint-v1.0.md#phase-10--vst3-product-boundary)

```text
Create C++20/JUCE VST3 target only after licensing/SDK availability is confirmed. Implement minimal processor with deterministic parameter/state handling and no network, blocking, locks, allocations, filesystem scanning or model calls in audio callback. Keep orchestration outside plugin process.

Add CMake build, pluginval validation, host smoke test, parameter automation test, state round-trip test and DSP golden vectors shared with audio engine where meaningful. Gate: target builds and validation results are recorded; otherwise mark blocked with precise missing prerequisite.
```
