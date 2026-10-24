// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <atomic>
#include <cmath>
#include <cstdint>
#include <stdexcept>

namespace RNSkia {
struct AppleSurfaceSnapshot {
  uint64_t nativeId=0,viewGeneration=0,surfaceGeneration=0;
  double logicalWidth=0,logicalHeight=0,scale=1;
  int width=0,height=0;
  bool bound=false,visible=false;
};
/** Main-owner metadata only. No Apple/GPU/JSI resources cross this boundary. */
class AppleSurfaceState {
  AppleSurfaceSnapshot value;
  bool closed=true;
  static uint64_t nextGeneration() {
    static std::atomic<uint64_t> sequence{0};
    const auto next=++sequence;
    if(next>9007199254740991ULL)throw std::runtime_error("Apple surface generation exceeds JS safe integer");
    return next;
  }
 public:
  void begin(uint64_t nativeId) {
    if(!closed || !nativeId || nativeId>9007199254740991ULL)throw std::runtime_error("Apple view requires a fresh positive native owner");
    value={};value.nativeId=nativeId;value.viewGeneration=nextGeneration();value.surfaceGeneration=nextGeneration();closed=false;
  }
  bool update(double width,double height,double scale,bool attached,bool visible) {
    if(closed)throw std::runtime_error("Apple view owner is closed");
    if(!std::isfinite(width) || !std::isfinite(height) || !std::isfinite(scale) || width<0 || height<0 || scale<=0 || scale>8 || width*scale>4096 || height*scale>4096)
      throw std::runtime_error("Apple backing metrics exceed bounded view admission");
    const auto pixelsWide=static_cast<int>(std::lround(width*scale)),pixelsHigh=static_cast<int>(std::lround(height*scale));
    const bool bound=attached && pixelsWide>0 && pixelsHigh>0;
    const bool changed=value.logicalWidth!=width || value.logicalHeight!=height || value.scale!=scale || value.width!=pixelsWide || value.height!=pixelsHigh || value.bound!=bound;
    const bool shown=bound && visible,visibilityChanged=value.visible!=shown;
    value.logicalWidth=width;value.logicalHeight=height;value.scale=scale;value.width=pixelsWide;value.height=pixelsHigh;value.bound=bound;value.visible=shown;
    if(changed)value.surfaceGeneration=nextGeneration();
    return changed || visibilityChanged;
  }
  bool close() {
    if(closed)return false;
    closed=true;value.bound=false;value.visible=false;value.surfaceGeneration=nextGeneration();return true;
  }
  void invalidateBacking() {
    if(closed)throw std::runtime_error("Apple view owner is closed");
    value.surfaceGeneration=nextGeneration();
  }
  bool isClosed()const{return closed;}
  const AppleSurfaceSnapshot& snapshot()const{return value;}
};
} // namespace RNSkia
