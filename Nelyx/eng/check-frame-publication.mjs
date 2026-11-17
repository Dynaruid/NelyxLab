// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';

const preparationPrototype = process.argv.includes('--preparation-prototype');
const subtreePreparation = process.argv.includes('--subtree-preparation');
if (!process.argv.includes('--child')) {
  await execute(
    process.execPath,
    [
      import.meta.filename,
      '--child',
      ...(preparationPrototype ? ['--preparation-prototype'] : []),
      ...(subtreePreparation ? ['--subtree-preparation'] : []),
    ],
    { cwd: process.cwd(), timeout: 1_200_000 },
  );
} else {
  const bundle = await build({
    define: {
      PREPARATION_PROTOTYPE: JSON.stringify(preparationPrototype),
      SUBTREE_PREPARATION: JSON.stringify(subtreePreparation),
    },
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
import assert from 'node:assert/strict';
import {AppSession} from './Nelyx/src/hosting/runtime.ts';
import {FrameworkRoot} from './Nelyx/src/framework/widgets/root.ts';
import {Element,Widget,LeafRenderObjectWidget,RenderObjectElement,SingleChildRenderObjectWidget,State,StatefulWidget} from './Nelyx/src/framework/widgets/framework.ts';
import {Builder} from './Nelyx/src/framework/widgets/basic.ts';
import {PageView,PageController} from './Nelyx/src/framework/widgets/page-view.ts';
import {Directionality} from './Nelyx/src/framework/widgets/app-data.ts';
import {Semantics} from './Nelyx/src/framework/widgets/semantics.ts';
import {PipelineOwner,RenderBox} from './Nelyx/src/framework/rendering/object.ts';
import {RenderProxyBox} from './Nelyx/src/framework/rendering/boxes.ts';
import {BoxConstraints} from './Nelyx/src/framework/rendering/constraints.ts';
import {SubtreePreparation} from './Nelyx/src/framework/widgets/subtree-preparation.ts';
import {GridView} from './Nelyx/src/framework/widgets/scroll-view.ts';
import {SliverChildBuilderDelegate} from './Nelyx/src/framework/widgets/scroll-delegate.ts';
import {SliverGridDelegateWithFixedCrossAxisCount} from './Nelyx/src/framework/rendering/sliver-grid.ts';
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
import {ResourceAccounting} from './Nelyx/src/hosting/resources.ts';
import {FlutterError} from './Nelyx/src/foundation/flutter-error.ts';
import {Ink} from './packages/material/src/ink-decoration.ts';
import {MaterialInkRender} from './packages/material/src/internal/material/material-ink-owner.ts';
import {Color} from './Nelyx/src/ui/color.ts';
import {DefaultAssetBundle} from './Nelyx/src/framework/widgets/default-asset-bundle.ts';
import {AssetBundle} from './Nelyx/src/services/asset-bundle.ts';

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

function harness({credit=true,decorate=child=>child,wrapRoot=child=>child,clockStep=0,nativeCredit=false,notifications=false}={}){
  let now=0,nextTask=0,element,context,root,child,creditCallback,rendererListener;
  const tasks=new Map(),leases=new Set(),attempts=[],accepted=[],errors=[],observations=[],rendererPending=new Map();
  const state={credit,deferSubmit:false,deferRetire:false,sealed:false,tokens:[],events:[],pointers:[],retired:[],nodes:[],geometry:null,paint:null};
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
  const clock={request(callback){const id=++nextTask;tasks.set(id,callback);return {dispose(){tasks.delete(id);}};},...(nativeCredit?{observeCredit(callback){creditCallback=callback;return {dispose(){creditCallback=undefined;}};}}:{})};
  function retire(){state.credit=true;for(const [submission,{frame,lease}] of rendererPending){rendererPending.delete(submission);lease.returnBy('renderer');rendererListener?.({kind:'retired',submission,token:frame.token,result:'gpu-retired'});}}
  const publish=nodes=>{assert(state.sealed,'Semantics were published before frame seal');assert(state.events.some(event=>event.startsWith('geometry:')),'Semantics preceded geometry publication');state.events.push('semantics');state.nodes=nodes;};
  const session=new AppSession({id:'publication',createView(value){context=value;root=new FrameworkRoot(value,{id:'publication',createRoot:()=>new Directionality('ltr',wrapRoot(new Builder(value=>{element=value;return child;})))});return root;}},clock);
  const renderer={
    ...(nativeCredit?{latestInputAdmission:true,captureInputWatermark:()=>0,hasUndeliveredInput:()=>false}:{}),
    capabilities:{notifications:notifications?'submitted-and-retired':'unavailable'},
    observe(listener){rendererListener=listener;return {dispose(){rendererListener=undefined;}};},
    canBuildFrame(){return state.credit;},
    updateMetrics(){},
    submit(frame,lease){leases.add(lease);attempts.push(frame);state.events.push('submit');if(!state.credit||state.deferSubmit)return {status:'rejected',reason:'busy'};lease.transfer();accepted.push(frame);const submission=accepted.length;if(notifications){rendererPending.set(submission,{frame,lease});rendererListener?.({kind:'submitted',submission,token:frame.token});if(state.deferRetire)state.credit=false;else retire();}else lease.returnBy('renderer');return {status:'accepted',submission};},
    dispose(){throw Error('Borrowed renderer was disposed');},
  };
  const unavailable=()=>{throw Error('Unexpected text/editing service use');};
  const view=session.attach({id:'publication',generation:1,metrics,renderer,ownership:'borrowed',onError:error=>errors.push(error),observeInput:event=>observations.push(event),services:{
    assets:new Map(),clock:{now:()=>{now+=clockStep;return now;}},text:{layout:unavailable,range:unavailable,hit:unavailable},
    editing:{capabilities:{indexUnit:'utf16',composing:'unavailable',selectionDirection:'unavailable'},bind:unavailable,dispose(){}},
    semantics:{capability:'native-controls',bind(nodes){publish(nodes);return {update:publish,dispose(){state.nodes=[];}};},dispose(){}},
  }});
  return {
    state,view,root,session,attempts,accepted,errors,observations,leases,
    get pendingTasks(){return tasks.size;},
    creditWake(){assert(creditCallback,'Native credit listener is missing');creditCallback();},
    retire,
    parent:()=>element,content:()=>child,widget,
    tick(budget=false){assert(tasks.size,'Expected an owned frame callback');const batch=[...tasks];tasks.clear();state.sealed=false;state.events=[];active=state;now+=16;const timing=budget?{tick:now,dispatch:now,queueDelay:0,clockUncertainty:0,observedDeadline:now+(typeof budget==='number'?budget:16)}:undefined;try{for(const [,callback] of batch)callback(timing);}finally{active=undefined;}},
    update(id){child=widget(id);element.markNeedsBuild();},
    replace(next){child=next;element.markNeedsBuild();},
    force(){context.requestForcedFrame();},
    pointer(kind,pointer=1){view.dispatchPointer({kind,pointer,x:10,y:10,device:'touch',buttons:kind==='up'?0:1,timestamp:++now,viewportGeneration:view.currentMetrics.viewportGeneration});},
    async close(){retire();await session.dispose();assert.equal(view.status,'closed');assert.equal(tasks.size,0,'Owned frame work survived close');for(const lease of leases)assert(lease.released,'A CPU frame lease survived close');},
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

async function checkSubtreePreparation(){
  class Life extends StatefulWidget {
    constructor(child,key,events){super(key);this.child=child;this.events=events;}
    createState(){return new LifeState();}
  }
  class LifeState extends SingleTickerProviderStateMixin {
    initState(){super.initState();this.widget.events.push('init');this.ticker=this.createTicker(()=>this.widget.events.push('tick'));this.ticker.start();}
    build(){this.widget.events.push('build');return this.widget.child;}
    dispose(){this.widget.events.push('dispose');this.ticker.dispose();super.dispose();}
  }
  const current=harness(),key=new GlobalKey('cold'),events=[],node=new FocusNode();
  let prepared;
  try{
    current.view.requestFrame();current.tick();
    const owner=current.root.buildOwner,revision=owner.buildRevision;
    const widget=new Life(new Focus(current.widget('cold'),{focusNode:node,includeSemantics:false}),key,events);
    prepared=new SubtreePreparation(owner,current.parent(),widget,BoxConstraints.tight({width:120,height:80}));
    let slices=0;
    while(!prepared.ready){
      let credits=3;
      prepared.advance(()=>--credits>=0);
      assert(++slices<30,'Preparation did not converge');
      assert.equal(key.currentState,undefined);assert.equal(node.parent,null);
      assert.equal(owner.buildRevision,revision);assert.equal(events.filter(event=>event==='tick').length,0);
      current.pointer('down',slices);current.pointer('up',slices);
      assert.equal(current.state.pointers.at(-2),'old:down');
      assert.equal(current.state.pointers.at(-1),'old:up');
      owner.flushBuild();owner.finalizeTree();
    }
    assert(slices>1,'A real dirty queue was not split');
    assert.deepEqual(events,['init','build']);
    assert.equal(owner._frameworkKeyContext(key,current.parent()),undefined,'Published context crossed into a preparing key');
    const preparedState=prepared.boundary.children[0].stateObject;
    assert.equal(owner._frameworkKeyContext(key,preparedState.context),preparedState.context);
    const parent=current.parent(),old=parent.children[0],slot=old.slot;
    owner.deactivateChild(old);parent.children=[];
    const child=prepared.adopt(slot);parent.children=[child];
    assert.equal(key.currentState,undefined,'Adoption exposed State before CPU capture');
    current.replace(widget);current.tick();
    const describe=error=>error?.errors ? error.message+': '+error.errors.map(describe).join('; ') : error?.message;
    assert.equal(current.errors.length,0,current.errors.map(describe).join('; '));
    assert.equal(key.currentState,child.stateObject);assert(node.parent,'Published Focus did not rejoin its real tree');
    assert.deepEqual(events,['init','build']);
    current.pointer('down',90);current.pointer('up',90);
    assert.equal(current.state.pointers.at(-2),'cold:down');assert.equal(current.state.pointers.at(-1),'cold:up');
    current.tick();assert(events.includes('tick'),'Published ticker stayed muted');
    await current.close();assert.equal(events.filter(event=>event==='dispose').length,1);
    assert.equal(key.currentState,undefined);assert(!owner.hasDirty);
  }finally{await current.close();node.dispose();}
  const cancelled=harness();
  try{
    cancelled.view.requestFrame();cancelled.tick();const owner=cancelled.root.buildOwner,events=[],key=new GlobalKey();
    const preparation=new SubtreePreparation(owner,cancelled.parent(),new Life(cancelled.widget('cancelled'),key,events),BoxConstraints.tight({width:120,height:80}));
    preparation.complete();preparation.cancel();preparation.cancel();
    assert.deepEqual(events,['init','build','dispose']);assert.equal(key.currentState,undefined);assert(!owner.hasDirty);
    const next=new SubtreePreparation(owner,cancelled.parent(),cancelled.widget('next'),BoxConstraints.tight({width:120,height:80}));
    await cancelled.close();assert(next.pipeline.debugDisposed,'Owner close left the detached pipeline live');
  }finally{await cancelled.close();}
  const dirtyReady=harness();let dirtyPreparation;
  try{
    dirtyReady.view.requestFrame();dirtyReady.tick();const events=[];
    dirtyPreparation=new SubtreePreparation(dirtyReady.root.buildOwner,dirtyReady.parent(),new Life(dirtyReady.widget('dirty-ready'),new GlobalKey(),events),BoxConstraints.tight({width:120,height:80}));
    dirtyPreparation.complete();const state=dirtyPreparation.boundary.children[0].stateObject;
    state.setState(()=>{});assert(!dirtyPreparation.ready,'A dirty State reused a stale ready result');
    dirtyPreparation.complete();assert(dirtyPreparation.ready);assert.deepEqual(events,['init','build','build']);
    dirtyPreparation.cancel();assert.equal(events.filter(event=>event==='dispose').length,1);
  }finally{dirtyPreparation?.cancel();await dirtyReady.close();}
  const failed=harness(),delegateFailure=new Error('cold delegate failed');let failedPreparation;
  const reportBeforeFailure=FlutterError.onError;
  try{
    failed.view.requestFrame();failed.tick();let reports=0;
    failedPreparation=new SubtreePreparation(failed.root.buildOwner,failed.parent(),()=>{throw delegateFailure;},BoxConstraints.tight({width:120,height:80}));
    FlutterError.onError=details=>{reports++;assert(failedPreparation.pipeline.debugDisposed,'Failure was reported before detached resources retired');assert.equal(failed.root.buildOwner.preparationStats.active,0);throw details.exception;};
    assert.throws(()=>failedPreparation.complete(),error=>error===delegateFailure);assert.equal(reports,1);
    assert(!failed.root.buildOwner.hasDirty);
  }finally{FlutterError.onError=reportBeforeFailure;failedPreparation?.cancel();await failed.close();}
  const nested=harness(),produced=[];
  let gridPreparation;
  try{
    nested.view.requestFrame();nested.tick();
    const grid=GridView.custom({primary:false,gridDelegate:new SliverGridDelegateWithFixedCrossAxisCount({crossAxisCount:7}),childrenDelegate:new SliverChildBuilderDelegate((_context,index)=>{
      produced.push(index);return nested.widget('day-'+index);
    },{childCount:42,addAutomaticKeepAlives:false,addRepaintBoundaries:false})});
    gridPreparation=new SubtreePreparation(nested.root.buildOwner,nested.parent(),grid,BoxConstraints.tight({width:120,height:80}));
    let slices=0,previous=0;
    while(!gridPreparation.ready){
      let credits=5;gridPreparation.advance(()=>--credits>=0);
      assert(++slices<250,'Nested finite production did not converge');
      assert(produced.length-previous<=1,'Nested dates remained one atomic production bundle');previous=produced.length;
      nested.pointer('down',100+slices);nested.pointer('up',100+slices);
      assert.equal(nested.state.pointers.at(-1),'old:up');
    }
    assert.deepEqual(produced,Array.from({length:42},(_,index)=>index));
    assert(slices>42,'Nested build/layout producer did not use its cursor');
    gridPreparation.cancel();assert(!nested.root.buildOwner.hasDirty);
  }finally{gridPreparation?.cancel();await nested.close();}
  let materialRender;
  class MaterialHost extends SingleChildRenderObjectWidget {
    createRenderObject(){return materialRender=new MaterialInkRender({createTicker(){throw Error('Static Ink unexpectedly created a ticker');}},null,false);}
  }
  class NoAssets extends AssetBundle {load(){throw Error('Static Ink unexpectedly loaded an image');}}
  const ink=harness({wrapRoot:child=>new DefaultAssetBundle(new NoAssets(),new MaterialHost(child))});let inkPreparation;
  try{
    ink.view.requestFrame();ink.tick();const owner=ink.root.buildOwner,version=materialRender.paintVersion;
    const widget=new Ink({color:new Color(0xff336699),child:ink.widget('ink-child')});
    inkPreparation=new SubtreePreparation(owner,ink.parent(),widget,BoxConstraints.tight({width:120,height:80}));
    inkPreparation.complete();assert.equal(materialRender.features.length,0,'Preparation registered Ink in the live Material');
    assert.equal(materialRender.paintVersion,version,'Prepared Ink invalidated the live paint snapshot');
    const parent=ink.parent(),old=parent.children[0],slot=old.slot;
    owner.deactivateChild(old);parent.children=[];parent.children=[inkPreparation.adopt(slot)];
    ink.replace(widget);ink.tick();
    assert.equal(ink.errors.length,0,ink.errors.map(error=>error.message).join('; '));
    assert.equal(materialRender.features.length,1,'Adopted Ink did not join before painting');
    assert(ink.state.events.includes('paint:ink-child'));
    await ink.close();assert.equal(materialRender.features.length,0,'Ink survived actual teardown');
  }finally{inkPreparation?.cancel();await ink.close();}
  const failingInk=harness({wrapRoot:child=>new DefaultAssetBundle(new NoAssets(),new MaterialHost(child))});let failingInkPreparation;
  try{
    failingInk.view.requestFrame();failingInk.tick();const owner=failingInk.root.buildOwner, failure=new Error('Material registration failed');
    const widget=new Ink({color:new Color(0xff336699),child:failingInk.widget('failed-ink')});
    failingInkPreparation=new SubtreePreparation(owner,failingInk.parent(),widget,BoxConstraints.tight({width:120,height:80}));failingInkPreparation.complete();
    const parent=failingInk.parent(),old=parent.children[0],slot=old.slot;
    owner.deactivateChild(old);parent.children=[];parent.children=[failingInkPreparation.adopt(slot)];
    const add=materialRender.addInkFeature.bind(materialRender);
    materialRender.addInkFeature=feature=>{add(feature);throw failure;};
    const attempts=failingInk.attempts.length;failingInk.replace(widget);failingInk.tick();
    assert(failingInk.errors.includes(failure),'Ink publication replaced the original error');
    assert.equal(materialRender.features.length,0,'Failed Ink registration remained in the live Material');
    assert.equal(failingInk.attempts.length,attempts);assert.equal(owner.preparationStats.active,0);
  }finally{failingInkPreparation?.cancel();await failingInk.close();}
  const unsupported=harness();let layoutCallbacks=0,unsupportedPreparation;
  try{
    unsupported.view.requestFrame();unsupported.tick();
    unsupportedPreparation=new SubtreePreparation(unsupported.root.buildOwner,unsupported.parent(),new LayoutBuilder(()=>{layoutCallbacks++;return unsupported.widget('unsupported');}),BoxConstraints.tight({width:120,height:80}));
    assert.throws(()=>unsupportedPreparation.complete(),error=>error?.code==='unsupported-preparation-layout-builder');
    assert.equal(layoutCallbacks,0,'Unsupported user callback ran before rejection');
    assert.equal(unsupported.root.buildOwner.preparationStats.active,0);
  }finally{unsupportedPreparation?.cancel();await unsupported.close();}
  class ResourceWidget extends StatefulWidget {
    constructor(child,bytes,events){super();this.child=child;this.bytes=bytes;this.events=events;}
    createState(){return new ResourceState();}
  }
  class ResourceState extends State {
    initState(){super.initState();this.widget.events.push('init');const registry=this.context.services.resources;this.resource=registry.allocateId('prepared');
      registry.register({...this.resource,kind:'picture'},()=>this.widget.events.push('retire'),{owner:new ResourceAccounting(registry),identity:this,cost:{units:1,bytes:this.widget.bytes}});}
    build(){return this.widget.child;}
    dispose(){const registry=this.context.services.resources;if(registry.hasInitialProducer(this.resource))registry.releaseProducer(this.resource);this.widget.events.push('dispose');super.dispose();}
  }
  for(const bytes of [64,1048577]){
    const current=harness(),events=[];let prepared;
    try{
      current.view.requestFrame();current.tick();const owner=current.root.buildOwner;
      prepared=new SubtreePreparation(owner,current.parent(),new ResourceWidget(current.widget('resource'),bytes,events),BoxConstraints.tight({width:120,height:80}));
      if(bytes===64){prepared.complete();assert.equal(prepared.resourceBudget.bytes,64);prepared.cancel();assert.equal(prepared.resourceBudget.resources,0);assert.deepEqual(events,['init','retire','dispose']);}
      else{assert.throws(()=>prepared.complete(),error=>error?.code==='preparation-resource-limit');assert.deepEqual(events,['init','dispose']);}
      assert.equal(owner.preparationStats.active,0);
    }finally{prepared?.cancel();await current.close();}
  }
  const controller=new PageController(),pageBuilds=[],days=[];
  let pages;
  pages=harness({clockStep:0.12,nativeCredit:true,decorate:child=>PageView.builder({controller,itemCount:4,childPolicy:{mode:'split'},itemBuilder:(_context,index)=>{
    assert(_context.owner.building&&_context.owner.currentElement===_context,'Cold delegate lost its actual parent build extent');
    pageBuilds.push(index);
    if(index===1) pages.state.credit=false;
    return index===0?child:GridView.custom({primary:false,gridDelegate:new SliverGridDelegateWithFixedCrossAxisCount({crossAxisCount:7}),childrenDelegate:new SliverChildBuilderDelegate((_context,day)=>{
      days.push([index,day]);return pages.widget('page-'+index+'-day-'+day);
    },{childCount:42,addAutomaticKeepAlives:false,addRepaintBoundaries:false})});
  }})});
  try{
    pages.view.requestFrame();pages.tick();assert.deepEqual(pageBuilds,[0],'Missing deadline started optional lifecycle');
    pages.tick();assert.deepEqual(pageBuilds,[0]);assert.equal(pages.pendingTasks,0,'Missing deadline kept polling');
    pages.state.deferSubmit=true;
    pages.view.requestFrame();pages.tick(true);
    assert.deepEqual(pageBuilds,[0],'Required frame also started optional work');
    const owner=pages.root.buildOwner;
    const framesBeforeCredit=pages.state.tokens.length;
    pages.state.credit=true;pages.state.deferSubmit=false;pages.creditWake();
    assert.equal(pages.state.tokens.length,framesBeforeCredit,'Credit wake consumed optional continuation without a host deadline');
    pages.tick(4);assert.equal(owner.preparationStats.budgetMisses,1,'Expired budget was not accounted');
    assert.equal(pages.state.tokens.length,framesBeforeCredit,'Optional retry captured a CPU frame');
    pages.tick(true);assert.deepEqual(pageBuilds,[0,1]);assert.equal(pages.state.credit,false);
    pages.state.credit=true;pages.creditWake();
    for(let count=0;(owner.preparationStats.slices<4||days.length===0)&&count<30;count++){
      try{pages.tick(true);}catch(error){throw Error('Page resume '+JSON.stringify(owner.preparationStats)+' '+pages.errors.map(error=>error.message).join('; ')+' '+error.message);}
    }
    assert.equal(pages.state.tokens.length,framesBeforeCredit,'Private production rebuilt the published CPU frame');
    assert.equal(owner.preparationStats.idleSlices,owner.preparationStats.slices);
    assert(owner.preparationStats.slices>=4,'Actual host opportunities did not resume the page');
    assert(days.length>0&&days.length<42,'Nested days were not split before demand');
    controller.jumpToPage(1);pages.tick(true);
    const describe=error=>error?.errors?error.message+': '+error.errors.map(describe).join('; '):error?.message;
    assert.equal(pages.errors.length,0,pages.errors.map(describe).join('; '));
    assert.equal(pageBuilds.filter(index=>index===1).length,1,'Required fallback replayed the cold page builder');
    assert.deepEqual(days.filter(([page])=>page===1).map(([,day])=>day),Array.from({length:42},(_,index)=>index));
    assert.equal(controller.page,1);assert.equal(owner.preparationStats.published,1);assert.equal(owner.preparationStats.forced,1);
    assert.equal(owner.preparationStats.requiredColdChildren,2);assert.equal(owner.preparationStats.preparedColdChildren,1);
    assert.equal(owner.preparationStats.finiteChildren,42);assert(owner.preparationStats.optionalFiniteChildren>0);
    const names=nodes=>nodes.flatMap(node=>[node.name,...names(node.children??[])]);
    assert(names(pages.state.nodes).some(name=>name?.includes('page-1-day-0')),'Prepared semantics missing: '+names(pages.state.nodes).join('|'));
  }finally{await pages.close();controller.dispose();}
  const retiredDays=[];let retirement;
  retirement=harness({notifications:true,clockStep:0.12,decorate:child=>PageView.builder({itemCount:2,childPolicy:{mode:'split'},itemBuilder:(_context,index)=>index===0?child:GridView.custom({primary:false,gridDelegate:new SliverGridDelegateWithFixedCrossAxisCount({crossAxisCount:7}),childrenDelegate:new SliverChildBuilderDelegate((_context,day)=>{retiredDays.push(day);return retirement.widget('retirement-day-'+day);},{childCount:42,addAutomaticKeepAlives:false,addRepaintBoundaries:false})})})});
  try{
    retirement.state.deferRetire=true;
    retirement.view.requestFrame();retirement.tick();const frames=retirement.state.tokens.length;
    retirement.tick(true);assert.equal(retirement.pendingTasks,0,'GPU busy kept optional polling');
    assert.equal(retirement.root.buildOwner.preparationStats.started,0);
    retirement.retire();assert(retirement.pendingTasks,'Renderer retirement did not wake parked preparation');
    for(let count=0;retiredDays.length<15&&count<70;count++)retirement.tick(true);
    assert(retiredDays.length>=15,'Retirement-only host did not produce actual day children');
    assert.equal(retirement.state.tokens.length,frames,'Retirement wake redrew the CPU scene');
  }finally{await retirement.close();}
  const exhausted=harness({decorate:child=>PageView.builder({itemCount:2,childPolicy:{mode:'split'},itemBuilder:()=>child})});
  try{
    exhausted.view.requestFrame();exhausted.tick();const frames=exhausted.state.tokens.length;
    for(let retry=0;retry<3;retry++) exhausted.tick(4);
    assert.equal(exhausted.pendingTasks,0,'Expired deadlines caused unbounded idle polling');
    assert.equal(exhausted.root.buildOwner.preparationStats.started,0);
    assert.equal(exhausted.state.tokens.length,frames);
  }finally{await exhausted.close();}
  const hidden=harness({clockStep:0.12,decorate:child=>PageView.builder({itemCount:2,childPolicy:{mode:'split'},itemBuilder:()=>child})});
  try{
    hidden.view.requestFrame();hidden.tick();hidden.tick(true);
    assert.equal(hidden.root.buildOwner.preparationStats.active,1);
    hidden.view.setVisible(false);
    assert.equal(hidden.pendingTasks,0,'Hidden preparation retained an owner tick');
    assert.equal(hidden.root.buildOwner.preparationStats.active,0);
  }finally{await hidden.close();}
  const idleFailure=new Error('idle cold delegate failed');
  const idleFailed=harness({decorate:child=>PageView.builder({itemCount:2,childPolicy:{mode:'split'},itemBuilder:(_context,index)=>{if(index===1)throw idleFailure;return child;}})});
  try{
    idleFailed.view.requestFrame();idleFailed.tick();const frames=idleFailed.state.tokens.length;
    idleFailed.tick(true);
    assert.equal(idleFailed.view.status,'failed');assert(idleFailed.errors.includes(idleFailure),'Idle failure lost its original error');
    assert.equal(idleFailed.root.buildOwner.preparationStats.active,0);assert.equal(idleFailed.pendingTasks,0);
    assert.equal(idleFailed.state.tokens.length,frames,'Failed private production published a frame');
  }finally{await idleFailed.close();}
  for(const kind of ['resize-before-ready','resize-at-publish','close-at-publish','publish-error','busy-forced']){
    const current=harness({credit:kind!=='busy-forced'}),key=new GlobalKey(),events=[];
    let prepared;
    try{
      current.view.requestFrame();current.tick();const owner=current.root.buildOwner;
      const widget=new Life(current.widget(kind),key,events);
      prepared=new SubtreePreparation(owner,current.parent(),widget,BoxConstraints.tight({width:120,height:80}));
      const resize=()=>current.view.updateMetrics({...current.view.currentMetrics,viewportGeneration:2,logicalWidth:140,physicalWidth:140});
      if(kind==='resize-before-ready'){
        resize();current.tick();assert(!prepared.boundary.mounted);assert(prepared.pipeline.debugDisposed);
      }else{
        prepared.complete();const parent=current.parent(),old=parent.children[0],slot=old.slot;
        owner.deactivateChild(old);parent.children=[];parent.children=[prepared.adopt(slot)];
        const attempts=current.attempts.length;
        if(kind==='resize-at-publish')current.state.geometry=()=>{current.state.geometry=undefined;resize();};
        if(kind==='close-at-publish')current.state.geometry=()=>current.session.beginClose();
        if(kind==='publish-error')owner._whenPreparationPublished(parent.children[0],()=>{throw Error('publication hook failed');});
        current.replace(widget);if(kind==='busy-forced')current.force();current.tick();
        if(kind==='busy-forced'){
          assert(key.currentState);assert.equal(current.accepted.length,0);
          assert(current.state.nodes.some(node=>node.name===kind));
          assert([...current.leases].slice(0,-1).every(lease=>lease.released));
        }else{
          assert.equal(key.currentState,undefined);assert.equal(current.attempts.length,attempts);
          assert.equal(events.filter(event=>event==='dispose').length,1);
          assert.equal(owner.preparationStats.active,0);
          if(kind==='publish-error')assert(current.errors.some(error=>error.message==='publication hook failed'));
        }
      }
    }finally{prepared?.cancel();await current.close();}
  }
  console.log('SUBTREE_PREPARATION '+JSON.stringify({gate:'PASS-scoped',cases:['real-build-yields','nested-grid-42-cursors','idle-preparation-without-cpu-frame','retirement-wake-without-credit-subscription','missing-expired-deadline-bounded-retry','hide-cancels-idle-opportunity','idle-error-retirement','public-page-demand-and-synchronous-completion','credit-wake-keeps-real-deadline','credit-loss-keeps-progressing-continuation','dirty-ready-resume','original-error-after-scope-retirement','ink-paint-isolation-and-before-paint-join','ink-registration-failure-retirement','no-deadline-no-speculation','resource-cap-and-real-retirement','unsupported-before-user-layout-callback','live-published-targets-between-slices','single-lifecycle','adoption-without-rebuild','key-visible-after-cpu-publication','focus-and-ticker-publication','idempotent-cancel','owner-close-detached-pipeline','resize-before-and-during-publication','close-and-error-during-publication','forced-publication-while-gpu-busy']}));
}

try {
  if(SUBTREE_PREPARATION){await checkSubtreePreparation();}
  else
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
    plugins: [
      {
        name: 'current-core-source',
        setup(builder) {
          const exports = JSON.parse(fs.readFileSync('Nelyx/package.json', 'utf8')).exports;
          builder.onResolve({ filter: /^@nelyx\/core\// }, (args) => {
            const relative = exports['./' + args.path.slice('@nelyx/core/'.length)]?.default;
            if (!relative?.startsWith('./dist/'))
              throw Error('Unknown Core source export: ' + args.path);
            return {
              path: path.resolve(
                'Nelyx',
                relative.replace('./dist/', './src/').replace(/\.js$/, '.ts'),
              ),
            };
          });
        },
      },
    ],
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    logLevel: 'silent',
    loader: { '.sksl': 'text' },
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
