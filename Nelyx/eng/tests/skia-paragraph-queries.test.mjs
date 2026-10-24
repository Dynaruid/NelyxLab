// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {spawnSync} from 'node:child_process';
import {graphemeBoundaries} from '@nelyx/core/foundation/grapheme-boundaries';
import {verifyWindowsInputs} from '../../sdk/tooling/cli/src/native-inputs.mjs';
const timeout=1_200_000;
test('Core native paragraph tickets read the original shape and never wait for a busy owner',{timeout,skip:process.platform!=='win32'},()=>{
 const run=(file,args)=>{const r=spawnSync(file,args,{encoding:'utf8',windowsHide:true,timeout,maxBuffer:3*1024*1024});if(r.error)throw r.error;assert.equal(r.status,0,r.stdout+r.stderr);return r.stdout;};
 const root=path.resolve(import.meta.dirname,'../../..');const disk=fs.statfsSync(root);assert(disk.bavail*disk.bsize>=20*1024**3,'Need 20 GiB before native validation');
 const runner=path.join(root,'sample/nelyx-testbed-app-2/windows/runner'),inputs=verifyWindowsInputs({runner,input:path.join(root,'Nelyx/.cache/native/windows/current/inputs.json')}),binding=path.join(runner,'node_modules/@nelyx/skia-rn');
 const vs=run(path.join(process.env['ProgramFiles(x86)'],'Microsoft Visual Studio/Installer/vswhere.exe'),['-latest','-products','*','-requires','Microsoft.VisualStudio.Component.VC.Tools.x86.x64','-property','installationPath']).trim();assert(vs);const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nelyx-core-paragraph-'));
 try{
  const output=path.join(directory,'paragraph.exe'),entry=path.join(directory,'compile.cmd'),libraries=inputs.manifest.libraries.map(file=>'"'+path.join(inputs.root,file)+'"');
  fs.writeFileSync(entry,'@echo off\r\ncall "'+path.join(vs,'VC/Auxiliary/Build/vcvars64.bat')+'" >nul\r\nif errorlevel 1 exit /b 1\r\ncl /nologo /std:c++20 /MD /EHsc /W4 /WX /utf-8 /DNDEBUG /D_ITERATOR_DEBUG_LEVEL=0 /DNOMINMAX /DWIN32_LEAN_AND_MEAN /I"'+path.join(binding,'generated/core')+'" /I"'+path.join(root,'Nelyx/sdk/native/windows')+'" /external:I"'+path.join(inputs.root,inputs.manifest.headers)+'" /external:W0 "'+path.join(import.meta.dirname,'skia-paragraph-queries.cpp')+'" /Fo"'+path.join(directory,'paragraph.obj')+'" /Fe"'+output+'" /link '+libraries.join(' ')+' windowsapp.lib user32.lib gdi32.lib d3d11.lib dxgi.lib dwrite.lib usp10.lib shlwapi.lib ole32.lib oleaut32.lib uuid.lib shell32.lib\r\nexit /b %errorlevel%\r\n');
  run('cmd.exe',['/d','/c',entry]);const result=run(output,[path.join(root,'Nelyx/sdk/tooling/cli/templates/nelyx-app/assets/RobotoSlab-VariableFont_wght.ttf'),path.join(inputs.root,inputs.manifest.icu),graphemeBoundaries('A😀 e\u0301 אבג wrapped text\n한글').join(',')]);assert.match(result,/PASS-scoped/);console.log(result.trim());
 }finally{assert.equal(path.dirname(directory),path.resolve(os.tmpdir()));assert(path.basename(directory).startsWith('nelyx-core-paragraph-'));fs.rmSync(directory,{recursive:true,force:true});}
});
