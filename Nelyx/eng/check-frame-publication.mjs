// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';

if (!process.argv.includes('--child')) {
  await execute(process.execPath, [import.meta.filename, '--child'], {
    cwd: process.cwd(),
    timeout: 1_200_000,
  });
} else {
  const bundle = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
import assert from 'node:assert/strict';
import {AppSession} from './Nelyx/src/hosting/runtime.ts';
import {FrameworkRoot} from './Nelyx/src/framework/widgets/root.ts';
import {LeafRenderObjectWidget} from './Nelyx/src/framework/widgets/framework.ts';
import {Builder} from './Nelyx/src/framework/widgets/basic.ts';
import {Directionality} from './Nelyx/src/framework/widgets/app-data.ts';
import {Semantics} from './Nelyx/src/framework/widgets/semantics.ts';
import {RenderBox} from './Nelyx/src/framework/rendering/object.ts';
import {PointerDownEvent,PointerUpEvent,PointerCancelEvent} from './Nelyx/src/framework/gestures/events.ts';
import {FrameRecording} from './Nelyx/src/ui/frame.ts';
import {Paint} from './Nelyx/src/ui/paint.ts';
import {UniqueKey} from './Nelyx/src/foundation/key.ts';
import {FoundationPlatform} from './Nelyx/src/foundation/platform.ts';
import {FlutterError} from './Nelyx/src/foundation/flutter-error.ts';

FoundationPlatform.configure({kind:'native',operatingSystem:'windows'});
const previousError=FlutterError.onError;
FlutterError.onError=details=>{throw details.exception;};
const metrics={logicalWidth:120,logicalHeight:80,physicalWidth:120,physicalHeight:80,scale:1,viewportGeneration:1,rendererGeneration:1,nativeContextGeneration:1,nativeSurfaceGeneration:1};
const capture=FrameRecording.capture;
let active;
FrameRecording.capture=function(token,canvas){
  const recording=capture.call(this,token,canvas);
  if(active){active.sealed=true;active.tokens.push(token);active.events.push('seal');}
  return recording;
};

function harness({credit=true}={}){
  let now=0,nextTask=0,element,context,root,child;
  const tasks=new Map(),leases=new Set(),attempts=[],accepted=[],errors=[],observations=[];
  const state={credit,sealed:false,tokens:[],events:[],pointers:[],retired:[],nodes:[],geometry:null,paint:null};
  class ProbeBox extends RenderBox {
    constructor(id){super();this.id=id;}
    performLayout(constraints){state.events.push('layout:'+this.id);return constraints.constrain({width:80,height:60});}
    paint(canvas){state.events.push('paint:'+this.id);state.paint?.();const paint=new Paint();paint.color=this.id==='old'?0xff126734:0xffabcdef;canvas.drawRect({x:0,y:0,...this.size},paint);}
    hitTestSelf(){return true;}
    handleEvent(event){assert(!state.retired.includes(this.id),'Input reached a retired target');state.pointers.push(this.id+':'+(event instanceof PointerDownEvent?'down':event instanceof PointerUpEvent?'up':event instanceof PointerCancelEvent?'cancel':'other'));}
    didCommitTextInputGeometry(){assert(state.sealed,'Input coordinates were published before frame seal');state.events.push('geometry:'+this.id);state.geometry?.();}
    dispose(){state.retired.push(this.id);super.dispose();}
  }
  class ProbeWidget extends LeafRenderObjectWidget {
    constructor(id){super(new UniqueKey());this.id=id;}
    createRenderObject(){return new ProbeBox(this.id);}
  }
  const widget=id=>new Semantics({container:true,label:id,button:true,child:new ProbeWidget(id)});
  child=widget('old');
  const clock={request(callback){const id=++nextTask;tasks.set(id,callback);return {dispose(){tasks.delete(id);}};}};
  const publish=nodes=>{assert(state.sealed,'Semantics were published before frame seal');assert(state.events.some(event=>event.startsWith('geometry:')),'Semantics preceded geometry publication');state.events.push('semantics');state.nodes=nodes;};
  const session=new AppSession({id:'publication',createView(value){context=value;root=new FrameworkRoot(value,{id:'publication',createRoot:()=>new Directionality('ltr',new Builder(value=>{element=value;return child;}))});return root;}},clock);
  const renderer={
    capabilities:{notifications:'unavailable'},
    canBuildFrame(){return state.credit;},
    updateMetrics(){},
    submit(frame,lease){leases.add(lease);attempts.push(frame);state.events.push('submit');if(!state.credit)return {status:'rejected',reason:'busy'};lease.transfer();lease.returnBy('renderer');accepted.push(frame);return {status:'accepted',submission:accepted.length};},
    dispose(){throw Error('Borrowed renderer was disposed');},
  };
  const unavailable=()=>{throw Error('Unexpected text/editing service use');};
  const view=session.attach({id:'publication',generation:1,metrics,renderer,ownership:'borrowed',onError:error=>errors.push(error),observeInput:event=>observations.push(event),services:{
    assets:new Map(),clock:{now:()=>now},text:{layout:unavailable,range:unavailable,hit:unavailable},
    editing:{capabilities:{indexUnit:'utf16',composing:'unavailable',selectionDirection:'unavailable'},bind:unavailable,dispose(){}},
    semantics:{capability:'native-controls',bind(nodes){publish(nodes);return {update:publish,dispose(){state.nodes=[];}};},dispose(){}},
  }});
  return {
    state,view,root,session,attempts,accepted,errors,observations,leases,
    tick(){assert(tasks.size,'Expected an owned frame callback');const batch=[...tasks];tasks.clear();state.sealed=false;state.events=[];active=state;now+=16;try{for(const [,callback] of batch)callback();}finally{active=undefined;}},
    update(id){child=widget(id);element.markNeedsBuild();},
    force(){context.requestForcedFrame();},
    pointer(kind,pointer=1){view.dispatchPointer({kind,pointer,x:10,y:10,device:'touch',buttons:kind==='up'?0:1,timestamp:++now,viewportGeneration:view.currentMetrics.viewportGeneration});},
    async close(){await session.dispose();assert.equal(view.status,'closed');assert.equal(tasks.size,0,'Owned frame work survived close');for(const lease of leases)assert(lease.released,'A CPU frame lease survived close');},
  };
}

try {
  const current=harness();
  try {
    current.view.requestFrame();current.tick();assert.deepEqual(current.errors,[]);
    const first=current.accepted[0],token=first.token;
    assert(current.root.canSubmitPreparedFrame(token),'Captured token copies must retain their CPU scope');
    assert(!current.root.canSubmitPreparedFrame({...token,owner:{...token.owner,generation:2}}),'Foreign View generation reused a prepared frame');
    assert(!current.root.canSubmitPreparedFrame({...token,owner:{...token.owner,id:'other'}}),'Foreign View identity reused a prepared frame');
    assert(!current.root.canSubmitPreparedFrame({...token,inputSequence:token.inputSequence+1}),'Different input sequence reused a prepared frame');
    assert(!current.root.canSubmitPreparedFrame({...token,inputTimestamp:123}),'Different input timestamp reused a prepared frame');
    const firstCommands=JSON.stringify(first.commands);
    current.pointer('down');current.update('new');current.tick();assert.deepEqual(current.errors,[]);
    assert.equal(JSON.stringify(first.commands),firstCommands,'A later build mutated the older sealed frame');
    assert(!current.root.canSubmitPreparedFrame(token),'Older production generation remained current');
    assert(current.root.canSubmitPreparedFrame(current.accepted.at(-1).token));
    assert.equal(current.state.retired.filter(id=>id==='old').length,1);
    const before=current.state.pointers.length;current.pointer('up');
    assert.equal(current.state.pointers.length,before,'An old stream was retargeted to new content');
    current.pointer('down',2);current.pointer('up',2);
    assert(current.state.pointers.includes('new:down'),'New contacts missed the new live target: '+JSON.stringify(current.state.pointers));
    assert.equal(current.observations.filter(event=>event.stage==='dispatch-begin').length,4);
    assert.equal(current.observations.filter(event=>event.stage==='dispatch-end').length,4);
    assert(!current.observations.some(event=>event.stage==='drop'),'An admitted contact packet was dropped');
    current.view.updateMetrics({...current.view.currentMetrics,viewportGeneration:2,physicalWidth:140,logicalWidth:140});
    assert(!current.root.canSubmitPreparedFrame(current.accepted.at(-1).token),'Resized View reused a prior viewport');
    current.tick();assert.deepEqual(current.errors,[]);
  } finally {await current.close();}

  // GPU admission is not CPU publication. Forced input geometry must still
  // replace a busy pending frame, without transferring either lease early.
  const busy=harness({credit:false});
  try {
    busy.view.requestFrame();busy.tick();const old=busy.attempts[0],oldLease=[...busy.leases][0];
    assert.equal(busy.accepted.length,0);assert(!oldLease.released);
    busy.update('new');busy.tick();assert.equal(busy.state.tokens.length,1,'Busy polling rebuilt the same pending CPU frame');
    busy.force();busy.tick();assert.deepEqual(busy.errors,[]);
    assert.equal(busy.state.tokens.length,2,'Forced geometry did not complete a fresh CPU frame');
    assert(oldLease.released,'Replacement retained the superseded caller lease');
    assert.equal(busy.accepted.length,0,'CPU publication fabricated GPU acceptance');
    assert(busy.state.nodes.some(node=>node.name==='new'),'Forced frame did not publish current semantics');
    const replacement=busy.attempts.at(-1);assert(replacement.token.sequence>old.token.sequence);
    busy.state.credit=true;busy.tick();assert.equal(busy.accepted.length,1);
    assert.equal(busy.accepted[0],replacement,'Credit wake replaced an already current CPU frame');
  } finally {await busy.close();}

  const closing=harness();
  try {
    closing.view.requestFrame();closing.tick();const attempts=closing.attempts.length;
    closing.state.geometry=()=>closing.session.beginClose();closing.update('closing');closing.tick();
    assert.equal(closing.view.status,'closing');assert.equal(closing.attempts.length,attempts,'Reentrant close admitted a new frame');
    assert(!closing.state.events.includes('semantics'),'Reentrant close published semantics after its admission gate');
    const before=closing.state.pointers.length;closing.pointer('down');assert.equal(closing.state.pointers.length,before);
    assert.equal(closing.observations.at(-1).stage,'drop');assert.equal(closing.observations.at(-1).reason,1);
  } finally {await closing.close();}

  const failing=harness(),failure=new Error('paint production failed');
  try {
    failing.view.requestFrame();failing.tick();const attempts=failing.attempts.length;
    failing.state.paint=()=>{throw failure;};failing.update('failed');failing.tick();
    assert.equal(failing.view.status,'failed');assert.equal(failing.errors.length,1);assert.equal(failing.errors[0],failure);
    assert.equal(failing.attempts.length,attempts,'Failed production admitted a frame');
    assert(!failing.state.events.some(event=>event==='seal'||event.startsWith('geometry:')||event==='semantics'),'Failed production published a partial snapshot');
  } finally {await failing.close();}

  console.log('FRAME_PUBLICATION PASS: exact View/input scope, sealed frame immutability, target retirement, viewport invalidation, forced geometry under GPU backpressure, lease replacement, reentrant close and production failure.');
} finally {FrameRecording.capture=capture;FlutterError.onError=previousError;}
`,
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    logLevel: 'silent',
  });
  try {
    await import(
      'data:text/javascript;base64,' +
        Buffer.from(bundle.outputFiles[0].contents).toString('base64')
    );
  } catch (error) {
    console.error('FRAME_PUBLICATION_FAIL ' + error.message);
    process.exitCode = 1;
  }
}
