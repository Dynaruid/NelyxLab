// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter rendering/shifted_box.dart at the recorded upstream pin.
import {invariant} from '../../foundation/errors.ts';
import {contains,identity,inversePaintTransform,multiply,transform} from '../../ui/geometry.ts';
import type {Offset,TransformMatrix,Size} from '../../ui/geometry.ts';
import {Offset as OffsetValue} from '../../ui/offset.ts';
import {Alignment,AlignmentGeometry} from '../painting/alignment.ts';
import {RenderBox} from './object.ts';
import type {RenderObject,HitTestEntry,TextBaseline} from './object.ts';
import type {BoxConstraints} from './constraints.ts';
import type {PaintingContext} from '../painting/context.ts';

/** A single child with an offset assigned by a subclass's layout algorithm. */
export abstract class RenderShiftedBox extends RenderBox {
  protected override get childCountLimit():number{return 1;}
  constructor(child?:RenderBox<RenderObject>){super();if(child)this.insert(child);}
  get child():RenderBox<RenderObject>|undefined{return this.children[0];}
  set child(value:RenderBox<RenderObject>|undefined){this.assertCanMutateLayoutProperty();this.setChildren(value?[value]:[]);}
  protected abstract override performLayout(constraints:BoxConstraints):Size;
  protected override computeMinIntrinsicWidth(height:number):number{return this.child?.getMinIntrinsicWidth(height)??0;}
  protected override computeMaxIntrinsicWidth(height:number):number{return this.child?.getMaxIntrinsicWidth(height)??0;}
  protected override computeMinIntrinsicHeight(width:number):number{return this.child?.getMinIntrinsicHeight(width)??0;}
  protected override computeMaxIntrinsicHeight(width:number):number{return this.child?.getMaxIntrinsicHeight(width)??0;}
  protected override computeDistanceToActualBaseline(baseline:TextBaseline):number|null{const child=this.child,value=child?.getDistanceToActualBaseline(baseline)??null;return value===null||!child?null:value+child.layoutOffset.y;}
  protected override computeDryBaseline(constraints:BoxConstraints,baseline:TextBaseline):number|null{return this.child?.getDryBaseline(constraints,baseline)??null;}
  override paint(context:PaintingContext):void{const child=this.child;if(child)this.paintChild(context,child);}
  override hitTest(position:Offset,result:HitTestEntry[],toLocal:TransformMatrix=identity):boolean{invariant(this.hasSize,'missing-hit-test-size','Hit testing requires a laid-out size');if(!contains({x:0,y:0,...this.size},position))return false;let hit=this.hitTestChildren(position,result,toLocal);if(this.onPointer||this.semantics){result.push({target:this,transform:toLocal});hit=true;}return hit;}
  hitTestChildren(position:Offset,result:HitTestEntry[],toLocal:TransformMatrix=identity):boolean{const child=this.child;if(!child)return false;const matrix=inversePaintTransform(this.childTransform(child));return !!matrix&&child.hitTest(transform(matrix,position),result,multiply(matrix,toLocal));}
}

export interface RenderAligningShiftedBoxOptions {readonly alignment?:AlignmentGeometry;readonly textDirection?:'ltr'|'rtl'|null;readonly child?:RenderBox<RenderObject>}
/** Keeps direction-sensitive alignment unresolved until layout or measurement needs it. */
export abstract class RenderAligningShiftedBox extends RenderShiftedBox {
  private _alignment:AlignmentGeometry;
  private _textDirection:'ltr'|'rtl'|null;
  private _resolvedAlignment:Alignment|undefined;
  constructor(options:RenderAligningShiftedBoxOptions={}){super(options.child);this._alignment=options.alignment??Alignment.center;invariant(this._alignment instanceof AlignmentGeometry,'invalid-alignment','AlignmentGeometry is required');this._textDirection=options.textDirection??null;invariant(this._textDirection===null||this._textDirection==='ltr'||this._textDirection==='rtl','invalid-text-direction','Unknown text direction');}
  protected get resolvedAlignment():Alignment{return this._resolvedAlignment??=this.alignment.resolve(this.textDirection);}
  private _markNeedResolution():void{this._resolvedAlignment=undefined;this.markNeedsLayout();}
  get alignment():AlignmentGeometry{return this._alignment;}
  set alignment(value:AlignmentGeometry){this.assertCanMutateLayoutProperty();invariant(value instanceof AlignmentGeometry,'invalid-alignment','AlignmentGeometry is required');if(this._alignment.equals(value))return;this._alignment=value;this._markNeedResolution();}
  get textDirection():'ltr'|'rtl'|null{return this._textDirection;}
  set textDirection(value:'ltr'|'rtl'|null){this.assertCanMutateLayoutProperty();invariant(value===null||value==='ltr'||value==='rtl','invalid-text-direction','Unknown text direction');if(this._textDirection===value)return;this._textDirection=value;this._markNeedResolution();}
  protected alignChild():void{const child=this.child;invariant(child&&child.hasSize&&!child.needsLayout&&this.hasSize,'unlaid-aligned-child','alignChild requires current child and parent sizes');const size=this.size,childSize=child.size;child.layoutOffset=this.resolvedAlignment.alongOffset(new OffsetValue(size.width-childSize.width,size.height-childSize.height));}
}
