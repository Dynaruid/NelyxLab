// SPDX-License-Identifier: BSD-3-Clause
import type {CanvasKit,Image,ImageInfo,ColorSpace,MallocObj} from 'canvaskit-wasm';
import type {ImageByteFormat} from '@nelyx/core/ui/image';
/** Use an explicit byte destination, including formats omitted by CK's JS copy switch. */
export function readWebImageBytes(ck:CanvasKit,image:Image,format:ImageByteFormat):Uint8Array|null {
  if(format==='png')return image.encodeToBytes();
  let colorSpace:ColorSpace|undefined,allocation:MallocObj|undefined,result:Uint8Array|null=null;const errors:unknown[]=[];
  try{
    let info:ImageInfo;
    if(format==='rawUnmodified'){colorSpace=image.getColorSpace();info={...image.getImageInfo(),colorSpace};}
    else info={width:image.width(),height:image.height(),colorType:format==='rawExtendedRgba128'?ck.ColorType.RGBA_F32:ck.ColorType.RGBA_8888,alphaType:format==='rawStraightRgba'||format==='rawExtendedRgba128'?ck.AlphaType.Unpremul:ck.AlphaType.Premul,colorSpace:ck.ColorSpace.SRGB};
    const type=info.colorType,types=ck.ColorType,bytesPerPixel=type===types.Alpha_8||type===types.Gray_8?1:type===types.RGB_565?2:type===types.RGBA_8888||type===types.BGRA_8888||type===types.RGBA_1010102||type===types.RGB_101010x?4:type===types.RGBA_F16?8:type===types.RGBA_F32?16:0;
    if(!bytesPerPixel)throw new Error('Unsupported native image color type');
    const size=info.width*info.height*bytesPerPixel;if(!Number.isSafeInteger(size)||size<=0||size>256*1024*1024)throw new Error('Image readback byte budget');
    allocation=ck.Malloc(Uint8Array,size);const data=image.readPixels(0,0,info,allocation,info.width*bytesPerPixel);
    if(data!==null)result=new Uint8Array(data.buffer.slice(data.byteOffset,data.byteOffset+size));
  }catch(error){errors.push(error);}
  for(const cleanup of [()=>{if(allocation)ck.Free(allocation);},()=>colorSpace?.delete()])try{cleanup();}catch(error){errors.push(error);}
  if(errors.length===1)throw errors[0];if(errors.length)throw new AggregateError(errors,'Web image readback/temporary retirement failed');return result;
}
