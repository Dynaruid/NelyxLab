import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {Animation,AnimationStatus} from '@nelyx/core/framework/animation/animation';
import {FadeForwardsPageTransitionsBuilder} from '../dist/page-transitions-theme.js';
import {FadeForwardsPageTransitionsBuilder as AggregateBuilder} from '../dist/widgets.js';
import {PageTransitionsBuilder} from '@nelyx/core/framework/widgets/page-transitions-builder';
import {Navigator,NavigatorController,Route,routeOpacityOf} from '@nelyx/core/framework/widgets/navigation';
import {PageRouteBuilder} from '@nelyx/core/framework/widgets/pages';
import {SlideTransition,FadeTransition} from '@nelyx/core/framework/widgets/transitions';
import {IgnorePointer} from '@nelyx/core/framework/widgets/pointer-blocking';
import {State,StatefulWidget} from '@nelyx/core/framework/widgets/framework';
import {SizedBox,ColoredBox,Builder} from '@nelyx/core/framework/widgets/basic';
import {Directionality} from '@nelyx/core/framework/widgets/app-data';
import {Color} from '@nelyx/core/ui/color';
import {Theme} from '../dist/theme.js';import {ThemeData} from '../dist/theme-data.js';import {ColorScheme} from '../dist/color-scheme.js';
import {fixture} from './root-fixture.mjs';import {engineFixture} from './engine-fixture.mjs';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
FoundationPlatform.configure({kind:'native',operatingSystem:'windows'});
const timeout=1200000,source=JSON.parse(fs.readFileSync(new URL('./fixtures/fade-forwards-source.json',import.meta.url))),flush=async()=>{await Promise.resolve();await Promise.resolve();};
class Manual extends Animation{
 values=new Set();statuses=new Set();value=0;status=AnimationStatus.dismissed;
 addListener(l){this.values.add(l);}removeListener(l){this.values.delete(l);}addStatusListener(l){this.statuses.add(l);}removeStatusListener(l){this.statuses.delete(l);}
 set(value,status){const old=this.status;this.value=value;this.status=status;if(old!==status)for(const l of [...this.statuses])l(status);for(const l of [...this.values])l();}
}
function tree(root,recipe,leaf){const result=[];const visit=(e,inside=false)=>{inside ||= e.widget===recipe;if(inside){const w=e.widget;if(w===leaf){result.push({kind:'leaf'});return;}if(w instanceof SlideTransition)result.push({kind:'slide',position:[w.position.value.dx,w.position.value.dy]});else if(w instanceof FadeTransition)result.push({kind:'fade',opacity:w.opacity.value});else if(w instanceof ColoredBox)result.push({kind:'colored',color:w.color});else if(w instanceof IgnorePointer)result.push({kind:'ignore',ignoring:w.ignoring});}e.visitChildren(c=>visit(c,inside));};visit(root);return result;}
test('96 original FadeForwards and 96 delegated source trees match actual canonical Root, route opacity and theme context',{timeout},()=>{
 const f=fixture();try{for(const row of source.rows)for(const delegated of [false,true]){const a=new Manual(),s=new Manual(),c=new NavigatorController(),leaf=new SizedBox(1,1),policy=new FadeForwardsPageTransitionsBuilder({backgroundColor:row.background===null?null:new Color(row.background)});let recipe,opaque;a.set(row.primary,AnimationStatus[row.status]);s.set(row.secondary,AnimationStatus[row.secondaryStatus]);
 try{const route=new Route(context=>{opaque=routeOpacityOf(context);recipe=delegated?policy.delegatedTransition(context,a,s,false,leaf):policy.buildTransitions(null,null,a,s,leaf);return recipe;},'',null,row.opaque);f.set(new Theme(new ThemeData({colorScheme:new ColorScheme({surface:row.surface})}),new Directionality('ltr',new Navigator(c,route))));assert.equal(opaque,row.opaque);assert.deepEqual(tree(f.root.root,recipe,leaf),delegated?row.delegated:row.tree,JSON.stringify({row,delegated}));}
 finally{f.set(new SizedBox());c.dispose();}for(const animation of [a,s]){assert.equal(animation.values.size,0);assert.equal(animation.statuses.size,0);}}}finally{f.close();}
 const policy=new FadeForwardsPageTransitionsBuilder();assert.equal(AggregateBuilder,FadeForwardsPageTransitionsBuilder);assert(policy instanceof PageTransitionsBuilder);assert.deepEqual({duration:policy.transitionDuration,reverseDuration:policy.reverseTransitionDuration,milliseconds:FadeForwardsPageTransitionsBuilder.kTransitionMilliseconds,background:policy.backgroundColor},source.defaults);assert.notEqual(policy.delegatedTransition,policy.delegatedTransition);
});

test('FadeForwards maintains interrupted direction, borrowed animation lifetime, nullable delegated child and directional-independent motion',{timeout},()=>{
 const f=fixture(),a=new Manual(),s=new Manual(),leaf=new SizedBox(1,1),policy=new FadeForwardsPageTransitionsBuilder({backgroundColor:new Color(0xff654321)});let recipe;
 const build=()=>new Directionality('rtl',new Builder(context=>{recipe=policy.buildTransitions(null,null,a,s,leaf);return recipe;}));
 try{a.set(.4,AnimationStatus.forward);f.set(build());const before=tree(f.root.root,recipe,leaf),ignore=before.find(n=>n.kind==='ignore');assert.equal(ignore.ignoring,false);a.set(.2,AnimationStatus.reverse);f.set(build());const interrupted=tree(f.root.root,recipe,leaf);assert.equal(interrupted[0].opacity,.2/.75);assert.equal(interrupted.find(n=>n.kind==='ignore').ignoring,false);assert(interrupted.find(n=>n.kind==='slide').position[0]>0);a.set(1,AnimationStatus.completed);f.set(build());a.set(.8,AnimationStatus.reverse);f.set(build());const reverse=tree(f.root.root,recipe,leaf);assert.equal(reverse[0].opacity,1);assert.equal(reverse.find(n=>n.kind==='ignore').ignoring,true);assert(Math.abs(reverse.filter(n=>n.kind==='fade')[1].opacity-.2)<1e-12);
 f.set(new Builder(context=>policy.delegatedTransition(context,a,s,true,null)));assert.equal(a.values.size,0);assert.equal(a.statuses.size,0);s.set(.5,AnimationStatus.forward);f.frame();}
 finally{f.close();}for(const animation of [a,s]){assert.equal(animation.values.size,0);assert.equal(animation.statuses.size,0);}
});

test('actual Navigator FadeForwards keeps both page States through primary/secondary push/pop and reverses for 450ms',{timeout},async()=>{
 const f=fixture(),controller=new NavigatorController(),policy=new FadeForwardsPageTransitionsBuilder(),counts={created:0,disposed:0};class Probe extends StatefulWidget{createState(){counts.created++;return new(class extends State{build(){return new ColoredBox({color:0xffff0000,child:SizedBox.expand()});}dispose(){counts.disposed++;super.dispose();}})();}}
 const page=()=>{let route;route=new PageRouteBuilder({pageBuilder:()=>new Probe(),transitionDuration:policy.transitionDuration,reverseTransitionDuration:policy.reverseTransitionDuration,transitionsBuilder:(...args)=>policy.buildTransitions(route,...args)});return route;},a=page(),b=page();
 try{f.set(new Directionality('ltr',new Navigator(controller,a)));const result=controller.push(b);f.frame();f.advance(225);assert.equal(b.animation.value,.5);assert.equal(a.secondaryAnimation.value,.5);assert.deepEqual(counts,{created:2,disposed:0});f.advance(226);await flush();f.frame();assert(b.animation.isCompleted);assert(controller.pop(4));f.frame();assert.equal(await result,4);let completed=false;b.completed.then(()=>{completed=true;});f.advance(225);await flush();assert.equal(b.animation.value,.5);assert.equal(completed,false);assert.equal(counts.disposed,0);f.advance(226);await flush();f.frame();assert.equal(await b.completed,4);assert.equal(counts.disposed,1);assert.equal(counts.created,2);assert.equal(a.secondaryAnimation.value,0);assert.equal(f.root.scheduler.transientCallbackCount,0);}
 finally{f.close();controller.dispose();}assert.deepEqual(counts,{created:2,disposed:2});
});

test('real owned CPU FadeForwards primary fade/slide and secondary default/explicit background drain on close',{timeout},async()=>{
 const f=await engineFixture(),surface=f.ck.MakeSurface(240,160),a=new Manual(),s=new Manual(),leaf=new ColoredBox({color:0xffff0000,child:SizedBox.expand()}),policy=new FadeForwardsPageTransitionsBuilder({backgroundColor:new Color(0xff0000ff)});
 const pixel=()=>{f.library.replay(surface.getCanvas(),{commands:f.frame()});surface.flush();const image=surface.makeImageSnapshot();try{return [...image.readPixels(120,80,{width:1,height:1,colorType:f.ck.ColorType.RGBA_8888,alphaType:f.ck.AlphaType.Unpremul,colorSpace:f.ck.ColorSpace.SRGB})];}finally{image.delete();}};
 try{a.set(.25,AnimationStatus.forward);s.set(0,AnimationStatus.dismissed);f.set(new ColoredBox({color:0xffffffff,child:new Directionality('ltr',new Builder(context=>policy.buildTransitions(null,null,a,s,leaf)))}));assert.deepEqual(pixel(),[255,170,170,255]);s.set(.5,AnimationStatus.forward);f.set(new Directionality('ltr',new Builder(context=>policy.delegatedTransition(context,a,s,false,leaf))));assert.deepEqual(pixel(),[0,0,255,255]);}
 finally{surface.delete();await f.close();}for(const animation of [a,s]){assert.equal(animation.values.size,0);assert.equal(animation.statuses.size,0);}
});
