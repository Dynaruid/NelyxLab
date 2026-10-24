// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';import {createRequire} from 'node:module';import ts from 'typescript';
import {contentHash,stableJson} from './content-cache.ts';

/** Loaded functions must never publish results under a newer on-disk identity.
 * A fresh process is required after an implementation changes. */
export function guardLoadedIdentity<T>(current:()=>T,description:string):()=>T {
  const loaded=stableJson(current());
  return ()=>{const identity=current();if(stableJson(identity)!==loaded)throw new Error(description+' changed after loading; restart the converter before reusing or publishing cached results');return identity;};
}
const require=createRequire(import.meta.url),wrapperEntry=fs.realpathSync(require.resolve('typescript')),wrapperManifest=fs.realpathSync(require.resolve('typescript/package.json'));
const compatibility=JSON.parse(fs.readFileSync(wrapperManifest,'utf8')).name==='@typescript/typescript6',compilerRequire=createRequire(wrapperEntry);
const entry=compatibility?fs.realpathSync(compilerRequire.resolve('@typescript/old')):wrapperEntry;
const manifest=compatibility?fs.realpathSync(compilerRequire.resolve('@typescript/old/package.json')):wrapperManifest;
export const typescriptIdentity=guardLoadedIdentity(()=>({version:ts.version,entry,implementationSha256:contentHash(fs.readFileSync(entry)),manifest,manifestSha256:contentHash(fs.readFileSync(manifest)),...compatibility?{compatibility:{entry:wrapperEntry,implementationSha256:contentHash(fs.readFileSync(wrapperEntry)),manifest:wrapperManifest,manifestSha256:contentHash(fs.readFileSync(wrapperManifest))}}:{}}),'TypeScript compiler implementation');
