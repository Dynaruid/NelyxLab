# SPDX-License-Identifier: BSD-3-Clause
# Canonical binding target. The embedder supplies its verified JSI cohort,
# platform definitions and vendor libraries; the Engine owns no VM/window.
function(nelyx_add_vulkan_jsi_engine target)
  foreach(root NELYX_BINDING_CPP NELYX_BINDING_PLATFORM NELYX_BINDING_CORE NELYX_BINDING_GPU NELYX_BINDING_VULKAN NELYX_BINDING_HOST)
    if(NOT IS_DIRECTORY "${${root}}")
      message(FATAL_ERROR "Missing native Engine source owner: ${root}")
    endif()
  endforeach()
  add_library(${target} STATIC
    "${NELYX_BINDING_PLATFORM}/RNSkVulkanPlatformContext.cpp"
    "${NELYX_BINDING_VULKAN}/device.cpp" "${NELYX_BINDING_VULKAN}/gpu_context.cpp"
    "${NELYX_BINDING_CPP}/rnskia/RNSkManager.cpp" "${NELYX_BINDING_CPP}/rnskia/RNSkGraphiteProducer.cpp"
    "${NELYX_BINDING_CPP}/jsi/JSICache.cpp" "${NELYX_BINDING_CPP}/jsi/JsiPromises.cpp"
    "${NELYX_BINDING_CPP}/jsi/Promise.cpp" "${NELYX_BINDING_CPP}/jsi/ViewProperty.cpp"
    "${NELYX_BINDING_CPP}/api/JsiSkDispatcher.cpp" "${NELYX_BINDING_CPP}/api/third_party/CSSColorParser.cpp"
    "${NELYX_BINDING_CPP}/api/third_party/base64.cpp" "${NELYX_BINDING_CPP}/api/third_party/SkottieUtils.cpp")
  if(NELYX_BINDING_EMBED_CORE)
    target_sources(${target} PRIVATE "${NELYX_BINDING_CORE}/core.cpp" "${NELYX_BINDING_CORE}/paragraph_queries.cpp")
  endif()
  target_include_directories(${target} PUBLIC
    ${NELYX_BINDING_EXTERNAL_INCLUDES}
    "${NELYX_BINDING_CPP}" "${NELYX_BINDING_CPP}/api" "${NELYX_BINDING_CPP}/jsi"
    "${NELYX_BINDING_CPP}/rnskia" "${NELYX_BINDING_CPP}/utils"
    "${NELYX_BINDING_CORE}" "${NELYX_BINDING_GPU}" "${NELYX_BINDING_VULKAN}"
    "${NELYX_BINDING_HOST}" "${NELYX_BINDING_PLATFORM}")
endfunction()
