#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
import path from 'node:path';
import {createApp} from './create-app.mjs';
import {packageReferences,supplyRunner,readRnlSupply} from './supply-runner.mjs';
import {devNative} from './native-development.mjs';
import {doctorWindows,prepareWindows,buildWindows,runWindows,packWindows} from './windows-runner.mjs';
import {doctorLinux,prepareLinux,buildLinux,runLinux,packLinux} from './linux-runner.mjs';
import {doctorAndroid,prepareAndroid,buildAndroid,runAndroid,packAndroid} from './android-runner.mjs';
import {doctorApple,prepareApple,buildApple,runApple,packApple} from './apple-runner.mjs';
import {doctorWeb,prepareWeb,buildWebApplication,runWeb,packWeb,devWeb} from './web-runner.mjs';
const usage='Usage: nelyx create|supply|doctor|prepare|build|run|dev|pack --app <app> --target windows|linux|android|ios|macos|web [--package <directory>] [--output <new-path>]';
try{
  const args=process.argv.slice(2),operation=args.shift(),values={},nativeArguments=[];
  if(!operation||operation==='--help'){console.log(usage);process.exit(0);}
  const destination=operation==='create'?args.shift():undefined;
  if(!['create','supply','doctor','prepare','build','run','dev','pack'].includes(operation))throw new Error(usage);
  while(args.length){const name=args.shift();if(name==='--'){nativeArguments.push(...args);break;}if(!/^--[a-z-]+$/.test(name))throw new Error(usage);const key=name.slice(2),value=args.shift();if(Object.hasOwn(values,key)||!value||value.startsWith('--'))throw new Error(usage);values[key]=value;}
  if(operation==='create'){
    if(!destination)throw new Error('Usage: nelyx create <empty-directory> [--name AppName] [--target web|android|windows|linux|ios|macos] [--designs none|material|cupertino|material,cupertino] [--packages <archive-directory>]');
    for(const key of Object.keys(values))if(!['name','target','packages','designs'].includes(key))throw new Error('Unknown create option: '+key);
    const refs=values.packages?packageReferences(path.resolve(values.packages)):{};
    const target=values.target;
    if(target&&!['android','web','windows','linux','ios','macos'].includes(target))throw new Error('Unknown create target');
    const designs=values.designs===undefined?undefined:values.designs==='none'?[]:values.designs.split(',');
    console.log(await createApp(destination,refs.sdk,values.name??'NelyxApp',refs.core,{...refs,...(designs?{designs}:{}),...(target?{targets:[target]}:{})}));
    process.exit(0);
  }
  if(operation==='supply'){
    for(const key of Object.keys(values))if(!['app','target','packages','rnl-supply'].includes(key))throw new Error('Unknown supply option: '+key);
    if(!values.packages||!values.target)throw new Error('Usage: nelyx supply --app <app> --target <target> --packages <archive-directory>');
    if(values['rnl-supply']&&values.target!=='linux')throw new Error('--rnl-supply requires Linux');
    console.log(supplyRunner({app:path.resolve(values.app??process.cwd()),target:values.target,packages:path.resolve(values.packages),extra:values['rnl-supply']?readRnlSupply(path.resolve(values['rnl-supply'])):{}}));process.exit(0);
  }
  const target=values.target??'windows';if(!['windows','linux','android','ios','macos','web'].includes(target))throw new Error('Unknown CLI target: '+target);
  const allowed={dev:['host','port','launch'],doctor:[],prepare:[],build:['output'],run:['package'],pack:['package','output']};
  if(target==='windows'){for(const op of ['doctor','prepare','build','run','pack'])allowed[op].push('host');allowed.prepare.push('native-inputs','engine','engine-inputs','hermes-mode','jsc-mode');allowed.build.push('native-inputs','configuration','engine','engine-inputs','hermes-profile','hermes-mode','jsc-mode');allowed.run.push('hermes-mode');allowed.pack.push('hermes-mode');allowed.dev.push('native-inputs');}
  if(target==='linux'){allowed.doctor.push('native-inputs');allowed.prepare.push('native-inputs');allowed.build.push('native-inputs','configuration','hermes-source','build-directory');allowed.dev.push('native-inputs','hermes-source','build-directory');}
  if(target==='android'){allowed.doctor.push('android-sdk');allowed.build.push('android-sdk','configuration','architecture','port');allowed.run.push('android-sdk','device');allowed.dev.push('android-sdk','device','architecture');}
  if(target==='ios'||target==='macos')allowed.build.push('configuration');if(target==='ios'){allowed.run.push('device');allowed.dev.push('device');}
  if(target==='web'){allowed.build.push('configuration');allowed.run.push('host','port');allowed.dev=['host','port'];}
  for(const key of Object.keys(values))if(!['app','target',...allowed[operation]].includes(key))throw new Error(`Option --${key} is not supported by ${target} ${operation}`);
  if(nativeArguments.length&&(operation!=='run'||!['windows','linux','ios','macos'].includes(target)))throw new Error('Executable arguments require Windows/Linux/Apple run');
  if(operation==='prepare'&&!values['native-inputs']&&target==='linux')throw new Error('Linux prepare requires explicit --native-inputs');
  if(values.launch!==undefined&&!['true','false'].includes(values.launch))throw new Error('--launch requires true or false');
  const options={launch:values.launch!=='false',app:path.resolve(values.app??process.cwd()),target,nativeInputs:values['native-inputs'],output:values.output,directory:values.package,arguments:nativeArguments,configuration:values.configuration,engine:values.engine,engineInputs:values['engine-inputs'],hermesProfile:values['hermes-profile'],hermesMode:values['hermes-mode'],jscMode:values['jsc-mode'],hermesSource:values['hermes-source'],buildDirectory:values['build-directory'],androidSdk:values['android-sdk'],architecture:values.architecture,device:values.device,host:values.host,...(values.port!==undefined?{port:Number(values.port)}:{})};
  const adapters={windows:{doctor:doctorWindows,prepare:prepareWindows,build:buildWindows,run:runWindows,pack:packWindows},linux:{doctor:doctorLinux,prepare:prepareLinux,build:buildLinux,run:runLinux,pack:packLinux},android:{doctor:doctorAndroid,prepare:prepareAndroid,build:buildAndroid,run:runAndroid,pack:packAndroid},ios:{doctor:doctorApple,prepare:prepareApple,build:buildApple,run:runApple,pack:packApple},macos:{doctor:doctorApple,prepare:prepareApple,build:buildApple,run:runApple,pack:packApple},web:{doctor:doctorWeb,prepare:prepareWeb,build:buildWebApplication,run:runWeb,pack:packWeb}}[target];
  if(target==='windows'&&operation!=='dev'&&values.host!==undefined&&!['rnw','native-hermes'].includes(values.host))throw Error('Choose Windows --host rnw or native-hermes');
  const result=target==='windows'&&values.host==='native-hermes'?await (await import('./windows-native-runner.mjs')).nativeWindowsOperation(operation,options):await (operation==='dev'?(target==='web'?devWeb:devNative):adapters[operation])(options);
  console.log(JSON.stringify(result,null,2));if(operation==='run'||operation==='dev')process.exitCode=result.exitCode;
}catch(error){console.error(String(error));process.exitCode=1;}
