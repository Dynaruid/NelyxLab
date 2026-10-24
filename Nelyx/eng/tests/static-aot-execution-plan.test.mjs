// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createRuntimeInventory} from '../../sdk/tooling/static-aot/src/runtime-inventory.mjs';
import {createExecutionPlan,bindNativeCoverage,verifyFrontendPlan} from '../../sdk/tooling/static-aot/src/execution-plan.mjs';
const timeout=1_200_000,hash=value=>createHash('sha256').update(value).digest('hex');
function fixture(source){
  const record={id:'main.js',metroId:0,role:'prepend',owner:{name:'application',version:'1',root:'.',manifestSha256:hash('owner'),license:'BSD-3-Clause'},source,emitted:source,sourceFile:'main.js',dialect:'javascript',dependencies:[]};
  const inventory=createRuntimeInventory({identity:{},entry:record.id,modules:[record],sourceMapModules:[record.id]});
  const partition={typePolicy:{sha256:hash('policy'),decisions:[]},bindings:[],graph:{sha256:hash('graph')},irSha256:hash('ir'),sourceSha256:hash('typed')};
  const plan=createExecutionPlan({inventory,records:[record],spans:[{id:record.id,offset:0,end:source.length}],code:source},partition);
  const definitions=[{symbol:'_0_global',position:{offset:0}},{symbol:'_1_live',position:{offset:source.indexOf('function live')}}];
  const root={unit:'nelyx_app',sourceSha256:hash(source),functions:definitions,baseline:{functions:definitions}},typed={unit:'nelyx_typed',sourceSha256:partition.sourceSha256,functions:[],baseline:{functions:[]}};
  const build={units:[{unit:root.unit,nativeFunctions:root},{unit:typed.unit,nativeFunctions:typed}]},identity={sourceSha256:hash(source),typedSourceSha256:partition.sourceSha256,partitionSha256:partition.irSha256,librarySha256:hash('image'),toolchainSha256:hash('compiler')};
  return {plan,build,identity};
}
test('coverage requires actual native callable ownership and rejects source identity changes',{timeout},()=>{
  const {plan,build,identity}=fixture('function live(){return 7;} globalThis.call=live;');
  const linked=bindNativeCoverage(plan,build,identity);assert.equal(linked.summary.wholeAppNativeAot,true);assert.equal(linked.summary.originalCallables.dynamic,1);
  assert.equal(verifyFrontendPlan(linked),linked);const shortened=structuredClone(linked);shortened.modules[0].originals.pop();assert.throws(()=>verifyFrontendPlan(shortened),/body\/graph plan differs/);
  const missing=structuredClone(build);missing.units[0].nativeFunctions.functions=missing.units[0].nativeFunctions.baseline.functions=[{symbol:'_0_global',position:{offset:0}}];
  assert.equal(bindNativeCoverage(plan,missing,identity).summary.wholeAppNativeAot,false);
  assert.throws(()=>bindNativeCoverage(plan,build,{...identity,sourceSha256:hash('changed')}),/source identity/);
  assert.equal(bindNativeCoverage(linked,build,identity).sha256,linked.sha256);
});
test('runtime code generation cannot acquire whole-runtime coverage from callable counts',{timeout},()=>{
  const {plan,build,identity}=fixture('function live(){return eval("7");} globalThis.call=live;');
  const result=bindNativeCoverage(plan,build,identity);assert.equal(result.summary.wholeAppNativeAot,false);assert.equal(result.summary.dynamicCodeCandidates,1);
});
test('an absent optional Metro slot is a native resolution exception only with the null-throw loader contract',{timeout},()=>{
  const owner={name:'fixture',version:'1',root:'.',manifestSha256:hash('owner'),license:'MIT'},loader='windows/runner/node_modules/metro-runtime/src/polyfills/require.js';
  for(const [optional,slot,guard,accepted]of [[true,'null','===',true],[false,'null','===',false],[true,'3','===',false],[true,'null','!==',false]]){
    const texts=[`function metroRequire(id){if(id${guard}null){throw Error('Cannot find module');}return id;}`,`__d(function(g,r,i,a,m,e,d){try{r(d[0]);}catch(error){}},1,[${slot}]);`],ids=[loader,'main.js'];
    const records=texts.map((source,index)=>({id:ids[index],metroId:index,role:index?'module':'prepend',owner,source,emitted:source,sourceFile:ids[index],dialect:'javascript',dependencies:index?[{specifier:'optional',target:null,asyncType:null,optional}]:[]}));
    const inventory=createRuntimeInventory({identity:{},entry:'main.js',modules:records,sourceMapModules:ids});let offset=0;const spans=records.map(record=>{const span={id:record.id,offset,end:offset+record.emitted.length};offset=span.end+1;return span;});
    const partition={typePolicy:{sha256:hash('policy'),decisions:[]},bindings:[],graph:{sha256:hash('graph')},irSha256:hash('ir'),sourceSha256:hash('typed')};
    const plan=createExecutionPlan({inventory,records,spans,code:texts.join('\n')},partition);assert.equal(plan.unresolved.length,accepted?0:1);assert.equal(plan.dependencyFailures.length,accepted?1:0);
  }
});
