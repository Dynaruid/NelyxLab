// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "geometry.hpp"

namespace nelyx::v2 {
struct SnapshotPaint {
  double scaleX=1,scaleY=1,translateX=0,translateY=0,offsetX=0,offsetY=0,opacity=1;
  uint32_t background=0;bool intrinsic=false;
};
struct SnapshotStyle {
  uint64_t revision=0;
  bool enabled=false,autoresize=false;
  uint32_t mode=0;
  double ratio=1;
  SnapshotPaint live,cached;
};
inline SnapshotPaint readSnapshotPaint(Reader data,bool live) {
  require(data.length==64&&data.u32(60)<=(live?0u:1u));
  SnapshotPaint value{data.f64(0),data.f64(8),data.f64(16),data.f64(24),data.f64(32),data.f64(40),
    data.f64(48),data.u32(56),bool(data.u32(60))};
  require(value.opacity>=0&&value.opacity<=1,wire::statuses::invalidValue);
  return value;
}
inline std::optional<SnapshotStyle> readSnapshotStyle(Reader data) {
  require(data.length==wire::snapshotStyleBytes);
  if(!data.u32(0)) {
    for(size_t i=0;i<data.length;++i)require(data.data[i]==0);
    return {};
  }
  require((data.u32(0)&~7u)==0&&(data.u32(0)&4u)&&data.u32(4)<=2&&data.u64(8)>0&&data.u64(24)==0);
  SnapshotStyle value{data.u64(8),bool(data.u32(0)&1u),bool(data.u32(0)&2u),data.u32(4),data.f64(16),
    readSnapshotPaint(data.slice(32,64),true),readSnapshotPaint(data.slice(96,64),false)};
  require(value.ratio>0&&value.ratio<=64,wire::statuses::invalidValue);
  return value;
}
inline void writeSnapshotPaint(Writer& data,size_t at,const SnapshotPaint& value) {
  data.f64(at,value.scaleX);data.f64(at+8,value.scaleY);data.f64(at+16,value.translateX);data.f64(at+24,value.translateY);
  data.f64(at+32,value.offsetX);data.f64(at+40,value.offsetY);data.f64(at+48,value.opacity);
  data.u32(at+56,value.background);data.u32(at+60,value.intrinsic?1u:0u);
}
inline Writer snapshotStyleBytes(const SnapshotStyle& value) {
  Writer data(wire::snapshotStyleBytes);data.u32(0,4u|(value.enabled?1u:0u)|(value.autoresize?2u:0u));
  data.u32(4,value.mode);data.u64(8,value.revision);data.f64(16,value.ratio);
  writeSnapshotPaint(data,32,value.live);writeSnapshotPaint(data,96,value.cached);return data;
}
struct SnapshotDecision {
  uint64_t token=0;
  uint32_t action=0,pixelWidth=0,pixelHeight=0;
  double sourceWidth=0,sourceHeight=0,ratio=1;
  Affine transform;
  double opacity=1;uint32_t background=0;
  double sourceRectWidth=0,sourceRectHeight=0,destinationWidth=0,destinationHeight=0,boxWidth=0,boxHeight=0;
  std::array<uint64_t,64> liveTokens{};
  uint32_t liveCount=0;
};
inline Writer snapshotDecisionBytes(const SnapshotDecision& value) {
  Writer data(wire::snapshotDecisionBytes+value.liveCount*8);data.u64(0,value.token);data.u32(8,value.action);data.u32(12,value.liveCount);
  data.f64(16,value.sourceWidth);data.f64(24,value.sourceHeight);data.f64(32,value.ratio);
  data.u32(40,value.pixelWidth);data.u32(44,value.pixelHeight);
  const auto& m=value.transform;const double matrix[]{m.a,m.b,m.c,m.d,m.tx,m.ty};
  for(size_t i=0;i<6;++i)data.f64(48+i*8,matrix[i]);
  data.f64(96,value.opacity);data.u32(104,value.background);
  data.f64(112,value.sourceRectWidth);data.f64(120,value.sourceRectHeight);
  data.f64(128,value.destinationWidth);data.f64(136,value.destinationHeight);
  data.f64(144,value.boxWidth);data.f64(152,value.boxHeight);
  for(uint32_t i=0;i<value.liveCount;++i)data.u64(wire::snapshotDecisionBytes+i*8,value.liveTokens[i]);
  return data;
}
}
