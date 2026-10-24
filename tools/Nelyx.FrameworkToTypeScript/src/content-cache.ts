// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';

export const contentHash=(bytes:string|Buffer):string=>createHash('sha256').update(bytes).digest('hex');
export function stableJson(value:unknown):string {
  return JSON.stringify(value,(_key,item:unknown)=>item!==null&&typeof item==='object'&&!Array.isArray(item)
    ?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a<b?-1:a>b?1:0)):item);
}
export interface CacheReport {namespace:string;key:string;status:'hit'|'miss'|'corrupt'|'disabled';elapsedMs:number;bytes:number}
interface Entry {schema:'nelyx.content-cache/v1';key:string;artifacts:Record<string,{sha256:string;data:string}>}
export type Artifacts=Record<string,Buffer>;
/** Entries are atomic, disposable results, never batch state or validation receipts. */
export function contentCache(options:{root:string;namespace:string;identity:unknown;enabled?:boolean},produce:()=>Artifacts,validate:(artifacts:Artifacts)=>void):{artifacts:Artifacts;report:CacheReport} {
  const started=performance.now(),key=contentHash(stableJson(options.identity));
  if(!/^[a-z][a-z0-9-]*$/.test(options.namespace))throw new Error('Invalid cache namespace');
  let status:CacheReport['status']='miss';
  const enabled=options.enabled!==false&&process.env.NELYX_PORT_CACHE!=='off',directory=path.resolve(options.root,options.namespace),file=path.join(directory,key+'.json');
  const checkPaths=()=>{let current=path.parse(directory).root;for(const segment of directory.slice(current.length).split(path.sep).filter(Boolean)){current=path.join(current,segment);if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw new Error('Linked cache path rejected: '+current);}};
  const result=(artifacts:Artifacts)=>({artifacts,report:{namespace:options.namespace,key,status,elapsedMs:Math.round(performance.now()-started),bytes:Object.values(artifacts).reduce((sum,bytes)=>sum+bytes.length,0)}});
  if(enabled){
    checkPaths();
    if(fs.existsSync(file))try{
      if(!fs.lstatSync(file).isFile()||fs.lstatSync(file).isSymbolicLink())throw new Error('Cache entry is not a regular file');
      const entry=JSON.parse(fs.readFileSync(file,'utf8')) as Entry;
      if(entry.schema!=='nelyx.content-cache/v1'||entry.key!==key||!entry.artifacts||typeof entry.artifacts!=='object'||Array.isArray(entry.artifacts)||!Object.keys(entry.artifacts).length)throw new Error('Invalid cache envelope');
      const artifacts:Artifacts={};
      for(const [name,item]of Object.entries(entry.artifacts)){
        if(!/^[a-zA-Z0-9_./-]+$/.test(name)||name.split('/').some(part=>!part||part==='.'||part==='..')||path.isAbsolute(name)||typeof item.data!=='string'||! /^[a-f0-9]{64}$/.test(item.sha256))throw new Error('Invalid cache artifact');
        const bytes=Buffer.from(item.data,'base64');if(bytes.toString('base64')!==item.data||contentHash(bytes)!==item.sha256)throw new Error('Cache artifact hash mismatch');artifacts[name]=bytes;
      }
      validate(artifacts);status='hit';return result(artifacts);
    }catch{status='corrupt';}
  }else status='disabled';
  const artifacts=produce();validate(artifacts);
  if(enabled){
    checkPaths();fs.mkdirSync(directory,{recursive:true});
    const entry:Entry={schema:'nelyx.content-cache/v1',key,artifacts:Object.fromEntries(Object.entries(artifacts).map(([name,bytes])=>[name,{sha256:contentHash(bytes),data:bytes.toString('base64')}]))},temporary=file+'.'+randomUUID()+'.tmp';
    try{fs.writeFileSync(temporary,JSON.stringify(entry)+'\n',{flag:'wx'});if(fs.existsSync(file)&&fs.lstatSync(file).isSymbolicLink())throw new Error('Linked cache entry rejected');fs.renameSync(temporary,file);}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
  }
  return result(artifacts);
}

/** Hash bytes, not timestamps; new/deleted files and preserved mtimes invalidate. */
export function treeIdentity(root:string,include:(relative:string)=>boolean=()=>true,excluded=new Set(['.git','.dart_tool','node_modules','build'])):Record<string,string> {
  const hashes:Record<string,string>={};
  function walk(directory:string){for(const entry of fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){
    if(excluded.has(entry.name))continue;
    const file=path.join(directory,entry.name),relative=path.relative(root,file).replaceAll('\\','/');
    if(entry.isSymbolicLink())throw new Error('Linked cache input rejected: '+file);
    if(entry.isDirectory())walk(file);else if(entry.isFile()&&include(relative))hashes[relative]=contentHash(fs.readFileSync(file));
  }}
  if(fs.existsSync(root))walk(root);return hashes;
}
