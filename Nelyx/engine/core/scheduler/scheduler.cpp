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
  if(c.list&&overlay!=overlays.end()) { overlay->second.requested=overlay->second.offset;overlay->second.needSent=false; }
  event({wire::events::scrollTerminal, status, id, document ? document->epoch : 0,
    overlay == overlays.end() ? 0 : overlay->second.revision, c.node});
  interaction({wire::events::scrollTerminal,status,id,document?document->epoch:0,
    overlay==overlays.end()?0:overlay->second.revision,c.node});
  for (auto& result : commandResults) if (result.id == id) result.status = status;
  commands.erase(it);
}
void View::cancelStream(uint32_t stream, uint32_t reason) {
  auto& s = streams.at(stream);
  if(s.active&&s.pointer)canonicalCancel(s,lastInput);
  s.capturedPublications.fill(nullptr);
  s.appPending.reset();
  for (auto it = input.begin(); it != input.end();) {
    if (it->stream != stream) { ++it; continue; }
    if (it->phase == wire::phases::update) { --updates; --lease.ledger->updateInputs; }
    --lease.ledger->queuedInputs;
    ++canceled; it = input.erase(it);
  }
  if (s.active||s.decision) {event({wire::events::gestureCanceled, reason, lastInput, 0, stream, s.target});
    interaction({wire::events::gestureCanceled,reason,s.decision,0,stream,s.target});}
  auto overlay = overlays.find(s.target.key());
  if (overlay != overlays.end()) { overlay->second.ballistic = false; overlay->second.velocity = 0;
    if(overlay->second.pressed){overlay->second.pressed=false;dirty=true;} }
  if(s.active&&s.pointer)gesture(s.target,wire::gestureKinds::cancel,lastInput,s.x,s.y);
  if(s.pinched)for(auto& other:streams)if(&other!=&s&&other.active&&other.target==s.target){other.pinched=false;other.pan=true;}
  for (auto& entry : overlays) if (entry.second.deferredStream == stream) {
    entry.second.deferred = false; entry.second.requested = entry.second.offset; entry.second.deferredStream = 0;
  }
  s.active = false; s.pointer=false; s.denied = true;
  s.decision=0;s.appAccepted=false;s.decisionDeadline=0;
}
void View::cancelInput(uint32_t reason) {
  for(auto it=commands.begin();it!=commands.end();) {const auto current=it++;
    if(current->second.list)finishCommand(current->first,reason);}
  for (uint32_t i = 1; i <= wire::limits::streams; ++i) cancelStream(i, reason);
  for (auto& entry : overlays) { entry.second.ballistic = false; entry.second.velocity = 0; }
  hoverNode={};lastTap={};mouseRegionCount=0;mouseKnown=false;for(auto& entry:overlays)entry.second.hovered=false;
}
void View::close(uint32_t reason) {
  if (closed) return;
  cancelInput(reason);
  while (!commands.empty()) finishCommand(commands.begin()->first, reason);
  if (preparing) event({wire::events::preparationCanceled, reason,
    preparing->id, preparing->document->epoch});
  if (demand) event({wire::events::skipped, reason, 0, demand->epoch});
  closed = true;
  if(fontUpload){fontUpload.reset();fontUploadStatus=3;}
  if(imageUpload){imageUpload.reset();imageUploadStatus=3;}
  if(fontTransition.phase==wire::fontTransitionPhases::preparing){
    fontTransition.resource.reset();fontTransition.phase=wire::fontTransitionPhases::aborted;
  }
  --lease.ledger->activeViews;
  preparing.reset(); demand.reset(); document.reset(); active.reset(); published.reset();publications.fill(nullptr);fontResource.reset();
  query.reset();editors.clear();interactionEvents.clear();rawInputs.clear();rawActive=false;focusNode={};focusSession=0;
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
  for(auto it=commands.begin();it!=commands.end();){const auto current=it++;
    if(current->second.list&&current->second.after<=failedDocument)finishCommand(current->first,reason);}
  preparing.reset();
}
void View::contentStep(uint32_t quota) {
  if(query&&query->status==wire::statuses::pending){const uint32_t share=std::max(1u,quota/2);queryStep(share);quota-=share;}
  if(quota==0)return;
  if (closed || metrics.width == 0 || metrics.height == 0) return;
  if (!preparing && demand) {
    const auto id = next(nextPreparation);
    auto p = std::make_unique<Preparation>();
    p->id = id; p->document = demand; p->metrics = metrics;
    p->providerReady = !providerRequired;
    p->fontRevision = fontRevision;
    preparing = std::move(p); demand.reset(); nextPreparation = id;
    try{preparing->document=fontDocument(editingDocument(),fontResource,fontRevision);}
    catch(const Error& e){failPreparation(id,e.status);return;}
    catch(const std::bad_alloc&){failPreparation(id,wire::statuses::budgetExceeded);return;}
  }
  if (!preparing || preparing->ready) return;
  auto& p = *preparing;
  if (p.layout) {
    try {
      const auto before = p.layout->work();
      const auto reused = p.layout->reused();
      const bool complete = p.layout->step(quota);
      layoutWork += p.layout->work() - before; layoutReused += p.layout->reused() - reused;
      if (complete) { auto geometry=p.layout->document();validateGraphics(*geometry);imagePaintWork+=p.layout->imagePaintWork();p.document=std::move(geometry);p.ready = true; }
    } catch (const Error& error) { failPreparation(p.id, error.status); }
      catch (const std::bad_alloc&) { failPreparation(p.id, wire::statuses::budgetExceeded); }
    return;
  }
  // A finite number of slots is inspected per call, including empty slots.
  // No future JS/provider response is waited for synchronously.
  uint32_t work = 0;
  while (p.cursor <= p.document->highWater && work++ < quota) {
    ++contentWork;
    const auto& slot = p.document->nodes[p.cursor++];
    if (!slot.value) continue;
    const auto& n = *slot.value;
    p.managedLayout |= n.layout.enabled != 0;
    if (n.layout.enabled) continue;
    const auto valid = [](Axis a, double size, double viewport) {
      if (a.tag == wire::bounds::expand) return size == viewport;
      return size >= a.min && (a.tag != wire::bounds::finite || size <= a.max);
    };
    if (!valid(n.horizontal, n.properties.width, p.metrics.width) ||
        !valid(n.vertical, n.properties.height, p.metrics.height)) {
      failPreparation(p.id, wire::statuses::invalidValue); return;
    }
  }
  if (p.cursor > p.document->highWater) {
    if (p.managedLayout) {
      try { p.layout = std::make_shared<LayoutWork>(p.document, p.metrics.width,
        p.metrics.height, p.metrics.scale, p.fontRevision, active ? active->layout : nullptr); }
      catch (const Error& error) { failPreparation(p.id, error.status); }
      catch (const std::bad_alloc&) { failPreparation(p.id, wire::statuses::budgetExceeded); }
    }
    else {
      try {
        if(std::any_of(p.document->nodes.begin(),p.document->nodes.end(),[](const auto& slot){return slot.value&&slot.value->nativePaint;})){
          auto geometry=std::make_shared<Document>(*p.document);
          resolveNativePaint(*geometry);validateGraphics(*geometry);p.document=std::move(geometry);
        }
        p.ready = true;
      } catch(const Error& error){failPreparation(p.id,error.status);}
        catch(const std::bad_alloc&){failPreparation(p.id,wire::statuses::budgetExceeded);}
    }
  }
}
uint32_t View::startQuery(Reader bytes,uint64_t id) {
  require(bytes.length==64&&id>0&&bytes.u32(12)==0);
  if(query&&query->id==id){require(query->bytes.size()==bytes.length&&std::equal(query->bytes.begin(),query->bytes.end(),bytes.data),wire::statuses::idReused);return query->status;}
  require(id>lastQuery,wire::statuses::resultExpired);
  require(!query||query->status!=wire::statuses::pending,wire::statuses::busy);
  const Handle node=handle(bytes,0);document->get(node);
  const auto mode=bytes.u32(8);require(mode<=wire::layoutQueries::maxHeight,wire::statuses::invalidValue);
  const auto h=axis(bytes.slice(16,24)),v=axis(bytes.slice(40,24));
  require(h.tag!=wire::bounds::expand&&v.tag!=wire::bounds::expand,wire::statuses::invalidValue);
  auto candidate=std::make_unique<LayoutQuery>(lease.ledger);
  candidate->id=id;candidate->preparation=next(nextPreparation);candidate->node=node;candidate->mode=mode;
  candidate->metrics=metrics;candidate->font=fontRevision;candidate->document=fontDocument(editingDocument(),fontResource,fontRevision);
  candidate->bytes.assign(bytes.data,bytes.data+bytes.length);
  LayoutConstraints c{h.min,h.tag==wire::bounds::finite?h.max:INFINITY,v.min,v.tag==wire::bounds::finite?v.max:INFINITY};
  candidate->work=std::make_unique<LayoutQueryWork>(candidate->document,node,mode,c,metrics.scale,fontRevision);
  nextPreparation=candidate->preparation;lastQuery=id;query=std::move(candidate);return wire::statuses::pending;
}
void View::queryStep(uint32_t quota) {
  if(!query||query->status!=wire::statuses::pending)return;
  try {++queryWork;if(query->work->step(quota)){query->value=query->work->value();query->status=wire::statuses::ok;query->work.reset();}}
  catch(const Error& e){cancelQuery(e.status);}catch(const std::bad_alloc&){cancelQuery(wire::statuses::budgetExceeded);}
}
void View::cancelQuery(uint32_t status){if(query&&query->status==wire::statuses::pending){query->status=status;query->work.reset();}}
std::optional<MeasurementRequest> View::measurement()const {
  if(preparing&&preparing->layout&&preparing->layout->waiting())return preparing->layout->request();
  if(query&&query->work&&query->work->waiting())return query->work->request();return {};
}
uint64_t View::measurePreparation()const {
  if(preparing&&preparing->layout&&preparing->layout->waiting())return preparing->id;
  if(query&&query->work&&query->work->waiting())return query->preparation;return 0;
}
static double anchoredOffset(const View& view,const Document& nextDocument,const Node& viewport,double before) {
  if(!view.active||!view.active->document->contains(viewport.id))return before;
  const auto& old=*view.active->document;
  const auto& previousChildren=old.children[viewport.id.slot];
  const auto& children=nextDocument.children[viewport.id.slot];
  if(previousChildren.size()!=1||children.size()!=1)return before;
  const auto& previous=old.get(previousChildren.front());const auto& current=nextDocument.get(children.front());
  if(!previous.listGeometry||!current.listGeometry)return before;
  const bool horizontal=(viewport.properties.flags&1u)!=0;
  const double previousOrigin=horizontal?previous.properties.x:previous.properties.y;
  const double currentOrigin=horizontal?current.properties.x:current.properties.y;
  const double size=horizontal?viewport.properties.width:viewport.properties.height;
  const double at=before-previousOrigin;
  const ListRow* anchor=nullptr;const ListRow* replacement=nullptr;double nearest=1e12;bool anchoredVisible=false;
  for(const auto& row:previous.listGeometry->rows){
    const bool visible=row.offset+row.extent>at&&row.offset<at+size;
    const double distance=std::max({0.0,at-(row.offset+row.extent),row.offset-(at+size)});
    for(const auto& candidate:current.listGeometry->rows)if(candidate.key==row.key&&
        (!anchor||(visible&&!anchoredVisible)||(visible==anchoredVisible&&
          (distance<nearest||(distance==nearest&&row.offset<anchor->offset))))){
      anchor=&row;replacement=&candidate;nearest=distance;anchoredVisible=visible;
    }
  }
  if(anchor)return before+(replacement->offset+currentOrigin)-(anchor->offset+previousOrigin);
  if(previous.list.generation!=current.list.generation){
    if(!current.list.count)return 0;
    for(const auto& row:previous.listGeometry->rows)if(row.offset+row.extent>at){
      const auto index=std::min(row.index,current.list.count-1);
      const auto position=current.listGeometry->prefix(index);
      const auto extent=current.listGeometry->prefix(index+1)-position;
      return currentOrigin+position+std::clamp(at-row.offset,0.0,std::max(0.0,extent-1));
    }
  }
  return before;
}
static std::optional<double> seekOffset(const Document& document,const ScrollCommand& command) {
  if(!command.list||!document.contains(command.list)||!document.contains(command.node))return {};
  const auto& list=document.get(command.list);const auto& viewport=document.get(command.node);
  if(list.parent!=command.node||!list.listGeometry||list.list.generation!=command.listGeneration||
      command.index<list.list.begin||command.index>=list.list.end)return {};
  const auto row=std::find_if(list.listGeometry->rows.begin(),list.listGeometry->rows.end(),
    [&](const auto& r){return r.index==command.index;});
  if(row==list.listGeometry->rows.end())return {};
  const bool horizontal=(viewport.properties.flags&1u)!=0;
  const double origin=horizontal?list.properties.x:list.properties.y;
  const double size=horizontal?viewport.properties.width:viewport.properties.height;
  const double offset=std::clamp(origin+row->offset-(size-row->extent)*command.alignment,
    viewport.properties.minimum,viewport.properties.maximum);
  if(viewport.coverage.enabled&&(offset<viewport.coverage.minimum||offset>viewport.coverage.maximum))return {};
  return offset;
}
static double activationOffset(const View& view,const Document& document,const Node& viewport,double before) {
  for(const auto& [id,command]:view.commands)if(command.node==viewport.id&&command.list&&
      command.deadline>view.time){const auto offset=seekOffset(document,command);if(offset)return *offset;}
  return anchoredOffset(view,document,viewport,before);
}
void View::activate() {
  if (!preparing || !preparing->ready || !preparing->providerReady) return;
  const auto& p = *preparing;
  if (p.metrics.epoch != metrics.epoch || p.metrics.device != metrics.device ||
      (active && p.document->epoch < active->document->epoch)) {
    event({wire::events::preparationCanceled, wire::statuses::stale, p.id, p.document->epoch});
    preparing.reset(); return;
  }
  // Validate every retained offset before changing any compositor overlay.
  // A new partial window cannot activate over the user's current viewport.
  for (const auto& slot : p.document->nodes) if (slot.value && slot.value->coverage.enabled) {
    const auto& n = *slot.value; const auto old = overlays.find(n.id.key());
    const double previous = activationOffset(*this,*p.document,n,old == overlays.end() ? 0 : old->second.offset);
    const double offset = n.properties.extent == wire::extents::unbounded ? std::max(n.properties.minimum,previous) :
      std::clamp(previous,n.properties.minimum,n.properties.maximum);
    if (offset < n.coverage.minimum || offset > n.coverage.maximum) {
      failPreparation(p.id,wire::statuses::contentUnavailable); return;
    }
  }
  const auto epoch = next(nextScene);
  auto scene = std::make_shared<Scene>(Scene{p.document, p.metrics, epoch, p.id,
    p.layout ? p.layout->output() : nullptr});
  try{
    Lease scratch(lease.ledger,sizeof(Frame)+(p.document->highWater+1)*sizeof(Property)+p.document->count*(sizeof(DrawItem)+sizeof(ClipShape)+sizeof(HitRegionShape)));
    Frame check;check.scene=scene;check.properties.resize(p.document->highWater+1);
    for(const auto& slot:p.document->nodes)if(slot.value){const auto& n=*slot.value;auto& property=check.properties[n.id.slot];property.opacity=1;
      const auto old=overlays.find(n.id.key());property.offset=activationOffset(*this,*p.document,n,old==overlays.end()?0:old->second.offset);}
    makeDrawItems(check);
  }catch(const Error& error){failPreparation(p.id,error.status);return;}
    catch(const std::bad_alloc&){failPreparation(p.id,wire::statuses::budgetExceeded);return;}
  // Canonical Source controls may remove every recognizer while their retained
  // render node stays alive. Retire its capture only after the replacement has
  // passed preparation validation; paint-only documents keep the same stream.
  for(uint32_t index=1;index<streams.size();++index){
    const auto& stream=streams[index];
    if(!stream.active||!stream.pointer||!p.document->contains(stream.target)||
       !active||!active->document->contains(stream.target))continue;
    const auto& before=active->document->get(stream.target);
    const auto& after=p.document->get(stream.target);
    if((before.policy&wire::eventPolicies::canonicalGestures)&&before.gestures&&
       (!(after.policy&wire::eventPolicies::canonicalGestures)||!after.gestures))
      cancelStream(index,wire::statuses::canceled);
  }
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
    if(inserted||!active||!active->document->contains(n.id)||
       active->document->get(n.id).control.kind!=n.control.kind||
       active->document->get(n.id).control.revision!=n.control.revision||
       active->document->get(n.id).control.value!=n.control.value||
       active->document->get(n.id).control.second!=n.control.second){o.value=n.control.value;o.second=n.control.second;}
    if (n.kind == wire::kinds::scrollViewport) {
      if (o.coverageRevision != n.coverage.revision || (active&&active->document->contains(n.id)&&
          (active->document->get(n.id).coverage.minimum!=n.coverage.minimum||
           active->document->get(n.id).coverage.maximum!=n.coverage.maximum))) {
        o.coverageRevision = n.coverage.revision; o.needSent = false; }
      const auto anchored=activationOffset(*this,*p.document,n,o.offset);
      const auto offset = n.properties.extent == wire::extents::unbounded ?
        std::max(n.properties.minimum, anchored) :
        std::clamp(anchored, n.properties.minimum, n.properties.maximum);
      const double correction=offset-o.offset;
      if (offset != o.offset) { o.offset = offset; o.revision = next(o.revision); }
      for(auto& [id,command]:commands)if(command.list&&command.node==n.id){
        const auto target=seekOffset(*p.document,command);if(target){command.target=*target;command.started=true;}}
      if (o.deferred) {
        o.requested = n.properties.extent == wire::extents::unbounded ? std::max(n.properties.minimum,o.requested+correction) :
          std::clamp(o.requested+correction,n.properties.minimum,n.properties.maximum);
        o.deferred = o.requested != o.offset;
      } else o.requested = o.offset;
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
uint32_t View::enqueue(Input p) {
  if (p.sequence <= lastInput) { ++duplicates; return wire::statuses::ok; }
  lastInput = p.sequence; ++received;
  auto& stream = streams[p.stream];
  if(p.publication){for(const auto& snapshot:publications)if(snapshot&&snapshot->id==p.publication){p.snapshot=snapshot;break;}}
  else p.snapshot=published;
  if(!p.snapshot&&p.publication&&(p.flags&2u)&&!(p.flags&4u)&&p.phase!=wire::phases::begin&&
      stream.active&&stream.pointer&&stream.source==p.source){
    for(const auto& snapshot:stream.capturedPublications)if(snapshot&&snapshot->id==p.publication){p.snapshot=snapshot;break;}
  }
  bool geometryCurrent=true;
  if(p.snapshot&&published&&p.snapshot->scene!=published->scene){
    geometryCurrent=false;
    if(p.flags&2u){
      const Input* queuedBegin=nullptr;
      if(p.phase!=wire::phases::begin&&!(p.flags&4u))
        for(auto it=input.rbegin();it!=input.rend();++it)if(it->stream==p.stream&&(it->flags&2u)&&!(it->flags&4u)){
          if(it->phase==wire::phases::begin){queuedBegin=&*it;break;}
          if(it->phase==wire::phases::end||it->phase==wire::phases::cancel)break;
        }
      if(queuedBegin&&queuedBegin->source==p.source&&queuedBegin->snapshot){
        const auto target=pointerTarget(queuedBegin->x,queuedBegin->y,queuedBegin->snapshot.get());
        geometryCurrent=target&&target==pointerTarget(queuedBegin->x,queuedBegin->y,published.get())&&
          queuedBegin->snapshot->sameInputGeometry(*published,target)&&p.snapshot->sameInputGeometry(*published,target);
      }else if(p.phase==wire::phases::begin||(p.flags&4u)||!stream.active||!stream.pointer){
        const auto target=pointerTarget(p.x,p.y,p.snapshot.get());
        geometryCurrent=target&&target==pointerTarget(p.x,p.y,published.get())&&
          p.snapshot->sameInputGeometry(*published,target);
      }else if(stream.active&&stream.pointer&&stream.source==p.source){
        geometryCurrent=std::any_of(stream.capturedPublications.begin(),stream.capturedPublications.end(),
          [&](const auto& snapshot){return snapshot==p.snapshot;});
        if(!geometryCurrent)geometryCurrent=published->allows(stream.target)&&
          p.snapshot->sameInputGeometry(*published,stream.target);
      }
    }
  }
  if (closed || !visible || !focused || metrics.width == 0 || metrics.height == 0 ||
      p.metrics != metrics.epoch || (p.publication&&!p.snapshot) || !geometryCurrent ||
      (stream.denied && p.phase != wire::phases::begin && !(p.flags&4u))) {
    ++rejected; return wire::statuses::stale;
  }
  const auto views = std::max(1u, lease.ledger->activeViews);
  if (lease.ledger->queuedInputs >= wire::limits::inputPackets ||
      input.size() >= wire::limits::inputPackets / views ||
      (p.phase == wire::phases::update && (lease.ledger->updateInputs >= wire::limits::inputUpdates ||
        updates >= wire::limits::inputUpdates / views))) {
    cancelStream(p.stream, wire::statuses::budgetExceeded);
    ++rejected;
    event({wire::events::inputOverflow, wire::statuses::budgetExceeded, p.sequence, 0, p.stream});
    return wire::statuses::budgetExceeded;
  }
  if (p.phase == wire::phases::begin) stream.denied = false;
  input.push_back(p);
  ++lease.ledger->queuedInputs;
  if (p.phase == wire::phases::update) { ++updates; ++lease.ledger->updateInputs; }
  return wire::statuses::ok;
}
void View::needContent(const Node& n, Overlay& o, uint32_t stream) {
  if (o.needSent) return;
  o.needSent = true; ++coverageRequests;
  event({wire::events::needChildren,wire::statuses::contentUnavailable,n.coverage.revision,
    active->document->epoch,stream,n.id});
  interaction({wire::events::needChildren,wire::statuses::contentUnavailable,n.coverage.revision,
    active->document->epoch,stream,n.id});
}
void View::applyDelta(Handle h, double delta, uint32_t stream,const Frame* snapshot) {
  if (!active) return;
  const auto* geometry=snapshot?snapshot:published.get();std::optional<Point> remainder;
  for (uint32_t depth = 0; h && depth <= wire::limits::depth; ++depth) {
    if (!active->document->contains(h)) return;
    const auto& n = active->document->get(h);
    if (n.kind == wire::kinds::scrollViewport) {
      if(remainder){if(!geometry)return;const auto local=geometry->delta(h,remainder->x,remainder->y);delta=(n.properties.flags&1u)?local.x:local.y;if(std::abs(delta)<1e-12)return;}
      auto& o = overlays.at(h.key());
      if (o.deferred && (o.requested-o.offset)*delta < 0) {
        o.deferred = false; o.requested = o.offset; o.needSent = false;
      }
      const auto target = std::clamp(o.offset + delta, -1e12, 1e12);
      const auto extentOffset = n.properties.extent == wire::extents::unbounded ?
        std::max(n.properties.minimum, target) :
        std::clamp(target, n.properties.minimum, n.properties.maximum);
      if (extentOffset != target) ++coverageClamps;
      const auto offset = n.coverage.enabled ? std::clamp(extentOffset,n.coverage.minimum,n.coverage.maximum) : extentOffset;
      const bool unavailable = offset != extentOffset;
      const double viewport = (n.properties.flags & 1u) ? n.properties.width : n.properties.height;
      double requested = std::clamp((o.deferred ? o.requested : o.offset)+delta,-1e12,1e12);
      requested = n.properties.extent == wire::extents::unbounded ? std::max(n.properties.minimum,requested) :
        std::clamp(requested,n.properties.minimum,n.properties.maximum);
      const auto applied = offset - o.offset;
      if (applied != 0) { o.offset = offset; o.revision = next(o.revision); dirty = true; }
      o.requested = stream ? std::clamp(requested,o.offset-viewport,o.offset+viewport) : extentOffset;
      o.deferred = stream && o.requested != o.offset;
      o.deferredStream = o.deferred ? stream : 0;
      if (unavailable) {
        if (o.deferred) ++coverageDeferred;
        needContent(n,o,stream); return;
      }
      delta -= applied;
      if (delta == 0 || !(n.properties.flags & 2u) || n.properties.extent != wire::extents::finite) return;
      if(!geometry)return;const auto item=std::find_if(geometry->items.begin(),geometry->items.end(),[&](const auto& candidate){return candidate.node==h;});if(item==geometry->items.end())return;
      const bool horizontal=(n.properties.flags&1u)!=0;remainder=Point{delta*(horizontal?item->world.a:item->world.c),delta*(horizontal?item->world.b:item->world.d)};
      ++coverageHandoffs;
    }
    h = n.parent;
  }
}
void View::advanceDeferred(double dt) {
  if (!active || !visible || dt <= 0) return;
  for (auto& entry : overlays) {
    auto& o = entry.second;
    if (!o.deferred) continue;
    if (!o.deferredStream || !streams[o.deferredStream].active || !active->document->contains(o.node)) {
      o.deferred = false; o.requested = o.offset; continue;
    }
    const auto& n = active->document->get(o.node);
    const double viewport = (n.properties.flags & 1u) ? n.properties.width : n.properties.height;
    const double limit = std::min(double(wire::limits::coveragePixelsPerSecond),
      viewport*wire::limits::coverageViewportsPerSecond)*std::min(dt,1.0/60);
    const double goal = n.coverage.enabled ? std::clamp(o.requested,n.coverage.minimum,n.coverage.maximum) : o.requested;
    if(goal!=o.requested)needContent(n,o,o.deferredStream);
    const double value = o.offset+std::clamp(goal-o.offset,-limit,limit);
    if (value != o.offset) { o.offset=value;o.revision=next(o.revision);dirty=true; }
    if (o.offset == o.requested) { o.deferred=false;o.deferredStream=0; }
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
    time + timeout, 0, 0, bool(policy & 1u), bool(policy & 2u), false, {}, 0, 0, 0});
  lastCommand = id;
  commandResults.push_back({id, std::vector<uint8_t>(r.data, r.data + r.length)});
  if (commandResults.size() > wire::limits::results) commandResults.pop_front();
  for (uint32_t i = 1; i <= wire::limits::streams; ++i) if (streams[i].active &&
      (streams[i].target == node || streams[i].scroll == node)) {
    if (!(policy & 1u)) { finishCommand(id, wire::statuses::busy); return wire::statuses::busy; }
    cancelStream(i, wire::statuses::canceled);
  }
  return wire::statuses::pending;
}
uint32_t View::listSeek(Reader r,uint64_t id) {
  require(r.length==48&&r.u32(28)==0&&id>0);
  for(const auto& result:commandResults)if(result.id==id){
    require(result.bytes.size()==r.length&&std::equal(result.bytes.begin(),result.bytes.end(),r.data),wire::statuses::idReused);
    return result.status;}
  const auto viewport=handle(r,0),list=handle(r,8);
  require(active&&active->document->contains(viewport)&&active->document->contains(list)&&
    document->contains(viewport)&&document->contains(list),wire::statuses::invalidHandle);
  const auto& n=active->document->get(list);const auto& parent=active->document->get(viewport);
  require(n.parent==viewport&&n.listGeometry&&parent.kind==wire::kinds::scrollViewport&&
    n.list.generation==r.u64(16)&&document->get(list).list.generation==r.u64(16),wire::statuses::stale);
  require(r.u32(24)<n.list.count&&r.f64(32)>=0&&r.f64(32)<=1,wire::statuses::invalidValue);
  const bool horizontal=(parent.properties.flags&1u)!=0;
  const double origin=horizontal?n.properties.x:n.properties.y;
  const double size=horizontal?parent.properties.width:parent.properties.height;
  const double estimate=n.listGeometry->prefix(r.u32(24)+1)-n.listGeometry->prefix(r.u32(24));
  const double target=std::clamp(origin+n.listGeometry->prefix(r.u32(24))-(size-estimate)*r.f64(32),
    parent.properties.minimum,parent.properties.maximum);
  Writer normalized(56);writeHandle(normalized,0,viewport);normalized.u64(8,document->epoch);
  normalized.u64(16,overlays.at(viewport.key()).revision);normalized.f64(24,target);normalized.f64(40,r.f64(40));
  const auto status=scroll({normalized.bytes.data(),normalized.bytes.size()},id);
  commandResults.back().bytes.assign(r.data,r.data+r.length);
  if(status!=wire::statuses::pending)return status;
  auto& command=commands.at(id);command.list=list;command.listGeneration=r.u64(16);
  command.index=r.u32(24);command.alignment=r.f64(32);
  auto& overlay=overlays.at(viewport.key());overlay.requested=target;overlay.needSent=false;
  if(!seekOffset(*active->document,command))needContent(parent,overlay,0);
  dirty=true;
  return status;
}
void View::processInput(Input p) {
  if(!appDecision(p))return;
  if(p.flags&2u){pointer(p);return;}
  auto& stream = streams[p.stream];
  if (!p.target) p.target = stream.active ? stream.target : target(p.x, p.y,p.snapshot.get());
  if (p.metrics != metrics.epoch || !p.snapshot || !published || !active ||
      p.snapshot->scene->metrics.epoch != p.metrics ||
      !p.snapshot->scene->document->contains(p.target) || !published->allows(p.target) ||
      !active->document->contains(p.target)) { ++canceled; return; }
  if (p.phase == wire::phases::begin || (!stream.active && p.source != wire::sources::engineDriven)) {
    stream.active = true; stream.target = p.target; stream.source = p.source;
    auto& o = overlays.at(p.target.key()); o.ballistic = false; o.velocity = 0;
    o.deferred = false; o.requested = o.offset; o.deferredStream = 0;
    for (auto it = commands.begin(); it != commands.end();) {
      const auto command = it++;
      if (command->second.node == p.target) finishCommand(command->first, wire::statuses::canceled);
    }
  }
  if (!stream.active || stream.target != p.target || stream.source != p.source) {
    ++canceled; return;
  }
  if(!p.appApproved){++consumed;consumedThrough=std::max(consumedThrough,p.sequence);observeRaw(p,stream.target);}
  auto& o = overlays.at(stream.target.key());
  if (p.phase == wire::phases::update) {
    revealPending=false;
    const auto& node = active->document->get(stream.target);
    const auto delta=p.snapshot->delta(stream.target,p.dx,p.dy);
    applyDelta(stream.target, (node.properties.flags & 1u) ? delta.x : delta.y,
      p.source == wire::sources::engineDriven ? p.stream : 0,p.snapshot.get());
    o.velocity = p.velocity;
  } else if (p.phase == wire::phases::end || p.phase == wire::phases::cancel) {
    stream.active = false;
    bool deferred = false;
    for (auto& entry : overlays) if (entry.second.deferredStream == p.stream) {
      deferred |= entry.second.deferred;entry.second.deferred=false;entry.second.deferredStream=0;
      entry.second.requested=entry.second.offset;
    }
    if (p.phase == wire::phases::end && p.source == wire::sources::engineDriven &&
        !deferred && std::abs(p.velocity) >= 1) {
      o.ballistic = true; o.start = o.offset; o.startVelocity = p.velocity; o.elapsed = 0;
    } else { o.ballistic = false; o.velocity = 0; }
  }
  if (p.source != wire::sources::engineDriven) stream.active = false;
}
void View::tick(double now) {
  require(now >= 0 && (!hasTime || now >= time), wire::statuses::invalidValue);
  const double dt = hasTime && visible ? now - time : 0;
  time = now; hasTime = true; ++ticks;
  const bool appDue=appFrameDeadline>0&&now>=appFrameDeadline;
  if((appFrameRequested||appDue)&&visible&&metrics.width>0&&metrics.height>0){appFrameRequested=false;if(appDue)appFrameDeadline=0;
    interaction({wire::events::appFrame,wire::statuses::ok,++appFrameSerial,document?document->epoch:0,0,{},now,0});}
  for(uint32_t i=1;i<streams.size();++i){auto& stream=streams[i];
    if(stream.decision&&time>=stream.decisionDeadline){cancelStream(i,wire::statuses::timedOut);continue;}
    if(stream.appPending&&stream.appPending->appApproved){auto packet=std::move(*stream.appPending);
      stream.appPending.reset();stream.decision=0;stream.decisionDeadline=0;processInput(std::move(packet));}}
  // Capture once. Never extend this cut to a concurrently produced tail, and
  // never wait for the queue or the App observer to become empty.
  const uint64_t cut = input.empty() ? 0 : input.back().sequence;
  uint32_t used = 0;
  while (!input.empty() && input.front().sequence <= cut && used++ < wire::limits::inputPerTick) {
    auto p = input.front(); input.pop_front();
    --lease.ledger->queuedInputs;
    if (p.phase == wire::phases::update) { --updates; --lease.ledger->updateInputs; }
    processInput(std::move(p));
  }
  for(uint32_t i=1;i<streams.size();++i)if(streams[i].decision&&time>=streams[i].decisionDeadline)
    cancelStream(i,wire::statuses::timedOut);
  if (visible && metrics.width > 0 && metrics.height > 0) activate();
  advanceDeferred(dt);
  for (auto it = commands.begin(); it != commands.end();) {
    auto& c = (it++)->second;
    const auto id = c.id;
    if (!document->contains(c.node)) { finishCommand(id, wire::statuses::canceled); continue; }
    if (time >= c.deadline) { finishCommand(id, wire::statuses::timedOut); continue; }
    if(c.list){
      if(!document->contains(c.list)||document->get(c.list).list.generation!=c.listGeneration){finishCommand(id,wire::statuses::stale);continue;}
      if(!active)continue;
      const auto offset=seekOffset(*active->document,c);if(!offset)continue;
      c.target=*offset;
    }
    if (!visible || !active || active->document->epoch < c.after || !active->document->contains(c.node)) continue;
    auto& o = overlays.at(c.node.key());
    if (!c.started) {
      if (c.revision != o.revision && !c.rebase) { finishCommand(id, wire::statuses::stale); continue; }
      c.started = true; c.start = o.offset; o.ballistic = false;
    }
    c.elapsed += dt;
    const auto value = c.duration == 0 ? c.target : c.start +
      (c.target - c.start) * std::min(1.0, c.elapsed / c.duration);
    const auto& node = active->document->get(c.node);
    const double destination = node.properties.extent == wire::extents::unbounded ? std::max(node.properties.minimum,value) :
      std::clamp(value,node.properties.minimum,node.properties.maximum);
    if (node.coverage.enabled && (destination<node.coverage.minimum || destination>node.coverage.maximum)) {
      o.requested=destination;needContent(node,o,0);finishCommand(id,wire::statuses::contentUnavailable);continue;
    }
    applyDelta(c.node, value - o.offset);
    if (c.duration == 0 || c.elapsed >= c.duration) finishCommand(id, wire::statuses::ok);
  }
  if (visible && active && metrics.width > 0 && metrics.height > 0) for (auto& entry : overlays) {
    auto& o = entry.second;
    if(active->document->get(o.node).control.kind==wire::controlKinds::activity&&(!published||published->allows(o.node))){o.value=std::fmod(time,1.0);dirty=true;}
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
  advanceGestures();
  revealFocus();
  advanceCaret();
  if (dirty) propertyEpoch = next(propertyEpoch);
}
void View::revealFocus() {
  if(!revealPending||!visible||!focused||!focusNode||!active||active->metrics.epoch!=metrics.epoch||
      !active->document->contains(focusNode))return;
  const auto& geometry=*active->document;
  const auto& node=geometry.get(focusNode);
  Rect local{0,0,node.properties.width,node.properties.height};
  if(node.kind==wire::kinds::editable){
    const auto editor=editors.find(focusNode.key());
    if(editor==editors.end()||!node.textGeometry||node.textGeometry->revision!=editor->second->value->revision)return;
    const auto& caret=node.textGeometry->caret;local={caret.x,caret.y,caret.width,caret.height};
  }
  Lease scratch(lease.ledger,sizeof(Frame)+(geometry.highWater+1)*sizeof(Property)+geometry.count*(sizeof(DrawItem)+sizeof(ClipShape)+sizeof(HitRegionShape)));
  Frame frame;frame.scene=active;frame.properties.resize(geometry.highWater+1);
  for(const auto& [key,o]:overlays){auto& property=frame.properties[o.node.slot];
    property.node=o.node;property.offset=o.offset;property.opacity=o.opacity;}
  makeDrawItems(frame);
  const auto find=[&](Handle h)->const DrawItem&{const auto it=std::find_if(frame.items.begin(),frame.items.end(),
    [&](const auto& item){return item.node==h;});require(it!=frame.items.end(),wire::statuses::invalidGraph);return *it;};
  const auto& item=find(focusNode);Rect target=item.world.bounds(local);
  for(auto parent=node.parent;parent;parent=geometry.get(parent).parent){
    const auto& viewport=geometry.get(parent);if(viewport.kind!=wire::kinds::scrollViewport)continue;
    const auto& bounds=find(parent);const bool horizontal=(viewport.properties.flags&1u)!=0;
    const auto& layout=viewport.layout;
    const double inset=layout.enabled?(horizontal?layout.left:layout.top):0;
    const double endInset=layout.enabled?(horizontal?layout.right:layout.bottom):0;
    const auto inverse=bounds.world.inverse();if(!inverse)continue;
    const auto projected=inverse->bounds(target);
    const double minimum=inset;
    const double size=std::max(0.0,(horizontal?viewport.properties.width:viewport.properties.height)-inset-endInset);
    const double begin=horizontal?projected.x:projected.y,extent=horizontal?projected.width:projected.height;
    const double delta=begin<minimum?begin-minimum:std::max(0.0,begin+extent-(minimum+size));
    auto& overlay=overlays.at(parent.key());
    const double desired=overlay.offset+delta;
    double offset=viewport.properties.extent==wire::extents::unbounded?std::max(viewport.properties.minimum,desired):
      std::clamp(desired,viewport.properties.minimum,viewport.properties.maximum);
    if(viewport.coverage.enabled)offset=std::clamp(offset,viewport.coverage.minimum,viewport.coverage.maximum);
    const auto applied=offset-overlay.offset;
    if(applied){overlay.offset=offset;overlay.requested=offset;overlay.revision=next(overlay.revision);
      overlay.ballistic=false;overlay.velocity=0;overlay.deferred=false;dirty=true;
      target.x-=applied*(horizontal?bounds.world.a:bounds.world.c);
      target.y-=applied*(horizontal?bounds.world.b:bounds.world.d);}
  }
  revealPending=false;
}
void View::advanceCaret() {
  const bool before = caretVisible;
  const auto current = editors.find(focusNode.key());
  const bool eligible = visible && focused && focusNode && active &&
      metrics.width > 0 && metrics.height > 0 && active->metrics.epoch == metrics.epoch &&
      active->document->contains(focusNode) && current != editors.end();
  const Node* node = eligible ? &active->document->get(focusNode) : nullptr;
  const auto value = eligible ? current->second->value : nullptr;
  if (!node || !node->textGeometry || !node->editing ||
      node->textGeometry->revision != value->revision || node->editing->revision != value->revision ||
      value->base != value->extent) {
    caretVisible = false; caretDeadline = 0; caretNode = {}; caretRevision = 0;
  } else if (value->composingStart >= 0) {
    // A composition owns a steady caret. Only its native end notification may
    // resume blinking; an App callback is never part of the clock path.
    caretVisible = true; caretDeadline = 0; caretNode = focusNode; caretRevision = value->revision;
  } else {
    const double period = wire::limits::caretBlinkMs / 1000.0;
    if (caretNode != focusNode || caretRevision != value->revision || caretDeadline == 0) {
      caretNode = focusNode; caretRevision = value->revision;
      caretVisible = true; caretDeadline = time + period;
    } else if (time >= caretDeadline) {
      const double periods = std::floor((time - caretDeadline) / period) + 1;
      if (std::fmod(periods, 2.0) != 0) caretVisible = !caretVisible;
      // Coalesce a late wake to the current phase rather than replaying ticks.
      caretDeadline = time + period - std::fmod(time - caretDeadline, period);
    }
  }
  if (before != caretVisible) dirty = true;
}
double View::nextDeadline() const {
  double deadline = 0;
  if (!closed) {
    if(visible&&metrics.width>0&&metrics.height>0&&appFrameDeadline>0)deadline=appFrameDeadline;
    for (const auto& entry : commands)
      if (!deadline || entry.second.deadline < deadline) deadline = entry.second.deadline;
    if (visible && focused && metrics.width > 0 && metrics.height > 0 && caretDeadline > 0 &&
        (!deadline || caretDeadline < deadline)) deadline = caretDeadline;
    if(visible&&focused){if(lastTap&&(!deadline||lastTapTime+0.3<deadline))deadline=lastTapTime+0.3;
      if(lastTap&&!lastTapDownSent&&(lastTapDetails.flags&wire::gestureDetailFlags::valid)&&(!deadline||lastTapDownAt+0.1<deadline))deadline=lastTapDownAt+0.1;
      for(const auto& stream:streams)if(stream.active&&stream.pointer&&!stream.tapCanceled&&!stream.tapDownSent&&active&&active->document->contains(stream.target)&&
        (active->document->get(stream.target).policy&wire::eventPolicies::canonicalGestures)&&(active->document->get(stream.target).gestures&wire::gestures::tap)&&
        (!deadline||stream.at+0.1<deadline))deadline=stream.at+0.1;
      for(const auto& stream:streams)if(stream.decision&&(!deadline||stream.decisionDeadline<deadline))deadline=stream.decisionDeadline;
      for(const auto& stream:streams)if(stream.active&&stream.pointer&&!stream.pan&&!stream.pinched&&!stream.longSent&&
          active&&active->document->contains(stream.target)&&
          (active->document->get(stream.target).gestures&wire::gestures::longPress)&&(!deadline||stream.at+0.5<deadline))deadline=stream.at+0.5;}
  }
  return deadline;
}
uint32_t View::takeFrame() {
  if (!visible || metrics.width == 0 || metrics.height == 0 || !active ||
      active->metrics.epoch != metrics.epoch || active->metrics.device != metrics.device)
    return wire::statuses::contentUnavailable;
  if (!dirty) return wire::statuses::notFound;
  if (frames.size() >= wire::limits::frames) return wire::statuses::busy;
  const auto id = next(nextSubmission);
  Frame f; f.id = id; f.device = metrics.device; f.scene = active; f.propertyEpoch = propertyEpoch;
  f.focusNode=focusNode;f.focusSession=focusSession;
  f.caretVisible=caretVisible;
  f.properties.resize(active->document->highWater + 1);
  for (const auto& slot : active->document->nodes) if (slot.value) {
    const auto& o = overlays.at(slot.value->id.key());
    f.properties[o.node.slot] = {o.node, o.offset, o.velocity, o.opacity, o.revision, o.motion,o.requested,o.deferred};
    auto& property=f.properties[o.node.slot];property.value=o.value;property.second=o.second;property.pressed=o.pressed;property.hovered=o.hovered;
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
  auto snapshot=std::make_shared<Frame>(f);
  snapshot->snapshotLease=std::make_shared<Lease>(lease.ledger,sizeof(Frame)+
    snapshot->properties.size()*sizeof(Property)+snapshot->items.size()*sizeof(DrawItem)+snapshot->clips.size()*sizeof(ClipShape)+snapshot->hitRegions.size()*sizeof(HitRegionShape));
  // Paint-only App documents must not retire packets collected before capture
  // exists. Retain the same bounded window only while it shares input geometry;
  // enqueue still validates the exact hit target and its complete ancestor path.
  // Snapshots with no compatible target release their resources immediately.
  if(published&&published->scene->document->epoch!=snapshot->scene->document->epoch)
    for(auto& previous:publications)if(previous&&!previous->sharesInputGeometry(*snapshot))previous.reset();
  f.published = true;snapshot->published=true;published = std::move(snapshot);
  refreshMouse();
  publications[publicationCursor++%wire::limits::publicationSnapshots]=published;
  for(auto& stream:streams)if(stream.active&&stream.pointer){
    for(const auto& captured:stream.capturedPublications)if(captured){
      // App-owned ink/press animation replaces documents while the pointer is
      // held. Retain only the bounded sequence with unchanged target geometry;
      // the general admission window still retires on document replacement.
      if(captured->scene==published->scene||captured->sameInputGeometry(*published,stream.target))
        stream.capturedPublications[stream.captureCursor++%wire::limits::publicationSnapshots]=published;
      break;
    }
  }
  publication = id; surfaceCommit = commit;
  if(focusNode&&!published->allows(focusNode))setFocus({},0,focusSession);
  for(uint32_t stream=1;stream<streams.size();++stream)
    if((streams[stream].active||streams[stream].decision)&&!published->allows(streams[stream].target))cancelStream(stream,wire::statuses::canceled);
  if(lastTap&&!published->allows(lastTap))lastTap={};
  if(hoverNode&&!published->allows(hoverNode)){if(overlays.count(hoverNode.key()))overlays.at(hoverNode.key()).hovered=false;hoverNode={};dirty=true;}
  pendingPublication = 0;
  if (f.released) frames.erase(it);
}
bool View::wake() const {
  if (closed) return false;
  if (!input.empty()) return true;
  for(const auto& stream:streams)if(stream.appPending&&stream.appPending->appApproved)return true;
  for (const auto& entry : commands) {
    const auto& c = entry.second;
    if (time >= c.deadline || (!c.list && visible && active && active->document->epoch >= c.after &&
        active->document->contains(c.node))) return true;
  }
  if (!visible || metrics.width == 0 || metrics.height == 0) return false;
  if(appFrameRequested||(appFrameDeadline>0&&time>=appFrameDeadline))return true;
  if (caretDeadline > 0 && time >= caretDeadline) return true;
  if (demand || preparing || (dirty && frames.size() < wire::limits::frames)) return true;
  for (const auto& entry : overlays) if (entry.second.ballistic ||
      (entry.second.motion && entry.second.motionElapsed < entry.second.motionSeconds)) return true;
  if(active)for(const auto& entry:overlays)if(active->document->get(entry.second.node).control.kind==wire::controlKinds::activity&&(!published||published->allows(entry.second.node)))return true;
  return false;
}
bool View::renderWake() const {
  if (closed || !visible || metrics.width == 0 || metrics.height == 0) return false;
  if(appFrameRequested||(appFrameDeadline>0&&time>=appFrameDeadline))return true;
  for(const auto& stream:streams)if(stream.appPending&&stream.appPending->appApproved)return true;
  if (caretDeadline > 0 && time >= caretDeadline) return true;
  if (!input.empty() || (preparing && preparing->ready && preparing->providerReady)) return true;
  if (dirty && active && active->metrics.epoch == metrics.epoch && frames.size() < wire::limits::frames) return true;
  for (const auto& entry : overlays) if (entry.second.ballistic ||
    (entry.second.motion && !entry.second.motionDone)) return true;
  if(active)for(const auto& entry:overlays)if(active->document->get(entry.second.node).control.kind==wire::controlKinds::activity&&(!published||published->allows(entry.second.node)))return true;
  if (active) for (const auto& entry : overlays) if (entry.second.deferred) {
    const auto& o=entry.second; const auto& n=active->document->get(o.node);
    const double goal=n.coverage.enabled?std::clamp(o.requested,n.coverage.minimum,n.coverage.maximum):o.requested;
    if (goal!=o.offset) return true;
  }
  for (const auto& entry : commands) if (time >= entry.second.deadline || entry.second.started) return true;
  return false;
}
}
