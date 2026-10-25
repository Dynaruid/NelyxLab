// SPDX-License-Identifier: BSD-3-Clause
// Copied into an owned temporary directory in the actual app before bundling.
// No descendant lifecycle wrappers: those change native stack requirements.
import {ViewRuntime} from '@nelyx/core/hosting/runtime';
import {FramePictureService} from '@nelyx/core/hosting/pictures';
import {FoundationBuildMode} from '@nelyx/core/foundation/constants';
import {FrameworkRoot} from '@nelyx/core/framework/widgets/root';
import {BuildOwner} from '@nelyx/core/framework/widgets/framework';
import {SliverMultiBoxAdaptorElement} from '@nelyx/core/framework/widgets/sliver';
import {RenderSliverMultiBoxAdaptor} from '@nelyx/core/framework/rendering/sliver-multi-box-adaptor';
import {PipelineOwner} from '@nelyx/core/framework/rendering/object';
import {PaintingContext} from '@nelyx/core/framework/painting/context';
import {GraphiteRenderer} from '@nelyx/skia-rn/renderer';
import {ReactNativeTextLayoutService} from '@nelyx/skia-rn/text';
import {Curves} from '@nelyx/core/framework/animation/curves';
import {transform} from '@nelyx/core/ui/geometry';
import {FlutterError} from '@nelyx/core/foundation/flutter-error';
import {distribution,analyseNativeInputWindow,analyseNativeFrameTrace,analyseNativeFrameTurns,analyseNativeCatalogCoverage,readHermesGCStats,readHermesSamplingProfile} from './native-frame-metrics.js';

export function installNativeScrollProbe(sample:any,configuration:{scope:'cpu'|'gc'|'diagnostic'|'sampling';catalog:boolean;pacing:'programmatic'|'os';resourceCycles?:number}){
  const api=(globalThis as any).NelyxNativeHost;
  if(!['default','maximized'].includes(api.probeViewport))throw Error('Native probe viewport is missing or invalid');
  const options={...configuration,viewport:api.probeViewport as 'default'|'maximized'};
  for(const key of ['diagnosticWindow','diagnosticState','takeFrameTrace','heapInfo'])if(typeof api[key]!=='function')throw Error('Native diagnostic method missing: '+key);
  if(options.pacing==='programmatic'&&typeof api.diagnosticParkCursor!=='function')throw Error('Native diagnostic cursor parking is missing');
  let view:any,renderer:any,built=0,active=false,phaseName='',samples:Record<string,number[]>={},frameRows:any[]=[],errors:string[]=[],counts:Record<string,number>={},totals:Record<string,number>={},measuredScroll:any,changedCoreSequences:number[]=[];
  const now=()=>api.now(),delay=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
  let reportSequence=0;
  const report=(value:unknown)=>{const text=JSON.stringify(value),total=Math.ceil(text.length/1024),id=++reportSequence;if(total>2048)throw Error('Native probe report exceeds its transport budget');for(let index=0;index<total;index++)api.log('NELYX_NATIVE_PROBE_CHUNK '+JSON.stringify({id,index,total,text:text.slice(index*1024,(index+1)*1024)}));};
  const check=(value:unknown,message:string)=>{if(!value)throw Error(message);};
  const sampleTime=(name:string,value:number)=>{if(!active)return;const values=samples[name]??=[];check(values.length<16384,'CPU sample overflow');values.push(value);totals[name]=(totals[name]??0)+value;};
  const request=api.requestFrame,build=FrameworkRoot.prototype.build,pump=ViewRuntime.prototype.pump,submit=GraphiteRenderer.prototype.submit;
  let observeCatalog:((sequence:number)=>void)|undefined;
  const previousError=FlutterError.onError;
  FlutterError.onError=details=>{if(errors.length<4)errors.push(String(details.exception));previousError?.(details);};
  FrameworkRoot.prototype.build=function(...args:Parameters<typeof build>){built++;const result=build.apply(this,args);if(active)observeCatalog?.(args[0].token.sequence);return result;};
  ViewRuntime.prototype.pump=function(){view=this;return pump.call(this);};
  const dispatch=ViewRuntime.prototype.dispatchPointer;
  if(options.pacing==='os')ViewRuntime.prototype.dispatchPointer=function(event){const before=(this as any).inputSequence,offset=measuredScroll?.offset;const result=dispatch.call(this,event);if(active&&measuredScroll&&event.kind==='wheel'&&(this as any).inputSequence>before&&measuredScroll.offset!==offset)changedCoreSequences.push((this as any).inputSequence);return result;};
  GraphiteRenderer.prototype.submit=function(...args:Parameters<typeof submit>){renderer=this;return submit.apply(this,args);};
  api.requestFrame=(callback:any)=>request.call(api,(...args:any[])=>{
    const before=built,began=now(),spans=active&&options.scope==='diagnostic'?{...totals}:null,mounts=counts.mount??0,unmounts=counts.unmount??0;try{return callback(...args);}finally{
      const elapsed=now()-began;sampleTime(built===before?'Idle.callbackWall':'Frame.callbackWall',elapsed);
      if(active&&built!==before){check(frameRows.length<16384,'Frame sample overflow');frameRows.push({begin:began,end:now(),wall:elapsed,sequence:view?.sequence,input:view?.inputSequence,mounts:(counts.mount??0)-mounts,unmounts:(counts.unmount??0)-unmounts,...(spans?{inclusiveSpans:Object.fromEntries(Object.entries(totals).filter(([key])=>!key.includes('callbackWall')).map(([key,value])=>[key,value-(spans[key]??0)]))}:{})});}
    }
  });
  const restoreSpans:Array<()=>void>=[];
  if(options.scope==='diagnostic'){
    // These spans are inclusive. They are never added together or mixed into a
    // minimal CPU qualification; native recording lies inside Renderer.submit.
    for(const [type,name,label]of [[FrameworkRoot,'build','Root.build'],[FrameworkRoot,'recordPaint','Paint.record'],[ViewRuntime,'buildPending','Runtime.buildPending'],[BuildOwner,'flushBuild','Widgets.build'],[BuildOwner,'buildScope','Widgets.scope'],[BuildOwner,'finalizeTree','Widgets.retire'],[SliverMultiBoxAdaptorElement,'createChild','Sliver.createChild'],[SliverMultiBoxAdaptorElement,'finishQueuedChildren','Sliver.finishQueued'],[RenderSliverMultiBoxAdaptor,'insertAndLayoutChild','Item.trailingBuildLayout'],[RenderSliverMultiBoxAdaptor,'insertAndLayoutLeadingChild','Item.leadingBuildLayout'],[PipelineOwner,'flushLayout','Layout'],[PipelineOwner,'flushSemantics','Semantics'],[PaintingContext,'compose','Paint.compose'],[GraphiteRenderer,'submit','Renderer.submit'],[ReactNativeTextLayoutService,'layout','Text.layout']] as const){
      const prototype=type.prototype as any,original=prototype[name];check(typeof original==='function','Missing diagnostic span '+label);
      prototype[name]=function(...args:any[]){if(!active)return original.apply(this,args);const began=now();try{return original.apply(this,args);}finally{sampleTime(label,now()-began);}};
      restoreSpans.push(()=>{prototype[name]=original;});
    }
    for(const name of ['register','unregister'] as const){const original=BuildOwner.prototype[name];BuildOwner.prototype[name]=function(...args:Parameters<typeof original>){const result=original.apply(this,args);if(active){const key=name==='register'?'mount':'unmount';counts[key]=(counts[key]??0)+1;}return result;};restoreSpans.push(()=>{BuildOwner.prototype[name]=original;});}
  }
  const entries=()=>{const result:any[]=[],pending=[view.controller.root];while(pending.length){const element=pending.pop();if(!element)continue;result.push({element,widget:element.widget,state:element.state});for(const child of element.children)pending.push(child);}return result;};
  const stateOf=(type:any)=>entries().find(entry=>entry.widget instanceof type)?.state;
  const cupertino=()=>entries().find(({state})=>state&&'values'in state&&'scroll'in state&&typeof state.select==='function')?.state;
  const tree=()=>{const result={elements:0,renderObjects:0,hostNodes:view.controller.nodes.length};for(const [root,key]of [[view.controller.root,'elements'],[view.controller.pipeline.root,'renderObjects']] as const){const pending=[root];while(pending.length){const node=pending.pop();if(!node)continue;result[key]++;for(const child of node.children)pending.push(child);}}return result;};
  async function until(test:()=>boolean,message:string,ms=10000){const deadline=now()+ms;while(!test()){check(!errors.length,'Framework error: '+errors.join('; '));check(now()<deadline,message);await delay(16);}}
  async function settled(){
    const pending=()=>!view||!renderer||view.status!=='open'||view.dirty||view.pending||view.task||renderer.hasPendingSubmissions;
    const deadline=now()+10000;
    for(;;){while(pending()){check(!errors.length,'Framework error: '+errors.join('; '));check(now()<deadline,'Native render did not settle: '+JSON.stringify({phaseName,view:view?.status,dirty:view?.dirty,pending:!!view?.pending,task:!!view?.task,native:renderer?.context().nelyxStats()}));await delay(16);}await delay(32);if(!pending())return;}
  }
  async function foreground(){
    const ready=async()=>{if(options.pacing==='programmatic'){api.diagnosticParkCursor();await delay(100);await settled();}};
    for(let attempt=0;attempt<3;attempt++){api.diagnosticWindow(options.viewport==='maximized'?'maximize':'restore');await delay(100);await settled();if(api.diagnosticState().foreground){await ready();return;}}
    // Windows can refuse activation from a background launcher. Allow the
    // owned window to be activated before measurement; no input is injected
    // and the existing per-phase foreground/visibility guards stay required.
    api.log('NELYX_NATIVE_PROBE_FOREGROUND_WAIT');
    for(let attempt=0;attempt<20;attempt++){await delay(500);if(api.diagnosticState().foreground){await ready();return;}}
    throw Error('Owned native window could not acquire foreground');
  }
  function tap(id:string){const node=view.controller.nodes.find((node:any)=>node.id===id);check(node&&node.enabled!==false&&(node.actions?.activate||node.activate),'Missing action '+id);if(node.actions?.activate)node.actions.activate();else node.activate();}
  const heap=()=>{const value=api.heapInfo();return {heap:value.heap,gcStatsEnabled:value.gcStatsEnabled,...(value.gc?{gc:readHermesGCStats(value.gc)}:{})};};
  const pictureStats=()=>{const pictures=view?.controller?.context.pictures;return pictures instanceof FramePictureService?pictures.debugStats:null;};
  async function phase(name:string,work:()=>Promise<unknown>,extra:()=>unknown=()=>({})){
    await foreground();await settled();api.takeFrameTrace();
    const baseline=view.inputSequence,beforeState=api.diagnosticState(),beforeHeap=heap(),beforeTree=tree(),beforePictures=pictureStats(),metrics=view.currentMetrics;
    if(options.scope==='sampling')api.cpuProfile('begin');samples={};frameRows=[];counts={};totals={};changedCoreSequences=[];phaseName=name;active=true;const begin=now();
    try{
      const workload:any=await work();await settled();const end=now();active=false;
      const profile=options.scope==='sampling'?readHermesSamplingProfile(api.cpuProfile('end')):undefined,afterState=api.diagnosticState(),trace=api.takeFrameTrace();
      const inputWindow=analyseNativeInputWindow(beforeState,afterState,{pacing:options.pacing});
      check(view.currentMetrics.viewportGeneration===metrics.viewportGeneration,'Viewport changed during '+name);
      const receipts=analyseNativeFrameTrace(trace,{begin,end,coreBaseline:baseline,...(options.pacing==='os'?{changedCoreSequences}:{})}),frameTurns=analyseNativeFrameTurns(trace,frameRows,{begin,end});
      check(receipts.receiptIntegrity,'Native input/surface receipt was incomplete');
      if(options.pacing==='os'){const sender=workload.sender=api.nativeWheelState();check(changedCoreSequences.length>0&&sender.foreign===0&&sender.error===''&&sender.done&&sender.emitted===workload.count&&sender.received>0&&sender.received<=sender.emitted&&sender.sentRaw===sender.receivedRaw&&sender.sentAbsoluteRaw===sender.receivedAbsoluteRaw,'OS wheel did not conserve its emitted/delivered input');check(Math.abs(receipts.input.receivedWheelY+sender.receivedRaw*.4)<.001&&Math.abs(receipts.input.receivedAbsoluteWheelY-sender.receivedAbsoluteRaw*.4)<.001,'OS wheel native/Core distance differs');}
      else check(receipts.input.received===0,'Programmatic phase received desktop pointer input');
      if(workload.coverage){workload.coverage={...workload.coverage,...analyseNativeCatalogCoverage(trace,workload.visibilityFrames,{expectedIds:workload.coverage.expectedIds,requireAll:!name.endsWith('-fast'),begin,end})};delete workload.visibilityFrames;}
      check((samples['Frame.callbackWall']?.length??0)>0&&receipts.surface.n>0,'No built frame reached the native surface during '+name);
      const afterHeap=heap(),heapDelta=Object.fromEntries(['hermes_totalAllocatedBytes','hermes_numCollections','hermes_yg_gcTime','hermes_full_gcTime'].map(key=>[key,afterHeap.heap[key]-beforeHeap.heap[key]]));
      report({type:'phase',name,mode:api.mode,buildMode:FoundationBuildMode.mode,semanticsUpdateInterval:view.controller.options.semanticsUpdateInterval??0,qualification:'diagnostic-only',scope:options.scope,pacing:options.pacing,cpuScope:'owned-frame-callback-wall; frameTurns also includes following checkpoint; pointer dispatch is separate',inputWindow,frameTurns,spans:options.scope==='diagnostic'?'inclusive':'disabled',elapsedMs:end-begin,metrics,beforeTree,afterTree:tree(),beforeHeap,afterHeap,heapDelta,pictures:{before:beforePictures,after:pictureStats()},...(profile?{profile,heapScope:'includes sampling trace collection outside the timed phase'}:{}),counts,samples:Object.fromEntries(Object.entries(samples).map(([key,value])=>[key,distribution(value)])),...(options.scope==='diagnostic'?{longestFrames:[...frameRows].sort((a,b)=>b.wall-a.wall).slice(0,6)}:{}),workload,evidence:extra(),receipts,performanceAccepted:false,physicalInputAccepted:'notVerified',displayed:'unobserved'});
    }finally{active=false;phaseName='';if(options.pacing==='os')api.finishNativeWheel();}
  }
  async function nativeWheel(name:string,scroll:any,delta:number,count=240,interval=16,sweep=false,coverage?:{ids:readonly string[];keys:Map<string,unknown>}){
    measuredScroll=scroll;
    try{await phase(name,async()=>{
      const render=scroll.position.context.notificationContext.findRenderObject(),point=transform(render.getTransformTo(),{x:render.size.width*.5,y:render.size.height*.5}),initial=scroll.offset,maximumInjected=coverage?8192:count,seen=new Set<string>(),visibilityFrames=new Map<number,{sequence:number;ids:string[]}>();let reachedEdge=false,stopped=false;
      if(coverage){
        // Walk only the owning adaptor's active row wrappers. Descendant
        // lifecycle wrappers change Static Hermes stack requirements, and a
        // whole app-tree walk on every frame would distort the CPU workload.
        const adaptors:any[]=[],pending=[scroll.position.context.notificationContext];while(pending.length){const element=pending.pop();if(element instanceof SliverMultiBoxAdaptorElement){adaptors.push(element);continue;}for(const child of element.children)pending.push(child);}check(adaptors.length===1,'Expected one actual gallery row adaptor');const adaptor=adaptors[0],idsByKey=new Map(coverage.ids.map(id=>[coverage.keys.get(id),id]));
        observeCatalog=sequence=>{
          check(adaptor.active&&visibilityFrames.size<16384,'Gallery adaptor retired or visibility frame budget exceeded');const ids:string[]=[],pending=[...adaptor.children];
          while(pending.length){const element=pending.pop();if(!element.active)continue;if(element.widget instanceof sample.GallerySection){const id=idsByKey.get(element.widget.key),child=element.findRenderObject();if(id===undefined||!child?.size)continue;let descendant=child,painted=true;while(descendant!==render){const parent=descendant.parent;if(!parent||!parent.paintsChild(descendant)){painted=false;break;}descendant=parent;}if(!painted)continue;const origin=transform(child.getTransformTo(render),{x:0,y:0});if(origin.y<scroll.position.viewportDimension&&origin.y+child.size.height>0&&origin.x<render.size.width&&origin.x+child.size.width>0){ids.push(id);seen.add(id);}continue;}for(const child of element.children)pending.push(child);}
          visibilityFrames.set(sequence,{sequence,ids});reachedEdge=delta<0?scroll.offset>=scroll.position.maxScrollExtent-.01:scroll.offset<=.01;
          if(reachedEdge&&(name.endsWith('-fast')||seen.size===coverage.ids.length)&&!stopped){api.stopNativeWheel();stopped=true;}
        };
      }
      api.startNativeWheel({x:point.x,y:point.y,delta,count:maximumInjected,interval,sweep});let sender:any;
      await until(()=>{sender=api.nativeWheelState();check(!sender.error&&sender.foreign===0,'Native wheel input failed or received desktop interference: '+JSON.stringify(sender));return sender.done&&sender.sentRaw===sender.receivedRaw&&sender.sentAbsoluteRaw===sender.receivedAbsoluteRaw;},'Native wheel was not completely delivered',180000);await settled();
      if(coverage)check(stopped&&reachedEdge&&sender.emitted>0&&sender.emitted<=maximumInjected&&(name.endsWith('-fast')||seen.size===coverage.ids.length),'Continuous full catalog traversal did not reach its edge/sections');
      return {kind:'os-wheel',injection:coverage?'until-edge':'fixed',initial,final:scroll.offset,delta,count:coverage?sender.emitted:count,maximumInjected,interval,sweep,sender,...(coverage?{coverage:{expectedIds:[...coverage.ids],direction:delta<0?'forward':'reverse',reachedEdge,stopped},visibilityFrames:[...visibilityFrames.values()]}:{})};
    });}finally{observeCatalog=undefined;measuredScroll=undefined;}
  }
  const visible=(key:unknown,scroll:any)=>{
    const element=entries().find(entry=>entry.widget instanceof sample.GallerySection&&entry.widget.key===key)?.element,child=element?.findRenderObject(),viewport=scroll.position.context.notificationContext.findRenderObject();
    if(!child||!viewport||!child.size)return false;let ancestor=child;while(ancestor&&ancestor!==viewport)ancestor=ancestor.parent;if(!ancestor)return false;
    const origin=transform(child.getTransformTo(viewport),{x:0,y:0});return origin.y<scroll.position.viewportDimension&&origin.y+child.size.height>0;
  };
  async function catalog(name:string,state:any,controllers:any[],extentOwners:any[],expected:readonly {id:string}[]){
    state.setState(()=>{if(name==='material')state.includePlanned=true;else state.values.includePlanned=true;});state.select('all');await settled();
    const owners=controllers.map((scroll,column)=>({scroll,extents:extentOwners[column],column})).filter(({scroll})=>scroll.hasClients);
    const actual=owners.flatMap(({extents})=>extents.ids).sort(),all=expected.map(({id})=>id).sort();check(JSON.stringify(actual)===JSON.stringify(all),'Full catalog membership differs: '+name);
    for(const {scroll,extents,column}of owners){
      if(options.pacing==='os'){const dimension=scroll.position.viewportDimension,delta=-Math.min(120,Math.ceil(dimension*16/1000/.4)),fastDelta=-Math.min(120,Math.ceil(dimension*3*4/1000/.4)),coverage={ids:[...extents.ids] as string[],keys:state.sectionKeys};await nativeWheel(name+'-'+column+'-cold',scroll,delta,240,16,false,coverage);await nativeWheel(name+'-'+column+'-revisit',scroll,-delta,240,16,false,coverage);await nativeWheel(name+'-'+column+'-fast',scroll,fastDelta,240,4,false,coverage);continue;}
      const ids=[...extents.ids],seen=new Set<string>();
      for(const reverse of [false,true])await phase(name+'-'+column+(reverse?'-revisit':'-cold'),async()=>{
        for(const index of ids.map((_:string,index:number)=>index).sort((a:number,b:number)=>reverse?b-a:a-b)){
          extents.current.requestItem(index);await settled();check(visible(state.sectionKeys.get(ids[index]),scroll),'Requested section was not exposed: '+name+'/'+ids[index]);seen.add(ids[index]);
        }
        check(seen.size===ids.length,'Catalog traversal incomplete');return {kind:'section-seek',continuousScroll:false,direction:reverse?'reverse':'forward',expectedIds:ids,seenIds:[...seen],offset:scroll.offset};
      });
      await phase(name+'-'+column+'-fast',async()=>{const initial=scroll.offset,target=Math.min(scroll.position.maxScrollExtent,initial+32*scroll.position.viewportDimension);await scroll.animateTo(target,{duration:800,curve:Curves.linear});check(Math.abs(scroll.offset-target)<.05,'Fast gallery animation stopped early');return {initial,final:scroll.offset,target,continuousScroll:true,fullCatalogExposure:false};});
    }
  }
  async function run(){
    await until(()=>!!view&&!!renderer&&view.status==='open','Native application did not start',30000);await settled();await foreground();
    if(options.scope==='sampling'){
      const pictures=view.controller.context.pictures;check(pictures instanceof FramePictureService,'Native picture diagnostics require the actual View picture owner');
      const backend=pictures.backend,compile=backend.compile;check(typeof compile==='function','Native picture compiler is missing');
      backend.compile=function(...args:any[]){if(active)counts['NativePicture.compile']=(counts['NativePicture.compile']??0)+1;return compile.apply(this,args);};restoreSpans.push(()=>{backend.compile=compile;});
    }
    report({type:'begin',schema:1,mode:api.mode,buildMode:FoundationBuildMode.mode,semanticsUpdateInterval:view.controller.options.semanticsUpdateInterval??0,options,qualification:'diagnostic-only',accessibilityEnabled:!!view.controller.pipeline.semanticsOwner,performanceAccepted:false});
    check(view.controller.pipeline.semanticsOwner,'Accessibility must remain enabled');
    tap('show-list-view');await settled();const list=stateOf(sample.ListViewPage);check(list?.scroll?.hasClients,'Product ListView controller missing');const scroll=list.scroll,dimension=scroll.position.viewportDimension;
    scroll.jumpTo(60);await settled();
    if(options.pacing==='os'){
      const retained=new Set(entries().filter(({widget})=>/^list-view-item-\d+$/.test(widget.id??'')).map(({element})=>element));await nativeWheel('list-retained',scroll,-1,48,16,true);const after=entries().filter(({widget})=>/^list-view-item-\d+$/.test(widget.id??'')).map(({element})=>element);check(retained.size>0&&after.length===retained.size&&after.every(element=>retained.has(element)),'OS retained row element set changed');
      const delta=-Math.ceil(dimension*5.5/(240*.4));await nativeWheel('list-cold',scroll,delta);await nativeWheel('list-revisit',scroll,-delta);await nativeWheel('list-fast',scroll,delta,240,4);
    }else{
    await phase('list-retained',async()=>{const before=new Set(entries().filter(({widget})=>/^list-view-item-\d+$/.test(widget.id??'')).map(({element})=>element));await scroll.animateTo(64,{duration:450,curve:Curves.linear});await scroll.animateTo(60,{duration:450,curve:Curves.linear});const after=entries().filter(({widget})=>/^list-view-item-\d+$/.test(widget.id??'')).map(({element})=>element);check(before.size>0&&after.length===before.size&&after.every(element=>before.has(element)),'Retained row element set changed');return {initial:60,final:scroll.offset,distance:8,retainedRows:before.size};});
    scroll.jumpTo(0);await settled();const target=Math.min(scroll.position.maxScrollExtent,dimension*5.5);
    await phase('list-cold',async()=>{await scroll.animateTo(target,{duration:1200,curve:Curves.linear});check(Math.abs(scroll.offset-target)<.05,'Cold ListView animation stopped early');return {initial:0,final:scroll.offset,viewport:dimension,exposedViewports:target/dimension,rowExtent:80,itemCount:1000};});
    await phase('list-revisit',async()=>{await scroll.animateTo(0,{duration:1200,curve:Curves.linear});check(Math.abs(scroll.offset)<.05,'Reverse ListView animation stopped early');return {initial:target,final:scroll.offset};});
    await phase('list-fast',async()=>{const target=Math.min(scroll.position.maxScrollExtent,dimension*32);await scroll.animateTo(target,{duration:800,curve:Curves.linear});check(Math.abs(scroll.offset-target)<.05,'Fast ListView animation stopped early');return {initial:0,final:scroll.offset,target};});
    }
    tap('list-view-last');await settled();check(view.controller.nodes.some((node:any)=>node.id==='list-view-item-999'),'Last product row did not materialize');tap('list-view-first');await settled();check(Math.abs(scroll.offset)<.05,'First row boundary did not return');tap('list-view-back');await settled();
    if(options.resourceCycles){
      const snapshot=(cycle:number,evidence:object={})=>{
        check(!stateOf(sample.ListViewPage)&&view.controller.nodes.some((node:any)=>node.id==='show-list-view'),'ListView did not return to the real gallery');
        report({type:'resource-cycle',cycle,scope:'core-resource-and-native-frame-owners',qualification:'diagnostic-only',returnedToGallery:true,tree:tree(),accounted:view.controller.context.resources.accountedTotals,pictures:pictureStats(),native:renderer.context().nelyxStats(),heap:heap().heap,...evidence,performanceAccepted:false,physicalInputAccepted:'notVerified',displayed:'unobserved'});
      };
      await delay(100);await settled();snapshot(0);
      for(let cycle=1;cycle<=options.resourceCycles;cycle++){
        await foreground();await settled();api.takeFrameTrace();const before=api.diagnosticState(),begin=now(),coreBaseline=view.inputSequence;
        tap('show-list-view');await settled();const current=stateOf(sample.ListViewPage);check(current?.scroll?.hasClients,'Repeated product ListView is missing');
        const position=current.scroll,target=Math.min(position.position.maxScrollExtent,position.position.viewportDimension*8);
        await position.animateTo(target,{duration:600,curve:Curves.linear});await settled();check(Math.abs(position.offset-target)<.05,'Repeated cold scroll stopped early');
        await position.animateTo(0,{duration:600,curve:Curves.linear});await settled();check(Math.abs(position.offset)<.05,'Repeated revisit stopped early');
        tap('list-view-last');await settled();check(view.controller.nodes.some((node:any)=>node.id==='list-view-item-999'),'Repeated final row did not materialize');
        tap('list-view-first');await settled();check(Math.abs(position.offset)<.05,'Repeated first row did not return');tap('list-view-back');await settled();await delay(100);await settled();
        const end=now(),after=api.diagnosticState(),inputWindow=analyseNativeInputWindow(before,after,{pacing:'programmatic'}),receipts=analyseNativeFrameTrace(api.takeFrameTrace(),{begin,end,coreBaseline});
        check(receipts.receiptIntegrity&&receipts.input.received===0&&receipts.surface.n>0,'Repeated resource workload lost its native frame/input boundary');snapshot(cycle,{inputWindow,receipts});
      }
    }
    if(options.catalog){await catalog('material',stateOf(sample.ComponentsGallery),[stateOf(sample.ComponentsGallery).firstScroll,stateOf(sample.ComponentsGallery).secondScroll],[stateOf(sample.ComponentsGallery).firstExtents,stateOf(sample.ComponentsGallery).secondExtents],sample.demos);tap('show-cupertino');await until(()=>!!cupertino(),'Cupertino transition did not finish');await settled();const state=cupertino();await catalog('cupertino',state,[state.scroll],[state.extents],sample.cupertinoDemos);}
    check(!errors.length,'Handled framework errors during diagnostic: '+errors.join('; '));
    report({type:'complete',schema:1,mode:api.mode,qualification:'diagnostic-only',metrics:view.currentMetrics,tree:tree(),native:renderer.context().nelyxStats(),performanceAccepted:false,physicalInputAccepted:'notVerified',displayed:'unobserved'});
  }
  void run().then(()=>api.requestClose(),error=>{active=false;api.fail(error instanceof Error?error.stack??error.message:String(error));}).finally(()=>{
    api.requestFrame=request;FrameworkRoot.prototype.build=build;ViewRuntime.prototype.pump=pump;ViewRuntime.prototype.dispatchPointer=dispatch;for(const restore of restoreSpans.reverse())restore();GraphiteRenderer.prototype.submit=submit;FlutterError.onError=previousError;
  });
}
