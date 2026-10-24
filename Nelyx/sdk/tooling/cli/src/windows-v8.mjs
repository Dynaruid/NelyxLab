// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {execute} from './commands.mjs';
import {sha256,localFile,verifyInventory,fileTree} from './files.mjs';

export const windowsV8Pin=Object.freeze({version:'24.1.10',revision:'c1877966a8285b7cbacbdd03e26ca003496436bc',package:'Microsoft.JavaScript.V8.win-x64',sha256:'60a90be9c0d67520814fbf4b3a24f41878ea14f97f72ad6f8e4b9cf71eed303c',url:'https://pkgs.dev.azure.com/ms/f56d2c40-9e15-47a4-b7e0-69fef83912ea/_packaging/9467e302-f58d-45a1-9f9f-588df6f4d04c/nuget/v3/flat2/microsoft.javascript.v8.win-x64/24.1.10/microsoft.javascript.v8.win-x64.24.1.10.nupkg'});
const xml=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
/** This exact C ABI returns false after its unbounded V8 checkpoint. RN JSI
 * returns true when drained. Keep the vendor DLL pinned and adapt that seam. */
export function patchV8Microtasks(source){
  const before='bool JsiAbiRuntime::drainMicrotasks(int maxMicrotasksHint) {\n  auto result = vt_->drain_microtasks(abiRt_, maxMicrotasksHint);\n  checkResult(result);\n  return abi::get_bool(result);\n}';
  source=source.replaceAll('\r\n','\n');if(source.split(before).length!==2)throw Error('Pinned V8 microtask adapter changed');
  return source.replace(before,before.replace('return abi::get_bool(result);','// Pinned V8 24.1.10: false means the unbounded checkpoint completed.\n  return !abi::get_bool(result);'));
}
export function patchWindowsV8Source(source){
  const anchor='              m_jsiRuntimeHolder = std::make_shared<Microsoft::ReactNative::HermesRuntimeHolder>(\n                  devSettings, jsMessageThread, CreatePreparedScriptStore());\n              auto jsRuntime = std::make_unique<Microsoft::ReactNative::HermesJSRuntime>(m_jsiRuntimeHolder);';
  source=source.replaceAll('\r\n','\n');
  if(source.split(anchor).length!==2)throw Error('Pinned RNW 0.83.2 runtime creation changed');
  source=source.replace('#include "HermesRuntimeHolder.h"','#include "HermesRuntimeHolder.h"\n#include <V8Runtime.h>');
  return source.replace(anchor,`              std::unique_ptr<facebook::react::JSRuntime> jsRuntime;
              if (m_options.JsiEngine() == JSIEngine::V8) {
                if (devSettings->useDirectDebugger) throw std::runtime_error("The V8 supplier does not provide the Hermes inspector");
                m_jsiRuntimeHolder = std::make_shared<Nelyx::WindowsJavaScript::RuntimeHolder>(jsMessageThread);
                jsRuntime = std::make_unique<Nelyx::WindowsJavaScript::Runtime>(m_jsiRuntimeHolder);
              } else {
                m_jsiRuntimeHolder = std::make_shared<Microsoft::ReactNative::HermesRuntimeHolder>(devSettings, jsMessageThread, CreatePreparedScriptStore());
                jsRuntime = std::make_unique<Microsoft::ReactNative::HermesJSRuntime>(m_jsiRuntimeHolder);
              }
              auto &nelyxRuntime = jsRuntime->getRuntime();
              nelyxRuntime.global().setProperty(nelyxRuntime, "__nelyxJavaScriptEngine", facebook::jsi::String::createFromUtf8(nelyxRuntime, m_options.JsiEngine() == JSIEngine::V8 ? "v8" : "hermes"));`);
}
export function verifyWindowsV8(directory,{embedded=false}={}){
  directory=fs.realpathSync(directory);const manifest=JSON.parse(fs.readFileSync(localFile(directory,'v8-engine.json'),'utf8'));
  if(manifest.schema!=='nelyx.windows-v8/v1'||manifest.rnw!=='0.83.2'||manifest.nativeReactNative!=='0.83.4'||manifest.jsi!==21||manifest.architecture!=='x64'||manifest.crt!=='MD'||manifest.version!==windowsV8Pin.version||manifest.revision!==windowsV8Pin.revision||manifest.archiveSha256!==windowsV8Pin.sha256||manifest.qualification!=='notVerified'||['bridgeSha256','patchedHostSha256','microtaskAdapterSha256'].some(name=>!/^[a-f0-9]{64}$/.test(manifest[name])))throw Error('Windows V8 supplier identity differs');
  const names=new Set(manifest.files.map(record=>record.path));
  verifyInventory(directory,manifest.files,embedded?fileTree(directory).filter(name=>!names.has(name)):['v8-engine.json']);
  for(const name of ['Microsoft.ReactNative.dll','v8jsi.dll','licenses/V8-LICENSE','licenses/V8-NOTICE.txt','licenses/RNW-LICENSE'])if(!manifest.files.some(record=>record.path===name))throw Error('Incomplete V8 supplier: '+name);
  if(sha256(localFile(directory,'v8jsi.dll'))!=='106b7a596430f3de3d51c02534b31ad2c85c7df205fbdd803459ec7f26e9f250')throw Error('Pinned V8 runtime DLL differs');
  return {directory,manifest,sha256:sha256(path.join(directory,'v8-engine.json'))};
}
/** Build one reusable RNW/V8 supplier. The installed RNW sources stay untouched. */
export async function prepareWindowsV8({runner,output,signal,bridgeHeader}){
  if(process.platform!=='win32'||process.arch!=='x64')throw Error('V8 supplier build requires Windows x64');
  runner=fs.realpathSync(runner);output=path.resolve(output);fs.mkdirSync(output,{recursive:true});
  if(fs.realpathSync(output)!==output)throw Error('V8 build directory symlink rejected');
  if(fs.statfsSync(output).bavail*fs.statfsSync(output).bsize<20*1024**3)throw Error('Need 20 GiB for the V8 supplier build');
  const load=createRequire(path.join(runner,'package.json')),rnw=path.dirname(load.resolve('react-native-windows/package.json')),installedRn=path.dirname(load.resolve('react-native/package.json')),rn=path.join(output,'react-native');
  if(JSON.parse(fs.readFileSync(path.join(rnw,'package.json'),'utf8')).version!=='0.83.2'||JSON.parse(fs.readFileSync(path.join(installedRn,'package.json'),'utf8')).version!=='0.83.10')throw Error('Pinned RNW0.83.2/RN0.83.10 required');
  const sdk=path.dirname(load.resolve('@nelyx/sdk/package.json')),header=path.resolve(bridgeHeader??path.join(sdk,'native/windows/V8Runtime.h'));
  const source=path.join(output,'source'),v8=path.join(output,'v8'),archive=path.join(output,'v8.nupkg'),supplier=path.join(output,'supplier');
  if(fs.existsSync(path.join(supplier,'v8-engine.json'))){const checked=verifyWindowsV8(supplier),hostHash=createHash('sha256').update(patchWindowsV8Source(fs.readFileSync(path.join(rnw,'Microsoft.ReactNative/ReactHost/ReactInstanceWin.cpp'),'utf8'))).digest('hex'),adapterFile=path.join(v8,'build/native/jsi/jsi_abi/JsiAbiRuntime.cpp'),adapterHash=fs.existsSync(adapterFile)?createHash('sha256').update(patchV8Microtasks(fs.readFileSync(adapterFile,'utf8'))).digest('hex'):null;if(checked.manifest.bridgeSha256===sha256(header)&&checked.manifest.patchedHostSha256===hostHash&&checked.manifest.microtaskAdapterSha256===adapterHash)return checked;}
  if(!fs.existsSync(archive)){
    const response=await fetch(windowsV8Pin.url,{signal});if(!response.ok)throw Error('V8 supplier download failed: '+response.status);const bytes=Buffer.from(await response.arrayBuffer());
    if(createHash('sha256').update(bytes).digest('hex')!==windowsV8Pin.sha256)throw Error('V8 archive hash differs');fs.writeFileSync(archive,bytes);
  }
  if(sha256(archive)!==windowsV8Pin.sha256)throw Error('V8 archive hash differs');
  // RNW 0.83.2's native supplier is built from RN 0.83.4, independently of
  // the facade's JS package. Later patches remove native source files it uses.
  const rnArchive=path.join(output,'react-native-0.83.4.tgz'),rnIntegrity='H5Wco3UJyY6zZsjoBayY8RM9uiAEQ3FeG4G2NAt+lr9DO43QeqPlVe9xxxYEukMkEmeIhNjR70F6bhXuWArOMQ==';
  if(!fs.existsSync(rnArchive)){const response=await fetch('https://registry.npmjs.org/react-native/-/react-native-0.83.4.tgz',{signal});if(!response.ok)throw Error('Native RN source download failed');const bytes=Buffer.from(await response.arrayBuffer());if(createHash('sha512').update(bytes).digest('base64')!==rnIntegrity)throw Error('Native RN archive integrity differs');fs.writeFileSync(rnArchive,bytes);}
  if(createHash('sha512').update(fs.readFileSync(rnArchive)).digest('base64')!==rnIntegrity)throw Error('Native RN archive integrity differs');
  if(!fs.existsSync(path.join(rn,'package.json'))){fs.mkdirSync(rn,{recursive:true});await execute('tar.exe',['-xzf',rnArchive,'-C',rn,'--strip-components=1'],{signal});}
  if(!fs.existsSync(v8))await execute('powershell.exe',['-NoProfile','-NonInteractive','-Command',"$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory($env:NELYX_V8_ARCHIVE,$env:NELYX_V8_EXTRACT)"],{env:{...process.env,NELYX_V8_ARCHIVE:archive,NELYX_V8_EXTRACT:v8},signal});
  if(!fs.existsSync(source))fs.cpSync(rnw,source,{recursive:true,filter:file=>!path.relative(rnw,file).split(path.sep).includes('node_modules')});
  const host=path.join(source,'Microsoft.ReactNative/ReactHost/ReactInstanceWin.cpp');
  fs.writeFileSync(host,patchWindowsV8Source(fs.readFileSync(path.join(rnw,'Microsoft.ReactNative/ReactHost/ReactInstanceWin.cpp'),'utf8')));
  fs.writeFileSync(path.join(source,'ExperimentalFeatures.props'),'<Project><PropertyGroup><RnwNewArch>true</RnwNewArch><UseExperimentalNuget>false</UseExperimentalNuget><ReactExperimentalFeaturesSet>true</ReactExperimentalFeaturesSet></PropertyGroup></Project>');
  const include=path.join(v8,'build/native/include'),adapter=path.join(v8,'build/native/jsi'),library=path.join(v8,'build/native/win-x64/v8jsi.dll.lib');
  const microtaskAdapter=path.join(source,'NelyxV8JsiAbiRuntime.cpp');
  fs.writeFileSync(microtaskAdapter,patchV8Microtasks(fs.readFileSync(path.join(adapter,'jsi_abi/JsiAbiRuntime.cpp'),'utf8')));
  // Compile the consumer adapter with RNW's JSI 21, rather than the NuGet's bundled JSI.
  fs.writeFileSync(path.join(source,'Directory.Build.targets'),`<Project xmlns="http://schemas.microsoft.com/developer/msbuild/2003"><ItemDefinitionGroup><ClCompile><AdditionalIncludeDirectories>${xml(path.join(source,'Microsoft.ReactNative.Cxx'))};${xml(path.join(rn,'ReactCommon/jsi'))};${xml(path.join(rn,'ReactCommon/react/utils'))};${xml(path.dirname(header))};${xml(include)};${xml(adapter)};%(AdditionalIncludeDirectories)</AdditionalIncludeDirectories></ClCompile></ItemDefinitionGroup><ItemGroup Condition="'$(MSBuildProjectName)'=='Microsoft.ReactNative'"><ClCompile Include="${xml(path.join(adapter,'public/V8JsiRuntime.cpp'))}"><PrecompiledHeader>NotUsing</PrecompiledHeader></ClCompile><ClCompile Include="${xml(microtaskAdapter)}"><PrecompiledHeader>NotUsing</PrecompiledHeader></ClCompile></ItemGroup><ItemDefinitionGroup Condition="'$(MSBuildProjectName)'=='Microsoft.ReactNative'"><Link><AdditionalDependencies>${xml(library)};%(AdditionalDependencies)</AdditionalDependencies></Link></ItemDefinitionGroup></Project>`);
  fs.writeFileSync(path.join(output,'NuGet.Config'),'<configuration><packageSources><clear/><add key="react-native" value="https://pkgs.dev.azure.com/ms/react-native/_packaging/react-native-public/nuget/v3/index.json"/></packageSources></configuration>');
  const vswhere=path.join(process.env['ProgramFiles(x86)'],'Microsoft Visual Studio/Installer/vswhere.exe'),vs=spawnSync(vswhere,['-latest','-products','*','-requires','Microsoft.VisualStudio.Component.VC.Tools.x86.x64','-property','installationPath'],{encoding:'utf8',windowsHide:true});
  if(vs.status||!vs.stdout.trim())throw Error('Visual Studio C++ tools required');
  await execute(path.join(vs.stdout.trim(),'MSBuild/Current/Bin/MSBuild.exe'),[path.join(source,'Microsoft.ReactNative/Microsoft.ReactNative.vcxproj'),'/restore','/m:2','/verbosity:minimal','/p:Configuration=Release','/p:Platform=x64','/p:PlatformToolset=v145','/p:UseExperimentalNuget=false','/p:RnwNewArch=true','/p:UseHermes=true','/p:UseDebugLibraries=false','/p:WindowsTargetPlatformVersion=10.0.26100.0',`/p:ReactNativeDir=${rn}\\`,`/p:ReactNativeWindowsDir=${source}\\`,`/p:SolutionDir=${source}\\`,...Object.entries({FollyDir:'.folly/folly-2024.10.14.00',FastFloatDir:'.fastfloat/fast_float-8.0.0',FmtDir:'.fmt/fmt-11.0.2',NodeApiJsiDir:'.node-api-jsi/node-api-jsi-4b8a4a59c4e1b7b988b809dedffd89a7662aa785'}).map(([name,folder])=>`/p:${name}=${path.join(runner,'node_modules',folder)}\\`)],{cwd:source,timeout:1200000,signal});
  const dll=fileTree(source).find(name=>name.endsWith('/Microsoft.ReactNative.dll')&&!name.includes('/obj/'));
  if(!dll)throw Error('RNW V8 supplier build did not produce Microsoft.ReactNative.dll');
  fs.mkdirSync(path.join(supplier,'licenses'),{recursive:true});
  for(const [from,to]of [[path.join(source,dll),'Microsoft.ReactNative.dll'],[path.join(v8,'runtimes/win-x64/native/v8jsi.dll'),'v8jsi.dll'],[path.join(v8,'LICENSE'),'licenses/V8-LICENSE'],[path.join(v8,'NOTICE.txt'),'licenses/V8-NOTICE.txt'],[path.join(rnw,'LICENSE'),'licenses/RNW-LICENSE']])fs.copyFileSync(from,path.join(supplier,to));
  const files=fileTree(supplier).filter(name=>name!=='v8-engine.json').map(name=>({path:name,bytes:fs.statSync(path.join(supplier,name)).size,sha256:sha256(path.join(supplier,name))}));
  fs.writeFileSync(path.join(supplier,'v8-engine.json'),JSON.stringify({schema:'nelyx.windows-v8/v1',rnw:'0.83.2',nativeReactNative:'0.83.4',jsi:21,architecture:'x64',crt:'MD',version:windowsV8Pin.version,revision:windowsV8Pin.revision,archiveSha256:windowsV8Pin.sha256,bridgeSha256:sha256(header),patchedHostSha256:sha256(host),microtaskAdapterSha256:sha256(microtaskAdapter),qualification:'notVerified',files},null,2)+'\n');
  return verifyWindowsV8(supplier);
}
