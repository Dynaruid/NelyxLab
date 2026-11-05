// SPDX-License-Identifier: BSD-3-Clause
import type {CanvasKit,Canvas,Path,Paint} from 'canvaskit-wasm';
import type {GraphicsOptions,EngineNodeSnapshot,PathSegment,AffineMatrix} from '../../../runtime/engine-client/index.ts';
import {protocol as p} from '../../../runtime/engine-client/index.ts';
export function canvasMatrix(m:AffineMatrix,scale=1):number[]{
  return [m[0]*scale,m[2]*scale,m[4]*scale,m[1]*scale,m[3]*scale,m[5]*scale,0,0,1];
}
export function relativeMatrix(parent:AffineMatrix,child:AffineMatrix):AffineMatrix|null {
  const determinant=parent[0]*parent[3]-parent[1]*parent[2];
  if(Math.abs(determinant)<1e-12)return null;
  const a=parent[3]/determinant,b=-parent[1]/determinant,c=-parent[2]/determinant,d=parent[0]/determinant;
  const x=child[4]-parent[4],y=child[5]-parent[5];
  return [a*child[0]+c*child[1],b*child[0]+d*child[1],a*child[2]+c*child[3],b*child[2]+d*child[3],a*x+c*y,b*x+d*y];
}
export function makePath(ck:CanvasKit,segments:readonly PathSegment[],fillRule:GraphicsOptions['fillRule']):Path {
  if(segments.length>p.limits.pathCommands)throw new Error('Provider path command budget');
  const builder=new ck.PathBuilder();
  try{
    builder.setFillType(fillRule==='evenOdd'?ck.FillType.EvenOdd:ck.FillType.Winding);
    for(const segment of segments){
      for(const value of segment.slice(1))if(!Number.isFinite(value))throw new Error('Non-finite path command');
      switch(segment[0]){
        case 'move':builder.moveTo(segment[1],segment[2]);break;
        case 'line':builder.lineTo(segment[1],segment[2]);break;
        case 'quad':builder.quadTo(segment[1],segment[2],segment[3],segment[4]);break;
        case 'cubic':builder.cubicTo(segment[1],segment[2],segment[3],segment[4],segment[5],segment[6]);break;
        case 'close':builder.close();break;
      }
    }return builder.detach();
  }finally{builder.delete();}
}
function color(ck:CanvasKit,argb:number){return ck.Color((argb>>>16)&255,(argb>>>8)&255,argb&255,(argb>>>24)/255);}
export function paintShape(ck:CanvasKit,canvas:Canvas,node:EngineNodeSnapshot,path:Path|undefined,paint:Paint):void{
  const shape=()=>{if(node.kind===p.kinds.path){if(path)canvas.drawPath(path,paint);}
    else canvas.drawRRect(ck.RRectXY(ck.XYWHRect(0,0,node.width,node.height),node.radius,node.radius),paint);};
  if(node.graphics?.shadow?.color){const shadow=node.graphics.shadow;
    const filter=shadow.sigma>0?ck.MaskFilter.MakeBlur(ck.BlurStyle.Normal,shadow.sigma,true):null;
    canvas.save();try{canvas.translate(shadow.x,shadow.y);paint.setColor(color(ck,shadow.color));
      if(filter)paint.setMaskFilter(filter);shape();
    }finally{paint.setMaskFilter(null);filter?.delete();canvas.restore();}}
  if(node.color>>>24){paint.setColor(color(ck,node.color));shape();}
  if(node.graphics?.stroke?.color&&node.graphics.stroke.width>0){paint.setColor(color(ck,node.graphics.stroke.color));
    paint.setStyle(ck.PaintStyle.Stroke);paint.setStrokeWidth(node.graphics.stroke.width);
    try{shape();}finally{paint.setStyle(ck.PaintStyle.Fill);}}
}
