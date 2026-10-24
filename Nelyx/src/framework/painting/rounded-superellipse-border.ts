// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
// Geometry from pinned web_ui/lib/rsuperellipse_param.dart (exact path builder).
import {RoundedRectangleBorder} from './rounded-rectangle-border.ts';
import {BorderSide,ShapeBorder} from './borders.ts';import type {ShapeBorderOptions} from './borders.ts';
import {BorderRadiusGeometry} from './border-radius.ts';
import {Offset} from '../../ui/offset.ts';import {Path} from '../../ui/path.ts';import {Paint} from '../../ui/paint.ts';
import type {Canvas} from '../../ui/canvas.ts';import type {Rect} from '../../ui/rect.ts';import type {RRect} from '../../ui/rrect.ts';
type Transform=(p:Offset)=>Offset;
const tableN=[[2,1.13276676],[2.18349805,1.20311921],[2.33888662,1.28698796],[2.48660575,1.36351941],[2.62226596,1.44717976],[2.75148990,1.53385819],[3.36298265,1.98288283],[4.08649929,2.23811846],[4.85481134,2.47563463],[5.62945551,2.72948597],[6.43023796,2.98020421]] as const;
const tableBezier=[[.7078,8.3194],[.7895,2.4523],[.8379,1.8528],[.8701,1.6891],[.8932,1.5806],[.9107,1.5043],[.9244,1.4470],[.9355,1.4037],[.9448,1.3701],[.9526,1.3431],[.9594,1.3212],[.9653,1.3032],[.9705,1.2880]] as const;
function interpolate(table:readonly (readonly number[])[],steps:number):number[]{const left=Math.max(0,Math.min(Math.floor(steps),table.length-2)),fraction=steps-left;return table[left]!.map((v,i)=>v*(1-fraction)+table[left+1]![i]!*fraction);}
function intersection(a:Offset,ka:number,b:Offset,kb:number):Offset{if(Math.abs(ka-kb)<1e-5)return a.add(b).divide(2);const x=(ka*a.dx-kb*b.dx+b.dy-a.dy)/(ka-kb);return new Offset(x,ka*(x-a.dx)+a.dy);}
function octant(path:Path,a:number,radius:number,offset:Offset,external:Transform,reverse:boolean,flip:boolean):void{
  let ratio=a*2/radius,n:number,factor:number;if(ratio>5){n=1.559599389*(ratio-5)+tableN[10][0];factor=.522807185*(ratio-5)+tableN[10][1];}else{ratio=Math.max(2,Math.min(5,ratio));[n,factor]=interpolate(tableN,ratio<2.5?(ratio-2)*10:(ratio-2.5)*2+5) as [number,number];}
  const x=(1-1/factor)*a,y=(1-(x/a)**n)**(1/n)*a,tangent=(x/y)**(n-1),d=(x-tangent*y)/(1-tangent),g=.29289321881*radius,R=(a-d-g)*Math.SQRT2,j=new Offset(x,y),m=new Offset(a-g,a-g),delta=m.subtract(j),middle=j.add(m).divide(2),perpendicular=new Offset(-delta.dy,delta.dx),distance=Math.sqrt(Math.max(0,R*R-(delta.distance/2)**2)),center=middle.subtract(perpendicular.divide(perpendicular.distance).multiply(distance));
  const av=m.subtract(center),bv=j.subtract(center),angle=Math.atan2(av.dx*bv.dy-av.dy*bv.dx,av.dx*bv.dx+av.dy*bv.dy),start=j.subtract(center),cos=Math.cos(-angle),sin=Math.sin(-angle),end=new Offset(start.dx*cos-start.dy*sin,start.dx*sin+start.dy*cos),circleEnd=center.add(end),bezier=Math.tan(angle/4)*4/3;
  const circle=[j,j.add(new Offset(start.dy,-start.dx).multiply(bezier)),circleEnd.add(new Offset(-end.dy,end.dx).multiply(bezier)),circleEnd];
  const limited=Math.min(14,n),[f1,f2]=interpolate(tableBezier,Math.max(0,limited-2)),root=Math.sqrt(limited),yh=(root+y/a)/(root+1),h=new Offset((1-yh**n)**(1/n)*a,yh*a),A=new Offset(0,a),kj=-((x/y)**(n-1)),kh=-((h.dx/h.dy)**(n-1)),c1=intersection(A,0,h,kh),c2=intersection(h,kh,j,kj),w1=f1!*root,w2=f2!*x/a;
  const tx=(p:Offset)=>external((flip?new Offset(p.dy,p.dx):p).add(offset));
  const conic=(c:Offset,p:Offset,w:number)=>{c=tx(c);p=tx(p);path.conicTo(c.dx,c.dy,p.dx,p.dy,w);},cubic=(a:Offset,b:Offset,c:Offset)=>{a=tx(a);b=tx(b);c=tx(c);path.cubicTo(a.dx,a.dy,b.dx,b.dy,c.dx,c.dy);};
  if(!reverse){conic(c1,h,w1);conic(c2,j,w2);cubic(circle[1]!,circle[2]!,circle[3]!);}else{cubic(circle[2]!,circle[1]!,circle[0]!);conic(c2,h,w2);conic(c1,A,w1);}
}
/** RRect is only the corner-radii carrier; the output uses the source superellipse curves. */
export function roundedSuperellipsePath(input:RRect):Path{
  const r=input.scaleRadii(),path=new Path();if(r.isEmpty)return path;
  const split=(left:number,right:number,a:number,b:number)=>a===0&&b===0?(left+right)/2:(left*b+right*a)/(a+b);
  const top=split(r.left,r.right,r.tlRadiusX,r.trRadiusX),right=split(r.top,r.bottom,r.trRadiusY,r.brRadiusY),bottom=split(r.left,r.right,r.blRadiusX,r.brRadiusX),left=split(r.top,r.bottom,r.tlRadiusY,r.blRadiusY);
  path.moveTo(top,r.top);
  const quadrant=(center:Offset,corner:Offset,rx:number,ry:number,sx:number,sy:number,reverse:boolean)=>{
    const vector=corner.subtract(center),radius=Math.min(Math.abs(rx),Math.abs(ry)),fx=radius===0?1:Math.abs(rx)/radius,fy=radius===0?1:Math.abs(ry)/radius,width=Math.abs(vector.dx)/fx,height=Math.abs(vector.dy)/fy,xx=vector.dx/width,yy=vector.dy/height,scaleX=Number.isFinite(xx)?xx:sx,scaleY=Number.isFinite(yy)?yy:sy,c=width-height;
    const transform:Transform=p=>new Offset(center.dx+p.dx*scaleX,center.dy+p.dy*scaleY);
    if(radius<=0||width<=0||height<=0){const p=transform(new Offset(width,height));path.lineTo(p.dx,p.dy);const end=transform(reverse?new Offset(0,height):new Offset(width,0));path.lineTo(end.dx,end.dy);return;}
    if(!reverse){octant(path,width,radius,new Offset(0,-c),transform,false,false);octant(path,height,radius,new Offset(c,0),transform,true,true);}else{octant(path,height,radius,new Offset(c,0),transform,false,true);octant(path,width,radius,new Offset(0,-c),transform,true,false);}
  };
  quadrant(new Offset(top,right),new Offset(r.right,r.top),r.trRadiusX,r.trRadiusY,1,-1,false);quadrant(new Offset(bottom,right),new Offset(r.right,r.bottom),r.brRadiusX,r.brRadiusY,1,1,true);quadrant(new Offset(bottom,left),new Offset(r.left,r.bottom),r.blRadiusX,r.blRadiusY,-1,1,false);quadrant(new Offset(top,left),new Offset(r.left,r.top),r.tlRadiusX,r.tlRadiusY,-1,-1,true);path.lineTo(top,r.top);path.close();return path;
}
export class RoundedSuperellipseBorder extends RoundedRectangleBorder {
  override lerpFrom(a:ShapeBorder|null,t:number):ShapeBorder|null{return a instanceof RoundedSuperellipseBorder?new RoundedSuperellipseBorder({side:BorderSide.lerp(a.side,this.side,t),borderRadius:BorderRadiusGeometry.lerp(a.borderRadius,this.borderRadius,t)!}):ShapeBorder.prototype.lerpFrom.call(this,a,t);}
  override lerpTo(b:ShapeBorder|null,t:number):ShapeBorder|null{return b instanceof RoundedSuperellipseBorder?new RoundedSuperellipseBorder({side:BorderSide.lerp(this.side,b.side,t),borderRadius:BorderRadiusGeometry.lerp(this.borderRadius,b.borderRadius,t)!}):ShapeBorder.prototype.lerpTo.call(this,b,t);}
  override hitTest(..._args:Parameters<ShapeBorder['hitTest']>):boolean{throw new Error('Superellipse containment requires getOuterPath(...).contains(point, hostPaths)');}
  override toString():string{return `RoundedSuperellipseBorder(${this.side}, ${this.borderRadius})`;}
  override getOuterPath(rect:Rect,{textDirection=null}:ShapeBorderOptions={}):Path{return roundedSuperellipsePath(this.borderRadius.resolve(textDirection).toRRect(rect));}
  override getInnerPath(rect:Rect,{textDirection=null}:ShapeBorderOptions={}):Path{return roundedSuperellipsePath(this.borderRadius.resolve(textDirection).toRRect(rect).deflate(this.side.strokeInset));}
  override paintInterior(canvas:Canvas,rect:Rect,paint:Paint,options:ShapeBorderOptions={}):void{canvas.drawPath(this.getOuterPath(rect,options),paint);}
  override paint(canvas:Canvas,rect:Rect,{textDirection=null}:ShapeBorderOptions={}):void{if(this.side.style==='none')return;const r=this.borderRadius.resolve(textDirection).toRRect(rect);if(this.side.width===0){canvas.drawPath(roundedSuperellipsePath(r),this.side.toPaint());return;}const path=roundedSuperellipsePath(r.inflate(this.side.strokeOutset));path.fillType='evenOdd';appendContour(path,roundedSuperellipsePath(r.deflate(this.side.strokeInset)));canvas.drawPath(path,new Paint({color:this.side.color}));}
  override copyWith({side=this.side,borderRadius=this.borderRadius}:{readonly side?:BorderSide;readonly borderRadius?:BorderRadiusGeometry}={}):RoundedSuperellipseBorder{return new RoundedSuperellipseBorder({side,borderRadius});}
  override scale(t:number):RoundedSuperellipseBorder{return new RoundedSuperellipseBorder({side:this.side.scale(t),borderRadius:this.borderRadius.multiply(t)});}
}

function appendContour(target:Path,source:Path):void{for(const operation of source.snapshot().operations){const v=operation.values;switch(operation.verb){case 'moveTo':target.moveTo(v[0]!,v[1]!);break;case 'lineTo':target.lineTo(v[0]!,v[1]!);break;case 'conicTo':target.conicTo(v[0]!,v[1]!,v[2]!,v[3]!,v[4]!);break;case 'cubicTo':target.cubicTo(v[0]!,v[1]!,v[2]!,v[3]!,v[4]!,v[5]!);break;case 'close':target.close();break;default:throw new Error('Unexpected superellipse contour operation');}}}
