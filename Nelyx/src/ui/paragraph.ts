// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
import {invariant} from '../foundation/errors.ts';
import {FoundationBuildMode} from '../foundation/constants.ts';
import type {ResourceRegistry} from '../hosting/resources.ts';
import type {ResourceHold} from './resource-retention.ts';
import type {ResourceId,TextLayout,TextLayoutGeometry,TextLayoutInput,TextLayoutService,TextClusterInfo} from './types.ts';
import type {TextRun,TextRunStyle,TextPlaceholder} from './text-styles.ts';
import type {Locale} from './locale.ts';
import type {ParagraphStyle} from './paragraph-style.ts';
import type {ParagraphConstraints} from './paragraph-constraints.ts';
import {TextBox} from './text-box.ts';import type {BoxHeightStyle,BoxWidthStyle} from './text-box.ts';
import {TextPosition,TextAffinity} from './text-position.ts';import {TextRange} from './text-range.ts';
import {Rect} from './rect.ts';import type {Offset} from './offset.ts';import {GlyphInfo} from './glyph-info.ts';
import {LineMetrics} from './line-metrics.ts';import {checkedInteger} from './value-math.ts';
import {markCapturedTextRecord} from './text-input-data.ts';

/** Explicit per-application engine ownership replaces a process-global native dart:ui factory. */
export interface ParagraphContext {readonly text:TextLayoutService;readonly resources:ResourceRegistry;readonly font:ResourceId;readonly scale:number;readonly locale?:Locale|string;readonly color?:number;/** @internal Synchronous measurement admission; the caller retires it before returning. */readonly transient?:boolean}
/** @internal CPU text assembled by ParagraphBuilder before engine layout. */
export interface ParagraphTextSnapshot {readonly text:string;readonly style:TextRunStyle;readonly runs:readonly TextRun[];readonly placeholders:readonly TextPlaceholder[]}
export class Paragraph {
  private dead=false;private debugNeedsLayout=true;private current:TextLayout|undefined;private layoutAttempt=0;
  private constructor(private readonly style:ParagraphStyle,private readonly contents:ParagraphTextSnapshot,private readonly context:ParagraphContext|null,private readonly holds:ResourceHold[]){}
  /** @internal Ownership is transferred once from the builder. */
  static _fromBuilder(style:ParagraphStyle,contents:ParagraphTextSnapshot,context:ParagraphContext|null,holds:ResourceHold[]):Paragraph{return new Paragraph(style,contents,context,holds);}
  /** @internal Framework recording uses the same public builder without allocating an engine paragraph. */
  _textSnapshot():ParagraphTextSnapshot{this.live();return this.contents;}
  /** @internal Read-only engine queries share this layout; Paragraph keeps its producer ownership. */
  _layoutSnapshot():TextLayout{return this.laidOut();}
  private live():void{invariant(!this.dead,'disposed-paragraph','Cannot use a disposed Paragraph');}
  private laidOut():TextLayout{this.live();invariant(this.current&&this.context?.resources.hasInitialProducer(this.current.resource),'paragraph-not-laid-out','Paragraph requires a live completed layout');return this.current;}
  get resource():ResourceId{return this.laidOut().resource;}
  get width():number{return this.laidOut().width;}get height():number{return this.laidOut().height;}get longestLine():number{return this.laidOut().longestLine;}
  get minIntrinsicWidth():number{return this.laidOut().minIntrinsicWidth;}get maxIntrinsicWidth():number{return this.laidOut().maxIntrinsicWidth;}
  get alphabeticBaseline():number{return this.laidOut().alphabeticBaseline;}get ideographicBaseline():number{return this.laidOut().ideographicBaseline;}
  get didExceedMaxLines():boolean{return this.laidOut().overflow;}get numberOfLines():number{return this.laidOut().lines.length;}
  layout(constraints:ParagraphConstraints):void{this.layoutWithReplacement(constraints,this.current);}
  /** @internal Paint-only rebuilds replace an exact live producer transactionally.
   * The caller keeps the old Paragraph until validation and recording succeed. */
  _layoutReplacing(constraints:ParagraphConstraints,previous:Paragraph):void{
    this.live();const replacing=previous.laidOut();
    invariant(this.current===undefined&&this.context?.resources===previous.context?.resources&&this.context?.text===previous.context?.text,'foreign-paragraph-replacement','Paragraph replacement requires a fresh paragraph and the same resource/text owner');
    this.layoutWithReplacement(constraints,replacing);
  }
  private layoutInput(constraints:ParagraphConstraints):TextLayoutInput{
    this.live();const context=this.context;invariant(context,'unbound-paragraph','Supply a ParagraphContext to ParagraphBuilder before laying out an engine paragraph');
    const style=this.style,locale=style.locale??context.locale??'und';
    const input:TextLayoutInput=Object.freeze({...this.contents,font:context.font,width:constraints.width,fontSize:style.fontSize??14,scale:context.scale,locale:typeof locale==='string'?locale:locale.toString(),direction:style.textDirection??'ltr',textAlign:style.textAlign??'start',color:context.color??0xff000000,maxLines:style.maxLines??128,...(style.maxLines===null?{unlimitedLines:true}:{}),ellipsis:style.ellipsis??'',...(style.strutStyle?{strutStyle:style.strutStyle}:{}),...(style.textHeightBehavior?{textHeightBehavior:style.textHeightBehavior}:{}),...(style.hyphens?{hyphens:style.hyphens}:{})});markCapturedTextRecord(input);
    return input;
  }
  /** @internal Copy geometry from the completed producer without borrowing it. */
  _measuredGeometry():TextLayoutGeometry{return this.captureGeometry(this.laidOut());}
  private captureGeometry(layout:TextLayout):TextLayoutGeometry{
    const {resource:_resource,input:_input,indexUnit:_indexUnit,...geometry}=layout;
    return Object.freeze({...geometry,lines:Object.freeze(geometry.lines.map(line=>Object.freeze({...line,bounds:Object.freeze({...line.bounds})})))});
  }
  /** @internal A synchronous geometry probe never replaces or retains the painted producer. */
  _measure(constraints:ParagraphConstraints):TextLayoutGeometry{
    const input=this.layoutInput(constraints),context=this.context!,layout=context.text.layout(input,{transient:true});let result:TextLayoutGeometry|undefined,failed=false,failure:unknown;
    try{
      this.live();
      invariant(this.style.maxLines!==null||!!this.style.ellipsis||!layout.overflow,'paragraph-line-budget','Unbounded Paragraph exceeds the host line budget');
      result=this.captureGeometry(layout);
    }catch(error){failed=true;failure=error;}
    try{if(context.resources.hasInitialProducer(layout.resource))context.resources.releaseProducer(layout.resource);}catch(error){if(failed)throw new AggregateError([failure,error],'Paragraph measurement and retirement failed');throw error;}
    if(failed)throw failure;return result!;
  }
  private layoutWithReplacement(constraints:ParagraphConstraints,replacing:TextLayout|undefined):void{
    this.live();invariant(this.layoutAttempt<Number.MAX_SAFE_INTEGER,'paragraph-layout-exhausted','Paragraph layout attempts exhausted');const attempt=++this.layoutAttempt;
    const input=this.layoutInput(constraints),context=this.context!,style=this.style;
    invariant(!this.dead&&attempt===this.layoutAttempt,'paragraph-owner-changed','Paragraph owner changed during input capture');
    const previous=this.current,next=context.text.layout(input,{...(replacing?{replacing}:{}),...(context.transient?{transient:true}:{})});
    // Preserve native unlimited-line semantics (notably ellipsis). Host geometry
    // admission still rejects results over 128 lines; never silently clip them.
    // Reject an oversized result while retaining the previous completed layout.
    try{invariant(!this.dead&&attempt===this.layoutAttempt,'paragraph-owner-changed','Paragraph owner changed during layout');invariant(style.maxLines!==null||!!style.ellipsis||!next.overflow,'paragraph-line-budget','Unbounded Paragraph exceeds the host line budget');}
    catch(error){try{if(context.resources.hasInitialProducer(next.resource))context.resources.releaseProducer(next.resource);}catch(cleanup){throw new AggregateError([error,cleanup],'Rejected paragraph layout retirement failed');}throw error;}
    this.current=next;if(FoundationBuildMode.debug)this.debugNeedsLayout=false;
    if(previous&&context.resources.hasInitialProducer(previous.resource))context.resources.releaseProducer(previous.resource);
  }
  getBoxesForRange(start:number,end:number,{boxHeightStyle='tight',boxWidthStyle='tight'}:{readonly boxHeightStyle?:BoxHeightStyle;readonly boxWidthStyle?:BoxWidthStyle}={}):TextBox[]{const layout=this.laidOut();checkedInteger(start);checkedInteger(end);const query=this.context!.text.boxes;invariant(query,'paragraph-boxes-unavailable','Text backend must expose directional range boxes');return query.call(this.context!.text,layout,start>>>0,end>>>0,{heightStyle:boxHeightStyle,widthStyle:boxWidthStyle}).map(box=>TextBox.fromLTRBD(box.rect.x,box.rect.y,box.rect.x+box.rect.width,box.rect.y+box.rect.height,box.direction));}
  getBoxesForPlaceholders():TextBox[]{const layout=this.laidOut(),boxes=layout.placeholderBoxes??[],directions=layout.placeholderDirections;invariant(boxes.length===0||directions?.length===boxes.length,'paragraph-placeholder-directions-unavailable','Text backend must preserve placeholder writing direction');return boxes.map((box,index)=>TextBox.fromLTRBD(box.x,box.y,box.x+box.width,box.y+box.height,directions![index]!));}
  getPositionForOffset(offset:Offset):TextPosition{const layout=this.laidOut(),hit=this.context!.text.hit(layout,offset.dx,offset.dy);return new TextPosition({offset:hit.position,affinity:hit.affinity});}
  private glyph(value:TextClusterInfo|null):GlyphInfo|null{return value===null?null:new GlyphInfo(Rect.fromLTWH(value.bounds.x,value.bounds.y,value.bounds.width,value.bounds.height),new TextRange({start:value.start,end:value.end}),value.direction);}
  getGlyphInfoAt(codeUnitOffset:number):GlyphInfo|null{const layout=this.laidOut(),offset=checkedInteger(codeUnitOffset)>>>0;if(offset>=layout.input.text.length)return null;const query=this.context!.text.glyphAt;invariant(query,'paragraph-glyph-unavailable','Text backend must expose glyph boundaries');return this.glyph(query.call(this.context!.text,layout,offset));}
  getClosestGlyphInfoForOffset(offset:Offset):GlyphInfo|null{const layout=this.laidOut(),query=this.context!.text.closestGlyph;invariant(query,'paragraph-glyph-unavailable','Text backend must expose closest glyph information');return this.glyph(query.call(this.context!.text,layout,offset.dx,offset.dy));}
  getWordBoundary(position:TextPosition):TextRange{const layout=this.laidOut(),query=this.context!.text.wordBoundary;invariant(query,'paragraph-word-boundary-unavailable','Text backend must expose word boundaries');const offset=checkedInteger(position.offset)-(position.affinity===TextAffinity.upstream?1:0);return new TextRange(query.call(this.context!.text,layout,offset>>>0));}
  getLineBoundary(position:TextPosition):TextRange{
    const lines=this.laidOut().lines,offset=checkedInteger(position.offset),find=(value:number)=>{const line=lines.find(line=>value>=line.start&&value<=line.end);return line?new TextRange({start:line.start,end:line.end}):TextRange.empty;};
    const line=find(offset>>>0),next=find((offset+1)>>>0);return next.isValid&&position.affinity===TextAffinity.downstream&&!line.equals(next)&&offset===line.end&&line.end===next.start?next:line;
  }
  computeLineMetrics():LineMetrics[]{return this.laidOut().lines.map(line=>{invariant(line.metrics,'paragraph-line-metrics-unavailable','Backend does not expose complete line metrics, including unscaledAscent');return new LineMetrics(line.metrics);});}
  getLineMetricsAt(lineNumber:number):LineMetrics|null{const line=this.laidOut().lines[checkedInteger(lineNumber)>>>0];if(!line)return null;invariant(line.metrics,'paragraph-line-metrics-unavailable','Backend does not expose complete line metrics, including unscaledAscent');return new LineMetrics(line.metrics);}
  getLineNumberAt(codeUnitOffset:number):number|null{const layout=this.laidOut(),offset=checkedInteger(codeUnitOffset)>>>0,query=this.context!.text.lineNumberAt;invariant(query,'paragraph-line-number-unavailable','Text backend must expose visible-line lookup');return query.call(this.context!.text,layout,offset);}
  dispose():void{this.live();this.dead=true;const previous=this.current;this.current=undefined;const errors:unknown[]=[];try{if(previous&&this.context!.resources.hasInitialProducer(previous.resource))this.context!.resources.releaseProducer(previous.resource);}catch(error){errors.push(error);}for(const hold of this.holds.splice(0))try{hold.dispose();}catch(error){errors.push(error);}if(errors.length===1)throw errors[0];if(errors.length)throw new AggregateError(errors,'Paragraph resource retirement failed');}
  get debugDisposed():boolean{invariant(FoundationBuildMode.debug,'debug-only','Paragraph.debugDisposed is only available when asserts are enabled');return this.dead;}
  toString():string{if(FoundationBuildMode.debug&&this.dead)return this.debugNeedsLayout?'Paragraph(DISPOSED while dirty)':'Paragraph(DISPOSED)';return this.debugNeedsLayout?'Paragraph(dirty)':'Paragraph()';}
}
