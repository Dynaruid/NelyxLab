// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "../memory.hpp"
#include <map>

namespace nelyx::v2 {
struct ListStyle {
  uint64_t generation = 0;
  uint32_t count = 0, begin = 0, end = 0;
  double estimate = 0;
};
struct ListItem { uint32_t index = 0; uint64_t key = 0; };
struct ListMetric { uint64_t key = 0; double extent = 0; };
struct ListRow { Handle node; uint32_t index; uint64_t key; double offset, extent; };
struct ListGeometry {
  Lease lease;
  ListStyle style;
  std::map<uint32_t,ListMetric> measured;
  std::vector<ListRow> rows;
  double total = 0, begin = 0, end = 0;
  ListGeometry(const std::shared_ptr<Ledger>& ledger, ListStyle value)
    : lease(ledger,sizeof(ListGeometry)+wire::limits::listMetrics*(sizeof(ListMetric)+48)+
        wire::limits::listChildren*sizeof(ListRow)),style(value) {}
  double prefix(uint32_t index) const {
    double offset = style.estimate*index;
    for(const auto& [i,m]:measured) { if(i>=index)break; offset+=m.extent-style.estimate; }
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
}
