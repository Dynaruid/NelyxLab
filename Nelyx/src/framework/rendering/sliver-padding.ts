// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {RenderSliver,SliverGeometry,SliverPhysicalParentData,applyGrowthDirectionToAxisDirection} from './sliver.ts';
import type {SliverConstraints,SliverHitTestResult,SliverHitPosition} from './sliver.ts';
import type {RenderObject} from './object.ts';
import {Axis,AxisDirection} from '../painting/basic-types.ts';
import {EdgeInsets,EdgeInsetsGeometry} from '../painting/edge-insets.ts';
import {valueEquals} from '../painting/value-equality.ts';
import {Offset} from '../../ui/offset.ts';
import type {Matrix4} from '../../math/matrix4.ts';
import type {PaintingContext} from '../painting/context.ts';
import {FoundationBuildMode} from '../../foundation/constants.ts';
import {invariant} from '../../foundation/errors.ts';
import {DiagnosticsProperty} from '../../foundation/diagnostics.ts';
import {EnumProperty} from '../../foundation/diagnostic-properties.ts';
import type {DiagnosticPropertiesBuilder} from '../../foundation/diagnostics.ts';

export abstract class RenderSliverEdgeInsetsPadding extends RenderSliver {
  abstract get resolvedPadding():EdgeInsets|null;
  protected override get childCountLimit():number{return 1;}
  get child():RenderSliver|null{return this.children[0] as RenderSliver??null;}
  set child(value:RenderSliver|null){this.setChildren(value?[value]:[]);}
  override insert(child:RenderObject,after?:RenderObject):void{invariant(child instanceof RenderSliver,'invalid-padding-sliver-child','Sliver padding requires a non-box sliver child');super.insert(child,after);}
  override setChildren(children:readonly RenderObject[]):void{invariant(children.length<=1&&children.every(child=>child instanceof RenderSliver),'invalid-padding-sliver-child','Sliver padding requires one non-box sliver child');super.setChildren(children);}
  override setupParentData(child:RenderObject):void{if(!(child.parentData instanceof SliverPhysicalParentData))child.parentData=new SliverPhysicalParentData();}
  private get paddingValue():EdgeInsets{const padding=this.resolvedPadding;invariant(padding!==null,'unresolved-sliver-padding','Sliver padding must be resolved before layout');return padding;}
  get beforePadding():number{const padding=this.paddingValue;switch(applyGrowthDirectionToAxisDirection(this.constraints.axisDirection,this.constraints.growthDirection)){case AxisDirection.up:return padding.bottom;case AxisDirection.right:return padding.left;case AxisDirection.down:return padding.top;case AxisDirection.left:return padding.right;default:throw new TypeError('Unknown axis');}}
  get afterPadding():number{const padding=this.paddingValue;switch(applyGrowthDirectionToAxisDirection(this.constraints.axisDirection,this.constraints.growthDirection)){case AxisDirection.up:return padding.top;case AxisDirection.right:return padding.right;case AxisDirection.down:return padding.bottom;case AxisDirection.left:return padding.left;default:throw new TypeError('Unknown axis');}}
  get mainAxisPadding():number{return this.constraints.axis===Axis.horizontal?this.paddingValue.horizontal:this.paddingValue.vertical;}
  get crossAxisPadding():number{return this.constraints.axis===Axis.horizontal?this.paddingValue.vertical:this.paddingValue.horizontal;}
  protected override performLayout(_constraints:SliverConstraints):void{
    const constraints=this.constraints,padding=this.paddingValue,beforePadding=this.beforePadding,mainAxisPadding=this.mainAxisPadding,crossAxisPadding=this.crossAxisPadding;
    const paintOffset=(from:number,to:number)=>this.calculatePaintOffset(constraints,{from,to}),cacheOffset=(from:number,to:number)=>this.calculateCacheOffset(constraints,{from,to});
    const child=this.child;
    if(child===null){const paintExtent=paintOffset(0,mainAxisPadding),cacheExtent=cacheOffset(0,mainAxisPadding);this.geometry=new SliverGeometry({scrollExtent:mainAxisPadding,paintExtent:Math.min(paintExtent,constraints.remainingPaintExtent),maxPaintExtent:mainAxisPadding,cacheExtent});return;}
    const beforePaddingPaintExtent=paintOffset(0,beforePadding);let overlap=constraints.overlap;if(overlap>0)overlap=Math.max(0,constraints.overlap-beforePaddingPaintExtent);
    child.layout(constraints.copyWith({scrollOffset:Math.max(0,constraints.scrollOffset-beforePadding),cacheOrigin:Math.min(0,constraints.cacheOrigin+beforePadding),overlap,remainingPaintExtent:constraints.remainingPaintExtent-paintOffset(0,beforePadding),remainingCacheExtent:constraints.remainingCacheExtent-cacheOffset(0,beforePadding),crossAxisExtent:Math.max(0,constraints.crossAxisExtent-crossAxisPadding),precedingScrollExtent:beforePadding+constraints.precedingScrollExtent}),{parentUsesSize:true});
    const childGeometry=child.geometry!;if(childGeometry.scrollOffsetCorrection!==null){this.geometry=new SliverGeometry({scrollOffsetCorrection:childGeometry.scrollOffsetCorrection});return;}
    const scrollExtent=childGeometry.scrollExtent,beforePaddingCacheExtent=cacheOffset(0,beforePadding),afterPaddingCacheExtent=cacheOffset(beforePadding+scrollExtent,mainAxisPadding+scrollExtent),afterPaddingPaintExtent=paintOffset(beforePadding+scrollExtent,mainAxisPadding+scrollExtent),mainAxisPaddingCacheExtent=beforePaddingCacheExtent+afterPaddingCacheExtent,mainAxisPaddingPaintExtent=beforePaddingPaintExtent+afterPaddingPaintExtent;
    const paintExtent=Math.min(beforePaddingPaintExtent+Math.max(childGeometry.paintExtent,childGeometry.layoutExtent+afterPaddingPaintExtent),constraints.remainingPaintExtent);
    this.geometry=new SliverGeometry({paintOrigin:childGeometry.paintOrigin,scrollExtent:mainAxisPadding+scrollExtent,paintExtent,layoutExtent:Math.min(mainAxisPaddingPaintExtent+childGeometry.layoutExtent,paintExtent),cacheExtent:Math.min(mainAxisPaddingCacheExtent+childGeometry.cacheExtent,constraints.remainingCacheExtent),maxPaintExtent:mainAxisPadding+childGeometry.maxPaintExtent,hitTestExtent:Math.max(mainAxisPaddingPaintExtent+childGeometry.paintExtent,beforePaddingPaintExtent+childGeometry.hitTestExtent),hasVisualOverflow:childGeometry.hasVisualOverflow});
    let calculatedOffset:number;switch(applyGrowthDirectionToAxisDirection(constraints.axisDirection,constraints.growthDirection)){case AxisDirection.up:calculatedOffset=paintOffset(padding.bottom+scrollExtent,padding.vertical+scrollExtent);break;case AxisDirection.left:calculatedOffset=paintOffset(padding.right+scrollExtent,padding.horizontal+scrollExtent);break;case AxisDirection.right:calculatedOffset=paintOffset(0,padding.left);break;case AxisDirection.down:calculatedOffset=paintOffset(0,padding.top);break;default:throw new TypeError('Unknown axis');}
    (child.parentData as SliverPhysicalParentData).paintOffset=constraints.axis===Axis.horizontal?new Offset(calculatedOffset,padding.top):new Offset(padding.left,calculatedOffset);
  }
  protected override hitTestChildren(result:SliverHitTestResult,position:SliverHitPosition):boolean{const child=this.child;if(child!==null&&child.geometry!.hitTestExtent>0)return result.addWithAxisOffset({...position,mainAxisOffset:this.childMainAxisPosition(child),crossAxisOffset:this.childCrossAxisPosition(child),paintOffset:(child.parentData as SliverPhysicalParentData).paintOffset,hitTest:(result,position)=>child.hitTest(result,position)});return false;}
  protected override childMainAxisPosition(child:RenderSliver):number{invariant(child===this.child,'invalid-padding-sliver-child','Position requires this padding child');return this.calculatePaintOffset(this.constraints,{from:0,to:this.beforePadding});}
  protected override childCrossAxisPosition(child:RenderSliver):number{invariant(child===this.child,'invalid-padding-sliver-child','Position requires this padding child');return this.constraints.axis===Axis.horizontal?this.paddingValue.top:this.paddingValue.left;}
  override childScrollOffset(child:RenderObject):number|null{invariant(child.parent===this,'invalid-padding-sliver-child','Offset requires this padding child');return this.beforePadding;}
  applyPaintTransform(child:RenderObject,transform:Matrix4):void{invariant(child===this.child,'invalid-padding-sliver-child','Transform requires this padding child');(child.parentData as SliverPhysicalParentData).applyPaintTransform(transform);}
  override paint(context:PaintingContext):void{if(this.child?.geometry?.visible)this.paintChild(context,this.child);}
}
export class RenderSliverPadding extends RenderSliverEdgeInsetsPadding {
  private _padding:EdgeInsetsGeometry;private _textDirection:'ltr'|'rtl'|null;private _resolvedPadding:EdgeInsets|null=null;
  constructor({padding,textDirection=null,child=null}:{readonly padding:EdgeInsetsGeometry;readonly textDirection?:'ltr'|'rtl'|null;readonly child?:RenderSliver|null}){super();if(FoundationBuildMode.debug)invariant(padding.isNonNegative,'negative-sliver-padding','Padding must be nonnegative');this._padding=padding;this._textDirection=textDirection;this.child=child;}
  get resolvedPadding():EdgeInsets|null{return this._resolvedPadding;}
  private _resolve():void{if(this._resolvedPadding!==null)return;this._resolvedPadding=this.padding.resolve(this.textDirection);if(FoundationBuildMode.debug)invariant(this._resolvedPadding.isNonNegative,'negative-sliver-padding','Resolved padding must be nonnegative');}
  private _markNeedsResolution():void{this._resolvedPadding=null;this.markNeedsLayout();}
  get padding():EdgeInsetsGeometry{return this._padding;}
  set padding(value:EdgeInsetsGeometry){this.assertCanMutateLayoutProperty();if(FoundationBuildMode.debug)invariant(value.isNonNegative,'negative-sliver-padding','Padding must be nonnegative');if(valueEquals(this._padding,value))return;this._padding=value;this._markNeedsResolution();}
  get textDirection():'ltr'|'rtl'|null{return this._textDirection;}
  set textDirection(value:'ltr'|'rtl'|null){this.assertCanMutateLayoutProperty();if(value===this._textDirection)return;this._textDirection=value;this._markNeedsResolution();}
  protected override performLayout(constraints:SliverConstraints):void{this._resolve();super.performLayout(constraints);}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new DiagnosticsProperty('padding',this.padding));properties.add(new EnumProperty('textDirection',this.textDirection,{defaultValue:null}));}
}
