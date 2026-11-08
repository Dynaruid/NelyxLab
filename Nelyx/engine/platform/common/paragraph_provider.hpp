// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "../../core/scene/paragraph.hpp"
#include "../../core/scene/font_catalog.hpp"
#include "../../render/skia/font_services.h"
#include "include/core/SkData.h"
#include "include/core/SkFontArguments.h"
#include "include/core/SkFontMgr.h"
#include "include/core/SkGraphics.h"
#include "include/core/SkTypeface.h"
#include "include/core/SkStream.h"
#include "modules/skparagraph/include/FontCollection.h"
#include "modules/skparagraph/include/Paragraph.h"
#include "modules/skparagraph/include/ParagraphBuilder.h"
#include "modules/skparagraph/include/TypefaceFontProvider.h"
#include "modules/skunicode/include/SkUnicode_icu.h"
#include <filesystem>
#include <bit>

namespace nelyx::v2::native {
/** One thread's private paragraph/font owner. App queries and Content use the
 * same builder policy, never the same mutable paragraph or font collection. */
class ParagraphProvider {
 public:
  std::shared_ptr<ExternalLease> fontMemory,cacheMemory,systemFontMemory;
  sk_sp<skia::textlayout::FontCollection> fonts;
  sk_sp<SkUnicode> unicode;
  sk_sp<SkFontMgr> manager;
  std::vector<std::pair<std::string,sk_sp<SkTypeface>>> faces;
  std::vector<SkString> fallbackFamilies{SkString("NelyxDefault"),SkString("NelyxArabic"),SkString("NelyxHebrew"),SkString("NelyxEmoji")};
  uint64_t fontLoads=0;
  bool hasFamily(const std::string& name)const{return std::any_of(faces.begin(),faces.end(),[&](const auto& face){return face.first==name;});}
  bool lineMetricsUtf16=true;
  uint64_t layouts=0;
  std::unique_ptr<skia::textlayout::Paragraph> build(const std::string& text,double size,
      uint32_t color,uint32_t direction,const nelyx::v2::ParagraphOptions* supplied,double width) {
    using namespace skia::textlayout;
    TextStyle style;style.setFontFamilies(fallbackFamilies);
    style.setFontSize(float(size));style.setColor(color);
    const nelyx::v2::ParagraphOptions defaults;const auto& options=supplied?*supplied:defaults;
    if(supplied){
      if(!options.fontFamily.empty()){auto families=fallbackFamilies;families.insert(families.begin(),SkString(options.fontFamily.c_str()));style.setFontFamilies(families);}
      const SkFontArguments::VariationPosition::Coordinate weight{SkSetFourByteTag('w','g','h','t'),float(options.fontWeight)};
      SkFontArguments arguments;arguments.setVariationDesignPosition({&weight,1});
      style.setFontArguments(arguments);style.setFontStyle(SkFontStyle(int(options.fontWeight),SkFontStyle::kNormal_Width,SkFontStyle::kUpright_Slant));
    }
    style.setLocale(SkString(options.locale.data(),options.locale.size()));
    style.setLetterSpacing(float(options.letterSpacing));style.setWordSpacing(float(options.wordSpacing));
    style.setHalfLeading((options.flags&wire::paragraphFlags::halfLeading)!=0);
    if(options.height>=0){style.setHeightOverride(true);style.setHeight(float(options.height));}
    ParagraphStyle paragraphStyle;paragraphStyle.setTextStyle(style);
    if(supplied){paragraphStyle.turnHintingOff();paragraphStyle.setReplaceTabCharacters(true);paragraphStyle.setApplyRoundingHack(false);paragraphStyle.setRenderSoftHyphens((options.flags&wire::paragraphFlags::manualHyphens)!=0);}
    const TextAlign alignments[]={TextAlign::kStart,TextAlign::kEnd,TextAlign::kLeft,TextAlign::kRight,TextAlign::kCenter,TextAlign::kJustify};
    if(options.align>=std::size(alignments))throw std::runtime_error("Invalid paragraph alignment");
    paragraphStyle.setTextAlign(alignments[options.align]);
    if(options.maxLines)paragraphStyle.setMaxLines(options.maxLines);
    if(!options.ellipsis.empty())paragraphStyle.setEllipsis(SkString(options.ellipsis.data(),options.ellipsis.size()));
    paragraphStyle.setTextHeightBehavior(static_cast<TextHeightBehavior>(
      ((options.flags&wire::paragraphFlags::disableFirstAscent)?1:0)|((options.flags&wire::paragraphFlags::disableLastDescent)?2:0)));
    paragraphStyle.setTextDirection(direction?TextDirection::kRtl:TextDirection::kLtr);
    if(options.strut){const auto& value=*options.strut;StrutStyle strut;strut.setStrutEnabled(true);
      std::vector<SkString> families;for(const auto& family:value.fontFamilies)families.emplace_back(family.c_str());
      families.insert(families.end(),fallbackFamilies.begin(),fallbackFamilies.end());
      strut.setFontFamilies(std::move(families));strut.setFontSize(float(value.fontSize));strut.setFontStyle(SkFontStyle(int(value.fontWeight),SkFontStyle::kNormal_Width,(value.flags&1)?SkFontStyle::kItalic_Slant:SkFontStyle::kUpright_Slant));
      strut.setHalfLeading((value.flags&2)!=0);strut.setForceStrutHeight((value.flags&4)!=0);strut.setLeading(float(value.leading));
      if(value.height>=0){strut.setHeightOverride(true);strut.setHeight(float(value.height));}paragraphStyle.setStrutStyle(std::move(strut));}
    validateParagraphPlaceholders(text,options);
    auto builder=ParagraphBuilder::make(paragraphStyle,fonts,unicode);
    size_t placeholderIndex=0;
    const auto append=[&](size_t start,size_t end,uint32_t units){size_t chunk=start,byte=start;
      while(byte<end){const auto c=uint8_t(text[byte]);const size_t length=c<0x80?1:c<0xe0?2:c<0xf0?3:4;
        if(placeholderIndex<options.placeholders.size()&&options.placeholders[placeholderIndex].offset==units){
          const auto& item=options.placeholders[placeholderIndex++];if(chunk<byte)builder->addText(text.data()+chunk,byte-chunk);
          builder->addPlaceholder(PlaceholderStyle(float(item.width),float(item.height),static_cast<PlaceholderAlignment>(item.alignment),item.baseline?TextBaseline::kIdeographic:TextBaseline::kAlphabetic,float(item.baselineOffset)));chunk=byte+length;}
        byte+=length;units+=length==4?2:1;
      }
      if(chunk<end)builder->addText(text.data()+chunk,end-chunk);
    };
    if(options.runs.empty())append(0,text.size(),0);
    else forParagraphRuns(text,options,[&](const ParagraphRun& run,size_t start,size_t end){
      TextStyle current;current.setFontSize(float(run.fontSize));current.setColor(run.color);
      std::vector<SkString> families;for(const auto& family:run.fontFamilies)families.emplace_back(family.c_str());
      families.insert(families.end(),fallbackFamilies.begin(),fallbackFamilies.end());
      current.setFontFamilies(families);current.setLocale(SkString(run.locale.c_str()));
      std::vector<SkFontArguments::VariationPosition::Coordinate> coordinates;coordinates.reserve(run.variations.size()+1);
      const auto weightTag=SkSetFourByteTag('w','g','h','t');bool hasWeight=false;
      for(const auto& variation:run.variations){coordinates.push_back({variation.tag,float(variation.value)});hasWeight|=variation.tag==weightTag;}
      if(!hasWeight)coordinates.insert(coordinates.begin(),{weightTag,float(run.fontWeight)});
      SkFontArguments arguments;arguments.setVariationDesignPosition({coordinates.data(),int(coordinates.size())});current.setFontArguments(arguments);
      for(const auto& feature:run.features){const char name[]={char(feature.tag>>24),char(feature.tag>>16),char(feature.tag>>8),char(feature.tag)};current.addFontFeature(SkString(name,4),std::bit_cast<int32_t>(feature.value));}
      for(const auto& shadow:run.shadows)current.addShadow(TextShadow(shadow.color,SkPoint::Make(float(shadow.x),float(shadow.y)),shadow.sigma));
      current.setFontStyle(SkFontStyle(int(run.fontWeight),SkFontStyle::kNormal_Width,(run.flags&2)?SkFontStyle::kItalic_Slant:SkFontStyle::kUpright_Slant));
      current.setLetterSpacing(float(run.letterSpacing));current.setWordSpacing(float(run.wordSpacing));current.setHalfLeading((run.flags&4)!=0);
      current.setTextBaseline((run.flags&wire::paragraphRunFlags::ideographicBaseline)?TextBaseline::kIdeographic:TextBaseline::kAlphabetic);
      if(run.height>=0){current.setHeightOverride(true);current.setHeight(float(run.height));}
      if(run.flags&1){SkPaint paint;paint.setColor(run.backgroundColor);paint.setAntiAlias(true);current.setBackgroundPaint(paint);}
      current.setDecoration(static_cast<TextDecoration>(run.decoration));current.setDecorationStyle(static_cast<TextDecorationStyle>(run.decorationStyle));
      current.setDecorationThicknessMultiplier(float(run.decorationThickness));if(run.flags&8)current.setDecorationColor(run.decorationColor);
      builder->pushStyle(current);append(start,end,run.start);builder->pop();
    });
    if(placeholderIndex!=options.placeholders.size())throw std::runtime_error("Paragraph placeholder was not consumed");
    auto paragraph=builder->Build();paragraph->layout(float(width));++layouts;
    return paragraph;
  }
  ParagraphProvider(const std::string& font,const std::string& icu,
      const std::shared_ptr<Ledger>& ledger,uint32_t owner) {
    const auto directory=std::filesystem::path(font).parent_path();uint64_t fontBytes=std::filesystem::file_size(font);
    for(const auto name:{"NotoNaskhArabic-Regular.ttf","NotoSansHebrew.ttf","NotoColorEmoji.ttf"})fontBytes+=std::filesystem::file_size(directory/name);
    fontMemory=std::make_shared<ExternalLease>(ledger,owner,2,fontBytes*3+std::filesystem::file_size(icu));
    cacheMemory=std::make_shared<ExternalLease>(ledger,owner,2,8*1024*1024);
    SkGraphics::SetResourceCacheTotalByteLimit(4*1024*1024);SkGraphics::SetFontCacheLimit(4*1024*1024);
    nelyx::font_services::initialize(icu);
    manager=nelyx::font_services::manager();
    auto defaultFace=manager->makeFromData(SkData::MakeFromFileName(font.c_str()));
    if(!defaultFace)throw std::runtime_error("Native font decode failed");
    auto provider=sk_make_sp<skia::textlayout::TypefaceFontProvider>();
    provider->registerTypeface(defaultFace,SkString("NelyxDefault"));
    faces.emplace_back("NelyxDefault",defaultFace);
    for(const auto& fallback:{std::pair{"NotoNaskhArabic-Regular.ttf","NelyxArabic"},
        std::pair{"NotoSansHebrew.ttf","NelyxHebrew"},std::pair{"NotoColorEmoji.ttf","NelyxEmoji"}}){
      auto fallbackFace=manager->makeFromData(SkData::MakeFromFileName((directory/fallback.first).string().c_str()));
      if(!fallbackFace)throw std::runtime_error("Native fallback font decode failed");
      provider->registerTypeface(fallbackFace,SkString(fallback.second));
      faces.emplace_back(fallback.second,fallbackFace);
    }
#if defined(__ANDROID__) || defined(_WIN32)
    // Retain the actual platform typography cohort on both App and Content.
    // Browser owners use their declared bundled/downloaded cohort instead.
#if defined(__ANDROID__)
    constexpr auto systemFamily="sans-serif",declaredFamily="Roboto";
#else
    constexpr auto systemFamily="Segoe UI",declaredFamily="Segoe UI";
#endif
    if(auto family=manager->matchFamily(systemFamily)){
      uint64_t bytes=0;std::vector<sk_sp<SkTypeface>> systemFaces;std::set<std::pair<size_t,uint64_t>> streams;
      for(int index=0;index<family->count()&&index<32;++index)if(auto face=family->createTypeface(index)){
        auto stream=face->openStream(nullptr);if(!stream||stream->getLength()>16*1024*1024)throw std::runtime_error("System font exceeds its declared budget");
        // System collections may expose variation instances backed by one file.
        // Charge distinct immutable font data once, plus each face instance.
        uint64_t hash=1469598103934665603ull;size_t total=0;std::array<uint8_t,65536> block;
        for(size_t count;(count=stream->read(block.data(),block.size()))!=0;){total+=count;for(size_t at=0;at<count;++at){hash^=block[at];hash*=1099511628211ull;}}
        if(total!=stream->getLength())throw std::runtime_error("System font stream changed while opening");
        if(streams.emplace(total,hash).second)bytes+=total;
        if(bytes>32*1024*1024)throw std::runtime_error("System font cohort exceeds its declared budget");systemFaces.push_back(std::move(face));
      }
      if(!systemFaces.empty()){systemFontMemory=std::make_shared<ExternalLease>(ledger,owner,2,bytes*3+systemFaces.size()*65536);for(const auto& face:systemFaces){provider->registerTypeface(face,SkString(declaredFamily));faces.emplace_back(declaredFamily,face);}}
    }
#endif
    fonts=sk_make_sp<skia::textlayout::FontCollection>();
    fonts->setAssetFontManager(provider);fonts->setDefaultFontManager(manager);
    unicode=SkUnicodes::ICU::Make();if(!unicode)throw std::runtime_error("Native Unicode provider failed");
    const std::string text="\xed\x95\x9c\xea\xb8\x80\nA\xf0\x9f\x98\x80\ne\xcc\x81";
    auto paragraph=build(text,18,0xff000000,0,nullptr,300);
    std::vector<skia::textlayout::LineMetrics> metrics;paragraph->getLineMetrics(metrics);
    if(metrics.size()!=3||(metrics[1].fStartIndex!=3&&metrics[1].fStartIndex!=7))throw std::runtime_error("Native paragraph line index unit is incompatible");
    lineMetricsUtf16=metrics[1].fStartIndex==3;
  }
  ParagraphProvider(const ParagraphProvider& base,const FontCatalog& catalog,
      const std::shared_ptr<Ledger>& ledger,uint32_t owner,uint64_t* work=nullptr) {
    uint64_t bytes=65536;for(const auto& font:catalog.fonts)bytes+=font.bytes.length*3+font.family.size()*2+256;
    fontMemory=std::make_shared<ExternalLease>(ledger,owner,2,bytes);
    cacheMemory=std::make_shared<ExternalLease>(ledger,owner,2,8*1024*1024);
    manager=base.manager;unicode=base.unicode;lineMetricsUtf16=base.lineMetricsUtf16;systemFontMemory=base.systemFontMemory;
    auto provider=sk_make_sp<skia::textlayout::TypefaceFontProvider>();
    std::set<std::string> replaced;
    for(const auto& font:catalog.fonts){
      auto face=manager->makeFromData(SkData::MakeWithCopy(font.bytes.data,font.bytes.length));
      if(!face)throw std::runtime_error("Dynamic native font decode failed");
      ++fontLoads;if(work)++*work;provider->registerTypeface(face,SkString(font.family.c_str()));
      faces.emplace_back(font.family,std::move(face));replaced.insert(font.family);
    }
    for(const auto& face:base.faces)if(!replaced.contains(face.first)){
      provider->registerTypeface(face.second,SkString(face.first.c_str()));faces.push_back(face);
    }
    fallbackFamilies.clear();for(const auto& family:catalog.fallback)fallbackFamilies.emplace_back(family.c_str());
    fonts=sk_make_sp<skia::textlayout::FontCollection>();
    fonts->setAssetFontManager(provider);fonts->setDefaultFontManager(manager);
  }
  ~ParagraphProvider(){if(fonts)fonts->clearCaches();}
};
}
