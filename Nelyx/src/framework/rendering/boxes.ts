// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {invariant} from '../../foundation/errors.ts';
import {assertOutsideRenderPaint} from './phase.ts';
import type {Size,Insets,TransformMatrix,Offset} from '../../ui/geometry.ts';
import {captureTransform,fullTransform,multiply,translate,identity,inversePaintTransform,transform,inverse} from '../../ui/geometry.ts';
import type {Rect} from '../../ui/types.ts';
import type {ResourceId,TextLayout} from '../../ui/types.ts';
import {BoxConstraints} from './constraints.ts';
import {RenderBox,ContainerBoxParentData} from './object.ts';
import type {RenderObject,TextBaseline,HitTestEntry} from './object.ts';
import type {PaintingContext} from '../painting/context.ts';
import type {TextPainter} from '../painting/text-painter.ts';
import type {ParagraphLayoutOptions} from './paragraph-overflow.ts';
import {Alignment,AlignmentDirectional,AlignmentGeometry} from '../painting/alignment.ts';
import {Offset as OffsetValue} from '../../ui/offset.ts';
import {Rect as RectValue} from '../../ui/rect.ts';
import {TextPosition} from '../../ui/text-position.ts';
import {TextRange} from '../../ui/text-range.ts';
import {TextSelection} from '../../services/text-editing.ts';
import type {TextBox,BoxHeightStyle,BoxWidthStyle} from '../../ui/text-box.ts';
import type {Selectable,SelectionRegistrar} from './selection.ts';
import {SelectableParagraphFragment} from './paragraph-fragment.ts';
import type {Clip} from '../../ui/clip.ts';
import {Paint} from '../../ui/paint.ts';
import {ImageFilter} from '../../ui/image-filter.ts';
import type {FilterQuality} from '../../ui/paint-effects-data.ts';
import {ImageFilterLayer,LayerHandle} from './layer.ts';
import {RenderShiftedBox,RenderAligningShiftedBox} from './shifted-box.ts';
import type {RenderAligningShiftedBoxOptions} from './shifted-box.ts';
import {EdgeInsets,EdgeInsetsGeometry} from '../painting/edge-insets.ts';
import {Decoration} from '../painting/decoration.ts';
import type {BoxPainter,DecorationPosition} from '../painting/decoration.ts';
import {BoxDecoration} from '../painting/box-decoration.ts';
import {BorderRadius} from '../painting/border-radius.ts';
import {ImageConfiguration} from '../painting/image-configuration.ts';
import {valueEquals} from '../painting/value-equality.ts';
export class RenderProxyBox extends RenderBox {
  protected override get childCountLimit():number{return 1;}
  constructor(child?:RenderBox<RenderObject>){super();if(child)this.insert(child);}
  get child():RenderBox<RenderObject>|undefined{return this.children[0];}
  set child(value:RenderBox<RenderObject>|undefined){this.assertCanMutateLayoutProperty();this.setChildren(value?[value]:[]);}
  protected computeMinIntrinsicWidth(height:number):number{return this.child?.getMinIntrinsicWidth(height)??0;}
  protected computeMaxIntrinsicWidth(height:number):number{return this.child?.getMaxIntrinsicWidth(height)??0;}
  protected computeMinIntrinsicHeight(width:number):number{return this.child?.getMinIntrinsicHeight(width)??0;}
  protected computeMaxIntrinsicHeight(width:number):number{return this.child?.getMaxIntrinsicHeight(width)??0;}
  protected computeDryLayout(constraints:BoxConstraints):Size{return this.child?.getDryLayout(constraints)??constraints.smallest;}
  protected computeDryBaseline(constraints:BoxConstraints,baseline:TextBaseline):number|null{return this.child?.getDryBaseline(constraints,baseline)??null;}
  protected computeDistanceToActualBaseline(baseline:TextBaseline):number|null{return this.child?.getDistanceToActualBaseline(baseline)??null;}
  protected performLayout(constraints:BoxConstraints):Size{const child=this.child;if(!child)return constraints.smallest;child.layout(constraints,{parentUsesSize:true});child.layoutOffset={x:0,y:0};return child.size;}
}
export class RenderConstrainedBox extends RenderProxyBox {
  private extra:BoxConstraints;
  constructor(additional:BoxConstraints=new BoxConstraints(),child?:RenderBox<RenderObject>){super(child);additional.debugAssertIsValid();this.extra=additional;}
  get additionalConstraints():BoxConstraints{return this.extra;}
  set additionalConstraints(value:BoxConstraints){this.assertCanMutateLayoutProperty();value.debugAssertIsValid();if(this.extra.equals(value))return;this.extra=value;this.markNeedsLayout();}
  get additional():BoxConstraints{return this.additionalConstraints;}
  set additional(value:BoxConstraints){this.assertCanMutateLayoutProperty();this.additionalConstraints=value;}
  protected override computeMinIntrinsicWidth(height:number):number{if(this.extra.hasBoundedWidth&&this.extra.hasTightWidth)return this.extra.minWidth;const width=super.computeMinIntrinsicWidth(height);return this.extra.hasInfiniteWidth?width:this.extra.constrainWidth(width);}
  protected override computeMaxIntrinsicWidth(height:number):number{if(this.extra.hasBoundedWidth&&this.extra.hasTightWidth)return this.extra.minWidth;const width=super.computeMaxIntrinsicWidth(height);return this.extra.hasInfiniteWidth?width:this.extra.constrainWidth(width);}
  protected override computeMinIntrinsicHeight(width:number):number{if(this.extra.hasBoundedHeight&&this.extra.hasTightHeight)return this.extra.minHeight;const height=super.computeMinIntrinsicHeight(width);return this.extra.hasInfiniteHeight?height:this.extra.constrainHeight(height);}
  protected override computeMaxIntrinsicHeight(width:number):number{if(this.extra.hasBoundedHeight&&this.extra.hasTightHeight)return this.extra.minHeight;const height=super.computeMaxIntrinsicHeight(width);return this.extra.hasInfiniteHeight?height:this.extra.constrainHeight(height);}
  protected override computeDryLayout(constraints:BoxConstraints):Size{return super.computeDryLayout(this.extra.enforce(constraints));}
  protected override computeDryBaseline(constraints:BoxConstraints,baseline:TextBaseline):number|null{return super.computeDryBaseline(this.extra.enforce(constraints),baseline);}
  protected override performLayout(constraints:BoxConstraints):Size{return super.performLayout(this.extra.enforce(constraints));}
}
export class RenderPadding extends RenderShiftedBox {
  private _padding:EdgeInsetsGeometry;private _textDirection:'ltr'|'rtl'|null;private _resolvedPaddingCache:EdgeInsets|undefined;
  constructor(padding:Insets|EdgeInsetsGeometry,child?:RenderBox<RenderObject>,textDirection:'ltr'|'rtl'|null=null){const value=padding instanceof EdgeInsetsGeometry?padding:new EdgeInsets(padding.left,padding.top,padding.right,padding.bottom);invariant(value.isNonNegative,'invalid-padding','Padding must be nonnegative');invariant(textDirection===null||textDirection==='ltr'||textDirection==='rtl','invalid-text-direction','Unknown padding text direction');super(child);this._padding=value;this._textDirection=textDirection;}
  private get _resolvedPadding():EdgeInsets{const value=this._resolvedPaddingCache??=this.padding.resolve(this.textDirection);invariant([value.left,value.right,value.top,value.bottom].every(edge=>Number.isFinite(edge)&&edge>=0),'invalid-padding','Resolved padding must be finite and nonnegative');return value;}
  private _markNeedResolution():void{this._resolvedPaddingCache=undefined;this.markNeedsLayout();}
  get padding():EdgeInsetsGeometry{return this._padding;}
  set padding(value:Insets|EdgeInsetsGeometry){this.assertCanMutateLayoutProperty();const next=value instanceof EdgeInsetsGeometry?value:new EdgeInsets(value.left,value.top,value.right,value.bottom);invariant(next.isNonNegative,'invalid-padding','Padding must be nonnegative');if(this._padding.equals(next))return;this._padding=next;this._markNeedResolution();}
  get textDirection():'ltr'|'rtl'|null{return this._textDirection;}
  set textDirection(value:'ltr'|'rtl'|null){this.assertCanMutateLayoutProperty();invariant(value===null||value==='ltr'||value==='rtl','invalid-text-direction','Unknown padding text direction');if(this._textDirection===value)return;this._textDirection=value;this._markNeedResolution();}
  protected override computeMinIntrinsicWidth(height:number):number{const padding=this._resolvedPadding,child=this.child;return child?child.getMinIntrinsicWidth(Math.max(0,height-padding.vertical))+padding.horizontal:padding.horizontal;}
  protected override computeMaxIntrinsicWidth(height:number):number{const padding=this._resolvedPadding,child=this.child;return child?child.getMaxIntrinsicWidth(Math.max(0,height-padding.vertical))+padding.horizontal:padding.horizontal;}
  protected override computeMinIntrinsicHeight(width:number):number{const padding=this._resolvedPadding,child=this.child;return child?child.getMinIntrinsicHeight(Math.max(0,width-padding.horizontal))+padding.vertical:padding.vertical;}
  protected override computeMaxIntrinsicHeight(width:number):number{const padding=this._resolvedPadding,child=this.child;return child?child.getMaxIntrinsicHeight(Math.max(0,width-padding.horizontal))+padding.vertical:padding.vertical;}
  private layoutSize(constraints:BoxConstraints,dry:boolean):Size{const padding=this._resolvedPadding,child=this.child;if(!child)return constraints.constrain({width:padding.horizontal,height:padding.vertical});const inner=constraints.deflate(padding);let measured:Size;if(dry)measured=child.getDryLayout(inner);else{child.layout(inner,{parentUsesSize:true});child.layoutOffset=new OffsetValue(padding.left,padding.top);measured=child.size;}return constraints.constrain({width:padding.horizontal+measured.width,height:padding.vertical+measured.height});}
  protected override performLayout(constraints:BoxConstraints):Size{return this.layoutSize(constraints,false);}
  protected override computeDryLayout(constraints:BoxConstraints):Size{return this.layoutSize(constraints,true);}
  protected override computeDryBaseline(constraints:BoxConstraints,baseline:TextBaseline):number|null{const child=this.child;if(!child)return null;const padding=this._resolvedPadding,value=child.getDryBaseline(constraints.deflate(padding),baseline);return value===null?null:value+padding.top;}
}
export interface RenderPositionedBoxOptions extends RenderAligningShiftedBoxOptions {readonly widthFactor?:number|null;readonly heightFactor?:number|null;readonly shrink?:boolean}
export class RenderPositionedBox extends RenderAligningShiftedBox {
  private shrinkToChild:boolean;private factorX:number|undefined;private factorY:number|undefined;
  constructor(xOrOptions:number|RenderPositionedBoxOptions=0,y=0,shrink=false,widthFactor?:number,heightFactor?:number){const options=typeof xOrOptions==='number'?undefined:xOrOptions;super(options??{alignment:new Alignment(xOrOptions as number,y)});if(!options)invariant(Number.isFinite(xOrOptions)&&Number.isFinite(y),'invalid-alignment','Alignment must be finite');this.shrinkToChild=options?.shrink??shrink;this.factorX=options?(options.widthFactor??undefined):widthFactor;this.factorY=options?(options.heightFactor??undefined):heightFactor;this.checkFactor(this.factorX);this.checkFactor(this.factorY);}
  private checkFactor(value:number|undefined):void{invariant(value===undefined||Number.isFinite(value)&&value>=0,'invalid-size-factor','Size factor must be finite and nonnegative');}
  get x():number{return this.alignment.resolve(this.textDirection??'ltr').x;}set x(value:number){invariant(Number.isFinite(value),'invalid-alignment','Alignment must be finite');this.alignment=new Alignment(value,this.y);}
  get y():number{return this.alignment.resolve(this.textDirection??'ltr').y;}set y(value:number){invariant(Number.isFinite(value),'invalid-alignment','Alignment must be finite');this.alignment=new Alignment(this.x,value);}
  get shrink():boolean{return this.shrinkToChild;}set shrink(value:boolean){this.assertCanMutateLayoutProperty();if(value!==this.shrinkToChild){this.shrinkToChild=value;this.markNeedsLayout();}}
  get widthFactor():number|undefined{return this.factorX;}set widthFactor(value:number|undefined){this.assertCanMutateLayoutProperty();this.checkFactor(value);if(value!==this.factorX){this.factorX=value;this.markNeedsLayout();}}
  get heightFactor():number|undefined{return this.factorY;}set heightFactor(value:number|undefined){this.assertCanMutateLayoutProperty();this.checkFactor(value);if(value!==this.factorY){this.factorY=value;this.markNeedsLayout();}}
  protected override computeMinIntrinsicWidth(height:number):number{return super.computeMinIntrinsicWidth(height)*(this.factorX??1);}
  protected override computeMaxIntrinsicWidth(height:number):number{return super.computeMaxIntrinsicWidth(height)*(this.factorX??1);}
  protected override computeMinIntrinsicHeight(width:number):number{return super.computeMinIntrinsicHeight(width)*(this.factorY??1);}
  protected override computeMaxIntrinsicHeight(width:number):number{return super.computeMaxIntrinsicHeight(width)*(this.factorY??1);}
  private layoutSize(constraints:BoxConstraints,dry:boolean):Size{
    const child=this.child,inner=constraints.loosen();let measured:Size={width:0,height:0};if(child){if(dry)measured=child.getDryLayout(inner);else{child.layout(inner,{parentUsesSize:true});measured=child.size;}}
    const x=this.factorX??(this.shrinkToChild?1:undefined),y=this.factorY??(this.shrinkToChild?1:undefined),size=constraints.constrain({width:x!==undefined||!constraints.hasBoundedWidth?measured.width*(x??1):Infinity,height:y!==undefined||!constraints.hasBoundedHeight?measured.height*(y??1):Infinity});
    if(child&&!dry){this.size=size;this.alignChild();}return size;
  }
  protected override performLayout(constraints:BoxConstraints):Size{return this.layoutSize(constraints,false);}
  protected override computeDryLayout(constraints:BoxConstraints):Size{return this.layoutSize(constraints,true);}
  protected override computeDryBaseline(constraints:BoxConstraints,baseline:TextBaseline):number|null{const child=this.child;if(!child)return null;const inner=constraints.loosen(),value=child.getDryBaseline(inner,baseline);if(value===null)return null;const size=this.getDryLayout(constraints),childSize=child.getDryLayout(inner);return value+this.resolvedAlignment.alongOffset(new OffsetValue(size.width-childSize.width,size.height-childSize.height)).dy;}
}
/** W5 constructor compatibility; new widgets use RenderPositionedBox. */
export class RenderAlign extends RenderPositionedBox {}
export interface SizingChildOptions {readonly child?:RenderBox<RenderObject>}
export interface RenderLimitedBoxOptions extends SizingChildOptions {readonly maxWidth?:number;readonly maxHeight?:number}
function nonnegative(value:number):void{invariant(typeof value==='number'&&value>=0,'invalid-size-limit','Size limits must be nonnegative');}
function ratio(value:number):void{invariant(typeof value==='number'&&value>0&&Number.isFinite(value),'invalid-aspect-ratio','Aspect ratio must be finite and positive');}
function step(value:number|null):void{invariant(value===null||typeof value==='number'&&value>0,'invalid-intrinsic-step','Render intrinsic steps must be null or positive');}
function baselineType(value:TextBaseline):void{invariant(value==='alphabetic'||value==='ideographic','invalid-baseline','Unknown baseline');}
type ChildLayouter=(child:RenderBox<RenderObject>,constraints:BoxConstraints)=>Size;
const dryChild:ChildLayouter=(child,constraints)=>child.getDryLayout(constraints);
const wetChild:ChildLayouter=(child,constraints)=>{child.layout(constraints,{parentUsesSize:true});child.layoutOffset={x:0,y:0};return child.size;};

/** Limits only axes that arrive with an unbounded maximum. */
export class RenderLimitedBox extends RenderProxyBox {
  private _maxWidth:number;private _maxHeight:number;
  constructor(options?:RenderLimitedBoxOptions);
  constructor(maxWidth?:number,maxHeight?:number,child?:RenderBox<RenderObject>);
  constructor(value:number|RenderLimitedBoxOptions=Infinity,legacyHeight=Infinity,legacyChild?:RenderBox<RenderObject>){const {child,maxWidth=Infinity,maxHeight=Infinity}=typeof value==='number'?{maxWidth:value,maxHeight:legacyHeight,child:legacyChild}:value;nonnegative(maxWidth);nonnegative(maxHeight);super(child);this._maxWidth=maxWidth;this._maxHeight=maxHeight;}
  get maxWidth():number{return this._maxWidth;}set maxWidth(value:number){this.assertCanMutateLayoutProperty();nonnegative(value);if(this._maxWidth===value)return;this._maxWidth=value;this.markNeedsLayout();}
  get maxHeight():number{return this._maxHeight;}set maxHeight(value:number){this.assertCanMutateLayoutProperty();nonnegative(value);if(this._maxHeight===value)return;this._maxHeight=value;this.markNeedsLayout();}
  private _limitConstraints(c:BoxConstraints):BoxConstraints{return new BoxConstraints(c.minWidth,c.hasBoundedWidth?c.maxWidth:c.constrainWidth(this.maxWidth),c.minHeight,c.hasBoundedHeight?c.maxHeight:c.constrainHeight(this.maxHeight));}
  private _computeSize(c:BoxConstraints,layoutChild:ChildLayouter):Size{return this.child?c.constrain(layoutChild(this.child,this._limitConstraints(c))):this._limitConstraints(c).constrain({width:0,height:0});}
  protected override computeDryLayout(c:BoxConstraints):Size{return this._computeSize(c,dryChild);}
  protected override performLayout(c:BoxConstraints):Size{return this._computeSize(c,wetChild);}
}

export interface RenderAspectRatioOptions extends SizingChildOptions {readonly aspectRatio:number}
export class RenderAspectRatio extends RenderProxyBox {
  private _aspectRatio:number;
  constructor(options:RenderAspectRatioOptions);
  constructor(aspectRatio:number,child?:RenderBox<RenderObject>);
  constructor(value:number|RenderAspectRatioOptions,legacyChild?:RenderBox<RenderObject>){const {child,aspectRatio}=typeof value==='number'?{aspectRatio:value,child:legacyChild}:value;ratio(aspectRatio);super(child);this._aspectRatio=aspectRatio;}
  get aspectRatio():number{return this._aspectRatio;}set aspectRatio(value:number){this.assertCanMutateLayoutProperty();ratio(value);if(this._aspectRatio===value)return;this._aspectRatio=value;this.markNeedsLayout();}
  protected override computeMinIntrinsicWidth(height:number):number{return Number.isFinite(height)?height*this._aspectRatio:this.child?.getMinIntrinsicWidth(height)??0;}
  protected override computeMaxIntrinsicWidth(height:number):number{return Number.isFinite(height)?height*this._aspectRatio:this.child?.getMaxIntrinsicWidth(height)??0;}
  protected override computeMinIntrinsicHeight(width:number):number{return Number.isFinite(width)?width/this._aspectRatio:this.child?.getMinIntrinsicHeight(width)??0;}
  protected override computeMaxIntrinsicHeight(width:number):number{return Number.isFinite(width)?width/this._aspectRatio:this.child?.getMaxIntrinsicHeight(width)??0;}
  private _applyAspectRatio(c:BoxConstraints):Size{c.debugAssertIsValid();invariant(c.hasBoundedWidth||c.hasBoundedHeight,'unbounded-aspect-ratio','AspectRatio requires a bounded axis');if(c.isTight)return c.smallest;let width=c.maxWidth,height:number;if(Number.isFinite(width))height=width/this._aspectRatio;else{height=c.maxHeight;width=height*this._aspectRatio;}if(width>c.maxWidth){width=c.maxWidth;height=width/this._aspectRatio;}if(height>c.maxHeight){height=c.maxHeight;width=height*this._aspectRatio;}if(width<c.minWidth){width=c.minWidth;height=width/this._aspectRatio;}if(height<c.minHeight){height=c.minHeight;width=height*this._aspectRatio;}return c.constrain({width,height});}
  protected override computeDryLayout(c:BoxConstraints):Size{return this._applyAspectRatio(c);}
  protected override computeDryBaseline(c:BoxConstraints,b:TextBaseline):number|null{return super.computeDryBaseline(BoxConstraints.tight(this.getDryLayout(c)),b);}
  protected override performLayout(c:BoxConstraints):Size{const size=this.getDryLayout(c);if(this.child){this.child.layout(BoxConstraints.tight(size));this.child.layoutOffset={x:0,y:0};}return size;}
}

export interface RenderIntrinsicWidthOptions extends SizingChildOptions {readonly stepWidth?:number|null;readonly stepHeight?:number|null}
export class RenderIntrinsicWidth extends RenderProxyBox {
  private _stepWidth:number|null;private _stepHeight:number|null;
  constructor(options?:RenderIntrinsicWidthOptions);
  constructor(stepWidth?:number|null,stepHeight?:number|null,child?:RenderBox<RenderObject>);
  constructor(value:number|null|RenderIntrinsicWidthOptions=null,legacyHeight:number|null=null,legacyChild?:RenderBox<RenderObject>){const {child,stepWidth=null,stepHeight=null}=typeof value==='object'&&value!==null?value:{stepWidth:value,stepHeight:legacyHeight,child:legacyChild};step(stepWidth);step(stepHeight);super(child);this._stepWidth=stepWidth;this._stepHeight=stepHeight;}
  get stepWidth():number|null{return this._stepWidth;}set stepWidth(value:number|null|undefined){this.assertCanMutateLayoutProperty();value??=null;step(value);if(this._stepWidth===value)return;this._stepWidth=value;this.markNeedsLayout();}
  get stepHeight():number|null{return this._stepHeight;}set stepHeight(value:number|null|undefined){this.assertCanMutateLayoutProperty();value??=null;step(value);if(this._stepHeight===value)return;this._stepHeight=value;this.markNeedsLayout();}
  private static _applyStep(input:number,value:number|null):number{invariant(Number.isFinite(input),'nonfinite-intrinsic-step','Intrinsic step input must be finite');if(value===null)return input;const quotient=input/value;invariant(Number.isFinite(quotient),'nonfinite-intrinsic-step','Intrinsic step quotient must be finite');const rounded=Math.min(Math.ceil(quotient),2**63);return (rounded===0?0:rounded)*value;}
  protected override computeMinIntrinsicWidth(height:number):number{return this.getMaxIntrinsicWidth(height);}
  protected override computeMaxIntrinsicWidth(height:number):number{return this.child?RenderIntrinsicWidth._applyStep(this.child.getMaxIntrinsicWidth(height),this._stepWidth):0;}
  protected override computeMinIntrinsicHeight(width:number):number{if(!this.child)return 0;if(!Number.isFinite(width))width=this.getMaxIntrinsicWidth(Infinity);invariant(Number.isFinite(width),'nonfinite-intrinsic-width','Intrinsic width must be finite');return RenderIntrinsicWidth._applyStep(this.child.getMinIntrinsicHeight(width),this._stepHeight);}
  protected override computeMaxIntrinsicHeight(width:number):number{if(!this.child)return 0;if(!Number.isFinite(width))width=this.getMaxIntrinsicWidth(Infinity);invariant(Number.isFinite(width),'nonfinite-intrinsic-width','Intrinsic width must be finite');return RenderIntrinsicWidth._applyStep(this.child.getMaxIntrinsicHeight(width),this._stepHeight);}
  private _childConstraints(child:RenderBox<RenderObject>,c:BoxConstraints):BoxConstraints{return c.tighten(c.hasTightWidth?null:RenderIntrinsicWidth._applyStep(child.getMaxIntrinsicWidth(c.maxHeight),this._stepWidth),this.stepHeight===null?null:RenderIntrinsicWidth._applyStep(child.getMaxIntrinsicHeight(c.maxWidth),this._stepHeight));}
  private _computeSize(c:BoxConstraints,layoutChild:ChildLayouter):Size{return this.child?layoutChild(this.child,this._childConstraints(this.child,c)):c.smallest;}
  protected override computeDryLayout(c:BoxConstraints):Size{return this._computeSize(c,dryChild);}
  protected override computeDryBaseline(c:BoxConstraints,b:TextBaseline):number|null{return this.child?.getDryBaseline(this._childConstraints(this.child,c),b)??null;}
  protected override performLayout(c:BoxConstraints):Size{return this._computeSize(c,wetChild);}
}

export class RenderIntrinsicHeight extends RenderProxyBox {
  constructor(options?:SizingChildOptions);
  constructor(child?:RenderBox<RenderObject>);
  constructor(value:SizingChildOptions|RenderBox<RenderObject>={}){super(value instanceof RenderBox?value:value.child);}
  protected override computeMinIntrinsicWidth(height:number):number{if(!this.child)return 0;if(!Number.isFinite(height))height=this.child.getMaxIntrinsicHeight(Infinity);invariant(Number.isFinite(height),'nonfinite-intrinsic-height','Intrinsic height must be finite');return this.child.getMinIntrinsicWidth(height);}
  protected override computeMaxIntrinsicWidth(height:number):number{if(!this.child)return 0;if(!Number.isFinite(height))height=this.child.getMaxIntrinsicHeight(Infinity);invariant(Number.isFinite(height),'nonfinite-intrinsic-height','Intrinsic height must be finite');return this.child.getMaxIntrinsicWidth(height);}
  protected override computeMinIntrinsicHeight(width:number):number{return this.getMaxIntrinsicHeight(width);}
  private _childConstraints(child:RenderBox<RenderObject>,c:BoxConstraints):BoxConstraints{return c.hasTightHeight?c:c.tighten(null,child.getMaxIntrinsicHeight(c.maxWidth));}
  private _computeSize(c:BoxConstraints,layoutChild:ChildLayouter):Size{return this.child?layoutChild(this.child,this._childConstraints(this.child,c)):c.smallest;}
  protected override computeDryLayout(c:BoxConstraints):Size{return this._computeSize(c,dryChild);}
  protected override computeDryBaseline(c:BoxConstraints,b:TextBaseline):number|null{return this.child?.getDryBaseline(this._childConstraints(this.child,c),b)??null;}
  protected override performLayout(c:BoxConstraints):Size{return this._computeSize(c,wetChild);}
}

export class RenderIgnoreBaseline extends RenderProxyBox {
  constructor(options?:SizingChildOptions);
  constructor(child?:RenderBox<RenderObject>);
  constructor(value:SizingChildOptions|RenderBox<RenderObject>={}){super(value instanceof RenderBox?value:value.child);}
  protected override computeDistanceToActualBaseline(_b:TextBaseline):null{return null;}
  protected override computeDryBaseline(_c:BoxConstraints,_b:TextBaseline):null{return null;}
}

export interface RenderBaselineOptions extends SizingChildOptions {readonly baseline:number;readonly baselineType:TextBaseline}
export class RenderBaseline extends RenderShiftedBox {
  private _baseline:number;private _baselineType:TextBaseline;
  constructor(options:RenderBaselineOptions);
  constructor(baseline:number,baselineType:TextBaseline,child?:RenderBox<RenderObject>);
  constructor(value:number|RenderBaselineOptions,legacyType?:TextBaseline,legacyChild?:RenderBox<RenderObject>){const {child,baseline,baselineType:type}=typeof value==='number'?{baseline:value,baselineType:legacyType!,child:legacyChild}:value;invariant(typeof baseline==='number','invalid-baseline','Baseline must be a number');baselineType(type);super(child);this._baseline=baseline;this._baselineType=type;}
  get baseline():number{return this._baseline;}set baseline(value:number){this.assertCanMutateLayoutProperty();invariant(typeof value==='number','invalid-baseline','Baseline must be a number');if(this._baseline===value)return;this._baseline=value;this.markNeedsLayout();}
  get baselineType():TextBaseline{return this._baselineType;}set baselineType(value:TextBaseline){this.assertCanMutateLayoutProperty();baselineType(value);if(this._baselineType===value)return;this._baselineType=value;this.markNeedsLayout();}
  private _computeSizes(c:BoxConstraints,layoutChild:ChildLayouter,dry:boolean):{size:Size;top:number}{const child=this.child;if(!child)return {size:c.smallest,top:0};const childConstraints=c.loosen(),childSize=layoutChild(child,childConstraints),childBaseline=(dry?child.getDryBaseline(childConstraints,this.baselineType):child.getDistanceToBaseline(this.baselineType,{onlyReal:true}))??childSize.height,top=this.baseline-childBaseline;return {size:c.constrain({width:childSize.width,height:top+childSize.height}),top};}
  protected override computeDryLayout(c:BoxConstraints):Size{return this._computeSizes(c,dryChild,true).size;}
  protected override computeDryBaseline(c:BoxConstraints,b:TextBaseline):number|null{const result1=this.child?.getDryBaseline(c.loosen(),b)??null,result2=this.child?.getDryBaseline(c.loosen(),this.baselineType)??null;return result1===null||result2===null?null:this.baseline+result1-result2;}
  protected override performLayout(c:BoxConstraints):Size{const result=this._computeSizes(c,wetChild,false);if(this.child)this.child.layoutOffset={x:0,y:result.top};return result.size;}
}

export interface FlexItem {readonly flex:number;readonly fit:'tight'|'loose'}
export class FlexParentData extends ContainerBoxParentData<RenderBox> {flex=0;fit:'tight'|'loose'='tight';}
export type MainAxisAlignment='start'|'end'|'center'|'spaceBetween'|'spaceAround'|'spaceEvenly';
export type CrossAxisAlignment='start'|'end'|'center'|'stretch'|'baseline';
export interface RenderFlexOptions {readonly mainAxisAlignment?:MainAxisAlignment;readonly textDirection?:'ltr'|'rtl'|null;readonly verticalDirection?:'up'|'down';readonly textBaseline?:TextBaseline|null;readonly clipBehavior?:'none'|'hardEdge'}
interface FlexChildMeasure {readonly child:RenderBox<RenderObject>;readonly item:FlexItem;size:Size|undefined;constraints:BoxConstraints|undefined;baseline:number|null;x:number;y:number}
interface FlexMeasure {size:Size;used:number;baseline:number|null;children:FlexChildMeasure[]}
const dryFlexChild:ChildLayouter=(child,constraints)=>child.getDryLayout(constraints);
const wetFlexChild:ChildLayouter=(child,constraints)=>{child.layout(constraints,{parentUsesSize:true});return child.size;};
const dryFlexBaseline=(child:RenderBox<RenderObject>,constraints:BoxConstraints,baseline:TextBaseline):number|null=>child.getDryBaseline(constraints,baseline);
const wetFlexBaseline=(child:RenderBox<RenderObject>,_constraints:BoxConstraints,baseline:TextBaseline):number|null=>child.getDistanceToBaseline(baseline,{onlyReal:true});
export class RenderFlex extends RenderBox {
  private axis:'horizontal'|'vertical';private gap:number;private legacyItems:readonly FlexItem[];private mainSizing:'min'|'max';private crossAlignment:CrossAxisAlignment;
  private mainAlignment:MainAxisAlignment;private textFlow:'ltr'|'rtl'|null;private verticalFlow:'up'|'down';private baselineType:TextBaseline|null;private clipping:'none'|'hardEdge';
  constructor(direction:'horizontal'|'vertical',spacing=0,items:readonly FlexItem[]=[],mainSize:'min'|'max'='max',crossAlign:CrossAxisAlignment='center',options:RenderFlexOptions={}){super();this.axis=direction;this.gap=spacing;this.legacyItems=Object.freeze(items.map(item=>Object.freeze({...item})));this.mainSizing=mainSize;this.crossAlignment=crossAlign;this.mainAlignment=options.mainAxisAlignment??'start';this.textFlow=options.textDirection===undefined?'ltr':options.textDirection;this.verticalFlow=options.verticalDirection??'down';this.baselineType=options.textBaseline??null;this.clipping=options.clipBehavior??'none';this.validateConfiguration();}
  private change<T>(old:T,value:T,assign:()=>void):void{if(old!==value){assign();this.markNeedsLayout();}}
  get direction():'horizontal'|'vertical'{return this.axis;}set direction(value:'horizontal'|'vertical'){this.assertCanMutateLayoutProperty();invariant(value==='horizontal'||value==='vertical','invalid-flex-direction','Unknown flex direction');this.change(this.axis,value,()=>{this.axis=value;});}
  get spacing():number{return this.gap;}set spacing(value:number){this.assertCanMutateLayoutProperty();invariant(Number.isFinite(value)&&value>=0,'invalid-spacing','Flex spacing must be finite and nonnegative');this.change(this.gap,value,()=>{this.gap=value;});}
  get items():readonly FlexItem[]{return this.legacyItems;}set items(value:readonly FlexItem[]){this.assertCanMutateLayoutProperty();this.legacyItems=Object.freeze(value.map(item=>Object.freeze({...item})));this.markNeedsLayout();}
  get mainAxisSize():'min'|'max'{return this.mainSizing;}set mainAxisSize(value:'min'|'max'){this.assertCanMutateLayoutProperty();invariant(value==='min'||value==='max','invalid-flex-size','Unknown main axis size');this.change(this.mainSizing,value,()=>{this.mainSizing=value;});}
  get mainSize():'min'|'max'{return this.mainAxisSize;}set mainSize(value:'min'|'max'){this.assertCanMutateLayoutProperty();this.mainAxisSize=value;}
  get crossAxisAlignment():CrossAxisAlignment{return this.crossAlignment;}set crossAxisAlignment(value:CrossAxisAlignment){this.assertCanMutateLayoutProperty();invariant(['start','end','center','stretch','baseline'].includes(value),'invalid-flex-alignment','Unknown cross axis alignment');this.change(this.crossAlignment,value,()=>{this.crossAlignment=value;});}
  get crossAlign():CrossAxisAlignment{return this.crossAxisAlignment;}set crossAlign(value:CrossAxisAlignment){this.assertCanMutateLayoutProperty();this.crossAxisAlignment=value;}
  get mainAxisAlignment():MainAxisAlignment{return this.mainAlignment;}set mainAxisAlignment(value:MainAxisAlignment){this.assertCanMutateLayoutProperty();invariant(['start','end','center','spaceBetween','spaceAround','spaceEvenly'].includes(value),'invalid-flex-alignment','Unknown main axis alignment');this.change(this.mainAlignment,value,()=>{this.mainAlignment=value;});}
  get textDirection():'ltr'|'rtl'|null{return this.textFlow;}set textDirection(value:'ltr'|'rtl'|null){this.assertCanMutateLayoutProperty();invariant(value===null||value==='ltr'||value==='rtl','invalid-text-direction','Unknown text direction');this.change(this.textFlow,value,()=>{this.textFlow=value;});}
  get verticalDirection():'up'|'down'{return this.verticalFlow;}set verticalDirection(value:'up'|'down'){this.assertCanMutateLayoutProperty();invariant(value==='up'||value==='down','invalid-vertical-direction','Unknown vertical direction');this.change(this.verticalFlow,value,()=>{this.verticalFlow=value;});}
  get textBaseline():TextBaseline|null{return this.baselineType;}set textBaseline(value:TextBaseline|null){this.assertCanMutateLayoutProperty();invariant(value===null||value==='alphabetic'||value==='ideographic','invalid-baseline','Unknown baseline');this.change(this.baselineType,value,()=>{this.baselineType=value;});}
  get clipBehavior():'none'|'hardEdge'{return this.clipping;}set clipBehavior(value:'none'|'hardEdge'){this.assertCanMutateLayoutProperty();invariant(value==='none'||value==='hardEdge','invalid-clip','Unsupported flex clip');if(value!==this.clipping){this.clipping=value;this.markNeedsPaint();}}
  private validateConfiguration():void{invariant(this.axis==='horizontal'||this.axis==='vertical','invalid-flex-direction','Unknown flex direction');invariant(Number.isFinite(this.gap)&&this.gap>=0,'invalid-spacing','Flex spacing must be finite and nonnegative');invariant(['min','max'].includes(this.mainSizing)&&['start','end','center','stretch','baseline'].includes(this.crossAlignment)&&['start','end','center','spaceBetween','spaceAround','spaceEvenly'].includes(this.mainAlignment),'invalid-flex-alignment','Unknown flex alignment');invariant(this.textFlow===null||this.textFlow==='ltr'||this.textFlow==='rtl','invalid-text-direction','Unknown text direction');invariant(this.verticalFlow==='up'||this.verticalFlow==='down','invalid-vertical-direction','Unknown vertical direction');invariant(this.baselineType===null||this.baselineType==='alphabetic'||this.baselineType==='ideographic','invalid-baseline','Unknown baseline');invariant(this.clipping==='none'||this.clipping==='hardEdge','invalid-clip','Unsupported flex clip');}
  overflow=0;
  override get clips():boolean{return this.clipping!=='none'&&this.overflow>1e-10;}
  override setupParentData(child:RenderObject):void{if(!(child.parentData instanceof FlexParentData))child.parentData=new FlexParentData();}
  private main(size:Size):number{return this.axis==='horizontal'?size.width:size.height;}
  private cross(size:Size):number{return this.axis==='horizontal'?size.height:size.width;}
  private axisSize(main:number,cross:number):Size{return this.axis==='horizontal'?{width:main,height:cross}:{width:cross,height:main};}
  private item(child:RenderBox<RenderObject>,index:number):FlexItem{const value=this.legacyItems[index]??child.parentData as FlexParentData;invariant(Number.isSafeInteger(value.flex)&&value.flex>=0&&(value.fit==='tight'||value.fit==='loose'),'invalid-flex','Flex factors must be nonnegative safe integers and fit tight/loose');return value;}
  private measure(constraints:BoxConstraints,layout:(child:RenderBox<RenderObject>,constraints:BoxConstraints)=>Size,baseline:(child:RenderBox<RenderObject>,constraints:BoxConstraints,baseline:TextBaseline)=>number|null,checkDirections=true):FlexMeasure{
    const snapshot=this.children;
    if(checkDirections)invariant(this.textFlow!==null||!(this.axis==='horizontal'&&(snapshot.length>1||this.mainAlignment==='start'||this.mainAlignment==='end')||this.axis==='vertical'&&(this.crossAlignment==='start'||this.crossAlignment==='end')),'missing-text-direction','Flex alignment/order requires textDirection');
    const maxMain=this.main(constraints.biggest),maxCross=this.cross(constraints.biggest),canFlex=Number.isFinite(maxMain),isBaseline=this.axis==='horizontal'&&this.crossAlignment==='baseline';invariant(!isBaseline||this.baselineType!==null,'missing-flex-baseline','Baseline alignment requires textBaseline');
    const childConstraints=(min:number,max:number)=>this.axis==='horizontal'?new BoxConstraints(min,max,this.crossAlignment==='stretch'?maxCross:0,maxCross):new BoxConstraints(this.crossAlignment==='stretch'?maxCross:0,maxCross,min,max);
    // One pass-local ordered record per child replaces the item projection,
    // measurement Map and placement Map. Never retain these records on the
    // renderer: dry queries can reenter with other constraints, and a failed
    // measurement must not publish partially computed offsets.
    let used=Math.max(0,snapshot.length-1)*this.gap,cross=0,totalFlex=0,ascent:number|null=null,descent:number|null=null;
    const children:FlexChildMeasure[]=snapshot.map((child,index)=>({child,item:this.item(child,index),size:undefined,constraints:undefined,baseline:null,x:0,y:0}));
    const measureChild=(value:FlexChildMeasure,inner:BoxConstraints)=>{const size=layout(value.child,inner),base=isBaseline?baseline(value.child,inner,this.baselineType!):null;value.size=size;value.constraints=inner;value.baseline=base;used+=this.main(size);cross=Math.max(cross,this.cross(size));if(base!==null){ascent=Math.max(ascent??base,base);const childDescent=this.cross(size)-base;descent=Math.max(descent??childDescent,childDescent);}};
    for(const value of children){const item=value.item;invariant(!checkDirections||canFlex||!item.flex||this.mainSizing==='min'&&item.fit==='loose','unbounded-flex','Unbounded flex requires mainAxisSize min and loose fits');if(canFlex&&item.flex)totalFlex+=item.flex;else measureChild(value,childConstraints(0,Infinity));}
    const spacePerFlex=totalFlex?Math.max(0,maxMain-used)/totalFlex:0;for(const value of children){const item=value.item;if(canFlex&&item.flex){const max=spacePerFlex*item.flex;measureChild(value,childConstraints(item.fit==='tight'?max:0,max));}}
    if(ascent!==null)cross=Math.max(cross,ascent+descent!);return {size:constraints.constrain(this.axisSize(this.mainSizing==='max'&&canFlex?maxMain:used,cross)),used,baseline:ascent,children};
  }
  private distribution(free:number,count:number,flip:boolean):[number,number]{switch(this.mainAlignment){case 'start':return [flip?free:0,this.gap];case 'end':return [flip?0:free,this.gap];case 'center':return [free/2,this.gap];case 'spaceBetween':return count<2?[flip?free:0,this.gap]:[0,free/(count-1)+this.gap];case 'spaceAround':return count===0?[flip?free:0,this.gap]:[free/count/2,free/count+this.gap];case 'spaceEvenly':return [free/(count+1),free/(count+1)+this.gap];}}
  private positionChildren(measured:FlexMeasure):boolean{
    const horizontal=this.axis==='horizontal',flipMain=horizontal?this.textFlow==='rtl':this.verticalFlow==='up',flipCross=horizontal?this.verticalFlow==='up':this.textFlow==='rtl',children=measured.children,[leading,between]=this.distribution(Math.max(0,this.main(measured.size)-measured.used),children.length,flipMain);
    let position=leading;for(let index=flipMain?children.length-1:0;flipMain?index>=0:index<children.length;index+=flipMain?-1:1){const value=children[index]!,free=this.cross(measured.size)-this.cross(value.size!);let cross=0;if(horizontal&&this.crossAlignment==='baseline')cross=value.baseline!==null&&measured.baseline!==null?measured.baseline-value.baseline:0;else if(this.crossAlignment==='center')cross=free/2;else if(this.crossAlignment==='start')cross=flipCross?free:0;else if(this.crossAlignment==='end')cross=flipCross?0:free;value.x=horizontal?position:cross;value.y=horizontal?cross:position;position+=this.main(value.size!)+between;}return flipMain;
  }
  private dryMeasure(constraints:BoxConstraints):FlexMeasure{return this.measure(constraints,dryFlexChild,dryFlexBaseline);}
  protected computeDryLayout(constraints:BoxConstraints):Size{return this.dryMeasure(constraints).size;}
  protected performLayout(constraints:BoxConstraints):Size{const measured=this.measure(constraints,wetFlexChild,wetFlexBaseline),flip=this.positionChildren(measured),children=measured.children;for(let index=flip?children.length-1:0;flip?index>=0:index<children.length;index+=flip?-1:1){const value=children[index]!;value.child.layoutOffset={x:value.x,y:value.y};}this.overflow=Math.max(0,measured.used-this.main(measured.size));return measured.size;}
  protected computeDryBaseline(constraints:BoxConstraints,baseline:TextBaseline):number|null{const measured=this.dryMeasure(constraints);if(this.axis==='horizontal'&&this.crossAlignment==='baseline')return measured.baseline;this.positionChildren(measured);let result:number|null=null;for(const child of measured.children){const value=child.child.getDryBaseline(child.constraints!,baseline);if(value!==null){const candidate=value+child.y;if(this.axis==='vertical')return candidate;result=result===null?candidate:Math.min(result,candidate);}}return result;}
  protected computeDistanceToActualBaseline(baseline:TextBaseline):number|null{let result:number|null=null;for(const child of this.children){const value=child.getDistanceToActualBaseline(baseline);if(value!==null){const candidate=value+child.layoutOffset.y;if(this.axis==='vertical')return candidate;result=result===null?candidate:Math.min(result,candidate);}}return result;}
  private intrinsicSize(axis:'horizontal'|'vertical',extent:number,childSize:(child:RenderBox<RenderObject>,extent:number)=>number):number{
    if(axis===this.axis){let totalFlex=0,fixed=Math.max(0,this.children.length-1)*this.gap,fraction=0;this.children.forEach((child,index)=>{const flex=this.item(child,index).flex;totalFlex+=flex;const size=childSize(child,extent);if(flex)fraction=Math.max(fraction,size/flex);else fixed+=size;});return (totalFlex?fraction*totalFlex:0)+fixed;}
    const horizontal=this.axis==='horizontal',constraints=horizontal?new BoxConstraints(0,extent):new BoxConstraints(0,Infinity,0,extent);return this.cross(this.measure(constraints,(child,c)=>{const max=horizontal?c.maxWidth:c.maxHeight,main=Number.isFinite(max)?max:horizontal?child.getMaxIntrinsicWidth(Infinity):child.getMaxIntrinsicHeight(Infinity);return this.axisSize(main,childSize(child,main));},(child,c,b)=>child.getDryBaseline(c,b),false).size);
  }
  protected computeMinIntrinsicWidth(height:number):number{return this.intrinsicSize('horizontal',height,(child,value)=>child.getMinIntrinsicWidth(value));}
  protected computeMaxIntrinsicWidth(height:number):number{return this.intrinsicSize('horizontal',height,(child,value)=>child.getMaxIntrinsicWidth(value));}
  protected computeMinIntrinsicHeight(width:number):number{return this.intrinsicSize('vertical',width,(child,value)=>child.getMinIntrinsicHeight(value));}
  protected computeMaxIntrinsicHeight(width:number):number{return this.intrinsicSize('vertical',width,(child,value)=>child.getMaxIntrinsicHeight(value));}
  override paint(context:PaintingContext):void{if(this.clips){context.save();context.clip(this.paintBounds);super.paint(context);context.restore();}else super.paint(context);}
}
export class RelativeRect {
  constructor(readonly left:number,readonly top:number,readonly right:number,readonly bottom:number){}
  static fromLTRB(left:number,top:number,right:number,bottom:number):RelativeRect{return new RelativeRect(left,top,right,bottom);}
  static fromSize(rect:Rect,container:Size):RelativeRect{return new RelativeRect(rect.x,rect.y,container.width-rect.x-rect.width,container.height-rect.y-rect.height);}
  static fromRect(rect:Rect,container:Rect):RelativeRect{return new RelativeRect(rect.x-container.x,rect.y-container.y,container.x+container.width-rect.x-rect.width,container.y+container.height-rect.y-rect.height);}
  static fromDirectional(options:{readonly textDirection:'ltr'|'rtl';readonly start:number;readonly top:number;readonly end:number;readonly bottom:number}):RelativeRect{invariant(options.textDirection==='ltr'||options.textDirection==='rtl','invalid-text-direction','Unknown text direction');return new RelativeRect(options.textDirection==='rtl'?options.end:options.start,options.top,options.textDirection==='rtl'?options.start:options.end,options.bottom);}
  static readonly fill:RelativeRect=Object.freeze(new RelativeRect(0,0,0,0));
  get hasInsets():boolean{return this.left>0||this.top>0||this.right>0||this.bottom>0;}
  shift(offset:Offset):RelativeRect{return new RelativeRect(this.left+offset.x,this.top+offset.y,this.right-offset.x,this.bottom-offset.y);}
  inflate(delta:number):RelativeRect{return new RelativeRect(this.left-delta,this.top-delta,this.right-delta,this.bottom-delta);}
  deflate(delta:number):RelativeRect{return this.inflate(-delta);}
  intersect(other:RelativeRect):RelativeRect{return new RelativeRect(Math.max(this.left,other.left),Math.max(this.top,other.top),Math.max(this.right,other.right),Math.max(this.bottom,other.bottom));}
  toRect(container:Rect):Rect{return Object.freeze({x:this.left,y:this.top,width:container.width-this.left-this.right,height:container.height-this.top-this.bottom});}
  toSize(container:Size):Size{return Object.freeze({width:container.width-this.left-this.right,height:container.height-this.top-this.bottom});}
  static lerp(a:RelativeRect|null|undefined,b:RelativeRect|null|undefined,t:number):RelativeRect|null{if(a===b||a==null&&b==null)return a??null;const mix=(start:number,end:number)=>start*(1-t)+end*t;return new RelativeRect(mix(a?.left??0,b?.left??0),mix(a?.top??0,b?.top??0),mix(a?.right??0,b?.right??0),mix(a?.bottom??0,b?.bottom??0));}
  equals(other:unknown):boolean{return other===this||other instanceof RelativeRect&&this.left===other.left&&this.top===other.top&&this.right===other.right&&this.bottom===other.bottom;}
  get hashCode():number{let hash=2166136261;for(const char of [this.left,this.top,this.right,this.bottom].join(','))hash=Math.imul(hash^char.charCodeAt(0),16777619);return hash>>>0;}
  toString():string{return `RelativeRect.fromLTRB(${[this.left,this.top,this.right,this.bottom].map(value=>value.toFixed(1)).join(', ')})`;}
}
export class StackParentData extends ContainerBoxParentData<RenderBox> {
  top:number|undefined;right:number|undefined;bottom:number|undefined;left:number|undefined;width:number|undefined;height:number|undefined;
  get isPositioned():boolean{return [this.top,this.right,this.bottom,this.left,this.width,this.height].some(value=>value!==undefined);}
  get rect():RelativeRect{invariant(this.left!==undefined&&this.top!==undefined&&this.right!==undefined&&this.bottom!==undefined,'incomplete-relative-rect','RelativeRect requires all four edges');return new RelativeRect(this.left,this.top,this.right,this.bottom);}
  set rect(value:RelativeRect){assertOutsideRenderPaint();this.left=value.left;this.top=value.top;this.right=value.right;this.bottom=value.bottom;}
  positionedChildConstraints(size:Size):BoxConstraints{invariant(this.isPositioned,'non-positioned-child','Positioned constraints require positioned parent data');const width=this.left!==undefined&&this.right!==undefined?size.width-this.left-this.right:this.width,height=this.top!==undefined&&this.bottom!==undefined?size.height-this.top-this.bottom:this.height;return BoxConstraints.tightFor(width===undefined?undefined:Math.max(0,width),height===undefined?undefined:Math.max(0,height));}
}
export type StackFit='loose'|'expand'|'passthrough';
export interface RenderStackOptions {readonly children?:readonly RenderBox<RenderObject>[];readonly alignment?:AlignmentGeometry;readonly textDirection?:'ltr'|'rtl'|null;readonly fit?:StackFit;readonly clipBehavior?:Clip}
export class RenderStack extends RenderBox {
  protected get stackLayoutChildren():readonly RenderBox<RenderObject>[]{return this.children;}
  private sizing:StackFit='loose';private _alignment:AlignmentGeometry=AlignmentDirectional.topStart;private _textDirection:'ltr'|'rtl'|null=null;private _resolvedAlignmentCache:Alignment|undefined;private clipping:Clip='hardEdge';
  constructor(options:RenderStackOptions={}){super();const alignment=options.alignment??AlignmentDirectional.topStart,direction=options.textDirection??null,fit=options.fit??'loose',clip=options.clipBehavior??'hardEdge';invariant(alignment instanceof AlignmentGeometry,'invalid-stack-alignment','AlignmentGeometry is required');invariant(direction===null||direction==='ltr'||direction==='rtl','invalid-text-direction','Unknown stack text direction');invariant(['loose','expand','passthrough'].includes(fit),'invalid-stack-fit','Unknown StackFit');invariant(['none','hardEdge','antiAlias','antiAliasWithSaveLayer'].includes(clip),'invalid-clip','Unknown stack clip');this._alignment=alignment;this._textDirection=direction;this.sizing=fit;this.clipping=clip;if(options.children)this.setChildren(options.children);}
  private get _resolvedAlignment():Alignment{return this._resolvedAlignmentCache??=this.alignment.resolve(this.textDirection);}
  private _markNeedResolution():void{this._resolvedAlignmentCache=undefined;this.markNeedsLayout();}
  get alignment():AlignmentGeometry{return this._alignment;}set alignment(value:AlignmentGeometry){this.assertCanMutateLayoutProperty();invariant(value instanceof AlignmentGeometry,'invalid-stack-alignment','AlignmentGeometry is required');if(this._alignment.equals(value))return;this._alignment=value;this._markNeedResolution();}
  get textDirection():'ltr'|'rtl'|null{return this._textDirection;}set textDirection(value:'ltr'|'rtl'|null){this.assertCanMutateLayoutProperty();invariant(value===null||value==='ltr'||value==='rtl','invalid-text-direction','Unknown stack text direction');if(this._textDirection===value)return;this._textDirection=value;this._markNeedResolution();}
  get fit():StackFit{return this.sizing;}set fit(value:StackFit){this.assertCanMutateLayoutProperty();invariant(['loose','expand','passthrough'].includes(value),'invalid-stack-fit','Unknown StackFit');if(value!==this.sizing){this.sizing=value;this.markNeedsLayout();}}
  get alignmentX():number{return this.alignment.resolve(this.textDirection??'ltr').x;}set alignmentX(value:number){invariant(Number.isFinite(value),'invalid-stack-alignment','Stack alignment must be finite');this.alignment=new Alignment(value,this.alignmentY);}
  get alignmentY():number{return this.alignment.resolve(this.textDirection??'ltr').y;}set alignmentY(value:number){invariant(Number.isFinite(value),'invalid-stack-alignment','Stack alignment must be finite');this.alignment=new Alignment(this.alignmentX,value);}
  get clipBehavior():Clip{return this.clipping;}set clipBehavior(value:Clip){this.assertCanMutateLayoutProperty();invariant(['none','hardEdge','antiAlias','antiAliasWithSaveLayer'].includes(value),'invalid-clip','Unknown stack clip');if(value!==this.clipping){this.clipping=value;this.markNeedsPaint();}}
  private visualOverflow=false;
  override get clips():boolean{return this.clipBehavior!=='none'&&this.visualOverflow;}
  override setupParentData(child:RenderObject):void{if(!(child.parentData instanceof StackParentData))child.parentData=new StackParentData();}
  private innerConstraints(constraints:BoxConstraints):BoxConstraints{return this.sizing==='loose'?constraints.loosen():this.sizing==='expand'?BoxConstraints.tight(constraints.biggest):constraints;}
  private measure(constraints:BoxConstraints,layout:(child:RenderBox<RenderObject>,inner:BoxConstraints)=>Size):Size{
    if(!this.stackLayoutChildren.length)return Number.isFinite(constraints.maxWidth)&&Number.isFinite(constraints.maxHeight)?{width:constraints.maxWidth,height:constraints.maxHeight}:{width:constraints.minWidth,height:constraints.minHeight};
    let width=constraints.minWidth,height=constraints.minHeight,nonPositioned=false;const inner=this.innerConstraints(constraints);
    for(const child of this.stackLayoutChildren){const data=child.parentData as StackParentData;if(!data.isPositioned){nonPositioned=true;const measured=layout(child,inner);width=Math.max(width,measured.width);height=Math.max(height,measured.height);}}
    const size=nonPositioned?constraints.constrain({width,height}):{width:constraints.maxWidth,height:constraints.maxHeight};
    invariant(Number.isFinite(size.width)&&Number.isFinite(size.height),'unbounded-stack','A Stack with only positioned children requires bounded width and height');
    return size;
  }
  private childOffset(data:StackParentData,size:Size,child:Size,alignment:Alignment):Offset{const delta=new OffsetValue(size.width-child.width,size.height-child.height);if(!data.isPositioned)return alignment.alongOffset(delta);return {x:data.left??(data.right!==undefined?size.width-data.right-child.width:alignment.alongOffset(delta).dx),y:data.top??(data.bottom!==undefined?size.height-data.bottom-child.height:alignment.alongOffset(delta).dy)};}
  protected computeDryLayout(constraints:BoxConstraints):Size{return this.measure(constraints,(child,c)=>child.getDryLayout(c));}
  protected performLayout(constraints:BoxConstraints):Size{this.visualOverflow=false;const size=this.measure(constraints,(child,c)=>{child.layout(c,{parentUsesSize:true});return child.size;}),alignment=this._resolvedAlignment;for(const child of this.stackLayoutChildren){const data=child.parentData as StackParentData;if(data.isPositioned)child.layout(data.positionedChildConstraints(size),{parentUsesSize:true});child.layoutOffset=this.childOffset(data,size,child.size,alignment);if(data.isPositioned)this.visualOverflow||=child.layoutOffset.x<0||child.layoutOffset.y<0||child.layoutOffset.x+child.size.width>size.width||child.layoutOffset.y+child.size.height>size.height;}return size;}
  private maxNonPositionedIntrinsic(childSize:(child:RenderBox<RenderObject>)=>number):number{let extent=0;for(const child of this.stackLayoutChildren)if(!(child.parentData as StackParentData).isPositioned)extent=Math.max(extent,childSize(child));return extent;}
  protected computeMinIntrinsicWidth(height:number):number{return this.maxNonPositionedIntrinsic(child=>child.getMinIntrinsicWidth(height));}
  protected computeMaxIntrinsicWidth(height:number):number{return this.maxNonPositionedIntrinsic(child=>child.getMaxIntrinsicWidth(height));}
  protected computeMinIntrinsicHeight(width:number):number{return this.maxNonPositionedIntrinsic(child=>child.getMinIntrinsicHeight(width));}
  protected computeMaxIntrinsicHeight(width:number):number{return this.maxNonPositionedIntrinsic(child=>child.getMaxIntrinsicHeight(width));}
  protected computeDryBaseline(constraints:BoxConstraints,baseline:TextBaseline):number|null{const size=this.getDryLayout(constraints),alignment=this._resolvedAlignment;let result:number|null=null;for(const child of this.stackLayoutChildren){const data=child.parentData as StackParentData,inner=data.isPositioned?data.positionedChildConstraints(size):this.innerConstraints(constraints),value=child.getDryBaseline(inner,baseline);if(value!==null){const candidate=value+this.childOffset(data,size,child.getDryLayout(inner),alignment).y;result=result===null?candidate:Math.min(result,candidate);}}return result;}
  protected computeDistanceToActualBaseline(baseline:TextBaseline):number|null{let result:number|null=null;for(const child of this.stackLayoutChildren){const value=child.getDistanceToActualBaseline(baseline);if(value!==null){const candidate=value+child.layoutOffset.y;result=result===null?candidate:Math.min(result,candidate);}}return result;}
  protected paintStack(context:PaintingContext):void{super.paint(context);}
  override paint(context:PaintingContext):void{if(!this.clips){this.paintStack(context);return;}context.save();try{context.clipRect(this.paintBounds,{doAntiAlias:this.clipBehavior!=='hardEdge'});if(this.clipBehavior==='antiAliasWithSaveLayer'){context.saveLayer(this.paintBounds,new Paint());try{this.paintStack(context);}finally{context.restore();}}else this.paintStack(context);}finally{context.restore();}}
}
export class RenderDecoratedBox extends RenderConstrainedBox {
  private value:Decoration;private placement:DecorationPosition='background';private config=ImageConfiguration.empty;private painter:BoxPainter|null=null;private generation=0;
  constructor(decoration:Decoration|number,radius=0){super();this.value=typeof decoration==='number'?new BoxDecoration({color:decoration,borderRadius:radius>0?BorderRadius.circular(radius):null}):decoration;this.value.debugAssertIsValid();}
  get decoration():Decoration{return this.value;}
  set decoration(value:Decoration){this.assertCanMutateLayoutProperty();value.debugAssertIsValid();if(valueEquals(value,this.value))return;this.value=value;try{this.releasePainter();}finally{this.markDecorationNeedsPaint();}}
  get position():DecorationPosition{return this.placement;}
  set position(value:DecorationPosition){this.assertCanMutateLayoutProperty();invariant(value==='background'||value==='foreground','invalid-decoration-position','Unknown decoration position');if(this.placement===value)return;this.placement=value;this.markDecorationNeedsPaint();}
  get configuration():ImageConfiguration{return this.config;}
  set configuration(value:ImageConfiguration){this.assertCanMutateLayoutProperty();if(this.config.equals(value))return;this.config=value;this.markDecorationNeedsPaint();}
  /** Legacy color/radius constructor and properties remain available. */
  get color():number{return this.value instanceof BoxDecoration?this.value.color??0:0;}
  set color(value:number){invariant(this.value instanceof BoxDecoration,'invalid-decoration','color requires a BoxDecoration');this.decoration=this.value.copyWith({color:value});}
  get radius():number{return this.value instanceof BoxDecoration?this.value.borderRadius?.resolve('ltr').topLeft.x??0:0;}
  set radius(value:number){invariant(this.value instanceof BoxDecoration,'invalid-decoration','radius requires a BoxDecoration');const {color,border,boxShadow,gradient,backgroundBlendMode,shape}=this.value;this.decoration=new BoxDecoration({color,border,boxShadow,gradient,backgroundBlendMode,shape,borderRadius:value>0?BorderRadius.circular(value):null});}
  private markDecorationNeedsPaint():void{if(this.hasDefaultPaintSemantics(RenderDecoratedBox.prototype))this.markNeedsPaintOnly();else this.markNeedsPaint();}
  private releasePainter():void{const painter=this.painter;this.painter=null;this.generation++;painter?.dispose();}
  protected override hitTestSelf(position:Offset):boolean{return this.value.hitTest(this.size,position,{textDirection:this.config.textDirection});}
  override paint(context:PaintingContext):void{if(!this.painter){const generation=this.generation;this.painter=this.value.createBoxPainter(()=>{if(this.attached&&!this.debugDisposed&&generation===this.generation)this.markDecorationNeedsPaint();});}const paint=()=>this.painter!.paint(context,OffsetValue.zero,this.config.copyWith({size:this.size}));if(this.placement==='background')paint();super.paint(context);if(this.placement==='foreground')paint();}
  private finishAndRelease(action:()=>void,eligible:()=>boolean):void{const errors:unknown[]=[];try{action();}catch(error){errors.push(error);}if(eligible())try{this.releasePainter();}catch(error){errors.push(error);}if(errors.length===1)throw errors[0];if(errors.length>1)throw new AggregateError(errors,'Decoration and render teardown failed');}
  override detach():void{this.finishAndRelease(()=>super.detach(),()=>!this.attached);}
  override dispose():void{this.finishAndRelease(()=>super.dispose(),()=>this.debugDisposed);}
}
export class RenderClip extends RenderConstrainedBox {
  override get clips():boolean {return true;}
  override paint(context:PaintingContext):void {context.save();context.clip({x:0,y:0,...this.size});super.paint(context);context.restore();}
}
export interface TransformOptions {readonly origin?:Offset|null;readonly alignment?:AlignmentGeometry|Offset|null;readonly textDirection?:'ltr'|'rtl'|null;readonly transformHitTests?:boolean;readonly filterQuality?:FilterQuality|null}
export class RenderTransform extends RenderConstrainedBox {
  private value:TransformMatrix;private pivot:Offset|null=null;private aligned:AlignmentGeometry|null=null;private textFlow:'ltr'|'rtl'|null=null;private hitTransforms=true;
  private quality:FilterQuality|null=null;private readonly filteredLayer=new LayerHandle<ImageFilterLayer>();
  constructor(matrix:readonly number[]|Float64Array,options:TransformOptions={}){super();invariant(Object.keys(options).every(key=>['origin','alignment','textDirection','transformHitTests','filterQuality'].includes(key)),'unsupported-transform','Unknown transform option');this.value=captureTransform(matrix);this.origin=options.origin??null;this.alignment=options.alignment??null;this.textDirection=options.textDirection??null;this.transformHitTests=options.transformHitTests??true;this.filterQuality=options.filterQuality??null;}
  get matrix():TransformMatrix{return this.value;}
  set matrix(value:readonly number[]|Float64Array){this.assertCanMutateLayoutProperty();const next=captureTransform(value);if(this.value.length===next.length&&next.every((n,i)=>n===this.value[i]))return;this.value=next;this.markTransformNeedsPaint();}
  set transform(value:readonly number[]|Float64Array){this.matrix=value;}
  private capturePoint(value:Offset|null):Offset|null{if(value===null)return null;const {x,y}=value;invariant(Number.isFinite(x)&&Number.isFinite(y),'invalid-transform','Transform origin/alignment must be finite');return Object.freeze({x,y});}
  get origin():Offset|null{return this.pivot;}
  set origin(value:Offset|null){this.assertCanMutateLayoutProperty();const next=this.capturePoint(value);if(next?.x===this.pivot?.x&&next?.y===this.pivot?.y)return;this.pivot=next;this.markTransformNeedsPaint();}
  get alignment():AlignmentGeometry|null{return this.aligned;}
  set alignment(value:AlignmentGeometry|Offset|null){this.assertCanMutateLayoutProperty();const point=value instanceof AlignmentGeometry?null:this.capturePoint(value),next=value instanceof AlignmentGeometry?value:point===null?null:new Alignment(point.x,point.y);if(this.aligned===null?next===null:this.aligned.equals(next))return;this.aligned=next;this.markTransformNeedsPaint();}
  get textDirection():'ltr'|'rtl'|null{return this.textFlow;}
  set textDirection(value:'ltr'|'rtl'|null){this.assertCanMutateLayoutProperty();invariant(value===null||value==='ltr'||value==='rtl','invalid-text-direction','Unknown transform text direction');if(value===this.textFlow)return;this.textFlow=value;this.markTransformNeedsPaint();}
  get transformHitTests():boolean{return this.hitTransforms;}
  set transformHitTests(value:boolean){this.assertCanMutateLayoutProperty();invariant(typeof value==='boolean','invalid-transform','transformHitTests must be boolean');this.hitTransforms=value;}
  get filterQuality():FilterQuality|null{return this.quality;}
  set filterQuality(value:FilterQuality|null){this.assertCanMutateLayoutProperty();invariant(value===null||['none','low','medium','high'].includes(value),'invalid-filter-quality','Unknown transform filter quality');if(value===this.quality)return;this.quality=value;this.markTransformNeedsPaint();}
  private markTransformNeedsPaint():void{if(this.hasDefaultPaintSemantics(RenderTransform.prototype))this.markNeedsPaintAfterGeometryChange();else this.markNeedsPaint();}
  private get effective():TransformMatrix{const origin=this.pivot,alignment=this.aligned?.resolve(this.textFlow);if(!origin&&!alignment)return this.value;let result:TransformMatrix=identity;if(origin)result=multiply(result,translate(origin.x,origin.y));const point=alignment?.alongSize(this.size);if(point)result=multiply(result,translate(point.dx,point.dy));result=multiply(result,this.value);if(point)result=multiply(result,translate(-point.dx,-point.dy));if(origin)result=multiply(result,translate(-origin.x,-origin.y));return result;}
  protected override childTransform(child:RenderObject):TransformMatrix{return multiply(this.effective,super.childTransform(child));}
  override paint(context:PaintingContext):void{
    const child=this.children[0];if(!child){this.filteredLayer.dispose();return;}
    if(this.quality===null){this.filteredLayer.dispose();if(inverse(this.effective))super.paint(context);return;}
    const filter=ImageFilter.matrix(fullTransform(this.effective),{filterQuality:this.quality}),layer=this.filteredLayer.layer??new ImageFilterLayer({imageFilter:filter}),hold=new LayerHandle(layer);
    try{layer.imageFilter=filter;context.pushLayer(layer,childContext=>childContext.paintChild(child,super.childTransform(child)),{x:0,y:0},this.paintBounds);this.filteredLayer.layer=layer;}finally{hold.dispose();}
  }
  override detach():void{try{super.detach();}finally{if(!this.attached)this.filteredLayer.dispose();}}
  override dispose():void{try{super.dispose();}finally{if(this.debugDisposed)this.filteredLayer.dispose();}}
  override hitTest(position:Offset,result:HitTestEntry[],toLocal:TransformMatrix=identity):boolean{return this.hitTestChildren(position,result,toLocal);}
  hitTestChildren(position:Offset,result:HitTestEntry[],toLocal:TransformMatrix=identity):boolean{const child=this.children[0];if(!child)return false;const matrix=inversePaintTransform(this.hitTransforms?this.childTransform(child):super.childTransform(child));return !!matrix&&child.hitTest(transform(matrix,position),result,multiply(matrix,toLocal));}
  setIdentity():void{this.matrix=identity;}
  rotateX(radians:number):void{const c=Math.cos(radians),s=Math.sin(radians);this.matrix=multiply(this.value,captureTransform([1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1]));}
  rotateY(radians:number):void{const c=Math.cos(radians),s=Math.sin(radians);this.matrix=multiply(this.value,captureTransform([c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]));}
  rotateZ(radians:number):void{const c=Math.cos(radians),s=Math.sin(radians);this.matrix=multiply(this.value,[c,s,-s,c,0,0]);}
  translate(x:number,y=0,z=0):void{this.matrix=multiply(this.value,captureTransform([1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1]));}
  scale(x:number,y=x,z=x):void{this.matrix=multiply(this.value,captureTransform([x,0,0,0,0,y,0,0,0,0,z,0,0,0,0,1]));}
}
export class RenderImage extends RenderBox {
  protected override get childCountLimit():number{return 0;}
  override setChildren(children:readonly RenderBox[]):void {invariant(children.length===0,'invalid-render-child','RenderImage cannot have children');super.setChildren(children);}
  constructor(public resource:ResourceId,public width:number,public height:number){super();}
  protected computeDryLayout(constraints:BoxConstraints):Size{return constraints.constrain({width:this.width,height:this.height});}
  protected computeMinIntrinsicWidth(_height:number):number{return this.width;}
  protected computeMaxIntrinsicWidth(_height:number):number{return this.width;}
  protected computeMinIntrinsicHeight(_width:number):number{return this.height;}
  protected computeMaxIntrinsicHeight(_width:number):number{return this.height;}
  protected performLayout(constraints:BoxConstraints):Size {return constraints.constrain({width:this.width,height:this.height});}
  override paint(context:PaintingContext):void {context.image(this.resource,{x:0,y:0,...this.size});}
}
// These exact built-ins describe no size-dependent semantic configuration.
// Keep their source fragments on resize and refresh bounds/clip/transforms;
// custom subclasses, instance hooks and changed child membership stay conservative.
RenderBox._registerGeometryLayoutSemantics(...[
  RenderProxyBox,RenderConstrainedBox,RenderPadding,RenderPositionedBox,RenderAlign,
  RenderLimitedBox,RenderAspectRatio,RenderIntrinsicWidth,RenderIntrinsicHeight,
  RenderIgnoreBaseline,RenderBaseline,RenderFlex,RenderStack,RenderDecoratedBox,
  RenderClip,RenderTransform,RenderImage,
].map(type=>type.prototype));
/** Shared selection identity; concrete paragraphs own their source configuration and layout. */
export abstract class RenderParagraph extends RenderBox {
  protected override get childCountLimit():number{return 0;}
  override setChildren(children:readonly RenderBox[]):void {invariant(children.length<=this.childCountLimit,'invalid-render-child','RenderParagraph child capacity exceeded');super.setChildren(children);}
  private static nextSemanticsId=0;
  readonly semanticsId='text-'+(++RenderParagraph.nextSemanticsId);
  paragraph:TextLayout|undefined;
  private selectionRegistrar:SelectionRegistrar|null=null;
  private fragments:readonly SelectableParagraphFragment[]|null=null;
  private highlightColor:number|null=null;
  protected paintOffsetX=0;
  constructor(protected readonly painter:TextPainter){super();}
  abstract get paragraphOptions():ParagraphLayoutOptions;
  abstract set paragraphOptions(value:ParagraphLayoutOptions);
  abstract get plainText():string;
  get textDirection():'ltr'|'rtl'{return this.painter.textDirection??'ltr';}
  get registrar():SelectionRegistrar|null{return this.selectionRegistrar;}
  set registrar(value:SelectionRegistrar|null){this.assertCanMutateLayoutProperty();if(value===this.selectionRegistrar)return;this.disposeSelectionFragments();this.selectionRegistrar=value;this.registerSelectionFragments();}
  get selectionColor():number|null{return this.highlightColor;}
  set selectionColor(value:number|null){if(value===this.highlightColor)return;this.highlightColor=value;if(this.fragments?.some(fragment=>fragment.value.hasSelection))this.markNeedsPaint();}
  get selections():readonly TextSelection[]{return this.fragments?.flatMap(fragment=>fragment.selection?[fragment.selection]:[])??[];}
  selectableBelongsToParagraph(selectable:Selectable):boolean{return this.fragments?.includes(selectable as SelectableParagraphFragment)??false;}
  /** @internal The source paragraph and fragment share painter/layout state. */
  get selectionPainter():TextPainter{return this.painter;}
  /** @internal Nested WidgetSpan paragraph boundary traversal. */
  get selectionFragments():readonly SelectableParagraphFragment[]|null{return this.fragments;}
  getPositionForOffset(offset:Offset):TextPosition{return this.painter.getPositionForOffset(offset);}
  getBoxesForSelection(selection:TextSelection,options:{readonly boxHeightStyle?:BoxHeightStyle;readonly boxWidthStyle?:BoxWidthStyle}={}):readonly TextBox[]{return this.painter.getBoxesForSelection(selection,options);}
  getOffsetForCaret(position:TextPosition,caretPrototype:{readonly width:number}):OffsetValue{return this.painter.getOffsetForCaret(position,caretPrototype);}
  getFullHeightForCaret(position:TextPosition):number{return this.painter.getFullHeightForCaret(position,RectValue.zero);}
  getWordBoundary(position:TextPosition):TextRange{return this.painter.getWordBoundary(position);}
  /** @internal Source handle anchor is at the bottom of the caret. */
  selectionOffsetForPosition(position:TextPosition):OffsetValue{return this.getOffsetForCaret(position,RectValue.zero).translate(0,this.getFullHeightForCaret(position));}
  private registerSelectionFragments():void{if(this.selectionRegistrar===null)return;if(this.fragments===null){const text=this.plainText,fragments:SelectableParagraphFragment[]=[];let start=0;while(start<text.length){let end=text.indexOf('\ufffc',start);if(start!==end){if(end===-1)end=text.length;fragments.push(new SelectableParagraphFragment({paragraph:this,paragraphType:RenderParagraph,fullText:text,range:new TextRange({start,end})}));start=end;}start++;}this.fragments=fragments;}for(const fragment of this.fragments)this.selectionRegistrar.add(fragment);}
  private disposeSelectionFragments():void{if(this.fragments===null)return;const fragments=this.fragments;this.fragments=null;const errors:unknown[]=[];for(const fragment of fragments){if(this.selectionRegistrar)try{this.selectionRegistrar.remove(fragment);}catch(error){errors.push(error);}try{fragment.dispose();}catch(error){errors.push(error);}}if(errors.length===1)throw errors[0];if(errors.length)throw new AggregateError(errors,'Paragraph selection teardown failed');}
  protected replaceSelectionFragments():void{this.disposeSelectionFragments();this.registerSelectionFragments();}
  protected invalidateSelectionLayout():void{for(const fragment of this.fragments??[])fragment.didChangeParagraphLayout();}
  override markNeedsLayout():void{this.invalidateSelectionLayout();super.markNeedsLayout();}
  protected paintSelections(context:PaintingContext):void{if(!this.fragments)return;if(this.clips){context.save();context.clipRect({x:0,y:0,...this.size});}try{for(const fragment of this.fragments)fragment.paintSelection(context);}finally{if(this.clips)context.restore();}}
  protected paintSelectionHandles(context:PaintingContext):void{for(const fragment of this.fragments??[])fragment.paintHandles(context);}
  get baseline():number{return this.paragraph?.alphabeticBaseline??0;}
  abstract get hasVisualOverflow():boolean;
  override detach():void{try{super.detach();}finally{if(!this.attached){this.paragraph=undefined;this.painter._releaseLayoutResources();}}}
  override dispose():void {const errors:unknown[]=[];try{super.dispose();}catch(error){errors.push(error);}if(this.debugDisposed){try{this.disposeSelectionFragments();}catch(error){errors.push(error);}this.selectionRegistrar=null;try{this.painter.dispose();}catch(error){errors.push(error);}finally{this.paragraph=undefined;}}if(errors.length===1)throw errors[0];if(errors.length)throw new AggregateError(errors,'Paragraph teardown failed');}
}
