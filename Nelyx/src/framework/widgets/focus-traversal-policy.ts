// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from widgets/focus_traversal.dart at the recorded Flutter pin.
import {invariant} from '../../foundation/errors.ts';
import {Diagnosticable} from '../../foundation/diagnosticable.ts';
import {DiagnosticsProperty,StringProperty,DiagnosticPropertiesBuilder} from '../../foundation/diagnostics.ts';
import {DoubleProperty} from '../../foundation/diagnostic-properties.ts';
import {Rect} from '../../ui/rect.ts';
import {protect} from '../../ui/value-math.ts';
import type {FocusNode,FocusScopeNode} from './focus.ts';
import {isFocusScopeNode} from './widget-class-identity.ts';
import {traversalGroupNode,traversalGroupData,focusOrderFor,traversalDirections,traversalScrollable} from './focus-traversal-context.ts';

export const TraversalDirection=Object.freeze({up:'up',right:'right',down:'down',left:'left'} as const);
export type TraversalDirection=typeof TraversalDirection[keyof typeof TraversalDirection];
export const TraversalEdgeBehavior=Object.freeze({closedLoop:'closedLoop',leaveFlutterView:'leaveFlutterView',parentScope:'parentScope',stop:'stop'} as const);
export type TraversalEdgeBehavior=typeof TraversalEdgeBehavior[keyof typeof TraversalEdgeBehavior];
export interface TraversalRequestFocusOptions {readonly alignmentPolicy?:'explicit'|'keepVisibleAtStart'|'keepVisibleAtEnd';readonly alignment?:number;readonly duration?:number;readonly curve?:{transform(t:number):number}}
export type TraversalRequestFocusCallback=(node:FocusNode,options?:TraversalRequestFocusOptions)=>void;
export interface FocusTraversalPolicyOptions {readonly requestFocusCallback?:TraversalRequestFocusCallback}
function eligible(node:FocusNode):boolean{return node.canRequestFocus&&!node.skipTraversal&&(!node.context||!('active' in node.context)||node.context.active===true);}
function scopeOf(node:FocusNode):FocusScopeNode{const scope=node.nearestScope;invariant(scope,'detached-focus-traversal','Focus traversal requires an attached scope');return scope;}
function compareNumber(a:number,b:number):number{if(a<b)return -1;if(a>b)return 1;if(a===b)return Object.is(a,-0)?Object.is(b,-0)?0:-1:Object.is(b,-0)?1:0;return Number.isNaN(a)?Number.isNaN(b)?0:1:-1;}
/** Resolve current Element order, including delayed Stateful builds/keyed moves. */
function widgetOrder(values:Iterable<FocusNode>):FocusNode[]{return [...values].map((node,index)=>{const path:number[]=[];let context=node.context as {parent?:unknown;children?:readonly unknown[]}|null;if(!context)return {node,index,path:null};while(context.parent){const parent=context.parent as {parent?:unknown;children?:readonly unknown[]};path.unshift(parent.children?.indexOf(context)??0);context=parent;}return {node,index,path};}).sort((a,b)=>{if(a.path===null||b.path===null)return a.path===b.path?a.index-b.index:a.path===null?1:-1;for(let i=0;i<Math.min(a.path.length,b.path.length);i++){const difference=a.path[i]!-b.path[i]!;if(difference)return difference;}return a.path.length-b.path.length||a.index-b.index;}).map(value=>value.node);}
function descendantsWithoutScopes(node:FocusNode):FocusNode[]{const result:FocusNode[]=[];for(const child of widgetOrder(node.children)){result.push(child);if(!(isFocusScopeNode(child)))result.push(...descendantsWithoutScopes(child));}return result;}
interface GroupInfo {policy:FocusTraversalPolicy;members:FocusNode[]}
function sortAllDescendants(scope:FocusScopeNode,current:FocusNode):FocusNode[]{
  const rootGroup=traversalGroupNode(scope),fallback=rootGroup?traversalGroupData(rootGroup)!.policy:defaultPolicy,groups=new Map<FocusNode|null,GroupInfo>();
  const info=(key:FocusNode|null)=>{let group=groups.get(key);if(!group){group={policy:key?traversalGroupData(key)!.policy:fallback,members:[]};groups.set(key,group);}return group;};
  for(const node of descendantsWithoutScopes(scope)){
    const group=traversalGroupNode(node);
    if(node===group){info(traversalGroupNode(node.parent)).members.push(node);continue;}
    if(node===current||eligible(node))info(group).members.push(node);
  }
  for(const group of groups.values())group.members=[...group.policy.sortDescendants(group.members,current)];
  const result:FocusNode[]=[];const visit=(group:GroupInfo)=>{for(const node of group.members){const nested=groups.get(node);if(nested)visit(nested);else result.push(node);}};
  const root=groups.get(rootGroup);if(root)visit(root);return result.filter(node=>node===current||eligible(node));
}
function requestTab(policy:FocusTraversalPolicy,node:FocusNode,forward:boolean,visited=new Set<FocusNode>()):boolean{
  invariant(!visited.has(node),'focus-traversal-cycle','Scope history cannot form a traversal cycle');visited.add(node);
  if(isFocusScopeNode(node)){const child=node.focusedChild;if(child?.canRequestFocus&&child.enclosingScope===node)return requestTab(policy,child,forward,visited);const children=sortAllDescendants(node,node);if(children.length){requestTab(policy,forward?children[0]!:children.at(-1)!,forward,visited);return true;}}
  const before=node.hasPrimaryFocus;policy.requestFocusCallback(node,{alignmentPolicy:forward?'keepVisibleAtEnd':'keepVisibleAtStart'});return !before;
}
export abstract class FocusTraversalPolicy extends Diagnosticable(class {}) {
  readonly requestFocusCallback:TraversalRequestFocusCallback;
  constructor({requestFocusCallback=FocusTraversalPolicy.defaultTraversalRequestFocusCallback}:FocusTraversalPolicyOptions={}){super();this.requestFocusCallback=requestFocusCallback;protect(this,['requestFocusCallback']);}
  static defaultTraversalRequestFocusCallback(node:FocusNode,options?:TraversalRequestFocusOptions):void{node.requestFocus();node.showOnScreen(options);}
  findFirstFocus(currentNode:FocusNode,{ignoreCurrentFocus=false}:{readonly ignoreCurrentFocus?:boolean}={}):FocusNode|null{return findInitialFocus(currentNode,false,ignoreCurrentFocus);}
  findLastFocus(currentNode:FocusNode,{ignoreCurrentFocus=false}:{readonly ignoreCurrentFocus?:boolean}={}):FocusNode{return findInitialFocus(currentNode,true,ignoreCurrentFocus);}

  invalidateScopeData(_node:FocusScopeNode):void{}
  changedScope(_options:{readonly node?:FocusNode;readonly oldScope?:FocusScopeNode|null}):void{}
  next(currentNode:FocusNode):boolean{return moveFocus(this,currentNode,true);}
  previous(currentNode:FocusNode):boolean{return moveFocus(this,currentNode,false);}

  abstract findFirstFocusInDirection(currentNode:FocusNode,direction:TraversalDirection):FocusNode|null;
  abstract inDirection(currentNode:FocusNode,direction:TraversalDirection):boolean;
  abstract sortDescendants(descendants:Iterable<FocusNode>,currentNode:FocusNode):Iterable<FocusNode>;
}

function findInitialFocus(current:FocusNode,fromEnd:boolean,ignore:boolean):FocusNode{const scope=scopeOf(current);let node=scope.focusedChild;if(ignore||!node&&scope.descendants.length){const sorted=sortAllDescendants(scope,current).filter(eligible);node=(fromEnd?sorted.at(-1):sorted[0])??null;}return node??current;}
function moveFocus(policy:FocusTraversalPolicy,current:FocusNode,forward:boolean):boolean{
    const scope=scopeOf(current);policy.invalidateScopeData(scope);const focused=scope.focusedChild;
    if(!focused){const initial=forward?policy.findFirstFocus(current):policy.findLastFocus(current);return initial?requestTab(policy,initial,forward):false;}
    const sorted=sortAllDescendants(scope,focused);if(!sorted.length)return false;
    const index=sorted.indexOf(focused);if(index<0)return false;
    if(index===(forward?sorted.length-1:0)){
      switch(scope.traversalEdgeBehavior){
        case 'stop':return false;
        case 'leaveFlutterView':focused.unfocus();return false;
        case 'parentScope':{const parent=scope.enclosingScope;if(parent?.enclosingScope){focused.unfocus();forward?parent.nextFocus():parent.previousFocus();return focused.enclosingScope?.focusedChild!==focused;}break;}
        case 'closedLoop':break;
        default:throw new Error('Invalid focus traversal edge behavior');
      }
      return requestTab(policy,forward?sorted[0]!:sorted.at(-1)!,forward);
    }
    return requestTab(policy,sorted[index+(forward?1:-1)]!,forward);
  }

interface ReadingData {node:FocusNode;rect:Rect;direction:'ltr'|'rtl';ancestors:ReturnType<typeof traversalDirections>}
interface ReadingDirectionalGroupData {members:ReadingData[];rect:Rect;direction:'ltr'|'rtl'}
interface OrderedFocusInfo {node:FocusNode;order:FocusOrder}
function readingCompare(a:{rect:Rect},b:{rect:Rect},direction:'ltr'|'rtl'):number{return direction==='ltr'?compareNumber(a.rect.left,b.rect.left):compareNumber(b.rect.right,a.rect.right);}
function pickReading(candidates:ReadingData[]):ReadingData{
  candidates.sort((a,b)=>compareNumber(a.rect.top,b.rect.top));const top=candidates[0]!,band=candidates.filter(value=>value.rect.bottom>top.rect.top&&value.rect.top<top.rect.bottom&&!value.rect.isEmpty);
  if(band.length<=1)return top;
  const common=band[0]!.ancestors.find(ancestor=>band.every(member=>member.ancestors.some(other=>other.widget===ancestor.widget)))?.direction??band[0]!.direction;
  band.sort((a,b)=>readingCompare(a,b,common));const groups:ReadingDirectionalGroupData[]=[];
  for(const member of band){const previous=groups.at(-1);if(previous?.direction===member.direction){previous.members.push(member);previous.rect=previous.rect.expandToInclude(member.rect);}else groups.push({members:[member],rect:member.rect,direction:member.direction});}
  for(const group of groups)group.members.sort((a,b)=>readingCompare(a,b,group.direction));groups.sort((a,b)=>readingCompare(a,b,common));return groups[0]!.members[0]!;
}
// Directional policies are declared below; the default is initialized after them.

export abstract class FocusOrder extends Diagnosticable(class {}) {
  static numeric(order:number):NumericFocusOrder{return new NumericFocusOrder(order);}
  static lexical(order:string):LexicalFocusOrder{return new LexicalFocusOrder(order);}
  compareTo(other:FocusOrder):number{invariant(this.constructor===other.constructor,'incompatible-focus-orders','Focus orders must have the same runtime type; group different order types separately');return this.doCompare(other);}
  abstract doCompare(other:FocusOrder):number;
}
export class NumericFocusOrder extends FocusOrder {
  constructor(readonly order:number){super();invariant(typeof order==='number','invalid-focus-order','Numeric focus order requires a number');protect(this,['order']);}
  doCompare(other:FocusOrder):number{invariant(other instanceof NumericFocusOrder,'incompatible-focus-orders','Expected NumericFocusOrder');return compareNumber(this.order,other.order);}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new DoubleProperty('order',this.order));}
}
export class LexicalFocusOrder extends FocusOrder {
  constructor(readonly order:string){super();invariant(typeof order==='string','invalid-focus-order','Lexical focus order requires a string');protect(this,['order']);}
  doCompare(other:FocusOrder):number{invariant(other instanceof LexicalFocusOrder,'incompatible-focus-orders','Expected LexicalFocusOrder');return this.order<other.order?-1:this.order>other.order?1:0;}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new StringProperty('order',this.order));}
}

interface DirectionEntry {direction:TraversalDirection;node:FocusNode}
const directionalData=new WeakMap<FocusTraversalPolicy,WeakMap<FocusScopeNode,DirectionEntry[]>>();
function historyFor(policy:FocusTraversalPolicy):WeakMap<FocusScopeNode,DirectionEntry[]>{let scopes=directionalData.get(policy);if(!scopes){scopes=new WeakMap();directionalData.set(policy,scopes);}return scopes;}
function vertical(direction:TraversalDirection):boolean{return direction==='up'||direction==='down';}
function alignment(direction:TraversalDirection):'keepVisibleAtStart'|'keepVisibleAtEnd'{return direction==='up'||direction==='left'?'keepVisibleAtStart':'keepVisibleAtEnd';}
function assertDirection(direction:TraversalDirection):void{invariant(Object.values(TraversalDirection).includes(direction),'invalid-traversal-direction','Unknown traversal direction');}
function requestDirection(policy:FocusTraversalPolicy,current:FocusNode,node:FocusNode,direction:TraversalDirection,group:FocusNode|null,visited=new Set<FocusNode>()):boolean{
  invariant(!visited.has(node),'focus-traversal-cycle','Scope history cannot form a traversal cycle');visited.add(node);
  if(isFocusScopeNode(node)){if(node.focusedChild)return requestDirection(policy,current,node.focusedChild,direction,group,visited);const first=policy.findFirstFocusInDirection(node,direction)??current;const record=group?traversalGroupData(group):undefined;if(record)record.lastRequestedFocus=first;policy.requestFocusCallback(first,{alignmentPolicy:alignment(direction)});return true;}
  const before=node.hasPrimaryFocus,record=group?traversalGroupData(group):undefined;if(record)record.lastRequestedFocus=node;policy.requestFocusCallback(node,{alignmentPolicy:alignment(direction)});return !before;
}
function nextInDirection(focused:FocusNode,descendants:Iterable<FocusNode>,direction:TraversalDirection,forward=true):FocusNode|null{
  const target=focused.rect,isVertical=vertical(direction),positive=direction==='down'||direction==='right';
  let candidates=[...descendants].filter(node=>{const rect=node.rect;if(rect.equals(target))return false;const center=isVertical?rect.center.y:rect.center.x,edge=isVertical?(positive?target.bottom:target.top):(positive?target.right:target.left);return positive?(forward?center>=edge:center<=edge):(forward?center<=edge:center>=edge);});
  candidates.sort((a,b)=>compareNumber(isVertical?a.rect.center.y:a.rect.center.x,isVertical?b.rect.center.y:b.rect.center.x));if(!candidates.length)return null;
  const owner=traversalScrollable(focused.context,isVertical?'vertical':'horizontal');if(owner){const same=candidates.filter(node=>traversalScrollable(node.context,isVertical?'vertical':'horizontal')===owner);if(same.length)candidates=same;}
  if(!positive)candidates.reverse();
  const band=candidates.filter(node=>isVertical?node.rect.right>target.left&&node.rect.left<target.right&&!node.rect.isEmpty:node.rect.bottom>target.top&&node.rect.top<target.bottom&&!node.rect.isEmpty);
  const distance=(rect:Rect,axis:'x'|'y',edge=false)=>edge?axis==='x'?Math.min(Math.abs(rect.left-target.center.x),Math.abs(rect.right-target.center.x)):Math.min(Math.abs(rect.top-target.center.y),Math.abs(rect.bottom-target.center.y)):Math.abs(rect.center[axis]-target.center[axis]);
  const primary=isVertical?'y':'x',secondary=isVertical?'x':'y';
  if(band.length){band.sort((a,b)=>compareNumber(distance(a.rect,primary),distance(b.rect,primary))||compareNumber(distance(a.rect,secondary),distance(b.rect,secondary)));return (forward?band[0]:band.at(-1))!;}
  candidates.sort((a,b)=>compareNumber(distance(a.rect,secondary,true),distance(b.rect,secondary,true))||compareNumber(distance(a.rect,primary),distance(b.rect,primary)));return (forward?candidates[0]:candidates.at(-1))!;
}
function directionalEdge(policy:FocusTraversalPolicy,current:FocusNode,focused:FocusNode,group:FocusNode|null,direction:TraversalDirection,scope=scopeOf(current)):boolean{
  let found:FocusNode|null=null;
  switch(scope.directionalTraversalEdgeBehavior){
    case 'stop':return false;
    case 'leaveFlutterView':focused.unfocus();return false;
    case 'parentScope':{const parent=scope.enclosingScope;if(parent?.enclosingScope){policy.invalidateScopeData(scope);policy.invalidateScopeData(parent);found=nextInDirection(focused,parent.traversalDescendants,direction);if(!found)return directionalEdge(policy,current,focused,group,direction,parent);}else found=nextInDirection(focused,scope.traversalDescendants,direction,false);break;}
    case 'closedLoop':found=nextInDirection(focused,scope.traversalDescendants,direction,false);break;
    default:throw new Error('Invalid directional traversal edge behavior');
  }
  return found?requestDirection(policy,current,found,direction,group):false;
}
type PolicyConstructor=abstract new (...args:any[])=>FocusTraversalPolicy;
/** Dart's directional mixin is a TypeScript class factory; policies keep per-scope weak history. */
export function DirectionalFocusTraversalPolicyMixin<TBase extends PolicyConstructor>(Base:TBase){
  abstract class DirectionalPolicy extends Base {
    override invalidateScopeData(node:FocusScopeNode):void{super.invalidateScopeData(node);historyFor(this).delete(node);}
    override changedScope(options:{readonly node?:FocusNode;readonly oldScope?:FocusScopeNode|null}):void{super.changedScope(options);if(options.oldScope){const history=historyFor(this).get(options.oldScope);if(history)historyFor(this).set(options.oldScope,history.filter(entry=>entry.node!==options.node));}}
    findFirstFocusInDirection(current:FocusNode,direction:TraversalDirection):FocusNode|null{assertDirection(direction);const nodes=[...scopeOf(current).traversalDescendants],v=vertical(direction),first=direction==='down'||direction==='right';nodes.sort((a,b)=>v?first?compareNumber(a.rect.top,b.rect.top):compareNumber(b.rect.bottom,a.rect.bottom):first?compareNumber(a.rect.left,b.rect.left):compareNumber(b.rect.right,a.rect.right));return nodes[0]??null;}
    inDirection(current:FocusNode,direction:TraversalDirection):boolean{
      assertDirection(direction);const scope=scopeOf(current),focused=scope.focusedChild,group=traversalGroupNode(current),scopes=historyFor(this);
      if(!focused){const first=this.findFirstFocusInDirection(current,direction)??current;const record=group?traversalGroupData(group):undefined;if(record)record.lastRequestedFocus=first;this.requestFocusCallback(first,{alignmentPolicy:alignment(direction)});return true;}
      const history=scopes.get(scope);
      if(history?.length&&history[0]!.direction!==direction){
        const last=history.at(-1)!;
        if(!last.node.parent){this.invalidateScopeData(scope);}
        else if(vertical(history[0]!.direction)!==vertical(direction)){this.invalidateScopeData(scope);}
        else {const previous=history.pop()!.node;let primary:FocusNode=focused;while(isFocusScopeNode(primary)&&primary.focusedChild)primary=primary.focusedChild;if(traversalScrollable(previous.context)!==traversalScrollable(primary.context)){this.invalidateScopeData(scope);}else {requestDirection(this,current,previous,direction,group);return true;}}
      }
      if(scopes.get(scope)?.length===0)this.invalidateScopeData(scope);
      const found=nextInDirection(focused,scope.traversalDescendants,direction);
      if(found){const entries=scopes.get(scope)??[];entries.push({direction,node:focused});scopes.set(scope,entries);return requestDirection(this,current,found,direction,group);}
      return directionalEdge(this,current,focused,group,direction);
    }
  }
  return DirectionalPolicy;
}
const DirectionalPolicy=DirectionalFocusTraversalPolicyMixin(FocusTraversalPolicy);
export class WidgetOrderTraversalPolicy extends DirectionalPolicy {
  sortDescendants(descendants:Iterable<FocusNode>,_currentNode:FocusNode):Iterable<FocusNode>{return widgetOrder(descendants);}
}
export class ReadingOrderTraversalPolicy extends DirectionalPolicy {
  static sort(nodes:Iterable<FocusNode>):Iterable<FocusNode>{const values=[...nodes];if(values.length<=1)return values;const candidates:ReadingData[]=values.map(node=>{const ancestors=traversalDirections(node.context),direction=ancestors[0]?.direction;invariant(direction,'missing-focus-directionality','Reading order requires a Directionality ancestor');return {node,rect:node.rect,direction,ancestors};}),result:FocusNode[]=[];while(candidates.length){const next=pickReading(candidates);result.push(next.node);candidates.splice(candidates.indexOf(next),1);}return result;}
  sortDescendants(descendants:Iterable<FocusNode>,_currentNode:FocusNode):Iterable<FocusNode>{return ReadingOrderTraversalPolicy.sort(descendants);}
}
export class OrderedTraversalPolicy extends DirectionalPolicy {
  readonly secondary:FocusTraversalPolicy|null;
  constructor({secondary=null,...options}:FocusTraversalPolicyOptions&{readonly secondary?:FocusTraversalPolicy|null}={}){super(options);this.secondary=secondary;protect(this,['secondary']);}
  sortDescendants(descendants:Iterable<FocusNode>,currentNode:FocusNode):Iterable<FocusNode>{const values=(this.secondary??defaultPolicy).sortDescendants(descendants,currentNode),ordered:OrderedFocusInfo[]=[],unordered:FocusNode[]=[];for(const node of values){const order=focusOrderFor(node.context);if(order)ordered.push({node,order});else unordered.push(node);}ordered.sort((a,b)=>a.order.compareTo(b.order));return [...ordered.map(value=>value.node),...unordered];}
}
const defaultPolicy=new ReadingOrderTraversalPolicy();
/** Internal routing used by FocusNode and FocusManager without importing widget classes. */
export function focusTraversalPolicyFor(node:FocusNode):FocusTraversalPolicy{const group=traversalGroupNode(node);return group?traversalGroupData(group)!.policy:defaultPolicy;}
