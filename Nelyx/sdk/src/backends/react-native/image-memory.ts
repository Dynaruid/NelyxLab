// SPDX-License-Identifier: BSD-3-Clause
/** Shared decoded-image, codec and rasterization temporary budget for one native app. */
export class NativeImageMemory {
  private used=0;
  get bytes():number{return this.used;}
  reserve(bytes:number):()=>void{if(!Number.isSafeInteger(bytes)||bytes<0||this.used+bytes>256*1024*1024)throw new Error('React Native image/codec/raster memory budget');this.used+=bytes;let active=true;return ()=>{if(!active)return;active=false;this.used-=bytes;};}
}
