// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';import path from 'node:path';
import {createRequire} from 'node:module';
import {automaticPartition} from './type-policy.mjs';
export function productPartition({runner,entry,runtimeFiles,applicationRoot,packageRoots}){
  runner=fs.realpathSync(runner);
  const roots=packageRoots??['core','sdk','skia-native','skia-rn','material','cupertino'].map(name=>path.join(runner,'node_modules/@nelyx',name)).filter(file=>fs.existsSync(path.join(file,'package.json')));
  const owners=new Map(roots.map(root=>[JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).name,fs.realpathSync(root)]));
  for(const root of roots){
    const manifest=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')),load=createRequire(path.join(root,'package.json'));
    for(const name of Object.keys({...manifest.dependencies,...manifest.peerDependencies}).filter(name=>owners.has(name))){
      const owner=owners.get(name),dependency=JSON.parse(fs.readFileSync(path.join(owner,'package.json'),'utf8'));
      const entry=Object.keys(dependency.exports??{}).find(key=>key==='.'||key.startsWith('./')&&!key.includes('*'));
      if(!entry)throw Error('Installed module owner has no concrete public export: '+name);
      const resolved=fs.realpathSync(load.resolve(name+(entry==='.'?'':entry.slice(1)))),relative=path.relative(owner,resolved);
      if(relative.startsWith('..')||path.isAbsolute(relative)||relative.split(path.sep).includes('node_modules'))throw Error('Installed package resolves a duplicate module owner: '+name);
    }
  }
  const partition=automaticPartition({entry:fs.realpathSync(entry),applicationRoot:applicationRoot??path.resolve(runner,'../..'),packageRoots:roots,runtimeFiles});
  if(partition.graph.boundaries.some(item=>item.kind==='multiple-evaluation-routes'))throw Error('Product graph has multiple source/emitted module identities');
  const byModule=new Map();
  for(const binding of partition.bindings){
    const module=partition.graph.modules.find(item=>item.id===binding.module);
    if(!module.runtime||!module.runtimeSha256)throw Error('Product typed partition requires supplied emitted source maps: '+binding.module);
    let item=byModule.get(binding.module);
    if(!item){const owner=roots.find(root=>JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).name===module.owner);item={file:path.join(owner,module.runtime.slice(module.owner.length+1)),sha256:module.runtimeSha256,bindings:[]};byModule.set(binding.module,item);}
    item.bindings.push(binding);
  }
  return {...partition,metroPlan:{schema:'nelyx.typed-metro-plan/v1',irSha256:partition.irSha256,files:[...byModule.values()]}};
}
export function typedBootstrapPrefix(partition){
  return partition.bindings.flatMap(({globalName})=>[globalName,globalName+'_calls']).map(name=>'if(typeof globalThis['+JSON.stringify(name)+']!=="function")throw Error("Typed native callable missing");Object.defineProperty(globalThis,'+JSON.stringify(name)+',{value:globalThis['+JSON.stringify(name)+'],writable:false,configurable:false});').join('\n')+'\n';
}
