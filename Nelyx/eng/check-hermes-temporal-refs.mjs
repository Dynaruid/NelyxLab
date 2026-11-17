// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';

const root = path.resolve(import.meta.dirname, '../..');
if (!process.argv.includes('--child')) {
  await execute(process.execPath, [import.meta.filename, '--child', ...process.argv.slice(2)], {
    cwd: root,
    timeout: 1_200_000,
  });
} else {
  const load = createRequire(import.meta.url),
    babel = load('@babel/core'),
    prune = load('../sdk/tooling/metro/src/hermes-temporal-refs.cjs'),
    blockScoping = load('../sdk/tooling/metro/src/hermes-block-scoping.cjs'),
    loopTdz = load('../sdk/tooling/metro/src/hermes-loop-tdz.cjs'),
    presetLoad = createRequire(load.resolve('@react-native/babel-preset/package.json'));
  const raw = `
    var sentinel={};
    function check(value,name){if(value===sentinel)throw new ReferenceError(name);return value;}
    var checks=0;
    function same(a,b){checks++;if(JSON.stringify(a)!==JSON.stringify(b))throw Error('different '+JSON.stringify([a,b]));}
    function fails(action){try{action();return 'missing';}catch(error){return error.name;}}
    function straight(value){var x=value;return [check(x,'x'),check(x,'x'),check(x,'x')];}
    same(straight(3),[3,3,3]);
    same(fails(()=>straight(sentinel)),'ReferenceError');
    function reset(){var x=3;check(x,'x');x=sentinel;return check(x,'x');}
    same(fails(reset),'ReferenceError');
    function branches(flag){var x=3;check(x,'x');if(flag)x=sentinel;return check(x,'x');}
    same(branches(false),3);same(fails(()=>branches(true)),'ReferenceError');
    function branchProof(flag,value){var x=value;if(flag)check(x,'x');return check(x,'x');}
    same(branchProof(true,4),4);same(fails(()=>branchProof(false,sentinel)),'ReferenceError');
    function shortCircuit(flag,value){var x=value;flag&&check(x,'x');return check(x,'x');}
    same(shortCircuit(true,4),4);same(fails(()=>shortCircuit(false,sentinel)),'ReferenceError');
    function conditional(flag,value){var x=value;flag?check(x,'x'):0;return check(x,'x');}
    same(conditional(true,4),4);same(fails(()=>conditional(false,sentinel)),'ReferenceError');
    function closure(){var x=3;function mutate(){x=sentinel;}check(x,'x');mutate();return check(x,'x');}
    same(fails(closure),'ReferenceError');
    function capturedRead(value){var x=value;var read=()=>x;check(x,'x');return check(x,'x')+read();}
    same(capturedRead(5),10);
    function shadow(){var check=(x)=>x+1;var x=2;return [check(x,'x'),check(x,'x')];}
    same(shadow(),[3,3]);
    function loops(){var seen=[];for(var i=0;i<3;i++){var x=i===2?sentinel:i;seen.push(check(x,'x'));check(x,'x');}return seen;}
    same(fails(loops),'ReferenceError');
    function loopExit(){var x=3;check(x,'x');for(var i=0;i<2;i++){x=sentinel;break;}return check(x,'x');}
    same(fails(loopExit),'ReferenceError');
    function tryReset(){var x=3;try{check(x,'x');x=sentinel;throw 1;}catch(error){}return check(x,'x');}
    same(fails(tryReset),'ReferenceError');
    function tryEntry(){var x=sentinel;try{throw 1;check(x,'x');}catch(error){return check(x,'x');}}
    same(fails(tryEntry),'ReferenceError');
    function finallyEntry(){var x=sentinel;try{throw 1;}finally{check(x,'x');}}
    same(fails(finallyEntry),'ReferenceError');
    function switches(flag){var x=3;check(x,'x');switch(flag){case 0:check(x,'x');if(flag===0)x=sentinel;check(x,'x');break;default:break;}return check(x,'x');}
    same(switches(1),3);same(fails(()=>switches(0)),'ReferenceError');
    function optional(){var x=sentinel;var f=null;f?.(check(x,'x'));return check(x,'x');}
    same(fails(optional),'ReferenceError');
    function deletes(){var x=1;check(x,'x');return delete check(x,'x');}
    same(deletes(),true);
    function destructure(){var x=3;check(x,'x');[x]=[sentinel];return check(x,'x');}
    same(fails(destructure),'ReferenceError');
    function classCapture(){var x=3;check(x,'x');class C{static reset(){x=sentinel;}field=x;}C.reset();return check(x,'x');}
    same(fails(classCapture),'ReferenceError');
    function deferredField(){var x=3;check(x,'x');class C{field=(x=sentinel);}new C();return check(x,'x');}
    same(fails(deferredField),'ReferenceError');
    function logicalWrite(){var x=3;check(x,'x');x&&=sentinel;return check(x,'x');}
    same(fails(logicalWrite),'ReferenceError');
    function doLoop(){var x=3;var i=0;do{check(x,'x');x=i++?sentinel:4;}while(check(x,'x')&&i<3);}
    same(fails(doLoop),'ReferenceError');
    function tagged(){var x=3;check(x,'x');var tag=(parts)=>{x=sentinel;return parts[0];};tag\`value\`;return check(x,'x');}
    same(fails(tagged),'ReferenceError');
    function aliases(){var x={v:4};var y=x;return check(y,'y').v+check(y,'y').v;}
    same(aliases(),8);
    function compound(){var x=sentinel;x=1;x+=2;return check(x,'x')+check(x,'x');}
    same(compound(),6);
    globalThis.__nelyxTemporalFixture=JSON.stringify({checks});
  `;
  const lexical = `
    var checks=0;
    function same(a,b){checks++;if(JSON.stringify(a)!==JSON.stringify(b))throw Error('different '+JSON.stringify([a,b]));}
    function fails(action){try{action();return 'missing';}catch(error){return error.name;}}
    function forward(){return value;const value=3;}
    same(fails(forward),'ReferenceError');
    function earlyClosure(){const get=()=>value;get();const value=3;}
    same(fails(earlyClosure),'ReferenceError');
    function immutable(){const value=3;value=4;}
    same(fails(immutable),'TypeError');
    function iteration(){const reads=[];for(let i=0;i<3;i++){const x=i;reads.push(()=>[i,x]);}return reads.map(f=>f());}
    same(iteration(),[[0,0],[1,1],[2,2]]);
    function initialEnvironment(){for(let i=0,get=()=>i;i<2;i++){if(i===1)return get();}}
    same(initialEnvironment(),0);
    function headTdz(){for(const x of [x]){return x;}}
    same(fails(headTdz),'ReferenceError');
    function destructured(){let sum=0;for(const [a,b] of [[1,2],[3,4]])sum+=a+b;return sum;}
    same(destructured(),10);
    function field(){class C{value=later;}const later=7;return new C().value;}
    same(field(),7);
    function fieldTdz(){class C{value=later;}new C();const later=7;}
    same(fails(fieldTdz),'ReferenceError');
    function shadow(){let x=2;{let x=3;const get=()=>x;same(get(),3);}return x;}
    same(shadow(),2);
    function effects(){let count=0;const object={get v(){count++;return 2;}};for(let i=0;i<3;i++){const x=object.v;if(x)count+=x;}return count;}
    same(effects(),9);
    function dictionary(){const map=new Map();for(const name of ['a','b']){const descriptor=Object.getOwnPropertyDescriptor({a:1,b:2},name);if(!descriptor)continue;let values=map.get(name);if(!values)map.set(name,(values=new Set()));values.add(descriptor.get??descriptor.value);}return [...map].map(([key,value])=>[key,[...value]]);}
    same(dictionary(),[['a',[1]],['b',[2]]]);
    function whileLoops(message){let index=0;while(true){while(index<message.length&&message[index]===' '){index++;}if(index===message.length)return index;index++;}}
    same(whileLoops('  a b '),6);
    function receiver(){const object={v:4,method(){return this.v;}};const fn=object.method;return [object.method(),fails(()=>fn())];}
    same(receiver(),[4,'TypeError']);
    globalThis.__nelyxTemporalFixture=JSON.stringify({checks});
  `;
  function lower(source, optimizeTemporalRefs) {
    const prepared = babel.transformSync(source, {
      configFile: false,
      babelrc: false,
      ast: true,
      code: false,
      plugins: [loopTdz],
    });
    const destructured = babel.transformFromAstSync(prepared.ast, source, {
      configFile: false,
      babelrc: false,
      ast: true,
      code: false,
      plugins: [[presetLoad('@babel/plugin-transform-destructuring'), { useBuiltIns: true }]],
    });
    return babel.transformFromAstSync(destructured.ast, source, {
      configFile: false,
      babelrc: false,
      ast: true,
      code: true,
      compact: true,
      plugins: [[blockScoping, { projectRoot: root, optimizeTemporalRefs }]],
    });
  }
  function rawTransform(source, optimize) {
    return babel.transformSync(source, {
      configFile: false,
      babelrc: false,
      ast: true,
      code: true,
      plugins: optimize
        ? [
            ({ types }) => ({
              visitor: {
                Program: {
                  exit(program, state) {
                    state.file.metadata.nelyxTemporalRefs = prune(program, types, {
                      name: 'check',
                    });
                  },
                },
              },
            }),
          ]
        : [],
    });
  }
  const run = (code) => {
    const context = vm.createContext({});
    vm.runInContext('"use strict";\n' + code, context, { timeout: 1_200_000 });
    return context.__nelyxTemporalFixture;
  };
  const fixtures = [];
  for (const [name, input, transform] of [
    ['raw', raw, rawTransform],
    ['lexical', lexical, lower],
  ]) {
    const before = transform(input, false),
      after = transform(input, true);
    const expected = run(before.code);
    assert.equal(run(after.code), expected, name + ' changed behavior');
    assert.ok(after.metadata.nelyxTemporalRefs.removed > 0, name + ' optimized no checks');
    fixtures.push({ name, before: before.code, after: after.code, expected });
    console.log(
      'TEMPORAL_REFS ' +
        JSON.stringify({
          name,
          ...after.metadata.nelyxTemporalRefs,
          assertions: JSON.parse(expected).checks,
        }),
    );
  }
  const evaluated = rawTransform(
    'function check(x){return x;}function f(){var x=1;eval("x=2");return check(x,"x")+check(x,"x");}',
    true,
  );
  assert.equal(
    evaluated.metadata.nelyxTemporalRefs.removed,
    0,
    'Direct eval lost conservative fallback',
  );
  const replaced = rawTransform(
    'function check(x){return x;}function f(){var x=1;check(x,"x");check=(x)=>x+1;return check(x,"x");}',
    true,
  );
  assert.equal(replaced.metadata.nelyxTemporalRefs.removed, 0, 'A replaced helper was trusted');
  const aliased = rawTransform(
    `var sentinel={};function check(x){if(x===sentinel)throw ReferenceError();return x;}function f(x){check(x,'x');arguments[0]=sentinel;return check(x,'x');}try{f(1);throw Error('missing');}catch(e){if(e.name!=='ReferenceError')throw e;}`,
    true,
  );
  vm.runInNewContext(aliased.code, {}, { timeout: 1_200_000 });
  assert.equal(
    aliased.metadata.nelyxTemporalRefs.removed,
    0,
    'Sloppy parameter aliases were optimized',
  );
  // Apply the real native pipeline to the current common engine, rather than
  // treating synthetic guard removal as evidence of product coverage.
  const transformer = load('../sdk/tooling/metro/src/native-hermes-transformer.cjs');
  const transformOptions = { projectRoot: root, platform: 'windows', dev: false, hot: false };
  const policySource = `function f(message){let index=0;while(true){while(index<message.length&&message[index]===' '){index++;}if(index===message.length)return index;index++;}}globalThis.__nelyxTemporalFixture=String(f('  a b '));`;
  const policyTransform = (customTransformOptions) =>
    transformer.transform({
      src: policySource,
      filename: path.join(root, 'temporal-policy.js'),
      options: { ...transformOptions, customTransformOptions },
    });
  const generate = (result) =>
    babel.transformFromAstSync(result.ast, policySource, {
      configFile: false,
      babelrc: false,
      code: true,
      ast: false,
      compact: true,
    }).code;
  const defaultPolicy = policyTransform(),
    explicitOff = policyTransform({ nelyxTemporalRefOptimization: false }),
    explicitOn = policyTransform({ nelyxTemporalRefOptimization: true });
  assert.equal(
    defaultPolicy.metadata.nelyxTemporalRefs,
    undefined,
    'Product default enabled pruning',
  );
  assert.equal(generate(defaultPolicy), generate(explicitOff), 'Default and explicit off differ');
  assert.ok(explicitOn.metadata.nelyxTemporalRefs.removed > 0);
  for (const result of [defaultPolicy, explicitOff, explicitOn])
    assert.equal(run(generate(result)), '6');
  assert.throws(
    () => policyTransform({ nelyxTemporalRefOptimization: 'true' }),
    /must be a boolean/,
  );
  console.log('TEMPORAL_REFS_POLICY default=off explicit-on=covered compact-output=valid');
  for (const relative of ['framework/widgets/framework.js', 'framework/rendering/object.js']) {
    const file = path.join(root, 'Nelyx/dist', relative),
      source = fs.readFileSync(file, 'utf8');
    const result = transformer.transform({
      src: source,
      filename: file,
      options: {
        ...transformOptions,
        customTransformOptions: { nelyxTemporalRefOptimization: true },
      },
    });
    assert.ok(result.metadata.nelyxTemporalRefs.removed > 0);
    console.log(
      'TEMPORAL_REFS_SOURCE ' +
        JSON.stringify({ file: relative, ...result.metadata.nelyxTemporalRefs }),
    );
  }
  if (process.argv.includes('--native')) {
    const { withTypedHermesFixture } = await import('./typed-hermes-fixture.mjs');
    await withTypedHermesFixture(async (fixture) => {
      for (const { name, before, after, expected } of fixtures)
        for (const [policy, source] of [
          ['control', before],
          ['optimized', after],
        ])
          await fixture.run({
            name: name + '-' + policy,
            source: '"use strict";\n' + source,
            flags: ['-O'],
            driver: `
              if(globalThis.__nelyxTemporalFixture!==${JSON.stringify(expected)})throw Error('Native TDZ behavior differs');
              globalThis.__nelyxFixtureResult=JSON.stringify({fixture:${JSON.stringify(name)},policy:${JSON.stringify(policy)},result:JSON.parse(globalThis.__nelyxTemporalFixture)});
            `,
          });
    });
  }
  console.log(
    'Temporal refs: behavior, TDZ, writes, closure/eval fallback, loops, branches, exceptions, receiver and native pipeline PASS.',
  );
}
