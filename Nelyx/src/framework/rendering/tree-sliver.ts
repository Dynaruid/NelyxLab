// SPDX-License-Identifier: BSD-3-Clause
// Reviewed corrections to pinned sliver_tree.dart, keeping its entire generated
// base intact. Raw source parity and corrected product contracts have separate gates.
import {SourceRenderTreeSliver} from './sliver-tree.generated.ts';
import type {RenderBox} from './object.ts';
import type {SliverHitTestResult,SliverHitPosition} from './sliver.ts';
import type {PaintingContext} from '../painting/context.ts';
import {Rect} from '../../ui/rect.ts';
import type {UniqueKey} from '../../foundation/key.ts';
import type {Offset} from '../../ui/offset.ts';
import {dartNamedRecordRead} from '../../foundation/dart-named-record.ts';
import {withTreePaintScrollOffset,treeVisibleAnimationIndices,fixedTreeExtent} from './tree-sliver-source-adapter.ts';
import {invariant} from '../../foundation/errors.ts';
import {precisionErrorTolerance} from '../../foundation/constants.ts';
import {castSourceDartInt,castSourceDartDouble,boxSourceDartInt,boxSourceDartDouble} from '../../foundation/dart-numeric.ts';

export class RenderTreeSliver extends SourceRenderTreeSliver{
  // The generated source captures a cache-limited travel distance once per
  // animation key. Retain that raw prefix and compose only nested displacement:
  // each descendant's own collapsed distance is subtracted once from an
  // ancestor's distance, before applying that ancestor's animation value.
  private readonly baseDistances=new Map<UniqueKey,{from:number;end:number;prefix:number[];position:number}>();
  private readonly previousRanges=new Map<UniqueKey,string>();
  private range(key:UniqueKey):{from:number;to:number;value:number}{const r=this.activeAnimations.get(key)!;return{from:castSourceDartInt(dartNamedRecordRead(r,'fromIndex',0,['fromIndex','toIndex','value'])),to:castSourceDartInt(dartNamedRecordRead(r,'toIndex',0,['fromIndex','toIndex','value'])),value:castSourceDartDouble(dartNamedRecordRead(r,'value',0,['fromIndex','toIndex','value']))};}
  private nestedKeys(key:UniqueKey,directOnly=true):UniqueKey[]{
    const parent=this.range(key),all=[...this.activeAnimations.keys].filter(child=>{if(child===key)return false;const r=this.range(child);return r.from>parent.from&&r.to<=parent.to;}).sort((a,b)=>this.range(a).from-this.range(b).from),direct:UniqueKey[]=[];let end=-1;
    if(!directOnly)return all;for(const child of all){const r=this.range(child);if(r.from<=end)continue;direct.push(child);end=r.to;}return direct;
  }
  // A source active-list change shifts ranges. Distances from the old topology
  // cannot survive; ordinary value/scroll changes retain the captured prefix.
  override _dart_7b9586d3cedbce5e_updateAnimationCache():void{
    let moved=false;for(const key of this.activeAnimations.keys){const r=this.range(key),identity=r.from+':'+r.to;if(this.previousRanges.has(key)&&this.previousRanges.get(key)!==identity)moved=true;}
    if(moved){this.baseDistances.clear();this._dart_7b9586d3cedbce5e_animationOffsets.clear();}
    const snapshot=[...this.previousRanges.keys()];
    for(const key of snapshot)if(this.activeAnimations.get(key)===null){this.previousRanges.delete(key);this.baseDistances.delete(key);}
    for(const key of this.activeAnimations.keys){const r=this.range(key);this.previousRanges.set(key,r.from+':'+r.to);const base=this.baseDistances.get(key);if(base)this._dart_7b9586d3cedbce5e_animationOffsets.set(key,boxSourceDartDouble(base.prefix.at(-1)!));}
    super._dart_7b9586d3cedbce5e_updateAnimationCache();
    for(const [key,base]of this.baseDistances)this.ensureNestedDistances(key,base.position);
    this.composeDistances();
  }
  /**
   * @dartParam position double
   * @dartParamOrigin position explicit
   */
  override _dart_7b9586d3cedbce5e_computeAnimationOffsetFor(key:UniqueKey,position:number):void{
    if(!this.baseDistances.has(key)){
      super._dart_7b9586d3cedbce5e_computeAnimationOffsetFor(key,position);
      const r=this.range(key),prefix=[0],target=this.constraints.scrollOffset+this.constraints.remainingCacheExtent;let cursor=position,index=r.from;
      while(index<=r.to&&cursor<target){const extent=this.itemExtentBuilder(index,this.layoutDimensions)!;prefix.push(prefix.at(-1)!+extent);cursor+=extent;index++;}
      this.baseDistances.set(key,{from:r.from,end:index-1,prefix,position});
      this.ensureNestedDistances(key,position);
    }
    this.composeDistances();
  }
  private ensureNestedDistances(key:UniqueKey,position:number):void{
    const parent=this.range(key);for(const child of this.nestedKeys(key)){if(this.baseDistances.has(child))continue;const r=this.range(child);let childPosition=position;for(let index=parent.from-1;index<r.from-1;index++)childPosition+=this.itemExtentBuilder(index,this.layoutDimensions)!;this._dart_7b9586d3cedbce5e_computeAnimationOffsetFor(child,childPosition);}
  }
  private visibleDistance(key:UniqueKey,end:number,cache:Map<UniqueKey,Map<number,number>>):number{
    const base=this.baseDistances.get(key);if(!base)return 0;const limit=Math.min(end,base.end);if(limit<base.from)return 0;const previous=cache.get(key)?.get(limit);if(previous!==undefined)return previous;let distance=base.prefix[limit-base.from+1]!;
    for(const child of this.nestedKeys(key,false)){const r=this.range(child);if(r.from<=limit)distance-=this.visibleDistance(child,limit,cache)*(1-r.value);}const value=Math.max(0,distance);let memo=cache.get(key);if(!memo){memo=new Map();cache.set(key,memo);}memo.set(limit,value);return value;
  }
  private composeDistances():void{const cache=new Map<UniqueKey,Map<number,number>>();for(const key of this.baseDistances.keys())this._dart_7b9586d3cedbce5e_animationOffsets.set(key,boxSourceDartDouble(this.visibleDistance(key,Infinity,cache)));}
  // Inner segments must also respect every enclosing parent's trailing edge.
  // The source painter still owns traversal, clip handles and layer retirement.
  private clipStart(parent:number):number{
    let start=this.indexToLayoutOffset(0,parent)+this.itemExtentBuilder(parent,this.layoutDimensions)!;
    for(const key of this.activeAnimations.keys){const r=this.range(key);if(r.from<=parent&&parent<=r.to){const ancestor=r.from-1;start=Math.max(start,this.indexToLayoutOffset(0,ancestor)+this.itemExtentBuilder(ancestor,this.layoutDimensions)!);}}return start;
  }
  override dispose():void{try{super.dispose();}finally{this.baseDistances.clear();this.previousRanges.clear();}}
  private get fixedExtent():number|null{return this.activeAnimations.isEmpty&&this.childManager.estimatedChildCount!==null?fixedTreeExtent(this.itemExtentBuilder):null;}
  /** Explicit constant-row facade specialization; all variable/animated paths
   * continue through the complete source algorithm and reviewed correction. */
  /**
   * @dartParam itemExtent double
   * @dartParamOrigin itemExtent explicit
   * @dartParam index int
   * @dartParamOrigin index explicit
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  override indexToLayoutOffset(itemExtent:number,index:number):number{
    const extent=this.fixedExtent;if(extent===null)return super.indexToLayoutOffset(itemExtent,index);
    return Math.max(0,Math.min(index,this.childManager.estimatedChildCount!))*extent;
  }
  /**
   * @dartParam scrollOffset double
   * @dartParamOrigin scrollOffset explicit
   * @dartParam itemExtent double
   * @dartParamOrigin itemExtent explicit
   * @dartReturn int
   * @dartReturnOrigin explicit
   */
  override getMinChildIndexForScrollOffset(scrollOffset:number,itemExtent:number):number{
    const extent=this.fixedExtent;if(extent===null)return super.getMinChildIndexForScrollOffset(scrollOffset,itemExtent);
    const exact=scrollOffset/extent,rounded=Math.round(exact),index=Math.abs(scrollOffset-rounded*extent)<precisionErrorTolerance?rounded:Math.floor(exact);
    return Math.max(0,Math.min(index,this.childManager.estimatedChildCount!-1));
  }
  /**
   * @dartParam scrollOffset double
   * @dartParamOrigin scrollOffset explicit
   * @dartParam itemExtent double
   * @dartParamOrigin itemExtent explicit
   * @dartReturn int
   * @dartReturnOrigin explicit
   */
  override getMaxChildIndexForScrollOffset(scrollOffset:number,itemExtent:number):number{
    const extent=this.fixedExtent;if(extent===null)return super.getMaxChildIndexForScrollOffset(scrollOffset,itemExtent);
    const exact=scrollOffset/extent,rounded=Math.round(exact),index=Math.abs(scrollOffset-rounded*extent)<precisionErrorTolerance?rounded-1:Math.ceil(exact)-1;
    return Math.max(0,Math.min(index,this.childManager.estimatedChildCount!-1));
  }
  /** @dartParam scrollOffset double
   * @dartReturn int */
  override _dart_7b9586d3cedbce5e_getChildIndexForScrollOffset(scrollOffset:number):number{
    if(scrollOffset===0)return 0;
    let position=0,index=0;
    const count=this.childManager.estimatedChildCount;
    while(position<scrollOffset){
      if(count!==null&&index>=count)break;
      invariant(index<1_000_000,'tree-extent-query-budget','Tree extent builder exceeded the Core varied-extent query budget');
      const extent=this.itemExtentBuilder(index,this.layoutDimensions);
      if(extent===null)break;
      const key=this._dart_7b9586d3cedbce5e_animationLeadingIndices.get(boxSourceDartInt(index));
      let collapsed=0;
      if(key!==null){
        if(this._dart_7b9586d3cedbce5e_animationOffsets.get(key)===null)this._dart_7b9586d3cedbce5e_computeAnimationOffsetFor(key,position);
        const animation=this.activeAnimations.get(key)!;
        collapsed=castSourceDartDouble(this._dart_7b9586d3cedbce5e_animationOffsets.get(key)!)*(1-castSourceDartDouble(dartNamedRecordRead(animation,'value',0,['fromIndex','toIndex','value'])));
      }
      position+=extent;
      ++index;
      // The parent row remains visible; collapse shifts only the following rows.
      if(position>=scrollOffset)break;
      // Apply each segment's collapsed distance once, not once per later child.
      position-=collapsed;
    }
    return Math.max(0,index-1);
  }
  override sourcePaint(context:PaintingContext,offset:Offset):void{
    const first=this.firstChild,last=this.lastChild;
    const range=first&&last?{first:this.indexOf(first),last:this.indexOf(last)}:undefined,parents=range?treeVisibleAnimationIndices(this._dart_7b9586d3cedbce5e_animationLeadingIndices.keys.map(castSourceDartInt),range).sort((a,b)=>a-b):[];let clipIndex=0;
    withTreePaintScrollOffset(context,this.constraints.scrollOffset,()=>super.sourcePaint(context,offset),range,()=>{const parent=parents[clipIndex]!,trailing=parents[++clipIndex]??this.indexOf(last!),start=this.clipStart(parent),end=this.indexToLayoutOffset(0,trailing)+this.itemExtentBuilder(trailing,this.layoutDimensions)!;return Rect.fromLTWH(0,start,this.constraints.crossAxisExtent,Math.max(0,end-start));});
  }
  protected override hitTestBoxChild(result:SliverHitTestResult,child:RenderBox,position:SliverHitPosition):boolean{
    // Use the same parent-delimited segments as the generated source painter.
    const index=this.indexOf(child),parents=treeVisibleAnimationIndices(this._dart_7b9586d3cedbce5e_animationLeadingIndices.keys.map(castSourceDartInt),{first:this.indexOf(this.firstChild!),last:this.indexOf(this.lastChild!)}).sort((a,b)=>a-b);
    let parent:number|null=null,trailing=this.indexOf(this.lastChild!);
    for(const boundary of parents){if(boundary<index)parent=boundary;else{trailing=boundary;break;}}
    if(parent!==null){
      const leading=this.clipStart(parent);
      const end=this.indexToLayoutOffset(0,trailing)+this.itemExtentBuilder(trailing,this.layoutDimensions)!;
      const main=position.mainAxisPosition+this.constraints.scrollOffset;
      if(main<leading||main>=end)return false;
    }
    return super.hitTestBoxChild(result,child,position);
  }
}
