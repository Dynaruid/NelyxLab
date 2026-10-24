// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';
import {State,StatefulWidget} from '@nelyx/core/framework/widgets/framework';
import {Directionality} from '@nelyx/core/framework/widgets/app-data';
import {ListView} from '@nelyx/core/framework/widgets/scroll-view';
import {ScrollController} from '@nelyx/core/framework/widgets/scroll-controller';
import {SizedBox} from '@nelyx/core/framework/widgets/basic';
import {Semantics} from '@nelyx/core/framework/widgets/semantics';
import {RenderSliverFixedExtentList} from '@nelyx/core/framework/rendering/sliver-fixed-extent-list';
import {EdgeInsets} from '@nelyx/core/framework/painting/edge-insets';
import {ValueKey} from '@nelyx/core/foundation/key';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {fixture} from '../../../packages/material/tests/root-fixture.mjs';
FoundationPlatform.configure({kind:'native',operatingSystem:'windows'});

test('continuous entry and reversal preserve active links, actual visible rows and bounded State ownership',{timeout:1_200_000},()=>{
 const f=fixture(),scroll=new ScrollController(),live=new Set();let mounted=0,disposed=0;
 class Row extends StatefulWidget{constructor(index){super(new ValueKey(index));this.index=index;}createState(){return new RowState();}}
 class RowState extends State{initState(){super.initState();live.add(this);mounted++;}build(){return new Semantics({container:true,transportId:'row-'+this.widget.index,label:'Row',textDirection:'ltr',child:new SizedBox(240,80)});}dispose(){assert(live.delete(this));disposed++;super.dispose();}}
 const tree=new Directionality('ltr',ListView.builder({itemCount:1000,itemExtent:80,cacheExtent:0,padding:EdgeInsets.zero,primary:false,controller:scroll,itemBuilder:(_context,index)=>new Row(index),findChildIndexCallback:key=>key instanceof ValueKey?key.value:null}));
 const check=offset=>{
  scroll.jumpTo(offset);f.frame();const pending=[f.root.pipeline.root];let sliver;while(pending.length){const node=pending.pop();if(node instanceof RenderSliverFixedExtentList){sliver=node;break;}pending.push(...node.children);}assert(sliver);
  const indices=[];let previous=null,child=sliver.firstChild;while(child){assert.equal(sliver.childBefore(child),previous);indices.push(sliver.indexOf(child));previous=child;child=sliver.childAfter(child);}assert.equal(previous,sliver.lastChild);assert.deepEqual(indices,[offset/80,offset/80+1]);
  assert.deepEqual(f.root.nodes.filter(node=>node.id?.startsWith('row-')).map(node=>node.id),indices.map(index=>'row-'+index));assert.equal(live.size,2);
 };
 try{f.set(tree);for(let i=1;i<=10;i++)check(i*80);for(let i=9;i>=0;i--)check(i*80);for(let cycle=0;cycle<3;cycle++){check(800);check(0);}assert.equal(mounted,34);assert.equal(mounted-disposed,2);assert(mounted<1000);}
 finally{f.close();scroll.dispose();}
 assert.equal(live.size,0);assert.equal(mounted,disposed);
});
