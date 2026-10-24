// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const load=createRequire(import.meta.url),{runBuild,loadConfig}=load('metro');
const output=path.join(import.meta.dirname,'.bundle');fs.mkdirSync(output,{recursive:true});
await runBuild(await loadConfig({cwd:import.meta.dirname,config:path.join(import.meta.dirname,'metro.config.cjs')}),{entry:'main.tsx',platform:'windows',dev:false,minify:true,maxWorkers:2,out:path.join(output,'index.windows.bundle'),sourceMap:true,sourceMapUrl:'index.windows.bundle.map'});
