// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';import {spawnSync} from 'node:child_process';
const operation=process.argv[2];if(!['pods','build','run'].includes(operation))throw new Error('Usage: native.mjs pods|build|run');
if(process.platform!=='darwin')throw new Error('Apple native commands require macOS/Xcode; use check/bundle/codegen/prepare:native for source checks');
const options={};if(operation!=='run'){for(let i=3;i<process.argv.length;i+=2){const key=process.argv[i],value=process.argv[i+1];if(!['--configuration','--derived-data'].includes(key)||!value||value.startsWith('--')||Object.hasOwn(options,key))throw new Error('Invalid Apple native build option');options[key]=value;}if(options['--configuration']&&options['--configuration']!=='Release')throw new Error('File bundle builds require Release');}
const runner=import.meta.dirname,native=path.dirname(runner),target=path.basename(native),app=path.dirname(native);
const name=JSON.parse(fs.readFileSync(path.join(app,'package.json'),'utf8')).nelyx.name,scheme=name+(target==='macos'?'-macOS':'');
function run(command,args,cwd=native){const result=spawnSync(command,args,{cwd,stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)throw new Error(command+' failed: '+result.status);}
run(process.execPath,[path.join(runner,'prepare.mjs')],runner);
run('pod',['install']);
if(operation==='build')run('xcodebuild',['-workspace',path.join(native,name+'.xcworkspace'),'-scheme',scheme,'-configuration','Release',...(options['--derived-data']?['-derivedDataPath',path.resolve(options['--derived-data'])]:[]),'CODE_SIGNING_ALLOWED=NO',...(target==='ios'?['-destination','generic/platform=iOS Simulator']:[]),'build']);
if(operation==='run'){const load=createRequire(import.meta.url);run(process.execPath,[load.resolve('@react-native-community/cli/build/bin.js'),target==='ios'?'run-ios':'run-macos',...process.argv.slice(3)],runner);}
