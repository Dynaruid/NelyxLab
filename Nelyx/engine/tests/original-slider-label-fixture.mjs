// SPDX-License-Identifier: BSD-3-Clause
export const originalSliderLabelFixture = `import {defineOriginalEngineV2App} from '@nelyx/sdk/engine-v2-original';
import type {EngineV2AppContext} from '@nelyx/sdk/engine-v2-original';
import {StatefulWidget,State} from '@nelyx/core/framework/widgets/framework';
import {Directionality} from '@nelyx/core/framework/widgets/app-data';
import {Overlay,OverlayEntry} from '@nelyx/core/framework/widgets/overlay';
import {SizedBox,Align,Padding} from '@nelyx/core/framework/widgets/basic';
import {TextStyle} from '@nelyx/core/framework/painting/text-style';
import {Slider} from '@nelyx/material/slider';
import {Theme} from '@nelyx/material/theme';
import {ThemeData} from '@nelyx/material/theme-data';
import {SliderTheme,SliderThemeData,ShowValueIndicator} from '@nelyx/material/slider-theme';
import {RoundedRectSliderValueIndicatorShape} from '@nelyx/material/slider-shapes';
import {Color} from '@nelyx/core/ui/color';
let app:EngineV2AppContext;
class Demo extends StatefulWidget {createState(){return new DemoState();}}
class DemoState extends State<Demo> {
 value=.5;rtl=false;disabled=false;long=false;dragOnly=false;revision=0;changes=0;starts=0;ends=0;
 emit(){app.notify({kind:'label-state',value:this.value,rtl:this.rtl,disabled:this.disabled,long:this.long,
   revision:this.revision,changes:this.changes,starts:this.starts,ends:this.ends});}
 receive=(event:MessageEvent)=>{if(event.data?.kind==='label-control'){
   this.setState(()=>{const d=event.data;if(typeof d.value==='number')this.value=d.value;
    for(const key of ['rtl','disabled','long','dragOnly'] as const)if(typeof d[key]==='boolean')this[key]=d[key];this.revision++;});this.emit();}};
 override initState(){super.initState();globalThis.addEventListener('message',this.receive);}
 override dispose(){globalThis.removeEventListener('message',this.receive);super.dispose();}
 build(){return new Directionality(this.rtl?'rtl':'ltr',new Align(new Padding({left:24,top:100,right:0,bottom:0},new SizedBox(240,48,
  new Slider({value:this.value,divisions:4,year2023:false,label:this.long?'매우 긴 원래 Slider label 한글 ABC 1234567890 값 '+Math.round(this.value*100):'값 '+Math.round(this.value*100)+'%',
    id:'source-labeled-slider',showValueIndicator:this.dragOnly?ShowValueIndicator.onDrag:ShowValueIndicator.alwaysVisible,
    thumbColor:new Color(0xff33aa77),onChanged:this.disabled?null:value=>{this.setState(()=>{this.value=value;this.changes++;});this.emit();},
    onChangeStart:()=>{this.starts++;this.emit();},onChangeEnd:()=>{this.ends++;this.emit();}}))),{alignment:{x:-1,y:-1}}));}
}
export default defineOriginalEngineV2App({build(context){app=context;return new Directionality('ltr',new Theme(new ThemeData(),
 new SliderTheme(new SliderThemeData({valueIndicatorShape:new RoundedRectSliderValueIndicatorShape(),
  valueIndicatorColor:new Color(0xff284870),valueIndicatorTextStyle:new TextStyle({fontSize:14,fontFamily:'NelyxDefault',color:0xffeeee22})}),
  new Overlay({initialEntries:[new OverlayEntry({builder:()=>new Demo()})]}))));}});
`;
/** Omit both explicit choices to exercise the actual legacy default. */
export const originalDropSliderLabelFixture = originalSliderLabelFixture
  .replace('year2023:false,', '')
  .replace('valueIndicatorShape:new RoundedRectSliderValueIndicatorShape(),', '');
