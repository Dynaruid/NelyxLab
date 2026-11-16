// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';
const root = path.resolve(import.meta.dirname, '../..');
const oracleIndex = process.argv.indexOf('--oracle');
const oracleFile = oracleIndex < 0 ? null : process.argv[oracleIndex + 1];
if (oracleIndex >= 0 && (!oracleFile || oracleFile.startsWith('--')))
  throw Error('Missing retained paint oracle file');
function removeTemporary(temporary, parent) {
  if (path.dirname(temporary) !== parent || fs.lstatSync(temporary).isSymbolicLink())
    throw Error('Paint fixture owner differs');
  fs.rmSync(temporary, { recursive: true, force: true });
}
if (!process.argv.includes('--child')) {
  const parent = path.join(root, '.tmp');
  fs.mkdirSync(parent, { recursive: true });
  const temporary = fs.mkdtempSync(path.join(parent, 'retained-paint-'));
  try {
    await execute(
      process.execPath,
      [
        import.meta.filename,
        ...(oracleFile ? ['--oracle', path.resolve(oracleFile)] : []),
        '--child',
        temporary,
      ],
      {
        cwd: root,
        timeout: 1_200_000,
      },
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    removeTemporary(temporary, parent);
  }
} else {
  const temporary = path.resolve(process.argv.at(-1));
  if (
    path.dirname(temporary) !== path.join(root, '.tmp') ||
    !path.basename(temporary).startsWith('retained-paint-')
  )
    throw Error('Invalid paint fixture owner');
  const bundled = await build({
    define: {
      ORIGINAL_PAINT_EXPECTATIONS: JSON.stringify(
        oracleFile ? JSON.parse(fs.readFileSync(oracleFile, 'utf8')).retainedPaint : null,
      ),
    },
    stdin: {
      resolveDir: root,
      loader: 'ts',
      sourcefile: 'retained-paint-fixture.ts',
      contents: `
import assert from 'node:assert/strict';
import {RenderBox,PipelineOwner} from './Nelyx/src/framework/rendering/object.ts';
import {RenderProxyBox} from './Nelyx/src/framework/rendering/boxes.ts';
import {RenderRepaintBoundary} from './Nelyx/src/framework/rendering/repaint-boundary.ts';
import {retainedPaintLayer,paintRenderObject} from './Nelyx/src/framework/rendering/retained-paint.ts';
import {LayerHandle,OffsetLayer} from './Nelyx/src/framework/rendering/layer.ts';
import {PaintingContext} from './Nelyx/src/framework/painting/context.ts';
import {Paint} from './Nelyx/src/ui/paint.ts';
import {withRenderPaint} from './Nelyx/src/framework/rendering/phase.ts';
import {FrameworkRoot} from './Nelyx/src/framework/widgets/root.ts';
import {Builder} from './Nelyx/src/framework/widgets/basic.ts';
import {LeafRenderObjectWidget} from './Nelyx/src/framework/widgets/framework.ts';
import {ResourceRegistry} from './Nelyx/src/hosting/resources.ts';
import {FrameRecording,releaseSceneFrameSource} from './Nelyx/src/ui/frame.ts';
import {freezePaintCommand} from './Nelyx/src/ui/frame.ts';
const cases=[],observations=[];
// A retained insertion keeps the transform outside the compiled picture.
const compositionRoot=new LayerHandle(new OffsetLayer()),compositionChild=new LayerHandle(new OffsetLayer());
const compositionBounds={x:0,y:0,width:120,height:80};
function composeTranslation(x){
  const counts={paintChildCalls:0,boundaryVisits:0,boundaryRecordings:0,boundaryReuses:0},context=new PaintingContext(null,null,true,counts);
  try{context.save();context.translate(x,4);context.addLayer(compositionChild.layer);context.restore();
    const sourceCount=context.commands.length;context.compose(compositionRoot.layer,compositionBounds);
    return {commands:[...context.commands],counts,sourceCount};
  }finally{context.dispose();}
}
try{
  const first=composeTranslation(2),second=composeTranslation(9);
  assert.equal(second.counts.compositionTransformUpdates,1);assert.equal(second.counts.compositionReuses,1);
  assert.equal(second.counts.compositionCommandVisits,second.sourceCount,'Transform matching revisited its matching prefix');
  assert(first.commands.some(c=>c.op==='transform'&&c.matrix[4]===2),'Prior frame transform mutated');
  assert(second.commands.some(c=>c.op==='transform'&&c.matrix[4]===9));
  const clean=composeTranslation(9);assert.equal(clean.counts.compositionReuses,1);assert.equal(clean.counts.compositionTransformUpdates,undefined);
  compositionChild.layer.remove();const changed=composeTranslation(12);assert.equal(changed.counts.compositionReuses,undefined);assert.equal(changed.counts.compositionStructureMisses,1);
  cases.push('transform-only-single-command-pass-and-immutable-old-frame','retained-insertion-parent-change-invalidates-reuse');
}finally{compositionRoot.dispose();compositionChild.dispose();}
const sharedRoot=new LayerHandle(new OffsetLayer()),sharedChildren=[new LayerHandle(new OffsetLayer()),new LayerHandle(new OffsetLayer())];
function composeShared(first,second){
  const context=new PaintingContext(null,null,true),a=freezePaintCommand({op:'transform',matrix:[1,0,0,1,first,0]}),b=second===first?a:freezePaintCommand({op:'transform',matrix:[1,0,0,1,second,0]});
  try{for(const [index,command]of [a,b].entries()){context.save();context.addCommands([command]);context.addLayer(sharedChildren[index].layer);context.restore();}
    context.compose(sharedRoot.layer,compositionBounds);return [...context.commands].filter(c=>c.op==='transform').map(c=>c.matrix[4]);
  }finally{context.dispose();}
}
try{assert.deepEqual(composeShared(2,2),[2,2]);assert.deepEqual(composeShared(7,7),[7,7]);assert.deepEqual(composeShared(10,15),[10,15]);cases.push('shared-transform-identities-require-every-position-to-agree');}
finally{sharedRoot.dispose();for(const child of sharedChildren)child.dispose();}
class Box extends RenderProxyBox {
  paints=0;color=0xff123456;afterPaint;
  paint(context){++this.paints;context.drawRect({x:0,y:0,width:8,height:9},new Paint({color:this.color}));super.paint(context);this.afterPaint?.();}
  change(color){this.color=color;this.markNeedsPaintOnly();}
}
class Boundary extends Box {
  boundary=true;
  get isRepaintBoundary(){return this.boundary;}
}
function harness(render){
  const owner=new PipelineOwner({accessibilityEnabled:false}),layer=new LayerHandle(new OffsetLayer());
  owner.setRoot(render);layer.layer.attach(owner);
  return {owner,frame(token){owner.flushLayout({width:120,height:80});owner.flushCompositingBits();const context=new PaintingContext(null,null,true);try{withRenderPaint(()=>{paintRenderObject(render,context,true);context.compose(layer.layer,{x:0,y:0,width:120,height:80},null);});owner._flushPaintRetirements();return token?FrameRecording.capture(token,context):[...context.commands];}finally{context.dispose();}},close(){layer.layer.detach();layer.dispose();owner.setRoot(undefined);owner.dispose();const dispose=r=>{const children=[...r.children];r.setChildren([]);r.dispose();children.forEach(dispose);};dispose(render);}};
}
const leaf=new Box(),boundary=new Boundary(leaf),parent=new Box(boundary),h=harness(parent);
try{
  h.frame();h.frame();assert.deepEqual([parent.paints,boundary.paints,leaf.paints],[1,1,1]);observations.push({kind:'clean',paints:[parent.paints,boundary.paints,leaf.paints]});cases.push('clean-root-and-custom-boundary');
  leaf.change(0xffabcdef);const updated=h.frame();assert.deepEqual([parent.paints,boundary.paints,leaf.paints],[1,2,2]);observations.push({kind:'child-dirty',paints:[parent.paints,boundary.paints,leaf.paints]});assert(updated.some(c=>c.op==='drawRect'&&c.paint.color===0xffabcdef));cases.push('nested-dirty-paint-and-pixels');
  parent.change(0xfffedcba);h.frame();assert.deepEqual([parent.paints,boundary.paints,leaf.paints],[2,2,2]);observations.push({kind:'parent-dirty',paints:[parent.paints,boundary.paints,leaf.paints]});cases.push('parent-dirty-keeps-clean-boundary');
  boundary.boundary=false;boundary.markNeedsCompositingBitsUpdate();boundary.markNeedsPaintOnly();h.frame();leaf.change(0xff112233);h.frame();assert.equal(parent.paints,4);assert.equal(retainedPaintLayer(boundary),null);cases.push('dynamic-boundary-removal');
  boundary.boundary=true;boundary.markNeedsCompositingBitsUpdate();boundary.markNeedsPaintOnly();h.frame();const previous=parent.paints;leaf.change(0xff112234);h.frame();assert.equal(parent.paints,previous);assert(retainedPaintLayer(boundary));cases.push('dynamic-boundary-restoration');
  let invalidate=true;leaf.afterPaint=()=>{if(invalidate){invalidate=false;leaf.change(0xff334455);}};leaf.change(0xff000000);h.frame();assert.equal(retainedPaintLayer(boundary),null);const again=h.frame();assert(again.some(c=>c.op==='drawRect'&&c.paint.color===0xff334455));leaf.afterPaint=undefined;cases.push('paint-hook-invalidates-next-frame');
  let fail=true;leaf.afterPaint=()=>{if(fail){fail=false;throw Error('paint failed');}};leaf.change(0xff665544);assert.throws(()=>h.frame(),/paint failed/);assert(h.frame().some(c=>c.op==='drawRect'&&c.paint.color===0xff665544));leaf.afterPaint=undefined;cases.push('failed-paint-can-retry');
}finally{h.close();}
assert.equal(retainedPaintLayer(parent),null);assert.equal(retainedPaintLayer(boundary),null);cases.push('detach-releases-boundary-recordings');
class Hide extends RenderProxyBox {
  visible=true;
  paintsChild(child){return this.visible&&super.paintsChild(child);}
  paint(context){if(this.visible)super.paint(context);}
}
const hiddenLeaf=new Box(),hiddenBoundary=new Boundary(hiddenLeaf),hide=new Hide(hiddenBoundary),hidden=harness(hide);
try{hidden.frame();const layer=retainedPaintLayer(hiddenBoundary);assert(layer?.hasChildren);hide.visible=false;hide.markNeedsPaintOnly();hidden.frame();hiddenLeaf.change(0xff887766);hidden.owner._flushPaintRetirements();assert.equal(layer.hasChildren,false);assert.equal(hiddenLeaf.paints,1);cases.push('hidden-dirty-boundary-retires-pictures');hide.visible=true;hide.markNeedsPaintOnly();assert(hidden.frame().some(c=>c.op==='drawRect'&&c.paint.color===0xff887766));cases.push('hidden-boundary-reappears');}finally{hidden.close();}
class CustomBoundary extends RenderRepaintBoundary {paints=0;paint(context){++this.paints;super.paint(context);}}
const custom=new CustomBoundary(),customLeaf=new Box();custom.child=customLeaf;const customized=harness(custom);
try{customized.frame();customized.frame();assert.equal(custom.paints,1);customLeaf.change(0xff445566);customized.frame();assert.equal(custom.paints,2);cases.push('custom-repaint-boundary-paint-hook');customLeaf.change(0xff556677);assert.throws(()=>custom.toImageSync({rasterizer:{}}),/finish painting/);cases.push('stale-boundary-image-rejected');}finally{customized.close();}
let now=0,sequence=0,wakes=0,element,postRuns=0;
const resources=new ResourceRegistry(),owner={id:'paint-wake',generation:1};
const metrics={logicalWidth:120,logicalHeight:80,physicalWidth:120,physicalHeight:80,scale:1,viewportGeneration:1,rendererGeneration:1,nativeContextGeneration:null,nativeSurfaceGeneration:null};
class PostBox extends RenderBox {performLayout(c){element.owner.postFrame(()=>{++postRuns;});return c.smallest;}}
class PostWidget extends LeafRenderObjectWidget {createRenderObject(){return new PostBox();}}
const view=new FrameworkRoot({owner,resources,assets:new Map(),text:{layout(){throw Error('Unexpected text');}},clock:{now:()=>now},editing:{capabilities:{},dispose(){}},semantics:{capability:'unavailable',dispose(){}},readMetrics:()=>metrics,readStatus:()=> 'open',requestFrame(){++wakes;}},{id:'paint-wake',accessibilityEnabled:false,createRoot:()=>new Builder(context=>{element=context;return new PostWidget();})});
const frame=()=>{now+=16;const result=view.build({token:{owner,metrics,sequence:++sequence},resources});releaseSceneFrameSource(result);};
try{
  frame();assert.equal(postRuns,1);assert.equal(wakes,0);assert.equal(view.scheduler.hasScheduledFrame,false);cases.push('layout-post-frame-uses-current-frame');
  element.owner.postFrame(()=>{++postRuns;});assert.equal(postRuns,1);assert.equal(wakes,1);frame();assert.equal(postRuns,2);cases.push('idle-post-frame-wakes-host');
  element.owner.postFrame(()=>element.owner.postFrame(()=>{++postRuns;}));frame();const before=postRuns;assert(view.scheduler.hasScheduledFrame);frame();assert.equal(postRuns,before+1);cases.push('reentrant-post-frame-runs-next-frame');
  let ticks=0;view.scheduler.scheduleFrameCallback(()=>{++ticks;view.scheduler.scheduleFrameCallback(()=>{++ticks;});});frame();assert.equal(ticks,1);assert(view.scheduler.hasScheduledFrame);frame();assert.equal(ticks,2);cases.push('animation-keeps-next-frame');
}finally{view.dispose();resources.dispose();}
class RenderWidget extends LeafRenderObjectWidget {constructor(render){super();this.render=render;}createRenderObject(){return this.render;}}
function wakeHarness(render){let wakes=0,sequence=0;const resources=new ResourceRegistry(),viewOwner={id:'paint-pipeline-wake',generation:1};const view=new FrameworkRoot({owner:viewOwner,resources,assets:new Map(),text:{layout(){throw Error('Unexpected text');}},clock:{now:()=>sequence*16},editing:{capabilities:{},dispose(){}},semantics:{capability:'unavailable',dispose(){}},readMetrics:()=>metrics,readStatus:()=> 'open',requestFrame(){++wakes;}},{id:'paint-pipeline-wake',createRoot:()=>new RenderWidget(render)});return {view,get wakes(){return wakes;},frame(){const result=view.build({token:{owner:viewOwner,metrics,sequence:++sequence},resources});releaseSceneFrameSource(result);},close(){view.dispose();resources.dispose();}};}
class SemanticsDuringPaint extends Box {paint(context){super.paint(context);this.markNeedsSemanticsUpdate();}}
const semanticsWake=wakeHarness(new SemanticsDuringPaint());
try{semanticsWake.frame();assert.equal(semanticsWake.wakes,0,'Semantics consumed by this frame scheduled a duplicate');assert.equal(semanticsWake.view.scheduler.hasScheduledFrame,false);cases.push('paint-semantics-consumed-without-duplicate-frame');}finally{semanticsWake.close();}
const invalidating=new Box();let invalidateNext=true;invalidating.afterPaint=()=>{if(invalidateNext){invalidateNext=false;invalidating.change(0xff000077);}};
const paintWake=wakeHarness(invalidating);
try{paintWake.frame();assert(paintWake.wakes>0);assert(paintWake.view.scheduler.hasScheduledFrame);paintWake.frame();assert.equal(invalidating.paints,2);cases.push('unpainted-changes-keep-owner-wakeup');}finally{paintWake.close();}
let retired=0;
const resourceRegistry=new ResourceRegistry(),resource=resourceRegistry.allocateId('retained-image');
resourceRegistry.register({...resource,kind:'image'},()=>{++retired;});resourceRegistry.bindResource(resource);
class ImageBox extends RenderBox {performLayout(c){return c.smallest;}paint(context){context.image(resource,{x:0,y:0,width:12,height:14});}}
const imageBox=new ImageBox(),imageHarness=harness(imageBox),token={owner:{id:'retained-image-test',generation:1},metrics,sequence:1};
const recording=imageHarness.frame(token),imageFrame=recording.take(token),lease=resourceRegistry.acquire(imageFrame.resources);
lease.transfer();
resourceRegistry.releaseProducer(resource);
imageHarness.close();assert.equal(retired,0);assert(resourceRegistry.isRetained(resource));cases.push('admitted-frame-outlives-render-boundary');
lease.returnBy('renderer');assert.equal(retired,1);assert.equal(resourceRegistry.isRetained(resource),false);resourceRegistry.dispose();cases.push('last-frame-lease-retires-resource');
if(ORIGINAL_PAINT_EXPECTATIONS!==null)assert.deepEqual(observations,ORIGINAL_PAINT_EXPECTATIONS,'Pinned Flutter repaint observations differ');
console.log('RETAINED_PAINT',JSON.stringify({result:'PASS-scoped',originalComparison:ORIGINAL_PAINT_EXPECTATIONS===null?'not-run':'PASS-scoped',cases,observations}));
`,
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    logLevel: 'silent',
  });
  const file = path.join(temporary, 'fixture.mjs');
  fs.writeFileSync(file, bundled.outputFiles[0].contents);
  await import(pathToFileURL(file).href);
}
