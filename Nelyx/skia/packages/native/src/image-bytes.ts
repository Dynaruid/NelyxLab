// SPDX-License-Identifier: BSD-3-Clause
import type {ImageByteFormat} from '@nelyx/core/ui/image';
import type {SkImage,ImageInfo} from './skia/types/Drawing.ts';
import {AlphaType} from './skia/types/Drawing.ts';
import {ColorType} from './skia/types/Image/ColorType.ts';
/** rawUnmodified preserves the decoded image's native layout and alpha type. */
export function readNativeImageBytes(image:SkImage,format:ImageByteFormat):Uint8Array|null {
  if(format==='png')return image.encodeToBytes();
  let info:(ImageInfo&{dispose?:()=>void})|undefined,result:Uint8Array|null=null;const errors:unknown[]=[];
  try{
    if(format==='rawUnmodified')info=image.getImageInfo();
    const pixels=image.readPixels(0,0,info??{width:image.width(),height:image.height(),colorType:format==='rawExtendedRgba128'?ColorType.RGBA_F32:ColorType.RGBA_8888,alphaType:format==='rawStraightRgba'||format==='rawExtendedRgba128'?AlphaType.Unpremul:AlphaType.Premul});
    if(pixels!==null)result=new Uint8Array(pixels.buffer.slice(pixels.byteOffset,pixels.byteOffset+pixels.byteLength));
  }catch(error){errors.push(error);}
  // Native ImageInfo is a disposable wrapper retaining its original color space;
  // the CanvasKit-backed RN adapter supplies an ordinary value object instead.
  try{info?.dispose?.();}catch(error){errors.push(error);}
  if(errors.length===1)throw errors[0];if(errors.length)throw new AggregateError(errors,'Native image readback/metadata retirement failed');return result;
}
