import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {CupertinoPageTransition,CupertinoFullscreenDialogTransition,CupertinoRouteTransitionMixin,CupertinoPageRoute} from '@nelyx/cupertino/route';
import {CupertinoPageTransition as AggregatePage,CupertinoFullscreenDialogTransition as AggregateFullscreen} from '@nelyx/cupertino/widgets';
import {cupertinoEdgeShadowTween} from '@nelyx/cupertino/internal/route/edge-shadow';
import {Animation,AnimationStatus} from '@nelyx/core/framework/animation/animation';
import {SlideTransition,DecoratedBoxTransition} from '@nelyx/core/framework/widgets/transitions';
import {Directionality,MediaQuery} from '@nelyx/core/framework/widgets/app-data';
import {SizedBox,ColoredBox,Builder,DecoratedBox} from '@nelyx/core/framework/widgets/basic';
import {State,StatefulWidget} from '@nelyx/core/framework/widgets/framework';
import {GestureDetector} from '@nelyx/core/framework/widgets/gesture-detector';
import {Navigator,NavigatorController} from '@nelyx/core/framework/widgets/navigation';
import {PageRouteBuilder} from '@nelyx/core/framework/widgets/pages';
import {ImageConfiguration} from '@nelyx/core/framework/painting/image-configuration';
import {Color} from '@nelyx/core/ui/color';import {Offset} from '@nelyx/core/ui/offset';import {Size} from '@nelyx/core/ui/size';
import {fixture} from './root-fixture.mjs';import {engineFixture} from './engine-fixture.mjs';
import {FoundationBuildMode} from '@nelyx/core/foundation/constants';
import {Semantics} from '@nelyx/core/framework/widgets/semantics';
const timeout=1200000,source=JSON.parse(fs.readFileSync(new URL('./fixtures/cupertino-transitions-source.json',import.meta.url))),flush=async()=>{await Promise.resolve();await Promise.resolve();};
class Manual extends Animation{values=new Set();statuses=new Set();value=0;status=AnimationStatus.dismissed;addListener(l){this.values.add(l);}removeListener(l){this.values.delete(l);}addStatusListener(l){this.statuses.add(l);}removeStatusListener(l){this.statuses.delete(l);}set(value,status){const old=this.status;this.value=value;this.status=status;if(old!==status)for(const l of [...this.statuses])l(status);for(const l of [...this.values])l();}}
const WidgetClass=family=>family==='page'?CupertinoPageTransition:CupertinoFullscreenDialogTransition;
function tree(root,recipe,leaf){const result=[];const visit=(e,inside=false)=>{inside ||= e.widget===recipe;if(inside){const w=e.widget;if(w===leaf){result.push({kind:'leaf'});return;}if(w instanceof SlideTransition)result.push({kind:'slide',position:[w.position.value.dx,w.position.value.dy],textDirection:w.textDirection,transformHitTests:w.transformHitTests});else if(w instanceof DecoratedBoxTransition)result.push({kind:'decoration',decoration:{colors:w.decoration.value.colors?.map(c=>[c.a,c.r,c.g,c.b])??null}});}e.visitChildren(c=>visit(c,inside));};visit(root);return result;}
function noListeners(...animations){for(const animation of animations){assert.equal(animation.values.size,0);assert.equal(animation.statuses.size,0);}}

test('built-in route motion retains its static transition subtree and still responds to direction, child and animation replacement',{timeout},()=>{
 for(const fullscreenDialog of [false,true]){
  const f=fixture(),a=new Manual(),s=new Manual(),route=new CupertinoPageRoute({builder:()=>new SizedBox(),fullscreenDialog});
  const leaf=new Semantics({label:'Original child',textDirection:'ltr',container:true,child:SizedBox.expand()});a.set(.2,AnimationStatus.forward);
  const build=(primary=a,secondary=s,child=leaf)=>CupertinoRouteTransitionMixin.buildPageTransitions(route,{},primary,secondary,child);
  const wrap=(direction,child)=>new MediaQuery({width:240,height:160,scale:1,textScale:1,safeArea:{left:0,top:0,right:0,bottom:0},keyboardInset:0},new Directionality(direction,child));
  try{
   const widget=build();f.set(wrap('ltr',widget));let state;const find=e=>{if(e.widget===widget)state=e.stateObject;e.visitChildren(find);};find(f.root.root);assert(state);
   let rebuilds=0;const originalBuild=state.build;state.build=function(...args){rebuilds++;return originalBuild.apply(this,args);};
   let previous=tree(f.root.root,widget,leaf).filter(row=>row.kind==='slide').at(-1).position;
   for(const value of [.4,.6,.8]){a.set(value,AnimationStatus.forward);const current=build();f.set(wrap('ltr',current));const position=tree(f.root.root,current,leaf).filter(row=>row.kind==='slide').at(-1).position;assert.notDeepEqual(position,previous);previous=position;}
   assert.equal(rebuilds,0,'Animation listeners update movement without rebuilding the static route transition');
   f.set(wrap('rtl',build()));assert(rebuilds>0,'A retained Widget still reacts to inherited direction changes');
   const nextA=new Manual(),nextS=new Manual(),nextLeaf=new Semantics({label:'Replacement child',textDirection:'ltr',container:true,child:SizedBox.expand()});nextA.set(.6,AnimationStatus.forward);
   f.set(wrap('ltr',build(nextA,nextS,nextLeaf)));noListeners(a,s);assert(f.root.nodes.some(node=>node.name==='Replacement child'));assert(!f.root.nodes.some(node=>node.name==='Original child'));
   f.set(new SizedBox());noListeners(nextA,nextS);
  }finally{f.close();route.dispose();}
 }
});
test('128 original Cupertino page/fullscreen trees and 16 delegated trees match canonical owned Root values/direction/shadow',{timeout},()=>{
 const f=fixture();try{for(const row of source.rows){const a=new Manual(),s=new Manual(),leaf=new SizedBox(1,1),W=WidgetClass(row.family);a.set(row.primary,AnimationStatus[row.status]);s.set(row.secondary,AnimationStatus[row.status]);const widget=new W({primaryRouteAnimation:a,secondaryRouteAnimation:s,linearTransition:row.linear,child:leaf});f.set(new Directionality(row.direction,widget));assert.deepEqual(tree(f.root.root,widget,leaf),row.tree,JSON.stringify(row));f.set(new SizedBox());noListeners(a,s);}
 for(const row of source.delegated){const a=new Manual(),s=new Manual(),leaf=new SizedBox(1,1);let widget;s.set(row.secondary,AnimationStatus[row.status]);f.set(new Directionality(row.direction,new Builder(context=>{widget=CupertinoPageTransition.delegatedTransition(context,a,s,false,leaf);return widget;})));assert.deepEqual(tree(f.root.root,widget,leaf),row.tree);assert.equal(s.statuses.size,row.statusListeners);assert.equal(s.statuses.size,0);f.set(new SizedBox());noListeners(a,s);}}
 finally{f.close();}assert.equal(AggregatePage,CupertinoPageTransition);assert.equal(AggregateFullscreen,CupertinoFullscreenDialogTransition);
});
test('32 source interrupted-curve traces retain exact child and State, replace borrowed parents and linear policy cleanly',{timeout},()=>{
 for(const family of ['page','fullscreen'])for(const linear of [false,true]){const f=fixture(),a=new Manual(),s=new Manual(),leaf=new SizedBox(1,1),W=WidgetClass(family),widget=new W({primaryRouteAnimation:a,secondaryRouteAnimation:s,linearTransition:linear,child:leaf});s.set(.5,AnimationStatus.forward);let originalState;
 try{f.set(new Directionality('ltr',widget));const visit=e=>{if(e.widget===widget)originalState=e.stateObject;e.visitChildren(visit);};visit(f.root.root);for(const row of source.traces.filter(r=>r.family===family&&r.linear===linear)){a.set(row.primary,AnimationStatus[row.status]);f.frame();assert.deepEqual(tree(f.root.root,widget,leaf),row.tree);}
 const nextA=new Manual(),nextS=new Manual();nextA.set(.5,AnimationStatus.forward);nextS.set(.5,AnimationStatus.reverse);const replacement=new W({primaryRouteAnimation:nextA,secondaryRouteAnimation:nextS,linearTransition:!linear,child:leaf});f.set(new Directionality('rtl',replacement));noListeners(a,s);let nextState;const find=e=>{if(e.widget===replacement)nextState=e.stateObject;e.visitChildren(find);};find(f.root.root);assert.equal(nextState,originalState);f.set(new SizedBox());noListeners(nextA,nextS);}
 finally{f.close();}noListeners(a,s);}
});
test('48 original edge-shadow paint recipes and 45 source lerps preserve narrow/multiband geometry, null failure and list identity',{timeout},()=>{
 const DecorationClass=cupertinoEdgeShadowTween.begin.constructor;
 for(const row of source.paint){const decoration=new DecorationClass(row.colors?.map(c=>new Color(c))??null),painter=decoration.createBoxPainter(),calls=[];painter.paint({drawRect(r,p){calls.push({rect:[r.left,r.top,r.width,r.height],color:p.color});}},new Offset(...row.offset),new ImageConfiguration({size:new Size(row.width,32),textDirection:row.direction}));assert.deepEqual(calls,row.calls,JSON.stringify(row));painter.dispose();assert.equal(painter.debugDisposed,true);assert.throws(()=>painter.paint({drawRect(){}},Offset.zero,ImageConfiguration.empty));}
 const empty=cupertinoEdgeShadowTween.begin,from=value=>value===null?null:value.colors===null?empty:new DecorationClass(value.colors.map(([a,r,g,b])=>Color.from({alpha:a,red:r,green:g,blue:b}))),value=d=>d===null?null:{colors:d.colors?.map(c=>[c.a,c.r,c.g,c.b].map(v=>v===0?0:v))??null};for(const row of source.lerps){const a=from(row.a),b=from(row.b);if(row.throws)assert.throws(()=>DecorationClass.lerp(a,b,row.t));else assert.deepEqual(value(DecorationClass.lerp(a,b,row.t)),row.result);}
 const colors=[new Color(0x04000000),new Color(0)],a=new DecorationClass(colors),b=new DecorationClass(colors),other=new DecorationClass([...colors]);assert.deepEqual({sameColorsEqual:a.equals(b),differentListEqual:a.equals(other),sameHash:a.hashCode===b.hashCode},source.identity);const oldMode=FoundationBuildMode.mode;try{FoundationBuildMode.mode='debug';assert.throws(()=>new DecorationClass([new Color(0)]).createBoxPainter());}finally{FoundationBuildMode.mode=oldMode;}assert.throws(()=>a.createBoxPainter().paint({drawRect(){}},Offset.zero,ImageConfiguration.empty));
});
test('source primary versus secondary hit-transform decisions follow actual Core pointer geometry in LTR and RTL',{timeout},()=>{
 for(const direction of ['ltr','rtl']){const f=fixture(),a=new Manual(),s=new Manual();let taps=0;a.set(.5,AnimationStatus.forward);s.set(.5,AnimationStatus.forward);const leaf=new GestureDetector(new ColoredBox({color:0xffff0000,child:SizedBox.expand()}),{onTap:()=>{taps++;}});
 try{f.set(new Directionality(direction,new CupertinoPageTransition({primaryRouteAnimation:a,secondaryRouteAnimation:s,linearTransition:true,child:leaf})));const x=direction==='ltr'?130:110;const pointer=kind=>f.root.pointer({kind,x,y:80,pointer:1,device:'mouse',buttons:kind==='up'?0:1,timestamp:1,viewportGeneration:1});pointer('down');f.frame();pointer('up');f.frame();assert.equal(taps,1);}
 finally{f.close();}noListeners(a,s);}
});
test('actual Navigator Cupertino page/fullscreen push/pop keeps two child States and drains curves/tickers after reverse',{timeout},async()=>{
 for(const W of [CupertinoPageTransition,CupertinoFullscreenDialogTransition]){const f=fixture(),controller=new NavigatorController(),counts={created:0,disposed:0};class Probe extends StatefulWidget{createState(){counts.created++;return new(class extends State{build(){return new ColoredBox({color:0xffff0000,child:SizedBox.expand()});}dispose(){counts.disposed++;super.dispose();}})();}}const page=()=>new PageRouteBuilder({pageBuilder:()=>new Probe(),transitionDuration:400,reverseTransitionDuration:400,transitionsBuilder:(_context,primaryRouteAnimation,secondaryRouteAnimation,child)=>new W({primaryRouteAnimation,secondaryRouteAnimation,child,linearTransition:false})}),a=page(),b=page();
 try{f.set(new Directionality('ltr',new Navigator(controller,a)));const result=controller.push(b);f.frame();f.advance(200);assert.equal(b.animation.value,.5);assert.equal(a.secondaryAnimation.value,.5);assert.deepEqual(counts,{created:2,disposed:0});f.advance(201);await flush();f.frame();assert(controller.pop(5));f.frame();assert.equal(await result,5);f.advance(200);assert.equal(counts.disposed,0);f.advance(201);await flush();f.frame();assert.equal(await b.completed,5);assert.equal(counts.disposed,1);assert.equal(counts.created,2);assert.equal(f.root.scheduler.transientCallbackCount,0);}
 finally{f.close();controller.dispose();}assert.deepEqual(counts,{created:2,disposed:2});}
});
test('owned CPU page shadow outside the translated child and fullscreen vertical travel match source pixels and retire resources',{timeout},async()=>{
 const f=await engineFixture(),surface=f.ck.MakeSurface(240,160),a=new Manual(),s=new Manual(),leaf=new ColoredBox({color:0xffff0000,child:SizedBox.expand()}),pixel=(x,y)=>{f.library.replay(surface.getCanvas(),{commands:f.frame()});surface.flush();const image=surface.makeImageSnapshot();try{return [...image.readPixels(x,y,{width:1,height:1,colorType:f.ck.ColorType.RGBA_8888,alphaType:f.ck.AlphaType.Unpremul,colorSpace:f.ck.ColorSpace.SRGB})];}finally{image.delete();}};
 try{a.set(.5,AnimationStatus.forward);for(const direction of ['ltr','rtl']){f.set(new ColoredBox({color:0xffffffff,child:new Directionality(direction,new CupertinoPageTransition({primaryRouteAnimation:a,secondaryRouteAnimation:s,linearTransition:true,child:leaf}))}));assert.deepEqual(pixel(direction==='ltr'?120:119,80),[255,0,0,255]);assert.deepEqual(pixel(direction==='ltr'?119:120,80),[253,253,253,255]);}f.set(new ColoredBox({color:0xffffffff,child:new Directionality('ltr',new CupertinoFullscreenDialogTransition({primaryRouteAnimation:a,secondaryRouteAnimation:s,linearTransition:true,child:leaf}))}));assert.deepEqual(pixel(120,150),[255,0,0,255]);assert.deepEqual(pixel(120,0),[255,255,255,255]);}
 finally{surface.delete();await f.close();}noListeners(a,s);
});
