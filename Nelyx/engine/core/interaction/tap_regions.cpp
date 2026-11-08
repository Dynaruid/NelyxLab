// SPDX-License-Identifier: BSD-3-Clause
#include "../state.hpp"
#include <algorithm>

namespace nelyx::v2 {
namespace {
void appendEvents(View& view,const Input& input,const PointerPath& path,Handle surface,
    const Affine& inverse,uint64_t batch,Handle semanticTarget,bool up,
    std::vector<Event>& pending,bool& consume){
  const auto classification=view.classifyTapRegions(surface,path);
  const auto append=[&](Handle id,bool inside){
    const auto& style=view.document->get(id).tapRegion;
    if(!inside&&(style.flags&wire::tapRegionFlags::consumeOutside))consume=true;
    const uint32_t flag=up?(inside?wire::tapRegionFlags::upInside:wire::tapRegionFlags::upOutside):
      (inside?wire::tapRegionFlags::downInside:wire::tapRegionFlags::downOutside);
    if(!(style.flags&flag))return;
    require(pending.size()<wire::limits::interactionEvents,wire::statuses::budgetExceeded);
    const uint32_t kind=up?(inside?wire::tapRegionEvents::upInside:wire::tapRegionEvents::upOutside):
      (inside?wire::tapRegionEvents::downInside:wire::tapRegionEvents::downOutside);
    Event event{wire::events::tapRegion,kind,input.sequence,view.document->epoch,input.publication,id,input.x,input.y};
    const auto local=inverse.map({input.x,input.y});
    event.gesture.kind=input.kind;event.gesture.stream=input.stream;event.gesture.timestamp=input.time;
    event.gesture.buttons=input.buttons;event.gesture.flags=wire::gestureDetailFlags::valid;
    event.gesture.localX=local.x;event.gesture.localY=local.y;
    event.tapRegion={batch,surface,semanticTarget,inverse,input.device};
    pending.push_back(event);
  };
  for(const auto id:classification->outside)append(id,false);
  for(const auto id:classification->inside)append(id,true);
}
}
bool View::dispatchTapRegions(const Input& packetInput,const TapRegionCapture& capture,bool up){
  if(!capture.path||!capture.frame)return false;
  require(tapRegionBatch<UINT64_MAX,wire::statuses::exhausted);
  const auto batch=++tapRegionBatch;
  Lease pendingLease(lease.ledger,wire::limits::interactionEvents*sizeof(Event));
  std::vector<Event> pending;pending.reserve(wire::limits::interactionEvents);
  bool consume=false;
  for(const auto& hit:capture.path->entries){
    if(!hit.hit||!capture.frame->scene->document->contains(hit.node)||
       capture.frame->scene->document->get(hit.node).tapRegion.flags!=wire::tapRegionFlags::surface)continue;
    appendEvents(*this,packetInput,*capture.path,hit.node,hit.inverse,batch,{},up,pending,consume);
  }
  // Admission is atomic for one collected packetInput. Never publish a partial set
  // of outside/inside callbacks when the bounded observer queue is full.
  require(pending.size()<=wire::limits::interactionEvents-interactionEvents.size(),wire::statuses::budgetExceeded);
  for(const auto& event:pending)interaction(event);
  return !up&&consume;
}
uint64_t View::dispatchSemanticTapRegions(Handle target,uint64_t publicationId,uint32_t action){
  if(!published||(action!=wire::semanticsActions::activate&&action!=wire::semanticsActions::longPress))return 0;
  const auto item=std::find_if(published->items.begin(),published->items.end(),[&](const auto& value){return value.node==target;});
  if(item==published->items.end())return 0;
  const auto bounds=intersect(item->bounds,item->clip);
  if(bounds.width<=0||bounds.height<=0)return 0;
  require(tapRegionBatch<UINT64_MAX,wire::statuses::exhausted);
  const auto batch=++tapRegionBatch;
  Input synthetic{};synthetic.publication=publicationId;synthetic.x=bounds.x+bounds.width/2;
  synthetic.y=bounds.y+bounds.height/2;synthetic.kind=wire::pointerKinds::touch;
  Lease pendingLease(lease.ledger,wire::limits::interactionEvents*sizeof(Event));
  std::vector<Event> pending;pending.reserve(wire::limits::interactionEvents);
  bool ignored=false;
  for(const auto& surface:published->items){
    if(published->scene->document->get(surface.node).tapRegion.flags!=wire::tapRegionFlags::surface)continue;
    const auto path=published->pointerPath(synthetic.x,synthetic.y,surface.node,true);
    if(path->hit)appendEvents(*this,synthetic,*path,surface.node,{},batch,target,false,pending,ignored);
  }
  // Leave one slot for the matching semantic action that drains this batch.
  require(pending.size()+1<=wire::limits::interactionEvents-interactionEvents.size(),wire::statuses::budgetExceeded);
  for(const auto& event:pending)interaction(event);
  return batch;
}
bool View::registeredTapRegion(const Document& current,const TapRegionRegistration& entry)const {
  if(!current.contains(entry.node)||!current.contains(entry.surface))return false;
  const auto& style=current.get(entry.node).tapRegion;
  return style.revision&&style.revision==entry.revision&&style.surface==entry.surface&&
    (style.flags&wire::tapRegionFlags::enabled)&&
    current.get(entry.surface).tapRegion.flags==wire::tapRegionFlags::surface;
}
void View::installTapRegions(const Document& current,const LayoutOutput* output) {
  uint32_t retained=0;
  for(uint32_t i=0;i<tapRegionCount;++i)
    if(registeredTapRegion(current,tapRegions[i]))tapRegions[retained++]=tapRegions[i];
  tapRegionCount=retained;
  if(!output)return;
  for(const auto id:output->tapRegionVisits){
    require(current.contains(id),wire::statuses::invalidHandle);
    const auto& style=current.get(id).tapRegion;
    const TapRegionRegistration registration{id,style.surface,style.revision};
    auto last=tapRegions.begin()+tapRegionCount;
    const auto previous=std::find_if(tapRegions.begin(),last,[&](const auto& entry){return entry.node==id;});
    if(previous!=last){std::move(previous+1,last,previous);--tapRegionCount;}
    if(registeredTapRegion(current,registration)){
      require(tapRegionCount<tapRegions.size(),wire::statuses::budgetExceeded);
      tapRegions[tapRegionCount++]=registration;
    }
  }
}
std::unique_ptr<TapRegionClassification> View::classifyTapRegions(Handle surface,const PointerPath& path)const {
  auto result=std::make_unique<TapRegionClassification>(lease.ledger);
  if(!document->contains(surface)||document->get(surface).tapRegion.flags!=wire::tapRegionFlags::surface)return result;
  Lease scratch(lease.ledger,(wire::limits::nodes+1)*(sizeof(const TapRegionRegistration*)+sizeof(bool)));
  std::array<const TapRegionRegistration*,wire::limits::nodes+1> registered{};
  std::array<bool,wire::limits::nodes+1> included{};
  for(uint32_t i=0;i<tapRegionCount;++i){const auto& entry=tapRegions[i];
    if(entry.surface==surface&&registeredTapRegion(*document,entry))registered[entry.node.slot]=&entry;
  }
  for(const auto& hit:path.entries){
    const auto* entry=registered[hit.node.slot];
    if(!entry||entry->node!=hit.node)continue;
    const auto group=document->get(entry->node).tapRegion.group;
    const auto add=[&](Handle id){if(!included[id.slot]){included[id.slot]=true;result->inside.push_back(id);}};
    if(!group)add(entry->node);
    else for(uint32_t i=0;i<tapRegionCount;++i){const auto& member=tapRegions[i];
      if(registered[member.node.slot]&&document->get(member.node).tapRegion.group==group)add(member.node);
    }
  }
  for(uint32_t i=0;i<tapRegionCount;++i){const auto& entry=tapRegions[i];
    if(registered[entry.node.slot]&&!included[entry.node.slot])result->outside.push_back(entry.node);
  }
  return result;
}
}
