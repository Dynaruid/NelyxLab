// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {FocusManager,FocusNode,FocusScopeNode} from '@nelyx/core/framework/widgets/focus';
import {Focus} from '@nelyx/core/framework/widgets/focus-scope';
import {SizedBox} from '@nelyx/core/framework/widgets/basic';
import {fixture} from '../../../packages/material/tests/root-fixture.mjs';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
const timeout=1_200_000;
FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});

test('attaching an unfocused lazy child leaves existing ancestor focus notifications clean',{timeout},async()=>{
  const manager=new FocusManager(),first=new FocusNode(),next=new FocusNode();let changed=0;
  const releases=[];
  try{
    manager.applyFocusChangesIfNeeded();manager.rootScope.addListener(()=>changed++);
    releases.push(first.attach(manager,()=>{}));await Promise.resolve();assert.equal(changed,0);
    first.requestFocus();await Promise.resolve();assert.equal(manager.primaryFocus,first);changed=0;
    releases.push(next.attach(manager,()=>{}));await Promise.resolve();assert.equal(changed,0);assert.equal(manager.primaryFocus,first);
    next.canRequestFocus=false;await Promise.resolve();assert.equal(changed,0);assert.equal(first.hasPrimaryFocus,true);
  }finally{for(const release of releases.reverse())release();manager.dispose();first.dispose();next.dispose();}
});

test('reparenting preserves focused paths and notifies descendants whose inherited eligibility changes',{timeout},async()=>{
  const f=fixture(),left=new FocusScopeNode(),right=new FocusScopeNode(),branch=new FocusNode(),leaf=new FocusNode(),attachments=[];
  try{
    f.set(new SizedBox(40,40));const context=f.root.root,manager=f.root.buildOwner.focus;
    const attach=(node,parent)=>{const value=node.attach(context);value.reparent({parent});attachments.push(value);return value;};
    attach(left,manager.rootScope);attach(right,manager.rootScope);const moving=attach(branch,left);attach(leaf,branch);
    await Promise.resolve();leaf.requestFocus();await Promise.resolve();assert.equal(manager.primaryFocus,leaf);
    const paths=[];left.addListener(()=>paths.push(['left',left.hasFocus]));right.addListener(()=>paths.push(['right',right.hasFocus]));
    moving.reparent({parent:right});await Promise.resolve();assert.equal(manager.primaryFocus,leaf);assert(left.hasFocus===false&&right.hasFocus===true);
    assert(paths.some(([name,value])=>name==='left'&&!value));assert(paths.some(([name,value])=>name==='right'&&value));
    leaf.unfocus();await Promise.resolve();left.descendantsAreFocusable=false;await Promise.resolve();
    const eligible=[];leaf.addListener(()=>eligible.push(leaf.canRequestFocus));
    moving.reparent({parent:left});await Promise.resolve();assert.equal(leaf.canRequestFocus,false);assert.equal(eligible.at(-1),false);
    moving.reparent({parent:right});await Promise.resolve();assert.equal(leaf.canRequestFocus,true);assert.equal(eligible.at(-1),true);
  }finally{for(const value of attachments.reverse())value.detach();f.close();for(const value of [leaf,branch,right,left])value.dispose();}
});

test('Focus rebuilds semantics only for relevant state while preserving observer callbacks and real focus',{timeout},async()=>{
  const f=fixture(),node=new FocusNode(),notifications=[];let builds=0;
  const widget=Focus.withExternalFocusNode(new SizedBox(40,40),{focusNode:node,onFocusChange:value=>notifications.push(value)});
  try{
    f.set(widget);await Promise.resolve();f.frame();
    const find=element=>element.widget===widget?element:element.children.map(find).find(Boolean),element=find(f.root.root),state=element.stateObject,build=state.build;
    state.build=function(...args){builds++;return build.apply(this,args);};notifications.length=0;
    node.notifyListeners();await Promise.resolve();f.frame();assert.equal(builds,0);assert.deepEqual(notifications,[false]);
    node.canRequestFocus=false;await Promise.resolve();f.frame();assert.equal(builds,1);
    const semantics=()=>f.root.nodes.find(value=>value.id.startsWith('focus-'));
    assert.equal(semantics().actions?.focus,undefined);
    node.skipTraversal=true;await Promise.resolve();f.frame();assert.equal(builds,1);
    node.canRequestFocus=true;await Promise.resolve();f.frame();assert.equal(builds,2);assert.equal(typeof semantics().actions.focus,'function');
    semantics().actions.focus();await Promise.resolve();f.frame();assert.equal(node.hasPrimaryFocus,true);assert.equal(semantics().focused,true);assert.equal(notifications.at(-1),true);
  }finally{f.close();node.dispose();}
});

test('custom FocusNode getters keep conservative rebuilds and their live reads',{timeout},async()=>{
  let reads=0,builds=0;
  class CustomNode extends FocusNode{get canRequestFocus(){reads++;return super.canRequestFocus;}set canRequestFocus(value){super.canRequestFocus=value;}}
  const f=fixture(),node=new CustomNode(),widget=Focus.withExternalFocusNode(new SizedBox(40,40),{focusNode:node});
  try{
    f.set(widget);await Promise.resolve();f.frame();
    const find=element=>element.widget===widget?element:element.children.map(find).find(Boolean),state=find(f.root.root).stateObject,build=state.build;
    state.build=function(...args){builds++;return build.apply(this,args);};reads=0;
    node.notifyListeners();await Promise.resolve();f.frame();assert.equal(builds,1);assert(reads>0);
    Object.defineProperty(node,'canRequestFocus',{configurable:true,get(){reads++;return false;}});
    node.notifyListeners();await Promise.resolve();f.frame();assert.equal(builds,2);
    assert.equal(f.root.nodes.find(value=>value.id.startsWith('focus-')).actions?.focus,undefined);
  }finally{f.close();node.dispose();}
});
