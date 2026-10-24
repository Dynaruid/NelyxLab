// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {prepareWebRuntime} from '../../skia/eng/prepare-web-runtime.mjs';
import {readWebRuntime} from '../../sdk/tooling/metro/src/web-runtime.mjs';

const timeout=1_200_000;
const recipe=new URL('../../skia/eng/source-build/',import.meta.url);
const lockBytes=fs.readFileSync(new URL('canvaskit.lock.json',recipe));
const lock=JSON.parse(lockBytes);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const write=(directory,name,value)=>fs.writeFileSync(path.join(directory,name),JSON.stringify(value));
function temporary(run){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nelyx-web-runtime-'));
  try{return run(directory);}finally{
    assert.equal(path.dirname(directory),fs.realpathSync(os.tmpdir()));
    assert(path.basename(directory).startsWith('nelyx-web-runtime-')&&!fs.lstatSync(directory).isSymbolicLink());
    fs.rmSync(directory,{recursive:true,force:true});
  }
}
function fixture(directory){
  write(directory,'package.json',{private:true});
  const files=['canvaskit.js','canvaskit.wasm'].map(id=>{
    // Transport fixtures exercise manifest/hash admission, not WASM execution.
    const bytes=Buffer.from('transport fixture: '+id);fs.writeFileSync(path.join(directory,id),bytes);
    return {id,path:id,sha256:hash(bytes)};
  });
  fs.writeFileSync(path.join(directory,'LICENSE_SKIA'),'test fixture notice');
  return {schema:'nelyx.canvaskit/v1',adapterAbi:1,version:'m153-nelyx-paragraph.1',paragraphApiVersion:1,
    source:{revision:lock.skia.revision,lockSha256:hash(lockBytes),patchSha256:lock.patch.sha256},files};
}

test('pending runtime is rejected before package preparation or Metro reads binary files',{timeout},()=>temporary(directory=>{
  write(directory,'native-manifest.json',{status:'requires-build'});
  assert.throws(()=>prepareWebRuntime(directory),/Build the Nelyx CanvasKit runtime/);
  assert.throws(()=>readWebRuntime({projectRoot:directory},directory),/Build and supply the Nelyx CanvasKit runtime/);
}));

test('a renamed manifest cannot reuse an obsolete source-build receipt',{timeout},()=>temporary(directory=>{
  const manifest=fixture(directory);write(directory,'native-manifest.json',manifest);
  write(directory,'nelyx-build.json',{status:'PASS-build',manifest,recipeSha256:'0'.repeat(64)});
  assert.throws(()=>prepareWebRuntime(directory),/Current owned source-build receipt required/);
  manifest.source.patchSha256='0'.repeat(64);write(directory,'native-manifest.json',manifest);
  assert.throws(()=>prepareWebRuntime(directory),/Owned CanvasKit source identity mismatch/);
}));

test('Metro accepts only the Nelyx paragraph cohort and checks its supplied bytes',{timeout},()=>temporary(directory=>{
  const manifest=fixture(directory);write(directory,'native-manifest.json',manifest);
  const result=readWebRuntime({projectRoot:directory},directory);
  assert.equal(result.manifest.version,'m153-nelyx-paragraph.1');
  assert.equal(result.runtime.length,2);
  for(const change of [{version:'0.41.0'},{schema:'foreign.canvaskit/v1'},{paragraphApiVersion:undefined}]){
    write(directory,'native-manifest.json',{...manifest,...change});
    assert.throws(()=>readWebRuntime({projectRoot:directory},directory),/Invalid Web runtime manifest/);
  }
  write(directory,'native-manifest.json',manifest);
  fs.appendFileSync(path.join(directory,'canvaskit.wasm'),'changed');
  assert.throws(()=>readWebRuntime({projectRoot:directory},directory),/CanvasKit build artifact hash mismatch/);
}));
