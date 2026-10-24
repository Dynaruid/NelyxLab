// SPDX-License-Identifier: BSD-3-Clause
import path from 'node:path';import fs from 'node:fs';import {spawnSync} from 'node:child_process';import {configureRunner} from '@nelyx/cli/runner-configuration';
import {prepareAndroidHermesBuild,finishAndroidHermesBuild} from '@nelyx/cli/android-hermes-policy';
import {prepareDevelopmentKey} from './development-key.mjs';
const runner=import.meta.dirname,app=path.resolve(runner,'../..'),value=await configureRunner({app,target:'android'}),argument=(name,fallback)=>{const index=process.argv.indexOf(name);return index<0?fallback:process.argv[index+1];};
const configuration=argument('--configuration','Release'),architecture=argument('--architecture','arm64-v8a'),port=Number(argument('--port','8081'));
if(!['Debug','Release'].includes(configuration)||!['arm64-v8a','x86_64'].includes(architecture)||!Number.isSafeInteger(port)||port<1||port>65535)throw new Error('Invalid Android configuration/architecture/port');
if(value.config.profile==='emulator-vulkan'&&architecture!=='x86_64')throw new Error('The emulator profile requires x86_64');
const hermesInput=prepareAndroidHermesBuild(app,value.config.cohort);
prepareDevelopmentKey();
const gradleArgs=['assemble'+configuration,'-PreactNativeArchitectures='+architecture,'-PreactNativeDevServerPort='+port,'--no-daemon','--max-workers=2'];
const result=process.platform==='win32'?spawnSync('cmd.exe',['/d','/c','gradlew.bat',...gradleArgs],{cwd:path.join(app,'android'),stdio:'inherit',windowsHide:true}):spawnSync('./gradlew',gradleArgs,{cwd:path.join(app,'android'),stdio:'inherit'});
if(result.error)throw result.error;if(result.status!==0)throw new Error('Android native build failed: '+result.status);
const apk=path.join(app,'android/app/build/outputs/apk',configuration.toLowerCase(),'app-'+configuration.toLowerCase()+'.apk');if(!fs.statSync(apk).isFile())throw new Error('Android build produced no APK');
const hermes=finishAndroidHermesBuild(hermesInput);
console.log(JSON.stringify({...hermes,result:'PASS-scoped',target:'android',apk,architecture,configuration,profile:value.config.profile,signing:'local development key; production signing notVerified',runtime:'notVerified',qualification:'notVerified'}));
