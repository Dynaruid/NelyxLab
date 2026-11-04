// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <span>
#include <vector>
#include <cmath>
#include <algorithm>
#include <stdexcept>
#include <unordered_set>
namespace nelyx::section_lifetime {
inline constexpr size_t header=16,row=8,maxRows=17;
// magic/version/op/generation/revision/count/capacity/children/elements/
// pressure/currentIndex/direction/now/deadline/queue/uncertainty.
// row: id/sameOwner/index/elements/cost/charged/evictable/valid.
inline std::vector<double> run(std::span<const double> p) {
  auto fail=[](){throw std::invalid_argument("Invalid section lifetime transaction");};
  auto integer=[&](double n,double maximum){if(!std::isfinite(n)||n<0||n>maximum||std::floor(n)!=n)fail();return size_t(n);};
  if(p.size()<header||p.size()>header+row*maxRows||p[0]!=0x4e4c534c||p[1]!=1)fail();
  const auto op=integer(p[2],1),generation=integer(p[3],9007199254740991.),revision=integer(p[4],9007199254740991.),count=integer(p[5],maxRows),capacity=integer(p[6],8),children=integer(p[7],16),elements=integer(p[8],2048),pressure=integer(p[9],1);
  if(!generation||!revision||p.size()!=header+row*count||!count||!std::isfinite(p[10])||(p[11]!=1&&p[11]!=-1))fail();
  for(size_t j=12;j<16;++j)if(!std::isfinite(p[j])||p[j]<0)fail();
  std::unordered_set<size_t> ids;
  for(size_t i=0;i<count;++i){auto r=p.subspan(header+i*row,row);auto id=integer(r[0],9007199254740991.);if(!id||!ids.insert(id).second)fail();integer(r[1],1);if(!std::isfinite(r[2]))fail();integer(r[3],2048);if(!std::isfinite(r[4])||r[4]<0)fail();integer(r[5],op?16:1);integer(r[6],1);integer(r[7],1);}
  // result revision/retained/evicted/prepared/visited. Native returns decisions,
  // never speculative releases: TS verifies actual retirement before charging.
  std::vector<double> result{p[4],0,0,0,double(count)};
  if(pressure)return result;
  if(op==1){
    for(size_t i=0;i<count;++i){auto r=p.subspan(header+i*row,row);
      if(r[7]&&r[3]>0&&r[4]<=2&&r[5]<capacity&&children<16&&elements+r[3]<=2048&&p[12]+r[4]+4+p[14]+p[15]<=p[13]){result[3]=r[0];break;}}
    return result;
  }
  auto candidate=p.subspan(header,row);
  if(!candidate[7]||candidate[3]==0||!capacity)return result;
  size_t owned=0;for(size_t i=1;i<count;++i){auto r=p.subspan(header+i*row,row);if(r[1]&&r[5])++owned;}
  if(owned<capacity&&children<16&&elements+candidate[3]<=2048){result[1]=candidate[0];return result;}
  // A bounded one-victim exchange. Other slivers retire in their own layout.
  auto score=[&](double index){const auto delta=index-p[10];return std::abs(delta)+(delta*p[11]<0?0.25:0.);};
  size_t victim=count;double worst=score(candidate[2]);
  for(size_t i=1;i<count;++i){auto r=p.subspan(header+i*row,row);if(r[1]&&r[5]&&r[6]&&r[7]&&score(r[2])>worst){victim=i;worst=score(r[2]);}}
  if(victim<count){auto r=p.subspan(header+victim*row,row);if(elements-r[3]+candidate[3]<=2048){result[1]=candidate[0];result[2]=r[0];}}
  return result;
}
}
