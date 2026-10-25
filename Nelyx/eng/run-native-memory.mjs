// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {buildNativeHost,root} from './build-native-hermes.mjs';
import {verifyNativePackage} from '../sdk/tooling/cli/src/windows-native-runner.mjs';
import {startWindowsProcess} from '../sdk/tooling/cli/src/windows-process.mjs';
import {execute,capture} from '../sdk/tooling/cli/src/commands.mjs';
import {windowsCompilerEnvironment} from '../sdk/tooling/cli/src/windows-static-hermes.mjs';
import {verifyNativeProductSources,verifyNativeLoadedIdentity} from './tests/native-product-sources.mjs';
import {verifyNativeMemoryCycles,verifyNativeMemoryRegions} from './tests/native-memory-results.mjs';
const timeout=1_200_000;
export function nativeMemoryOptions(args){
  const result={mode:'bytecode',viewport:'maximized',cycles:6},names=new Map([['--hermes-mode','mode'],['--viewport','viewport'],['--cycles','cycles']]),seen=new Set();
  for(let index=0;index<args.length;index+=2){const name=args[index],key=names.get(name),value=args[index+1];if(!key||seen.has(name)||!value||value.startsWith('--'))throw Error('Choose --hermes-mode bytecode|static-aot|both, --viewport default|maximized|both and --cycles 3..30');seen.add(name);result[key]=value;}
  if(!['bytecode','static-aot','both'].includes(result.mode)||!['default','maximized','both'].includes(result.viewport)||!/^\d+$/.test(String(result.cycles)))throw Error('Invalid native memory mode/viewport/count');result.cycles=Number(result.cycles);
  const runs=(result.mode==='both'?2:1)*(result.viewport==='both'?2:1);
  if(!Number.isSafeInteger(result.cycles)||result.cycles<3||result.cycles*runs>30)throw Error('Native memory workload requires 3..30 cycles per process and at most 30 across this invocation');return result;
}
export async function runNativeMemory(options){
  options={mode:'bytecode',viewport:'maximized',cycles:6,...options};options=nativeMemoryOptions(['--hermes-mode',options.mode,'--viewport',options.viewport,'--cycles',String(options.cycles)]);
  const app=fs.realpathSync(path.join(root,'sample/nelyx-testbed-app-2')),parent=path.join(app,'.nelyx/native-windows'),controller=new AbortController(),deadline=setTimeout(()=>controller.abort(Error('Native memory probe exceeded 20 minutes')),timeout);
  let running,abortStop;const interrupt=()=>controller.abort(Error('Native memory probe interrupted'));process.on('SIGINT',interrupt);process.on('SIGTERM',interrupt);
  try{
    const host=await buildNativeHost({app,signal:controller.signal}),env=windowsCompilerEnvironment();
    await execute('cmake',['-S',path.join(host.roots['@nelyx/sdk'],'native/windows-hermes'),'-B',host.directory,'-DNELYX_HOST_TEST_SOURCE='+path.join(import.meta.dirname,'tests/native-hermes-host.cpp')],{env,signal:controller.signal,timeout});
    await execute('cmake',['--build',host.directory,'--target','NelyxNativeHostTests','--parallel','2'],{env,signal:controller.signal,timeout});
    const results=[];
    for(const mode of options.mode==='both'?['bytecode','static-aot']:[options.mode]){
      const directory=path.join(parent,'current-'+mode),checked=verifyNativePackage(directory),source=verifyNativeProductSources({app,directory,mode});
      if(checked.manifest.sourceSha256!==host.manifest.sourceSha256||checked.manifest.toolchainSha256!==host.manifest.toolchainSha256)throw Error('Rebuild the current native products before their memory probe');
      for(const viewport of options.viewport==='both'?['default','maximized']:[options.viewport]){
        let output='',errors='',partial='',overflow=false,readyTimer,resolveReady;const ready=new Promise(resolve=>{resolveReady=resolve;});
        const processEnv={...process.env,NELYX_NATIVE_MEMORY_PROBE:'1',NELYX_NATIVE_FRAME_TRACE:'1',NELYX_NATIVE_GC_STATS:'0',NELYX_NATIVE_CPU_PROFILE:'0'};delete processEnv.NELYX_NATIVE_DIAGNOSTICS;
        console.log('NELYX_NATIVE_MEMORY_READY '+JSON.stringify({mode,viewport,cycles:options.cycles,sourceSha256:host.manifest.sourceSha256,qualification:'diagnostic-only',desktopInput:'must remain idle'}));
        running=startWindowsProcess(path.join(directory,'NelyxHermesHost.exe'),[path.join(directory,checked.manifest.bundle),path.join(directory,'Assets'),mode,'180000','1000','1000'],{cwd:directory,env:processEnv,verify:verifyNativePackage,onOutput(chunk,channel){if(output.length+errors.length+chunk.length>1024*1024){overflow=true;return;}if(channel==='stderr'){errors+=chunk;return;}output+=chunk;partial+=chunk;let at;while((at=partial.indexOf('\n'))>=0){const line=partial.slice(0,at).replace(/\r$/,'');partial=partial.slice(at+1);if(line.startsWith('NELYX_NATIVE_FIRST_FRAME '))resolveReady(true);}}});
        abortStop=()=>{void running.stop();};controller.signal.addEventListener('abort',abortStop,{once:true});if(controller.signal.aborted)abortStop();
        let client;
        try{
          const becameReady=await Promise.race([ready,running.completed.then(()=>false),new Promise(resolve=>{readyTimer=setTimeout(()=>resolve(false),30000);})]);clearTimeout(readyTimer);
          if(!becameReady||controller.signal.aborted)throw Error('Native memory product did not become ready');
          client=capture(path.join(host.directory,'NelyxNativeHostTests.exe'),['--uia-resources',String(running.pid),String(options.cycles),viewport],{cwd:host.directory,env,timeout:180000});
          const end=Date.now()+10000;while(Date.now()<end&&output.split('\n').filter(line=>line.startsWith('NELYX_NATIVE_MEMORY ')).length<options.cycles+1){if(controller.signal.aborted)throw controller.signal.reason;await delay(50);}
          const closed=await running.stop();controller.signal.removeEventListener('abort',abortStop);abortStop=undefined;
          const records=(text,prefix)=>text.split(/\r?\n/).filter(line=>line.startsWith(prefix)).map(line=>JSON.parse(line.slice(prefix.length)));
          const points=records(output,'NELYX_NATIVE_MEMORY '),workloads=records(client,'NELYX_NATIVE_MEMORY_WORKLOAD '),exits=records(output,'NELYX_NATIVE_EXIT ');
          for(const point of points)console.log('NELYX_NATIVE_MEMORY_POINT '+JSON.stringify({mode,viewport,...point}));
          if(overflow||closed.exitCode!==0||closed.forced||closed.error||exits.length!==1||exits[0].exitCode!==0||/NELYX_NATIVE_\w*ERROR/.test(output+errors))throw Error('Native memory product did not close normally');
          const loadedIdentity=verifyNativeLoadedIdentity(output,checked.manifest);
          // Preserve the verified product identity even when a fixed memory
          // limit rejects the observation. No durable receipt is written.
          console.log('NELYX_NATIVE_MEMORY_IDENTITY '+JSON.stringify({mode,viewport,sourceSha256:host.manifest.sourceSha256,source,loadedIdentity,exit:exits[0],closed}));
          const regionRecords=records(client,'NELYX_NATIVE_MEMORY_REGIONS '),addressSpace=verifyNativeMemoryRegions(regionRecords,{pid:running.pid,cycles:options.cycles});
          for(const row of regionRecords)console.log('NELYX_NATIVE_MEMORY_REGIONS '+JSON.stringify({mode,viewport,...row}));
          const memory=verifyNativeMemoryCycles(points,workloads,{pid:running.pid,mode,cycles:options.cycles});
          const result={mode,viewport,sourceSha256:host.manifest.sourceSha256,source,loadedIdentity,exit:exits[0],closed,memory,addressSpace};results.push(result);console.log('NELYX_NATIVE_MEMORY_RESULT '+JSON.stringify(result));
        }catch(error){console.error('NELYX_NATIVE_MEMORY_FAILURE '+JSON.stringify({mode,viewport,error:String(error),tail:output.slice(-14000),errors:errors.slice(-3000),client:client??null}));throw error;}
        finally{clearTimeout(readyTimer);if(abortStop)controller.signal.removeEventListener('abort',abortStop);abortStop=undefined;if(running)await running.stop();running=undefined;}
      }
    }
    return results;
  }finally{clearTimeout(deadline);process.off('SIGINT',interrupt);process.off('SIGTERM',interrupt);if(abortStop)controller.signal.removeEventListener('abort',abortStop);if(running)await running.stop();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))try{await runNativeMemory(nativeMemoryOptions(process.argv.slice(2)));}catch(error){console.error(error.stack??error);process.exitCode=1;}
