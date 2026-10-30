// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {WindowsInteraction} from '../../sdk/dist/platforms/windows/interaction.js';
import {openWindowsInput} from '../../sdk/dist/platforms/windows/input.js';
import {nativeInputProps,nativeKeyboardProps} from '../../sdk/dist/backends/react-native/input.js';
import {EditableText,TextEditingController} from '@nelyx/core/framework/widgets/editable-text';
import {FocusNode} from '@nelyx/core/framework/widgets/focus';
import {Directionality} from '@nelyx/core/framework/widgets/app-data';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {engineFixture} from '../../../packages/material/tests/engine-fixture.mjs';

const timeout=1_200_000,turn=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
async function until(predicate){for(let attempt=0;attempt<20&&!predicate();attempt++)await turn();assert(predicate(),'Expected the actual Core/native adapter transaction to settle');}
function nativeModule(){
  const listeners=new Set(),clients=new Map(),calls=[];let disconnecting;
  const emit=(client,value)=>{const snapshot=[...listeners];for(const listener of snapshot)listener({service:11,client,type:'editing',value});};
  const publish=(id,source='native',request)=>{const client=clients.get(id);emit(id,{...client,source,...(request===undefined?{}:{request}),composingStart:-1,composingEnd:-1});};
  return {calls,listeners,clients,emit,set disconnecting(value){disconnecting=value;},
    events:{addListener(name,listener){assert.equal(name,'nelyxWindowsInput');listeners.add(listener);return {remove(){listeners.delete(listener);}};}},
    module:{getInputProtocol:()=>3,async connect(surface,owner){calls.push(['connect',surface,owner]);return 11;},
      async openClient(_service,id,initial){clients.set(id,{text:initial.text,anchor:initial.anchor,focus:initial.focus,revision:0,focused:false});calls.push(['open',id]);return true;},
      async configureClient(_service,id,...configuration){calls.push(['configure',id,...configuration]);return true;},
      async command(_service,id,name,args){
        calls.push([name,id,...args]);const client=clients.get(id);
        if(name==='focus'||name==='blur'){client.focused=name==='focus';client.revision++;publish(id);}
        else if(name==='replace'||name==='replaceComposing'){assert.equal(args[3],client.revision);Object.assign(client,{text:args[0],anchor:args[1],focus:args[2],revision:client.revision+1});publish(id,'programmatic',args[4]);}
        return true;
      },
      async insertText(_service,id,text,revision,epoch){
        calls.push(['insertText',id,text,revision,epoch]);const client=clients.get(id);assert.equal(revision,client.revision);assert.equal(epoch,5);
        const start=Math.min(client.anchor,client.focus),end=Math.max(client.anchor,client.focus);
        client.text=client.text.slice(0,start)+text+client.text.slice(end);client.anchor=client.focus=start+text.length;client.revision++;publish(id);return {status:'applied',revision:client.revision};
      },async closeClient(_service,id){calls.push(['close',id]);clients.delete(id);return true;},
      async disconnect(){calls.push(['disconnect']);if(disconnecting)await disconnecting.promise;clients.clear();return true;},
    },
  };
}
const key=(sequence,fields={})=>({nativeEvent:{protocol:1,sequence,viewGeneration:7,kind:'down',keyCode:65,scanCode:30,characterCodePoint:0,modifiers:0,repeat:false,repeatCount:1,focusEpoch:5,dead:false,capsLock:false,numLock:false,scrollLock:false,...fields}});

test('the default Windows provider connects real Core editing and serializes shortcuts, observed text and following deletion', {timeout}, async()=>{
  FoundationPlatform.configure({kind:'native',operatingSystem:'windows'});
  const f=await engineFixture({fonts:true}),interaction=new WindowsInteraction(f.root.context.owner),controller=new TextEditingController('seed'),focus=new FocusNode(),native=nativeModule(),errors=[],keys=[];
  const view={owner:interaction.owner,dispatchKey(event){keys.push(event);return f.root.key(event);},dispatchKeyboardFocusGained(){f.root.keyboardFocusGained();},dispatchKeyboardFocusLost(){f.root.keyboardFocusLost();}};
  const input=openWindowsInput(interaction,view,{nativeReactTag:97,nativeViewGeneration:7},native.module,native.events,error=>errors.push(error));
  const props=nativeInputProps('windows',()=>view,undefined,()=>7);
  f.root.context.editing=interaction.editing;
  try {
    assert.equal(interaction.editing.capabilities.composing,'observed');assert.equal(interaction.editing.capabilities.geometry,'unavailable');
    await input.ready;f.set(new Directionality('ltr',new EditableText('default-field',controller,'Field',focus)));
    await until(()=>native.calls.some(call=>call[0]==='configure'));
    focus.requestFocus();f.root.buildOwner.focus.applyFocusChangesIfNeeded();f.frame();await until(()=>[...native.clients.values()].some(client=>client.focused));
    props.onWindowsKeyboardFocus({nativeEvent:{protocol:1,sequence:1,viewGeneration:7,focused:true}});
    props.onWindowsKey(key(2,{modifiers:8}));props.onWindowsKey(key(3,{kind:'up',modifiers:8}));
    props.onWindowsKey(key(4,{keyCode:66,scanCode:48,characterCodePoint:98}));props.onWindowsKey(key(5,{kind:'up',keyCode:66,scanCode:48}));
    props.onWindowsKey(key(6,{keyCode:8,scanCode:14}));props.onWindowsKey(key(7,{kind:'up',keyCode:8,scanCode:14}));
    await until(()=>keys.length===6&&controller.text==='');f.frame();
    assert.equal(native.calls.filter(call=>call[0]==='insertText').length,1);
    assert.equal(native.calls.find(call=>call[0]==='insertText')[2],'b');assert.deepEqual(controller.selection,{anchor:0,focus:0});
    assert(native.calls.some(call=>call[0]==='geometry'),'The native input port receives actual Core paragraph geometry');
    assert.deepEqual(errors,[]);
  }finally{await input.dispose();await f.close();controller.dispose();focus.dispose();interaction.dispose();}
});

test('default input retirement fences ingress immediately and keeps the Core binding usable while disconnect is pending', {timeout}, async()=>{
  const owner={id:'default-retirement',generation:1},interaction=new WindowsInteraction(owner),native=nativeModule(),keys=[],errors=[],gate=deferred();
  const view={owner,dispatchKey:event=>{keys.push(event);return false;},dispatchKeyboardFocusGained(){},dispatchKeyboardFocusLost(){}};
  const binding=interaction.editing.bind(owner,{session:owner,text:'kept',selection:{anchor:4,focus:4},revision:0,source:'programmatic',composing:{status:'none'}},()=>{}, {id:'field'});
  const input=openWindowsInput(interaction,view,{nativeReactTag:97,nativeViewGeneration:7},native.module,native.events,error=>errors.push(error));
  try {
    await input.ready;const value=binding.read();native.disconnecting=gate;
    let retired=false;const closing=input.dispose().then(()=>{retired=true;});await turn();assert.equal(retired,false);
    const props=nativeInputProps('windows',()=>view,undefined,()=>7);props.onWindowsKey(key(1));
    native.emit(1,{text:'late',anchor:4,focus:4,revision:1,source:'native',composingStart:-1,composingEnd:-1});await turn();
    assert.equal(binding.read(),value);assert.deepEqual(keys,[]);assert.equal(native.listeners.size,0);
    gate.resolve();await closing;assert.equal(retired,true);assert.deepEqual(errors,[]);
  }finally{gate.resolve();await input.dispose();binding.dispose();interaction.dispose();}
});

test('native raw focus has one sequenced route and unsupported default modules cannot fall back to public text controls', {timeout}, async()=>{
  const owner={id:'default-admission',generation:1},interaction=new WindowsInteraction(owner),events=[],view={owner,dispatchKeyboardFocusGained(){events.push('focus');},dispatchKeyboardFocusLost(){events.push('blur');}};
  const props=nativeKeyboardProps('windows',()=>view,{rawKeyboard:true,onCanvasFocus:focused=>events.push(focused)});
  props.onFocus({target:1,currentTarget:1});props.onBlur({target:1,currentTarget:1});assert.deepEqual(events,[true,false]);
  const native=nativeModule();
  try {
    assert.throws(()=>openWindowsInput(interaction,view,{nativeReactTag:97,nativeViewGeneration:7},{},native.events,()=>{}),/lacks getInputProtocol/);
    assert.throws(()=>openWindowsInput(interaction,{...view,owner:{...owner,generation:2}},{nativeReactTag:97,nativeViewGeneration:7},native.module,native.events,()=>{}),/exact Core View owner/);
    assert.throws(()=>openWindowsInput(interaction,view,{nativeReactTag:0,nativeViewGeneration:7},native.module,native.events,()=>{}),/admitted native tag/);
    assert.equal(native.calls.length,0);
  }finally{interaction.dispose();}
});

test('a duplicate keyboard route returns a failed lease that still waits for native retirement', {timeout}, async()=>{
  const owner={id:'duplicate-route',generation:1},interaction=new WindowsInteraction(owner),other=new WindowsInteraction(owner),first=nativeModule(),second=nativeModule(),gate=deferred(),errors=[];
  const view={owner,dispatchKey(){return false;},dispatchKeyboardFocusGained(){},dispatchKeyboardFocusLost(){}};
  const metrics={nativeReactTag:97,nativeViewGeneration:7},input=openWindowsInput(interaction,view,metrics,first.module,first.events,error=>errors.push(error));
  let failed;
  try{
    await input.ready;second.disconnecting=gate;failed=openWindowsInput(other,view,metrics,second.module,second.events,error=>errors.push(error));
    await assert.rejects(failed.ready,/keyboard.*owner|keyboard.*bound|route/i);
    let retired=false;const closing=failed.dispose().then(()=>{retired=true;});await turn();assert.equal(retired,false);
    gate.resolve();await closing;assert.equal(retired,true);assert.equal(second.listeners.size,0);assert.deepEqual(errors,[]);
  }finally{gate.resolve();await failed?.dispose();await input.dispose();other.dispose();interaction.dispose();}
});
