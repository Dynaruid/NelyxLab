// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {PluginPlatformMessagePort} from '../../sdk/dist/runtime/plugin-port.js';
import {installNativeKeyboardState} from '../../sdk/dist/runtime/native-keyboard-state.js';
import {installNativeAccessibility} from '../../sdk/dist/runtime/native-accessibility.js';
import {StandardMethodCodec,StandardMessageCodec} from '@nelyx/core/services/message-codecs';
import {MethodCall} from '@nelyx/core/services/message-codec';
const timeout=1_200_000,turn=()=>new Promise(resolve=>setImmediate(resolve));
const send=(port,channel,bytes)=>new Promise(resolve=>port.send(channel,bytes,resolve));

test('native keyboard state uses the supplied endpoint receiver and validates every fresh observation',{timeout},async()=>{
  const port=new PluginPlatformMessagePort(),codec=new StandardMethodCodec(),trace=[];
  class Keyboard{#keys=[{keyCode:65,scanCode:30}];get getKeyboardState(){trace.push('read method');return async function(){trace.push('call');return {protocol:1,target:'windows',keys:this.#keys};};}clear(){this.#keys=[];}}
  const keyboard=new Keyboard();installNativeKeyboardState(port,keyboard,'windows');port.attach((_channel,_data,reply)=>reply(null));
  const read=async method=>codec.decodeEnvelope(await send(port,'flutter/keyboard',codec.encodeMethodCall(new MethodCall(method,null))));
  try{
    const first=await read('getKeyboardState');assert(first instanceof Map);assert.equal(first.size,1);assert.deepEqual(trace,['read method','read method','call']);
    keyboard.clear();assert.equal((await read('getKeyboardState')).size,0);assert.equal(trace.filter(value=>value==='call').length,2);
    assert.equal(await send(port,'flutter/keyboard',codec.encodeMethodCall(new MethodCall('unknown',null))),null);assert.equal(trace.length,6);
  }finally{await port.dispose();}
});

test('closing keyboard ingress waits for an admitted read and rejects its cancelled response',{timeout},async()=>{
  const port=new PluginPlatformMessagePort(),codec=new StandardMethodCodec();let complete,reads=0;
  installNativeKeyboardState(port,{getKeyboardState(){reads++;return new Promise(resolve=>{complete=resolve;});}},'windows');port.attach((_channel,_data,reply)=>reply(null));
  const reading=send(port,'flutter/keyboard',codec.encodeMethodCall(new MethodCall('getKeyboardState',null)));await turn();assert.equal(reads,1);
  let retired=false;const closing=port.dispose().then(()=>{retired=true;});await turn();assert.equal(retired,false);
  complete({protocol:1,target:'windows',keys:[]});assert.equal(await reading,null);await closing;assert.equal(retired,true);
});

test('native accessibility resolves the current endpoint and retains its dispatch receiver',{timeout},async()=>{
  const port=new PluginPlatformMessagePort(),codec=new StandardMessageCodec(),calls=[];let reads=0;
  class Accessibility{#name;constructor(name){this.#name=name;}getAccessibilityProtocol(){return 1;}async dispatchAccessibilityEvent(root,target,type,message){calls.push([this.#name,root,target,type,message]);return true;}}
  let backend=new Accessibility('first');installNativeAccessibility(port,()=>{reads++;return backend;},'windows',{viewId:0,isLive:()=>true,rootTag:()=>7,nodeTag:()=>null});port.attach((_channel,_data,reply)=>reply(null));
  const announce=message=>send(port,'flutter/accessibility',codec.encodeMessage(new Map([['type','announce'],['data',new Map([['viewId',0],['message',message]])]])));
  try{await announce('한글');backend=new Accessibility('second');await announce('완료');assert.equal(reads,2);assert.deepEqual(calls,[['first',7,7,'announce','한글'],['second',7,7,'announce','완료']]);}
  finally{await port.dispose();}
});
