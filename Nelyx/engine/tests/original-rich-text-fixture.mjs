// SPDX-License-Identifier: BSD-3-Clause
export const originalRichTextFixture = `import {defineOriginalEngineV2App} from '@nelyx/sdk/engine-v2-original';
import {StatefulWidget,State} from '@nelyx/core/framework/widgets/framework';
import {Directionality} from '@nelyx/core/framework/widgets/app-data';
import {Align,SizedBox,Row,Text} from '@nelyx/core/framework/widgets/basic';
import {RichText} from '@nelyx/core/framework/widgets/rich-text';
import {Opacity} from '@nelyx/core/framework/widgets/opacity';
import {ClipRect} from '@nelyx/core/framework/widgets/clip';
import {CustomPaint} from '@nelyx/core/framework/widgets/custom-paint';
import {CustomPainter} from '@nelyx/core/framework/rendering/custom-paint';
import {registerNativeRenderMetadata} from '@nelyx/core/framework/rendering/object';
import {TextPainter} from '@nelyx/core/framework/painting/text-painter';
import {TextSpan} from '@nelyx/core/framework/painting/text-span';
import {TextStyle} from '@nelyx/core/framework/painting/text-style';
import {TextScaler} from '@nelyx/core/framework/painting/text-scaler';
import {StrutStyle} from '@nelyx/core/framework/painting/strut-style';
import {FontWeight,TextDecoration,FontFeature,FontVariation} from '@nelyx/core/ui/typography';
import {Shadow} from '@nelyx/core/ui/shadow';
import {Paint} from '@nelyx/core/ui/paint';
import {Canvas} from '@nelyx/core/ui/canvas';import {Offset} from '@nelyx/core/ui/offset';
class RecordedPainter extends CustomPainter {
 constructor(readonly recording:Canvas){super();}
 paint(canvas:Canvas){for(const command of this.recording.commands){if(command.op!=='paragraph')throw Error('Unexpected fixture Canvas command');canvas.paragraph(command.resource,command.x,command.y);}}
 shouldRepaint(old:RecordedPainter){return old.recording!==this.recording;}
 static {registerNativeRenderMetadata(RecordedPainter.prototype,source=>({kind:'paint',entries:source.recording.commands.map(command=>{
  if(command.op!=='paragraph')throw Error('Unexpected fixture Canvas command');
  return {kind:'paragraph',paragraph:command.resource,x:command.x,y:command.y,color:0,shape:{kind:'rrect' as const,radii:Array(8).fill(0),strokeWidth:0,strokeColor:0,strokeAlign:0}};
 })}));}
}
let app:any;
class Demo extends StatefulWidget{createState(){return new DemoState();}}
class DemoState extends State<Demo>{
 revision=0;recording:Canvas|undefined;
 receive=(event:MessageEvent)=>{if(event.data?.kind==='rich-update')this.setState(()=>{this.revision++;});};
 override initState(){super.initState();globalThis.addEventListener('message',this.receive);}
 override dispose(){globalThis.removeEventListener('message',this.receive);this.recording?.dispose();super.dispose();}
 build(context:any){
  if(this.revision===3){this.recording?.dispose();this.recording=undefined;app.notify({kind:'rich-state',revision:this.revision,removed:true});return new SizedBox(1,1);}
  const phase=Math.min(this.revision,2),width=phase===2?140:180,scaler=TextScaler.linear(phase?1.5:1.25),direction=phase===2?'rtl' as const:'ltr' as const;
  const span=new TextSpan({text:'A😀 ',style:new TextStyle({fontSize:18,color:0xffdd3300,fontFeatures:[FontFeature.disable('liga')],shadows:[new Shadow({color:0xff00bbdd,offset:new Offset(-12,-4),blurRadius:3})]}),children:[
   new TextSpan({text:'MMMM ',style:new TextStyle({fontSize:phase?30:26,color:phase?0xffbb22aa:0xff2255cc,fontWeight:phase?FontWeight.w900:FontWeight.w700,fontVariations:[FontVariation.weight(phase?900:250)],fontStyle:'italic',backgroundColor:phase?0xffccffaa:0xffffee99,decoration:TextDecoration.combine([TextDecoration.underline,TextDecoration.lineThrough]),decorationStyle:'wavy',decorationColor:0xff009966,decorationThickness:2})}),
   new TextSpan({text:'e\\u0301 אבג مرحبا 한글',style:new TextStyle({fontSize:22,foreground:new Paint({color:0xff882277}),fontFamily:'NelyxDefault',fontFamilyFallback:['NelyxArabic','NelyxHebrew'],locale:'he',shadows:[new Shadow({color:0xffcc5500,offset:new Offset(24,30)}),new Shadow({color:0xff00bbdd,offset:new Offset(-12,-4),blurRadius:3})]})}),
  ]});
  const strutStyle=new StrutStyle({fontSize:24,height:1.4,leading:0.2,forceStrutHeight:phase===0,leadingDistribution:phase?'proportional':'even'}),
   options={textDirection:direction,textScaler:scaler,strutStyle,...(phase===2?{maxLines:2,ellipsis:'…'}:{})},
   painter=new TextPainter({text:span,...options},{text:context.services.text,resources:context.services.resources,font:context.services.defaultFont,scale:1,locale:'en'}),recording=new Canvas();
  try{
   if(painter.layout({minWidth:width,maxWidth:width})!==undefined)throw Error('Rich TextPainter layout must be synchronous');
   const layout=painter._layoutSnapshot(),glyph=context.services.text.glyphAt(layout,1),boxes=painter.getBoxesForSelection({anchor:1,focus:3});
   if(glyph?.start!==1||glyph.end!==3||!boxes.length)throw Error('Rich UTF16 glyph/selection query failed');
   painter.paint(recording,Offset.zero);this.recording?.dispose();this.recording=recording;
   app.notify({kind:'rich-state',revision:this.revision,width,height:painter.height,baseline:layout.alphabeticBaseline,lines:painter.computeLineMetrics().length});
   const recorded=new SizedBox(width,painter.height,new CustomPaint(undefined,{painter:new RecordedPainter(recording)})),
    richOptions={direction,locale:'en',textScaler:scaler,strutStyle,...(phase===2?{maxLines:2,overflow:'ellipsis' as const}:{})},
    original=new SizedBox(width,painter.height,this.revision===4?Text.rich(span,richOptions):new RichText(span,richOptions)),
    cell=(child:any)=>new SizedBox(288,painter.height,new Align(child,{alignment:{x:-1,y:-1}}));
   return new Align(new Opacity(new Row([cell(phase===2?new ClipRect(recorded):recorded),cell(original)],{crossAxisAlignment:'start'}),{opacity:phase===1?0.75:1}),{alignment:{x:-1,y:-1}});
  }catch(error){recording.dispose();throw error;}finally{painter.dispose();}
 }
}
export default defineOriginalEngineV2App({build(context){app=context;return new Directionality('ltr',new Demo());}});`;
