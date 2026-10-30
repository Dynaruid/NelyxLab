// SPDX-License-Identifier: BSD-3-Clause
import {RenderSliverVariedExtentList} from './sliver-fixed-extent-list.ts';
import type {PaintingContext} from '../painting/context.ts';
import {Offset} from '../../ui/offset.ts';
import {LayerHandle,ClipRectLayer} from './layer.ts';
import {UniqueKey} from '../../foundation/key.ts';
import {DartMap} from '../../foundation/dart-collections.ts';
import {checkedInteger} from '../../ui/value-math.ts';
import {AxisDirection} from '../painting/basic-types.ts';
import type {Rect} from '../../ui/rect.ts';
import {wheelPushClipRect} from './list-wheel-renderer-adapter.ts';
import {DartInt,DartDouble,castSourceDartInt,castSourceDartDouble,isDartNumeric,requireDartNumericProvenance} from '../../foundation/dart-numeric.ts';
import {dartValueEquals,dartValueHash} from '../../foundation/dart-value.ts';
import {createDartList} from '../../foundation/dart-mutable-list.ts';
import {dartIntType} from '../../foundation/dart-type-witness.ts';
export type TreeSourceList<T>=T[];
const fixedTreeExtents=new WeakMap<Function,number>();
/** Only an explicitly fixed public facade builder may register this contract. */
export function registerFixedTreeExtent(builder:Function,extent:number):void{
  if(!Number.isFinite(extent)||extent<=0)throw new TypeError('Fixed tree extent must be finite and positive');fixedTreeExtents.set(builder,extent);
}
export function fixedTreeExtent(builder:Function):number|null{return fixedTreeExtents.get(builder)??null;}
/** Core owns construction/layout; the complete generated source owns painting. */
export abstract class TreeRenderHost extends RenderSliverVariedExtentList{
  abstract sourcePaint(context:PaintingContext,offset:Offset):void;
  // Retain the source's animation clip layers in the Core scene graph.
  get needsCompositing():boolean{return true;}
  protected override performLayout():void{super.performLayout(this.constraints);}
  override paint(context:PaintingContext):void{this.sourcePaint(context,Offset.zero);}
}
const paintClipTransforms=new WeakMap<PaintingContext,(rect:Rect)=>Rect>();
const paintScrollOffsets=new WeakMap<PaintingContext,number>();
export interface TreePaintRange{readonly first:number;readonly last:number}
let paintRange:TreePaintRange|undefined;
/** Keep the segment owning the first child and subsequent materialized segments.
 * Off-cache segments have no paintable children or initialized extent cache. */
export function treeVisibleAnimationIndices(values:Iterable<number>,range:TreePaintRange):number[]{
  const all=[...values];let preceding:number|undefined;
  for(const value of all)if(value<range.first&&(preceding===undefined||value>preceding))preceding=value;
  return all.filter(value=>value===preceding||value>=range.first&&value<range.last);
}
export function treePaintAnimationIndices(values:Iterable<DartInt>):DartInt[]{
  const all=[...values],indices=all.map(castSourceDartInt),visible=paintRange?new Set(treeVisibleAnimationIndices(indices,paintRange)):null;
  return createDartList(dartIntType,visible?all.filter(value=>visible.has(castSourceDartInt(value))):all);
}
/** Raw generated source leaves the scope absent; the reviewed correction owns it.
 * Restore nested/reentrant paint scopes, including when painting throws. */
export function withTreePaintScrollOffset(context:PaintingContext,scrollOffset:number,paint:()=>void,range?:TreePaintRange,transformClip?:(rect:Rect)=>Rect):void{
  const previous=paintScrollOffsets.get(context),previousRange=paintRange,previousClip=paintClipTransforms.get(context);if(transformClip)paintClipTransforms.set(context,transformClip);else paintClipTransforms.delete(context);paintScrollOffsets.set(context,scrollOffset);paintRange=range;
  try{paint();}finally{if(previousClip)paintClipTransforms.set(context,previousClip);else paintClipTransforms.delete(context);paintRange=previousRange;if(previous===undefined)paintScrollOffsets.delete(context);else paintScrollOffsets.set(context,previous);}
}
export function treePushClipRect(context:PaintingContext,needsCompositing:boolean,offset:Offset,rect:Rect,painter:(context:PaintingContext,offset:Offset)=>void,options:{oldLayer?:ClipRectLayer|null}={}):ClipRectLayer|null{
  const scrollOffset=paintScrollOffsets.get(context)??0;
  return wheelPushClipRect(context,needsCompositing,offset,(paintClipTransforms.get(context)?.(rect)??rect).shift(new Offset(0,-scrollOffset)),painter,options);
}
const keyPolicy={accepts:(v:unknown):v is UniqueKey=>v instanceof UniqueKey,hash:(v:unknown)=>v,equals:(a:UniqueKey,b:unknown)=>a===b};
const indexPolicy={accepts:(v:unknown):v is DartInt=>{castSourceDartInt(v);return true;},validQuery:(v:unknown)=>{requireDartNumericProvenance(v);return isDartNumeric(v);},hash:dartValueHash,equals:dartValueEquals};
export function treeIndexKeyMap():DartMap<DartInt,UniqueKey>{return new DartMap(indexPolicy,keyPolicy.accepts);}
export function treeKeyOffsetMap():DartMap<UniqueKey,DartDouble>{return new DartMap(keyPolicy,(v):v is DartDouble=>{castSourceDartDouble(v);return true;});}
export function treeKeyClipMap():DartMap<UniqueKey,LayerHandle<ClipRectLayer>>{return new DartMap(keyPolicy,(v):v is LayerHandle<ClipRectLayer>=>v instanceof LayerHandle&&(v.layer===null||v.layer instanceof ClipRectLayer));}
export function treeClipHandle():LayerHandle<ClipRectLayer>{return new LayerHandle<ClipRectLayer>();}
/** Selected tree maps use side-effect-free integer/UniqueKey key policies.
 * Validate callback structural mutation before each removal; later callbacks see
 * earlier removals and value replacements, matching Dart Map.removeWhere. */
export function treeMapRemoveWhere<K,V>(map:DartMap<K,V>,test:(key:K,value:V)=>boolean):void{
  map.checkMutable();
  const snapshot=[...map.keys];
  for(const key of snapshot){
    const guard=map.keys[Symbol.iterator](),remove=test(key,map.get(key)!);
    guard.next();
    if(remove)map.remove(key);
  }
}
export function treeListAdd<T>(list:T[],value:T):void{list.push(value);}
export function treeListRemoveAt<T>(list:T[],index:number):T{
  checkedInteger(index);if(index<0||index>=list.length)throw new RangeError('Tree source list index is out of range');
  return list.splice(index,1)[0]!;
}
export function treeSortIndices(list:DartInt[]):void{for(const index of list)castSourceDartInt(index);list.sort((a,b)=>castSourceDartInt(a)-castSourceDartInt(b));}
export function treeListNotEmpty(list:readonly unknown[]):boolean{return list.length>0;}
export function treeAxisString(value:unknown):string{
  if(value instanceof AxisDirection&&AxisDirection.values.includes(value))return value.toString();
  throw new TypeError('Invalid source tree axis direction');
}
