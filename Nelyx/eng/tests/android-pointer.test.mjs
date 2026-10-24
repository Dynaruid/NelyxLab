// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {Directionality} from '@nelyx/core/framework/widgets/app-data';
import {ListView} from '@nelyx/core/framework/widgets/scroll-view';
import {ScrollController} from '@nelyx/core/framework/widgets/scroll-controller';
import {SizedBox} from '@nelyx/core/framework/widgets/basic';
import {fixture} from '../../../packages/material/tests/root-fixture.mjs';
import {androidPointerInput} from '../../sdk/dist/backends/react-native/android-pointer-input.js';
import {nativeInputProps} from '../../sdk/dist/backends/react-native/input.js';
const timeout=1_200_000;
const sample=(kind,y,timestamp,pointer=7)=>({kind,x:120,y,timestamp,pointer,device:'touch',buttons:kind==='up'||kind==='cancel'?0:1});
const batch=samples=>({nativeEvent:{protocol:1,nativeId:42,samples}});

test('one Android native movement packet retains history and scrolls the actual Core ListView',{timeout},()=>{
  FoundationPlatform.configure({kind:'native',operatingSystem:'android'});
  const f=fixture(),controller=new ScrollController(),view={currentMetrics:f.root.context.readMetrics(),dispatchPointer:event=>{f.root.pointer(event);f.frame();}};let focused=0;
  const input=androidPointerInput(()=>view,()=>42,()=>focused++);
  try{
    f.set(new Directionality('ltr',ListView.builder({controller,primary:false,itemCount:10,itemBuilder:()=>new SizedBox(240,100)})));
    input(batch([sample('down',140,0)]));input(batch([sample('move',115,30),sample('move',80,60),sample('move',40,100)]));input(batch([sample('up',40,120)]));
    assert.equal(controller.offset,75);assert.equal(focused,1);
    input(batch([sample('down',80,140,8),sample('cancel',80,150,8)]));assert.equal(controller.offset,75);
  }finally{f.close();controller.dispose();}
});

test('Android contact admission rejects a malformed batch before dispatch and checks the live native owner',{timeout},()=>{
  const received=[],view={currentMetrics:{viewportGeneration:3},dispatchPointer:event=>received.push(event)};let current=view,nativeId=42,focus=0;
  const input=androidPointerInput(()=>current,()=>nativeId,()=>focus++);
  for(const bad of [sample('move',NaN,2),sample('move',1,-1),{...sample('up',1,2),buttons:1},{...sample('move',1,2),pointer:1.5}]){
    assert.throws(()=>input(batch([sample('down',1,0),bad])),/Invalid Android pointer sample/);assert.equal(received.length,0);assert.equal(focus,0);
  }
  assert.throws(()=>input(batch([sample('move',1,2),sample('move',2,1)])),/Invalid Android pointer sample/);
  nativeId=43;input(batch([sample('down',1,0)]));assert.equal(received.length,0);
  nativeId=42;current=undefined;input(batch([sample('down',1,0)]));assert.equal(received.length,0);
  current=view;input(batch([sample('down',1,0,4),sample('down',2,0,5),sample('move',3,1,4),sample('move',4,1,5),sample('cancel',3,2,4),sample('cancel',4,2,5)]));
  assert.deepEqual(received.map(event=>[event.kind,event.pointer,event.viewportGeneration]),[['down',4,3],['down',5,3],['move',4,3],['move',5,3],['cancel',4,3],['cancel',5,3]]);
  received.length=0;view.dispatchPointer=event=>{received.push(event);current={...view};};input(batch([sample('move',2,3),sample('move',3,4)]));assert.equal(received.length,1,'An owner change retires the remaining packet');
  current=view;view.dispatchPointer=event=>{received.push(event);view.currentMetrics={viewportGeneration:4};};received.length=0;input(batch([sample('move',2,3),sample('move',3,4)]));assert.equal(received.length,1,'A viewport change cannot reuse old local coordinates');
});

test('Android selects the non-coalescing port and fails closed against an older native surface',{timeout},()=>{
  assert.throws(()=>nativeInputProps('android',()=>undefined,undefined,undefined,()=>42),/Rebuild Android Skia pointer protocol 1/);
  const props=nativeInputProps('android',()=>undefined,undefined,undefined,()=>42,{androidPointerProtocol:1});
  assert.equal(typeof props.onAndroidPointer,'function');assert(!('onTouchStart'in props));assert(!('onTouchMove'in props));
  assert.equal(typeof nativeInputProps('ios',()=>undefined).onTouchMove,'function');
});


test('the installed RN codegen accepts the actual Android history event schema',{timeout},()=>{
  const require=createRequire(import.meta.url),{TypeScriptParser}=require('@react-native/codegen/lib/parsers/typescript/parser.js');
  const schema=new TypeScriptParser().parseFile(fileURLToPath(new URL('../../skia/packages/rn/src/specs/SkiaViewNativeComponent.ts',import.meta.url)));
  const event=schema.modules.SkiaView.components.SkiaView.events.find(event=>event.name==='onAndroidPointer');
  assert.equal(event.bubblingType,'direct');const samples=event.typeAnnotation.argument.properties.find(property=>property.name==='samples').typeAnnotation;
  assert.equal(samples.type,'ArrayTypeAnnotation');assert.equal(samples.elementType.type,'ObjectTypeAnnotation');
  assert.deepEqual(samples.elementType.properties.map(property=>property.name),['kind','device','pointer','buttons','x','y','timestamp']);
});
