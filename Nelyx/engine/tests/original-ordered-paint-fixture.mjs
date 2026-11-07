// SPDX-License-Identifier: BSD-3-Clause
export const originalOrderedPaintFixture = `import {defineOriginalEngineV2App} from '@nelyx/sdk/engine-v2-original';
import {StatefulWidget,State} from '@nelyx/core/framework/widgets/framework';
import {Directionality} from '@nelyx/core/framework/widgets/app-data';
import {Align,SizedBox,ColoredBox} from '@nelyx/core/framework/widgets/basic';
import {Opacity} from '@nelyx/core/framework/widgets/opacity';
import {CustomPaint} from '@nelyx/core/framework/widgets/custom-paint';
import {CustomPainter} from '@nelyx/core/framework/rendering/custom-paint';
import {registerNativeRenderMetadata} from '@nelyx/core/framework/rendering/object';
import {TextPainter} from '@nelyx/core/framework/painting/text-painter';
import {TextSpan} from '@nelyx/core/framework/painting/text-span';
import {TextStyle} from '@nelyx/core/framework/painting/text-style';
import {Canvas} from '@nelyx/core/ui/canvas';import {Offset} from '@nelyx/core/ui/offset';
import {Paint} from '@nelyx/core/ui/paint';import {Rect} from '@nelyx/core/ui/rect';
class RecordedPainter extends CustomPainter {
 constructor(readonly recording:Canvas){super();}
 paint(canvas:Canvas){for(const command of this.recording.commands){
  if(command.op==='paragraph')canvas.paragraph(command.resource,command.x,command.y);
  else if(command.op==='save')canvas.save();else if(command.op==='restore')canvas.restore();
  else if(command.op==='drawRect')canvas.drawRect(command.rect,new Paint({color:command.paint.color}));
  else if(command.op==='clipRect')canvas.clipRect(command.rect,{clipOp:command.clipOp,doAntiAlias:command.doAntiAlias});
  else throw Error('Unported fixture Canvas operation');
 }}
 shouldRepaint(old:RecordedPainter){return old.recording!==this.recording;}
 static {registerNativeRenderMetadata(RecordedPainter.prototype,source=>({kind:'paint',entries:source.recording.commands.map(command=>{
  const shape={kind:'rrect' as const,radii:Array(8).fill(0),strokeWidth:0,strokeColor:0,strokeAlign:0};
  if(command.op==='paragraph')return {kind:'paragraph',shape,color:0,paragraph:command.resource,x:command.x,y:command.y};
  if(command.op==='save'||command.op==='restore')return {kind:command.op,shape,color:0};
  if(command.op==='drawRect'||command.op==='clipRect')return {kind:command.op==='drawRect'?'shape':'clip',shape,color:command.op==='drawRect'?command.paint.color:0,
   geometry:{kind:'program',rect:[command.rect.x,command.rect.y,command.rect.width,command.rect.height] as const}};
  throw Error('Unported fixture Canvas operation');
 })}));}
}
let app:any;
class Demo extends StatefulWidget {createState(){return new DemoState();}}
class DemoState extends State<Demo> {
 revision=0;foreground=true;opacity=1;bg:Canvas|undefined;fg:Canvas|undefined;
 receive=(event:MessageEvent)=>{if(event.data?.kind==='ordered-update')this.setState(()=>{this.revision++;if(typeof event.data.foreground==='boolean')this.foreground=event.data.foreground;if(typeof event.data.opacity==='number')this.opacity=event.data.opacity;});};
 override initState(){super.initState();globalThis.addEventListener('message',this.receive);}
 override dispose(){globalThis.removeEventListener('message',this.receive);this.bg?.dispose();this.fg?.dispose();super.dispose();}
 build(context:any){const bg=new Canvas(),fg=new Canvas(),font=this.revision?20:18;
  const text=(canvas:Canvas,color:number,x:number,y:number)=>{const painter=new TextPainter({text:new TextSpan({text:'MMMMMMMM',style:new TextStyle({fontSize:font,color})}),textDirection:'ltr'},
    {text:context.services.text,resources:context.services.resources,font:context.services.defaultFont,scale:1,locale:'en'});
   try{painter.layout({minWidth:180,maxWidth:180});painter.paint(canvas,new Offset(x,y));}finally{painter.dispose();}};
  const rect=(canvas:Canvas,x:number,y:number,w:number,h:number,color:number)=>canvas.drawRect(Rect.fromLTWH(x,y,w,h),new Paint({color}));
  rect(bg,0,0,300,180,0xffeeeeee);bg.save();bg.clipRect(Rect.fromLTWH(150,0,100,40));
  text(bg,this.revision?0xffffaa22:0xffeeee22,160,5);rect(bg,150,0,45,40,0xff337744);bg.restore();
  if(this.foreground){text(fg,0xffdd3300,10,50);rect(fg,10,50,35,25,0xff775599);text(fg,0xff22ddcc,180,80);}
  this.bg?.dispose();this.fg?.dispose();this.bg=bg;this.fg=fg;
  app.notify({kind:'ordered-state',revision:this.revision,foreground:this.foreground});
  return new Align(new Opacity(new SizedBox(300,180,new CustomPaint(new Align(new SizedBox(150,100,new ColoredBox({color:0xff224466})),{alignment:{x:-1,y:-1}}),
   {painter:new RecordedPainter(bg),foregroundPainter:this.foreground?new RecordedPainter(fg):null})),{opacity:this.opacity}),{alignment:{x:-1,y:-1}});
 }
}
export default defineOriginalEngineV2App({build(context){app=context;return new Directionality('ltr',new Demo());}});`;
