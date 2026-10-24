// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "nelyx_skia/core.h"
#include "include/effects/SkGradient.h"
#include "include/effects/SkImageFilters.h"
#include "include/effects/SkRuntimeEffect.h"
#include "include/core/SkData.h"
#include "include/core/SkColorFilter.h"
#include "include/core/SkMaskFilter.h"
#include <cmath>
#include <cstring>
#include <vector>
#include <stdexcept>
#include <algorithm>

namespace nelyx::skia_core::detail {
inline uint32_t effectU32(const uint8_t* bytes){uint32_t result;std::memcpy(&result,bytes,4);return result;}
inline float effectF32(const uint8_t* bytes){float result;std::memcpy(&result,bytes,4);if(!std::isfinite(result))throw std::runtime_error("non-finite paint effect");return result;}
inline void effectRequire(bool condition,const char* reason){if(!condition)throw std::runtime_error(reason);}
inline SkSamplingOptions effectSampling(uint32_t quality){effectRequire(quality<=3,"invalid effect quality");if(quality==3)return SkSamplingOptions(SkCubicResampler::Mitchell());return SkSamplingOptions(quality==0?SkFilterMode::kNearest:SkFilterMode::kLinear,quality==2?SkMipmapMode::kLinear:SkMipmapMode::kNone);}
struct EffectCursor {
 const uint8_t* bytes;uint32_t index,end,nodes=0;
 const uint8_t* take(uint32_t op){effectRequire(index<end,"truncated paint effect");const auto* row=bytes+64+static_cast<size_t>(index++)*48;effectRequire(effectU32(row)==op&&effectU32(row+44)==0,"invalid paint effect row");for(int n=0;n<6;++n)effectF32(row+8+n*4);return row;}
 const uint8_t* node(){effectRequire(++nodes<=64,"paint effect node budget");return take(28);}
 static void padding(const uint8_t* row,int floats){for(int n=floats;n<6;++n)effectRequire(effectF32(row+8+n*4)==0,"paint effect padding");}
 std::vector<float> data(uint32_t count){std::vector<float> values;values.reserve(count);while(values.size()<count){const auto* row=take(30);effectRequire(!effectU32(row+4)&&!effectU32(row+32)&&!effectU32(row+36)&&!effectU32(row+40),"effect matrix reserved field");const int used=static_cast<int>(std::min<size_t>(6,count-values.size()));for(int n=0;n<used;++n)values.push_back(effectF32(row+8+n*4));padding(row,used);}return values;}
 SkMatrix matrix(){const auto v=data(16);return SkMatrix::MakeAll(v[0],v[4],v[12],v[1],v[5],v[13],v[3],v[7],v[15]);}
 static void emptyAux(const uint8_t* row){effectRequire(!effectU32(row+36)&&!effectU32(row+40),"paint effect auxiliary field");}
 sk_sp<SkColorFilter> color(const uint8_t* row){const auto kind=effectU32(row+4),flags=effectU32(row+32);padding(row,0);
  if(kind==10){effectRequire(flags<=28&&!effectU32(row+40),"invalid color mode");return SkColorFilters::Blend(effectU32(row+36),static_cast<SkBlendMode>(flags));}
  emptyAux(row);effectRequire(!flags,"color filter flags");
  if(kind==11){auto values=data(20);for(int n=4;n<20;n+=5)values[n]/=255;return SkColorFilters::Matrix(values.data());}
  if(kind==12)return SkColorFilters::LinearToSRGBGamma();if(kind==13)return SkColorFilters::SRGBToLinearGamma();throw std::runtime_error("invalid color filter type");
 }
 sk_sp<SkImageFilter> image(uint32_t depth=0,SkTileMode dynamicMode=SkTileMode::kDecal){effectRequire(depth<=16,"image filter depth budget");const auto* row=node();const auto kind=effectU32(row+4),flags=effectU32(row+32);
  if(kind>=10&&kind<=13)return SkImageFilters::ColorFilter(color(row),nullptr);
  emptyAux(row);
  if(kind==20){padding(row,2);effectRequire((flags&~15u)==0&&(flags&7u)<=4&&effectF32(row+8)>=0&&effectF32(row+12)>=0,"invalid blur");if(flags&8u){const auto bounds=data(4);effectRequire(bounds[2]>=0&&bounds[3]>=0,"invalid blur bounds");throw std::runtime_error("bounded normalized blur not implemented by this Skia backend");}const auto mode=(flags&7u)==4?dynamicMode:static_cast<SkTileMode>(flags&7u);return SkImageFilters::Blur(effectF32(row+8),effectF32(row+12),mode,nullptr);}
  if(kind==21||kind==22){padding(row,2);effectRequire(!flags&&effectF32(row+8)>=0&&effectF32(row+12)>=0,"invalid morphology filter");return kind==21?SkImageFilters::Dilate(effectF32(row+8),effectF32(row+12),nullptr):SkImageFilters::Erode(effectF32(row+8),effectF32(row+12),nullptr);}
  padding(row,0);
  if(kind==23){effectRequire(flags<=3,"invalid matrix filter quality");const auto m=matrix();return SkImageFilters::MatrixTransform(m,effectSampling(flags),nullptr);}
  if(kind==24){effectRequire(!flags,"invalid compose filter flags");auto outer=image(depth+1,SkTileMode::kClamp);auto inner=image(depth+1,SkTileMode::kClamp);return SkImageFilters::Compose(std::move(outer),std::move(inner));}
  throw std::runtime_error("invalid image filter type");
 }
 sk_sp<SkShader> shader(FrameResources& resources,uint32_t quality,RuntimeProgramCache& programs){const auto* row=node();const auto kind=effectU32(row+4),flags=effectU32(row+32);sk_sp<SkShader> result;
  if(kind==5){
   padding(row,0);effectRequire(effectU32(bytes+4)>=11,"runtime shader requires wire11");const auto length=effectU32(row+36),count=effectU32(row+40);
   effectRequire(!flags&&length>0&&length<=16384&&count<=256,"invalid runtime shader budget");
   const auto packed=data((length+2)/3);std::string source;source.reserve(length);
   for(const float value:packed){effectRequire(value>=0&&value<=16777215&&std::floor(value)==value,"invalid packed runtime source");const auto word=static_cast<uint32_t>(value);for(int n=0;n<3;++n){const auto ch=(word>>(n*8))&255;if(source.size()<length){effectRequire(ch==9||ch==10||ch==13||(ch>=32&&ch<=126),"invalid runtime source character");source.push_back(static_cast<char>(ch));}else effectRequire(!ch,"runtime source padding");}}
   auto values=data(count);auto program=programs.get(source);
   effectRequire(program->uniformSize()==values.size()*sizeof(float),"runtime shader uniform count mismatch");
   result=program->makeShader(SkData::MakeWithCopy(values.data(),values.size()*sizeof(float)),SkSpan<const SkRuntimeEffect::ChildPtr>{});
  }
  else if(kind==4){padding(row,0);effectRequire((flags&~127u)==0&&(flags>>4)<=4&&effectU32(row+36)>0&&effectU32(row+40)>0,"invalid image shader");const auto m=matrix();auto native=resources.image(effectU32(row+36),effectU32(row+40));effectRequire(static_cast<bool>(native),"missing shader image");result=native->makeShader(static_cast<SkTileMode>(flags&3),static_cast<SkTileMode>((flags>>2)&3),effectSampling((flags>>4)==4?quality:flags>>4),&m);}
  else{effectRequire(kind>=1&&kind<=3&&(flags&~7u)==0&&!effectU32(row+40),"invalid gradient header");const auto count=effectU32(row+36);effectRequire(count>0&&count<=256,"gradient color budget");if(kind!=2)padding(row,4);else effectRequire(effectF32(row+16)>=0&&effectF32(row+28)>=0,"negative gradient radius");if(kind==3)effectRequire(effectF32(row+16)<effectF32(row+20),"invalid sweep angles");std::vector<SkColor4f> colors;std::vector<float> stops;colors.reserve(count);stops.reserve(count);for(uint32_t n=0;n<count;++n){const auto* stop=take(29);effectRequire(!effectU32(stop+32)&&!effectU32(stop+36)&&!effectU32(stop+40),"invalid gradient stop flags");padding(stop,1);colors.push_back(SkColor4f::FromColor(effectU32(stop+4)));stops.push_back(effectF32(stop+8));}
   const SkMatrix m=(flags&4u)?matrix():SkMatrix::I();const auto mode=static_cast<SkTileMode>(flags&3);
   const SkGradient gradient(SkGradient::Colors(SkSpan(colors),SkSpan(stops),mode),SkGradient::Interpolation::FromFlags(0));
   if(kind==1){const SkPoint points[]={{effectF32(row+8),effectF32(row+12)},{effectF32(row+16),effectF32(row+20)}};result=SkShaders::LinearGradient(points,gradient,&m);}
   else if(kind==2){const SkPoint start={effectF32(row+8),effectF32(row+12)},end={effectF32(row+20),effectF32(row+24)};const auto r0=effectF32(row+16),r1=effectF32(row+28);result=(start==end&&r0==0)?SkShaders::RadialGradient(end,r1,gradient,&m):SkShaders::TwoPointConicalGradient(start,r0,end,r1,gradient,&m);}
   else result=SkShaders::SweepGradient(SkPoint::Make(effectF32(row+8),effectF32(row+12)),effectF32(row+16)*180.0f/3.14159265358979323846f,effectF32(row+20)*180.0f/3.14159265358979323846f,gradient,&m);
  }
  effectRequire(static_cast<bool>(result),"shader creation failed");return result;
 }
};
struct PaintEffects {
 uint32_t end;bool dither=false;sk_sp<SkShader> shader;sk_sp<SkColorFilter> color;sk_sp<SkImageFilter> image;sk_sp<SkMaskFilter> mask;
 void apply(SkPaint& paint)const{paint.setShader(shader);paint.setColorFilter(color);paint.setImageFilter(image);paint.setMaskFilter(mask);paint.setDither(dither);}
};
inline PaintEffects decodePaintEffects(const uint8_t* bytes,uint32_t count,uint32_t index,FrameResources& resources,RuntimeProgramCache& programs){
 const auto* header=bytes+64+static_cast<size_t>(index)*48;const auto flags=effectU32(header+32);effectRequire(!effectU32(header+4)&&!(flags&~15u)&&!effectU32(header+36)&&!effectU32(header+40)&&!effectU32(header+44),"invalid effects block header");EffectCursor::padding(header,4);PaintEffects result{};result.dither=(flags&8u)!=0;uint32_t current=index+1;
 for(int slot=0;slot<4;++slot){const auto number=effectF32(header+8+slot*4);effectRequire(number>=0&&number<=4096&&std::floor(number)==number&&number<=count-current,"invalid effect segment count");const auto end=current+static_cast<uint32_t>(number);if(end==current)continue;EffectCursor cursor{bytes,current,end};
  if(slot==0)result.shader=cursor.shader(resources,flags&3u,programs);else if(slot==1)result.color=cursor.color(cursor.node());else if(slot==2)result.image=cursor.image();else{const auto* row=cursor.node();EffectCursor::padding(row,1);EffectCursor::emptyAux(row);effectRequire(effectU32(row+4)==30&&effectU32(row+32)<=3&&effectF32(row+8)>=0,"invalid mask filter");result.mask=SkMaskFilter::MakeBlur(static_cast<SkBlurStyle>(effectU32(row+32)),effectF32(row+8),true);}
  effectRequire(cursor.index==end,"paint effect segment length mismatch");current=end;
 }
 if(flags&4u){constexpr float inversion[]={-1,0,0,0,1,0,-1,0,0,1,0,0,-1,0,1,0,0,0,1,0};auto invert=SkColorFilters::Matrix(inversion);result.color=result.color?SkColorFilters::Compose(std::move(invert),result.color):std::move(invert);}
 result.end=current;return result;
}
}
