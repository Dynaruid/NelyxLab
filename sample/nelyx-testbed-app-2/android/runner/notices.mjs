// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const load=createRequire(import.meta.url),app=path.resolve(import.meta.dirname,'../..'),config=JSON.parse(fs.readFileSync(path.join(import.meta.dirname,'app-config.json'),'utf8'));
const records=load('@nelyx/metro/assets').copyAppNotices(app,config.assets,path.join(app,'android/app/build/generated/nelyx-notices/licenses'));
const destination=path.join(app,'android/app/build/generated/nelyx-notices/licenses');
for(const [label,name]of [['core','@nelyx/core'],['sdk','@nelyx/sdk'],['skia-native','@nelyx/skia-native'],['skia-rn','@nelyx/skia-rn'],['react-native','react-native']]){
  const source=path.join(import.meta.dirname,'node_modules',name);let found=false;
  for(const file of ['LICENSE.md','LICENSE','THIRD_PARTY_NOTICES.md'])if(fs.existsSync(path.join(source,file))){fs.copyFileSync(path.join(source,file),path.join(destination,label+'-'+file));if(file.startsWith('LICENSE'))found=true;}
  if(!found)throw new Error('Installed runtime license absent: '+name);
  if(fs.existsSync(path.join(source,'licenses')))fs.cpSync(path.join(source,'licenses'),path.join(destination,label),{recursive:true,dereference:false});
}
console.log(JSON.stringify({assetNotices:records}));
