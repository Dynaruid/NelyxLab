// SPDX-License-Identifier: BSD-3-Clause
// Reviewed port of selected Doroti Rendering/object.cs and box.cs ownership/layout semantics.
import {invariant} from '../../foundation/errors.ts';
import {DiagnosticableTreeMixin} from '../../foundation/diagnosticable.ts';
import {DiagnosticsProperty} from '../../foundation/diagnostics.ts';
import type {DiagnosticPropertiesBuilder,DiagnosticsNode,DiagnosticsStringOptions} from '../../foundation/diagnostics.ts';
import {FoundationBuildMode} from '../../foundation/constants.ts';
import {describeIdentity} from '../../foundation/diagnostics-identity.ts';
import {assertOutsideRenderPaint} from './phase.ts';
import {contains,identity,inversePaintTransform,multiply,transform,translate,validSize,bounds,intersect,fullTransform,captureTransform} from '../../ui/geometry.ts';
import {matrix4Identity,inverseMatrix4,multiplyMatrix4,captureMatrix4,unprojectMatrix4Point} from '../../ui/matrix4.ts';
import type {Matrix4Storage} from '../../ui/matrix4.ts';
import type {Size,Offset,TransformMatrix} from '../../ui/geometry.ts';
import type {SemanticsNode,SemanticsTextNavigation,SemanticsTextParagraph,Rect,CoreEditingGeometry,TextInputGeometry,ViewOwner,ViewMetrics} from '../../ui/types.ts';
import {freezeTextInputGeometry} from '../../ui/editing.ts';
import {SemanticsProperties} from '../semantics/semantics.ts';
import {AttributedString} from '../semantics/attributed-string.ts';
import {valueEquals} from '../painting/value-equality.ts';
import type {Locale} from '../../ui/locale.ts';
import type {TextSelection} from '../../services/text-editing.ts';
import type {SemanticsConfiguration,SemanticsNode as SourceSemanticsNode} from '../semantics/semantics.ts';
import type {SemanticsOwner,SemanticsOwnerOptions} from '../semantics/semantics.ts';
import type {SemanticsUpdateCallback} from '../semantics/semantics.ts';
import type {SemanticsEvent} from '../semantics/semantics-event.ts';
import {SemanticsHandle} from '../semantics/binding.ts';
import {semanticsFor,existingSemanticsFor,pipelineSemantics,existingPipelineSemantics} from './semantics-pipeline.ts';
import {describeTransportSemantics} from './semantics-transport.ts';
import type {SemanticsTransportProperties} from './semantics-transport.ts';
import {Matrix4 as SourceMatrix4} from '../../math/matrix4.ts';
import type {PointerEvent} from '../../ui/input.ts';
import type {PointerEvent as SourcePointerEvent} from '../gestures/events.ts';
import type {HitTestEntry as SourceHitTestEntry} from '../gestures/hit-test.ts';
import type {HitTestTarget} from '../gestures/hit-test.ts';
import {BoxConstraints} from './constraints.ts';
import type {Constraints} from './constraints.ts';
import type {PaintingContext} from '../painting/context.ts';
import type {Curve} from '../animation/curves.ts';
import {Listenable} from '../../foundation/notifier.ts';
import type {FrameScheduler} from '../scheduler/scheduler.ts';
import type {Disposable} from '../../foundation/disposable.ts';
// Ordinary boxes retain their translation while scrolling moves an ancestor.
// Keep one owned snapshot per child; offsets and virtual localTransform getters
// are still read on every query, including in-place parent-data mutations.
interface InputGeometryScope {readonly token:object;committed:boolean;aborted:boolean}
interface CommittedInputGeometry {readonly scope:InputGeometryScope;readonly root:RenderObject;readonly paintVersion:number;readonly key:string;readonly value:TextInputGeometry}
const committedInputGeometries=new WeakMap<RenderObject,CommittedInputGeometry>();
let nextInputGeometryEpoch=0;
// Projection closures belong only to editors, not every node in the tree walk.
function captureInputGeometry(render:RenderObject,core:CoreEditingGeometry,frame:{readonly owner:ViewOwner;readonly metrics:ViewMetrics},previous:CommittedInputGeometry|undefined):Pick<CommittedInputGeometry,'key'|'value'>|undefined{
  const matrix=render.getTransformTo(null),project=(rect:Rect)=>bounds(multiply(matrix,translate(rect.x,rect.y)),rect),full=project({x:0,y:0,width:core.width,height:core.height});
  let clip=intersect(full,{x:0,y:0,width:frame.metrics.logicalWidth,height:frame.metrics.logicalHeight});
  for(let child=render,parent=render.parent;parent;child=parent,parent=parent.parent){
    const local=parent.describeApproximatePaintClip(child);
    if(local)clip=intersect(clip,bounds(multiply(parent.getTransformTo(null),translate(local.x,local.y)),local));
  }
  const caret=project(core.caret),selectionRects=core.selectionRects.map(project),caretBaseline=transform(matrix,core.caretBaseline);
  if([full,clip,caret,...selectionRects].every(rect=>[rect.x,rect.y,rect.width,rect.height].every(Number.isFinite))&&Number.isFinite(caretBaseline.x)&&Number.isFinite(caretBaseline.y)){
    const packet={coordinates:'view-logical' as const,owner:frame.owner,viewportGeneration:frame.metrics.viewportGeneration,...(frame.metrics.nativeSurfaceGeneration===null?{}:{nativeSurfaceGeneration:frame.metrics.nativeSurfaceGeneration}),scale:frame.metrics.scale,transform:matrix,bounds:full,clip,caret,caretBaseline,selectionRects};
    const key=JSON.stringify({localEpoch:core.epoch,...packet});
    const value=previous?.key===key?previous.value:(invariant(Number.isSafeInteger(nextInputGeometryEpoch+1),'input-geometry-epoch-exhausted','Core input geometry epoch space is exhausted'),freezeTextInputGeometry({...packet,layoutEpoch:++nextInputGeometryEpoch}));
    return {key,value};
  }
  return undefined;
}

export interface ShowOnScreenOptions {readonly descendant?:RenderObject;readonly targetRect?:Rect;readonly duration?:number;readonly curve?:Curve}
export interface HitTestEntry {readonly target:HitTestTarget;readonly transform:TransformMatrix;readonly onSourceEntry?:(entry:SourceHitTestEntry)=>void;readonly createSourceEntry?:()=>SourceHitTestEntry}
export class ParentData {
  /** Subclasses release sibling or parent-specific references when dropped. */
  detach():void {}
  toString():string{return '<none>';}
}
export interface ContainerParentData {previousSibling:RenderObject|null;nextSibling:RenderObject|null}
export type ParentDataConstructor = abstract new (...args:any[])=>ParentData;
export type ContainerParentDataConstructor<Base extends ParentDataConstructor> = abstract new (...args:ConstructorParameters<Base>)=>InstanceType<Base>&ContainerParentData;
const containerParentData=new WeakSet<ParentData>();
function isContainerParentData(value:ParentData|undefined|null):value is ParentData&ContainerParentData{return !!value&&containerParentData.has(value);}
/** Source sibling contract for parent data that need not have a box offset. */
export function ContainerParentDataMixin<Base extends ParentDataConstructor>(Base:Base):ContainerParentDataConstructor<Base>{
  abstract class LinkedParentData extends Base {
    previousSibling:RenderObject|null=null;
    nextSibling:RenderObject|null=null;
    constructor(...args:any[]){super(...args);containerParentData.add(this);}
    override detach():void{if(FoundationBuildMode.debug){if(!(this.previousSibling===null&&this.nextSibling===null))invariant(false,'linked-parent-data-detach','Pointers to siblings must be nulled before detaching ParentData.');}super.detach();}
  }
  return LinkedParentData as unknown as ContainerParentDataConstructor<Base>;
}
/** @internal Shared phase guard for spatial parent-data implementations. */
export function assertParentDataOffsetMutation():void{assertOutsideRenderPaint();if(!(!layoutQueries.length))invariant(false,'render-mutation-during-measurement','Measurement cannot change child offsets');}
export class BoxParentData extends ParentData {
  private position:Offset=Object.freeze({x:0,y:0});
  get offset():Offset{return this.position;}
  set offset(value:Offset){assertParentDataOffsetMutation();const {x,y}=value;if(!(Number.isFinite(x)&&Number.isFinite(y)))invariant(false,'invalid-render-offset','Child offsets must be finite');this.position=Object.freeze({x,y});}
}
export class ContainerBoxParentData<T extends RenderObject=RenderObject> extends BoxParentData {
  previousSibling:T|undefined;
  nextSibling:T|undefined;
  override detach():void{this.previousSibling=undefined;this.nextSibling=undefined;}
}
const layoutQueues=new WeakMap<PipelineOwner,Set<RenderObject>>();
const layoutCallbackQueues=new WeakMap<PipelineOwner,Set<RenderObject>>();
const detachRevisions=new WeakMap<RenderObject,number>();
const recoveringDetach=new WeakSet<RenderObject>();
const treeTransitions=new WeakMap<PipelineOwner,number>();
function enterTreeTransition(owner:PipelineOwner|undefined):PipelineOwner|undefined{if(owner)treeTransitions.set(owner,(treeTransitions.get(owner)??0)+1);return owner;}
function leaveTreeTransition(owner:PipelineOwner|undefined):void{if(!owner)return;const count=treeTransitions.get(owner)!-1;if(count)treeTransitions.set(owner,count);else treeTransitions.delete(owner);}
function attempt(errors:unknown[],callback:()=>void):void{try{callback();}catch(error){errors.push(error);}}
function throwFailures(errors:unknown[],message:string):void{if(errors.length===1)throw errors[0];if(errors.length)throw new AggregateError(errors,message);}
/** A failing subclass hook must not leave the base ownership state attached. */
function detachRenderTree(node:RenderObject,errors:unknown[]):void{
  const revision=detachRevisions.get(node)??0,count=errors.length,alreadyRecovering=recoveringDetach.has(node);recoveringDetach.add(node);
  try{attempt(errors,()=>node.detach());if((detachRevisions.get(node)??0)===revision){
      if(errors.length===count)errors.push(new Error(`${node.constructor.name}.detach must call super.detach()`));
      attempt(errors,()=>RenderObject.prototype.detach.call(node));
    }}finally{if(!alreadyRecovering)recoveringDetach.delete(node);}
}
function attachRenderTree(node:RenderObject,owner:PipelineOwner):void{
  const revision=detachRevisions.get(node)??0;
  try{node.attach(owner);if(!(node.owner===owner))invariant(false,'invalid-render-owner','attach must call super.attach and retain the requested pipeline');}
  catch(error){const errors=[error];if((detachRevisions.get(node)??0)===revision)detachRenderTree(node,errors);throwFailures(errors,'Attaching render subtree failed');}
}
/** Explicit replacement for the source process-wide painting/scheduler pair. */
export interface SystemFontsRelayoutContext {readonly systemFonts:Listenable;readonly scheduler:FrameScheduler}
export type PipelineOwnerVisitor=(child:PipelineOwner)=>void;
export abstract class PipelineManifold extends Listenable {abstract readonly semanticsEnabled:boolean;abstract requestVisualUpdate():void;}
export interface PipelineOwnerOptions {
  /** Hard startup opt-out; explicit semantics requests cannot override it. */
  readonly accessibilityEnabled?:boolean;
  readonly onNeedVisualUpdate?:(()=>void)|null;readonly onSemanticsOwnerCreated?:(()=>void)|null;readonly onSemanticsUpdate?:SemanticsUpdateCallback|null;readonly onSemanticsOwnerDisposed?:(()=>void)|null;
  readonly systemFonts?:SystemFontsRelayoutContext|null;readonly messenger?:SemanticsOwnerOptions['messenger'];readonly createSemanticsUpdateBuilder?:SemanticsOwnerOptions['createSemanticsUpdateBuilder'];
}
class _LocalSemanticsHandle extends SemanticsHandle {
  constructor(private readonly owner:PipelineOwner,readonly listener:(()=>void)|null,private readonly release:()=>void){super(()=>{},false);if(FoundationBuildMode.debug&&Listenable.debugInstrumentationEnabled)Listenable.debugMaybeDispatchCreated?.('_LocalSemanticsHandle',this);if(listener!==null){if(!(owner.semanticsOwner!==null))invariant(false,'missing-semantics-owner','A handle requires a semantics owner');owner.semanticsOwner.addListener(listener);}}
  override dispose():void{if(FoundationBuildMode.debug&&Listenable.debugInstrumentationEnabled)Listenable.debugMaybeDispatchDisposed?.(this);if(this.listener!==null&&!this.owner.debugDisposed){if(!(this.owner.semanticsOwner!==null))invariant(false,'missing-semantics-owner','A handle listener requires its semantics owner');this.owner.semanticsOwner.removeListener(this.listener);}this.release();}
}
export class PipelineOwner extends DiagnosticableTreeMixin(class {}) {
  private currentRoot:RenderObject|undefined;
  private dead=false;
  private changingRoot=false;
  private readonly dirtyLayout=new Set<RenderObject>();
  private readonly layoutCallbacks=new Set<RenderObject>();
  private readonly paintRetirements=new Set<RenderObject>();
  /** @internal One synchronous layout transaction, never a frame/geometry lease. */
  _paintInvalidationBatch:object|null=null;
  _finishPaintInvalidationBatch():void{this._paintInvalidationBatch=null;}
  /** @internal Dirty retained owners only; no walk over the complete tree. */
  _schedulePaintRetirement(node:RenderObject):void{this.paintRetirements.add(node);}
  _forgetPaintRetirement(node:RenderObject):void{this.paintRetirements.delete(node);}
  _flushPaintRetirements():void{
    if(!this.paintRetirements.size)return;
    const pending=[...this.paintRetirements];let errors:unknown[]|undefined;
    for(const node of pending){if(!this.paintRetirements.delete(node)||node.owner!==this)continue;try{node._retireHiddenPaint();}catch(error){this.paintRetirements.add(node);(errors??=[]).push(error);}}
    if(errors)throwFailures(errors,'Hidden paint retirement failed');
  }
  private flushingLayout=false;
  private flushingChildLayout=false;private flushingSemantics=false;
  private readonly childOwners=new Set<PipelineOwner>();private childRevision=0;private parentOwner:PipelineOwner|null=null;private manifold:PipelineManifold|null=null;
  private outstandingSemanticsHandles=0;private explicitSemantics:SemanticsOwnerOptions|null=null;
  readonly invalidate:()=>void;readonly systemFonts:SystemFontsRelayoutContext|null;
  readonly onNeedVisualUpdate:(()=>void)|null;readonly onSemanticsOwnerCreated:(()=>void)|null;readonly onSemanticsUpdate:SemanticsUpdateCallback|null;readonly onSemanticsOwnerDisposed:(()=>void)|null;
  readonly accessibilityEnabled:boolean;
  private readonly semanticsFactory:Pick<SemanticsOwnerOptions,'messenger'|'createSemanticsUpdateBuilder'>;
  constructor(options:PipelineOwnerOptions|(()=>void)={},systemFonts:SystemFontsRelayoutContext|null=null) {super();const settings:PipelineOwnerOptions=typeof options==='function'?{onNeedVisualUpdate:options,systemFonts}:options;this.accessibilityEnabled=settings.accessibilityEnabled!==false;this.onNeedVisualUpdate=settings.onNeedVisualUpdate??null;this.onSemanticsOwnerCreated=settings.onSemanticsOwnerCreated??null;this.onSemanticsUpdate=settings.onSemanticsUpdate??null;this.onSemanticsOwnerDisposed=settings.onSemanticsOwnerDisposed??null;this.systemFonts=settings.systemFonts??systemFonts;this.semanticsFactory={...(settings.messenger?{messenger:settings.messenger}:{}),...(settings.createSemanticsUpdateBuilder?{createSemanticsUpdateBuilder:settings.createSemanticsUpdateBuilder}:{})};this.invalidate=()=>this.requestVisualUpdate();layoutQueues.set(this,this.dirtyLayout);layoutCallbackQueues.set(this,this.layoutCallbacks);if(FoundationBuildMode.debug&&Listenable.debugInstrumentationEnabled)Listenable.debugMaybeDispatchCreated?.('PipelineOwner',this);}
  get root():RenderObject|undefined{return this.currentRoot;}
  get rootNode():RenderObject|undefined{return this.currentRoot;}
  set rootNode(value:RenderObject|null|undefined){this.setRoot(value??undefined);}
  get debugDisposed():boolean{return this.dead;}
  get debugDoingLayout():boolean{return this.flushingLayout||activeLayout?.owner===this;}
  get debugDoingSemantics():boolean{return FoundationBuildMode.debug&&this.flushingSemantics;}
  requestVisualUpdate():void{if(this.onNeedVisualUpdate!==null)this.onNeedVisualUpdate();else this.manifold?.requestVisualUpdate();}
  get semanticsOwner():SemanticsOwner|null{return existingPipelineSemantics(this)?.owner??null;}
  get debugOutstandingSemanticsHandles():number{return this.outstandingSemanticsHandles;}
  ensureSemantics({listener=null}:{readonly listener?:(()=>void)|null}={}):SemanticsHandle{if(!(!this.dead))invariant(false,'closed-render-pipeline','Cannot acquire semantics on a closed pipeline');if(!this.accessibilityEnabled)return SemanticsHandle._create(()=>{});this.outstandingSemanticsHandles++;this.updateSemanticsOwner();return new _LocalSemanticsHandle(this,listener,()=>{if(this.dead){if(FoundationBuildMode.debug){if(!(this.outstandingSemanticsHandles>0))invariant(false,'invalid-semantics-handle-count','No semantics handle remains');}this.outstandingSemanticsHandles--;return;}if(FoundationBuildMode.debug){if(!(this.semanticsOwner!==null))invariant(false,'missing-semantics-owner','Disposing a handle requires a semantics owner');}this.outstandingSemanticsHandles--;this.updateSemanticsOwner();});}
  private readonly updateSemanticsOwner=():void=>{if(!this.accessibilityEnabled)return;if(this.explicitSemantics!==null||(this.manifold?.semanticsEnabled??false)||this.outstandingSemanticsHandles>0){if(this.semanticsOwner===null){const options=this.explicitSemantics??{...this.semanticsFactory,onSemanticsUpdate:this.onSemanticsUpdate!};if(!(options.onSemanticsUpdate!==null&&options.onSemanticsUpdate!==undefined))invariant(false,'missing-semantics-update','Enabling semantics requires an onSemanticsUpdate callback');const state=pipelineSemantics(this);state.enable(options,false);const created=state.owner;this.onSemanticsOwnerCreated?.();if(this.explicitSemantics!==null&&state.owner===created&&this.root)this.root.scheduleInitialSemantics();}}else if(this.semanticsOwner!==null){existingPipelineSemantics(this)!.disable();this.onSemanticsOwnerDisposed?.();}};
  /** App/View ownership supplies the update sink and optional application messenger. */
  enableSemantics(options:SemanticsOwnerOptions):void{if(!this.accessibilityEnabled)return;if(!(!this.dead&&this.explicitSemantics===null&&this.semanticsOwner===null))invariant(false,'closed-render-pipeline','Cannot duplicate or enable semantics on a closed pipeline');this.explicitSemantics=options;this.updateSemanticsOwner();}
  disableSemantics():void{this.explicitSemantics=null;this.updateSemanticsOwner();}
  flushSemantics():void{if(!(!this.dead&&!this.flushingLayout&&!this.flushingSemantics&&!this.changingRoot&&!treeTransitions.has(this)&&!layoutQueries.length))invariant(false,'invalid-semantics-flush','Semantics flush requires an idle live pipeline');if(this.semanticsOwner===null)return;this.flushingSemantics=true;try{existingPipelineSemantics(this)!.flush();}finally{this.flushingSemantics=false;}}
  attach(manifold:PipelineManifold):void{if(!(!this.dead&&this.manifold===null))invariant(false,'attached-render-pipeline','Pipeline must be live and detached');this.manifold=manifold;manifold.addListener(this.updateSemanticsOwner);this.updateSemanticsOwner();this.visitChildren(child=>child.attach(manifold));}
  detach():void{if(!(this.manifold!==null))invariant(false,'detached-render-pipeline','Pipeline has no manifold');this.manifold.removeListener(this.updateSemanticsOwner);this.manifold=null;this.visitChildren(child=>child.detach());}
  adoptChild(child:PipelineOwner):void{assertOutsideRenderPaint();if(!(!this.dead&&!child.dead&&child.parentOwner===null&&!this.childOwners.has(child)))invariant(false,'invalid-child-pipeline','A live child pipeline must be unparented');if(FoundationBuildMode.debug){if(!(!this.flushingChildLayout&&!this.flushingSemantics))invariant(false,'pipeline-child-mutation','Cannot modify the child pipeline list while flushing children');}for(let parent:PipelineOwner|null=this;parent;parent=parent.parentOwner){if(!(parent!==child))invariant(false,'cyclic-pipeline-tree','A pipeline cannot adopt its ancestor');}this.childOwners.add(child);this.childRevision++;child.parentOwner=this;if(this.manifold!==null)child.attach(this.manifold);}
  dropChild(child:PipelineOwner):void{assertOutsideRenderPaint();if(!(child.parentOwner===this&&this.childOwners.has(child)))invariant(false,'invalid-child-pipeline','The pipeline does not own this child');if(FoundationBuildMode.debug){if(!(!this.flushingChildLayout&&!this.flushingSemantics))invariant(false,'pipeline-child-mutation','Cannot modify the child pipeline list while flushing children');}this.childOwners.delete(child);this.childRevision++;child.parentOwner=null;if(this.manifold!==null)child.detach();}
  visitChildren(visitor:PipelineOwnerVisitor):void{const revision=this.childRevision;for(const child of this.childOwners){visitor(child);if(revision!==this.childRevision){const error=new Error('Pipeline children changed during iteration');error.name='ConcurrentModificationError';throw error;}}}
  override debugDescribeChildren():readonly DiagnosticsNode[]{return [...this.childOwners].map(child=>child.toDiagnosticsNode());}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new DiagnosticsProperty('rootNode',this.rootNode??null,{defaultValue:null}));}
  setRoot(root:RenderObject|undefined):void {
    assertOutsideRenderPaint();
    if(!(!this.dead&&!this.changingRoot&&!this.flushingLayout&&!treeTransitions.has(this)&&!layoutQueries.length))invariant(false,'invalid-pipeline-mutation','Pipeline is closed, active or being measured');
    if(!(!root?.parent&&!root?.debugDisposed&&(!root?.owner||root.owner===this)))invariant(false,'invalid-render-root','Root must be a live unparented render object in this pipeline');
    if(this.currentRoot===root&&(!root||root.owner===this))return;
    this.changingRoot=true;
    try{
      if(root&&root.owner!==this)attachRenderTree(root,this);
      const previous=this.currentRoot,errors:unknown[]=[];this.currentRoot=root;
      if(previous&&previous!==root)detachRenderTree(previous,errors);
      attempt(errors,()=>existingPipelineSemantics(this)?.rootChanged(previous,root));
      attempt(errors,this.invalidate);throwFailures(errors,'Replacing pipeline root failed');
    }finally{this.changingRoot=false;}
  }
  requestLayout(node:RenderObject):void{assertOutsideRenderPaint();if(!(!this.dead&&node.owner===this))invariant(false,'invalid-render-owner','Layout request requires this live pipeline');if(!this.dirtyLayout.has(node)){this.dirtyLayout.add(node);this.invalidate();}}
  /** @internal Callback nodes must update even when an ancestor skips their layout. */
  requestLayoutCallback(node:RenderObject):void{assertOutsideRenderPaint();if(!(!this.dead&&node.owner===this))invariant(false,'invalid-render-owner','Layout callback requires this live pipeline');this.layoutCallbacks.add(node);}
  flushLayout(size?:Size):void {
    assertOutsideRenderPaint();
    if(!(!this.dead&&!this.flushingLayout&&!this.changingRoot&&!treeTransitions.has(this)&&!layoutQueries.length))invariant(false,'reentrant-layout-flush','Pipeline is closed or layout/root mutation/measurement is active');this.flushingLayout=true;this._paintInvalidationBatch={};
    try{if(this.root){if(size){if(!(this.root instanceof RenderBox))invariant(false,'invalid-render-root','View layout requires a RenderBox root');this.root.layout(BoxConstraints.tight(size));}else if(this.root.needsLayout)this.root.layoutWithoutResize();}
      let passes=0;
      while(this.dirtyLayout.size||this.layoutCallbacks.size){
        // Covered theaters keep attached LayoutBuilders and their isolated
        // scopes. A pending callback must stay queued until it can run: its
        // render-side pending flag prevents a later request from re-enqueuing.
        const nodes=[...new Set([...this.dirtyLayout,...this.layoutCallbacks])]
          .filter(node=>node.owner!==this||!node.needsLayout||!node.layoutSuppressedByAncestor)
          .sort((a,b)=>a.depth-b.depth);
        if(!nodes.length)break;
        if(!(++passes<=30))invariant(false,'layout-did-not-converge','Layout remained dirty after 30 passes');
        const callbacks=new Set(nodes.filter(node=>this.layoutCallbacks.has(node)));
        for(const node of nodes){this.dirtyLayout.delete(node);this.layoutCallbacks.delete(node);}
        for(let index=0;index<nodes.length;index++)try{
          const node=nodes[index]!;
          if(node.owner===this&&node.needsLayout&&node.layoutSuppressedByAncestor){this.dirtyLayout.add(node);if(callbacks.has(node))this.layoutCallbacks.add(node);continue;}
          if(node.owner===this&&node.needsLayout&&(node.isRelayoutBoundary||callbacks.has(node)))node.layoutWithoutResize();
        }catch(error){
          this.restoreLayoutBatch(nodes,index,callbacks);throw error;
        }
      }
      const deferred=FoundationBuildMode.debug?new Set(this.dirtyLayout):null;
      this.flushingChildLayout=true;this.visitChildren(child=>child.flushLayout());
      if(deferred){if(!([...this.dirtyLayout].every(node=>deferred.has(node))))invariant(false,'child-dirtied-parent-layout','Child PipelineOwners must not dirty nodes in their parent');}
    }finally{this._paintInvalidationBatch=null;this.flushingLayout=false;this.flushingChildLayout=false;}
  }
  private restoreLayoutBatch(nodes:readonly RenderObject[],start:number,callbacks:ReadonlySet<RenderObject>):void{
    for(let index=start;index<nodes.length;index++){
      const node=nodes[index]!;
      // Rendering-library friend access to the canonical owner/dirty state.
      // A virtual admission/layout hook can throw and poison its public owner
      // getter. Recovery must neither mask that error nor lose later siblings.
      const state=node as unknown as {readonly pipelineOwner:PipelineOwner|undefined;readonly layoutDirty:boolean};
      if(state.pipelineOwner===this&&state.layoutDirty){this.dirtyLayout.add(node);if(callbacks.has(node))this.layoutCallbacks.add(node);}
    }
  }
  dispose():void {assertOutsideRenderPaint();if(this.dead)return;if(!(!this.changingRoot&&!this.flushingLayout&&!this.flushingSemantics&&!treeTransitions.has(this)&&!layoutQueries.length))invariant(false,'invalid-pipeline-mutation','Cannot dispose an active pipeline');if(!(this.childOwners.size===0&&this.manifold===null&&this.parentOwner===null))invariant(false,'attached-render-pipeline','Drop child pipelines and detach the manifold before disposing');if(FoundationBuildMode.debug&&Listenable.debugInstrumentationEnabled)Listenable.debugMaybeDispatchDisposed?.(this);const errors:unknown[]=[];this.explicitSemantics=null;attempt(errors,()=>existingPipelineSemantics(this)?.disable());this.dead=true;const root=this.currentRoot;this.currentRoot=undefined;this.dirtyLayout.clear();this.layoutCallbacks.clear();this.paintRetirements.clear();if(root)detachRenderTree(root,errors);throwFailures(errors,'Pipeline teardown failed');}
}
interface ChildEntry {previous:RenderObject|undefined;next:RenderObject|undefined}
const emptyRenderChildren:readonly RenderObject[]=Object.freeze([]);
/** Canonical child links and projection. Empty render objects allocate no
 * store; unary wrappers use the store itself as their sole link, with no Map
 * backing table or separate ChildEntry. Only real siblings promote to a Map. */
class RenderChildStore implements ChildEntry {
  first:RenderObject|undefined;last:RenderObject|undefined;
  snapshot:readonly RenderObject[]|undefined=emptyRenderChildren;
  previous:RenderObject|undefined;next:RenderObject|undefined;
  private single:RenderObject|undefined;
  private many:Map<RenderObject,ChildEntry>|undefined;
  get size():number{return this.many?.size??(this.single===undefined?0:1);}
  has(child:RenderObject):boolean{return this.many?this.many.has(child):this.single===child;}
  get(child:RenderObject):ChildEntry|undefined{return this.many?this.many.get(child):this.single===child?this:undefined;}
  set(child:RenderObject,previous:RenderObject|undefined,next:RenderObject|undefined):void{
    if(!this.many){
      if(this.single===undefined||this.single===child){this.single=child;this.previous=previous;this.next=next;return;}
      this.many=new Map();this.many.set(this.single,{previous:this.previous,next:this.next});this.single=undefined;this.previous=undefined;this.next=undefined;
    }
    this.many.set(child,{previous,next});
  }
  delete(child:RenderObject):void{if(this.many)this.many.delete(child);else if(this.single===child){this.single=undefined;this.previous=undefined;this.next=undefined;}}
  clear():void{this.many?.clear();this.single=undefined;this.previous=undefined;this.next=undefined;}
}
export interface LayoutOptions {readonly parentUsesSize?:boolean}
let activeLayout:RenderObject|undefined;
const activeLayoutCallbacks:{root:RenderObject;owner:PipelineOwner}[]=[];
const layoutQueries:{readonly render:RenderBox<RenderObject>;readonly key:string}[]=[];
/** Shared render ownership/tree contract. Geometry belongs to RenderBox or a specialized renderer. */
export abstract class RenderObject extends DiagnosticableTreeMixin(class {}) {
  private static readonly paintBoundaryOwners=new Map<Function,{hook:Function;boundary:boolean}>([[Object.getOwnPropertyDescriptor(RenderObject.prototype,'isRepaintBoundary')!.get!,{hook:RenderObject.prototype.retainedPaintInvalidated,boundary:false}]]);
  private static readonly paintOwnerGetter=Object.getOwnPropertyDescriptor(RenderObject.prototype,'owner')!.get;
  private static readonly paintParentGetter=Object.getOwnPropertyDescriptor(RenderObject.prototype,'parent')!.get;
  /** @internal Only constant framework boundary getters and retirement hooks. */
  static _registerPaintInvalidationBoundary(prototype:object):void{
    const getter=Object.getOwnPropertyDescriptor(prototype,'isRepaintBoundary')!.get!,hook=Object.getOwnPropertyDescriptor(prototype,'retainedPaintInvalidated')!.value;
    RenderObject.paintBoundaryOwners.set(getter,{hook,boundary:true});
  }
  private static readonly emptyInputGeometryCommit=RenderObject.prototype.didCommitTextInputGeometry;
  private static readonly emptyInputGeometryGetter=Object.getOwnPropertyDescriptor(RenderObject.prototype,'coreEditingGeometry')!.get;
  /** Actual Source diagnostic mode; it must not populate normal measurement caches. */
  static debugCheckingIntrinsics=false;
  override toStringShort():string{let header=describeIdentity(this);if(!FoundationBuildMode.release){if(this.dead)return header+' DISPOSED';let count=0;for(let node:RenderObject|undefined=this;node&&node.boundary!==true;node=node.parent){if(node.boundary===undefined){count=-1;break;}count++;}if(count>0)header+=' relayoutBoundary=up'+count;if(this.needsLayout)header+=' NEEDS-LAYOUT';if(!this.attached)header+=' DETACHED';}return header;}
  override toString(_o:DiagnosticsStringOptions={}):string{return this.toStringShort();}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new DiagnosticsProperty('parentData',this.parentData??null,{tooltip:this.parentUsesSize?'can use size':null,missingIfNull:true}));properties.add(new DiagnosticsProperty('constraints',this.lastConstraints??null,{missingIfNull:true}));}
  /** The common Nelyx child container uses the source container's numbered child labels. */
  override debugDescribeChildren():readonly DiagnosticsNode[]{return this.children.map((child,index)=>child.toDiagnosticsNode({name:'child '+(index+1)}));}
  private renderParent:RenderObject|undefined;
  private pipelineOwner:PipelineOwner|undefined;
  private renderDepth=0;
  private layoutDirty=true;
  private changingChildren=false;
  private changingAttachment=false;
  private treeTransition=false;
  parentData:ParentData|undefined;
  onPointer:((event:PointerEvent)=>void|boolean)|undefined;
  /** Source render targets override this; the Root bridges onPointer separately. */
  handleEvent(_event:SourcePointerEvent,_entry:SourceHitTestEntry):void{}
  paintVersion=0;
  /** The edge cache has exactly the same lifetime as its render child. */
  private boxTranslation:{x:number;y:number;matrix:TransformMatrix}|undefined;
  /** Local recording changes stop at the nearest boundary; paintVersion still
   * tracks the entire subtree for geometry and raster snapshot validity. */
  paintContentsVersion=0;
  private paintCoalesces=false;
  private paintInvalidationBarrier:RenderObject|undefined;
  private paintInvalidationBoundary:RenderObject|undefined;
  private paintBatch:object|null=null;private paintContentsBatch:object|null=null;
  /** End coalescing before any cache or geometry observer can consume revisions. */
  _finishPaintInvalidationBatch():void{this.pipelineOwner?._finishPaintInvalidationBatch();}
  get isRepaintBoundary():boolean{return false;}
  /** @internal Retained subclasses alone admit their invalid cache owner. */
  protected retainedPaintInvalidated():void{}
  _retireHiddenPaint():void{}
  protected dead=false;
  private lastConstraints:Constraints|undefined;
  private parentUsesSize=false;
  private boundary:boolean|undefined;
  private doingLayout=false;
  private doingLayoutCallback=false;
  private layoutRevision=0;
  private inputGeometryOwnWork=0;
  private inputGeometrySubtreeWork=0;
  private changeInputGeometryWork(delta:number):void{if(delta)for(let node:RenderObject|undefined=this;node;node=node.parent)node.inputGeometrySubtreeWork+=delta;}
  private refreshInputGeometryWork():void{
    let prototype:object|null=this,geometry:PropertyDescriptor|undefined,boundary:PropertyDescriptor|undefined,retirement:PropertyDescriptor|undefined,owner:PropertyDescriptor|undefined,parent:PropertyDescriptor|undefined;
    while(prototype&&(!geometry||!boundary||!retirement||!owner||!parent)){geometry??=Object.getOwnPropertyDescriptor(prototype,'coreEditingGeometry');boundary??=Object.getOwnPropertyDescriptor(prototype,'isRepaintBoundary');retirement??=Object.getOwnPropertyDescriptor(prototype,'retainedPaintInvalidated');owner??=Object.getOwnPropertyDescriptor(prototype,'owner');parent??=Object.getOwnPropertyDescriptor(prototype,'parent');prototype=Object.getPrototypeOf(prototype);}
    const known=boundary?.get&&RenderObject.paintBoundaryOwners.get(boundary.get);
    this.paintCoalesces=!!known&&known.hook===retirement?.value&&owner?.get===RenderObject.paintOwnerGetter&&parent?.get===RenderObject.paintParentGetter;
    this.paintInvalidationBarrier=this.paintCoalesces?this.renderParent?.paintInvalidationBarrier:this;
    this.paintInvalidationBoundary=this.paintCoalesces?(known!.boundary?this:this.renderParent?.paintInvalidationBoundary):undefined;
    // A virtual visitor can filter/reorder/retry children. Keep that branch in
    // the walk even when it has no editor, preserving its callback protocol.
    const work=geometry?.get!==RenderObject.emptyInputGeometryGetter||this.didCommitTextInputGeometry!==RenderObject.emptyInputGeometryCommit||this.visitChildren!==RenderObject.prototype.visitChildren?1:0;
    this.changeInputGeometryWork(work-this.inputGeometryOwnWork);this.inputGeometryOwnWork=work;
  }
  private layoutDependencies:Set<RenderObject>|undefined;
  private layoutDependents:Set<RenderObject>|undefined;
  private childStore:RenderChildStore|undefined;
  private get entries():RenderChildStore{return this.childStore??=new RenderChildStore();}
  get children():readonly RenderObject[]{
    const store=this.childStore;if(!store)return emptyRenderChildren;
    if(!store.snapshot){const children:RenderObject[]=[];for(let child=store.first;child;child=store.get(child)!.next)children.push(child);store.snapshot=children.length?Object.freeze(children):emptyRenderChildren;}return store.snapshot;
  }
  get attached():boolean{return this.owner!==undefined;}
  get parent():RenderObject|undefined{return this.renderParent;}
  get owner():PipelineOwner|undefined{return this.pipelineOwner;}
  get needsLayout():boolean{return this.layoutDirty;}
  get debugDisposed():boolean{return this.dead;}
  get depth():number{return this.renderDepth;}
  get constraints():Constraints{if(!(this.lastConstraints))invariant(false,'missing-constraints','Render object has not received constraints');return this.lastConstraints;}
  get debugNeedsLayout():boolean{return this.needsLayout;}
  get debugDoingThisLayout():boolean{return this.doingLayout;}
  protected get hasLayoutConstraints():boolean{return this.lastConstraints!==undefined;}
  get debugCanParentUseSize():boolean{return this.parentUsesSize;}
  get isRelayoutBoundary():boolean{return this.boundary===true;}
  get sizedByParent():boolean{return false;}
  abstract get paintBounds():Rect;
  layout(constraints:Constraints,options:LayoutOptions={}):void{this.runLayout(constraints,options);}
  /** Invoked only after the clean-layout fast return, without a per-call closure. */
  protected performLayoutInScope(constraints:Constraints):void{if(this.sizedByParent)this.performResize();this.performLayout(constraints);}
  protected performResize():void{throw new Error(`${this.constructor.name} must implement performResize when sizedByParent`);}
  protected performLayout(_constraints:Constraints):unknown{throw new Error(`${this.constructor.name} must implement performLayout`);}
  protected clearCachedLayoutData():void{}
  /** Refresh measured queries and their dependents without requesting wet layout. */
  protected invalidateLayoutMeasurements():void{this.assertCanMutateLayoutProperty();const visited=new Set<RenderObject>(),errors:unknown[]=[],pending:RenderObject[]=[this];while(pending.length){const node=pending.pop()!;if(visited.has(node)||node.dead)continue;visited.add(node);attempt(errors,()=>node.clearCachedLayoutData());if(node.layoutDependents)for(const dependent of node.layoutDependents)pending.push(dependent);}throwFailures(errors,'Measurement cache invalidation failed');}
  /** Layout properties must reject changes before mutating state during measurement or a tree transition. */
  private layoutMutationAllowed():boolean{if(!activeLayout||!this.owner&&!this.parent?.owner)return true;const scope=activeLayoutCallbacks.at(-1);if(!scope||this.owner!==scope.owner)return false;let node:RenderObject|undefined=this;while(node){if(node===scope.root)return true;node=node.parent;}return this.needsLayout&&!this.doingLayout;}
  protected assertCanMutateLayoutProperty():void{assertOutsideRenderPaint();if(!(!this.dead&&(!this.doingLayout||this.doingLayoutCallback)&&this.layoutMutationAllowed()&&!this.changingChildren&&!this.changingAttachment&&!this.treeTransition&&!layoutQueries.length))invariant(false,'invalid-layout-property-update','Cannot update layout properties on a disposed, active or measured render object');}
  /** Rebuild a dirty subtree only inside this live object's active layout. */
  protected invokeLayoutCallback<T extends Constraints>(callback:(constraints:T)=>void):void{assertOutsideRenderPaint();const owner=this.owner;if(!(!this.dead&&this.doingLayout&&!this.doingLayoutCallback&&!layoutQueries.length&&owner&&!owner.debugDisposed))invariant(false,'invalid-layout-callback','Layout callback requires a live attached object performing layout');this.doingLayoutCallback=true;activeLayoutCallbacks.push({root:this,owner});try{callback(this.constraints as T);}finally{activeLayoutCallbacks.pop();this.doingLayoutCallback=false;}}
  protected dependOnLayoutOf(source:RenderObject):void{if(source!==this){(this.layoutDependencies??=new Set()).add(source);(source.layoutDependents??=new Set()).add(this);}}
  protected registerLayoutQuery():void{const caller=layoutQueries.at(-1)?.render??activeLayout;caller?.dependOnLayoutOf(this);}
  private clearLayoutDependencies():void{const dependencies=this.layoutDependencies;if(!dependencies)return;for(const source of dependencies)source.layoutDependents?.delete(this);dependencies.clear();}
  protected runLayout(constraints:Constraints,options:LayoutOptions,perform?:()=>void):void{
    assertOutsideRenderPaint();
    if(!(!this.dead&&!this.doingLayout&&!this.changingChildren&&!this.changingAttachment&&!this.treeTransition))invariant(false,'reentrant-layout','Layout on disposed, active or transitioning render object');if(!(!layoutQueries.length))invariant(false,'wet-layout-during-measurement','Dry/intrinsic measurement cannot invoke wet layout');constraints.debugAssertIsValid({isAppliedConstraint:true});
    this.parentUsesSize=options.parentUsesSize??false;this.boundary=!this.parentUsesSize||this.sizedByParent||constraints.isTight||!this.parent;
    const same=this.lastConstraints!==undefined&&constraints.equals(this.lastConstraints);
    if(!this.needsLayout&&same)return;this.clearCachedLayoutData();this.clearLayoutDependencies();this.lastConstraints=constraints;
    const previous=activeLayout,revision=this.layoutRevision;activeLayout=this;this.doingLayout=true;
    try{if(perform)perform();else this.performLayoutInScope(constraints);this.layoutDirty=this.layoutRevision!==revision;if(this.needsLayout)this.owner?.requestLayout(this);this.markNeedsPaintAfterLayout();}
    catch(error){this.layoutDirty=true;throw error;}finally{activeLayout=previous;this.doingLayout=false;}
  }
  /** Pipeline-only re-layout preserves the parent's size dependency. */
  layoutWithoutResize():void{if(this.lastConstraints)this.layout(this.lastConstraints,{parentUsesSize:this.parentUsesSize});}
  markParentNeedsLayout():void{if(!(this.parent))invariant(false,'missing-render-parent','Parent layout requires a parent');this.markNeedsLayout();if(this.boundary===true)this.parent.markNeedsLayout();}
  markNeedsLayoutForSizedByParentChange():void{if(this.parent)this.markParentNeedsLayout();else this.markNeedsLayout();}
  protected get childCountLimit():number{return Infinity;}
  setupParentData(child:RenderObject):void{if(!(child.parentData instanceof ParentData))child.parentData=new ParentData();}
  private validateChild(child:RenderObject):void{
    if(!(!this.dead&&!child.dead&&!child.treeTransition))invariant(false,'disposed-render-object','Render child is disposed or changing parents');
    // Actual render ancestors share their pipeline, including undefined while
    // detached. A detach hook can observe an ancestor whose owner is already
    // cleared, so that transition still needs the complete cycle check.
    const distinctOwners=this.pipelineOwner!==child.pipelineOwner&&!child.changingAttachment;
    if(!(child!==this&&(distinctOwners||!this.hasAncestor(child))))invariant(false,'render-cycle','Render child would create a cycle');
    if(!(!child.parent||child.parent===this))invariant(false,'render-parent','Render child already has a parent');
    if(!(child.parent===this?child.owner===this.owner:!child.owner))invariant(false,'render-owner','An attached root cannot be adopted; retained children must share their parent pipeline');
  }
  protected adoptChild(child:RenderObject):void{if(!(!child.parent))invariant(false,'render-parent','Adopt requires an unparented child');this.setupParentData(child);child.renderParent=this;this.changeInputGeometryWork(child.inputGeometrySubtreeWork);child.layoutDirty=true;child.boundary=undefined;if(this.owner)attachRenderTree(child,this.owner);this.redepthChild(child);}
  protected dropChild(child:RenderObject):void{if(!(child.parent===this))invariant(false,'render-parent','Drop requires a child of this render object');const errors:unknown[]=[];this.releaseChild(child,errors);throwFailures(errors,'Dropping render child failed');}
  protected redepthChild(child:RenderObject):void{if(!(child.parent===this&&child.owner===this.owner))invariant(false,'render-parent','Redepth requires this parent and pipeline');if(child.renderDepth<=this.renderDepth){child.renderDepth=this.renderDepth+1;child.redepthChildren();}}
  redepthChildren():void{for(const child of this.children)this.redepthChild(child);}
  private releaseChild(child:RenderObject,errors:unknown[],alreadyDetached=false):void{
    attempt(errors,()=>child.parentData?.detach());child.parentData=undefined;if(child.parent===this)this.changeInputGeometryWork(-child.inputGeometrySubtreeWork);child.renderParent=undefined;
    // Source dropChild only detaches an attached child. A retired lazy subtree
    // already completed that transition; tearing down each descendant must not
    // walk/detach the same remaining subtree again. Attach-failure recovery
    // still explicitly invokes detachRenderTree, including before super.attach.
    if(!alreadyDetached&&child.attached)detachRenderTree(child,errors);
  }
  private adoptForMutation(child:RenderObject):void{
    const previous=child.parentData,revision=detachRevisions.get(child)??0;child.treeTransition=true;
    try{this.adoptChild(child);if(!(child.parent===this&&child.owner===this.owner&&child.parentData))invariant(false,'invalid-render-adoption','adoptChild must establish parent data, parent and pipeline');}
    catch(error){const errors=[error];this.releaseChild(child,errors,!child.attached&&(detachRevisions.get(child)??0)!==revision);child.parentData=previous;throwFailures(errors,'Render child adoption failed');}
    finally{child.treeTransition=false;}
  }
  private dropForMutation(child:RenderObject,errors:unknown[]):void{
    child.treeTransition=true;const count=errors.length;
    try{attempt(errors,()=>this.dropChild(child));if(child.parent||child.owner||child.parentData){if(errors.length===count)errors.push(new Error('dropChild must call super.dropChild()'));this.releaseChild(child,errors);}}
    finally{child.treeTransition=false;}
  }
  private mutateChildren(callback:(errors:unknown[])=>void):void{
    assertOutsideRenderPaint();
    if(!(!this.dead&&!this.changingChildren&&!this.changingAttachment&&!this.treeTransition&&(!this.doingLayout||this.doingLayoutCallback)&&this.layoutMutationAllowed()&&!layoutQueries.length))invariant(false,'invalid-render-mutation','Render tree mutation requires an idle object or its authorized layout callback');
    this.changingChildren=true;const errors:unknown[]=[],transition=enterTreeTransition(this.owner);
    try{callback(errors);}catch(error){errors.push(error);}finally{this.changingChildren=false;leaveTreeTransition(transition);}
    throwFailures(errors,'Render child mutation failed');
  }
  private updateSiblings(child:RenderObject|undefined):void{
    if(!child)return;const data=child.parentData,entry=this.entries.get(child);
    if(data instanceof ContainerBoxParentData&&entry){data.previousSibling=entry.previous;data.nextSibling=entry.next;}
    else if(isContainerParentData(data)&&entry){data.previousSibling=entry.previous??null;data.nextSibling=entry.next??null;}
  }
  private unlink(child:RenderObject):void{
    const entry=this.entries.get(child)!;
    if(entry.previous)this.entries.get(entry.previous)!.next=entry.next;else this.entries.first=entry.next;
    if(entry.next)this.entries.get(entry.next)!.previous=entry.previous;else this.entries.last=entry.previous;
    this.updateSiblings(entry.previous);this.updateSiblings(entry.next);
    if(isContainerParentData(child.parentData)){child.parentData.previousSibling=null;child.parentData.nextSibling=null;}
  }
  private linkChild(child:RenderObject,after:RenderObject|undefined):void{
    const next=after?this.entries.get(after)!.next:this.entries.first;
    this.entries.set(child,after,next);
    if(after)this.entries.get(after)!.next=child;else this.entries.first=child;
    if(next)this.entries.get(next)!.previous=child;else this.entries.last=child;
    this.updateSiblings(after);this.updateSiblings(child);this.updateSiblings(next);this.entries.snapshot=undefined;
  }
  insert(child:RenderObject,after?:RenderObject):void{
    this.mutateChildren(errors=>{
    this.validateChild(child);if(!(!child.parent&&!this.entries.has(child)))invariant(false,'duplicate-render-child','Insert requires an unparented child');
    if(!(this.entries.size<this.childCountLimit))invariant(false,'invalid-render-child','Render object child capacity exceeded');
    if(!(!after||this.entries.has(after)))invariant(false,'invalid-render-slot','Previous sibling is not a child');this.adoptForMutation(child);this.linkChild(child,after);attempt(errors,()=>this.markNeedsLayout());});
  }
  move(child:RenderObject,after?:RenderObject):void{
    this.mutateChildren(errors=>{
    if(!(!this.dead&&this.entries.has(child)&&child.parent===this))invariant(false,'invalid-render-child','Move requires an attached child');
    if(!(child!==after&&(!after||this.entries.has(after))))invariant(false,'invalid-render-slot','Move requires a distinct previous sibling in this parent');
    if(this.entries.get(child)!.previous===after)return;this.unlink(child);this.linkChild(child,after);attempt(errors,()=>this.markNeedsLayout());});
  }
  remove(child:RenderObject):void{
    this.mutateChildren(errors=>{
    if(!(!this.dead&&this.entries.has(child)&&child.parent===this))invariant(false,'invalid-render-child','Remove requires a child of this parent');
    this.unlink(child);this.entries.delete(child);this.entries.snapshot=undefined;this.dropForMutation(child,errors);attempt(errors,()=>this.markNeedsLayout());});
  }
  setChildren(values:readonly RenderObject[]):void {
    this.mutateChildren(errors=>{const children=[...values];
    if(!(!this.dead))invariant(false,'disposed-render-object','Mutating a disposed render object');
    if(!(children.length<=this.childCountLimit))invariant(false,'invalid-render-child','Render object child capacity exceeded');
    const childSet=children.length>1?new Set(children):undefined;if(!(childSet===undefined||childSet.size===children.length))invariant(false,'duplicate-render-child','Render child attached twice');
    for(const child of children)this.validateChild(child);
    const previous=this.children;if(children.length===previous.length&&children.every((child,index)=>child===previous[index]))return;
    let added:RenderObject[]|undefined,data:Map<RenderObject,ParentData|undefined>|undefined;
    try{for(const child of children)if(child.parent!==this){(data??=new Map()).set(child,child.parentData);this.adoptForMutation(child);(added??=[]).push(child);}}
    catch(error){errors.push(error);if(added)for(const child of added.reverse()){this.dropForMutation(child,errors);child.parentData=data!.get(child);}return;}
    this.entries.clear();this.entries.first=children[0];this.entries.last=children.at(-1);
    for(let index=0;index<children.length;index++)this.entries.set(children[index]!,children[index-1],children[index+1]);
    for(const child of children)this.updateSiblings(child);this.entries.snapshot=Object.freeze(children);
    for(const child of previous)if(childSet?!childSet.has(child):child!==children[0]){if(isContainerParentData(child.parentData)){child.parentData.previousSibling=null;child.parentData.nextSibling=null;}this.dropForMutation(child,errors);}attempt(errors,()=>this.markNeedsLayout());});
  }
  visitChildren(visitor:(child:RenderObject)=>void):void{const children=this.children;for(let i=0;i<children.length;i++)visitor(children[i]!);}
  /** Source paint-visibility hook, specialized by Offstage, opacity and slivers. */
  paintsChild(child:RenderObject):boolean{if(!(child.parent===this))invariant(false,'invalid-paints-child','Paint visibility requires a direct child');return true;}
  /** Overlay theaters retain covered subtrees without scheduling their layout.
   * Ordinary Offstage still lays out its child for explicit measurement. */
  laysOutChild(_child:RenderObject):boolean{return true;}
  get layoutSuppressedByAncestor():boolean{let child:RenderObject=this;for(let parent=this.parent;parent;child=parent,parent=parent.parent)if(!parent.laysOutChild(child))return true;return false;}
  private hasAncestor(candidate:RenderObject):boolean {let ancestor=this.parent;while(ancestor){if(ancestor===candidate)return true;ancestor=ancestor.parent;}return false;}
  attach(owner:PipelineOwner):void {
    assertOutsideRenderPaint();
    if(!(!this.dead&&!owner.debugDisposed&&!this.changingAttachment&&!layoutQueries.length&&(!this.owner||this.owner===owner)&&(!this.parent||this.parent.owner===owner)))invariant(false,'invalid-render-owner','Render object or pipeline is disposed, active or has incompatible ownership');if(this.owner===owner)return;
    this.changingAttachment=true;const transition=enterTreeTransition(owner);this.pipelineOwner=owner;this.layoutDirty=true;this.boundary=undefined;committedInputGeometries.delete(this);
    try{this.refreshInputGeometryWork();this.clearCachedLayoutData();for(const child of this.children)attachRenderTree(child,owner);if(owner.semanticsOwner){
      // New fragments follow the parent's structural commit. Reattached
      // fragments join that same commit without evaluating user annotations
      // while the render tree is still being attached.
      if(existingSemanticsFor(this))this.markNeedsSemanticsUpdate();
    }}
    catch(error){const errors=[error];this.changingAttachment=false;detachRenderTree(this,errors);throwFailures(errors,'Attaching render tree failed');}
    finally{this.changingAttachment=false;leaveTreeTransition(transition);}
  }
  detach():void {
    assertOutsideRenderPaint();
    if(!(!this.changingAttachment&&!layoutQueries.length&&(!this.parent?.owner||recoveringDetach.has(this))))invariant(false,'invalid-render-owner','Detach the parent before its child; attachment and measurement must be idle');
    this.changingAttachment=true;detachRevisions.set(this,(detachRevisions.get(this)??0)+1);const owner=this.owner,errors:unknown[]=[],transition=enterTreeTransition(owner);this.pipelineOwner=undefined;this.paintCoalesces=false;this.paintInvalidationBarrier=this.paintInvalidationBoundary=undefined;this.paintBatch=this.paintContentsBatch=null;this.boundary=undefined;this.layoutDirty=true;committedInputGeometries.delete(this);layoutQueues.get(owner!)?.delete(this);layoutCallbackQueues.get(owner!)?.delete(this);
    if(owner)existingPipelineSemantics(owner)?.detached(this);
    try{attempt(errors,()=>this.clearCachedLayoutData());this.clearLayoutDependencies();if(this.layoutDependents)for(const dependent of [...this.layoutDependents])attempt(errors,()=>dependent.markNeedsLayout());this.layoutDependents?.clear();for(const child of this.children)detachRenderTree(child,errors);}
    finally{this.changingAttachment=false;leaveTreeTransition(transition);}throwFailures(errors,'Detaching render tree failed');
  }
  private invalidateLayout(visited:Set<RenderObject>|undefined,errors:unknown[]|undefined):unknown[]|undefined{
    if(visited?.has(this))return errors;visited?.add(this);if(this.dead){(errors??=[]).push(new Error('Layout dependency refers to a disposed render object'));return errors;}
    if(this.doingLayoutCallback){try{this.clearCachedLayoutData();}catch(error){(errors??=[]).push(error);}return errors;}
    const wasDirty=this.layoutDirty;this.layoutDirty=true;this.layoutRevision++;this.paintVersion++;
    try{this.clearCachedLayoutData();}catch(error){(errors??=[]).push(error);}this.clearLayoutDependencies();
    if(this.layoutDependents)for(const dependent of [...this.layoutDependents]){
      // A lone dirty leaf (or an active layout callback) needs no visit table.
      // The first traversed edge must include this root before any backedge.
      if(!visited){visited=new Set();visited.add(this);}errors=dependent.invalidateLayout(visited,errors);
    }
    if(this.parent&&this.boundary!==true){
      // The first invalidation already scheduled the size-dependent ancestor
      // chain. Wheel bursts and multi-property Widget updates can invalidate a
      // child repeatedly before layout; do not walk that chain for every input.
      // Query dependents above are still refreshed even while dirty. Active
      // layout and a clean parent must also observe a subsequent invalidation.
      if(!wasDirty||this.doingLayout||!this.parent.needsLayout){if(!visited){visited=new Set();visited.add(this);}errors=this.parent.invalidateLayout(visited,errors);}
    }else if(this.owner&&!this.owner.debugDisposed){try{this.owner!.requestLayout(this);}catch(error){(errors??=[]).push(error);}}
    return errors;
  }
  markNeedsLayout():void {assertOutsideRenderPaint();if(!(!this.dead&&!layoutQueries.length))invariant(false,'render-mutation-during-measurement','Disposed objects and measurements cannot invalidate layout');const errors=this.invalidateLayout(undefined,undefined);if(errors)throwFailures(errors,'Layout invalidation failed');}
  markNeedsPaint():void {this.invalidatePaint(true);}
  /** A delegate repaint signal changes pixels; its semantic contract is separate. */
  protected markNeedsPaintOnly():void {this.invalidatePaint(false);}
  protected markNeedsPaintAfterLayout():void{this.geometryLayoutChildren=undefined;this.markNeedsPaint();}
  private geometryLayoutChildren:readonly RenderObject[]|undefined;
  /** Static semantic configurations may keep their cache when only layout
   * geometry changes. A changed semantic child list still rebuilds the tree. */
  protected markNeedsPaintAfterGeometryLayout():void{
    const children:RenderObject[]=[];this.visitChildrenForSemantics(child=>children.push(child));const previous=this.geometryLayoutChildren;this.geometryLayoutChildren=children;
    if(previous&&previous.length===children.length&&children.every((child,index)=>child===previous[index]))this.markNeedsPaintAfterGeometryChange();
    else this.markNeedsPaint();
  }
  /** A transform keeps child membership and configuration, but changes the
   * visible semantic geometry of its complete descendant subtree. */
  protected markNeedsPaintAfterGeometryChange():void{
    const state=existingSemanticsFor(this),owner=this.owner;
    if(owner?.semanticsOwner&&state&&!state.parentDataDirty){state.geometry=null;pipelineSemantics(owner).offsetChanged(this);this.markNeedsPaintOnly();}
    else this.markNeedsPaint();
  }
  private invalidatePaint(updateSemantics:boolean):void {
    if(!(!this.dead&&!layoutQueries.length))invariant(false,'render-mutation-during-measurement','Disposed objects and measurements cannot invalidate paint');let owner:PipelineOwner|undefined,contents=true;
    let batch=this.paintCoalesces?this.pipelineOwner?._paintInvalidationBatch:null;
    if(batch)owner=this.pipelineOwner;
    try{for(let node:RenderObject|undefined=this;node;){
      if(batch&&node.paintCoalesces){
        if(node.paintBatch===batch&&(!contents||node.paintContentsBatch===batch)){
          // This pure prefix already reached its boundary in this transaction.
          // Resume at the first custom ancestor so virtual getters/hooks still
          // run in their original order, including repeated invalidations.
          if(contents&&node.paintInvalidationBoundary)contents=false;
          node=node.paintInvalidationBarrier;batch=null;continue;
        }
        if(node.paintBatch!==batch)node.paintVersion++;
        if(contents&&node.paintContentsBatch!==batch){node.paintContentsVersion++;if(node.paintInvalidationBoundary===node)node.retainedPaintInvalidated();node.paintContentsBatch=batch;}
        node.paintBatch=batch;if(node.paintInvalidationBoundary===node)contents=false;node=node.renderParent;
      }else{
        batch=null;node.paintVersion++;if(contents)node.paintContentsVersion++;if(node.isRepaintBoundary){if(contents)node.retainedPaintInvalidated();contents=false;}if(!owner&&node.owner&&!node.owner.debugDisposed)owner=node.owner;node=node.parent;
      }
    }}catch(error){this.pipelineOwner?._finishPaintInvalidationBatch();throw error;}
    // Successful invalidations need no error array or per-node closures. Keep
    // collecting failures only when a hook actually throws, without skipping
    // the host wakeup or changing its bare callback receiver/getter ordering.
    let errors:unknown[]|undefined;
    if(updateSemantics&&this.owner?.semanticsOwner)try{RenderObject.prototype.markNeedsSemanticsUpdate.call(this);}catch(error){errors=[error];}
    if(owner){const callback=owner.invalidate;try{callback();}catch(error){(errors??=[]).push(error);}}
    if(errors)throwFailures(errors,'Paint invalidation failed');
  }
  private invalidationOwner():PipelineOwner|undefined{
    // Adoption/attachment require one PipelineOwner throughout a render parent
    // chain. Child pipeline roots are separate render trees. During attachment
    // a child without its own owner can still invalidate its attached parent.
    for(let node:RenderObject|undefined=this;node;node=node.parent){const owner=node.owner;if(owner&&!owner.debugDisposed)return owner;}
    return undefined;
  }
  /** The host collects semantics on the next frame, independently of paint caches. */
  markNeedsSemanticsUpdate():void{this.invalidateSemantics(false);}
  /** Stored scroll extents change with layout, while labels and action availability stay fixed. */
  protected markNeedsSemanticsGeometryUpdate():void{this.invalidateSemantics(true);}
  private invalidateSemantics(geometryOnly:boolean):void{if(this.owner?.accessibilityEnabled===false)return;if(!(!this.dead&&!layoutQueries.length))invariant(false,'render-mutation-during-measurement','Disposed objects and measurements cannot invalidate semantics');if(FoundationBuildMode.debug){if(!(!this.owner?.debugDoingSemantics))invariant(false,'semantics-mutation-during-flush','Cannot invalidate semantics during its flush');}if(this.owner?.semanticsOwner)pipelineSemantics(this.owner).requestUpdate(this,geometryOnly);else existingSemanticsFor(this)?.clear();const owner=this.invalidationOwner();if(owner){const callback=owner.invalidate;callback();}}
  get localTransform():TransformMatrix {return identity;}
  get isDisplayed():boolean{return this.parent?.isDisplayed??true;}
  get clips():boolean {return false;}
  protected childTransform(child:RenderObject):TransformMatrix {
    const offset=child.parentData instanceof BoxParentData?child.parentData.offset:{x:0,y:0},local=child.localTransform;
    if(local!==identity)return multiply(translate(offset.x,offset.y),local);
    const x=offset.x,y=offset.y;if(!Number.isFinite(x)||!Number.isFinite(y))return multiply(translate(x,y),local);
    const cached=child.boxTranslation;
    if(cached&&Object.is(cached.x,x)&&Object.is(cached.y,y))return cached.matrix;
    // The identity product only normalizes signed zero in the offsets. Avoid
    // two temporary affine arrays while retaining that exact IEEE result.
    const matrix=captureTransform([1,0,0,1,0+x,0+y]);child.boxTranslation={x,y,matrix};return matrix;
  }
  /** Compose complete paint transforms, including sibling coordinate conversion within one tree. */
  getTransformTo(target:RenderObject|null=null):Matrix4Storage {
    if(target===this)return matrix4Identity;
    let from:RenderObject=this,fromMatrix:TransformMatrix=identity;
    if(!target){while(from.parent){fromMatrix=multiply(from.parent.childTransform(from),fromMatrix);from=from.parent;}return fullTransform(multiply(from.localTransform,fromMatrix));}
    // Stop at the common ancestor. Transforms above it cancel and must not
    // make a local conversion singular, nor be recomputed for every child.
    // Render depths increase along each branch; reparenting may leave gaps.
    let to=target,toMatrix:TransformMatrix=identity;
    while(from!==to){
      const fromDepth=from.renderDepth,toDepth=to.renderDepth;
      if(fromDepth>=toDepth){const parent=from.parent;if(!(parent))invariant(false,'unrelated-render-transform','Render transform targets must share a render tree');fromMatrix=multiply(parent.childTransform(from),fromMatrix);from=parent;}
      if(fromDepth<=toDepth){const parent=to.parent;if(!(parent))invariant(false,'unrelated-render-transform','Render transform targets must share a render tree');toMatrix=multiply(parent.childTransform(to),toMatrix);to=parent;}
    }
    if(to===target)return fullTransform(fromMatrix);
    const inverse=inverseMatrix4(fullTransform(toMatrix));return inverse?multiplyMatrix4(inverse,fullTransform(fromMatrix)):captureMatrix4(Array(16).fill(0));
  }
  /** Ask scroll ancestors to reveal measured local geometry. */
  showOnScreen(rect:Rect=this.paintBounds,options:ShowOnScreenOptions={}):void {if(this.parent)this.parent.showOnScreen(bounds(multiply(this.parent.childTransform(this),translate(rect.x,rect.y)),{width:rect.width,height:rect.height}),{...options,descendant:options.descendant??this,targetRect:options.targetRect??rect});}
  paint(context:PaintingContext):void {for(const child of this.children)this.paintChild(context,child);}
  protected paintChild(context:PaintingContext,child:RenderObject):void {context.paintChild(child,this.childTransform(child));}
  abstract collectSemantics(output:SemanticsNode[],matrix?:TransformMatrix,clip?:Rect):void;
  /** Source annotation hook. The existing transport collector remains an adapter. */
  scheduleInitialSemantics():void{if(this.owner?.accessibilityEnabled===false)return;const owner=this.owner;if(!(owner!==undefined))invariant(false,'detached-initial-semantics','Initial semantics requires an attached render object');const state=semanticsFor(this);if(FoundationBuildMode.debug){if(!(!this.dead&&!this.parent&&!owner.debugDoingSemantics&&(state.parentDataDirty||!state.built)&&owner.semanticsOwner!==null))invariant(false,'invalid-initial-semantics','Initial semantics requires an unbuilt root and enabled owner');}const pipeline=pipelineSemantics(owner);pipeline.dirty.add(this);pipeline.geometryDirty.add(this);owner.requestVisualUpdate();}
  sendSemanticsEvent(event:SemanticsEvent):void{if(!(this.owner!==undefined))invariant(false,'detached-semantics-event','Semantics events require an attached render object');if(this.owner.semanticsOwner===null)return;const node=existingSemanticsFor(this)?.cachedSemanticsNode;if(node!==null&&node!==undefined&&!node.isMergedIntoParent)node.sendEvent(event);else this.parent?.sendSemanticsEvent(event);}
  get debugNeedsSemanticsUpdate():boolean{return this.owner?.accessibilityEnabled!==false&&!FoundationBuildMode.release&&semanticsFor(this).parentDataDirty;}
  get debugSemantics():SourceSemanticsNode|null{const state=existingSemanticsFor(this);return !FoundationBuildMode.release&&state?.built?state.cachedSemanticsNode:null;}
  describeSemanticsConfiguration(_config:SemanticsConfiguration):void{}
  /** Existing host control identity is transported independently of source node ids. */
  get semanticsTransport():SemanticsTransportProperties|null{return null;}
  get coreEditingGeometry():CoreEditingGeometry|null{return null;}
  get coreTextNavigation():SemanticsTextNavigation|null{return null;}
  get coreTextParagraph():SemanticsTextParagraph|null{return null;}
  /** Record OS input coordinates once after the complete Core render tree paints. */
  commitTextInputGeometries(frame:{readonly owner:ViewOwner;readonly metrics:ViewMetrics}):{readonly token:object;readonly hasInputGeometry:boolean;commit():void;discard():void} {
    this._finishPaintInvalidationBatch();
    const root=this,paintVersion=this.paintVersion,scope:InputGeometryScope={token:{},committed:false,aborted:false},notifications:RenderObject[]=[];let hasInputGeometry=false,parentDisplayed=true;
    // Keep provider-only locals out of the per-node recursive activation.
    const updateGeometry=(render:RenderObject,core:CoreEditingGeometry|null,previous:CommittedInputGeometry|undefined):void=>{
      hasInputGeometry=true;
      let visible=core!==null;
      if(visible)for(let node:RenderObject|undefined=render;node;node=node.parent)if(!node.isDisplayed){visible=false;break;}
      const captured=core&&visible?captureInputGeometry(render,core,frame,previous):undefined;
      if(captured)committedInputGeometries.set(render,{scope,root,paintVersion,...captured});
      else committedInputGeometries.delete(render);
    };
    const visit=(render:RenderObject):void=>{
      if(render.attached&&render.inputGeometrySubtreeWork===0)return;
      const previous=committedInputGeometries.get(render),before=parentDisplayed;
      parentDisplayed=parentDisplayed&&render.attached&&!render.needsLayout;
      try{
        const core=parentDisplayed?render.coreEditingGeometry:null;
        if(core!==null||previous!==undefined)updateGeometry(render,core,previous);
        else committedInputGeometries.delete(render);
        if(render.didCommitTextInputGeometry!==RenderObject.emptyInputGeometryCommit)notifications.push(render);
        render.visitChildren(visit);
      }finally{parentDisplayed=before;}
    };
    visit(this);
    const notify=()=>{const errors:unknown[]=[];for(const render of notifications)attempt(errors,()=>render.didCommitTextInputGeometry());throwFailures(errors,'Input geometry publication failed');};
    return {token:scope.token,hasInputGeometry,commit(){if(scope.aborted)return;scope.committed=true;notify();},discard(){if(scope.aborted)return;scope.aborted=true;scope.committed=false;notify();}};
  }
  /** Dirty paint/layout and a different View/viewport cannot reuse recorded OS coordinates. */
  readTextInputGeometry(owner:ViewOwner,metrics:ViewMetrics,pendingFrameToken?:object):TextInputGeometry|null {
    const committed=committedInputGeometries.get(this),value=committed?.value;
    if(!committed||!value||committed.scope.aborted||!committed.scope.committed&&committed.scope.token!==pendingFrameToken||!this.attached||this.needsLayout||!this.isDisplayed||committed.root.paintVersion!==committed.paintVersion||
      value.owner.id!==owner.id||value.owner.generation!==owner.generation||value.viewportGeneration!==metrics.viewportGeneration||value.nativeSurfaceGeneration!==(metrics.nativeSurfaceGeneration??undefined)||value.scale!==metrics.scale)return null;
    for(let parent=this.parent;parent;parent=parent.parent)if(parent.needsLayout||!parent.isDisplayed)return null;
    return value;
  }
  protected didCommitTextInputGeometry():void {}
  protected get hasSourceSemanticsConfiguration():boolean{return false;}
  get semanticBounds():Rect{return this.paintBounds;}
  visitChildrenForSemantics(visitor:(child:RenderObject)=>void):void{this.visitChildren(visitor);}
  describeApproximatePaintClip(_child:RenderObject):Rect|null{return this.clips?this.semanticBounds:null;}
  describeSemanticsClip(_child:RenderObject|null):Rect|null{return null;}
  applyPaintTransform(child:RenderObject,matrix:SourceMatrix4):void{
    if(!(child.parent===this))invariant(false,'invalid-paint-transform-child','Paint transform requires a direct child');const transform=this.childTransform(child);
    // Ordinary box edges only translate. Use the source translation operation
    // directly instead of allocating, validating and multiplying a second 4x4.
    if(transform.length===6&&transform[0]===1&&transform[1]===0&&transform[2]===0&&transform[3]===1)matrix.translateByDouble(transform[4],transform[5],0,1);
    else matrix.multiply(SourceMatrix4.fromList(fullTransform(transform)));
  }
  assembleSemanticsNode(node:SourceSemanticsNode,config:SemanticsConfiguration,children:SourceSemanticsNode[]):void{node.updateWith({config,childrenInInversePaintOrder:children});}
  /** Source child walk; View-owned semantic attachment is cleared by its pipeline. */
  clearSemantics():void{existingSemanticsFor(this)?.clear();for(const child of this.children)child.clearSemantics();}
  dispose():void {assertOutsideRenderPaint();if(this.dead)return;if(!(!this.parent&&!this.owner&&!this.changingChildren&&!this.changingAttachment&&!this.treeTransition&&!layoutQueries.length))invariant(false,'attached-render-dispose','Dispose requires an idle detached render object');const errors:unknown[]=[];attempt(errors,()=>this.clearSemantics());attempt(errors,()=>RenderObject.prototype.setChildren.call(this,[]));attempt(errors,()=>this.clearCachedLayoutData());this.clearLayoutDependencies();if(this.layoutDependents)for(const dependent of [...this.layoutDependents])attempt(errors,()=>dependent.markNeedsLayout());this.layoutDependents?.clear();this.dead=true;this.onPointer=undefined;this.geometryLayoutChildren=undefined;throwFailures(errors,'Render object teardown failed');}
}
export type RenderObjectConstructor=abstract new (...args:any[])=>RenderObject;
export type SystemFontsRelayoutConstructor<Base extends RenderObjectConstructor>=abstract new (...args:ConstructorParameters<Base>)=>InstanceType<Base>&{systemFontsDidChange():void};
/** Pinned RelayoutWhenSystemFontsChangeMixin with explicit app/View ownership. */
export function RelayoutWhenSystemFontsChangeMixin<Base extends RenderObjectConstructor>(Base:Base):SystemFontsRelayoutConstructor<Base>{
  abstract class SystemFontsRelayoutRenderObject extends Base {
    private fontScope:SystemFontsRelayoutContext|null=null;
    private fontClosing:Disposable|undefined;
    private pendingFonts:{scope:SystemFontsRelayoutContext;id?:number}|null=null;
    constructor(...args:any[]){super(...args);}
    systemFontsDidChange():void{this.markNeedsLayout();}
    private readonly scheduleSystemFontsUpdate=():void=>{
      if(this.pendingFonts)return;const scope=this.fontScope;if(!scope||scope.scheduler.disposed)return;
      const pending={scope} as {scope:SystemFontsRelayoutContext;id?:number};this.pendingFonts=pending;
      try{pending.id=scope.scheduler.scheduleFrameCallback(()=>{
        if(this.pendingFonts!==pending)return;this.pendingFonts=null;
        if(FoundationBuildMode.debug){if(!(this.attached||this.debugDisposed))invariant(false,'detached-font-update','System font callback requires an attached or disposed render object');}
        if(this.attached&&this.fontScope===scope)this.systemFontsDidChange();
      });}catch(error){if(this.pendingFonts===pending)this.pendingFonts=null;throw error;}
    };
    private cancelFontsUpdate():void{const pending=this.pendingFonts;this.pendingFonts=null;if(pending?.id!==undefined)pending.scope.scheduler.cancelFrameCallbackWithId(pending.id);}
    private removeFontsListener():void{const scope=this.fontScope;this.fontScope=null;const closing=this.fontClosing;this.fontClosing=undefined;try{scope?.systemFonts.removeListener(this.scheduleSystemFontsUpdate);}finally{closing?.dispose();}}
    override attach(owner:PipelineOwner):void{
      super.attach(owner);
      // Source has one scheduler. A transfer between explicit View owners must
      // not keep a callback owned by the previous (possibly stopped) View.
      if(this.pendingFonts&&this.pendingFonts.scope!==owner.systemFonts)this.cancelFontsUpdate();
      if(FoundationBuildMode.debug){if(!(this.pendingFonts===null))invariant(false,'pending-font-attach','Attach must not have a pending system font callback');}
      if(this.fontScope===owner.systemFonts)return;this.removeFontsListener();const scope=owner.systemFonts;
      if(scope){this.fontScope=scope;scope.systemFonts.addListener(this.scheduleSystemFontsUpdate);this.fontClosing=scope.scheduler.observeDispose(()=>{this.cancelFontsUpdate();this.removeFontsListener();});}
    }
    override detach():void{
      if(this.fontScope?.scheduler.disposed||this.owner?.debugDisposed)this.cancelFontsUpdate();
      if(FoundationBuildMode.debug){if(!(this.pendingFonts===null))invariant(false,'pending-font-detach','Detach must not have a pending system font callback');}
      this.removeFontsListener();super.detach();
    }
    protected override clearCachedLayoutData():void{
      super.clearCachedLayoutData();
      // RenderObject's failure recovery can call its base detach directly.
      if(!this.attached&&this.fontScope){this.cancelFontsUpdate();this.removeFontsListener();}
    }
    override dispose():void{try{super.dispose();}finally{if(this.debugDisposed){this.cancelFontsUpdate();this.removeFontsListener();}}}
  }
  return SystemFontsRelayoutRenderObject as unknown as SystemFontsRelayoutConstructor<Base>;
}
export interface SemanticsAnnotationsOptions {readonly properties:SemanticsProperties;readonly container:boolean;readonly explicitChildNodes:boolean;readonly excludeSemantics:boolean;readonly blockUserActions:boolean;readonly localeForSubtree:Locale|null;readonly textDirection:'ltr'|'rtl'|null;}
export interface SemanticsAnnotations {properties:SemanticsProperties;container:boolean;explicitChildNodes:boolean;excludeSemantics:boolean;blockUserActions:boolean;localeForSubtree:Locale|null;textDirection:'ltr'|'rtl'|null;initSemanticsAnnotations(options:SemanticsAnnotationsOptions):void}
export type SemanticsAnnotationsConstructor<Base extends RenderObjectConstructor>=abstract new (...args:ConstructorParameters<Base>)=>InstanceType<Base>&SemanticsAnnotations;
// Most annotations have no actions. Keep the render instance below the small
// object field limit and create only the stable wrappers actually requested.
class SemanticsAnnotationHandlers {
  onTap:SemanticsProperties['onTap']=null;
  onLongPress:SemanticsProperties['onLongPress']=null;
  onDismiss:SemanticsProperties['onDismiss']=null;
  onScrollLeft:SemanticsProperties['onScrollLeft']=null;
  onScrollRight:SemanticsProperties['onScrollRight']=null;
  onScrollUp:SemanticsProperties['onScrollUp']=null;
  onScrollDown:SemanticsProperties['onScrollDown']=null;
  onIncrease:SemanticsProperties['onIncrease']=null;
  onDecrease:SemanticsProperties['onDecrease']=null;
  onCopy:SemanticsProperties['onCopy']=null;
  onCut:SemanticsProperties['onCut']=null;
  onPaste:SemanticsProperties['onPaste']=null;
  onMoveCursorForwardByCharacter:SemanticsProperties['onMoveCursorForwardByCharacter']=null;
  onMoveCursorBackwardByCharacter:SemanticsProperties['onMoveCursorBackwardByCharacter']=null;
  onMoveCursorForwardByWord:SemanticsProperties['onMoveCursorForwardByWord']=null;
  onMoveCursorBackwardByWord:SemanticsProperties['onMoveCursorBackwardByWord']=null;
  onSetSelection:SemanticsProperties['onSetSelection']=null;
  onSetText:SemanticsProperties['onSetText']=null;
  onDidGainAccessibilityFocus:SemanticsProperties['onDidGainAccessibilityFocus']=null;
  onDidLoseAccessibilityFocus:SemanticsProperties['onDidLoseAccessibilityFocus']=null;
  onFocus:SemanticsProperties['onFocus']=null;
  onExpand:SemanticsProperties['onExpand']=null;
  onCollapse:SemanticsProperties['onCollapse']=null;
}
/** Pinned source annotations, with stable handlers that read the current properties. */
export function SemanticsAnnotationsMixin<Base extends RenderObjectConstructor>(Base:Base):SemanticsAnnotationsConstructor<Base>{
  abstract class AnnotatedRenderObject extends Base {
    constructor(...args:any[]){super(...args);}
    private _properties!:SemanticsProperties;
    private _container!:boolean;
    private _explicitChildNodes!:boolean;
    private _excludeSemantics!:boolean;
    private _blockUserActions!:boolean;
    private _localeForSubtree!:Locale|null;
    private _textDirection!:'ltr'|'rtl'|null;
    private _handlers:SemanticsAnnotationHandlers|null=null;
    initSemanticsAnnotations(options:SemanticsAnnotationsOptions):void{this._properties=options.properties;this._container=options.container;this._explicitChildNodes=options.explicitChildNodes;this._excludeSemantics=options.excludeSemantics;this._blockUserActions=options.blockUserActions;this._localeForSubtree=options.localeForSubtree;this._textDirection=options.textDirection;}
    get properties():SemanticsProperties{return this._properties;}
    set properties(value:SemanticsProperties){if(this._properties===value)return;this._properties=value;this.markNeedsSemanticsUpdate();}
    get container():boolean{return this._container;}
    set container(value:boolean){if(this._container===value)return;this._container=value;this.markNeedsSemanticsUpdate();}
    get explicitChildNodes():boolean{return this._explicitChildNodes;}
    set explicitChildNodes(value:boolean){if(this._explicitChildNodes===value)return;this._explicitChildNodes=value;this.markNeedsSemanticsUpdate();}
    get excludeSemantics():boolean{return this._excludeSemantics;}
    set excludeSemantics(value:boolean){if(this._excludeSemantics===value)return;this._excludeSemantics=value;this.markNeedsSemanticsUpdate();}
    get blockUserActions():boolean{return this._blockUserActions;}
    set blockUserActions(value:boolean){if(this._blockUserActions===value)return;this._blockUserActions=value;this.markNeedsSemanticsUpdate();}
    get localeForSubtree():Locale|null{return this._localeForSubtree;}
    set localeForSubtree(value:Locale|null){if(valueEquals(this._localeForSubtree,value))return;this._localeForSubtree=value;this.markNeedsSemanticsUpdate();}
    get textDirection():'ltr'|'rtl'|null{return this._textDirection;}
    set textDirection(value:'ltr'|'rtl'|null){if(this._textDirection===value)return;this._textDirection=value;this.markNeedsSemanticsUpdate();}
    private attributedProperties:SemanticsProperties|null=null;
    private _attributedLabel:AttributedString|null=null;
    private _attributedValue:AttributedString|null=null;
    private _attributedIncreasedValue:AttributedString|null=null;
    private _attributedDecreasedValue:AttributedString|null=null;
    private _attributedHint:AttributedString|null=null;
    private updateAttributedFields(value:SemanticsProperties):void{
      this._attributedLabel=value.attributedLabel??(value.label===null?null:new AttributedString(value.label!));
      this._attributedValue=value.attributedValue??(value.value===null?null:new AttributedString(value.value!));
      this._attributedIncreasedValue=value.attributedIncreasedValue??(value.increasedValue===null?null:new AttributedString(value.increasedValue!));
      this._attributedDecreasedValue=this.properties.attributedDecreasedValue??(value.decreasedValue===null?null:new AttributedString(value.decreasedValue!));
      this._attributedHint=value.attributedHint??(value.hint===null?null:new AttributedString(value.hint!));
    }
    override visitChildrenForSemantics(visitor:(child:RenderObject)=>void):void{if(!this.excludeSemantics)super.visitChildrenForSemantics(visitor);}
    override describeSemanticsConfiguration(config:SemanticsConfiguration):void{
      if(this.attributedProperties!==this._properties){this.updateAttributedFields(this._properties);this.attributedProperties=this._properties;}
      super.describeSemanticsConfiguration(config);config.isSemanticBoundary=this.container||this._properties.identifier!==null;config.explicitChildNodes=this.explicitChildNodes;config.isBlockingUserActions=this.blockUserActions;if(this.localeForSubtree!==null)config.localeForSubtree=this.localeForSubtree;
      if(FoundationBuildMode.debug){if(!(!(this._properties.scopesRoute??false)||this.explicitChildNodes))invariant(false,'route-requires-explicit-semantics','explicitChildNodes must be set to true if scopes route is true');if(!(!((this._properties.toggled??false)&&(this._properties.checked??false))))invariant(false,'conflicting-toggle-check','A semantics node cannot be toggled and checked at the same time');}
    if (this._properties.enabled != null) {
      config.isEnabled = this._properties.enabled;
    }
    if (this._properties.checked != null) {
      config.isChecked = this._properties.checked;
    }
    if (this._properties.mixed != null) {
      config.isCheckStateMixed = this._properties.mixed;
    }
    if (this._properties.toggled != null) {
      config.isToggled = this._properties.toggled;
    }
    if (this._properties.selected != null) {
      config.isSelected = this._properties.selected!;
    }
    if (this._properties.button != null) {
      config.isButton = this._properties.button!;
    }
    if (this._properties.expanded != null) {
      config.isExpanded = this._properties.expanded;
    }
    if (this._properties.link != null) {
      config.isLink = this._properties.link!;
    }
    if (this._properties.linkUrl != null) {
      config.linkUrl = this._properties.linkUrl;
    }
    if (this._properties.slider != null) {
      config.isSlider = this._properties.slider!;
    }
    if (this._properties.keyboardKey != null) {
      config.isKeyboardKey = this._properties.keyboardKey!;
    }
    if (this._properties.header != null) {
      config.isHeader = this._properties.header!;
    }
    if (this._properties.headingLevel != null) {
      config.headingLevel = this._properties.headingLevel!;
    }
    if (this._properties.textField != null) {
      config.isTextField = this._properties.textField!;
    }
    if (this._properties.readOnly != null) {
      config.isReadOnly = this._properties.readOnly!;
    }
    if (this._properties.focusable != null) {
      config.isFocusable = this._properties.focusable!;
    }
    if (this._properties.focused != null) {
      config.isFocused = this._properties.focused;
    }
    if (this._properties.accessibilityFocusBlockType != null) {
      config.accessibilityFocusBlockType = this._properties.accessibilityFocusBlockType!;
    }
    if (this._properties.inMutuallyExclusiveGroup != null) {
      config.isInMutuallyExclusiveGroup = this._properties.inMutuallyExclusiveGroup!;
    }
    if (this._properties.obscured != null) {
      config.isObscured = this._properties.obscured!;
    }
    if (this._properties.multiline != null) {
      config.isMultiline = this._properties.multiline!;
    }
    if (this._properties.hidden != null) {
      config.isHidden = this._properties.hidden!;
    }
    if (this._properties.image != null) {
      config.isImage = this._properties.image!;
    }
    if (this._properties.isRequired != null) {
      config.isRequired = this._properties.isRequired;
    }
    if (this._properties.identifier != null) {
      config.identifier = this._properties.identifier!;
    }
    if (this._properties.traversalParentIdentifier != null) {
      config.traversalParentIdentifier = this._properties.traversalParentIdentifier;
    }
    if (this._properties.traversalChildIdentifier != null) {
      config.traversalChildIdentifier = this._properties.traversalChildIdentifier;
    }
    if (this._attributedLabel != null) {
      config.attributedLabel = this._attributedLabel!;
    }
    if (this._attributedValue != null) {
      config.attributedValue = this._attributedValue!;
    }
    if (this._attributedIncreasedValue != null) {
      config.attributedIncreasedValue = this._attributedIncreasedValue!;
    }
    if (this._attributedDecreasedValue != null) {
      config.attributedDecreasedValue = this._attributedDecreasedValue!;
    }
    if (this._attributedHint != null) {
      config.attributedHint = this._attributedHint!;
    }
    if (this._properties.tooltip != null) {
      config.tooltip = this._properties.tooltip!;
    }
    if (this._properties.hintOverrides != null && this._properties.hintOverrides!.isNotEmpty) {
      config.hintOverrides = this._properties.hintOverrides;
    }
    if (this._properties.scopesRoute != null) {
      config.scopesRoute = this._properties.scopesRoute!;
    }
    if (this._properties.namesRoute != null) {
      config.namesRoute = this._properties.namesRoute!;
    }
    if (this._properties.liveRegion != null) {
      config.liveRegion = this._properties.liveRegion!;
    }
    if (this._properties.maxValueLength != null) {
      config.maxValueLength = this._properties.maxValueLength;
    }
    if (this._properties.currentValueLength != null) {
      config.currentValueLength = this._properties.currentValueLength;
    }
    if (this.textDirection != null) {
      config.textDirection = this.textDirection;
    }
    if (this._properties.sortKey != null) {
      config.sortKey = this._properties.sortKey;
    }
    if (this._properties.tagForChildren != null) {
      config.addTagForChildren(this._properties.tagForChildren!);
    }
    if (this.properties.role != null) {
      config.role = this._properties.role!;
    }
    if (this._properties.controlsNodes != null) {
      config.controlsNodes = this._properties.controlsNodes;
    }
    if (config.validationResult != this._properties.validationResult) {
      config.validationResult = this._properties.validationResult;
    }

    if (this._properties.hitTestBehavior != null) {
      config.hitTestBehavior = this._properties.hitTestBehavior!;
    }

    if (this._properties.inputType != null) {
      config.inputType = this._properties.inputType!;
    }
    if (this._properties.minValue != null) {
      config.minValue = this._properties.minValue;
    }
    if (this._properties.maxValue != null) {
      config.maxValue = this._properties.maxValue;
    }

    // Registering _perform* as action handlers instead of the user provided
    // ones to ensure that changing a user provided handler from a non-null to
    // another non-null value doesn't require a semantics update.
    if (this._properties.onTap != null) {
      config.onTap = this._performTap;
    }
    if (this._properties.onLongPress != null) {
      config.onLongPress = this._performLongPress;
    }
    if (this._properties.onDismiss != null) {
      config.onDismiss = this._performDismiss;
    }
    if (this._properties.onScrollLeft != null) {
      config.onScrollLeft = this._performScrollLeft;
    }
    if (this._properties.onScrollRight != null) {
      config.onScrollRight = this._performScrollRight;
    }
    if (this._properties.onScrollUp != null) {
      config.onScrollUp = this._performScrollUp;
    }
    if (this._properties.onScrollDown != null) {
      config.onScrollDown = this._performScrollDown;
    }
    if (this._properties.onIncrease != null) {
      config.onIncrease = this._performIncrease;
    }
    if (this._properties.onDecrease != null) {
      config.onDecrease = this._performDecrease;
    }
    if (this._properties.onCopy != null) {
      config.onCopy = this._performCopy;
    }
    if (this._properties.onCut != null) {
      config.onCut = this._performCut;
    }
    if (this._properties.onPaste != null) {
      config.onPaste = this._performPaste;
    }
    if (this._properties.onMoveCursorForwardByCharacter != null) {
      config.onMoveCursorForwardByCharacter = this._performMoveCursorForwardByCharacter;
    }
    if (this._properties.onMoveCursorBackwardByCharacter != null) {
      config.onMoveCursorBackwardByCharacter = this._performMoveCursorBackwardByCharacter;
    }
    if (this._properties.onMoveCursorForwardByWord != null) {
      config.onMoveCursorForwardByWord = this._performMoveCursorForwardByWord;
    }
    if (this._properties.onMoveCursorBackwardByWord != null) {
      config.onMoveCursorBackwardByWord = this._performMoveCursorBackwardByWord;
    }
    if (this._properties.onSetSelection != null) {
      config.onSetSelection = this._performSetSelection;
    }
    if (this._properties.onSetText != null) {
      config.onSetText = this._performSetText;
    }
    if (this._properties.onDidGainAccessibilityFocus != null) {
      config.onDidGainAccessibilityFocus = this._performDidGainAccessibilityFocus;
    }
    if (this._properties.onDidLoseAccessibilityFocus != null) {
      config.onDidLoseAccessibilityFocus = this._performDidLoseAccessibilityFocus;
    }
    if (this._properties.onFocus != null) {
      config.onFocus = this._performFocus;
    }
    if (this._properties.onExpand != null) {
      config.onExpand = this._performExpand;
    }
    if (this._properties.onCollapse != null) {
      config.onCollapse = this._performCollapse;
    }
    if (this._properties.customSemanticsActions != null) {
      config.customSemanticsActions = this._properties.customSemanticsActions!;
    }
    }
    private get _performTap():()=>void{return (this._handlers??=new SemanticsAnnotationHandlers()).onTap??=()=>{this._properties.onTap?.();};}
    private get _performLongPress():()=>void{return (this._handlers??=new SemanticsAnnotationHandlers()).onLongPress??=()=>{this._properties.onLongPress?.();};}
    private get _performDismiss():()=>void{return (this._handlers??=new SemanticsAnnotationHandlers()).onDismiss??=()=>{this._properties.onDismiss?.();};}
    private get _performScrollLeft():()=>void{return (this._handlers??=new SemanticsAnnotationHandlers()).onScrollLeft??=()=>{this._properties.onScrollLeft?.();};}
    private get _performScrollRight():()=>void{return (this._handlers??=new SemanticsAnnotationHandlers()).onScrollRight??=()=>{this._properties.onScrollRight?.();};}
    private get _performScrollUp():()=>void{return (this._handlers??=new SemanticsAnnotationHandlers()).onScrollUp??=()=>{this._properties.onScrollUp?.();};}
    private get _performScrollDown():()=>void{return (this._handlers??=new SemanticsAnnotationHandlers()).onScrollDown??=()=>{this._properties.onScrollDown?.();};}
    private get _performIncrease():()=>void{return (this._handlers??=new SemanticsAnnotationHandlers()).onIncrease??=()=>{this._properties.onIncrease?.();};}
    private get _performDecrease():()=>void{return (this._handlers??=new SemanticsAnnotationHandlers()).onDecrease??=()=>{this._properties.onDecrease?.();};}
    private get _performCopy():()=>void{return (this._handlers??=new SemanticsAnnotationHandlers()).onCopy??=()=>{this._properties.onCopy?.();};}
    private get _performCut():()=>void{return (this._handlers??=new SemanticsAnnotationHandlers()).onCut??=()=>{this._properties.onCut?.();};}
    private get _performPaste():()=>void{return (this._handlers??=new SemanticsAnnotationHandlers()).onPaste??=()=>{this._properties.onPaste?.();};}
    private get _performMoveCursorForwardByCharacter():(extendSelection:boolean)=>void{return (this._handlers??=new SemanticsAnnotationHandlers()).onMoveCursorForwardByCharacter??=(extendSelection:boolean)=>{this._properties.onMoveCursorForwardByCharacter?.(extendSelection);};}
    private get _performMoveCursorBackwardByCharacter():(extendSelection:boolean)=>void{return (this._handlers??=new SemanticsAnnotationHandlers()).onMoveCursorBackwardByCharacter??=(extendSelection:boolean)=>{this._properties.onMoveCursorBackwardByCharacter?.(extendSelection);};}
    private get _performMoveCursorForwardByWord():(extendSelection:boolean)=>void{return (this._handlers??=new SemanticsAnnotationHandlers()).onMoveCursorForwardByWord??=(extendSelection:boolean)=>{this._properties.onMoveCursorForwardByWord?.(extendSelection);};}
    private get _performMoveCursorBackwardByWord():(extendSelection:boolean)=>void{return (this._handlers??=new SemanticsAnnotationHandlers()).onMoveCursorBackwardByWord??=(extendSelection:boolean)=>{this._properties.onMoveCursorBackwardByWord?.(extendSelection);};}
    private get _performSetSelection():(selection:TextSelection)=>void{return (this._handlers??=new SemanticsAnnotationHandlers()).onSetSelection??=(selection:TextSelection)=>{this._properties.onSetSelection?.(selection);};}
    private get _performSetText():(text:string)=>void{return (this._handlers??=new SemanticsAnnotationHandlers()).onSetText??=(text:string)=>{this._properties.onSetText?.(text);};}
    private get _performDidGainAccessibilityFocus():()=>void{return (this._handlers??=new SemanticsAnnotationHandlers()).onDidGainAccessibilityFocus??=()=>{this._properties.onDidGainAccessibilityFocus?.();};}
    private get _performDidLoseAccessibilityFocus():()=>void{return (this._handlers??=new SemanticsAnnotationHandlers()).onDidLoseAccessibilityFocus??=()=>{this._properties.onDidLoseAccessibilityFocus?.();};}
    private get _performFocus():()=>void{return (this._handlers??=new SemanticsAnnotationHandlers()).onFocus??=()=>{this._properties.onFocus?.();};}
    private get _performExpand():()=>void{return (this._handlers??=new SemanticsAnnotationHandlers()).onExpand??=()=>{this._properties.onExpand?.();};}
    private get _performCollapse():()=>void{return (this._handlers??=new SemanticsAnnotationHandlers()).onCollapse??=()=>{this._properties.onCollapse?.();};}
  }
  return AnnotatedRenderObject as unknown as SemanticsAnnotationsConstructor<Base>;
}

export type TextBaseline='alphabetic'|'ideographic';
export abstract class RenderBox<Child extends RenderObject=RenderBox<RenderObject>> extends RenderObject {
  private static readonly geometryLayoutSemantics=new WeakSet<object>();
  private static readonly defaultLayoutGetters={
    children:Object.getOwnPropertyDescriptor(RenderBox.prototype,'children')!.get!,
    objectChildren:Object.getOwnPropertyDescriptor(RenderObject.prototype,'children')!.get!,
    semantics:Object.getOwnPropertyDescriptor(RenderBox.prototype,'semantics')!.get!,
    transport:Object.getOwnPropertyDescriptor(RenderBox.prototype,'semanticsTransport')!.get!,
    source:Object.getOwnPropertyDescriptor(RenderObject.prototype,'hasSourceSemanticsConfiguration')!.get!,
  };
  private static readonly defaultLayoutMethods={visit:RenderObject.prototype.visitChildren,semantics:RenderBox.prototype.visitChildrenForSemantics,assemble:RenderObject.prototype.assembleSemanticsNode,describe:RenderBox.prototype.describeSemanticsConfiguration};
  private usesLayoutGetter(name:string,getter:Function):boolean{
    let prototype:object|null=this;
    while(prototype){const descriptor=Object.getOwnPropertyDescriptor(prototype,name);if(descriptor)return descriptor.get===getter;prototype=Object.getPrototypeOf(prototype);}
    return false;
  }
  private hasDefaultLayoutSemantics():boolean{
    const methods=RenderBox.defaultLayoutMethods,getters=RenderBox.defaultLayoutGetters;
    return this.visitChildren===methods.visit&&this.visitChildrenForSemantics===methods.semantics&&this.assembleSemanticsNode===methods.assemble&&this.describeSemanticsConfiguration===methods.describe&&Object.getOwnPropertyDescriptor(RenderObject.prototype,'children')?.get===getters.objectChildren&&this.usesLayoutGetter('children',getters.children)&&this.usesLayoutGetter('semantics',getters.semantics)&&this.usesLayoutGetter('semanticsTransport',getters.transport)&&this.usesLayoutGetter('hasSourceSemanticsConfiguration',getters.source);
  }
  /** @internal Exact built-in types whose layout only changes semantic geometry. */
  static _registerGeometryLayoutSemantics(...prototypes:readonly object[]):void{for(const prototype of prototypes)RenderBox.geometryLayoutSemantics.add(prototype);}
  protected override markNeedsPaintAfterLayout():void{
    const prototype=Object.getPrototypeOf(this);
    if((RenderBox.geometryLayoutSemantics.has(prototype)||this.hasDefaultLayoutSemantics())&&this.hasDefaultPaintSemantics(prototype))this.markNeedsPaintAfterGeometryLayout();
    else super.markNeedsPaintAfterLayout();
  }
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new DiagnosticsProperty('size',this.measuredSize??null,{missingIfNull:true}));}
  private readonly childType:abstract new (...args:never[])=>RenderObject;
  /** Non-box child protocols supply a runtime token as generic types erase. */
  constructor(options:{readonly childType?:abstract new (...args:never[])=>Child}={}){super();this.childType=options.childType??RenderBox;}
  override get children():readonly Child[]{return super.children as readonly Child[];}
  override setupParentData(child:RenderObject):void {if(!(child.parentData instanceof BoxParentData))child.parentData=new BoxParentData();}
  override insert(child:RenderObject,after?:RenderObject):void{if(!(child instanceof this.childType))invariant(false,'invalid-render-child',`RenderBox requires ${this.childType.name} children`);super.insert(child,after);}
  override setChildren(children:readonly RenderObject[]):void{if(!children.every(child=>child instanceof this.childType))invariant(false,'invalid-render-child',`RenderBox requires ${this.childType.name} children`);super.setChildren(children);}
  get layoutOffset():Offset{return this.parentData instanceof BoxParentData?this.parentData.offset:{x:0,y:0};}
  set layoutOffset(value:Offset){
    assertOutsideRenderPaint();if(!(!layoutQueries.length))invariant(false,'render-mutation-during-measurement','Measurement cannot change child offsets');
    const data=this.parentData instanceof BoxParentData?this.parentData:new BoxParentData();this.parentData=data;
    const previous=data.offset;if(previous.x===value.x&&previous.y===value.y)return;data.offset=value;
    if(this.owner?.semanticsOwner){const state=existingSemanticsFor(this);if(state){
      // Moving laid-out content changes geometry, not its semantic configuration.
      state.geometry=null;pipelineSemantics(this.owner).offsetChanged(this);this.owner.invalidate();
    }}
  }
  /** @deprecated Use layoutOffset for spatial placement. Source viewport
   * subclasses reserve offset for their ViewportOffset protocol. The former
   * host-only alias keeps its runtime behavior on ordinary RenderBox objects. */
  get offset():any{return this.layoutOffset;}
  set offset(value:any){this.layoutOffset=value;}
  private measuredSize:Size|undefined;
  get hasSize():boolean{return this.measuredSize!==undefined;}
  get size():Size{if(!(!layoutQueries.length||layoutQueries.at(-1)!.key.startsWith('baseline:')))invariant(false,'wet-size-during-measurement','Dry/intrinsic measurement cannot read wet size');if(!(activeLayout!==this.parent||!activeLayout||this.debugCanParentUseSize))invariant(false,'undeclared-size-dependency','A parent reading child size must pass parentUsesSize true');if(!this.measuredSize)invariant(false,'missing-render-size',`${this.constructor.name} has not been laid out`);return this.measuredSize;}
  protected set size(value:Size){assertOutsideRenderPaint();if(!(!layoutQueries.length))invariant(false,'render-mutation-during-measurement','Measurement cannot change wet size');this.measuredSize=validSize(value);}
  override get paintBounds():Rect{return {x:0,y:0,...this.size};}
  override get constraints():BoxConstraints{return super.constraints as BoxConstraints;}
  private layoutCache:Map<string,Size|number|null>|undefined;
  private readonly cachedConstraints:{constraints:BoxConstraints;key:string}[]=[];
  private nextConstraintKey=0;
  private semanticProperties:Omit<SemanticsNode,'bounds'>|undefined;
  get semantics():Omit<SemanticsNode,'bounds'>|undefined{return this.semanticProperties;}
  set semantics(value:Omit<SemanticsNode,'bounds'>|undefined){if(this.semanticProperties===value)return;if(!(!layoutQueries.length))invariant(false,'render-mutation-during-measurement','Measurements cannot change semantics');this.semanticProperties=value;if(!this.debugDisposed)this.markNeedsSemanticsUpdate();}
  override get semanticsTransport():SemanticsTransportProperties|null{return this.semantics??null;}
  override describeSemanticsConfiguration(config:SemanticsConfiguration):void{super.describeSemanticsConfiguration(config);const value=this.semanticsTransport;if(value!==null&&!this.hasSourceSemanticsConfiguration)describeTransportSemantics(config,value,()=>this.showOnScreen());}
  /** Specialize only the unchanged built-in renderer. Subclass or instance
   * semantics and paint hooks retain conservative configuration invalidation. */
  protected hasDefaultPaintSemantics(prototype:object,paintInvalidator:RenderObject['markNeedsPaint']=RenderObject.prototype.markNeedsPaint):boolean{
    return this.semanticsTransport===null&&this.hasStaticLayoutSemantics(prototype,RenderBox.prototype.describeSemanticsConfiguration,paintInvalidator);
  }
  /** Stored annotations invalidate through their setters; layout only refreshes geometry. */
  protected hasStaticLayoutSemantics(prototype:object,configuration:RenderObject['describeSemanticsConfiguration'],paintInvalidator:RenderObject['markNeedsPaint']=RenderObject.prototype.markNeedsPaint):boolean{
    return Object.getPrototypeOf(this)===prototype&&this.markNeedsPaint===paintInvalidator&&this.describeSemanticsConfiguration===configuration&&!Object.hasOwn(this,'semantics')&&!Object.hasOwn(this,'semanticsTransport')&&!Object.hasOwn(this,'hasSourceSemanticsConfiguration')&&!Object.hasOwn(this,'semanticBounds')&&!Object.hasOwn(this,'paintBounds')&&!Object.hasOwn(this,'visitChildrenForSemantics')&&!Object.hasOwn(this,'visitChildren')&&!Object.hasOwn(this,'paint')&&!Object.hasOwn(this,'localTransform')&&!Object.hasOwn(this,'childTransform')&&!Object.hasOwn(this,'applyPaintTransform')&&!Object.hasOwn(this,'describeApproximatePaintClip')&&!Object.hasOwn(this,'describeSemanticsClip')&&!Object.hasOwn(this,'paintsChild')&&!Object.hasOwn(this,'clips');
  }
  override visitChildrenForSemantics(visitor:(child:RenderObject)=>void):void{const role=this.semanticsTransport?.role;if(!this.hasSourceSemanticsConfiguration&&(role==='button'||role==='text-field'))return;super.visitChildrenForSemantics(visitor);}
  override layout(constraints:BoxConstraints,options:LayoutOptions={}):void {
    if(!(constraints instanceof BoxConstraints))invariant(false,'invalid-box-constraints','RenderBox requires BoxConstraints');
    this.runLayout(constraints,options);
  }
  protected override performLayoutInScope(constraints:BoxConstraints):void{if(this.sizedByParent)this.performResize();this.size=this.performLayout(constraints);if(!constraints.isSatisfiedBy(this.size))invariant(false,'constraint-violation',`${this.constructor.name} returned size outside constraints`);}
  protected override performLayout(_constraints:BoxConstraints):Size{if(!this.sizedByParent)invariant(false,'missing-perform-layout',`${this.constructor.name} must implement performLayout`);return this.size;}
  protected override performResize():void{this.size=this.getDryLayout(this.constraints);}
  protected override clearCachedLayoutData():void{this.layoutCache?.clear();this.cachedConstraints.length=0;this.nextConstraintKey=0;}
  private query<T extends Size|number|null>(key:string,compute:()=>T):T{
    if(!(!this.dead))invariant(false,'disposed-render-object','Measurement after dispose');this.registerLayoutQuery();
    const kind=key.split(':',1)[0];if(layoutQueries.some(query=>query.render===this&&query.key.split(':',1)[0]===kind))invariant(false,'cyclic-layout-measurement',`${this.constructor.name} recursively requested ${key}`);
    const shouldCache=!FoundationBuildMode.debug||!RenderObject.debugCheckingIntrinsics;if(shouldCache&&this.layoutCache?.has(key))return this.layoutCache.get(key) as T;layoutQueries.push({render:this,key});
    try{const result=compute();if(shouldCache){const cache=this.layoutCache??=new Map();if(cache.size>=64)cache.delete(cache.keys().next().value!);cache.set(key,result);}return result;}finally{layoutQueries.pop();}
  }
  private intrinsic(kind:string,input:number,compute:(value:number)=>number):number{if(!(input>=0&&!Number.isNaN(input)))invariant(false,'invalid-intrinsic-input','Intrinsic dimension must be nonnegative');return this.query(`${kind}:${input}`,()=>{const value=compute(input);if(!(value>=0&&!Number.isNaN(value)))invariant(false,'invalid-intrinsic-result','Intrinsic size must be nonnegative');return value;});}
  getMinIntrinsicWidth(height:number):number{return this.intrinsic('minWidth',height,value=>this.computeMinIntrinsicWidth(value));}
  getMaxIntrinsicWidth(height:number):number{return this.intrinsic('maxWidth',height,value=>this.computeMaxIntrinsicWidth(value));}
  getMinIntrinsicHeight(width:number):number{return this.intrinsic('minHeight',width,value=>this.computeMinIntrinsicHeight(value));}
  getMaxIntrinsicHeight(width:number):number{return this.intrinsic('maxHeight',width,value=>this.computeMaxIntrinsicHeight(value));}
  protected computeMinIntrinsicWidth(_height:number):number{return 0;}
  protected computeMaxIntrinsicWidth(_height:number):number{return 0;}
  protected computeMinIntrinsicHeight(_width:number):number{return 0;}
  protected computeMaxIntrinsicHeight(_width:number):number{return 0;}
  private constraintKey(constraints:BoxConstraints):string{
    const existing=this.cachedConstraints.find(entry=>entry.constraints.equals(constraints));if(existing)return existing.key;
    if(this.cachedConstraints.length>=64){const removed=this.cachedConstraints.shift()!;if(this.layoutCache)for(const key of this.layoutCache.keys())if(key.endsWith(':'+removed.key))this.layoutCache.delete(key);}
    const key='c'+ ++this.nextConstraintKey;this.cachedConstraints.push({constraints,key});return key;
  }
  getDryLayout(constraints:BoxConstraints):Size{constraints.debugAssertIsValid({isAppliedConstraint:true});return this.query('dry:'+this.constraintKey(constraints),()=>{const size=validSize(this.computeDryLayout(constraints));if(!(constraints.isSatisfiedBy(size)))invariant(false,'constraint-violation','Dry layout returned a size outside constraints');return size;});}
  protected computeDryLayout(_constraints:BoxConstraints):Size{throw new Error(`${this.constructor.name} does not support dry layout`);}
  private validateBaseline(value:number|null):number|null{if(!(value===null||Number.isFinite(value)))invariant(false,'invalid-baseline','Baseline must be finite or null');return value;}
  getDryBaseline(constraints:BoxConstraints,baseline:TextBaseline):number|null{constraints.debugAssertIsValid({isAppliedConstraint:true});if(!(baseline==='alphabetic'||baseline==='ideographic'))invariant(false,'invalid-baseline','Unknown baseline');return this.query(`dryBaseline:${baseline}:${this.constraintKey(constraints)}`,()=>this.validateBaseline(this.computeDryBaseline(constraints,baseline)));}
  protected computeDryBaseline(_constraints:BoxConstraints,_baseline:TextBaseline):number|null{return null;}
  getDistanceToBaseline(baseline:TextBaseline,options:{readonly onlyReal?:boolean}={}):number|null{if(!(this.hasSize&&!this.needsLayout))invariant(false,'stale-baseline','Actual baseline requires a current layout');const result=this.getDistanceToActualBaseline(baseline);return result===null&&!options.onlyReal?this.size.height:result;}
  getDistanceToActualBaseline(baseline:TextBaseline):number|null{if(!(this.hasSize&&!this.needsLayout))invariant(false,'stale-baseline','Actual baseline requires a current layout');if(!(baseline==='alphabetic'||baseline==='ideographic'))invariant(false,'invalid-baseline','Unknown baseline');return this.query('baseline:'+baseline,()=>this.validateBaseline(this.computeDistanceToActualBaseline(baseline)));}
  protected computeDistanceToActualBaseline(_baseline:TextBaseline):number|null{return null;}
  localToGlobal(point:Offset,options:{readonly ancestor?:RenderObject}={}):Offset{return transform(this.getTransformTo(options.ancestor??null),point);}
  globalToLocal(point:Offset,options:{readonly ancestor?:RenderObject}={}):Offset{return unprojectMatrix4Point(this.getTransformTo(options.ancestor??null),point);}
  /** Legacy callback/semantics hosts remain self-hit targets; subclasses may specialize the source hook. */
  protected hitTestSelf(_position:Offset):boolean{return !!(this.onPointer||this.semantics);}
  hitTest(position:Offset,result:HitTestEntry[],toLocal:TransformMatrix=identity):boolean {
    if(!(this.hasSize))invariant(false,'missing-hit-test-size','Hit testing requires a laid-out size');if(!contains({x:0,y:0,...this.size},position))return false;
    let hit=false;
    for(const child of [...this.children].reverse()){
      const matrix=inversePaintTransform(this.childTransform(child));
      if(child instanceof RenderBox&&matrix&&child.hitTest(transform(matrix,position),result,multiply(matrix,toLocal))){hit=true;break;}
    }
    if(this.hitTestSelf(position)){result.push({target:this,transform:toLocal});hit=true;}
    return hit;
  }
  collectSemantics(output:SemanticsNode[],matrix:TransformMatrix=identity,clip?:Rect):void {
    const ownBounds=bounds(matrix,this.size),nextClip=this.clips?(clip?intersect(clip,ownBounds):ownBounds):clip;
    // An axis-aligned native overlay cannot represent a projective horizon.
    if(![ownBounds.x,ownBounds.y,ownBounds.width,ownBounds.height].every(Number.isFinite))return;
    const descendants:SemanticsNode[]=[];
    for(const child of this.children)child.collectSemantics(descendants,multiply(matrix,this.childTransform(child)),nextClip);
    if(this.semantics){const visible=clip?intersect(clip,ownBounds):ownBounds;if(visible.width>0&&visible.height>0)output.push({...this.semantics,bounds:visible,...(descendants.length&&this.semantics.role!=='button'&&this.semantics.role!=='text-field'?{children:descendants}:{})});}
    else output.push(...descendants);
  }
  override dispose():void {try{super.dispose();}finally{if(this.debugDisposed){this.onPointer=undefined;this.semantics=undefined;}}}
}
