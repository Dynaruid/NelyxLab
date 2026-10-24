#pragma once

#include <exception>
#include <functional>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <unordered_map>
#include <utility>
#include <vector>
#include "nelyx_skia/gpu_context.h"

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdocumentation"

#include "include/core/SkData.h"
#include "include/core/SkFontMgr.h"
#include "include/core/SkImage.h"
#include "include/core/SkStream.h"
#include "include/core/SkSurface.h"

#pragma clang diagnostic pop

#include <ReactCommon/CallInvoker.h>

namespace RNSkia {

namespace react = facebook::react;

struct RNSkAsyncResult {
  sk_sp<SkData> data;
  sk_sp<SkImage> image;
  std::string error;
};
using RNSkAsyncCompletion = std::function<void(RNSkAsyncResult)>;

class RNSkPlatformContext {
public:
  /**
   * Constructor
   */
  RNSkPlatformContext(std::shared_ptr<react::CallInvoker> callInvoker,
                      float pixelDensity)
      : _pixelDensity(pixelDensity), _callInvoker(callInvoker) {}

  virtual ~RNSkPlatformContext() = default;

  // Platform adapter selects the backend before any Graphite initialization.
  virtual nelyx::gpu::Context &getGpuContext() = 0;
  virtual void configureGpuPolicy(bool allowSoftware) = 0;

  // Explicit raster images need no GPU owner. Texture-backed snapshots still
  // use the selected backend's checked readback; this is never a display path.
  sk_sp<SkImage> makeRasterImage(sk_sp<SkImage> image) {
    if (!image || !image->isTextureBacked()) return image;
    return getGpuContext().MakeRasterImage(std::move(image));
  }

  /**
   * Schedules the function to be run on the javascript thread async
   * @param func Function to run
   */
  void runOnJavascriptThread(std::function<void()> func) {
    _callInvoker->invokeAsync(std::move(func));
  }

  // Called on JS during Promise setup. Apple stores this callback on its JS
  // owner and returns a native-only completion token. Other ports retain their
  // existing CallInvoker policy until their own runtime owner opts in.
  virtual RNSkAsyncCompletion makeAsyncCompletion(RNSkAsyncCompletion callback) {
    return [invoker = _callInvoker, callback = std::move(callback)](RNSkAsyncResult result) {
      invoker->invokeAsync([callback, result = std::move(result)]() mutable {
        callback(std::move(result));
      });
    };
  }

  /**
   * Runs the passed function on the main thread
   * @param func Function to run.
   */
  virtual void runOnMainThread(std::function<void()> func) = 0;

  /**
   * Takes a screenshot of a given view represented by the view tag
   * @param tag React view tag
   */
  virtual sk_sp<SkImage> takeScreenshotFromViewTag(size_t tag) = 0;

  /**
   * Returns an SkStream wrapping the require uri provided.
   * @param sourceUri Uri for the resource to load as a string
   * @op Operation to execute when the stream has successfuly been loaded.
   */
  virtual void performStreamOperation(
      const std::string &sourceUri,
      const std::function<void(std::unique_ptr<SkStreamAsset>)> &op) = 0;

  // A native data result can carry its storage reservation through Promise
  // delivery and decoded image lifetime. Apple uses this to avoid an untracked
  // stream-to-data copy; existing ports keep their stream implementation.
  virtual void performDataOperation(const std::string &sourceUri, size_t maxBytes,
                                   std::function<void(sk_sp<SkData>)> op) {
    performStreamOperation(sourceUri, [maxBytes, op = std::move(op)](std::unique_ptr<SkStreamAsset> stream) {
      auto data = stream && (!maxBytes || stream->getLength() <= maxBytes)
          ? SkData::MakeFromStream(stream.get(), stream->getLength()) : nullptr;
      op(std::move(data));
    });
  }

  /**
   * Raises an exception on the platform. This function does not necessarily
   * throw an exception and stop execution, so it is important to stop execution
   * by returning after calling the function
   * @param err Error to raise
   */
  virtual void raiseError(const std::exception &err) = 0;

  /**
   * Creates an offscreen surface
   * @param width Width of the offscreen surface
   * @param height Height of the offscreen surface
   * @param useP3ColorSpace If true, surface will use Display P3 color space
   * @return sk_sp<SkSurface>
   */
  virtual sk_sp<SkSurface>
  makeOffscreenSurface(int width, int height, bool useP3ColorSpace = false) = 0;

  /**
   * Return the Platform specific font manager
   */
  virtual sk_sp<SkFontMgr> createFontMgr() = 0;

  /**
   * Return platform-specific system font family names that aren't
   * enumerated by the standard font manager (e.g., .AppleSystemUIFont on iOS)
   */
  virtual std::vector<std::string> getSystemFontFamilies() { return {}; }

  /**
   * Resolve font family aliases to actual font family names.
   * For example, "System" on iOS resolves to ".AppleSystemUIFont".
   * Returns the input unchanged if no mapping exists.
   */
  virtual std::string resolveFontFamily(const std::string &familyName) {
    return familyName;
  }

  /**
   * Creates an skImage containing the screenshot of a native view and its
   * children.
   * @param viewTag React viewtag
   * @param callback Called when image is ready or with null if something
   * failed.
   */
  virtual void
  makeViewScreenshot(int viewTag,
                     std::function<void(sk_sp<SkImage>)> callback) {
    runOnMainThread([this, callback, viewTag]() {
      callback(takeScreenshotFromViewTag(viewTag));
    });
  }

  /**
   * Raises an exception on the platform. This function does not necessarily
   * throw an exception and stop execution, so it is important to stop execution
   * by returning after calling the function
   * @param message Message to show
   */
  void raiseError(const std::string &message) {
    return raiseError(std::runtime_error(message));
  }

  /**
   * @return Current scale factor for pixels
   */
  float getPixelDensity() { return _pixelDensity; }

  /**
   * Whether views render in Display P3 rather than sRGB: true on Apple
   * platforms when the main screen has a wide color gamut. The answer does
   * not change over the lifetime of the context, so a frame can be recorded
   * for a view before its surface exists.
   */
  virtual bool prefersP3ColorSpace() { return false; }

private:
  float _pixelDensity;
  std::shared_ptr<react::CallInvoker> _callInvoker;
};
} // namespace RNSkia
