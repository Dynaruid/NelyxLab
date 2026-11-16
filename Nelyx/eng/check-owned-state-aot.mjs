// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { build } from 'esbuild';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';
import {
  automaticPartition,
  verifyTypePolicy,
} from '../sdk/tooling/static-aot/src/type-policy.mjs';
import { inspectOwnedFactory } from '../sdk/tooling/static-aot/src/owned-factory.mjs';
import { withTypedHermesFixture } from './typed-hermes-fixture.mjs';

const root = path.resolve(import.meta.dirname, '../..');
if (!process.argv.includes('--child')) {
  await execute(
    'pwsh.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "& node '" + import.meta.filename.replaceAll("'", "''") + "' --child",
    ],
    { cwd: root, timeout: 1_200_000 },
  );
} else {
  const sourceFile = path.join(root, 'Nelyx/src/runtime/depth-queue.ts'),
    source = fs.readFileSync(sourceFile, 'utf8'),
    partition = automaticPartition({
      entry: sourceFile,
      applicationRoot: root,
      packageRoots: [path.join(root, 'Nelyx')],
    });
  verifyTypePolicy(partition.typePolicy);
  const queueModule = partition.typePolicy.decisions.filter((item) =>
    item.module.endsWith('/depth-queue.ts'),
  );
  assert.equal(queueModule.filter((item) => item.reason === 'checked-owned-state-ir').length, 9);
  assert.equal(partition.bindings.length, 1, 'Private helpers escaped as global ABIs');
  assert.equal(partition.callables.length, 9);
  const prefix = '/** @nelyxTypedFactory owned-state-v1 */\nfunction factory(input:any){';
  const invalid = [
    'let value:number=input.value;return value;',
    'let value:number=0;value=input.value;return value;',
    'let value:number=0;(value)=input.value;return value;',
    'function get():number{return input.value;}return {get};',
    'const value=input as {rank:number};return value;',
    'class Value {rank:number=0;}return new Value();',
    'return this;',
    'return external;',
    'let flag:boolean=true;flag+=false;return flag;',
    'let flag:boolean=true;flag++;return flag;',
    'let flag:boolean=true;(flag)++;return flag;',
    'let value:number=0;[value]=input;return value;',
    'let value:number=0;for(value of input){}return value;',
    'function next(){}next=input;return {next};',
    'return factory;',
    'function result():void{return input();}return {result};',
    'let kernel0:any=input;return kernel0;',
  ];
  for (const body of invalid) {
    const file = ts.createSourceFile(
        'invalid.ts',
        prefix + body + '}',
        ts.ScriptTarget.Latest,
        true,
      ),
      host = ts.createCompilerHost({ noLib: true });
    host.getSourceFile = (name) => (name === 'invalid.ts' ? file : undefined);
    host.fileExists = (name) => name === 'invalid.ts';
    host.readFile = () => '';
    const program = ts.createProgram(['invalid.ts'], { noLib: true }, host);
    assert.throws(
      () => inspectOwnedFactory(file, file.statements[0], program.getTypeChecker()),
      (error) => error.code === 'NELYX_TYPED_UNSUPPORTED',
      'Unsafe factory admitted: ' + body,
    );
  }
  {
    const file = ts.createSourceFile(
        'reserved.ts',
        prefix.replace('input:any', 'receiver:any') + 'return receiver;}',
        ts.ScriptTarget.Latest,
        true,
      ),
      host = ts.createCompilerHost({ noLib: true });
    host.getSourceFile = (name) => (name === 'reserved.ts' ? file : undefined);
    const program = ts.createProgram(['reserved.ts'], { noLib: true }, host);
    assert.throws(
      () => inspectOwnedFactory(file, file.statements[0], program.getTypeChecker()),
      (error) => error.code === 'NELYX_TYPED_UNSUPPORTED',
      'Native receiver parameter collision admitted',
    );
  }
  const driver = `
import {DepthQueue} from './Nelyx/src/runtime/depth-queue.ts';
(function(){
  let assertions=0;
  function check(condition,message){assertions++;if(!condition)throw Error(message);}
  function item(id,depth){return {id,depth,_buildQueueIndex:-1,_buildQueueDepth:-1,_buildQueueOrder:0};}
  function drain(queue){const result=[];while(queue.size)result.push(queue.pop().id);return result.join(',');}
  const queue=new DepthQueue(),a=item('a',2),b=item('b',0),c=item('c',2),d=item('d',1);
  for(const value of [a,b,c,d])queue.schedule(value);
  queue.schedule(a);
  check(queue.size===4,'duplicate admission');
  check(drain(queue)==='b,d,a,c','depth and stable equal-depth order');
  check([a,b,c,d].every(value=>value._buildQueueIndex===-1),'retired membership');
  for(const value of [a,b,c,d])queue.schedule(value);
  a.depth=-1;queue.schedule(a);
  c.depth=4;queue.schedule(c);
  queue.remove(d);
  check(drain(queue)==='a,b,c','depth changes and middle removal');
  check(queue.pop()===undefined,'empty pop');
  const larger=Array.from({length:24},(_,index)=>item('row'+index,(index*7)%5));
  for(const value of larger)queue.schedule(value);
  check(drain(queue)===larger.slice().sort((a,b)=>a.depth-b.depth).map(value=>value.id).join(','),'complete heap traversal');
  const other=new DepthQueue();queue.schedule(a);
  let foreign=false;
  try{other.schedule(a);}catch(error){foreign=error.message.includes('another queue');}
  check(foreign&&queue.size===1&&other.size===0,'foreign queue admission');
  foreign=false;
  try{other.remove(a);}catch(error){foreign=error.message.includes('not queued here');}
  check(foreign&&queue.pop()===a,'foreign removal damaged owner');
  queue.schedule(a);queue.schedule(b);
  let calls=0;
  const unchanged=queue.every(value=>{calls++;return value===a||value===b;});
  check(unchanged&&calls===2,'validation visitation');
  const changed=queue.every(value=>{queue.remove(value);return true;});
  check(changed===false&&queue.size===1,'validation reentrancy');
  check(drain(queue)==='b','validation removed wrong record');
  queue.schedule(a);
  let thrown=false;
  const failure={name:'sentinel'};
  try{queue.every(()=>{throw failure;});}catch(error){thrown=error===failure;}
  check(thrown&&queue.pop()===a,'callback exception or queue lifetime');
  const observations=[];
  let stored=-1;
  const dynamic={id:'dynamic',_buildQueueDepth:-1,_buildQueueOrder:0,
    get depth(){observations.push('depth');return 3;},
    get _buildQueueIndex(){observations.push('index');return stored;},
    set _buildQueueIndex(value){observations.push('store:'+value);stored=value;}};
  queue.schedule(dynamic);queue.schedule(dynamic);queue.remove(dynamic);
  check(observations.join(',')==='index,depth,store:0,index,depth,index,store:-1','record observation order');
  const coercion=[];
  const unusual=item('unusual',0);
  unusual._buildQueueIndex={valueOf(){coercion.push('index');return -1;}};
  queue.schedule(unusual);
  check(coercion.join(',')==='index,index'&&queue.pop()===unusual,'dynamic index coercion');
  for(const index of ['0',0n,{valueOf(){return 0;},toString(){return '0';}}]){
    const boxed=item('boxed',0);queue.schedule(boxed);boxed._buildQueueIndex=index;
    queue.schedule(boxed);queue.remove(boxed);
    check(queue.size===0&&boxed._buildQueueIndex===-1,'dynamic array property index');
  }
  queue.schedule(a);
  check(queue.every(function(value){'use strict';check(this===undefined,'predicate receiver');queue.schedule(value);return true;}),'duplicate admission changed validation revision');
  queue.pop();
  const failureRecord=item('failure',0);
  Object.defineProperty(failureRecord,'depth',{get(){throw failure;}});
  thrown=false;
  try{queue.schedule(failureRecord);}catch(error){thrown=error===failure;}
  check(thrown&&queue.size===0&&failureRecord._buildQueueIndex===-1,'getter exception mutated queue');
  class HookQueue extends DepthQueue {
    remove(value){check(this instanceof HookQueue,'virtual remove receiver');this.removed=value;super.remove(value);}
  }
  const hooks=new HookQueue(),hook=item('hook',0);hooks.schedule(hook);
  check(hooks.pop()===hook&&hooks.removed===hook,'public remove override');
  const independent=new DepthQueue();
  const retained=item('한글 😀',0);independent.schedule(retained);
  globalThis.__nelyxFixtureGc();
  check(independent.pop()===retained,'queued reference across GC');
  check(queue.size===0,'independent storage lifetime');
  globalThis.__nelyxFixtureResult=JSON.stringify({assertions,order:'stable',observations:observations.length,gcCrossings:1});
})();
`;
  const binding = partition.bindings[0],
    syntax = ts.createSourceFile(sourceFile, source, ts.ScriptTarget.Latest, true),
    factory = syntax.statements.find(
      (node) => ts.isFunctionDeclaration(node) && node.name.text === binding.name,
    ),
    adapted =
      source.slice(0, factory.body.getStart(syntax)) +
      '{' +
      binding.adapter +
      '}' +
      source.slice(factory.body.end);
  const bundle = async (typed) => {
    const result = await build({
      stdin: {
        contents: driver,
        sourcefile: 'owned-queue-driver.ts',
        loader: 'ts',
        resolveDir: root,
      },
      bundle: true,
      write: false,
      format: 'iife',
      target: 'es2018',
      plugins: [
        {
          name: 'owned-source-adapter',
          setup(build) {
            build.onLoad({ filter: /[\\/]runtime[\\/]depth-queue\.ts$/ }, () => ({
              contents: typed ? adapted : source,
              loader: 'ts',
            }));
          },
        },
      ],
      logLevel: 'silent',
    });
    return result.outputFiles[0].text;
  };
  const dynamicDriver = await bundle(false),
    typedDriver = await bundle(true);
  await withTypedHermesFixture(async ({ run }) => {
    await run({ name: 'dynamic-queue', source: 'void 0;', driver: dynamicDriver, flags: ['-O'] });
    await run({
      name: 'typed-queue',
      source: partition.source,
      driver: typedDriver,
      flags: ['-typed', '-parse-ts', '-O'],
      typed: true,
      evidence: true,
      inspect({ ir, build }) {
        // Numeric private bookkeeping is native. Foreign record properties and
        // all array indexing remain dynamic; no nominal record cast is emitted.
        assert.ok(ir.includes('FAddInst') && ir.includes('LoadPropertyInst'));
        const native = build.units.find((unit) => unit.unit === 'nelyx_typed').nativeFunctions
            .functions,
          kernels = native.filter((fn) => /^_\d+_kernel\d+$/.test(fn.symbol));
        assert.equal(kernels.length, partition.callables.length);
        for (const callable of partition.callables) {
          const fn = kernels.find((item) => item.symbol.endsWith('_' + callable.kernel)),
            range = fn?.sourceRange;
          assert.ok(
            range &&
              range.start.offset >= callable.inputRange.offset &&
              range.end.offset <= callable.inputRange.end,
            'Source closure lacks exact native range: ' + callable.id,
          );
        }
      },
    });
    await assert.rejects(
      run({
        name: 'exception-retirement',
        source: 'void 0;',
        driver: 'throw new Error("expected fixture exception");',
        flags: ['-O'],
      }),
      (error) =>
        error.message === 'Runner command exited 1' &&
        error.output.includes('expected fixture exception'),
      'Native exception did not retire before its runtime/image',
    );
  });
  console.log(
    'OWNED_STATE_AOT ' +
      JSON.stringify({
        rejected: invalid.length + 1,
        typedCallables: partition.callables.length,
        publicAbis: partition.bindings.length,
        nativeExceptionRetirement: 'PASS',
      }),
  );
}
