// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import test from 'node:test';
import {InputDecoration} from '@nelyx/material/input-decoration';
import {InputDecorator} from '@nelyx/material/input-decorator';
import {InputDecoration as AggregateDecoration,InputDecorator as AggregateDecorator} from '@nelyx/material/widgets';
import {InputDecorationTheme,InputDecorationThemeData} from '@nelyx/material/input-decoration-theme';
import {InputBorder,OutlineInputBorder} from '@nelyx/material/input-border';
import {Theme} from '@nelyx/material/theme';
import {ThemeData,VisualDensity} from '@nelyx/material/theme-data';
import {FloatingLabelBehavior} from '@nelyx/material/floating-label-behavior';
import {WidgetState,WidgetStatesConstraint,WidgetStateTextStyle} from '@nelyx/core/framework/widgets/widget-state';
import {WidgetStateTextStyle as CanonicalStateStyle} from '@nelyx/core/framework/widgets/widget-state-text-style';
import {TextAlignVertical} from '@nelyx/core/framework/painting/text-align-vertical';
import {TextStyle} from '@nelyx/core/framework/painting/text-style';
import {Color} from '@nelyx/core/ui/color';
import {EdgeInsets} from '@nelyx/core/framework/painting/edge-insets';
import {BoxConstraints} from '@nelyx/core/framework/rendering/constraints';
import {RenderBox} from '@nelyx/core/framework/rendering/object';
import {LeafRenderObjectWidget,StatefulWidget,State} from '@nelyx/core/framework/widgets/framework';
import {Center,SizedBox,Builder,Text,ColoredBox} from '@nelyx/core/framework/widgets/basic';
import {DefaultTextStyle} from '@nelyx/core/framework/widgets/default-text-style';
import {MediaQuery,Directionality} from '@nelyx/core/framework/widgets/app-data';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {ValueKey} from '@nelyx/core/foundation/key';
import {Semantics} from '@nelyx/core/framework/widgets/semantics';
import {DiagnosticPropertiesBuilder} from '@nelyx/core/foundation/diagnostics';
import {FoundationBuildMode} from '@nelyx/core/foundation/constants';
import {emptyWidgetStateSet} from '@nelyx/core/internal/framework/widgets/widget-state-full-collections';
import {DartMap} from '@nelyx/core/foundation/dart-collections';
import {widgetStateConstraintKeyPolicy} from '../../../Nelyx/dist/framework/widgets/widget-state-constraint-source-adapter.js';
import {fixture} from './root-fixture.mjs';
import {engineFixture} from './engine-fixture.mjs';

const timeout=1_200_000;
FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});
const media=(child,direction='ltr',scale=1)=>new MediaQuery({width:240,height:160,scale:1,textScale:scale,safeArea:{left:0,top:0,right:0,bottom:0},keyboardInset:0},new Directionality(direction,new Theme(new ThemeData({platform:'windows',visualDensity:VisualDensity.standard}),child)));
function find(root,predicate){let found;const visit=element=>{if(predicate(element))found=element;element.visitChildren(visit);};visit(root);assert(found);return found;}
class Finite extends LeafRenderObjectWidget {
  constructor(width,height,baseline=height){super();this.dimensions={width,height,baseline};}
  createRenderObject(){return new class extends RenderBox {
    constructor(value){super();this.value=value;}
    computeDryLayout(c){return c.constrain(this.value);}performLayout(c){return this.computeDryLayout(c);}
    computeDryBaseline(c){return Math.min(this.value.baseline,this.computeDryLayout(c).height);}
    computeDistanceToActualBaseline(){return Math.min(this.value.baseline,this.size.height);}
    computeMinIntrinsicWidth(){return this.value.width;}computeMaxIntrinsicWidth(){return this.value.width;}
    computeMinIntrinsicHeight(){return this.value.height;}computeMaxIntrinsicHeight(){return this.value.height;}
  }(this.dimensions);}
}

test('InputDecoration has canonical immutable defaults, exclusive slots, null-retaining copy, collapsed and theme precedence',{timeout},()=>{
  assert.equal(AggregateDecoration,InputDecoration);assert.equal(AggregateDecorator,InputDecorator);
  const empty=new InputDecoration();assert.equal(empty.enabled,true);assert.equal(empty.maintainHintSize,true);assert.equal(empty.maintainLabelSize,false);assert.equal(empty.isDense,null);assert.equal(empty.filled,null);
  const style=new TextStyle({fontSize:19}),widget=new SizedBox(),value=new InputDecoration({labelText:'Name',labelStyle:style,isDense:false,enabled:false,filled:true});
  assert(value.equals(value.copyWith({labelText:null,labelStyle:null,isDense:null,enabled:null,filled:null})));assert.equal(value.hashCode,value.copyWith().hashCode);assert(Object.isFrozen(value));
  for(const [slot,text]of [['label','labelText'],['hint','hintText'],['helper','helperText'],['error','errorText'],['prefix','prefixText'],['suffix','suffixText']])assert.throws(()=>new InputDecoration({[slot]:widget,[text]:'conflict'}));
  for(const option of [{helperMaxLines:0},{hintMaxLines:-1},{errorMaxLines:1.2},{hintFadeDuration:-1},{maintainHintHeight:true}])assert.throws(()=>new InputDecoration(option));
  const collapsed=InputDecoration.collapsed({hintText:'Hint'});assert.equal(collapsed.isCollapsed,true);assert.equal(collapsed.border,InputBorder.none);assert.equal(collapsed.contentPadding,EdgeInsets.zero);assert.equal(collapsed.filled,false);
  assert.equal(InputDecoration.collapsed({hintText:null,border:null,filled:null}).border,null);assert.throws(()=>InputDecoration.collapsed({hintText:'Hint',labelText:'Label'}));
  const theme=new InputDecorationThemeData({labelStyle:new TextStyle({fontSize:21}),isDense:true,filled:false,hintMaxLines:3}),applied=value.applyDefaults(theme);
  assert.equal(applied.labelStyle,style);assert.equal(applied.isDense,false);assert.equal(applied.filled,true);assert.equal(applied.hintMaxLines,3);assert.equal(applied.enabled,false);assert.equal(empty.applyDefaults(new InputDecorationTheme(theme)).hintMaxLines,3);
  assert.throws(()=>empty.applyDefaults({}));
  const mode=FoundationBuildMode.mode;FoundationBuildMode.mode='debug';try{const properties=new DiagnosticPropertiesBuilder();value.debugFillProperties(properties);assert.equal(properties.properties.find(property=>property.name==='labelText').value,'Name');}finally{FoundationBuildMode.mode=mode;}
});

test('canonical vertical alignment and WidgetStateTextStyle resolve actual Core values without changing the caller state set',{timeout},()=>{
  assert.equal(CanonicalStateStyle,WidgetStateTextStyle);assert.equal(TextAlignVertical.top.y,-1);assert.equal(TextAlignVertical.center.y,0);assert.equal(TextAlignVertical.bottom.y,1);
  assert(new TextAlignVertical({y:.5}).equals(new TextAlignVertical({y:.5})));for(const y of [-2,2,NaN,Infinity])assert.throws(()=>new TextAlignVertical({y}));
  const style=WidgetStateTextStyle.resolveWith(states=>new TextStyle({fontSize:states.contains(WidgetState.focused)?20:16,color:0xff123456})),states=emptyWidgetStateSet();
  assert.equal(style.fontSize,null);assert.equal(style.resolve(states).fontSize,16);states.add(WidgetState.focused);assert.equal(style.resolve(states).fontSize,20);assert.equal(states.length,1);
  assert.throws(()=>WidgetStateTextStyle.resolveWith(()=>null).resolve(states));
  const map=new DartMap(widgetStateConstraintKeyPolicy(WidgetStatesConstraint),value=>value instanceof TextStyle),normal=new TextStyle({fontSize:16}),focused=new TextStyle({fontSize:20});
  map.set(WidgetState.focused,focused);map.set(WidgetState.any,normal);
  const mapped=WidgetStateTextStyle.fromMap(map);assert.equal(mapped.resolve(states),focused);states.clear();assert.equal(mapped.resolve(states),normal);
  assert.throws(()=>mapped.fontSize,/must be resolved/);assert.throws(()=>mapped.copyWith({fontSize:24}),/must be resolved/);
  const equivalent=WidgetStateTextStyle.fromMap(map);assert(mapped.equals(equivalent));assert.equal(mapped.hashCode,equivalent.hashCode);assert.match(mapped.toString(),/WidgetState/);
});

test('real M3 decorator lays out bounded input and independent footer slots with dry/intrinsic/baseline and RTL contracts',{timeout},()=>{
  const f=fixture();let container;
  const input=new Builder(context=>{container=InputDecorator.containerOf(context);return new Semantics({transportId:'input',label:'Input',child:new Finite(80,24,18)});});
  const decoration=new InputDecoration({filled:true,label:new Finite(60,20,15),helper:new Finite(40,12,9),counter:new Finite(20,12,9)});
  try {
    for(const direction of ['ltr','rtl']){
      const widget=new InputDecorator({decoration,child:input,isEmpty:true});
      f.set(media(new Center(new SizedBox(200,undefined,widget)),direction));
      const render=find(f.root.root,element=>element.widget.constructor.name==='DecorationLayout').renderObject;
      assert(container);assert.deepEqual(container.size,{width:200,height:56});assert.deepEqual(render.size,{width:200,height:72});
      const constraints=new BoxConstraints(0,200,0,160);assert.deepEqual(render.getDryLayout(constraints),render.size);assert.equal(render.getDryBaseline(constraints,'alphabetic'),42);assert.equal(render.getDistanceToActualBaseline('alphabetic'),42);
      assert(Number.isFinite(render.getMinIntrinsicWidth(160)));assert(Number.isFinite(render.getMaxIntrinsicHeight(200)));
      const node=f.root.nodes.find(node=>node.id==='input');assert.equal(node.bounds.width,168);assert.equal(node.bounds.x,36);assert.equal(node.bounds.y,68);
    }
    f.set(media(new Center(new SizedBox(200,undefined,new InputDecorator({decoration:InputDecoration.collapsed({hintText:null}),child:new Finite(80,12,9)})))));
    f.advance(168); // The previous helper remains during its real outgoing transition.
    const render=find(f.root.root,element=>element.widget.constructor.name==='DecorationLayout').renderObject;assert.deepEqual(render.size,{width:200,height:12});
  }finally{f.close();}
});

test('focused/stateful themes resolve at their slots, interrupted floating motion retains child State and retires every ticker',{timeout},()=>{
  const f=fixture(),seen=[],counts={created:0,disposed:0};
  class Probe extends StatefulWidget {createState(){counts.created++;return new class extends State{build(){return new Finite(80,24,18);}dispose(){counts.disposed++;super.dispose();}}();}}
  const child=new Probe(),label=new Builder(context=>{seen.push(DefaultTextStyle.of(context).style);return new Finite(60,20,15);});
  const stateStyle=WidgetStateTextStyle.resolveWith(states=>new TextStyle({fontSize:states.contains(WidgetState.focused)?22:18,color:states.contains(WidgetState.focused)?0xff123456:0xff654321}));
  const decoration=new InputDecoration({filled:true,label,floatingLabelStyle:stateStyle,labelStyle:stateStyle});
  const make=(focused,empty=true)=>media(new Center(new SizedBox(200,undefined,new InputDecorationTheme(new InputDecorationThemeData({labelStyle:new TextStyle({fontSize:40})}),new InputDecorator({key:new ValueKey('field'),decoration,isFocused:focused,isEmpty:empty,child})))));
  try{
    f.set(make(false));assert.equal(seen.at(-1).fontSize,18);f.set(make(true));f.advance(84);assert(seen.at(-1).fontSize>18&&seen.at(-1).fontSize<22);f.set(make(true,false));f.advance(100);assert.equal(seen.at(-1).fontSize,22);assert.equal(seen.at(-1).color,0xff123456);assert.equal(counts.created,1);
    f.set(make(false,false));f.advance(168);assert.equal(seen.at(-1).fontSize,18);assert.equal(counts.disposed,0);f.set(new SizedBox());assert.equal(counts.disposed,1);assert.equal(f.root.scheduler.transientCallbackCount,0);
  }finally{f.close();}
});

test('actual owned paragraphs and outline gap paint reach the production CPU raster and retire on error/theme replacement',{timeout},async()=>{
  const f=await engineFixture({fonts:true}),surface=f.ck.MakeSurface(240,160);
  const make=error=>media(new Center(new SizedBox(220,undefined,new InputDecorator({decoration:new InputDecoration({labelText:'Name',hintText:'Type here',helperText:'Helper',errorText:error,counterText:'2 / 8',filled:true,border:new OutlineInputBorder(),fillColor:new Color(0xffeeeeee)}),isEmpty:false,isFocused:true,child:new Text('AB')}))));
  try{
    f.set(make(null));f.advance(180);let commands=f.frame();assert(commands.some(command=>command.op==='drawPath'));assert(commands.some(command=>command.op==='paragraph'));
    f.library.replay(surface.getCanvas(),{commands});surface.flush();const snapshot=surface.makeImageSnapshot();try{const pixels=snapshot.readPixels(0,0,{width:240,height:160,colorType:f.ck.ColorType.RGBA_8888,alphaType:f.ck.AlphaType.Unpremul,colorSpace:f.ck.ColorSpace.SRGB});assert(pixels.some((value,index)=>index%4!==3&&value>200));}finally{snapshot.delete();}
    f.set(make('Required'));f.advance(200);commands=f.frame();assert(f.root.nodes.some(node=>node.name.includes('Required')||node.tooltip?.includes('Required')));f.library.replay(surface.getCanvas(),{commands});surface.flush();
    f.set(new SizedBox());f.advance(200);assert.equal(f.root.scheduler.transientCallbackCount,0);assert.equal(f.library.paragraphs.size,0);
  }finally{surface.delete();await f.close();}
});
