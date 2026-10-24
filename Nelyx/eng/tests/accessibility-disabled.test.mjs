// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from '../../../packages/material/tests/root-fixture.mjs';
import {engineFixture} from '../../../packages/material/tests/engine-fixture.mjs';
import {EditableText,TextEditingController} from '@nelyx/core/framework/widgets/editable-text';
import {ReactNativeInteraction} from '../../sdk/dist/backends/react-native/interaction.js';
import {widgetApplication} from '@nelyx/core/framework/widgets/root';
import {SizedBox,Align} from '@nelyx/core/framework/widgets/basic';
import {Semantics} from '@nelyx/core/framework/widgets/semantics';
import {SemanticsBinding} from '@nelyx/core/framework/semantics/binding';
import {SemanticsProperties} from '@nelyx/core/framework/semantics/semantics';
import {RenderSemanticsAnnotations} from '@nelyx/core/framework/rendering/semantics-annotations';
import {PipelineOwner} from '@nelyx/core/framework/rendering/object';
import {ControlInteraction} from '@nelyx/core/framework/widgets/control-interaction';
import {AppFocus} from '@nelyx/core/framework/widgets/app-focus';
import {FocusNode} from '@nelyx/core/framework/widgets/focus';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {AccessibilityFeatures} from '@nelyx/core/ui/accessibility-features';
import {SemanticsAction,SemanticsActionEvent} from '@nelyx/core/ui/semantics-action';
import {JSONMethodCodec} from '@nelyx/core/services/message-codecs';
import {MethodCall} from '@nelyx/core/services/message-codec';
import {createBrowserPlatformMessages} from '../../sdk/dist/backends/browser/platform-messages.js';
import {createReactNativePlatformMessages} from '../../sdk/dist/backends/react-native/platform-messages.js';

const timeout=1_200_000;
FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});
const forbidden=()=>{throw new Error('Accessibility work ran while disabled');};
const annotation=()=>new Semantics(new SizedBox(80,32),{id:'control',role:'button',name:'Run',enabled:true});

test('startup opt-out preserves painting and skips the complete semantics frame path',{timeout},()=>{
  const enabled=fixture(),disabled=fixture({accessibilityEnabled:false});
  try{
    const normal=enabled.set(annotation());
    disabled.root.pipeline.flushSemantics=forbidden;
    disabled.root.context.semantics={capability:'native-controls',bind:forbidden};
    const off=disabled.set(annotation());
    assert.deepEqual(off,normal);
    assert.equal(enabled.root.nodes.length,1);
    assert.deepEqual(disabled.root.nodes,[]);
    assert.equal(disabled.root.pipeline.semanticsOwner,null);
    const render=disabled.root.pipeline.rootNode;
    render.describeSemanticsConfiguration=forbidden;
    let frames=0;const request=disabled.root.scheduler.requestFrame;
    disabled.root.scheduler.requestFrame=()=>frames++;
    try{render.markNeedsSemanticsUpdate();assert.equal(frames,0);}
    finally{disabled.root.scheduler.requestFrame=request;}
    render.markNeedsPaint();disabled.frame();
    disabled.root.setVisible(false);disabled.root.setVisible(true);disabled.frame();
    assert.equal(disabled.root.pipeline.semanticsOwner,null);
    assert.deepEqual(disabled.root.nodes,[]);
    assert.equal(widgetApplication({id:'off',accessibilityEnabled:false,createRoot:()=>new SizedBox(1,1)}).accessibilityEnabled,false);
  }finally{disabled.close();enabled.close();}
});

test('explicit framework and pipeline handles cannot override the opt-out or subscribe to the OS',{timeout},()=>{
  const binding=new SemanticsBinding({accessibilityEnabled:false,dispatcher:new Proxy({},{get:forbidden})});
  const pipeline=new PipelineOwner({accessibilityEnabled:false,onSemanticsUpdate:forbidden,onNeedVisualUpdate:forbidden});
  try{
    const frameworkHandle=binding.ensureSemantics(),pipelineHandle=pipeline.ensureSemantics({listener:forbidden});
    pipeline.enableSemantics({onSemanticsUpdate:forbidden});
    binding.addAccessibilityFeaturesChangedListener(forbidden);
    binding.handleAccessibilityFeaturesChanged();
    binding.addSemanticsActionListener(forbidden);
    binding.handleSemanticsActionEvent(new SemanticsActionEvent({type:SemanticsAction.tap,nodeId:1,viewId:1,arguments:new Uint8Array([255])}),forbidden);
    assert.equal(binding.accessibilityFeatures.equals(AccessibilityFeatures.fromBits(0)),true);
    assert.equal(binding.semanticsEnabled,false);
    assert.equal(binding.debugOutstandingSemanticsHandles,0);
    assert.equal(pipeline.semanticsOwner,null);
    assert.equal(pipeline.debugOutstandingSemanticsHandles,0);
    frameworkHandle.dispose();pipelineHandle.dispose();
  }finally{pipeline.dispose();binding.dispose();}
});

test('disabled bindings do not interfere with another View using the same dispatcher',{timeout},()=>{
  const trees=[];let observers=0;
  const dispatcher={accessibilityFeatures:AccessibilityFeatures.fromBits(52),semanticsEnabled:true,
    observeAccessibility(){observers++;return ()=>observers--;},setSemanticsTreeEnabled:value=>trees.push(value),onClosing:()=>()=>{}};
  const enabled=new SemanticsBinding({dispatcher,viewId:1}),disabled=new SemanticsBinding({dispatcher,viewId:2,accessibilityEnabled:false});
  try{
    assert.equal(observers,1);assert(enabled.semanticsEnabled);
    assert.equal(disabled.semanticsEnabled,false);disabled.dispose();
    assert(enabled.semanticsEnabled);assert.deepEqual(trees,[true]);
  }finally{disabled.dispose();enabled.dispose();}
  assert.equal(observers,0);assert.deepEqual(trees,[true,false]);
});

test('annotation strings are prepared only when a semantics configuration is actually requested',{timeout},()=>{
  const properties=new Proxy(new SemanticsProperties({label:'Unused'}),{get(target,key,receiver){if(key==='attributedLabel')return forbidden();return Reflect.get(target,key,receiver);}});
  const render=new RenderSemanticsAnnotations({properties}),pipeline=new PipelineOwner({accessibilityEnabled:false});
  try{pipeline.setRoot(render);pipeline.flushLayout({width:100,height:50});render.properties=new SemanticsProperties({label:'Changed'});render.markNeedsSemanticsUpdate();}
  finally{pipeline.setRoot(undefined);render.dispose();pipeline.dispose();}
});

test('pointer activation and keyboard focus actions still work with accessibility disabled',{timeout},async()=>{
  const f=fixture({accessibilityEnabled:false}),focus=new FocusNode();let activations=0;
  const control=new ControlInteraction(()=>new SizedBox(80,32),{focusNode:focus,onPressed:()=>activations++,semantics:{transportId:'button',button:true,label:'Run'}});
  try{
    f.set(new AppFocus(new Align(control)));
    for(const kind of ['down','up']){f.root.pointer({kind,x:120,y:80,pointer:1,device:'mouse',buttons:kind==='up'?0:1,timestamp:0,viewportGeneration:1});f.frame();}
    assert.equal(activations,1);
    focus.requestFocus();await Promise.resolve();f.frame();assert(focus.hasFocus);
    for(const kind of ['down','up'])f.root.key({kind,key:'Enter',code:'Enter',shift:false,control:false,alt:false,meta:false,repeat:false});
    f.frame();assert.equal(activations,2);assert.deepEqual(f.root.nodes,[]);
  }finally{f.close();focus.dispose();}
});

test('Core editing, composing snapshots and IME geometry remain live without a semantics tree',{timeout},async()=>{
  const f=await engineFixture({fonts:true,accessibilityEnabled:false}),controller=new TextEditingController('A');
  const interaction=new ReactNativeInteraction(f.root.context.owner,{commands:true,selectionEvents:true,semantics:'native-controls',nativeSnapshots:true}),token={},commands=[];
  let detach;
  const observe=(revision,text,extra={})=>interaction.observeSnapshot(token,{revision,text,anchor:text.length,focus:text.length,composingStart:-1,composingEnd:-1,source:'native',...extra});
  try{
    f.root.context.editing=interaction.editing;f.root.context.semantics={capability:'native-controls',bind:forbidden};f.root.pipeline.flushSemantics=forbidden;
    f.set(new EditableText('field',controller,'Name'));
    assert.equal(interaction.editorClients.length,1);
    assert(interaction.editorInputBounds('field').width>0,'The nonvisual IME carrier still receives actual Core bounds');
    detach=interaction.attachEditor('field',token,{replace(...args){commands.push(args);},focus(){},blur(){}});
    observe(1,'한A',{anchor:1,focus:1,composingStart:0,composingEnd:1,focused:true});f.frame();
    assert.equal(controller.text,'한A');assert(controller.isComposing);
    observe(2,'한글A',{anchor:2,focus:2,focused:true});f.frame();
    assert.equal(controller.text,'한글A');assert.equal(controller.isComposing,false);
    controller.text='Next';const request=commands.at(-1)[3];observe(3,'Next',{request,source:'programmatic'});f.frame();
    assert.equal(controller.text,'Next');assert.equal(f.root.pipeline.semanticsOwner,null);assert.deepEqual(f.root.nodes,[]);
  }finally{detach?.();await f.close();interaction.dispose();controller.dispose();}
});

const codec=new JSONMethodCodec();
async function snapshot(port){return codec.decodeEnvelope(await new Promise(resolve=>port.send('nelyx/environment',codec.encodeMethodCall(new MethodCall('snapshot')),resolve)));}

test('browser opt-out avoids accessibility media queries, observers and announcement DOM',{timeout},async()=>{
  const queries=[],events=[];
  const view=new EventTarget();view.document=new EventTarget();view.document.hidden=false;view.document.hasFocus=()=>true;
  view.navigator={languages:['en-US']};
  view.matchMedia=query=>{queries.push(query);const media=new EventTarget();media.matches=false;media.addEventListener=(event,callback)=>{events.push([query,event]);EventTarget.prototype.addEventListener.call(media,event,callback);};return media;};
  const port=createBrowserPlatformMessages(view,undefined,undefined,new Proxy({},{get:forbidden}),undefined,false);
  port.attach(()=>{});
  try{
    port.sendChannelUpdate('nelyx/environment-changed',true);
    const environment=await snapshot(port);
    assert.equal(environment.has('accessibility'),false);
    assert.deepEqual(queries,['(prefers-color-scheme: dark)']);
    assert.deepEqual(events,[['(prefers-color-scheme: dark)','change']]);
    assert.equal(await new Promise(resolve=>port.send('flutter/accessibility',new DataView(new Uint8Array([255]).buffer),resolve)),null);
  }finally{await port.dispose();}
});

for(const target of ['windows','android'])for(const accessibilityEnabled of [false,true])test(`${target}: accessibility ${accessibilityEnabled?'defaults to enabled':'opt-out skips preferences'} while locale and platform services remain live`,{timeout},async t=>{
  t.mock.timers.enable({apis:['setInterval']});let localeReads=0,featureReads=0;
  const module={getPreferredLocales(){localeReads++;return {locales:['en-US'],format:'bcp47'};},getAccessibilityFeatures(){featureReads++;return {protocol:1,features:20,supportedFeatures:target==='android'?21:52,semanticsEnabled:target==='android'?true:null};},getClipboardText:async()=>'',setClipboardText:async()=>{}};
  const native={NativeModules:{NelyxPlatformServices:module},Appearance:{getColorScheme:()=> 'light',addChangeListener:()=>({remove(){}})},Dimensions:{addEventListener:()=>({remove(){}})},PixelRatio:{getFontScale:()=>1},AppState:{isAvailable:false},BackHandler:{},Clipboard:{getString:async()=>'',setString(){}}};
  const port=createReactNativePlatformMessages(native,target,native.AppState,undefined,{isLive:forbidden,rootTag:forbidden,nodeTag:forbidden,viewId:0},undefined,accessibilityEnabled?undefined:false);
  port.attach(()=>{});
  try{
    port.sendChannelUpdate('nelyx/environment-changed',true);
    const before=localeReads;t.mock.timers.tick(2000);assert(localeReads>before);
    const environment=await snapshot(port);assert.equal(environment.has('accessibility'),accessibilityEnabled);assert.equal(featureReads>0,accessibilityEnabled);
    assert.equal(environment.get('brightness'),'light');
    if(!accessibilityEnabled)assert.equal(await new Promise(resolve=>port.send('flutter/accessibility',new DataView(new Uint8Array([255]).buffer),resolve)),null);
  }finally{await port.dispose();t.mock.timers.reset();}
});
