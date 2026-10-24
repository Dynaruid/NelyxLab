// SPDX-License-Identifier: BSD-3-Clause
import {invariant} from '../foundation/errors.ts';
import type {TextRunStyle,TextStrutStyle} from './text-styles.ts';
import {freezePaint} from './paint.ts';
function number(value:number,name:string,min=-16777216,max=16777216):void{invariant(Number.isFinite(value)&&value>=min&&value<=max,'invalid-text-style',name+' outside finite budget');}
function color(value:number):void{invariant(Number.isInteger(value)&&value>=0&&value<=0xffffffff,'invalid-text-style','Text color must be ARGB uint32');}
export function freezeFontFamilies(value:readonly string[]):readonly string[]{invariant(value.length<=64&&value.every(s=>typeof s==='string'&&s.length>0&&s.length<=256&&!s.includes('\0')),'invalid-text-style','Font family count/name budget');return Object.freeze([...value]);}
const capturedRunStyles=new WeakSet<TextRunStyle>();
export function freezeRunStyle(value:TextRunStyle):TextRunStyle{
  if(capturedRunStyles.has(value))return value;
  invariant(value.foreground===undefined||value.color===undefined,'invalid-text-style','Choose foreground Paint or color');
  invariant(value.background===undefined||value.backgroundColor===undefined,'invalid-text-style','Choose background Paint or backgroundColor');
  if(value.textBaseline!==undefined)invariant(['alphabetic','ideographic'].includes(value.textBaseline),'invalid-text-style','Invalid text baseline');
  for(const n of ['color','backgroundColor','decorationColor'] as const)if(value[n]!==undefined)color(value[n]);
  if(value.fontSize!==undefined)number(value.fontSize,'Font size',0,512);if(value.fontWeight!==undefined)invariant(Number.isInteger(value.fontWeight)&&value.fontWeight>=1&&value.fontWeight<=1000,'invalid-text-style','Font weight must be1..1000');
  if(value.fontStyle!==undefined)invariant(['normal','italic'].includes(value.fontStyle),'invalid-text-style','Invalid font style');
  for(const n of ['letterSpacing','wordSpacing'] as const)if(value[n]!==undefined)number(value[n],n,-4096,4096);
  if(value.height!==undefined)number(value.height,'Height multiplier',0,100);if(value.leadingDistribution!==undefined)invariant(['proportional','even'].includes(value.leadingDistribution),'invalid-text-style','Invalid leading distribution');
  if(value.locale!==undefined)invariant(value.locale.length<=128&&!value.locale.includes('\0'),'invalid-text-style','Invalid style locale');
  if(value.decoration!==undefined)invariant(Number.isInteger(value.decoration)&&value.decoration>=0&&value.decoration<=7,'invalid-text-style','Invalid decoration mask');
  if(value.decorationThickness!==undefined)number(value.decorationThickness,'Decoration thickness',0,100);
  if(value.decorationStyle!==undefined)invariant(['solid','double','dotted','dashed','wavy'].includes(value.decorationStyle),'invalid-text-style','Invalid decoration style');
  for(const [name,tag,field]of [['fontFeatures','name','value'],['fontVariations','axis','value']] as const){const list=value[name];if(list){invariant(list.length<=64,'invalid-text-style','OpenType entry budget');for(const item of list){const record=item as unknown as Record<string,unknown>;invariant(typeof record[tag]==='string'&&/^[\x20-\x7e]{4}$/.test(record[tag]),'invalid-text-style','Invalid OpenType tag');const n=record[field] as number;number(n,name,name==='fontFeatures'?0:-16777216,name==='fontFeatures'?0xffffffff:16777216);if(name==='fontFeatures')invariant(Number.isInteger(n),'invalid-text-style','Font feature must be integer');}}}
  if(value.shadows){invariant(value.shadows.length<=16,'invalid-text-style','Text shadow budget');for(const shadow of value.shadows){color(shadow.color);number(shadow.offset.x,'Shadow x');number(shadow.offset.y,'Shadow y');number(shadow.blurSigma,'Shadow blur',0,4096);}}
  const captured=Object.freeze({...value,...(value.foreground?{foreground:freezePaint(value.foreground)}:{}),...(value.background?{background:freezePaint(value.background)}:{}),...(value.fontFamilies?{fontFamilies:freezeFontFamilies(value.fontFamilies)}:{}),...(value.fontFeatures?{fontFeatures:Object.freeze(value.fontFeatures.map(x=>Object.freeze({...x})))}:{}),...(value.fontVariations?{fontVariations:Object.freeze(value.fontVariations.map(x=>Object.freeze({...x})))}:{}),...(value.shadows?{shadows:Object.freeze(value.shadows.map(x=>Object.freeze({...x,offset:Object.freeze({x:x.offset.x,y:x.offset.y})})))}:{})});
  capturedRunStyles.add(captured);return captured;
}
export function freezeStrutStyle(value:TextStrutStyle):TextStrutStyle{freezeRunStyle({...value});if(value.leading!==undefined)number(value.leading,'Strut leading',0,100);if(value.forceStrutHeight!==undefined)invariant(typeof value.forceStrutHeight==='boolean','invalid-text-style','Invalid strut flag');return Object.freeze({...value,...(value.fontFamilies?{fontFamilies:freezeFontFamilies(value.fontFamilies)}:{})});}
