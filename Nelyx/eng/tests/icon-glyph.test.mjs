// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {engineFixture,assertParagraphOwnership} from '../../../packages/material/tests/engine-fixture.mjs';
import {Icon} from '@nelyx/core/framework/widgets/icon';
import {IconTheme} from '@nelyx/core/framework/widgets/icon-theme';
import {IconThemeData} from '@nelyx/core/framework/widgets/icon-theme-data';
import {Directionality,MediaQuery} from '@nelyx/core/framework/widgets/app-data';
import {SizedBox,Center,Transform,Row} from '@nelyx/core/framework/widgets/basic';
import {Semantics,ExcludeSemantics} from '@nelyx/core/framework/widgets/semantics';
import {RichText} from '@nelyx/core/framework/widgets/rich-text';
import {TextSpan} from '@nelyx/core/framework/painting/text-span';
import {TextStyle} from '@nelyx/core/framework/painting/text-style';
import {TextScaler} from '@nelyx/core/framework/painting/text-scaler';
import {BoxConstraints} from '@nelyx/core/framework/rendering/constraints';
import {GlobalKey} from '@nelyx/core/framework/widgets/global-key';
import {Color} from '@nelyx/core/ui/color';
import {Paint} from '@nelyx/core/ui/paint';
import {FontVariation} from '@nelyx/core/ui/typography';
import {Shadow} from '@nelyx/core/ui/shadow';
import {Icons} from '@nelyx/material/icons';

const timeout=1_200_000;
// Independent former composition: compare observable geometry, glyph pixels
// and semantics against the existing public render primitives, not node count.
class ComposedIcon extends Icon {
  build(context){
    const direction=this.textDirection??Directionality.maybeOf(context),theme=IconTheme.of(context);
    const tentative=this.size??theme.size??14,size=(this.applyTextScaling??theme.applyTextScaling??false)?MediaQuery.textScalerOf(context).scale(tentative):tentative;
    if(this.icon===null)return new Semantics({label:this.semanticLabel,child:new SizedBox(size,size)});
    let color=this.color??theme.color;
    if((theme.opacity??1)!==1)color=color.withOpacity(color.opacity*theme.opacity);
    const foreground=this.blendMode===null?null:new Paint({blendMode:this.blendMode,color:color.toARGB32()}),variations=[];
    for(const [axis,value]of [['FILL',this.fill??theme.fill],['wght',this.weight??theme.weight],['GRAD',this.grade??theme.grade],['opsz',this.opticalSize??theme.opticalSize]])if(value!==null)variations.push(new FontVariation(axis,value));
    const style=new TextStyle({fontVariations:variations,inherit:false,color:foreground===null?color.toARGB32():null,fontSize:size,fontFamily:this.icon.fontFamily,fontWeight:this.fontWeight,package:this.icon.fontPackage,fontFamilyFallback:this.icon.fontFamilyFallback,shadows:this.shadows??theme.shadows,height:1,leadingDistribution:'even',foreground});
    let child=new RichText(new TextSpan({text:String.fromCodePoint(this.icon.codePoint),style}),{direction,overflow:'visible',style,textScaler:TextScaler.noScaling});
    if(this.icon.matchTextDirection&&direction==='rtl')child=Transform.scale(child,{scaleX:-1,scaleY:1,transformHitTests:false});
    return new Semantics({label:this.semanticLabel,child:new ExcludeSemantics(new SizedBox(size,size,new Center(child)))});
  }
}
const media={width:240,height:160,scale:1,textScale:1.6,textScaler:TextScaler.linear(1.6),safeArea:{left:0,top:0,right:0,bottom:0},keyboardInset:0};
function wrap(child,direction='ltr',theme=new IconThemeData({color:new Color(0xff115599)}),box=null){
  return new Directionality(direction,new MediaQuery(media,new IconTheme(theme,new Center(box===null?child:new SizedBox(box[0],box[1],child)))));
}
function renderFor(_f,key){const element=key.currentElement;assert(element);return element.findRenderObject();}
function semanticValue({id,sourceNodeId,children,...node}){return {...node,...children?{children:children.map(semanticValue)}:{}};}
function nodes(f){return f.root.nodes.map(semanticValue);}
function pixels(f,surface,commands){
  const canvas=surface.getCanvas();canvas.clear(f.ck.Color(0,0,0,0));f.library.replay(canvas,{commands});surface.flush();
  return new Uint8Array(canvas.readPixels(0,0,{width:240,height:160,colorType:f.ck.ColorType.RGBA_8888,alphaType:f.ck.AlphaType.Unpremul,colorSpace:f.ck.ColorSpace.SRGB}));
}

test('Icon primitive matches composed glyph pixels, dry geometry, baseline, hit and semantic exclusion',{timeout},async()=>{
  const f=await engineFixture({fonts:true}),surface=f.ck.MakeSurface(240,160);assert(surface);
  const cases=[
    {icon:Icons.arrow_back,options:{size:24,semanticLabel:'뒤로'}},
    {icon:Icons.arrow_back,options:{size:24,semanticLabel:''},box:[11,13]},
    {icon:Icons.check,options:{size:18},box:[43,37]},
    {icon:Icons.check_circle,options:{size:22,semanticLabel:'완료',applyTextScaling:true}},
    {icon:Icons.arrow_back,options:{size:23,blendMode:'srcOver',semanticLabel:'back',textDirection:'rtl'}},
    {icon:Icons.check,options:{size:25,fill:.5,weight:500,shadows:[new Shadow({color:0xff123456,offset:{x:2,y:3},blurRadius:1})]},theme:new IconThemeData({color:new Color(0xff6789ab),opacity:.6})},
  ];
  try{
    for(const direction of ['ltr','rtl'])for(const row of cases){
      const observe=IconType=>{
        const key=new GlobalKey(),commands=f.set(wrap(new IconType(row.icon,{...row.options,key}),direction,row.theme,row.box??null)),render=renderFor(f,key);
        const constraints=[new BoxConstraints(0,9,0,11),new BoxConstraints(40,60,32,64),new BoxConstraints()];
        return {pixels:pixels(f,surface,commands),size:render.size,intrinsic:[render.getMinIntrinsicWidth(200),render.getMaxIntrinsicWidth(200),render.getMinIntrinsicHeight(200),render.getMaxIntrinsicHeight(200)],dry:constraints.map(c=>render.getDryLayout(c)),baseline:render.getDistanceToBaseline('alphabetic',{onlyReal:true}),dryBaseline:constraints.map(c=>render.getDryBaseline(c,'alphabetic')),hits:[{x:0,y:0},{x:render.size.width/2,y:render.size.height/2},{x:render.size.width-0.1,y:render.size.height-0.1}].map(point=>render.hitTest(point,[])),nodes:nodes(f)};
      };
      const composed=observe(ComposedIcon),primitive=observe(Icon);
      assert.deepEqual(primitive,composed,'Icon differential '+direction+' '+JSON.stringify(row.options));
      assert([...f.library.paragraphs.values()].every(p=>p.layout.unresolvedGlyphs===0));
      f.set(new SizedBox(1,1));assertParagraphOwnership(f);
    }
  }finally{surface.delete();await f.close();}
});

test('Icon retains its key/render owner across theme, direction, label and glyph updates and retires its private paragraph',{timeout},async()=>{
  const f=await engineFixture({fonts:true}),key=new GlobalKey();
  try{
    f.set(wrap(new Icon(Icons.arrow_back,{key,size:24,semanticLabel:'처음'})));
    const element=key.currentElement,render=renderFor(f,key),paragraph=render.children[0],semanticId=f.root.nodes.find(node=>node.name==='처음').id;
    assert(paragraph&&paragraph.attached);assert.equal(render.children.length,1);
    f.set(wrap(new Icon(Icons.check,{key,size:31,semanticLabel:'다음',applyTextScaling:true}),'rtl',new IconThemeData({color:new Color(0xffff3300)})));
    assert.equal(key.currentElement,element);assert.equal(renderFor(f,key),render);assert.equal(render.children[0],paragraph);
    assert.equal(render.size.width,31*1.6);assert(f.root.nodes.some(node=>node.name==='다음'));
    assert.equal(f.root.nodes.find(node=>node.name==='다음').id,semanticId);
    assert(!f.root.nodes.some(node=>node.name.includes(String.fromCodePoint(Icons.check.codePoint))));
    f.set(new SizedBox(1,1));assert.equal(render.debugDisposed,true);assert.equal(paragraph.debugDisposed,true);assert.equal(key.currentElement,undefined);assertParagraphOwnership(f);
  }finally{await f.close();}
});

test('a keyed Icon reparents its private paragraph and font subscription with the live render owner',{timeout},async()=>{
  const f=await engineFixture({fonts:true}),key=new GlobalKey();
  const pane=(child,color,direction)=>new SizedBox(80,80,wrap(child,direction,new IconThemeData({color:new Color(color)})));
  const tree=right=>new Row([
    pane(right?new SizedBox(1,1):new Icon(Icons.arrow_back,{key,size:24,semanticLabel:'이동'}),0xffee2200,'ltr'),
    pane(right?new Icon(Icons.arrow_back,{key,size:24,semanticLabel:'이동'}):new SizedBox(1,1),0xff0022ee,'rtl'),
  ]);
  try{
    f.set(tree(false));const element=key.currentElement,render=renderFor(f,key),paragraph=render.children[0];
    for(const right of [true,false]){
      f.set(tree(right));assert.equal(key.currentElement,element);assert.equal(renderFor(f,key),render);assert.equal(render.children[0],paragraph);assert(paragraph.attached);
      const node=f.root.nodes.find(node=>node.name==='이동');assert(node);assert.equal(node.textDirection,right?'rtl':'ltr');assert.equal(node.bounds.x,right?108:28);
    }
    f.set(new SizedBox(1,1));assert(paragraph.debugDisposed);assertParagraphOwnership(f);
  }finally{await f.close();}
});
