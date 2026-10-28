// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {spawnSync} from 'node:child_process';
const timeout=1_200_000;
function run(file,args,options={}){const result=spawnSync(file,args,{encoding:'utf8',windowsHide:true,timeout,...options});if(result.error)throw result.error;assert.equal(result.status,0,(result.stdout??'')+(result.stderr??''));return result.stdout;}
test('window composition pointer input preserves coordinates, capture cancellation and owner retirement',{timeout,skip:process.platform!=='win32'},()=>{
 const vs=run(path.join(process.env['ProgramFiles(x86)'],'Microsoft Visual Studio/Installer/vswhere.exe'),['-latest','-products','*','-requires','Microsoft.VisualStudio.Component.VC.Tools.x86.x64','-property','installationPath']).trim();assert(vs);
 const setup=run(process.env.ComSpec??'cmd.exe',['/d','/s','/c','""'+path.join(vs,'Common7/Tools/VsDevCmd.bat')+'" -arch=x64 -host_arch=x64 >nul && set"'],{windowsVerbatimArguments:true});
 const env=Object.fromEntries(Object.entries(process.env).map(([key,value])=>[key.toUpperCase(),value]));for(const line of setup.split(/\r?\n/)){const index=line.indexOf('=');if(index>0)env[line.slice(0,index).toUpperCase()]=line.slice(index+1);}
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nelyx-window-pointer-'));
 try{
  const executable=path.join(directory,'pointer.exe');run('cl.exe',['/nologo','/std:c++20','/EHsc','/MD','/O2','/DNOMINMAX','/I'+path.resolve(import.meta.dirname,'../../skia/native/host'),'/Fe:'+executable,'/Fo:'+path.join(directory,'pointer.obj'),path.join(import.meta.dirname,'windows-window-pointer.cpp'),'user32.lib','comctl32.lib'],{cwd:directory,env});
  const result=run(executable,[],{cwd:directory});assert.match(result,/PASS coordinates=1 buttons=1 wheel=1 capture-loss=1 retirement=1 unrelated-window=0 owner-affinity=1/);console.log(result.trim());
 }finally{assert.equal(path.dirname(directory),fs.realpathSync(os.tmpdir()));assert(path.basename(directory).startsWith('nelyx-window-pointer-'));assert(!fs.lstatSync(directory).isSymbolicLink());fs.rmSync(directory,{recursive:true,force:true});}
});
