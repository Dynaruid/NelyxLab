#pragma once
#include "nelyx_skia/core.h"

#include <memory>
#include <utility>

#include <jsi/jsi.h>

#include "JsiSkCanvas.h"
#include "JsiDisplayList.h"
#include "JsiSkGraphiteRecording.h"
#include "JsiSkNativeObjects.h"
#include "rnskia/RNSkGraphiteTarget.h"

namespace RNSkia {

namespace jsi = facebook::jsi;

/**
 * The recording side of a SkiaGraphiteView, handed to JS by
 * SkiaViewApi.makeGraphiteContext. It can be captured into any runtime:
 * recording happens on the calling thread, presenting on the main thread.
 */
class JsiSkGraphiteContext
    : public JsiSkWrappingSharedPtrNativeObject<JsiSkGraphiteContext,
                                                RNSkGraphiteTarget> {
public:
  static constexpr const char *CLASS_NAME = "GraphiteContext";

  JsiSkGraphiteContext(std::shared_ptr<RNSkPlatformContext> context,
                       std::shared_ptr<RNSkGraphiteTarget> target)
      : JsiSkWrappingSharedPtrNativeObject<JsiSkGraphiteContext,
                                           RNSkGraphiteTarget>(
            std::move(context), std::move(target)) {}

  double getWidth() { return getObject()->getWidth(); }

  double getHeight() { return getObject()->getHeight(); }

  std::shared_ptr<JsiSkCanvas> beginRecording() {
    auto *canvas = getObject()->beginRecording();
    auto jsiCanvas = std::make_shared<JsiSkCanvas>(getContext(), canvas);
    _canvas = jsiCanvas;
    return jsiCanvas;
  }

  std::shared_ptr<JsiSkGraphiteRecording> finishRecording() {
    // The snap deletes the borrowed canvas, including a failed snap. Keep
    // the wrapper alive through packet encoding/GC, then invalidate aliases.
    if (_canvas) _canvas->setCanvas(nullptr);
    _canvas.reset();
    auto recording = getObject()->finishRecording();
    return std::make_shared<JsiSkGraphiteRecording>(getContext(),
                                                    std::move(recording));
  }

  void submit(std::shared_ptr<JsiSkGraphiteRecording> recording) {
    getObject()->submit(recording->getObject());
  }

  double nelyxIdentity(){return getObject()->nelyxIdentity();}
  void nelyxConfigure(){getObject()->nelyxConfigure();}
  int nelyxReserve(double identity,double width,double height,double bytes,double density){return getObject()->nelyxReserve(identity,width,height,bytes,density);}
  int nelyxReserveEpoch(double identity,double width,double height,double bytes,double density,double surface){return getObject()->nelyxReserve(identity,width,height,bytes,density,surface);}
  void nelyxCancel(){getObject()->nelyxCancel();}
  void nelyxClose(){getObject()->nelyxClose();}
  void nelyxReset(){getObject()->nelyxReset();}
  std::vector<double> nelyxStats(){return getObject()->nelyxStats();}
  std::vector<double> nelyxNotifications(){return getObject()->nelyxNotifications();}
  void nelyxSubmit(std::shared_ptr<JsiSkGraphiteRecording> recording,double submission){
    if(!std::isfinite(submission)||submission<1||submission>4294967295.0||std::floor(submission)!=submission)throw std::runtime_error("Invalid Nelyx native submission ID");
    getObject()->submit(recording->getObject(),static_cast<uint64_t>(submission));
  }
  void nelyxSubmitFrame(std::shared_ptr<JsiSkGraphiteRecording> recording,double submission,double owner,double viewport,double frame,double input,double inputTimestamp,double tick,double uncertainty){
    for(auto value:{owner,viewport,frame,input})if(!std::isfinite(value)||value<0||value>9007199254740991.0||std::floor(value)!=value)throw std::runtime_error("Invalid Nelyx frame identity");
    if(!std::isfinite(inputTimestamp)||!std::isfinite(tick)||!std::isfinite(uncertainty)||uncertainty<0)throw std::runtime_error("Invalid Nelyx frame clock identity");
    recording->getObject()->nelyxSetIdentity({static_cast<uint64_t>(owner),static_cast<uint64_t>(viewport),static_cast<uint64_t>(frame),static_cast<uint64_t>(input),0,0,inputTimestamp,tick,uncertainty});
    nelyxSubmit(std::move(recording),submission);
  }
  double nelyxCoreVersion() {return nelyx::skia_core::abiVersion();}
  double nelyxWireVersion() {return nelyx::skia_core::frameWireVersion();}
  JSI_HOST_FUNCTION(nelyxReplayDisplayList) {
    auto canvas=_canvas;if(count!=2||!canvas)throw jsi::JSError(runtime,"Native display-list requires an open recording");
    replayDisplayList(runtime,canvas->getCanvas(),arguments[0],arguments[1]);return jsi::Value::undefined();
  }

  static void definePrototype(jsi::Runtime &runtime, jsi::Object &prototype) {
    installHostMethod(runtime,prototype,"nelyxReplayDisplayList",&JsiSkGraphiteContext::nelyxReplayDisplayList);
    installMethod(runtime,prototype,"nelyxIdentity",&JsiSkGraphiteContext::nelyxIdentity);
    installMethod(runtime,prototype,"nelyxConfigure",&JsiSkGraphiteContext::nelyxConfigure);
    installMethod(runtime,prototype,"nelyxReserve",&JsiSkGraphiteContext::nelyxReserve);
    installMethod(runtime,prototype,"nelyxReserveEpoch",&JsiSkGraphiteContext::nelyxReserveEpoch);
    installMethod(runtime,prototype,"nelyxCancel",&JsiSkGraphiteContext::nelyxCancel);
    installMethod(runtime,prototype,"nelyxClose",&JsiSkGraphiteContext::nelyxClose);
    installMethod(runtime,prototype,"nelyxReset",&JsiSkGraphiteContext::nelyxReset);
    installMethod(runtime,prototype,"nelyxStats",&JsiSkGraphiteContext::nelyxStats);
    installMethod(runtime,prototype,"nelyxNotifications",&JsiSkGraphiteContext::nelyxNotifications);
    installMethod(runtime,prototype,"nelyxSubmit",&JsiSkGraphiteContext::nelyxSubmit);
    installMethod(runtime,prototype,"nelyxSubmitFrame",&JsiSkGraphiteContext::nelyxSubmitFrame);
    installCommon(runtime, prototype);
    installMethod(runtime, prototype, "nelyxCoreVersion", &JsiSkGraphiteContext::nelyxCoreVersion);
    installMethod(runtime, prototype, "nelyxWireVersion", &JsiSkGraphiteContext::nelyxWireVersion);
    installGetter(runtime, prototype, "width", &JsiSkGraphiteContext::getWidth);
    installGetter(runtime, prototype, "height",
                  &JsiSkGraphiteContext::getHeight);
    installMethod(runtime, prototype, "beginRecording",
                  &JsiSkGraphiteContext::beginRecording);
    installMethod(runtime, prototype, "finishRecording",
                  &JsiSkGraphiteContext::finishRecording);
    installMethod(runtime, prototype, "submit", &JsiSkGraphiteContext::submit);
  }

  size_t getMemoryPressure() override { return 1024; }

private:
  std::shared_ptr<JsiSkCanvas> _canvas;
};

} // namespace RNSkia
