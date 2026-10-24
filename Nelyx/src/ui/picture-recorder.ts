// SPDX-License-Identifier: BSD-3-Clause
// Adapted from dart:ui PictureRecorder; native rasterization is supplied separately.
import {invariant} from '../foundation/errors.ts';
import {Picture} from './picture.ts';
import type {Canvas} from './canvas.ts';
import type {Rect} from './types.ts';
export class PictureRecorder {
  private canvas:Canvas|null=null;
  private ended=false;
  get isRecording():boolean{return this.canvas!==null&&!this.canvas.debugDisposed;}
  _beginRecording(canvas:Canvas,cullRect:Rect|null):void{
    invariant(!this.ended&&this.canvas===null,'active-picture-recorder','PictureRecorder is already recording or has ended');
    if(cullRect)invariant([cullRect.x,cullRect.y,cullRect.width,cullRect.height].every(Number.isFinite)&&cullRect.width>=0&&cullRect.height>=0,'invalid-cull-rect','Cull bounds must be finite with nonnegative dimensions');
    // Bounds are advisory, not a clip. This backend retains all operations.
    this.canvas=canvas;
  }
  endRecording():Picture{
    invariant(this.isRecording,'idle-picture-recorder','PictureRecorder did not start recording');
    const canvas=this.canvas!;this.canvas=null;this.ended=true;let picture:Picture|undefined;
    try{canvas.restoreToCount(1);picture=Picture._fromRecording(canvas.commands);}finally{canvas.dispose();}
    try{Picture.onCreate?.(picture);return picture;}catch(error){try{picture.dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Picture creation callback and retirement failed');}throw error;}
  }
}
