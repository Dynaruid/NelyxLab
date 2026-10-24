// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {EditableText,TextEditingController} from '@nelyx/core/framework/widgets/editable-text';
import {Action,Actions,Intent,CallbackAction} from '@nelyx/core/framework/widgets/actions';
import {Shortcuts,SingleActivator} from '@nelyx/core/framework/widgets/shortcuts';
import {DefaultTextEditingShortcuts} from '@nelyx/core/framework/widgets/default-text-editing-shortcuts';
import * as intents from '@nelyx/core/framework/widgets/text-editing-intents';
import {ScrollIntent,ScrollIncrementType} from '@nelyx/core/framework/widgets/scrollable-helpers';
import {AxisDirection} from '@nelyx/core/framework/painting/basic-types';
import {FocusNode} from '@nelyx/core/framework/widgets/focus';
import {Focus} from '@nelyx/core/framework/widgets/focus-scope';
import {AppFocus} from '@nelyx/core/framework/widgets/app-focus';
import {DirectionalFocusIntent} from '@nelyx/core/framework/widgets/focus-traversal';
import {Directionality} from '@nelyx/core/framework/widgets/app-data';
import {Center,SizedBox,Column} from '@nelyx/core/framework/widgets/basic';
import {GlobalKey} from '@nelyx/core/framework/widgets/global-key';
import {LogicalKeyboardKey} from '@nelyx/core/services/keyboard-key';
import {TextSelection} from '@nelyx/core/services/text-editing';
import {SelectionChangedCause,TextEditingValue} from '@nelyx/core/services/text-input';
import {TextRange} from '@nelyx/core/ui/text-range';
import {EditingSession} from '@nelyx/core/ui/editing';
import {TextStyle} from '@nelyx/core/framework/painting/text-style';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {engineFixture} from '../../../packages/material/tests/engine-fixture.mjs';

const timeout=1_200_000;
function host(f,focused=()=>{}){f.root.context.editing={capabilities:{indexUnit:'utf16',composing:'observed',selectionDirection:'observed'},bind(owner,initial,changed,options){const session=new EditingSession(owner,initial);const replace=value=>{session.update({...value,source:'programmatic',revision:session.value.revision+1});changed(session.value);};return {read:()=>session.value,get isComposing(){return session.value.composing.status==='active';},replace,replaceComposing:replace,focus(request){focused(request);options.focusChanged?.(true);},blur(){options.focusChanged?.(false);},dispose(){session.dispose();}};}};}
function press(f,key,extra={}){let result;for(const kind of ['down','up']){const value=f.root.key({kind,key,shift:false,control:false,alt:false,meta:false,repeat:false,...extra});if(kind==='down')result=value;}f.frame();return result;}
const cause=SelectionChangedCause.keyboard;
const field=(controller,focus,key,options={})=>new Center(new SizedBox(180,90,new EditableText('field',controller,'Action editor',focus,90,key,{minHeight:0,maxLines:null,textStyle:new TextStyle({fontSize:20,height:1.5}),...options})));

test('pointer focus retains its originating time through deferred application and native reconnection',{timeout},async()=>{
  FoundationPlatform.configure({kind:'native',operatingSystem:'android'});const f=await engineFixture({fonts:true}),controller=new TextEditingController('value'),focus=new FocusNode(),key=new GlobalKey('input ordering'),requests=[];host(f,request=>requests.push(request));
  try{
    f.set(field(controller,focus,key,{maxLines:1}));
    for(const [kind,timestamp]of [['down',137],['up',149]])f.root.pointer({kind,pointer:1,device:'touch',buttons:kind==='up'?0:1,x:160,y:120,timestamp,viewportGeneration:0});
    f.root.buildOwner.focus.applyFocusChangesIfNeeded();f.frame();assert(focus.hasPrimaryFocus);assert.deepEqual(requests.at(-1),{inputTimestamp:149});assert.equal(f.root.buildOwner.focus.currentFocusRequest,undefined,'Callback metadata cannot leak into later programmatic focus');
    f.set(field(controller,focus,key,{maxLines:1,configuration:{obscureText:true}}));f.frame();assert.deepEqual(requests.at(-1),{inputTimestamp:149,restore:true},'Reconfiguration preserves the old input intent rather than creating a fresh show');
    key.currentState.requestKeyboard();assert.equal(requests.at(-1),undefined,'The public explicit request remains able to reopen a focused editor');
  }finally{await f.close();controller.dispose();focus.dispose();}
});

test('a deferred autofocus cannot focus a replacement logical editor in the same State',{timeout},async()=>{
  FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});const f=await engineFixture({fonts:true}),controller=new TextEditingController('old'),replacement=new TextEditingController('new'),focus=new FocusNode(),nextFocus=new FocusNode(),key=new GlobalKey('pending autofocus');host(f);
  const owner=f.root.buildOwner,postFrame=owner.postFrame,pending=[];
  try{
    owner.postFrame=callback=>pending.push(callback);f.set(field(controller,focus,key,{maxLines:1,autofocus:true}));assert(pending.length>0);const state=key.currentState;
    f.set(field(replacement,nextFocus,key,{maxLines:1,autofocus:false}));assert.equal(key.currentState,state);for(const callback of pending.splice(0))callback();owner.focus.applyFocusChangesIfNeeded();f.frame();
    assert.equal(nextFocus.hasPrimaryFocus,false,'Autofocus belongs to the original logical editor, not whichever widget later occupies its State');
  }finally{owner.postFrame=postFrame;await f.close();controller.dispose();replacement.dispose();focus.dispose();nextFocus.dispose();}
});

test('editor autofocus respects an explicit focus decision made before its deferred callback',{timeout},async()=>{
  FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});const f=await engineFixture({fonts:true}),controller=new TextEditingController('auto'),focus=new FocusNode(),other=new FocusNode(),key=new GlobalKey('scope autofocus');host(f);
  const owner=f.root.buildOwner,postFrame=owner.postFrame,pending=[];
  try{
    owner.postFrame=callback=>pending.push(callback);f.set(new Column([new SizedBox(180,40,new EditableText('field',controller,'Auto',focus,40,key,{autofocus:true})),new Focus(new SizedBox(180,20),{focusNode:other})]));other.requestFocus();
    for(const callback of pending.splice(0))callback();owner.focus.applyFocusChangesIfNeeded();f.frame();assert.equal(other.hasPrimaryFocus,true,'Autofocus may only choose a field in an otherwise unfocused scope');
  }finally{owner.postFrame=postFrame;await f.close();controller.dispose();focus.dispose();other.dispose();}
});

test('a newer explicit keyboard request retires an older deferred reconfiguration restoration',{timeout},async()=>{
  FoundationPlatform.configure({kind:'native',operatingSystem:'android'});const f=await engineFixture({fonts:true}),controller=new TextEditingController('value'),focus=new FocusNode(),key=new GlobalKey('new keyboard intent'),requests=[];host(f,request=>requests.push(request));
  const owner=f.root.buildOwner,postFrame=owner.postFrame,pending=[];
  try{
    f.set(field(controller,focus,key,{maxLines:1}));focus.requestFocus();owner.focus.applyFocusChangesIfNeeded();f.frame();owner.postFrame=callback=>pending.push(callback);
    f.set(field(controller,focus,key,{maxLines:1,configuration:{obscureText:true}}));
    for(const [kind,timestamp]of [['down',337],['up',349]])f.root.pointer({kind,pointer:1,device:'touch',buttons:kind==='up'?0:1,x:160,y:120,timestamp,viewportGeneration:1});
    assert.deepEqual(requests.at(-1),{inputTimestamp:349});const sent=requests.length;
    for(const callback of pending.splice(0))callback();owner.focus.applyFocusChangesIfNeeded();f.frame();assert.equal(requests.length,sent,'An older restoration cannot replace the newer keyboard intent retained for a native carrier');assert.deepEqual(requests.at(-1),{inputTimestamp:349});
  }finally{owner.postFrame=postFrame;await f.close();controller.dispose();focus.dispose();}
});

test('reconfiguration cannot overwrite a newer focus request still awaiting its microtask',{timeout},async()=>{
  FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});const f=await engineFixture({fonts:true}),controller=new TextEditingController('value'),focus=new FocusNode(),other=new FocusNode(),key=new GlobalKey('pending explicit focus');host(f);
  const owner=f.root.buildOwner,postFrame=owner.postFrame,pending=[],scene=obscure=>new Column([new SizedBox(180,40,new EditableText('field',controller,'Message',focus,40,key,{configuration:{obscureText:obscure}})),new Focus(new SizedBox(180,20),{focusNode:other})]);
  try{
    f.set(scene(false));focus.requestFocus();owner.focus.applyFocusChangesIfNeeded();f.frame();owner.postFrame=callback=>pending.push(callback);f.set(scene(true));other.requestFocus();
    for(const callback of pending.splice(0))callback();owner.focus.applyFocusChangesIfNeeded();f.frame();assert.equal(other.hasPrimaryFocus,true,'Pending explicit focus wins before any automatic input-restoration callback can issue native focus');
  }finally{owner.postFrame=postFrame;await f.close();controller.dispose();focus.dispose();other.dispose();}
});

test('a delayed reconfiguration focus callback cannot focus a replacement logical editor',{timeout},async()=>{
  FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});const f=await engineFixture({fonts:true}),controller=new TextEditingController('old'),replacement=new TextEditingController('new'),focus=new FocusNode(),nextFocus=new FocusNode(),key=new GlobalKey('pending reconnect focus');host(f);
  const owner=f.root.buildOwner,postFrame=owner.postFrame,pending=[];
  try{
    f.set(field(controller,focus,key,{maxLines:1}));focus.requestFocus();owner.focus.applyFocusChangesIfNeeded();f.frame();const state=key.currentState;assert(focus.hasPrimaryFocus);
    owner.postFrame=callback=>pending.push(callback);
    f.set(field(controller,focus,key,{maxLines:1,configuration:{obscureText:true}}));assert(pending.length>0);
    f.set(field(replacement,nextFocus,key,{maxLines:1}));assert.equal(key.currentState,state);assert.equal(nextFocus.hasPrimaryFocus,false);
    for(const callback of pending.splice(0))callback();owner.focus.applyFocusChangesIfNeeded();f.frame();
    assert.equal(nextFocus.hasPrimaryFocus,false,'The old native reconfiguration must not request focus for its replacement');
  }finally{owner.postFrame=postFrame;await f.close();controller.dispose();replacement.dispose();focus.dispose();nextFocus.dispose();}
});

test('a delayed reconfiguration cannot reclaim a borrowed FocusNode after the caller unfocuses it',{timeout},async()=>{
  FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});const f=await engineFixture({fonts:true}),controller=new TextEditingController('value'),focus=new FocusNode(),key=new GlobalKey('cancelled focus restoration');host(f);
  const owner=f.root.buildOwner,postFrame=owner.postFrame,pending=[];
  try{
    f.set(field(controller,focus,key,{maxLines:1}));focus.requestFocus();owner.focus.applyFocusChangesIfNeeded();f.frame();owner.postFrame=callback=>pending.push(callback);
    f.set(field(controller,focus,key,{maxLines:1,configuration:{obscureText:true}}));focus.unfocus();owner.focus.applyFocusChangesIfNeeded();
    for(const callback of pending.splice(0))callback();owner.focus.applyFocusChangesIfNeeded();f.frame();assert.equal(focus.hasPrimaryFocus,false,'A newer explicit focus decision retires automatic restoration');
  }finally{owner.postFrame=postFrame;await f.close();controller.dispose();focus.dispose();}
});

test('application editing shortcuts handle arrows before directional traversal and preserve nearer custom shortcuts',{timeout},async()=>{
  FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});
  const f=await engineFixture({fonts:true}),controller=new TextEditingController('e\u0301🇰🇷x'),focus=new FocusNode(),other=new FocusNode(),key=new GlobalKey('app editing');host(f);
  class CustomArrow extends Intent{}
  const render=custom=>new Directionality('ltr',new AppFocus(new Actions({actions:new Map([[CustomArrow,new CallbackAction(CustomArrow,()=>controller.selection={anchor:0,focus:0})]]),child:new Shortcuts({shortcuts:custom?new Map([[new SingleActivator(LogicalKeyboardKey.arrowRight),new CustomArrow()]]):new Map(),child:new Column([field(controller,focus,key,{maxLines:1,configuration:{obscureText:true}}),new Focus(new SizedBox(180,20),{focusNode:other})])})})));
  try{
    f.set(render(false));focus.requestFocus();f.frame();press(f,'Home');press(f,'ArrowRight');
    assert.deepEqual(controller.selection,{anchor:2,focus:2},'The application arrow map must not move focus out of a secure editor');assert.equal(f.root.buildOwner.focus.primaryFocus,focus);
    press(f,'ArrowRight');assert.equal(controller.selection.focus,6);assert.equal(f.root.buildOwner.focus.primaryFocus,focus);
    Actions.invoke(focus.context,new DirectionalFocusIntent('down'));f.frame();assert.equal(f.root.buildOwner.focus.primaryFocus,focus,'The source text-field directional Action ignores its default intent');
    Actions.invoke(focus.context,new DirectionalFocusIntent('down',{ignoreTextFields:false}));f.root.buildOwner.focus.applyFocusChangesIfNeeded();f.frame();assert.equal(f.root.buildOwner.focus.primaryFocus,other,'An explicit directional traversal request remains available');focus.requestFocus();f.frame();
    press(f,'Tab');assert.equal(f.root.buildOwner.focus.primaryFocus,other,'Non-editing application traversal remains available');
    focus.requestFocus();f.frame();f.set(render(true));press(f,'ArrowRight');assert.equal(controller.selection.focus,0,'A nearer custom shortcut still overrides the application editing defaults');assert.equal(f.root.buildOwner.focus.primaryFocus,focus);
  }finally{await f.close();controller.dispose();focus.dispose();other.dispose();}
});

test('the actual editor focus exposes default Actions, supports callingAction and lets nearer shortcuts handle keys first',{timeout},async()=>{
  FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});
  const f=await engineFixture({fonts:true}),controller=new TextEditingController('abcd'),focus=new FocusNode(),key=new GlobalKey('action owner'),calls=[];host(f);
  class DeleteOverride extends Action{constructor(){super(intents.DeleteCharacterIntent);}invoke(intent){calls.push('override');assert(this.callingAction);return this.callingAction.invoke(intent);}}
  class RewriteIntent extends Intent{}
  class SubmitOverrideIntent extends Intent{}
  const custom=new Map([[new SingleActivator(LogicalKeyboardKey.keyA,{control:true}),new RewriteIntent()],[new SingleActivator(LogicalKeyboardKey.enter),new SubmitOverrideIntent()]]);
  const actions=new Map([[intents.DeleteCharacterIntent,new DeleteOverride()],[RewriteIntent,new CallbackAction(RewriteIntent,()=>{calls.push('shortcut');controller.text='custom';})],[SubmitOverrideIntent,new CallbackAction(SubmitOverrideIntent,()=>calls.push('custom-enter'))]]);
  let borrowed=0;const original=()=>{borrowed++;return 'ignored';};focus.onKeyEvent=original;
  try{
    f.set(new Actions({actions,child:new Shortcuts({shortcuts:custom,child:field(controller,focus,key,{onSubmitted:()=>calls.push('submit')})})}));focus.requestFocus();f.frame();
    assert(Actions.maybeFind(focus.context,new intents.DeleteCharacterIntent({forward:false})),'The real primary-focus context must be below the editor default Actions');
    let renderContext;const visit=element=>{if(element.renderObject===key.currentState.renderEditable)renderContext=element;element.visitChildren(visit);};visit(f.root.root);assert(renderContext);
    assert.equal(Focus.of(renderContext),focus,'Editor descendants inherit the actual editing focus owner');
    press(f,'Backspace');assert.equal(controller.text,'abc');assert.deepEqual(calls,['override']);
    press(f,'a',{control:true});assert.equal(controller.text,'custom');assert.deepEqual(calls,['override','shortcut']);
    press(f,'Enter');assert.deepEqual(calls,['override','shortcut','custom-enter']);assert(borrowed>0);
    f.set(new SizedBox());assert.equal(focus.onKeyEvent,original,'Borrowed handlers survive actual editor retirement');assert.equal(focus.attached,false);
  }finally{await f.close();controller.dispose();focus.dispose();}
});

test('public source editing intents use the current editor action context and grapheme transpose stays undoable',{timeout},async()=>{
  FoundationPlatform.configure({kind:'web',operatingSystem:'macOS'});
  const f=await engineFixture({fonts:true}),controller=new TextEditingController('A👩‍🚀e\u0301'),focus=new FocusNode(),key=new GlobalKey('public actions');host(f);
  try{
    f.set(new DefaultTextEditingShortcuts(field(controller,focus,key)));focus.requestFocus();f.frame();const context=()=>focus.context,state=key.currentState;
    assert(state.textEditingValue instanceof TextEditingValue);
    press(f,'t',{control:true});assert.equal(controller.text,'Ae\u0301👩‍🚀');assert.equal(controller.selection.focus,controller.text.length);assert(controller.undo());f.frame();assert.equal(controller.text,'A👩‍🚀e\u0301');
    const selected=new TextSelection({baseOffset:1,extentOffset:6});Actions.invoke(context(),new intents.UpdateSelectionIntent(state.textEditingValue,selected,cause));f.frame();assert.deepEqual(controller.selection,{anchor:1,focus:6});
    Actions.invoke(context(),new intents.ReplaceTextIntent(state.textEditingValue,'B',new TextRange({start:1,end:6}),cause));f.frame();assert.equal(controller.text,'ABe\u0301');assert.deepEqual(controller.selection,{anchor:1,focus:2},'ReplaceTextIntent preserves the selection transformed through its replacement range');assert(controller.undo());f.frame();assert.equal(controller.text,'A👩‍🚀e\u0301');
    controller.selection={anchor:0,focus:0};Actions.invoke(context(),new intents.TransposeCharactersIntent());f.frame();assert.equal(controller.text,'A👩‍🚀e\u0301','Transpose at the start is a no-op');
  }finally{await f.close();controller.dispose();focus.dispose();}
});

test('scroll-only editing intents retain selection and the requested paragraph position across painting and cursor blink',{timeout},async()=>{
  FoundationPlatform.configure({kind:'web',operatingSystem:'macOS'});
  const f=await engineFixture({fonts:true}),controller=new TextEditingController('one\ntwo\nthree\nfour\nfive\nsix\nseven\neight'),focus=new FocusNode(),key=new GlobalKey('scroll actions');host(f);
  try{
    controller.selection={anchor:0,focus:0};f.set(new DefaultTextEditingShortcuts(field(controller,focus,key)));focus.requestFocus();f.frame();const render=key.currentState.renderEditable,selection=controller.selection;
    Actions.invoke(focus.context,new ScrollIntent({direction:AxisDirection.down,type:ScrollIncrementType.page}));f.frame();const offset=render.scrollOffset.y;assert.equal(offset,.8*render.size.height);assert.deepEqual(controller.selection,selection);
    f.advance(600);f.frame();assert.equal(render.scrollOffset.y,offset,'A blink paint must not reveal the unchanged caret and undo an explicit scroll');
    Actions.invoke(focus.context,new intents.ScrollToDocumentBoundaryIntent({forward:true}));f.frame();assert(render.scrollOffset.y>offset);assert.deepEqual(controller.selection,selection);
    Actions.invoke(focus.context,new intents.ScrollToDocumentBoundaryIntent({forward:false}));f.frame();assert.equal(render.scrollOffset.y,0);assert.deepEqual(controller.selection,selection);
    press(f,'ArrowDown');assert(controller.selection.focus>0);assert(render.editingGeometry.caret.top>=0,'Selection movement reveals its new caret again');
  }finally{await f.close();controller.dispose();focus.dispose();}
});


test('editor Actions reflect read-only availability and a retired default cannot edit a replacement owner',{timeout},async()=>{
  FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});
  const f=await engineFixture({fonts:true}),controller=new TextEditingController('word'),focus=new FocusNode(),key=new GlobalKey('guarded actions');host(f);
  try{
    f.set(field(controller,focus,key,{configuration:{readOnly:true}}));focus.requestFocus();f.frame();const action=Actions.find(focus.context,intents.DeleteCharacterIntent);
    assert.equal(action.isActionEnabled,false);assert.equal(action.isEnabledFor(new intents.DeleteCharacterIntent({forward:false}),focus.context),false);
    press(f,'Backspace');assert.equal(controller.text,'word');
    Actions.invoke(focus.context,new intents.UpdateSelectionIntent(key.currentState.textEditingValue,new TextSelection({baseOffset:4,extentOffset:1}),cause));f.frame();assert.deepEqual(controller.selection,{anchor:4,focus:1},'Read-only text still supports directed selection');
    f.set(new SizedBox());assert.throws(()=>action.isActionEnabled,/lookup context is unmounted/);assert.throws(()=>action.isEnabledFor(new intents.DeleteCharacterIntent({forward:false})),/lookup context is unmounted/);
    const other=new TextEditingController('other');try{f.set(field(other,focus,new GlobalKey('new editor')));focus.requestFocus();f.frame();assert.throws(()=>action.invokeFor(new intents.DeleteCharacterIntent({forward:false}),focus.context),/lookup context is unmounted/);assert.equal(other.text,'other');}finally{f.set(new SizedBox());other.dispose();}
  }finally{await f.close();controller.dispose();focus.dispose();}
});


test('one late editing default cannot edit a second field after an action changes focus reentrantly',{timeout},async()=>{
  FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});
  const f=await engineFixture({fonts:true}),a=new TextEditingController('one'),b=new TextEditingController('two'),fa=new FocusNode(),fb=new FocusNode(),calls=[];host(f);
  class MoveAfterDelete extends Action{constructor(){super(intents.DeleteCharacterIntent);}invoke(intent){calls.push(f.root.buildOwner.focus.primaryFocus);this.callingAction.invoke(intent);fb.requestFocus();f.root.buildOwner.focus.applyFocusChangesIfNeeded();}}
  try{
    f.set(new Actions({actions:new Map([[intents.DeleteCharacterIntent,new MoveAfterDelete()]]),child:new Column([new EditableText('a',a,'A',fa,48,null,{maxLines:1}),new EditableText('b',b,'B',fb,48,null,{maxLines:1})])}));fa.requestFocus();f.frame();
    press(f,'Backspace');assert.equal(a.text,'on');assert.equal(b.text,'two','The same key must not be offered again to the new focus owner');assert.equal(calls.length,1);assert.equal(f.root.buildOwner.focus.primaryFocus,fb);
  }finally{await f.close();a.dispose();b.dispose();fa.dispose();fb.dispose();}
});

test('a focus-tree callback that transfers focus cannot redirect its unhandled editing default to the new field',{timeout},async()=>{
  FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});
  const f=await engineFixture({fonts:true}),a=new TextEditingController('one'),b=new TextEditingController('two'),fa=new FocusNode(),fb=new FocusNode();host(f);
  fa.onKeyEvent=(_node,event)=>{if(event.kind==='down'&&event.key==='Backspace'){fb.requestFocus();f.root.buildOwner.focus.applyFocusChangesIfNeeded();}return 'ignored';};
  try{
    f.set(new Column([new EditableText('a',a,'A',fa,48,null,{maxLines:1}),new EditableText('b',b,'B',fb,48,null,{maxLines:1})]));fa.requestFocus();f.frame();
    press(f,'Backspace');assert.equal(a.text,'one');assert.equal(b.text,'two','The original focus route owns the default even when a callback synchronously transfers focus');assert.equal(f.root.buildOwner.focus.primaryFocus,fb);
  }finally{await f.close();a.dispose();b.dispose();fa.dispose();fb.dispose();}
});
