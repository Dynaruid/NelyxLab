// SPDX-License-Identifier: BSD-3-Clause
// Immutable-ID facade over the complete source tree State/Sliver/renderer closure.
import {ChangeNotifier} from '../../foundation/notifier.ts';
import {invariant} from '../../foundation/errors.ts';
import {ValueKey} from '../../foundation/key.ts';
import {FlutterError} from '../../foundation/flutter-error.ts';
import {FlutterErrorDetails} from '../../foundation/assertions.ts';
import {StatefulWidget,State,Element} from './framework.ts';
import type {Widget,WidgetOptions,BuildContext} from './framework.ts';
import {CustomScrollView} from './scroll-view.ts';
import {SourceTreeSliverNode,SourceTreeSliverController} from './sliver-tree.generated.ts';
import {TreeSliver} from './tree-sliver.ts';
import {dartStringType} from '../../foundation/dart-type-witness.ts';
import {createDartList} from '../../foundation/dart-mutable-list.ts';
import {treeNodeType} from './sliver-tree.generated.ts';
import {SourceTreeSliverIndentationType} from '../rendering/sliver-tree.generated.ts';
import {AnimationStyle} from '../animation/animation-style.ts';
import {setTreeIdExpansion,treeIdIndex,reconcileTreeIds,treeFixedRowExtent} from './tree-sliver-facade.ts';
import {ScrollController} from './scroll-controller.ts';
import type {ScrollPhysics} from './scroll-physics.ts';
import {KeyedSubtree,Padding} from './basic.ts';
import {EdgeInsetsDirectional} from '../painting/edge-insets.ts';
import {tickerScheduler} from './ticker-scheduler.ts';
import {Curves} from '../animation/curves.ts';
import type {Curve} from '../animation/curves.ts';
import {RestorationOwner,UnmanagedRestorationScope} from './restoration.ts';

const maxNodes=100000,maxDepth=256,rowKeyType=Object.freeze({treeRow:true});
function validId(id:unknown):asserts id is string{invariant(typeof id==='string'&&id.length>0&&id.length<=4096,'invalid-tree-id','Tree IDs must be nonempty strings of at most4096 UTF-16 units');}
export class TreeNode<T=unknown> {
  readonly id:string;readonly value:T;readonly children:readonly TreeNode<T>[];
  constructor({id,value,children=[]}:{readonly id:string;readonly value:T;readonly children?:readonly TreeNode<T>[]}){validId(id);invariant(children.every(node=>node instanceof TreeNode),'invalid-tree-child','Tree children must be TreeNodes');this.id=id;this.value=value;this.children=Object.freeze([...children]);Object.freeze(this);}
}
/** Validate an immutable forest once; reuse this model for large trees across parent rebuilds. */
export class TreeModel<T=unknown> {
  readonly nodes:readonly TreeNode<T>[];private readonly byId=new Map<string,TreeNode<T>>();private readonly parents=new Map<string,string|null>();
  constructor(nodes:readonly TreeNode<T>[]){this.nodes=Object.freeze([...nodes]);const stack=this.nodes.map(node=>({node,parent:null as string|null,depth:0})).reverse();while(stack.length){const {node,parent,depth}=stack.pop()!;invariant(node instanceof TreeNode,'invalid-tree-node','Tree model must contain TreeNodes');invariant(this.byId.size<maxNodes&&depth<=maxDepth,'oversize-tree','Tree model exceeds100000 nodes or256 depth');invariant(!this.byId.has(node.id),'duplicate-tree-id','Tree IDs must be globally unique; cycles/shared subtrees are not a tree');this.byId.set(node.id,node);this.parents.set(node.id,parent);for(let index=node.children.length-1;index>=0;index--)stack.push({node:node.children[index]!,parent:node.id,depth:depth+1});}Object.freeze(this);}
  get size():number{return this.byId.size;}getNode(id:string):TreeNode<T>|undefined{return this.byId.get(id);}parentId(id:string):string|null|undefined{return this.parents.get(id);}
}
interface TreeBinding {readonly contains:(id:string)=>boolean;readonly parents:(id:string)=>readonly string[];readonly active:()=>boolean;readonly changed:()=>void;readonly visibleIndex:(id:string)=>number|null;readonly reveal:(id:string,options:TreeRevealOptions)=>Promise<TreeRevealResult>}
export interface TreeRevealOptions {readonly alignment?:number;readonly duration?:number;readonly curve?:Curve}
export type TreeRevealResult={readonly status:'completed'|'cancelled'};
export class TreeController extends ChangeNotifier {
  private expanded=new Set<string>();private binding:TreeBinding|null=null;private retired=false;private notifyPending=false;
  constructor({expandedIds=[]}:{readonly expandedIds?:readonly string[]}={}){super();this.expanded=this.capture(expandedIds);}
  private alive():void{invariant(!this.retired,'disposed-tree-controller','Tree controller has been disposed');}
  private capture(ids:readonly string[]):Set<string>{invariant(Array.isArray(ids)&&ids.length<=maxNodes,'invalid-tree-expansion','Tree expansion must be a bounded string array');for(const id of ids)validId(id);return new Set(ids);}
  get isAttached():boolean{return this.binding?.active()??false;}
  get expandedIds():readonly string[]{return Object.freeze([...this.expanded]);}
  isExpanded(id:string):boolean{this.alive();validId(id);return this.expanded.has(id);}
  visibleIndexOf(id:string):number|null{this.alive();validId(id);return this.binding?.visibleIndex(id)??null;}
  private ensureKnown(id:string):void{this.alive();validId(id);invariant(this.binding===null||this.binding.contains(id),'unknown-tree-id','Tree ID is absent from the current model');}
  private publish():void{this.binding?.changed();if(!this.retired)this.notifyListeners();}
  expand(id:string):void{this.ensureKnown(id);if(this.expanded.has(id))return;this.expanded.add(id);this.publish();}
  collapse(id:string):void{this.ensureKnown(id);if(!this.expanded.delete(id))return;this.publish();}
  toggle(id:string):void{if(this.isExpanded(id))this.collapse(id);else this.expand(id);}
  expandAncestors(id:string):void{this.ensureKnown(id);invariant(this.binding,'unattached-tree-controller','Ancestor expansion requires an attached tree');let changed=false;for(const parent of this.binding.parents(id))if(!this.expanded.has(parent)){this.expanded.add(parent);changed=true;}if(changed)this.publish();}
  restoreExpansion(ids:readonly string[]):void{this.alive();const next=this.capture(ids);if(this.binding)for(const id of next)if(!this.binding.contains(id))next.delete(id);if(next.size===this.expanded.size&&[...next].every(id=>this.expanded.has(id)))return;this.expanded=next;this.publish();}
  reveal(id:string,options:TreeRevealOptions={}):Promise<TreeRevealResult>{const alignment=options.alignment??0,duration=options.duration??0;invariant(Number.isFinite(alignment)&&alignment>=0&&alignment<=1&&Number.isFinite(duration)&&duration>=0,'invalid-tree-reveal','Reveal requires alignment0..1 and finite nonnegative duration');this.ensureKnown(id);invariant(this.isAttached,'unattached-tree-controller','Reveal requires an active tree');const binding=this.binding!;this.expandAncestors(id);if(this.retired||this.binding!==binding||!binding.active())return Promise.resolve({status:'cancelled'});return binding.reveal(id,options);}
  _attach(binding:TreeBinding):void{this.alive();invariant(this.binding===null,'duplicate-tree-owner','A TreeController belongs to one live tree');this.binding=binding;this._prune();}
  _detach(binding:TreeBinding):void{if(this.binding===binding)this.binding=null;}
  _prune():void{let changed=false;for(const id of this.expanded)if(this.binding&&!this.binding.contains(id)){this.expanded.delete(id);changed=true;}if(changed)this._notifyAfterBuild();}
  _restore(ids:readonly string[]):void{const next=this.capture(ids);for(const id of next)if(!this.binding?.contains(id))next.delete(id);this.expanded=next;this._notifyAfterBuild();}
  private _notifyAfterBuild():void{if(this.notifyPending||this.retired)return;this.notifyPending=true;void Promise.resolve().then(()=>{this.notifyPending=false;if(!this.retired)this.notifyListeners();});}
  override dispose():void{if(this.retired)return;invariant(this.binding===null,'live-tree-controller','Unmount the tree before disposing its controller');super.dispose();this.retired=true;}
}
export interface TreeRowDetails<T> {readonly node:TreeNode<T>;readonly depth:number;readonly expanded:boolean;readonly hasChildren:boolean;readonly toggle:()=>void}
export interface TreeViewOptions<T> extends WidgetOptions {
  readonly nodes:readonly TreeNode<T>[]|TreeModel<T>;readonly rowBuilder:(context:BuildContext,details:TreeRowDetails<T>)=>Widget;
  readonly controller?:TreeController|null;readonly scrollController?:ScrollController|null;readonly rowExtent?:number;readonly indentation?:number;
  readonly physics?:ScrollPhysics|null;readonly cacheExtent?:number|null;readonly restorationId?:string|null;
}
export class TreeView<T=unknown> extends StatefulWidget {
  readonly nodes:readonly TreeNode<T>[];readonly model:TreeModel<T>;readonly rowBuilder:TreeViewOptions<T>['rowBuilder'];readonly controller:TreeController|null;readonly scrollController:ScrollController|null;
  readonly rowExtent:number;readonly indentation:number;readonly physics:ScrollPhysics|null;readonly cacheExtent:number|null;readonly restorationId:string|null;
  constructor({nodes,rowBuilder,controller=null,scrollController=null,rowExtent=32,indentation=20,physics=null,cacheExtent=null,restorationId=null,key=null}:TreeViewOptions<T>){super(key);invariant(typeof rowBuilder==='function','missing-tree-builder','Tree requires a row builder');invariant(Number.isFinite(rowExtent)&&rowExtent>0&&Number.isFinite(indentation)&&indentation>=0,'invalid-tree-geometry','Tree rows must have finite positive extent and nonnegative indentation');invariant(cacheExtent===null||Number.isFinite(cacheExtent)&&cacheExtent>=0,'invalid-tree-cache','Tree cache extent must be finite and nonnegative');this.model=nodes instanceof TreeModel?nodes:new TreeModel(nodes);this.nodes=this.model.nodes;invariant(Number.isFinite(this.model.size*rowExtent)&&this.model.size*rowExtent<=Number.MAX_SAFE_INTEGER&&indentation*maxDepth<=Number.MAX_SAFE_INTEGER,'oversize-tree-geometry','Tree extents must fit safe logical coordinates');this.rowBuilder=rowBuilder;this.controller=controller;this.scrollController=scrollController;this.rowExtent=rowExtent;this.indentation=indentation;this.physics=physics;this.cacheExtent=cacheExtent;this.restorationId=restorationId;}
  createState():State<TreeView<T>>{return new _TreeViewState<T>();}
}
interface Reveal {readonly id:string;readonly alignment:number;readonly duration:number;readonly curve:Curve;readonly revision:number;readonly resolve:(result:TreeRevealResult)=>void;readonly reject:(error:unknown)=>void}
class _TreeViewState<T> extends State<TreeView<T>> {
  private owned:TreeController|null=null;private ownedScroll:ScrollController|null=null;private model!:TreeModel<T>;
  private readonly sourceController=new SourceTreeSliverController();private readonly sourceRoots=createDartList(treeNodeType(dartStringType),[]);private sourceNodes=new Map<string,SourceTreeSliverNode<string>>();private revision=0;private pending:Reveal|null=null;private readonly lifetime:{current:_TreeViewState<T>|null}={current:this};
  private get live():boolean{return this.mounted&&(this.context as Element).active;}
  private get controller():TreeController{return this.widget.controller??this.owned!;}
  private get scroll():ScrollController{return this.widget.scrollController??this.ownedScroll!;}
  private readonly binding:TreeBinding={contains:id=>this.model.getNode(id)!==undefined,active:()=>this.live,changed:()=>this.changed(),visibleIndex:id=>this.visibleIndex(id),parents:id=>{const result:string[]=[];let parent=this.model.parentId(id);while(parent!==null&&parent!==undefined){result.push(parent);parent=this.model.parentId(parent);}return result;},reveal:(id,options)=>this.requestReveal(id,options)};
  private readonly restoration=new RestorationOwner(this,(bucket,_initial,needsRestore)=>{if(needsRestore){const ids=bucket?.read('expanded');if(ids!==null&&ids!==undefined){invariant(Array.isArray(ids),'invalid-restored-tree','Restored tree expansion must be an ID array');this.controller._restore(ids as string[]);}}this.syncHierarchy();this.persist();});
  override initState():void{super.initState();if(this.widget.controller===null)this.owned=new TreeController();if(this.widget.scrollController===null)this.ownedScroll=new ScrollController();this.indexModel();this.controller._attach(this.binding);this.syncHierarchy();}
  private indexModel():void{
    this.model=this.widget.model;const next=new Map<string,SourceTreeSliverNode<string>>(),links:TreeNode<T>[]=[],pending=[...this.widget.nodes];
    while(pending.length){const node=pending.pop()!;next.set(node.id,this.sourceNodes.get(node.id)??new SourceTreeSliverNode(dartStringType,node.id));links.push(node);for(const child of node.children)pending.push(child);}
    for(const node of links){const source=next.get(node.id)!;source.children.length=0;for(const child of node.children)source.children.push(next.get(child.id)!);}
    this.sourceNodes=next;this.sourceRoots.length=0;for(const node of this.widget.nodes)this.sourceRoots.push(next.get(node.id)!);
  }
  private visibleIndex(id:string):number|null{return treeIdIndex(this.sourceController,this.sourceNodes.get(id));}
  private syncHierarchy():void{for(const [id,node]of this.sourceNodes)setTreeIdExpansion(node,this.controller.isExpanded(id));reconcileTreeIds(this.sourceController);}
  private report(error:unknown):void{if(!this.live)return;(this.context.services.reportError??(exception=>FlutterError.reportError(new FlutterErrorDetails({exception,library:'widgets tree'}))))(error);}
  private persist():void{this.restoration.bucket?.write('expanded',this.controller.expandedIds);}
  private changed():void{this.revision++;this.cancelReveal();this.syncHierarchy();if(!this.live)return;this.setState(()=>{});try{this.persist();}catch(error){this.report(error);}}
  override didChangeDependencies():void{super.didChangeDependencies();this.restoration.update(this.context,this.widget.restorationId);}
  override didUpdateWidget(old:TreeView<T>):void{super.didUpdateWidget(old);invariant(old.controller===this.widget.controller&&old.scrollController===this.widget.scrollController,'changed-tree-controller','Use a new Widget key when changing tree/scroll controllers');const sameModel=old.model===this.widget.model||old.nodes.length===this.widget.nodes.length&&old.nodes.every((node,index)=>node===this.widget.nodes[index]);if(!sameModel||old.rowExtent!==this.widget.rowExtent){this.revision++;this.cancelReveal();this.indexModel();this.controller._prune();this.syncHierarchy();this.persist();}this.restoration.update(this.context,this.widget.restorationId);}
  private cancelReveal():void{const pending=this.pending;this.pending=null;pending?.resolve({status:'cancelled'});}
  private requestReveal(id:string,{alignment=0,duration=0,curve=Curves.easeInOut}:TreeRevealOptions):Promise<TreeRevealResult>{
    invariant(this.live&&Number.isFinite(alignment)&&alignment>=0&&alignment<=1&&Number.isFinite(duration)&&duration>=0,'invalid-tree-reveal','Reveal needs an active tree, alignment0..1 and finite nonnegative duration');this.cancelReveal();const revision=this.revision,token=this.lifetime;
    const result=new Promise<TreeRevealResult>((resolve,reject)=>{this.pending={id,alignment,duration,curve,revision,resolve,reject};});tickerScheduler(this.context).addPostFrameCallback(()=>{const state=token.current;if(state?.live)state.performReveal(revision);},{debugLabel:'tree reveal after layout'});this.setState(()=>{});return result;
  }
  private performReveal(revision:number):void{const operation=this.pending;if(!operation||operation.revision!==revision)return;const index=this.visibleIndex(operation.id);if(!this.live||index===null||!this.scroll.hasClients){this.cancelReveal();return;}const position=this.scroll.position,target=Math.min(position.maxScrollExtent,Math.max(position.minScrollExtent,index*this.widget.rowExtent-operation.alignment*(position.viewportDimension-this.widget.rowExtent))),token=this.lifetime;
    try{if(operation.duration===0){this.scroll.jumpTo(target);if(this.pending===operation){this.pending=null;operation.resolve({status:this.live?'completed':'cancelled'});}return;}void this.scroll.animateTo(target,{duration:operation.duration,curve:operation.curve}).then(()=>{const state=token.current;if(state?.pending===operation){state.pending=null;operation.resolve({status:state.live?'completed':'cancelled'});}},error=>{const state=token.current;if(state?.pending===operation){state.pending=null;operation.reject(error);}});}catch(error){if(this.pending===operation){this.pending=null;operation.reject(error);}}
  }
  build(_context:BuildContext):Widget{
    const token=this.lifetime,revision=this.revision;
    const tree=new TreeSliver<string>(dartStringType,{tree:this.sourceRoots,controller:this.sourceController,toggleAnimationStyle:AnimationStyle.noAnimation,indentation:SourceTreeSliverIndentationType.none,treeRowExtentBuilder:treeFixedRowExtent(this.widget.rowExtent),findChildIndexCallback:key=>key instanceof ValueKey&&key.typeToken===rowKeyType&&typeof key.value==='string'?this.visibleIndex(key.value):null,treeNodeBuilder:(context,source)=>{
      const node=this.model.getNode(source.content as string);invariant(node&&source.depth!==null,'invalid-tree-source-row','Source row must belong to the current immutable model');const depth=source.depth;
      const details:TreeRowDetails<T>=Object.freeze({node,depth,expanded:this.controller.isExpanded(node.id),hasChildren:node.children.length>0,toggle:()=>{const state=token.current;if(state?.live&&state.revision===revision&&state.model.getNode(node.id)===node&&node.children.length)state.controller.toggle(node.id);}});
      return new KeyedSubtree({key:new ValueKey(node.id,rowKeyType),child:new Padding(new EdgeInsetsDirectional(depth*this.widget.indentation,0,0,0),this.widget.rowBuilder(context,details))});
    }});
    const body=new CustomScrollView({controller:this.scroll,primary:false,physics:this.widget.physics,cacheExtent:this.widget.cacheExtent,restorationId:this.widget.restorationId===null?null:'scroll',slivers:[tree]});
    return new UnmanagedRestorationScope({bucket:this.restoration.bucket,child:body});
  }
  override activate():void{super.activate();this.syncHierarchy();}
  override deactivate():void{this.revision++;this.cancelReveal();super.deactivate();}
  override dispose():void{this.lifetime.current=null;this.cancelReveal();this.controller._detach(this.binding);this.sourceNodes.clear();this.sourceRoots.length=0;const errors:unknown[]=[];for(const close of [()=>this.restoration.dispose(),()=>this.owned?.dispose(),()=>this.ownedScroll?.dispose(),()=>super.dispose()])try{close();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Tree owner retirement failed');}
}
