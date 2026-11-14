// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <iomanip>
#include <ostream>
#include <stdexcept>

namespace nelyx::v2::windows {
// This pinned JSI bridge converts several VM counters through double before
// returning int64. Reject its potentially rounded range instead of fabricating
// exact allocation deltas. The diagnostic transport itself remains uint64.
inline uint64_t checkedInstrumentedHeapCounter(int64_t value){
  if(value<0||uint64_t(value)>9007199254740991ULL)throw std::runtime_error("App heap counter is not exact");
  return uint64_t(value);
}
/** App-owner diagnostic only. No heap query or sample storage exists on the
 * ordinary clock path. Full/failed observations never change the clock result.
 * Counters are cumulative VM values; current allocated bytes are not live bytes. */
class AppHeapClock {
 public:
  static constexpr size_t capacity=2048;
  struct Counters {
    uint64_t totalAllocated=0,collections=0,allocated=0,heap=0,external=0;
  };
 private:
  struct Point {double at=0,until=0;Counters heap;};
  std::array<Point,capacity> points{};
  size_t size=0;
  uint64_t through=0,dropped=0,invalid=0,failed=0;
  bool active=false;
  double started=0,ended=0,maximumProbeMs=0,totalProbeMs=0;
 public:
  void start(double at) noexcept {
    size=through=dropped=invalid=failed=0;
    started=at;ended=maximumProbeMs=totalProbeMs=0;active=true;
  }
  void stop(double at) noexcept {active=false;ended=at;}
  bool isActive() const noexcept {return active;}
  template<class ReadHeap,class ReadClock>
  void sample(double at,ReadHeap&& readHeap,ReadClock&& readClock) noexcept {
    if(!active)return;
    ++through;
    if(through>capacity){++dropped;return;}
    try {
      const auto heap=readHeap();
      const auto until=readClock();
      if(!std::isfinite(at)||!std::isfinite(until)||at<started||until<at||
          (size&&(at<points[size-1].until||heap.totalAllocated<points[size-1].heap.totalAllocated||
            heap.collections<points[size-1].heap.collections))){++invalid;return;}
      points[size++]={at,until,heap};
      const auto elapsed=until-at;
      maximumProbeMs=std::max(maximumProbeMs,elapsed);totalProbeMs+=elapsed;
    }catch(...){++failed;}
  }
  void write(std::ostream& out) const {
    const auto precision=out.precision(17);
    out<<"{\"schema\":\"nelyx.windows.app-heap-clock/v1\",\"domain\":\"qpc-milliseconds\",\"capacity\":"<<capacity
      <<",\"started\":"<<started<<",\"ended\":"<<ended<<",\"through\":"<<through<<",\"dropped\":"<<dropped
      <<",\"invalid\":"<<invalid<<",\"failed\":"<<failed<<",\"maximumProbeMs\":"<<maximumProbeMs
      <<",\"totalProbeMs\":"<<totalProbeMs<<",\"points\":[";
    for(size_t i=0;i<size;++i){
      if(i)out<<',';const auto& p=points[i];
      // Preserve complete integer counters, including beyond JS's safe range.
      out<<'['<<p.at<<','<<p.until<<",\""<<p.heap.totalAllocated<<"\",\""<<p.heap.collections
        <<"\",\""<<p.heap.allocated<<"\",\""<<p.heap.heap<<"\",\""<<p.heap.external<<"\"]";
    }
    out<<"]}";out.precision(precision);
  }
};
} // namespace nelyx::v2::windows
