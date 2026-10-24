// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';
import {createReactNativeAssetServices} from '../../sdk/dist/backends/react-native/assets.js';
const {copyAndroidFontAssets}=createRequire(import.meta.url)('../../sdk/tooling/metro/src/assets.cjs');
const timeout=1_200_000,hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function withDirectory(run){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nelyx-editor-fonts-'));try{return run(directory);}finally{assert.equal(path.dirname(directory),path.resolve(os.tmpdir()));assert(path.basename(directory).startsWith('nelyx-editor-fonts-'));fs.rmSync(directory,{recursive:true,force:true,maxRetries:3,retryDelay:100});}}

test('Android Skia font packaging shares hash-named bytes, prunes only previous fonts and preserves a valid artifact on input failure',{timeout},()=>withDirectory(directory=>{
  const source=path.join(directory,'assets'),output=path.join(directory,'generated');fs.mkdirSync(source);const first=Buffer.from('font-one'),second=Buffer.from('font-two'),sha256=hash(first);fs.writeFileSync(path.join(source,'font.ttf'),first);fs.writeFileSync(path.join(source,'image.png'),'image');
  const font={id:'body',kind:'font',path:'./assets/font.ttf',fontFamily:'Body',sha256},image={id:'image',kind:'image',path:'./assets/image.png',sha256:hash(Buffer.from('image'))};
  const result=copyAndroidFontAssets(directory,[font,{...font,id:'alias',fontFamily:'Alias'},image],output);assert.equal(result.fonts.length,2);const root=path.join(output,'nelyx'),files=fs.readdirSync(path.join(root,'fonts'));assert.deepEqual(files,[sha256+'.ttf']);assert.equal(fs.readFileSync(path.join(output,result.fonts[0].file)).toString(),'font-one');
  fs.writeFileSync(path.join(root,'keep.txt'),'unrelated');const previous=fs.readFileSync(path.join(root,'fonts.json'));
  assert.throws(()=>copyAndroidFontAssets(directory,[{...font,sha256:'0'.repeat(64)}],output),/hash mismatch/);assert.deepEqual(fs.readFileSync(path.join(root,'fonts.json')),previous);assert(fs.existsSync(path.join(root,'fonts',sha256+'.ttf')));
  fs.writeFileSync(path.join(source,'font.ttf'),second);const latest=copyAndroidFontAssets(directory,[{...font,sha256:hash(second)}],output);assert.deepEqual(fs.readdirSync(path.join(root,'fonts')),[hash(second)+'.ttf']);assert.equal(fs.readFileSync(path.join(root,'keep.txt'),'utf8'),'unrelated');assert.equal(latest.fonts[0].family,'Body');assert(!fs.readdirSync(root).some(file=>file.startsWith('.fonts-')));
}));

test('Android Skia font packaging rejects unsafe output ancestry and malformed family metadata',{timeout},()=>withDirectory(directory=>{
  fs.mkdirSync(path.join(directory,'assets'));fs.writeFileSync(path.join(directory,'assets/font.ttf'),'font');const font={id:'body',kind:'font',path:'./assets/font.ttf',fontFamily:'Body',sha256:hash(Buffer.from('font'))};
  assert.throws(()=>copyAndroidFontAssets(directory,[{...font,fontFamily:'Body\nOther'}],path.join(directory,'output')),/font family/);assert(!fs.existsSync(path.join(directory,'output')));
  assert.throws(()=>copyAndroidFontAssets(directory,[{...font,id:'x'.repeat(65536)}],path.join(directory,'output')),/manifest byte budget/);assert(!fs.existsSync(path.join(directory,'output')));
  fs.mkdirSync(path.join(directory,'real'));fs.symlinkSync(path.join(directory,'real'),path.join(directory,'link'),'junction');assert.throws(()=>copyAndroidFontAssets(directory,[font],path.join(directory,'link/output')),/real directory/);assert(!fs.existsSync(path.join(directory,'real/output')));
}));

test('Skia font loading uses app bytes without a native editor registry and rejects hash drift',{timeout},async()=>{
  const bytes=new Uint8Array([1,2,3]),asset={id:'body',kind:'font',path:'./font.ttf',fontFamily:'Body',sha256:hash(bytes)},disposed=[];
  const face={nelyxIdentity:()=>7,dispose(){disposed.push('face');}},provider={registerFont(actual,family){assert.equal(actual,face);assert.equal(family,'Body');},dispose(){disposed.push('provider');}};
  const services=createReactNativeAssetServices(()=>({native:{Image:{resolveAssetSource(source){return source;}}},skia:{Skia:{Data:{async fromURI(uri){assert.equal(uri,'asset:/font.ttf');return {nelyxBytes:()=>bytes,nelyxSha256:()=>hash(bytes),dispose(){disposed.push('data');}};}},Typeface:{MakeFreeTypeFaceFromData:()=>face},TypefaceFontProvider:{Make:()=>provider}}}}));
  const lease=services.acquire({manifest:[asset],sources:{body:{uri:'asset:/font.ttf'}}});
  try{const value=await lease.ready;assert.equal([...value.fonts.values()][0].family,'Body');}finally{await lease.release();}
  assert.deepEqual(disposed,['data','provider','face']);disposed.length=0;
  const stale=services.acquire({manifest:[{...asset,sha256:'0'.repeat(64)}],sources:{body:{uri:'asset:/font.ttf'}}});
  try{await assert.rejects(stale.ready,/Asset content hash mismatch/);}finally{await stale.release();}
  assert.deepEqual(disposed,['data']);
});
