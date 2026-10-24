import { finite, generation } from '../foundation/numbers.ts';
import { invariant } from '../foundation/errors.ts';
import type {Rect,ResourceId,TextLayout,TextLayoutGeometry,TextLayoutInput,TextLayoutRequest} from './types.ts';
import {freezeRunStyle,freezeStrutStyle} from './text-style-validation.ts';
import {copyResourceId} from './resource-retention.ts';
import {isCacheableTextInput,textInputSerializationIsPlain} from './text-input-data.ts';
// Keep current UI producers bounded separately from immutable recorded scenes
// and the two admitted renderer frames. Retained resources retire by their real
// leases, including while the next layout is replacing the current paragraphs.
export const textLimits=Object.freeze({units:4096,width:16777216,resources:256,retainedResources:1024,producerUnits:65536,retainedUnits:262144,producerInputBytes:4194304,retainedInputBytes:16777216,lines:128,runs:256,placeholders:64,geometryBytes:32768,glyphBytes:262144});
export interface TextInputCost {readonly units:number;readonly bytes:number}
export interface TextLayoutResourceTotals {readonly resident:number;readonly producers:number;readonly residentUnits:number;readonly producerUnits:number;readonly residentBytes:number;readonly producerBytes:number}
const retainedInputCosts=new WeakMap<TextLayout,TextInputCost>();
const capturedInputs=new WeakSet<TextLayoutInput>();
const ownedInputs=new WeakMap<TextLayoutInput,{readonly serialized:string;readonly cost:TextInputCost}>();
/** @internal Only a locally captured, schema-checked DTO can share key/cost data.
 * Frozen public objects, Proxy wrappers and extension/toJSON inputs stay live. */
export function ownedTextInputSerialization(input:TextLayoutInput):string|undefined{
  if(!textInputSerializationIsPlain())return undefined;
  const known=ownedInputs.get(input);if(known)return known.serialized;
  if(!capturedInputs.has(input)||!isCacheableTextInput(input))return undefined;
  const serialized=JSON.stringify(input);ownedInputs.set(input,{serialized,cost:Object.freeze({units:input.text.length,bytes:serialized.length*2})});return serialized;
}
export function serializeTextInput(input:TextLayoutInput):string{return (textInputSerializationIsPlain()?ownedInputs.get(input)?.serialized:undefined)??JSON.stringify(input);}
export function textInputCost(input:TextLayoutInput):TextInputCost{const cost=textInputSerializationIsPlain()?ownedInputs.get(input)?.cost:undefined;return cost?{units:cost.units,bytes:cost.bytes}:{units:input.text.length,bytes:JSON.stringify(input).length*2};}
function retainedInputCost(layout:TextLayout):TextInputCost{let cost=retainedInputCosts.get(layout);if(!cost){cost=textInputCost(layout.input);retainedInputCosts.set(layout,cost);}return cost;}
export function admitTextLayoutResources(layouts:Iterable<TextLayout>,isInitialProducer:(layout:TextLayout)=>boolean|number,input:TextLayoutInput,request:TextLayoutRequest={},retained?:TextLayout):void{
  invariant(request.transient===undefined||typeof request.transient==='boolean','invalid-text-request','Invalid transient paragraph request');
  // An unbounded aligned measurement can lay out twice. Its second layout
  // replaces the exact live transient producer under the same ownership gate.
  // Count small labels independently of content-heavy paragraphs. UTF-16 units
  // and serialized snapshot bytes bound aggregate content/style payloads before
  // shaping; these are workload limits, not measurements of native heap bytes.
  // A replacement discounts only its exact live producer. Its old recording/GPU
  // holders still consume the resident count and content budgets until retired.
  // Reusing an owned immutable paragraph adds one logical producer, but no
  // resident allocation. Its existing recordings remain fully charged.
  let resident=0,producers=0,residentUnits=0,producerUnits=0,residentBytes=0,producerBytes=0,replacing=false,reusing=false;
  const candidate=textInputCost(input);
  for(const layout of layouts){const cost=retainedInputCost(layout);resident++;residentUnits+=cost.units;residentBytes+=cost.bytes;if(layout===retained)reusing=true;const raw=isInitialProducer(layout),count=typeof raw==='boolean'?Number(raw):raw;if(count){producers+=count;producerUnits+=cost.units*count;producerBytes+=cost.bytes*count;if(layout===request.replacing){replacing=true;producerUnits-=cost.units;producerBytes-=cost.bytes;}}}
  checkTextLayoutAdmission({resident,producers,residentUnits,producerUnits,residentBytes,producerBytes,replacing,reusing},candidate,request,retained);
}
/** Registry-owned totals use the same admission contract as the iterable path.
 * Replacement discounts one producer; resident bytes remain charged to leases. */
export function admitAccountedTextLayoutResources(read:(candidate:TextInputCost)=>TextLayoutResourceTotals&{readonly replacement:TextInputCost|undefined;readonly reusing:boolean},input:TextLayoutInput,request:TextLayoutRequest={},retained?:TextLayout):TextInputCost{
  invariant(request.transient===undefined||typeof request.transient==='boolean','invalid-text-request','Invalid transient paragraph request');
  const candidate=textInputCost(input);
  const totals=read(candidate),replacement=totals.replacement,reusing=totals.reusing;
  checkTextLayoutAdmission({...totals,producerUnits:totals.producerUnits-(replacement?.units??0),producerBytes:totals.producerBytes-(replacement?.bytes??0),replacing:replacement!==undefined,reusing},candidate,request,retained);
  return candidate;
}
function checkTextLayoutAdmission(state:TextLayoutResourceTotals&{readonly replacing:boolean;readonly reusing:boolean},candidate:TextInputCost,request:TextLayoutRequest,retained?:TextLayout):void{
  const {resident,producers,residentUnits,producerUnits,residentBytes,producerBytes,replacing,reusing}=state;
  invariant(!request.replacing||replacing,'stale-resource','Paragraph replacement must be the exact live layout owned by this service');
  invariant(!retained||reusing,'stale-resource','Cached paragraph must be the exact retained layout owned by this service');
  invariant(resident+(reusing?0:1)<=textLimits.retainedResources,'oversize','Retained paragraph resource budget exhausted');
  invariant(producers-(replacing?1:0)<textLimits.resources+(request.transient?1:0),'oversize','Live paragraph producer budget exhausted');
  invariant(residentUnits+(reusing?0:candidate.units)<=textLimits.retainedUnits&&residentBytes+(reusing?0:candidate.bytes)<=textLimits.retainedInputBytes,'oversize','Retained paragraph content budget exhausted');
  invariant(producerUnits+candidate.units<=textLimits.producerUnits+(request.transient?candidate.units:0)&&producerBytes+candidate.bytes<=textLimits.producerInputBytes+(request.transient?candidate.bytes:0),'oversize','Live paragraph content budget exhausted');
}
export function textOffset(text:string,index:number):void {
  invariant(Number.isInteger(index) && index>=0 && index<=text.length,'invalid-text-offset','offset outside UTF-16 text');
  if(index>0 && index<text.length)invariant(!(text.charCodeAt(index-1)>=0xd800 && text.charCodeAt(index-1)<=0xdbff && text.charCodeAt(index)>=0xdc00 && text.charCodeAt(index)<=0xdfff),'invalid-text-offset','offset splits surrogate pair');
}
function validText(text:string):void {
  for(let i=0;i<text.length;i++){
    const code=text.charCodeAt(i);
    if(code>=0xd800 && code<=0xdbff){const low=text.charCodeAt(++i);invariant(low>=0xdc00 && low<=0xdfff,'invalid-text','unpaired high surrogate');}
    else invariant(code<0xdc00 || code>0xdfff,'invalid-text','unpaired low surrogate');
  }
}
export function freezeTextInput(input:TextLayoutInput):TextLayoutInput {
  if(ownedInputs.has(input))return input;
  invariant(input.text.length<=textLimits.units,'oversize','paragraph text budget exceeded');validText(input.text);
  invariant(input.width===Infinity||Number.isFinite(input.width)&&input.width>=0&&input.width<=textLimits.width,'invalid-text','invalid paragraph width');
  const textScale=input.textScale??1,color=input.color??0xffeef5ff,maxLines=input.maxLines??128,ellipsis=input.ellipsis??'';
  invariant(finite(input.scale,'pixel scale')>0 && finite(textScale,'text scale')>=0,'invalid-text','Pixel scale must be positive and text scale nonnegative');
  invariant(finite(input.fontSize,'font size')>=0 && input.fontSize*textScale<=512,'invalid-text','effective font size outside budget');
  invariant(input.font.id.length>0,'invalid-text','font resource has no ID');generation(input.font.generation);
  invariant(input.locale.length<=128 && !input.locale.includes('\0'),'invalid-text','invalid locale');
  invariant(input.direction==='ltr' || input.direction==='rtl','invalid-text','invalid text direction');
  invariant(Number.isInteger(color) && color>=0 && color<=0xffffffff,'invalid-text','color outside uint32');
  invariant(Number.isInteger(maxLines) && maxLines>=1 && maxLines<=textLimits.lines,'invalid-text','invalid maximum lines');
  invariant(input.unlimitedLines===undefined||typeof input.unlimitedLines==='boolean','invalid-text','Invalid unlimited line policy');
  invariant(ellipsis.length<=32,'invalid-text','ellipsis budget exceeded');validText(ellipsis);
  invariant(input.hyphens===undefined||input.hyphens==='manual'||input.hyphens==='hidden','invalid-text','Invalid hyphen policy');
  invariant(input.textAlign===undefined||['left','right','center','justify','start','end'].includes(input.textAlign),'invalid-text','Invalid paragraph alignment');
  const runs=input.runs?.map((run,index)=>{textOffset(input.text,run.start);textOffset(input.text,run.end);invariant(run.end>run.start&&(index===0||run.start>=input.runs![index-1]!.end),'invalid-text','Text runs must be nonempty, ordered and disjoint');return Object.freeze({...run,style:freezeRunStyle(run.style)});});invariant(!runs||runs.length<=textLimits.runs,'oversize','Text run budget');
  const placeholders=input.placeholders?.map((item,index)=>{textOffset(input.text,item.offset);invariant(input.text[item.offset]==='\ufffc'&&(index===0||item.offset>input.placeholders![index-1]!.offset),'invalid-text','Placeholder offsets must be ordered object replacement characters');invariant(Number.isFinite(item.width)&&item.width>=0&&item.width<=textLimits.width&&Number.isFinite(item.height)&&item.height>=0&&item.height<=textLimits.width&&Number.isFinite(item.baselineOffset),'invalid-text','Invalid placeholder geometry');invariant(['baseline','aboveBaseline','belowBaseline','top','bottom','middle'].includes(item.alignment)&&['alphabetic','ideographic'].includes(item.baseline),'invalid-text','Invalid placeholder alignment/baseline');return Object.freeze({...item});});invariant(!placeholders||placeholders.length<=textLimits.placeholders,'oversize','Placeholder budget');
  const behavior=input.textHeightBehavior;if(behavior)invariant(typeof behavior.applyHeightToFirstAscent==='boolean'&&typeof behavior.applyHeightToLastDescent==='boolean'&&['proportional','even'].includes(behavior.leadingDistribution),'invalid-text','Invalid text height behavior');
  for(const style of [input.style,...(runs?.map(run=>run.style)??[])])if(style?.fontSize!==undefined)invariant(style.fontSize>=0&&style.fontSize*textScale<=512,'invalid-text','Effective span font size outside budget');
  const snapshot=Object.freeze({text:input.text,width:input.width,font:copyResourceId(input.font),fontSize:input.fontSize,locale:input.locale,direction:input.direction,scale:input.scale,textScale,color,maxLines,ellipsis,...(input.unlimitedLines?{unlimitedLines:true}:{}),...(input.hyphens?{hyphens:input.hyphens}:{}),...(input.textAlign!==undefined?{textAlign:input.textAlign}:{}),...(input.style?{style:freezeRunStyle(input.style)}:{}),...(runs?{runs:Object.freeze(runs)}:{}),...(placeholders?{placeholders:Object.freeze(placeholders)}:{}),...(input.strutStyle?{strutStyle:freezeStrutStyle(input.strutStyle)}:{}),...(behavior?{textHeightBehavior:Object.freeze({...behavior})}:{})});
  capturedInputs.add(snapshot);return snapshot;
}
export function freezeTextRect(rect:Rect):Rect {
  const {x,y,width,height}=rect;finite(x,'text x');finite(y,'text y');invariant(finite(width,'text rect width')>=0 && finite(height,'text rect height')>=0,'invalid-text','negative text rect');
  return Object.freeze({x,y,width,height});
}
export function textRange(layout:TextLayout,start:number,end:number):void {textOffset(layout.input.text,start);textOffset(layout.input.text,end);invariant(end>=start,'invalid-text-offset','reversed text range');}
export function freezeTextLayout(resource:ResourceId,input:TextLayoutInput,geometry:TextLayoutGeometry):TextLayout {
  generation(resource.generation);invariant(resource.id.length>0,'invalid-text','layout has no resource ID');
  const snapshot=freezeTextInput(input);
  // SkParagraph leaves SkScalarMin as longestLine for an empty paragraph.
  // The public contract defines the longest advance of empty text as zero.
  const longestLine=snapshot.text.length===0 && geometry.longestLine<=-3e38?0:geometry.longestLine;
  invariant(geometry.width===Infinity&&snapshot.width===Infinity||Number.isFinite(geometry.width)&&geometry.width>=0,'invalid-text','Invalid paragraph layout width');
  for(const key of ['height','alphabeticBaseline','ideographicBaseline','minIntrinsicWidth','maxIntrinsicWidth'] as const)invariant(finite(geometry[key],key)>=0,'invalid-text',`negative ${key}: ${geometry[key]}`);
  invariant(finite(longestLine,'longestLine')>=0,'invalid-text',`negative longestLine: ${longestLine}`);
  invariant(typeof geometry.overflow==='boolean' && Number.isInteger(geometry.unresolvedGlyphs) && geometry.unresolvedGlyphs>=-1,'invalid-text','invalid shaping result');
  invariant(geometry.lines.length<=textLimits.lines,'oversize','paragraph line budget exceeded');
  const lines=geometry.lines.map(line=>{textOffset(snapshot.text,line.start);textOffset(snapshot.text,line.end);invariant(line.end>=line.start,'invalid-text','reversed line range');finite(line.baseline,'line baseline');if(line.height!==undefined)invariant(finite(line.height,'line height')>=0,'invalid-text','Negative line height');if(line.metrics){const m=line.metrics;invariant(typeof m.hardBreak==='boolean'&&Number.isSafeInteger(m.lineNumber)&&m.lineNumber>=0&&[m.ascent,m.descent,m.unscaledAscent,m.height,m.width,m.left,m.baseline].every(Number.isFinite),'invalid-text','Malformed full line metrics');}return Object.freeze({start:line.start,end:line.end,baseline:line.baseline,bounds:freezeTextRect(line.bounds),...(line.height!==undefined?{height:line.height}:{}),...(line.metrics?{metrics:Object.freeze({...line.metrics})}:{})});});
  const placeholderBoxes=geometry.placeholderBoxes?.map(freezeTextRect);invariant(!placeholderBoxes||placeholderBoxes.length<=(snapshot.placeholders?.length??0),'invalid-text','Unexpected placeholder geometry');
  const directions=geometry.placeholderDirections;invariant(!directions||directions.length===(placeholderBoxes?.length??0)&&directions.every(d=>d==='ltr'||d==='rtl'),'invalid-text','Malformed placeholder directions');
  return Object.freeze({width:geometry.width,height:geometry.height,alphabeticBaseline:geometry.alphabeticBaseline,ideographicBaseline:geometry.ideographicBaseline,minIntrinsicWidth:geometry.minIntrinsicWidth,maxIntrinsicWidth:geometry.maxIntrinsicWidth,longestLine,overflow:geometry.overflow,unresolvedGlyphs:geometry.unresolvedGlyphs,resource:Object.freeze({...resource}),input:snapshot,lines:Object.freeze(lines),indexUnit:'utf16' as const,...(placeholderBoxes?{placeholderBoxes:Object.freeze(placeholderBoxes)}:{}),...(directions?{placeholderDirections:Object.freeze([...directions])}:{})});
}
