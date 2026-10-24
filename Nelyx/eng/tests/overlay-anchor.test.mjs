// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';
import {Overlay,OverlayEntry} from '@nelyx/core/framework/widgets/overlay';
import {CompositedTransformTarget,CompositedTransformFollower} from '@nelyx/core/framework/widgets/composited-transform';
import {LayerLink,LayerHandle} from '@nelyx/core/framework/rendering/layer';
import {Alignment} from '@nelyx/core/framework/painting/alignment';
import {Builder,Stack,Positioned,SizedBox} from '@nelyx/core/framework/widgets/basic';
import {StatefulWidget,State,RenderObjectWidget} from '@nelyx/core/framework/widgets/framework';
import {RenderProxyBox} from '@nelyx/core/framework/rendering/boxes';
import {RenderFollowerLayer} from '@nelyx/core/framework/rendering/proxy-layer';
import {Directionality} from '@nelyx/core/framework/widgets/app-data';
import {ControlInteraction} from '@nelyx/core/framework/widgets/control-interaction';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {fixture} from '../../../packages/material/tests/root-fixture.mjs';
const timeout=1_200_000;
FoundationPlatform.configure({kind:'native',operatingSystem:'windows'});

test('anchored overlay hit/semantics track the composed leader, viewport clip and unlink retirement',{timeout},()=>{
  const f=fixture(),link=new LayerLink();let owner,x=20,y=30,linked=true,clicks=0,popupDisposed=false;
  const base=new OverlayEntry({builder:context=>{owner=Overlay.of(context);return new Stack(linked?[new Positioned(new CompositedTransformTarget(new SizedBox(40,20),{link}),{left:x,top:y,width:40,height:20})]:[],{fit:'expand'});}});
  const popup=new OverlayEntry({builder:()=>new Stack([new Positioned(new CompositedTransformFollower(new ControlInteraction(()=>SizedBox.expand(),{onPressed:()=>clicks++,semantics:{transportId:'anchored-popup',button:true,label:'Popup'}}),{link,showWhenUnlinked:false,targetAnchor:Alignment.bottomLeft}),{left:0,top:0,width:80,height:40})],{fit:'expand'})});
  try{f.set(new Directionality('ltr',new Overlay({initialEntries:[base]})));owner.insert(popup);f.frame();
    assert.deepEqual(f.root.nodes.find(n=>n.id==='anchored-popup').bounds,{x:20,y:50,width:80,height:40});f.tap('anchored-popup');assert.equal(clicks,1);
    let captures=0;const capture=f.root.sourceSemanticsSnapshot.capture.bind(f.root.sourceSemanticsSnapshot);f.root.sourceSemanticsSnapshot.capture=(...args)=>{captures++;return capture(...args);};f.frame();f.frame();assert.equal(captures,0,'A stationary follower must retain the paint-only semantics cache');
    x=210;y=110;base.markNeedsBuild();f.frame();const clipped=f.root.nodes.find(n=>n.id==='anchored-popup');assert.deepEqual(clipped.bounds,{x:210,y:130,width:30,height:30});f.tap('anchored-popup');assert.equal(clicks,2);
    linked=false;base.markNeedsBuild();f.frame();assert(!f.root.nodes.some(n=>n.id==='anchored-popup'));clipped.actions.activate();assert.equal(clicks,2);
    popup.remove();popup.dispose();popupDisposed=true;f.frame();assert.equal(popup.mounted,false);
  }finally{f.close();if(!popupDisposed)popup.dispose();base.dispose();}
});

test('nested overlay lookup, opaque coverage and maintained State share the actual entry owner',{timeout},()=>{
  const f=fixture();let root,nearest,created=0,disposed=0,clicks=0,coverDisposed=false;
  class Marker extends StatefulWidget{createState(){return new MarkerState();}}
  class MarkerState extends State{
    initState(){super.initState();created++;}
    build(){return new ControlInteraction(()=>SizedBox.expand(),{onPressed:()=>clicks++,semantics:{transportId:'maintained-overlay',button:true,label:'Maintained'}});}
    dispose(){disposed++;super.dispose();}
  }
  const inner=new OverlayEntry({maintainState:true,builder:context=>{nearest=Overlay.of(context);root=Overlay.of(context,{rootOverlay:true});return new Marker();}});
  const outer=new OverlayEntry({maintainState:true,builder:()=>new Overlay({initialEntries:[inner]})});
  const cover=new OverlayEntry({opaque:true,builder:()=>new SizedBox()});
  try{f.set(new Directionality('ltr',new Overlay({initialEntries:[outer]})));assert(nearest!==root);assert.equal(inner.overlay,nearest);assert.equal(outer.overlay,root);assert.equal(created,1);
    const stale=f.root.nodes.find(n=>n.id==='maintained-overlay');root.insert(cover);f.frame();assert.equal(root.debugIsVisible(outer),false);assert(inner.mounted);assert.equal(disposed,0);assert(!f.root.nodes.some(n=>n.id==='maintained-overlay'));stale.actions.activate();assert.equal(clicks,0);
    cover.remove();cover.dispose();coverDisposed=true;f.frame();assert.equal(created,1);assert(f.root.nodes.some(n=>n.id==='maintained-overlay'));f.tap('maintained-overlay');assert.equal(clicks,1);stale.actions.activate();assert.equal(clicks,1);
  }finally{f.close();assert.equal(disposed,1);for(const entry of [inner,outer])entry.dispose();if(!coverDisposed)cover.dispose();}
});

test('a follower whose first paint fails observes composition after retry and releases its callback on close',{timeout},()=>{
  const f=fixture(),link=new LayerLink();let owner,x=20,fail=true,hold;
  class FailBox extends RenderProxyBox{paint(context){if(fail){fail=false;throw Error('expected follower paint failure');}super.paint(context);}}
  class FailWidget extends RenderObjectWidget{get childWidgets(){return [];}createRenderObject(){return new FailBox();}}
  const base=new OverlayEntry({builder:context=>{owner=Overlay.of(context);return new Stack([new Positioned(new CompositedTransformTarget(new SizedBox(40,20),{link}),{left:x,top:30,width:40,height:20})],{fit:'expand'});}});
  const popup=new OverlayEntry({builder:()=>new Stack([new Positioned(new CompositedTransformFollower(new ControlInteraction(()=>new FailWidget(),{semantics:{transportId:'retry-popup',button:true,label:'Retry'},onPressed:()=>{}}),{link,offset:{x:0,y:20}}),{left:0,top:0,width:80,height:40})],{fit:'expand'})});
  try{f.set(new Directionality('ltr',new Overlay({initialEntries:[base]})));owner.insert(popup);assert.throws(()=>f.frame(),/expected follower paint failure/);f.frame();const pending=[f.root.pipeline.root];while(pending.length){const render=pending.pop();if(render instanceof RenderFollowerLayer){hold=new LayerHandle(render.layer);break;}pending.push(...render.children);}assert(hold);x=120;base.markNeedsBuild();f.frame();assert.equal(f.root.nodes.find(n=>n.id==='retry-popup').bounds.x,120);}
  finally{try{f.close();popup.dispose();base.dispose();if(hold){assert.equal(hold.layer.debugDisposed,false);assert.equal(hold.layer.subtreeHasCompositionCallbacks,false);}}finally{hold?.dispose();}}
});
