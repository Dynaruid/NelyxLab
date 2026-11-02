// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "JsiSkParagraph.h"
#include "JsiSkPicture.h"
#include "JsiSkImageFilter.h"
#include "nelyx_skia/scene_build.h"
#include <array>
#include <cstring>
#include <limits>

namespace RNSkia {
// Validate the complete versioned packet and acquire every native handle before
// mutating the recording. No JS value or callback escapes this runtime call.
inline void replayDisplayList(jsi::Runtime& runtime,SkCanvas* canvas,const jsi::Value& bytes,const jsi::Value& table,
    std::function<void()> ready = {},const RNSkPlatformContext* owner=nullptr){
  const auto buffer=bytes.getObject(runtime).getArrayBuffer(runtime);const auto handles=table.getObject(runtime).getArray(runtime);
  const auto size=buffer.size(runtime),handleCount=handles.size(runtime);
  size_t at=0;auto reject=[&](){throw jsi::JSError(runtime,"Invalid native display-list1 packet/handle at word "+std::to_string(at));};
  if(!canvas||size<32||size>16*1024*1024||size%8||handleCount>65536)reject();
  // A copy prevents any subsequent handle getter from detaching or rewriting
  // the input ArrayBuffer while native validation is reading it.
  std::vector<double> data(size/8);std::memcpy(data.data(),buffer.data(runtime),size);
  if(data[0]!=0x4e4c444c||(data[1]!=1&&data[1]!=2)||data[2]<0||data[2]>65536||data[2]!=std::floor(data[2])||data[3]!=handleCount)reject();
  const bool batch=data[1]==2;
  nelyx::scene_packet::Tables numeric;
  std::vector<SkPath> paths;std::vector<std::shared_ptr<SkPaint>> paints;
  if(batch){
    numeric=nelyx::scene_packet::readTables(data,handleCount);
    for(const auto& value:numeric.paths)paths.push_back(nelyx::scene_build::path(value));
    for(const auto& value:numeric.paints)paints.push_back(std::make_shared<SkPaint>(nelyx::scene_build::paint(value)));
  }
  auto ref=[&](double id){if(!std::isfinite(id)||id<0||id>=handleCount||id!=std::floor(id))reject();return handles.getValueAtIndex(runtime,size_t(id));};
  auto checkOwner=[&]<typename T>(const jsi::Value& value){if(batch&&owner){auto object=tryGetJsiObject<T>(runtime,value);if(!object||!object->nelyxOwnedBy(owner))reject();}};
  auto checked=[&]<typename T>(double id){auto value=ref(id);checkOwner.operator()<T>(value);return value;};
  auto rectangle=[&](double id){return JsiSkRect::fromValue(runtime,checked.operator()<JsiSkRect>(id));};
  auto rounded=[&](double id){
    auto value=ref(id);
    if(!batch)return JsiSkRRect::fromValue(runtime,value);
    if(auto native=tryGetJsiObject<JsiSkRRect>(runtime,value)){checkOwner.operator()<JsiSkRRect>(value);return JsiSkRRect::fromValue(runtime,value);}
    auto object=value.getObject(runtime);auto box=object.getProperty(runtime,"rect");checkOwner.operator()<JsiSkRect>(box);
    const auto rect=*JsiSkRect::fromValue(runtime,box);SkVector radii[4];const char* names[]{"topLeft","topRight","bottomRight","bottomLeft"};
    for(size_t i=0;i<4;++i){auto point=JsiSkPoint::fromValue(runtime,object.getProperty(runtime,names[i]));if(!std::isfinite(point->x())||!std::isfinite(point->y())||point->x()<0||point->y()<0)reject();radii[i]=*point;}
    auto result=std::make_shared<SkRRect>();result->setRectRadii(rect,radii);return result;
  };
  auto paint=[&](double id){
    if(batch&&id<=-2){auto index=nelyx::scene_packet::integer(-id-2,paints.size());if(index>=paints.size())reject();return paints[index];}
    if(id==-1)return std::shared_ptr<SkPaint>{};auto value=ref(id);checkOwner.operator()<JsiSkPaint>(value);return JsiSkPaint::fromValue(runtime,value);
  };
  auto path=[&](double id){
    if(batch&&id<=-2){auto index=nelyx::scene_packet::integer(-id-2,paths.size());if(index>=paths.size())reject();return paths[index];}
    auto value=ref(id);checkOwner.operator()<JsiSkPath>(value);return JsiSkPath::fromValue(runtime,value)->snapshot();
  };
  const std::array<size_t,27> arity{0,0,1,1,2,2,2,5,3,3,2,3,1,16,4,6,6,5,1,3,3,5,9,6,15,6,14};
  std::vector<std::function<void()>> commands;commands.reserve(size_t(data[2]));at=batch?numeric.commandOffset:4;int depth=0;
  for(size_t n=0;n<size_t(data[2]);++n){
    if(at+2>data.size())reject();auto raw=data[at++],count=data[at++];
    if(!std::isfinite(raw)||raw<0||raw>=(batch?arity.size():23)||raw!=std::floor(raw))reject();auto op=size_t(raw);
    if(count!=arity[op]||at+arity[op]>data.size())reject();auto p=data.data()+at;at+=arity[op];
    for(size_t i=0;i<arity[op];++i)if(!std::isfinite(p[i])||std::abs(p[i])>std::numeric_limits<float>::max())reject();
    if(op==0||op==20){if(++depth>4096)reject();}else if(op==1&&--depth<0)reject();
    if(op==8||op==9||op==11){if((p[1]!=0&&p[1]!=1)||(p[2]!=0&&p[2]!=1))reject();}
    switch(op){
      case 0:commands.emplace_back([canvas]{canvas->save();});break;
      case 1:commands.emplace_back([canvas]{canvas->restore();});break;
      case 2:{
        // Read channels through checked JSI indices. The legacy colour helper
        // reads four floats from a buffer without checking its byte length.
        auto value=ref(p[0]).getObject(runtime);auto length=value.getProperty(runtime,"length");if(!length.isNumber()||length.getNumber()!=4)reject();
        std::array<double,4> channels{};const char* names[]{"0","1","2","3"};for(size_t i=0;i<4;++i){auto channel=value.getProperty(runtime,names[i]);if(!channel.isNumber())reject();channels[i]=channel.getNumber();if(!std::isfinite(channels[i])||channels[i]<0||channels[i]>1)reject();}
        auto color=value.isArray(runtime)?SkColorSetARGB(channels[3]*255,channels[0]*255,channels[1]*255,channels[2]*255):SkColorSetARGB(float(channels[3])*255,float(channels[0])*255,float(channels[1])*255,float(channels[2])*255);
        commands.emplace_back([canvas,color]{canvas->clear(color);});break;
      }
      case 3:{auto value=paint(p[0]);if(!value)reject();commands.emplace_back([canvas,value]{canvas->drawPaint(*value);});break;}
      case 4:case 5:{auto rect=rectangle(p[0]);auto value=paint(p[1]);if(!value)reject();commands.emplace_back([canvas,rect,value,op]{if(op==4)canvas->drawRect(*rect,*value);else canvas->drawOval(*rect,*value);});break;}
      case 6:{auto rect=rounded(p[0]);auto value=paint(p[1]);if(!value)reject();commands.emplace_back([canvas,rect,value]{canvas->drawRRect(*rect,*value);});break;}
      case 7:{auto value=paint(p[4]);if(!value)reject();std::array<float,4> v{float(p[0]),float(p[1]),float(p[2]),float(p[3])};commands.emplace_back([canvas,v,value]{canvas->drawLine(v[0],v[1],v[2],v[3],*value);});break;}
      case 8:{auto rect=rectangle(p[0]);auto clip=SkClipOp(int(p[1]));bool aa=p[2]!=0;commands.emplace_back([canvas,rect,clip,aa]{canvas->clipRect(*rect,clip,aa);});break;}
      case 9:{auto rect=rounded(p[0]);auto clip=SkClipOp(int(p[1]));bool aa=p[2]!=0;commands.emplace_back([canvas,rect,clip,aa]{canvas->clipRRect(*rect,clip,aa);});break;}
      case 10:case 11:{if(!batch){auto legacy=JsiSkPath::fromValue(runtime,ref(p[0]));if(op==10){auto value=paint(p[1]);if(!value)reject();commands.emplace_back([canvas,legacy,value]{canvas->drawPath(legacy->snapshot(),*value);});}else{auto clip=SkClipOp(int(p[1]));bool aa=p[2]!=0;commands.emplace_back([canvas,legacy,clip,aa]{canvas->clipPath(legacy->snapshot(),clip,aa);});}break;}auto shape=path(p[0]);if(op==10){auto value=paint(p[1]);if(!value)reject();commands.emplace_back([canvas,shape,value]{canvas->drawPath(shape,*value);});}else{auto clip=SkClipOp(int(p[1]));bool aa=p[2]!=0;commands.emplace_back([canvas,shape,clip,aa]{canvas->clipPath(shape,clip,aa);});}break;}
      case 12:{auto matrix=JsiSkMatrix::fromValue(runtime,ref(p[0]));commands.emplace_back([canvas,matrix]{canvas->concat(*matrix);});break;}
      case 13:{std::array<float,16> matrix{};for(size_t i=0;i<16;++i)matrix[i]=float(p[i]);commands.emplace_back([canvas,matrix]{nelyx::skia_core::concatMatrix4(*canvas,matrix);});break;}
      case 14:case 15:case 16:case 17:{
        auto image=JsiSkImage::fromValue(runtime,checked.operator()<JsiSkImage>(p[0]));auto src=rectangle(p[1]),dst=rectangle(p[2]);auto value=paint(p[arity[op]-1]);SkSamplingOptions sampling;
        if(op==15){if(p[3]<0||p[3]>1||p[3]!=std::floor(p[3])||p[4]<0||p[4]>2||p[4]!=std::floor(p[4]))reject();sampling=SkSamplingOptions(SkFilterMode(int(p[3])),SkMipmapMode(int(p[4])));}
        else if(op==16)sampling=SkSamplingOptions(SkCubicResampler{float(p[3]),float(p[4])});
        else if(op==17&&p[3]!=0&&p[3]!=1)reject();auto filter=op==17?SkFilterMode(int(p[3])):SkFilterMode::kNearest;
        commands.emplace_back([canvas,image,src,dst,value,sampling,filter,op]{if(op==17)canvas->drawImageNine(image.get(),src->round(),*dst,filter,value.get());else canvas->drawImageRect(image.get(),*src,*dst,sampling,value.get(),SkCanvas::kStrict_SrcRectConstraint);});break;
      }
      case 18:{auto object=ref(p[0]);checkOwner.operator()<JsiSkPicture>(object);auto picture=JsiSkPicture::fromValue(runtime,object);commands.emplace_back([canvas,picture]{nelyx::skia_core::drawPicture(*canvas,picture);});break;}
      case 19:{auto object=ref(p[0]);checkOwner.operator()<JsiSkParagraph>(object);auto paragraph=JsiSkParagraph::fromValue(runtime,object)->getObject();auto x=float(p[1]),y=float(p[2]);commands.emplace_back([canvas,paragraph,x,y]{nelyx::skia_core::paintParagraph(*paragraph,*canvas,x,y);});break;}
      case 20:{auto value=paint(p[0]);auto bounds=p[1]==-1?std::shared_ptr<SkRect>{}:rectangle(p[1]);auto backdrop=p[2]==-1?sk_sp<SkImageFilter>{}:JsiSkImageFilter::fromValue(runtime,checked.operator()<JsiSkImageFilter>(p[2]));commands.emplace_back([canvas,value,bounds,backdrop]{canvas->saveLayer(SkCanvas::SaveLayerRec(bounds.get(),value.get(),backdrop.get(),0));});break;}
      case 21:{if(!batch){auto legacy=JsiSkPath::fromValue(runtime,ref(p[0]));if(p[1]<0||p[1]>4294967295.||p[1]!=std::floor(p[1])||p[2]<0||(p[3]!=0&&p[3]!=1)||p[4]<=0)reject();auto color=SkColor(p[1]);auto elevation=float(p[2]),dpr=float(p[4]);bool transparent=p[3]!=0;commands.emplace_back([canvas,legacy,color,elevation,dpr,transparent]{nelyx::skia_core::drawShadow(*canvas,legacy->snapshot(),color,elevation,transparent,dpr);});break;}auto shape=path(p[0]);if(p[1]<0||p[1]>4294967295.||p[1]!=std::floor(p[1])||p[2]<0||(p[3]!=0&&p[3]!=1)||p[4]<=0)reject();auto color=SkColor(p[1]);auto elevation=float(p[2]),dpr=float(p[4]);bool transparent=p[3]!=0;commands.emplace_back([canvas,shape,color,elevation,dpr,transparent]{nelyx::skia_core::drawShadow(*canvas,shape,color,elevation,transparent,dpr);});break;}
      case 22:{if(p[0]<0||p[0]>2||p[0]!=std::floor(p[0])||p[3]<0||p[4]<0||p[5]<0||p[6]<0||p[7]<0||p[7]>4294967295.||p[7]!=std::floor(p[7])||(p[8]!=0&&p[8]!=1))reject();const auto shape=int(p[0]);const auto rect=SkRect::MakeXYWH(float(p[1]),float(p[2]),float(p[3]),float(p[4]));const auto rx=float(p[5]),ry=float(p[6]);SkPaint paint;paint.setColor(SkColor(p[7]));paint.setAntiAlias(p[8]!=0);commands.emplace_back([canvas,shape,rect,rx,ry,paint]{if(shape==0)canvas->drawRect(rect,paint);else if(shape==1)canvas->drawOval(rect,paint);else canvas->drawRRect(SkRRect::MakeRectXY(rect,rx,ry),paint);});break;}
      case 23:{if((p[4]!=0&&p[4]!=1)||(p[5]!=0&&p[5]!=1))reject();auto rect=SkRect::MakeXYWH(float(p[0]),float(p[1]),float(p[2]),float(p[3]));auto clip=SkClipOp(int(p[4]));bool aa=p[5]!=0;commands.emplace_back([canvas,rect,clip,aa]{canvas->clipRect(rect,clip,aa);});break;}
      case 24:case 26:{if(p[0]!=0&&p[0]!=1)reject();auto rect=nelyx::scene_build::rounded(p+1,p[0]==0);if(op==24){if((p[13]!=0&&p[13]!=1)||(p[14]!=0&&p[14]!=1))reject();auto clip=SkClipOp(int(p[13]));bool aa=p[14]!=0;commands.emplace_back([canvas,rect,clip,aa]{canvas->clipRRect(rect,clip,aa);});}else{auto value=paint(p[13]);if(!value)reject();commands.emplace_back([canvas,rect,value]{canvas->drawRRect(rect,*value);});}break;}
      case 25:{if(p[0]!=0&&p[0]!=1)reject();auto rect=SkRect::MakeXYWH(float(p[1]),float(p[2]),float(p[3]),float(p[4]));auto value=paint(p[5]);if(!value)reject();bool oval=p[0]!=0;commands.emplace_back([canvas,rect,value,oval]{if(oval)canvas->drawOval(rect,*value);else canvas->drawRect(rect,*value);});break;}
    }
  }
  if(at!=data.size()||depth!=0)reject();
  if(ready)ready();
  for(auto& command:commands)command();
}
}
