// SPDX-License-Identifier: BSD-3-Clause
#include "../engine.hpp"
#include "../state.hpp"
#include "../interaction/semantics_data.hpp"
#include "observation.hpp"
#include <algorithm>
#include <mutex>
#include <set>
#include <unordered_set>
#include <chrono>

namespace nelyx::v2 {
struct Engine::State {
  std::mutex mutex;
  uint32_t session, app;
  bool closed = false;
  bool closing = false;
  std::shared_ptr<Ledger> ledger = std::make_shared<Ledger>();
  Resources resources{};
  std::array<std::shared_ptr<View>, wire::limits::views + 1> views;
  std::array<uint32_t, wire::limits::views + 1> generations{};
  bool providerConnected = false, independent = false;
  uint64_t contentOwner = 0, renderOwner = 0, resourceRevision = 0;
  State(uint32_t s, uint32_t a) : session(s), app(a) { generations.fill(1); }
};
Engine::Engine(uint32_t session, uint32_t app) : state_(std::make_unique<State>(session, app)) {}
Engine::~Engine() = default;
std::shared_ptr<Ledger> Engine::memoryLedger()const{return state_->ledger;}
void Engine::connectProvider(bool independent, uint64_t contentOwner, uint64_t renderOwner) {
  auto& s = *state_; std::lock_guard lock(s.mutex);
  require(contentOwner && renderOwner && (!independent || contentOwner != renderOwner), wire::statuses::invalidValue);
  require(!s.providerConnected && !s.closed && !s.closing, wire::statuses::busy);
  for (const auto& v : s.views) require(!v || (!v->active && !v->preparing), wire::statuses::busy);
  s.providerConnected = true; s.independent = independent; s.contentOwner = contentOwner; s.renderOwner = renderOwner;
  for (auto& v : s.views) if (v) v->providerRequired = true;
}
std::shared_ptr<const Preparation> Engine::providerSnapshot(uint32_t view, uint32_t generation) {
  auto& s = *state_; std::lock_guard lock(s.mutex);
  require(view && view < s.views.size() && s.views[view] && s.views[view]->generation == generation,
    wire::statuses::invalidHandle);
  const auto& v = *s.views[view];
  if (!v.preparing || !v.preparing->ready) return nullptr;
  return std::make_shared<const Preparation>(*v.preparing);
}
std::shared_ptr<const FontTransition> Engine::fontTransitionSnapshot(uint32_t view,uint32_t generation){
  auto& s=*state_;std::lock_guard lock(s.mutex);
  if(!view||view>=s.views.size()||!s.views[view]||s.views[view]->generation!=generation||s.views[view]->closed)return nullptr;
  const auto& v=*s.views[view];if(!v.fontTransition.token)return nullptr;
  auto result=std::make_shared<FontTransition>(v.fontTransition);
  if(result->phase==wire::fontTransitionPhases::committed&&result->revision==v.fontRevision)result->resource=v.fontResource;
  return result;
}
std::shared_ptr<const EventOverflowInfo> Engine::eventOverflowSnapshot(uint32_t view,uint32_t generation){
  auto& s=*state_;std::lock_guard lock(s.mutex);
  if(!view||view>=s.views.size()||!s.views[view]||s.views[view]->generation!=generation||!s.views[view]->eventOverflow.queue)return nullptr;
  auto result=std::make_shared<EventOverflowInfo>(s.views[view]->eventOverflow);
  result->lease=std::make_shared<Lease>(s.ledger,sizeof(EventOverflowInfo)+64);return result;
}
std::shared_ptr<const PreparationFailureInfo> Engine::preparationFailureSnapshot(uint32_t view,uint32_t generation){
  auto& s=*state_;std::lock_guard lock(s.mutex);
  if(!view||view>=s.views.size()||!s.views[view]||s.views[view]->generation!=generation||!s.views[view]->preparationFailure.preparation)return nullptr;
  auto result=std::make_shared<PreparationFailureInfo>(s.views[view]->preparationFailure);
  result->lease=std::make_shared<Lease>(s.ledger,sizeof(PreparationFailureInfo)+64);return result;
}
std::shared_ptr<const Frame> Engine::frameSnapshot(uint32_t view, uint32_t generation, uint64_t id) {
  auto& s = *state_; std::lock_guard lock(s.mutex);
  require(view && view < s.views.size() && s.views[view] && s.views[view]->generation == generation,
    wire::statuses::invalidHandle);
  const auto& frames = s.views[view]->frames;
  const auto it = frames.find(id); require(it != frames.end(), wire::statuses::stale);
  return std::make_shared<const Frame>(it->second);
}
std::shared_ptr<const MeasurementRequest> Engine::measurementSnapshot(uint32_t view, uint32_t generation) {
  auto& s = *state_; std::lock_guard lock(s.mutex);
  require(view && view < s.views.size() && s.views[view] && s.views[view]->generation == generation,
    wire::statuses::invalidHandle);
  const auto& v = *s.views[view];const auto pending=v.measurement();
  if (!pending) return nullptr;
  auto request = std::make_shared<MeasurementRequest>(*pending);
  request->preparation = v.measurePreparation();
  return request;
}

std::shared_ptr<const InteractionSnapshot> Engine::interactionSnapshot(uint32_t view,uint32_t generation) {
  auto& s=*state_;std::lock_guard lock(s.mutex);
  if(!view||view>=s.views.size()||!s.views[view]||s.views[view]->generation!=generation)return nullptr;
  const auto& v=*s.views[view];if(v.closed||!v.published)return nullptr;
  const auto& frame=*v.published;
  auto held=std::make_shared<Lease>(s.ledger,sizeof(InteractionSnapshot)+frame.properties.size()*sizeof(Property)+
    frame.items.size()*sizeof(DrawItem)+frame.clips.size()*sizeof(ClipShape)+frame.hitRegions.size()*sizeof(HitRegionShape)+
    frame.semantics.size()*sizeof(FrameSemantics)+(frame.observationRows.capacity()+frame.itemBySlot.capacity())*sizeof(uint32_t)+frame.observationRemoved.capacity()*sizeof(Handle)+v.editors.size()*(sizeof(std::pair<const uint64_t,std::shared_ptr<const EditingValue>>)+64));
  auto result=std::make_shared<InteractionSnapshot>();result->snapshotLease=std::move(held);result->frame=frame;result->document=v.document;
  result->focus=v.focusNode;result->session=v.focusSession;result->metrics=v.metrics;result->visible=v.visible;
  for(const auto& entry:v.editors)result->editors.emplace(entry.first,entry.second->value);return result;
}
namespace {
constexpr uint32_t capabilities = coreCapabilities;
void exact(Reader r, size_t count) { require(r.length == count); }
std::shared_ptr<const Resource> documentFont(const Document* document,Handle resource){
  if(document)for(const auto& slot:document->nodes)if(slot.value&&slot.value->fontResource&&slot.value->fontResource->id==resource)
    return slot.value->fontResource;
  return nullptr;
}
std::shared_ptr<const Resource> documentImage(const Document* document,Handle resource){
  if(document)for(const auto& slot:document->nodes)if(slot.value&&slot.value->resource&&slot.value->resource->id==resource)
    return slot.value->resource;
  return nullptr;
}
void invalidate(View& v, uint32_t reason) {
  v.publications.fill(nullptr);
  v.caretDeadline = 0;
  v.cancelQuery(reason);
  v.cancelInput(reason);
  // A control fence ended the old streams. The next valid metrics/source may
  // begin a standalone OS-resolved wheel update without a synthetic Begin.
  for (auto& stream : v.streams) stream.denied = false;
  if (v.preparing) {
    v.event({wire::events::preparationCanceled, reason, v.preparing->id, v.preparing->document->epoch});
    v.preparing.reset();
  }
  v.requestContent(); v.dirty = true;
}
Input readInput(Reader r) {
  exact(r, wire::inputBytes);
  Input p{r.u64(wire::inputFields::sequence), r.u64(wire::inputFields::metrics), handle(r, wire::inputFields::target), r.u32(wire::inputFields::stream), r.u32(wire::inputFields::phase), r.u32(wire::inputFields::source), r.u32(wire::inputFields::flags),
    r.f64(wire::inputFields::time), r.f64(wire::inputFields::sample), r.f64(wire::inputFields::x), r.f64(wire::inputFields::y), r.f64(wire::inputFields::dx), r.f64(wire::inputFields::dy), r.f64(wire::inputFields::velocity),
    r.u32(wire::inputFields::clock), r.u32(wire::inputFields::buttons), r.u32(wire::inputFields::modifiers), r.u32(wire::inputFields::device), r.u32(wire::inputFields::contact),r.u32(wire::inputFields::kind),r.u64(wire::inputFields::publication),{},false};
  require(p.sequence > 0 && p.metrics > 0 && p.stream > 0 && p.stream <= wire::limits::streams &&
    p.phase >= wire::phases::begin && p.phase <= wire::phases::cancel &&
    p.source >= wire::sources::engineDriven && p.source <= wire::sources::wheelUnknown &&
    (p.flags & ~7u) == 0 && (!(p.flags&4u)||(p.flags&2u)) && p.time >= 0 && p.sample >= 0 && p.clock > 0 && p.clock <= 3 &&
    p.kind <= wire::pointerKinds::trackpad, wire::statuses::invalidValue);
  return p;
}
void nodeRow(Writer& w, size_t p, const Node& n, const Property* o, uint32_t flags, const DrawItem* item = nullptr) {
  writeHandle(w, p, n.id); w.u32(p + 8, n.kind); writeHandle(w, p + 12, n.parent);
  w.u32(p + 20, flags | (item?item->flags:0u) | (o && o->deferred ? 64u : 0u) | (n.coverage.enabled ? 128u : 0u)|(n.extensionSize.x>0?wire::nodeFlags::nativeExtension:0u)|
    (n.nativePaint&&n.nativePaint->frameDependent?wire::nodeFlags::livePaint:0u)|(n.paintOwner?wire::nodeFlags::paintResource:0u)|(n.inlineHidden?wire::nodeFlags::inlineHidden:0u));
  w.f64(p + 24, item ? item->x : n.properties.x); w.f64(p + 32, item ? item->y : n.properties.y);
  w.f64(p + 40, n.properties.width); w.f64(p + 48, n.properties.height);
  w.f64(p + 56, o ? o->offset : 0); w.f64(p + 64, o ? o->velocity : 0);
  w.u64(p + 72, o ? o->revision : 0); w.f64(p + 80, item ? item->opacity : o ? o->opacity : n.properties.opacity);
  w.u64(p + 88, o ? o->motion : 0);
  w.u32(p + wire::nodeFields::color, n.color); w.u32(p + wire::nodeFields::order, n.order);
  w.f64(p + wire::nodeFields::radius, n.radius); w.f64(p + wire::nodeFields::fontSize, n.fontSize);
  writeHandle(w, p + wire::nodeFields::resource, n.resource ? n.resource->id : Handle{});
  w.f64(p + wire::nodeFields::baseline, n.baseline); w.u64(p + wire::nodeFields::layoutRevision, n.layoutRevision);
  w.u32(p + wire::nodeFields::textDirection, n.textDirection);
  w.f64(p + wire::nodeFields::requestedOffset,o?o->requested:0);
  w.f64(p + wire::nodeFields::preparedMinimum,n.coverage.minimum);
  w.f64(p + wire::nodeFields::preparedMaximum,n.coverage.maximum);
  w.u64(p + wire::nodeFields::coverageRevision,n.coverage.revision);
  w.f64(p + wire::nodeFields::contentX,n.contentX);
  w.f64(p + wire::nodeFields::contentY,n.contentY);
  w.f64(p + wire::nodeFields::contentWidth,n.contentWidth);
  w.f64(p + wire::nodeFields::contentHeight,n.contentHeight);
  w.f64(p + wire::nodeFields::scrollMinimum,n.properties.minimum);
  w.f64(p + wire::nodeFields::scrollMaximum,n.properties.maximum);
  const auto matrix=item?item->world:Affine{1,0,0,1,n.properties.x,n.properties.y};
  const std::array<double,6> values{matrix.a,matrix.b,matrix.c,matrix.d,matrix.tx,matrix.ty};
  for(size_t i=0;i<values.size();++i)w.f64(p+wire::nodeFields::matrix+i*8,values[i]);
  const auto bounds=item?item->bounds:Rect{n.properties.x,n.properties.y,n.properties.width,n.properties.height};
  w.f64(p+wire::nodeFields::boundsX,bounds.x);w.f64(p+wire::nodeFields::boundsY,bounds.y);
  w.f64(p+wire::nodeFields::boundsWidth,bounds.width);w.f64(p+wire::nodeFields::boundsHeight,bounds.height);
  w.u32(p+wire::nodeFields::clipHead,item?item->clipHead:0);w.u32(p+wire::nodeFields::depth,item?item->depth:0);
  w.f64(p+wire::nodeFields::localOpacity,o?o->opacity:n.properties.opacity);
  if (item) {
    w.f64(p + wire::nodeFields::clipX, item->clip.x); w.f64(p + wire::nodeFields::clipY, item->clip.y);
    w.f64(p + wire::nodeFields::clipWidth, item->clip.width); w.f64(p + wire::nodeFields::clipHeight, item->clip.height);
  }
}
}

std::vector<uint8_t> Engine::dispatch(Reader packet,DispatchTiming* timing) {
  auto& s = *state_;
  using Clock=std::chrono::steady_clock;
  auto lockAt=timing?Clock::now():Clock::time_point{};
  std::unique_lock lock(s.mutex);
  struct LockTiming {
    DispatchTiming* output;Clock::time_point at;
    void acquired(Clock::time_point started){if(output){at=Clock::now();output->lockWaitMs+=std::chrono::duration<double,std::milli>(at-started).count();}}
    void released(){if(output)output->lockHeldMs+=std::chrono::duration<double,std::milli>(Clock::now()-at).count();}
    ~LockTiming(){released();}
  } measured{timing,{}};
  if(timing){*timing={};measured.acquired(lockAt);}
  const uint32_t actualCapabilities = capabilities | (s.providerConnected ? wire::capabilities::surface : 0) |
    (s.independent ? wire::capabilities::contentIndependent : 0);
  uint32_t status = wire::statuses::ok, opcode = 0, viewId = 0, generation = 0;
  uint64_t id = 0, resultEpoch = 0;
  View* view = nullptr;
  std::shared_ptr<View> retained;
  const Frame* frame = nullptr;
  struct UnissuedFrame {
    View* view=nullptr;uint64_t id=0;bool issued=false;
    void retire(){if(view&&id&&!issued){view->frames.erase(id);view->dirty=true;id=0;}}
    ~UnissuedFrame(){retire();}
  } unissuedFrame;
  Handle editTarget;
  std::shared_ptr<const Resource> fontRead,imageRead;
  std::optional<SnapshotDecision> snapshotDecision;
  Handle snapshotTarget;
  uint32_t imageReadOffset=0,imageReadLength=0;
  uint32_t fontReadOffset=0,fontReadLength=0;
  std::vector<Event> events;
  bool stateOnlyInspection=false,appObservation=false,browserObservation=false;
  bool selectedLayout=false;
  bool deltaObservation=false;
  bool providerFrameDelta=false,providerFrameRelease=false;
  bool providerPreparationDelta=false,providerPreparationRelease=false;
  uint64_t observationBase=0;
  std::vector<Handle> layoutSelection;
  try {
    require(packet.length >= wire::headerBytes && packet.length <= wire::limits::packetBytes);
    opcode = packet.u16(wire::headerFields::opcode); viewId = packet.u32(wire::headerFields::view); generation = packet.u32(wire::headerFields::generation); id = packet.u64(wire::headerFields::id);
    require(packet.u32(wire::headerFields::magic) == wire::magic && packet.u32(wire::headerFields::length) == packet.length &&
      packet.u16(wire::headerFields::status) == 0 && packet.u32(wire::headerFields::reserved) == 0 && packet.u32(wire::headerFields::reservedTail) == 0);
    require(packet.u16(wire::headerFields::major) == wire::abiMajor && packet.u16(wire::headerFields::minor) <= wire::abiMinor &&
      packet.u32(wire::headerFields::schema) == wire::schema, wire::statuses::incompatible);
    require(packet.u32(wire::headerFields::session) == s.session && packet.u32(wire::headerFields::app) == s.app, wire::statuses::staleGeneration);
    const auto body = packet.slice(wire::headerBytes, packet.length - wire::headerBytes);
    if(opcode==wire::opcodes::inspect){
      require(body.length==0||(body.length==4&&body.u32(0)==wire::inspectionFlags::stateOnly));
      stateOnlyInspection=body.length==4;
    }
    if(opcode==wire::opcodes::layoutSnapshot||opcode==wire::opcodes::semanticsSnapshot){
      browserObservation=opcode==wire::opcodes::semanticsSnapshot&&body.length==4&&
        body.u32(0)==wire::inspectionFlags::browserObservation;
      deltaObservation=body.length>=16&&(body.u32(0)==wire::inspectionFlags::appObservationDelta||body.u32(0)==wire::inspectionFlags::appLayoutDelta);
      selectedLayout=opcode==wire::opcodes::layoutSnapshot&&body.length>=8&&
        (body.u32(0)==wire::inspectionFlags::appLayoutSelection||body.u32(0)==wire::inspectionFlags::appLayoutDelta);
      if(selectedLayout){
        const size_t header=deltaObservation?16:8;
        const auto count=body.u32(4);require(count<=wire::limits::nodes&&body.length==header+size_t(count)*8);
        std::unordered_set<uint64_t> seen;
        for(uint32_t i=0;i<count;++i){const auto node=handle(body,header+size_t(i)*8);
          require(node&&node.slot<=wire::limits::nodes&&node.generation&&seen.insert(node.key()).second);
          layoutSelection.push_back(node);}
      }else if(deltaObservation)require(body.length==16&&
        body.u32(0)==wire::inspectionFlags::appObservationDelta&&!body.u32(4));
      else require(body.length==0||browserObservation||(body.length==4&&body.u32(0)==wire::inspectionFlags::appObservation));
      if(deltaObservation)observationBase=body.u64(8);
      appObservation=body.length!=0;
    }
    if(opcode==wire::opcodes::takeFrame&&body.length){
      exact(body,16);require(body.u32(0)==wire::inspectionFlags::providerFrameDelta&&body.u32(4)<=1);
      providerFrameDelta=true;providerFrameRelease=body.u32(4)==1;observationBase=body.u64(8);
      require(!providerFrameRelease||!observationBase);
    }
    if(opcode==wire::opcodes::preparationScene&&body.length){
      exact(body,16);require(body.u32(0)==wire::inspectionFlags::providerPreparationDelta&&body.u32(4)<=1);
      providerPreparationDelta=true;providerPreparationRelease=body.u32(4)==1;observationBase=body.u64(8);
      require(!providerPreparationRelease||!observationBase);
    }
    const auto count = packet.u32(wire::headerFields::count);
    require(opcode == wire::opcodes::transaction || count == 0);
    require(!s.closed || opcode == wire::opcodes::inspect || opcode == wire::opcodes::closeSession||opcode==wire::opcodes::memoryReport,
      wire::statuses::closed);
    require(!s.closing || opcode == wire::opcodes::inspect || opcode == wire::opcodes::closeSession ||
      opcode == wire::opcodes::pollEvents || opcode == wire::opcodes::releaseFrame ||
      opcode == wire::opcodes::closeView||opcode==wire::opcodes::memoryReport, wire::statuses::closed);
    if (opcode == wire::opcodes::hello) {
      exact(body, 8); require(viewId == 0 && generation == 0 && body.u32(4) == 0);
      require((body.u32(0) & ~actualCapabilities) == 0, wire::statuses::capabilityMissing);
    } else if(opcode==wire::opcodes::memoryReport){
      require(body.length==16||body.length==wire::memoryReportHeadroomBytes);
      require(!viewId&&!generation,wire::statuses::invalidHandle);
      s.ledger->report(body.u32(0),body.u32(4),body.u64(8),s.closed||s.closing,body.length==16?0:body.u64(16));
    } else if (opcode == wire::opcodes::closeSession) {
      exact(body, 0); require(viewId == 0 && generation == 0);
      s.closing = true;
      bool held = false;
      for (auto& v : s.views) if (v) { v->close(wire::statuses::closed); held |= !v->frames.empty() || v->transactionActive; }
      if (held) status = wire::statuses::busy;
      else {
        for (auto& v : s.views) v.reset();
        s.resources = {}; s.closed = true; s.closing = false;
      }
    } else if (viewId == 0 && opcode == wire::opcodes::inspect) {
      require(generation == 0);
    } else {
      require(viewId > 0 && viewId <= wire::limits::views && generation > 0, wire::statuses::invalidHandle);
      if (opcode == wire::opcodes::openView) {
        exact(body, 0);
        require(!s.views[viewId] || s.views[viewId]->closed, wire::statuses::busy);
        require(!s.views[viewId] || s.views[viewId]->frames.empty(), wire::statuses::busy);
        require(!s.views[viewId] || !s.views[viewId]->transactionActive, wire::statuses::busy);
        require(!s.views[viewId] || s.views[viewId]->generation != UINT32_MAX, wire::statuses::exhausted);
        require(generation >= s.generations[viewId], wire::statuses::staleGeneration);
        s.views[viewId] = std::make_shared<View>(generation, s.ledger);
        s.views[viewId]->providerRequired = s.providerConnected;
        s.generations[viewId] = generation;
      }
      require(s.views[viewId] && s.views[viewId]->generation == generation, wire::statuses::staleGeneration);
      retained = s.views[viewId]; view = retained.get();
      auto& v = *view;
      resultEpoch = v.document ? v.document->epoch : 0;
      require(!v.closed || opcode == wire::opcodes::inspect || opcode == wire::opcodes::pollEvents ||
        opcode == wire::opcodes::closeView || opcode == wire::opcodes::releaseFrame, wire::statuses::closed);
      if(opcode==wire::opcodes::fontTransitionBegin){
        exact(body,8);const auto target=handle(body,0);auto& transition=v.fontTransition;
        require(id>0,wire::statuses::invalidValue);
        require(bool(target)||target.generation==0,wire::statuses::invalidHandle);
        if(id==transition.token){
          require(target==transition.target,wire::statuses::idReused);
          require(transition.phase!=wire::fontTransitionPhases::aborted,wire::statuses::stale);
        }else{
          require(id>transition.token,wire::statuses::stale);
          require(transition.phase!=wire::fontTransitionPhases::preparing&&!v.fontUpload&&!v.transactionActive,wire::statuses::busy);
          std::shared_ptr<const Resource> resource;
          if(target){require(target.slot<s.resources.size()&&s.resources[target.slot].value&&
              s.resources[target.slot].value->id==target&&s.resources[target.slot].value->fontCatalog,wire::statuses::invalidHandle);
            resource=s.resources[target.slot].value;}
          transition={};transition.token=id;transition.target=target;transition.resource=std::move(resource);
          transition.phase=wire::fontTransitionPhases::preparing;
        }
      }else if(opcode==wire::opcodes::fontTransitionReady){
        exact(body,8);auto& transition=v.fontTransition;const auto owner=body.u32(0),failure=body.u32(4);
        require(owner==wire::fontTransitionOwners::app||owner==wire::fontTransitionOwners::content||owner==wire::fontTransitionOwners::render,wire::statuses::invalidValue);
        require(failure==0||failure==wire::statuses::invalidValue||failure==wire::statuses::budgetExceeded||failure==wire::statuses::closed,wire::statuses::invalidValue);
        require(id>0&&id==transition.token,wire::statuses::stale);
        require(transition.phase!=wire::fontTransitionPhases::aborted,wire::statuses::stale);
        if(transition.phase==wire::fontTransitionPhases::committed)require(!failure&&(transition.ready&owner),wire::statuses::stale);
        else if(transition.phase==wire::fontTransitionPhases::preparing){
          if(failure){transition.phase=wire::fontTransitionPhases::failed;transition.failedOwner=owner;
            transition.failedStatus=failure;transition.resource.reset();}
          else transition.ready|=owner;
        }
      }else if(opcode==wire::opcodes::fontTransitionCommit){
        exact(body,16);auto& transition=v.fontTransition;const auto revision=body.u64(0),after=body.u64(8);
        require(id>0&&id==transition.token,wire::statuses::stale);
        if(transition.phase==wire::fontTransitionPhases::committed){
          require(revision==transition.revision&&after==transition.lastInput,wire::statuses::idReused);
        }else{
          require(transition.phase==wire::fontTransitionPhases::preparing,wire::statuses::stale);
          require(transition.ready==7,wire::statuses::pending);
          require(revision>v.fontRevision&&revision<=9007199254740991ull&&after==v.lastInput,wire::statuses::stale);
          v.fontResource=transition.resource;v.fontRevision=revision;transition.revision=revision;transition.lastInput=after;
          transition.phase=wire::fontTransitionPhases::committed;transition.resource.reset();invalidate(v,wire::statuses::stale);
        }
      }else if(opcode==wire::opcodes::fontTransitionAbort){
        exact(body,0);auto& transition=v.fontTransition;
        require(id>0&&id==transition.token&&transition.phase!=wire::fontTransitionPhases::committed,wire::statuses::stale);
        transition.resource.reset();transition.phase=wire::fontTransitionPhases::aborted;
      }else if(opcode==wire::opcodes::fontResourceRelease){
        exact(body,8);const auto target=handle(body,0);
        require(target.slot>0&&target.slot<s.resources.size()&&target.generation>0,wire::statuses::invalidHandle);
        auto& slot=s.resources[target.slot];
        if(slot.value&&slot.value->id==target){
          require(slot.value->fontCatalog,wire::statuses::invalidHandle);
          require(target.generation!=UINT32_MAX,wire::statuses::exhausted);
          slot={target.generation+1,nullptr};++s.resourceRevision;
        }else require(slot.generation>target.generation,wire::statuses::invalidHandle);
      }else if(opcode==wire::opcodes::imageUploadBegin){
        exact(body,16);const auto target=handle(body,0);const auto size=body.u32(8);
        require(id>0&&body.u32(12)==0&&size>0&&size<=wire::limits::resourceBytes,wire::statuses::invalidValue);
        require(target.slot>0&&target.slot<s.resources.size()&&target.generation>0,wire::statuses::invalidHandle);
        if(id==v.lastImageUpload){
          require(v.imageUploadStatus!=3&&target==v.lastImageResource&&size==v.imageUploadBytes,wire::statuses::idReused);
        }else{
          require(id>v.lastImageUpload,wire::statuses::stale);
          require(!v.imageUpload&&!v.transactionActive,wire::statuses::busy);
          require(!s.resources[target.slot].value&&target.generation>=s.resources[target.slot].generation,wire::statuses::invalidHandle);
          auto candidate=std::make_unique<ResourceUpload>(s.ledger,id,target,size);
          v.imageUpload=std::move(candidate);v.lastImageUpload=id;v.lastImageResource=target;v.imageUploadStatus=1;v.imageUploadBytes=size;
        }
      }else if(opcode==wire::opcodes::imageUploadChunk){
        require(body.length>=8&&v.imageUpload&&v.imageUpload->token==id,wire::statuses::stale);
        const auto offset=body.u32(0),size=body.u32(4);const auto padded=paragraphAligned(size);
        require(size>0&&size<=wire::limits::imageChunkBytes&&body.length==8+padded,wire::statuses::invalidValue);
        for(size_t i=size;i<padded;++i)require(body.data[8+i]==0);
        auto& upload=*v.imageUpload;const auto total=upload.storage->bytes.size();
        require(offset<=upload.filled&&offset<=total&&size<=total-offset,wire::statuses::stale);
        if(offset<upload.filled){
          require(size<=upload.filled-offset,wire::statuses::stale);
          require(std::equal(body.data+8,body.data+8+size,upload.storage->bytes.data()+offset),wire::statuses::idReused);
        }else{
          // All validation precedes this non-allocating append. No partial write
          // or old typed-array view can become visible to another owner.
          std::copy_n(body.data+8,size,upload.storage->bytes.data()+offset);upload.filled+=size;
        }
      }else if(opcode==wire::opcodes::imageUploadCommit){
        exact(body,0);require(id>0&&id==v.lastImageUpload,wire::statuses::stale);
        if(v.imageUploadStatus!=2){
          require(v.imageUpload&&v.imageUpload->token==id,wire::statuses::stale);
          require(!v.transactionActive,wire::statuses::busy);
          const auto& upload=*v.imageUpload;require(upload.filled==upload.storage->bytes.size(),wire::statuses::pending);
          const auto target=upload.resource;
          require(!s.resources[target.slot].value&&target.generation>=s.resources[target.slot].generation,wire::statuses::invalidHandle);
          auto resource=std::make_shared<Resource>(s.ledger,target,upload.storage,false);
          s.resources[target.slot]={target.generation,std::move(resource)};++s.resourceRevision;
          v.imageUpload.reset();v.imageUploadStatus=2;
        }
      }else if(opcode==wire::opcodes::imageUploadAbort){
        exact(body,0);require(id>0&&id==v.lastImageUpload&&v.imageUploadStatus!=2,wire::statuses::stale);
        v.imageUpload.reset();v.imageUploadStatus=3;
      }else if(opcode==wire::opcodes::fontUploadBegin){
        exact(body,16);const auto target=handle(body,0);const auto size=body.u32(8);
        require(id>0&&body.u32(12)==0&&size>=32&&size<=wire::limits::fontCatalogBytes,wire::statuses::invalidValue);
        require(target.slot>0&&target.slot<s.resources.size()&&target.generation>0,wire::statuses::invalidHandle);
        if(id==v.lastFontUpload){
          require(v.fontUploadStatus!=3&&target==v.lastFontResource&&size==v.fontUploadBytes,wire::statuses::idReused);
        }else{
          require(id>v.lastFontUpload,wire::statuses::stale);
          require(!v.fontUpload&&!v.transactionActive&&v.fontTransition.phase!=wire::fontTransitionPhases::preparing,wire::statuses::busy);
          require(!s.resources[target.slot].value&&target.generation>=s.resources[target.slot].generation,wire::statuses::invalidHandle);
          auto candidate=std::make_unique<ResourceUpload>(s.ledger,id,target,size);
          v.fontUpload=std::move(candidate);v.lastFontUpload=id;v.lastFontResource=target;v.fontUploadStatus=1;v.fontUploadBytes=size;
        }
      }else if(opcode==wire::opcodes::fontUploadChunk){
        require(body.length>=8&&v.fontUpload&&v.fontUpload->token==id,wire::statuses::stale);
        const auto offset=body.u32(0),size=body.u32(4);const auto padded=paragraphAligned(size);
        require(size>0&&size<=wire::limits::fontChunkBytes&&body.length==8+padded,wire::statuses::invalidValue);
        for(size_t i=size;i<padded;++i)require(body.data[8+i]==0);
        auto& upload=*v.fontUpload;const auto total=upload.storage->bytes.size();
        require(offset<=upload.filled&&offset<=total&&size<=total-offset,wire::statuses::stale);
        if(offset<upload.filled){
          require(size<=upload.filled-offset,wire::statuses::stale);
          require(std::equal(body.data+8,body.data+8+size,upload.storage->bytes.data()+offset),wire::statuses::idReused);
        }else{
          // All validation precedes this non-allocating append. No partial write
          // or old typed-array view can become visible to another owner.
          std::copy_n(body.data+8,size,upload.storage->bytes.data()+offset);upload.filled+=size;
        }
      }else if(opcode==wire::opcodes::fontUploadCommit){
        exact(body,0);require(id>0&&id==v.lastFontUpload,wire::statuses::stale);
        if(v.fontUploadStatus!=2){
          require(v.fontUpload&&v.fontUpload->token==id,wire::statuses::stale);
          const auto& upload=*v.fontUpload;require(upload.filled==upload.storage->bytes.size(),wire::statuses::pending);
          readFontCatalog({upload.storage->bytes.data(),upload.storage->bytes.size()});
          const auto target=upload.resource;
          require(!s.resources[target.slot].value&&target.generation>=s.resources[target.slot].generation,wire::statuses::invalidHandle);
          auto resource=std::make_shared<Resource>(s.ledger,target,upload.storage);
          s.resources[target.slot]={target.generation,std::move(resource)};++s.resourceRevision;
          v.fontUpload.reset();v.fontUploadStatus=2;
        }
      }else if(opcode==wire::opcodes::fontUploadAbort){
        exact(body,0);require(id>0&&id==v.lastFontUpload&&v.fontUploadStatus!=2,wire::statuses::stale);
        v.fontUpload.reset();v.fontUploadStatus=3;
      }else if(opcode==wire::opcodes::fontResourceRead){
        require(body.length==24||body.length==32);const auto target=handle(body,0);const auto preparation=body.u64(8);
        const auto transition=body.length==32?body.u64(24):0;
        if(transition){
          require(!preparation&&v.fontTransition.token==transition&&v.fontTransition.target==target,wire::statuses::stale);
          if(v.fontTransition.phase==wire::fontTransitionPhases::preparing)fontRead=v.fontTransition.resource;
          else if(v.fontTransition.phase==wire::fontTransitionPhases::committed&&v.fontTransition.revision==v.fontRevision)fontRead=v.fontResource;
          require(bool(fontRead),wire::statuses::stale);
        }else if(!preparation){
          require(target.slot>0&&target.slot<s.resources.size()&&s.resources[target.slot].value&&
            s.resources[target.slot].value->id==target&&s.resources[target.slot].value->fontCatalog,wire::statuses::invalidHandle);
          fontRead=s.resources[target.slot].value;
        }else{
          if(v.preparing&&v.preparing->id==preparation)fontRead=documentFont(v.preparing->document.get(),target);
          if(!fontRead&&v.query&&v.query->preparation==preparation)fontRead=documentFont(v.query->document.get(),target);
          if(!fontRead&&v.active&&v.active->preparation==preparation)fontRead=documentFont(v.active->document.get(),target);
          if(!fontRead)for(const auto& [key,held]:v.frames)if(held.scene&&held.scene->preparation==preparation){
            fontRead=documentFont(held.scene->document.get(),target);if(fontRead)break;
          }
          require(bool(fontRead),wire::statuses::stale);
        }
        fontReadOffset=body.u32(16);fontReadLength=body.u32(20);
        require(fontReadLength>0&&fontReadLength<=wire::limits::fontChunkBytes&&fontReadOffset<fontRead->bytes.size()&&
          fontReadLength<=fontRead->bytes.size()-fontReadOffset,wire::statuses::invalidValue);
      }else if(opcode==wire::opcodes::imageResourceRead){
        exact(body,24);const auto target=handle(body,0);const auto preparation=body.u64(8);
        if(!preparation){
          require(target.slot>0&&target.slot<s.resources.size()&&s.resources[target.slot].value&&
            s.resources[target.slot].value->id==target&&s.resources[target.slot].value->fontCatalog==false,wire::statuses::invalidHandle);
          imageRead=s.resources[target.slot].value;
        }else{
          if(v.preparing&&v.preparing->id==preparation)imageRead=documentImage(v.preparing->document.get(),target);
          if(!imageRead&&v.query&&v.query->preparation==preparation)imageRead=documentImage(v.query->document.get(),target);
          if(!imageRead&&v.active&&v.active->preparation==preparation)imageRead=documentImage(v.active->document.get(),target);
          if(!imageRead)for(const auto& [key,held]:v.frames)if(held.scene&&held.scene->preparation==preparation){
            imageRead=documentImage(held.scene->document.get(),target);if(imageRead)break;
          }
          require(bool(imageRead),wire::statuses::stale);
        }
        imageReadOffset=body.u32(16);imageReadLength=body.u32(20);
        require(imageReadLength>0&&imageReadLength<=wire::limits::imageChunkBytes&&imageReadOffset<imageRead->bytes.size()&&
          imageReadLength<=imageRead->bytes.size()-imageReadOffset,wire::statuses::invalidValue);
      }else if(opcode==wire::opcodes::imageResourceRelease){
        exact(body,8);const auto target=handle(body,0);
        require(target.slot>0&&target.slot<s.resources.size()&&target.generation>0,wire::statuses::invalidHandle);
        auto& slot=s.resources[target.slot];
        if(slot.value&&slot.value->id==target){
          require(!slot.value->fontCatalog,wire::statuses::invalidHandle);
          require(target.generation!=UINT32_MAX,wire::statuses::exhausted);
          slot={target.generation+1,nullptr};++s.resourceRevision;
        }else require(slot.generation>target.generation,wire::statuses::invalidHandle);
      }else if (opcode == wire::opcodes::transaction) {
        require(id > 0, wire::statuses::invalidValue);
        const auto existing = std::find_if(v.results.begin(), v.results.end(),
          [id](const auto& result) { return result->id == id; });
        if (existing != v.results.end()) {
          require((*existing)->payload.size() == packet.length &&
            std::equal((*existing)->payload.begin(), (*existing)->payload.end(), packet.data),
            wire::statuses::idReused);
          status = (*existing)->status; resultEpoch = (*existing)->epoch;
        } else {
          require(!v.transactionActive, wire::statuses::busy);
          require(id > v.lastTransaction, wire::statuses::resultExpired);
          while (!v.results.empty() && (v.results.size() == wire::limits::results ||
              v.resultBytes + packet.length > wire::limits::resultBytes)) {
            v.resultBytes -= v.results.front()->payload.size(); v.results.pop_front();
          }
          auto result = std::make_shared<Result>(s.ledger, id, packet);
          v.results.push_back(result); v.resultBytes += packet.length; v.lastTransaction = id;
          bool retainedActivated=false;
          try {
            require(packet.u64(wire::headerFields::base) == v.document->epoch, wire::statuses::baseConflict);
            const auto original = v.document;
            const auto resources = s.resources;
            const auto resourceRevision = s.resourceRevision;
            v.transactionActive = true;
            measured.released();lock.unlock();
            Installed installed;
            try { installed = transact(original, resources, body, count); }
            catch (...) {lockAt=timing?Clock::now():Clock::time_point{};lock.lock();measured.acquired(lockAt);v.transactionActive=false;throw;}
            lockAt=timing?Clock::now():Clock::time_point{};lock.lock();measured.acquired(lockAt);v.transactionActive=false;
            require(!v.closed && !s.closing && !s.closed && s.views[viewId] == retained,
              wire::statuses::closed);
            require(resourceRevision == s.resourceRevision, wire::statuses::busy);
            v.installEditors(installed.document);
            // This is optional reuse. Allocation/evaluation failure follows the
            // ordinary bounded Content path without changing transaction status.
            try {retainedActivated=v.activateRetainedUpdate(installed);}
            catch(const Error&) {} catch(const std::bad_alloc&) {}
            v.document = std::move(installed.document); s.resources = std::move(installed.resources);
            ++s.resourceRevision; v.transactionWork += count;
            status = wire::statuses::accepted; resultEpoch = v.document->epoch;
          } catch (const Error& error) { status = error.status; }
          result->status = status; result->epoch = resultEpoch;
          if (status == wire::statuses::accepted&&!retainedActivated) v.requestContent();
        }
      } else if (opcode == wire::opcodes::queryResult) {
        exact(body, 0);
        const auto result = std::find_if(v.results.begin(), v.results.end(),
          [id](const auto& r) { return r->id == id; });
        require(result != v.results.end(), id <= v.lastTransaction ?
          wire::statuses::resultExpired : wire::statuses::notFound);
        status = (*result)->status; resultEpoch = (*result)->epoch;
      } else if (opcode == wire::opcodes::acknowledge) {
        exact(body, 0); require(id >= v.acknowledged && id <= v.lastTransaction, wire::statuses::invalidValue);
        v.acknowledged = id;
        while (!v.results.empty() && v.results.front()->id <= id) {
          v.resultBytes -= v.results.front()->payload.size(); v.results.pop_front();
        }
      } else if (opcode == wire::opcodes::metrics) {
        exact(body, 40);
        Metrics metrics{body.u64(0), v.metrics.device, body.f64(8), body.f64(16), body.f64(24)};
        require(body.u64(32) == v.lastInput && metrics.epoch > v.metrics.epoch &&
          metrics.width >= 0 && metrics.height >= 0 && metrics.scale > 0 && metrics.scale <= 16,
          wire::statuses::invalidValue);
        v.metrics = metrics; invalidate(v, wire::statuses::stale);
      } else if (opcode == wire::opcodes::input) {
        status=v.enqueue(readInput(body));
      } else if (opcode == wire::opcodes::listSeek) {
        status = v.listSeek(body, id);
      } else if (opcode == wire::opcodes::subscribeRaw) {
        exact(body,8);const auto subscription=body.u64(0);
        require(subscription>0&&subscription>=v.rawGeneration,wire::statuses::stale);
        if(subscription>v.rawGeneration){v.rawInputs.clear();v.rawGeneration=subscription;
          v.rawActive=true;v.rawGapFirst=v.rawGapLast=0;}
      } else if(opcode==wire::opcodes::pollRaw){
        exact(body,0);
        if(v.rawGapFirst){events.push_back({wire::events::rawGap,wire::statuses::eventOverflow,
          v.rawGeneration,v.rawGapFirst,v.rawGapLast});v.rawGapFirst=v.rawGapLast=0;}
      } else if(opcode==wire::opcodes::gestureReply){
        v.gestureReply(body);
      } else if (opcode == wire::opcodes::contentStep) {
        exact(body, 8); require(body.u32(0) > 0 && body.u32(0) <= wire::limits::contentPerStep && body.u32(4) == 0);
        v.contentStep(body.u32(0));
      } else if (opcode == wire::opcodes::measureRequest) {
        exact(body, 0);
        require(v.measurement().has_value(), wire::statuses::notFound);
      } else if (opcode == wire::opcodes::measureResult) {
        require(body.length>=wire::measurementBytes&&body.u32(wire::measureFields::flags)<=3&&body.u32(wire::measureFields::reserved)==0);
        Measurement value{body.f64(40), body.f64(48), body.f64(56), body.f64(64), body.f64(72)};
        value.ideographicBaseline=body.f64(wire::measureFields::ideographicBaseline);
        value.didExceedMaxLines=(body.u32(wire::measureFields::flags)&wire::measurementFlags::didExceedMaxLines)!=0;
        std::optional<MeasurementRequest> pending;
        if(v.preparing&&v.preparing->id==body.u64(0)&&v.preparing->layout&&v.preparing->layout->waiting())pending=v.preparing->layout->request();
        else if(v.query&&v.query->preparation==body.u64(0)&&v.query->work&&v.query->work->waiting())pending=v.query->work->request();
        require(pending&&pending->node->id==handle(body,32),wire::statuses::stale);
        require(!value.didExceedMaxLines||pending->node->kind==wire::kinds::paragraph||pending->node->kind==wire::kinds::editable,wire::statuses::invalidValue);
        const bool inlineChildren=pending->node->paragraph&&pending->node->paragraph->value.inlineChildren();
        if(body.u32(wire::measureFields::flags)&wire::measurementFlags::hasPlaceholders){
          require(inlineChildren&&pending->node->kind==wire::kinds::paragraph&&body.length>=wire::measurementPlaceholderBytes&&
            body.u32(wire::measureFields::placeholderReserved)==0,wire::statuses::invalidValue);
          const auto boxCount=body.u32(wire::measureFields::placeholderCount);
          require(boxCount<=pending->node->paragraph->value.placeholders.size()&&
            body.length==wire::measurementPlaceholderBytes+size_t(boxCount)*wire::paragraphBoxBytes,wire::statuses::invalidValue);
          std::vector<ParagraphBox> boxes;boxes.reserve(boxCount);
          for(uint32_t i=0;i<boxCount;++i){const auto offset=wire::measurementPlaceholderBytes+i*wire::paragraphBoxBytes;
            ParagraphBox box{body.f64(offset),body.f64(offset+8),body.f64(offset+16),body.f64(offset+24),body.u32(offset+32)};
            require(box.width>=0&&box.height>=0&&box.direction<=1&&body.u32(offset+36)==0,wire::statuses::invalidValue);boxes.push_back(box);}
          value.placeholders=std::make_shared<ParagraphGeometry>(s.ledger,std::move(boxes));
        }else if(body.length>wire::measurementBytes){
          require(body.length>=wire::measurementGeometryBytes&&pending->node->kind==wire::kinds::editable&&pending->node->editing&&
            pending->node->editing->revision==body.u64(wire::measureFields::geometryRevision)&&body.u32(wire::measureFields::geometryReserved)==0,wire::statuses::stale);
          const auto rectCount=body.u32(wire::measureFields::selectionCount);require(rectCount<=wire::limits::selectionRects&&body.length==wire::measurementGeometryBytes+size_t(rectCount)*32,wire::statuses::budgetExceeded);
          const auto rect=[&](size_t offset){TextRect r{body.f64(offset),body.f64(offset+8),body.f64(offset+16),body.f64(offset+24)};
            require(r.width>=0&&r.height>=0,wire::statuses::invalidValue);return r;};
          std::vector<TextRect> boxes;boxes.reserve(rectCount);for(uint32_t i=0;i<rectCount;++i)boxes.push_back(rect(wire::measureFields::selection+i*32));
          value.geometry=std::make_shared<TextGeometry>(s.ledger,body.u64(wire::measureFields::geometryRevision),rect(wire::measureFields::caret),std::move(boxes));
        }else require(pending->node->kind!=wire::kinds::editable,wire::statuses::malformed);
        require(!inlineChildren||bool(value.placeholders),wire::statuses::malformed);
        if(v.query&&v.query->work&&body.u64(0)==v.query->preparation){
          require(body.u64(8)==v.query->metrics.epoch&&body.u64(16)==v.query->metrics.device,wire::statuses::stale);
          v.query->work->measured(body.u64(24),handle(body,32),value);
        }else{
        require(v.preparing && v.preparing->layout && body.u64(0) == v.preparing->id &&
          body.u64(8) == v.preparing->metrics.epoch && body.u64(16) == v.preparing->metrics.device,
          wire::statuses::stale);
        v.preparing->layout->measured(body.u64(24), handle(body, 32),value);}
      } else if (opcode == wire::opcodes::layoutQuery) {
        status=v.startQuery(body,id);
      } else if (opcode == wire::opcodes::layoutQueryResult) {
        exact(body,0);require(v.query&&v.query->id==id,id<=v.lastQuery?wire::statuses::resultExpired:wire::statuses::notFound);
        status=v.query->status;
      } else if (opcode == wire::opcodes::layoutQueryCancel) {
        exact(body,0);require(v.query&&v.query->id==id,wire::statuses::notFound);v.cancelQuery(wire::statuses::canceled);
      } else if (opcode == wire::opcodes::layoutSnapshot) {
        require(bool(v.active), wire::statuses::notFound);
      } else if (opcode == wire::opcodes::fontRevision) {
        require(body.length==16||body.length==24);
        require(v.fontTransition.phase!=wire::fontTransitionPhases::preparing,wire::statuses::busy);
        require(body.u64(0) > v.fontRevision && body.u64(8) == v.lastInput, wire::statuses::stale);
        std::shared_ptr<const Resource> resource;
        if(body.length==24){const auto target=handle(body,16);
          if(!target)require(target.generation==0);
          else{require(target.slot<s.resources.size()&&s.resources[target.slot].value&&s.resources[target.slot].value->id==target&&
              s.resources[target.slot].value->fontCatalog,wire::statuses::invalidHandle);resource=s.resources[target.slot].value;}
        }
        v.fontResource=std::move(resource);v.fontRevision = body.u64(0); invalidate(v, wire::statuses::stale);
      } else if(opcode==wire::opcodes::focus){
        require(body.length==24||(body.length==32&&body.u32(24)==1&&body.u32(28)==0));
        v.setFocus(handle(body,0),body.u64(8),body.u64(16),body.length==32);
      } else if(opcode==wire::opcodes::edit){
        v.applyEdit(body);editTarget=handle(body,0);
      } else if(opcode==wire::opcodes::editSnapshot){
        exact(body,8);require(v.document&&v.document->contains(handle(body,0))&&v.editors.contains(handle(body,0).key()),wire::statuses::invalidHandle);
        editTarget=handle(body,0);
      } else if(opcode==wire::opcodes::semanticsSnapshot){
        exact(body,deltaObservation?16:appObservation?4:0);require(bool(v.published),wire::statuses::notFound);frame=&*v.published;
      } else if(opcode==wire::opcodes::semanticsAction){
        v.semanticAction(body);
      } else if(opcode==wire::opcodes::focusAt||opcode==wire::opcodes::activateAt){
        exact(body,24);require(body.u64(0)==v.publication,wire::statuses::stale);
        const auto node=v.interactionTarget(body.f64(8),body.f64(16));require(bool(node),wire::statuses::notFound);
        if(opcode==wire::opcodes::focusAt)v.setFocus(node,body.u64(0),0);
        else {Writer action(32);writeHandle(action,0,node);action.u64(8,body.u64(0));action.u32(16,wire::semanticsActions::activate);
          v.semanticAction({action.bytes.data(),action.bytes.size()});}
      } else if(opcode==wire::opcodes::pollInteractionEvents){
        exact(body,0);while(!v.interactionEvents.empty()&&events.size()<wire::limits::eventsPerPoll){events.push_back(v.interactionEvents.front());v.interactionEvents.pop_front();}
      } else if (opcode == wire::opcodes::preparationResult) {
        exact(body, 24);
        if(v.query&&v.query->work&&body.u64(0)==v.query->preparation){
          require(body.u64(8)==v.query->metrics.epoch&&body.u64(16)==v.query->metrics.device,wire::statuses::stale);
          v.cancelQuery(wire::statuses::failed);
        }else{
        require(body.u64(8) == v.metrics.epoch && body.u64(16) == v.metrics.device, wire::statuses::stale);
        v.failPreparation(body.u64(0), wire::statuses::failed);
        }
      } else if (opcode == wire::opcodes::preparationScene) {
        exact(body,providerPreparationDelta?16:0);
        if(providerPreparationRelease)v.providerPreparations.reset();
        else {require(v.preparing && v.preparing->ready, wire::statuses::notFound);
          require(v.preparing->metrics.epoch==v.metrics.epoch&&v.preparing->metrics.device==v.metrics.device&&
            v.preparing->fontRevision==v.fontRevision,wire::statuses::stale);
          if(providerPreparationDelta&&!v.providerPreparations)
            v.providerPreparations=std::make_unique<View::PreparationObservation>(v.lease.ledger);}
      } else if (opcode == wire::opcodes::providerReady) {
        exact(body, 24);
        require(v.preparing && v.preparing->ready && body.u64(0) == v.preparing->id &&
          body.u64(8) == v.preparing->metrics.epoch && body.u64(16) == v.preparing->metrics.device,
          wire::statuses::stale);
        v.preparing->providerReady = true;
      } else if (opcode == wire::opcodes::tick) {
        exact(body, 8); v.tick(body.f64(0));
      } else if (opcode == wire::opcodes::requestAppFrame) {
        // Scheduling a Source callback does not change any pixels. Its later
        // transaction (or native motion/input) owns paint invalidation. Marking
        // this dirty republishes the old scene and feeds needless observations
        // back into App while it is still producing the next scene.
        if(!body.length){v.appFrameRequested=true;}
        else{exact(body,8);const auto at=body.f64(0);require(at>=0,wire::statuses::invalidValue);v.appFrameDeadline=at;}
      } else if (opcode == wire::opcodes::takeFrame) {
        exact(body,providerFrameDelta?16:0);
        if(providerFrameRelease)v.providerFrames.reset();
        else {status = v.takeFrame();
          if (status == wire::statuses::ok){frame = &v.frames.at(v.nextSubmission);
            unissuedFrame.view=&v;unissuedFrame.id=frame->id;
            if(providerFrameDelta&&!v.providerFrames)
              v.providerFrames=std::make_unique<ProviderObservationState>(v.lease.ledger);}}
      } else if(opcode==wire::opcodes::snapshotPaint) {
        exact(body,32);const auto phase=body.u32(24);
        require(phase<=3&&body.u32(28)<=1);
        const auto it=v.frames.find(body.u64(0));
        require(it!=v.frames.end()&&!it->second.released&&!it->second.canceled&&
          it->second.device==v.metrics.device,wire::statuses::stale);
        snapshotTarget=handle(body,8);
        if(phase==0) {
          require(!snapshotTarget&&!snapshotTarget.generation&&!body.u64(16)&&!body.u32(28));
          snapshotDecision=v.snapshots.beginFrame(it->second);
        } else if(phase==1) {
          require(!body.u64(16));
          snapshotDecision=v.snapshots.paint(it->second,snapshotTarget,bool(body.u32(28)));
        } else {
          require(!body.u32(28)&&it->second.scene->document->contains(snapshotTarget),wire::statuses::invalidHandle);
          v.snapshots.complete(snapshotTarget,body.u64(16),phase==2);
        }
      } else if (opcode == wire::opcodes::releaseFrame) {
        exact(body, 24); require(body.u32(16) <= 1 && body.u32(20) <= 1);
        v.releaseFrame(body.u64(0), body.u64(8), bool(body.u32(16)), bool(body.u32(20)));
      } else if (opcode == wire::opcodes::publish) {
        exact(body, 24); v.publish(body.u64(0), body.u64(8), body.u64(16));
      } else if (opcode == wire::opcodes::scroll) {
        status = v.scroll(body, id);
      } else if (opcode == wire::opcodes::scrollCancel) {
        exact(body,8);const auto command=body.u64(0);require(command>0);
        if(v.commands.contains(command))v.finishCommand(command,wire::statuses::canceled);
        else require(std::any_of(v.commandResults.begin(),v.commandResults.end(),
          [&](const auto& result){return result.id==command;}),wire::statuses::resultExpired);
      } else if (opcode == wire::opcodes::key) {
        v.key(body);
      } else if (opcode == wire::opcodes::controlValue) {
        exact(body,32);const auto node=handle(body,0);
        require(v.published&&body.u64(8)==v.publication&&v.published->allows(node)&&
          v.document->contains(node)&&v.active&&v.active->document->contains(node),wire::statuses::stale);
        const auto& n=v.active->document->get(node);
        require((n.control.kind==wire::controlKinds::slider||n.control.kind==wire::controlKinds::rangeSlider)&&
          !n.control.disabled&&!v.document->get(node).control.disabled,wire::statuses::capabilityMissing);
        require(body.u32(24)<=1&&body.u32(28)==0&&std::isfinite(body.f64(16))&&body.f64(16)>=n.control.minimum&&
          body.f64(16)<=n.control.maximum,wire::statuses::invalidValue);
        v.controlValue(node,body.f64(16),bool(body.u32(24)));
      } else if (opcode == wire::opcodes::visibility) {
        exact(body, 16); const auto flags = body.u32(0);
        require((flags & ~7u) == 0 && body.u32(4) == 0 && body.u64(8) == v.lastInput);
        const bool visible = (flags & 1u) != 0, focused = (flags & 2u) != 0;
        if ((!v.visible && visible) || (!v.focused && focused))
          for (auto& stream : v.streams) stream.denied = false;
        if (!visible || !focused) v.cancelInput(wire::statuses::canceled);
        if(!visible||!focused)v.setFocus({},0,v.focusSession);
        if (!v.visible && visible) { v.requestContent(); v.dirty = true; v.hasTime = false; }
        v.visible = visible; v.focused = focused;
        if (flags & 4u) v.dirty = true;
      } else if (opcode == wire::opcodes::device) {
        exact(body, 16); const auto device = body.u64(0);
        require(device > v.metrics.device && body.u64(8) == v.lastInput, wire::statuses::stale);
        v.metrics.device = device;
        // The port's device-loss notification transfers retirement authority:
        // old provider holds are invalidated, never re-used as new credit.
        for (const auto& f : v.frames) v.event({wire::events::publicationCanceled,
          wire::statuses::canceled, f.first, f.second.scene->document->epoch});
        v.frames.clear(); v.pendingPublication = 0; v.published.reset();
        invalidate(v, wire::statuses::canceled);
      } else if (opcode == wire::opcodes::closeView) {
        exact(body, 0); v.close(wire::statuses::closed);
        if (generation != UINT32_MAX) s.generations[viewId] = generation + 1;
        else s.generations[viewId] = UINT32_MAX;
      } else if (opcode == wire::opcodes::pollEvents) {
        exact(body, 0);
        while (!v.events.empty() && events.size() < wire::limits::eventsPerPoll) {
          events.push_back(v.events.front()); v.events.pop_front();
        }
      } else {
        require(opcode == wire::opcodes::inspect || opcode == wire::opcodes::openView, wire::statuses::incompatible);
        exact(body, stateOnlyInspection?4:0);
      }
      if (v.overflowed && !v.closed) {
        v.close(wire::statuses::eventOverflow);
        status = wire::statuses::eventOverflow;
        frame = nullptr;
        editTarget = {};
      }
    }
  } catch (const Error& error) { unissuedFrame.retire();status = error.status; frame = nullptr; }

  const auto measureStorage=status==wire::statuses::ok&&opcode==wire::opcodes::measureRequest&&view?view->measurement():std::optional<MeasurementRequest>{};
  const MeasurementRequest* measure=measureStorage?&*measureStorage:nullptr;
  const Document* measureDocument=measure&&view->query&&view->query->preparation==view->measurePreparation()?
    view->query->document.get():measure&&view->preparing?view->preparing->document.get():nullptr;
  const Document* rows = frame ? frame->scene->document.get() :
    editTarget&&view?view->document.get():
    status == wire::statuses::ok && opcode == wire::opcodes::layoutSnapshot && view && view->active ? view->active->document.get() :
    measureDocument ? measureDocument :
    opcode == wire::opcodes::inspect && !stateOnlyInspection && view ? view->document.get() :
    status == wire::statuses::ok && opcode == wire::opcodes::preparationScene && !providerPreparationRelease && view && view->preparing ?
      view->preparing->document.get() : nullptr;
  const bool providerFrameObservation=providerFrameDelta&&frame&&status==wire::statuses::ok;
  const bool providerPreparationObservation=providerPreparationDelta&&rows&&status==wire::statuses::ok;
  const bool providerObservation=providerFrameObservation||providerPreparationObservation;
  auto* observation=providerFrameObservation?view->providerFrames.get():providerPreparationObservation?view->providerPreparations.get():deltaObservation&&status==wire::statuses::ok&&view?
    &view->observations[opcode==wire::opcodes::semanticsSnapshot?1:0]:nullptr;
  auto observationKey=observation?observationSignature(*view,opcode==wire::opcodes::semanticsSnapshot):std::array<uint64_t,20>{};
  if(providerFrameObservation){observationKey[0]=frame->id;observationKey[1]=frame->scene->document->epoch;
    observationKey[2]=frame->scene->metrics.epoch;observationKey[3]=frame->device;observationKey[4]=frame->scene->fontRevision;}
  if(providerPreparationObservation){const auto& candidate=*view->preparing;
    observationKey={};observationKey[0]=candidate.id;observationKey[1]=candidate.document->epoch;
    observationKey[2]=candidate.metrics.epoch;observationKey[3]=candidate.metrics.device;observationKey[4]=candidate.fontRevision;}
  const bool reusedObservation=observation&&observation->version&&observation->pending.empty()&&!observation->orderDirty&&
    !observation->fullRequired&&observation->selected==selectedLayout&&observation->signature==observationKey&&observation->selection==layoutSelection;
  const bool partialObservation=observation&&!reusedObservation&&rows&&observation->selected==selectedLayout&&observation->selection==layoutSelection&&observationPatch(*observation,observationKey)&&
    (!providerFrameObservation||observation->signature[0]==frame->observationBase);
  std::vector<uint32_t> frameRows;
  std::vector<Handle> observationOrder,observationRemoved;
  std::vector<const Node*> rowNodes;
  size_t preparationVisits=0;
  if(partialObservation&&providerPreparationObservation){
    // The dictionary's delivered candidate is distinct from the active scene.
    // Weak page proofs survive live-paint activation without retaining a tree.
    bool orderChanged=false;
    preparationVisits=rows->nodes.visitDifferences(view->providerPreparations->pages,[&](size_t slot,const auto& current,const auto* previous){
      if(previous&&current.value==previous->value)return;
      const auto before=observation->slots[slot];
      const auto after=current.value?current.value->id:Handle{};
      if(before!=after){orderChanged=true;if(before)observationRemoved.push_back(before);}
      if(!current.value)return;
      if(!previous||!previous->value||!sameObservationNode(*current.value,*previous->value)||
          current.value->resolvedPaint!=previous->value->resolvedPaint||current.value->imagePaint!=previous->value->imagePaint||
          current.value->fontResource!=previous->value->fontResource||current.value->fontRevision!=previous->value->fontRevision)
        rowNodes.push_back(current.value.get());
    });
    observation->orderDirty=orderChanged;
    if(orderChanged)for(const auto& slot:rows->nodes)if(slot.value)observationOrder.push_back(slot.value->id);
  }else if(partialObservation&&providerFrameObservation){
    // This production journal describes the published predecessor, not an
    // arbitrary previously acquired/canceled frame. A gap takes the full path.
    frameRows=frame->observationRows;
    std::bitset<wire::limits::nodes+1> seen;
    for(const auto index:frameRows)seen.set(frame->items[index].node.slot);
    const auto add=[&](Handle node){const auto* item=frame->item(node);
      if(item&&!seen[node.slot]){seen.set(node.slot);frameRows.push_back(frame->itemBySlot[node.slot]);}};
    const auto* previous=view->published.get();
    if(previous){add(previous->focusNode);add(previous->focusPeer(previous->focusNode));}
    add(frame->focusNode);add(frame->focusPeer(frame->focusNode));
    observation->orderDirty=frame->observationOrderChanged;
    if(observation->orderDirty){
      for(const auto& item:frame->items)observationOrder.push_back(item.node);
      for(const auto node:observation->order)if(!rows->contains(node))observationRemoved.push_back(node);
    }
  }else if(partialObservation){
    std::unordered_set<uint64_t> wanted;
    std::unordered_set<uint64_t> removedKeys;
    const auto remove=[&](Handle node){if(removedKeys.insert(node.key()).second)observationRemoved.push_back(node);};
    if(selectedLayout){
      const auto add=[&](Handle node){if(wanted.insert(node.key()).second)observationOrder.push_back(node);};
      for(const auto node:layoutSelection)if(rows->contains(node)){add(node);const auto parent=rows->get(node).parent;if(parent)add(parent);}
      for(const auto node:observation->order)if(!wanted.contains(node.key()))remove(node);
      // A selected node can acquire a different viewport parent.
      for(const auto node:observationOrder)if(!observation->rows.contains(node.key()))observation->mark(node);
      if(observationOrder!=observation->order)observation->orderDirty=true;
    }else if(observation->orderDirty){
      if(frame)for(const auto& item:frame->items)observationOrder.push_back(item.node);
      else for(const auto& slot:rows->nodes)if(slot.value)observationOrder.push_back(slot.value->id);
    }
    for(const auto slot:observation->pending){
      const auto old=observation->slots[slot];const auto& entry=rows->nodes[slot];
      const auto current=entry.value?entry.value->id:Handle{};
      if(old&&(old!=current||(selectedLayout&&!wanted.contains(old.key()))))remove(old);
      if(!current||(selectedLayout&&!wanted.contains(current.key())))continue;
      if(frame){if(slot<frame->itemBySlot.size()&&frame->itemBySlot[slot]!=UINT32_MAX)frameRows.push_back(frame->itemBySlot[slot]);}
      else rowNodes.push_back(entry.value.get());
    }
  }
  const auto frameRowCount=frame?(partialObservation?frameRows.size():frame->items.size()):0;
  const auto forFrameRows=[&](const auto& visit){if(!frame||reusedObservation)return;
    if(partialObservation)for(const auto index:frameRows)visit(frame->items.at(index));
    else for(const auto& item:frame->items)visit(item);};
  if (rows && !frame && !reusedObservation&&!partialObservation) {
    if(editTarget)rowNodes.push_back(&rows->get(editTarget));
    else if (measure) rowNodes.push_back(measure->node.get());
    else if(selectedLayout){
      // A Source list observer needs its own layout and its viewport parent.
      // Missing/recycled handles are omitted from this active cohort, never
      // resolved by slot alone against a newer document.
      std::unordered_set<uint64_t> seen;
      for(const auto node:layoutSelection)if(rows->contains(node)){
        const auto& value=rows->get(node);
        if(seen.insert(node.key()).second)rowNodes.push_back(&value);
        if(value.parent&&seen.insert(value.parent.key()).second)rowNodes.push_back(&rows->get(value.parent));
      }
    }
    else for (const auto& slot : rows->nodes) if (slot.value) rowNodes.push_back(slot.value.get());
  }
  struct Blob { uint32_t type; Handle id; Reader data; };
  std::vector<Blob> blobs; size_t blobBytes = 0;
  std::vector<std::vector<uint8_t>> ownedBlobs;
  const auto addOwned=[&](uint32_t type,Handle node,Writer bytes){ownedBlobs.push_back(std::move(bytes.bytes));
    const auto& data=ownedBlobs.back();blobs.push_back({type,node,{data.data(),data.size()}});};
  if(providerFrameObservation){Writer data(wire::providerFrameBytes);data.u64(0,frame->id);
    data.u64(8,frame->scene->document->epoch);data.u64(16,frame->scene->metrics.epoch);data.u64(24,frame->device);
    data.u64(32,frame->scene->fontRevision);data.u64(40,frame->scene->preparation);
    data.u64(48,frame->propertyEpoch);data.u64(56,frame->observationBase);
    addOwned(wire::providerFrameBlob,{},std::move(data));}
  if(providerPreparationObservation){const auto& candidate=*view->preparing;Writer data(wire::providerPreparationBytes);
    data.u64(0,candidate.id);data.u64(8,candidate.document->epoch);data.u64(16,candidate.metrics.epoch);
    data.u64(24,candidate.metrics.device);data.u64(32,candidate.fontRevision);
    data.u64(40,observation->signature[0]);data.u64(48,preparationVisits);
    data.u64(56,observation->signature[1]);
    addOwned(wire::providerPreparationBlob,{},std::move(data));}
  const auto build=view&&view->preparing&&view->preparing->layout&&view->document&&
    view->preparing->document->epoch==view->document->epoch&&view->preparing->metrics.epoch==view->metrics.epoch&&
    view->preparing->metrics.device==view->metrics.device?view->preparing->layout->buildRequest():std::optional<LayoutBuildRequest>{};
  const auto putAxis=[](Writer& out,size_t at,const Axis& axisValue){out.u32(at,axisValue.tag);out.f64(at+8,axisValue.min);out.f64(at+16,axisValue.max);};
  if(status==wire::statuses::ok&&build&&view->visible&&!view->closed){
    const size_t rowCount=build->list&&build->list->measured?build->list->measured->rows.size():0;
    Writer data(build->list?wire::layoutListBuildRequestBytes+rowCount*wire::layoutListBuildRowBytes:wire::layoutBuildRequestBytes);
    data.u64(0,view->preparing->id);data.u64(8,view->document->epoch);
    data.u64(16,view->metrics.epoch);data.u64(24,view->metrics.device);data.u64(32,build->node->layoutBuilder->revision);data.u64(40,build->id);
    const auto& c=build->constraints;
    putAxis(data,48,Axis{std::isfinite(c.maxWidth)?wire::bounds::finite:wire::bounds::unbounded,c.minWidth,std::isfinite(c.maxWidth)?c.maxWidth:0});
    putAxis(data,72,Axis{std::isfinite(c.maxHeight)?wire::bounds::finite:wire::bounds::unbounded,c.minHeight,std::isfinite(c.maxHeight)?c.maxHeight:0});
    if(build->list){const auto& list=*build->list;data.f64(96,list.offset);data.f64(104,list.beginOffset);data.f64(112,list.paintExtent);
      data.u32(120,list.begin);data.u32(124,list.end);data.u32(128,uint32_t(rowCount));data.u32(136,list.count);
      for(size_t i=0;i<rowCount;++i){const auto& row=list.measured->rows[i];const auto at=wire::layoutListBuildRequestBytes+i*wire::layoutListBuildRowBytes;
        data.u32(at,row.index);data.u64(at+8,row.key);data.f64(at+16,row.offset);data.f64(at+24,row.extent);}}
    addOwned(wire::layoutBuildRequestBlob,build->node->id,std::move(data));
  }
  if(status==wire::statuses::ok&&snapshotDecision)
    addOwned(wire::snapshotDecisionBlob,snapshotTarget,snapshotDecisionBytes(*snapshotDecision));
  if(status==wire::statuses::ok&&opcode==wire::opcodes::semanticsSnapshot&&frame&&view&&view->visible&&
      frame->scene->metrics.epoch==view->metrics.epoch&&frame->device==view->metrics.device){
    const auto& route=frame->route;const auto size=route.label?route.label->label.size():0;
    Writer data(wire::semanticRouteBytes+size);data.u64(0,route.sequence);
    writeHandle(data,8,route.scope);writeHandle(data,16,route.name);data.u32(24,uint32_t(size));
    if(size)std::memcpy(data.bytes.data()+wire::semanticRouteBytes,route.label->label.data(),size);
    addOwned(wire::semanticRouteBlob,{},std::move(data));
  }
  if(view&&view->fontTransition.token){const auto& transition=view->fontTransition;Writer data(32);
    data.u64(0,transition.token);data.u32(8,transition.phase);data.u32(12,transition.ready);
    data.u32(16,transition.failedOwner);data.u32(20,transition.failedStatus);data.u64(24,transition.revision);
    addOwned(wire::fontTransitionBlob,transition.target,std::move(data));
  }
  if(view&&view->lastFontUpload&&(opcode==wire::opcodes::fontUploadBegin||opcode==wire::opcodes::fontUploadChunk||
      opcode==wire::opcodes::fontUploadCommit||opcode==wire::opcodes::fontUploadAbort||opcode==wire::opcodes::inspect)){
    Writer data(24);data.u64(0,view->lastFontUpload);data.u32(8,view->fontUploadBytes);
    data.u32(12,view->fontUpload?uint32_t(view->fontUpload->filled):view->fontUploadStatus==2?view->fontUploadBytes:0);
    data.u32(16,view->fontUploadStatus);addOwned(wire::fontUploadBlob,view->lastFontResource,std::move(data));
  }
  if(view&&view->lastImageUpload&&(opcode==wire::opcodes::imageUploadBegin||opcode==wire::opcodes::imageUploadChunk||
      opcode==wire::opcodes::imageUploadCommit||opcode==wire::opcodes::imageUploadAbort||opcode==wire::opcodes::inspect)){
    Writer data(24);data.u64(0,view->lastImageUpload);data.u32(8,view->imageUploadBytes);
    data.u32(12,view->imageUpload?uint32_t(view->imageUpload->filled):view->imageUploadStatus==2?view->imageUploadBytes:0);
    data.u32(16,view->imageUploadStatus);addOwned(wire::imageUploadBlob,view->lastImageResource,std::move(data));
  }
  if(status==wire::statuses::ok&&imageRead){
    Writer data(8+imageReadLength);data.u32(0,imageReadOffset);data.u32(4,uint32_t(imageRead->bytes.size()));
    std::copy_n(imageRead->bytes.data()+imageReadOffset,imageReadLength,data.bytes.data()+8);
    addOwned(wire::imageResourceChunkBlob,imageRead->id,std::move(data));
  }
  if(status==wire::statuses::ok&&fontRead){
    Writer data(8+fontReadLength);data.u32(0,fontReadOffset);data.u32(4,uint32_t(fontRead->bytes.size()));
    std::copy_n(fontRead->bytes.data()+fontReadOffset,fontReadLength,data.bytes.data()+8);
    addOwned(wire::fontResourceChunkBlob,fontRead->id,std::move(data));
  }
  const auto interactionBlobs=[&](const Node& n,const DrawItem* item=nullptr){
    if(opcode==wire::opcodes::semanticsSnapshot&&frame&&item&&n.layoutPaintValues&&n.layoutPaintValues->semanticsRect){
      const auto& rect=*n.layoutPaintValues->semanticsRect;
      const auto matrix=item->world*Affine{1,0,0,1,rect.x,rect.y};
      const auto bounds=matrix.bounds({0,0,rect.width,rect.height});
      Writer data(wire::semanticGeometryBytes);
      const std::array<double,14> values{bounds.x,bounds.y,bounds.width,bounds.height,rect.width,rect.height,
        matrix.a,matrix.b,matrix.c,matrix.d,matrix.tx,matrix.ty,rect.x,rect.y};
      for(size_t i=0;i<values.size();++i)data.f64(i*8,values[i]);
      addOwned(wire::semanticGeometryBlob,n.id,std::move(data));
    }
    if(!appObservation&&n.snapshot)addOwned(wire::snapshotStyleBlob,n.id,snapshotStyleBytes(*n.snapshot));
    if(!providerObservation&&n.layoutBuilder){const auto& builder=*n.layoutBuilder;Writer data(wire::layoutBuilderBytes);
      data.u64(0,builder.revision);data.u64(8,builder.builtRevision);putAxis(data,16,builder.horizontal);putAxis(data,40,builder.vertical);
      addOwned(wire::layoutBuilderBlob,n.id,std::move(data));}
    if(!appObservation){
    if(n.imageStyle)addOwned(wire::imagePaintBlob,n.id,imagePaintBytes(*n.imageStyle,n.imagePaint.get()));
    if(n.fontResource||n.fontPinned||n.fontRevision!=1){Writer data(24);writeHandle(data,0,n.fontResource?n.fontResource->id:Handle{});
      data.u64(8,n.fontRevision);data.u32(16,n.fontPinned?1u:0u);addOwned(wire::fontBindingBlob,n.id,std::move(data));}
    if(n.paintPlacement)addOwned(wire::paintPlacementBlob,n.id,paintPlacementBytes(*n.paintPlacement));
    if(n.clipStyle)addOwned(12,n.id,clipStyleBytes(*n.clipStyle));
    if(n.resolvedPaint||n.nativePaint)addOwned(13,n.id,nativePaintBytes(*(item&&item->paint?item->paint:n.resolvedPaint?n.resolvedPaint:n.nativePaint)));
    if(n.paragraph)addOwned(11,n.id,paragraphBytes(n.paragraph->value));
    }
    // Browser interaction needs clip paths and semantic geometry, not renderer
    // pictures, paragraph shaping, fonts, images or live paint programs. This
    // full projection does not consume the App's delta subscription journal.
    if(browserObservation&&n.clipStyle)addOwned(12,n.id,clipStyleBytes(*n.clipStyle));
    if(!appObservation||browserObservation){
    const auto& graph=n.graphics;const auto& m=graph.transform;
    if(graph.path||graph.origin||graph.alignment||graph.shadowColor||graph.strokeColor||graph.blur||m.a!=1||m.b!=0||m.c!=0||m.d!=1||m.tx!=0||m.ty!=0){
      const bool full=!frame||opcode==wire::opcodes::semanticsSnapshot;
      const auto count=graph.path&&full?graph.path->commands.size():0;Writer bytes(wire::graphicsBytes+count*wire::graphicsPathBytes);
      const std::array<double,6> values{m.a,m.b,m.c,m.d,m.tx,m.ty};
      for(size_t i=0;i<6;++i)bytes.f64(i*8,values[i]);
      bytes.f64(48,graph.shadowX);bytes.f64(56,graph.shadowY);bytes.f64(64,graph.shadowSigma);
      bytes.u32(72,graph.shadowColor);bytes.u32(76,graph.strokeColor);bytes.f64(80,graph.strokeWidth);bytes.f64(88,graph.blur);
      bytes.u32(wire::graphicsFields::flags,(graph.path?(graph.path->fillRule|wire::graphicsFlags::hasPath):0)|
        (graph.origin?wire::graphicsFlags::hasOrigin:0)|(graph.alignment?wire::graphicsFlags::hasAlignment:0));
      bytes.u32(wire::graphicsFields::pathCount,uint32_t(count));
      if(graph.origin){bytes.f64(wire::graphicsFields::originX,graph.origin->x);bytes.f64(wire::graphicsFields::originY,graph.origin->y);}
      if(graph.alignment){bytes.f64(wire::graphicsFields::alignmentX,graph.alignment->x);bytes.f64(wire::graphicsFields::alignmentY,graph.alignment->y);}
      for(size_t i=0;i<count;++i){const auto& c=graph.path->commands[i];bytes.u32(wire::graphicsBytes+i*wire::graphicsPathBytes,c.verb);
        for(size_t j=0;j<6;++j)bytes.f64(wire::graphicsBytes+8+i*wire::graphicsPathBytes+j*8,c.values[j]);}
      addOwned(10,n.id,std::move(bytes));
    }
    }
    const Property* visual=frame&&n.id.slot<frame->properties.size()?&frame->properties[n.id.slot]:nullptr;
    const auto overlay=view&&!providerPreparationObservation?view->overlays.find(n.id.key()):std::map<uint64_t,Overlay>::const_iterator{};
    const bool hasOverlay=view&&!providerPreparationObservation&&overlay!=view->overlays.end();
    const double controlValue=visual?visual->value:hasOverlay?overlay->second.value:n.control.value;
    if(n.control.kind){const auto& c=n.control;Writer data(72);data.u32(0,c.kind);data.u32(4,c.disabled|(c.appearance<<1));
      const bool pressed=visual?visual->pressed:hasOverlay&&overlay->second.pressed;
      const bool hovered=visual?visual->hovered:hasOverlay&&overlay->second.hovered;
      data.u32(8,(pressed?1u:0u)|(hovered?2u:0u));data.u32(12,c.foreground);data.u32(16,c.track);
      data.f64(24,c.minimum);data.f64(32,c.maximum);data.f64(40,c.step);data.f64(48,controlValue);
      data.f64(56,visual?visual->second:hasOverlay?overlay->second.second:c.second);
      data.u64(64,c.revision);addOwned(7,n.id,std::move(data));}
    if(!providerObservation&&n.listGeometry){const auto& list=*n.listGeometry;const size_t header=list.style.fixed||list.style.sequential?72:64;Writer data(header+list.rows.size()*40);
      data.u64(0,list.style.generation);data.u32(8,list.style.count);data.u32(12,list.style.begin);data.u32(16,list.style.end);
      double offset=0,height=view?view->metrics.height:0,paint=height,velocity=0;
      if(view&&n.parent&&rows->contains(n.parent)){const auto& parent=rows->get(n.parent);
        const bool horizontal=(parent.properties.flags&1u)!=0;
        height=horizontal?parent.properties.width:parent.properties.height;offset=parent.properties.initialScrollOffset-(horizontal?n.properties.x:n.properties.y);const auto scrollOverlay=view->overlays.find(n.parent.key());
        if(scrollOverlay!=view->overlays.end()){offset=scrollOverlay->second.requested-(horizontal?n.properties.x:n.properties.y);velocity=scrollOverlay->second.velocity;}
        if(n.layoutBuilder){const double origin=n.properties.y;
          const double requested=list.style.sequential&&list.knownCount<list.style.count?std::max(0.0,offset+origin):
            std::clamp(offset+origin,0.0,std::max(0.0,list.total+parent.layout.top+parent.layout.bottom-height));
          offset=std::max(0.0,requested-origin);paint=std::max(0.0,height-std::max(0.0,origin-requested));}}
      if(n.layoutBuilder){const auto range=nativeListCacheRange(list.style,&list,std::max(0.0,offset),paint,velocity);data.u32(20,range.begin);data.u32(24,range.end);}
      else {const auto begin=list.indexAt(std::max(0.0,offset-height));
        data.u32(20,begin);data.u32(24,std::min(list.style.count,list.indexAt(offset+height*2)+1));}
      data.u32(28,uint32_t(list.rows.size()));data.f64(32,list.estimate);
      data.f64(40,list.total);data.f64(48,list.begin);data.f64(56,list.end);
      if(header==72)data.u32(64,list.style.fixed?wire::listFlags::fixedExtent:wire::listFlags::sequential);
      for(size_t i=0;i<list.rows.size();++i){const auto& row=list.rows[i];const auto at=header+i*40;
        writeHandle(data,at,row.node);data.u32(at+8,row.index);data.u64(at+16,row.key);data.f64(at+24,row.offset);data.f64(at+32,row.extent);}
      addOwned(6,n.id,std::move(data));}
    if(const auto* semantic=providerObservation?nullptr:frame?frame->semantic(n.id):n.semantics.get()){const auto& a=*semantic;
      auto semanticFlags=(n.control.kind==wire::controlKinds::toggle||n.control.kind==wire::controlKinds::checkbox||n.control.kind==wire::controlKinds::radio)?
        (a.flags&~wire::semanticsFlags::checked)|(controlValue>n.control.minimum?wire::semanticsFlags::checked:0u):a.flags;
      if(n.control.disabled)semanticFlags|=wire::semanticsFlags::disabled;
      if(frame&&!frame->allowsSemantics(n.id))semanticFlags|=wire::semanticsFlags::hidden;
      if(frame&&!frame->semantics.empty()&&frame->semantics[n.id.slot].merged)semanticFlags|=wire::semanticsFlags::mergedIntoParent;
      addOwned(3,n.id,semanticDataBytes(a,semanticFlags,a.actions));
      if(frame&&!frame->semantics.empty()&&frame->semantics[n.id.slot].traversal!=UINT32_MAX){
        const auto& value=frame->semantics[n.id.slot];const auto sources=value.customSources;
        const auto count=sources?sources->values.size():0;Writer traversal(wire::semanticTraversalBytes+count*wire::semanticCustomSourceBytes);
        writeHandle(traversal,0,value.parent);traversal.u32(8,value.traversal);
        traversal.u32(12,uint32_t(count));
        for(size_t i=0;i<count;++i){const auto offset=wire::semanticTraversalBytes+i*wire::semanticCustomSourceBytes;
          traversal.u32(offset,sources->values[i].first);writeHandle(traversal,offset+8,sources->values[i].second);}
        addOwned(wire::semanticTraversalBlob,n.id,std::move(traversal));
      }
    }
    auto editing=n.editing;
    if(editTarget||(opcode==wire::opcodes::semanticsSnapshot&&view)){const auto found=view->editors.find(n.id.key());if(found!=view->editors.end())editing=found->second->value;}
    if(editing){const auto& e=*editing;const auto encoded=utf8(e.text);Writer bytes(48+encoded.size());
      bytes.u64(0,e.revision);bytes.u64(8,e.serial);bytes.u32(16,uint32_t(e.base));bytes.u32(20,uint32_t(e.extent));
      bytes.u32(24,uint32_t(e.composingStart));bytes.u32(28,uint32_t(e.composingEnd));bytes.u32(32,n.editFlags);bytes.u32(36,n.maximumLength);bytes.u32(40,uint32_t(encoded.size()));
      std::memcpy(bytes.bytes.data()+48,encoded.data(),encoded.size());addOwned(4,n.id,std::move(bytes));
      if(n.textGeometry&&n.textGeometry->revision==e.revision){const auto& geometry=*n.textGeometry;Writer g(48+geometry.selection.size()*32);
        g.u64(0,geometry.revision);g.u32(40,uint32_t(geometry.selection.size()));
        const auto rect=[&](size_t offset,const TextRect& r){g.f64(offset,r.x);g.f64(offset+8,r.y);g.f64(offset+16,r.width);g.f64(offset+24,r.height);};
        rect(8,geometry.caret);for(size_t i=0;i<geometry.selection.size();++i)rect(48+i*32,geometry.selection[i]);addOwned(5,n.id,std::move(g));
      }
    }
  };
  if(frame)forFrameRows([&](const auto& item){const auto& node=rows->get(item.node);interactionBlobs(node,&item);
    if(node.layerLink.role){Writer data(wire::layerCompositionBytes);
      data.u32(0,node.layerLink.role);data.u32(4,(node.layerLink.leader?wire::layerCompositionFlags::linked:0u)|
        (item.layerTransform?wire::layerCompositionFlags::hasTransform:0u)|
        (node.layerLink.role==2&&node.layerLink.showWhenUnlinked?wire::layerCompositionFlags::showWhenUnlinked:0u));
      writeHandle(data,8,node.layerLink.leader);
      if(item.layerTransform){const auto& m=*item.layerTransform;const std::array<double,6> values{m.a,m.b,m.c,m.d,m.tx,m.ty};
        for(size_t i=0;i<values.size();++i)data.f64(16+i*8,values[i]);}
      data.f64(64,item.linkedOffset.x);data.f64(72,item.linkedOffset.y);
      addOwned(wire::layerCompositionBlob,node.id,std::move(data));
    }
  });
  else if(rows)for(const auto* node:rowNodes)interactionBlobs(*node);
  for(size_t i=0;i<events.size();++i){const auto& event=events[i];const auto& tap=event.tapRegion;
    if(event.kind==wire::events::key&&event.keyIdentity.keyLength){const auto& identity=event.keyIdentity;
      const size_t length=size_t(identity.keyLength)+identity.codeLength;
      Writer data(wire::keyIdentityEventBytes+(length+7)/8*8);data.u32(0,uint32_t(i));
      data.u32(4,identity.keyLength);data.u32(8,identity.codeLength);data.u32(12,identity.location);
      std::copy_n(identity.key.begin(),identity.keyLength,data.bytes.begin()+wire::keyIdentityEventBytes);
      std::copy_n(identity.code.begin(),identity.codeLength,data.bytes.begin()+wire::keyIdentityEventBytes+identity.keyLength);
      addOwned(wire::keyIdentityEventBlob,event.node,std::move(data));}
    if(event.kind==wire::events::pointer){Writer data(wire::pointerEventBytes);data.u32(0,uint32_t(i));
      std::copy(event.pointer.input.begin(),event.pointer.input.end(),data.bytes.begin()+8);
      const auto& inverse=event.pointer.inverse;
      const std::array<double,6> matrix{inverse.a,inverse.b,inverse.c,inverse.d,inverse.tx,inverse.ty};
      for(size_t j=0;j<matrix.size();++j)data.f64(8+wire::inputBytes+j*8,matrix[j]);
      addOwned(wire::pointerEventBlob,event.node,std::move(data));}
    if(event.semanticSource){Writer data(wire::semanticSourceEventBytes);data.u32(0,uint32_t(i));
      writeHandle(data,8,event.semanticSource);addOwned(wire::semanticSourceEventBlob,event.node,std::move(data));}
    if(!tap.batch)continue;
    Writer data(wire::tapRegionEventBytes);data.u32(0,uint32_t(i));data.u32(4,tap.device);data.u64(8,tap.batch);
    writeHandle(data,16,tap.surface);writeHandle(data,24,tap.semanticTarget);
    const std::array<double,6> matrix{tap.inverse.a,tap.inverse.b,tap.inverse.c,tap.inverse.d,tap.inverse.tx,tap.inverse.ty};
    for(size_t j=0;j<matrix.size();++j)data.f64(32+j*8,matrix[j]);
    addOwned(wire::tapRegionEventBlob,event.node,std::move(data));
  }
  if(status==wire::statuses::ok&&opcode==wire::opcodes::pollRaw&&view){
    for(uint32_t count=0;!view->rawInputs.empty()&&count<wire::limits::eventsPerPoll;++count){
      const auto& sample=view->rawInputs.front();Writer bytes(sample.bytes.size());
      std::copy(sample.bytes.begin(),sample.bytes.end(),bytes.bytes.begin());
      addOwned(8,sample.node,std::move(bytes));view->rawInputs.pop_front();}}
  if(status==wire::statuses::ok&&opcode==wire::opcodes::pollInteractionEvents&&view)
    for(const auto& event:events)if(event.kind==wire::events::gestureDecision){
      const auto stream=uint32_t(event.detail);
      if(stream<view->streams.size()&&view->streams[stream].decision==event.id&&view->streams[stream].appPending){
        const auto sample=rawSample(*view->streams[stream].appPending,event.node,0);
        Writer bytes(sample.bytes.size());std::copy(sample.bytes.begin(),sample.bytes.end(),bytes.bytes.begin());
        addOwned(9,event.node,std::move(bytes));}}
  if (rows && (opcode == wire::opcodes::preparationScene || measure)) {
    std::set<uint64_t> resources;
    size_t inlineResourceBytes=0;
    for (const auto* node : rowNodes) {
      const auto& n = *node;
      if (n.text) blobs.push_back({1, n.id, {reinterpret_cast<const uint8_t*>(n.text->value.data()), n.text->value.size()}});
      if (!providerPreparationObservation&&n.resource && resources.insert(n.resource->id.key()).second) {
        // The preparation holds backing across bounded Content reads.
        if(n.resource->bytes.size()>wire::limits::imageChunkBytes-inlineResourceBytes){
          Writer data(8);data.u32(0,uint32_t(n.resource->bytes.size()));
          addOwned(wire::imageResourceBlob,n.resource->id,std::move(data));
        }else {inlineResourceBytes+=n.resource->bytes.size();
          blobs.push_back({2, n.resource->id, {n.resource->bytes.data(), n.resource->bytes.size()}});}
      }
    }
    // Resource identity is independent of the node-row dictionary. Keep only
    // bounded descriptors here; existing preparation-scoped reads own bytes.
    if(providerPreparationObservation)for(const auto& slot:rows->nodes)if(slot.value&&slot.value->resource){
      const auto& resource=*slot.value->resource;if(!resources.insert(resource.id.key()).second)continue;
      Writer data(8);data.u32(0,uint32_t(resource.bytes.size()));addOwned(wire::imageResourceBlob,resource.id,std::move(data));}
  }
  for (const auto& blob : blobs) blobBytes += 24 + (blob.data.length + 7) / 8 * 8;
  // A bounded response can include every admitted node, unlike a delta request.
  if(wire::headerBytes+wire::stateBytes+(frame?frameRowCount:rowNodes.size())*wire::nodeBytes+events.size()*wire::eventBytes+blobBytes>wire::limits::responseBytes){
    // takeFrame created this holder while the Core lock is held. No provider
    // can have received it when its response is rejected, so it must not keep
    // close busy or require a release for a frame the caller never acquired.
    if(opcode==wire::opcodes::takeFrame&&view&&frame){const auto unissued=frame->id;
      frame=nullptr;view->frames.erase(unissued);view->dirty=true;}
    status=wire::statuses::budgetExceeded;rows=nullptr;rowNodes.clear();blobs.clear();blobBytes=0;frame=nullptr;
  }
  const auto rowCount = rows && !reusedObservation ? (frame ? frameRowCount : rowNodes.size()) : 0;
  Writer response(wire::headerBytes + wire::stateBytes + rowCount * wire::nodeBytes +
    events.size() * wire::eventBytes + blobBytes);
  response.u32(wire::headerFields::magic, wire::magic); response.u16(wire::headerFields::major, wire::abiMajor); response.u16(wire::headerFields::minor, wire::abiMinor);
  response.u32(wire::headerFields::schema, wire::schema); response.u16(wire::headerFields::opcode, uint16_t(opcode | 0x8000));
  response.u16(wire::headerFields::status, uint16_t(status)); response.u32(wire::headerFields::length, uint32_t(response.bytes.size()));
  response.u32(wire::headerFields::session, s.session); response.u32(wire::headerFields::app, s.app); response.u32(wire::headerFields::view, viewId);
  response.u32(wire::headerFields::generation, generation); response.u64(wire::headerFields::id, id); response.u64(wire::headerFields::base, resultEpoch);
  response.u32(wire::headerFields::count, uint32_t(rowCount));
  const auto b = wire::headerBytes;
  response.u64(b + wire::stateFields::reservedBytes, s.ledger->bytes); response.u64(b + wire::stateFields::resourceBytes, s.ledger->resourceBytes);
  response.u64(b + wire::stateFields::nodeBlocks, s.ledger->nodes); response.u32(b + wire::stateFields::eventCount, uint32_t(events.size()));
  const auto memory=s.ledger->snapshot();
  for(const auto& [offset,value]:{std::pair{wire::stateFields::memoryTotal,memory.total},
    {wire::stateFields::memoryPeak,memory.peak},{wire::stateFields::memoryCpu,memory.cpu},
    {wire::stateFields::memoryGpu,memory.gpu},{wire::stateFields::memoryStaging,memory.staging},
    {wire::stateFields::engineHeap,memory.engineHeap},{wire::stateFields::providerHeap,memory.providerHeap},
    {wire::stateFields::memoryRejected,memory.rejected},{wire::stateFields::memoryLimit,uint64_t(wire::limits::unifiedBytes)}})
    response.u64(b+offset,value);
  response.u32(b + wire::stateFields::sessionQueued, s.ledger->queuedInputs); response.u32(b + wire::stateFields::sessionUpdates, s.ledger->updateInputs);
  response.u32(b + wire::stateFields::capabilities, actualCapabilities);
  response.u32(b + wire::stateFields::blobCount, uint32_t(blobs.size()));
  response.u32(b + wire::stateFields::blobBytes, uint32_t(blobBytes));
  response.u64(b + wire::stateFields::contentOwner, s.contentOwner);
  response.u64(b + wire::stateFields::renderOwner, s.renderOwner);
  uint32_t flags = s.closed || s.closing ? 1u : 0u;
  if (s.independent) flags |= 64u;
#ifdef __EMSCRIPTEN_PTHREADS__
  flags |= 32u;
#endif
  if (view) {
    const auto& v = *view;
    response.u64(b + wire::stateFields::document, v.document ? v.document->epoch : 0);
    response.u64(b + wire::stateFields::activeDocument, v.active ? v.active->document->epoch : 0);
    response.u64(b + wire::stateFields::scene, v.active ? v.active->epoch : 0);
    response.u64(b + wire::stateFields::preparation, v.preparing ? v.preparing->id : 0);
    response.u64(b + wire::stateFields::metrics, v.metrics.epoch); response.u64(b + wire::stateFields::property, v.propertyEpoch);
    response.f64(b + wire::stateFields::viewportWidth, v.metrics.width);
    response.f64(b + wire::stateFields::viewportHeight, v.metrics.height);
    response.f64(b + wire::stateFields::viewportScale, v.metrics.scale);
    response.u64(b + wire::stateFields::consumedThrough, v.consumedThrough); response.u64(b + wire::stateFields::received, v.received);
    response.u64(b + wire::stateFields::consumed, v.consumed); response.u64(b + wire::stateFields::canceled, v.canceled);
    response.u64(b + wire::stateFields::rejected, v.rejected); response.u64(b + wire::stateFields::duplicates, v.duplicates);
    response.u32(b + wire::stateFields::queued, uint32_t(v.input.size())); response.u32(b + wire::stateFields::holds, uint32_t(v.frames.size()));
    response.u64(b + wire::stateFields::pendingDocument, v.demand ? v.demand->epoch : 0);
    response.u64(b + wire::stateFields::submission, v.nextSubmission); response.u64(b + wire::stateFields::publication, v.publication);
    response.u64(b + wire::stateFields::surfaceCommit, v.surfaceCommit); response.u64(b + wire::stateFields::submitted, v.submitted);
    response.u64(b + wire::stateFields::ticks, v.ticks); response.u64(b + wire::stateFields::activated, v.activated);
    response.u64(b + wire::stateFields::device, v.metrics.device); response.u32(b + wire::stateFields::nodeCount, v.document ? v.document->count : 0);
    response.u64(b + wire::stateFields::pendingPublication, v.pendingPublication); response.u64(b + wire::stateFields::lastInput, v.lastInput);
    response.u64(b + wire::stateFields::lastTransaction, v.lastTransaction); response.u64(b + wire::stateFields::acknowledged, v.acknowledged);
    response.u64(b + wire::stateFields::activePreparation, v.active ? v.active->preparation : 0);
    response.u64(b + wire::stateFields::failedDocument, v.failedDocument);
    response.u64(b + wire::stateFields::transactionWork, v.transactionWork);
    if(v.document){const auto& d=*v.document;
      response.u64(b+wire::stateFields::transactionNodeClones,d.work.nodeClones);
      response.u64(b+wire::stateFields::transactionSlotPages,d.nodes.pageCopies);
      response.u64(b+wire::stateFields::transactionDirectories,d.nodes.directoryCopies);
      response.u64(b+wire::stateFields::transactionChildLists,d.children.blockCopies);
      response.u64(b+wire::stateFields::transactionFullValidations,d.work.fullValidations);
      response.u64(b+wire::stateFields::transactionIncrementalValidations,d.work.incrementalValidations);
      response.u64(b+wire::stateFields::transactionValidationVisits,d.work.validationVisits);
      response.u64(b+wire::stateFields::transactionSiblingVisits,d.work.siblingVisits);
      response.u64(b+wire::stateFields::transactionBlobRegistrations,d.work.blobRegistrations);
      response.u64(b+wire::stateFields::transactionBlobBindings,d.work.blobBindings);
      response.u64(b+wire::stateFields::transactionBlobBytes,d.work.blobBytes);
    }
    response.u64(b + wire::stateFields::contentWork, v.contentWork);
    response.u64(b + wire::stateFields::preparationDocument, v.preparing ? v.preparing->document->epoch : 0);
    const auto pending=v.measurement();
    response.u64(b + wire::stateFields::measureRequest,pending?pending->id:0);
    response.u64(b + wire::stateFields::measurePreparation,v.measurePreparation());
    response.u64(b + wire::stateFields::measureDocument,pending&&v.query&&v.query->preparation==v.measurePreparation()?
      v.query->document->epoch:pending&&v.preparing?v.preparing->document->epoch:0);
    if(v.query){const auto& q=*v.query;
      response.u64(b+wire::stateFields::queryId,q.id);response.u64(b+wire::stateFields::queryDocument,q.document->epoch);
      response.u64(b+wire::stateFields::queryMetrics,q.metrics.epoch);response.u64(b+wire::stateFields::queryFont,q.font);
      response.u32(b+wire::stateFields::queryStatus,q.status);response.u32(b+wire::stateFields::queryMode,q.mode);
      response.f64(b+wire::stateFields::queryWidth,q.value.width);response.f64(b+wire::stateFields::queryHeight,q.value.height);
      response.f64(b+wire::stateFields::queryBaseline,q.value.baseline);response.f64(b+wire::stateFields::queryValue,q.value.value);
    }
    response.u64(b + wire::stateFields::layoutWork, v.layoutWork);
    response.u64(b + wire::stateFields::imagePaintWork,v.imagePaintWork);
    response.u64(b + wire::stateFields::appFrameWork,v.appFrameSerial);
    response.u64(b + wire::stateFields::layoutReused, v.layoutReused);
    response.u64(b + wire::stateFields::layoutDocument, v.active ? v.active->document->epoch : 0);
    response.u64(b + wire::stateFields::layoutMetrics, v.active ? v.active->metrics.epoch : 0);
    response.u64(b + wire::stateFields::fontRevision, v.fontRevision);
    response.u64(b + wire::stateFields::coverageRequests,v.coverageRequests);
    response.u64(b + wire::stateFields::coverageDeferred,v.coverageDeferred);
    response.u64(b + wire::stateFields::coverageClamps,v.coverageClamps);
    response.u64(b + wire::stateFields::coverageHandoffs,v.coverageHandoffs);
    writeHandle(response,b+wire::stateFields::focusNode,v.focusNode);response.u64(b+wire::stateFields::focusSession,v.focusSession);
    const auto peer=v.published?v.published->focusPeer(v.focusNode):Handle{};
    writeHandle(response,b+wire::stateFields::focusPeer,v.document&&v.document->contains(peer)?peer:Handle{});
    response.u32(b+wire::stateFields::interactionCount,uint32_t(v.interactionEvents.size()));
    response.u64(b+wire::stateFields::editingWork,v.editingWork);response.u64(b+wire::stateFields::semanticsWork,v.semanticsWork);response.u64(b+wire::stateFields::queryWork,v.queryWork);
    response.u64(b+wire::stateFields::gestureWork,v.gestureWork);response.u64(b+wire::stateFields::controlWork,v.controlWork);
    response.u64(b+wire::stateFields::publishedDocument,v.published?v.published->scene->document->epoch:0);
    response.u64(b+wire::stateFields::publishedMetrics,v.published?v.published->scene->metrics.epoch:0);
    response.u64(b+wire::stateFields::publishedDevice,v.published?v.published->device:0);
    response.u64(b+wire::stateFields::keyWork,v.keyWork);response.u64(b+wire::stateFields::focusWork,v.focusWork);
    response.u32(b + wire::stateFields::providerPending,
      v.preparing && v.preparing->ready && !v.preparing->providerReady ? 1 : 0);
    response.f64(b + wire::stateFields::nextDeadline, v.nextDeadline());
    flags |= (v.closed ? 1u : 0u) | (v.visible ? 2u : 0u) | (v.focused ? 4u : 0u) |
      (v.wake() ? 8u : 0u) | (v.preparing && v.preparing->ready ? 16u : 0u) | (v.renderWake() ? 128u : 0u);
    if(build)flags|=wire::layoutBuildPending;
    if(v.published)for(const auto root:v.published->scene->document->children[0])
      if(v.published->scene->document->get(root).policy&wire::eventPolicies::canonicalKeyboard){flags|=256u;break;}
  }
  response.u32(b + wire::stateFields::flags, flags);
  if(frame){response.u64(b+wire::stateFields::framePaintWork,frame->paintWork);response.u64(b+wire::stateFields::framePaintNodes,frame->paintNodes);response.u64(b+wire::stateFields::framePlacementNodes,frame->placementNodes);}
  size_t cursor = b + wire::stateBytes;
  const auto frameFocus=frame?(opcode==wire::opcodes::semanticsSnapshot&&view?view->focusNode:frame->focusNode):Handle{};
  const auto framePeer=frame?frame->focusPeer(frameFocus):Handle{};
  forFrameRows([&](const auto& item) {
    const auto& n = rows->get(item.node);
    // Filters can pull an offscreen child's pixels into view. Do not cull by
    // the unfiltered border box before the provider's layer/clip processing.
    const bool drawable=n.properties.width>0&&n.properties.height>0&&item.clip.width>0&&item.clip.height>0;
    nodeRow(response, cursor, n, &frame->properties[n.id.slot], (drawable ? 16u : 0u)|
      (!providerObservation&&!frame->semantics.empty()&&frame->semantics[n.id.slot].blocked?wire::nodeFlags::semanticsBlocked:0u)|
      (n.id==framePeer?256u:0u)|(frame->focusNode==n.id&&frame->caretVisible?512u:0u), &item);
    cursor += wire::nodeBytes;
  });
  if (rows && !frame) for (const auto* node : rowNodes) {
    const Property* property = nullptr;
    Property current;
    uint32_t nodeFlags = 0;
    if (view&&!providerPreparationObservation) {
      if(view->focusNode==node->id)nodeFlags|=256u;
      const auto it = view->overlays.find(node->id.key());
      if (it != view->overlays.end()) {
        const auto& o = it->second;
        current = {o.node, o.offset, o.velocity, o.opacity, o.revision, o.motion,o.requested,o.deferred}; property = &current;
        if (o.ballistic) nodeFlags |= 8u;
      }
      if (view->active && view->active->document->contains(node->id)) nodeFlags |= 1u;
      if (view->published && view->published->scene->document->contains(node->id)) nodeFlags |= 2u;
      for (const auto& stream : view->streams) if (stream.active && stream.target == node->id) nodeFlags |= 4u;
    }
    if (measure && !measure->bounded) nodeFlags |= 32u;
    nodeRow(response, cursor, *node, property, nodeFlags);
    if (measure) response.f64(cursor + wire::nodeFields::width, measure->width);
    cursor += wire::nodeBytes;
  }
  for (const auto& e : events) {
    response.u32(cursor, e.kind); response.u32(cursor + 4, e.status);
    response.u64(cursor + 8, e.id); response.u64(cursor + 16, e.epoch);
    response.u64(cursor + 24, e.detail); writeHandle(response, cursor + 32, e.node);
    response.f64(cursor+40,e.x);response.f64(cursor+48,e.y);
    const auto& g=e.gesture;
    response.u32(cursor+wire::eventFields::pointerKind,g.kind);response.u32(cursor+wire::eventFields::stream,g.stream);
    response.f64(cursor+wire::eventFields::timestamp,g.timestamp);
    response.f64(cursor+wire::eventFields::localX,g.localX);response.f64(cursor+wire::eventFields::localY,g.localY);
    response.f64(cursor+wire::eventFields::deltaX,g.deltaX);response.f64(cursor+wire::eventFields::deltaY,g.deltaY);
    response.f64(cursor+wire::eventFields::velocityX,g.velocityX);response.f64(cursor+wire::eventFields::velocityY,g.velocityY);
    response.f64(cursor+wire::eventFields::originX,g.originX);response.f64(cursor+wire::eventFields::originY,g.originY);
    response.f64(cursor+wire::eventFields::localOriginX,g.localOriginX);response.f64(cursor+wire::eventFields::localOriginY,g.localOriginY);
    response.u32(cursor+wire::eventFields::buttons,g.buttons);response.u32(cursor+wire::eventFields::gestureFlags,g.flags);
    if(e.kind==wire::events::focusChanged)writeHandle(response,cursor+wire::eventFields::focusPeer,e.focusPeer);
    if(e.kind==wire::events::key)response.u64(cursor+wire::eventFields::clipboardReadSnapshot,e.clipboardReadSnapshot);
    cursor += wire::eventBytes;
  }
  for (const auto& blob : blobs) {
    response.u32(cursor, blob.type); writeHandle(response, cursor + 8, blob.id);
    response.u32(cursor + 16, uint32_t(blob.data.length));
    if (blob.data.length) std::memcpy(response.bytes.data() + cursor + 24, blob.data.data, blob.data.length);
    cursor += 24 + (blob.data.length + 7) / 8 * 8;
  }
  if(observation&&status==wire::statuses::ok){
    try{auto result=observationPacket(*view,*observation,response,providerObservation&&!partialObservation&&!reusedObservation?0:observationBase,observationKey,layoutSelection,reusedObservation,partialObservation,std::move(observationOrder),std::move(observationRemoved),providerFrameObservation?ObservationRole::frame:providerPreparationObservation?ObservationRole::preparation:ObservationRole::app);
      observation->selected=selectedLayout;
      if(providerPreparationObservation)view->providerPreparations->pages=rows->nodes.weakSnapshot();
      unissuedFrame.issued=true;return result;}
    catch(const Error& error){
      // A response rejected by the cache quota must retain coherent state,
      // but cannot publish a partial delta or advance the subscription base.
      unissuedFrame.retire();
      response.bytes.resize(wire::headerBytes+wire::stateBytes);
      response.u16(wire::headerFields::status,uint16_t(error.status));
      response.u32(wire::headerFields::length,uint32_t(response.bytes.size()));
      response.u32(wire::headerFields::count,0);
      response.u32(wire::headerBytes+wire::stateFields::eventCount,0);
      response.u32(wire::headerBytes+wire::stateFields::blobCount,0);
      response.u32(wire::headerBytes+wire::stateFields::blobBytes,0);
      response.u32(wire::headerBytes+wire::stateFields::holds,uint32_t(view->frames.size()));
      return std::move(response.bytes);
    }
  }
  unissuedFrame.issued=status==wire::statuses::ok;
  return std::move(response.bytes);
}
}
