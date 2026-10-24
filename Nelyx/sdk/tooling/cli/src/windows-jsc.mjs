// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {execute} from './commands.mjs';
import {sha256,localFile,verifyInventory,fileTree} from './files.mjs';
import {windowsCompilerEnvironment} from './windows-static-hermes.mjs';

export const windowsJscPin=Object.freeze({version:'26.4.0',revision:'482d54b279fd6147a45aaa122242f2ac315f46df',playwright:'1.59.1',build:'2272',archiveSha256:'c7c4e1bb817434ec13ee6d026817d075078213910db776278b3b606a2b691b1c',url:'https://playwright.download.prss.microsoft.com/dbazure/download/playwright/builds/webkit/2272/webkit-win64.zip',runtimeSha256:'6b5403129383847cacfcadd7fda112ec953c89c1066c883df6ae4dc0b7ce9cd3'});
const headerHashes={
  'JavaScript.h':'a6745932adc36ac24f8df05568dc3171401caa1d3a0d6e069dc77aa35715e1a4',
  'JSBase.h':'265461a515aa39e8f40b70b5ad2cf755dd0745de862b0b6688c614bd33b105f9',
  'JSContextRef.h':'ae4b64ecfc14644a17a97d673fef0a93db413f51c4468ea25c6e3a72f1e0bbd2',
  'JSObjectRef.h':'28d3025f767d0208be0561c0c67602aae16185c5007ebf58923513956b187c6e',
  'JSStringRef.h':'20091cc5435fd835d3a0f4ec5a2be8a76503aee57d88ae71b8834350f02e1482',
  'JSTypedArray.h':'3f9b49cb1a573e643130bf267a924f04737317d8561a52615e0ff3ad8143952e',
  'JSValueRef.h':'6784d14dae868ace539270775f7ec9746666f1587a7ed212108f41532c9ca7cc',
  'WebKitAvailability.h':'0e3657fe1f5538e50f02252a526c45c26f39478da82289fb1217a649fed71b89',
};
const engineFiles=['JavaScriptCore.dll','icuin77.dll','icuuc77.dll','icudt77.dll'];
const xml=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const digest=text=>createHash('sha256').update(text).digest('hex');
export function windowsJscMode(mode='jit',engine='jsc'){
  if(!['jit','interpreter'].includes(mode))throw Error('Choose Windows --jsc-mode jit or interpreter');
  if(engine!=='jsc')throw Error('--jsc-mode requires --engine jsc');
  return mode;
}
export function patchWindowsJscSource(source){
  source=source.replaceAll('\r\n','\n');
  const anchor='              m_jsiRuntimeHolder = std::make_shared<Microsoft::ReactNative::HermesRuntimeHolder>(\n                  devSettings, jsMessageThread, CreatePreparedScriptStore());\n              auto jsRuntime = std::make_unique<Microsoft::ReactNative::HermesJSRuntime>(m_jsiRuntimeHolder);';
  if(source.split(anchor).length!==2)throw Error('Pinned RNW 0.83.2 JSC runtime creation changed');
  return source.replace('#include "HermesRuntimeHolder.h"','#include "HermesRuntimeHolder.h"\n#include <JscRuntime.h>').replace(anchor,`              if (m_options.JsiEngine() == JSIEngine::V8 || devSettings->useDirectDebugger) throw std::runtime_error("JSC supplier requires the default engine slot without the Hermes inspector");
              m_jsiRuntimeHolder = std::make_shared<Nelyx::WindowsJsc::RuntimeHolder>();
              auto jsRuntime = std::make_unique<Nelyx::WindowsJsc::Runtime>(m_jsiRuntimeHolder);`);
}
/** Use JSC's native Promise job queue for both JSI and intrinsic async jobs. */
export function patchJscMicrotasks(source){
  source=source.replaceAll('\r\n','\n');
  const member='  std::deque<jsi::Function> microtaskQueue_;',begin=source.indexOf('void JSCRuntime::queueMicrotask('),end=source.indexOf('jsi::Object JSCRuntime::global()',begin);
  if(source.split(member).length!==2||begin<0||end<0||!source.slice(begin,end).includes('microtaskQueue_.pop_front();'))throw Error('Pinned RN JSC microtask adapter changed');
  source=source.slice(0,begin)+`void JSCRuntime::queueMicrotask(const jsi::Function& callback) {
  if (!enqueueMicrotask_) {
    enqueueMicrotask_ = std::make_unique<jsi::Function>(evaluateJavaScript(
      std::make_shared<jsi::StringBuffer>("(()=>{const p=Promise.resolve(),then=Promise.prototype.then;return f=>then.call(p,f);})()"),
      "nelyx:jsc-native-job-queue").asObject(*this).asFunction(*this));
  }
  enqueueMicrotask_->call(*this, callback);
}

bool JSCRuntime::drainMicrotasks(int /*maxMicrotasksHint*/) {
  // JSC's outer C API lock exit drains its native job queue to completion.
  evaluateJavaScript(std::make_shared<jsi::StringBuffer>("void 0"), "nelyx:jsc-checkpoint");
  return true;
}

`+source.slice(end);
  return source.replace(member,member+'\n  std::unique_ptr<jsi::Function> enqueueMicrotask_;').replace('  microtaskQueue_.clear();','  enqueueMicrotask_.reset();\n  microtaskQueue_.clear();');
}
export function verifyWindowsJsc(directory,{embedded=false}={}){
  directory=fs.realpathSync(directory);const manifest=JSON.parse(fs.readFileSync(localFile(directory,'jsc-engine.json'),'utf8'));
  if(manifest.schema!=='nelyx.windows-jsc/v1'||manifest.rnw!=='0.83.2'||manifest.nativeReactNative!=='0.83.4'||manifest.jsi!==21||manifest.architecture!=='x64'||manifest.crt!=='MD'||manifest.version!==windowsJscPin.version||manifest.revision!==windowsJscPin.revision||manifest.archiveSha256!==windowsJscPin.archiveSha256||manifest.qualification!=='notVerified'||['bridgeSha256','patchedHostSha256','microtaskAdapterSha256','producerSha256'].some(name=>!/^[a-f0-9]{64}$/.test(manifest[name])))throw Error('Windows JSC supplier identity differs');
  const names=new Set(manifest.files?.map(record=>record.path));
  verifyInventory(directory,manifest.files,embedded?fileTree(directory).filter(name=>!names.has(name)):['jsc-engine.json']);
  for(const name of ['Microsoft.ReactNative.dll',...engineFiles,'licenses/JSC-COPYING.LIB','licenses/JSC-API-LICENSE','licenses/JSC-SOURCE.txt','licenses/ICU-LICENSE','licenses/RNW-LICENSE','licenses/RN-JSC-LICENSE'])if(!names.has(name))throw Error('Incomplete JSC supplier: '+name);
  if(sha256(localFile(directory,'JavaScriptCore.dll'))!==windowsJscPin.runtimeSha256)throw Error('Pinned JSC runtime DLL differs');
  return {directory,manifest,sha256:sha256(path.join(directory,'jsc-engine.json'))};
}
/** Keep only the current supplier. Archives, headers and build trees are temporary. */
export async function prepareWindowsJsc({runner,output,signal,bridgeDirectory}){
  if(process.platform!=='win32'||process.arch!=='x64')throw Error('JSC supplier build requires Windows x64');
  runner=fs.realpathSync(runner);output=path.resolve(output);fs.mkdirSync(output,{recursive:true});
  if(fs.realpathSync(output)!==output)throw Error('JSC supplier directory symlink rejected');
  const load=createRequire(path.join(runner,'package.json')),rnw=path.dirname(load.resolve('react-native-windows/package.json')),sdk=path.dirname(load.resolve('@nelyx/sdk/package.json')),bridge=path.resolve(bridgeDirectory??path.join(sdk,'native/windows')),supplier=path.join(output,'supplier');
  if(JSON.parse(fs.readFileSync(path.join(rnw,'package.json'),'utf8')).version!=='0.83.2')throw Error('Pinned RNW0.83.2 required');
  const bridgeSha256=digest(fs.readFileSync(path.join(bridge,'JscRuntime.h'),'utf8')+fs.readFileSync(path.join(bridge,'JscEngine.h'),'utf8')),hostSource=patchWindowsJscSource(fs.readFileSync(path.join(rnw,'Microsoft.ReactNative/ReactHost/ReactInstanceWin.cpp'),'utf8')),producerSha256=digest(fs.readFileSync(new URL(import.meta.url)));
  // This JSC component is identical in the pinned native RN0.83.4 and facade
  // RN0.83.10. Reuse checks the actual transformed native inputs; producerSha256
  // records build provenance and does not invalidate a DLL for lifecycle edits.
  const installedRn=path.dirname(load.resolve('react-native/package.json'));
  if(JSON.parse(fs.readFileSync(path.join(installedRn,'package.json'),'utf8')).version!=='0.83.10')throw Error('Pinned RN0.83.10 facade required');
  const adapterSha256=digest(patchJscMicrotasks(fs.readFileSync(path.join(installedRn,'ReactCommon/jsc/JSCRuntime.cpp'),'utf8')));
  if(fs.existsSync(path.join(supplier,'jsc-engine.json'))){const checked=verifyWindowsJsc(supplier);if(checked.manifest.bridgeSha256===bridgeSha256&&checked.manifest.patchedHostSha256===digest(hostSource)&&checked.manifest.microtaskAdapterSha256===adapterSha256)return checked;}
  if(fs.statfsSync(output).bavail*fs.statfsSync(output).bsize<20*1024**3)throw Error('Need 20 GiB for the JSC supplier build');
  const scratch=fs.mkdtempSync(path.join(output,'build-'));
  const interruption=new AbortController(),stop=()=>interruption.abort(new Error('JSC supplier preparation interrupted'));
  signal=signal?AbortSignal.any([signal,interruption.signal]):interruption.signal;
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  try{
    const env=windowsCompilerEnvironment(),source=path.join(scratch,'source'),rn=path.join(scratch,'react-native'),webkit=path.join(scratch,'webkit'),include=path.join(scratch,'include'),stage=path.join(scratch,'supplier');
    const download=async(url,file,hash,algorithm='sha256',encoding='hex')=>{const response=await fetch(url,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(120000)]):AbortSignal.timeout(120000)});if(!response.ok)throw Error('JSC supplier download failed: '+response.status);const bytes=Buffer.from(await response.arrayBuffer());if(hash&&createHash(algorithm).update(bytes).digest(encoding)!==hash)throw Error('JSC supplier download hash differs: '+path.basename(file));fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);};
    const archive=path.join(scratch,'webkit.zip');await download(windowsJscPin.url,archive,windowsJscPin.archiveSha256);
    await execute('powershell.exe',['-NoProfile','-NonInteractive','-Command',"$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::ExtractToDirectory($env:NELYX_JSC_ARCHIVE,$env:NELYX_JSC_EXTRACT)"],{env:{...env,NELYX_JSC_ARCHIVE:archive,NELYX_JSC_EXTRACT:webkit},signal,timeout:1200000});
    for(const [name,hash]of Object.entries(headerHashes))await download(`https://raw.githubusercontent.com/WebKit/WebKit/${windowsJscPin.revision}/Source/JavaScriptCore/API/${name}`,path.join(include,'JavaScriptCore',name),hash);
    const rnArchive=path.join(scratch,'rn.tgz');await download('https://registry.npmjs.org/react-native/-/react-native-0.83.4.tgz',rnArchive,'H5Wco3UJyY6zZsjoBayY8RM9uiAEQ3FeG4G2NAt+lr9DO43QeqPlVe9xxxYEukMkEmeIhNjR70F6bhXuWArOMQ==','sha512','base64');
    fs.mkdirSync(rn);await execute('tar.exe',['-xzf',rnArchive,'-C',rn,'--strip-components=1'],{signal,timeout:1200000});
    fs.cpSync(rnw,source,{recursive:true,filter:file=>!path.relative(rnw,file).split(path.sep).includes('node_modules')});
    const host=path.join(source,'Microsoft.ReactNative/ReactHost/ReactInstanceWin.cpp'),adapter=path.join(source,'NelyxJscRuntime.cpp');fs.writeFileSync(host,hostSource);fs.writeFileSync(adapter,patchJscMicrotasks(fs.readFileSync(path.join(rn,'ReactCommon/jsc/JSCRuntime.cpp'),'utf8')));
    // Build an import library from the exact DLL's C exports. WebKit's C++
    // classes stay private; the single bool admission probe uses GetProcAddress.
    const dumped=spawnSync('dumpbin.exe',['/exports',path.join(webkit,'JavaScriptCore.dll')],{env,encoding:'utf8',windowsHide:true,timeout:1200000});if(dumped.error||dumped.status)throw Error('Cannot inspect JSC exports');
    const exports=[...dumped.stdout.matchAll(/^\s+\d+\s+[0-9A-F]+\s+[0-9A-F]+\s+(JS\w+)\s*$/gm)].map(match=>match[1]);if(exports.length<80)throw Error('Incomplete JSC C API exports');
    const def=path.join(scratch,'JavaScriptCore.def'),library=path.join(scratch,'JavaScriptCore.lib');fs.writeFileSync(def,'LIBRARY JavaScriptCore.dll\nEXPORTS\n'+exports.join('\n')+'\nkJSClassDefinitionEmpty DATA\n');await execute('lib.exe',['/NOLOGO','/MACHINE:X64','/DEF:'+def,'/OUT:'+library],{env,signal,timeout:1200000});
    for(const name of engineFiles)fs.copyFileSync(path.join(webkit,name),path.join(scratch,name));
    await execute('cl.exe',['/nologo','/std:c++20','/EHsc','/MD','/O2','/DNDEBUG','/DNOMINMAX','/D_WINDOWS',...['ReactCommon','ReactCommon/jsi','ReactCommon/jsc'].map(name=>'/I'+path.join(rn,name)),'/I'+bridge,'/I'+include,adapter,path.join(rn,'ReactCommon/jsi/jsi/jsi.cpp'),path.join(rn,'ReactCommon/jsi/jsi/jsilib-windows.cpp'),path.join(bridge,'JscAdmission.cpp'),'/Fe:'+path.join(scratch,'jsc-admission.exe'),'/Fo:'+scratch+'\\','/link',library],{cwd:scratch,env,signal,timeout:1200000});
    for(const mode of ['jit','interpreter']){fs.writeFileSync(path.join(scratch,'jsc-mode.txt'),mode+'\n');await execute(path.join(scratch,'jsc-admission.exe'),[],{cwd:scratch,env,signal,timeout:1200000});}
    fs.writeFileSync(path.join(source,'ExperimentalFeatures.props'),'<Project><PropertyGroup><RnwNewArch>true</RnwNewArch><UseExperimentalNuget>false</UseExperimentalNuget><ReactExperimentalFeaturesSet>true</ReactExperimentalFeaturesSet></PropertyGroup></Project>');
    fs.writeFileSync(path.join(source,'Directory.Build.targets'),`<Project xmlns="http://schemas.microsoft.com/developer/msbuild/2003"><ItemDefinitionGroup><ClCompile><AdditionalIncludeDirectories>${[path.join(source,'Microsoft.ReactNative.Cxx'),path.join(rn,'ReactCommon/jsi'),path.join(rn,'ReactCommon'),bridge,include].map(xml).join(';')};%(AdditionalIncludeDirectories)</AdditionalIncludeDirectories></ClCompile></ItemDefinitionGroup><ItemGroup Condition="'$(MSBuildProjectName)'=='Microsoft.ReactNative'"><ClCompile Include="${xml(adapter)}"><PrecompiledHeader>NotUsing</PrecompiledHeader></ClCompile></ItemGroup><ItemDefinitionGroup Condition="'$(MSBuildProjectName)'=='Microsoft.ReactNative'"><Link><AdditionalDependencies>${xml(library)};%(AdditionalDependencies)</AdditionalDependencies></Link></ItemDefinitionGroup></Project>`);
    fs.writeFileSync(path.join(scratch,'NuGet.Config'),'<configuration><packageSources><clear/><add key="react-native" value="https://pkgs.dev.azure.com/ms/react-native/_packaging/react-native-public/nuget/v3/index.json"/></packageSources></configuration>');
    const vswhere=path.join(process.env['ProgramFiles(x86)'],'Microsoft Visual Studio/Installer/vswhere.exe'),vs=spawnSync(vswhere,['-latest','-products','*','-requires','Microsoft.VisualStudio.Component.VC.Tools.x86.x64','-property','installationPath'],{encoding:'utf8',windowsHide:true,timeout:1200000});if(vs.error||vs.status||!vs.stdout.trim())throw Error('Visual Studio C++ tools required');
    await execute(path.join(vs.stdout.trim(),'MSBuild/Current/Bin/MSBuild.exe'),[path.join(source,'Microsoft.ReactNative/Microsoft.ReactNative.vcxproj'),'/restore','/m:2','/nodeReuse:false','/verbosity:minimal','/p:Configuration=Release','/p:Platform=x64','/p:PlatformToolset=v145','/p:UseExperimentalNuget=false','/p:RnwNewArch=true','/p:UseHermes=true','/p:UseDebugLibraries=false','/p:WindowsTargetPlatformVersion=10.0.26100.0',`/p:ReactNativeDir=${rn}\\`,`/p:ReactNativeWindowsDir=${source}\\`,`/p:SolutionDir=${source}\\`,...Object.entries({FollyDir:'.folly/folly-2024.10.14.00',FastFloatDir:'.fastfloat/fast_float-8.0.0',FmtDir:'.fmt/fmt-11.0.2',NodeApiJsiDir:'.node-api-jsi/node-api-jsi-4b8a4a59c4e1b7b988b809dedffd89a7662aa785'}).map(([name,folder])=>`/p:${name}=${path.join(runner,'node_modules',folder)}\\`)],{cwd:source,signal,timeout:1200000});
    const dll=fileTree(source).filter(name=>name.endsWith('/Microsoft.ReactNative.dll')&&!name.includes('/obj/'));if(dll.length!==1)throw Error('Ambiguous RNW JSC supplier build output');
    fs.mkdirSync(path.join(stage,'licenses'),{recursive:true});
    for(const name of engineFiles)fs.copyFileSync(path.join(webkit,name),path.join(stage,name));
    for(const [from,to]of [[path.join(source,dll[0]),'Microsoft.ReactNative.dll'],[path.join(rnw,'LICENSE'),'licenses/RNW-LICENSE'],[path.join(rn,'LICENSE'),'licenses/RN-JSC-LICENSE'],[path.join(include,'JavaScriptCore/JSBase.h'),'licenses/JSC-API-LICENSE']])fs.copyFileSync(from,path.join(stage,to));
    await download(`https://raw.githubusercontent.com/WebKit/WebKit/${windowsJscPin.revision}/Source/JavaScriptCore/COPYING.LIB`,path.join(stage,'licenses/JSC-COPYING.LIB'));
    await download('https://raw.githubusercontent.com/unicode-org/icu/release-77-1/LICENSE',path.join(stage,'licenses/ICU-LICENSE'));
    fs.writeFileSync(path.join(stage,'licenses/JSC-SOURCE.txt'),`JavaScriptCore: WebKit ${windowsJscPin.revision}\nBinary: ${windowsJscPin.url}\nSource: https://github.com/WebKit/WebKit/tree/${windowsJscPin.revision}\nPlaywright patches/build: https://github.com/microsoft/playwright/tree/v${windowsJscPin.playwright}/browser_patches/webkit\nICU 77.1: https://github.com/unicode-org/icu/tree/release-77-1\nJavaScriptCore.dll remains a replaceable shared library under its upstream licenses.\n`);
    const files=fileTree(stage).map(name=>({path:name,bytes:fs.statSync(path.join(stage,name)).size,sha256:sha256(path.join(stage,name))}));
    fs.writeFileSync(path.join(stage,'jsc-engine.json'),JSON.stringify({schema:'nelyx.windows-jsc/v1',rnw:'0.83.2',nativeReactNative:'0.83.4',jsi:21,architecture:'x64',crt:'MD',version:windowsJscPin.version,revision:windowsJscPin.revision,archiveSha256:windowsJscPin.archiveSha256,bridgeSha256,patchedHostSha256:digest(hostSource),microtaskAdapterSha256:sha256(adapter),producerSha256,qualification:'notVerified',files},null,2)+'\n');
    verifyWindowsJsc(stage);
    if(fs.existsSync(supplier)){if(fs.realpathSync(supplier)!==supplier||path.dirname(supplier)!==output)throw Error('JSC supplier owner differs');fs.rmSync(supplier,{recursive:true,force:true});}
    fs.renameSync(stage,supplier);return verifyWindowsJsc(supplier);
  }finally{process.off('SIGINT',stop);process.off('SIGTERM',stop);if(path.dirname(fs.realpathSync(scratch))!==output||!path.basename(scratch).startsWith('build-'))throw Error('Unexpected JSC build directory owner');fs.rmSync(scratch,{recursive:true,force:true});}
}
