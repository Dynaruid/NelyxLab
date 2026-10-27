// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from '../../../packages/material/tests/root-fixture.mjs';
import {BuildOwner,StatelessWidget} from '@nelyx/core/framework/widgets/framework';
import {Row,SizedBox,Builder} from '@nelyx/core/framework/widgets/basic';
import {resolveTextConfiguration} from '../../dist/framework/widgets/text-input.js';
import {Semantics} from '@nelyx/core/framework/widgets/semantics';
import {MediaQuery,mediaFromView,Localizations} from '@nelyx/core/framework/widgets/app-data';
import {WidgetsApp} from '@nelyx/core/framework/widgets/app';
import {LayoutBuilder} from '@nelyx/core/framework/widgets/layout-builder';
import {scrollbarMediaPadding} from '../../dist/framework/widgets/scrollbar-raw-source-adapter.js';
import {FrameworkRoot} from '@nelyx/core/framework/widgets/root';
import {DeviceGestureSettings} from '@nelyx/core/framework/gestures/gesture-settings';
import {BorderRadius} from '@nelyx/core/framework/painting/border-radius';
import {captureMetrics,captureSceneFrame,releaseSceneFrameSource,disposeFrame} from '@nelyx/core/ui/frame';
const timeout=1_200_000;
class Probe extends StatelessWidget{constructor(builder){super();this.builder=builder;}build(context){return this.builder(context);}}
const named=(id,name)=>new Semantics(new SizedBox(10,10),{id,role:'text',name});
function resize(f,values){const metrics=f.root.context.readMetrics();Object.assign(metrics,values,{viewportGeneration:metrics.viewportGeneration+1});f.frame();}

test('scrollbar host padding ignores size and keyboard churn and still observes raw safe-area changes',{timeout},()=>{
 const f=fixture();let builds=0,padding,data={width:240,height:160,scale:1,textScale:1,safeArea:{left:0,top:0,right:0,bottom:0},keyboardInset:0};
 const child=new Probe(context=>{builds++;padding=scrollbarMediaPadding(context);return new SizedBox(10,10);}),set=change=>{data={...data,...change};f.set(new MediaQuery(data,child));};
 try{
  set({});const before=builds;
  set({width:300,height:180});set({keyboardInset:40});assert.equal(builds,before);
  set({safeArea:{left:4,top:6,right:8,bottom:12}});assert.equal(builds,before+1);assert.deepEqual([padding.left,padding.top,padding.right,padding.bottom],[4,6,8,12]);
  set({width:400,safeArea:{left:4,top:6,right:8,bottom:12}});assert.equal(builds,before+1);
 }finally{f.close();}
});

test('a rejected recording or geometry notification never publishes its candidate semantics',{timeout},()=>{
 for(const failure of ['save','getter','close','geometry-throw','geometry-close']){
  const f=fixture(),published=[],paint=f.root.recordPaint;let painting,source,retirements=0;
  const publish=nodes=>published.push(nodes);
  f.root.context.semantics={capability:'native-controls',bind(nodes){publish(nodes);return {update:publish,dispose(){retirements++;}};}};
  try{
   f.set(named('atomic-semantics','Before'));const previous=f.root.nodes;assert.equal(published.length,1);
   f.root.recordPaint=function(render,context){painting=context;if(failure.startsWith('geometry-')){const capture=render.commitTextInputGeometries;render.commitTextInputGeometries=function(...args){const actual=capture.apply(this,args);return {...actual,commit(){actual.commit();if(failure==='geometry-throw')throw 0;f.root.dispose();}};};}return paint.call(this,render,context);};
   f.root.scheduler.addPostFrameCallback(()=>{if(failure==='save')painting.commands.push({op:'save'});if(failure==='getter')painting.commands.push({op:'clear',get color(){throw 0;}});if(failure==='close')f.root.dispose();});
   const change=()=>f.set(named('atomic-semantics','After'));
   if(failure==='save')assert.throws(change,error=>error.code==='unbalanced-save');
   else if(failure==='getter')assert.throws(change,error=>error===0);
   else if(failure==='geometry-throw')assert.throws(change,error=>error instanceof AggregateError&&error.errors[0]===0);
   else change();
   assert.equal(published.length,1,failure+' must leave the last published immutable host snapshot intact');
   if(!failure.endsWith('close'))assert.equal(f.root.nodes,previous,'Root exposes only its successful semantics commit');
  }finally{if(source)releaseSceneFrameSource(source);f.close();}
  assert.equal(retirements,1,'The one successful host binding retires once');
 }
});

test('a semantics host that closes Root while binding cannot strand its newly returned binding',{timeout},()=>{
 const f=fixture();let bindings=0,retirements=0;
 f.root.context.semantics={capability:'native-controls',bind(){bindings++;f.root.dispose();return {dispose(){retirements++;}};}};
 try{f.set(named('bind-close','Close'));assert.equal(bindings,1);assert.equal(retirements,1,'A binding returned after its owner closed must retire immediately');}
 finally{f.close();}
 assert.equal(retirements,1);
});

test('post-frame metric replacement and a visibility change during geometry commit cancel candidate semantics',{timeout},()=>{
 for(const change of ['metrics','geometry-metrics','visibility']){
  const f=fixture(),published=[],paint=f.root.recordPaint;
  f.root.context.semantics={capability:'native-controls',bind(nodes){published.push(nodes);return {update(nodes){published.push(nodes);},dispose(){}};}};
  try{
   f.set(named('publication-scope','Before'));const previous=f.root.nodes;
   if(change==='metrics')f.root.scheduler.addPostFrameCallback(()=>f.root.context.readMetrics().viewportGeneration++);
   else f.root.recordPaint=function(render,context){const capture=render.commitTextInputGeometries;render.commitTextInputGeometries=function(...args){const actual=capture.apply(this,args);return {...actual,commit(){actual.commit();if(change==='geometry-metrics')f.root.context.readMetrics().viewportGeneration++;else f.root.setVisible(false);}};};return paint.call(this,render,context);};
   f.set(named('publication-scope','After'));assert.equal(published.length,1,'A candidate from an invalidated scope cannot reach the host');assert.equal(f.root.nodes,previous);
  }finally{f.close();}
 }
});

test('Root finishes post-frame command changes before ownership capture and stops capture after a post-frame close',{timeout},()=>{
 for(const close of [false,true]){
  const f=fixture(),paint=f.root.recordPaint,geometry=[];let painting,reads=0,source,frame;
  f.root.recordPaint=function(render,context){painting=context;const capture=render.commitTextInputGeometries;render.commitTextInputGeometries=function(...args){const actual=capture.apply(this,args);return {token:actual.token,hasInputGeometry:actual.hasInputGeometry,commit(){geometry.push('commit');actual.commit();},discard(){geometry.push('discard');actual.discard();}};};return paint.call(this,render,context);};
  f.root.scheduler.addPostFrameCallback(()=>{painting.commands.push({op:'rect',rect:{x:0,y:0,width:1,height:1},get color(){reads++;if(close)throw 0;return 0xff123456;}});if(close)f.root.dispose();});
  try{const token={owner:f.root.context.owner,sequence:1,metrics:captureMetrics(f.root.context.readMetrics())};source=f.root.build({token,resources:f.root.context.resources});assert(painting.debugDisposed);if(close){assert.deepEqual(source,[]);assert.equal(reads,0);assert.deepEqual(geometry,['discard']);}else{frame=captureSceneFrame(token,source);assert.equal(frame.commands.at(-1).color,0xff123456);assert(reads>0);assert.deepEqual(geometry,['commit']);}}
  finally{if(frame)disposeFrame(frame);if(source)releaseSceneFrameSource(source);f.close();}
 }
});

test('Root discards geometry when post-frame recording capture rejects the final command buffer',{timeout},()=>{
 for(const invalid of ['save','getter']){
  const f=fixture(),paint=f.root.recordPaint,geometry=[];let painting,source;
  f.root.recordPaint=function(render,context){painting=context;const capture=render.commitTextInputGeometries;render.commitTextInputGeometries=function(...args){const actual=capture.apply(this,args);return {token:actual.token,hasInputGeometry:actual.hasInputGeometry,commit(){geometry.push('commit');actual.commit();},discard(){geometry.push('discard');actual.discard();}};};return paint.call(this,render,context);};
  f.root.scheduler.addPostFrameCallback(()=>painting.commands.push(invalid==='save'?{op:'save'}:{op:'rect',rect:{x:0,y:0,width:1,height:1},get color(){throw 0;}}));
  try{const token={owner:f.root.context.owner,sequence:1,metrics:captureMetrics(f.root.context.readMetrics())};assert.throws(()=>{source=f.root.build({token,resources:f.root.context.resources});},invalid==='save'?error=>error.code==='unbalanced-save':error=>error===0);assert(painting.debugDisposed);assert.deepEqual(geometry,['discard']);}
  finally{if(source)releaseSceneFrameSource(source);f.close();}
 }
});

test('Root retires its sealed recording if geometry publication throws or closes the owner',{timeout},()=>{
 for(const action of ['throw','close']){
  const f=fixture(),registry=f.root.context.resources,image={id:'geometry-publication-'+action,generation:1,kind:'image'},paint=f.root.recordPaint,geometry=[];let painting,source,retired=0,referencesAtCommit;
  registry.register(image,()=>retired++);registry.bindResource(image);
  f.root.recordPaint=function(render,context){painting=context;const capture=render.commitTextInputGeometries;render.commitTextInputGeometries=function(...args){const actual=capture.apply(this,args);return {token:actual.token,hasInputGeometry:actual.hasInputGeometry,commit(){referencesAtCommit=registry.retainedReferenceCount(image);geometry.push('commit');actual.commit();if(action==='throw')throw 0;f.root.dispose();},discard(){geometry.push('discard');actual.discard();}};};return paint.call(this,render,context);};
  f.root.scheduler.addPostFrameCallback(()=>painting.commands.push({op:'image',resource:image,rect:{x:0,y:0,width:1,height:1}}));
  try{const token={owner:f.root.context.owner,sequence:1,metrics:captureMetrics(f.root.context.readMetrics())};const build=()=>{source=f.root.build({token,resources:registry});};if(action==='throw')assert.throws(build,error=>error instanceof AggregateError&&error.errors.length===1&&error.errors[0]===0);else{build();assert.deepEqual(source,[]);}
    assert.equal(referencesAtCommit,2,'The final recording owns its resource before geometry notifications');assert(painting.debugDisposed);assert.deepEqual(geometry,action==='throw'?['commit','discard']:['commit']);assert.equal(registry.retainedReferenceCount(image),1);registry.releaseProducer(image);assert.equal(retired,1);
  }finally{if(source)releaseSceneFrameSource(source);f.close();}
 }
});

test('a Canvas close that retires Root cancels the sealed frame before geometry publication without closing Canvas twice',{timeout},()=>{
 const f=fixture(),registry=f.root.context.resources,image={id:'capture-close-owner',generation:1,kind:'image'},paint=f.root.recordPaint,geometry=[];let painting,source,retired=0,closes=0;
 registry.register(image,()=>retired++);registry.bindResource(image);
 f.root.recordPaint=function(render,context){painting=context;const dispose=context.dispose,capture=render.commitTextInputGeometries;context.dispose=function(){closes++;dispose.call(this);f.root.dispose();};render.commitTextInputGeometries=function(...args){const actual=capture.apply(this,args);return {token:actual.token,hasInputGeometry:actual.hasInputGeometry,commit(){geometry.push('commit');actual.commit();},discard(){geometry.push('discard');actual.discard();}};};return paint.call(this,render,context);};
 f.root.scheduler.addPostFrameCallback(()=>painting.commands.push({op:'image',resource:image,rect:{x:0,y:0,width:1,height:1}}));
 try{const token={owner:f.root.context.owner,sequence:1,metrics:captureMetrics(f.root.context.readMetrics())};source=f.root.build({token,resources:registry});assert.deepEqual(source,[]);assert(painting.debugDisposed);assert.equal(closes,1);assert.deepEqual(geometry,['discard']);assert.equal(registry.retainedReferenceCount(image),1);registry.releaseProducer(image);assert.equal(retired,1);}
 finally{if(source)releaseSceneFrameSource(source);f.close();}
});

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
 const readers={full:c=>MediaQuery.of(c).width,text:c=>MediaQuery.textScalerOf(c).scale(10),scale:MediaQuery.devicePixelRatioOf.bind(MediaQuery),maybeScale:MediaQuery.maybeDevicePixelRatioOf.bind(MediaQuery),brightness:MediaQuery.maybePlatformBrightnessOf.bind(MediaQuery),contrast:MediaQuery.maybeHighContrastOf.bind(MediaQuery),padding:c=>MediaQuery.paddingOf(c).bottom,viewPadding:c=>MediaQuery.viewPaddingOf(c).bottom,insets:c=>MediaQuery.viewInsetsOf(c).bottom,gesture:c=>MediaQuery.gestureSettingsOf(c).touchSlop,navigation:MediaQuery.navigationModeOf.bind(MediaQuery),radii:MediaQuery.displayCornerRadiiOf.bind(MediaQuery),multi:c=>[MediaQuery.textScalerOf(c),MediaQuery.maybeHighContrastOf(c)],allThenText:c=>[MediaQuery.of(c),MediaQuery.textScalerOf(c)],textThenAll:c=>[MediaQuery.textScalerOf(c),MediaQuery.of(c)],unknown:c=>c.dependOn(MediaQuery,'consumer-aspect').data.width};
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
  put({scale:2},[...all,'scale','maybeScale']);assert.equal(values.scale,2);assert.equal(values.maybeScale,2);
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
  frame=captureSceneFrame(token,f.root.build({token,resources:f.root.context.resources}));assert.deepEqual(seen,[10]);
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

test('selected metrics readers merge fields and keep full reads conservative across resize and renderer replacement',{timeout},()=>{
 const f=fixture(),counts={scale:0,size:0,full:0,mixed:0,fullFirst:0},read=f.root.buildOwner.services.readMetrics;
 const probe=(name,observe)=>new Probe(()=>{counts[name]++;observe();return new SizedBox(5,5);});
 try{f.set(new Row([probe('scale',()=>read('scale')),probe('size',()=>{read('logicalWidth');read('logicalHeight');}),probe('full',()=>read()),probe('mixed',()=>{read('scale');read();}),probe('fullFirst',()=>{read();read('scale');})]));
  assert.deepEqual(counts,{scale:1,size:1,full:1,mixed:1,fullFirst:1});
  resize(f,{logicalWidth:320,physicalWidth:320});assert.deepEqual(counts,{scale:1,size:2,full:2,mixed:2,fullFirst:2});
  resize(f,{logicalHeight:180,physicalHeight:180});assert.deepEqual(counts,{scale:1,size:3,full:3,mixed:3,fullFirst:3});
  resize(f,{scale:2,physicalWidth:640,physicalHeight:360});assert.deepEqual(counts,{scale:2,size:3,full:4,mixed:4,fullFirst:4});
  resize(f,{});assert.deepEqual(counts,{scale:2,size:3,full:5,mixed:5,fullFirst:5});
  f.root.context.readMetrics().rendererGeneration++;f.frame();assert.deepEqual(counts,{scale:3,size:4,full:6,mixed:6,fullFirst:6});
 }finally{f.close();}
});

test('WidgetsApp resizing preserves its default localization catalog and actual option changes refresh the overlay',{timeout},()=>{
 const f=fixture();let builds=0,catalog;
 const child=new Probe(context=>{builds++;const locale=Localizations.of(context);catalog=locale.messages;return named('app-locale',locale.locale+':'+locale.text('value'));});
 try{f.set(new WidgetsApp({child}));const initial=builds,messages=catalog;
  for(const logicalWidth of [300,320,340]){resize(f,{logicalWidth,physicalWidth:logicalWidth});assert.equal(builds,initial);assert(catalog===messages);}
  f.set(new WidgetsApp({child:named('app-replacement','New content')}));assert(f.root.nodes.some(node=>node.id==='app-replacement'));
  f.set(new WidgetsApp({locale:'ko-KR',supportedLocales:['en','ko-KR'],messages:{'ko-KR':{value:'Changed'}},child}));assert.equal(f.root.nodes.find(node=>node.id==='app-locale').name,'ko-KR:Changed');
 }finally{f.close();}
});

test('text configuration keeps its widget build during width-only resizing and refreshes on DPI and text scale changes',{timeout},()=>{
 const f=fixture();let builds=0,scale=0;
 const text=new Probe(context=>{builds++;const config=resolveTextConfiguration(context,{font:{id:'resize-font',generation:1}});scale=config.scaler.scale(10);return new SizedBox(10,10);});
 try{f.set(new Probe(context=>new MediaQuery(mediaFromView(context),text)));const initial=builds;
  for(const logicalWidth of [320,360,280]){resize(f,{logicalWidth,physicalWidth:logicalWidth});assert.equal(builds,initial,'Width changes still relayout the render tree without rebuilding scale readers');}
  resize(f,{scale:2,physicalWidth:560,physicalHeight:320});assert(builds>initial,'A real DPI change must refresh the text configuration');const afterDpi=builds;
  resize(f,{environment:{safeArea:{left:0,top:0,right:0,bottom:0},safeAreaSource:'application',keyboardInset:0,keyboardSource:'unavailable',textScale:1.5}});assert(builds>afterDpi);assert.equal(scale,15,'Inherited text scaling must still refresh the text configuration');
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
  const build=sequence=>{if(frame)disposeFrame(frame);const token={owner:context.owner,sequence,metrics:captureMetrics(metrics)};frame=captureSceneFrame(token,root.build({token,resources:context.resources}));};build(1);assert.equal(reads,1);Object.assign(metrics,{logicalWidth:360,physicalWidth:360,viewportGeneration:metrics.viewportGeneration+1});build(2);assert.equal(reads,2);assert.equal(root.nodes.find(n=>n.id==='captured').name,'360');
 }finally{if(frame)disposeFrame(frame);root?.dispose();f.close();}
});
