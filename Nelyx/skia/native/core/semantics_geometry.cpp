// SPDX-License-Identifier: BSD-3-Clause
#include "nelyx_skia/semantics_geometry.h"
#include "nelyx_skia/scene_packet.h"
#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <limits>
#include <optional>
#include <stdexcept>
#if defined(_MSC_VER)
#pragma float_control(precise, on, push)
#pragma fp_contract(off)
#elif defined(__clang__)
#pragma clang fp contract(off)
#endif
namespace nelyx::semantics_geometry {
namespace {
using Matrix = std::array<double, 16>;
struct Rect {
  double l, t, r, b;
  bool empty() const { return l >= r || t >= b; }
};
using Clip = std::optional<Rect>;
[[noreturn]] void reject() {
  throw std::invalid_argument(
      "Invalid native Semantics geometry packet/owner/budget");
}
double minimum(double a, double b) {
  if (std::isnan(a) || std::isnan(b))
    return std::numeric_limits<double>::quiet_NaN();
  if (a == 0 && b == 0)
    return std::signbit(a) || std::signbit(b) ? -0. : 0.;
  return std::min(a, b);
}
double maximum(double a, double b) {
  if (std::isnan(a) || std::isnan(b))
    return std::numeric_limits<double>::quiet_NaN();
  if (a == 0 && b == 0)
    return std::signbit(a) && std::signbit(b) ? -0. : 0.;
  return std::max(a, b);
}
Rect intersect(Rect a, Rect b) {
  return {maximum(a.l, b.l), maximum(a.t, b.t), minimum(a.r, b.r),
          minimum(a.b, b.b)};
}
Clip intersect(Clip a, Clip b) {
  return !b ? a : !a ? b : Clip{intersect(*a, *b)};
}
bool zero(const Matrix &a) {
  return std::all_of(a.begin(), a.end(), [](double v) { return v == 0; });
}
Matrix matrix(const double *p) {
  Matrix a;
  std::copy_n(p, 16, a.begin());
  return a;
}
Matrix multiply(const Matrix &a, const Matrix &b) {
  Matrix out;
  for (size_t col = 0; col < 16; col += 4)
    for (size_t row = 0; row < 4; ++row)
      out[col + row] = a[row] * b[col] + a[row + 4] * b[col + 1] +
                       a[row + 8] * b[col + 2] + a[row + 12] * b[col + 3];
  return out;
}
bool translation(const Matrix &m) {
  constexpr Matrix identity{1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1};
  for (size_t i = 0; i < 16; ++i)
    if (i != 12 && i != 13 && m[i] != identity[i])
      return false;
  return std::isfinite(m[12]) && std::isfinite(m[13]);
}
double invert(Matrix &m) {
  const auto a = m;
  const auto a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4],
             a11 = a[5], a12 = a[6], a13 = a[7], a20 = a[8], a21 = a[9],
             a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14],
             a33 = a[15];
  const auto b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10,
             b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11,
             b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12,
             b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30,
             b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31,
             b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const auto det =
      b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (det == 0)
    return det;
  const auto inv = 1. / det;
  m = {(a11 * b11 - a12 * b10 + a13 * b09) * inv,
       (-a01 * b11 + a02 * b10 - a03 * b09) * inv,
       (a31 * b05 - a32 * b04 + a33 * b03) * inv,
       (-a21 * b05 + a22 * b04 - a23 * b03) * inv,
       (-a10 * b11 + a12 * b08 - a13 * b07) * inv,
       (a00 * b11 - a02 * b08 + a03 * b07) * inv,
       (-a30 * b05 + a32 * b02 - a33 * b01) * inv,
       (a20 * b05 - a22 * b02 + a23 * b01) * inv,
       (a10 * b10 - a11 * b08 + a13 * b06) * inv,
       (-a00 * b10 + a01 * b08 - a03 * b06) * inv,
       (a30 * b04 - a31 * b02 + a33 * b00) * inv,
       (-a20 * b04 + a21 * b02 - a23 * b00) * inv,
       (-a10 * b09 + a11 * b07 - a12 * b06) * inv,
       (a00 * b09 - a01 * b07 + a02 * b06) * inv,
       (-a30 * b03 + a31 * b01 - a32 * b00) * inv,
       (a20 * b03 - a21 * b01 + a22 * b00) * inv};
  return det;
}
Rect transform(const Matrix &m, Rect r) {
  if (r.empty() || zero(m))
    return {0, 0, 0, 0};
  const auto x = r.l, y = r.t, w = r.r - x, h = r.b - y, wx = m[0] * w,
             hx = m[4] * h, rx = m[0] * x + m[4] * y + m[12], wy = m[1] * w,
             hy = m[5] * h, ry = m[1] * x + m[5] * y + m[13];
  if (!std::isfinite(w) || !std::isfinite(h)) {
    const bool affine = m[3] == 0 && m[7] == 0 && m[15] == 1;
    const auto point = [&](double px, double py) {
      auto scale = affine ? 1. : 1. / (m[3] * px + m[7] * py + m[15]);
      return std::array<double, 2>{(m[0] * px + m[4] * py + m[12]) * scale,
                                   (m[1] * px + m[5] * py + m[13]) * scale};
    };
    auto a = point(r.l, r.t), b = point(r.r, r.t), c = point(r.l, r.b),
         d = point(r.r, r.b);
    return {minimum(minimum(minimum(a[0], b[0]), c[0]), d[0]),
            minimum(minimum(minimum(a[1], b[1]), c[1]), d[1]),
            maximum(maximum(maximum(a[0], b[0]), c[0]), d[0]),
            maximum(maximum(maximum(a[1], b[1]), c[1]), d[1])};
  }
  if (m[3] == 0 && m[7] == 0 && m[15] == 1) {
    Rect out{rx, ry, rx, ry};
    if (wx < 0)
      out.l += wx;
    else
      out.r += wx;
    if (hx < 0)
      out.l += hx;
    else
      out.r += hx;
    if (wy < 0)
      out.t += wy;
    else
      out.b += wy;
    if (hy < 0)
      out.t += hy;
    else
      out.b += hy;
    return out;
  }
  const auto ww = m[3] * w, hw = m[7] * h, rw = m[3] * x + m[7] * y + m[15];
  const auto ulx = rx / rw, uly = ry / rw, urx = (rx + wx) / (rw + ww),
             ury = (ry + wy) / (rw + ww), llx = (rx + hx) / (rw + hw),
             lly = (ry + hy) / (rw + hw), lrx = (rx + wx + hx) / (rw + ww + hw),
             lry = (ry + wy + hy) / (rw + ww + hw);
  // MatrixUtils uses ordered ternaries, not Math.min/max, in perspective mode.
  const auto min4 = [](double a, double b, double c, double d) {
    auto e = a < b ? a : b, f = c < d ? c : d;
    return e < f ? e : f;
  };
  const auto max4 = [](double a, double b, double c, double d) {
    auto e = a > b ? a : b, f = c > d ? c : d;
    return e > f ? e : f;
  };
  return {min4(ulx, urx, llx, lrx), min4(uly, ury, lly, lry),
          max4(ulx, urx, llx, lrx), max4(uly, ury, lly, lry)};
}
Clip clip(const double *p) {
  return p[0] == 0 ? Clip{} : Clip{Rect{p[1], p[2], p[3], p[4]}};
}
void write(double *p, Clip r) {
  p[0] = r ? 1 : 0;
  if (r) {
    p[1] = r->l;
    p[2] = r->t;
    p[3] = r->r;
    p[4] = r->b;
  }
}
} // namespace
Session::Session(double owner, double generation)
    : owner_(owner), generation_(generation) {
  scene_packet::integer(owner, 9007199254740991ULL);
  scene_packet::integer(generation, 9007199254740991ULL);
  if (owner < 1)
    reject();
}
std::vector<double> Session::evaluate(std::span<const double> p) {
  const bool timing = p.size() > 14 && p[14] == 1;
  const auto began = timing ? std::chrono::steady_clock::now()
                            : std::chrono::steady_clock::time_point{};
  if (closed_ || p.size() < 16 || p.size() * 8 > maxBytes || p[0] != magic ||
      p[1] != 1 || p[2] != owner_ || p[3] != generation_ || p[4] <= revision_ ||
      p[13] != p.size() || (p[14] != 0 && p[14] != 1) || p[15] != 0)
    reject();
  scene_packet::integer(p[4], 9007199254740991ULL);
  for (size_t i = 5; i < 9; ++i)
    if (p[i] != -1)
      scene_packet::integer(p[i], 9007199254740991ULL);
  if (!std::isfinite(p[9]) || p[9] <= 0 || p[11] != queryWords ||
      p[12] != resultWords)
    reject();
  const auto count = scene_packet::integer(p[10], maxNodes),
             resultSize = 16 + count * resultWords;
  if (p.size() != 16 + count * queryWords ||
      (p.size() + 2 * resultSize) * 8 + 4096 > maxBytes)
    reject();
  for (size_t at = 16; at < p.size(); at += queryWords) {
    for (size_t j = 0; j < queryWords; ++j)
      if (!std::isfinite(p[at + j]))
        reject();
    for (size_t j : {16u, 33u, 38u, 43u, 48u})
      if (p[at + j] != 0 && p[at + j] != 1)
        reject();
  }
  const auto validated = timing ? std::chrono::steady_clock::now() : began;
  std::vector<double> out(resultSize, 0);
  std::copy_n(p.begin(), 16, out.begin());
  out[0] = resultMagic;
  out[13] = double(resultSize);
  for (size_t n = 0; n < count; ++n) {
    const auto *q = p.data() + 16 + n * queryWords;
    auto *r = out.data() + 16 + n * resultWords;
    auto m = matrix(q);
    auto paint = clip(q + 33), semantic = clip(q + 38),
         parentPaint = clip(q + 43), parentSemantic = clip(q + 48);
    if (!semantic)
      semantic = intersect(paint, parentSemantic);
    paint = intersect(paint, parentPaint);
    if (paint || semantic) {
      if (translation(m)) {
        const auto shift = [&](Clip &c) {
          if (c) {
            if (c->empty())
              c = Rect{0, 0, 0, 0};
            else
              c = Rect{c->l + -m[12], c->t + -m[13], c->r + -m[12],
                       c->b + -m[13]};
          }
        };
        shift(semantic);
        shift(paint);
      } else {
        auto inverse = m;
        if (invert(inverse) != 0) {
          if (semantic)
            semantic = transform(inverse, *semantic);
          if (paint)
            paint = transform(inverse, *paint);
        } else {
          semantic.reset();
          paint.reset();
        }
      }
    }
    if (q[16] != 0)
      m = multiply(matrix(q + 17), m);
    Rect rect{q[53], q[54], q[55], q[56]};
    if (semantic)
      rect = intersect(*semantic, rect);
    bool hidden = false;
    if (paint) {
      auto painted = intersect(*paint, rect);
      hidden = painted.empty() && !rect.empty();
      if (!hidden)
        rect = painted;
    }
    std::copy(m.begin(), m.end(), r);
    write(r + 16, paint);
    write(r + 21, semantic);
    r[26] = rect.l;
    r[27] = rect.t;
    r[28] = rect.r;
    r[29] = rect.b;
    r[30] = hidden ? 1 : 0;
  }
  if (p[14] == 1) {
    out[14] =
        std::chrono::duration<double, std::milli>(validated - began).count();
    out[15] = std::chrono::duration<double, std::milli>(
                  std::chrono::steady_clock::now() - validated)
                  .count();
  }
  revision_ = p[4];
  peak_ = std::max(peak_, (p.size() + 2 * out.capacity()) * 8 + 4096);
  return out;
}
} // namespace nelyx::semantics_geometry
#if defined(_MSC_VER)
#pragma float_control(pop)
#endif
