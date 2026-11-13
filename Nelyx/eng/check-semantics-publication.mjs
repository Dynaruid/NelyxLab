// SPDX-License-Identifier: BSD-3-Clause
import path from 'node:path';
import { build } from 'esbuild';

const watchdog = setTimeout(() => {
  throw Error('Published semantics checks exceeded 20 minutes');
}, 1_200_000);
try {
  const result = await build({
    stdin: {
      resolveDir: path.resolve(import.meta.dirname, '../..'),
      loader: 'ts',
      contents: `
        import assert from 'node:assert/strict';
        import {OriginalSemanticsBridge} from './Nelyx/runtime/app/semantics.ts';
        import {SemanticsBinding} from '@nelyx/core/framework/semantics/binding';
        import {intersect} from '@nelyx/core/ui/geometry';
        import {protocol as p} from './Nelyx/runtime/engine-client/schema.ts';
        const owner:any={services:{owner:{id:'legacy'}},bindSemanticsBinding:()=>({dispose(){}})};
        const bridge=new OriginalSemanticsBridge(1,owner,{} as any),binding=bridge.binding;
        const reference=new SemanticsBinding();
        const rect=(x=0,y=0,width=30,height=20)=>({x,y,width,height});
        const node=(slot,generation=1)=>({node:{slot,generation},bounds:rect(),clip:rect(0,0,300,200),semantics:{flags:0}});
        const state=(publication,overrides={})=>({publication,visible:true,closed:false,metrics:2n,device:3n,...overrides}) as any;
        const frame=(publication,nodes,overrides={})=>({publication,publishedMetrics:2n,publishedDevice:3n,nodes,...overrides}) as any;
        function expected(nodes){
          reference.updateViewSemantics(1,nodes.filter(n=>n.semantics&&!(n.semantics.flags&p.semanticsFlags.hidden)).map(n=>({
            id:n.node.slot+':'+n.node.generation,role:'group',name:'unused',
            bounds:intersect(n.semanticGeometry?.bounds??n.bounds,n.clip),
          })).filter(n=>n.bounds.width>0&&n.bounds.height>0),'legacy');
        }
        const read=(id,view:any=1)=>binding.getRectOfSemanticsNodeInViewCoordinates(view,id);
        try {
          const a=node(1),b=node(2),hidden=node(3),clipped=node(4),plain=node(5);
          a.semanticGeometry={bounds:rect(12,14,40,30)};
          b.clip=rect(10,0,20,20);hidden.semantics.flags=p.semanticsFlags.hidden;
          clipped.bounds=rect(500,500);plain.semantics=undefined;
          const nodes=[a,b,hidden,clipped,plain];
          let visits=0;
          const rows=new Proxy(nodes,{get(target,key,receiver){if(key===Symbol.iterator)++visits;return Reflect.get(target,key,receiver)}});
          bridge.observePublication(frame(1n,rows));assert.equal(read('1:1'),null,'Unconfirmed publication exposed geometry');
          bridge.observeState(state(1n));assert.equal(visits,0,'Publication eagerly traversed nodes');
          expected(nodes);
          for(const id of ['1:1','2:1','3:1','4:1','5:1','1:2','01:1','1:01','1:1x','4294967296:1',1]){
            assert.deepEqual(read(id),reference.getRectOfSemanticsNodeInViewCoordinates(1,id),String(id));
            assert.deepEqual(read(id,'legacy'),read(id));
          }
          assert.equal(visits,1,'Rectangle queries failed to share the publication index');
          const first=read('1:1');assert(Object.isFrozen(first));
          assert.equal(read('1:1'),first);assert.equal(read('1:1','legacy'),first);
          assert.throws(()=>{first.x=999},TypeError);
          const moved=node(1);moved.bounds=rect(120,4,30,20);
          Object.defineProperty(moved.semantics,'label',{get(){throw Error('Geometry query read metadata text')}});
          bridge.observePublication(frame(2n,[moved]));assert.equal(read('1:1'),null,'Mismatched publication remained queryable');
          bridge.observeState(state(2n));assert.deepEqual(read('1:1'),moved.bounds);assert.equal(read('2:1'),null);
          assert.equal(first.x,12,'Old public Rect changed after movement');
          bridge.observeState(state(2n,{metrics:4n}));assert.equal(read('1:1'),null);
          bridge.observeState(state(2n));assert.equal(read('1:1').x,120);
          bridge.observeState(state(2n,{device:4n}));assert.equal(read('1:1'),null);
          bridge.observeState(state(2n,{visible:false}));assert.equal(read('1:1'),null);
          bridge.observeState(state(2n));
          const recycled=node(1,2);bridge.observePublication(frame(3n,[recycled]));bridge.observeState(state(3n));
          assert.equal(read('1:1'),null);assert.deepEqual(read('1:2'),recycled.bounds);
          let performed=0,observed:any;
          binding.addSemanticsActionListener(()=>{observed=read('1:2')});
          bridge.action({detail:p.semanticsActions.activate,id:2n,node:recycled.node} as any,()=>++performed);
          assert.equal(observed,null,'Stale action exposed a current rectangle');assert.equal(performed,1);
          assert.deepEqual(read('1:2'),recycled.bounds,'Action completion failed to restore current geometry');
          bridge.action({detail:p.semanticsActions.activate,id:3n,node:recycled.node} as any,()=>++performed);
          assert.deepEqual(observed,recycled.bounds);assert.equal(performed,2);
          bridge.observeState(state(3n,{closed:true}));assert.equal(read('1:2'),null);
          bridge.observeState(state(3n));
          bridge.stop();assert.equal(read('1:2'),null);assert.equal(read('1:2','legacy'),null);
          bridge.observePublication(frame(4n,[a]));assert.equal(read('1:1'),null);
          // The public tree API still owns snapshots, aliases, and child/source IDs.
          const source=rect(7,8),child={id:'child',sourceNodeId:8,role:'group',bounds:source};
          reference.updateViewSemantics(2,[{id:'parent',role:'group',bounds:rect(),children:[child]}],'public');
          source.x=100;
          assert.equal(reference.getRectOfSemanticsNodeInViewCoordinates('public',8).x,7);
          assert.equal(reference.getRectOfSemanticsNodeInViewCoordinates(2,'child').x,7);
          reference.updateViewSemantics(2,[],'public');
          assert.equal(reference.getRectOfSemanticsNodeInViewCoordinates('public',8),null);
          assert.equal(bridge.counters.visitedPublicationNodes,0);
          assert.equal(bridge.counters.temporarySemanticsNodes,0);
          console.log('Published semantics resolver, reference rectangles, clipping, generation, stale actions, aliases and close PASS');
        } finally {bridge.close();reference.dispose()}
      `,
    },
    alias: { '@nelyx/core': path.resolve(import.meta.dirname, '../src') },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    logLevel: 'silent',
  });
  await import(
    'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64')
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
}
