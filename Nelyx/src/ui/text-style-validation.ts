// SPDX-License-Identifier: BSD-3-Clause
import {invariant} from '../foundation/errors.ts';
import type {TextRunStyle,TextStrutStyle} from './text-styles.ts';
import {freezePaint} from './paint.ts';
function number(value:number,name:string,min=-16777216,max=16777216):void{invariant(Number.isFinite(value)&&value>=min&&value<=max,'invalid-text-style',name+' outside finite budget');}
function color(value:number):void{if(!(Number.isInteger(value)&&value>=0&&value<=0xffffffff))invariant(false,'invalid-text-style','Text color must be ARGB uint32');}
export function freezeFontFamilies(value:readonly string[]):readonly string[]{if(!(value.length<=64&&value.every(s=>typeof s==='string'&&s.length>0&&s.length<=256&&!s.includes('\0'))))invariant(false,'invalid-text-style','Font family count/name budget');return Object.freeze([...value]);}
const capturedRunStyles=new WeakSet<TextRunStyle>();
export function freezeRunStyle(value:TextRunStyle):TextRunStyle{
  if(capturedRunStyles.has(value))return value;
  if(!(value.foreground===undefined||value.color===undefined))invariant(false,'invalid-text-style','Choose foreground Paint or color');
  if(!(value.background===undefined||value.backgroundColor===undefined))invariant(false,'invalid-text-style','Choose background Paint or backgroundColor');
  if(value.textBaseline!==undefined){if(!(['alphabetic','ideographic'].includes(value.textBaseline)))invariant(false,'invalid-text-style','Invalid text baseline');}
  for(const n of ['color','backgroundColor','decorationColor'] as const)if(value[n]!==undefined)color(value[n]);
  if(value.fontSize!==undefined)number(value.fontSize,'Font size',0,512);if(value.fontWeight!==undefined){if(!(Number.isInteger(value.fontWeight)&&value.fontWeight>=1&&value.fontWeight<=1000))invariant(false,'invalid-text-style','Font weight must be1..1000');}
  if(value.fontStyle!==undefined){if(!(['normal','italic'].includes(value.fontStyle)))invariant(false,'invalid-text-style','Invalid font style');}
  for(const n of ['letterSpacing','wordSpacing'] as const)if(value[n]!==undefined)number(value[n],n,-4096,4096);
  if(value.height!==undefined)number(value.height,'Height multiplier',0,100);if(value.leadingDistribution!==undefined){if(!(['proportional','even'].includes(value.leadingDistribution)))invariant(false,'invalid-text-style','Invalid leading distribution');}
  if(value.locale!==undefined){if(!(value.locale.length<=128&&!value.locale.includes('\0')))invariant(false,'invalid-text-style','Invalid style locale');}
  if(value.decoration!==undefined){if(!(Number.isInteger(value.decoration)&&value.decoration>=0&&value.decoration<=7))invariant(false,'invalid-text-style','Invalid decoration mask');}
  if(value.decorationThickness!==undefined)number(value.decorationThickness,'Decoration thickness',0,100);
  if(value.decorationStyle!==undefined){if(!(['solid','double','dotted','dashed','wavy'].includes(value.decorationStyle)))invariant(false,'invalid-text-style','Invalid decoration style');}
  for(const [name,tag,field]of [['fontFeatures','name','value'],['fontVariations','axis','value']] as const){const list=value[name];if(list){if(!(list.length<=64))invariant(false,'invalid-text-style','OpenType entry budget');for(const item of list){const record=item as unknown as Record<string,unknown>;if(!(typeof record[tag]==='string'&&/^[\x20-\x7e]{4}$/.test(record[tag])))invariant(false,'invalid-text-style','Invalid OpenType tag');const n=record[field] as number;number(n,name,name==='fontFeatures'?0:-16777216,name==='fontFeatures'?0xffffffff:16777216);if(name==='fontFeatures'){if(!(Number.isInteger(n)))invariant(false,'invalid-text-style','Font feature must be integer');}}}}
  if(value.shadows){if(!(value.shadows.length<=16))invariant(false,'invalid-text-style','Text shadow budget');for(const shadow of value.shadows){color(shadow.color);number(shadow.offset.x,'Shadow x');number(shadow.offset.y,'Shadow y');number(shadow.blurSigma,'Shadow blur',0,4096);}}
  const captured=Object.freeze({...value,...(value.foreground?{foreground:freezePaint(value.foreground)}:undefined),...(value.background?{background:freezePaint(value.background)}:undefined),...(value.fontFamilies?{fontFamilies:freezeFontFamilies(value.fontFamilies)}:undefined),...(value.fontFeatures?{fontFeatures:Object.freeze(value.fontFeatures.map(x=>Object.freeze({...x})))}:undefined),...(value.fontVariations?{fontVariations:Object.freeze(value.fontVariations.map(x=>Object.freeze({...x})))}:undefined),...(value.shadows?{shadows:Object.freeze(value.shadows.map(x=>Object.freeze({...x,offset:Object.freeze({x:x.offset.x,y:x.offset.y})})))}:undefined)});
  capturedRunStyles.add(captured);return captured;
}
export function freezeStrutStyle(value:TextStrutStyle):TextStrutStyle{freezeRunStyle({...value});if(value.leading!==undefined)number(value.leading,'Strut leading',0,100);if(value.forceStrutHeight!==undefined){if(!(typeof value.forceStrutHeight==='boolean'))invariant(false,'invalid-text-style','Invalid strut flag');}return Object.freeze({...value,...(value.fontFamilies?{fontFamilies:freezeFontFamilies(value.fontFamilies)}:{})});}
