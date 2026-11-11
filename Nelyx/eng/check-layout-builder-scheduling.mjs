// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
const watchdog = setTimeout(() => {
  throw Error('LayoutBuilder scheduling checks exceeded 20 minutes');
}, 1200000);
try {
  const bundle = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
import assert from 'node:assert/strict';
import {BuildOwner} from './Nelyx/src/framework/widgets/framework.ts';
import {LayoutBuilder} from './Nelyx/src/framework/widgets/layout-builder.ts';
import {SizedBox} from './Nelyx/src/framework/widgets/basic.ts';
import {BoxConstraints} from './Nelyx/src/framework/rendering/constraints.ts';
import {claimNativeRenderObject} from './Nelyx/src/framework/rendering/object.ts';
import {FrameScheduler} from './Nelyx/src/framework/scheduler/scheduler.ts';
import {registerTickerScheduler,unregisterTickerScheduler} from './Nelyx/src/framework/widgets/ticker-scheduler.ts';
const owner=new BuildOwner({} as any,()=>{});
const scheduler=new FrameScheduler({now:()=>0} as any,()=>{}, {reportError:error=>{throw error;}});
registerTickerScheduler(owner,scheduler);
let builds=0;
const element:any=new LayoutBuilder(()=>{++builds;return SizedBox.shrink();}).createElement();
element.mount(undefined,owner);
const render=element.renderObject;
claimNativeRenderObject(render,{},()=>{});
const constraints=BoxConstraints.tight({width:100,height:60});
const answer=()=>{const config=render.nativeBuilderConfiguration();assert(config.rebuild(config.revision,constraints));};
try {
  answer();
  assert.equal(builds,1);
  // A dirty descendant schedules the LayoutBuilder's isolated build scope in
  // idle. Content can answer it before the scheduled App frame arrives.
  element.children[0].markNeedsBuild();
  assert.equal(scheduler.transientCallbackCount,1);
  answer();
  const completed=render.nativeBuilderConfiguration();
  assert.equal(scheduler.transientCallbackCount,0,'Answered Content work left a stale frame callback');
  scheduler.beginFrame(16);scheduler.endFrame();
  assert.equal(render.nativeBuilderConfiguration().revision,completed.revision,'Stale frame re-invalidated a completed builder');
  assert.equal(builds,1,'Same constraints rebuilt the builder instead of its dirty descendant');
  // Fresh work after that answer must still schedule and advance normally.
  element.children[0].markNeedsBuild();
  assert.equal(scheduler.transientCallbackCount,1);
  scheduler.beginFrame(32);scheduler.endFrame();
  assert(render.nativeBuilderConfiguration().revision>completed.revision);
  answer();
  element.markNeedsBuild();answer();
  assert.equal(builds,2,'A real builder invalidation was lost');
  element.children[0].markNeedsBuild();
  assert.equal(scheduler.transientCallbackCount,1);
} finally {
  element.unmount();unregisterTickerScheduler(owner);scheduler.dispose();owner.dispose();
}
assert.equal(scheduler.transientCallbackCount,0);
console.log('LayoutBuilder Content answer, stale frame cancellation, fresh invalidation and unmount PASS');
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
