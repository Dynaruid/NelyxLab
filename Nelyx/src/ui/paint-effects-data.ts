// SPDX-License-Identifier: BSD-3-Clause
import {invariant} from '../foundation/errors.ts';
import {copyResourceId} from './resource-retention.ts';
import {blendModeValues as blendModes} from './blend-mode-data.ts';
import type {BlendMode} from './paint.ts';
import type {ResourceId,Rect} from './types.ts';
export type TileMode='clamp'|'repeated'|'mirror'|'decal';
export type FilterQuality='none'|'low'|'medium'|'high';
export type BlurStyle='normal'|'solid'|'outer'|'inner';
export const tileModes=Object.freeze(['clamp','repeated','mirror','decal'] as const);
export const filterQualities=Object.freeze(['none','low','medium','high'] as const);
export const blurStyles=Object.freeze(['normal','solid','outer','inner'] as const);
export const paintEffectLimits=Object.freeze({colors:256,depth:16,nodes:64});
interface GradientData {readonly colors:readonly number[];readonly stops:readonly number[]|null;readonly tileMode:TileMode;readonly matrix:readonly number[]|null}
export type ShaderSnapshot=
 | {readonly kind:'runtime';readonly source:string;readonly uniforms:readonly number[]}
 | GradientData&{readonly kind:'linear';readonly points:readonly number[]}
 | GradientData&{readonly kind:'radial';readonly points:readonly number[]}
 | GradientData&{readonly kind:'sweep';readonly points:readonly number[]}
 | {readonly kind:'image';readonly image:ResourceId;readonly tileModeX:TileMode;readonly tileModeY:TileMode;readonly matrix:readonly number[];readonly filterQuality:FilterQuality|null};
export type ColorFilterSnapshot={readonly kind:'colorMode';readonly color:number;readonly blendMode:BlendMode}|{readonly kind:'colorMatrix';readonly matrix:readonly number[]}|{readonly kind:'linearToSrgb'|'srgbToLinear'};
export type ImageFilterSnapshot=ColorFilterSnapshot
 | {readonly kind:'blur';readonly sigmaX:number;readonly sigmaY:number;readonly tileMode:TileMode|null;readonly bounds:Rect|null}
 | {readonly kind:'dilate'|'erode';readonly radiusX:number;readonly radiusY:number}
 | {readonly kind:'matrix';readonly matrix:readonly number[];readonly filterQuality:FilterQuality}
 | {readonly kind:'compose';readonly outer:ImageFilterSnapshot;readonly inner:ImageFilterSnapshot};
export interface MaskFilterSnapshot {readonly style:BlurStyle;readonly sigma:number}
export function effectScalar(value:number,label='effect scalar'):number {invariant(typeof value==='number'&&Number.isFinite(value)&&Number.isFinite(Math.fround(value)),'invalid-paint-effect',label+' must fit finite SkScalar');return Math.fround(value);}
function nonnegative(value:number,label:string):number{const result=effectScalar(value,label);invariant(result>=0,'invalid-paint-effect',label+' must be nonnegative');return result;}
export function effectColor(value:number):number{invariant(Number.isInteger(value)&&value>=0&&value<=0xffffffff,'invalid-color','Effect color must be ARGB uint32');return value;}
export function effectMatrix(value:ArrayLike<number>,length=16):readonly number[]{invariant(value&&value.length===length,'invalid-paint-effect','Incorrect effect matrix length');return Object.freeze(Array.from(value,item=>effectScalar(item,'effect matrix')));}
export function planeMatrix(value:readonly number[]):number[]{return [value[0]!,value[4]!,value[12]!,value[1]!,value[5]!,value[13]!,value[3]!,value[7]!,value[15]!];}
export function freezeShader(value:ShaderSnapshot):ShaderSnapshot {
 invariant(value&&typeof value==='object','invalid-paint-effect','Invalid shader');
 if(value.kind==='runtime'){
  // oxlint-disable-next-line no-control-regex -- Control code points are deliberately matched for input validation or normalization.
  invariant(typeof value.source==='string'&&value.source.length>0&&value.source.length<=16384&&/^[\x09\x0a\x0d\x20-\x7e]+$/.test(value.source),'invalid-paint-effect','Runtime source must be bounded ASCII SkSL');
  const tokens=value.source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,' ');
  invariant(!/\buniform\s+(?:shader|colorFilter|blender)\b/.test(tokens),'invalid-paint-effect','Runtime child effects are unsupported');
  invariant(Array.isArray(value.uniforms)&&value.uniforms.length<=256,'invalid-paint-effect','Runtime uniform budget exceeded');
  return Object.freeze({kind:'runtime',source:value.source,uniforms:Object.freeze(value.uniforms.map(v=>effectScalar(v,'runtime uniform')))});
 }
 if(value.kind==='image'){const image=value.image;invariant(image&&typeof image.id==='string'&&image.id.length>0&&Number.isSafeInteger(image.generation)&&image.generation>0&&tileModes.includes(value.tileModeX)&&tileModes.includes(value.tileModeY)&&(value.filterQuality===null||filterQualities.includes(value.filterQuality)),'invalid-paint-effect','Invalid image shader');return Object.freeze({kind:value.kind,image:copyResourceId(image),tileModeX:value.tileModeX,tileModeY:value.tileModeY,filterQuality:value.filterQuality,matrix:effectMatrix(value.matrix)});}
 invariant(['linear','radial','sweep'].includes(value.kind)&&tileModes.includes(value.tileMode)&&Array.isArray(value.colors)&&value.colors.length>0&&value.colors.length<=paintEffectLimits.colors,'invalid-paint-effect','Invalid gradient kind/colors/tile mode');
 invariant(value.stops===null?value.colors.length===2:Array.isArray(value.stops)&&value.stops.length===value.colors.length,'invalid-paint-effect','Colors require two entries without stops, or matching stops');
 const colors=Object.freeze(value.colors.map(effectColor)),stops=value.stops===null?null:Object.freeze(value.stops.map(item=>effectScalar(item,'gradient stop'))),points=effectMatrix(value.points,value.kind==='radial'?6:4),matrix=value.matrix===null?null:effectMatrix(value.matrix);
 if(value.kind==='radial')invariant(points[2]!>=0&&points[5]!>=0,'invalid-paint-effect','Gradient radii must be nonnegative');
 if(value.kind==='sweep')invariant(points[2]!<points[3]!,'invalid-paint-effect','Sweep start angle must precede end angle');
 return Object.freeze({kind:value.kind,tileMode:value.tileMode,colors,stops,points,matrix});
}
export function freezeColorFilter(value:ColorFilterSnapshot):ColorFilterSnapshot {
 invariant(value&&typeof value==='object','invalid-paint-effect','Invalid color filter');
 switch(value.kind){case 'colorMode':invariant(blendModes.includes(value.blendMode),'invalid-paint-effect','Invalid color filter blend mode');return Object.freeze({kind:value.kind,blendMode:value.blendMode,color:effectColor(value.color)});case 'colorMatrix':return Object.freeze({kind:value.kind,matrix:effectMatrix(value.matrix,20)});case 'linearToSrgb':case 'srgbToLinear':return Object.freeze({kind:value.kind});default:throw new TypeError('Unknown color filter');}
}
export function freezeImageFilter(value:ImageFilterSnapshot):ImageFilterSnapshot {
 let nodes=0;const ancestors=new Set<object>();
 const visit=(item:ImageFilterSnapshot,depth:number):ImageFilterSnapshot=>{
  invariant(item&&typeof item==='object'&&depth<=paintEffectLimits.depth&&++nodes<=paintEffectLimits.nodes&&!ancestors.has(item),'invalid-paint-effect','Image filter graph exceeds its budget or is cyclic');ancestors.add(item);
  try{switch(item.kind){
   case 'colorMode':case 'colorMatrix':case 'linearToSrgb':case 'srgbToLinear':return freezeColorFilter(item);
   case 'blur':{invariant(item.tileMode===null||tileModes.includes(item.tileMode),'invalid-paint-effect','Invalid blur tile mode');let bounds:Rect|null=null;if(item.bounds!==null){const r=item.bounds;bounds=Object.freeze({x:effectScalar(r.x),y:effectScalar(r.y),width:nonnegative(r.width,'blur width'),height:nonnegative(r.height,'blur height')});}return Object.freeze({kind:item.kind,tileMode:item.tileMode,sigmaX:nonnegative(item.sigmaX,'sigmaX'),sigmaY:nonnegative(item.sigmaY,'sigmaY'),bounds});}
   case 'dilate':case 'erode':return Object.freeze({kind:item.kind,radiusX:nonnegative(item.radiusX,'radiusX'),radiusY:nonnegative(item.radiusY,'radiusY')});
   case 'matrix':invariant(filterQualities.includes(item.filterQuality),'invalid-paint-effect','Invalid filter quality');return Object.freeze({kind:item.kind,filterQuality:item.filterQuality,matrix:effectMatrix(item.matrix)});
   case 'compose':return Object.freeze({kind:'compose',outer:visit(item.outer,depth+1),inner:visit(item.inner,depth+1)});
   default:throw new TypeError('Unknown image filter');
  }}finally{ancestors.delete(item);}
 };return visit(value,0);
}
export function freezeMaskFilter(value:MaskFilterSnapshot):MaskFilterSnapshot {invariant(value&&blurStyles.includes(value.style),'invalid-paint-effect','Unknown blur style');return Object.freeze({style:value.style,sigma:nonnegative(value.sigma,'mask sigma')});}
