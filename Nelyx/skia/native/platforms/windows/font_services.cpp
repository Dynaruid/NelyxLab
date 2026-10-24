// Copyright 2026 Nelyx contributors. BSD-3-Clause.
#include "../../rendering/font_services.h"
#include <mutex>
#include <stdexcept>
#include "include/core/SkData.h"
#include "include/core/SkFontMgr.h"
#include "include/core/SkGraphics.h"
#include "include/core/SkTypeface.h"
#include "include/ports/SkTypeface_win.h"
extern "C" void C_SetICU(const void* data);
namespace nelyx::font_services {
static std::mutex icuMutex;
static sk_sp<SkData> icuData;
static std::string icuPath;
void initialize(const std::string& icu){
  std::lock_guard lock(icuMutex);
  if(!icuData){
    icuData=SkData::MakeFromFileName(icu.c_str());if(!icuData)throw std::runtime_error("ICU payload missing");
    icuPath=icu;C_SetICU(icuData->data());
    SkGraphics::SetFontCacheLimit(4*1024*1024);SkGraphics::SetTypefaceCacheCountLimit(16);
  }else if(icuPath!=icu)throw std::runtime_error("ICU payload identity differs from loaded module");
}
sk_sp<SkFontMgr> manager(){
  auto manager=SkFontMgr_New_DirectWrite();if(!manager)throw std::runtime_error("DirectWrite font manager failed");
  return manager;
}
}
