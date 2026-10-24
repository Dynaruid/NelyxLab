// SPDX-License-Identifier: BSD-3-Clause
import path from 'node:path';import {createRequire} from 'node:module';import {spawnSync} from 'node:child_process';
const load=createRequire(import.meta.url),target=path.basename(path.dirname(import.meta.dirname));
const framework=target==='macos'?'react-native-macos':'react-native';
const script=path.join(path.dirname(load.resolve(framework+'/package.json')),'scripts/generate-codegen-artifacts.js');
const result=spawnSync(process.execPath,[script,'-p','.', '-t','ios','-o','../generated-codegen'],{cwd:import.meta.dirname,stdio:'inherit',windowsHide:true});if(result.error)throw result.error;process.exitCode=result.status??1;
