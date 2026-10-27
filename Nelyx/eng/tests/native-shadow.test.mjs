// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {verifyWindowsInputs} from '../../sdk/tooling/cli/src/native-inputs.mjs';
import {verifyNativeSourceInputs} from '../../skia/eng/native-source-inputs.mjs';
import {windowsCompilerEnvironment} from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
import {execute} from '../../sdk/tooling/cli/src/commands.mjs';
const timeout=1_200_000,root=path.resolve(import.meta.dirname,'../../..');
test('the exact delivered Windows core keeps press/release/hover-exit shadows continuous',{timeout,skip:process.platform!=='win32'},async t=>{
  const app=path.join(root,'sample/nelyx-testbed-app-2'),runner=path.join(app,'windows/runner'),locator=path.join(app,'.nelyx/windows/native-inputs.json');
  if(!fs.existsSync(locator)){t.skip('Prepare the Windows renderer supplier first');return;}
  const input=verifyWindowsInputs({runner,input:JSON.parse(fs.readFileSync(locator,'utf8')).input}),binding=path.join(runner,'node_modules/@nelyx/skia-rn');
  verifyNativeSourceInputs(binding);
  assert.deepEqual(fs.readFileSync(path.join(binding,'native/vulkan/CMakeLists.txt')),fs.readFileSync(path.join(root,'Nelyx/skia/packages/rn/native/vulkan/CMakeLists.txt')));
  const parent=fs.realpathSync(os.tmpdir()),directory=fs.mkdtempSync(path.join(parent,'nelyx-native-shadow-'));
  try{
    const env=windowsCompilerEnvironment(),executable=path.join(directory,'shadows.exe');
    // Link the delivered archives. Recompiling core.cpp with test-only defines
    // cannot establish that the actual RNW core contains its Graphite path.
    const defines=['SK_GRAPHITE','SK_VULKAN','SK_USE_INTERNAL_VULKAN_HEADERS','VK_NO_PROTOTYPES','VK_USE_PLATFORM_WIN32_KHR','NOMINMAX','WIN32_LEAN_AND_MEAN'];
    const includes=[path.join(input.root,input.manifest.headers),...['generated/core','generated/gpu','generated/vulkan'].map(name=>path.join(binding,name))];
    const system=['d3d11','dxgi','dcomp','dwmapi','user32','gdi32','dwrite','ole32','oleaut32','uuid','usp10','shlwapi','shell32','imm32','comctl32','runtimeobject','advapi32','bcrypt'];
    await execute('cl.exe',['/nologo','/std:c++20','/O2','/MD','/EHsc','/bigobj','/utf-8',...defines.map(value=>'/D'+value),...includes.map(value=>'/I'+value),path.join(import.meta.dirname,'native-shadow.cpp'),'/Fo'+path.join(directory,'shadows.obj'),'/Fe'+executable,'/link',...input.manifest.libraries.map(name=>path.join(input.root,name)),...system.map(name=>name+'.lib')],{cwd:directory,env,timeout});
    await execute(executable,[],{cwd:directory,env,timeout});
  }finally{
    assert.equal(path.dirname(fs.realpathSync(directory)),parent);assert(path.basename(directory).startsWith('nelyx-native-shadow-'));assert(!fs.lstatSync(directory).isSymbolicLink());
    fs.rmSync(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  }
});
