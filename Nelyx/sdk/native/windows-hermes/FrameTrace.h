// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <cstddef>
#include <cstdint>
#include <mutex>
#include <vector>

namespace Nelyx::NativeHermes {
// Copied numeric receipts only: no VM handles, callbacks, text or GPU owners.
// Overflow invalidates the diagnostic; a full buffer never overwrites evidence.
template<size_t Capacity=16384> class FrameTrace final {
public:
  struct Input {uint64_t native=0,core=0,viewport=0;int kind=0;double timestamp=0,dispatchBegin=0,dispatchEnd=0,dx=0,dy=0;bool accepted=false;};
  struct Surface {uint64_t surfaceFrame=0,owner=0,context=0,viewport=0,frame=0,input=0,submission=0,surface=0;int width=0,height=0;double completed=0;};
  struct Turn {uint64_t sequence=0,viewport=0,input=0;double tick=0,dispatch=0,callbacksEnd=0,checkpointEnd=0;size_t callbacks=0;};
  struct Snapshot {std::vector<Input> inputs;std::vector<Surface> surfaces;std::vector<Turn> turns;uint64_t lostInputs=0,lostSurfaces=0,lostTurns=0;};
  FrameTrace(){data.inputs.reserve(Capacity);data.surfaces.reserve(Capacity);data.turns.reserve(Capacity);}
  void input(Input value){std::lock_guard lock(mutex);if(data.inputs.size()==Capacity)++data.lostInputs;else data.inputs.push_back(value);}
  void surface(Surface value){std::lock_guard lock(mutex);if(data.surfaces.size()==Capacity)++data.lostSurfaces;else data.surfaces.push_back(value);}
  void turn(Turn value){std::lock_guard lock(mutex);if(data.turns.size()==Capacity)++data.lostTurns;else data.turns.push_back(value);}
  Snapshot take(){std::lock_guard lock(mutex);Snapshot result=data;data.inputs.clear();data.surfaces.clear();data.turns.clear();data.lostInputs=data.lostSurfaces=data.lostTurns=0;return result;}
private:std::mutex mutex;Snapshot data;
};
}
