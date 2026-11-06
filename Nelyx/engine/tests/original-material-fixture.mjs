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
import {Checkbox} from '@nelyx/material/checkbox';
import {Radio} from '@nelyx/material/radio';
import {Switch} from '@nelyx/material/switch';
import {CupertinoSwitch} from '@nelyx/cupertino/switch';
import {RadioGroup} from '@nelyx/core/framework/widgets/radio-group';
import {AppFocus} from '@nelyx/core/framework/widgets/app-focus';
import {SingleActivator} from '@nelyx/core/framework/widgets/shortcuts';
import {VoidCallbackIntent,VoidCallbackAction} from '@nelyx/core/framework/widgets/actions';
import {LogicalKeyboardKey} from '@nelyx/core/services/keyboard-key';
import {Theme} from '@nelyx/material/theme';
import {ThemeData} from '@nelyx/material/theme-data';
import {FocusNode} from '@nelyx/core/framework/widgets/focus';
import {WidgetState,WidgetStatesController} from '@nelyx/core/framework/widgets/widget-state';
import {protocol as p} from '@nelyx/core/v2';
let context:EngineV2AppContext;
const key=new GlobalKey<CounterState>('original-material-screen');
const choiceToken=Symbol('material-choice');
class Counter extends StatefulWidget{createState(){return new CounterState();}}
class CounterState extends TickerProviderStateMixin<Counter>{
 taps=0;filled=0;tinted=0;outlined=0;elevated=0;checked=false;checks=0;mixed:boolean|null=null;mixes=0;choice:string|null='a';choices=0;shortcuts=0;switched=false;switches=0;cup=false;cups=0;rtlSwitch=false;rtlSwitches=0;focus=new FocusNode();radioA=new FocusNode();radioB=new FocusNode();focusEvents:object[]=[];states=new WidgetStatesController();fade!:AnimationController;
 override initState(){super.initState();this.fade=new AnimationController({vsync:this,value:1,duration:180});this.fade.addListener(()=>{if(this.mounted)this.setState(()=>{});});}
 report(which:string){setTimeout(async()=>{const cpp=await context.view.request(p.opcodes.inspect);context.notify({kind:'original-gesture-state',which,taps:this.taps,filled:this.filled,tinted:this.tinted,outlined:this.outlined,elevated:this.elevated,checked:this.checked,checks:this.checks,mixed:this.mixed,mixes:this.mixes,choice:this.choice,choices:this.choices,shortcuts:this.shortcuts,switched:this.switched,switches:this.switches,cup:this.cup,cups:this.cups,rtlSwitch:this.rtlSwitch,rtlSwitches:this.rtlSwitches,radioAFocused:this.radioA.hasPrimaryFocus,radioBFocused:this.radioB.hasPrimaryFocus,focusEvents:this.focusEvents,fade:this.fade.value,focused:this.focus.hasPrimaryFocus,pressed:this.states.value.contains(WidgetState.pressed),hovered:this.states.value.contains(WidgetState.hovered),commands:String(cpp.transactionWork),gestureWork:String(cpp.gestureWork),keyWork:String(cpp.keyWork),focusWork:String(cpp.focusWork)});},650);}
 focusChanged(which:'a'|'b',focused:boolean){const node=which==='a'?this.radioA:this.radioB;this.focusEvents.push({which,focused,...(focused?{rect:[node.rect.left,node.rect.top,node.rect.width,node.rect.height],offset:[node.offset.dx,node.offset.dy]}:{})});if(this.focusEvents.length>20)this.focusEvents.shift();}
 focusManager:any;focusTrace=()=>{const node=this.focusManager.primaryFocus;context.notify({kind:'original-focus-state',primary:node?.debugLabel,scope:node?.constructor.name,plain:node===this.focus,radioA:node===this.radioA,radioB:node===this.radioB,skip:node?.skipTraversal,can:node?.canRequestFocus});};
 change(which:'taps'|'filled'|'tinted'|'outlined'|'elevated'){this.setState(()=>{this[which]++;});if(which==='taps')this.fade.animateTo(this.fade.value>0.75?0.5:1,{duration:180});this.report(which);}
 build(){return new Directionality('ltr',new AppFocus(new Theme(new ThemeData(),new Padding({left:24,top:24},new Column([
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
  new Row([new Checkbox({value:this.checked,onChanged:value=>{this.setState(()=>{this.checked=value!;this.checks++;});this.report('checked');},semanticLabel:'Select option'}),new Text('Select option'),new SizedBox(16),new Checkbox({value:false,onChanged:null,semanticLabel:'Disabled option'}),new Text('Disabled option')],{mainAxisSize:'min',textDirection:'ltr'}),
  new Row([new Checkbox({value:this.mixed,tristate:true,onChanged:value=>{this.setState(()=>{this.mixed=value;this.mixes++;});this.report('mixed');},semanticLabel:'Mixed option'}),new Text('Mixed option')],{mainAxisSize:'min',textDirection:'ltr'}),
  new RadioGroup<string>({typeToken:choiceToken,groupValue:this.choice,onChanged:value=>{this.setState(()=>{this.choice=value;this.choices++;});this.report('choice');},child:new Row([
   new Radio({value:'a',groupToken:choiceToken,focusNode:this.radioA,onFocusChange:focused=>this.focusChanged('a',focused),shortcuts:new Map([[new SingleActivator(LogicalKeyboardKey.keyK,{control:true}),new VoidCallbackIntent(()=>{this.shortcuts++;this.report('shortcut');})]]),actions:new Map([[VoidCallbackIntent,new VoidCallbackAction()]]),semanticLabel:'Choice A'}),new Text('Choice A'),
   new Radio({value:'b',groupToken:choiceToken,toggleable:true,focusNode:this.radioB,onFocusChange:focused=>this.focusChanged('b',focused),semanticLabel:'Choice B'}),new Text('Choice B'),
   new Radio({value:'c',groupToken:choiceToken,enabled:false,semanticLabel:'Disabled choice'}),new Text('Disabled choice')
  ],{mainAxisSize:'min',textDirection:'ltr'})}),
  new Row([
   new Switch({value:this.switched,onChanged:value=>{this.setState(()=>{this.switched=value;this.switches++;});this.report('switch');},semanticLabel:'Enable feature'}),new Text('Enable feature'),
   new Switch({value:false,onChanged:null,semanticLabel:'Disabled switch'}),new Text('Disabled switch'),
   new CupertinoSwitch({value:this.cup,onChanged:value=>{this.setState(()=>{this.cup=value;this.cups++;});this.report('cup');},semanticLabel:'Apple switch'}),new Text('Apple switch')
  ],{mainAxisSize:'min',textDirection:'ltr'}),
  new Directionality('rtl',new Row([new Switch({value:this.rtlSwitch,onChanged:value=>{this.setState(()=>{this.rtlSwitch=value;this.rtlSwitches++;});this.report('rtlSwitch');},semanticLabel:'RTL switch'}),new Text('RTL switch')],{mainAxisSize:'min',textDirection:'rtl'})),
  new SizedBox(undefined,24),
  new Opacity(new ColoredBox({color:0xff4488cc,child:new SizedBox(420,120,new Center(new Text('Original AnimationController',{fontSize:22,color:0xffffffff})))}),{opacity:this.fade.value}),
  new SizedBox(undefined,18),
  new Text('opacity '+this.fade.value.toFixed(2),{fontSize:20,color:0xff172033})
 ],{mainAxisSize:'min',crossAxisAlignment:'start',textDirection:'ltr'})))));}
 override didChangeDependencies(){super.didChangeDependencies();if(!this.focusManager){this.focusManager=(this.context as any).owner.focus;this.focusManager.addListener(this.focusTrace);}}
 override dispose(){this.focusManager?.removeListener(this.focusTrace);this.fade.dispose();this.states.dispose();this.focus.dispose();this.radioA.dispose();this.radioB.dispose();super.dispose();}
}
export default defineOriginalEngineV2App({build(ctx){context=ctx;return new Counter(key);},ready(ctx){ctx.notify({kind:'original-material-ready'});}});`;
