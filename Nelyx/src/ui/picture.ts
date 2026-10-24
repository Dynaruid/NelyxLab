// SPDX-License-Identifier: BSD-3-Clause
// Adapted from dart:ui Picture at the pinned Flutter revision. CPU display-list ownership.
import {invariant} from '../foundation/errors.ts';
import {freezeFrame,disposeFrame} from './frame.ts';
import type {PaintCommand,PaintFrame,FrameBuildToken,ResourceId} from './types.ts';
import type {Canvas} from './canvas.ts';
import type {Image} from './image.ts';
export interface PictureCapture {readonly frame:PaintFrame;retain():PictureCapture;onRetire(callback:()=>void):()=>void;dispose():void}
export interface PictureRasterizer {rasterize(capture:PictureCapture,width:number,height:number):Promise<Image>;rasterizeSync(capture:PictureCapture,width:number,height:number):Image}
export interface PictureResourceProvider {resource(picture:Picture):ResourceId}

// Recording has no view affinity. Actual frame admission supplies the destination owner/metrics.
const recordingToken:FrameBuildToken=Object.freeze({owner:Object.freeze({id:'picture-recording',generation:1}),sequence:1,metrics:Object.freeze({logicalWidth:1,logicalHeight:1,physicalWidth:1,physicalHeight:1,scale:1,viewportGeneration:1,rendererGeneration:1,nativeContextGeneration:null,nativeSurfaceGeneration:null})});
export class Picture {
  static onCreate:((picture:Picture)=>void)|null=null;
  static onDispose:((picture:Picture)=>void)|null=null;
  private dead=false;
  private references=1;
  private readonly retirementListeners=new Set<()=>void>();
  private readonly disposalListeners=new Set<()=>void>();
  private constructor(private readonly recording:PaintFrame){}
  /** Internal ownership transfer: validates the list and consumes its recording holds. */
  static _fromRecording(commands:readonly PaintCommand[]):Picture{return new Picture(freezeFrame(recordingToken,commands));}
  get debugDisposed():boolean{return this.dead;}
  get approximateBytesUsed():number{this.assertOpen();return this.recording.estimatedBytes;}
  private assertOpen():void{invariant(!this.dead,'disposed-picture','Picture has been disposed');}
  /** Internal capture owns the immutable recording until its raster job retires. */
  _capture():PictureCapture{this.assertOpen();return this.captureRecording();}
  /** App caches drop their producers at API disposal; frame captures keep the recording alive. */
  _onDispose(callback:()=>void):()=>void{this.assertOpen();this.disposalListeners.add(callback);return ()=>{this.disposalListeners.delete(callback);};}
  private captureRecording():PictureCapture{invariant(this.references>0,'disposed-picture-recording','Picture recording has ended');this.references++;let active=true;return Object.freeze({frame:this.recording,retain:()=>{invariant(active,'disposed-picture-capture','Picture capture has ended');return this.captureRecording();},onRetire:(callback:()=>void)=>{invariant(active,'disposed-picture-capture','Picture capture has ended');this.retirementListeners.add(callback);return ()=>{this.retirementListeners.delete(callback);};},dispose:()=>{if(!active)return;active=false;this.releaseRecording();}});}
  private releaseRecording():void{if(--this.references!==0)return;const callbacks=[...this.retirementListeners],errors:unknown[]=[];this.retirementListeners.clear();for(const callback of callbacks)try{callback();}catch(error){errors.push(error);}try{disposeFrame(this.recording);}catch(error){errors.push(error);}if(errors.length===1)throw errors[0];if(errors.length)throw new AggregateError(errors,'Picture recording retirement failed');}
  async toImage(width:number,height:number,rasterizer:PictureRasterizer):Promise<Image>{this.assertOpen();invariant(rasterizer&&typeof rasterizer.rasterize==='function','missing-rasterizer','Picture.toImage requires an app rasterization service');const capture=this._capture(),errors:unknown[]=[];let image:Image|undefined;try{image=await rasterizer.rasterize(capture,width,height);}catch(error){errors.push(error);}try{capture.dispose();}catch(error){errors.push(error);}if(errors.length&&image&&!image.debugDisposed)try{image.dispose();}catch(error){errors.push(error);}if(errors.length===1)throw errors[0];if(errors.length)throw new AggregateError(errors,'Picture rasterization/retirement failed');return image!;}
  toImageSync(width:number,height:number,rasterizer:PictureRasterizer):Image{this.assertOpen();invariant(rasterizer&&typeof rasterizer.rasterizeSync==='function','missing-rasterizer','Picture.toImageSync requires an app rasterization service');const capture=this._capture(),errors:unknown[]=[];let image:Image|undefined;try{image=rasterizer.rasterizeSync(capture,width,height);}catch(error){errors.push(error);}try{capture.dispose();}catch(error){errors.push(error);}if(errors.length&&image&&!image.debugDisposed)try{image.dispose();}catch(error){errors.push(error);}if(errors.length===1)throw errors[0];if(errors.length)throw new AggregateError(errors,'Picture rasterization/retirement failed');return image!;}
  /** Copy immutable operations and independent resource holds; picture state cannot escape. */
  _draw(canvas:Canvas):void{
    this.assertOpen();const mark=canvas.commands.length;
    try{canvas.save();canvas.addCommands(this.recording.commands);canvas.restore();}
    catch(error){try{canvas.rollback(mark);}catch(cleanup){throw new AggregateError([error,cleanup],'Picture replay and rollback failed');}throw error;}
  }
  dispose():void{
    if(this.dead)return;this.dead=true;const errors:unknown[]=[];
    try{Picture.onDispose?.(this);}catch(error){errors.push(error);}
    const callbacks=[...this.disposalListeners];this.disposalListeners.clear();for(const callback of callbacks)try{callback();}catch(error){errors.push(error);}
    try{this.releaseRecording();}catch(error){errors.push(error);}
    if(errors.length===1)throw errors[0];if(errors.length)throw new AggregateError(errors,'Picture retirement failed');
  }
  toString():string{return 'Picture';}
}
