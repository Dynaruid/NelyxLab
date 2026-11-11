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
      import {commands as creationCommands} from './Nelyx/runtime/engine-client/codec.ts';
      import { RenderSceneCapture } from './Nelyx/runtime/app/capture.ts';
      import { SceneNode, SceneReference, SceneWriter, retainSceneConfiguration } from './Nelyx/runtime/engine-client/scene.ts';
      import { protocol as p } from './Nelyx/runtime/engine-client/schema.ts';
      import { originalControlConfiguration } from './Nelyx/runtime/app/controls.ts';
      import { RenderSemanticsAnnotations } from '@nelyx/core/framework/rendering/semantics-annotations';
      import { SemanticsProperties } from '@nelyx/core/framework/semantics/semantics';
      import { claimNativeRenderObject } from '@nelyx/core/framework/rendering/object';
      import {LayoutBuilder} from '@nelyx/core/framework/widgets/layout-builder';
      import {BoxConstraints} from '@nelyx/core/framework/rendering/constraints';
      import {originalBoxConfiguration} from './Nelyx/runtime/app/layout.ts';
      import {RenderPadding} from '@nelyx/core/framework/rendering/boxes';
      import {EdgeInsets} from '@nelyx/core/framework/painting/edge-insets';
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
      const durable = new RenderSceneCapture();
      const fontOwner=render('fontOwner'), target=render('target'), dependent=render('dependent');
      const durableRoot=render('durableRoot',[fontOwner,target,dependent]);
      let resourceRevision=1, durableBuilds=0;
      const project=(r,count={value:0},depth=0)=>durable.node(r,'',count,depth,()=>{
        ++durableBuilds;++count.value;
        if(r===fontOwner)durable.bind('font',resourceRevision,resourceRevision);
        if(r===dependent)durable.dependOn(target);
        return new SceneNode(r.reference,'stack',r.children.map(child=>project(child,count,depth+1)));
      },(count,depth)=>project(r,count,depth));
      project(durableRoot);durable.commit([durableRoot]);
      assert.deepEqual([...durable.bindings('font').keys()],[1]);
      const durableInitial=durableBuilds, registered=durable.counters.registrationEdits;
      project(durableRoot);durable.commit([durableRoot]);
      assert.equal(durableBuilds,durableInitial,'Unchanged resource owner was recaptured');
      assert.equal(durable.counters.registrationEdits,registered,'Reused subtree repeated registration');
      durable.invalidate(target);project(durableRoot);durable.commit([durableRoot]);
      assert.equal(durableBuilds-durableInitial,2,'Reference target did not invalidate its non-tree consumer');
      assert.equal(durable.counters.registrationEdits,registered,'Unrelated change touched a font owner');
      durableRoot.children=[target,dependent];durable.invalidate(durableRoot);
      project(durableRoot);durable.commit([durableRoot]);
      assert.equal(durable.bindings('font').size,0,'Parked owner retained its resource registration');
      resourceRevision=2;durableRoot.children.push(fontOwner);durable.invalidate(durableRoot);
      project(durableRoot);durable.commit([durableRoot]);
      assert.deepEqual([...durable.bindings('font').keys()],[2],'Remount reused a retired resource binding');
      resourceRevision=3;durable.invalidate(fontOwner);project(durableRoot);durable.abort();
      assert.deepEqual([...durable.bindings('font').keys()],[2],'Rejected capture replaced accepted registrations');
      project(durableRoot);durable.commit([durableRoot]);
      assert.deepEqual([...durable.bindings('font').keys()],[3]);
      durable.clear();assert.equal(durable.bindings('font').size,0);
      {
        const typed=new RenderSceneCapture(),target=render('typed-target'),index=render('index'),live=render('live-consumer');
        const root=render('typed-root',[target,index,live]),built=new Map();
        const project=(r,count={value:0},depth=0)=>typed.node(r,'',count,depth,()=>{
          built.set(r,(built.get(r)??0)+1);++count.value;
          if(r===index)typed.dependOn(target,['children','layout']);
          if(r===live)typed.dependOn(target);
          return new SceneNode(r.reference,'stack',r.children.map(child=>project(child,count,depth+1)));
        },(count,depth)=>project(r,count,depth));
        const commit=()=>{project(root);typed.commit([root]);};commit();
        typed.invalidate(target,'paint');commit();
        assert.equal(built.get(index),1,'Ancestor repaint rebuilt a collection index');
        assert.equal(built.get(live),2,'Unrestricted live dependency lost a paint change');
        typed.invalidate(target,'children');commit();
        assert.equal(built.get(index),2,'Collection topology failed to invalidate its index');
        root.children=[index,live];typed.invalidate(root,'children');commit();commit();
        assert.equal(built.get(index),3,'Target retirement bypassed the reference generation fence');
        typed.clear();
      }
      {
        const batched=new RenderSceneCapture(),target=render('batch-target'),consumer=render('batch-consumer'),indirect=render('batch-indirect');
        const root=render('batch-root',[target,consumer,indirect]);let value=0,setters=0;
        const project=(r,count={value:0},depth=0)=>batched.node(r,'',count,depth,()=>{
          ++count.value;if(r===consumer)batched.dependOn(target);if(r===indirect)batched.dependOn(consumer);
          return new SceneNode(r.reference,'stack',r.children.map(child=>project(child,count,depth+1)),{color:value});
        },(count,depth)=>project(r,count,depth));
        const commit=()=>{const scene=project(root);batched.commit([root]);return scene;};commit();
        batched.batchInvalidations(()=>{
          for(const next of [1,2]){value=next;++setters;batched.invalidate(target,'paint');batched.invalidate(target,'layout');}
          batched.batchInvalidations(()=>batched.invalidate(target,'paint'));
          assert.throws(()=>project(root),/cannot run inside a Source build batch/);
          assert.throws(()=>batched.commit([root]),/cannot commit inside a Source build batch/);
        });
        const scene=commit();assert.equal(setters,2,'Source setter/callback was skipped');
        assert(scene.children.every(child=>child.options.color===2),'Transitive consumers missed final batched values');
        assert(batched.counters.coalescedInvalidations>=3,'Repeated dependency work did not coalesce');
        assert.throws(()=>batched.batchInvalidations(()=>{value=3;batched.invalidate(target,'paint');throw Error('build failed');}),/build failed/);
        assert(commit().children.every(child=>child.options.color===3),'Throwing build retained its invalidation batch');
        value=4;batched.invalidate(target,'paint');assert(commit().children.every(child=>child.options.color===4),'Later capture lost an ordinary invalidation');
        batched.clear();
      }
      const builderCapture=new RenderSceneCapture(),builderRender:any=new LayoutBuilder(()=>null as any).createRenderObject({} as any),builderReference=new SceneReference();
      builderRender._updateCallback(()=>{});
      claimNativeRenderObject(builderRender,{},kind=>builderCapture.invalidate(builderRender,kind));
      const builderRead=()=>builderCapture.node(builderRender,'',{value:0},0,()=>new SceneNode(builderReference,'box',[],originalBoxConfiguration(builderRender,reason=>{throw Error(reason);})!.options),()=>builderRead());
      const builderBefore=builderRead(),builder=originalBoxConfiguration(builderRender,reason=>{throw Error(reason);})!.builder!;
      assert(builder.rebuild(builder.revision,BoxConstraints.tight({width:100,height:60})));
      const builderAfter=builderRead();
      assert.notEqual(builderAfter,builderBefore,'Completed unchanged-child builder did not invalidate native metadata');
      assert.equal(builderAfter.options.layoutBuilder?.built?.revision,builder.revision);
      builderRender.dispose();builderCapture.clear();
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
      const stable = (reference, children=[], color=0) => {
        const scene=new SceneNode(reference,'stack',children,{color});
        retainSceneConfiguration(scene);return scene;
      };
      const journalWork = [];
      for (const width of [8, 96]) {
        const commits = [], refs = Array.from({length:width},()=>new SceneReference());
        const leaves=refs.map(ref=>stable(ref)), branchRef=new SceneReference(), rootRef=new SceneReference();
        const branch=stable(branchRef,leaves), localRef=new SceneReference();
        const local=stable(localRef), first=stable(rootRef,[branch,local]);
        const writer:any=new SceneWriter({commit:async commands=>{commits.push(commands);}},
          {pollEvents:false,retainedScene:true});
        await writer.mount(first);
        const visits=writer.counters.recordVisits, allocations=writer.counters.allocatedVisits;
        await writer.update(stable(rootRef,[branch,stable(localRef,[],0xff123456)]));
        assert.equal(commits.at(-1).length,1,'Local paint must produce one command');
        journalWork.push([writer.counters.recordVisits-visits,writer.counters.allocatedVisits-allocations]);
        const unchanged=writer.root, builds=commits.length;
        await writer.update(unchanged);
        assert.equal(commits.length,builds,'Unchanged retained root submitted a transaction');
        const next=stable(rootRef,[stable(branchRef,[...leaves,stable(localRef,[],0xff123456)])]);
        await writer.update(next);
        assert(commits.at(-1).some(bytes=>new DataView(bytes.buffer).getUint16(0,true)===p.commands.move),
          'Cross-parent change lost its native move');
        await assert.rejects(writer.update(stable(rootRef,[next.children[0],stable(localRef)])),/Duplicate/);
        await writer.update(stable(rootRef,[branch]));
        assert.equal(localRef.currentNode,null,'Removed reference retained a mounted handle');
        await writer.update(stable(rootRef,[branch,stable(localRef)]));
        assert.equal(localRef.currentNode.generation,2,'Remount must allocate a new generation');
      }
      assert.deepEqual(journalWork[0],journalWork[1],
        'Unrelated subtree size changed the local journal work');
      const paddingWork=[];
      for(const width of [8,96]){
        const sourcePads=Array.from({length:width},()=>new RenderPadding(EdgeInsets.all(8)));
        const pads=sourcePads.map(render=>{const config=originalBoxConfiguration(render,reason=>{throw Error(reason);})!;
          return retain(new SceneNode(new SceneReference(),'box',[],config.options));});
        function retain(node){retainSceneConfiguration(node);return node;}
        const branch=retain(new SceneNode(new SceneReference(),'stack',pads)),rootKey=new SceneReference(),localKey=new SceneReference();
        const padded:any=new SceneWriter({commit:async()=>{}},{pollEvents:false,retainedScene:true});
        await padded.mount(retain(new SceneNode(rootKey,'stack',[branch,retain(new SceneNode(localKey,'box'))])));
        const records=padded.counters.recordVisits;
        await padded.update(retain(new SceneNode(rootKey,'stack',[branch,retain(new SceneNode(localKey,'box',[],{color:1}))])));
        paddingWork.push(padded.counters.recordVisits-records);
        for(const render of sourcePads)render.dispose();
      }
      assert.deepEqual(paddingWork,[2,2],'Canonical Source padding caused an unrelated full encoding walk');
      const creationWork=[];
      for(const unrelated of [64,2048]){
        const known=new Set<string>();
        const writer:any=new SceneWriter({commit:async commands=>{
          for(const command of commands){const v=new DataView(command.buffer,command.byteOffset,command.byteLength);
            if(v.getUint16(0,true)!==p.commands.create)continue;
            if(command.length===16+p.nodeAttachedCreationBytes){const offset=16+p.nodeCreationFields.parent;
              assert(known.has(v.getUint32(offset,true)+':'+v.getUint32(offset+4,true)),'Created child before its native parent');}
            known.add(v.getUint32(8,true)+':'+v.getUint32(12,true));}
        }},{pollEvents:false,retainedScene:true});
        const root=new SceneReference(),leaf=new SceneReference(),chain=Array.from({length:24},()=>new SceneReference());
        const retain=node=>{retainSceneConfiguration(node);return node;};
        const padding=retain(new SceneNode(new SceneReference(),'stack',Array.from({length:unrelated},()=>retain(new SceneNode(new SceneReference(),'box')))));
        const scene=children=>{let branch=retain(new SceneNode(leaf,'stack',children));
          for(const reference of [...chain].reverse())branch=retain(new SceneNode(reference,'stack',[branch]));
          return retain(new SceneNode(root,'stack',[branch,padding]));};
        await writer.mount(scene([]));const before=writer.counters.creationDepthVisits;
        await writer.update(scene(Array.from({length:24},()=>retain(new SceneNode(new SceneReference(),'box')))));
        const visits=writer.counters.creationDepthVisits-before;assert(visits<=50,'New siblings repeated retained ancestor walks');creationWork.push(visits);
      }
      assert.deepEqual(creationWork,[50,50],'Creation depth work scaled with unrelated native nodes');
      let releaseCommit, commitStarted;
      const started=new Promise(resolve=>{commitStarted=resolve;}), inflightCommands=[];
      const inFlight:any=new SceneWriter({commit:async commands=>{
        inflightCommands.push(commands);
        if(inflightCommands.length===2){commitStarted();await new Promise(resolve=>{releaseCommit=resolve;});}
      }},{pollEvents:false,retainedScene:true});
      const inflightRef=new SceneReference();
      await inFlight.mount(stable(inflightRef));
      const sending=inFlight.update(stable(inflightRef,[],1));
      await started;
      inFlight.update(stable(inflightRef,[],2));
      releaseCommit();await sending;
      assert.equal(inflightCommands.length,3,'ACK overwrote a modification made in flight');
      assert.equal([...inFlight.accepted.values()][0].node.options.color,2);
      const closedWriter:any=new SceneWriter({close:async()=>{}},{pollEvents:false});
      {
        const writer:any=new SceneWriter({}, {pollEvents:false,retainedScene:true});
        writer.nextSlot=37;
        const desired=writer.records(new SceneNode(new SceneReference(),'stack',[
          new SceneNode(new SceneReference(),'box',[],{layout:{childConstraints:'inherit'},pointerHitTest:'self'}),
          new SceneNode(new SceneReference(),'box',[],{properties:{width:42},color:0xff123456,layout:false}),
        ]));
        const names=['properties','paint','constraints','layout','eventPolicy'],saved=new Map();let encodes=0,commands;
        try {
          for(const name of names){const original=creationCommands[name];saved.set(name,original);creationCommands[name]=(...args)=>{++encodes;return original(...args);};}
          commands=writer.diff(desired);
        } finally {for(const [name,original] of saved)creationCommands[name]=original;}
        assert.equal(encodes,0,'Creation diff re-encoded defaults per node');
        assert.equal(commands.filter(bytes=>new DataView(bytes.buffer,bytes.byteOffset).getUint16(0,true)===p.commands.properties).length,1,'Default matching lost a non-default width or emitted default properties');
        assert.equal(commands.filter(bytes=>new DataView(bytes.buffer,bytes.byteOffset).getUint16(0,true)===p.commands.paint).length,1,'Default matching lost non-default paint');
      }
      {
        const writes=[[],[]],reject=[false,false];
        const writers=writes.map((output,i)=>new SceneWriter({commit:async commands=>{
          if(reject[i])throw Error('default NACK');output.push(commands.map(bytes=>Buffer.from(bytes).toString('hex')));
        }},{pollEvents:false,retainedScene:true}) as any);
        for(const writer of writers)writer.nextSlot=37;
        const roots=writers.map(()=>new SceneReference()),children=writers.map(()=>[new SceneReference(),new SceneReference()]);
        const scene=(i,mode,keep=true)=>{
          const node=(ref,kind,kids=[],options={})=>{const value=new SceneNode(ref,kind,kids,options);if(i)retainSceneConfiguration(value);return value;};
          const changed=mode===1?{properties:{width:42},color:0xff123456,layout:{gap:7},horizontal:{kind:'finite',min:2,max:50},pointerHitTest:'self'}:{};
          return node(roots[i],'stack',keep?[
            node(children[i][0],'box',[],changed),
            node(children[i][1],'box',[],{layout:mode===1?false:{childConstraints:'inherit'}}),
          ]:[]);
        };
        for(const [mode,keep,nack] of [[0,true,false],[1,true,false],[0,true,true],[0,true,false],[0,false,false],[1,true,false],[0,true,false]]){
          for(let i=0;i<2;++i){reject[i]=nack;if(nack)await assert.rejects(writers[i].update(scene(i,mode,keep)),/default NACK/);else await writers[i].update(scene(i,mode,keep));}
          assert.deepEqual(writes[1],writes[0],'Shared defaults changed wire bytes, destination generation, reset or NACK retry');
        }
        assert(writers[1].counters.sharedDefaultConfigs>0,'Source never shared a default command');
        assert.equal(writers[0].counters.sharedDefaultConfigs,0,'Public producers entered the Source default path');
        assert.equal(children[1][0].currentNode.generation,2,'Default reset did not exercise slot generation reuse');
        const counts=new Map(),originals=new Map();
        try {
          for(const name of ['properties','paint','constraints','layout','eventPolicy']){const original=creationCommands[name];originals.set(name,original);creationCommands[name]=(...args)=>{counts.set(name,(counts.get(name)??0)+1);return original(...args);};}
          const writer:any=new SceneWriter({}, {pollEvents:false,retainedScene:true});writer.nextSlot=81;
          const leaf=new SceneNode(new SceneReference(),'box');retainSceneConfiguration(leaf);
          writer.records(leaf);assert.equal([...counts.values()].reduce((a,b)=>a+b,0),0,'Source defaults encoded per-node packets');
        } finally {for(const [name,original] of originals)creationCommands[name]=original;}
      }
      closedWriter.adopt(closedWriter.records(new SceneNode(new SceneReference(),'box',[],{onLayout:()=>{}})),[]);
      assert.equal(closedWriter.layoutObservers.size,1);
      await closedWriter.close();
      assert.equal(closedWriter.layoutObservers.size,0,'Closed host retained layout callbacks');
      assert.equal(closedWriter.accepted.size,0);
      console.log('Incremental capture: dynamic effects, local dirty path, reparent, edge/context, failure and budgets PASS.',capture.counters);
      console.log('Retained journal: size-independent paint work, moves, duplicate rejection, parking generations and in-flight updates PASS.',journalWork);
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
