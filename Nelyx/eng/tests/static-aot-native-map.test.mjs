// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {readNativeFunctionMap} from '../../sdk/tooling/cli/src/native-function-map.mjs';
const timeout=1_200_000;
test('native function coordinates retain UTF-16 source positions across UTF-8 compiler columns',{timeout},async()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'nelyx-native-map-'));
  try{
    const source=path.join(folder,'source.js'),c=path.join(folder,'source.c');
    fs.writeFileSync(source,'// 한글 😀\nconst é="가"; function target(){return 7;}\n');
    const text=fs.readFileSync(source,'utf8'),line=text.split('\n')[1],offset=line.indexOf('function'),column=Buffer.byteLength(line.slice(0,offset))+1;
    const write=point=>fs.writeFileSync(c,'static SHLegacyValue _0_global(SHRuntime *shr);\n// '+source+':1:1\nstatic SHLegacyValue _0_global(SHRuntime *shr) {\n}\n// '+source+':2:'+point+'\nstatic SHLegacyValue _1_target(SHRuntime *shr) {\n}\n');
    write(column);const map=await readNativeFunctionMap(c,source,'nelyx_app');assert.equal(map.functions.length,2);assert.equal(map.functions[1].position.offset,text.indexOf('function'));assert.equal(map.functions[1].position.column,offset+1);
    write(Buffer.byteLength(line)+10);await assert.rejects(readNativeFunctionMap(c,source,'nelyx_app'),/column outside/);
  }finally{assert.equal(path.dirname(folder),fs.realpathSync(os.tmpdir()));assert(!fs.lstatSync(folder).isSymbolicLink());fs.rmSync(folder,{recursive:true,force:true});}
});
test('the actual pinned C backend provides source owners for dynamic class/closure/generator bodies',{timeout,skip:!process.env.NELYX_STATIC_HERMES_INPUTS},async()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'nelyx-native-map-'));
  try{
    const source=path.join(folder,'source.js'),c=path.join(folder,'source.c');
    fs.writeFileSync(source,'const token="한글😀"; function dynamic(x){return x.value;} class C{value=7; read(){return dynamic(this);}} function* sequence(){yield new C();} globalThis.nativeFactory=()=>({C,sequence,token});');
    const compiler=path.join(process.env.NELYX_STATIC_HERMES_INPUTS,'build/bin/shermes.exe');
    const result=spawnSync(compiler,['-O0','-emit-c','-exported-unit=nelyx_app','-o',c,source],{encoding:'utf8',windowsHide:true,timeout,maxBuffer:1024**2});assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);
    const map=await readNativeFunctionMap(c,source,'nelyx_app');assert(map.functions.some(fn=>fn.symbol.includes('_dynamic')));assert(map.functions.some(fn=>fn.symbol.includes('_sequence')));assert(map.functions.some(fn=>fn.position?.offset===fs.readFileSync(source,'utf8').indexOf('function dynamic')));
  }finally{assert.equal(path.dirname(folder),fs.realpathSync(os.tmpdir()));assert(!fs.lstatSync(folder).isSymbolicLink());fs.rmSync(folder,{recursive:true,force:true});}
});
