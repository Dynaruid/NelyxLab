// SPDX-License-Identifier: BSD-3-Clause
import { imageFixture } from './app-images-probe.mjs';

export function providerHttpFixture() {
  const png = Buffer.from(imageFixture.png, 'base64'),
    ancillary = Buffer.alloc(128 * 1024 + 12),
    calls = [],
    timers = new Set(),
    sockets = new Set();
  let crossOrigin;
  // An unknown ancillary chunk keeps the 2x1 pixels unchanged while forcing
  // actual Native 64 KiB and Web stream boundaries.
  ancillary.writeUInt32BE(128 * 1024, 0);
  ancillary.write('npAg', 4);
  let crc = 0xffffffff;
  for (const value of ancillary.subarray(4, -4)) {
    crc ^= value;
    for (let bit = 0; bit < 8; ++bit) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  ancillary.writeUInt32BE((crc ^ 0xffffffff) >>> 0, ancillary.length - 4);
  const streamed = Buffer.concat([png.subarray(0, -12), ancillary, png.subarray(-12)]);
  return {
    calls,
    setCrossOrigin(value) {
      crossOrigin = value;
    },
    handle(request, response) {
      const path = request.url.split('?')[0];
      if (!path.startsWith('/provider/')) return false;
      calls.push({ path, url: request.url, headers: request.headers });
      sockets.add(response);
      response.once('close', () => sockets.delete(response));
      response.setHeader('Access-Control-Allow-Origin', '*');
      response.setHeader('Access-Control-Allow-Headers', 'Authorization, X-Nelyx-Image');
      if (request.method === 'OPTIONS') {
        response.writeHead(204);
        response.end();
        return true;
      }
      if (path === '/provider/same' || path === '/provider/cross') {
        response.writeHead(302, {
          Location: path.endsWith('cross')
            ? crossOrigin + '/provider/redirected'
            : '/provider/redirected',
        });
        response.end();
      } else if (path === '/provider/missing') {
        response.writeHead(404);
        response.end();
      } else if (path === '/provider/large') {
        response.writeHead(200, { 'Content-Length': 17 * 1024 * 1024 });
        response.flushHeaders();
      } else if (path === '/provider/stall') {
        response.writeHead(200);
        response.write(png.subarray(0, 8));
      } else if (path === '/provider/chunks') {
        if (
          request.headers.authorization !== 'Bearer fixture' ||
          request.headers['x-nelyx-image'] !== 'fixture'
        ) {
          response.writeHead(403);
          response.end();
          return true;
        }
        response.writeHead(200, { 'Content-Length': streamed.length });
        response.flushHeaders();
        response.socket?.setNoDelay(true);
        response.write(streamed.subarray(0, 65536));
        const timer = setTimeout(() => {
          timers.delete(timer);
          if (!response.destroyed) response.end(streamed.subarray(65536));
        }, 500);
        timers.add(timer);
      } else if (path === '/provider/redirected') {
        response.writeHead(200, { 'Content-Length': png.length });
        response.end(png);
      } else {
        response.writeHead(404);
        response.end();
      }
      return true;
    },
    close() {
      for (const timer of timers) clearTimeout(timer);
      for (const socket of sockets) socket.destroy();
      timers.clear();
      sockets.clear();
    },
  };
}

export function imageProviderAppSource(origin) {
  const gif = Buffer.from(imageFixture.gif, 'base64');
  for (let i = 0; i + 7 < gif.length; ++i) {
    if (gif[i] === 0x21 && gif[i + 1] === 0xf9 && gif[i + 2] === 4) {
      gif[i + 4] = 80;
      gif[i + 5] = 0;
    }
    if (
      gif[i] === 3 &&
      gif[i + 1] === 1 &&
      gif[i + 2] === 1 &&
      gif[i + 3] === 0 &&
      gif[i + 4] === 0
    )
      gif[i + 2] = 0;
  }
  return `import {defineOriginalEngineV2App} from '@nelyx/sdk/engine-v2-original';
import type {OriginalEngineV2AppContext} from '@nelyx/sdk/engine-v2-original';
import {StatefulWidget,State} from '@nelyx/core/framework/widgets/framework';
import type {Widget} from '@nelyx/core/framework/widgets/framework';
import {SizedBox,ColoredBox,Column,Row} from '@nelyx/core/framework/widgets/basic';
import {Image as ImageWidget} from '@nelyx/core/framework/widgets/image';
import {RawImage} from '@nelyx/core/framework/widgets/raw-image';
import {TickerMode} from '@nelyx/core/framework/widgets/ticker-mode';
import {MemoryImage,NetworkImage,AssetImage,FileImage,ResizeImage,imageCacheFor} from '@nelyx/core/framework/painting/image-provider';
import {ImageConfiguration} from '@nelyx/core/framework/painting/image-configuration';
import {ImageStreamListener} from '@nelyx/core/framework/painting/image-stream';
import {createLocalImageConfiguration} from '@nelyx/core/framework/widgets/image';
import type {ImageService} from '@nelyx/core/hosting/images';
const png=new Uint8Array(${JSON.stringify([...Buffer.from(imageFixture.png, 'base64')])}),gif=new Uint8Array(${JSON.stringify([...gif])}),origin=${JSON.stringify(origin)};
const memory=new MemoryImage(png),animated=new MemoryImage(gif),network=new NetworkImage(origin+'/provider/chunks',{headers:{Authorization:'Bearer fixture','X-Nelyx-Image':'fixture'}}),asset=new AssetImage('image.png'),small=new ResizeImage(memory,{width:1,height:1}),bad=new MemoryImage(new Uint8Array([1,2,3]));
let app:OriginalEngineV2AppContext,images:ImageService,phase=0,enabled=false,change:(value:number,ticker:boolean)=>void=()=>{};
let config:ImageConfiguration,animationFrames=0;const frameSizes:Record<string,number[]>={},progress:number[]=[],errors:string[]=[],seen=new Map<string,number|null>();
const events=globalThis as unknown as {addEventListener(type:string,callback:(event:{data?:{kind?:string;phase?:number;enabled?:boolean}})=>void):void;removeEventListener(type:string,callback:(event:{data?:{kind?:string;phase?:number;enabled?:boolean}})=>void):void};
function image(provider:MemoryImage|NetworkImage|AssetImage|FileImage|ResizeImage,name:string,color:number):Widget{return new ImageWidget(provider,{width:64,height:64,fit:'fill',filterQuality:'none',excludeFromSemantics:true,frameBuilder(_context,child,frame,sync){if(frame!==null&&seen.get(name)!==frame){seen.set(name,frame);if(name==='gif')animationFrames++;if(child instanceof RawImage&&child.image)frameSizes[name]=[child.image.width,child.image.height];app.notify({kind:'provider-frame',name,frame,sync});}return child;},loadingBuilder(_context,child,event){if(name==='network'&&event&&progress.at(-1)!==event.cumulativeBytesLoaded)progress.push(event.cumulativeBytesLoaded);return child;},errorBuilder(_context,error){const message=name+': '+String(error);if(!errors.includes(message))errors.push(message);return new SizedBox(64,64,new ColoredBox({color}));}});}
class Root extends StatefulWidget{createState(){return new RootState();}}
class RootState extends State<Root>{override initState(){super.initState();change=(value,ticker)=>this.setState(()=>{phase=value;enabled=ticker;});}build():Widget{images=this.context.services.images!;config=createLocalImageConfiguration(this.context);const children=phase===0?[image(memory,'memory',0),image(memory,'shared',0),image(asset,'asset',0),image(network,'network',0),new TickerMode(enabled,image(animated,'gif',0)),image(small,'resize',0),image(new NetworkImage(origin+'/provider/missing'),'missing',0xff00ffff),image(bad,'corrupt',0xffffff00)]:phase===1?[image(memory,'memory',0),image(memory,'shared',0)]:phase===3?[image(new NetworkImage(origin+'/provider/stall'),'stall',0xff00ffff)]:[];return new SizedBox(320,200,new ColoredBox({color:0xff102030,child:new Column([new Row(children.slice(0,4)),new Row(children.slice(4))])}));}}
async function receiveAsync(event:{data?:{kind?:string;phase?:number;enabled?:boolean}}){if(event.data?.kind==='provider-phase')change(event.data.phase!,event.data.enabled??enabled);if(event.data?.kind==='provider-probe'){const cache=imageCacheFor(images);app.notify({kind:'provider-state',phase,enabled,animationFrames,frameSizes,progress,errors,cache:{pending:cache.pendingImageCount,live:cache.liveImageCount,count:cache.currentSize,bytes:cache.currentSizeBytes}});}if(event.data?.kind==='provider-clear'){const cache=imageCacheFor(images);cache.clear();cache.clearLiveImages();app.notify({kind:'provider-cleared'});}if(event.data?.kind==='provider-direct'){const a=memory.resolve(config),b=new MemoryImage(png).resolve(config);let count=0,syncs=0;const listener=new ImageStreamListener((info,sync)=>{count++;if(sync)syncs++;info.dispose();});a.addListener(listener);b.addListener(listener);a.removeListener(listener);b.removeListener(listener);app.notify({kind:'provider-cache',same:a.completer===b.completer,count,syncs});}}
function receive(event:{data?:{kind?:string;phase?:number;enabled?:boolean}}){void receiveAsync(event).catch(error=>app.notify({kind:'provider-error',message:String(error)}));}
export default defineOriginalEngineV2App({build(context){app=context;return new Root();},ready(){events.addEventListener('message',receive);app.notify({kind:'provider-ready'});},dispose(){events.removeEventListener('message',receive);}});`;
}
