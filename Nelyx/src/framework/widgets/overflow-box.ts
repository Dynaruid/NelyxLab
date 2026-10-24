// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter widgets/basic.dart at the recorded upstream pin.
import {invariant} from '../../foundation/errors.ts';
import type {Key} from '../../foundation/key.ts';
import type {Size} from '../../ui/geometry.ts';
import {Size as SizeValue} from '../../ui/size.ts';
import type {Clip} from '../../ui/clip.ts';
import {Alignment,AlignmentGeometry} from '../painting/alignment.ts';
import {BoxConstraints} from '../rendering/constraints.ts';
import {RenderAligningShiftedBox} from '../rendering/shifted-box.ts';
import {RenderConstrainedOverflowBox,RenderSizedOverflowBox,RenderFractionallySizedOverflowBox,RenderConstraintsTransformBox} from '../rendering/overflow-box.ts';
import type {OverflowBoxFit,BoxConstraintsTransform} from '../rendering/overflow-box.ts';
import type {RenderBox} from '../rendering/object.ts';
import {RenderObjectWidget,StatelessWidget,SingleChildRenderObjectElement} from './framework.ts';
import type {Widget,BuildContext,WidgetOptions} from './framework.ts';
import {Directionality} from './app-data.ts';

export interface OverflowAlignmentOptions extends WidgetOptions {readonly alignment?:AlignmentGeometry}
abstract class OverflowWidget<R extends RenderAligningShiftedBox> extends RenderObjectWidget {
  readonly childWidgets:readonly Widget[];
  constructor(child:Widget|undefined,key:Key|null){super(key);this.childWidgets=Object.freeze(child?[child]:[]);}
  get child():Widget|undefined{return this.childWidgets[0];}
  override createElement():SingleChildRenderObjectElement{return new SingleChildRenderObjectElement(this);}
  protected abstract make(context:BuildContext):R;
  protected abstract configure(render:R,context:BuildContext):void;
  createRenderObject(context:BuildContext):R{return this.make(context);}
  override updateRenderObject(context:BuildContext,render:RenderBox):void{this.configure(render as R,context);}
}
function alignment(value:AlignmentGeometry|undefined):AlignmentGeometry{const result=value??Alignment.center;invariant(result instanceof AlignmentGeometry,'invalid-alignment','AlignmentGeometry is required');return result;}
function checkFactor(value:number|null):void{invariant(value===null||typeof value==='number'&&value>=0,'invalid-size-factor','Fractional factors must be nonnegative');}

export interface OverflowBoxOptions extends OverflowAlignmentOptions {readonly minWidth?:number|null;readonly maxWidth?:number|null;readonly minHeight?:number|null;readonly maxHeight?:number|null;readonly fit?:OverflowBoxFit}
export class OverflowBox extends OverflowWidget<RenderConstrainedOverflowBox> {
  readonly alignment:AlignmentGeometry;readonly minWidth:number|null;readonly maxWidth:number|null;readonly minHeight:number|null;readonly maxHeight:number|null;readonly fit:OverflowBoxFit;
  constructor(child?:Widget,options:OverflowBoxOptions={}){super(child,options.key??null);this.alignment=alignment(options.alignment);this.minWidth=options.minWidth??null;this.maxWidth=options.maxWidth??null;this.minHeight=options.minHeight??null;this.maxHeight=options.maxHeight??null;this.fit=options.fit??'max';}
  protected make(context:BuildContext):RenderConstrainedOverflowBox{return new RenderConstrainedOverflowBox({alignment:this.alignment,minWidth:this.minWidth,maxWidth:this.maxWidth,minHeight:this.minHeight,maxHeight:this.maxHeight,fit:this.fit,textDirection:context.maybeDependOn(Directionality)?.direction??null});}
  protected configure(render:RenderConstrainedOverflowBox,context:BuildContext):void{render.alignment=this.alignment;render.minWidth=this.minWidth;render.maxWidth=this.maxWidth;render.minHeight=this.minHeight;render.maxHeight=this.maxHeight;render.fit=this.fit;render.textDirection=context.maybeDependOn(Directionality)?.direction??null;}
}

export class SizedOverflowBox extends OverflowWidget<RenderSizedOverflowBox> {
  readonly size:SizeValue;readonly alignment:AlignmentGeometry;
  constructor(child:Widget|undefined,size:Size,options:OverflowAlignmentOptions={}){super(child,options.key??null);this.size=size instanceof SizeValue?size:new SizeValue(size.width,size.height);this.alignment=alignment(options.alignment);}
  protected make(context:BuildContext):RenderSizedOverflowBox{return new RenderSizedOverflowBox({requestedSize:this.size,alignment:this.alignment,textDirection:context.dependOn(Directionality).direction});}
  protected configure(render:RenderSizedOverflowBox,context:BuildContext):void{render.alignment=this.alignment;render.requestedSize=this.size;render.textDirection=context.dependOn(Directionality).direction;}
}

export interface FractionallySizedBoxOptions extends OverflowAlignmentOptions {readonly widthFactor?:number|null;readonly heightFactor?:number|null}
export class FractionallySizedBox extends OverflowWidget<RenderFractionallySizedOverflowBox> {
  readonly alignment:AlignmentGeometry;readonly widthFactor:number|null;readonly heightFactor:number|null;
  constructor(child?:Widget,options:FractionallySizedBoxOptions={}){super(child,options.key??null);this.alignment=alignment(options.alignment);this.widthFactor=options.widthFactor??null;this.heightFactor=options.heightFactor??null;checkFactor(this.widthFactor);checkFactor(this.heightFactor);}
  protected make(context:BuildContext):RenderFractionallySizedOverflowBox{return new RenderFractionallySizedOverflowBox({alignment:this.alignment,widthFactor:this.widthFactor,heightFactor:this.heightFactor,textDirection:context.maybeDependOn(Directionality)?.direction??null});}
  protected configure(render:RenderFractionallySizedOverflowBox,context:BuildContext):void{render.alignment=this.alignment;render.widthFactor=this.widthFactor;render.heightFactor=this.heightFactor;render.textDirection=context.maybeDependOn(Directionality)?.direction??null;}
}

export interface ConstraintsTransformBoxOptions extends OverflowAlignmentOptions {readonly constraintsTransform:BoxConstraintsTransform;readonly textDirection?:'ltr'|'rtl'|null;readonly clipBehavior?:Clip;readonly debugTransformType?:''}
export class ConstraintsTransformBox extends OverflowWidget<RenderConstraintsTransformBox> {
  readonly alignment:AlignmentGeometry;readonly textDirection:'ltr'|'rtl'|null;readonly constraintsTransform:BoxConstraintsTransform;readonly clipBehavior:Clip;
  constructor(child:Widget|undefined,options:ConstraintsTransformBoxOptions){super(child,options.key??null);this.alignment=alignment(options.alignment);this.textDirection=options.textDirection??null;this.constraintsTransform=options.constraintsTransform;this.clipBehavior=options.clipBehavior??'none';invariant(options.debugTransformType===undefined||options.debugTransformType==='','unsupported-overflow-diagnostics','Nonempty debugTransformType is not implemented');}
  static unmodified(constraints:BoxConstraints):BoxConstraints{return constraints;}
  static unconstrained(_constraints:BoxConstraints):BoxConstraints{return new BoxConstraints();}
  static widthUnconstrained(constraints:BoxConstraints):BoxConstraints{return constraints.heightConstraints();}
  static heightUnconstrained(constraints:BoxConstraints):BoxConstraints{return constraints.widthConstraints();}
  static maxHeightUnconstrained(constraints:BoxConstraints):BoxConstraints{return constraints.copyWith({maxHeight:Infinity});}
  static maxWidthUnconstrained(constraints:BoxConstraints):BoxConstraints{return constraints.copyWith({maxWidth:Infinity});}
  static maxUnconstrained(constraints:BoxConstraints):BoxConstraints{return constraints.copyWith({maxWidth:Infinity,maxHeight:Infinity});}
  private direction(context:BuildContext):'ltr'|'rtl'|null{return this.textDirection??context.maybeDependOn(Directionality)?.direction??null;}
  protected make(context:BuildContext):RenderConstraintsTransformBox{return new RenderConstraintsTransformBox({alignment:this.alignment,textDirection:this.direction(context),constraintsTransform:this.constraintsTransform,clipBehavior:this.clipBehavior});}
  protected configure(render:RenderConstraintsTransformBox,context:BuildContext):void{render.textDirection=this.direction(context);render.constraintsTransform=this.constraintsTransform;render.alignment=this.alignment;render.clipBehavior=this.clipBehavior;}
}

export interface UnconstrainedBoxOptions extends OverflowAlignmentOptions {readonly textDirection?:'ltr'|'rtl'|null;readonly constrainedAxis?:'horizontal'|'vertical'|null;readonly clipBehavior?:Clip}
export class UnconstrainedBox extends StatelessWidget {
  readonly alignment:AlignmentGeometry;readonly textDirection:'ltr'|'rtl'|null;readonly constrainedAxis:'horizontal'|'vertical'|null;readonly clipBehavior:Clip;
  constructor(readonly child?:Widget,options:UnconstrainedBoxOptions={}){super(options.key??null);this.alignment=alignment(options.alignment);this.textDirection=options.textDirection??null;this.constrainedAxis=options.constrainedAxis??null;this.clipBehavior=options.clipBehavior??'none';invariant(this.constrainedAxis===null||this.constrainedAxis==='horizontal'||this.constrainedAxis==='vertical','invalid-axis','Unknown constrained axis');}
  private _axisToTransform(axis:'horizontal'|'vertical'|null):BoxConstraintsTransform{return axis==='horizontal'?ConstraintsTransformBox.heightUnconstrained:axis==='vertical'?ConstraintsTransformBox.widthUnconstrained:ConstraintsTransformBox.unconstrained;}
  build(_context:BuildContext):Widget{return new ConstraintsTransformBox(this.child,{alignment:this.alignment,textDirection:this.textDirection,clipBehavior:this.clipBehavior,constraintsTransform:this._axisToTransform(this.constrainedAxis)});}
}
