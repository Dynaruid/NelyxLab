// SPDX-License-Identifier: BSD-3-Clause
export const rawImageAppSource = `import {defineOriginalEngineV2App} from '@nelyx/sdk/engine-v2-original';
import type {OriginalEngineV2AppContext} from '@nelyx/sdk/engine-v2-original';
import {StatefulWidget,State} from '@nelyx/core/framework/widgets/framework';
import type {Widget} from '@nelyx/core/framework/widgets/framework';
import {SizedBox,ColoredBox,Column,Row,Padding} from '@nelyx/core/framework/widgets/basic';
import {Directionality} from '@nelyx/core/framework/widgets/app-data';
import {RawImage} from '@nelyx/core/framework/widgets/raw-image';
import type {RawImageOptions} from '@nelyx/core/framework/widgets/raw-image';
import {Alignment} from '@nelyx/core/framework/painting/alignment';
import {ValueNotifier} from '@nelyx/core/foundation/notifier';
import {Rect} from '@nelyx/core/ui/rect';
import {ImmutableBuffer} from '@nelyx/core/ui/immutable-buffer';
import {ImageDescriptor} from '@nelyx/core/ui/image-descriptor';
import type {Image} from '@nelyx/core/ui/image';
let app:OriginalEngineV2AppContext,phase=0,change:(value:number)=>void=()=>{};
const frames:(Image|undefined)[]=[],callers:(Image|undefined)[]=[],opacity=new ValueNotifier(1);
const events=globalThis as unknown as {addEventListener(type:string,callback:(event:{data?:{kind?:string;phase?:number;value?:number}})=>void):void;removeEventListener(type:string,callback:(event:{data?:{kind?:string;phase?:number;value?:number}})=>void):void};
async function frame(second:boolean):Promise<Image>{
 const colors=second?[[0,255,255,255],[255,0,255,255],[255,255,0,255],[0,0,0,255]]:[[255,0,0,255],[0,255,0,255],[0,0,255,255],[255,255,255,255]],bytes=new Uint8Array(256*256*4);
 for(let y=0;y<256;++y)for(let x=0;x<256;++x)bytes.set(colors[(y>=128?2:0)+(x>=128?1:0)]!,4*(y*256+x));
 const buffer=await ImmutableBuffer.fromUint8List(bytes),descriptor=ImageDescriptor.raw(buffer,{width:256,height:256,pixelFormat:'rgba8888'});buffer.dispose();
 try{const codec=await descriptor.instantiateCodec();try{return(await codec.getNextFrame()).image;}finally{codec.dispose();}}finally{descriptor.dispose();}
}
function retire(){for(const value of [frames[phase],callers[phase]])if(value&&!value.debugDisposed)value.dispose();}
async function message(event:{data?:{kind?:string;phase?:number;value?:number}}){
 if(event.data?.kind==='raw-phase'){const next=event.data.phase!;if(next===1&&!frames[1]){frames[1]=await frame(true);callers[1]=frames[1]!.clone();}change(next);}
 if(event.data?.kind==='raw-opacity')opacity.value=event.data.value!;
 if(event.data?.kind==='raw-probe'){retire();app.notify({kind:'raw-state',phase,opacity:opacity.value});}
}
function receive(event:{data?:{kind?:string;phase?:number;value?:number}}){void message(event).catch(error=>app.notify({kind:'raw-error',message:String(error)}));}
class Root extends StatefulWidget{createState(){return new RootState();}}
class RootState extends State<Root>{
 override initState(){super.initState();change=value=>this.setState(()=>{phase=value;});}
 build():Widget{
  const image=frames[phase],styles:RawImageOptions[]=[
   {fit:'fill'}, {fit:'fill',matchTextDirection:true}, {fit:'fill',color:0xff00ffff}, {fit:'fill',invertColors:true},
   {fit:'fill',opacity}, {scale:16,repeat:'repeat',alignment:Alignment.topLeft}, {fit:'fill',centerSlice:Rect.fromLTRB(16,16,240,240)}, {scale:8},
   {scale:8,alignment:new Alignment(3,-3)}, {image:null}, {fit:'fill',blendMode:'multiply'}, {fit:'fill',filterQuality:'high',isAntiAlias:true},
  ];
  return new SizedBox(400,320,new ColoredBox({color:0xff102030,child:phase===2?new SizedBox(1,1):new Column([0,1,2].map(row=>new Row(styles.slice(row*4,row*4+4).map((style,col)=>new Padding({left:0,top:0,right:16,bottom:16},new Directionality(row*4+col===1?'rtl':'ltr',new RawImage({image,width:64,height:64,filterQuality:'none',...style})))))))}));
 }
}
export default defineOriginalEngineV2App({async build(context){app=context;frames[0]=await frame(false);callers[0]=frames[0]!.clone();return new Root();},ready(){events.addEventListener('message',receive);retire();app.notify({kind:'raw-ready'});},dispose(){events.removeEventListener('message',receive);for(const image of [...frames,...callers])if(image&&!image.debugDisposed)image.dispose();}});`;
