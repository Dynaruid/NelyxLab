// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter rendering/rotated_box.dart at the recorded upstream pin.
import {invariant} from '../../foundation/errors.ts';import {Matrix4} from '../../math/matrix4.ts';import {captureTransform,identity,inversePaintTransform,multiply,transform,fullTransform} from '../../ui/geometry.ts';import type {Size,Offset,TransformMatrix} from '../../ui/geometry.ts';import {RenderBox} from './object.ts';import type {RenderObject,TextBaseline,HitTestEntry} from './object.ts';import {BoxConstraints} from './constraints.ts';import type {PaintingContext} from '../painting/context.ts';
const _kQuarterTurnsInRadians=Math.PI/2;
export interface RenderRotatedBoxOptions {readonly quarterTurns:number;readonly child?:RenderBox<RenderObject>}
function turns(value:number):number{invariant(Number.isSafeInteger(value),'invalid-quarter-turns','Quarter turns must be a safe integer');return value===0?0:value;}
export class RenderRotatedBox extends RenderBox {
  private _quarterTurns:number;private _paintTransform:TransformMatrix|undefined;
  protected override get childCountLimit():number{return 1;}
  constructor({quarterTurns,child}:RenderRotatedBoxOptions){const value=turns(quarterTurns);super();this._quarterTurns=value;if(child)this.insert(child);}
  get child():RenderBox<RenderObject>|undefined{return this.children[0];}set child(value:RenderBox<RenderObject>|undefined){this.assertCanMutateLayoutProperty();this.setChildren(value?[value]:[]);}
  get quarterTurns():number{return this._quarterTurns;}set quarterTurns(value:number){this.assertCanMutateLayoutProperty();value=turns(value);if(this._quarterTurns===value)return;this._quarterTurns=value;this.markNeedsLayout();}
  private get _isVertical():boolean{return Math.abs(this.quarterTurns%2)===1;}
  protected override computeMinIntrinsicWidth(height:number):number{return this.child?(this._isVertical?this.child.getMinIntrinsicHeight(height):this.child.getMinIntrinsicWidth(height)):0;}
  protected override computeMaxIntrinsicWidth(height:number):number{return this.child?(this._isVertical?this.child.getMaxIntrinsicHeight(height):this.child.getMaxIntrinsicWidth(height)):0;}
  protected override computeMinIntrinsicHeight(width:number):number{return this.child?(this._isVertical?this.child.getMinIntrinsicWidth(width):this.child.getMinIntrinsicHeight(width)):0;}
  protected override computeMaxIntrinsicHeight(width:number):number{return this.child?(this._isVertical?this.child.getMaxIntrinsicWidth(width):this.child.getMaxIntrinsicHeight(width)):0;}
  protected override computeDryLayout(c:BoxConstraints):Size{if(!this.child)return c.smallest;const size=this.child.getDryLayout(this._isVertical?c.flipped:c);return this._isVertical?{width:size.height,height:size.width}:size;}
  protected override computeDryBaseline(_c:BoxConstraints,_b:TextBaseline):never{throw new Error('RenderRotatedBox does not support dry baseline calculation');}
  protected override performLayout(c:BoxConstraints):Size{this._paintTransform=undefined;if(!this.child)return c.smallest;const child=this.child;child.layout(this._isVertical?c.flipped:c,{parentUsesSize:true});child.layoutOffset={x:0,y:0};const size=this._isVertical?{width:child.size.height,height:child.size.width}:child.size,matrix=Matrix4.identity();matrix.translateByDouble(size.width/2,size.height/2,0,1);matrix.rotateZ(_kQuarterTurnsInRadians*((this.quarterTurns%4+4)%4));matrix.translateByDouble(-child.size.width/2,-child.size.height/2,0,1);this._paintTransform=captureTransform(matrix.storage);return size;}
  protected override childTransform(child:RenderObject):TransformMatrix{return this._paintTransform?multiply(this._paintTransform,super.childTransform(child)):super.childTransform(child);}
  applyPaintTransform(child:RenderBox<RenderObject>,matrix:Matrix4):void{invariant(child.parent===this,'invalid-rotated-child','Painted child must belong to this RotatedBox');if(this._paintTransform)matrix.multiply(Matrix4.fromList(fullTransform(this._paintTransform)));matrix.translateByDouble(child.layoutOffset.x,child.layoutOffset.y,0,1);}
  hitTestChildren(position:Offset,result:HitTestEntry[],toLocal:TransformMatrix=identity):boolean{if(!this.child||!this._paintTransform)return false;const inverse=inversePaintTransform(this.childTransform(this.child));return !!inverse&&this.child.hitTest(transform(inverse,position),result,multiply(inverse,toLocal));}
  private _paintChild(context:PaintingContext):void{if(this.child)context.paintChild(this.child,super.childTransform(this.child));}
  override paint(context:PaintingContext):void{if(!this.child)return;invariant(this._paintTransform!==undefined,'unlaid-rotated-child','Rotated painting requires a completed layout');context.save();try{context.transform(this._paintTransform);this._paintChild(context);}finally{context.restore();}}
}
