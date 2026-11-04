// SPDX-License-Identifier: BSD-3-Clause
#include "../state.hpp"
#include <algorithm>

namespace nelyx::v2 {
void View::event(Event e) {
  if (events.size() == wire::limits::events) { overflowed = true; return; }
  events.push_back(e);
}
void View::finishCommand(uint64_t id, uint32_t status) {
  const auto it = commands.find(id);
  if (it == commands.end()) return;
  const auto& c = it->second;
  const auto overlay = overlays.find(c.node.key());
  event({wire::events::scrollTerminal, status, id, document ? document->epoch : 0,
    overlay == overlays.end() ? 0 : overlay->second.revision, c.node});
  for (auto& result : commandResults) if (result.id == id) result.status = status;
  commands.erase(it);
}
void View::cancelStream(uint32_t stream, uint32_t reason) {
  auto& s = streams.at(stream);
  for (auto it = input.begin(); it != input.end();) {
    if (it->stream != stream) { ++it; continue; }
    if (it->phase == wire::phases::update) { --updates; --lease.ledger->updateInputs; }
    --lease.ledger->queuedInputs;
    ++canceled; it = input.erase(it);
  }
  if (s.active) event({wire::events::gestureCanceled, reason, lastInput, 0, stream, s.target});
  auto overlay = overlays.find(s.target.key());
  if (overlay != overlays.end()) { overlay->second.ballistic = false; overlay->second.velocity = 0; }
  s.active = false; s.denied = true;
}
void View::cancelInput(uint32_t reason) {
  for (uint32_t i = 1; i <= wire::limits::streams; ++i) cancelStream(i, reason);
  for (auto& entry : overlays) { entry.second.ballistic = false; entry.second.velocity = 0; }
}
void View::close(uint32_t reason) {
  if (closed) return;
  cancelInput(reason);
  while (!commands.empty()) finishCommand(commands.begin()->first, reason);
  if (preparing) event({wire::events::preparationCanceled, reason,
    preparing->id, preparing->document->epoch});
  if (demand) event({wire::events::skipped, reason, 0, demand->epoch});
  closed = true;
  --lease.ledger->activeViews;
  preparing.reset(); demand.reset(); document.reset(); active.reset(); published.reset();
  overlays.clear(); results.clear(); commandResults.clear(); resultBytes = 0;
  for (auto it = frames.begin(); it != frames.end();) {
    it->second.canceled = true;
    if (it->second.released) it = frames.erase(it);
    else ++it;
  }
  pendingPublication = 0; dirty = false;
  if (overflowed || events.size() == wire::limits::events) events.clear();
  event({wire::events::viewClosed, reason});
}
void View::requestContent() {
  if (!document || closed) return;
  if (demand && demand->epoch != document->epoch)
    event({wire::events::skipped, wire::statuses::superseded, 0, demand->epoch, document->epoch});
  demand = document;
}
void View::failPreparation(uint64_t id, uint32_t reason) {
  require(preparing && preparing->id == id, wire::statuses::stale);
  event({wire::events::preparationFailed, reason, id, preparing->document->epoch});
  failedDocument = preparing->document->epoch;
  preparing.reset();
}
void View::contentStep(uint32_t quota) {
  if (closed || metrics.width == 0 || metrics.height == 0) return;
  if (!preparing && demand) {
    const auto id = next(nextPreparation);
    auto p = std::make_unique<Preparation>();
    p->id = id; p->document = demand; p->metrics = metrics;
    p->providerReady = !providerRequired;
    preparing = std::move(p); demand.reset(); nextPreparation = id;
  }
  if (!preparing || preparing->ready) return;
  auto& p = *preparing;
  // A finite number of slots is inspected per call, including empty slots.
  // No future JS/provider response is waited for synchronously.
  uint32_t work = 0;
  while (p.cursor <= p.document->highWater && work++ < quota) {
    ++contentWork;
    const auto& slot = p.document->nodes[p.cursor++];
    if (!slot.value) continue;
    const auto& n = *slot.value;
    const auto valid = [](Axis a, double size, double viewport) {
      if (a.tag == wire::bounds::expand) return size == viewport;
      return size >= a.min && (a.tag != wire::bounds::finite || size <= a.max);
    };
    if (!valid(n.horizontal, n.properties.width, p.metrics.width) ||
        !valid(n.vertical, n.properties.height, p.metrics.height)) {
      failPreparation(p.id, wire::statuses::invalidValue); return;
    }
  }
  if (p.cursor > p.document->highWater) p.ready = true;
}
void View::activate() {
  if (!preparing || !preparing->ready || !preparing->providerReady) return;
  const auto& p = *preparing;
  if (p.metrics.epoch != metrics.epoch || p.metrics.device != metrics.device ||
      (active && p.document->epoch < active->document->epoch)) {
    event({wire::events::preparationCanceled, wire::statuses::stale, p.id, p.document->epoch});
    preparing.reset(); return;
  }
  const auto epoch = next(nextScene);
  auto scene = std::make_shared<Scene>(Scene{p.document, p.metrics, epoch, p.id});
  // Preserve compositor state by full node generation. A new declaration never
  // restores an App-observed scroll offset.
  for (auto it = overlays.begin(); it != overlays.end();) {
    const auto& overlay = it->second;
    if (!p.document->contains(overlay.node) ||
        (active && active->document->get(overlay.node).kind != p.document->get(overlay.node).kind)) {
      if (overlay.motion && !overlay.motionDone) event({wire::events::motionTerminal, wire::statuses::canceled,
        overlay.motion, p.document->epoch, 0, overlay.node});
      for (uint32_t i = 1; i <= wire::limits::streams; ++i)
        if (streams[i].target == overlay.node) cancelStream(i, wire::statuses::canceled);
      it = overlays.erase(it);
    } else ++it;
  }
  for (const auto& slot : p.document->nodes) if (slot.value) {
    const auto& n = *slot.value;
    auto [it, inserted] = overlays.try_emplace(n.id.key());
    auto& o = it->second;
    if (inserted) { o.node = n.id; o.opacity = n.properties.opacity; }
    if (n.kind == wire::kinds::scrollViewport) {
      const auto offset = n.properties.extent == wire::extents::unbounded ?
        std::max(n.properties.minimum, o.offset) :
        std::clamp(o.offset, n.properties.minimum, n.properties.maximum);
      if (offset != o.offset) { o.offset = offset; o.revision = next(o.revision); }
    }
    if (n.motion.id != o.lastMotion) {
      o.lastMotion = n.motion.id;
      if (o.motion && !o.motionDone) event({wire::events::motionTerminal, wire::statuses::canceled,
        o.motion, p.document->epoch, 0, n.id});
      if (n.motion.id && n.motion.baseRevision != o.motionRevision) {
        event({wire::events::motionTerminal, wire::statuses::stale,
          n.motion.id, p.document->epoch, o.motionRevision, n.id});
        o.motion = 0;
      } else {
        o.motion = n.motion.id; o.motionStart = o.opacity; o.motionTarget = n.motion.target;
        o.motionSeconds = n.motion.seconds; o.motionElapsed = 0;
        o.motionDone = false;
        o.motionRevision = next(o.motionRevision);
      }
    }
    if (!o.motion) o.opacity = n.properties.opacity;
  }
  active = std::move(scene); nextScene = epoch; ++activated; dirty = true;
  if (active->document->epoch >= failedDocument) failedDocument = 0;
  event({wire::events::activated, wire::statuses::ok, p.id, p.document->epoch, epoch});
  preparing.reset();
}
void View::enqueue(Input p) {
  if (p.sequence <= lastInput) { ++duplicates; return; }
  lastInput = p.sequence; ++received;
  auto& stream = streams[p.stream];
  if (closed || !visible || !focused || metrics.width == 0 || metrics.height == 0 ||
      p.metrics != metrics.epoch || (stream.denied && p.phase != wire::phases::begin)) {
    ++rejected; return;
  }
  const auto views = std::max(1u, lease.ledger->activeViews);
  if (lease.ledger->queuedInputs >= wire::limits::inputPackets ||
      input.size() >= wire::limits::inputPackets / views ||
      (p.phase == wire::phases::update && (lease.ledger->updateInputs >= wire::limits::inputUpdates ||
        updates >= wire::limits::inputUpdates / views))) {
    cancelStream(p.stream, wire::statuses::budgetExceeded);
    ++rejected;
    event({wire::events::inputOverflow, wire::statuses::budgetExceeded, p.sequence, 0, p.stream});
    return;
  }
  if (p.phase == wire::phases::begin) stream.denied = false;
  input.push_back(p);
  ++lease.ledger->queuedInputs;
  if (p.phase == wire::phases::update) { ++updates; ++lease.ledger->updateInputs; }
}
void View::applyDelta(Handle h, double delta) {
  if (!active) return;
  for (uint32_t depth = 0; h && depth <= wire::limits::depth; ++depth) {
    if (!active->document->contains(h)) return;
    const auto& n = active->document->get(h);
    if (n.kind == wire::kinds::scrollViewport) {
      auto& o = overlays.at(h.key());
      const auto target = std::clamp(o.offset + delta, -1e12, 1e12);
      const auto offset = n.properties.extent == wire::extents::unbounded ?
        std::max(n.properties.minimum, target) :
        std::clamp(target, n.properties.minimum, n.properties.maximum);
      const auto applied = offset - o.offset;
      if (applied != 0) { o.offset = offset; o.revision = next(o.revision); dirty = true; }
      delta -= applied;
      if (delta == 0 || !(n.properties.flags & 2u) || n.properties.extent != wire::extents::finite) return;
    }
    h = n.parent;
  }
}
uint32_t View::scroll(Reader r, uint64_t id) {
  require(r.length == 56 && id > 0 && r.u32(52) == 0);
  const auto found = std::find_if(commandResults.begin(), commandResults.end(),
    [id](const auto& result) { return result.id == id; });
  if (found != commandResults.end()) {
    require(found->bytes.size() == r.length &&
      std::equal(found->bytes.begin(), found->bytes.end(), r.data), wire::statuses::idReused);
    return found->status;
  }
  require(id > lastCommand, wire::statuses::resultExpired);
  const auto node = handle(r, 0);
  const auto policy = r.u32(48);
  require((policy & ~3u) == 0 && document->contains(node), wire::statuses::invalidHandle);
  require(document->get(node).kind == wire::kinds::scrollViewport, wire::statuses::invalidValue);
  const double target = r.f64(24), duration = r.f64(32), timeout = r.f64(40);
  require(duration >= 0 && duration <= 60 && timeout > 0 && timeout <= 2,
    wire::statuses::invalidValue);
  require(commands.size() < wire::limits::scrollCommands, wire::statuses::budgetExceeded);
  for (auto it = commands.begin(); it != commands.end();) {
    const auto old = it++;
    if (old->second.node == node) finishCommand(old->first, wire::statuses::superseded);
  }
  commands.emplace(id, ScrollCommand{id, r.u64(8), r.u64(16), node, target, duration,
    time + timeout, 0, 0, bool(policy & 1u), bool(policy & 2u), false});
  lastCommand = id;
  commandResults.push_back({id, std::vector<uint8_t>(r.data, r.data + r.length)});
  if (commandResults.size() > wire::limits::results) commandResults.pop_front();
  for (uint32_t i = 1; i <= wire::limits::streams; ++i) if (streams[i].active && streams[i].target == node) {
    if (!(policy & 1u)) { finishCommand(id, wire::statuses::busy); return wire::statuses::busy; }
    cancelStream(i, wire::statuses::canceled);
  }
  return wire::statuses::pending;
}
void View::tick(double now) {
  require(now >= 0 && (!hasTime || now >= time), wire::statuses::invalidValue);
  const double dt = hasTime && visible ? now - time : 0;
  time = now; hasTime = true; ++ticks;
  // Capture once. Never extend this cut to a concurrently produced tail, and
  // never wait for the queue or the App observer to become empty.
  const uint64_t cut = input.empty() ? 0 : input.back().sequence;
  uint32_t used = 0;
  while (!input.empty() && input.front().sequence <= cut && used++ < wire::limits::inputPerTick) {
    auto p = input.front(); input.pop_front();
    --lease.ledger->queuedInputs;
    if (p.phase == wire::phases::update) { --updates; --lease.ledger->updateInputs; }
    auto& stream = streams[p.stream];
    if (!p.target) p.target = stream.active ? stream.target : target(p.x, p.y);
    if (p.metrics != metrics.epoch || !published || !active ||
        published->scene->metrics.epoch != p.metrics ||
        !published->scene->document->contains(p.target) ||
        !active->document->contains(p.target)) { ++canceled; continue; }
    if (p.phase == wire::phases::begin || (!stream.active && p.source != wire::sources::engineDriven)) {
      if (active->document->get(p.target).policy & 1u) {
        ++canceled;
        event({wire::events::gestureCanceled, wire::statuses::capabilityMissing, p.sequence, 0,
          p.stream, p.target}); continue;
      }
      stream.active = true; stream.target = p.target; stream.source = p.source;
      auto& o = overlays.at(p.target.key()); o.ballistic = false; o.velocity = 0;
      for (auto it = commands.begin(); it != commands.end();) {
        const auto command = it++;
        if (command->second.node == p.target) finishCommand(command->first, wire::statuses::canceled);
      }
    }
    if (!stream.active || stream.target != p.target || stream.source != p.source) {
      ++canceled; continue;
    }
    ++consumed; consumedThrough = p.sequence;
    auto& o = overlays.at(stream.target.key());
    if (p.phase == wire::phases::update) {
      const auto& node = active->document->get(stream.target);
      applyDelta(stream.target, (node.properties.flags & 1u) ? p.dx : p.dy);
      o.velocity = p.velocity;
    } else if (p.phase == wire::phases::end || p.phase == wire::phases::cancel) {
      stream.active = false;
      if (p.phase == wire::phases::end && p.source == wire::sources::engineDriven &&
          std::abs(p.velocity) >= 1) {
        o.ballistic = true; o.start = o.offset; o.startVelocity = p.velocity; o.elapsed = 0;
      } else { o.ballistic = false; o.velocity = 0; }
    }
    if (p.source != wire::sources::engineDriven) stream.active = false;
  }
  if (visible && metrics.width > 0 && metrics.height > 0) activate();
  for (auto it = commands.begin(); it != commands.end();) {
    auto& c = (it++)->second;
    const auto id = c.id;
    if (!document->contains(c.node)) { finishCommand(id, wire::statuses::canceled); continue; }
    if (time >= c.deadline) { finishCommand(id, wire::statuses::timedOut); continue; }
    if (!visible || !active || active->document->epoch < c.after || !active->document->contains(c.node)) continue;
    auto& o = overlays.at(c.node.key());
    if (!c.started) {
      if (c.revision != o.revision && !c.rebase) { finishCommand(id, wire::statuses::stale); continue; }
      c.started = true; c.start = o.offset; o.ballistic = false;
    }
    c.elapsed += dt;
    const auto value = c.duration == 0 ? c.target : c.start +
      (c.target - c.start) * std::min(1.0, c.elapsed / c.duration);
    applyDelta(c.node, value - o.offset);
    if (c.duration == 0 || c.elapsed >= c.duration) finishCommand(id, wire::statuses::ok);
  }
  if (visible && active && metrics.width > 0 && metrics.height > 0) for (auto& entry : overlays) {
    auto& o = entry.second;
    if (o.ballistic) {
      o.elapsed += dt;
      const auto previous = o.offset;
      applyDelta(o.node, Friction::position(o.start, o.startVelocity, o.elapsed) - o.offset);
      o.velocity = Friction::velocity(o.startVelocity, o.elapsed);
      if (std::abs(o.velocity) < 1 || (o.offset == previous && dt > 0)) {
        o.ballistic = false; o.velocity = 0;
      }
    }
    if (o.motion && !o.motionDone) {
      const auto& declaration = active->document->get(o.node).motion;
      o.motionElapsed += dt;
      const auto t = o.motionSeconds == 0 ? 1 : std::min(1.0, o.motionElapsed / o.motionSeconds);
      o.opacity = o.motionStart + (o.motionTarget - o.motionStart) * t; dirty = true;
      if (t == 1) {
        o.motionDone = true;
        event({wire::events::motionTerminal, wire::statuses::ok,
          declaration.id, active->document->epoch, o.motionRevision, o.node});
      }
    }
  }
  if (dirty) propertyEpoch = next(propertyEpoch);
}
uint32_t View::takeFrame() {
  if (!visible || metrics.width == 0 || metrics.height == 0 || !active ||
      active->metrics.epoch != metrics.epoch || active->metrics.device != metrics.device)
    return wire::statuses::contentUnavailable;
  if (!dirty) return wire::statuses::notFound;
  if (frames.size() >= wire::limits::frames) return wire::statuses::busy;
  const auto id = next(nextSubmission);
  Frame f; f.id = id; f.device = metrics.device; f.scene = active; f.propertyEpoch = propertyEpoch;
  f.properties.resize(active->document->highWater + 1);
  for (const auto& slot : active->document->nodes) if (slot.value) {
    const auto& o = overlays.at(slot.value->id.key());
    f.properties[o.node.slot] = {o.node, o.offset, o.velocity, o.opacity, o.revision, o.motion};
  }
  makeDrawItems(f);
  frames.emplace(id, std::move(f)); nextSubmission = id; ++submitted; dirty = false;
  return wire::statuses::ok;
}
void View::releaseFrame(uint64_t id, uint64_t device, bool gpuObserved, bool failed) {
  const auto it = frames.find(id);
  require(it != frames.end() && it->second.device == device && device == metrics.device,
    wire::statuses::stale);
  auto& f = it->second;
  if (f.released) return;
  f.released = true; f.gpuObserved = gpuObserved;
  if (id < publication || id < pendingPublication) {
    event({wire::events::publicationCanceled, wire::statuses::superseded, id, f.scene->document->epoch});
    frames.erase(it); return;
  }
  if (failed || f.scene->metrics.epoch != metrics.epoch) {
    if (pendingPublication == id) pendingPublication = 0;
    event({wire::events::publicationCanceled, failed ? wire::statuses::failed : wire::statuses::stale,
      id, f.scene->document->epoch});
    frames.erase(it); dirty = true; return;
  }
  if (f.published || f.canceled) { frames.erase(it); return; }
  if (pendingPublication) {
    const auto old = frames.find(pendingPublication);
    if (old != frames.end()) {
      event({wire::events::publicationCanceled, wire::statuses::superseded,
        old->first, old->second.scene->document->epoch});
      if (old->second.released) frames.erase(old);
      else old->second.canceled = true;
    }
  }
  pendingPublication = id;
}
void View::publish(uint64_t id, uint64_t device, uint64_t commit) {
  const auto it = frames.find(id);
  require(it != frames.end() && id == pendingPublication && device == metrics.device &&
    it->second.scene->metrics.epoch == metrics.epoch, wire::statuses::stale);
  auto& f = it->second;
  f.published = true; published = f; publication = id; surfaceCommit = commit;
  pendingPublication = 0;
  if (f.released) frames.erase(it);
}
bool View::wake() const {
  if (closed) return false;
  if (!input.empty()) return true;
  for (const auto& entry : commands) {
    const auto& c = entry.second;
    if (time >= c.deadline || (visible && active && active->document->epoch >= c.after &&
        active->document->contains(c.node))) return true;
  }
  if (!visible || metrics.width == 0 || metrics.height == 0) return false;
  if (demand || preparing || (dirty && frames.size() < wire::limits::frames)) return true;
  for (const auto& entry : overlays) if (entry.second.ballistic ||
      (entry.second.motion && entry.second.motionElapsed < entry.second.motionSeconds)) return true;
  return false;
}
bool View::renderWake() const {
  if (closed || !visible || metrics.width == 0 || metrics.height == 0) return false;
  if (!input.empty() || (preparing && preparing->ready && preparing->providerReady)) return true;
  if (dirty && active && active->metrics.epoch == metrics.epoch && frames.size() < wire::limits::frames) return true;
  for (const auto& entry : overlays) if (entry.second.ballistic ||
    (entry.second.motion && !entry.second.motionDone)) return true;
  for (const auto& entry : commands) if (time >= entry.second.deadline || entry.second.started) return true;
  return false;
}
}
