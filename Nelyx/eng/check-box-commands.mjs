// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
import path from 'node:path';
import { layoutEncoderFixture } from './layout-encoder-fixture.mjs';
import { boxCommandCacheFixture } from './box-command-cache-fixture.mjs';
const watchdog = setTimeout(() => {
  throw Error('Box command checks exceeded 20 minutes');
}, 1_200_000);
try {
  const bundle = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
      import assert from 'node:assert/strict';
      import {BoxRenderBindingWriter,SceneReference,SceneWriter,boxRenderBindingConfiguration,sceneConfiguration} from './Nelyx/runtime/engine-client/scene.ts';
      import {nativeBoxCommands,nativeBoxDataConfiguration} from '@nelyx/core/framework/rendering/object';
      import {RenderProxyBox,RenderConstrainedBox,RenderPadding,RenderPositionedBox,RenderAlign,FlexParentData,StackParentData} from '@nelyx/core/framework/rendering/boxes';
      import {BoxConstraints} from '@nelyx/core/framework/rendering/constraints';
      import {EdgeInsets} from '@nelyx/core/framework/painting/edge-insets';
      import {Alignment} from '@nelyx/core/framework/painting/alignment';
      import {RenderPointerListener,HitTestBehavior,pointerEventFromNativeSample} from '@nelyx/core/framework/rendering/pointer-listener';
      import {RenderIgnorePointer,RenderAbsorbPointer} from '@nelyx/core/framework/rendering/pointer-blocking';
      import {RenderBlockSemantics,RenderExcludeSemantics,RenderMergeSemantics} from '@nelyx/core/framework/rendering/semantics-annotations';
      import {RenderOffstage} from '@nelyx/core/framework/rendering/offstage';
      import {RenderRepaintBoundary} from '@nelyx/core/framework/rendering/repaint-boundary';
      import {PointerDownEvent} from '@nelyx/core/framework/gestures/events';
      import {parentLayoutFields,parentLayout,originalBoxConfiguration} from './Nelyx/runtime/app/layout.ts';
      import {commands as layoutCommands,protocol as layoutProtocol} from './Nelyx/runtime/engine-client/codec.ts';
      ${layoutEncoderFixture()}
      ${boxCommandCacheFixture()}
      const sink=new BoxRenderBindingWriter(),failure=reason=>{throw Error(reason);};
      const cases=[()=>new RenderProxyBox(),()=>new RenderConstrainedBox(BoxConstraints.tightFor(40,30)),
        ()=>new RenderPadding(EdgeInsets.fromLTRB(1,2,3,4)),
        ()=>new RenderPositionedBox({alignment:new Alignment(.2,-.4),widthFactor:2,heightFactor:.5}),
        ()=>new RenderAlign({alignment:Alignment.center}),
        ()=>new RenderPointerListener(),()=>new RenderIgnorePointer(),()=>new RenderAbsorbPointer(),
        ()=>new RenderBlockSemantics(),()=>new RenderExcludeSemantics(),()=>new RenderMergeSemantics(),
        ()=>new RenderOffstage(),()=>new RenderRepaintBoundary()];
      const wire=(node)=>{const writer=new SceneWriter({} as any,{pollEvents:false,retainedScene:true}) as any;
        return writer.diff(writer.records(node)).map(value=>Buffer.from(value).toString('hex'));};
      for(const [index,factory] of cases.entries())for(const edge of index===1||index===4?['none','flex','positioned']:['none','positioned']){
        const render=factory(),refs=[new SceneReference(),new SceneReference()];
        if(edge==='flex'){const data=new FlexParentData();data.flex=3;data.fit='tight';render.parentData=data;}
        if(edge==='positioned'){const data=new StackParentData();data.left=4;data.bottom=7;data.width=51;render.parentData=data;}
        assert(nativeBoxDataConfiguration(render,failure),'Missing direct-data module '+render.constructor.name);
        const config=originalBoxConfiguration(render,failure)!;
        const expected=sceneConfiguration(refs[0],config.kind,[],{...parentLayout(render,config.options),listItem:{index:3,key:9n}});
        const counts={partEncodes:0,partReuses:0};
        const actual=sink.capture(refs[1],[],render,nativeBoxCommands(render)!,parentLayoutFields,{index:3,key:9n},counts,true);
        assert.deepEqual(wire(actual),wire(expected),render.constructor.name+'/'+edge);
      }
      const sample={phase:'begin' as const,pointer:true,time:2,stream:7,kind:'mouse' as const,buttons:1,x:12,y:14,inverse:[1,0,0,1,-2,-3] as const};
      const events=[],listener=new RenderPointerListener({onPointerDown:event=>events.push(['first',event])});
      const listenerKey=new SceneReference();
      const captureListener=()=>sink.capture(listenerKey,[],listener,nativeBoxCommands(listener)!,parentLayoutFields);
      const firstListener=captureListener();firstListener.options.onPointerSample!(sample);
      assert.throws(()=>Reflect.construct(firstListener.options.onPointerSample!,[]),TypeError,'Pointer carrier became a constructor');
      assert(events[0][1] instanceof PointerDownEvent);assert.deepEqual(events[0][1],pointerEventFromNativeSample(sample));
      listener.onPointerDown=event=>events.push(['replacement',event]);firstListener.options.onPointerSample!(sample);
      assert.equal(events[1][0],'replacement','Sealed carrier cached the old Source callback');
      const nextListener=captureListener();assert.notEqual(nextListener.options.onPointerSample,firstListener.options.onPointerSample,'Capture stopped replacing its callback record');
      listener.dispose();nextListener.options.onPointerSample!(sample);assert.equal(events.length,2,'Disposed Source listener still received input');
      const getterListener=new RenderPointerListener(),observations=[];
      Object.defineProperty(getterListener,'onPointerPanZoomStart',{get(){observations.push('pan-start');return undefined;}});
      Object.defineProperty(getterListener,'onPointerPanZoomUpdate',{get(){observations.push('pan-update');return undefined;}});
      Object.defineProperty(getterListener,'onPointerPanZoomEnd',{get(){observations.push('pan-end');return undefined;}});
      Object.defineProperty(getterListener,'child',{get(){observations.push('child');return undefined;}});
      Object.defineProperty(getterListener,'behavior',{get(){observations.push('behavior');return HitTestBehavior.deferToChild;}});
      originalBoxConfiguration(getterListener,failure);const referenceReads=observations.splice(0);
      sink.capture(new SceneReference(),()=>{observations.push('children');return [];},getterListener,nativeBoxCommands(getterListener)!,parentLayoutFields);
      assert.deepEqual(observations,[...referenceReads,'children'],'Pointer getter/child order differs from adapter');
      for(const behavior of [HitTestBehavior.opaque,HitTestBehavior.translucent]){
        const render=new RenderPointerListener({behavior}),reference=originalBoxConfiguration(render,failure)!;
        assert.deepEqual(wire(sink.capture(new SceneReference(),[],render,nativeBoxCommands(render)!,parentLayoutFields)),
          wire(sceneConfiguration(new SceneReference(),reference.kind,[],reference.options)),'Pointer behavior '+behavior.name);
      }
      for(const [render,field] of [[new RenderIgnorePointer(),'ignoring'],[new RenderAbsorbPointer(),'absorbing'],[new RenderBlockSemantics(),'blocking'],[new RenderExcludeSemantics(),'excluding'],[new RenderOffstage(),'offstage']] as const){
        for(const value of [true,false]){render[field]=value;const ref=originalBoxConfiguration(render,failure)!;
          assert.deepEqual(wire(sink.capture(new SceneReference(),[],render,nativeBoxCommands(render)!,parentLayoutFields)),
            wire(sceneConfiguration(new SceneReference(),ref.kind,[],ref.options)),field+'/'+value);}
      }
      const rejected={reason:''},rejecting=new BoxRenderBindingWriter(reason=>{rejected.reason=reason;throw rejected;});
      const custom=new RenderPointerListener();Object.defineProperty(custom,'handleEvent',{value:()=>{}});let rejectedChildren=0;
      assert.throws(()=>rejecting.capture(new SceneReference(),()=>{++rejectedChildren;return [];},custom,nativeBoxCommands(custom)!,parentLayoutFields),error=>error===rejected);
      assert.equal(rejected.reason,'custom-pointer-listener-handler');assert.equal(rejectedChildren,0);
      const pan=new RenderPointerListener({onPointerPanZoomStart:()=>{}});
      assert.throws(()=>rejecting.capture(new SceneReference(),[],pan,nativeBoxCommands(pan)!,parentLayoutFields),error=>error===rejected);
      assert.equal(rejected.reason,'pointer-pan-zoom-carrier');
      class CustomPadding extends EdgeInsets {
        resolve(direction){order.push('resolve:'+direction);return super.resolve(direction);}
      }
      const order=[],padding=new RenderPadding(new CustomPadding(1,2,3,4),undefined,'rtl');
      const key=new SceneReference();
      sink.capture(()=>{order.push('bind');return key;},()=>{order.push('children');return [];},padding,
        nativeBoxCommands(padding)!, (render,layout)=>{order.push('parent');return parentLayoutFields(render,layout);});
      assert.deepEqual(order,['resolve:rtl','bind','parent','children'],'Module command capture changed resolver/child ordering');
      const sentinel={failure:'resolve'};
      class ThrowingPadding extends EdgeInsets {resolve(){throw sentinel;}}
      const throwing=new RenderPadding(new ThrowingPadding());let children=0;
      assert.throws(()=>sink.capture(key,()=>{++children;return [];},throwing,nativeBoxCommands(throwing)!,parentLayoutFields),error=>error===sentinel);
      assert.equal(children,0,'A failed resolver ran child projection');
      // Codec rejection is later than child capture, as in the reference path.
      assert.throws(()=>sink.capture(key,()=>{++children;return [];},padding,(_render,commands)=>commands.layout({gap:NaN}),parentLayoutFields));
      assert.equal(children,1,'Codec rejection skipped canonical child side effects');
      const constraints=BoxConstraints.tightFor(20,30),constrained=new RenderConstrainedBox(constraints);
      const writes=[[],[]],writers=writes.map(output=>new SceneWriter({commit:async commands=>output.push(commands.map(value=>Buffer.from(value).toString('hex')))} as any,{pollEvents:false,retainedScene:true}));
      const refs=[new SceneReference(),new SceneReference()];
      const before=nativeBoxDataConfiguration(constrained,failure)!;
      const direct=sink.capture(refs[1],()=>{(constraints as any).maxWidth=21;return [];},constrained,nativeBoxCommands(constrained)!,parentLayoutFields);
      const reference=boxRenderBindingConfiguration(refs[0],[],before,parentLayoutFields(constrained,before.layout) as any);
      await writers[0].mount(reference);await writers[1].mount(direct);assert.deepEqual(writes[1],writes[0],'Constraints were sampled before child side effects');
      const nested=new RenderProxyBox();
      const tree=sink.capture(new SceneReference(),()=>[sink.capture(new SceneReference(),[],nested,nativeBoxCommands(nested)!,parentLayoutFields)],nested,nativeBoxCommands(nested)!,parentLayoutFields);
      assert.equal(tree.children.length,1,'Nested capture reused its parent sink state');
      const outer=new RenderPointerListener(),inner=new RenderIgnorePointer();
      const innerRef=originalBoxConfiguration(inner,failure)!,outerRef=originalBoxConfiguration(outer,failure)!;
      const nestedPolicy=sink.capture(new SceneReference(),()=>[sink.capture(new SceneReference(),[],inner,nativeBoxCommands(inner)!,parentLayoutFields)],outer,nativeBoxCommands(outer)!,parentLayoutFields);
      assert.deepEqual(wire(nestedPolicy),wire(sceneConfiguration(new SceneReference(),'box',[sceneConfiguration(new SceneReference(),'box',[],innerRef.options)],outerRef.options)),'Nested interaction overwrote its parent callback/policy');
      assert(nestedPolicy.options.onPointerSample);assert.equal(nestedPolicy.children[0].options.onPointerSample,undefined);
      assert.throws(()=>sink.capture(new SceneReference(),()=>{throw sentinel;},outer,nativeBoxCommands(outer)!,parentLayoutFields),error=>error===sentinel);
      assert.equal((sink as any).sourceLayout,undefined);assert.equal((sink as any).sourceConstraints,undefined);
      assert.equal((sink as any).interactionOptions.onPointerSample,undefined);assert.equal((sink as any).interactionOptions.semanticsPolicy,undefined);
      assert.deepEqual(wire(sink.capture(new SceneReference(),[],nested,nativeBoxCommands(nested)!,parentLayoutFields)),
        wire(sceneConfiguration(new SceneReference(),'box',[],{layout:{childConstraints:'inherit'},pointerHitTest:'proxy'})),'Pooled writer retained pointer or blocking state');
      class Unknown extends RenderPadding{}assert.equal(nativeBoxCommands(new Unknown(EdgeInsets.zero)),undefined);
      const sharing=new BoxRenderBindingWriter(),sharedCounts={partEncodes:0,partReuses:0,commandEncodes:0,commandBytes:0,commandReuses:0};
      for(const render of [new RenderConstrainedBox(BoxConstraints.tightFor(20,30)),new RenderConstrainedBox(BoxConstraints.tightFor(20,30)),
        new RenderRepaintBoundary(BoxConstraints.tightFor(20,30)),new RenderRepaintBoundary(BoxConstraints.tightFor(20,30)),
        new RenderIgnorePointer(),new RenderIgnorePointer(),new RenderOffstage(),new RenderOffstage()]){
        const actual=sharing.capture(new SceneReference(),[],render,nativeBoxCommands(render)!,parentLayoutFields,undefined,sharedCounts);
        const reference=originalBoxConfiguration(render,failure)!;
        assert.deepEqual(wire(actual),wire(sceneConfiguration(new SceneReference(),reference.kind,[],reference.options)),'Shared body changed fresh-render wire');
      }
      assert.equal(sharedCounts.commandEncodes,2,'Fresh renders repeated fixed layout/constraint/policy encoding');
      assert.equal(sharedCounts.commandReuses,10,'Expected body sharing across fresh render references');
      const layoutSharing=new BoxRenderBindingWriter(),layoutCounts={partEncodes:0,partReuses:0,commandEncodes:0,commandBytes:0,commandReuses:0};
      for(const render of [new RenderPadding(EdgeInsets.all(4)),new RenderAlign({alignment:Alignment.center}),new RenderPadding(EdgeInsets.all(4)),new RenderAlign({alignment:Alignment.center})]){
        const actual=layoutSharing.capture(new SceneReference(),[],render,nativeBoxCommands(render)!,parentLayoutFields,undefined,layoutCounts,true);
        const reference=originalBoxConfiguration(render,failure)!;
        assert.deepEqual(wire(actual),wire(sceneConfiguration(new SceneReference(),reference.kind,[],reference.options)),'Shared scalar layout changed wire');
      }
      assert.equal(layoutCounts.commandEncodes,2);assert.equal(layoutCounts.commandReuses,2);
      const paddingReads=[];let liveLeft=4;
      class LivePadding extends EdgeInsets {resolve(){return {get left(){paddingReads.push('left');return liveLeft;},get top(){paddingReads.push('top');return 2;},get right(){paddingReads.push('right');return 3;},get bottom(){paddingReads.push('bottom');return 4;}};}}
      const livePadding=new RenderPadding(new LivePadding());
      for(const value of [4,4,7]){
        paddingReads.length=0;
        const actual=layoutSharing.capture(new SceneReference(),()=>{paddingReads.push('children');liveLeft=value;return [];},livePadding,nativeBoxCommands(livePadding)!,parentLayoutFields,undefined,layoutCounts,true);
        assert.deepEqual(paddingReads,['children','left','top','right','bottom'],'Shared padding changed live getter order');
        const expected=originalBoxConfiguration(new RenderPadding(EdgeInsets.fromLTRB(value,2,3,4)),failure)!;
        assert.deepEqual(wire(actual),wire(sceneConfiguration(new SceneReference(),expected.kind,[],expected.options)),'Shared padding retained an earlier mutable scalar');
      }
      const latePaddingError={padding:'late'};
      class InvalidPadding extends EdgeInsets {resolve(){return {get left(){return NaN;},get top(){throw latePaddingError;},right:3,bottom:4};}}
      const invalidPadding=new RenderPadding(new InvalidPadding());
      assert.throws(()=>layoutSharing.capture(new SceneReference(),[],invalidPadding,nativeBoxCommands(invalidPadding)!,parentLayoutFields,undefined,layoutCounts,true),error=>error===latePaddingError,'Shared padding validated before later Source getters');
      assert.equal((layoutSharing as any).scalarLayoutKind,0,'Failed scalar capture retained its mode');
      const parentEdited=new RenderAlign({alignment:Alignment.center});
      const parentBound=layoutSharing.capture(new SceneReference(),[],parentEdited,nativeBoxCommands(parentEdited)!,(render,layout)=>({...parentLayoutFields(render,layout),gap:9}),undefined,layoutCounts);
      const parentExpected=originalBoxConfiguration(parentEdited,failure)!;
      assert.deepEqual(wire(parentBound),wire(sceneConfiguration(new SceneReference(),parentExpected.kind,[],{...parentExpected.options,layout:{...parentExpected.options.layout,gap:9}})),'Arbitrary parent callback used a scalar-only body');
      const observed=[],liveConstraints=BoxConstraints.tightFor(20,30);let currentMax=20;
      Object.defineProperties(liveConstraints,{minWidth:{get(){observed.push('minWidth');return 20;}},maxWidth:{get(){observed.push('maxWidth');return currentMax;}},minHeight:{get(){observed.push('minHeight');return 30;}},maxHeight:{get(){observed.push('maxHeight');return 30;}}});
      const live=new RenderConstrainedBox(liveConstraints);
      for(const width of [20,20,21]){
        observed.length=0;
        const actual=sharing.capture(new SceneReference(),()=>{observed.push('children');currentMax=width;return [];},live,nativeBoxCommands(live)!,parentLayoutFields);
        assert.deepEqual(observed,['children','minWidth','maxWidth','minHeight','maxHeight'],'Shared constraints changed live getter order');
        const expected=new RenderConstrainedBox(new BoxConstraints(20,width,30,30));
        const reference=originalBoxConfiguration(expected,failure)!;
        assert.deepEqual(wire(actual),wire(sceneConfiguration(new SceneReference(),reference.kind,[],reference.options)),'Shared constraints retained an earlier mutable scalar');
      }
      const preserved=sharing.capture(new SceneReference(),[],live,nativeBoxCommands(live)!,parentLayoutFields);
      const corrupted=new SceneWriter({} as any,{pollEvents:false,retainedScene:true}) as any;
      for(const bytes of corrupted.diff(corrupted.records(preserved)))bytes.fill(255);
      const finalReference=originalBoxConfiguration(live,failure)!;
      assert.deepEqual(wire(sharing.capture(new SceneReference(),[],live,nativeBoxCommands(live)!,parentLayoutFields)),wire(sceneConfiguration(new SceneReference(),finalReference.kind,[],finalReference.options)),'Destination writes mutated a shared body');
      console.log('Box command cache:',boxCommandCacheResult,'fresh-reference sharing, scalar layouts, live getters, child edits and destination isolation PASS.');
      console.log('Box commands: adapter wire for 13 modules, parent fields, live pointer callbacks/disposal, getter/exception/child order, blocking/semantics/offstage transitions, mutable constraints, nested capture and cleanup PASS.');
    `,
    },
    bundle: true,
    alias: { '@nelyx/core': path.resolve('Nelyx/src') },
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
