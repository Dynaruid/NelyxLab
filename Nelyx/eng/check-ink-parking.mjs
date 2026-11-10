// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
const watchdog = setTimeout(() => {
  throw Error('Ink parking checks exceeded 20 minutes');
}, 1200000);
try {
  const bundle = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
    import assert from 'node:assert/strict';
    import {RenderBox,claimNativeRenderObject} from '@nelyx/core/framework/rendering/object';
    import {OriginalNativeRender} from './Nelyx/runtime/app/native-node.ts';
    import {RenderSceneCapture} from './Nelyx/runtime/app/capture.ts';
    import {originalControlConfiguration} from './Nelyx/runtime/app/controls.ts';
    import {SceneNode,SceneReference,SceneWriter} from './Nelyx/runtime/engine-client/scene.ts';
    import {InkFeature,MaterialInkRender,registerNativeInkFeature} from './packages/material/src/internal/material/material-ink-owner.ts';
    class PersistentHighlight extends InkFeature {paintFeature(){throw Error('App paint must not run');}}
    const shape={kind:'circle' as const,radii:Array(8).fill(0),strokeWidth:0,strokeColor:0,strokeAlign:0};
    registerNativeInkFeature(PersistentHighlight.prototype,feature=>({kind:'highlight',reference:feature.referenceBox,color:0xff123456,shape,circular:true}));
    const ink=new MaterialInkRender({createTicker(){throw Error('No animation needed');}} as any,null,false);
    const page=new OriginalNativeRender('box',{parkedChildren:false});
    const cell=new RenderBox();page.setChildren([cell]);ink.child=page;
    assert.equal(originalControlConfiguration(ink,reason=>{throw Error(reason);}).dynamicPaint,false,'Idle Materials should retain their static capture');
    const feature=new PersistentHighlight({controller:ink,referenceBox:cell});ink.addInkFeature(feature);
    const capture=new RenderSceneCapture(),keys=new WeakMap<object,SceneReference>();
    const reference=render=>{let key=keys.get(render);if(!key)keys.set(render,key=new SceneReference());return key;};
    claimNativeRenderObject(ink,{},()=>capture.invalidate(ink));
    const project=(render,count={value:0},depth=0):SceneNode=>capture.node(render,'',count,depth,()=>{
      ++count.value;
      const config=originalControlConfiguration(render,reason=>{throw Error(reason);});
      if(config?.dynamicPaint)capture.dynamic();
      const children=render instanceof OriginalNativeRender&&render.options.parkedChildren?[]:render.children;
      return new SceneNode(reference(render),'box',children.map(child=>project(child,count,depth+1)),{
        ...config?.options,
        nativePaint:config?.paint?.map(entry=>({...entry,reference:entry.reference?()=>keys.get(entry.reference)?.currentNode??null:undefined})),
      });
    },(nextCount,nextDepth)=>project(render,nextCount,nextDepth));
    const writer=new SceneWriter({} as any,{pollEvents:false}) as any;
    const visible=project(ink);writer.adopt(writer.records(visible),[]);
    assert(visible.options.nativePaint.some(entry=>entry.kind==='highlight'));
    const originalHandle=reference(cell).currentNode;
    page.options={parkedChildren:true};capture.invalidate(page);
    assert.equal(page.paintsChild(cell),false,'A parked native page still advertises its children as painted');
    const parked=project(ink);
    assert.equal(originalControlConfiguration(ink,reason=>{throw Error(reason);}).dynamicPaint,true,'Parked live features still need visibility refresh');
    assert(!parked.options.nativePaint.some(entry=>entry.kind==='highlight'),'Retained ink configuration still references a parked cell');
    writer.adopt(writer.records(parked),[]);
    assert.equal(reference(cell).currentNode,null);
    writer.records(project(ink));
    assert.equal(ink.features[0],feature);assert.equal(feature.debugDisposed,false,'Source keep-alive ink was disposed to hide projection failure');
    page.options={parkedChildren:false};capture.invalidate(page);
    const restored=project(ink);const restoredRecords=writer.records(restored);
    assert(restored.options.nativePaint.some(entry=>entry.kind==='highlight'));
    assert.notDeepEqual(reference(cell).currentNode,originalHandle,'Reappearing cell must resolve its new native generation');
    writer.adopt(restoredRecords,[]);
    feature.dispose();ink.child=null;page.setChildren([]);cell.dispose();page.dispose();ink.dispose();capture.clear();
    console.log('Retained ink parks without native references, remains alive, and restores with a fresh handle PASS.');
  `,
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    logLevel: 'silent',
  });
  await import(
    'data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].contents).toString('base64')
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
}
