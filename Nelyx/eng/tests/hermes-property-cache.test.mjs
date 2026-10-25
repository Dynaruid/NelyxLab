// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {verifyNativeHermes} from '../../sdk/tooling/cli/src/windows-native-hermes-toolchain.mjs';
import {windowsCompilerEnvironment} from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
import {windowsHermesPolicy} from '../../sdk/tooling/cli/src/windows-hermes-policy.mjs';
import {nativeCohort} from '../../sdk/dist/runtime/cohorts.js';
const timeout=1_200_000,directory=path.resolve(process.env.NELYX_NATIVE_HERMES_INPUTS??'.nelyx/windows-hermes');
test('direct bytecode and native units preserve prototype reads, getter receivers, mutation, failures and weak cache roots',{timeout,skip:process.platform!=='win32'||!fs.existsSync(path.join(directory,'native-hermes.json'))},()=>{
  const checked=verifyNativeHermes(directory),env={...windowsCompilerEnvironment(),NELYX_HERMES_PROPERTY_BENCH:process.env.NELYX_HERMES_PROPERTY_BENCH==='1'?'1':'0'},folder=fs.mkdtempSync(path.join(os.tmpdir(),'nelyx-property-cache-'));
  const run=(file,args)=>{const result=spawnSync(file,args,{cwd:folder,env,encoding:'utf8',windowsHide:true,timeout,maxBuffer:4*1024**2});assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);return result.stdout+result.stderr;};
  try{
    const input=path.join(import.meta.dirname,'hermes-property-cache.js'),gcInput=path.join(import.meta.dirname,'hermes-property-cache-gc.js'),include=path.join(directory,'source/include'),config=path.join(directory,'build/lib/config'),library=path.join(directory,'build/lib/hermesvm.lib'),flags=windowsHermesPolicy('optimized',nativeCohort('windows')).flags;
    const bytecode=path.join(folder,'property-cache.hbc'),c=path.join(folder,'property-cache.c'),object=path.join(folder,'property-cache.obj'),gcBytecode=path.join(folder,'property-cache-gc.hbc'),gcC=path.join(folder,'property-cache-gc.c'),gcObject=path.join(folder,'property-cache-gc.obj'),image=path.join(folder,'PropertyCache.dll'),executable=path.join(folder,'property-cache.exe');
    run(path.join(directory,'build/bin/hermesc.exe'),[...flags,'-emit-binary','-out',bytecode,input]);
    run(path.join(directory,'build/bin/shermes.exe'),[...flags,'-emit-c','-exported-unit=property_cache','-o',c,input]);
    run(path.join(process.env.ProgramFiles,'LLVM/bin/clang.exe'),['-c',c,'-o',object,'-O3','-DNDEBUG','-DSTATIC_HERMES','-fno-strict-aliasing','-fno-strict-overflow','-fms-runtime-lib=dll','-I'+include,'-I'+config]);
    run(path.join(directory,'build/bin/hermesc.exe'),[...flags,'-emit-binary','-out',gcBytecode,gcInput]);
    run(path.join(directory,'build/bin/shermes.exe'),[...flags,'-emit-c','-exported-unit=property_cache_gc','-o',gcC,gcInput]);
    run(path.join(process.env.ProgramFiles,'LLVM/bin/clang.exe'),['-c',gcC,'-o',gcObject,'-O3','-DNDEBUG','-DSTATIC_HERMES','-fno-strict-aliasing','-fno-strict-overflow','-fms-runtime-lib=dll','-I'+include,'-I'+config]);
    run('link.exe',['/DLL','/NOLOGO','/OUT:'+image,object,gcObject,library,'/EXPORT:sh_export_property_cache','/EXPORT:sh_export_property_cache_gc']);
    fs.copyFileSync(path.join(directory,'build/lib/hermesvm.dll'),path.join(folder,'hermesvm.dll'));
    run(path.join(process.env.ProgramFiles,'LLVM/bin/clang-cl.exe'),['/nologo','/std:c++20','/EHsc','/MD','/O2','/DNDEBUG','/I'+include,'/I'+config,'/I'+path.join(directory,'source/API'),'/I'+path.join(directory,'source/public'),'/I'+path.join(directory,'source/API/jsi'),'/Fe'+executable,'/Fo'+path.join(folder,'host.obj'),path.join(import.meta.dirname,'hermes-property-cache.cpp'),'/link',library,path.join(directory,'build/jsi/jsi.lib')]);
    for(const [mode,product,gcProduct]of [['bytecode',bytecode,gcBytecode],['static-aot',image,image]]){const output=run(executable,[mode,product,gcProduct]);assert.match(output,/HERMES_PROPERTY_CACHE /);assert.match(output,/HERMES_PROPERTY_CACHE_GC /);console.log(output.trim());}
    console.log('PROPERTY_CACHE_TOOLCHAIN '+checked.sha256);
  }finally{assert.equal(path.dirname(fs.realpathSync(folder)),fs.realpathSync(os.tmpdir()));assert(path.basename(folder).startsWith('nelyx-property-cache-'));assert(!fs.lstatSync(folder).isSymbolicLink());fs.rmSync(folder,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});
