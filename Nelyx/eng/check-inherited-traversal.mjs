// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';

if (!process.argv.includes('--child')) {
  try {
    await execute(process.execPath, [import.meta.filename, '--child'], {
      cwd: process.cwd(),
      timeout: 1_200_000,
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
} else {
  const bundled = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
import assert from 'node:assert/strict';
import {Widget,Element,BuildOwner,InheritedWidget,InheritedElement,visitAncestorInheritedElements} from './Nelyx/src/framework/widgets/framework.ts';
import {GlobalKey} from './Nelyx/src/framework/widgets/global-key.ts';
import {FlutterError} from './Nelyx/src/foundation/flutter-error.ts';
import {Directionality} from './Nelyx/src/framework/widgets/app-data.ts';
import {Focus,FocusScope} from './Nelyx/src/framework/widgets/focus-scope.ts';
import {FocusNode,FocusScopeNode} from './Nelyx/src/framework/widgets/focus.ts';
import {findFocusAncestor} from './Nelyx/src/framework/widgets/focus-tree-context.ts';
import {FocusTraversalOrder} from './Nelyx/src/framework/widgets/focus-traversal-order.ts';
import {NumericFocusOrder} from './Nelyx/src/framework/widgets/focus-traversal-policy.ts';
import {focusOrderFor,traversalDirections,markTraversalScrollable,traversalScrollable} from './Nelyx/src/framework/widgets/focus-traversal-context.ts';
import {Actions,Intent,CallbackAction} from './Nelyx/src/framework/widgets/actions.ts';

FlutterError.onError=details=>{throw details.exception;};
class Host extends Widget {
  constructor(readonly items:Widget[]=[],key=null){super(key);}
  createElement(){return new HostElement(this);}
}
class HostElement extends Element {
  protected build(){return (this.widget as Host).items;}
  replace(items){this.children=this.reconcile(this.children,items);this.owner.parentRebuilt(this);}
}
class Data extends InheritedWidget {
  constructor(readonly value,child){super(child);}
  updateShouldNotify(old){return old.value!==this.value;}
}
class DynamicData extends Data {get typeToken(){return Data;}}
const reference=(context,visitor)=>context.visitAncestorElements(element=>element instanceof InheritedElement?visitor(element):true);
const collect=(context,visit=visitAncestorInheritedElements)=>{
  const result=[];visit(context,element=>{result.push(element);return true;});return result;
};
const wrap=(child,count=64)=>{for(let index=0;index<count;index++)child=new Host([child]);return child;};
const key=new GlobalKey('inherited-traversal-reader'),owner=new BuildOwner({} as any,()=>{});
const root=new Data('outer',new Host([new Data('near',wrap(new Host([],key))),new Host(),new DynamicData('dynamic',new Host())])).createElement();
root.mount(undefined,owner);
const flush=()=>{owner.flushBuild();owner.finalizeTree();};
let ordinaryVisits=0,providerVisits=0;
try {
  flush();const leaf=key.currentElement,near=root.children[0].children[0],right=root.children[0].children[1],dynamic=root.children[0].children[2].children[0];
  assert.deepEqual(collect(leaf),collect(leaf,reference));
  leaf.visitAncestorElements(()=>{ordinaryVisits++;return true;});
  visitAncestorInheritedElements(leaf,()=>{providerVisits++;return true;});
  assert.equal(ordinaryVisits,67);assert.equal(providerVisits,2);
  const stopped=[];visitAncestorInheritedElements(leaf,element=>{stopped.push(element);return false;});
  assert.deepEqual(stopped,[near],'Nearest provider did not stop the traversal');
  const failure={callback:true};assert.throws(()=>visitAncestorInheritedElements(leaf,()=>{throw failure;}),error=>error===failure);
  let reentries=0;visitAncestorInheritedElements(leaf,()=>{assert.deepEqual(collect(leaf),[near,root]);reentries++;return true;});assert.equal(reentries,2);
  // Widget values are read by the caller on every query, including exceptions.
  const previousWidget=near.widget;
  near.update(new Data('latest',previousWidget.child));flush();
  assert.equal(collect(leaf)[0].widget.value,'latest');
  const getFailure={getter:true};Object.defineProperty(near,'widget',{configurable:true,get(){throw getFailure;}});
  for(const visit of [reference,visitAncestorInheritedElements])
    assert.throws(()=>visit(leaf,element=>{void element.widget;return true;}),error=>error===getFailure);
  Object.defineProperty(near,'widget',{configurable:true,writable:true,value:new Data('latest',previousWidget.child)});
  // Each callback observes the live parent after it returns.
  const alternate=new Data('alternate',new Host()).createElement();alternate.mount(undefined,owner);flush();
  const oldParent=near.parent;
  try {
    for(const visit of [reference,visitAncestorInheritedElements]){
      near.parent=oldParent;const seen=[];
      visit(leaf,element=>{seen.push(element);if(element===near)near.parent=alternate;return true;});
      assert.deepEqual(seen,[near,alternate]);
    }
  } finally {near.parent=oldParent;alternate.unmount();}
  // Custom traversal retains receiver, stop behavior, exceptions and one call.
  let calls=0;const custom={visitAncestorElements(visitor){assert.equal(this,custom);calls++;if(visitor(near))visitor(root);}};
  custom.visitAncestorElements.call=()=>{throw Error('Own call should not be used');};
  assert.deepEqual(collect(custom),[near,root]);assert.equal(calls,1);
  assert.throws(()=>visitAncestorInheritedElements(custom,()=>{throw failure;}),error=>error===failure);
  const original=Element.prototype.visitAncestorElements;
  Element.prototype.visitAncestorElements=function(visitor){calls++;return Reflect.apply(original,this,[visitor]);};
  try {const before=calls;assert.deepEqual(collect(leaf),[near,root]);assert.equal(calls,before+1);}
  finally {Element.prototype.visitAncestorElements=original;}
  // The same root moves through GlobalKey activation; old provider links retire.
  const oldContainer=leaf.parent;
  right.replace([new Host([],key)]);oldContainer.replace([]);flush();
  assert.equal(key.currentElement,leaf);assert.deepEqual(collect(leaf),[root]);
  dynamic.replace([new Host([],key)]);right.replace([]);flush();
  assert.equal(key.currentElement,leaf);assert.deepEqual(collect(leaf),collect(leaf,reference));
  assert.equal(collect(leaf)[0].widget.value,'dynamic');
  // A subclass's virtual traversal also keeps the full extension path.
  leaf.visitAncestorElements=function(visitor){calls++;return Reflect.apply(original,this,[visitor]);};
  const before=calls;assert.deepEqual(collect(leaf),collect(leaf,reference));assert.equal(calls,before+2);delete leaf.visitAncestorElements;
  dynamic.replace([]);flush();assert.equal(key.currentElement,undefined);
  const outcome=visit=>{try{collect(leaf,visit);}catch(error){return [error.constructor,error.code,error.message];}assert.fail('Inactive context accepted');};
  assert.deepEqual(outcome(visitAncestorInheritedElements),outcome(reference));
} finally {root.unmount();owner.dispose();}
assert.equal(owner.globalKeyCount,0);

// Exercise actual Focus/Actions construction and updates, rather than only the helper.
class Fire extends Intent {}
const events=[],first=new FocusScopeNode(),second=new FocusScopeNode(),node=new FocusNode(),focusKey=new GlobalKey('focus-host'),hostKey=new GlobalKey('focus-reader');
const firstOrder=new NumericFocusOrder(1),nextOrder=new NumericFocusOrder(2);
const action=new CallbackAction(Fire,()=>events.push('first')),nextAction=new CallbackAction(Fire,()=>events.push('latest'));
const integrationOwner=new BuildOwner({} as any,()=>{});
const make=(scope,order,direction,mapping)=>new Directionality(direction,new Actions({actions:new Map([[Fire,mapping]]),child:new FocusScope(wrap(new FocusTraversalOrder(order,new Focus(wrap(new Host([],hostKey)),{key:focusKey,focusNode:node,includeSemantics:false}))),{node:scope,includeSemantics:false})}));
const integration=new Host([make(first,firstOrder,'ltr',action),new Host()]).createElement();
integration.mount(undefined,integrationOwner);
const flushIntegration=()=>{integrationOwner.flushBuild();integrationOwner.finalizeTree();integrationOwner.focus.applyFocusChangesIfNeeded();};
try {
  flushIntegration();const reader=hostKey.currentElement,focusHost=focusKey.currentElement,originalState=focusHost.stateObject;
  assert.equal(node.parent,first);assert.equal(findFocusAncestor(reader),node);
  assert.equal(focusOrderFor(reader),firstOrder);assert.deepEqual(traversalDirections(reader).map(entry=>entry.direction),['ltr']);
  Actions.invoke(reader,new Fire());assert.deepEqual(events,['first']);
  integration.replace([make(second,nextOrder,'rtl',nextAction),new Host()]);flushIntegration();
  assert.equal(focusKey.currentElement,focusHost);assert.equal(focusHost.stateObject,originalState);assert.equal(node.parent,second);
  assert.equal(findFocusAncestor(reader),node);assert.equal(focusOrderFor(reader),nextOrder);
  assert.deepEqual(traversalDirections(reader).map(entry=>entry.direction),['rtl']);
  Actions.invoke(reader,new Fire());assert.deepEqual(events,['first','latest']);
  node.requestFocus();integrationOwner.focus.applyFocusChangesIfNeeded();assert.equal(integrationOwner.focus.primaryFocus,node);
  // A Focus subtree moves without being recreated; lookup follows its new scope.
  const destination=integration.children[1],oldParent=focusHost.parent;
  destination.replace([new Focus(wrap(new Host([],hostKey)),{key:focusKey,focusNode:node,includeSemantics:false})]);
  oldParent.update(new FocusTraversalOrder(nextOrder,new Host()));flushIntegration();
  assert.equal(focusKey.currentElement,focusHost);assert.equal(node.parent,integrationOwner.focus.rootScope);
  assert.equal(focusOrderFor(hostKey.currentElement),null);assert.deepEqual(traversalDirections(hostKey.currentElement),[]);
  // Non-inherited scroll markers still require the original whole-tree query.
  const scrollOwner={};markTraversalScrollable(destination.widget,'vertical',scrollOwner);
  assert.equal(traversalScrollable(hostKey.currentElement),scrollOwner);
  assert.equal(traversalScrollable(hostKey.currentElement,'horizontal'),null);
} finally {
  integration.unmount();integrationOwner.dispose();node.dispose();first.dispose();second.dispose();
}
assert.equal(focusKey.currentElement,undefined);assert.equal(hostKey.currentElement,undefined);
assert.equal(integrationOwner.globalKeyCount,0);
console.log('Inherited traversal: '+ordinaryVisits+' ancestor visits -> '+providerVisits+' provider visits; order/stop/live values, dynamic tokens, custom traversal/receiver, exceptions, reentrancy, GlobalKey moves, Focus/Actions updates and close PASS.');
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
        Buffer.from(bundled.outputFiles[0].contents).toString('base64')
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
