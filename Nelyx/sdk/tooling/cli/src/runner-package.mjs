// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';import path from 'node:path';import {createHash,randomUUID} from 'node:crypto';
import {createProviderRegistry} from '@nelyx/sdk/runtime/providers';
import {sha256,relativeFile,localFile} from './files.mjs';import {capture} from './commands.mjs';
const manifestName='nelyx-package.json',digest=value=>createHash('sha256').update(value).digest('hex');
const within=(file,root)=>{const rest=path.relative(root,file);return !rest.startsWith('..')&&!path.isAbsolute(rest);};
const targets=new Set(['android','ios','macos','web']);
function inspect(root,allowLinks){
  root=path.resolve(root);if(fs.lstatSync(root).isSymbolicLink())throw new Error('Package root symlink rejected');const records=[],seen=new Set();let bytes=0;
  function visit(directory,prefix=''){
    for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
      const name=relativeFile(prefix+entry.name),file=path.join(directory,entry.name);if(name===manifestName)continue;
      const key=name.toLowerCase();if(seen.has(key))throw new Error('Case-colliding package paths');seen.add(key);
      if(entry.isSymbolicLink()){
        const link=fs.readlinkSync(file);if(!allowLinks||path.isAbsolute(link)||/[\x00-\x1f]/.test(link)||!within(fs.realpathSync(file),root))throw new Error('Foreign or invalid package symlink');
        records.push({path:name,type:'symlink',link,bytes:Buffer.byteLength(link),sha256:digest(link)});
      }else if(entry.isDirectory())visit(file,name+'/');
      else if(entry.isFile()){const size=fs.statSync(file).size;bytes+=size;records.push({path:name,type:'file',bytes:size,sha256:sha256(file)});}
      else throw new Error('Non-regular package entry');
      if(records.length>4096||bytes>2*1024*1024*1024)throw new Error('Package inventory budget exceeded');
    }
  }
  visit(root);return records.sort((a,b)=>a.path<b.path?-1:1);
}
export function publishRunnerPackage({directory,target,application,entry,configuration='Release',details={}}){
  if(!targets.has(target)||fs.existsSync(path.join(directory,manifestName)))throw new Error('Fresh runner package manifest required');
  const files=inspect(directory,target==='ios'||target==='macos');if(!files.length)throw new Error('Empty runner package');
  const manifest={schema:'nelyx.runner-package/v1',target,app:application.config.name,profile:application.profile.id,cohort:application.cohort,entry:relativeFile(entry),configuration,details,files,qualification:'notVerified'};
  fs.writeFileSync(path.join(directory,manifestName),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});return verifyRunnerPackage(directory,target);
}
export function verifyRunnerPackage(directory,target){
  directory=path.resolve(directory);const manifest=JSON.parse(fs.readFileSync(localFile(directory,manifestName),'utf8'));
  if(manifest.schema!=='nelyx.runner-package/v1'||!targets.has(target)||manifest.target!==target||!(/^[A-Z][A-Za-z0-9]*$/).test(manifest.app)||manifest.configuration!=='Release'||manifest.qualification!=='notVerified')throw new Error('Invalid target runner package');
  const registry=createProviderRegistry(),profile=registry.profile(target,manifest.profile),cohort=registry.cohort(target,{cohort:manifest.cohort?.id},profile.id);
  if(profile.status!=='implemented'||JSON.stringify(cohort)!==JSON.stringify(manifest.cohort))throw new Error('Package profile/cohort mismatch');
  relativeFile(manifest.entry);const actual=inspect(directory,target==='ios'||target==='macos');
  if(!Array.isArray(manifest.files)||!manifest.files.length||JSON.stringify(actual)!==JSON.stringify(manifest.files))throw new Error('Package inventory hash/size/link mismatch');
  if(target==='android'&&(!manifest.entry.endsWith('.apk')||!actual.some(file=>file.path===manifest.entry&&file.type==='file')))throw new Error('Android package APK missing');
  if(target==='web'&&(manifest.entry!=='index.html'||!['index.html','application.js','application.js.map','runtime/canvaskit.js','runtime/canvaskit.wasm','runtime/native-manifest.json'].every(name=>actual.some(file=>file.path===name&&file.type==='file'))))throw new Error('Incomplete static Web package');
  if((target==='ios'||target==='macos')&&(!manifest.entry.endsWith('.app')||!actual.some(file=>file.path.startsWith(manifest.entry+'/'))))throw new Error('Apple application bundle missing');
  return {directory,manifest,files:actual.length,bytes:actual.reduce((sum,file)=>sum+file.bytes,0)};
}
export function freshPackageDirectory(app,target,output){
  const directory=path.resolve(output??path.join(app,'.nelyx',target,'packages',Date.now()+'-'+randomUUID()));
  if(fs.existsSync(directory))throw new Error('Build requires a new package directory');fs.mkdirSync(directory,{recursive:true});return directory;
}
export function copyRunnerNotices(application,directory){
  const destination=path.join(directory,'licenses');fs.mkdirSync(destination,{recursive:true});
  application.load('@nelyx/metro/assets').copyAppNotices(application.app,application.config.assets,path.join(destination,'app-assets'));
  for(const [name,packageName]of [['core','@nelyx/core'],['sdk','@nelyx/sdk'],['skia-rn','@nelyx/skia-rn'],['react-native','react-native'],...(application.cohort.framework==='react-native-macos'?[['react-native-macos','react-native-macos']]:[])]){
    const source=path.join(application.runner,'node_modules',packageName);let found=false;
    for(const file of ['LICENSE.md','LICENSE','THIRD_PARTY_NOTICES.md'])if(fs.existsSync(path.join(source,file))){fs.copyFileSync(localFile(source,file),path.join(destination,name+'-'+file));if(file.startsWith('LICENSE'))found=true;}
    if(!found)throw new Error('Installed runtime license absent: '+packageName);
    if(fs.existsSync(path.join(source,'licenses')))fs.cpSync(path.join(source,'licenses'),path.join(destination,name),{recursive:true,dereference:false});
  }
}
export function rememberPackage(app,target,directory){
  const root=path.join(app,'.nelyx',target);fs.mkdirSync(root,{recursive:true});fs.writeFileSync(path.join(root,'last-package.json'),JSON.stringify({schema:'nelyx.runner-package-locator/v1',target,directory,sha256:sha256(path.join(directory,manifestName))},null,2)+'\n');
}
export function packageFor(app,target,directory){
  if(!directory){const value=JSON.parse(fs.readFileSync(path.join(path.resolve(app),'.nelyx',target,'last-package.json'),'utf8'));if(value.schema!=='nelyx.runner-package-locator/v1'||value.target!==target||value.sha256!==sha256(localFile(value.directory,manifestName)))throw new Error('Prepared package locator changed');directory=value.directory;}
  return verifyRunnerPackage(directory,target);
}
export function packRunner({app,target,directory,output}){
  const verified=packageFor(app,target,directory),apple=target==='ios'||target==='macos';
  if(apple&&process.platform!=='darwin')throw new Error('Apple .app archive requires macOS ditto to preserve framework links');
  output=path.resolve(output??path.join(path.resolve(app),'.nelyx',target,'archives',verified.manifest.app+'-'+Date.now()+(apple?'.app.zip':'.tar.gz')));
  if(fs.existsSync(output)||within(output,verified.directory)||!output.endsWith(apple?'.app.zip':'.tar.gz'))throw new Error('Pack requires a new archive outside its input');
  const parent=path.join(path.resolve(app),'.nelyx',target,'pack-staging');fs.mkdirSync(parent,{recursive:true});const stage=fs.mkdtempSync(path.join(parent,'pack-'));
  const payload=apple?path.join(stage,verified.manifest.app+'-'+target):stage;
  fs.cpSync(verified.directory,payload,{recursive:true,verbatimSymlinks:true});verifyRunnerPackage(payload,target);fs.mkdirSync(path.dirname(output),{recursive:true});
  const temporary=output+'.'+randomUUID()+'.pending';fs.closeSync(fs.openSync(temporary,'wx'));
  if(apple)capture('/usr/bin/ditto',['-c','-k','--keepParent',payload,temporary],{timeout:180000});else capture('tar',['-czf',temporary,'-C',payload,'.'],{timeout:180000});
  fs.linkSync(temporary,output);fs.unlinkSync(temporary);
  return {schema:'nelyx.pack/v3',target,file:output,sha256:sha256(output),files:verified.files,qualification:'notVerified'};
}
