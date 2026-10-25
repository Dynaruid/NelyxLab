// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from '../../../packages/material/tests/root-fixture.mjs';
import {SizedBox,Transform,Row} from '@nelyx/core/framework/widgets/basic';
import {ClipRect} from '@nelyx/core/framework/widgets/clip';
import {Semantics} from '@nelyx/core/framework/widgets/semantics';
import {SliderControl} from '@nelyx/core/framework/widgets/slider-control';
import {RenderObjectWidget} from '@nelyx/core/framework/widgets/framework';
import {RenderProxyBox,RenderTransform,RenderDecoratedBox} from '@nelyx/core/framework/rendering/boxes';
import {RenderFractionalTranslation} from '@nelyx/core/framework/rendering/fractional-translation';
import {BoxDecoration} from '@nelyx/core/framework/painting/box-decoration';
import {BoxConstraints} from '@nelyx/core/framework/rendering/constraints';
import {Matrix4} from '@nelyx/core/math/matrix4';
import {RenderObject} from '@nelyx/core/framework/rendering/object';
import {existingPipelineSemantics} from '../../dist/framework/rendering/semantics-pipeline.js';
import {existingSemanticsFor} from '../../dist/framework/rendering/semantics-pipeline.js';
import {RenderSliver} from '@nelyx/core/framework/rendering/sliver';
import {RenderViewportBase} from '@nelyx/core/framework/rendering/viewport';
import {ListView,CustomScrollView} from '@nelyx/core/framework/widgets/scroll-view';
import {SliverList} from '@nelyx/core/framework/widgets/sliver';
import {SliverChildListDelegate} from '@nelyx/core/framework/widgets/scroll-delegate';
import {RenderSliverList} from '@nelyx/core/framework/rendering/sliver-list';
import {ScrollController} from '@nelyx/core/framework/widgets/scroll-controller';
import {EdgeInsets} from '@nelyx/core/framework/painting/edge-insets';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {Directionality} from '@nelyx/core/framework/widgets/app-data';
import {SemanticsConfiguration,SemanticsProperties} from '@nelyx/core/framework/semantics/semantics';
import {Offstage} from '@nelyx/core/framework/widgets/offstage';
import {AnimatedBuilder} from '@nelyx/core/framework/widgets/transitions';
import {ValueNotifier} from '@nelyx/core/foundation/notifier';
import {GlobalKey} from '@nelyx/core/framework/widgets/global-key';
import {Listener} from '@nelyx/core/framework/widgets/listener';
import {HitTestBehavior} from '@nelyx/core/framework/rendering/pointer-listener';
import {AttributedString} from '@nelyx/core/framework/semantics/attributed-string';
import {SemanticsFlags,CheckedState,Tristate} from '@nelyx/core/ui/semantics';
import {Ticker} from '@nelyx/core/framework/animation/ticker';
import {Color} from '@nelyx/core/ui/color';
import {InkHighlight} from '@nelyx/material/ink-highlight';
import {MaterialInkRender,InkFeature} from '../../../packages/material/dist/internal/material/material-ink-owner.js';
const timeout=1_200_000;

test('Material and Cupertino sliders apply absolute values through their real discrete change policy',{timeout},()=>{
  FoundationPlatform.configure({kind:'native',operatingSystem:'windows'});
  for(const policy of ['material','cupertino'])for(const divisions of [null,4]){
    const f=fixture(),calls=[],starts=[],ends=[];
    const tree=(onChanged=value=>calls.push(value))=>new Directionality('ltr',new SliderControl({id:'slider',policy,min:-100,max:100,value:0,divisions,adjustmentUnit:.05,geometry:{width:100,height:40,trackInset:10,thumbHitRadius:12,minDragExtent:1,expand:false},onChanged,onChangeStart:value=>starts.push(value),onChangeEnd:value=>ends.push(value),builder:()=>new SizedBox(100,40)}));
    try{
      f.set(tree());const node=f.root.nodes.find(node=>node.id==='slider');assert(node.rangeActions);assert.equal(node.numericRange.smallChange,divisions===null?10:50);node.rangeActions.setValue(37.5);assert.deepEqual(calls,[divisions===null?37.5:50]);assert.deepEqual(starts,policy==='material'?[0]:[]);assert.deepEqual(ends,policy==='material'?[divisions===null?37.5:50]:[]);
      f.set(tree(null));assert.equal(f.root.nodes.find(node=>node.id==='slider').rangeActions,undefined);node.rangeActions.setValue(-50);assert.equal(calls.length,1);
    }finally{f.close();}
  }
});

test('absolute range transport rejects old, blocked, invisible and invalid requests',{timeout},()=>{
  const f=fixture(),calls=[],child=new SizedBox(80,60),range={min:-100,max:100,value:25,smallChange:5},actions={setValue:value=>calls.push(value)};
  const properties=new SemanticsProperties({slider:true,enabled:true,textDirection:'ltr',value:'25%',onIncrease(){},onDecrease(){}});
  const tree=(extra={})=>Semantics.fromProperties({properties,transportId:'range',transportRange:range,transportRangeActions:actions,container:true,child,...extra});
  try{
    f.set(tree());const first=f.root.nodes.find(node=>node.id==='range');assert(first.rangeActions);first.rangeActions.setValue(37.5);for(const value of [NaN,Infinity,-101,101])first.rangeActions.setValue(value);assert.deepEqual(calls,[37.5]);
    range.value=50;f.set(tree());first.rangeActions.setValue(40);assert.deepEqual(calls,[37.5]);const current=f.root.nodes.find(node=>node.id==='range');current.rangeActions.setValue(-75);assert.deepEqual(calls,[37.5,-75]);
    f.set(tree({blockUserActions:true}));assert.equal(f.root.nodes.find(node=>node.id==='range').rangeActions,undefined);current.rangeActions.setValue(20);assert.deepEqual(calls,[37.5,-75]);
    f.set(tree());const visible=f.root.nodes.find(node=>node.id==='range');f.set(new Offstage(tree(),{offstage:true}));visible.rangeActions.setValue(20);assert.deepEqual(calls,[37.5,-75]);
  }finally{f.close();}
});

test('empty semantics defaults stay immutable and independent from later annotations',{timeout},()=>{
  const a=new SemanticsConfiguration(),b=new SemanticsConfiguration(),snapshot=b.copy();
  assert.equal(a.hasBeenAnnotated,false);assert.equal(b.hasBeenAnnotated,false);
  for(const name of ['attributedLabel','attributedValue','attributedIncreasedValue','attributedDecreasedValue','attributedHint']){
    assert.equal(b[name].string,'');assert.deepEqual(b[name].attributes,[]);
    assert.throws(()=>{a[name].string='changed';},TypeError);assert.throws(()=>a[name].attributes.push({}),TypeError);
    a[name]=new AttributedString(name);assert.equal(a.hasBeenAnnotated,true);
    assert.equal(b[name].string,'');assert.equal(snapshot[name].string,'');
  }
  a.label='';assert.equal(a.hasBeenAnnotated,true,'Explicit empty labels are still annotations');
});

test('an empty merge reuses its source configuration and a later child merge stays isolated',{timeout},()=>{
  const f=fixture();let render;
  class Boundary extends RenderProxyBox{describeSemanticsConfiguration(config){super.describeSemanticsConfiguration(config);config.isSemanticBoundary=true;config.label='Owner';config.textDirection='ltr';}}
  class Target extends RenderObjectWidget{constructor(child){super();this.child=child;}get childWidgets(){return [this.child];}createRenderObject(){return render=new Boundary();}}
  const set=child=>f.set(new SizedBox(80,80,new Target(child)));
  try{
    set(new SizedBox(40,40));let provider=existingSemanticsFor(render).configProvider;
    assert.equal(provider.effective,provider.original,'A leaf needs no writable configuration copy');assert.equal(provider.original.label,'Owner');
    set(new Semantics({label:'Child',textDirection:'ltr',child:new SizedBox(40,40)}));provider=existingSemanticsFor(render).configProvider;
    assert.notEqual(provider.effective,provider.original);assert.equal(provider.original.label,'Owner');assert.equal(provider.effective.label,'Owner\nChild');
    set(new SizedBox(40,40));provider=existingSemanticsFor(render).configProvider;
    assert.equal(provider.original.label,'Owner');assert.equal(provider.effective.label,'Owner');
  }finally{f.close();}
});

test('render-owned semantics follow GlobalKey reparenting and leave no detached transport source',{timeout},()=>{
 const f=fixture(),key=new GlobalKey(),branch=new Semantics({key,container:true,transportId:'moving-owner',label:'moving',textDirection:'ltr',child:new SizedBox(20,20)});let render;
 try{
  f.set(new Row([new SizedBox(40,40,branch),new SizedBox(40,40)]));render=key.currentContext.findRenderObject();const fragment=existingSemanticsFor(render),oldParent=render.parent,first=f.root.nodes.find(node=>node.id==='moving-owner');assert(first);
  f.set(new Row([new SizedBox(40,40),new SizedBox(40,40,branch)]));assert.equal(key.currentContext.findRenderObject(),render);assert.notEqual(render.parent,oldParent);assert.equal(existingSemanticsFor(render),fragment);assert.equal(fragment.parent.renderObject,render.parent);const moved=f.root.nodes.filter(node=>node.id==='moving-owner');assert.equal(moved.length,1);assert(moved[0].bounds.x>first.bounds.x);
  f.set(new SizedBox(20,20));assert(!f.root.nodes.some(node=>node.id==='moving-owner'));assert(!existingPipelineSemantics(f.root.pipeline).transportSources.has(render));assert.equal(render.debugDisposed,true);
 }finally{f.close();}
 assert.equal(existingSemanticsFor(render).cachedSemanticsNode,null);
});

test('semantics flags retain typed states, option reads and derived value protection',{timeout},()=>{
  const reads=[],flags=new SemanticsFlags(new Proxy({isChecked:CheckedState.isTrue,isSelected:Tristate.isFalse,isButton:true},{get(target,key){reads.push(key);return target[key];}}));
  assert.equal(flags.isChecked,CheckedState.isTrue);assert.equal(flags.isSelected,Tristate.isFalse);assert.equal(flags.isButton,true);
  assert.deepEqual(reads.slice(0,5),['isChecked','isChecked','isSelected','isSelected','isEnabled']);
  assert.deepEqual(reads.slice(-3),['isLink','isSlider','isKeyboardKey']);assert(Object.isFrozen(flags));
  for(const options of [{isChecked:true},{isSelected:true},{isEnabled:false},{isToggled:0},{isExpanded:1},{isRequired:null},{isFocused:'true'},{isButton:1},{isKeyboardKey:'false'}])assert.throws(()=>new SemanticsFlags(options),/typed state/);
  class Derived extends SemanticsFlags{extra=1;}
  const derived=new Derived({isTextField:true});assert.equal(derived.extra,1);derived.extra=2;assert.throws(()=>{derived.isTextField=false;},TypeError);
});
test('source wheel routing avoids unused legacy conversions and preserves a transformed legacy consumer',{timeout},()=>{
  const f=fixture(),signals=[],legacy=[],responses=[];let render,conversions=0;
  class Target extends RenderObjectWidget{get childWidgets(){return [new Listener(new SizedBox(100,100),{behavior:HitTestBehavior.opaque,onPointerSignal:event=>signals.push(event)})];}createRenderObject(){return render=new RenderProxyBox();}}
  const convert=f.root.legacyPointerEvent;f.root.legacyPointerEvent=function(event){conversions++;return convert.call(this,event);};
  const wheel=()=>f.root.pointer({kind:'wheel',pointer:0,device:'mouse',buttons:0,x:35,y:45,deltaX:0,deltaY:2.4,timestamp:0,viewportGeneration:1,respondToSignal:allow=>responses.push(allow)});
  try{
    f.set(Transform.translate(new Target(),{x:10,y:20}));wheel();assert.equal(signals.length,1);assert.equal(conversions,0,'Source-only hit paths must not allocate a legacy DTO at every ancestor');assert.equal(f.root.mouseTracker.mouseIsConnected,false);
    render.onPointer=event=>{legacy.push(event);return true;};wheel();assert.equal(signals.length,2);assert.equal(legacy.length,1);assert.equal(conversions,1);assert.equal(legacy[0].x,25);assert.equal(legacy[0].y,25);assert.equal(legacy[0].deltaY,2.4);assert.equal(responses.at(-1),false);
  }finally{f.root.legacyPointerEvent=convert;f.close();}
});

test('unchanged embedding ranges retain semantic snapshots while changed and mutated ranges publish',{timeout},()=>{
  for(const numeric of [false,true]){
    const f=fixture(),calls=[],properties=new SemanticsProperties({label:'Stable range',textDirection:'ltr',onTap:()=>calls.push('tap')}),child=new SizedBox(80,60);
    let range=numeric?{min:0,max:100,value:25}:null;
    const tree=()=>Semantics.fromProperties({properties,transportRange:range,container:true,child});
    try{
      f.set(tree());let captures=0;const capture=f.root.sourceSemanticsSnapshot.capture.bind(f.root.sourceSemanticsSnapshot);f.root.sourceSemanticsSnapshot.capture=(...args)=>{captures++;return capture(...args);};
      const original=f.root.nodes.find(node=>node.name==='Stable range');if(numeric)range={...range};f.set(tree());assert.equal(captures,0);assert.equal(f.root.nodes.find(node=>node.id===original.id),original);original.actions.activate();assert.deepEqual(calls,['tap']);
      range={min:0,max:100,value:75};f.set(tree());assert.equal(captures,1);assert.deepEqual(f.root.nodes.find(node=>node.id===original.id).numericRange,range);
      range.value=80;f.set(tree());assert.equal(captures,2,'A caller mutation must compare with the captured prior range');assert.equal(f.root.nodes.find(node=>node.id===original.id).numericRange.value,80);
      range=null;f.set(tree());assert.equal(captures,3);assert.equal(f.root.nodes.find(node=>node.id===original.id).numericRange,undefined);
      let reads=0;range={min:0,max:100,get value(){reads++;return 90;}};f.set(tree());assert.equal(captures,4);assert.equal(reads,1);f.set(tree());assert.equal(captures,4);assert.equal(reads,2,'Capture each caller getter once per update');
    }finally{f.close();}
  }
});

test('a stable source transport id reuses its snapshot and changed source callbacks and ids still revoke old actions',{timeout},()=>{
  const f=fixture(),calls=[],child=new SizedBox(80,60);let id='stable-source-id',properties=new SemanticsProperties({label:'Source id',textDirection:'ltr',onTap:()=>calls.push('old')});
  const tree=()=>Semantics.fromProperties({properties,transportId:id,container:true,child});
  try{
    f.set(tree());let captures=0;const capture=f.root.sourceSemanticsSnapshot.capture.bind(f.root.sourceSemanticsSnapshot);f.root.sourceSemanticsSnapshot.capture=(...args)=>{captures++;return capture(...args);};
    const original=f.root.nodes.find(node=>node.id===id);f.set(tree());assert.equal(captures,0);assert.equal(f.root.nodes.find(node=>node.id===id),original);original.actions.activate();assert.deepEqual(calls,['old']);
    properties=new SemanticsProperties({label:'Source id',textDirection:'ltr',onTap:()=>calls.push('new')});f.set(tree());assert.equal(captures,1);original.actions.activate();assert.deepEqual(calls,['old']);const replaced=f.root.nodes.find(node=>node.id===id);replaced.actions.activate();assert.deepEqual(calls,['old','new']);
    id='changed-source-id';f.set(tree());assert.equal(captures,2);assert(!f.root.nodes.some(node=>node.id==='stable-source-id'));replaced.actions.activate();assert.deepEqual(calls,['old','new']);f.root.nodes.find(node=>node.id===id).actions.activate();assert.deepEqual(calls,['old','new','new']);
    const named=f.root.nodes.find(node=>node.id===id);id=undefined;f.set(tree());assert.equal(captures,3);assert(!f.root.nodes.some(node=>node.id==='changed-source-id'));named.actions.activate();assert.deepEqual(calls,['old','new','new']);f.root.nodes.find(node=>node.name==='Source id').actions.activate();assert.deepEqual(calls,['old','new','new','new']);
  }finally{f.close();}
});

test('built-in transform motion preserves configuration while refreshing clip, visibility and actions',{timeout},()=>{
  for(const fractional of [false,true]){
    const f=fixture(),calls=[];let render;
    class Carrier extends RenderObjectWidget{
      get childWidgets(){return [new Semantics({textDirection:'ltr',transportId:'transform-motion',label:'Moving',container:true,onTap:()=>calls.push('tap'),child:new SizedBox(80,60)})];}
      createRenderObject(){return render=fractional?new RenderFractionalTranslation({translation:{x:0,y:0}}):new RenderTransform([1,0,0,1,0,0]);}
    }
    try{
      f.set(new ClipRect(new Carrier()));const config=existingSemanticsFor(render).configProvider.original,source=f.root.nodes.find(node=>node.id==='transform-motion').sourceNodeId;
      for(const [x,y,expected]of [[20,10,{x:20,y:10,width:220,height:150}],[-20,-10,{x:0,y:0,width:220,height:150}],[300,0,null],[10,10,{x:10,y:10,width:230,height:150}]]){
        if(fractional)render.translation={x:x/render.size.width,y:y/render.size.height};else render.matrix=[1,0,0,1,x,y];
        f.frame();assert.equal(existingSemanticsFor(render).configProvider.original,config);const node=f.root.nodes.find(node=>node.id==='transform-motion');
        if(expected){assert.deepEqual(node.bounds,expected);assert.equal(node.sourceNodeId,source);node.actions.activate();}else assert.equal(node,undefined);
      }
      assert.deepEqual(calls,['tap','tap','tap']);
    }finally{f.close();}
  }
});

test('decoration pixel changes reuse the published semantic snapshot',{timeout},()=>{
  const f=fixture();let render;
  class Carrier extends RenderObjectWidget{
    get childWidgets(){return [new Semantics({textDirection:'ltr',transportId:'decorated',label:'Decorated',container:true,child:new SizedBox(80,60)})];}
    createRenderObject(){return render=new RenderDecoratedBox(0xff000000);}
  }
  try{
    f.set(new Carrier());const config=existingSemanticsFor(render).configProvider.original,node=f.root.nodes.find(node=>node.id==='decorated');let captures=0;
    const capture=f.root.sourceSemanticsSnapshot.capture.bind(f.root.sourceSemanticsSnapshot);f.root.sourceSemanticsSnapshot.capture=(...args)=>{captures++;return capture(...args);};
    render.decoration=new BoxDecoration({color:0xffffffff});render.position='foreground';f.frame();
    assert.equal(existingSemanticsFor(render).configProvider.original,config);assert.equal(captures,0);assert.equal(f.root.nodes.find(node=>node.id==='decorated'),node);
  }finally{f.close();}
});

test('Material ink animates, changes color and retires without recapturing unchanged semantics',{timeout},()=>{
  const f=fixture(),calls=[];let render;
  class Carrier extends RenderObjectWidget{
    get childWidgets(){return [new Semantics({textDirection:'ltr',transportId:'ink-child',label:'Ink child',container:true,onTap:()=>calls.push('tap'),child:new SizedBox(80,60)})];}
    createRenderObject(){return render=new MaterialInkRender({createTicker:callback=>new Ticker(f.root.scheduler,callback)},null,false);}
  }
  try{
    f.set(new Carrier());const config=existingSemanticsFor(render).configProvider.original,node=f.root.nodes.find(node=>node.id==='ink-child');let captures=0;
    const capture=f.root.sourceSemanticsSnapshot.capture.bind(f.root.sourceSemanticsSnapshot);f.root.sourceSemanticsSnapshot.capture=(...args)=>{captures++;return capture(...args);};
    const highlight=new InkHighlight({controller:render,referenceBox:render,color:new Color(0xff123456),textDirection:'ltr'}),initial=f.frame();
    const animated=f.advance(50);assert.notDeepEqual(animated,initial);highlight.color=new Color(0xffabcdef);assert.notDeepEqual(f.frame(),animated);
    render.didChangeLayout();f.frame();node.actions.activate();assert.deepEqual(calls,['tap']);highlight.deactivate();f.frame();f.advance(200);
    assert.equal(highlight.debugDisposed,true);assert.equal(render.debugInkFeatures.length,0);assert.equal(f.root.scheduler.transientCallbackCount,0);
    assert.equal(existingSemanticsFor(render).configProvider.original,config);assert.equal(captures,0);assert.equal(f.root.nodes.find(node=>node.id==='ink-child'),node);
    render.markNeedsSemanticsUpdate();f.frame();assert(captures>0,'Explicit semantic invalidation still publishes');
    const afterExplicit=captures;render.markNeedsLayout();f.frame();assert(captures>afterExplicit,'Completed layout retains its semantic invalidation');
  }finally{f.close();}
});

test('Material ink keeps subclass and mutable instance semantic hooks current',{timeout},()=>{
  class Feature extends InkFeature{paintFeature(){}}
  for(const instance of [false,true]){
    const f=fixture();let render;
    class Custom extends MaterialInkRender{
      describeSemanticsConfiguration(config){super.describeSemanticsConfiguration(config);config.isSemanticBoundary=true;config.label='Ink count '+this.features.length;config.textDirection='ltr';}
    }
    class Carrier extends RenderObjectWidget{
      get childWidgets(){return [new SizedBox(80,60)];}
      createRenderObject(){
        render=new (instance?MaterialInkRender:Custom)({createTicker(){throw new Error('No ticker expected');}},null,false);
        if(instance)Object.defineProperty(render,'semanticsTransport',{get:()=>render.features.length?{id:'custom-ink',role:'button',name:'Ink count '+render.features.length,actions:{activate(){}}}:null});
        return render;
      }
    }
    try{
      f.set(new Carrier());assert.equal(f.root.nodes.some(node=>node.name==='Ink count 0'),!instance);
      const feature=new Feature({controller:render,referenceBox:render});render.addInkFeature(feature);f.frame();assert(f.root.nodes.some(node=>node.name==='Ink count 1'));
      feature.dispose();f.frame();assert(!f.root.nodes.some(node=>node.name==='Ink count 1'));assert.equal(f.root.nodes.some(node=>node.name==='Ink count 0'),!instance);
    }finally{f.close();}
  }
});

test('a root ink clip hook refreshes child visibility and revokes the hidden action',{timeout},()=>{
  const f=fixture(),calls=[];let render;
  class Feature extends InkFeature{paintFeature(){}}
  class Carrier extends RenderObjectWidget{
    get childWidgets(){return [new Semantics({textDirection:'ltr',transportId:'ink-clipped',label:'Clipped ink',container:true,onTap:()=>calls.push('tap'),child:new SizedBox(80,60)})];}
    createRenderObject(){
      render=new MaterialInkRender({createTicker(){throw new Error('No ticker expected');}},null,false);
      render.describeSemanticsClip=()=>render.features.length?{x:0,y:0,width:0,height:0}:null;
      return render;
    }
  }
  try{
    f.set(new Carrier());const original=f.root.nodes.find(node=>node.id==='ink-clipped');original.actions.activate();const feature=new Feature({controller:render,referenceBox:render});
    render.addInkFeature(feature);f.frame();assert(!f.root.nodes.some(node=>node.id==='ink-clipped'));original.actions.activate();assert.deepEqual(calls,['tap']);
    feature.dispose();f.frame();f.root.nodes.find(node=>node.id==='ink-clipped').actions.activate();assert.deepEqual(calls,['tap','tap']);
  }finally{f.close();}
});

test('transform geometry invalidation agrees with a full semantic rebuild for rotation, singular and perspective matrices',{timeout},()=>{
  const f=fixture();let render;
  class Carrier extends RenderObjectWidget{
    get childWidgets(){return [new Semantics({textDirection:'ltr',transportId:'matrix-motion',label:'Matrix',container:true,child:new SizedBox(80,60)})];}
    createRenderObject(){return render=new RenderTransform([1,0,0,1,0,0]);}
  }
  const nodes=()=>f.root.nodes.map(({id,name,bounds})=>({id,name,bounds}));
  try{
    f.set(new ClipRect(new Carrier()));
    for(const matrix of [Matrix4.rotationZ(.3).storage,[0,0,0,0,0,0],[1,0,0,.001,0,1,0,-.002,0,0,1,0,7,11,0,1],[1,0,0,1,-30,20]]){
      const config=existingSemanticsFor(render).configProvider.original;render.matrix=matrix;f.frame();assert.equal(existingSemanticsFor(render).configProvider.original,config);const geometry=nodes();render.markNeedsSemanticsUpdate();f.frame();assert.deepEqual(nodes(),geometry);
    }
  }finally{f.close();}
});

test('AnimatedBuilder geometry rebuilds coalesce while semantic content changes publish immediately',{timeout},()=>{
  const f=fixture({semanticsUpdateInterval:50}),position=new ValueNotifier(0),calls=[];
  const child=new Semantics({textDirection:'ltr',transportId:'animated-motion',label:'Original',container:true,onTap:()=>calls.push('tap'),child:new SizedBox(80,60)});
  const tree=(label=null)=>new ClipRect(new AnimatedBuilder({animation:position,child,builder:(_context,stable)=>new Transform(label===null?stable:new Semantics({textDirection:'ltr',transportId:'animated-motion',label,container:true,child:new SizedBox(80,60)}),[1,0,0,1,position.value,0])}));
  try{
    f.set(tree());let captures=0;const capture=f.root.sourceSemanticsSnapshot.capture.bind(f.root.sourceSemanticsSnapshot);f.root.sourceSemanticsSnapshot.capture=(...args)=>{captures++;return capture(...args);};
    const old=f.root.nodes.find(node=>node.id==='animated-motion');
    position.value=20;f.advance(16);position.value=40;f.advance(16);assert.equal(captures,0);assert.equal(f.root.nodes.find(node=>node.id==='animated-motion'),old);assert.notEqual(f.root.semanticsWake,undefined);
    f.advance(18);assert.equal(captures,1);assert.deepEqual(f.root.nodes.find(node=>node.id==='animated-motion').bounds,{x:40,y:0,width:200,height:160});
    position.value=60;f.advance(10);assert.equal(captures,1);const pending=f.root.nodes.find(node=>node.id==='animated-motion');pending.actions.activate();f.frame();assert.equal(captures,2);assert.deepEqual(calls,['tap']);assert.equal(f.root.nodes.find(node=>node.id==='animated-motion').bounds.x,60);
    position.value=80;f.advance(10);assert.equal(captures,2);f.set(tree('Changed'));assert.equal(captures,3);assert.equal(f.root.nodes.find(node=>node.id==='animated-motion').name,'Changed');assert.equal(f.root.semanticsWake,undefined);
  }finally{f.close();position.dispose();}
});

test('an instance semantic getter that becomes empty retires its old transform metadata',{timeout},()=>{
  const f=fixture();let render;
  class Carrier extends RenderObjectWidget{
    get childWidgets(){return [new SizedBox(80,60)];}
    createRenderObject(){render=new RenderTransform([1,0,0,1,0,0]);Object.defineProperty(render,'semanticsTransport',{get:()=>render.matrix[4]===0?{id:'dynamic-transform',role:'button',name:'At zero',enabled:true,actions:{activate(){}}}:null});return render;}
  }
  try{f.set(new Carrier());assert(f.root.nodes.some(node=>node.id==='dynamic-transform'));render.matrix=[1,0,0,1,20,0];f.frame();assert(!f.root.nodes.some(node=>node.id==='dynamic-transform'));}finally{f.close();}
});

test('custom transform and decoration semantics and paint hooks retain conservative invalidation',{timeout},()=>{
  const families=[
    {Base:RenderTransform,args:[[1,0,0,1,0,0]],read:r=>r.matrix[4],change:r=>r.matrix=[1,0,0,1,20,0]},
    {Base:RenderFractionalTranslation,args:[{translation:{x:0,y:0}}],read:r=>r.translation.dx,change:r=>r.translation={x:.5,y:0}},
    {Base:RenderDecoratedBox,args:[0xff000000],read:r=>r.decoration.color,change:r=>r.decoration=new BoxDecoration({color:0xffffffff})}
  ];
  for(const {Base,args,read,change}of families)for(const semantic of [true,false]){
    const f=fixture();let render;
    class Custom extends Base{
      invalidations=0;
      markNeedsPaint(){this.invalidations++;super.markNeedsPaint();}
      describeSemanticsConfiguration(config){super.describeSemanticsConfiguration(config);if(semantic){config.isSemanticBoundary=true;config.label='Value '+read(this);config.textDirection='ltr';}}
    }
    class Carrier extends RenderObjectWidget{get childWidgets(){return [new SizedBox(80,60)];}createRenderObject(){return render=new Custom(...args);}}
    try{
      f.set(new Carrier());const before=render.invalidations,previous='Value '+read(render);change(render);f.frame();assert(render.invalidations>before,Base.name);
      if(semantic){assert(f.root.nodes.some(node=>node.name==='Value '+read(render)));assert(!f.root.nodes.some(node=>node.name===previous));}
    }finally{f.close();}
  }
});

test('paint-only host snapshots reuse unchanged semantics and revoke actions on metadata, source and visibility changes',{timeout},()=>{
  const f=fixture(),calls=[];
  const tree=id=>new Semantics({textDirection:'ltr',transportId:id,label:'Stable',container:true,onTap:()=>calls.push(id),child:new SizedBox(80,60)});
  try{
    f.set(tree('old'));let captures=0;const capture=f.root.sourceSemanticsSnapshot.capture.bind(f.root.sourceSemanticsSnapshot);f.root.sourceSemanticsSnapshot.capture=(...args)=>{captures++;return capture(...args);};
    const old=f.root.nodes.find(node=>node.id==='old');f.frame();f.frame();assert.equal(captures,0);assert.equal(f.root.nodes.find(node=>node.id==='old'),old);old.actions.activate();assert.deepEqual(calls,['old']);
    f.set(tree('new'));assert(captures>0);assert(!f.root.nodes.some(node=>node.id==='old'));old.actions.activate();assert.deepEqual(calls,['old']);
    const current=f.root.nodes.find(node=>node.id==='new'),source=f.root.pipeline.semanticsOwner.getSemanticsNode(current.sourceNodeId),config=new SemanticsConfiguration();config.isSemanticBoundary=true;config.label='Direct source change';config.textDirection='ltr';config.onTap=()=>calls.push('source');source.updateWith({config,childrenInInversePaintOrder:[]});
    const before=captures;f.frame();assert(captures>before,'Direct node updates must bypass an otherwise clean render pipeline cache');assert.equal(f.root.nodes.find(node=>node.id==='new').name,'Direct source change');
    const visible=f.root.nodes.find(node=>node.id==='new');visible.actions.activate();assert.equal(calls.at(-1),'source');const length=calls.length;
    f.root.setVisible(false);visible.actions.activate();f.root.setVisible(true);visible.actions.activate();assert.equal(calls.length,length,'Visibility retirement must not revive an old action before repaint');f.frame();f.root.nodes.find(node=>node.id==='new').actions.activate();assert.equal(calls.length,length+1);
    const metrics=f.root.context.readMetrics(),last=captures;metrics.viewportGeneration++;f.frame();assert(captures>last,'View metrics changes must capture fresh transport data');
  }finally{f.close();}
});

test('input geometry providers and text-field semantics keep per-frame transport snapshots',{timeout},()=>{
  class Geometry extends RenderProxyBox{get coreEditingGeometry(){return {epoch:1,width:this.size.width,height:this.size.height,caret:{x:0,y:0,width:1,height:20},caretBaseline:{x:0,y:15},selectionRects:[]};}}
  class Carrier extends RenderObjectWidget{get childWidgets(){return [new SizedBox(80,60)];}createRenderObject(){return new Geometry();}}
  for(const child of [new Carrier(),new Semantics({textDirection:'ltr',label:'Field',textField:true,value:'text',child:new SizedBox(80,60)})]){
    const f=fixture({semanticsUpdateInterval:50});try{f.set(child);let captures=0;const capture=f.root.sourceSemanticsSnapshot.capture.bind(f.root.sourceSemanticsSnapshot);f.root.sourceSemanticsSnapshot.capture=(...args)=>{captures++;return capture(...args);};f.frame();f.frame();assert.equal(captures,2,'Input geometry and editable metadata retain their frame fences even with accessibility throttling');}finally{f.close();}
  }
});

test('accessibility motion updates coalesce to the latest frame and deliver a trailing snapshot',{timeout},()=>{
  FoundationPlatform.configure({kind:'native',operatingSystem:'windows'});
  const f=fixture({semanticsUpdateInterval:50}),scroll=new ScrollController(),actions=[];
  const tree=()=>new Directionality('ltr',ListView.builder({controller:scroll,primary:false,padding:EdgeInsets.zero,cacheExtent:500,itemCount:4,itemBuilder:(_context,index)=>new Semantics({textDirection:'ltr',transportId:'throttled-'+index,label:'Row '+index,container:true,onTap:()=>actions.push(index),child:new SizedBox(100,80)})}));
  try{
    f.set(tree());let captures=0;const capture=f.root.sourceSemanticsSnapshot.capture.bind(f.root.sourceSemanticsSnapshot);f.root.sourceSemanticsSnapshot.capture=(...args)=>{captures++;return capture(...args);};
    const old=f.root.nodes.find(node=>node.id==='throttled-0');
    f.root.scheduler.timeDilation=10;scroll.jumpTo(20);f.advance(16);assert.equal(captures,0);assert.equal(f.root.nodes.find(node=>node.id==='throttled-0'),old);assert(f.root.scheduler.hasScheduledFrame);assert.notEqual(f.root.semanticsWake,undefined);
    scroll.jumpTo(40);f.advance(16);assert.equal(captures,0);assert.notEqual(f.root.semanticsWake,undefined,'A trailing wake remains owned');
    f.advance(18);assert.equal(captures,1,'An idle final frame publishes at the interval boundary');assert.equal(f.root.semanticsWake,undefined);
    const latest=f.root.nodes.find(node=>node.id==='throttled-0');assert.deepEqual(latest.bounds,{x:0,y:0,width:240,height:40});latest.actions.activate();assert.deepEqual(actions,[0]);old.actions.activate();assert.deepEqual(actions,[0]);
    f.advance(10);assert.equal(captures,1,'Unchanged frames reuse the accepted snapshot');
    scroll.jumpTo(60);f.advance(5);assert.equal(captures,1);assert.notEqual(f.root.semanticsWake,undefined);
    const metrics=f.root.context.readMetrics();metrics.viewportGeneration++;f.frame();assert.equal(captures,2,'A new viewport bypasses the interval');assert.equal(f.root.semanticsWake,undefined);
    scroll.jumpTo(80);f.advance(5);assert.equal(captures,2);assert.notEqual(f.root.semanticsWake,undefined);
    f.set(tree());assert.equal(captures,3,'A widget rebuild bypasses the interval');assert.equal(f.root.semanticsWake,undefined);
    scroll.jumpTo(100);f.advance(5);assert.notEqual(f.root.semanticsWake,undefined);const before=captures;
    f.root.setVisible(false);assert.equal(f.root.semanticsWake,undefined);f.root.setVisible(true);f.frame();assert.equal(captures,before+1,'Showing a View publishes fresh semantics immediately');
    scroll.jumpTo(120);f.advance(5);assert.notEqual(f.root.semanticsWake,undefined);
    const source=f.root.pipeline.semanticsOwner.getSemanticsNode(f.root.nodes.find(node=>node.id==='throttled-2').sourceNodeId),config=new SemanticsConfiguration();config.isSemanticBoundary=true;config.label='Direct source update';config.textDirection='ltr';source.updateWith({config,childrenInInversePaintOrder:[]});
    const direct=captures;f.frame();assert.equal(captures,direct+1,'Direct source node updates bypass the interval');assert.equal(f.root.semanticsWake,undefined);
    scroll.jumpTo(140);f.advance(5);assert.notEqual(f.root.semanticsWake,undefined);
  }finally{f.close();scroll.dispose();}
  assert.equal(f.root.scheduler.transientCallbackCount,0,'View disposal cancels its pending wake');
});

test('an action from the deferred snapshot requests fresh geometry and runs once only while its source stays visible',{timeout},()=>{
  FoundationPlatform.configure({kind:'native',operatingSystem:'windows'});
  const f=fixture({semanticsUpdateInterval:50}),scroll=new ScrollController(),calls=[];
  const tree=()=>new Directionality('ltr',ListView.builder({controller:scroll,primary:false,padding:EdgeInsets.zero,cacheExtent:500,itemCount:5,itemBuilder:(_context,index)=>new Semantics({textDirection:'ltr',transportId:'action-'+index,label:'Row '+index,container:true,onTap:()=>calls.push(index),child:new SizedBox(100,80)})}));
  try{
    f.set(tree());const old=f.root.nodes.find(node=>node.id==='action-0');scroll.jumpTo(20);f.advance(10);old.actions.activate();old.actions.activate();assert.deepEqual(calls,[]);
    f.frame();assert.deepEqual(calls,[0],'The request bypasses the remaining interval and invokes the fresh action once');assert.equal(f.root.semanticsWake,undefined);f.frame();assert.deepEqual(calls,[0,0],'Queued actions preserve FIFO across fresh frames');old.actions.activate();assert.deepEqual(calls,[0,0],'A superseded generation cannot queue again');
    const moved=f.root.nodes.find(node=>node.id==='action-0');scroll.jumpTo(40);f.advance(10);moved.actions.activate();scroll.jumpTo(160);f.frame();assert.deepEqual(calls,[0,0],'A source clipped before the requested publication cannot receive the old action');
    const visible=f.root.nodes.find(node=>node.id==='action-2');scroll.jumpTo(180);f.advance(10);visible.actions.activate();f.set(new SizedBox());assert.deepEqual(calls,[0,0],'Removing the source retires its queued request');
    f.set(tree());const closing=f.root.nodes.find(node=>node.id.startsWith('action-'));scroll.jumpTo(scroll.offset+10);f.advance(10);closing.actions.activate();f.root.setVisible(false);f.root.setVisible(true);f.frame();assert.deepEqual(calls,[0,0],'Hiding cancels the pending request');
  }finally{f.close();scroll.dispose();}
});

test('deferred absolute values request fresh geometry and retain their original range and live source',{timeout},()=>{
  FoundationPlatform.configure({kind:'native',operatingSystem:'windows'});
  const f=fixture({semanticsUpdateInterval:50}),scroll=new ScrollController(),calls=[],range={min:0,max:100,value:25};
  const tree=()=>new Directionality('ltr',ListView.builder({controller:scroll,primary:false,padding:EdgeInsets.zero,cacheExtent:500,itemCount:5,itemBuilder:(_context,index)=>new Semantics({textDirection:'ltr',transportId:'range-'+index,label:'Range '+index,slider:true,enabled:true,container:true,onIncrease(){},onDecrease(){},transportRange:range,transportRangeActions:{setValue:value=>calls.push([index,value])},child:new SizedBox(100,80)})}));
  try{
    f.set(tree());const first=f.root.nodes.find(node=>node.id==='range-0');scroll.jumpTo(20);f.advance(10);first.rangeActions.setValue(37.5);assert.deepEqual(calls,[]);f.frame();assert.deepEqual(calls,[[0,37.5]],'An accepted absolute value must wake the deferred publication');f.frame();first.rangeActions.setValue(40);assert.deepEqual(calls,[[0,37.5]],'A superseded generation cannot queue another value');
    const moved=f.root.nodes.find(node=>node.id==='range-0');scroll.jumpTo(40);f.advance(10);moved.rangeActions.setValue(45);scroll.jumpTo(160);f.frame();assert.deepEqual(calls,[[0,37.5]],'Clipping the source cancels its queued value');
    const visible=f.root.nodes.find(node=>node.id==='range-2');scroll.jumpTo(180);f.advance(10);visible.rangeActions.setValue(55);range.value=50;f.set(tree());assert.deepEqual(calls,[[0,37.5]],'A newer accepted numeric value revokes the old request');
    const current=f.root.nodes.find(node=>node.id==='range-2');scroll.jumpTo(200);f.advance(10);current.rangeActions.setValue(65);f.root.setVisible(false);f.root.setVisible(true);f.frame();assert.deepEqual(calls,[[0,37.5]],'Hiding the owning View cancels deferred absolute values');
  }finally{f.close();scroll.dispose();}
});

test('unready offstage geometry preserves snapshot reuse and materializing it captures the new controls',{timeout},()=>{
  const f=fixture(),calls=[];
  const button=id=>new Semantics({textDirection:'ltr',transportId:id,label:id,container:true,onTap:()=>calls.push(id),child:new SizedBox(80,60)});
  const tree=hidden=>new Row([button('visible'),new Offstage(button('hidden'),{offstage:hidden})]);
  try{
    f.set(tree(true));assert(existingPipelineSemantics(f.root.pipeline).deferredGeometry.size>0,'The hidden branch must exercise deferred geometry');assert(!f.root.nodes.some(node=>node.id==='hidden'));
    let captures=0;const capture=f.root.sourceSemanticsSnapshot.capture.bind(f.root.sourceSemanticsSnapshot);f.root.sourceSemanticsSnapshot.capture=(...args)=>{captures++;return capture(...args);};
    const visible=f.root.nodes.find(node=>node.id==='visible');f.frame();f.frame();assert.equal(captures,0,'Unready future geometry does not change this published tree');visible.actions.activate();assert.deepEqual(calls,['visible']);
    f.set(tree(false));assert(captures>0);const shown=f.root.nodes.find(node=>node.id==='hidden');assert(shown);shown.actions.activate();assert.deepEqual(calls,['visible','hidden']);visible.actions.activate();assert.deepEqual(calls,['visible','hidden']);
  }finally{f.close();}
});

test('stable sliver scrolling preserves semantic configurations and refreshes clip, membership and actions',{timeout},()=>{
  FoundationPlatform.configure({kind:'native',operatingSystem:'windows'});
  const f=fixture(),scroll=new ScrollController(),actions=[];
  const tree=(count=3,height=80)=>new Directionality('ltr',ListView.builder({controller:scroll,primary:false,padding:EdgeInsets.zero,cacheExtent:500,itemCount:count,itemBuilder:(_context,index)=>new Semantics({textDirection:'ltr',transportId:'scroll-row-'+index,label:'Row '+index,container:true,onTap:()=>actions.push(index),child:new SizedBox(100,height)})}));
  try{
    f.set(tree());const configurations=[];
    const visit=render=>{if(render instanceof RenderSliver||render instanceof RenderViewportBase){const state=existingSemanticsFor(render);if(state)configurations.push([render,state.configProvider.original]);}render.visitChildren(visit);};visit(f.root.pipeline.root);
    assert(configurations.length>=2);assert(!f.root.nodes.some(node=>node.id==='scroll-row-2'));
    scroll.jumpTo(20);f.frame();
    for(const [render,config]of configurations)assert.equal(existingSemanticsFor(render).configProvider.original,config,'Unchanged configuration: '+render.constructor.name);
    assert.deepEqual(f.root.nodes.find(node=>node.id==='scroll-row-0').bounds,{x:0,y:0,width:240,height:60});
    const entering=f.root.nodes.find(node=>node.id==='scroll-row-2');assert(entering);assert.deepEqual(entering.bounds,{x:0,y:140,width:240,height:20});entering.actions.activate();assert.deepEqual(actions,[2]);
    f.set(tree(4,100));scroll.jumpTo(240);f.frame();const added=f.root.nodes.find(node=>node.id==='scroll-row-3');assert(added);added.actions.activate();assert.deepEqual(actions,[2,3]);
    f.set(tree(2,100));f.frame();assert(!f.root.nodes.some(node=>node.id==='scroll-row-3'));added.actions.activate();assert.deepEqual(actions,[2,3],'Removed source actions must remain retired');
    scroll.jumpTo(0);f.frame();assert.equal(f.root.nodes.find(node=>node.id==='scroll-row-0').bounds.height,100);
  }finally{f.close();scroll.dispose();}
});

test('custom sliver semantic configurations and paint invalidation keep their layout contracts',{timeout},()=>{
  FoundationPlatform.configure({kind:'native',operatingSystem:'windows'});
  class SemanticSliver extends RenderSliverList {
    position=0;
    performLayout(constraints){super.performLayout(constraints);this.position=constraints.scrollOffset;}
    describeSemanticsConfiguration(config){super.describeSemanticsConfiguration(config);config.isSemanticBoundary=true;config.label='Position '+this.position;config.textDirection='ltr';}
  }
  class PaintedSliver extends RenderSliverList {invalidations=0;markNeedsPaint(){this.invalidations++;super.markNeedsPaint();}}
  for(const Type of [SemanticSliver,PaintedSliver]){
    const f=fixture(),scroll=new ScrollController();let render;
    class CustomList extends SliverList{createRenderObject(context){return render=new Type({childManager:context});}}
    try{
      f.set(new Directionality('ltr',new CustomScrollView({controller:scroll,primary:false,cacheExtent:500,slivers:[new CustomList({delegate:new SliverChildListDelegate(Array.from({length:3},()=>new SizedBox(100,100)))})]})));
      const before=render.invalidations;if(Type===SemanticSliver)assert(f.root.nodes.some(node=>node.name==='Position 0'));
      scroll.jumpTo(20);f.frame();
      if(Type===SemanticSliver){assert(f.root.nodes.some(node=>node.name==='Position 20'));assert(!f.root.nodes.some(node=>node.name==='Position 0'));}
      else assert(render.invalidations>before,'A custom paint invalidation must still be invoked after layout');
    }finally{f.close();scroll.dispose();}
  }
});

test('box translation composes directly into affine and perspective source transforms',{timeout},()=>{
  const parent=new RenderProxyBox(),child=new RenderProxyBox();parent.child=child;
  try{for(const source of [Matrix4.identity(),Matrix4.rotationZ(.37),Matrix4.fromList([1,0,.2,.001,0,2,0,-.002,0,0,3,0,7,11,13,1])])for(const [x,y]of [[0,0],[12,-7],[.125,.375]]){
    child.layoutOffset={x,y};const actual=source.clone(),expected=source.clone();expected.multiply(Matrix4.translationValues(x,y,0));parent.applyPaintTransform(child,actual);assert.deepEqual(actual.storage,expected.storage);
  }}finally{parent.child=null;child.dispose();parent.dispose();}
});
test('Translated semantics clips match general 3D inversion through visible, partial and fully clipped positions',{timeout},()=>{
  const f=fixture(),child=new Semantics({textDirection:'ltr',transportId:'moving',label:'moving',container:true,child:new SizedBox(80,60)});
  const tree=(x,y,z)=>new ClipRect(new Transform(child,[1,0,0,0,0,1,0,0,0,0,z,0,x,y,0,1]));
  try{for(const [x,y]of [[0,0],[20,30],[-20,-30],[200,140],[-300,0],[0,-300],[.125,-.375],[-0,0]]){f.set(tree(x,y,1));const translated=f.root.nodes.map(({bounds,name})=>({bounds,name}));f.set(tree(x,y,2));assert.deepEqual(f.root.nodes.map(({bounds,name})=>({bounds,name})),translated,[x,y].join(','));}}finally{f.close();}
});

test('offset-only motion updates clipped bounds and visibility without recalculating semantic configurations',{timeout},()=>{
  const f=fixture();let viewport,configurations=0,activated=0;
  class MovingViewport extends RenderProxyBox {
    get clips(){return true;}
    performLayout(constraints){this.child.layout(BoxConstraints.tight({width:80,height:60}),{parentUsesSize:true});return constraints.biggest;}
  }
  class Viewport extends RenderObjectWidget {
    get childWidgets(){return [new Semantics({textDirection:'ltr',transportId:'moving',label:'moving',container:true,onTap:()=>activated++,child:new SizedBox(80,60)})];}
    createRenderObject(){return viewport=new MovingViewport();}
  }
  try{
    f.set(new Viewport());
    const watch=render=>{const original=render.describeSemanticsConfiguration;render.describeSemanticsConfiguration=function(config){configurations++;return original.call(this,config);};render.visitChildren(watch);};watch(viewport);
    const source=f.root.nodes.find(node=>node.id==='moving').sourceNodeId;
    for(const [x,y,expected]of [[20,10,{x:20,y:10,width:80,height:60}],[-20,-10,{x:0,y:0,width:60,height:50}],[300,0,null],[10,10,{x:10,y:10,width:80,height:60}]]){
      viewport.child.layoutOffset={x,y};f.frame();const node=f.root.nodes.find(node=>node.id==='moving');
      if(expected){assert.deepEqual(node.bounds,expected);assert.equal(node.sourceNodeId,source);node.actions.activate();}else assert.equal(node,undefined);
    }
    assert.equal(activated,3);assert.equal(configurations,0,'Moving already laid-out content must preserve its semantic configuration');
  }finally{f.close();}
});

test('sibling semantics reuse shared render paths within a flush and refresh them on the next frame',{timeout},()=>{
  const f=fixture(),shared=[];
  class SharedPath extends RenderObjectWidget {
    constructor(child){super();this.child=child;}
    get childWidgets(){return [this.child];}
    createRenderObject(){const render=new RenderProxyBox();shared.push(render);return render;}
  }
  let tree=new Row(Array.from({length:10},(_,i)=>new Semantics({textDirection:'ltr',transportId:'sibling-'+i,label:'Sibling '+i,container:true,child:new SizedBox(10,20)})));
  for(let i=0;i<10;i++)tree=new SharedPath(tree);
  try{
    f.set(new ClipRect(tree));const initial=f.root.nodes.map(({id,sourceNodeId,bounds})=>({id,sourceNodeId,bounds}));assert.equal(initial.length,10);
    let transforms=0;const render=shared[2],original=render.applyPaintTransform.bind(render);render.applyPaintTransform=(...args)=>{transforms++;original(...args);};
    for(const x of [3,-13,233,0]){
      transforms=0;shared[0].child.layoutOffset={x,y:0};f.frame();
      assert.equal(transforms,1,'The shared edge must be composed once, independent of sibling count');
      const expected=initial.map(node=>{const left=Math.max(0,node.bounds.x+x),right=Math.min(240,node.bounds.x+x+node.bounds.width);return {...node,bounds:{...node.bounds,x:left,width:Math.max(0,right-left)}};}).filter(node=>node.bounds.width>0);
      assert.deepEqual(f.root.nodes.map(({id,sourceNodeId,bounds})=>({id,sourceNodeId,bounds})),expected);
    }
  }finally{f.close();}
});

test('input geometry avoids ancestor visibility queries for non-editor branches and preserves commit hooks',{timeout},()=>{
  const f=fixture();let visibility=0,commits=0;
  class NonEditor extends RenderProxyBox {
    get isDisplayed(){visibility++;return super.isDisplayed;}
    didCommitTextInputGeometry(){commits++;}
  }
  class Branch extends RenderObjectWidget {
    constructor(child){super();this.child=child;}
    get childWidgets(){return [this.child];}
    createRenderObject(){return new NonEditor();}
  }
  let tree=new SizedBox(20,20);for(let i=0;i<20;i++)tree=new Branch(tree);
  try{f.set(tree);visibility=commits=0;f.frame();assert.equal(visibility,0);assert.equal(commits,20);}finally{f.close();}
});

test('input geometry skips ordinary subtrees and tracks hook insertion, removal and reparenting',{timeout},()=>{
  const f=fixture();let visits=0,commits=0;
  class Hook extends RenderProxyBox{didCommitTextInputGeometry(){commits++;}}
  class Branch extends RenderObjectWidget{get childWidgets(){return [new SizedBox(20,20)];}createRenderObject(){return new Hook();}}
  const visit=RenderObject.prototype.visitChildren;
  const capture=()=>{visits=commits=0;RenderObject.prototype.visitChildren=function(callback){visits++;return visit.call(this,callback);};try{f.root.pipeline.root.commitTextInputGeometries({owner:f.root.context.owner,metrics:f.root.context.readMetrics()}).commit();}finally{RenderObject.prototype.visitChildren=visit;}};
  try{
    f.set(new SizedBox(20,20));capture();assert.equal(visits,0);assert.equal(commits,0);
    f.set(new Row([new Branch(),new SizedBox(20,20)]));capture();assert.equal(commits,1);assert(visits>0);
    const key=new GlobalKey(),branch=new Branch(key);
    f.set(new Row([new SizedBox(40,40,branch),new SizedBox(40,40)]));const render=key.currentContext.findRenderObject();
    f.set(new Row([new SizedBox(40,40),new SizedBox(40,40,branch)]));assert.equal(key.currentContext.findRenderObject(),render);capture();assert.equal(commits,1,'Reparented hooks must remain registered exactly once');
    f.set(new SizedBox(20,20));capture();assert.equal(visits,0);assert.equal(commits,0,'Removed hooks must not keep their former ancestors in the geometry walk');
  }finally{RenderObject.prototype.visitChildren=visit;f.close();}
});

test('input geometry traversal restores sibling visibility and still notifies hidden commit hooks',{timeout},()=>{
  const f=fixture(),renders=new Map(),reads=[],commits=[];
  class Probe extends RenderProxyBox{
    constructor(name){super();this.name=name;this.maskLayout=false;}
    get needsLayout(){return this.maskLayout||super.needsLayout;}
    get coreEditingGeometry(){reads.push(this.name);return null;}
    didCommitTextInputGeometry(){commits.push(this.name);}
  }
  class Branch extends RenderObjectWidget{
    constructor(name,child){super();this.name=name;this.child=child;}
    get childWidgets(){return [this.child];}
    createRenderObject(){const render=new Probe(this.name);renders.set(this.name,render);return render;}
  }
  try{f.set(new Row([new Branch('hidden',new Branch('hidden-child',new SizedBox(20,20))),new Branch('shown',new Branch('shown-child',new SizedBox(20,20)))]));reads.length=commits.length=0;renders.get('hidden').maskLayout=true;
    const frame={owner:f.root.context.owner,metrics:f.root.context.readMetrics()},hidden=f.root.pipeline.root.commitTextInputGeometries(frame);assert.deepEqual(reads,['shown','shown-child']);assert.equal(hidden.hasInputGeometry,false);hidden.commit();assert.deepEqual(commits,['hidden','hidden-child','shown','shown-child']);
    renders.get('hidden').maskLayout=false;reads.length=0;f.root.pipeline.root.commitTextInputGeometries(frame).commit();assert.deepEqual(reads,['hidden','hidden-child','shown','shown-child']);
  }finally{for(const render of renders.values())render.maskLayout=false;f.close();}
});

test('transport indexes produced source nodes without rescanning non-semantic render branches and preserves staged action generations',{timeout},()=>{
  const f=fixture();let reads=0,oldCalls=0,newCalls=0;
  class NonSemantic extends RenderProxyBox{get semanticsTransport(){reads++;return null;}}
  class Branch extends RenderObjectWidget{constructor(child){super();this.child=child;}get childWidgets(){return [this.child];}createRenderObject(){return new NonSemantic();}}
  const tree=callback=>{let child=new Semantics({textDirection:'ltr',transportId:'indexed',label:'Indexed',container:true,onTap:callback,child:new SizedBox(20,20)});for(let i=0;i<20;i++)child=new Branch(child);return child;};
  try{
    f.set(tree(()=>oldCalls++));const index=existingPipelineSemantics(f.root.pipeline).transportSources,source=[...index].find(render=>render.semanticsTransport?.id==='indexed'),snapshot=f.root.sourceSemanticsSnapshot;
    assert(source);const initial=f.root.nodes.find(node=>node.id==='indexed'),sourceId=initial.sourceNodeId,visit=RenderObject.prototype.visitChildren;let visits=0,candidate;
    reads=0;RenderObject.prototype.visitChildren=function(callback){visits++;return visit.call(this,callback);};
    try{candidate=snapshot.capture(f.root.pipeline.root,f.root.pipeline.root.localTransform);}finally{RenderObject.prototype.visitChildren=visit;}
    assert.equal(visits,0);assert(reads<=1,'Only the produced root fragment may read non-semantic transport metadata');assert.equal(candidate.nodes[0].sourceNodeId,sourceId);
    initial.actions.activate();assert.equal(oldCalls,1,'An uncommitted capture does not retire the current action');candidate.commit();initial.actions.activate();assert.equal(oldCalls,1);candidate.nodes[0].actions.activate();assert.equal(oldCalls,2);
    snapshot.invalidate();candidate.nodes[0].actions.activate();assert.equal(oldCalls,2);f.set(tree(()=>newCalls++));const current=f.root.nodes.find(node=>node.id==='indexed');assert.equal(current.sourceNodeId,sourceId);current.actions.activate();assert.equal(newCalls,1);assert.equal(oldCalls,2);
    f.set(new SizedBox(20,20));assert.equal(index.has(source),false);current.actions.activate();assert.equal(newCalls,1);assert(!f.root.nodes.some(node=>node.id==='indexed'));
  }finally{f.close();}
});

test('a virtual child visitor can recover a failed geometry walk before continuing its sibling',{timeout},()=>{
  const f=fixture(),reads=[],commits=[],renders=new Map();
  class Probe extends RenderProxyBox{
    constructor(name){super();this.name=name;this.maskLayout=false;this.failVisit=false;}
    get needsLayout(){return this.maskLayout||super.needsLayout;}
    get coreEditingGeometry(){reads.push(this.name);return null;}
    didCommitTextInputGeometry=()=>commits.push(this.name);
    visitChildren(visitor){if(this.failVisit)throw Error('input-test-child');super.visitChildren(visitor);}
  }
  class Recovery extends RenderProxyBox{
    visitChildren(visitor){try{super.visitChildren(visitor);}catch(error){assert.equal(error.message,'input-test-child');this.child.maskLayout=false;this.child.failVisit=false;visitor(this.child);}}
  }
  class Branch extends RenderObjectWidget{
    constructor(name){super();this.name=name;}
    get childWidgets(){return [new SizedBox(20,20)];}
    createRenderObject(){const render=new Probe(this.name);renders.set(this.name,render);return render;}
  }
  class Recovering extends RenderObjectWidget{
    get childWidgets(){return [new Branch('recovered')];}
    createRenderObject(){return new Recovery();}
  }
  try{
    f.set(new Row([new Recovering(),new Branch('sibling')]));reads.length=commits.length=0;
    renders.get('recovered').maskLayout=true;renders.get('recovered').failVisit=true;
    const pending=f.root.pipeline.root.commitTextInputGeometries({owner:f.root.context.owner,metrics:f.root.context.readMetrics()});
    assert.deepEqual(reads,['recovered','sibling']);assert.equal(pending.hasInputGeometry,false);pending.commit();
    assert.deepEqual(commits,['recovered','recovered','sibling'],'Retain the virtual visitor callback order, including its deliberate retry');
  }finally{for(const render of renders.values()){render.maskLayout=false;render.failVisit=false;}f.close();}
});
