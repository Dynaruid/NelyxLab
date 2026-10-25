// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {openNativeBuildCache} from '../../sdk/tooling/cli/src/native-build-cache.mjs';
import {compileHermesImage} from '../../sdk/tooling/cli/src/windows-hermes-image.mjs';
import {verifyWindowsStaticHermes,windowsCompilerEnvironment} from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
import {verifyNativeHermes} from '../../sdk/tooling/cli/src/windows-native-hermes-toolchain.mjs';
import {nativeImageDebugIdentity} from '../../sdk/tooling/cli/src/native-pc-map.mjs';
import {sha256} from '../../sdk/tooling/cli/src/files.mjs';
const timeout=1_200_000;
test('the single compiler cache rejects concurrent owners and discards broken metadata',{timeout},()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'nelyx-build-cache-'));let cache;
  try{
    const directory=path.join(folder,'current');cache=openNativeBuildCache(directory);assert.equal(cache.read(),null);assert.throws(()=>openNativeBuildCache(directory),/already in use/);
    const record={units:[],image:null};cache.write(record,folder);assert.deepEqual(cache.read(),record);
    const index=path.join(directory,'index.json');const changed=JSON.parse(fs.readFileSync(index));changed.record.image={key:'tampered'};fs.writeFileSync(index,JSON.stringify(changed));assert.equal(cache.read(),null);
    fs.writeFileSync(index,'{');assert.equal(cache.read(),null);cache.close();cache=null;
    assert(!fs.existsSync(directory+'.lock'));fs.writeFileSync(directory+'.lock','2147483646');cache=openNativeBuildCache(directory);cache.close();cache=null;
  }finally{cache?.close();assert.equal(path.dirname(folder),fs.realpathSync(os.tmpdir()));assert(!fs.lstatSync(folder).isSymbolicLink());fs.rmSync(folder,{recursive:true,force:true});}
});
test('actual native images reuse unchanged units and evidence, and invalidate changed or damaged inputs',{timeout,skip:process.platform!=='win32'||!process.env.NELYX_STATIC_HERMES_INPUTS&&!process.env.NELYX_NATIVE_HERMES_INPUTS},async t=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'nelyx-native-cache-'));
  try{
    const direct=!!process.env.NELYX_NATIVE_HERMES_INPUTS,checked=direct?verifyNativeHermes(process.env.NELYX_NATIVE_HERMES_INPUTS):verifyWindowsStaticHermes(process.env.NELYX_STATIC_HERMES_INPUTS),env=windowsCompilerEnvironment(),output=path.join(folder,'app.dll'),cacheDirectory=path.join(folder,'current'),runtimeLibrary=direct?path.join(checked.directory,'build/lib/hermesvm.lib'):undefined;
    const sources=['helper','app'].map(name=>path.join(folder,name+'.js'));fs.writeFileSync(sources[0],'globalThis.helper=x=>x+1;');fs.writeFileSync(sources[1],'globalThis.app=x=>helper(x);');
    const units=sources.map((source,index)=>({name:index?'nelyx_app':'nelyx_typed',source,flags:['-O0'],evidence:true}));
    let descriptor='__declspec(dllexport) int nelyx_sh_plan_v5(void){return 1;}';
    const compile=()=>compileHermesImage({checked,env,output,units,cacheDirectory,descriptor,signal:t.signal,runtimeLibrary});
    const cold=await compile(),imageSha=sha256(output);assert.equal(cold.cacheHit,false);assert(cold.units.every(unit=>!unit.cacheHit&&unit.nativeFunctions.baseline.functions.length));
    assert.equal(cold.nativePcMap.debug.guid,nativeImageDebugIdentity(output).guid);
    const warm=await compile();assert.equal(warm.cacheHit,true);assert.equal(sha256(output),imageSha);assert.deepEqual(warm.nativePcMap,cold.nativePcMap);assert(warm.units.every(unit=>unit.cacheHit&&unit.nativeMs===0));
    fs.writeFileSync(sources[0],'globalThis.helper=x=>x+2;');const edited=await compile();assert.equal(edited.cacheHit,false);assert.deepEqual(edited.units.map(unit=>unit.cacheHit),[false,true]);
    descriptor='__declspec(dllexport) int nelyx_sh_plan_v5(void){return 2;}';const relinked=await compile();assert(relinked.units.every(unit=>unit.cacheHit));assert.equal(relinked.cacheHit,false);
    fs.appendFileSync(output,'damaged');const repaired=await compile();assert.equal(repaired.cacheHit,false);assert(repaired.units.every(unit=>unit.cacheHit));assert.equal(repaired.nativePcMap.imageSha256,sha256(output));
    fs.appendFileSync(path.join(cacheDirectory,'nelyx_app.obj'),'damaged');units[0].flags=['-O0','-fno-inline'];const objectRepaired=await compile();assert.deepEqual(objectRepaired.units.map(unit=>unit.cacheHit),[false,false]);
    const entry=path.join(cacheDirectory,'index.json');fs.writeFileSync(entry,'{');const metadataRepaired=await compile();assert(metadataRepaired.units.every(unit=>!unit.cacheHit));
    const validSource=fs.readFileSync(sources[0],'utf8'),validImage=sha256(output);
    fs.writeFileSync(sources[0],'function invalid(');await assert.rejects(compile(),/Runner command/);assert.equal(sha256(output),validImage);
    assert(!fs.existsSync(cacheDirectory+'.lock'));assert(!fs.readdirSync(folder).some(name=>name.startsWith('.nelyx-sh-')));
    fs.writeFileSync(sources[0],validSource);assert.equal((await compile()).cacheHit,true);
    const canceled=new AbortController();canceled.abort();await assert.rejects(compileHermesImage({checked,env,output,units,cacheDirectory,signal:canceled.signal}),{name:'AbortError'});
    assert(!fs.existsSync(cacheDirectory+'.lock'));assert(!fs.readdirSync(folder).some(name=>name.startsWith('.nelyx-sh-')));
    assert.deepEqual(fs.readdirSync(cacheDirectory).sort(),['index.json','nelyx_app.obj','nelyx_typed.obj']);
    console.log('NATIVE_BUILD_CACHE '+JSON.stringify({coldMs:cold.buildMs,warmMs:warm.buildMs,sourceEdit:edited.units.map(unit=>({unit:unit.unit,cacheHit:unit.cacheHit}))}));
  }finally{assert.equal(path.dirname(folder),fs.realpathSync(os.tmpdir()));assert(!fs.lstatSync(folder).isSymbolicLink());fs.rmSync(folder,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});
