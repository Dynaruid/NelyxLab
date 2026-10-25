// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "JsiSkParagraph.h"
#include "JsiSkPicture.h"
#include "JsiSkImageFilter.h"
#include <array>
#include <cstring>
#include <limits>

namespace RNSkia {
// Validate the complete versioned packet and acquire every native handle before
// mutating the recording. No JS value or callback escapes this runtime call.
inline void replayDisplayList(jsi::Runtime& runtime,SkCanvas* canvas,const jsi::Value& bytes,const jsi::Value& table){
  const auto buffer=bytes.getObject(runtime).getArrayBuffer(runtime);const auto handles=table.getObject(runtime).getArray(runtime);
  const auto size=buffer.size(runtime),handleCount=handles.size(runtime);
  size_t at=0;auto reject=[&](){throw jsi::JSError(runtime,"Invalid native display-list1 packet/handle at word "+std::to_string(at));};
  if(!canvas||size<32||size>16*1024*1024||size%8||handleCount>65536)reject();
  // A copy prevents any subsequent handle getter from detaching or rewriting
  // the input ArrayBuffer while native validation is reading it.
  std::vector<double> data(size/8);std::memcpy(data.data(),buffer.data(runtime),size);
  if(data[0]!=0x4e4c444c||data[1]!=1||data[2]<0||data[2]>65536||data[2]!=std::floor(data[2])||data[3]!=handleCount)reject();
  auto ref=[&](double id){if(!std::isfinite(id)||id<0||id>=handleCount||id!=std::floor(id))reject();return handles.getValueAtIndex(runtime,size_t(id));};
  auto paint=[&](double id){return id==-1?std::shared_ptr<SkPaint>{}:JsiSkPaint::fromValue(runtime,ref(id));};
  const std::array<size_t,23> arity{0,0,1,1,2,2,2,5,3,3,2,3,1,16,4,6,6,5,1,3,3,5,9};
  std::vector<std::function<void()>> commands;commands.reserve(size_t(data[2]));at=4;int depth=0;
  for(size_t n=0;n<size_t(data[2]);++n){
    if(at+2>data.size())reject();auto raw=data[at++],count=data[at++];
    if(!std::isfinite(raw)||raw<0||raw>=arity.size()||raw!=std::floor(raw))reject();auto op=size_t(raw);
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
      case 4:case 5:{auto rect=JsiSkRect::fromValue(runtime,ref(p[0]));auto value=paint(p[1]);if(!value)reject();commands.emplace_back([canvas,rect,value,op]{if(op==4)canvas->drawRect(*rect,*value);else canvas->drawOval(*rect,*value);});break;}
      case 6:{auto rect=JsiSkRRect::fromValue(runtime,ref(p[0]));auto value=paint(p[1]);if(!value)reject();commands.emplace_back([canvas,rect,value]{canvas->drawRRect(*rect,*value);});break;}
      case 7:{auto value=paint(p[4]);if(!value)reject();std::array<float,4> v{float(p[0]),float(p[1]),float(p[2]),float(p[3])};commands.emplace_back([canvas,v,value]{canvas->drawLine(v[0],v[1],v[2],v[3],*value);});break;}
      case 8:{auto rect=JsiSkRect::fromValue(runtime,ref(p[0]));auto clip=SkClipOp(int(p[1]));bool aa=p[2]!=0;commands.emplace_back([canvas,rect,clip,aa]{canvas->clipRect(*rect,clip,aa);});break;}
      case 9:{auto rect=JsiSkRRect::fromValue(runtime,ref(p[0]));auto clip=SkClipOp(int(p[1]));bool aa=p[2]!=0;commands.emplace_back([canvas,rect,clip,aa]{canvas->clipRRect(*rect,clip,aa);});break;}
      case 10:case 11:{auto path=JsiSkPath::fromValue(runtime,ref(p[0]));if(op==10){auto value=paint(p[1]);if(!value)reject();commands.emplace_back([canvas,path,value]{canvas->drawPath(path->snapshot(),*value);});}else{auto clip=SkClipOp(int(p[1]));bool aa=p[2]!=0;commands.emplace_back([canvas,path,clip,aa]{canvas->clipPath(path->snapshot(),clip,aa);});}break;}
      case 12:{auto matrix=JsiSkMatrix::fromValue(runtime,ref(p[0]));commands.emplace_back([canvas,matrix]{canvas->concat(*matrix);});break;}
      case 13:{std::array<float,16> matrix{};for(size_t i=0;i<16;++i)matrix[i]=float(p[i]);commands.emplace_back([canvas,matrix]{nelyx::skia_core::concatMatrix4(*canvas,matrix);});break;}
      case 14:case 15:case 16:case 17:{
        auto image=JsiSkImage::fromValue(runtime,ref(p[0]));auto src=JsiSkRect::fromValue(runtime,ref(p[1])),dst=JsiSkRect::fromValue(runtime,ref(p[2]));auto value=paint(p[arity[op]-1]);SkSamplingOptions sampling;
        if(op==15){if(p[3]<0||p[3]>1||p[3]!=std::floor(p[3])||p[4]<0||p[4]>2||p[4]!=std::floor(p[4]))reject();sampling=SkSamplingOptions(SkFilterMode(int(p[3])),SkMipmapMode(int(p[4])));}
        else if(op==16)sampling=SkSamplingOptions(SkCubicResampler{float(p[3]),float(p[4])});
        else if(op==17&&p[3]!=0&&p[3]!=1)reject();auto filter=op==17?SkFilterMode(int(p[3])):SkFilterMode::kNearest;
        commands.emplace_back([canvas,image,src,dst,value,sampling,filter,op]{if(op==17)canvas->drawImageNine(image.get(),src->round(),*dst,filter,value.get());else canvas->drawImageRect(image.get(),*src,*dst,sampling,value.get(),SkCanvas::kStrict_SrcRectConstraint);});break;
      }
      case 18:{auto picture=JsiSkPicture::fromValue(runtime,ref(p[0]));commands.emplace_back([canvas,picture]{canvas->drawPicture(picture);});break;}
      case 19:{auto paragraph=JsiSkParagraph::fromValue(runtime,ref(p[0]))->getObject();auto x=float(p[1]),y=float(p[2]);commands.emplace_back([canvas,paragraph,x,y]{nelyx::skia_core::paintParagraph(*paragraph,*canvas,x,y);});break;}
      case 20:{auto value=paint(p[0]);auto bounds=p[1]==-1?std::shared_ptr<SkRect>{}:JsiSkRect::fromValue(runtime,ref(p[1]));auto backdrop=p[2]==-1?sk_sp<SkImageFilter>{}:JsiSkImageFilter::fromValue(runtime,ref(p[2]));commands.emplace_back([canvas,value,bounds,backdrop]{canvas->saveLayer(SkCanvas::SaveLayerRec(bounds.get(),value.get(),backdrop.get(),0));});break;}
      case 21:{auto path=JsiSkPath::fromValue(runtime,ref(p[0]));if(p[1]<0||p[1]>4294967295.||p[1]!=std::floor(p[1])||p[2]<0||(p[3]!=0&&p[3]!=1)||p[4]<=0)reject();auto color=SkColor(p[1]);auto elevation=float(p[2]),dpr=float(p[4]);bool transparent=p[3]!=0;commands.emplace_back([canvas,path,color,elevation,dpr,transparent]{nelyx::skia_core::drawShadow(*canvas,path->snapshot(),color,elevation,transparent,dpr);});break;}
      case 22:{if(p[0]<0||p[0]>2||p[0]!=std::floor(p[0])||p[3]<0||p[4]<0||p[5]<0||p[6]<0||p[7]<0||p[7]>4294967295.||p[7]!=std::floor(p[7])||(p[8]!=0&&p[8]!=1))reject();const auto shape=int(p[0]);const auto rect=SkRect::MakeXYWH(float(p[1]),float(p[2]),float(p[3]),float(p[4]));const auto rx=float(p[5]),ry=float(p[6]);SkPaint paint;paint.setColor(SkColor(p[7]));paint.setAntiAlias(p[8]!=0);commands.emplace_back([canvas,shape,rect,rx,ry,paint]{if(shape==0)canvas->drawRect(rect,paint);else if(shape==1)canvas->drawOval(rect,paint);else canvas->drawRRect(SkRRect::MakeRectXY(rect,rx,ry),paint);});break;}
    }
  }
  if(at!=data.size()||depth!=0)reject();
  for(auto& command:commands)command();
}
}
