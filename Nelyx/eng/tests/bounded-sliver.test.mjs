// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';
import {State,StatefulWidget,StatelessWidget} from '@nelyx/core/framework/widgets/framework';
import {GlobalKey} from '@nelyx/core/framework/widgets/global-key';
import {Directionality} from '@nelyx/core/framework/widgets/app-data';
import {ListView} from '@nelyx/core/framework/widgets/scroll-view';
import {ScrollController} from '@nelyx/core/framework/widgets/scroll-controller';
import {SizedBox,Row as FlexRow,Column,Expanded} from '@nelyx/core/framework/widgets/basic';
import {Semantics} from '@nelyx/core/framework/widgets/semantics';
import {KeepAlive,SliverList} from '@nelyx/core/framework/widgets/sliver';
import {SliverChildBuilderDelegate} from '@nelyx/core/framework/widgets/scroll-delegate';
import {EdgeInsets} from '@nelyx/core/framework/painting/edge-insets';
import {ValueKey} from '@nelyx/core/foundation/key';
import {SectionExtentIndex} from '@nelyx/core/framework/rendering/section-extent-index';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {ResourceAccounting} from '@nelyx/core/hosting/resources';
import {textLimits} from '@nelyx/core/ui/text';
import {fixture} from '../../../packages/material/tests/root-fixture.mjs';
const timeout=1_200_000,policy={mode:'bounded'};
FoundationPlatform.configure({kind:'native',operatingSystem:'windows'});

test('two bounded lists share one View budget, reuse actual State and expose only visible semantics',{timeout},()=>{
 const f=fixture(),controllers=[new ScrollController(),new ScrollController()],live=new Map();let mounted=0,disposed=0;
 class Item extends StatefulWidget{constructor(column,index){super(new ValueKey(column+':'+index));this.column=column;this.index=index;}createState(){return new ItemState();}}
 class ItemState extends State{initState(){super.initState();this.id=this.widget.column+':'+this.widget.index;assert(!live.has(this.id));live.set(this.id,this);mounted++;}build(){return new Semantics({container:true,transportId:'budget-'+this.id,label:this.id,textDirection:'ltr',child:new SizedBox(100,80)});}dispose(){assert(live.delete(this.id));disposed++;super.dispose();}}
 const list=column=>ListView.builder({controller:controllers[column],primary:false,itemExtent:80,itemCount:1000,padding:EdgeInsets.zero,childPolicy:policy,itemBuilder:(_context,index)=>new Item(column,index)});
 let budget;
 try{
  f.set(new Directionality('ltr',new FlexRow([new Expanded(list(0)),new Expanded(list(1))])));budget=f.root.buildOwner.maybeViewWorkBudget;assert(budget);assert.equal(live.size,4);const original=live.get('0:0');
  controllers[0].jumpTo(80);f.frame();assert.equal(live.get('0:0'),original);assert.equal(budget.debugStats.optionalChildren,1);assert(!f.root.nodes.some(node=>node.id==='budget-0:0'));
  assert.throws(()=>budget.withChild(original.context,undefined,()=>{},()=>assert.fail('Nested bounded work started')),/Nested bounded/);
  controllers[0].jumpTo(0);f.frame();assert.equal(live.get('0:0'),original);assert.equal(mounted,5);assert.equal(budget.debugStats.retainedHits,1);
  for(let cycle=0;cycle<3;cycle++)for(const index of [8,16,24,16,8,0]){for(const controller of controllers)controller.jumpTo(index*80);f.frame();const stats=budget.debugStats;assert(stats.optionalChildren<=16);assert(stats.optionalElements<=2048);assert(live.size<=20);for(let column=0;column<2;column++)assert(f.root.nodes.some(node=>node.id===`budget-${column}:${index}`));}
 }finally{f.close();for(const controller of controllers)controller.dispose();}
 assert.equal(live.size,0);assert.equal(mounted,disposed);assert.equal(budget.debugStats.optionalChildren,0);assert.equal(budget.debugStats.trackedElements,0);
});

test('explicit keep-alive survives optional eviction and releases through its normal request',{timeout},()=>{
 const f=fixture(),scroll=new ScrollController(),live=new Map();let pinned;
 class Item extends StatefulWidget{constructor(index){super(new ValueKey(index));this.index=index;}createState(){return new ItemState();}}
 class ItemState extends State{keep=false;initState(){super.initState();this.id=this.widget.index;live.set(this.id,this);if(this.id===0){this.keep=true;pinned=this;}}build(){return new KeepAlive({keepAlive:this.keep,child:new SizedBox(100,80)});}dispose(){assert(live.delete(this.id));super.dispose();}}
 try{
  f.set(new Directionality('ltr',ListView.builder({controller:scroll,primary:false,itemCount:1000,itemExtent:80,padding:EdgeInsets.zero,childPolicy:policy,addAutomaticKeepAlives:false,addRepaintBoundaries:false,addSemanticIndexes:false,itemBuilder:(_context,index)=>new Item(index)})));
  for(const offset of [800,1600,2400,3200]){scroll.jumpTo(offset);f.frame();assert.equal(live.get(0),pinned);assert(f.root.buildOwner.maybeViewWorkBudget.debugStats.optionalChildren<=8);assert.equal(f.root.buildOwner.maybeViewWorkBudget.debugStats.retainedHits,0,'An explicit offscreen owner is not a visible reuse hit');}
  pinned.setState(()=>pinned.keep=false);f.frame();assert(!live.has(0));
 }finally{f.close();scroll.dispose();}
 assert.equal(live.size,0);
});

test('a large atomic row is required normally but cannot enter the optional Element budget',{timeout},()=>{
 const f=fixture(),scroll=new ScrollController(),live=new Set();
 class Wrapper extends StatelessWidget{constructor(child){super();this.child=child;}build(){return this.child;}}
 class Item extends StatefulWidget{constructor(index){super(new ValueKey(index));this.index=index;}createState(){return new ItemState();}}
 class ItemState extends State{initState(){super.initState();this.id=this.widget.index;live.add(this.id);}build(){return this.id===0?new Column(Array.from({length:20},()=>{let child=new SizedBox(1,0);for(let i=0;i<110;i++)child=new Wrapper(child);return child;})):new SizedBox(100,80);}dispose(){assert(live.delete(this.id));super.dispose();}}
 try{f.set(new Directionality('ltr',ListView.builder({controller:scroll,primary:false,itemCount:100,itemExtent:80,padding:EdgeInsets.zero,childPolicy:policy,itemBuilder:(_context,index)=>new Item(index)})));assert(live.has(0));scroll.jumpTo(800);f.frame();assert(!live.has(0));assert(f.root.buildOwner.maybeViewWorkBudget.debugStats.optionalElements<=2048);}
 finally{f.close();scroll.dispose();}assert.equal(live.size,0);
});

test('legacy is unchanged and unsupported bounded/cache combinations fail explicitly',{timeout},()=>{
 const f=fixture();try{f.set(new Directionality('ltr',ListView.builder({itemCount:5,itemExtent:80,itemBuilder:()=>new SizedBox(20,80)})));assert.equal(f.root.buildOwner.maybeViewWorkBudget,undefined);}finally{f.close();}
 for(const options of [{itemExtent:80,cacheExtent:0},{itemExtent:80,shrinkWrap:true},{},{itemExtentBuilder:()=>80},{prototypeItem:new SizedBox(20,80)},{itemExtent:0}])assert.throws(()=>ListView.builder({...options,childPolicy:policy,itemCount:5,itemBuilder:()=>new SizedBox(20,80)}),/Bounded|bounded/);
 assert.throws(()=>new SliverList({delegate:new SliverChildBuilderDelegate(()=>new SizedBox(20,80),{childCount:5}),childPolicy:policy}),/Bounded/);
});

test('indexed sections preserve anchor and retained State while far seeks create only destination rows',{timeout},()=>{
 const f=fixture(),index=new SectionExtentIndex(1000,{estimatedExtent:60}),scroll=new ScrollController(),states=new Map(),built=[];
 class Item extends StatefulWidget{constructor(i){super(new ValueKey(i));this.i=i;}createState(){return new ItemState();}}
 class ItemState extends State{initState(){super.initState();states.set(this.widget.i,this);}build(){return new Semantics({container:true,transportId:'indexed-budget-'+this.widget.i,label:'section',textDirection:'ltr',child:new SizedBox(null,60)});}dispose(){assert(states.delete(this.widget.i));super.dispose();}}
 try{
  index.requestItem(10,{offset:10});f.set(new Directionality('ltr',ListView.builder({controller:scroll,primary:false,itemCount:1000,extentIndex:index,padding:EdgeInsets.zero,childPolicy:policy,itemBuilder:(_context,i)=>{built.push(i);return new Item(i);}})));const original=states.get(10);assert.deepEqual(built,[10,11,12]);
  index.requestItem(9,{offset:50});f.frame();index.requestItem(10,{offset:10});f.frame();assert.equal(states.get(10),original);assert.deepEqual(index.anchor,{index:10,offset:10});
  built.length=0;index.requestItem(700,{offset:17});f.frame();assert(built.length<=4&&built.every(i=>i>=700&&i<=703));assert.deepEqual(index.anchor,{index:700,offset:17});assert(f.root.buildOwner.maybeViewWorkBudget.debugStats.optionalChildren<=8);
 }finally{f.close();scroll.dispose();}assert.equal(states.size,0);
});

test('GlobalKey retake transfers tracked descendants from an optional row to an ordinary parent',{timeout},()=>{
 const f=fixture(),scroll=new ScrollController(),key=new GlobalKey();let outside=false,created=0,disposed=0,state;
 class Leaf extends StatefulWidget{constructor(){super(key);}createState(){return new LeafState();}}
 class LeafState extends State{initState(){super.initState();created++;state=this;}build(){return new SizedBox(20,30);}dispose(){disposed++;super.dispose();}}
 const tree=()=>new Directionality('ltr',new Column([new Expanded(ListView.builder({controller:scroll,primary:false,itemExtent:80,itemCount:100,padding:EdgeInsets.zero,childPolicy:policy,itemBuilder:(_context,i)=>i===0&&!outside?new Leaf():new SizedBox(100,80)})),new SizedBox(null,40,outside?new Leaf():undefined)]));
 let budget;
 try{f.set(tree());budget=f.root.buildOwner.maybeViewWorkBudget;const original=state;scroll.jumpTo(80);f.frame();assert.equal(budget.debugStats.optionalChildren,1);outside=true;f.set(tree());assert.equal(state,original);assert.equal(created,1);assert.equal(disposed,0);assert(key.currentElement);}
 finally{f.close();scroll.dispose();}assert.equal(created,disposed);assert.equal(budget.debugStats.trackedElements,0);
});

test('resident pressure evicts optional State through layout while an in-flight resource stays charged',{timeout},()=>{
 const f=fixture(),scroll=new ScrollController(),live=new Set();let lease,retired=0;
 class Item extends StatefulWidget{constructor(index){super(new ValueKey(index));this.index=index;}createState(){return new ItemState();}}
 class ItemState extends State{initState(){super.initState();this.id=this.widget.index;live.add(this.id);}build(){return new SizedBox(100,80);}dispose(){assert(live.delete(this.id));super.dispose();}}
 try{
  f.set(new Directionality('ltr',ListView.builder({controller:scroll,primary:false,itemCount:100,itemExtent:80,padding:EdgeInsets.zero,childPolicy:policy,itemBuilder:(_context,index)=>new Item(index)})));scroll.jumpTo(80);f.frame();assert(live.has(0));
  const registry=f.root.context.resources,accounting=new ResourceAccounting(registry),resource={id:'pressure-owner',generation:1};
  registry.register({...resource,kind:'paragraph'},()=>retired++,{owner:accounting,identity:{},cost:{units:textLimits.retainedUnits,bytes:1}});lease=registry.acquire([resource]);registry.releaseProducer(resource);
  assert.equal(registry.accountedTotals.producers,0);f.frame();assert(!live.has(0));assert(live.has(1)&&live.has(2));assert.equal(f.root.buildOwner.maybeViewWorkBudget.debugStats.optionalChildren,0);assert.equal(registry.accountedTotals.residentUnits,textLimits.retainedUnits);assert.equal(retired,0);
  lease.returnBy('caller');assert.equal(retired,1);assert.equal(registry.accountedTotals.residentUnits,0);scroll.jumpTo(160);f.frame();assert(live.has(1),'After actual retirement a nearby State may be retained again');
 }finally{if(lease&&!lease.released)lease.returnBy('caller');f.close();scroll.dispose();}assert.equal(live.size,0);
});
