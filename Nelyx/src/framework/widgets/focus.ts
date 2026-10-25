// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter widgets/focus_manager.dart at the recorded pin.
import {ChangeNotifier,Listenable} from '../../foundation/notifier.ts';
import {HashedObserverList} from '../../foundation/observer-list.ts';
import {FoundationPlatform} from '../../foundation/platform.ts';
import {invariant,exceptionStack} from '../../foundation/errors.ts';
import type {BuildContext} from './framework.ts';
import {Element} from './framework.ts';
import {RenderBox} from '../rendering/object.ts';
import {Rect} from '../../ui/rect.ts';
import {Offset} from '../../ui/offset.ts';
import type {Size} from '../../ui/size.ts';
import type {KeyEvent as TransportKeyEvent,PointerEvent,InputFocusRequest} from '../../ui/input.ts';
import {KeyEvent,HardwareKeyboard} from '../../services/hardware-keyboard.ts';
import {KeyMessage} from '../../services/key-message.ts';
import type {RawKeyEvent} from '../../services/raw-key-event.ts';
import {RawKeyEventDataAndroid} from '../../services/raw-keyboard-android.ts';
import type {Disposable} from '../../foundation/disposable.ts';
import type {PointerRouter} from '../gestures/pointer-router.ts';
import type {SemanticsBinding} from '../semantics/binding.ts';
import {SemanticsAction} from '../../ui/semantics-action.ts';
import {PointerEvent as FrameworkPointerEvent} from '../gestures/events.ts';
import {PointerDeviceKind} from '../../ui/pointer.ts';
import {findFocusAncestor} from './focus-tree-context.ts';
import {focusTraversalPolicyFor,TraversalEdgeBehavior} from './focus-traversal-policy.ts';
import type {TraversalDirection,TraversalRequestFocusOptions} from './focus-traversal-policy.ts';
import {traversalGroupNode} from './focus-traversal-context.ts';
export type KeyEventResult='handled'|'ignored'|'skipRemainingHandlers';
export type OnKeyEventCallback=(event:KeyEvent)=>KeyEventResult;
export type FocusOnKeyCallback=(node:FocusNode,event:RawKeyEvent)=>KeyEventResult;
/** Explicit View ports replace process-global binding lookup. The embedding
 * preserves its native/legacy fallback when adapting the tri-state result. */
export interface FocusGlobalHandlers {
  readonly pointerRouter:PointerRouter;readonly semantics:SemanticsBinding;
  registerKeyMessageHandler(handler:(message:KeyMessage)=>KeyEventResult):Disposable;
}
/** Source precedence; callers eagerly collect callback results before combining. */
export function combineKeyEventResults(results:Iterable<KeyEventResult>):KeyEventResult{
  let skip=false;
  for(const result of results){if(!(['handled','ignored','skipRemainingHandlers'].includes(result)))invariant(false,'invalid-key-result','Unknown focus key result');if(result==='handled')return result;if(result==='skipRemainingHandlers')skip=true;}
  return skip?'skipRemainingHandlers':'ignored';
}
export type UnfocusDisposition='scope'|'previouslyFocusedChild';
export const FocusHighlightMode=Object.freeze({touch:'touch',traditional:'traditional'} as const);
export type FocusHighlightMode=typeof FocusHighlightMode[keyof typeof FocusHighlightMode];
export const FocusHighlightStrategy=Object.freeze({automatic:'automatic',alwaysTouch:'alwaysTouch',alwaysTraditional:'alwaysTraditional'} as const);
export type FocusHighlightStrategy=typeof FocusHighlightStrategy[keyof typeof FocusHighlightStrategy];
export type FocusHighlightModeListener=(mode:FocusHighlightMode)=>void;
export interface FocusManagerOptions {readonly defaultHighlightMode?:()=>FocusHighlightMode;readonly mouseIsConnected?:()=>boolean}
export interface FocusNodeOptions {readonly debugLabel?:string|null;readonly canRequestFocus?:boolean;readonly skipTraversal?:boolean;readonly descendantsAreFocusable?:boolean;readonly descendantsAreTraversable?:boolean;readonly onKeyEvent?:((node:FocusNode,event:KeyEvent)=>KeyEventResult)|null;readonly onKey?:FocusOnKeyCallback|null}
export interface FocusAttachmentOptions {readonly onKeyEvent?:((node:FocusNode,event:KeyEvent)=>KeyEventResult)|null;readonly onKey?:FocusOnKeyCallback|null;readonly focus?:(request?:InputFocusRequest)=>void;readonly blur?:()=>void;readonly reveal?:(options?:TraversalRequestFocusOptions)=>void}
export interface FocusScopeNodeOptions extends FocusNodeOptions {readonly traversalEdgeBehavior?:TraversalEdgeBehavior;readonly directionalTraversalEdgeBehavior?:TraversalEdgeBehavior}
interface NodeData {parent:FocusNode|null;children:Set<FocusNode>;manager:FocusManager|undefined;context:BuildContext|null;attachment:FocusAttachment|undefined;legacy:object|undefined;legacyManager:FocusManager|undefined;commands:FocusAttachmentOptions;can:boolean;skip:boolean;focusable:boolean;traversable:boolean;keyboardToken:boolean;deferred:boolean;dead:boolean;history:FocusNode[]}
interface ManagerData {generation:number;request:InputFocusRequest|undefined;primary:FocusNode|undefined;marked:FocusNode|undefined;invoke:boolean;dirty:Set<FocusNode>;autofocus:{scope:FocusScopeNode;node:FocusNode}[];scheduled:boolean;applying:boolean;dead:boolean;last:FocusNode|undefined}
const nodes=new WeakMap<FocusNode,NodeData>(),managers=new WeakMap<FocusManager,ManagerData>();
interface HighlightData {mode:FocusHighlightMode|undefined;last:FocusHighlightMode|undefined;strategy:FocusHighlightStrategy;readonly defaults:()=>FocusHighlightMode;readonly listeners:Map<FocusHighlightModeListener,number>;keyDepth:number}
const highlights=new WeakMap<FocusManager,HighlightData>();
function highlightData(manager:FocusManager):HighlightData{managerState(manager);return highlights.get(manager)!;}
function updateHighlight(manager:FocusManager):void{
  const data=highlightData(manager),next=data.strategy==='alwaysTouch'?'touch':data.strategy==='alwaysTraditional'?'traditional':data.last;if(next===undefined)return;
  const previous=data.mode??(data.listeners.size?data.defaults():next);data.mode=next;if(previous===next)return;const errors:unknown[]=[];
  for(const listener of [...data.listeners.keys()])if(data.listeners.has(listener))try{listener(next);}catch(error){try{Listenable.onError(error,exceptionStack(error)??undefined,'listener');}catch(failure){errors.push(failure);}}
  if(errors.length)throw new AggregateError(errors,'Focus highlight listeners failed');
}
function keyHighlight(manager:FocusManager,event:TransportKeyEvent):void{if(event.platform==='android'&&event.android&&(event.android.deviceId===-1||((event.android.flags??0)&2)!==0))return;const data=highlightData(manager);if(data.last!=='traditional'){data.last='traditional';updateHighlight(manager);}}
function state(node:FocusNode):NodeData{const data=nodes.get(node);if(!(data))invariant(false,'invalid-focus-node','Unknown FocusNode');return data;}
function live(node:FocusNode):NodeData{const data=state(node);if(!(!data.dead))invariant(false,'disposed-focus-node','FocusNode is disposed');return data;}
function managerState(manager:FocusManager):ManagerData{const data=managers.get(manager);if(!(data&&!data.dead))invariant(false,'disposed-focus-manager','FocusManager is disposed');return data;}
function traversalPolicy(node:FocusNode):ReturnType<typeof focusTraversalPolicyFor>{const context=node.context;if(!(context&&(!(context instanceof Element)||context.active)&&traversalGroupNode(node)))invariant(false,'missing-focus-traversal-group','Focus traversal requires a live Focus widget and FocusTraversalGroup');return focusTraversalPolicyFor(node);}
function inSubtree(node:FocusNode,root:FocusNode):boolean{return node===root||node.ancestors.includes(root);}
function schedule(manager:FocusManager):void{const data=managerState(manager);if(data.scheduled)return;data.scheduled=true;void Promise.resolve().then(()=>{if(data.dead||!data.scheduled)return;try{manager.applyFocusChangesIfNeeded();}catch(error){Listenable.onError(error,exceptionStack(error)??undefined,'listener');}});}
function dirty(node:FocusNode):void{const data=state(node),manager=data.manager;if(!manager||managers.get(manager)?.dead)return;const m=managerState(manager);for(const value of [node,...node.descendants])m.dirty.add(value);schedule(manager);}
function remember(node:FocusNode):void{let child=node;for(let scope=node.enclosingScope;scope;scope=scope.enclosingScope){const history=state(scope).history;const i=history.indexOf(child);if(i>=0)history.splice(i,1);history.push(child);child=scope;}}
function request(manager:FocusManager,node:FocusNode,invoke=true,immediate=false):void{const m=managerState(manager);if(!(state(node).manager===manager))invariant(false,'foreign-focus-node','FocusNode belongs to another View');if(!node.canRequestFocus){if(!invoke)state(node).commands.blur?.();return;}m.generation++;if(m.primary===node&&(!m.marked||m.marked===node))return;remember(node);m.marked=node;m.invoke=invoke;m.request=manager.currentFocusRequest;if(!(node instanceof FocusScopeNode))state(node).keyboardToken=true;schedule(manager);if(immediate&&!m.applying)manager.applyFocusChangesIfNeeded();}
function forget(node:FocusNode):void{const scope=node.enclosingScope;if(scope){const removed=new Set([node,...node.descendants.filter(n=>n.enclosingScope===scope)]);state(scope).history=state(scope).history.filter(n=>!removed.has(n));}}
function setManager(node:FocusNode,manager:FocusManager|undefined):void{state(node).manager=manager;for(const child of node.children)setManager(child,manager);}
// A moved subtree may inherit different eligibility. Ancestor focus flags
// change only when that subtree contains the current primary focus.
function reparent(node:FocusNode,parent:FocusNode):void{const d=live(node),p=live(parent);if(!(node!==parent&&!parent.ancestors.includes(node)))invariant(false,'focus-cycle','Focus tree cannot contain a cycle');if(!(!d.manager||node!==d.manager.rootScope))invariant(false,'focus-root-reparent','Cannot reparent the root scope');if(!(!d.manager||!p.manager||d.manager===p.manager))invariant(false,'foreign-focus-node','Focus trees cannot cross Views');if(p.manager)for(const value of [node,...node.descendants]){const member=live(value);if(!(!member.legacyManager||member.legacyManager===p.manager))invariant(false,'foreign-focus-node','Legacy focus host belongs to another View');if(member.attachment&&member.context instanceof Element){if(!(member.context.owner.focus===p.manager))invariant(false,'foreign-focus-context','Focus context belongs to another View');}}if(d.parent===parent)return;const oldAncestors=node.ancestors,scopeChanges=[node,...node.descendants].map(value=>({node:value,scope:value.enclosingScope,policy:focusTraversalPolicyFor(value)})),primary=d.manager?.primaryFocus;if(d.manager&&!p.manager)detach(node);else if(node.enclosingScope!==parent.nearestScope)forget(node);if(d.parent)state(d.parent).children.delete(node);p.children.add(node);d.parent=parent;setManager(node,p.manager);for(const change of scopeChanges)if(change.scope!==change.node.enclosingScope){change.policy.changedScope({node:change.node,oldScope:change.scope});const policy=focusTraversalPolicyFor(change.node);if(policy!==change.policy)policy.changedScope({node:change.node,oldScope:change.scope});}if(p.manager){if(primary&&state(primary).manager===p.manager&&inSubtree(primary,node))remember(primary);const m=managerState(p.manager);for(const value of [node,...node.descendants])m.dirty.add(value);if(primary&&inSubtree(primary,node))for(const value of [...oldAncestors,...node.ancestors])m.dirty.add(value);schedule(p.manager);if(primary&&!primary.canRequestFocus)primary.unfocus({disposition:'previouslyFocusedChild'});}if(d.deferred){d.deferred=false;node.requestFocus();}}
function detach(node:FocusNode):void{const d=state(node),manager=d.manager,errors:unknown[]=[];focusTraversalPolicyFor(node).changedScope({node,oldScope:node.enclosingScope});if(manager){const m=managerState(manager);forget(node);if(m.primary&&inSubtree(m.primary,node)||m.marked&&inSubtree(m.marked,node)){node.unfocus({disposition:'previouslyFocusedChild'});const previous=m.primary;if(previous&&inSubtree(previous,node)){for(const parent of previous.ancestors)m.dirty.add(parent);m.primary=undefined;try{state(previous).commands.blur?.();}catch(error){errors.push(error);}}}for(const value of [node,...node.descendants])m.dirty.delete(value);if(m.last&&inSubtree(m.last,node))m.last=undefined;}if(d.parent)state(d.parent).children.delete(node);d.parent=null;setManager(node,undefined);if(errors.length)throw new AggregateError(errors,'Focus detach command failed');}
let createFocusAttachment:(node:FocusNode)=>FocusAttachment;
export class FocusAttachment {
  private constructor(private readonly node:FocusNode){}
  private static readonly factoryInitialized=void (createFocusAttachment=node=>new FocusAttachment(node));
  get isAttached():boolean{return state(this.node).attachment===this;}
  detach():void{if(!this.isAttached)return;const d=state(this.node);try{detach(this.node);}finally{d.attachment=undefined;d.commands={};}}
  reparent({parent=null}:{readonly parent?:FocusNode|null}={}):void{if(!this.isAttached)return;const d=state(this.node),context=d.context;if(!(context instanceof Element))invariant(false,'invalid-focus-context','Focus attachment requires an Element');const resolved=parent??(context.active?findFocusAncestor(context):null)??context.owner.focus.rootScope;reparent(this.node,resolved);}
}
export class FocusNode extends ChangeNotifier {
  debugLabel:string|null;onKeyEvent:((node:FocusNode,event:KeyEvent)=>KeyEventResult)|null;onKey:FocusOnKeyCallback|null;
  constructor({debugLabel=null,canRequestFocus=true,skipTraversal=false,descendantsAreFocusable=true,descendantsAreTraversable=true,onKeyEvent=null,onKey=null}:FocusNodeOptions={}){super();if(!([canRequestFocus,skipTraversal,descendantsAreFocusable,descendantsAreTraversable].every(v=>typeof v==='boolean')))invariant(false,'invalid-focus-flags','Focus flags must be boolean');this.debugLabel=debugLabel;this.onKeyEvent=onKeyEvent;this.onKey=onKey;nodes.set(this,{parent:null,children:new Set(),manager:undefined,context:null,attachment:undefined,legacy:undefined,legacyManager:undefined,commands:{},can:canRequestFocus,skip:skipTraversal,focusable:descendantsAreFocusable,traversable:descendantsAreTraversable,keyboardToken:false,deferred:false,dead:false,history:[]});}
  get parent():FocusNode|null{return state(this).parent;}get children():readonly FocusNode[]{return Object.freeze([...state(this).children]);}
  get ancestors():readonly FocusNode[]{const out:FocusNode[]=[];for(let n=this.parent;n;n=n.parent)out.push(n);return out;}
  get descendants():readonly FocusNode[]{const out:FocusNode[]=[];for(const child of this.children){out.push(...child.descendants,child);}return out;}
  get traversalChildren():readonly FocusNode[]{return this.descendantsAreFocusable?this.children.filter(n=>!n.skipTraversal&&n.canRequestFocus):[];}
  get traversalDescendants():readonly FocusNode[]{return this.descendantsAreFocusable?this.descendants.filter(n=>!n.skipTraversal&&n.canRequestFocus):[];}
  get canRequestFocus():boolean{return state(this).can&&this.ancestors.every(n=>n.descendantsAreFocusable);}
  set canRequestFocus(value:boolean){const d=live(this);if(!(typeof value==='boolean'))invariant(false,'invalid-focus-flags','canRequestFocus must be boolean');if(d.can===value)return;d.can=value;if(this.hasFocus&&!value)this.unfocus({disposition:'previouslyFocusedChild'});dirty(this);}
  get skipTraversal():boolean{return state(this).skip||this.ancestors.some(n=>!n.descendantsAreTraversable);}
  set skipTraversal(value:boolean){const d=live(this);if(!(typeof value==='boolean'))invariant(false,'invalid-focus-flags','skipTraversal must be boolean');if(d.skip===value)return;d.skip=value;dirty(this);}
  get descendantsAreFocusable():boolean{return state(this).focusable;}
  set descendantsAreFocusable(value:boolean){const d=live(this);if(!(typeof value==='boolean'))invariant(false,'invalid-focus-flags','descendantsAreFocusable must be boolean');if(d.focusable===value)return;d.focusable=value;if(!value&&this.hasFocus)this.unfocus({disposition:'previouslyFocusedChild'});dirty(this);}
  get descendantsAreTraversable():boolean{return state(this).traversable;}
  set descendantsAreTraversable(value:boolean){const d=live(this);if(!(typeof value==='boolean'))invariant(false,'invalid-focus-flags','descendantsAreTraversable must be boolean');if(d.traversable===value)return;d.traversable=value;dirty(this);}
  get hasPrimaryFocus():boolean{return state(this).manager?.primaryFocus===this;}
  get hasFocus():boolean{const primary=state(this).manager?.primaryFocus;return !!primary&&inSubtree(primary,this);}
  get enclosingScope():FocusScopeNode|null{return this.ancestors.find((n):n is FocusScopeNode=>n instanceof FocusScopeNode)??null;}
  get nearestScope():FocusScopeNode|null{return this.enclosingScope;}
  get context():BuildContext|null{return state(this).context;}
  get attached():boolean{return !!state(this).attachment||!!state(this).legacy;}
  attach(context:BuildContext,options?:FocusAttachmentOptions):FocusAttachment;
  attach(scope:FocusManager,command:()=>void,reveal?:()=>void):()=>void;
  attach(contextOrManager:BuildContext|FocusManager,optionsOrCommand:FocusAttachmentOptions|(()=>void)={},reveal?:()=>void):FocusAttachment|(()=>void){const d=live(this);if(contextOrManager instanceof FocusManager){if(!(!this.attached))invariant(false,'focus-attached','FocusNode already has a host');if(!(typeof optionsOrCommand==='function'))invariant(false,'invalid-focus-command','Legacy focus attachment needs a command');const token={};d.legacy=token;d.legacyManager=contextOrManager;d.commands={focus:optionsOrCommand,...(reveal?{reveal}:{})};try{contextOrManager.add(this);}catch(error){d.legacy=undefined;d.legacyManager=undefined;d.commands={};throw error;}return ()=>{if(d.legacy!==token)return;try{contextOrManager.remove(this);}finally{d.legacy=undefined;d.legacyManager=undefined;d.commands={};}};}
    const context=contextOrManager;if(!(context instanceof Element&&context.active&&!d.legacy))invariant(false,'invalid-focus-context','FocusNode needs a live Element without another legacy host');if(!(!d.attachment||d.context===context||!(d.context instanceof Element)||!d.context.active))invariant(false,'focus-attached','FocusNode already has an active host');if(!(!d.manager||d.manager===context.owner.focus))invariant(false,'foreign-focus-context','Focus context belongs to another View');d.context=context;d.commands=optionsOrCommand as FocusAttachmentOptions;if(d.commands.onKeyEvent!==undefined)this.onKeyEvent=d.commands.onKeyEvent;if(d.commands.onKey!==undefined)this.onKey=d.commands.onKey;return d.attachment=createFocusAttachment(this);}
  requestFocus(node?:FocusNode):void{const d=live(this);if(node){if(!node.parent)reparent(node,this);if(!(node.ancestors.includes(this)))invariant(false,'foreign-focus-request','Requested focus must be a descendant');node.requestFocus();return;}if(!this.canRequestFocus)return;if(!d.manager||!d.parent&&!(this instanceof FocusScopeNode&&d.manager.rootScope===this)){d.deferred=true;return;}if(this instanceof FocusScopeNode){const history=d.history;while(history.length&&(!history.at(-1)!.canRequestFocus||history.at(-1)!.enclosingScope!==this))history.pop();if(history.length){history.at(-1)!.requestFocus();return;}}request(d.manager,this,true,!!d.legacy);}
  unfocus({disposition='scope'}:{readonly disposition?:UnfocusDisposition}={}):void{const d=live(this);if(!(disposition==='scope'||disposition==='previouslyFocusedChild'))invariant(false,'invalid-unfocus','Unknown unfocus disposition');const manager=d.manager;if(!manager)return;const m=managerState(manager);if(!this.hasFocus&&!(m.marked&&inSubtree(m.marked,this)))return;let scope=this.enclosingScope;if(!scope)return;if(scope.canRequestFocus){if(disposition==='scope')state(scope).history=[];else state(scope).history=state(scope).history.filter(n=>n!==this);}while(!scope.canRequestFocus&&scope.enclosingScope){if(disposition==='previouslyFocusedChild')state(scope.enclosingScope).history=state(scope.enclosingScope).history.filter(n=>n!==scope);scope=scope.enclosingScope;}if(disposition==='scope')request(manager,scope);else scope.requestFocus();}
  consumeKeyboardToken():boolean{const d=live(this),value=d.keyboardToken;d.keyboardToken=false;return value;}
  showOnScreen(options?:TraversalRequestFocusOptions):void{const d=state(this);if(d.commands.reveal)d.commands.reveal(options);else if(d.context instanceof Element&&d.context.active)d.context.findRenderObject()?.showOnScreen();}
  nextFocus():boolean{return traversalPolicy(this).next(this);}
  previousFocus():boolean{return traversalPolicy(this).previous(this);}
  focusInDirection(direction:TraversalDirection):boolean{return traversalPolicy(this).inDirection(this,direction);}
  setFocused(value:boolean):void{const d=live(this);if(!(d.manager))invariant(false,'focus-detached','FocusNode has no manager');if(value)d.manager.focus(this);else d.manager.blur(this);}
  get rect():Rect{const render=this.context?.findRenderObject();if(!(render instanceof RenderBox&&render.hasSize))invariant(false,'missing-focus-geometry','Focus geometry requires a laid-out RenderBox');const b=render.paintBounds,a=render.localToGlobal({x:b.x,y:b.y}),z=render.localToGlobal({x:b.x+b.width,y:b.y+b.height});return Rect.fromLTRB(a.x,a.y,z.x,z.y);}
  get offset():Offset{const render=this.context?.findRenderObject();if(!(render instanceof RenderBox&&render.hasSize))invariant(false,'missing-focus-geometry','Focus offset requires a laid-out RenderBox');const b=render.paintBounds,p=render.localToGlobal({x:b.x,y:b.y});return new Offset(p.x,p.y);}
  get size():Size{return this.rect.size;}
  override dispose():void{const d=state(this);if(d.dead)return;const errors:unknown[]=[];try{if(d.attachment)d.attachment.detach();else detach(this);}catch(error){errors.push(error);}d.legacy=undefined;d.legacyManager=undefined;d.commands={};d.context=null;d.dead=true;try{super.dispose();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'FocusNode teardown failed');}
}
export class FocusScopeNode extends FocusNode {
  traversalEdgeBehavior:TraversalEdgeBehavior;
  directionalTraversalEdgeBehavior:TraversalEdgeBehavior;
  constructor({traversalEdgeBehavior='closedLoop',directionalTraversalEdgeBehavior='stop',...options}:FocusScopeNodeOptions={}){super(options);if(!(Object.values(TraversalEdgeBehavior).includes(traversalEdgeBehavior)&&Object.values(TraversalEdgeBehavior).includes(directionalTraversalEdgeBehavior)))invariant(false,'invalid-traversal-edge','Unknown traversal edge behavior');this.traversalEdgeBehavior=traversalEdgeBehavior;this.directionalTraversalEdgeBehavior=directionalTraversalEdgeBehavior;}
  override get nearestScope():FocusScopeNode{return this;}
  override get descendantsAreFocusable():boolean{return state(this).can&&super.descendantsAreFocusable;}
  override set descendantsAreFocusable(value:boolean){super.descendantsAreFocusable=value;}
  override get traversalChildren():readonly FocusNode[]{return this.canRequestFocus?super.traversalChildren:[];}
  override get traversalDescendants():readonly FocusNode[]{return this.canRequestFocus?super.traversalDescendants:[];}
  get focusedChild():FocusNode|null{return state(this).history.at(-1)??null;}
  get isFirstFocus():boolean{return this.enclosingScope?.focusedChild===this;}
  setFirstFocus(scope:FocusScopeNode):void{if(!(scope!==this))invariant(false,'focus-cycle','A scope cannot focus itself as a child');if(!scope.parent)reparent(scope,this);if(!(scope.ancestors.includes(this)))invariant(false,'foreign-focus-scope','Scope must be a descendant');if(this.hasFocus)scope.requestFocus();else remember(scope);}
  autofocus(node:FocusNode):void{const d=live(this);if(!node.parent)reparent(node,this);if(!(node.ancestors.includes(this)&&d.manager))invariant(false,'foreign-autofocus','Autofocus node must belong to this scope');managerState(d.manager).autofocus.push({scope:this,node});schedule(d.manager);}
  requestScopeFocus():void{const d=live(this);if(d.manager&&this.canRequestFocus)request(d.manager,this);}
}
export class FocusManager extends ChangeNotifier {
  private globalHandlers:(()=>void)[]|undefined;
  registerGlobalHandlers(ports:FocusGlobalHandlers):void {
    managerState(this);if(!(!this.globalHandlers))invariant(false,'duplicate-focus-global-handlers','Focus global handlers are already registered');
    const releases:(()=>void)[]=[],pointer=(event:FrameworkPointerEvent)=>this.handlePointerEvent(event),semantics=(event:import('../../ui/semantics-action.ts').SemanticsActionEvent)=>{if(event.type===SemanticsAction.focus)this.handleSemanticsFocus();};
    try{
      const keyboard=ports.registerKeyMessageHandler(message=>this.dispatchKeyMessage(message));releases.push(()=>keyboard.dispose());
      ports.pointerRouter.addGlobalRoute(pointer);releases.push(()=>ports.pointerRouter.removeGlobalRoute(pointer));
      ports.semantics.addSemanticsActionListener(semantics);releases.push(()=>ports.semantics.removeSemanticsActionListener(semantics));
      this.globalHandlers=releases;
    }catch(error){const errors:unknown[]=[error];for(const release of releases.reverse())try{release();}catch(failure){errors.push(failure);}if(errors.length===1)throw error;throw new AggregateError(errors,'Focus global handler registration failed');}
  }
  readonly rootScope:FocusScopeNode;
  private readonly earlyKeyHandlers=new HashedObserverList<OnKeyEventCallback>();
  private readonly lateKeyHandlers=new HashedObserverList<OnKeyEventCallback>();
  private keyMessageTarget:{readonly node:FocusNode;readonly context:BuildContext|null}|undefined;
  /** @internal Core text-input defaults retain the original focus route. */
  isKeyEventTarget(node:FocusNode):boolean{return this.keyMessageTarget?.node===node&&this.keyMessageTarget.context===node.context&&this.primaryFocus===node;}
  private focusRequest:InputFocusRequest|undefined;
  /** View-local callback scope; deferred focus captures this request before it unwinds. */
  /** @internal Retires automatic restoration when a newer focus decision is pending. */
  get focusRequestGeneration():number{return managerState(this).generation;}
  get currentFocusRequest():InputFocusRequest|undefined{return this.focusRequest;}
  runWithFocusRequest<T>(request:InputFocusRequest|undefined,callback:()=>T):T{const previous=this.focusRequest;this.focusRequest=request;try{return callback();}finally{this.focusRequest=previous;}}
  constructor(readonly keyboard=new HardwareKeyboard(),options:FocusManagerOptions={}){super();this.rootScope=new FocusScopeNode({debugLabel:'Root Focus Scope'});managers.set(this,{generation:0,request:undefined,primary:undefined,marked:undefined,invoke:false,dirty:new Set(),autofocus:[],scheduled:false,applying:false,dead:false,last:undefined});state(this.rootScope).manager=this;highlights.set(this,{mode:undefined,last:undefined,strategy:'automatic',listeners:new Map(),keyDepth:0,defaults:options.defaultHighlightMode??(()=>{const platform=FoundationPlatform.defaultTargetPlatform;return ['android','fuchsia','iOS'].includes(platform)&&!options.mouseIsConnected?.()?'touch':'traditional';})});}
  get highlightMode():FocusHighlightMode{const data=highlightData(this);return data.mode??data.defaults();}
  get highlightStrategy():FocusHighlightStrategy{return highlightData(this).strategy;}
  set highlightStrategy(value:FocusHighlightStrategy){if(!(Object.values(FocusHighlightStrategy).includes(value)))invariant(false,'invalid-highlight-strategy','Unknown focus highlight strategy');const data=highlightData(this);if(value!==data.strategy){data.strategy=value;updateHighlight(this);}}
  addHighlightModeListener(listener:FocusHighlightModeListener):void{const data=highlightData(this);data.listeners.set(listener,(data.listeners.get(listener)??0)+1);}
  removeHighlightModeListener(listener:FocusHighlightModeListener):void{const data=highlights.get(this),count=data?.listeners.get(listener);if(count===1)data!.listeners.delete(listener);else if(count)data!.listeners.set(listener,count-1);}
  addEarlyKeyEventHandler(handler:OnKeyEventCallback):void{managerState(this);this.earlyKeyHandlers.add(handler);}
  removeEarlyKeyEventHandler(handler:OnKeyEventCallback):void{managerState(this);this.earlyKeyHandlers.remove(handler);}
  addLateKeyEventHandler(handler:OnKeyEventCallback):void{managerState(this);this.lateKeyHandlers.add(handler);}
  removeLateKeyEventHandler(handler:OnKeyEventCallback):void{managerState(this);this.lateKeyHandlers.remove(handler);}
  /** View ingress supplies the original transport so virtual Android keys stay touch-mode. */
  handleTransportKeyEvent(event:TransportKeyEvent,dispatch:()=>boolean):boolean{keyHighlight(this,event);const data=highlightData(this);data.keyDepth++;try{return dispatch();}finally{data.keyDepth--;}}
  handlePointerEvent(event:PointerEvent|FrameworkPointerEvent):void{const touch=event instanceof FrameworkPointerEvent?[PointerDeviceKind.touch,PointerDeviceKind.stylus,PointerDeviceKind.invertedStylus].includes(event.kind):event.device==='touch'||event.device==='pen';if(touch){const data=highlightData(this);if(data.last!=='touch'){data.last='touch';updateHighlight(this);}}}
  handleSemanticsFocus():void{if(FoundationPlatform.hostEnvironment.kind==='web'){const data=highlightData(this);if(data.last!=='touch'){data.last='touch';updateHighlight(this);}}}
  get primaryFocus():FocusNode|undefined{return managers.get(this)?.primary;}
  get lastFocus():FocusNode|undefined{return managers.get(this)?.last;}
  add(node:FocusNode):void{managerState(this);if(!(!state(node).manager))invariant(false,'duplicate-focus-node','FocusNode already belongs to a focus tree');reparent(node,this.rootScope);}
  remove(node:FocusNode):void{if(state(node).manager===this)detach(node);}
  focus(node:FocusNode):boolean{if(!(state(node).manager===this))invariant(false,'foreign-focus-node','FocusNode belongs to another View');if(!node.canRequestFocus){state(node).commands.blur?.();return false;}request(this,node,false,true);return true;}
  blur(node:FocusNode):void{if(state(node).manager!==this)return;if(this.primaryFocus&&inSubtree(this.primaryFocus,node)){node.unfocus({disposition:'previouslyFocusedChild'});if(!managerState(this).applying)this.applyFocusChangesIfNeeded();}}
  applyFocusChangesIfNeeded():void{const m=managerState(this);if(!(!m.applying))invariant(false,'reentrant-focus-apply','Focus updates cannot be applied reentrantly');for(const node of [m.primary,m.marked,...m.dirty])if(node?.context instanceof Element){if(!(!node.context.owner.building))invariant(false,'focus-during-build','Focus changes must be applied outside build');}m.applying=true;m.scheduled=false;const errors:unknown[]=[];try{for(const {scope,node}of m.autofocus.splice(0))if(state(scope).manager===this&&state(node).manager===this&&!scope.focusedChild&&node.canRequestFocus){remember(node);m.marked=node;m.invoke=true;m.request=undefined;}if(!m.primary&&!m.marked)m.marked=this.rootScope;const previous=m.primary,next=m.marked,invoke=m.invoke,request=m.request;m.marked=undefined;m.invoke=false;m.request=undefined;if(next&&next!==previous){if(state(next).manager===this&&next.canRequestFocus){const oldPath=previous?[previous,...previous.ancestors]:[],newPath=[next,...next.ancestors];m.primary=next;if(next!==this.rootScope)m.last=next;for(const n of [...oldPath,...newPath])m.dirty.add(n);if(previous)try{state(previous).commands.blur?.();}catch(error){errors.push(error);}if(invoke)try{state(next).commands.focus?.(request);}catch(error){errors.push(error);}}}const changed=m.primary!==previous,pending=[...m.dirty];m.dirty.clear();for(const node of pending)if(!state(node).dead&&(node.parent||node===this.rootScope))try{node.notifyListeners();}catch(error){errors.push(error);}if(changed)try{this.notifyListeners();}catch(error){errors.push(error);}}finally{m.applying=false;}if(errors.length)throw new AggregateError(errors,'Focus changes failed');}
  /** Compatibility widget-order traversal for hosts without a policy group. */
  next(reverse=false):boolean{
    const current=this.primaryFocus??this.rootScope;if(traversalGroupNode(current))return reverse?current.previousFocus():current.nextFocus();
    const candidates=this.rootScope.traversalDescendants.filter(node=>!(node.context instanceof Element)||node.context.active);
    // Stateful descendants can attach after a later sibling. Resolve the current
    // Element order on each traversal so mounting and keyed moves cannot change it.
    const ordered=candidates.map((node,index)=>{const path:number[]=[];const attached=node.context;if(!(attached instanceof Element))return {node,index,path:null};let context:Element=attached;while(context.parent){path.unshift(context.parent.children.indexOf(context));context=context.parent;}return {node,index,path};});
    ordered.sort((a,b)=>{if(a.path===null||b.path===null)return a.path===b.path?a.index-b.index:a.path===null?1:-1;for(let i=0;i<Math.min(a.path.length,b.path.length);i++){const difference=a.path[i]!-b.path[i]!;if(difference)return difference;}return a.path.length-b.path.length||a.index-b.index;});
    const values=ordered.map(value=>value.node),index=values.indexOf(this.primaryFocus!);if(!values.length)return false;values[(index<0?(reverse?values.length-1:0):(index+(reverse?-1:1)+values.length)%values.length)]!.requestFocus();return true;
  }
  dispatchKeyEvent(event:KeyEvent|TransportKeyEvent):KeyEventResult{
    if(event instanceof KeyEvent)return this.dispatchKeyEvents([event]);
    let result:KeyEventResult='ignored';
    this.handleTransportKeyEvent(event,()=>this.keyboard.handleTransportMessage(event,events=>{result=this.dispatchKeyEvents(events);return result==='handled';}));
    return result;
  }
  /** Embedding adapter for the normalized events of ONE native message.
   * RawKeyEvent/KeyMessage compatibility is a separate source API. */
  dispatchKeyEvents(events:readonly KeyEvent[]):KeyEventResult{
    return this.dispatchKeyMessage(new KeyMessage(events,null));
  }
  /** Message adapter includes the deprecated raw callback after normalized events at each node. */
  dispatchKeyMessage(message:KeyMessage):KeyEventResult{
    managerState(this);if(!(message instanceof KeyMessage))invariant(false,'invalid-key-message','Focus dispatch requires a KeyMessage');const batch=message.events;
    if(!(batch.every(event=>event instanceof KeyEvent)))invariant(false,'invalid-key-batch','Focus dispatch requires normalized KeyEvents');
    if(highlightData(this).keyDepth===0){const raw=message.rawEvent?.data;if(!(raw instanceof RawKeyEventDataAndroid&&(raw.deviceId===-1||(raw.flags&2)!==0))){const data=highlightData(this);if(data.last!=='traditional'){data.last='traditional';updateHighlight(this);}}}
    if(!this.primaryFocus)return 'ignored';
    const early=this.dispatchKeyHandlers(this.earlyKeyHandlers,batch);
    if(managers.get(this)?.dead)return 'ignored';
    if(early==='handled')return early;
    // At the pinned source revision early skip still walks the focus tree.
    // Node skip stops ancestors, but late handlers can still handle the batch.
    const previousTarget=this.keyMessageTarget,primary=this.primaryFocus;this.keyMessageTarget=primary?{node:primary,context:primary.context}:undefined;
    try{
    let skipped=early==='skipRemainingHandlers';
    if(primary)for(const node of [primary,...primary.ancestors]){
      if(managers.get(this)?.dead)return 'ignored';
      if(state(node).dead)continue;
      const results:KeyEventResult[]=[];
      for(const event of batch){if(managers.get(this)?.dead)return 'ignored';if(state(node).dead)break;const callback=node.onKeyEvent;if(callback)results.push(callback(node,event));}
      if(managers.get(this)?.dead)return 'ignored';if(!state(node).dead&&node.onKey&&message.rawEvent)results.push(node.onKey(node,message.rawEvent));
      const result=combineKeyEventResults(results);
      if(result==='handled')return result;
      if(result==='skipRemainingHandlers'){skipped=true;break;}
    }
    const late=this.dispatchKeyHandlers(this.lateKeyHandlers,batch);
    if(managers.get(this)?.dead)return 'ignored';
    return late==='handled'?late:late==='skipRemainingHandlers'||skipped?'skipRemainingHandlers':'ignored';
    }finally{this.keyMessageTarget=previousTarget;}
  }
  private dispatchKeyHandlers(handlers:HashedObserverList<OnKeyEventCallback>,events:readonly KeyEvent[]):KeyEventResult{
    const results:KeyEventResult[]=[];
    for(const callback of handlers.toList())for(const event of events){if(managers.get(this)?.dead)return 'ignored';results.push(callback(event));}
    return combineKeyEventResults(results);
  }
  /** Compatibility stop flag; dispatchKeyEvent also preserves native-default policy. */
  handleKeyEvent(event:KeyEvent|TransportKeyEvent):boolean{return this.dispatchKeyEvent(event)!=='ignored';}
  override dispose():void{const m=managers.get(this);if(!m||m.dead)return;const errors:unknown[]=[];const releases=this.globalHandlers;this.globalHandlers=undefined;for(const release of releases?.reverse()??[])try{release();}catch(error){errors.push(error);}m.marked=undefined;m.autofocus=[];const previous=m.primary;m.primary=undefined;if(previous)try{state(previous).commands.blur?.();}catch(error){errors.push(error);}for(const child of [...this.rootScope.children])try{detach(child);}catch(error){errors.push(error);}m.dead=true;m.scheduled=false;m.dirty.clear();m.last=undefined;this.earlyKeyHandlers.clear();this.lateKeyHandlers.clear();highlights.get(this)?.listeners.clear();state(this.rootScope).manager=undefined;try{this.rootScope.dispose();}catch(error){errors.push(error);}try{super.dispose();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'FocusManager teardown failed');}
}
/** Legacy manager name retained; the FocusScope widget uses the focus-scope module. */
export class FocusScope extends FocusManager {}
export class Actions {
  constructor(readonly handlers:ReadonlyMap<string,()=>void>){}
  invoke(intent:string):boolean{const action=this.handlers.get(intent);if(!action)return false;action();return true;}
}
export class Shortcuts {
  constructor(readonly bindings:ReadonlyMap<string,string>,readonly actions:Actions){}
  handle(key:string):boolean{const intent=this.bindings.get(key);return intent!==undefined&&this.actions.invoke(intent);}
}
