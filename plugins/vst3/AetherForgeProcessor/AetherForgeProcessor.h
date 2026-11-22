#pragma once

#include <atomic>
#include <cmath>
#include <cstdint>
#include <cstring>

namespace aetherforge::vst3 {

/**
 * Isolated Real-Time C++20 VST3 Audio Processor Core (ADR-0008).
 * Real-time invariants:
 * - Zero heap allocations in processBlock
 * - Zero locks/mutexes in processBlock (lock-free std::atomic parameters only)
 * - Zero network, filesystem, IPC, or LLM calls anywhere in plugin binary
 */
class AetherForgeRealtimeCore final {
public:
    static constexpr uint32_t kStateMagic = 0x33564641u; // "AFV3" little-endian
    static constexpr uint32_t kStateVersion = 1u;

    struct SerializedState {
        uint32_t magic{kStateMagic};
        uint32_t version{kStateVersion};
        float gainDb{0.0f};
        uint8_t bypass{0u};
        uint8_t reserved[3]{0u, 0u, 0u};
    };

    AetherForgeRealtimeCore() noexcept = default;

    void prepareToPlay(double sampleRate, int32_t maxBlockSize) noexcept {
        sampleRate_.store(sampleRate > 0.0 ? sampleRate : 48000.0, std::memory_order_relaxed);
        maxBlockSize_.store(maxBlockSize > 0 ? maxBlockSize : 512, std::memory_order_relaxed);
    }

    void setGainDb(float db) noexcept {
        const float clamped = db < -60.0f ? -60.0f : (db > 24.0f ? 24.0f : db);
        gainDb_.store(clamped, std::memory_order_relaxed);
    }

    [[nodiscard]] float getGainDb() const noexcept {
        return gainDb_.load(std::memory_order_relaxed);
    }

    void setBypass(bool bypassed) noexcept {
        bypass_.store(bypassed, std::memory_order_relaxed);
    }

    [[nodiscard]] bool getBypass() const noexcept {
        return bypass_.load(std::memory_order_relaxed);
    }

    [[nodiscard]] static float dbToLinear(float db) noexcept {
        return std::pow(10.0f, db / 20.0f);
    }

    /**
     * Real-time audio callback: deterministic sample-accurate gain & clamp.
     * Strictly noexcept, lock-free, allocation-free, I/O-free.
     */
    void processBlock(float* const* channelBuffers, int32_t numChannels, int32_t numSamples) noexcept {
        if (channelBuffers == nullptr || numChannels <= 0 || numSamples <= 0) {
            return;
        }
        if (bypass_.load(std::memory_order_relaxed)) {
            return;
        }
        const float linearGain = dbToLinear(gainDb_.load(std::memory_order_relaxed));
        for (int32_t ch = 0; ch < numChannels; ++ch) {
            float* buffer = channelBuffers[ch];
            if (buffer == nullptr) {
                continue;
            }
            for (int32_t i = 0; i < numSamples; ++i) {
                const float scaled = buffer[i] * linearGain;
                buffer[i] = scaled < -1.0f ? -1.0f : (scaled > 1.0f ? 1.0f : scaled);
            }
        }
    }

    void getStateInformation(SerializedState& outState) const noexcept {
        outState.magic = kStateMagic;
        outState.version = kStateVersion;
        outState.gainDb = getGainDb();
        outState.bypass = getBypass() ? 1u : 0u;
        outState.reserved[0] = 0u;
        outState.reserved[1] = 0u;
        outState.reserved[2] = 0u;
    }

    bool setStateInformation(const SerializedState& inState) noexcept {
        if (inState.magic != kStateMagic || inState.version != kStateVersion) {
            return false;
        }
        if (!std::isfinite(inState.gainDb)) {
            return false;
        }
        setGainDb(inState.gainDb);
        setBypass(inState.bypass != 0u);
        return true;
    }

private:
    std::atomic<double> sampleRate_{48000.0};
    std::atomic<int32_t> maxBlockSize_{512};
    std::atomic<float> gainDb_{0.0f};
    std::atomic<bool> bypass_{false};
};

} // namespace aetherforge::vst3
