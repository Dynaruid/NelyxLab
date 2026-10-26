// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';
import {NativeInteraction} from '../../sdk/dist/runtime/native-interaction.js';
const timeout=1_200_000,owner={id:'interaction-retirement',generation:1};
const initial={session:owner,text:'value',selection:{anchor:5,focus:5},composing:{status:'none'},revision:0,source:'programmatic'};
const node=()=>({id:'action',role:'button',name:'Action',enabled:true,bounds:{x:0,y:0,width:20,height:20},activate(){}});
const make=()=>new NativeInteraction(owner,{commands:true,selectionEvents:true,semantics:'native-controls',nativeSnapshots:true});
function expectFailure(run,expected){let caught=false;try{run();}catch(error){caught=true;assert.equal(error,expected);}assert(caught);}

test('permanent native interaction close fences reentry, publishes once and clears every endpoint after a falsey listener failure',{timeout},()=>{
 for(const leased of [false,true])for(const failure of [undefined,null,0]){
  const interaction=make(),services=leased?interaction.acquireServices():interaction;
  const editor=services.editing.bind(owner,initial,()=>{},{id:'field'}),semantics=services.semantics.bind([node()]);
  const token={},detach=interaction.attachEditor('field',token,{replace(){},focus(){},blur(){}}),detachNode=interaction.attachSemanticsNode('action',{},()=>99),oldNode=interaction.semanticNodes[0],before=interaction.snapshot();let first=0,last=0;
  const stops=[interaction.subscribe(()=>{first++;interaction.dispose();assert.throws(()=>interaction.acquireServices());throw failure;}),interaction.subscribe(()=>{last++;assert.deepEqual(interaction.editorClients,[]);assert.deepEqual(interaction.semanticNodes,[]);assert.equal(interaction.isLiveNodeSnapshot(oldNode),false);})];
  try{
   expectFailure(()=>interaction.dispose(),failure);assert.equal(first,1);assert.equal(last,1);assert.equal(interaction.snapshot(),before+1);
   assert.throws(()=>interaction.editing.bind(owner,initial,()=>{},{id:'late'}));assert.throws(()=>interaction.semantics.bind([node()]));assert.throws(()=>interaction.subscribe(()=>{}));
   assert.equal(interaction.performAction('action','activate'),false);assert.equal(interaction.editorNativeTag('field'),null);assert.equal(interaction.nativeSemanticsTag(0),null);
   interaction.surfaceChanged();interaction.dispose();assert.equal(first,1);assert.equal(last,1);
  }finally{for(const stop of stops)stop();editor.dispose();semantics.dispose();detach();detachNode();interaction.dispose();}
 }
});

test('releasing a native service lifetime reports listener failures after all observers and preserves fresh-generation reuse',{timeout},()=>{
 for(const failure of [undefined,null,0]){
  const interaction=make(),services=interaction.acquireServices(),oldEditor=services.editing.bind(owner,initial,()=>{},{id:'field'}),oldSemantics=services.semantics.bind([node()]),oldNode=interaction.semanticNodes[0],generation=interaction.editorGeneration('field');let delivered=0;
  const stopFailure=interaction.subscribe(()=>{throw failure;}),stopDelivery=interaction.subscribe(()=>{delivered++;assert.deepEqual(interaction.editorClients,[]);});
  expectFailure(()=>services.release(),failure);assert.equal(delivered,1);stopFailure();stopDelivery();services.release();assert.equal(delivered,1);
  const next=interaction.acquireServices(),editor=next.editing.bind(owner,initial,()=>{},{id:'field'}),semantics=next.semantics.bind([node()]);
  try{assert(interaction.editorGeneration('field')>generation);assert.equal(interaction.isLiveNodeSnapshot(oldNode),false);assert.throws(()=>services.editing.bind(owner,initial,()=>{},{id:'old'}));assert.throws(()=>oldEditor.update(initial));oldSemantics.dispose();assert.equal(interaction.semanticNodes.length,1);}
  finally{oldEditor.dispose();editor.dispose();semantics.dispose();next.release();interaction.dispose();}
 }
});

test('native lifetime retirement preserves all observer failures in callback order',{timeout},()=>{
 for(const operation of ['release','dispose']){
  const interaction=make(),services=interaction.acquireServices(),events=[];
  const stops=[interaction.subscribe(()=>{events.push('first');throw undefined;}),interaction.subscribe(()=>{events.push('second');throw null;}),interaction.subscribe(()=>events.push('last'))];
  try{let caught=false;try{if(operation==='release')services.release();else interaction.dispose();}catch(error){caught=true;assert(error instanceof AggregateError);assert.deepEqual(error.errors,[undefined,null]);}assert(caught);assert.deepEqual(events,['first','second','last']);}
  finally{for(const stop of stops)stop();interaction.dispose();}
 }
});

test('one deferred native action resolves the current live callback once and never crosses a replaced node lifetime',{timeout},()=>{
 const interaction=make(),pending=[],calls=[];const button=label=>({...node(),name:label,activate(){calls.push(label);}});
 const binding=interaction.semantics.bind([button('old')],{dispatchAction(id,action,perform){assert.equal(id,'action');assert.equal(action,'activate');pending.push(perform);}});
 try{
  assert.equal(interaction.performAction('action','activate'),false);binding.update([button('current')]);pending[0]();pending[0]();assert.deepEqual(calls,['current']);
  interaction.performAction('action','activate');binding.update([{...button('disabled'),enabled:false}]);pending[1]();binding.update([button('enabled again')]);pending[1]();assert.deepEqual(calls,['current']);
  interaction.performAction('action','activate');binding.update([]);binding.update([button('replacement')]);pending[2]();assert.deepEqual(calls,['current']);
  interaction.performAction('action','activate');interaction.dispose();pending[3]();assert.deepEqual(calls,['current']);
 }finally{binding.dispose();interaction.dispose();}
});

test('reentrant action delivery and a falsey callback failure consume that native action request before user code runs',{timeout},()=>{
 for(const failure of [undefined,null,0]){
  const interaction=make();let perform,calls=0;
  const binding=interaction.semantics.bind([{...node(),activate(){calls++;if(calls===1)perform();throw failure;}}],{dispatchAction(_id,_action,callback){perform=callback;}});
  try{interaction.performAction('action','activate');expectFailure(()=>perform(),failure);perform();assert.equal(calls,1);}
  finally{binding.dispose();interaction.dispose();}
 }
});
