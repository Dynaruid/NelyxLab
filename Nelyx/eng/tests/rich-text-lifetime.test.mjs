// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';
import {RichText} from '@nelyx/core/framework/widgets/rich-text';
import {WidgetSpan} from '@nelyx/core/framework/widgets/widget-span';
import {TextSpan} from '@nelyx/core/framework/painting/text-span';
import {TextStyle} from '@nelyx/core/framework/painting/text-style';
import {TextScaler} from '@nelyx/core/framework/painting/text-scaler';
import {SelectableText} from '@nelyx/core/framework/widgets/selectable-text';
import {TextSelectionController} from '@nelyx/core/framework/painting/text-selection-controller';
import {RenderSelectableParagraph} from '@nelyx/core/framework/rendering/selectable-paragraph';
import {State,StatefulWidget} from '@nelyx/core/framework/widgets/framework';
import {GlobalKey} from '@nelyx/core/framework/widgets/global-key';
import {SizedBox} from '@nelyx/core/framework/widgets/basic';
import {Directionality} from '@nelyx/core/framework/widgets/app-data';
import {Semantics} from '@nelyx/core/framework/widgets/semantics';
import {engineFixture,assertParagraphOwnership} from '../../../packages/material/tests/engine-fixture.mjs';
import {RenderParagraph as TransportParagraph} from '@nelyx/core/framework/rendering/boxes';
import {SelectionRegistrar,SelectWordSelectionEvent,ClearSelectionEvent} from '@nelyx/core/framework/rendering/selection';
import {Offset} from '@nelyx/core/ui/offset';
const timeout=1_200_000;

test('the actual selectable body keeps its source owner through RTL keys, selection paint and text replacement',{timeout},async()=>{
 const f=await engineFixture({fonts:true}),controller=new TextSelectionController('אבג A😀 한글');let render;
 try{
  f.set(new Directionality('rtl',new SizedBox(180,80,new SelectableText(controller.text,{controller,style:new TextStyle({fontSize:16})}))));const visit=node=>{if(node instanceof RenderSelectableParagraph)render=node;node.visitChildren(visit);};visit(f.root.pipeline.root);assert(render);assert.equal(render.plainText,controller.text);assert.equal(render.textDirection,'rtl');assert(Object.isFrozen(render.config));const old=render.paragraph.resource;
  assert(controller.handleKey({kind:'down',key:'ArrowLeft',alt:false,control:false,meta:false,shift:false}));assert.equal(controller.selection.focus,1);controller.selectAll();f.frame();assert.deepEqual(render.paragraph.resource,old);assert.equal(controller.selectedText,controller.text);
  controller.text='새 본문 العربية e\u0301';f.frame();assert.equal(render.plainText,controller.text);assert.equal(render.paragraph.input.text,controller.text);assert(!f.root.context.resources.hasInitialProducer(old));f.set(new SizedBox());assertParagraphOwnership(f);assert.equal(f.library.debugTextStats.producers,0);
 }finally{await f.close();controller.dispose();}
});

test('nested selectable WidgetSpan paragraphs share canonical nominal checks and current source geometry',{timeout},async()=>{
 const f=await engineFixture({fonts:true});const live=new Set();
 class Registrar extends SelectionRegistrar{add(value){live.add(value);}remove(value){live.delete(value);}}
 const registrar=new Registrar(),options={selectionRegistrar:registrar,selectionColor:0xff336699,style:new TextStyle({fontSize:14})};
 const widget=new Directionality('ltr',new RichText(new TextSpan({text:'outer ',children:[new WidgetSpan(new RichText(new TextSpan({text:'inner text'}),options)),new TextSpan({text:' tail'})]}),options));
 const descriptor=Object.getOwnPropertyDescriptor(TransportParagraph,Symbol.hasInstance);
 try{
  f.set(widget);const paragraphs=[];const visit=render=>{if(render instanceof TransportParagraph)paragraphs.push(render);render.visitChildren(visit);};visit(f.root.pipeline.root);
  const outer=paragraphs.find(render=>render.plainText.includes('\ufffc')),inner=paragraphs.find(render=>render.plainText==='inner text');assert(outer&&inner);assert.equal(live.size,3);
  const fragment=inner.selectionFragments[0],outerFragment=outer.selectionFragments[0];assert(fragment.isPlaceholder());assert.equal(outerFragment.isPlaceholder(),false);
  outerFragment.containsOriginTextBoundary=true;fragment.containsOriginTextBoundary=true;assert.equal(fragment.originParagraph(),outer);
  const outside=outer.localToGlobal(new Offset(1,1));assert.equal(fragment.paragraphContaining(new Offset(outside.x,outside.y)).paragraph,outer);
  const point=inner.localToGlobal(new Offset(1,inner.size.height/2));fragment.dispatchSelectionEvent(new SelectWordSelectionEvent({globalPosition:new Offset(point.x,point.y)}));assert.equal(fragment.getSelectedContent().plainText,'inner');fragment.dispatchSelectionEvent(new ClearSelectionEvent());assert.equal(fragment.getSelectedContent(),null);
  let checks=0;Object.defineProperty(TransportParagraph,Symbol.hasInstance,{configurable:true,value:function(value){assert.equal(this,TransportParagraph);checks++;return Function.prototype[Symbol.hasInstance].call(this,value);}});assert(fragment.isPlaceholder());assert(checks>0);
  for(const failure of [0,undefined,null]){Object.defineProperty(TransportParagraph,Symbol.hasInstance,{configurable:true,value:function(){assert.equal(this,TransportParagraph);throw failure;}});assert.throws(()=>fragment.isPlaceholder(),error=>error===failure);}
 }finally{if(descriptor)Object.defineProperty(TransportParagraph,Symbol.hasInstance,descriptor);else delete TransportParagraph[Symbol.hasInstance];f.set(new SizedBox());assert.equal(live.size,0);assertParagraphOwnership(f);await f.close();}
});

test('RichText and inline WidgetSpan retain user State, nonlinear scale geometry and independent paragraph retirement',{timeout},async()=>{
 const f=await engineFixture({fonts:true}),key=new GlobalKey();let live,created=0,disposed=0;
 class Nonlinear extends TextScaler{get textScaleFactor(){return 2;}scale(value){return value+10;}}
 const scaler=new Nonlinear();
 class InlineChild extends StatefulWidget{constructor(){super(key);}createState(){return new InlineState();}}
 class InlineState extends State{
  value=0;initState(){super.initState();created++;live=this;}
  build(){this.direction=Directionality.of(this.context);this.richText=this.context.findAncestorWidgetOfExactType(RichText);return new Semantics({container:true,transportId:'inline-child',label:'inline:'+this.value+':'+this.direction,child:new SizedBox(10,8)});}
  dispose(){disposed++;live=null;super.dispose();}
 }
 const widget=(size,direction='ltr')=>new Directionality(direction,new RichText(new TextSpan({text:'a',children:[new WidgetSpan(new InlineChild()),new TextSpan({text:'z'})]}),{style:new TextStyle({fontSize:size}),textScaler:scaler}));
 const scaleOf=state=>{const render=state.context.findRenderObject(),origin=render.localToGlobal({x:0,y:0}),next=render.localToGlobal({x:1,y:1});return {x:next.x-origin.x,y:next.y-origin.y};};
 try{
  f.set(widget(10));const original=live;assert(original.richText instanceof RichText);assert.deepEqual(scaleOf(original),{x:2,y:2});
  original.setState(()=>original.value=7);f.frame();assert(f.root.nodes.some(node=>node.id==='inline-child'&&node.name==='inline:7:ltr'));
  f.set(widget(20,'rtl'));assert.equal(live,original);assert.equal(created,1);assert.equal(live.value,7);assert.equal(live.direction,'rtl');assert.deepEqual(scaleOf(live),{x:1.5,y:1.5});
  assert(f.root.nodes.some(node=>node.id==='inline-child'&&node.name==='inline:7:rtl'));assert(f.library.debugTextStats.producers>0);
  f.set(new SizedBox(1,1));assert.equal(live,null);assert.equal(created,disposed);assertParagraphOwnership(f);assert(!f.root.nodes.some(node=>node.id==='inline-child'));
 }finally{await f.close();}
});
