// SPDX-License-Identifier: BSD-3-Clause
#include "../engine.hpp"
#include "../state.hpp"
#include <algorithm>
#include <mutex>
#include <set>

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
  auto result=std::make_shared<InteractionSnapshot>();result->frame=*v.published;result->document=v.document;
  result->focus=v.focusNode;result->session=v.focusSession;result->metrics=v.metrics;
  for(const auto& entry:v.editors)result->editors.emplace(entry.first,entry.second->value);return result;
}
namespace {
constexpr uint32_t capabilities = coreCapabilities;
void exact(Reader r, size_t count) { require(r.length == count); }
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
  w.u32(p + 20, flags | (item?item->flags:0u) | (o && o->deferred ? 64u : 0u) | (n.coverage.enabled ? 128u : 0u)|(n.extensionSize.x>0?wire::nodeFlags::nativeExtension:0u));
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

std::vector<uint8_t> Engine::dispatch(Reader packet) {
  auto& s = *state_;
  std::unique_lock lock(s.mutex);
  const uint32_t actualCapabilities = capabilities | (s.providerConnected ? wire::capabilities::surface : 0) |
    (s.independent ? wire::capabilities::contentIndependent : 0);
  uint32_t status = wire::statuses::ok, opcode = 0, viewId = 0, generation = 0;
  uint64_t id = 0, resultEpoch = 0;
  View* view = nullptr;
  std::shared_ptr<View> retained;
  const Frame* frame = nullptr;
  Handle editTarget;
  std::vector<Event> events;
  try {
    require(packet.length >= wire::headerBytes && packet.length <= wire::limits::packetBytes);
    opcode = packet.u16(wire::headerFields::opcode); viewId = packet.u32(wire::headerFields::view); generation = packet.u32(wire::headerFields::generation); id = packet.u64(wire::headerFields::id);
    require(packet.u32(wire::headerFields::magic) == wire::magic && packet.u32(wire::headerFields::length) == packet.length &&
      packet.u16(wire::headerFields::status) == 0 && packet.u32(wire::headerFields::reserved) == 0 && packet.u32(wire::headerFields::reservedTail) == 0);
    require(packet.u16(wire::headerFields::major) == wire::abiMajor && packet.u16(wire::headerFields::minor) <= wire::abiMinor &&
      packet.u32(wire::headerFields::schema) == wire::schema, wire::statuses::incompatible);
    require(packet.u32(wire::headerFields::session) == s.session && packet.u32(wire::headerFields::app) == s.app, wire::statuses::staleGeneration);
    const auto body = packet.slice(wire::headerBytes, packet.length - wire::headerBytes);
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
      exact(body,16);require(!viewId&&!generation,wire::statuses::invalidHandle);
      s.ledger->report(body.u32(0),body.u32(4),body.u64(8),s.closed||s.closing);
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
      exact(body, 0); require(generation == 0);
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
      if (opcode == wire::opcodes::transaction) {
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
          try {
            require(packet.u64(wire::headerFields::base) == v.document->epoch, wire::statuses::baseConflict);
            const auto original = v.document;
            const auto resources = s.resources;
            const auto resourceRevision = s.resourceRevision;
            v.transactionActive = true;
            lock.unlock();
            Installed installed;
            try { installed = transact(original, resources, body, count); }
            catch (...) { lock.lock(); v.transactionActive = false; throw; }
            lock.lock(); v.transactionActive = false;
            require(!v.closed && !s.closing && !s.closed && s.views[viewId] == retained,
              wire::statuses::closed);
            require(resourceRevision == s.resourceRevision, wire::statuses::busy);
            v.installEditors(installed.document);
            v.document = std::move(installed.document); s.resources = std::move(installed.resources);
            ++s.resourceRevision; v.transactionWork += count;
            status = wire::statuses::accepted; resultEpoch = v.document->epoch;
          } catch (const Error& error) { status = error.status; }
          result->status = status; result->epoch = resultEpoch;
          if (status == wire::statuses::accepted) v.requestContent();
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
        require(body.length>=wire::measurementBytes&&body.u32(wire::measureFields::flags)<=1&&body.u32(wire::measureFields::reserved)==0);
        Measurement value{body.f64(40), body.f64(48), body.f64(56), body.f64(64), body.f64(72)};
        value.didExceedMaxLines=(body.u32(wire::measureFields::flags)&wire::measurementFlags::didExceedMaxLines)!=0;
        std::optional<MeasurementRequest> pending;
        if(v.preparing&&v.preparing->id==body.u64(0)&&v.preparing->layout&&v.preparing->layout->waiting())pending=v.preparing->layout->request();
        else if(v.query&&v.query->preparation==body.u64(0)&&v.query->work&&v.query->work->waiting())pending=v.query->work->request();
        require(pending&&pending->node->id==handle(body,32),wire::statuses::stale);
        require(!value.didExceedMaxLines||pending->node->kind==wire::kinds::paragraph||pending->node->kind==wire::kinds::editable,wire::statuses::invalidValue);
        if(body.length>wire::measurementBytes){
          require(body.length>=wire::measurementGeometryBytes&&pending->node->kind==wire::kinds::editable&&pending->node->editing&&
            pending->node->editing->revision==body.u64(wire::measureFields::geometryRevision)&&body.u32(wire::measureFields::geometryReserved)==0,wire::statuses::stale);
          const auto rectCount=body.u32(wire::measureFields::selectionCount);require(rectCount<=wire::limits::selectionRects&&body.length==wire::measurementGeometryBytes+size_t(rectCount)*32,wire::statuses::budgetExceeded);
          const auto rect=[&](size_t offset){TextRect r{body.f64(offset),body.f64(offset+8),body.f64(offset+16),body.f64(offset+24)};
            require(r.width>=0&&r.height>=0,wire::statuses::invalidValue);return r;};
          std::vector<TextRect> boxes;boxes.reserve(rectCount);for(uint32_t i=0;i<rectCount;++i)boxes.push_back(rect(wire::measureFields::selection+i*32));
          value.geometry=std::make_shared<TextGeometry>(s.ledger,body.u64(wire::measureFields::geometryRevision),rect(wire::measureFields::caret),std::move(boxes));
        }else require(!pending||pending->node->kind!=wire::kinds::editable,wire::statuses::malformed);
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
        exact(body, 0); require(bool(v.active), wire::statuses::notFound);
      } else if (opcode == wire::opcodes::fontRevision) {
        exact(body, 16);
        require(body.u64(0) > v.fontRevision && body.u64(8) == v.lastInput, wire::statuses::stale);
        v.fontRevision = body.u64(0); invalidate(v, wire::statuses::stale);
      } else if(opcode==wire::opcodes::focus){
        require(body.length==24||(body.length==32&&body.u32(24)==1&&body.u32(28)==0));
        v.setFocus(handle(body,0),body.u64(8),body.u64(16),body.length==32);
      } else if(opcode==wire::opcodes::edit){
        v.applyEdit(body);editTarget=handle(body,0);
      } else if(opcode==wire::opcodes::editSnapshot){
        exact(body,8);require(v.document&&v.document->contains(handle(body,0))&&v.editors.contains(handle(body,0).key()),wire::statuses::invalidHandle);
        editTarget=handle(body,0);
      } else if(opcode==wire::opcodes::semanticsSnapshot){
        exact(body,0);require(bool(v.published),wire::statuses::notFound);frame=&*v.published;
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
        exact(body, 0); require(v.preparing && v.preparing->ready, wire::statuses::notFound);
      } else if (opcode == wire::opcodes::providerReady) {
        exact(body, 24);
        require(v.preparing && v.preparing->ready && body.u64(0) == v.preparing->id &&
          body.u64(8) == v.preparing->metrics.epoch && body.u64(16) == v.preparing->metrics.device,
          wire::statuses::stale);
        v.preparing->providerReady = true;
      } else if (opcode == wire::opcodes::tick) {
        exact(body, 8); v.tick(body.f64(0));
      } else if (opcode == wire::opcodes::requestAppFrame) {
        exact(body,0);v.appFrameRequested=true;v.dirty=true;
      } else if (opcode == wire::opcodes::takeFrame) {
        exact(body, 0); status = v.takeFrame();
        if (status == wire::statuses::ok) frame = &v.frames.at(v.nextSubmission);
      } else if (opcode == wire::opcodes::releaseFrame) {
        exact(body, 24); require(body.u32(16) <= 1 && body.u32(20) <= 1);
        v.releaseFrame(body.u64(0), body.u64(8), bool(body.u32(16)), bool(body.u32(20)));
      } else if (opcode == wire::opcodes::publish) {
        exact(body, 24); v.publish(body.u64(0), body.u64(8), body.u64(16));
      } else if (opcode == wire::opcodes::scroll) {
        status = v.scroll(body, id);
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
        exact(body, 0);
      }
      if (v.overflowed && !v.closed) { v.close(wire::statuses::eventOverflow); frame = nullptr; }
    }
  } catch (const Error& error) { status = error.status; frame = nullptr; }

  const auto measureStorage=status==wire::statuses::ok&&opcode==wire::opcodes::measureRequest&&view?view->measurement():std::optional<MeasurementRequest>{};
  const MeasurementRequest* measure=measureStorage?&*measureStorage:nullptr;
  const Document* measureDocument=measure&&view->query&&view->query->preparation==view->measurePreparation()?
    view->query->document.get():measure&&view->preparing?view->preparing->document.get():nullptr;
  const Document* rows = frame ? frame->scene->document.get() :
    editTarget&&view?view->document.get():
    status == wire::statuses::ok && opcode == wire::opcodes::layoutSnapshot && view ? view->active->document.get() :
    measureDocument ? measureDocument :
    opcode == wire::opcodes::inspect && view ? view->document.get() :
    status == wire::statuses::ok && opcode == wire::opcodes::preparationScene && view && view->preparing ?
      view->preparing->document.get() : nullptr;
  std::vector<const Node*> rowNodes;
  if (rows && !frame) {
    if(editTarget)rowNodes.push_back(&rows->get(editTarget));
    else if (measure) rowNodes.push_back(measure->node.get());
    else for (const auto& slot : rows->nodes) if (slot.value) rowNodes.push_back(slot.value.get());
  }
  struct Blob { uint32_t type; Handle id; Reader data; };
  std::vector<Blob> blobs; size_t blobBytes = 0;
  std::vector<std::vector<uint8_t>> ownedBlobs;
  const auto addOwned=[&](uint32_t type,Handle node,Writer bytes){ownedBlobs.push_back(std::move(bytes.bytes));
    const auto& data=ownedBlobs.back();blobs.push_back({type,node,{data.data(),data.size()}});};
  const auto interactionBlobs=[&](const Node& n){
    if(n.clipStyle)addOwned(12,n.id,clipStyleBytes(*n.clipStyle));
    if(n.resolvedPaint||n.nativePaint)addOwned(13,n.id,nativePaintBytes(*(n.resolvedPaint?n.resolvedPaint:n.nativePaint)));
    if(n.paragraph)addOwned(11,n.id,paragraphBytes(n.paragraph->value));
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
    const Property* visual=frame&&n.id.slot<frame->properties.size()?&frame->properties[n.id.slot]:nullptr;
    const auto overlay=view?view->overlays.find(n.id.key()):std::map<uint64_t,Overlay>::const_iterator{};
    const double controlValue=visual?visual->value:view&&overlay!=view->overlays.end()?overlay->second.value:n.control.value;
    if(n.control.kind){const auto& c=n.control;Writer data(72);data.u32(0,c.kind);data.u32(4,c.disabled|(c.appearance<<1));
      const bool pressed=visual?visual->pressed:view&&overlay!=view->overlays.end()&&overlay->second.pressed;
      const bool hovered=visual?visual->hovered:view&&overlay!=view->overlays.end()&&overlay->second.hovered;
      data.u32(8,(pressed?1u:0u)|(hovered?2u:0u));data.u32(12,c.foreground);data.u32(16,c.track);
      data.f64(24,c.minimum);data.f64(32,c.maximum);data.f64(40,c.step);data.f64(48,controlValue);
      data.f64(56,visual?visual->second:view&&overlay!=view->overlays.end()?overlay->second.second:c.second);
      data.u64(64,c.revision);addOwned(7,n.id,std::move(data));}
    if(n.listGeometry){const auto& list=*n.listGeometry;Writer data(64+list.rows.size()*40);
      data.u64(0,list.style.generation);data.u32(8,list.style.count);data.u32(12,list.style.begin);data.u32(16,list.style.end);
      double offset=0,height=view?view->metrics.height:0;
      if(view&&n.parent&&rows->contains(n.parent)){const auto& parent=rows->get(n.parent);
        const bool horizontal=(parent.properties.flags&1u)!=0;
        height=horizontal?parent.properties.width:parent.properties.height;const auto scrollOverlay=view->overlays.find(n.parent.key());
        if(scrollOverlay!=view->overlays.end())offset=scrollOverlay->second.requested-(horizontal?n.properties.x:n.properties.y);}
      const auto begin=list.indexAt(std::max(0.0,offset-height));
      data.u32(20,begin);data.u32(24,std::min(list.style.count,list.indexAt(offset+height*2)+1));
      data.u32(28,uint32_t(list.rows.size()));data.f64(32,list.style.estimate);
      data.f64(40,list.total);data.f64(48,list.begin);data.f64(56,list.end);
      for(size_t i=0;i<list.rows.size();++i){const auto& row=list.rows[i];const auto at=64+i*40;
        writeHandle(data,at,row.node);data.u32(at+8,row.index);data.u64(at+16,row.key);data.f64(at+24,row.offset);data.f64(at+32,row.extent);}
      addOwned(6,n.id,std::move(data));}
    if(n.semantics){const auto& a=*n.semantics;Writer bytes(wire::semanticsBytes+a.label.size()+a.hint.size()+a.value.size()+a.increasedValue.size()+a.decreasedValue.size());
      auto semanticFlags=(n.control.kind==wire::controlKinds::toggle||n.control.kind==wire::controlKinds::checkbox||n.control.kind==wire::controlKinds::radio)?
        (a.flags&~wire::semanticsFlags::checked)|(controlValue>n.control.minimum?wire::semanticsFlags::checked:0u):a.flags;
      if(n.control.disabled)semanticFlags|=wire::semanticsFlags::disabled;
      if(frame&&!frame->allows(n.id))semanticFlags|=wire::semanticsFlags::hidden;
      bytes.u32(0,a.role);bytes.u32(4,semanticFlags);bytes.u32(8,a.actions);bytes.u32(12,uint32_t(a.label.size()));bytes.u32(16,uint32_t(a.hint.size()));
      bytes.u32(20,uint32_t(a.value.size()));bytes.u32(24,a.range.enabled?(a.range.readOnly?3u:1u):0u);
      bytes.f64(32,a.range.minimum);bytes.f64(40,a.range.maximum);bytes.f64(48,a.range.value);bytes.f64(56,a.range.smallChange);bytes.f64(64,a.range.largeChange);
      bytes.u32(72,uint32_t(a.increasedValue.size()));bytes.u32(76,uint32_t(a.decreasedValue.size()));
      size_t at=wire::semanticsBytes;for(const auto* part:{&a.label,&a.hint,&a.value,&a.increasedValue,&a.decreasedValue}){
        std::memcpy(bytes.bytes.data()+at,part->data(),part->size());at+=part->size();}addOwned(3,n.id,std::move(bytes));
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
  if(frame)for(const auto& item:frame->items){const auto& node=rows->get(item.node);interactionBlobs(node);
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
  }
  else if(rows)for(const auto* node:rowNodes)interactionBlobs(*node);
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
    for (const auto* node : rowNodes) {
      const auto& n = *node;
      if (n.text) blobs.push_back({1, n.id, {reinterpret_cast<const uint8_t*>(n.text->value.data()), n.text->value.size()}});
      if (n.resource && resources.insert(n.resource->id.key()).second)
        blobs.push_back({2, n.resource->id, {n.resource->bytes.data(), n.resource->bytes.size()}});
    }
  }
  for (const auto& blob : blobs) blobBytes += 24 + (blob.data.length + 7) / 8 * 8;
  if(wire::headerBytes+wire::stateBytes+(frame?frame->items.size():rowNodes.size())*wire::nodeBytes+events.size()*wire::eventBytes+blobBytes>wire::limits::packetBytes){
    status=wire::statuses::budgetExceeded;rows=nullptr;rowNodes.clear();blobs.clear();blobBytes=0;frame=nullptr;
  }
  const auto rowCount = rows ? (frame ? frame->items.size() : rowNodes.size()) : 0;
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
  for(const auto [offset,value]:{std::pair{wire::stateFields::memoryTotal,memory.total},
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
    response.u64(b + wire::stateFields::layoutReused, v.layoutReused);
    response.u64(b + wire::stateFields::layoutDocument, v.active ? v.active->document->epoch : 0);
    response.u64(b + wire::stateFields::layoutMetrics, v.active ? v.active->metrics.epoch : 0);
    response.u64(b + wire::stateFields::fontRevision, v.fontRevision);
    response.u64(b + wire::stateFields::coverageRequests,v.coverageRequests);
    response.u64(b + wire::stateFields::coverageDeferred,v.coverageDeferred);
    response.u64(b + wire::stateFields::coverageClamps,v.coverageClamps);
    response.u64(b + wire::stateFields::coverageHandoffs,v.coverageHandoffs);
    writeHandle(response,b+wire::stateFields::focusNode,v.focusNode);response.u64(b+wire::stateFields::focusSession,v.focusSession);
    const auto peer=v.published?canonicalFocusPeer(*v.published->scene->document,v.focusNode):Handle{};
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
    if(v.published)for(const auto root:v.published->scene->document->children[0])
      if(v.published->scene->document->get(root).policy&wire::eventPolicies::canonicalKeyboard){flags|=256u;break;}
  }
  response.u32(b + wire::stateFields::flags, flags);
  size_t cursor = b + wire::stateBytes;
  const auto frameFocus=frame?(opcode==wire::opcodes::semanticsSnapshot&&view?view->focusNode:frame->focusNode):Handle{};
  const auto framePeer=frame?canonicalFocusPeer(*rows,frameFocus):Handle{};
  if (frame) for (const auto& item : frame->items) {
    const auto& n = rows->get(item.node);
    // Filters can pull an offscreen child's pixels into view. Do not cull by
    // the unfiltered border box before the provider's layer/clip processing.
    const bool drawable=n.properties.width>0&&n.properties.height>0&&item.clip.width>0&&item.clip.height>0;
    nodeRow(response, cursor, n, &frame->properties[n.id.slot], (drawable ? 16u : 0u)|
      (n.id==framePeer?256u:0u)|(frame->focusNode==n.id&&frame->caretVisible?512u:0u), &item);
    cursor += wire::nodeBytes;
  }
  if (rows && !frame) for (const auto* node : rowNodes) {
    const Property* property = nullptr;
    Property current;
    uint32_t nodeFlags = 0;
    if (view) {
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
    cursor += wire::eventBytes;
  }
  for (const auto& blob : blobs) {
    response.u32(cursor, blob.type); writeHandle(response, cursor + 8, blob.id);
    response.u32(cursor + 16, uint32_t(blob.data.length));
    if (blob.data.length) std::memcpy(response.bytes.data() + cursor + 24, blob.data.data, blob.data.length);
    cursor += 24 + (blob.data.length + 7) / 8 * 8;
  }
  return std::move(response.bytes);
}
}
