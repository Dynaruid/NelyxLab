// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "protocol/wire.hpp"
#include <array>
#include <memory>
#include <optional>

namespace nelyx::v2 {
inline constexpr uint32_t coreCapabilities = wire::capabilities::protocol | wire::capabilities::headlessScene |
  wire::capabilities::scroll | wire::capabilities::motion | wire::capabilities::layoutQueries |
  wire::capabilities::editing | wire::capabilities::semantics | wire::capabilities::lazyList |
  wire::capabilities::gestures | wire::capabilities::controls |
  wire::capabilities::rawObserver | wire::capabilities::appControlled | wire::capabilities::graphics | wire::capabilities::memoryBudget | wire::capabilities::nativeExtensions | wire::capabilities::paragraphLayout | wire::capabilities::paragraphStyles | wire::capabilities::clipStyles | wire::capabilities::canonicalHitTest | wire::capabilities::gestureDetails | wire::capabilities::canonicalControls | wire::capabilities::appFrameClock | wire::capabilities::canonicalMaterial | wire::capabilities::canonicalSelection | wire::capabilities::canonicalFocus | wire::capabilities::canonicalSwitch | wire::capabilities::canonicalSlider | wire::capabilities::layerLinks | wire::capabilities::paintPrograms | wire::capabilities::fontResources;
struct Ledger;
struct Preparation;
struct Frame;
struct MeasurementRequest;
struct InteractionSnapshot;
struct FontTransition;
struct EventOverflowInfo;
struct PreparationFailureInfo;
/** In-process diagnostics only. No packet schema or scheduling authority. */
struct PreparationCohort {
  uint64_t preparation=0,document=0,metrics=0,device=0,font=0;
  bool operator==(const PreparationCohort&)const=default;
};
struct PreparationViewportProgress {
  Handle node{},content{};uint64_t listGeneration=0;
  uint32_t begin=0,end=0;bool coverage=false,deferred=false,published=false;
  double minimum=0,maximum=0,offset=0,requested=0,publishedOffset=0,publishedRequested=0;
};
struct PreparationProgress {
  uint32_t session=0,app=0,view=0,generation=0;
  PreparationCohort current{},active{},published{};
  uint64_t sequence=0,input=0,publication=0;
  bool closed=false,preparing=false,ready=false,providerReady=false,hasRequest=false,truncated=false;
  struct Request {
    Handle node{},viewport{};uint64_t id=0,revision=0,listGeneration=0;
    bool list=false;uint32_t begin=0,end=0;double offset=0,paint=0;
  } request;
  uint32_t viewportCount=0,publishedViewportCount=0;
  std::array<PreparationViewportProgress,16> viewports{};
  std::array<PreparationViewportProgress,16> publishedViewports{};
};
struct DispatchTiming {
  double lockWaitMs=0,lockHeldMs=0;
  bool capturePreparation=false;
  std::optional<PreparationProgress> preparation;
};
class Engine {
 public:
  Engine(uint32_t session, uint32_t app);
  ~Engine();
  std::shared_ptr<Ledger> memoryLedger() const;
  std::vector<uint8_t> dispatch(Reader packet,DispatchTiming* timing=nullptr);
  // In-process Render delivery: the normal takeFrame admission/state reply,
  // with an immutable, ledger-backed reader instead of serialized paint rows.
  // This is not a wire mode and is never exposed through the C/JS transport.
  std::vector<uint8_t> dispatchNativeFrame(Reader packet,std::shared_ptr<const Frame>& frame,DispatchTiming* timing=nullptr);
  void connectProvider(bool independent, uint64_t contentOwner, uint64_t renderOwner);
  std::shared_ptr<const Preparation> providerSnapshot(uint32_t view, uint32_t generation);
  std::shared_ptr<const MeasurementRequest> measurementSnapshot(uint32_t view, uint32_t generation);
  std::shared_ptr<const Frame> frameSnapshot(uint32_t view, uint32_t generation, uint64_t id);
  std::shared_ptr<const InteractionSnapshot> interactionSnapshot(uint32_t view,uint32_t generation,
    const std::shared_ptr<const InteractionSnapshot>& previous=nullptr);
  std::shared_ptr<const FontTransition> fontTransitionSnapshot(uint32_t view,uint32_t generation);
  std::shared_ptr<const EventOverflowInfo> eventOverflowSnapshot(uint32_t view,uint32_t generation);
  std::shared_ptr<const PreparationFailureInfo> preparationFailureSnapshot(uint32_t view,uint32_t generation);
 private:
  struct State;
  std::unique_ptr<State> state_;
  std::vector<uint8_t> dispatchImpl(Reader packet,DispatchTiming* timing,std::shared_ptr<const Frame>* nativeFrame);
};
}
