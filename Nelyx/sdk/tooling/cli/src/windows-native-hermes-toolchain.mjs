// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execute} from './commands.mjs';
import {sha256,fileTree,localFile} from './files.mjs';
import {openNativeBuildCache} from './native-build-cache.mjs';
import {windowsCompilerEnvironment,windowsStaticHermesPin} from './windows-static-hermes.mjs';
import {patchStaticHermesCompiler} from './static-hermes-compiler-patch.mjs';
import {windowsHermesPolicy} from './windows-hermes-policy.mjs';
import {nativeCohort} from '@nelyx/sdk/runtime/cohorts';
const timeout=1_200_000;
const producer=()=>createHash('sha256').update(JSON.stringify(['windows-native-hermes-toolchain.mjs','static-hermes-compiler-patch.mjs','windows-hermes-policy.mjs','windows-static-hermes.mjs'].map(name=>[name,sha256(path.join(import.meta.dirname,name))]))).digest('hex');
const sourceTree=directory=>createHash('sha256').update(JSON.stringify(fileTree(directory).map(name=>[name,sha256(path.join(directory,name))]))).digest('hex');
const names=['hermes-source.tar.gz','build/lib/hermesvm.dll','build/lib/hermesvm.lib','build/jsi/jsi.lib','build/bin/shermes.exe','build/bin/hermesc.exe','build/lib/config/libhermesvm-config.h','build/lib/InternalJavaScript/internal_unit.c','build/lib/InternalJavaScript/InternalBytecode.js','source/API/hermes/hermes.h','source/API/jsi/jsi/jsi.h','source/include/hermes/VM/static_h.h','source/lib/IRGen/ESTreeIRGen-legacy-class.cpp','source/lib/IRGen/ESTreeIRGen-func.cpp','source/lib/BCGen/SH/SH.cpp','source/cmake/modules/Hermes.cmake','source/API/jsi/jsi/CMakeLists.txt','source/lib/InternalJavaScript/CMakeLists.txt','build/CMakeCache.txt'];
function verifyFiles(directory,manifest){if(!Array.isArray(manifest.files)||!manifest.files.length)throw Error('Native Hermes toolchain inventory missing');for(const record of manifest.files)if(sha256(localFile(directory,record.path))!==record.sha256)throw Error('Native Hermes toolchain differs: '+record.path);}
export function verifyNativeHermes(directory){
  directory=fs.realpathSync(directory);const manifest=JSON.parse(fs.readFileSync(path.join(directory,'native-hermes.json'),'utf8'));
  if(manifest.schema!=='nelyx.native-hermes-toolchain/v3'||manifest.producerSha256!==producer()||manifest.revision!==windowsStaticHermesPin.revision||manifest.sourceSha256!==windowsStaticHermesPin.sourceSha256||manifest.jsi!==21||manifest.bytecodeVersion!==99||manifest.heap!=='HEAP_HV_64'||manifest.crt!=='MD'||manifest.internalJavaScript?.mode!=='native'||manifest.internalJavaScript.compilerPolicy!==windowsHermesPolicy('optimized',nativeCohort('windows')).id||manifest.debugger!==false||manifest.jit!==false)throw Error('Native Hermes pin/configuration/producer differs; prepare the current supplier');
  if(manifest.files.length!==names.length||new Set(manifest.files.map(file=>file.path)).size!==names.length||names.some(name=>!manifest.files.some(file=>file.path===name)))throw Error('Native Hermes toolchain inventory differs');verifyFiles(directory,manifest);
  if(sourceTree(path.join(directory,'source'))!==manifest.sourceTreeSha256)throw Error('Native Hermes source tree changed');
  return {directory,manifest,sha256:sha256(path.join(directory,'native-hermes.json'))};
}
export async function prepareNativeHermes({directory,signal}={}){
  if(!directory)throw Error('Choose the native Hermes toolchain directory');directory=path.resolve(directory);fs.mkdirSync(directory,{recursive:true});if(fs.realpathSync(directory)!==directory)throw Error('Native Hermes toolchain symlink rejected');
  const manifestFile=path.join(directory,'native-hermes.json'),recorded=fs.existsSync(manifestFile)?JSON.parse(fs.readFileSync(manifestFile,'utf8')):null;
  if(recorded){verifyFiles(directory,recorded);if(recorded.sourceTreeSha256&&sourceTree(path.join(directory,'source'))!==recorded.sourceTreeSha256)throw Error('Native Hermes source tree changed; supplied inputs were preserved');if(recorded.producerSha256===producer())return verifyNativeHermes(directory);}
  const owner=openNativeBuildCache(path.join(directory,'owner'));try{
  const archive=path.join(directory,'hermes-source.tar.gz'),source=path.join(directory,'source'),build=path.join(directory,'build'),env=windowsCompilerEnvironment();
  if(!fs.existsSync(archive)){const response=await fetch(windowsStaticHermesPin.sourceUrl,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(120000)]):AbortSignal.timeout(120000)});if(!response.ok)throw Error('Native Hermes source HTTP '+response.status);const bytes=Buffer.from(await response.arrayBuffer());if(createHash('sha256').update(bytes).digest('hex')!==windowsStaticHermesPin.sourceSha256)throw Error('Native Hermes archive differs');fs.writeFileSync(archive,bytes);}
  if(sha256(archive)!==windowsStaticHermesPin.sourceSha256)throw Error('Native Hermes archive differs');
  if(!fs.existsSync(path.join(source,'CMakeLists.txt'))){fs.mkdirSync(source,{recursive:true});await execute('tar.exe',['-xzf',archive,'-C',source,'--strip-components=1'],{env,signal,timeout});}
  patchSource(source);
  const check=fs.mkdtempSync(path.join(directory,'.source-check-'));let sourceTreeSha256;
  try{await execute('tar.exe',['-xzf',archive,'-C',check,'--strip-components=1'],{env,signal,timeout});patchSource(check);sourceTreeSha256=sourceTree(check);if(sourceTree(source)!==sourceTreeSha256)throw Error('Native Hermes source differs from the pinned archive and current patches');}
  finally{if(path.dirname(check)!==directory||!path.basename(check).startsWith('.source-check-')||fs.lstatSync(check).isSymbolicLink())throw Error('Unexpected Hermes source-check owner');fs.rmSync(check,{recursive:true,force:true});}
  const clang=path.join(process.env.ProgramFiles,'LLVM/bin/clang-cl.exe');
  await execute('cmake',['-S',source,'-B',build,'-G','Ninja','-DCMAKE_BUILD_TYPE=Release',`-DCMAKE_C_COMPILER=${clang}`,`-DCMAKE_CXX_COMPILER=${clang}`,'-DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreadedDLL','-DHERMES_ENABLE_DEBUGGER=OFF','-DHERMES_ENABLE_TEST_SUITE=OFF','-DHERMES_ENABLE_CORE_EXTENSIONS=ON','-DHERMESVM_HEAP_HV_MODE=HEAP_HV_64','-DHERMESVM_ALLOW_JIT=0','-DHERMESVM_INTERNAL_JAVASCRIPT_NATIVE=ON','-DSHERMES_CC=clang'],{env,signal,timeout});
  await execute('cmake',['--build',build,'--target','hermesvm','hermesc','shermes','jsi','--parallel','2'],{env,signal,timeout});
  if(sourceTree(source)!==sourceTreeSha256)throw Error('Native Hermes source changed during compilation');
  const policy=windowsHermesPolicy('optimized',nativeCohort('windows'));
  const manifest={schema:'nelyx.native-hermes-toolchain/v3',producerSha256:producer(),revision:windowsStaticHermesPin.revision,sourceSha256:windowsStaticHermesPin.sourceSha256,sourceTreeSha256,bytecodeVersion:99,jsi:21,heap:'HEAP_HV_64',crt:'MD',internalJavaScript:{mode:'native',compilerPolicy:policy.id,sourceSha256:sha256(path.join(build,'lib/InternalJavaScript/InternalBytecode.js'))},debugger:false,jit:false,files:names.map(name=>({path:name,sha256:sha256(path.join(directory,name))}))};
  fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');return verifyNativeHermes(directory);
  }finally{owner.close();}
}
function write(file,text){if(fs.readFileSync(file,'utf8')!==text)fs.writeFileSync(file,text);}
function patchSource(source){
  patchStaticHermesCompiler(source);
  const flags=path.join(source,'cmake/modules/Hermes.cmake');let text=fs.readFileSync(flags,'utf8');const begin=text.indexOf('function(hermes_update_cxx_flags name)'),end=text.indexOf('endfunction()',begin);if(begin<0||end<0)throw Error('Pinned Hermes C++ configuration changed');text=text.slice(0,begin)+text.slice(begin,end).replaceAll('if (GCC_COMPATIBLE)','if (GCC_COMPATIBLE AND NOT CMAKE_CXX_COMPILER_FRONTEND_VARIANT STREQUAL "MSVC")')+text.slice(end);write(flags,text);
  const jsi=path.join(source,'API/jsi/jsi/CMakeLists.txt'),marker='# Nelyx direct Hermes exception ownership';const jsiText=fs.readFileSync(jsi,'utf8').split(marker)[0].trimEnd();write(jsi,jsiText+'\n\n'+marker+'\nif(MSVC)\n  target_compile_options(jsi PRIVATE /EHsc)\nendif()\n');
  const internal=path.join(source,'lib/InternalJavaScript/CMakeLists.txt'),policy=windowsHermesPolicy('optimized',nativeCohort('windows'));let internalText=fs.readFileSync(internal,'utf8');const command=/COMMAND \$\{shermes_EXE\} .* -g0 -w -emit-c -exported-unit=internal_unit/;if(!command.test(internalText))throw Error('Pinned Hermes native builtins command differs');internalText=internalText.replace(command,'COMMAND ${shermes_EXE} '+policy.flags.join(' ')+' -g0 -w -emit-c -exported-unit=internal_unit');
  if(!internalText.includes('# Nelyx direct builtin floating point'))internalText=internalText.replace('  target_compile_options(hermesInternalUnit_obj PRIVATE -w)','  target_compile_options(hermesInternalUnit_obj PRIVATE -w)\n  # Nelyx direct builtin floating point\n  target_compile_options(hermesInternalUnit_obj PRIVATE /clang:-ffp-contract=off /clang:-fno-fast-math)');write(internal,internalText);
}
