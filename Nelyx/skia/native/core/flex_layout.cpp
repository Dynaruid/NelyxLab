// SPDX-License-Identifier: BSD-3-Clause
#include "nelyx_skia/flex_layout.h"
#include <algorithm>
#include <cmath>
#include <stdexcept>
namespace nelyx::flex_layout {
namespace {
[[noreturn]] void reject(){throw std::invalid_argument("Invalid native Flex layout transaction");}
size_t integer(double value,size_t maximum){if(!std::isfinite(value)||value<0||value>double(maximum)||std::floor(value)!=value)reject();return static_cast<size_t>(value);}
double maximum(double a,double b){if(a==0&&b==0)return std::signbit(a)&&std::signbit(b)?-0.:0.;return std::max(a,b);}
double minimum(double a,double b){if(a==0&&b==0)return std::signbit(a)||std::signbit(b)?-0.:0.;return std::min(a,b);}
double clamp(double value,double low,double high){return minimum(maximum(value,low),high);}
}
std::vector<double> run(std::span<const double> in){
  if(in.size()<headerWords||in.size()>headerWords+maxChildren*3||in[0]!=magic||in[1]!=1)reject();
  const auto phase=integer(in[2],1),count=integer(in[3],maxChildren),horizontal=integer(in[4],1),mainSize=integer(in[5],1),crossAlign=integer(in[6],3),mainAlign=integer(in[7],5),flipMain=integer(in[8],1),flipCross=integer(in[9],1);
  if(in.size()!=headerWords+count*3||!std::isfinite(in[10])||in[10]<0||!std::isfinite(in[15])||in[15]<0)reject();
  for(unsigned j=11;j<=14;++j)if(std::isnan(in[j])||in[j]<0||(j%2==1&&!std::isfinite(in[j])))reject();
  if(in[11]>in[12]||in[13]>in[14])reject();
  const double gap=in[10],maxMain=horizontal?in[12]:in[14];
  double used=double(count?count-1:0)*gap,cross=0;
  for(size_t i=0;i<count;++i){const auto at=headerWords+i*3;
    const auto group=integer(in[at+2],2);
    if(!std::isfinite(in[at])||!std::isfinite(in[at+1])||in[at]<0||in[at+1]<0||(phase?group==0:group==2))reject();
    if(group==1){used+=in[at+(horizontal?0:1)];cross=std::max(cross,in[at+(horizontal?1:0)]);}
  }
  if(phase)for(size_t i=0;i<count;++i){const auto at=headerWords+i*3;if(in[at+2]==2){used+=in[at+(horizontal?0:1)];cross=std::max(cross,in[at+(horizontal?1:0)]);}}
  const double space=in[15]?std::max(0.,maxMain-used)/in[15]:0.;
  if(!phase)return {space};
  const auto main=mainSize&&std::isfinite(maxMain)?maxMain:used;
  const auto width=clamp(horizontal?main:cross,in[11],in[12]),height=clamp(horizontal?cross:main,in[13],in[14]);
  if(!std::isfinite(width)||!std::isfinite(height)||!std::isfinite(used))reject();
  const auto free=std::max(0.,(horizontal?width:height)-used);
  double leading=0,between=gap;
  switch(mainAlign){
    case 0:leading=flipMain?free:0;break;
    case 1:leading=flipMain?0:free;break;
    case 2:leading=free/2;break;
    case 3:if(count<2)leading=flipMain?free:0;else between+=free/double(count-1);break;
    case 4:if(!count)leading=flipMain?free:0;else{leading=free/double(count)/2;between+=free/double(count);}break;
    case 5:leading=free/double(count+1);between+=leading;break;
  }
  std::vector<double> out(5+count*2);out[0]=width;out[1]=height;out[2]=used;out[3]=double(flipMain);out[4]=double(count);
  double position=leading;
  for(size_t step=0;step<count;++step){const auto index=flipMain?count-1-step:step,at=headerWords+index*3;
    const double freeCross=(horizontal?height:width)-in[at+(horizontal?1:0)];
    double offset=0;if(crossAlign==2)offset=freeCross/2;else if(crossAlign==0)offset=flipCross?freeCross:0;else if(crossAlign==1)offset=flipCross?0:freeCross;
    out[5+index*2]=horizontal?position:offset;out[6+index*2]=horizontal?offset:position;
    position+=in[at+(horizontal?0:1)]+between;
  }
  return out;
}
}
