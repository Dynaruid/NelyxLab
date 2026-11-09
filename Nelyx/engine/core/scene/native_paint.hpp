// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "geometry.hpp"
namespace nelyx::v2 {
struct NativePaintEntry {
  uint32_t kind=0,flags=0,color=0,shadowColor=0,shape=0,clip=0,strokeColor=0,strokeCap=0;
  Handle reference;
  double elevation=0,strokeWidth=0,strokeAlign=-1,x=0,y=0,radius=-1,progress=0;
  std::array<double,8> radii{};
  double width=0,height=0,cx=0,cy=0,resolvedRadius=0;
  Affine transform;
  uint32_t geometry=0,geometryFlags=0;
  double trackWidth=0,trackHeight=0,thumbWidth=0,thumbHeight=0,extension=0,position=0,inset=0,blurSigma=0,spread=0;
  std::array<double,8> linear{};
  std::array<uint32_t,14> expressions{};
  double repeat=0;
  uint32_t pathStart=0,pathCount=0,pathFillRule=0;
  uint32_t strokeWidthExpression=UINT32_MAX;
  std::array<uint32_t,4> gradientExpressions{};
  std::array<double,4> gradient{};
  Rect pathBounds;
};
struct NativePaintExpression {
  uint32_t op=0,a=0,b=0,c=0;
  double value=0;
  bool varying=false;
};
struct NativePaintPathCommand {
  uint32_t verb=0;
  uint32_t condition=UINT32_MAX;
  std::array<uint32_t,12> expressions{};
  std::array<double,12> values{};
};
struct NativePaint {
  Lease lease;
  bool resolved=false,frameDependent=false;
  std::vector<NativePaintEntry> entries;
  std::vector<NativePaintExpression> expressions;
  std::vector<NativePaintPathCommand> paths;
  NativePaint(const std::shared_ptr<Ledger>& ledger,size_t count,size_t expressionCount=0,size_t pathCount=0):
    lease(ledger,sizeof(NativePaint)+count*sizeof(NativePaintEntry)+expressionCount*sizeof(NativePaintExpression)+pathCount*sizeof(NativePaintPathCommand)),entries(count),expressions(expressionCount),paths(pathCount){}
};
struct PaintPlacement {
  Lease lease;
  Handle reference;
  bool unbounded=false;
  uint64_t fontRevision=0;
  double width=0,height=0,baseline=0;
  std::shared_ptr<const NativePaint> program;
  explicit PaintPlacement(const std::shared_ptr<Ledger>& ledger):lease(ledger,sizeof(PaintPlacement)){}
};
struct Document;
struct Node;
using PaintMatrices=std::vector<Affine>;
bool livePaintPlacement(const Node&);
Affine resolvePaintPlacement(const Node&,const Document&,const PaintMatrices&,Affine parent,uint64_t& operations);
std::shared_ptr<const NativePaint> resolveNodePaint(const Node&,const Document&,const PaintMatrices&,uint64_t& operations);
std::shared_ptr<const PaintPlacement> readPaintPlacement(const std::shared_ptr<Ledger>&,Reader);
Writer paintPlacementBytes(const PaintPlacement&);
void resolvePaintPlacements(Document&,uint64_t fontRevision);
std::shared_ptr<const NativePaint> readNativePaint(const std::shared_ptr<Ledger>&,Reader);
Writer nativePaintBytes(const NativePaint&);
void resolveNativePaint(Document&);
bool sameNativePaintHit(const NativePaintEntry&,const NativePaintEntry&);
}
