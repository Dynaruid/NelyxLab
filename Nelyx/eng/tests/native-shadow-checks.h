// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <cmath>
#include <iostream>
#include "nelyx_skia/core.h"
#include "nelyx_skia/gpu_context.h"
#include "include/core/SkPathBuilder.h"
#include "include/core/SkPictureRecorder.h"
#include "include/core/SkPixmap.h"

static void elevationShadowChecks(nelyx::gpu::Context& gpu){
  constexpr int width=512,height=256;
  SkPaint fill;fill.setAntiAlias(true);fill.setColor(0xffeeeeee);
  const auto rounded=SkRRect::MakeRectXY(SkRect::MakeWH(106.269775390625f,32),16,16);
  SkPathBuilder builder;builder.addRRect(rounded);const auto path=builder.detach();
  auto deferred=gpu.makeRecorder();
  for(float dpr:{1.f,1.25f,1.5f,2.f})for(bool retained:{false,true}){
    unsigned previous=0;float previousElevation=3;bool first=true;
    // Actual gallery pointer press/hover-exit and release samples at 60 Hz.
    // A 16 ms-only sweep missed the remaining bright flash at elevation 1.1586084.
    // Finish with zero elevation to cover disappearing Material shadows too.
    for(float elevation:{3.f,2.9652863f,2.8294811f,2.5260279f,2.0819495f,1.7107565f,1.448839f,1.2738979f,1.1586084f,1.0808794f,1.0330451f,1.0076448f,1.f,
      1.0347137f,1.1705189f,1.4739721f,1.9180505f,2.2892435f,2.551161f,2.7261021f,2.8413916f,2.9191206f,2.9669549f,2.9923552f,3.f,1.f,.75f,.25f,0.f}){
      auto surface=gpu.MakeOffscreen(width,height);require(bool(surface),"Button shadow surface missing");
      auto canvas=deferred->makeDeferredCanvas(surface->imageInfo(),gpu.textureInfo(surface->imageInfo().colorType()));
      require(canvas,"Button shadow canvas missing");canvas->clear(SK_ColorWHITE);canvas->scale(dpr,dpr);canvas->translate(60.25f,40.75f);
      const auto paint=[&](SkCanvas* target){if(elevation>0)nelyx::skia_core::drawShadow(*target,path,SK_ColorBLACK,elevation,false,dpr);target->drawPath(path,fill);};
      if(retained){
        SkPictureRecorder recorder;paint(recorder.beginRecording(SkRect::MakeLTRB(-32,-32,512,256)));
        // Exercise retained picture replay rather than SkPicture's inline path.
        for(int i=0;i<64;++i)recorder.getRecordingCanvas()->drawRect(SkRect::MakeXYWH(4000+i*4,4000,1,1),fill);
        nelyx::skia_core::drawPicture(*canvas,recorder.finishRecordingAsPicture());
      }else paint(canvas);
      auto frame=deferred->snap(),initial=surface->recorder()->snap();
      if(initial)gpu.submitRecording(initial.get());
      require(frame&&gpu.insertRecordings({frame.get()},surface.get()),"Button shadow recording rejected");
      auto image=surface->makeImageSnapshot();auto recording=surface->recorder()->snap();
      if(recording)gpu.submitRecording(recording.get());
      auto raster=gpu.MakeRasterImage(image);SkPixmap pixels;
      require(raster&&raster->peekPixels(&pixels),"Button shadow pixels missing");
      unsigned mass=0;
      // Outside the body, only the shadow can darken the white background.
      for(int y=0;y<height;++y)for(int x=0;x<width;++x)if(x<std::floor(60.25f*dpr)||x>=std::ceil(166.52f*dpr)||y<std::floor(40.75f*dpr)||y>=std::ceil(72.75f*dpr))mass+=255-SkColorGetR(pixels.getColor(x,y));
      const bool continuous=first||(elevation<=previousElevation?mass<=previous*1.05+64:mass+64>=previous*.95);
      if(!continuous)std::cerr<<"Button shadow dpr="<<dpr<<" retained="<<retained<<" elevation="<<elevation<<" mass="<<mass<<" previous="<<previous<<'\n';
      require(continuous,"Button shadow brightness reversed during its elevation animation");
      require(elevation<1||mass>0,"Elevated button shadow disappeared at positive elevation");
      require(elevation!=0||mass==0,"Button shadow remained at zero elevation");
      previous=mass;previousElevation=elevation;first=false;
    }
  }
  deferred.reset();require(gpu.retireWork(),"Button shadow GPU work did not drain");
  std::cout<<"PASS actual Vulkan press/release/hover-exit shadows remain continuous at DPR1/1.25/1.5/2 in direct and retained pictures\n";
}
