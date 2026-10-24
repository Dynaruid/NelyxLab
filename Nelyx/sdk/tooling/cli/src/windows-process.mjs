// SPDX-License-Identifier: BSD-3-Clause
import {spawn,spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';import {sha256,localFile} from './files.mjs';
import fs from 'node:fs';
import {verifyWindowsV8} from './windows-v8.mjs';
import {verifyWindowsJsc,windowsJscMode} from './windows-jsc.mjs';
import {verifyStaticAotApplication} from './windows-static-aot.mjs';
import {windowsHermesExecutionMode} from './windows-aot-mode.mjs';
const supply=createRequire(import.meta.url)('@nelyx/sdk/providers/hermes-supply.json').pins.windows.supplier.runtime;
export function verifyWindowsHermes(directory){if(sha256(localFile(directory,'hermes.dll'))!==supply.sha256)throw Error('RNW Hermes binary differs from the pinned native supplier');}
export function verifyWindowsRuntime(directory){
  const manifest=JSON.parse(fs.readFileSync(localFile(directory,'nelyx-package.json'),'utf8'));
  const mode=windowsHermesExecutionMode(manifest.hermesExecutionMode);
  if(mode==='static-aot'){if(manifest.cohort?.engine!=='hermes'||manifest.configuration!=='Release')throw Error('Static Hermes runtime requires Hermes Release');verifyStaticAotApplication(directory);}
  else if(manifest.cohort?.engine==='jsc'){
    windowsJscMode(manifest.jscExecutionMode);
    if(fs.readFileSync(localFile(directory,'jsc-mode.txt'),'utf8')!==manifest.jscExecutionMode+'\n')throw Error('JSC packaged execution mode differs');
    verifyWindowsJsc(directory,{embedded:true});
  }else if(manifest.cohort?.engine==='v8')verifyWindowsV8(directory,{embedded:true});else verifyWindowsHermes(directory);
}
/** Visible owned RNW app; cooperative window close precedes a bounded forced tree stop. */
export function startWindowsProcess(executable,args,{cwd,env}={}){
  if(process.platform!=='win32')throw Error('Windows application process requires Windows');
  verifyWindowsRuntime(cwd);
  const child=spawn(executable,args,{cwd,env,stdio:['ignore','pipe','pipe'],windowsHide:false});
  child.stdout.pipe(process.stderr,{end:false});child.stderr.pipe(process.stderr,{end:false});
  let ended=false,stopping,spawnError,forced=false;
  const completed=new Promise(resolve=>{child.once('error',error=>{spawnError=error;});child.once('close',(exitCode,signal)=>{ended=true;resolve({exitCode,signal,error:spawnError?String(spawnError):null,forced});});});
  function request(){
    if(ended||!child.pid)return;
    spawnSync('powershell.exe',['-NoProfile','-Command',`$p=Get-Process -Id ${child.pid} -ErrorAction SilentlyContinue; if($p){$p.CloseMainWindow()|Out-Null}`],{windowsHide:true,stdio:'ignore',timeout:3000});
  }
  return {pid:child.pid,completed,stop(){return stopping??=(async()=>{
    if(ended)return completed;request();const retry=setInterval(request,500),deadline=setTimeout(()=>{
      if(ended||!child.pid)return;forced=true;spawnSync('taskkill.exe',['/pid',String(child.pid),'/t','/f'],{windowsHide:true,stdio:'ignore',timeout:10000});
    },15000);
    try{return await completed;}finally{clearInterval(retry);clearTimeout(deadline);}
  })();}};
}
