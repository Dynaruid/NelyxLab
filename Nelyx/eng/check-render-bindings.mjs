// SPDX-License-Identifier: BSD-3-Clause
import path from 'node:path';
import { build } from 'esbuild';

const watchdog = setTimeout(() => {
  throw Error('Render binding checks exceeded 20 minutes');
}, 1_200_000);
try {
  const result = await build({
    stdin: {
      resolveDir: path.resolve(import.meta.dirname, '../..'),
      loader: 'ts',
      contents: `
        import assert from 'node:assert/strict';
        import {SceneNode,SceneReference,SceneWriter,RenderBinding,renderBindingConfiguration,retainSceneConfiguration} from './Nelyx/runtime/engine-client/scene.ts';
        import {protocol as p} from './Nelyx/runtime/engine-client/schema.ts';
        import {RenderSceneCapture} from './Nelyx/runtime/app/capture.ts';
        const writes=[[],[]],refs=[0,1].map(()=>Array.from({length:5},()=>new SceneReference()));
        let reject=false,revision=0;const actions=[];
        const writers:any[]=writes.map(output=>new SceneWriter({
          subscribeRaw:async()=>{},commit:async commands=>{if(reject)throw Error('binding NACK');output.push(commands.map(b=>Buffer.from(b).toString('hex')))},
        } as any,{pollEvents:false,retainedScene:true}));
        for(const writer of writers)writer.nextSlot=37;
        function make(i,mode,keep=true){
          const node=(at,kind,kids=[],options={},text?)=>{
            const binding=i?renderBindingConfiguration(refs[i][at],kind,kids,options,text):undefined;
            const result=binding??new SceneNode(refs[i][at],kind,kids,options,text);
            if(i&&!binding)retainSceneConfiguration(result);return result;
          };
          const capturedRevision=revision;
          const options:any={layout:{padding:{left:mode?9:4}},pointerHitTest:'self',onAction:()=>actions.push(capturedRevision)};
          if(mode===1){options.semantics={role:'button',label:'selected',actions:p.semanticsActions.activate};options.onRawInput=()=>{};options.gestures=p.gestures.tap;}
          if(mode===2)options.layerLink=()=>({kind:'leader',offset:{x:1,y:2}});
          const leaf=node(1,'box',[],options),text=node(2,'paragraph',[],{layout:{paragraphSizing:true},paragraph:{wrap:true}}, {value:mode?'next':'first',size:14,color:0xff112233,direction:'ltr'});
          return node(0,'stack',keep?[node(3,'box',mode===3?[text]:[leaf,text],{layout:{childConstraints:'inherit'}}),...(mode===3?[leaf]:[])]:[],{});
        }
        for(const [mode,keep,nack] of [[0,true,false],[1,true,false],[0,true,true],[0,true,false],[2,true,false],[0,true,false],[3,true,false],[0,false,false],[1,true,false],[0,true,false]]){
          reject=nack;revision++;
          const previous=writers[1].accepted;
          for(let i=0;i<2;i++)if(nack)await assert.rejects(writers[i].update(make(i,mode,keep)),/binding NACK/);else await writers[i].update(make(i,mode,keep));
          if(nack)assert.equal(writers[1].accepted,previous);
          assert.deepEqual(writes[1],writes[0],'Direct/reference bytes differed at '+mode+'/'+keep+'/'+nack);
        }
        assert(writers[1].counters.bindingRecords>0);assert.equal(writers[0].counters.bindingRecords,0);
        const bindingRecord=writers[1].accepted.get(refs[1][1].currentNode.slot+':'+refs[1][1].currentNode.generation);
        bindingRecord.node.options.onAction();assert.equal(actions.at(-1),revision);
        assert.equal(bindingRecord.configInputs.size,0,'Direct binding rebuilt generic input snapshots');
        assert.equal(bindingRecord.node.children.length,0,'Accepted binding retained a projection subtree');
        // Mutable producer values are sealed to command bytes at Source completion.
        const mutable={left:5},ref=new SceneReference(),writer:any=new SceneWriter({}, {pollEvents:false,retainedScene:true});
        const frozen=renderBindingConfiguration(ref,'box',[],{layout:{padding:mutable}})!;
        assert(frozen instanceof RenderBinding);assert(!(frozen instanceof SceneNode));
        mutable.left=99;const desired=writer.records(frozen),record=[...desired.values()][0];
        const oracle:any=new SceneWriter({}, {pollEvents:false,retainedScene:true});
        const original=oracle.records(new SceneNode(new SceneReference(),'box',[],{layout:{padding:{left:5}}}));
        assert.deepEqual(writer.diff(desired),oracle.diff(original));
        const acceptedBytes=record.config.map(b=>b.slice());writer.accepted=new Map(desired);
        // Rebinding a sealed input after parking/generation change cannot mutate old bytes.
        writer.handles.clear();writer.nextSlot=100;writer.records(frozen);
        record.config.forEach((bytes,index)=>assert.deepEqual(bytes,acceptedBytes[index]));
        let getters=0;
        assert.equal(renderBindingConfiguration(new SceneReference(),'box',[],{get color(){getters++;return 1}}),undefined);
        assert.equal(getters,0,'Capability check executed a getter');
        assert.equal(renderBindingConfiguration(new SceneReference(),'box',[],{nativePaint:[{kind:'paragraph',reference:{slot:1,generation:1}}]} as any),undefined);
        assert.equal(renderBindingConfiguration(new SceneReference(),'box',[],{control:{kind:'button'}} as any),undefined);
        assert.equal(renderBindingConfiguration(new SceneReference(),'box',[],{nativePaint:[{kind:'paragraph',reference:()=>null}]} as any),undefined);
        assert.throws(()=>renderBindingConfiguration(new SceneReference(),'box',[],{radius:NaN}),RangeError);
        {
          const negative:any=new SceneWriter({}, {pollEvents:false,retainedScene:true}),baseline:any=new SceneWriter({}, {pollEvents:false,retainedScene:true});
          const direct=negative.records(renderBindingConfiguration(new SceneReference(),'box',[],{radius:-0})!);
          const reference=baseline.records(new SceneNode(new SceneReference(),'box',[],{radius:-0}));
          assert.deepEqual(negative.diff(direct),baseline.diff(reference),'Shared defaults erased signed zero');
        }
        // Input changes during an ACK stay in the following existing writer batch.
        const commits=[],callbacks=[];let release:any;
        const delayed:any=new SceneWriter({commit:async commands=>{commits.push(commands);if(commits.length===1)await new Promise(resolve=>release=resolve)}} as any,{pollEvents:false,retainedScene:true});
        const pendingRef=new SceneReference();
        const first=renderBindingConfiguration(pendingRef,'box',[],{color:1,onAction:()=>callbacks.push(1)})!;
        const mounted=delayed.update(first);await Promise.resolve();await Promise.resolve();
        const latest=delayed.update(renderBindingConfiguration(pendingRef,'box',[],{color:2,onAction:()=>callbacks.push(2)})!);
        release();await Promise.all([mounted,latest]);
        assert.equal(commits.length,2);[...delayed.accepted.values()][0].node.options.onAction();assert.deepEqual(callbacks,[2]);
        assert.throws(()=>writer.records(renderBindingConfiguration(new SceneReference(),'stack',[frozen,frozen],{})!),/Duplicate/);
        {
          const capture=new RenderSceneCapture(),changes=[];
          const parent:any={reference:new SceneReference(),debugDisposed:false},child:any={reference:new SceneReference(),parent,debugDisposed:false};
          let color=1;
          const project=(render,count={value:0},depth=0)=>capture.node(render,'',count,depth,()=>{
            count.value++;
            return renderBindingConfiguration(render.reference,render===parent?'stack':'box',render===parent?[project(child,count,depth+1)]:[],render===parent?{color:0xff123456,layout:{gap:3}}:{color})!;
          },(count,depth)=>project(render,count,depth));
          const target:any=new SceneWriter({commit:async bytes=>changes.push(bytes)} as any,{pollEvents:false,retainedScene:true});
          await target.mount(project(parent));color=2;capture.invalidate(child,'paint');
          await target.update(project(parent));
          assert.equal(changes.at(-1).length,1,'Child-only reconnect lost retained parent configuration');
          assert.equal(new DataView(changes.at(-1)[0].buffer).getUint16(0,true),p.commands.paint);
        }
        console.log('Render bindings: reference wire bytes, resets, adapter transitions, callbacks, reparent, generation, NACK, sealed input and in-flight ACK PASS');
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
