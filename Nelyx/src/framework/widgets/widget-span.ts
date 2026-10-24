// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {PlaceholderSpan} from '../painting/placeholder-span.ts';
import {ParentDataWidget,SingleChildRenderObjectWidget} from './framework.ts';import type {Widget,BuildContext} from './framework.ts';import type {TextStyle} from '../painting/text-style.ts';
import type {PlaceholderAlignment,TextBaseline} from '../../ui/typography.ts';
import type {InlineSpan,InlineSpanVisitor,Accumulator,InlineSpanBuildOptions} from '../painting/inline-span.ts';
import type {ParagraphBuilder} from '../../ui/paragraph-builder.ts';
import {RenderComparison} from '../painting/basic-types.ts';
import type {TextPosition} from '../../ui/text-position.ts';
import {FoundationBuildMode} from '../../foundation/constants.ts';import {invariant} from '../../foundation/errors.ts';
import {hashValues} from '../painting/value-equality.ts';
import {protect} from '../../ui/value-math.ts';
import {DiagnosticsProperty} from '../../foundation/diagnostics.ts';
import type {DiagnosticPropertiesBuilder} from '../../foundation/diagnostics.ts';
import {TextScaler} from '../painting/text-scaler.ts';
import {TextParentData,PlaceholderSpanIndexSemanticsTag} from '../rendering/paragraph.ts';
import {RichText} from './rich-text.ts';
import {Semantics} from './semantics.ts';
import {RenderProxyBox} from '../rendering/boxes.ts';
import type {RenderObject,RenderBox} from '../rendering/object.ts';
import {BoxConstraints} from '../rendering/constraints.ts';
import type {Size,TransformMatrix} from '../../ui/geometry.ts';
import {multiply,fullTransform} from '../../ui/geometry.ts';
import {LayerHandle,TransformLayer} from '../rendering/layer.ts';
import type {PaintingContext} from '../painting/context.ts';
export class WidgetSpan extends PlaceholderSpan {
  constructor(readonly child:Widget,{alignment='bottom',baseline=null,style=null}:{readonly alignment?:PlaceholderAlignment;readonly baseline?:TextBaseline|null;readonly style?:TextStyle|null}={}){super(alignment,baseline,style);if(new.target===WidgetSpan)Object.freeze(this);else protect(this,['child']);}
  build(builder:ParagraphBuilder,{textScaler=TextScaler.noScaling,dimensions=null}:InlineSpanBuildOptions={}):void{
    if(FoundationBuildMode.debug){this.debugAssertIsValid();invariant(dimensions!==null,'missing-placeholder-dimensions','WidgetSpan requires placeholder dimensions');}
    if(this.style!==null)builder.pushStyle(this.style.getTextStyle({textScaler}));if(FoundationBuildMode.debug)invariant(builder.placeholderCount<dimensions!.length,'placeholder-count','Missing dimension for WidgetSpan');const dimension=dimensions![builder.placeholderCount]!;
    builder.addPlaceholder(dimension.size.width,dimension.size.height,this.alignment,{baseline:dimension.baseline,baselineOffset:dimension.baselineOffset});if(this.style!==null)builder.pop();
  }
  static extractFromInlineSpan(span:InlineSpan,textScaler:TextScaler):Widget[]{
    const widgets:Widget[]=[],fontSizes=[14],seen=new Set<InlineSpan>();let count=0;
    const visit=(node:InlineSpan):boolean=>{
      invariant(!seen.has(node)&&seen.size<128&&++count<=256,'inline-span-budget','Cyclic/oversize InlineSpan tree');seen.add(node);
      const fontSize=node.style?.fontSize,push=fontSize!==undefined&&fontSize!==null&&fontSize!==fontSizes[fontSizes.length-1];if(push)fontSizes.push(fontSize);
      try{if(node instanceof WidgetSpan){const size=fontSizes[fontSizes.length-1]!,scale=size===0?0:textScaler.scale(size)/size;invariant(widgets.length<64,'inline-placeholder-budget','Too many WidgetSpans');widgets.push(new WidgetSpanParentData(node,new Semantics(new AutoScaleInlineWidget(node,scale,node.child),{tagForChildren:new PlaceholderSpanIndexSemanticsTag(widgets.length)})));}
        if(FoundationBuildMode.debug)invariant(node instanceof WidgetSpan||!(node instanceof PlaceholderSpan),'unsupported-placeholder-span','A PlaceholderSpan must be a WidgetSpan');node.visitDirectChildren(visit);return true;
      }finally{if(push)fontSizes.pop();seen.delete(node);}
    };visit(span);return widgets;
  }
  visitChildren(visitor:InlineSpanVisitor):boolean{return visitor(this);}
  override getSpanForPosition(_position:TextPosition):InlineSpan|null{return null;}
  protected getSpanForPositionVisitor(position:TextPosition,offset:Accumulator):InlineSpan|null{if(position.offset===offset.value)return this;offset.increment(1);return null;}
  protected codeUnitAtVisitor(index:number,offset:Accumulator):number|null{const local=index-offset.value;if(FoundationBuildMode.debug)invariant(local>=0,'negative-span-index','Span local offset must be nonnegative');offset.increment(1);return local===0?PlaceholderSpan.placeholderCodeUnit:null;}
  compareTo(other:InlineSpan):RenderComparison{if(this===other)return RenderComparison.identical;if(other.constructor!==this.constructor||(this.style===null)!==(other.style===null))return RenderComparison.layout;const span=other as WidgetSpan;if(this.child!==span.child||this.alignment!==span.alignment)return RenderComparison.layout;return this.style?.compareTo(span.style!)??RenderComparison.identical;}
  override equals(other:unknown):boolean{return this===other||other instanceof WidgetSpan&&super.equals(other)&&this.child===other.child&&this.alignment===other.alignment&&this.baseline===other.baseline;}
  override get hashCode():number{return hashValues(super.hashCode,this.child,this.alignment,this.baseline);}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new DiagnosticsProperty('widget',this.child));}
}

class WidgetSpanParentData extends ParentDataWidget<TextParentData> {
  readonly parentDataType=TextParentData;
  constructor(readonly span:WidgetSpan,child:Widget){super(child);}
  get debugTypicalAncestorWidgetClass():Function{return RichText;}
  applyParentData(render:RenderObject):void{invariant(render.parentData instanceof TextParentData,'invalid-inline-parent-data','WidgetSpan children require a paragraph parent');render.parentData.span=this.span;}
}
class AutoScaleInlineWidget extends SingleChildRenderObjectWidget {
  constructor(readonly span:WidgetSpan,readonly textScaleFactor:number,child:Widget){super(child);}
  createRenderObject():RenderScaledInlineWidget{return new RenderScaledInlineWidget(this.span.alignment,this.span.baseline,this.textScaleFactor);}
  updateRenderObject(_context:BuildContext,render:RenderBox):void{const scaled=render as RenderScaledInlineWidget;scaled.alignment=this.span.alignment;scaled.baseline=this.span.baseline;scaled.scale=this.textScaleFactor;}
}
class RenderScaledInlineWidget extends RenderProxyBox {
  private readonly retained=new LayerHandle<TransformLayer>();
  constructor(private _alignment:PlaceholderAlignment,private _baseline:TextBaseline|null,private _scale:number){super();}
  get alignment():PlaceholderAlignment{return this._alignment;}set alignment(value:PlaceholderAlignment){if(value===this._alignment)return;this.assertCanMutateLayoutProperty();this._alignment=value;this.markNeedsLayout();}
  get baseline():TextBaseline|null{return this._baseline;}set baseline(value:TextBaseline|null){if(value===this._baseline)return;this.assertCanMutateLayoutProperty();this._baseline=value;this.markNeedsLayout();}
  get scale():number{return this._scale;}set scale(value:number){if(value===this._scale)return;this.assertCanMutateLayoutProperty();if(FoundationBuildMode.debug)invariant(value>0&&Number.isFinite(value),'invalid-inline-scale','Inline scale must be finite and positive');this._scale=value;this.markNeedsLayout();}
  protected override computeMinIntrinsicWidth(height:number):number{return (this.child?.getMinIntrinsicWidth(height/this.scale)??0)*this.scale;}
  protected override computeMaxIntrinsicWidth(height:number):number{return (this.child?.getMaxIntrinsicWidth(height/this.scale)??0)*this.scale;}
  protected override computeMinIntrinsicHeight(width:number):number{return (this.child?.getMinIntrinsicHeight(width/this.scale)??0)*this.scale;}
  protected override computeMaxIntrinsicHeight(width:number):number{return (this.child?.getMaxIntrinsicHeight(width/this.scale)??0)*this.scale;}
  protected override computeDistanceToActualBaseline(baseline:TextBaseline):number|null{const value=this.child?.getDistanceToActualBaseline(baseline);return value==null?null:value*this.scale;}
  protected override computeDryBaseline(constraints:BoxConstraints,baseline:TextBaseline):number|null{const value=this.child?.getDryBaseline(new BoxConstraints(0,constraints.maxWidth/this.scale),baseline);return value==null?null:value*this.scale;}
  protected override computeDryLayout(constraints:BoxConstraints):Size{if(FoundationBuildMode.debug)invariant(!constraints.hasBoundedHeight,'bounded-inline-height','Inline widget height must be unbounded');const size=this.child?.getDryLayout(new BoxConstraints(0,constraints.maxWidth/this.scale))??{width:0,height:0};return constraints.constrain({width:size.width*this.scale,height:size.height*this.scale});}
  protected override performLayout(constraints:BoxConstraints):Size{if(!this.child)return constraints.smallest;if(FoundationBuildMode.debug)invariant(!constraints.hasBoundedHeight,'bounded-inline-height','Inline widget height must be unbounded');this.child.layout(new BoxConstraints(0,constraints.maxWidth/this.scale),{parentUsesSize:true});this.child.layoutOffset={x:0,y:0};return constraints.constrain({width:this.child.size.width*this.scale,height:this.child.size.height*this.scale});}
  private get scaleTransform():TransformMatrix{return [this.scale,0,0,this.scale,0,0];}
  protected override childTransform(child:RenderObject):TransformMatrix{
    // Source applyPaintTransform scales all three spatial axes; paint and hit
    // testing separately flatten onto the paragraph's two-dimensional plane.
    const scale=this.scale;
    return multiply([scale,0,0,0,0,scale,0,0,0,0,scale,0,0,0,0,1],child.localTransform);
  }
  override paint(context:PaintingContext):void{
    const child=this.child;if(!child){this.retained.dispose();return;}if(this.scale===1){this.retained.dispose();context.paintChild(child,child.localTransform);return;}
    // The host retains a CPU TransformLayer for both composed and immediate frames.
    const previous=this.retained.layer,layer=previous??new TransformLayer();layer.transform=fullTransform(this.scaleTransform);
    try{this.retained.layer=context.pushLayer(layer,childContext=>childContext.paintChild(child,child.localTransform));}
    catch(error){if(!previous&&layer.debugHandleCount===0)try{layer.dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Inline transform paint and rollback failed');}throw error;}
  }
  override detach():void{try{super.detach();}finally{if(!this.attached)this.retained.dispose();}}
  override dispose():void{try{super.dispose();}finally{if(this.debugDisposed)this.retained.dispose();}}
}
