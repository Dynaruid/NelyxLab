import type {SkCanvas} from "./skia/types/Drawing.ts";
import type {SkImage,SkPaint} from './skia/types/Drawing.ts';
import type {SkHostRect} from './skia/types/Rect.ts';
import type {Skia} from './skia/types/Skia.ts';
import type {SkParagraph} from './skia/types/Paragraph/Paragraph.ts';
import { TextDirection } from './skia/types/Paragraph/ParagraphStyle.ts';
import type {SkTypeface} from './skia/types/Typeface/Typeface.ts';
import type {SkTypefaceFontProvider} from './skia/types/Paragraph/TypefaceFontProvider.ts';
import { invariant } from '@nelyx/core/foundation/errors';
import { freezeTextInput, freezeTextLayout, freezeTextRect, textLimits, textRange } from '@nelyx/core/ui/text';
import { resourceKey } from '@nelyx/core/ui/frame';
import { utf8ToUtf16 } from '@nelyx/core/ui/editing';
import type { ResourceId, TextGlyphRun, TextHit, TextLayout, TextLayoutInput, TextLayoutService, ViewOwner,TextGlyphInfo,TextRangeBounds,TextLayoutRequest,TextBoxQuery,TextBoxGeometry,TextLayoutQueryReference } from '@nelyx/core/ui/types';
import type { ResourceRegistry } from '@nelyx/core/hosting/resources';
import {ParagraphFontCatalog,ParagraphFontProviders} from '@nelyx/core/hosting/text-fonts';
import type {ParagraphFont} from '@nelyx/core/hosting/text-fonts';
import {TextLayoutCache} from '@nelyx/core/hosting/text-layout-cache';
import {TextLayoutBudget} from '@nelyx/core/hosting/text-layout-budget';
import {TextPaintResources} from '@nelyx/core/hosting/text-paints';
import type {PaintSnapshot} from '@nelyx/core/ui/paint';
import type {TextRunStyle} from '@nelyx/core/ui/text-styles';
import {configurePaint} from './paint.ts';
import {applyPaintEffects,createRuntimeShaderCache} from './paint-effects.ts';
import type {FontProviderLease} from '@nelyx/core/hosting/text-fonts';
import {buildStyledText} from '@nelyx/core/ui/text-builder';
import {nativeTextStyle,nativeParagraphStyle} from './text-style.ts';
export interface NelyxTypeface extends SkTypeface {nelyxIdentity():number;nelyxFamily():string}
interface NativeParagraph extends SkParagraph {nelyxBindCoreQuery(owner:string,ownerGeneration:number,resource:string,resourceGeneration:number,text:string,units:number):number;nelyxTextMetrics():number[];nelyxTextHit(x:number,y:number):number[];nelyxTextGlyphAt(offset:number):number[];nelyxTextWordBoundary(offset:number):number[];nelyxTextLineNumberAt(offset:number):number;nelyxTextBoxes(start:number,end:number,heightStyle:number,widthStyle:number):number[];nelyxGlyphVisit:SkParagraph['extendedVisit']}
export interface ParagraphPaint {readonly nativeParagraph?:SkParagraph;paint(canvas:SkCanvas,x:number,y:number):void}
export interface NativeFont extends ParagraphFont {readonly sourceBytes:number;readonly provider:SkTypefaceFontProvider;readonly bundledTypefaceId:number;readonly typeface?:NelyxTypeface}
interface Entry {paintFacade?:ParagraphPaint;nativeQueryReference?:TextLayoutQueryReference;readonly layout:TextLayout;readonly paragraph:NativeParagraph;readonly bundledTypefaceIds:ReadonlySet<number>;readonly fonts:FontProviderLease<NativeFont,SkTypefaceFontProvider>;readonly paintResources:TextPaintResources}
/** Paragraphs are private: callers receive frozen IDs/geometry and a paint-only facade. */
export class NativeTextLayoutService implements TextLayoutService {
  private readonly layoutCache:TextLayoutCache<NativeFont>;private readonly textBudget:TextLayoutBudget;private readonly fontCatalog:ParagraphFontCatalog<NativeFont>;
  private entries=new Map<string,Entry>();
  private sequence=0;
  private fonts:ReadonlyMap<string,NativeFont>;
  private readonly providers:ParagraphFontProviders<NativeFont,SkTypefaceFontProvider>;private failed=false;private readonly uncertain:unknown[]=[];
  get debugStats(){const entries=[...this.entries.values()],producers=entries.reduce((sum,entry)=>sum+this.registry.initialProducerCount(entry.layout.resource),0);return Object.freeze({cache:this.layoutCache.debugStats,paragraphs:this.entries.size,producers,retainedOnly:entries.filter(entry=>!this.registry.hasInitialProducer(entry.layout.resource)).length,fontProviders:this.providers.debugProviderCount,fontProviderSourceBytes:this.providers.debugSourceBytes,failed:this.failed});}
  constructor(private api:Skia,private registry:ResourceRegistry,private owner:ViewOwner,font:NativeFont|ReadonlyMap<string,NativeFont>,private readonly image:(key:string)=>SkImage=()=>{throw new Error('Native paragraph image resolver is unavailable');},private readonly runtimePrograms?:ReturnType<typeof createRuntimeShaderCache>){this.fontCatalog=new ParagraphFontCatalog(registry);this.layoutCache=new TextLayoutCache(registry,this.fontCatalog);this.textBudget=new TextLayoutBudget(registry);this.fonts='resource' in font?new Map([[resourceKey(font.resource),font]]):font;this.providers=new ParagraphFontProviders(registry,this.fontCatalog,fonts=>{if(fonts.length===1&&!fonts[0]!.source.typeface)return {provider:fonts[0]!.source.provider,retire(){}};const provider=this.api.TypefaceFontProvider.Make();try{for(const font of fonts){invariant(font.source.typeface,'missing-native-typeface','Multifont layout requires retained app typefaces');provider.registerFont(font.source.typeface,font.family);}return {provider,retire:()=>provider.dispose()};}catch(error){provider.dispose();throw error;}});}
  fontFamily(resource:ResourceId):string{invariant(!this.failed,'text-retirement-failed','Paragraph native retirement failed');const font=this.fonts.get(resourceKey(resource));invariant(font&&this.registry.has(resource),'stale-resource','Unknown font');return font.family;}
  layout(input:TextLayoutInput,request?:TextLayoutRequest):TextLayout {
    invariant(!this.failed,'text-retirement-failed','Paragraph native retirement failed');const snapshot=freezeTextInput(input),font=this.fonts.get(resourceKey(snapshot.font));invariant(font && this.registry.has(snapshot.font),'stale-resource','unknown font');
    const catalog=this.fontCatalog.capture(this.fonts.values()),cacheKey=this.layoutCache.key(snapshot,catalog),cached=this.layoutCache.reuse(cacheKey,retained=>this.textBudget.admit(snapshot,request,retained,this.layoutCache));if(cached)return cached;
    const primaryFamily=catalog.fonts.find(value=>value.source===font)?.family;invariant(primaryFamily!==undefined,'stale-font','Primary paragraph font is not in the captured catalog');
    invariant(this.api.ParagraphBuilder.nelyxTextStyleVersion?.()===1,'native-text-cohort','Matching native font-variation binding required');
    invariant(this.api.ParagraphBuilder.nelyxTextBoundaryVersion?.()===2,'native-text-boundary-cohort','Matching native UTF16 glyph/Uint32 word boundary binding version 2 required');
    invariant(this.api.ParagraphBuilder.nelyxParagraphApiVersion?.()===2,'native-paragraph-cohort','Matching paragraph API2 binding required for positive-infinite widths and source paragraph policies');
    const fonts=this.providers.acquire(snapshot.font,catalog);let admitted=false,paintResources:TextPaintResources|undefined;
    const temporary:unknown[]=[],uncertainTemporary:unknown[]=[],own=<T>(value:T):T=>{temporary.push(value);return value;};
    const releaseTemporary=()=>{const errors:unknown[]=[];for(const value of temporary.splice(0).reverse())try{if(value&&typeof (value as {dispose?:unknown}).dispose==='function')(value as {dispose():void}).dispose();}catch(error){uncertainTemporary.push(value);errors.push(error);}if(errors.length)throw new AggregateError(errors,'Native text paint wrapper retirement failed');};
    let builder:ReturnType<Skia['ParagraphBuilder']['Make']>|undefined;
    let paragraph:NativeParagraph|undefined;
    try {
      paintResources=new TextPaintResources(this.registry,snapshot);
      builder=this.api.ParagraphBuilder.Make(nativeParagraphStyle(this.api,snapshot,primaryFamily,fonts.families),fonts.provider);
      const paint=(value:PaintSnapshot):SkPaint=>{const result=own(this.api.Paint());configurePaint(this.api,result,value);applyPaintEffects(this.api,result,value,own,this.image,this.runtimePrograms);return result;};
      const push=(style:TextRunStyle)=>{const native=nativeTextStyle(this.api,snapshot,style,primaryFamily,fonts.families);builder!.pushStyle(native,style.foreground?paint(style.foreground):undefined,style.background?paint(style.background):undefined);};
      buildStyledText(snapshot,{push,pop:()=>builder!.pop(),addText:text=>builder!.addText(text),addPlaceholder:p=>builder!.addPlaceholder(p.width,p.height,['baseline','aboveBaseline','belowBaseline','top','bottom','middle'].indexOf(p.alignment),p.baseline==='ideographic'?1:0,p.baselineOffset)});
      paragraph=builder.build() as NativeParagraph;builder.dispose();builder=undefined;releaseTemporary();
      invariant(typeof paragraph.nelyxTextMetrics==='function','native-patch','Nelyx paragraph geometry patch is required');
      paragraph.layout(snapshot.width);
      const native=paragraph.nelyxTextMetrics(),lines=paragraph.getLineMetrics();
      const resource=this.registry.allocateId(`${this.owner.id}:${this.owner.generation}:paragraph`),boxes=paragraph.getRectsForPlaceholders();let placeholderBoxes:ReturnType<typeof freezeTextRect>[],placeholderDirections:('ltr'|'rtl')[];try{placeholderBoxes=boxes.map(box=>freezeTextRect(box.rect));placeholderDirections=boxes.map(box=>box.direction===TextDirection.RTL?'rtl':'ltr');}finally{boxes.forEach(box=>(box.rect as SkHostRect).dispose());}
      const layout=freezeTextLayout(resource,snapshot,{width:paragraph.getMaxWidth(),height:paragraph.getHeight(),alphabeticBaseline:native[0]!,ideographicBaseline:native[1]!,minIntrinsicWidth:native[2]!,maxIntrinsicWidth:native[3]!,longestLine:native[4]!,overflow:native[5]===1,unresolvedGlyphs:native[6]!,lines:lines.map(line=>({start:line.startIndex,end:line.endIndex,baseline:line.baseline,height:line.height,bounds:{x:line.left,y:line.baseline-line.ascent,width:line.width,height:line.ascent+line.descent},...(line.unscaledAscent!==undefined?{metrics:{hardBreak:line.isHardBreak,ascent:line.ascent,descent:line.descent,unscaledAscent:line.unscaledAscent,height:line.height,width:line.width,left:line.left,baseline:line.baseline,lineNumber:line.lineNumber}}:{})})),placeholderBoxes,placeholderDirections});
      const entry={layout,paragraph,bundledTypefaceIds:new Set(fonts.fonts.map(font=>font.source.bundledTypefaceId)),fonts,paintResources};
      const registration=this.textBudget.registration(layout,snapshot);
      this.registry.register({...resource,kind:'paragraph'},()=>{try{entry.paragraph.dispose();}catch(error){this.failed=true;this.uncertain.push(entry);throw error;}this.layoutCache.forget(cacheKey,layout);this.entries.delete(resourceKey(resource));const errors:unknown[]=[];for(const cleanup of [()=>entry.paintResources.dispose(),()=>entry.fonts.release()])try{cleanup();}catch(error){this.failed=true;errors.push(error);}if(errors.length)throw new AggregateError(errors,'Native paragraph dependency retirement failed');},registration);admitted=true;this.entries.set(resourceKey(resource),entry);try{this.registry.bindResource(layout.resource);this.layoutCache.remember(cacheKey,layout,registration.cost,request?.transient!==true);}catch(error){this.registry.releaseProducer(resource);throw error;}return layout;
    }catch(error){if(admitted)throw error;const errors=[error];let retired=uncertainTemporary.length===0;for(const cleanup of [()=>paragraph?.dispose(),()=>builder?.dispose(),releaseTemporary])try{cleanup();}catch(failure){retired=false;errors.push(failure);}if(retired){for(const cleanup of [()=>paintResources?.dispose(),()=>fonts.release()])try{cleanup();}catch(failure){this.failed=true;errors.push(failure);}}else{this.failed=true;this.uncertain.push({paragraph,builder,fonts,paintResources,uncertainTemporary});}if(errors.length===1)throw error;throw new AggregateError(errors,'Native paragraph construction/retirement failed');}
  }
  private current(layout:TextLayout):Entry {const entry=this.entries.get(resourceKey(layout.resource));invariant(entry?.layout===layout && this.registry.hasInitialProducer(layout.resource),'stale-resource','foreign or released text layout');return entry;}
  nativeQueryReference(layout:TextLayout):TextLayoutQueryReference {
    const entry=this.current(layout);if(entry.nativeQueryReference)return entry.nativeQueryReference;
    invariant(typeof entry.paragraph.nelyxBindCoreQuery==='function','native-paragraph-query-cohort','Matching native Core paragraph query binding required');
    const token=entry.paragraph.nelyxBindCoreQuery(this.owner.id,this.owner.generation,layout.resource.id,layout.resource.generation,layout.input.text,layout.input.text.length);
    invariant(Number.isSafeInteger(token)&&token>0,'invalid-native-paragraph-query','Invalid native Core paragraph query ticket');
    return entry.nativeQueryReference=Object.freeze({protocol:'native-paragraph-v1',token});
  }
  lineNumberAt(layout:TextLayout,offset:number):number|null{const paragraph=this.current(layout).paragraph;invariant(this.api.ParagraphBuilder.nelyxParagraphApiVersion?.()===2&&typeof paragraph.nelyxTextLineNumberAt==='function','native-paragraph-cohort','Matching paragraph API2 binding required for visible-line lookup');invariant(Number.isInteger(offset)&&offset>=0&&offset<=0xffffffff,'invalid-line-offset','Line offset outside Uint32 ABI');const result=paragraph.nelyxTextLineNumberAt(offset);invariant(Number.isInteger(result)&&result>=-1&&result<layout.lines.length,'invalid-line-number','Malformed native line number');return result<0?null:result;}
  range(layout:TextLayout,start:number,end:number){const entry=this.current(layout);textRange(layout,start,end);const native=entry.paragraph.getRectsForRange(start,end);try{return Object.freeze(native.map(freezeTextRect));}finally{native.forEach(rect=>(rect as SkHostRect).dispose());}}
  boxes(layout:TextLayout,start:number,end:number,{heightStyle='tight',widthStyle='tight'}:TextBoxQuery={}):readonly TextBoxGeometry[]{
    const paragraph=this.current(layout).paragraph;invariant(Number.isInteger(start)&&Number.isInteger(end)&&start>=0&&end>=0&&start<=0xffffffff&&end<=0xffffffff,'invalid-text-box-range','Text box range is outside Uint32 ABI');
    const height=['tight','max','includeLineSpacingMiddle','includeLineSpacingTop','includeLineSpacingBottom','strut'].indexOf(heightStyle),width=['tight','max'].indexOf(widthStyle);invariant(height>=0&&width>=0,'invalid-text-box-query','Unknown text box height/width style');
    invariant(this.api.ParagraphBuilder.nelyxTextBoxVersion?.()===1&&typeof paragraph.nelyxTextBoxes==='function','native-text-box-cohort','Matching native directional text box binding required');
    const values=paragraph.nelyxTextBoxes(start,end,height,width);invariant(values.length%5===0&&values.length<=textLimits.geometryBytes/8,'invalid-native-text','Invalid native text box packet');const boxes:TextBoxGeometry[]=[];
    for(let index=0;index<values.length;index+=5){const [left,top,right,bottom,direction]=values.slice(index,index+5);invariant(direction===0||direction===1,'invalid-native-text','Invalid native text box direction');boxes.push(Object.freeze({rect:freezeTextRect({x:left!,y:top!,width:right!-left!,height:bottom!-top!}),direction:direction===1?'ltr':'rtl'}));}
    return Object.freeze(boxes);
  }
  hit(layout:TextLayout,x:number,y:number):TextHit {
    const entry=this.current(layout);invariant(Number.isFinite(x) && Number.isFinite(y),'invalid-text','nonfinite text hit');const data=entry.paragraph.nelyxTextHit(x,y);
    return Object.freeze({position:data[0]!,affinity:data[1]===0?'upstream':'downstream',...(data[2]===1?{start:data[3]!,end:data[4]!,direction:data[5]===1?'ltr' as const:'rtl' as const,bounds:freezeTextRect({x:data[6]!,y:data[7]!,width:data[8]!,height:data[9]!})}:{})});
  }
  closestGlyph(layout:TextLayout,x:number,y:number){const hit=this.hit(layout,x,y);if(hit.start===undefined||hit.end===undefined||hit.direction===undefined||hit.bounds===undefined)return null;textRange(layout,hit.start,hit.end);return Object.freeze({start:hit.start,end:hit.end,direction:hit.direction,bounds:hit.bounds});}
  paintResource(key:string):ParagraphPaint {
    const entry=this.entries.get(key);invariant(entry,'stale-resource','paragraph paint resource was retired');
    return entry.paintFacade??=Object.freeze({nativeParagraph:entry.paragraph,paint:(canvas:SkCanvas,x:number,y:number)=>{invariant(this.entries.get(key)===entry,'stale-resource','paragraph paint resource was retired');entry.paragraph.paint(canvas,x,y);}});
  }
  glyphAt(layout:TextLayout,offset:number):TextGlyphInfo|null {
    const paragraph=this.current(layout).paragraph;invariant(Number.isInteger(offset)&&offset>=0&&offset<=layout.input.text.length,'invalid-text-offset','Glyph offset outside UTF16 body');invariant(typeof paragraph.nelyxTextGlyphAt==='function','native-text-boundary-cohort','Matching native paragraph glyph boundary binding required');const values=paragraph.nelyxTextGlyphAt(offset);if(!values.length)return null;invariant(values.length===8,'invalid-native-text','Invalid glyph boundary packet');textRange(layout,values[0]!,values[1]!);invariant(values[2]===0||values[2]===1,'invalid-native-text','Invalid glyph direction');invariant(values[7]===0||values[7]===1,'invalid-native-text','Invalid ellipsis flag');return Object.freeze({start:values[0]!,end:values[1]!,direction:values[2]===1?'ltr':'rtl',bounds:freezeTextRect({x:values[3]!,y:values[4]!,width:values[5]!,height:values[6]!}),isEllipsis:values[7]===1});
  }
  wordBoundary(layout:TextLayout,offset:number):TextRangeBounds {
    const paragraph=this.current(layout).paragraph;invariant(Number.isInteger(offset)&&offset>=0&&offset<=0xffffffff,'invalid-text-offset','Word offset outside Uint32 ABI');invariant(typeof paragraph.nelyxTextWordBoundary==='function','native-text-boundary-cohort','Matching native paragraph word boundary binding required');const values=paragraph.nelyxTextWordBoundary(offset);invariant(values.length===2,'invalid-native-text','Invalid word boundary packet');textRange(layout,values[0]!,values[1]!);return Object.freeze({start:values[0]!,end:values[1]!});
  }
  glyphRuns(layout:TextLayout):readonly TextGlyphRun[] {
    const entry=this.current(layout),runs:TextGlyphRun[]=[];
    entry.paragraph.nelyxGlyphVisit((line,info)=>{
      if(!info)return;let face:NelyxTypeface|null=null;
      try {
        face=info.font.getTypeface() as NelyxTypeface|null;invariant(face && typeof face.nelyxIdentity==='function','native-patch','Nelyx typeface identity patch is required');
        const typefaceId=face.nelyxIdentity();runs.push(Object.freeze({line,glyphs:Object.freeze([...info.glyphs]),utf8Starts:Object.freeze([...info.utf8Starts]),utf16Starts:Object.freeze(info.utf8Starts.map(index=>utf8ToUtf16(layout.input.text,index))),inkBounds:Object.freeze(info.bounds.map((rect,i)=>freezeTextRect({x:rect.x+info.origin.x+info.positions[i]!.x,y:rect.y+info.origin.y+info.positions[i]!.y,width:rect.width,height:rect.height}))),fontFamily:face.nelyxFamily(),typefaceId,fontSource:entry.bundledTypefaceIds.has(typefaceId)?'bundled':'unknown'}));
      }finally{face?.dispose();info.font.dispose();info.bounds.forEach(rect=>(rect as SkHostRect).dispose());}
    });
    return Object.freeze(runs);
  }
}
