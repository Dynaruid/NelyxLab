// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';

const watchdog = setTimeout(() => {
  throw Error('Capture projection checks exceeded 20 minutes');
}, 1_200_000);
try {
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: String.raw`
        import assert from 'node:assert/strict';
        import {RenderSceneCapture} from './Nelyx/runtime/app/capture.ts';
        import {SceneNode,SceneReference,SceneWriter} from './Nelyx/runtime/engine-client/scene.ts';
        import {protocol as p} from './Nelyx/runtime/engine-client/schema.ts';
        import {nativeRenderFields} from '@nelyx/core/framework/rendering/object';

        function observe(mode:number) {
          const effects:any[]=[], stages:any[]=[], failure=Error('projection failure');
          let fail=false, reenter=false, closures=0;
          const node=(name:string,children:any[]=[],dynamic=false)=>{
            const render:any={name,children,dynamic,color:0xff102030,reference:new SceneReference(),debugDisposed:false,edge:{index:0,key:1n}};
            for(const child of children)child.parent=render;
            return render;
          };
          const leaf=node('leaf'),live=node('live',[],true),spare=node('spare');
          const left=node('left',[leaf,live]),right=node('right',[spare]),root=node('root',[left,right]);
          const projection={
            build(render,count,depth,edge,fields,previous,initial){
              assert.equal(this,projection,'shared builder lost its owner');
              return capture(render,count,depth,edge,fields,previous,initial);
            },
            refresh(render,count,depth,edge){
              assert.equal(this,projection,'shared refresh lost its owner');
              return visit(render,count,depth,edge);
            },
          };
          const journal=new RenderSceneCapture(projection),writer:any=new SceneWriter({}, {retainedScene:true,pollEvents:false});
          function shared(render){return mode===1||(mode===2&&render.name!=='left'&&render.name!=='spare');}
          function visit(render,count={value:0},depth=0,edge=render.edge){
            // Like host.node, independently evaluate the live small edge key
            // before either the complete-reuse or descendant-reconnect path.
            effects.push(['edge',render.name,edge.index,String(edge.key)]);
            const input=edge.index+'/'+edge.key;
            if(shared(render))return journal.node(render,input,count,depth,undefined,undefined,edge);
            closures+=2;
            return journal.node(render,input,count,depth,
              (fields,previous,initial)=>capture(render,count,depth,edge,fields,previous,initial),
              (nextCount,nextDepth)=>visit(render,nextCount,nextDepth,edge));
          }
          function capture(render,count,depth,edge,fields,previous,initial){
            if(++count.value>=p.limits.nodes||depth>=p.limits.depth)throw Error('fixture budget');
            effects.push(['build',render.name,depth,edge.index,String(edge.key),fields,!!previous,initial]);
            journal.bind('owners',render.name,edge);
            if(render===live)journal.dependOn(leaf,['paint']);
            if(render.dynamic)journal.dynamic();
            if(render===leaf&&reenter){reenter=false;journal.invalidate(render,'paint',undefined,nativeRenderFields.paint);}
            if(render===live&&fail)throw failure;
            return new SceneNode(render.reference,'box',render.children.map(child=>visit(child,count,depth+1)),{color:render.color});
          }
          function take(label:string){
            const count={value:0},scene=visit(root,count);
            journal.commit([root]);
            const records=writer.records(scene),wire=writer.diff(records).map(bytes=>Array.from(bytes));
            writer.adopt(records,[]);
            stages.push({label,count:count.value,wire,counters:{...journal.counters},owners:[...journal.bindings('owners')].map(([name,edge]:any)=>[name,edge.index,String(edge.key)])});
            return scene;
          }
          take('cold');take('dynamic-only');
          leaf.color=0xff203040;journal.invalidate(leaf,'paint',undefined,nativeRenderFields.paint);take('local-paint-and-consumer');
          // Reconnect uses the previous edge object, just as the original
          // refresh closure does; replacing a parent's current input must not
          // silently change a retained child's captured edge.
          const capturedEdge=leaf.edge;leaf.edge={index:7,key:99n};
          capturedEdge.index=2;capturedEdge.key=3n;
          journal.invalidate(leaf,'paint',undefined,nativeRenderFields.paint);take('captured-edge');
          journal.invalidate(left,'children');take('current-edge');
          const edgeFailure=Error('edge getter failure');let throwEdge=true;
          Object.defineProperty(leaf.edge,'index',{configurable:true,get(){effects.push(['index-getter']);if(throwEdge)throw edgeFailure;return 7;}});
          assert.throws(()=>visit(root),error=>error===edgeFailure);journal.abort();throwEdge=false;take('edge-getter-recovery');
          left.children=[live];right.children.push(leaf);leaf.parent=right;
          journal.invalidate(left,'children');journal.invalidate(right,'children');take('reparent');
          reenter=true;journal.invalidate(leaf,'paint',undefined,nativeRenderFields.paint);take('invalidate-during-build');take('next-pass-mask');
          journal.context='metrics/device/font';take('cohort');
          fail=true;assert.throws(()=>visit(root),error=>error===failure);journal.abort();fail=false;take('abort-and-recover');
          right.children=[spare];leaf.parent=undefined;journal.invalidate(right,'children');take('retire');
          assert.equal(journal.bindings('owners').has('leaf'),false,'retired owner registration remained');
          right.children.push(leaf);leaf.parent=right;journal.invalidate(right,'children');take('reactivate');
          journal.batchInvalidations(()=>assert.throws(()=>visit(root),/cannot run inside a Source build batch/));
          assert.throws(()=>visit(root,{value:p.limits.nodes-2}),/budget/);journal.abort();take('budget-recovery');
          journal.clear();take('clear');
          return {effects,stages,closures};
        }
        const reference=observe(0),shared=observe(1),mixed=observe(2);
        assert.deepEqual(shared.effects,reference.effects,'shared projection changed getter/build/edge ordering');
        assert.deepEqual(shared.stages,reference.stages,'shared projection changed wire, fields, lifetime or registrations');
        assert.deepEqual(mixed.effects,reference.effects,'mixed callbacks and shared projection changed effects');
        assert.deepEqual(mixed.stages,reference.stages,'mixed callbacks and shared projection changed wire or lifetime');
        assert(reference.closures>0);assert.equal(shared.closures,0);assert(mixed.closures>0&&mixed.closures<reference.closures);
        const empty=new RenderSceneCapture();assert.throws(()=>empty.node({} as any,'',{value:0},0,undefined,undefined),/no host projection/);
        console.log('Capture projection: '+reference.stages.length+' stages, exact wire/effects/masks/edge/reparent/registration/abort/budget/clear, mixed callbacks PASS; per-read closures '+reference.closures+' -> '+shared.closures+'.');
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
    'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64')
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
}
