// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "../../core/state.hpp"
#include "include/core/SkBitmap.h"
#include "include/core/SkCanvas.h"
#include "include/core/SkColorSpace.h"
#include "include/core/SkData.h"
#include "include/core/SkSurface.h"
#include "include/codec/SkCodec.h"
#include "include/codec/SkPngDecoder.h"
#include "include/codec/SkJpegDecoder.h"
#include "include/codec/SkGifDecoder.h"
#include "include/codec/SkWebpDecoder.h"
#include <functional>
#include <map>

namespace nelyx::v2::native {
struct AppImmutableData {
  std::unique_ptr<ExternalLease> memory;
  sk_sp<SkData> bytes;
};
/** App-thread-only CPU decoding. Each public descriptor, codec, frame and JSI
 * read owns its storage independently; no SkImage/SkCodec enters another actor. */
class AppImages {
 public:
  static constexpr uint64_t residentLimit=64*1024*1024;
  struct Raw {int width=0,height=0;uint64_t rowBytes=0;bool bgra=false;};
  struct Descriptor {
    std::unique_ptr<ExternalLease> memory;
    std::shared_ptr<AppImmutableData> source;
    Raw raw;
    int width=0,height=0,bytesPerPixel=4;
    bool encoded=false;
  };
  struct Codec {
    std::unique_ptr<ExternalLease> memory;
    std::shared_ptr<Descriptor> descriptor;
    std::unique_ptr<SkCodec> codec;
    int width=0,height=0,frameCount=1,repetitionCount=0,index=0;
    bool failed=false;
  };
  struct Frame {
    std::unique_ptr<ExternalLease> memory;
    SkBitmap bitmap;
    int duration=0;
  };
  struct Slice {std::shared_ptr<Frame> storage;Reader bytes;};
  uint64_t descriptorCreates=0,codecCreates=0,frameDecodes=0,pixelReads=0,pixelReadBytes=0;
  std::map<uint64_t,std::shared_ptr<Descriptor>> descriptors;
  std::map<uint64_t,std::shared_ptr<Codec>> codecs;
  std::map<uint64_t,std::shared_ptr<Frame>> frames;
  struct Readback {uint64_t size;bool delivered=false;std::unique_ptr<ExternalLease> memory;};
  std::map<uint64_t,Readback> readbacks;
  struct SceneCredit {uint64_t size;std::unique_ptr<ExternalLease> memory;};
  std::map<uint64_t,SceneCredit> scenes;
  uint64_t sceneSnapshotCreates=0;
 private:
  std::shared_ptr<Ledger> ledger;
  std::function<uint64_t()> ownerBytes;
  uint64_t& next;
  std::vector<std::weak_ptr<Descriptor>> descriptorAllocations;
  std::vector<std::weak_ptr<Codec>> codecAllocations;
  std::vector<std::weak_ptr<Frame>> frameAllocations;
  template<class T> static uint64_t bytes(const std::vector<std::weak_ptr<T>>& values){
    uint64_t result=0;for(const auto& weak:values)if(const auto value=weak.lock())result+=value->memory->bytes;return result;
  }
  template<class T> static std::shared_ptr<T> find(const std::map<uint64_t,std::shared_ptr<T>>& values,uint64_t id){
    const auto found=values.find(id);if(found==values.end())throw std::runtime_error("App image handle is foreign/retired/wrong kind");return found->second;
  }
  std::unique_ptr<ExternalLease> reserve(uint64_t size){
    const auto held=ownerBytes(),resident=reservedBytes()-sceneCreditBytes();
    if(next>=9007199254740991ull||resident>residentLimit||size>residentLimit-resident||
      held>320*1024*1024||size>320*1024*1024-held)throw std::runtime_error("App image resident/owner memory budget exceeded");
    return std::make_unique<ExternalLease>(ledger,6,4,size);
  }
  static std::unique_ptr<SkCodec> decode(const sk_sp<SkData>& data){
    // App decoding must not mutate the process-global, non-thread-safe codec
    // registry while the independent Content owner is starting/decoding.
    static constexpr SkCodecs::Decoder decoders[]={SkPngDecoder::Decoder(),SkJpegDecoder::Decoder(),SkGifDecoder::Decoder(),SkWebpDecoder::Decoder()};
    auto result=SkCodec::MakeFromData(data,SkSpan<const SkCodecs::Decoder>(decoders));
    if(!result)throw std::runtime_error("App encoded image descriptor is invalid/unsupported");return result;
  }
 public:
  AppImages(std::shared_ptr<Ledger> ledger,std::function<uint64_t()> total,uint64_t& sequence)
    :ledger(std::move(ledger)),ownerBytes(std::move(total)),next(sequence){}
  static void dimensions(uint64_t width,uint64_t height){
    if(!width||!height||width>8192||height>8192||width*height>16*1024*1024)
      throw std::runtime_error("App image dimension/pixel budget exceeded");
  }
  uint64_t readbackBytes()const{uint64_t size=0;for(const auto& [id,value]:readbacks)size+=value.memory->bytes;return size;}
  uint64_t sceneCreditBytes()const{uint64_t size=0;for(const auto& [id,value]:scenes)size+=value.memory->bytes;return size;}
  uint64_t sceneDataBytes()const{uint64_t size=0;for(const auto& [id,value]:scenes)size+=value.size;return size;}
  uint64_t reservedBytes()const{return bytes(descriptorAllocations)+bytes(codecAllocations)+bytes(frameAllocations)+readbackBytes()+sceneCreditBytes();}
  uint64_t reserveScene(uint64_t size){
    const auto held=ownerBytes(),total=sceneDataBytes();
    if(size<32||size>wire::limits::resourceBytes||total>wire::limits::resourceBytes-size||scenes.size()>=64||next>=9007199254740991ull)
      throw std::runtime_error("App image scene count/byte budget exceeded");
    const auto credit=3*size+2*wire::limits::imageChunkBytes+65536;
    if(held>320*1024*1024||credit>320*1024*1024-held)throw std::runtime_error("App image scene owner memory budget exceeded");
    auto memory=std::make_unique<ExternalLease>(ledger,6,4,credit);const auto token=++next;
    scenes.emplace(token,SceneCredit{size,std::move(memory)});++sceneSnapshotCreates;return token;
  }
  void releaseScene(uint64_t id){if(!scenes.erase(id))throw std::runtime_error("App image scene credit is foreign/retired/wrong kind");}
  bool live()const{return !descriptors.empty()||!codecs.empty()||!frames.empty()||reservedBytes()!=readbackBytes()||
    std::any_of(readbacks.begin(),readbacks.end(),[](const auto& value){return !value.second.delivered;});}
  uint64_t reserveReadback(uint64_t size){
    uint64_t total=0;for(const auto& [id,value]:readbacks)total+=value.size;
    if(size>32*1024*1024||total>32*1024*1024-size||readbacks.size()>=64)throw std::runtime_error("App image readback count/byte budget exceeded");
    auto memory=reserve(3*size+65536);const auto id=++next;readbacks.emplace(id,Readback{size,false,std::move(memory)});return id;
  }
  void finishReadback(uint64_t id,bool delivered){
    const auto found=readbacks.find(id);if(found==readbacks.end()||found->second.delivered)throw std::runtime_error("App image readback is foreign/delivered");
    if(delivered)found->second.delivered=true;else readbacks.erase(found);
  }
  std::shared_ptr<Descriptor> descriptor(uint64_t id)const{return find(descriptors,id);}
  std::shared_ptr<Codec> codec(uint64_t id)const{return find(codecs,id);}
  std::shared_ptr<Frame> frame(uint64_t id)const{return find(frames,id);}
  uint64_t createDescriptor(std::shared_ptr<AppImmutableData> source,std::optional<Raw> raw){
    std::erase_if(descriptorAllocations,[](const auto& value){return value.expired();});
    if(descriptors.size()>=32||descriptorAllocations.size()>=32)throw std::runtime_error("App image descriptor count budget exceeded");
    const auto size=source->bytes->size();
    if(!size||(!raw&&size>16*1024*1024))throw std::runtime_error("App image encoded byte budget exceeded");
    if(raw){dimensions(raw->width,raw->height);
      if(raw->rowBytes<uint64_t(raw->width)*4||raw->rowBytes>32*1024*1024||
        uint64_t(raw->height-1)*raw->rowBytes+uint64_t(raw->width)*4>size)
        throw std::runtime_error("App raw image row/buffer bounds differ");}
    auto value=std::make_shared<Descriptor>();value->memory=reserve(512*1024+(raw?0:size));value->source=std::move(source);
    if(raw){value->raw=*raw;value->width=raw->width;value->height=raw->height;}
    else{auto probe=decode(value->source->bytes);const auto info=probe->getInfo();dimensions(info.width(),info.height());
      if(probe->getFrameCount()<1||probe->getFrameCount()>4096)throw std::runtime_error("App image frame count budget exceeded");
      value->encoded=true;value->width=info.width();value->height=info.height();value->bytesPerPixel=info.bytesPerPixel();}
    const auto id=++next;descriptorAllocations.push_back(value);descriptors.emplace(id,value);++descriptorCreates;return id;
  }
  uint64_t instantiateCodec(uint64_t id,uint64_t width,uint64_t height){
    auto source=descriptor(id);dimensions(width,height);
    std::erase_if(codecAllocations,[](const auto& value){return value.expired();});
    if(codecs.size()>=32||codecAllocations.size()>=32)throw std::runtime_error("App image codec count budget exceeded");
    auto value=std::make_shared<Codec>();
    value->memory=reserve(uint64_t(source->width)*source->height*12+width*height*4+65536);
    value->descriptor=source;value->width=int(width);value->height=int(height);
    if(source->encoded){value->codec=decode(source->source->bytes);value->frameCount=value->codec->getFrameCount();
      if(value->frameCount<1||value->frameCount>4096)throw std::runtime_error("App image frame count budget exceeded");
      value->repetitionCount=value->frameCount==1?0:value->codec->getRepetitionCount();}
    const auto token=++next;codecAllocations.push_back(value);codecs.emplace(token,value);++codecCreates;return token;
  }
  uint64_t nextFrame(uint64_t id){
    auto value=codec(id);const auto source=value->descriptor;
    if(value->failed)throw std::runtime_error("App image codec failed; dispose before decoding again");
    std::erase_if(frameAllocations,[](const auto& entry){return entry.expired();});
    if(frames.size()>=64||frameAllocations.size()>=64)throw std::runtime_error("App image frame count budget exceeded");
    auto output=std::make_shared<Frame>();output->memory=reserve(uint64_t(value->width)*value->height*4+65536);
    try{
    const auto info=SkImageInfo::Make(value->width,value->height,kRGBA_8888_SkColorType,kPremul_SkAlphaType,SkColorSpace::MakeSRGB());
    if(!output->bitmap.tryAllocPixels(info))throw std::runtime_error("App image frame allocation failed");
    SkBitmap decoded;SkPixmap input;
    if(value->codec){
      const auto natural=info.makeDimensions(SkISize::Make(source->width,source->height));
      if(!decoded.tryAllocPixels(natural))throw std::runtime_error("App image decode allocation failed");
      SkCodec::Options options;options.fFrameIndex=value->index;options.fMaxDecodeMemory=32*1024*1024;
      if(value->codec->getPixels(natural,decoded.getPixels(),decoded.rowBytes(),&options)!=SkCodec::kSuccess)
        throw std::runtime_error("App image frame decode failed/incomplete");
      if(value->frameCount>1){SkCodec::FrameInfo frame;
        if(!value->codec->getFrameInfo(value->index,&frame)||!frame.fFullyReceived)throw std::runtime_error("App image frame metadata incomplete");
        output->duration=frame.fDuration;}
      input=decoded.pixmap();
    }else input=SkPixmap(SkImageInfo::Make(source->width,source->height,source->raw.bgra?kBGRA_8888_SkColorType:kRGBA_8888_SkColorType,
      kPremul_SkAlphaType,SkColorSpace::MakeSRGB()),source->source->bytes->data(),size_t(source->raw.rowBytes));
    if(!input.scalePixels(output->bitmap.pixmap(),SkSamplingOptions(SkFilterMode::kLinear)))
      throw std::runtime_error("App image frame resize failed");
    value->index=(value->index+1)%value->frameCount;
    const auto token=++next;frameAllocations.push_back(output);frames.emplace(token,output);++frameDecodes;return token;
    }catch(...){value->failed=true;throw;}
  }
  Slice chunk(uint64_t id,uint64_t offset,uint64_t size){
    auto value=frame(id);const auto length=uint64_t(value->bitmap.width())*value->bitmap.height()*4;
    if(size>256*1024||offset>length||size>length-offset)throw std::runtime_error("App image chunk is outside a live frame");
    if(value->bitmap.rowBytes()!=size_t(value->bitmap.width())*4)throw std::runtime_error("App image row is not packed");
    ++pixelReads;pixelReadBytes+=size;const auto* pixels=static_cast<const uint8_t*>(value->bitmap.getPixels());
    return {value,Reader{size?pixels+offset:nullptr,size_t(size)}};
  }
  void releaseDescriptor(uint64_t id){if(!descriptors.erase(id))throw std::runtime_error("App image descriptor is foreign/retired");}
  void releaseCodec(uint64_t id){if(!codecs.erase(id))throw std::runtime_error("App image codec is foreign/retired");}
  void releaseFrame(uint64_t id){if(!frames.erase(id))throw std::runtime_error("App image frame is foreign/retired");}
};
}
