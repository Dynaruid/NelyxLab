// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {EditableText,TextEditingController} from '@nelyx/core/framework/widgets/editable-text';
import {FocusNode} from '@nelyx/core/framework/widgets/focus';
import {GlobalKey} from '@nelyx/core/framework/widgets/global-key';
import {Center,SizedBox} from '@nelyx/core/framework/widgets/basic';
import {TextInputFormatter} from '@nelyx/core/services/input-formatters';
import {SelectionChangedCause} from '@nelyx/core/services/text-input';
import {SemanticsAction} from '@nelyx/core/ui/semantics-action';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {EditingSession} from '@nelyx/core/ui/editing';
import {RenderEditable} from '@nelyx/core/framework/rendering/editable';
import {TextPosition} from '@nelyx/core/ui/text-position';
import {TextSelection} from '@nelyx/core/services/text-editing';
import {TextStyle} from '@nelyx/core/framework/painting/text-style';
import {ScrollController} from '@nelyx/core/framework/widgets/scroll-controller';
import {ListView} from '@nelyx/core/framework/widgets/scroll-view';
import {Directionality} from '@nelyx/core/framework/widgets/app-data';
import {graphemeBoundaries} from '@nelyx/core/foundation/grapheme-boundaries';
import {freezeSemantics} from '@nelyx/core/framework/semantics/semantics';
import {NativeInteraction} from '../../sdk/dist/runtime/native-interaction.js';
import {engineFixture} from '../../../packages/material/tests/engine-fixture.mjs';

const timeout=1_200_000;
FoundationPlatform.configure({kind:'native',operatingSystem:'windows'});
const field=(controller,focus,key,options={})=>new Center(new SizedBox(220,50,new EditableText('field',controller,'Accessible Core editor',focus,50,key,options)));
function input(f){
  const records=[];
  f.root.context.editing={capabilities:{indexUnit:'utf16',composing:'observed',selectionDirection:'observed'},bind(owner,initial,changed,options){
    const session=new EditingSession(owner,initial),pending=[],publish=(content,source='programmatic')=>{session.update({...session.value,...content,source,revision:session.value.revision+1});changed(session.value);};
    records.push({pending,native:content=>publish(content,'native'),ack(){assert(pending.length);publish(pending.shift());}});
    return {read:()=>session.value,get isComposing(){return session.value.composing.status==='active';},replace:content=>publish(content),replaceComposing:content=>pending.push(content),focus(){options.focusChanged?.(true);},blur(){options.focusChanged?.(false);},dispose(){session.dispose();}};
  }};
  return records;
}
async function setup(){
  const f=await engineFixture({fonts:true}),interaction=new NativeInteraction(f.root.context.owner,{commands:true,selectionEvents:true,semantics:'native-controls'});
  f.root.context.semantics=interaction.semantics;const records=input(f);
  return {f,interaction,records,async close(){await f.close();interaction.dispose();}};
}

test('deferred text selection and range reveal refresh coordinates while retaining editing revision and owner guards',{timeout},async()=>{
  const h=await setup(),controller=new TextEditingController(Array.from({length:12},(_,i)=>'Line '+i).join('\n')),focus=new FocusNode(),key=new GlobalKey('deferred text'),outer=new ScrollController(),inner=new ScrollController(),events=[];
  h.f.root.options.semanticsUpdateInterval=1000;
  const tree=options=>new Directionality('ltr',new ListView({controller:outer,children:[new SizedBox(200,20),field(controller,focus,key,{maxLines:2,minHeight:0,scrollController:inner,configuration:{readOnly:true},...options}),new SizedBox(200,300)]}));
  const node=()=>h.f.root.nodes.find(node=>node.id==='field');
  try{
    h.f.root.semanticsActionBinding.addSemanticsActionListener(event=>events.push(event.type));h.f.set(tree());const value=controller.value,start=controller.text.indexOf('Line 5');
    const original=node();outer.jumpTo(5);h.f.advance(10);assert(h.f.root.semanticsDeferred);assert(h.interaction.performTextAction('field',{kind:'scroll-range',start,end:start+6,alignToTop:true},original.textInputRevision,original.textInputGeneration));assert.equal(inner.offset,0);h.f.frame();h.f.frame();
    assert(inner.offset>0);assert.deepEqual(controller.value,value);assert.equal(focus.hasPrimaryFocus,false);assert.equal(events.filter(type=>type===SemanticsAction.showOnScreen).length,1);
    const selection=node();outer.jumpTo(6);h.f.advance(10);assert(h.f.root.semanticsDeferred);selection.textActions.setSelection({anchor:1,focus:3});h.f.frame();assert.deepEqual(controller.selection,{anchor:1,focus:3});h.f.frame();
    const stale=node();outer.jumpTo(7);h.f.advance(10);stale.textActions.setSelection({anchor:0,focus:2});controller.selection={anchor:4,focus:4};h.f.frame();assert.deepEqual(controller.selection,{anchor:4,focus:4},'A selection revision change cancels the old deferred request');h.f.frame();
    const disabled=node();outer.jumpTo(8);h.f.advance(10);disabled.textActions.setSelection({anchor:0,focus:2});h.f.set(tree({enabled:false}));assert.deepEqual(controller.selection,{anchor:4,focus:4},'Disabling a field retires a pending edit');assert.equal(node().enabled,false);
  }finally{await h.close();controller.dispose();focus.dispose();outer.dispose();inner.dispose();}
});

test('accessible ranges align the actual Core paragraph without changing readonly text, selection or focus',{timeout},async()=>{
  const h=await setup(),text=Array.from({length:12},(_,index)=>'Line '+index).join('\n'),controller=new TextEditingController(text),focus=new FocusNode(),scroll=new ScrollController(),key=new GlobalKey('accessible range'),events=[];
  controller.selection={anchor:0,focus:0};
  try{
    h.f.root.semanticsActionBinding.addSemanticsActionListener(event=>events.push(event));
    h.f.set(field(controller,focus,key,{maxLines:2,minHeight:0,scrollController:scroll,textStyle:new TextStyle({fontSize:20,height:1.5}),enableInteractiveSelection:false,configuration:{readOnly:true}}));
    const render=key.currentState.renderEditable,original=controller.value,revision=controller.revision,start=text.indexOf('Line 5'),end=start+6;
    const range=()=>render.getBoxesForSelection(new TextSelection({baseOffset:start,extentOffset:end}))[0];
    assert(range().top>render.size.height);const node=h.f.root.nodes.find(node=>node.id==='field');assert(node.textActions.scrollRange);assert.equal(node.textActions.setText,undefined);assert.equal(node.textActions.setSelection,undefined);
    assert(h.interaction.performTextAction('field',{kind:'scroll-range',start,end,alignToTop:true},node.textInputRevision,node.textInputGeneration));h.f.frame();
    assert(scroll.offset>0);assert(Math.abs(range().top)<.1,'The requested range is flush with the editor viewport top');assert.deepEqual(controller.value,original);assert.equal(controller.revision,revision);assert.equal(focus.hasPrimaryFocus,false);
    assert(h.interaction.performTextAction('field',{kind:'scroll-range',start,end,alignToTop:false},node.textInputRevision,node.textInputGeneration));h.f.frame();
    assert(Math.abs(range().bottom-render.size.height)<.1,'The requested range is flush with the editor viewport bottom');assert.deepEqual(controller.value,original);assert.equal(controller.revision,revision);assert.equal(controller.canUndo,false);assert.equal(controller.canRedo,false);
    assert.deepEqual(events.map(event=>event.type),[SemanticsAction.showOnScreen,SemanticsAction.showOnScreen]);
    assert.deepEqual(events.map(event=>event.arguments),[{start,end,alignToTop:true},{start,end,alignToTop:false}]);
    const offset=scroll.offset;for(const action of [{start:1.5,end,alignToTop:true},{start:end,end:start,alignToTop:true},{start,end:text.length+1,alignToTop:true},{start,end,alignToTop:'true'}])assert.equal(h.interaction.performTextAction('field',{kind:'scroll-range',...action},node.textInputRevision,node.textInputGeneration),false);assert.equal(scroll.offset,offset);
    const stale=node.textActions.scrollRange;controller.text=text.replace('Line 0','Other0');h.f.frame();const current=scroll.offset;stale(0,4,true);assert.equal(scroll.offset,current,'A callback from a previous Core document cannot scroll its replacement');
    const dispose=h.f.root.semanticsActionBinding.addSemanticsActionListener(event=>{if(event.type===SemanticsAction.showOnScreen)controller.text='Reentrant document';});
    try{const latest=h.f.root.nodes.find(node=>node.id==='field');assert(h.interaction.performTextAction('field',{kind:'scroll-range',start,end,alignToTop:true},latest.textInputRevision,latest.textInputGeneration));assert.equal(scroll.offset,current,'A reentrant semantics observer retires the range before scrolling');assert.equal(controller.text,'Reentrant document');}finally{dispose?.();}
  }finally{await h.close();controller.dispose();focus.dispose();scroll.dispose();}
});

test('Core accessibility text and directional selection use the user delegate, formatter, history and global action listener',{timeout},async()=>{
  const h=await setup(),controller=new TextEditingController('old'),focus=new FocusNode(),key=new GlobalKey('semantics'),changed=[],selected=[],formatted=[],actions=[];
  class Upper extends TextInputFormatter{formatEditUpdate(old,next){formatted.push([old.text,next.text]);return {...next,text:next.text.toUpperCase()};}}
  try{
    h.f.root.semanticsActionBinding.addSemanticsActionListener(event=>actions.push(event));
    h.f.set(field(controller,focus,key,{inputFormatters:[new Upper()],onChanged:text=>changed.push(text),onSelectionChanged:(selection,cause)=>selected.push([selection.baseOffset,selection.extentOffset,cause])}));
    assert.equal(focus.hasPrimaryFocus,false);const first=h.f.root.nodes.find(node=>node.id==='field');
    assert.equal(h.interaction.performTextAction('field',{kind:'set-text',text:'ab😀'},first.textInputRevision),true);
    assert.equal(controller.text,'AB😀');assert.deepEqual(controller.selection,{anchor:4,focus:4});assert.deepEqual(formatted,[['old','ab😀']]);assert.deepEqual(changed,['AB😀']);
    assert.equal(actions.length,1);assert.equal(actions[0].type,SemanticsAction.setText);assert.equal(actions[0].arguments,'ab😀');
    h.f.frame();selected.length=0;
    assert.equal(h.interaction.performTextAction('field',{kind:'set-selection',anchor:4,focus:1},controller.revision),true);
    assert.deepEqual(controller.selection,{anchor:4,focus:1});assert.deepEqual(selected,[[4,1,SelectionChangedCause.keyboard]]);assert.deepEqual(changed,['AB😀']);assert.equal(formatted.length,1);
    assert.equal(actions[1].type,SemanticsAction.setSelection);assert.deepEqual([...actions[1].arguments],[['base',4],['extent',1]]);
    assert.equal(controller.undo(),true);assert.equal(controller.text,'old','Accessible text edits join the existing history');
  }finally{await h.close();controller.dispose();focus.dispose();}
});

test('Core semantics content revision retains coalesced text changes without treating selection or composition acks as new text',{timeout},async()=>{
  const h=await setup(),controller=new TextEditingController('A😀'),focus=new FocusNode(),key=new GlobalKey('content revision');
  const node=()=>h.f.root.nodes.find(value=>value.id==='field');
  try{
    h.f.set(field(controller,focus,key));const initial=node();assert.equal(initial.textRevision,0);assert.equal(controller.textRevision,0);
    controller.selection={anchor:0,focus:0};h.f.frame();assert(node().textInputRevision>initial.textInputRevision);assert.equal(node().textRevision,0);
    // Both writes precede the next accepted semantics frame. The body alone
    // cannot distinguish this edit/Undo-style ABA from an unchanged paragraph.
    controller.text='temporary';controller.text='A😀';h.f.frame();assert.equal(node().value,initial.value);assert.equal(node().textRevision,2);
    focus.requestFocus();h.f.frame();assert.equal(node().textRevision,2);
    h.records[0].native({text:'A😀한',selection:{anchor:4,focus:4},composing:{status:'active',start:3,end:4}});h.f.frame();assert.equal(controller.textRevision,3);assert.equal(node().textRevision,3);
    h.records[0].native({selection:{anchor:3,focus:4},composing:{status:'active',start:3,end:4}});h.f.frame();assert.equal(node().textRevision,3);
    h.records[0].native({composing:{status:'none'}});h.f.frame();assert.equal(node().textRevision,3,'Native composition completion retains the already observed content revision');
    assert(controller.undo());h.f.frame();assert.equal(controller.text,'A😀');assert.equal(node().textRevision,4);
    for(const textRevision of [-1,Number.MAX_SAFE_INTEGER+1,NaN])assert.throws(()=>freezeSemantics([{...node(),textRevision}]),/Text content revisions/);
    assert.throws(()=>freezeSemantics([{id:'foreign',role:'text',name:'Foreign',enabled:true,bounds:initial.bounds,textRevision:0}]),/Text content revisions/);
  }finally{await h.close();controller.dispose();focus.dispose();}
});

test('accessible selection preserves OS composition and accessible replacement completes only after cancellation acknowledgement',{timeout},async()=>{
  const h=await setup(),controller=new TextEditingController('before'),focus=new FocusNode(),key=new GlobalKey('composing semantics'),changed=[];
  try{
    h.f.set(field(controller,focus,key,{onChanged:text=>changed.push(text)}));const host=h.records[0];
    host.native({text:'한A',selection:{anchor:1,focus:1},composing:{status:'active',start:0,end:1}});h.f.frame();changed.length=0;
    assert.equal(h.interaction.performTextAction('field',{kind:'set-selection',anchor:0,focus:0},controller.revision),true);
    assert.deepEqual(controller.selection,{anchor:0,focus:0});assert.deepEqual(controller.value.composing,{status:'active',start:0,end:1});assert.equal(host.pending.length,0);h.f.frame();
    assert.equal(h.interaction.performTextAction('field',{kind:'set-text',text:'after'},controller.revision),true);
    assert.equal(controller.text,'한A');assert.equal(controller.isComposing,true);assert.deepEqual(changed,[]);assert.equal(host.pending.length,1);
    host.ack();assert.equal(controller.text,'after');assert.equal(controller.isComposing,false);assert.deepEqual(changed,['after']);
  }finally{await h.close();controller.dispose();focus.dispose();}
});

test('readonly, disabled and interactive-selection policy gates accessibility and old source snapshots retire',{timeout},async()=>{
  const h=await setup(),controller=new TextEditingController('A😀B'),replacement=new TextEditingController('replacement'),focus=new FocusNode(),key=new GlobalKey('policy semantics');
  try{
    h.f.set(field(controller,focus,key,{configuration:{readOnly:true}}));assert.equal(h.interaction.performTextAction('field',{kind:'set-text',text:'blocked'}),false);
    assert.equal(h.interaction.performTextAction('field',{kind:'set-selection',anchor:4,focus:1}),true);h.f.frame();
    assert.equal(h.interaction.performTextAction('field',{kind:'set-selection',anchor:2,focus:2}),false,'UTF-16 surrogate interiors are not selection endpoints');
    h.f.set(field(controller,focus,key,{enableInteractiveSelection:false}));assert.equal(h.interaction.performTextAction('field',{kind:'set-selection',anchor:0,focus:0}),false);
    h.f.set(field(controller,focus,key,{enabled:false}));assert.equal(h.interaction.performTextAction('field',{kind:'set-text',text:'blocked'}),false);assert.equal(h.interaction.performTextAction('field',{kind:'set-selection',anchor:0,focus:0}),false);
    h.f.set(field(controller,focus,key));const previous=h.f.root.nodes.find(node=>node.id==='field');
    h.f.set(field(replacement,focus,key));previous.textActions.setText('late');previous.textActions.setSelection({anchor:0,focus:0});assert.equal(replacement.text,'replacement');assert.equal(controller.text,'A😀B');
    const retired=h.f.root.nodes.find(node=>node.id==='field');h.f.set(new SizedBox());retired.textActions.setText('detached');assert.equal(replacement.text,'replacement');
  }finally{await h.close();controller.dispose();replacement.dispose();focus.dispose();}
});

test('global accessibility observers cannot apply an old edit over a reentrant controller command or a new source owner',{timeout},async()=>{
  const h=await setup(),controller=new TextEditingController('before'),replacement=new TextEditingController('new owner'),focus=new FocusNode(),key=new GlobalKey('reentrant semantics');let mode='command';
  try{
    h.f.set(field(controller,focus,key));const oldRevision=controller.revision;
    h.f.root.semanticsActionBinding.addSemanticsActionListener(()=>{if(mode==='command')controller.text='listener';else h.f.set(field(replacement,focus,new GlobalKey('replacement source')));});
    h.interaction.performTextAction('field',{kind:'set-text',text:'old action'},oldRevision);assert.equal(controller.text,'listener','The delegate checks its actual current revision even before the next frame');
    h.f.frame();assert.equal(h.interaction.performTextAction('field',{kind:'set-text',text:'old revision'},oldRevision),false);
    mode='replace';h.interaction.performTextAction('field',{kind:'set-text',text:'old source'});assert.equal(replacement.text,'new owner');assert.equal(controller.text,'listener');
  }finally{await h.close();controller.dispose();replacement.dispose();focus.dispose();}
});

test('native typed-action dispatch freezes payloads, executes once, and fences source lifetime, revision and late callbacks',{timeout},()=>{
  const interaction=new NativeInteraction({id:'typed-action-port',generation:1},{commands:true,semantics:'native-controls'}),calls=[];
  const node=(sourceNodeId=1,textInputRevision=1,value='A😀B',textInputGeneration=1)=>({id:'field',sourceNodeId,textInputRevision,textInputGeneration,value,role:'text-field',name:'Field',enabled:true,bounds:{x:0,y:0,width:100,height:50},textActions:{setText:text=>calls.push(text),setSelection:selection=>calls.push(selection)}});
  let perform,mode='twice',payload,original;
  const binding=interaction.semantics.bind([node()],{dispatchAction(){},dispatchTextAction(_id,action,callback){payload=action;perform=callback;if(mode==='twice'){original.text='mutated';callback();callback();}else if(mode==='source'){binding.update([node(2)]);callback();}else if(mode==='revision'){binding.update([node(1,2)]);callback();}else if(mode==='value'){binding.update([node(1,1,'other')]);callback();}else if(mode==='generation'){binding.update([node(1,1,'A😀B',2)]);callback();}}});
  try{
    original={kind:'set-text',text:'captured'};assert.equal(interaction.performTextAction('field',original,1),true);assert.deepEqual(calls,['captured']);assert(Object.isFrozen(payload));perform();assert.equal(calls.length,1);
    for(mode of ['source','revision','value','generation','late']){binding.update([node()]);assert.equal(interaction.performTextAction('field',{kind:'set-text',text:'rejected'},1),false);perform();assert.equal(calls.length,1);}
    binding.update([node()]);for(const text of ['x\0y','\ud800','x'.repeat(4097)])assert.equal(interaction.performTextAction('field',{kind:'set-text',text},1,1),false);
    assert.equal(interaction.performTextAction('field',{kind:'set-text',text:'old owner'},1,2),false);
    binding.dispose();perform();assert.equal(calls.length,1);
  }finally{interaction.dispose();}
});

test('a new controller with the same text and revision still retires accessibility requests from the old editing owner',{timeout},async()=>{
  const h=await setup(),controller=new TextEditingController('same'),replacement=new TextEditingController('same'),focus=new FocusNode(),key=new GlobalKey('same revision');
  try{
    h.f.set(field(controller,focus,key));const old=h.f.root.nodes.find(node=>node.id==='field');
    h.f.set(field(replacement,focus,key));const current=h.f.root.nodes.find(node=>node.id==='field');assert.equal(current.sourceNodeId,old.sourceNodeId);assert.equal(current.textInputRevision,old.textInputRevision);assert.notEqual(current.textInputGeneration,old.textInputGeneration);
    assert.equal(h.interaction.performTextAction('field',{kind:'set-text',text:'late'},old.textInputRevision,old.textInputGeneration),false);assert.equal(replacement.text,'same');
    assert.equal(h.interaction.performTextAction('field',{kind:'set-text',text:'current'},current.textInputRevision,current.textInputGeneration),true);assert.equal(replacement.text,'current');
  }finally{await h.close();controller.dispose();replacement.dispose();focus.dispose();}
});

test('accessibility navigation comes from the painted Core paragraph, stays immutable across selection frames, and is withheld for passwords',{timeout},async()=>{
  const h=await setup(),text='A😀 e\u0301 אבג long wrapped text for Core\n한 글\n',controller=new TextEditingController(text),focus=new FocusNode(),key=new GlobalKey('navigation semantics');
  const renderOf=element=>{if(element.renderObject instanceof RenderEditable)return element.renderObject;let result;element.visitChildren(child=>{result??=renderOf(child);});return result;};
  try{
    h.f.set(field(controller,focus,key,{maxLines:null}));const render=renderOf(h.f.root.root),node=h.f.root.nodes.find(node=>node.id==='field'),navigation=node.textNavigation;
    assert(navigation);assert(node.textInputGeometry);assert.deepEqual(navigation.characters,graphemeBoundaries(text));
    assert(Object.isFrozen(navigation)&&Object.isFrozen(navigation.characters)&&Object.isFrozen(navigation.words)&&Object.isFrozen(navigation.lines));
    for(const offset of [1,text.indexOf('אבג')+1,text.indexOf('한')]){const word=render.getWordBoundary(new TextPosition({offset})),line=render.getLineBoundary(new TextPosition({offset}));assert(navigation.words.includes(word.start)&&navigation.words.includes(word.end),'Word stops retain actual backend Unicode boundaries');assert(navigation.lines.includes(line.start),'Line stops retain actual wrapped paragraph starts');}
    assert(navigation.lines.length>3,'Soft wraps and hard line breaks both belong to the actual paragraph');
    controller.selection={anchor:1,focus:3};h.f.frame();assert.equal(h.f.root.nodes.find(node=>node.id==='field').textNavigation,navigation,'A selection frame retains immutable paragraph navigation rather than repartitioning the text');
    controller.text='changed 한글';h.f.frame();assert.notEqual(h.f.root.nodes.find(node=>node.id==='field').textNavigation,navigation);
    h.f.set(field(controller,focus,key,{configuration:{obscureText:true}}));const password=h.f.root.nodes.find(node=>node.id==='field');assert.equal(password.textNavigation,undefined);assert.equal(render.coreTextNavigation,null,'Password internals do not publish grapheme or word tables');
  }finally{await h.close();controller.dispose();focus.dispose();}
});

test('semantics navigation copies mutable public tables and rejects scalar interiors, wrong document bounds and password metadata',{timeout},()=>{
  const characters=[0,1,3,4],navigation=Object.freeze({characters}),node={id:'field',role:'text-field',name:'Core field',enabled:true,value:'A😀B',bounds:{x:0,y:0,width:100,height:30},textNavigation:navigation};
  const snapshot=freezeSemantics([node])[0];characters[1]=2;
  assert.deepEqual(snapshot.textNavigation.characters,[0,1,3,4]);assert.throws(()=>freezeSemantics([node]),/surrogate/,'Freezing the outer object does not make its mutable stop table trusted');
  assert.throws(()=>freezeSemantics([{...node,textNavigation:{characters:[0,1,3]}}]),/complete UTF-16 document/);
  assert.throws(()=>freezeSemantics([{...node,obscured:true,textNavigation:snapshot.textNavigation}]),/unobscured/);
});

test('Core publishes a backend query ticket with the exact painted paragraph resource and scroll/alignment origin',{timeout},async()=>{
  const h=await setup(),controller=new TextEditingController('A😀 and a long painted Core paragraph for horizontal scroll'),focus=new FocusNode(),key=new GlobalKey('native paragraph reference'),seen=[];
  h.f.root.context.text.nativeQueryReference=layout=>{seen.push(layout);return {protocol:'native-paragraph-v1',token:73};};
  try{
    let commands=h.f.set(field(controller,focus,key)),node=h.f.root.nodes.find(value=>value.id==='field'),paragraph=commands.find(command=>command.op==='paragraph');
    assert(paragraph);assert(node.textInputGeometry);assert.equal(node.textParagraph.reference.token,73);assert.deepEqual(node.textParagraph.resource,paragraph.resource);assert.equal(seen.at(-1).resource.id,node.textParagraph.resource.id);assert.deepEqual(node.textParagraph.paintOffset,{x:paragraph.x,y:paragraph.y});
    assert(Object.isFrozen(node.textParagraph)&&Object.isFrozen(node.textParagraph.resource)&&Object.isFrozen(node.textParagraph.reference)&&Object.isFrozen(node.textParagraph.paintOffset));
    focus.requestFocus();h.f.root.buildOwner.focus.applyFocusChangesIfNeeded();h.f.frame();commands=h.f.frame();node=h.f.root.nodes.find(value=>value.id==='field');paragraph=commands.find(command=>command.op==='paragraph');assert.deepEqual(node.textParagraph.paintOffset,{x:paragraph.x,y:paragraph.y});assert(node.textParagraph.paintOffset.x<0,'The query origin follows actual Core paragraph scrolling');
    assert.throws(()=>freezeSemantics([{...node,textInputGeometry:undefined}]),/requires current unobscured/);
    assert.throws(()=>freezeSemantics([{...node,textParagraph:{...node.textParagraph,reference:{protocol:'native-paragraph-v1',token:0}}}]),/Invalid Core paragraph/);
    const reads=seen.length;h.f.set(field(controller,focus,key,{configuration:{obscureText:true}}));assert.equal(h.f.root.nodes.find(value=>value.id==='field').textParagraph,undefined);assert.equal(seen.length,reads,'Password layout never requests a native observation ticket');
  }finally{await h.close();controller.dispose();focus.dispose();}
});
