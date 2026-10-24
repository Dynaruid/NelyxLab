// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execute} from './commands.mjs';
import {windowsCompilerEnvironment,windowsStaticHermesPin} from './windows-static-hermes.mjs';
import {patchStaticHermesCompiler} from './static-hermes-compiler-patch.mjs';

const timeout=1_200_000;
const digest=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
export const nativeHermesPin=Object.freeze({revision:windowsStaticHermesPin.revision,sourceSha256:windowsStaticHermesPin.sourceSha256,bytecodeVersion:99,jsi:21,heap:'HEAP_HV_64',crt:'MD'});

/** A separate direct-JSI VM. No Node-API/RNW target is linked into this DLL. */
export async function prepareNativeHermes({directory,signal}={}){
  const env=windowsCompilerEnvironment();
  directory=path.resolve(directory??'.nelyx/windows-hermes');
  fs.mkdirSync(directory,{recursive:true});
  if(fs.realpathSync(directory)!==directory)throw Error('Direct Hermes directory must not be a symlink');
  const source=path.join(directory,'source'),build=path.join(directory,'build'),archive=path.join(directory,'hermes-source.tar.gz');
  if(!fs.existsSync(path.join(source,'CMakeLists.txt'))){
    try{
      const response=await fetch(windowsStaticHermesPin.sourceUrl,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(120000)]):AbortSignal.timeout(120000)});
      if(!response.ok)throw Error('Direct Hermes source download failed: '+response.status);
      const bytes=Buffer.from(await response.arrayBuffer());
      if(createHash('sha256').update(bytes).digest('hex')!==nativeHermesPin.sourceSha256)throw Error('Direct Hermes archive identity differs');
      fs.writeFileSync(archive,bytes);fs.mkdirSync(source,{recursive:true});
      await execute('tar.exe',['-xzf',archive,'-C',source,'--strip-components=1'],{signal,timeout});
    }finally{fs.rmSync(archive,{force:true});}
  }
  const compilerSources=patchStaticHermesCompiler(source);
  const flagsFile=path.join(source,'cmake/modules/Hermes.cmake');
  const flags=fs.readFileSync(flagsFile,'utf8'),begin=flags.indexOf('function(hermes_update_cxx_flags name)'),end=flags.indexOf('endfunction()',begin);
  if(begin<0||end<0)throw Error('Pinned Hermes compiler flag owner changed');
  const body=flags.slice(begin,end);
  if(!body.includes('GCC_COMPATIBLE AND NOT'))fs.writeFileSync(flagsFile,flags.slice(0,begin)+body.replaceAll('if (GCC_COMPATIBLE)','if (GCC_COMPATIBLE AND NOT CMAKE_CXX_COMPILER_FRONTEND_VARIANT STREQUAL "MSVC")')+flags.slice(end));
  const jsiFile=path.join(source,'API/jsi/jsi/CMakeLists.txt'),jsi=fs.readFileSync(jsiFile,'utf8'),marker='# Nelyx direct Hermes exception ownership';
  if(!jsi.includes(marker))fs.appendFileSync(jsiFile,'\n'+marker+'\nif(MSVC)\n  target_compile_options(jsi PRIVATE /EHsc)\nendif()\n');
  const clang=path.join(process.env.ProgramFiles,'LLVM/bin/clang-cl.exe');
  await execute('cmake',['-S',source,'-B',build,'-G','Ninja','-DCMAKE_BUILD_TYPE=Release','-DCMAKE_C_COMPILER='+clang,'-DCMAKE_CXX_COMPILER='+clang,'-DCMAKE_CXX_FLAGS=/DCREATE_SHARED_LIBRARY','-DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreadedDLL','-DHERMES_ENABLE_DEBUGGER=OFF','-DHERMES_ENABLE_TEST_SUITE=OFF','-DHERMES_ENABLE_CORE_EXTENSIONS=ON','-DHERMESVM_HEAP_HV_MODE=HEAP_HV_64','-DHERMESVM_ALLOW_JIT=0','-DHERMESVM_INTERNAL_JAVASCRIPT_NATIVE=ON','-DSHERMES_CC=clang'],{env,signal,timeout});
  await execute('cmake',['--build',build,'--target','hermesvm','shermes','hermesc','--parallel','6'],{env,signal,timeout});
  const names=['build/lib/hermesvm.dll','build/lib/hermesvm.lib','build/bin/shermes.exe','build/bin/hermesc.exe','build/lib/config/libhermesvm-config.h',...compilerSources.map(name=>'source/'+name)];
  const files=names.map(name=>({path:name,sha256:digest(path.join(directory,name))}));
  const manifest={schema:'nelyx.native-hermes-toolchain/v1',...nativeHermesPin,internalJavaScript:'native',debugger:false,jit:false,files};
  fs.writeFileSync(path.join(directory,'native-hermes.json'),JSON.stringify(manifest,null,2)+'\n');
  return {directory,source,build,env,manifest};
}
