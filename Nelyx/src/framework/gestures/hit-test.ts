// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import type {PointerEvent} from './events.ts';
import type {Offset} from '../../ui/offset.ts';
import {captureTransform,multiply,translate} from '../../ui/geometry.ts';
import type {TransformMatrix} from '../../ui/geometry.ts';
import {matrix4Identity} from '../../ui/matrix4.ts';
import type {Matrix4Storage} from '../../ui/matrix4.ts';
import {invariant} from '../../foundation/errors.ts';
import {describeIdentity} from '../../foundation/diagnostics-identity.ts';
export interface HitTestable {hitTest(result:HitTestResult,position:Offset):void;hitTestInView(result:HitTestResult,position:Offset,viewId:number|string):void}
export interface HitTestDispatcher {dispatchEvent(event:PointerEvent,result:HitTestResult|null):void}
export interface HitTestTarget {handleEvent(event:PointerEvent,entry:HitTestEntry):void}
const nativeTargets=new WeakSet<object>();
export type HitTestTargetConstructor=abstract new (...args:any[])=>object;
/** The source marker mixin uses a private WeakSet, without inventing a native
 * platform-view provider. Its consumer must implement a concrete target. */
export function NativeHitTestTarget<Base extends HitTestTargetConstructor>(Base:Base):Base {
  abstract class NativeTarget extends Base {constructor(...args:any[]){super(...args);nativeTargets.add(this);}}
  return NativeTarget as Base;
}
export function isNativeHitTestTarget(target:HitTestTarget):boolean{return nativeTargets.has(target);}
type EntryTransform=TransformMatrix|MatrixTransformPart|DeferredTransform;
function resolveTransform(value:EntryTransform):TransformMatrix{return value instanceof DeferredTransform?value.value:value instanceof MatrixTransformPart?value.multiply(matrix4Identity):value;}
const entryTransforms=new WeakMap<HitTestEntry,EntryTransform>();
interface LegacyHitBridgeEntry {readonly target:HitTestTarget;readonly createSourceEntry?:()=>HitTestEntry;readonly onSourceEntry?:(entry:HitTestEntry)=>void}
const capturedLegacyTransforms=new WeakMap<LegacyHitBridgeEntry,{readonly part:TransformPart;readonly create:LegacyHitBridgeEntry['createSourceEntry'];readonly observe:LegacyHitBridgeEntry['onSourceEntry']}>();
function validateHitTransform(matrix:TransformMatrix):void{if(matrix.length===16){const epsilon=1e-10;invariant([2,6,8,9,11,14].every(index=>Math.abs(matrix[index]!)<epsilon)&&Math.abs(matrix[10]-1)<epsilon,'invalid-pointer-hit-transform','Pointer hit transforms require the isolated XY plane');}}
export class HitTestEntry<T extends HitTestTarget=HitTestTarget> {
  constructor(readonly target:T){}
  get transform():TransformMatrix|null{const value=entryTransforms.get(this);return value===undefined?null:resolveTransform(value);}
  toString():string{return describeIdentity(this)+'('+this.target+')';}
}
abstract class TransformPart {abstract multiply(rhs:TransformMatrix):TransformMatrix;}
class LegacyTransformPart extends TransformPart {
  private captured:MatrixTransformPart|undefined;
  constructor(private readonly source:EntryTransform,private readonly parent:TransformMatrix){super();}
  multiply(rhs:TransformMatrix):TransformMatrix{
    if(!this.captured){const matrix=multiply(resolveTransform(this.source),this.parent);validateHitTransform(matrix);this.captured=new MatrixTransformPart(matrix);}
    return this.captured.multiply(rhs);
  }
}
class MatrixTransformPart extends TransformPart {
  readonly matrix:TransformMatrix;
  private identityProduct:Matrix4Storage|undefined;
  constructor(matrix:TransformMatrix){super();this.matrix=captureTransform(matrix);}
  multiply(rhs:TransformMatrix):TransformMatrix{
    if(rhs!==matrix4Identity)return multiply(this.matrix,rhs);
    if(this.identityProduct)return this.identityProduct;
    // The part already captured finite values. Multiplication by the owned
    // identity only expands affine storage and normalizes -0 via initial +0.
    // Keep the source's 16-lane entry representation without a general product.
    const m=this.matrix,values=m.length===6?[0+m[0],0+m[1],0,0,0+m[2],0+m[3],0,0,0,0,1,0,0+m[4],0+m[5],0,1]:m.map(value=>0+value);
    return this.identityProduct=Object.freeze(values) as Matrix4Storage;
  }
}
class OffsetTransformPart extends TransformPart {
  constructor(readonly offset:Offset){super();}
  multiply(rhs:TransformMatrix):TransformMatrix{return multiply(translate(this.offset.dx,this.offset.dy),rhs);}
}
/** Internal render bridges have no source callbacks until the final path is
 * admitted. Capture their immutable parts now and multiply only consumed paths.
 * Each link belongs to this result, never to a global render-tree cache. */
class DeferredTransform {
  private resolved:TransformMatrix|undefined;
  constructor(private readonly part:TransformPart,private readonly previous:EntryTransform){}
  get value():TransformMatrix{return this.resolved??=this.part.multiply(resolveTransform(this.previous));}
}
interface ResultState {readonly path:HitTestEntry[];readonly transforms:EntryTransform[];readonly localTransforms:TransformPart[];readonly deferTransformProducts:boolean}
/** Wrapped results share the building state. The exposed path is a readonly
 * snapshot so a handler cannot mutate an already admitted dispatch iteration. */
export class HitTestResult {
  private readonly state:ResultState;
  constructor(wrapped?:HitTestResult,/** @internal Only bridges without immediate source callbacks. */deferTransformProducts=false){this.state=wrapped?.state??{path:[],transforms:[matrix4Identity],localTransforms:[],deferTransformProducts};}
  static wrap(result:HitTestResult):HitTestResult{return new HitTestResult(result);}
  /** @internal Only the captured sliver bridge can defer its immutable path. */
  protected captureLegacyTransform(legacy:LegacyHitBridgeEntry,entry:HitTestEntry,parent:TransformMatrix):void{
    if(Object.getPrototypeOf(entry)!==HitTestEntry.prototype||Object.hasOwn(entry,'transform'))return;
    const source=entryTransforms.get(entry);invariant(source!==undefined,'missing-hit-transform','Legacy bridge requires an admitted source entry');
    capturedLegacyTransforms.set(legacy,{part:new LegacyTransformPart(source,captureTransform(parent)),create:legacy.createSourceEntry,observe:legacy.onSourceEntry});
  }
  /** Preserve entry kinds and custom callback order on the conservative path. */
  protected addCapturedLegacyEntry(legacy:LegacyHitBridgeEntry):boolean{
    const captured=capturedLegacyTransforms.get(legacy);if(!captured||captured.create!==legacy.createSourceEntry||captured.observe!==legacy.onSourceEntry)return false;
    const entry=legacy.createSourceEntry?.()??new HitTestEntry(legacy.target);invariant(entry.target===legacy.target&&entry.transform===null,'invalid-source-hit-entry','Render hit entry factory must create a fresh entry for its actual target');
    entryTransforms.set(entry,new DeferredTransform(captured.part,this.lastTransform));this.state.path.push(entry);legacy.onSourceEntry?.(entry);return true;
  }
  get path():readonly HitTestEntry[]{return Object.freeze([...this.state.path]);}
  private globalizeTransforms():void {if(!this.state.localTransforms.length)return;let last=this.state.transforms[this.state.transforms.length-1]!;for(const part of this.state.localTransforms){last=this.state.deferTransformProducts?new DeferredTransform(part,last):part.multiply(resolveTransform(last));this.state.transforms.push(last);}this.state.localTransforms.length=0;}
  private get lastTransform():EntryTransform {this.globalizeTransforms();const last=this.state.transforms[this.state.transforms.length-1]!;return this.state.deferTransformProducts?last:resolveTransform(last);}
  add(entry:HitTestEntry):void {
    invariant(entry.transform===null,'reused-hit-test-entry','A HitTestEntry can only be added once');
    const local=this.state.localTransforms,part=local.length===1?local[0]:undefined,last=this.state.transforms[this.state.transforms.length-1]!;let transform:EntryTransform;
    // A captured finite matrix times identity cannot fail or observe later
    // caller mutations. Unconsumed targets keep that immutable part until read.
    // Other products still globalize now, preserving failure/offset semantics.
    if(!local.length)transform=last;
    else if(part instanceof MatrixTransformPart&&last===matrix4Identity){transform=part;this.state.transforms.push(part);local.length=0;}
    else transform=this.lastTransform;
    entryTransforms.set(entry,transform);this.state.path.push(entry);
  }
  protected pushTransform(matrix:TransformMatrix):void {
    validateHitTransform(matrix);
    this.state.localTransforms.push(new MatrixTransformPart(matrix));
  }
  protected pushOffset(offset:Offset):void {this.state.localTransforms.push(new OffsetTransformPart(offset));}
  protected popTransform():void {if(this.state.localTransforms.length){this.state.localTransforms.pop();return;}invariant(this.state.transforms.length>1,'unbalanced-hit-transform','Cannot pop the base hit-test transform');this.state.transforms.pop();}
  toString():string{return 'HitTestResult('+(this.state.path.length?this.state.path.join(', '):'<empty path>')+')';}
}
