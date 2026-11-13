// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
const watchdog = setTimeout(() => {
  throw Error('Semantics construction checks exceeded 20 minutes');
}, 1_200_000);
try {
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
      import assert from 'node:assert/strict';
      import {SemanticsProperties,sourceSemanticsProperties} from './Nelyx/src/framework/semantics/semantics.ts';
      import {Semantics} from './Nelyx/src/framework/widgets/semantics.ts';
      import {FoundationBuildMode} from './Nelyx/src/foundation/constants.ts';
      const original=FoundationBuildMode.mode;
      try {
        const actions=new Map(),nodes=new Set(['a']),callback=()=>{},input={label:'day',selected:true,enabled:false,onTap:callback,customSemanticsActions:actions,controlsNodes:nodes};
        for(const mode of ['release','debug']) {
          FoundationBuildMode.mode=mode;
          const reads=[[],[]];
          const options=index=>new Proxy(input,{get(target,key){reads[index].push(key);return Reflect.get(target,key)}});
          const expected=new SemanticsProperties(options(0)),actual=sourceSemanticsProperties(options(1));
          assert.deepEqual(reads[1],reads[0],'Source option evaluation order differed');
          assert.deepEqual(Object.getOwnPropertyDescriptors(actual),Object.getOwnPropertyDescriptors(expected));
          assert.equal(Object.getPrototypeOf(actual),Object.getPrototypeOf(expected));
          assert.equal(actual instanceof SemanticsProperties,true);assert.equal(Object.isFrozen(actual),true);
          assert.notEqual(actual,sourceSemanticsProperties(input),'Source instances were shared');
          assert.equal(actual.customSemanticsActions,actions);assert.equal(actual.controlsNodes,nodes);assert.equal(actual.onTap,callback);
          const error={},effects=[[],[]];
          for(const [index,make] of [v=>new SemanticsProperties(v),sourceSemanticsProperties].entries())
            assert.throws(()=>make(new Proxy({}, {get(_target,key){effects[index].push(key);if(key==='label')throw error;return undefined}})),value=>value===error);
          assert.deepEqual(effects[1],effects[0],'Getter throw point or identity differed');
        }
        FoundationBuildMode.mode='debug';
        for(const input of [{label:'x',attributedLabel:{}},{headingLevel:7},{linkUrl:'x',link:false}]){
          const failures=[v=>new SemanticsProperties(v),sourceSemanticsProperties].map(make=>{try{make(input);assert.fail('Invalid semantics accepted')}catch(error){return [error.constructor,error.message]}});
          assert.deepEqual(failures[1],failures[0]);
        }
        let setters=0;Object.defineProperty(SemanticsProperties.prototype,'label',{configurable:true,set(){setters++}});
        try {assert.equal(sourceSemanticsProperties({label:'source'}).label,'source');assert.equal(new SemanticsProperties({label:'public'}).label,'public');assert.equal(setters,0);}
        finally{delete SemanticsProperties.prototype.label;}
        class Extended extends SemanticsProperties { extra=17; }
        const derived=new Extended({label:'derived'});assert.equal(derived.extra,17);assert.equal(Object.isExtensible(derived),true);
        assert.equal(Object.getOwnPropertyDescriptor(derived,'label').writable,false);
        const widget=new Semantics({label:'widget',button:true,onTap:callback});assert.equal(widget.properties.label,'widget');assert.equal(widget.properties.onTap,callback);assert(Object.isFrozen(widget.properties));
        console.log('Source semantics values: full field/descriptor/prototype oracle, getter/Proxy/throw order, callback/collection identity, debug validation, public subclasses and Widget integration PASS');
      } finally {FoundationBuildMode.mode=original;}
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
  console.error(error.message);
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
}
