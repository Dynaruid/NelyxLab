// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "../../core/state.hpp"
#include "graphics.hpp"
#include "native_paint.hpp"
#include "paragraph_provider.hpp"
#include "image_provider.hpp"
#include "../../render/skia/font_services.h"
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
#include "include/core/SkFontArguments.h"
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

namespace nelyx::v2::native {
struct Prepared {
  std::vector<std::shared_ptr<ExternalLease>> memory;
  struct EditorParagraph {
    std::shared_ptr<skia_core::ParagraphQuerySource> source;
    skia_core::ParagraphQueryIdentity identity;
    uint64_t ticket=0;
    std::vector<int> characters,words,lines;
  };
  uint64_t id, metrics, device;
  std::vector<size_t> subtreeEnds;
  std::map<uint64_t, sk_sp<SkPicture>> pictures;
  std::map<uint64_t,SkPath> paths;
  uint64_t bytes = 0;
  std::shared_ptr<int> context=std::make_shared<int>(1);
  std::map<uint64_t,EditorParagraph> editors;
};
class ContentProvider {
  std::shared_ptr<Ledger> ledger;
  ParagraphProvider paragraphProvider;
  struct FontOwner {std::weak_ptr<const Resource> resource;std::shared_ptr<ParagraphProvider> provider;};
  std::map<uint64_t,FontOwner> fontOwners;
  std::shared_ptr<ParagraphProvider> fontFor(const Node& n){
    std::erase_if(fontOwners,[](const auto& entry){return entry.second.resource.expired();});
    if(!n.fontResource)return nullptr;
    if(!n.fontResource->fontCatalog)throw std::runtime_error("Native paragraph font resource has a foreign kind");
    const auto key=n.fontResource->id.key();const auto found=fontOwners.find(key);
    if(found!=fontOwners.end()){
      if(found->second.resource.lock()!=n.fontResource)throw std::runtime_error("Native paragraph font identity was reused");
      return found->second.provider;
    }
    const auto& bytes=n.fontResource->bytes;const auto catalog=readFontCatalog({bytes.data(),bytes.size()});
    uint64_t decoded=0;std::shared_ptr<ParagraphProvider> candidate;
    try{candidate=std::make_shared<ParagraphProvider>(paragraphProvider,catalog,ledger,1,&decoded);}
    catch(...){fontLoads+=decoded;throw;}fontLoads+=decoded;
    fontOwners.emplace(key,FontOwner{n.fontResource,candidate});return candidate;
  }
  struct CachedParagraph {
    std::shared_ptr<ExternalLease> memory;
    std::shared_ptr<const TextData> text;
    double size, width;
    uint32_t color;
    uint32_t direction;
    std::shared_ptr<const ParagraphData> options;
    std::shared_ptr<const Resource> fontResource;
    std::unique_ptr<skia::textlayout::Paragraph> paragraph;
  };
  std::map<uint64_t, CachedParagraph> measured;
  struct CachedPicture {
    std::shared_ptr<const Node> node;
    std::vector<std::shared_ptr<ExternalLease>> memory;
    sk_sp<SkPicture> picture;
    std::optional<SkPath> path;
    uint64_t metrics=0,device=0,font=0,bytes=0;
  };
  std::map<uint64_t,std::shared_ptr<const CachedPicture>> recorded;
  bool pressure=false;
  static bool samePaint(const Node& a,const Node& b) {
    const auto& x=a.graphics;const auto& y=b.graphics;
    return bool(a.paintPlacement&&a.paintPlacement->unbounded)==bool(b.paintPlacement&&b.paintPlacement->unbounded)&&a.kind==b.kind&&a.color==b.color&&a.radius==b.radius&&a.fontSize==b.fontSize&&
      a.textDirection==b.textDirection&&a.text==b.text&&a.paragraph==b.paragraph&&a.resource==b.resource&&
      a.fontResource==b.fontResource&&a.fontRevision==b.fontRevision&&a.imageStyle==b.imageStyle&&a.imagePaint==b.imagePaint&&
      a.properties.width==b.properties.width&&a.properties.height==b.properties.height&&
      a.contentX==b.contentX&&a.contentY==b.contentY&&a.contentWidth==b.contentWidth&&a.contentHeight==b.contentHeight&&
      a.resolvedPaint==b.resolvedPaint&&x.path==y.path&&x.shadowX==y.shadowX&&x.shadowY==y.shadowY&&x.shadowSigma==y.shadowSigma&&
      x.shadowColor==y.shadowColor&&x.strokeColor==y.strokeColor&&x.strokeWidth==y.strokeWidth;
  }
  uint64_t measurePreparation = 0;
  std::unique_ptr<skia::textlayout::Paragraph> paragraphFor(const Node& n, double width) {
    if(n.paintPlacement&&n.paintPlacement->unbounded)width=INFINITY;
    const auto old = measured.find(n.id.key());
    if (old != measured.end() && old->second.text == n.text && old->second.size == n.fontSize &&
        old->second.width == width && old->second.color == n.color && old->second.direction == n.textDirection&&old->second.options==n.paragraph&&old->second.fontResource==n.fontResource) {
      auto paragraph = std::move(old->second.paragraph); measured.erase(old); return paragraph;
    }
    auto text = n.text ? n.text->value : std::string{};
    if(n.kind==wire::kinds::editable){
      if(n.editing&&(n.editFlags&wire::editFlags::password)){auto masked=n.editing->text;for(auto& c:masked)if(c!=u'\r'&&c!=u'\n')c=u'\u2022';text=utf8(masked);}
      if(text.empty())text="\xe2\x80\x8b";
    }
    const auto owner=fontFor(n);auto& fonts=owner?*owner:paragraphProvider;
    auto paragraph=fonts.build(text,n.fontSize,n.color,n.textDirection,
      n.paragraph?&n.paragraph->value:nullptr,width);++paragraphLayouts;
    return paragraph;
  }
 public:
  std::shared_ptr<ParagraphProvider> prepareFont(const std::shared_ptr<const Resource>& resource){
    Node node(ledger);node.fontResource=resource;return fontFor(node);
  }
  void trimFontCache(){std::erase_if(fontOwners,[](const auto& entry){return entry.second.resource.expired();});}
  std::atomic<uint64_t> paragraphs{0}, images{0}, pictures{0};
  std::atomic<uint64_t> measurements{0}, paragraphLayouts{0};
  std::atomic<uint64_t> fontLoads{0};
  std::atomic<uint64_t> graphicsRecords{0},nativeExtensions{0};
  std::atomic<uint64_t> reusedPictures{0},reusedParagraphs{0},reusedImages{0},cachedBytes{0};
  void trimCache() { recorded.clear();cachedBytes=0;discardMeasurements();std::erase_if(fontOwners,[](const auto& entry){return entry.second.resource.expired();}); }
  void setMemoryPressure(bool low) {
    pressure=low;
    if(low){trimCache();paragraphProvider.fonts->clearCaches();SkGraphics::PurgeAllCaches();}
  }
  void discardMeasurements() { measured.clear(); }
  Measurement measure(const MeasurementRequest& request) {
    ++measurements;
    if (measurePreparation != request.preparation) { measured.clear(); measurePreparation = request.preparation; }
    const auto& n = *request.node;
    auto measurementMemory=std::make_shared<ExternalLease>(ledger,1,2,65536+(n.text?n.text->value.size()*256:0)+(n.paragraph?n.paragraph->value.metadataBytes():0));
    if (n.kind == wire::kinds::image) {
      if (!n.resource) throw std::runtime_error("Intrinsic image resource missing");
      auto image = providerImage(n);
      return {double(image->width()), double(image->height()), double(image->width()), double(image->width()), -1};
    }
    auto paragraph = paragraphFor(n, request.bounded ? request.width : INFINITY);
    double width = request.width;
    if (!request.bounded) { width = n.paragraph?paragraph->getMaxIntrinsicWidth():std::ceil(paragraph->getMaxIntrinsicWidth()); paragraph->layout(float(width)); ++paragraphLayouts; }
    Measurement result{width, paragraph->getHeight(), paragraph->getMinIntrinsicWidth(),
      paragraph->getMaxIntrinsicWidth(), paragraph->getAlphabeticBaseline()};
    result.didExceedMaxLines=paragraph->didExceedMaxLines();
    result.ideographicBaseline=paragraph->getIdeographicBaseline();
    if(n.paragraph&&n.paragraph->value.inlineChildren()){
      std::vector<ParagraphBox> boxes;
      for(const auto& box:paragraph->getRectsForPlaceholders())boxes.push_back({box.rect.x(),box.rect.y(),box.rect.width(),box.rect.height(),box.direction==skia::textlayout::TextDirection::kRtl?1u:0u});
      result.placeholders=std::make_shared<ParagraphGeometry>(n.lease.ledger,std::move(boxes));
    }
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
    measured.insert_or_assign(n.id.key(), CachedParagraph{std::move(measurementMemory),n.text,n.fontSize,(n.paintPlacement&&n.paintPlacement->unbounded)?INFINITY:width,n.color,n.textDirection,n.paragraph,n.fontResource,std::move(paragraph)});
    return result;
  }
  ContentProvider(const std::string& font,const std::string& icu,std::shared_ptr<Ledger> book)
      :ledger(std::move(book)),paragraphProvider(font,icu,ledger,1) {
    static std::once_flag codecs;std::call_once(codecs,[]{SkCodecs::Register(SkWebpDecoder::Decoder());});
    paragraphLayouts=paragraphProvider.layouts;
  }
  std::shared_ptr<const Prepared> prepare(const Preparation& p) {
    ExternalLease staging(ledger,1,4,wire::limits::resourceBytes);
    auto result = std::make_shared<Prepared>();result->id=p.id;result->metrics=p.metrics.epoch;result->device=p.metrics.device;
    result->memory.push_back(std::make_shared<ExternalLease>(ledger,1,2,p.document->count*sizeof(size_t)));
    result->subtreeEnds.reserve(p.document->count);
    std::function<void(Handle)> topology=[&](Handle node){const auto index=result->subtreeEnds.size();result->subtreeEnds.push_back(0);
      for(const auto child:p.document->children[node.slot])topology(child);
      result->subtreeEnds[index]=result->subtreeEnds.size();};
    for(const auto root:p.document->children[0])topology(root);
    result->memory.push_back(paragraphProvider.fontMemory);result->memory.push_back(paragraphProvider.cacheMemory);
    std::map<uint64_t,std::shared_ptr<const CachedPicture>> nextRecorded;
    uint64_t nextCachedBytes=0;
    using namespace skia::textlayout;
    for (const auto& slot : p.document->nodes) if (slot.value) {
      const auto& n = *slot.value;
      const auto previous=recorded.find(n.id.key());
      if(!n.editing&&previous!=recorded.end()) {
        const auto& cached=*previous->second;
        if(cached.metrics==p.metrics.epoch&&cached.device==p.metrics.device&&cached.font==n.fontRevision&&samePaint(n,*cached.node)) {
          result->pictures.emplace(n.id.key(),cached.picture);
          if(cached.path)result->paths.emplace(n.id.key(),*cached.path);
          result->memory.insert(result->memory.end(),cached.memory.begin(),cached.memory.end());
          result->bytes+=cached.picture->approximateBytesUsed();
          if(result->bytes>32*1024*1024)throw std::runtime_error("Native prepared scene budget exceeded");
          if(cached.bytes<=16*1024*1024-nextCachedBytes) {
            nextRecorded.emplace(n.id.key(),previous->second);nextCachedBytes+=cached.bytes;
          }
          ++reusedPictures;if(n.kind==wire::kinds::paragraph)++reusedParagraphs;
          if(n.kind==wire::kinds::image)++reusedImages;
          continue;
        }
      }
      const auto memoryBegin=result->memory.size();
      if(n.kind==wire::kinds::paragraph||n.kind==wire::kinds::editable)if(const auto fonts=fontFor(n)){
        result->memory.push_back(fonts->fontMemory);result->memory.push_back(fonts->cacheMemory);
      }
      if(n.resolvedPaint&&!n.resolvedPaint->paths.empty())result->memory.push_back(std::make_shared<ExternalLease>(ledger,1,2,n.resolvedPaint->paths.size()*256+1024));
      const auto& style=n.graphics;if(style.path||style.shadowColor||style.strokeColor||style.blur||style.transform.a!=1||style.transform.b||style.transform.c||style.transform.d!=1||style.transform.tx||style.transform.ty)++graphicsRecords;
      if(n.extensionSize.x>0)++nativeExtensions;
      if(n.graphics.path){result->memory.push_back(std::make_shared<ExternalLease>(ledger,1,2,n.graphics.path->commands.size()*128+1024));
        const auto physical=n.physicalPaint();result->paths.emplace(n.id.key(),physical?nativePhysicalPath(*physical):graphicsPath(*n.graphics.path));}
      SkPictureRecorder recorder;
      const auto& g=n.graphics;double padding=4*(g.shadowSigma+g.blur)+g.strokeWidth+2;
      if(n.resolvedPaint)for(const auto& e:n.resolvedPaint->entries)
        padding=std::max(padding,nativePaintOutset(e,n.properties.width,n.properties.height,p.metrics.scale)+2);
      if(n.paragraph)padding=std::max(padding,n.paragraph->value.paintOutset(n.fontSize)+2);
      const auto imageBounds=n.imagePaint?n.imagePaint->bounds:Rect{};
      const auto left=std::min({0.0,n.contentX,imageBounds.x}),top=std::min({0.0,n.contentY,imageBounds.y});
      auto* canvas=recorder.beginRecording(SkRect::MakeXYWH(float(left-padding-std::abs(g.shadowX)),float(top-padding-std::abs(g.shadowY)),
        float(std::max({1.0,n.properties.width,n.contentX+n.contentWidth,imageBounds.x+imageBounds.width})-left+2*padding+2*std::abs(g.shadowX)),float(std::max({1.0,n.properties.height,n.contentY+n.contentHeight,imageBounds.y+imageBounds.height})-top+2*padding+2*std::abs(g.shadowY))));
      SkPaint paint; paint.setAntiAlias(true);
      if (n.kind == wire::kinds::paragraph || n.kind==wire::kinds::editable) {
        auto textMemory=std::make_shared<ExternalLease>(ledger,1,2,65536+n.text->value.size()*256+(n.paragraph?n.paragraph->value.metadataBytes():0));
        result->memory.push_back(textMemory);
        auto paragraph = paragraphFor(n, n.contentWidth);
        paragraph->paint(canvas,float(n.contentX),float(n.contentY));++paragraphs;
        if(n.editing&&!(n.editFlags&wire::editFlags::password)){
          Prepared::EditorParagraph record;record.identity={"native-hermes:root",std::to_string(n.id.key()),n.text->value,1,n.id.generation,uint32_t(n.editing->text.size())};
          auto shared=std::shared_ptr<Paragraph>(std::move(paragraph));record.source=skia_core::ParagraphQuerySource::create(shared,result->context,n.text->value,wire::limits::textBytes);
          skia_core::ParagraphQuerySource::didLayout(*shared);record.ticket=record.source->bind(record.identity);
          const auto& text=n.editing->text;
          paragraphProvider.unicode->forEachBreak(text.data(),int(text.size()),SkUnicode::BreakType::kGraphemes,[&](auto position,auto){record.characters.push_back(position);});
          paragraphProvider.unicode->forEachBreak(text.data(),int(text.size()),SkUnicode::BreakType::kWords,[&](auto position,auto){record.words.push_back(position);});
          std::vector<LineMetrics> lines;shared->getLineMetrics(lines);record.lines.push_back(0);
          // Empty editors shape a measurement-only U+200B. Its line end is
          // outside the authoritative empty document and is not a UIA stop.
          if(!text.empty())for(const auto& line:lines){const auto bytes=std::min(line.fEndIncludingNewline,n.text->value.size());const int offset=paragraphProvider.lineMetricsUtf16?int(line.fEndIncludingNewline):int(utf16({reinterpret_cast<const uint8_t*>(n.text->value.data()),bytes}).size());
            if(offset>record.lines.back())record.lines.push_back(offset);}
          if(record.characters.empty())record.characters.push_back(0);if(record.words.empty())record.words.push_back(0);
          if(record.lines.back()!=int(text.size()))record.lines.push_back(int(text.size()));
          result->bytes+=(record.characters.size()+record.words.size()+record.lines.size())*sizeof(int);
          result->editors.emplace(n.id.key(),std::move(record));
        }
      } else if (n.kind == wire::kinds::image) {
        if(!n.imageStyle||(n.imagePaint&&!n.imagePaint->tiles.empty())){
          auto image=providerImage(n);
          const auto raw=readRasterImage({n.resource->bytes.data(),n.resource->bytes.size()});
          result->memory.push_back(std::make_shared<ExternalLease>(ledger,1,2,raw?65536:uint64_t(image->width())*image->height()*4+n.resource->bytes.size()));
          image=image->makeRasterImage();if(!image)throw std::runtime_error("Native image CPU preparation failed");
          paintImage(canvas,n,image,paint);++images;
        }else if(!n.imagePaint)throw std::runtime_error("Core image placement missing");
      } else {const auto path=result->paths.find(n.id.key());paintShape(canvas,n,path==result->paths.end()?nullptr:&path->second,paint);
        if(!n.nativePaint||!n.nativePaint->frameDependent)paintNative(canvas,n,paint,p.metrics.scale);}
      auto picture=recorder.finishRecordingAsPicture();if(!picture)throw std::runtime_error("Native picture preparation failed");
      result->bytes+=picture->approximateBytesUsed();if(result->bytes>32*1024*1024)throw std::runtime_error("Native prepared scene budget exceeded");
      result->memory.push_back(std::make_shared<ExternalLease>(ledger,1,2,picture->approximateBytesUsed()));
      result->pictures.emplace(n.id.key(),picture);++pictures;
      uint64_t held=sizeof(CachedPicture);
      for(size_t index=memoryBegin;index<result->memory.size();++index)held+=result->memory[index]->bytes;
      // One bounded generation of immutable CPU records. Active/queued scenes
      // share the leases; deleting a cache entry cannot invalidate their work.
      if(!pressure&&!n.editing&&held<=16*1024*1024-nextCachedBytes) {
        auto cached=std::make_shared<CachedPicture>();cached->node=slot.value;cached->picture=std::move(picture);
        cached->metrics=p.metrics.epoch;cached->device=p.metrics.device;cached->font=n.fontRevision;cached->bytes=held;
        cached->memory.assign(result->memory.begin()+memoryBegin,result->memory.end());
        cached->memory.push_back(std::make_shared<ExternalLease>(ledger,1,2,sizeof(CachedPicture)));
        const auto path=result->paths.find(n.id.key());if(path!=result->paths.end())cached->path=path->second;
        nextRecorded.emplace(n.id.key(),std::move(cached));nextCachedBytes+=held;
      }
    }
    discardMeasurements();
    recorded=std::move(nextRecorded);cachedBytes=nextCachedBytes;
    return result;
  }
};
// Raster pixels belong to Render. Core admits reuse only after successful capture.
class SnapshotImages {
  struct Image {std::unique_ptr<ExternalLease> memory;sk_sp<SkImage> image;};
  std::unique_ptr<ExternalLease> memory_;
  std::map<uint64_t,Image> images_;
 public:
  SnapshotRegistry registry;
  void begin(const Frame& frame) {
    if(!memory_)memory_=std::make_unique<ExternalLease>(frame.scene->document->lease.ledger,2,2,sizeof(SnapshotImages));
    prune(registry.beginFrame(frame));
  }
  void prune(const SnapshotDecision& decision) {
    for(auto it=images_.begin();it!=images_.end();) {
      bool alive=false;for(uint32_t i=0;i<decision.liveCount;++i)alive|=it->first==decision.liveTokens[i];
      if(!alive)it=images_.erase(it);else ++it;
    }
  }
  void clear(){images_.clear();registry.clear();memory_.reset();}
  sk_sp<SkImage> get(uint64_t token)const {
    const auto found=images_.find(token);
    if(found==images_.end())throw std::runtime_error("Snapshot raster token is unavailable");
    return found->second.image;
  }
  void capture(const SnapshotDecision& decision,Handle node,const std::shared_ptr<Ledger>& ledger,
      const std::function<void(SkCanvas*)>& paint,uint64_t scratchBytes) {
    try {
      auto memory=std::make_unique<ExternalLease>(ledger,2,2,uint64_t(decision.pixelWidth)*decision.pixelHeight*4+sizeof(Image)+256);
      ExternalLease scratch(ledger,2,2,scratchBytes);
      auto surface=SkSurfaces::Raster(SkImageInfo::MakeN32Premul(int(decision.pixelWidth),int(decision.pixelHeight)));
      if(!surface)throw std::runtime_error("Snapshot raster surface allocation failed");
      surface->getCanvas()->clear(SK_ColorTRANSPARENT);paint(surface->getCanvas());
      auto image=surface->makeImageSnapshot();if(!image)throw std::runtime_error("Snapshot raster image allocation failed");
      images_.emplace(decision.token,Image{std::move(memory),std::move(image)});
      registry.complete(node,decision.token,true);
    } catch(...) {images_.erase(decision.token);registry.complete(node,decision.token,false);throw;}
  }
};
// The same prepared-frame traversal serves Native GPU presentation and the
// CPU raster control, including inline resources, foreground and layer exits.
inline void drawPreparedFrame(SkCanvas* canvas,const Frame& frame,const Prepared& prepared,double scale,NativePaintCounts& paintCounts,SnapshotImages& snapshots) {
    canvas->clear(0xfff4f6fa);SkAutoCanvasRestore frameRestore(canvas,true);canvas->scale(float(scale),float(scale));
    snapshots.begin(frame);
    ExternalLease traversalMemory(frame.scene->document->lease.ledger,2,2,frame.items.size()*(sizeof(size_t)*2+48));
    const auto& ends=prepared.subtreeEnds;
    if(ends.size()!=frame.items.size())throw std::runtime_error("Prepared draw topology differs");
    std::function<void(SkCanvas*,size_t,size_t,Affine,double)> drawRange;
    drawRange=[&](SkCanvas* target,size_t begin,size_t end,Affine overrideMatrix,double pixelScale){
    auto* canvas=target;const auto baseDepth=begin<end?frame.items[begin].depth:0;
    const auto drawPaint=[&](const DrawItem& item,bool foreground){const auto& n=frame.scene->document->get(item.node);
      SkPaint paint;paint.setAntiAlias(true);paintFrameNative(canvas,n,item,paint,pixelScale,foreground,[&](Handle reference){
        const auto& resource=frame.scene->document->get(reference);const auto found=prepared.pictures.find(reference.key());
        if(resource.paintOwner!=item.node||found==prepared.pictures.end())throw std::runtime_error("Native prepared paragraph generation missing");
        if(frame.properties[reference.slot].opacity<=0)return;
        SkPaint alpha;alpha.setAlphaf(float(frame.properties[reference.slot].opacity));
        if(resource.graphics.blur>0)alpha.setImageFilter(SkImageFilters::Blur(float(resource.graphics.blur),float(resource.graphics.blur),SkTileMode::kDecal,nullptr));
        canvas->drawPicture(found->second,nullptr,&alpha);
      },&paintCounts);
    };
    struct Saved {int count;const DrawItem* item;};std::vector<Saved> saves;
    const auto finish=[&]{const auto saved=saves.back();saves.pop_back();drawPaint(*saved.item,true);
      if(const auto mask=nativeLinearMask(saved.item->paint.get()))paintNativeMask(canvas,*mask);
      canvas->restoreToCount(saved.count);};
    for(size_t index=begin;index<end;++index){const auto& item=frame.items[index];
      while(saves.size()>item.depth-baseDepth)finish();
      const auto& n=frame.scene->document->get(item.node);
      if(n.paintOwner||item.opacity<=0||!item.world.inverse()){index=ends[index]-1;continue;}
      const int saved=canvas->getSaveCount();canvas->save();saves.push_back({saved,&item});
      const auto m=overrideMatrix*item.world;
      canvas->setMatrix(SkMatrix::MakeAll(float(m.a*pixelScale),float(m.c*pixelScale),float(m.tx*pixelScale),float(m.b*pixelScale),float(m.d*pixelScale),float(m.ty*pixelScale),0,0,1));
      {const auto path=prepared.paths.find(n.id.key());paintNativeShadow(canvas,n,path==prepared.paths.end()?nullptr:&path->second,pixelScale);}
      if((n.kind==wire::kinds::clip&&(!n.clipStyle||n.clipStyle->behavior!=wire::clipBehaviors::none))||n.kind==wire::kinds::scrollViewport||(item.flags&wire::nodeFlags::clipsChildren)){
        const auto path=prepared.paths.find(n.id.key());const auto bounds=SkRect::MakeWH(float(n.properties.width),float(n.properties.height));
        const bool antiAlias=!(item.flags&wire::nodeFlags::hardEdgeClip);
        if(n.physicalPaint()&&path!=prepared.paths.end())canvas->clipPath(path->second,antiAlias);
        else if((item.flags&wire::nodeFlags::rectangularClip)||(!n.clipStyle&&!antiAlias))canvas->clipRect(bounds,false);
        else if(n.clipStyle){const auto& clip=*n.clipStyle;
          if(clip.shape==wire::clipShapes::rect)canvas->clipRect(bounds,antiAlias);
          else if(clip.shape==wire::clipShapes::oval)canvas->clipRRect(SkRRect::MakeOval(bounds),antiAlias);
          else if(clip.shape==wire::clipShapes::stadium)canvas->clipRRect(SkRRect::MakeRectXY(bounds,bounds.height()<bounds.width()?bounds.height()/2:bounds.width()/2,bounds.height()<bounds.width()?bounds.height()/2:bounds.width()/2),antiAlias);
          else if(clip.shape==wire::clipShapes::circle){const float size=std::min(bounds.width(),bounds.height());
            canvas->clipRRect(SkRRect::MakeOval(SkRect::MakeXYWH((bounds.width()-size)/2,(bounds.height()-size)/2,size,size)),antiAlias);}
          else{SkVector radii[4];for(size_t i=0;i<4;++i)radii[i]={float(clip.radii[i*2]),float(clip.radii[i*2+1])};
            SkRRect rounded;rounded.setRectRadii(bounds,radii);canvas->clipRRect(rounded,antiAlias);}}
        else if(path!=prepared.paths.end()){canvas->clipRect(bounds,antiAlias);canvas->clipPath(path->second,antiAlias);}
        else canvas->clipRRect(SkRRect::MakeRectXY(bounds,float(n.radius),float(n.radius)),antiAlias);
        if(item.flags&wire::nodeFlags::clipSaveLayer)canvas->saveLayer(&bounds,nullptr);
      }
      const auto& property=frame.properties[n.id.slot];
      if(property.opacity<1||n.graphics.blur>0){SkPaint layer;layer.setAlphaf(float(property.opacity));
        if(n.graphics.blur>0)layer.setImageFilter(SkImageFilters::Blur(float(n.graphics.blur),float(n.graphics.blur),SkTileMode::kDecal,nullptr));
        canvas->saveLayer(nullptr,&layer);}
      if(const auto mask=nativeLinearMask(item.paint.get())){const auto bounds=nativeMaskBounds(*mask);canvas->clipRect(bounds,false);canvas->saveLayer(&bounds,nullptr);}
      const auto found=prepared.pictures.find(item.node.key());if(found==prepared.pictures.end())throw std::runtime_error("Native prepared generation missing");
      const auto geometry=frame.focusNode==n.id?n.textGeometry:nullptr;
      const auto rect=[&](const TextRect& r,SkColor color){SkPaint paint;paint.setColor(color);canvas->drawRect(SkRect::MakeXYWH(float(r.x),float(r.y),float(r.width),float(r.height)),paint);};
      if(geometry)for(const auto& r:geometry->selection)rect(r,0x663582f6);
      // Opacity and blur already wrap the subtree above. A default paint here
      // adds an isolation layer and changes overlapping strut glyph rounding.
#if defined(_WIN32) && defined(SK_GRAPHITE) && !defined(SK_ENABLE_OPTIMIZE_SIZE)
      if(n.nativePaint&&std::any_of(n.nativePaint->entries.begin(),n.nativePaint->entries.end(),[](const auto& e){return e.kind==wire::nativePaintKinds::elevationShadow;})){
        NativeShadowReplayCanvas replay(*canvas);replay.drawPicture(found->second);
      }else
#endif
      canvas->drawPicture(found->second);
      drawPaint(item,false);
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
      if(n.snapshot) {
        const auto decision=snapshots.registry.paint(frame,n.id);
        snapshots.prune(decision);
        if(decision.action==1) {
          uint64_t layers=0;
          for(size_t childIndex=index+1;childIndex<ends[index];++childIndex){
            const auto& child=frame.items[childIndex];const auto& source=frame.scene->document->get(child.node);
            if(child.opacity<=0||source.paintOwner)continue;
            if(frame.properties[child.node.slot].opacity<1||source.graphics.blur>0)layers+=source.graphics.blur>0?3u:1u;
            if(child.flags&wire::nodeFlags::clipSaveLayer)++layers;
            if(nativeLinearMask(child.paint.get()))++layers;
            if(source.snapshot&&source.snapshot->live.opacity<1)++layers;
          }
          snapshots.capture(decision,n.id,n.lease.ledger,[&](SkCanvas* recording){
            drawRange(recording,index+1,ends[index],*item.world.inverse(),decision.ratio);
          },uint64_t(decision.pixelWidth)*decision.pixelHeight*4*layers);
        }
        if(decision.background){SkPaint background;background.setColor(decision.background);
          canvas->drawRect(SkRect::MakeWH(float(decision.boxWidth),float(decision.boxHeight)),background);}
        SkAutoCanvasRestore snapshotRestore(canvas,true);
        const auto& transform=decision.transform;
        canvas->concat(SkMatrix::MakeAll(float(transform.a),float(transform.c),float(transform.tx),float(transform.b),float(transform.d),float(transform.ty),0,0,1));
        if(decision.action==1||decision.action==2) {
          SkPaint paint;paint.setAlphaf(float(decision.opacity));
          canvas->drawImageRect(snapshots.get(decision.token),SkRect::MakeWH(float(decision.sourceRectWidth),float(decision.sourceRectHeight)),
            SkRect::MakeWH(float(decision.destinationWidth),float(decision.destinationHeight)),
            SkSamplingOptions(SkFilterMode::kLinear,SkMipmapMode::kLinear),&paint,SkCanvas::kStrict_SrcRectConstraint);
        } else if(decision.boxWidth>0&&decision.boxHeight>0&&decision.opacity>0) {
          if(decision.opacity<1){SkPaint paint;paint.setAlphaf(float(decision.opacity));canvas->saveLayer(nullptr,&paint);}
          drawRange(canvas,index+1,ends[index],overrideMatrix*item.world*transform*(*item.world.inverse()),pixelScale);
        }
        index=ends[index]-1;
      }
    }
    while(!saves.empty())finish();
    };
    drawRange(canvas,0,frame.items.size(),{},scale);
}
}
