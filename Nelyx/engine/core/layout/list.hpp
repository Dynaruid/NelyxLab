// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "../memory.hpp"
#include <map>

namespace nelyx::v2 {
struct ListStyle {
  uint64_t generation = 0;
  uint32_t count = 0, begin = 0, end = 0;
  double estimate = 0;
  bool fixed = false, sequential = false;
};
struct ListItem { uint32_t index = 0; uint64_t key = 0; };
struct ListMetric { uint64_t key = 0; double extent = 0; };
struct ListRow { Handle node; uint32_t index; uint64_t key; double offset, extent; };
struct ListGeometry {
  Lease lease;
  ListStyle style;
  uint32_t metricLimit;
  std::map<uint32_t,ListMetric> measured;
  std::vector<ListRow> rows;
  double total = 0, begin = 0, end = 0, estimate = 0, knownExtent = 0;
  uint32_t knownCount = 0;
  ListGeometry(const std::shared_ptr<Ledger>& ledger, ListStyle value,uint32_t limit=wire::limits::listMetrics)
    : lease(ledger,sizeof(ListGeometry)+std::min(value.count,limit+wire::limits::listChildren)*(sizeof(ListMetric)+48)+
        wire::limits::listChildren*sizeof(ListRow)),style(value),metricLimit(limit),estimate(value.estimate) {}
  void updateEstimate() {
    knownCount=0;knownExtent=0;
    for(const auto& [i,m]:measured){if(i!=knownCount)break;++knownCount;knownExtent+=m.extent;}
    if(style.sequential)estimate=knownCount?knownExtent/knownCount:0;
    require(std::isfinite(knownExtent)&&knownExtent>=0&&knownExtent<=1e12&&
      std::isfinite(estimate)&&estimate>=0&&estimate*style.count<=1e12,wire::statuses::invalidValue);
  }
  double prefix(uint32_t index) const {
    double offset = 0;uint32_t from=0;
    for(const auto& [i,m]:measured) { if(i>=index)break;offset+=estimate*(i-from)+m.extent;from=i+1; }
    offset+=estimate*(index-from);
    require(std::isfinite(offset)&&offset>=0&&offset<=1e12,wire::statuses::invalidValue);
    return offset;
  }
  uint32_t indexAt(double offset) const {
    uint32_t low=0,high=style.count;
    while(low<high){const auto mid=low+(high-low)/2;
      if(prefix(mid+1)<=offset)low=mid+1;else high=mid;}
    return low;
  }
};
struct NativeListRange { uint32_t begin=0,end=0; double beginOffset=0; };
inline NativeListRange nativeListRange(const ListStyle& style,const ListGeometry* geometry,double offset,double paint) {
  require(std::isfinite(offset)&&offset>=0&&std::isfinite(paint)&&paint>=0,wire::statuses::invalidValue);
  if(geometry&&(geometry->style.count!=style.count||geometry->style.generation!=style.generation))geometry=nullptr;
  if(style.sequential){
    const uint32_t known=geometry?geometry->knownCount:0;
    const double extent=geometry?geometry->knownExtent:0;
    if(!style.count||paint==0)return {0,0,0};
    // Batch contiguous construction from actual prefix measurements. These
    // heights select bounded Source work only; Content still measures every
    // child before deciding the visible window or final scroll geometry.
    const auto extend=[&](uint32_t begin){
      const double average=known?extent/known:0;
      const double remaining=std::max(0.0,offset+paint-extent);
      const auto count=!known?1u:average>0?uint32_t(std::clamp(std::ceil(remaining/average),1.0,8.0)):8u;
      return known+std::min({count,style.count-known,wire::limits::listChildren-(known-begin)});
    };
    // Estimates describe scroll metrics only. They never skip an unmeasured
    // prefix: long offsets stream through real Source children in order.
    if(known<style.count&&offset>=extent)return {known,extend(known),extent};
    const uint32_t begin=geometry?std::min(known,geometry->indexAt(offset)):0;
    uint32_t end=geometry?std::min(known,geometry->indexAt(offset+paint)):0;
    if(end<known&&geometry->prefix(end)<offset+paint)++end;
    if(end==known&&known<style.count&&extent<offset+paint)end=extend(begin);
    return {begin,end,geometry?geometry->prefix(begin):0};
  }
  const auto rank=[&](double at){return geometry?geometry->indexAt(at):uint32_t(std::min(double(style.count),std::floor(at/style.estimate)));};
  const auto prefix=[&](uint32_t at){return geometry?geometry->prefix(at):style.estimate*at;};
  const uint32_t begin=rank(offset),last=rank(offset+paint);
  uint32_t end=paint==0?begin:std::min(style.count,last+uint32_t(last<style.count&&prefix(last)<offset+paint));
  // Estimates select bounded builder work, never accepted coverage. Content
  // measures the returned rows and recomputes the range before publication.
  // Avoid one App round trip per unknown row in an indexed variable list.
  end=std::min(end,begin+wire::limits::listChildren);
  if(!style.fixed)for(uint32_t i=begin;i<end;++i)if(!geometry||!geometry->measured.count(i)){end=std::min(end,i+8);break;}
  return {begin,end,prefix(begin)};
}
// Canonical Viewport defaults to 250 logical pixels of cache on each side.
// First cover the actual viewport, then extend bounded Source work. Estimates
// still select work only; the usual Content measurement validates coverage.
inline NativeListRange nativeListCacheRange(const ListStyle& style,const ListGeometry* geometry,double offset,double paint,double velocity=0) {
  const auto visible=nativeListRange(style,geometry,offset,paint);
  if(!geometry||paint==0||geometry->style.count!=style.count||geometry->style.generation!=style.generation)
    return visible;
  for(uint32_t i=visible.begin;i<visible.end;++i)if(!style.fixed&&!geometry->measured.count(i))return visible;
  if(visible.end<style.count&&geometry->prefix(visible.end)<offset+paint)return visible;
  constexpr double cache=250;
  // Native velocity is a prefetch hint, never a predicted layout/scroll offset.
  // Cover App/Content turnaround in the moving direction; retain the same row
  // budget and cap lookahead at two viewports so fast input cannot grow it unbounded.
  const double ahead=std::max(cache,std::min(paint*2,std::abs(velocity)*.35));
  const double trigger=std::max(cache/2,std::min(paint,std::abs(velocity)*.18));
  const double before=velocity<0?ahead:cache,after=velocity>0?ahead:cache;
  // During resumed layout, geometry can still describe the previous scene.
  // Keep the currently accepted Source window, not that superseded declaration.
  const auto& previous=style;
  const bool resident=previous.end>previous.begin&&previous.end-previous.begin<=wire::limits::listChildren;
  // Refill at half the cache distance, not on every row crossing. The retained
  // region must still contain the entire visible viewport in both directions.
  if(resident&&visible.begin>=previous.begin&&visible.end<=previous.end&&
      (previous.begin==0||geometry->prefix(previous.begin)<=std::max(0.0,offset-(velocity<0?trigger:cache/2)))&&
      (previous.end==style.count||geometry->prefix(previous.end)>=offset+paint+(velocity>0?trigger:cache/2)))
    return {previous.begin,previous.end,geometry->prefix(previous.begin)};
  auto range=nativeListRange(style,geometry,offset,paint+after);
  // Never spend the row budget behind the viewport at the expense of visible
  // rows. An unknown leading prefix is learned when it actually becomes visible.
  while(range.begin>0&&range.end-range.begin<wire::limits::listChildren&&
      geometry->prefix(range.begin)>std::max(0.0,offset-before)&&
      (style.fixed||geometry->measured.count(range.begin-1)))--range.begin;
  range.beginOffset=geometry->prefix(range.begin);
  // Keep a measured resident window while it contains the required cache.
  // Retiring rows on every small offset change causes needless App transactions.
  if(resident&&
      range.begin>=previous.begin&&range.end<=previous.end)
    return {previous.begin,previous.end,geometry->prefix(previous.begin)};
  return range;
}
}
