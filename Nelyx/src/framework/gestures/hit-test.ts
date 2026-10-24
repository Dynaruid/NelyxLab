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
type EntryTransform=TransformMatrix|MatrixTransformPart;
const entryTransforms=new WeakMap<HitTestEntry,EntryTransform>();
export class HitTestEntry<T extends HitTestTarget=HitTestTarget> {
  constructor(readonly target:T){}
  get transform():TransformMatrix|null{const value=entryTransforms.get(this);return value instanceof MatrixTransformPart?value.multiply(matrix4Identity):value??null;}
  toString():string{return describeIdentity(this)+'('+this.target+')';}
}
abstract class TransformPart {abstract multiply(rhs:TransformMatrix):TransformMatrix;}
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
interface ResultState {readonly path:HitTestEntry[];readonly transforms:EntryTransform[];readonly localTransforms:TransformPart[]}
/** Wrapped results share the building state. The exposed path is a readonly
 * snapshot so a handler cannot mutate an already admitted dispatch iteration. */
export class HitTestResult {
  private readonly state:ResultState;
  constructor(wrapped?:HitTestResult){this.state=wrapped?.state??{path:[],transforms:[matrix4Identity],localTransforms:[]};}
  static wrap(result:HitTestResult):HitTestResult{return new HitTestResult(result);}
  get path():readonly HitTestEntry[]{return Object.freeze([...this.state.path]);}
  private globalizeTransforms():void {if(!this.state.localTransforms.length)return;let last=this.resolveTransform(this.state.transforms[this.state.transforms.length-1]!);for(const part of this.state.localTransforms){last=part.multiply(last);this.state.transforms.push(last);}this.state.localTransforms.length=0;}
  private resolveTransform(value:EntryTransform):TransformMatrix{return value instanceof MatrixTransformPart?value.multiply(matrix4Identity):value;}
  private get lastTransform():TransformMatrix {this.globalizeTransforms();return this.resolveTransform(this.state.transforms[this.state.transforms.length-1]!);}
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
    if(matrix.length===16){const epsilon=1e-10;invariant([2,6,8,9,11,14].every(index=>Math.abs(matrix[index]!)<epsilon)&&Math.abs(matrix[10]-1)<epsilon,'invalid-pointer-hit-transform','Pointer hit transforms require the isolated XY plane');}
    this.state.localTransforms.push(new MatrixTransformPart(matrix));
  }
  protected pushOffset(offset:Offset):void {this.state.localTransforms.push(new OffsetTransformPart(offset));}
  protected popTransform():void {if(this.state.localTransforms.length){this.state.localTransforms.pop();return;}invariant(this.state.transforms.length>1,'unbalanced-hit-transform','Cannot pop the base hit-test transform');this.state.transforms.pop();}
  toString():string{return 'HitTestResult('+(this.state.path.length?this.state.path.join(', '):'<empty path>')+')';}
}
