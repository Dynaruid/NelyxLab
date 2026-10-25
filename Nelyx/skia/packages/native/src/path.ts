// SPDX-License-Identifier: BSD-3-Clause
import type {Skia} from './skia/types/Skia.ts';
import type {SkPath} from './skia/types/Drawing.ts';
import {freezePath} from '@nelyx/core/ui/path';
import type {PathSnapshot} from '@nelyx/core/ui/path';
export function createEnginePath(api:Skia,value:PathSnapshot):SkPath{
 const snapshot=freezePath(value),temporary:{dispose():void}[]=[],own=<T extends {dispose():void}>(value:T):T=>{temporary.push(value);return value;};
 let path:SkPath|undefined;const errors:unknown[]=[];
 const rounded=(v:readonly number[])=>{const rect=own(api.XYWHRect(0,0,0,0));rect.setLTRB(v[0]!,v[1]!,v[2]!,v[3]!);return {rect,topLeft:{x:v[4]!,y:v[5]!},topRight:{x:v[6]!,y:v[7]!},bottomRight:{x:v[8]!,y:v[9]!},bottomLeft:{x:v[10]!,y:v[11]!}};};
 try{const builder=own(api.PathBuilder.Make());builder.setFillType(snapshot.fillType==='evenOdd'?1:0);
 for(const {verb,values:v} of snapshot.operations)switch(verb){
            case 'moveTo':builder.moveTo(v[0]!,v[1]!);break;case 'relativeMoveTo':builder.rMoveTo(v[0]!,v[1]!);break;
            case 'lineTo':builder.lineTo(v[0]!,v[1]!);break;case 'relativeLineTo':builder.rLineTo(v[0]!,v[1]!);break;
            case 'quadraticBezierTo':builder.quadTo(v[0]!,v[1]!,v[2]!,v[3]!);break;case 'relativeQuadraticBezierTo':builder.rQuadTo(v[0]!,v[1]!,v[2]!,v[3]!);break;
            case 'cubicTo':builder.cubicTo(v[0]!,v[1]!,v[2]!,v[3]!,v[4]!,v[5]!);break;case 'relativeCubicTo':builder.rCubicTo(v[0]!,v[1]!,v[2]!,v[3]!,v[4]!,v[5]!);break;
            case 'conicTo':builder.conicTo(v[0]!,v[1]!,v[2]!,v[3]!,v[4]!);break;case 'relativeConicTo':builder.rConicTo(v[0]!,v[1]!,v[2]!,v[3]!,v[4]!);break;
            case 'close':builder.close();break;
            case 'addRect':case 'addOval':{const rect=own(api.XYWHRect(0,0,0,0));rect.setLTRB(v[0]!,v[1]!,v[2]!,v[3]!);if(verb==='addRect')builder.addRect(rect);else builder.addOval(rect,false,1);break;}
            case 'addRRect':builder.addRRect(rounded(v),false);break;
          }
 path=builder.build();}catch(error){errors.push(error);}finally{for(const value of temporary.reverse())try{value.dispose();}catch(error){errors.push(error);}}
 if(errors.length){try{path?.dispose();}catch(error){errors.push(error);}if(errors.length===1)throw errors[0];throw new AggregateError(errors,'Native path construction/temporary retirement failed');}return path!;
}
