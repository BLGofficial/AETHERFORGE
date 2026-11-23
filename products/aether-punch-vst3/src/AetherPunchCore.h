#pragma once

#include <atomic>
#include <cmath>
#include <cstddef>
#include <cstdint>

namespace aetherforge::aetherpunch {

/**
 * AETHER PUNCH — Production C++20 Lock-Free Real-Time DSP Core (ADR-0008)
 * Signal Chain:
 *   Input -> Stereo-Linked Dual-Envelope Transient Shaper (Attack / Sustain)
 *         -> Auto-Compensated Analog Tanh Soft-Clip Saturator (Drive)
 *         -> Brickwall True-Peak Ceiling Limiter (Ceiling)
 *         -> Parallel Dry/Wet Blend (Mix) -> Sanitized Output
 *
 * Real-Time Invariants (Plane 3):
 *   - Strictly noexcept, 0 heap allocations, 0 locks/mutexes, 0 syscalls/I/O
 *   - All host/controller parameter writes via lock-free std::atomic<float>
 *   - 1-pole exponential parameter smoothing prevents zipper noise
 *   - IEEE 754 subnormals (< 1e-15f) and NaN/Inf sanitized on every sample
 */
class AetherPunchCore final {
public:
    static constexpr uint32_t kStateMagic = 0x31565041u; // "APV1" little-endian
    static constexpr uint32_t kStateVersion = 1u;
    static constexpr float kDenormalEps = 1.0e-15f;

    struct SerializedState {
        uint32_t magic{kStateMagic};
        uint32_t version{kStateVersion};
        float attackDb{0.0f};      // -18.0 .. +18.0 dB
        float sustainDb{0.0f};     // -18.0 .. +18.0 dB
        float drivePct{15.0f};     //   0.0 .. 100.0 %
        float ceilingDb{-0.3f};    // -12.0 .. -0.1 dBTP
        float mixPct{100.0f};      //   0.0 .. 100.0 %
        uint8_t bypass{0u};
        uint8_t reserved[3]{0u, 0u, 0u};
    };

    AetherPunchCore() noexcept {
        updateCoefficients(48000.0);
    }

    void prepareToPlay(double sampleRateHz, int32_t maxBlockSize) noexcept {
        const double sr = sampleRateHz > 0.0 ? sampleRateHz : 48000.0;
        sampleRate_.store(sr, std::memory_order_relaxed);
        maxBlockSize_.store(maxBlockSize > 0 ? maxBlockSize : 512, std::memory_order_relaxed);
        updateCoefficients(sr);
        resetState();
    }

    void resetState() noexcept {
        fastEnv_ = 0.0f;
        medEnv_ = 0.0f;
        slowEnv_ = 0.0f;
        limGain_ = 1.0f;
        smoothAttackDb_ = attackDb_.load(std::memory_order_relaxed);
        smoothSustainDb_ = sustainDb_.load(std::memory_order_relaxed);
        smoothDrive_ = drivePct_.load(std::memory_order_relaxed) * 0.01f;
        smoothCeilingLin_ = dbToLinear(ceilingDb_.load(std::memory_order_relaxed) - 0.1f);
        smoothMix_ = mixPct_.load(std::memory_order_relaxed) * 0.01f;
    }

    void setAttackDb(float db) noexcept {
        attackDb_.store(clampf(db, -18.0f, 18.0f), std::memory_order_relaxed);
    }
    [[nodiscard]] float getAttackDb() const noexcept { return attackDb_.load(std::memory_order_relaxed); }

    void setSustainDb(float db) noexcept {
        sustainDb_.store(clampf(db, -18.0f, 18.0f), std::memory_order_relaxed);
    }
    [[nodiscard]] float getSustainDb() const noexcept { return sustainDb_.load(std::memory_order_relaxed); }

    void setDrivePct(float pct) noexcept {
        drivePct_.store(clampf(pct, 0.0f, 100.0f), std::memory_order_relaxed);
    }
    [[nodiscard]] float getDrivePct() const noexcept { return drivePct_.load(std::memory_order_relaxed); }

    void setCeilingDb(float db) noexcept {
        ceilingDb_.store(clampf(db, -12.0f, -0.1f), std::memory_order_relaxed);
    }
    [[nodiscard]] float getCeilingDb() const noexcept { return ceilingDb_.load(std::memory_order_relaxed); }

    void setMixPct(float pct) noexcept {
        mixPct_.store(clampf(pct, 0.0f, 100.0f), std::memory_order_relaxed);
    }
    [[nodiscard]] float getMixPct() const noexcept { return mixPct_.load(std::memory_order_relaxed); }

    void setBypass(bool bypassed) noexcept {
        bypass_.store(bypassed, std::memory_order_relaxed);
    }
    [[nodiscard]] bool getBypass() const noexcept { return bypass_.load(std::memory_order_relaxed); }

    [[nodiscard]] static float clampf(float x, float lo, float hi) noexcept {
        if (!std::isfinite(x)) return lo;
        return x < lo ? lo : (x > hi ? hi : x);
    }

    [[nodiscard]] static float sanitize(float x) noexcept {
        if (!std::isfinite(x) || std::fabs(x) < kDenormalEps) return 0.0f;
        return x;
    }

    [[nodiscard]] static float dbToLinear(float db) noexcept {
        return std::pow(10.0f, db * 0.05f);
    }

    /**
     * Real-Time Audio Callback (Plane 3).
     * Processes stereo/mono buffers in-place with zero allocations, zero locks, zero I/O.
     */
    void processBlock(float* const* channelBuffers, int32_t numChannels, int32_t numSamples) noexcept {
        if (channelBuffers == nullptr || numChannels <= 0 || numSamples <= 0) {
            return;
        }

        const bool isBypassed = bypass_.load(std::memory_order_relaxed);
        if (isBypassed) {
            for (int32_t ch = 0; ch < numChannels; ++ch) {
                float* buf = channelBuffers[ch];
                if (buf == nullptr) continue;
                for (int32_t i = 0; i < numSamples; ++i) {
                    buf[i] = sanitize(buf[i]);
                }
            }
            return;
        }

        const float targetAttackDb = attackDb_.load(std::memory_order_relaxed);
        const float targetSustainDb = sustainDb_.load(std::memory_order_relaxed);
        const float targetDrive = drivePct_.load(std::memory_order_relaxed) * 0.01f;
        // 0.1 dB true-peak safety headroom margin
        const float targetCeilingLin = dbToLinear(ceilingDb_.load(std::memory_order_relaxed) - 0.1f);
        const float targetMix = mixPct_.load(std::memory_order_relaxed) * 0.01f;

        for (int32_t i = 0; i < numSamples; ++i) {
            // 1-pole smooth parameter updates per sample
            smoothAttackDb_ = targetAttackDb + paramSmoothCoeff_ * (smoothAttackDb_ - targetAttackDb);
            smoothSustainDb_ = targetSustainDb + paramSmoothCoeff_ * (smoothSustainDb_ - targetSustainDb);
            smoothDrive_ = targetDrive + paramSmoothCoeff_ * (smoothDrive_ - targetDrive);
            smoothCeilingLin_ = targetCeilingLin + paramSmoothCoeff_ * (smoothCeilingLin_ - targetCeilingLin);
            smoothMix_ = targetMix + paramSmoothCoeff_ * (smoothMix_ - targetMix);

            // Stereo-linked peak detector
            float linkedAbs = 0.0f;
            for (int32_t ch = 0; ch < numChannels; ++ch) {
                float* buf = channelBuffers[ch];
                if (buf == nullptr) continue;
                const float dryClean = sanitize(buf[i]);
                buf[i] = dryClean;
                const float a = std::fabs(dryClean);
                if (a > linkedAbs) linkedAbs = a;
            }

            // Stage 1: Dual-envelope differential transient detector
            fastEnv_ = (linkedAbs > fastEnv_)
                ? (linkedAbs + fastAttackCoeff_ * (fastEnv_ - linkedAbs))
                : (linkedAbs + fastReleaseCoeff_ * (fastEnv_ - linkedAbs));
            medEnv_ = (linkedAbs > medEnv_)
                ? (linkedAbs + medAttackCoeff_ * (medEnv_ - linkedAbs))
                : (linkedAbs + medReleaseCoeff_ * (medEnv_ - linkedAbs));
            slowEnv_ = (linkedAbs > slowEnv_)
                ? (linkedAbs + slowAttackCoeff_ * (slowEnv_ - linkedAbs))
                : (linkedAbs + slowReleaseCoeff_ * (slowEnv_ - linkedAbs));

            fastEnv_ = sanitize(fastEnv_);
            medEnv_ = sanitize(medEnv_);
            slowEnv_ = sanitize(slowEnv_);

            // Attack transient ratio (fast > med) and Sustain tail ratio (slow > fast)
            const float attackDelta = fastEnv_ > medEnv_ ? (fastEnv_ - medEnv_) / (fastEnv_ + 0.02f) : 0.0f;
            const float sustainDelta = slowEnv_ > fastEnv_ ? (slowEnv_ - fastEnv_) / (slowEnv_ + 0.02f) : 0.0f;

            const float shapedGainDb =
                clampf(attackDelta * smoothAttackDb_ + sustainDelta * smoothSustainDb_, -24.0f, 24.0f);
            const float transientGain = dbToLinear(shapedGainDb);

            // Stage 2: Pre-compute saturation drive parameters
            const float preDrive = 1.0f + smoothDrive_ * 5.0f; // 1x to 6x drive
            const float satNorm = smoothDrive_ > 0.001f ? (1.0f / std::tanh(preDrive)) : 1.0f;

            // Compute post-saturation stereo peak for stereo-linked brickwall limiter
            float postSatPeak = 0.0f;
            float wetSamples[8]{};
            const int32_t maxCh = numChannels < 8 ? numChannels : 8;

            for (int32_t ch = 0; ch < maxCh; ++ch) {
                float* buf = channelBuffers[ch];
                if (buf == nullptr) continue;
                const float dry = buf[i];
                float w = dry * transientGain;
                if (smoothDrive_ > 0.001f) {
                    const float saturated = std::tanh(w * preDrive) * satNorm;
                    w = w * (1.0f - smoothDrive_) + saturated * smoothDrive_;
                }
                wetSamples[ch] = w;
                const float a = std::fabs(w);
                if (a > postSatPeak) postSatPeak = a;
            }

            // Stage 3: Instant-attack, smooth-release brickwall ceiling limiter
            const float desiredLimGain = postSatPeak > smoothCeilingLin_ ? (smoothCeilingLin_ / postSatPeak) : 1.0f;
            if (desiredLimGain < limGain_) {
                limGain_ = desiredLimGain; // Instantaneous brickwall catch
            } else {
                limGain_ = desiredLimGain + limReleaseCoeff_ * (limGain_ - desiredLimGain);
            }
            limGain_ = sanitize(limGain_);

            // Stage 4: Parallel Dry/Wet blend + final hard safety ceiling clamp
            const float dryMix = 1.0f - smoothMix_;
            for (int32_t ch = 0; ch < maxCh; ++ch) {
                float* buf = channelBuffers[ch];
                if (buf == nullptr) continue;
                const float dry = buf[i];
                const float limitedWet = wetSamples[ch] * limGain_;
                float out = dry * dryMix + limitedWet * smoothMix_;
                if (smoothMix_ >= 0.999f) {
                    out = clampf(out, -smoothCeilingLin_, smoothCeilingLin_);
                } else {
                    out = clampf(out, -1.0f, 1.0f);
                }
                buf[i] = sanitize(out);
            }
        }
    }

    void getStateInformation(SerializedState& outState) const noexcept {
        outState.magic = kStateMagic;
        outState.version = kStateVersion;
        outState.attackDb = getAttackDb();
        outState.sustainDb = getSustainDb();
        outState.drivePct = getDrivePct();
        outState.ceilingDb = getCeilingDb();
        outState.mixPct = getMixPct();
        outState.bypass = getBypass() ? 1u : 0u;
        outState.reserved[0] = 0u;
        outState.reserved[1] = 0u;
        outState.reserved[2] = 0u;
    }

    bool setStateInformation(const SerializedState& inState) noexcept {
        if (inState.magic != kStateMagic || inState.version != kStateVersion) {
            return false;
        }
        if (!std::isfinite(inState.attackDb) ||
            !std::isfinite(inState.sustainDb) ||
            !std::isfinite(inState.drivePct) ||
            !std::isfinite(inState.ceilingDb) ||
            !std::isfinite(inState.mixPct)) {
            return false;
        }
        setAttackDb(inState.attackDb);
        setSustainDb(inState.sustainDb);
        setDrivePct(inState.drivePct);
        setCeilingDb(inState.ceilingDb);
        setMixPct(inState.mixPct);
        setBypass(inState.bypass != 0u);
        return true;
    }

private:
    static float calcCoeff(double timeMs, double sampleRateHz) noexcept {
        const double tauSamples = (timeMs * 0.001) * sampleRateHz;
        return static_cast<float>(std::exp(-1.0 / (tauSamples > 1.0 ? tauSamples : 1.0)));
    }

    void updateCoefficients(double sr) noexcept {
        paramSmoothCoeff_ = calcCoeff(4.0, sr);
        fastAttackCoeff_ = calcCoeff(0.5, sr);
        fastReleaseCoeff_ = calcCoeff(8.0, sr);
        medAttackCoeff_ = calcCoeff(12.0, sr);
        medReleaseCoeff_ = calcCoeff(40.0, sr);
        slowAttackCoeff_ = calcCoeff(35.0, sr);
        slowReleaseCoeff_ = calcCoeff(180.0, sr);
        limReleaseCoeff_ = calcCoeff(45.0, sr);
    }

    std::atomic<double> sampleRate_{48000.0};
    std::atomic<int32_t> maxBlockSize_{512};
    std::atomic<float> attackDb_{0.0f};
    std::atomic<float> sustainDb_{0.0f};
    std::atomic<float> drivePct_{15.0f};
    std::atomic<float> ceilingDb_{-0.3f};
    std::atomic<float> mixPct_{100.0f};
    std::atomic<bool> bypass_{false};

    float paramSmoothCoeff_{0.99f};
    float fastAttackCoeff_{0.95f};
    float fastReleaseCoeff_{0.997f};
    float medAttackCoeff_{0.998f};
    float medReleaseCoeff_{0.9994f};
    float slowAttackCoeff_{0.9994f};
    float slowReleaseCoeff_{0.9998f};
    float limReleaseCoeff_{0.9995f};

    float fastEnv_{0.0f};
    float medEnv_{0.0f};
    float slowEnv_{0.0f};
    float limGain_{1.0f};

    float smoothAttackDb_{0.0f};
    float smoothSustainDb_{0.0f};
    float smoothDrive_{0.15f};
    float smoothCeilingLin_{0.955f};
    float smoothMix_{1.0f};
};

static_assert(sizeof(AetherPunchCore::SerializedState) == 32,
              "AetherPunchCore::SerializedState must be an exact 32-byte POD structure");

} // namespace aetherforge::aetherpunch
