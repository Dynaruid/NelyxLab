// SPDX-License-Identifier: BSD-3-Clause
#include "../state.hpp"

namespace nelyx::v2 {
void SnapshotRegistry::liveTokens(SnapshotDecision& result)const {
  for(const auto& entry:entries_)if(entry.token)result.liveTokens[result.liveCount++]=entry.token;
}
SnapshotDecision SnapshotRegistry::beginFrame(const Frame& frame) {
  if(device_!=frame.device){clear();device_=frame.device;}
  const auto& document=*frame.scene->document;
  for(auto& entry:entries_)if(entry.node) {
    if(!document.contains(entry.node)){entry={};continue;}
    const auto& style=document.get(entry.node).snapshot;
    if(!style||!style->enabled||style->revision!=entry.revision||style->ratio!=entry.ratio)entry={};
  }
  // A detached capture currently projects the child through the inverse root
  // matrix. Never silently delay a first capture beneath a singular ancestor:
  // Source paints that child even when its composed output has no pixels.
  for(const auto& item:frame.items) {
    const auto& node=document.get(item.node);const auto& style=node.snapshot;
    if(!style||!style->enabled||item.opacity<=0||item.world.inverse())continue;
    bool retained=false;
    for(const auto& entry:entries_)if(entry.node==node.id)
      retained=entry.disabled||(entry.captured&&(!style->autoresize||
        (entry.width==node.properties.width&&entry.height==node.properties.height)));
    require(retained||node.properties.width<=0||node.properties.height<=0,wire::statuses::capabilityMissing);
  }
  SnapshotDecision result;result.action=3;liveTokens(result);return result;
}
SnapshotDecision SnapshotRegistry::paint(const Frame& frame,Handle id,bool rasterizable) {
  const auto& node=frame.scene->document->get(id);
  require(node.snapshot.has_value(),wire::statuses::capabilityMissing);
  const auto& style=*node.snapshot;
  const double width=node.properties.width,height=node.properties.height;
  Entry* entry=nullptr;
  for(auto& candidate:entries_)if(candidate.node==id){entry=&candidate;break;}
  if(entry&&(!style.enabled||entry->revision!=style.revision||entry->ratio!=style.ratio))*entry={};
  if(entry&&!entry->node)entry=nullptr;
  if(width<=0||height<=0){if(entry)*entry={};entry=nullptr;}
  bool cached=false;
  if(style.enabled&&width>0&&height>0) {
    if(!entry){for(auto& candidate:entries_)if(!candidate.node){entry=&candidate;break;}
      require(entry!=nullptr,wire::statuses::budgetExceeded);
      *entry={id,style.revision,0,style.ratio};}
    if(!entry->disabled) {
      if(entry->token&&style.autoresize&&(entry->width!=width||entry->height!=height)) {
        entry->token=0;entry->captured=false;
      }
      if(!entry->token) {
        if(!rasterizable&&style.mode!=2) {
          require(style.mode==1,wire::statuses::capabilityMissing);entry->disabled=true;
        } else {
          const double pixelsX=std::ceil(width*style.ratio),pixelsY=std::ceil(height*style.ratio);
          require(pixelsX>0&&pixelsY>0&&pixelsX<=8192&&pixelsY<=8192&&pixelsX*pixelsY<=16777216,
            wire::statuses::budgetExceeded);
          sequence_=next(sequence_);entry->token=sequence_;entry->width=width;entry->height=height;
          entry->pixelWidth=uint32_t(pixelsX);entry->pixelHeight=uint32_t(pixelsY);entry->captured=false;
        }
      }
      cached=entry->token!=0;
    }
  }
  SnapshotDecision result;result.boxWidth=width;result.boxHeight=height;
  const auto& paint=cached?style.cached:style.live;
  result.opacity=paint.opacity;result.background=paint.background;
  double baseWidth=width,baseHeight=height;
  if(cached) {
    result.token=entry->token;result.action=entry->captured?2u:1u;
    result.sourceWidth=entry->width;result.sourceHeight=entry->height;result.ratio=entry->ratio;
    result.pixelWidth=entry->pixelWidth;result.pixelHeight=entry->pixelHeight;
    result.sourceRectWidth=paint.intrinsic?entry->pixelWidth:entry->width*entry->ratio;
    result.sourceRectHeight=paint.intrinsic?entry->pixelHeight:entry->height*entry->ratio;
    if(paint.intrinsic){baseWidth=entry->pixelWidth/entry->ratio;baseHeight=entry->pixelHeight/entry->ratio;}
    result.destinationWidth=baseWidth;result.destinationHeight=baseHeight;
  }
  result.transform={paint.scaleX,0,0,paint.scaleY,
    baseWidth*paint.translateX+paint.offsetX,baseHeight*paint.translateY+paint.offsetY};
  liveTokens(result);return result;
}
void SnapshotRegistry::complete(Handle node,uint64_t token,bool success) {
  require(token>0,wire::statuses::invalidValue);
  for(auto& entry:entries_)if(entry.node==node&&entry.token==token) {
    require(!entry.captured,wire::statuses::stale);
    if(success)entry.captured=true;else entry={};return;
  }
  require(false,wire::statuses::stale);
}
}
