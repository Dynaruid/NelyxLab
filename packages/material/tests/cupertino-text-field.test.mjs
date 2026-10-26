// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';import test from 'node:test';
import {CupertinoTextField,OverlayVisibilityMode as Mode} from '@nelyx/cupertino/text-field';
import {CupertinoTextFormFieldRow} from '@nelyx/cupertino/text-form-field-row';
import {CupertinoTextField as AggregateField,CupertinoTextFormFieldRow as AggregateForm,OverlayVisibilityMode as AggregateMode} from '@nelyx/cupertino/widgets';
import {CupertinoLocalizations} from '@nelyx/cupertino/localizations';
import {CupertinoTheme,CupertinoThemeData} from '@nelyx/cupertino/theme';
import {TextStyle} from '@nelyx/core/framework/painting/text-style';
import {TextAlignVertical} from '@nelyx/core/framework/painting/text-align-vertical';
import {BoxConstraints} from '@nelyx/core/framework/rendering/constraints';
import {TextEditingController,EditableText} from '@nelyx/core/framework/widgets/editable-text';
import {TextFormFieldState} from '@nelyx/core/framework/widgets/text-form-field';
import {Center,SizedBox,Text} from '@nelyx/core/framework/widgets/basic';
import {MediaQuery,Directionality} from '@nelyx/core/framework/widgets/app-data';
import {FocusNode} from '@nelyx/core/framework/widgets/focus';
import {Form} from '@nelyx/core/framework/widgets/form';
import {AppFocus} from '@nelyx/core/framework/widgets/app-focus';
import {GlobalKey} from '@nelyx/core/framework/widgets/global-key';
import {EditingSession} from '@nelyx/core/ui/editing';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {engineFixture,assertParagraphOwnership} from './engine-fixture.mjs';
const timeout=1_200_000;
FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});
const wrap=(child,{scale=1,direction='ltr',brightness='light',height}={})=>new MediaQuery({width:240,height:160,scale:1,textScale:scale,safeArea:{left:0,top:0,right:0,bottom:0},keyboardInset:0},new Directionality(direction,new CupertinoTheme({data:new CupertinoThemeData({brightness}),child:new AppFocus(new Center(new SizedBox(220,height,child)))})));
function find(root,predicate){let result;const visit=e=>{if(predicate(e))result=e;e.visitChildren(visit);};visit(root);assert(result);return result;}
const editor=f=>find(f.root.root,e=>e.widget instanceof EditableText);
const node=f=>{const result=f.root.nodes.find(n=>n.id==='field');assert(result);return result;};
function editors(f,{deferred=false}={}){const bindings=[];f.root.context.editing={capabilities:{indexUnit:'utf16',composing:'observed',selectionDirection:'observed',geometry:'unavailable'},bind(owner,initial,changed,options){const session=new EditingSession(owner,initial);let disposed=false;const replace=value=>{assert(!disposed);assert(session.update({...value,revision:session.value.revision+1}));changed(session.value);};const requests=[];const request=value=>{if(deferred)requests.push(value);else replace(value);};const record={options,requests,ack(){assert(requests.length);replace(requests.shift());},get disposed(){return disposed;},native(text,composing={status:'none'}){replace({...session.value,text,selection:{anchor:text.length,focus:text.length},composing,source:'native'});},submit:()=>options.onAction?.(session.value)};bindings.push(record);return {get isComposing(){return session.value.composing.status==='active';},read:()=>session.value,replace:request,replaceComposing:request,focus(){options.focusChanged?.(true);},blur(){options.focusChanged?.(false);},dispose(){assert(!disposed);disposed=true;session.dispose();}};}};return bindings;}
async function fixture(){const f=await engineFixture({fonts:true});try{const bytes=fs.readFileSync(new URL('../assets/CupertinoIcons.ttf',import.meta.resolve('@nelyx/cupertino/icon-assets'))),font=f.library.decode({id:'cupertino-icons',kind:'font',fontFamily:'packages/cupertino_icons/CupertinoIcons',sha256:createHash('sha256').update(bytes).digest('hex')},bytes);f.root.context.resources.register(font.descriptor,font.retire);f.root.context.assets.set('cupertino-icons',font.descriptor);return f;}catch(error){await f.close();throw error;}}

test('Cupertino composition cancellation waits for the OS while Core Form reset applies before delayed synchronization',{timeout},async()=>{
  const f=await fixture(),controller=new TextEditingController('word'),bindings=editors(f,{deferred:true}),changes=[];
  try {
    f.set(wrap(new CupertinoTextField({id:'field',controller,clearButtonMode:Mode.always,onChanged:text=>changes.push(text)})));
    bindings[0].native('word',{status:'active',start:0,end:4});f.frame();changes.length=0;
    f.tap('field-clear');assert.equal(controller.text,'word');assert.deepEqual(changes,[]);assert.equal(bindings[0].requests.length,1);
    bindings[0].ack();f.frame();assert.equal(controller.text,'');assert.deepEqual(changes,['']);assert.equal(controller.canUndo,true);
    f.set(new SizedBox());controller.text='';changes.length=0;
    const key=new GlobalKey('async form');let resets=0;
    f.set(wrap(new Form({key,child:new CupertinoTextFormFieldRow({id:'field',controller,onChanged:text=>changes.push(text),onReset:()=>resets++})})));
    const state=find(f.root.root,e=>e.widget instanceof CupertinoTextFormFieldRow).stateObject;
    bindings[1].native('Ada');f.frame();changes.length=0;key.currentState.reset();
    assert.equal(state.value,'');assert.equal(controller.text,'');assert.equal(resets,1);assert.deepEqual(changes,['']);assert.equal(bindings[1].requests.length,1,'Only OS synchronization remains pending');
    bindings[1].ack();f.frame();assert.equal(state.value,'');assert.equal(controller.text,'');assert.equal(state.hasInteractedByUser,false);assert.equal(key.currentState.hasInteractedByUser,false,'An asynchronous reset must not mark the enclosing Form as user-edited');assert.equal(resets,1);assert.deepEqual(changes,['']);assert.equal(controller.canUndo,false);
    bindings[1].native('Later');f.frame();key.currentState.reset();f.set(new SizedBox());assert.equal(resets,2);assert.equal(controller.text,'');
  } finally {await f.close();controller.dispose();}
});

test('Cupertino field canonical defaults, borderless mode, overlay identities and pinned clear labels reject invalid policies',{timeout},()=>{
  assert.equal(AggregateField,CupertinoTextField);assert.equal(AggregateForm,CupertinoTextFormFieldRow);assert.equal(AggregateMode,Mode);
  const field=new CupertinoTextField({id:'field'});assert.equal(field.controller,null);assert.equal(field.focusNode,null);assert.equal(field.maxLines,1);assert.equal(field.minLines,null);assert.equal(field.expands,false);assert.equal(field.prefixMode,Mode.always);assert.equal(field.clearButtonMode,Mode.never);assert.equal(field.padding.horizontal,14);assert.equal(field.decoration.border.top.width,0);assert.equal(field.decoration.borderRadius.topLeft.x,5);
  assert.equal(CupertinoTextField.borderless({id:'field'}).decoration,null);assert.deepEqual(Mode.values.map(mode=>mode.name),['never','editing','notEditing','always']);assert(Mode.values.every(Object.isFrozen));
  for(const options of [{maxLength:0},{maxLength:-1},{maxLines:0},{minLines:3,maxLines:2},{expands:true},{obscureText:true,maxLines:null},{prefixMode:'always'}])assert.throws(()=>new CupertinoTextField({id:'field',...options}));
  assert.equal(new CupertinoLocalizations('en').clearButtonLabel,'Clear');assert.equal(new CupertinoLocalizations('ko-KR').clearButtonLabel,'삭제');assert.equal(CupertinoLocalizations.supportedLocales.length,115);for(const locale of CupertinoLocalizations.supportedLocales)assert(new CupertinoLocalizations(locale).clearButtonLabel.length>0);
});

test('actual Cupertino clear control uses source suffix priority and text visibility, emits once, keeps focus/Undo and rejects stale disabled/retired actions',{timeout},async()=>{
  const f=await fixture(),controller=new TextEditingController(),focus=new FocusNode(),bindings=editors(f),changes=[];let taps=0;
  const field=options=>new CupertinoTextField({id:'field',controller,focusNode:focus,placeholder:'Message',onChanged:text=>changes.push(text),onTap:()=>taps++,...options});
  const hasText=text=>{controller.text=text;f.frame();};
  try{
    let state;
    for(const mode of Mode.values)for(const text of ['','Text']){f.set(wrap(field({clearButtonMode:mode})));hasText(text);state??=editor(f).stateObject;assert.equal(editor(f).stateObject,state);assert.equal(f.root.nodes.some(n=>n.id==='field-clear'),mode===Mode.always||mode===(text?Mode.editing:Mode.notEditing));}
    f.set(wrap(field({clearButtonMode:Mode.always,suffix:new Text('Suffix'),suffixMode:Mode.always})));assert(!f.root.nodes.some(n=>n.id==='field-clear'),'A visible user suffix takes priority over clear');
    f.set(wrap(field({clearButtonMode:Mode.editing,maxLength:2})));bindings[0].native('e\u0301🇰🇷x',{status:'active',start:0,end:7});f.frame();assert.equal(controller.text,'e\u0301🇰🇷x');bindings[0].native('e\u0301🇰🇷x');f.frame();assert.equal(controller.text,'e\u0301🇰🇷');
    focus.requestFocus();await Promise.resolve();f.frame();const stale=f.root.nodes.find(n=>n.id==='field-clear').actions.activate;f.tap('field-clear');assert.equal(controller.text,'');assert.equal(changes.at(-1),'');assert.equal(changes.filter(text=>text==='').length,1);assert.equal(taps,0);assert(focus.hasFocus);assert(controller.undo());f.frame();assert.equal(controller.text,'e\u0301🇰🇷');
    f.root.nodes.find(n=>n.id==='field-clear').actions.focus();await Promise.resolve();f.frame();for(const kind of ['down','up'])f.root.key({kind,key:'Enter',code:'Enter',shift:false,control:false,alt:false,meta:false,repeat:false});f.frame();assert.equal(controller.text,'','The clear semantics button must route keyboard activation through its own Core focus');assert(controller.undo());f.frame();
    f.set(wrap(field({enabled:false,clearButtonMode:Mode.always})));await Promise.resolve();f.frame();assert.equal(node(f).enabled,false);assert.equal(node(f).focusable,false);stale();assert.equal(controller.text,'e\u0301🇰🇷');
    f.set(new SizedBox());stale();assert.equal(controller.text,'e\u0301🇰🇷');assert(bindings.every(binding=>binding.disposed));
  }finally{await f.close();controller.dispose();focus.dispose();}
});

test('placeholder baseline alignment, visibility, styling, multiline/expanded sizing and CPU background preserve actual editor State',{timeout},async()=>{
  const f=await fixture(),controller=new TextEditingController(),bindings=editors(f),surface=f.ck.MakeSurface(240,160);
  const field=options=>new CupertinoTextField({id:'field',controller,placeholder:'Hint',placeholderStyle:new TextStyle({fontSize:24}),...options});
  try{
    f.set(wrap(field({textAlignVertical:TextAlignVertical.bottom})));const state=editor(f).stateObject,stack=find(f.root.root,e=>e.renderObjects.some(r=>r.constructor.name==='RenderBaselineAlignedStack')).renderObjects.find(r=>r.constructor.name==='RenderBaselineAlignedStack');
    const [placeholder,input]=stack.children;assert.equal(placeholder.layoutOffset.y+placeholder.getDistanceToBaseline('alphabetic'),input.layoutOffset.y+input.getDistanceToBaseline('alphabetic'));
    assert.deepEqual(stack.getDryLayout(new BoxConstraints(220,220,0,160)),stack.size);assert(Number.isFinite(stack.getMinIntrinsicHeight(220)));
    bindings[0].native('한',{status:'active',start:0,end:1});f.frame();f.set(wrap(field({textDirection:'rtl'}),{scale:1.5,brightness:'dark'}));assert.equal(editor(f).stateObject,state);assert.equal(bindings.length,1);assert(controller.isComposing);assert.equal(node(f).editorStyle.fontSize,25.5);assert.equal(node(f).editorStyle.textDirection,'rtl');bindings[0].native('한글');f.frame();
    f.set(wrap(new CupertinoTextField({id:'field',controller,decoration:null})));assert.equal(editor(f).stateObject,state,'Removing every attachment preserves the canonical editor key');
    f.set(wrap(field({minLines:2,maxLines:4})));controller.text='A\nB\nC';f.frame();const line=node(f).editorStyle.lineHeight;assert.equal(node(f).bounds.height,line*3);
    f.set(wrap(field({maxLines:null,expands:true}),{height:140}));assert.equal(node(f).bounds.height,126);assert.equal(editor(f).stateObject,state);
    f.set(wrap(field({enabled:false}),{brightness:'dark'}));f.library.replay(surface.getCanvas(),{commands:f.frame()});surface.flush();const image=surface.makeImageSnapshot();try{const bounds=node(f).bounds,rgba=Array.from(image.readPixels(Math.floor(bounds.x+2),Math.floor(bounds.y+2),{width:1,height:1,colorType:f.ck.ColorType.RGBA_8888,alphaType:f.ck.AlphaType.Unpremul,colorSpace:f.ck.ColorSpace.SRGB}));assert.deepEqual(rgba,[5,5,5,255]);}finally{image.delete();}
    f.set(new SizedBox());assertParagraphOwnership(f);assert.equal(f.root.scheduler.transientCallbackCount,0);
  }finally{surface.delete();await f.close();controller.dispose();}
});

test('Cupertino omitted and borrowed controller/focus handoffs preserve directional selection and retire only owned resources',{timeout},async()=>{
  const f=await fixture(),controller=new TextEditingController('Borrowed'),focus=new FocusNode(),bindings=editors(f);
  try{
    controller.selection={anchor:7,focus:1};f.set(wrap(new CupertinoTextField({id:'field',controller,focusNode:focus})));f.set(wrap(new CupertinoTextField({id:'field'})));const owned=editor(f).widget.controller;assert.notEqual(owned,controller);assert.equal(owned.text,'Borrowed');assert.deepEqual(owned.selection,{anchor:7,focus:1});assert.equal(owned.canUndo,false);
    f.set(wrap(new CupertinoTextField({id:'field',controller,focusNode:focus})));assert.throws(()=>owned.addListener(()=>{}),/dispose/);f.set(new SizedBox());controller.text='Alive';focus.addListener(()=>{});assert(bindings.every(binding=>binding.disposed));
  }finally{await f.close();controller.dispose();focus.dispose();}
});

test('CupertinoTextFormFieldRow shares Core Form state, validation, submit/save and source reset callback without owning a caller controller',{timeout},async()=>{
  const f=await fixture(),controller=new TextEditingController(),key=new GlobalKey('form'),bindings=editors(f),changed=[],saved=[];let submitted=0;
  const field=()=>new CupertinoTextFormFieldRow({id:'field',controller,prefix:new Text('Name'),placeholder:'Name',validator:value=>value?null:'Required',onChanged:value=>changed.push(value),onSaved:value=>saved.push(value),onFieldSubmitted:()=>submitted++});
  try{
    f.set(wrap(new Form({key,child:field()})));const state=find(f.root.root,e=>e.widget instanceof CupertinoTextFormFieldRow).stateObject;assert(state instanceof TextFormFieldState);assert.equal(key.currentState.validate(),false);f.frame();assert(f.root.nodes.some(node=>node.name?.includes('Required')));
    bindings[0].native('Ada');f.frame();assert.equal(state.value,'Ada');assert.deepEqual(changed,['Ada']);assert(key.currentState.validate());key.currentState.save();bindings[0].submit();assert.deepEqual(saved,['Ada']);assert.equal(submitted,1);
    key.currentState.reset();f.frame();assert.equal(controller.text,'');assert.equal(state.errorText,null);assert.equal(state.hasInteractedByUser,false);assert.deepEqual(changed,['Ada','']);
    controller.text='Directional';controller.selection={anchor:9,focus:2};f.set(wrap(new Form({key,child:new CupertinoTextFormFieldRow({id:'field',placeholder:'Name'})})));const owned=editor(f).widget.controller;assert.equal(owned.text,'Directional');assert.deepEqual(owned.selection,{anchor:9,focus:2});assert.equal(owned.canUndo,false);
    f.set(new SizedBox());controller.text='Caller owns it';assert(bindings.every(binding=>binding.disposed));
  }finally{await f.close();controller.dispose();}
});
