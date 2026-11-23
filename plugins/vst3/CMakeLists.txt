cmake_minimum_required(VERSION 3.24)
project(AetherForgeProcessor VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Gate rule (PHASE 10 / ADR-0008): auto-discover local aetherforge-sdk/JUCE if not explicitly passed
if(NOT DEFINED JUCE_SOURCE_DIR AND EXISTS "$ENV{USERPROFILE}/aetherforge-sdk/JUCE/CMakeLists.txt")
  file(TO_CMAKE_PATH "$ENV{USERPROFILE}/aetherforge-sdk/JUCE" JUCE_SOURCE_DIR)
endif()
if(NOT DEFINED JUCE_SOURCE_DIR OR NOT EXISTS "${JUCE_SOURCE_DIR}/CMakeLists.txt")
  message(FATAL_ERROR "BLOCKED_MISSING_PREREQUISITE: JUCE_SOURCE_DIR not provided or missing CMakeLists.txt")
endif()

add_subdirectory("${JUCE_SOURCE_DIR}" "${CMAKE_BINARY_DIR}/JUCE" EXCLUDE_FROM_ALL)

juce_add_plugin(AetherForgeProcessor
  COMPANY_NAME "AetherForge"
  IS_SYNTH FALSE
  NEEDS_MIDI_INPUT FALSE
  NEEDS_MIDI_OUTPUT FALSE
  IS_MIDI_EFFECT FALSE
  EDITOR_WANTS_KEYBOARD_FOCUS FALSE
  COPY_PLUGIN_AFTER_BUILD FALSE
  PLUGIN_MANUFACTURER_CODE AeFg
  PLUGIN_CODE AfPr
  FORMATS VST3
  PRODUCT_NAME "Aether Forge Processor"
)

target_sources(AetherForgeProcessor
  PRIVATE
    AetherForgeProcessor/AetherForgeProcessor.h
    AetherForgeProcessor/AetherForgeProcessor.cpp
)

target_compile_definitions(AetherForgeProcessor
  PUBLIC
    JUCE_WEB_BROWSER=0
    JUCE_USE_CURL=0
    JUCE_VST3_CAN_REPLACE_VST2=0
)

target_link_libraries(AetherForgeProcessor
  PRIVATE
    juce::juce_audio_utils
  PUBLIC
    juce::juce_recommended_config_flags
    juce::juce_recommended_lto_flags
    juce::juce_recommended_warning_flags
)
