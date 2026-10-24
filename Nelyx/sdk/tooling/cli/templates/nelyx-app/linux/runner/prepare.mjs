// SPDX-License-Identifier: BSD-3-Clause
import path from 'node:path';import {configureLinuxApplication,prepareLinux,doctorLinux} from '@nelyx/cli/linux-runner';
const app=path.resolve(import.meta.dirname,'../..'),index=process.argv.indexOf('--native-inputs');
console.log(JSON.stringify(index<0?await configureLinuxApplication({app}):await prepareLinux({app,nativeInputs:path.resolve(process.argv[index+1])})));
if(process.argv.includes('--doctor'))console.log(JSON.stringify(await doctorLinux({app})));
