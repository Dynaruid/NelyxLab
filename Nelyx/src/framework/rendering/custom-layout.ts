// SPDX-License-Identifier: BSD-3-Clause
// Reviewed Flutter custom_layout.dart and shifted_box.dart; exact selections and TS differences are in upstream coverage.
import {invariant} from '../../foundation/errors.ts';
import {Key,ValueKey,KeyMap,sameKey} from '../../foundation/key.ts';
import type {Listenable} from '../../foundation/notifier.ts';
import type {Size,Offset} from '../../ui/geometry.ts';
import {BoxConstraints} from './constraints.ts';
import {RenderBox,ContainerBoxParentData} from './object.ts';
import type {RenderObject,PipelineOwner,TextBaseline} from './object.ts';
export type LayoutIdentifier=object|string|number|boolean|bigint|symbol;
/** Ordinary objects use identity; Nelyx Key values opt into explicit value equality/hash. */
export function layoutIdKey(id:LayoutIdentifier):Key{invariant(id!==null&&id!==undefined&&!(typeof id==='number'&&Number.isNaN(id)),'invalid-layout-id','Layout IDs must be non-null and reflexive');return new ValueKey(id,Object,(a,b)=>a instanceof Key&&b instanceof Key?sameKey(a,b):a===b,value=>value instanceof Key?value.hashCode:value);}
function failures(errors:unknown[],message:string):void{if(errors.length===1)throw errors[0];if(errors.length)throw new AggregateError(errors,message);}
function attempt(errors:unknown[],callback:()=>void):void{try{callback();}catch(error){errors.push(error);}}
function position(value:Offset):Offset{invariant(value&&Number.isFinite(value.x)&&Number.isFinite(value.y),'invalid-layout-position','Custom layout positions must be finite');return Object.freeze({x:value.x,y:value.y});}
export interface LayoutDelegateOptions {readonly relayout?:Listenable|null;readonly typeToken?:object|symbol}
abstract class SizeLayoutDelegate {
  readonly relayout:Listenable|null;readonly typeToken:object|symbol;
  constructor(options:LayoutDelegateOptions={}){this.relayout=options.relayout??null;this.typeToken=options.typeToken??this.constructor;invariant(!this.relayout||typeof this.relayout.addListener==='function'&&typeof this.relayout.removeListener==='function','invalid-layout-relayout','relayout must implement Listenable');}
  getSize(constraints:BoxConstraints):Size{return constraints.biggest;}
  abstract shouldRelayout(oldDelegate:SizeLayoutDelegate):boolean;
}
export abstract class SingleChildLayoutDelegate extends SizeLayoutDelegate {
  getConstraintsForChild(constraints:BoxConstraints):BoxConstraints{return constraints;}
  getPositionForChild(_size:Size,_childSize:Size):Offset{return {x:0,y:0};}
  abstract override shouldRelayout(oldDelegate:SingleChildLayoutDelegate):boolean;
}
interface LayoutScope {readonly phase:'size'|'layout';readonly children?:KeyMap<RenderBox<RenderObject>>;readonly pending?:Set<RenderBox<RenderObject>>}
const scopes=new WeakMap<MultiChildLayoutDelegate,LayoutScope[]>();
function withScope<T>(delegate:MultiChildLayoutDelegate,scope:LayoutScope,callback:()=>T):T{const stack=scopes.get(delegate)??[];scopes.set(delegate,stack);stack.push(scope);try{return callback();}finally{stack.pop();if(!stack.length)scopes.delete(delegate);}}
export abstract class MultiChildLayoutDelegate extends SizeLayoutDelegate {
  private scope():LayoutScope{const scope=scopes.get(this)?.at(-1);invariant(scope?.phase==='layout','inactive-custom-layout','Child helpers are available only during this delegate performLayout, never getSize');return scope;}
  hasChild(id:LayoutIdentifier):boolean{return this.scope().children!.has(layoutIdKey(id));}
  layoutChild(id:LayoutIdentifier,constraints:BoxConstraints):Size{const scope=this.scope(),child=scope.children!.get(layoutIdKey(id));invariant(child,'missing-layout-child','Custom layout requested a non-existent child');invariant(constraints instanceof BoxConstraints,'invalid-custom-constraints','layoutChild requires BoxConstraints');constraints.debugAssertIsValid({isAppliedConstraint:true});invariant(scope.pending!.delete(child),'duplicate-child-layout','Each custom layout child must be laid out exactly once');child.layout(constraints,{parentUsesSize:true});return child.size;}
  positionChild(id:LayoutIdentifier,offset:Offset):void{const child=this.scope().children!.get(layoutIdKey(id));invariant(child,'missing-layout-child','Custom layout positioned a non-existent child');child.layoutOffset=position(offset);}
  abstract performLayout(size:Size):void;
  abstract override shouldRelayout(oldDelegate:MultiChildLayoutDelegate):boolean;
  toString():string{return this.constructor.name;}
}
export class MultiChildLayoutParentData extends ContainerBoxParentData<RenderBox<RenderObject>> {id:LayoutIdentifier|undefined;override toString():string{return `${super.toString()}; id=${String(this.id)}`;}}
function delegateSize(delegate:SizeLayoutDelegate,constraints:BoxConstraints):Size{
  const compute=()=>{const size=delegate.getSize(constraints);invariant(size&&typeof size.width==='number'&&!Number.isNaN(size.width)&&typeof size.height==='number'&&!Number.isNaN(size.height),'invalid-custom-size','Custom layout size must contain numeric dimensions without NaN');return constraints.constrain(size);};
  return delegate instanceof MultiChildLayoutDelegate?withScope(delegate,{phase:'size'},compute):compute();
}
interface Subscription {readonly source:Listenable;readonly callback:()=>void;active:boolean;pending:boolean;notified:boolean}
abstract class RenderDelegateBox<D extends SizeLayoutDelegate> extends RenderBox {
  private current:D;private subscription:Subscription|undefined;private changingDelegate=false;
  constructor(delegate:D,private readonly family:abstract new (...args:never[])=>D){super();invariant(delegate instanceof family,'invalid-layout-delegate','Wrong custom layout delegate family');this.current=delegate;}
  get delegate():D{return this.current;}
  set delegate(value:D){this.assertCanMutateLayoutProperty();invariant(!this.changingDelegate&&value instanceof this.family,'invalid-layout-delegate','Wrong or reentrant delegate update');if(value===this.current)return;this.changingDelegate=true;const errors:unknown[]=[];
    try{const old=this.current,relayout=value.typeToken!==old.typeToken||value.shouldRelayout(old),next=this.attached?this.subscribe(value.relayout):undefined,previous=this.subscription;this.current=value;this.subscription=next;if(next){next.pending=false;next.active=true;}this.retire(previous,errors);if(relayout||next?.notified)attempt(errors,()=>this.markNeedsLayout());}finally{this.changingDelegate=false;}failures(errors,'Custom layout delegate replacement failed');}
  private subscribe(source:Listenable|null):Subscription|undefined{if(!source)return;const entry:Subscription={source,callback:()=>{if(entry.active&&this.attached&&!this.debugDisposed)this.markNeedsLayout();else if(entry.pending)entry.notified=true;},active:false,pending:true,notified:false};try{source.addListener(entry.callback);return entry;}catch(error){entry.pending=false;const errors=[error];attempt(errors,()=>source.removeListener(entry.callback));failures(errors,'Custom layout listener registration failed');return;}}
  private retire(entry:Subscription|undefined,errors:unknown[]):void{if(!entry)return;entry.active=false;entry.pending=false;attempt(errors,()=>entry.source.removeListener(entry.callback));}
  override attach(owner:PipelineOwner):void{invariant(!this.changingDelegate,'reentrant-layout-delegate','Delegate binding is active');const attached=this.attached;super.attach(owner);if(attached)return;this.changingDelegate=true;
    try{const entry=this.subscribe(this.current.relayout);this.subscription=entry;if(entry){entry.pending=false;entry.active=true;if(entry.notified)this.markNeedsLayout();}}
    catch(error){const errors=[error];this.retire(this.subscription,errors);this.subscription=undefined;if(!this.parent)attempt(errors,()=>super.detach());failures(errors,'Custom layout attach failed');}finally{this.changingDelegate=false;}}
  override detach():void{invariant(!this.changingDelegate,'reentrant-layout-delegate','Delegate binding is active');this.changingDelegate=true;const errors:unknown[]=[];try{attempt(errors,()=>super.detach());if(!this.attached){const previous=this.subscription;this.subscription=undefined;this.retire(previous,errors);}}finally{this.changingDelegate=false;}failures(errors,'Custom layout detach failed');}
  override dispose():void{const errors:unknown[]=[];attempt(errors,()=>super.dispose());if(this.debugDisposed){const previous=this.subscription;this.subscription=undefined;this.retire(previous,errors);}failures(errors,'Custom layout teardown failed');}
  protected override computeDryLayout(constraints:BoxConstraints):Size{return delegateSize(this.current,constraints);}
  private intrinsicDimension(dimension:'width'|'height',input:number):number{const size=delegateSize(this.current,dimension==='width'?BoxConstraints.tightForFinite(Infinity,input):BoxConstraints.tightForFinite(input,Infinity)),value=size[dimension];return Number.isFinite(value)?value:0;}
  protected override computeMinIntrinsicWidth(height:number):number{return this.intrinsicDimension('width',height);}
  protected override computeMaxIntrinsicWidth(height:number):number{return this.intrinsicDimension('width',height);}
  protected override computeMinIntrinsicHeight(width:number):number{return this.intrinsicDimension('height',width);}
  protected override computeMaxIntrinsicHeight(width:number):number{return this.intrinsicDimension('height',width);}
}
export class RenderCustomSingleChildLayoutBox extends RenderDelegateBox<SingleChildLayoutDelegate> {
  constructor(delegate:SingleChildLayoutDelegate,child?:RenderBox<RenderObject>){super(delegate,SingleChildLayoutDelegate);if(child)this.insert(child);}
  protected override get childCountLimit():number{return 1;}
  get child():RenderBox<RenderObject>|undefined{return this.children[0];}set child(value:RenderBox<RenderObject>|undefined){this.setChildren(value?[value]:[]);}
  private childConstraints(constraints:BoxConstraints):BoxConstraints{const child=this.delegate.getConstraintsForChild(constraints);invariant(child instanceof BoxConstraints,'invalid-custom-constraints','Single child delegate must return BoxConstraints');child.debugAssertIsValid({isAppliedConstraint:true});return child;}
  protected override performLayout(constraints:BoxConstraints):Size{const size=this.getDryLayout(constraints);this.size=size;const child=this.child;if(child){const inner=this.childConstraints(constraints);child.layout(inner,{parentUsesSize:!inner.isTight});child.layoutOffset=position(this.delegate.getPositionForChild(size,inner.isTight?inner.smallest:child.size));}return size;}
  protected override computeDryBaseline(constraints:BoxConstraints,baseline:TextBaseline):number|null{const child=this.child;if(!child)return null;const inner=this.childConstraints(constraints),value=child.getDryBaseline(inner,baseline);return value===null?null:value+position(this.delegate.getPositionForChild(this.getDryLayout(constraints),inner.isTight?inner.smallest:child.getDryLayout(inner))).y;}
  protected override computeDistanceToActualBaseline(baseline:TextBaseline):number|null{const child=this.child,value=child?.getDistanceToActualBaseline(baseline)??null;return child&&value!==null?value+child.layoutOffset.y:null;}
}
export class RenderCustomMultiChildLayoutBox extends RenderDelegateBox<MultiChildLayoutDelegate> {
  constructor(delegate:MultiChildLayoutDelegate,children:readonly RenderBox<RenderObject>[]=[]){super(delegate,MultiChildLayoutDelegate);this.setChildren(children);}
  override setupParentData(child:RenderObject):void{invariant(child instanceof RenderBox,'invalid-custom-child','Custom multi layout requires boxes');if(!(child.parentData instanceof MultiChildLayoutParentData))child.parentData=new MultiChildLayoutParentData();}
  protected override performLayout(constraints:BoxConstraints):Size{const size=this.getDryLayout(constraints);this.size=size;const children=new KeyMap<RenderBox<RenderObject>>(),pending=new Set<RenderBox<RenderObject>>();for(const child of this.children){const data=child.parentData;invariant(data instanceof MultiChildLayoutParentData&&data.id!==undefined,'missing-layout-id','Every custom multi layout child requires LayoutId');const key=layoutIdKey(data.id);invariant(!children.has(key),'duplicate-layout-id','Custom multi child IDs must be unique');children.set(key,child);pending.add(child);}withScope(this.delegate,{phase:'layout',children,pending},()=>{this.delegate.performLayout(size);invariant(pending.size===0,'unlaid-custom-children','Each custom layout child must be laid out exactly once');});return size;}
}
