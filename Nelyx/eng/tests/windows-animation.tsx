// SPDX-License-Identifier: BSD-3-Clause
// Real sample actions. Optional profiling wraps callers; product source stays intact.
import {AppRegistry,NativeModules,DeviceEventEmitter} from 'react-native';
// This fixture is copied into the runner. Observe the exact installed internal
// pool used by the RN surface; importing the public dist alias would wrap a
// different class from the RN source module and miss its asset lifetime.
import {SharedAssetPool} from './node_modules/@nelyx/sdk/src/backends/shared-assets.ts';
import {ViewRuntime} from '@nelyx/core/hosting/runtime';
import {FrameworkRoot} from '@nelyx/core/framework/widgets/root';
import {GlobalKey} from '@nelyx/core/framework/widgets/global-key';
import {GestureBinding} from '@nelyx/core/framework/gestures/binding';
import {ScrollPositionWithSingleContext} from '@nelyx/core/framework/widgets/scroll-position-with-single-context';
import {PaintingContext} from '@nelyx/core/framework/painting/context';
import {CustomPaint} from '@nelyx/core/framework/widgets/custom-paint';
import {CustomPainter} from '@nelyx/core/framework/rendering/custom-paint';
import {RenderRepaintBoundary} from '@nelyx/core/framework/rendering/repaint-boundary';
import {RenderObject,RenderBox,PipelineOwner} from '@nelyx/core/framework/rendering/object';
import {SceneBuilder} from '@nelyx/core/ui/scene';
import {BuildOwner,Element,RenderObjectElement} from '@nelyx/core/framework/widgets/framework';
import {SliverMultiBoxAdaptorElement} from '@nelyx/core/framework/widgets/sliver';
import {ListView} from '@nelyx/core/framework/widgets/scroll-view';
import {RenderSliverMultiBoxAdaptor} from '@nelyx/core/framework/rendering/sliver-multi-box-adaptor';
import {TextLayoutCache} from '@nelyx/core/hosting/text-layout-cache';
import {ResourceRegistry} from '@nelyx/core/hosting/resources';
import {NativeTextLayoutService} from '@nelyx/skia-native/text';
import {Canvas} from '@nelyx/core/ui/canvas';
import {FrameRecording} from '@nelyx/core/ui/frame';
import {PictureRecorder} from '@nelyx/core/ui/picture-recorder';
import {TextPainter} from '@nelyx/core/framework/painting/text-painter';
import {Paragraph} from '@nelyx/core/ui/paragraph';
import {ParagraphBuilder} from '@nelyx/core/ui/paragraph-builder';
import {FrameScheduler} from '@nelyx/core/framework/scheduler/scheduler';
import {FramePictureService} from '@nelyx/core/hosting/pictures';
// This fixture is copied beside main.tsx in the runner; probe that installed SDK instance.
import {NativeInteraction} from './node_modules/@nelyx/sdk/src/runtime/native-interaction';
import {windowsMonotonicTimestamp} from './node_modules/@nelyx/sdk/src/platforms/windows/frame-clock';
import {nativeInputProps} from './node_modules/@nelyx/sdk/src/backends/react-native/input';
import {existingPipelineSemantics} from './node_modules/@nelyx/core/dist/framework/rendering/semantics-pipeline';
import {SemanticsBinding} from '@nelyx/core/framework/semantics/binding';
import {SemanticsNode,SemanticsOwner} from '@nelyx/core/framework/semantics/semantics';
import {GraphiteRenderer} from '@nelyx/skia-native/renderer';
import {ComponentsGallery} from '../../src/gallery';
import {ListViewPage} from '../../src/list-view';
import {Theme} from '@nelyx/material/theme';
import {TextField} from '@nelyx/material/text-field';
import {GallerySection} from '../../src/gallery-section';
import {demos} from '../../src/catalog';
import {cupertinoDemos} from '../../src/cupertino-catalog';
import {FlutterError} from '@nelyx/core/foundation/flutter-error';
import {Curves} from '@nelyx/core/framework/animation/curves';
import {transform} from '@nelyx/core/ui/geometry';
import {Color} from '@nelyx/core/ui/color';
import {Rect} from '@nelyx/core/ui/rect';
import {Paint} from '@nelyx/core/ui/paint';
import {TextStyle} from '@nelyx/core/framework/painting/text-style';
import * as BasicWidgets from '@nelyx/core/framework/widgets/basic';
import * as TransitionWidgets from '@nelyx/core/framework/widgets/transitions';
import * as DataWidgets from '@nelyx/core/framework/widgets/app-data';
import * as SemanticWidgets from '@nelyx/core/framework/widgets/semantics';
import * as NavigationWidgets from '@nelyx/core/framework/widgets/navigation';
import * as RenderBoxes from '@nelyx/core/framework/rendering/boxes';
import * as ParagraphRenderers from '@nelyx/core/framework/rendering/paragraph';
import * as CupertinoWidgets from '@nelyx/cupertino/widgets';
import './main.tsx';
const host=NativeModules.NelyxAnimation,traceFlags:number|null=typeof host.traceFlags==='function'?host.traceFlags():null;
const childPolicy:string=host.childPolicy?.()??'legacy';
if(!['legacy','bounded','observed-budget'].includes(childPolicy))throw Error('Unknown fixture child policy');
if(childPolicy!=='legacy'){
 // Explicit fixture-only policy experiments leave product sources unchanged.
 // Unsupported/cache-specific consumers retain their original contract.
 const builder=ListView.builder;
 ListView.builder=function(options){const eligible=(typeof options.itemExtent==='number'&&options.itemExtent>0||options.extentIndex!=null)&&options.cacheExtent===undefined&&options.scrollCacheExtent===undefined&&!options.shrinkWrap&&options.childPolicy===undefined;return builder.call(this,eligible?{...options,childPolicy:{mode:'bounded',preparation:childPolicy==='observed-budget'?'observed-budget':'disabled'}}:options);};
}
const diagnostic=traceFlags===null?__DIAGNOSTIC__:(traceFlags&2)!==0,trace=(traceFlags===null?__TRACE__:(traceFlags&1)!==0)||diagnostic,mode:string=__MODE__,resize=__RESIZE__||mode==='live-resize',resizeCase:string=__RESIZE_CASE__,semanticsInterval:number|null=__SEMANTICS_INTERVAL__;
const v8Profile=__V8_PROFILE__;
// An intentionally empty RN root exercises the actual native 30s deadline.
// No Core surface is created and no timer or failure is substituted in the SDK.
AppRegistry.registerComponent('NelyxStartupDeadlineProbe',()=>()=>null);
if(mode==='startup-probe'){
 let seenAssets=false,seenBuild=false;const acquire=SharedAssetPool.prototype.acquire,build=FrameworkRoot.prototype.build;
 SharedAssetPool.prototype.acquire=function(...args:Parameters<typeof acquire>){const first=!seenAssets;seenAssets=true;if(first)host.startupStage('asset-load-start');const lease=acquire.apply(this,args);if(first)void lease.ready.then(()=>host.startupStage('asset-font-ready'));return lease;};
 FrameworkRoot.prototype.build=function(...args:Parameters<typeof build>){if(seenBuild)return build.apply(this,args);seenBuild=true;host.startupStage('core-first-build-start');try{return build.apply(this,args);}finally{host.startupStage('core-first-build-finished');}};
}
const continuousInput=host.continuousScroll?.()===true;
const fullCatalog=continuousInput&&host.fullCatalog?.()===true;
const cpuOnly=mode==='cpu-timing'||mode==='research-engine'||mode==='live-resize'||mode==='semantics-scroll'||mode==='gallery-scroll';
const wheelInput:boolean=__WHEEL_INPUT__;
const wheelInputMode:string=__WHEEL_INPUT_MODE__;
const wheelInterval:number=__WHEEL_INTERVAL__,wheelDelta:number=__WHEEL_DELTA__;
const wheelWarmup:boolean=/*__WHEEL_WARMUP__*/false;
const wheelHover:boolean=__WHEEL_HOVER__;
const viewport:string=__VIEWPORT__;
let livenessColor=0xff222222;
if(mode==='render-liveness'){
 class LivenessPainter extends CustomPainter{
  override paint(canvas:Canvas):void{canvas.rect({x:0,y:0,width:24,height:24},livenessColor);}
  override shouldRepaint():boolean{return true;}
 }
 const build=FrameworkRoot.prototype.build,wrapped=new WeakSet<object>();
 FrameworkRoot.prototype.build=function(...args:Parameters<typeof build>){
  if(!wrapped.has(this)){wrapped.add(this);const controller=this as any,createRoot=controller.options.createRoot;
   controller.options={...controller.options,createRoot:(...rootArgs:any[])=>new BasicWidgets.Stack([createRoot(...rootArgs),new BasicWidgets.Positioned(new CustomPaint(new BasicWidgets.SizedBox(24,24),{painter:new LivenessPainter()}),{left:8,top:72,width:24,height:24})],{fit:'expand'})};
  }
  return build.apply(this,args);
 };
}
let galleryInteraction:any;
const interactionPrototype=NativeInteraction.prototype as any,originalGalleryPublish=(mode==='gallery-regression'||mode==='full-runtime-regression')?interactionPrototype.publish:undefined;
if(originalGalleryPublish)interactionPrototype.publish=function(...args:any[]){galleryInteraction=this;return originalGalleryPublish.apply(this,args);};
let view:any,phase='',stats:Record<string,number[]>={},exclusive:Record<string,number[]>={},counts:Record<string,number>={},gcBefore:Record<string,unknown>={},lastBuild=0,tree:Record<string,number>={};
let classOwners:Record<string,{n:number;selfMs:number;maxSelfMs:number}>={};
let longFrames:Array<Record<string,number>>=[];
const resizeTimeline=mode==='live-resize'&&trace,resizeSpanStages:Record<string,number>={'Pipeline.flushLayout':27,'Root.recordPaint':29,'Pipeline.flushSemantics':31,'Painting.compose':33,'Frame.capture':35};
let resizeTimelineView=0,resizeTimelineToken:any,resizeCpuEvents:ResizeCpuEvent[]=[],resizeCpuOverflow=false;
let resizeRequestSources:Record<string,{attempts:number;scheduled:number;withTransient:number;firstStack?:string}>={};
function resizeSpan(stage:number,token=resizeTimelineToken):void{
 if(!resizeTimeline||!phase||!resizeTimelineView||!token)return;
 const metrics=token.metrics;if(metrics.nativeSurfaceGeneration===null)return;
 if(resizeCpuEvents.length>=4096){resizeCpuOverflow=true;return;}
 const nativeTimestamp=(globalThis as any).NelyxWindowsHost.getMonotonicTime();if(!Number.isFinite(nativeTimestamp))throw Error('Resize CPU span requires the native QPC clock');
 resizeCpuEvents.push({stage,view:resizeTimelineView,surfaceGeneration:metrics.nativeSurfaceGeneration,viewportGeneration:metrics.viewportGeneration,ownerGeneration:token.owner.generation,contextGeneration:metrics.nativeContextGeneration,frameSequence:token.sequence,nativeTimestamp});
}
const fixtureInput=wheelInputMode==='queued'?nativeInputProps('windows',()=>view):undefined;
const fixtureWheel=fixtureInput?DeviceEventEmitter.addListener('nelyxFixtureWheel',native=>{
 (fixtureInput.onWindowsWheel as (event:unknown)=>void)({nativeEvent:native});
}):undefined;
const classNames=new Map<Function,string>();let privateClass=0;
if(diagnostic)for(const exports of [BasicWidgets,TransitionWidgets,DataWidgets,SemanticWidgets,NavigationWidgets,RenderBoxes,ParagraphRenderers,CupertinoWidgets])for(const [name,type]of Object.entries(exports))if(typeof type==='function'&&!classNames.has(type))classNames.set(type,name);
function className(value:object):string{const type=value.constructor;let name=classNames.get(type);if(name===undefined){name='private#'+(++privateClass)+'('+Object.keys(value).slice(-12).join(',')+')';classNames.set(type,name);}return name;}
const stack:Array<{children:number}>=[],nativeContexts=new WeakMap<object,any>(),observedRenderers=new WeakSet<object>();
const allocationScopes=new Set(['Root.build','Painting.compose','Pipeline.flushLayout','Pipeline.flushSemantics','Geometry.commitTextInputGeometries','Semantics.capture','Semantics.updateViewSemantics','Widgets.flushBuild']);
function sample(label:string,value:number){if(phase)(stats[label]??=[]).push(value);}
function count(label:string,value=1){if(phase)counts[label]=(counts[label]??0)+value;}
function counted<This,Args extends unknown[],Result>(original:(this:This,...args:Args)=>Result,label:string,inspect?:(args:Args)=>void){return function(this:This,...args:Args):Result{count(label);inspect?.(args);return original.apply(this,args);};}
const mountedGallerySections=new Set<Element>();
let observeContinuousCoverage:(()=>void)|undefined;
if(wheelInput||mode==='research-engine'||mode==='gallery-scroll'){
 // Observe registration, not recursive lifecycle entry. Wrapping unmount adds
 // persistent JS/native call frames at every level of a deep product tree.
 const register=BuildOwner.prototype.register,unregister=BuildOwner.prototype.unregister;
 BuildOwner.prototype.register=function(element){const result=register.call(this,element);count('Element.mount');if(continuousInput&&element.widget instanceof GallerySection)mountedGallerySections.add(element);return result;};
 BuildOwner.prototype.unregister=function(element){const result=unregister.call(this,element);count('Element.unmount');mountedGallerySections.delete(element);return result;};
}
if(continuousInput){
 // Time each actual adapter insertion plus its first child layout, including
 // synchronous lazy builds. No per-descendant timer or instance shape change.
 for(const name of ['insertAndLayoutChild','insertAndLayoutLeadingChild']){
  const prototype=RenderSliverMultiBoxAdaptor.prototype as any,original=prototype[name];
  prototype[name]=function(...args:any[]){const before=counts['Element.mount']??0,start=performance.now();let completed=false;
   try{const value=original.apply(this,args);completed=true;return value;}finally{const mounted=(counts['Element.mount']??0)-before;if(phase&&completed&&mounted>0){sample('Item.createBuildFirstLayout',performance.now()-start);count('Item.createdRows');count('Item.createdElements',mounted);}}
  };
 }
}
function measured<T>(label:string,callback:()=>T):T{const boot=bootTracing&&(label==='Picture.nativeCompile'||label==='Picture.endRecording');if(boot)bootMark(label+' enter');const allocation=diagnostic&&phase&&allocationScopes.has(label)?gc().js_totalAllocatedBytes:undefined,start=performance.now(),entry={children:0},resizeStage=resizeTimeline?resizeSpanStages[label]:undefined;if(resizeStage!==undefined)resizeSpan(resizeStage);stack.push(entry);try{return callback();}finally{if(resizeStage!==undefined)resizeSpan(resizeStage+1);const elapsed=performance.now()-start;stack.pop();if(stack.length)stack[stack.length-1]!.children+=elapsed;sample(label,elapsed);if(phase&&diagnostic)(exclusive[label]??=[]).push(Math.max(0,elapsed-entry.children));if(typeof allocation==='number'){const after=gc().js_totalAllocatedBytes;if(typeof after==='number')sample('Allocated.'+label,after-allocation);}if(boot)bootMark(label+' exit');}}
function measuredClass<T>(label:string,callback:()=>T):T{if(!phase)return callback();const start=performance.now(),entry={children:0};stack.push(entry);try{return callback();}finally{const elapsed=performance.now()-start;stack.pop();if(stack.length)stack[stack.length-1]!.children+=elapsed;const own=Math.max(0,elapsed-entry.children),value=classOwners[label]??={n:0,selfMs:0,maxSelfMs:0};value.n++;value.selfMs+=own;value.maxSelfMs=Math.max(value.maxSelfMs,own);}}
let bootTracing=false;
const bootStages=new Set(['Root.build','Widgets.flushBuild','Pipeline.flushLayout','Pipeline.flushSemantics','Painting.compose','Painting.finishLayer','Boundary.refresh','Painting.recordChild']);
function bootMark(message:string):void{if(!bootTracing)return;const hook=(globalThis as {nativeLoggingHook?:(message:string,level:number)=>void}).nativeLoggingHook;if(hook)hook('BOOT '+message,1);else host.report('BOOT '+message);}
function wrap(type:any,name:string,label:string){const original=type.prototype[name];if(typeof original!=='function')throw Error('Missing diagnostic method '+label);type.prototype[name]=function(...args:any[]){if(!phase&&!bootTracing)return original.apply(this,args);const step=bootTracing&&bootStages.has(label);if(step)bootMark(label+' enter');try{return measured(label,()=>original.apply(this,args));}finally{if(step)bootMark(label+' exit');}};}
function wrapFrameCallbacks(decorate:(callback:(...args:any[])=>void)=>(...args:any[])=>void):void{
 const raf=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=callback=>raf(decorate(callback));
 const api=(globalThis as any).NelyxWindowsHost;if(api?.frameClockVersion===1){const request=api.requestFrame;api.requestFrame=(callback:any)=>request.call(api,decorate(callback));}
}

if(trace)for(const [type,names,label]of [[FrameworkRoot,['build','recordPaint'],'Root'],[ViewRuntime,['updateMetrics','buildPending','pump'],'Runtime'],[PaintingContext,['compose','finishLayer'],'Painting'],[SceneBuilder,['build','addRetained','pop'],'Scene'],[RenderRepaintBoundary,['refresh'],'Boundary'],[RenderObject,['commitTextInputGeometries','markNeedsPaint'],'Geometry'],[PipelineOwner,['flushLayout','flushSemantics'],'Pipeline'],[GraphiteRenderer,['submit','pollNotifications'],'Renderer'],[BuildOwner,['flushBuild','finalizeTree'],'Widgets'],[SemanticsBinding,['updateViewSemantics'],'Semantics'],[SemanticsNode,['updateWith','getSemanticsData'],'SemanticsNode'],[SemanticsOwner,['sendSemanticsUpdate'],'SemanticsOwner']] as const)for(const name of names)wrap(type,name,label+'.'+name);
if(resizeTimeline){
 // Only the owned diagnostic fixture installs these aggregate spans. Every
 // timestamp comes directly from the same native clock as the frame trace.
 const build=FrameworkRoot.prototype.build,metrics=ViewRuntime.prototype.updateMetrics,capture=FrameRecording.capture,prototype=ViewRuntime.prototype as any,schedule=prototype.schedulePump;
 FrameworkRoot.prototype.build=function(...args:Parameters<typeof build>){const previous=resizeTimelineToken;resizeTimelineToken=args[0].token;resizeSpan(25);try{return build.apply(this,args);}finally{try{resizeSpan(26);}finally{resizeTimelineToken=previous;}}};
 ViewRuntime.prototype.updateMetrics=function(...args:Parameters<typeof metrics>){const token={metrics:args[0],owner:this.owner,sequence:0};resizeSpan(20,token);if((this as any).task)resizeSpan(23,token);try{return metrics.apply(this,args);}finally{resizeSpan(21,token);}};
 prototype.schedulePump=function(...args:any[]){const pending=this.task;const result=schedule.apply(this,args);if(!pending&&this.task)resizeSpan(22,{metrics:this.currentMetrics,owner:this.owner,sequence:0});return result;};
 const request=FrameScheduler.prototype.requestFrame;
 FrameScheduler.prototype.requestFrame=function(){
  if(!phase||!resizeTimelineView||this!==view?.controller?.scheduler)return request.call(this);
  const source=resizeRequestSources[this.phase]??={attempts:0,scheduled:0,withTransient:0},pending=this.hasScheduledFrame;source.attempts++;
  const result=request.call(this);if(!pending&&this.hasScheduledFrame){source.scheduled++;if(this.transientCallbackCount)source.withTransient++;if(source.firstStack===undefined)source.firstStack=String(new Error('Resize frame request').stack??'unavailable').slice(0,1800);}return result;
 };
 FrameRecording.capture=function(...args:Parameters<typeof capture>){return measured('Frame.capture',()=>capture.apply(this,args));};
}
if(diagnostic){
 // Attribute tree ownership work in the actual installed engine. These nested
 // spans expose exclusive time; minimal CPU qualification keeps them disabled.
 // FinalizeTree and Element lifecycle counters cover recursive retirement.
 // Per-descendant timing wrappers add call depth to the very tree being torn
 // down, so they cannot be a transparent observer for an arbitrarily deep tree.
 for(const [type,names,label]of [[Element,['mount','reconcile'],'Element'],[BuildOwner,['register','unregister','deactivateChildren','_retireInactiveSubtreeWithoutGlobalKeys'],'BuildOwner'],[RenderObject,['attach','detach','insert','remove','validateChild','mutateChildren','refreshInputGeometryWork','clearLayoutDependencies','invalidateLayout','adoptForMutation','dropForMutation'],'Render']] as const)for(const name of names)wrap(type,name,label+'.'+name);
 for(const name of ['hasAncestor','getElementForInheritedWidgetOfExactType','dependOnInheritedElement','findAncestorWidgetOfExactType','findAncestorStateOfType'] as const)wrap(Element,name,'Ancestor.'+name);
 for(const name of ['createChild','removeChild','didStartLayout','syncElementChildren','finishQueuedChildren','precedingBox'] as const)wrap(SliverMultiBoxAdaptorElement,name,'Sliver.'+name);
 for(const [type,names,label]of [[RenderObjectElement,['mount','attachRenderObject','detachRenderObject','applyParentDataFromAncestors','synchronizeRenderObjectChildren'],'RenderElement'],[NativeTextLayoutService,['layout'],'NativeText'],[TextLayoutCache,['key','remember'],'TextCache']] as const)for(const name of names)wrap(type,name,label+'.'+name);
 const reuseText=TextLayoutCache.prototype.reuse;TextLayoutCache.prototype.reuse=function(...args:Parameters<typeof reuseText>){return measured('TextCache.reuse',()=>{const result=reuseText.apply(this,args);count(result?'TextCache.hit':'TextCache.miss');return result;});};
 wrap(FrameworkRoot,'pointerHitTest','Input.hitTest');wrap(GestureBinding,'dispatchEvent','Input.dispatch');wrap(ScrollPositionWithSingleContext,'pointerScroll','Input.scroll');
 wrap(RenderBoxes.RenderDecoratedBox,'paint','Decoration.paint');
 wrap(Paint,'update','Paint.update');wrap(Canvas,'drawRect','Canvas.drawRect');
 for(const [type,name,label]of [[Color,'lerp','Color.lerp'],[Rect,'fromLTWH','Rect.fromLTWH'],[CupertinoWidgets.CupertinoTheme,'of','Theme.of'],[TextStyle,'snapshotRunStyle','Style.snapshotRun']] as const){const original=(type as any)[name];(type as any)[name]=function(...args:any[]){return measured(label,()=>original.apply(this,args));};}
 for(const [type,name,label]of [[CupertinoWidgets.CupertinoThemeData,'resolveFrom','Theme.resolve'],[CupertinoWidgets.CupertinoTextThemeData,'resolveFrom','Theme.textResolve'],[CupertinoWidgets.CupertinoTextThemeData,'_createDefaultStyle','Theme.defaultStyle'],[TextStyle,'copyWith','Style.copyWith'],[TextStyle,'merge','Style.merge']] as const)wrap(type,name,label);
 const textTheme=Object.getOwnPropertyDescriptor(CupertinoWidgets.CupertinoThemeData.prototype,'textTheme')!;Object.defineProperty(CupertinoWidgets.CupertinoThemeData.prototype,'textTheme',{...textTheme,get:function(){return measured('Theme.textTheme',()=>textTheme.get!.call(this));}});
 wrap(PaintingContext,'_recordChildLayer','Painting.recordChild');
 const runLayout=(RenderObject.prototype as any).runLayout;(RenderObject.prototype as any).runLayout=function(constraints:any,options:any,perform?:()=>void){return runLayout.call(this,constraints,options,()=>{const name='Layout.'+className(this);bootMark(name+' enter');try{return measuredClass(name,()=>perform?perform():this.performLayoutInScope(constraints));}finally{bootMark(name+' exit');}});};
 const rebuild=Element.prototype.rebuild;Element.prototype.rebuild=function(...args:Parameters<typeof rebuild>){return measuredClass('Widget.'+className(this.widget),()=>rebuild.apply(this,args));};
 for(const [type,name,label]of [[TextPainter,'layout','Text.layout'],[Paragraph,'layoutWithReplacement','Text.paragraphLayout'],[ParagraphBuilder,'build','Text.buildParagraph']] as const){const original=(type.prototype as any)[name];(type.prototype as any)[name]=function(...args:any[]){count(label);return measured(label,()=>original.apply(this,args));};}
 for(const [type,name,label]of [[PictureRecorder,'endRecording','Picture.endRecording'],[FrameScheduler,'beginFrame','Scheduler.beginFrame'],[FrameScheduler,'endFrame','Scheduler.endFrame'],[FramePictureService,'resource','Picture.resource'],[NativeInteraction,'publish','Host.publish']] as const)wrap(type,name,label);
 const pictureBackends=new WeakSet<object>(),pictureResource=FramePictureService.prototype.resource;FramePictureService.prototype.resource=function(...args:Parameters<typeof pictureResource>){const backend=(this as any).backend;if(!pictureBackends.has(backend)){pictureBackends.add(backend);const compile=backend.compile;backend.compile=(...values:any[])=>measured('Picture.nativeCompile',()=>{const commands=values[0].frame.commands;sample('Picture.compiledCommands',commands.length);if(commands.every((command:any)=>['save','restore','transform','clip','clipRect','clipRRect','clipPath'].includes(command.op))){count('Picture.stateOnly');count('Picture.stateOnlyCommands',commands.length);}return compile.apply(backend,values);});}return pictureResource.apply(this,args);};
 // Counts only: a timer around every command would dominate the path being investigated.
 // Read the protected method through its checked subclass contract; retain
 // the original Canvas descriptor and receiver when installing diagnostics.
 class CanvasCounters extends Canvas{static recordWrapper(){return counted(CanvasCounters.prototype.record,'Canvas.record',args=>count('record.'+args[0].op));}}
 Object.defineProperty(Canvas.prototype,'record',{...Object.getOwnPropertyDescriptor(Canvas.prototype,'record'),value:CanvasCounters.recordWrapper()});
 Canvas.prototype.addCommands=counted(Canvas.prototype.addCommands,'Canvas.addCommands');
 Canvas.prototype._addCommandRange=counted(Canvas.prototype._addCommandRange,'Canvas.copyRange',args=>count('Canvas.copiedCommands',args[2]-args[1]));
 Element.prototype.rebuild=counted(Element.prototype.rebuild,'Element.rebuild');
 RenderObject.prototype.markNeedsSemanticsUpdate=counted(RenderObject.prototype.markNeedsSemanticsUpdate,'Render.markNeedsSemanticsUpdate');
 const rootBuild=FrameworkRoot.prototype.build;FrameworkRoot.prototype.build=function(...args:Parameters<typeof rootBuild>){const start=performance.now(),before=counts['Canvas.record']??0;if(lastBuild)sample('Root.startInterval',start-lastBuild);lastBuild=start;const pipeline=existingPipelineSemantics(this.pipeline) as any;count('Cache.present',(this as any).semanticsCache?1:0);for(const name of ['dirty','geometryDirty','deferredGeometry','offsetDirty'])if(pipeline?.[name]?.size)count('Cache.pending.'+name);for(const name of ['_dirtyNodes','_detachedNodes'])if(pipeline?.owner?.[name]?.size)count('Cache.pending.'+name);for(const node of pipeline?.deferredGeometry??[])count('Cache.deferred.'+node.constructor.name);const commands=rootBuild.apply(this,args);sample('Frame.finalCommands',commands instanceof FrameRecording?commands.commands.length:commands.length);sample('Frame.recordCalls',(counts['Canvas.record']??0)-before);return commands;};
 const geometry=RenderObject.prototype.commitTextInputGeometries;RenderObject.prototype.commitTextInputGeometries=function(...args:Parameters<typeof geometry>){const result=geometry.apply(this,args);count('Geometry.withInput',result.hasInputGeometry?1:0);return result;};
 const submit=GraphiteRenderer.prototype.submit;GraphiteRenderer.prototype.submit=function(frame:any,lease:any){const renderer=this as any;
  if(!observedRenderers.has(this)){observedRenderers.add(this);const accepted=new Map<number,number>();this.observe((event:any)=>{if(event.kind==='submitted')accepted.set(event.submission,performance.now());else if(event.kind==='retired'){const began=accepted.get(event.submission);if(began!==undefined){sample('Renderer.retirementObserved',performance.now()-began);accepted.delete(event.submission);}}});
   const context=renderer.context;renderer.context=()=>{const native=context();let wrapped=nativeContexts.get(native);if(!wrapped){wrapped=timedNativeContext(native,measured);nativeContexts.set(native,wrapped);}return wrapped;};
  }
  sample('Frame.estimatedBytes',frame.estimatedBytes);sample('Frame.resources',frame.resources.length);for(const command of frame.commands)count('submit.'+command.op);
  // Diagnostic lower bound: keep the full framework/semantics work and lease lifetime,
  // but replay only a clear. This intentionally does not render the gallery.
  const result=submit.call(this,mode==='renderer-clear'?{...frame,commands:[{op:'clear',color:0xff101827}]}:frame,lease);count('submitResult.'+result.status+('reason'in result?'.'+result.reason:''));return result;
 };
 wrapFrameCallbacks(callback=>{const requested=performance.now();return (...args)=>{sample('Host.rafDelay',performance.now()-requested);return measured('Host.rafCallback',()=>callback(...args));};});
}
for(const [type,label]of [[ViewRuntime,'Core'],[GraphiteRenderer,'Renderer']] as const){const setVisible=type.prototype.setVisible;type.prototype.setVisible=function(value:boolean){if(mode==='editing-resize')host.report(label+'-visibility '+value);return setVisible.call(this as any,value);};}
// Measure the complete owned frame callback (RN RAF or Windows compositor)
// including admission/submission, not pump alone: scene construction precedes pump. Idle polls
// are reported separately and cannot dilute frame CPU percentiles.
if(cpuOnly){
 const paint=(FrameworkRoot.prototype as any).recordPaint;
 (FrameworkRoot.prototype as any).recordPaint=function(...args:any[]){count('Paint.recorded');return paint.apply(this,args);};
}
if(trace||cpuOnly){let built=0,resized=0;const extents=new WeakMap<object,{width:number;height:number}>(),build=FrameworkRoot.prototype.build;FrameworkRoot.prototype.build=function(...args:Parameters<typeof build>){built++;const metrics=args[0].token.metrics,previous=extents.get(this);if(previous&&(previous.width!==metrics.physicalWidth||previous.height!==metrics.physicalHeight))resized++;extents.set(this,{width:metrics.physicalWidth,height:metrics.physicalHeight});return build.apply(this,args);};wrapFrameCallbacks(callback=>(...args)=>{const before=built,beforeResize=resized,mounts=counts['Element.mount']??0,unmounts=counts['Element.unmount']??0,start=performance.now();try{return callback(...args);}finally{
 if(built!==before)observeContinuousCoverage?.();
 const elapsed=performance.now()-start;sample(built!==before?'Frame.cpu':'Idle.rafCpu',elapsed);if(built!==before)sample(resized!==beforeResize?'Frame.resizeCpu':'Frame.stableCpu',elapsed);
 if(built!==before){sample((counts['Element.mount']??0)>mounts?'Frame.entryCpu':'Frame.retainedCpu',elapsed);if((counts['Element.unmount']??0)>unmounts)sample('Frame.retirementCpu',elapsed);}
 // Keep every frame in the full distribution. Also expose the first build
 // after each actual route action, rather than hiding mount cost in a mean.
 if(built!==before&&phase==='cupertino-route'){if(routeFirstPending){sample('Frame.routeFirst.'+routeFirstPending,elapsed);routeFirstPending=null;}else sample('Frame.routeContinuation',elapsed);}
}});}
if(diagnostic){
 const labels=['Widgets.flushBuild','Pipeline.flushLayout','Painting.compose','Picture.nativeCompile','Semantics.capture','Pipeline.flushSemantics','Renderer.submit','NativeJS.finishRecording'] as const;
 wrapFrameCallbacks(callback=>(...args)=>{
  const before=labels.map(label=>stats[label]?.length??0),builds=stats['Root.build']?.length??0,rebuilds=counts['Element.rebuild']??0,paragraphs=counts['Text.paragraphLayout']??0,mounts=counts['Element.mount']??0,unmounts=counts['Element.unmount']??0,start=performance.now();
  try{return callback(...args);}finally{
   const cpu=performance.now()-start;
   if(phase&&cpu>=12&&(stats['Root.build']?.length??0)>builds){const row:Record<string,number>={cpu,rebuilds:(counts['Element.rebuild']??0)-rebuilds,paragraphs:(counts['Text.paragraphLayout']??0)-paragraphs,mounts:(counts['Element.mount']??0)-mounts,unmounts:(counts['Element.unmount']??0)-unmounts};for(let index=0;index<labels.length;index++)row[labels[index]!]=(stats[labels[index]!]??[]).slice(before[index]).reduce((sum,value)=>sum+value,0);longFrames.push(row);longFrames.sort((a,b)=>b.cpu!-a.cpu!);longFrames.length=Math.min(longFrames.length,12);}
  }
 });
}
if(mode==='semantics-scroll'){
 const publish=(NativeInteraction.prototype as any).publish;
 (NativeInteraction.prototype as any).publish=function(...args:any[]){if(phase.endsWith('-held')){this.version++;count('Host.held');return;}return measured('Host.publish',()=>publish.apply(this,args));};
 wrap(NativeInteraction,'updateSemantics','Host.updateSemantics');
}
if(mode==='live-resize'){
 const delayMillis=Number(host.resizeConfig().delayResize),previousExtents=new WeakMap<object,string>();let injectedDelay=false;if(!Number.isFinite(delayMillis)||delayMillis<0||delayMillis>250)throw Error('Bounded resize delay must be 0..250ms');
 const pointer=FrameworkRoot.prototype.pointer,packets:any[]=[];(globalThis as any).__resizePointerPackets=packets;
 FrameworkRoot.prototype.pointer=function(event){if(packets.length<32)packets.push({kind:event.kind,x:event.x,y:event.y,buttons:event.buttons});return pointer.call(this,event);};
 // Install before the first CPU build (ViewRuntime.pump runs after that build).
 // This fixture-only sensor follows real Stack layout at the right edge, even
 // on pages whose own header has no right-aligned content.
 const build=FrameworkRoot.prototype.build,wrapped=new WeakMap<FrameworkRoot,GlobalKey>();let reported=0;
 FrameworkRoot.prototype.build=function(...args:Parameters<typeof build>){const m=args[0].token.metrics,extent=m.physicalWidth+','+m.physicalHeight,previous=previousExtents.get(this);previousExtents.set(this,extent);if(delayMillis&&!injectedDelay&&previous!==undefined&&extent!==previous&&host.resizing()){injectedDelay=true;const until=performance.now()+delayMillis;while(performance.now()<until){}host.report('live-resize-injected-delay '+delayMillis);}let sensor=wrapped.get(this);if(!sensor){sensor=new GlobalKey('resize-edge-sensor');wrapped.set(this,sensor);const key=sensor,controller=this as any,createRoot=controller.options.createRoot;controller.options={...controller.options,createRoot:(...rootArgs:any[])=>new BasicWidgets.Stack([createRoot(...rootArgs),new BasicWidgets.Positioned(new BasicWidgets.ColoredBox({key,color:0xff00e65b,isAntiAlias:false}),{right:10,top:6,width:2,height:2})],{fit:'expand'})};}const result=build.apply(this,args),render=sensor.currentContext?.findRenderObject();if(render){if(!(render instanceof RenderBox))throw Error('Resize sensor must be a RenderBox');count('Resize.sensorLayouts');const metrics=args[0].token.metrics,point=render.localToGlobal({x:0,y:0});if(Math.abs(point.x-(metrics.logicalWidth-12))>0.01||Math.abs(point.y-6)>0.01){count('Resize.sensorLayoutMismatches');if(reported++<4)host.report('live-resize-layout '+JSON.stringify({point,expected:{x:metrics.logicalWidth-12,y:6},metrics}));}}return result;};
}
const original=ViewRuntime.prototype.pump;ViewRuntime.prototype.pump=function(){view=this;if(semanticsInterval!==null){const controller=(this as any).controller;controller.options={...controller.options,semanticsUpdateInterval:semanticsInterval};}if(trace&&(this as any).controller.sourceSemanticsSnapshot)wrap((this as any).controller.sourceSemanticsSnapshot.constructor,'capture','Semantics.capture');if(cpuOnly){const snapshot=(this as any).controller.sourceSemanticsSnapshot,capture=snapshot?.capture;if(snapshot)snapshot.capture=function(...args:any[]){count('Semantics.captures');return capture.apply(this,args);};}ViewRuntime.prototype.pump=original;return original.apply(this);};
if(diagnostic||continuousInput||mode==='live-resize'){
 let failures=0;
 for(const method of ['build','dispose'] as const){const original=FrameworkRoot.prototype[method];(FrameworkRoot.prototype as any)[method]=function(...args:any[]){try{return (original as any).apply(this,args);}catch(error){
  if(failures++<3)try{const causes:Array<Record<string,unknown>>=[],seen=new Set<unknown>(),pending=[{value:error as any,path:method as string,depth:0}];while(pending.length&&seen.size<4096&&causes.length<4){const {value,path,depth}=pending.pop()!;if(seen.has(value))continue;seen.add(value);const children=Array.isArray(value?.errors)?value.errors:[],cause=value?.cause;if(children.length||cause!==undefined){if(cause!==undefined)pending.push({value:cause,path:path+'.cause',depth:depth+1});for(let i=children.length-1;i>=0;i--)pending.push({value:children[i],path:path+'.errors['+i+']',depth:depth+1});}else causes.push({path:path.slice(-500),depth,message:String(value),stack:typeof value?.stack==='string'?value.stack.slice(0,1800):undefined});}host.report('CORE_FAILURE '+JSON.stringify({phase,error:String(error),causes,visited:seen.size}));}catch{/* Diagnostics must preserve the original thrown object. */}
  throw error;
 }};}
}
if(wheelInput||mode==='research-engine'||mode==='gallery-scroll'){const pointer=FrameworkRoot.prototype.pointer;FrameworkRoot.prototype.pointer=function(event){if(event.kind==='wheel'){count('Input.wheel');count('Input.wheelDistance',Math.abs(event.deltaY??0));count('Input.wheelNetDistance',event.deltaY??0);}return trace?measured('Input.pointer',()=>pointer.call(this,event)):pointer.call(this,event);};}
let resizeRenderer:any,retiredResizeMetrics:any,settledResizes=0,retiredResizeFrames=0;
if(resize||wheelInput||mode==='gallery-regression'||mode==='semantics-scroll'||mode==='gallery-scroll'){const observed=new WeakSet<object>(),submit=GraphiteRenderer.prototype.submit;GraphiteRenderer.prototype.submit=function(frame,lease){resizeRenderer=this;if(resize&&!observed.has(this)){observed.add(this);this.observe(event=>{if(event.kind==='retired'&&event.result==='gpu-retired'){retiredResizeMetrics=event.token.metrics;retiredResizeFrames++;}});}return submit.call(this,frame,lease);};}
const delay=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
async function fitPerformanceViewport(){
 const before=view.currentMetrics,width=1000+Math.round(800*before.scale-before.physicalWidth),height=1000+Math.round(600*before.scale-before.physicalHeight);
 await host.resize(width,height);const deadline=performance.now()+5000;
 while(true){const metrics=view.currentMetrics;if(metrics.nativeSurfaceGeneration>before.nativeSurfaceGeneration&&Math.abs(metrics.logicalWidth-800)*metrics.scale<=.5&&Math.abs(metrics.logicalHeight-600)*metrics.scale<=.5)break;if(performance.now()>deadline)throw Error('Owned performance viewport did not reach 800x600 logical: '+JSON.stringify(metrics));await delay(16);}
 await delay(300);
}
function probeNativeFonts(){
 const api=(globalThis as any).SkiaApi,font=[...view.controller.context.text.fonts.values()].find((value:any)=>value.typeface) as any,owned:any[]=[];
 if(!api||!font)throw Error('Native font ownership probe has no app typeface');
 const own=(value:any)=>{owned.push(value);return value;},style={textStyle:{fontFamilies:['nelyx-probe-font'],fontSize:17}},text='Font cache 한글 Ω';
 const paragraph=(provider:any,paragraphStyle:any=style)=>{const builder=own(api.ParagraphBuilder.Make(paragraphStyle,provider));builder.addText(text);const value=own(builder.build());builder.dispose();value.layout(250);return value;};
 try{
  const provider=own(api.TypefaceFontProvider.Make());paragraph(provider).dispose();provider.registerFont(font.typeface,'nelyx-probe-font');
  const reference=own(api.TypefaceFontProvider.Make());reference.registerFont(font.typeface,'nelyx-probe-font');const expected=paragraph(reference);
  const reads:string[]=[],observe=(label:string,value:any)=>new Proxy(value,{has(target,key){reads.push(label+'.has:'+String(key));return Reflect.has(target,key);},get(target,key,receiver){reads.push(label+'.get:'+String(key));return Reflect.get(target,key,receiver);}});
  const textStyle={fontFamilies:['nelyx-probe-font'],fontSize:17,backgroundColor:null,wordSpacing:undefined},strutStyle={fontFamilies:['nelyx-probe-font'],fontSize:17,strutEnabled:true};
  const observed=paragraph(reference,observe('paragraph',{textStyle:observe('text',textStyle),strutStyle:observe('strut',strutStyle)})),plain=paragraph(reference,{textStyle,strutStyle});
  if(Math.abs(observed.getLongestLine()-plain.getLongestLine())>1e-6||Math.abs(observed.getHeight()-plain.getHeight())>1e-6)throw Error('Text property key reuse changed converted paragraph metrics');
  for(const [label,key,count]of [['paragraph','textStyle',2],['paragraph','strutStyle',2],['text','fontSize',2],['strut','fontSize',2],['text','backgroundColor',1],['text','wordSpacing',1]] as const){const actual=reads.filter(value=>value===label+'.has:'+key||value===label+'.get:'+key),expected=[label+'.has:'+key,...Array.from({length:count},()=>label+'.get:'+key)];if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('Native text getter/Proxy ordering changed: '+JSON.stringify({label,key,actual,expected}));}
  class PrivateStyle{#size=17;reads=0;fontFamilies=['nelyx-probe-font'];get fontSize(){this.reads++;return this.#size;}}
  const privateStyle=new PrivateStyle(),privateParagraph=paragraph(reference,{textStyle:privateStyle});if(privateStyle.reads!==2||Math.abs(privateParagraph.getLongestLine()-expected.getLongestLine())>1e-6)throw Error('Native text conversion lost the original private getter receiver');
  for(const trap of ['has','get'] as const){const failure='text-property-'+trap,value=new Proxy({fontSize:17},{[trap](){throw Error(failure);}});let rejected=false;try{own(api.ParagraphBuilder.Make({textStyle:value},reference));}catch(error){if(!String(error).includes(failure))throw error;rejected=true;}if(!rejected)throw Error('Native text '+trap+' exception was swallowed');}
  host.report('text-property-reads PASS has/get/null/undefined/private-receiver/Proxy-errors');
  for(const invalid of [{},font.typeface]){let rejected=false;try{own(api.ParagraphBuilder.Make(style,invalid));}catch{rejected=true;}if(!rejected)throw Error('Paragraph factory accepted a foreign font provider');}
  for(let i=0;i<17;i++){const varied={...style,textStyle:{...style.textStyle,fontStyle:{weight:i%2?700:400},fontVariations:[{axis:'wght',value:i%2?700:400}]}},fresh=own(api.TypefaceFontProvider.Make());fresh.registerFont(font.typeface,'nelyx-probe-font');const reference=paragraph(fresh,varied),current=paragraph(provider,varied);if(Math.abs(current.getLongestLine()-reference.getLongestLine())>1e-6||Math.abs(current.getHeight()-reference.getHeight())>1e-6)throw Error('Font registration, style or collection rollover returned stale metrics');current.dispose();reference.dispose();fresh.dispose();}
  const builder=own(api.ParagraphBuilder.Make(style,provider));provider.dispose();let rejected=false;try{const invalid=own(api.ParagraphBuilder.Make(style,provider));invalid.dispose();}catch{rejected=true;}if(!rejected)throw Error('Disposed font provider reused cached native data');
  builder.addText(text);const retained=own(builder.build());retained.layout(250);if(Math.abs(retained.getLongestLine()-expected.getLongestLine())>1e-6)throw Error('Provider disposal invalidated a live paragraph builder');
  host.report('font-collection PASS registration/rollover/dispose/live-builder');
 }finally{for(const value of owned.reverse())value.dispose();}
}
function probeNativeTextReuseBudget(){
 const api=(globalThis as any).SkiaApi,borrowed=[...view.controller.context.text.fonts.values()].find((value:any)=>value.typeface) as any;
 if(!api||!borrowed)throw Error('Native text reuse probe has no app typeface');
 const registry=new ResourceRegistry(),font={...borrowed,resource:{id:'native-cache-budget-font',generation:1}},leases:ReturnType<ResourceRegistry['acquire']>[]=[];
 // This synchronous probe borrows the live app typeface. Its own providers,
 // paragraphs and recording leases retire before returning to the app.
 registry.register({...font.resource,kind:'font'},()=>{});
 const text=new NativeTextLayoutService(api,registry,{id:'native-cache-budget',generation:1},font),input={text:'A'.repeat(4096),width:Infinity,font:font.resource,fontSize:16,locale:'en',direction:'ltr' as const,scale:1};
 const rejectNew=()=>{let rejected=false;try{const unexpected=text.layout({...input,text:'A'});registry.releaseProducer(unexpected.resource);}catch(error){if(!String(error).includes('Retained paragraph content budget exhausted'))throw error;rejected=true;}if(!rejected)throw Error('New native paragraph bypassed the full retained budget');};
 try{
  const idleInput={...input,text:'Idle native 한글 😀'},idle=text.layout(idleInput);registry.releaseProducer(idle.resource);
  if(!registry.isRetained(idle.resource)||registry.hasInitialProducer(idle.resource)||text.debugStats.cache.resident!==1)throw Error('Native idle paragraph did not retain its separate bounded cache owner');
  let queryRejected=false;try{text.hit(idle,0,0);}catch(error){if(!String(error).includes('foreign or released text layout'))throw error;queryRejected=true;}if(!queryRejected)throw Error('Native cache residency granted a released logical producer query access');
  const idleReused=text.layout(idleInput);if(idleReused!==idle||registry.initialProducerCount(idle.resource)!==1||text.debugStats.cache.cacheOnlyHits!==1)throw Error('Native idle paragraph was shaped again, had another owner or skipped producer admission');registry.releaseProducer(idleReused.resource);
  for(let batch=0;batch<4;batch++){const layouts=[];try{for(let index=0;index<16;index++)layouts.push(text.layout({...input,color:0xff000000+batch*16+index}));leases.push(registry.acquire(layouts.map(layout=>layout.resource)));}finally{for(const layout of layouts)registry.releaseProducer(layout.resource);}}
  rejectNew();const reused=text.layout({...input,color:0xff000000+63});
  if(text.debugStats.paragraphs!==64||registry.initialProducerCount(reused.resource)!==1)throw Error('Native reuse changed resident allocation or logical producer accounting');
  registry.releaseProducer(reused.resource);rejectNew();
 }finally{for(const lease of leases)lease.returnBy('caller');registry.dispose();}
 if(text.debugStats.paragraphs||text.debugStats.producers||text.debugStats.fontProviders||text.debugStats.cache.resident)throw Error('Native text reuse probe retained a paragraph, producer, cache owner or font provider');
 host.report('text-reuse-budget PASS idle-owner/released-query-rejection/retained-full/reuse/new-rejection/retirement');
}
async function probeNativeClock(){
 const api=(globalThis as any).NelyxWindowsHost;if(api?.frameClockVersion!==1)throw Error('Public Windows compositor clock1 missing');
 await new Promise<void>((resolve,reject)=>{let canceled:number;api.requestFrame((failure?:string)=>{if(failure){reject(Error(failure));return;}api.cancelFrame(canceled);const first=api.getStatus().frameTicks;api.requestFrame((failure?:string)=>{if(failure)reject(Error(failure));else if(api.getStatus().frameTicks<=first)reject(Error('A recursive native frame ran in the same tick'));else resolve();});});canceled=api.requestFrame(()=>reject(Error('A canceled native batch callback ran')));});
 host.report('frame-clock PASS '+JSON.stringify(api.getStatus()));
}
async function wheelAndDrain(x:number,y:number,delta:number){
 if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('Core produced a nonfinite wheel target: '+JSON.stringify({x,y}));
 const expected=(counts['Input.wheelDistance']??0)+120*Math.abs(delta)/120*48;
 if(wheelInputMode==='queued')await host.queuedWheel(x,y,delta,120,view.currentMetrics.nativeSurfaceGeneration,wheelInterval);else await host.wheel(x,y,delta,120,wheelInterval);
 const deadline=performance.now()+3000;while((counts['Input.wheelDistance']??0)<expected-.001){if(performance.now()>deadline)throw Error('Native wheel delivery did not drain: '+JSON.stringify({expected,...counts}));await delay(16);}
}
async function drainWheelRendering(){
 if(!resizeRenderer)throw Error('Wheel rendering has no observed renderer');const deadline=performance.now()+3000;
 const pending=()=>view.dirty||view.pending||view.task||resizeRenderer.hasPendingSubmissions;
 for(;;){while(pending()){if(performance.now()>deadline)throw Error('Final wheel frame did not drain');await delay(1);}await host.windowSnapshot();if(!pending())return;}
}
async function resizeSettled(previousGeneration:number){const deadline=performance.now()+3000;while(performance.now()<deadline){const metrics=view.currentMetrics,native=resizeRenderer?.context();if(native&&metrics.nativeSurfaceGeneration>previousGeneration&&Math.round(native.width*metrics.scale)===metrics.physicalWidth&&Math.round(native.height*metrics.scale)===metrics.physicalHeight&&retiredResizeMetrics?.nativeSurfaceGeneration===metrics.nativeSurfaceGeneration&&retiredResizeMetrics.viewportGeneration===metrics.viewportGeneration){settledResizes++;host.report('resize-settled '+metrics.physicalWidth+'x'+metrics.physicalHeight);return;}await delay(16);}throw Error('Resize did not retire a frame matching the current native backing and viewport');}
async function dragResize(corner='bottom-right'){const generation=view.currentMetrics.nativeSurfaceGeneration;const interval=await host.dragResize(corner);await resizeSettled(generation);return interval;}
async function liveResize(){
 for(let attempt=0;attempt<3;attempt++){await host.windowMode('input');await delay(100);if((await host.windowSnapshot()).foreground)break;}
 if(!(await host.windowSnapshot()).foreground)throw Error('Owned resize window did not acquire foreground before its pointer check');
 const actions=material().actionCount;await host.pointerClick('demo-elevated',false);await delay(250);await drainWheelRendering();
 host.report('live-resize-pointer '+JSON.stringify({before:actions,after:material().actionCount,lastAction:material().lastAction,target:view.controller.nodes.find((node:any)=>node.id==='demo-elevated')?.bounds,packets:(globalThis as any).__resizePointerPackets}));
 if(material().actionCount!==actions+1||material().lastAction!=='Elevated pressed')throw Error('Full-window native pointer click did not reach the Core button');
 host.report('live-resize-pointer PASS');
 const api=(globalThis as any).NelyxWindowsHost;
 const failures:string[]=[];
 const frameworkErrors:string[]=[],reportError=FlutterError.onError;FlutterError.onError=details=>{frameworkErrors.push(String(details.exception));reportError?.(details);};
 try{
 const config=host.resizeConfig(),pages=config.pages.split(','),corners=config.corners.split(',');if(!pages.length||pages.some((p:string)=>!['material','list','cupertino'].includes(p))||corners.some((c:string)=>!['left','right','top','bottom','bottom-right','top-left','top-right','bottom-left'].includes(c)))throw Error('Invalid owned resize cases');let currentPage='material';
 if(config.responsiveShortHeader==='1'&&(pages.length!==1||pages[0]!=='material'))throw Error('Responsive short-header expectations belong to the Material page');
 for(const page of pages){
  if(page==='list')tap('show-list-view');
  else if(page==='cupertino'){if(currentPage==='list'){tap('list-view-back');await delay(300);}tap('show-cupertino');}currentPage=page;
  for(const corner of corners){
  await host.resize(Math.round(500*view.currentMetrics.scale),Math.round(500*view.currentMetrics.scale));
  await delay(500);await drainWheelRendering();const seed=api.drainFrameTrace();
  if(resizeTimeline){const views=[...new Set<number>(seed.filter((entry:any)=>entry.view>0).map((entry:any)=>entry.view))];if(views.length!==1)throw Error('Resize CPU timeline requires one observed native View');resizeTimelineView=views[0]!;resizeCpuEvents=[];resizeCpuOverflow=false;resizeRequestSources={};}
  const entries:any[]=[];let overflow=false;
  const collect=()=>{const batch=api.drainFrameTrace();if(entries.length+batch.length>4096)overflow=true;else if(!overflow)entries.push(...batch);};
  start(page+'-resize-'+corner);const poll=setInterval(collect,16);let interval:any;
  try{interval=await dragResize(corner);await drainWheelRendering();}finally{clearInterval(poll);collect();}
  end();
  if(overflow||resizeCpuOverflow)throw Error('Live resize trace exceeded its bounded fixture buffer');
  const requests=entries.filter(entry=>entry.stage===6),updates=entries.filter(entry=>entry.stage===2);
  const during=updates.filter(entry=>entry.nativeTimestamp>=interval.began&&entry.nativeTimestamp<interval.ended);
  const latencies=updates.flatMap(entry=>{const request=requests.find(value=>value.surfaceGeneration===entry.surfaceGeneration);return request?[entry.nativeTimestamp-request.nativeTimestamp]:[];}).sort((a,b)=>a-b);
  const times=[interval.began,...during.map(entry=>entry.nativeTimestamp),interval.ended],maxGap=Math.max(...times.slice(1).map((time,index)=>time-times[index]));
  const lag=during.flatMap(entry=>{const latest=requests.filter(request=>request.nativeTimestamp<=entry.nativeTimestamp).at(-1);return latest?[Math.max(Math.abs(entry.width-latest.width),Math.abs(entry.height-latest.height))]:[];});
  const overlappedAdmissions=entries.filter((entry,index)=>entry.stage===7&&entries.slice(0,index).some((front,frontIndex)=>front.stage===2&&front.surfaceGeneration!==entry.surfaceGeneration&&!entries.slice(frontIndex+1,index).some(terminal=>terminal.stage===3&&terminal.surfaceGeneration===front.surfaceGeneration))).length;
  const rejected=entries.filter(entry=>entry.stage===19),prepared=entries.filter(entry=>entry.stage===8),committed=entries.filter(entry=>entry.stage===10),timeouts=entries.filter(entry=>entry.stage===11);
  const result={label:config.label,page,corner,timing:resizeStatistics(interval,entries,resizeCpuEvents),requestSources:resizeTimeline?resizeRequestSources:undefined,requests:requests.length,updates:during.length,overlappedAdmissions,rejectedProposals:rejected.length,prepared:prepared.length,committed:committed.length,timeouts:timeouts.length,sourceSamples:interval.sourceSamples,sourceMisses:interval.sourceMisses,geometrySamples:interval.geometrySamples,geometryMismatches:interval.geometryMismatches,edgeGlyphChanges:interval.edgeGlyphChanges,missingEdgeGlyphs:interval.missingEdgeGlyphs,maximumEdgeDelta:interval.maximumEdgeDelta,durationMs:interval.ended-interval.began,maxGapMs:maxGap,maxSizeLagPx:Math.max(0,...lag),requestToSurfaceP95:latencies[Math.ceil(latencies.length*.95)-1],pixelSamples:interval.pixelSamples,distinctPixelSizes:interval.distinctPixelSizes,backgroundExposures:interval.backgroundExposures,glyphChanges:interval.glyphChanges,missingGlyphs:interval.missingGlyphs,maximumGlyphDelta:interval.maximumGlyphDelta,glyphWidth:interval.glyphWidth,glyphHeight:interval.glyphHeight,responsiveShortHeader:interval.responsiveShortHeader,originChanges:interval.originChanges,originTransitions:interval.originTransitions,maximumOriginDelta:interval.maximumOriginDelta,...(trace||diagnostic?{stages:entries.map(entry=>({stage:entry.stage,surface:entry.surfaceGeneration,width:entry.width,height:entry.height,t:entry.nativeTimestamp}))}:{}),displayed:interval.captureEnabled?'owned-desktop-frame-native-border-and-layout-sensor':'notObserved'};
  host.report('live-resize '+JSON.stringify(result));
  if(config.responsiveShortHeader==='1'&&(!interval.responsiveShortHeader||interval.originChanges!==0||interval.originTransitions<2))throw Error('Responsive short-header pixels did not follow both expected 16/28 padding transitions: '+JSON.stringify(result));
  if(resizeTimeline){const cpu=result.timing.cpu;if(!cpu||cpu.invalidEvents||!cpu.coverage.newFrameRequests&&!cpu.coverage.metricsWithPendingFrame||!cpu.resizeFrames.n||!cpu.resizeFrames.buildEndToNativeSubmit.n||(['requestToCoreMetrics','metricsToBuild','metricsToCopyRetired','buildEndToNativeSubmit','coreMetrics','build','layout','recordPaint','semantics','compose','capture'] as const).some(key=>!cpu[key].n))throw Error('Resize CPU timeline lost its exact native View/epoch/frame pairs');}
  validateNativeFrameTerminals(entries);
  if(Number(config.delayResize)>0&&!rejected.length)throw Error('Injected preparation timeout did not reject its proposed geometry');
  if(during.length<4||maxGap>(interval.ended-interval.began)/2)throw Error('Live resize stalled during the actual sizing loop: '+JSON.stringify(result));
  if(prepared.length<4||committed.length<4||timeouts.some(timeout=>config.allowRejections!=='1'||!rejected.some(reject=>reject.surfaceGeneration===timeout.surfaceGeneration)))throw Error('Resize did not prepare and commit exact frames within its deadline: '+JSON.stringify(result));
  if(interval.geometrySamples<4||interval.geometryMismatches)throw Error('Committed window geometry outran its actual content frame: '+JSON.stringify(result));
  if(interval.captureEnabled&&(interval.pixelSamples<8||interval.distinctPixelSizes<4))throw Error('Window capture did not observe enough actual resize frames: '+JSON.stringify({...result,distinctPixelSizes:interval.distinctPixelSizes}));
  if(interval.backgroundExposures!==0)throw Error('Window background was exposed during live resize: '+JSON.stringify(result));
  if(interval.glyphChanges!==0||interval.missingGlyphs!==0)failures.push('Header glyphs changed size during live resize: '+JSON.stringify(result));
  if(interval.edgeGlyphChanges!==0||interval.missingEdgeGlyphs!==0)failures.push('Right header content did not follow the displayed client edge: '+JSON.stringify(result));
  if(frameworkErrors.length)throw Error('Framework errors during live resize: '+JSON.stringify(frameworkErrors));
  }
 }
 await drainWheelRendering();api.drainFrameTrace();
 const cancellation=await host.cancelResizePreparation();await drainWheelRendering();
 const cancelledEntries=api.drainFrameTrace();validateNativeFrameTerminals(cancelledEntries);
 if(!cancellation.preparedOffTree||!cancellation.restoredActualGeometry||!cancelledEntries.some((entry:any)=>entry.stage===4)||cancelledEntries.some((entry:any)=>entry.stage===11))throw Error('Cancelled resize did not retire its invisible candidate and restore actual geometry: '+JSON.stringify(cancellation));
 host.report('live-resize-cancellation '+JSON.stringify(cancellation));
 if(failures.length)throw Error(failures.join('\n'));
 host.report('live-resize PASS');
 }finally{FlutterError.onError=reportError;}
}
async function resizeWindow(){for(const [width,height]of [[1500,1080],[680,760],[2400,1280],[420,540],[1320,900],[1000,1000]]){host.report('resize '+width+'x'+height);const generation=view.currentMetrics.nativeSurfaceGeneration;await host.resize(width,height);await delay(90);await resizeSettled(generation);}}
function states(){const all:any[]=[];function visit(element:any){if(element.state)all.push({widget:element.widget,state:element.state});for(const child of element.children)visit(child);}visit(view.controller.root);return all;}
function material(){return states().find(entry=>entry.widget instanceof ComponentsGallery)!.state;}
function cupertino(){return states().find(({state})=>'values'in state&&'scroll'in state&&typeof state.select==='function')!.state;}
let routeFirstPending:'push'|'pop'|null=null;
function tap(id:string){const node=view.controller.nodes.find((node:any)=>node.id===id);if(!node)throw Error('Missing '+id+' visible='+view.controller.nodes.map((node:any)=>node.id).join(','));if(phase==='cupertino-route'){if(id==='cupertino-open-route')routeFirstPending='push';else if(id==='cupertino-route-return')routeFirstPending='pop';}const perform=()=>{if(node.actions?.activate)node.actions.activate();else node.activate?.();};if(diagnostic)measured('Action.'+id,perform);else perform();}
async function waitForAction(id:string){const started=performance.now(),deadline=started+3000;while(!view.controller.nodes.some((node:any)=>node.id===id&&node.enabled&&(node.actions?.activate||node.activate))){if(performance.now()>deadline)throw Error('Route action did not return within its deadline: '+id+' visible='+view.controller.nodes.map((node:any)=>node.id).join(','));await delay(16);}const elapsed=performance.now()-started;if(elapsed>40)host.report('route-ready-wait '+JSON.stringify({id,elapsed}));}
function gc(){return (globalThis as any).HermesInternal?.getInstrumentedStats?.()??{};}
function treeSize(){const size={elements:0,renderObjects:0,hostNodes:view.controller.nodes.length};for(const [root,key]of [[view.controller.root,'elements'],[view.controller.pipeline.root,'renderObjects']] as const){const pending=[root];while(pending.length){const node=pending.pop();if(!node)continue;size[key]++;pending.push(...node.children);}}return size;}
function profileBoundary(name:string,begin:boolean){if(!v8Profile)return;if(!/^[a-z-]+$/.test(name))throw Error('Invalid V8 profile phase');const boundary=begin?'begin':'end',marker='nelyxProfilePhaseMarker_'+name.replace(/-/g,'_')+'_'+boundary;Function('return (function '+marker+'(){return 0;})()\n//# sourceURL=nelyx.profile/'+name+'/'+boundary)();if(!host.profilePhase(name,begin))throw Error('Native V8 profile phase unavailable');}
let textCacheBefore:any={};
function textCacheStats(){return view?.controller?.context?.text?.debugStats?.cache??{};}
function start(name:string){stats={};exclusive={};counts={};classOwners={};longFrames=[];lastBuild=0;tree=diagnostic?treeSize():{};gcBefore=gc();textCacheBefore=textCacheStats();phase=name;profileBoundary(name,true);host.begin(name);}
function summarize(values:number[]){values.sort((a,b)=>a-b);return {n:values.length,sum:values.reduce((a,b)=>a+b,0),p50:values[Math.floor(values.length*.5)],p95:values[Math.floor(values.length*.95)],p99:values[Math.floor(values.length*.99)],max:values.at(-1)};}
function end(){const result:any={phase,childPolicy,childBudget:view?.controller?.buildOwner?.maybeViewWorkBudget?.debugStats??null,engine:(globalThis as any).__nelyxJavaScriptEngine??((globalThis as any).HermesInternal?'hermes':'unknown'),mode,trace,diagnostic,tree,wheelWarmup,wheelHover,lifecycle:{mounts:counts['Element.mount']??0,unmounts:counts['Element.unmount']??0},wheelPacing:mode==='gallery-scroll'?'programmatic':mode==='research-engine'?(continuousInput?(wheelInputMode==='queued'?'sdk-queue-continuous':'os-wheel-continuous'):phase==='list-warm'?'os-wheel':'programmatic') : wheelInput?(wheelInputMode==='queued'?'owned-queue-render-drain':'continuous-render-drain'):'animated',semanticsUpdateInterval:(view.controller as any).options.semanticsUpdateInterval??0,...(cpuOnly?{transportCaptures:counts['Semantics.captures']??0,paintWork:{recorded:counts['Paint.recorded']??0}}:{})};for(const [name,values]of Object.entries(stats))result[name]=summarize(values);if(diagnostic){result.longFrames=longFrames;result.exclusive=Object.fromEntries(Object.entries(exclusive).map(([name,values])=>[name,summarize(values)]));result.counts=counts;result.classOwners=Object.fromEntries(Object.entries(classOwners).sort((a,b)=>b[1].selfMs-a[1].selfMs).slice(0,16));}const after=gc();result.hermesDelta=Object.fromEntries(['js_numGCs','js_gcCPUTime','js_gcTime','js_totalAllocatedBytes'].filter(key=>typeof after[key]==='number'&&typeof gcBefore[key]==='number').map(key=>[key,(after[key] as number)-(gcBefore[key] as number)]));const memory=(value:Record<string,unknown>)=>Object.fromEntries(Object.entries(value).filter(([key,value])=>/allocated|heap|malloc/i.test(key)&&typeof value==='number').slice(0,20));result.hermesMemoryBefore=memory(gcBefore);result.hermesMemoryAfter=memory(after);const cache=textCacheStats();result.textCache={hits:(cache.hits??0)-(textCacheBefore.hits??0),misses:(cache.misses??0)-(textCacheBefore.misses??0),cacheOnlyHits:(cache.cacheOnlyHits??0)-(textCacheBefore.cacheOnlyHits??0),resident:cache.resident??0,units:cache.units??0,bytes:cache.bytes??0};host.report(JSON.stringify(result));profileBoundary(phase,false);phase='';host.end();}
async function editingResize(){
 const publicOrder=resizeCase==='public-order';
 material().firstScroll.jumpTo(publicOrder?0:240);await delay(200);if(publicOrder)await host.pointerClick('demo-icon-filled',false);else tap('demo-icon-filled');await delay(200);
 let generation=view.currentMetrics.nativeSurfaceGeneration;host.report('editing-resize maximize');await host.windowMode('maximize');await resizeSettled(generation);
 if(resizeCase==='public-order')await delay(12000);
 material().select('text');await delay(300);
 const focusProbe=async(id:string)=>{let last:any;for(let attempt=0;attempt<10;attempt++){await delay(100);const native=await host.focusSnapshot(id);last={id,core:view.controller.nodes.filter((node:any)=>node.focused).map((node:any)=>node.id),native};if(last.core.includes(id)&&native.owned&&native.hasFocus&&native.fieldHasFocus===true&&native.id===id)return {...last,ok:true};}return {...last,ok:false};};
 const filled=view.controller.nodes.find((node:any)=>node.id==='field-filled');if(!filled?.actions?.focus)throw Error('Filled focus unavailable');if(publicOrder)await host.pointerClick('field-filled',false);else filled.actions.focus();await delay(1000);const filledFocus=await focusProbe('field-filled');host.report('Core-focus '+JSON.stringify(filledFocus));
 await host.tab(false);const forwardFocus=await focusProbe('field-outlined');host.report('Core-Tab '+JSON.stringify(forwardFocus));if(!forwardFocus.ok)throw Error('OS Tab left the text-field content group');
 await host.tab(true);const reverseFocus=await focusProbe('field-filled');host.report('Core-ShiftTab '+JSON.stringify(reverseFocus));if(!reverseFocus.ok)throw Error('OS Shift+Tab did not return to the first field');
 const field=view.controller.nodes.find((node:any)=>node.id==='field-outlined');if(!field?.actions?.focus)throw Error('Message focus unavailable');if(publicOrder)await host.pointerClick('field-outlined',false);else field.actions.focus();
 await delay(200);const outlinedFocus=await focusProbe('field-outlined');host.report('Core-focus '+JSON.stringify(outlinedFocus));if(!filledFocus.ok||!outlinedFocus.ok)throw Error('Core focus did not reach the actual UIA root');await host.replaceText('Core 한글 😀');const typed=performance.now()+5000;while(material().outlined.text!=='Core 한글 😀'){if(performance.now()>typed)throw Error('Actual OS Unicode input did not reach the message');await delay(20);}
 await delay(10000);if(publicOrder)await host.pointerClick('toggle-theme',false);else tap('toggle-theme');await delay(1000);
 for(const name of ['Clear messages','Undo message']){const node=view.controller.nodes.find((node:any)=>node.name===name);if(!node)throw Error('Missing '+name);if(publicOrder)await host.pointerClick(name,true);else(node.actions?.activate??node.activate)();await delay(150);}
 if(material().outlined.text!=='Core 한글 😀')throw Error('Editing scenario lost its Undo value');
 // Reproduce the public EXE order too: minimize the maximized editor, restore
 // that backing, then restore the smaller window. Testing hide only after a
 // size change misses resources retained across this sequence.
 await host.windowMode('minimize');await delay(300);await host.windowMode('restore');await delay(1000);
 await delay(5000);generation=view.currentMetrics.nativeSurfaceGeneration;host.report('editing-resize restore');await host.windowMode('restore');await resizeSettled(generation);
 if(material().outlined.text!=='Core 한글 😀')throw Error('Resize replaced the message controller');
 for(const [hide,show]of [['hide','show'],['minimize','restore']]){
  const original=material().outlined.value;await host.windowMode(hide);const hiddenDeadline=performance.now()+2500;while(view.controller.scheduler.visible){if(performance.now()>hiddenDeadline)throw Error('Core scheduling remained visible after actual window '+hide);await delay(20);}const hiddenFocus=await host.focusSnapshot('field-outlined');if(hiddenFocus.fieldHasFocus===true)throw Error('A hidden field still reported native keyboard focus');await delay(150);const stopped=retiredResizeFrames;await delay(250);if(retiredResizeFrames!==stopped)throw Error('GPU frames continued while the actual window was '+hide);
  const previous=retiredResizeFrames;await host.windowMode(show);view.requestFrame();const shownDeadline=performance.now()+3000;while(!view.controller.scheduler.visible||retiredResizeFrames<=previous||retiredResizeMetrics?.nativeSurfaceGeneration!==view.currentMetrics.nativeSurfaceGeneration){if(performance.now()>shownDeadline)throw Error('Window resume did not retire a current backing frame after '+hide+' '+JSON.stringify({coreVisible:view.controller.scheduler.visible,rendererVisible:resizeRenderer?.visible,previous,retiredResizeFrames,retiredResizeMetrics,metrics:view.currentMetrics,window:await host.windowSnapshot()}));await delay(20);}if(JSON.stringify(material().outlined.value)!==JSON.stringify(original))throw Error('Window '+hide+' replaced Core text/selection');const field=view.controller.nodes.find((node:any)=>node.id==='field-outlined');field?.actions?.focus();const focused=await focusProbe('field-outlined');if(!focused.ok)throw Error('Window resume did not restore actual UIA/Core focus after '+hide);host.report('window-visibility PASS '+hide+' / '+show);
 }
 host.report('editing-resize PASS');
}
async function renderLiveness(){
 for(let attempt=0;attempt<3;attempt++){await host.windowMode('input');await delay(100);if((await host.windowSnapshot()).foreground)break;}
 if(!(await host.windowSnapshot()).foreground)throw Error('Rendering liveness requires its own foreground window');
 tap('show-list-view');await delay(500);
 const list=states().find(entry=>entry.widget instanceof ListViewPage)?.state as any;
 if(!list?.scroll?.hasClients)throw Error('ListView did not attach its actual scroll position');
 list.scroll.jumpTo(600);await delay(200);await drainWheelRendering();
 const begin=await host.windowSnapshot(),scope=view.currentMetrics.nativeSurfaceGeneration,receipts:any[]=[];
 for(let index=0;index<20;index++){
  const before=list.scroll.offset;
  if(index>=8){await host.wheel(view.currentMetrics.logicalWidth*.65,view.currentMetrics.logicalHeight*.65,index%2?-120:120,4,8);await delay(100);await drainWheelRendering();if(Math.abs(list.scroll.offset-before)<.1)throw Error('OS wheel did not move the actual ListView: '+index);}
  // No Widget/layout/paint invalidation accompanies this explicit redraw.
  // The ordinary paint callback reads current frame state, as animation can.
  const frames=(await host.windowSnapshot()).surfaceFrames,expected=0xff000000+(24+index*10)*0x10000+0x8040;
  livenessColor=expected;const began=performance.now();view.requestFrame();let observed=0;
  for(;;){observed=await host.samplePixel(12,76);if([0,8,16].every(shift=>Math.abs((observed>>>shift&255)-(expected>>>shift&255))<=2))break;if(performance.now()-began>1500)throw Error('Requested rendering stopped: '+JSON.stringify({index,expected,observed,frames,window:await host.windowSnapshot(),metrics:view.currentMetrics}));await delay(16);}
  const after=await host.windowSnapshot();if(after.surfaceFrames<=frames)throw Error('Desktop pixels did not have a fresh native surface frame: '+index);
  if(view.currentMetrics.nativeSurfaceGeneration!==scope)throw Error('A resize masked the fixed-scope rendering regression');
  receipts.push({index,wheel:index>=8,offset:list.scroll.offset,frames:after.surfaceFrames,elapsedMs:performance.now()-began});
 }
 host.report('render-liveness PASS '+JSON.stringify({redraws:20,osWheelBursts:12,pixelReceipts:receipts.length,nativeFrames:(await host.windowSnapshot()).surfaceFrames-begin.surfaceFrames,maximumRedrawMs:Math.max(...receipts.map(value=>value.elapsedMs)),scope:'owned desktop points and native frames; fixed surface generation'}));
}
async function galleryRegression(){
 const errors:unknown[]=[],previous=FlutterError.onError;FlutterError.onError=details=>{errors.push(details.exception);previous?.(details);};
 try{
  const before=(await host.windowSnapshot()).surfaceFrames;
  const mounted=(keys:Map<string,unknown>,seen:Set<string>)=>{for(const {widget}of states())if(widget instanceof GallerySection){for(const [id,key]of keys)if(widget.key===key)seen.add(id);}};
  const scan=async(name:string,state:any,controllers:any[],expected:readonly {id:string}[])=>{
   const seen=new Set<string>();
   for(const scroll of controllers){if(!scroll.hasClients)continue;scroll.jumpTo(0);await delay(120);
    for(let step=0;step<30;step++){
     mounted(state.sectionKeys,seen);if(seen.size===expected.length)break;
     const position=scroll.position;if(position.pixels>=position.maxScrollExtent-.5)break;
     scroll.jumpTo(Math.min(position.maxScrollExtent,position.pixels+Math.max(1,position.viewportDimension*.8)));await delay(120);
    }
    mounted(state.sectionKeys,seen);
   }
   const missing=expected.filter(demo=>!seen.has(demo.id)).map(demo=>demo.id);if(missing.length)throw Error(name+' gallery did not mount: '+missing.join(','));
   if(errors.length)throw Error(name+' framework errors: '+errors.map(String).join(';'));
   host.report('gallery-mounted '+name+' '+seen.size);
  };
  const m=material(),filled='Material 한글 😀',outlined='Message Ω';m.filled.text=filled;m.outlined.text=outlined;
  const nativeEdit=async(id:string,controller:any,text:string)=>{
   const ready=performance.now()+3000;while(!galleryInteraction?.editorValue(id)){if(performance.now()>ready)throw Error('Native editor did not attach: '+id);await delay(20);}
   controller.text=text;controller.selection={anchor:2,focus:text.length-2};const deadline=performance.now()+3000;
   for(;;){const value=galleryInteraction.editorValue(id);if(value?.text===text&&value.selection.anchor===2&&value.selection.focus===text.length-2)return;if(performance.now()>deadline)throw Error('Native document did not acknowledge Core text/selection: '+id+' '+JSON.stringify(value));await delay(20);}
  };
  m.select('text');await delay(300);await nativeEdit('field-filled',m.filled,'Native 한글 😀');await nativeEdit('field-filled',m.filled,filled);await nativeEdit('field-outlined',m.outlined,'Native message 한글 😀');await nativeEdit('field-outlined',m.outlined,outlined);
  if(!m.includePlanned){tap('toggle-planned');await delay(200);}m.select('all');await delay(300);
  await scan('material',m,[m.firstScroll,m.secondScroll],demos);
  tap('show-cupertino');await delay(1000);const c=cupertino(),values=c.values,text='Cupertino 한글 😀';values.text.text=text;if(!values.includePlanned){tap('cupertino-toggle-planned');await delay(200);}c.select('all');await delay(300);
  await scan('cupertino',c,[c.scroll],cupertinoDemos);
  c.select('text');await delay(300);await nativeEdit('cupertino-field',values.text,'Native 한글 😀');await nativeEdit('cupertino-field',values.text,text);host.report('gallery-native-editing PASS');
  tap('show-material');await delay(1000);if(material().filled.text!==filled||material().outlined.text!==outlined)throw Error('Design replacement lost Material controllers');
  tap('show-cupertino');await delay(1000);if(cupertino().values!==values||values.text.text!==text)throw Error('Design replacement lost Cupertino controller');
  const retired=resizeRenderer.observe((event:any)=>{if(event.kind==='retired'&&event.result==='gpu-retired'){retiredResizeMetrics=event.token.metrics;retiredResizeFrames++;}});
  try{
   const controllerValues=JSON.stringify([material().filled.value,material().outlined.value,values.text.value]);
   const generation=view.currentMetrics.nativeSurfaceGeneration;await host.windowMode('restore');await resizeSettled(generation);
   await resizeWindow();
   for(const [hide,show]of [['hide','show'],['minimize','restore']]){
    await host.windowMode(hide);const hidden=performance.now()+3000;while(view.controller.scheduler.visible){if(performance.now()>hidden)throw Error('Gallery remained visible after '+hide);await delay(20);}await delay(150);const stopped=retiredResizeFrames;await delay(250);if(retiredResizeFrames!==stopped)throw Error('Gallery GPU frames continued while '+hide);
    await host.windowMode(show);view.requestFrame();const shown=performance.now()+3000;while(!view.controller.scheduler.visible||retiredResizeFrames<=stopped||retiredResizeMetrics?.nativeSurfaceGeneration!==view.currentMetrics.nativeSurfaceGeneration){if(performance.now()>shown)throw Error('Gallery resume did not retire the current backing');await delay(20);}
   }
   if(JSON.stringify([material().filled.value,material().outlined.value,values.text.value])!==controllerValues)throw Error('Resize/visibility replaced gallery text or selection');
   if(!host.queueFailureStart())throw Error('Gallery UI failure probe could not start');const deadline=performance.now()+1500;while(!host.queueFailureReady()&&performance.now()<deadline)await delay(10);if(!host.queueFailureReady()||!host.queueFailureFinish())throw Error('Gallery UI failure lost its first cause or ownership');
   host.report('gallery-lifecycle PASS resizes=6');
  }finally{retired.dispose();}
  if(errors.length)throw Error('Gallery framework errors: '+errors.map(String).join(';'));
  await drainWheelRendering();if((await host.windowSnapshot()).surfaceFrames<=before)throw Error('Gallery did not complete a native frame');host.report('gallery-regression PASS');
 }finally{FlutterError.onError=previous;if(originalGalleryPublish)interactionPrototype.publish=originalGalleryPublish;}
}
/** The held phases isolate host publication cost, not an accessibility mode
 * supported by the product. Core layout/paint/semantics continue unchanged. */
async function semanticsScroll(){
 for(const category of ['selection','text'] as const){
  material().select(category);await delay(600);const scroll=material().firstScroll;
  if(scroll.position.maxScrollExtent<=0)throw Error('Semantics diagnostic requires overflowing '+category);
  const low=Math.min(60,scroll.position.maxScrollExtent*.1),high=Math.min(scroll.position.maxScrollExtent,low+240);
  for(const transport of ['live','held']){
   scroll.jumpTo(low);await delay(180);await drainWheelRendering();start('semantics-'+category+'-'+transport);
   for(let i=0;i<2;i++){await scroll.animateTo(high,{duration:600,curve:Curves.linear});await scroll.animateTo(low,{duration:600,curve:Curves.linear});}
   await drainWheelRendering();await delay(120);end();await delay(180);
   if(transport==='live'){
    const nodes=(view.controller as any).nodes as readonly any[],node=nodes.find(node=>category==='text'?node.role==='text-field':node.checked!==undefined);
    if(!node)throw Error('Missing settled accessible '+category+' control');
    const actual=await host.semanticsBounds(node.semanticsIdentifier??node.id),scale=view.currentMetrics.scale,bounds=node.bounds;
    if(actual.error||Math.abs(actual.left-actual.originX-bounds.x*scale)>1||Math.abs(actual.top-actual.originY-bounds.y*scale)>1||Math.abs(actual.width-bounds.width*scale)>1||Math.abs(actual.height-bounds.height*scale)>1)throw Error('Settled UIA bounds disagree with Core '+JSON.stringify({category,bounds,scale,actual}));
    host.report('semantics-bounds '+category+' PASS');
   }
  }
 }
 host.report('semantics-scroll PASS');
}
/** Native CPU comparison of the actual list and dense gallery. Programmatic
 * offsets isolate frame work; OS wheel and physical trackpad are separate. */
async function galleryScroll(){
 const measure=async(name:string,run:()=>Promise<void>)=>{await drainWheelRendering();start(name);await run();await drainWheelRendering();end();await delay(150);};
 tap('show-list-view');await delay(400);
 const list=states().find(({widget})=>widget instanceof ListViewPage)?.state;if(!list?.scroll?.hasClients)throw Error('List scroll owner missing');
 const sweep=async(scroll:any,target:number,duration=1800)=>scroll.animateTo(target,{duration,curve:Curves.linear});
 await measure('list-scroll',async()=>{await sweep(list.scroll,1800);await sweep(list.scroll,0);});
 tap('list-view-back');await delay(400);material().select('all');await delay(400);
 const scroll=material().firstScroll;
 await measure('gallery-cold',async()=>{await sweep(scroll,scroll.position.maxScrollExtent,2800);});
 await measure('gallery-revisit',async()=>{await sweep(scroll,0,2800);});
 scroll.jumpTo(60);await delay(180);
 await measure('gallery-retained',async()=>{await sweep(scroll,84,600);await sweep(scroll,60,600);});
 material().select('text');await delay(400);scroll.jumpTo(60);await delay(180);
 await measure('gallery-text',async()=>{await sweep(scroll,84,600);await sweep(scroll,60,600);});
 scroll.jumpTo(0);await delay(400);
 const field=view.controller.nodes.find((node:any)=>node.id==='field-filled');if(!field)throw Error('Visible field for hover workload missing');
 const x=field.bounds.x+Math.min(20,field.bounds.width/2),y=field.bounds.y+field.bounds.height/2,focus=view.controller.buildOwner.focus.primaryFocus;
 const hover=(pointX:number)=>{view.controller.mouseTracker.clearDevices();view.dispatchPointer({kind:'hover',x:pointX,y,pointer:0,device:'mouse',buttons:0,timestamp:view.controller.context.clock.now(),viewportGeneration:view.currentMetrics.viewportGeneration});};
 hover(Math.max(0,field.bounds.x-24));await delay(250);await drainWheelRendering();
 await measure('gallery-text-no-hover',async()=>{await sweep(scroll,176,1200);await sweep(scroll,0,1200);});
 hover(x);await delay(250);await drainWheelRendering();
 const hovered=states().find(({widget})=>widget instanceof TextField&&widget.id==='field-filled');if(!hovered?.state.hovering)throw Error('Fixed pointer did not enter the actual Material field');
 await measure('gallery-text-hover',async()=>{await sweep(scroll,176,1200);await sweep(scroll,0,1200);});
 const mouse=(view.controller.mouseTracker as any).states;if(mouse.size!==1||mouse.get(0)?.event.x!==x||mouse.get(0)?.event.y!==y)throw Error('Owned hover workload received external pointer input');
 if(view.controller.buildOwner.focus.primaryFocus!==focus)throw Error('Hover must not focus an editor');
 view.controller.mouseTracker.clearDevices();await delay(200);await drainWheelRendering();
 host.report('gallery-scroll PASS programmatic; physical-trackpad=notVerified displayed=unobserved');
}
/** W16: one uninterrupted native stream per phase. Only the stream boundary
 * drains rendering; no seek, per-packet timer or render wait paces input. */
async function continuousScroll(){
 const api=(globalThis as any).NelyxWindowsHost;
 if(typeof api?.drainFrameTrace!=='function')throw Error('Native frame trace required');
 const receipts:any[]=[],inputs:Array<{sequence:number;timestamp:number}>=[];
 const previousError=FlutterError.onError,frameworkErrors:string[]=[];
 FlutterError.onError=details=>{if(frameworkErrors.length<3)frameworkErrors.push(String(details.exception));previousError?.(details);};
 let streamToken=0;
 let measuredScroll:any,unchangedInputs=0,queueCalls=0,queueHighWater=0,firstNativeSequence:number|undefined,lastNativeSequence:number|undefined,nativeSequenceRegressions=0;
 const queue=ViewRuntime.prototype.queuePointer;
 ViewRuntime.prototype.queuePointer=function(event){
  const observed=!!phase&&event.kind==='wheel';
  if(observed){queueCalls++;queueHighWater=Math.max(queueHighWater,(this as any).pointerMailbox.length);if(event.inputSequence!==undefined){firstNativeSequence??=event.inputSequence;if(lastNativeSequence!==undefined&&event.inputSequence<=lastNativeSequence)nativeSequenceRegressions++;lastNativeSequence=event.inputSequence;}}
  try{return queue.call(this,event);}finally{if(observed)queueHighWater=Math.max(queueHighWater,(this as any).pointerMailbox.length);}
 };
 const dispatch=ViewRuntime.prototype.dispatchPointer;
 ViewRuntime.prototype.dispatchPointer=function(event){const before=(this as any).inputSequence,offset=measuredScroll?.offset;const value=dispatch.call(this,event);if(phase&&event.kind==='wheel'&&(this as any).inputSequence>before){if(measuredScroll?.offset!==offset)inputs.push({sequence:(this as any).inputSequence,timestamp:event.timestamp});else unchangedInputs++;}return value;};
 const collect=()=>receipts.push(...api.drainFrameTrace());
 const stream=async(name:string,scroll:any,delta:number,count=240,interval=16,sweep=false,coverage?:{ids:readonly string[];keys:Map<string,unknown>})=>{
  // Routing/building a new page can hand activation back to another window.
  // Reacquire only at the phase boundary; never pace or retry wheel packets.
  if(wheelInputMode==='os'){
   let window:any;
   for(let attempt=0;attempt<3;attempt++){await host.windowMode(viewport==='maximized'?'input-maximized':'input');await delay(100);window=await host.windowSnapshot();if(window.foreground)break;}
   if(!window.foreground)throw Error('Continuous phase could not acquire its own foreground window '+JSON.stringify({name,window}));
  }
  const render=scroll.position.context.notificationContext.findRenderObject(),point=transform(render.getTransformTo(),{x:render.size.width*.5,y:render.size.height*.5});
  await drainWheelRendering();api.drainFrameTrace();receipts.length=0;inputs.length=0;unchangedInputs=0;queueCalls=0;queueHighWater=0;firstNativeSequence=undefined;lastNativeSequence=undefined;nativeSequenceRegressions=0;measuredScroll=scroll;
  const initial=scroll.offset,dimension=scroll.position.viewportDimension;let minimum=initial,maximum=initial;
  const token=coverage?++streamToken:0,maximumInjected=coverage?8192:count,seen=new Set<string>(),expected=new Set(coverage?.ids),keyIds=new Map<unknown,string>();
  for(const id of expected)keyIds.set(coverage!.keys.get(id),id);
  let reachedEdge=false,coverageFailure:unknown,stopped=false;
  const observeCoverage=()=>{try{
   if(!coverage)return;
   for(const element of mountedGallerySections){if(!element.active)continue;const id=keyIds.get(element.widget.key);if(id===undefined)continue;const child=element.findRenderObject();if(!child)continue;let ancestor:RenderObject|undefined=child;while(ancestor&&ancestor!==render)ancestor=ancestor.parent;if(!ancestor)continue;
    const box=child as RenderObject&{size:{width:number;height:number}},origin=transform(child.getTransformTo(render),{x:0,y:0});if(origin.y<dimension&&origin.y+box.size.height>0)seen.add(id);
   }
   reachedEdge=delta<0?scroll.offset>=scroll.position.maxScrollExtent-.01:scroll.offset<=.01;
   if(queueCalls>0&&reachedEdge&&(name.endsWith('-fast')||seen.size===expected.size)&&!stopped)stopped=host.stopWheelStream(token)===true;
  }catch(error){coverageFailure=error;if(queueCalls>0&&!stopped)stopped=host.stopWheelStream(token)===true;}};
  const observe=()=>{minimum=Math.min(minimum,scroll.offset);maximum=Math.max(maximum,scroll.offset);};scroll.addListener(observe);
  const poll=setInterval(collect,32);start(name);const began=performance.now();
  observeContinuousCoverage=observeCoverage;observeCoverage();
  try{
   // SDK queue diagnostics preserve packet deltas and reversal, while remaining
   // separate from the actual OS ingress and its latency evidence.
   if(coverage){count=await host.wheelStream(point.x,point.y,delta,maximumInjected,interval,token);if(!Number.isSafeInteger(count)||count<1||count>maximumInjected)throw Error('Invalid full-catalog injection count');}
   else await (wheelInputMode==='queued'?(sweep?host.queuedWheelSweep:host.queuedWheel).call(host,point.x,point.y,delta,count,view.currentMetrics.nativeSurfaceGeneration,interval):sweep?host.wheelSweep(point.x,point.y,delta,count,interval):host.wheel(point.x,point.y,delta,count,interval));
   const expectedDistance=count*Math.abs(delta)*.4,expectedNetDistance=sweep?0:-count*delta*.4,deadline=performance.now()+5000;
   // Windows can combine consecutive wheel messages before assigning native
   // sequence numbers. Delivery is conserved distance, not SendInput count.
   while((counts['Input.wheelDistance']??0)<expectedDistance-.001){if(performance.now()>deadline)throw Error('Continuous input delivery incomplete '+JSON.stringify({name,count,received:counts['Input.wheel'],absoluteDistance:counts['Input.wheelDistance'],expectedDistance,queueCalls,queueHighWater,firstNativeSequence,lastNativeSequence,nativeSequenceRegressions}));await delay(5);}
   await drainWheelRendering();collect();
   observeCoverage();if(coverageFailure)throw coverageFailure;
   if(frameworkErrors.length)throw Error('Handled framework errors during continuous workload '+JSON.stringify(frameworkErrors));
   if(coverage&&(!reachedEdge||!stopped||!name.endsWith('-fast')&&seen.size!==expected.size))throw Error('Full catalog traversal incomplete '+JSON.stringify({name,reachedEdge,count,expected:[...expected],seen:[...seen]}));
   const received=counts['Input.wheel']??0;
   if(received<1||received>count||wheelInputMode==='queued'&&received!==count||queueCalls!==received||nativeSequenceRegressions||wheelInputMode==='os'&&lastNativeSequence!-firstNativeSequence!+1!==received||Math.abs((counts['Input.wheelDistance']??0)-expectedDistance)>.001||Math.abs((counts['Input.wheelNetDistance']??0)-expectedNetDistance)>.001)throw Error('Continuous native input distance or sequence mismatch '+JSON.stringify({name,count,received,queueCalls,firstNativeSequence,lastNativeSequence,expectedDistance,expectedNetDistance,absoluteDistance:counts['Input.wheelDistance'],netDistance:counts['Input.wheelNetDistance']}));
   const oldest:number[]=[],latest:number[]=[];let through=0;
   for(const entry of receipts){if(entry.stage!==2||entry.inputSequence<=through)continue;const covered=inputs.filter(input=>input.sequence>through&&input.sequence<=entry.inputSequence);through=entry.inputSequence;if(!covered.length)continue;const surface=windowsMonotonicTimestamp(entry.nativeTimestamp);oldest.push(surface-covered[0]!.timestamp);latest.push(surface-covered[covered.length-1]!.timestamp);}
   if(inputs.length&&!oldest.length||inputs.some(input=>input.sequence>through))throw Error('Continuous offset-changing input did not reach its matching surface '+JSON.stringify({name,applied:inputs.length,unchanged:unchangedInputs,through,last:inputs.at(-1)?.sequence}));
   const cpu=stats['Frame.cpu']??[],mounts=counts['Element.mount']??0;
   const requiredDistance=name==='list-cold'?5*dimension:Math.min(5*dimension,Math.max(0,scroll.position.maxScrollExtent-initial));
   if(name.includes('-cold')&&((requiredDistance>0&&!mounts)||maximum-minimum+.01<requiredDistance))throw Error('Cold workload did not expose its required range '+JSON.stringify({name,mounts,minimum,maximum,dimension,requiredDistance}));
   const report={name,catalogScope:fullCatalog?'full':'bounded',requestedCount:count,maximumInjected,injection:coverage?'until-edge':'fixed',requestedDelta:delta,received,appliedInputs:inputs.length,unchangedInputs,delivery:{queueCalls,queueHighWater,firstNativeSequence,lastNativeSequence,nativeSequenceRegressions},latencyScope:wheelInputMode==='queued'?'offset-changing SDK packets':'offset-changing native packets',absoluteDistance:counts['Input.wheelDistance'],netDistance:counts['Input.wheelNetDistance'],initial,final:scroll.offset,minimum,maximum,viewport:dimension,elapsedMs:performance.now()-began,requestedIntervalMs:interval,cpu:summarize([...cpu]),entryCpu:summarize([...(stats['Frame.entryCpu']??[])]),retainedCpu:summarize([...(stats['Frame.retainedCpu']??[])]),itemCreateBuildFirstLayout:summarize([...(stats['Item.createBuildFirstLayout']??[])]),createdRows:counts['Item.createdRows']??0,createdElements:counts['Item.createdElements']??0,...(coverage?{coverage:{expectedIds:[...expected],seenIds:[...seen],reachedEdge,direction:delta<0?'forward':'reverse'}}:{}),oldestInputToSurface:summarize(oldest),latestInputToSurface:summarize(latest),mounts,unmounts:counts['Element.unmount']??0,displayed:'unobserved',physicalTrackpad:'notVerified'};
   end();host.report('CONTINUOUS '+JSON.stringify(report));
  }finally{if(token)host.stopWheelStream(token);observeContinuousCoverage=undefined;clearInterval(poll);scroll.removeListener(observe);measuredScroll=undefined;await host.restoreWheelPointer();}
 };
 try{
  await host.windowMode(wheelInputMode==='queued'?'restore':viewport==='maximized'?'show':'input');await delay(200);
  tap('show-list-view');await delay(400);await drainWheelRendering();
  const list=states().find(({widget})=>widget instanceof ListViewPage)?.state;if(!list?.scroll?.hasClients)throw Error('List controller missing');
  list.scroll.jumpTo(60);await delay(100);await stream('list-retained',list.scroll,-1,48,16,true);
  for(const [name,scroll]of [['list',list.scroll]] as const){const delta=-Math.ceil(scroll.position.viewportDimension*5.5/(240*.4));await stream(name+'-cold',scroll,delta);await stream(name+'-revisit',scroll,-delta);await stream(name+'-fast',scroll,delta,240,4);}
  tap('list-view-back');await delay(300);
  for(const name of ['material','cupertino']){
   if(name==='cupertino'){tap('show-cupertino');await delay(300);}
   const state=name==='material'?material():cupertino();
   // Compact pages intentionally omit the planned/filter controls. Set this
   // fixture's catalog input through State, then use the page's real category
   // transition to reset extent/scroll owners. Product widgets stay unchanged.
   if(fullCatalog&&!(name==='material'?state.includePlanned:state.values.includePlanned))state.setState(()=>{if(name==='material')state.includePlanned=true;else state.values.includePlanned=true;});
   state.select('all');await delay(300);await drainWheelRendering();
   const controllers=name==='material'?[state.firstScroll,state.secondScroll]:[state.scroll];
   const catalogs=name==='material'?[state.firstExtents.ids,state.secondExtents.ids]:[state.extents.ids];
   if(fullCatalog){const actual=catalogs.filter((_ids:any,i:number)=>controllers[i]?.hasClients).flat().slice().sort(),all=(name==='material'?demos:cupertinoDemos).map(demo=>demo.id).sort();if(JSON.stringify(actual)!==JSON.stringify(all))throw Error('Full gallery membership differs from product catalog '+JSON.stringify({name,actual,all}));}
   for(let column=0;column<controllers.length;column++){const scroll=controllers[column];if(!scroll?.hasClients)continue;const coverage=fullCatalog?{ids:catalogs[column] as readonly string[],keys:state.sectionKeys as Map<string,unknown>}:undefined,dimension=scroll.position.viewportDimension;
    const delta=-Math.min(120,Math.ceil(dimension*(fullCatalog?16/1000:5.5/240)/.4)),fastDelta=fullCatalog?-Math.min(120,Math.ceil(dimension*3*4/1000/.4)):delta;
    await stream(name+'-'+column+'-cold',scroll,delta,240,16,false,coverage);await stream(name+'-'+column+'-revisit',scroll,-delta,240,16,false,coverage);await stream(name+'-'+column+'-fast',scroll,fastDelta,240,4,false,coverage);
   }
  }
  host.report('continuous-scroll PASS');
 }finally{FlutterError.onError=previousError;ViewRuntime.prototype.dispatchPointer=dispatch;ViewRuntime.prototype.queuePointer=queue;}
}
async function researchEngine(){
  if(continuousInput)return continuousScroll();
  const api=(globalThis as any).NelyxWindowsHost;
  if(typeof api?.drainFrameTrace!=='function')throw Error('Current native frame trace is required');
  await host.windowMode(viewport==='maximized'?'show':'input');await delay(150);
  const receipts:any[]=[];
  const collect=()=>receipts.push(...api.drainFrameTrace());
  api.drainFrameTrace();
  start('list-cold');tap('show-list-view');await delay(700);await drainWheelRendering();collect();end();
  const list=states().find(({widget})=>widget instanceof ListViewPage)?.state;
  if(!list?.scroll?.hasClients)throw Error('Actual ListView controller missing');
  tap('list-view-item-0');await delay(250);list.scroll.jumpTo(60);await delay(150);await drainWheelRendering();collect();
  const node=view.controller.nodes.find((node:any)=>node.id==='list-view-item-0');if(!node)throw Error('Selected partial row missing');
  const scrollRender=list.scroll.position.context.notificationContext.findRenderObject(),wheelPoint=transform(scrollRender.getTransformTo(),{x:scrollRender.size.width*.5,y:scrollRender.size.height*.5});
  const clipOrigin=transform(scrollRender.getTransformTo(),{x:0,y:0}),colors=Theme.of(list.context).colorScheme;
  const pixelProbes=[{name:'selected',x:clipOrigin.x+scrollRender.size.width-3,y:clipOrigin.y+4,color:colors.secondaryContainer},{name:'title-edge',x:clipOrigin.x+scrollRender.size.width-3,y:clipOrigin.y-4,color:colors.surface},{name:'footer-edge',x:clipOrigin.x+scrollRender.size.width-3,y:clipOrigin.y+scrollRender.size.height+4,color:colors.surface}];
  const closeColor=(a:number,b:number)=>[0,8,16].every(shift=>Math.abs(((a>>>shift)&255)-((b>>>shift)&255))<=6);
  for(const probe of pixelProbes){let actual=0;for(let retry=0;retry<15;retry++){actual=await host.samplePixel(probe.x,probe.y);if(closeColor(actual,probe.color))break;await delay(100);}if(!closeColor(actual,probe.color))throw Error('Actual list clip pixel mismatch '+JSON.stringify({...probe,actual}));}
  host.report('list-clip-pixels PASS actual owned screen selected/title/footer; displayed timing unobserved');
  host.report('list-wheel-target '+JSON.stringify({point:wheelPoint,partialRow:node.bounds,metrics:view.currentMetrics}));
  await host.windowMode(viewport==='maximized'?'show':'restore');await delay(150);await drainWheelRendering();collect();const warmStart=receipts.length;let warmMin=list.scroll.offset,warmMax=warmMin;
  const observeWarm=()=>{warmMin=Math.min(warmMin,list.scroll.offset);warmMax=Math.max(warmMax,list.scroll.offset);};list.scroll.addListener(observeWarm);
  // Ten 24-event half sweeps stay inside the same loaded rows. A single owned
  // stream avoids cursor/hover churn between batches and yields a useful tail
  // distribution; drain the fixed native ring while that stream is in flight.
  const tracePoll=setInterval(collect,32);start('list-warm');const warmInputStart=performance.now();
  try{await host.wheelSweep(wheelPoint.x,wheelPoint.y,-1,240,16);const delivered=performance.now()+3000;while((counts['Input.wheel']??0)<240){if(performance.now()>delivered)throw Error('Warm wheel input did not fully arrive: '+JSON.stringify(counts));await delay(1);}await drainWheelRendering();}
  finally{clearInterval(tracePoll);list.scroll.removeListener(observeWarm);collect();}
  if((counts['Element.mount']??0)!==0||(counts['Element.unmount']??0)!==0)throw Error('Warm list input recreated rows');end();
  const warmRange={events:240,received:counts['Input.wheel']??0,absoluteDistance:counts['Input.wheelDistance']??0,netDistance:counts['Input.wheelNetDistance']??0,halfSweeps:10,minimum:warmMin,maximum:warmMax,final:list.scroll.offset};
  if(warmRange.received!==240||Math.abs(warmRange.netDistance)>.001||warmMax-warmMin<4||Math.abs(list.scroll.offset-60)>.01)throw Error('Actual alternating OS wheel did not move and return the loaded list: '+JSON.stringify(warmRange));
  host.report('list-warm-range '+JSON.stringify(warmRange));
  const seenInputs=new Set<number>(),excludedBeforeWarm=new Set<number>(),latencies:number[]=[];for(const entry of receipts.slice(warmStart)){if(entry.stage!==2||entry.inputSequence<1||entry.inputTimestamp<0||seenInputs.has(entry.inputSequence))continue;if(entry.inputTimestamp<warmInputStart){excludedBeforeWarm.add(entry.inputSequence);continue;}seenInputs.add(entry.inputSequence);latencies.push(windowsMonotonicTimestamp(entry.nativeTimestamp)-entry.inputTimestamp);}
  if(!latencies.length)throw Error('No input received during the warm phase reached its matching surface');
  latencies.sort((a,b)=>a-b);host.report('latest-input-to-surface '+JSON.stringify({n:latencies.length,p95:latencies[Math.ceil(latencies.length*.95)-1],p99:latencies[Math.ceil(latencies.length*.99)-1],max:latencies[latencies.length-1],origin:'native-receive',scope:'inputs-received-during-warm',excludedBeforeWarm:excludedBeforeWarm.size,displayed:'unobserved'}));
  await host.restoreWheelPointer();
  start('list-entry-cold');for(const offset of [20000,60000,20000,0]){list.scroll.jumpTo(offset);await delay(100);await drainWheelRendering();collect();}end();
  start('list-entry-revisit');for(const offset of [20000,60000,20000,0,20000,60000,20000,0]){list.scroll.jumpTo(offset);await delay(100);await drainWheelRendering();collect();}end();
  if(viewport==='maximized'){await host.windowMode('restore');await delay(150);await drainWheelRendering();collect();}
  start('list-resize');const original=view.currentMetrics.nativeSurfaceGeneration;
  for(const [width,height] of [[1200,900],[1000,1000],[1200,900]]){const before=view.currentMetrics.nativeSurfaceGeneration;await host.resize(width,height);await resizeSettled(before);collect();}
  if(view.currentMetrics.nativeSurfaceGeneration<=original+1)throw Error('A-B-A did not advance native epochs');
  // A drag can produce more than the native numeric ring's 256 observations.
  // Drain during the interval, just like warm input, with a bounded fixture
  // buffer so request/surface pairs cannot silently disappear before analysis.
  // A-B-A's final packet may still retire after resizeSettled resolves. Keep
  // its remaining stages in the full receipt stream before isolating drag
  // latency; discarding this drain creates false 0->3 terminal-order gaps.
  collect();const drag:any[]=[];let dragOverflow=false;
  const collectDrag=()=>{const batch=api.drainFrameTrace();if(drag.length+batch.length>4096)dragOverflow=true;else if(!dragOverflow)drag.push(...batch);};
  const dragPoll=setInterval(collectDrag,16);let dragInterval:any;
  try{dragInterval=await dragResize();}finally{clearInterval(dragPoll);collectDrag();}
  if(dragOverflow)throw Error('Resize trace exceeded its bounded fixture buffer');receipts.push(...drag);
  host.report('resize-progress '+JSON.stringify({interval:dragInterval,stages:drag.map((entry:any)=>({stage:entry.stage,surface:entry.surfaceGeneration,t:entry.nativeTimestamp})),native:(globalThis as any).NelyxWindowsHost.getStatus()}));end();
  const requested=drag.filter((entry:any)=>entry.stage===6),latency=drag.filter((entry:any)=>entry.stage===2).map((entry:any)=>{const request=requested.find((value:any)=>value.surfaceGeneration===entry.surfaceGeneration);return request?entry.nativeTimestamp-request.nativeTimestamp:null;}).filter((value):value is number=>value!==null).sort((a,b)=>a-b);
  if(!latency.length||latency.some((value:number)=>!Number.isFinite(value)||value<0))throw Error('Resize trace lost its matching request/surface latency pairs');
  host.report('resize-request-to-surface '+JSON.stringify({n:latency.length,p95:latency[Math.ceil(latency.length*.95)-1],p99:latency[Math.ceil(latency.length*.99)-1],max:latency[latency.length-1],displayed:'unobserved'}));
  const intermediate=new Set(drag.filter((entry:any)=>entry.stage===2&&entry.nativeTimestamp>=dragInterval.began&&entry.nativeTimestamp<dragInterval.ended).map((entry:any)=>entry.surfaceGeneration));
  if(intermediate.size<2)throw Error('Real sizing loop did not publish multiple intermediate layout epochs: '+JSON.stringify({dragInterval,updates:drag.filter((entry:any)=>entry.stage===2)}));
  const {completed,superseded}=validateNativeFrameTerminals(receipts);
  if(completed<8)throw Error('Insufficient native frame terminals');
  host.report('research-engine PASS '+JSON.stringify({completed,superseded,intermediateResizeEpochs:intermediate.size,displayed:'unobserved',physicalTrackpad:'notVerified'}));
  tap('list-view-back');await delay(600);await drainWheelRendering();
  // Exercise the selected Cubic loop on an actual retained route animation.
  // This follows the list measurements; its changed viewport is not folded
  // into the default/maximized warm-list comparison.
  tap('show-cupertino');await delay(700);cupertino().select('navigation');await delay(700);await waitForAction('cupertino-open-route');
  start('route-typed');tap('cupertino-open-route');await delay(550);await waitForAction('cupertino-route-return');tap('cupertino-route-return');await delay(550);await waitForAction('cupertino-open-route');end();
}
setTimeout(()=>{if(host.startupDeadlineEnabled())return;if(mode==='interactive'){void host.windowMode('restore').then(()=>host.report('interactive-ready'));return;}void(async()=>{try{
 if(mode==='startup-probe'){
  const deadline=performance.now()+10000;while(!view||(await host.windowSnapshot()).surfaceFrames<1){if(performance.now()>deadline)throw Error('First surface was not produced');await delay(20);}
  host.report('startup-probe PASS');return;
 }
 // The native test process starts with windowsHide. Explicitly show its own
 // interactive window before expecting a Core frame or injecting OS input.
 await host.windowMode('restore');
 const readyDeadline=performance.now()+8000;while(!view){if(performance.now()>readyDeadline)throw Error('Core View did not open: '+JSON.stringify(await host.windowSnapshot()));await delay(20);}host.report('window-initial '+JSON.stringify(await host.windowSnapshot()));
 if((!resize||mode==='research-engine')&&mode!=='editing-resize'&&mode!=='full-runtime-regression'){
  if(viewport==='fixed')await fitPerformanceViewport();
  else if(viewport==='maximized'){const generation=view.currentMetrics.nativeSurfaceGeneration;await host.windowMode('maximize');const deadline=performance.now()+5000;while(view.currentMetrics.nativeSurfaceGeneration<=generation){if(performance.now()>deadline)throw Error('Maximized viewport did not update');await delay(16);}await delay(300);}
 }
 host.report('window-selected '+JSON.stringify(await host.windowSnapshot()));host.report('view-metrics '+JSON.stringify(view.currentMetrics));
 if(mode==='live-resize'){await liveResize();return;}
 if(mode==='semantics-scroll'){await semanticsScroll();return;}
 if(mode==='gallery-scroll'){await galleryScroll();return;}
 if(wheelInputMode==='os'){
  if(continuousInput){await host.windowMode(viewport==='maximized'?'input-maximized':'input');await delay(100);}
  if((await host.windowSnapshot()).foreground===false)throw Error('Native input workload requires its own foreground window');
 }
 probeNativeFonts();probeNativeTextReuseBudget();await probeNativeClock();
 if(mode==='editing-resize'){await editingResize();return;}
 if(mode==='full-runtime-regression'){await editingResize();const previous=view.currentMetrics.nativeSurfaceGeneration;await host.windowMode('maximize');await resizeSettled(previous);await galleryRegression();return;}
 if(mode==='gallery-regression'){await galleryRegression();return;}
 if(mode==='render-liveness'){await renderLiveness();return;}
  if(mode==='research-engine'){await researchEngine();return;}
 if(resize){if(!host.queueFailureStart())throw Error('UI failure probe could not start');const deadline=performance.now()+1500;while(!host.queueFailureReady()&&performance.now()<deadline)await delay(10);if(!host.queueFailureReady()||!host.queueFailureFinish())throw Error('UI failure lost its original error or released unconfirmed work');}
 if(resize&&resizeCase==='initial'){await dragResize();await resizeWindow();}
 if(trace)for(const [target,name,label]of [[view.controller.root,'syncRenderTree','Widgets.syncRenderTree'],[view.controller.semantics,'update','Semantics.hostUpdate']]){const original=target[name];target[name]=function(...args:any[]){return measured(label,()=>{if(mode==='host-semantics-static'&&label==='Semantics.hostUpdate')return;return original.apply(this,args);});};}
 host.report('select communication');bootTracing=diagnostic;bootMark('select enter');material().select('communication');bootMark('select exit');await delay(500);bootMark('jump max enter');material().firstScroll.jumpTo(material().firstScroll.position.maxScrollExtent);bootMark('jump max exit');await delay(200);bootMark('startup complete');bootTracing=false;host.report('start progress');tap('toggle-progress');await delay(500);
 start('material-progress');if(resize&&resizeCase!=='initial'){await dragResize();await resizeWindow();}await delay(2000);end();tap('toggle-progress');await delay(300);
 await delay(300);const scroll=material().firstScroll;scroll.jumpTo(0);await delay(200);
 if(wheelInput){material().select('all');await delay(400);scroll.jumpTo(0);await delay(200);}
 if(wheelInput){const deadline=performance.now()+3000;while(scroll.position.maxScrollExtent<=0&&performance.now()<deadline)await delay(16);}
 if(scroll.position.maxScrollExtent<=0)throw Error('Scroll scenario has no content overflow: '+JSON.stringify({category:material().category,position:{pixels:scroll.position.pixels,max:scroll.position.maxScrollExtent,viewport:scroll.position.viewportDimension},dirty:view.dirty,pending:!!view.pending,task:!!view.task,buildDirty:view.controller.buildOwner.hasDirty,native:resizeRenderer?.context().nelyxStats()}));
 if(wheelInput&&wheelHover){const render=scroll.position.context.notificationContext.findRenderObject(),point=transform(render.getTransformTo(),{x:render.size.width*.5,y:render.size.height*.5});view.controller.mouseTracker.clearDevices();view.dispatchPointer({kind:'hover',x:point.x,y:point.y,pointer:0,device:'mouse',buttons:0,timestamp:view.controller.context.clock.now(),viewportGeneration:view.currentMetrics.viewportGeneration});await delay(250);await drainWheelRendering();}
 if(wheelInput&&wheelWarmup){phase='wheel-warmup';counts={};const render=scroll.position.context.notificationContext.findRenderObject(),point=transform(render.getTransformTo(),{x:render.size.width*.5,y:render.size.height*.5});await wheelAndDrain(point.x,point.y,-wheelDelta);await wheelAndDrain(point.x,point.y,wheelDelta);await drainWheelRendering();await delay(300);phase='';}
 start('material-scroll');if(resize)await resizeWindow();for(let i=0;i<2;i++){
  if(wheelInput){const render=scroll.position.context.notificationContext.findRenderObject(),point=transform(render.getTransformTo(),{x:render.size.width*.5,y:render.size.height*.5});
   await wheelAndDrain(point.x,point.y,-wheelDelta);const moved=scroll.position.pixels;if(moved<=0)throw Error('Native wheel route did not scroll');
   await wheelAndDrain(point.x,point.y,wheelDelta);if(scroll.position.pixels>=moved)throw Error('Native wheel direction reversal was lost');
  }else{await scroll.animateTo(scroll.position.maxScrollExtent,{duration:800,curve:Curves.linear});await scroll.animateTo(0,{duration:800,curve:Curves.linear});}
 }if(wheelInput){if(wheelInputMode==='queued'&&counts['Input.wheel']!==480||Math.abs((counts['Input.wheelDistance']??0)-480*wheelDelta/120*48)>.001)throw Error('Native wheel distance was lost: '+JSON.stringify(counts));await drainWheelRendering();host.report('wheel-input PASS events='+counts['Input.wheel']+' distance='+counts['Input.wheelDistance']+' requestedIntervalMs='+wheelInterval+' pacing='+(wheelInputMode==='queued'?'owned-queue-render-drain':'continuous-render-drain'));}if(wheelInput&&wheelHover&&view.controller.mouseTracker.states.size!==1)throw Error('Owned hover workload received external mouse input');if(wheelInput&&wheelWarmup&&wheelDelta===1&&((counts['Element.mount']??0)!==0||(counts['Element.unmount']??0)!==0))throw Error('Loaded wheel workload recreated Elements: '+JSON.stringify(counts));end();
 tap('show-cupertino');await delay(1200);tap('cupertino-toggle-activity');await delay(500);
 start('cupertino-activity');if(resize)await resizeWindow();await delay(2000);end();tap('cupertino-toggle-activity');await delay(200);
 cupertino().select('navigation');await delay(700);await waitForAction('cupertino-open-route');start('cupertino-route');for(let i=0;i<3;i++){tap('cupertino-open-route');await delay(550);await waitForAction('cupertino-route-return');tap('cupertino-route-return');await delay(550);await waitForAction('cupertino-open-route');}end();if(resize){host.report('resize-settled count='+settledResizes);await host.resize(930,870);}
 }catch(error){host.report('ERROR '+String(error)+' detail='+JSON.stringify(error)+' native='+JSON.stringify((globalThis as any).NelyxWindowsHost?.getStatus?.()));}finally{if(Object.getOwnPropertyNames(globalThis).some(name=>/^__nelyxTyped_[a-f0-9]{16}_calls$/.test(name))){const calls:Record<string,number>={};for(const name of Object.getOwnPropertyNames(globalThis))if(/^__nelyxTyped_[a-f0-9]{16}_calls$/.test(name))calls[name.slice(0,-6)]=(globalThis as any)[name]();host.report('TYPED_EXECUTION '+JSON.stringify(calls));const audit=(globalThis as any).__nelyxStaticHermesAudit?.();if(!audit||!audit.rnwPalNative||!audit.internalJavaScriptNative||!audit.nativeStarted||audit.sourcePreparations||audit.sourceExecutions||audit.bytecodeExecutions||audit.blockedFallbacks||audit.jitEnabled||audit.evalEnabled)host.report('ERROR Static native runtime audit differs: '+JSON.stringify(audit));host.report('AOT_AUDIT '+JSON.stringify(audit));}fixtureWheel?.remove();await host.restoreWheelPointer();host.complete();}})();},4000);
