// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
const timeout=1_200_000;
test('Windows TSF text store preserves Core state, atomic writes, cancellation and committed geometry',{timeout,skip:process.platform!=='win32'},()=>{
  const run=(file,args)=>{const result=spawnSync(file,args,{encoding:'utf8',windowsHide:true,timeout,maxBuffer:2*1024*1024});if(result.error)throw result.error;assert.equal(result.status,0,result.stdout+result.stderr);return result.stdout;};
  const vs=run(path.join(process.env['ProgramFiles(x86)'],'Microsoft Visual Studio/Installer/vswhere.exe'),['-latest','-products','*','-requires','Microsoft.VisualStudio.Component.VC.Tools.x86.x64','-property','installationPath']).trim();assert(vs);
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nelyx-windows-input-'));
  try{
    const entry=path.join(directory,'compile.cmd'),source=path.join(import.meta.dirname,'windows-input-document.cpp'),include=path.resolve(import.meta.dirname,'../../sdk/native/windows'),output=path.join(directory,'document.exe');
    fs.mkdirSync(path.join(directory,'obj'));
    fs.writeFileSync(entry,'@echo off\r\ncall "'+path.join(vs,'VC/Auxiliary/Build/vcvars64.bat')+'" >nul\r\nif errorlevel 1 exit /b 1\r\ncl /nologo /std:c++20 /EHsc /W4 /WX /DNOMINMAX /DWIN32_LEAN_AND_MEAN /I"'+include+'" "'+source+'" "'+path.join(import.meta.dirname,'windows-input-store.cpp')+'" "'+path.join(import.meta.dirname,'windows-keyboard-source.cpp')+'" /Fo"'+path.join(directory,'obj').replaceAll('\\','/')+'/'+'" /Fe"'+output+'" /link user32.lib ole32.lib oleaut32.lib uuid.lib shell32.lib\r\nexit /b %errorlevel%\r\n');
    run('cmd.exe',['/d','/c',entry]);const result=run(output,[]);assert.match(result,/PASS-scoped/);console.log(result.trim());
  }finally{
    assert.equal(path.dirname(directory),path.resolve(os.tmpdir()));assert(path.basename(directory).startsWith('nelyx-windows-input-'));fs.rmSync(directory,{recursive:true,force:true});
  }
});
