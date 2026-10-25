// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';import {createHash} from 'node:crypto';
import {execute} from './commands.mjs';
import {sha256,fileTree} from './files.mjs';
import {windowsCompilerEnvironment} from './windows-static-hermes.mjs';
import {prepareNativeHermes} from './windows-native-hermes-toolchain.mjs';
import {openNativeBuildCache} from './native-build-cache.mjs';
const timeout=1_200_000,load=createRequire(import.meta.url);
function sourceDigest(sdk,skia){const sources=[];for(const [owner,base,folders]of [['sdk',sdk,['native/windows-hermes','native/windows']],['skia',skia,['cpp','generated/core','generated/gpu','generated/vulkan','generated/host','native/vulkan','native/windows']]])for(const folder of folders)for(const relative of fileTree(path.join(base,folder)))sources.push({path:owner+'/'+folder+'/'+relative,sha256:sha256(path.join(base,folder,relative))});return createHash('sha256').update(JSON.stringify(sources)).digest('hex');}
export function nativePackageEnvironment(app){
  let consumer,runner;for(const candidate of [path.join(app,'windows/runner'),app]){if(!fs.existsSync(path.join(candidate,'package.json')))continue;try{const value=createRequire(path.join(candidate,'package.json'));value.resolve('@nelyx/sdk/version');value.resolve('@nelyx/skia-rn/renderer');consumer=value;runner=candidate;break;}catch{}}
  if(!consumer)throw Error('Install the SDK and Skia native dependencies in the application or Windows runner');
  const roots={};
  for(const [name,entry]of Object.entries({core:'version',sdk:'version','skia-rn':'renderer',material:'icon-assets',cupertino:'icon-assets'})){
    try{let folder=path.dirname(consumer.resolve('@nelyx/'+name+'/'+entry));for(;;){const file=path.join(folder,'package.json');if(fs.existsSync(file)&&JSON.parse(fs.readFileSync(file,'utf8')).name==='@nelyx/'+name){roots['@nelyx/'+name]=fs.realpathSync(folder);break;}const parent=path.dirname(folder);if(parent===folder)throw Error('Missing package owner');folder=parent;}}
    catch{if(['core','sdk','skia-rn'].includes(name))throw Error('Install the native Hermes SDK dependencies: @nelyx/'+name);}
  }
  return {roots,runner};
}
export function nativePackageRoots(app){return nativePackageEnvironment(app).roots;}
/** Accept the pinned third-party Skia libraries as inputs, then compile the
 * binding against direct Hermes JSI. An RNW binding archive is never linked. */
export function verifyNativeSkiaInputs(input,skia){
  if(!input)throw Error('Native Hermes requires --native-inputs <Skia supplier manifest>');input=fs.realpathSync(input);const directory=path.dirname(input),manifest=JSON.parse(fs.readFileSync(input,'utf8'));
  const lock=JSON.parse(fs.readFileSync(path.join(skia,'native/vulkan/sdk/vendor/windows-rn-supplier.lock.json'),'utf8'));
  if(!Array.isArray(manifest.files)||!Array.isArray(manifest.libraries)||manifest.architecture!=='x64'||manifest.configuration!=='Release'||manifest.crt!=='MD'||manifest.jsi!==21)throw Error('Pinned x64 Release/MD Skia supplier required');
  const resolve=name=>{if(!name||path.isAbsolute(name)||name.includes('\\')||name.split('/').some(part=>!part||part==='..'||part==='.')||name.includes(':'))throw Error('Invalid native supplier path');let file=path.join(directory,name);if(!fs.existsSync(file)&&name.includes('nelyx_rn_module'))file=path.join(directory,name.replace('nelyx_rn_module','ozeli_rn_module'));if(!fs.statSync(file).isFile()||fs.lstatSync(file).isSymbolicLink())throw Error('Invalid native supplier file');return file;};
  for(const record of lock.files){const file=resolve(record.file);if(fs.statSync(file).size!==record.bytes||sha256(file)!==record.sha256)throw Error('Native Skia supplier hash differs: '+record.file);}
  return {directory,input,sha256:sha256(input),headers:path.join(directory,lock.headers),icu:resolve(lock.icu),libraries:lock.libraries.map(resolve)};
}
export async function buildNativeHost({app,engineInputs,nativeInputs,output,signal}={}){
  app=fs.realpathSync(app);const roots=nativePackageRoots(app),skia=roots['@nelyx/skia-rn'],sdk=roots['@nelyx/sdk'];
  const checked=await prepareNativeHermes({directory:engineInputs??path.join(app,'.nelyx/native-windows/toolchain'),signal});
  const inputs=verifyNativeSkiaInputs(nativeInputs,skia),env=windowsCompilerEnvironment(),build=path.resolve(output??path.join(app,'.nelyx/native-windows/host'));
  fs.mkdirSync(build,{recursive:true});if(fs.realpathSync(build)!==build)throw Error('Native host build directory must be owned');
  const lock=openNativeBuildCache(path.join(build,'owner')),sourceSha256=sourceDigest(sdk,skia);
  try{
  const configuration=path.join(build,'skia-inputs.cmake');fs.writeFileSync(configuration,'set(NELYX_SKIA_LIBRARIES\n'+inputs.libraries.map(file=>'  "'+file.replaceAll('\\','/')+'"').join('\n')+'\n)\n');
  const source=path.join(sdk,'native/windows-hermes'),cache=path.join(build,'CMakeCache.txt');
  const previousSource=fs.existsSync(cache)?fs.readFileSync(cache,'utf8').match(/^CMAKE_HOME_DIRECTORY:INTERNAL=(.+)$/m)?.[1].trim():null;
  const fresh=previousSource&&path.resolve(previousSource)!==source;
  await execute('cmake',[...(fresh?['--fresh']:[]),'-S',source,'-B',build,'-G','Ninja','-DCMAKE_BUILD_TYPE=Release','-DNELYX_HOST_TEST_SOURCE=',`-DNELYX_HERMES_ROOT=${checked.directory}`,`-DNELYX_SKIA_PACKAGE=${skia}`,`-DNELYX_SKIA_SUPPLIER=${inputs.directory}`,`-DNELYX_SKIA_INPUTS_CMAKE=${configuration}`],{cwd:app,env,signal,timeout});
  await execute('cmake',['--build',build,'--parallel','2'],{cwd:app,env,signal,timeout});
  if(sourceDigest(sdk,skia)!==sourceSha256)throw Error('Native host sources changed during compilation');
  const manifest={schema:'nelyx.native-hermes-host/v1',sourceSha256,toolchainSha256:checked.sha256,nativeInputsSha256:inputs.sha256,configuration:'Release',architecture:'x64',crt:'MD',jsi:21,host:'native-hermes',files:['NelyxHermesHost.exe','hermesvm.dll'].map(name=>({path:name,sha256:sha256(path.join(build,name))}))};
  fs.writeFileSync(path.join(build,'native-host.json'),JSON.stringify(manifest,null,2)+'\n');
  return {directory:build,executable:path.join(build,'NelyxHermesHost.exe'),toolchain:checked.directory,supplier:inputs.directory,inputs,manifest,roots};
  }finally{lock.close();}
}
