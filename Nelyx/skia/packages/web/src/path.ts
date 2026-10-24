// SPDX-License-Identifier: BSD-3-Clause
import type {CanvasKit,Path} from 'canvaskit-wasm';
import {freezePath} from '@nelyx/core/ui/path';
import type {PathSnapshot} from '@nelyx/core/ui/path';
/** Rendering and geometry queries construct identical engine paths. */
export function createEnginePath(ck:CanvasKit,value:PathSnapshot):Path{
 const snapshot=freezePath(value),builder=new ck.PathBuilder(),errors:unknown[]=[];let path:Path|undefined;
 try{builder.setFillType(snapshot.fillType==='evenOdd'?ck.FillType.EvenOdd:ck.FillType.Winding);
 for(const {verb,values:v} of snapshot.operations)switch(verb){
          case 'moveTo':builder.moveTo(v[0]!,v[1]!);break;case 'relativeMoveTo':builder.rMoveTo(v[0]!,v[1]!);break;
          case 'lineTo':builder.lineTo(v[0]!,v[1]!);break;case 'relativeLineTo':builder.rLineTo(v[0]!,v[1]!);break;
          case 'quadraticBezierTo':builder.quadTo(v[0]!,v[1]!,v[2]!,v[3]!);break;case 'relativeQuadraticBezierTo':builder.rQuadTo(v[0]!,v[1]!,v[2]!,v[3]!);break;
          case 'cubicTo':builder.cubicTo(v[0]!,v[1]!,v[2]!,v[3]!,v[4]!,v[5]!);break;case 'relativeCubicTo':builder.rCubicTo(v[0]!,v[1]!,v[2]!,v[3]!,v[4]!,v[5]!);break;
          case 'conicTo':builder.conicTo(v[0]!,v[1]!,v[2]!,v[3]!,v[4]!);break;case 'relativeConicTo':builder.rConicTo(v[0]!,v[1]!,v[2]!,v[3]!,v[4]!);break;
          case 'close':builder.close();break;case 'addRect':builder.addRect([...v]);break;case 'addOval':builder.addOval([...v],false,1);break;
          case 'addRRect':builder.addRRect(Float32Array.from(v),false);break;
        }
 path=builder.detach();}catch(error){errors.push(error);}finally{try{builder.delete();}catch(error){errors.push(error);}}
 if(errors.length){try{path?.delete();}catch(error){errors.push(error);}if(errors.length===1)throw errors[0];throw new AggregateError(errors,'Web path construction/temporary retirement failed');}return path!;
}
