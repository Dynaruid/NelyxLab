#pragma once

#include <memory>
#include <vector>

#include "JsiSkCanvas.h"
#include "JsiSkConverters.h"
#include "JsiSkNativeObjects.h"
#include "JsiSkPicture.h"
#include "JsiSkRect.h"

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdocumentation"

#include "include/core/SkBBHFactory.h"
#include "include/core/SkPictureRecorder.h"

#pragma clang diagnostic pop

namespace RNSkia {

namespace jsi = facebook::jsi;

class JsiSkPictureRecorder
    : public JsiSkWrappingSharedPtrNativeObject<JsiSkPictureRecorder,
                                                SkPictureRecorder> {
public:
  static constexpr const char *CLASS_NAME = "PictureRecorder";
  ~JsiSkPictureRecorder() override {if(!isDisposed()){auto recorder=getObjectUnchecked();if(recorder&&_dispatcher)_dispatcher->run([recorder,canvases=std::move(_canvases)](){for(auto& weak:canvases)if(auto canvas=weak.lock())canvas->invalidateSurface();});releaseResources();}}

  explicit JsiSkPictureRecorder(std::shared_ptr<RNSkPlatformContext> context)
      : JsiSkWrappingSharedPtrNativeObject<JsiSkPictureRecorder,
                                           SkPictureRecorder>(
            context, std::make_shared<SkPictureRecorder>()) {_dispatcher=Dispatcher::getDispatcher();}

  std::shared_ptr<JsiSkCanvas>
  beginRecording(JsiOptional<std::shared_ptr<SkRect>> rect) {
    if(getObject()->getRecordingCanvas())throw std::runtime_error("PictureRecorder is already recording");
    SkCanvas *canvas;
    if (rect.has_value()) {
      SkRTreeFactory factory;
      canvas = getObject()->beginRecording(**rect, &factory);
    } else {
      SkISize size = SkISize::Make(2'000'000, 2'000'000);
      SkRect bounds = SkRect::Make(size);
      canvas = getObject()->beginRecording(bounds, nullptr);
    }
    auto result=std::make_shared<JsiSkCanvas>(getContext(), canvas);
    _canvases.push_back(result);return result;
  }

  std::shared_ptr<JsiSkPicture> finishRecordingAsPicture() {
    if(!getObject()->getRecordingCanvas())throw std::runtime_error("PictureRecorder is not recording");
    auto picture = getObject()->finishRecordingAsPicture();
    invalidateCanvases();
    return std::make_shared<JsiSkPicture>(getContext(), std::move(picture));
  }

  static void definePrototype(jsi::Runtime &runtime, jsi::Object &prototype) {
    installCommon(runtime, prototype);
    installMethod(runtime, prototype, "beginRecording",
                  &JsiSkPictureRecorder::beginRecording);
    installMethod(runtime, prototype, "finishRecordingAsPicture",
                  &JsiSkPictureRecorder::finishRecordingAsPicture);
  }

  // The recorded picture reports its own size once finished.
  size_t getMemoryPressure() override { return kMinMemoryPressure; }
  void releaseResources() override {invalidateCanvases();setObject(nullptr);}

  static const jsi::HostFunctionType
  createCtor(std::shared_ptr<RNSkPlatformContext> context) {
    return JSI_HOST_FUNCTION_LAMBDA {
      return makeJsiObject(runtime,
                           std::make_shared<JsiSkPictureRecorder>(context));
    };
  }
private:
  std::shared_ptr<Dispatcher> _dispatcher;
  std::vector<std::weak_ptr<JsiSkCanvas>> _canvases;
  void invalidateCanvases(){for(auto& weak:_canvases)if(auto canvas=weak.lock())canvas->invalidateSurface();_canvases.clear();}
};
} // namespace RNSkia
