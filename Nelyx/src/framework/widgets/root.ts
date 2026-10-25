// SPDX-License-Identifier: BSD-3-Clause
import {invariant} from '../../foundation/errors.ts';
import {initializeFoundationBindings} from '../../foundation/binding.ts';
import type {SemanticsBinding} from '../../hosting/interaction.ts';
import type {ApplicationDefinition,ViewController,ViewControllerContext,SceneContext} from '../../hosting/runtime.ts';
import type {PaintCommand,SemanticsNode,ViewMetrics,FrameBuildToken,ResourceId} from '../../ui/types.ts';
import type {PointerEvent,KeyEvent} from '../../ui/input.ts';
import {transform,inversePaintTransform,captureTransform} from '../../ui/geometry.ts';
import {BuildOwner} from './framework.ts';
import type {Widget,Element} from './framework.ts';
import {PipelineOwner,PipelineManifold,RenderBox,RenderObject} from '../rendering/object.ts';
import {SemanticsTransportSnapshot} from '../rendering/semantics-transport.ts';
import {existingPipelineSemantics} from '../rendering/semantics-pipeline.ts';
import type {HitTestEntry} from '../rendering/object.ts';
import {LayerHandle,OffsetLayer} from '../rendering/layer.ts';
import {AnnotationType} from '../rendering/layer.ts';
import type {AnnotationResult} from '../rendering/layer.ts';
import type {Offset} from '../../ui/geometry.ts';
import {PaintingContext} from '../painting/context.ts';
import {PaintingBinding} from '../painting/binding.ts';
import {withRenderPaint,assertOutsideRenderPaint} from '../rendering/phase.ts';
import {FrameScheduler} from '../scheduler/scheduler.ts';
import {MouseTracker} from '../rendering/mouse-tracker.ts';
import {PointerRouter} from '../gestures/pointer-router.ts';
import {pointerEventFromTransport,pointerEventToTransport} from '../gestures/pointer-event-adapter.ts';
import {PointerScrollEvent,PointerDownEvent,PointerUpEvent,PointerHoverEvent,PointerSignalEvent,PointerCancelEvent,PointerPanZoomEndEvent} from '../gestures/events.ts';
import type {PointerEvent as SourcePointerEvent} from '../gestures/events.ts';
import {GestureBinding,SamplingClock} from '../gestures/binding.ts';
import {HitTestEntry as SourceHitTestEntry,HitTestResult} from '../gestures/hit-test.ts';
import {PointerDeviceKind} from '../../ui/pointer.ts';
import {HitTestResponse,PlatformDispatcher} from '../../ui/platform-dispatcher.ts';
import type {Disposable} from '../../foundation/disposable.ts';
import {SemanticsBinding as SemanticsActionBinding} from '../semantics/binding.ts';
import type {SemanticsHandle} from '../semantics/binding.ts';
import {SemanticsAction,SemanticsActionEvent} from '../../ui/semantics-action.ts';
import {registerTickerScheduler,unregisterTickerScheduler} from './ticker-scheduler.ts';
import {freezeSemantics,flattenSemantics} from '../semantics/semantics.ts';
import type {SemanticsNode as SourceSemanticsNode} from '../semantics/semantics.ts';
import type {HardwareKeyboard,KeyEvent as HardwareKeyEvent} from '../../services/hardware-keyboard.ts';
import {KeyMessage} from '../../services/key-message.ts';
import type {RawKeyboard} from '../../services/raw-keyboard.ts';
import {KeyEventManager} from '../../services/key-event-manager.ts';
import {SystemChannelSet} from '../../services/system-channels.ts';
import type {RawKeyMessage} from '../../services/raw-key-event.ts';
import type {KeyEventResult} from './focus.ts';
const keyboardOwners=new WeakMap<HardwareKeyboard,FrameworkRoot>();
const keyboardDispatches=new WeakSet<HardwareKeyboard>();
interface LogicalPointerStream {readonly nativePointer:number;readonly sourcePointer:number}
/** The embedding owns one semantics request for its accessible View. */
class ViewPipelineManifold extends PipelineManifold {
  constructor(private readonly binding:SemanticsActionBinding,private readonly requestFrame:()=>void){super();}
  override get semanticsEnabled():boolean{return this.binding.semanticsEnabled;}
  override addListener(listener:()=>void):void{this.binding.addSemanticsEnabledListener(listener);}
  override removeListener(listener:()=>void):void{this.binding.removeSemanticsEnabledListener(listener);}
  override requestVisualUpdate():void{this.requestFrame();}
}
class RenderHitTestBuilder extends HitTestResult {
  addRenderEntry(entry:HitTestEntry):void{this.pushTransform(entry.transform);try{const source=entry.createSourceEntry?.()??new SourceHitTestEntry(entry.target);invariant(source.target===entry.target&&source.transform===null,'invalid-source-hit-entry','Render hit entry factory must create a fresh entry for its actual target');this.add(source);entry.onSourceEntry?.(source);}finally{this.popTransform();}}
}
export interface WidgetApplicationOptions {readonly id:string;readonly background?:number;readonly assets?:ApplicationDefinition['assets'];readonly defaultFont?:string|ResourceId;/** Startup opt-out: false skips all accessibility processing for this app. Default: true. */readonly accessibilityEnabled?:boolean;/** Minimum milliseconds between motion-only accessibility snapshots; 0 (default) publishes every changed frame. */readonly semanticsUpdateInterval?:number;readonly createRoot:(context:ViewControllerContext,scheduler:FrameScheduler)=>Widget}
export function widgetApplication(options:WidgetApplicationOptions):ApplicationDefinition {
  return {id:options.id,...(options.accessibilityEnabled!==undefined?{accessibilityEnabled:options.accessibilityEnabled}:{}),...(options.assets?{assets:options.assets}:{}),createView:context=>new FrameworkRoot(context,options)};
}
export class FrameworkRoot implements ViewController {
  readonly scheduler:FrameScheduler;
  readonly buildOwner:BuildOwner;
  readonly pipeline:PipelineOwner;
  private readonly sourceSemanticsSnapshot:SemanticsTransportSnapshot|undefined;
  private semanticsCache:{render:RenderObject;owner:PipelineOwner['semanticsOwner'];viewOwner:SceneContext['token']['owner'];metrics:ViewMetrics;transform:RenderObject['localTransform'];snapshot:readonly SemanticsNode[];nodes:readonly SemanticsNode[]}|undefined;
  private semanticsPublishedAt:number|undefined;
  private semanticsDeferred=false;
  private semanticsWake:number|undefined;
  private semanticsFocus:BuildOwner['focus']['primaryFocus'];
  private pendingSemanticsActions:{source:SourceSemanticsNode;perform:(node:SemanticsNode)=>void}[]=[];
  private readonly viewSemanticsHandle:SemanticsHandle|undefined;
  readonly mouseTracker:MouseTracker;
  readonly pointerRouter=new PointerRouter();
  readonly gestureBinding:GestureBinding;
  private readonly pointerBindingLease:Disposable;private readonly pointerViewLease:Disposable|undefined;private readonly semanticsBindingLease:Disposable;
  private readonly transportKeys=new WeakMap<SourcePointerEvent,LogicalPointerStream>();private readonly transportStreams=new Map<number,LogicalPointerStream>();private readonly sourceTransportStreams=new Map<number,LogicalPointerStream>();private lastLogicalPointer=0;
  /** Logical producers may omit delta. Derive it from actual same-epoch
   * contact positions before the source event enters hit testing/resampling. */
  private readonly transportPositions=new Map<number,{position:Offset;device:PointerEvent['device'];viewportGeneration:number}>();
  private readonly legacyConsumedSignals=new WeakSet<SourcePointerEvent>();
  readonly semanticsActionBinding:SemanticsActionBinding;
  private readonly rawKeyboard:RawKeyboard;private readonly keyEventManager:KeyEventManager;
  private readonly layerRoot=new LayerHandle(new OffsetLayer());
  private root:Element|undefined;
  private closed=false;
  private visible=true;
  private revealingViewportFocus=false;
  private metrics:ViewMetrics|undefined;
  private semantics:SemanticsBinding|undefined;
  private nodes:readonly SemanticsNode[]=[];
  private focused:string|undefined;
  /** Query the most recently composed shared layer tree in logical view coordinates. */
  findAnnotation<T extends {}>(type:AnnotationType<T>,position:Offset):T|null{invariant(!this.closed,'closed-framework-root','Annotation query after root disposal');return this.layerRoot.layer!.find(type,position,this.context.paths?{paths:this.context.paths}:{});}
  findAllAnnotations<T extends {}>(type:AnnotationType<T>,position:Offset):AnnotationResult<T>{invariant(!this.closed,'closed-framework-root','Annotation query after root disposal');return this.layerRoot.layer!.findAllAnnotations(type,position,this.context.paths?{paths:this.context.paths}:{});}
  /** Developer diagnostics use the actual tree; no secondary inspector or global hook. */
  describeTree():string {
    const lines:string[]=[];const visit=(element:Element)=>{const render=element.renderObjects[0];lines.push(`${'  '.repeat(element.depth)}${element.widget.constructor.name}${element.widget.key?' [key]':''}${element.dirty?' dirty':''}${render instanceof RenderBox&&!render.hasSize?' unlaid':render?` ${render.paintBounds.width}x${render.paintBounds.height}`:''}`);for(const child of element.children)visit(child);};
    if(this.root)visit(this.root);return lines.join('\n');
  }
  private renderRoot():RenderBox<RenderObject> {const roots=this.root!.renderObjects;invariant(roots.length===1&&roots[0] instanceof RenderBox,'invalid-render-root','Widget app must produce one RenderBox root');return roots[0];}
  readonly context:ViewControllerContext;
  constructor(context:ViewControllerContext,private readonly options:WidgetApplicationOptions) {
    invariant(Number.isFinite(options.semanticsUpdateInterval??0)&&(options.semanticsUpdateInterval??0)>=0,'invalid-semantics-update-interval','Semantics update interval must be finite nonnegative milliseconds');
    const font=typeof options.defaultFont==='string'?context.assets.get(options.defaultFont):options.defaultFont??context.defaultFont;
    invariant(options.defaultFont===undefined||font,'missing-font','The configured defaultFont asset is not declared');
    this.context=font?{...context,defaultFont:font}:context;context=this.context;
    initializeFoundationBindings();
    this.scheduler=new FrameScheduler(context.clock,context.requestFrame,{...(context.reportError?{reportError:context.reportError}:{}),...(context.requestForcedFrame?{requestForcedFrame:context.requestForcedFrame}:{})});
    const dispatcher=context.binaryMessenger?PlatformDispatcher.maybeForMessenger(context.binaryMessenger):undefined;
    this.semanticsActionBinding=new SemanticsActionBinding({accessibilityEnabled:options.accessibilityEnabled!==false,...(dispatcher?{dispatcher}:{}),scheduler:this.scheduler,viewId:context.platformView?.viewId??context.owner.id,performSemanticsAction:event=>{if(this.closed||!this.visible||typeof event.nodeId!=='number')return;const owner=this.pipeline.semanticsOwner,source=owner?.getSemanticsNode(event.nodeId);if(this.semanticsDeferred){if(source)this.queueSemanticsAction(source,()=>owner!.performAction(source.id,event.type,event.arguments));}else owner?.performAction(event.nodeId,event.type,event.arguments);}});
    if(options.accessibilityEnabled!==false)this.semanticsActionBinding.addAccessibilityFeaturesChangedListener(()=>{if(this.closed)return;const visit=(element:Element)=>{element.markNeedsBuild();for(const child of element.children)visit(child);};if(this.root)visit(this.root);this.scheduler.requestFrame();});
    const invalidate=()=>{if(!this.closed&&!this.revealingViewportFocus&&this.scheduler.phase!=='build'&&this.scheduler.phase!=='transient')this.scheduler.requestFrame();};
    // Layout invalidates paint and semantics that this frame has yet to visit.
    // Widget rebuilds use invalidate directly: their earlier stage may need a
    // new frame even when render work is already covered by the current one.
    const invalidatePipeline=()=>{if(this.scheduler.phase!=='layout')invalidate();};
    // The snapshot transport below consumes the live semantics tree. It does
    // not submit engine packets, so do not build a second copy to dispose it.
    this.buildOwner=new BuildOwner(context,invalidate,callback=>{if(!this.closed)this.scheduler.addPostFrame(callback);},{mouseIsConnected:()=>this.mouseTracker.mouseIsConnected});this.pipeline=new PipelineOwner({accessibilityEnabled:options.accessibilityEnabled!==false,onNeedVisualUpdate:invalidatePipeline,onSemanticsUpdate:update=>update.dispose(),onSemanticsOwnerCreated:()=>this.pipeline.rootNode?.scheduleInitialSemantics(),createSemanticsUpdateBuilder:()=>null,systemFonts:context.platformServices instanceof PaintingBinding?{systemFonts:context.platformServices.systemFonts,scheduler:this.scheduler}:null,...(context.binaryMessenger?{messenger:context.binaryMessenger}:{})});this.layerRoot.layer!.attach(this.pipeline);this.mouseTracker=new MouseTracker(position=>this.pointerHitTest(position),context.owner.id,context.platformServices?.channels.mouseCursor??(context.binaryMessenger?new SystemChannelSet(context.binaryMessenger).mouseCursor:null));
    this.sourceSemanticsSnapshot=options.accessibilityEnabled===false?undefined:new SemanticsTransportSnapshot(this.pipeline,()=>!this.closed&&this.visible,(source,action)=>this.queueSemanticsAction(source,node=>node.actions?.[action]?.()),(source,value,range)=>this.queueSemanticsAction(source,node=>{const current=node.numericRange;if(current&&current.min===range.min&&current.max===range.max&&current.value===range.value&&current.smallChange===range.smallChange&&current.largeChange===range.largeChange)node.rangeActions?.setValue(value);}));
    this.pipeline.attach(new ViewPipelineManifold(this.semanticsActionBinding,invalidatePipeline));
    this.viewSemanticsHandle=options.accessibilityEnabled===false?undefined:this.semanticsActionBinding.ensureSemantics();
    this.gestureBinding=new GestureBinding({implicitViewId:context.owner.id,pointerRouter:this.pointerRouter,gestureArena:this.buildOwner.gestures,scheduler:this.scheduler,clock:new SamplingClock(()=>context.clock.now(),()=>context.clock.now()),devicePixelRatioForView:viewId=>!this.closed&&viewId===context.owner.id?context.readMetrics().scale:null,
      invokeCallback:(timestamp,callback)=>this.buildOwner.focus.runWithFocusRequest({inputTimestamp:timestamp},callback),
      streamKey:event=>this.transportKeys.get(event.original??event)??event.device,
      allowIndependentHitTest:event=>this.transportKeys.has(event.original??event)&&(event instanceof PointerHoverEvent||event instanceof PointerSignalEvent),
      beforeDispatch:event=>{if(this.closed||!this.visible||event.viewId!==context.owner.id)return false;if(event instanceof PointerDownEvent&&!this.claimKeyboard())return false;const canonical=event.original??event,key=this.transportKeys.get(canonical)??this.sourceTransportStreams.get(event.pointer);if(key){this.transportKeys.set(canonical,key);if(event instanceof PointerCancelEvent||event instanceof PointerUpEvent||event instanceof PointerPanZoomEndEvent)this.retireLogicalStream(key);}return true;},
      hitTestInView:(result,position,viewId)=>{if(viewId!==context.owner.id)return;const builder=new RenderHitTestBuilder(result);for(const entry of this.pointerHitTest(position))builder.addRenderEntry(entry);},
      beforeHitTestDispatch:(event,result)=>{if(this.closed||event instanceof PointerSignalEvent)return;const transport=this.legacyPointerEvent(event);if(transport)this.mouseTracker.updateWithEvent(transport,result?result.path.map(entry=>({target:entry.target,transform:entry.transform!})):undefined);},
      shouldDispatchToTarget:(_event,entry)=>!(entry.target instanceof RenderObject)||entry.target.owner===this.pipeline&&(entry.target.handleEvent!==RenderObject.prototype.handleEvent||entry.target.onPointer!==undefined),
      dispatchToTarget:(event,entry)=>{entry.target.handleEvent(event,entry);if(!(entry.target instanceof RenderObject)||entry.target.owner!==this.pipeline||entry.target.onPointer===undefined)return;const canonical=event.original??event;if(event instanceof PointerSignalEvent&&this.legacyConsumedSignals.has(canonical))return;const transport=this.legacyPointerEvent(event);if(transport&&entry.target.onPointer?.(transport)===true&&event instanceof PointerScrollEvent){this.legacyConsumedSignals.add(canonical);this.gestureBinding.pointerSignalResolver.register(event,signal=>signal.respond({allowPlatformDefault:false}));}},
      createCancelEvent:(last,pointer)=>{const cancel=new PointerCancelEvent({pointer,viewId:context.owner.id,...(last?{kind:last.kind===PointerDeviceKind.trackpad?PointerDeviceKind.touch:last.kind,device:last.device,position:last.position}:{})});const key=this.sourceTransportStreams.get(pointer);if(key){this.transportKeys.set(cancel,key);this.retireLogicalStream(key);}return cancel;}
    });
    this.pointerBindingLease=this.buildOwner.bindGestureBinding(this.gestureBinding);
    this.semanticsBindingLease=this.buildOwner.bindSemanticsBinding(this.semanticsActionBinding);
    this.pointerViewLease=context.platformServices?.registerPointerView(context.owner.id,{isLive:()=>!this.closed&&this.visible,devicePixelRatio:()=>context.readMetrics().scale,handlePointerEvent:event=>this.gestureBinding.enqueuePointerEvent(event),hitTest:position=>new HitTestResponse({hasPlatformView:this.gestureBinding.hasPlatformViewAt(position,context.owner.id)})});
    this.rawKeyboard=this.buildOwner.rawKeyboard;
    this.keyEventManager=context.platformServices?.keyEventManager??new KeyEventManager(this.buildOwner.keyboard,this.rawKeyboard,{timeStamp:()=>context.clock.now(),prepareMessage:()=>this.prepareKeyMessage()});
    this.buildOwner.focus.registerGlobalHandlers({pointerRouter:this.pointerRouter,semantics:this.semanticsActionBinding,registerKeyMessageHandler:handler=>{
      const delegate={prepareKeyMessage:()=>this.prepareKeyMessage(),handleKeyMessage:(message:KeyMessage)=>keyboardOwners.get(this.buildOwner.keyboard)===this?this.routeRawKeyMessage(message,handler):false,keyboardFocusLost:()=>this.keyboardFocusLost()};
      if(context.platformServices)return context.platformServices.registerKeyboardView(this,delegate);
      const previous=this.keyEventManager.keyMessageHandler;this.keyEventManager.keyMessageHandler=delegate.handleKeyMessage;
      return {dispose:()=>{if(this.keyEventManager.keyMessageHandler===delegate.handleKeyMessage)this.keyEventManager.keyMessageHandler=previous;}};
    }});
    registerTickerScheduler(this.buildOwner,this.scheduler);
  }
  build(scene:SceneContext):readonly PaintCommand[] {
    invariant(!this.closed,'closed-framework-root','Frame after root disposal');this.scheduler.beginFrame(scene.token.timing?.tick);
    let failed=false,buildError:unknown,painting:PaintingContext|undefined,geometryCommit:ReturnType<RenderObject['commitTextInputGeometries']>|undefined;
    try {
      if(this.closed||this.scheduler.disposed)return [];
      this.scheduler.runPersistentFrameCallbacks();if(this.closed||this.scheduler.disposed)return [];
      this.scheduler.phase='build';
      const buildRevision=this.buildOwner.buildRevision;
      if(!this.root){const root=this.options.createRoot(this.buildOwner.services,this.scheduler).createElement();this.root=root;root.mount(undefined,this.buildOwner);}
      const metricsChanged=this.metrics?.viewportGeneration!==scene.token.metrics.viewportGeneration || this.metrics?.rendererGeneration!==scene.token.metrics.rendererGeneration;
      if(metricsChanged){this.cancelPointers();if(this.metrics?.rendererGeneration!==scene.token.metrics.rendererGeneration){const visit=(element:Element)=>{element.markNeedsBuild();for(const child of element.children)visit(child);};visit(this.root);}else this.buildOwner._viewMetricsChanged();}
      this.metrics=scene.token.metrics;
      this.buildOwner.flushBuild();
      let render=this.renderRoot();this.pipeline.setRoot(render);
      this.buildOwner.maybeViewWorkBudget?.enforcePressure();
      this.scheduler.phase='layout';this.pipeline.flushLayout({width:scene.token.metrics.logicalWidth,height:scene.token.metrics.logicalHeight});
      if(metricsChanged&&this.buildOwner.focus.primaryFocus){
        this.revealingViewportFocus=true;
        try{this.buildOwner.focus.primaryFocus.showOnScreen();if(this.buildOwner.hasDirty){this.scheduler.phase='build';this.buildOwner.flushBuild();render=this.renderRoot();this.pipeline.setRoot(render);}this.scheduler.phase='layout';this.pipeline.flushLayout({width:scene.token.metrics.logicalWidth,height:scene.token.metrics.logicalHeight});}
        finally{this.revealingViewportFocus=false;}
        if(this.buildOwner.hasDirty)this.scheduler.requestFrame();
      }
      const workBudget=this.buildOwner.maybeViewWorkBudget;workBudget?.enforcePressure();if(workBudget?.scheduleEvictions())this.pipeline.flushLayout();
      workBudget?.runOptional(scene.token.timing,()=>this.context.clock.now(),()=>!this.closed&&this.visible&&!this.buildOwner.hasDirty&&scene.canRunOptionalWork?.()===true,()=>{if(!this.closed&&!this.pipeline.debugDisposed)this.pipeline.flushLayout();},()=>this.scheduler.requestFrame());
      if(this.closed||this.scheduler.disposed)return [];
      this.scheduler.phase='paint';painting=new PaintingContext(null,null,true);
      this.recordPaint(render,painting);
      withRenderPaint(()=>painting!.compose(this.layerRoot.layer!,{x:0,y:0,width:scene.token.metrics.logicalWidth,height:scene.token.metrics.logicalHeight},this.context.pictures??null));
      painting.commands.unshift({op:'clear',color:this.options.background??0xff101827});
      geometryCommit=render.commitTextInputGeometries({owner:scene.token.owner,metrics:scene.token.metrics});
      if(this.sourceSemanticsSnapshot){
        this.scheduler.phase='semantics';
        const rebuilt=this.buildOwner.buildRevision!==buildRevision;
        const cached=this.semanticsCache,semanticsPipeline=existingPipelineSemantics(this.pipeline),currentTransform=render.localTransform,metrics=scene.token.metrics;
        const sameScope=!!cached&&cached.render===render&&cached.owner===this.pipeline.semanticsOwner&&cached.viewOwner.id===scene.token.owner.id&&cached.viewOwner.generation===scene.token.owner.generation&&(Object.keys(metrics) as (keyof ViewMetrics)[]).every(key=>cached.metrics[key]===metrics[key])&&cached.transform.length===currentTransform.length&&currentTransform.every((value,index)=>Object.is(value,cached.transform[index]));
        let reuse=sameScope&&!this.semanticsDeferred&&this.pendingSemanticsActions.length===0&&!geometryCommit.hasInputGeometry&&!semanticsPipeline?.hasPendingChanges;
        const now=this.scheduler.currentSystemFrameTimeStamp,elapsed=this.semanticsPublishedAt===undefined?Infinity:now-this.semanticsPublishedAt;
        const defer=!reuse&&sameScope&&(!rebuilt||semanticsPipeline?.dirty.size===0)&&!geometryCommit.hasInputGeometry&&this.semanticsFocus===this.buildOwner.focus.primaryFocus&&!this.pipeline.semanticsOwner?.hasPendingUpdates&&elapsed>=0&&elapsed<(this.options.semanticsUpdateInterval??0);
        if(defer){
          // Keep dirty work queued; actions request an earlier fresh snapshot.
          // A one-shot host frame also delivers the trailing update after motion stops.
          this.semanticsDeferred=true;this.sourceSemanticsSnapshot.defer();
          if(this.semanticsWake===undefined)this.semanticsWake=this.scheduler.scheduleFrameCallback(()=>{this.semanticsWake=undefined;});
        }else{
          this.cancelSemanticsWake();this.semanticsDeferred=false;
          if(!reuse)this.sourceSemanticsSnapshot.invalidate();this.pipeline.flushSemantics();
          if(reuse&&semanticsPipeline?.hasPendingChanges){reuse=false;this.sourceSemanticsSnapshot.invalidate();}
          let snapshot:readonly SemanticsNode[];
          if(reuse){snapshot=cached!.snapshot;this.nodes=cached!.nodes;}
          else{const candidate=this.sourceSemanticsSnapshot.capture(render,render.localTransform,{owner:scene.token.owner,metrics,inputGeometryToken:geometryCommit.token});snapshot=freezeSemantics(candidate.nodes);candidate.commit();this.nodes=flattenSemantics(snapshot);this.semanticsPublishedAt=now;this.semanticsFocus=this.buildOwner.focus.primaryFocus;this.semanticsCache=!geometryCommit.hasInputGeometry&&!this.nodes.some(node=>node.role==='text-field')?{render,owner:this.pipeline.semanticsOwner,viewOwner:{...scene.token.owner},metrics:{...metrics},transform:captureTransform(render.localTransform),snapshot,nodes:this.nodes}:undefined;}
          this.semanticsActionBinding.updateViewSemantics(this.context.platformView?.viewId??this.context.owner.id,snapshot,this.context.owner.id);
          if(this.context.semantics.capability!=='unavailable'){
            if(this.semantics?.update)this.semantics.update(snapshot);
            else {this.semantics?.dispose();this.semantics=undefined;if(snapshot.length)this.semantics=this.context.semantics.bind(snapshot,{
              dispatchAction:(id,action,perform)=>{if(this.closed||!this.visible)return;const node=this.nodes.find(value=>value.id===id);if(!node?.enabled)return;const type={activate:SemanticsAction.tap,focus:SemanticsAction.focus,'scroll-forward':SemanticsAction.scrollDown,'scroll-backward':SemanticsAction.scrollUp,increase:SemanticsAction.increase,decrease:SemanticsAction.decrease,'long-press':SemanticsAction.longPress,'scroll-left':SemanticsAction.scrollLeft,'scroll-right':SemanticsAction.scrollRight,'scroll-up':SemanticsAction.scrollUp,'scroll-down':SemanticsAction.scrollDown}[action];this.semanticsActionBinding.handleSemanticsActionEvent(new SemanticsActionEvent({type,viewId:this.context.owner.id,nodeId:id}),()=>{if(!this.closed&&this.visible)perform();});},
              dispatchTextAction:(id,action,perform)=>{if(this.closed||!this.visible)return;const node=this.nodes.find(value=>value.id===id);if(!node?.enabled)return;const type=action.kind==='set-text'?SemanticsAction.setText:action.kind==='set-selection'?SemanticsAction.setSelection:SemanticsAction.showOnScreen,args=action.kind==='set-text'?action.text:action.kind==='set-selection'?new Map([['base',action.anchor],['extent',action.focus]]):Object.freeze({start:action.start,end:action.end,alignToTop:action.alignToTop});this.semanticsActionBinding.handleSemanticsActionEvent(new SemanticsActionEvent({type,arguments:args,viewId:this.context.owner.id,nodeId:id}),()=>{if(!this.closed&&this.visible)perform();});},
              // Absolute numeric values are a Nelyx transport extension. Keep
              // their typed arguments rather than reporting a relative step.
              dispatchRangeAction:(id,action,perform)=>{if(this.closed||!this.visible||!this.nodes.find(value=>value.id===id)?.enabled)return;this.semanticsActionBinding.handleSemanticsActionEvent(new SemanticsActionEvent({type:SemanticsAction.customAction,arguments:action,viewId:this.context.owner.id,nodeId:id}),()=>{if(!this.closed&&this.visible)perform();});},
              observePointer:event=>{if(!this.closed)this.pointerRouter.route(pointerEventFromTransport({...event,pointer:0,viewportGeneration:this.context.readMetrics().viewportGeneration},{viewId:this.context.owner.id}));}
            });}
          }
          if(!this.nodes.some(node=>node.id===this.focused))this.focused=undefined;
          if(this.pendingSemanticsActions.length)this.scheduler.addPostFrameCallback(()=>this.performPendingSemanticsAction());
        }
      }
      // An isolated layout builder can dirty the already-flushed default Widget
      // scope while BuildOwner is inside that isolated build. Its normal wakeup
      // is suppressed then, but the pending Widget must run on the next frame.
      if(this.buildOwner.defaultBuildScope.hasDirty)this.scheduler.requestFrame();
      this.scheduler.addPostFrameCallback(()=>{if(!this.closed)this.mouseTracker.updateAllDevices();});return painting.commands;
    }catch(error){this.cancelSemanticsWake();this.pendingSemanticsActions=[];this.semanticsCache=undefined;this.semanticsDeferred=false;this.sourceSemanticsSnapshot?.invalidate();failed=true;buildError=error;throw error;}
    finally{
      const errors:unknown[]=[];for(const finish of [()=>this.buildOwner.finalizeTree(),()=>this.scheduler.endFrame()])try{finish();}catch(error){this.pendingSemanticsActions=[];errors.push(error);}
      const phase=this.scheduler.phase;if(!this.scheduler.disposed)this.scheduler.phase='post-frame';
      try{if(failed||errors.length)geometryCommit?.discard();else geometryCommit?.commit();}
      catch(error){errors.push(error);try{geometryCommit?.discard();}catch(cleanup){errors.push(cleanup);}}
      finally{if(!this.scheduler.disposed)this.scheduler.phase=phase;}
      if(failed||errors.length)try{painting?.dispose();}catch(error){errors.push(error);}if(errors.length){if(failed)errors.unshift(buildError);throw new AggregateError(errors,'Frame build/finalization failed');}
    }
  }
  /** One recording boundary, separate from retained layer composition. */
  private recordPaint(render:RenderObject,painting:PaintingContext):void {
    painting.save();painting.transform(render.localTransform);withRenderPaint(()=>render.paint(painting));painting.restore();
  }
  pointer(event:PointerEvent):void {
    if(this.closed||!this.visible)return;
    invariant(Number.isSafeInteger(event.pointer),'invalid-logical-pointer','Logical pointer identity must be a safe integer');
    let key=this.transportStreams.get(event.pointer);
    if(event.kind==='down'||event.kind==='panZoomStart'){invariant(!key,'duplicate-logical-pointer','A logical device pointer already has an active contact');const pointer=event.pointer>this.lastLogicalPointer?event.pointer:this.lastLogicalPointer+1;invariant(Number.isSafeInteger(pointer),'logical-pointer-space-exhausted','No safe contact identifier remains');this.lastLogicalPointer=pointer;key={nativePointer:event.pointer,sourcePointer:pointer};this.transportStreams.set(event.pointer,key);this.sourceTransportStreams.set(pointer,key);}
    const position=event.globalPosition??{x:event.x,y:event.y},previous=this.transportPositions.get(event.pointer),sameContact=previous?.device===event.device&&previous.viewportGeneration===event.viewportGeneration;
    const globalDelta=event.kind==='move'&&event.globalDelta===undefined&&sameContact?{x:event.deltaX??position.x-previous.position.x,y:event.deltaY??position.y-previous.position.y}:event.globalDelta;
    if(event.kind==='down'||event.kind==='move'&&sameContact)this.transportPositions.set(event.pointer,{position:{x:position.x,y:position.y},device:event.device,viewportGeneration:event.viewportGeneration});
    else if(event.kind==='up'||event.kind==='cancel'||event.kind==='move')this.transportPositions.delete(event.pointer);
    const contact=event.kind==='down'||event.kind==='move'||event.kind==='up'||event.kind==='cancel'||event.kind==='panZoomStart'||event.kind==='panZoomUpdate'||event.kind==='panZoomEnd';
    const sourceEvent=pointerEventFromTransport({...event,pointer:contact&&key?key.sourcePointer:0,...(globalDelta?{globalDelta}:{}),viewId:this.context.owner.id});
    if(event.kind==='leave'){this.mouseTracker.updateWithEvent(event,[]);if(!this.closed)this.pointerRouter.route(sourceEvent);return;}
    key??={nativePointer:event.pointer,sourcePointer:sourceEvent.pointer};this.transportKeys.set(sourceEvent.original??sourceEvent,key);
    if(event.kind==='up'||event.kind==='cancel'||event.kind==='panZoomEnd')this.transportStreams.delete(event.pointer);
    this.gestureBinding.enqueuePointerEvent(sourceEvent);
  }
  /** Source pointers identify contacts, while the old DTO keeps device IDs. */
  private legacyPointerEvent(event:SourcePointerEvent):PointerEvent|null{const transport=pointerEventToTransport(event,this.context.readMetrics().viewportGeneration),key=this.transportKeys.get(event.original??event);return transport&&key?{...transport,pointer:key.nativePointer}:transport;}
  private retireLogicalStream(key:LogicalPointerStream):void{if(this.sourceTransportStreams.get(key.sourcePointer)===key)this.sourceTransportStreams.delete(key.sourcePointer);if(this.transportStreams.get(key.nativePointer)===key){this.transportStreams.delete(key.nativePointer);this.transportPositions.delete(key.nativePointer);}}
  private pointerHitTest(position:Offset):readonly HitTestEntry[]{const root=this.pipeline.root,path:HitTestEntry[]=[];if(root instanceof RenderBox){const matrix=inversePaintTransform(root.localTransform);if(matrix)root.hitTest(transform(matrix,position),path,matrix);}return path;}
  key(event:KeyEvent):boolean {
    if(this.closed)return false;
    const keyboard=this.buildOwner.keyboard;
    invariant(!keyboardDispatches.has(keyboard)&&!keyboard.isDispatching,'reentrant-key-dispatch','Nested view keyboard dispatch is not supported');
    keyboardDispatches.add(keyboard);
    try{
    // Native bridges can deliver several keys in one JS turn. Complete the
    // previous event's requested focus before routing the next transport.
    if(!this.claimKeyboard())return false;
    return this.buildOwner.focus.handleTransportKeyEvent(event,()=>keyboard.handleTransportMessage(event,events=>keyboardOwners.get(keyboard)===this?this.routeKeyMessage(events):false));
    }finally{keyboardDispatches.delete(keyboard);}
  }
  private prepareKeyMessage():void{if(!this.closed)this.buildOwner.focus.applyFocusChangesIfNeeded();}
  private claimKeyboard():boolean{
    const keyboard=this.buildOwner.keyboard;invariant(!keyboard.isDispatching,'reentrant-key-dispatch','Cannot transfer view keyboard ownership during dispatch');
    this.prepareKeyMessage();if(this.closed)return false;
    const previous=keyboardOwners.get(keyboard);if(previous&&previous!==this)previous.keyboardFocusLost();if(this.closed)return false;
    this.context.platformServices?.activateKeyboardView(this);keyboardOwners.set(keyboard,this);return true;
  }
  keyboardFocusGained():void{if(this.closed)return;invariant(!keyboardDispatches.has(this.buildOwner.keyboard),'reentrant-key-dispatch','Nested view keyboard dispatch is not supported');this.claimKeyboard();}
  rawKey(message:RawKeyMessage,transport?:KeyEvent):boolean{
    if(this.closed)return false;const keyboard=this.buildOwner.keyboard;
    invariant(!keyboardDispatches.has(keyboard)&&!keyboard.isDispatching,'reentrant-key-dispatch','Nested view keyboard dispatch is not supported');keyboardDispatches.add(keyboard);
    try{if(!this.claimKeyboard())return false;return this.keyEventManager.handleRawKeyMessageSync(message,transport).get('handled')===true;}finally{keyboardDispatches.delete(keyboard);}
  }
  private routeKey(event:HardwareKeyEvent):boolean{return this.routeKeyMessage([event]);}
  private routeKeyMessage(events:readonly HardwareKeyEvent[]):boolean{
    return this.routeRawKeyMessage(new KeyMessage(events,null));
  }
  private routeRawKeyMessage(message:KeyMessage,handler?:(message:KeyMessage)=>KeyEventResult):boolean{
    if(this.closed)return false;
    const focusResult=handler?handler(message):this.buildOwner.focus.dispatchKeyMessage(message);if(focusResult!=='ignored')return focusResult==='handled';
    let handled=false;for(const event of message.events){if(this.closed)break;handled=this.routeLegacyKey(event)||handled;}return handled;
  }
  private routeLegacyKey(event:KeyEvent):boolean {
    if(event.kind!=='down')return false;
    for(const handler of [...this.buildOwner.keyHandlers].reverse())if(handler(event))return true;
    if(!this.sourceSemanticsSnapshot)return false;
    const enabled=this.nodes.filter(node=>node.enabled&&node.focusable!==false&&(node.activate||node.actions));
    if(event.key==='Tab'&&enabled.length){const index=enabled.findIndex(node=>node.id===this.focused),next=enabled[(index+(event.shift?-1:1)+enabled.length)%enabled.length]!;this.focused=next.id;if(next.actions?.focus)next.actions.focus();else if(next.role==='text-field')next.activate?.();return true;}
    else if((event.key==='Enter'||event.key===' ')&&!event.repeat){const action=enabled.find(node=>node.id===this.focused)?.activate;if(action){action();return true;}}
    else if(['ArrowDown','PageDown','ArrowUp','PageUp'].includes(event.key)){const action=enabled.find(node=>node.id===this.focused)?.actions?.[event.key==='ArrowDown'||event.key==='PageDown'?'scroll-forward':'scroll-backward'];if(action){action();return true;}}
    return false;
  }
  keyboardFocusLost():void{const keyboard=this.buildOwner.keyboard;if(!this.closed&&keyboardOwners.get(keyboard)===this){keyboardOwners.delete(keyboard);this.context.platformServices?.releaseKeyboardView(this);this.keyEventManager.resetForFocusLoss();keyboard.releaseAllKeys(undefined,event=>this.routeKey(event));}}
  private cancelPointers():void {
    this.transportPositions.clear();try{this.gestureBinding.cancelActivePointers();}finally{this.transportStreams.clear();this.sourceTransportStreams.clear();}
  }
  private queueSemanticsAction(source:SourceSemanticsNode,perform:(node:SemanticsNode)=>void):void{invariant(this.pendingSemanticsActions.length<128,'semantics-action-budget','Pending accessibility actions exceed the View budget');this.pendingSemanticsActions.push({source,perform});this.semanticsPublishedAt=undefined;this.scheduler.requestFrame();}
  private performPendingSemanticsAction():void{
    while(!this.closed&&this.visible&&this.pendingSemanticsActions.length){
      const action=this.pendingSemanticsActions.shift()!,owner=this.pipeline.semanticsOwner;
      if(action.source.owner!==owner||owner?.getSemanticsNode(action.source.id)!==action.source)continue;
      const node=this.nodes.find(node=>node.sourceNodeId===action.source.id);if(!node?.enabled)continue;
      // An action may open a modal or remove another target. Reconcile the
      // resulting frame before admitting the next queued action.
      try{action.perform(node);}finally{if(this.pendingSemanticsActions.length){this.semanticsPublishedAt=undefined;this.scheduler.requestFrame();}}
      break;
    }
  }
  private cancelSemanticsWake():void{if(this.semanticsWake!==undefined){this.scheduler.cancelFrameCallbackWithId(this.semanticsWake);this.semanticsWake=undefined;}}
  setVisible(visible:boolean):void {if(this.closed)return;if(!visible)this.buildOwner.maybeViewWorkBudget?.cancelPreparation();if(this.visible!==visible){this.cancelSemanticsWake();this.pendingSemanticsActions=[];this.semanticsDeferred=false;this.semanticsCache=undefined;this.sourceSemanticsSnapshot?.invalidate();}this.visible=visible;if(!visible&&this.sourceSemanticsSnapshot)this.semanticsActionBinding.updateViewSemantics(this.context.owner.id,[]);const errors:unknown[]=[];if(!visible)for(const stop of [()=>this.cancelPointers(),()=>this.mouseTracker.clearDevices(),()=>this.keyboardFocusLost()])try{stop();}catch(error){errors.push(error);}try{this.scheduler.setVisible(visible);}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'View input visibility transition failed');}
  shouldSubmitFrame():boolean{return this.scheduler.sendFramesToEngine;}
  frameSubmitted(_token:FrameBuildToken):void{this.scheduler.markFirstFrameSubmitted();}
  dispose():void {
    this.buildOwner.maybeViewWorkBudget?.cancelPreparation();
    this.cancelSemanticsWake();
    this.pendingSemanticsActions=[];
    this.semanticsCache=undefined;
    assertOutsideRenderPaint();
    if(this.closed)return;const errors:unknown[]=[];try{this.keyboardFocusLost();}catch(error){errors.push(error);}this.closed=true;
    for(const dispose of [()=>this.pointerViewLease?.dispose(),()=>this.gestureBinding.dispose(),()=>this.pointerBindingLease.dispose(),()=>{this.transportStreams.clear();this.sourceTransportStreams.clear();this.transportPositions.clear();},()=>{if(!this.context.platformServices)this.keyEventManager.dispose();},()=>this.scheduler.dispose(),()=>this.mouseTracker.dispose(),()=>this.semantics?.dispose(),()=>{if(this.layerRoot.layer?.attached)this.layerRoot.layer.detach();},()=>this.layerRoot.dispose(),()=>this.root?.unmount(),()=>this.viewSemanticsHandle?.dispose(),()=>this.pipeline.detach(),()=>this.pipeline.dispose(),()=>this.semanticsBindingLease.dispose(),()=>this.buildOwner.dispose(),()=>this.semanticsActionBinding.dispose()])try{dispose();}catch(error){errors.push(error);}
    unregisterTickerScheduler(this.buildOwner);this.root=undefined;this.nodes=[];if(errors.length)throw new AggregateError(errors,'framework root teardown failed');
  }
}
