// SPDX-License-Identifier: BSD-3-Clause
// Explicit local supply from an owned source build; no download or build on app startup.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {pathToFileURL} from 'node:url';
const skia=path.resolve(import.meta.dirname,'..'),packageRoot=path.join(skia,'packages/web'),destination=path.join(packageRoot,'generated/runtime');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),json=file=>JSON.parse(fs.readFileSync(file,'utf8'));
function sourceIdentity(manifest){
  if(manifest.status==='requires-build')throw new Error('Build the Nelyx CanvasKit runtime from the current source and supply it with prepare-web-runtime.mjs <built-runtime-directory> --adopt');
  const lockFile=path.join(skia,'eng/source-build/canvaskit.lock.json'),lock=json(lockFile);
  if(manifest.schema!=='nelyx.canvaskit/v1'||manifest.adapterAbi!==1||manifest.version!=='m153-nelyx-paragraph.1'||manifest.paragraphApiVersion!==1||manifest.source?.revision!==lock.skia.revision||manifest.source.lockSha256!==sha(fs.readFileSync(lockFile))||manifest.source.patchSha256!==lock.patch.sha256)throw new Error('Owned CanvasKit source identity mismatch');
  if(manifest.files?.length!==2||new Set(manifest.files.map(file=>file.id)).size!==2||manifest.files.some(file=>!['canvaskit.js','canvaskit.wasm'].includes(file.id)||file.path!==file.id||!/^[a-f0-9]{64}$/.test(file.sha256)))throw new Error('Invalid owned CanvasKit file list');
}
function bytesAt(root,file){const target=path.join(root,file);if(!fs.lstatSync(target).isFile()||fs.lstatSync(target).isSymbolicLink())throw new Error('Runtime supply must contain ordinary files');return fs.readFileSync(target);}
export function checkWebRuntime(){
  const manifest=json(path.join(packageRoot,'native-manifest.json'));sourceIdentity(manifest);
  if(manifest.packageRuntime!=='generated/runtime')throw new Error('Owned runtime package path missing');
  for(const file of manifest.files)if(sha(bytesAt(destination,file.path))!==file.sha256)throw new Error('Prepared Web runtime differs from the package manifest: '+file.id);
  const supplied=json(path.join(destination,'native-manifest.json'));sourceIdentity(supplied);
  if(JSON.stringify(supplied.files)!==JSON.stringify(manifest.files))throw new Error('Prepared runtime manifest differs');
  if(json(path.join(destination,'package.json')).type!=='commonjs'||!bytesAt(destination,'LICENSE_SKIA').length)throw new Error('Prepared runtime metadata missing');
  return {status:'PASS',version:manifest.version,directory:destination,files:manifest.files};
}
export function prepareWebRuntime(input,{adopt=false}={}){
  const source=fs.realpathSync(input),manifest=json(path.join(source,'native-manifest.json'));sourceIdentity(manifest);
  const receipt=json(path.join(source,'nelyx-build.json'));
  if(receipt.status!=='PASS-build'||JSON.stringify(receipt.manifest)!==JSON.stringify(manifest)||receipt.recipeSha256!==sha(fs.readFileSync(path.join(skia,'eng/source-build/build-canvaskit.py'))))throw new Error('Current owned source-build receipt required');
  const captured=new Map();for(const file of manifest.files){const bytes=bytesAt(source,file.path);if(sha(bytes)!==file.sha256)throw new Error('Owned runtime hash mismatch: '+file.id);captured.set(file.path,bytes);}
  for(const name of ['LICENSE_SKIA','nelyx-build.json','native-manifest.json'])captured.set(name,bytesAt(source,name));
  captured.set('package.json',Buffer.from('{"private":true,"type":"commonjs"}\n'));
  const next={...manifest,packageRuntime:'generated/runtime',noticeQualification:'PARTIAL'},manifestFile=path.join(packageRoot,'native-manifest.json');
  if(!adopt&&JSON.stringify(json(manifestFile))!==JSON.stringify(next))throw new Error('New runtime identity requires explicit --adopt during source preparation');
  for(let folder=destination;folder!==packageRoot;folder=path.dirname(folder))if(fs.existsSync(folder)&&(!fs.lstatSync(folder).isDirectory()||fs.lstatSync(folder).isSymbolicLink()))throw new Error('Runtime output directory is not owned');
  fs.mkdirSync(destination,{recursive:true});
  for(const name of fs.readdirSync(destination))if(!captured.has(name))throw new Error('Unexpected runtime output retained: '+name);
  for(const [name,bytes]of captured){const target=path.join(destination,name);if(fs.existsSync(target)&&(!fs.lstatSync(target).isFile()||fs.lstatSync(target).isSymbolicLink()))throw new Error('Unexpected runtime output file');fs.writeFileSync(target,bytes);}
  fs.writeFileSync(manifestFile,JSON.stringify(next,null,2)+'\n');return checkWebRuntime();
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){const args=process.argv.slice(2);if(args.length===1&&args[0]==='--check')console.log(JSON.stringify(checkWebRuntime()));else if(args.length===1||args.length===2&&args[1]==='--adopt')console.log(JSON.stringify(prepareWebRuntime(args[0],{adopt:args[1]==='--adopt'})));else throw new Error('Usage: prepare-web-runtime.mjs <owned-runtime-directory> [--adopt], or --check');}
