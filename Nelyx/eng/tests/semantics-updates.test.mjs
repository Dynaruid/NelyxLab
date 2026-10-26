// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {freezeSemantics,SemanticsNode,SemanticsOwner,SemanticsConfiguration} from '@nelyx/core/framework/semantics/semantics';
import {SemanticsAction} from '@nelyx/core/ui/semantics-action';
import {Rect} from '@nelyx/core/ui/rect';
import {FoundationBuildMode} from '@nelyx/core/foundation/constants';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {NativeInteraction} from '../../sdk/dist/runtime/native-interaction.js';
const timeout=1_200_000,owner={id:'semantics-updates',generation:1};
const button=(extra={})=>({id:'button',sourceNodeId:1,role:'button',name:'Run',enabled:true,bounds:{x:0,y:0,width:80,height:32},actions:{activate(){}},...extra});

test('retiring the last semantic node publishes one empty update and releases detached work',{timeout},()=>{
  FoundationPlatform.configure({kind:'native',operatingSystem:'windows'});
  for(const hostTree of [false,true]){
    const packets=[],owner=new SemanticsOwner({onSemanticsUpdate(update){packets.push(update._read().nodes.length);update.dispose();},...(hostTree?{createSemanticsUpdateBuilder:()=>null}:{})}),root=SemanticsNode.root({owner}),config=new SemanticsConfiguration();let notifications=0;
    owner.addListener(()=>notifications++);
    try{
      root.rect=Rect.fromLTWH(0,0,40,30);root.updateWith({config});owner.sendSemanticsUpdate();assert.equal(notifications,1);
      root.detach();assert.equal(owner.hasPendingUpdates,true);owner.sendSemanticsUpdate();assert.equal(notifications,2);assert.equal(owner.hasPendingUpdates,false);assert.equal(owner.rootSemanticsNode,null);assert.deepEqual(packets,hostTree?[]:[1,0]);
      owner.sendSemanticsUpdate();assert.equal(notifications,2);
    }finally{if(root.attached)root.detach();owner.dispose();}
  }
});

test('validated immutable trees cross host boundaries without another copy; public frozen input is still validated',{timeout},()=>{
  const input=[button()],snapshot=freezeSemantics(input);
  assert.notEqual(snapshot,input);assert.equal(freezeSemantics(snapshot),snapshot);
  input[0].bounds.x=20;assert.equal(snapshot[0].bounds.x,0);
  assert.throws(()=>freezeSemantics(Object.freeze([snapshot[0],snapshot[0]])),/unique/);
  assert.throws(()=>freezeSemantics(Object.freeze([{...snapshot[0],bounds:{x:NaN,y:0,width:1,height:1}}])),/finite/);
  const mutable=Object.freeze([button()]),first=freezeSemantics(mutable);mutable[0].name='changed';
  assert.equal(first[0].name,'Run');assert.equal(freezeSemantics(mutable)[0].name,'changed');
});

test('paint-only recaptures do not notify React, and mounted actions use the latest Core callback',{timeout},()=>{
  const interaction=new NativeInteraction(owner,{commands:true,selectionEvents:true,semantics:'native-controls'}),calls=[];
  let notifications=0;const stop=interaction.subscribe(()=>notifications++),binding=interaction.semantics.bind([button({actions:{activate:()=>calls.push('old')}})]);
  try{
    const mounted=interaction.semanticNodes[0],version=interaction.snapshot();
    for(let i=0;i<5;i++)binding.update([button({actions:{activate:()=>calls.push(i)}})]);
    assert.equal(notifications,1);assert.equal(interaction.snapshot(),version);assert(interaction.isLiveNodeSnapshot(mounted));
    assert(interaction.activate(mounted.id));assert.deepEqual(calls,[4]);
    interaction.surfaceChanged();assert.equal(notifications,2,'A new native backing must republish surface stamps even for stationary controls');
    binding.update([button({actions:{focus:()=>calls.push('focus')}})]);assert.equal(notifications,3);assert.equal(interaction.activate(mounted.id),false);
    assert(interaction.performAction(mounted.id,'focus'));assert.equal(calls.at(-1),'focus');
    binding.update([]);assert.equal(interaction.isLiveNodeSnapshot(mounted),false);
    binding.update([button()]);assert.equal(interaction.isLiveNodeSnapshot(mounted),false,'Removal and re-addition retire the old control');
  }finally{stop();binding.dispose();interaction.dispose();}
});

test('bounds, child order, state, source identity and text revisions still reach native consumers',{timeout},()=>{
  const interaction=new NativeInteraction(owner,{commands:true,selectionEvents:true,semantics:'native-controls'});
  let notifications=0;const stop=interaction.subscribe(()=>notifications++),binding=interaction.semantics.bind([button()]);
  try{
    const changes=[{bounds:{x:1,y:2,width:80,height:32}},{name:'New label'},{enabled:false},{focused:true},{checked:true},{sourceNodeId:2},{children:[button({id:'child',sourceNodeId:3})]}];
    for(const change of changes){const before=notifications;binding.update([button(change)]);assert.equal(notifications,before+1);}
    const field={...button(),role:'text-field',value:'A😀',textInputRevision:1,textRevision:1,textInputGeneration:1,textSelection:{anchor:0,focus:3},textActions:{setSelection(){}}};
    binding.update([field]);
    for(const change of [{textInputRevision:2},{textRevision:2},{textInputGeneration:2},{textSelection:{anchor:3,focus:0}},{readOnly:true},{obscured:true},{textNavigation:{characters:[0,1,3]}}]){
      const before=notifications;binding.update([{...field,...change}]);assert.equal(notifications,before+1);
    }
    const before=notifications;assert.throws(()=>binding.update([button(),button()]),/unique/);assert.equal(notifications,before);
  }finally{stop();binding.dispose();interaction.dispose();}
});

test('a failed notification retries unchanged metadata without losing a reentrant update',{timeout},()=>{
  const interaction=new NativeInteraction(owner,{commands:true,selectionEvents:true,semantics:'native-controls'}),binding=interaction.semantics.bind([button()]);
  let fail=true,delivered=0;
  const stopFailure=interaction.subscribe(()=>{if(fail)throw new Error('native listener failed');}),stopDelivery=interaction.subscribe(()=>delivered++);
  try{
    assert.throws(()=>binding.update([button({name:'changed'})]),/native listener failed/);assert.equal(delivered,0);
    fail=false;binding.update([button({name:'changed'})]);assert.equal(delivered,1);binding.update([button({name:'changed'})]);assert.equal(delivered,1);
    let reentered=false;const stopReentry=interaction.subscribe(()=>{if(!reentered){reentered=true;binding.update([button({name:'inner'})]);}});
    binding.update([button({name:'outer'})]);assert.equal(interaction.semanticNodes[0].name,'inner');const before=delivered;
    binding.update([button({name:'inner'})]);assert.equal(delivered,before);stopReentry();
  }finally{stopFailure();stopDelivery();binding.dispose();interaction.dispose();}
});

test('host-tree flush keeps source ownership, traversal, actions and dirty retirement without encoding an engine packet',{timeout},()=>{
  const mode=FoundationBuildMode.mode;FoundationBuildMode.mode='debug';FoundationPlatform.configure({kind:'native',operatingSystem:'windows'});
  try{for(const hostTree of [false,true]){
    let packets=0,notifications=0,actions=0;
    const owner=new SemanticsOwner({onSemanticsUpdate(update){packets++;assert(update._read().nodes.length>0);update.dispose();},...(hostTree?{createSemanticsUpdateBuilder:()=>null}:{})});
    const root=SemanticsNode.root({owner}),parent=new SemanticsNode(),child=new SemanticsNode(),config=new SemanticsConfiguration(),parentConfig=new SemanticsConfiguration(),childConfig=new SemanticsConfiguration();
    config.isSemanticBoundary=true;parentConfig.isSemanticBoundary=true;parentConfig.traversalParentIdentifier='parent';childConfig.traversalChildIdentifier='parent';childConfig.label='Child';childConfig.textDirection='ltr';childConfig.onTap=()=>actions++;
    owner.addListener(()=>notifications++);
    try{
      root.rect=Rect.fromLTWH(0,0,240,160);parent.rect=Rect.fromLTWH(0,0,100,100);child.rect=Rect.fromLTWH(10,10,30,20);
      parent.updateWith({config:parentConfig});child.updateWith({config:childConfig});root.updateWith({config,childrenInInversePaintOrder:[parent,child]});
      owner.sendSemanticsUpdate();assert.equal(child.traversalParent,parent);assert.equal(child.debugIsDirty,false);assert.equal(notifications,1);assert.equal(packets,hostTree?0:1);
      assert.equal(owner.getSemanticsNode(child.id),child);owner.performAction(child.id,SemanticsAction.tap);assert.equal(actions,1);
      owner.sendSemanticsUpdate();assert.equal(notifications,1,'A clean flush must not emit another update');
      child.rect=Rect.fromLTWH(15,10,30,20);owner.sendSemanticsUpdate();assert.equal(notifications,2);assert.equal(child.debugIsDirty,false);
      root.updateWith({config,childrenInInversePaintOrder:[parent]});owner.sendSemanticsUpdate();assert.equal(owner.getSemanticsNode(child.id),null);owner.performAction(child.id,SemanticsAction.tap);assert.equal(actions,1);
    }finally{root.detach();owner.dispose();}
  }}finally{FoundationBuildMode.mode=mode;}
});
