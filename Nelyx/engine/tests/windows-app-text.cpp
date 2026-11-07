// SPDX-License-Identifier: BSD-3-Clause
#include <windows.h>
#include <hermes/hermes.h>
#include "../platform/windows/app_text_jsi.hpp"
#include "../platform/windows/skia_provider.hpp"
#include <future>
#include <fstream>
#include <iostream>
#include <sstream>
using namespace nelyx::v2;
namespace nw=nelyx::v2::windows;
namespace jsi=facebook::jsi;
#include "native-inline-text.hpp"
#include "native-font-text.hpp"
int main(int argc,char** argv){
  try{
    if(argc!=4)throw std::runtime_error("Expected query bundle, supply root and asset directory");
    auto ledger=std::make_shared<Ledger>();
    {
      nw::AppParagraphs service(std::string(argv[2])+"/assets/font.ttf",std::string(argv[2])+"/assets/icudtl.dat",ledger,argv[3]);
      auto runtime=facebook::hermes::makeHermesRuntime(::hermes::vm::RuntimeConfig::Builder().withMicrotaskQueue(true).build());auto& rt=*runtime;
      jsi::Object native(rt);nw::installAppText(rt,native,service);rt.global().setProperty(rt,"NelyxV2Native",std::move(native));
      rt.global().setProperty(rt,"__bufferFilePath",jsi::String::createFromUtf8(rt,std::string(argv[3])+"/한글 data.bin"));
      std::ifstream file(argv[1]);std::stringstream source;source<<file.rdbuf();
      rt.evaluateJavaScript(std::make_shared<jsi::StringBuffer>(source.str()),"app-text-probe.js");
      rt.drainMicrotasks();
      if(rt.global().hasProperty(rt,"__appTextError"))throw std::runtime_error(rt.global().getProperty(rt,"__appTextError").asString(rt).utf8(rt));
      auto json=rt.global().getPropertyAsObject(rt,"JSON");
      auto result=json.getPropertyAsFunction(rt,"parse").call(rt,rt.global().getProperty(rt,"__appTextResult")).asObject(rt);
      auto inputs=result.getPropertyAsObject(rt,"paintInputs").asArray(rt);
      struct PaintInput {nw::AppTextInput value;double width,height,baseline;bool unbounded;std::vector<Rect> boxes;};
      std::vector<PaintInput> copied;
      for(size_t i=0;i<inputs.size(rt);++i){auto record=inputs.getValueAtIndex(rt,i).asObject(rt),data=record.getPropertyAsObject(rt,"input");
        const bool unbounded=record.getProperty(rt,"unbounded").getBool();data.setProperty(rt,"unbounded",unbounded);
        auto input=nw::app_text_jsi::input(nw::app_text_jsi::Packet(rt,jsi::Value(rt,data)));
        copied.push_back({std::move(input),record.getProperty(rt,"width").asNumber(),record.getProperty(rt,"height").asNumber(),record.getProperty(rt,"baseline").asNumber(),unbounded,{}});
      }
      auto richInputs=result.getPropertyAsObject(rt,"rich").getPropertyAsObject(rt,"inputs").asArray(rt);std::vector<PaintInput> richCopied;
      for(size_t i=0;i<richInputs.size(rt);++i){auto record=richInputs.getValueAtIndex(rt,i).asObject(rt),data=record.getPropertyAsObject(rt,"input");
        const bool unbounded=record.getProperty(rt,"unbounded").getBool();data.setProperty(rt,"unbounded",unbounded);
        auto input=nw::app_text_jsi::input(nw::app_text_jsi::Packet(rt,jsi::Value(rt,data)));
        richCopied.push_back({std::move(input),record.getProperty(rt,"width").asNumber(),record.getProperty(rt,"height").asNumber(),record.getProperty(rt,"baseline").asNumber(),unbounded,{}});
      }
      auto extraInputs=result.getPropertyAsObject(rt,"extras").getPropertyAsObject(rt,"inputs").asArray(rt);std::vector<PaintInput> extraCopied;
      for(size_t i=0;i<extraInputs.size(rt);++i){auto record=extraInputs.getValueAtIndex(rt,i).asObject(rt),data=record.getPropertyAsObject(rt,"input");
        const bool unbounded=record.getProperty(rt,"unbounded").getBool();data.setProperty(rt,"unbounded",unbounded);
        auto input=nw::app_text_jsi::input(nw::app_text_jsi::Packet(rt,jsi::Value(rt,data)));std::vector<Rect> boxes;
        auto copiedBoxes=record.getPropertyAsObject(rt,"boxes").asArray(rt);for(size_t j=0;j<copiedBoxes.size(rt);++j){auto box=copiedBoxes.getValueAtIndex(rt,j).asObject(rt);boxes.push_back({box.getProperty(rt,"x").asNumber(),box.getProperty(rt,"y").asNumber(),box.getProperty(rt,"width").asNumber(),box.getProperty(rt,"height").asNumber()});}
        extraCopied.push_back({std::move(input),record.getProperty(rt,"width").asNumber(),record.getProperty(rt,"height").asNumber(),record.getProperty(rt,"baseline").asNumber(),unbounded,std::move(boxes)});
      }
      auto pathInput=result.getPropertyAsObject(rt,"pathInput").asArray(rt);std::vector<uint8_t> pathBytes(pathInput.size(rt));
      for(size_t i=0;i<pathBytes.size();++i)pathBytes[i]=uint8_t(pathInput.getValueAtIndex(rt,i).asNumber());
      auto liveInput=result.getPropertyAsObject(rt,"livePathInput").asArray(rt);std::vector<uint8_t> liveBytes(liveInput.size(rt));
      for(size_t i=0;i<liveBytes.size();++i)liveBytes[i]=uint8_t(liveInput.getValueAtIndex(rt,i).asNumber());
      auto orderedInput=result.getPropertyAsObject(rt,"orderedInput").asArray(rt);std::vector<uint8_t> orderedBytes(orderedInput.size(rt));
      for(size_t i=0;i<orderedBytes.size();++i)orderedBytes[i]=uint8_t(orderedInput.getValueAtIndex(rt,i).asNumber());
      auto placements=result.getPropertyAsObject(rt,"orderedPlacements").asArray(rt);std::vector<std::vector<uint8_t>> orderedPlacements;
      for(size_t i=0;i<placements.size(rt);++i){auto data=placements.getValueAtIndex(rt,i).asObject(rt).asArray(rt);std::vector<uint8_t> bytes(data.size(rt));
        for(size_t j=0;j<bytes.size();++j)bytes[j]=uint8_t(data.getValueAtIndex(rt,j).asNumber());orderedPlacements.push_back(std::move(bytes));}
      // A separate Content owner receives copied DTOs, never App/JSI paragraphs.
      const auto counters=std::async(std::launch::async,[ledger,copied,richCopied,extraCopied,pathBytes,liveBytes,orderedBytes,orderedPlacements,root=std::string(argv[2])]{
        nw::ContentProvider content(root+"/assets/font.ttf",root+"/assets/icudtl.dat",ledger);
        uint64_t ink=0;
        for(size_t i=0;i<copied.size();++i){const auto& input=copied[i];
          auto node=std::make_shared<Node>(ledger);node->id={1,1};node->kind=wire::kinds::paragraph;
          node->text=std::make_shared<TextData>(ledger,Reader{reinterpret_cast<const uint8_t*>(input.value.text.data()),input.value.text.size()});
          node->fontSize=input.value.fontSize;node->color=input.value.color;node->textDirection=input.value.direction;
          node->paragraph=std::make_shared<ParagraphData>(ledger,input.value.options);
          auto placement=std::make_shared<PaintPlacement>(ledger);placement->unbounded=input.unbounded;node->paintPlacement=placement;
          const auto measure=content.measure({uint64_t(i+1),node,input.width,true,uint64_t(i+1)});
          const auto close=[](double a,double b){return std::abs(a-b)<1e-5;};
          if(!close(measure.width,input.width)||!close(measure.height,input.height)||!close(measure.baseline,input.baseline))
            throw std::runtime_error("Native Content changed the Source recorded paragraph geometry");
          node->properties.width=node->contentWidth=measure.width;node->properties.height=node->contentHeight=measure.height;
          node->contentX=4;node->contentY=5;
          auto document=std::make_shared<Document>(ledger);document->nodes[1].value=node;document->count=document->highWater=1;
          Preparation preparation;preparation.document=document;preparation.id=i+1;preparation.metrics.epoch=1;preparation.metrics.device=1;
          auto prepared=content.prepare(preparation);
          auto surface=SkSurfaces::Raster(SkImageInfo::MakeN32Premul(256,128));if(!surface)throw std::runtime_error("Native raster surface unavailable");
          surface->getCanvas()->clear(SK_ColorWHITE);surface->getCanvas()->drawPicture(prepared->pictures.at(node->id.key()));
          SkPixmap pixels;if(!surface->peekPixels(&pixels))throw std::runtime_error("Native raster pixels unavailable");
          uint64_t painted=0;for(int y=0;y<pixels.height();++y)for(int x=0;x<pixels.width();++x)if(pixels.getColor(x,y)==input.value.color)++painted;
          if(painted<10)throw std::runtime_error("Native Content paragraph produced no text ink");ink+=painted;
        }
        auto node=std::make_shared<Node>(ledger);node->id={1,1};node->kind=wire::kinds::box;node->properties.width=256;node->properties.height=128;
        node->nativePaint=readNativePaint(ledger,Reader{pathBytes.data(),pathBytes.size()});
        auto document=std::make_shared<Document>(ledger);document->nodes[1].value=node;document->children[0].push_back(node->id);document->count=document->highWater=1;
        resolveNativePaint(*document);
        Preparation preparation;preparation.document=document;preparation.id=3;preparation.metrics.epoch=1;preparation.metrics.device=1;
        auto prepared=content.prepare(preparation);auto surface=SkSurfaces::Raster(SkImageInfo::MakeN32Premul(256,128));
        if(!surface)throw std::runtime_error("Native path raster surface unavailable");
        surface->getCanvas()->clear(SK_ColorWHITE);surface->getCanvas()->drawPicture(prepared->pictures.at(node->id.key()));
        SkPixmap pixels;if(!surface->peekPixels(&pixels))throw std::runtime_error("Native path raster pixels unavailable");
        const auto alpha=SkColorSetRGB(147,163,183);
        for(const auto point:{Point{100,40},Point{100,55},Point{100,60},Point{165,25}})
          if(pixels.getColor(int(point.x),int(point.y))!=alpha)throw std::runtime_error("Compound Native path painted overlap alpha twice or lost its tail");
        if(pixels.getColor(180,40)!=SK_ColorWHITE)throw std::runtime_error("Native even-odd path filled its hole");
        uint64_t pathInk=0;for(int y=0;y<pixels.height();++y)for(int x=0;x<pixels.width();++x)if(pixels.getColor(x,y)==alpha)++pathInk;
        auto scroll=std::make_shared<Node>(ledger);scroll->id={1,1};scroll->kind=wire::kinds::scrollViewport;
        scroll->properties.width=256;scroll->properties.height=128;scroll->properties.flags=1;
        auto live=std::make_shared<Node>(ledger);live->id={2,1};live->parent=scroll->id;live->kind=wire::kinds::box;live->properties.width=256;live->properties.height=128;
        live->nativePaint=readNativePaint(ledger,Reader{liveBytes.data(),liveBytes.size()});
        auto dynamic=std::make_shared<Document>(ledger);dynamic->nodes[1].value=scroll;dynamic->nodes[2].value=live;
        dynamic->children[0].push_back(scroll->id);dynamic->children[1].push_back(live->id);dynamic->count=dynamic->highWater=2;dynamic->framePaintGeometry=true;
        resolveNativePaint(*dynamic);Preparation livePreparation;livePreparation.document=dynamic;livePreparation.id=4;livePreparation.metrics={1,1,256,128,1};
        auto livePrepared=content.prepare(livePreparation);View view(1,ledger);uint64_t liveWork=0,livePaints=0;
        for(const double offset:{0.0,80.0}){Frame frame;frame.scene=std::make_shared<Scene>(Scene{dynamic,livePreparation.metrics,1,4,{}});frame.properties.resize(3);frame.properties[1].offset=offset;
          view.makeDrawItems(frame);liveWork+=frame.paintWork;
          surface->getCanvas()->clear(SK_ColorWHITE);
          for(const auto& item:frame.items){const auto& n=dynamic->get(item.node);auto canvas=surface->getCanvas();canvas->save();
            const auto& m=item.world;canvas->concat(SkMatrix::MakeAll(float(m.a),float(m.c),float(m.tx),float(m.b),float(m.d),float(m.ty),0,0,1));
            canvas->drawPicture(livePrepared->pictures.at(item.node.key()));SkPaint paint;paint.setAntiAlias(true);nw::paintFrameNative(canvas,n,item,paint);
            if(item.paint)++livePaints;canvas->restore();}
          if(!surface->peekPixels(&pixels))throw std::runtime_error("Native live frame pixels unavailable");
          if(pixels.getColor(offset?60:100,40)!=alpha|| (offset&&pixels.getColor(100,40)!=SK_ColorWHITE))
            throw std::runtime_error("Native live frame retained stale Content paint or lost its screen correction");
        }
        uint64_t liveInk=0;for(int y=0;y<pixels.height();++y)for(int x=0;x<pixels.width();++x)if(pixels.getColor(x,y)==alpha)++liveInk;
        auto ordered=std::make_shared<Document>(ledger);auto parent=std::make_shared<Node>(ledger);parent->id={1,1};parent->kind=wire::kinds::stack;parent->properties.width=300;parent->properties.height=180;
        parent->nativePaint=readNativePaint(ledger,Reader{orderedBytes.data(),orderedBytes.size()});ordered->nodes[1].value=parent;ordered->children[0].push_back(parent->id);
        for(size_t i=0;i<copied.size();++i){const auto& input=copied[i];auto resource=std::make_shared<Node>(ledger);resource->id={uint32_t(i+2),1};resource->parent=resource->paintOwner=parent->id;resource->kind=wire::kinds::paragraph;
          resource->text=std::make_shared<TextData>(ledger,Reader{reinterpret_cast<const uint8_t*>(input.value.text.data()),input.value.text.size()});resource->fontSize=input.value.fontSize;resource->color=input.value.color;resource->textDirection=input.value.direction;
          resource->paragraph=std::make_shared<ParagraphData>(ledger,input.value.options);const auto& bytes=orderedPlacements.at(i);resource->paintPlacement=readPaintPlacement(ledger,Reader{bytes.data(),bytes.size()});
          const auto measure=content.measure({100+i,resource,input.width,true,100+i});resource->properties.width=resource->contentWidth=measure.width;resource->properties.height=resource->contentHeight=measure.height;resource->baseline=measure.baseline;
          ordered->nodes[resource->id.slot].value=resource;ordered->children[1].push_back(resource->id);
        }
        auto child=std::make_shared<Node>(ledger);child->id={4,1};child->parent=parent->id;child->kind=wire::kinds::box;child->color=0xff224466;child->properties.width=150;child->properties.height=100;
        ordered->nodes[4].value=child;ordered->children[1].insert(ordered->children[1].begin(),child->id);ordered->count=ordered->highWater=4;ordered->framePaintGeometry=true;
        resolvePaintPlacements(*ordered,1);resolveNativePaint(*ordered);Preparation orderedPreparation;orderedPreparation.document=ordered;orderedPreparation.id=5;orderedPreparation.metrics={1,1,360,240,1};
        auto orderedPrepared=content.prepare(orderedPreparation);Frame orderedFrame;orderedFrame.scene=std::make_shared<Scene>(Scene{ordered,orderedPreparation.metrics,1,5,{}});orderedFrame.properties.resize(5);view.makeDrawItems(orderedFrame);
        if(orderedFrame.allows({2,1})||orderedFrame.allows({3,1}))throw std::runtime_error("Inline paint resources became input targets");
        auto actual=SkSurfaces::Raster(SkImageInfo::MakeN32Premul(360,240)),expected=SkSurfaces::Raster(SkImageInfo::MakeN32Premul(360,240));if(!actual||!expected)throw std::runtime_error("Native ordered raster unavailable");
        nw::NativePaintCounts orderedCounts;uint64_t orderedDiff=0,orderedInk=0,orderedWork=0;
        for(const bool faded:{false,true}){
          if(faded){auto changed=std::make_shared<Document>(*ordered);auto fadedParent=std::make_shared<Node>(*parent);fadedParent->graphics.blur=2;changed->nodes[1].value=fadedParent;
            orderedFrame=Frame{};orderedFrame.scene=std::make_shared<Scene>(Scene{changed,orderedPreparation.metrics,1,5,{}});orderedFrame.properties.resize(5);
            orderedFrame.properties[1].opacity=0.6;orderedFrame.properties[2].opacity=0.5;orderedFrame.properties[3].opacity=0.7;view.makeDrawItems(orderedFrame);}
          orderedWork+=orderedFrame.paintWork;nw::drawPreparedFrame(actual->getCanvas(),orderedFrame,*orderedPrepared,1,orderedCounts);
          auto canvas=expected->getCanvas();canvas->clear(0xfff4f6fa);SkPaint reference;reference.setAntiAlias(true);SkPaint layer;
          if(faded){layer.setAlphaf(0.6f);layer.setImageFilter(SkImageFilters::Blur(2,2,SkTileMode::kDecal,nullptr));canvas->saveLayer(nullptr,&layer);}
          const auto rect=[&](float x,float y,float w,float h,SkColor color){reference.setColor(color);canvas->drawRect(SkRect::MakeXYWH(x,y,w,h),reference);};
          const auto paragraph=[&](Handle resource,float x,float y,float alpha){canvas->save();canvas->translate(x,y);SkPaint opacity;opacity.setAlphaf(alpha);canvas->drawPicture(orderedPrepared->pictures.at(resource.key()),nullptr,&opacity);canvas->restore();};
          rect(0,0,300,180,0xffeeeeee);canvas->save();canvas->clipRect(SkRect::MakeXYWH(150,0,100,40),true);
          paragraph({2,1},160,5,faded?0.5f:1);rect(150,0,45,40,0xff337744);canvas->restore();
          rect(0,0,150,100,0xff224466);paragraph({3,1},10,50,faded?0.7f:1);rect(10,50,35,25,0xff775599);if(faded)canvas->restore();
          SkPixmap actualPixels,expectedPixels;if(!actual->peekPixels(&actualPixels)||!expected->peekPixels(&expectedPixels))throw std::runtime_error("Native ordered pixels unavailable");
          for(int y=0;y<240;++y)for(int x=0;x<360;++x){if(actualPixels.getColor(x,y)!=expectedPixels.getColor(x,y))++orderedDiff;if(actualPixels.getColor(x,y)==copied[0].value.color)++orderedInk;}
        }
        if(orderedDiff||orderedCounts.paragraphs!=4||orderedCounts.foreground!=2||!orderedInk)throw std::runtime_error("Native ordered paint differs from imperative Canvas order or paints inline paragraphs twice");
        uint64_t richInk=0,richDiff=0,shadowOutside=0;
        nw::ParagraphProvider richControl(root+"/assets/font.ttf",root+"/assets/icudtl.dat",ledger,1);
        for(size_t i=0;i<richCopied.size();++i){const auto& input=richCopied[i];auto resource=std::make_shared<Node>(ledger);resource->id={1,1};resource->kind=wire::kinds::paragraph;
          resource->text=std::make_shared<TextData>(ledger,Reader{reinterpret_cast<const uint8_t*>(input.value.text.data()),input.value.text.size()});resource->fontSize=input.value.fontSize;resource->color=input.value.color;resource->textDirection=input.value.direction;
          resource->paragraph=std::make_shared<ParagraphData>(ledger,input.value.options);
          const auto measure=content.measure({200+i,resource,input.width,true,200+i});
          if(std::abs(measure.width-input.width)>1e-5||std::abs(measure.height-input.height)>1e-5||std::abs(measure.baseline-input.baseline)>1e-5)throw std::runtime_error("Native rich App/Content geometry differs");
          resource->properties.width=resource->contentWidth=measure.width;resource->properties.height=resource->contentHeight=measure.height;resource->baseline=measure.baseline;
          auto richDocument=std::make_shared<Document>(ledger);richDocument->nodes[1].value=resource;richDocument->count=richDocument->highWater=1;
          Preparation richPreparation;richPreparation.document=richDocument;richPreparation.id=200+i;richPreparation.metrics={1,1,256,256,1};
          auto richPrepared=content.prepare(richPreparation);auto richSurface=SkSurfaces::Raster(SkImageInfo::MakeN32Premul(256,256));if(!richSurface)throw std::runtime_error("Native rich raster unavailable");
          richSurface->getCanvas()->clear(SK_ColorWHITE);richSurface->getCanvas()->translate(24,24);richSurface->getCanvas()->drawPicture(richPrepared->pictures.at(resource->id.key()));SkPixmap richPixels;
          if(!richSurface->peekPixels(&richPixels))throw std::runtime_error("Native rich pixels unavailable");
          auto control=richControl.build(input.value.text,input.value.fontSize,input.value.color,input.value.direction,&input.value.options,input.width);
          auto controlSurface=SkSurfaces::Raster(SkImageInfo::MakeN32Premul(256,256));if(!controlSurface)throw std::runtime_error("Native rich reference unavailable");
          controlSurface->getCanvas()->clear(SK_ColorWHITE);control->paint(controlSurface->getCanvas(),24,24);SkPixmap controlPixels;
          if(!controlSurface->peekPixels(&controlPixels))throw std::runtime_error("Native rich reference pixels unavailable");
          for(int y=0;y<256;++y)for(int x=0;x<256;++x){richDiff+=richPixels.getColor(x,y)!=controlPixels.getColor(x,y);
            if((x>=24+input.width||y>=24+input.height)&&richPixels.getColor(x,y)==0xffcc5500u)++shadowOutside;}
          for(const uint32_t color:{0xffdd3300u,0xff2255ccu,0xffffee99u,0xff009966u,0xff882277u}){uint64_t count=0;
            for(int y=0;y<256;++y)for(int x=0;x<256;++x)if(richPixels.getColor(x,y)==color)++count;
            if(count<10)throw std::runtime_error("Native rich text lost a run color/background/decoration");richInk+=count;
          }
        }
        if(richDiff||!shadowOutside)throw std::runtime_error("Native rich Picture clips a shadow or differs from direct SkParagraph paint");
        uint64_t extraDiff=0,extraSlots=0,extraInk=0;
        for(size_t i=0;i<extraCopied.size();++i){const auto& input=extraCopied[i];auto resource=std::make_shared<Node>(ledger);resource->id={1,1};resource->kind=wire::kinds::paragraph;
          resource->text=std::make_shared<TextData>(ledger,Reader{reinterpret_cast<const uint8_t*>(input.value.text.data()),input.value.text.size()});resource->fontSize=input.value.fontSize;resource->color=input.value.color;resource->textDirection=input.value.direction;resource->paragraph=std::make_shared<ParagraphData>(ledger,input.value.options);
          const auto measure=content.measure({300+i,resource,input.width,true,300+i});
          if(std::abs(measure.width-input.width)>1e-5||std::abs(measure.height-input.height)>1e-5||std::abs(measure.baseline-input.baseline)>1e-5)throw std::runtime_error("Native strut/placeholder App and Content geometry differs");
          resource->properties.width=resource->contentWidth=measure.width;resource->properties.height=resource->contentHeight=measure.height;resource->baseline=measure.baseline;
          auto extraDocument=std::make_shared<Document>(ledger);extraDocument->nodes[1].value=resource;extraDocument->count=extraDocument->highWater=1;
          Preparation extraPreparation;extraPreparation.document=extraDocument;extraPreparation.id=300+i;extraPreparation.metrics={1,1,384,384,1};auto extraPrepared=content.prepare(extraPreparation);
          auto control=richControl.build(input.value.text,input.value.fontSize,input.value.color,input.value.direction,&input.value.options,input.width);const auto boxes=control->getRectsForPlaceholders();
          if(boxes.size()!=input.boxes.size()||boxes.size()!=6)throw std::runtime_error("Native placeholder box count differs");
          for(size_t j=0;j<boxes.size();++j){const auto& a=boxes[j].rect;const auto& b=input.boxes[j];if(std::abs(a.x()-b.x)>1e-4||std::abs(a.y()-b.y)>1e-4||std::abs(a.width()-b.width)>1e-4||std::abs(a.height()-b.height)>1e-4)throw std::runtime_error("Native App placeholder box geometry differs");}extraSlots+=boxes.size();
          auto slotActual=SkSurfaces::Raster(SkImageInfo::MakeN32Premul(384,384)),slotExpected=SkSurfaces::Raster(SkImageInfo::MakeN32Premul(384,384));if(!slotActual||!slotExpected)throw std::runtime_error("Native strut raster unavailable");
          slotActual->getCanvas()->clear(SK_ColorWHITE);slotActual->getCanvas()->translate(64,64);slotActual->getCanvas()->drawPicture(extraPrepared->pictures.at(resource->id.key()));slotExpected->getCanvas()->clear(SK_ColorWHITE);control->paint(slotExpected->getCanvas(),64,64);SkPixmap slotActualPixels,slotExpectedPixels;
          if(!slotActual->peekPixels(&slotActualPixels)||!slotExpected->peekPixels(&slotExpectedPixels))throw std::runtime_error("Native strut pixels unavailable");
          for(int y=0;y<384;++y)for(int x=0;x<384;++x){extraDiff+=slotActualPixels.getColor(x,y)!=slotExpectedPixels.getColor(x,y);extraInk+=slotActualPixels.getColor(x,y)!=SK_ColorWHITE;}
        }
        if(extraDiff||!extraInk)throw std::runtime_error("Native strut Picture clips compressed line ink or placeholder text");
        const auto inlineText=nativeInlineText(root,ledger);
        return std::array<uint64_t,30>{content.measurements,content.paragraphLayouts,content.paragraphs,ink,document->get(node->id).resolvedPaint->entries.size(),pathInk,alpha,liveWork,livePaints,liveInk,orderedWork,orderedCounts.paragraphs,orderedCounts.foreground,orderedDiff,orderedInk,richCopied.size(),richInk,richDiff,shadowOutside,extraCopied.size(),extraDiff,extraSlots,extraInk,inlineText[0],inlineText[1],inlineText[2],inlineText[3],inlineText[4],inlineText[5],inlineText[6]};
      }).get();
      const auto fontCounters=std::async(std::launch::async,[ledger,root=std::string(argv[2])]{return nativeFontText(root,ledger);}).get();
      jsi::Object nativeFonts(rt);const std::array<const char*,8> fontNames{"measurements","layouts","coreWork","fontLoads","reusedParagraphs","pixelDiff","inkPixels","retainedInk"};
      for(size_t i=0;i<fontNames.size();++i)nativeFonts.setProperty(rt,fontNames[i],double(fontCounters[i]));result.setProperty(rt,"nativeFonts",std::move(nativeFonts));
      jsi::Object content(rt);content.setProperty(rt,"measurements",double(counters[0]));content.setProperty(rt,"layouts",double(counters[1]));
      content.setProperty(rt,"paragraphs",double(counters[2]));content.setProperty(rt,"inkPixels",double(counters[3]));result.setProperty(rt,"nativeContent",std::move(content));
      auto nativeContent=result.getPropertyAsObject(rt,"nativeContent");nativeContent.setProperty(rt,"pathPaints",double(counters[4]));nativeContent.setProperty(rt,"pathInkPixels",double(counters[5]));nativeContent.setProperty(rt,"pathColor",double(counters[6]));
      nativeContent.setProperty(rt,"livePaintWork",double(counters[7]));nativeContent.setProperty(rt,"livePaints",double(counters[8]));nativeContent.setProperty(rt,"liveInkPixels",double(counters[9]));
      nativeContent.setProperty(rt,"orderedWork",double(counters[10]));nativeContent.setProperty(rt,"orderedParagraphs",double(counters[11]));nativeContent.setProperty(rt,"foregroundPaints",double(counters[12]));nativeContent.setProperty(rt,"orderedPixelDiff",double(counters[13]));nativeContent.setProperty(rt,"orderedInkPixels",double(counters[14]));
      nativeContent.setProperty(rt,"richParagraphs",double(counters[15]));nativeContent.setProperty(rt,"richInkPixels",double(counters[16]));
      nativeContent.setProperty(rt,"richPixelDiff",double(counters[17]));nativeContent.setProperty(rt,"shadowOutsidePixels",double(counters[18]));
      nativeContent.setProperty(rt,"extraParagraphs",double(counters[19]));nativeContent.setProperty(rt,"extraPixelDiff",double(counters[20]));nativeContent.setProperty(rt,"placeholderBoxes",double(counters[21]));nativeContent.setProperty(rt,"extraInkPixels",double(counters[22]));
      jsi::Object inlineText(rt);const std::array<const char*,7> inlineNames{"measurements","layouts","coreWork","placeholderBoxes","hiddenChildren","pixelDiff","inkPixels"};
      for(size_t i=0;i<inlineNames.size();++i)inlineText.setProperty(rt,inlineNames[i],double(counters[23+i]));result.setProperty(rt,"nativeInline",std::move(inlineText));
      std::cout<<json.getPropertyAsFunction(rt,"stringify").call(rt,result).asString(rt).utf8(rt)<<std::endl;
      const auto first=service.open(),second=service.open();nw::AppTextInput input;input.text="owner";input.width=100;
      if(first!=5)throw std::runtime_error("Missing capability consumed a native App owner");
      {
        nw::AppParagraphs kinds(std::string(argv[2])+"/assets/font.ttf",std::string(argv[2])+"/assets/icudtl.dat",ledger);
        const auto owner=kinds.open(),fontCredit=kinds.reserveFontBytes(owner,65536),assetCredit=kinds.reserveAssetBytes(owner,0),buffer=kinds.createBuffer(owner,{nullptr,0});
        bool badFont=false,badAsset=false;
        try{kinds.releaseFontBytes(owner,assetCredit);}catch(const std::exception&){badFont=true;}
        try{kinds.finishAssetLoad(owner,fontCredit,false);}catch(const std::exception&){badAsset=true;}
        bool badBuffer=false;try{kinds.releaseBuffer(owner,assetCredit);}catch(const std::exception&){badBuffer=true;}
        bool badBufferCredit=false;try{kinds.finishAssetLoad(owner,buffer,false);}catch(const std::exception&){badBufferCredit=true;}
        if(fontCredit==assetCredit||!badFont||!badAsset||kinds.snapshot(owner).fontBuffers.size()!=1||kinds.snapshot(owner).assets.size()!=1)
          throw std::runtime_error("A wrong-kind buffer credit was accepted");
        if(!badBuffer||!badBufferCredit||kinds.snapshot(owner).buffers.size()!=1)throw std::runtime_error("Wrong-kind immutable buffer was accepted");
        kinds.releaseFontBytes(owner,fontCredit);kinds.finishAssetLoad(owner,assetCredit,false);kinds.releaseBuffer(owner,buffer);kinds.close(owner);
      }
      {
        nw::AppParagraphs bundled(std::string(argv[2])+"/assets/font.ttf",std::string(argv[2])+"/assets/icudtl.dat",ledger,std::string(argv[2])+"/assets",true);
        const auto owner=bundled.open(),size=bundled.assetSize(owner,"image"),credit=bundled.reserveAssetBytes(owner,size);
        const auto bytes=bundled.readAsset(owner,credit,"image");
        if(bytes.size()!=size||bytes.size()<12||std::string(bytes.begin(),bytes.begin()+4)!="RIFF")throw std::runtime_error("Built-in Native asset alias failed");
        bundled.finishAssetLoad(owner,credit,true);bundled.close(owner);
        if(!bundled.reservedBytes())throw std::runtime_error("Built-in caller bytes lost their realm credit");
      }
      const auto assetFirst=service.reserveAssetBytes(first,0),assetSecond=service.reserveAssetBytes(second,0);
      const auto bufferFirst=service.createBuffer(first,{nullptr,0}),bufferSecond=service.createBuffer(second,{nullptr,0});
      bool foreignBufferFirst=false,foreignBufferSecond=false;
      try{service.releaseBuffer(first,bufferSecond);}catch(const std::exception&){foreignBufferFirst=true;}
      try{service.retainBuffer(second,bufferFirst);}catch(const std::exception&){foreignBufferSecond=true;}
      if(!foreignBufferFirst||!foreignBufferSecond||service.snapshot(first).buffers.size()!=1||service.snapshot(second).buffers.size()!=1)throw std::runtime_error("Foreign immutable buffer accepted");
      service.releaseBuffer(first,bufferFirst);service.releaseBuffer(second,bufferSecond);
      {
        const std::array<uint8_t,3> bytes{1,2,3};const auto handle=service.createBuffer(first,{bytes.data(),bytes.size()});
        const auto borrowed=service.bufferChunk(first,handle,0,3);service.releaseBuffer(first,handle);
        if(service.bufferCreditBytes(service.snapshot(first))!=65542||service.bufferDataBytes(service.snapshot(first))!=3||borrowed.bytes.data[1]!=2)
          throw std::runtime_error("A temporary immutable read lost its allocation/credit");
        bool closed=false,denied=false,allocated=false;
        try{service.close(first);}catch(const std::exception&){closed=true;}
        try{service.makeBuffer(first,wire::limits::resourceBytes,[&]{allocated=true;return SkData::MakeEmpty();});}catch(const std::exception&){denied=true;}
        if(!closed||!denied||allocated)throw std::runtime_error("An in-flight immutable read escaped close/data admission");
      }
      if(service.bufferCreditBytes(service.snapshot(first))||service.bufferDataBytes(service.snapshot(first)))throw std::runtime_error("Temporary immutable read credit did not retire");
      bool foreignAssetFirst=false,foreignAssetSecond=false;
      try{service.finishAssetLoad(first,assetSecond,false);}catch(const std::exception&){foreignAssetFirst=true;}
      try{service.finishAssetLoad(second,assetFirst,false);}catch(const std::exception&){foreignAssetSecond=true;}
      if(!foreignAssetFirst||!foreignAssetSecond||service.snapshot(first).assets.size()!=1||service.snapshot(second).assets.size()!=1)
        throw std::runtime_error("Foreign native asset credit was released");
      service.finishAssetLoad(first,assetFirst,false);service.finishAssetLoad(second,assetSecond,false);
      const auto firstCredit=service.reserveFontBytes(first,65536),secondCredit=service.reserveFontBytes(second,65536);
      bool foreignFirst=false,foreignSecond=false;
      try{service.releaseFontBytes(first,secondCredit);}catch(const std::exception&){foreignFirst=true;}
      try{service.releaseFontBytes(second,firstCredit);}catch(const std::exception&){foreignSecond=true;}
      if(!foreignFirst||!foreignSecond||service.snapshot(first).fontBuffers.size()!=1||service.snapshot(second).fontBuffers.size()!=1)
        throw std::runtime_error("Foreign native font buffer credit was released");
      service.releaseFontBytes(first,firstCredit);service.releaseFontBytes(second,secondCredit);
      std::vector<uint8_t> fontCatalog(56);const auto store=[&](size_t offset,uint32_t value){for(size_t i=0;i<4;++i)fontCatalog[offset+i]=uint8_t(value>>(8*i));};
      store(0,0x31544e46);store(4,1);store(12,1);store(16,56);store(32,12);std::copy_n("NelyxDefault",12,fontCatalog.begin()+40);
      const auto fontStage=service.prepareFonts(first,{fontCatalog.data(),fontCatalog.size()});bool foreignStageRejected=false;
      try{service.activateFonts(second,fontStage);}catch(const std::exception&){foreignStageRejected=true;}
      if(!foreignStageRejected||service.snapshot(first).fontRevision!=1)throw std::runtime_error("Foreign App font stage changed an owner");
      service.finishFonts(first,fontStage,false);
      const auto handle=service.layout(first,input);bool rejected=false;
      try{service.query(second,handle);}catch(const std::exception&){rejected=true;}
      if(!rejected)throw std::runtime_error("Foreign native App owner accepted");
      service.release(first,handle);service.close(first);service.close(second);
      uint64_t retained=0;for(const auto& [token,asset]:service.snapshot(3).assets)retained+=asset.memory->bytes;
      if(!retained||service.reservedBytes()!=retained)throw std::runtime_error("Native delivered asset credit did not follow the runtime lifetime");
    }
    if(ledger->snapshot().total)throw std::runtime_error("Native query ledger did not drain");
    return 0;
  }catch(const std::exception& error){std::cerr<<error.what()<<std::endl;return 1;}
}
