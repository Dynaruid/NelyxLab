// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';
import {connectNativeEditing} from '../../sdk/dist/backends/native-hermes/editing.js';
import {connectNativeInteraction} from '../../sdk/dist/backends/native-hermes/interaction.js';
import {NativeInteraction} from '../../sdk/dist/runtime/native-interaction.js';
import {EditableText,TextEditingController} from '@nelyx/core/framework/widgets/editable-text';
import {FocusNode} from '@nelyx/core/framework/widgets/focus';
import {Directionality} from '@nelyx/core/framework/widgets/app-data';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {engineFixture} from '../../../packages/material/tests/engine-fixture.mjs';
import {createNativeServices} from '../../sdk/dist/backends/native-hermes/services.js';
import {StandardMethodCodec,StandardMessageCodec,JSONMethodCodec} from '@nelyx/core/services/message-codecs';
import {MethodCall} from '@nelyx/core/services/message-codec';
const timeout=1_200_000,turn=()=>new Promise(resolve=>setImmediate(resolve));
async function until(predicate){for(let i=0;i<24&&!predicate();i++)await turn();assert(predicate(),'Native/Core acknowledgement did not settle');}
const interactionFor=owner=>new NativeInteraction(owner,{commands:true,selectionEvents:true,semantics:'native-controls',nativeSnapshots:true,geometry:'unavailable'});

test('direct-host copied packets serialize real Core shortcuts, native Unicode receipts and retirement',{timeout},async()=>{
  FoundationPlatform.configure({kind:'native',operatingSystem:'windows'});
  const f=await engineFixture({fonts:true}),interaction=interactionFor(f.root.context.owner),controller=new TextEditingController('seed'),focus=new FocusNode(),clients=new Map(),calls=[],errors=[],keys=[],semantics=[];let input;
  const publish=(id,request)=>{const value=clients.get(id);input.event('editor',{...value,id,generation:1,kind:'editing',source:request?'programmatic':'native',composingStart:-1,composingEnd:-1,...(request?{request}:{})});};
  const bridge={publishSemantics(value){semantics.push(value);},editor(kind,packet){calls.push([kind,packet]);queueMicrotask(()=>{let status='ok',revision=0,error='';try{
    const {id}=packet;
    if(kind==='attach')clients.set(id,{text:packet.text,anchor:packet.anchor,focus:packet.focus,revision:0,focused:false});
    else if(kind==='detach')clients.delete(id);
    else if(kind==='focus'||kind==='blur'){const value=clients.get(id);value.focused=kind==='focus';value.revision++;publish(id);}
    else if(kind==='replace'){const value=clients.get(id);assert.equal(packet.revision,value.revision);Object.assign(value,{text:packet.text,anchor:packet.anchor,focus:packet.focus,revision:value.revision+1});publish(id,packet.request);}
    else if(kind==='keyboardText'){const value=clients.get(id);assert.equal(packet.revision,value.revision);assert.equal(packet.focusEpoch,5);const start=Math.min(value.anchor,value.focus),end=Math.max(value.anchor,value.focus);value.text=value.text.slice(0,start)+packet.text+value.text.slice(end);value.anchor=value.focus=start+packet.text.length;value.revision++;revision=value.revision;status='applied';publish(id);}
  }catch(failure){error=String(failure);}input.event('editor-ack',{operation:packet.operation,error,status,revision});});}};
  input=connectNativeEditing(interaction,bridge,error=>errors.push(error));
  const nativeSemantics=connectNativeInteraction(interaction,bridge,()=>({...f.root.context.readMetrics(),nativeSurfaceGeneration:2}));f.root.context.semantics=interaction.semantics;
  const view={owner:interaction.owner,controller:f.root,dispatchKey(event){keys.push(event);return f.root.key(event);},dispatchRawKey(message,event){keys.push(event);return f.root.rawKey(message,event);},dispatchKeyboardFocusGained(){f.root.keyboardFocusGained();},dispatchKeyboardFocusLost(){f.root.keyboardFocusLost();}};
  input.bind(view);f.root.context.editing=interaction.editing;
  const key=(sequence,fields={})=>input.event('native-key',{protocol:1,sequence,viewGeneration:1,kind:'down',keyCode:65,scanCode:30,characterCodePoint:0,modifiers:0,repeat:false,repeatCount:1,focusEpoch:5,dead:false,capsLock:false,numLock:false,scrollLock:false,...fields});
  try{
    await input.ready;f.set(new Directionality('ltr',new EditableText('direct-field',controller,'Field',focus)));await until(()=>calls.some(([kind])=>kind==='configure'));
    focus.requestFocus();f.root.buildOwner.focus.applyFocusChangesIfNeeded();f.frame();await until(()=>[...clients.values()].some(value=>value.focused));
    f.frame();await turn();const field=semantics.flatMap(value=>value.upserts).map(value=>value.packet).findLast(value=>value.id==='direct-field');assert(field?.focused&&field.focusable,'A focused real Core editor must expose an accessible focus action');
    input.event('native-keyboard-focus',{protocol:1,sequence:1,viewGeneration:1,focused:true});
    key(2,{modifiers:8});key(3,{kind:'up',modifiers:8});key(4,{keyCode:66,scanCode:48,characterCodePoint:0x1f600});key(5,{kind:'up',keyCode:66,scanCode:48});key(6,{keyCode:8,scanCode:14});key(7,{kind:'up',keyCode:8,scanCode:14});
    await until(()=>keys.length===6&&controller.text==='');
    input.event('native-text',{protocol:1,sequence:8,viewGeneration:1,characterCodePoint:0xd55c,repeatCount:1,focusEpoch:5});input.event('native-text',{protocol:1,sequence:9,viewGeneration:1,characterCodePoint:0xae00,repeatCount:1,focusEpoch:5});
    await until(()=>controller.text==='한글');f.frame();assert.deepEqual(controller.selection,{anchor:2,focus:2});assert.equal(calls.filter(([kind])=>kind==='keyboardText').length,3);assert(calls.some(([kind])=>kind==='geometry'));
    input.event('editor',{id:'1',generation:2,kind:'editing',text:'stale',revision:999});await turn();assert.equal(controller.text,'한글');assert.deepEqual(errors,[]);
  }finally{nativeSemantics.dispose();await input.dispose();assert.equal(clients.size,0);await f.close();controller.dispose();focus.dispose();interaction.dispose();}
});

test('direct UIA deltas match queued native commits and retain unchanged node payloads',{timeout},async()=>{
  const interaction=interactionFor({id:'native-hermes:root',generation:1}),updates=[];let activated=0;
  const node={id:'button',sourceNodeId:7,role:'button',name:'Button',enabled:true,bounds:{x:1,y:2,width:30,height:40},checked:false,selected:true,value:'Current choice',semanticsIdentifier:'fixture-check',tooltip:'Help',activate(){activated++;}};
  const binding=interaction.semantics.bind([node]),metrics={nativeSurfaceGeneration:2,viewportGeneration:1},native=connectNativeInteraction(interaction,{publishSemantics:value=>updates.push(value)},()=>metrics);
  try{
    const first=updates.at(-1),packet=first.upserts[0].packet;assert.deepEqual({...first.upserts[0],packet:undefined},{packet:undefined,name:'Button',parent:-1,selected:true,checked:false,value:'Current choice',tooltip:'Help',automationId:'fixture-check',isLink:false});assert(native.event('semantics',{protocol:1,id:'button',source:7,commit:packet.commit,kind:'activate'}));assert.equal(activated,1);
    interaction.surfaceChanged();await turn();const next=updates.at(-1);assert.equal(next.upserts.length,0);assert(next.commit>first.commit);assert.equal(native.event('semantics',{protocol:1,id:'button',source:7,commit:packet.commit,kind:'activate'}),true);assert.equal(activated,2);assert.equal(native.event('semantics',{protocol:1,id:'button',source:7,commit:9999,kind:'activate'}),false);
    assert(native.event('semantics',{protocol:1,id:'button',source:7,commit:next.commit,kind:'activate'}));metrics.viewportGeneration++;metrics.nativeSurfaceGeneration++;interaction.surfaceChanged();await turn();assert.equal(updates.at(-1).upserts.length,1);
    binding.update([]);await turn();assert.deepEqual(updates.at(-1).removed,['button']);assert.equal(native.event('semantics',{protocol:1,id:'button',source:7,commit:next.commit,kind:'activate'}),false);
  }finally{native.dispose();binding.dispose();interaction.dispose();}
});

test('queued numeric UIA actions match bounded published commits without acquiring changed ranges or owners',{timeout},async()=>{
  const interaction=interactionFor({id:'native-hermes:root',generation:1}),updates=[],calls=[],metrics={nativeSurfaceGeneration:2,viewportGeneration:1};
  const range=(value=2)=>({id:'range',sourceNodeId:7,role:'group',name:'Range',enabled:true,bounds:{x:0,y:0,width:100,height:30},isSlider:true,numericRange:{min:0,max:10,value},rangeActions:{setValue:value=>calls.push(value)}});
  const binding=interaction.semantics.bind([range()]),native=connectNativeInteraction(interaction,{publishSemantics:value=>updates.push(value)},()=>metrics),event=()=>({protocol:1,id:'range',source:7,commit:updates.at(-1).commit,kind:'set-range-value',value:7});
  try{
    const first=event();interaction.surfaceChanged();await turn();assert(native.event('semantics',first),'The actual native tree can lag the runtime publish queue');assert.deepEqual(calls,[7]);
    for(const bad of [{...first,source:8},{...first,commit:9999}])assert.equal(native.event('semantics',bad),false);
    binding.update([range(3)]);await turn();assert.equal(native.event('semantics',first),false,'Old numeric metadata cannot overwrite a newer Core value');const current=event();assert(native.event('semantics',current));
    metrics.viewportGeneration++;assert.equal(native.event('semantics',current),false);metrics.viewportGeneration--;binding.update([]);await turn();binding.update([range(3)]);await turn();assert.equal(native.event('semantics',current),false,'Removing and reinserting the same ID retires the old owner');
    const bounded=event();for(let count=0;count<16;count++){interaction.surfaceChanged();await turn();}assert.equal(native.event('semantics',bounded),false,'Numeric history must evict commits beyond its explicit bound');assert(native.event('semantics',event()));
  }finally{native.dispose();binding.dispose();interaction.dispose();}
});

test('queued text UIA commands retain editing stamps and reject privacy, content and owner changes',{timeout},async()=>{
  for(const changed of [{readOnly:true},{obscured:true},{value:'B'},{textInputGeneration:4},{sourceNodeId:9}]){
    const interaction=interactionFor({id:'native-hermes:root',generation:1}),updates=[],calls=[],node={id:'field',sourceNodeId:8,role:'text-field',name:'Field',enabled:true,bounds:{x:0,y:0,width:100,height:30},value:'A',textInputRevision:4,textRevision:2,textInputGeneration:3,textActions:{setSelection:value=>calls.push(value)}};
    const binding=interaction.semantics.bind([node]),native=connectNativeInteraction(interaction,{publishSemantics:value=>updates.push(value)},()=>({nativeSurfaceGeneration:2,viewportGeneration:1}));
    try{const event={protocol:1,id:'field',source:8,commit:updates.at(-1).commit,kind:'set-selection',revision:4,generation:3,anchor:0,focus:1};interaction.surfaceChanged();await turn();assert(native.event('semantics',event));binding.update([{...node,...changed}]);await turn();assert.equal(native.event('semantics',event),false);assert.deepEqual(calls,[{anchor:0,focus:1}]);}
    finally{native.dispose();binding.dispose();interaction.dispose();}
  }
});

test('direct platform services preserve actual channel codecs and wait for UI acknowledgements at close',{timeout},async()=>{
  const calls=[],waiting=[];let services;
  services=createNativeServices({service(id,kind,value){calls.push([kind,value]);waiting.push(()=>services.event({id,value:kind==='clipboard-read'?'한글😀':'',error:''}));}});
  const port=services.port;port.attach((_channel,_bytes,reply)=>reply(null));
  const send=(channel,bytes)=>new Promise(resolve=>port.send(channel,bytes,resolve)),standard=new StandardMethodCodec(),json=new JSONMethodCodec(),messages=new StandardMessageCodec();
  try{
    let resolved=false;const cursor=send('flutter/mousecursor',standard.encodeMethodCall(new MethodCall('activateSystemCursor',new Map([['device',0],['kind','text']])))).then(value=>{resolved=true;return standard.decodeEnvelope(value);});
    await turn();assert.deepEqual(calls,[['cursor','text']]);assert.equal(resolved,false);waiting.shift()();assert.equal(await cursor,null);
    const clipboard=send('flutter/platform',json.encodeMethodCall(new MethodCall('Clipboard.getData','text/plain')));await turn();waiting.shift()();assert.equal(json.decodeEnvelope(await clipboard).get('text'),'한글😀');
    const announcement=send('flutter/accessibility',messages.encodeMessage(new Map([['type','announce'],['data',new Map([['viewId',0],['message','완료']])]])));await turn();assert.deepEqual(calls.at(-1),['announce','완료']);
    let retired=false;const closing=port.dispose().then(()=>{retired=true;});await turn();assert.equal(retired,false);waiting.shift()();await announcement;await closing;assert.equal(retired,true);assert.equal(services.event({id:999,value:'foreign',error:''}),false);
  }finally{for(const finish of waiting.splice(0))finish();await port.dispose();}
});
