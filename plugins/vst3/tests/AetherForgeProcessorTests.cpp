#include "../AetherForgeProcessor/AetherForgeProcessor.h"
#include <cassert>
#include <cmath>

int main() {
    aetherforge::vst3::AetherForgeRealtimeCore core;
    core.prepareToPlay(48000.0, 256);
    core.setGainDb(5.0205999f); // -6.0206 dBFS -> -1.0 dBFS golden vector gain

    float ch0[4] = {0.5f, -0.5f, 0.25f, -0.25f};
    float* channels[1] = {ch0};
    core.processBlock(channels, 1, 4);

    assert(std::fabs(ch0[0] - 0.8912509f) < 1e-4f);

    aetherforge::vst3::AetherForgeRealtimeCore::SerializedState saved{};
    core.getStateInformation(saved);

    aetherforge::vst3::AetherForgeRealtimeCore restored;
    assert(restored.setStateInformation(saved));
    assert(std::fabs(restored.getGainDb() - core.getGainDb()) < 1e-6f);
    return 0;
}
