// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "../state.hpp"
#include <algorithm>
#include <set>

namespace nelyx::v2 {
inline void observationCohorts(Writer& out,size_t at,const View& view){
  out.u64(at+48,view.document?view.document->epoch:0);out.u64(at+56,view.metrics.epoch);
  out.u64(at+64,view.metrics.device);out.u64(at+72,view.fontRevision);
  if(view.active){const auto& active=*view.active;out.u64(at+80,active.document->epoch);out.u64(at+88,active.metrics.epoch);
    out.u64(at+96,active.metrics.device);out.u64(at+104,active.fontRevision);out.u64(at+112,active.preparation);}
  if(view.published){const auto& frame=*view.published;const auto& scene=*frame.scene;
    out.u64(at+120,scene.document->epoch);out.u64(at+128,scene.metrics.epoch);out.u64(at+136,frame.device);
    out.u64(at+144,scene.fontRevision);out.u64(at+152,scene.preparation);out.u64(at+160,frame.propertyEpoch);out.u64(at+168,view.publication);}
}
inline std::array<uint64_t,20> observationSignature(const View& v,bool semantics){
  return {semantics?v.publication:v.activated,semantics&&v.published?v.published->scene->document->epoch:v.active?v.active->document->epoch:0,
    v.metrics.epoch,v.metrics.device,v.fontRevision,v.propertyEpoch,v.editingWork,v.controlWork,v.focusWork,v.gestureWork,
    v.semanticsWork,0,0,v.focusSession,v.caretRevision,uint64_t(v.caretVisible),
    uint64_t(v.visible),uint64_t(v.focused),v.active?v.active->metrics.epoch:0,v.published?v.published->scene->metrics.epoch:0};
}
enum class ObservationRole { app,frame,preparation };
inline bool observationNodeBlob(uint32_t type,ObservationRole role=ObservationRole::app){
  if(role!=ObservationRole::app)return (role==ObservationRole::preparation&&type==1)||type==4||type==5||type==7||(type>=10&&type<=15)||
    type==wire::fontBindingBlob||type==wire::imagePaintBlob||type==wire::snapshotStyleBlob;
  return (type>=3&&type<=7)||type==wire::layerCompositionBlob||type==wire::layoutBuilderBlob||
    type==wire::semanticGeometryBlob||type==wire::semanticTraversalBlob;
}
inline bool observationPatch(const ObservationState& cache,const std::array<uint64_t,20>& signature){
  // Global font/metrics/device changes invalidate the complete role. Other
  // changes have bounded slot journals produced at activation/publication or
  // by the live input/editor owner, even when the subscriber skips frames.
  return cache.version&&!cache.fullRequired&&cache.signature[2]==signature[2]&&
    cache.signature[3]==signature[3]&&cache.signature[4]==signature[4];
}
// Cache only bounded immutable row/blob storage, never a Frame/Document/provider
// reader. Unknown bases request a full resync with the same owner generation.
inline std::vector<uint8_t> observationPacket(View& view,ObservationState& cache,Writer& full,uint64_t base,
    const std::array<uint64_t,20>& signature,const std::vector<Handle>& selection,bool reused,bool partial,
    std::vector<Handle> partialOrder,std::vector<Handle> removed,ObservationRole role=ObservationRole::app){
  Reader input{full.bytes.data(),full.bytes.size()};
  const auto state=wire::headerBytes,begin=state+wire::stateBytes;
  const auto count=input.u32(wire::headerFields::count),eventCount=input.u32(state+wire::stateFields::eventCount);
  require(eventCount==0,wire::statuses::invalidValue);
  std::map<uint64_t,std::shared_ptr<const ObservationRow>> rows;
  std::vector<Handle> order;
  std::vector<std::vector<uint8_t>> globals;
  std::map<uint64_t,std::vector<std::shared_ptr<const ObservationBlob>>> rowBlobs;
  uint32_t hits=0;
  size_t cursor=begin+size_t(count)*wire::nodeBytes;
  for(uint32_t i=0;i<input.u32(state+wire::stateFields::blobCount);++i){
    const auto type=input.u32(cursor);const auto owner=handle(input,cursor+8);
    const auto length=input.u32(cursor+16);const auto stride=24+(size_t(length)+7)/8*8;
    const auto data=input.slice(cursor+24,length);
    if(!reused&&owner&&observationNodeBlob(type,role)){
      std::shared_ptr<const ObservationBlob> blob;
      const auto previous=cache.rows.find(owner.key());
      if(previous!=cache.rows.end())for(const auto& candidate:previous->second->blobs)
        if(candidate->type==type&&candidate->bytes.size()==length&&std::equal(candidate->bytes.begin(),candidate->bytes.end(),data.data)){blob=candidate;++hits;break;}
      if(!blob){view.observationBlobSequence=next(view.observationBlobSequence);
        blob=std::make_shared<ObservationBlob>(view.lease.ledger,view.observationBlobSequence,type,owner,data);}
      rowBlobs[owner.key()].push_back(std::move(blob));
    }else globals.emplace_back(input.data+cursor,input.data+cursor+stride);
    cursor+=stride;
  }
  require(cursor==input.length);
  if(reused&&base==cache.version){
    Writer envelope(24+wire::observationDeltaBytes);envelope.u32(0,wire::observationDeltaBlob);
    envelope.u32(16,wire::observationDeltaBytes);envelope.u64(24,base);envelope.u64(32,cache.version);envelope.u64(64,cache.bytes);
    observationCohorts(envelope,24,view);
    globals.push_back(std::move(envelope.bytes));
    size_t bytes=0;for(const auto& blob:globals)bytes+=blob.size();
    Writer result(begin+bytes);std::copy_n(full.bytes.begin(),begin,result.bytes.begin());
    result.u32(wire::headerFields::count,0);result.u32(wire::headerFields::length,uint32_t(result.bytes.size()));
    result.u32(state+wire::stateFields::blobCount,uint32_t(globals.size()));result.u32(state+wire::stateFields::blobBytes,uint32_t(bytes));
    cursor=begin;for(const auto& blob:globals){std::copy(blob.begin(),blob.end(),result.bytes.begin()+cursor);cursor+=blob.size();}
    return std::move(result.bytes);
  }
  const auto storage=[](const ObservationRow& row){size_t size=row.lease.bytes;
    for(const auto& blob:row.blobs)size+=sizeof(ObservationBlob)+blob->bytes.size();return size;};
  int64_t retained=partial?int64_t(cache.bytes):0;
  if(!reused)for(uint32_t i=0;i<count;++i){
    const auto at=begin+size_t(i)*wire::nodeBytes;const auto id=handle(input,at);
    auto& blobs=rowBlobs[id.key()];
    const auto previous=cache.rows.find(id.key());
    std::shared_ptr<const ObservationRow> row;
    if(previous!=cache.rows.end()&&std::equal(previous->second->bytes.begin(),previous->second->bytes.end(),input.data+at)&&
      previous->second->blobs==blobs)row=previous->second;
    else {auto fresh=std::make_shared<ObservationRow>(view.lease.ledger,id,blobs.capacity());
      std::copy_n(input.data+at,wire::nodeBytes,fresh->bytes.begin());fresh->blobs=std::move(blobs);row=std::move(fresh);}
    require(rows.emplace(id.key(),row).second,wire::statuses::invalidGraph);order.push_back(id);
    if(partial){if(previous!=cache.rows.end())retained-=int64_t(storage(*previous->second));else retained+=64;}
    retained+=storage(*row);
  }
  if(reused){retained=cache.bytes;}
  else if(!partial)retained+=rows.size()*64+order.size()*sizeof(Handle)+selection.size()*sizeof(Handle);
  if(partial){for(const auto node:removed){const auto found=cache.rows.find(node.key());
      require(found!=cache.rows.end(),wire::statuses::invalidGraph);retained-=int64_t(storage(*found->second)+64);}
    if(cache.orderDirty)retained+=(int64_t(partialOrder.size())-int64_t(cache.order.size()))*int64_t(sizeof(Handle));}
  require(retained>=0&&retained<=wire::limits::observationBytes,wire::statuses::budgetExceeded);
  const auto& desiredOrder=reused?cache.order:partial?(cache.orderDirty?partialOrder:cache.order):order;
  const bool orderChanged=!reused&&(!partial||cache.orderDirty)&&desiredOrder!=cache.order;
  const auto desired=[&](Handle id)->const std::shared_ptr<const ObservationRow>&{
    const auto found=rows.find(id.key());if(!reused&&found!=rows.end())return found->second;
    return cache.rows.at(id.key());};
  bool changed=!cache.version;
  if(!reused){if(partial){changed|=!removed.empty()||orderChanged;
      for(const auto& [key,row]:rows){const auto found=cache.rows.find(key);changed|=found==cache.rows.end()||row!=found->second;}}
    else changed|=orderChanged||rows!=cache.rows;}
  const auto version=changed?next(view.observationSequence):cache.version;
  const bool reset=!base||base!=cache.version;
  const bool replaceOrder=reset||orderChanged;
  if(!reset&&!partial&&!reused)for(const auto& [key,row]:cache.rows)if(!rows.contains(key))removed.push_back(row->node);
  std::vector<std::shared_ptr<const ObservationRow>> updates;
  for(const auto id:partial&&!reset?order:desiredOrder){const auto& row=desired(id);const auto previous=cache.rows.find(id.key());
    if(reset||previous==cache.rows.end()||previous->second!=row)updates.push_back(row);}
  std::vector<std::vector<uint8_t>> encoded=std::move(globals);
  const auto add=[&](uint32_t type,Handle owner,Writer payload){Writer blob(24+(payload.bytes.size()+7)/8*8);
    blob.u32(0,type);writeHandle(blob,8,owner);blob.u32(16,uint32_t(payload.bytes.size()));
    std::copy(payload.bytes.begin(),payload.bytes.end(),blob.bytes.begin()+24);encoded.push_back(std::move(blob.bytes));};
  std::set<uint64_t> known;
  if(!reset){if(partial){for(const auto& row:updates){const auto found=cache.rows.find(row->node.key());
      if(found!=cache.rows.end())for(const auto& blob:found->second->blobs)known.insert(blob->id);}}
    else for(const auto& [key,row]:cache.rows)for(const auto& blob:row->blobs)known.insert(blob->id);}
  uint32_t transmitted=0;
  for(const auto& row:updates){Writer refs(row->blobs.size()*8);
    for(size_t i=0;i<row->blobs.size();++i){const auto& blob=row->blobs[i];refs.u64(i*8,blob->id);
      if(known.insert(blob->id).second){Writer registration(16+blob->bytes.size());registration.u64(0,blob->id);
        registration.u32(8,blob->type);registration.u32(12,uint32_t(blob->bytes.size()));
        std::copy(blob->bytes.begin(),blob->bytes.end(),registration.bytes.begin()+16);
        add(wire::observationRegistrationBlob,blob->owner,std::move(registration));++transmitted;}}
    add(wire::observationReferencesBlob,row->node,std::move(refs));
  }
  const auto removedCount=reset?0:removed.size();
  Writer delta(wire::observationDeltaBytes+removedCount*8+(replaceOrder?desiredOrder.size()*8:0));
  delta.u64(0,reset?0:base);delta.u64(8,version);delta.u32(16,(reset?1u:0u)|(replaceOrder?2u:0u));
  delta.u32(20,uint32_t(removedCount));delta.u32(24,replaceOrder?uint32_t(desiredOrder.size()):0);
  delta.u32(28,reused?0:count);delta.u32(32,transmitted);delta.u32(36,hits);delta.u64(40,retained);
  observationCohorts(delta,0,view);
  cursor=wire::observationDeltaBytes;if(!reset)for(const auto id:removed){writeHandle(delta,cursor,id);cursor+=8;}
  if(replaceOrder)for(const auto id:desiredOrder){writeHandle(delta,cursor,id);cursor+=8;}
  add(wire::observationDeltaBlob,{},std::move(delta));
  size_t blobBytes=0;for(const auto& blob:encoded)blobBytes+=blob.size();
  const auto length=begin+updates.size()*wire::nodeBytes+blobBytes;
  require(length<=wire::limits::responseBytes,wire::statuses::budgetExceeded);
  Writer result(length);std::copy_n(full.bytes.begin(),begin,result.bytes.begin());
  result.u32(wire::headerFields::count,uint32_t(updates.size()));result.u32(wire::headerFields::length,uint32_t(length));
  result.u32(state+wire::stateFields::blobCount,uint32_t(encoded.size()));result.u32(state+wire::stateFields::blobBytes,uint32_t(blobBytes));
  cursor=begin;for(const auto& row:updates){std::copy(row->bytes.begin(),row->bytes.end(),result.bytes.begin()+cursor);cursor+=wire::nodeBytes;}
  for(const auto& blob:encoded){std::copy(blob.begin(),blob.end(),result.bytes.begin()+cursor);cursor+=blob.size();}
  if(!reused){
    if(partial){
      size_t entries=cache.rows.size()-removed.size();for(const auto& [key,row]:rows)if(!cache.rows.contains(key))++entries;
      // Reserve index accounting before changing the accepted subscription.
      // Transfer map nodes below without allocating after the first mutation.
      const auto indexBytes=entries*64+desiredOrder.size()*sizeof(Handle)+selection.size()*sizeof(Handle);
      auto index=cache.indexLease&&cache.indexLease->bytes==indexBytes?cache.indexLease:std::make_shared<Lease>(view.lease.ledger,indexBytes);
      for(const auto node:removed){cache.rows.erase(node.key());cache.slots[node.slot]={};}
      for(auto it=rows.begin();it!=rows.end();){const auto found=cache.rows.find(it->first);cache.slots[it->second->node.slot]=it->second->node;
        if(found!=cache.rows.end()){found->second=std::move(it->second);++it;}else cache.rows.insert(rows.extract(it++));}
      if(cache.orderDirty)cache.order=std::move(partialOrder);cache.indexLease=std::move(index);
    }
    else{auto index=std::make_shared<Lease>(view.lease.ledger,rows.size()*64+desiredOrder.size()*sizeof(Handle)+selection.size()*sizeof(Handle));
      cache.rows=std::move(rows);cache.order=std::move(order);cache.selection=selection;cache.indexLease=std::move(index);
      cache.slots.fill({});for(const auto& [key,row]:cache.rows)cache.slots[row->node.slot]=row->node;}
    cache.bytes=retained;
  }
  cache.clean();cache.signature=signature;cache.version=version;if(changed)view.observationSequence=version;
  result.u64(state+wire::stateFields::reservedBytes,view.lease.ledger->bytes);
  return std::move(result.bytes);
}
}
