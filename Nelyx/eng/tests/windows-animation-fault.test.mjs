// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {windowsCompilerEnvironment} from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
import {symbolizeWindowsFault} from './windows-fault-results.mjs';
const timeout=1_200_000;
test('native fatal evidence preserves the access violation and resolves its actual exception stack',{timeout,skip:process.platform!=='win32'},()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nelyx-windows-animation-fault-')),env=windowsCompilerEnvironment();
 try{
  const executable=path.join(directory,'probe.exe');
  const built=spawnSync('cl.exe',['/nologo','/std:c++20','/EHsc','/MD','/O2','/Zi','/DNOMINMAX','/Fe:'+executable,'/Fo:'+path.join(directory,'probe.obj'),'/Fd:'+path.join(directory,'compile.pdb'),path.join(import.meta.dirname,'windows-animation-fault.cpp'),'/link','/DEBUG','/PDB:'+path.join(directory,'probe.pdb')],{cwd:directory,env,encoding:'utf8',windowsHide:true,timeout});
  assert.ifError(built.error);assert.equal(built.status,0,built.stdout+built.stderr);
  const result=spawnSync(executable,['0'],{cwd:directory,encoding:'utf8',windowsHide:true,timeout});assert.ifError(result.error);assert.equal(result.status>>>0,0xc0000005);
  const records=prefix=>result.stderr.split('\n').filter(line=>line.startsWith(prefix)).map(line=>JSON.parse(line.slice(prefix.length)));
  const [fatal]=records('ANIMATION_FATAL '),frames=records('ANIMATION_FAULT_PC ');assert.equal(fatal.code,0xc0000005);assert.equal(fatal.operation,1);assert.equal(fatal.address,'0x0');assert(frames.length>=2&&frames.length<=64);assert.equal(frames[0].module,'probe.exe');assert(frames[0].rva>0);
  const symbols=symbolizeWindowsFault(frames,directory);assert(symbols.some(value=>!value.error&&value.output.includes('faultProbe')&&value.output.includes('faultCaller')));assert.deepEqual(symbolizeWindowsFault([{module:'../probe.exe',rva:1}],directory),[]);
  const bundle=path.join(directory,'Bundle');fs.mkdirSync(bundle);const config=path.join(directory,'profile-config.h');fs.writeFileSync(config,'#define NELYX_PC_MAPPER_PATH L'+JSON.stringify(path.join(import.meta.dirname,'windows-pc-results.mjs').replaceAll('\\','/'))+'\n#define NELYX_NODE_PATH L'+JSON.stringify(process.execPath.replaceAll('\\','/'))+'\n');
  const profiler=path.join(directory,'profile.exe'),compiled=spawnSync('cl.exe',['/nologo','/std:c++20','/EHsc','/MD','/O2','/FI'+config,'/Fe:'+profiler,'/Fo:'+path.join(directory,'profile.obj'),path.join(import.meta.dirname,'windows-scroll-profile.cpp'),'/link','dbghelp.lib'],{cwd:directory,env,encoding:'utf8',windowsHide:true,timeout});assert.ifError(compiled.error);assert.equal(compiled.status,0,compiled.stdout+compiled.stderr);
  const observed=spawnSync(profiler,[executable,bundle],{cwd:directory,encoding:'utf8',windowsHide:true,timeout});assert.ifError(observed.error);assert.equal(observed.status>>>0,0xc0000005,observed.stdout+observed.stderr);assert.match(observed.stdout,/FAULT_PROBE_STDOUT/);assert.match(observed.stderr,/FAULT_PROBE_STDERR/);assert.match(observed.stdout,/ANIMATION_PC_ATTRIBUTION /);assert.match(observed.stdout,/"phase":"pc.probe"/);assert(!fs.existsSync(path.join(directory,'pc-snapshots.json')));
  const [profile]=observed.stdout.split('\n').filter(line=>line.startsWith('ANIMATION_PC_SAMPLES ')).map(line=>JSON.parse(line.slice(21)));assert(profile?.complete&&profile.samples>0);assert.equal(profile.failed,0);assert.equal(profile.dropped,0);assert.equal(profile.pcs.reduce((n,pc)=>n+pc.n,0),profile.samples);assert(profile.pcs.some(pc=>pc.module==='probe.exe'&&pc.rva>0));assert.match(observed.stdout,/"debugger":true/);
 }finally{assert.equal(path.dirname(directory),fs.realpathSync(os.tmpdir()));assert(path.basename(directory).startsWith('nelyx-windows-animation-fault-'));assert(!fs.lstatSync(directory).isSymbolicLink());fs.rmSync(directory,{recursive:true,force:true});}
});
