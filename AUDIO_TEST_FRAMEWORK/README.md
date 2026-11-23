# AETHER FORGE — AUDIO, VST3 & DAW TEST FRAMEWORK (`AUDIO_TEST_FRAMEWORK/README.md`)

Specialized verification harness for **Audio/DSP (`DSP_ENGINE`)**, **VST3 Plugins (`VST3_ENGINE`)**, **Multi-DAW Adapters (`DAW_ADAPTER_FRAMEWORK`)**, and **Audio Domain Knowledge Packs (`DOMAIN_KNOWLEDGE_PACKS`)**.

## Verification Capabilities

1. **Null-Test Phase Cancellation (`runPhaseCancellationNullTest`):** Verifies that two signal paths cancel to $\le -120\text{ dBFS}$ when identical.
2. **Real-Time Audio Callback WCET Profiler (`profileRealtimeAudioCallbackWcet`):** Measures buffer execution time against the hardware deadline $T_{\text{deadline}} = N / f_s$ and enforces $\text{WCET} < 0.30 \times T_{\text{deadline}}$.
3. **Biquad Filter Frequency Attenuator Verification (`verifyFilterAttenuationDb`):** Verifies stopband attenuation vs. passband gain on analytical sine waves.

## Entry Points

- **[src/index.ts](file:///C:/Users/blago/Desktop/AETHERFORGE/AUDIO_TEST_FRAMEWORK/src/index.ts)**
- **[tests/audio-domain.test.ts](file:///C:/Users/blago/Desktop/AETHERFORGE/AUDIO_TEST_FRAMEWORK/tests/audio-domain.test.ts)**
