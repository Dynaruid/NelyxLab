#pragma once

#include <memory>
#include <string>
#include <utility>

#include <jsi/jsi.h>

#include "JsiSkConverters.h"
#include "JsiSkFont.h"
#include "JsiSkFontMgr.h"
#include "JsiSkFontMgrFactory.h"
#include "JsiSkNativeObjects.h"
#include "JsiSkParagraph.h"
#include "JsiSkParagraphStyle.h"
#include "JsiSkTextStyle.h"
#include "JsiSkTypefaceFontProvider.h"

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdocumentation"

#include "modules/skparagraph/include/ParagraphBuilder.h"

#ifdef __APPLE__
#include "modules/skunicode/include/SkUnicode_libgrapheme.h"
#else
#include "modules/skunicode/include/SkUnicode_icu.h"
#endif

#pragma clang diagnostic pop

namespace RNSkia {

namespace jsi = facebook::jsi;

namespace para = skia::textlayout;

/**
 Implementation of the ParagraphBuilder object in JSI
 */
class JsiSkParagraphBuilder : public JsiSkNativeObject<JsiSkParagraphBuilder> {
public:
  static constexpr const char *CLASS_NAME = "ParagraphBuilder";

  std::shared_ptr<JsiSkParagraph> build() {
    return std::make_shared<JsiSkParagraph>(getContext(), requireBuilder());
  }

  void reset() { requireBuilder()->Reset(); }

  void addText(std::string text) { requireBuilder()->addText(text.c_str()); }

  void addPlaceholder(JsiOptional<double> width, JsiOptional<double> height,
                      JsiOptional<double> alignmentParam,
                      JsiOptional<double> baselineParam,
                      JsiOptional<double> offset) {
    auto alignment = alignmentParam.has_value()
                         ? static_cast<para::PlaceholderAlignment>(
                               *alignmentParam)
                         : para::PlaceholderAlignment::kBaseline;
    auto baseline = baselineParam.has_value()
                        ? static_cast<para::TextBaseline>(*baselineParam)
                        : para::TextBaseline::kAlphabetic;
    para::PlaceholderStyle style(width.value_or(0), height.value_or(0),
                                 alignment, baseline, offset.value_or(0));
    requireBuilder()->addPlaceholder(style);
  }

  void pushStyle(para::TextStyle textStyle,
                 JsiOptional<std::shared_ptr<SkPaint>> foreground,
                 JsiOptional<std::shared_ptr<SkPaint>> background) {
    if (foreground.has_value()) {
      textStyle.setForegroundPaint(**foreground);
    }
    if (background.has_value()) {
      textStyle.setBackgroundPaint(**background);
    }
    requireBuilder()->pushStyle(textStyle);
  }

  void pop() { requireBuilder()->pop(); }

  void dispose() {
    _builder.reset();
    _fontCollection.reset();
  }

  para::ParagraphBuilder *requireBuilder() {
    if (!_builder) {
      throw std::runtime_error("Nelyx: paragraph builder has been disposed");
    }
    return _builder.get();
  }

  static void definePrototype(jsi::Runtime &runtime, jsi::Object &prototype) {
    installMethod(runtime, prototype, "dispose", &JsiSkParagraphBuilder::dispose);
    installMethod(runtime, prototype, "build", &JsiSkParagraphBuilder::build);
    installMethod(runtime, prototype, "reset", &JsiSkParagraphBuilder::reset);
    installChainableMethod(runtime, prototype, "addText",
                           &JsiSkParagraphBuilder::addText);
    installChainableMethod(runtime, prototype, "addPlaceholder",
                           &JsiSkParagraphBuilder::addPlaceholder);
    installChainableMethod(runtime, prototype, "pushStyle",
                           &JsiSkParagraphBuilder::pushStyle);
    installChainableMethod(runtime, prototype, "pop",
                           &JsiSkParagraphBuilder::pop);
  }

  size_t getMemoryPressure() override { return kMinMemoryPressure; }

  explicit JsiSkParagraphBuilder(std::shared_ptr<RNSkPlatformContext> context,
                                 para::ParagraphStyle paragraphStyle,
                                 sk_sp<SkFontMgr> fontManager,
                                 sk_sp<para::FontCollection> fonts = nullptr)
      : JsiSkNativeObject<JsiSkParagraphBuilder>(std::move(context)) {
    _fontCollection = std::move(fonts);
    if (!_fontCollection) {
      _fontCollection = sk_make_sp<para::FontCollection>();
      auto fontMgr = JsiSkFontMgrFactory::getFontMgr(getContext());
      _fontCollection->setDefaultFontManager(fontMgr);
      if (fontManager != nullptr) {
        _fontCollection->setAssetFontManager(fontManager);
      }
      _fontCollection->enableFontFallback();
    }
    sk_sp<SkUnicode> unicode;
#ifdef __APPLE__
    unicode = SkUnicodes::Libgrapheme::Make();
#else
    unicode = SkUnicodes::ICU::Make();
#endif
    _builder =
        para::ParagraphBuilder::make(paragraphStyle, _fontCollection, unicode);
  }

private:
  std::unique_ptr<para::ParagraphBuilder> _builder;
  sk_sp<para::FontCollection> _fontCollection;
};
} // namespace RNSkia
