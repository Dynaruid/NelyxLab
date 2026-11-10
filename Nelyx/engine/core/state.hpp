// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "scene/document.hpp"
#include "input/physics.hpp"
#include "input/curve.hpp"
#include "layout/layout.hpp"
#include "layout/query.hpp"
#include "interaction/editing.hpp"
#include "protocol/observation_state.hpp"
#include <deque>
#include <map>
#include <optional>

namespace nelyx::v2 {
struct Metrics {
  uint64_t epoch = 1, device = 1;
  double width = 0, height = 0, scale = 1;
};
struct ResourceUpload {
  Lease lease;
  uint64_t token;
  Handle resource;
  std::shared_ptr<ResourceStorage> storage;
  size_t filled=0;
  ResourceUpload(const std::shared_ptr<Ledger>& ledger,uint64_t id,Handle handle,size_t size)
    :lease(ledger,sizeof(ResourceUpload)),token(id),resource(handle),storage(std::make_shared<ResourceStorage>(ledger,size)){}
};
struct Scene {
  std::shared_ptr<const Document> document;
  Metrics metrics;
  uint64_t epoch = 0, preparation = 0;
  std::shared_ptr<const LayoutOutput> layout;
  uint64_t fontRevision=1;
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
struct GestureDetails {
  uint32_t kind=0,stream=0;
  double timestamp=0,localX=0,localY=0,deltaX=0,deltaY=0,velocityX=0,velocityY=0;
  double originX=0,originY=0,localOriginX=0,localOriginY=0;
  uint32_t buttons=0,flags=0;
};
struct Event {
  uint32_t kind, status;
  uint64_t id = 0, epoch = 0, detail = 0;
  Handle node{};
  double x=0,y=0;
  GestureDetails gesture{};
  Handle focusPeer{};
  Handle semanticSource{};
  struct PointerDetails {
    std::array<uint8_t,wire::inputBytes> input{};
    Affine inverse;
  } pointer{};
  struct TapRegionDetails {
    uint64_t batch=0;
    Handle surface,semanticTarget;
    Affine inverse;
    uint32_t device=0;
  } tapRegion{};
  uint64_t clipboardReadSnapshot=0;
  struct KeyIdentity {
    std::array<uint8_t,wire::keyIdentityTextBytes> key{},code{};
    uint32_t keyLength=0,codeLength=0,location=0;
  } keyIdentity{};
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
struct Frame;
struct Input {
  uint64_t sequence, metrics;
  Handle target;
  uint32_t stream, phase, source, flags;
  double time, sample, x, y, dx, dy, velocity;
  uint32_t clock, buttons, modifiers, device, contact, kind;
  uint64_t publication = 0;
  std::shared_ptr<const Frame> snapshot;
  bool appApproved = false;
};
struct PointerHit {Handle node;std::optional<Affine> inverse;};
struct PointerPathEntry {
  Handle node;
  Affine inverse;
  // A translucent entry can join a path without stopping sibling hit tests.
  bool hit = false;
};
struct PointerPath {
  Lease lease;
  std::vector<PointerPathEntry> entries;
  bool hit = false;
  PointerPath(const std::shared_ptr<Ledger>& ledger,size_t capacity)
    :lease(ledger,sizeof(PointerPath)+capacity*sizeof(PointerPathEntry)){entries.reserve(capacity);}
};
struct TapRegionRegistration {Handle node,surface;uint64_t revision=0;};
struct TapRegionCapture {
  std::shared_ptr<const Frame> frame;
  std::unique_ptr<PointerPath> path;
  std::array<std::shared_ptr<const Frame>,wire::limits::publicationSnapshots> publications{};
  uint32_t cursor=0,source=0;
};
struct TapRegionClassification {
  Lease lease;
  std::vector<Handle> inside,outside;
  explicit TapRegionClassification(const std::shared_ptr<Ledger>& ledger)
    :lease(ledger,sizeof(TapRegionClassification)+2*wire::limits::nodes*sizeof(Handle)){
    inside.reserve(wire::limits::nodes);outside.reserve(wire::limits::nodes);
  }
};
struct Stream {
  std::array<std::shared_ptr<const Frame>,wire::limits::publicationSnapshots> capturedPublications{};
  uint64_t captureCursor=0;
  bool active = false, denied = false;
  Handle target;
  uint32_t source = 0, kind = 0, buttons = 0;
  Handle scroll;
  double x=0,y=0,startX=0,startY=0,at=0,pinchDistance=0;
  bool pointer=false,pan=false,pinched=false,longSent=false,secondThumb=false;
  bool tapDownSent=false,tapCanceled=false,tapRejected=false,longCanceled=false,dragCanceled=false;
  uint32_t dragAxis=0;
  Affine pointerInverse;
  bool pointerInverseValid=false;
  double sampleAt=0,deltaX=0,deltaY=0,velocityX=0,velocityY=0,distanceX=0,distanceY=0,distancePan=0;
  struct MotionSample { double at=0,x=0,y=0; };
  std::array<MotionSample,20> motionSamples{};
  uint32_t motionCount=0;
  bool appAccepted=false;
  uint64_t decision=0;
  double decisionDeadline=0;
  std::optional<Input> appPending;
};
struct Overlay {
  Handle node;
  double offset = 0, velocity = 0, start = 0, startVelocity = 0, elapsed = 0;
  uint64_t revision = 0;
  bool ballistic = false;
  bool pageSpring = false;
  double pageTarget = 0;
  void beginBallistic(double speed){
    ballistic=true;velocity=startVelocity=speed;
    // Accepted contact deltas still belong to this gesture even when Content
    // has not caught up. Resume from their destination, not the coverage edge.
    start=deferred?requested:offset;elapsed=0;
  }
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
  bool pressed=false,hovered=false,visible=false,focusVisible=false;
};
struct ClipShape {Affine world;Rect bounds;double radius=0;std::shared_ptr<const GraphicsPath> path;uint32_t parent=0;bool oval=false;std::optional<std::array<double,8>> radii;};
struct HitRegionShape {Affine world;Rect bounds;uint32_t parent=0;};
struct DrawItem {
  Handle node;
  double x = 0, y = 0, opacity = 1;
  Rect clip;
  Affine world;
  Rect bounds;
  uint32_t clipHead=0,depth=0;
  uint32_t flags=0;
  uint32_t hitHead=0;
  std::optional<Affine> layerTransform{};
  Point linkedOffset{};
  std::shared_ptr<const NativePaint> paint{};
};
struct SemanticCustomSources {
  using Entry=std::pair<uint32_t,Handle>;
  Lease lease;
  std::vector<Entry,LedgerAllocator<Entry>> values;
  explicit SemanticCustomSources(const std::shared_ptr<Ledger>& ledger)
    :lease(ledger,sizeof(SemanticCustomSources)),values(LedgerAllocator<Entry>{ledger}){}
};
struct FrameSemantics {
  std::shared_ptr<const SemanticData> data;
  std::array<Handle,8> actionSources{};
  std::shared_ptr<const SemanticCustomSources> customSources;
  Handle parent;
  uint32_t traversal=UINT32_MAX;
  Handle mergedInto;
  bool blocked=false,merged=false;
};
struct SemanticRoute {
  uint64_t sequence=0;
  Handle scope,name;
  std::shared_ptr<const SemanticData> label;
};
struct Frame {
  std::shared_ptr<Lease> snapshotLease;
  SemanticRoute route;
  Handle modalRoot;
  Handle focusNode;
  uint64_t focusSession=0;
  bool caretVisible = false;
  uint64_t id = 0, device = 0, propertyEpoch = 0;
  uint64_t paintWork=0,paintNodes=0,placementNodes=0;
  uint64_t observationBase=0;
  std::vector<uint32_t> observationRows;
  std::vector<uint32_t> itemBySlot;
  std::vector<Handle> observationRemoved;
  bool observationOrderChanged=false;
  std::shared_ptr<const Scene> scene;
  std::vector<Property> properties;
  std::vector<DrawItem> items;
  std::vector<ClipShape> clips;
  std::vector<HitRegionShape> hitRegions;
  std::vector<FrameSemantics> semantics;
  void resolveRoute(const Frame* previous,uint64_t sequence,const std::shared_ptr<Ledger>& ledger);
  bool sameInputGeometry(const Frame& other, Handle node) const;
  bool sharesInputGeometry(const Frame& other) const;
  std::optional<Point> local(Handle node,double x,double y)const {
    for(const auto& item:items)if(item.node==node){const auto inverse=item.world.inverse();
      if(inverse)return inverse->map({x,y});return {};}
    return {};
  }
  Point delta(Handle node,double dx,double dy)const {
    for(const auto& item:items)if(item.node==node){const auto inverse=item.world.inverse();
      if(inverse){const auto p=inverse->map({dx,dy}),zero=inverse->map({0,0});return {p.x-zero.x,p.y-zero.y};}}
    return {};
  }
  bool hit(const DrawItem& item,double x,double y,const DrawItem* boundary=nullptr)const {
    const auto inverse=item.world.inverse();if(!inverse||(!boundary&&!inside({x,y},item.clip)))return false;
    const auto& node=scene->document->get(item.node);const auto p=inverse->map({x,y});
    if(!inside(p,{0,0,node.properties.width,node.properties.height}))return false;
    if((node.policy&wire::eventPolicies::roundedHitTest)&&!inside(p,{0,0,node.properties.width,node.properties.height},node.radius))return false;
    if(node.kind==wire::kinds::path&&(!node.graphics.path||!node.graphics.path->contains(p)))return false;
    for(auto head=item.hitHead;head&&(!boundary||head!=boundary->hitHead);head=hitRegions[head-1].parent){const auto& region=hitRegions[head-1];
      const auto matrix=region.world.inverse();if(!matrix)return false;const auto point=matrix->map({x,y});
      if(!inside(point,region.bounds)||point.x<=region.bounds.x||point.x>=region.bounds.x+region.bounds.width)return false;}
    for(auto head=item.clipHead;head&&(!boundary||head!=boundary->clipHead);head=clips[head-1].parent){const auto& shape=clips[head-1];
      const auto matrix=shape.world.inverse();if(!matrix)return false;const auto point=matrix->map({x,y});
      if(!inside(point,shape.bounds))return false;
      if(shape.radii){if(!roundedContains(point,shape.bounds,*shape.radii))return false;}
      else if(shape.oval){const double deltaX=(point.x-shape.bounds.x)/shape.bounds.width-0.5,deltaY=(point.y-shape.bounds.y)/shape.bounds.height-0.5;
        if(deltaX*deltaX+deltaY*deltaY>0.25)return false;}
      else if(shape.path?!shape.path->contains(point):!inside(point,shape.bounds,shape.radius))return false;}
    return true;
  }
  // Child-first retained hit entries, including translucent siblings. Each
  // inverse maps the original collected global point into that entry's space.
  std::unique_ptr<PointerPath> pointerPath(double x,double y,Handle within={},bool localRoot=false) const;
  bool released = false, published = false, canceled = false, gpuObserved = false;
  bool allows(Handle node) const {
    return scene->document->contains(node)&&node.slot<properties.size()&&properties[node.slot].visible&&
      (!modalRoot||scene->document->descends(node,modalRoot));
  }
  bool allowsFocus(Handle node) const {
    return scene->document->contains(node)&&node.slot<properties.size()&&properties[node.slot].focusVisible&&
      (!modalRoot||scene->document->descends(node,modalRoot));
  }
  const SemanticData* semantic(Handle node) const {
    if(!scene->document->contains(node))return nullptr;
    return semantics.empty()?scene->document->get(node).semantics.get():semantics[node.slot].data.get();
  }
  bool allowsSemantics(Handle node) const {
    return allows(node)&&(semantics.empty()||(!semantics[node.slot].blocked&&!semantics[node.slot].merged));
  }
  Handle semanticSource(Handle node,uint32_t action,uint32_t customId=0) const {
    if(semantics.empty())return node;
    if(action==wire::semanticsActions::custom){
      const auto& sources=semantics[node.slot].customSources;
      if(sources)for(const auto& entry:sources->values)if(entry.first==customId)return entry.second;
      return {};
    }
    for(uint32_t i=0;i<8;++i)if(action==(1u<<i))return semantics[node.slot].actionSources[i];
    return {};
  }
  Handle focusPeer(Handle node) const {
    const auto peer=canonicalFocusPeer(*scene->document,node);
    if(!peer)return {};
    if(semantics.empty()){
      const auto* data=semantic(peer);return data&&(data->flags&wire::semanticsFlags::scopesRoute)?Handle{}:peer;
    }
    const auto& value=semantics[peer.slot];
    const auto result=value.blocked?Handle{}:value.mergedInto?value.mergedInto:peer;
    const auto* data=result?semantic(result):nullptr;
    return data&&(data->flags&wire::semanticsFlags::scopesRoute)?Handle{}:result;
  }
};
// Render calls this shared state machine only when a child is actually painted.
// It stores no pixels; each provider owns bounded images indexed by these tokens.
class SnapshotRegistry {
  struct Entry {
    Handle node;uint64_t revision=0,token=0;
    double ratio=1,width=0,height=0;
    uint32_t pixelWidth=0,pixelHeight=0;
    bool captured=false,disabled=false;
  };
  std::array<Entry,64> entries_{};
  uint64_t sequence_=0,device_=0;
  void liveTokens(SnapshotDecision&)const;
 public:
  void clear(){entries_={};device_=0;}
  SnapshotDecision beginFrame(const Frame&);
  SnapshotDecision paint(const Frame&,Handle,bool rasterizable=true);
  void complete(Handle,uint64_t,bool success);
};
struct InteractionSnapshot {
  std::shared_ptr<Lease> snapshotLease;
  Frame frame;
  std::shared_ptr<const Document> document;
  std::map<uint64_t,std::shared_ptr<const EditingValue>> editors;
  Handle focus;uint64_t session=0;Metrics metrics;bool visible=false;
};
struct ScrollCommand {
  uint64_t id, after, revision;
  Handle node;
  double target, duration, deadline, elapsed = 0, start = 0;
  bool interrupt, rebase, started = false;
  Handle list;
  uint64_t listGeneration = 0;
  uint32_t index = 0;
  double alignment = 0;
  bool listOffset = false;
  ScrollCurve curve;
};
struct EventOverflowInfo {
  std::shared_ptr<Lease> lease;
  uint32_t queue=0,kind=0,status=0,queued=0,pointerPhase=0,pointerFlags=0;
  std::array<uint32_t,wire::events::pointer+1> kinds{};
};
struct PreparationFailureInfo {
  std::shared_ptr<Lease> lease;
  uint64_t preparation=0,document=0;
  uint32_t status=0;bool ready=false;
  Handle node;
  double offset=0,requested=0,minimum=0,maximum=0,preparedOffset=0;
};
struct RawSample { Handle node; std::array<uint8_t,8+wire::inputBytes> bytes{}; };
RawSample rawSample(const Input&,Handle,uint64_t generation);
struct CommandResult {
  uint64_t id;
  std::vector<uint8_t> bytes;
  uint32_t status = wire::statuses::pending;
};
struct FontTransition {
  uint64_t token=0,revision=0,lastInput=0;
  Handle target;
  std::shared_ptr<const Resource> resource;
  uint32_t phase=0,ready=0,failedOwner=0,failedStatus=0;
};
struct View {
  Lease lease;
  std::array<ObservationState,2> observations;
  uint64_t observationSequence=0,observationBlobSequence=0;
  // Current overlay metadata can change before a frame is published. Only
  // this viewport and its list consumers depend on requested/velocity values.
  void observeOverlay(Handle node){
    observations[0].mark(node);
    if(active&&active->document->contains(node))for(const auto child:active->document->children[node.slot])
      if(active->document->get(child).listGeometry)for(auto& state:observations)state.mark(child);
  }
  SnapshotRegistry snapshots;
  uint32_t generation;
  bool closed = false, visible = true, focused = true, overflowed = false, dirty = false;
  EventOverflowInfo eventOverflow;
  PreparationFailureInfo preparationFailure;
  Metrics metrics;
  std::shared_ptr<const Document> document, demand;
  std::unique_ptr<Preparation> preparing;
  std::shared_ptr<const LayoutOutput> pendingLayoutCache;
  std::unique_ptr<LayoutQuery> query;
  uint64_t lastQuery=0;
  std::map<uint64_t,std::shared_ptr<EditingDocument>> editors;
  std::deque<Event> interactionEvents;
  std::deque<RawSample> rawInputs;
  uint64_t rawGeneration=0,rawGapFirst=0,rawGapLast=0;
  bool rawActive=false;
  Handle focusNode;
  bool revealPending=false;
  uint64_t focusSession=0,nextFocus=0,editClock=0,editingWork=0,semanticsWork=0,queryWork=0;
  uint64_t gestureWork=0,controlWork=0,keyWork=0,focusWork=0;
  Handle caretNode;
  uint64_t caretRevision = 0;
  Handle hoverNode,lastTap;
  std::array<Handle,wire::limits::nodes> mouseRegions{};
  std::array<Affine,wire::limits::nodes> mouseTransforms{};
  uint32_t mouseRegionCount=0;
  Input mouseSample{};
  bool mouseKnown=false;
  struct ListenerCapture {
    std::shared_ptr<const Frame> frame;
    std::unique_ptr<PointerPath> path;
    Input sample{};
  };
  std::array<ListenerCapture,wire::limits::streams+1> pointerListeners{};
  bool appFrameRequested=false;
  double appFrameDeadline=0;
  uint64_t appFrameSerial=0;
  double lastTapTime=-1,lastTapX=0,lastTapY=0;
  uint32_t lastTapButtons=0;
  GestureDetails lastTapDetails;
  double lastTapDownAt=0;
  bool lastTapDownSent=false;
  double caretDeadline = 0;
  bool caretVisible = false;
  std::shared_ptr<const Scene> active;
  std::shared_ptr<const Frame> published;
  std::array<std::shared_ptr<const Frame>, wire::limits::publicationSnapshots> publications{};
  uint32_t publicationCursor=0;
  uint64_t nextPreparation = 0, nextScene = 0, propertyEpoch = 0;
  uint64_t nextSubmission = 0, pendingPublication = 0, publication = 0, surfaceCommit = 0;
  uint64_t routeSequence=0;
  uint64_t lastTransaction = 0, acknowledged = 0, resultBytes = 0;
  std::deque<std::shared_ptr<Result>> results;
  std::deque<Event> events;
  std::deque<Input> input;
  std::array<Stream, wire::limits::streams + 1> streams{};
  std::array<TapRegionRegistration,wire::limits::nodes> tapRegions{};
  uint32_t tapRegionCount=0;
  uint64_t tapRegionBatch=0;
  std::array<TapRegionCapture,wire::limits::streams+1> tapRegionCaptures{};
  std::map<uint64_t, Overlay> overlays;
  std::map<uint64_t, Frame> frames;
  std::map<uint64_t, ScrollCommand> commands;
  std::deque<CommandResult> commandResults;
  uint64_t lastCommand = 0;
  uint64_t failedDocument = 0;
  uint64_t transactionWork = 0, contentWork = 0;
  uint64_t fontRevision = 1, layoutWork = 0, layoutReused = 0;
  uint64_t imagePaintWork=0;
  std::shared_ptr<const Resource> fontResource;
  std::unique_ptr<ResourceUpload> fontUpload;
  std::unique_ptr<ResourceUpload> imageUpload;
  uint64_t lastImageUpload=0;
  Handle lastImageResource;
  uint32_t imageUploadStatus=0,imageUploadBytes=0;
  uint64_t lastFontUpload=0;
  Handle lastFontResource;
  uint32_t fontUploadStatus=0,fontUploadBytes=0;
  FontTransition fontTransition;
  uint64_t coverageRequests = 0, coverageDeferred = 0, coverageClamps = 0, coverageHandoffs = 0;
  bool transactionActive = false, providerRequired = false;
  uint64_t received = 0, consumed = 0, canceled = 0, rejected = 0, duplicates = 0;
  uint64_t lastInput = 0, consumedThrough = 0, ticks = 0, submitted = 0, activated = 0;
  uint32_t updates = 0;
  double time = 0;
  bool hasTime = false;
  explicit View(uint32_t generation, const std::shared_ptr<Ledger>& ledger)
      : lease(ledger, sizeof(View) + wire::limits::nodes * (sizeof(Overlay) + 64 +
          (wire::limits::frames + 1) * (sizeof(Property) + sizeof(DrawItem)+sizeof(ClipShape)+sizeof(FrameSemantics)+2*sizeof(uint32_t)+sizeof(Handle))) +
          wire::limits::inputPackets * sizeof(Input) + wire::limits::events * sizeof(Event)+
          wire::limits::observerPackets*sizeof(RawSample)+
          wire::limits::scrollCommands*(sizeof(ScrollCommand)+64)+
          wire::limits::results*(sizeof(CommandResult)+64+56+wire::scrollCurveHeaderBytes+
            wire::limits::scrollCurveNodes*wire::scrollCurveNodeBytes)),
        observations{ObservationState(ledger),ObservationState(ledger)},
        generation(generation), document(std::make_shared<Document>(ledger)) { ++lease.ledger->activeViews; }
  ~View() {
    if (!closed) {
      lease.ledger->queuedInputs -= uint32_t(input.size());
      lease.ledger->updateInputs -= updates;
      --lease.ledger->activeViews;
    }
  }
  void event(Event e);
  void recordEventOverflow(const Event& event,bool interactionQueue);
  void close(uint32_t reason);
  bool endDeferredInput(uint32_t stream,bool cancelPending);
  void beginScrollBallistic(Handle node,double velocity);
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
  void setFocus(Handle,uint64_t publication,uint64_t expectedSession,bool exactSession=false);
  void applyEdit(Reader);
  void semanticAction(Reader);
  void pointer(Input);
  void dispatchPointerListeners(const Input&);
  void cancelPointerListeners(uint32_t stream);
  void installTapRegions(const Document&,const LayoutOutput*);
  bool registeredTapRegion(const Document&,const TapRegionRegistration&)const;
  std::unique_ptr<TapRegionClassification> classifyTapRegions(Handle,const PointerPath&)const;
  bool dispatchTapRegions(const Input&,const TapRegionCapture&,bool up=false);
  uint64_t dispatchSemanticTapRegions(Handle,uint64_t publication,uint32_t action);
  void advanceGestures();
  void key(Reader);
  void activateControl(Handle);
  void controlValue(Handle,double,bool second=false);
  void gesture(Handle,uint32_t,uint64_t,double,double,double=0,uint32_t=0,const GestureDetails* =nullptr);
  GestureDetails gestureDetails(Handle,uint32_t,double,double)const;
  void canonicalPointer(const Input&,Stream&,bool deferArena=false);
  void canonicalCloseArena(const Input&,Stream&);
  void canonicalCancel(Stream&,uint64_t);
  void advanceCanonicalGestures();
  void updateMouse(const Input& sample,bool hover=true);
  void refreshMouse();
  void finishCanonicalTap(bool);
  void observeRaw(const Input&,Handle);
  bool appDecision(Input&);
  void gestureReply(Reader);
  Handle pointerTarget(double,double,const Frame* snapshot=nullptr) const;
  PointerHit pointerHit(double,double,const Frame*,Handle within={},uint32_t depth=0,uint32_t kind=63) const;
  Handle interactionTarget(double,double) const;
  void failPreparation(uint64_t id, uint32_t reason);
  uint32_t enqueue(Input packet);
  void processInput(Input packet);
  void tick(double now);
  void advanceCaret();
  void revealFocus();
  double nextDeadline() const;
  void activate();
  uint32_t scroll(Reader data, uint64_t id);
  uint32_t listSeek(Reader data, uint64_t id);
  void finishCommand(uint64_t id, uint32_t status);
  void applyDelta(Handle node, double delta, uint32_t stream = 0,const Frame* snapshot=nullptr);
  void needContent(const Node&, Overlay&, uint32_t stream);
  void advanceDeferred(double dt);
  uint32_t takeFrame();
  void releaseFrame(uint64_t id, uint64_t device, bool gpuObserved, bool failed);
  void publish(uint64_t id, uint64_t device, uint64_t surfaceCommit);
  bool wake() const;
  bool renderWake() const;
  Handle target(double x, double y,const Frame* snapshot=nullptr) const;
  void makeDrawItems(Frame& frame) const;
};
}
