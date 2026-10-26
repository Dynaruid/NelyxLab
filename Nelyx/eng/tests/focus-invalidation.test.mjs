// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {FocusManager,FocusNode,FocusScopeNode} from '@nelyx/core/framework/widgets/focus';
import {Focus} from '@nelyx/core/framework/widgets/focus-scope';
import {SizedBox,Builder} from '@nelyx/core/framework/widgets/basic';
import {Element} from '@nelyx/core/framework/widgets/framework';
import {fixture} from '../../../packages/material/tests/root-fixture.mjs';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
const timeout=1_200_000;
FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});

test('focus attachment preserves live nominal checks, Proxy contexts and falsey failures',{timeout},async()=>{
  const f=fixture(),node=new FocusNode(),blocked=new FocusNode(),events=[],original=Object.getOwnPropertyDescriptor(Element,Symbol.hasInstance),ordinary=Function.prototype[Symbol.hasInstance];let context,attachment,armed=false,failure;
  try{
    f.set(new Builder(value=>{context=value;return new SizedBox(40,40);}));
    Object.defineProperty(Element,Symbol.hasInstance,{configurable:true,value:function(value){assert.equal(this,Element);events.push('instanceof');if(armed)throw failure;return ordinary.call(this,value);}});
    const proxy=new Proxy(context,{getPrototypeOf(target){events.push('prototype');return Reflect.getPrototypeOf(target);},get(target,key,receiver){if(key==='active')events.push('active');return Reflect.get(target,key,receiver);}});
    attachment=node.attach(proxy);assert.deepEqual(events,['prototype','instanceof','prototype','active']);assert.equal(node.context,proxy);
    attachment.reparent();node.requestFocus();await Promise.resolve();f.frame();assert.equal(node.hasPrimaryFocus,true);
    for(failure of [undefined,null,0]){events.length=0;armed=true;let caught=false;try{blocked.attach(proxy);}catch(error){caught=true;assert.equal(error,failure);}assert(caught);assert.deepEqual(events,['prototype','instanceof']);assert.equal(blocked.context,null);}
    armed=false;let activeReads=0;assert.throws(()=>blocked.attach({get active(){activeReads++;return true;},owner:context.owner}),/live Element/);assert.equal(activeReads,0,'A structural lookalike cannot acquire the Element owner');
  }finally{armed=false;if(original)Object.defineProperty(Element,Symbol.hasInstance,original);else delete Element[Symbol.hasInstance];attachment?.detach();f.close();node.dispose();blocked.dispose();}
});

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
