// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';
import {timedNativeContext} from './windows-context-diagnostics.ts';
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
