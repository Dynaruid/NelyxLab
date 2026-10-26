// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';
import {RichText} from '@nelyx/core/framework/widgets/rich-text';
import {WidgetSpan} from '@nelyx/core/framework/widgets/widget-span';
import {TextSpan} from '@nelyx/core/framework/painting/text-span';
import {TextStyle} from '@nelyx/core/framework/painting/text-style';
import {TextScaler} from '@nelyx/core/framework/painting/text-scaler';
import {State,StatefulWidget} from '@nelyx/core/framework/widgets/framework';
import {GlobalKey} from '@nelyx/core/framework/widgets/global-key';
import {SizedBox} from '@nelyx/core/framework/widgets/basic';
import {Directionality} from '@nelyx/core/framework/widgets/app-data';
import {Semantics} from '@nelyx/core/framework/widgets/semantics';
import {engineFixture,assertParagraphOwnership} from '../../../packages/material/tests/engine-fixture.mjs';
const timeout=1_200_000;

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
