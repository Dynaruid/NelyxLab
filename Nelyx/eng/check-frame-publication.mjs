// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';

const preparationPrototype = process.argv.includes('--preparation-prototype');
if (!process.argv.includes('--child')) {
  await execute(
    process.execPath,
    [import.meta.filename, '--child', ...(preparationPrototype ? ['--preparation-prototype'] : [])],
    { cwd: process.cwd(), timeout: 1_200_000 },
  );
} else {
  const bundle = await build({
    define: { PREPARATION_PROTOTYPE: JSON.stringify(preparationPrototype) },
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
import assert from 'node:assert/strict';
import {AppSession} from './Nelyx/src/hosting/runtime.ts';
import {FrameworkRoot} from './Nelyx/src/framework/widgets/root.ts';
import {Element,Widget,LeafRenderObjectWidget,RenderObjectElement,SingleChildRenderObjectWidget,State,StatefulWidget} from './Nelyx/src/framework/widgets/framework.ts';
import {Builder} from './Nelyx/src/framework/widgets/basic.ts';
import {Directionality} from './Nelyx/src/framework/widgets/app-data.ts';
import {Semantics} from './Nelyx/src/framework/widgets/semantics.ts';
import {PipelineOwner,RenderBox} from './Nelyx/src/framework/rendering/object.ts';
import {RenderProxyBox} from './Nelyx/src/framework/rendering/boxes.ts';
import {GlobalKey,GlobalObjectKey} from './Nelyx/src/framework/widgets/global-key.ts';
import {FocusNode} from './Nelyx/src/framework/widgets/focus.ts';
import {Focus} from './Nelyx/src/framework/widgets/focus-scope.ts';
import {SingleTickerProviderStateMixin} from './Nelyx/src/framework/widgets/ticker-provider.ts';
import {LayoutBuilder} from './Nelyx/src/framework/widgets/layout-builder.ts';
import {viewChildBudgetLimits} from './Nelyx/src/framework/widgets/view-work-budget.ts';
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

function harness({credit=true,decorate=child=>child}={}){
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
  child=decorate(widget('old'));
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
    parent:()=>element,content:()=>child,widget,
    tick(){assert(tasks.size,'Expected an owned frame callback');const batch=[...tasks];tasks.clear();state.sealed=false;state.events=[];active=state;now+=16;try{for(const [,callback] of batch)callback();}finally{active=undefined;}},
    update(id){child=widget(id);element.markNeedsBuild();},
    replace(next){child=next;element.markNeedsBuild();},
    force(){context.requestForcedFrame();},
    pointer(kind,pointer=1){view.dispatchPointer({kind,pointer,x:10,y:10,device:'touch',buttons:kind==='up'?0:1,timestamp:++now,viewportGeneration:view.currentMetrics.viewportGeneration});},
    async close(){await session.dispose();assert.equal(view.status,'closed');assert.equal(tasks.size,0,'Owned frame work survived close');for(const lease of leases)assert(lease.released,'A CPU frame lease survived close');},
  };
}

async function checkPreparationPrototype(){
  // The render boundary remains test-only; ownership uses the real internal
  // preparation generation. There is no promotion or product opt-in here.
  class PreparationElement extends RenderObjectElement {
    constructor(widget){super(widget);this.scope=widget.scope;}
    commits=0;
    unmounts=0;
    get buildScope(){return this.scope;}
    get renderObjects(){return [];}
    attachRenderObject(slot){this.currentSlot=slot;}
    _commitRenderChildren(){this.commits++;super._commitRenderChildren();}
    unmount(){this.unmounts++;super.unmount();}
  }
  class PreparationWidget extends SingleChildRenderObjectWidget {
    constructor(child,scope){super(child);this.scope=scope;}
    createElement(){return new PreparationElement(this);}
    createRenderObject(){return new RenderProxyBox();}
  }
  class LifecycleWidget extends StatefulWidget {
    constructor(child,key,events){super(key);this.child=child;this.events=events;}
    createState(){return new LifecycleState();}
  }
  class LifecycleState extends State {
    initState(){super.initState();this.widget.events.push('init');}
    build(){this.widget.events.push('build');return this.widget.child;}
    dispose(){this.widget.events.push('dispose');super.dispose();}
  }
  class HostWidget extends Widget {
    constructor(items=[]){super();this.items=items;}
    createElement(){return new HostElement(this);}
  }
  class HostElement extends Element {build(){return this.widget.items;}}
  class TickingWidget extends StatefulWidget {
    constructor(child,events){super();this.child=child;this.events=events;}
    createState(){return new TickingState();}
  }
  class TickingState extends SingleTickerProviderStateMixin {
    initState(){super.initState();this.ticker=this.createTicker(()=>this.widget.events.push('tick'));this.ticker.start();}
    build(){return this.widget.child;}
    dispose(){this.ticker.dispose();super.dispose();}
  }
  function prepare(current,child){
    const owner=current.root.buildOwner,scope=owner._createPreparationScope();
    const element=new PreparationWidget(child,scope).createElement();
    const pipeline=new PipelineOwner({accessibilityEnabled:false});
    let cancelled=false;
    const cancel=()=>{if(cancelled)return;cancelled=true;try{pipeline.setRoot(undefined);}finally{try{if(!owner.disposed)owner._disposePreparationScope(scope);}finally{pipeline.dispose();}}};
    try{element._mountPreparationRoot(current.parent(),owner,scope);pipeline.setRoot(element.renderObject);}
    catch(error){try{cancel();}catch(cleanup){throw new AggregateError([error,cleanup],'Prototype mount and cleanup failed');}throw error;}
    return {element,scope,pipeline,flush(){owner.buildScope(element);pipeline.flushLayout({width:120,height:80});},cancel};
  }
  const crossGeneration=error=>error?.code==='cross-preparation-global-key';
  const independent=harness(),events=[],key=new GlobalKey('unpublished');
  let pending;
  try{
    independent.view.requestFrame();independent.tick();
    const owner=independent.root.buildOwner,frame=independent.accepted.at(-1);
    const commands=JSON.stringify(frame.commands),render=independent.root.pipeline.root;
    const children=[...render.children],paintVersion=render.paintVersion,keys=owner.globalKeyCount;
    pending=prepare(independent,new LifecycleWidget(independent.widget('prepared'),key,events));
    assert(pending.element.scope.hasDirty);owner.flushBuild();owner.finalizeTree();
    assert.equal(pending.element.commits,0,'Published flush committed an unpublished render transaction');
    assert(pending.element.scope.hasDirty,'Default build unexpectedly drained the preparation scope');
    independent.pointer('down');independent.pointer('up');
    assert.deepEqual(independent.state.pointers,['old:down','old:up']);
    pending.flush();
    assert(pending.element.commits>0,'Preparation never committed its own render children');
    assert.deepEqual(events,['init','build']);
    assert.equal(pending.element.owner,owner);assert.notEqual(pending.pipeline,independent.root.pipeline);
    assert.equal(pending.element.renderObject.owner,pending.pipeline);
    assert(pending.element.renderObject.children.length,'Prototype did not produce a real subtree');
    assert(!independent.parent().children.includes(pending.element));
    assert.deepEqual(render.children,children);assert.equal(render.paintVersion,paintVersion);
    assert.equal(JSON.stringify(frame.commands),commands);
    assert(!independent.state.events.includes('paint:prepared'));
    assert(!independent.state.nodes.some(node=>node.name==='prepared'));
    independent.pointer('down',2);independent.pointer('up',2);
    assert.deepEqual(independent.state.pointers.slice(-2),['old:down','old:up']);
    // Returning to the published tree between two synchronous scope flushes
    // is not build/layout continuation, and is not reported as P2/P3.
    const prepared=pending.element.children[0];
    assert(prepared.active);assert(prepared.stateObject instanceof LifecycleState);
    assert.equal(key.currentElement,undefined);assert.equal(key.currentContext,undefined);
    assert.equal(key.currentState,undefined);assert.equal(key.currentWidget,undefined);
    assert(independent.root.canSubmitPreparedFrame(frame.token),'Unpublished production invalidated the current CPU frame');
    assert.throws(()=>owner.reserve(key,independent.parent()),crossGeneration);
    assert.throws(()=>owner.retake(prepared.widget,independent.parent()),crossGeneration);
    assert(prepared.parent===pending.element,'Rejected retake changed unpublished ownership');
    assert.throws(()=>owner._createPreparationScope(),error=>error?.code==='invalid-preparation-scope');
    prepared.markNeedsBuild();owner.flushBuild();assert(pending.element.scope.hasDirty);
    assert(independent.root.canSubmitPreparedFrame(frame.token),'Unpublished dirty work invalidated published geometry');
    pending.flush();assert.deepEqual(events,['init','build','build']);
    const retiredScope=pending.scope;
    pending.cancel();pending.cancel();assert.equal(pending.element.unmounts,1);pending=undefined;owner.finalizeTree();
    const stale=new PreparationWidget(undefined,retiredScope).createElement();
    assert.throws(()=>stale._mountPreparationRoot(independent.parent(),owner,retiredScope),error=>error?.code==='foreign-preparation-scope');
    assert(!stale.mounted);
    assert.deepEqual(events,['init','build','build','dispose']);assert.equal(key.currentElement,undefined);
    assert.equal(owner.globalKeyCount,keys);assert(!owner.hasDirty);
    assert.equal(independent.root.scheduler.transientCallbackCount,0);
    assert.deepEqual(independent.errors,[]);
  }finally{try{pending?.cancel();}finally{await independent.close();}}

  const stolenKey=new GlobalKey('published'),lifecycle=[];
  const stealing=harness({decorate:child=>new LifecycleWidget(child,stolenKey,lifecycle)});
  let stealingPreparation;
  try{
    stealing.view.requestFrame();stealing.tick();
    const original=stolenKey.currentElement,originalParent=original.parent;
    const state=stolenKey.currentState;
    const publishedRender=original.findRenderObject();
    assert(publishedRender.owner===stealing.root.pipeline,'Initial published target has no live pipeline');
    stealingPreparation=prepare(stealing,stealing.content());
    assert.throws(()=>stealingPreparation.flush(),crossGeneration);
    assert.equal(stolenKey.currentElement,original);assert.equal(stolenKey.currentState,state);
    assert(originalParent.children.includes(original),'Rejected preparation stole the published child');
    assert.equal(original.parent,originalParent);assert.equal(stolenKey.currentState,state);
    assert(publishedRender.owner===stealing.root.pipeline,'Rejected preparation moved the live target');
    assert.equal(lifecycle.filter(event=>event==='init').length,1);
    stealing.pointer('down');stealing.pointer('up');
    assert.deepEqual(stealing.state.pointers,['old:down','old:up']);
    assert.deepEqual(stealing.errors,[]);
  }finally{
    try{stealingPreparation?.cancel();}finally{await stealing.close();}
  }
  assert.equal(stolenKey.currentElement,undefined);
  assert.equal(lifecycle.filter(event=>event==='dispose').length,1);

  const publishedFocus=new FocusNode(),focus=new FocusNode(),ticks=[];
  const active=harness({decorate:child=>new Focus(child,{focusNode:publishedFocus,autofocus:true,includeSemantics:false})});
  let activePreparation;
  try{
    active.view.requestFrame();active.tick();
    active.root.buildOwner.focus.applyFocusChangesIfNeeded();
    assert(active.root.buildOwner.focus.primaryFocus===publishedFocus);
    const focusChildren=[...publishedFocus.children];
    assert.equal(active.root.scheduler.transientCallbackCount,0);
    activePreparation=prepare(active,new Focus(new TickingWidget(active.widget('unpublished-active'),ticks),{focusNode:focus,parentNode:publishedFocus,autofocus:true,includeSemantics:false}));
    activePreparation.flush();active.root.buildOwner.focus.applyFocusChangesIfNeeded();
    focus.requestFocus();active.root.buildOwner.focus.applyFocusChangesIfNeeded();
    assert(active.root.buildOwner.focus.primaryFocus===publishedFocus,'Unpublished autofocus changed primary focus');
    assert.deepEqual(publishedFocus.children,focusChildren);assert.equal(focus.parent,null);
    assert(!focus.canRequestFocus);
    assert.throws(()=>publishedFocus.requestFocus(focus),error=>error?.code==='cross-preparation-focus');
    const ticking=activePreparation.element.children[0].children[0].children[0].stateObject;
    assert(ticking instanceof TickingState);
    ticking.ticker.muted=false;ticking.ticker.forceFrames=true;
    assert(!ticking.ticker.isTicking,'Manual ticker flags bypassed preparation ownership');
    assert.equal(active.root.scheduler.transientCallbackCount,0);
    active.force();active.tick();assert.deepEqual(ticks,[]);
    assert(!active.state.events.includes('paint:unpublished-active'));
    activePreparation.cancel();activePreparation=undefined;
    active.root.buildOwner.finalizeTree();active.root.buildOwner.focus.applyFocusChangesIfNeeded();
    assert.notEqual(active.root.buildOwner.focus.primaryFocus,focus);
    assert.equal(active.root.scheduler.transientCallbackCount,0);assert(!active.root.buildOwner.hasDirty);
    const originalFlags=[publishedFocus.canRequestFocus,publishedFocus.descendantsAreFocusable,publishedFocus.descendantsAreTraversable];
    activePreparation=prepare(active,new Focus(active.widget('shared-focus'),{focusNode:publishedFocus,canRequestFocus:false,descendantsAreFocusable:false,descendantsAreTraversable:false}));
    assert.throws(()=>activePreparation.flush(),error=>error?.code==='preparation-focus-host');
    assert.deepEqual([publishedFocus.canRequestFocus,publishedFocus.descendantsAreFocusable,publishedFocus.descendantsAreTraversable],originalFlags,'Preparation configured an already hosted node before rejecting it');
    assert(active.root.buildOwner.focus.primaryFocus===publishedFocus);
    activePreparation.cancel();activePreparation=undefined;
    active.replace(new TickingWidget(active.widget('published-ticking'),ticks));
    active.force();active.tick();active.tick();assert.equal(ticks.length,1,'Legacy ticker stopped running');
    assert.deepEqual(active.errors,[]);
  }finally{try{activePreparation?.cancel();}finally{try{await active.close();}finally{focus.dispose();publishedFocus.dispose();}}}

  const objectIdentity={},objectKeys=[objectIdentity,'prepared-object-key'];
  for(const identity of objectKeys){
    const current=harness(),foreign=harness(),key=new GlobalObjectKey(identity),alias=new GlobalObjectKey(identity),events=[];
    let pending,other;
    try{
      current.view.requestFrame();current.tick();foreign.view.requestFrame();foreign.tick();
      pending=prepare(current,new LayoutBuilder(()=>new LifecycleWidget(current.widget('nested'),key,events)));pending.flush();
      const layout=pending.element.children[0],prepared=layout.children[0];
      assert(prepared._preparationScope===pending.scope,'Nested BuildScope lost preparation ownership');
      assert(layout.buildScope!==pending.scope);
      assert.equal(key.currentState,undefined);assert.equal(alias.currentElement,undefined);
      assert.throws(()=>current.root.buildOwner.retake(new LifecycleWidget(current.widget('nested'),alias,events),current.parent()),crossGeneration);
      other=prepare(foreign,new LifecycleWidget(foreign.widget('conflict'),alias,[]));
      assert.throws(()=>other.flush(),error=>error?.code==='duplicate-global-key');
      assert.deepEqual(events,['init','build']);
      pending.cancel();pending=undefined;
      current.replace(new LifecycleWidget(current.widget('now-published'),alias,events));current.force();current.tick();
      assert(alias.currentState instanceof LifecycleState);assert(key.currentState===alias.currentState);
      assert.deepEqual(current.errors,[]);
    }finally{try{other?.cancel();}finally{try{pending?.cancel();}finally{try{await foreign.close();}finally{await current.close();}}}}
    assert.equal(key.currentElement,undefined);assert.equal(alias.currentElement,undefined);
  }

  const sameGeneration=harness(),movingKey=new GlobalKey('same-generation'),movingEvents=[];
  let moving;
  try{
    sameGeneration.view.requestFrame();sameGeneration.tick();
    moving=prepare(sameGeneration,new HostWidget([new HostWidget([new LifecycleWidget(sameGeneration.widget('moving'),movingKey,movingEvents)]),new HostWidget()]));moving.flush();
    const [left,right]=moving.element.children[0].children,original=left.children[0],state=original.stateObject;
    right.update(new HostWidget([new LifecycleWidget(sameGeneration.widget('moved'),movingKey,movingEvents)]));
    moving.flush();sameGeneration.root.buildOwner.finalizeTree();
    assert.throws(()=>sameGeneration.root.buildOwner.finalizeTree(moving.scope),AggregateError);
    left.update(new HostWidget());moving.flush();sameGeneration.root.buildOwner.finalizeTree(moving.scope);
    assert(original.parent===right);assert(original.stateObject===state);
    assert.equal(movingKey.currentState,undefined);assert.equal(movingEvents.filter(event=>event==='init').length,1);
  }finally{try{moving?.cancel();}finally{await sameGeneration.close();}}
  assert.equal(movingEvents.filter(event=>event==='dispose').length,1);

  const cancelling=harness(),disposeFailure=new Error('preparation dispose failed'),cancelEvents=[];
  class FailingDisposeWidget extends LifecycleWidget {createState(){return new FailingDisposeState();}}
  class FailingDisposeState extends LifecycleState {dispose(){super.dispose();throw disposeFailure;}}
  const includesFailure=error=>error===disposeFailure||(error instanceof AggregateError&&error.errors.some(includesFailure));
  let cancellation;
  try{
    cancelling.view.requestFrame();cancelling.tick();
    cancellation=prepare(cancelling,new LifecycleWidget(new FailingDisposeWidget(cancelling.widget('failed-disposal'),new GlobalKey(),cancelEvents),new GlobalKey(),cancelEvents));cancellation.flush();
    assert.throws(()=>cancellation.cancel(),includesFailure);
    assert(!cancelling.root.buildOwner.hasDirty);assert.equal(cancelling.root.buildOwner.globalKeyCount,0);
    assert.equal(cancelEvents.filter(event=>event==='dispose').length,2);
    const neverBuilt=[];
    cancellation=prepare(cancelling,new LifecycleWidget(cancelling.widget('never-built'),new GlobalKey(),neverBuilt));
    cancellation.cancel();cancellation=undefined;
    assert.deepEqual(neverBuilt,[],'Cancelling a queued preparation executed its lifecycle');
    assert(!cancelling.root.buildOwner.hasDirty);
  }finally{try{cancellation?.cancel();}finally{await cancelling.close();}}

  const capped=harness(),capEvents=[];
  let cappedPreparation;
  try{
    capped.view.requestFrame();capped.tick();
    const child=capped.widget('not-built-over-limit');
    cappedPreparation=prepare(capped,new HostWidget(Array.from({length:viewChildBudgetLimits.elements},()=>new LifecycleWidget(child,null,capEvents))));
    assert.throws(()=>cappedPreparation.flush(),error=>error?.code==='preparation-element-limit');
    const initializations=capEvents.filter(event=>event==='init').length;
    assert.equal(initializations,viewChildBudgetLimits.elements-2,'The first over-limit Element executed its lifecycle');
    assert.equal(capEvents.filter(event=>event==='build').length,0);
    cappedPreparation.cancel();cappedPreparation=undefined;
    assert.equal(capEvents.filter(event=>event==='dispose').length,initializations);
    assert(!capped.root.buildOwner.hasDirty);
  }finally{try{cappedPreparation?.cancel();}finally{await capped.close();}}

  const closing=harness(),closingEvents=[];
  let closePreparation;
  try{
    closing.view.requestFrame();closing.tick();
    closePreparation=prepare(closing,new LifecycleWidget(closing.widget('closing-preparation'),new GlobalKey(),closingEvents));closePreparation.flush();
    await closing.close();
    assert(!closePreparation.element.mounted,'View close left unpublished Elements mounted');
    assert.deepEqual(closingEvents,['init','build','dispose']);assert(!closing.root.buildOwner.hasDirty);
  }finally{try{closePreparation?.cancel();}finally{await closing.close();}}
  console.log('FRAME_PREPARATION_PROTOTYPE '+JSON.stringify({gate:'PASS-scoped',implementationAccepted:false,performanceAccepted:false,scope:'internal ownership only; no promotion, continuation or native measurement',cases:['unpublished-key-lookup','bidirectional-retake-rejection','equivalent-object-key-and-foreign-owner','nested-layout-scope','same-generation-retake-and-reservations','focus-and-ticker-exclusion','hosted-focus-rejection-before-configuration','published-frame-validity','single-init-and-disposal','cancel-before-build-and-dispose-error','element-limit-before-lifecycle','owner-close-and-cancellation']}));
}

try {
  if(PREPARATION_PROTOTYPE){await checkPreparationPrototype();}
  else {
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
  }
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
    if (error instanceof AggregateError)
      for (const failure of error.errors)
        console.error('FRAME_PUBLICATION_CAUSE ' + (failure?.message ?? String(failure)));
    process.exitCode = 1;
  }
}
