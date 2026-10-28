import { generation } from '../foundation/numbers.ts';
import { invariant } from '../foundation/errors.ts';
import type { Clock, FrameClock } from '../foundation/clock.ts';
import type { Disposable } from '../foundation/disposable.ts';
import type { AssetRef } from '../foundation/assets.ts';
import type {PointerEvent,KeyEvent} from '../ui/input.ts';
import type {RawKeyMessage} from '../services/raw-key-event.ts';
import type { EditingHost, SemanticsHost,NativeSelectionContextMenuHost } from './interaction.ts';
import type {BinaryMessenger} from '../services/binary-messenger.ts';
import type {ServicesBinding} from '../services/binding.ts';
import { captureMetrics, captureSceneFrame, releaseSceneFrameSource, isCurrent } from '../ui/frame.ts';
import type {SceneFrameSource} from '../ui/frame.ts';
import {releaseFrameResources} from '../ui/resource-retention.ts';
import type {ImageService} from './images.ts';
import type { FrameBuildToken, PaintFrame, RendererCapabilities, RendererNotification, SubmitResult, ViewMetrics, ViewOwner } from '../ui/types.ts';
import { ResourceRegistry } from "./resources.ts";
import type { ResourceLease } from "./resources.ts";
export interface Renderer extends Disposable {
  readonly capabilities: RendererCapabilities;
  /** Optional backpressure hint. One CPU frame waits while capacity is full;
   * newer state replaces it when credit returns. Submit owns lease transfer. */
  canBuildFrame?():boolean;
  /** accepted transfers lease; rejected leaves it with caller. unknown must retain until drain. */
  submit(frame: PaintFrame, lease: ResourceLease): SubmitResult;
  updateMetrics(metrics: ViewMetrics): void;
  observe?(listener:(event:RendererNotification)=>void):Disposable;
}
export interface SceneContext { readonly token: FrameBuildToken; readonly resources: ResourceRegistry;/** Live admission hint, required together with an observed host deadline. */readonly canRunOptionalWork?:()=>boolean }
export interface ApplicationStartupContext {
  readonly platformView?:import('../ui/platform-dispatcher.ts').PlatformViewIdentity;
  readonly nativeSelectionContextMenu?:NativeSelectionContextMenuHost;
  readonly rasterizer?:import('./rasterization.ts').RasterizationService;
  readonly pictures?:import('./pictures.ts').FramePictureService;
  readonly paths?:import('../ui/path.ts').PathQueryService;
  readonly images?:ImageService;
  readonly platformServices?:ServicesBinding;
  readonly binaryMessenger?:BinaryMessenger;
  readonly resources: ResourceRegistry;
  readonly assets: ReadonlyMap<string, import('../ui/types.ts').ResourceId>;
  readonly text: import('../ui/types.ts').TextLayoutService;
  readonly metrics: ViewMetrics;
  readonly owner: ViewOwner;
  readonly editing: EditingHost;
  readonly semantics: SemanticsHost;
}
export interface ApplicationDefinition {
  readonly id: string;
  /** Startup policy. false skips accessibility trees, updates and OS preference observation. Default: true. */
  readonly accessibilityEnabled?: boolean;
  readonly assets?: readonly AssetRef[];
  startup?(context: ApplicationStartupContext): void | Disposable | Promise<void | Disposable>;
  createScene?(): (context: SceneContext) => SceneFrameSource;
  /** One controller per View; no Element/State is shared through AppSession. */
  createView?(context: ViewControllerContext): ViewController;
}
export interface ViewServices {
  readonly platformView?:import('../ui/platform-dispatcher.ts').PlatformViewIdentity;
  readonly nativeSelectionContextMenu?:NativeSelectionContextMenuHost;
  readonly rasterizer?:import('./rasterization.ts').RasterizationService;
  readonly pictures?:import('./pictures.ts').FramePictureService;
  readonly paths?:import('../ui/path.ts').PathQueryService;
  readonly images?:ImageService;
  readonly platformServices?:ServicesBinding;
  readonly binaryMessenger?:BinaryMessenger;
  readonly assets: ReadonlyMap<string, import('../ui/types.ts').ResourceId>;
  readonly text: import('../ui/types.ts').TextLayoutService;
  readonly clock: Clock;
  readonly editing: EditingHost;
  readonly semantics: SemanticsHost;
  /** App-selected font resource; consumers do not depend on a sample asset name. */
  readonly defaultFont?:import('../ui/types.ts').ResourceId;
}
export type ViewRuntimeStatus='open'|'closing'|'closed'|'failed';
export interface ViewControllerContext extends ViewServices {
  readonly owner: ViewOwner; readonly resources: ResourceRegistry;
  readonly requestFrame: () => void;
  readonly requestForcedFrame?:()=>void;
  /** Widget builds may observe selected fields; an omitted selection observes all metrics. */
  readonly readMetrics: (...fields:readonly (keyof ViewMetrics)[]) => ViewMetrics;
  /** The View owner is authoritative before controller/service retirement. */
  readonly readStatus:()=>ViewRuntimeStatus;
  readonly reportError?:(error:unknown)=>void;
}
export interface ViewController {
  build(context: SceneContext): SceneFrameSource;
  setVisible?(visible: boolean): void;
  /** Owner gate, for example first-frame deferral. Native admission alone
   * cannot suppress a requested future frame: present may be unobserved. */
  shouldSubmitFrame?():boolean;
  /** Called after renderer admission. This is not a display receipt and does
   * not acknowledge the pixels or paint dependencies of later frames. */
  frameSubmitted?(token:FrameBuildToken):void;
  pointer?(event:PointerEvent):void;
  key?(event:KeyEvent):boolean|void;
  rawKey?(message:RawKeyMessage,transport?:KeyEvent):boolean;
  keyboardFocusGained?():void;
  keyboardFocusLost?():void;
  dispose(): void;
}
export interface ViewOptions { readonly id: string; readonly generation: number; readonly metrics: ViewMetrics; readonly renderer: Renderer; readonly ownership: "owned" | "borrowed"; readonly services?: ViewServices;readonly onError?:(error:unknown)=>void }
export class ViewRuntime implements Disposable {
  readonly owner: ViewOwner;
  private metrics: ViewMetrics;
  private pending: {frame: PaintFrame; lease: ResourceLease} | undefined;
  private submitting:{frame:PaintFrame;lease:ResourceLease}|undefined;
  private submissionFinished:(()=>void)|undefined;
  private task: Disposable | undefined;
  private state:ViewRuntimeStatus="open";
  private sequence = 0;
  private inputSequence=0;
  private inputTimestamp:number|undefined;
  private readonly pointerMailbox:PointerEvent[]=[];
  private drainingPointers=false;
  private frameTiming:import('../foundation/clock.ts').FrameTiming|undefined;
  private dirty = false;
  private visible = true;
  private forcedFrame=false;
  readonly controller: ViewController | undefined;
  private closePromise: Promise<void> | undefined;
  private uncertain: ResourceLease[] = [];
  private rendererBinding:Disposable|undefined;
  private observedSubmissions=new Map<number,FrameBuildToken>();
  readonly scene: (context: SceneContext) => SceneFrameSource;
  constructor(private readonly session: AppSession, private readonly options: ViewOptions) {
    this.owner = Object.freeze({id: options.id, generation: generation(options.generation)});
    this.metrics = captureMetrics(options.metrics);
    try {
    if (session.definition.createView) {
      invariant(options.services,'missing-view-services','Widget applications require per-view services');
      this.controller = session.definition.createView({...options.services,owner:this.owner,resources:session.resources,requestFrame:()=>this.requestFrame(),requestForcedFrame:()=>this.requestForcedFrame(),readMetrics:()=>this.metrics,readStatus:()=>this.state,...(options.onError?{reportError:options.onError}:{})});
      this.scene = context => this.controller!.build(context);
    } else {
      invariant(session.definition.createScene,'missing-scene','Application requires createScene or createView');
      this.scene = session.definition.createScene();
    }
    options.renderer.updateMetrics(this.metrics);

    if(options.renderer.capabilities.notifications!=='unavailable'){
      invariant(typeof options.renderer.observe==='function','renderer-contract','declared renderer notifications require an observer');
      this.rendererBinding=options.renderer.observe(event=>this.rendererEvent(event));
    }
    } catch(error) {
      this.state='failed';const errors:unknown[]=[error];
      for(const cleanup of [()=>this.task?.dispose(),()=>this.rendererBinding?.dispose(),()=>this.controller?.dispose()])try{cleanup();}catch(failure){errors.push(failure);}
      if(errors.length>1)throw new AggregateError(errors,'View initialization cleanup failed');throw error;
    }
  }
  get currentMetrics(): ViewMetrics { return this.metrics; }
  get status():ViewRuntimeStatus { return this.state; }
  /** Windows ingress batches updates until the next owned tick. Never sum
   * wheel deltas across unknown hit targets or retain more than 256 packets. */
  queuePointer(event:PointerEvent):void{
    if(this.state!=='open'||!this.visible||event.viewportGeneration!==this.metrics.viewportGeneration)return;
    if(!['move','hover','wheel','panZoomUpdate'].includes(event.kind)){this.dispatchPointer(event);return;}
    if(this.pointerMailbox.length===256){
      invariant(!this.drainingPointers,'input-mailbox-overflow','Reentrant input exceeded the 256-packet mailbox');
      this.flushPointerInput();
      if(this.state!=='open'||!this.visible||event.viewportGeneration!==this.metrics.viewportGeneration)return;
    }
    this.pointerMailbox.push(Object.freeze({...event,...(event.globalPosition?{globalPosition:Object.freeze({...event.globalPosition})}:{}),...(event.globalDelta?{globalDelta:Object.freeze({...event.globalDelta})}:{}),...(event.localTransform?{localTransform:Object.freeze([...event.localTransform]) as typeof event.localTransform}:{})}));this.schedulePump();
  }
  private flushPointerInput():void{
    if(this.drainingPointers)return;this.drainingPointers=true;
    try{let passes=0;while(this.pointerMailbox.length){invariant(++passes<=30,'input-did-not-converge','Reentrant input remained pending after 30 batches');const batch=this.pointerMailbox.splice(0);for(const event of batch)this.dispatchPointer(event);}}
    finally{this.drainingPointers=false;}
  }
  dispatchPointer(event:PointerEvent):void {this.flushPointerInput();if(this.state==='open'&&this.visible&&event.viewportGeneration===this.metrics.viewportGeneration){this.inputSequence++;this.inputTimestamp=event.timestamp;this.controller?.pointer?.(event);}}
  dispatchKey(event:KeyEvent):boolean {this.flushPointerInput();return this.state==='open'&&this.visible&&this.controller?.key?.(event)===true;}
  /** Raw messages are admitted only by a controller that implements this route. */
  dispatchRawKey(message:RawKeyMessage,transport?:KeyEvent):boolean{this.flushPointerInput();return this.state==='open'&&this.visible&&this.controller?.rawKey?.(message,transport)===true;}
  dispatchKeyboardFocusGained():void{this.flushPointerInput();if(this.state==='open'&&this.visible)this.controller?.keyboardFocusGained?.();}
  /** Host canvas focus loss is distinct from visibility and native editor focus. */
  dispatchKeyboardFocusLost():void{this.flushPointerInput();if(this.state==='open')this.controller?.keyboardFocusLost?.();}
  private rendererEvent(event:RendererNotification):void {
    if(this.state!=='open' || event.token.owner.id!==this.owner.id || event.token.owner.generation!==this.owner.generation){return;}
    if(event.kind==='submitted') {
      const item=this.submitting??this.pending;
      if(!Number.isSafeInteger(event.submission)||event.submission<1||this.observedSubmissions.has(event.submission) || !item || !this.sameToken(event.token,item.frame.token)){return;}
      if(this.options.renderer.capabilities.notifications==='submitted-and-retired')this.observedSubmissions.set(event.submission,event.token);
    } else {
      const accepted=this.observedSubmissions.get(event.submission);
      if(!accepted || !this.sameToken(accepted,event.token)){return;}
      if(event.kind==='retired'){this.observedSubmissions.delete(event.submission);}
      else {this.state='failed';}
    }
  }
  private sameToken(a:FrameBuildToken,b:FrameBuildToken):boolean {return a.sequence===b.sequence && a.owner.id===b.owner.id && a.owner.generation===b.owner.generation && (Object.keys(b.metrics) as (keyof ViewMetrics)[]).every(key=>a.metrics[key]===b.metrics[key]);}
  capture(): FrameBuildToken { invariant(this.state === "open", "closed", "view is closing"); return Object.freeze({owner: this.owner, metrics: this.metrics, sequence: ++this.sequence,inputSequence:this.inputSequence,...(this.inputTimestamp!==undefined?{inputTimestamp:this.inputTimestamp}:{}),...(this.frameTiming?{timing:this.frameTiming}:{})}); }
  updateMetrics(metrics: ViewMetrics): void {
    invariant(this.state === "open", "closed", "view is closing");
    const next = captureMetrics(metrics);
    invariant(next.viewportGeneration > this.metrics.viewportGeneration || (next.viewportGeneration === this.metrics.viewportGeneration && next.rendererGeneration > this.metrics.rendererGeneration), "stale-metrics", "metrics publication must advance viewport or renderer generation");
    this.flushPointerInput();
    this.metrics = next; this.options.renderer.updateMetrics(this.metrics); this.clearPending(); this.requestFrame();
  }
  requestFrame(): void {
    if (this.state !== "open") return;
    this.dirty = true;
    this.schedulePump();
  }
  requestForcedFrame():void{if(this.state!=='open')return;this.forcedFrame=true;this.dirty=true;this.schedulePump();}
  setVisible(visible: boolean): void {
    if(this.state!=='open')return;
    if(!visible)this.flushPointerInput();
    if(visible&&!this.visible&&this.options.renderer.canBuildFrame){this.clearPending();this.dirty=true;}
    this.visible=visible;this.controller?.setVisible?.(visible);
    if(visible||this.forcedFrame)this.schedulePump();else {this.task?.dispose();this.task=undefined;}
  }
  private buildPending(forced=false): false|void {
    if(!this.dirty)return;
    // Keep one prepared CPU frame ahead of native without rebuilding it on
    // every busy tick. When credit returns, a dirty scene replaces that still
    // unsubmitted frame rather than queuing old state in front of new input.
    // Submitted native recordings keep their upload/retirement dependencies.
    // Forced frames also serve synchronous input geometry, even when no GPU
    // submission can be admitted yet. They must observe the latest state.
    if(!forced&&this.pending&&this.options.renderer.canBuildFrame){
      if(!this.options.renderer.canBuildFrame()){this.schedulePump();return false;}
      // Keep its caller lease until the replacement is captured and acquired.
      // Admission, reentrant callbacks and failure retain the usual ownership.
    }
    if(this.state!=='open')return;
    this.dirty=false;
    const empty=this.metrics.physicalWidth===0 || this.metrics.physicalHeight===0;
    if(empty&&!forced){this.clearPending();return;}
    const token = this.capture();const commands=token.timing?.observedDeadline!==undefined?this.scene({token,resources:this.session.resources,canRunOptionalWork:()=>!forced&&this.state==='open'&&this.visible&&!this.pointerMailbox.length&&!this.pending&&this.inputSequence===token.inputSequence&&this.metrics===token.metrics&&this.options.renderer.canBuildFrame?.()===true}):this.scene({token,resources:this.session.resources});try{
    if(this.state!=='open'||this.metrics!==token.metrics)return;
    if(empty){this.clearPending();return;}
    if(this.controller?.shouldSubmitFrame?.()===false){this.clearPending();return;}
    if(this.state!=='open'||this.metrics!==token.metrics)return;
    const frame = captureSceneFrame(token,commands);
    let lease:ResourceLease|undefined,failed=false,failure:unknown,cleanupErrors:unknown[]|undefined;try{
      // Capture/getters and retirement of the old caller lease may close the
      // View or replace its metrics. Never attach a lease after that close.
      if(this.state!=='open'||this.metrics!==token.metrics)return;
      lease=this.session.resources.acquire(frame.resources);this.clearPending();
      if(this.state!=='open'||this.metrics!==token.metrics)return;
      this.pending={frame,lease};lease=undefined;
    }catch(error){failed=true;failure=error;}finally{
      try{releaseFrameResources(frame.resources);}catch(error){(cleanupErrors??=[]).push(error);}
      try{lease?.returnBy('caller');}catch(error){(cleanupErrors??=[]).push(error);}
      if(cleanupErrors){if(failed)cleanupErrors.unshift(failure);if(cleanupErrors.length===1)throw cleanupErrors[0];throw new AggregateError(cleanupErrors,'Frame replacement and retirement failed');}
      if(failed)throw failure;
    }
    }finally{releaseSceneFrameSource(commands);}
  }
  pump(): SubmitResult | undefined {
    if (this.state !== "open" || !this.pending||this.submitting) return;
    const item=this.pending;this.pending=undefined;this.submitting=item;let caller=true,failed=false,failure:unknown;
    try{
    if(this.controller?.shouldSubmitFrame?.()===false||this.state!=='open')return;
    if (!isCurrent(item.frame, this.owner, this.metrics) || item.frame.resources.some((r) => !this.session.resources.isRetained(r))) return {status: "rejected", reason: "stale"};
    if (this.metrics.physicalWidth === 0 || this.metrics.physicalHeight === 0) return {status: "rejected", reason: "zero-size"};
    let result: SubmitResult;caller=false;
    try {result = this.options.renderer.submit(item.frame, item.lease);} catch (error) {
      // An exception cannot prove whether native accepted. Preserve references until owned renderer drain.
      this.uncertain.push(item.lease);if(this.state==='open')this.state='failed';throw error;
    }
    if (result.status === "accepted") {if(this.state==='open')this.controller?.frameSubmitted?.(item.frame.token);}
    else if (result.status === "unknown") {this.uncertain.push(item.lease);if(this.state==='open')this.state='failed';}
    else{caller=true;if(result.reason==='busy'&&this.state==='open'&&!this.pending){this.pending=item;caller=false;this.schedulePump();}}

    return result;
    }catch(error){failed=true;failure=error;throw error;}
    finally{try{if(caller)item.lease.returnBy('caller');}catch(error){if(failed)throw new AggregateError([failure,error],'Frame admission and retirement failed');throw error;}finally{this.submitting=undefined;const finished=this.submissionFinished;this.submissionFinished=undefined;finished?.();}}
  }
  private schedulePump(): void {
    if(!this.task && (this.visible||this.forcedFrame) && (this.dirty || this.pending || this.pointerMailbox.length))this.task=this.session.clock.request(timing=>{
      this.frameTiming=timing;
      if(this.state!=='open'||!this.visible&&!this.forcedFrame){this.task=undefined;return;}
      const forced=this.forcedFrame;this.forcedFrame=false;
      try{this.flushPointerInput();this.task=undefined;if(this.buildPending(forced)!==false){const result=this.pump();if(result?.status==='unknown')throw new Error('Renderer submission failed: '+result.reason);}}
      catch(error){this.task=undefined;if(this.state==='open')this.state='failed';if(this.options.onError)this.options.onError(error);else throw error;}
    });
  }
  private clearPending(): void { const pending = this.pending; this.pending = undefined; if(pending){pending.lease.returnBy("caller");} }
  /** Stop framework work while a sibling native service still owns resources. */
  beginClose():void{if(this.state==='closing'||this.state==='closed')return;this.state='closing';this.pointerMailbox.length=0;const task=this.task;this.task=undefined;task?.dispose();}
  dispose(): Promise<void> {
    if (this.closePromise) return this.closePromise;
    // Publish the owner transaction before any user/native cleanup can reenter.
    let resolve!:()=>void,reject!:(error:unknown)=>void;
    const closing=new Promise<void>((done,fail)=>{resolve=done;reject=fail;});this.closePromise=closing;
    this.state = "closing"; const errors: unknown[] = []; const task = this.task; this.task = undefined;
    this.pointerMailbox.length=0;

    try {task?.dispose();} catch(error) {errors.push(error);}
    try {this.controller?.dispose();} catch(error) {errors.push(error);}
    try {this.rendererBinding?.dispose();this.rendererBinding=undefined;}catch(error){errors.push(error);}
    try {this.clearPending();} catch(error) {errors.push(error);}
    void this.finishClose().then(() => {if(errors.length) throw new AggregateError(errors, "view scheduling/lease cleanup failed");},error=>{
      if(errors.length)throw new AggregateError([...errors,error],"view cleanup and renderer drain failed");throw error;
    }).then(resolve,reject);return closing;
  }
  private async finishClose(): Promise<void> {
    // Only a reentrant close allocates this wait. Normal submissions retain
    // their synchronous lease transfer and need no per-frame Promise.
    if(this.submitting)await new Promise<void>(resolve=>{this.submissionFinished=resolve;});
    if (this.options.ownership === "owned") await this.options.renderer.dispose();
    invariant(this.uncertain.length === 0 || this.options.ownership === "owned", "unknown-borrowed-submission", "borrowed renderer must resolve uncertain leases before detach");
    // Renderer drain resolves transferred leases; unresolved caller leases were never transferred.
    for (const lease of this.uncertain) if (!lease.released) lease.returnBy("caller");
    this.uncertain = [];this.observedSubmissions.clear(); this.state = "closed"; this.session.detach(this);
  }
}
export class AppSession implements Disposable {
  readonly resources = new ResourceRegistry();
  private views = new Set<ViewRuntime>();
  private state: "open" | "closing" | "closed" = "open";
  private closePromise: Promise<void> | undefined;
  constructor(readonly definition: ApplicationDefinition, readonly clock: FrameClock, private readonly services: readonly {value: Disposable; ownership: "owned" | "borrowed"}[] = []) {}
  attach(options: ViewOptions): ViewRuntime {
    invariant(this.state === "open", "closed", "app is closing");
    invariant(![...this.views].some((view) => view.owner.id === options.id), "duplicate-view", "view id already attached");
    const view = new ViewRuntime(this, options); this.views.add(view); return view;
  }
  detach(view: ViewRuntime): void { this.views.delete(view); }
  /** Admission/scheduling gate without retiring resources before other ports drain. */
  beginClose():void{if(this.state==='closed')return;this.state='closing';const errors:unknown[]=[];for(const view of this.views)try{view.beginClose();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'view scheduling stop failed');}
  dispose(): Promise<void> {
    if (this.closePromise) return this.closePromise;
    let resolve!:()=>void,reject!:(error:unknown)=>void;
    const closing=new Promise<void>((done,fail)=>{resolve=done;reject=fail;});this.closePromise=closing;
    this.state = "closing";void this.finishClose().then(resolve,reject);return closing;
  }
  private async finishClose(): Promise<void> {
    const closing = [...this.views].map((view) => view.dispose());
    const errors:unknown[]=[];
    try {this.resources.dispose();} catch(error) {errors.push(error);}
    const results = await Promise.allSettled(closing);
    const failed = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    if(failed.length) throw new AggregateError([...errors,...failed.map((result) => result.reason)], "view shutdown failed; services retained");
    for (const service of this.services) if (service.ownership === "owned") {try {await service.value.dispose();} catch(error) {errors.push(error);}}
    this.state = "closed";
    if(errors.length) throw new AggregateError(errors, "app resource/service shutdown failed");
  }
}
