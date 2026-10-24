// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {startWindowsProcess} from '../../sdk/tooling/cli/src/windows-process.mjs';
const timeout=1_200_000;
test('the actual packaged AOT app presents a responsive window with its own VM and exits cooperatively', {timeout,skip:process.platform!=='win32'||!process.env.NELYX_STATIC_AOT_PACKAGE},async()=>{
  const directory=fs.realpathSync(process.env.NELYX_STATIC_AOT_PACKAGE),manifest=JSON.parse(fs.readFileSync(path.join(directory,'nelyx-package.json'),'utf8'));
  assert.equal(manifest.hermesExecutionMode,'static-aot');
  const child=startWindowsProcess(path.join(directory,manifest.executable),[],{cwd:directory});
  try{
    const script=`Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class Visible { [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window); }';
      for($attempt=0;$attempt -lt 40;$attempt++) { $app=Get-Process -Id ${child.pid} -ErrorAction SilentlyContinue; if(!$app){break};
        if($app.MainWindowTitle -and $app.Responding -and [Visible]::IsWindowVisible($app.MainWindowHandle)) {
          [pscustomobject]@{pid=$app.Id;title=$app.MainWindowTitle;responding=$app.Responding;visible=$true;peakWorkingSetBytes=$app.PeakWorkingSet64;modules=@($app.Modules | Where-Object {$_.ModuleName -in @('Microsoft.ReactNative.dll','hermes.dll','NelyxApp.aot.dll')} | ForEach-Object {$_.FileName})} | ConvertTo-Json -Compress; break
        }; Start-Sleep -Milliseconds 500
      }`;
    const snapshot=spawnSync('powershell.exe',['-NoProfile','-Command',script],{encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:16384});
    assert.ifError(snapshot.error);assert.equal(snapshot.status,0,snapshot.stderr);assert(snapshot.stdout.trim(),'Packaged application did not present a responsive window');
    const ready=JSON.parse(snapshot.stdout);assert(ready.visible&&ready.responding);assert.equal(ready.title,manifest.app);assert.equal(ready.modules.length,3);assert(ready.modules.every(file=>path.dirname(file)===directory));
    console.log('PACKAGED_WINDOWS_APP '+JSON.stringify(ready));await new Promise(resolve=>setTimeout(resolve,1500));
    if(process.env.NELYX_STATIC_AOT_INTERACTION==='1'){
      const interaction=spawnSync('powershell.exe',['-NoProfile','-File',path.join(import.meta.dirname,'windows-packaged-interaction.ps1'),'-AppPid',String(child.pid),...(process.env.NELYX_STATIC_AOT_SNAPSHOT==='1'?['-SnapshotOnly']:[])],{encoding:'utf8',windowsHide:true,timeout,maxBuffer:1024*1024});
      console.log(interaction.stdout);assert.ifError(interaction.error);assert.equal(interaction.status,0,interaction.stderr);
      if(process.env.NELYX_STATIC_AOT_SNAPSHOT!=='1')assert.match(interaction.stdout,/PACKAGED_WINDOWS_INTERACTION PASS/);
    }
  }finally{const ended=await child.stop();console.log('PACKAGED_WINDOWS_CLOSE '+JSON.stringify(ended));assert.equal(ended.exitCode,0);assert(!ended.forced);assert.equal(ended.error,null);}
});
