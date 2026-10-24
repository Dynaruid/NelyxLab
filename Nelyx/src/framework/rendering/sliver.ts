// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {Constraints,BoxConstraints} from './constraints.ts';
import type {ConstraintValidation} from './constraints.ts';
import {Axis,AxisDirection,axisDirectionToAxis,axisDirectionIsReversed,flipAxisDirection} from '../painting/basic-types.ts';
import {hashValues} from '../painting/value-equality.ts';
import {ScrollDirection,flipScrollDirection} from './viewport-offset.ts';
import {FoundationBuildMode} from '../../foundation/constants.ts';
import {invariant} from '../../foundation/errors.ts';
import {FlutterError} from '../../foundation/flutter-error.ts';
import {Diagnosticable} from '../../foundation/diagnosticable.ts';
import {ErrorSummary,DiagnosticsProperty} from '../../foundation/diagnostics.ts';
import {DoubleProperty,FlagProperty} from '../../foundation/diagnostic-properties.ts';
import type {DiagnosticsNode,DiagnosticPropertiesBuilder} from '../../foundation/diagnostics.ts';
import {objectRuntimeType} from '../../foundation/object.ts';
import {diagnosticDoubleString} from '../../foundation/debug.ts';
import {fixed,protect} from '../../ui/value-math.ts';
import {clampDouble} from '../../ui/math.ts';
import {RenderObject,RenderBox,ParentData} from './object.ts';
import type {LayoutOptions,HitTestEntry as LegacyHitTestEntry} from './object.ts';
import {HitTestResult,HitTestEntry} from '../gestures/hit-test.ts';
import {Offset} from '../../ui/offset.ts';
import {identity,multiply,translate,inversePaintTransform,transform} from '../../ui/geometry.ts';
import type {TransformMatrix} from '../../ui/geometry.ts';
import type {Rect,SemanticsNode} from '../../ui/types.ts';
import type {PaintingContext} from '../painting/context.ts';
import type {Matrix4} from '../../math/matrix4.ts';

export interface SliverLayoutDimensionsOptions {readonly scrollOffset:number;readonly precedingScrollExtent:number;readonly viewportMainAxisExtent:number;readonly crossAxisExtent:number}
export type ItemExtentBuilder=(index:number,dimensions:SliverLayoutDimensions)=>number|null;
export class SliverLayoutDimensions {
  readonly scrollOffset:number;readonly precedingScrollExtent:number;readonly viewportMainAxisExtent:number;readonly crossAxisExtent:number;
  constructor({scrollOffset,precedingScrollExtent,viewportMainAxisExtent,crossAxisExtent}:SliverLayoutDimensionsOptions){this.scrollOffset=scrollOffset;this.precedingScrollExtent=precedingScrollExtent;this.viewportMainAxisExtent=viewportMainAxisExtent;this.crossAxisExtent=crossAxisExtent;protect(this,['scrollOffset','precedingScrollExtent','viewportMainAxisExtent','crossAxisExtent']);}
  equals(other:unknown):boolean{return this===other||other instanceof SliverLayoutDimensions&&other.scrollOffset===this.scrollOffset&&other.precedingScrollExtent===this.precedingScrollExtent&&other.viewportMainAxisExtent===this.viewportMainAxisExtent&&other.crossAxisExtent===this.crossAxisExtent;}
  get hashCode():number{return hashValues(this.scrollOffset,this.precedingScrollExtent,this.viewportMainAxisExtent,this.crossAxisExtent);}
  toString():string{return `scrollOffset: ${diagnosticDoubleString(this.scrollOffset)} precedingScrollExtent: ${diagnosticDoubleString(this.precedingScrollExtent)} viewportMainAxisExtent: ${diagnosticDoubleString(this.viewportMainAxisExtent)} crossAxisExtent: ${diagnosticDoubleString(this.crossAxisExtent)}`;}
}
export interface SliverHitPosition {readonly mainAxisPosition:number;readonly crossAxisPosition:number}
export type SliverHitTest=(result:SliverHitTestResult,position:SliverHitPosition)=>boolean;
export interface SliverAxisHitOptions extends SliverHitPosition {readonly paintOffset:Offset|null;readonly mainAxisOffset:number;readonly crossAxisOffset:number;readonly hitTest:SliverHitTest}
export class SliverHitTestResult extends HitTestResult {
  private readonly legacyCallbacks:Map<HitTestEntry,{readonly createSourceEntry?:()=>HitTestEntry;readonly onSourceEntry?:(entry:HitTestEntry)=>void}>;
  private readonly deferBoxCallbacks:boolean;
  constructor(wrapped?:HitTestResult,deferBoxCallbacks=false){super(wrapped);this.legacyCallbacks=wrapped instanceof SliverHitTestResult?wrapped.legacyCallbacks:new Map();this.deferBoxCallbacks=wrapped instanceof SliverHitTestResult?wrapped.deferBoxCallbacks:deferBoxCallbacks;}
  static override wrap(result:HitTestResult):SliverHitTestResult{return new SliverHitTestResult(result);}
  /** @internal The Root applies metadata once to the final admitted entry. */
  static _forLegacy():SliverHitTestResult{return new SliverHitTestResult(undefined,true);}
  /** @internal Preserve source entry kinds and deferred box metadata. */
  _toLegacy(toLocal:TransformMatrix):LegacyHitTestEntry[]{return this.path.map(entry=>{const callbacks=this.legacyCallbacks.get(entry),createSourceEntry=callbacks?.createSourceEntry??(entry instanceof SliverHitTestEntry?()=>new SliverHitTestEntry(entry.target,entry):()=>new HitTestEntry(entry.target));return {target:entry.target,transform:multiply(entry.transform??identity,toLocal),createSourceEntry,...(callbacks?.onSourceEntry?{onSourceEntry:callbacks.onSourceEntry}:{})};});}
  addWithAxisOffset({paintOffset,mainAxisOffset,crossAxisOffset,mainAxisPosition,crossAxisPosition,hitTest}:SliverAxisHitOptions):boolean{if(paintOffset!==null)this.pushOffset(new Offset(-paintOffset.dx,-paintOffset.dy));try{return hitTest(this,{mainAxisPosition:mainAxisPosition-mainAxisOffset,crossAxisPosition:crossAxisPosition-crossAxisOffset});}finally{if(paintOffset!==null)this.popTransform();}}
  /** @internal Bridge the current RenderBox hit path into the source result. */
  _addBoxChild(child:RenderBox,position:Offset,paintOffset:Offset):boolean{
    const inverse=inversePaintTransform(child.localTransform);if(!inverse)return false;const path:LegacyHitTestEntry[]=[];const hit=child.hitTest(transform(inverse,{x:position.dx,y:position.dy}),path,inverse);this.pushOffset(new Offset(-paintOffset.dx,-paintOffset.dy));
    try{for(const legacy of path){this.pushTransform(legacy.transform);try{const entry=legacy.createSourceEntry?.()??new HitTestEntry(legacy.target);invariant(entry.target===legacy.target&&entry.transform===null,'invalid-source-hit-entry','Box bridge requires a fresh source entry for its target');this.add(entry);if(this.deferBoxCallbacks)this.legacyCallbacks.set(entry,{...(legacy.createSourceEntry?{createSourceEntry:legacy.createSourceEntry}:{}),...(legacy.onSourceEntry?{onSourceEntry:legacy.onSourceEntry}:{})});else legacy.onSourceEntry?.(entry);}finally{this.popTransform();}}}finally{this.popTransform();}return hit;
  }
}
export class SliverHitTestEntry extends HitTestEntry<RenderSliver> {
  readonly mainAxisPosition:number;readonly crossAxisPosition:number;
  constructor(target:RenderSliver,{mainAxisPosition,crossAxisPosition}:SliverHitPosition){super(target);this.mainAxisPosition=mainAxisPosition;this.crossAxisPosition=crossAxisPosition;protect(this,['mainAxisPosition','crossAxisPosition']);}
}
export class SliverLogicalParentData extends ParentData {
  layoutOffset:number|null=null;
  override toString():string{return 'layoutOffset='+(this.layoutOffset===null?'None':fixed(this.layoutOffset));}
}
export class SliverPhysicalParentData extends ParentData {
  paintOffset:Offset=Offset.zero;
  crossAxisFlex:number|null=null;
  applyPaintTransform(transform:Matrix4):void{transform.translateByDouble(this.paintOffset.dx,this.paintOffset.dy,0,1);}
  override toString():string{return 'paintOffset='+this.paintOffset;}
}
export class SliverLogicalContainerParentData extends SliverLogicalParentData {
  previousSibling:RenderSliver|null=null;nextSibling:RenderSliver|null=null;
  override detach():void{this.previousSibling=null;this.nextSibling=null;super.detach();}
}
export class SliverPhysicalContainerParentData extends SliverPhysicalParentData {
  previousSibling:RenderSliver|null=null;nextSibling:RenderSliver|null=null;
  override detach():void{this.previousSibling=null;this.nextSibling=null;super.detach();}
}
/** Genuine non-box layout protocol; a Viewport supplies SliverConstraints. */
export abstract class RenderSliver extends RenderObject {
  protected override markNeedsPaintAfterLayout():void{
    if(this.markNeedsPaint===RenderObject.prototype.markNeedsPaint&&this.describeSemanticsConfiguration===RenderObject.prototype.describeSemanticsConfiguration&&this.semanticsTransport===null)this.markNeedsPaintAfterGeometryLayout();else super.markNeedsPaintAfterLayout();
  }
  private sliverGeometry:SliverGeometry|null=null;
  get ensureSemantics():boolean{return false;}
  override get constraints():SliverConstraints{return super.constraints as SliverConstraints;}
  get geometry():SliverGeometry|null{invariant(!this.parent?.debugDoingThisLayout||this.debugCanParentUseSize,'undeclared-sliver-geometry-dependency','A parent reading child geometry must pass parentUsesSize true');return this.sliverGeometry;}
  set geometry(value:SliverGeometry|null){invariant(this.debugDoingThisLayout,'invalid-sliver-geometry-update','Geometry must be set by its owner during layout');this.sliverGeometry=value;}
  override layout(constraints:SliverConstraints,options:LayoutOptions={}):void{invariant(constraints instanceof SliverConstraints,'invalid-sliver-constraints','RenderSliver requires SliverConstraints');this.runLayout(constraints,options);}
  protected override performLayoutInScope(constraints:SliverConstraints):void{if(this.sizedByParent)this.performResize();this.performLayout(constraints);invariant(this.sliverGeometry!==null,'missing-sliver-geometry','Sliver layout must set geometry');if(FoundationBuildMode.debug)this.debugAssertDoesMeetConstraints();}
  override get paintBounds():Rect{const geometry=this.geometry;invariant(geometry,'missing-sliver-geometry','Sliver has not been laid out');return this.constraints.axis===Axis.horizontal?{x:0,y:0,width:geometry.paintExtent,height:this.constraints.crossAxisExtent}:{x:0,y:0,width:this.constraints.crossAxisExtent,height:geometry.paintExtent};}
  get semanticBounds():Rect{return this.paintBounds;}
  debugResetSize():void{}
  debugAssertDoesMeetConstraints():void{const geometry=this.geometry;invariant(geometry,'missing-sliver-geometry','Sliver has not been laid out');geometry.debugAssertIsValid();if(FoundationBuildMode.debug)invariant(geometry.paintOrigin+geometry.paintExtent<=this.constraints.remainingPaintExtent,'sliver-paint-overflow','Paint origin and extent must not exceed remainingPaintExtent');}
  get centerOffsetAdjustment():number{return 0;}
  hitTest(result:SliverHitTestResult,position:SliverHitPosition):boolean{const {mainAxisPosition,crossAxisPosition}=position,geometry=this.geometry;invariant(geometry,'missing-sliver-geometry','Hit testing requires sliver geometry');if(mainAxisPosition>=0&&mainAxisPosition<geometry.hitTestExtent&&crossAxisPosition>=0&&crossAxisPosition<this.constraints.crossAxisExtent&&(this.hitTestChildren(result,position)||this.hitTestSelf(position))){result.add(new SliverHitTestEntry(this,position));return true;}return false;}
  protected hitTestSelf(_position:SliverHitPosition):boolean{return false;}
  protected hitTestChildren(_result:SliverHitTestResult,_position:SliverHitPosition):boolean{return false;}
  calculatePaintOffset(constraints:SliverConstraints,{from,to}:{readonly from:number;readonly to:number}):number{if(FoundationBuildMode.debug)invariant(from<=to,'invalid-sliver-range','Range must be ordered');const a=constraints.scrollOffset,b=a+constraints.remainingPaintExtent;return clampDouble(clampDouble(to,a,b)-clampDouble(from,a,b),0,constraints.remainingPaintExtent);}
  calculateCacheOffset(constraints:SliverConstraints,{from,to}:{readonly from:number;readonly to:number}):number{if(FoundationBuildMode.debug)invariant(from<=to,'invalid-sliver-range','Range must be ordered');const a=constraints.scrollOffset+constraints.cacheOrigin,b=constraints.scrollOffset+constraints.remainingCacheExtent;return clampDouble(clampDouble(to,a,b)-clampDouble(from,a,b),0,constraints.remainingCacheExtent);}
  protected childMainAxisPosition(_child:RenderObject):number{if(FoundationBuildMode.debug)throw new Error(`${objectRuntimeType(this,'RenderSliver')} does not implement childPosition.`);return 0;}
  protected childCrossAxisPosition(_child:RenderObject):number{return 0;}
  childScrollOffset(child:RenderObject):number|null{if(FoundationBuildMode.debug)invariant(child.parent===this,'invalid-sliver-child','Child must belong to this sliver');return 0;}
  protected _getRightWayUp(constraints:SliverConstraints):boolean{const reversed=axisDirectionIsReversed(constraints.axisDirection);return constraints.growthDirection===GrowthDirection.forward?!reversed:reversed;}
  protected hitTestBoxChild(result:SliverHitTestResult,child:RenderBox,{mainAxisPosition,crossAxisPosition}:SliverHitPosition):boolean{const right=this._getRightWayUp(this.constraints);let delta=this.childMainAxisPosition(child);const cross=this.childCrossAxisPosition(child);let absolute=mainAxisPosition-delta;const absoluteCross=crossAxisPosition-cross,geometry=this.geometry!;if(!right){absolute=(this.constraints.axis===Axis.horizontal?child.size.width:child.size.height)-absolute;delta=geometry.paintExtent-(this.constraints.axis===Axis.horizontal?child.size.width:child.size.height)-delta;}return this.constraints.axis===Axis.horizontal?result._addBoxChild(child,new Offset(absolute,absoluteCross),new Offset(delta,cross)):result._addBoxChild(child,new Offset(absoluteCross,absolute),new Offset(cross,delta));}
  protected applyPaintTransformForBoxChild(child:RenderBox,transform:Matrix4):void{let delta=this.childMainAxisPosition(child);const cross=this.childCrossAxisPosition(child);if(!this._getRightWayUp(this.constraints))delta=this.geometry!.paintExtent-(this.constraints.axis===Axis.horizontal?child.size.width:child.size.height)-delta;if(this.constraints.axis===Axis.horizontal)transform.translateByDouble(delta,cross,0,1);else transform.translateByDouble(cross,delta,0,1);}
  protected override childTransform(child:RenderObject):TransformMatrix{const data=child.parentData;return data instanceof SliverPhysicalParentData?multiply(translate(data.paintOffset.dx,data.paintOffset.dy),child.localTransform):super.childTransform(child);}
  override collectSemantics(output:SemanticsNode[],matrix:TransformMatrix=identity,clip?:Rect):void{if(!this.geometry?.visible&&!this.ensureSemantics)return;for(const child of this.children)child.collectSemantics(output,multiply(matrix,this.childTransform(child)),clip);}
}
export abstract class RenderSliverSingleBoxAdapter extends RenderSliver {
  constructor({child}:{readonly child?:RenderBox|null}={}){super();if(child)this.setChildren([child]);}
  protected override get childCountLimit():number{return 1;}
  get child():RenderBox|null{return this.children[0] as RenderBox??null;}
  set child(value:RenderBox|null){this.setChildren(value?[value]:[]);}
  override insert(child:RenderObject,after?:RenderObject):void{invariant(child instanceof RenderBox,'invalid-sliver-box-child','Single box adapter requires RenderBox');super.insert(child,after);}
  override setChildren(children:readonly RenderObject[]):void{invariant(children.every(child=>child instanceof RenderBox),'invalid-sliver-box-child','Single box adapter requires RenderBox');super.setChildren(children);}
  override setupParentData(child:RenderObject):void{if(!(child.parentData instanceof SliverPhysicalParentData))child.parentData=new SliverPhysicalParentData();}
  protected setChildParentData(child:RenderObject,constraints:SliverConstraints,geometry:SliverGeometry):void{const data=child.parentData;invariant(data instanceof SliverPhysicalParentData,'invalid-sliver-parent-data','Box child requires SliverPhysicalParentData');switch(applyGrowthDirectionToAxisDirection(constraints.axisDirection,constraints.growthDirection)){case AxisDirection.up:data.paintOffset=new Offset(0,geometry.paintExtent+constraints.scrollOffset-geometry.scrollExtent);break;case AxisDirection.left:data.paintOffset=new Offset(geometry.paintExtent+constraints.scrollOffset-geometry.scrollExtent,0);break;case AxisDirection.right:data.paintOffset=new Offset(-constraints.scrollOffset,0);break;case AxisDirection.down:data.paintOffset=new Offset(0,-constraints.scrollOffset);break;}}
  protected override hitTestChildren(result:SliverHitTestResult,position:SliverHitPosition):boolean{if(FoundationBuildMode.debug)invariant(this.geometry!.hitTestExtent>0,'empty-sliver-hit-test','Box adapter must have positive hit extent');return this.child!==null&&this.hitTestBoxChild(result,this.child,position);}
  protected override childMainAxisPosition(_child:RenderBox):number{return -this.constraints.scrollOffset;}
  applyPaintTransform(child:RenderObject,transform:Matrix4):void{if(FoundationBuildMode.debug)invariant(child===this.child,'invalid-sliver-child','Paint transform requires the box child');const data=child.parentData;invariant(data instanceof SliverPhysicalParentData,'invalid-sliver-parent-data','Box child requires physical parent data');data.applyPaintTransform(transform);}
  override paint(context:PaintingContext):void{if(this.child!==null&&this.geometry!.visible)this.paintChild(context,this.child);}
}
export class RenderSliverToBoxAdapter extends RenderSliverSingleBoxAdapter {
  protected override performLayout(_constraints:SliverConstraints):void{const child=this.child;if(!child){this.geometry=SliverGeometry.zero;return;}const constraints=this.constraints;child.layout(constraints.asBoxConstraints(),{parentUsesSize:true});const childExtent=constraints.axis===Axis.horizontal?child.size.width:child.size.height,painted=this.calculatePaintOffset(constraints,{from:0,to:childExtent}),cache=this.calculateCacheOffset(constraints,{from:0,to:childExtent});if(FoundationBuildMode.debug)invariant(Number.isFinite(painted)&&painted>=0,'invalid-sliver-painted-extent','Painted child extent must be finite and nonnegative');this.geometry=new SliverGeometry({scrollExtent:childExtent,paintExtent:painted,cacheExtent:cache,maxPaintExtent:childExtent,hitTestExtent:painted,hasVisualOverflow:childExtent>constraints.remainingPaintExtent||constraints.scrollOffset>0});this.setChildParentData(child,constraints,this.geometry);}
}
export class GrowthDirection {
  static readonly forward=new GrowthDirection(0,'forward');static readonly reverse=new GrowthDirection(1,'reverse');static readonly values=Object.freeze([GrowthDirection.forward,GrowthDirection.reverse]);
  private constructor(readonly index:number,readonly name:string){Object.freeze(this);}toString():string{return 'GrowthDirection.'+this.name;}
}
export function applyGrowthDirectionToAxisDirection(axisDirection:AxisDirection,growthDirection:GrowthDirection):AxisDirection{switch(growthDirection){case GrowthDirection.forward:return axisDirection;case GrowthDirection.reverse:return flipAxisDirection(axisDirection);default:throw new TypeError('Unknown GrowthDirection');}}
export function applyGrowthDirectionToScrollDirection(scrollDirection:ScrollDirection,growthDirection:GrowthDirection):ScrollDirection{switch(growthDirection){case GrowthDirection.forward:return scrollDirection;case GrowthDirection.reverse:return flipScrollDirection(scrollDirection);default:throw new TypeError('Unknown GrowthDirection');}}
export interface SliverConstraintsOptions {
  readonly axisDirection:AxisDirection;readonly growthDirection:GrowthDirection;readonly userScrollDirection:ScrollDirection;readonly scrollOffset:number;readonly precedingScrollExtent:number;readonly overlap:number;readonly remainingPaintExtent:number;readonly crossAxisExtent:number;readonly crossAxisDirection:AxisDirection;readonly viewportMainAxisExtent:number;readonly remainingCacheExtent:number;readonly cacheOrigin:number;
}
export type SliverConstraintsCopyOptions={[K in keyof SliverConstraintsOptions]?:SliverConstraintsOptions[K]|null};
export class SliverConstraints extends Constraints implements SliverConstraintsOptions {
  readonly axisDirection:AxisDirection;readonly growthDirection:GrowthDirection;readonly userScrollDirection:ScrollDirection;readonly scrollOffset:number;readonly precedingScrollExtent:number;readonly overlap:number;readonly remainingPaintExtent:number;readonly crossAxisExtent:number;readonly crossAxisDirection:AxisDirection;readonly viewportMainAxisExtent:number;readonly remainingCacheExtent:number;readonly cacheOrigin:number;
  constructor({axisDirection,growthDirection,userScrollDirection,scrollOffset,precedingScrollExtent,overlap,remainingPaintExtent,crossAxisExtent,crossAxisDirection,viewportMainAxisExtent,remainingCacheExtent,cacheOrigin}:SliverConstraintsOptions){super();this.axisDirection=axisDirection;this.growthDirection=growthDirection;this.userScrollDirection=userScrollDirection;this.scrollOffset=scrollOffset;this.precedingScrollExtent=precedingScrollExtent;this.overlap=overlap;this.remainingPaintExtent=remainingPaintExtent;this.crossAxisExtent=crossAxisExtent;this.crossAxisDirection=crossAxisDirection;this.viewportMainAxisExtent=viewportMainAxisExtent;this.remainingCacheExtent=remainingCacheExtent;this.cacheOrigin=cacheOrigin;protect(this,['axisDirection','growthDirection','userScrollDirection','scrollOffset','precedingScrollExtent','overlap','remainingPaintExtent','crossAxisExtent','crossAxisDirection','viewportMainAxisExtent','remainingCacheExtent','cacheOrigin']);}
  copyWith(o:SliverConstraintsCopyOptions={}):SliverConstraints{return new SliverConstraints({axisDirection:o.axisDirection??this.axisDirection,growthDirection:o.growthDirection??this.growthDirection,userScrollDirection:o.userScrollDirection??this.userScrollDirection,scrollOffset:o.scrollOffset??this.scrollOffset,precedingScrollExtent:o.precedingScrollExtent??this.precedingScrollExtent,overlap:o.overlap??this.overlap,remainingPaintExtent:o.remainingPaintExtent??this.remainingPaintExtent,crossAxisExtent:o.crossAxisExtent??this.crossAxisExtent,crossAxisDirection:o.crossAxisDirection??this.crossAxisDirection,viewportMainAxisExtent:o.viewportMainAxisExtent??this.viewportMainAxisExtent,remainingCacheExtent:o.remainingCacheExtent??this.remainingCacheExtent,cacheOrigin:o.cacheOrigin??this.cacheOrigin});}
  get axis():Axis{return axisDirectionToAxis(this.axisDirection);}
  get normalizedGrowthDirection():GrowthDirection{return axisDirectionIsReversed(this.axisDirection)?this.growthDirection===GrowthDirection.forward?GrowthDirection.reverse:GrowthDirection.forward:this.growthDirection;}
  get isTight():boolean{return false;}
  get isNormalized():boolean{return this.scrollOffset>=0&&this.crossAxisExtent>=0&&axisDirectionToAxis(this.axisDirection)!==axisDirectionToAxis(this.crossAxisDirection)&&this.viewportMainAxisExtent>=0&&this.remainingPaintExtent>=0;}
  asBoxConstraints({minExtent=0,maxExtent=Infinity,crossAxisExtent=this.crossAxisExtent}:{readonly minExtent?:number;readonly maxExtent?:number;readonly crossAxisExtent?:number|null}={}):BoxConstraints{const cross=crossAxisExtent??this.crossAxisExtent;return this.axis===axisDirectionToAxis(AxisDirection.right)?new BoxConstraints(minExtent,maxExtent,cross,cross):new BoxConstraints(cross,cross,minExtent,maxExtent);}
  override debugAssertIsValid({informationCollector}:ConstraintValidation={}):boolean{
    if(!FoundationBuildMode.debug)return true;const errors:string[]=[];const check=(condition:boolean,message:string)=>{if(!condition)errors.push(message);};
    check(!Number.isNaN(this.overlap),'overlap is NaN');check(!Number.isNaN(this.crossAxisExtent),'crossAxisExtent is NaN');check(this.scrollOffset>=0,'scrollOffset must be nonnegative');check(axisDirectionToAxis(this.axisDirection)!==axisDirectionToAxis(this.crossAxisDirection),'axisDirection and crossAxisDirection are along the same axis');check(this.viewportMainAxisExtent>=0,'viewportMainAxisExtent must be nonnegative');check(this.remainingPaintExtent>=0,'remainingPaintExtent must be nonnegative');check(this.remainingCacheExtent>=0,'remainingCacheExtent must be nonnegative');check(this.cacheOrigin<=0,'cacheOrigin must be nonpositive');check(this.precedingScrollExtent>=0,'precedingScrollExtent must be nonnegative');check(this.isNormalized,'constraints are not normalized');
    if(errors.length)throw FlutterError.fromParts([new ErrorSummary(`${objectRuntimeType(this,'SliverConstraints')} is not valid: ${errors.join('; ')}`),...(informationCollector?Array.from(informationCollector()) as DiagnosticsNode[]:[]),new DiagnosticsProperty('The offending constraints were',this,{style:'errorProperty'})]);return true;
  }
  override equals(other:unknown):boolean{if(this===other)return true;if(!(other instanceof SliverConstraints))return false;if(FoundationBuildMode.debug)other.debugAssertIsValid();return other.axisDirection===this.axisDirection&&other.growthDirection===this.growthDirection&&other.userScrollDirection===this.userScrollDirection&&other.scrollOffset===this.scrollOffset&&other.precedingScrollExtent===this.precedingScrollExtent&&other.overlap===this.overlap&&other.remainingPaintExtent===this.remainingPaintExtent&&other.crossAxisExtent===this.crossAxisExtent&&other.crossAxisDirection===this.crossAxisDirection&&other.viewportMainAxisExtent===this.viewportMainAxisExtent&&other.remainingCacheExtent===this.remainingCacheExtent&&other.cacheOrigin===this.cacheOrigin;}
  get hashCode():number{return hashValues(this.axisDirection,this.growthDirection,this.userScrollDirection,this.scrollOffset,this.precedingScrollExtent,this.overlap,this.remainingPaintExtent,this.crossAxisExtent,this.crossAxisDirection,this.viewportMainAxisExtent,this.remainingCacheExtent,this.cacheOrigin);}
  toString():string{return 'SliverConstraints('+[this.axisDirection,this.growthDirection,this.userScrollDirection,'scrollOffset: '+fixed(this.scrollOffset),'precedingScrollExtent: '+fixed(this.precedingScrollExtent),'remainingPaintExtent: '+fixed(this.remainingPaintExtent),...(this.overlap!==0?['overlap: '+fixed(this.overlap)]:[]),'crossAxisExtent: '+fixed(this.crossAxisExtent),'crossAxisDirection: '+this.crossAxisDirection,'viewportMainAxisExtent: '+fixed(this.viewportMainAxisExtent),'remainingCacheExtent: '+fixed(this.remainingCacheExtent),'cacheOrigin: '+fixed(this.cacheOrigin)].join(', ')+')';}
}
export interface SliverGeometryOptions {readonly scrollExtent?:number;readonly paintExtent?:number;readonly paintOrigin?:number;readonly layoutExtent?:number|null;readonly maxPaintExtent?:number;readonly maxScrollObstructionExtent?:number;readonly crossAxisExtent?:number|null;readonly hitTestExtent?:number|null;readonly visible?:boolean|null;readonly hasVisualOverflow?:boolean;readonly scrollOffsetCorrection?:number|null;readonly cacheExtent?:number|null}
export type SliverGeometryCopyOptions={[K in Exclude<keyof SliverGeometryOptions,'scrollOffsetCorrection'>]?:SliverGeometryOptions[K]|null};
export class SliverGeometry extends Diagnosticable(class {}) {
  static readonly zero=new SliverGeometry();
  readonly scrollExtent:number;readonly paintExtent:number;readonly paintOrigin:number;readonly layoutExtent:number;readonly maxPaintExtent:number;readonly maxScrollObstructionExtent:number;readonly crossAxisExtent:number|null;readonly hitTestExtent:number;readonly visible:boolean;readonly hasVisualOverflow:boolean;readonly scrollOffsetCorrection:number|null;readonly cacheExtent:number;
  constructor({scrollExtent=0,paintExtent=0,paintOrigin=0,layoutExtent,maxPaintExtent=0,maxScrollObstructionExtent=0,crossAxisExtent=null,hitTestExtent,visible,hasVisualOverflow=false,scrollOffsetCorrection=null,cacheExtent}:SliverGeometryOptions={}){super();if(FoundationBuildMode.debug)invariant(scrollOffsetCorrection!==0,'zero-scroll-offset-correction','Scroll offset correction must not be zero');this.scrollExtent=scrollExtent;this.paintExtent=paintExtent;this.paintOrigin=paintOrigin;this.layoutExtent=layoutExtent??paintExtent;this.maxPaintExtent=maxPaintExtent;this.maxScrollObstructionExtent=maxScrollObstructionExtent;this.crossAxisExtent=crossAxisExtent;this.hitTestExtent=hitTestExtent??paintExtent;this.visible=visible??paintExtent>0;this.hasVisualOverflow=hasVisualOverflow;this.scrollOffsetCorrection=scrollOffsetCorrection;this.cacheExtent=cacheExtent??layoutExtent??paintExtent;protect(this,['scrollExtent','paintExtent','paintOrigin','layoutExtent','maxPaintExtent','maxScrollObstructionExtent','crossAxisExtent','hitTestExtent','visible','hasVisualOverflow','scrollOffsetCorrection','cacheExtent']);}
  copyWith(o:SliverGeometryCopyOptions={}):SliverGeometry{return new SliverGeometry({scrollExtent:o.scrollExtent??this.scrollExtent,paintExtent:o.paintExtent??this.paintExtent,paintOrigin:o.paintOrigin??this.paintOrigin,layoutExtent:o.layoutExtent??this.layoutExtent,maxPaintExtent:o.maxPaintExtent??this.maxPaintExtent,maxScrollObstructionExtent:o.maxScrollObstructionExtent??this.maxScrollObstructionExtent,crossAxisExtent:o.crossAxisExtent??this.crossAxisExtent,hitTestExtent:o.hitTestExtent??this.hitTestExtent,visible:o.visible??this.visible,hasVisualOverflow:o.hasVisualOverflow??this.hasVisualOverflow,cacheExtent:o.cacheExtent??this.cacheExtent});}
  debugAssertIsValid({informationCollector}:{readonly informationCollector?:()=>Iterable<DiagnosticsNode>}={}):boolean{if(!FoundationBuildMode.debug)return true;const check=(condition:boolean,message:string)=>{if(!condition)throw FlutterError.fromParts([new ErrorSummary(`${objectRuntimeType(this,'SliverGeometry')} is not valid: ${message}`),...(informationCollector?informationCollector():[])]);};check(this.scrollExtent>=0,'The scrollExtent is negative.');check(this.paintExtent>=0,'The paintExtent is negative.');check(this.layoutExtent>=0,'The layoutExtent is negative.');check(this.cacheExtent>=0,'The cacheExtent is negative.');check(this.layoutExtent<=this.paintExtent,'The layoutExtent exceeds the paintExtent.');check(!(this.paintExtent-this.maxPaintExtent>1e-10),'The maxPaintExtent is less than the paintExtent.');check(this.hitTestExtent>=0,'The hitTestExtent is negative.');check(this.scrollOffsetCorrection!==0,'The scrollOffsetCorrection is zero.');return true;}
  override toStringShort():string{return objectRuntimeType(this,'SliverGeometry');}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new DoubleProperty('scrollExtent',this.scrollExtent));if(this.paintExtent>0)properties.add(new DoubleProperty('paintExtent',this.paintExtent,{unit:this.visible?null:' but not painting'}));else if(this.paintExtent===0){if(this.visible)properties.add(new DoubleProperty('paintExtent',this.paintExtent));properties.add(new FlagProperty('visible',this.visible,{ifFalse:'hidden'}));}else properties.add(new DoubleProperty('paintExtent',this.paintExtent,{tooltip:'!'}));properties.add(new DoubleProperty('paintOrigin',this.paintOrigin,{defaultValue:0}));properties.add(new DoubleProperty('layoutExtent',this.layoutExtent,{defaultValue:this.paintExtent}));properties.add(new DoubleProperty('maxPaintExtent',this.maxPaintExtent));properties.add(new DoubleProperty('hitTestExtent',this.hitTestExtent,{defaultValue:this.paintExtent}));properties.add(new DiagnosticsProperty('hasVisualOverflow',this.hasVisualOverflow,{defaultValue:false}));properties.add(new DoubleProperty('scrollOffsetCorrection',this.scrollOffsetCorrection,{defaultValue:null}));properties.add(new DoubleProperty('cacheExtent',this.cacheExtent,{defaultValue:0}));}
}
