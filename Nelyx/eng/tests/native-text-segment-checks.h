// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <limits>
#include "nelyx_skia/core.h"
#include "nelyx_skia/gpu_context.h"
#include "include/core/SkData.h"
#include "include/core/SkFontMgr.h"
#include "include/core/SkTypeface.h"
#include "include/core/SkPixmap.h"
#include "include/ports/SkTypeface_win.h"
#include "modules/skparagraph/include/FontCollection.h"
#include "modules/skparagraph/include/TypefaceFontProvider.h"
#include "modules/skunicode/include/SkUnicode_icu.h"
extern "C" void C_SetICU(void const*);
static void paragraphSegmentChecks(nelyx::gpu::Context& gpu,const char* fontPath,const char* icuPath){
  auto font=SkData::MakeFromFileName(fontPath),icu=SkData::MakeFromFileName(icuPath);
  require(font&&icu,"Bundled paragraph/ICU inputs missing");C_SetICU(icu->data());
  namespace para=skia::textlayout;
  auto manager=SkFontMgr_New_DirectWrite();auto provider=sk_make_sp<para::TypefaceFontProvider>();
  auto face=manager->makeFromData(font);require(bool(face),"Bundled paragraph face did not decode");provider->registerTypeface(face,SkString("SegmentFixture"));
  auto fonts=sk_make_sp<para::FontCollection>();fonts->setAssetFontManager(provider);fonts->setDefaultFontManager(manager);fonts->enableFontFallback();
  auto unicode=SkUnicodes::ICU::Make();require(bool(unicode),"ICU paragraph engine missing");
  auto deferred=gpu.makeRecorder();
  for(float dpr:{1.25f,2.f})for(float width:{80.f,170.f,std::numeric_limits<float>::infinity()}){
    para::TextStyle style;style.setFontFamilies({SkString("SegmentFixture")});style.setFontSize(20);style.setColor(0xff123456);style.setDecoration(para::TextDecoration::kUnderline);
    para::ParagraphStyle settings;settings.setTextStyle(style);settings.setMaxLines(3);settings.setEllipsis(u"…");settings.setTextDirection(width==170?para::TextDirection::kRtl:para::TextDirection::kLtr);
    auto builder=para::ParagraphBuilder::make(settings,fonts,unicode);
    builder->addText("A😀 é אבג 한글 wrapped text\n");
    builder->addPlaceholder(para::PlaceholderStyle(12,8,para::PlaceholderAlignment::kBaseline,para::TextBaseline::kAlphabetic,6));
    style.setColor(0xffc02080);style.setFontSize(24);builder->pushStyle(style);builder->addText("Styled 한글 and emoji 😀 text");builder->pop();
    auto paragraph=nelyx::skia_core::buildParagraph(*builder);nelyx::skia_core::layoutParagraph(*paragraph,width);
    sk_sp<SkImage> reference;
    for(bool sealed:{false,true}){
      auto surface=gpu.MakeOffscreen(512,256);require(bool(surface),"Paragraph segment surface missing");
      auto* canvas=deferred->makeDeferredCanvas(surface->imageInfo(),gpu.textureInfo(surface->imageInfo().colorType()));require(canvas,"Paragraph segment canvas missing");
      canvas->clear(SK_ColorWHITE);canvas->scale(dpr,dpr);canvas->clipRect(SkRect::MakeLTRB(3,3,240,116));
      const float x=width==80?-6.25f:10.5f,y=width==170?-7.75f:8.25f;
      if(sealed)nelyx::skia_core::drawPicture(*canvas,nelyx::skia_core::sealParagraph(*paragraph,x,y));
      else nelyx::skia_core::paintParagraph(*paragraph,*canvas,x,y);
      auto frame=deferred->snap(),initial=surface->recorder()->snap();if(initial)gpu.submitRecording(initial.get());
      require(frame&&gpu.insertRecordings({frame.get()},surface.get()),"Paragraph segment recording rejected");
      auto image=surface->makeImageSnapshot();auto recording=surface->recorder()->snap();if(recording)gpu.submitRecording(recording.get());
      auto raster=gpu.MakeRasterImage(image);SkPixmap pixels;require(raster&&raster->peekPixels(&pixels),"Paragraph segment pixels missing");
      if(!sealed)reference=raster;else{SkPixmap expected;require(reference->peekPixels(&expected),"Paragraph reference missing");for(int row=0;row<256;++row)for(int col=0;col<512;++col)require(pixels.getColor(col,row)==expected.getColor(col,row),"Sealed paragraph glyph/clip pixels differ from direct paint");}
    }
  }
  std::cout<<"PASS exact delivered sealed/direct paragraph pixels: Korean, emoji, BiDi, styles, placeholders, ellipsis, infinite width and fractional-DPI clipping\n";
}
