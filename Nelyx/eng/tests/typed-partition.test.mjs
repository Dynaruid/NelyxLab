// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import vm from 'node:vm';import ts from 'typescript';
import {lowerPartition} from '../../sdk/tooling/static-aot/src/partition.mjs';
import {Cubic} from '../../dist/framework/animation/curves.js';
const timeout=1_200_000,core=path.resolve(import.meta.dirname,'../..');
const options={entry:path.join(core,'src/framework/animation/curves.ts'),applicationRoot:core,packageRoots:[]};
const selections=['transformInternal','_evaluateCubic'].map(name=>({module:'application/src/framework/animation/curves.ts',className:'Cubic',name}));
selections.push({module:'application/src/ui/value-math.ts',name:'lerp'});
export const corePartition=()=>lowerPartition(options,selections);

test('real Cubic loop and private helper retain receiver, lexical observations, errors and binary64 order',{timeout},()=>{
  const partition=corePartition();class Adapted extends Cubic{}
  const sandbox=vm.createContext({Cubic,Number,RangeError,Math});
  vm.runInContext(ts.transpileModule(partition.source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,sandbox);
  assert.equal(sandbox.kernel0,undefined);assert.equal(sandbox.boundary0,undefined);assert.equal(sandbox.checkedNumber,undefined);
  for(const binding of partition.bindings.filter(binding=>binding.className))Object.defineProperty(Adapted.prototype,binding.name,{value:vm.runInContext('(function('+ (binding.name==='_evaluateCubic'?'a,b,m':'t') +'){'+binding.adapter+'})',sandbox),writable:true,configurable:true});
  const original=new Cubic(.4,0,.2,1),adapted=new Adapted(.4,0,.2,1);
  for(const value of [-Infinity,-0,0,Number.MIN_VALUE,.000001,.1,.25,.5,.75,.999999,1,Infinity])assert(Object.is(original.transform(value),adapted.transform(value)),String(value));
  for(const curve of [original,adapted])assert.throws(()=>curve.transformInternal(NaN),/t must not be NaN/);
  assert(adapted instanceof Cubic);assert.equal(Object.getOwnPropertyDescriptor(adapted,'a').writable,false);
  const observe=curve=>{const reads=[],proxy=new Proxy(curve,{get(target,key,receiver){if(['a','b','c','d','_evaluateCubic'].includes(key))reads.push(key);return Reflect.get(target,key,receiver);}});const value=proxy.transform(.43);return {value,reads};};
  assert.deepEqual(observe(adapted),observe(original));
  const sentinel=Error('sentinel');for(const curve of [original,adapted]){curve._evaluateCubic=()=>{throw sentinel;};assert.throws(()=>curve.transform(.5),error=>error===sentinel);}
  // A callback changes a lexical global after the first iteration. Reads of
  // Math must stay after that callback, rather than being captured on entry.
  const first={abs:()=>{throw sentinel;}},second={abs:Math.abs};sandbox.Math=first;
  const changed=new Adapted(.4,0,.2,1);changed._evaluateCubic=function(...args){sandbox.Math=second;return Cubic.prototype._evaluateCubic.apply(this,args);};
  assert(Object.is(changed.transform(.5),new Cubic(.4,0,.2,1).transform(.5)));
  const repeated=corePartition();assert.equal(partition.irSha256,repeated.irSha256);assert.equal(partition.sourceSha256,repeated.sourceSha256);assert(partition.segments.length>50);
});

test('unsupported object/generic bodies fail at their original TS source positions',{timeout},()=>{
  assert.throws(()=>lowerPartition(options,[{module:'application/src/ui/value-math.ts',name:'hashDoubles'}]),error=>error.code==='NELYX_TYPED_UNSUPPORTED'&&/value-math\.ts:\d+:\d+/.test(error.message));
});
