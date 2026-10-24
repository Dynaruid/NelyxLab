// Copyright 2026 Nelyx contributors. BSD-3-Clause.
#include "../../rendering/font_services.h"
#include <mutex>
#include <stdexcept>
#include "include/core/SkData.h"
#include "include/core/SkFontMgr.h"
#include "include/core/SkGraphics.h"
#include "include/core/SkTypeface.h"
#include "include/ports/SkFontMgr_empty.h"
namespace nelyx::font_services {
static std::mutex cacheMutex;
static bool configured=false;
void initialize(const std::string& icu){
  if(!icu.empty())throw std::runtime_error("Linux SDK embeds ICU; external payload must be empty");
  std::lock_guard lock(cacheMutex);
  if(!configured){SkGraphics::SetFontCacheLimit(4*1024*1024);SkGraphics::SetTypefaceCacheCountLimit(16);configured=true;}
}
sk_sp<SkFontMgr> manager(){
  auto manager=SkFontMgr_New_Custom_Empty();if(!manager)throw std::runtime_error("Linux FreeType font manager failed");
  return manager;
}
}
