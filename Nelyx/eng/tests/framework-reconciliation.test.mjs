// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {BuildOwner,BuildScope,Element,Widget,LeafRenderObjectElement,LeafRenderObjectWidget} from '@nelyx/core/framework/widgets/framework';
import {Key,ValueKey} from '@nelyx/core/foundation/key';
import {GlobalKey} from '@nelyx/core/framework/widgets/global-key';
import {SizedBox} from '@nelyx/core/framework/widgets/basic';
import {RenderStack} from '@nelyx/core/framework/rendering/boxes';

const timeout=1_200_000;

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
