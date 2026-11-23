# AETHER PUNCH (`v1.0.0`) — Flagship Native VST3 Plugin Built by AETHER FORGE

**Aether Punch** is the first standalone production audio product compiled, built, verified, and attested end-to-end through the **AETHER FORGE** platform.

## Signal Processing Chain (Real-Time C++20, `ADR-0008` Compliant)
1. **Stereo-Linked Dual-Envelope Transient Shaper:** `Attack` (`-18..+18 dB`) & `Sustain` (`-18..+18 dB`) differential envelope detectors ($\tau_{\text{fast}} = 0.5/8\text{ ms}$, $\tau_{\text{med}} = 12/40\text{ ms}$, $\tau_{\text{slow}} = 35/180\text{ ms}$).
2. **Analog `tanh` Soft-Clip Saturator:** `Drive` (`0..100%`) with automatic gain compensation (`1 / tanh(drive)`).
3. **Brickwall True-Peak Ceiling Limiter:** `Ceiling` (`-12.0..-0.1 dBTP`) with instantaneous catch, 45 ms release, and 0.1 dB inter-sample headroom margin.
4. **Parallel NY-Style Blend & Bypass:** `Mix` (`0..100%`) and `Bypass` (`Off/On`) with 4 ms 1-pole parameter smoothing and IEEE 754 subnormal (`< 1e-15f`) + `NaN`/`Inf` sanitization.

## Loading in FL Studio 2025 (Windows x64)
Copy the verified standalone bundle `products/aether-punch-vst3/dist/AetherPunch.vst3` into:
```text
C:\Program Files\Common Files\VST3\AetherPunch.vst3
```
(Or add `C:\Users\blago\Desktop\AETHERFORGE\products\aether-punch-vst3\dist` as a VST3 search folder in FL Studio 2025 **Plugin Manager → Find installed plugins** — requires zero admin privileges!)
