// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import path from 'node:path';import fs from 'node:fs';
import {buildNativeHost,root} from '../build-native-hermes.mjs';
import {execute} from '../../sdk/tooling/cli/src/commands.mjs';
import {windowsCompilerEnvironment} from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
const timeout=1_200_000;
test('direct Hermes native packets preserve pixels, reject atomically and retire their runtime owner',{timeout,skip:process.platform!=='win32'},async t=>{
  if(!fs.existsSync(path.join(root,'.nelyx/windows-hermes/native-hermes.json'))){t.skip('Prepare the pinned native Hermes supplier first');return;}
  const host=await buildNativeHost(),env=windowsCompilerEnvironment();
  await execute('cmake',['-S',path.join(host.roots['@nelyx/sdk'],'native/windows-hermes'),'-B',host.directory,'-DNELYX_HOST_TEST_SOURCE='+path.join(import.meta.dirname,'native-hermes-host.cpp')],{env,timeout});
  await execute('cmake',['--build',host.directory,'--target','NelyxNativeHostTests','--parallel','2'],{env,timeout});
  await execute(path.join(host.directory,'NelyxNativeHostTests.exe'),[host.inputs.icu],{cwd:host.directory,env,timeout});
});
