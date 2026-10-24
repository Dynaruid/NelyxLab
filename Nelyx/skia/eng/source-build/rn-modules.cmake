# SPDX-License-Identifier: BSD-3-Clause
# Explicit CPU module supplement for the locked m153 Graphite core.
# Original GN source lists and licenses are retained by prepare-rn-modules.py.
if(NOT TARGET nelyx_vendor_skia OR NOT DEFINED NELYX_RN_MODULE_SOURCE_ROOT)
  message(FATAL_ERROR "Prepare the pinned native Vulkan SDK and original m153 module inputs first")
endif()
# Original libwebp CMake owns its source selection and CPU feature checks.
# These options are local to this directory; no command-line tools or downloads.
enable_language(C)
if(TARGET webp OR TARGET webpdemux OR TARGET libwebpmux)
  message(FATAL_ERROR "The pinned WebP supplement must own one libwebp revision")
endif()
set(BUILD_SHARED_LIBS OFF)
set(WEBP_LINK_STATIC ON)
foreach(option IN ITEMS ANIM_UTILS CWEBP DWEBP GIF2WEBP IMG2WEBP VWEBP WEBPINFO WEBPMUX EXTRAS WEBP_JS)
  set(WEBP_BUILD_${option} OFF)
endforeach()
set(WEBP_BUILD_LIBWEBPMUX ON)
set(CMAKE_POLICY_DEFAULT_CMP0077 NEW)
set(CMAKE_POLICY_DEFAULT_CMP0091 NEW)
add_subdirectory("${NELYX_RN_WEBP_SOURCE_ROOT}" "${CMAKE_CURRENT_BINARY_DIR}/libwebp")
foreach(module IN ITEMS SVG SKOTTIE SKSG SKRESOURCES JSONREADER WEBP)
  string(TOLOWER "${module}" lower)
  add_library(nelyx_rn_module_${lower} STATIC ${NELYX_RN_${module}_SOURCES})
  target_compile_features(nelyx_rn_module_${lower} PUBLIC cxx_std_20)
  set_property(TARGET nelyx_rn_module_${lower} PROPERTY POSITION_INDEPENDENT_CODE ON)
  target_include_directories(nelyx_rn_module_${lower} PRIVATE "${NELYX_RN_MODULE_SOURCE_ROOT}")
  target_compile_definitions(nelyx_rn_module_${lower} PRIVATE SK_GRAPHITE SK_VULKAN SK_ENABLE_SVG
    SK_ENABLE_SKOTTIE SK_ENABLE_SKOTTIE_SKSLEFFECT SK_USE_INTERNAL_VULKAN_HEADERS VK_NO_PROTOTYPES SKIA_IMPLEMENTATION=1)
  # Public configs of the matching GN skshaper/skunicode text targets.
  target_compile_definitions(nelyx_rn_module_${lower} PUBLIC SK_SHAPER_PRIMITIVE_AVAILABLE
    SK_SHAPER_HARFBUZZ_AVAILABLE SK_SHAPER_UNICODE_AVAILABLE SK_UNICODE_ICU_IMPLEMENTATION)
  target_link_libraries(nelyx_rn_module_${lower} PUBLIC ${NELYX_SKIA_VENDOR_LIBRARIES})
  if(MSVC)
    set_property(TARGET nelyx_rn_module_${lower} PROPERTY MSVC_RUNTIME_LIBRARY MultiThreadedDLL)
    target_compile_options(nelyx_rn_module_${lower} PRIVATE /bigobj /utf-8 /GR-)
  else()
    # Original gn/BUILDCONFIG.gn selects gn/skia:no_rtti. In particular,
    # SkWebpCodec derives from the prebuilt SkCodec, which exports no RTTI.
    target_compile_options(nelyx_rn_module_${lower} PRIVATE -fno-rtti)
  endif()
endforeach()
target_link_libraries(nelyx_rn_module_svg PUBLIC nelyx_rn_module_skresources)
target_link_libraries(nelyx_rn_module_skottie PUBLIC nelyx_rn_module_sksg nelyx_rn_module_skresources nelyx_rn_module_jsonreader)
target_link_libraries(nelyx_rn_module_webp PUBLIC webp webpdemux libwebpmux)
set(NELYX_SKIA_RN_MODULE_LIBRARIES nelyx_rn_module_skottie nelyx_rn_module_svg nelyx_rn_module_webp)
