// SPDX-License-Identifier: BSD-3-Clause
#include "include/core/SkCanvas.h"
#include "include/core/SkSurface.h"
#include "nelyx_skia/core.h"
#include "nelyx_skia/scene_build.h"
#include <cstring>
#include <functional>
#include <iostream>
#include <limits>
#include <stdexcept>
using namespace nelyx;
static void require(bool v, const char *message) {
  if (!v)
    throw std::runtime_error(message);
}
static void rejects(const std::function<void()> &f) {
  bool rejected = false;
  try {
    f();
  } catch (const std::exception &) {
    rejected = true;
  }
  require(rejected, "Malformed table accepted");
}
static std::vector<unsigned char>
pixels(const SkPath &path, const SkPaint &paint, double dpr, bool clipped) {
  auto s = SkSurfaces::Raster(SkImageInfo::MakeN32Premul(180, 180));
  require(bool(s), "Raster unavailable");
  auto c = s->getCanvas();
  c->clear(SK_ColorTRANSPARENT);
  c->scale(float(dpr), float(dpr));
  c->save();
  double r[]{1, 2, 100, 90, 3, 4, 5, 6, 7, 8, 9, 10};
  if (clipped) {
    c->clipRect(SkRect::MakeXYWH(2, 3, 95, 92), SkClipOp::kIntersect, true);
    c->clipRRect(scene_build::rounded(r), SkClipOp::kIntersect, true);
    c->clipPath(path, SkClipOp::kDifference, true);
  }
  SkPaint alpha;
  alpha.setAlphaf(.63f);
  c->saveLayer(nullptr, &alpha);
  c->drawPath(path, paint);
  c->restore();
  skia_core::drawShadow(*c, path, 0x68000000, 2.25f, false, float(dpr));
  c->restore();
  std::vector<unsigned char> out(180 * 180 * 4);
  require(s->readPixels(SkImageInfo::MakeN32Premul(180, 180), out.data(),
                        180 * 4, 0, 0),
          "Read pixels failed");
  return out;
}
int main() {
  try {
    scene_packet::Path p{1,
                         {{0, {4, 5}},
                          {1, {1, 2}},
                          {2, {20, 8}},
                          {3, {3, -1}},
                          {4, {24, 2, 30, 9}},
                          {5, {4, 2, 8, 7}},
                          {6, {40, 6, 42, 18, 48, 20}},
                          {7, {2, 2, 4, 6, 8, 8}},
                          {8, {55, 40, 45, 48, .7}},
                          {9, {-2, 4, -8, 4, .6}},
                          {10, {}},
                          {10, {}},
                          {11, {5, 60, 25, 80}},
                          {12, {30, 60, 50, 80}},
                          {13, {60, 60, 90, 90, 1, 2, 3, 4, 5, 6, 7, 8}}}};
    SkPathBuilder b;
    b.setFillType(SkPathFillType::kEvenOdd);
    b.moveTo(4, 5);
    b.rMoveTo({1, 2});
    b.lineTo(20, 8);
    b.rLineTo(3, -1);
    b.quadTo(24, 2, 30, 9);
    b.rQuadTo(4, 2, 8, 7);
    b.cubicTo(40, 6, 42, 18, 48, 20);
    b.rCubicTo(2, 2, 4, 6, 8, 8);
    b.conicTo(55, 40, 45, 48, .7);
    b.rConicTo(-2, 4, -8, 4, .6);
    b.close();
    b.close();
    b.addRect(SkRect::MakeLTRB(5, 60, 25, 80));
    b.addOval(SkRect::MakeLTRB(30, 60, 50, 80), SkPathDirection::kCW, 1);
    SkVector radii[]{{1, 2}, {3, 4}, {5, 6}, {7, 8}};
    SkRRect rounded;
    rounded.setRectRadii(SkRect::MakeLTRB(60, 60, 90, 90), radii);
    b.addRRect(rounded, SkPathDirection::kCW);
    const auto expected = b.snapshot(), actual = scene_build::path(p);
    require(actual == expected, "All-verb path differs from existing builder");
    scene_packet::Paint paint{0x913fc17a, 1, 1, 1.75, 4.75, 1, 2, 3};
    auto value = scene_build::paint(paint);
    SkPaint old;
    old.setColor(0x913fc17a);
    old.setAntiAlias(true);
    old.setStyle(SkPaint::kStroke_Style);
    old.setStrokeWidth(1.75f);
    old.setStrokeMiter(4);
    old.setStrokeCap(SkPaint::kRound_Cap);
    old.setStrokeJoin(SkPaint::kBevel_Join);
    old.setBlendMode(SkBlendMode::kSrcOver);
    require(value == old, "Paint differs from typed JSI setters");
    for (double dpr : {1., 1.25, 1.5, 2.})
      for (bool clip : {false, true})
        require(pixels(actual, value, dpr, clip) ==
                    pixels(expected, old, dpr, clip),
                "draw/clip/layer/shadow pixels differ");
    for (unsigned channel :
         {0u, 1u, 7u, 15u, 31u, 63u, 95u, 127u, 128u, 191u, 254u, 255u}) {
      auto c = SkColorSetARGB(channel, channel, channel, channel);
      auto f = SkColor4f::FromColor(c);
      require(SkColorSetARGB(f.fA * 255, f.fR * 255, f.fG * 255, f.fB * 255) ==
                  c,
              "Existing Float32 color roundtrip differs");
    }
    std::vector<double> words{scene_packet::pathMagic, 1, 1, 1, 4, 0, 2, 1, 2};
    require(scene_build::path(scene_packet::readPathPacket(words)) ==
                SkPathBuilder()
                    .setFillType(SkPathFillType::kEvenOdd)
                    .moveTo(1, 2)
                    .snapshot(),
            "Path packet mismatch");
    auto invalid = words;
    invalid.pop_back();
    rejects([&] { scene_packet::readPathPacket(invalid); });
    invalid = words;
    invalid[3] = 4097;
    rejects([&] { scene_packet::readPathPacket(invalid); });
    invalid = words;
    invalid[5] = 14;
    rejects([&] { scene_packet::readPathPacket(invalid); });
    invalid = words;
    invalid[7] = std::numeric_limits<double>::infinity();
    rejects([&] { scene_packet::readPathPacket(invalid); });
    invalid = words;
    invalid[2] = .5;
    rejects([&] { scene_packet::readPathPacket(invalid); });
    invalid = words;
    invalid[4] = 9007199254740991.;
    rejects([&] { scene_packet::readPathPacket(invalid); });
    std::vector<double> tables{
        scene_packet::magic, 2, 0, 0, 24,   0, 1, 24, 1, 1, 1, 1, -1, -1, 1, 0,
        0xff123456,          1, 1, 2, 4.75, 1, 2, 3};
    auto parsed = scene_packet::readTables(tables, 0);
    require(parsed.paints.size() == 1 && parsed.commandOffset == 24,
            "Paint table mismatch");
    for (auto pair : std::vector<std::pair<size_t, double>>{{1, 1},
                                                            {3, 1},
                                                            {4, 25},
                                                            {5, 65537},
                                                            {7, 15},
                                                            {8, 1.5},
                                                            {14, 0},
                                                            {15, 1},
                                                            {16, 4294967296.},
                                                            {17, 2},
                                                            {20, 2147483648.},
                                                            {23, 29}}) {
      auto bad = tables;
      bad[pair.first] = pair.second;
      rejects([&] { scene_packet::readTables(bad, 0); });
    }
    require(scene_build::path(scene_packet::Path{0, {}}).isEmpty(),
            "Empty path changed");
    std::cout << "PASS all Path verbs/fill/empty, numeric paint, 8 "
                 "draw/clip/opacity/fractional-shadow pixel pairs, 12 color "
                 "roundtrips, malformed/version/count/overflow tables\n";
    return 0;
  } catch (const std::exception &e) {
    std::cerr << e.what() << '\n';
    return 1;
  }
}
