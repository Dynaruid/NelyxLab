// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "geometry.hpp"

namespace nelyx::v2 {
struct ClipStyle {
  uint32_t behavior=wire::clipBehaviors::antiAlias,shape=wire::clipShapes::rect;
  bool hitTestShape=false;
  // Clockwise top-left, top-right, bottom-right, bottom-left x/y radii.
  std::array<double,8> radii{};
  bool operator==(const ClipStyle&)const=default;
};
inline Writer clipStyleBytes(const ClipStyle& style) {
  Writer bytes(wire::clipStyleBytes);bytes.u32(0,style.behavior);bytes.u32(4,style.shape);
  bytes.u32(8,style.hitTestShape?wire::clipStyleFlags::hitTestShape:0);
  for(size_t i=0;i<style.radii.size();++i)bytes.f64(16+i*8,style.radii[i]);
  return bytes;
}
inline std::array<double,8> normalizedRadii(std::array<double,8> radii,double width,double height){
  double factor=1;
  const auto side=[&](double sum,double extent){if(sum>extent&&sum>0)factor=std::min(factor,extent/sum);};
  side(radii[0]+radii[2],width);side(radii[6]+radii[4],width);
  side(radii[1]+radii[7],height);side(radii[3]+radii[5],height);
  for(auto& radius:radii)radius*=factor;return radii;
}
inline bool roundedContains(Point point,Rect bounds,const std::array<double,8>& radii){
  if(!inside(point,bounds))return false;
  const std::array<Point,4> centers{{{bounds.x+radii[0],bounds.y+radii[1]},
    {bounds.x+bounds.width-radii[2],bounds.y+radii[3]},
    {bounds.x+bounds.width-radii[4],bounds.y+bounds.height-radii[5]},
    {bounds.x+radii[6],bounds.y+bounds.height-radii[7]}}};
  for(size_t corner=0;corner<4;++corner){const auto center=centers[corner];const auto rx=radii[corner*2],ry=radii[corner*2+1];
    const bool left=corner==0||corner==3,top=corner<2;
    if(rx>0&&ry>0&&(left?point.x<center.x:point.x>center.x)&&(top?point.y<center.y:point.y>center.y)){
      const double dx=(point.x-center.x)/rx,dy=(point.y-center.y)/ry;return dx*dx+dy*dy<=1;}}
  return true;
}
}
