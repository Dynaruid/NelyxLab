// SPDX-License-Identifier: BSD-3-Clause
import path from 'node:path';
import {buildNativeHost,root} from './build-native-hermes.mjs';
import {buildNativeApplication,runNativeApplication} from '../sdk/tooling/cli/src/windows-native-runner.mjs';
const args=process.argv.slice(2),option=(name,fallback)=>{const at=args.indexOf(name);if(at>=0&&(!args[at+1]||args[at+1].startsWith('--')))throw Error('Missing option value: '+name);return at<0?fallback:args[at+1];};
try{
  const app=path.resolve(option('--app',path.join(root,'sample/nelyx-testbed-app-2'))),mode=option('--hermes-mode','bytecode');
  for(const name of args.filter(value=>value.startsWith('--')))if(!['--app','--hermes-mode','--duration-ms','--build-only','--output'].includes(name))throw Error('Unknown native host option: '+name);
  const hostBuild=await buildNativeHost({app}),built=await buildNativeApplication({app,mode,hostBuild,...(args.includes('--output')?{output:path.resolve(option('--output'))}:{})});
  console.log('NELYX_NATIVE_PACKAGE '+JSON.stringify(built));
  if(!args.includes('--build-only')){const result=await runNativeApplication({app,directory:built.directory,arguments:[option('--duration-ms','0')]});console.log(JSON.stringify(result));process.exitCode=result.exitCode;}
}catch(error){console.error(error.stack??error);process.exitCode=1;}
