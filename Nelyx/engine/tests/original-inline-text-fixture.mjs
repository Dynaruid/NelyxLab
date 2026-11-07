// SPDX-License-Identifier: BSD-3-Clause
export const originalInlineTextFixture = `import {defineOriginalEngineV2App} from '@nelyx/sdk/engine-v2-original';
import {StatefulWidget,State} from '@nelyx/core/framework/widgets/framework';
import {Directionality} from '@nelyx/core/framework/widgets/app-data';
import {Align,SizedBox,Row,Text,ColoredBox} from '@nelyx/core/framework/widgets/basic';
import {RichText} from '@nelyx/core/framework/widgets/rich-text';
import {WidgetSpan} from '@nelyx/core/framework/widgets/widget-span';
import {GestureDetector} from '@nelyx/core/framework/widgets/gesture-detector';
import {Semantics} from '@nelyx/core/framework/widgets/semantics';
import {ClipRect} from '@nelyx/core/framework/widgets/clip';
import {CustomPaint} from '@nelyx/core/framework/widgets/custom-paint';
import {CustomPainter} from '@nelyx/core/framework/rendering/custom-paint';
import {registerNativeRenderMetadata} from '@nelyx/core/framework/rendering/object';
import type {NativePaintEntry} from '@nelyx/core/framework/rendering/object';
import {TextPainter} from '@nelyx/core/framework/painting/text-painter';
import {TextSpan} from '@nelyx/core/framework/painting/text-span';
import {TextStyle} from '@nelyx/core/framework/painting/text-style';
import {TextScaler} from '@nelyx/core/framework/painting/text-scaler';
import {StrutStyle} from '@nelyx/core/framework/painting/strut-style';
import {PlaceholderDimensions} from '@nelyx/core/framework/painting/placeholder-dimensions';
import type {PlaceholderAlignment} from '@nelyx/core/ui/typography';
import {Canvas} from '@nelyx/core/ui/canvas';import {Offset} from '@nelyx/core/ui/offset';import {Size} from '@nelyx/core/ui/size';
const shape={kind:'rrect' as const,radii:Array(8).fill(0),strokeWidth:0,strokeColor:0,strokeAlign:0};
class ControlPainter extends CustomPainter {
 constructor(readonly entries:readonly NativePaintEntry[]){super();}
 paint(_canvas:Canvas){} shouldRepaint(old:ControlPainter){return old.entries!==this.entries;}
 static {registerNativeRenderMetadata(ControlPainter.prototype,source=>({kind:'paint',entries:source.entries}));}
}
let app:any;
class Demo extends StatefulWidget{createState(){return new DemoState();}}
class DemoState extends State<Demo>{
 revision=0;recordings:Canvas[]=[];
 receive=(event:MessageEvent)=>{if(event.data?.kind==='inline-update')this.setState(()=>{this.revision++;});};
 override initState(){super.initState();globalThis.addEventListener('message',this.receive);}
 override dispose(){globalThis.removeEventListener('message',this.receive);for(const canvas of this.recordings)canvas.dispose();super.dispose();}
 build(context:any){
  if(this.revision===3){for(const canvas of this.recordings)canvas.dispose();this.recordings=[];app.notify({kind:'inline-state',revision:this.revision,removed:true,paragraphs:0});return new SizedBox(1,1);}
  const compressed=this.revision===5,phase=compressed?0:Math.min(this.revision,2),scale=phase?1.5:1.25,width=phase===2?140:220,direction=phase===2?'rtl' as const:'ltr' as const,
   strutStyle=compressed?new StrutStyle({fontSize:8,height:0.5,forceStrutHeight:true}):undefined,
   alignments:PlaceholderAlignment[]=['baseline','aboveBaseline','belowBaseline','top','bottom','middle','baseline'],
   services={text:context.services.text,resources:context.services.resources,font:context.services.defaultFont,scale:1,locale:'en'},
   entries:NativePaintEntry[]=[],next:Canvas[]=[],children:WidgetSpan[]=[],dimensions:PlaceholderDimensions[]=[],childData:any[]=[];
  const record=(painter:TextPainter)=>{const canvas=new Canvas();next.push(canvas);painter.paint(canvas,Offset.zero);const command=canvas.commands[0];if(command?.op!=='paragraph')throw Error('Missing control paragraph');return command.resource;};
  try{
   for(let i=0;i<alignments.length;i++){
    const w=20+i,h=28+i+(phase?6:0),alignment=alignments[i]!,baseline=i===6?'ideographic' as const:'alphabetic' as const,
     color=0xffbbddaa+i*0x00040301,style=new TextStyle({fontSize:12+i%2,color:0xff112233}),label=String.fromCharCode(77+i),
     painter=new TextPainter({text:new TextSpan({text:label,style}),textDirection:'ltr'},services);
    try{painter.layout({minWidth:w,maxWidth:w});const layout=painter._layoutSnapshot(),resource=record(painter);
     childData.push({w,h,color,resource,textHeight:painter.height,alphabeticBaseline:layout.alphabeticBaseline,ideographicBaseline:layout.ideographicBaseline});
     dimensions.push(new PlaceholderDimensions({size:new Size(w*scale,h*scale),alignment,baseline,baselineOffset:alignment==='baseline'?(baseline==='ideographic'?layout.ideographicBaseline:layout.alphabeticBaseline)*scale:null}));
     children.push(new WidgetSpan(new Semantics({container:true,button:true,label:'inline-'+i,child:new GestureDetector(new SizedBox(w,h,new ColoredBox({color,child:new Text(label,{style,direction:'ltr'})})),{onTap:()=>app.notify({kind:'inline-tap',index:i,revision:this.revision})})}),{alignment,baseline}));
    }finally{painter.dispose();}
   }
   const span=new TextSpan({text:'A😀 ',style:new TextStyle({fontSize:18,color:0xffdd3300}),children:children.flatMap((child,i)=>[child,new TextSpan({text:i===children.length-1?' Z':' B '})])}),
    scaler=TextScaler.linear(scale),painter=new TextPainter({text:span,textDirection:direction,textScaler:scaler,strutStyle,...(phase===2?{maxLines:1,ellipsis:'…'}:{})},services);
   try{
    painter.setPlaceholderDimensions(dimensions);painter.layout({minWidth:width,maxWidth:width});const boxes=painter._layoutSnapshot().placeholderBoxes??[],resource=record(painter),height=painter.height;
    entries.push({kind:'paragraph',shape,color:0,paragraph:resource});
    for(let i=0;i<boxes.length;i++){const box=boxes[i]!,child=childData[i]!;
     entries.push({kind:'shape',shape,color:child.color,geometry:{kind:'program',rect:[box.x,box.y,box.width,box.height]}});
     entries.push({kind:'paragraph',shape,color:0,paragraph:child.resource,geometry:{kind:'program',rect:[box.x,box.y,child.w*scale,child.textHeight*scale]}});
    }
    for(const canvas of this.recordings)canvas.dispose();this.recordings=next;
    app.notify({kind:'inline-state',revision:this.revision,width,height,scale,compressed,boxes,dimensions:dimensions.map(d=>({width:d.size.width,height:d.size.height,baselineOffset:d.baselineOffset})),baseline:painter._layoutSnapshot().alphabeticBaseline,paragraphs:9+boxes.length});
    const recorded=new SizedBox(width,height,new CustomPaint(undefined,{painter:new ControlPainter(entries)})),control=phase===2?new ClipRect(recorded):recorded,
     options={direction,locale:'en',textScaler:scaler,strutStyle,...(phase===2?{maxLines:1,overflow:'ellipsis' as const}:{})},
     original=new SizedBox(width,height,this.revision===4?Text.rich(span,options):new RichText(span,options)),
     cell=(child:any)=>new SizedBox(288,height,new Align(child,{alignment:{x:-1,y:-1}}));
    return new Align(new Row([cell(control),cell(original)],{crossAxisAlignment:'start'}),{alignment:{x:-1,y:0}});
   }finally{painter.dispose();}
  }catch(error){for(const canvas of next)canvas.dispose();throw error;}
 }
}
export default defineOriginalEngineV2App({build(context){app=context;return new Directionality('ltr',new Demo());}});`;
