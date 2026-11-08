// SPDX-License-Identifier: BSD-3-Clause
#include "../../render/skia/font_services.h"
#include "include/core/SkFontMgr.h"
#include "include/core/SkGraphics.h"
#include "include/ports/SkFontMgr_android.h"
#include "include/ports/SkFontScanner_FreeType.h"
#include <stdexcept>
namespace nelyx::font_services {
// The pinned Android SkUnicode provider resolves the system ICU ABI itself.
void initialize(const std::string&){SkGraphics::SetFontCacheLimit(4*1024*1024);SkGraphics::SetTypefaceCacheCountLimit(16);}
sk_sp<SkFontMgr> manager(){auto value=SkFontMgr_New_Android(nullptr,SkFontScanner_Make_FreeType());if(!value)throw std::runtime_error("Android font manager unavailable");return value;}
}
