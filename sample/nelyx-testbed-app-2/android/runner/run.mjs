// SPDX-License-Identifier: BSD-3-Clause
import path from 'node:path';import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';import {configureRunner} from '@nelyx/cli/runner-configuration';
import {prepareDevelopmentKey} from './development-key.mjs';
await configureRunner({app:path.resolve(import.meta.dirname,'../..'),target:'android'});
prepareDevelopmentKey();
const load=createRequire(import.meta.url),child=spawnSync(process.execPath,[load.resolve('@react-native-community/cli/build/bin.js'),'run-android',...process.argv.slice(2)],{cwd:import.meta.dirname,stdio:'inherit',windowsHide:true});
if(child.error)throw child.error;process.exitCode=child.status??1;
