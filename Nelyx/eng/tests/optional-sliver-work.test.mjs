// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';
import {State,StatefulWidget} from '@nelyx/core/framework/widgets/framework';
import {Directionality} from '@nelyx/core/framework/widgets/app-data';
import {ListView} from '@nelyx/core/framework/widgets/scroll-view';
import {SizedBox,Row,Expanded} from '@nelyx/core/framework/widgets/basic';
import {Semantics} from '@nelyx/core/framework/widgets/semantics';
import {ScrollController} from '@nelyx/core/framework/widgets/scroll-controller';
import {EdgeInsets} from '@nelyx/core/framework/painting/edge-insets';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {SectionExtentIndex} from '@nelyx/core/framework/rendering/section-extent-index';
import {fixture} from '../../../packages/material/tests/root-fixture.mjs';
const timeout=1_200_000;FoundationPlatform.configure({kind:'native',operatingSystem:'windows'});
// This is an explicit synthetic host capability, never a production deadline.
const observed=(now,slack=30,uncertainty=0)=>({tick:now,dispatch:now,queueDelay:0,clockUncertainty:uncertainty,observedDeadline:now+slack});
function setup({slow=false,two=false,indexed=false}={}){
 const f=fixture(),controllers=[new ScrollController(),new ScrollController()],built=[],live=new Set(),heights=new Map(),index=indexed?new SectionExtentIndex(100,{estimatedExtent:80}):undefined;
 class Item extends StatefulWidget{constructor(column,index){super();this.column=column;this.index=index;}createState(){return new ItemState();}}
 class ItemState extends State{initState(){super.initState();this.id=this.widget.column+':'+this.widget.index;assert(!live.has(this.id));live.add(this.id);built.push(this.id);f.elapse(slow&&this.widget.index===2?5:.1);}build(){return new Semantics({container:true,transportId:'optional-'+this.id,label:this.id,textDirection:'ltr',child:new SizedBox(100,heights.get(this.widget.index)??80)});}dispose(){assert(live.delete(this.id));super.dispose();}}
 const make=column=>ListView.builder({controller:controllers[column],primary:false,...(index?{extentIndex:index}:{itemExtent:80}),itemCount:100,padding:EdgeInsets.zero,childPolicy:{mode:'bounded',preparation:'observed-budget'},itemBuilder:(_context,index)=>new Item(column,index)});
 f.set(new Directionality('ltr',two?new Row([new Expanded(make(0)),new Expanded(make(1))]):make(0)));
 const budget=f.root.buildOwner.maybeViewWorkBudget;
 return {...f,built,live,budget,controllers,index,heights,tick(slack=30,allowed=()=>true,uncertainty=0){f.elapse(16);const timing=observed(f.root.context.clock.now(),slack,uncertainty);f.frame({timing,canRunOptionalWork:allowed});return timing;},close(){f.close();for(const controller of controllers)controller.dispose();assert.equal(live.size,0);assert.equal(budget.debugStats.trackedElements,0);}};
}
test('one optional item follows all mandatory columns, restores visible coverage and respects one host tick',{timeout},()=>{
 const f=setup({two:true});try{
  assert.equal(f.built.length,4);assert.equal(f.budget.debugStats.preparedPasses,0);
  const timing=f.tick();assert.equal(f.built.length,5);assert.equal(f.budget.debugStats.preparedPasses,1);assert.equal(f.budget.debugStats.optionalChildren,1);
  assert(!f.root.nodes.some(node=>node.id==='optional-0:2'||node.id==='optional-1:2'));
  f.frame({timing,canRunOptionalWork:()=>true});assert.equal(f.built.length,5,'Repeated build in one host tick cannot prepare another item');
  f.tick();assert.equal(f.built.length,6);assert.equal(f.budget.debugStats.preparedPasses,2);assert(f.built.includes('0:2')&&f.built.includes('1:2'),'One column cannot consume the other column\'s mandatory pass or all optional turns');
 }finally{f.close();}
});
test('missing/short/uncertain deadlines and live input/native admission prevent preparation',{timeout},()=>{
 for(const scenario of ['missing','short','uncertain','blocked']){const f=setup();try{
  let guards=0;if(scenario==='missing')f.frame({canRunOptionalWork:()=>{guards++;return true;}});else f.tick(scenario==='short'?3:30,()=>{guards++;return scenario!=='blocked';},scenario==='uncertain'?30:0);
  assert.equal(f.built.length,2);assert.equal(f.budget.debugStats.preparedPasses,0);if(scenario==='missing'){assert.equal(guards,0);assert.equal(f.budget.debugStats.automaticPreparation,'unavailable');}
 }finally{f.close();}}
});
test('an underestimated atomic creation records its overrun and stops starting oversized follow-up work',{timeout},()=>{
 const f=setup({slow:true});try{f.tick();assert.equal(f.budget.debugStats.preparedPasses,1);assert.equal(f.budget.debugStats.preparationOverruns,1);assert(f.budget.debugStats.preparationMs>=5);f.tick();assert.equal(f.budget.debugStats.preparedPasses,1);assert.equal(f.built.length,3);}finally{f.close();}
});
test('indexed optional measurement preserves the mandatory anchor and invalidates candidates after resize',{timeout},()=>{
 const f=setup({indexed:true});try{
  f.index.requestItem(10,{offset:10});f.frame();const built=f.built.length,anchor={...f.index.anchor},next=Math.max(...f.built.map(id=>Number(id.split(':')[1])))+1;f.heights.set(next,160);
  f.tick();assert.equal(f.built.length,built+1);assert.equal(f.built.at(-1),'0:'+next);assert.deepEqual(f.index.anchor,anchor,'Measuring the larger following row cannot move the required anchor');assert(!f.root.nodes.some(node=>node.id==='optional-0:'+next));
  const cancelled=f.budget.debugStats.cancelledCandidates,metrics=f.root.context.readMetrics();Object.assign(metrics,{logicalWidth:metrics.logicalWidth+40,physicalWidth:metrics.physicalWidth+40,viewportGeneration:metrics.viewportGeneration+1});f.frame();assert(f.budget.debugStats.cancelledCandidates>cancelled);assert.deepEqual(f.index.anchor,anchor);
 }finally{f.close();}
});

test('preparation hit/miss and cancellation counters follow actual bucket reuse and final teardown',{timeout},()=>{
 const f=setup();try{
  f.tick();assert.equal(f.budget.debugStats.preparedChildren,1);assert.equal(f.budget.debugStats.preparationHits,0);const built=f.built.length;
  f.controllers[0].jumpTo(80);f.frame();assert.equal(f.built.length,built,'The prepared row is obtained without another builder');assert.equal(f.budget.debugStats.preparationHits,1);assert.equal(f.budget.debugStats.retainedHits,1);
  f.tick();assert.equal(f.budget.debugStats.preparedChildren,2);const cancelled=f.budget.debugStats.cancelledCandidates;
  f.root.setVisible(false);assert(f.budget.debugStats.cancelledCandidates>cancelled,'Hide cancels the finite outstanding candidate');
 }finally{f.close();}
 assert.equal(f.budget.debugStats.preparationMisses,1,'The unused prepared row is counted only when actual teardown finishes');
 assert.equal(f.budget.debugStats.preparedChildren,f.budget.debugStats.preparationHits+f.budget.debugStats.preparationMisses);
});

test('optional request and mandatory restoration preserve the first failure and do not defer normal teardown',{timeout},()=>{
 const f=setup(),first=new Error('optional failed'),cleanup=new Error('restoration failed');try{
  const owner=f.root.root;f.budget.cancelPreparation();f.budget.setCandidate({owner,elements:1,estimatedMs:0,valid:()=>true,request:()=>{throw first;},finish:()=>{throw cleanup;}});
  assert.throws(()=>f.budget.runOptional(observed(0),()=>0,()=>true,()=>{},()=>{}),error=>error instanceof AggregateError&&error.errors[0]===first&&error.errors[1]===cleanup);
 }finally{f.close();}
});
