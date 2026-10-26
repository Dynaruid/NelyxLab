// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
import {timedNativeContext} from './windows-context-diagnostics.ts';
import {RenderObject,RenderBox} from '@nelyx/core/framework/rendering/object';
import {BoxConstraints} from '@nelyx/core/framework/rendering/constraints';
import {FoundationBuildMode} from '@nelyx/core/foundation/constants';

test('the actual RNW diagnostic layout hook preserves omitted bodies, clean returns and falsey failures',{timeout:1_200_000},()=>{
 // Execute the fixture's exact hook against Core without creating an RN host.
 const fixture=fs.readFileSync(new URL('./windows-animation.tsx',import.meta.url),'utf8'),hook=fixture.split('\n').find(line=>line.trimStart().startsWith('const runLayout=(RenderObject.prototype as any).runLayout;'));assert(hook,'The installed fixture layout hook must be exercised');
 const original=RenderObject.prototype.runLayout,mode=FoundationBuildMode.mode,labels=[];
 try{
  vm.runInNewContext(ts.transpileModule(hook,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,{RenderObject,className:value=>value.constructor.name,bootMark:()=>{},measuredClass:(label,perform)=>{labels.push(label);return perform();}},{timeout:1_200_000});
  class Leaf extends RenderBox{layouts=0;armed=false;failure;performLayout(c){if(this.armed)throw this.failure;this.layouts++;return c.constrain({width:10,height:10});}}
  for(const selectedMode of ['debug','release'])for(const failure of [undefined,null,0]){
   FoundationBuildMode.mode=selectedMode;const leaf=new Leaf(),first=BoxConstraints.tightFor(10,10),second=BoxConstraints.tightFor(20,20);
   try{
    leaf.layout(first);assert.equal(leaf.layouts,1);const measured=labels.length;leaf.layout(first);assert.equal(labels.length,measured,'A clean layout cannot acquire a diagnostic body');
    leaf.layout(second);assert.equal(leaf.layouts,2);assert.equal(leaf.size.width,20);
    let custom=0;leaf.runLayout(first,{},()=>{custom++;leaf.size=first.smallest;});assert.equal(custom,1);assert.equal(leaf.layouts,2,'An explicit custom body retains its own receiver/closure');
    leaf.markNeedsLayout();leaf.failure=failure;leaf.armed=true;let caught=false;try{leaf.layout(first);}catch(error){caught=true;assert.equal(error,failure);}assert(caught);assert.equal(leaf.needsLayout,true);
    leaf.armed=false;leaf.layout(first);assert.equal(leaf.layouts,3);assert.equal(leaf.needsLayout,false);
   }finally{leaf.dispose();}
  }
 }finally{RenderObject.prototype.runLayout=original;FoundationBuildMode.mode=mode;}
});

test('native diagnostics preserve missing APIs, private receivers, live capabilities and close exceptions',{timeout:1_200_000},()=>{
 class Native {#count=0;get width(){return this.#count;}nelyxCoreVersion(){return ++this.#count;}beginRecording(){return ++this.#count;}dispose(){throw this.failure;}failure=new Error('native first cause');}
 const native=new Native(),labels=[],view=timedNativeContext(native,(label,callback)=>{labels.push(label);return callback();});
 assert.equal(view.nelyxSubmitFrame,undefined);assert(!('nelyxSubmitFrame'in view));assert(view instanceof Native);assert.equal(view.constructor,Native);
 assert.equal(view.nelyxCoreVersion(),1);const record=view.beginRecording;assert.equal(record,view.beginRecording);assert.equal(record(),2);assert.equal(view.width,2);assert.deepEqual(labels,['NativeJS.beginRecording']);
 assert.deepEqual(Object.keys(view),Object.keys(native));assert.throws(()=>{view.width=5;},TypeError);
 native.nelyxSubmitFrame=function(){assert.equal(this,native);return 42;};assert.equal(view.nelyxSubmitFrame(),42);native.nelyxSubmitFrame=undefined;assert.equal(view.nelyxSubmitFrame,undefined);
 assert.throws(()=>view.dispose(),error=>error===native.failure);assert.deepEqual(labels,['NativeJS.beginRecording','NativeJS.nelyxSubmitFrame','NativeJS.dispose']);
 const frozen=Object.freeze({beginRecording(){return this;}}),wrapped=timedNativeContext(frozen,(_label,callback)=>callback());assert.equal(wrapped.beginRecording(),frozen);
});
