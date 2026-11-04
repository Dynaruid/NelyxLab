// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "../../core/state.hpp"
#include "../../../skia/native/platforms/vulkan/device.h"
#include "../../../skia/native/rendering/font_services.h"
#include "include/core/SkCanvas.h"
#include "include/core/SkData.h"
#include "include/core/SkImage.h"
#include "include/core/SkImageInfo.h"
#include "include/core/SkPaint.h"
#include "include/core/SkPicture.h"
#include "include/core/SkPictureRecorder.h"
#include "include/core/SkRRect.h"
#include "include/core/SkSurface.h"
#include "include/core/SkFontMgr.h"
#include "include/core/SkTypeface.h"
#include "include/codec/SkWebpDecoder.h"
#include "include/gpu/graphite/Context.h"
#include "include/gpu/graphite/Recorder.h"
#include "include/gpu/graphite/Surface.h"
#include "include/gpu/graphite/Image.h"
#include "include/gpu/graphite/ImageProvider.h"
#include "modules/skparagraph/include/FontCollection.h"
#include "modules/skparagraph/include/Paragraph.h"
#include "modules/skparagraph/include/ParagraphBuilder.h"
#include "modules/skparagraph/include/TypefaceFontProvider.h"
#include "modules/skunicode/include/SkUnicode_icu.h"
#include <map>

namespace nelyx::v2::windows {
struct Prepared {
  uint64_t id, metrics, device;
  std::map<uint64_t, sk_sp<SkPicture>> pictures;
  uint64_t bytes = 0;
};
class ContentProvider {
  sk_sp<skia::textlayout::FontCollection> fonts;
  sk_sp<SkUnicode> unicode;
 public:
  std::atomic<uint64_t> paragraphs{0}, images{0}, pictures{0};
  ContentProvider(const std::string& font, const std::string& icu) {
    nelyx::font_services::initialize(icu);
    static std::once_flag codecs;std::call_once(codecs,[]{SkCodecs::Register(SkWebpDecoder::Decoder());});
    auto manager = nelyx::font_services::manager();
    auto face = manager->makeFromData(SkData::MakeFromFileName(font.c_str()));
    if (!face) throw std::runtime_error("Native font decode failed");
    auto provider = sk_make_sp<skia::textlayout::TypefaceFontProvider>();
    provider->registerTypeface(face, SkString("NelyxDefault"));
    fonts = sk_make_sp<skia::textlayout::FontCollection>();
    fonts->setAssetFontManager(provider); fonts->setDefaultFontManager(manager);
    unicode = SkUnicodes::ICU::Make();
    if (!unicode) throw std::runtime_error("Native Unicode provider failed");
  }
  std::shared_ptr<const Prepared> prepare(const Preparation& p) {
    auto result = std::make_shared<Prepared>(Prepared{p.id,p.metrics.epoch,p.metrics.device,{}});
    using namespace skia::textlayout;
    for (const auto& slot : p.document->nodes) if (slot.value) {
      const auto& n = *slot.value;
      SkPictureRecorder recorder;
      auto* canvas = recorder.beginRecording(SkRect::MakeWH(float(std::max(1.0,n.properties.width)),float(std::max(1.0,n.properties.height))));
      SkPaint paint; paint.setAntiAlias(true);
      if (n.kind == wire::kinds::paragraph) {
        TextStyle style; style.setFontFamilies({SkString("NelyxDefault")}); style.setFontSize(float(n.fontSize));style.setColor(n.color);
        ParagraphStyle paragraphStyle;paragraphStyle.setTextStyle(style);paragraphStyle.setMaxLines(8);
        auto builder = ParagraphBuilder::make(paragraphStyle,fonts,unicode);
        const auto text = n.text ? n.text->value : std::string{};
        builder->addText(text.c_str(),text.size());
        auto paragraph = builder->Build();paragraph->layout(float(std::max(1.0,n.properties.width)));
        paragraph->paint(canvas,0,0);++paragraphs;
      } else if (n.kind == wire::kinds::image) {
        if(!n.resource)throw std::runtime_error("Native image resource missing");
        auto image=SkImages::DeferredFromEncodedData(SkData::MakeWithCopy(n.resource->bytes.data(),n.resource->bytes.size()));
        if(!image)throw std::runtime_error("Native image decode failed");
        image=image->makeRasterImage();if(!image)throw std::runtime_error("Native image CPU preparation failed");
        canvas->drawImageRect(image,SkRect::MakeWH(float(n.properties.width),float(n.properties.height)),SkSamplingOptions(),&paint);++images;
      } else if(n.color>>24) {
        paint.setColor(n.color);canvas->drawRRect(SkRRect::MakeRectXY(SkRect::MakeWH(float(n.properties.width),float(n.properties.height)),float(n.radius),float(n.radius)),paint);
      }
      auto picture=recorder.finishRecordingAsPicture();if(!picture)throw std::runtime_error("Native picture preparation failed");
      result->bytes+=picture->approximateBytesUsed();if(result->bytes>32*1024*1024)throw std::runtime_error("Native prepared scene budget exceeded");
      result->pictures.emplace(n.id.key(),std::move(picture));++pictures;
    }
    return result;
  }
  ~ContentProvider(){if(fonts)fonts->clearCaches();}
};
class UploadProvider final : public skgpu::graphite::ImageProvider {
  sk_sp<SkImage> findOrCreate(skgpu::graphite::Recorder* recorder,const SkImage* image,SkImage::RequiredProperties properties) override {
    return SkImages::TextureFromImage(recorder,image,properties);
  }
};
class RenderProvider {
  std::shared_ptr<nelyx::vulkan::Device> device;
  std::unique_ptr<skgpu::graphite::Recorder> recorder;
  sk_sp<SkSurface> surface;
  uint32_t width=0,height=0;
 public:
  uint64_t draws=0;
  RenderProvider(uint64_t window,uint32_t uiThread) {
    device=std::make_shared<nelyx::vulkan::Device>(nelyx::vulkan::WindowTarget{nelyx::vulkan::WindowKind::Win32,0,window,uiThread});
    skgpu::graphite::RecorderOptions options;options.fGpuBudgetInBytes=32*1024*1024;options.fImageProvider=sk_make_sp<UploadProvider>();
    recorder=device->context()->makeRecorder(options);if(!recorder)throw std::runtime_error("Vulkan Graphite recorder unavailable");
  }
  std::string driver()const{return device->description();}
  bool draw(const Frame& frame,const Prepared& prepared) {
    try {
    const auto scale=frame.scene->metrics.scale;
    const auto w=uint32_t(std::llround(frame.scene->metrics.width*scale)),h=uint32_t(std::llround(frame.scene->metrics.height*scale));
    if(!w||!h)return false;
    if(w>8192||h>8192||uint64_t(w)*h>16*1024*1024)throw std::runtime_error("Native surface size budget exceeded");
    if(w!=width||h!=height){
      surface.reset();device->resizeWindow(recorder.get(),w,h);
      surface=SkSurfaces::RenderTarget(recorder.get(),SkImageInfo::Make(w,h,kRGBA_8888_SkColorType,kPremul_SkAlphaType));
      if(!surface)throw std::runtime_error("Native GPU surface unavailable");width=w;height=h;
    }
    auto* canvas=surface->getCanvas();canvas->clear(0xfff4f6fa);canvas->save();canvas->scale(float(scale),float(scale));
    for(const auto& item:frame.items){
      const auto& n=frame.scene->document->get(item.node);
      if(!item.clip.width||!item.clip.height||!n.properties.width||!n.properties.height)continue;
      const auto found=prepared.pictures.find(item.node.key());if(found==prepared.pictures.end())throw std::runtime_error("Native prepared generation missing");
      canvas->save();canvas->clipRect(SkRect::MakeXYWH(float(item.clip.x),float(item.clip.y),float(item.clip.width),float(item.clip.height)));
      canvas->translate(float(item.x),float(item.y));SkPaint alpha;alpha.setAlphaf(float(item.opacity));
      canvas->drawPicture(found->second,nullptr,&alpha);canvas->restore();
    }
    canvas->restore();device->present(recorder.get(),surface.get());++draws;return true;
    }catch(const nelyx::vulkan::SurfaceChanged&){
      surface.reset();device->releaseWindow(recorder.get());width=height=0;return false;
    }
  }
  void close(){if(!device)return;device->retire();surface.reset();device->releaseWindow(recorder.get());recorder.reset();device->drain();device.reset();}
  ~RenderProvider(){try{close();}catch(...){device.reset();}}
};
}
