// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter rendering/shifted_box.dart at the recorded upstream pin.
import {invariant} from '../../foundation/errors.ts';
import {Offset as OffsetValue} from '../../ui/offset.ts';
import {Size as SizeValue} from '../../ui/size.ts';
import {Rect as RectValue} from '../../ui/rect.ts';
import {Paint} from '../../ui/paint.ts';
import type {Size} from '../../ui/geometry.ts';
import type {Rect} from '../../ui/types.ts';
import type {Clip} from '../../ui/clip.ts';
import {RenderAligningShiftedBox} from './shifted-box.ts';
import type {RenderAligningShiftedBoxOptions} from './shifted-box.ts';
import {BoxConstraints} from './constraints.ts';
import type {TextBaseline,RenderObject} from './object.ts';
import type {PaintingContext} from '../painting/context.ts';

export type OverflowBoxFit='max'|'deferToChild';
export type BoxConstraintsTransform=(constraints:BoxConstraints)=>BoxConstraints;
export interface RenderConstrainedOverflowBoxOptions extends RenderAligningShiftedBoxOptions {readonly minWidth?:number|null;readonly maxWidth?:number|null;readonly minHeight?:number|null;readonly maxHeight?:number|null;readonly fit?:OverflowBoxFit}
function bound(value:number|null):void{invariant(value===null||typeof value==='number','invalid-overflow-bound','Overflow bounds must be numbers or null');}
function factor(value:number|null):void{invariant(value===null||typeof value==='number'&&value>=0,'invalid-size-factor','Fractional factors must be nonnegative');}
function clipping(value:Clip):void{invariant(['none','hardEdge','antiAlias','antiAliasWithSaveLayer'].includes(value),'invalid-clip','Unknown clip behavior');}
function requested(value:Size):SizeValue{return value instanceof SizeValue?value:new SizeValue(value.width,value.height);}

export class RenderConstrainedOverflowBox extends RenderAligningShiftedBox {
  private _minWidth:number|null;private _maxWidth:number|null;private _minHeight:number|null;private _maxHeight:number|null;private _fit:OverflowBoxFit;
  constructor(options:RenderConstrainedOverflowBoxOptions={}){const minWidth=options.minWidth??null,maxWidth=options.maxWidth??null,minHeight=options.minHeight??null,maxHeight=options.maxHeight??null,fit=options.fit??'max';for(const value of [minWidth,maxWidth,minHeight,maxHeight])bound(value);invariant(fit==='max'||fit==='deferToChild','invalid-overflow-fit','Unknown OverflowBoxFit');super(options);this._minWidth=minWidth;this._maxWidth=maxWidth;this._minHeight=minHeight;this._maxHeight=maxHeight;this._fit=fit;}
  get minWidth():number|null{return this._minWidth;}set minWidth(value:number|null){this.assertCanMutateLayoutProperty();bound(value);if(this._minWidth===value)return;this._minWidth=value;this.markNeedsLayout();}
  get maxWidth():number|null{return this._maxWidth;}set maxWidth(value:number|null){this.assertCanMutateLayoutProperty();bound(value);if(this._maxWidth===value)return;this._maxWidth=value;this.markNeedsLayout();}
  get minHeight():number|null{return this._minHeight;}set minHeight(value:number|null){this.assertCanMutateLayoutProperty();bound(value);if(this._minHeight===value)return;this._minHeight=value;this.markNeedsLayout();}
  get maxHeight():number|null{return this._maxHeight;}set maxHeight(value:number|null){this.assertCanMutateLayoutProperty();bound(value);if(this._maxHeight===value)return;this._maxHeight=value;this.markNeedsLayout();}
  get fit():OverflowBoxFit{return this._fit;}set fit(value:OverflowBoxFit){this.assertCanMutateLayoutProperty();invariant(value==='max'||value==='deferToChild','invalid-overflow-fit','Unknown OverflowBoxFit');if(this._fit===value)return;this._fit=value;this.markNeedsLayoutForSizedByParentChange();}
  private _getInnerConstraints(constraints:BoxConstraints):BoxConstraints{return new BoxConstraints(this._minWidth??constraints.minWidth,this._maxWidth??constraints.maxWidth,this._minHeight??constraints.minHeight,this._maxHeight??constraints.maxHeight);}
  override get sizedByParent():boolean{return this.fit==='max';}
  protected override computeDryLayout(constraints:BoxConstraints):Size{return this.fit==='max'?constraints.biggest:this.child?.getDryLayout(constraints)??constraints.smallest;}
  protected override computeDryBaseline(constraints:BoxConstraints,baseline:TextBaseline):number|null{const child=this.child;if(!child)return null;const inner=this._getInnerConstraints(constraints),value=child.getDryBaseline(inner,baseline);if(value===null)return null;const childSize=child.getDryLayout(inner),size=this.getDryLayout(constraints);return value+this.resolvedAlignment.alongOffset(new OffsetValue(size.width-childSize.width,size.height-childSize.height)).dy;}
  protected override performLayout(constraints:BoxConstraints):Size{const child=this.child;if(child){child.layout(this._getInnerConstraints(constraints),{parentUsesSize:true});if(this.fit==='deferToChild')this.size=constraints.constrain(child.size);this.alignChild();}else if(this.fit==='deferToChild')this.size=constraints.smallest;return this.size;}
}

export interface RenderSizedOverflowBoxOptions extends RenderAligningShiftedBoxOptions {readonly requestedSize:Size}
export class RenderSizedOverflowBox extends RenderAligningShiftedBox {
  private _requestedSize:SizeValue;
  constructor(options:RenderSizedOverflowBoxOptions){const size=requested(options.requestedSize);super(options);this._requestedSize=size;}
  get requestedSize():SizeValue{return this._requestedSize;}set requestedSize(value:Size){this.assertCanMutateLayoutProperty();const next=requested(value);if(this._requestedSize.equals(next))return;this._requestedSize=next;this.markNeedsLayout();}
  protected override computeMinIntrinsicWidth(_height:number):number{return this._requestedSize.width;}protected override computeMaxIntrinsicWidth(_height:number):number{return this._requestedSize.width;}
  protected override computeMinIntrinsicHeight(_width:number):number{return this._requestedSize.height;}protected override computeMaxIntrinsicHeight(_width:number):number{return this._requestedSize.height;}
  protected override computeDistanceToActualBaseline(baseline:TextBaseline):number|null{const child=this.child;if(!child)return super.computeDistanceToActualBaseline(baseline);const value=child.getDistanceToActualBaseline(baseline);return value===null?super.computeDistanceToActualBaseline(baseline):value+child.layoutOffset.y;}
  protected override computeDryBaseline(constraints:BoxConstraints,baseline:TextBaseline):number|null{const child=this.child;if(!child)return null;const value=child.getDryBaseline(constraints,baseline);if(value===null)return null;const childSize=child.getDryLayout(constraints),size=this.getDryLayout(constraints);return value+this.resolvedAlignment.alongOffset(new OffsetValue(size.width-childSize.width,size.height-childSize.height)).dy;}
  protected override computeDryLayout(constraints:BoxConstraints):Size{return constraints.constrain(this._requestedSize);}
  protected override performLayout(constraints:BoxConstraints):Size{this.size=constraints.constrain(this._requestedSize);if(this.child){this.child.layout(constraints,{parentUsesSize:true});this.alignChild();}return this.size;}
}

export interface RenderFractionallySizedOverflowBoxOptions extends RenderAligningShiftedBoxOptions {readonly widthFactor?:number|null;readonly heightFactor?:number|null}
export class RenderFractionallySizedOverflowBox extends RenderAligningShiftedBox {
  private _widthFactor:number|null;private _heightFactor:number|null;
  constructor(options:RenderFractionallySizedOverflowBoxOptions={}){const width=options.widthFactor??null,height=options.heightFactor??null;factor(width);factor(height);super(options);this._widthFactor=width;this._heightFactor=height;}
  get widthFactor():number|null{return this._widthFactor;}set widthFactor(value:number|null){this.assertCanMutateLayoutProperty();factor(value);if(this._widthFactor===value)return;this._widthFactor=value;this.markNeedsLayout();}
  get heightFactor():number|null{return this._heightFactor;}set heightFactor(value:number|null){this.assertCanMutateLayoutProperty();factor(value);if(this._heightFactor===value)return;this._heightFactor=value;this.markNeedsLayout();}
  private _getInnerConstraints(constraints:BoxConstraints):BoxConstraints{let minWidth=constraints.minWidth,maxWidth=constraints.maxWidth,minHeight=constraints.minHeight,maxHeight=constraints.maxHeight;if(this._widthFactor!==null)minWidth=maxWidth=maxWidth*this._widthFactor;if(this._heightFactor!==null)minHeight=maxHeight=maxHeight*this._heightFactor;return new BoxConstraints(minWidth,maxWidth,minHeight,maxHeight);}
  private fractionalIntrinsic(value:number,divisor:number|null):number{invariant(Number.isFinite(value),'nonfinite-fractional-intrinsic','Fractional child intrinsic result must be finite');return value/(divisor??1);}
  protected override computeMinIntrinsicWidth(height:number):number{return this.fractionalIntrinsic(this.child?this.child.getMinIntrinsicWidth(height*(this._heightFactor??1)):super.computeMinIntrinsicWidth(height),this._widthFactor);}
  protected override computeMaxIntrinsicWidth(height:number):number{return this.fractionalIntrinsic(this.child?this.child.getMaxIntrinsicWidth(height*(this._heightFactor??1)):super.computeMaxIntrinsicWidth(height),this._widthFactor);}
  protected override computeMinIntrinsicHeight(width:number):number{return this.fractionalIntrinsic(this.child?this.child.getMinIntrinsicHeight(width*(this._widthFactor??1)):super.computeMinIntrinsicHeight(width),this._heightFactor);}
  protected override computeMaxIntrinsicHeight(width:number):number{return this.fractionalIntrinsic(this.child?this.child.getMaxIntrinsicHeight(width*(this._widthFactor??1)):super.computeMaxIntrinsicHeight(width),this._heightFactor);}
  protected override computeDryLayout(constraints:BoxConstraints):Size{const inner=this._getInnerConstraints(constraints);return constraints.constrain(this.child?this.child.getDryLayout(inner):inner.constrain({width:0,height:0}));}
  protected override computeDryBaseline(constraints:BoxConstraints,baseline:TextBaseline):number|null{const child=this.child;if(!child)return null;const inner=this._getInnerConstraints(constraints),value=child.getDryBaseline(inner,baseline);if(value===null)return null;const childSize=child.getDryLayout(inner),size=this.getDryLayout(constraints);return value+this.resolvedAlignment.alongOffset(new OffsetValue(size.width-childSize.width,size.height-childSize.height)).dy;}
  protected override performLayout(constraints:BoxConstraints):Size{const inner=this._getInnerConstraints(constraints),child=this.child;if(child){child.layout(inner,{parentUsesSize:true});this.size=constraints.constrain(child.size);this.alignChild();}else this.size=constraints.constrain(inner.constrain({width:0,height:0}));return this.size;}
}

export interface RenderConstraintsTransformBoxOptions extends RenderAligningShiftedBoxOptions {readonly constraintsTransform:BoxConstraintsTransform;readonly clipBehavior?:Clip}
export class RenderConstraintsTransformBox extends RenderAligningShiftedBox {
  private _constraintsTransform:BoxConstraintsTransform;private _clipBehavior:Clip;private _childConstraints:BoxConstraints|undefined;
  private _overflowContainerRect:RectValue=RectValue.zero;private _overflowChildRect:RectValue=RectValue.zero;private _isOverflowing=false;
  constructor(options:RenderConstraintsTransformBoxOptions){invariant(typeof options.constraintsTransform==='function','invalid-constraints-transform','A constraint transform function is required');const clip=options.clipBehavior??'none';clipping(clip);super(options);this._constraintsTransform=options.constraintsTransform;this._clipBehavior=clip;}
  private transformConstraints(value:BoxConstraints):BoxConstraints{const result=this.constraintsTransform(value);invariant(result instanceof BoxConstraints,'invalid-constraints-transform','Constraint transforms must return BoxConstraints');result.debugAssertIsValid();return result;}
  get constraintsTransform():BoxConstraintsTransform{return this._constraintsTransform;}
  set constraintsTransform(value:BoxConstraintsTransform){this.assertCanMutateLayoutProperty();invariant(typeof value==='function','invalid-constraints-transform','A constraint transform function is required');if(this._constraintsTransform===value)return;this._constraintsTransform=value;this.invalidateLayoutMeasurements();if(this._childConstraints===undefined||!this._childConstraints.equals(this.transformConstraints(this.constraints)))this.markNeedsLayout();}
  get clipBehavior():Clip{return this._clipBehavior;}set clipBehavior(value:Clip){this.assertCanMutateLayoutProperty();clipping(value);if(this._clipBehavior===value)return;this._clipBehavior=value;this.markNeedsPaint();}
  protected override computeMinIntrinsicHeight(width:number):number{return super.computeMinIntrinsicHeight(this.transformConstraints(new BoxConstraints(0,width)).maxWidth);}
  protected override computeMaxIntrinsicHeight(width:number):number{return super.computeMaxIntrinsicHeight(this.transformConstraints(new BoxConstraints(0,width)).maxWidth);}
  protected override computeMinIntrinsicWidth(height:number):number{return super.computeMinIntrinsicWidth(this.transformConstraints(new BoxConstraints(0,Infinity,0,height)).maxHeight);}
  protected override computeMaxIntrinsicWidth(height:number):number{return super.computeMaxIntrinsicWidth(this.transformConstraints(new BoxConstraints(0,Infinity,0,height)).maxHeight);}
  protected override computeDryLayout(constraints:BoxConstraints):Size{const child=this.child;return child?constraints.constrain(child.getDryLayout(this.transformConstraints(constraints))):constraints.smallest;}
  protected override computeDryBaseline(constraints:BoxConstraints,baseline:TextBaseline):number|null{const child=this.child;if(!child)return null;const inner=this.transformConstraints(constraints),value=child.getDryBaseline(inner,baseline);if(value===null)return null;const childSize=child.getDryLayout(inner),size=constraints.constrain(childSize);return value+this.resolvedAlignment.alongOffset(new OffsetValue(size.width-childSize.width,size.height-childSize.height)).dy;}
  protected override performLayout(constraints:BoxConstraints):Size{const child=this.child;if(child){const inner=this.transformConstraints(constraints);this._childConstraints=inner;child.layout(inner,{parentUsesSize:true});this.size=constraints.constrain(child.size);this.alignChild();this._overflowContainerRect=RectValue.fromLTWH(0,0,this.size.width,this.size.height);this._overflowChildRect=RectValue.fromLTWH(child.layoutOffset.x,child.layoutOffset.y,child.size.width,child.size.height);}else{this.size=constraints.smallest;this._overflowContainerRect=RectValue.zero;this._overflowChildRect=RectValue.zero;}const container=this._overflowContainerRect,content=this._overflowChildRect;this._isOverflowing=container.left>content.left||container.top>content.top||container.right<content.right||container.bottom<content.bottom;return this.size;}
  override get clips():boolean{return this._isOverflowing&&this._clipBehavior!=='none';}
  describeApproximatePaintClip(_child:RenderObject):Rect|null{return this.clips?this._overflowContainerRect:null;}
  override paint(context:PaintingContext):void{if(!this.child)return;if(!this.clips){super.paint(context);return;}const rect=this._overflowContainerRect;context.save();try{context.clipRect(rect,{doAntiAlias:this.clipBehavior!=='hardEdge'});if(this.clipBehavior==='antiAliasWithSaveLayer'){context.saveLayer(rect,new Paint());try{super.paint(context);}finally{context.restore();}}else super.paint(context);}finally{context.restore();}}
}
