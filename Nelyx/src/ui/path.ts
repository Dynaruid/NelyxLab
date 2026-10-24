// SPDX-License-Identifier: BSD-3-Clause
import {invariant} from '../foundation/errors.ts';
import type {Offset} from './geometry.ts';
import type {Rect} from './types.ts';
import {Rect as LtrbRect} from './rect.ts';
import {RRect} from './rrect.ts';
import {captureRRect,freezeRRect} from './rrect-data.ts';
import type {RRectValues} from './rrect-data.ts';

export type PathFillType='nonZero'|'evenOdd';
/** Operations retain SkPathBuilder's current-point and contour semantics on every backend. */
export const pathOperationNames=Object.freeze(['moveTo','relativeMoveTo','lineTo','relativeLineTo','quadraticBezierTo','relativeQuadraticBezierTo','cubicTo','relativeCubicTo','conicTo','relativeConicTo','close','addRect','addOval','addRRect'] as const);
export type PathVerbName=typeof pathOperationNames[number];
export interface PathVerbRecord {readonly verb:PathVerbName;readonly values:readonly number[]}
export interface PathSnapshot {readonly fillType:PathFillType;readonly operations:readonly PathVerbRecord[]}
/** Per-app engine geometry queries; independent of GPU frame admission. */
export interface PathQueryService {contains(path:PathSnapshot,point:Offset):boolean}
export const pathOperationLimit=4096;
const arities:Readonly<Record<PathVerbName,number>>=Object.freeze({moveTo:2,relativeMoveTo:2,lineTo:2,relativeLineTo:2,quadraticBezierTo:4,relativeQuadraticBezierTo:4,cubicTo:6,relativeCubicTo:6,conicTo:5,relativeConicTo:5,close:0,addRect:4,addOval:4,addRRect:12});
function fillType(value:PathFillType):PathFillType{invariant(value==='nonZero'||value==='evenOdd','invalid-path','Unknown path fill type');return value;}
function operation(verb:PathVerbName,values:readonly number[]):PathVerbRecord {
  invariant(pathOperationNames.includes(verb)&&Array.isArray(values)&&values.length===arities[verb],'invalid-path','Unknown path operation or wrong coordinate count');
  const captured:number[]=[];for(const value of values){invariant(typeof value==='number'&&Number.isFinite(value)&&Number.isFinite(Math.fround(value)),'invalid-path','Path coordinates and weights must fit finite SkScalar');captured.push(Math.fround(value));}
  if(verb==='addRect'||verb==='addOval')invariant(captured[2]!>=captured[0]!&&captured[3]!>=captured[1]!,'invalid-path','Path rectangle must have nonnegative size');
  if(verb==='addRRect')freezeRRect({values:captured as unknown as RRectValues});
  return Object.freeze({verb,values:Object.freeze(captured)});
}
// Ellipse arc decisions follow SkPathBuilder/SkConic at Flutter's DEPS Skia pin.
// Rational conics retain the existing frame ABI; scalar capture remains float32.
function ellipseArc(rect:Rect,startAngle:number,sweepAngle:number,forceMoveTo:boolean,add:boolean,empty:boolean):PathVerbRecord[]{
  invariant(rect&&[rect.x,rect.y,rect.width,rect.height,startAngle,sweepAngle].every(Number.isFinite)&&typeof forceMoveTo==='boolean','invalid-path-arc','Ellipse arcs require finite geometry and radians');
  const f=Math.fround,left=f(rect.x),top=f(rect.y),right=f(rect.x+rect.width),bottom=f(rect.y+rect.height),width=f(right-left),height=f(bottom-top),cx=f(f(left+right)*.5),cy=f(f(top+bottom)*.5),rx=f(width*.5),ry=f(height*.5),pi=f(Math.PI),degrees=(angle:number)=>f(f(f(angle)*180)/pi),startDegrees=f(degrees(startAngle)%360),sweepDegrees=degrees(sweepAngle),rows:PathVerbRecord[]=[];
  invariant([left,top,right,bottom,width,height,cx,cy,startDegrees,sweepDegrees].every(Number.isFinite),'invalid-path-arc','Ellipse arc intermediates must fit finite SkScalar');
  if(width<0||height<0||add&&(width===0||height===0||sweepDegrees===0))return rows;
  const clockwise=sweepDegrees>0,point=(x:number,y:number):readonly number[]=>[f(cx+f(rx*x)),f(cy+f(ry*y))],appendPoint=(p:readonly number[])=>rows.push(operation(forceMoveTo||empty||add?'moveTo':'lineTo',p));
  const quarter=f(startDegrees/90),quarterIndex=Math.floor(quarter+.5);
  if(add&&Math.abs(sweepDegrees)>=360&&Math.abs(quarter-quarterIndex)<=1/4096){
    // The ordinary clockwise oval remains a native oval (including its shadow optimization).
    if(clockwise&&((quarterIndex%4)+4)%4===0)return [operation('addOval',[left,top,right,bottom])];
    const a=quarterIndex*Math.PI/2,sign=clockwise?1:-1,w=f(Math.SQRT1_2);appendPoint(point(Math.round(Math.cos(a)),Math.round(Math.sin(a))));
    for(let i=0;i<4;i++){const b=a+sign*Math.PI/2*(i+1),mid=b-sign*Math.PI/4,control=point(Math.round(Math.cos(mid)/Math.SQRT1_2),Math.round(Math.sin(mid)/Math.SQRT1_2)),end=point(Math.round(Math.cos(b)),Math.round(Math.sin(b)));rows.push(operation('conicTo',[control[0]!,control[1]!,end[0]!,end[1]!,w]));}rows.push(operation('close',[]));return rows;
  }
  if(width===0&&height===0){appendPoint([right,top]);return rows;}
  if(sweepDegrees===0&&startDegrees===0){appendPoint([right,cy]);return rows;}
  const toRadians=(angle:number)=>f(angle*f(pi/180)),snap=(value:number)=>Math.abs(value)<=1/65536?0:f(value),start=toRadians(startDegrees),sx=snap(Math.cos(start)),sy=snap(Math.sin(start));let stop=toRadians(f(startDegrees+sweepDegrees)),ex=snap(Math.cos(stop)),ey=snap(Math.sin(stop));
  if(sx===ex&&sy===ey&&Math.abs(sweepDegrees)<360&&Math.abs(sweepDegrees)>359){const delta=Math.sign(sweepDegrees)/512;for(let i=0;i<16&&sx===ex&&sy===ey;i++){stop=f(stop-delta);ex=snap(Math.cos(stop));ey=snap(Math.sin(stop));}}
  if(sx===ex&&sy===ey){appendPoint(point(f(Math.cos(stop)),f(Math.sin(stop))));return rows;}
  const x=f(f(sx*ex)+f(sy*ey)),cross=f(f(sx*ey)-f(sy*ex));let y=clockwise?cross:-cross;
  if(Math.abs(cross)<=1/4096&&x>0&&(clockwise?cross>=0:cross<=0)){appendPoint(point(ex,ey));return rows;}
  const quadrant=y===0?2:x===0?(y>0?1:3):(y<0?2:0)+Number((x<0)!==(y<0)),vertices=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]] as const;
  const map=(u:number,v:number):readonly number[]=>{if(!clockwise)v=-v;return point(f(f(sx*u)-f(sy*v)),f(f(sy*u)+f(sx*v)));},conics:Array<{control:readonly number[];end:readonly number[];weight:number}>=[];
  for(let i=0;i<quadrant;i++){const control=vertices[i*2+1]!,end=vertices[(i*2+2)%8]!;conics.push({control:map(control[0],control[1]),end:map(end[0],end[1]),weight:f(Math.SQRT1_2)});}
  const last=vertices[quadrant*2]!,dot=f(f(last[0]*x)+f(last[1]*y));
  if(dot<1){const w=f(Math.sqrt(f(f(1+dot)/2))),bx=f(last[0]+x),by=f(last[1]+y),length=Math.hypot(bx,by),factor=f(f(1/w)/length),ux=f(bx*factor),uy=f(by*factor);if(Math.abs(ux-last[0])>1/4096||Math.abs(uy-last[1])>1/4096)conics.push({control:map(ux,uy),end:map(x,y),weight:w});}
  appendPoint(conics.length?point(sx,sy):point(ex,ey));for(const item of conics)rows.push(operation('conicTo',[item.control[0]!,item.control[1]!,item.end[0]!,item.end[1]!,item.weight]));return rows;
}
/** Validate untrusted frame values and copy all nested arrays before admission. */
export function freezePath(value:PathSnapshot):PathSnapshot {
  invariant(value&&typeof value==='object'&&Array.isArray(value.operations)&&value.operations.length<=pathOperationLimit,'invalid-path','Invalid or oversized path');
  const captured:PathVerbRecord[]=[];for(const item of value.operations){invariant(item&&typeof item==='object','invalid-path','Invalid path operation');captured.push(operation(item.verb,item.values));}
  return Object.freeze({fillType:fillType(value.fillType),operations:Object.freeze(captured)});
}
/** Mutable CPU value recorder. Engine geometry queries use an explicit per-app service. */
export class Path {
  private currentFillType:PathFillType='nonZero';
  private operations:PathVerbRecord[]=[];
  static from(source:Path):Path{invariant(source instanceof Path,'invalid-path','Path.from requires Path');const result=new Path();result.currentFillType=source.fillType;result.operations=[...source.snapshot().operations];return result;}
  get fillType():PathFillType{return this.currentFillType;}
  set fillType(value:PathFillType){this.currentFillType=fillType(value);}
  private append(verb:PathVerbName,values:readonly number[]):void{const captured=operation(verb,values);invariant(this.operations.length<pathOperationLimit,'oversize','Path operation budget exceeded');this.operations.push(captured);}
  moveTo(x:number,y:number):void{this.append('moveTo',[x,y]);}
  relativeMoveTo(dx:number,dy:number):void{this.append('relativeMoveTo',[dx,dy]);}
  lineTo(x:number,y:number):void{this.append('lineTo',[x,y]);}
  relativeLineTo(dx:number,dy:number):void{this.append('relativeLineTo',[dx,dy]);}
  quadraticBezierTo(x1:number,y1:number,x2:number,y2:number):void{this.append('quadraticBezierTo',[x1,y1,x2,y2]);}
  relativeQuadraticBezierTo(x1:number,y1:number,x2:number,y2:number):void{this.append('relativeQuadraticBezierTo',[x1,y1,x2,y2]);}
  cubicTo(x1:number,y1:number,x2:number,y2:number,x3:number,y3:number):void{this.append('cubicTo',[x1,y1,x2,y2,x3,y3]);}
  relativeCubicTo(x1:number,y1:number,x2:number,y2:number,x3:number,y3:number):void{this.append('relativeCubicTo',[x1,y1,x2,y2,x3,y3]);}
  conicTo(x1:number,y1:number,x2:number,y2:number,w:number):void{this.append('conicTo',[x1,y1,x2,y2,w]);}
  relativeConicTo(x1:number,y1:number,x2:number,y2:number,w:number):void{this.append('relativeConicTo',[x1,y1,x2,y2,w]);}
  close():void{this.append('close',[]);}
  reset():void{this.operations=[];this.currentFillType='nonZero';}
  private rectangle(verb:'addRect'|'addOval',rect:Rect):void{invariant(rect,'invalid-path','Missing path rectangle');if(rect instanceof LtrbRect)this.append(verb,[rect.left,rect.top,rect.right,rect.bottom]);else{const {x,y,width,height}=rect;invariant(Number.isFinite(width)&&Number.isFinite(height)&&width>=0&&height>=0,'invalid-path','Path rectangle must have nonnegative finite size');this.append(verb,[x,y,x+width,y+height]);}}
  addRect(rect:Rect):void{this.rectangle('addRect',rect);}
  addOval(rect:Rect):void{this.rectangle('addOval',rect);}
  /** @dartParam startAngle double
   * @dartParam sweepAngle double */
  addArc(rect:Rect,startAngle:number,sweepAngle:number):void{const rows=ellipseArc(rect,startAngle,sweepAngle,true,true,this.operations.length===0);invariant(this.operations.length+rows.length<=pathOperationLimit,'oversize','Path operation budget exceeded');this.operations.push(...rows);}
  /** @dartParam startAngle double
   * @dartParam sweepAngle double */
  arcTo(rect:Rect,startAngle:number,sweepAngle:number,forceMoveTo:boolean):void{const rows=ellipseArc(rect,startAngle,sweepAngle,forceMoveTo,false,this.operations.length===0);invariant(this.operations.length+rows.length<=pathOperationLimit,'oversize','Path operation budget exceeded');this.operations.push(...rows);}
  addRRect(rect:RRect):void{this.append('addRRect',captureRRect(rect).values);}
  addPolygon(points:readonly Offset[],close:boolean):void {
    invariant(Array.isArray(points)&&typeof close==='boolean'&&this.operations.length+points.length+(points.length&&close?1:0)<=pathOperationLimit,'invalid-path','Invalid or oversized polygon');
    const captured:PathVerbRecord[]=[];let index=0;for(const point of points){invariant(point&&typeof point==='object','invalid-path','Invalid polygon point');captured.push(operation(index++===0?'moveTo':'lineTo',[point.x,point.y]));}
    if(captured.length&&close)captured.push(operation('close',[]));this.operations.push(...captured);
  }
  snapshot():PathSnapshot{return Object.freeze({fillType:this.currentFillType,operations:Object.freeze([...this.operations])});}
  contains(point:Offset,queries:PathQueryService):boolean{invariant(point&&[point.x,point.y].every(Number.isFinite),'invalid-path-point','Path query point must be finite');invariant(queries&&typeof queries.contains==='function','missing-path-queries','Path containment requires an engine geometry service');const result=queries.contains(this.snapshot(),Object.freeze({x:point.x,y:point.y}));invariant(typeof result==='boolean','invalid-path-query-result','Engine containment must return a boolean');return result;}
}
