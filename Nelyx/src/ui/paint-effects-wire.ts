// SPDX-License-Identifier: BSD-3-Clause
// Wire 6 value records. Counts include every gradient stop and matrix row.
import type {PaintSnapshot} from './paint.ts';
import {blendModeValues as blendModes} from './blend-mode-data.ts';
import {tileModes,filterQualities,blurStyles} from './paint-effects-data.ts';
import type {ShaderSnapshot,ColorFilterSnapshot,ImageFilterSnapshot} from './paint-effects-data.ts';
import type {ResourceId} from './types.ts';
export interface EffectWireRecord {readonly op:27|28|29|30;readonly color:number;readonly values:readonly number[];readonly flags:number;readonly aux1:number;readonly aux2:number}
export function paintHasEffects(value:PaintSnapshot):boolean{return !!(value.shader||value.colorFilter||value.imageFilter||value.maskFilter||value.filterQuality&&value.filterQuality!=='none'||value.invertColors||value.dither);}
function colorCount(value:ColorFilterSnapshot):number{return value.kind==='colorMatrix'?5:1;}
function imageCount(value:ImageFilterSnapshot):number{switch(value.kind){case 'compose':return 1+imageCount(value.outer)+imageCount(value.inner);case 'matrix':return 4;case 'blur':return value.bounds?2:1;case 'dilate':case 'erode':return 1;default:return colorCount(value);}}
function shaderCount(value:ShaderSnapshot):number{return value.kind==='runtime'?1+Math.ceil(value.source.length/18)+Math.ceil(value.uniforms.length/6):value.kind==='image'?4:1+value.colors.length+(value.matrix?3:0);}
export function paintEffectRecordCount(value:PaintSnapshot):number{return paintHasEffects(value)?1+(value.shader?shaderCount(value.shader):0)+(value.colorFilter?colorCount(value.colorFilter):0)+(value.imageFilter?imageCount(value.imageFilter):0)+(value.maskFilter?1:0):0;}
export function encodePaintEffects(value:PaintSnapshot,resolve:(resource:ResourceId)=>{id:number;generation:number}):readonly EffectWireRecord[] {
 if(!paintHasEffects(value))return [];
 const rows:EffectWireRecord[]=[],record=(op:EffectWireRecord['op'],color=0,values:readonly number[]=[],flags=0,aux1=0,aux2=0)=>rows.push({op,color,values,flags,aux1,aux2});
 const matrix=(values:readonly number[])=>{for(let at=0;at<values.length;at+=6)record(30,0,values.slice(at,at+6));};
 const color=(filter:ColorFilterSnapshot)=>{switch(filter.kind){case 'colorMode':record(28,10,[],blendModes.indexOf(filter.blendMode),filter.color);break;case 'colorMatrix':record(28,11);matrix(filter.matrix);break;case 'linearToSrgb':record(28,12);break;case 'srgbToLinear':record(28,13);break;}};
 const image=(filter:ImageFilterSnapshot):void=>{switch(filter.kind){case 'blur':record(28,20,[filter.sigmaX,filter.sigmaY],(filter.tileMode===null?4:tileModes.indexOf(filter.tileMode))|(filter.bounds?8:0));if(filter.bounds){const b=filter.bounds;record(30,0,[b.x,b.y,b.width,b.height]);}break;case 'dilate':case 'erode':record(28,filter.kind==='dilate'?21:22,[filter.radiusX,filter.radiusY]);break;case 'matrix':record(28,23,[],filterQualities.indexOf(filter.filterQuality));matrix(filter.matrix);break;case 'compose':record(28,24);image(filter.outer);image(filter.inner);break;default:color(filter);}};
 record(27,0,[value.shader?shaderCount(value.shader):0,value.colorFilter?colorCount(value.colorFilter):0,value.imageFilter?imageCount(value.imageFilter):0,value.maskFilter?1:0],filterQualities.indexOf(value.filterQuality??'none')|(value.invertColors?4:0)|(value.dither?8:0));
 if(value.shader){const shader=value.shader;if(shader.kind==='runtime'){
  record(28,5,[],0,shader.source.length,shader.uniforms.length);
  const packed:number[]=[];for(let n=0;n<shader.source.length;n+=3)packed.push(shader.source.charCodeAt(n)|((shader.source.charCodeAt(n+1)||0)<<8)|((shader.source.charCodeAt(n+2)||0)<<16));
  matrix(packed);matrix(shader.uniforms);
 }else if(shader.kind==='image'){const resource=resolve(shader.image);record(28,4,[],tileModes.indexOf(shader.tileModeX)|(tileModes.indexOf(shader.tileModeY)<<2)|((shader.filterQuality===null?4:filterQualities.indexOf(shader.filterQuality))<<4),resource.id,resource.generation);matrix(shader.matrix);}else{record(28,shader.kind==='linear'?1:shader.kind==='radial'?2:3,shader.points,tileModes.indexOf(shader.tileMode)|(shader.matrix?4:0),shader.colors.length);for(let n=0;n<shader.colors.length;n++)record(29,shader.colors[n]!,[shader.stops?.[n]??n/(shader.colors.length-1)]);if(shader.matrix)matrix(shader.matrix);}}
 if(value.colorFilter)color(value.colorFilter);if(value.imageFilter)image(value.imageFilter);if(value.maskFilter)record(28,30,[value.maskFilter.sigma],blurStyles.indexOf(value.maskFilter.style));return rows;
}
