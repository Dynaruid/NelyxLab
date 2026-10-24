// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {RenderBox,BoxParentData} from '@nelyx/core/framework/rendering/object';
import {BoxConstraints} from '@nelyx/core/framework/rendering/constraints';
import {StatelessWidget} from '@nelyx/core/framework/widgets/framework';
import {Row,Expanded,SizedBox} from '@nelyx/core/framework/widgets/basic';
import {fixture} from '../../../packages/material/tests/root-fixture.mjs';
const timeout=1_200_000;

test('valid size and layout do not read diagnostic constructor names, while missing size still reports its owner',{timeout},()=>{
  class Box extends RenderBox {performLayout(c){return c.constrain({width:10,height:20});}}
  const box=new Box();let diagnosticReads=0,diagnosticsAllowed=true;
  Object.defineProperty(box,'constructor',{get(){diagnosticReads++;if(!diagnosticsAllowed)throw Error('Diagnostic constructor must only be read on failure');return Box;}});
  try{
    assert.throws(()=>box.size,error=>error.code==='missing-render-size'&&error.message.includes('Box has not been laid out'));
    assert.equal(diagnosticReads,1);diagnosticReads=0;diagnosticsAllowed=false;
    box.setChildren([]);box.layout(new BoxConstraints(0,30,0,30));
    assert.deepEqual(box.size,{width:10,height:20});assert.deepEqual(box.paintBounds,{x:0,y:0,width:10,height:20});
    assert.equal(diagnosticReads,0);
  }finally{diagnosticsAllowed=true;box.dispose();}
});

test('constraint violations retain their error code, owner description and failed-layout state',{timeout},()=>{
  class InvalidBox extends RenderBox {performLayout(){return {width:40,height:40};}}
  const box=new InvalidBox();let descriptions=0;
  Object.defineProperty(box,'constructor',{get(){descriptions++;return InvalidBox;}});
  try{
    assert.throws(()=>box.layout(BoxConstraints.tight({width:10,height:10})),error=>error.code==='constraint-violation'&&error.message.includes('InvalidBox returned size outside constraints'));
    assert.equal(descriptions,1);assert.equal(box.needsLayout,true);
  }finally{box.dispose();}
});

test('normal widget rebuild and valid parent data avoid diagnostics while invalid parent data retains its description',{timeout},()=>{
  let constructorReads=0,parentDescriptions=0;
  const child=new SizedBox(10,20);
  class DiagnosticExpanded extends Expanded {get debugTypicalAncestorWidgetDescription(){parentDescriptions++;return 'required Flex owner';}}
  const expanded=new DiagnosticExpanded(child);
  class Probe extends StatelessWidget {get typeToken(){return Probe;}build(){return new Row([expanded]);}}
  const widget=new Probe();Object.defineProperty(widget,'constructor',{get(){constructorReads++;throw Error('A valid rebuild must not format its diagnostic name');}});
  const f=fixture();try{
    f.set(widget);f.frame();assert.equal(constructorReads,0);assert.equal(parentDescriptions,0);
    let element;const visit=node=>{if(node.widget===child)element=node;for(const value of node.children)visit(value);};visit(f.root.root);
    assert(element);const render=element.renderObject,original=render.parentData;
    try{
      render.parentData=new BoxParentData();
      assert.throws(()=>element.applyParentDataWidget(expanded),error=>error.code==='invalid-parent-data'&&error.message.includes('required Flex owner'));
      assert.equal(parentDescriptions,1);
    }finally{render.parentData=original;}
    f.frame();assert.equal(parentDescriptions,1);assert.equal(constructorReads,0);
  }finally{f.close();}
});
