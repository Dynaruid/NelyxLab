// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {PipelineOwner} from '@nelyx/core/framework/rendering/object';
import {RenderStack} from '@nelyx/core/framework/rendering/boxes';
const timeout=1_200_000;
class ObservedBox extends RenderStack {
  detaches=0;
  detach(){this.detaches++;super.detach();}
}

test('retained children preserve cycle checks through reorder, removal and reparent',{timeout},()=>{
  const root=new ObservedBox(),branch=new ObservedBox(),leaf=new ObservedBox(),sibling=new ObservedBox();
  try{
    root.setChildren([branch,sibling]);branch.insert(leaf);
    root.setChildren([sibling,branch]);root.setChildren([sibling,branch]);
    assert.deepEqual(root.children,[sibling,branch]);assert.equal(leaf.parent,branch);
    assert.throws(()=>leaf.insert(root),/cycle/);assert.throws(()=>root.insert(root),/cycle/);
    assert.throws(()=>sibling.insert(leaf),/another parent|already has a parent/);
    branch.remove(leaf);sibling.insert(leaf);root.setChildren([branch,sibling]);
    assert.equal(leaf.parent,sibling);assert.throws(()=>leaf.insert(root),/cycle/);
  }finally{for(const node of [root,branch,sibling,leaf])node.setChildren([]);for(const node of [leaf,sibling,branch,root])node.dispose();}
});

test('a retired render subtree detaches once and detached child-list disposal does not repeat lifecycle hooks',{timeout},()=>{
  const owner=new PipelineOwner(),nodes=Array.from({length:16},()=>new ObservedBox());
  for(let i=0;i<nodes.length-1;i++)nodes[i].insert(nodes[i+1]);
  try{
    owner.setRoot(nodes[0]);owner.setRoot(undefined);
    for(let i=0;i<nodes.length-1;i++)nodes[i].remove(nodes[i+1]);
    for(const node of nodes){assert.equal(node.detaches,1);assert.equal(node.owner,undefined);assert.equal(node.parent,undefined);}
    const fresh=new ObservedBox();nodes[0].insert(fresh);nodes[0].remove(fresh);assert.equal(fresh.detaches,0,'An unattached child has no detach transition');fresh.dispose();
  }finally{owner.dispose();for(const node of nodes.reverse()){node.setChildren([]);node.dispose();}}
});
test('a failed attached detach still clears the actual child and descendant pipeline owners',{timeout},()=>{
  class FailingBox extends ObservedBox {detach(){this.detaches++;throw Error('detach probe');}}
  const owner=new PipelineOwner(),root=new ObservedBox(),child=new FailingBox(),leaf=new ObservedBox();root.insert(child);child.insert(leaf);
  try{
    owner.setRoot(root);assert.throws(()=>root.remove(child),/detach probe/);
    assert.equal(child.detaches,1);assert.equal(leaf.detaches,1);assert.equal(child.parent,undefined);assert.equal(child.owner,undefined);assert.equal(leaf.owner,undefined);
    child.remove(leaf);assert.equal(leaf.detaches,1,'Failure recovery already retired the descendant owner');
  }finally{owner.dispose();for(const node of [root,child,leaf]){node.setChildren([]);node.dispose();}}
});
test('attach rollback still retires a subclass resource created before super.attach',{timeout},()=>{
  class EarlyFailure extends ObservedBox {
    resources=0;
    attach(){this.resources++;throw Error('early attach probe');}
    detach(){this.resources--;super.detach();}
  }
  const owner=new PipelineOwner(),root=new ObservedBox(),child=new EarlyFailure();
  try{
    owner.setRoot(root);assert.throws(()=>root.insert(child),/early attach probe/);
    assert.equal(child.resources,0);assert.equal(child.detaches,1);assert.equal(child.owner,undefined);assert.equal(child.parent,undefined);assert.equal(child.parentData,undefined);assert.deepEqual(root.children,[]);
  }finally{owner.dispose();root.dispose();child.dispose();}
});

test('paint and semantics invalidate the current pipeline through attach and subtree reparent',{timeout},()=>{
  const counts=[0,0],owners=counts.map((_value,index)=>new PipelineOwner({onNeedVisualUpdate:()=>counts[index]++,onSemanticsUpdate:()=>{}}));
  class EarlyPaint extends ObservedBox {
    attach(owner){if(this.parent?.owner){const index=owners.indexOf(owner),before=counts[index];this.markNeedsPaint();assert(counts[index]>before,'The attached parent still owns invalidation before child attach');}super.attach(owner);}
  }
  const roots=[new ObservedBox(),new ObservedBox()],child=new EarlyPaint(),leaf=new ObservedBox();child.insert(leaf);
  const handles=[];
  try{
    owners.forEach((owner,index)=>{owner.setRoot(roots[index]);handles.push(owner.ensureSemantics());});roots[0].insert(child);
    counts.fill(0);leaf.markNeedsPaint();assert(counts[0]>0);assert.equal(counts[1],0);
    roots[0].remove(child);roots[1].insert(child);counts.fill(0);
    leaf.markNeedsSemanticsUpdate();assert.equal(counts[0],0);assert(counts[1]>0);
    assert.throws(()=>roots[0].insert(child),/another parent|already has a parent/);
  }finally{for(const handle of handles)handle.dispose();for(const owner of owners)owner.dispose();for(const node of [...roots,child,leaf]){node.setChildren([]);node.dispose();}}
});
