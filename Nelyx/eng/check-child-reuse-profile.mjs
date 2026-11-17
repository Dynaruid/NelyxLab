// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';

const root = path.resolve(import.meta.dirname, '../..');
if (!process.argv.includes('--child')) {
  const parent = path.join(root, '.tmp');
  fs.mkdirSync(parent, { recursive: true });
  const temporary = fs.mkdtempSync(path.join(parent, 'child-reuse-profile-'));
  try {
    await execute(process.execPath, [import.meta.filename, '--child', temporary], {
      cwd: root,
      timeout: 1_200_000,
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    assert.equal(path.dirname(fs.realpathSync(temporary)), fs.realpathSync(parent));
    assert(!fs.lstatSync(temporary).isSymbolicLink());
    fs.rmSync(temporary, { recursive: true, force: true });
  }
} else {
  const temporary = path.resolve(process.argv.at(-1));
  assert.equal(path.dirname(temporary), path.join(root, '.tmp'));
  assert(path.basename(temporary).startsWith('child-reuse-profile-'));
  const profile =
    fs.readFileSync(path.join(import.meta.dirname, 'windows-jank-framework-profile.ts'), 'utf8') +
    '\n' +
    fs
      .readFileSync(path.join(import.meta.dirname, 'windows-jank-child-profile.ts'), 'utf8')
      .replace(
        './windows/runner/node_modules/@nelyx/core/dist/framework/widgets/dormant-child-cache.js',
        './Nelyx/dist/framework/widgets/dormant-child-cache.js',
      ) +
    '\n' +
    fs.readFileSync(path.join(import.meta.dirname, 'windows-jank-build-profile.ts'), 'utf8');
  const bundle = await build({
    stdin: {
      resolveDir: root,
      loader: 'ts',
      contents:
        profile +
        `
import assert from 'node:assert/strict';
import {FrameworkRoot} from '@nelyx/core/framework/widgets/root';
import {SizedBox} from '@nelyx/core/framework/widgets/basic';
import {Directionality} from '@nelyx/core/framework/widgets/app-data';
import {PageController,PageView} from '@nelyx/core/framework/widgets/page-view';
import {GridView} from '@nelyx/core/framework/widgets/scroll-view';
import {DormantChildCache} from './Nelyx/dist/framework/widgets/dormant-child-cache.js';
import {createFrameworkAnchorKey} from '@nelyx/core/framework/widgets/global-key';
import {ResourceRegistry} from '@nelyx/core/hosting/resources';
import {releaseSceneFrameSource} from '@nelyx/core/ui/frame';
import {FlutterError} from '@nelyx/core/foundation/flutter-error';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {BuildOwner,Widget} from '@nelyx/core/framework/widgets/framework';
FoundationPlatform.configure({kind:'native',operatingSystem:'windows'});
FlutterError.onError=details=>{throw details.exception;};
let time=0,sequence=0,status='open',observing=true,makePage=()=>new SizedBox(120,80);
const owner={id:'reuse-profile',generation:1},resources=new ResourceRegistry(),errors=[];
const metrics={logicalWidth:120,logicalHeight:80,physicalWidth:120,physicalHeight:80,scale:1,viewportGeneration:1,rendererGeneration:1,nativeContextGeneration:null,nativeSurfaceGeneration:null};
const controller=new PageController(),context={owner,resources,assets:new Map(),text:{layout(){throw Error('Unexpected text');}},clock:{now:()=>time},editing:{capabilities:{},dispose(){}},semantics:{capability:'unavailable',bind(){throw Error('Unexpected semantics');},dispose(){}},readMetrics:()=>metrics,readStatus:()=>status,requestFrame(){},reportError:error=>errors.push(error)};
const view=new FrameworkRoot(context,{id:'reuse-profile',createRoot:()=>new Directionality('ltr',PageView.builder({controller,itemCount:4,itemBuilder:()=>makePage()}))});
const originalCreate=ProfileSliverElement.prototype.createChild,originalUnmount=ProfileElement.prototype.unmount;
const logged=[],profile=installBuildProfile(view,{now:()=>++time,log:line=>logged.push(line)},()=>observing);
const frame=()=>{time+=16;const result=view.build({token:{owner,metrics,sequence:++sequence},resources});releaseSceneFrameSource(result);};
try{
  frame();controller.jumpToPage(1);frame();controller.jumpToPage(0);frame();
  const value=profile.snapshot().children;
  assert.equal(value.intervals.freshChild.count,3);
  assert.equal(value.intervals.retirement.count,2);
  assert.equal(value.intervals.resume,undefined);
  assert.equal(value.dormant,null);
  assert.equal(value.pages.length,3);
  assert(value.pages.every(page=>page.elements>0&&page.eligible&&!page.globalKeys));
  assert.equal(new Set(value.events.filter(event=>event.operation==='freshChild').map(event=>event.id)).size,3);
  assert(value.intervals.deactivateAndRemove.inclusiveMs>value.intervals.deactivateAndRemove.exclusiveMs,'Nested retirement was double-counted');
  for(const interval of Object.values(value.intervals))assert(interval.exclusiveMs>=0&&interval.exclusiveMs<=interval.inclusiveMs);
  const work=profile.snapshot().work;
  assert(work.intervals.firstRebuild.count>0);
  assert(work.intervals.elementMount.count>0&&work.intervals.stateMount.count>0&&work.intervals.renderMount.count>0);
  assert(work.counters.scheduleAttempts>work.counters.ownerCommits);
  assert.equal(work.counters.ownerCommits,work.intervals.ownerCommit.count);
  assert(work.intervals.reconcile.inclusiveMs>work.intervals.reconcile.exclusiveMs);
  for(const interval of Object.values(work.intervals))assert(interval.exclusiveMs>=0&&interval.exclusiveMs<=interval.inclusiveMs);
  profile.log('fixture',{},{});
  assert(logged.length>4);
  for(const line of logged){assert(Buffer.byteLength(line)<=8192);JSON.parse(line.slice(line.indexOf(' ')+1));}
  assert.equal(JSON.parse(logged.find(line=>line.startsWith('FAST_CHILD_PROFILE ')).slice('FAST_CHILD_PROFILE '.length)).pageCount,3);
  assert.equal(JSON.parse(logged.find(line=>line.startsWith('FAST_FRAMEWORK_PROFILE ')).slice('FAST_FRAMEWORK_PROFILE '.length)).counters.ownerCommits,work.counters.ownerCommits);
  profile.reset();assert.equal(profile.snapshot().children.events.length,0);
  observing=false;controller.jumpToPage(2);frame();assert.equal(profile.snapshot().children.pages.length,0);
  makePage=()=>GridView.count({crossAxisCount:2,children:[new SizedBox(20,20),new SizedBox(20,20)]});
  observing=true;profile.reset();controller.jumpToPage(3);frame();
  const nested=profile.snapshot().children.pages.find(page=>page.index===3);
  assert(nested.globalKeys>=3,'Nested Scrollable keys must remain excluded');
  assert.equal(nested.eligible,false);
  const excludedTypes=nested.excludedKeyWidgets.map(([type])=>type);
  for(const type of ['IgnorePointer','RawGestureDetector','Semantics'])assert(excludedTypes.some(name=>name.endsWith(type)),JSON.stringify(nested));
}finally{
  profile.dispose();assert.equal(ProfileSliverElement.prototype.createChild,originalCreate);assert.equal(ProfileElement.prototype.unmount,originalUnmount);
  status='closing';view.dispose();resources.dispose();controller.dispose();
}
assert.deepEqual(errors,[]);
// Exercise observer lifetime and failures independently of the page workload.
// Inactive builds still establish first-build history; resets preserve it.
let enabled=false,workClock=0,buildFailure=null;
class WorkItem extends Widget {
  constructor(readonly items:Widget[]=[]){super();}
  createElement(){return new WorkItemElement(this);}
}
class WorkItemElement extends WorkProfileElement {
  protected build(){if(buildFailure)throw buildFailure;return (this.widget as WorkItem).items;}
  override get renderObjects(){projectionReads++;return super.renderObjects;}
}
let projectionReads=0;
const buildOwner=new BuildOwner(context,()=>{}),foreignOwner=new BuildOwner(context,()=>{});
const workRoot=new SizedBox(10,10,new WorkItem([new SizedBox(2,2)])).createElement();
const beforeMount=WorkProfileElement.prototype.mount,beforeRebuild=WorkProfileElement.prototype.rebuild;
const originalSchedule=Object.getOwnPropertyDescriptor(buildOwner,'_scheduleRenderChildren');
const workProfile=installFrameworkWorkProfile({buildOwner},{now:()=>++workClock},()=>enabled);
let foreignRoot;
try{
  workRoot.mount(undefined,buildOwner);buildOwner.flushBuild();
  assert.deepEqual(workProfile.snapshot().intervals,{});
  enabled=true;workProfile.reset();workRoot.markNeedsBuild();buildOwner.flushBuild();
  assert.equal(workProfile.snapshot().intervals.firstRebuild,undefined);
  assert.equal(workProfile.snapshot().intervals.laterRebuild.count,1);
  const snapshot=workProfile.snapshot();workProfile.reset();
  assert.equal(snapshot.intervals.laterRebuild.count,1,'Reset mutated a previous snapshot');
  const oldClock=workClock;
  foreignRoot=new SizedBox(1,1).createElement();foreignRoot.mount(undefined,foreignOwner);foreignOwner.flushBuild();
  assert.equal(workClock,oldClock,'A foreign owner entered diagnostic timing');
  assert.deepEqual(workProfile.snapshot().intervals,{});
  const child=workRoot.children[0],failure=new Error('Exact build failure');
  buildFailure=failure;child.markNeedsBuild();
  assert.throws(()=>buildOwner.flushBuild(),error=>error===failure);
  assert.equal(workProfile.snapshot().intervals.laterRebuild.failed,1);
  buildFailure=null;child.markNeedsBuild();buildOwner.flushBuild();
  // A custom commit keeps its receiver, thrown value, retry and next-boundary
  // self-admission. The diagnostic never calls a projection to classify it.
  const synchronize=workRoot.synchronizeRenderObjectChildren;
  let fail=true,requeue=true,hookCalls=0;
  workRoot.synchronizeRenderObjectChildren=function(){
    assert.equal(this,workRoot);hookCalls++;
    if(fail){fail=false;throw failure;}
    if(requeue){requeue=false;buildOwner._scheduleRenderChildren(this);}
    return synchronize.call(this);
  };
  workProfile.reset();const readsBeforeCommit=projectionReads;buildOwner._scheduleRenderChildren(workRoot);
  assert.throws(()=>buildOwner.flushRenderTree(),error=>error===failure);
  assert.equal(workProfile.snapshot().intervals.ownerCommit.failed,1);
  buildOwner.flushRenderTree();assert.equal(hookCalls,2);
  buildOwner.flushRenderTree();assert.equal(hookCalls,3);
  assert.equal(workProfile.snapshot().counters.ownerCommits,3);
  assert.equal(workProfile.snapshot().counters.baseSetChildrenInCommit,0);
  assert.equal(projectionReads-readsBeforeCommit,2,'The profile reevaluated a virtual projection');
  // This deliberately unchanged replacement is a base call, not evidence of an
  // actual structural mutation. Keep that distinction in diagnostic consumers.
  workRoot.synchronizeRenderObjectChildren=function(){this.renderObject.setChildren(this.renderObject.children);};
  buildOwner._scheduleRenderChildren(workRoot);buildOwner.flushRenderTree();
  assert.equal(workProfile.snapshot().counters.baseSetChildrenInCommit,1);
  delete workRoot.synchronizeRenderObjectChildren;
}finally{
  buildFailure=null;
  workProfile.dispose();
  assert.equal(WorkProfileElement.prototype.mount,beforeMount);
  assert.equal(WorkProfileElement.prototype.rebuild,beforeRebuild);
  assert.deepEqual(Object.getOwnPropertyDescriptor(buildOwner,'_scheduleRenderChildren'),originalSchedule);
  workRoot.unmount();foreignRoot?.unmount();buildOwner.dispose();foreignOwner.dispose();
}
// Admission itself must agree with the census predicate. Preserve the real
// cache's key and Element limits, including exact-boundary and anchor cases.
const retired=[],cacheResources=new ResourceRegistry(),cache=new DormantChildCache({resources:cacheResources,canRetain:()=>true,retire:root=>retired.push(root),activate(){throw Error('Unexpected activation');}}),policyOwner={active:true};
const leaf=(key=null)=>({widget:{key},children:[]});
try{
  const appKey=leaf(new ProfileGlobalKey('app'));
  assert.equal(cache.retain(policyOwner,0,appKey,1),false);
  const oversized={widget:{key:null},children:Array.from({length:profileDormantLimits.elements},()=>leaf())};
  assert.equal(cache.retain(policyOwner,0,oversized,1),false);
  const boundary={widget:{key:null},children:Array.from({length:profileDormantLimits.elements-1},()=>leaf())};
  assert.equal(cache.retain(policyOwner,0,boundary,1),true);
  assert.equal(cache.debugStats.elements,profileDormantLimits.elements);
  cache.trim();assert.deepEqual(retired,[boundary]);
  assert.equal(cache.debugStats.elements,0);
  const anchor=leaf(createFrameworkAnchorKey());
  assert.equal(cache.retain(policyOwner,1,anchor,1),true);
}finally{cache.dispose();cacheResources.dispose();}
console.log('Child/framework work profile: fresh identity, census, key exclusion, exact cache admission, first/later builds, exclusive intervals, foreign/inactive gates, failure retry, next-boundary work, reset and hook cleanup PASS.');
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
  fs.writeFileSync(file, bundle.outputFiles[0].contents);
  await import(pathToFileURL(file).href);
}
