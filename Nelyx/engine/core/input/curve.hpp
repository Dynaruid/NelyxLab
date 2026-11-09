// SPDX-License-Identifier: BSD-3-Clause
// Curve equations and cubic evaluation order follow Source animation/curves.ts
// (Flutter BSD-3-Clause). The native clock executes bounded data, never App code.
#pragma once
#include "../protocol/wire.hpp"
#include <array>
#include <algorithm>

namespace nelyx::v2 {
struct ScrollCurve {
  static constexpr uint32_t none=UINT32_MAX;
  struct Node { uint32_t kind=wire::scrollCurveKinds::linear,first=none,second=none;std::array<double,6> values{}; };
  std::array<Node,wire::limits::scrollCurveNodes> nodes{};
  uint32_t count=0;
  static ScrollCurve read(Reader data) {
    ScrollCurve result;
    if(!data.length)return result;
    require(data.length>=wire::scrollCurveHeaderBytes,wire::statuses::invalidValue);
    const auto length=data.u32(0);
    require(length>0&&length<=wire::limits::scrollCurveNodes&&data.u32(4)==length-1&&
      data.length==wire::scrollCurveHeaderBytes+size_t(length)*wire::scrollCurveNodeBytes,wire::statuses::invalidValue);
    result.count=length;
    std::array<uint32_t,wire::limits::scrollCurveNodes> depths{};
    for(uint32_t i=0;i<length;++i){
      const auto at=wire::scrollCurveHeaderBytes+size_t(i)*wire::scrollCurveNodeBytes;
      auto& node=result.nodes[i];node.kind=data.u32(at);node.first=data.u32(at+4);node.second=data.u32(at+8);
      require(node.kind>=wire::scrollCurveKinds::linear&&node.kind<=wire::scrollCurveKinds::elasticInOut&&data.u32(at+12)==0,wire::statuses::invalidValue);
      const bool split=node.kind==wire::scrollCurveKinds::split;
      const bool unary=node.kind==wire::scrollCurveKinds::interval||node.kind==wire::scrollCurveKinds::flipped;
      require((split||unary)?node.first<i:node.first==none,wire::statuses::invalidValue);
      require(split?node.second<i:node.second==none,wire::statuses::invalidValue);
      depths[i]=(split?std::max(depths[node.first],depths[node.second]):unary?depths[node.first]:0)+1;
      require(depths[i]<=wire::limits::scrollCurveDepth,wire::statuses::invalidValue);
      const uint32_t values=node.kind==wire::scrollCurveKinds::cubic?4:
        (split||node.kind==wire::scrollCurveKinds::interval)?2:
        (node.kind==wire::scrollCurveKinds::threshold||node.kind==wire::scrollCurveKinds::sawTooth||node.kind>=wire::scrollCurveKinds::elasticIn)?1:0;
      for(uint32_t j=0;j<6;++j){if(j<values)node.values[j]=data.f64(at+16+size_t(j)*8);else require(data.u64(at+16+size_t(j)*8)==0,wire::statuses::invalidValue);}
      if(split)require(node.values[0]>=0&&node.values[0]<=1,wire::statuses::invalidValue);
      if(node.kind==wire::scrollCurveKinds::interval)require(node.values[0]>=0&&node.values[1]<=1&&node.values[0]<node.values[1],wire::statuses::invalidValue);
      if(node.kind==wire::scrollCurveKinds::threshold)require(node.values[0]>=0&&node.values[0]<=1,wire::statuses::invalidValue);
      if(node.kind>=wire::scrollCurveKinds::elasticIn)require(std::abs(node.values[0])>=1e-6,wire::statuses::invalidValue);
    }
    std::array<bool,wire::limits::scrollCurveNodes> used{};
    const auto visit=[&](const auto& self,uint32_t index)->void{if(used[index])return;used[index]=true;
      const auto& node=result.nodes[index];if(node.first!=none)self(self,node.first);if(node.second!=none)self(self,node.second);};
    visit(visit,length-1);for(uint32_t i=0;i<length;++i)require(used[i],wire::statuses::invalidValue);
    return result;
  }
  static double cubic(double a,double b,double c,double d,double t){
    const auto value=[](double first,double second,double m){return 3*first*(1-m)*(1-m)*m+3*second*(1-m)*m*m+m*m*m;};
    double start=0,end=1;
    for(uint32_t i=0;i<1076;++i){const auto midpoint=(start+end)/2,estimate=value(a,c,midpoint);
      if(std::abs(t-estimate)<0.001)return value(b,d,midpoint);
      if(midpoint==start||midpoint==end)break;if(estimate<t)start=midpoint;else end=midpoint;}
    throw Error{wire::statuses::invalidValue};
  }
  static double bounce(double t){
    if(t<1/2.75)return 7.5625*t*t;
    if(t<2/2.75){t-=1.5/2.75;return 7.5625*t*t+0.75;}
    if(t<2.5/2.75){t-=2.25/2.75;return 7.5625*t*t+0.9375;}
    t-=2.625/2.75;return 7.5625*t*t+0.984375;
  }
  double at(uint32_t index,double t)const {
    if(t==0||t==1)return t;
    const auto& node=nodes[index];const auto& v=node.values;
    switch(node.kind){
      case wire::scrollCurveKinds::linear:return t;
      case wire::scrollCurveKinds::cubic:return cubic(v[0],v[1],v[2],v[3],t);
      case wire::scrollCurveKinds::split:if(t==v[0])return v[1];return t<v[0]?at(node.first,t/v[0])*v[1]:at(node.second,(t-v[0])/(1-v[0]))*(1-v[1])+v[1];
      case wire::scrollCurveKinds::interval:return at(node.first,std::clamp((t-v[0])/(v[1]-v[0]),0.0,1.0));
      case wire::scrollCurveKinds::flipped:return 1-at(node.first,1-t);
      case wire::scrollCurveKinds::threshold:return t<v[0]?0:1;
      case wire::scrollCurveKinds::sawTooth:{const auto value=t*v[0];return value-std::trunc(value);}
      case wire::scrollCurveKinds::decelerate:t=1-t;return 1-t*t;
      case wire::scrollCurveKinds::bounceIn:return 1-bounce(1-t);
      case wire::scrollCurveKinds::bounceOut:return bounce(t);
      case wire::scrollCurveKinds::bounceInOut:return t<0.5?(1-bounce(1-t*2))*0.5:bounce(t*2-1)*0.5+0.5;
      default:{constexpr double pi=3.14159265358979323846;const double period=v[0],shift=period/4;
        if(node.kind==wire::scrollCurveKinds::elasticIn){t-=1;return -std::pow(2,10*t)*std::sin(((t-shift)*(pi*2))/period);}
        if(node.kind==wire::scrollCurveKinds::elasticOut)return std::pow(2,-10*t)*std::sin(((t-shift)*(pi*2))/period)+1;
        t=2*t-1;return t<0?-0.5*std::pow(2,10*t)*std::sin(((t-shift)*(pi*2))/period):std::pow(2,-10*t)*std::sin(((t-shift)*(pi*2))/period)*0.5+1;}
    }
  }
  double evaluate(double t)const {const auto value=count?at(count-1,t):t;require(std::isfinite(value),wire::statuses::invalidValue);return value;}
};
}
