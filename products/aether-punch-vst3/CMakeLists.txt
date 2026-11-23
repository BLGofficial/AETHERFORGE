cmake_minimum_required(VERSION 3.24)
project(AetherPunch VERSION 1.0.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(NOT DEFINED VST3_SDK_DIR OR NOT EXISTS "${VST3_SDK_DIR}/CMakeLists.txt")
    message(FATAL_ERROR "BLOCKED_MISSING_PREREQUISITE: VST3_SDK_DIR not provided or missing CMakeLists.txt")
endif()

set(SMTG_ENABLE_VSTGUI_SUPPORT OFF CACHE BOOL "" FORCE)
set(SMTG_ENABLE_VST3_PLUGIN_EXAMPLES OFF CACHE BOOL "" FORCE)
set(SMTG_ENABLE_VST3_HOSTING_EXAMPLES OFF CACHE BOOL "" FORCE)
set(SMTG_RUN_VST_VALIDATOR OFF CACHE BOOL "" FORCE)
set(SMTG_CREATE_PLUGIN_LINK OFF CACHE BOOL "" FORCE)
set(SMTG_CREATE_MODULE_INFO OFF CACHE BOOL "" FORCE)
set(SMTG_CREATE_BUNDLE_FOR_WINDOWS OFF CACHE BOOL "" FORCE)

add_subdirectory("${VST3_SDK_DIR}" "${CMAKE_BINARY_DIR}/vst3sdk" EXCLUDE_FROM_ALL)

set(AETHER_PUNCH_SOURCES
    "${CMAKE_CURRENT_SOURCE_DIR}/src/AetherPunchVst3Entry.cpp"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/AetherPunchCore.h"
    "${VST3_SDK_DIR}/public.sdk/source/vst/vstsinglecomponenteffect.cpp"
    "${VST3_SDK_DIR}/public.sdk/source/vst/vstsinglecomponenteffect.h"
)

smtg_add_vst3plugin(AetherPunch ${AETHER_PUNCH_SOURCES})
target_include_directories(AetherPunch PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}/src")
target_link_libraries(AetherPunch PRIVATE sdk)
target_link_options(AetherPunch PRIVATE -static)

add_executable(AetherPunchCoreTests
    "${CMAKE_CURRENT_SOURCE_DIR}/tests/AetherPunchCoreTests.cpp"
)
target_include_directories(AetherPunchCoreTests PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}/src")
target_link_options(AetherPunchCoreTests PRIVATE -static)
