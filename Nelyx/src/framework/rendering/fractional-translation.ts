// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter rendering/proxy_box.dart at the recorded pin.
import {invariant} from '../../foundation/errors.ts';import {Offset as OffsetValue} from '../../ui/offset.ts';import {Matrix4} from '../../math/matrix4.ts';import {identity,inversePaintTransform,multiply,translate,transform} from '../../ui/geometry.ts';import type {Offset,TransformMatrix} from '../../ui/geometry.ts';import {RenderProxyBox} from './boxes.ts';import type {RenderBox,RenderObject,HitTestEntry} from './object.ts';
export interface RenderFractionalTranslationOptions {readonly translation:Offset;readonly transformHitTests?:boolean;readonly child?:RenderBox<RenderObject>}
function capture(value:Offset):OffsetValue{return value instanceof OffsetValue?value:new OffsetValue(value.x,value.y);}
export class RenderFractionalTranslation extends RenderProxyBox {
  private _translation:OffsetValue;private _transformHitTests:boolean;
  constructor({translation,transformHitTests=true,child}:RenderFractionalTranslationOptions){const value=capture(translation);invariant(typeof transformHitTests==='boolean','invalid-hit-transform','transformHitTests must be boolean');super();this._translation=value;this._transformHitTests=transformHitTests;if(child)this.insert(child);}
  get translation():OffsetValue{return this._translation;}set translation(value:Offset){this.assertCanMutateLayoutProperty();const next=capture(value);if(this._translation.equals(next))return;this._translation=next;if(this.hasDefaultPaintSemantics(RenderFractionalTranslation.prototype))this.markNeedsPaintAfterGeometryChange();else this.markNeedsPaint();}
  get transformHitTests():boolean{return this._transformHitTests;}set transformHitTests(value:boolean){this.assertCanMutateLayoutProperty();invariant(typeof value==='boolean','invalid-hit-transform','transformHitTests must be boolean');this._transformHitTests=value;}
  protected override childTransform(child:RenderObject):TransformMatrix{return multiply(translate(this.translation.dx*this.size.width,this.translation.dy*this.size.height),super.childTransform(child));}
  applyPaintTransform(_child:RenderBox<RenderObject>,matrix:Matrix4):void{matrix.translateByDouble(this.translation.dx*this.size.width,this.translation.dy*this.size.height,0,1);}
  override hitTest(position:Offset,result:HitTestEntry[],toLocal:TransformMatrix=identity):boolean{return this.hitTestChildren(position,result,toLocal);}
  hitTestChildren(position:Offset,result:HitTestEntry[],toLocal:TransformMatrix=identity):boolean{invariant(this.hasSize&&!this.needsLayout,'unlaid-fractional-hit','Fractional hit testing requires current layout');const child=this.child;if(!child)return false;const inverse=inversePaintTransform(this.transformHitTests?this.childTransform(child):super.childTransform(child));return !!inverse&&child.hitTest(transform(inverse,position),result,multiply(inverse,toLocal));}
}
