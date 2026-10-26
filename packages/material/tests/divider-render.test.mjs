// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';
import {StatelessWidget} from '@nelyx/core/framework/widgets/framework';
import {SizedBox,Center,ConstrainedBox} from '@nelyx/core/framework/widgets/basic';
import {Container} from '@nelyx/core/framework/widgets/container';
import {Directionality} from '@nelyx/core/framework/widgets/app-data';
import {BoxConstraints} from '@nelyx/core/framework/rendering/constraints';
import {BoxDecoration} from '@nelyx/core/framework/painting/box-decoration';
import {Border} from '@nelyx/core/framework/painting/box-border';
import {BorderRadius} from '@nelyx/core/framework/painting/border-radius';
import {EdgeInsetsDirectional} from '@nelyx/core/framework/painting/edge-insets';
import {GlobalKey} from '@nelyx/core/framework/widgets/global-key';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {Color} from '@nelyx/core/ui/color';
import {Divider,VerticalDivider} from '../dist/divider.js';
import {DividerTheme,DividerThemeData} from '../dist/divider-theme.js';
import {Theme,ThemeData} from '../dist/theme.js';
import {engineFixture} from './engine-fixture.mjs';
const timeout=1_200_000;
FoundationPlatform.configure({kind:'native',operatingSystem:'windows'});
// The predecessor's public primitive composition, independent of the fused
// geometry implementation. It still runs through the real Core engine.
class SourceDivider extends StatelessWidget {
  constructor(vertical,options){super(options.key);this.vertical=vertical;this.options=options;}
  build(context){
    const c=this.options,t=DividerTheme.of(context),fallback=new DividerThemeData({space:16,thickness:1,indent:0,endIndent:0,color:new Color(Theme.of(context).colorScheme.outlineVariant)});
    const extent=(this.vertical?c.width:c.height)??t.space??fallback.space,thickness=c.thickness??t.thickness??fallback.thickness,indent=c.indent??t.indent??fallback.indent,endIndent=c.endIndent??t.endIndent??fallback.endIndent;
    const side=Divider.createBorderSide(context,{color:c.color??null,width:thickness}),decoration=new BoxDecoration({borderRadius:c.radius??t.radius??fallback.radius,border:new Border(this.vertical?{left:side}:{bottom:side})});
    const line=new Container({...(this.vertical?{width:thickness}:{height:thickness}),margin:EdgeInsetsDirectional.only(this.vertical?{top:indent,bottom:endIndent}:{start:indent,end:endIndent}),decoration});
    return new SizedBox(this.vertical?extent:undefined,this.vertical?undefined:extent,new Center(line));
  }
}
let theme;
function wrap(widget,direction,local=new DividerThemeData(),data=theme??=new ThemeData()){return new Directionality(direction,new Theme(data,new DividerTheme(local,new Center(new ConstrainedBox(widget,new BoxConstraints(0,150,0,70))))));}
function geometry(render){
  const constraints=[new BoxConstraints(0,80,0,40),BoxConstraints.tight({width:35,height:21}),new BoxConstraints(100,Infinity,0,30),new BoxConstraints(0,60,90,Infinity),new BoxConstraints(),BoxConstraints.tight({width:0,height:0})];
  return {size:render.size,dry:constraints.map(c=>render.getDryLayout(c)),baseline:constraints.map(c=>render.getDryBaseline(c,'alphabetic')),intrinsics:[0,20,Infinity].map(value=>[render.getMinIntrinsicWidth(value),render.getMaxIntrinsicWidth(value),render.getMinIntrinsicHeight(value),render.getMaxIntrinsicHeight(value)]),hits:[{x:0,y:0},{x:10,y:0},{x:70,y:8},{x:149,y:15},{x:8,y:35}].map(point=>render.hitTest(point,[]))};
}
function pixels(f,surface){f.library.replay(surface.getCanvas(),{commands:f.frame()});surface.flush();const image=surface.makeImageSnapshot();try{return Buffer.from(image.readPixels(0,0,{width:240,height:160,colorType:f.ck.ColorType.RGBA_8888,alphaType:f.ck.AlphaType.Unpremul,colorSpace:f.ck.ColorSpace.SRGB}));}finally{image.delete();}}

test('finite divider owners match the preceding composition in pixels, wet/dry/intrinsic/baseline and hit geometry',{timeout},async()=>{
  const f=await engineFixture(),surface=f.ck.MakeSurface(240,160);
  const cases=[{color:null}, {height:1,width:1,indent:56}, {height:0,width:0,thickness:0}, {height:3,width:3,thickness:0}, {height:2,width:2,thickness:9,indent:4,endIndent:8}, {height:18.5,width:18.5,thickness:2.5,indent:7.25,endIndent:11.5}, {height:20,width:20,thickness:2,indent:300,endIndent:20}, {height:12,width:12,thickness:3,radius:BorderRadius.circular(4)}];
  try{
    for(const vertical of [false,true])for(const direction of ['ltr','rtl'])for(const options of cases){
      const key=new GlobalKey(),input={color:new Color(0xff2468ac),...options,key};f.set(wrap(new SourceDivider(vertical,input),direction));const reference=geometry(key.currentContext.findRenderObject()),expected=pixels(f,surface);
      f.set(wrap(vertical?new VerticalDivider(input):new Divider(input),direction));const render=key.currentContext.findRenderObject(),actual=geometry(render),rgba=pixels(f,surface);
      assert.deepEqual(actual,reference,JSON.stringify({vertical,direction,options}));let mismatch=-1;for(let i=0;i<rgba.length;i++)if(rgba[i]!==expected[i]){mismatch=i;break;}assert.equal(mismatch,-1,JSON.stringify({vertical,direction,options,mismatch,actual:rgba[mismatch],expected:expected[mismatch]}));
      if(!options.radius)assert.equal(render.constructor.name,'RenderDivider','The actual public widget uses the new owner');
    }
  }finally{surface.delete();await f.close();}
});

test('divider theme and direction updates retain their keyed render owner and retire the private decoration',{timeout},async()=>{
  const f=await engineFixture(),key=new GlobalKey();let render,line;
  try{
    f.set(wrap(new Divider({key}),'ltr'));render=key.currentContext.findRenderObject();line=render.children[0];
    const local=new DividerThemeData({space:21,thickness:4,indent:9,endIndent:3,color:new Color(0xffabcdef)});
    f.set(wrap(new Divider({key}),'rtl',local,new ThemeData({brightness:'dark'})));assert.equal(key.currentContext.findRenderObject(),render);assert.equal(render.children[0],line);assert.equal(render.size.height,21);
    assert.equal(line.size.height,4);assert.equal(line.layoutOffset.x,3);assert.equal(f.root.scheduler.transientCallbackCount,0);
    f.set(new SizedBox(1,1));assert(render.debugDisposed);assert(line.debugDisposed);assert.equal(key.currentContext,undefined);
  }finally{await f.close();}
});
