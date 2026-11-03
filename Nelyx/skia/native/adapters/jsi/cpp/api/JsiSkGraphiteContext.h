#pragma once
#include "nelyx_skia/core.h"

#include <memory>
#include <utility>

#include <jsi/jsi.h>

#include "JsiSkCanvas.h"
#include "JsiDisplayList.h"
#include "JsiFrameSegment.h"
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
    return finish(false);
  }
  std::shared_ptr<JsiSkGraphiteRecording> nelyxFinishRecordingWithDiagnostics() {
    return finish(true);
  }
  std::vector<double> nelyxRecordingDiagnostics(){return getObject()->nelyxRecordingDiagnostics();}

private:
  std::shared_ptr<JsiSkGraphiteRecording> finish(bool observe) {
    // The snap deletes the borrowed canvas, including a failed snap. Keep
    // the wrapper alive through packet encoding/GC, then invalidate aliases.
    if (_canvas) _canvas->setCanvas(nullptr);
    _canvas.reset();
    auto segments=std::move(_pendingSegments);
    auto recording = getObject()->finishRecording(observe);
    for(auto& segment:segments){const auto& stamp=segment->program->stamp;NelyxFrameIdentity identity;identity.owner=uint64_t(stamp[0]);identity.frame=uint64_t(stamp[1]);identity.viewport=uint64_t(stamp[2]);recording->nelyxHoldFrameSegment(std::move(segment),identity);}
    return std::make_shared<JsiSkGraphiteRecording>(getContext(),
                                                    std::move(recording));
  }
public:

  void submit(std::shared_ptr<JsiSkGraphiteRecording> recording) {
    getObject()->submit(recording->getObject());
  }

  double nelyxIdentity(){return getObject()->nelyxIdentity();}
  void nelyxConfigure(){getObject()->nelyxConfigure();}
  int nelyxReserve(double identity,double width,double height,double bytes,double density){return getObject()->nelyxReserve(identity,width,height,bytes,density);}
  int nelyxReserveEpoch(double identity,double width,double height,double bytes,double density,double surface){return getObject()->nelyxReserve(identity,width,height,bytes,density,surface);}
  void nelyxCancel(){_pendingSegments.clear();getObject()->nelyxCancel();}
  void nelyxClose(){_pendingSegments.clear();getObject()->nelyxClose();}
  void nelyxReset(){getObject()->nelyxReset();if(_segmentBudget){std::lock_guard lock(_segmentBudget->mutex);const auto& b=*_segmentBudget;if(b.live||b.bytes||b.sealed!=b.retired)throw std::runtime_error("Native sealed frame leases remain after GPU/recording drain");if(!b.reported){NativeServiceAudit::recordEngine({{8,b.retired}});NativeServiceAudit::engineMemory(b.live,b.bytes,b.peak,b.peakBytes);_segmentBudget->reported=true;}_segmentBudget->closed=true;}}
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
  JSI_HOST_FUNCTION(nelyxSealDisplayList){
    auto canvas=_canvas;if(count!=2||!canvas)throw jsi::JSError(runtime,"Frame sealing requires an open native recording");
    auto* original=canvas->getCanvas();auto program=std::make_shared<DisplayListProgram>();
    replayDisplayList(runtime,original,arguments[0],arguments[1],[this,canvas,original]{if(_canvas!=canvas||canvas->getCanvas()!=original)throw std::runtime_error("Recording changed during native frame sealing");getObject();},getContext().get(),program.get());
    getObject()->nelyxCheckSegmentContext(program->stamp[4],program->stamp[5]);
    for(unsigned index=0;index<3;++index)if(program->stamp[index]<1)throw std::runtime_error("Native frame segment requires a positive owner/frame/viewport generation");
    if(!_segmentBudget)_segmentBudget=std::make_shared<FrameSegmentBudget>();
    auto segment=std::make_shared<NativeFrameSegment>(_segmentBudget,std::move(program));
    NativeServiceAudit::recordEngine({{6,1},{9,segment->program->bytes}});
    return makeJsiObject(runtime,std::make_shared<JsiFrameSegment>(getContext(),std::move(segment)));
  }
  void nelyxAdmitFrameSegment(std::shared_ptr<JsiFrameSegment> wrapped){
    if(!_canvas||!wrapped->nelyxOwnedBy(getContext().get()))throw std::runtime_error("Frame segment requires its original native recording owner");
    auto segment=wrapped->getObject();if(segment->budget!=_segmentBudget||segment->admitted||!_pendingSegments.empty())throw std::runtime_error("Foreign/repeated native frame segment admission");
    const auto& stamp=segment->program->stamp;getObject()->nelyxCheckSegmentContext(stamp[4],stamp[5]);
    _pendingSegments.push_back(segment);segment->admitted=true;
    for(auto& command:segment->program->commands)command(_canvas->getCanvas());
    const auto& numeric=segment->program->numericWork;
    NativeServiceAudit::record({{7,1},{8,numeric[0]},{9,numeric[1]},{10,numeric[2]}});
    {std::lock_guard lock(_segmentBudget->mutex);++_segmentBudget->admitted;}
    NativeServiceAudit::recordEngine({{7,1}});
  }
  JSI_HOST_FUNCTION(nelyxReplayDisplayList) {
    auto canvas=_canvas;if(count!=2||!canvas)throw jsi::JSError(runtime,"Native display-list requires an open recording");
    auto* original=canvas->getCanvas();
    replayDisplayList(runtime,original,arguments[0],arguments[1],[this,canvas,original]{
      if(_canvas!=canvas||canvas->getCanvas()!=original)throw std::runtime_error("Display-list recording changed during handle admission");
      getObject();
    },getContext().get());return jsi::Value::undefined();
  }

  static void definePrototype(jsi::Runtime &runtime, jsi::Object &prototype) {
    installHostMethod(runtime,prototype,"nelyxReplayDisplayList",&JsiSkGraphiteContext::nelyxReplayDisplayList);
    installHostMethod(runtime,prototype,"nelyxSealDisplayList",&JsiSkGraphiteContext::nelyxSealDisplayList);
    installMethod(runtime,prototype,"nelyxAdmitFrameSegment",&JsiSkGraphiteContext::nelyxAdmitFrameSegment);
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
    installMethod(runtime,prototype,"nelyxFinishRecordingWithDiagnostics",&JsiSkGraphiteContext::nelyxFinishRecordingWithDiagnostics);
    installMethod(runtime,prototype,"nelyxRecordingDiagnostics",&JsiSkGraphiteContext::nelyxRecordingDiagnostics);
    installMethod(runtime, prototype, "submit", &JsiSkGraphiteContext::submit);
  }

  size_t getMemoryPressure() override { return 1024; }

private:
  std::shared_ptr<JsiSkCanvas> _canvas;
  std::shared_ptr<FrameSegmentBudget> _segmentBudget;
  std::vector<std::shared_ptr<NativeFrameSegment>> _pendingSegments;
};

} // namespace RNSkia
