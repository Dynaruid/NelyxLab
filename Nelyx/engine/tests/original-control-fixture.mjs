// SPDX-License-Identifier: BSD-3-Clause
/** The canonical public API consumer shared by browser integration and native visual probes. */
export const originalControlFixture = `import {defineOriginalEngineV2App} from '@nelyx/sdk/engine-v2-original';
import type {EngineV2AppContext} from '@nelyx/sdk/engine-v2-original';
import {StatefulWidget} from '@nelyx/core/framework/widgets/framework';
import {TickerProviderStateMixin} from '@nelyx/core/framework/widgets/ticker-provider';
import {GlobalKey} from '@nelyx/core/framework/widgets/global-key';
import {Directionality} from '@nelyx/core/framework/widgets/app-data';
import {SizedBox,ColoredBox,Text,Column,Padding,Center,Row} from '@nelyx/core/framework/widgets/basic';
import {Opacity} from '@nelyx/core/framework/widgets/opacity';
import {AnimationController} from '@nelyx/core/framework/animation/animation-controller';
import {CupertinoButton} from '@nelyx/cupertino/button';
import {CupertinoTheme,CupertinoThemeData} from '@nelyx/cupertino/theme';
import {FocusNode} from '@nelyx/core/framework/widgets/focus';
import {WidgetState,WidgetStatesController} from '@nelyx/core/framework/widgets/widget-state';
import {protocol as p} from '@nelyx/core/v2';
let context:EngineV2AppContext;
const key=new GlobalKey<CounterState>('original-cupertino-screen');
class Counter extends StatefulWidget{createState(){return new CounterState();}}
class CounterState extends TickerProviderStateMixin<Counter>{
 taps=0;filled=0;tinted=0;focus=new FocusNode();states=new WidgetStatesController();fade!:AnimationController;
 override initState(){super.initState();this.fade=new AnimationController({vsync:this,value:1,duration:180});this.fade.addListener(()=>{if(this.mounted)this.setState(()=>{});});}
 report(which:string){setTimeout(async()=>{const cpp=await context.view.request(p.opcodes.inspect);context.notify({kind:'original-gesture-state',which,taps:this.taps,filled:this.filled,tinted:this.tinted,fade:this.fade.value,focused:this.focus.hasPrimaryFocus,pressed:this.states.value.contains(WidgetState.pressed),hovered:this.states.value.contains(WidgetState.hovered),commands:String(cpp.transactionWork),gestureWork:String(cpp.gestureWork)});},300);}
 change(which:'taps'|'filled'|'tinted'){this.setState(()=>{this[which]++;});if(which==='taps')this.fade.animateTo(this.fade.value>0.75?0.5:1,{duration:180});this.report(which);}
 build(){return new Directionality('ltr',new CupertinoTheme(new CupertinoThemeData({primaryColor:0xff2166aa}),new Padding({left:24,top:24},new Column([
  new Text('Original CupertinoButton → Native C++',{fontSize:24,color:0xff172033}),
  new SizedBox(undefined,18),
  new Text('plain '+this.taps+' / filled '+this.filled+' / tinted '+this.tinted,{fontSize:23,color:0xff172033}),
  new SizedBox(undefined,18),
  new Row([
   new CupertinoButton({child:new Text('Plain + animate'),onPressed:()=>this.change('taps'),focusNode:this.focus,statesController:this.states,onHover:hovered=>context.notify({kind:'control-hover',hovered})}),
   new SizedBox(16),
   CupertinoButton.filled({child:new Text('Filled'),onPressed:()=>this.change('filled')}),
   new SizedBox(16),
   CupertinoButton.tinted({child:new Text('Tinted'),onPressed:()=>this.change('tinted')}),
  ],{mainAxisSize:'min',crossAxisAlignment:'start',textDirection:'ltr'}),
  new SizedBox(undefined,20),
  CupertinoButton.filled({child:new Text('Disabled'),onPressed:null}),
  new SizedBox(undefined,24),
  new Opacity(new ColoredBox({color:0xff4488cc,child:new SizedBox(420,120,new Center(new Text('Original AnimationController',{fontSize:22,color:0xffffffff})))}),{opacity:this.fade.value}),
  new SizedBox(undefined,18),
  new Text('opacity '+this.fade.value.toFixed(2),{fontSize:20,color:0xff172033})
 ],{mainAxisSize:'min',crossAxisAlignment:'start',textDirection:'ltr'}))));}
 override dispose(){this.fade.dispose();this.states.dispose();this.focus.dispose();super.dispose();}
}
export default defineOriginalEngineV2App({build(ctx){context=ctx;return new Counter(key);},ready(ctx){ctx.notify({kind:'original-cupertino-ready'});}});`;
