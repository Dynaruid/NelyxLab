// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {EditableText,TextEditingController} from '@nelyx/core/framework/widgets/editable-text';
import {SelectionChangedCause as Cause,TextEditingValue} from '@nelyx/core/services/text-input';
import {TextSelection} from '@nelyx/core/services/text-editing';
import {TextRange} from '@nelyx/core/ui/text-range';
import {TextInputFormatter,PredicateTextInputFormatter} from '@nelyx/core/services/input-formatters';
import {GlobalKey} from '@nelyx/core/framework/widgets/global-key';
import {FocusNode} from '@nelyx/core/framework/widgets/focus';
import {Directionality,MediaQuery} from '@nelyx/core/framework/widgets/app-data';
import {Center,SizedBox} from '@nelyx/core/framework/widgets/basic';
import {TextField} from '@nelyx/material/text-field';
import {CupertinoTextField} from '@nelyx/cupertino/text-field';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {BinaryMessenger} from '@nelyx/core/services/binary-messenger';
import {JSONMethodCodec} from '@nelyx/core/services/message-codecs';
import {EditingSession} from '@nelyx/core/ui/editing';
import {engineFixture} from '../../../packages/material/tests/engine-fixture.mjs';

const timeout=1_200_000;
const value=(text,anchor,focus=anchor)=>new TextEditingValue({text,selection:new TextSelection({baseOffset:anchor,extentOffset:focus})});
class ClipboardHost extends BinaryMessenger {
  codec=new JSONMethodCodec();text='paste';writes=[];finishRead;finishWrite;deferRead=false;deferWrite=false;
  send(channel,message){
    assert.equal(channel,'flutter/platform');const call=this.codec.decodeMethodCall(message),success=data=>this.codec.encodeSuccessEnvelope(data);
    if(call.method==='Clipboard.setData'){this.writes.push(call.arguments.get('text'));this.text=this.writes.at(-1);return this.deferWrite?new Promise(resolve=>{this.finishWrite=()=>resolve(success(null));}):Promise.resolve(success(null));}
    if(call.method==='Clipboard.getData')return this.deferRead?new Promise(resolve=>{this.finishRead=()=>resolve(success(this.text===null?null:new Map([['text',this.text]])));}):Promise.resolve(success(this.text===null?null:new Map([['text',this.text]])));
    if(call.method==='Clipboard.hasStrings')return Promise.resolve(success(new Map([['value',!!this.text?.length]])));
    throw new Error('Unexpected platform method '+call.method);
  }
  setMessageHandler(){}
  async handlePlatformMessage(_channel,_message,callback){callback?.(null);}
}
function input(f){
  const records=[];f.root.context.editing={capabilities:{indexUnit:'utf16',composing:'observed',selectionDirection:'observed'},bind(owner,initial,changed,options){
    const session=new EditingSession(owner,initial),pending=[],publish=(content,source='programmatic')=>{session.update({...session.value,...content,source,revision:session.value.revision+1});changed(session.value);};
    const focusRequests=[],replacements=[],record={pending,focusRequests,replacements,native:content=>publish(content,'native'),ack:()=>{assert(pending.length);publish(pending.shift());}};records.push(record);
    return {read:()=>session.value,get isComposing(){return session.value.composing.status==='active';},replace:content=>{replacements.push(content);publish(content);},replaceComposing:content=>pending.push(content),focus(request){focusRequests.push(request);options.focusChanged?.(true);},blur(){options.focusChanged?.(false);},dispose(){session.dispose();}};
  }};return records;
}
const field=(controller,focus,key,options={})=>new Center(new SizedBox(220,50,new EditableText('field',controller,'Delegate',focus,50,key,options)));
const wrapped=child=>new MediaQuery({width:240,height:160,scale:1,textScale:1,safeArea:{left:0,top:0,right:0,bottom:0},keyboardInset:0},new Directionality('ltr',new Center(new SizedBox(220,60,child))));
const find=(element,predicate)=>{if(predicate(element))return element;let result;element.visitChildren(child=>{result??=find(child,predicate);});return result;};

test('public user values format text once, carry selection cause and preserve focus for keyboard edits',{timeout},async()=>{
  FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});const f=await engineFixture({fonts:true}),controller=new TextEditingController('old'),focus=new FocusNode(),key=new GlobalKey('delegate'),events=[],calls=[];input(f);
  class Upper extends TextInputFormatter{formatEditUpdate(old,next){calls.push([old.text,next.text]);return {...next,text:next.text.toUpperCase()};}}
  try{
    f.set(field(controller,focus,key,{inputFormatters:[new Upper()],onSelectionChanged:(selection,cause)=>events.push(['selection',selection.extentOffset,cause]),onChanged:text=>events.push(['text',text])}));
    key.currentState.userUpdateTextEditingValue(value('new',3),Cause.keyboard);assert.equal(controller.text,'NEW');assert.deepEqual(calls,[['old','new']]);assert.deepEqual(events,[['selection',3,Cause.keyboard],['text','NEW']]);assert.equal(focus.hasFocus,false,'Keyboard-origin changes do not create another focus owner');
    events.length=0;key.currentState.userUpdateTextEditingValue(value('NEW',1),Cause.toolbar);f.root.buildOwner.focus.applyFocusChangesIfNeeded();assert(focus.hasPrimaryFocus);assert.equal(calls.length,1,'Selection-only values do not run text formatters');assert.deepEqual(events,[['selection',1,Cause.toolbar]]);
    key.currentState.userUpdateTextEditingValue(new TextEditingValue({text:'NEW',selection:new TextSelection({baseOffset:1,extentOffset:1,affinity:'upstream',isDirectional:true})}),Cause.keyboard);assert.equal(key.currentState.textEditingValue.selection.isDirectional,true);assert.equal(key.currentState.textEditingValue.selection.affinity,'upstream');
    focus.unfocus();f.root.buildOwner.focus.applyFocusChangesIfNeeded();key.currentState.userUpdateTextEditingValue(key.currentState.textEditingValue,null);f.root.buildOwner.focus.applyFocusChangesIfNeeded();assert(focus.hasPrimaryFocus,'An equal public value can still focus an unfocused editor');
  }finally{await f.close();controller.dispose();focus.dispose();}
});

test('cut applies the Core edit before clipboard completion and keyboard copy retains its selection',{timeout},async()=>{
  FoundationPlatform.configure({kind:'web',operatingSystem:'android'});const clipboard=new ClipboardHost(),f=await engineFixture({fonts:true,binaryMessenger:clipboard}),controller=new TextEditingController('ABCDE'),focus=new FocusNode(),key=new GlobalKey('cut'),changes=[],records=input(f);
  try{
    f.set(field(controller,focus,key,{onChanged:text=>changes.push(text)}));controller.selection={anchor:1,focus:4};clipboard.deferWrite=true;key.currentState.cutSelection(Cause.keyboard);
    assert.equal(controller.text,'AE');assert.deepEqual(changes,['AE']);assert.deepEqual(clipboard.writes,['BCD']);assert(clipboard.finishWrite);clipboard.finishWrite();await Promise.resolve();
    clipboard.deferWrite=false;controller.text='ABCDE';controller.selection={anchor:4,focus:1};key.currentState.copySelection(Cause.keyboard);assert.deepEqual(controller.selection,{anchor:4,focus:1});assert.equal(clipboard.writes.at(-1),'BCD');
    key.currentState.copySelection(Cause.toolbar);assert.deepEqual(controller.selection,{anchor:4,focus:4},'Android toolbar Copy collapses at the logical selection end');
    records[0].native({text:'ABCDE',selection:{anchor:4,focus:1},composing:{status:'active',start:1,end:4}});key.currentState.copySelection(Cause.toolbar);assert.deepEqual(controller.selection,{anchor:4,focus:4});assert.deepEqual(controller.value.composing,{status:'active',start:1,end:4});assert.equal(records[0].pending.length,0,'Toolbar Copy collapses the selection without cancelling its OS composition');
  }finally{clipboard.finishWrite?.();await f.close();controller.dispose();focus.dispose();}
});

test('paste reads the live same-editor document and selection while rejecting a replaced logical owner',{timeout},async()=>{
  FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});const clipboard=new ClipboardHost(),f=await engineFixture({fonts:true,binaryMessenger:clipboard}),controller=new TextEditingController('old'),replacement=new TextEditingController('replacement'),focus=new FocusNode(),key=new GlobalKey('paste');input(f);clipboard.deferRead=true;
  try{
    f.set(field(controller,focus,key));const state=key.currentState,paste=state.pasteText(Cause.keyboard);await Promise.resolve();assert(clipboard.finishRead);controller.text='LIVE';controller.selection={anchor:3,focus:1};clipboard.text='X';clipboard.finishRead();await paste;assert.equal(controller.text,'LXE');
    const retired=state.pasteText(Cause.keyboard);await Promise.resolve();f.set(field(replacement,focus,key));assert.equal(key.currentState,state);clipboard.text='must not apply';clipboard.finishRead();await retired;assert.equal(replacement.text,'replacement');
  }finally{clipboard.finishRead?.();await f.close();controller.dispose();replacement.dispose();focus.dispose();}
});

test('a public replacement waits for actual composition cancellation and does not manufacture active ranges',{timeout},async()=>{
  FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});const f=await engineFixture({fonts:true}),controller=new TextEditingController('before'),focus=new FocusNode(),key=new GlobalKey('composition'),changes=[],records=input(f);
  try{
    f.set(field(controller,focus,key,{onChanged:text=>changes.push(text)}));focus.requestFocus();f.root.buildOwner.focus.applyFocusChangesIfNeeded();records[0].native({text:'한',selection:{anchor:1,focus:1},composing:{status:'active',start:0,end:1}});changes.length=0;
    f.root.buildOwner.focus.runWithFocusRequest({inputTimestamp:211},()=>key.currentState.userUpdateTextEditingValue(value('after',5),Cause.toolbar));assert.equal(controller.text,'한');assert(controller.isComposing);assert.deepEqual(changes,[]);assert.equal(records[0].pending.length,1);
    records[0].ack();assert.equal(controller.text,'after');assert.equal(controller.isComposing,false);assert.deepEqual(changes,['after']);assert.deepEqual(records[0].focusRequests.at(-1),{inputTimestamp:211},'A delayed genuine cancellation preserves the originating focus request');
    assert.throws(()=>key.currentState.userUpdateTextEditingValue(new TextEditingValue({text:'after',selection:TextSelection.collapsed(1),composing:new TextRange({start:0,end:2})}),Cause.keyboard),/must retain its observed text and composing range/);assert.equal(controller.text,'after');
  }finally{await f.close();controller.dispose();focus.dispose();}
});

test('a predicate rejecting a public replacement retains its text while actual OS cancellation completes',{timeout},async()=>{
  FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});const f=await engineFixture({fonts:true}),controller=new TextEditingController('before'),focus=new FocusNode(),key=new GlobalKey('predicate cancellation'),records=input(f),changes=[];
  try{
    f.set(field(controller,focus,key,{inputFormatters:[new PredicateTextInputFormatter(text=>text!=='bad')],onChanged:text=>changes.push(text)}));records[0].native({text:'한',selection:{anchor:1,focus:1},composing:{status:'active',start:0,end:1}});changes.length=0;key.currentState.userUpdateTextEditingValue(value('bad',3),Cause.keyboard);
    assert.equal(controller.text,'한');assert.equal(controller.isComposing,true);assert.equal(records[0].pending.length,1);assert.equal(records[0].pending[0].text,'한');records[0].ack();assert.equal(controller.text,'한');assert.equal(controller.isComposing,false);assert.deepEqual(changes,[],'Rejecting text does not become an unformatted user edit or an invented active range');
  }finally{await f.close();controller.dispose();focus.dispose();}
});

test('a public selection change preserves the observed active composition through the existing OS synchronization queue',{timeout},async()=>{
  FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});const f=await engineFixture({fonts:true}),controller=new TextEditingController('before'),focus=new FocusNode(),key=new GlobalKey('selection in composition'),records=input(f),selected=[];
  try{
    f.set(field(controller,focus,key,{onSelectionChanged:(selection,cause)=>selected.push([selection.extentOffset,cause])}));records[0].native({text:'한A',selection:{anchor:1,focus:1},composing:{status:'active',start:0,end:1}});
    selected.length=0;const composing=key.currentState.textEditingValue.composing;key.currentState.userUpdateTextEditingValue(key.currentState.textEditingValue.copyWith({selection:TextSelection.collapsed(0)}),Cause.drag);
    assert.equal(controller.text,'한A');assert.deepEqual(controller.selection,{anchor:0,focus:0});assert.equal(controller.isComposing,true);assert.equal(key.currentState.textEditingValue.composing.equals(composing),true);assert.equal(records[0].pending.length,0,'Selection does not issue a composition cancellation');assert.equal(records[0].replacements.at(-1).composing.status,'active');assert.deepEqual(selected,[[0,Cause.drag]]);
    records[0].native({text:'한A',selection:{anchor:0,focus:0},composing:{status:'none'}});assert.equal(controller.isComposing,false,'Only the actual native finish ends composition');
  }finally{await f.close();controller.dispose();focus.dispose();}
});

test('real pointer selection during OS composition reports its cause without clearing the native range',{timeout},async()=>{
  FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});const f=await engineFixture({fonts:true}),controller=new TextEditingController('before'),focus=new FocusNode(),key=new GlobalKey('pointer composition'),records=input(f),selected=[];
  try{
    f.set(field(controller,focus,key,{onSelectionChanged:(selection,cause)=>selected.push([selection.extentOffset,cause])}));records[0].native({text:'한A',selection:{anchor:0,focus:0},composing:{status:'active',start:0,end:1}});f.frame();selected.length=0;
    const bounds=f.root.nodes.find(node=>node.id==='field').bounds;for(const [kind,timestamp]of [['down',311],['up',333]])f.root.pointer({kind,pointer:1,device:'mouse',buttons:kind==='up'?0:1,x:bounds.x+bounds.width-5,y:bounds.y+bounds.height/2,timestamp,viewportGeneration:1});f.root.buildOwner.focus.applyFocusChangesIfNeeded();
    assert.equal(controller.selection.focus,2);assert.equal(controller.isComposing,true);assert.deepEqual(controller.value.composing,{status:'active',start:0,end:1});assert.deepEqual(selected,[[2,Cause.tap]]);assert.equal(records[0].pending.length,0);assert.deepEqual(records[0].focusRequests.at(-1),{inputTimestamp:333});
    selected.length=0;records[0].native({text:'한A',selection:{anchor:1,focus:0},composing:{status:'active',start:0,end:1}});assert.deepEqual(selected,[[0,Cause.keyboard]],'A native selection update reports once without another focus request');
  }finally{await f.close();controller.dispose();focus.dispose();}
});

test('a native selection callback can replace the document without an older native text notification',{timeout},async()=>{
  FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});const f=await engineFixture({fonts:true}),controller=new TextEditingController('old'),focus=new FocusNode(),key=new GlobalKey('reentrant native'),changes=[],records=input(f);
  try{
    f.set(field(controller,focus,key,{onSelectionChanged:()=>{controller.text='observer';},onChanged:text=>changes.push(text)}));records[0].native({text:'native',selection:{anchor:2,focus:2},composing:{status:'none'}});assert.equal(controller.text,'observer');assert.deepEqual(changes,[]);
  }finally{await f.close();controller.dispose();focus.dispose();}
});

test('a held pointer can extend selection more than once without ending the observed composition',{timeout},async()=>{
  FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});const f=await engineFixture({fonts:true}),controller=new TextEditingController('before'),focus=new FocusNode(),key=new GlobalKey('composition drag'),records=input(f);
  try{
    f.set(field(controller,focus,key));records[0].native({text:'한ABCDEFGHIJKLM',selection:{anchor:0,focus:0},composing:{status:'active',start:0,end:14}});f.frame();const bounds=f.root.nodes.find(node=>node.id==='field').bounds;
    const pointer=(kind,x,timestamp)=>{f.root.pointer({kind,pointer:1,device:'mouse',buttons:kind==='up'?0:1,x:bounds.x+x,y:bounds.y+bounds.height/2,timestamp,viewportGeneration:1});f.root.buildOwner.focus.applyFocusChangesIfNeeded();f.frame();};
    pointer('down',1,400);pointer('move',60,420);const first=controller.selection.focus;pointer('move',130,440);assert(controller.selection.focus>first,'The second real pointer move extends the same selection');assert.equal(controller.selection.anchor,0);assert.deepEqual(controller.value.composing,{status:'active',start:0,end:14});assert.equal(records[0].pending.length,0);pointer('up',130,460);
  }finally{await f.close();controller.dispose();focus.dispose();}
});

test('a reentrant selection callback cannot make the older value notify or overwrite a newer controller edit',{timeout},async()=>{
  FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});const f=await engineFixture({fonts:true}),controller=new TextEditingController('old'),focus=new FocusNode(),key=new GlobalKey('reentrant delegate'),changes=[];input(f);
  try{
    f.set(field(controller,focus,key,{onSelectionChanged:()=>{controller.text='observer';},onChanged:text=>changes.push(text)}));key.currentState.userUpdateTextEditingValue(value('intent',2),Cause.keyboard);assert.equal(controller.text,'observer');assert.deepEqual(changes,[],'The newer observer command retires the older user callback');
  }finally{await f.close();controller.dispose();focus.dispose();}
});

test('interactive-selection defaults follow each design and disabled affordances preserve Core values and focus',{timeout},async()=>{
  FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});const f=await engineFixture({fonts:true}),controller=new TextEditingController('value'),focus=new FocusNode();input(f);
  try{
    for(const Type of [TextField,CupertinoTextField]){
      const widget=new Type({id:'field',controller,focusNode:focus,readOnly:true,obscureText:true});assert.equal(widget.selectionEnabled,false);f.set(wrapped(widget));let state=find(f.root.root,e=>e.widget instanceof EditableText).stateObject;assert.equal(state.widget.selectionEnabled,false);assert.deepEqual(state.contextMenuButtonItems,[]);assert.equal(state.showToolbar(),false);
      f.set(wrapped(new Type({id:'field',controller,focusNode:focus,enableInteractiveSelection:false})));state=find(f.root.root,e=>e.widget instanceof EditableText).stateObject;controller.selection={anchor:1,focus:1};const bounds=f.root.nodes.find(node=>node.id==='field').bounds;for(const [kind,timestamp]of [['down',100],['up',120]])f.root.pointer({kind,pointer:1,device:'mouse',buttons:kind==='up'?0:1,x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2,timestamp,viewportGeneration:1});f.root.buildOwner.focus.applyFocusChangesIfNeeded();assert(focus.hasPrimaryFocus);assert.deepEqual(controller.selection,{anchor:1,focus:1},'A disabled selection tap requests keyboard focus without moving the caret');
      f.set(new SizedBox());
    }
  }finally{await f.close();controller.dispose();focus.dispose();}
});
