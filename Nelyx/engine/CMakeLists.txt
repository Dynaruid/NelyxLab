cmake_minimum_required(VERSION 3.22)
project(NelyxEngineV2 LANGUAGES C CXX)
option(NELYX_ENGINE_THREADED "Compile the separate shared-memory Wasm profile" OFF)
option(NELYX_ENGINE_BROWSER_HOST "Build the classic browser owner runtime" OFF)
option(NELYX_ENGINE_WINDOWS_HOST "Build the HWND/Hermes/Skia host" OFF)
option(NELYX_ENGINE_ANDROID_HOST "Build the standalone JNI/Hermes/Graphite host" OFF)
add_library(nelyx_engine_v2 STATIC
  core/protocol/engine.cpp core/protocol/transaction.cpp
  core/scheduler/scheduler.cpp core/scene/frame.cpp core/scene/native_paint.cpp core/layout/layout.cpp core/layout/query.cpp
  core/interaction/editing.cpp core/interaction/interaction.cpp core/interaction/gestures.cpp core/interaction/canonical_gestures.cpp core/interaction/mouse_regions.cpp bindings/c_api.cpp)
target_compile_features(nelyx_engine_v2 PUBLIC cxx_std_20)
target_include_directories(nelyx_engine_v2 PUBLIC include)
if(MSVC)
  target_compile_options(nelyx_engine_v2 PRIVATE /W4 /WX /EHsc /fp:strict)
else()
  target_compile_options(nelyx_engine_v2 PRIVATE -Wall -Wextra -Werror -fno-fast-math -fexceptions)
endif()
if(EMSCRIPTEN)
  if(NELYX_ENGINE_THREADED)
    target_compile_options(nelyx_engine_v2 PUBLIC -pthread)
    target_link_options(nelyx_engine_v2 PUBLIC -pthread)
  endif()
  add_executable(nelyx_engine_wasm bindings/wasm.cpp)
  target_link_libraries(nelyx_engine_wasm PRIVATE nelyx_engine_v2)
  set_target_properties(nelyx_engine_wasm PROPERTIES OUTPUT_NAME engine SUFFIX .mjs)
  target_compile_options(nelyx_engine_wasm PRIVATE -fexceptions)
  if(NELYX_ENGINE_THREADED)
    target_link_options(nelyx_engine_wasm PRIVATE -sPTHREAD_POOL_SIZE=0)
  endif()
  target_link_options(nelyx_engine_wasm PRIVATE --no-entry -fexceptions
    -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web,worker,node
    -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=33554432 -sMAXIMUM_MEMORY=268435456
    -sSTACK_SIZE=1048576 -sASSERTIONS=1
    "-sEXPORTED_FUNCTIONS=['_nelyx_wasm_open','_nelyx_wasm_dispatch','_nelyx_wasm_buffer_data','_nelyx_wasm_buffer_length','_nelyx_wasm_release','_nelyx_engine_destroy','_nelyx_engine_schema','_nelyx_engine_capabilities','_malloc','_free']"
    "-sEXPORTED_RUNTIME_METHODS=['HEAPU8']")
  if(NELYX_ENGINE_BROWSER_HOST)
    add_executable(nelyx_engine_browser bindings/wasm.cpp bindings/browser_owners.cpp)
    target_link_libraries(nelyx_engine_browser PRIVATE nelyx_engine_v2)
    set_target_properties(nelyx_engine_browser PROPERTIES OUTPUT_NAME engine-browser SUFFIX .js)
    target_compile_options(nelyx_engine_browser PRIVATE -fexceptions)
    target_link_options(nelyx_engine_browser PRIVATE --no-entry -fexceptions
      -sMODULARIZE=1 -sEXPORT_NAME=NelyxEngineModule -sENVIRONMENT=worker
      -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=33554432 -sMAXIMUM_MEMORY=268435456
      -sSTACK_SIZE=1048576 -sASSERTIONS=1
      "-sEXPORTED_FUNCTIONS=['_nelyx_wasm_open','_nelyx_wasm_dispatch','_nelyx_wasm_buffer_data','_nelyx_wasm_buffer_length','_nelyx_wasm_release','_nelyx_wasm_connect','_nelyx_engine_destroy','_nelyx_engine_schema','_nelyx_host_start','_nelyx_host_thread_id','_nelyx_host_exit','_malloc','_free']"
      "-sEXPORTED_RUNTIME_METHODS=['HEAPU8','UTF8ToString','stringToUTF8','lengthBytesUTF8']")
    if(NELYX_ENGINE_THREADED)
      target_link_options(nelyx_engine_browser PRIVATE -sPTHREAD_POOL_SIZE=2 -sPTHREAD_POOL_DELAY_LOAD=1
        "-sEXPORTED_RUNTIME_METHODS=['HEAPU8','PThread','UTF8ToString','stringToUTF8','lengthBytesUTF8']")
    endif()
  endif()
elseif(ANDROID AND NELYX_ENGINE_ANDROID_HOST)
  include(platform/android/host.cmake)
else()
  if(WIN32)
    add_executable(nelyx_engine_clipboard_test tests/windows-clipboard.cpp)
    target_compile_features(nelyx_engine_clipboard_test PRIVATE cxx_std_20)
    target_compile_definitions(nelyx_engine_clipboard_test PRIVATE NOMINMAX)
    target_link_libraries(nelyx_engine_clipboard_test PRIVATE user32)
  endif()
  add_executable(nelyx_engine_driver tests/native-driver.cpp)
  target_link_libraries(nelyx_engine_driver PRIVATE nelyx_engine_v2)
  add_executable(nelyx_engine_abi_test tests/abi-consumer.c)
  target_link_libraries(nelyx_engine_abi_test PRIVATE nelyx_engine_v2)
  if(NELYX_ENGINE_WINDOWS_HOST)
    if(NOT WIN32 OR NOT EXISTS "${NELYX_SKIA_SUPPLIER}/headers/include/core/SkCanvas.h" OR NOT EXISTS "${NELYX_HERMES_ROOT}/build/lib/hermesvm.lib")
      message(FATAL_ERROR "The Windows host requires the pinned Skia and Hermes suppliers")
    endif()
    add_executable(NelyxEngineV2Host platform/windows/host.cpp
      ../skia/native/core/paragraph_queries.cpp
      ../skia/native/platforms/vulkan/device.cpp ../skia/native/platforms/windows/font_services.cpp)
    target_compile_features(NelyxEngineV2Host PRIVATE cxx_std_20)
    target_compile_options(NelyxEngineV2Host PRIVATE /EHsc /utf-8)
    target_compile_definitions(NelyxEngineV2Host PRIVATE UNICODE _UNICODE NOMINMAX
      SK_GRAPHITE SK_VULKAN SK_USE_INTERNAL_VULKAN_HEADERS VK_NO_PROTOTYPES VK_USE_PLATFORM_WIN32_KHR
      _WIN32_WINNT=0x0A00 JSI_USE_HERMES)
    target_include_directories(NelyxEngineV2Host PRIVATE "${NELYX_SKIA_SUPPLIER}/headers"
      ../skia/native/core
      "${NELYX_HERMES_ROOT}/source/API" "${NELYX_HERMES_ROOT}/source/API/jsi"
      "${NELYX_HERMES_ROOT}/source/public")
    file(GLOB skia_libraries "${NELYX_SKIA_SUPPLIER}/libraries/*.lib")
    target_link_libraries(NelyxEngineV2Host PRIVATE nelyx_engine_v2 ${skia_libraries}
      "${NELYX_HERMES_ROOT}/build/lib/hermesvm.lib" "${NELYX_HERMES_ROOT}/build/jsi/jsi.lib"
      user32 gdi32 dwrite ole32 oleaut32 uuid usp10 shell32 advapi32 shlwapi opengl32 windowscodecs UIAutomationCore runtimeobject dwmapi)
  endif()
endif()
