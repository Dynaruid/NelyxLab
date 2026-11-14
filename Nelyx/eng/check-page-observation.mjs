// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
import fs from 'node:fs';
const watchdog = setTimeout(() => {
  throw Error('Page observation exceeded 20 minutes');
}, 1_200_000);
try {
  const bundle = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
      import assert from 'node:assert/strict';
      import { NativePositionForCheck, NativeListStateForCheck, scrollControllerForCheck } from './Nelyx/runtime/app/scroll.ts';
      import { Element } from '@nelyx/core/framework/widgets/framework';
      import { FrameScheduler } from '@nelyx/core/framework/scheduler/scheduler';
      import { registerTickerScheduler, unregisterTickerScheduler } from '@nelyx/core/internal/framework/widgets/ticker-scheduler';
      import { PageController, PageView } from '@nelyx/core/framework/widgets/page-view';
      import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
      import { AxisDirection } from '@nelyx/core/framework/painting/basic-types';
      import { ListView } from '@nelyx/core/framework/widgets/scroll-view';
      import { SliverChildBuilderDelegate } from '@nelyx/core/framework/widgets/scroll-delegate';
      import { SizedBox } from '@nelyx/core/framework/widgets/basic';
      import {protocol as p} from './Nelyx/runtime/engine-client/schema.ts';
      const owner={}, storage=Object.create(Element.prototype);storage.owner=owner;
      const scheduler=new FrameScheduler({now:()=>0} as any,()=>{});
      registerTickerScheduler(owner as any,scheduler);
      const commands=[],commandNodes=[];let building=false;
      const host={fail:reason=>{throw Error(reason);},error:error=>{throw error;},view:{
        documentEpoch:1n,hasPendingTransaction:false,
        startScroll(node,target){commands.push(target);commandNodes.push(node);return {id:BigInt(commands.length),receipt:new Promise(()=>{})};},
        cancelScroll:async()=>{},
      },canDispatch:()=>!building};
      const context={storageContext:storage,notificationContext:null,axisDirection:AxisDirection.right,
        devicePixelRatio:1,vsync:{createTicker(){throw Error('Native page must not start an App ticker');}},
        setIgnorePointer(){},setCanDrag(){},setSemanticsActions(){},saveOffset(){}};
      const viewport={node:{slot:1,generation:1},width:200,height:100,offset:1800,scrollMinimum:0,scrollMaximum:10000,
        preparedCoverage:{minimum:0,maximum:10000}};
      try {
        const controller=new PageController({initialPage:10}),position=new NativePositionForCheck(host,context,controller,null,100);
        position.applyViewportDimension(100);position.applyContentDimensions(0,10000);
        controller.attach(position);
        position.observe(viewport,null,null,1n);
        assert.equal(commands.length,0,'A delayed App page wrote its old position over the activated Core resize anchor');
        assert.equal(controller.page,9,'PageController must mirror the newly activated native geometry');
        controller.detach(position);position.dispose();controller.dispose();
        const explicit=new PageController({initialPage:10}),pending=new NativePositionForCheck(host,context,explicit,null,100);
        pending.applyViewportDimension(100);pending.applyContentDimensions(0,10000);
        explicit.attach(pending);explicit.jumpToPage(12);
        pending.observe(viewport,null,null,1n);
        assert.equal(commands.at(-1),2400,'Resize lost a pending explicit App page write');
        assert.equal(explicit.page,12);
        explicit.detach(pending);pending.dispose();explicit.dispose();
        const sliver={node:{slot:2,generation:1},parent:viewport.node,list:{generation:1n,count:100,fixed:true,items:[]}};
        const selections=[];
        host.view.observeApp=async(op,selection)=>{assert.equal(op,p.opcodes.layoutSnapshot);selections.push(selection);return {nodes:[viewport,sliver]};};
        host.view.layoutSnapshot=()=>{throw Error('Scroll coverage requested the entire layout');};
        const selected=new PageController({initialPage:9}),bounded=new NativePositionForCheck(host,context,selected,null,200);
        bounded.applyViewportDimension(200);bounded.applyContentDimensions(0,10000);selected.attach(bounded);
        bounded.observe(viewport,sliver,200,1n);selected.jumpToPage(10);
        for(let i=0;i<8;++i)await Promise.resolve();
        assert.deepEqual(selections,[[sliver.node]],'Coverage must select only the list and its Core-owned parent');
        assert.equal(commands.at(-1),2000,'Selected coverage changed command dispatch');
        selected.detach(bounded);bounded.dispose();selected.dispose();
        const retained=new PageController(),fenced=new NativePositionForCheck(host,context,retained,null,200);
        retained.attach(fenced);fenced.observe(viewport,null,null,1n);
        const beforeFence=commands.length;
        building=true;retained.jumpToPage(2);
        assert.equal(commands.length,beforeFence,'Source build dispatched a handle from the render tree it is replacing');
        building=false;host.view.hasPendingTransaction=true;fenced.observe(viewport,null,null,1n);
        assert.equal(commands.length,beforeFence,'A pending transaction received a scroll for its old viewport');
        host.view.hasPendingTransaction=false;host.view.documentEpoch=2n;
        fenced.observe(viewport,null,null,1n);
        assert.equal(commands.length,beforeFence,'An old published document dispatched an invalid viewport handle');
        const rebound={...viewport,node:{slot:3,generation:2}};
        fenced.observe(rebound,null,null,2n);
        assert.equal(commands.length,beforeFence+1,'A fresh owner observation did not resume its pending command');
        assert.deepEqual(commandNodes.at(-1),rebound.node,'The resumed command reused an expired viewport generation');
        assert.equal(commands.at(-1),400,'The pending controller target changed across publication');
        retained.detach(fenced);fenced.dispose();retained.dispose();host.view.documentEpoch=1n;
        const pages=new NativeListStateForCheck() as any,pageController=new PageController();
        Object.defineProperties(pages,{widget:{value:{host}}});
        let builds=0;
        Object.assign(pages,{controller:pageController,begin:18,end:22,count:100,windowSize:4,
          position:{desiredOffset:1900},
          setState(callback){++builds;callback();}});
        const covered={preparedCoverage:{minimum:1900,maximum:2200},deferred:false};
        pages.observeDemand(19,23,covered,{begin:19,end:23});
        assert.equal(builds,0,'A late materialized window undid the requested Source window');
        assert.equal(pages.begin,18);
        pages.observeDemand(17,21,covered,{begin:18,end:22});assert.equal(builds,1,'Current window demand did not advance');
        pages.position.desiredOffset=1700;
        pages.observeDemand(16,20,covered,{begin:19,end:23});assert.equal(builds,2,'An uncovered destination waited for a window cohort');
        pages.position.desiredOffset=1900;
        pages.observeDemand(15,19,{...covered,deferred:true},{begin:19,end:23});assert.equal(builds,3,'A visible coverage miss was deferred');
        const abandoned={document:2n,activeDocument:1n,pendingDocument:0n,preparation:0n};
        host.view.documentEpoch=2n;host.counters={preservedRequestedWindows:0,recoveredCanceledWindows:0};
        Object.assign(pages,{begin:18,end:22});
        for(const snapshot of [
          {...abandoned,pendingDocument:2n},
          {...abandoned,preparation:5n},
          {...abandoned,document:1n},
          {...abandoned,activeDocument:2n},
        ])pages.observeDemand(17,21,covered,{begin:19,end:23},snapshot);
        assert.equal(builds,3,'An old observation or live preparation rolled back the requested window');
        host.view.hasPendingTransaction=true;
        pages.observeDemand(17,21,covered,{begin:19,end:23},abandoned);
        assert.equal(builds,3,'A pending transaction lost its requested window');
        host.view.hasPendingTransaction=false;
        pages.observeDemand(17,21,covered,{begin:19,end:23},abandoned);
        assert.deepEqual([pages.begin,pages.end],[17,21],
          'Canceled page preparation left its replacement demand suppressed as in-flight');
        assert.equal(builds,4);assert.equal(host.counters.recoveredCanceledWindows,1);
        Object.assign(pages,{begin:0,end:1});
        pages.observeDemand(10,11,{deferred:true});
        assert.deepEqual([pages.begin,pages.end],[10,11],
          'A required single page synchronously built unrelated prefetch neighbours');
        pages.observeDemand(10,12,{deferred:true});
        assert.deepEqual([pages.begin,pages.end],[10,12],
          'A fractional PageView did not retain both visible pages');
        pages.observeDemand(10,11,{deferred:true});
        assert.deepEqual([pages.begin,pages.end],[10,12],
          'A covered page demand churned its resident neighbour');
        host.view.documentEpoch=1n;
        pageController.dispose();
        const retainedPage=new PageController({initialPage:10});let childBuilds=0;
        const delegate=new SliverChildBuilderDelegate(()=>{++childBuilds;return SizedBox.shrink();},{childCount:100});
        let list=ListView.custom({controller:retainedPage,itemExtent:200,childrenDelegate:delegate});
        const state=new NativeListStateForCheck() as any;
        Object.defineProperties(state,{
          widget:{get:()=>({list,controller:retainedPage,host})},
          context:{value:{services:{readMetrics:()=>({logicalWidth:200,logicalHeight:100})}}},
        });
        Object.assign(state,{controller:retainedPage,position:{desiredPage:10,desiredOffset:2000,hasNativeViewport:true}});
        state.reset();state.fill();const resident=[...state.entries.values()].map(entry=>entry.child);
        assert.equal(childBuilds,4);
        const old=list;list=ListView.custom({controller:retainedPage,itemExtent:240,childrenDelegate:delegate});
        state.didUpdateWidget({list:old});state.fill();
        assert.equal(childBuilds,4,'Viewport resize rebuilt an unchanged resident delegate');
        assert.deepEqual([...state.entries.values()].map(entry=>entry.child),resident,'Resize replaced resident child identity');
        const resized=list;list=ListView.custom({controller:retainedPage,itemExtent:240,
          childrenDelegate:new SliverChildBuilderDelegate(()=>{++childBuilds;return SizedBox.shrink();},{childCount:100})});
        state.didUpdateWidget({list:resized});state.fill();
        assert.equal(childBuilds,8,'A real delegate replacement failed to refresh resident children');
        // Core has already requested a newer window, while Source still sees
        // the older page publication. A header/delegate update cannot move it.
        host.counters={preservedRequestedWindows:0};
        Object.assign(state,{begin:18,end:22,setState:callback=>callback()});
        const pendingList=list;list=ListView.custom({controller:retainedPage,itemExtent:240,childrenDelegate:list.childrenDelegate});
        state.didUpdateWidget({list:pendingList});
        assert.deepEqual([state.begin,state.end],[18,22],'A delayed desiredPage rolled back the Core-requested window');
        assert.equal(host.counters.preservedRequestedWindows,1);
        state.observeDemand(9,13,{deferred:true});
        assert.deepEqual([state.begin,state.end],[9,13],'Explicit/reverse Core demand could not replace the retained window');
        const fullList=list;list=ListView.custom({controller:retainedPage,itemExtent:240,
          childrenDelegate:new SliverChildBuilderDelegate(()=>SizedBox.shrink(),{childCount:2})});
        state.didUpdateWidget({list:fullList});
        assert.deepEqual([state.begin,state.end],[0,2],'A changed finite count retained out-of-range children');
        retainedPage.dispose();
        const page=PageView.builder({itemCount:100,itemBuilder:()=>SizedBox.shrink()});
        const pageState=page.createState() as any;
        Object.defineProperty(pageState,'widget',{value:page});pageState.initState();
        const atWidth=width=>pageState.build().builder({},BoxConstraints.tight({width,height:100})).child.child;
        const firstSize=atWidth(200),secondSize=atWidth(240);
        assert.equal(firstSize.itemExtent,200);assert.equal(secondSize.itemExtent,240);
        assert.equal(firstSize.cacheExtent,0,'PageView must not retain offscreen pages through the ListView cache');
        assert.equal(scrollControllerForCheck(firstSize,{} as any,reason=>{throw Error(reason);}).controller,
          firstSize.controller,'A zero-cache PageView lost its native page adapter');
        assert.equal(firstSize.childrenDelegate,secondSize.childrenDelegate,
          'PageView recreated its Source delegate to transport a viewport constraint change');
        assert.equal(firstSize.childrenDelegate,page.childrenDelegate);
        pageState.dispose();
        await Promise.resolve();
        console.log('Page observation: Core resize anchor, pending explicit page rescale and selected coverage command dispatch PASS.');
      } finally {unregisterTickerScheduler(owner as any);scheduler.dispose();}
    `,
    },
    plugins: [
      {
        name: 'test-native-position',
        setup(build) {
          build.onLoad({ filter: /runtime[\\/]app[\\/]scroll\.ts$/ }, ({ path }) => {
            let contents = fs.readFileSync(path, 'utf8');
            if (process.argv.includes('--previous-behavior'))
              contents = contents.replace(
                'if (dimension > 0 && (this.request || this.preserveDesired))',
                'if (dimension > 0)',
              );
            return {
              contents:
                contents +
                '\nexport { NativePosition as NativePositionForCheck, NativeListState as NativeListStateForCheck, scrollController as scrollControllerForCheck };',
              loader: 'ts',
            };
          });
        },
      },
    ],
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
