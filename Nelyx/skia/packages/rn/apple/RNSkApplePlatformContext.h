#pragma once

#import <React/RCTBridgeModule.h>

#include <functional>
#include <memory>
#include <ReactCommon/CallInvoker.h>
#include <string>

#include "RNSkPlatformContext.h"
#include "RNSkOwnerAsyncQueue.h"
#include "RNSkAppleStreamLoader.h"
#include "ViewScreenshotService.h"
#include <atomic>

namespace facebook {
namespace react {
class CallInvoker;
}
} // namespace facebook

namespace RNSkia {

class RNSkApplePlatformContext : public RNSkPlatformContext {
public:
  RNSkApplePlatformContext(
      RCTViewRegistry *viewRegistry,
      std::shared_ptr<facebook::react::CallInvoker> jsCallInvoker)
      : RNSkPlatformContext(jsCallInvoker, mainScreenPixelDensity()),
        _asyncOperations(std::make_shared<RNSkOwnerAsyncQueue<RNSkAsyncResult>>(
            [jsCallInvoker](std::function<void()> job) {
              jsCallInvoker->invokeAsync(std::move(job));
            })) {

    // Create screenshot manager
    _screenshotService =
        [[ViewScreenshotService alloc] initWithViewRegistry:viewRegistry];
    _prefersP3ColorSpace = mainScreenSupportsP3();
    _streamLoader = [RNSkAppleStreamLoader new];
  }

  ~RNSkApplePlatformContext() { [_streamLoader close]; }

  RNSkAsyncCompletion makeAsyncCompletion(RNSkAsyncCompletion callback) override {
    return _asyncOperations->begin(std::move(callback));
  }
  void requireJavascriptOwner() const { _asyncOperations->requireOwner(); }
  void sealForShutdown() {
    _gpuClosed.store(true);
    _servicesClosed->store(true);
    { std::lock_guard lock(_mainState->mutex); _mainState->closed=true; }
    _asyncOperations->seal();
    [_streamLoader close];
  }
  void closeAsyncOperations() {
    if(_ownerReleased.load())return;
    sealForShutdown();
    requireJavascriptOwner();
    _asyncOperations->close();
    _ownerReleased.store(true);
  }
  bool installationRollbackReady() const {
    return _ownerReleased.load() && !_gpuUsed.load() && mainJobsDrained() &&
        streamStatus().drained() && !_asyncOperations->pending();
  }
  bool mainJobsDrained() const {std::lock_guard lock(_mainState->mutex);return _mainState->closed && !_mainState->jobs && !_mainState->failed;}
  bool mainJobFailed() const {std::lock_guard lock(_mainState->mutex);return _mainState->failed;}
  bool retireGpuWork();
  void prepareCompositionGpu();
  bool gpuPrepared() const {return _gpuPrepared.load();}
  bool gpuDrained() const {return _gpuDrained.load();}

  nelyx::gpu::Context &getGpuContext() override;
  void configureGpuPolicy(bool allowSoftware) override;

  /**
   Whether the main screen has a wide color gamut (Display P3). The screen is
   asked once and the answer is kept: RNSkiaModule asks first, on the main
   queue it is created on, so that the context (created on the JS thread)
   only reads the answer.
   */
  static bool mainScreenSupportsP3();
  // Seeded by the module's main-queue setup; JS reads only this cached value.
  static float mainScreenPixelDensity();

  bool prefersP3ColorSpace() override { return _prefersP3ColorSpace; }

  void runOnMainThread(std::function<void()>) override;

  sk_sp<SkImage> takeScreenshotFromViewTag(size_t tag) override;

  virtual void performStreamOperation(
      const std::string &sourceUri,
      const std::function<void(std::unique_ptr<SkStreamAsset>)> &op) override;
  void performDataOperation(const std::string &sourceUri, size_t maxBytes,
                           std::function<void(sk_sp<SkData>)> op) override;
  AppleStreamSnapshot streamStatus() const { return [_streamLoader snapshot]; }

  void raiseError(const std::exception &err) override;
  sk_sp<SkSurface> makeOffscreenSurface(int width, int height,
                                        bool useP3ColorSpace = false) override;

  sk_sp<SkFontMgr> createFontMgr() override;

  std::vector<std::string> getSystemFontFamilies() override;

  std::string resolveFontFamily(const std::string &familyName) override;

private:
  struct MainState {std::mutex mutex;bool closed=false,failed=false;size_t jobs=0;};
  std::shared_ptr<MainState> _mainState=std::make_shared<MainState>();
  std::atomic<bool> _gpuUsed{false},_gpuClosed{false},_gpuPrepared{false},_gpuDrained{false},_gpuPolicyConfigured{false};
  std::atomic<bool> _ownerReleased{false};
  ViewScreenshotService *_screenshotService;
  RNSkAppleStreamLoader *_streamLoader;
  bool _prefersP3ColorSpace = false;
  std::shared_ptr<RNSkOwnerAsyncQueue<RNSkAsyncResult>> _asyncOperations;
  std::shared_ptr<std::atomic<bool>> _servicesClosed =
      std::make_shared<std::atomic<bool>>(false);
};

} // namespace RNSkia
