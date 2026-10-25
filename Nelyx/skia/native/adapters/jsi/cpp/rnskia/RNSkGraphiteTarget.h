#pragma once

#include <atomic>
#include <cmath>
#include <deque>
#include <functional>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>

#include "RNSkGraphiteTargetInfo.h"
#include "RNSkPlatformContext.h"
#include "RNSkWindowSurface.h"

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdocumentation"

#include "include/core/SkCanvas.h"
#include "include/core/SkColorSpace.h"
#include "include/core/SkImageInfo.h"
#include "include/gpu/graphite/Recorder.h"
#include "include/gpu/graphite/Recording.h"
#include "include/gpu/graphite/TextureInfo.h"

#pragma clang diagnostic pop

namespace RNSkia {
struct NelyxFrameIdentity {uint64_t owner=0,viewport=0,frame=0,input=0,context=0,submission=0;double inputTimestamp=-1,tick=-1,clockUncertainty=0;};

/**
 * The Graphite recorder of one view. Shared by the view's target and by every
 * recording snapped from it, so that the recorder outlives its recordings
 * whichever of them is released last.
 */
// Admission counts native recording lifetimes, including the frame retained
// for redraw. Two slots cover reservations, snapped/queued/consuming frames.
// GPU retirement is synchronous in the Nelyx comparison variant. Cache budgets
// are separate from this count and are not a total GPU allocation claim.
struct NelyxGraphiteAdmission {
  std::mutex mutex;
  bool enabled=false,closed=false,reserved=false;
  uint64_t identity=0,recordings=0,queued=0,consuming=0;
  uint64_t lastSubmission=0;
  std::unordered_set<uint64_t> pendingSubmissions;
  std::deque<std::pair<uint64_t,uint32_t>> notifications;
};
struct NelyxGraphiteSlot {
  explicit NelyxGraphiteSlot(std::shared_ptr<NelyxGraphiteAdmission> value):state(std::move(value)) {}
  ~NelyxGraphiteSlot(){std::lock_guard<std::mutex> lock(state->mutex);--state->recordings;}
  std::shared_ptr<NelyxGraphiteAdmission> state;
  std::atomic<bool> submitted{false};
  std::atomic<bool> retired{false};
  uint64_t submission=0;
};
struct RNSkGraphiteRecorder {
  RNSkGraphiteRecorder()=default;
  RNSkGraphiteRecorder(const RNSkGraphiteRecorder&)=delete;
  RNSkGraphiteRecorder& operator=(const RNSkGraphiteRecorder&)=delete;
  // Recordings may outlive their target/view; keep its native GPU owner alive.
  std::shared_ptr<RNSkPlatformContext> gpuOwner;
  std::shared_ptr<skgpu::graphite::Recorder> recorder;
};

/**
 * A frame snapped from a view's recorder, with the description of the target
 * it was recorded for. Immutable once snapped: it can be replayed any number
 * of times, from any thread.
 */
class RNSkGraphiteRecording {
  struct NativeReplay {
    // Contains no platform/JS/View callbacks. A native imported frame retains
    // its Device separately; release the recording before its native recorder.
    std::shared_ptr<skgpu::graphite::Recorder> recorder;
    std::unique_ptr<skgpu::graphite::Recording> recording;
  };
public:
  RNSkGraphiteRecording(std::shared_ptr<RNSkGraphiteRecorder> recorder,
                        std::unique_ptr<skgpu::graphite::Recording> recording,
                        const RNSkGraphiteTargetInfo &target)
      : _recorder(std::move(recorder)), _native(std::make_shared<NativeReplay>(NativeReplay{_recorder->recorder,std::move(recording)})),
        _target(target) {}
  RNSkGraphiteRecording(const RNSkGraphiteRecording&)=delete;
  RNSkGraphiteRecording& operator=(const RNSkGraphiteRecording&)=delete;

  skgpu::graphite::Recording *get() const { return _native->recording.get(); }
  std::shared_ptr<skgpu::graphite::Recording> nativeReplay() const {
    return {_native,_native->recording.get()};
  }
  void nelyxHold(std::shared_ptr<NelyxGraphiteSlot> slot){_nelyxSlot=std::move(slot);}
  bool nelyxManaged() const {return _nelyxSlot!=nullptr;}
  bool nelyxRetired() const {return _nelyxSlot&&_nelyxSlot->retired.load();}
  void nelyxMarkRetired(){if(_nelyxSlot)_nelyxSlot->retired.store(true);}
  bool nelyxClaim(const std::shared_ptr<NelyxGraphiteAdmission>& state,uint64_t submission=0){if(!_nelyxSlot || _nelyxSlot->state!=state || _nelyxSlot->submitted.exchange(true))return false;_nelyxSlot->submission=submission;return true;}
  uint64_t nelyxSubmission() const {return _nelyxSlot?_nelyxSlot->submission:0;}
  void nelyxSetIdentity(NelyxFrameIdentity value){if(_nelyxSlot&&_nelyxSlot->submitted.load())throw std::runtime_error("Native frame identity is already immutable");_identity=value;}
  NelyxFrameIdentity nelyxIdentity() const{auto value=_identity;if(_nelyxSlot){value.context=_nelyxSlot->state->identity;value.submission=_nelyxSlot->submission;}return value;}


  /**
   Whether the recording was made for a texture of the given size. A deferred
   canvas records against fixed dimensions: Graphite sizes the passes (and
   their depth and stencil attachments) from them, so replaying it onto a
   texture of another size is rejected by Dawn and draws nothing. A recording
   of another size is replayed through a texture of its own size instead (see
   RNSkView::present).
   */
  bool hasSizeOf(const RNSkGraphiteTargetInfo &target) const {
    return _target.width == target.width && _target.height == target.height;
  }

  /** The target the recording was made for. */
  const RNSkGraphiteTargetInfo &getTarget() const { return _target; }

  /**
   Whether the recording has the format of the given target, and the target
   supports every usage the recording relies on.
   */
  bool hasFormatOf(const RNSkGraphiteTargetInfo &target) const {
    return _target.colorType == target.colorType &&
           _target.textureInfo.canBeFulfilledBy(target.textureInfo);
  }

  /**
   Whether the recording was made in the color space of the given target. The
   colors of a recording are converted when it is recorded: replayed onto a
   target in another color space, they would be read in the wrong gamut. Such
   a recording is replayed through a texture in its own color space instead,
   which is then drawn, and converted, onto the target (see
   RNSkView::present).
   */
  bool hasColorSpaceOf(const RNSkGraphiteTargetInfo &target) const {
    return _target.useP3ColorSpace == target.useP3ColorSpace;
  }

  /** Whether the recording can be replayed straight onto the given target. */
  bool isCompatibleWith(const RNSkGraphiteTargetInfo &target) const {
    return hasSizeOf(target) && hasFormatOf(target) && hasColorSpaceOf(target);
  }

private:
  NelyxFrameIdentity _identity;
  std::shared_ptr<NelyxGraphiteSlot> _nelyxSlot; // Destroyed after the recorder/recording.
  // Declared before the recording so that the recording is released first.
  std::shared_ptr<RNSkGraphiteRecorder> _recorder;
  std::shared_ptr<NativeReplay> _native;
  RNSkGraphiteTargetInfo _target;
};

/**
 * What a view and the producers recording for it share: the view's recorder,
 * the queue of recordings waiting to be presented and the description of the
 * target texture. Created by whichever side comes first (see
 * RNSkGraphiteTargetRegistry) and kept alive by both.
 *
 * Recording happens on the producer's thread (the JS thread, a worklet
 * runtime or the render thread pool), presenting on the main thread; the
 * queue is the hand-off. A recorder serves one thread at a time, which is
 * enforced by allowing a single open recording.
 */
class RNSkGraphiteTarget {
public:
  explicit RNSkGraphiteTarget(std::shared_ptr<RNSkPlatformContext> context)
      : _context(std::move(context)) {
    static std::atomic<uint64_t> nextIdentity{1};_nelyx->identity=nextIdentity++;
  }
  double nelyxIdentity(){return static_cast<double>(_nelyx->identity);}
  void nelyxConfigure(){std::lock_guard<std::mutex> lock(_nelyx->mutex);if(_nelyx->closed)throw std::runtime_error("Nelyx target closed");_nelyx->enabled=true;}
  bool nelyxIsClosed(){std::lock_guard<std::mutex> lock(_nelyx->mutex);return _nelyx->closed;}
  int nelyxReserve(double identity,double width,double height,double bytes,double density,double expectedSurface=-1){
    {std::lock_guard<std::mutex> lock(_nelyx->mutex);if(!_nelyx->enabled || _nelyx->closed)return 3;}
    if(!std::isfinite(identity) || !std::isfinite(width) || !std::isfinite(height) || !std::isfinite(bytes) || !std::isfinite(density) || density<=0 || density>8)return 4;
    auto target=resolveTargetInfo(static_cast<float>(density));std::lock_guard<std::mutex> lock(_nelyx->mutex);
    if(!_nelyx->enabled || _nelyx->closed)return 3;
    if(identity!=_nelyx->identity || width!=target.width || height!=target.height)return 2;
    if(target.surfaceGeneration&&expectedSurface!=static_cast<double>(target.surfaceGeneration))return 2;
    if(target.width<=0 || target.height<=0)return 5;
    if(bytes<0 || bytes>256*1024 || target.width>4096 || target.height>4096)return 4;
    if(_nelyx->reserved || _nelyx->recordings>=2 || _nelyx->pendingSubmissions.size()>=2){return 1;}
    _nelyxPixelDensity.store(static_cast<float>(density));_nelyxReservedTarget=target;_nelyx->reserved=true;return 0;
  }
  void nelyxCancel(){std::lock_guard<std::mutex> lock(_nelyx->mutex);_nelyx->reserved=false;}
  std::vector<double> nelyxStats(){std::lock_guard<std::mutex> lock(_nelyx->mutex);return {static_cast<double>(_nelyx->identity),_nelyx->reserved?1.0:0.0,static_cast<double>(_nelyx->recordings),static_cast<double>(_nelyx->queued),static_cast<double>(_nelyx->consuming)};}
  std::vector<double> nelyxNotifications(){
    std::lock_guard<std::mutex> lock(_nelyx->mutex);std::vector<double> values;values.reserve(_nelyx->notifications.size()*3);
    for(const auto& [submission,result]:_nelyx->notifications){values.push_back(static_cast<double>(_nelyx->identity));values.push_back(static_cast<double>(submission));values.push_back(result);_nelyx->pendingSubmissions.erase(submission);}
    _nelyx->notifications.clear();return values;
  }
  void nelyxConsumed(const std::vector<std::shared_ptr<RNSkGraphiteRecording>>& recordings,bool gpuConfirmed=false){
    uint64_t count=0;for(const auto& recording:recordings)if(recording->nelyxManaged())++count;
    if(!count)return;
    if(!gpuConfirmed&&!_context->getGpuContext().retireWork())throw std::runtime_error("Nelyx GPU retirement fence failed");
    std::lock_guard<std::mutex> lock(_nelyx->mutex);_nelyx->consuming-=count;
    for(const auto& recording:recordings){recording->nelyxMarkRetired();if(const auto submission=recording->nelyxSubmission())_nelyx->notifications.emplace_back(submission,0);}
  }
  void nelyxClose(){
    std::function<void()> close;std::deque<std::shared_ptr<RNSkGraphiteRecording>> released;
    {std::lock_guard<std::mutex> lock(_queueMutex);released.swap(_queue);close=_nelyxCloseCallback;}
    {std::lock_guard<std::mutex> lock(_nelyx->mutex);_nelyx->closed=true;_nelyx->reserved=false;_nelyx->queued=0;for(const auto& recording:released)if(const auto submission=recording->nelyxSubmission())_nelyx->notifications.emplace_back(submission,1);}
    if(close)close();
  }
  void nelyxSetCloseCallback(std::function<void()> close){std::lock_guard<std::mutex> lock(_queueMutex);_nelyxCloseCallback=std::move(close);}
  void nelyxReset(){
    {std::lock_guard<std::mutex> lock(_nelyx->mutex);if(!_nelyx->closed || _nelyx->recordings || _nelyx->consuming || !_nelyx->pendingSubmissions.empty() || !_nelyx->notifications.empty())throw std::runtime_error("Nelyx recorder reset before retirement/notification drain");}
    std::lock_guard<std::mutex> lock(_stateMutex);if(_recording)throw std::runtime_error("Nelyx recording still open");_recorder.reset();
  }

  // Producer side ------------------------------------------------------------

  /**
   The layout size (points) and the props the format follows from, as known
   to JS. Used until the view has a surface of its own.
   */
  void setLayout(float width, float height, bool opaque, bool highBitDepth) {
    std::lock_guard<std::mutex> lock(_stateMutex);
    _layoutWidth = width;
    _layoutHeight = height;
    _opaque = opaque;
    _highBitDepth = highBitDepth;
  }

  /** Current width of the target, in points. */
  float getWidth() {
    return layoutPixels().first / pointScale();
  }

  /** Current height of the target, in points. */
  float getHeight() {
    return layoutPixels().second / pointScale();
  }
  void setPixelDensity(float density) {
    if(!std::isfinite(density) || density<=0 || density>8)throw std::runtime_error("Invalid native view pixel density");
    _nelyxPixelDensity=density;
  }

  /**
   Returns a canvas that records the next frame, in points. The canvas is
   deleted by finishRecording(). Throws while a recording is already open.
   */
  SkCanvas *beginRecording() {
    {std::lock_guard<std::mutex> lock(_nelyx->mutex);if(_nelyx->closed)throw std::runtime_error("Nelyx target closed");}
    auto target = resolveTargetInfo();
    std::lock_guard<std::mutex> lock(_stateMutex);
    {std::lock_guard<std::mutex> admission(_nelyx->mutex);if(_nelyx->closed || (_nelyx->enabled && !_nelyx->reserved))throw std::runtime_error("Nelyx native reservation required before recording or target closed");if(_nelyx->enabled)target=_nelyxReservedTarget;}
    if (_recording) {
      throw std::runtime_error("SkiaGraphiteView: a recording is already open, "
                               "call finishRecording() first.");
    }
    if (target.width <= 0 || target.height <= 0) {
      throw std::runtime_error("SkiaGraphiteView: the view has no size yet.");
    }
    if (_recorder == nullptr) {
      auto recorder = std::make_shared<RNSkGraphiteRecorder>();
      recorder->gpuOwner = _context;
      recorder->recorder = _context->getGpuContext().makeRecorder();
      if (recorder->recorder == nullptr) {
        throw std::runtime_error(
            "SkiaGraphiteView: could not create a Graphite recorder.");
      }
      _recorder = std::move(recorder);
    }
    auto imageInfo = SkImageInfo::Make(
        target.width, target.height, target.colorType, kPremul_SkAlphaType,
        nelyx::gpu::Context::viewColorSpace(target.useP3ColorSpace));
    auto *canvas =
        _recorder->recorder->makeDeferredCanvas(imageInfo, target.textureInfo);
    if (canvas == nullptr) {
      throw std::runtime_error(
          "SkiaGraphiteView: could not create a deferred canvas.");
    }
    // The canvas loads whatever the target holds: the producer clears.
    auto pd = pointScale();
    canvas->scale(pd, pd);
    _recording = true;
    _recordingTarget = target;
    return canvas;
  }

  /** Snaps the open recording. Throws when no recording is open. */
  std::shared_ptr<RNSkGraphiteRecording> finishRecording() {
    std::lock_guard<std::mutex> lock(_stateMutex);
    if (!_recording) {
      throw std::runtime_error("SkiaGraphiteView: no recording is open, call "
                               "beginRecording() first.");
    }
    _recording = false;
    auto recording = _recorder->recorder->snap();
    if (recording == nullptr) {
      throw std::runtime_error(
          "SkiaGraphiteView: snapping the recording failed.");
    }
    auto result=std::make_shared<RNSkGraphiteRecording>(_recorder,std::move(recording),_recordingTarget);
    {std::lock_guard<std::mutex> admission(_nelyx->mutex);if(_nelyx->enabled){if(!_nelyx->reserved)throw std::runtime_error("Nelyx missing recording reservation");_nelyx->reserved=false;++_nelyx->recordings;result->nelyxHold(std::make_shared<NelyxGraphiteSlot>(_nelyx));}}
    return result;
  }

  /**
   Queues a recording for the next frame. Recordings are never dropped: a
   later frame may depend on resources an earlier one uploaded.
   */
  void submit(std::shared_ptr<RNSkGraphiteRecording> recording,uint64_t submission=0) {
    std::function<void()> requestFrame;
    {
      std::lock_guard<std::mutex> lock(_queueMutex);
      {std::lock_guard<std::mutex> admission(_nelyx->mutex);if(_nelyx->enabled){if(_nelyx->closed || (submission && (submission<=_nelyx->lastSubmission || _nelyx->pendingSubmissions.size()>=2)) || !recording->nelyxClaim(_nelyx,submission))throw std::runtime_error("Nelyx rejected closed/foreign/repeated recording/submission");if(submission){_nelyx->lastSubmission=submission;_nelyx->pendingSubmissions.insert(submission);}++_nelyx->queued;}}
      _queue.push_back(std::move(recording));
      requestFrame = _requestFrame;
    }
    if (requestFrame) {
      requestFrame();
    }
  }

  // View side ----------------------------------------------------------------

  /**
   Binds the target to the view's surface, which describes the target
   texture; requestFrame asks the view to present the queue.
   */
  void attach(std::weak_ptr<RNSkWindowSurface> surface,
              std::function<void()> requestFrame) {
    {
      std::lock_guard<std::mutex> lock(_stateMutex);
      _surface = std::move(surface);
    }
    std::lock_guard<std::mutex> lock(_queueMutex);
    _requestFrame = std::move(requestFrame);
  }

  /**
   Undoes attach(), for the view owning the given surface only. Native view
   ids are reused across reloads and an Android view is only destroyed when
   its Java object is finalized, so a view going away may find its target
   already bound to its successor; that binding is left alone.
   */
  void detach(const std::shared_ptr<RNSkWindowSurface> &surface) {
    {
      std::lock_guard<std::mutex> lock(_stateMutex);
      if (_surface.lock() != surface) {
        return;
      }
      _surface.reset();
    }
    std::lock_guard<std::mutex> lock(_queueMutex);
    _requestFrame = nullptr;
  }

  /** Takes every recording submitted since the last call, in order. */
  std::vector<std::shared_ptr<RNSkGraphiteRecording>> takeQueued() {
    std::lock_guard<std::mutex> lock(_queueMutex);
    {std::lock_guard<std::mutex> admission(_nelyx->mutex);if(_nelyx->enabled && _nelyx->closed)return {};}
    std::vector<std::shared_ptr<RNSkGraphiteRecording>> recordings(_queue.begin(),_queue.end());
    {std::lock_guard<std::mutex> admission(_nelyx->mutex);if(_nelyx->enabled){_nelyx->consuming+=_nelyx->queued;_nelyx->queued=0;}}
    _queue.clear();
    return recordings;
  }

  /**
   Puts recordings that could not be presented back at the front of the
   queue, ahead of anything submitted meanwhile, so that the order holds.
   */
  void requeue(
      const std::vector<std::shared_ptr<RNSkGraphiteRecording>> &recordings) {
    std::lock_guard<std::mutex> lock(_queueMutex);
    {std::lock_guard<std::mutex> admission(_nelyx->mutex);if(_nelyx->enabled){uint64_t count=0;for(const auto& recording:recordings)if(recording->nelyxManaged())++count;_nelyx->consuming-=count;if(_nelyx->closed){for(const auto& recording:recordings)if(const auto submission=recording->nelyxSubmission())_nelyx->notifications.emplace_back(submission,1);return;}_nelyx->queued+=count;}}
    _queue.insert(_queue.begin(), recordings.begin(), recordings.end());
  }

  /** The most recently submitted recording still waiting, if any. */
  std::shared_ptr<RNSkGraphiteRecording> peekLatest() {
    std::lock_guard<std::mutex> lock(_queueMutex);
    return _queue.empty() ? nullptr : _queue.back();
  }

  bool hasQueued() {
    std::lock_guard<std::mutex> lock(_queueMutex);
    return !_queue.empty();
  }

private:
  /**
   The target to record against: the view's surface when it has one, else
   the pixel size the platform laid the view out with, else the layout size
   JS measured; in the last two cases with the format and the color space
   the surface will be created with, following the same rules (see
   RNSkWindowSurface and SkiaView.java).
   */
  std::pair<float,float> layoutPixels() {
    std::shared_ptr<RNSkWindowSurface> surface;float width,height;
    {std::lock_guard lock(_stateMutex);surface=_surface.lock();width=_layoutWidth;height=_layoutHeight;}
    RNSkGraphiteTargetInfo info;int w{},h{};
    if(surface && surface->getTargetInfo(&info))return {float(info.width),float(info.height)};
    if(surface && surface->getLayoutSize(&w,&h))return {float(w),float(h)};
    const auto density=pointScale();return {width*density,height*density};
  }
  RNSkGraphiteTargetInfo resolveTargetInfo(float requestedDensity=0) {
    std::shared_ptr<RNSkWindowSurface> surface;
    float width;
    float height;
    bool opaque;
    bool highBitDepth;
    {
      std::lock_guard<std::mutex> lock(_stateMutex);
      surface = _surface.lock();
      width = _layoutWidth;
      height = _layoutHeight;
      opaque = _opaque;
      highBitDepth = _highBitDepth;
    }
    RNSkGraphiteTargetInfo info;
    if (surface && surface->getTargetInfo(&info)) {
      return info;
    }
#if defined(__ANDROID__)
    // The 10-bit buffer format only has 2 bits of alpha: translucent views
    // stay 8-bit.
    if (!opaque) {
      highBitDepth = false;
    }
#else
    (void)opaque;
#endif
    if (!surface || !surface->getLayoutSize(&info.width, &info.height)) {
      // Not laid out yet (JS gets its onLayout before the platform lays the
      // view out): the size JS measured, in points. The layout is on the
      // pixel grid, so the product is an integer up to rounding errors.
      double pd = requestedDensity>0?requestedDensity:pointScale();
      info.width = static_cast<int>(std::lround(width * pd));
      info.height = static_cast<int>(std::lround(height * pd));
    } else {
    }
    info.colorType = _context->getGpuContext().targetColorType(highBitDepth);
    info.useP3ColorSpace = _context->prefersP3ColorSpace();
    info.textureInfo = _context->getGpuContext().textureInfo(info.colorType);
    return info;
  }

  // Density belongs to this producer/View, not the process-global platform
  // context created at startup. Each snapped recording keeps its own transform.
  std::atomic<float> _nelyxPixelDensity{0};
  float pointScale(){const auto density=_nelyxPixelDensity.load();return density>0?density:_context->getPixelDensity();}
  std::shared_ptr<NelyxGraphiteAdmission> _nelyx=std::make_shared<NelyxGraphiteAdmission>();
  std::shared_ptr<RNSkPlatformContext> _context;

  // Recorder, open recording and target description.
  std::mutex _stateMutex;
  std::shared_ptr<RNSkGraphiteRecorder> _recorder;
  bool _recording = false;
  RNSkGraphiteTargetInfo _recordingTarget;
  RNSkGraphiteTargetInfo _nelyxReservedTarget;
  std::weak_ptr<RNSkWindowSurface> _surface;
  float _layoutWidth = 0;
  float _layoutHeight = 0;
  bool _opaque = false;
  bool _highBitDepth = false;

  // Hand-off to the main thread.
  std::mutex _queueMutex;
  std::deque<std::shared_ptr<RNSkGraphiteRecording>> _queue;
  std::function<void()> _requestFrame;
  std::function<void()> _nelyxCloseCallback;
};

/**
 * Targets by native view id. Entries are weak: a target lives as long as the
 * view or a JS context object holds it.
 */
class RNSkGraphiteTargetRegistry {
public:
  static RNSkGraphiteTargetRegistry &getInstance() {
    static RNSkGraphiteTargetRegistry instance;
    return instance;
  }

  RNSkGraphiteTargetRegistry(const RNSkGraphiteTargetRegistry &) = delete;
  RNSkGraphiteTargetRegistry &
  operator=(const RNSkGraphiteTargetRegistry &) = delete;

  std::shared_ptr<RNSkGraphiteTarget>
  getOrCreate(size_t nativeId,
              const std::shared_ptr<RNSkPlatformContext> &context) {
    std::lock_guard<std::mutex> lock(_mutex);
    const Key key{context.get(),nativeId};
    auto it = _targets.find(key);
    if (it != _targets.end()) {
      if (auto target = it->second.lock()) {
        if(!target->nelyxIsClosed())return target;
      }
    }
    for (auto entry = _targets.begin(); entry != _targets.end();) {
      entry = entry->second.expired() ? _targets.erase(entry) : ++entry;
    }
    auto target = std::make_shared<RNSkGraphiteTarget>(context);
    _targets[key] = target;
    return target;
  }

private:
  RNSkGraphiteTargetRegistry() = default;
  std::mutex _mutex;
  struct Key {const RNSkPlatformContext* owner;size_t id;bool operator==(const Key& other) const{return owner==other.owner && id==other.id;}};
  struct Hash {size_t operator()(const Key& key) const{return std::hash<const void*>{}(key.owner)^(std::hash<size_t>{}(key.id)<<1);}};
  std::unordered_map<Key,std::weak_ptr<RNSkGraphiteTarget>,Hash> _targets;
};

} // namespace RNSkia
