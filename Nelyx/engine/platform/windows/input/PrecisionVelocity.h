// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <array>
#include <algorithm>
#include <cmath>

namespace nelyx::v2::windows {
// DirectManipulation may emit a final unchanged transform and batches samples
// on the UI timer. Estimate velocity from a short position history instead of
// replacing it with that last zero delta or dividing by callback dispatch time.
class PrecisionVelocity {
  struct Sample {double at=0,position=0;};
  std::array<Sample,8> samples_{};
  size_t count_=0;
  double position_=0,lastMotion_=0;
  bool moved_=false;
public:
  void begin(double at){count_=1;position_=0;lastMotion_=at;moved_=false;samples_[0]={at,0};}
  void update(double at,double delta){
    if(!std::isfinite(at)||!std::isfinite(delta))return;
    if(!count_)begin(at);
    if(at<samples_[count_-1].at)return;
    position_+=delta;
    if(std::abs(delta)>1e-6){lastMotion_=at;moved_=true;}
    if(at==samples_[count_-1].at){samples_[count_-1].position=position_;return;}
    while(count_>1&&at-samples_[0].at>.1){std::move(samples_.begin()+1,samples_.begin()+count_,samples_.begin());--count_;}
    if(count_==samples_.size()){std::move(samples_.begin()+1,samples_.end(),samples_.begin());--count_;}
    samples_[count_++]={at,position_};
  }
  double value(double at)const{
    if(!moved_||count_<2||at-lastMotion_>.08)return 0;
    const auto origin=samples_[count_-1];double x=0,y=0,xx=0,xy=0;
    for(size_t i=0;i<count_;++i){const auto t=samples_[i].at-origin.at,p=samples_[i].position-origin.position;x+=t;y+=p;xx+=t*t;xy+=t*p;}
    const auto divisor=count_*xx-x*x;
    if(divisor<1e-10)return 0;
    return std::clamp((count_*xy-x*y)/divisor,-1e6,1e6);
  }
  void cancel(){count_=0;moved_=false;}
};
// A horizontal month/page gesture needs the same velocity/prefetch contract
// as a vertical list. Sampling only deltaY silently reports zero for it.
class PrecisionPanVelocity {
  PrecisionVelocity horizontal_,vertical_;
public:
  void begin(double at){horizontal_.begin(at);vertical_.begin(at);}
  void update(double at,double dx,double dy){horizontal_.update(at,dx);vertical_.update(at,dy);}
  double value(double at)const{
    const auto x=horizontal_.value(at),y=vertical_.value(at);
    return std::abs(x)>std::abs(y)?x:y;
  }
  void cancel(){horizontal_.cancel();vertical_.cancel();}
};
}
