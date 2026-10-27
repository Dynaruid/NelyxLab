// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter widgets/layout_builder.dart at the recorded pin.
import {invariant} from '../../foundation/errors.ts';
import type {Constraints} from '../rendering/constraints.ts';
import {BoxConstraints} from '../rendering/constraints.ts';
import {RenderProxyBox} from '../rendering/boxes.ts';
import {RenderBox} from '../rendering/object.ts';
import type {RenderObject,TextBaseline} from '../rendering/object.ts';
import {RenderObjectWithLayoutCallbackMixin} from '../rendering/layout-callback.ts';
import type {RenderObjectConstructor,LayoutCallbackRenderObject} from '../rendering/layout-callback.ts';
import {assertOutsideRenderPaint} from '../rendering/phase.ts';
import {Widget,RenderObjectWidget,SingleChildRenderObjectElement,BuildScope} from './framework.ts';
import type {BuildContext,BuildOwner,Element,WidgetOptions} from './framework.ts';
import type {FrameScheduler} from '../scheduler/scheduler.ts';
import {tickerScheduler} from './ticker-scheduler.ts';
export type LayoutWidgetBuilder=(context:BuildContext,constraints:BoxConstraints)=>Widget;
export interface AbstractLayoutBuilderRender<I,Child extends RenderObject=RenderObject> extends LayoutCallbackRenderObject {readonly child:Child|null|undefined;readonly layoutInfo:I;_updateCallback(value:((constraints:Constraints)=>void)|null):void}
type AbstractLayoutConstructor<I,Child extends RenderObject,Base extends RenderObjectConstructor<LayoutCallbackRenderObject&{readonly child:Child|undefined}>> = abstract new (...args:ConstructorParameters<Base>)=>InstanceType<Base>&AbstractLayoutBuilderRender<I,Child>;
/** Curried class factory retains a concrete base constructor and child protocol. */
export function RenderAbstractLayoutBuilderMixin<I,Child extends RenderObject>(){return <Base extends RenderObjectConstructor<LayoutCallbackRenderObject&{readonly child:Child|undefined}>>(Base:Base):AbstractLayoutConstructor<I,Child,Base>=>{
  abstract class AbstractLayoutRender extends Base {
    private _callback:((constraints:Constraints)=>void)|null=null;
    _updateCallback(value:((constraints:Constraints)=>void)|null):void{if(value===this._callback)return;this._callback=value;if(value)this.scheduleLayoutCallback();}
    layoutCallback():void{invariant(this._callback,'missing-layout-callback','Layout builder callback is detached');this._callback(this.constraints);}
    get layoutInfo():I{return this.constraints as unknown as I;}
  }
  return AbstractLayoutRender as unknown as AbstractLayoutConstructor<I,Child,Base>;
};}
function sameLayoutInfo(a:unknown,b:unknown):boolean{return a===b||a!==null&&typeof a==='object'&&typeof (a as {equals?:unknown}).equals==='function'&&(a as {equals:(other:unknown)=>boolean}).equals(b);}
export abstract class AbstractLayoutBuilder<I> extends RenderObjectWidget {
  constructor(options:WidgetOptions={}){super(options.key??null);}
  abstract readonly builder:(context:BuildContext,layoutInfo:I)=>Widget;
  get childWidgets():readonly Widget[]{return [];}
  override createElement():SingleChildRenderObjectElement{return new _LayoutBuilderElement<I>(this);}
  updateShouldRebuild(_old:AbstractLayoutBuilder<I>):boolean{return true;}
  abstract override createRenderObject(context:BuildContext):AbstractLayoutBuilderRender<I>;
}
export abstract class ConstrainedLayoutBuilder<C extends Constraints> extends AbstractLayoutBuilder<C> {
  constructor(readonly builder:(context:BuildContext,constraints:C)=>Widget,options:WidgetOptions={}){super(options);invariant(typeof builder==='function','invalid-layout-builder','A synchronous builder is required');}
}
class _LayoutBuilderElement<I> extends SingleChildRenderObjectElement {
  private readonly _buildScope=new BuildScope({scheduleRebuild:()=>this._scheduleRebuild()});
  private ready=false;private _needsBuild=true;private _previousLayoutInfo:I|undefined;private built:Widget|undefined;
  private deferred:{scheduler:FrameScheduler;id:number}|undefined;
  override get buildScope():BuildScope{return this._buildScope;}
  override get renderObject():AbstractLayoutBuilderRender<I>{return super.renderObject as AbstractLayoutBuilderRender<I>;}
  override mount(parent:Element|undefined,owner:BuildOwner,slot?:unknown):void{super.mount(parent,owner,slot);owner.forget(this);this.dirty=false;this.ready=true;this.renderObject._updateCallback(this._rebuildWithConstraints);}
  private _scheduleRebuild():void{if(!this.ready||!this.active||this.deferred)return;const scheduler=tickerScheduler(this);if(scheduler.phase==='idle'||scheduler.phase==='post-frame'){const id=scheduler.scheduleFrameCallback(()=>{this.deferred=undefined;if(this.active)this.renderObject.scheduleLayoutCallback();});this.deferred={scheduler,id};}else this.renderObject.scheduleLayoutCallback();}
  private cancelDeferred():void{if(this.deferred){this.deferred.scheduler.cancelFrameCallbackWithId(this.deferred.id);this.deferred=undefined;}}
  override update(widget:Widget):void{assertOutsideRenderPaint();invariant(this.active&&Widget.canUpdate(this.widget,widget)&&widget instanceof AbstractLayoutBuilder,'invalid-widget-update','LayoutBuilder type/key changed or context is inactive');const old=this.widget as AbstractLayoutBuilder<I>;this.widget=widget;widget.updateRenderObject(this,this.renderObject);this.renderObject._updateCallback(this._rebuildWithConstraints);if(widget.updateShouldRebuild(old)){this._needsBuild=true;this.renderObject.scheduleLayoutCallback();}}
  override markNeedsBuild():void{assertOutsideRenderPaint();invariant(this.mounted,'unmounted-element','Rebuild after unmount');this._needsBuild=true;if(this.ready&&this.active)this.renderObject.scheduleLayoutCallback();}
  protected override build():readonly Widget[]{(this.widget as AbstractLayoutBuilder<I>).updateRenderObject(this,this.renderObject);return this.built?[this.built]:[];}
  private readonly _rebuildWithConstraints=(_constraints:Constraints):void=>{const info=this.renderObject.layoutInfo,needs=this._needsBuild||!sameLayoutInfo(info,this._previousLayoutInfo);this.owner.buildScope(this,needs?()=>{let built:Widget;try{built=(this.widget as AbstractLayoutBuilder<I>).builder(this,info);invariant(built instanceof Widget,'invalid-layout-builder-result','Builder must synchronously return a Widget');}catch(exception){built=this.buildErrorWidget(exception);}try{this.built=built;this.dirty=true;this.rebuild();}catch(exception){this.built=this.buildErrorWidget(exception);try{this.owner.deactivateChildren(this.children);}catch{}this.children=[];this.dirty=true;this.rebuild();}finally{this._needsBuild=false;this._previousLayoutInfo=info;}}:undefined);this.syncRenderTree();};
  override deactivate():void{this.cancelDeferred();super.deactivate();}
  override unmount():void{if(!this.mounted)return;this.cancelDeferred();this.ready=false;this.renderObject._updateCallback(null);try{super.unmount();}finally{this._buildScope._clear();this.built=undefined;}}
}
export class LayoutBuilder extends ConstrainedLayoutBuilder<BoxConstraints> {
  override createRenderObject(_context:BuildContext):RenderBox<RenderObject>&AbstractLayoutBuilderRender<BoxConstraints,RenderBox<RenderObject>>{return new _RenderLayoutBuilder();}
}
class _RenderLayoutBuilder extends RenderAbstractLayoutBuilderMixin<BoxConstraints,RenderBox<RenderObject>>()(RenderObjectWithLayoutCallbackMixin(RenderProxyBox)) {
  protected override computeMinIntrinsicWidth(_height:number):number{throw new Error('LayoutBuilder cannot compute intrinsic dimensions without speculative tree mutation');}
  protected override computeMaxIntrinsicWidth(_height:number):number{throw new Error('LayoutBuilder cannot compute intrinsic dimensions without speculative tree mutation');}
  protected override computeMinIntrinsicHeight(_width:number):number{throw new Error('LayoutBuilder cannot compute intrinsic dimensions without speculative tree mutation');}
  protected override computeMaxIntrinsicHeight(_width:number):number{throw new Error('LayoutBuilder cannot compute intrinsic dimensions without speculative tree mutation');}
  protected override computeDryLayout(_constraints:BoxConstraints):never{throw new Error('LayoutBuilder cannot compute dry layout without speculative tree mutation');}
  protected override computeDryBaseline(_constraints:BoxConstraints,_baseline:TextBaseline):never{throw new Error('LayoutBuilder cannot compute dry baseline without speculative tree mutation');}
  protected override performLayout(constraints:BoxConstraints){this.runLayoutCallback();if(this.child){this.child.layout(constraints,{parentUsesSize:true});this.child.layoutOffset={x:0,y:0};return constraints.constrain(this.child.size);}return constraints.biggest;}
}
RenderBox._registerGeometryLayoutSemantics(_RenderLayoutBuilder.prototype);
