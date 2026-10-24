// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import ts from 'typescript';import vm from 'node:vm';
import {lowerNumericPartition} from '../../sdk/tooling/static-aot/src/numeric-partition.mjs';
import {Cubic} from '../../dist/framework/animation/curves.js';import {lerp} from '../../dist/ui/value-math.js';
const timeout=1_200_000,core=path.resolve(import.meta.dirname,'../..'),options={entry:path.join(core,'src/framework/animation/curves.ts'),applicationRoot:core,packageRoots:[]};
const selections=[{module:'application/src/framework/animation/curves.ts',className:'Cubic',name:'_evaluateCubic'},{module:'application/src/ui/value-math.ts',name:'lerp'}];
test('real Cubic and lerp bodies lower through typed scalar IR with source identity and binary64 evaluation order',{timeout},()=>{
  const result=lowerNumericPartition(options,selections);assert.equal(result.ir.functions.length,2);assert.equal(result.ir.functions[0].receiver,'excluded-from-kernel');assert.equal(result.graphDiagnostics.length,0);
  assert(result.segments.length>20);assert(result.segments.every(segment=>Number.isSafeInteger(segment.sourceOffset)&&segment.line>0&&segment.column>0));
  const context=vm.createContext({});vm.runInContext(ts.transpileModule(result.source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,context);
  const [cubic,linear]=result.bindings.map(binding=>context[binding.globalName]),curve=new Cubic(.4,0,.2,1);
  for(const args of [[.4,.2,.5],[-0,0,-0],[Infinity,1,.5],[NaN,2,1],[Number.MIN_VALUE,-Number.MIN_VALUE,.75]]){assert(Object.is(cubic(...args),curve._evaluateCubic(...args)));assert(Object.is(linear(...args),lerp(...args)));}
  const repeated=lowerNumericPartition(options,selections);assert.equal(result.irSha256,repeated.irSha256);assert.equal(result.sourceSha256,repeated.sourceSha256);
});
test('stateful curve loops and nontrivial dependencies stay explicit exclusions instead of silently losing semantics',{timeout},()=>{
  assert.throws(()=>lowerNumericPartition(options,[{module:selections[0].module,className:'Cubic',name:'transformInternal'}]),error=>error.code==='NELYX_TYPED_UNSUPPORTED'&&/curves\.ts:\d+:\d+/.test(error.message));
  assert.throws(()=>lowerNumericPartition(options,[selections[1],selections[1]]),/Duplicate partition symbol/);
});
