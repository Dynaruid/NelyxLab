// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2026 phantom. All rights reserved.
// Adapted from Doroti RenderSectionList. See licenses/section-list-sources.json.
import {RenderSliverMultiBoxAdaptor,SliverMultiBoxAdaptorParentData} from './sliver-multi-box-adaptor.ts';
import type {RenderSliverBoxChildManager} from './sliver-multi-box-adaptor.ts';
import {SliverGeometry} from './sliver.ts';
import type {SliverConstraints} from './sliver.ts';
import {SectionExtentIndex} from './section-extent-index.ts';
import type {SectionExtentEnvironment} from './section-extent-index.ts';
import {invariant} from '../../foundation/errors.ts';
import type {PipelineOwner} from './object.ts';

/** Indexed variable-height layout with the canonical lazy child/keep-alive
 * owner. Far seeks materialize the destination cache range, not intervening
 * sections. Ordinary offscreen State follows the delegate's keep-alive policy. */
export class RenderSliverSectionList extends RenderSliverMultiBoxAdaptor {
  private index:SectionExtentIndex;private revision:object|null;private configured=false;
  private environment:SectionExtentEnvironment|null;
  private readonly changed=()=>this.markNeedsLayout();
  constructor({childManager,extentIndex,metricRevision=null,environment=null}:{readonly childManager:RenderSliverBoxChildManager;readonly extentIndex:SectionExtentIndex;readonly metricRevision?:object|null;readonly environment?:SectionExtentEnvironment|null}){
    super({childManager});this.index=extentIndex;this.revision=metricRevision;this.environment=environment;
  }
  override attach(owner:PipelineOwner):void{this.index._attach(this.changed);try{super.attach(owner);}catch(error){if(!this.attached)this.index._detach(this.changed);throw error;}}
  override detach():void{try{super.detach();}finally{if(!this.attached)this.index._detach(this.changed);}}
  update(extentIndex:SectionExtentIndex,metricRevision:object|null,environment:SectionExtentEnvironment|null=null):void{
    this.assertCanMutateLayoutProperty();
    if(this.index!==extentIndex){if(this.attached)extentIndex._attach(this.changed);this.index._detach(this.changed);this.index=extentIndex;this.configured=false;}
    this.revision=metricRevision;this.environment=environment;this.markNeedsLayout();
  }
  override dispose():void{try{super.dispose();}finally{if(this.debugDisposed)this.index._detach(this.changed);}}
  protected override performLayout(_constraints:SliverConstraints):void{
    const c=this.constraints;this.childManager.didStartLayout();this.childManager.setDidUnderflow(false);
    // The canonical manager flushes queued Widget updates in didStartLayout;
    // that callback can replace this index and the metric environment.
    const index=this.index;
    invariant(this.childManager.estimatedChildCount===index.count,'section-count-mismatch','Section delegate count must match its extent index');
    if(index.count===0){this.collectGarbage(this.childCount,0);this.geometry=SliverGeometry.zero;this.childManager.didFinishLayout();return;}
    const oldAnchor=index.indexAtOffset(c.scrollOffset),oldInside=c.scrollOffset-index.prefix(oldAnchor),changed=index._configure(c.crossAxisExtent,this.revision,this.environment,c.axis);
    const request=index._takeRequest()??(this.configured&&changed?{index:oldAnchor,offset:oldInside}:null);this.configured=true;
    if(request){const correction=index.prefix(request.index)+request.offset-c.scrollOffset;if(Math.abs(correction)>.001){this.geometry=new SliverGeometry({scrollOffsetCorrection:correction});return;}}
    const cacheOrigin=this.childManager.boundedChildren?0:c.cacheOrigin,remainingExtent=this.childManager.boundedChildren?c.remainingPaintExtent:c.remainingCacheExtent;
    const prepared=this.childManager.boundedChildren?this.childManager.preparationIndex:null;
    const anchor=index.indexAtOffset(c.scrollOffset),inside=c.scrollOffset-index.prefix(anchor),requiredStart=index.indexAtOffset(Math.max(0,c.scrollOffset+cacheOrigin)),start=prepared==null?requiredStart:Math.min(requiredStart,prepared),target=c.scrollOffset+cacheOrigin+remainingExtent;
    invariant(Number.isFinite(target)&&target>=0,'invalid-section-cache-range','Section lists require a finite viewport/cache extent');
    // Prepend the missing leading range without retiring overlapping State.
    // A far seek still creates only its destination; trailing collection drops
    // the old disjoint range after actual coverage has been measured.
    if(this.firstChild!==null)this.collectGarbage(this.calculateLeadingGarbage({firstIndex:start}),0);
    // Keyed remapping can leave a hole at the cache's leading edge even when
    // start was inside the previous active range. Materialize that exact slot;
    // the next retained child is not necessarily the requested starting index.
    if(this.firstChild!==null&&this.indexOf(this.firstChild)!==start)this._createOrObtainChild(start,{after:null});
    if(this.firstChild===null)invariant(this.addInitialChild({index:start,layoutOffset:index.prefix(start)}),'missing-section-child','Section builder must provide every indexed section');
    let child=this.firstChild!,end=index.prefix(start),last=start;const box=c.asBoxConstraints();
    for(let i=start;i<index.count;i++){
      if(i===start)child.layout(box,{parentUsesSize:true});else{let next=this.childAfter(child);if(next===null||this.indexOf(next)!==i)next=this.insertAndLayoutChild(box,{after:child,parentUsesSize:true});if(next===null||this.indexOf(next)!==i)invariant(false,'missing-section-child',`Section builder must provide indexed section ${i} (received ${next===null?'null':this.indexOf(next)}, start=${start}, count=${index.count}, offset=${c.scrollOffset})`);next.layout(box,{parentUsesSize:true});child=next;}
      (child.parentData as SliverMultiBoxAdaptorParentData).layoutOffset=end;const extent=this.paintExtentOf(child);index._measure(i,extent);end+=extent;last=i;if(end>=target&&i>=anchor&&(prepared==null||i>=prepared))break;
      // A run of zero-height/off-cache children must not consume the owner's
      // active-child budget while locating the first visible section.
      if(this.childCount>=128&&end<=c.scrollOffset+cacheOrigin)this.collectGarbage(this.childCount-1,0);
    }
    this.collectGarbage(0,this.calculateTrailingGarbage({lastIndex:last}));
    const correction=index.prefix(anchor)+inside-c.scrollOffset;if(Math.abs(correction)>.001){this.geometry=new SliverGeometry({scrollOffsetCorrection:correction});return;}
    index._didLayout(anchor,inside);const total=index.totalExtent;
    this.geometry=new SliverGeometry({scrollExtent:total,maxPaintExtent:total,paintExtent:this.calculatePaintOffset(c,{from:index.prefix(start),to:end}),cacheExtent:this.calculateCacheOffset(c,{from:index.prefix(start),to:end}),hasVisualOverflow:c.scrollOffset>0||end>c.scrollOffset+c.remainingPaintExtent});
    this.childManager.setDidUnderflow(last===index.count-1);this.childManager.didFinishLayout();
  }
}
