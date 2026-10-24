// SPDX-License-Identifier: BSD-3-Clause
// Real sample actions. Optional profiling wraps callers; product source stays intact.
import {NativeModules,DeviceEventEmitter} from 'react-native';
import {ViewRuntime} from '@nelyx/core/hosting/runtime';
import {FrameworkRoot} from '@nelyx/core/framework/widgets/root';
import {PaintingContext} from '@nelyx/core/framework/painting/context';
import {RenderRepaintBoundary} from '@nelyx/core/framework/rendering/repaint-boundary';
import {RenderObject,PipelineOwner} from '@nelyx/core/framework/rendering/object';
import {SceneBuilder} from '@nelyx/core/ui/scene';
import {BuildOwner,Element} from '@nelyx/core/framework/widgets/framework';
import {Canvas} from '@nelyx/core/ui/canvas';
import {PictureRecorder} from '@nelyx/core/ui/picture-recorder';
import {TextPainter} from '@nelyx/core/framework/painting/text-painter';
import {Paragraph} from '@nelyx/core/ui/paragraph';
import {ParagraphBuilder} from '@nelyx/core/ui/paragraph-builder';
import {FrameScheduler} from '@nelyx/core/framework/scheduler/scheduler';
import {FramePictureService} from '@nelyx/core/hosting/pictures';
// This fixture is copied beside main.tsx in the runner; probe that installed SDK instance.
import {ReactNativeInteraction} from './node_modules/@nelyx/sdk/src/backends/react-native/interaction';
import {nativeInputProps} from './node_modules/@nelyx/sdk/src/backends/react-native/input';
import {existingPipelineSemantics} from './node_modules/@nelyx/core/dist/framework/rendering/semantics-pipeline';
import {SemanticsBinding} from '@nelyx/core/framework/semantics/binding';
import {SemanticsNode,SemanticsOwner} from '@nelyx/core/framework/semantics/semantics';
import {GraphiteRenderer} from '@nelyx/skia-rn/renderer';
import {ComponentsGallery} from '../../src/gallery';
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
import './nelyx-animation-main-32204.tsx';
const host=NativeModules.NelyxAnimation,diagnostic=false,trace=false||diagnostic,mode:string="cpu-timing",resize=false,resizeCase:string="initial",semanticsInterval:number|null=null;
const cpuOnly=mode==='cpu-timing';
const wheelInput:boolean=true;
const wheelInputMode:string="queued";
const viewport:string="default";
let galleryInteraction:any;
const interactionPrototype=ReactNativeInteraction.prototype as any,originalGalleryPublish=mode==='gallery-regression'?interactionPrototype.publish:undefined;
if(originalGalleryPublish)interactionPrototype.publish=function(...args:any[]){galleryInteraction=this;return originalGalleryPublish.apply(this,args);};
let view:any,phase='',stats:Record<string,number[]>={},exclusive:Record<string,number[]>={},counts:Record<string,number>={},gcBefore:Record<string,unknown>={},lastBuild=0,tree:Record<string,number>={};
let classOwners:Record<string,{n:number;selfMs:number;maxSelfMs:number}>={};
let longFrames:Array<Record<string,number>>=[];
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
function measured<T>(label:string,callback:()=>T):T{const boot=bootTracing&&(label==='Picture.nativeCompile'||label==='Picture.endRecording');if(boot)bootMark(label+' enter');const allocation=diagnostic&&phase&&allocationScopes.has(label)?gc().js_totalAllocatedBytes:undefined,start=performance.now(),entry={children:0};stack.push(entry);try{return callback();}finally{const elapsed=performance.now()-start;stack.pop();if(stack.length)stack[stack.length-1]!.children+=elapsed;sample(label,elapsed);if(phase&&diagnostic)(exclusive[label]??=[]).push(Math.max(0,elapsed-entry.children));if(typeof allocation==='number'){const after=gc().js_totalAllocatedBytes;if(typeof after==='number')sample('Allocated.'+label,after-allocation);}if(boot)bootMark(label+' exit');}}
function measuredClass<T>(label:string,callback:()=>T):T{if(!phase)return callback();const start=performance.now(),entry={children:0};stack.push(entry);try{return callback();}finally{const elapsed=performance.now()-start;stack.pop();if(stack.length)stack[stack.length-1]!.children+=elapsed;const own=Math.max(0,elapsed-entry.children),value=classOwners[label]??={n:0,selfMs:0,maxSelfMs:0};value.n++;value.selfMs+=own;value.maxSelfMs=Math.max(value.maxSelfMs,own);}}
let bootTracing=false;
const bootStages=new Set(['Root.build','Widgets.flushBuild','Pipeline.flushLayout','Pipeline.flushSemantics','Painting.compose','Painting.finishLayer','Boundary.refresh','Painting.recordChild']);
function bootMark(message:string):void{if(!bootTracing)return;const hook=(globalThis as {nativeLoggingHook?:(message:string,level:number)=>void}).nativeLoggingHook;if(hook)hook('BOOT '+message,1);else host.report('BOOT '+message);}
function wrap(type:any,name:string,label:string){const original=type.prototype[name];type.prototype[name]=function(...args:any[]){const step=bootTracing&&bootStages.has(label);if(step)bootMark(label+' enter');try{return measured(label,()=>original.apply(this,args));}finally{if(step)bootMark(label+' exit');}};}
function wrapFrameCallbacks(decorate:(callback:(...args:any[])=>void)=>(...args:any[])=>void):void{
 const raf=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=callback=>raf(decorate(callback));
 const api=(globalThis as any).NelyxWindowsHost;if(api?.frameClockVersion===1){const request=api.requestFrame;api.requestFrame=(callback:any)=>request.call(api,decorate(callback));}
}

if(trace)for(const [type,names,label]of [[FrameworkRoot,['build'],'Root'],[ViewRuntime,['buildPending','pump'],'Runtime'],[PaintingContext,['compose','finishLayer'],'Painting'],[SceneBuilder,['build','addRetained','pop'],'Scene'],[RenderRepaintBoundary,['refresh'],'Boundary'],[RenderObject,['commitTextInputGeometries','markNeedsPaint'],'Geometry'],[PipelineOwner,['flushLayout','flushSemantics'],'Pipeline'],[GraphiteRenderer,['submit','pollNotifications'],'Renderer'],[BuildOwner,['flushBuild','finalizeTree'],'Widgets'],[SemanticsBinding,['updateViewSemantics'],'Semantics'],[SemanticsNode,['updateWith','getSemanticsData'],'SemanticsNode'],[SemanticsOwner,['sendSemanticsUpdate'],'SemanticsOwner']] as const)for(const name of names)wrap(type,name,label+'.'+name);
if(diagnostic){
 wrap(RenderBoxes.RenderDecoratedBox,'paint','Decoration.paint');
 wrap(Paint,'update','Paint.update');wrap(Canvas,'drawRect','Canvas.drawRect');
 for(const [type,name,label]of [[Color,'lerp','Color.lerp'],[Rect,'fromLTWH','Rect.fromLTWH'],[CupertinoWidgets.CupertinoTheme,'of','Theme.of'],[TextStyle,'snapshotRunStyle','Style.snapshotRun']] as const){const original=(type as any)[name];(type as any)[name]=function(...args:any[]){return measured(label,()=>original.apply(this,args));};}
 for(const [type,name,label]of [[CupertinoWidgets.CupertinoThemeData,'resolveFrom','Theme.resolve'],[CupertinoWidgets.CupertinoTextThemeData,'resolveFrom','Theme.textResolve'],[CupertinoWidgets.CupertinoTextThemeData,'_createDefaultStyle','Theme.defaultStyle'],[TextStyle,'copyWith','Style.copyWith'],[TextStyle,'merge','Style.merge']] as const)wrap(type,name,label);
 const textTheme=Object.getOwnPropertyDescriptor(CupertinoWidgets.CupertinoThemeData.prototype,'textTheme')!;Object.defineProperty(CupertinoWidgets.CupertinoThemeData.prototype,'textTheme',{...textTheme,get:function(){return measured('Theme.textTheme',()=>textTheme.get!.call(this));}});
 wrap(PaintingContext,'_recordChildLayer','Painting.recordChild');
 const runLayout=(RenderObject.prototype as any).runLayout;(RenderObject.prototype as any).runLayout=function(constraints:any,options:any,perform:()=>void){return runLayout.call(this,constraints,options,()=>{const name='Layout.'+className(this);bootMark(name+' enter');try{return measuredClass(name,perform);}finally{bootMark(name+' exit');}});};
 const rebuild=Element.prototype.rebuild;Element.prototype.rebuild=function(...args:any[]){return measuredClass('Widget.'+className(this.widget),()=>rebuild.apply(this,args));};
 for(const [type,name,label]of [[TextPainter,'layout','Text.layout'],[Paragraph,'layoutWithReplacement','Text.paragraphLayout'],[ParagraphBuilder,'build','Text.buildParagraph']] as const){const original=(type.prototype as any)[name];(type.prototype as any)[name]=function(...args:any[]){count(label);return measured(label,()=>original.apply(this,args));};}
 for(const [type,name,label]of [[PictureRecorder,'endRecording','Picture.endRecording'],[FrameScheduler,'beginFrame','Scheduler.beginFrame'],[FrameScheduler,'endFrame','Scheduler.endFrame'],[FramePictureService,'resource','Picture.resource'],[ReactNativeInteraction,'publish','Host.publish']] as const)wrap(type,name,label);
 const pictureBackends=new WeakSet<object>(),pictureResource=FramePictureService.prototype.resource;FramePictureService.prototype.resource=function(...args:any[]){const backend=(this as any).backend;if(!pictureBackends.has(backend)){pictureBackends.add(backend);const compile=backend.compile;backend.compile=(...values:any[])=>measured('Picture.nativeCompile',()=>{const commands=values[0].frame.commands;sample('Picture.compiledCommands',commands.length);if(commands.every((command:any)=>['save','restore','transform','clip','clipRect','clipRRect','clipPath'].includes(command.op))){count('Picture.stateOnly');count('Picture.stateOnlyCommands',commands.length);}return compile.apply(backend,values);});}return pictureResource.apply(this,args);};
 // Counts only: a timer around every command would dominate the path being investigated.
 for(const [type,name,label]of [[Canvas,'record','Canvas.record'],[Canvas,'addCommands','Canvas.addCommands'],[Canvas,'_addCommandRange','Canvas.copyRange'],[Element,'rebuild','Element.rebuild'],[RenderObject,'markNeedsSemanticsUpdate','Render.markNeedsSemanticsUpdate']] as const){const original=type.prototype[name];type.prototype[name]=function(...args:any[]){count(label);if(name==='record')count('record.'+args[0].op);if(name==='_addCommandRange')count('Canvas.copiedCommands',args[2]-args[1]);return original.apply(this,args);};}
 const rootBuild=FrameworkRoot.prototype.build;FrameworkRoot.prototype.build=function(...args:any[]){const start=performance.now(),before=counts['Canvas.record']??0;if(lastBuild)sample('Root.startInterval',start-lastBuild);lastBuild=start;const pipeline=existingPipelineSemantics(this.pipeline) as any;count('Cache.present',(this as any).semanticsCache?1:0);for(const name of ['dirty','geometryDirty','deferredGeometry','offsetDirty'])if(pipeline?.[name]?.size)count('Cache.pending.'+name);for(const name of ['_dirtyNodes','_detachedNodes'])if(pipeline?.owner?.[name]?.size)count('Cache.pending.'+name);for(const node of pipeline?.deferredGeometry??[])count('Cache.deferred.'+node.constructor.name);const commands=rootBuild.apply(this,args);sample('Frame.finalCommands',commands.length);sample('Frame.recordCalls',(counts['Canvas.record']??0)-before);return commands;};
 const geometry=RenderObject.prototype.commitTextInputGeometries;RenderObject.prototype.commitTextInputGeometries=function(...args:any[]){const result=geometry.apply(this,args);count('Geometry.withInput',result.hasInputGeometry?1:0);return result;};
 const submit=GraphiteRenderer.prototype.submit;GraphiteRenderer.prototype.submit=function(frame:any,lease:any){const renderer=this as any;
  if(!observedRenderers.has(this)){observedRenderers.add(this);const accepted=new Map<number,number>();this.observe((event:any)=>{if(event.kind==='submitted')accepted.set(event.submission,performance.now());else if(event.kind==='retired'){const began=accepted.get(event.submission);if(began!==undefined){sample('Renderer.retirementObserved',performance.now()-began);accepted.delete(event.submission);}}});
   const context=renderer.context;renderer.context=()=>{const native=context();let wrapped=nativeContexts.get(native);if(!wrapped){wrapped={get width(){return native.width;},get height(){return native.height;}};for(const name of ['beginRecording','finishRecording','nelyxReserve','nelyxSubmit','nelyxNotifications','nelyxCancel','nelyxClose','nelyxReset','nelyxStats','dispose'])wrapped[name]=(...args:any[])=>measured('NativeJS.'+name,()=>native[name](...args));nativeContexts.set(native,wrapped);}return wrapped;};
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
if(trace||cpuOnly){let built=0;const build=FrameworkRoot.prototype.build;FrameworkRoot.prototype.build=function(...args:any[]){built++;return build.apply(this,args);};wrapFrameCallbacks(callback=>(...args)=>{const before=built,start=performance.now();try{return callback(...args);}finally{
 const elapsed=performance.now()-start;sample(built!==before?'Frame.cpu':'Idle.rafCpu',elapsed);
 // Keep every frame in the full distribution. Also expose the first build
 // after each actual route action, rather than hiding mount cost in a mean.
 if(built!==before&&phase==='cupertino-route'){if(routeFirstPending){sample('Frame.routeFirst.'+routeFirstPending,elapsed);routeFirstPending=null;}else sample('Frame.routeContinuation',elapsed);}
}});}
if(diagnostic){
 const labels=['Widgets.flushBuild','Pipeline.flushLayout','Painting.compose','Picture.nativeCompile','Semantics.capture'] as const;
 wrapFrameCallbacks(callback=>(...args)=>{
  const before=labels.map(label=>stats[label]?.length??0),builds=stats['Root.build']?.length??0,rebuilds=counts['Element.rebuild']??0,paragraphs=counts['Text.paragraphLayout']??0,start=performance.now();
  try{return callback(...args);}finally{
   const cpu=performance.now()-start;
   if(phase&&cpu>=40&&(stats['Root.build']?.length??0)>builds){const row:Record<string,number>={cpu,rebuilds:(counts['Element.rebuild']??0)-rebuilds,paragraphs:(counts['Text.paragraphLayout']??0)-paragraphs};for(let index=0;index<labels.length;index++)row[labels[index]!]=(stats[labels[index]!]??[]).slice(before[index]).reduce((sum,value)=>sum+value,0);longFrames.push(row);longFrames.sort((a,b)=>b.cpu!-a.cpu!);longFrames.length=Math.min(longFrames.length,12);}
  }
 });
}
const original=ViewRuntime.prototype.pump;ViewRuntime.prototype.pump=function(){view=this;if(semanticsInterval!==null){const controller=(this as any).controller;controller.options={...controller.options,semanticsUpdateInterval:semanticsInterval};}if(trace)wrap((this as any).controller.sourceSemanticsSnapshot.constructor,'capture','Semantics.capture');if(cpuOnly){const snapshot=(this as any).controller.sourceSemanticsSnapshot,capture=snapshot.capture;snapshot.capture=function(...args:any[]){count('Semantics.captures');return capture.apply(this,args);};}ViewRuntime.prototype.pump=original;return original.apply(this);};
if(wheelInput){const pointer=FrameworkRoot.prototype.pointer;FrameworkRoot.prototype.pointer=function(event){if(event.kind==='wheel'){count('Input.wheel');count('Input.wheelDistance',Math.abs(event.deltaY??0));}return trace?measured('Input.pointer',()=>pointer.call(this,event)):pointer.call(this,event);};}
let resizeRenderer:any,retiredResizeMetrics:any,settledResizes=0,retiredResizeFrames=0;
if(resize||wheelInput||mode==='gallery-regression'){const observed=new WeakSet<object>(),submit=GraphiteRenderer.prototype.submit;GraphiteRenderer.prototype.submit=function(frame,lease){resizeRenderer=this;if(resize&&!observed.has(this)){observed.add(this);this.observe(event=>{if(event.kind==='retired'&&event.result==='gpu-retired'){retiredResizeMetrics=event.token.metrics;retiredResizeFrames++;}});}return submit.call(this,frame,lease);};}
const delay=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
async function fitPerformanceViewport(){
 const before=view.currentMetrics,width=1000+Math.round(800*before.scale-before.physicalWidth),height=1000+Math.round(600*before.scale-before.physicalHeight);
 await host.resize(width,height);const deadline=performance.now()+5000;
 while(true){const metrics=view.currentMetrics;if(metrics.nativeSurfaceGeneration>before.nativeSurfaceGeneration&&Math.abs(metrics.logicalWidth-800)*metrics.scale<=.5&&Math.abs(metrics.logicalHeight-600)*metrics.scale<=.5)break;if(performance.now()>deadline)throw Error('Owned performance viewport did not reach 800x600 logical: '+JSON.stringify(metrics));await delay(16);}
 await delay(300);
}
async function probeNativeClock(){
 const api=(globalThis as any).NelyxWindowsHost;if(api?.frameClockVersion!==1)throw Error('Public Windows compositor clock1 missing');
 await new Promise<void>((resolve,reject)=>{let canceled:number;api.requestFrame((failure?:string)=>{if(failure){reject(Error(failure));return;}api.cancelFrame(canceled);const first=api.getStatus().frameTicks;api.requestFrame((failure?:string)=>{if(failure)reject(Error(failure));else if(api.getStatus().frameTicks<=first)reject(Error('A recursive native frame ran in the same tick'));else resolve();});});canceled=api.requestFrame(()=>reject(Error('A canceled native batch callback ran')));});
 host.report('frame-clock PASS '+JSON.stringify(api.getStatus()));
}
async function wheelAndDrain(x:number,y:number,delta:number){
 if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('Core produced a nonfinite wheel target: '+JSON.stringify({x,y}));
 const expected=(counts['Input.wheelDistance']??0)+120*Math.abs(delta)/120*48;
 if(wheelInputMode==='queued')await host.queuedWheel(x,y,delta,120,view.currentMetrics.nativeSurfaceGeneration);else await host.wheel(x,y,delta,120);
 const deadline=performance.now()+3000;while((counts['Input.wheelDistance']??0)<expected-.001){if(performance.now()>deadline)throw Error('Native wheel delivery did not drain: '+JSON.stringify({expected,...counts}));await delay(16);}
}
async function drainWheelRendering(){
 if(!resizeRenderer)throw Error('Wheel rendering has no observed renderer');const deadline=performance.now()+3000;
 const pending=()=>view.dirty||view.pending||view.task||resizeRenderer.hasPendingSubmissions;
 for(;;){while(pending()){if(performance.now()>deadline)throw Error('Final wheel frame did not drain');await delay(1);}await host.windowSnapshot();if(!pending())return;}
}
async function resizeSettled(previousGeneration:number){const deadline=performance.now()+3000;while(performance.now()<deadline){const metrics=view.currentMetrics,native=resizeRenderer?.context();if(native&&metrics.nativeSurfaceGeneration>previousGeneration&&Math.round(native.width*metrics.scale)===metrics.physicalWidth&&Math.round(native.height*metrics.scale)===metrics.physicalHeight&&retiredResizeMetrics?.nativeSurfaceGeneration===metrics.nativeSurfaceGeneration&&retiredResizeMetrics.viewportGeneration===metrics.viewportGeneration){settledResizes++;host.report('resize-settled '+metrics.physicalWidth+'x'+metrics.physicalHeight);return;}await delay(16);}throw Error('Resize did not retire a frame matching the current native backing and viewport');}
async function dragResize(){const generation=view.currentMetrics.nativeSurfaceGeneration;await host.dragResize();await resizeSettled(generation);}
async function resizeWindow(){for(const [width,height]of [[1500,1080],[680,760],[2400,1280],[420,540],[1320,900],[1000,1000]]){host.report('resize '+width+'x'+height);const generation=view.currentMetrics.nativeSurfaceGeneration;await host.resize(width,height);await delay(90);await resizeSettled(generation);}}
function states(){const all:any[]=[];function visit(element:any){if(element.state)all.push({widget:element.widget,state:element.state});for(const child of element.children)visit(child);}visit(view.controller.root);return all;}
function material(){return states().find(entry=>entry.widget instanceof ComponentsGallery)!.state;}
function cupertino(){return states().find(({state})=>'values'in state&&'scroll'in state&&typeof state.select==='function')!.state;}
let routeFirstPending:'push'|'pop'|null=null;
function tap(id:string){const node=view.controller.nodes.find((node:any)=>node.id===id);if(!node)throw Error('Missing '+id+' visible='+view.controller.nodes.map((node:any)=>node.id).join(','));if(phase==='cupertino-route'){if(id==='cupertino-open-route')routeFirstPending='push';else if(id==='cupertino-route-return')routeFirstPending='pop';}const perform=()=>{if(node.actions?.activate)node.actions.activate();else node.activate?.();};if(diagnostic)measured('Action.'+id,perform);else perform();}
async function waitForAction(id:string){const started=performance.now(),deadline=started+3000;while(!view.controller.nodes.some((node:any)=>node.id===id&&node.enabled&&(node.actions?.activate||node.activate))){if(performance.now()>deadline)throw Error('Route action did not return within its deadline: '+id+' visible='+view.controller.nodes.map((node:any)=>node.id).join(','));await delay(16);}const elapsed=performance.now()-started;if(elapsed>40)host.report('route-ready-wait '+JSON.stringify({id,elapsed}));}
function gc(){return (globalThis as any).HermesInternal?.getInstrumentedStats?.()??{};}
function treeSize(){const size={elements:0,renderObjects:0,hostNodes:view.controller.nodes.length};for(const [root,key]of [[view.controller.root,'elements'],[view.controller.pipeline.root,'renderObjects']] as const){const pending=[root];while(pending.length){const node=pending.pop();if(!node)continue;size[key]++;pending.push(...node.children);}}return size;}
function start(name:string){stats={};exclusive={};counts={};classOwners={};longFrames=[];lastBuild=0;tree=diagnostic?treeSize():{};gcBefore=gc();phase=name;host.begin(name);}
function summarize(values:number[]){values.sort((a,b)=>a-b);return {n:values.length,sum:values.reduce((a,b)=>a+b,0),p50:values[Math.floor(values.length*.5)],p95:values[Math.floor(values.length*.95)],max:values.at(-1)};}
function end(){const result:any={phase,engine:(globalThis as any).__nelyxJavaScriptEngine??((globalThis as any).HermesInternal?'hermes':'unknown'),mode,trace,diagnostic,tree,wheelPacing:wheelInput?(wheelInputMode==='queued'?'owned-queue-render-drain':'continuous-render-drain'):'animated',semanticsUpdateInterval:(view.controller as any).options.semanticsUpdateInterval??0,...(cpuOnly?{transportCaptures:counts['Semantics.captures']??0}:{})};for(const [name,values]of Object.entries(stats))result[name]=summarize(values);if(diagnostic){result.longFrames=longFrames;result.exclusive=Object.fromEntries(Object.entries(exclusive).map(([name,values])=>[name,summarize(values)]));result.counts=counts;result.classOwners=Object.fromEntries(Object.entries(classOwners).sort((a,b)=>b[1].selfMs-a[1].selfMs).slice(0,16));}const after=gc();result.hermesDelta=Object.fromEntries(['js_numGCs','js_gcCPUTime','js_gcTime','js_totalAllocatedBytes'].filter(key=>typeof after[key]==='number'&&typeof gcBefore[key]==='number').map(key=>[key,(after[key] as number)-(gcBefore[key] as number)]));const memory=(value:Record<string,unknown>)=>Object.fromEntries(Object.entries(value).filter(([key,value])=>/allocated|heap|malloc/i.test(key)&&typeof value==='number').slice(0,20));result.hermesMemoryBefore=memory(gcBefore);result.hermesMemoryAfter=memory(after);host.report(JSON.stringify(result));phase='';host.end();}
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
setTimeout(()=>{if(mode==='interactive'){void host.windowMode('restore').then(()=>host.report('interactive-ready'));return;}void(async()=>{try{
 // The native test process starts with windowsHide. Explicitly show its own
 // interactive window before expecting a Core frame or injecting OS input.
 await host.windowMode('restore');
 const readyDeadline=performance.now()+8000;while(!view){if(performance.now()>readyDeadline)throw Error('Core View did not open: '+JSON.stringify(await host.windowSnapshot()));await delay(20);}host.report('window-initial '+JSON.stringify(await host.windowSnapshot()));
 if(!resize&&mode!=='editing-resize'){
  if(viewport==='fixed')await fitPerformanceViewport();
  else if(viewport==='maximized'){const generation=view.currentMetrics.nativeSurfaceGeneration;await host.windowMode('maximize');const deadline=performance.now()+5000;while(view.currentMetrics.nativeSurfaceGeneration<=generation){if(performance.now()>deadline)throw Error('Maximized viewport did not update');await delay(16);}await delay(300);}
 }
 host.report('window-selected '+JSON.stringify(await host.windowSnapshot()));host.report('view-metrics '+JSON.stringify(view.currentMetrics));
 if(wheelInputMode==='os'&&(await host.windowSnapshot()).foreground===false)throw Error('Native input workload requires its own foreground window');
 await probeNativeClock();
 if(mode==='editing-resize'){await editingResize();return;}
 if(mode==='gallery-regression'){await galleryRegression();return;}
 if(resize){if(!host.queueFailureStart())throw Error('UI failure probe could not start');const deadline=performance.now()+1500;while(!host.queueFailureReady()&&performance.now()<deadline)await delay(10);if(!host.queueFailureReady()||!host.queueFailureFinish())throw Error('UI failure lost its original error or released unconfirmed work');}
 if(resize&&resizeCase==='initial'){await dragResize();await resizeWindow();}
 if(trace)for(const [target,name,label]of [[view.controller.root,'syncRenderTree','Widgets.syncRenderTree'],[view.controller.semantics,'update','Semantics.hostUpdate']]){const original=target[name];target[name]=function(...args:any[]){return measured(label,()=>{if(mode==='host-semantics-static'&&label==='Semantics.hostUpdate')return;return original.apply(this,args);});};}
 host.report('select communication');bootTracing=diagnostic;bootMark('select enter');material().select('communication');bootMark('select exit');await delay(500);bootMark('jump max enter');material().firstScroll.jumpTo(material().firstScroll.position.maxScrollExtent);bootMark('jump max exit');await delay(200);bootMark('startup complete');bootTracing=false;host.report('start progress');tap('toggle-progress');await delay(500);
 start('material-progress');if(resize&&resizeCase!=='initial'){await dragResize();await resizeWindow();}await delay(2000);end();tap('toggle-progress');await delay(300);
 await delay(300);const scroll=material().firstScroll;scroll.jumpTo(0);await delay(200);
 if(wheelInput){material().select('all');await delay(400);scroll.jumpTo(0);await delay(200);}
 if(scroll.position.maxScrollExtent<=0)throw Error('Scroll scenario has no content overflow');
 start('material-scroll');if(resize)await resizeWindow();for(let i=0;i<2;i++){
  if(wheelInput){const render=scroll.position.context.notificationContext.findRenderObject(),point=transform(render.getTransformTo(),{x:render.size.width*.5,y:render.size.height*.5});
   await wheelAndDrain(point.x,point.y,-6);const moved=scroll.position.pixels;if(moved<=0)throw Error('Native wheel route did not scroll');
   await wheelAndDrain(point.x,point.y,6);if(scroll.position.pixels>=moved)throw Error('Native wheel direction reversal was lost');
  }else{await scroll.animateTo(scroll.position.maxScrollExtent,{duration:800,curve:Curves.linear});await scroll.animateTo(0,{duration:800,curve:Curves.linear});}
 }if(wheelInput){if(Math.abs((counts['Input.wheelDistance']??0)-480*6/120*48)>.001)throw Error('Native wheel distance was lost: '+JSON.stringify(counts));await drainWheelRendering();host.report('wheel-input PASS events='+counts['Input.wheel']+' distance='+counts['Input.wheelDistance']+' pacing='+(wheelInputMode==='queued'?'owned-queue-render-drain':'continuous-render-drain'));}end();
 tap('show-cupertino');await delay(1200);tap('cupertino-toggle-activity');await delay(500);
 start('cupertino-activity');if(resize)await resizeWindow();await delay(2000);end();tap('cupertino-toggle-activity');await delay(200);
 cupertino().select('navigation');await delay(700);await waitForAction('cupertino-open-route');start('cupertino-route');for(let i=0;i<3;i++){tap('cupertino-open-route');await delay(550);await waitForAction('cupertino-route-return');tap('cupertino-route-return');await delay(550);await waitForAction('cupertino-open-route');}end();if(resize){host.report('resize-settled count='+settledResizes);await host.resize(930,870);}
 }catch(error){host.report('ERROR '+String(error)+' detail='+JSON.stringify(error)+' native='+JSON.stringify((globalThis as any).NelyxWindowsHost?.getStatus?.()));}finally{fixtureWheel?.remove();host.complete();}})();},4000);
