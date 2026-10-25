#pragma once

#include <memory>
#include <cmath>
#include <cstring>
#include <algorithm>
#include <cstdint>
#include <string>
#include <utility>

#include <jsi/jsi.h>

#include "JsiSkNativeObjects.h"

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdocumentation"

#include "include/core/SkFont.h"
#include "include/core/SkStream.h"

#pragma clang diagnostic pop

namespace RNSkia {

namespace jsi = facebook::jsi;

// SHA-256 (FIPS 180-4), over immutable SkData storage without a JS byte walk.
inline std::string nelyxDataSha256(const SkData &data) {
  constexpr uint32_t constants[64] = {
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  };
  uint32_t state[8] = {0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19};
  const auto rotate=[](uint32_t value,unsigned bits){return (value>>bits)|(value<<(32-bits));};
  const auto bytes=data.bytes();
  const size_t length=data.size(),blocks=(length+9+63)/64;
  const uint64_t bitLength=static_cast<uint64_t>(length)*8;
  for(size_t index=0;index<blocks;index++) {
    uint8_t block[64]={};uint32_t words[64];const size_t start=index*64;
    if(start<length)std::memcpy(block,bytes+start,std::min(size_t{64},length-start));
    if(start<=length && length<start+64)block[length-start]=0x80;
    if(index==blocks-1)for(unsigned i=0;i<8;i++)block[63-i]=static_cast<uint8_t>(bitLength>>(i*8));
    for(unsigned i=0;i<16;i++)words[i]=(uint32_t{block[i*4]}<<24)|(uint32_t{block[i*4+1]}<<16)|(uint32_t{block[i*4+2]}<<8)|block[i*4+3];
    for(unsigned i=16;i<64;i++){const auto x=words[i-15],y=words[i-2];words[i]=words[i-16]+(rotate(x,7)^rotate(x,18)^(x>>3))+words[i-7]+(rotate(y,17)^rotate(y,19)^(y>>10));}
    uint32_t a=state[0],b=state[1],c=state[2],d=state[3],e=state[4],f=state[5],g=state[6],h=state[7];
    for(unsigned i=0;i<64;i++) {const auto first=h+(rotate(e,6)^rotate(e,11)^rotate(e,25))+((e&f)^(~e&g))+constants[i]+words[i];const auto second=(rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c));h=g;g=f;f=e;e=d+first;d=c;c=b;b=a;a=first+second;}
    state[0]+=a;state[1]+=b;state[2]+=c;state[3]+=d;state[4]+=e;state[5]+=f;state[6]+=g;state[7]+=h;
  }
  constexpr char hex[]="0123456789abcdef";std::string result(64,'0');
  for(unsigned i=0;i<8;i++)for(unsigned j=0;j<8;j++)result[i*8+j]=hex[(state[i]>>(28-j*4))&15];
  return result;
}

class JsiSkData : public JsiSkWrappingSkPtrNativeObject<JsiSkData, SkData> {
public:
  static constexpr const char *CLASS_NAME = "Data";

  JsiSkData(std::shared_ptr<RNSkPlatformContext> context, sk_sp<SkData> asset)
      : JsiSkWrappingSkPtrNativeObject<JsiSkData, SkData>(std::move(context),
                                                          std::move(asset)) {}

  size_t getMemoryPressure() override {
    auto data = getObject();
    return data ? data->size() : 0;
  }

  static sk_sp<SkData> fromValue(jsi::Runtime &runtime, const jsi::Value &obj) {
    return objectFromValue(runtime, obj);
  }

  // A bounded copy for manifest verification; never exposes native storage.
  JSI_HOST_FUNCTION(nelyxBytes) {
    const auto limit = count == 1 && arguments[0].isNumber()
                           ? arguments[0].asNumber() : 0;
    auto data = getObject();
    if (!data || !std::isfinite(limit) || limit < 1 ||
        limit > 16 * 1024 * 1024 || std::floor(limit) != limit ||
        data->size() > static_cast<size_t>(limit)) {
      throw jsi::JSError(runtime, "Nelyx asset byte budget exceeded or data disposed");
    }
    auto array = runtime.global().getPropertyAsFunction(runtime, "Uint8Array")
                     .callAsConstructor(runtime, static_cast<double>(data->size()))
                     .getObject(runtime);
    auto buffer = array.getPropertyAsObject(runtime, "buffer").getArrayBuffer(runtime);
    if (data->size()) std::memcpy(buffer.data(runtime), data->bytes(), data->size());
    return array;
  }

  static void definePrototype(jsi::Runtime &runtime, jsi::Object &prototype) {
    installCommon(runtime, prototype);
    installHostMethod(runtime, prototype, "nelyxBytes", &JsiSkData::nelyxBytes);
    installHostMethod(runtime, prototype, "nelyxSha256", &JsiSkData::nelyxSha256);
  }

  JSI_HOST_FUNCTION(nelyxSha256) {
    const auto limit=count==1 && arguments[0].isNumber()?arguments[0].asNumber():0;
    auto data=getObject();
    if(!data || !std::isfinite(limit) || limit<1 || limit>16*1024*1024 || std::floor(limit)!=limit || data->size()>static_cast<size_t>(limit))
      throw jsi::JSError(runtime,"Nelyx asset hash budget exceeded or data disposed");
    return jsi::String::createFromAscii(runtime,nelyxDataSha256(*data));
  }
};
} // namespace RNSkia
