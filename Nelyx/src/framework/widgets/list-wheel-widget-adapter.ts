// SPDX-License-Identifier: BSD-3-Clause
// Concrete Core bridges for complete source Widgets, with explicit queued Element admission.
import {Widget,StatefulWidget,RenderObjectWidget,RenderObjectElement,Element,BuildOwner,BuildScope} from './framework.ts';
import type {Key} from '../../foundation/key.ts';
import {ChangeNotifier} from '../../foundation/notifier.ts';
import {invariant} from '../../foundation/errors.ts';
import {DartIntMap} from '../../foundation/dart-int-map.ts';
import {ScrollableState} from './scrollable.ts';
import {bindLiveWheelContext} from './list-wheel-position-adapter.ts';
import {SourceFixedExtentScrollController} from './list-wheel-controller.generated.ts';
import {SourceFixedExtentMetrics} from './list-wheel-position.generated.ts';
import {SourceRenderListWheelViewport,SourceListWheelParentData} from '../rendering/list-wheel-viewport.generated.ts';
import {registerWheelLayoutWork} from '../rendering/list-wheel-renderer-adapter.ts';
import {RenderBox,RenderObject} from '../rendering/object.ts';
import {Offset} from '../../ui/offset.ts';
import {NotificationListener} from './notification-listener.ts';
import {ScrollNotification,ScrollEndNotification,ScrollUpdateNotification} from './scroll-notification.ts';
export class ChangeReportingBehavior {
  static readonly onScrollUpdate=new ChangeReportingBehavior(0,'onScrollUpdate');static readonly onScrollEnd=new ChangeReportingBehavior(1,'onScrollEnd');
  static readonly values=Object.freeze([ChangeReportingBehavior.onScrollUpdate,ChangeReportingBehavior.onScrollEnd]);
  private constructor(readonly index:number,readonly name:string){Object.freeze(this);}
  toString():string{return 'ChangeReportingBehavior.'+this.name;}
}
export abstract class WheelStatefulHost extends StatefulWidget {constructor({key=null}:{key?:Key|null}={}){super(key);}}
export abstract class WheelRenderWidgetHost extends RenderObjectWidget {constructor({key=null}:{key?:Key|null}={}){super(key);}get childWidgets():readonly Widget[]{return [];}}
export abstract class WheelScrollableStateHost extends ScrollableState {
  abstract get itemExtent():number;
  private releaseExtent:(()=>void)|null=null;private readonly readExtent=()=>this.itemExtent;
  override didChangeDependencies():void{this.releaseExtent??=bindLiveWheelContext(this,this.readExtent);super.didChangeDependencies();}
  override dispose():void{try{super.dispose();}finally{this.releaseExtent?.();this.releaseExtent=null;}}
}
const sourceSlots=new WeakMap<Element,number>(),renderOwners=new WeakMap<SourceRenderListWheelViewport,WheelElementHost>();
const facadeKeyPolicies=new WeakMap<object,(key:Key)=>number|null>();
/** Only the finite compatibility facade admits key-driven child movement. */
export function bindWheelFacadeKeys(delegate:object,findIndex:(key:Key)=>number|null):void{facadeKeyPolicies.set(delegate,findIndex);}
export abstract class WheelElementHost extends RenderObjectElement {
  abstract readonly sourceElements:DartIntMap<number,Element>;abstract readonly sourceWidgets:DartIntMap<number,Widget|null>;
  abstract sourcePerformRebuild():void;
  abstract sourceInsertRenderObjectChild(child:RenderObject,slot:number):void;
  abstract sourceMoveRenderObjectChild(child:RenderObject,oldSlot:number,newSlot:number):void;
  private updatingWidget=false;private fromCoreRebuild=false;private sourceRebuildPending=true;private facadeMoves=false;
  private ready=false;private releaseLayout:(()=>void)|null=null;private updatingSlot:number|null=null;private insertionSlot:number|null=null;
  private readonly delayedOffsets=new Map<Element,Offset>();
  private readonly scope=new BuildScope({scheduleRebuild:()=>{if(this.ready&&this.active)this.renderObject.markNeedsLayout();}});
  override get buildScope():BuildScope{return this.scope;}
  override mount(parent:Element|undefined,owner:BuildOwner,slot?:unknown):void{super.mount(parent,owner,slot);this.ready=true;const render=castSourceRenderListWheelViewport(this.renderObject);renderOwners.set(render,this);this.releaseLayout=registerWheelLayoutWork(render,()=>{if(this.scope.hasDirty||this.dirty)this.owner.buildScope(this);this.finishQueuedChildren();});}
  override markNeedsBuild():void{if(!this.updatingWidget)this.sourceRebuildPending=true;super.markNeedsBuild();}
  override update(widget:Widget):void{this.updatingWidget=true;try{super.update(widget);}finally{this.updatingWidget=false;}this.renderObject.markNeedsLayout();}
  override rebuild():void{this.fromCoreRebuild=true;try{super.rebuild();}finally{this.fromCoreRebuild=false;}}
  override performRebuild():void{try{if(this.fromCoreRebuild&&!this.sourceRebuildPending){this.performRebuildBase();return;}this.sourceRebuildPending=false;try{this.remapFacadeChildren();this.sourcePerformRebuild();}catch(error){this.sourceRebuildPending=true;throw error;}this.owner.parentRebuilt(this);}finally{this.facadeMoves=false;this.syncManagedChildren();}}
  private remapFacadeChildren():void{
    const delegate=(this.widget as unknown as {childDelegate:object}).childDelegate,findIndex=facadeKeyPolicies.get(delegate);if(!findIndex||this.sourceElements.isEmpty)return;
    const entries=[...this.sourceElements.keys].map(index=>({index,child:this.sourceElements.get(index)!})),first=entries[0]!.index,last=entries.at(-1)!.index,planned=new Map<number,{index:number;child:Element;moved:boolean}>(),retire=new Set<Element>();
    // Resolve the entire policy before changing ownership. A moved offscreen child
    // retires here, avoiding a sparse map that the source's contiguous rebuild
    // would expand into thousands of intermediate Widgets.
    for(const {index,child}of entries){if(child.parent!==this)continue;const target=child.widget.key===null?null:findIndex(child.widget.key),next=target??index;invariant(Number.isSafeInteger(next)&&next>=0,'invalid-remapped-wheel-index','Remapped wheel index must be a nonnegative safe integer');const moved=next!==index;if(next<first||next>last){retire.add(child);continue;}const previous=planned.get(next);if(previous){invariant(!(previous.moved&&moved),'duplicate-remapped-wheel-index','Two keyed wheel children cannot occupy one slot');if(previous.moved){retire.add(child);continue;}retire.add(previous.child);}planned.set(next,{index,child,moved});}
    this.facadeMoves=true;for(const {index,child}of entries)if(retire.has(child))this.updateChild(child,null,index);
    this.sourceElements.clear();for(const [index,{child}]of [...planned].sort((a,b)=>a[0]-b[0])) {this.sourceElements.set(index,child);sourceSlots.set(child,index);}
    this.syncManagedChildren();
  }
  protected performRebuildBase():void{this.dirty=false;(this.widget as RenderObjectWidget).updateRenderObject(this,this.renderObject);}
  protected override slotForChild():unknown{invariant(this.updatingSlot!==null,'missing-wheel-update-slot','Wheel child reconciliation requires its checked source slot');return this.updatingSlot;}
  updateChild(child:Element|null,widget:Widget|null,slot:{}|null):Element|null {
    const index=castWheelInteger(slot),previous=this.updatingSlot,oldData=child?wheelElementRenderObject(child)?.parentData:null,offset=oldData instanceof SourceListWheelParentData?oldData.offset:null;
    this.updatingSlot=index;
    try{const next=this.reconcile(child?[child]:[],widget?[widget]:[])[0]??null;if(next){sourceSlots.set(next,index);if(offset)this.delayedOffsets.set(next,offset);}return next;}
    finally{this.updatingSlot=previous;}
  }
  syncManagedChildren():void{if(this.ready)this.children=[...this.sourceElements.keys].map(index=>this.sourceElements.get(index)!).filter(child=>child.parent===this);}
  finishQueuedChildren():void{this.syncManagedChildren();this.owner.flushRenderTree();for(const index of this.sourceElements.keys){const child=this.sourceElements.get(index)!,render=wheelElementRenderObject(child);if(render?.parentData instanceof SourceListWheelParentData){render.parentData.index=index;const offset=this.delayedOffsets.get(child);if(offset)render.parentData.offset=offset;}}this.delayedOffsets.clear();}
  override insertRenderObjectChild(child:RenderObject,slot:unknown):void{const previous=this.insertionSlot;this.insertionSlot=castWheelInteger(slot);try{this.sourceInsertRenderObjectChild(child,this.insertionSlot);}finally{this.insertionSlot=previous;}}
  override moveRenderObjectChild(child:RenderObject,oldSlot:unknown,newSlot:unknown):void{const from=castWheelInteger(oldSlot),index=castWheelInteger(newSlot);if(!this.facadeMoves){this.sourceMoveRenderObjectChild(child,from,index);return;}invariant(child instanceof RenderBox&&child.parent===this.renderObject,'invalid-wheel-move','Facade movement requires its owned source box');const render=castSourceRenderListWheelViewport(this.renderObject);let after:RenderBox|undefined;for(const box of render.children)if(box!==child&&render.indexOf(box)<index)after=box;render.move(child,after);invariant(child.parentData instanceof SourceListWheelParentData,'invalid-wheel-parent-data','Source wheel needs its real parent data');child.parentData.index=index;}
  insertSourceBox(render:SourceRenderListWheelViewport,child:RenderBox):void{invariant(render===this.renderObject&&this.insertionSlot!==null,'invalid-wheel-insertion','Source box insertion requires its owner slot');let after:RenderBox|undefined;for(const box of render.children)if(box!==child&&render.indexOf(box)<this.insertionSlot)after=box;render.insert(child,after);invariant(child.parentData instanceof SourceListWheelParentData,'invalid-wheel-parent-data','Source wheel needs its real parent data');child.parentData.index=this.insertionSlot;}
  override forgetChild(child:Element):void{this.delayedOffsets.delete(child);sourceSlots.delete(child);super.forgetChild(child);}
  protected override synchronizeRenderObjectChildren():void{}
  override unmount():void{if(!this.mounted)return;const render=castSourceRenderListWheelViewport(this.renderObject);this.releaseLayout?.();this.releaseLayout=null;renderOwners.delete(render);this.syncManagedChildren();try{super.unmount();}finally{this.ready=false;this.delayedOffsets.clear();this.sourceElements.clear();this.sourceWidgets.clear();}}
}
export function wheelBuildScope(owner:BuildOwner,element:Element,callback:()=>void):void{invariant(element instanceof WheelElementHost&&element.owner===owner,'invalid-wheel-build-owner','Wheel scope requires its actual owner');owner.buildScope(element,()=>{try{callback();}finally{element.syncManagedChildren();}});element.finishQueuedChildren();}
export function wheelElementRenderObject(element:Element):RenderObject|null{const objects=element.renderObjects;invariant(objects.length<=1,'multiple-wheel-render-children','Wheel child needs one render object');return objects[0]??null;}
export function wheelElementSlot(element:Element):{}|null{return sourceSlots.get(element)??element.slot??null;}
export function wheelRuntimeType(value:object):Function{return value.constructor;}
export function wheelInsertChild(render:SourceRenderListWheelViewport,child:RenderBox,{after=null}:{after?:RenderBox|null}={}):void{const owner=renderOwners.get(render);if(owner)owner.insertSourceBox(render,child);else render.insert(child,after??undefined);}
export function wheelDebugValidateChild(_render:SourceRenderListWheelViewport,child:RenderObject):boolean{return child instanceof RenderBox;}
export function createWheelWidgetMap():DartIntMap<number,Widget|null>{return new DartIntMap((value):value is Widget|null=>value===null||value instanceof Widget);}
export function createWheelElementMap():DartIntMap<number,Element>{return new DartIntMap((value):value is Element=>value instanceof Element,true);}
export function createWheelNotificationListener(options:{onNotification:(notification:ScrollNotification)=>boolean;child:Widget}):NotificationListener<ScrollNotification>{return new NotificationListener({notificationType:ScrollNotification,...options});}
export function createSourceWheelController():SourceFixedExtentScrollController{const controller=new SourceFixedExtentScrollController();ChangeNotifier.maybeDispatchObjectCreation(controller);return controller;}
export function isSourceFixedExtentScrollController(value:unknown):value is SourceFixedExtentScrollController{return value instanceof SourceFixedExtentScrollController;}
export function castSourceFixedExtentScrollController(value:unknown):SourceFixedExtentScrollController{invariant(isSourceFixedExtentScrollController(value),'invalid-wheel-controller','Expected source fixed controller');return value;}
export function isSourceFixedExtentMetrics(value:unknown):value is SourceFixedExtentMetrics{return value instanceof SourceFixedExtentMetrics;}
export function castSourceFixedExtentMetrics(value:unknown):SourceFixedExtentMetrics{invariant(isSourceFixedExtentMetrics(value),'invalid-wheel-metrics','Expected source fixed metrics');return value;}
export function isSourceRenderListWheelViewport(value:unknown):value is SourceRenderListWheelViewport{return value instanceof SourceRenderListWheelViewport;}
export function castSourceRenderListWheelViewport(value:unknown):SourceRenderListWheelViewport{invariant(isSourceRenderListWheelViewport(value),'invalid-wheel-renderer','Expected source wheel renderer');return value;}
export function isScrollEndNotification(value:unknown):value is ScrollEndNotification{return value instanceof ScrollEndNotification;}
export function isScrollUpdateNotification(value:unknown):value is ScrollUpdateNotification{return value instanceof ScrollUpdateNotification;}
export function isWheelInteger(value:unknown):value is number{return typeof value==='number'&&Number.isSafeInteger(value);}
export function castWheelInteger(value:unknown):number{invariant(isWheelInteger(value),'invalid-wheel-integer','Expected a safe source integer');return value;}
