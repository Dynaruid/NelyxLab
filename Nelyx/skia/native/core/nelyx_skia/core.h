#pragma once
#include <array>
#include <cstddef>
#include <cstdint>
#include <memory>
#include <stdexcept>
#include <list>
#include <string>
#include "include/effects/SkRuntimeEffect.h"
#include "include/core/SkCanvas.h"
#include "include/core/SkImage.h"
#include "include/core/SkPaint.h"
#include "include/core/SkPicture.h"
#include "include/core/SkRRect.h"
#include "modules/skparagraph/include/Paragraph.h"
#include "modules/skparagraph/include/ParagraphBuilder.h"

// This target has no RN, JSI, ReactCommon, HWND or JS-runtime dependency.
// Callers own the canvas/context/resources and keep them alive for each call.
namespace nelyx::skia_core {
uint32_t abiVersion() noexcept;
uint32_t frameWireVersion() noexcept;
void concatMatrix4(SkCanvas& canvas, const std::array<float,16>& columnMajor);
void drawRect(SkCanvas& canvas, const SkRect& rect, const SkPaint& paint);
void drawRRect(SkCanvas& canvas, const SkRRect& rect, const SkPaint& paint);
void drawShadow(SkCanvas& canvas, const SkPath& path, SkColor color, float elevation, bool transparentOccluder, float devicePixelRatio);
void drawImage(SkCanvas& canvas, const sk_sp<SkImage>& image, const SkRect& destination);
void drawImageRect(SkCanvas& canvas, const sk_sp<SkImage>& image, const SkRect& source, const SkRect& destination, const SkSamplingOptions& sampling, const SkPaint* paint, SkCanvas::SrcRectConstraint constraint);
std::unique_ptr<skia::textlayout::Paragraph> buildParagraph(skia::textlayout::ParagraphBuilder& builder);
void layoutParagraph(skia::textlayout::Paragraph& paragraph, float width);
void paintParagraph(skia::textlayout::Paragraph& paragraph, SkCanvas& canvas, float x, float y);
// Per-owner CPU program cache. Shaders/recordings retain independent Skia references.
class RuntimeProgramCache {
 public:
  struct Stats {size_t entries,sourceBytes;uint64_t hits,misses,compilations,evictions;};
  sk_sp<SkRuntimeEffect> get(const std::string& source);
  void clear() noexcept {entries.clear();sourceBytes=0;}
  Stats stats() const noexcept {return {entries.size(),sourceBytes,hits,misses,compilations,evictions};}
 private:
  struct Entry {std::string source;sk_sp<SkRuntimeEffect> program;};
  std::list<Entry> entries;
  size_t sourceBytes=0;
  uint64_t hits=0,misses=0,compilations=0,evictions=0;
};
class FrameResources {
 public:
  virtual ~FrameResources() = default;
  virtual sk_sp<SkImage> image(uint32_t id) = 0;
  virtual skia::textlayout::Paragraph& paragraph(uint32_t id) = 0;
  virtual sk_sp<SkPicture> picture(uint32_t,uint32_t) {throw std::runtime_error("native picture lookup unsupported");}
  // Adapters with reusable IDs override these generation-aware lookups.
  virtual sk_sp<SkImage> image(uint32_t id,uint32_t generation) {if(generation!=1)throw std::runtime_error("stale image generation");return image(id);}
  virtual skia::textlayout::Paragraph& paragraph(uint32_t id,uint32_t generation) {if(generation!=1)throw std::runtime_error("stale paragraph generation");return paragraph(id);}
};
void replayFrame(SkCanvas& canvas, const uint8_t* bytes, size_t length, FrameResources& resources);
void replayFrame(SkCanvas& canvas, const uint8_t* bytes, size_t length, FrameResources& resources,RuntimeProgramCache& programs);
}
