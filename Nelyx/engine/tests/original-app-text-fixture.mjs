// SPDX-License-Identifier: BSD-3-Clause
export const originalAppTextFixture = `import {defineOriginalEngineV2App} from '@nelyx/sdk/engine-v2-original';
import type {EngineV2AppContext} from '@nelyx/sdk/engine-v2-original';
import {LeafRenderObjectWidget,StatefulWidget,State} from '@nelyx/core/framework/widgets/framework';
import {Directionality} from '@nelyx/core/framework/widgets/app-data';
import {SizedBox,Text,Align} from '@nelyx/core/framework/widgets/basic';
import {TextPainter} from '@nelyx/core/framework/painting/text-painter';
import {TextSpan} from '@nelyx/core/framework/painting/text-span';
import {TextStyle} from '@nelyx/core/framework/painting/text-style';
import {Offset} from '@nelyx/core/ui/offset';
import {Canvas} from '@nelyx/core/ui/canvas';
import {RenderBox,registerNativeRenderMetadata} from '@nelyx/core/framework/rendering/object';
class RecordedText extends LeafRenderObjectWidget {
 constructor(readonly canvas:Canvas){super();}
 createRenderObject(){return new RecordedTextBox(this.canvas);}
 override updateRenderObject(_context:any,render:RecordedTextBox){render.recording=this.canvas;render.markNeedsPaint();}
}
class RecordedTextBox extends RenderBox {
 constructor(public recording:Canvas){super();}
 static {registerNativeRenderMetadata(RecordedTextBox.prototype,source=>({kind:'paint',entries:source.recording.commands.map(command=>{
  if(command.op!=='paragraph')throw Error('Unexpected recording command');
  return {kind:'paragraph',paragraph:command.resource,color:0,shape:{kind:'rrect',radii:Array(8).fill(0),strokeWidth:0,strokeColor:0,strokeAlign:0},x:command.x,y:command.y};
 })}));}
}
let app:EngineV2AppContext;
class Probe extends StatefulWidget{createState(){return new ProbeState();}}
class ProbeState extends State<Probe>{
 revision=0; recording:Canvas|undefined;
 receive=(event:MessageEvent)=>{if(event.data?.kind==='app-text-update')this.setState(()=>{this.revision++;});};
 override initState(){super.initState();globalThis.addEventListener('message',this.receive);}
 override dispose(){globalThis.removeEventListener('message',this.receive);this.recording?.dispose();super.dispose();}
 build(context:any){
  const value=this.revision>1?'Recovered 한글😀\\nsource State\\nbudget refusal':this.revision?'Changed 한글😀\\nשלום مرحبا\\nsource State':'한글 A😀 e\\u0301 word\\nאבג مرحبا';
  const painter=new TextPainter({text:new TextSpan({text:value,style:new TextStyle({fontSize:18,color:0xff172033})}),textDirection:'ltr'},
   {text:context.services.text,resources:context.services.resources,font:context.services.defaultFont,scale:1,locale:'en'});
  try{
   const returned=painter.layout({minWidth:180,maxWidth:180}),layout=painter._layoutSnapshot();
   if(returned!==undefined||!(painter.height>0))throw Error('TextPainter did not complete synchronously');
   const boxes=painter.getBoxesForSelection({anchor:0,focus:2});
   const hit=painter.getPositionForOffset(new Offset(20,8));
   const word=painter.getWordBoundary({offset:1});
   app.notify({kind:'app-text-geometry',revision:this.revision,value,width:painter.width,height:painter.height,
    baseline:layout.alphabeticBaseline,longestLine:layout.longestLine,lines:painter.computeLineMetrics().map(line=>({...line})),
    boxes:boxes.length,hit:hit.offset,word:[word.start,word.end]});
   const recording=new Canvas();
   try{painter.paint(recording,new Offset(4,5));}catch(error){recording.dispose();throw error;}
   this.recording?.dispose();this.recording=recording;
   return new Align(new SizedBox(180,painter.height,new RecordedText(recording)),{alignment:{x:-1,y:-1}});
  }finally{painter.dispose();}
 }
}
export default defineOriginalEngineV2App({build(context){app=context;return new Directionality('ltr',new Probe());}});
`;
