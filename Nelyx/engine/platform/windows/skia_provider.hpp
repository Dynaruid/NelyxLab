// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "../../core/state.hpp"
#include "graphics.hpp"
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
#include "include/core/SkGraphics.h"
#include <filesystem>
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
#include "nelyx_skia/paragraph_queries.h"

namespace nelyx::v2::windows {
struct Prepared {
  std::vector<std::shared_ptr<ExternalLease>> memory;
  struct EditorParagraph {
    std::shared_ptr<skia_core::ParagraphQuerySource> source;
    skia_core::ParagraphQueryIdentity identity;
    uint64_t ticket=0;
    std::vector<int> characters,words,lines;
  };
  uint64_t id, metrics, device;
  std::map<uint64_t, sk_sp<SkPicture>> pictures;
  std::map<uint64_t,SkPath> paths;
  uint64_t bytes = 0;
  std::shared_ptr<int> context=std::make_shared<int>(1);
  std::map<uint64_t,EditorParagraph> editors;
};
class ContentProvider {
  std::shared_ptr<Ledger> ledger;
  std::shared_ptr<ExternalLease> fontMemory,cacheMemory;
  sk_sp<skia::textlayout::FontCollection> fonts;
  sk_sp<SkUnicode> unicode;
  struct CachedParagraph {
    std::shared_ptr<ExternalLease> memory;
    std::shared_ptr<const TextData> text;
    double size, width;
    uint32_t color;
    uint32_t direction;
    std::unique_ptr<skia::textlayout::Paragraph> paragraph;
  };
  std::map<uint64_t, CachedParagraph> measured;
  uint64_t measurePreparation = 0;
  bool lineMetricsUtf16=true;
  std::unique_ptr<skia::textlayout::Paragraph> paragraphFor(const Node& n, double width) {
    const auto old = measured.find(n.id.key());
    if (old != measured.end() && old->second.text == n.text && old->second.size == n.fontSize &&
        old->second.width == width && old->second.color == n.color && old->second.direction == n.textDirection) {
      auto paragraph = std::move(old->second.paragraph); measured.erase(old); return paragraph;
    }
    using namespace skia::textlayout;
    TextStyle style; style.setFontFamilies({SkString("NelyxDefault"),SkString("NelyxArabic"),SkString("NelyxHebrew"),SkString("NelyxEmoji")}); style.setFontSize(float(n.fontSize));style.setColor(n.color);
    ParagraphStyle paragraphStyle;paragraphStyle.setTextStyle(style);
    paragraphStyle.setTextDirection(n.textDirection ? TextDirection::kRtl : TextDirection::kLtr);
    auto builder = ParagraphBuilder::make(paragraphStyle,fonts,unicode);
    auto text = n.text ? n.text->value : std::string{};
    if(n.kind==wire::kinds::editable){
      if(n.editing&&(n.editFlags&wire::editFlags::password)){auto masked=n.editing->text;for(auto& c:masked)if(c!=u'\r'&&c!=u'\n')c=u'\u2022';text=utf8(masked);}
      if(text.empty())text="\xe2\x80\x8b";
    }
    builder->addText(text.c_str(),text.size());
    auto paragraph = builder->Build(); paragraph->layout(float(width)); ++paragraphLayouts;
    return paragraph;
  }
 public:
  std::atomic<uint64_t> paragraphs{0}, images{0}, pictures{0};
  std::atomic<uint64_t> measurements{0}, paragraphLayouts{0};
  std::atomic<uint64_t> graphicsRecords{0},nativeExtensions{0};
  void discardMeasurements() { measured.clear(); }
  Measurement measure(const MeasurementRequest& request) {
    ++measurements;
    if (measurePreparation != request.preparation) { measured.clear(); measurePreparation = request.preparation; }
    const auto& n = *request.node;
    auto measurementMemory=std::make_shared<ExternalLease>(ledger,1,2,65536+(n.text?n.text->value.size()*256:0));
    if (n.kind == wire::kinds::image) {
      if (!n.resource) throw std::runtime_error("Intrinsic image resource missing");
      auto image = SkImages::DeferredFromEncodedData(SkData::MakeWithCopy(n.resource->bytes.data(),n.resource->bytes.size()));
      if (!image) throw std::runtime_error("Intrinsic image decode failed");
      return {double(image->width()), double(image->height()), double(image->width()), double(image->width()), -1};
    }
    auto paragraph = paragraphFor(n, request.bounded ? request.width : INFINITY);
    double width = request.width;
    if (!request.bounded) { width = std::ceil(paragraph->getMaxIntrinsicWidth()); paragraph->layout(float(width)); ++paragraphLayouts; }
    Measurement result{width, paragraph->getHeight(), paragraph->getMinIntrinsicWidth(),
      paragraph->getMaxIntrinsicWidth(), paragraph->getAlphabeticBaseline()};
    if(n.editing){
      using namespace skia::textlayout;
      const auto& e=*n.editing;std::vector<TextRect> selection;
      for(const auto& box:paragraph->getRectsForRange(size_t(std::min(e.base,e.extent)),size_t(std::max(e.base,e.extent)),RectHeightStyle::kMax,RectWidthStyle::kTight))
        selection.push_back({box.rect.left(),box.rect.top(),box.rect.width(),box.rect.height()});
      require(selection.size()<=wire::limits::selectionRects,wire::statuses::budgetExceeded);
      TextRect caret{0,0,1,std::max(1.0,n.fontSize*1.2)};size_t position=size_t(e.extent);bool trailing=false;
      if(position==e.text.size()&&position){--position;if(e.text[position]>=0xdc00&&e.text[position]<=0xdfff&&position)--position;trailing=true;}
      Paragraph::GlyphInfo glyph;
      if(!e.text.empty()&&paragraph->getGlyphInfoAtUTF16Offset(position,&glyph)){
        const auto& r=glyph.fGraphemeLayoutBounds;const bool rtl=glyph.fDirection==TextDirection::kRtl;
        caret={trailing!=rtl?r.right():r.left(),r.top(),1,std::max(double(r.height()),caret.height)};
      }
      if(e.extent==int32_t(e.text.size())&&!e.text.empty()&&e.text.back()==u'\n'){
        std::vector<LineMetrics> lines;paragraph->getLineMetrics(lines);if(!lines.empty()){
          const auto& line=lines.back();caret={line.fLeft,line.fBaseline-line.fAscent,1,line.fHeight};}
      }
      result.geometry=std::make_shared<TextGeometry>(n.lease.ledger,e.revision,caret,std::move(selection));
    }
    measured.insert_or_assign(n.id.key(), CachedParagraph{std::move(measurementMemory),n.text,n.fontSize,width,n.color,n.textDirection,std::move(paragraph)});
    return result;
  }
  ContentProvider(const std::string& font, const std::string& icu,std::shared_ptr<Ledger> book):ledger(std::move(book)) {
    const auto fontDirectory=std::filesystem::path(font).parent_path();uint64_t fontBytes=std::filesystem::file_size(font);
    for(const auto name:{"NotoNaskhArabic-Regular.ttf","NotoSansHebrew.ttf","NotoColorEmoji.ttf"})fontBytes+=std::filesystem::file_size(fontDirectory/name);
    fontMemory=std::make_shared<ExternalLease>(ledger,1,2,fontBytes*3+std::filesystem::file_size(icu));
    cacheMemory=std::make_shared<ExternalLease>(ledger,1,2,8*1024*1024);
    SkGraphics::SetResourceCacheTotalByteLimit(4*1024*1024);SkGraphics::SetFontCacheLimit(4*1024*1024);
    nelyx::font_services::initialize(icu);
    static std::once_flag codecs;std::call_once(codecs,[]{SkCodecs::Register(SkWebpDecoder::Decoder());});
    auto manager = nelyx::font_services::manager();
    auto face = manager->makeFromData(SkData::MakeFromFileName(font.c_str()));
    if (!face) throw std::runtime_error("Native font decode failed");
    auto provider = sk_make_sp<skia::textlayout::TypefaceFontProvider>();
    provider->registerTypeface(face, SkString("NelyxDefault"));
    const auto directory = font.substr(0,font.find_last_of("/\\")+1);
    for (const auto& fallback : {std::pair{"NotoNaskhArabic-Regular.ttf","NelyxArabic"},
        std::pair{"NotoSansHebrew.ttf","NelyxHebrew"},std::pair{"NotoColorEmoji.ttf","NelyxEmoji"}}) {
      auto fallbackFace = manager->makeFromData(SkData::MakeFromFileName((directory+fallback.first).c_str()));
      if (!fallbackFace) throw std::runtime_error("Native fallback font decode failed");
      provider->registerTypeface(fallbackFace,SkString(fallback.second));
    }
    fonts = sk_make_sp<skia::textlayout::FontCollection>();
    fonts->setAssetFontManager(provider); fonts->setDefaultFontManager(manager);
    unicode = SkUnicodes::ICU::Make();
    if (!unicode) throw std::runtime_error("Native Unicode provider failed");
    const std::string probeText="\xed\x95\x9c\xea\xb8\x80\nA\xf0\x9f\x98\x80\ne\xcc\x81";
    Node probe(std::make_shared<Ledger>());probe.fontSize=18;probe.text=std::make_shared<TextData>(probe.lease.ledger,Reader{reinterpret_cast<const uint8_t*>(probeText.data()),probeText.size()});
    auto paragraph=paragraphFor(probe,300);std::vector<skia::textlayout::LineMetrics> metrics;paragraph->getLineMetrics(metrics);
    if(metrics.size()!=3||(metrics[1].fStartIndex!=3&&metrics[1].fStartIndex!=7))throw std::runtime_error("Native paragraph line index unit is incompatible");
    lineMetricsUtf16=metrics[1].fStartIndex==3;
  }
  std::shared_ptr<const Prepared> prepare(const Preparation& p) {
    ExternalLease staging(ledger,1,4,wire::limits::resourceBytes);
    auto result = std::make_shared<Prepared>();result->id=p.id;result->metrics=p.metrics.epoch;result->device=p.metrics.device;
    result->memory.push_back(fontMemory);result->memory.push_back(cacheMemory);
    using namespace skia::textlayout;
    for (const auto& slot : p.document->nodes) if (slot.value) {
      const auto& n = *slot.value;
      const auto& style=n.graphics;if(style.path||style.shadowColor||style.strokeColor||style.blur||style.transform.a!=1||style.transform.b||style.transform.c||style.transform.d!=1||style.transform.tx||style.transform.ty)++graphicsRecords;
      if(n.extensionSize.x>0)++nativeExtensions;
      if(n.graphics.path){result->memory.push_back(std::make_shared<ExternalLease>(ledger,1,2,n.graphics.path->commands.size()*128+1024));result->paths.emplace(n.id.key(),graphicsPath(*n.graphics.path));}
      SkPictureRecorder recorder;
      const auto& g=n.graphics;const double padding=4*g.shadowSigma+g.strokeWidth+2;
      auto* canvas=recorder.beginRecording(SkRect::MakeXYWH(float(-padding-std::abs(g.shadowX)),float(-padding-std::abs(g.shadowY)),
        float(std::max(1.0,n.properties.width)+2*padding+2*std::abs(g.shadowX)),float(std::max(1.0,n.properties.height)+2*padding+2*std::abs(g.shadowY))));
      SkPaint paint; paint.setAntiAlias(true);
      if (n.kind == wire::kinds::paragraph || n.kind==wire::kinds::editable) {
        auto textMemory=std::make_shared<ExternalLease>(ledger,1,2,65536+n.text->value.size()*256);
        auto paragraph = paragraphFor(n, n.contentWidth);
        paragraph->paint(canvas,float(n.contentX),float(n.contentY));++paragraphs;
        if(n.editing&&!(n.editFlags&wire::editFlags::password)){
          Prepared::EditorParagraph record;record.identity={"native-hermes:root",std::to_string(n.id.key()),n.text->value,1,n.id.generation,uint32_t(n.editing->text.size())};
          auto shared=std::shared_ptr<Paragraph>(std::move(paragraph));record.source=skia_core::ParagraphQuerySource::create(shared,result->context,n.text->value,wire::limits::textBytes);
          skia_core::ParagraphQuerySource::didLayout(*shared);record.ticket=record.source->bind(record.identity);
          const auto& text=n.editing->text;
          unicode->forEachBreak(text.data(),int(text.size()),SkUnicode::BreakType::kGraphemes,[&](auto position,auto){record.characters.push_back(position);});
          unicode->forEachBreak(text.data(),int(text.size()),SkUnicode::BreakType::kWords,[&](auto position,auto){record.words.push_back(position);});
          std::vector<LineMetrics> lines;shared->getLineMetrics(lines);record.lines.push_back(0);
          for(const auto& line:lines){const auto bytes=std::min(line.fEndIncludingNewline,n.text->value.size());const int offset=lineMetricsUtf16?int(line.fEndIncludingNewline):int(utf16({reinterpret_cast<const uint8_t*>(n.text->value.data()),bytes}).size());
            if(offset>record.lines.back())record.lines.push_back(offset);}
          if(record.characters.empty())record.characters.push_back(0);if(record.words.empty())record.words.push_back(0);
          if(record.lines.back()!=int(text.size()))record.lines.push_back(int(text.size()));
          result->bytes+=(record.characters.size()+record.words.size()+record.lines.size())*sizeof(int);
          result->editors.emplace(n.id.key(),std::move(record));
          result->memory.push_back(std::move(textMemory));
        }
      } else if (n.kind == wire::kinds::image) {
        if(!n.resource)throw std::runtime_error("Native image resource missing");
        auto image=SkImages::DeferredFromEncodedData(SkData::MakeWithCopy(n.resource->bytes.data(),n.resource->bytes.size()));
        if(!image)throw std::runtime_error("Native image decode failed");
        result->memory.push_back(std::make_shared<ExternalLease>(ledger,1,2,uint64_t(image->width())*image->height()*4+n.resource->bytes.size()));
        image=image->makeRasterImage();if(!image)throw std::runtime_error("Native image CPU preparation failed");
        canvas->drawImageRect(image,SkRect::MakeXYWH(float(n.contentX),float(n.contentY),float(n.contentWidth),float(n.contentHeight)),SkSamplingOptions(),&paint);++images;
      } else {const auto path=result->paths.find(n.id.key());paintShape(canvas,n,path==result->paths.end()?nullptr:&path->second,paint);}
      auto picture=recorder.finishRecordingAsPicture();if(!picture)throw std::runtime_error("Native picture preparation failed");
      result->bytes+=picture->approximateBytesUsed();if(result->bytes>32*1024*1024)throw std::runtime_error("Native prepared scene budget exceeded");
      result->memory.push_back(std::make_shared<ExternalLease>(ledger,1,2,picture->approximateBytesUsed()));
      result->pictures.emplace(n.id.key(),std::move(picture));++pictures;
    }
    discardMeasurements();
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
  std::shared_ptr<Ledger> ledger;
  std::unique_ptr<ExternalLease> cacheMemory,backingMemory;
  std::shared_ptr<nelyx::vulkan::Device> device;
  std::unique_ptr<skgpu::graphite::Recorder> recorder;
  sk_sp<SkSurface> surface;
  uint32_t width=0,height=0;
 public:
  uint64_t draws=0;
  RenderProvider(uint64_t window,uint32_t uiThread,std::shared_ptr<Ledger> book):ledger(std::move(book)) {
    cacheMemory=std::make_unique<ExternalLease>(ledger,2,3,32*1024*1024);
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
      auto nextMemory=std::make_unique<ExternalLease>(ledger,2,3,uint64_t(w)*h*12);
      surface.reset();device->resizeWindow(recorder.get(),w,h);
      surface=SkSurfaces::RenderTarget(recorder.get(),SkImageInfo::Make(w,h,kRGBA_8888_SkColorType,kPremul_SkAlphaType));
      if(!surface)throw std::runtime_error("Native GPU surface unavailable");width=w;height=h;backingMemory=std::move(nextMemory);
    }
    uint64_t layerBytes=0;for(const auto& item:frame.items){const auto& n=frame.scene->document->get(item.node);
      if(frame.properties[n.id.slot].opacity<1||n.graphics.blur>0)layerBytes+=uint64_t(w)*h*4*(n.graphics.blur>0?3:1);}
    ExternalLease layers(ledger,2,3,layerBytes);
    auto* canvas=surface->getCanvas();canvas->clear(0xfff4f6fa);canvas->save();canvas->scale(float(scale),float(scale));
    std::vector<int> saves;
    for(const auto& item:frame.items){
      while(saves.size()>item.depth){canvas->restoreToCount(saves.back());saves.pop_back();}
      const int saved=canvas->getSaveCount();canvas->save();saves.push_back(saved);
      const auto& m=item.world;
      canvas->setMatrix(SkMatrix::MakeAll(float(m.a*scale),float(m.c*scale),float(m.tx*scale),float(m.b*scale),float(m.d*scale),float(m.ty*scale),0,0,1));
      const auto& n=frame.scene->document->get(item.node);
      if(n.kind==wire::kinds::clip||n.kind==wire::kinds::scrollViewport){const auto path=prepared.paths.find(n.id.key());
        if(path!=prepared.paths.end()){canvas->clipRect(SkRect::MakeWH(float(n.properties.width),float(n.properties.height)),true);canvas->clipPath(path->second,true);}
        else canvas->clipRRect(SkRRect::MakeRectXY(SkRect::MakeWH(float(n.properties.width),float(n.properties.height)),float(n.radius),float(n.radius)),true);}
      const auto& property=frame.properties[n.id.slot];
      if(property.opacity<1||n.graphics.blur>0){SkPaint layer;layer.setAlphaf(float(property.opacity));
        if(n.graphics.blur>0)layer.setImageFilter(SkImageFilters::Blur(float(n.graphics.blur),float(n.graphics.blur),SkTileMode::kDecal,nullptr));
        canvas->saveLayer(nullptr,&layer);}
      if(!item.clip.width||!item.clip.height)continue;
      const auto found=prepared.pictures.find(item.node.key());if(found==prepared.pictures.end())throw std::runtime_error("Native prepared generation missing");
      SkPaint alpha;
      const auto geometry=frame.focusNode==n.id?n.textGeometry:nullptr;
      const auto rect=[&](const TextRect& r,SkColor color){SkPaint paint;paint.setColor(color);canvas->drawRect(SkRect::MakeXYWH(float(r.x),float(r.y),float(r.width),float(r.height)),paint);};
      if(geometry)for(const auto& r:geometry->selection)rect(r,0x663582f6);
      canvas->drawPicture(found->second,nullptr,&alpha);
      if(n.control.kind){const auto& c=n.control;const auto& state=frame.properties[n.id.slot];SkPaint paint;paint.setAntiAlias(true);
        const auto color=[&](uint32_t argb){paint.setColor(argb);paint.setAlphaf(paint.getAlphaf()*(c.disabled?0.4f:1.f));};
        const auto round=[&](double x,double y,double w,double h,double r,uint32_t argb){color(argb);canvas->drawRRect(SkRRect::MakeRectXY(SkRect::MakeXYWH(float(x),float(y),float(std::max(0.0,w)),float(std::max(0.0,h))),float(r),float(r)),paint);};
        const auto circle=[&](double x,double y,double r,uint32_t argb){color(argb);canvas->drawCircle(float(x),float(y),float(std::max(0.0,r)),paint);};
        const double w=n.properties.width,h=n.properties.height,cy=h/2,value=std::clamp((state.value-c.minimum)/(c.maximum-c.minimum),0.0,1.0);
        if(c.kind==wire::controlKinds::button){if(c.appearance==3)round(0,3,w,h,std::min(12.0,cy),0x33000000);
          if(c.appearance==1){paint.setStyle(SkPaint::kStroke_Style);paint.setStrokeWidth(1.5f);}
          if(c.appearance!=2)round(0,0,w,h,std::min(12.0,cy),c.foreground);paint.setStyle(SkPaint::kFill_Style);
          if(state.pressed||state.hovered)round(0,0,w,h,std::min(12.0,cy),state.pressed?0x33000000:0x14000000);}
        else if(c.kind==wire::controlKinds::toggle&&c.appearance==4)round(0,0,w,h,std::min(12.0,cy),value>0?c.foreground:0xff79747e);
        else if(c.kind==wire::controlKinds::toggle){const double bh=std::min(32.0,h),bw=std::min(56.0,w),x=(w-bw)/2;
          round(x,(h-bh)/2,bw,bh,bh/2,value>0?c.foreground:c.track);circle(x+bh/2+(bw-bh)*value,cy,bh*0.375,0xffffffff);}
        else if(c.kind==wire::controlKinds::radio){circle(w/2,cy,std::min(w,h)*0.45,c.track);if(value>0)circle(w/2,cy,std::min(w,h)*0.28,c.foreground);}
        else if(c.kind==wire::controlKinds::checkbox){const double size=std::min(w,h)*0.8,x=(w-size)/2,y=(h-size)/2;round(x,y,size,size,3,value>0?c.foreground:c.track);
          if(value>0){color(0xffffffff);paint.setStrokeWidth(2);canvas->drawLine(float(x+size*.2),float(y+size*.5),float(x+size*.43),float(y+size*.75),paint);canvas->drawLine(float(x+size*.43),float(y+size*.75),float(x+size*.85),float(y+size*.25),paint);}}
        else if(c.kind==wire::controlKinds::circularProgress||c.kind==wire::controlKinds::activity){color(c.foreground);paint.setStyle(SkPaint::kStroke_Style);paint.setStrokeWidth(3);
          const double radius=std::max(0.0,std::min(w,h)/2-3);canvas->drawArc(SkRect::MakeXYWH(float(w/2-radius),float(cy-radius),float(radius*2),float(radius*2)),float(c.kind==wire::controlKinds::activity?value*360:-90),float(c.kind==wire::controlKinds::activity?240:value*360),false,paint);}
        else {const double radius=6,span=std::max(0.0,w-2*radius),x=radius+span*value;round(radius,cy-2,span,4,2,c.track);
          if(c.kind==wire::controlKinds::rangeSlider){const double right=radius+span*std::clamp((state.second-c.minimum)/(c.maximum-c.minimum),value,1.0);
            round(x,cy-2,right-x,4,2,c.foreground);circle(right,cy,state.pressed?9:7,c.foreground);}
          else round(radius,cy-2,std::max(0.0,x-radius),4,2,c.foreground);
          if(c.kind!=wire::controlKinds::progress)circle(x,cy,state.pressed?9:7,c.foreground);}
      }
      if(geometry&&frame.caretVisible&&n.editing&&n.editing->base==n.editing->extent)rect(geometry->caret,0xff172033);
    }
    while(!saves.empty()){canvas->restoreToCount(saves.back());saves.pop_back();}
    canvas->restore();device->present(recorder.get(),surface.get());++draws;return true;
    }catch(const nelyx::vulkan::SurfaceChanged&){
      surface.reset();device->releaseWindow(recorder.get());backingMemory.reset();width=height=0;return false;
    }
  }
  void close(){if(!device)return;device->retire();surface.reset();device->releaseWindow(recorder.get());recorder.reset();device->drain();device.reset();backingMemory.reset();cacheMemory.reset();}
  ~RenderProvider(){try{close();}catch(...){device.reset();}}
};
}
