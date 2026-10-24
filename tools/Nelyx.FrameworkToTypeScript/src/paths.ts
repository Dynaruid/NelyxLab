// SPDX-License-Identifier: BSD-3-Clause
import {mkdir, lstat, realpath, readdir} from 'node:fs/promises';
import path from 'node:path';

export function within(root:string,file:string):boolean {
  const relative=path.relative(root,file);
  return relative!==''&&!relative.startsWith(`..${path.sep}`)&&relative!=='..'&&!path.isAbsolute(relative);
}

/** Reject links before creating directories, including links in scratch ancestors. */
export async function freshScratch(output:string):Promise<string> {
  const repository=await realpath(path.resolve(import.meta.dir,'../../..'));
  const target=path.resolve(output);
  const roots=['work5','work6','work8'].map(stage=>path.join(repository,'.tmp',stage));
  if(!roots.some(root=>within(root,target)))throw new Error('Output must be below repository .tmp/work5, .tmp/work6 or .tmp/work8');
  let current=repository;
  for(const segment of path.relative(repository,target).split(path.sep)) {
    current=path.join(current,segment);
    try {if((await lstat(current)).isSymbolicLink())throw new Error(`Linked scratch path rejected: ${current}`);}
    catch(error){if(!(error instanceof Error)||!('code' in error)||error.code!=='ENOENT')throw error;}
  }
  await mkdir(target,{recursive:true});
  const resolved=await realpath(target);
  if(!roots.some(root=>within(root,resolved)))throw new Error('Resolved scratch path escapes allowed root');
  if((await readdir(resolved)).length)throw new Error('Output must be empty; reviewed files are never overwritten');
  return resolved;
}
