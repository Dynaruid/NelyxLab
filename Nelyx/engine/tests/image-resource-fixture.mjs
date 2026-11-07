// SPDX-License-Identifier: BSD-3-Clause
import { deflateSync } from 'node:zlib';
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; ++bit) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(name, bytes) {
  const tag = Buffer.from(name),
    result = Buffer.alloc(12 + bytes.length);
  result.writeUInt32BE(bytes.length);
  tag.copy(result, 4);
  bytes.copy(result, 8);
  result.writeUInt32BE(crc32(result.subarray(4, 8 + bytes.length)), 8 + bytes.length);
  return result;
}
/** Uncompressed PNG intentionally exceeds the protocol's 1 MiB packet limit.
 * Its quadrant interiors give exact pixels after C++ decode and scaling. */
export function largeImagePNG(second = false) {
  const width = 600,
    height = 512,
    header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const scanlines = Buffer.alloc(height * (width * 4 + 1)),
    colors = second
      ? [
          [0, 255, 255, 255],
          [255, 0, 255, 255],
          [255, 255, 0, 255],
          [0, 0, 0, 255],
        ]
      : [
          [255, 0, 0, 255],
          [0, 255, 0, 255],
          [0, 0, 255, 255],
          [255, 255, 255, 255],
        ];
  for (let y = 0; y < height; ++y)
    for (let x = 0; x < width; ++x) {
      const offset = y * (width * 4 + 1) + 1 + x * 4;
      scanlines.set(colors[(y >= height / 2 ? 2 : 0) + (x >= width / 2 ? 1 : 0)], offset);
    }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(scanlines, { level: 0 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
export const imageResourceAppSource = `import {defineEngineV2App} from '@nelyx/sdk/engine-v2';
import {Box,Image,ImageResource,StatefulWidget,State} from '@nelyx/core/v2';
import type {Widget} from '@nelyx/core/v2';
let resources:ImageResource[],phase=0,change:(value:number)=>void=()=>{};
const events=globalThis as unknown as {addEventListener(type:string,callback:(event:{data?:{kind?:string;phase?:number}})=>void):void;removeEventListener(type:string,callback:(event:{data?:{kind?:string;phase?:number}})=>void):void};
function receive(event:{data?:{kind?:string;phase?:number}}){if(event.data?.kind==='image-resource-phase')change(event.data.phase!);}
class Root extends StatefulWidget{createState(){return new RootState();}}
class RootState extends State<Root>{initState(){change=(value)=>this.setState(()=>{phase=value;});}build():Widget{return phase===2?new Box([],{color:0xff123456,horizontal:{kind:'finite',min:64,max:64},vertical:{kind:'finite',min:64,max:64},layout:{}}):new Image(resources[phase]!,{horizontal:{kind:'finite',min:64,max:64},vertical:{kind:'finite',min:64,max:64},layout:{}});}}
export default defineEngineV2App({async build(context){resources=[new ImageResource(await context.asset('first.png')),new ImageResource(await context.asset('second.png'))];context.notify({kind:'image-resource-loaded',length:resources[0]!.bytes.length});return new Root();},ready(){events.addEventListener('message',receive);},dispose(){events.removeEventListener('message',receive);}});`;
