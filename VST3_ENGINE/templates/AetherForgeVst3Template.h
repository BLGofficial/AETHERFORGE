#pragma once
#include <atomic>
#include <cmath>
#include <cstddef>
#include <cstdint>

namespace aetherforge::vst3 {

/**
 * AETHER FORGE — Reusable C++20 Lock-Free Real-Time VST3 Processor Template (ADR-0008)
 * Plane 3 Invariants:
 *  - Zero heap allocations inside processSamples() noexcept
 *  - Zero locks / mutexes / condition variables
 *  - Zero syscalls, file I/O, or network/LLM calls
 *  - IEEE 754 subnormals (< 1e-15f) flushed to 0.0f
 */
template <std::size_t MaxChannels = 2>
class LockFreeAudioCoreTemplate {
public:
    void prepare(double sampleRateHz) noexcept {
        sampleRate_ = sampleRateHz > 0.0 ? sampleRateHz : 48000.0;
        const float tauSamples = static_cast<float>(0.005 * sampleRate_);
        smoothCoeff_ = std::exp(-1.0f / (tauSamples > 1.0f ? tauSamples : 1.0f));
        for (std::size_t c = 0; c < MaxChannels; ++c) {
            z1_[c] = 0.0f;
            z2_[c] = 0.0f;
        }
    }

    void setTargetGainLinearAtomic(float gainLinear) noexcept {
        targetGainLinear_.store(gainLinear, std::memory_order_relaxed);
    }

    void setBypassAtomic(bool bypass) noexcept {
        bypass_.store(bypass, std::memory_order_relaxed);
    }

    void processSamples(float* const* channels, std::size_t numChannels, std::size_t numFrames) noexcept {
        const bool isBypassed = bypass_.load(std::memory_order_relaxed);
        const float targetGain = targetGainLinear_.load(std::memory_order_relaxed);
        const std::size_t activeCh = numChannels < MaxChannels ? numChannels : MaxChannels;

        for (std::size_t i = 0; i < numFrames; ++i) {
            currentGain_ = targetGain + smoothCoeff_ * (currentGain_ - targetGain);
            if (std::fabs(currentGain_) < 1.0e-15f) {
                currentGain_ = 0.0f;
            }
            for (std::size_t c = 0; c < activeCh; ++c) {
                float s = channels[c][i];
                if (!std::isfinite(s) || std::fabs(s) < 1.0e-15f) {
                    s = 0.0f;
                }
                channels[c][i] = isBypassed ? s : (s * currentGain_);
            }
        }
    }

private:
    double sampleRate_{48000.0};
    float smoothCoeff_{0.99f};
    float currentGain_{1.0f};
    float z1_[MaxChannels]{};
    float z2_[MaxChannels]{};
    std::atomic<float> targetGainLinear_{1.0f};
    std::atomic<bool> bypass_{false};
};

} // namespace aetherforge::vst3
