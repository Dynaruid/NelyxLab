// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {serializeTextInput} from '../../ui/text.ts';
import type {TextLayout,TextLayoutGeometry,TextLayoutInput,TextLayoutService,TextGlyphInfo,TextClusterInfo,TextLayoutQueryReference} from '../../ui/types.ts';
import type {ResourceRegistry} from '../../hosting/resources.ts';
import type {Offset} from '../../ui/geometry.ts';
import {Offset as OffsetValue} from '../../ui/offset.ts';
import {TextPosition,TextAffinity} from '../../ui/text-position.ts';
import {TextRange} from '../../ui/text-range.ts';
import {TextBox} from '../../ui/text-box.ts';
import type {BoxHeightStyle,BoxWidthStyle} from '../../ui/text-box.ts';
import {TextSelection as SourceTextSelection} from '../../services/text-editing.ts';
import type {Rect,TextSelection} from '../../ui/types.ts';
import {invariant} from '../../foundation/errors.ts';
import {textOffset,textRange,textLimits} from '../../ui/text.ts';
import {textPaintResources} from '../../ui/text-builder.ts';
import {FoundationBuildMode} from '../../foundation/constants.ts';
import {WordBoundary} from './word-boundary.ts';
import {ParagraphBuilder} from '../../ui/paragraph-builder.ts';
import type {Paragraph,ParagraphContext} from '../../ui/paragraph.ts';
import {ParagraphConstraints} from '../../ui/paragraph-constraints.ts';
import type {ParagraphStyle} from '../../ui/paragraph-style.ts';
import {TextStyle} from './text-style.ts';import {TextScaler} from './text-scaler.ts';
import type {InlineSpan} from './inline-span.ts';import {PlaceholderSpan} from './placeholder-span.ts';import type {PlaceholderDimensions} from './placeholder-dimensions.ts';
import type {StrutStyle} from './strut-style.ts';import type {Locale} from '../../ui/locale.ts';
import type {TextAlign,TextBaseline,Hyphens,TextHeightBehavior} from '../../ui/typography.ts';
import {RenderComparison} from './basic-types.ts';import {valueEquals,listEquals} from './value-equality.ts';
import {Size} from '../../ui/size.ts';import {Rect as RectValue} from '../../ui/rect.ts';import {GlyphInfo} from '../../ui/glyph-info.ts';import {LineMetrics} from '../../ui/line-metrics.ts';import type {Canvas} from '../../ui/canvas.ts';
import {Paint} from '../../ui/paint.ts';import {copyResourceId} from '../../ui/resource-retention.ts';
export const TextOverflow=Object.freeze({clip:'clip',fade:'fade',ellipsis:'ellipsis',visible:'visible'} as const);
export type TextOverflow=typeof TextOverflow[keyof typeof TextOverflow];
export const TextWidthBasis=Object.freeze({parent:'parent',longestLine:'longestLine'} as const);
export type TextWidthBasis=typeof TextWidthBasis[keyof typeof TextWidthBasis];
export interface TextPainterOptions {
  readonly text?:InlineSpan|null;readonly textAlign?:TextAlign;readonly textDirection?:'ltr'|'rtl'|null;
  readonly textScaleFactor?:number;readonly textScaler?:TextScaler;readonly maxLines?:number|null;readonly ellipsis?:string|null;
  readonly locale?:Locale|null;readonly strutStyle?:StrutStyle|null;readonly textWidthBasis?:TextWidthBasis;readonly textHeightBehavior?:TextHeightBehavior|null;readonly hyphens?:Hyphens;
}
export interface TextPainterLayoutOptions {readonly minWidth?:number;readonly maxWidth?:number}
export interface TextPainterWidthOptions extends TextPainterOptions,TextPainterLayoutOptions {readonly text:InlineSpan;readonly textDirection:'ltr'|'rtl'}
class TextPainterLayoutCache {
  private boxes:TextBox[]|undefined;private metrics:LineMetrics[]|undefined;private shiftedMetrics:LineMetrics[]|undefined;private shiftedAt:number|undefined;
  constructor(public paragraph:Paragraph,readonly textAlignment:number,readonly layoutMaxWidth:number,public contentWidth:number){}
  get paintOffset():number{return this.textAlignment===0?0:!Number.isFinite(this.paragraph.width)?Infinity:this.textAlignment*(this.contentWidth-this.paragraph.width);}
  contentWidthFor(min:number,max:number,basis:TextWidthBasis):number{return Math.min(max,Math.max(min,basis===TextWidthBasis.longestLine?this.paragraph.longestLine:this.paragraph.maxIntrinsicWidth));}
  resizeToFit(min:number,max:number,basis:TextWidthBasis):boolean{
    if(max===this.contentWidth&&min===this.contentWidth){this.contentWidth=this.contentWidthFor(min,max,basis);return true;}
    if(!Number.isFinite(this.paintOffset)&&!Number.isFinite(this.paragraph.width)&&Number.isFinite(min))return false;
    const intrinsic=this.paragraph.maxIntrinsicWidth;
    if(max===this.layoutMaxWidth||this.paragraph.width-intrinsic>-1e-10&&max-intrinsic>-1e-10){this.contentWidth=this.contentWidthFor(min,max,basis);return true;}
    return false;
  }
  get inlinePlaceholderBoxes():TextBox[]{return this.boxes??=this.paragraph.getBoxesForPlaceholders();}
  get lineMetrics():LineMetrics[]{const x=this.paintOffset;if(this.shiftedMetrics&&x===this.shiftedAt)return this.shiftedMetrics;this.shiftedAt=x;return this.shiftedMetrics=!Number.isFinite(x)?[]:x===0?(this.metrics??=this.paragraph.computeLineMetrics()):(this.metrics??=this.paragraph.computeLineMetrics()).map(line=>new LineMetrics({...line,left:line.left+x}));}
}
/** One measured paragraph per painter, bounded by live RenderParagraphs. Frame leases outlive eviction. */
export class TextPainter {
  private current:TextLayout|undefined;
  private key='';
  private paintOffsetX=0;private contentWidth:number|undefined;
  private template:{readonly key:string;readonly height:number;readonly baseline:number;readonly strutHeight:number}|undefined;
  private caret:{readonly key:string;readonly offset:OffsetValue;readonly direction:'ltr'|'rtl';readonly height:number}|undefined;
  private readonly measurements=new Map<string,TextLayoutGeometry>();
  private context:ParagraphContext|null;private readonly legacy:boolean;
  private readonly service:TextLayoutService|undefined;private readonly registry:ResourceRegistry|undefined;
  private dead=false;private needsRelayout=true;private rebuildParagraphForPaint=true;private cache:TextPainterLayoutCache|undefined;
  private _text:InlineSpan|null=null;private cachedPlainText:string|undefined;private _textAlign:TextAlign='start';private _textDirection:'ltr'|'rtl'|null=null;
  private _textScaler:TextScaler=TextScaler.noScaling;private _maxLines:number|null=null;private _ellipsis:string|null=null;private _locale:Locale|null=null;
  private _strutStyle:StrutStyle|null=null;private _textWidthBasis:TextWidthBasis=TextWidthBasis.parent;private _textHeightBehavior:TextHeightBehavior|null=null;private _hyphens:Hyphens='manual';private placeholderDimensions:readonly PlaceholderDimensions[]|null=null;
  debugPaintTextLayoutBoxes=false;
  constructor(options?:TextPainterOptions,context?:ParagraphContext|null);
  /** @internal Transport adapter retained while renderers migrate to source InlineSpan configuration. */
  constructor(service:TextLayoutService,resources:ResourceRegistry);
  constructor(options:TextPainterOptions|TextLayoutService={},owner:ParagraphContext|ResourceRegistry|null=null){
    this.legacy='layout' in options;
    if(this.legacy){this.context=null;this.service=options as TextLayoutService;this.registry=owner as ResourceRegistry;return;}
    const context=owner as ParagraphContext|null;this.context=context?Object.freeze({...context,font:copyResourceId(context.font)}):null;this.service=this.context?.text;this.registry=this.context?.resources;
    const o=options as TextPainterOptions,scale=o.textScaleFactor??1;
    if(FoundationBuildMode.debug){invariant(o.text==null||o.text.debugAssertIsValid(),'invalid-inline-span','Invalid TextPainter text');invariant(o.maxLines==null||o.maxLines>0,'invalid-max-lines','maxLines must be positive');invariant(scale===1||o.textScaler===undefined,'conflicting-text-scale','Use textScaler instead of textScaleFactor');}
    this._text=o.text??null;this._textAlign=o.textAlign??'start';this._textDirection=o.textDirection??null;this._textScaler=o.textScaler??TextScaler.linear(scale);this._maxLines=o.maxLines??null;this._ellipsis=o.ellipsis??null;this._locale=o.locale??null;this._strutStyle=o.strutStyle??null;this._textWidthBasis=o.textWidthBasis??TextWidthBasis.parent;this._textHeightBehavior=o.textHeightBehavior??null;this._hyphens=o.hyphens??'manual';
  }
  private get textService():TextLayoutService{invariant(this.service,'unbound-text-painter','Supply an application ParagraphContext to TextPainter before engine queries');return this.service;}
  private get resources():ResourceRegistry{invariant(this.registry,'unbound-text-painter','Supply an application ParagraphContext to TextPainter before engine queries');return this.registry;}
  /** @internal Renderer transition helpers; these never transfer paragraph producer ownership. */
  get _usesInlineSpan():boolean{return !this.legacy;}
  get _paragraphContext():ParagraphContext{invariant(this.context,'unbound-text-painter','TextPainter has no paragraph context');return this.context;}
  _layoutSnapshot():TextLayout{return this.laidOut();}
  get _paintOffset():number{this.laidOut();return this.paintOffsetX;}
  _updateContext(value:ParagraphContext):void{
    this.live();const previous=this._paragraphContext;invariant(value.text===previous.text&&value.resources===previous.resources,'foreign-text-painter-owner','A painter cannot move between application text owners');invariant(value.resources.has(value.font),'stale-resource','Paragraph font is foreign or retired');
    if(value.font.id===previous.font.id&&value.font.generation===previous.font.generation&&value.scale===previous.scale&&String(value.locale)===String(previous.locale)&&value.color===previous.color&&value.transient===previous.transient)return;
    const errors:unknown[]=[];try{this.clearTemplate();}catch(error){errors.push(error);}try{this.markNeedsLayout();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'TextPainter context retirement failed');this.context=Object.freeze({...value,font:copyResourceId(value.font)});
  }
  private live():void{invariant(!this.dead,'disposed-text-painter','Cannot use a disposed TextPainter');}
  static computeWidth(options:TextPainterWidthOptions,context?:ParagraphContext|null):number{return TextPainter.compute(options,context,false);}
  static computeMaxIntrinsicWidth(options:TextPainterWidthOptions,context?:ParagraphContext|null):number{return TextPainter.compute(options,context,true);}
  private static compute(options:TextPainterWidthOptions,context:ParagraphContext|null|undefined,intrinsic:boolean):number{
    const scaler=options.textScaler??TextScaler.noScaling,scale=options.textScaleFactor??1;
    if(FoundationBuildMode.debug)invariant(scale===1||scaler===TextScaler.noScaling,'conflicting-text-scale','Use textScaler instead of textScaleFactor');
    const painter=new TextPainter({...options,textScaleFactor:1,textScaler:scaler===TextScaler.noScaling?TextScaler.linear(scale):scaler},context);
    try{painter.layout({minWidth:options.minWidth??0,maxWidth:options.maxWidth??Infinity});return intrinsic?painter.maxIntrinsicWidth:painter.width;}finally{painter.dispose();}
  }
  get text():InlineSpan|null{return this._text;}
  set text(value:InlineSpan|null){this.live();if(FoundationBuildMode.debug)invariant(value===null||value.debugAssertIsValid(),'invalid-inline-span','Invalid TextPainter text');if(valueEquals(this._text,value))return;if(!valueEquals(this._text?.style,value?.style))this.clearTemplate();const comparison=value===null?RenderComparison.layout:this._text?.compareTo(value)??RenderComparison.layout;this._text=value;this.cachedPlainText=undefined;if(comparison.index>=RenderComparison.layout.index)this.markNeedsLayout();else if(comparison.index>=RenderComparison.paint.index)this.rebuildParagraphForPaint=true;}
  get plainText():string{return this.cachedPlainText??=this._text?.toPlainText({includeSemanticsLabels:false})??'';}
  get textAlign():TextAlign{return this._textAlign;}set textAlign(value:TextAlign){if(value===this._textAlign)return;this._textAlign=value;this.markNeedsLayout();}
  get textDirection():'ltr'|'rtl'|null{return this._textDirection;}set textDirection(value:'ltr'|'rtl'|null){if(value===this._textDirection)return;this._textDirection=value;this.markNeedsLayout();this.clearTemplate();}
  get textScaleFactor():number{return this.textScaler.textScaleFactor;}set textScaleFactor(value:number){this.textScaler=TextScaler.linear(value);}
  get textScaler():TextScaler{return this._textScaler;}set textScaler(value:TextScaler){if(valueEquals(value,this._textScaler))return;this._textScaler=value;this.markNeedsLayout();this.clearTemplate();}
  get maxLines():number|null{return this._maxLines;}set maxLines(value:number|null){if(FoundationBuildMode.debug)invariant(value===null||value>0,'invalid-max-lines','maxLines must be positive');if(value===this._maxLines)return;this._maxLines=value;this.markNeedsLayout();}
  get ellipsis():string|null{return this._ellipsis;}set ellipsis(value:string|null){if(FoundationBuildMode.debug)invariant(value===null||value.length>0,'empty-ellipsis','ellipsis must not be empty');if(value===this._ellipsis)return;this._ellipsis=value;this.markNeedsLayout();}
  get locale():Locale|null{return this._locale;}set locale(value:Locale|null){if(valueEquals(value,this._locale))return;this._locale=value;this.markNeedsLayout();}
  get strutStyle():StrutStyle|null{return this._strutStyle;}set strutStyle(value:StrutStyle|null){if(valueEquals(value,this._strutStyle))return;this._strutStyle=value;this.markNeedsLayout();this.clearTemplate();}
  get textWidthBasis():TextWidthBasis{return this._textWidthBasis;}set textWidthBasis(value:TextWidthBasis){if(value===this._textWidthBasis)return;this._textWidthBasis=value;if(FoundationBuildMode.debug)this.needsRelayout=true;}
  get textHeightBehavior():TextHeightBehavior|null{return this._textHeightBehavior;}set textHeightBehavior(value:TextHeightBehavior|null){if(valueEquals(value,this._textHeightBehavior))return;this._textHeightBehavior=value;this.markNeedsLayout();this.clearTemplate();}
  get hyphens():Hyphens{return this._hyphens;}set hyphens(value:Hyphens){if(value===this._hyphens)return;this._hyphens=value;this.markNeedsLayout();}
  private clearTemplate():void{this.template=undefined;}
  markNeedsLayout():void{this.live();const previous=this.current,cache=this.cache;this.current=undefined;this.cache=undefined;this.caret=undefined;this.contentWidth=undefined;this.paintOffsetX=0;if(cache)cache.paragraph.dispose();else if(previous&&this.registry?.hasInitialProducer(previous.resource))this.registry.releaseProducer(previous.resource);}
  /** @internal A detached render subtree keeps configuration, not engine producers.
   * Existing recordings retain their own leases; reattachment performs layout. */
  _releaseLayoutResources():void{const errors:unknown[]=[];try{this.clearTemplate();}catch(error){errors.push(error);}try{this.markNeedsLayout();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Detached text layout retirement failed');}
  setPlaceholderDimensions(value:readonly PlaceholderDimensions[]|null):void{
    this.live();if(value===null||value.length===0||listEquals(value,this.placeholderDimensions))return;
    if(FoundationBuildMode.debug){invariant(this.text,'missing-text','Placeholder dimensions require text');let count=0;this.text.visitChildren(span=>{if(span instanceof PlaceholderSpan)count++;return value.length>=count;});invariant(count===value.length,'placeholder-count','Placeholder dimensions must match the text');}
    this.placeholderDimensions=Object.freeze([...value]);this.markNeedsLayout();
  }
  private paragraphStyle(align:TextAlign=this.textAlign):ParagraphStyle{invariant(this.textDirection!==null,'missing-text-direction','TextPainter.textDirection must be set before layout');return (this.text?.style??new TextStyle()).getParagraphStyle({textAlign:align,textDirection:this.textDirection,textScaler:this.textScaler,maxLines:this.maxLines,ellipsis:this.ellipsis,locale:this.locale?.toString()??null,strutStyle:this.strutStyle,textHeightBehavior:this.textHeightBehavior,hyphens:this.hyphens});}
  private createParagraph(template=false):Paragraph{
    invariant(this.context,'unbound-text-painter','Supply an application ParagraphContext to TextPainter before layout');const builder=new ParagraphBuilder(this.paragraphStyle(template?'left':this.textAlign),template?{...this.context,transient:true}:this.context);
    try{if(template){const style=this.text?.style;if(style)builder.pushStyle(style.getTextStyle({textScaler:this.textScaler}));builder.addText(' ');}else{invariant(this.text,'missing-text','TextPainter.text must be set before layout');this.text.build(builder,{textScaler:this.textScaler,dimensions:this.placeholderDimensions});}return builder.build();}catch(error){builder.dispose();throw error;}
  }
  private syncCache():void{const cache=this.cache!,next=cache.paragraph._layoutSnapshot();if(this.current!==next){this.caret=undefined;this.key=serializeTextInput(next.input);}this.current=next;this.contentWidth=cache.contentWidth;this.paintOffsetX=cache.paintOffset;}
  private layoutInline({minWidth=0,maxWidth=Infinity}:TextPainterLayoutOptions):void{
    this.live();invariant(!Number.isNaN(minWidth)&&!Number.isNaN(maxWidth)&&minWidth>=0&&minWidth<=maxWidth,'invalid-text-width','Text layout requires ordered nonnegative widths');this.needsRelayout=false;
    const cached=this.cache;if(cached?.resizeToFit(minWidth,maxWidth,this.textWidthBasis)){this.syncCache();return;}
    invariant(this.text,'missing-text','TextPainter.text must be set before layout');invariant(this.textDirection,'missing-text-direction','TextPainter.textDirection must be set before layout');
    const rtl=this.textDirection==='rtl',align=this.textAlign,alignment=align==='center'?.5:align==='right'||align==='start'&&rtl||align==='end'&&!rtl||align==='justify'&&rtl?1:0,adjust=!Number.isFinite(maxWidth)&&alignment!==0,adjusted=!adjust?maxWidth:cached?.paragraph.maxIntrinsicWidth;
    let layoutWidth=adjusted??maxWidth;const paragraph=cached?.paragraph??this.createParagraph();
    try{paragraph.layout(new ParagraphConstraints({width:layoutWidth}));const width=Math.min(maxWidth,Math.max(minWidth,this.textWidthBasis===TextWidthBasis.longestLine?paragraph.longestLine:paragraph.maxIntrinsicWidth));if(adjusted===undefined&&Number.isFinite(minWidth)){layoutWidth=paragraph.maxIntrinsicWidth;paragraph.layout(new ParagraphConstraints({width:layoutWidth}));}this.cache=new TextPainterLayoutCache(paragraph,alignment,layoutWidth,width);if(!cached)this.rebuildParagraphForPaint=false;this.syncCache();}catch(error){if(!cached)paragraph.dispose();else this.syncCache();throw error;}
  }
  paint(canvas:Canvas,offset:OffsetValue):void{
    this.live();const cache=this.cache;invariant(cache,'text-not-laid-out','Call TextPainter.layout before paint');if(!Number.isFinite(cache.paintOffset))return;
    if(this.rebuildParagraphForPaint){const previous=cache.paragraph,next=this.createParagraph();try{next._layoutReplacing(new ParagraphConstraints({width:cache.layoutMaxWidth}),previous);if(FoundationBuildMode.debug)invariant(next.width===previous.width&&next.height===previous.height,'paint-changed-text-layout','A paint-only InlineSpan change must preserve paragraph geometry');}catch(error){next.dispose();throw error;}cache.paragraph=next;this.rebuildParagraphForPaint=false;this.syncCache();previous.dispose();}
    if(FoundationBuildMode.debug&&this.debugPaintTextLayoutBoxes){const paint=new Paint({style:'stroke',strokeWidth:1,color:0xff00ffff});for(const box of this.getBoxesForSelection(new SourceTextSelection({baseOffset:0,extentOffset:this.plainText.length})))canvas.drawRect(box.toRect().shift(offset),paint);}
    canvas.drawParagraph(cache.paragraph,new OffsetValue(offset.dx+cache.paintOffset,offset.dy));
  }
  get inlinePlaceholderBoxes():readonly TextBox[]|null{const cache=this.cache;if(!cache)return null;const x=cache.paintOffset;return !Number.isFinite(x)?[]:x===0?cache.inlinePlaceholderBoxes:cache.inlinePlaceholderBoxes.map(box=>TextBox.fromLTRBD(box.left+x,box.top,box.right+x,box.bottom,box.direction));}
  get size():Size{return new Size(this.width,this.height);}
  computeDistanceToActualBaseline(baseline:TextBaseline):number{const layout=this.laidOut();return baseline==='alphabetic'?layout.alphabeticBaseline:layout.ideographicBaseline;}
  get debugDisposed():boolean{invariant(FoundationBuildMode.debug,'debug-only','TextPainter.debugDisposed is only available when asserts are enabled');return this.dead;}
  static isHighSurrogate(value:number):boolean{if(FoundationBuildMode.debug)invariant(value>=0&&value<=0xfffff,'invalid-utf16','Value must be a UTF16 code unit');return (value&0xfc00)===0xd800;}
  static isLowSurrogate(value:number):boolean{if(FoundationBuildMode.debug)invariant(value>=0&&value<=0xfffff,'invalid-utf16','Value must be a UTF16 code unit');return (value&0xfc00)===0xdc00;}
  private assertReflowed():void{if(!this.legacy&&FoundationBuildMode.debug)invariant(!this.needsRelayout,'text-needs-relayout','Call layout after changing textWidthBasis');}
  /** @internal Validate before render-object equality shortcuts as well as caches. */
  validateResources(input:Pick<TextLayoutInput,'font'|'style'|'runs'>):void{for(const resource of [input.font,...textPaintResources(input)])invariant(this.resources.has(resource),'stale-resource','Text input contains a foreign or retired font/paint image');}
  /** @internal Current box/rich renderer owns the source layout-cache paint offset. */
  setPaintGeometry(contentWidth:number,paintOffsetX=0):void{invariant(Number.isFinite(contentWidth)&&contentWidth>=0&&Number.isFinite(paintOffsetX),'invalid-text-paint-geometry','Invalid paragraph paint geometry');this.contentWidth=contentWidth;this.paintOffsetX=paintOffsetX;}
  layout(options?:TextPainterLayoutOptions):void;
  /** @internal Existing transport callers supply a complete captured engine input. */
  layout(input:TextLayoutInput):TextLayout;
  layout(input:TextLayoutInput|TextPainterLayoutOptions={}):TextLayout|void {
    if(!('font' in input)){this.layoutInline(input);return;}
    this.live();invariant(this.legacy,'mixed-text-painter-mode','Use source layout options with an InlineSpan-configured TextPainter');
    this.validateResources(input);
    const key=serializeTextInput(input);
    if(this.current && this.key===key && this.resources.has(this.current.resource))return this.current;
    const previous=this.current,next=this.textService.layout(input,previous?{replacing:previous}:undefined);this.current=next;this.key=key;this.caret=undefined;this.paintOffsetX=0;this.contentWidth=undefined;
    if(previous && this.resources.has(previous.resource))this.resources.releaseProducer(previous.resource);
    return next;
  }
  private laidOut():TextLayout{this.live();invariant(this.current&&this.resources.hasInitialProducer(this.current.resource),'text-not-laid-out','TextPainter requires a current live layout');return this.current;}
  get width():number{const layout=this.laidOut();if(!this.legacy&&FoundationBuildMode.debug)invariant(!this.needsRelayout,'text-needs-relayout','Call layout after changing textWidthBasis');return this.legacy?layout.width:this.cache!.contentWidth;}
  get height():number{return this.laidOut().height;}
  get minIntrinsicWidth():number{return this.laidOut().minIntrinsicWidth;}
  get maxIntrinsicWidth():number{return this.laidOut().maxIntrinsicWidth;}
  get didExceedMaxLines():boolean{return this.laidOut().overflow;}
  get hasGlyphBoundarySupport():boolean{return typeof this.textService.glyphAt==='function';}
  get hasWordBoundarySupport():boolean{return typeof this.textService.wordBoundary==='function';}
  /** Backend read admission belongs to the exact laid-out Core paragraph. */
  get nativeQueryReference():TextLayoutQueryReference|null{const layout=this.laidOut(),reference=this.textService.nativeQueryReference?.(layout);if(!reference)return null;invariant(reference.protocol==='native-paragraph-v1'&&Number.isSafeInteger(reference.token)&&reference.token>0,'invalid-paragraph-query-reference','Invalid native paragraph read ticket');return Object.freeze({...reference});}
  /** @internal Selection transport consumes line ranges as well as metrics. */
  _layoutLineMetrics():TextLayout['lines']{return this.laidOut().lines;}
  computeLineMetrics():readonly LineMetrics[]{this.laidOut();if(!this.legacy&&FoundationBuildMode.debug)invariant(!this.needsRelayout,'text-needs-relayout','Call layout after changing textWidthBasis');if(this.cache)return this.cache.lineMetrics;return this.laidOut().lines.map(line=>{invariant(line.metrics,'paragraph-line-metrics-unavailable','Backend must expose complete line metrics');return new LineMetrics({...line.metrics,left:line.metrics.left+this.paintOffsetX});});}
  getPositionForOffset(offset:Offset):TextPosition{
    this.assertReflowed();const layout=this.laidOut(),hit=this.textService.hit(layout,offset.x-this.paintOffsetX,offset.y);invariant(Number.isInteger(hit.position)&&hit.position>=0&&hit.position<=layout.input.text.length,'invalid-text-offset','Engine position is outside UTF16 body');return new TextPosition({offset:hit.position,affinity:hit.affinity});
  }
  /** @internal Legacy single-body editing keeps grapheme-safe transport cursors. */
  getGraphemePositionForOffset(offset:Offset):TextPosition{
    const layout=this.laidOut(),localX=offset.x-this.paintOffsetX,hit=this.textService.hit(layout,localX,offset.y);
    if(hit.start===undefined||hit.end===undefined){textOffset(layout.input.text,hit.position);return new TextPosition({offset:hit.position,affinity:hit.affinity});}
    textRange(layout,hit.start,hit.end);let position=hit.position;
    // Some engines return a UTF-16 position inside a shaped grapheme. The
    // engine's grapheme bounds/direction choose a complete cluster boundary.
    if(position>hit.start&&position<hit.end&&hit.bounds){const left=localX<hit.bounds.x+hit.bounds.width/2;position=left===(hit.direction!=='rtl')?hit.start:hit.end;}
    textOffset(layout.input.text,position);return new TextPosition({offset:position,affinity:hit.affinity});
  }
  getBoxesForSelection(selection:SourceTextSelection,options?:{readonly boxHeightStyle?:BoxHeightStyle;readonly boxWidthStyle?:BoxWidthStyle}):readonly TextBox[];
  getBoxesForSelection(selection:TextSelection):readonly Rect[];
  getBoxesForSelection(selection:SourceTextSelection|TextSelection,{boxHeightStyle='tight',boxWidthStyle='tight'}:{readonly boxHeightStyle?:BoxHeightStyle;readonly boxWidthStyle?:BoxWidthStyle}={}):readonly TextBox[]|readonly Rect[]{
    this.assertReflowed();const layout=this.laidOut();if(!Number.isFinite(this.paintOffsetX))return [];
    if(!(selection instanceof SourceTextSelection)){const start=Math.min(selection.anchor,selection.focus),end=Math.max(selection.anchor,selection.focus);textRange(layout,start,end);return start===end?Object.freeze([]):this.textService.range(layout,start,end);}
    if(FoundationBuildMode.debug)invariant(selection.isValid,'invalid-text-range','Selection offsets must be nonnegative');if(selection.isCollapsed)return Object.freeze([]);
    invariant(this.textService.boxes,'text-boxes-unavailable','Text backend does not expose directional boxes');
    return Object.freeze(this.textService.boxes(layout,selection.start>>>0,selection.end>>>0,{heightStyle:boxHeightStyle,widthStyle:boxWidthStyle}).map(({rect,direction})=>TextBox.fromLTRBD(rect.x+this.paintOffsetX,rect.y,rect.x+rect.width+this.paintOffsetX,rect.y+rect.height,direction)));
  }
  private layoutTemplate():{readonly height:number;readonly baseline:number;readonly strutHeight:number}{
    if(!this.legacy){
      this.live();if(this.template)return this.template;const p=this.createParagraph(true);
      // The template is never painted or queried after this synchronous call.
      // Retain metrics only, just as the transport painter does below.
      try{p.layout(new ParagraphConstraints({width:Infinity}));const boxes=p.getBoxesForRange(0,1,{boxHeightStyle:'strut'});return this.template=Object.freeze({key:'inline',height:p.height,baseline:p.alphabeticBaseline,strutHeight:boxes[0]?.bottom!==undefined?boxes[0].bottom-boxes[0].top:p.height});}
      finally{p.dispose();}
    }
    const {runs:_runs,placeholders:_placeholders,...input}=this.laidOut().input,templateInput={...input,text:' ',textAlign:'left' as const,width:textLimits.width};this.validateResources(templateInput);
    const key=JSON.stringify(templateInput);if(this.template?.key===key)return this.template;
    // Cache only immutable metrics. The transient engine producer is retired in this call.
    const layout=this.textService.layout(templateInput,{transient:true});
    try{const boxes=this.textService.boxes?.(layout,0,1,{heightStyle:'strut'});return this.template=Object.freeze({key,height:layout.height,baseline:layout.lines[0]?.baseline??layout.alphabeticBaseline,strutHeight:boxes?.[0]?.rect.height??layout.height});}
    finally{if(this.resources.hasInitialProducer(layout.resource))this.resources.releaseProducer(layout.resource);}
  }
  get preferredLineHeight():number{return this.layoutTemplate().height;}
  private caretMetrics(position:TextPosition):{readonly offset:OffsetValue;readonly direction:'ltr'|'rtl';readonly height:number}|null{
    const layout=this.laidOut(),text=layout.input.text;if(!layout.lines.length)return null;
    const previous=text.charCodeAt(position.offset-1),isNewline=WordBoundary._isNewline(previous),leading=position.offset===0||position.affinity===TextAffinity.downstream||isNewline,offset=leading?position.offset:position.offset-1,key=this.key+':'+offset+':'+leading;
    if(this.caret?.key===key)return this.caret;
    invariant(Number.isSafeInteger(offset),'invalid-text-offset','Caret offset must be an exact integer');const nativeOffset=offset>>>0,glyph=nativeOffset>text.length?null:this.getGlyphInfoAt(nativeOffset);let metrics:{readonly offset:OffsetValue;readonly direction:'ltr'|'rtl';readonly height:number};
    if(glyph===null){
      const line=layout.lines.at(-1)!,last=text.charCodeAt(text.length-1),spaceSeparator=last===0x20||last===0x1680||last>=0x2000&&last<=0x200a||last===0x205f||last===0x3000,trailing=last===9||last!==0xa0&&last!==0x2007&&last!==0x202f&&spaceSeparator,lastGlyph=trailing&&text.length?this.getGlyphInfoAt(text.length-1):null;
      metrics={offset:new OffsetValue(lastGlyph?(layout.input.direction==='ltr'?lastGlyph.bounds.x+lastGlyph.bounds.width:lastGlyph.bounds.x):line.bounds.x+(layout.input.direction==='ltr'?line.bounds.width:0),line.baseline-this.layoutTemplate().baseline),direction:layout.input.direction,height:lastGlyph?.bounds.height??line.height??line.bounds.height};
    }else{
      if(glyph.start===glyph.end){if(FoundationBuildMode.debug)invariant(glyph.start===0,'invalid-collapsed-caret-glyph','Collapsed caret glyph must start at zero');return this.caretMetrics(new TextPosition({offset:offset+1}));}
      if(leading&&glyph.start!==offset){if(FoundationBuildMode.debug)invariant(glyph.end>glyph.start+1,'invalid-caret-grapheme','Interior caret position requires a multicode-unit grapheme');return this.caretMetrics(new TextPosition({offset:glyph.end}));}
      invariant(this.textService.boxes,'text-boxes-unavailable','Text backend does not expose directional boxes');
      const boxes=this.textService.boxes(layout,glyph.start,glyph.end,{heightStyle:'strut'}),left=glyph.direction==='ltr'?leading:!leading,box=left?boxes[0]:boxes.at(-1);
      invariant(box,'missing-caret-box','Engine returned no strut box for a shaped grapheme');metrics={offset:new OffsetValue(box.rect.x+(left?0:box.rect.width),box.rect.y),direction:box.direction,height:box.rect.height};
    }
    return this.caret=Object.freeze({key,...metrics});
  }
  getOffsetForCaret(position:TextPosition,caretPrototype:{readonly width:number}):OffsetValue{
    this.assertReflowed();const layout=this.laidOut(),metrics=this.caretMetrics(position),width=this.contentWidth??layout.width;
    if(metrics===null){const align=layout.input.textAlign??'start',rtl=layout.input.direction==='rtl',fraction=align==='center'?.5:align==='right'||align==='start'&&rtl||align==='end'&&!rtl||align==='justify'&&rtl?1:0;return new OffsetValue(fraction*width,0);}
    return new OffsetValue(Math.max(0,Math.min(width,metrics.offset.dx-(metrics.direction==='rtl'?caretPrototype.width:0)+this.paintOffsetX)),metrics.offset.dy);
  }
  getFullHeightForCaret(position:TextPosition,_caretPrototype:{readonly width:number}):number{const input=this.laidOut().input;if(input.strutStyle===undefined||input.strutStyle.fontSize===0){const height=this.caretMetrics(position)?.height;if(height!==undefined)return height;}return this.layoutTemplate().strutHeight;}
  /** Source API walks UTF16 scalar boundaries, not extended graphemes. */
  getOffsetAfter(offset:number):number|null{if(!this.legacy){invariant(this.text,'missing-text','TextPainter.text must be set');const value=this.text.codeUnitAt(offset);return value===null?null:offset+(TextPainter.isHighSurrogate(value)?2:1);}const text=this.laidOut().input.text;invariant(Number.isInteger(offset)&&offset>=0&&offset<=text.length,'invalid-text-offset','Offset outside body');if(offset===text.length)return null;return offset+(TextPainter.isHighSurrogate(text.charCodeAt(offset))?2:1);}
  getOffsetBefore(offset:number):number|null{if(!this.legacy){invariant(this.text,'missing-text','TextPainter.text must be set');const value=this.text.codeUnitAt(offset-1);return value===null?null:offset-(TextPainter.isLowSurrogate(value)?2:1);}const text=this.laidOut().input.text;invariant(Number.isInteger(offset)&&offset>=0&&offset<=text.length,'invalid-text-offset','Offset outside body');if(offset===0)return null;return offset-(TextPainter.isLowSurrogate(text.charCodeAt(offset-1))?2:1);}
  getGlyphInfoAt(offset:number):TextGlyphInfo|null{const layout=this.laidOut();invariant(this.textService.glyphAt,'text-boundary-unavailable','Text backend does not expose shaped glyph boundaries');return this.textService.glyphAt(layout,offset);}
  /** Source closest-cluster query, including the painter's cached paint offset. */
  _getClosestClusterForOffset(offset:Offset):TextClusterInfo|null{const layout=this.laidOut(),hit=this.textService.closestGlyph?this.textService.closestGlyph(layout,offset.x-this.paintOffsetX,offset.y):this.textService.hit(layout,offset.x-this.paintOffsetX,offset.y);if(hit===null||hit.start===undefined||hit.end===undefined||hit.bounds===undefined||hit.direction===undefined)return null;textRange(layout,hit.start,hit.end);return {start:hit.start,end:hit.end,bounds:{...hit.bounds,x:hit.bounds.x+this.paintOffsetX},direction:hit.direction};}
  getClosestGlyphForOffset(offset:Offset):GlyphInfo|null{this.assertReflowed();const hit=this._getClosestClusterForOffset(offset);return hit===null?null:new GlyphInfo(RectValue.fromLTWH(hit.bounds.x,hit.bounds.y,hit.bounds.width,hit.bounds.height),new TextRange({start:hit.start,end:hit.end}),hit.direction);}
  getWordBoundary(position:{readonly offset:number;readonly affinity?:TextAffinity}):TextRange{const layout=this.laidOut();invariant(this.textService.wordBoundary,'text-boundary-unavailable','Text backend does not expose Unicode word boundaries');const offset=position.offset-(position.affinity===TextAffinity.upstream?1:0);invariant(Number.isSafeInteger(offset),'invalid-text-offset','Word offset must be an exact integer');return new TextRange(this.textService.wordBoundary(layout,offset>>>0));}
  get wordBoundaries():WordBoundary{const layout=this.laidOut();invariant(this.textService.wordBoundary,'text-boundary-unavailable','Text backend does not expose Unicode word boundaries');return WordBoundary._fromParagraph(layout.input.text,position=>new TextRange(this.textService.wordBoundary!(layout,position.offset>>>0)));}
  getLineBoundary(position:{readonly offset:number;readonly affinity?:'upstream'|'downstream'}):TextRange{
    if(this.cache)return this.cache.paragraph.getLineBoundary(new TextPosition(position));
    const layout=this.laidOut();textOffset(layout.input.text,position.offset);const lines=layout.lines,at=position.offset;let line=position.affinity==='upstream'&&at>0?[...lines].reverse().find(item=>item.end===at):undefined;line??=lines.find(item=>at>=item.start&&at<item.end);
    if(!line){if(position.affinity==='upstream'&&at>0)line=[...lines].reverse().find(item=>at>=item.start&&at<=item.end);else line=lines.find(item=>item.start===at)??lines.find(item=>item.end===at);}
    invariant(line,'text-line-unavailable','Position is outside laid-out lines');return new TextRange({start:line.start,end:line.end});
  }
  /** Engine-cluster navigation kept separate from the source scalar helpers. */
  getGraphemeOffset(offset:number,direction:'backward'|'forward'):number|null{
    const layout=this.laidOut(),text=layout.input.text;textOffset(text,offset);if(direction==='forward'&&offset===text.length||direction==='backward'&&offset===0)return offset;
    const probe=direction==='backward'?offset-1:offset,glyph=this.getGlyphInfoAt(probe);
    if(glyph&&!glyph.isEllipsis&&glyph.end>glyph.start)return direction==='backward'?glyph.start:glyph.end;
    // Hard line break code units may have no glyph. Keep CRLF one navigation unit.
    if(direction==='forward'&&text[offset]==='\r'&&text[offset+1]==='\n')return offset+2;
    if(direction==='backward'&&text[offset-1]==='\n'&&text[offset-2]==='\r')return offset-2;
    if(text[probe]!=='\r'&&text[probe]!=='\n')return null;return direction==='backward'?this.getOffsetBefore(offset)!:this.getOffsetAfter(offset)!;
  }
  /** Geometry-only probes release their producer immediately and never replace the painted paragraph. */
  measure(input:TextLayoutInput):TextLayoutGeometry{
    this.validateResources(input);
    const key=serializeTextInput(input),cached=this.measurements.get(key);if(cached)return cached;
    const current=this.current&&this.key===key&&this.resources.has(this.current.resource)?this.current:undefined,layout=current??this.textService.layout(input,{transient:true});
    try{const {resource:_resource,input:_input,indexUnit:_indexUnit,...geometry}=layout;const result=Object.freeze({...geometry,lines:Object.freeze(geometry.lines.map(line=>Object.freeze({...line,bounds:Object.freeze({...line.bounds})})))});if(this.measurements.size>=2)this.measurements.delete(this.measurements.keys().next().value!);this.measurements.set(key,result);return result;}
    finally{if(!current&&this.resources.has(layout.resource))this.resources.releaseProducer(layout.resource);}
  }
  dispose():void {if(this.dead){if(!this.legacy&&FoundationBuildMode.debug)invariant(false,'disposed-text-painter','TextPainter already disposed');return;}const errors:unknown[]=[];try{this.clearTemplate();}catch(error){errors.push(error);}try{this.markNeedsLayout();}catch(error){errors.push(error);}this.dead=true;this._text=null;this.key='';this.template=undefined;this.caret=undefined;this.contentWidth=undefined;this.paintOffsetX=0;this.measurements.clear();if(errors.length===1)throw errors[0];if(errors.length)throw new AggregateError(errors,'TextPainter retirement failed');}
}
