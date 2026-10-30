// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

export function sha256(file){return createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
export function relativeFile(value){
  // oxlint-disable-next-line no-control-regex -- Control code points are deliberately matched for input validation or normalization.
  if(typeof value!=='string'||!value||value.length>512||/[\\:\x00-\x1f]/.test(value)||path.isAbsolute(value)||value.split('/').some(part=>!part||part==='.'||part==='..'))throw new Error('Invalid inventory path');
  return value;
}
export function localFile(root,relative){
  relativeFile(relative);let current=root;
  for(const part of relative.split('/')){current=path.join(current,part);if(fs.lstatSync(current).isSymbolicLink())throw new Error('Inventory symlink rejected');}
  const actual=fs.realpathSync(current),rest=path.relative(fs.realpathSync(root),actual);
  if(rest.startsWith('..')||path.isAbsolute(rest))throw new Error('Inventory path escaped its directory');
  return actual;
}
export function fileTree(root){
  const result=[];
  function visit(directory,prefix=''){
    for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
      if(entry.isSymbolicLink())throw new Error('Inventory symlink rejected');
      const relative=prefix+entry.name,file=path.join(directory,entry.name);
      if(entry.isDirectory())visit(file,relative+'/');
      else if(entry.isFile())result.push(relativeFile(relative));
      else throw new Error('Non-regular inventory entry');
    }
  }
  visit(root);return result.sort();
}
export function verifyInventory(root,records,excluded=[]){
  if(!Array.isArray(records)||!records.length||records.length>4096)throw new Error('Incomplete inventory');
  const names=new Set();let bytes=0;
  for(const record of records){
    const name=relativeFile(record.path),key=name.toLowerCase();
    if(names.has(key)||!Number.isSafeInteger(record.bytes)||record.bytes<0||!/^[a-f0-9]{64}$/.test(record.sha256))throw new Error('Invalid/duplicate inventory record');
    names.add(key);const file=localFile(root,name);
    if(!fs.statSync(file).isFile()||fs.statSync(file).size!==record.bytes||sha256(file)!==record.sha256)throw new Error('Inventory hash/size mismatch: '+name);
    bytes+=record.bytes;if(bytes>2*1024*1024*1024)throw new Error('Inventory exceeds 2GiB');
  }
  const actual=fileTree(root).filter(name=>!excluded.includes(name));
  if(actual.length!==records.length||actual.some(name=>!names.has(name.toLowerCase())))throw new Error('Unlisted inventory file');
  return {files:records.length,bytes};
}
