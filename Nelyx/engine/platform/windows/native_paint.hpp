// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "graphics.hpp"
#include "include/utils/SkShadowUtils.h"
namespace nelyx::v2::windows {
inline double nativePaintOutset(const NativePaintEntry& e,double width,double height,double scale=1) {
  if(e.kind==wire::nativePaintKinds::hitRegion||e.kind==wire::nativePaintKinds::clip||e.kind>=wire::nativePaintKinds::save)return 0;
  const bool circle=e.kind==7||e.kind==4||(e.kind==3&&(e.flags&4u));
  const double padding=e.strokeWidth*(1+std::abs(e.strokeAlign))/2+(e.kind==9?4*e.blurSigma:e.kind==12?4*scale*e.elevation+2:0);
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
inline void paintNativeShadow(SkCanvas* canvas,const Node& node,const SkPath* path,double scale) {
  const auto e=node.physicalPaint();if(!e||!path||e->elevation<=0||!(e->shadowColor>>24))return;
  SkColor ambient,spot;const auto alpha=SkColorGetA(e->shadowColor);
  SkShadowUtils::ComputeTonalColors(SkColorSetA(e->shadowColor,uint8_t(0.039f*alpha)),SkColorSetA(e->shadowColor,uint8_t(0.25f*alpha)),&ambient,&spot);
  SkShadowUtils::DrawShadow(canvas,*path,SkPoint3::Make(0,0,float(scale*e->elevation)),SkPoint3::Make(0,-1,1),800.f/600.f,
    ambient,spot,4u|((e->color>>24)!=255?1u:0u));
}
inline void paintNative(SkCanvas* canvas,const Node& node,SkPaint& paint,double scale=1) {
  if(!node.resolvedPaint)return;
  const bool ink=std::any_of(node.resolvedPaint->entries.begin(),node.resolvedPaint->entries.end(),[](const auto& e){return e.kind==3||e.kind==4;});
  canvas->save();if(ink)canvas->clipRect(SkRect::MakeWH(float(node.properties.width),float(node.properties.height)));
  for(const auto& e:node.resolvedPaint->entries){
    if(e.kind==wire::nativePaintKinds::hitRegion)continue;
    if(e.kind==wire::nativePaintKinds::save){canvas->save();continue;}
    if(e.kind==wire::nativePaintKinds::restore){canvas->restore();continue;}
    if(e.kind==10){auto shape=nativePaintShape(e);shape.offset(float(e.transform.tx),float(e.transform.ty));canvas->clipRRect(shape,true);continue;}
    canvas->save();
    const auto& m=e.transform;canvas->concat(SkMatrix::MakeAll(float(m.a),float(m.c),float(m.tx),float(m.b),float(m.d),float(m.ty),0,0,1));
    paint.setColor(e.color);paint.setStyle(SkPaint::kFill_Style);
    if(e.kind==2){if(e.strokeWidth>0&&(e.strokeColor>>24)){
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
  canvas->restore();
}
}
