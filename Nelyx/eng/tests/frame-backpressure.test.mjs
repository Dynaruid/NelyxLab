// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {AppSession} from '@nelyx/core/hosting/runtime';
import {GraphiteRenderer} from '@nelyx/skia-native/renderer';
import {ResourceLease} from '@nelyx/core/hosting/resources';
import {freezeFrame} from '@nelyx/core/ui/frame';
const timeout=1_200_000;
const metrics={logicalWidth:100,logicalHeight:100,physicalWidth:100,physicalHeight:100,scale:1,viewportGeneration:1,rendererGeneration:1,nativeContextGeneration:1,nativeSurfaceGeneration:1};
function fixture({scene}={}){
  const callbacks=new Map(),notifications=[],submissions=[],errors=[];let next=0,builds=0,value=0,drawn,deny=false,nativeRecordings=0,releaseAfterHint=false,failSubmission=false;
  const clock={request(callback){const id=++next;callbacks.set(id,callback);return {dispose(){callbacks.delete(id);}};}};
  const tick=timing=>{const batch=[...callbacks.values()];callbacks.clear();batch.forEach(callback=>callback(timing));};
  const context={nelyxCoreVersion:()=>1,nelyxWireVersion:()=>11,nelyxConfigure(){},nelyxIdentity:()=>7,nelyxNotifications:()=>notifications.splice(0),nelyxReserve:()=>deny||nativeRecordings>=2?1:0,
    beginRecording:()=>({clear(color){drawn=color;}}),finishRecording:()=>({dispose(){}}),nelyxSubmit(_recording,id){if(failSubmission)throw Error('native-recording-failure');submissions.push({id,color:drawn});},nelyxCancel(){},
    nelyxClose(){nativeRecordings=0;for(const id of renderer.leases.keys())notifications.push(7,id,0);},nelyxStats:()=>{const value=[7,0,nativeRecordings,0,0];if(releaseAfterHint){releaseAfterHint=false;nativeRecordings=1;}return value;},nelyxReset(){},dispose(){}};
  const renderer=new GraphiteRenderer({Color:value=>value,Paint:()=>({setAntiAlias(){},dispose(){}})},()=>context,{id:'pressure',generation:1},{image(){throw Error('Unexpected image');},paragraph(){throw Error('Unexpected paragraph');}});
  const session=new AppSession({id:'pressure',createScene:()=>context=>{builds++;return scene?scene(context,value):[{op:'clear',color:value}];}},clock);
  const view=session.attach({id:'pressure',generation:1,metrics,renderer,ownership:'owned',onError:error=>errors.push(error)});
  return {view,renderer,session,callbacks,notifications,submissions,errors,tick,get builds(){return builds;},set value(next){value=next;},set deny(next){deny=next;},set nativeRecordings(next){nativeRecordings=next;},set releaseAfterHint(next){releaseAfterHint=next;},set failSubmission(next){failSubmission=next;}};
}

test('native retirement reentry observes the same renderer close before GPU leases and event identities retire',{timeout},async()=>{
 const f=fixture();let reentered,retired=0;
 try{
  const lease=new ResourceLease([],()=>{retired++;reentered=f.renderer.dispose();void reentered.catch(()=>{});});
  const frame=freezeFrame(f.view.capture(),[{op:'clear',color:0}]);assert.equal(f.renderer.submit(frame,lease).status,'accepted');
  const closing=f.renderer.dispose();await closing;assert.equal(reentered,closing);await reentered;
  assert.equal(retired,1);assert.equal(lease.released,true);assert.equal(f.renderer.hasPendingSubmissions,false);
 }finally{await f.session.dispose();}
});

test('close during native submission or its accepted notification waits for lease transfer and never calls a retired controller',{timeout},async()=>{
 for(const boundary of ['native','accepted','busy']){
  const f=fixture(),calls=[];let closing;
  f.view.controller={frameSubmitted(){calls.push('submitted-after-close');},dispose(){calls.push('controller-close');}};
  const close=()=>{if(!closing){calls.push('close-request');closing=f.view.dispose();void closing.catch(()=>{});}};
  const context=f.renderer.context();let observer;
  if(boundary==='accepted')observer=f.renderer.observe(event=>{if(event.kind==='submitted')close();});
  else if(boundary==='native'){const submit=context.nelyxSubmit;context.nelyxSubmit=function(...args){close();return submit.apply(this,args);};}
  else{const reserve=context.nelyxReserve;context.nelyxReserve=function(...args){close();f.deny=true;return reserve.apply(this,args);};}
  try{f.view.requestFrame();f.tick();assert(closing);await closing;assert.deepEqual(f.errors,[]);assert.deepEqual(calls,['close-request','controller-close']);assert.equal(f.renderer.leases.size,0);assert.equal(f.submissions.length,boundary==='busy'?0:1);}
  finally{observer?.dispose();await f.session.dispose();assert.equal(f.callbacks.size,0);}
 }
});

test('an unknown scheduled submission reports its native failure and retains uncertain resources until drain',{timeout},async()=>{
  const f=fixture();try{f.failSubmission=true;f.view.requestFrame();f.tick();assert.equal(f.view.status,'failed');assert.equal(f.errors.length,1);assert.match(String(f.errors[0]),/Renderer submission failed:.*native-recording-failure/);f.view.requestFrame();f.tick();assert.equal(f.errors.length,1);assert.equal(f.submissions.length,0);}
  finally{await f.session.dispose();assert.equal(f.view.status,'closed');assert.equal(f.callbacks.size,0);}
});

test('input mailbox drains updates in order before the same tick builds and treats contact, key and viewport changes as boundaries',{timeout},async()=>{
  const f=fixture(),events=[];
  f.view.controller={pointer(event){events.push([event.kind,event.deltaY,event.viewportGeneration]);f.view.requestFrame();},key(){events.push(['key']);return true;},dispose(){}};
  const packet=(kind,deltaY=0)=>({kind,pointer:4,device:'mouse',buttons:0,x:12,y:15,timestamp:100+events.length,viewportGeneration:1,deltaY});
  try{
    f.view.queuePointer(packet('wheel',.25));f.view.queuePointer(packet('wheel',-.125));assert.equal(events.length,0);assert.equal(f.callbacks.size,1);
    f.tick();assert.deepEqual(events,[['wheel',.25,1],['wheel',-.125,1]]);assert.equal(f.builds,1);assert.equal(f.view.capture().inputSequence,2);
    f.view.queuePointer(packet('move',1));f.view.queuePointer(packet('up'));assert.deepEqual(events.slice(-2).map(event=>event[0]),['move','up']);
    f.view.queuePointer(packet('wheel',2));assert(f.view.dispatchKey({kind:'down'}));assert.deepEqual(events.slice(-2).map(event=>event[0]),['wheel','key']);
    f.view.queuePointer(packet('wheel',3));f.view.updateMetrics({...metrics,viewportGeneration:2});assert.deepEqual(events.at(-1),['wheel',3,1]);
    const count=events.length;f.view.queuePointer(packet('wheel',99));f.tick();assert.equal(events.length,count,'An old epoch cannot be reassigned to current input geometry');
  }finally{await f.session.dispose();}
});
test('reentrant input cannot grow the mailbox beyond its capacity or keep an owner in an endless drain',{timeout},async()=>{
  for(const mode of ['overflow','cycle']){
    const f=fixture(),packet={kind:'wheel',pointer:4,device:'mouse',buttons:0,x:12,y:15,timestamp:10,viewportGeneration:1,deltaY:.25};
    f.view.controller={pointer(){if(mode==='overflow')for(let i=0;i<257;i++)f.view.queuePointer(packet);else f.view.queuePointer(packet);},dispose(){}};
    try{f.view.queuePointer(packet);f.tick();assert.equal(f.errors.length,1);assert.match(String(f.errors[0]),mode==='overflow'?/256-packet mailbox/:/30 batches/);assert(f.view.pointerMailbox.length<=256);}
    finally{await f.session.dispose();}
  }
});

test('a retained native front recording applies backpressure after its JS lease has retired',{timeout},async()=>{
  const f=fixture();try{
    f.view.requestFrame();f.tick();f.notifications.push(7,1,0);f.renderer.pollNotifications();assert.equal(f.renderer.leases.size,0);
    f.nativeRecordings=2;f.value=42;f.view.requestFrame();f.tick();assert.equal(f.builds,2,'Prepare one CPU frame while native still owns the front and queued frame');
    f.value=99;f.view.requestFrame();f.tick();f.tick();assert.equal(f.builds,2,'Full native ownership must not repeatedly rebuild the prepared frame');
    f.nativeRecordings=1;f.tick();assert.equal(f.builds,3);assert.deepEqual(f.submissions.map(frame=>frame.color),[0,99],'The obsolete CPU frame was never submitted and must not delay new state');
  }finally{await f.session.dispose();}
});
test('native backpressure coalesces scene work and resumes with the latest state and viewport after real retirement',{timeout},async()=>{
  const f=fixture();try{
    for(let i=0;i<2;i++){f.value=i;f.view.requestFrame();f.tick();}assert.equal(f.builds,2);assert.equal(f.renderer.leases.size,2);
    for(let i=0;i<12;i++){f.value=i+2;f.view.requestFrame();f.tick();}
    assert.equal(f.builds,3,'Full native slots keep exactly one prepared CPU scene');assert.equal(f.submissions.length,2);assert.equal(f.callbacks.size,1);
    f.value=99;f.view.updateMetrics({...metrics,logicalWidth:200,physicalWidth:200,viewportGeneration:2});
    f.notifications.push(7,1,0);f.tick();assert.equal(f.builds,4);assert.equal(f.submissions.at(-1).color,99);assert.equal(f.view.currentMetrics.viewportGeneration,2);assert.equal(f.renderer.leases.size,2);assert.deepEqual(f.errors,[]);
  }finally{await f.session.dispose();assert.equal(f.renderer.leases.size,0);assert.equal(f.callbacks.size,0);}
});

test('a credit becoming free after a busy hint cannot submit obsolete input before the replacement tick',{timeout},async()=>{
  const f=fixture();try{
    f.nativeRecordings=2;f.value=42;f.view.requestFrame();f.tick();
    f.value=99;f.view.requestFrame();f.releaseAfterHint=true;f.tick();
    assert.equal(f.builds,1);assert.deepEqual(f.submissions,[]);assert.equal(f.callbacks.size,1);
    f.tick();assert.equal(f.builds,2);assert.deepEqual(f.submissions.map(frame=>frame.color),[99]);
  }finally{await f.session.dispose();}
});

test('replacing an obsolete CPU frame holds its resources through capture and retires them without native submission',{timeout},async()=>{
  for(const fail of [false,true]){
    const resource={id:'obsolete-cpu-paragraph',generation:1,kind:'paragraph'};let retired=0,captures=0;
    const f=fixture({scene(context,value){if(value===42)return [{op:'paragraph',resource,x:0,y:0}];captures++;assert(context.resources.isRetained(resource),'Old caller lease must survive the replacement scene callback');if(fail)throw Error('replacement-scene-failure');return [{op:'clear',color:value}];}});
    f.session.resources.register(resource,()=>retired++);
    try{
      f.nativeRecordings=2;f.value=42;f.view.requestFrame();f.tick();f.session.resources.releaseProducer(resource);
      for(const value of [55,66,99]){f.value=value;f.view.requestFrame();f.tick();}
      assert.equal(captures,0);assert.equal(retired,0);assert.equal(f.builds,1);
      f.nativeRecordings=1;f.tick();assert.equal(captures,1);
      if(fail){assert.equal(f.view.status,'failed');assert.match(String(f.errors[0]),/replacement-scene-failure/);assert.equal(retired,0);assert.deepEqual(f.submissions,[]);}
      else{assert.deepEqual(f.errors,[]);assert.equal(retired,1);assert.deepEqual(f.submissions.map(frame=>frame.color),[99]);}
    }finally{await f.session.dispose();}
    assert.equal(retired,1);assert.equal(f.renderer.leases.size,0);assert.equal(f.callbacks.size,0);
  }
});
test('a close reentered by capture, controller admission or old-frame retirement cannot strand a replacement lease',{timeout},async()=>{
 for(const boundary of ['capture','admission','retirement','pump']){
  const next={id:'close-during-'+boundary,generation:1,kind:'paragraph'},old={id:'old-before-close',generation:1,kind:'paragraph'};let closing,retired=0,closed=false;
  const close=()=>{if(!closed){closed=true;closing=f.view.dispose();void closing.catch(()=>{});}};
  const f=fixture({scene(_context,value){if(boundary==='retirement'&&value===42)return [{op:'paragraph',resource:old,x:0,y:0}];return [{get op(){if(boundary==='capture')close();return 'paragraph';},resource:next,x:0,y:0}];}});
  f.session.resources.register(next,()=>retired++);f.session.resources.register(old,close);
  try{
   f.nativeRecordings=2;
   if(boundary==='retirement'){f.value=42;f.view.requestFrame();f.tick();f.session.resources.releaseProducer(old);f.nativeRecordings=1;f.value=99;}
   if(boundary==='pump'){f.view.requestFrame();f.tick();}
   if(boundary==='admission'||boundary==='pump')f.view.controller={shouldSubmitFrame(){close();return true;},dispose(){}};
   if(boundary==='pump')f.view.pump();else{f.view.requestFrame();f.tick();}assert(closed,'The close callback must run');await closing;
   f.session.resources.releaseProducer(next);assert.equal(retired,1,'The replacement must return its caller hold before the closed View completes');
   assert.deepEqual(f.submissions,[]);assert.deepEqual(f.errors,[]);
  }finally{await f.session.dispose();assert.equal(f.callbacks.size,0);}
 }
});
test('replacement failure retains both falsey old-frame retirement and new-lease cleanup errors',{timeout},async()=>{
 const old={id:'old-retirement-failure',generation:1,kind:'paragraph'},next={id:'new-retirement-failure',generation:1,kind:'paragraph'};
 const f=fixture({scene(_context,value){return [{op:'paragraph',resource:value===42?old:next,x:0,y:0}];}});
 f.session.resources.register(old,()=>{f.session.resources.releaseProducer(next);throw 0;});f.session.resources.register(next,()=>{throw undefined;});
 try{
  f.nativeRecordings=2;f.value=42;f.view.requestFrame();f.tick();f.session.resources.releaseProducer(old);
  f.nativeRecordings=1;f.value=99;f.view.requestFrame();f.tick();assert.equal(f.errors.length,1);assert(f.errors[0] instanceof AggregateError);const errors=f.errors[0].errors;assert.equal(errors.length,2);assert(errors.every(error=>error instanceof AggregateError));assert.deepEqual(errors[0].errors,[0]);assert.deepEqual(errors[1].errors,[undefined]);assert.deepEqual(f.submissions,[]);
 }finally{await f.session.dispose();assert.equal(f.callbacks.size,0);}
});
test('controller admission failure preserves its original falsey error alongside caller lease retirement',{timeout},async()=>{
 const resource={id:'admission-retirement-failure',generation:1,kind:'paragraph'},f=fixture({scene(){return [{op:'paragraph',resource,x:0,y:0}];}});
 f.session.resources.register(resource,()=>{throw undefined;});
 try{
  f.nativeRecordings=2;f.view.requestFrame();f.tick();f.session.resources.releaseProducer(resource);f.view.controller={shouldSubmitFrame(){throw 0;},dispose(){}};
  assert.throws(()=>f.view.pump(),error=>error instanceof AggregateError&&error.errors[0]===0&&error.errors[1] instanceof AggregateError&&error.errors[1].errors.length===1&&error.errors[1].errors[0]===undefined);
 }finally{await f.session.dispose();}
});
test('submit remains authoritative when native admission changes after the build hint',{timeout},async()=>{
  const f=fixture();try{
    f.deny=true;f.value=17;f.view.requestFrame();f.tick();assert.equal(f.builds,1);assert.equal(f.submissions.length,0);assert.equal(f.renderer.leases.size,0);
    f.tick();assert.equal(f.builds,1,'A busy caller-owned frame retries without another invalidation');
    f.deny=false;f.tick();assert.equal(f.builds,1);assert.equal(f.submissions[0].color,17);assert.equal(f.renderer.leases.size,1);
  }finally{await f.session.dispose();}
});

test('a forced input-geometry frame observes current state while native admission is blocked',{timeout},async()=>{
  const f=fixture();try{
    f.nativeRecordings=2;f.value=42;f.view.requestFrame();f.tick();assert.equal(f.builds,1);
    f.value=99;f.view.requestForcedFrame();f.tick();assert.equal(f.builds,2,'Input geometry must not wait for an old prepared GPU frame');assert.equal(f.submissions.length,0);
    f.nativeRecordings=1;f.tick();assert.equal(f.builds,2);assert.deepEqual(f.submissions.map(frame=>frame.color),[99]);
  }finally{await f.session.dispose();}
});

test('optional work admission reads live native/input/visibility state and is absent without an observed deadline',{timeout},async()=>{
 const timing={tick:10,dispatch:10,queueDelay:0,clockUncertainty:0,observedDeadline:30};
 for(const scenario of ['missing','native-busy','input-backlog','forced','generation']){
  let guard,before,after;let f;
  f=fixture({scene:context=>{guard=context.canRunOptionalWork;before=guard?.();if(scenario==='input-backlog'){f.view.queuePointer({kind:'wheel',pointer:1,device:'mouse',buttons:0,x:1,y:1,timestamp:10,viewportGeneration:1,deltaY:1});after=guard();}return [{op:'clear',color:1}];}});
  try{
   f.view.requestFrame();
   if(scenario==='native-busy')f.nativeRecordings=2;
   if(scenario==='forced')f.view.requestForcedFrame();
   f.tick(scenario==='missing'?undefined:timing);
   assert.equal(f.builds,1);assert.deepEqual(f.errors,[]);
   if(scenario==='missing')assert.equal(guard,undefined);else if(scenario==='native-busy'||scenario==='forced')assert.equal(before,false);else assert.equal(before,true);
   if(scenario==='input-backlog')assert.equal(after,false);
   if(scenario==='generation'){f.view.updateMetrics({...metrics,viewportGeneration:2});assert.equal(guard(),false);}
   f.view.setVisible(false);if(guard)assert.equal(guard(),false);
  }finally{await f.session.dispose();assert.equal(f.callbacks.size,0);}
  if(guard)assert.equal(guard(),false,'Closing does not call a disposed native admission API');
 }
});
test('resume discards a prepared pre-hide frame and builds the latest visible state',{timeout},async()=>{
  const f=fixture();try{
    f.nativeRecordings=2;f.value=42;f.view.requestFrame();f.tick();assert.equal(f.builds,1);assert.equal(f.submissions.length,0);
    f.view.setVisible(false);f.value=99;f.view.requestFrame();assert.equal(f.callbacks.size,0);
    f.nativeRecordings=1;f.view.setVisible(true);f.tick();assert.equal(f.builds,2);assert.deepEqual(f.submissions.map(frame=>frame.color),[99]);
  }finally{await f.session.dispose();}
});
test('closing a blocked view cancels retries and an invalid retirement still fails its owner',{timeout},async()=>{
  const f=fixture();try{
    for(let i=0;i<2;i++){f.view.requestFrame();f.tick();}f.view.requestFrame();f.tick();const late=[...f.callbacks.values()][0];
    f.session.beginClose();late();assert.equal(f.builds,3);assert.equal(f.callbacks.size,0);
  }finally{await f.session.dispose();}
  const g=fixture();try{g.view.requestFrame();g.notifications.push(999,1,0);g.tick();assert.equal(g.builds,1);assert.equal(g.view.status,'failed');assert.equal(g.errors.length,1);}finally{await g.session.dispose();}
});
