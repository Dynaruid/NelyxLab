// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {AppSession} from '@nelyx/core/hosting/runtime';
import {WebSkiaLibrary} from '@nelyx/skia-web/library';

const timeout=1_200_000;
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
