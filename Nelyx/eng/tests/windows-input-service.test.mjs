// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';
import {WindowsInputService} from '../../sdk/dist/platforms/windows/input-service.js';
import {NativeInteraction} from '../../sdk/dist/runtime/native-interaction.js';
import {PendingDisposalError} from '@nelyx/core/foundation/disposable';
const timeout=1_200_000;
const defer=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const owner={id:'windows-service-sdk',generation:1},interaction=new NativeInteraction(owner,{commands:true,selectionEvents:true,semantics:'native-controls',nativeSnapshots:true,geometry:'unavailable'}),changed=[],reports=[],commands=[],closes=[],listeners=new Set();let identity=10,opening,disconnecting;
 const events={addListener(name,callback){assert.equal(name,'nelyxWindowsInput');listeners.add(callback);return {remove(){listeners.delete(callback);}};}};
 const module={getInputProtocol:()=>3,insertText:async()=>({status:"unavailable",revision:0}),connect:async()=>++identity,openClient:async(...args)=>{commands.push(['open',...args]);return opening?await opening.promise:true;},configureClient:async(...args)=>{commands.push(['configure',...args]);return true;},command:async(...args)=>{commands.push(['command',...args]);return true;},closeClient:async(...args)=>{closes.push(args);return true;},disconnect:async(...args)=>{commands.push(['disconnect',...args]);return disconnecting?await disconnecting.promise:true;}};
 const initial={session:owner,text:'seed',selection:{anchor:4,focus:0},revision:0,source:'programmatic',composing:{status:'none'}};let binding=interaction.editing.bind(owner,initial,value=>changed.push(value),{id:'field'});
 return {owner,interaction,changed,reports,commands,closes,listeners,module,events,get binding(){return binding;},set opening(value){opening=value;},set disconnecting(value){disconnecting=value;},connect:()=>WindowsInputService.connect(interaction,module,events,97,error=>reports.push(error)),emit(service,client,type,value){for(const listener of [...listeners])listener({service,client,type,value});},async close(){binding.dispose();interaction.dispose();},snapshot(revision,text='seed',extra={}){return {revision,text,anchor:text.length,focus:0,source:'native',composingStart:-1,composingEnd:-1,...extra};}};
}
test('Windows SDK service normalizes receipt ids and handles a same-revision TSF rejection without another edit',{timeout},async()=>{
 const f=fixture(),service=await f.connect();let client;
 try{
  client=await service.attach('field',{maximum:4096,scope:0});f.binding.focus();f.binding.replace({...f.binding.read(),text:'한😀',selection:{anchor:3,focus:1}},73);
  const first=f.commands.findLast(row=>row[0]==='command'&&row[3]==='replace');assert.deepEqual(first.slice(1,4),[service.identity,client.client,'replace']);assert.deepEqual(first[4],['한😀',3,1,0,1]);
  f.emit(service.identity,client.client,'editing',f.snapshot(1,'seed',{focused:true}));const before=f.binding.read();
  f.emit(service.identity,client.client,'editing',f.snapshot(1,'seed',{focused:true,source:'programmatic',request:1,rejection:'stale'}));const retry=f.commands.findLast(row=>row[0]==='command'&&row[3]==='replace');assert.deepEqual(retry[4],['한😀',3,1,1,2]);assert.equal(f.binding.read(),before,'A same-revision receipt is not a new editing value');assert.deepEqual(f.changed,[]);
  f.emit(service.identity,client.client,'editing',f.snapshot(2,'한😀',{anchor:3,focus:1,focused:true,source:'programmatic',request:2}));assert.equal(f.changed.length,1);assert.deepEqual(f.binding.read().selection,{anchor:3,focus:1});
  f.binding.replace({...f.binding.read(),text:'implicit',selection:{anchor:8,focus:0}});const implicit=f.commands.findLast(row=>row[0]==='command'&&row[3]==='replace');f.emit(service.identity,client.client,'editing',f.snapshot(3,'implicit',{focused:true,source:'programmatic',request:implicit[4][4]}));assert.equal(f.changed.at(-1).text,'implicit','An adapter-generated native request id still acknowledges a caller without an explicit id');
  await client.dispose();const text=f.binding.read().text;f.emit(service.identity,client.client,'editing',f.snapshot(100,'retired'));assert.equal(f.binding.read().text,text);assert.equal(f.reports.length,0);assert.deepEqual(f.closes,[[service.identity,client.client]]);
 }finally{await service.dispose();await f.close();}
});
test('Windows service fences pending opens, waits for native close and rejects foreign handles',{timeout},async()=>{
 const f=fixture(),service=await f.connect();try{
  const nativeOpen=defer();f.opening=nativeOpen;const opening=service.attach('field',{maximum:4096,scope:0});f.binding.dispose();nativeOpen.resolve(true);const client=await opening;assert.equal(f.closes.length,1,'A Core client removed during native open is closed without attaching a port');await client.dispose();
  const nativeClose=defer();f.disconnecting=nativeClose;const closing=service.dispose();assert.equal(f.listeners.size,0);await assert.rejects(f.connect(),/already connected/);nativeClose.resolve(true);await closing;
  const next=await f.connect();assert(next.identity>service.identity);await assert.rejects(next.configure(client,{enabled:true,readOnly:false,multiline:false,scope:0}),/retired/);await next.dispose();assert.equal(f.reports.length,0);
 }finally{await service.dispose();await f.close();}
});
test('Windows same-revision rejection checks request identity, document equality and retry limit',{timeout},async()=>{
 const f=fixture(),rejections=[];f.binding.dispose();const binding=f.interaction.editing.bind(f.owner,{session:f.owner,text:'seed',selection:{anchor:4,focus:0},revision:0,source:'programmatic',composing:{status:'none'}},value=>f.changed.push(value),{id:'field',synchronizationRejected:(...args)=>rejections.push(args)}),service=await f.connect();
 try{
  const client=await service.attach('field',{maximum:4096,scope:0});binding.replace({...binding.read(),text:'new',selection:{anchor:3,focus:0}},90);
  for(let request=1;request<=4;request++)f.emit(service.identity,client.client,'editing',f.snapshot(0,'seed',{source:'programmatic',request,rejection:'stale'}));assert.deepEqual(rejections,[[90,'retry-limit']]);assert.equal(f.commands.filter(row=>row[3]==='replace').length,4);assert.equal(binding.read().revision,0);assert.equal(f.changed.length,0);
  binding.replace({...binding.read(),text:'next',selection:{anchor:4,focus:0}},91);const native=f.commands.findLast(row=>row[3]==='replace')[4][4];f.emit(service.identity,client.client,'editing',f.snapshot(0,'wrong',{source:'programmatic',request:native,rejection:'stale'}));assert.equal(f.reports.length,1);assert.match(String(f.reports[0]),/without a revision/);await service.dispose();
 }finally{await service.dispose();binding.dispose();await f.close();}
});

test('a partially connected native service keeps its owner until failed cleanup is explicitly retried',{timeout},async()=>{
 const f=fixture(),failure=new Error('Native retirement failed');let closing=0;
 const module={...f.module,disconnect:async()=>{if(++closing===1)throw failure;return true;}},events={addListener(){throw new Error('Native event subscription failed');}};
 try{
  let pending;try{await WindowsInputService.connect(f.interaction,module,events,97,error=>f.reports.push(error));assert.fail('Subscription failure must reject connect');}catch(error){pending=error;}
  assert(pending instanceof PendingDisposalError);assert.equal(closing,1);await assert.rejects(f.connect(),/already connected/);await pending.retry();assert.equal(closing,2);
  const replacement=await f.connect();await replacement.dispose();assert.equal(f.reports.length,0);
 }finally{await f.close();}
});

test('key fences require both the native promise and editing receipt, in either arrival order',{timeout},async()=>{
 const f=fixture(),service=await f.connect();try{
  const client=await service.attach('field',{maximum:4096,scope:0});
  for(const receiptFirst of [false,true]){
   const command=defer();f.module.command=()=>command.promise;
   f.binding.replace({...f.binding.read(),text:'next'+receiptFirst,selection:{anchor:2,focus:2}});
   const request=receiptFirst?2:1;let flushed=false;const flushing=service.flush().then(()=>{flushed=true;});
   if(receiptFirst)f.emit(service.identity,client.client,'editing',f.snapshot(request,'next'+receiptFirst,{source:'programmatic',request,anchor:2,focus:2}));else command.resolve(true);
   await turn();assert.equal(flushed,false,'One side of an edit must not release the following key');
   if(receiptFirst)command.resolve(true);else f.emit(service.identity,client.client,'editing',f.snapshot(request,'next'+receiptFirst,{source:'programmatic',request,anchor:2,focus:2}));
   await flushing;assert.equal(flushed,true);
  }
  assert.equal(f.reports.length,0);
 }finally{await service.dispose();await f.close();}
});
test('a late old receipt releases its fence without replacing newer native text',{timeout},async()=>{
 const f=fixture(),service=await f.connect();try{
  const client=await service.attach('field',{maximum:4096,scope:0});f.binding.replace({...f.binding.read(),text:'old Core',selection:{anchor:0,focus:0}});
  f.emit(service.identity,client.client,'editing',f.snapshot(2,'new native',{focused:true}));const newest=f.binding.read();let flushed=false;const flushing=service.flush().then(()=>{flushed=true;});await turn();assert.equal(flushed,false);
  f.emit(service.identity,client.client,'editing',f.snapshot(1,'old Core',{source:'programmatic',request:1}));await flushing;assert.equal(f.binding.read(),newest);assert.equal(f.reports.length,0);
 }finally{await service.dispose();await f.close();}
});
test('rapid implicit Core replacements do not mistake the older receipt for the latest command',{timeout},async()=>{
 const f=fixture(),service=await f.connect();try{
  const client=await service.attach('field',{maximum:4096,scope:0});f.binding.replace({...f.binding.read(),text:'first',selection:{anchor:5,focus:5}});f.binding.replace({...f.binding.read(),text:'second',selection:{anchor:6,focus:6}});
  f.emit(service.identity,client.client,'editing',f.snapshot(1,'first',{source:'programmatic',request:1,anchor:5,focus:5}));assert.equal(f.reports.length,0);assert.equal(f.changed.length,0,'A superseded Core command is not the current controller acknowledgement');
  f.emit(service.identity,client.client,'editing',f.snapshot(2,'second',{source:'programmatic',request:2,anchor:6,focus:6}));await service.flush();assert.equal(f.binding.read().text,'second');assert.equal(f.changed.length,1);assert.equal(f.reports.length,0);
 }finally{await service.dispose();await f.close();}
});
test('printable text waits for native observation and retries only an explicit TSF lock',{timeout},async()=>{
 const f=fixture(),service=await f.connect();try{
  const client=await service.attach('field',{maximum:4096,scope:0});f.emit(service.identity,client.client,'editing',f.snapshot(1,'seed',{focused:true}));
  const calls=[],applied=defer();f.module.insertText=async(...args)=>{calls.push(args);if(calls.length===2)applied.resolve();return {status:calls.length===1?'busy':'applied',revision:calls.length===1?1:2};};
  let done=false;const writing=service.keyboardText('한😀',5).then(()=>{done=true;});await applied.promise;await turn();assert.equal(calls.length,2);assert.equal(done,false);assert.deepEqual(calls[1],[service.identity,client.client,'한😀',1,5]);
  f.emit(service.identity,client.client,'editing',f.snapshot(2,'한😀',{anchor:3,focus:3,focused:true}));await writing;assert.equal(f.binding.read().text,'한😀');
  f.module.insertText=async()=>({status:'unavailable',revision:2});await service.keyboardText('ignored',5);assert.equal(f.binding.read().text,'한😀');
  f.module.insertText=async()=>({status:'stale',revision:3});await assert.rejects(service.keyboardText('late',5),/revision/);assert.equal(f.binding.read().text,'한😀');assert.equal(f.reports.length,0);
 }finally{await service.dispose();await f.close();}
});
test('retirement releases a key fence even while a native promise is unresolved',{timeout},async()=>{
 const f=fixture(),service=await f.connect();try{
  await service.attach('field',{maximum:4096,scope:0});const command=defer();f.module.command=()=>command.promise;f.binding.replace({...f.binding.read(),text:'pending',selection:{anchor:0,focus:0}});
  const flushing=assert.rejects(service.flush(),/retired/);await service.dispose();await flushing;command.resolve(true);await turn();assert.equal(f.reports.length,0);
 }finally{await service.dispose();await f.close();}
});
test('retirement cancels waiting for an unresolved printable-text operation',{timeout},async()=>{
 const f=fixture(),service=await f.connect();try{
  const client=await service.attach('field',{maximum:4096,scope:0});f.emit(service.identity,client.client,'editing',f.snapshot(1,'seed',{focused:true}));const native=defer();f.module.insertText=()=>native.promise;
  const writing=assert.rejects(service.keyboardText('x',5),/retired/);await turn();await service.dispose();await writing;native.resolve({status:'applied',revision:2});assert.equal(f.binding.read().text,'seed');assert.equal(f.reports.length,0);
 }finally{await service.dispose();await f.close();}
});
test('an unresolved native command cannot hold the following key beyond its acknowledgement deadline',{timeout},async()=>{
 const f=fixture(),service=await f.connect(),command=defer();try{
  await service.attach('field',{maximum:4096,scope:0});f.module.command=()=>command.promise;f.binding.replace({...f.binding.read(),text:'pending',selection:{anchor:0,focus:0}});await assert.rejects(service.flush(),/timed out/);assert.equal(f.binding.read().text,'seed');
 }finally{command.resolve(true);await service.dispose();await f.close();}
});
test('ongoing TSF coordinate replies cannot starve a completed document key fence',{timeout},async()=>{
 const f=fixture(),service=await f.connect(),layout=defer();try{
  const client=await service.attach('field',{maximum:4096,scope:0}),coordinates=[];f.module.command=async(...args)=>{if(args[2]!=='geometry')return true;coordinates.push(args);return await layout.promise;};
  f.binding.replace({...f.binding.read(),text:'next',selection:{anchor:4,focus:4}});f.emit(service.identity,client.client,'editing',f.snapshot(1,'next',{source:'programmatic',request:1,anchor:4,focus:4}));
  // Real Core frame publication sends geometry through the attached port.
  // Keep that native reply unresolved while the observed edit is complete.
  f.binding.updateGeometry(null);assert(coordinates.length>0);await service.flush();assert.equal(f.binding.read().text,'next');assert.equal(f.reports.length,0);
 }finally{layout.resolve(true);await service.dispose();await f.close();}
});
