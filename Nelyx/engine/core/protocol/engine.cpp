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

namespace {
constexpr uint32_t capabilities = wire::capabilities::protocol | wire::capabilities::headlessScene |
  wire::capabilities::scroll | wire::capabilities::motion;
void exact(Reader r, size_t count) { require(r.length == count); }
void invalidate(View& v, uint32_t reason) {
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
    r.u32(wire::inputFields::clock), r.u32(wire::inputFields::buttons), r.u32(wire::inputFields::modifiers), r.u32(wire::inputFields::device), r.u32(wire::inputFields::contact)};
  require(p.sequence > 0 && p.metrics > 0 && p.stream > 0 && p.stream <= wire::limits::streams &&
    p.phase >= wire::phases::begin && p.phase <= wire::phases::cancel &&
    p.source >= wire::sources::engineDriven && p.source <= wire::sources::wheelUnknown &&
    (p.flags & ~1u) == 0 && p.time >= 0 && p.sample >= 0 && p.clock > 0 && p.clock <= 3 &&
    r.u32(wire::inputFields::reserved) == 0, wire::statuses::invalidValue);
  return p;
}
void nodeRow(Writer& w, size_t p, const Node& n, const Property* o, uint32_t flags, const DrawItem* item = nullptr) {
  writeHandle(w, p, n.id); w.u32(p + 8, n.kind); writeHandle(w, p + 12, n.parent);
  w.u32(p + 20, flags);
  w.f64(p + 24, item ? item->x : n.properties.x); w.f64(p + 32, item ? item->y : n.properties.y);
  w.f64(p + 40, n.properties.width); w.f64(p + 48, n.properties.height);
  w.f64(p + 56, o ? o->offset : 0); w.f64(p + 64, o ? o->velocity : 0);
  w.u64(p + 72, o ? o->revision : 0); w.f64(p + 80, item ? item->opacity : o ? o->opacity : n.properties.opacity);
  w.u64(p + 88, o ? o->motion : 0);
  w.u32(p + wire::nodeFields::color, n.color); w.u32(p + wire::nodeFields::order, n.order);
  w.f64(p + wire::nodeFields::radius, n.radius); w.f64(p + wire::nodeFields::fontSize, n.fontSize);
  writeHandle(w, p + wire::nodeFields::resource, n.resource ? n.resource->id : Handle{});
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
    require(!s.closed || opcode == wire::opcodes::inspect || opcode == wire::opcodes::closeSession,
      wire::statuses::closed);
    require(!s.closing || opcode == wire::opcodes::inspect || opcode == wire::opcodes::closeSession ||
      opcode == wire::opcodes::pollEvents || opcode == wire::opcodes::releaseFrame ||
      opcode == wire::opcodes::closeView, wire::statuses::closed);
    if (opcode == wire::opcodes::hello) {
      exact(body, 8); require(viewId == 0 && generation == 0 && body.u32(4) == 0);
      require((body.u32(0) & ~actualCapabilities) == 0, wire::statuses::capabilityMissing);
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
        v.enqueue(readInput(body));
      } else if (opcode == wire::opcodes::contentStep) {
        exact(body, 8); require(body.u32(0) > 0 && body.u32(0) <= wire::limits::contentPerStep && body.u32(4) == 0);
        v.contentStep(body.u32(0));
      } else if (opcode == wire::opcodes::preparationResult) {
        exact(body, 24);
        require(body.u64(8) == v.metrics.epoch && body.u64(16) == v.metrics.device, wire::statuses::stale);
        v.failPreparation(body.u64(0), wire::statuses::failed);
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
      } else if (opcode == wire::opcodes::visibility) {
        exact(body, 16); const auto flags = body.u32(0);
        require((flags & ~7u) == 0 && body.u32(4) == 0 && body.u64(8) == v.lastInput);
        const bool visible = (flags & 1u) != 0, focused = (flags & 2u) != 0;
        if ((!v.visible && visible) || (!v.focused && focused))
          for (auto& stream : v.streams) stream.denied = false;
        if (!visible || !focused) v.cancelInput(wire::statuses::canceled);
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

  const Document* rows = frame ? frame->scene->document.get() :
    opcode == wire::opcodes::inspect && view ? view->document.get() :
    status == wire::statuses::ok && opcode == wire::opcodes::preparationScene && view && view->preparing ?
      view->preparing->document.get() : nullptr;
  struct Blob { uint32_t type; Handle id; Reader data; };
  std::vector<Blob> blobs; size_t blobBytes = 0;
  if (rows && opcode == wire::opcodes::preparationScene) {
    std::set<uint64_t> resources;
    for (const auto& slot : rows->nodes) if (slot.value) {
      const auto& n = *slot.value;
      if (n.text) blobs.push_back({1, n.id, {reinterpret_cast<const uint8_t*>(n.text->value.data()), n.text->value.size()}});
      if (n.resource && resources.insert(n.resource->id.key()).second)
        blobs.push_back({2, n.resource->id, {n.resource->bytes.data(), n.resource->bytes.size()}});
    }
    for (const auto& blob : blobs) blobBytes += 24 + (blob.data.length + 7) / 8 * 8;
    if (wire::headerBytes + wire::stateBytes + rows->count * wire::nodeBytes + blobBytes > wire::limits::packetBytes) {
      status = wire::statuses::budgetExceeded; rows = nullptr; blobs.clear(); blobBytes = 0;
    }
  }
  const auto rowCount = rows ? rows->count : 0;
  Writer response(wire::headerBytes + wire::stateBytes + rowCount * wire::nodeBytes +
    events.size() * wire::eventBytes + blobBytes);
  response.u32(wire::headerFields::magic, wire::magic); response.u16(wire::headerFields::major, wire::abiMajor); response.u16(wire::headerFields::minor, wire::abiMinor);
  response.u32(wire::headerFields::schema, wire::schema); response.u16(wire::headerFields::opcode, uint16_t(opcode | 0x8000));
  response.u16(wire::headerFields::status, uint16_t(status)); response.u32(wire::headerFields::length, uint32_t(response.bytes.size()));
  response.u32(wire::headerFields::session, s.session); response.u32(wire::headerFields::app, s.app); response.u32(wire::headerFields::view, viewId);
  response.u32(wire::headerFields::generation, generation); response.u64(wire::headerFields::id, id); response.u64(wire::headerFields::base, resultEpoch);
  response.u32(wire::headerFields::count, rowCount);
  const auto b = wire::headerBytes;
  response.u64(b + wire::stateFields::reservedBytes, s.ledger->bytes); response.u64(b + wire::stateFields::resourceBytes, s.ledger->resourceBytes);
  response.u64(b + wire::stateFields::nodeBlocks, s.ledger->nodes); response.u32(b + wire::stateFields::eventCount, uint32_t(events.size()));
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
    response.u32(b + wire::stateFields::providerPending,
      v.preparing && v.preparing->ready && !v.preparing->providerReady ? 1 : 0);
    double deadline = 0;
    for (const auto& entry : v.commands)
      if (deadline == 0 || entry.second.deadline < deadline) deadline = entry.second.deadline;
    response.f64(b + wire::stateFields::nextDeadline, deadline);
    flags |= (v.closed ? 1u : 0u) | (v.visible ? 2u : 0u) | (v.focused ? 4u : 0u) |
      (v.wake() ? 8u : 0u) | (v.preparing && v.preparing->ready ? 16u : 0u) | (v.renderWake() ? 128u : 0u);
  }
  response.u32(b + wire::stateFields::flags, flags);
  size_t cursor = b + wire::stateBytes;
  if (frame) for (const auto& item : frame->items) {
    const auto& n = rows->get(item.node);
    const bool drawable = n.properties.width > 0 && n.properties.height > 0 && item.clip.width > 0 &&
      item.clip.height > 0 && item.x < item.clip.x + item.clip.width && item.y < item.clip.y + item.clip.height &&
      item.x + n.properties.width > item.clip.x && item.y + n.properties.height > item.clip.y;
    nodeRow(response, cursor, n, &frame->properties[n.id.slot], drawable ? 16u : 0u, &item);
    cursor += wire::nodeBytes;
  }
  if (rows && !frame) for (const auto& slot : rows->nodes) if (slot.value) {
    const Property* property = nullptr;
    Property current;
    uint32_t nodeFlags = 0;
    if (view) {
      const auto it = view->overlays.find(slot.value->id.key());
      if (it != view->overlays.end()) {
        const auto& o = it->second;
        current = {o.node, o.offset, o.velocity, o.opacity, o.revision, o.motion}; property = &current;
        if (o.ballistic) nodeFlags |= 8u;
      }
      if (view->active && view->active->document->contains(slot.value->id)) nodeFlags |= 1u;
      if (view->published && view->published->scene->document->contains(slot.value->id)) nodeFlags |= 2u;
      for (const auto& stream : view->streams) if (stream.active && stream.target == slot.value->id) nodeFlags |= 4u;
    }
    nodeRow(response, cursor, *slot.value, property, nodeFlags); cursor += wire::nodeBytes;
  }
  for (const auto& e : events) {
    response.u32(cursor, e.kind); response.u32(cursor + 4, e.status);
    response.u64(cursor + 8, e.id); response.u64(cursor + 16, e.epoch);
    response.u64(cursor + 24, e.detail); writeHandle(response, cursor + 32, e.node);
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
