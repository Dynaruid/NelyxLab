// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
const watchdog = setTimeout(() => {
  throw Error('Grid program sharing exceeded 20 minutes');
}, 1_200_000);
try {
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
      import assert from 'node:assert/strict';
      import {viewportGridPrograms} from './Nelyx/runtime/app/grid.ts';
      import {referenceGridPrograms} from './Nelyx/eng/grid-program-reference.mjs';
      import {immutableSceneData} from './Nelyx/runtime/engine-client/scene.ts';
      import {commands as c} from './Nelyx/runtime/engine-client/codec.ts';
      import {nativeLayoutInput as input,nativeLayoutExpression as expression} from '@nelyx/core/framework/rendering/object';
      const tools={input,expression,immutableSceneData},handle={slot:7,generation:3};
      const encode=program=>{try{return {bytes:c.layoutProgram(handle,program)};}catch(error){return {error:error.constructor.name+':'+error.message};}};
      const policy={columns:7,rows:7,maximumRowExtent:48};
      const objects=value=>{
        const seen=new Set<object>();
        const visit=value=>{if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);for(const key of Object.keys(value))visit(value[key]);};
        visit(value);return seen.size;
      };
      let example;
      for(const [count,rtl] of [[0,false],[1,false],[7,true],[28,false],[33,true],[35,false],[36,true],[38,false],[42,false],[49,true],[65,false],[-0,true]]){
        const actual=viewportGridPrograms(policy,count,rtl),expected=referenceGridPrograms(policy,count,rtl,tools);
        assert.deepEqual(actual,expected,'Numeric program changed: '+count+'/'+rtl);
        for(const kind of ['viewport','tiles']){
          assert.deepEqual(encode(actual[kind]),encode(expected[kind]),'Program wire/rejection differs');
          assert(Object.isFrozen(actual[kind])&&Object.isFrozen(actual[kind].layout));
        }
        assert.notEqual(viewportGridPrograms(policy,count,rtl),actual,'A cross-Element program cache was introduced');
        const layouts=actual.tiles.layout.filter(command=>command.kind==='layout');
        if(layouts.length>1){
          assert.equal(layouts[0].values[0],layouts[1].values[0],'Width data was copied per cell');
          assert.equal(layouts[0].values[0],layouts[0].values[1]);
          assert.equal(layouts[0].values[2],layouts[0].values[3]);
          assert.equal(actual.viewport.minWidth,actual.tiles.maxHeight,'Unsupported query was copied per field');
          assert.equal(actual.viewport.layout[2].values[2],actual.viewport.layout[2].values[3]);
          assert(objects(actual)<objects(expected),'Immutable subexpressions were still duplicated');
          const positions=actual.tiles.layout.filter(command=>command.kind==='position');
          if(count===42){
            assert.equal(positions[0].values[0],positions[7].values[0],'Column expression was recreated per row');
            assert.equal(positions[0].values[1],positions[6].values[1],'Row expression was recreated per column');
          }
        }
        if(count===42)example={count,before:objects(expected),after:objects(actual)};
        if(Object.is(count,-0))assert(Object.is(actual.tiles.children,-0),'Signed zero was collapsed');
      }
      const values=()=>{const reads=[];return {reads,policy:{get columns(){reads.push('columns');return 7;},get rows(){reads.push('rows');return 7;},get maximumRowExtent(){reads.push('maximumRowExtent');return 48;}}};};
      const old=values(),next=values();
      assert.deepEqual(viewportGridPrograms(next.policy,42,false),referenceGridPrograms(old.policy,42,false,tools));
      assert.deepEqual(next.reads,old.reads);
      const failure=Error('policy failure');
      for(const columns of [65,Number.MAX_SAFE_INTEGER]){
        const unusual={columns,rows:1,maximumRowExtent:48};
        const actual=viewportGridPrograms(unusual,2,true),expected=referenceGridPrograms(unusual,2,true,tools);
        assert.deepEqual(actual,expected,'Large columns changed the uncached path');
        assert.deepEqual(encode(actual.tiles),encode(expected.tiles));
      }
      const floor=Math.floor,trace=[];
      const floorCase=build=>{
        trace.length=0;
        Math.floor=value=>{trace.push(value);return [-0,0,1000000,.5,1,NaN][trace.length-1];};
        try{return {data:build(policy,6,false),trace:trace.slice()};}
        finally{Math.floor=floor;}
      };
      assert.deepEqual(floorCase(viewportGridPrograms),floorCase((p,c,r)=>referenceGridPrograms(p,c,r,tools)),'Row evaluation/coercion/signed-zero fallback changed');
      for(const build of [(p)=>viewportGridPrograms(p,3,false),(p)=>referenceGridPrograms(p,3,false,tools)])assert.throws(()=>build({get columns(){throw failure;}} as any),e=>e===failure);
      const coercions=[];const boxed={ [Symbol.toPrimitive](){coercions.push('coerce');throw failure;} };
      for(const build of [(p)=>viewportGridPrograms(p,3,false),(p)=>referenceGridPrograms(p,3,false,tools)])assert.throws(()=>build({columns:boxed,rows:7,maximumRowExtent:48} as any),e=>e===failure);
      assert.deepEqual(coercions,['coerce','coerce']);
      // The public input object stays mutable and each new program captures its
      // current data independently. An accessor remains uncacheable, uncalled.
      const descriptor=Object.getOwnPropertyDescriptor(input.maxWidth,'index'),before=viewportGridPrograms(policy,3,false);
      try {
        Object.defineProperty(input.maxWidth,'index',{...descriptor,value:0});
        const changed=viewportGridPrograms(policy,3,false);
        assert.deepEqual(changed,referenceGridPrograms(policy,3,false,tools));
        assert.notDeepEqual(changed,before);
        let reads=0;Object.defineProperty(input.maxWidth,'index',{configurable:true,enumerable:true,get(){++reads;throw failure;}});
        assert.throws(()=>viewportGridPrograms(policy,3,false),/plain data/);
        assert.throws(()=>referenceGridPrograms(policy,3,false,tools),/plain data/);
        assert.equal(reads,0,'Snapshot executed an input accessor');
      } finally {Object.defineProperty(input.maxWidth,'index',descriptor);}
      assert.deepEqual(viewportGridPrograms(policy,3,false),before,'A later call adopted a mutable input snapshot');
      console.log('Grid program sharing: 14 exact data/wire-or-budget-rejection cases, RTL/partial/empty/signed-zero/large indices, current row/policy/input reads, failure/coercion/accessor isolation, deep ownership and no cross-Element cache PASS. '+JSON.stringify(example));
    `,
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    logLevel: 'silent',
  });
  await import(
    'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64')
  );
} catch (error) {
  console.error('Grid program sharing: ' + String(error.message ?? error).slice(0, 1800));
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
}
