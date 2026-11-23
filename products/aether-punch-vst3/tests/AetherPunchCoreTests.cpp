#include "AetherPunchCore.h"
#include <cassert>
#include <cmath>
#include <cstdio>
#include <limits>
#include <vector>

using aetherforge::aetherpunch::AetherPunchCore;

int main() {
    constexpr double kSr = 48000.0;
    constexpr int32_t kN = 2048;

    // 1. Transient Attack Boost Verification
    {
        AetherPunchCore coreNeutral;
        coreNeutral.prepareToPlay(kSr, kN);
        coreNeutral.setAttackDb(0.0f);
        coreNeutral.setDrivePct(0.0f);
        coreNeutral.setCeilingDb(-0.1f);
        coreNeutral.resetState();

        AetherPunchCore coreBoost;
        coreBoost.prepareToPlay(kSr, kN);
        coreBoost.setAttackDb(12.0f);
        coreBoost.setDrivePct(0.0f);
        coreBoost.setCeilingDb(-0.1f);
        coreBoost.resetState();

        std::vector<float> dryL(kN, 0.0f), dryR(kN, 0.0f);
        for (int32_t i = 0; i < kN; ++i) {
            const float env = i < 200 ? 0.25f : 0.25f * std::exp(-static_cast<float>(i - 200) / 800.0f);
            const float s = env * std::sin(2.0f * 3.14159265f * 400.0f * static_cast<float>(i) / static_cast<float>(kSr));
            dryL[static_cast<std::size_t>(i)] = s;
            dryR[static_cast<std::size_t>(i)] = s;
        }
        std::vector<float> boostL = dryL, boostR = dryR;
        float* ptrN[2] = {dryL.data(), dryR.data()};
        float* ptrB[2] = {boostL.data(), boostR.data()};

        coreNeutral.processBlock(ptrN, 2, kN);
        coreBoost.processBlock(ptrB, 2, kN);

        float peakN = 0.0f, peakB = 0.0f;
        for (int32_t i = 0; i < 256; ++i) {
            peakN = std::fmax(peakN, std::fabs(dryL[static_cast<std::size_t>(i)]));
            peakB = std::fmax(peakB, std::fabs(boostL[static_cast<std::size_t>(i)]));
        }
        assert(peakB > peakN * 1.25f);
    }

    // 2. Brickwall True-Peak Ceiling + Analog Saturation Verification (+6 dBFS hot input)
    {
        AetherPunchCore core;
        core.prepareToPlay(kSr, kN);
        core.setAttackDb(6.0f);
        core.setDrivePct(75.0f);
        core.setCeilingDb(-1.0f);
        core.setMixPct(100.0f);
        core.resetState();

        std::vector<float> L(kN), R(kN);
        for (int32_t i = 0; i < kN; ++i) {
            const float s = 2.0f * std::sin(2.0f * 3.14159265f * 1000.0f * static_cast<float>(i) / static_cast<float>(kSr));
            L[static_cast<std::size_t>(i)] = s;
            R[static_cast<std::size_t>(i)] = s;
        }
        float* ptrs[2] = {L.data(), R.data()};
        core.processBlock(ptrs, 2, kN);

        const float ceilingMax = AetherPunchCore::dbToLinear(-1.0f);
        for (int32_t i = 0; i < kN; ++i) {
            assert(std::isfinite(L[static_cast<std::size_t>(i)]));
            assert(std::fabs(L[static_cast<std::size_t>(i)]) <= ceilingMax + 1e-4f);
            assert(std::fabs(R[static_cast<std::size_t>(i)]) <= ceilingMax + 1e-4f);
        }
    }

    // 3. Adversarial NaN / Inf / Subnormal & Bypass Sanitization
    {
        AetherPunchCore core;
        core.prepareToPlay(kSr, 16);
        core.setBypass(true);
        float L[4] = {std::numeric_limits<float>::quiet_NaN(), std::numeric_limits<float>::infinity(), 1.0e-28f, 0.5f};
        float R[4] = {-std::numeric_limits<float>::infinity(), 0.25f, -1.0e-28f, -0.5f};
        float* ptrs[2] = {L, R};
        core.processBlock(ptrs, 2, 4);
        assert(L[0] == 0.0f && L[1] == 0.0f && L[2] == 0.0f && std::fabs(L[3] - 0.5f) < 1e-6f);
        assert(R[0] == 0.0f && std::fabs(R[1] - 0.25f) < 1e-6f && R[2] == 0.0f && std::fabs(R[3] + 0.5f) < 1e-6f);
    }

    // 4. 32-Byte POD State Save/Restore Round-Trip & Corruption Rejection
    {
        AetherPunchCore orig;
        orig.setAttackDb(7.5f);
        orig.setSustainDb(-4.25f);
        orig.setDrivePct(62.0f);
        orig.setCeilingDb(-1.5f);
        orig.setMixPct(80.0f);
        orig.setBypass(true);

        AetherPunchCore::SerializedState pod{};
        orig.getStateInformation(pod);

        AetherPunchCore restored;
        assert(restored.setStateInformation(pod));
        assert(std::fabs(restored.getAttackDb() - 7.5f) < 1e-5f);
        assert(std::fabs(restored.getSustainDb() + 4.25f) < 1e-5f);
        assert(std::fabs(restored.getDrivePct() - 62.0f) < 1e-5f);
        assert(std::fabs(restored.getCeilingDb() + 1.5f) < 1e-5f);
        assert(std::fabs(restored.getMixPct() - 80.0f) < 1e-5f);
        assert(restored.getBypass() == true);

        pod.magic = 0xDEADBEEFu;
        assert(!restored.setStateInformation(pod));
    }

    std::printf("AetherPunchCoreTests: ALL 4 DSP & STATE SUITES PASSED\n");
    return 0;
}
