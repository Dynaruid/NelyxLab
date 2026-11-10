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
      import { NativePositionForCheck, NativeListStateForCheck } from './Nelyx/runtime/app/scroll.ts';
      import { Element } from '@nelyx/core/framework/widgets/framework';
      import { FrameScheduler } from '@nelyx/core/framework/scheduler/scheduler';
      import { registerTickerScheduler, unregisterTickerScheduler } from '@nelyx/core/internal/framework/widgets/ticker-scheduler';
      import { PageController } from '@nelyx/core/framework/widgets/page-view';
      import { AxisDirection } from '@nelyx/core/framework/painting/basic-types';
      import {protocol as p} from './Nelyx/runtime/engine-client/schema.ts';
      const owner={}, storage=Object.create(Element.prototype);storage.owner=owner;
      const scheduler=new FrameScheduler({now:()=>0} as any,()=>{});
      registerTickerScheduler(owner as any,scheduler);
      const commands=[];
      const host={fail:reason=>{throw Error(reason);},error:error=>{throw error;},view:{
        startScroll(node,target){commands.push(target);return {id:BigInt(commands.length),receipt:new Promise(()=>{})};},
        cancelScroll:async()=>{},
      }};
      const context={storageContext:storage,notificationContext:null,axisDirection:AxisDirection.right,
        devicePixelRatio:1,vsync:{createTicker(){throw Error('Native page must not start an App ticker');}},
        setIgnorePointer(){},setCanDrag(){},setSemanticsActions(){},saveOffset(){}};
      const viewport={node:{slot:1,generation:1},width:200,height:100,offset:1800,scrollMinimum:0,scrollMaximum:10000,
        preparedCoverage:{minimum:0,maximum:10000}};
      try {
        const controller=new PageController({initialPage:10}),position=new NativePositionForCheck(host,context,controller,null,100);
        position.applyViewportDimension(100);position.applyContentDimensions(0,10000);
        controller.attach(position);
        position.observe(viewport,null,null);
        assert.equal(commands.length,0,'A delayed App page wrote its old position over the activated Core resize anchor');
        assert.equal(controller.page,9,'PageController must mirror the newly activated native geometry');
        controller.detach(position);position.dispose();controller.dispose();
        const explicit=new PageController({initialPage:10}),pending=new NativePositionForCheck(host,context,explicit,null,100);
        pending.applyViewportDimension(100);pending.applyContentDimensions(0,10000);
        explicit.attach(pending);explicit.jumpToPage(12);
        pending.observe(viewport,null,null);
        assert.equal(commands.at(-1),2400,'Resize lost a pending explicit App page write');
        assert.equal(explicit.page,12);
        explicit.detach(pending);pending.dispose();explicit.dispose();
        const sliver={node:{slot:2,generation:1},parent:viewport.node,list:{generation:1n,count:100,fixed:true,items:[]}};
        const selections=[];
        host.view.observeApp=async(op,selection)=>{assert.equal(op,p.opcodes.layoutSnapshot);selections.push(selection);return {nodes:[viewport,sliver]};};
        host.view.layoutSnapshot=()=>{throw Error('Scroll coverage requested the entire layout');};
        const selected=new PageController({initialPage:9}),bounded=new NativePositionForCheck(host,context,selected,null,200);
        bounded.applyViewportDimension(200);bounded.applyContentDimensions(0,10000);selected.attach(bounded);
        bounded.observe(viewport,sliver,200);selected.jumpToPage(10);
        for(let i=0;i<8;++i)await Promise.resolve();
        assert.deepEqual(selections,[[sliver.node]],'Coverage must select only the list and its Core-owned parent');
        assert.equal(commands.at(-1),2000,'Selected coverage changed command dispatch');
        selected.detach(bounded);bounded.dispose();selected.dispose();
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
        pageController.dispose();
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
                '\nexport { NativePosition as NativePositionForCheck, NativeListState as NativeListStateForCheck };',
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
