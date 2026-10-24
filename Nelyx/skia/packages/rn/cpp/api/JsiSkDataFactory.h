#pragma once

#include <memory>
#include <string>
#include <utility>
#include <thread>

#include <jsi/jsi.h>

#include "JsiSkData.h"
#include "nelyx_skia/core.h"
#include "rnskia/RNSkPlatformContext.h"
#include "rnskia/NelyxFileData.h"
#include "JsiSkNativeObjects.h"
#include "api/third_party/base64.h"
#include "jsi/JsiPromises.h"

namespace RNSkia {

namespace jsi = facebook::jsi;

class JsiSkDataFactory : public JsiSkNativeObject<JsiSkDataFactory> {
public:
  static constexpr const char *CLASS_NAME = "DataFactory";

  std::string nelyxArchitecture() {
#if defined(__aarch64__) || defined(_M_ARM64)
    return "arm64";
#elif defined(__x86_64__) || defined(_M_X64)
    return "x86_64";
#else
    return "unsupported";
#endif
  }
  double nelyxCoreAbi() { return nelyx::skia_core::abiVersion(); }

  JSI_HOST_FUNCTION(nelyxConfigureGpuPolicy) {
    if (count != 1 || !arguments[0].isBool())
      throw jsi::JSError(runtime, "Nelyx GPU policy requires one boolean");
    try {
      getContext()->configureGpuPolicy(arguments[0].getBool());
    } catch (const std::exception &error) {
      throw jsi::JSError(runtime, error.what());
    }
    return jsi::Value::undefined();
  }

  JSI_HOST_FUNCTION(fromURI) {
    auto jsiLocalUri = arguments[0].asString(runtime);
    auto localUri = jsiLocalUri.utf8(runtime);
    const double requested = count > 1 ? arguments[1].asNumber() : 0;
    if (count > 1 && (!std::isfinite(requested) || requested < 1 ||
        requested > 16 * 1024 * 1024 || std::floor(requested) != requested))
      throw jsi::JSError(runtime, "Invalid Nelyx asset stream budget");
    const size_t maxBytes = static_cast<size_t>(requested);
    auto context = getContext();
    return RNJsi::JsiPromises::createPromiseAsJSIValue(
        runtime,
        [context = std::move(context), localUri = std::move(localUri), maxBytes](
            jsi::Runtime &runtime,
            std::shared_ptr<RNJsi::JsiPromises::Promise> promise) -> void {
          auto complete = context->makeAsyncCompletion(
              [&runtime, context, promise = std::move(promise)](RNSkAsyncResult result) {
                if (!result.data) {
                  promise->reject("Nelyx asset stream failed or exceeds byte budget");
                  return;
                }
                promise->resolve(makeJsiObject(runtime,
                    std::make_shared<JsiSkData>(context, std::move(result.data))));
              });
          context->performDataOperation(
              localUri, maxBytes,
              [complete = std::move(complete)](sk_sp<SkData> data) {
                complete(RNSkAsyncResult{std::move(data), nullptr, {}});
              });
        });
  };

  // File IO uses a separate bounded reader, never the app-confined asset stream.
  JSI_HOST_FUNCTION(nelyxFromFile) {
    if(count!=2 || !arguments[0].isString() || !arguments[1].isNumber())
      throw jsi::JSError(runtime,"File image requires URI and byte budget");
    const auto uri=arguments[0].asString(runtime).utf8(runtime);
    const double requested=arguments[1].asNumber();
    if(!std::isfinite(requested)||requested<1||requested>16*1024*1024||std::floor(requested)!=requested)
      throw jsi::JSError(runtime,"Invalid file image byte budget");
    try { FileData::pathFromUri(uri); }
    catch(const std::exception &error) { throw jsi::JSError(runtime,error.what()); }
    auto context=getContext();const auto limit=static_cast<size_t>(requested);
    return RNJsi::JsiPromises::createPromiseAsJSIValue(runtime,
      [context,uri,limit](jsi::Runtime &runtime,std::shared_ptr<RNJsi::JsiPromises::Promise> promise) {
        auto complete=context->makeAsyncCompletion([&runtime,context,promise](RNSkAsyncResult result) {
          if(!result.data) { promise->reject(result.error.empty()?"Local file image read failed or exceeded byte budget":result.error);return; }
          promise->resolve(makeJsiObject(runtime,std::make_shared<JsiSkData>(context,std::move(result.data))));
        });
        try {
          std::thread([uri,limit,complete]() mutable {
            sk_sp<SkData> data;std::string error;
            try {const auto bytes=FileData::read(uri,limit);data=SkData::MakeWithCopy(bytes.data(),bytes.size());}
            catch(const std::exception &failure){error=failure.what();}
            catch(...){error="Unknown local file image read failure";}
            complete(RNSkAsyncResult{std::move(data),nullptr,std::move(error)});
          }).detach();
        }catch(...) {complete(RNSkAsyncResult{nullptr,nullptr,{}});}
      });
  };

  JSI_HOST_FUNCTION(fromBytes) {
    auto array = arguments[0].asObject(runtime);
    jsi::ArrayBuffer buffer =
        array.getProperty(runtime, jsi::PropNameID::forAscii(runtime, "buffer"))
            .asObject(runtime)
            .getArrayBuffer(runtime);

    const double offset=array.getProperty(runtime,"byteOffset").asNumber();
    const double length=array.getProperty(runtime,"byteLength").asNumber();
    if(!std::isfinite(offset) || !std::isfinite(length) || offset<0 || length<0 ||
        std::floor(offset)!=offset || std::floor(length)!=length ||
        offset>static_cast<double>(buffer.size(runtime)) || length>static_cast<double>(buffer.size(runtime))-offset)
      throw jsi::JSError(runtime,"Invalid native data byte view");
    auto data = SkData::MakeWithCopy(length?buffer.data(runtime)+static_cast<size_t>(offset):nullptr,static_cast<size_t>(length));
    return makeJsiObject(
        runtime, std::make_shared<JsiSkData>(getContext(), std::move(data)));
  }

  std::shared_ptr<JsiSkData> fromBase64(std::string base64Str) {
    auto size = base64Str.size();

    // Calculate length
    size_t len;
    auto err = Base64::Decode(base64Str.c_str(), size, nullptr, &len);
    if (err != Base64::Error::kNone) {
      throw std::runtime_error("Error decoding base64 string");
    }

    // Create data object and decode
    auto data = SkData::MakeUninitialized(len);
    err = Base64::Decode(base64Str.c_str(), size, data->writable_data(), &len);
    if (err != Base64::Error::kNone) {
      throw std::runtime_error("Error decoding base64 string");
    }

    return std::make_shared<JsiSkData>(getContext(), std::move(data));
  }

  size_t getMemoryPressure() override { return 1024; }

  static void definePrototype(jsi::Runtime &runtime, jsi::Object &prototype) {
    installMethod(runtime, prototype, "nelyxArchitecture", &JsiSkDataFactory::nelyxArchitecture);
    installMethod(runtime, prototype, "nelyxCoreAbi", &JsiSkDataFactory::nelyxCoreAbi);
    installHostMethod(runtime, prototype, "nelyxConfigureGpuPolicy", &JsiSkDataFactory::nelyxConfigureGpuPolicy);
    installHostMethod(runtime, prototype, "fromURI",
                      &JsiSkDataFactory::fromURI);
    installHostMethod(runtime, prototype, "nelyxFromFile", &JsiSkDataFactory::nelyxFromFile);
    installHostMethod(runtime, prototype, "fromBytes",
                      &JsiSkDataFactory::fromBytes);
    installMethod(runtime, prototype, "fromBase64",
                  &JsiSkDataFactory::fromBase64);
  }

  explicit JsiSkDataFactory(std::shared_ptr<RNSkPlatformContext> context)
      : JsiSkNativeObject<JsiSkDataFactory>(std::move(context)) {}
};

} // namespace RNSkia
