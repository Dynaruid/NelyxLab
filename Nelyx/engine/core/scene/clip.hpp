// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "geometry.hpp"

namespace nelyx::v2 {
struct ClipStyle {
  uint32_t behavior=wire::clipBehaviors::antiAlias,shape=wire::clipShapes::rect;
  // Clockwise top-left, top-right, bottom-right, bottom-left x/y radii.
  std::array<double,8> radii{};
  bool operator==(const ClipStyle&)const=default;
};
inline Writer clipStyleBytes(const ClipStyle& style) {
  Writer bytes(wire::clipStyleBytes);bytes.u32(0,style.behavior);bytes.u32(4,style.shape);
  for(size_t i=0;i<style.radii.size();++i)bytes.f64(16+i*8,style.radii[i]);
  return bytes;
}
}
