// SPDX-License-Identifier: BSD-3-Clause
import type {PaintCommand,Rect,ResourceId,ClipOptions} from './types.ts';
import type {Matrix2D,Offset} from './geometry.ts';
import {matrix4Identity,matrix4FromAffine,captureMatrix4,multiplyMatrix4} from './matrix4.ts';
import {finite} from '../foundation/numbers.ts';
import {invariant} from '../foundation/errors.ts';
import {Paint} from './paint.ts';
import {Path,pathOperationLimit} from './path.ts';
import {RRect} from './rrect.ts';
import {captureRRect} from './rrect-data.ts';
import {freezePaintCommand} from './frame.ts';
import {releaseCommandResources} from './resource-retention.ts';
import {Image} from './image.ts';
import {Paragraph} from './paragraph.ts';
import {Picture} from './picture.ts';
import type {PictureResourceProvider} from './picture.ts';
import type {PictureRecorder} from './picture-recorder.ts';
/** Records commands only; GPU objects never enter the framework tree. */
export class Canvas {
  private static readonly baseRecord=Canvas.prototype.record;
  readonly commands:PaintCommand[]=[];
  private dead=false;
  constructor(private readonly recorder:PictureRecorder|null=null,cullRect:Rect|null=null,private readonly pictures:PictureResourceProvider|null=null){recorder?._beginRecording(this,cullRect);}
  get debugDisposed():boolean{return this.dead;}
  protected record(command:PaintCommand):void{invariant(!this.dead,'closed-canvas','Cannot record to a closed canvas');this.commands.push(freezePaintCommand(command));}
  addCommands(commands:readonly PaintCommand[]):void{this._addCommandRange(commands,0,commands.length);}
  /** @internal Retained replay copies a range without allocating an intermediate list. */
  _addCommandRange(commands:readonly PaintCommand[],from:number,to:number):void{invariant(Number.isSafeInteger(from)&&Number.isSafeInteger(to)&&from>=0&&to>=from&&to<=commands.length,'invalid-command-range','Invalid command copy range');const start=this.commands.length;try{for(let index=from;index<to;index++)this.record(commands[index]!);}catch(error){try{this.rollback(start);}catch(cleanup){throw new AggregateError([error,cleanup],'Command copy and rollback failed');}throw error;}}
  rollback(start:number):void{invariant(Number.isSafeInteger(start)&&start>=0&&start<=this.commands.length,'invalid-command-mark','Invalid recording rollback');releaseCommandResources(this.commands.splice(start));}
  dispose():void{if(this.dead)return;this.dead=true;releaseCommandResources(this.commands);}
  save():void {this.record({op:'save'});}
  restore():void {invariant(!this.dead,'closed-canvas','Cannot record to a closed canvas');if(this.recorder&&this.getSaveCount()===1)return;this.record({op:'restore'});}
  drawPicture(picture:Picture):void{invariant(!this.dead,'closed-canvas','Cannot record to a closed canvas');invariant(picture instanceof Picture,'invalid-picture','drawPicture requires Picture');if(this.pictures)this.record({op:'drawPicture',resource:this.pictures.resource(picture)});else picture._draw(this);}
  /** The final argument supplies this view's DPR in place of Dart's implicit window. */
  drawShadow(path:Path,color:number,elevation:number,transparentOccluder:boolean,devicePixelRatio=1):void{invariant(path instanceof Path,'invalid-path','drawShadow requires Path');this.record({op:'drawShadow',path:path.snapshot(),color,elevation,transparentOccluder,devicePixelRatio});}
  drawPaint(paint:Paint):void{this.record({op:'drawPaint',paint:paint.snapshot()});}
  transform(matrix:Matrix2D|readonly number[]|Float64Array):void {
    // The base recorder captures synchronously. A custom hook still receives
    // an independent argument even when it mutates or retains that argument.
    this.record({op:'transform',matrix:this.record===Canvas.baseRecord?matrix as readonly number[]:Array.from(matrix)});
  }
  translate(dx:number,dy:number):void{this.transform([1,0,0,1,dx,dy]);}
  scale(sx:number,sy=sx):void{this.transform([sx,0,0,sy,0,0]);}
  rotate(radians:number):void{finite(radians,'radians');const cosine=Math.cos(radians),sine=Math.sin(radians);this.transform([cosine,sine,-sine,cosine,0,0]);}
  skew(sx:number,sy:number):void{this.transform([1,sy,sx,1,0,0]);}
  /** Inspect recorded state, including legacy command-cache insertion, without owning a GPU canvas. */
  private state(){let matrix=matrix4Identity;const stack:typeof matrix[]=[];for(const command of this.commands){if(command.op==='save'||(command.op==='saveLayer'||command.op==='saveBackdropFilter'))stack.push(matrix);else if(command.op==='restore'){invariant(stack.length>0,'unbalanced-save','restore without save');matrix=stack.pop()!;}else if(command.op==='transform'){const values=command.matrix.map(Math.fround),next=values.length===6?matrix4FromAffine(values as unknown as Matrix2D):captureMatrix4(values);matrix=captureMatrix4(multiplyMatrix4(matrix,next).map(Math.fround));}}return {matrix,depth:stack.length+1};}
  getSaveCount():number{let count=1;for(const command of this.commands){if(command.op==='save'||(command.op==='saveLayer'||command.op==='saveBackdropFilter'))count++;else if(command.op==='restore'){invariant(count>1,'unbalanced-save','restore without save');count--;}}return count;}
  getTransform():Float64Array{return new Float64Array(this.state().matrix);}
  restoreToCount(count:number):void{invariant(Number.isSafeInteger(count),'invalid-save-count','Save count must be an integer');const target=Math.max(1,count),current=this.getSaveCount();for(let n=current;n>target;n--)this.restore();}
  clip(rect:Rect):void {this.record({op:'clip',rect});}
  rect(rect:Rect,color:number,radius=0):void {this.record(radius>0?{op:'rrect',rect,color,radius}:{op:'rect',rect,color});}
  paragraph(resource:ResourceId,x=0,y=0):void {this.record({op:'paragraph',resource,x,y});}
  drawParagraph(paragraph:Paragraph,offset:Offset):void{invariant(paragraph instanceof Paragraph,'invalid-paragraph','drawParagraph requires a laid-out Paragraph');this.paragraph(paragraph.resource,offset.x,offset.y);}
  image(resource:ResourceId,rect:Rect):void {this.record({op:'image',resource,rect});}
  drawImage(image:Image,offset:Offset,paint:Paint):void{this.drawImageRect(image,{x:0,y:0,width:image.width,height:image.height},{x:offset.x,y:offset.y,width:image.width,height:image.height},paint);}
  drawImageRect(image:Image,src:Rect,dst:Rect,paint:Paint):void{invariant(image instanceof Image,'invalid-image','drawImageRect requires an owned Image');this.record({op:'drawImageRect',resource:image.resource,src,dst,paint:paint.snapshot()});}
  drawImageNine(image:Image,center:Rect,dst:Rect,paint:Paint):void{invariant(image instanceof Image,'invalid-image','drawImageNine requires an owned Image');const round=(v:number)=>Math.floor(Math.fround(v)+.5),left=round(center.x),top=round(center.y),right=round(center.x+center.width),bottom=round(center.y+center.height);this.record({op:'drawImageNine',resource:image.resource,center:{x:left,y:top,width:right-left,height:bottom-top},dst,paint:paint.snapshot()});}
  drawRect(rect:Rect,paint:Paint):void{this.record({op:'drawRect',rect,paint:paint.snapshot()});}
  drawRRect(rect:RRect,paint:Paint):void;
  drawRRect(rect:Rect,radius:number,paint:Paint):void;
  drawRRect(rect:Rect|RRect,radiusOrPaint:number|Paint,paint?:Paint):void{if(rect instanceof RRect){invariant(radiusOrPaint instanceof Paint&&paint===undefined,'invalid-paint','drawRRect requires RRect and Paint');this.record({op:'drawRRect',rrect:captureRRect(rect),paint:radiusOrPaint.snapshot()});}else{invariant(typeof radiusOrPaint==='number'&&paint instanceof Paint,'invalid-paint','Legacy drawRRect requires rect, radius and Paint');this.record({op:'drawRRect',rect,radius:radiusOrPaint,paint:paint.snapshot()});}}
  drawOval(rect:Rect,paint:Paint):void{this.record({op:'drawOval',rect,paint:paint.snapshot()});}
  /** Exact rational quadratic ellipse segments on the existing path ABI.
   * Radians are clockwise in the screen coordinate system, as dart:ui Canvas. */
  drawArc(rect:Rect,startAngle:number,sweepAngle:number,useCenter:boolean,paint:Paint):void{
    invariant(!this.dead,'closed-canvas','Cannot record to a closed canvas');
    invariant(rect&&[rect.x,rect.y,rect.width,rect.height,startAngle,sweepAngle].every(Number.isFinite)&&typeof useCenter==='boolean'&&paint instanceof Paint,'invalid-arc','Arc needs finite bounds/angles and a Paint');
    if(rect.width<=0||rect.height<=0||sweepAngle===0)return;
    if(Math.abs(sweepAngle)>=Math.PI*2&&!useCenter){this.drawOval(rect,paint);return;}
    const segments=Math.ceil(Math.abs(sweepAngle)/(Math.PI/2));
    invariant(segments+(useCenter?3:1)<=pathOperationLimit,'arc-operation-limit','Arc exceeds the shared path operation budget');
    const path=new Path(),rx=rect.width/2,ry=rect.height/2,cx=rect.x+rx,cy=rect.y+ry,start=startAngle%(Math.PI*2),sweep=sweepAngle,step=Math.sign(sweep)*Math.PI/2;
    const x=cx+rx*Math.cos(start),y=cy+ry*Math.sin(start);if(useCenter){path.moveTo(cx,cy);path.lineTo(x,y);}else path.moveTo(x,y);
    for(let i=0;i<segments;i++){const a=start+step*i,b=i===segments-1?start+sweep:a+step,mid=(a+b)/2,w=Math.cos((b-a)/2);path.conicTo(cx+rx*Math.cos(mid)/w,cy+ry*Math.sin(mid)/w,cx+rx*Math.cos(b),cy+ry*Math.sin(b),w);}
    if(useCenter)path.close();this.drawPath(path,paint);
  }
  drawCircle(center:Offset,radius:number,paint:Paint):void{invariant(Number.isFinite(radius)&&radius>=0,'invalid-radius','Circle radius must be finite and nonnegative');this.drawOval({x:center.x-radius,y:center.y-radius,width:radius*2,height:radius*2},paint);}
  /** The recorded even-odd path retains both contours without another wire opcode. */
  drawDRRect(outer:RRect,inner:RRect,paint:Paint):void{if(outer.isEmpty)return;const path=new Path();path.fillType='evenOdd';path.addRRect(outer);if(!inner.isEmpty)path.addRRect(inner);this.drawPath(path,paint);}
  drawLine(from:Offset,to:Offset,paint:Paint):void{this.record({op:'drawLine',from,to,paint:paint.snapshot()});}
  saveLayer(bounds:Rect|null,paint:Paint):void{this.record({op:'saveLayer',bounds,paint:paint.snapshot()});}
  /** Internal SceneBuilder bridge: filters preceding pixels in the current clip. */
  saveBackdropFilter(paint:Paint):void{this.record({op:'saveBackdropFilter',paint:paint.snapshot()});}
  clipRect(rect:Rect,options:ClipOptions={}):void{this.record({op:'clipRect',rect,clipOp:options.clipOp??'intersect',doAntiAlias:options.doAntiAlias??true});}
  clipRRect(rect:RRect,options?:ClipOptions):void;
  clipRRect(rect:Rect,radius:number,options?:ClipOptions):void;
  clipRRect(rect:Rect|RRect,radiusOrOptions:number|ClipOptions={},options:ClipOptions={}):void{if(rect instanceof RRect){invariant(typeof radiusOrOptions==='object'&&radiusOrOptions!==null,'invalid-clip','clipRRect requires RRect and clip options');this.record({op:'clipRRect',rrect:captureRRect(rect),clipOp:radiusOrOptions.clipOp??'intersect',doAntiAlias:radiusOrOptions.doAntiAlias??true});}else{invariant(typeof radiusOrOptions==='number','invalid-radius','Legacy clipRRect requires a uniform radius');this.record({op:'clipRRect',rect,radius:radiusOrOptions,clipOp:options.clipOp??'intersect',doAntiAlias:options.doAntiAlias??true});}}
  drawPath(path:Path,paint:Paint):void{invariant(path instanceof Path,'invalid-path','drawPath requires Path');this.record({op:'drawPath',path:path.snapshot(),paint:paint.snapshot()});}
  clipPath(path:Path,options:ClipOptions={}):void{invariant(path instanceof Path,'invalid-path','clipPath requires Path');this.record({op:'clipPath',path:path.snapshot(),clipOp:options.clipOp??'intersect',doAntiAlias:options.doAntiAlias??true});}
}
