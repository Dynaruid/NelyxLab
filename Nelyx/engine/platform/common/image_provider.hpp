// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "../../core/scene/document.hpp"
#include "include/core/SkCanvas.h"
#include "include/core/SkColorFilter.h"
#include "include/core/SkColorSpace.h"
#include "include/core/SkData.h"
#include "include/core/SkImage.h"
#include "include/core/SkPaint.h"

namespace nelyx::v2::native {
inline sk_sp<SkImage> providerImage(const Node& node){
  if(!node.resource)throw std::runtime_error("Image resource missing");
  const auto& bytes=node.resource->bytes;
  sk_sp<SkImage> image;
  if(const auto raw=readRasterImage({bytes.data(),bytes.size()})){
    // RasterFromData retains this shared storage through every recorded Picture.
    // Its Core lease stays live after the producer and preparation have retired.
    auto* hold=new std::shared_ptr<const ResourceStorage>(node.resource->storage);
    auto data=SkData::MakeWithProc(raw->pixels.data,raw->pixels.length,
      [](const void*,void* owner){delete static_cast<std::shared_ptr<const ResourceStorage>*>(owner);},hold);
    image=SkImages::RasterFromData(SkImageInfo::Make(int(raw->width),int(raw->height),kRGBA_8888_SkColorType,kPremul_SkAlphaType,SkColorSpace::MakeSRGB()),std::move(data),raw->rowBytes);
  }else image=SkImages::DeferredFromEncodedData(SkData::MakeWithCopy(bytes.data(),bytes.size()));
  if(!image)throw std::runtime_error("Image decode failed");
  if(node.imageStyle&&(uint32_t(image->width())!=node.imageStyle->width||uint32_t(image->height())!=node.imageStyle->height))
    throw std::runtime_error("Image dimensions differ from the canonical frame");
  return image;
}
inline void paintImage(SkCanvas* canvas,const Node& node,const sk_sp<SkImage>& image,SkPaint& paint){
  if(!node.imageStyle){canvas->drawImageRect(image,SkRect::MakeXYWH(float(node.contentX),float(node.contentY),float(node.contentWidth),float(node.contentHeight)),SkSamplingOptions(),&paint);return;}
  if(!node.imagePaint)throw std::runtime_error("Core image placement missing");
  const auto& plan=*node.imagePaint;const auto& style=plan.style;
  paint.setAntiAlias(style.flags&wire::imageFlags::antialias);
  paint.setColor(SkColorSetARGB(uint32_t(std::floor(std::clamp(style.opacity,0.0,1.0)*255+0.5)),0,0,0));
  paint.setBlendMode(static_cast<SkBlendMode>(style.blend));
  sk_sp<SkColorFilter> filter;
  if(style.flags&wire::imageFlags::tint)filter=SkColorFilters::Blend(style.tint,static_cast<SkBlendMode>(style.colorBlend));
  if(style.flags&wire::imageFlags::invert){
    const float matrix[20]={-1,0,0,0,1,0,-1,0,0,1,0,0,-1,0,1,0,0,0,1,0};
    auto invert=SkColorFilters::Matrix(matrix);filter=filter?SkColorFilters::Compose(std::move(invert),std::move(filter)):std::move(invert);
  }
  paint.setColorFilter(std::move(filter));
  const auto sampling=style.quality==3?SkSamplingOptions(SkCubicResampler::Mitchell()):
    SkSamplingOptions(style.quality?SkFilterMode::kLinear:SkFilterMode::kNearest,style.quality==2?SkMipmapMode::kLinear:SkMipmapMode::kNone);
  const auto rect=[](const Rect& r,double scale=1){return SkRect::MakeXYWH(float(r.x*scale),float(r.y*scale),float(r.width*scale),float(r.height*scale));};
  canvas->save();
  if(plan.clip)canvas->clipRect(SkRect::MakeWH(float(plan.width),float(plan.height)));
  if(plan.flip){canvas->translate(float(plan.width),0);canvas->scale(-1,1);}
  if(plan.nine)canvas->scale(float(1/style.scale),float(1/style.scale));
  for(const auto& tile:plan.tiles){
    if(plan.nine)canvas->drawImageNine(image.get(),SkIRect::MakeLTRB(plan.center[0],plan.center[1],plan.center[2],plan.center[3]),rect(tile.destination,style.scale),style.quality?SkFilterMode::kLinear:SkFilterMode::kNearest,&paint);
    else canvas->drawImageRect(image,rect(tile.source),rect(tile.destination),sampling,&paint,SkCanvas::kFast_SrcRectConstraint);
  }
  canvas->restore();
}
}
