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
        import {SceneNode,SceneReference,SceneWriter,RenderBinding,renderBindingConfiguration,retainSceneConfiguration,sceneReferenceHandle,sceneReferenceConfiguration,immutableSceneData} from './Nelyx/runtime/engine-client/scene.ts';
        import {protocol as p} from './Nelyx/runtime/engine-client/schema.ts';
        import {commands as codecs} from './Nelyx/runtime/engine-client/codec.ts';
        import {RenderSceneCapture} from './Nelyx/runtime/app/capture.ts';
        import {RenderSemanticsAnnotations} from '@nelyx/core/framework/rendering/semantics-annotations';
        import {SemanticsProperties} from '@nelyx/core/framework/semantics/semantics';
        import {originalControlConfiguration} from './Nelyx/runtime/app/controls.ts';
        import {OriginalNativeNode,sourceNativeNode,sourceNativeBindingOptions} from './Nelyx/runtime/app/native-node.ts';
        import {ObjectKey} from '@nelyx/core/foundation/key';
        import {captureParagraphOptions,prepareParagraphOptions,paragraphSceneOptions,isPreparedParagraphOptions,paragraphOptionsBytes,readParagraphOptions} from './Nelyx/runtime/engine-client/paragraph.ts';
        {
          const cases=[{}, {fontFamily:'NelyxDefault',fontWeight:500,locale:'ko',ellipsis:'…',maxLines:2},
            {height:1.4,letterSpacing:-.25,wordSpacing:2,halfLeading:true,applyHeightToFirstAscent:false},
            {strut:{fontFamilies:['NelyxDefault'],fontSize:18,fontWeight:400,fontStyle:'normal',height:1.2,leading:0,halfLeading:false,forceStrutHeight:true}},
            {runs:[{start:0,end:2,color:0xff123456,fontFamilies:['NelyxDefault'],fontSize:16,fontWeight:500,fontStyle:'italic',locale:'en',height:null,letterSpacing:0,wordSpacing:0,halfLeading:false,decoration:0,decorationStyle:'solid',decorationThickness:1}]},
            {overflowProbe:{text:'…',fontSize:16,color:0xff123456,paragraph:{locale:'en'}}}];
          for(const options of cases)assert.deepEqual(captureParagraphOptions(options),readParagraphOptions(paragraphOptionsBytes(options)),'Paragraph capture changed codec normalization');
          for(const options of cases)for(const wrap of [true,false]){
            const prepared=prepareParagraphOptions(options),ordinary=captureParagraphOptions(options);
            assert.deepEqual(prepared,ordinary,'Prepared capture changed Source normalization');
            assert(isPreparedParagraphOptions(prepared));
            const projected=paragraphSceneOptions(prepared,wrap),{height,...values}=ordinary;
            const expected={...values,...(height===null?{}:{height}),wrap};
            assert(!isPreparedParagraphOptions(prepared),'Projection kept two payload owners');
            assert(isPreparedParagraphOptions(projected));assert(Object.isFrozen(projected));
            assert.deepEqual(projected,expected,'Paragraph projection changed Source fields');
            const payload=paragraphOptionsBytes(projected),reference=paragraphOptionsBytes(expected);
            assert.deepEqual(payload,reference,'Prepared paragraph wire changed');
            assert(!isPreparedParagraphOptions(projected),'Payload was retained after consumption');
            payload.fill(0);
            assert.deepEqual(paragraphOptionsBytes(projected),reference,'Caller bytes poisoned a later encode');
          }
          const preparedProbe=prepareParagraphOptions(cases[5]),projectedProbe=paragraphSceneOptions(preparedProbe,false);
          assert.throws(()=>paragraphOptionsBytes(projectedProbe,false),/Nested paragraph probe/);
          assert(isPreparedParagraphOptions(projectedProbe),'Rejected nesting consumed another valid operation');
          assert.deepEqual(readParagraphOptions(paragraphOptionsBytes(projectedProbe)).overflowProbe.text,'…');
          const fake={...captureParagraphOptions({locale:'en'})};let probeReads=0;
          Object.defineProperty(fake,'locale',{enumerable:true,get(){++probeReads;return 'ko';}});
          assert(!isPreparedParagraphOptions(fake));assert.equal(probeReads,0,'Ownership probe read a producer getter');
          assert.equal(readParagraphOptions(paragraphOptionsBytes(fake)).locale,'ko');assert(probeReads>0);
          for(const options of [{locale:''},{maxLines:-1},{fontWeight:901},{height:NaN},{wrap:1},{unknown:1},
            {overflowProbe:{text:'…',fontSize:16,color:0,paragraph:{overflowProbe:{text:'x',fontSize:16,color:0,paragraph:{}}}}}]){
            const failure=operation=>{try{operation();return null;}catch(error){return [error.constructor,error.message];}};
            const expected=failure(()=>readParagraphOptions(paragraphOptionsBytes(options)));assert(expected,'Invalid paragraph fixture was accepted');
            assert.deepEqual(failure(()=>captureParagraphOptions(options)),expected);
            assert.deepEqual(failure(()=>prepareParagraphOptions(options)),expected);
          }
          const original=cases[4],captured=captureParagraphOptions(original);original.runs[0].color=0xffabcdef;
          assert.equal(captured.runs[0].color,0xff123456,'Captured paragraph retained mutable producer runs');
          assert(Object.isFrozen(captured));assert(Object.isFrozen(captured.runs));assert(Object.isFrozen(captured.runs[0]));
          const mutable={runs:[{...original.runs[0]}]},prepared=prepareParagraphOptions(mutable),before=prepared.runs[0].color;
          mutable.runs[0].color=0xff987654;
          assert.equal(readParagraphOptions(paragraphOptionsBytes(paragraphSceneOptions(prepared,true))).runs[0].color,before,'Prepared bytes retained producer aliases');
          const reads=[],observe=()=>new Proxy({locale:'ko',fontWeight:500},{get(target,key,receiver){reads.push(String(key));return Reflect.get(target,key,receiver);}});
          captureParagraphOptions(observe());const ordinaryReads=reads.splice(0);prepareParagraphOptions(observe());
          assert.deepEqual(reads,ordinaryReads,'Preparing a payload changed Source getter order');
        }
        {
          const identity=handle=>handle.slot+':'+handle.generation;
          const recordFor=(records,handle)=>[...records.values()].find(record=>record.handle.slot===handle.slot&&record.handle.generation===handle.generation);
          for(const direct of [false,true])for(const size of [13,27,41]){
            const writer:any=new SceneWriter({commit:async()=>{}} as any,{pollEvents:false,retainedScene:true});
            const refs=Array.from({length:size},()=>new SceneReference());
            const project=count=>{
              const nodes=[],children=Array.from({length:count},()=>[]);
              for(let index=1;index<count;index++)children[Math.floor((index-1)/(index%3===0?3:2))].push(index);
              for(let index=count-1;index>=0;index--){
                const kids=children[index].map(child=>nodes[child]),options={color:index+1};
                nodes[index]=direct?renderBindingConfiguration(refs[index],'box',kids,options,undefined,true):new SceneNode(refs[index],'box',kids,options);
              }
              return nodes[0];
            };
            await writer.mount(project(5));
            const desired=writer.records(project(size));
            const depth=record=>{let result=0;while(record.parent){record=recordFor(desired,record.parent);assert(record);result++;}return result;};
            const expected=[...desired.changed.values()].filter(record=>!recordFor(writer.accepted,record.handle)).sort((a,b)=>depth(a)-depth(b)).map(record=>identity(record.handle));
            const actual=writer.diff(desired).filter(bytes=>new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint16(0,true)===p.commands.create).map(bytes=>{const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);return view.getUint32(8,true)+':'+view.getUint32(12,true);});
            assert.deepEqual(actual,expected,'Creation order changed the stable depth-sort oracle for '+size+'/'+direct);
          }
        }
        const writes=[[],[]],refs=[0,1].map(()=>Array.from({length:5},()=>new SceneReference()));
        let reject=false,revision=0;const actions=[];
        const writers:any[]=writes.map(output=>new SceneWriter({
          subscribeRaw:async()=>{},commit:async commands=>{if(reject)throw Error('binding NACK');output.push(commands.map(b=>Buffer.from(b).toString('hex')))},
        } as any,{pollEvents:false,retainedScene:true}));
        for(const writer of writers)writer.nextSlot=37;
        function make(i,mode,keep=true){
          const node=(at,kind,kids=[],options={},text?)=>{
            const binding=i?renderBindingConfiguration(refs[i][at],kind,kids,options,text,true):undefined;
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
        const bindingRecord=[...writers[1].accepted.values()].find(record=>record.handle.slot===refs[1][1].currentNode.slot&&record.handle.generation===refs[1][1].currentNode.generation);
        bindingRecord.node.options.onAction();assert.equal(actions.at(-1),revision);
        assert.equal(bindingRecord.configInputs.size,0,'Direct binding rebuilt generic input snapshots');
        assert.equal(bindingRecord.node.children.length,0,'Accepted binding retained a projection subtree');
        {
          const reference=new SceneReference(),counts={partEncodes:0,partReuses:0,commandReuses:0},actions=[];
          let reject=false;const writer:any=new SceneWriter({commit:async()=>{if(reject)throw Error('semantic NACK');}} as any,{pollEvents:false,retainedScene:true});
          const first=renderBindingConfiguration(reference,'box',[],{semantics:{role:'button',label:'day'},onAction:()=>actions.push(1)},undefined,true,counts)!;
          await writer.mount(first);
          const codec=codecs.semantics;let encodes=0;codecs.semantics=function(...args){++encodes;return Reflect.apply(codec,this,args);};
          try {
            const next=renderBindingConfiguration(reference,'box',[],{semantics:{role:'button',label:'day'},onAction:()=>actions.push(2)},undefined,true,counts,first)!;
            assert.equal(encodes,0,'Static semantic geometry update encoded unchanged metadata');
            await writer.update(next);[...writer.accepted.values()][0].node.options.onAction();assert.deepEqual(actions,[2]);
            assert.equal(counts.commandReuses,1);
            const accepted=writer.accepted;
            const changed=renderBindingConfiguration(reference,'box',[],{semantics:{role:'button',label:'next'}},undefined,true,counts)!;
            assert.equal(encodes,1,'Semantic setter change did not encode metadata');
            reject=true;await assert.rejects(writer.update(changed),/semantic NACK/);assert.equal(writer.accepted,accepted);
            reject=false;await writer.update(changed);
          } finally {codecs.semantics=codec;}
        }
        {
          const original={...codecs},encoded=[];
          for(const name of ['paint','layout','semantics','graphics','text','eventPolicy'])
            codecs[name]=function(...args){encoded.push(name);return Reflect.apply(original[name],this,args);};
          try {
            const reference=new SceneReference(),counts={partEncodes:0,partReuses:0},actions=[];
            const writer:any=new SceneWriter({commit:async()=>{}} as any,{pollEvents:false,retainedScene:true});
            const padding={left:4},matrix=[1,0,0,1,0,0];
            const project=(color,label,callback)=>renderBindingConfiguration(reference,'box',[],{
              color,layout:{padding},graphics:{transform:matrix},semantics:{role:'button',label},onAction:()=>actions.push(callback)
            },undefined,true,counts)!;
            await writer.mount(project(7,'day',1));encoded.length=0;
            await writer.update(project(7,'day',2));
            assert.deepEqual(encoded,['layout','semantics','graphics'],'Scalar journal probed or cached structured input');
            [...writer.accepted.values()][0].node.options.onAction();assert.deepEqual(actions,[2]);
            assert(counts.partReuses>=1,'Scalar journal did not reuse its paint part');
            encoded.length=0;const paint=project(9,'day',3);assert.deepEqual(encoded,['paint','layout','semantics','graphics']);await writer.update(paint);
            encoded.length=0;const semantic=project(9,'next',4);assert(!encoded.includes('paint'));assert(encoded.includes('semantics'));await writer.update(semantic);
            padding.left=8;encoded.length=0;const layout=project(9,'next',5);assert(encoded.includes('layout'),'Mutable input alias hid a layout edit');await writer.update(layout);
            matrix[4]=12;encoded.length=0;const graphics=project(9,'next',6);assert(encoded.includes('graphics'),'Nested array alias hid a graphics edit');await writer.update(graphics);
            encoded.length=0;
            assert.throws(()=>renderBindingConfiguration(reference,'box',[],{layout:{gap:NaN},semantics:{role:'button',label:'bad'}},undefined,true,counts));
            encoded.length=0;project(9,'next',7);assert(!encoded.includes('paint'),'Failed Source encoding installed its partial journal');
            const textRef=new SceneReference(),textCounts={partEncodes:0,partReuses:0};
            const text=(value)=>renderBindingConfiguration(textRef,'paragraph',[],{}, {value,size:14,color:0xff123456,direction:'ltr'},false,textCounts)!;
            text('15');encoded.length=0;text('15');assert(!encoded.includes('text'),'Same paragraph text repeated UTF-8 encoding');
            encoded.length=0;text('16');assert(encoded.includes('text'),'Text change was lost by the scalar part journal');
            const hidden={};Object.defineProperty(hidden,'gap',{value:3,enumerable:false,writable:true});
            renderBindingConfiguration(reference,'box',[],{layout:hidden},undefined,true,counts);
            encoded.length=0;renderBindingConfiguration(reference,'box',[],{layout:hidden},undefined,true,counts);
            assert(encoded.includes('layout'),'Structured input was cached by the scalar journal');
            hidden.gap=4;encoded.length=0;renderBindingConfiguration(reference,'box',[],{layout:hidden},undefined,true,counts);
            assert(encoded.includes('layout'),'Non-enumerable field alias hid a layout edit');
            let visits=0;class ForeignArray extends Array {forEach(callback){++visits;return super.forEach(callback);}}
            const foreign=new ForeignArray(1,0,0,1,0,0);
            renderBindingConfiguration(reference,'box',[],{graphics:{transform:foreign}},undefined,true,counts);
            const beforeVisits=visits;renderBindingConfiguration(reference,'box',[],{graphics:{transform:foreign}},undefined,true,counts);
            assert.equal(visits,beforeVisits+1,'Array subclass encoder protocol was cached');
            let reads=0;const input={get gap(){++reads;return 5;}};
            original.layout({slot:0,generation:0},input);const expectedReads=reads;reads=0;
            renderBindingConfiguration(reference,'box',[],{layout:input},undefined,true,counts);
            assert.equal(reads,expectedReads,'Opaque/accessor input was read by a journal probe');
            reads=0;renderBindingConfiguration(reference,'box',[],{layout:input},undefined,true,counts);
            assert.equal(reads,expectedReads,'Opaque/accessor input was cached');
          } finally {for(const name of Object.keys(original))codecs[name]=original[name];}
        }
        {
          const reference=new SceneReference(),events=[];
          const writer:any=new SceneWriter({commit:async()=>{}} as any,{pollEvents:false,retainedScene:true});
          const project=(value,callback)=>renderBindingConfiguration(reference,'box',[],{color:value,semantics:{role:'button',label:'day'},onAction:()=>events.push(callback)})!;
          await writer.mount(project(7,1));
          const before=[...writer.accepted.values()][0],reuses=writer.counters.bindingProgramReuses;
          await writer.update(project(7,2));
          const next=[...writer.accepted.values()][0];
          assert.equal(next.config,before.config,'Equal sealed command bodies rebuilt the accepted program');
          assert(writer.counters.bindingProgramReuses>reuses,'Callback-only binding did not reuse its program');
          assert.notEqual(next.node.options,before.node.options,'New callback record was discarded');
          next.node.options.onAction();assert.deepEqual(events,[2]);
          await writer.update(project(9,3));await writer.update(project(7,4));
          [...writer.accepted.values()][0].node.options.onAction();assert.deepEqual(events,[2,4]);
        }
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
        {
          const output=[[],[]],refs=[0,1].map(()=>Array.from({length:4},()=>new SceneReference()));
          const writers:any[]=output.map(writes=>new SceneWriter({commit:async commands=>writes.push(commands.map(bytes=>Buffer.from(bytes).toString('hex')))} as any,{pollEvents:false,retainedScene:true}));
          const shape={kind:'rrect',radii:[0,0,0,0,0,0,0,0],strokeWidth:0,strokeColor:0,strokeAlign:0};
          const project=(index,target)=>{
            const node=(at,kind,children,options)=>index?renderBindingConfiguration(refs[index][at],kind,children,options)!:new SceneNode(refs[index][at],kind,children,options);
            return node(0,'stack',[
              node(1,'box',[],{nativePaint:[{kind:'highlight',reference:index?sceneReferenceHandle(refs[index][target]):()=>refs[index][target].currentNode,color:0xff123456,shape}]}),
              node(2,'box',[],{}),node(3,'box',[],{})
            ],{});
          };
          for(const target of [2,2,3,3,2]){
            for(let index=0;index<2;index++)await writers[index].update(project(index,target));
            assert.deepEqual(output[1],output[0],'Equal placeholder bytes merged distinct reference targets');
          }
        }
        {
          const output=[[],[]],references=[0,1].map(()=>Array.from({length:4},()=>new SceneReference()));
          const shape={kind:'rrect',radii:[0,0,0,0,0,0,0,0],strokeWidth:0,strokeColor:0,strokeAlign:0};
          let nack=false;
          const targets:any[]=output.map(bytes=>new SceneWriter({commit:async next=>{if(nack)throw Error('reference NACK');bytes.push(next.map(b=>Buffer.from(b).toString('hex')))}} as any,{pollEvents:false,retainedScene:true}));
          targets.forEach(writer=>writer.nextSlot=97);
          const project=(index,mode)=>{
            const node=(at,kind,children,options)=>{
              const binding=index?renderBindingConfiguration(references[index][at],kind,children,options):undefined;
              if(binding)return binding;
              if(index)sceneReferenceConfiguration(options);
              return new SceneNode(references[index][at],kind,children,options);
            };
            const ref=index?sceneReferenceHandle(references[index][2]):()=>references[index][2].currentNode;
            const options:any=mode===1?{}:mode===4?{paintPlacement:{fontRevision:1n,width:10,height:12,baseline:8,rect:[0,0,10,12],reference:ref}}:{nativePaint:[{kind:'highlight',reference:ref,color:0xff123456,shape}]};
            if(mode===5)options.control={kind:'button'};
            const painter=node(1,mode===4?'paragraph':'box',[],options);
            const target=mode===1?[]:[node(2,mode===3?'stack':'box',[],{color:mode})];
            // The painted target appears after its consumer: allocation must precede resolution.
            return node(0,'stack',[painter,...target],{});
          };
          for(const mode of [0,0,1,0,3,0,4,5,0]){
            for(let index=0;index<2;index++)await targets[index].update(project(index,mode));
            assert.deepEqual(output[1],output[0],'Cross-binding reference bytes or recycled generation differed');
          }
          nack=true;
          for(let index=0;index<2;index++)await assert.rejects(targets[index].update(project(index,3)),/reference NACK/);
          nack=false;
          for(let index=0;index<2;index++)await targets[index].update(project(index,3));
          assert.deepEqual(output[1],output[0],'NACK changed reference binding replay');
          const previous=output[1].length;
          await targets[1].update(project(1,3));assert.equal(output[1].length,previous,'Unchanged reference emitted commands');
        }
        {
          let invoked=0;
          const render=new RenderSemanticsAnnotations({properties:new SemanticsProperties({label:'day',button:true,selected:true,onTap:()=>invoked++})});
          const metadata=originalControlConfiguration(render,reason=>{throw Error(reason)})!;
          assert.equal(metadata.directData,true);
          const options={layout:{childConstraints:'inherit'},...metadata.options,pointerHitTest:'proxy'};
          const oracle:any=new SceneWriter({}, {pollEvents:false,retainedScene:true}),direct:any=new SceneWriter({}, {pollEvents:false,retainedScene:true});
          oracle.nextSlot=direct.nextSlot=71;
          const expected=oracle.records(new SceneNode(new SceneReference(),'box',[],options as any));
          const binding=renderBindingConfiguration(new SceneReference(),'box',[],options as any,undefined,true)!;
          assert(binding);const actual=direct.records(binding);
          assert.deepEqual(direct.diff(actual),oracle.diff(expected),'Closed module semantics data changed wire fields');
          [...actual.values()][0].node.options.onAction('activate');assert.equal(invoked,1);
        }
        {
          const actions=[],focus=[],key=new ObjectKey({});
          const retired=[],options={key,keepAliveChildren:true,sourceCollectionIndex:3,parkedChildren:false,onChildrenInvalidated:()=>retired.push(1),layout:{childConstraints:'inherit' as const},nativeFocus:{enabled:true,skipTraversal:false},onFocusChanged:(value)=>focus.push(value),canonicalGestures:true,gestures:p.gestures.tap,onGesture:()=>actions.push(1)};
          const source=sourceNativeNode('box',[],options),render=source.createRenderObject();
          assert.equal(source.key,key,'Projection changed the original Widget key');
          const wire=sourceNativeBindingOptions(render)!;
          assert(wire);assert(!Object.hasOwn(wire,'key'));
          for(const name of ['keepAliveChildren','sourceCollectionIndex','parkedChildren','onChildrenInvalidated'])assert(!Object.hasOwn(wire,name),'Source container metadata entered the wire options');
          assert.equal(render.options,options);assert.equal(render.options.sourceCollectionIndex,3);
          render.options.onChildrenInvalidated!();assert.deepEqual(retired,[1],'Projection removed the live Source retirement callback');
          const targets:any[]=[0,1].map(()=>new SceneWriter({}, {pollEvents:false,retainedScene:true}));
          targets.forEach(writer=>writer.nextSlot=113);
          const expected=targets[0].records(new SceneNode(new SceneReference(),'box',[],options));
          const actual=targets[1].records(renderBindingConfiguration(new SceneReference(),'box',[],wire)!);
          assert.deepEqual(targets[1].diff(actual),targets[0].diff(expected),'Focus/Gesture Source projection changed wire fields');
          const record=[...actual.values()][0];record.node.options.onGesture({});record.node.options.onFocusChanged(true);
          assert.deepEqual(actions,[1]);assert.deepEqual(focus,[true]);
          const next=sourceNativeNode('box',[],{...options,gestures:0,onGesture:()=>actions.push(2)});
          next.updateRenderObject(null as any,render);
          const nextWire=sourceNativeBindingOptions(render)!;nextWire.onGesture!({} as any);
          assert.equal(nextWire.gestures,0);assert.deepEqual(actions,[1,2]);
          // Updating the same render from an ordinary producer revokes the capability.
          let reads=0;
          const ordinary=new OriginalNativeNode('box',[],{get color(){reads++;return 7}});
          ordinary.updateRenderObject(null as any,render);
          assert.equal(sourceNativeBindingOptions(render),undefined);assert.equal(reads,0,'Ordinary producer was probed');
          const ordinaryRender=ordinary.createRenderObject();
          assert.equal(sourceNativeBindingOptions(ordinaryRender),undefined);ordinaryRender.dispose();
          render.dispose();
        }
        {
          const reads=[],options={get key(){reads.push('key');return undefined;},get sourceCollectionIndex(){reads.push('index');return 2;},get color(){reads.push('color');return 7;},get keepAliveChildren(){reads.push('keepAlive');return true;}};
          const render=sourceNativeNode('box',[],options).createRenderObject();reads.length=0;
          const wire=sourceNativeBindingOptions(render)!;
          assert.deepEqual(reads,['key','index','color','keepAlive'],'Source options changed their key/rest evaluation order');
          assert.deepEqual(wire,{color:7});render.dispose();
        }
        {
          const raw={children:0,layout:[{kind:'size',values:[20,30]}],minWidth:[{kind:'result',values:[20]}],maxWidth:[{kind:'result',values:[20]}],minHeight:[{kind:'result',values:[30]}],maxHeight:[{kind:'result',values:[30]}]},owned=immutableSceneData(raw),reference=new SceneReference();
          const counters={partEncodes:0,partReuses:0},project=program=>renderBindingConfiguration(reference,'box',[],{layout:{childConstraints:'inherit'},layoutProgram:program},undefined,true,counters)!;
          const first=project(owned);assert.equal(counters.partEncodes,1,'Layout program was not included in its part journal');
          project(owned);assert.equal(counters.partEncodes,1);assert.equal(counters.partReuses,1,'Owned immutable layout program was encoded again');
          const oracle:any=new SceneWriter({}, {pollEvents:false,retainedScene:true}),direct:any=new SceneWriter({}, {pollEvents:false,retainedScene:true});
          oracle.nextSlot=direct.nextSlot=127;
          const expected=oracle.records(new SceneNode(new SceneReference(),'box',[],{layout:{childConstraints:'inherit'},layoutProgram:raw}));
          const actual=direct.records(first);assert.deepEqual(direct.diff(actual),oracle.diff(expected),'Owned layout program changed native command bytes');
          project(raw);raw.layout[0].values[0]=25;const changed=project(raw);
          assert.equal(counters.partEncodes,3,'A mutable layout program was cached by identity');
          const next=direct.records(changed),program=[...next.values()][0].config.find(bytes=>new DataView(bytes.buffer,bytes.byteOffset).getUint16(0,true)===p.commands.layoutProgram);
          assert.deepEqual(program.subarray(16),codecs.layoutProgram({slot:0,generation:0},raw).subarray(16));
          assert.equal(owned.layout[0].values[0],20,'Producer mutation changed the owned policy');
        }
        {
          const output=[[],[]],refs=[0,1].map(()=>Array.from({length:5},()=>new SceneReference()));
          let nack=false,sequence=0;
          const targets:any[]=output.map(writes=>new SceneWriter({commit:async commands=>{if(nack)throw Error('dependency NACK');writes.push(commands.map(bytes=>Buffer.from(bytes).toString('hex')))}} as any,{pollEvents:false,retainedScene:true}));
          targets.forEach(writer=>writer.nextSlot=149);
          const shape={kind:'rrect',radii:[0,0,0,0,0,0,0,0],strokeWidth:0,strokeColor:0,strokeAlign:0};
          const makeNode=(index,at,kind,children,options)=>{
            const binding=index?renderBindingConfiguration(refs[index][at],kind,children,options):undefined;
            if(binding)return binding;
            const node=new SceneNode(refs[index][at],kind,children,options);retainSceneConfiguration(node);return node;
          };
          const consumers=[0,1].map(index=>makeNode(index,1,'box',[
            makeNode(index,2,'box',[],{nativePaint:[{kind:'highlight',reference:index?sceneReferenceHandle(refs[index][3]):()=>refs[index][3].currentNode,color:0xff112233,shape}]})
          ],{}));
          const project=(index,mode)=>makeNode(index,0,'stack',mode===2?[]:[
            consumers[index],makeNode(index,3,mode===1?'stack':'box',[],{}),
            ...(mode===3?[makeNode(index,4,'box',[],{color:9})]:[])
          ],{color:sequence});
          for(const mode of [0,0,3,1,0,2,0,1]){
            const beforeVisits=targets[1].counters.recordVisits,beforeReuses=targets[1].counters.referenceSubtreeReuses;
            for(let index=0;index<2;index++)await targets[index].update(project(index,mode));
            assert.deepEqual(output[1],output[0],'Retained dependency validation changed reference bytes/generations');
            if(sequence===1){
              assert(targets[1].counters.recordVisits-beforeVisits<=2,'Stable reference subtree was fully traversed');
              assert(targets[1].counters.referenceSubtreeReuses>beforeReuses);
            }
            if(mode===3)assert(targets[1].counters.referenceSubtreeReuses>beforeReuses,'Unrelated handle allocation invalidated every reference subtree');
            sequence++;
          }
          const accepted=[...targets[1].accepted.values()],immutable=accepted.map(record=>record.config.map(bytes=>Buffer.from(bytes).toString('hex')));
          nack=true;
          for(let index=0;index<2;index++)await assert.rejects(targets[index].update(project(index,0)),/dependency NACK/);
          accepted.forEach((record,index)=>assert.deepEqual(record.config.map(bytes=>Buffer.from(bytes).toString('hex')),immutable[index]));
          nack=false;
          for(let index=0;index<2;index++)await targets[index].update(project(index,0));
          assert.deepEqual(output[1],output[0],'Dependency-bearing subtree did not recover after NACK');
          assert(targets[1].counters.referenceDependencyChecks>0);
        }
        console.log('Render bindings: reference wire bytes, resets, adapter transitions, callbacks, reparent, generation, NACK, sealed input, cross-binding fixups, closed semantics data, Source focus/gesture capability and in-flight ACK PASS');
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
