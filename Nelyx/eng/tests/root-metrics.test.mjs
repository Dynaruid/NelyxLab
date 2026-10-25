// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from '../../../packages/material/tests/root-fixture.mjs';
import {BuildOwner,StatelessWidget} from '@nelyx/core/framework/widgets/framework';
import {Row,SizedBox,Builder} from '@nelyx/core/framework/widgets/basic';
import {Semantics} from '@nelyx/core/framework/widgets/semantics';
import {MediaQuery,mediaFromView} from '@nelyx/core/framework/widgets/app-data';
import {LayoutBuilder} from '@nelyx/core/framework/widgets/layout-builder';
import {FrameworkRoot} from '@nelyx/core/framework/widgets/root';
import {DeviceGestureSettings} from '@nelyx/core/framework/gestures/gesture-settings';
import {BorderRadius} from '@nelyx/core/framework/painting/border-radius';
import {captureMetrics,freezeFrame,disposeFrame} from '@nelyx/core/ui/frame';
const timeout=1_200_000;
class Probe extends StatelessWidget{constructor(builder){super();this.builder=builder;}build(context){return this.builder(context);}}
const named=(id,name)=>new Semantics(new SizedBox(10,10),{id,role:'text',name});
function resize(f,values){const metrics=f.root.context.readMetrics();Object.assign(metrics,values,{viewportGeneration:metrics.viewportGeneration+1});f.frame();}

test('layout paint and semantics invalidations finish in the current frame without a redundant host request',{timeout},()=>{
 const f=fixture();let layouts=0;
 try{f.set(new LayoutBuilder(()=>{layouts++;return named('layout-frame','Current');}));
  assert.equal(layouts,1);assert.equal(f.root.nodes.find(node=>node.id==='layout-frame').name,'Current');
  assert.equal(f.root.scheduler.hasScheduledFrame,false,'Layout and semantics were already consumed by this frame');
  resize(f,{logicalWidth:320,physicalWidth:320});assert.equal(layouts,2);assert.equal(f.root.scheduler.hasScheduledFrame,false);
  f.root.pipeline.root.markNeedsLayout();assert.equal(f.root.scheduler.hasScheduledFrame,true,'Idle invalidations still request a host frame');
  f.frame();assert.equal(f.root.scheduler.hasScheduledFrame,false);
 }finally{f.close();}
});

test('transient continuation and post-frame layout changes still schedule their next frame',{timeout},()=>{
 const f=fixture();let ticks=0,post=0;
 try{f.set(named('frame-continuation','Current'));
  f.root.scheduler.scheduleFrameCallback(()=>{ticks++;f.root.scheduler.scheduleFrameCallback(()=>ticks++);});f.frame();
  assert.equal(ticks,1);assert.equal(f.root.scheduler.hasScheduledFrame,true);f.frame();assert.equal(ticks,2);assert.equal(f.root.scheduler.hasScheduledFrame,false);
  f.root.scheduler.addPostFrameCallback(()=>{post++;f.root.pipeline.root.markNeedsLayout();});f.frame();
  assert.equal(post,1);assert.equal(f.root.scheduler.hasScheduledFrame,true);f.frame();assert.equal(f.root.scheduler.hasScheduledFrame,false);
 }finally{f.close();}
});

test('an isolated layout build keeps a later default-scope rebuild scheduled',{timeout},()=>{
 const f=fixture();let context,value='Before',change=false,layoutContext;
 const reader=new Probe(current=>{context=current;return named('late-layout-build',value);});
 const layout=new LayoutBuilder(current=>{layoutContext=current;if(change){change=false;value='After';context.markNeedsBuild();}return new SizedBox(10,10);});
 try{f.set(new Row([reader,new SizedBox(20,20,layout)]));assert.equal(f.root.nodes.find(node=>node.id==='late-layout-build').name,'Before');
  change=true;layoutContext.markNeedsBuild();f.frame();assert.equal(f.root.nodes.find(node=>node.id==='late-layout-build').name,'Before');
  assert.equal(f.root.scheduler.hasScheduledFrame,true,'A Widget dirtied after the default build stage needs the next frame');
  f.frame();assert.equal(f.root.nodes.find(node=>node.id==='late-layout-build').name,'After');assert.equal(f.root.scheduler.hasScheduledFrame,false);
 }finally{f.close();}
});

test('MediaQuery property readers rebuild only for their observed values while full and unknown-aspect readers remain conservative',{timeout},()=>{
 const f=fixture(),counts={},values={};let data={width:240,height:160,scale:1,textScale:1,safeArea:{left:0,top:0,right:0,bottom:0},keyboardInset:0};
 const readers={full:c=>MediaQuery.of(c).width,text:c=>MediaQuery.textScalerOf(c).scale(10),brightness:MediaQuery.maybePlatformBrightnessOf.bind(MediaQuery),contrast:MediaQuery.maybeHighContrastOf.bind(MediaQuery),padding:c=>MediaQuery.paddingOf(c).bottom,viewPadding:c=>MediaQuery.viewPaddingOf(c).bottom,insets:c=>MediaQuery.viewInsetsOf(c).bottom,gesture:c=>MediaQuery.gestureSettingsOf(c).touchSlop,navigation:MediaQuery.navigationModeOf.bind(MediaQuery),radii:MediaQuery.displayCornerRadiiOf.bind(MediaQuery),multi:c=>[MediaQuery.textScalerOf(c),MediaQuery.maybeHighContrastOf(c)],allThenText:c=>[MediaQuery.of(c),MediaQuery.textScalerOf(c)],textThenAll:c=>[MediaQuery.textScalerOf(c),MediaQuery.of(c)],unknown:c=>c.dependOn(MediaQuery,'consumer-aspect').data.width};
 const child=new Row(Object.entries(readers).map(([name,read])=>new Probe(c=>{counts[name]=(counts[name]??0)+1;values[name]=read(c);return new SizedBox(5,5);}))),put=(patch,changed)=>{const before={...counts};data={...data,...patch};f.set(new MediaQuery(data,child));for(const name of Object.keys(readers))assert.equal(counts[name],before[name]+(changed.includes(name)?1:0),name+' dependencies for '+Object.keys(patch));};
 const all=['full','allThenText','textThenAll','unknown'];
 try{f.set(new MediaQuery(data,child));
  put({width:320},all);assert.equal(values.full,320);assert.equal(values.unknown,320);
  put({keyboardInset:20},[...all,'insets']);assert.equal(values.insets,20);assert.equal(values.padding,0);
  put({safeArea:{left:0,top:0,right:0,bottom:30}},[...all,'padding','viewPadding']);assert.equal(values.padding,10);assert.equal(values.viewPadding,30);
  put({textScale:1.5},[...all,'text','multi']);assert.equal(values.text,15);
  put({platformBrightness:'dark',highContrast:true,navigationMode:'directional'},[...all,'brightness','contrast','navigation','multi']);
  put({gestureSettings:new DeviceGestureSettings({touchSlop:12})},[...all,'gesture']);assert.equal(values.gesture,12);
  put({gestureSettings:new DeviceGestureSettings({touchSlop:12})},[]);
  put({displayCornerRadii:BorderRadius.circular(5)},[...all,'radii']);
  put({displayCornerRadii:BorderRadius.circular(5)},[]);
  put({scale:2},all);
 }finally{f.close();}
});

test('MediaQuery full readers observe changed prototype getters on their original private receiver',{timeout},()=>{
 class Data {#width;constructor(width){this.#width=width;}get width(){return this.#width;}height=160;scale=1;textScale=1;safeArea={left:0,top:0,right:0,bottom:0};keyboardInset=0;}
 const f=fixture(),seen=[],child=new Probe(c=>{seen.push(MediaQuery.of(c).width);return new SizedBox(10,10);});
 try{f.set(new MediaQuery(new Data(240),child));f.set(new MediaQuery(new Data(320),child));assert.deepEqual(seen,[240,320]);}finally{f.close();}
});

test('MediaQuery inherited static readers preserve a derived of override',{timeout},()=>{
 const data={width:240,height:160,scale:1,textScale:2,safeArea:{left:0,top:0,right:0,bottom:7},keyboardInset:0};let reads=0;
 class Derived extends MediaQuery{static of(){reads++;return data;}}
 assert.equal(Derived.paddingOf(null).bottom,7);assert.equal(Derived.viewPaddingOf(null).bottom,7);assert.equal(Derived.viewInsetsOf(null).bottom,0);assert.equal(Derived.textScalerOf(null).scale(10),20);assert.equal(Derived.displayCornerRadiiOf(null),null);assert.equal(reads,5);
});

test('animation callbacks use the calibrated host tick despite late JS dispatch and keep the clock fallback',{timeout},()=>{
 const f=fixture(),seen=[];let frame;
 try{f.elapse(100);f.root.scheduler.scheduleFrameCallback(timestamp=>seen.push(timestamp));
  const token={owner:f.root.context.owner,metrics:captureMetrics(f.root.context.readMetrics()),sequence:1,timing:{tick:10,dispatch:100,queueDelay:90,clockUncertainty:.01}};
  frame=freezeFrame(token,f.root.build({token,resources:f.root.context.resources}));assert.deepEqual(seen,[10]);
  f.root.scheduler.scheduleFrameCallback(timestamp=>seen.push(timestamp));f.frame();assert.deepEqual(seen,[10,100]);
 }finally{if(frame)disposeFrame(frame);f.close();}
});

test('viewport changes rebuild actual metrics readers without rebuilding a stable unrelated branch',{timeout},()=>{
 const f=fixture();let staticBuilds=0,reads=0;const read=f.root.buildOwner.services.readMetrics;
 try{f.set(new Row([new Probe(()=>{staticBuilds++;return new SizedBox(10,10);}),new Probe(()=>{reads++;const m=read();return named('metrics',m.logicalWidth+':'+m.scale);})]));
  assert.equal(staticBuilds,1);assert.equal(reads,1);resize(f,{logicalWidth:320,physicalWidth:640,scale:2});assert.equal(staticBuilds,1);assert.equal(reads,2);assert.equal(f.root.nodes.find(n=>n.id==='metrics').name,'320:2');
  resize(f,{logicalWidth:400,physicalWidth:800});assert.equal(staticBuilds,1);assert.equal(reads,3);
  f.root.context.readMetrics().rendererGeneration++;f.frame();assert.equal(staticBuilds,2,'Renderer replacement keeps the conservative rebuild');
 }finally{f.close();}
});

test('mediaFromView refreshes MediaQuery dependents and layout-scope readers on scale-only viewport changes',{timeout},()=>{
 const f=fixture();let staticBuilds=0,mediaBuilds=0,layoutBuilds=0;
 const reader=new Probe(context=>{mediaBuilds++;const media=MediaQuery.of(context);return named('media',media.width+':'+media.scale);});
 const layout=new LayoutBuilder((context)=>{layoutBuilds++;return named('layout',String(context.services.readMetrics().scale));});
 const media=new Probe(context=>new MediaQuery(mediaFromView(context),reader));
 try{f.set(new Row([new Probe(()=>{staticBuilds++;return new SizedBox(10,10);}),media,new SizedBox(20,20,layout)]));const before={staticBuilds,mediaBuilds,layoutBuilds};
  resize(f,{scale:2,physicalWidth:480,physicalHeight:320});assert.equal(staticBuilds,before.staticBuilds);assert(mediaBuilds>before.mediaBuilds);assert(layoutBuilds>before.layoutBuilds);assert.equal(f.root.nodes.find(n=>n.id==='media').name,'240:2');assert.equal(f.root.nodes.find(n=>n.id==='layout').name,'2');
 }finally{f.close();}
});

test('retired metrics readers leave their owner and a second view remains independent',{timeout},()=>{
 const a=fixture(),b=fixture();let readsA=0,readsB=0;
 try{a.set(new Probe(context=>{readsA++;context.services.readMetrics();return new SizedBox(10,10);}));b.set(new Probe(context=>{readsB++;context.services.readMetrics();return new SizedBox(10,10);}));
  resize(a,{logicalWidth:320,physicalWidth:320});assert.equal(readsA,2);assert.equal(readsB,1);a.set(new SizedBox(1,1));resize(a,{logicalWidth:400,physicalWidth:400});assert.equal(readsA,2);resize(b,{logicalWidth:500,physicalWidth:500});assert.equal(readsB,2);
 }finally{a.close();b.close();}
});

test('service forwarding preserves frozen hosts, prototype accessors, private receivers and captured metrics functions',{timeout},()=>{
 class Host{#metrics={logicalWidth:1};#requests=0;get marker(){return this.#metrics;}readMetrics(){return this.#metrics;}requestFrame(){this.#requests++;}get requests(){return this.#requests;}}
 const host=Object.freeze(new Host()),owner=new BuildOwner(host,()=>{});
 try{assert(owner.services instanceof Host);assert.equal(owner.services.marker,host.marker);assert.equal(owner.services.readMetrics,owner.services.readMetrics);const read=owner.services.readMetrics,request=owner.services.requestFrame;assert.equal(read(),host.marker);request();assert.equal(host.requests,1);assert('readMetrics'in owner.services);assert.throws(()=>{owner.services.marker={};},TypeError);}
 finally{owner.dispose();}
});

test('a createRoot closure captures tracked services and still refreshes after viewport changes',{timeout},()=>{
 const f=fixture();let root,frame,reads=0;const metrics=f.root.context.readMetrics(),context=f.root.context;
 try{root=new FrameworkRoot(context,{id:'captured-root',createRoot:services=>new Builder(()=>{reads++;return named('captured',String(services.readMetrics().logicalWidth));})});
  const build=sequence=>{if(frame)disposeFrame(frame);const token={owner:context.owner,sequence,metrics:captureMetrics(metrics)};frame=freezeFrame(token,root.build({token,resources:context.resources}));};build(1);assert.equal(reads,1);Object.assign(metrics,{logicalWidth:360,physicalWidth:360,viewportGeneration:metrics.viewportGeneration+1});build(2);assert.equal(reads,2);assert.equal(root.nodes.find(n=>n.id==='captured').name,'360');
 }finally{if(frame)disposeFrame(frame);root?.dispose();f.close();}
});
