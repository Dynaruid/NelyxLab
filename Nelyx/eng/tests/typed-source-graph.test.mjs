// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {inspectSourceGraph} from '../../sdk/tooling/static-aot/src/source-graph.mjs';
const timeout=1_200_000;
function fixture(run){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'nelyx-typed-graph-')),owner=path.join(root,'node_modules/@nelyx/fixture');
  const write=(file,body)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body);};
  try{
    write(path.join(owner,'package.json'),JSON.stringify({name:'@nelyx/fixture',version:'1.0.0',exports:{'./a':{types:'./dist/a.d.ts',default:'./dist/a.js'}}}));
    const source="import {b} from './b.ts'; import {type B} from './types.ts'; export class A {value():number{return b();}} export function a():number{return 1;} export const single=new A(); export type Alias=B;";
    write(path.join(owner,'src/a.ts'),source);write(path.join(owner,'src/b.ts'),"import {a} from './a.ts'; export function b():number{return a();}");
    write(path.join(owner,'src/types.ts'),"import type {Alias} from './a.ts'; export interface B {value?:Alias}");
    write(path.join(owner,'dist/a.js'),'export class A{}');write(path.join(owner,'dist/a.d.ts'),'export declare class A{}');
    write(path.join(owner,'dist/a.js.map'),JSON.stringify({version:3,sources:['../src/a.ts'],sourcesContent:[source],names:[],mappings:''}));
    write(path.join(owner,'dist/b.js'),'export function b(){return 1;}');write(path.join(owner,'dist/b.js.map'),JSON.stringify({version:3,sources:['../src/b.ts'],sourcesContent:[fs.readFileSync(path.join(owner,'src/b.ts'),'utf8')],names:[],mappings:''}));
    const entry=path.join(root,'entry.ts');write(entry,"import {A,single} from '@nelyx/fixture/a'; export const same=single instanceof A; const target='x'; import(target); new Proxy(single,{});");
    return run({root,owner,entry,write,inspect:()=>inspectSourceGraph({entry,applicationRoot:root,packageRoots:[owner]})});
  }finally{assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(os.tmpdir()));assert(path.basename(root).startsWith('nelyx-typed-graph-'));assert(!fs.lstatSync(root).isSymbolicLink());fs.rmSync(root,{recursive:true,force:true});}
}
test('installed source bodies, checker symbols, type edges, runtime SCC and dynamic exclusions have stable owners',{timeout},()=>fixture(f=>{
  const graph=f.inspect(),a=graph.modules.find(module=>module.id==='@nelyx/fixture/src/a.ts');
  assert.equal(graph.modules.length,4);assert.equal(a.runtime,'@nelyx/fixture/dist/a.js');assert.match(a.sourceSha256,/^[a-f0-9]{64}$/);
  assert(a.symbols.some(symbol=>symbol.name==='A'&&symbol.kind==='ClassDeclaration'));assert(a.symbols.some(symbol=>symbol.name==='single'));
  assert(a.imports.some(edge=>edge.specifier==='./types.ts'&&edge.kind==='type'));assert(!a.imports.some(edge=>edge.specifier==='./types.ts'&&edge.kind==='runtime'));
  assert(graph.runtimeComponents.some(values=>values.length===2&&values.includes('@nelyx/fixture/src/b.ts')));
  assert(graph.boundaries.some(value=>value.kind==='computed-module'));assert(graph.boundaries.some(value=>value.kind==='proxy'));
  assert.equal(graph.diagnostics.filter(value=>value.category==='Error').length,0,JSON.stringify(graph.diagnostics));
  assert.equal(graph.sha256,f.inspect().sha256,'No timestamps, traversal order or checker-internal ids enter graph identity');
}));
test('a declaration or stale source map cannot stand in for an installed implementation body',{timeout},()=>fixture(f=>{
  f.write(path.join(f.owner,'src/a.ts'),'export class A{}');assert.throws(()=>f.inspect(),/source differs from runtime map/);
}));
test('duplicate package owners and unexported private module routes fail admission',{timeout},()=>fixture(f=>{
  assert.throws(()=>inspectSourceGraph({entry:f.entry,applicationRoot:f.root,packageRoots:[f.owner,f.owner]}),/Duplicate/);
  f.write(f.entry,"import {a} from '@nelyx/fixture/private'; a();");assert.throws(()=>f.inspect(),/not a public package export/);
}));
test('literal require bodies enter the source and SCC closure even when the checker only knows a declared require',{timeout},()=>fixture(f=>{
  f.write(path.join(f.root,'late.ts'),"import './entry.ts'; export const later=3;");
  f.write(f.entry,"declare function require(name:string):unknown; export const late=require('./late.ts');");
  const graph=f.inspect();assert.equal(graph.modules.length,2);assert(graph.modules.find(module=>module.id==='application/entry.ts').imports.some(edge=>edge.kind==='dynamic'&&edge.target==='application/late.ts'));
  assert(graph.runtimeComponents.some(component=>component.length===2));
}));
test('relative dist imports recover the same supplied TS body instead of creating a declaration identity',{timeout},()=>fixture(f=>{
  f.write(f.entry,"import {A} from '@nelyx/fixture/a'; import {A as Relative} from './node_modules/@nelyx/fixture/dist/a'; export const same:A=new Relative(); export const value=new Relative().value();");
  const graph=f.inspect(),entry=graph.modules.find(module=>module.id==='application/entry.ts');
  assert.equal(graph.diagnostics.filter(item=>item.category==='Error').length,0,JSON.stringify(graph.diagnostics));
  assert.equal(entry.imports.length,2);assert(entry.imports.every(edge=>edge.target==='@nelyx/fixture/src/a.ts'&&edge.route==='emitted'));
  assert(!graph.boundaries.some(item=>item.kind==='multiple-evaluation-routes'));
}));
