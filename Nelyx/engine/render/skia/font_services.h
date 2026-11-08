// Copyright 2026 Nelyx contributors. BSD-3-Clause.
#pragma once
#include <string>
#include <array>
#include <cstdint>
#include "include/core/SkRefCnt.h"
class SkFontMgr;
namespace nelyx::font_services {
// Native module owns ICU/cache setup; decoded fonts remain renderer assets.
void initialize(const std::string& icu);
sk_sp<SkFontMgr> manager();
}
