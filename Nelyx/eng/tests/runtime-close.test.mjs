// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {AppSession} from '@nelyx/core/hosting/runtime';
import {WebSkiaLibrary} from '@nelyx/skia-web/library';
import {FrameworkRoot} from '@nelyx/core/framework/widgets/root';
import {Semantics} from '@nelyx/core/framework/widgets/semantics';
import {SizedBox} from '@nelyx/core/framework/widgets/basic';
import {NativeInteraction} from '../../sdk/dist/runtime/native-interaction.js';
import {EditableText,TextEditingController} from '@nelyx/core/framework/widgets/editable-text';
import {FocusNode} from '@nelyx/core/framework/widgets/focus';
import {copyResourceId} from '@nelyx/core/ui/resource-retention';
import {ownedCanvasKit} from '../../../packages/material/tests/engine-fixture.mjs';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {AnnotationType} from '@nelyx/core/framework/rendering/layer';

const timeout=1_200_000;
FoundationPlatform.configure({kind:'native',operatingSystem:'windows'});
const metrics={logicalWidth:100,logicalHeight:100,physicalWidth:100,physicalHeight:100,scale:1,viewportGeneration:1,rendererGeneration:1,nativeContextGeneration:1,nativeSurfaceGeneration:1};
function fixture({hook=()=>{},rendererClose=()=>{},services=[]}={}){
 const calls=[],callbacks=new Set();let view,session;
 const invoke=phase=>{calls.push(phase);hook(phase,{view,session});};
 const clock={request(callback){callbacks.add(callback);return {dispose(){callbacks.delete(callback);invoke('task');}};}};
 const renderer={capabilities:{notifications:'submitted-and-retired'},updateMetrics(){},observe(){return {dispose(){invoke('observer');}};},submit(){throw Error('Unexpected frame submission');},dispose(){invoke('renderer');return rendererClose();}};
 session=new AppSession({id:'close',createView(){return {build(){return [];},dispose(){invoke('controller');}};}},clock,services);
 view=session.attach({id:'close',generation:1,metrics,renderer,ownership:'owned',services:{assets:new Map(),text:{},clock:{now:()=>0},editing:{capability:'unavailable'},semantics:{capability:'unavailable'}}});
 return {view,session,calls,callbacks};
}
const count=(values,value)=>values.filter(item=>item===value).length;

test('failed and closing Views reject native and retained semantics actions before Root retirement',{timeout},async()=>{
 for(const state of ['closing','failed']){
  const callbacks=new Set(),clock={now:()=>0,request(callback){callbacks.add(callback);return {dispose(){callbacks.delete(callback);}};}},owner={id:'view-input-'+state,generation:1};
  const interaction=new NativeInteraction(owner,{commands:true,selectionEvents:true,semantics:'native-controls',nativeSnapshots:true});
  let root,actions=0,fail=false;const errors=[];
  const renderer={capabilities:{notifications:'unavailable'},updateMetrics(){},submit(){return fail?{status:'unknown'}:{status:'rejected',reason:'busy'};},dispose(){}};
  const session=new AppSession({id:owner.id,createView(context){return root=new FrameworkRoot(context,{id:owner.id,createRoot:()=>new Semantics({transportId:'action',container:true,label:'Action',onTap:()=>actions++,child:new SizedBox(20,20)})});}},clock);
  const view=session.attach({...owner,metrics,renderer,ownership:'owned',onError:error=>errors.push(error),services:{assets:new Map(),text:{createParagraph(){throw Error('Unexpected text');}},clock,editing:interaction.editing,semantics:interaction.semantics}});
  const tick=()=>{const callback=callbacks.values().next().value;assert(callback,'Expected one owned frame callback');callbacks.delete(callback);callback();};
  try{
   view.requestFrame();tick();assert.equal(interaction.activate('action'),true);assert.equal(actions,1);
   const retained=root.nodes.find(node=>node.id==='action').activate;
   if(state==='closing')view.beginClose();else{fail=true;tick();}
   assert.equal(errors.length,state==='failed'?1:0);
   assert.equal(view.status,state);assert.equal(root.closed,false,'The View admission fence precedes controller retirement');
   assert.equal(interaction.activate('action'),false,'Native actions must use the actual View lifetime');retained();assert.equal(actions,1,'Retained snapshots must use the same View lifetime');
   assert.equal(root.key({kind:'down',key:'Enter'}),false);const type=new AnnotationType('admission');for(const query of ['findAnnotation','findAllAnnotations'])assert.throws(()=>root[query](type,{x:0,y:0}),error=>error.code==='closed-framework-root');
  }finally{await session.dispose();interaction.dispose();}
 }
});

test('View beginClose during a semantics bind retires the returned endpoint and its candidate CPU recording',{timeout},async()=>{
 const callbacks=new Set(),clock={now:()=>0,request(callback){callbacks.add(callback);return {dispose(){callbacks.delete(callback);}};}};let view,root,retired=0;
 const session=new AppSession({id:'bind-close',createView(context){return root=new FrameworkRoot(context,{id:'bind-close',createRoot:()=>new Semantics({container:true,label:'Live',child:new SizedBox(10,10)})});}},clock);
 const renderer={capabilities:{notifications:'unavailable'},updateMetrics(){},submit(){throw Error('A closing View cannot submit its candidate');},dispose(){}};
 try{
  view=session.attach({id:'bind-close',generation:1,metrics,renderer,ownership:'owned',services:{assets:new Map(),clock,text:{},editing:{capability:'unavailable'},semantics:{capability:'native-controls',bind(){view.beginClose();return {dispose(){retired++;}};}}}});
  view.requestFrame();const callback=callbacks.values().next().value;callbacks.delete(callback);callback();assert.equal(view.status,'closing');assert.equal(root.closed,false);assert.equal(root.semantics,undefined);assert.equal(retired,1);assert.equal(view.pending,undefined);
 }finally{await session.dispose();assert.equal(retired,1);}
});

for(const status of ['closing','failed'])for(const composing of [false,true])test(`${status} View fences Core/native input while completing an admitted ${composing?'composition cancellation':'replacement'}`,{timeout},async()=>{
 const owner={id:'editor-'+status,generation:1},callbacks=new Set(),clock={now:()=>0,request(callback){callbacks.add(callback);return {dispose(){callbacks.delete(callback);}};}};
 const library=new WebSkiaLibrary(await ownedCanvasKit(),null,owner),interaction=new NativeInteraction(owner,{commands:true,selectionEvents:true,semantics:'native-controls',nativeSnapshots:true});
 const controller=new TextEditingController('text'),focus=new FocusNode(),commands=[],geometries=[],errors=[];let fail=false,options,changes=0,submits=0;
 const renderer={capabilities:{notifications:'unavailable'},updateMetrics(){},submit(){return fail?{status:'unknown'}:{status:'rejected',reason:'busy'};},dispose(){}};
 const session=new AppSession({id:owner.id,createView(context){return new FrameworkRoot(context,{id:owner.id,createRoot:()=>new SizedBox(90,50,new EditableText('field',controller,'Field',focus,0,null,{onChanged:()=>changes++,onSubmitted:()=>submits++}))});}},clock,[{value:library,ownership:'owned'}]);
 let detach;
 try{
  library.bind(session.resources);const bytes=fs.readFileSync(new URL('../../sdk/tooling/cli/templates/nelyx-app/assets/RobotoSlab-VariableFont_wght.ttf',import.meta.url)),font=library.decode({id:'text-font',kind:'font',fontFamily:'RobotoSlab',sha256:crypto.createHash('sha256').update(bytes).digest('hex')},bytes);session.resources.register(font.descriptor,font.retire);const defaultFont=copyResourceId(font.descriptor);
  const editing={capabilities:interaction.editing.capabilities,bind(...args){options=args[3];return interaction.editing.bind(...args);},dispose(){}};
  const view=session.attach({...owner,metrics,renderer,ownership:'owned',onError:error=>errors.push(error),services:{assets:new Map([['text-font',defaultFont]]),defaultFont,text:library,clock,editing,semantics:interaction.semantics}});
  const tick=()=>{const callback=callbacks.values().next().value;assert(callback);callbacks.delete(callback);callback();};
  view.requestFrame();tick();const token={};detach=interaction.attachEditor('field',token,{replace(...args){commands.push(args);},replaceComposing(...args){commands.push(args);},focus(){},blur(){},updateGeometry(...args){geometries.push(args);},updateTextPosition(){}});
  const observe=(revision,text,extra={})=>interaction.observeSnapshot(token,{revision,text,anchor:text.length,focus:text.length,source:'native',composingStart:-1,composingEnd:-1,...extra});
  assert.equal(observe(1,'text',composing?{composingStart:0,composingEnd:4}:{}),true);if(composing)tick();const geometry=geometries.at(-1)[0];assert(geometry);assert(options.readCharacterBounds(0,1,geometry));assert.equal(interaction.requestCharacterBounds(token,0,1,1,geometry.layoutEpoch),true);
  controller.replace('Core',{anchor:4,focus:4});const command=commands.at(-1),revision=controller.revision,before=controller.text;assert.equal(command[0],'Core');assert.equal(command[2],1);
  if(status==='closing')view.beginClose();else{fail=true;tick();}assert.equal(view.status,status);assert.equal(errors.length,status==='failed'?1:0);
  assert.equal(options.readInputState().enabled,false);assert.equal(options.readCharacterBounds(0,1,geometry),null);assert.equal(options.readRangeBounds(0,0,geometry),null);assert.equal(options.readTextPosition({x:5,y:5},{nearest:true},geometry),null);
  assert.equal(interaction.requestCharacterBounds(token,0,1,1,geometry.layoutEpoch),false);assert.equal(interaction.requestTextPosition(token,{request:1,point:{x:5,y:5},options:{nearest:true},layoutEpoch:geometry.layoutEpoch,nativeRevision:1}),false);
  assert.equal(observe(2,'late'),false);assert.equal(controller.text,before);assert.equal(controller.revision,revision);options.focusChanged(true);assert.equal(focus.hasFocus,false);assert.equal(options.onUndo(),false);assert.equal(options.onRedo(),false);options.onAction();assert.equal(submits,0);
  assert.equal(observe(2,'Core',{source:'programmatic',request:command[3]}),true,'An admitted replacement must still receive its authoritative completion');await Promise.resolve();assert.equal(commands.length,1);assert.equal(controller.text,'Core');assert.equal(controller.isComposing,false);if(composing)assert(controller.revision>revision);else assert.equal(controller.revision,revision);assert.equal(changes,0);
 }finally{await session.dispose();detach?.();interaction.dispose();focus.dispose();controller.dispose();assert.equal(library.paragraphs.size,0);assert.equal(library.fonts.size,0);}
});

for(const owner of ['view','session'])test(`${owner} publishes one close promise before every reentrant cleanup callback`,{timeout},async()=>{
 for(const phase of ['task','controller','observer','renderer']){
  let reentered,once=false;
  const f=fixture({hook(current,owners){if(current===phase&&!once){once=true;reentered=owners[owner].dispose();owners.view.requestFrame();if(owner==='session')assert.throws(()=>owners.session.attach({id:'late',generation:1,metrics,renderer:{},ownership:'borrowed'}),error=>error.code==='closed');}}});
  f.view.requestFrame();
  const closing=f[owner].dispose();await closing;assert(once,phase);assert.equal(reentered,closing,phase);await reentered;
  assert.equal(f.view.status,'closed');assert.equal(f.callbacks.size,0);
  for(const boundary of ['task','controller','observer','renderer'])assert.equal(count(f.calls,boundary),1,`${phase}: ${boundary}`);
  await f.session.dispose();
 }
});

test('View preserves falsey callback failures alongside a failed native drain and does not replay cleanup',{timeout},async()=>{
 for(const failure of [undefined,null,0]){
  const drain=Error('native drain failure');
  const f=fixture({hook(phase){if(phase==='controller')throw failure;},rendererClose(){throw drain;}});
  const closing=f.view.dispose();
  await assert.rejects(closing,error=>{assert(error instanceof AggregateError);assert.deepEqual(error.errors,[failure,drain]);return true;});
  assert.equal(f.view.dispose(),closing);assert.equal(f.view.status,'closing');assert.equal(count(f.calls,'controller'),1);assert.equal(count(f.calls,'observer'),1);assert.equal(count(f.calls,'renderer'),1);
  await assert.rejects(f.session.dispose());
 }
});

test('AppSession reports resource retirement and View drain failures together while retaining dependent services',{timeout},async()=>{
 for(const failure of [undefined,null,0]){
  const drain=Error('native drain failure');let services=0;
  const f=fixture({rendererClose(){throw drain;},services:[{ownership:'owned',value:{dispose(){services++;}}}]});
  f.session.resources.register({id:'retire-failure',generation:1,kind:'image'},()=>{throw failure;});
  const closing=f.session.dispose();
  await assert.rejects(closing,error=>{assert(error instanceof AggregateError);assert.equal(error.errors.length,2);assert(error.errors[0] instanceof AggregateError);assert.deepEqual(error.errors[0].errors,[failure]);assert.equal(error.errors[1],drain);return true;});
  assert.equal(f.session.dispose(),closing);assert.equal(services,0);assert.equal(count(f.calls,'renderer'),1);
 }
});

test('AppSession waits for the owned renderer drain before disposing services and keeps all close callers on that transaction',{timeout},async()=>{
 let release,services=0;const drain=new Promise(resolve=>{release=resolve;});
 const f=fixture({rendererClose:()=>drain,services:[{ownership:'owned',value:{dispose(){services++;}}}]});
 f.view.requestFrame();const closing=f.session.dispose();let finished=false;void closing.then(()=>{finished=true;});
 assert.equal(f.session.dispose(),closing);assert.equal(f.view.status,'closing');assert.equal(f.callbacks.size,0);assert.equal(services,0);
 f.view.requestFrame();f.view.queuePointer({kind:'wheel',viewportGeneration:1});assert.equal(f.callbacks.size,0);
 await Promise.resolve();assert.equal(finished,false);assert.equal(services,0);
 release();await closing;assert.equal(services,1);assert.equal(f.view.status,'closed');assert.equal(f.session.dispose(),closing);assert.equal(count(f.calls,'renderer'),1);
});

test('Web close stops admission before picture retirement and shares its transaction with a reentrant resource callback',{timeout},async()=>{
 const library=new WebSkiaLibrary({},null,{id:'web-close',generation:1}),calls=[];let reentered,once=false,admission;
 library.pictures={dispose(){calls.push('pictures');if(!once){once=true;admission=library.submit({},{});reentered=library.dispose();void reentered.catch(()=>{});}}};
 library.gl={finish(){calls.push('finish');},isContextLost:()=>false,getExtension:()=>({loseContext(){calls.push('lose');}})};
 const closing=library.dispose();await closing;await reentered;
 assert.equal(reentered,closing);assert.equal(admission.reason,'closed');assert.equal(library.dispose(),closing);assert.deepEqual(calls,['pictures','finish','lose']);
});

test('Web retirement failures stay rejected on the same close promise and retain unconfirmed native dependencies',{timeout},async()=>{
 for(const phase of ['pictures','finish','context'])for(const failure of [undefined,null,0]){
  const library=new WebSkiaLibrary({},null,{id:'web-close-failure',generation:1}),calls=[];
  library.pictures={dispose(){calls.push('pictures');if(phase==='pictures')throw failure;}};
  library.gl={finish(){calls.push('finish');if(phase==='finish')throw failure;},isContextLost:()=>false,getExtension:()=>({loseContext(){calls.push('lose');}})};
  const context=library.context={delete(){calls.push('context');if(phase==='context')throw failure;}};
  let closing;assert.doesNotThrow(()=>{closing=library.dispose();});
  let caught=false;try{await closing;}catch(error){caught=true;assert.equal(error,failure);}assert(caught);
  assert.equal(library.dispose(),closing);assert.equal(library.context,context);assert.equal(library.submit({},{}).reason,'closed');assert(!calls.includes('lose'));
  assert.deepEqual(calls,phase==='pictures'?['pictures']:phase==='finish'?['pictures','finish']:['pictures','finish','context']);
 }
});
