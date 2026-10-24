#pragma once

#include <memory>
#include <optional>
#include <string>
#include <utility>

#include <jsi/jsi.h>

#include "JsiSkConverters.h"
#include "JsiSkFontStyle.h"
#include "JsiSkFontMgrFactory.h"
#include "JsiSkNativeObjects.h"
#include "JsiSkTypeface.h"

#include "utils/RNSkLog.h"

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdocumentation"

#include "include/core/SkFont.h"
#include "modules/skparagraph/include/TypefaceFontProvider.h"
#include "modules/skparagraph/include/FontCollection.h"

#pragma clang diagnostic pop

namespace RNSkia {

namespace jsi = facebook::jsi;
namespace para = skia::textlayout;

class JsiSkTypefaceFontProvider
    : public JsiSkWrappingSkPtrNativeObject<JsiSkTypefaceFontProvider,
                                            para::TypefaceFontProvider> {
public:
  static constexpr const char *CLASS_NAME = "TypefaceFontProvider";

  void registerFont(sk_sp<SkTypeface> typeface, std::string familyNameStr) {
    SkString familyName(familyNameStr.c_str());
    getObject()->registerTypeface(typeface, familyName);
    _paragraphFonts.reset();
    _paragraphBuilders = 0;
  }

  sk_sp<para::FontCollection> paragraphFonts() {
    auto provider = getObject(); // A disposed provider cannot serve cached data.
    // Share resolved typefaces across a bounded run of Core paragraph builds.
    // Existing paragraphs keep their own collection reference when this rolls.
    if (!_paragraphFonts || _paragraphBuilders >= 16) {
      auto fonts = sk_make_sp<para::FontCollection>();
      fonts->setDefaultFontManager(JsiSkFontMgrFactory::getFontMgr(getContext()));
      fonts->setAssetFontManager(std::move(provider));
      fonts->enableFontFallback();
      // Reuse font matching, without retaining an additional text-shape cache.
      fonts->getParagraphCache()->turnOn(false);
      _paragraphFonts = std::move(fonts);
      _paragraphBuilders = 0;
    }
    ++_paragraphBuilders;
    return _paragraphFonts;
  }

  std::shared_ptr<JsiSkTypeface>
  matchFamilyStyle(std::optional<std::string> nameParam,
                   std::optional<std::shared_ptr<SkFontStyle>> fontStyleParam) {
    auto name = nameParam.value_or("");
    auto fontStyle = fontStyleParam.value_or(nullptr);
    if (name == "" || fontStyle == nullptr) {
      throw std::runtime_error("matchFamilyStyle requires a name and a style");
    }
    auto set = getObject()->onMatchFamily(name.c_str());
    if (!set) {
      throw std::runtime_error("Could not find font family " + name);
    }
    auto typeface = set->matchStyle(*fontStyle);
    if (!typeface) {
      throw std::runtime_error("Could not find font style for " + name);
    }
    return std::make_shared<JsiSkTypeface>(getContext(), std::move(typeface));
  }

  int countFamilies() { return getObject()->countFamilies(); }

  std::string getFamilyName(int i) {
    SkString name;
    getObject()->getFamilyName(i, &name);
    return std::string(name.c_str());
  }

  JsiSkTypefaceFontProvider(std::shared_ptr<RNSkPlatformContext> context,
                            sk_sp<para::TypefaceFontProvider> tfProvider)
      : JsiSkWrappingSkPtrNativeObject<JsiSkTypefaceFontProvider,
                                       para::TypefaceFontProvider>(
            std::move(context), std::move(tfProvider)) {}

  size_t getMemoryPressure() override { return 4096; }

  /**
   Returns the jsi object from a host object of this type
  */
  static jsi::Value toValue(jsi::Runtime &runtime,
                            std::shared_ptr<RNSkPlatformContext> context,
                            sk_sp<para::TypefaceFontProvider> tfProvider) {
    return makeJsiObject(runtime,
                         std::make_shared<JsiSkTypefaceFontProvider>(
                             std::move(context), std::move(tfProvider)));
  }

  static sk_sp<para::TypefaceFontProvider> fromValue(jsi::Runtime &runtime,
                                                     const jsi::Value &obj) {
    return objectFromValue(runtime, obj);
  }

  static void definePrototype(jsi::Runtime &runtime, jsi::Object &prototype) {
    installCommon(runtime, prototype);
    installMethod(runtime, prototype, "registerFont",
                  &JsiSkTypefaceFontProvider::registerFont);
    installMethod(runtime, prototype, "matchFamilyStyle",
                  &JsiSkTypefaceFontProvider::matchFamilyStyle);
    installMethod(runtime, prototype, "countFamilies",
                  &JsiSkTypefaceFontProvider::countFamilies);
    installMethod(runtime, prototype, "getFamilyName",
                  &JsiSkTypefaceFontProvider::getFamilyName);
  }

protected:
  void releaseResources() override {
    _paragraphFonts.reset();
    setObject(nullptr);
  }

private:
  sk_sp<para::FontCollection> _paragraphFonts;
  unsigned _paragraphBuilders = 0;
};

} // namespace RNSkia

namespace RNJsi {
// Keep the same strict provider conversion as the previous sk_sp argument.
template <>
struct JSIConverter<std::shared_ptr<RNSkia::JsiSkTypefaceFontProvider>> {
  static std::shared_ptr<RNSkia::JsiSkTypefaceFontProvider>
  fromJSI(jsi::Runtime &runtime, const jsi::Value &value, bool) {
    return RNSkia::JsiSkTypefaceFontProvider::fromThis(runtime, value);
  }
  static jsi::Value toJSI(
      jsi::Runtime &runtime,
      const std::shared_ptr<RNSkia::JsiSkTypefaceFontProvider> &value) {
    return RNSkia::JsiSkTypefaceFontProvider::create(runtime, value);
  }
};
} // namespace RNJsi
