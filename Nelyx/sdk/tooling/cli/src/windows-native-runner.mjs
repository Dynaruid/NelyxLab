// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {buildNativeHost,nativePackageRoots,nativePackageEnvironment,verifyNativeSkiaInputs} from './windows-native-host.mjs';
import {verifyNativeHermes,prepareNativeHermes} from './windows-native-hermes-toolchain.mjs';
import {sha256 as hash,fileTree,verifyInventory,localFile} from './files.mjs';
import {defineConfig} from '@nelyx/sdk/runtime/config';
import {startWindowsProcess} from './windows-process.mjs';
import {buildNativeAot,verifyNativeAot} from './windows-native-aot.mjs';
const timeout=1_200_000;
function commonRoot(paths){let root=fs.realpathSync(paths[0]);while(paths.some(file=>{const relative=path.relative(root,fs.realpathSync(file));return relative.startsWith('..')||path.isAbsolute(relative);})){const parent=path.dirname(root);if(parent===root)throw Error('Native packages must share a filesystem root');root=parent;}return root;}
import {execute} from './commands.mjs';
import {windowsCompilerEnvironment} from './windows-static-hermes.mjs';
import {windowsHermesPolicy} from './windows-hermes-policy.mjs';
import {nativeCohort} from '@nelyx/sdk/runtime/cohorts';
import {openNativeBuildCache} from './native-build-cache.mjs';
const load=createRequire(import.meta.url);
const {getDefaultConfig,mergeConfig}=load('metro-config');
const inside=(parent,file)=>{const relative=path.relative(parent,file);return relative!==''&&!relative.startsWith('..')&&!path.isAbsolute(relative);};
export async function buildNativeApplication({app,mode,hermesMode,signal,engineInputs,nativeInputs,hostBuild,output,diagnosticEntry,cacheDirectory}={}){
  if(mode&&hermesMode&&mode!==hermesMode)throw Error('Conflicting native Hermes modes');mode??=hermesMode??'bytecode';
  if(!['bytecode','static-aot'].includes(mode))throw Error('Choose --hermes-mode bytecode or static-aot');
  if(diagnosticEntry&&!output)throw Error('A diagnostic entry requires an explicit temporary output');
  app=fs.realpathSync(app);const config=defineConfig(JSON.parse(fs.readFileSync(path.join(app,'package.json'),'utf8')).nelyx);
  const diagnostic=diagnosticEntry?fs.realpathSync(diagnosticEntry):null;
  if(diagnostic&&(!inside(app,diagnostic)||!fs.statSync(diagnostic).isFile()))throw Error('A diagnostic entry must be an owned file inside the application');
  if(diagnostic){const parent=path.join(app,'.nelyx/native-windows'),destination=path.resolve(output);if(!inside(parent,destination)||path.dirname(destination)===parent&&path.basename(destination).startsWith('current-'))throw Error('A diagnostic output must be a separate temporary package inside native-windows');}
  const {roots,runner}=nativePackageEnvironment(app),root=commonRoot([app,...Object.values(roots)]);
  const host=hostBuild??await buildNativeHost({app,engineInputs,nativeInputs,signal});
  const checked=verifyNativeHermes(host.toolchain),env=windowsCompilerEnvironment();
  const parent=path.join(app,'.nelyx/native-windows');fs.mkdirSync(parent,{recursive:true});
  if(fs.realpathSync(parent)!==parent)throw Error('Native package parent must be a real directory');
  const packageOwner=openNativeBuildCache(path.join(parent,'build-'+mode));
  let stage;const directory=path.resolve(output??path.join(parent,'current-'+mode));
  try{
    const currentStage=path.join(parent,'.build-'+mode);if(fs.existsSync(currentStage))throw Error('Unfinished native build stage requires recovery: '+currentStage);fs.mkdirSync(currentStage);stage=currentStage;
    if(fs.existsSync(directory))assertReplaceable(directory);
    for(const name of ['NelyxHermesHost.exe','hermesvm.dll','native-host.json'])fs.copyFileSync(path.join(host.directory,name),path.join(stage,name));
    fs.mkdirSync(path.join(stage,'Assets'));
    const assets=config.assets.map(asset=>{
      const source=path.resolve(app,asset.path);if(!inside(app,source)||!fs.statSync(source).isFile())throw Error('Asset outside app: '+asset.id);
      const relative=asset.path.replace(/^\.\//,'');const destination=path.join(stage,'Assets',relative);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(source,destination);
      if(asset.notice){const file=path.resolve(app,asset.notice.path);if(!inside(app,file))throw Error('Asset notice outside app');const notice=path.join(stage,'Assets',asset.notice.path.slice(2));fs.mkdirSync(path.dirname(notice),{recursive:true});fs.copyFileSync(file,notice);}
      return {...asset,sha256:hash(source),...(asset.notice?{notice:{...asset.notice,sha256:hash(path.resolve(app,asset.notice.path))}}:{})};
    });
    fs.copyFileSync(host.inputs.icu,path.join(stage,'Assets/icudtl.dat'));
    const assetConfiguration={manifest:assets,sources:Object.fromEntries(assets.map(asset=>[asset.id,{uri:'nelyx-asset:/'+asset.path.slice(2)}]))};
    const entry=path.join(stage,'entry.ts'),source=path.join(stage,'app.js');
    const globals='@nelyx/sdk/backends/native-hermes/globals',start='@nelyx/sdk/backends/native-hermes/application',main=path.resolve(diagnostic??path.join(app,config.appEntry)).replaceAll('\\','/');
    fs.writeFileSync(entry,`declare const NelyxNativeHost:{fail(message:string):void};\nimport ${JSON.stringify(globals)};\nimport {startNativeHermesApplication} from ${JSON.stringify(start)};\nimport {main} from ${JSON.stringify(main)};\nstartNativeHermesApplication(main().definition,${JSON.stringify(assetConfiguration)}).catch(error=>NelyxNativeHost.fail(error.stack||String(error)));\n`);
    const packageRoots=roots;
    const metro=mergeConfig(await getDefaultConfig(root),{
      projectRoot:root,watchFolders:[root],maxWorkers:2,
      transformer:{babelTransformerPath:createRequire(path.join(runner,'package.json')).resolve('@nelyx/metro/native-hermes-transformer'),enableBabelRCLookup:false,enableBabelRuntime:false},
      serializer:{getPolyfills:()=>[],getModulesRunBeforeMainModule:()=>[]},
      resolver:{resolverMainFields:['main'],unstable_enablePackageExports:true,unstable_conditionNames:['require'],disableHierarchicalLookup:true,nodeModulesPaths:[...new Set([path.join(runner,'node_modules'),path.join(root,'node_modules')])],extraNodeModules:packageRoots,
        resolveRequest(context,name,platform){if(/^(?:react(?:$|-|\/)|@react-native(?:-windows)?\/|yoga(?:-layout)?(?:\/|$)|@microsoft\/node-api-jsi(?:\/|$))/.test(name))throw Error('RN runtime is forbidden in native Hermes graph: '+name);return context.resolveRequest(context,name,platform);}},
    });
    const policy=windowsHermesPolicy('optimized',nativeCohort('windows'));
    let bundle='app.hbc',nativeFunctions=null,aot;
    if(mode==='bytecode'){
      const {inspectRuntimeInventory}=await import('@nelyx/metro/runtime-inventory');
      const inventory=await inspectRuntimeInventory({runner,appRoot:root,entry,config:metro,nativeHost:true,signal,sourceMapUrl:'app.js.map',onCapture(value){fs.writeFileSync(source,value.code);fs.writeFileSync(source+'.map',value.map);}});
      assertNativeRuntimeGraph(inventory);copyRuntimeLicenses(inventory.modules,root,stage,roots);
      fs.writeFileSync(path.join(stage,'native-graph.json'),JSON.stringify(inventory));
      await execute(path.join(checked.directory,'build/bin/hermesc.exe'),[...policy.flags,'-emit-binary','-out',bundle,path.basename(source)],{cwd:stage,env,signal,timeout});
    }
    else{
      bundle='NelyxApp.aot.dll';aot=await buildNativeAot({app,runner,root,entry,source,map:source+'.map',config:metro,roots,checked,env,stage,signal,cacheDirectory:cacheDirectory??(diagnostic?null:undefined)});nativeFunctions=aot.nativeFunctions;assertNativeRuntimeGraph(aot.execution);copyRuntimeLicenses(aot.execution.modules,root,stage,roots);
    }
    for(const [name,base]of Object.entries(roots)){for(const relative of ['LICENSE.md','THIRD_PARTY_NOTICES.md',...(fs.existsSync(path.join(base,'licenses'))?fileTree(path.join(base,'licenses')).map(name=>'licenses/'+name):[])]){const file=path.join(base,relative);if(!fs.existsSync(file))continue;const destination=path.join(stage,'licenses',name.slice(7),relative);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(file,destination);}}
    fs.copyFileSync(path.join(checked.directory,'source/LICENSE'),path.join(stage,'licenses/Hermes-MIT.txt'));
    fs.unlinkSync(entry);
    const inventory=[];const visit=folder=>{for(const item of fs.readdirSync(folder,{withFileTypes:true})){const file=path.join(folder,item.name);if(item.isSymbolicLink())throw Error('Native package symlink');if(item.isDirectory())visit(file);else inventory.push({path:path.relative(stage,file).replaceAll('\\','/'),sha256:hash(file),bytes:fs.statSync(file).size});}};visit(stage);
    fs.writeFileSync(path.join(stage,'native-package.json'),JSON.stringify({schema:'nelyx.native-hermes-package/v1',app:config.name,mode,revision:checked.manifest.revision,toolchainSha256:checked.sha256,sourceSha256:host.manifest.sourceSha256,compilerPolicy:policy.id,bundle,nativeFunctions,...(aot?{nativePlan:aot.nativePlan,acceptance:aot.acceptance}:{}),qualification:diagnostic?'diagnostic-only':'experimental',...(diagnostic?{diagnosticEntrySha256:hash(diagnostic)}:{}),performanceAccepted:false,physicalInputAccepted:'notVerified',files:inventory},null,2)+'\n');
    verifyNativePackage(stage);
    const previous=path.join(parent,'.replace-'+mode);if(fs.existsSync(previous))throw Error('Unfinished native package replacement requires recovery');let moved=false,published=false;
    try{if(fs.existsSync(directory)){assertReplaceable(directory);if(!inside(parent,directory)||fs.lstatSync(directory).isSymbolicLink())throw Error('Native output cleanup outside owned package');fs.renameSync(directory,previous);moved=true;}fs.renameSync(stage,directory);published=true;}
    finally{if(moved){if(published)fs.rmSync(previous,{recursive:true,force:true});else fs.renameSync(previous,directory);}}
    return {directory,mode,bundle:path.join(directory,bundle),executable:path.join(directory,'NelyxHermesHost.exe'),assetRoot:path.join(directory,'Assets')};
  }finally{try{if(stage&&fs.existsSync(stage)){if(path.dirname(stage)!==parent||path.basename(stage)!=='.build-'+mode||fs.lstatSync(stage).isSymbolicLink())throw Error('Unexpected native build stage');fs.rmSync(stage,{recursive:true,force:true});}}finally{packageOwner.close();}}
}
export function assertNativeRuntimeGraph(graph){if(!graph||!Array.isArray(graph.modules)||!graph.modules.length||graph.modules.some(module=>!module?.owner?.name||/^(?:react(?:$|-)|@react-native(?:-windows)?\/|@nelyx\/skia-rn$|yoga(?:-layout)?$|@microsoft\/node-api-jsi$)/.test(module.owner.name))||graph.evaluationConflicts?.length||graph.summary?.unresolvedDependencies||graph.unresolved?.length||graph.dynamicCodeCandidates?.length)throw Error('Direct host runtime graph contains an RN owner, unresolved edge or dynamic-code fallback');}
function copyRuntimeLicenses(modules,root,stage,roots){const owners=new Map(modules.map(module=>[module.owner.name,module.owner]));for(const [name,owner]of owners){if(Object.hasOwn(roots,name))continue;const folder=path.resolve(root,owner.root);if(folder!==root&&!inside(root,folder)||hash(path.join(folder,'package.json'))!==owner.manifestSha256)throw Error('Runtime license owner changed');for(const file of fs.readdirSync(folder).filter(name=>/^(?:licen[cs]e|notice)(?:[.-]|$)/i.test(name))){const source=path.join(folder,file);if(!fs.statSync(source).isFile()||fs.lstatSync(source).isSymbolicLink())throw Error('Runtime license is not a regular file');const target=path.join(stage,'licenses/runtime',name.replaceAll('/','_'),file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);}}}
function assertReplaceable(directory){verifyNativePackage(directory);for(const name of ['NelyxHermesHost.exe','hermesvm.dll']){let handle;try{handle=fs.openSync(path.join(directory,name),'r+');}catch{throw Error('Close the running native Hermes package before replacing it: '+directory);}finally{if(handle!==undefined)fs.closeSync(handle);}}}
export function verifyNativePackage(directory){
  directory=fs.realpathSync(directory);const manifest=JSON.parse(fs.readFileSync(localFile(directory,'native-package.json'),'utf8'));
  if(manifest.schema!=='nelyx.native-hermes-package/v1'||!['bytecode','static-aot'].includes(manifest.mode)||manifest.revision!=='94aa5e1d40a4ce99df79d951cbe45310ec40680c'||manifest.bundle!==(manifest.mode==='bytecode'?'app.hbc':'NelyxApp.aot.dll')||manifest.mode==='static-aot'&&(!Number.isSafeInteger(manifest.nativeFunctions)||manifest.nativeFunctions<1))throw Error('Invalid native Hermes package identity');
  if(!['experimental','diagnostic-only'].includes(manifest.qualification)||manifest.qualification==='diagnostic-only'&&!/^[a-f0-9]{64}$/.test(manifest.diagnosticEntrySha256)||manifest.performanceAccepted!==false||manifest.physicalInputAccepted!=='notVerified')throw Error('Invalid native Hermes qualification boundary');
  const verified=verifyInventory(directory,manifest.files,['native-package.json']);
  const host=JSON.parse(fs.readFileSync(localFile(directory,'native-host.json'),'utf8'));if(host.schema!=='nelyx.native-hermes-host/v1'||host.toolchainSha256!==manifest.toolchainSha256||host.sourceSha256!==manifest.sourceSha256)throw Error('Native package host/source identity differs');
  for(const file of host.files)if(hash(localFile(directory,file.path))!==file.sha256)throw Error('Native host loaded image differs');
  const bytes=fs.readFileSync(localFile(directory,manifest.bundle));if(manifest.mode==='bytecode'&&(bytes.length<16||bytes.subarray(0,8).toString('hex')!=='c61fbc03c103191f'||bytes.readUInt32LE(8)!==99))throw Error('Native package requires Hermes99 HBC');
  if(manifest.mode==='static-aot')verifyNativeAot(directory,manifest);
  else assertNativeRuntimeGraph(JSON.parse(fs.readFileSync(localFile(directory,'native-graph.json'),'utf8')));
  return {directory,manifest,...verified};
}
export async function packNativeApplication({app,directory,hermesMode='bytecode',output}={}){
  const checked=verifyNativePackage(directory??path.join(app,'.nelyx/native-windows','current-'+hermesMode));
  output=path.resolve(output??path.join(app,'.nelyx/native-windows',checked.manifest.app+'-'+checked.manifest.mode+'.zip'));
  if(!output.toLowerCase().endsWith('.zip')||fs.existsSync(output)||inside(checked.directory,output))throw Error('Pack requires a new zip outside the package');
  fs.mkdirSync(path.dirname(output),{recursive:true});const parent=fs.realpathSync(path.dirname(output)),temporary=fs.mkdtempSync(path.join(parent,'.native-pack-'));
  try{
    const archive=path.join(temporary,'app.zip');
    await execute('powershell.exe',['-NoProfile','-Command',"$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory($env:NELYX_NATIVE_PACKAGE,$env:NELYX_NATIVE_ZIP)"],{env:{...process.env,NELYX_NATIVE_PACKAGE:checked.directory,NELYX_NATIVE_ZIP:archive},timeout});
    verifyNativePackage(checked.directory);fs.copyFileSync(archive,output,fs.constants.COPYFILE_EXCL);
    return {schema:'nelyx.pack/v2',target:'windows',host:'native-hermes',file:output,sha256:hash(output),files:checked.files,qualification:'experimental'};
  }finally{if(path.dirname(temporary)!==parent||!path.basename(temporary).startsWith('.native-pack-')||fs.lstatSync(temporary).isSymbolicLink())throw Error('Native pack temporary owner differs');fs.rmSync(temporary,{recursive:true,force:true});}
}
export async function runNativeApplication({app,directory,hermesMode='bytecode',arguments:args=[]}={}){
  const checked=verifyNativePackage(directory??path.join(app,'.nelyx/native-windows','current-'+hermesMode));
  const child=startWindowsProcess(localFile(checked.directory,'NelyxHermesHost.exe'),[localFile(checked.directory,checked.manifest.bundle),path.join(checked.directory,'Assets'),checked.manifest.mode,...args],{cwd:checked.directory,verify:verifyNativePackage});
  const stop=()=>{void child.stop();};process.on('SIGINT',stop);process.on('SIGTERM',stop);try{return {schema:'nelyx.run/v2',target:'windows',host:'native-hermes',...await child.completed};}finally{process.off('SIGINT',stop);process.off('SIGTERM',stop);}
}
export async function prepareNativeApplication({app,engineInputs,nativeInputs}={}){
  const parent=path.join(app,'.nelyx/native-windows');fs.mkdirSync(parent,{recursive:true});const roots=nativePackageRoots(app),inputs=verifyNativeSkiaInputs(nativeInputs,roots['@nelyx/skia-native']);const toolchain=await prepareNativeHermes({directory:engineInputs??path.join(parent,'toolchain')});
  const locator={schema:'nelyx.native-hermes-inputs/v1',nativeInputs:inputs.input,nativeInputsSha256:inputs.sha256,engineInputs:toolchain.directory,engineInputsSha256:toolchain.sha256};fs.writeFileSync(path.join(parent,'inputs.json'),JSON.stringify(locator,null,2)+'\n');return locator;
}
export async function nativeWindowsOperation(operation,options){
  if(options.hermesMode&&!['bytecode','static-aot'].includes(options.hermesMode))throw Error('Choose --hermes-mode bytecode or static-aot');
  if(options.engine&&options.engine!=='hermes'||options.configuration&&options.configuration!=='Release'||options.jscMode||options.hermesProfile&&options.hermesProfile!=='optimized')throw Error('The native Windows host requires optimized Hermes and Release');
  const app=fs.realpathSync(options.app),parent=path.join(app,'.nelyx/native-windows');let inputs={};const locator=path.join(parent,'inputs.json');
  const readInputs=(refresh=false)=>{
    if(!fs.existsSync(locator))return {};const value=JSON.parse(fs.readFileSync(locator,'utf8'));
    if(value.schema!=='nelyx.native-hermes-inputs/v1'||typeof value.nativeInputs!=='string'||!value.nativeInputs||typeof value.engineInputs!=='string'||!value.engineInputs)throw Error('Native host input locator schema/paths differ');
    // prepare validates the current suppliers before publishing fresh hashes.
    // Their previous paths remain useful after a source/toolchain update.
    if(refresh)return {nativeInputs:value.nativeInputs,engineInputs:value.engineInputs};
    if(hash(value.nativeInputs)!==value.nativeInputsSha256||verifyNativeHermes(value.engineInputs).sha256!==value.engineInputsSha256)throw Error('Native host prepared inputs changed');
    verifyNativeSkiaInputs(value.nativeInputs,nativePackageRoots(app)['@nelyx/skia-native']);return value;
  };
  if(operation==='doctor'){let reason;try{inputs=readInputs();}catch(error){reason=error.message;}return {schema:'nelyx.doctor/v2',target:'windows',host:'native-hermes',engine:'hermes',qualification:'experimental',nativeInputs:inputs.schema?'prepared':'notVerified',...(reason?{reason}:{})};}
  if(operation==='prepare')inputs=readInputs(true);else if(operation==='build')inputs=readInputs();
  const selected={...inputs,...options,app,engineInputs:options.engineInputs??inputs.engineInputs,nativeInputs:options.nativeInputs??inputs.nativeInputs};
  if(operation==='prepare')return prepareNativeApplication(selected);
  if(operation==='build')return buildNativeApplication({...selected,mode:options.hermesMode??'bytecode'});
  if(operation==='run')return runNativeApplication(selected);
  if(operation==='pack')return packNativeApplication(selected);
  throw Error('Native Windows host supports doctor, prepare, build, run and pack');
}
