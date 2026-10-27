// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {spawnSync} from 'node:child_process';
const timeout=1_200_000;
function run(file,args,options={}){const result=spawnSync(file,args,{encoding:'utf8',windowsHide:true,timeout,maxBuffer:4*1024*1024,...options});if(result.error)throw result.error;assert.equal(result.status,0,(result.stdout??'')+(result.stderr??''));return result.stdout;}
test('real DirectManipulation initializes, resets and accepts repeated gesture callbacks without suppressing fallback wheel',{timeout,skip:process.platform!=='win32'},()=>{
  const vs=run(path.join(process.env['ProgramFiles(x86)'],'Microsoft Visual Studio/Installer/vswhere.exe'),['-latest','-products','*','-requires','Microsoft.VisualStudio.Component.VC.Tools.x86.x64','-property','installationPath']).trim();assert(vs);
  const setup=run(process.env.ComSpec??'cmd.exe',['/d','/s','/c','""'+path.join(vs,'Common7/Tools/VsDevCmd.bat')+'" -arch=x64 -host_arch=x64 >nul && set"'],{windowsVerbatimArguments:true});
  const env=Object.fromEntries(Object.entries(process.env).map(([key,value])=>[key.toUpperCase(),value]));for(const line of setup.split(/\r?\n/)){const index=line.indexOf('=');if(index>0)env[line.slice(0,index).toUpperCase()]=line.slice(index+1);}
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nelyx-precision-'));
  try{
    const executable=path.join(directory,'precision.exe');run('cl.exe',['/nologo','/std:c++20','/EHsc','/MD','/O2','/DNOMINMAX','/DWIN32_LEAN_AND_MEAN','/Fe:'+executable,'/Fo:'+path.join(directory,'precision.obj'),path.join(import.meta.dirname,'windows-precision.cpp'),'/link','ole32.lib','user32.lib','uuid.lib','windowsapp.lib'],{cwd:directory,env});
    const result=run(executable,[],{cwd:directory});assert.match(result,/PASS precision initialized=1 retired=1 repeatedGestures=12 stationary=1 noInertia=4 interruptedInertia=1 cancellation=2 physicalInput=unobserved/);console.log(result.trim());
  }finally{assert.equal(path.dirname(directory),fs.realpathSync(os.tmpdir()));assert(path.basename(directory).startsWith('nelyx-precision-'));assert(!fs.lstatSync(directory).isSymbolicLink());fs.rmSync(directory,{recursive:true,force:true});}
});
