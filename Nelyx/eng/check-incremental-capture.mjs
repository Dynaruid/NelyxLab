// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
const watchdog = setTimeout(() => {
  throw Error('Capture checks exceeded 20 minutes');
}, 1200000);
try {
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
      import assert from 'node:assert/strict';
      import { RenderSceneCapture } from './Nelyx/runtime/app/capture.ts';
      import { SceneNode, SceneReference, SceneWriter } from './Nelyx/runtime/engine-client/scene.ts';
      import { protocol as p } from './Nelyx/runtime/engine-client/schema.ts';
      import { originalControlConfiguration } from './Nelyx/runtime/app/controls.ts';
      import { RenderSemanticsAnnotations } from '@nelyx/core/framework/rendering/semantics-annotations';
      import { SemanticsProperties } from '@nelyx/core/framework/semantics/semantics';
      import { claimNativeRenderObject } from '@nelyx/core/framework/rendering/object';
      const capture = new RenderSceneCapture(), calls = new Map(), effects:string[] = [];
      function render(name, children=[], dynamic=false) {
        const r:any = {name,children,dynamic,reference:new SceneReference(),color:0,debugDisposed:false,edge:''};
        for(const child of children) child.parent=r;
        return r;
      }
      const leaf=render('leaf'), live=render('live',[],true), sibling=render('sibling');
      const left=render('left',[leaf,live]), right=render('right',[sibling]), root=render('root',[left,right]);
      let fail=false;
      function visit(r,count,depth=0) {
        return capture.node(r,r.edge,count,depth,()=>{
          count.value++; calls.set(r.name,(calls.get(r.name)??0)+1);
          if(r.dynamic){capture.dynamic();effects.push(r.name);if(fail)throw Error('capture failed');}
          return new SceneNode(r.reference,'box',r.children.map(child=>visit(child,count,depth+1)),{color:r.color});
        },(nextCount,nextDepth)=>visit(r,nextCount,nextDepth));
      }
      const read=()=>{const count={value:0};const scene=visit(root,count);assert.equal(count.value,6);return scene;};
      const first=read(), second=read();
      assert.equal(calls.get('root'),1);assert.equal(calls.get('left'),1);assert.equal(calls.get('live'),2);
      assert.equal(first.options,second.options);assert.equal(first.children[1],second.children[1]);
      assert.notEqual(first.children[0].children[1],second.children[0].children[1]);
      assert.deepEqual(effects,['live','live'],'dynamic owner work must run on every pass');
      const writer=new SceneWriter({} as any,{pollEvents:false}) as any;
      writer.accepted=writer.records(second);
      leaf.color=0xff123456;capture.invalidate(leaf);
      const third=read(), desired=writer.records(third), changes=writer.diff(desired);
      assert.equal(desired.get('1:1'),writer.accepted.get('1:1'),'unchanged ancestor configuration record must retain identity');
      assert.equal(desired.get('1:1').node.children.length,0,'accepted records must not pin old Scene subtrees');
      assert.equal(changes.length,1,'one local paint mutation must reach the wire');
      assert.equal(calls.get('root'),1);assert.equal(calls.get('leaf'),2);
      assert.equal(third.children[1],second.children[1]);
      writer.accepted=writer.records(third);
      left.children=[live];right.children.push(leaf);leaf.parent=right;
      capture.invalidate(left);capture.invalidate(right);
      const moved=read(), moves=writer.diff(writer.records(moved));
      assert(moves.some(bytes=>new DataView(bytes.buffer).getUint16(0,true)===p.commands.move));
      assert.equal(moved.children[1].children[1].reference,leaf.reference);
      sibling.edge='changed';capture.invalidate(right);
      read();assert.equal(calls.get('sibling'),2,'changed parent edge must invalidate the child cache');
      capture.context='new-metrics';read();assert.equal(calls.get('root'),2);
      fail=true;assert.throws(read,/capture failed/);fail=false;read();
      assert.throws(()=>visit(root,{value:p.limits.nodes-2}),/budget/);
      capture.clear();const rebuilt=read();assert.notEqual(rebuilt,moved);
      const semanticCapture = new RenderSceneCapture(), semanticReference = new SceneReference();
      let actions = '', semanticBuilds = 0;
      const semantic = new RenderSemanticsAnnotations({properties:new SemanticsProperties({label:'A',button:true,onTap:()=>actions+='A'})});
      claimNativeRenderObject(semantic, {}, () => semanticCapture.invalidate(semantic));
      const semanticRead = () => semanticCapture.node(semantic,'',{value:0},0,()=>{
        ++semanticBuilds;
        const config=originalControlConfiguration(semantic,reason=>{throw Error(reason);})!;
        if(!config.cacheableSemantics)semanticCapture.dynamic();
        return new SceneNode(semanticReference,'box',[],config.options);
      },()=>semanticRead());
      const semanticFirst=semanticRead();
      assert.equal(semanticRead(),semanticFirst,'Unchanged simple semantics should retain configuration');
      assert.equal(semanticBuilds,1);
      semanticFirst.options.onAction!('activate');
      semantic.properties=new SemanticsProperties({label:'B',button:true,onTap:()=>actions+='B'});
      const semanticNext=semanticRead();
      assert.equal(semanticBuilds,2,'Label/action update must invalidate retained semantics');
      assert.equal(semanticNext.options.semantics?.label,'B');
      semanticNext.options.onAction!('activate');
      assert.equal(actions,'AB','Retained semantics invoked a stale callback');
      semantic.dispose();semanticCapture.clear();
      const terminalWriter=new SceneWriter({} as any,{pollEvents:false}) as any;
      const terminalEvents:string[]=[];
      const hoverScene=new SceneNode(new SceneReference(),'box',[],{
        mouseRegion:{opaque:true},onGesture:event=>terminalEvents.push(event.kind),
      });
      terminalWriter.adopt(terminalWriter.records(hoverScene),[]);
      const mouseRecord=[...terminalWriter.accepted.values()][0];
      await terminalWriter.deliverInput({gestureRequests:[],events:[{
        kind:p.events.gesture,status:p.gestureKinds.mouseEnter,node:mouseRecord.handle,
        id:1n,x:10,y:20,detail:0n,
      }]});
      terminalWriter.adopt(new Map(),[]);
      terminalWriter.adopt(new Map(),[]);
      assert.deepEqual(terminalEvents,['mouseEnter','mouseExit'],
        'A retained Source removed from Content needs exactly one terminal hover exit');
      assert.equal(terminalWriter.hovered.size,0);
      console.log('Incremental capture: dynamic effects, local dirty path, reparent, edge/context, failure and budgets PASS.',capture.counters);
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
