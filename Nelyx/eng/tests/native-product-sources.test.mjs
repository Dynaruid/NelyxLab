// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';
import {verifyNativeProductSources,verifyNativeLoadedIdentity} from './native-product-sources.mjs';
const timeout=1_200_000,hash=text=>createHash('sha256').update(text).digest('hex');

test('native probes require one independent process identity matching every loaded image in either package mode',{timeout},()=>{
 for(const bundle of ['app.hbc','NelyxApp.aot.dll']){
  const value={hostSha256:hash('host'),vmSha256:hash('vm'),bundleSha256:hash(bundle),modules:79,nodeApiJsi:false,rnRuntime:false},manifest={bundle,files:[{path:'NelyxHermesHost.exe',sha256:value.hostSha256},{path:'hermesvm.dll',sha256:value.vmSha256},{path:bundle,sha256:value.bundleSha256}]},line=data=>'NELYX_NATIVE_IDENTITY '+JSON.stringify(data),output=line(value);
  const result=verifyNativeLoadedIdentity('other output\r\n'+output+'\r\n',manifest);assert.deepEqual(result,value);assert(Object.isFrozen(result));
  for(const changed of [{nodeApiJsi:true},{rnRuntime:true},{modules:0},{modules:1.5},{modules:Number.MAX_SAFE_INTEGER+1},{nodeApiJsi:undefined},{hostSha256:'h'.repeat(64)},{vmSha256:hash('other')},{bundleSha256:hash('other')},{hostSha256:undefined}])assert.throws(()=>verifyNativeLoadedIdentity(line({...value,...changed}),manifest));
  for(const invalid of ['',output+'\n'+output,'NELYX_NATIVE_IDENTITY {'])assert.throws(()=>verifyNativeLoadedIdentity(invalid,manifest));
  assert.throws(()=>verifyNativeLoadedIdentity(output,{...manifest,files:manifest.files.filter(entry=>entry.path!=='hermesvm.dll')}));assert.throws(()=>verifyNativeLoadedIdentity(output,{...manifest,files:[...manifest.files,manifest.files[0]]}));
 }
});
test('native product probes reject changed code and owner manifests in either engine mode',{timeout},()=>{
 const app=fs.mkdtempSync(path.join(os.tmpdir(),'nelyx-product-source-'));
 try{
  const manifest='{"name":"@nelyx/core"}\n',code='export const value=1;\n';fs.writeFileSync(path.join(app,'package.json'),manifest);fs.writeFileSync(path.join(app,'source.js'),code);
  for(const mode of ['bytecode','static-aot']){
   const owner={name:'@nelyx/core',root:'',manifestSha256:hash(manifest)},entry='.nelyx/native-windows/.build-'+mode+'/entry.ts',module={id:'source.js',role:'module',sourceKind:'code',sourceFile:'source.js',sourceSha256:hash(code),owner};
   const graph={schema:mode==='bytecode'?'nelyx.static-aot-runtime-inventory/v2':'nelyx.static-aot-execution-plan/v2',modules:[{...module,id:entry,sourceFile:entry},{...module,id:'generated/prelude',role:'prepend',sourceFile:'generated/prelude'},module]},file=path.join(app,mode==='bytecode'?'native-graph.json':'native-aot-execution.json'),write=()=>fs.writeFileSync(file,JSON.stringify(graph)),verify=()=>verifyNativeProductSources({app,directory:app,mode});if(mode==='static-aot')for(const value of graph.modules)delete value.sourceKind;write();
   assert.deepEqual(verify(),{scope:'current-runtime-code-and-owner-manifests',modules:1,owners:1,generatedExcluded:2});
   graph.modules[1]={...module,id:'preload-file',role:'prepend'};write();assert.equal(verify().modules,2);graph.modules[1]={...module,id:'generated/prelude',role:'prepend',sourceFile:'generated/prelude'};write();
   fs.writeFileSync(path.join(app,'source.js'),code+'// changed');assert.throws(verify,/source changed/);fs.writeFileSync(path.join(app,'source.js'),code);
   fs.writeFileSync(path.join(app,'package.json'),manifest+' ');assert.throws(verify,/manifest changed/);fs.writeFileSync(path.join(app,'package.json'),manifest);
   for(const sourceFile of ['../outside.js','/absolute.js','C:/outside.js','source\\file.js']){graph.modules[2]={...module,sourceFile};write();assert.throws(verify,/escapes/);}
   graph.modules[2]={...module};graph.modules.push({...module});write();assert.throws(verify,/incomplete/);graph.modules.pop();graph.modules[0]={...module,id:'.nelyx/native-windows/.build-other/entry.ts',sourceFile:'.nelyx/native-windows/.build-other/entry.ts'};write();assert.throws(verify);
  }
 }finally{assert.equal(path.dirname(app),fs.realpathSync(os.tmpdir()));assert(!fs.lstatSync(app).isSymbolicLink());fs.rmSync(app,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});
