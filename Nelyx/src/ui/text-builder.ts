// SPDX-License-Identifier: BSD-3-Clause
import type {TextLayoutInput} from './types.ts';import type {TextRunStyle,TextPlaceholder} from './text-styles.ts';
import type {ResourceId} from './types.ts';
export interface StyledTextBuilder {push(style:TextRunStyle):void;pop():void;addText(text:string):void;addPlaceholder(placeholder:TextPlaceholder):void}
/** A registered variable face needs explicit design coordinates to honor weight. */
export function paragraphFontVariations(style:TextRunStyle):{axis:string;value:number}[]{const values=style.fontVariations?.map(value=>({...value}))??[];if(!values.some(value=>value.axis==='wght'))values.unshift({axis:'wght',value:style.fontWeight??400});return values;}
/** Paint wins when an inherited color meets a run's Paint, or vice versa. */
export function mergeTextRunStyle(base:TextRunStyle|undefined,run:TextRunStyle|undefined):TextRunStyle{const result={...base,...run};if(result.foreground!==undefined)delete result.color;if(result.background!==undefined)delete result.backgroundColor;return result;}
export function textPaintResources(input:Pick<TextLayoutInput,'style'|'runs'>):readonly ResourceId[]{const values:ResourceId[]=[];for(const style of [input.style,...input.runs?.map(run=>run.style)??[]])for(const paint of [style?.foreground,style?.background])if(paint?.shader?.kind==='image')values.push(paint.shader.image);return values;}
/** Emit UTF-16 runs/placeholders in one paragraph, preserving gaps and run styles. */
export function buildStyledText(input:TextLayoutInput,builder:StyledTextBuilder):void{
  const runs=input.runs??[],placeholders=input.placeholders??[];let cursor=0,runIndex=0,placeholderIndex=0;
  while(cursor<input.text.length){while(runIndex<runs.length&&runs[runIndex]!.end<=cursor)runIndex++;const run=runs[runIndex],style=mergeTextRunStyle(input.style,run&&cursor>=run.start?run.style:undefined);builder.push(style);try{const placeholder=placeholders[placeholderIndex];if(placeholder?.offset===cursor){builder.addPlaceholder(placeholder);placeholderIndex++;cursor++;}else{const end=Math.min(input.text.length,placeholder?.offset??Infinity,run?(cursor<run.start?run.start:run.end):Infinity);builder.addText(input.text.slice(cursor,end));cursor=end;}}finally{builder.pop();}}
}
