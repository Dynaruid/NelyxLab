// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "windows/WindowsMonotonic.h"
#include "rnskia/RNSkGraphiteTarget.h"
#include <array>
namespace RNSkia {
struct WindowsFrameTraceEntry {
  NelyxFrameIdentity identity;
  uint64_t view=0,surface=0;
  uint32_t stage=0,width=0,height=0;
  double timestamp=0;
};
// Numeric observations only, no scene, resources, callbacks or retained frames.
// Stages: 0 submitted, 1 producer complete, 2 surface updated, 3 retired,
// 4 superseded visual (uploads still execute), 5 failed, 6 layout requested,
// 7 layout admitted, 8 proposed window frame ready, 9 actual window geometry,
// 10 exact resize commit/DWM boundary, 11 resize timeout, 12 prepared copy retired,
// 13 pre-geometry clock boundary (width=status, height=elapsed microseconds).
// Display pixels are observed separately by the desktop-capture fixture.
class WindowsFrameTrace final {
public:
  void add(NelyxFrameIdentity identity,uint64_t view,uint64_t surface,uint32_t stage,uint32_t width,uint32_t height){
    std::lock_guard lock(mutex);if(stage==0)++inFlight;else if(stage==3&&inFlight)--inFlight;
    entries[next]={identity,view,surface,stage,width,height,windowsMonotonicMilliseconds()};next=(next+1)%entries.size();count=std::min(count+1,entries.size());
  }
  uint32_t pending(){std::lock_guard lock(mutex);return inFlight;}
  std::vector<WindowsFrameTraceEntry> drain(){
    std::lock_guard lock(mutex);std::vector<WindowsFrameTraceEntry> result;result.reserve(count);
    for(size_t index=0;index<count;++index)result.push_back(entries[(next+entries.size()-count+index)%entries.size()]);count=0;return result;
  }
private:
  std::mutex mutex;std::array<WindowsFrameTraceEntry,256> entries{};size_t next=0,count=0;uint32_t inFlight=0;
};
}
