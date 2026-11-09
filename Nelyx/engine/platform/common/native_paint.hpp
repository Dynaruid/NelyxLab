// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "graphics.hpp"
#include "include/utils/SkShadowUtils.h"
#include "include/effects/SkGradient.h"
#include <functional>
namespace nelyx::v2::native {
struct NativePaintCounts {uint64_t paragraphs=0,foreground=0;};
inline const NativePaintEntry* nativeLinearMask(const NativePaint* paint) {
  return paint&&!paint->entries.empty()&&paint->entries.back().kind==wire::nativePaintKinds::linearMask?&paint->entries.back():nullptr;
}
inline SkRect nativeMaskBounds(const NativePaintEntry& e) {
  return SkRect::MakeXYWH(float(e.transform.tx),float(e.transform.ty),float(e.width),float(e.height));
}
// The mask clips before saveLayer. Only its rounded device clip can allocate
// backing; reserve a pixel fringe rather than another entire window surface.
inline uint64_t nativeMaskLayerBytes(const DrawItem& item,double scale,uint32_t width,uint32_t height) {
  const auto mask=nativeLinearMask(item.paint.get());if(!mask||item.opacity<=0||!item.world.inverse())return 0;
  const auto& m=item.world;
  const auto device=SkMatrix::MakeAll(float(m.a*scale),float(m.c*scale),float(m.tx*scale),float(m.b*scale),float(m.d*scale),float(m.ty*scale),0,0,1).mapRect(nativeMaskBounds(*mask));
  const auto clip=intersect({device.x(),device.y(),device.width(),device.height()},{0,0,double(width),double(height)});
  if(clip.width<=0||clip.height<=0)return 0;
  const double left=std::max(0.0,std::floor(clip.x)-1),top=std::max(0.0,std::floor(clip.y)-1),
    right=std::min(double(width),std::ceil(clip.x+clip.width)+1),bottom=std::min(double(height),std::ceil(clip.y+clip.height)+1);
  return uint64_t(right-left)*uint64_t(bottom-top)*4;
}
inline void paintNativeMask(SkCanvas* canvas,const NativePaintEntry& e) {
  const SkPoint points[2]{{float(e.gradient[0]),float(e.gradient[1])},{float(e.gradient[2]),float(e.gradient[3])}};
  const SkColor4f colors[2]{{1,1,1,1},{1,1,1,0}};
  const SkGradient gradient{SkGradient::Colors{{colors,2},SkTileMode::kClamp},SkGradient::Interpolation{}};
  auto shader=SkShaders::LinearGradient(points,gradient);
  if(!shader)throw std::runtime_error("Native linear mask shader unavailable");
  SkPaint paint;paint.setBlendMode(SkBlendMode::kModulate);paint.setShader(std::move(shader));
  SkAutoCanvasRestore restore(canvas,true);canvas->translate(float(e.transform.tx),float(e.transform.ty));
  canvas->drawRect(SkRect::MakeWH(float(e.width),float(e.height)),paint);
}
inline double nativePaintOutset(const NativePaintEntry& e,double width,double height,double scale=1) {
  if(e.kind==wire::nativePaintKinds::hitRegion||e.kind==wire::nativePaintKinds::clip||e.kind==wire::nativePaintKinds::save||e.kind==wire::nativePaintKinds::restore||e.kind==wire::nativePaintKinds::children||e.kind==wire::nativePaintKinds::linearMask)return 0;
  if(e.kind==wire::nativePaintKinds::path){auto bounds=e.pathBounds;const double padding=2*(e.strokeWidth==0&&(e.strokeColor>>24)?1/std::max(.125,scale):e.strokeWidth);
    bounds={bounds.x-padding,bounds.y-padding,bounds.width+2*padding,bounds.height+2*padding};bounds=e.transform.bounds(bounds);
    return std::max({0.0,-bounds.x,-bounds.y,bounds.x+bounds.width-width,bounds.y+bounds.height-height});}
  const bool circle=e.kind==7||e.kind==4||(e.kind==3&&(e.flags&4u));
  const double stroke=e.kind==wire::nativePaintKinds::border&&e.strokeWidth==0&&(e.strokeColor>>24)?1/std::max(.125,scale):e.strokeWidth;
  const double padding=stroke*(1+std::abs(e.strokeAlign))/2+(e.kind==9?4*e.blurSigma:e.kind==12?4*scale*e.elevation+2:0);
  const Rect local=circle?Rect{e.cx-e.resolvedRadius-padding,e.cy-e.resolvedRadius-padding,2*(e.resolvedRadius+padding),2*(e.resolvedRadius+padding)}:
    Rect{-padding,-padding,e.width+2*padding,e.height+2*padding};
  const auto bounds=e.transform.bounds(local);
  return std::max({0.0,-bounds.x,-bounds.y,bounds.x+bounds.width-width,bounds.y+bounds.height-height});
}
inline SkRRect nativePaintShape(const NativePaintEntry& e,double delta=0) {
  auto rect=SkRect::MakeWH(float(e.width),float(e.height));
  if(e.shape==2){const float d=float(std::min(e.width,e.height));rect=SkRect::MakeXYWH((float(e.width)-d)/2,(float(e.height)-d)/2,d,d);}
  rect.outset(float(delta),float(delta));
  SkVector radii[4];for(size_t i=0;i<4;++i)radii[i]={float(std::max(0.0,e.radii[i*2]+delta)),float(std::max(0.0,e.radii[i*2+1]+delta))};
  SkRRect result;result.setRectRadii(rect,radii);return result;
}
inline SkPath nativePaintPath(const NativePaint& paint,const NativePaintEntry& entry) {
  SkPathBuilder builder;builder.setFillType(entry.pathFillRule?SkPathFillType::kEvenOdd:SkPathFillType::kWinding);
  for(size_t i=0;i<entry.pathCount;++i){const auto& command=paint.paths.at(entry.pathStart+i);const auto& v=command.values;
    switch(command.verb){
      case 1:builder.moveTo(float(v[0]),float(v[1]));break;case 2:builder.lineTo(float(v[0]),float(v[1]));break;
      case 3:builder.quadTo(float(v[0]),float(v[1]),float(v[2]),float(v[3]));break;
      case 4:builder.cubicTo(float(v[0]),float(v[1]),float(v[2]),float(v[3]),float(v[4]),float(v[5]));break;
      case 5:builder.close();break;
      case 6:builder.conicTo(float(v[0]),float(v[1]),float(v[2]),float(v[3]),float(v[4]));break;
      case 7:builder.addRect(SkRect::MakeXYWH(float(v[0]),float(v[1]),float(v[2]),float(v[3])));break;
      case 8:{SkVector radii[4];for(size_t j=0;j<4;++j)radii[j]={float(v[4+j*2]),float(v[5+j*2])};SkRRect rect;
        rect.setRectRadii(SkRect::MakeXYWH(float(v[0]),float(v[1]),float(v[2]),float(v[3])),radii);builder.addRRect(rect);break;}
      case wire::nativePaintPathVerbs::arc:builder.arcTo(SkRect::MakeXYWH(float(v[0]),float(v[1]),float(v[2]),float(v[3])),
        float(v[4]*180/3.141592653589793),float(v[5]*180/3.141592653589793),v[6]!=0);break;
    }
  }return builder.detach();
}
inline void paintNativeShadow(SkCanvas* canvas,const Node& node,const SkPath* path,double scale) {
  const auto e=node.physicalPaint();if(!e||!path||e->elevation<=0||!(e->shadowColor>>24))return;
  SkColor ambient,spot;const auto alpha=SkColorGetA(e->shadowColor);
  SkShadowUtils::ComputeTonalColors(SkColorSetA(e->shadowColor,uint8_t(0.039f*alpha)),SkColorSetA(e->shadowColor,uint8_t(0.25f*alpha)),&ambient,&spot);
  SkShadowUtils::DrawShadow(canvas,*path,SkPoint3::Make(0,0,float(scale*e->elevation)),SkPoint3::Make(0,-1,1),800.f/600.f,
    ambient,spot,4u|((e->color>>24)!=255?1u:0u));
}
inline void paintNative(SkCanvas* canvas,const Node& node,const NativePaint& sequence,SkPaint& paint,double scale=1,bool foreground=false,
    const std::function<void(Handle)>& paragraph={},NativePaintCounts* counts=nullptr) {
  const auto boundary=std::find_if(sequence.entries.begin(),sequence.entries.end(),[](const auto& e){return e.kind==wire::nativePaintKinds::children;});
  if(foreground&&boundary==sequence.entries.end())return;
  const auto begin=foreground?boundary+1:sequence.entries.begin(),end=foreground?sequence.entries.end():boundary;
  if(begin==end)return;
  if(foreground&&counts)++counts->foreground;
  const bool ink=std::any_of(begin,end,[](const auto& e){return e.kind==3||e.kind==4;});
  SkAutoCanvasRestore restore(canvas,true);if(ink)canvas->clipRect(SkRect::MakeWH(float(node.properties.width),float(node.properties.height)));
  for(auto at=begin;at!=end;++at){const auto& e=*at;
    if(e.kind==wire::nativePaintKinds::hitRegion||e.kind==wire::nativePaintKinds::linearMask)continue;
    if(e.kind==wire::nativePaintKinds::save){canvas->save();continue;}
    if(e.kind==wire::nativePaintKinds::restore){canvas->restore();continue;}
    if(e.kind==10){auto shape=nativePaintShape(e);shape.offset(float(e.transform.tx),float(e.transform.ty));canvas->clipRRect(shape,e.clip!=wire::clipBehaviors::hardEdge);continue;}
    canvas->save();
    const auto& m=e.transform;canvas->concat(SkMatrix::MakeAll(float(m.a),float(m.c),float(m.tx),float(m.b),float(m.d),float(m.ty),0,0,1));
    paint.setColor(e.color);paint.setStyle(SkPaint::kFill_Style);
    paint.setBlendMode(e.flags&wire::nativePaintBlendFlags::srcATop?SkBlendMode::kSrcATop:SkBlendMode::kSrcOver);
    if(e.kind==wire::nativePaintKinds::paragraph){
      if(!paragraph)throw std::runtime_error("Native prepared paragraph resolver unavailable");paragraph(e.reference);if(counts)++counts->paragraphs;
    }else if(e.kind==wire::nativePaintKinds::path){const auto path=nativePaintPath(sequence,e);SkPaint pathPaint;pathPaint.setAntiAlias(true);pathPaint.setBlendMode(paint.getBlendMode_or(SkBlendMode::kSrcOver));
      if(e.color>>24){pathPaint.setColor(e.color);canvas->drawPath(path,pathPaint);}
      if(e.strokeColor>>24){pathPaint.setColor(e.strokeColor);pathPaint.setStyle(SkPaint::kStroke_Style);pathPaint.setStrokeWidth(float(e.strokeWidth));
        pathPaint.setStrokeCap(e.strokeCap==wire::nativePaintStrokeCaps::round?SkPaint::kRound_Cap:e.strokeCap==wire::nativePaintStrokeCaps::square?SkPaint::kSquare_Cap:SkPaint::kButt_Cap);canvas->drawPath(path,pathPaint);}
    }else if(e.kind==2){if(e.strokeColor>>24){
      paint.setColor(e.strokeColor);paint.setStrokeWidth(float(e.strokeWidth));paint.setStyle(SkPaint::kStroke_Style);
      canvas->drawRRect(nativePaintShape(e,e.strokeWidth*e.strokeAlign/2),paint);paint.setStyle(SkPaint::kFill_Style);
    }}else if(e.kind==1)canvas->drawRRect(nativePaintShape(e),paint);
    else if(e.kind==5||e.kind==8){canvas->drawRRect(nativePaintShape(e),paint);
      if(e.strokeWidth>0&&(e.strokeColor>>24)){paint.setColor(e.strokeColor);paint.setStrokeWidth(float(e.strokeWidth));paint.setStyle(SkPaint::kStroke_Style);
        canvas->drawRRect(nativePaintShape(e,e.strokeWidth*e.strokeAlign/2),paint);paint.setStyle(SkPaint::kFill_Style);}
    }else if(e.kind==12){if(e.elevation>0&&(e.color>>24)){
      SkPathBuilder builder;builder.addRRect(nativePaintShape(e));const auto path=builder.detach();
      SkColor ambient,spot;const auto alpha=SkColorGetA(e.color);
      SkShadowUtils::ComputeTonalColors(SkColorSetA(e.color,uint8_t(0.039f*alpha)),SkColorSetA(e.color,uint8_t(0.25f*alpha)),&ambient,&spot);
      SkShadowUtils::DrawShadow(canvas,path,SkPoint3::Make(0,0,float(scale*e.elevation)),SkPoint3::Make(0,-1,1),800.f/600.f,ambient,spot,4u|((e.flags&64u)?1u:0u));
    }}else if(e.kind==9){if(e.blurSigma>0)paint.setMaskFilter(SkMaskFilter::MakeBlur(kNormal_SkBlurStyle,float(e.blurSigma)));
      canvas->drawRRect(nativePaintShape(e),paint);paint.setMaskFilter(nullptr);
    }else if(e.kind==6){SkPathBuilder path;path.moveTo(float(e.radii[0]),float(e.radii[1]));
      for(size_t i=1;i<size_t(e.radii[6]);++i)path.lineTo(float(e.radii[i*2]),float(e.radii[i*2+1]));
      paint.setStyle(SkPaint::kStroke_Style);paint.setStrokeWidth(float(e.strokeWidth));canvas->drawPath(path.detach(),paint);paint.setStyle(SkPaint::kFill_Style);
    }else if(e.kind==7){canvas->drawCircle(float(e.cx),float(e.cy),float(e.resolvedRadius),paint);
      if(e.strokeWidth>0&&(e.strokeColor>>24)){paint.setColor(e.strokeColor);paint.setStrokeWidth(float(e.strokeWidth));paint.setStyle(SkPaint::kStroke_Style);
        canvas->drawCircle(float(e.cx),float(e.cy),float(std::max(0.0,e.resolvedRadius+e.strokeWidth*e.strokeAlign/2)),paint);paint.setStyle(SkPaint::kFill_Style);}
    }
    else {if((e.kind==3&&bool(e.flags&8u))||(e.kind==4&&bool(e.flags&1u)))canvas->clipRRect(nativePaintShape(e),true);
      if(e.kind==4||(e.flags&4u))canvas->drawCircle(float(e.cx),float(e.cy),float(e.resolvedRadius),paint);
      else canvas->drawRRect(nativePaintShape(e),paint);
    }
    canvas->restore();
  }
  paint.setBlendMode(SkBlendMode::kSrcOver);
}
inline void paintNative(SkCanvas* canvas,const Node& node,SkPaint& paint,double scale=1) {
  if(node.resolvedPaint)paintNative(canvas,node,*node.resolvedPaint,paint,scale);
}
inline void paintFrameNative(SkCanvas* canvas,const Node& node,const DrawItem& item,SkPaint& paint,double scale=1,bool foreground=false,
    const std::function<void(Handle)>& paragraph={},NativePaintCounts* counts=nullptr) {
  if(item.paint)paintNative(canvas,node,*item.paint,paint,scale,foreground,paragraph,counts);
}
}
