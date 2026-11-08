// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "../memory.hpp"
#include <map>

namespace nelyx::v2 {
struct ListStyle {
  uint64_t generation = 0;
  uint32_t count = 0, begin = 0, end = 0;
  double estimate = 0;
  bool fixed = false;
};
struct ListItem { uint32_t index = 0; uint64_t key = 0; };
struct ListMetric { uint64_t key = 0; double extent = 0; };
struct ListRow { Handle node; uint32_t index; uint64_t key; double offset, extent; };
struct ListGeometry {
  Lease lease;
  ListStyle style;
  uint32_t metricLimit;
  std::map<uint32_t,ListMetric> measured;
  std::vector<ListRow> rows;
  double total = 0, begin = 0, end = 0;
  ListGeometry(const std::shared_ptr<Ledger>& ledger, ListStyle value,uint32_t limit=wire::limits::listMetrics)
    : lease(ledger,sizeof(ListGeometry)+std::min(value.count,limit+wire::limits::listChildren)*(sizeof(ListMetric)+48)+
        wire::limits::listChildren*sizeof(ListRow)),style(value),metricLimit(limit) {}
  double prefix(uint32_t index) const {
    double offset = 0;uint32_t from=0;
    for(const auto& [i,m]:measured) { if(i>=index)break;offset+=style.estimate*(i-from)+m.extent;from=i+1; }
    offset+=style.estimate*(index-from);
    require(std::isfinite(offset)&&offset>=0&&offset<=1e12,wire::statuses::invalidValue);
    return offset;
  }
  uint32_t indexAt(double offset) const {
    uint32_t low=0,high=style.count;
    while(low<high){const auto mid=low+(high-low)/2;
      if(prefix(mid+1)<=offset)low=mid+1;else high=mid;}
    return low;
  }
};
struct NativeListRange { uint32_t begin=0,end=0; double beginOffset=0; };
inline NativeListRange nativeListRange(const ListStyle& style,const ListGeometry* geometry,double offset,double paint) {
  require(std::isfinite(offset)&&offset>=0&&std::isfinite(paint)&&paint>=0,wire::statuses::invalidValue);
  if(geometry&&geometry->style.count!=style.count)geometry=nullptr;
  const auto rank=[&](double at){return geometry?geometry->indexAt(at):uint32_t(std::min(double(style.count),std::floor(at/style.estimate)));};
  const auto prefix=[&](uint32_t at){return geometry?geometry->prefix(at):style.estimate*at;};
  const uint32_t begin=rank(offset),last=rank(offset+paint);
  uint32_t end=paint==0?begin:std::min(style.count,last+uint32_t(last<style.count&&prefix(last)<offset+paint));
  if(!style.fixed)for(uint32_t i=begin;i<end;++i)if(!geometry||!geometry->measured.count(i)){end=i+1;break;}
  return {begin,end,prefix(begin)};
}
}
