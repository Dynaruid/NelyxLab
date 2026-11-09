// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "include/core/SkCanvas.h"
#include "include/core/SkPaint.h"
#include "include/core/SkPath.h"
#include "include/core/SkPoint3.h"
#include "include/core/SkRRect.h"
#include "include/utils/SkShadowUtils.h"
// Adapted from the existing Windows repair in skia/native/core/core.cpp.
// Resolve physical shadows at replay with the final transform and clip. The
// pinned tessellator is unstable both under translation and fractional elevation;
// use Skia's continuous blur shadow model for the whole animation.
#if defined(_WIN32) && defined(SK_GRAPHITE) && !defined(SK_ENABLE_OPTIMIZE_SIZE)
#include "include/core/SkBlurTypes.h"
#include "include/core/SkMaskFilter.h"
#include "include/utils/SkPaintFilterCanvas.h"
#include "src/core/SkBlurMask.h"
#include "src/core/SkCanvasPriv.h"
#include "src/core/SkDevice.h"
#include "src/core/SkDrawShadowInfo.h"
#include <cmath>
namespace nelyx::v2::native {
inline bool drawStableNativeShadow(SkCanvas& canvas,const SkPath& path,const SkDrawShadowRec& rec) {
  if(canvas.imageInfo().colorType()==kUnknown_SkColorType)return false;
  auto* device=SkCanvasPriv::TopDevice(&canvas);const auto matrix=device->localToDevice();
  if(matrix.hasPerspective()||!(rec.fFlags&SkShadowFlags::kDirectionalLight_ShadowFlag)||
     rec.fZPlaneParams.fX!=0||rec.fZPlaneParams.fY!=0||!rec.fZPlaneParams.isFinite()||
     !rec.fLightPos.isFinite()||!std::isfinite(rec.fLightRadius)||
     ((rec.fFlags&SkShadowFlags::kConcaveBlurOnly_ShadowFlag)&&!path.isConvex()))return false;
  // The pinned geometric tessellator changes its inner ring at fractional
  // elevations, even after centering and with occluder culling disabled.
  // Use Skia's blur fallback consistently instead of switching mesh topology
  // during an animation. Graphite implements rounded-rect mask blur natively.
  const auto devicePath=path.makeTransform(matrix);
  SkScalar spotRadius,spotScale;SkVector spotOffset;
  SkDrawShadowMetrics::GetDirectionalParams(rec.fZPlaneParams.fZ,rec.fLightPos.fX,rec.fLightPos.fY,
    rec.fLightPos.fZ,rec.fLightRadius,&spotRadius,&spotScale,&spotOffset);
  if(!devicePath.isFinite()||!std::isfinite(spotRadius)||spotRadius<0||!spotOffset.isFinite())return false;
  SkAutoCanvasRestore restore(&canvas,true);
  canvas.setMatrix(device->deviceToGlobal());
  const auto blur=[&](const SkPath& outline,SkColor color,SkScalar radius,SkScalar strokeWidth){
    if(!SkColorGetA(color))return;
    SkPaint paint;paint.setAntiAlias(true);paint.setColor(color);
    paint.setMaskFilter(SkMaskFilter::MakeBlur(kNormal_SkBlurStyle,SkBlurMask::ConvertRadiusToSigma(radius),false));
    SkRRect rounded;SkRect rect;
    const bool rrect=!outline.isInverseFillType()&&(outline.isRRect(&rounded)||(outline.isRect(&rect)&&(rounded.setRect(rect),true)));
    const auto radii=rounded.getSimpleRadii();
    // SkCanvas only attempts Graphite's analytic blur for filled primitives.
    // A circular-corner RRect's stroke-and-fill is exactly its outset; an
    // elliptical corner's offset is not another ellipse, so keep that path.
    if(rrect&&(strokeWidth<=0||rounded.isRect()||((rounded.isSimple()||rounded.isOval())&&radii.x()==radii.y()))){
      if(strokeWidth>0)rounded.outset(strokeWidth*.5f,strokeWidth*.5f);
      canvas.drawRRect(rounded,paint);return;
    }
    if(strokeWidth>0){paint.setStyle(SkPaint::kStrokeAndFill_Style);paint.setStrokeWidth(strokeWidth);}
    canvas.drawPath(outline,paint);
  };
  const auto ambientOutset=SkDrawShadowMetrics::AmbientBlurRadius(rec.fZPlaneParams.fZ);
  const auto ambientRadius=.5f*ambientOutset*SkDrawShadowMetrics::AmbientRecipAlpha(rec.fZPlaneParams.fZ);
  blur(devicePath,rec.fAmbientColor,ambientRadius,.5f*(ambientOutset-ambientRadius));
  blur(devicePath.makeOffset(spotOffset.x(),spotOffset.y()),rec.fSpotColor,spotRadius,0);
  return true;
}
class NativeShadowReplayCanvas final:public SkPaintFilterCanvas {
  SkCanvas& target;
public:
  explicit NativeShadowReplayCanvas(SkCanvas& canvas):SkPaintFilterCanvas(&canvas),target(canvas){}
protected:
  bool onFilter(SkPaint&)const override{return true;}
  void onDrawPicture(const SkPicture* picture,const SkMatrix* matrix,const SkPaint* paint)override{
    SkCanvas::onDrawPicture(picture,matrix,paint);
  }
  void onDrawShadowRec(const SkPath& path,const SkDrawShadowRec& rec)override{
    if(!drawStableNativeShadow(target,path,rec))SkNWayCanvas::onDrawShadowRec(path,rec);
  }
};
}
#endif
