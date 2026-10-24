// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const load=createRequire(import.meta.url),app=path.resolve(import.meta.dirname,'../..'),config=JSON.parse(fs.readFileSync(path.join(import.meta.dirname,'app-config.json'),'utf8'));
const manifest=load('@nelyx/metro/assets').copyAndroidFontAssets(app,config.assets,path.join(app,'android/app/build/generated/nelyx-fonts'));
console.log(JSON.stringify({skiaFontAssets:manifest.fonts.length}));
