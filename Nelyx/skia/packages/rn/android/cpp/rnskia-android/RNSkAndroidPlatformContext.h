#pragma once

#include <exception>
#include <functional>
#include <memory>
#include <string>

#include "RNDawnContext.h"

#include "JniPlatformContext.h"
#include "AndroidRuntimeCallbacks.h"
#include "RNSkPlatformContext.h"

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdocumentation"

#include "include/ports/SkFontMgr_android.h"
#include "include/ports/SkFontScanner_FreeType.h"

#pragma clang diagnostic pop

namespace RNSkia {

class RNSkAndroidPlatformContext : public RNSkPlatformContext {
public:
  RNSkAndroidPlatformContext(
      JniPlatformContext *jniPlatformContext,
      std::shared_ptr<facebook::react::CallInvoker> jsCallInvoker,
      facebook::jsi::Runtime &runtime)
      : RNSkPlatformContext(jsCallInvoker,
                            jniPlatformContext->getPixelDensity()),
        _jniPlatformContext(jniPlatformContext),
        _javaPeer(jni::make_global(jniPlatformContext->getJavaPeer())),
        _runtime(&runtime), _invoker(std::move(jsCallInvoker)),
        _callbacks(Callbacks::bind(runtime)) {}

  ~RNSkAndroidPlatformContext() override = default;

  RNSkAsyncCompletion makeAsyncCompletion(RNSkAsyncCompletion callback) override {
    auto state = _callbacks.lock();
    if (!state || !state->active.load(std::memory_order_acquire)) {
      throw std::runtime_error("Nelyx Android runtime callbacks are closed");
    }
    return Callbacks::add(_callbacks, *_runtime, _invoker, std::move(callback));
  }

  nelyx::gpu::Context &getGpuContext() override { return DawnContext::getInstance(); }
  void configureGpuPolicy(bool allowSoftware) override {
    DawnUtils::configureNelyxDawnAdapterPolicy(allowSoftware);
  }

  void performStreamOperation(
      const std::string &sourceUri,
      const std::function<void(std::unique_ptr<SkStreamAsset>)> &op) override {
    _jniPlatformContext->performStreamOperation(sourceUri, op);
  }

  void raiseError(const std::exception &err) override {
    _jniPlatformContext->raiseError(err);
  }

  sk_sp<SkSurface> makeOffscreenSurface(int width, int height,
                                        bool useP3ColorSpace = false) override {
    return DawnContext::getInstance().MakeOffscreen(width, height,
                                                    useP3ColorSpace);
  }

  sk_sp<SkFontMgr> createFontMgr() override {
    return SkFontMgr_New_Android(nullptr, SkFontScanner_Make_FreeType());
  }

  void runOnMainThread(std::function<void()> task) override {
    _jniPlatformContext->runTaskOnMainThread(std::move(task));
  }

  sk_sp<SkImage> takeScreenshotFromViewTag(size_t tag) override {
    return _jniPlatformContext->takeScreenshotFromViewTag(tag);
  }

private:
  using Callbacks = AndroidRuntimeCallbacks<RNSkAsyncResult>;
  JniPlatformContext *_jniPlatformContext;
  jni::global_ref<JniPlatformContext::javaobject> _javaPeer;
  facebook::jsi::Runtime *_runtime;
  std::shared_ptr<facebook::react::CallInvoker> _invoker;
  Callbacks::TicketOwner _callbacks;
};

} // namespace RNSkia
