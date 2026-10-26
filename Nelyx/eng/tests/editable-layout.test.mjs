// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {EditableText,TextEditingController} from '@nelyx/core/framework/widgets/editable-text';
import {RenderEditable} from '@nelyx/core/framework/rendering/editable';
import {TextStyle} from '@nelyx/core/framework/painting/text-style';
import {TextPainter} from '@nelyx/core/framework/painting/text-painter';
import {TextSpan} from '@nelyx/core/framework/painting/text-span';
import {BoxConstraints} from '@nelyx/core/framework/rendering/constraints';
import {Text,Center,SizedBox,Row} from '@nelyx/core/framework/widgets/basic';
import {MediaQuery} from '@nelyx/core/framework/widgets/app-data';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {EditingSession} from '@nelyx/core/ui/editing';
import {FocusNode} from '@nelyx/core/framework/widgets/focus';
import {FlutterError} from '@nelyx/core/foundation/flutter-error';
import {engineFixture,assertParagraphOwnership} from '../../../packages/material/tests/engine-fixture.mjs';
const timeout=1_200_000;
FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});
const style=new TextStyle({fontSize:16,height:1.5,color:0xff000000});
function find(root,predicate){let result;const visit=e=>{if(predicate(e))result=e;e.visitChildren(visit);};visit(root);assert(result);return result;}
function media(child,scale=1){return new MediaQuery({width:240,height:160,scale:1,textScale:scale,safeArea:{left:0,top:0,right:0,bottom:0},keyboardInset:0},new Center(child));}
function editing(f){const bindings=[];f.root.context.editing={capabilities:{indexUnit:'utf16',composing:'observed',selectionDirection:'observed'},bind(owner,initial,changed,options){const session=new EditingSession(owner,initial);let closed=false;const replace=value=>{assert(session.update({...value,revision:session.value.revision+1}));changed(session.value);};const host={options,get closed(){return closed;},native(text,composing={status:'none'}){replace({...session.value,text,selection:{anchor:text.length,focus:text.length},composing,source:'native'});}};bindings.push(host);return {get isComposing(){return session.value.composing.status==='active';},read:()=>session.value,replace,focus(){options.focusChanged?.(true);},blur(){options.focusChanged?.(false);},dispose(){assert(!closed);closed=true;session.dispose();}};}};return bindings;}
const editor=(controller,lines={maxLines:null},extra={})=>new EditableText('editor',controller,'Message',undefined,0,null,{textStyle:style,minHeight:0,...lines,...extra});
const render=f=>find(f.root.root,e=>e.widget instanceof EditableText).renderObjects[0];

test('actual editor grows and clamps measured hard lines, retains binding through line policy/scale changes and retires measurements',{timeout},async()=>{
  const f=await engineFixture({fonts:true}),controller=new TextEditingController(),bindings=editing(f);
  const set=(policy,scale=1)=>f.set(media(new SizedBox(200,undefined,editor(controller,policy)),scale));
  try{
    set({maxLines:3});assert.equal(render(f).size.height,72);assert.equal(bindings[0].options.configuration.multiline,true);
    set({minLines:1,maxLines:3});assert.equal(render(f).size.height,24);
    controller.text='A\nB';f.frame();assert.equal(render(f).size.height,48);
    controller.text='A\nB\nC\nD';f.frame();assert.equal(render(f).size.height,72);
    set({minLines:2,maxLines:null});assert.equal(render(f).size.height,96);assert.equal(bindings.length,1);
    controller.text='A';f.frame();assert.equal(render(f).size.height,48);
    set({minLines:2,maxLines:null},1.5);assert.equal(render(f).size.height,72);assert.equal(bindings.length,1);
    const box=render(f),constraints=new BoxConstraints(200,200,0,160);assert.deepEqual(box.getDryLayout(constraints),box.size);assert.equal(box.getDryBaseline(constraints,'alphabetic'),box.getDistanceToActualBaseline('alphabetic'));
    f.set(new SizedBox());assert(bindings.every(binding=>binding.closed));assertParagraphOwnership(f);
  }finally{await f.close();controller.dispose();}
});

test('soft wrapping and both baselines match an independently rendered paragraph while width changes during composition',{timeout},async()=>{
  const f=await engineFixture({fonts:true}),controller=new TextEditingController('one two three'),bindings=editing(f);
  const set=width=>f.set(media(new Row([new SizedBox(width,undefined,editor(controller)),new SizedBox(width,undefined,new Text(controller.text,{style}))],{mainSize:'min',crossAlign:'start'})));
  try{
    set(50);const measured=render(f),paragraph=find(f.root.root,e=>e.widget instanceof Text).renderObjects[0];
    assert(measured.size.height>24);assert.equal(measured.size.height,paragraph.size.height);assert.equal(measured.getDistanceToActualBaseline('alphabetic'),paragraph.getDistanceToActualBaseline('alphabetic'));
    // RenderParagraph deliberately reports its alphabetic baseline for either
    // request. The public painter retains the separate ideographic baseline.
    const reference=new TextPainter({text:new TextSpan({text:controller.text,style}),textDirection:'ltr'},{text:f.root.context.text,resources:f.root.context.resources,font:f.root.context.defaultFont,scale:1,transient:true});
    try{reference.layout({minWidth:50,maxWidth:50});assert.equal(measured.getDistanceToActualBaseline('ideographic'),reference.computeDistanceToActualBaseline('ideographic'));}finally{reference.dispose();}
    const state=find(f.root.root,e=>e.widget instanceof EditableText).stateObject;
    bindings[0].native('one two three',{status:'active',start:0,end:13});set(110);
    assert.equal(find(f.root.root,e=>e.widget instanceof EditableText).stateObject,state);assert.equal(bindings.length,1);assert(controller.isComposing);assert.deepEqual(controller.selection,{anchor:13,focus:13});assert.equal(render(f).size.height,24);
    bindings[0].native('one two three');f.frame();assert.equal(controller.isComposing,false);
  }finally{await f.close();controller.dispose();}
});

test('expanded editors fill bounded space; intrinsic heights count source hard separators and invalid line policies fail before binding',{timeout},async()=>{
  const controller=new TextEditingController();
  for(const policy of [{maxLines:0},{minLines:-1},{minLines:3,maxLines:2},{maxLines:129},{maxLines:1,expands:true},{maxLines:null,minLines:1,expands:true}])assert.throws(()=>editor(controller,policy));
  assert.throws(()=>editor(controller,{maxLines:1},{configuration:{multiline:true}}),/agree/);
  assert.throws(()=>editor(controller,{maxLines:null},{configuration:{obscureText:true}}));
  const f=await engineFixture({fonts:true});editing(f);
  try{
    f.set(media(new SizedBox(200,120,editor(controller,{minLines:null,maxLines:null,expands:true}))));const box=render(f);assert.equal(box.size.height,120);assert.equal(box.getMaxIntrinsicHeight(Infinity),24);
    controller.text='A\r\nB\u0085C\u000bD\u000cE\u2028F\u2029G';f.frame();assert.equal(box.getMaxIntrinsicHeight(Infinity),168);
    assert.equal(f.library.debugTextStats.producers,1,'Only the painted Core paragraph keeps a producer; intrinsic probes retire theirs');assertParagraphOwnership(f,1);
  }finally{await f.close();controller.dispose();}
});

test('changing multiline mode defers native reconfiguration and layout until composition commits without losing text or selection',{timeout},async()=>{
  const f=await engineFixture({fonts:true}),controller=new TextEditingController(),bindings=editing(f);
  try{
    f.set(media(new SizedBox(200,undefined,editor(controller,{maxLines:null}))));const state=find(f.root.root,e=>e.widget instanceof EditableText).stateObject;
    bindings[0].native('A\nB',{status:'active',start:0,end:3});f.frame();assert.equal(render(f).size.height,48);
    f.set(media(new SizedBox(200,undefined,editor(controller,{maxLines:1}))));assert.equal(bindings.length,1);assert.equal(render(f).size.height,48);assert.equal(bindings[0].options.configuration.multiline,true);assert(controller.isComposing);
    bindings[0].native('A\nB');f.frame();f.frame();assert.equal(bindings.length,2);assert(bindings[0].closed);assert.equal(bindings[1].options.configuration.multiline,false);assert.equal(render(f).size.height,24);assert.equal(controller.text,'A\nB');assert.deepEqual(controller.selection,{anchor:3,focus:3});assert.equal(find(f.root.root,e=>e.widget instanceof EditableText).stateObject,state);
  }finally{await f.close();controller.dispose();}
});

test('completion callbacks override default focus actions, report through the owner, and stop after synchronous retirement',{timeout},async()=>{
  const f=await engineFixture({fonts:true}),first=new TextEditingController('First'),second=new TextEditingController('Second'),focusA=new FocusNode(),focusB=new FocusNode(),bindings=editing(f),events=[];
  const view=(options={})=>media(new Row([
    new SizedBox(100,undefined,new EditableText('first',first,'First',focusA,0,null,{textStyle:style,minHeight:0,action:'next',onSubmitted:value=>events.push('first:'+value),...options})),
    new SizedBox(100,undefined,new EditableText('second',second,'Second',focusB,0,null,{textStyle:style,minHeight:0,action:'done',onSubmitted:value=>events.push('second:'+value)})),
  ],{mainSize:'min'}));
  const submit=index=>bindings[index].options.onAction();
  const previousReport=f.root.context.reportError,previousFlutterError=FlutterError.onError,reports=[];
  try{
    f.set(view());focusA.requestFocus();await Promise.resolve();f.frame();submit(0);await Promise.resolve();f.frame();assert(focusB.hasFocus);assert.deepEqual(events,['first:First']);
    submit(1);await Promise.resolve();f.frame();assert.equal(focusB.hasFocus,false);assert.equal(events.at(-1),'second:Second');
    f.set(view({onEditingComplete:()=>events.push('complete')}));focusA.requestFocus();await Promise.resolve();f.frame();submit(0);await Promise.resolve();f.frame();assert(focusA.hasFocus);assert.deepEqual(events.slice(-2),['complete','first:First']);assert.equal(bindings.length,2);
    f.root.context.reportError=details=>reports.push(details);FlutterError.onError=()=>{};
    f.set(view({onEditingComplete:()=>{throw new Error('Completion failure');}}));submit(0);assert.equal(reports.length,1);assert.match(String(reports[0].exception),/Completion failure/);assert.equal(events.at(-1),'first:First');
    const before=events.length;f.set(view({onEditingComplete:()=>f.set(new SizedBox())}));submit(0);assert.equal(events.length,before);assert(bindings.every(binding=>binding.closed));
  }finally{f.root.context.reportError=previousReport;FlutterError.onError=previousFlutterError;await f.close();first.dispose();second.dispose();focusA.dispose();focusB.dispose();}
});
