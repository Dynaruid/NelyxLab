// SPDX-License-Identifier: BSD-3-Clause
/** The canonical public API consumer shared by browser integration and native visual probes. */
export const originalMaterialFixture = `import {defineOriginalEngineV2App} from '@nelyx/sdk/engine-v2-original';
import type {EngineV2AppContext} from '@nelyx/sdk/engine-v2-original';
import {StatefulWidget} from '@nelyx/core/framework/widgets/framework';
import {TickerProviderStateMixin} from '@nelyx/core/framework/widgets/ticker-provider';
import {GlobalKey} from '@nelyx/core/framework/widgets/global-key';
import {Directionality} from '@nelyx/core/framework/widgets/app-data';
import {SizedBox,ColoredBox,Text,Column,Padding,Center,Row} from '@nelyx/core/framework/widgets/basic';
import {Opacity} from '@nelyx/core/framework/widgets/opacity';
import {AnimationController} from '@nelyx/core/framework/animation/animation-controller';
import {TextButton} from '@nelyx/material/text-button';
import {FilledButton} from '@nelyx/material/filled-button';
import {OutlinedButton} from '@nelyx/material/outlined-button';
import {ElevatedButton} from '@nelyx/material/elevated-button';
import {Theme} from '@nelyx/material/theme';
import {ThemeData} from '@nelyx/material/theme-data';
import {FocusNode} from '@nelyx/core/framework/widgets/focus';
import {WidgetState,WidgetStatesController} from '@nelyx/core/framework/widgets/widget-state';
import {protocol as p} from '@nelyx/core/v2';
let context:EngineV2AppContext;
const key=new GlobalKey<CounterState>('original-cupertino-screen');
class Counter extends StatefulWidget{createState(){return new CounterState();}}
class CounterState extends TickerProviderStateMixin<Counter>{
 taps=0;filled=0;tinted=0;outlined=0;elevated=0;focus=new FocusNode();states=new WidgetStatesController();fade!:AnimationController;
 override initState(){super.initState();this.fade=new AnimationController({vsync:this,value:1,duration:180});this.fade.addListener(()=>{if(this.mounted)this.setState(()=>{});});}
 report(which:string){setTimeout(async()=>{const cpp=await context.view.request(p.opcodes.inspect);context.notify({kind:'original-gesture-state',which,taps:this.taps,filled:this.filled,tinted:this.tinted,outlined:this.outlined,elevated:this.elevated,fade:this.fade.value,focused:this.focus.hasPrimaryFocus,pressed:this.states.value.contains(WidgetState.pressed),hovered:this.states.value.contains(WidgetState.hovered),commands:String(cpp.transactionWork),gestureWork:String(cpp.gestureWork)});},650);}
 change(which:'taps'|'filled'|'tinted'|'outlined'|'elevated'){this.setState(()=>{this[which]++;});if(which==='taps')this.fade.animateTo(this.fade.value>0.75?0.5:1,{duration:180});this.report(which);}
 build(){return new Directionality('ltr',new Theme(new ThemeData(),new Padding({left:24,top:24},new Column([
  new Text('Original Material buttons → Native C++',{fontSize:24,color:0xff172033}),
  new SizedBox(undefined,18),
  new Text('plain '+this.taps+' / filled '+this.filled+' / tinted '+this.tinted,{fontSize:23,color:0xff172033}),
  new SizedBox(undefined,18),
  new Row([
   new TextButton({child:new Text('Plain + animate'),onPressed:()=>this.change('taps'),focusNode:this.focus,statesController:this.states,onHover:hovered=>context.notify({kind:'control-hover',hovered})}),
   new SizedBox(16),
   new FilledButton({child:new Text('Filled'),onPressed:()=>this.change('filled')}),
   new SizedBox(16),
   FilledButton.tonal({child:new Text('Tinted'),onPressed:()=>this.change('tinted')}),
   new SizedBox(16),
   new OutlinedButton({child:new Text('Outlined'),onPressed:()=>this.change('outlined')}),
   new SizedBox(16),
   new ElevatedButton({child:new Text('Elevated'),onPressed:()=>this.change('elevated')}),
  ],{mainAxisSize:'min',crossAxisAlignment:'start',textDirection:'ltr'}),
  new SizedBox(undefined,20),
  new FilledButton({child:new Text('Disabled'),onPressed:null}),
  new SizedBox(undefined,24),
  new Opacity(new ColoredBox({color:0xff4488cc,child:new SizedBox(420,120,new Center(new Text('Original AnimationController',{fontSize:22,color:0xffffffff})))}),{opacity:this.fade.value}),
  new SizedBox(undefined,18),
  new Text('opacity '+this.fade.value.toFixed(2),{fontSize:20,color:0xff172033})
 ],{mainAxisSize:'min',crossAxisAlignment:'start',textDirection:'ltr'}))));}
 override dispose(){this.fade.dispose();this.states.dispose();this.focus.dispose();super.dispose();}
}
export default defineOriginalEngineV2App({build(ctx){context=ctx;return new Counter(key);},ready(ctx){ctx.notify({kind:'original-cupertino-ready'});}});`;
