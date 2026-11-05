// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "scene/document.hpp"
#include "input/physics.hpp"
#include "layout/layout.hpp"
#include "layout/query.hpp"
#include "interaction/editing.hpp"
#include <deque>
#include <map>
#include <optional>

namespace nelyx::v2 {
struct Metrics {
  uint64_t epoch = 1, device = 1;
  double width = 0, height = 0, scale = 1;
};
struct Scene {
  std::shared_ptr<const Document> document;
  Metrics metrics;
  uint64_t epoch = 0, preparation = 0;
  std::shared_ptr<const LayoutOutput> layout;
};
struct Preparation {
  std::shared_ptr<const Document> document;
  Metrics metrics;
  uint64_t id = 0;
  uint32_t cursor = 1;
  bool ready = false;
  bool providerReady = true;
  bool managedLayout = false;
  uint64_t fontRevision = 1;
  std::shared_ptr<LayoutWork> layout;
};
struct LayoutQuery {
  Lease lease;
  uint64_t id=0,preparation=0,font=0;
  uint32_t mode=0,status=wire::statuses::pending;
  Metrics metrics;
  Handle node;
  std::shared_ptr<const Document> document;
  std::unique_ptr<LayoutQueryWork> work;
  QueryValue value;
  std::vector<uint8_t> bytes;
  explicit LayoutQuery(const std::shared_ptr<Ledger>& ledger):lease(ledger,sizeof(LayoutQuery)+64){}
};
struct Event {
  uint32_t kind, status;
  uint64_t id = 0, epoch = 0, detail = 0;
  Handle node{};
  double x=0,y=0;
};
struct Result {
  Lease lease;
  uint64_t id, epoch;
  uint32_t status = wire::statuses::pending;
  std::vector<uint8_t> payload;
  Result(const std::shared_ptr<Ledger>& ledger, uint64_t value, Reader bytes)
      : lease(ledger, sizeof(Result) + bytes.length), id(value), epoch(0),
        payload(bytes.data, bytes.data + bytes.length) {}
};
struct Input {
  uint64_t sequence, metrics;
  Handle target;
  uint32_t stream, phase, source, flags;
  double time, sample, x, y, dx, dy, velocity;
  uint32_t clock, buttons, modifiers, device, contact;
};
struct Stream {
  bool active = false, denied = false;
  Handle target;
  uint32_t source = 0;
  Handle scroll;
  double x=0,y=0,startX=0,startY=0,at=0,pinchDistance=0;
  bool pointer=false,pan=false,pinched=false,longSent=false,secondThumb=false;
};
struct Overlay {
  Handle node;
  double offset = 0, velocity = 0, start = 0, startVelocity = 0, elapsed = 0;
  uint64_t revision = 0;
  bool ballistic = false;
  uint64_t motion = 0, lastMotion = 0;
  double opacity = 1, motionStart = 1, motionTarget = 1, motionSeconds = 0, motionElapsed = 0;
  uint64_t motionRevision = 0;
  bool motionDone = false;
  double requested = 0;
  bool deferred = false, needSent = false;
  uint32_t deferredStream = 0;
  uint64_t coverageRevision = 0;
  double value=0,second=1;
  bool pressed=false,hovered=false;
};
struct Property {
  Handle node;
  double offset = 0, velocity = 0, opacity = 1;
  uint64_t revision = 0, motion = 0;
  double requested = 0;
  bool deferred = false;
  double value=0,second=1;
  bool pressed=false,hovered=false,visible=false;
};
struct Rect { double x = 0, y = 0, width = 0, height = 0; };
struct DrawItem {
  Handle node;
  double x = 0, y = 0, opacity = 1;
  Rect clip;
};
struct Frame {
  Handle modalRoot;
  Handle focusNode;
  uint64_t focusSession=0;
  bool caretVisible = false;
  uint64_t id = 0, device = 0, propertyEpoch = 0;
  std::shared_ptr<const Scene> scene;
  std::vector<Property> properties;
  std::vector<DrawItem> items;
  bool released = false, published = false, canceled = false, gpuObserved = false;
  bool allows(Handle node) const {
    return scene->document->contains(node)&&node.slot<properties.size()&&properties[node.slot].visible&&
      (!modalRoot||scene->document->descends(node,modalRoot));
  }
};
struct InteractionSnapshot {
  Frame frame;
  std::shared_ptr<const Document> document;
  std::map<uint64_t,std::shared_ptr<const EditingValue>> editors;
  Handle focus;uint64_t session=0;Metrics metrics;
};
struct ScrollCommand {
  uint64_t id, after, revision;
  Handle node;
  double target, duration, deadline, elapsed = 0, start = 0;
  bool interrupt, rebase, started = false;
};
struct CommandResult {
  uint64_t id;
  std::vector<uint8_t> bytes;
  uint32_t status = wire::statuses::pending;
};
struct View {
  Lease lease;
  uint32_t generation;
  bool closed = false, visible = true, focused = true, overflowed = false, dirty = false;
  Metrics metrics;
  std::shared_ptr<const Document> document, demand;
  std::unique_ptr<Preparation> preparing;
  std::unique_ptr<LayoutQuery> query;
  uint64_t lastQuery=0;
  std::map<uint64_t,std::shared_ptr<EditingDocument>> editors;
  std::deque<Event> interactionEvents;
  Handle focusNode;
  uint64_t focusSession=0,nextFocus=0,editClock=0,editingWork=0,semanticsWork=0,queryWork=0;
  uint64_t gestureWork=0,controlWork=0;
  Handle caretNode;
  uint64_t caretRevision = 0;
  Handle hoverNode,lastTap;
  double lastTapTime=-1,lastTapX=0,lastTapY=0;
  double caretDeadline = 0;
  bool caretVisible = false;
  std::shared_ptr<const Scene> active;
  std::optional<Frame> published;
  uint64_t nextPreparation = 0, nextScene = 0, propertyEpoch = 0;
  uint64_t nextSubmission = 0, pendingPublication = 0, publication = 0, surfaceCommit = 0;
  uint64_t lastTransaction = 0, acknowledged = 0, resultBytes = 0;
  std::deque<std::shared_ptr<Result>> results;
  std::deque<Event> events;
  std::deque<Input> input;
  std::array<Stream, wire::limits::streams + 1> streams{};
  std::map<uint64_t, Overlay> overlays;
  std::map<uint64_t, Frame> frames;
  std::map<uint64_t, ScrollCommand> commands;
  std::deque<CommandResult> commandResults;
  uint64_t lastCommand = 0;
  uint64_t failedDocument = 0;
  uint64_t transactionWork = 0, contentWork = 0;
  uint64_t fontRevision = 1, layoutWork = 0, layoutReused = 0;
  uint64_t coverageRequests = 0, coverageDeferred = 0, coverageClamps = 0, coverageHandoffs = 0;
  bool transactionActive = false, providerRequired = false;
  uint64_t received = 0, consumed = 0, canceled = 0, rejected = 0, duplicates = 0;
  uint64_t lastInput = 0, consumedThrough = 0, ticks = 0, submitted = 0, activated = 0;
  uint32_t updates = 0;
  double time = 0;
  bool hasTime = false;
  explicit View(uint32_t generation, const std::shared_ptr<Ledger>& ledger)
      : lease(ledger, sizeof(View) + wire::limits::nodes * (sizeof(Overlay) + 64 +
          (wire::limits::frames + 1) * (sizeof(Property) + sizeof(DrawItem))) +
          wire::limits::inputPackets * sizeof(Input) + wire::limits::events * sizeof(Event)),
        generation(generation), document(std::make_shared<Document>(ledger)) { ++lease.ledger->activeViews; }
  ~View() {
    if (!closed) {
      lease.ledger->queuedInputs -= uint32_t(input.size());
      lease.ledger->updateInputs -= updates;
      --lease.ledger->activeViews;
    }
  }
  void event(Event e);
  void close(uint32_t reason);
  void cancelStream(uint32_t stream, uint32_t reason);
  void cancelInput(uint32_t reason);
  void requestContent();
  void contentStep(uint32_t quota);
  uint32_t startQuery(Reader,uint64_t);
  void queryStep(uint32_t);
  void cancelQuery(uint32_t);
  std::optional<MeasurementRequest> measurement() const;
  uint64_t measurePreparation() const;
  void installEditors(const std::shared_ptr<const Document>&);
  std::shared_ptr<const Document> editingDocument() const;
  void interaction(Event);
  void setFocus(Handle,uint64_t publication,uint64_t expectedSession);
  void applyEdit(Reader);
  void semanticAction(Reader);
  void pointer(Input);
  void advanceGestures();
  void key(Reader);
  void activateControl(Handle);
  void controlValue(Handle,double,bool second=false);
  void gesture(Handle,uint32_t,uint64_t,double,double,double=0);
  Handle pointerTarget(double,double) const;
  Handle interactionTarget(double,double) const;
  void failPreparation(uint64_t id, uint32_t reason);
  void enqueue(Input packet);
  void tick(double now);
  void advanceCaret();
  double nextDeadline() const;
  void activate();
  uint32_t scroll(Reader data, uint64_t id);
  void finishCommand(uint64_t id, uint32_t status);
  void applyDelta(Handle node, double delta, uint32_t stream = 0);
  void needContent(const Node&, Overlay&, uint32_t stream);
  void advanceDeferred(double dt);
  uint32_t takeFrame();
  void releaseFrame(uint64_t id, uint64_t device, bool gpuObserved, bool failed);
  void publish(uint64_t id, uint64_t device, uint64_t surfaceCommit);
  bool wake() const;
  bool renderWake() const;
  Handle target(double x, double y) const;
  void makeDrawItems(Frame& frame) const;
};
}
