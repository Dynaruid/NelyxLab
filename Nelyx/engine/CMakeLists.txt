cmake_minimum_required(VERSION 3.22)
project(NelyxEngineV2 LANGUAGES C CXX)
option(NELYX_ENGINE_THREADED "Compile the separate shared-memory Wasm profile" OFF)
option(NELYX_ENGINE_BROWSER_HOST "Build the classic browser owner runtime" OFF)
option(NELYX_ENGINE_ANDROID_HOST "Build the standalone JNI/Hermes/Graphite host" OFF)
add_library(nelyx_engine_v2 STATIC
  core/protocol/engine.cpp core/protocol/transaction.cpp
  core/scheduler/scheduler.cpp core/scene/frame.cpp core/scene/snapshot.cpp core/scene/native_paint.cpp core/layout/layout.cpp core/layout/query.cpp
  core/interaction/editing.cpp core/interaction/interaction.cpp core/interaction/gestures.cpp core/interaction/canonical_gestures.cpp core/interaction/mouse_regions.cpp core/interaction/pointer_path.cpp core/interaction/tap_regions.cpp bindings/c_api.cpp)
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
    "-sEXPORTED_FUNCTIONS=['_nelyx_wasm_refresh_heap','_nelyx_wasm_open','_nelyx_wasm_dispatch','_nelyx_wasm_buffer_data','_nelyx_wasm_buffer_length','_nelyx_wasm_release','_nelyx_engine_destroy','_nelyx_engine_schema','_nelyx_engine_capabilities','_malloc','_free']"
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
      "-sEXPORTED_FUNCTIONS=['_nelyx_wasm_refresh_heap','_nelyx_wasm_open','_nelyx_wasm_dispatch','_nelyx_wasm_buffer_data','_nelyx_wasm_buffer_length','_nelyx_wasm_release','_nelyx_wasm_connect','_nelyx_engine_destroy','_nelyx_engine_schema','_nelyx_host_start','_nelyx_host_thread_id','_nelyx_host_exit','_malloc','_free']"
      "-sEXPORTED_RUNTIME_METHODS=['HEAPU8','UTF8ToString','stringToUTF8','lengthBytesUTF8']")
    if(NELYX_ENGINE_THREADED)
      target_link_options(nelyx_engine_browser PRIVATE -sPTHREAD_POOL_SIZE=2 -sPTHREAD_POOL_DELAY_LOAD=1
        "-sEXPORTED_RUNTIME_METHODS=['HEAPU8','PThread','UTF8ToString','stringToUTF8','lengthBytesUTF8']")
    endif()
  endif()
elseif(ANDROID AND NELYX_ENGINE_ANDROID_HOST)
  include(platform/android/host.cmake)
endif()
