// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import path from 'node:path';
import { transform } from 'esbuild';
import { withTypedHermesFixture } from './typed-hermes-fixture.mjs';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';

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
  // This is a compiler/ABI qualification, not a product optimization. A checked
  // object cast alone does not establish the nominal class of a dynamic value.
  // Only this closure creates payloads, and no payload or constructor escapes.
  const source = `
(function(){
  class Entry {
    rank:number;
    value:any;
    parent:Entry|null;
    closed:boolean;
    constructor(rank:number,value:any,parent:Entry|null){
      this.rank=rank;this.value=value;this.parent=parent;this.closed=false;
    }
  }
  const slots=new WeakMap();
  const others=new WeakMap();
  // Capture the operations before application code can replace the prototype.
  const read=Function.prototype.call.bind(WeakMap.prototype.get,slots);
  const write=Function.prototype.call.bind(WeakMap.prototype.set,slots);
  const writeOther=Function.prototype.call.bind(WeakMap.prototype.set,others);
  function resolve(token:any):Entry {
    const value=read(token);
    if(value===undefined)throw new TypeError('foreign record');
    const entry:Entry=value;
    if(entry.closed)throw new TypeError('retired record');
    return entry;
  }
  function create(rank:any,value:any,parent:any):any {
    if(typeof rank!=='number')throw new TypeError('number required');
    let previous:Entry|null=null;
    if(parent!==undefined)previous=resolve(parent);
    const token={};
    write(token,new Entry(rank,value,previous));
    return token;
  }
  function bump(token:any,delta:any):number {
    'noinline';
    if(typeof delta!=='number')throw new TypeError('number required');
    const amount:number=delta;
    const entry:Entry=resolve(token);
    entry.rank+=amount;
    return entry.rank;
  }
  function sum(token:any):number {
    'noinline';
    let total:number=0;
    let entry:Entry|null=resolve(token);
    while(entry!==null){total+=entry.rank;entry=entry.parent;}
    return total;
  }
  function value(token:any):any{return resolve(token).value;}
  function retire(token:any):void {
    const entry:Entry=resolve(token);
    entry.closed=true;entry.value=undefined;entry.parent=null;
  }
  function other():any {const token={};writeOther(token,{});return token;}
  globalThis['__records']={create,bump,sum,value,retire,other};
})();
`;
  const driver = `
(function(){
  const api=globalThis.__records;
  let assertions=0;
  function check(value,message){assertions++;if(!value)throw Error(message);}
  function rejected(action,message){
    let caught=false;
    try{action();}catch(error){caught=error instanceof TypeError;}
    check(caught,message);
  }
  const parent=api.create(7,{name:'한글 😀'},undefined);
  const child=api.create(3,{parent},parent);
  check(api.sum(child)===10,'parent chain');
  check(api.bump(child,2)===5,'typed numeric update');
  check(api.sum(child)===12,'typed numeric loop');
  check(api.value(parent).name==='한글 😀','boxed reference');
  const untouched=api.create(-0,null,undefined);
  check(Object.is(api.sum(untouched),0),'sum signed zero');
  check(Object.is(api.bump(untouched,-0),-0),'update signed zero');
  check(Number.isNaN(api.sum(api.create(NaN,null,undefined))),'NaN');
  check(api.sum(api.create(Infinity,null,undefined))===Infinity,'Infinity');
  let observations=0;
  const proxy=new Proxy({}, {get(){observations++;throw Error('get');},getPrototypeOf(){observations++;throw Error('prototype');}});
  for(const fake of [{},Object.create(null),Object.create(Object.getPrototypeOf(child)),proxy,api.other(),null,undefined,0,'x',Symbol('x'),()=>{}]){
    rejected(()=>api.sum(fake),'foreign token before fixed slot access');
    rejected(()=>api.bump(fake,1),'foreign mutation before fixed slot access');
    if(fake!==undefined)rejected(()=>api.create(1,null,fake),'foreign parent before fixed slot access');
  }
  check(observations===0,'foreign token observed a getter/proxy');
  const coercible={valueOf(){observations++;return 2;}};
  rejected(()=>api.bump(child,coercible),'coercion must not enter typed arithmetic');
  rejected(()=>api.create(coercible,null,undefined),'coercion must not enter typed storage');
  check(observations===0,'numeric guard coerced');
  check(api.sum(child)===12,'failed operations mutated record');
  check(Object.keys(child).length===0,'payload escaped on token');
  const get=WeakMap.prototype.get,set=WeakMap.prototype.set;
  try{
    WeakMap.prototype.get=function(){return {rank:100,value:'fake',parent:null,closed:false};};
    WeakMap.prototype.set=function(){throw Error('replaced setter');};
    check(api.sum(child)===12,'prototype replacement forged payload');
    check(api.sum(api.create(2,null,child))===14,'captured setter');
    rejected(()=>api.sum({}),'prototype replacement admitted fake');
  }finally{WeakMap.prototype.get=get;WeakMap.prototype.set=set;}
  // The weak key must not be the only owner of an ancestor payload. Keep a
  // child alive while dropping the parent key and crossing actual VM GC.
  let ancestor=api.create(7,null,undefined);
  const leaf=api.create(1,null,ancestor);
  ancestor=null;
  globalThis.__nelyxFixtureGc();
  check(api.sum(leaf)===8,'ancestor payload lost across GC');
  check(api.value(child).parent!==undefined,'boxed references lost across GC');
  api.retire(child);
  globalThis.__nelyxFixtureGc();
  rejected(()=>api.sum(child),'retired read');
  rejected(()=>api.bump(child,1),'retired mutation');
  rejected(()=>api.retire(child),'retired twice');
  check(api.sum(leaf)===8,'retirement damaged independent child');
  globalThis.__nelyxFixtureResult=JSON.stringify({assertions,foreignObservations:observations,gcCrossings:2});
})();
`;
  await withTypedHermesFixture(async ({ run }) => {
    const dynamic = (await transform(source, { loader: 'ts', target: 'es2022' })).code;
    await run({ name: 'dynamic-records', source: dynamic, driver, flags: ['-O'] });
    await run({
      name: 'typed-records',
      source,
      driver,
      flags: ['-typed', '-parse-flow', '-O'],
      typed: true,
      inspect({ ir }) {
        assert.ok(ir.includes('PrLoadInst'), 'No typed fixed-slot loads');
        assert.ok(ir.includes('PrStoreInst'), 'No typed fixed-slot stores');
        assert.ok(/FAddInst \(:number\)/.test(ir), 'No typed numeric arithmetic');
      },
    });
  });
}
