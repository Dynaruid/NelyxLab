// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {nativeCohort} from '../../sdk/dist/runtime/cohorts.js';
import {windowsHermesPolicy} from '../../sdk/tooling/cli/src/windows-hermes-policy.mjs';
import {verifyWindowsPackage} from '../../sdk/tooling/cli/src/windows-runner.mjs';
import {windowsHermesProfileFlags} from './windows-hermes-profile.mjs';
const timeout=1_200_000,cohort=nativeCohort('windows');

test('Windows Hermes optimization is explicit, immutable and bound to the exact VM supplier',{timeout},()=>{
  assert.deepEqual(windowsHermesPolicy(undefined,cohort).flags,['-Og']);const optimized=windowsHermesPolicy('optimized',cohort);
  assert(Object.isFrozen(optimized));assert(Object.isFrozen(optimized.flags));assert.deepEqual(optimized.flags,windowsHermesProfileFlags('O-no-cfg'));
  assert.throws(()=>windowsHermesPolicy('O',cohort),/profile/);
  for(const changed of [{engine:'v8'},{engineVersion:'1.0.1'},{engineRevision:'0'.repeat(40)},{bytecodeVersion:100},{frameworkVersion:'0.83.3'},{framework:'react-native'}])assert.throws(()=>windowsHermesPolicy('optimized',{...cohort,...changed}),/pinned/);
});

test('portable packages reject missing optimization policy, changed flags and mismatched profile metadata before launch',{timeout},()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nelyx-hermes-policy-')),policy=windowsHermesPolicy('optimized',cohort);
  const base={schema:'nelyx.rnw-package/v1',target:'windows',profile:'rn-graphite-vulkan',architecture:'x64',configuration:'Release',app:'PolicyTest',executable:'NelyxRNHost.exe',bundle:'Bundle/index.windows.bundle',qualification:'notVerified',nativeInputsSha256:'a'.repeat(64),nativeBindingConfiguration:'Release',crt:'MD',iteratorDebugLevel:0,cohort,hermesCompilerFlags:policy.flags.join(' '),hermesCompilerProfile:'optimized',hermesCompilerPolicy:policy.id,files:[]};
  try{for(const changed of [{hermesCompilerPolicy:undefined},{hermesCompilerPolicy:'other'},{hermesCompilerFlags:'-O'},{hermesCompilerFlags:'-Og'},{hermesCompilerProfile:'debug'},{hermesCompilerProfile:'unknown'}]){fs.writeFileSync(path.join(directory,'nelyx-package.json'),JSON.stringify({...base,...changed}));assert.throws(()=>verifyWindowsPackage(directory),/compiler policy|profile/);}}
  finally{assert.equal(path.dirname(fs.realpathSync(directory)),fs.realpathSync(os.tmpdir()));assert(path.basename(directory).startsWith('nelyx-hermes-policy-'));fs.rmSync(directory,{recursive:true,force:true});}
});
