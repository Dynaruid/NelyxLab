// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {SizedBox,Text} from '@nelyx/core/framework/widgets/basic';
import {Directionality,MediaQuery} from '@nelyx/core/framework/widgets/app-data';
import {DefaultAssetBundle} from '@nelyx/core/framework/widgets/default-asset-bundle';
import {AssetBundle} from '@nelyx/core/services/asset-bundle';
import {GlobalKey} from '@nelyx/core/framework/widgets/global-key';
import {PipelineOwner} from '@nelyx/core/framework/rendering/object';
import {BoxConstraints} from '@nelyx/core/framework/rendering/constraints';
import {PaintingContext} from '@nelyx/core/framework/painting/context';
import {ColorShapeDecoration} from '@nelyx/core/framework/painting/color-shape-decoration';
import {Border} from '@nelyx/core/framework/painting/box-border';
import {RoundedRectangleBorder} from '@nelyx/core/framework/painting/rounded-rectangle-border';
import {ImageConfiguration} from '@nelyx/core/framework/painting/image-configuration';
import {Color} from '@nelyx/core/ui/color';
import {Paint} from '@nelyx/core/ui/paint';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {Material} from '../dist/material.js';
import {Theme,ThemeData} from '../dist/theme.js';
import {ListTile} from '../dist/list-tile.js';
import {Ink,InkDecoration} from '../dist/ink-decoration.js';
import {MaterialInkRender,InkFeature} from '../dist/internal/material/material-ink-owner.js';
import {emptyInkDecoration} from '../dist/internal/material/empty-ink-decoration.js';
import {engineFixture} from './engine-fixture.mjs';

const timeout=1_200_000;
FoundationPlatform.configure({kind:'native',operatingSystem:'windows'});
class NoAssets extends AssetBundle {async load(key){throw Error('Unexpected tile asset '+key);}}
const assets=new NoAssets(),theme=new ThemeData();
function wrap(options={},direction='ltr'){
  return new DefaultAssetBundle(assets,new MediaQuery({width:240,height:160,scale:1,textScale:1,keyboardInset:0,safeArea:{left:0,top:0,right:0,bottom:0}},new Directionality(direction,new Theme(theme,new Material({color:new Color(0xffe8e0f0),clipBehavior:'hardEdge',child:new SizedBox(220,80,new ListTile({id:'tile',title:new Text('A tile'),onTap(){},...options}))})))));
}
function findInk(f){const pending=[f.root.root];while(pending.length){const element=pending.pop();if(element.widget instanceof Ink)return element;pending.push(...element.children);}return null;}
function pixels(f,surface){f.library.replay(surface.getCanvas(),{commands:f.frame()});surface.flush();const image=surface.makeImageSnapshot();try{return Buffer.from(image.readPixels(0,0,{width:240,height:160,colorType:f.ck.ColorType.RGBA_8888,alphaType:f.ck.AlphaType.Unpremul,colorSpace:f.ck.ColorSpace.SRGB}));}finally{image.delete();}}

test('private empty tile paint matches the ordinary explicit-transparent composition in all pixels',{timeout},async()=>{
  const f=await engineFixture({fonts:true}),surface=f.ck.MakeSurface(240,160);
  try{
    for(const direction of ['ltr','rtl'])for(const selected of [false,true])for(const twoLines of [false,true]){
      const options={selected,...(twoLines?{subtitle:new Text('A detail')}:{} )};
      f.set(wrap({...options,tileColor:new Color(0),selectedTileColor:new Color(0)},direction));
      assert.notEqual(findInk(f).stateObject.ink.decoration,emptyInkDecoration);
      const expected=pixels(f,surface);f.set(new SizedBox(1,1));
      f.set(wrap(options,direction));assert.equal(findInk(f).stateObject.ink.decoration,emptyInkDecoration);
      assert.deepEqual(pixels(f,surface),expected,JSON.stringify({direction,selected,twoLines}));f.set(new SizedBox(1,1));
    }
  }finally{surface.delete();await f.close();}
});

test('tile updates retain Ink State and feature, user shape paint and real tap ink',{timeout},async()=>{
  const f=await engineFixture({fonts:true}),key=new GlobalKey();let taps=0,shapePaints=0;
  const options={key,onTap:()=>taps++};
  class UserShape extends RoundedRectangleBorder {paint(canvas,rect){shapePaints++;canvas.drawRect(rect,new Paint({color:0xff123456}));}}
  try{
    f.set(wrap(options));const element=findInk(f),state=element.stateObject,feature=state.ink,controller=feature.controller;
    assert.equal(feature.decoration,emptyInkDecoration);
    f.set(wrap({...options,tileColor:new Color(0xff336699)}));assert.equal(findInk(f),element);assert.equal(findInk(f).stateObject,state);assert.equal(state.ink,feature);assert.notEqual(feature.decoration,emptyInkDecoration);
    f.set(wrap({...options,shape:new UserShape(),tileColor:new Color(0)}));assert(shapePaints>0,'An explicit user shape still paints with transparent color');assert.equal(state.ink,feature);
    f.set(wrap(options));assert.equal(feature.decoration,emptyInkDecoration);assert.equal(state.ink,feature);
    f.tap('tile');assert.equal(taps,1);assert(controller.features.some(value=>value!==feature),'Tap feedback retains its own real InkFeature');f.advance(2000);
    f.set(new SizedBox(1,1));assert(feature.debugDisposed);assert.equal(controller.features.length,0);assert.equal(key.currentContext,undefined);
  }finally{await f.close();}
});

test('empty ink avoids geometry but retains equal painters, subclass dispatch and exact retirement',{timeout},()=>{
  const render=new MaterialInkRender({createTicker(){throw Error('No ticker expected');}},null,false),owner=new PipelineOwner(),canvas=new PaintingContext();
  const original=InkFeature.paintTransform;let transforms=0,customPaints=0,removed=0;
  InkFeature.paintTransform=function(...args){transforms++;return original.apply(this,args);};
  class CustomInk extends InkDecoration {paintFeature(_canvas,matrix){assert(matrix.isIdentity());customPaints++;}}
  try{
    owner.rootNode=render;render.layout(BoxConstraints.tight({width:60,height:40}));
    const options={controller:render,referenceBox:render,decoration:emptyInkDecoration,configuration:new ImageConfiguration(),onRemoved:()=>removed++};
    const feature=new InkDecoration(options);render.paint(canvas);assert.equal(transforms,0);assert.equal(render.features.length,1);
    feature.decoration=new ColorShapeDecoration(new Border(),new Color(0));assert.equal(feature.decoration,emptyInkDecoration,'An equal value preserves the previous decoration and painter');render.paint(canvas);assert.equal(transforms,1,'An explicit value still takes the ordinary paint path');
    feature.decoration=emptyInkDecoration;render.paint(canvas);assert.equal(transforms,1);
    const custom=new CustomInk(options);render.paint(canvas);assert.equal(customPaints,1);assert.equal(transforms,2,'A custom subclass still receives its virtual paint call');
    feature.dispose();custom.dispose();feature.dispose();custom.dispose();assert.equal(removed,2);assert.equal(render.features.length,0);assert.equal(canvas.getSaveCount(),1);
  }finally{InkFeature.paintTransform=original;owner.rootNode=undefined;owner.dispose();render.dispose();canvas.dispose();}
});
