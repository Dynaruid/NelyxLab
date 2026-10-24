#pragma once
#include "nelyx_skia/core.h"
#include "nelyx_skia/paragraph_queries.h"

#include <memory>
#include <string>
#include <stdexcept>
#include <cmath>
#include <cstdint>
#include <utility>
#include <variant>
#include <vector>

#include <jsi/jsi.h>

#include "JsiSkCanvas.h"
#include "JsiSkFont.h"
#include "JsiSkNativeObjects.h"
#include "JsiSkPath.h"
#include "JsiSkRect.h"

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdocumentation"

#include "modules/skparagraph/include/Paragraph.h"
#include "modules/skparagraph/include/ParagraphBuilder.h"
#include "modules/skparagraph/include/ParagraphStyle.h"

#pragma clang diagnostic pop

namespace RNSkia {

namespace jsi = facebook::jsi;
namespace para = skia::textlayout;

/**
 * Implementation of the Paragraph object in JSI
 */
class JsiSkParagraph
    : public JsiSkWrappingSharedPtrNativeObject<JsiSkParagraph,
                                                para::Paragraph> {
public:
  static constexpr const char *CLASS_NAME = "Paragraph";

  void layout(double width) { if (std::isnan(width) || width < 0 || (std::isfinite(width) && width > 16777216)) throw std::runtime_error("invalid paragraph width"); nelyx::skia_core::layoutParagraph(*getObject(), static_cast<float>(width)); }

  void paint(std::shared_ptr<JsiSkCanvas> jsiCanvas, double x, double y) {
    nelyx::skia_core::paintParagraph(*getObject(), *jsiCanvas->getCanvas(), static_cast<float>(x), static_cast<float>(y));
  }

  double getHeight() {
    nelyx::skia_core::ParagraphAccess access(*getObject()); return static_cast<double>(getObject()->getHeight()); }

  double getMaxWidth() {
    nelyx::skia_core::ParagraphAccess access(*getObject());
    return static_cast<double>(getObject()->getMaxWidth());
  }

  double getMaxIntrinsicWidth() {
    nelyx::skia_core::ParagraphAccess access(*getObject());
    return static_cast<double>(getObject()->getMaxIntrinsicWidth());
  }

  double getMinIntrinsicWidth() {
    nelyx::skia_core::ParagraphAccess access(*getObject());
    return static_cast<double>(getObject()->getMinIntrinsicWidth());
  }

  double getLongestLine() {
    nelyx::skia_core::ParagraphAccess access(*getObject());
    return static_cast<double>(getObject()->getLongestLine());
  }

  int getGlyphPositionAtCoordinate(double dx, double dy) {
    nelyx::skia_core::ParagraphAccess access(*getObject());
    auto result = getObject()->getGlyphPositionAtCoordinate(dx, dy);
    return result.position;
  }

  std::vector<std::shared_ptr<JsiSkRect>> getRectsForRange(double start,
                                                           double end) {
    nelyx::skia_core::ParagraphAccess access(*getObject());
    auto result =
        getObject()->getRectsForRange(start, end, para::RectHeightStyle::kTight,
                                      para::RectWidthStyle::kTight);
    std::vector<std::shared_ptr<JsiSkRect>> rects;
    rects.reserve(result.size());
    for (const auto &box : result) {
      rects.push_back(std::make_shared<JsiSkRect>(getContext(), box.rect));
    }
    return rects;
  }

  JSI_HOST_FUNCTION(getLineMetrics) {
    nelyx::skia_core::ParagraphAccess access(*getObject());
    std::vector<para::LineMetrics> metrics;
    getObject()->getLineMetrics(metrics);
    auto returnValue = jsi::Array(runtime, metrics.size());

    for (size_t i = 0; i < metrics.size(); ++i) {
      auto lineMetrics = jsi::Object(runtime);

      // Text indices
      lineMetrics.setProperty(runtime, "startIndex",
                              static_cast<double>(metrics[i].fStartIndex));
      lineMetrics.setProperty(runtime, "endIndex",
                              static_cast<double>(metrics[i].fEndIndex));
      lineMetrics.setProperty(
          runtime, "endExcludingWhitespaces",
          static_cast<double>(metrics[i].fEndExcludingWhitespaces));
      lineMetrics.setProperty(
          runtime, "endIncludingNewline",
          static_cast<double>(metrics[i].fEndIncludingNewline));

      // Line break info
      lineMetrics.setProperty(runtime, "isHardBreak", metrics[i].fHardBreak);

      // Vertical metrics
      lineMetrics.setProperty(runtime, "ascent",
                              static_cast<double>(metrics[i].fAscent));
      lineMetrics.setProperty(runtime, "descent",
                              static_cast<double>(metrics[i].fDescent));
      lineMetrics.setProperty(runtime, "unscaledAscent",
                              static_cast<double>(metrics[i].fUnscaledAscent));
      lineMetrics.setProperty(runtime, "height",
                              static_cast<double>(metrics[i].fHeight));

      // Horizontal metrics
      lineMetrics.setProperty(runtime, "width",
                              static_cast<double>(metrics[i].fWidth));
      lineMetrics.setProperty(runtime, "left",
                              static_cast<double>(metrics[i].fLeft));

      // Position
      lineMetrics.setProperty(runtime, "baseline",
                              static_cast<double>(metrics[i].fBaseline));

      // Line number
      lineMetrics.setProperty(runtime, "lineNumber",
                              static_cast<double>(metrics[i].fLineNumber));

      returnValue.setValueAtIndex(runtime, i, lineMetrics);
    }
    return returnValue;
  }

  std::variant<std::nullptr_t, std::shared_ptr<JsiSkPath>>
  getPath(int lineNumber) {
    nelyx::skia_core::ParagraphAccess access(*getObject());
    auto paragraph = getObject();
    // Paragraph::getPath does not bounds-check the line number.
    if (lineNumber < 0 ||
        static_cast<size_t>(lineNumber) >= paragraph->lineNumber()) {
      return nullptr;
    }
    // Paragraph::getPath resets its path builder after every visual run, so
    // for lines shaped as multiple runs (e.g. through font fallback) it only
    // returns the glyphs of the last run. Build the path from the per-glyph
    // data exposed by extendedVisit instead.
    SkPathBuilder builder;
    paragraph->extendedVisit(
        [lineNumber, &builder](
            int visitedLine, const para::Paragraph::ExtendedVisitorInfo *info) {
          if (visitedLine != lineNumber || info == nullptr) {
            return;
          }
          struct Rec {
            SkPathBuilder *builder;
            SkPoint origin;
            const SkPoint *pos;
          } rec = {&builder, info->origin, info->positions};
          info->font.getPaths(
              {info->glyphs, static_cast<size_t>(info->count)},
              [](const SkPath *src, const SkMatrix &mx, void *ctx) {
                auto *rec = static_cast<Rec *>(ctx);
                if (src != nullptr) {
                  SkMatrix total = mx;
                  total.postTranslate(rec->origin.fX + rec->pos->fX,
                                      rec->origin.fY + rec->pos->fY);
                  rec->builder->addPath(*src, total);
                }
                rec->pos += 1;
              },
              &rec);
        });
    SkPath path = builder.detach();
    return std::make_shared<JsiSkPath>(getContext(), std::move(path));
  }

  JSI_HOST_FUNCTION(extendedVisit) {
    nelyx::skia_core::ParagraphAccess access(*getObject());
    auto visitorObject = getArgumentAsFunction(runtime, arguments, count, 0);
    auto visitor = visitorObject.asFunction(runtime);
    auto context = getContext();
    getObject()->extendedVisit(
        [&runtime, &visitor, &context](
            int lineNumber, const para::Paragraph::ExtendedVisitorInfo *info) {
          if (info == nullptr) {
            // Signals the end of the line
            visitor.call(runtime, static_cast<double>(lineNumber),
                         jsi::Value::null());
            return;
          }
          auto value = jsi::Object(runtime);

          value.setProperty(runtime, "font",
                            makeJsiObject(runtime, std::make_shared<JsiSkFont>(
                                                       context, info->font)));

          auto origin = jsi::Object(runtime);
          origin.setProperty(runtime, "x",
                             static_cast<double>(info->origin.x()));
          origin.setProperty(runtime, "y",
                             static_cast<double>(info->origin.y()));
          value.setProperty(runtime, "origin", origin);

          auto advance = jsi::Object(runtime);
          advance.setProperty(runtime, "width",
                              static_cast<double>(info->advance.width()));
          advance.setProperty(runtime, "height",
                              static_cast<double>(info->advance.height()));
          value.setProperty(runtime, "advance", advance);

          auto size = info->count;
          auto glyphs = jsi::Array(runtime, size);
          auto positions = jsi::Array(runtime, size);
          auto bounds = jsi::Array(runtime, size);
          auto utf8Starts = jsi::Array(runtime, size);
          for (int i = 0; i < size; ++i) {
            glyphs.setValueAtIndex(runtime, i,
                                   static_cast<double>(info->glyphs[i]));
            auto position = jsi::Object(runtime);
            position.setProperty(runtime, "x",
                                 static_cast<double>(info->positions[i].x()));
            position.setProperty(runtime, "y",
                                 static_cast<double>(info->positions[i].y()));
            positions.setValueAtIndex(runtime, i, position);
            bounds.setValueAtIndex(
                runtime, i,
                JsiSkRect::toValue(runtime, context, info->bounds[i]));
            utf8Starts.setValueAtIndex(
                runtime, i, static_cast<double>(info->utf8Starts[i]));
          }
          value.setProperty(runtime, "glyphs", glyphs);
          value.setProperty(runtime, "positions", positions);
          value.setProperty(runtime, "bounds", bounds);
          value.setProperty(runtime, "utf8Starts", utf8Starts);
          value.setProperty(runtime, "flags", static_cast<double>(info->flags));

          visitor.call(runtime, static_cast<double>(lineNumber), value);
        });
    return jsi::Value::undefined();
  }

  JSI_HOST_FUNCTION(getRectsForPlaceholders) {
    nelyx::skia_core::ParagraphAccess access(*getObject());
    std::vector<para::TextBox> placeholderInfos =
        getObject()->getRectsForPlaceholders();
    auto returnValue = jsi::Array(runtime, placeholderInfos.size());
    for (size_t i = 0; i < placeholderInfos.size(); ++i) {
      auto obj = jsi::Object(runtime);
      obj.setProperty(
          runtime, "rect",
          JsiSkRect::toValue(runtime, getContext(), placeholderInfos[i].rect));
      obj.setProperty(runtime, "direction",
                      static_cast<double>(placeholderInfos[i].direction));
      returnValue.setValueAtIndex(runtime, i, obj);
    }
    return returnValue;
  }

  JSI_HOST_FUNCTION(nelyxGlyphVisit) {
    nelyx::skia_core::ParagraphAccess access(*getObject());
    auto visitorObject = getArgumentAsFunction(runtime, arguments, count, 0);
    auto visitor = visitorObject.asFunction(runtime);
    auto context = getContext();
    getObject()->visit(
        [&runtime, &visitor, &context](
            int lineNumber, const para::Paragraph::VisitorInfo *info) {
          if (info == nullptr) {
            // Signals the end of the line
            visitor.call(runtime, static_cast<double>(lineNumber),
                         jsi::Value::null());
            return;
          }
          auto value = jsi::Object(runtime);

          value.setProperty(runtime, "font",
                            makeJsiObject(runtime, std::make_shared<JsiSkFont>(
                                                       context, info->font)));

          auto origin = jsi::Object(runtime);
          origin.setProperty(runtime, "x",
                             static_cast<double>(info->origin.x()));
          origin.setProperty(runtime, "y",
                             static_cast<double>(info->origin.y()));
          value.setProperty(runtime, "origin", origin);

          auto advance = jsi::Object(runtime);
          advance.setProperty(runtime, "width",
                              static_cast<double>(info->advanceX));
          advance.setProperty(runtime, "height",
                              0.0);
          value.setProperty(runtime, "advance", advance);

          auto size = info->count;
          std::vector<SkRect> glyphBounds(size);
          info->font.getBounds({info->glyphs, static_cast<size_t>(size)},
                               {glyphBounds.data(), glyphBounds.size()}, nullptr);
          auto glyphs = jsi::Array(runtime, size);
          auto positions = jsi::Array(runtime, size);
          auto bounds = jsi::Array(runtime, size);
          auto utf8Starts = jsi::Array(runtime, size);
          for (int i = 0; i < size; ++i) {
            glyphs.setValueAtIndex(runtime, i,
                                   static_cast<double>(info->glyphs[i]));
            auto position = jsi::Object(runtime);
            position.setProperty(runtime, "x",
                                 static_cast<double>(info->positions[i].x()));
            position.setProperty(runtime, "y",
                                 static_cast<double>(info->positions[i].y()));
            positions.setValueAtIndex(runtime, i, position);
            bounds.setValueAtIndex(
                runtime, i,
                JsiSkRect::toValue(runtime, context, glyphBounds[i]));
            utf8Starts.setValueAtIndex(
                runtime, i, static_cast<double>(info->utf8Starts[i]));
          }
          value.setProperty(runtime, "glyphs", glyphs);
          value.setProperty(runtime, "positions", positions);
          value.setProperty(runtime, "bounds", bounds);
          value.setProperty(runtime, "utf8Starts", utf8Starts);
          value.setProperty(runtime, "flags", static_cast<double>(info->flags));

          visitor.call(runtime, static_cast<double>(lineNumber), value);
        });
    return jsi::Value::undefined();
  }

  std::vector<double> nelyxTextMetrics(){
    nelyx::skia_core::ParagraphAccess access(*getObject());
    auto paragraph=getObject();return {paragraph->getAlphabeticBaseline(),paragraph->getIdeographicBaseline(),paragraph->getMinIntrinsicWidth(),paragraph->getMaxIntrinsicWidth(),paragraph->getLongestLine(),paragraph->didExceedMaxLines()?1.0:0.0,static_cast<double>(paragraph->unresolvedGlyphs())};
  }
  std::vector<double> nelyxTextHit(double x,double y){
    nelyx::skia_core::ParagraphAccess access(*getObject());
    auto paragraph=getObject();auto position=paragraph->getGlyphPositionAtCoordinate(x,y);para::Paragraph::GlyphInfo glyph;
    if(!paragraph->getClosestUTF16GlyphInfoAt(x,y,&glyph))return {static_cast<double>(position.position),static_cast<double>(position.affinity),0};
    return {static_cast<double>(position.position),static_cast<double>(position.affinity),1,static_cast<double>(glyph.fGraphemeClusterTextRange.start),static_cast<double>(glyph.fGraphemeClusterTextRange.end),static_cast<double>(glyph.fDirection),glyph.fGraphemeLayoutBounds.x(),glyph.fGraphemeLayoutBounds.y(),glyph.fGraphemeLayoutBounds.width(),glyph.fGraphemeLayoutBounds.height()};
  }
  std::vector<double> nelyxTextGlyphAt(int offset){
    nelyx::skia_core::ParagraphAccess access(*getObject());
    if(offset<0)return {};para::Paragraph::GlyphInfo glyph;
    if(!getObject()->getGlyphInfoAtUTF16Offset(static_cast<size_t>(offset),&glyph))return {};
    return {static_cast<double>(glyph.fGraphemeClusterTextRange.start),static_cast<double>(glyph.fGraphemeClusterTextRange.end),static_cast<double>(glyph.fDirection),glyph.fGraphemeLayoutBounds.x(),glyph.fGraphemeLayoutBounds.y(),glyph.fGraphemeLayoutBounds.width(),glyph.fGraphemeLayoutBounds.height(),glyph.fIsEllipsis?1.0:0.0};
  }
  std::vector<double> nelyxTextWordBoundary(double offset){
    nelyx::skia_core::ParagraphAccess access(*getObject());
    if(!std::isfinite(offset)||std::floor(offset)!=offset||offset<0||offset>4294967295.0)throw std::invalid_argument("Invalid Uint32 word offset");
    const auto range=getObject()->getWordBoundary(static_cast<uint32_t>(offset));return {static_cast<double>(range.start),static_cast<double>(range.end)};
  }
  int nelyxTextLineNumberAt(double offset){
    nelyx::skia_core::ParagraphAccess access(*getObject());
    if(!std::isfinite(offset)||std::floor(offset)!=offset||offset<0||offset>4294967295.0)throw std::invalid_argument("Invalid Uint32 line offset");
    return getObject()->getLineNumberAtUTF16Offset(static_cast<uint32_t>(offset));
  }
  std::vector<double> nelyxTextBoxes(double start,double end,double heightStyle,double widthStyle){
    nelyx::skia_core::ParagraphAccess access(*getObject());
    if(!std::isfinite(start)||!std::isfinite(end)||!std::isfinite(heightStyle)||!std::isfinite(widthStyle)||std::floor(start)!=start||std::floor(end)!=end||std::floor(heightStyle)!=heightStyle||std::floor(widthStyle)!=widthStyle||start<0||end<0||start>4294967295.0||end>4294967295.0||heightStyle<0||heightStyle>5||widthStyle<0||widthStyle>1)throw std::invalid_argument("Invalid text box query");
    constexpr para::RectHeightStyle heights[]={para::RectHeightStyle::kTight,para::RectHeightStyle::kMax,para::RectHeightStyle::kIncludeLineSpacingMiddle,para::RectHeightStyle::kIncludeLineSpacingTop,para::RectHeightStyle::kIncludeLineSpacingBottom,para::RectHeightStyle::kStrut};
    constexpr para::RectWidthStyle widths[]={para::RectWidthStyle::kTight,para::RectWidthStyle::kMax};
    const auto boxes=getObject()->getRectsForRange(static_cast<uint32_t>(start),static_cast<uint32_t>(end),heights[static_cast<int>(heightStyle)],widths[static_cast<int>(widthStyle)]);
    std::vector<double> values;values.reserve(boxes.size()*5);
    for(const auto& box:boxes){values.insert(values.end(),{box.rect.left(),box.rect.top(),box.rect.right(),box.rect.bottom(),static_cast<double>(box.direction)});}
    return values;
  }

  double nelyxBindCoreQuery(std::string owner,double ownerGeneration,std::string resource,double resourceGeneration,std::string text,double units){
    getObject();
    const auto counter=[](double number,double maximum){if(!std::isfinite(number)||number<0||number>maximum||std::floor(number)!=number)throw std::invalid_argument("Invalid Core paragraph query counter");return static_cast<uint64_t>(number);};
    return static_cast<double>(querySource_->bind({std::move(owner),std::move(resource),std::move(text),counter(ownerGeneration,9007199254740991.0),counter(resourceGeneration,9007199254740991.0),static_cast<uint32_t>(counter(units,4096))}));
  }

  static void definePrototype(jsi::Runtime &runtime, jsi::Object &prototype) {
    installHostMethod(runtime,prototype,"nelyxGlyphVisit",&JsiSkParagraph::nelyxGlyphVisit);
    installMethod(runtime,prototype,"nelyxTextMetrics",&JsiSkParagraph::nelyxTextMetrics);
    installMethod(runtime,prototype,"nelyxTextHit",&JsiSkParagraph::nelyxTextHit);
    installMethod(runtime,prototype,"nelyxTextGlyphAt",&JsiSkParagraph::nelyxTextGlyphAt);
    installMethod(runtime,prototype,"nelyxTextWordBoundary",&JsiSkParagraph::nelyxTextWordBoundary);
    installMethod(runtime,prototype,"nelyxTextLineNumberAt",&JsiSkParagraph::nelyxTextLineNumberAt);
    installMethod(runtime,prototype,"nelyxTextBoxes",&JsiSkParagraph::nelyxTextBoxes);
    installMethod(runtime,prototype,"nelyxBindCoreQuery",&JsiSkParagraph::nelyxBindCoreQuery);
    installCommon(runtime, prototype);
    installMethod(runtime, prototype, "layout", &JsiSkParagraph::layout);
    installMethod(runtime, prototype, "paint", &JsiSkParagraph::paint);
    installMethod(runtime, prototype, "getMaxWidth",
                  &JsiSkParagraph::getMaxWidth);
    installMethod(runtime, prototype, "getMinIntrinsicWidth",
                  &JsiSkParagraph::getMinIntrinsicWidth);
    installMethod(runtime, prototype, "getMaxIntrinsicWidth",
                  &JsiSkParagraph::getMaxIntrinsicWidth);
    installMethod(runtime, prototype, "getLongestLine",
                  &JsiSkParagraph::getLongestLine);
    installMethod(runtime, prototype, "getHeight", &JsiSkParagraph::getHeight);
    installHostMethod(runtime, prototype, "getRectsForPlaceholders",
                      &JsiSkParagraph::getRectsForPlaceholders);
    installMethod(runtime, prototype, "getGlyphPositionAtCoordinate",
                  &JsiSkParagraph::getGlyphPositionAtCoordinate);
    installMethod(runtime, prototype, "getRectsForRange",
                  &JsiSkParagraph::getRectsForRange);
    installHostMethod(runtime, prototype, "getLineMetrics",
                      &JsiSkParagraph::getLineMetrics);
    installMethod(runtime, prototype, "getPath", &JsiSkParagraph::getPath);
    installHostMethod(runtime, prototype, "extendedVisit",
                      &JsiSkParagraph::extendedVisit);
  }

  // Shaped glyph runs and line metrics; there is no exact API for this.
  size_t getMemoryPressure() override { return 16 * 1024; }

  explicit JsiSkParagraph(std::shared_ptr<RNSkPlatformContext> context,
                          para::ParagraphBuilder *paragraphBuilder)
      : JsiSkParagraph(std::move(context),buildObserved(*paragraphBuilder)) {}
  ~JsiSkParagraph() override {querySource_->retire();}
  void drawLayout(SkCanvas* canvas,float width,float x,float y){
    auto paragraph=getObject();nelyx::skia_core::ParagraphAccess access(*paragraph);
    nelyx::skia_core::layoutParagraph(*paragraph,width);nelyx::skia_core::paintParagraph(*paragraph,*canvas,x,y);
  }
 protected:
  void releaseResources() override {querySource_->retire();setObject(nullptr);}
 private:
  struct Built {std::shared_ptr<para::Paragraph> paragraph;std::optional<std::string> text;};
  static Built buildObserved(para::ParagraphBuilder& builder){
    const auto body=builder.getText();std::optional<std::string> text;
    if(body.size()<=16384)text=std::string(body.data(),body.size());
    return {std::shared_ptr<para::Paragraph>(nelyx::skia_core::buildParagraph(builder)),std::move(text)};
  }
  JsiSkParagraph(std::shared_ptr<RNSkPlatformContext> context,Built built)
      :JsiSkWrappingSharedPtrNativeObject<JsiSkParagraph,para::Paragraph>(context,built.paragraph),
       querySource_(nelyx::skia_core::ParagraphQuerySource::create(std::move(built.paragraph),std::move(context),std::move(built.text))){}
  std::shared_ptr<nelyx::skia_core::ParagraphQuerySource> querySource_;
};

} // namespace RNSkia
