#include "AetherForgeProcessor.h"

namespace aetherforge::vst3 {

// Explicit translation unit anchoring AetherForgeRealtimeCore for CMake/JUCE target compilation.
static_assert(sizeof(AetherForgeRealtimeCore::SerializedState) == 16,
              "SerializedState must be an exact 16-byte POD structure");

} // namespace aetherforge::vst3
