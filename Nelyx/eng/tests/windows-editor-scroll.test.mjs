// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {WindowsInteraction} from '../../sdk/dist/platforms/windows/interaction.js';
import {AndroidInteraction} from '../../sdk/dist/platforms/android/interaction.js';
import {EditableText,TextEditingController} from '@nelyx/core/framework/widgets/editable-text';
import {Directionality} from '@nelyx/core/framework/widgets/app-data';
import {SizedBox} from '@nelyx/core/framework/widgets/basic';
import {ListView} from '@nelyx/core/framework/widgets/scroll-view';
import {ScrollController} from '@nelyx/core/framework/widgets/scroll-controller';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {engineFixture} from '../../../packages/material/tests/engine-fixture.mjs';

const timeout=1_200_000;

for(const [platform,Interaction,accessibilityEnabled] of [
  ['windows',WindowsInteraction,true],
  ['windows',WindowsInteraction,false],
  ['android',AndroidInteraction,true],
])test(`${platform} scrolling editors keep native geometry current with accessibility ${accessibilityEnabled}`,{timeout},async()=>{
  FoundationPlatform.configure({kind:'native',operatingSystem:platform});
  const f=await engineFixture({fonts:true,accessibilityEnabled}),interaction=new Interaction(f.root.context.owner),scroll=new ScrollController();
  const controllers=Array.from({length:4},(_,i)=>new TextEditingController('Editor '+i)),packets=new Map(),detaches=[],publications=[];
  f.root.context.editing=interaction.editing;f.root.context.semantics=interaction.semantics;
  const unsubscribe=interaction.subscribe(()=>publications.push(interaction.semanticNodes));
  try{
    f.set(new Directionality('ltr',new ListView({controller:scroll,children:[...controllers.map((controller,i)=>new EditableText('field-'+i,controller,'Editor '+i,undefined,24,null,{minHeight:0,maxLines:1})),new SizedBox(200,300)]})));
    for(const {id}of interaction.editorClients){
      const sent=[];packets.set(id,sent);
      detaches.push(interaction.attachEditor(id,{}, {replace(){},focus(){},blur(){},updateGeometry(geometry){sent.push(geometry);}}));
    }
    f.frame();
    const previous=new Map([...packets].map(([id,sent])=>[id,sent.at(-1)]));
    for(const offset of [5,10,15]){
      publications.length=0;for(const sent of packets.values())sent.length=0;
      scroll.jumpTo(offset);f.advance(17);
      assert.equal(publications.length,platform==='windows'?(accessibilityEnabled?1:0):5,'Nonvisual input never republishes the host control tree for individual editor bounds');
      for(const [id,sent]of packets){
        assert.equal(sent.length,1,'Every moving editor still sends exactly one native geometry packet');
        const current=sent[0],before=previous.get(id);
        assert(current&&before);assert(current.layoutEpoch>before.layoutEpoch);assert.equal(current.bounds.y,before.bounds.y-5);
        assert.deepEqual(interaction.editorInputBounds(id),current.bounds);previous.set(id,current);
        const node=f.root.nodes.find(node=>node.id===id);
        if(node){assert.equal(node.textInputGeometry.layoutEpoch,current.layoutEpoch);assert.deepEqual(node.textInputGeometry.bounds,current.bounds);}
      }
      assert.deepEqual(controllers.map(controller=>controller.text),['Editor 0','Editor 1','Editor 2','Editor 3']);
    }
  }finally{unsubscribe();await f.close();for(const detach of detaches)detach();interaction.dispose();scroll.dispose();for(const controller of controllers)controller.dispose();}
});

test('one-second accessibility motion throttling keeps every editor geometry current and flushes state, edits and the settled position',{timeout},async()=>{
  FoundationPlatform.configure({kind:'native',operatingSystem:'windows'});
  const f=await engineFixture({fonts:true}),interaction=new WindowsInteraction(f.root.context.owner),scroll=new ScrollController();
  f.root.options.semanticsUpdateInterval=1000;
  f.root.context.editing=interaction.editing;f.root.context.semantics=interaction.semantics;
  const controllers=Array.from({length:4},(_,i)=>new TextEditingController('Editor '+i)),packets=new Map(),detaches=[],deadlines=new Set();
  let captures=0,publications=0;
  const capture=f.root.sourceSemanticsSnapshot.capture.bind(f.root.sourceSemanticsSnapshot);
  f.root.sourceSemanticsSnapshot.capture=(...args)=>{captures++;return capture(...args);};
  f.root.context.requestFrameAt=(deadline,wake)=>{const entry={deadline,wake};deadlines.add(entry);return {dispose(){deadlines.delete(entry);}};};
  const advance=ms=>{f.elapse(ms);for(const entry of [...deadlines])if(entry.deadline<=f.root.context.clock.now()){deadlines.delete(entry);entry.wake();}return f.frame();};
  const unsubscribe=interaction.subscribe(()=>publications++);
  try{
    f.set(new Directionality('ltr',new ListView({controller:scroll,children:[...controllers.map((controller,i)=>new EditableText('throttle-'+i,controller,'Editor '+i,undefined,24,null,{minHeight:0,maxLines:1})),new SizedBox(200,300)]})));
    for(const {id}of interaction.editorClients){const sent=[];packets.set(id,sent);detaches.push(interaction.attachEditor(id,{}, {replace(){},focus(){},blur(){},updateGeometry(geometry){sent.push(geometry);}}));}
    f.frame();captures=0;publications=0;
    for(let i=1;i<=20;i++){
      for(const sent of packets.values())sent.length=0;
      scroll.jumpTo(i);advance(50);
      assert.equal(captures,i===20?1:0,'Continuous motion publishes at most once per second, including text fields');
      assert.equal(publications,i===20?1:0);
      for(const [id,sent]of packets){assert.equal(sent.length,1);assert(sent[0]);assert.deepEqual(interaction.editorInputBounds(id),sent[0].bounds);}
    }
    scroll.jumpTo(25);advance(50);assert.equal(captures,1);assert.equal(deadlines.size,1);
    advance(99);assert.equal(captures,1,'Unrelated frames do not push the quiet deadline back');
    advance(1);assert.equal(captures,2,'Final coordinates arrive 100ms after the last motion');assert.equal(deadlines.size,0);
    for(const [id,sent]of packets){const node=f.root.nodes.find(node=>node.id===id);if(node){assert.deepEqual(node.textInputGeometry.bounds,sent.at(-1).bounds);assert.equal(node.textInputGeometry.layoutEpoch,sent.at(-1).layoutEpoch);}}

    scroll.jumpTo(26);advance(10);const before=captures;
    controllers[1].text='Immediate value';f.frame();assert.equal(captures,before+1);assert.equal(interaction.node('throttle-1','text-field').value,'Immediate value');assert.equal(deadlines.size,0);
    const editable=f.root.nodes.find(node=>node.id==='throttle-1');
    scroll.jumpTo(27);advance(10);editable.textActions.setText('Accessibility edit');assert.equal(controllers[1].text,'Immediate value');
    f.frame();assert.equal(controllers[1].text,'Accessibility edit','A deferred UIA edit requests a fresh snapshot and then executes');assert.equal(deadlines.size,0);f.frame();
    const superseded=f.root.nodes.find(node=>node.id==='throttle-1');scroll.jumpTo(28);advance(10);superseded.textActions.setText('Must be rejected');controllers[1].text='Newer content';f.frame();assert.equal(controllers[1].text,'Newer content','A changed content revision retires the queued edit');
    f.frame();scroll.jumpTo(29);advance(10);assert.equal(deadlines.size,1);
  }finally{unsubscribe();await f.close();for(const detach of detaches)detach();interaction.dispose();scroll.dispose();for(const controller of controllers)controller.dispose();}
  assert.equal(deadlines.size,0,'Retirement cancels the pending accessibility wake');
});
