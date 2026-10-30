// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import {sha256,localFile,fileTree,relativeFile} from './files.mjs';

export function verifyWindowsInputs({runner,input}){
  input=fs.realpathSync(input);const root=path.dirname(input),manifest=JSON.parse(fs.readFileSync(input,'utf8'));
  if(manifest.schema!=='nelyx.rnw-native-inputs/v1'||manifest.rnw!=='0.83.2'||manifest.jsi!==21||manifest.architecture!=='x64'||manifest.configuration!=='Release'||manifest.crt!=='MD')throw new Error('RNW0.83.2/JSI21 x64 Release/MD native input identity required');
  if(!Array.isArray(manifest.files)||!manifest.files.length||manifest.files.length>4096||!Array.isArray(manifest.libraries)||manifest.libraries.length!==18||new Set(manifest.libraries).size!==18||!manifest.sources||typeof manifest.sources!=='object')throw new Error('Incomplete native input manifest');
  const names=new Set();let bytes=0;
  for(const record of manifest.files){
    relativeFile(record.file);const key=record.file.toLowerCase();
    if(names.has(key)||!Number.isSafeInteger(record.bytes)||record.bytes<0||!/^[a-f0-9]{64}$/.test(record.sha256))throw new Error('Invalid native input inventory');names.add(key);
    const file=localFile(root,record.file);if(!fs.statSync(file).isFile()||fs.statSync(file).size!==record.bytes||sha256(file)!==record.sha256)throw new Error('Native input hash/size mismatch: '+record.file);
    bytes+=record.bytes;if(bytes>2*1024*1024*1024)throw new Error('Native input exceeds 2GiB');
  }
  for(const name of [...manifest.libraries,manifest.icu])if(!names.has(relativeFile(name).toLowerCase()))throw new Error('Unlisted native library/ICU input');
  const headers=localFile(root,manifest.headers);if(!fs.statSync(headers).isDirectory()||fileTree(headers).some(name=>!names.has((manifest.headers+'/'+name).toLowerCase())))throw new Error('Unlisted native header');
  const binding=path.join(runner,'node_modules/@nelyx/skia-rn'),required=['generated/jsi','generated/native-vulkan','generated/core','generated/gpu','generated/vulkan','generated/host','native/vulkan'].flatMap(folder=>fileTree(localFile(binding,folder)).map(name=>folder+'/'+name));
  if(required.length!==Object.keys(manifest.sources).length||required.some(name=>!Object.hasOwn(manifest.sources,name)))throw new Error('Compiled native source inventory incomplete');
  for(const [name,digest]of Object.entries(manifest.sources))if(!/^[a-f0-9]{64}$/.test(digest)||sha256(localFile(binding,name))!==digest)throw new Error('Compiled native source mismatch: '+name);
  return {input,root,manifest,sha256:sha256(input),files:manifest.files.length,bytes};
}
export function prepareWindowsInputs({app,runner,input}){
  const verified=verifyWindowsInputs({runner,input}),base=path.join(app,'.nelyx/windows-native'),destination=path.join(base,verified.sha256);
  fs.mkdirSync(base,{recursive:true});if(fs.realpathSync(base)!==base)throw new Error('Native input cache symlink rejected');
  if(!fs.existsSync(destination)){
    const stage=fs.mkdtempSync(path.join(base,'.prepare-'));
    try{
      for(const record of verified.manifest.files){const target=path.join(stage,record.file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(localFile(verified.root,record.file),target);}
      fs.copyFileSync(verified.input,path.join(stage,'inputs.json'));verifyWindowsInputs({runner,input:path.join(stage,'inputs.json')});fs.renameSync(stage,destination);
    // oxlint-disable-next-line no-unsafe-finally -- Reject cleanup when directory ownership or rollback safety cannot be established.
    }finally{if(fs.existsSync(stage)){if(path.dirname(stage)!==base||!path.basename(stage).startsWith('.prepare-')||fs.lstatSync(stage).isSymbolicLink())throw Error('Native input temporary owner differs');fs.rmSync(stage,{recursive:true,force:true});}}
  }
  const prepared=verifyWindowsInputs({runner,input:path.join(destination,'inputs.json')});
  if(prepared.sha256!==verified.sha256)throw new Error('Native input cache manifest changed');
  const locator=path.join(app,'.nelyx/windows/native-inputs.json');fs.mkdirSync(path.dirname(locator),{recursive:true});fs.writeFileSync(locator,JSON.stringify({schema:'nelyx.rnw-prepared/v1',input:prepared.input,sha256:prepared.sha256},null,2)+'\n');
  return {schema:'nelyx.rnw-prepared/v1',input:prepared.input,sha256:prepared.sha256,files:prepared.files,bytes:prepared.bytes};
}
