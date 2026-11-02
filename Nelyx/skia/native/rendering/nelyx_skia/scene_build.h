// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "include/core/SkPaint.h"
#include "include/core/SkPathBuilder.h"
#include "include/core/SkRRect.h"
#include "nelyx_skia/scene_packet.h"

namespace nelyx::scene_build {
inline SkRRect rounded(const double *p, bool xywh = false) {
  const auto rect = xywh ? SkRect::MakeXYWH(float(p[0]), float(p[1]),
                                            float(p[2]), float(p[3]))
                         : SkRect::MakeLTRB(float(p[0]), float(p[1]),
                                            float(p[2]), float(p[3]));
  SkVector radii[4];
  for (size_t i = 0; i < 4; ++i)
    radii[i] = {float(p[4 + 2 * i]), float(p[5 + 2 * i])};
  SkRRect result;
  result.setRectRadii(rect, radii);
  return result;
}
inline SkPath path(const scene_packet::Path &source) {
  SkPathBuilder b;
  b.setFillType(static_cast<SkPathFillType>(source.fill));
  for (const auto &op : source.operations) {
    const auto &v = op.values;
    switch (op.verb) {
    case 0:
      b.moveTo(v[0], v[1]);
      break;
    case 1:
      b.rMoveTo({float(v[0]), float(v[1])});
      break;
    case 2:
      b.lineTo(v[0], v[1]);
      break;
    case 3:
      b.rLineTo(v[0], v[1]);
      break;
    case 4:
      b.quadTo(v[0], v[1], v[2], v[3]);
      break;
    case 5:
      b.rQuadTo(v[0], v[1], v[2], v[3]);
      break;
    case 6:
      b.cubicTo(v[0], v[1], v[2], v[3], v[4], v[5]);
      break;
    case 7:
      b.rCubicTo(v[0], v[1], v[2], v[3], v[4], v[5]);
      break;
    case 8:
      b.conicTo(v[0], v[1], v[2], v[3], v[4]);
      break;
    case 9:
      b.rConicTo(v[0], v[1], v[2], v[3], v[4]);
      break;
    case 10:
      b.close();
      break;
    case 11:
      b.addRect(
          SkRect::MakeLTRB(float(v[0]), float(v[1]), float(v[2]), float(v[3])));
      break;
    case 12:
      b.addOval(
          SkRect::MakeLTRB(float(v[0]), float(v[1]), float(v[2]), float(v[3])),
          SkPathDirection::kCW, 1);
      break;
    case 13:
      b.addRRect(rounded(v.data()), SkPathDirection::kCW);
      break;
    }
  }
  return b.snapshot();
}
inline SkPaint paint(const scene_packet::Paint &p) {
  SkPaint result;
  result.setColor(static_cast<SkColor>(p.color));
  result.setAntiAlias(p.aa != 0);
  result.setStyle(static_cast<SkPaint::Style>(int(p.style)));
  result.setStrokeWidth(float(p.width));
  // The existing typed JSI setter takes int; retain its truncation before Skia.
  result.setStrokeMiter(float(static_cast<int>(p.miter)));
  result.setStrokeCap(static_cast<SkPaint::Cap>(int(p.cap)));
  result.setStrokeJoin(static_cast<SkPaint::Join>(int(p.join)));
  result.setBlendMode(static_cast<SkBlendMode>(int(p.blend)));
  return result;
}
} // namespace nelyx::scene_build
