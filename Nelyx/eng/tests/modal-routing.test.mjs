// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {Navigator, NavigatorController, Route} from '@nelyx/core/framework/widgets/navigation';
import {showDialog} from '@nelyx/core/framework/widgets/dialog';
import {PageRouteBuilder} from '@nelyx/core/framework/widgets/pages';
import {Builder, Center, SizedBox} from '@nelyx/core/framework/widgets/basic';
import {Directionality} from '@nelyx/core/framework/widgets/app-data';
import {Offstage} from '@nelyx/core/framework/widgets/offstage';
import {LayoutBuilder} from '@nelyx/core/framework/widgets/layout-builder';
import {State,StatefulWidget,RenderObjectWidget} from '@nelyx/core/framework/widgets/framework';
import {RenderProxyBox} from '@nelyx/core/framework/rendering/boxes';
import {Semantics} from '@nelyx/core/framework/widgets/semantics';
import {ControlInteraction} from '@nelyx/core/framework/widgets/control-interaction';
import {FocusNode} from '@nelyx/core/framework/widgets/focus';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {FoundationBuildMode} from '@nelyx/core/foundation/constants';
import {InheritedTheme} from '@nelyx/core/framework/widgets/inherited-theme';
import {fixture} from '../../../packages/material/tests/root-fixture.mjs';

const timeout = 1_200_000;
FoundationPlatform.configure({kind: 'native', operatingSystem: 'windows'});
const flush = async f => {await Promise.resolve(); await Promise.resolve(); f.frame();};
const settle = async (f, ms = 400) => {f.advance(1); f.advance(ms); await flush(f);};
function escape(f) {for (const kind of ['down', 'up']) f.root.key({kind, key: 'Escape', shift: false, control: false, alt: false, meta: false, repeat: false}); f.frame();}
function pointer(f, x, y) {for (const kind of ['down', 'up']) {f.root.pointer({kind, pointer: 1, device: 'mouse', buttons: kind === 'up' ? 0 : 1, x, y, timestamp: 0, viewportGeneration: 1}); f.frame();}}
class DialogTheme extends InheritedTheme {
  constructor(value, child) {super(child); this.value = value;}
  updateShouldNotify(old) {return old.value !== this.value;}
  wrap(_context, child) {return new DialogTheme(this.value, child);}
}

test('a nondismissible dialog barrier blocks outside taps while Escape still follows the route Back contract', {timeout}, async () => {
  const f = fixture(), controller = new NavigatorController(); let context;
  try {
    f.set(new Navigator(controller, new Route(() => new Builder(value => {context = value; return new SizedBox();}))));
    const result = showDialog(context, {barrierDismissible: false, builder: () => new SizedBox(40, 40)}); f.frame();
    await settle(f); pointer(f, 1, 1); assert.equal(controller.routes.length, 2);
    escape(f); await flush(f);
    assert.equal(controller.routes.length, 1, 'Barrier dismissal and route Back are independent policies');
    assert.equal(await result, undefined);
  } finally {f.close(); controller.dispose();}
});

test('dialog root/nested selection uses actual Navigator ownership and completes each typed result once', {timeout}, async () => {
  const f = fixture(), root = new NavigatorController(), nested = new NavigatorController(); let context;
  const inner = new Navigator(nested, new Route(() => new Builder(value => {context = value; return new SizedBox();})));
  try {
    f.set(new Navigator(root, new Route(() => inner)));
    assert(Navigator.of(context) === nested, 'The nearest Navigator belongs to the nested route');
    assert(Navigator.of(context, {rootNavigator: true}) === root, 'Root lookup must select the outer Navigator');
    let completions = 0;
    const outerResult = showDialog(context, {builder: () => new SizedBox(20, 20)}).then(value => {completions++; return value;}); f.frame();
    assert.equal(root.routes.length, 2); assert.equal(nested.routes.length, 1);
    root.pop(42); f.frame(); assert.equal(await outerResult, 42); assert.equal(completions, 1);
    await settle(f);
    const innerResult = showDialog(context, {useRootNavigator: false, builder: () => new SizedBox(20, 20)}); f.frame();
    assert.equal(root.routes.length, 1); assert.equal(nested.routes.length, 2);
    nested.pop('nested'); f.frame(); assert.equal(await innerResult, 'nested'); await settle(f);
  } finally {f.close(); nested.dispose(); root.dispose();}
});

test('a reversing route blocks underlay pointer, semantics and repeated Back until retirement, then restores focus', {timeout}, async () => {
  const f = fixture({semanticsUpdateInterval:50}), controller = new NavigatorController(), focus = new FocusNode(); let clicks = 0;
  const home = new ControlInteraction(() => SizedBox.expand(), {focusNode: focus, onPressed: () => clicks++, semantics: {transportId: 'underlay', button: true, label: 'Underlay'}});
  controller.initialize(new Route(() => new SizedBox(), 'root'));
  const underlayResult = controller.push(new Route(() => home, 'underlay')); void underlayResult.catch(() => {});
  try {
    f.set(new Directionality('ltr', new Navigator(controller, new Route(() => new SizedBox()))));
    focus.requestFocus(); f.root.buildOwner.focus.applyFocusChangesIfNeeded(); f.frame(); assert(focus.hasFocus);
    const oldUnderlay=f.root.nodes.find(node=>node.id==='underlay');assert(oldUnderlay?.actions?.activate);
    const modal = new PageRouteBuilder({opaque: false, transitionDuration: 200, reverseTransitionDuration: 300, pageBuilder: () => new Center(new SizedBox(30, 30))});
    const result = controller.push(modal); f.frame();
    assert.equal(f.root.nodes.some(node=>node.id==='underlay'),false,'Modal entry bypasses the accessibility interval in its first frame');oldUnderlay.actions.activate();assert.equal(clicks,0);
    await settle(f);
    assert.equal(f.root.nodes.some(node => node.id === 'underlay'), false);
    assert(controller.pop('chosen')); f.frame(); assert.equal(await result, 'chosen');
    assert.equal(f.root.nodes.some(node => node.id === 'underlay'), false, 'Covered semantics must remain blocked throughout reverse');
    pointer(f, 1, 1); assert.equal(clicks, 0);
    escape(f); await flush(f); assert.equal(controller.routes.length, 2, 'Repeated Back cannot pop the underlay during reverse');
    await settle(f); assert.equal(modal.isActive, false);
    assert(f.root.nodes.some(node => node.id === 'underlay'));
    assert(focus.hasFocus, 'Focus returns after the covering route retires');
    pointer(f, 1, 1); assert.equal(clicks, 1);
  } finally {f.close(); focus.dispose(); controller.dispose();}
});

test('root dialog presentation captures the caller theme and fences result delivery when its owner closes', {timeout}, async () => {
  const f = fixture(), root = new NavigatorController(), nested = new NavigatorController(); let context, seen;
  try {
    f.set(new DialogTheme('outer', new Navigator(root, new Route(() => new DialogTheme('caller', new Navigator(nested, new Route(() => new Builder(value => {context = value; return new SizedBox();}))))))));
    const result = showDialog(context, {builder: value => {seen = value.dependOn(DialogTheme).value; return new SizedBox(20, 20);}});
    const rejected = assert.rejects(result, /Navigator disposed before route completed/);
    f.frame(); await settle(f); assert.equal(seen, 'caller'); assert.equal(root.routes.length, 2);
    f.set(new SizedBox()); nested.dispose(); root.dispose(); await rejected;
    assert.equal(f.root.scheduler.transientCallbackCount, 0);
  } finally {f.close(); nested.dispose(); root.dispose();}
});

test('queued accessibility actions reconcile a newly opened modal before the next request',{timeout},()=>{
  const f=fixture({semanticsUpdateInterval:50}),controller=new NavigatorController();let clicks=0;
  const modal=new PageRouteBuilder({opaque:false,transitionDuration:200,pageBuilder:()=>new Center(new SizedBox(30,30))});
  const home=new ControlInteraction(()=>SizedBox.expand(),{onPressed:()=>{clicks++;void controller.push(modal).catch(()=>{});},semantics:{transportId:'queued-underlay',button:true,label:'Open modal'}});
  try{
    f.set(new Directionality('ltr',new Navigator(controller,new Route(()=>home))));
    const old=f.root.nodes.find(node=>node.id==='queued-underlay');f.root.pipeline.root.children[0].layoutOffset={x:1,y:0};f.advance(10);assert(f.root.semanticsDeferred);
    old.actions.activate();old.actions.activate();f.frame();assert.equal(clicks,1);f.frame();
    assert.equal(f.root.nodes.some(node=>node.id==='queued-underlay'),false);assert.equal(clicks,1,'The queued second action cannot act through the modal');assert.equal(f.root.pendingSemanticsActions.length,0);
  }finally{f.close();controller.dispose();}
});


test('opaque route coverage preserves the underlay owner without resizing its lazy content until reveal', {timeout}, async () => {
  const f=fixture(),controller=new NavigatorController();let created=0;const widths=[];
  try{
    f.set(new Navigator(controller,new Route(()=>{created++;return new Builder(context=>{context.services.readMetrics();return new LayoutBuilder((_context,constraints)=>{widths.push(constraints.maxWidth);return new Semantics(new SizedBox(),{id:'covered-underlay',role:'text',name:String(constraints.maxWidth)});});});})));
    const result=controller.push(new Route(()=>new SizedBox()));f.frame();const covered=widths.length;
    const metrics=f.root.context.readMetrics();Object.assign(metrics,{logicalWidth:400,physicalWidth:400,viewportGeneration:metrics.viewportGeneration+1});f.frame();
    assert.equal(widths.length,covered,'A covered lazy page must not consume every new viewport layout');
    assert(!f.root.nodes.some(node=>node.id==='covered-underlay'));
    await controller.pop();await result;f.frame();assert.equal(created,1,'The covered page keeps its original route owner');
    assert.equal(widths.at(-1),400);assert(f.root.nodes.some(node=>node.id==='covered-underlay'&&node.name==='400'));
  }finally{f.close();controller.dispose();}
});


test('covered A-B-A resize preserves isolated dirty builds for reveal and later input', {timeout}, async () => {
  const previousMode=FoundationBuildMode.mode;FoundationBuildMode.mode='debug';
  const f=fixture(),controller=new NavigatorController();let state,builds=0;
  class Counter extends StatefulWidget {createState(){return state=new CounterState();}}
  class CounterState extends State {value=0;bump(){this.setState(()=>{this.value++;});}build(){builds++;return new Semantics(new SizedBox(10,10),{id:'scoped-counter',role:'text',name:String(this.value)});}}
  const counter=new Counter();
  try{
    f.set(new Navigator(controller,new Route(()=>new Builder(context=>{context.services.readMetrics();return new LayoutBuilder(()=>counter);}))));
    const original=state,result=controller.push(new Route(()=>new SizedBox()));f.frame();const covered=builds;
    const metrics=f.root.context.readMetrics();for(const width of [400,240]){Object.assign(metrics,{logicalWidth:width,physicalWidth:width,viewportGeneration:metrics.viewportGeneration+1});f.frame();}
    state.bump();f.frame();assert.equal(builds,covered);assert(!f.root.nodes.some(node=>node.id==='scoped-counter'));
    await controller.pop();await result;f.frame();assert.equal(state,original);assert(f.root.nodes.some(node=>node.id==='scoped-counter'&&node.name==='1'),'Reveal with the original constraints must consume the retained isolated build');
    state.bump();f.frame();assert(f.root.nodes.some(node=>node.id==='scoped-counter'&&node.name==='2'),'Later input must still rebuild the same isolated scope');
  }finally{try{f.close();controller.dispose();}finally{FoundationBuildMode.mode=previousMode;}}
});

test('ordinary Offstage continues measuring its child when the viewport changes', {timeout}, () => {
  const f=fixture(),widths=[];
  try{
    f.set(new Offstage(new LayoutBuilder((_context,constraints)=>{widths.push(constraints.maxWidth);return new SizedBox();}),{offstage:true}));
    const metrics=f.root.context.readMetrics();Object.assign(metrics,{logicalWidth:400,physicalWidth:400,viewportGeneration:metrics.viewportGeneration+1});f.frame();
    assert.deepEqual(widths,[240,400]);
  }finally{f.close();}
});

test('a deferred covered build preserves the foreground paint semantics interval', {timeout}, async () => {
  const f=fixture({semanticsUpdateInterval:50}),controller=new NavigatorController();let counter,foreground,render,builds=0;
  class Counter extends StatefulWidget {createState(){return counter=new CounterState();}}
  class CounterState extends State {bump(){this.setState(()=>{});}build(){builds++;return new SizedBox(10,10);}}
  class Foreground extends RenderObjectWidget {
    get childWidgets(){return [new ForegroundLabel()];}
    createRenderObject(){return render=new RenderProxyBox();}
  }
  class ForegroundLabel extends StatefulWidget {createState(){return foreground=new ForegroundLabelState();}}
  class ForegroundLabelState extends State {label='Stable';rename(){this.setState(()=>{this.label='Changed';});}build(){return new Semantics(SizedBox.expand(),{id:'foreground',role:'text',name:this.label});}}
  try{
    f.set(new Navigator(controller,new Route(()=>new LayoutBuilder(()=>new Counter()))));
    const result=controller.push(new Route(()=>new LayoutBuilder(()=>new Foreground())));f.frame();const covered=builds;
    counter.bump();f.frame();assert.equal(builds,covered);assert(f.root.buildOwner.hasDirty);
    let captures=0;const capture=f.root.sourceSemanticsSnapshot.capture.bind(f.root.sourceSemanticsSnapshot);
    f.root.sourceSemanticsSnapshot.capture=(...args)=>{captures++;return capture(...args);};
    const original=f.root.nodes.find(node=>node.id==='foreground');
    render.markNeedsPaint();f.advance(16);render.markNeedsPaint();f.advance(16);
    assert.equal(captures,0,'Pending covered work did not rebuild foreground semantic content');
    assert.equal(f.root.nodes.find(node=>node.id==='foreground'),original);
    f.advance(18);assert.equal(captures,1,'The final paint update publishes at the normal interval');
    foreground.rename();f.advance(5);assert.equal(captures,2,'A real isolated-scope rebuild publishes new semantic content immediately');
    assert.equal(f.root.nodes.find(node=>node.id==='foreground').name,'Changed');
    await controller.pop();await result;f.frame();assert(builds>covered,'Reveal consumes the retained covered work');
  }finally{f.close();controller.dispose();}
});
