// SPDX-License-Identifier: BSD-3-Clause
import {readFile,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {selectionId,validateSelections} from './selection.ts';
import type {Manifest} from './selection.ts';
import {within} from './paths.ts';
/** Reports only selected upstream changes. Reviewed TS is read for review context and never written. */
export async function compareSelections(beforeFile:string,afterFile:string,reviewedRoot:string):Promise<unknown>{
  const before=JSON.parse(await readFile(beforeFile,'utf8')) as Manifest,after=JSON.parse(await readFile(afterFile,'utf8')) as Manifest;
  validateSelections(before);validateSelections(after);
  const previous=new Map(before.selections.map(entry=>[selectionId(entry),entry])),current=new Map(after.selections.map(entry=>[selectionId(entry),entry])),root=await realpath(reviewedRoot),changes:unknown[]=[];
  for(const id of new Set([...previous.keys(),...current.keys()])){
    const old=previous.get(id),next=current.get(id);
    if(old&&next&&JSON.stringify(old)===JSON.stringify(next)&&before.rules===after.rules)continue;
    const destination=next?.destination??old!.destination,file=path.resolve(root,destination),relative=path.relative(root,file);
    if(!within(root,file))throw new Error('Reviewed destination escapes root');
    let reviewedSha256:string|undefined;
    try{const resolved=await realpath(file);if(!within(root,resolved))throw new Error('Linked reviewed destination escapes root');reviewedSha256=createHash('sha256').update(await readFile(resolved)).digest('hex');}
    catch(error){if(!(error instanceof Error)||!('code' in error)||error.code!=='ENOENT')throw error;}
    changes.push({id,symbol:next?.symbol??old!.symbol,kind:!old?'added':!next?'removed':old.destination!==next.destination?'remapped':'changed',before:old,after:next,reviewedSha256,action:'Generate old/new drafts separately; compare both with reviewed TS; apply reviewed edits manually'});
  }
  return {before:before.revision,after:after.revision,rulesChanged:before.rules!==after.rules,changes,reviewedFilesWritten:0};
}
