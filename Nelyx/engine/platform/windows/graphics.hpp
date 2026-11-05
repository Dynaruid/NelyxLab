// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "../../core/state.hpp"
#include "include/core/SkPathBuilder.h"
#include "include/core/SkCanvas.h"
#include "include/core/SkRRect.h"
#include "include/core/SkMaskFilter.h"
#include "include/core/SkBlurTypes.h"
#include "include/effects/SkImageFilters.h"
namespace nelyx::v2::windows {
inline SkPath graphicsPath(const GraphicsPath& path) {
  SkPathBuilder builder;builder.setFillType(path.fillRule?SkPathFillType::kEvenOdd:SkPathFillType::kWinding);
  for(const auto& command:path.commands){const auto& p=command.values;
    switch(command.verb){
      case 1:builder.moveTo(float(p[0]),float(p[1]));break;
      case 2:builder.lineTo(float(p[0]),float(p[1]));break;
      case 3:builder.quadTo(float(p[0]),float(p[1]),float(p[2]),float(p[3]));break;
      case 4:builder.cubicTo(float(p[0]),float(p[1]),float(p[2]),float(p[3]),float(p[4]),float(p[5]));break;
      case 5:builder.close();break;
    }
  }return builder.detach();
}
inline void paintShape(SkCanvas* canvas,const Node& node,const SkPath* path,SkPaint& paint) {
  const auto& style=node.graphics;
  const auto draw=[&]{if(node.kind==wire::kinds::path){if(path)canvas->drawPath(*path,paint);}
    else canvas->drawRRect(SkRRect::MakeRectXY(SkRect::MakeWH(float(node.properties.width),float(node.properties.height)),float(node.radius),float(node.radius)),paint);};
  if(style.shadowColor>>24){canvas->save();canvas->translate(float(style.shadowX),float(style.shadowY));
    paint.setColor(style.shadowColor);if(style.shadowSigma>0)paint.setMaskFilter(SkMaskFilter::MakeBlur(kNormal_SkBlurStyle,float(style.shadowSigma)));
    draw();paint.setMaskFilter(nullptr);canvas->restore();}
  if(node.color>>24){paint.setColor(node.color);draw();}
  if(style.strokeColor>>24&&style.strokeWidth>0){paint.setColor(style.strokeColor);paint.setStrokeWidth(float(style.strokeWidth));
    paint.setStyle(SkPaint::kStroke_Style);draw();paint.setStyle(SkPaint::kFill_Style);}
}
}
