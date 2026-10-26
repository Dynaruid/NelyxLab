// SPDX-License-Identifier: BSD-3-Clause
import {copyResourceId} from '@nelyx/core/ui/resource-retention';
import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
import {WebSkiaLibrary} from '@nelyx/skia-web/library';import {fixture} from './root-fixture.mjs';
import {textLayoutCacheLimits} from '@nelyx/core/hosting/text-layout-cache';
/** A widget retires its producers; the existing bounded cache owns idle
 * paragraphs until eviction or registry close. No extra frame owners remain
 * in the callers that assert zero producers. engineFixture.close still
 * requires every actual paragraph/font to retire. */
export function assertParagraphOwnership(f,maximumProducers=0){
 const stats=f.library.debugTextStats,cache=stats.cache;
 assert(Number.isSafeInteger(stats.producers)&&stats.producers>=0&&stats.producers<=maximumProducers,'Unexpected logical paragraph producer');assert.equal(stats.failed,false);
 if(cache){assert.equal(cache.failed,false);for(const key of ['indexed','resident','units','bytes'])assert(Number.isSafeInteger(cache[key])&&cache[key]>=0&&cache[key]<=textLayoutCacheLimits[key],'Paragraph cache exceeded '+key);}
 if(maximumProducers===0)assert.equal(stats.paragraphs,cache?.resident??0,'A non-cache paragraph survived producer/frame retirement');
 else assert(stats.retainedOnly<=(cache?.resident??0),'A retired style left an owner outside the bounded cache');
}
let runtime;
export function ownedCanvasKit(){return runtime??=(async()=>{const base=new URL('../generated/runtime/',import.meta.resolve('@nelyx/skia-web/library')),require=createRequire(import.meta.url),ck=await require(fileURLToPath(new URL('canvaskit.js',base)))({wasmBinary:fs.readFileSync(new URL('canvaskit.wasm',base))});assert.equal(ck.nelyxParagraphApiVersion(),1);return ck;})();}
export async function engineFixture({fonts=false,binaryMessenger,platformServices,accessibilityEnabled,viewId}={}){
    const ck=await ownedCanvasKit(),{createEnginePath}=await import(new URL('path.js',import.meta.resolve('@nelyx/skia-web/library')).href);let queries=0,livePaths=0;
    const f=fixture({binaryMessenger,platformServices,accessibilityEnabled,viewId,paths:{contains(snapshot,point){const path=createEnginePath(ck,snapshot);queries++;livePaths++;try{return path.contains(point.x,point.y);}finally{path.delete();livePaths--;}}}}),context=f.root.context,library=new WebSkiaLibrary(ck,null,context.owner);library.bind(context.resources);context.text=library;
    if(fonts){for(const [id,family,file]of[['button-text','RobotoSlab',new URL('../../../Nelyx/sdk/tooling/cli/templates/nelyx-app/assets/RobotoSlab-VariableFont_wght.ttf',import.meta.url)],['button-icons','MaterialIcons',new URL('../assets/MaterialIcons.otf',import.meta.resolve('@nelyx/material/icon-assets'))]]){const bytes=fs.readFileSync(file),font=library.decode({id,kind:'font',fontFamily:family,sha256:crypto.createHash('sha256').update(bytes).digest('hex')},bytes);context.resources.register(font.descriptor,font.retire);const resource=copyResourceId(font.descriptor);context.assets.set(id,resource);if(id==='button-text')context.defaultFont=resource;}}
    return {...f,ck,library,get queries(){return queries;},get livePaths(){return livePaths;},async close(){f.close();await library.dispose();assert.equal(livePaths,0);assert.equal(library.paragraphs.size,0);assert.equal(library.fonts.size,0);}};
}
