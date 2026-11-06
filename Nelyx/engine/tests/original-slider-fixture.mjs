// SPDX-License-Identifier: BSD-3-Clause
export const originalSliderFixture = `import {defineOriginalEngineV2App} from '@nelyx/sdk/engine-v2-original';
import type {EngineV2AppContext} from '@nelyx/sdk/engine-v2-original';
import {StatefulWidget,State} from '@nelyx/core/framework/widgets/framework';
import {Directionality} from '@nelyx/core/framework/widgets/app-data';
import {SizedBox,Text,Column,Row,Padding} from '@nelyx/core/framework/widgets/basic';
import {CupertinoTheme,CupertinoThemeData} from '@nelyx/cupertino/theme';
import {CupertinoSlider} from '@nelyx/cupertino/slider';
import {CupertinoButton} from '@nelyx/cupertino/button';
import {Color} from '@nelyx/core/ui/color';
let context:EngineV2AppContext;
class Demo extends StatefulWidget {createState(){return new DemoState();}}
class DemoState extends State<Demo> {
 value=.5;accept=true;disabled=false;disableOnChange=false;rtl=false;changes=0;starts=0;ends=0;trace:{kind:string;value:number}[]=[];
 report(kind:string,value=this.value){this.trace.push({kind,value});if(this.trace.length>24)this.trace.shift();context.notify({kind:'slider-state',value:this.value,accept:this.accept,disabled:this.disabled,disableOnChange:this.disableOnChange,rtl:this.rtl,changes:this.changes,starts:this.starts,ends:this.ends,trace:[...this.trace]});}
 change(value:number){this.setState(()=>{this.changes++;if(this.accept)this.value=value;if(this.disableOnChange){this.disabled=true;this.disableOnChange=false;}});this.report('change',value);}
 toggle(which:'accept'|'disabled'|'rtl'){this.setState(()=>{this[which]=!this[which];});this.report(which);}
 build(){return new Directionality(this.rtl?'rtl':'ltr',new CupertinoTheme(new CupertinoThemeData(),new Padding({left:24,top:24},new Column([
  new Text('Original CupertinoSlider',{fontSize:22,color:0xff172033}),new SizedBox(undefined,24),
  new CupertinoSlider({value:this.value,divisions:4,id:'source-slider',activeColor:new Color(0xffbb4466),thumbColor:new Color(0xff33aa77),onChanged:this.disabled?null:value=>this.change(value),onChangeStart:value=>{this.starts++;this.report('start',value);},onChangeEnd:value=>{this.ends++;this.report('end',value);}}),
  new SizedBox(undefined,24),
  new Row([
   new CupertinoButton({child:new Text('Toggle acceptance'),onPressed:()=>this.toggle('accept')}),new SizedBox(8),
   new CupertinoButton({child:new Text('Toggle disabled'),onPressed:()=>this.toggle('disabled')}),new SizedBox(8),
   new CupertinoButton({child:new Text('Toggle direction'),onPressed:()=>this.toggle('rtl')})
  ],{mainAxisSize:'min',crossAxisAlignment:'start',textDirection:this.rtl?'rtl':'ltr'}),
  new CupertinoButton({child:new Text('Disable on next change'),onPressed:()=>{this.setState(()=>{this.disableOnChange=true;});this.report('disableOnChange');}}),
  new Text('value '+this.value,{fontSize:18,color:0xff172033})
 ],{mainAxisSize:'min',crossAxisAlignment:'start',textDirection:this.rtl?'rtl':'ltr'}))));}
}
export default defineOriginalEngineV2App({build(ctx){context=ctx;return new Demo();}});`;

export const originalMaterialSliderFixture = originalSliderFixture
  .replace(
    "import {CupertinoSlider} from '@nelyx/cupertino/slider';",
    "import {Slider} from '@nelyx/material/slider';\nimport {Theme} from '@nelyx/material/theme';\nimport {ThemeData} from '@nelyx/material/theme-data';",
  )
  .replace(
    'new CupertinoTheme(new CupertinoThemeData(),new Padding',
    'new Theme(new ThemeData(),new Padding',
  )
  .replace('Original CupertinoSlider', 'Original Material Slider')
  .replace('new CupertinoSlider({', 'new SizedBox(176,48,new Slider({')
  .replace("this.report('end',value);}}),", "this.report('end',value);}})),");
