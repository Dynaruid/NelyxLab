// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {execute} from './commands.mjs';
import {sha256,localFile,verifyInventory,fileTree} from './files.mjs';
import {windowsHermesPolicy} from './windows-hermes-policy.mjs';
import {compileHermesImage} from './windows-hermes-image.mjs';
import {patchStaticHermesCompiler,compilerProvenancePolicy} from './static-hermes-compiler-patch.mjs';
import {nativeCohort} from '@nelyx/sdk/runtime/cohorts';
import {readNativeFunctionMap} from './native-function-map.mjs';

// SHUnit's native layout is private to an exact VM build. This experiment uses
// the existing RNW supplier, not an arbitrary newer compiler with an older VM.
export const windowsStaticHermesPin=Object.freeze({
  internalJavaScriptSha256:'c917a77eb7d770ed5e8ba7da12ef6303d105d8975e29fcb5692db49c5c389fd0',
  revision:'94aa5e1d40a4ce99df79d951cbe45310ec40680c',
  sourceSha256:'24582814145b28d2abced182d217e1b55564c8cfe9639d962973c1078b312806',
  sourceUrl:'https://codeload.github.com/microsoft/hermes-windows/tar.gz/94aa5e1d40a4ce99df79d951cbe45310ec40680c',
  runtimeSha256:'c4a1d80bcecacde0fd64b2c0927138095ed0e98e37334a53f42949b050186d68',
  unit:'nelyx_app',library:'NelyxApp.aot.dll',mode:'untyped-native',
});
const timeout=1_200_000;
const runtimePatchSha256=()=>createHash('sha256').update(patchStaticHermesRuntime.toString()).digest('hex');
const producerSha256=()=>createHash('sha256').update(prepareWindowsStaticHermes.toString()).update(patchStaticHermesCompiler.toString()).update(JSON.stringify(windowsHermesPolicy('optimized',nativeCohort('windows')).flags)).digest('hex');
const bridgeHeader=path.join(path.dirname(createRequire(import.meta.url).resolve('@nelyx/sdk/package.json')),'native/windows/StaticHermes.h');
export const staticHermesBridgeSha256=()=>createHash('sha256').update(fs.readFileSync(bridgeHeader)).update(fs.readFileSync(path.join(path.dirname(bridgeHeader),'RnwJsiPal.h'))).digest('hex');
export const staticHermesBootstrap='/*nelyx:static-hermes-unit:94aa5e1d:v3*/\n';
export function patchStaticHermesRuntime(source){
  source=source.replaceAll('\r\n','\n');
  source=source.replaceAll('if (Nelyx::WindowsStaticHermes::isRnwPal(', 'if (Nelyx::WindowsStaticHermes::nativeStarted.load() && Nelyx::WindowsStaticHermes::isRnwPal(');
  const include='#include <werapi.h>',anchor='    if (isInspectable_) {\n      compileFlags_.debug = true;';
  if(source.split(include).length!==2||source.split(anchor).length!==2)throw Error('Pinned Hermes RuntimeWrapper source changed');
  source=source.replace(include+'\n#include <StaticHermes.h>',include).replace('    Nelyx::WindowsStaticHermes::install(*hermesJsiRuntime_);\n','');
  source=source.replace(/    \/\/ Nelyx native script admission v\d+:[^\n]*\n    if \(Nelyx::WindowsStaticHermes::isBundle[\s\S]*?return napi_call_function\(env_, global, entry, 0, nullptr, result\);\n    }\n?/,'');
  source=source.replace(/    if \(Nelyx::WindowsStaticHermes::isBundle[\s\S]*?return ::hermes::node_api::clearLastNativeError\(env_\);\n    }\n?/,'');
  source=source.replace(include,include+'\n#include <StaticHermes.h>').replace(anchor,'    Nelyx::WindowsStaticHermes::install(*hermesJsiRuntime_);\n'+anchor);
  const config='    config.withMicrotaskQueue(explicitMicrotasks_);';
  if(!source.includes('    config.withEnableEval(false);')){if(source.split(config).length!==2)throw Error('Pinned Hermes eval config changed');source=source.replace(config,'    config.withEnableEval(false);\n'+config);}
  const audit='    // Nelyx non-native execution audit v1\n';
  if(!source.includes(audit)){
    const bytecode='    bool isBytecode = api->isHermesBytecode(buffer->data(), buffer->size());';
    const begin=source.indexOf('  napi_status runScriptBuffer('),finish=source.indexOf('  napi_status deletePreparedScript(',begin),part=source.slice(begin,finish);
    if(part.split(bytecode).length!==3)throw Error('Pinned Hermes script audit anchors changed');
    let index=0;const changed=part.replaceAll(bytecode,()=>bytecode+'\n'+audit+'    if (!Nelyx::WindowsStaticHermes::admitNonNative('+String(index++===1)+', isBytecode)) return GENERIC_FAILURE("Static Hermes forbids source/bytecode fallback");');
    source=source.slice(0,begin)+changed+source.slice(finish);
    const prepared='    if (hermesPrep->bytecodeBuffer()) {';
    if(source.split(prepared).length!==2)throw Error('Pinned Hermes prepared audit anchor changed');
    source=source.replace(prepared,prepared+'\n      if (!Nelyx::WindowsStaticHermes::admitNonNative(false, true)) return GENERIC_FAILURE("Static Hermes forbids prepared bytecode fallback");');
  }
  const palMarker='    // Nelyx native RNW JSI manager v1\n';
  if(!source.includes(palMarker)){
    const nativeBlock=palMarker+'    if (Nelyx::WindowsStaticHermes::nativeStarted.load() && Nelyx::WindowsStaticHermes::isRnwPal(buffer->data(), buffer->size(), sourceURLStr)) {\n      Nelyx::WindowsStaticHermes::RnwPalAdmission admission;\n      napi_value global{}, entry{};\n      CHECK_STATUS(napi_get_global(env_, &global));\n      CHECK_STATUS(napi_get_named_property(env_, global, "__nelyxLoadRnwJsiPal", &entry));\n      return napi_call_function(env_, global, entry, 0, nullptr, result);\n    }\n';
    const start=source.indexOf('  napi_status runScriptBuffer('),at=source.indexOf('    facebook::hermes::IHermesRootAPI *api',start);if(at<0)throw Error('Pinned RNW JSI native run anchor changed');source=source.slice(0,at)+nativeBlock+source.slice(at);
    const begin=source.indexOf('  napi_status createPreparedScript('),offset=source.indexOf('    facebook::hermes::IHermesRootAPI *api',begin);if(offset<0)throw Error('Pinned RNW JSI native prepare anchor changed');source=source.slice(0,offset)+palMarker+'    if (Nelyx::WindowsStaticHermes::nativeStarted.load() && Nelyx::WindowsStaticHermes::isRnwPal(buffer->data(), buffer->size(), sourceURLStr)) {\n      *result = reinterpret_cast<jsr_prepared_script>(new NodeApiScriptModel(nullptr, std::move(buffer), sourceURLStr));\n      return ::hermes::node_api::clearLastNativeError(env_);\n    }\n'+source.slice(offset);
  }
  const insert=(begin,end,code)=>{
    const first=source.indexOf(begin),last=source.indexOf(end,first+begin.length),at='    std::string sourceURLStr = sourceURL ? sourceURL : "";';
    if(first<0||last<0)throw Error('Pinned Hermes native script entry changed');const body=source.slice(first,last);
    if(body.split(at).length!==2)throw Error('Pinned Hermes native script buffer changed');source=source.slice(0,first)+body.replace(at,at+'\n'+code)+source.slice(last);
  };
  insert('  napi_status runScriptBuffer(','  napi_status createPreparedScript(',`    // Nelyx native script admission v3: enter outside the interpreter frame.
    if (Nelyx::WindowsStaticHermes::isBundle(buffer->data(), buffer->size())) {
      Nelyx::WindowsStaticHermes::RootAdmission admission(Nelyx::WindowsStaticHermes::isAotBundle(buffer->data(), buffer->size()));
      napi_value global{}, entry{};
      CHECK_STATUS(napi_get_global(env_, &global));
      CHECK_STATUS(napi_get_named_property(env_, global, "__nelyxLoadStaticHermes", &entry));
      return napi_call_function(env_, global, entry, 0, nullptr, result);
    }`);
  insert('  napi_status createPreparedScript(','  napi_status deletePreparedScript(',`    if (Nelyx::WindowsStaticHermes::isBundle(buffer->data(), buffer->size())) {
      *result = reinterpret_cast<jsr_prepared_script>(
          new NodeApiScriptModel(nullptr, std::move(buffer), sourceURLStr));
      return ::hermes::node_api::clearLastNativeError(env_);
    }`);
  return source;
}
function capture(file,args,options={}){
  const result=spawnSync(file,args,{encoding:'utf8',windowsHide:true,timeout,maxBuffer:4*1024**2,...options});
  if(result.error||result.status!==0)throw Error(String(result.error??result.stderr??result.status));return result.stdout;
}
export function windowsCompilerEnvironment(){
  if(process.platform!=='win32'||process.arch!=='x64')throw Error('Static Hermes experiment requires Windows x64');
  const vswhere=path.join(process.env['ProgramFiles(x86)'],'Microsoft Visual Studio/Installer/vswhere.exe');
  const vs=capture(vswhere,['-latest','-products','*','-requires','Microsoft.VisualStudio.Component.VC.Tools.x86.x64','-property','installationPath']).trim();
  if(!vs||/[\r\n"&|<>]/.test(vs))throw Error('Visual Studio C++ tools unavailable');
  const setup=path.join(vs,'VC/Auxiliary/Build/vcvars64.bat');
  const output=capture('cmd.exe',['/d','/s','/c',`call "${setup}" >nul && set`],{windowsVerbatimArguments:true});
  const env=Object.fromEntries(Object.entries(process.env).map(([key,value])=>[key.toUpperCase(),value]));for(const line of output.split(/\r?\n/)){const at=line.indexOf('=');if(at>0)env[line.slice(0,at).toUpperCase()]=line.slice(at+1);}
  if(!env.INCLUDE||!env.LIB)throw Error('MSVC x64 environment unavailable');
  return env;
}
export function verifyWindowsStaticHermes(directory){
  directory=fs.realpathSync(directory);const manifest=JSON.parse(fs.readFileSync(localFile(directory,'static-hermes.json'),'utf8'));
  if(manifest.internalJavaScript?.mode!=='native'||manifest.internalJavaScript.sourceSha256!==windowsStaticHermesPin.internalJavaScriptSha256||manifest.internalJavaScript.compilerPolicy!==windowsHermesPolicy('optimized',nativeCohort('windows')).id||!Number.isSafeInteger(manifest.internalJavaScript.nativeFunctions)||manifest.internalJavaScript.nativeFunctions<1)throw Error('Static Hermes requires native internal JavaScript builtins');
  if(manifest.producerSha256!==producerSha256()||manifest.runtimePatchSha256!==runtimePatchSha256()||manifest.schema!=='nelyx.windows-static-hermes/v1'||manifest.revision!==windowsStaticHermesPin.revision||manifest.sourceSha256!==windowsStaticHermesPin.sourceSha256||manifest.baseRuntimeSha256!==windowsStaticHermesPin.runtimeSha256||manifest.bridgeSha256!==staticHermesBridgeSha256()||!/^[a-f0-9]{64}$/.test(manifest.runtimeSha256)||manifest.compilerProvenancePolicy!==compilerProvenancePolicy||manifest.mode!==windowsStaticHermesPin.mode||manifest.heap!=='HEAP_HV_64'||manifest.architecture!=='x64'||manifest.qualification!=='experimental')throw Error('Static Hermes compiler/VM identity differs');
  const names=new Set(manifest.files.map(record=>record.path));verifyInventory(directory,manifest.files,fileTree(directory).filter(name=>!names.has(name)));
  for(const name of ['build/bin/shermes.exe','build/API/hermes_shared/hermes.dll','build/API/hermes_shared/hermes.lib','build/lib/config/libhermesvm-config.h','source/include/hermes/VM/static_h.h','source/LICENSE'])if(!manifest.files.some(record=>record.path===name))throw Error('Incomplete Static Hermes toolchain: '+name);
  if(sha256(path.join(directory,'build/API/hermes_shared/hermes.dll'))!==manifest.runtimeSha256)throw Error('Static Hermes runtime hash differs');
  if(sha256(localFile(directory,'build/lib/InternalJavaScript/InternalBytecode.js'))!==manifest.internalJavaScript.sourceSha256||sha256(localFile(directory,'build/lib/InternalJavaScript/internal_unit.c'))!==manifest.internalJavaScript.unitSha256||!fs.readFileSync(localFile(directory,'build/CMakeCache.txt'),'utf8').includes('HERMESVM_INTERNAL_JAVASCRIPT_NATIVE:BOOL=ON'))throw Error('Static Hermes internal native source/configuration differs');
  return {directory,manifest,sha256:sha256(path.join(directory,'static-hermes.json'))};
}
/** One reusable source/toolchain directory. Never copies the RNW/SDK closure. */
export async function prepareWindowsStaticHermes({output,signal}={}){
  const env=windowsCompilerEnvironment();output=path.resolve(output??'.nelyx/windows-static-hermes');fs.mkdirSync(output,{recursive:true});
  if(fs.realpathSync(output)!==output)throw Error('Static Hermes build directory symlink rejected');
  if(fs.statfsSync(output).bavail*fs.statfsSync(output).bsize<20*1024**3)throw Error('Need 20 GiB before the Static Hermes toolchain build');
  if(fs.existsSync(path.join(output,'static-hermes.json'))){const previous=JSON.parse(fs.readFileSync(path.join(output,'static-hermes.json'),'utf8'));if(previous.producerSha256===producerSha256()&&previous.runtimePatchSha256===runtimePatchSha256()&&previous.bridgeSha256===staticHermesBridgeSha256()&&previous.compilerProvenancePolicy===compilerProvenancePolicy&&previous.internalJavaScript?.mode==='native'&&previous.baseRuntimeSha256)return verifyWindowsStaticHermes(output);}
  const archive=path.join(output,'hermes-source.tar.gz'),source=path.join(output,'source'),build=path.join(output,'build');
  if(!fs.existsSync(archive)){
    const downloadSignal=signal?AbortSignal.any([signal,AbortSignal.timeout(120000)]):AbortSignal.timeout(120000);
    const response=await fetch(windowsStaticHermesPin.sourceUrl,{signal:downloadSignal});if(!response.ok)throw Error('Static Hermes source download failed: '+response.status);
    const bytes=Buffer.from(await response.arrayBuffer());if(createHash('sha256').update(bytes).digest('hex')!==windowsStaticHermesPin.sourceSha256)throw Error('Static Hermes source archive differs');fs.writeFileSync(archive,bytes);
  }
  if(sha256(archive)!==windowsStaticHermesPin.sourceSha256)throw Error('Static Hermes source archive differs');
  if(!fs.existsSync(path.join(source,'CMakeLists.txt'))){fs.mkdirSync(source,{recursive:true});await execute('tar.exe',['-xzf',archive,'-C',source,'--strip-components=1'],{signal,timeout});}
  const compilerSources=patchStaticHermesCompiler(source);
  const internalCmake=path.join(source,'lib/InternalJavaScript/CMakeLists.txt'),internalOriginal=fs.readFileSync(internalCmake,'utf8').replaceAll('\r\n','\n'),internalFlags=windowsHermesPolicy('optimized',nativeCohort('windows')).flags.join(' ');
  const internalCommand=/COMMAND \$\{shermes_EXE\} .* -g0 -w -emit-c -exported-unit=internal_unit/;
  if(!internalCommand.test(internalOriginal))throw Error('Pinned internal JavaScript compiler command changed');
  let internalPatched=internalOriginal.replace(internalCommand,'COMMAND ${shermes_EXE} '+internalFlags+' -g0 -w -emit-c -exported-unit=internal_unit');
  if(!internalPatched.includes('# Nelyx internal native FP policy'))internalPatched=internalPatched.replace('  target_compile_options(hermesInternalUnit_obj PRIVATE -w)', '  target_compile_options(hermesInternalUnit_obj PRIVATE -w)\n  # Nelyx internal native FP policy\n  if(CMAKE_C_COMPILER_FRONTEND_VARIANT STREQUAL "MSVC")\n    target_compile_options(hermesInternalUnit_obj PRIVATE /clang:-ffp-contract=off /clang:-fno-fast-math)\n  else()\n    target_compile_options(hermesInternalUnit_obj PRIVATE -ffp-contract=off -fno-fast-math)\n  endif()');
  if(internalPatched!==internalOriginal)fs.writeFileSync(internalCmake,internalPatched);
  // RNW's Node-API adapter cannot expose IHermes. Add one global entry to the
  // underlying RuntimeWrapper; all existing exported APIs and RNW stay intact.
  const apiFile=path.join(source,'API/hermes_shared/hermes_api.cpp'),apiText=fs.readFileSync(apiFile,'utf8').replaceAll('\r\n','\n');
  const patched=patchStaticHermesRuntime(apiText);if(patched!==apiText)fs.writeFileSync(apiFile,patched);
  const cmakeFile=path.join(source,'API/hermes_shared/CMakeLists.txt'),cmakeText=fs.readFileSync(cmakeFile,'utf8');
  const cmakeMarker='# Nelyx Static Hermes entry';
  fs.writeFileSync(cmakeFile,cmakeText.split(cmakeMarker)[0]+cmakeMarker+'\ntarget_include_directories(libshared PRIVATE "'+path.dirname(bridgeHeader).replaceAll('\\','/')+'")\n');
  const jsiCmake=path.join(source,'API/jsi/jsi/CMakeLists.txt');
  fs.writeFileSync(jsiCmake,fs.readFileSync(jsiCmake,'utf8').split(cmakeMarker)[0]+cmakeMarker+'\nif(CMAKE_CXX_COMPILER_FRONTEND_VARIANT STREQUAL "MSVC")\n  target_compile_options(jsi PRIVATE /EHsc)\nendif()\n');
  const flagsFile=path.join(source,'cmake/modules/Hermes.cmake'),flagsText=fs.readFileSync(flagsFile,'utf8'),start=flagsText.indexOf('function(hermes_update_cxx_flags name)'),end=flagsText.indexOf('endfunction()',start);
  if(start<0||end<0)throw Error('Pinned Hermes C++ flag owner changed');
  const flagBody=flagsText.slice(start,end);
  if(!flagBody.includes('GCC_COMPATIBLE AND NOT')){
    if(flagBody.split('if (GCC_COMPATIBLE)').length!==5)throw Error('Pinned Hermes C++ flag branches changed');
    fs.writeFileSync(flagsFile,flagsText.slice(0,start)+flagBody.replaceAll('if (GCC_COMPATIBLE)','if (GCC_COMPATIBLE AND NOT CMAKE_CXX_COMPILER_FRONTEND_VARIANT STREQUAL "MSVC")')+flagsText.slice(end));
  }
  // Ninja avoids requiring the optional Visual Studio ClangCL MSBuild workload.
  const clang=path.join(process.env.ProgramFiles,'LLVM/bin/clang-cl.exe');
  if(!fs.existsSync(clang))throw Error('LLVM clang-cl is required for Static Hermes');
  const cache=path.join(build,'CMakeCache.txt'),fresh=fs.existsSync(cache)&&!fs.readFileSync(cache,'utf8').includes('CMAKE_GENERATOR:INTERNAL=Ninja');
  await execute('cmake',[...(fresh?['--fresh']:[]),'-S',source,'-B',build,'-G','Ninja','-DCMAKE_BUILD_TYPE=Release',`-DCMAKE_C_COMPILER=${clang}`,`-DCMAKE_CXX_COMPILER=${clang}`,'-DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreadedDLL','-DHERMES_ENABLE_DEBUGGER=ON','-DHERMES_ENABLE_TEST_SUITE=OFF','-DHERMES_ENABLE_NAPI=ON','-DHERMES_ENABLE_CORE_EXTENSIONS=ON','-DHERMESVM_HEAP_HV_MODE=HEAP_HV_64','-DHERMESVM_ALLOW_JIT=0','-DHERMESVM_INTERNAL_JAVASCRIPT_NATIVE=ON','-DSHERMES_CC=clang'],{env,signal,timeout});
  await execute('cmake',['--build',build,'--target','shermes','libshared','--parallel','6'],{env,signal,timeout});
  const internalSource=path.join(build,'lib/InternalJavaScript/InternalBytecode.js'),internalUnit=path.join(build,'lib/InternalJavaScript/internal_unit.c');
  if(sha256(internalSource)!==windowsStaticHermesPin.internalJavaScriptSha256)throw Error('Pinned internal JavaScript source differs');
  const internalFunctions=await readNativeFunctionMap(internalUnit,internalSource,'internal_unit');
  const internalJavaScript={mode:'native',sourceSha256:sha256(internalSource),unitSha256:sha256(internalUnit),compilerPolicy:windowsHermesPolicy('optimized',nativeCohort('windows')).id,nativeFunctions:internalFunctions.functions.length};
  const names=['source/lib/InternalJavaScript/CMakeLists.txt','build/lib/InternalJavaScript/InternalBytecode.js','build/lib/InternalJavaScript/internal_unit.c',...fs.readdirSync(path.join(source,'lib/InternalJavaScript')).filter(name=>name.endsWith('.js')).map(name=>'source/lib/InternalJavaScript/'+name),...compilerSources.map(file=>'source/'+file),'build/bin/shermes.exe','build/API/hermes_shared/hermes.dll','build/API/hermes_shared/hermes.lib','build/lib/config/libhermesvm-config.h','source/LICENSE','source/API/hermes_shared/hermes_api.cpp','source/API/hermes_shared/CMakeLists.txt','source/API/jsi/jsi/CMakeLists.txt','source/cmake/modules/Hermes.cmake'];
  // Include the complete transitive public C header closure in the identity.
  const visit=(folder,relative)=>{for(const item of fs.readdirSync(folder,{withFileTypes:true})){const name=path.posix.join(relative,item.name);if(item.isSymbolicLink())throw Error('Static Hermes header symlink');if(item.isDirectory())visit(path.join(folder,item.name),name);else names.push(name);}};
  visit(path.join(source,'include'),'source/include');
  const files=names.map(name=>({path:name,bytes:fs.statSync(path.join(output,name)).size,sha256:sha256(path.join(output,name))}));
  fs.writeFileSync(path.join(output,'static-hermes.json'),JSON.stringify({schema:'nelyx.windows-static-hermes/v1',compilerProvenancePolicy,producerSha256:producerSha256(),runtimePatchSha256:runtimePatchSha256(),internalJavaScript,revision:windowsStaticHermesPin.revision,sourceSha256:windowsStaticHermesPin.sourceSha256,baseRuntimeSha256:windowsStaticHermesPin.runtimeSha256,runtimeSha256:sha256(path.join(build,'API/hermes_shared/hermes.dll')),bridgeSha256:staticHermesBridgeSha256(),mode:windowsStaticHermesPin.mode,heap:'HEAP_HV_64',architecture:'x64',runtimeCrt:'vendor-hybrid',unitCrt:'MD',qualification:'experimental',files},null,2)+'\n');
  return verifyWindowsStaticHermes(output);
}
/** Compile a whole Metro JS bundle to one native SHUnit in the owning VM. */
export async function compileWindowsStaticHermes({toolchain,source,output,hermesDirectory,cohort,signal}){
  const checked=verifyWindowsStaticHermes(toolchain),env=windowsCompilerEnvironment();
  source=fs.realpathSync(source);output=path.resolve(output);hermesDirectory=fs.realpathSync(hermesDirectory);
  if(sha256(path.join(hermesDirectory,'build/native/win32/x64/hermes.dll'))!==windowsStaticHermesPin.runtimeSha256)throw Error('Static Hermes requires its exact native VM');
  if(fs.statfsSync(path.dirname(output)).bavail*fs.statfsSync(path.dirname(output)).bsize<20*1024**3)throw Error('Need 20 GiB before native AOT compilation');
  const policy=windowsHermesPolicy('optimized',cohort);
  const build=await compileHermesImage({checked,env,output,signal,units:[{name:windowsStaticHermesPin.unit,source,flags:policy.flags}]});
  return {mode:windowsStaticHermesPin.mode,revision:windowsStaticHermesPin.revision,toolchainSha256:checked.sha256,sourceSha256:sha256(source),librarySha256:sha256(output),libraryBytes:fs.statSync(output).size,compilerPolicy:policy.id,compilerFlags:policy.flags,build};
}
