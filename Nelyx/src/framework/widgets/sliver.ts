// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {ParentDataWidget,Widget,RenderObjectWidget,RenderObjectElement,BuildScope} from './framework.ts';
import type {BuildContext,BuildOwner,Element,WidgetOptions} from './framework.ts';
import {ParentData,RenderBox} from '../rendering/object.ts';
import type {RenderObject} from '../rendering/object.ts';
import {isKeepAliveParentData,RenderSliverMultiBoxAdaptor,SliverMultiBoxAdaptorParentData} from '../rendering/sliver-multi-box-adaptor.ts';
import type {KeepAliveParentDataMixin,RenderSliverBoxChildManager,EstimateMaxScrollOffsetOptions} from '../rendering/sliver-multi-box-adaptor.ts';
import {RenderSliverFixedExtentList,RenderSliverVariedExtentList} from '../rendering/sliver-fixed-extent-list.ts';
import {RenderSliverList} from '../rendering/sliver-list.ts';
import {RenderSliverSectionList} from '../rendering/sliver-section-list.ts';
import type {SectionExtentIndex,SectionExtentEnvironment} from '../rendering/section-extent-index.ts';
import {MediaQuery,Directionality,Localizations} from './app-data.ts';
import {RenderSliverGrid,SliverGridDelegate,SliverGridDelegateWithFixedCrossAxisCount,SliverGridDelegateWithMaxCrossAxisExtent} from '../rendering/sliver-grid.ts';
import type {SliverConstraints,ItemExtentBuilder} from '../rendering/sliver.ts';
import {SliverChildDelegate,SliverChildBuilderDelegate,SliverChildListDelegate} from './scroll-delegate.ts';
import type {SliverChildBuilderDelegateOptions,SliverChildDelegateOptions,NullableIndexedWidgetBuilder} from './scroll-delegate.ts';
import type {Key} from '../../foundation/key.ts';
import {invariant} from '../../foundation/errors.ts';
import {FlutterError} from '../../foundation/flutter-error.ts';
import {DiagnosticsProperty} from '../../foundation/diagnostics.ts';
import type {DiagnosticPropertiesBuilder} from '../../foundation/diagnostics.ts';
import {protect} from '../../ui/value-math.ts';
import {normalizeSliverChildPolicy} from './view-work-budget.ts';
import type {SliverChildPolicy} from './view-work-budget.ts';
export type {SliverChildPolicy} from './view-work-budget.ts';

/** Preserve the established public module while avoiding delegate/keep-alive initialization cycles. */
export {KeepAlive} from './keep-alive.ts';

/** Bookkeeping only: Element/adaptor remain the mount and render owners.
 * One ordered snapshot per structural revision, shared by projection/visitors.
 * User builders and lifecycle callbacks still run synchronously in slot order. */
class SliverChildStore implements Iterable<[number,Element]> {
  private readonly elements=new Map<number,Element>();
  revision=0;
  private orderedRevision=-1;
  private ordered:readonly (readonly [number,Element])[]=[];
  get size():number{return this.elements.size;}
  get(index:number):Element|undefined{return this.elements.get(index);}
  has(index:number):boolean{return this.elements.has(index);}
  keys():MapIterator<number>{return this.elements.keys();}
  [Symbol.iterator]():MapIterator<[number,Element]>{return this.elements[Symbol.iterator]();}
  set(index:number,child:Element):this{if(this.get(index)!==child){this.elements.set(index,child);this.revision++;}return this;}
  delete(index:number):boolean{const removed=this.elements.delete(index);if(removed)this.revision++;return removed;}
  clear():void{if(this.size){this.elements.clear();this.revision++;}this.ordered=[];this.orderedRevision=this.revision;}
  orderedEntries():readonly (readonly [number,Element])[]{if(this.orderedRevision!==this.revision){this.ordered=[...this].sort((a,b)=>a[0]-b[0]);this.orderedRevision=this.revision;}return this.ordered;}
}

export abstract class SliverWithKeepAliveWidget extends RenderObjectWidget {
  constructor({key=null}:WidgetOptions={}){super(key);}
  get childWidgets():readonly Widget[]{return [];}
  abstract override createRenderObject(context:BuildContext):RenderSliverMultiBoxAdaptor;
}
export abstract class SliverMultiBoxAdaptorWidget extends SliverWithKeepAliveWidget {
  readonly delegate:SliverChildDelegate;
  readonly childPolicy:SliverChildPolicy;
  constructor({delegate,key=null,childPolicy}:{readonly delegate:SliverChildDelegate;readonly key?:Key|null;readonly childPolicy?:SliverChildPolicy}){super({key});this.delegate=delegate;this.childPolicy=normalizeSliverChildPolicy(childPolicy);invariant(this.childPolicy==='legacy'||this instanceof SliverFixedExtentList||this instanceof SliverSectionList,'unsupported-bounded-sliver','Bounded child policy supports fixed extent and indexed section slivers');protect(this,['delegate','childPolicy']);}
  override createElement():SliverMultiBoxAdaptorElement{return new SliverMultiBoxAdaptorElement(this);}
  estimateMaxScrollOffset(_constraints:SliverConstraints|null,firstIndex:number,lastIndex:number,leadingScrollOffset:number,trailingScrollOffset:number):number|null{return this.delegate.estimateMaxScrollOffset(firstIndex,lastIndex,leadingScrollOffset,trailingScrollOffset);}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new DiagnosticsProperty('delegate',this.delegate));}
}
/** Source integer slots and keyed delegate remapping adapted to queued builds.
 * A private build scope flushes during the actual render layout callback; slot
 * admission derives its predecessor from the active chain after deeper builds. */
export class SliverMultiBoxAdaptorElement extends RenderObjectElement implements RenderSliverBoxChildManager {
  private readonly _childElements=new SliverChildStore();
  private projectedRevision=-1;
  private projectedAdditional:readonly Element[]=[];
  private readonly _buildScope=new BuildScope({scheduleRebuild:()=>{if(this.ready&&this.active)this.renderObject.markNeedsLayout();}});
  private ready=false;private _currentlyUpdatingChildIndex:number|null=null;private _didUnderflow=false;private _rebuildChildren=true;
  private readonly _replaceMovedChildren:boolean;
  private layoutStarted=0;private newChildBuilt=false;private creationCost:number|undefined;
  private preparationEnvironment:{cross:number;main:number;axis:SliverConstraints['axisDirection']}|undefined;
  private previousScroll:number|undefined;private preparationDirection=1;
  private preparationTarget:number|null=null;private preparationRestoring=false;
  private pendingOffsets:Map<number,number>|null=null;
  constructor(widget:SliverMultiBoxAdaptorWidget,{replaceMovedChildren=false}:{readonly replaceMovedChildren?:boolean}={}){super(widget);this._replaceMovedChildren=replaceMovedChildren;}
  override get buildScope():BuildScope{return this._buildScope;}
  override get renderObject():RenderSliverMultiBoxAdaptor{return super.renderObject as RenderSliverMultiBoxAdaptor;}
  private get adaptorWidget():SliverMultiBoxAdaptorWidget{return this.widget as SliverMultiBoxAdaptorWidget;}
  get boundedChildren():boolean{const policy=this.adaptorWidget.childPolicy;return policy!=='legacy'&&policy.mode==='bounded';}
  get preparationIndex():number|null{return this.preparationTarget;}
  private get preparationEnabled():boolean{const policy=this.adaptorWidget.childPolicy;return policy!=='legacy'&&policy.mode==='bounded'&&policy.preparation==='observed-budget';}
  private readonly requestBudgetLayout=()=>{if(this.active)this.renderObject.markNeedsLayout();};
  private childElement(child:RenderBox):Element{const element=this._childElements.get(this.renderObject.indexOf(child));invariant(element,'missing-sliver-child-element','Retained render child needs its actual Element slot');return element;}
  retainChild(child:RenderBox):boolean{if(!this.boundedChildren)return false;const element=this.childElement(child),budget=this.owner.viewWorkBudget;budget.withChild(this,element,this.requestBudgetLayout,()=>{});return budget.retain(element);}
  isRetainedChild(child:RenderBox):boolean{return this.boundedChildren&&!!this.owner.maybeViewWorkBudget?.retained(this.childElement(child));}
  didObtainChild(child:RenderBox,reason:'active'|'explicit'='active'):void{this.owner.maybeViewWorkBudget?.required(this.childElement(child),reason==='active');}
  override mount(parent:Element|undefined,owner:BuildOwner,slot?:unknown):void{super.mount(parent,owner,slot);this.ready=true;}
  override markNeedsBuild():void{this._rebuildChildren=true;super.markNeedsBuild();}
  override update(widget:Widget):void{
    invariant(widget instanceof SliverMultiBoxAdaptorWidget,'invalid-sliver-widget','Sliver Element requires a SliverMultiBoxAdaptorWidget');const old=this.adaptorWidget,already=this._rebuildChildren;super.update(widget);
    const policy=widget.childPolicy;this.owner.maybeDormantChildren?.trimOwner(this,widget.delegate===old.delegate&&policy!=='legacy'&&policy.mode==='dormant'?policy.capacity:0);
    if(widget!==old){this.creationCost=undefined;this.owner.maybeViewWorkBudget?.cancelOwner(this);}
    this._rebuildChildren=already||widget.delegate!==old.delegate&&(widget.delegate.constructor!==old.delegate.constructor||widget.delegate.shouldRebuild(old.delegate));
  }
  protected override slotForChild(_index:number,_previous:Element|undefined):unknown{invariant(this._currentlyUpdatingChildIndex!==null,'missing-sliver-update-index','Sliver child reconciliation requires an integer slot');return this._currentlyUpdatingChildIndex;}
  /** @internal Concrete source slivers can own an offstage prototype subtree. */
  protected get additionalChildren():readonly Element[]{return [];}
  private syncElementChildren():void{
    const additional=this.additionalChildren;
    if(this.projectedRevision===this._childElements.revision&&additional.length===this.projectedAdditional.length&&additional.every((child,index)=>child===this.projectedAdditional[index])&&this.children.every(child=>child.parent===this))return;
    this.children=[...additional,...this._childElements.orderedEntries().map(([,child])=>child)].filter(child=>child.parent===this);
    this.projectedRevision=this._childElements.revision;this.projectedAdditional=[...additional];
  }
  private renderBox(child:Element|undefined):RenderBox|null{if(!child)return null;const renders=child.renderObjects;invariant(renders.length<=1,'multiple-sliver-render-children','Each lazy child must emit a single box subtree');return renders[0] instanceof RenderBox?renders[0]:null;}
  private updateChildAt(index:number,child:Element|undefined,widget:Widget|null):Element|undefined{
    this._currentlyUpdatingChildIndex=index;
    try{
      const cache=this.owner.maybeDormantChildren;
      if(!child&&cache){const cached=cache.peek(this,index);if(cached){if(widget&&Widget.canUpdate(cached.widget,widget))child=cache.take(this,index,this,index);else cache.evictAt(this,index);}}
      const reconcile=()=>this.reconcile(child?[child]:[],widget?[widget]:[])[0],bounded=this.boundedChildren,next=bounded?this.owner.viewWorkBudget.withChild(this,child,this.requestBudgetLayout,reconcile):reconcile();if(bounded&&next&&next!==child){this.newChildBuilt=true;if(index===this.preparationTarget)this.owner.viewWorkBudget.didPrepare(next);}return next;
    }finally{this._currentlyUpdatingChildIndex=null;}
  }
  protected override performRebuild():void{
    this.dirty=false;this.adaptorWidget.updateRenderObject(this,this.renderObject);if(!this._rebuildChildren)return;this._rebuildChildren=false;
    const remapped=new Map<number,Element|null>(),offsets=new Map<number,number>();let childrenUpdated=false;
    for(const [index,child]of this._childElements.orderedEntries()){
      if(child.parent!==this){this._childElements.delete(index);continue;}const key=child.widget.key,newIndex=key===null?null:this.adaptorWidget.delegate.findIndexByKey(key),box=this.renderBox(child),data=box?.parentData;
      if(data instanceof SliverMultiBoxAdaptorParentData&&data.layoutOffset!==null)offsets.set(index,data.layoutOffset);
      if(newIndex!==null&&newIndex!==index){invariant(Number.isSafeInteger(newIndex)&&newIndex>=0,'invalid-remapped-sliver-index','Remapped child index must be a nonnegative safe integer');if(data instanceof SliverMultiBoxAdaptorParentData)data.layoutOffset=null;const occupant=remapped.get(newIndex);invariant(!occupant||occupant.widget.key===null||this.adaptorWidget.delegate.findIndexByKey(occupant.widget.key)===null,'duplicate-remapped-sliver-index','Two keyed children cannot occupy one slot');remapped.set(newIndex,child);if(this._replaceMovedChildren&&!remapped.has(index))remapped.set(index,null);this._childElements.delete(index);}
      else if(!remapped.has(index))remapped.set(index,child);
    }
    const process=(index:number)=>{
      const previous=this._childElements.get(index),candidate=remapped.get(index)??undefined;
      if(previous&&previous!==candidate){this.updateChildAt(index,previous,null);this._childElements.delete(index);childrenUpdated=true;}
      const child=this.updateChildAt(index,candidate,this.adaptorWidget.delegate.build(this,index));
      if(child){childrenUpdated||=previous!==child;this._childElements.set(index,child);}else{childrenUpdated=true;this._childElements.delete(index);}this.syncElementChildren();
    };
    this.renderObject.debugChildIntegrityEnabled=false;
    try{for(const index of [...remapped.keys()].sort((a,b)=>a-b))process(index);if(!childrenUpdated&&this._didUnderflow){const boundary=Math.max(-1,...this._childElements.keys())+1;remapped.set(boundary,this._childElements.get(boundary)??null);process(boundary);}this.pendingOffsets=offsets;}
    finally{this._currentlyUpdatingChildIndex=null;this.renderObject.debugChildIntegrityEnabled=true;this.syncElementChildren();}
  }
  private finishQueuedChildren():void{
    this.syncElementChildren();this.owner.flushRenderTree();
    if(this.pendingOffsets!==null){for(const [index,child]of this._childElements){const data=this.renderBox(child)?.parentData;if(data instanceof SliverMultiBoxAdaptorParentData){if(index===0)data.layoutOffset=0;else if(this.pendingOffsets.has(index))data.layoutOffset=this.pendingOffsets.get(index)!;}}this.pendingOffsets=null;}
  }
  createChild(index:number,{after}:{readonly after:RenderBox|null}):void{
    invariant(this._currentlyUpdatingChildIndex===null&&(!after||after.parent===this.renderObject),'invalid-sliver-create-scope','Create child requires an unlocked manager and actual predecessor');
    const old=this._childElements.get(index),oldData=this.renderBox(old)?.parentData,oldOffset=oldData instanceof SliverMultiBoxAdaptorParentData?oldData.layoutOffset:null;
    this.owner.buildScope(this,()=>{const child=this.updateChildAt(index,old,this.adaptorWidget.delegate.build(this,index));if(child)this._childElements.set(index,child);else this._childElements.delete(index);this.syncElementChildren();});
    this.finishQueuedChildren();const data=this.renderBox(this._childElements.get(index))?.parentData;if(data instanceof SliverMultiBoxAdaptorParentData&&oldOffset!==null)data.layoutOffset=oldOffset;
  }
  removeChild(child:RenderBox):void{
    const index=this.renderObject.indexOf(child);invariant(this._currentlyUpdatingChildIndex===null&&this._childElements.has(index),'invalid-sliver-remove-scope','Remove requires the actual child slot in an unlocked manager');
    const retired=this._childElements.get(index)!;
    let needsSync=this._buildScope.hasDirty;
    this.owner.buildScope(this,()=>{this.updateChildAt(index,this._childElements.get(index),null);this._childElements.delete(index);this.syncElementChildren();needsSync||=this._buildScope.hasDirty;});
    this.owner.maybeViewWorkBudget?.forget(retired);
    // Pure retirement has no queued render admissions. Syncing every surviving
    // subtree for each removed row makes a backward seek needlessly quadratic.
    if(needsSync||this.pendingOffsets!==null)this.finishQueuedChildren();
    const policy=this.adaptorWidget.childPolicy;
    if(policy!=='legacy'&&policy.mode==='dormant'&&this.owner.dormantChildren.retain(this,index,retired,policy.capacity))return;
    if(!this.mounted||!retired.mounted)return;
    if(this.renderObject._retireInactiveChildrenDuringLayout)this.owner._retireInactiveSubtreeWithoutGlobalKeys(retired);
  }
  override forgetChild(child:Element):void{for(const [index,value]of this._childElements)if(value===child){this._childElements.delete(index);break;}this.owner.maybeViewWorkBudget?.forget(child);super.forgetChild(child);}
  private precedingBox(index:number,excluding?:RenderBox):RenderBox|null{let before:RenderBox|null=null,child=this.renderObject.firstChild;while(child!==null){if(child!==excluding&&this.renderObject.indexOf(child)<index)before=child;child=this.renderObject.childAfter(child);}return before;}
  private slotIndex(slot:unknown):number{invariant(typeof slot==='number'&&Number.isSafeInteger(slot)&&slot>=0,'invalid-sliver-slot','Sliver render slot must be a nonnegative safe integer');return slot;}
  override insertRenderObjectChild(child:RenderObject,slot:unknown):void{invariant(child instanceof RenderBox,'invalid-sliver-render-child','Sliver child must be a RenderBox');const index=this.slotIndex(slot),previous=this._currentlyUpdatingChildIndex;this._currentlyUpdatingChildIndex=index;try{this.renderObject.insert(child,this.precedingBox(index)??undefined);}finally{this._currentlyUpdatingChildIndex=previous;}}
  override moveRenderObjectChild(child:RenderObject,_oldSlot:unknown,newSlot:unknown):void{invariant(child instanceof RenderBox,'invalid-sliver-render-child','Sliver child must be a RenderBox');const index=this.slotIndex(newSlot),previous=this._currentlyUpdatingChildIndex;this._currentlyUpdatingChildIndex=index;try{this.renderObject.move(child,this.precedingBox(index,child)??undefined);}finally{this._currentlyUpdatingChildIndex=previous;}}
  override removeRenderObjectChild(child:RenderObject,_slot:unknown):void{this.renderObject.remove(child);}
  protected override synchronizeRenderObjectChildren():void{}
  didAdoptChild(child:RenderBox):void{invariant(this._currentlyUpdatingChildIndex!==null,'missing-sliver-adoption-slot','Adoption requires an actual child slot');(child.parentData as SliverMultiBoxAdaptorParentData).index=this._currentlyUpdatingChildIndex;}
  setDidUnderflow(value:boolean):void{this._didUnderflow=value;}
  debugAssertChildListLocked():boolean{invariant(this._currentlyUpdatingChildIndex===null,'locked-sliver-child-list','Child list is currently being updated');return true;}
  didStartLayout():void{this.debugAssertChildListLocked();if(this.preparationEnabled){const c=this.renderObject.constraints,old=this.preparationEnvironment;if(!old||old.cross!==c.crossAxisExtent||old.main!==c.viewportMainAxisExtent||old.axis!==c.axisDirection){this.creationCost=undefined;this.owner.maybeViewWorkBudget?.cancelOwner(this);this.preparationEnvironment={cross:c.crossAxisExtent,main:c.viewportMainAxisExtent,axis:c.axisDirection};}this.layoutStarted=this.owner.services.clock.now();this.newChildBuilt=false;}else this.owner.maybeViewWorkBudget?.cancelOwner(this);if(!this.boundedChildren)this.owner.maybeViewWorkBudget?.evictOwner(this);this.renderObject._invokeChildManagerLayoutCallback(()=>{this.owner.buildScope(this);this.finishQueuedChildren();});}
  didFinishLayout():void{
    this.debugAssertChildListLocked();const entries=this._childElements.orderedEntries();this.adaptorWidget.delegate.didFinishLayout(entries[0]?.[0]??0,entries.at(-1)?.[0]??0);
    if(!this.preparationEnabled)return;
    const budget=this.owner.viewWorkBudget,render=this.renderObject,c=render.constraints,widget=this.widget;
    if(this.newChildBuilt)this.creationCost=this.owner.services.clock.now()-this.layoutStarted;
    if(this.preparationTarget===null&&!this.preparationRestoring&&this.previousScroll!==undefined&&c.scrollOffset!==this.previousScroll)this.preparationDirection=c.scrollOffset>this.previousScroll?1:-1;
    this.previousScroll=c.scrollOffset;this.preparationRestoring=false;
    const edge=this.preparationDirection>0?render.lastChild:render.firstChild,count=this.estimatedChildCount;
    if(!edge||count===null||this.creationCost===undefined){budget.cancelOwner(this);return;}
    let index=render.indexOf(edge)+this.preparationDirection;
    for(let skipped=0;skipped<8&&this._childElements.has(index);skipped++)index+=this.preparationDirection;
    if(index<0||index>=count||this._childElements.has(index)){budget.cancelOwner(this);return;}
    budget.setCandidate({owner:this,estimatedMs:this.creationCost,elements:budget.estimateElements(this),valid:()=>this.active&&this.widget===widget&&this.preparationEnabled&&render.attached&&render.constraints===c&&!this._childElements.has(index),request:()=>{this.preparationTarget=index;this.requestBudgetLayout();},finish:()=>{this.preparationTarget=null;this.preparationRestoring=true;this.requestBudgetLayout();}});
  }
  get estimatedChildCount():number|null{return this.adaptorWidget.delegate.estimatedChildCount;}
  get childCount():number{
    const estimated=this.estimatedChildCount;if(estimated!==null)return estimated;let lo=0,hi=1;const max=9007199254740992;
    while(this.adaptorWidget.delegate.build(this,hi-1)!==null){lo=hi-1;if(hi<max/2)hi*=2;else if(hi<max)hi=max;else throw new FlutterError('Could not find the number of children. Provide childCount to avoid an unbounded builder search.');}
    while(hi-lo>1){const mid=Math.floor((hi-lo)/2)+lo;if(this.adaptorWidget.delegate.build(this,mid-1)===null)hi=mid;else lo=mid;}return lo;
  }
  estimateMaxScrollOffset(constraints:SliverConstraints|null,{firstIndex,lastIndex,leadingScrollOffset,trailingScrollOffset}:EstimateMaxScrollOffsetOptions):number{
    const childCount=this.estimatedChildCount;if(childCount===null)return Infinity;
    invariant(firstIndex!=null&&lastIndex!=null&&leadingScrollOffset!=null&&trailingScrollOffset!=null,'missing-sliver-estimate-range','Finite estimate requires current child range and offsets');
    const estimate=this.adaptorWidget.estimateMaxScrollOffset(constraints,firstIndex,lastIndex,leadingScrollOffset,trailingScrollOffset);if(estimate!==null)return estimate;if(lastIndex===childCount-1)return trailingScrollOffset;
    return trailingScrollOffset+(trailingScrollOffset-leadingScrollOffset)/(lastIndex-firstIndex+1)*(childCount-lastIndex-1);
  }
  override visitChildren(visitor:(child:Element)=>void):void{for(const [,child]of this._childElements.orderedEntries())if(child.parent===this)visitor(child);}
  override unmount():void{
    if(!this.mounted)return;this.ready=false;this.owner.maybeViewWorkBudget?.cancelOwner(this);const errors:unknown[]=[];
    try{this.owner.maybeDormantChildren?.trimOwner(this);}catch(error){errors.push(error);}
    try{super.unmount();}catch(error){errors.push(error);}finally{this._buildScope._clear();this._childElements.clear();this.pendingOffsets=null;}
    if(errors.length===1)throw errors[0];if(errors.length)throw new AggregateError(errors,'Sliver and dormant children teardown failed');
  }
}
export class SliverFixedExtentList extends SliverMultiBoxAdaptorWidget {
  readonly itemExtent:number;
  constructor({delegate,itemExtent,key=null,childPolicy}:{readonly delegate:SliverChildDelegate;readonly itemExtent:number;readonly key?:Key|null;readonly childPolicy?:SliverChildPolicy}){super({delegate,key,...(childPolicy!==undefined?{childPolicy}:{})});invariant(this.childPolicy==='legacy'||itemExtent>0,'invalid-bounded-item-extent','Bounded fixed extent requires a positive itemExtent');this.itemExtent=itemExtent;protect(this,['itemExtent']);}
  static builder({itemBuilder,itemExtent,itemCount=null,key=null,childPolicy='legacy',...options}:Omit<SliverChildBuilderDelegateOptions,'childCount'>&{readonly itemBuilder:NullableIndexedWidgetBuilder;readonly itemExtent:number;readonly itemCount?:number|null;readonly key?:Key|null;readonly childPolicy?:SliverChildPolicy}):SliverFixedExtentList{return new SliverFixedExtentList({key,itemExtent,childPolicy,delegate:new SliverChildBuilderDelegate(itemBuilder,{...options,childCount:itemCount})});}
  static list({children,itemExtent,key=null,childPolicy='legacy',...options}:SliverChildDelegateOptions&{readonly children:readonly Widget[];readonly itemExtent:number;readonly key?:Key|null;readonly childPolicy?:SliverChildPolicy}):SliverFixedExtentList{return new SliverFixedExtentList({key,itemExtent,childPolicy,delegate:new SliverChildListDelegate(children,options)});}
  createRenderObject(context:BuildContext):RenderSliverFixedExtentList{invariant(context instanceof SliverMultiBoxAdaptorElement,'invalid-sliver-context','Fixed sliver requires its actual child Element');return new RenderSliverFixedExtentList({childManager:context,itemExtent:this.itemExtent});}
  updateRenderObject(_context:BuildContext,render:RenderSliverFixedExtentList):void{render.itemExtent=this.itemExtent;}
}
export class SliverVariedExtentList extends SliverMultiBoxAdaptorWidget {
  readonly itemExtentBuilder:ItemExtentBuilder;
  constructor({delegate,itemExtentBuilder,key=null}:{readonly delegate:SliverChildDelegate;readonly itemExtentBuilder:ItemExtentBuilder;readonly key?:Key|null}){super({delegate,key});this.itemExtentBuilder=itemExtentBuilder;protect(this,['itemExtentBuilder']);}
  static builder({itemBuilder,itemExtentBuilder,itemCount=null,key=null,...options}:Omit<SliverChildBuilderDelegateOptions,'childCount'>&{readonly itemBuilder:NullableIndexedWidgetBuilder;readonly itemExtentBuilder:ItemExtentBuilder;readonly itemCount?:number|null;readonly key?:Key|null}):SliverVariedExtentList{return new SliverVariedExtentList({key,itemExtentBuilder,delegate:new SliverChildBuilderDelegate(itemBuilder,{...options,childCount:itemCount})});}
  static list({children,itemExtentBuilder,key=null,...options}:SliverChildDelegateOptions&{readonly children:readonly Widget[];readonly itemExtentBuilder:ItemExtentBuilder;readonly key?:Key|null}):SliverVariedExtentList{return new SliverVariedExtentList({key,itemExtentBuilder,delegate:new SliverChildListDelegate(children,options)});}
  createRenderObject(context:BuildContext):RenderSliverVariedExtentList{invariant(context instanceof SliverMultiBoxAdaptorElement,'invalid-sliver-context','Varied sliver requires its actual child Element');return new RenderSliverVariedExtentList({childManager:context,itemExtentBuilder:this.itemExtentBuilder});}
  updateRenderObject(_context:BuildContext,render:RenderSliverVariedExtentList):void{render.itemExtentBuilder=this.itemExtentBuilder;}
}
export class SliverList extends SliverMultiBoxAdaptorWidget {
  constructor(options:{readonly delegate:SliverChildDelegate;readonly key?:Key|null}){super(options);}
  static builder({itemBuilder,itemCount=null,key=null,...options}:Omit<SliverChildBuilderDelegateOptions,'childCount'>&{readonly itemBuilder:NullableIndexedWidgetBuilder;readonly itemCount?:number|null;readonly key?:Key|null}):SliverList{return new SliverList({key,delegate:new SliverChildBuilderDelegate(itemBuilder,{...options,childCount:itemCount})});}
  static list({children,key=null,...options}:SliverChildDelegateOptions&{readonly children:readonly Widget[];readonly key?:Key|null}):SliverList{return new SliverList({key,delegate:new SliverChildListDelegate(children,options)});}
  override createElement():SliverMultiBoxAdaptorElement{return new SliverMultiBoxAdaptorElement(this,{replaceMovedChildren:true});}
  createRenderObject(context:BuildContext):RenderSliverList{invariant(context instanceof SliverMultiBoxAdaptorElement,'invalid-sliver-context','SliverList requires its actual child Element');return new RenderSliverList({childManager:context});}
}
/** Measured variable-height sections. Change metricRevision when typography or
 * content metrics change; width, locale, direction and text scaling are tracked.
 * The delegate must have a finite count matching extentIndex.count. */
export class SliverSectionList extends SliverMultiBoxAdaptorWidget {
  readonly extentIndex:SectionExtentIndex;readonly metricRevision:object|null;
  constructor({delegate,extentIndex,metricRevision=null,key=null,childPolicy}:{readonly delegate:SliverChildDelegate;readonly extentIndex:SectionExtentIndex;readonly metricRevision?:object|null;readonly key?:Key|null;readonly childPolicy?:SliverChildPolicy}){
    super({delegate,key,...(childPolicy!==undefined?{childPolicy}:{})});invariant(delegate.estimatedChildCount===extentIndex.count,'section-count-mismatch','Section delegate count must match its extent index');this.extentIndex=extentIndex;this.metricRevision=metricRevision;protect(this,['extentIndex','metricRevision']);
  }
  private environment(context:BuildContext):SectionExtentEnvironment{const media=MediaQuery._maybeTextMetricsOf(context);return {deviceScale:media?.scale??1,textScale:media?.textScale??1,textScaler:media?.textScaler??null,boldText:media?.boldText??false,direction:context.maybeDependOn(Directionality)?.direction??null,locale:context.maybeDependOn(Localizations)?.locale??null};}
  createRenderObject(context:BuildContext):RenderSliverSectionList{invariant(context instanceof SliverMultiBoxAdaptorElement,'invalid-sliver-context','Section sliver requires its actual child Element');return new RenderSliverSectionList({childManager:context,extentIndex:this.extentIndex,metricRevision:this.metricRevision,environment:this.environment(context)});}
  updateRenderObject(context:BuildContext,render:RenderSliverSectionList):void{render.update(this.extentIndex,this.metricRevision,this.environment(context));}
}
export class SliverGrid extends SliverMultiBoxAdaptorWidget {
  readonly gridDelegate:SliverGridDelegate;
  constructor({delegate,gridDelegate,key=null}:{readonly delegate:SliverChildDelegate;readonly gridDelegate:SliverGridDelegate;readonly key?:Key|null}){super({delegate,key});this.gridDelegate=gridDelegate;protect(this,['gridDelegate']);}
  static builder({itemBuilder,gridDelegate,itemCount=null,key=null,...options}:Omit<SliverChildBuilderDelegateOptions,'childCount'>&{readonly itemBuilder:NullableIndexedWidgetBuilder;readonly gridDelegate:SliverGridDelegate;readonly itemCount?:number|null;readonly key?:Key|null}):SliverGrid{return new SliverGrid({key,gridDelegate,delegate:new SliverChildBuilderDelegate(itemBuilder,{...options,childCount:itemCount})});}
  static count({crossAxisCount,mainAxisSpacing=0,crossAxisSpacing=0,childAspectRatio=1,children=[],key=null}:{readonly crossAxisCount:number;readonly mainAxisSpacing?:number;readonly crossAxisSpacing?:number;readonly childAspectRatio?:number;readonly children?:readonly Widget[];readonly key?:Key|null}):SliverGrid{return new SliverGrid({key,gridDelegate:new SliverGridDelegateWithFixedCrossAxisCount({crossAxisCount,mainAxisSpacing,crossAxisSpacing,childAspectRatio}),delegate:new SliverChildListDelegate(children)});}
  static extent({maxCrossAxisExtent,mainAxisSpacing=0,crossAxisSpacing=0,childAspectRatio=1,children=[],key=null}:{readonly maxCrossAxisExtent:number;readonly mainAxisSpacing?:number;readonly crossAxisSpacing?:number;readonly childAspectRatio?:number;readonly children?:readonly Widget[];readonly key?:Key|null}):SliverGrid{return new SliverGrid({key,gridDelegate:new SliverGridDelegateWithMaxCrossAxisExtent({maxCrossAxisExtent,mainAxisSpacing,crossAxisSpacing,childAspectRatio}),delegate:new SliverChildListDelegate(children)});}
  createRenderObject(context:BuildContext):RenderSliverGrid{invariant(context instanceof SliverMultiBoxAdaptorElement,'invalid-sliver-context','Grid requires its actual child Element');return new RenderSliverGrid({childManager:context,gridDelegate:this.gridDelegate});}
  updateRenderObject(_context:BuildContext,render:RenderSliverGrid):void{render.gridDelegate=this.gridDelegate;}
  override estimateMaxScrollOffset(constraints:SliverConstraints|null,firstIndex:number,lastIndex:number,leadingScrollOffset:number,trailingScrollOffset:number):number{const estimate=super.estimateMaxScrollOffset(constraints,firstIndex,lastIndex,leadingScrollOffset,trailingScrollOffset);if(estimate!==null)return estimate;invariant(constraints!==null&&this.delegate.estimatedChildCount!==null,'missing-grid-estimate-inputs','Grid total estimate requires constraints and a finite child count');return this.gridDelegate.getLayout(constraints).computeMaxScrollOffset(this.delegate.estimatedChildCount);}
}
