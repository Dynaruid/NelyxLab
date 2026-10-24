// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';import {readNativePcMap,nativeImageDebugIdentity,symbolizeNativePc} from '../../sdk/tooling/cli/src/native-pc-map.mjs';import {windowsCompilerEnvironment} from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
import {verifyWindowsStaticHermes} from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';import {compileHermesImage} from '../../sdk/tooling/cli/src/windows-hermes-image.mjs';import {windowsHermesPolicy} from '../../sdk/tooling/cli/src/windows-hermes-policy.mjs';import {nativeCohort} from '../../sdk/dist/runtime/cohorts.js';
const timeout=1_200_000;
test('actual PE/PDB function ranges resolve executable bytes and reject a foreign debug identity',{timeout,skip:process.platform!=='win32'},async()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'nelyx-native-pc-')),env=windowsCompilerEnvironment();
  try{
    const run=(file,args)=>{const r=spawnSync(file,args,{cwd:folder,env,encoding:'utf8',windowsHide:true,timeout});assert.ifError(r.error);assert.equal(r.status,0,r.stdout+r.stderr);};
    fs.writeFileSync(path.join(folder,'nelyx_app.c'),'__declspec(noinline) static int _1_native(int x){return x+1;} __declspec(dllexport) int entry(int x){return _1_native(x);}');
    run(path.join(process.env.ProgramFiles,'LLVM/bin/clang.exe'),['-c','nelyx_app.c','-o','nelyx_app.obj','-O3','-gcodeview','-gline-tables-only','-fms-runtime-lib=dll']);
    run('link.exe',['/DLL','/NOENTRY','/NOLOGO','/NODEFAULTLIB','/INCREMENTAL:NO','/OPT:REF','/OPT:ICF','/DEBUG:FULL','/OUT:probe.dll','/PDB:probe.pdb','nelyx_app.obj']);
    const file=path.join(folder,'probe.dll'),pdb=path.join(folder,'probe.pdb'),units=[{unit:'nelyx_app',nativeFunctions:{functions:[{symbol:'_1_native',position:{offset:0,line:1,column:1}}]}}],map=await readNativePcMap(file,pdb,units,{env});
    assert.equal(map.functions.length,1);const fn=map.functions[0],identity=nativeImageDebugIdentity(file),section=identity.sections.find(section=>fn.rva>=section.rva&&fn.rva<section.rva+section.size),bytes=fs.readFileSync(file),offset=section.raw+fn.rva-section.rva;
    assert.equal(bytes.subarray(offset,offset+fn.size).toString('hex'),'8d4101c3');assert.equal(symbolizeNativePc(map,fn.rva+1)[0].symbol,'_1_native');assert.equal(symbolizeNativePc(map,fn.rva+fn.size).length,0);
    const marker=bytes.indexOf(Buffer.from('RSDS'));assert(marker>=0);bytes[marker+4]^=1;fs.writeFileSync(file,bytes);await assert.rejects(readNativePcMap(file,pdb,units,{env}),/debug identity differs/);
  }finally{assert.equal(path.dirname(folder),fs.realpathSync(os.tmpdir()));assert(!fs.lstatSync(folder).isSymbolicLink());fs.rmSync(folder,{recursive:true,force:true});}
});
test('a captured PC at an actual native exception path resolves its generated source function',{timeout,skip:!process.env.NELYX_STATIC_HERMES_INPUTS},async t=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'nelyx-native-pc-error-')),env=windowsCompilerEnvironment();
  try{
    const checked=verifyWindowsStaticHermes(process.env.NELYX_STATIC_HERMES_INPUTS),source=path.join(folder,'root.js'),text="function target(){hostCapture();throw Error('native diagnostic sentinel');}\nglobalThis.errorTarget=target;";fs.writeFileSync(source,text);
    const build=await compileHermesImage({checked,env,units:[{name:'nelyx_app',source,flags:windowsHermesPolicy('optimized',nativeCohort('windows')).flags,evidence:true}],output:path.join(folder,'NelyxApp.aot.dll'),signal:t.signal});
    assert(build.nativePcMap.functions.some(fn=>fn.symbol.endsWith('_target')));
    const supplier=path.join(process.env.USERPROFILE,'.nuget/packages/microsoft.javascript.hermes/0.0.0-2604.21001-94aa5e1d'),include=path.join(supplier,'build/native/include');fs.copyFileSync(path.join(checked.directory,'build/API/hermes_shared/hermes.dll'),path.join(folder,'hermes.dll'));fs.copyFileSync(path.join(supplier,'build/native/win32/x64/hermes-icu.dll'),path.join(folder,'hermes-icu.dll'));
    const run=(file,args)=>{const r=spawnSync(file,args,{cwd:folder,env,encoding:'utf8',windowsHide:true,timeout,maxBuffer:2*1024**2});assert.ifError(r.error);assert.equal(r.status,0,r.stdout+r.stderr);return r.stdout;};
    const exe=path.join(folder,'error.exe');run('cl.exe',['/nologo','/std:c++20','/EHsc','/MD','/O2','/DNDEBUG','/I'+include,'/I'+path.join(include,'node-api'),'/Fe'+exe,'/Fo'+path.join(folder,'error.obj'),path.join(import.meta.dirname,'native-pc-error.cpp'),'/link',path.join(checked.directory,'build/API/hermes_shared/hermes.lib')]);
    const output=run(exe,[]);assert.match(output,/native diagnostic sentinel/);const hits=[...output.matchAll(/NATIVE_PC_RVA (\d+)/g)].flatMap(match=>symbolizeNativePc(build.nativePcMap,Number(match[1])));assert(hits.some(fn=>fn.symbol.endsWith('_target')&&fn.position.offset===0));
  }finally{assert.equal(path.dirname(folder),fs.realpathSync(os.tmpdir()));assert(!fs.lstatSync(folder).isSymbolicLink());fs.rmSync(folder,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});
