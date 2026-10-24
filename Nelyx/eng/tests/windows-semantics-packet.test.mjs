// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';
import {windowsSemanticsPacket,performWindowsSemanticsAction} from '../../sdk/dist/backends/react-native/windows-semantics-packet.js';
import {ReactNativeInteraction} from '../../sdk/dist/backends/react-native/interaction.js';
const timeout=1_200_000,owner={id:'Core View',generation:1},surface={nativeReactTag:42,nativeSurfaceGeneration:3,viewportGeneration:2};
const field=()=>({id:'field',sourceNodeId:7,role:'text-field',name:'Core',bounds:{x:1,y:2,width:100,height:30},enabled:true,focusable:true,focused:false,textInputRevision:11,textRevision:4,textInputGeneration:5,value:'A😀B',textSelection:{anchor:1,focus:3},textNavigation:{characters:[0,1,3,4]},actions:{focus(){}},textActions:{setText(){},setSelection(){}}});
const geometry={coordinates:'view-logical',owner,viewportGeneration:2,nativeSurfaceGeneration:3,layoutEpoch:8,scale:1,transform:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],bounds:{x:1,y:2,width:100,height:30},clip:{x:1,y:2,width:100,height:30},caret:{x:5,y:2,width:1,height:20},caretBaseline:{x:5,y:18},selectionRects:[]};
const paragraph={resource:{id:'paragraph',generation:1},reference:{protocol:'native-paragraph-v1',token:9},paintOffset:{x:-10,y:0}};

test('Windows range reveal is typed, readonly-safe and fenced by the current Core snapshot',{timeout},()=>{
  const interaction=new ReactNativeInteraction(owner,{commands:true,selectionEvents:true,semantics:'native-controls'}),calls=[];
  const source={...field(),readOnly:true,textActions:{scrollRange:(start,end,top)=>calls.push([start,end,top])}},binding=interaction.semantics.bind([source]);
  try{
    const node=interaction.node('field','text-field'),packet=windowsSemanticsPacket(node,owner,surface,interaction.snapshot()),event={protocol:1,id:'field',source:7,commit:packet.commit,kind:'scroll-range',revision:11,generation:5,start:1,end:3,alignToTop:false};
    assert(performWindowsSemanticsAction(interaction,node,packet,event));assert.deepEqual(calls,[[1,3,false]]);
    for(const changed of [{start:2},{start:3,end:1},{alignToTop:1},{generation:6},{revision:12},{commit:packet.commit+1}])assert.equal(performWindowsSemanticsAction(interaction,node,packet,{...event,...changed}),false);
    binding.update([{...source,obscured:true,textNavigation:undefined}]);const secure=interaction.node('field','text-field'),hidden=windowsSemanticsPacket(secure,owner,surface,interaction.snapshot());assert.equal(performWindowsSemanticsAction(interaction,secure,hidden,{...event,commit:hidden.commit,start:0,end:0}),false);assert.equal(calls.length,1);
  }finally{binding.dispose();interaction.dispose();}
});

test('Windows Invoke dispatches one stamped Core action and rejects replaced or disabled sources',{timeout},()=>{
  const interaction=new ReactNativeInteraction(owner,{commands:true,selectionEvents:true,semantics:'native-controls'}),calls=[];
  const button=(enabled=true)=>({id:'button',sourceNodeId:8,role:'button',name:'Action',bounds:{x:0,y:0,width:30,height:20},enabled,actions:{activate:()=>calls.push('activated')}});
  const binding=interaction.semantics.bind([button()]);
  try{
    const node=interaction.node('button','button'),packet=windowsSemanticsPacket(node,owner,surface,interaction.snapshot()),event={protocol:1,id:'button',source:8,commit:packet.commit,kind:'activate'};
    assert.equal(packet.canActivate,true);assert(performWindowsSemanticsAction(interaction,node,packet,event));assert.deepEqual(calls,['activated']);
    binding.update([button(false)]);assert.equal(performWindowsSemanticsAction(interaction,node,packet,event),false);
    const disabled=interaction.node('button','button'),current=windowsSemanticsPacket(disabled,owner,surface,interaction.snapshot());
    assert.equal(performWindowsSemanticsAction(interaction,disabled,current,{...event,commit:current.commit}),false);assert.equal(calls.length,1);
  }finally{binding.dispose();interaction.dispose();}
});

test('Windows semantics copies Core identities/revisions, withdraws mismatched frames and never sends password bodies or unit tables',{timeout},()=>{
  const node={...field(),textInputGeometry:geometry,textParagraph:paragraph},packet=windowsSemanticsPacket(node,owner,surface,6);
  assert.equal(packet.text.textRevision,4);assert.equal(packet.text.revision,11);assert.equal(packet.text.geometry,geometry);assert.equal(packet.text.paragraph,paragraph);assert.deepEqual(packet.text.navigation,{characters:[0,1,3,4],words:[],lines:[]},'Absent Core units remain unsupported rather than invented document partitions');assert(Object.isFrozen(packet)&&Object.isFrozen(packet.owner)&&Object.isFrozen(packet.bounds));
  for(const changed of [{...surface,nativeSurfaceGeneration:4},{...surface,viewportGeneration:3}]){const stale=windowsSemanticsPacket(node,owner,changed,7);assert.equal(stale.text.geometry,null);assert.equal(stale.text.paragraph,null);assert.equal(stale.text.value,'A😀B');}
  const secure=windowsSemanticsPacket({...node,obscured:true,value:'secret🔑'},owner,surface,8);assert.equal(secure.text.value,'');assert.equal(secure.text.anchor,0);assert.equal(secure.text.focus,0);assert.equal(secure.text.navigation,null);assert.equal(secure.text.paragraph,null);assert(!JSON.stringify(secure).includes('secret'));
  for(const prop of ['textInputRevision','textRevision','textInputGeneration','sourceNodeId'])assert.throws(()=>windowsSemanticsPacket({...node,[prop]:undefined},owner,surface,1),/required/);
  const label=windowsSemanticsPacket({...field(),role:'text',textRevision:undefined,textInputRevision:undefined,textInputGeneration:undefined},owner,surface,0);assert.equal(label.text,null);
});
test('Windows native action stamps cannot acquire a newer snapshot, editing owner or listener',{timeout},()=>{
  const interaction=new ReactNativeInteraction(owner,{commands:true,selectionEvents:true,semantics:'native-controls'}),calls=[];let binding;
  const publish=(generation=5)=>({...field(),textInputGeneration:generation,actions:{focus:()=>calls.push('focus')},textActions:{setText:text=>calls.push(text),setSelection:value=>calls.push(value)}});
  try{
    binding=interaction.semantics.bind([publish()]);const node=interaction.node('field','text-field'),packet=windowsSemanticsPacket(node,owner,surface,interaction.snapshot()),event={protocol:1,id:'field',source:7,commit:packet.commit,kind:'set-text',revision:11,generation:5,text:'Core'};
    assert(performWindowsSemanticsAction(interaction,node,packet,event));assert.deepEqual(calls,['Core']);
    assert(performWindowsSemanticsAction(interaction,node,packet,{...event,kind:'set-selection',anchor:3,focus:1}));assert.deepEqual(calls[1],{anchor:3,focus:1});
    assert(performWindowsSemanticsAction(interaction,node,packet,{...event,kind:'focus'}));assert.equal(calls[2],'focus');
    for(const bad of [{...event,commit:packet.commit+1},{...event,source:8},{...event,generation:6},{...event,revision:12},{...event,kind:'set-selection',anchor:2,focus:3},{...event,text:'bad\0text'}])assert.equal(performWindowsSemanticsAction(interaction,node,packet,bad),false);
    binding.update([publish(6)]);assert.equal(performWindowsSemanticsAction(interaction,node,packet,event),false);assert.equal(calls.length,3);
    binding.dispose();assert.equal(performWindowsSemanticsAction(interaction,node,packet,{...event,kind:'focus'}),false);
  }finally{binding?.dispose();interaction.dispose();}
});
