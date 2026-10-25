// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createProviderRegistry} from '@nelyx/sdk/runtime/providers';
import {readApplication,configureWindowsApplication} from './application.mjs';
import {verifyWindowsInputs,prepareWindowsInputs} from './native-inputs.mjs';
import {fileTree,localFile,sha256,verifyInventory} from './files.mjs';
import {execute} from './commands.mjs';
import {startWindowsProcess,verifyWindowsRuntime} from './windows-process.mjs';
import {prepareWindowsV8,verifyWindowsV8} from './windows-v8.mjs';
import {prepareWindowsJsc,verifyWindowsJsc,windowsJscMode} from './windows-jsc.mjs';
import nativeJscTransformer from '@nelyx/metro/native-jsc-transformer';
import {prepareWindowsStaticHermes,verifyWindowsStaticHermes} from './windows-static-hermes.mjs';
import {readStaticHermesLocator} from './windows-static-hermes-locator.mjs';
import {verifyStaticAotApplication} from './windows-static-aot.mjs';
import {writePortableMetroMap,verifyPortableMetroMap} from './portable-metro-map.mjs';
import {copyRunnerNotices} from './runner-package.mjs';
import {assertWindowsPackageReplaceable,publishWindowsPackage,pruneWindowsPackages} from './windows-package-lifecycle.mjs';
import {windowsHermesPolicy} from './windows-hermes-policy.mjs';
import nativeV8Transformer from '@nelyx/metro/native-v8-transformer';
import {windowsHermesExecutionMode} from './windows-aot-mode.mjs';

const packageManifest='nelyx-package.json';
// Compiler profiles belong to the exact supplier and travel with the package.
function host(){if(process.platform!=='win32'||process.arch!=='x64')throw new Error('Windows RNW native operation requires a Windows x64 host');}
function state(app,name){return path.join(app,'.nelyx/windows',name);}
async function application(app){
  const value=await readApplication(app);if(!['rn-graphite-vulkan','rn-v8-graphite-vulkan','rn-jsc-graphite-vulkan'].includes(value.profile.id)||value.profile.status!=='implemented')throw new Error('Implemented Windows RN profile required');
  value.load('@nelyx/metro/runner-config').inspectRunnerCohort({target:'windows',runnerRoot:value.runner,appRoot:value.app});return value;
}
function selectEngine(value,engine){
  engine??=value.cohort.engine;if(!['hermes','v8','jsc'].includes(engine))throw Error('Choose Windows --engine hermes, v8 or jsc');
  const registry=createProviderRegistry(),profile=registry.profile('windows',engine==='jsc'?'rn-jsc-graphite-vulkan':engine==='v8'?'rn-v8-graphite-vulkan':'rn-graphite-vulkan');
  return {...value,profile,cohort:registry.cohort('windows',{},profile.id)};
}
function v8For(app,input){
  if(input)return verifyWindowsV8(path.resolve(input));
  const locator=JSON.parse(fs.readFileSync(state(app,'v8-inputs.json'),'utf8')),checked=verifyWindowsV8(locator.directory);
  if(locator.schema!=='nelyx.windows-v8-locator/v1'||locator.sha256!==checked.sha256)throw Error('Prepared V8 supplier locator changed');return checked;
}
function jscFor(app,input){
  if(input)return verifyWindowsJsc(path.resolve(input));
  const locator=JSON.parse(fs.readFileSync(state(app,'jsc-inputs.json'),'utf8')),checked=verifyWindowsJsc(locator.directory);
  if(locator.schema!=='nelyx.windows-jsc-locator/v1'||locator.sha256!==checked.sha256)throw Error('Prepared JSC supplier locator changed');return checked;
}
function staticHermesFor(app,input){
  if(input)return verifyWindowsStaticHermes(path.resolve(input));
  const locator=readStaticHermesLocator(state(app,'static-hermes-inputs.json')),checked=verifyWindowsStaticHermes(locator.directory);
  if(locator.schema!=='nelyx.windows-static-hermes-locator/v1'||locator.sha256!==checked.sha256)throw Error('Prepared Static Hermes supplier locator changed');return checked;
}
function isStaticHermes(mode,engine,configuration='Release'){
  windowsHermesExecutionMode(mode);
  if(mode!=='bytecode'&&(engine!=='hermes'||configuration!=='Release'))throw Error('Static Hermes requires --engine hermes and Release');
  return mode!=='bytecode';
}
function inputFor(app,input){
  if(input)return path.resolve(input);const locator=state(app,'native-inputs.json');
  if(fs.existsSync(locator)){const value=JSON.parse(fs.readFileSync(locator,'utf8'));if(value.schema!=='nelyx.rnw-prepared/v1'||sha256(value.input)!==value.sha256)throw new Error('Prepared native input locator changed');return value.input;}
  return path.join(app,'.nelyx/windows-native/inputs.json');
}
export async function doctorWindows({app}){
  const value=await application(app),native=inputFor(value.app);
  let inputs;try{inputs=verifyWindowsInputs({runner:value.runner,input:native});}catch(error){inputs={result:'notVerified',reason:String(error)};}
  return {schema:'nelyx.doctor/v2',target:'windows',profile:value.profile.id,identity:value.profile.identity,implementation:value.profile.status,qualification:value.profile.qualification,
    runner:value.runner,cohort:value.cohort,node:process.version,host:process.platform,architecture:process.arch,nativeInputs:inputs.result?inputs:{result:'PASS-scoped',sha256:inputs.sha256,files:inputs.files},
    adapters:{prepare:true,build:process.platform==='win32'&&process.arch==='x64',run:process.platform==='win32'&&process.arch==='x64',pack:process.platform==='win32',dev:value.cohort.engine==='hermes'}};
}
export async function prepareWindows({app,nativeInputs,engine,engineInputs,hermesMode='bytecode',jscMode}){
  if(jscMode!==undefined)windowsJscMode(jscMode,engine);
  isStaticHermes(hermesMode,engine??'hermes');
  host();const value=selectEngine(await application(app),engine),native=prepareWindowsInputs({app:value.app,runner:value.runner,input:inputFor(value.app,nativeInputs)});
  if(jscMode!==undefined)windowsJscMode(jscMode,value.cohort.engine);
  if(isStaticHermes(hermesMode,value.cohort.engine)){
    const reusable=!engineInputs&&readStaticHermesLocator(state(value.app,'static-hermes-inputs.json'),{allowMissing:true});
    const aot=engineInputs?verifyWindowsStaticHermes(path.resolve(engineInputs)):reusable?staticHermesFor(value.app):await prepareWindowsStaticHermes({output:state(value.app,'static-hermes-build')});
    fs.writeFileSync(state(value.app,'static-hermes-inputs.json'),JSON.stringify({schema:'nelyx.windows-static-hermes-locator/v1',directory:aot.directory,sha256:aot.sha256},null,2)+'\n');
    return {...native,engine:'hermes',hermesExecutionMode:hermesMode,engineInputs:aot.directory,engineInputsSha256:aot.sha256};
  }
  if(value.cohort.engine==='jsc'){
    const jsc=engineInputs?verifyWindowsJsc(path.resolve(engineInputs)):await prepareWindowsJsc({runner:value.runner,output:state(value.app,'jsc-build')});
    fs.writeFileSync(state(value.app,'jsc-inputs.json'),JSON.stringify({schema:'nelyx.windows-jsc-locator/v1',directory:jsc.directory,sha256:jsc.sha256},null,2)+'\n');
    return {...native,engine:'jsc',jscExecutionMode:windowsJscMode(jscMode),engineInputs:jsc.directory,engineInputsSha256:jsc.sha256};
  }
  if(value.cohort.engine!=='v8')return native;
  const v8=engineInputs?verifyWindowsV8(path.resolve(engineInputs)):await prepareWindowsV8({runner:value.runner,output:state(value.app,'v8-build')});
  fs.writeFileSync(state(value.app,'v8-inputs.json'),JSON.stringify({schema:'nelyx.windows-v8-locator/v1',directory:v8.directory,sha256:v8.sha256},null,2)+'\n');
  return {...native,engine:'v8',engineInputs:v8.directory,engineInputsSha256:v8.sha256};
}
/** Validate inventory, bundle format and the selected native engine supplier. */
export function verifyWindowsPackage(directory){
  directory=fs.realpathSync(directory);const file=localFile(directory,packageManifest),manifest=JSON.parse(fs.readFileSync(file,'utf8'));
  if(manifest.schema!=='nelyx.rnw-package/v1'||manifest.target!=='windows'||!['rn-graphite-vulkan','rn-v8-graphite-vulkan','rn-jsc-graphite-vulkan'].includes(manifest.profile)||manifest.architecture!=='x64'||!['Debug','Release'].includes(manifest.configuration)||!(/^[A-Z][A-Za-z0-9]*$/).test(manifest.app)||manifest.executable!=='NelyxRNHost.exe'||manifest.bundle!=='Bundle/index.windows.bundle'||manifest.qualification!=='notVerified'||!/^[a-f0-9]{64}$/.test(manifest.nativeInputsSha256))throw new Error('RNW package identity mismatch');
  if(manifest.nativeBindingConfiguration!=='Release'||manifest.crt!=='MD'||manifest.iteratorDebugLevel!==0)throw Error('RNW package native supplier ABI identity differs');
  const v8=manifest.cohort?.engine==='v8',jsc=manifest.cohort?.engine==='jsc',sourceEngine=v8||jsc;
  if(jsc){windowsJscMode(manifest.jscExecutionMode);if(manifest.jscCompilerPolicy!==nativeJscTransformer.compilerPolicy)throw Error('Windows package JSC compiler policy differs from its engine');}
  else if(manifest.jscExecutionMode!=null||manifest.jscCompilerPolicy!=null)throw Error('Unexpected JSC configuration for another engine');
  const packageMode=windowsHermesExecutionMode(manifest.hermesExecutionMode);
  const aot=isStaticHermes(packageMode,manifest.cohort?.engine,manifest.configuration);
  if(manifest.v8CompilerPolicy!==undefined&&manifest.v8CompilerPolicy!==(v8?nativeV8Transformer.compilerPolicy:null))throw Error('Windows package V8 compiler policy differs from its engine');
  const hermes=sourceEngine?null:windowsHermesPolicy(manifest.hermesCompilerProfile??'debug',manifest.cohort);
  if(manifest.hermesCompilerFlags!==(hermes?hermes.flags.join(' '):null)||(manifest.hermesCompilerProfile!==undefined&&manifest.hermesCompilerProfile!==(hermes?.profile??null))||(manifest.hermesCompilerPolicy!==undefined&&manifest.hermesCompilerPolicy!==(hermes?.id??null))||(hermes?.profile==='optimized'&&manifest.hermesCompilerPolicy!==hermes.id))throw Error('Windows package compiler policy differs from its engine');
  const cohort=createProviderRegistry().cohort('windows',{cohort:jsc?'rn-0.83.10-jsc':v8?'rn-0.83.10-v8':'rn-0.83.10'},manifest.profile);if(!manifest.cohort||Object.keys(manifest.cohort).length!==Object.keys(cohort).length||Object.entries(cohort).some(([name,value])=>manifest.cohort[name]!==value))throw new Error('RNW package cohort mismatch');
  const verified=verifyInventory(directory,manifest.files,[packageManifest]),names=new Set(manifest.files.map(file=>file.path));
  if(jsc&&(names.has('v8-engine.json')||names.has('v8jsi.dll'))||!jsc&&['jsc-engine.json','jsc-mode.txt','JavaScriptCore.dll'].some(name=>names.has(name)))throw Error('Unexpected JavaScript engine supplier in Windows package');
  for(const required of [manifest.executable,manifest.bundle,'Microsoft.ReactNative.dll','hermes.dll','Assets/icudtl.dat'])if(!names.has(required))throw new Error('Required RNW package file missing: '+required);
  const bytecode=fs.readFileSync(localFile(directory,manifest.bundle));
  if(v8){if(!bytecode.length||bytecode.subarray(0,8).toString('hex')==='c61fbc03c103191f')throw Error('V8 requires a JavaScript source bundle');new TextDecoder('utf-8',{fatal:true}).decode(bytecode);verifyWindowsV8(directory,{embedded:true});}
  else if(jsc){if(!bytecode.length||bytecode.subarray(0,8).toString('hex')==='c61fbc03c103191f')throw Error('JSC requires a JavaScript source bundle');new TextDecoder('utf-8',{fatal:true}).decode(bytecode);if(fs.readFileSync(localFile(directory,'jsc-mode.txt'),'utf8')!==manifest.jscExecutionMode+'\n')throw Error('JSC packaged execution mode differs');verifyWindowsJsc(directory,{embedded:true});}
  else if(!aot&&(bytecode.length<16||bytecode.subarray(0,8).toString('hex')!=='c61fbc03c103191f'||bytecode.readUInt32LE(8)!==cohort.bytecodeVersion))throw Error('Windows package requires the matching Hermes bytecode header');
  if(aot){if(hermes.profile!=='optimized')throw Error('Static Hermes requires the qualified optimizing profile');verifyStaticAotApplication(directory);}
  else if(names.has('static-aot-app.json')||names.has('NelyxApp.aot.dll'))throw Error('Unexpected Static Hermes application in a bytecode/source package');
  const sourceMap=verifyPortableMetroMap({directory,records:manifest.files,bundle:aot?'Bundle/index.windows.aot.js':manifest.bundle,mapPath:'sourcemaps/react/index.windows.bundle.map'});
  return {directory,manifest,...verified,sourceMap};
}
export async function buildWindows({app,nativeInputs,output,configuration='Release',signal,engine,engineInputs,hermesProfile,hermesMode='bytecode',jscMode}){
  const explicitHermesProfile=hermesProfile;
  if(jscMode!==undefined)windowsJscMode(jscMode,engine);
  if(engine==='jsc'&&hermesProfile!==undefined)throw Error('--hermes-profile requires --engine hermes');
  signal?.throwIfAborted();if(!['Debug','Release'].includes(configuration))throw Error('Choose Debug or Release');
  isStaticHermes(hermesMode,engine??'hermes',configuration);hermesProfile??=configuration==='Release'?'optimized':'debug';
  if(!['debug','optimized'].includes(hermesProfile))throw Error('Choose Windows --hermes-profile debug or optimized');
  host();const value=selectEngine(await application(app),engine),native=verifyWindowsInputs({runner:value.runner,input:inputFor(value.app,nativeInputs)}),v8=value.cohort.engine==='v8'?v8For(value.app,engineInputs):undefined;
  if(jscMode!==undefined)windowsJscMode(jscMode,value.cohort.engine);
  if(value.cohort.engine==='jsc'&&explicitHermesProfile!==undefined)throw Error('--hermes-profile requires --engine hermes');
  const jsc=value.cohort.engine==='jsc'?jscFor(value.app,engineInputs):undefined,jscExecutionMode=jsc?windowsJscMode(jscMode):null;
  const aot=isStaticHermes(hermesMode,value.cohort.engine,configuration)?staticHermesFor(value.app,engineInputs):undefined;
  if(aot&&hermesProfile!=='optimized')throw Error('Static Hermes requires --hermes-profile optimized');
  const hermes=v8||jsc?null:windowsHermesPolicy(hermesProfile,value.cohort),hermesCompilerFlags=hermes?.flags.join(' ')??null;
  const source=path.join(value.app,'windows/x64',configuration),directory=path.resolve(output??state(value.app,'packages/'+configuration));
  if(fs.existsSync(directory)){
    if(output)throw new Error('Custom RNW package output must be a new directory');
    assertWindowsPackageReplaceable({app:value.app,appName:value.config.name,directory});
  }
  const contains=(parent,child)=>{const rest=path.relative(parent,child);return !rest.startsWith('..')&&!path.isAbsolute(rest);};
  if(contains(directory,source)||contains(source,directory))throw new Error('Package output must be separate from native build output');
  fs.mkdirSync(path.dirname(directory),{recursive:true});if(fs.realpathSync(path.dirname(directory))!==path.dirname(directory))throw new Error('Package output parent symlink rejected');
  configureWindowsApplication(value);await execute(process.execPath,[localFile(value.runner,'build.mjs'),'--native-inputs',native.input,'--configuration',configuration,'--engine',value.cohort.engine,...(jsc?['--engine-inputs',jsc.directory,'--jsc-mode',jscExecutionMode]:v8?['--engine-inputs',v8.directory]:['--hermes-profile',hermes.profile]),...(aot?['--hermes-mode',hermesMode,'--engine-inputs',aot.directory]:[])],{cwd:value.runner,signal});signal?.throwIfAborted();
  const built=JSON.parse(fs.readFileSync(state(value.app,'last-build.json'),'utf8'));
  if(built.schema!=='nelyx.rnw-build/v1'||built.configuration!==configuration||built.output!==source||built.executable!==path.join(source,'NelyxRNHost.exe')||built.nativeInputsSha256!==native.sha256||sha256(built.executable)!==built.exeSha256)throw new Error('RNW build acknowledgement mismatch');
  const legacyCompiler=built.hermesCompilerProfile===undefined&&built.hermesCompilerPolicy===undefined&&(v8||hermes?.profile==='debug');
  if(built.hermesCompilerFlags!==hermesCompilerFlags||!legacyCompiler&&(built.hermesCompilerProfile!==(hermes?.profile??null)||built.hermesCompilerPolicy!==(hermes?.id??null))||built.engine!==value.cohort.engine||v8&&(built.engineInputsSha256!==v8.sha256||built.v8CompilerPolicy!==nativeV8Transformer.compilerPolicy)||!v8&&built.v8CompilerPolicy!==undefined&&built.v8CompilerPolicy!==null)throw Error('Windows runner engine/compiler acknowledgement differs; update build.mjs from the current template');
  if((built.hermesExecutionMode??'bytecode')!==hermesMode||aot&&built.engineInputsSha256!==aot.sha256)throw Error('Windows Static Hermes build acknowledgement differs');
  if(jsc&&(built.engineInputsSha256!==jsc.sha256||built.jscExecutionMode!==jscExecutionMode||built.jscCompilerPolicy!==nativeJscTransformer.compilerPolicy)||!jsc&&(built.jscExecutionMode!=null||built.jscCompilerPolicy!=null))throw Error('Windows JSC build acknowledgement differs');
  const verified=publishWindowsPackage({app:value.app,appName:value.config.name,directory,replace:!output,prepare(stage){
    const records=[];
    for(const name of fileTree(source)){
      if(!name.startsWith('licenses/')&&/\.(obj|pch|tlog|lib|exp|ilk|lastbuildstate)$/i.test(name))continue;
      if(['sourcemaps/react/index.windows.bundle.compiler.map','sourcemaps/react/index.windows.bundle.packager.map'].includes(name))continue;
      const input=localFile(source,name),target=path.join(stage,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(input,target);
    }
    copyRunnerNotices(value,stage);
    writePortableMetroMap({app:value.app,runner:value.runner,directory:stage,bundle:aot?'Bundle/index.windows.aot.js':'Bundle/index.windows.bundle',mapPath:'sourcemaps/react/index.windows.bundle.map'});
    for(const name of fileTree(stage)){const file=localFile(stage,name);records.push({path:name,bytes:fs.statSync(file).size,sha256:sha256(file)});}
    const manifest={schema:'nelyx.rnw-package/v1',target:'windows',profile:value.profile.id,architecture:'x64',configuration,nativeBindingConfiguration:'Release',crt:'MD',iteratorDebugLevel:0,app:value.config.name,cohort:value.cohort,
      executable:'NelyxRNHost.exe',bundle:'Bundle/index.windows.bundle',hermesCompilerFlags,hermesCompilerProfile:hermes?.profile??null,hermesCompilerPolicy:hermes?.id??null,hermesExecutionMode:hermesMode,v8CompilerPolicy:v8?nativeV8Transformer.compilerPolicy:null,jscExecutionMode,jscCompilerPolicy:jsc?nativeJscTransformer.compilerPolicy:null,nativeInputsSha256:native.sha256,qualification:'notVerified',files:records};
    fs.writeFileSync(path.join(stage,packageManifest),JSON.stringify(manifest,null,2)+'\n');
  },verify(candidate){signal?.throwIfAborted();const checked=verifyWindowsPackage(candidate);verifyWindowsRuntime(candidate);return checked;}});
  const cleanup=pruneWindowsPackages({app:value.app,appName:value.config.name,current:directory});
  cleanup.removed.unshift(...verified.cleanup.removed);cleanup.retained.unshift(...verified.cleanup.retained);
  return {schema:'nelyx.build/v2',target:'windows',profile:value.profile.id,directory,files:verified.files,bytes:verified.bytes,exeSha256:sha256(path.join(directory,verified.manifest.executable)),qualification:'notVerified',cleanup};
}
function packageFor(app,directory){
  if(directory)return verifyWindowsPackage(path.resolve(directory));
  const locator=JSON.parse(fs.readFileSync(state(path.resolve(app),'last-package.json'),'utf8'));
  if(locator.schema!=='nelyx.rnw-package-locator/v1'||sha256(path.join(locator.directory,packageManifest))!==locator.manifestSha256)throw new Error('RNW package locator changed');
  return verifyWindowsPackage(locator.directory);
}
export async function runWindows({app,directory,arguments:args=[]}){
  host();const verified=packageFor(app,directory),executable=localFile(verified.directory,verified.manifest.executable);
  verifyWindowsRuntime(verified.directory);
  const child=startWindowsProcess(executable,args,{cwd:verified.directory});process.stderr.write(JSON.stringify({event:'nelyx.native-started',pid:child.pid,executable})+'\n');
  const close=()=>{void child.stop();};process.on('SIGINT',close);process.on('SIGTERM',close);
  try{const result=await child.completed;if(result.error)throw Error(result.error);return {schema:'nelyx.run/v2',target:'windows',exitCode:result.forced?1:result.exitCode??1};}
  finally{process.off('SIGINT',close);process.off('SIGTERM',close);}
}
export async function packWindows({app,directory,output}){
  host();const verified=packageFor(app,directory);output=path.resolve(output??state(path.resolve(app),'packages/'+verified.manifest.app+'-'+Date.now()+'.zip'));
  verifyWindowsRuntime(verified.directory);
  if(!output.toLowerCase().endsWith('.zip')||fs.existsSync(output))throw new Error('Pack requires a new zip output');
  const rest=path.relative(verified.directory,output);if(!rest.startsWith('..')&&!path.isAbsolute(rest))throw new Error('Zip output must be outside the package directory');
  fs.mkdirSync(path.dirname(output),{recursive:true});const work=state(path.resolve(app),'pack-staging');fs.mkdirSync(work,{recursive:true});
  if(fs.realpathSync(work)!==work)throw Error('Pack staging parent symlink rejected');
  const owner=fs.mkdtempSync(path.join(work,'pack-')),archive=path.join(owner,'package.zip');
  try{
    const script="$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory($env:NELYX_RNW_PACKAGE,$env:NELYX_RNW_ZIP)";
    const result=spawnSync('powershell.exe',['-NoProfile','-Command',script],{env:{...process.env,NELYX_RNW_PACKAGE:verified.directory,NELYX_RNW_ZIP:archive},windowsHide:true,encoding:'utf8',timeout:180000});
    if(result.error||result.status)throw new Error(String(result.error??result.stderr));
    verifyWindowsPackage(verified.directory);
    fs.copyFileSync(archive,output,fs.constants.COPYFILE_EXCL);
    return {schema:'nelyx.pack/v2',target:'windows',file:output,sha256:sha256(output),files:verified.files,qualification:'notVerified'};
  }finally{
    if(path.dirname(owner)!==work||!path.basename(owner).startsWith('pack-')||fs.lstatSync(owner).isSymbolicLink())throw Error('Unexpected pack temporary owner');
    fs.rmSync(owner,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  }
}
