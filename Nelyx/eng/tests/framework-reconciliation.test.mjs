// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {BuildOwner,BuildScope,Element,Widget,State,StatefulWidget,StatelessWidget,ParentDataWidget,LeafRenderObjectElement,LeafRenderObjectWidget,MultiChildRenderObjectElement,MultiChildRenderObjectWidget} from '@nelyx/core/framework/widgets/framework';
import {Key,ValueKey} from '@nelyx/core/foundation/key';
import {GlobalKey} from '@nelyx/core/framework/widgets/global-key';
import {SizedBox} from '@nelyx/core/framework/widgets/basic';
import {RenderStack,StackParentData} from '@nelyx/core/framework/rendering/boxes';

const timeout=1_200_000;

class CommitElement extends MultiChildRenderObjectElement{
  commits=0;failCommit=false;
  synchronizeRenderObjectChildren(){this.commits++;super.synchronizeRenderObjectChildren();if(this.failCommit)throw Error('commit probe');}
}
class CommitWidget extends MultiChildRenderObjectWidget{
  createElement(){return new CommitElement(this);}
  createRenderObject(){return new RenderStack();}
}
class ForwardWidget extends StatelessWidget{
  constructor(child,key=null){super(key);this.child=child;}
  build(){return this.child;}
}

class StandardChildren extends MultiChildRenderObjectWidget{
  createRenderObject(){return new RenderStack();}
}
class TaggedLeaf extends LeafRenderObjectWidget{
  constructor(tag,key=null){super(key);this.tag=tag;}
  createRenderObject(){const render=new RenderStack();render.tag=this.tag;return render;}
  updateRenderObject(_context,render){render.tag=this.tag;}
}

test('canonical render owners commit delayed siblings, keyed moves and removals through component chains',{timeout},()=>{
  const a=new GlobalKey('delta-a'),b=new GlobalKey('delta-b'),c=new GlobalKey('delta-c'),d=new GlobalKey('delta-d');
  const wrap=(tag,key,depth)=>{let widget=new TaggedLeaf(tag,key);for(let i=0;i<depth;i++)widget=new ForwardWidget(widget);return widget;};
  const f=tree(new StandardChildren([wrap('a',a,4),wrap('b',b,1),wrap('c',c,2)]));let oldA,oldB,oldC,oldD;
  try{
    f.flush();oldA=a.currentElement.renderObject;oldB=b.currentElement.renderObject;oldC=c.currentElement.renderObject;
    assert.deepEqual(f.root.renderObject.children,[oldA,oldB,oldC]);
    f.update(new StandardChildren([wrap('b2',b,2),wrap('a2',a,5),wrap('d',d,1)]));oldD=d.currentElement.renderObject;
    assert.equal(a.currentElement.renderObject,oldA);assert.equal(b.currentElement.renderObject,oldB);
    assert.deepEqual(f.root.renderObject.children,[oldB,oldA,oldD]);assert.deepEqual(f.root.renderObject.children.map(child=>child.tag),['b2','a2','d']);
    assert.equal(c.currentElement,undefined);assert.equal(oldC.debugDisposed,true);
    f.update(new StandardChildren([]));assert.deepEqual(f.root.renderObject.children,[]);
    assert([oldA,oldB,oldD].every(render=>render.debugDisposed));assert([a,b,c,d].every(key=>key.currentElement===undefined));assert.deepEqual(f.errors,[]);
  }finally{f.close();}
});

test('a custom virtual projection still synchronizes a canonical owner on updates without render attachment hooks',{timeout},()=>{
  let reads=0;const first=new RenderStack(),second=new RenderStack();
  class VirtualWidget extends Widget{constructor(render){super();this.render=render;}createElement(){return new VirtualElement(this);}}
  class VirtualElement extends Element{get renderObjects(){reads++;return this.widget.render?[this.widget.render]:[];}build(){return [];}}
  const f=tree(new StandardChildren([new VirtualWidget(first)]));
  try{
    f.flush();assert.deepEqual(f.root.renderObject.children,[first]);const before=reads;
    f.update(new StandardChildren([new VirtualWidget(second)]));assert(reads>before);assert.deepEqual(f.root.renderObject.children,[second]);assert.equal(first.parent,undefined);
    f.root.children[0].update(new VirtualWidget(null));f.owner.flushBuild();f.owner.finalizeTree();assert.deepEqual(f.root.renderObject.children,[]);assert.equal(second.parent,undefined);assert.deepEqual(f.errors,[]);
  }finally{f.close();first.dispose();second.dispose();}
});

test('shared ParentData links read the current widget and refresh across keyed render parents',{timeout},()=>{
  let reads=0;
  class DataWidget extends ParentDataWidget{
    constructor(child,value){super(child);this.value=value;}
    get parentDataType(){reads++;return StackParentData;}
    get debugTypicalAncestorWidgetClass(){return CommitWidget;}
    applyParentData(render){render.parentData.marker=this.value;}
  }
  const key=new GlobalKey('parent-data-scope'),left=new ValueKey('left-data'),right=new ValueKey('right-data');
  const widget=(move,value)=>new CommitWidget([false,true].map((side,index)=>new CommitWidget(side===move?[new ForwardWidget(new DataWidget(new ForwardWidget(new SizedBox(1,2,undefined,key)),value))]:[],{key:index?right:left})));
  const f=tree(widget(false,1));let retained;
  try{
    f.flush();retained=key.currentElement;const render=retained.renderObject;assert.equal(render.parentData.marker,1);const before=reads;
    f.update(widget(false,2));assert.equal(key.currentElement,retained);assert.equal(render.parentData.marker,2);assert(reads>before,'Custom type getters remain live');
    f.update(widget(true,3));assert.equal(key.currentElement,retained);assert.equal(render.parent,f.root.children[1].renderObject);assert.equal(render.parentData.marker,3);assert.deepEqual(f.errors,[]);
  }finally{f.close();}
  assert.equal(retained._parentDataScope,null);
});

test('build boundaries commit the affected render owner once after queued sibling creation and reordering',{timeout},()=>{
  const a=new ValueKey('a'),b=new ValueKey('b'),nested=new ValueKey('nested');
  const wrap=(child,key)=>new ForwardWidget(new ForwardWidget(child),key);
  const widgets=reversed=>new CommitWidget([
    ...(reversed?[b,a]:[a,b]).map(key=>wrap(new SizedBox(10,20,undefined,key),key)),
    new CommitWidget([new SizedBox()],{key:nested}),
  ]);
  const f=tree(widgets(false));
  try{
    f.owner.flushBuild();const nestedElement=f.root.children[2],oldNested=nestedElement.renderObject,original=f.root.children[0];
    assert.equal(f.root.commits,1);assert.equal(nestedElement.commits,1);
    assert.deepEqual(f.root.renderObject.children,f.root.children.flatMap(child=>child.renderObjects));
    const before=nestedElement.commits;f.root.children[0].update(wrap(new SizedBox(30,40,undefined,a),a));f.owner.flushBuild();
    assert.equal(f.root.commits,2);assert.equal(nestedElement.commits,before,'A separate retained render owner is not revisited');
    f.root.update(widgets(true));f.owner.flushBuild();f.owner.finalizeTree();
    assert.equal(f.root.children[1],original,'Reordering preserves the keyed public Element');
    assert.deepEqual(f.root.renderObject.children,f.root.children.flatMap(child=>child.renderObjects));
    assert.equal(f.root.children[2].renderObject,oldNested);assert.deepEqual(f.errors,[]);
  }finally{f.close();}
});

test('a failed owner commit is retryable without replaying successful siblings and retirement removes pending owners',{timeout},()=>{
  const f=tree(new CommitWidget([new CommitWidget([new SizedBox()]),new CommitWidget([new SizedBox()])]));
  try{
    f.owner.flushBuild();const [left,right]=f.root.children;left.failCommit=true;
    left.markNeedsBuild();right.markNeedsBuild();assert.throws(()=>f.owner.flushBuild(),/commit probe/);
    const completed=right.commits;left.failCommit=false;f.owner.flushRenderTree();assert.equal(right.commits,completed);
    assert.deepEqual(left.renderObject.children,left.children.flatMap(child=>child.renderObjects));
    left.markNeedsBuild();left.rebuild();f.root.forgetChild(left);f.owner.deactivateChild(left);f.owner.finalizeTree();
    assert(left.debugIsDefunct);assert.doesNotThrow(()=>f.owner.flushRenderTree());assert.equal(right.commits,completed);
  }finally{f.close();}
});

test('render teardown retires every owner and preserves ordered hook failures including falsey values',{timeout},()=>{
  for(const failure of [new Error('hook'),undefined,null,0]){
    const stages=['detach','deactivate','didUnmount','clearChildren','dispose'],failures=stages.map(stage=>failure instanceof Error?new Error(stage):failure),trace=[];let armed=false,render;
    const fail=stage=>{if(armed){trace.push(stage);throw failures[stages.indexOf(stage)];}};
    class ObservedRender extends RenderStack{
      setChildren(children){super.setChildren(children);fail('clearChildren');}
      dispose(){super.dispose();fail('dispose');}
    }
    class ObservedElement extends LeafRenderObjectElement{
      detachRenderObject(){super.detachRenderObject();fail('detach');}
      deactivate(){super.deactivate();fail('deactivate');}
    }
    class ObservedWidget extends LeafRenderObjectWidget{
      createElement(){return new ObservedElement(this);}
      createRenderObject(){return render=new ObservedRender();}
      didUnmountRenderObject(){fail('didUnmount');}
    }
    const key=new GlobalKey('teardown'),f=tree(new ObservedWidget(key));
    try{
      f.flush();assert.equal(f.owner.globalKeyCount,1);armed=true;
      assert.throws(()=>f.root.unmount(),error=>{
        assert(error instanceof AggregateError);assert.equal(error.errors.length,5);assert.equal(error.errors[0],failures[0]);
        assert(error.errors[1] instanceof AggregateError);assert.deepEqual(error.errors[1].errors,[failures[1]]);
        for(let index=2;index<5;index++)assert.equal(error.errors[index],failures[index]);return true;
      });
      assert.deepEqual(trace,stages);assert(render.debugDisposed);assert.equal(render.attached,false);assert.equal(f.root.debugIsDefunct,true);
      assert.deepEqual(f.root.renderObjects,[]);assert.equal(key.currentElement,undefined);assert.equal(f.owner.globalKeyCount,0);assert.equal(f.owner.hasDirty,false);
      assert.doesNotThrow(()=>f.root.unmount());assert.deepEqual(trace,stages);
    }finally{armed=false;f.close();}
  }
});

test('subtree retirement keeps later siblings and GlobalKey cleanup after falsey child failures',{timeout},()=>{
  for(const failure of [new Error('child'),undefined,null,0]){
    let armed=false;
    class FailingElement extends BranchElement{
      deactivate(){super.deactivate();if(armed)throw failure;}
      unmount(){super.unmount();if(armed)throw failure;}
    }
    const key=new GlobalKey('retired-child'),child=new Branch([],{key});child.createElement=()=>new FailingElement(child);
    const f=tree(new Branch([child,new Branch()]));
    try{
      f.flush();const children=[...f.root.children];armed=true;
      assert.throws(()=>f.root.deactivate(),error=>error instanceof AggregateError&&error.errors.length===1&&error.errors[0]===failure);
      assert(children.every(element=>!element.active&&element.mounted));
      assert.throws(()=>f.root.unmount(),error=>error instanceof AggregateError&&error.errors.length===1&&error.errors[0]===failure);
      assert(children.every(element=>!element.mounted&&element.unmounts===1));assert.equal(f.root.debugIsDefunct,true);
      assert.equal(key.currentElement,undefined);assert.equal(f.owner.globalKeyCount,0);assert.equal(f.owner.hasDirty,false);
    }finally{armed=false;f.close();}
  }
});
class Branch extends Widget {
  constructor(children=[],{key=null,slot=null,failMount=false}={}){super(key);this.children=children;this.childSlot=slot;this.failMount=failMount;}
  createElement(){return new BranchElement(this);}
}
class BranchElement extends Element {
  updates=0;unmounts=0;
  build(){return this.widget.children;}
  slotForChild(){return this.widget.childSlot;}
  mount(...args){super.mount(...args);if(this.widget.failMount)throw Error('child mount failed');}
  update(widget){this.updates++;super.update(widget);}
  unmount(){this.unmounts++;super.unmount();}
}
class EqualKey extends Key {
  constructor(value){super();this.value=value;}
  equals(other){return other instanceof EqualKey&&other.value===this.value;}
}
function tree(widget){
  const errors=[],owner=new BuildOwner({},()=>{}),root=widget.createElement();owner.reportError=details=>errors.push(details.exception);root.mount(undefined,owner);
  const flush=()=>{owner.flushBuild();root.syncRenderTree();owner.finalizeTree();};
  return {root,owner,errors,flush,update(widget){root.update(widget);flush();},close(){root.unmount();owner.dispose();}};
}
test('isolated build admission rejects another subtree even when roots share a scope and preserves ancestor overrides',{timeout},()=>{
  const scope=new BuildScope();let observed=0;
  class ScopedElement extends BranchElement{get buildScope(){return scope;}}
  class ScopedBranch extends Branch{createElement(){return new ScopedElement(this);}}
  class ObservedElement extends BranchElement{hasAncestor(element){observed++;return super.hasAncestor(element);}}
  const watched=new Branch();watched.createElement=()=>new ObservedElement(watched);
  const f=tree(new Branch([new ScopedBranch([new Branch([watched])]),new ScopedBranch([new Branch()])]));
  try{
    f.owner.flushBuild();const [left,right]=f.root.children;
    f.owner.buildScope(left);assert.equal(f.errors.length,1);assert.match(String(f.errors[0]),/outside the requested subtree/);assert.equal(right.dirty,true);assert(observed>0);
    right.markNeedsBuild();f.owner.schedule(right);f.owner.buildScope(right);assert.equal(right.dirty,false);assert.equal(f.errors.length,1);
  }finally{f.close();}
});

test('single-child render projections follow replacement and preserve the previous immutable snapshot after retirement',{timeout},()=>{
  const first=new ValueKey('first-render'),second=new ValueKey('replacement-render'),box=key=>new SizedBox(10,20,undefined,key),f=tree(new Branch([new Branch([box(first)])]));
  try{
    f.flush();const before=f.root.renderObjects,old=before[0];assert.equal(before.length,1);assert(Object.isFrozen(before));assert.equal(f.root.renderObjects[0],old);
    f.update(new Branch([new Branch([box(second)])]));const after=f.root.renderObjects;assert.equal(after.length,1);assert.notEqual(after[0],old);assert.equal(before[0],old);assert(old.debugDisposed);assert(Object.isFrozen(after));
    f.update(new Branch());assert.deepEqual(f.root.renderObjects,[]);assert.equal(after.length,1);assert(after[0].debugDisposed);
  }finally{f.close();}
});

test('single-child projection still reads a custom virtual render list on every lookup',{timeout},()=>{
  let projection=[];class DynamicElement extends BranchElement{get renderObjects(){return projection;}}
  const child=new Branch();child.createElement=()=>new DynamicElement(child);const f=tree(new Branch([child]));
  try{f.flush();assert.deepEqual(f.root.renderObjects,[]);projection=[{}];assert.equal(f.root.renderObjects[0],projection[0]);projection=[{},{}];assert.deepEqual(f.root.renderObjects,projection);projection=[];assert.deepEqual(f.root.renderObjects,[]);}finally{f.close();}
});

test('single-child updates preserve custom key equality, slots and deferred retirement',{timeout},()=>{
  const slot={},nextSlot={},f=tree(new Branch([new Branch([],{key:new EqualKey('one')})],{slot}));
  try{
    f.flush();const child=f.root.children[0];assert.equal(child.slot,slot);
    f.update(new Branch([new Branch([],{key:new EqualKey('one')})],{slot:nextSlot}));
    assert.equal(f.root.children[0],child);assert.equal(child.updates,1);assert.equal(child.slot,nextSlot);
    f.root.update(new Branch([new Branch([],{key:new EqualKey('two')})]));f.owner.flushBuild();
    assert.notEqual(f.root.children[0],child);assert.equal(child.active,false);assert.equal(child.mounted,true);assert.equal(child.unmounts,0);
    f.owner.finalizeTree();assert.equal(child.mounted,false);assert.equal(child.unmounts,1);
    const replacement=f.root.children[0];f.update(new Branch());assert.equal(replacement.unmounts,1);assert.deepEqual(f.root.children,[]);
    f.update(new Branch([new Branch()]));assert.equal(f.root.children.length,1);assert.deepEqual(f.errors,[]);
  }finally{f.close();}
});

test('singleton GlobalKey retake keeps the child and reserves its final parent',{timeout},()=>{
  const key=new GlobalKey('singleton-retake'),left=new ValueKey('left'),right=new ValueKey('right');
  const widget=move=>new Branch([new Branch(move?[]:[new Branch([],{key})],{key:left}),new Branch(move?[new Branch([],{key})]:[],{key:right})]);
  const f=tree(widget(false));
  try{
    f.flush();const child=key.currentElement;assert(child);
    f.update(widget(true));assert.equal(key.currentElement,child);assert.equal(child.parent,f.root.children[1]);assert.equal(child.unmounts,0);
    f.update(widget(false));assert.equal(key.currentElement,child);assert.equal(child.parent,f.root.children[0]);assert.deepEqual(f.errors,[]);
    f.update(new Branch());assert.equal(key.currentElement,undefined);assert.equal(child.unmounts,1);
  }finally{f.close();}
});

test('a failed singleton mount cleans its GlobalKey before a later rebuild',{timeout},()=>{
  const key=new GlobalKey('failed-singleton'),broken=new Branch([],{key,failMount:true}),create=broken.createElement.bind(broken);let failed;
  broken.createElement=()=>failed=create();const f=tree(new Branch([broken]));
  try{
    f.flush();assert.equal(f.errors.length,1);assert.match(String(f.errors[0]),/child mount failed/);assert.equal(failed.mounted,false);assert.equal(failed.unmounts,1);assert.equal(key.currentElement,undefined);assert.equal(f.owner.globalKeyCount,0);
    f.update(new Branch([new Branch([],{key})]));assert(key.currentElement?.active);assert.equal(f.owner.globalKeyCount,1);assert.equal(f.errors.length,1);
  }finally{f.close();}
});

test('failed GlobalKey activation and State update retire the moved subtree in single and multiple child transactions',{timeout},()=>{
  for(const multiple of [false,true])for(const phase of ['activate','update'])for(const failure of [undefined,null,0]){
    let fail=false,disposed=0;
    class MovingWidget extends StatefulWidget{createState(){return new MovingState();}}
    class MovingState extends State{
      activate(){if(fail&&phase==='activate')throw failure;}
      didUpdateWidget(){if(fail&&phase==='update')throw failure;}
      build(){return new TaggedLeaf('moving');}
      dispose(){disposed++;}
    }
    const key=new GlobalKey('failed-move'),left=new ValueKey('left'),right=new ValueKey('right'),neighbor=new Branch([],{key:new ValueKey('neighbor')});
    const widget=moved=>new Branch([new Branch(moved?[]:[new MovingWidget(key)],{key:left}),new Branch(moved?(multiple?[neighbor,new MovingWidget(key),new Branch()]:[new MovingWidget(key)]):(multiple?[neighbor,new Branch()]:[]),{key:right})]);
    const f=tree(widget(false));
    try{
      f.flush();const old=key.currentElement,state=key.currentState;assert(old&&state?.mounted);
      fail=true;f.update(widget(true));assert.equal(f.errors.length,1);assert.equal(f.errors[0],failure);
      assert.equal(key.currentElement===undefined,true,'A failed move must not leave an active registered child absent from its parent children');assert.equal(f.owner.globalKeyCount,0);assert.equal(old.mounted,false);assert.equal(state.mounted,false);assert.equal(disposed,1);
      fail=false;f.update(widget(true));assert(key.currentElement?.active);assert.notEqual(key.currentElement,old);assert.equal(f.owner.globalKeyCount,1);assert.equal(f.errors.length,1);
    }finally{f.close();}
  }
});

test('failed GlobalKey render attachment remains in the retirement owner until finalization',{timeout},()=>{
  for(const multiple of [false,true])for(const failure of [undefined,null,0]){
    let fail=false;
    class MovingWidget extends Branch{createElement(){return new MovingElement(this);}}
    class MovingElement extends BranchElement{attachRenderObject(slot){super.attachRenderObject(slot);if(fail)throw failure;}}
    const key=new GlobalKey('failed-attach'),left=new ValueKey('left'),right=new ValueKey('right'),neighbor=new Branch([],{key:new ValueKey('neighbor')});
    const widget=moved=>new Branch([new Branch(moved?[]:[new MovingWidget([new TaggedLeaf('moving')],{key})],{key:left}),new Branch(moved?(multiple?[neighbor,new MovingWidget([],{key}),new Branch()]:[new MovingWidget([],{key})]):(multiple?[neighbor,new Branch()]:[]),{key:right})]);
    const f=tree(widget(false));
    try{
      f.flush();const old=key.currentElement;assert(old);
      fail=true;f.update(widget(true));assert.equal(f.errors.length,1);assert.equal(f.errors[0],failure);assert.equal(key.currentElement===undefined,true);assert.equal(f.owner.globalKeyCount,0);assert.equal(old.mounted,false);assert.equal(old.unmounts,1);
      fail=false;f.update(widget(true));assert(key.currentElement?.active);assert.notEqual(key.currentElement,old);assert.equal(f.errors.length,1);
    }finally{f.close();}
  }
});

test('a throwing render projection cannot strand a failed State activation outside retirement',{timeout},()=>{
  for(const failure of [undefined,null,0]){
    let fail=false,disposed=0,reads=0;const cleanup=new Error('projection during move cleanup');
    class MovingWidget extends StatefulWidget{createState(){return new MovingState();}}
    class MovingState extends State{
      activate(){if(!fail)return;Object.defineProperty(this.context,'renderObjects',{get(){reads++;throw cleanup;}});throw failure;}
      build(){return new TaggedLeaf('moving');}
      dispose(){disposed++;}
    }
    const key=new GlobalKey('failed-projection'),left=new ValueKey('left'),right=new ValueKey('right'),widget=moved=>new Branch([new Branch(moved?[]:[new MovingWidget(key)],{key:left}),new Branch(moved?[new MovingWidget(key)]:[],{key:right})]),f=tree(widget(false));
    try{
      f.flush();const state=key.currentState;fail=true;f.update(widget(true));
      assert.equal(f.errors.length,1);assert(f.errors[0] instanceof AggregateError);assert.equal(f.errors[0].errors[0],failure);
      const collect=error=>error instanceof AggregateError?error.errors.flatMap(collect):[error];assert.deepEqual(collect(f.errors[0]),[failure,cleanup]);assert.equal(reads,1);
      assert.equal(key.currentElement===undefined,true,'Projection failure must still retire the moved State');assert.equal(state.mounted,false);assert.equal(disposed,1);assert.equal(f.owner.globalKeyCount,0);
    }finally{f.close();}
  }
});

test('GlobalKey retake migrates descendant dirty work across isolated scopes and preserves a nested scope',{timeout},()=>{
  class ScopedBranch extends Branch {createElement(){return new ScopedElement(this);}}
  class ScopedElement extends BranchElement {scope=new BuildScope();get buildScope(){return this.scope;}}
  const key=new GlobalKey('scope-retake'),leftKey=new ValueKey('scope-left'),rightKey=new ValueKey('scope-right');
  const moved=()=>new Branch([new Branch(),new ScopedBranch([new Branch()])],{key});
  const widget=right=>new Branch([new ScopedBranch(right?[]:[moved()],{key:leftKey}),new ScopedBranch(right?[moved()]:[],{key:rightKey})]);
  const f=tree(widget(false));
  try{
    f.owner.flushBuild();const [left,right]=f.root.children;f.owner.buildScope(left);f.owner.buildScope(right);
    const retained=key.currentElement,ordinary=retained.children[0],nested=retained.children[1];f.owner.buildScope(nested);const inner=nested.children[0];
    assert.equal(ordinary.buildScope,left.scope);assert.equal(inner.buildScope,nested.scope);
    ordinary.markNeedsBuild();inner.markNeedsBuild();assert.equal(f.owner.hasDirty,true);
    f.root.update(widget(true));f.owner.flushBuild();f.owner.buildScope(right);f.owner.buildScope(left);f.owner.buildScope(nested);f.root.syncRenderTree();f.owner.finalizeTree();
    assert.equal(key.currentElement,retained);assert.equal(retained.parent,right);assert.equal(ordinary.buildScope,right.scope);assert.equal(inner.buildScope,nested.scope);assert.equal(retained.unmounts,0);
    assert.equal(f.owner.hasDirty,false,'All migrated and nested scope work has drained');
    ordinary.markNeedsBuild();f.owner.flushBuild();f.owner.buildScope(left);assert(ordinary.dirty,'The preceding scope must not rebuild the moved descendant');
    assert.equal(f.owner.hasDirty,true,'Another scope cannot hide pending work in the moved subtree');
    f.owner.buildScope(right);assert.equal(ordinary.dirty,false);assert.equal(left.scope.hasDirty,false);assert.equal(right.scope.hasDirty,false);assert.equal(f.owner.hasDirty,false);assert.deepEqual(f.errors,[]);
  }finally{f.close();}
});

test('dirty admission deduplicates, repairs depth changes and removes detached work without stale heap entries',{timeout},()=>{
  const trace=[];
  class TrackedElement extends BranchElement{rebuild(){trace.push(this);super.rebuild();}}
  const tracked=children=>{const widget=new Branch(children);widget.createElement=()=>new TrackedElement(widget);return widget;};
  const f=tree(tracked([tracked([tracked([])]),tracked([]),tracked([tracked([])])]));
  try{
    f.flush();trace.length=0;const [left,middle,right]=f.root.children,deep=left.children[0],other=right.children[0];
    deep.markNeedsBuild();other.markNeedsBuild();right.markNeedsBuild();middle.markNeedsBuild();left.markNeedsBuild();deep.markNeedsBuild();
    // A GlobalKey activation normally refreshes depth and readmits the same
    // record. Exercise both priority directions without a second heap entry.
    deep.depth=1;deep.markNeedsBuild();deep.depth=3;deep.markNeedsBuild();
    f.root.forgetChild(middle);f.owner.deactivateChild(middle);f.owner.flushBuild();f.owner.finalizeTree();
    assert.deepEqual(trace,[right,left,other,deep]);assert.equal(new Set(trace).size,trace.length);
    assert(middle.debugIsDefunct);assert.equal(f.owner.hasDirty,false);
  }finally{f.close();}
});

test('one pending build scope rejects another View before queue mutation and can be reused after draining',{timeout},()=>{
  const scope=new BuildScope(),a=new BuildOwner({},()=>{}),b=new BuildOwner({},()=>{});
  class ScopedElement extends BranchElement{get buildScope(){return scope;}}
  const widget=new Branch(),left=new ScopedElement(widget),right=new ScopedElement(widget);let replacement;
  try{
    left.mount(undefined,a);assert.throws(()=>right.mount(undefined,b),{code:'foreign-build-scope'});
    assert.equal(a.hasDirty,true);assert.equal(b.hasDirty,false);assert.equal(scope.hasDirty,true);
    right.unmount();a.buildScope(left);assert.equal(a.hasDirty,false);assert.equal(scope.hasDirty,false);
    replacement=new ScopedElement(new Branch());replacement.mount(undefined,b);b.buildScope(replacement);
    assert.equal(b.hasDirty,false);assert.equal(scope.hasDirty,false);
  }finally{replacement?.unmount();right.unmount();left.unmount();a.dispose();b.dispose();}
});
