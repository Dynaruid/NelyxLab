// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "geometry.hpp"
namespace nelyx::v2 {
struct NativePaintEntry {
  uint32_t kind=0,flags=0,color=0,shadowColor=0,shape=0,clip=0,strokeColor=0;
  Handle reference;
  double elevation=0,strokeWidth=0,strokeAlign=-1,x=0,y=0,radius=-1,progress=0;
  std::array<double,8> radii{};
  double width=0,height=0,cx=0,cy=0,resolvedRadius=0;
  Affine transform;
};
struct NativePaint {
  Lease lease;
  bool resolved=false;
  std::vector<NativePaintEntry> entries;
  NativePaint(const std::shared_ptr<Ledger>& ledger,size_t count):
    lease(ledger,sizeof(NativePaint)+count*sizeof(NativePaintEntry)),entries(count){}
};
struct Document;
std::shared_ptr<const NativePaint> readNativePaint(const std::shared_ptr<Ledger>&,Reader);
Writer nativePaintBytes(const NativePaint&);
void resolveNativePaint(Document&);
bool sameNativePaintHit(const NativePaintEntry&,const NativePaintEntry&);
}
