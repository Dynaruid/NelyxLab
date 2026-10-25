# SPDX-License-Identifier: BSD-3-Clause
cmake_minimum_required(VERSION 3.25)
project(nelyx_native_hermes LANGUAGES C CXX)
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_MSVC_RUNTIME_LIBRARY MultiThreadedDLL)
if(NOT WIN32 OR NOT CMAKE_SIZEOF_VOID_P EQUAL 8)
  message(FATAL_ERROR "Native Hermes host requires Windows x64")
endif()
foreach(input NELYX_HERMES_ROOT NELYX_SKIA_PACKAGE NELYX_SKIA_SUPPLIER)
  if(NOT IS_DIRECTORY "${${input}}")
    message(FATAL_ERROR "Missing verified input: ${input}")
  endif()
endforeach()
set(HERMES_SOURCE "${NELYX_HERMES_ROOT}/source")
set(HERMES_BUILD "${NELYX_HERMES_ROOT}/build")
set(SKIA "${NELYX_SKIA_PACKAGE}")
add_library(nelyx_host_skia STATIC
  "${SKIA}/native/vulkan/RNSkVulkanPlatformContext.cpp"
  "${SKIA}/generated/core/core.cpp" "${SKIA}/generated/core/paragraph_queries.cpp"
  "${SKIA}/generated/vulkan/device.cpp" "${SKIA}/generated/vulkan/gpu_context.cpp"
  "${SKIA}/cpp/rnskia/RNSkManager.cpp" "${SKIA}/cpp/rnskia/RNSkGraphiteProducer.cpp"
  "${SKIA}/cpp/jsi/JSICache.cpp" "${SKIA}/cpp/jsi/JsiPromises.cpp"
  "${SKIA}/cpp/jsi/Promise.cpp" "${SKIA}/cpp/jsi/ViewProperty.cpp"
  "${SKIA}/cpp/api/JsiSkDispatcher.cpp" "${SKIA}/cpp/api/third_party/CSSColorParser.cpp"
  "${SKIA}/cpp/api/third_party/base64.cpp" "${SKIA}/cpp/api/third_party/SkottieUtils.cpp")
target_include_directories(nelyx_host_skia PUBLIC
  "${HERMES_SOURCE}/API" "${HERMES_SOURCE}/API/jsi" "${HERMES_SOURCE}/public"
  "${SKIA}/cpp" "${SKIA}/cpp/api" "${SKIA}/cpp/jsi" "${SKIA}/cpp/rnskia" "${SKIA}/cpp/utils"
  "${SKIA}/generated/core" "${SKIA}/generated/gpu" "${SKIA}/generated/vulkan"
  "${SKIA}/generated/host" "${SKIA}/native/windows"
  "${SKIA}/native/vulkan" "${NELYX_SKIA_SUPPLIER}/headers")
target_compile_definitions(nelyx_host_skia PUBLIC NELYX_NATIVE_HOST=1 JSI_VERSION=21
  NELYX_SKOTTIE_PROPERTY_IMPLEMENTED=1 SK_GRAPHITE SK_VULKAN SK_USE_INTERNAL_VULKAN_HEADERS
  VK_NO_PROTOTYPES VK_USE_PLATFORM_WIN32_KHR NOMINMAX WIN32_LEAN_AND_MEAN
  SK_SHAPER_PRIMITIVE_AVAILABLE SK_SHAPER_HARFBUZZ_AVAILABLE SK_SHAPER_UNICODE_AVAILABLE SK_UNICODE_ICU_IMPLEMENTATION)
target_compile_options(nelyx_host_skia PRIVATE /bigobj /utf-8 /EHsc /wd4068 /wd4244 /wd4267 /wd4305)
if(NELYX_SKIA_INPUTS_CMAKE)
  include("${NELYX_SKIA_INPUTS_CMAKE}")
  target_link_libraries(nelyx_host_skia PUBLIC ${NELYX_SKIA_LIBRARIES})
else()
  file(READ "${NELYX_SKIA_SUPPLIER}/vendor-inputs.json" SUPPLIER_JSON)
  string(JSON LIBRARY_COUNT LENGTH "${SUPPLIER_JSON}" libraries)
  math(EXPR LIBRARY_LAST "${LIBRARY_COUNT}-1")
  foreach(i RANGE ${LIBRARY_LAST})
    string(JSON LIBRARY GET "${SUPPLIER_JSON}" libraries ${i})
    target_link_libraries(nelyx_host_skia PUBLIC "${NELYX_SKIA_SUPPLIER}/${LIBRARY}")
  endforeach()
endif()
add_executable(NelyxHermesHost main.cpp)
target_compile_options(NelyxHermesHost PRIVATE /bigobj /utf-8 /EHsc /wd4068 /wd4244 /wd4267 /wd4305)
target_link_libraries(NelyxHermesHost PRIVATE nelyx_host_skia
  "${HERMES_BUILD}/lib/hermesvm.lib" "${HERMES_BUILD}/jsi/jsi.lib"
  d3d11 dxgi dcomp dwmapi user32 gdi32 dwrite ole32 oleaut32 uuid usp10 shlwapi shell32 uiautomationcore imm32 comctl32 runtimeobject advapi32 bcrypt)
add_custom_command(TARGET NelyxHermesHost POST_BUILD COMMAND ${CMAKE_COMMAND} -E copy_if_different
  "${HERMES_BUILD}/lib/hermesvm.dll" "$<TARGET_FILE_DIR:NelyxHermesHost>/hermesvm.dll")
if(NELYX_HOST_TEST_SOURCE)
  get_filename_component(NELYX_HOST_TEST_DIRECTORY "${NELYX_HOST_TEST_SOURCE}" DIRECTORY)
  add_executable(NelyxNativeHostTests "${NELYX_HOST_TEST_SOURCE}" "${NELYX_HOST_TEST_DIRECTORY}/native-hermes-semantics.cpp" "${NELYX_HOST_TEST_DIRECTORY}/native-hermes-resources.cpp")
  target_include_directories(NelyxNativeHostTests PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}")
  target_compile_options(NelyxNativeHostTests PRIVATE /bigobj /utf-8 /EHsc /wd4068 /wd4244 /wd4267 /wd4305)
  target_link_libraries(NelyxNativeHostTests PRIVATE nelyx_host_skia "${HERMES_BUILD}/lib/hermesvm.lib" "${HERMES_BUILD}/jsi/jsi.lib" dwrite user32 ole32 oleaut32 uuid usp10 uiautomationcore)
endif()
