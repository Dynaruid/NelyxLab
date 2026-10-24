// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {RenderBox} from '@nelyx/core/framework/rendering/object';
import {RenderFlex} from '@nelyx/core/framework/rendering/boxes';
import {BoxConstraints} from '@nelyx/core/framework/rendering/constraints';

const timeout=1_200_000;
class BaselineBox extends RenderBox {
  constructor(name,width,height,baseline,events=[]){super();Object.assign(this,{name,width,height,baseline,events,fail:false});}
  computeDryLayout(c){return c.constrain({width:this.width,height:this.height});}
  performLayout(c){this.events.push(this.name);if(this.fail)throw Error('measurement probe');return this.computeDryLayout(c);}
  computeDryBaseline(){return this.baseline;}
  computeDistanceToActualBaseline(){return this.baseline;}
}
function close(root,children){root.dispose();for(const child of children)child.dispose();}

test('Flex shares dry/wet baseline geometry and preserves nonflex-first measurement in LTR and RTL',{timeout},()=>{
  for(const textDirection of ['ltr','rtl']){
    const events=[],children=[new BaselineBox('a',20,20,12,events),new BaselineBox('b',15,10,6,events),new BaselineBox('c',10,30,20,events)];
    const root=new RenderFlex('horizontal',0,[],'max','baseline',{textDirection,textBaseline:'alphabetic'}),c=new BoxConstraints(0,120,0,80);
    try{
      root.setChildren(children);children[1].parentData.flex=1;
      assert.deepEqual(root.getDryLayout(c),{width:120,height:30});assert.equal(root.getDryBaseline(c,'alphabetic'),20);
      assert(children.every(child=>child.layoutOffset.x===0&&child.layoutOffset.y===0),'Dry placement cannot publish offsets');
      root.layout(c);assert.deepEqual(events,['a','c','b']);assert.deepEqual(root.size,{width:120,height:30});
      assert.deepEqual(children.map(child=>child.layoutOffset),textDirection==='ltr'?[{x:0,y:8},{x:20,y:14},{x:110,y:0}]:[{x:100,y:8},{x:10,y:14},{x:0,y:0}]);
      assert.equal(children[1].size.width,90);assert.equal(root.getDistanceToActualBaseline('alphabetic'),20);
    }finally{close(root,children);}
  }
});

test('upward RTL Column keeps the logical first-child baseline after reversed placement',{timeout},()=>{
  const children=[new BaselineBox('a',20,10,6),new BaselineBox('b',30,20,14)],root=new RenderFlex('vertical',0,[],'max','start',{textDirection:'rtl',verticalDirection:'up',mainAxisAlignment:'end'}),c=new BoxConstraints(0,80,0,100);
  try{
    root.setChildren(children);assert.deepEqual(root.getDryLayout(c),{width:30,height:100});assert.equal(root.getDryBaseline(c,'alphabetic'),26);
    root.layout(c);assert.deepEqual(children.map(child=>child.layoutOffset),[{x:10,y:20},{x:0,y:0}]);assert.equal(root.getDistanceToActualBaseline('alphabetic'),26);
  }finally{close(root,children);}
});

test('a failed Flex measurement keeps committed offsets and a later layout recovers',{timeout},()=>{
  const children=[new BaselineBox('a',20,10,6),new BaselineBox('b',30,20,14)],root=new RenderFlex('horizontal',0,[],'max','center'),c=new BoxConstraints(0,120,0,80);
  try{
    root.setChildren(children);root.layout(c);const previous=children.map(child=>child.layoutOffset);
    children[0].height=30;children[0].markNeedsLayout();children[1].fail=true;children[1].markNeedsLayout();
    assert.throws(()=>root.layout(c),/measurement probe/);assert.equal(root.needsLayout,true);assert.deepEqual(children.map(child=>child.layoutOffset),previous);
    children[1].fail=false;root.layout(c);assert.equal(root.needsLayout,false);assert.deepEqual(root.size,{width:120,height:30});assert.deepEqual(children.map(child=>child.layoutOffset),[{x:0,y:0},{x:20,y:5}]);
  }finally{close(root,children);}
});
