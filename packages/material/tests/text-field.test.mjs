// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import test from 'node:test';
import {TextField} from '@nelyx/material/text-field';
import {TextFormField} from '@nelyx/material/text-form-field';
import {TextField as AggregateField,TextFormField as AggregateFormField} from '@nelyx/material/widgets';
import {InputDecorator} from '@nelyx/material/input-decorator';
import {InputDecoration} from '@nelyx/material/input-decoration';
import {OutlineInputBorder} from '@nelyx/material/input-border';
import {Theme} from '@nelyx/material/theme';
import {ThemeData,VisualDensity} from '@nelyx/material/theme-data';
import {TextStyle} from '@nelyx/core/framework/painting/text-style';
import {WidgetState,WidgetStateTextStyle} from '@nelyx/core/framework/widgets/widget-state';
import {Color} from '@nelyx/core/ui/color';
import {RenderEditable} from '@nelyx/core/framework/rendering/editable';
import {RepaintBoundary} from '@nelyx/core/framework/widgets/repaint-boundary';
import {FramePictureService} from '@nelyx/core/hosting/pictures';
import {RenderInputDecoration} from '../dist/internal/input/input-decorator-layout.js';
import {BoxConstraints} from '@nelyx/core/framework/rendering/constraints';
import {TextEditingController,EditableText} from '@nelyx/core/framework/widgets/editable-text';
import {FocusNode} from '@nelyx/core/framework/widgets/focus';
import {Form} from '@nelyx/core/framework/widgets/form';
import {GlobalKey} from '@nelyx/core/framework/widgets/global-key';
import {TextFormFieldState} from '@nelyx/core/framework/widgets/text-form-field';
import {Center,SizedBox} from '@nelyx/core/framework/widgets/basic';
import {MediaQuery,Directionality} from '@nelyx/core/framework/widgets/app-data';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {EditingSession} from '@nelyx/core/ui/editing';
import {Offset} from '@nelyx/core/ui/offset';
import {engineFixture,assertParagraphOwnership} from './engine-fixture.mjs';
const timeout=1_200_000;
FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});
function wrap(child,{scale=1,direction='ltr'}={}){return new MediaQuery({width:240,height:160,scale:1,textScale:scale,safeArea:{left:0,top:0,right:0,bottom:0},keyboardInset:0},new Directionality(direction,new Theme(new ThemeData({platform:'windows',visualDensity:VisualDensity.standard}),new Center(new SizedBox(220,undefined,child)))));}
function find(root,type){let found;const visit=e=>{if(e.widget instanceof type)found=e;e.visitChildren(visit);};visit(root);assert(found,'Expected '+type.name);return found;}
function editors(f){const bindings=[];f.root.context.editing={capabilities:{indexUnit:'utf16',composing:'observed',selectionDirection:'observed',geometry:'unavailable'},bind(owner,initial,changed,options){
  const session=new EditingSession(owner,initial);let disposed=false;
  const replace=value=>{assert(!disposed);assert(session.update({...value,revision:session.value.revision+1}));changed(session.value);};
  const record={id:options.id,configuration:options.configuration,get disposed(){return disposed;},native(text,composing={status:'none'}){replace({...session.value,text,selection:{anchor:text.length,focus:text.length},composing,source:'native'});},submit:()=>options.onAction?.(session.value),options};bindings.push(record);
  return {get isComposing(){return session.value.composing.status==='active';},read:()=>session.value,replace,focus(){options.focusChanged?.(true);},blur(){options.focusChanged?.(false);},dispose(){assert(!disposed);disposed=true;session.dispose();}};
}};return bindings;}
function node(f,id='field'){const result=f.root.nodes.find(n=>n.id===id);assert(result,'Expected editor '+id);return result;}

test('hover inside a native Picture retained section paints the field background without relayout, editor replacement or text shaping',{timeout},async()=>{
  const f=await engineFixture({fonts:true}),controller=new TextEditingController('Ada'),bindings=editors(f),surface=f.ck.MakeSurface(240,160),pictures=new FramePictureService(f.root.context.resources,f.library.framePictureBackend,f.root.context.owner);f.root.context.pictures=pictures;
  const field=new TextField({id:'field',controller,decoration:new InputDecoration({labelText:'Name',filled:true,fillColor:new Color(0xffff0000),hoverColor:new Color(0xff00ff00),border:new OutlineInputBorder()})});
  const renderFor=Type=>{const pending=[f.root.pipeline.root];while(pending.length){const render=pending.pop();if(render instanceof Type)return render;pending.push(...render.children);}throw Error('Missing '+Type.name);};
  const pixel=(x,y)=>{const commands=f.frame();assert(commands.some(command=>command.op==='drawPicture'),'The pixel regression must replay native Pictures');f.library.replay(surface.getCanvas(),{commands});surface.flush();const image=surface.makeImageSnapshot();try{return Array.from(image.readPixels(Math.floor(x),Math.floor(y),{width:1,height:1,colorType:f.ck.ColorType.RGBA_8888,alphaType:f.ck.AlphaType.Unpremul,colorSpace:f.ck.ColorSpace.SRGB}));}finally{image.delete();}};
  try{
    f.set(wrap(new RepaintBoundary(field)));f.advance(200);const editor=find(f.root.root,EditableText),widget=editor.widget,state=editor.stateObject,decorator=find(f.root.root,InputDecorator).stateObject,container=decorator.containerKey.currentContext.findRenderObject(),position=container.localToGlobal(new Offset(0,0));
    assert.deepEqual(pixel(position.x+5,position.y+container.size.height/2),[255,0,0,255]);
    const layout=renderFor(RenderInputDecoration),editable=renderFor(RenderEditable),perform=layout.performLayout.bind(layout),paint=editable.paint.bind(editable),shape=f.library.layout.bind(f.library);let layouts=0,paints=0,shapes=0;
    layout.performLayout=(...args)=>{layouts++;return perform(...args);};editable.paint=(...args)=>{paints++;return paint(...args);};f.library.layout=(...args)=>{shapes++;return shape(...args);};
    const bounds=node(f).bounds;f.root.pointer({kind:'hover',pointer:91,device:'mouse',buttons:0,x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2,timestamp:f.root.context.clock.now(),viewportGeneration:1});f.frame();
    assert.equal(find(f.root.root,EditableText).widget,widget);assert.equal(find(f.root.root,EditableText).stateObject,state);assert.equal(bindings.length,1);
    paints=0;for(let frame=0;frame<10;frame++)f.advance(17);
    assert.equal(layouts,0);assert.equal(shapes,0);assert.equal(paints,0,'Border animation must not repaint the editor');
    assert.deepEqual(pixel(position.x+5,position.y+container.size.height/2),[0,255,0,255]);assert.equal(controller.text,'Ada');assert.equal(bindings[0].disposed,false);
    const signal=decorator.borderPaint;f.set(new SizedBox());assert.equal(signal.hasListeners,false);assert.equal(f.root.scheduler.transientCallbackCount,0);pictures.dispose();assertParagraphOwnership(f);
  }finally{pictures.dispose();surface.delete();await f.close();controller.dispose();}
});

test('a hover-dependent editor style still updates while composition and its native owner survive',{timeout},async()=>{
  const f=await engineFixture({fonts:true}),controller=new TextEditingController(),focus=new FocusNode(),bindings=editors(f);
  const style=WidgetStateTextStyle.resolveWith(states=>new TextStyle({fontSize:states.contains(WidgetState.hovered)?22:16})),field=new TextField({id:'field',controller,focusNode:focus,style,decoration:new InputDecoration({labelText:'Message'})});
  try{
    f.set(wrap(field));bindings[0].native('한',{status:'active',start:0,end:1});f.frame();const before=find(f.root.root,EditableText),state=before.stateObject,widget=before.widget,bounds=node(f).bounds;
    f.root.pointer({kind:'hover',pointer:92,device:'mouse',buttons:0,x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2,timestamp:f.root.context.clock.now(),viewportGeneration:1});f.frame();
    assert.notEqual(find(f.root.root,EditableText).widget,widget);assert.equal(find(f.root.root,EditableText).stateObject,state);assert.equal(node(f).editorStyle.fontSize,22);assert.equal(bindings.length,1);assert(controller.isComposing);assert.equal(focus.hasFocus,false);
    f.root.pointer({kind:'leave',pointer:92,device:'mouse',buttons:0,x:0,y:0,timestamp:f.root.context.clock.now(),viewportGeneration:1});f.frame();assert.equal(node(f).editorStyle.fontSize,16);assert.equal(find(f.root.root,EditableText).stateObject,state);assert(controller.isComposing);
  }finally{await f.close();controller.dispose();focus.dispose();}
});

test('M3 TextField uses canonical exports, measured editor styling and focusable decoration',{timeout},async()=>{
  assert.equal(AggregateField,TextField);assert.equal(AggregateFormField,TextFormField);
  assert.throws(()=>new TextField({id:'field',maxLength:0}),/positive/);
  const f=await engineFixture({fonts:true}),controller=new TextEditingController(),focus=new FocusNode(),bindings=editors(f),changes=[];
  try{
    f.set(wrap(new TextField({id:'field',controller,focusNode:focus,maxLength:2,decoration:new InputDecoration({filled:true,labelText:'Message',hintText:'Type here',helperText:'Two graphemes'}),onChanged:text=>changes.push(text)})));
    let n=node(f);assert.equal(n.name,'Message');assert.equal(n.editorStyle.fontSize,16);assert.equal(n.editorStyle.lineHeight,24);assert(n.editorStyle.fontFamilies.includes('RobotoSlab'));assert.equal(n.editorStyle.backgroundColor,0);assert(n.bounds.height<48);assert.equal(n.value,'');
    // Clicking the decoration outside the native editor focuses its actual Core node.
    const decorator=find(f.root.root,InputDecorator).renderObjects[0],bounds=decorator.localToGlobal(new Offset(0,0));
    f.root.pointer({kind:'down',pointer:1,device:'mouse',buttons:1,x:bounds.x+2,y:bounds.y+2,timestamp:0,viewportGeneration:1});f.frame();
    f.root.pointer({kind:'up',pointer:1,device:'mouse',buttons:0,x:bounds.x+2,y:bounds.y+2,timestamp:1,viewportGeneration:1});await Promise.resolve();f.frame();
    assert(focus.hasFocus);assert.equal(bindings.length,1);
    bindings[0].native('e\u0301🇰🇷x',{status:'active',start:0,end:7});f.frame();assert.equal(controller.text,'e\u0301🇰🇷x');assert.equal(controller.canUndo,false);
    bindings[0].native('e\u0301🇰🇷x');f.frame();assert.equal(controller.text,'e\u0301🇰🇷');assert.equal(changes.at(-1),'e\u0301🇰🇷');assert.equal(node(f).value,'e\u0301🇰🇷');assert(controller.undo());assert.equal(controller.text,'');assert(controller.redo());assert.equal(controller.text,'e\u0301🇰🇷');
    f.set(new SizedBox());assert(bindings[0].disposed);assert.equal(f.root.scheduler.transientCallbackCount,0);controller.addListener(()=>{});focus.addListener(()=>{});
  }finally{await f.close();controller.dispose();focus.dispose();}
});

test('theme, scale, direction and style updates preserve the composing editor and selection',{timeout},async()=>{
  const f=await engineFixture({fonts:true}),controller=new TextEditingController(),focus=new FocusNode(),bindings=editors(f);
  const field=(size,decoration=new InputDecoration({labelText:'Name',border:new OutlineInputBorder()}))=>new TextField({id:'field',controller,focusNode:focus,style:new TextStyle({fontSize:size}),decoration});
  try{
    f.set(wrap(field(16)));bindings[0].native('한',{status:'active',start:0,end:1});focus.requestFocus();await Promise.resolve();f.frame();
    const editor=find(f.root.root,EditableText).stateObject;
    f.set(wrap(field(20),{scale:1.5,direction:'rtl'}));
    assert.equal(find(f.root.root,EditableText).stateObject,editor);assert.equal(bindings.length,1);assert.equal(bindings[0].disposed,false);assert.equal(controller.text,'한');assert(controller.isComposing);assert.deepEqual(controller.selection,{anchor:1,focus:1});assert.equal(node(f).editorStyle.fontSize,30);assert.equal(node(f).editorStyle.textDirection,'rtl');assert(focus.hasFocus);
    bindings[0].native('한글');f.frame();assert.equal(controller.text,'한글');assert.equal(controller.isComposing,false);
    f.set(wrap(field(16,null)));assert.equal(find(f.root.root,EditableText).stateObject,editor,'Removing decoration must preserve the editor');
    f.advance(168);assert.equal(f.library.debugTextStats.producers,1,'Core retains one painted producer; transient measurements retire theirs');assertParagraphOwnership(f,1);
  }finally{await f.close();controller.dispose();focus.dispose();}
});

test('owned and borrowed controller/focus replacements retire after the editor detaches; disabled blocks focus',{timeout},async()=>{
  const f=await engineFixture({fonts:true}),borrowed=new TextEditingController('Borrowed'),focus=new FocusNode(),bindings=editors(f);
  try{
    f.set(wrap(new TextField({id:'field'})));const owned=find(f.root.root,EditableText).widget.controller;owned.text='Owned';f.frame();
    f.set(wrap(new TextField({id:'field',controller:borrowed,focusNode:focus})));assert(bindings[0].disposed);assert.throws(()=>owned.addListener(()=>{}),/dispose/);assert.equal(node(f).value,'Borrowed');
    focus.requestFocus();await Promise.resolve();f.frame();assert(focus.hasFocus);
    f.set(wrap(new TextField({id:'field',controller:borrowed,focusNode:focus,enabled:false})));await Promise.resolve();f.frame();assert.equal(node(f).enabled,false);assert.equal(node(f).focusable,false);assert.equal(focus.hasFocus,false);assert.equal(focus.canRequestFocus,false);
    f.set(wrap(new TextField({id:'field',controller:borrowed,focusNode:focus,readOnly:true})));await Promise.resolve();f.frame();assert.equal(node(f).enabled,true);assert.equal(focus.canRequestFocus,true);assert.equal(bindings.at(-1).configuration.readOnly,true);
    borrowed.selection={anchor:7,focus:1};f.set(wrap(new TextField({id:'field',focusNode:focus})));const replacement=find(f.root.root,EditableText).widget.controller;assert.equal(replacement.text,'Borrowed');assert.deepEqual(replacement.selection,{anchor:7,focus:1});assert.equal(replacement.canUndo,false);
    f.set(new SizedBox());borrowed.text='Still alive';focus.addListener(()=>{});assert(bindings.every(b=>b.disposed));
  }finally{await f.close();borrowed.dispose();focus.dispose();}
});

test('Material TextFormField shares Core Form state, validation, reset and borrowed controller ownership',{timeout},async()=>{
  const f=await engineFixture({fonts:true}),controller=new TextEditingController(''),key=new GlobalKey('form'),bindings=editors(f),saved=[],changed=[];
  const field=()=>new TextFormField({id:'field',controller,decoration:new InputDecoration({labelText:'Required name'}),validator:value=>value.trim()?null:'Required',onSaved:value=>saved.push(value),onChanged:value=>changed.push(value)});
  try{
    f.set(wrap(new Form({key,child:field()})));const form=key.currentState,fieldState=find(f.root.root,TextFormField).stateObject;assert(fieldState instanceof TextFormFieldState);assert.equal(form.validate(),false);f.frame();assert.equal(find(f.root.root,InputDecorator).widget.decoration.errorText,'Required');assert.deepEqual(saved,[]);
    bindings[0].native('Ada');f.frame();assert.equal(fieldState.value,'Ada');assert.deepEqual(changed,['Ada']);assert(form.validate());form.save();f.frame();assert.deepEqual(saved,['Ada']);assert.equal(find(f.root.root,InputDecorator).widget.decoration.errorText,null);
    form.reset();f.frame();assert.equal(controller.text,'');assert.equal(fieldState.value,'');assert.equal(fieldState.errorText,null);assert.equal(fieldState.hasInteractedByUser,false);assert.deepEqual(changed,['Ada']);
    f.set(wrap(new Form({key,child:new TextFormField({id:'field',initialValue:'Initial',decoration:new InputDecoration({labelText:'Internal'}),enabled:false,validator:()=>{throw new Error('Disabled fields are not validated');}})})));assert(form.validate());f.frame();
    f.set(new SizedBox());assert(bindings.every(b=>b.disposed));controller.text='Caller still owns it';
  }finally{await f.close();controller.dispose();}
});

test('null and omitted Material controller/focus options retain the same composing editor and native binding',{timeout},async()=>{
  const f=await engineFixture({fonts:true}),bindings=editors(f);
  try{
    f.set(wrap(new TextField({id:'field'})));const state=find(f.root.root,EditableText).stateObject,controller=find(f.root.root,EditableText).widget.controller;
    bindings[0].native('한',{status:'active',start:0,end:1});f.frame();f.set(wrap(new TextField({id:'field',controller:null,focusNode:null})));
    assert.equal(find(f.root.root,EditableText).stateObject,state);assert.equal(find(f.root.root,EditableText).widget.controller,controller);assert.equal(bindings.length,1);assert.equal(bindings[0].disposed,false);assert(controller.isComposing);assert.equal(controller.text,'한');assert.deepEqual(controller.selection,{anchor:1,focus:1});
    bindings[0].native('한글');f.frame();f.set(wrap(new TextField({id:'field'})));assert.equal(bindings.length,1);assert.equal(controller.text,'한글');
  }finally{await f.close();}
});

test('M3 multiline and expanded fields share Core sizing while decoration retains footer space and intrinsic baselines',{timeout},async()=>{
  const f=await engineFixture({fonts:true}),controller=new TextEditingController(),bindings=editors(f),decoration=new InputDecoration({labelText:'Message',helperText:'Helper',border:new OutlineInputBorder()});
  const field=options=>new TextField({id:'field',controller,decoration,...options});
  try{
    f.set(wrap(new SizedBox(220,undefined,field({maxLines:3}))));let decorator=find(f.root.root,InputDecorator).renderObjects[0];assert.equal(node(f).bounds.height,72);assert.equal(decorator.size.height,124);
    f.set(wrap(new SizedBox(220,undefined,field({minLines:1,maxLines:3}))));assert.equal(node(f).bounds.height,24);controller.text='A\nB';f.frame();assert.equal(node(f).bounds.height,48);assert.equal(decorator.size.height,100);assert.equal(bindings.length,1);
    controller.text='';f.set(wrap(new SizedBox(220,140,field({maxLines:null,expands:true}))));decorator=find(f.root.root,InputDecorator).renderObjects[0];assert.equal(decorator.size.height,140);assert.equal(node(f).bounds.height,88);
    const natural=decorator.getMaxIntrinsicHeight(220);assert(Number.isFinite(natural)&&natural>=76&&natural<140);assert.equal(decorator.getMinIntrinsicHeight(220),natural);const constraints=BoxConstraints.tight({width:220,height:140});assert.deepEqual(decorator.getDryLayout(constraints),decorator.size);assert.equal(decorator.getDryBaseline(constraints,'alphabetic'),decorator.getDistanceToActualBaseline('alphabetic'));
    // Empty input and label paragraphs may have distinct font baselines. The
    // intrinsic result must match natural layout rather than nominal row height.
    f.set(wrap(new SizedBox(220,undefined,field({maxLines:null}))));assert.equal(find(f.root.root,InputDecorator).renderObjects[0].size.height,natural);
    assert.throws(()=>field({expands:true}));assert.throws(()=>field({obscureText:true,maxLines:3}));
  }finally{await f.close();controller.dispose();}
});
