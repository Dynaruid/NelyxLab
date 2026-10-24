// SPDX-License-Identifier: BSD-3-Clause
// Source owns layout/paint/child selection; this module binds actual Core ownership.
import {Element,RenderObjectElement,RenderObjectWidget,BuildScope,NotifiableElementMixin} from './framework.ts';
import type {Widget,BuildOwner} from './framework.ts';
import {ViewportElementMixin} from './scroll-notification.ts';
import {RenderBox,RenderObject,ParentData} from '../rendering/object.ts';
import type {PipelineOwner,HitTestEntry,ShowOnScreenOptions} from '../rendering/object.ts';
import {RenderAbstractViewport,RevealedOffset} from '../rendering/viewport.ts';
import type {ViewportOffset,ViewportMoveOptions} from '../rendering/viewport-offset.ts';
import {KeepAliveParentDataMixin} from '../rendering/sliver-multi-box-adaptor.ts';
import {BoxConstraints} from '../rendering/constraints.ts';
import {WheelBoxHitTestResult,wheelBoxSize} from '../rendering/list-wheel-renderer-adapter.ts';
import type {PaintingContext} from '../painting/context.ts';
import {MatrixUtils} from '../painting/matrix-utils.ts';
import {Axis} from '../painting/basic-types.ts';
import {Curves} from '../animation/curves.ts';
import type {Curve} from '../animation/curves.ts';
import {Key} from '../../foundation/key.ts';
import {invariant} from '../../foundation/errors.ts';
import {DartMap,DartIterable} from '../../foundation/dart-collections.ts';
import type {DartKeyPolicy} from '../../foundation/dart-collections.ts';
import {Offset} from '../../ui/offset.ts';
import {Rect} from '../../ui/rect.ts';
import {Size} from '../../ui/size.ts';
import type {Clip} from '../../ui/clip.ts';
import {Matrix4} from '../../math/matrix4.ts';
import {identity,multiply,contains,captureTransform} from '../../ui/geometry.ts';
import type {TransformMatrix,Offset as Point,Size as GeometrySize} from '../../ui/geometry.ts';
import type {Rect as GeometryRect} from '../../ui/types.ts';
import {checkedInteger} from '../../ui/value-math.ts';
import {ChildVicinity} from './child-vicinity.generated.ts';

export type DartMutableList<T>=T[];
export type HostType=Function;
export type TwoDimensionalViewportContract=Pick<RenderAbstractViewport<RenderBox>,keyof RenderAbstractViewport<RenderBox>>;
export class Exception extends Error{}
const point=(p:Point)=>p instanceof Offset?p:new Offset(p.x,p.y),rect=(r:GeometryRect)=>r instanceof Rect?r:Rect.fromLTWH(r.x,r.y,r.width,r.height);
export function twoDimensionalObjectString(value:{}|null):string{return value===null?'null':value.toString();}
export function twoDimensionalRuntimeType(value:object):Function{return value.constructor;}
export function twoDimensionalTypeString(value:Function):string{return value.name.replace(/^Source/,'');}
export function twoDimensionalListAdd<T>(values:T[],value:T):void{values.push(value);}
export function twoDimensionalListClear(values:unknown[]):void{values.length=0;}
export function twoDimensionalListRemove<T>(values:T[],value:unknown):boolean{const index=values.indexOf(value as T);if(index<0)return false;values.splice(index,1);return true;}
export function twoDimensionalListSort<T>(values:T[],compare?:(a:T,b:T)=>number):void{values.sort(compare??((a,b)=>{invariant(a!==null&&typeof (a as {compareTo?:unknown}).compareTo==='function','invalid-vicinity-sort','Default 2D list sorting requires Comparable values');return (a as {compareTo(value:T):number}).compareTo(b);}));}
export function twoDimensionalNumberCompare(a:number,b:number):number{return checkedInteger(a)===checkedInteger(b)?0:a<b?-1:1;}
export function twoDimensionalIterableIsEmpty<T>(value:readonly T[]|DartIterable<T>):boolean{return value instanceof DartIterable?value.isEmpty:value.length===0;}
export function twoDimensionalContainsBox(value:readonly RenderBox[]|DartIterable<RenderBox>,box:unknown):boolean{return value instanceof DartIterable?value.contains(box):value.some(v=>v===box);}
export function debugCheckHasBoundedAxis(axis:Axis,constraints:BoxConstraints):boolean{invariant(Number.isFinite(axis===Axis.vertical?constraints.maxHeight:constraints.maxWidth),'unbounded-two-dimensional-viewport','Two-dimensional viewport requires bounded axes');return true;}
const identityPolicy=<T>(accepts:(v:unknown)=>v is T):DartKeyPolicy<T>=>({accepts,hash:v=>v,equals:(a,b)=>a===b});
const elementPolicy=identityPolicy((v):v is Element=>v instanceof Element),boxPolicy=identityPolicy((v):v is RenderBox=>v instanceof RenderBox);
const vicinityPolicy:DartKeyPolicy<ChildVicinity>={accepts:(v):v is ChildVicinity=>v instanceof ChildVicinity,validQuery:v=>v instanceof ChildVicinity,hash:v=>(v as ChildVicinity).hashCode,equals:(a,b)=>a.equals(b as {})};
const keyPolicy:DartKeyPolicy<Key>={accepts:(v):v is Key=>v instanceof Key,validQuery:v=>v instanceof Key,hash:v=>(v as Key).hashCode,equals:(a,b)=>a.equals(b as Key)};
export function createChildVicinityElementMap():DartMap<ChildVicinity,Element>{return new DartMap(vicinityPolicy,elementPolicy.accepts,elementPolicy);}
export function createKeyElementMap():DartMap<Key,Element>{return new DartMap(keyPolicy,elementPolicy.accepts,elementPolicy);}
export function createChildVicinityRenderBoxMap():DartMap<ChildVicinity,RenderBox>{return new DartMap(vicinityPolicy,boxPolicy.accepts,boxPolicy);}
export abstract class TwoDimensionalParentDataHost extends KeepAliveParentDataMixin(ParentData){abstract vicinity:ChildVicinity;}
export abstract class TwoDimensionalWidgetHost extends RenderObjectWidget{constructor({key=null}:{key?:Key|null}={}){super(key);}get childWidgets():readonly Widget[]{return [];}}
export interface TwoDimensionalShowOptions{descendant?:RenderObject|null;rect?:Rect|null;duration?:number;curve?:Curve}
const layoutOwners=new WeakMap<TwoDimensionalRenderHost,TwoDimensionalElementHost>();
interface ShowRequest{owner:TwoDimensionalRenderHost;descendant:RenderObject|null;targetRect:Rect;bothImplicit:boolean;moved:boolean}
const showRequests=new WeakMap<ViewportOffset,Set<ShowRequest>>(),retiredShowRequest=Symbol('retired two-dimensional reveal');
/** Track source movement before callbacks/animation; pixel changes are not a
 * reliable indication that an animated request has started. */
export function twoDimensionalMoveTo(offset:ViewportOffset,to:number,options:ViewportMoveOptions={}):Promise<void>{
  const requests=showRequests.get(offset);for(const request of requests??[])request.moved=true;
  const result=offset.moveTo(to,options);
  if([...requests??[]].some(request=>request.owner.debugDisposed))throw retiredShowRequest;
  return result;
}
export abstract class TwoDimensionalRenderHost extends RenderAbstractViewport<RenderBox>{
  private currentShowRequest:ShowRequest|null=null;
  constructor(){super({childType:RenderBox});}
  abstract sourcePerformLayout():void;
  abstract sourcePaint(context:PaintingContext,offset:Offset):void;
  abstract sourceHitTestChildren(result:TwoDimensionalHitTestResult,options:{position:Offset}):boolean;
  abstract sourceShowOnScreen(options?:TwoDimensionalShowOptions):void;
  abstract sourceGetOffsetToReveal(target:RenderObject,alignment:number,options?:{rect?:Rect|null;axis?:Axis|null}):RevealedOffset;
  abstract get clipBehavior():Clip;
  abstract get isRepaintBoundary():boolean;
  abstract get horizontalOffset():ViewportOffset;
  abstract get verticalOffset():ViewportOffset;
  abstract readonly sourceChildren:DartMap<ChildVicinity,RenderBox>;
  abstract readonly sourceActiveChildren:DartMap<ChildVicinity,RenderBox>;
  abstract readonly sourceKeepAliveBucket:DartMap<ChildVicinity,RenderBox>;
  abstract readonly sourceCurrentVicinities:ChildVicinity[];
  abstract sourceFirstChild:RenderBox|null;
  abstract sourceLastChild:RenderBox|null;
  abstract sourceDebugOrphans:RenderBox[]|null;
  abstract set sourceDanglingKeepAlives(value:RenderBox[]);
  abstract sourceNeedsDelegateRebuild:boolean;
  abstract sourceDidResize:boolean;
  get needsCompositing():boolean{return this.isRepaintBoundary;}
  get sourceSize():Size{return wheelBoxSize(this);}
  get sourceRuntimeType():Function{return this.constructor;}
  protected override performLayout(_constraints:BoxConstraints):GeometrySize{
    const owner=layoutOwners.get(this);
    try{if(owner)this.invokeLayoutCallback(()=>owner.prepareSourceLayout());this.sourcePerformLayout();return this.size;}
    catch(error){const errors:unknown[]=[error];try{this.invokeLayoutCallback(()=>{try{owner?.abortSourceLayout();}catch(failure){errors.push(failure);}try{RenderObject.prototype.setChildren.call(this,[]);}catch(failure){errors.push(failure);}this.clearSourceReferences();});}catch(failure){errors.push(failure);}if(errors.length>1)throw new AggregateError(errors,'Two-dimensional layout and owner recovery failed');throw error;}
  }
  /** A failed source pass is not commit-able. Retire the local window and retry
   * from the same offsets/delegate instead of reusing half-moved slot maps. */
  private clearSourceReferences():void{this.sourceChildren.clear();this.sourceActiveChildren.clear();this.sourceKeepAliveBucket.clear();this.sourceCurrentVicinities.length=0;this.sourceFirstChild=null;this.sourceLastChild=null;this.sourceDebugOrphans=null;this.sourceDanglingKeepAlives=[];this.sourceNeedsDelegateRebuild=true;this.sourceDidResize=true;}
  isActiveSourceChild(child:RenderBox):boolean{const data=child.parentData;return data instanceof TwoDimensionalParentDataHost&&this.sourceActiveChildren.get(data.vicinity)===child;}
  sourceInvokeLayout(callback:(constraints:BoxConstraints)=>void):void{this.invokeLayoutCallback(c=>{invariant(c instanceof BoxConstraints,'invalid-2d-constraints','Source layout requires BoxConstraints');try{callback(c);}finally{layoutOwners.get(this)?.finishQueuedChildren();}});}
  sourceAdoptChild(child:RenderBox):void{this.insert(child,this.children.at(-1));}
  sourceDropChild(child:RenderBox):void{this.remove(child);}
  sourceRedepthChild(child:RenderObject):void{this.redepthChild(child);}
  override paint(context:PaintingContext):void{this.sourcePaint(context,Offset.zero);}
  override get clips():boolean{return this.clipBehavior!=='none';}
  protected override childTransform(child:RenderObject):TransformMatrix{invariant(child instanceof RenderBox&&child.parent===this,'invalid-2d-child','Transform requires an owned box');const m=Matrix4.identity();this.applyPaintTransform(child,m);return multiply(captureTransform(m.storage),child.localTransform);}
  override hitTest(position:Point,result:HitTestEntry[],toLocal:TransformMatrix=identity):boolean{invariant(this.hasSize,'unlaid-2d','Layout before hit testing');if(!contains({x:0,y:0,...this.size},position))return false;const hit=this.sourceHitTestChildren(new TwoDimensionalHitTestResult(result,toLocal),{position:point(position)}),self=this.hitTestSelf(position);if(self)result.push({target:this,transform:toLocal});return hit||self;}
  override getOffsetToReveal(target:RenderObject,alignment:number,options:{rect?:GeometryRect|null;axis?:Axis|null}={}):RevealedOffset{return this.sourceGetOffsetToReveal(target,alignment,{rect:options.rect?rect(options.rect):null,axis:options.axis??null});}
  override showOnScreen(bounds:GeometryRect=this.paintBounds,options:ShowOnScreenOptions={}):void{
    if(this.debugDisposed)return;
    const previous=this.currentShowRequest,request:ShowRequest={owner:this,descendant:options.descendant??null,targetRect:rect(options.targetRect??bounds),bothImplicit:this.horizontalOffset.allowImplicitScrolling&&this.verticalOffset.allowImplicitScrolling,moved:false},offsets=new Set([this.horizontalOffset,this.verticalOffset]);
    this.currentShowRequest=request;for(const offset of offsets){let requests=showRequests.get(offset);if(!requests)showRequests.set(offset,requests=new Set());requests.add(request);}
    try{this.sourceShowOnScreen({descendant:request.descendant,rect:request.targetRect,duration:options.duration??0,curve:options.curve??Curves.ease});}
    catch(error){if(error!==retiredShowRequest)throw error;}
    finally{this.currentShowRequest=previous;for(const offset of offsets){const requests=showRequests.get(offset);requests?.delete(request);if(requests?.size===0)showRequests.delete(offset);}}
  }
  sourceForwardShowOnScreen({descendant=null,rect:bounds=null,duration=0,curve=Curves.ease}:TwoDimensionalShowOptions={}):void{
    if(this.debugDisposed)return;
    const request=this.currentShowRequest;
    // The source's already-visible two-axis fallback returns a parent rect and
    // drops the requested subrect. Core must retain the original target instead.
    if(descendant===null&&bounds!==null&&request?.descendant&&request.bothImplicit&&!request.moved){descendant=request.descendant;bounds=request.targetRect;}
    const target=descendant??this,targetRect=bounds??rect(target.paintBounds),local=target===this?targetRect:MatrixUtils.transformRect(Matrix4.fromList(Array.from(target.getTransformTo(this))),targetRect);
    // Core transports both the current parent's rect and the original target.
    super.showOnScreen(local,{duration,curve,descendant:target,targetRect});
  }
  override dispose():void{try{super.dispose();}finally{if(this.debugDisposed){layoutOwners.delete(this);this.clearSourceReferences();}}}
}
export class TwoDimensionalHitTestResult extends WheelBoxHitTestResult{
  addWithPaintOffset({offset,position,hitTest}:{offset:Offset|null;position:Offset;hitTest:(result:TwoDimensionalHitTestResult,position:Offset)=>boolean}):boolean{return this.addWithPaintTransform({transform:offset?Matrix4.translationValues(offset.dx,offset.dy,0):null,position,hitTest:(_result,p)=>hitTest(this,p)});}
  override hitBox(child:RenderBox,position:Offset):boolean{if(child.parent instanceof TwoDimensionalRenderHost&&!child.parent.isActiveSourceChild(child))return false;return super.hitBox(child,position);}
}
const sourceSlots=new WeakMap<Element,ChildVicinity>();
export abstract class TwoDimensionalElementHost extends ViewportElementMixin(NotifiableElementMixin(RenderObjectElement)){
  abstract readonly sourceVicinityToChild:DartMap<ChildVicinity,Element>;
  abstract sourceNewVicinityToChild:DartMap<ChildVicinity,Element>|null;
  abstract readonly sourceKeyToChild:DartMap<Key,Element>;
  abstract sourceNewKeyToChild:DartMap<Key,Element>|null;
  abstract sourcePerformRebuild():void;
  abstract sourceInsertRenderObjectChild(child:RenderBox,slot:ChildVicinity):void;
  abstract sourceMoveRenderObjectChild(child:RenderBox,oldSlot:ChildVicinity,newSlot:ChildVicinity):void;
  abstract sourceRemoveRenderObjectChild(child:RenderBox,slot:ChildVicinity):void;
  private ready=false;private updatingSlot:ChildVicinity|null=null;
  private readonly scope=new BuildScope({scheduleRebuild:()=>{if(this.ready&&this.active)this.renderObject.markNeedsLayout();}});
  override get buildScope():BuildScope{return this.scope;}
  get sourceRenderObject():RenderObject{return this.renderObject;}
  override mount(parent:Element|undefined,owner:BuildOwner,slot?:unknown):void{super.mount(parent,owner,slot);invariant(this.renderObject instanceof TwoDimensionalRenderHost,'invalid-2d-owner','Expected source viewport host');layoutOwners.set(this.renderObject,this);this.ready=true;}
  override performRebuild():void{try{this.sourcePerformRebuild();this.owner.parentRebuilt(this);}finally{this.syncManagedChildren();}}
  protected performRebuildBase():void{this.dirty=false;(this.widget as RenderObjectWidget).updateRenderObject(this,this.renderObject);}
  prepareSourceLayout():void{if(this.scope.hasDirty||this.dirty)this.owner.buildScope(this);this.finishQueuedChildren();}
  protected override slotForChild():unknown{invariant(this.updatingSlot,'missing-2d-slot','Child reconciliation needs its source vicinity');return this.updatingSlot;}
  updateChild(child:Element|null,widget:Widget|null,slot:{}|null):Element|null{const previous=this.updatingSlot;if(widget)invariant(slot instanceof ChildVicinity,'invalid-2d-slot','An inserted Widget requires ChildVicinity');this.updatingSlot=slot instanceof ChildVicinity?slot:null;try{const next=this.reconcile(child?[child]:[],widget?[widget]:[])[0]??null;if(next)sourceSlots.set(next,this.updatingSlot!);return next;}finally{this.updatingSlot=previous;}}
  syncManagedChildren():void{if(!this.ready)return;this.children=[...new Set([...this.sourceVicinityToChild.values,...this.sourceNewVicinityToChild?.values??[]])].filter(child=>child.parent===this);}
  finishQueuedChildren():void{this.syncManagedChildren();for(const child of this.children)child.syncRenderTree();}
  private clearSourceMaps():void{this.sourceVicinityToChild.clear();this.sourceKeyToChild.clear();this.sourceNewVicinityToChild?.clear();this.sourceNewKeyToChild?.clear();this.sourceNewVicinityToChild=null;this.sourceNewKeyToChild=null;this.children=[];}
  abortSourceLayout():void{const children=[...new Set([...this.children,...this.sourceVicinityToChild.values,...this.sourceKeyToChild.values,...this.sourceNewVicinityToChild?.values??[],...this.sourceNewKeyToChild?.values??[]])].filter(child=>child.parent===this);try{this.owner.deactivateChildren(children);}finally{this.clearSourceMaps();}}
  override insertRenderObjectChild(child:RenderObject,slot:unknown):void{invariant(child instanceof RenderBox&&slot instanceof ChildVicinity,'invalid-2d-insertion','Expected box and vicinity');this.sourceInsertRenderObjectChild(child,slot);}
  override moveRenderObjectChild(child:RenderObject,oldSlot:unknown,newSlot:unknown):void{
    invariant(child instanceof RenderBox&&oldSlot instanceof ChildVicinity&&newSlot instanceof ChildVicinity,'invalid-2d-move','Expected box and vicinities');const render=this.renderObject,data=child.parentData;
    if(render instanceof TwoDimensionalRenderHost&&data instanceof TwoDimensionalParentDataHost&&render.sourceKeepAliveBucket.get(data.vicinity)===child){
      // Core is actively relocating this cached keyed child. Run the original
      // active move/orphan bookkeeping, then retire its previous cache slot.
      const previous=data.keepAlive,vicinity=data.vicinity;data.keepAlive=false;try{this.sourceMoveRenderObjectChild(child,oldSlot,newSlot);render.sourceKeepAliveBucket.remove(vicinity);}finally{data.keepAlive=previous;}
    }else this.sourceMoveRenderObjectChild(child,oldSlot,newSlot);
  }
  override removeRenderObjectChild(child:RenderObject,slot:unknown):void{invariant(child instanceof RenderBox&&slot instanceof ChildVicinity,'invalid-2d-removal','Expected box and vicinity');this.sourceRemoveRenderObjectChild(child,slot);}
  override forgetChild(child:Element):void{sourceSlots.delete(child);super.forgetChild(child);}
  protected override synchronizeRenderObjectChildren():void{}
  override unmount():void{if(!this.mounted)return;const render=this.renderObject;this.syncManagedChildren();try{super.unmount();}finally{if(render instanceof TwoDimensionalRenderHost)layoutOwners.delete(render);this.ready=false;this.clearSourceMaps();}}
}
export function twoDimensionalBuildScope(owner:BuildOwner,element:Element,callback:()=>void):void{invariant(element instanceof TwoDimensionalElementHost&&element.owner===owner,'invalid-2d-build-owner','Build scope requires the owning 2D Element');owner.buildScope(element,()=>{try{callback();}finally{element.syncManagedChildren();}});element.finishQueuedChildren();}
export function twoDimensionalElementSlot(element:Element):{}|null{return sourceSlots.get(element)??element.slot??null;}
