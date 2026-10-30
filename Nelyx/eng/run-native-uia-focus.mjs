// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';import path from 'node:path';
import {buildNativeHost,root} from './build-native-hermes.mjs';
import {buildNativeApplication,verifyNativePackage} from '../sdk/tooling/cli/src/windows-native-runner.mjs';
import {startWindowsProcess} from '../sdk/tooling/cli/src/windows-process.mjs';
import {execute,capture} from '../sdk/tooling/cli/src/commands.mjs';
import {windowsCompilerEnvironment} from '../sdk/tooling/cli/src/windows-static-hermes.mjs';
import {verifyNativeProductSources,verifyNativeLoadedIdentity} from './tests/native-product-sources.mjs';
const timeout=1_200_000;
async function run(mode,product,pointer,range){
  if(!['bytecode','static-aot'].includes(mode))throw Error('Choose bytecode or static-aot');
  if(pointer&&!product)throw Error('--pointer requires the current --product package');
  if(range&&(!product||pointer))throw Error('--range requires --product and UIA input');
  const app=fs.realpathSync(path.join(root,'sample/nelyx-testbed-app-2')),parent=path.join(app,'.nelyx/native-windows');fs.mkdirSync(parent,{recursive:true});
  if(fs.realpathSync(parent)!==parent)throw Error('Native UIA diagnostic parent must be a real directory');
  const temporary=product?null:fs.mkdtempSync(path.join(parent,'.uia-fixture-')),controller=new AbortController(),deadline=setTimeout(()=>controller.abort(Error('Native UIA probe exceeded 20 minutes')),timeout);
  let running,abortStop,readyTimer;const interrupt=()=>controller.abort(Error('Native UIA probe interrupted'));process.on('SIGINT',interrupt);process.on('SIGTERM',interrupt);
  try{
    const hostBuild=await buildNativeHost({app,signal:controller.signal}),env=windowsCompilerEnvironment();
    await execute('cmake',['-S',path.join(hostBuild.roots['@nelyx/sdk'],'native/windows-hermes'),'-B',hostBuild.directory,'-DNELYX_HOST_TEST_SOURCE='+path.join(import.meta.dirname,'tests/native-hermes-host.cpp')],{env,signal:controller.signal,timeout});
    await execute('cmake',['--build',hostBuild.directory,'--target','NelyxNativeHostTests','--parallel','2'],{env,signal:controller.signal,timeout});
    let built,productSources;
    if(product){
      const directory=path.join(parent,'current-'+mode),checked=verifyNativePackage(directory);if(checked.manifest.mode!==mode||checked.manifest.sourceSha256!==hostBuild.manifest.sourceSha256||checked.manifest.qualification!=='experimental')throw Error('Rebuild the current product package before its UIA probe');
      productSources=verifyNativeProductSources({app,directory,mode});
      built={directory,executable:path.join(directory,'NelyxHermesHost.exe'),bundle:path.join(directory,checked.manifest.bundle),assetRoot:path.join(directory,'Assets')};
    }else{
      const config=JSON.parse(fs.readFileSync(path.join(app,'package.json'),'utf8')).nelyx,entry=path.join(temporary,'entry.ts');
      fs.copyFileSync(path.join(import.meta.dirname,'tests/native-uia-focus-fixture.ts'),path.join(temporary,'fixture.ts'));
      fs.writeFileSync(entry,'import {main as originalMain} from '+JSON.stringify(path.resolve(app,config.appEntry).replaceAll('\\','/'))+';\nimport {ComponentsGallery} from '+JSON.stringify(path.join(app,'src/gallery.ts').replaceAll('\\','/'))+';\nimport {installNativeUiaFocusProbe} from "./fixture.ts";\nexport function main(){installNativeUiaFocusProbe(ComponentsGallery);return originalMain();}\n');
      built=await buildNativeApplication({app,mode,hostBuild,diagnosticEntry:entry,output:path.join(temporary,'package'),signal:controller.signal});
    }
    const checked=verifyNativePackage(built.directory);
    let output='',errors='',partial='',overflow=false,resolveReady;const ready=new Promise(resolve=>{resolveReady=resolve;});
    const processEnv={...process.env,NELYX_NATIVE_FRAME_TRACE:product?'0':'1',NELYX_NATIVE_GC_STATS:'0',NELYX_NATIVE_CPU_PROFILE:'0'};delete processEnv.NELYX_NATIVE_DIAGNOSTICS;if(range)processEnv.NELYX_NATIVE_DIAGNOSTICS="1";
    running=startWindowsProcess(built.executable,[built.bundle,built.assetRoot,mode,'60000','1000','1000'],{cwd:built.directory,env:processEnv,verify:verifyNativePackage,onOutput(chunk,channel){
      if(output.length+errors.length+chunk.length>1024*1024){overflow=true;return;}if(channel==='stderr'){errors+=chunk;return;}output+=chunk;partial+=chunk;
      for(;;){const at=partial.indexOf('\n');if(at<0)break;const line=partial.slice(0,at).replace(/\r$/,'');partial=partial.slice(at+1);if(product&&line.startsWith('NELYX_NATIVE_FIRST_FRAME '))resolveReady({automationId:range?'slider-value':'field-filled',readiness:'native-first-frame'});else if(!product&&line.startsWith('NELYX_NATIVE_UIA_READY ')){try{resolveReady(JSON.parse(line.slice('NELYX_NATIVE_UIA_READY '.length)));}catch{resolveReady({error:'Malformed native UIA readiness report'});}}}
    }});
    abortStop=()=>{void running.stop();};controller.signal.addEventListener('abort',abortStop,{once:true});if(controller.signal.aborted)abortStop();
    const timed=new Promise(resolve=>{readyTimer=setTimeout(()=>resolve(null),30000);});
    const value=await Promise.race([ready,timed,running.completed.then(()=>null)]);clearTimeout(readyTimer);
    if(!value||typeof value.automationId!=='string'||!value.automationId.length||value.automationId.length>1024||overflow||controller.signal.aborted)throw Error('Native UIA provider was not ready: '+JSON.stringify({aborted:controller.signal.aborted,overflow,tail:output.slice(-5000),errors:errors.slice(-2000)}));
    console.log('NELYX_NATIVE_UIA_WINDOW '+JSON.stringify({pid:running.pid,mode,product,automationId:value.automationId}));
    let client,clientError;try{client=capture(path.join(hostBuild.directory,'NelyxNativeHostTests.exe'),['--uia-focus',String(running.pid),value.automationId,...(product?['--text-category']:[]),...(pointer?['--pointer']:[]),...(range?['--range']:[])],{cwd:hostBuild.directory,env,timeout:60000});}catch(error){clientError=String(error);}
    const closed=await running.stop();
    const loadedIdentity=verifyNativeLoadedIdentity(output,checked.manifest);
    console.log('NELYX_NATIVE_UIA_RESULT '+JSON.stringify({mode,sourceSha256:hostBuild.manifest.sourceSha256,loadedIdentity,productSources:productSources??null,provider:value,client:client??null,clientError:clientError??null,closed,native:output.split(/\r?\n/).filter(line=>/^NELYX_NATIVE_(?:UIA_STATE|EXIT|IDENTITY|VIEW|SEMANTICS_ACTION) /.test(line)),qualification:product?'experimental':'diagnostic-only',physicalIme:'notVerified',screenReader:'notVerified'}));
    if(clientError||overflow||closed.exitCode!==0||closed.forced||closed.error||/NELYX_NATIVE_\w*ERROR/.test(output+errors)||!(range?client?.includes('NELYX_NATIVE_UIA_RANGE '):client?.includes('"sameId":true')&&client.includes('"hasKeyboardFocus":true')))throw Error('External native UIA action did not qualify');
  }finally{
    clearTimeout(deadline);clearTimeout(readyTimer);process.off('SIGINT',interrupt);process.off('SIGTERM',interrupt);if(abortStop)controller.signal.removeEventListener('abort',abortStop);if(running)await running.stop();
    // oxlint-disable-next-line no-unsafe-finally -- Reject cleanup when directory ownership or rollback safety cannot be established.
    if(temporary){if(path.dirname(temporary)!==parent||!path.basename(temporary).startsWith('.uia-fixture-')||fs.lstatSync(temporary).isSymbolicLink())throw Error('UIA cleanup escaped its owned temporary directory');fs.rmSync(temporary,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
  }
}
try{const args=process.argv.slice(2),product=args.includes('--product'),pointer=args.includes('--pointer'),range=args.includes('--range'),modes=args.filter(value=>value!=='--product'&&value!=='--pointer'&&value!=='--range');if(modes.length>1||['--product','--pointer','--range'].some(flag=>args.filter(value=>value===flag).length>1))throw Error('Usage: run-native-uia-focus.mjs [bytecode|static-aot] [--product [--pointer|--range]]');await run(modes[0]??'bytecode',product,pointer,range);}catch(error){console.error(error.stack??error);process.exitCode=1;}
