// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Core paragraph painting and selected line/caret responsibilities from pinned rendering/editable.dart.
import {Offset} from '../../ui/offset.ts';
import {protect} from '../../ui/value-math.ts';
import {hashValues} from '../painting/value-equality.ts';
import {RenderBox} from './object.ts';
import type {PipelineOwner} from './object.ts';
import {ViewportOffset} from './viewport-offset.ts';
import {BoxConstraints} from './constraints.ts';
import {invariant} from '../../foundation/errors.ts';
import type {Size,Offset as Point} from '../../ui/geometry.ts';
import type {TextBaseline} from './object.ts';
import type {TextLayoutInput,TextLayoutGeometry,TextLayoutService,TextInputHitOptions} from '../../ui/types.ts';
import type {ResourceRegistry} from '../../hosting/resources.ts';
import {TextPainter} from '../painting/text-painter.ts';
import {freezeTextInput,textLimits} from '../../ui/text.ts';
import type {PaintingContext} from '../painting/context.ts';
import type {TextSelection,Composition,TextLayout} from '../../ui/types.ts';
import {TextSelection as Selection} from '../../services/text-editing.ts';
import {TextPosition} from '../../ui/text-position.ts';
import {Rect} from '../../ui/rect.ts';
import {Paint} from '../../ui/paint.ts';
import {graphemeBoundaries} from '../../foundation/grapheme-boundaries.ts';
import type {SemanticsTextNavigation,SemanticsTextParagraph} from '../../ui/types.ts';
import {textOffset} from '../../ui/text.ts';
import {LayerHandle,LayerLink,LeaderLayer} from './layer.ts';

export interface EditableLinePolicy {readonly minLines:number|null;readonly maxLines:number|null;readonly expands:boolean}
/** Resolved Core text input, owned by the same View as the painted paragraph. */
export interface EditableTextLayout extends EditableLinePolicy {
  readonly input:Omit<TextLayoutInput,'width'>;readonly text:TextLayoutService;readonly resources:ResourceRegistry;
}
export interface EditablePaintValue {
  readonly selection:TextSelection;readonly composing:Composition;readonly focused:boolean;
  readonly cursorVisible:boolean;readonly cursorColor:number;readonly selectionColor:number;
  readonly cursorWidth?:number;readonly cursorHeight?:number;readonly obscureText?:boolean;
  readonly affinity?:'upstream'|'downstream';
  /** Core gesture target when a handle moves the anchor rather than the focus. */
  readonly activeSelectionEdge?:TextPosition;
  /** Original UTF-16 grapheme stops when the painted body is obscured. */
  readonly graphemeOffsets?:readonly number[];
}
export interface EditableGeometry {
  readonly coordinates:'editable-local';readonly epoch:number;readonly width:number;readonly height:number;
  readonly caret:Rect;readonly caretBaseline:Point;readonly selectionRects:readonly Rect[];
}
export interface EditableSelectionLinks {readonly start:LayerLink;readonly end:LayerLink;readonly toolbar:LayerLink}
interface VisualGraphemeEdge {readonly left:number;readonly right:number;readonly leftPosition:TextPosition;readonly rightPosition:TextPosition}
export function validateEditableLinePolicy(policy:EditableLinePolicy):void {
  const {minLines,maxLines,expands}=policy;
  invariant([minLines,maxLines].every(lines=>lines===null||Number.isSafeInteger(lines)&&lines>0&&lines<=textLimits.lines),'invalid-editor-lines','Editor line counts must be positive integers within the paragraph line budget');
  invariant(minLines===null||maxLines===null||minLines<=maxLines,'invalid-editor-lines','minLines must not exceed maxLines');
  invariant(typeof expands==='boolean'&&(!expands||minLines===null&&maxLines===null),'invalid-expanded-editor','Expanded editors require null minLines and maxLines');
}
function hardLineBreaks(text:string):number{let count=0;for(let index=0;index<text.length;index++){const unit=text.charCodeAt(index);if(unit===10||unit===0x85||unit===11||unit===12||unit===0x2028||unit===0x2029)count++;}return count;}
/** Core owns shaping, glyph/selection/composing/caret paint, hit testing and scroll.
 * An OS input connection may consume this geometry; it never supplies it. */
export class RenderEditable extends RenderBox {
  private preferredHeight:number;
  private baselines:(Readonly<Record<TextBaseline,number>>&{readonly lineHeight:number})|null=null;
  private layoutValue:EditableTextLayout|null=null;private layoutKey='';private measurements:TextPainter|undefined;
  private paragraph:TextLayout|undefined;private epoch=0;private paintX=0;private caretRevealPending=true;
  private readonly fixedOffset=ViewportOffset.zero();private viewportOffset:ViewportOffset=this.fixedOffset;private observingOffset=false;
  get offset():ViewportOffset{return this.viewportOffset;}
  set offset(value:ViewportOffset){
    if(value===this.viewportOffset)return;this.assertCanMutateLayoutProperty();
    if(this.observingOffset){value.addListener(this.offsetChanged);try{this.viewportOffset.removeListener(this.offsetChanged);}catch(error){value.removeListener(this.offsetChanged);throw error;}}
    this.viewportOffset=value;this.caretRevealPending=false;this.markNeedsLayout();
  }
  private get scrollX():number{return this.layoutValue?.maxLines===1&&this.offset.hasPixels?this.offset.pixels:0;}
  private get scrollY():number{return this.layoutValue&&this.layoutValue.maxLines!==1&&this.offset.hasPixels?this.offset.pixels:0;}
  private readonly offsetChanged=()=>{this.caretRevealPending=false;this.epoch++;this.markNeedsPaint();this.markNeedsSemanticsUpdate();};
  onCaretReveal:(()=>void)|undefined;
  private visual:EditablePaintValue={selection:{anchor:0,focus:0},composing:{status:'none'},focused:false,cursorVisible:false,cursorColor:0xff000000,selectionColor:0x6633b5e5};
  private links:EditableSelectionLinks|undefined;
  private readonly leaders=[new LayerHandle<LeaderLayer>(),new LayerHandle<LeaderLayer>(),new LayerHandle<LeaderLayer>()];
  set selectionLinks(value:EditableSelectionLinks|undefined){if(this.links===value)return;this.links=value;this.markNeedsPaint();}
  get textPainter():TextPainter|undefined{return this.measurements;}
  get scrollOffset():Point{return Object.freeze({x:this.scrollX,y:this.scrollY});}
  get textDirection():'ltr'|'rtl'{invariant(this.layoutValue,'stale-editable-layout','Paragraph direction requires resolved Core text layout');return this.layoutValue.input.direction;}
  get isMultiline():boolean{invariant(this.layoutValue,'stale-editable-layout','Scroll direction requires resolved Core text layout');return this.layoutValue.maxLines!==1;}
  get maxScrollExtent():number{this.requireParagraph();return this.isMultiline?Math.max(0,this.paragraph!.height-this.size.height):Math.max(0,this.paragraph!.maxIntrinsicWidth+(this.visual.cursorWidth??1)-this.size.width);}
  /** Selection scrolling uses the painted paragraph's extent, never OS metrics. */
  scrollBy(delta:number):boolean{
    invariant(Number.isFinite(delta),'invalid-editable-scroll','Selection scroll must be finite');this.requireParagraph();
    const before=this.offset.pixels,target=Math.max(0,Math.min(this.maxScrollExtent,before+delta));
    this.caretRevealPending=false;if(target!==before)this.offset.jumpTo(target);return this.offset.pixels!==before;
  }
  set editingValue(value:EditablePaintValue){
    invariant(Number.isFinite(value.cursorWidth??1)&&(value.cursorWidth??1)>0&&Number.isFinite(value.cursorHeight??1)&&(value.cursorHeight??1)>0,'invalid-cursor-size','Cursor dimensions must be positive and finite');
    if(JSON.stringify(value)===JSON.stringify(this.visual))return;
    if(value.selection.anchor!==this.visual.selection.anchor||value.selection.focus!==this.visual.selection.focus||value.affinity!==this.visual.affinity){this.epoch++;this.caretRevealPending=true;}
    if(value.activeSelectionEdge&&!value.activeSelectionEdge.equals(this.visual.activeSelectionEdge))this.caretRevealPending=true;
    if(value.focused&&!this.visual.focused||value.cursorWidth!==this.visual.cursorWidth||value.cursorHeight!==this.visual.cursorHeight)this.caretRevealPending=true;
    this.visual=Object.freeze({...value,selection:Object.freeze({...value.selection}),composing:Object.freeze({...value.composing}),...(value.graphemeOffsets?{graphemeOffsets:Object.freeze([...value.graphemeOffsets])}:{})});this.markNeedsPaint();
  }
  constructor(height=48){super();this.checkHeight(height);this.preferredHeight=height;}
  override get clips():boolean{return true;}
  protected override get childCountLimit():number{return 0;}
  private checkHeight(value:number):void{invariant(Number.isFinite(value)&&value>=0,'invalid-editor-height','EditableText height must be finite and nonnegative');}
  get height():number{return this.preferredHeight;}
  set height(value:number){this.checkHeight(value);if(value===this.preferredHeight)return;this.preferredHeight=value;this.markNeedsLayout();}
  set textLayout(value:EditableTextLayout|null){
    if(value===null){if(this.layoutValue===null)return;this.measurements?.dispose();this.measurements=undefined;this.paragraph=undefined;this.layoutValue=null;this.layoutKey='';this.visualNavigation=undefined;this.markNeedsLayout();return;}
    validateEditableLinePolicy(value);const {width:_width,...input}=freezeTextInput({...value.input,width:0}),key=JSON.stringify({input,minLines:value.minLines,maxLines:value.maxLines,expands:value.expands});
    if(key===this.layoutKey&&this.layoutValue?.text===value.text&&this.layoutValue.resources===value.resources)return;
    if(this.layoutValue?.text!==value.text||this.layoutValue?.resources!==value.resources){this.measurements?.dispose();this.measurements=new TextPainter(value.text,value.resources);this.paragraph=undefined;}
    this.layoutValue=Object.freeze({...value,input});this.layoutKey=key;this.caretRevealPending=true;this.markNeedsLayout();
  }
  private layoutInput(width:number):TextLayoutInput{const value=this.layoutValue!;return {...value.input,width:value.maxLines===1?textLimits.width:Math.min(width,textLimits.width),maxLines:value.maxLines===1?1:textLimits.lines,unlimitedLines:value.maxLines!==1,ellipsis:''};}
  private ensureParagraph(width:number):void{
    if(!this.layoutValue||!this.measurements)return;
    const old=this.paragraph;this.paragraph=this.measurements.layout(this.layoutInput(width));
    const input=this.layoutValue.input,align=input.textAlign??'start',rtl=input.direction==='rtl',fraction=align==='center'?.5:align==='right'||(align==='start'||align==='justify')&&rtl||align==='end'&&!rtl?1:0;
    const contentWidth=this.layoutValue.maxLines===1?Math.max(width,this.paragraph.maxIntrinsicWidth):width;
    this.paintX=fraction*(contentWidth-this.paragraph.width);this.measurements.setPaintGeometry(contentWidth,this.paintX);
    if(old!==this.paragraph){this.visualNavigation=undefined;this.epoch++;}
  }
  private get top():number{return this.layoutValue?.maxLines===1?Math.max(0,(this.size.height-(this.paragraph?.height??0))/2):0;}
  private requireParagraph():TextPainter{invariant(this.attached&&this.hasSize&&!this.needsLayout&&this.measurements&&this.layoutValue,'stale-editable-layout','Editable geometry requires current attached Core layout');this.ensureParagraph(this.size.width);return this.measurements;}
  private localRect(rect:Rect):Rect{return rect.shift(new Offset(-this.scrollX,this.top-this.scrollY));}
  getLocalRectForCaret(position:TextPosition):Rect{
    const painter=this.requireParagraph(),width=this.visual.cursorWidth??1,offset=painter.getOffsetForCaret(position,{width}),height=this.visual.cursorHeight??painter.getFullHeightForCaret(position,{width});
    return this.localRect(Rect.fromLTWH(Math.max(0,Math.min(Math.max(0,this.size.width,this.paragraph!.maxIntrinsicWidth)-width,offset.dx)),offset.dy,width,height));
  }
  getBoxesForSelection(selection:Selection):readonly Rect[]{return Object.freeze(this.requireParagraph().getBoxesForSelection(selection).map(box=>this.localRect(box.toRect())));}
  getPositionForOffset(point:Point):TextPosition{
    const painter=this.requireParagraph(),position=painter.getGraphemePositionForOffset({x:point.x+this.scrollX,y:point.y-this.top+this.scrollY}),text=this.layoutValue!.input.text,boundaries=this.visual.graphemeOffsets??graphemeBoundaries(text);
    if(boundaries.includes(position.offset))return position;
    const before=[...boundaries].reverse().find(at=>at<position.offset)??0,after=boundaries.find(at=>at>position.offset)??text.length;
    return new TextPosition({offset:position.offset-before<after-position.offset?before:after,affinity:position.affinity});
  }
  /** OS queries use the painted paragraph and the same original grapheme
   * boundaries as pointer editing, including an obscured document. */
  getTextPositionForPoint(point:Point,options:TextInputHitOptions):TextPosition|null{
    const painter=this.requireParagraph(),glyph=painter.getClosestGlyphForOffset(new Offset(point.x+this.scrollX,point.y-this.top+this.scrollY));
    const contained=glyph?.graphemeClusterLayoutBounds.contains(new Offset(point.x+this.scrollX,point.y-this.top+this.scrollY))??false;
    if(!glyph||!contained)return options.nearest?this.getPositionForOffset(point):null;
    if(options.roundNearest)return this.getPositionForOffset(point);
    const offset=glyph.graphemeClusterCodeUnitRange.start,boundaries=this.visual.graphemeOffsets??graphemeBoundaries(this.plainText);
    let low=0,high=boundaries.length;while(low<high){const middle=(low+high)>>>1;if(boundaries[middle]!<=offset)low=middle+1;else high=middle;}
    return new TextPosition({offset:boundaries[Math.max(0,low-1)]!,affinity:'downstream'});
  }
  getWordBoundary(position:TextPosition){return this.requireParagraph().getWordBoundary(position);}
  get wordBoundaries(){return this.requireParagraph().wordBoundaries;}
  private textNavigationCache:{readonly paragraph:TextLayout;readonly value:SemanticsTextNavigation}|undefined;
  override get coreTextParagraph():SemanticsTextParagraph|null {
    if(this.visual.obscureText||!this.layoutValue||!this.attached||!this.hasSize||this.needsLayout)return null;
    const reference=this.requireParagraph().nativeQueryReference;if(!reference)return null;
    return Object.freeze({resource:this.paragraph!.resource,reference,paintOffset:Object.freeze({x:this.paintX-this.scrollX,y:this.top-this.scrollY})});
  }
  override get coreTextNavigation():SemanticsTextNavigation|null {
    if(this.visual.obscureText||!this.layoutValue||!this.attached||!this.hasSize||this.needsLayout)return null;
    const painter=this.requireParagraph(),paragraph=this.paragraph!;
    if(this.textNavigationCache?.paragraph===paragraph)return this.textNavigationCache.value;
    const text=this.plainText,characters=Object.freeze([...graphemeBoundaries(text)]),lineStops=new Set([0,text.length]),wordStops=new Set([0,text.length]);
    for(const line of paragraph.lines){textOffset(text,line.start);lineStops.add(line.start);}
    if(this.layoutValue.text.wordBoundary)for(let at=0;at<text.length;){
      const range=painter.getWordBoundary(new TextPosition({offset:at}));textOffset(text,range.start);textOffset(text,range.end);
      invariant(range.start<=at&&range.end>at,'invalid-word-boundary','Core word navigation must advance within its painted paragraph');wordStops.add(range.start);wordStops.add(range.end);at=range.end;
    }
    const value=Object.freeze({characters,lines:Object.freeze([...lineStops].sort((a,b)=>a-b)),...(this.layoutValue.text.wordBoundary?{words:Object.freeze([...wordStops].sort((a,b)=>a-b))}:{})});
    this.textNavigationCache={paragraph,value};return value;
  }
  getLineBoundary(position:TextPosition){return this.requireParagraph().getLineBoundary(position);}
  get plainText():string{return this.layoutValue?.input.text??'';}
  private visualNavigation:{readonly paragraph:TextLayout;readonly width:number;readonly paintX:number;readonly graphemes:string;readonly boundaries:readonly number[];readonly lines:Map<number,readonly VisualGraphemeEdge[]>}|undefined;
  /** The engine has already resolved bidi. Walk its painted grapheme edges in
   * screen order while keeping selections in logical UTF-16 coordinates. */
  getNextVisualPosition(position:TextPosition,direction:'left'|'right'):TextPosition {
    invariant(position.offset>=0&&position.offset<=this.plainText.length,'invalid-text-offset','Visual caret offset is outside its Core document');
    const painter=this.requireParagraph(),paragraph=this.paragraph!,graphemes=this.visual.obscureText?(this.visual.graphemeOffsets??[]).join(','):'';
    let cache=this.visualNavigation;
    if(!cache||cache.paragraph!==paragraph||cache.width!==this.size.width||cache.paintX!==this.paintX||cache.graphemes!==graphemes){
      cache={paragraph,width:this.size.width,paintX:this.paintX,graphemes,boundaries:this.visual.obscureText&&this.visual.graphemeOffsets?this.visual.graphemeOffsets:graphemeBoundaries(this.plainText),lines:new Map()};this.visualNavigation=cache;
    }
    const boundaryAt=(offset:number,forward:boolean):number=>{
      const boundaries=cache!.boundaries;let low=0,high=boundaries.length;
      while(low<high){const middle=(low+high)>>>1;if(boundaries[middle]!<offset)low=middle+1;else high=middle;}
      return boundaries[low]===offset?offset:forward?boundaries[low]??this.plainText.length:boundaries[Math.max(0,low-1)]!;
    };
    if(boundaryAt(position.offset,true)!==position.offset){
      const forward=(direction==='right')===((painter.getGlyphInfoAt(position.offset)?.direction??this.textDirection)==='ltr');
      return new TextPosition({offset:boundaryAt(position.offset,forward),affinity:forward?'upstream':'downstream'});
    }
    const lineRange=painter.getLineBoundary(position),index=paragraph.lines.findIndex(line=>line.start===lineRange.start&&line.end===lineRange.end);
    invariant(index>=0,'missing-editable-line','Visual navigation requires a line from the painted paragraph');
    const edges=(lineIndex:number):readonly VisualGraphemeEdge[]=>{
      const cached=cache!.lines.get(lineIndex);if(cached){cache!.lines.delete(lineIndex);cache!.lines.set(lineIndex,cached);return cached;}
      const line=paragraph.lines[lineIndex]!,result:VisualGraphemeEdge[]=[],boundaries=cache!.boundaries;
      let low=0,high=boundaries.length;while(low<high){const middle=(low+high)>>>1;if(boundaries[middle]!<line.start)low=middle+1;else high=middle;}
      for(let at=low;at+1<boundaries.length&&boundaries[at]!<line.end;at++){
        const start=boundaries[at]!,end=boundaries[at+1]!;if(end>line.end)break;
        const leading=new TextPosition({offset:start,affinity:'downstream'}),trailing=new TextPosition({offset:end,affinity:'upstream'}),a=painter.getOffsetForCaret(leading,{width:0}).dx,b=painter.getOffsetForCaret(trailing,{width:0}).dx;
        if(a===b)continue;
        result.push(a<b?{left:a,right:b,leftPosition:leading,rightPosition:trailing}:{left:b,right:a,leftPosition:trailing,rightPosition:leading});
      }
      if(cache!.lines.size>=16)cache!.lines.delete(cache!.lines.keys().next().value!);cache!.lines.set(lineIndex,result);return result;
    };
    const right=direction==='right',x=painter.getOffsetForCaret(position,{width:0}).dx;
    let candidate:VisualGraphemeEdge|undefined;
    for(const edge of edges(index))if(right?edge.right>x&&(!candidate||edge.right<candidate.right):edge.left<x&&(!candidate||edge.left>candidate.left))candidate=edge;
    if(candidate)return right?candidate.rightPosition:candidate.leftPosition;
    const forward=right===(this.textDirection==='ltr'),nextIndex=index+(forward?1:-1),next=paragraph.lines[nextIndex];if(!next)return position;
    const current=paragraph.lines[index]!,hardBreak=forward?current.end<next.start:next.end<current.start;
    if(hardBreak)return new TextPosition({offset:boundaryAt(forward?next.start:next.end,forward),affinity:forward?'downstream':'upstream'});
    for(const edge of edges(nextIndex))if(!candidate||(right?edge.right<candidate.right:edge.left>candidate.left))candidate=edge;
    return candidate?(right?candidate.rightPosition:candidate.leftPosition):new TextPosition({offset:boundaryAt(forward?next.start:next.end,forward),affinity:forward?'downstream':'upstream'});
  }
  /** Lazy UTF-16 character bounds for an OS IME request, never a separate layout. */
  getCharacterBounds(start:number,end:number):readonly Rect[]{
    const painter=this.requireParagraph(),text=this.layoutValue!.input.text;
    invariant(Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=0&&end>=start&&end<=text.length,'invalid-text-range','Character bounds require an in-body UTF-16 range');
    const rects:Rect[]=[];
    for(let index=start;index<end;index++){
      const glyph=painter.getGlyphInfoAt(index);
      if(glyph)rects.push(this.localRect(Rect.fromLTWH(glyph.bounds.x+this.paintX,glyph.bounds.y,glyph.bounds.width,glyph.bounds.height)));
      else rects.push(this.getLocalRectForCaret(new TextPosition({offset:index})));
    }
    return Object.freeze(rects);
  }
  getEndpointsForSelection(selection:Selection):readonly TextSelectionPoint[]{
    const painter=this.requireParagraph();
    if(selection.isCollapsed){const caret=this.getLocalRectForCaret(selection.extent);return [new TextSelectionPoint(caret.bottomLeft,this.layoutValue!.input.direction)];}
    const boxes=painter.getBoxesForSelection(selection),first=boxes[0],last=boxes.at(-1);if(!first||!last)return [];
    const start=this.localRect(first.toRect()),end=this.localRect(last.toRect());
    return [new TextSelectionPoint(new Offset(first.direction==='ltr'?start.left:start.right,start.bottom),first.direction),new TextSelectionPoint(new Offset(last.direction==='ltr'?end.right:end.left,end.bottom),last.direction)];
  }
  private paintSelectionLeaders(context:PaintingContext):void{
    if(!this.links)return;const selection=this.visual.selection,endpoints=this.getEndpointsForSelection(new Selection({baseOffset:selection.anchor,extentOffset:selection.focus,affinity:this.visual.affinity??'downstream'}));
    const links=[this.links.start,this.links.end,this.links.toolbar],positions=[endpoints[0]?.point??Offset.zero,endpoints.at(-1)?.point??Offset.zero,Offset.zero];
    for(let index=0;index<3;index++){
      const retained=this.leaders[index]!,layer=retained.layer??new LeaderLayer({link:links[index]!}),hold=new LayerHandle(layer);
      try{layer.link=links[index]!;layer.offset=positions[index]!;context.pushLayer(layer,()=>{},{x:0,y:0},this.paintBounds);retained.layer=layer;}finally{hold.dispose();}
    }
  }
  /** Recomputes after a Core edit, resize, font or scale change. */
  revealCaret():void{this.revealPosition(this.visual.activeSelectionEdge??new TextPosition({offset:this.visual.selection.focus,affinity:this.visual.affinity??'downstream'}));}
  /** A deferred automatic reveal cannot undo a newer explicit scroll. */
  revealPendingCaret():void{if(this.visual.focused&&this.caretRevealPending)this.revealCaret();}
  /** Explicit document scrolling does not move selection or continually reveal it. */
  revealPosition(position:TextPosition):void{
    if(!this.layoutValue||!this.hasSize||this.needsLayout)return;this.caretRevealPending=false;
    const rect=this.getLocalRectForCaret(position),delta=this.layoutValue.maxLines===1?rect.left<0?rect.left:rect.right>this.size.width?rect.right-this.size.width:0:rect.top<0?rect.top:rect.bottom>this.size.height?rect.bottom-this.size.height:0;
    this.scrollBy(delta);
  }
  /** Explicit accessibility scrolling uses the painted paragraph and keeps selection. */
  revealRange(start:number,end:number,alignToTop:boolean):Rect|null{
    invariant(Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=0&&start<=end&&end<=this.plainText.length&&typeof alignToTop==='boolean','invalid-text-range','Reveal range must belong to the Core document');
    textOffset(this.plainText,start);textOffset(this.plainText,end);
    if(!this.layoutValue||!this.hasSize||this.needsLayout||!this.attached)return null;
    this.caretRevealPending=false;const layout=this.layoutValue;
    const rangeRect=()=>{const boxes=start===end?[]:this.getBoxesForSelection(new Selection({baseOffset:start,extentOffset:end}));return boxes.length?boxes.slice(1).reduce((rect,box)=>rect.expandToInclude(box),boxes[0]!):this.getLocalRectForCaret(new TextPosition({offset:start}));};
    const before=rangeRect();
    if(this.layoutValue.maxLines===1)this.scrollBy(before.left<0?before.left:before.right>this.size.width?before.right-this.size.width:0);
    else this.scrollBy(alignToTop?before.top:before.bottom-this.size.height);
    if(!this.attached||!this.hasSize||this.needsLayout||this.layoutValue!==layout)return null;
    return rangeRect();
  }
  get editingGeometry():EditableGeometry{
    const selection=this.visual.selection,position=new TextPosition({offset:selection.focus,affinity:this.visual.affinity??'downstream'}),caret=this.getLocalRectForCaret(position),lines=this.paragraph!.lines,range=lines.some(line=>position.offset>=line.start&&position.offset<=line.end)?this.requireParagraph().getLineBoundary(position):null,line=range?lines.find(line=>line.start===range.start&&line.end===range.end):lines.at(-1);
    invariant(!range||line,'missing-editable-line','The caret line must belong to its painted paragraph');
    const baseline=(line?.baseline??this.baselines?.alphabetic??this.paragraph!.alphabeticBaseline)+this.top-this.scrollY;
    return Object.freeze({coordinates:'editable-local',epoch:this.epoch,width:this.size.width,height:this.size.height,caret,caretBaseline:Object.freeze({x:caret.x,y:baseline}),selectionRects:this.getBoxesForSelection(new Selection({baseOffset:selection.anchor,extentOffset:selection.focus}))});
  }
  onInputGeometryChanged:(()=>void)|undefined;
  protected override didCommitTextInputGeometry():void{this.onInputGeometryChanged?.();}
  override get coreEditingGeometry():EditableGeometry|null{return this.layoutValue&&this.hasSize&&!this.needsLayout&&this.attached?this.editingGeometry:null;}
  override paint(context:PaintingContext):void{
    if(!this.layoutValue)return;this.requireParagraph();if(this.visual.focused&&this.caretRevealPending)this.onCaretReveal?.();
    const selection=this.visual.selection;context.save();
    try{
      context.clip({x:0,y:0,...this.size});
      if(this.visual.focused&&!this.visual.obscureText&&selection.anchor!==selection.focus)for(const box of this.getBoxesForSelection(new Selection({baseOffset:selection.anchor,extentOffset:selection.focus})))context.drawRect(box,new Paint({color:this.visual.selectionColor}));
      context.paragraph(this.paragraph!.resource,this.paintX-this.scrollX,this.top-this.scrollY);
      const composing=this.visual.composing;
      if(!this.visual.obscureText&&composing.status==='active')for(const box of this.getBoxesForSelection(new Selection({baseOffset:composing.start,extentOffset:composing.end})))context.drawRect(Rect.fromLTWH(box.left,box.bottom-1,box.width,1),new Paint({color:this.visual.cursorColor,isAntiAlias:false}));
      if(this.visual.focused&&this.visual.cursorVisible&&selection.anchor===selection.focus)context.drawRect(this.getLocalRectForCaret(new TextPosition({offset:selection.focus,affinity:this.visual.affinity??'downstream'})),new Paint({color:this.visual.cursorColor,isAntiAlias:false}));
    }finally{context.restore();}
    this.paintSelectionLeaders(context);
  }
  private geometry(width:number):TextLayoutGeometry|null {
    const value=this.layoutValue;if(!value)return null;
    return this.measurements!.measure(this.layoutInput(width));
  }
  private preferredTextHeight(width:number):number {
    const policy=this.layoutValue;if(!policy)return this.height;
    const lineHeight=this.baselines?.lineHeight??this.height,min=policy.minLines??policy.maxLines,minHeight=lineHeight*(min??0);
    let preferred:number;
    if(policy.maxLines===null){preferred=width===Infinity?lineHeight*(1+hardLineBreaks(policy.input.text)):this.geometry(width)!.height;preferred=Math.max(minHeight,preferred);}
    else if(policy.maxLines===1)preferred=this.geometry(width)!.height;
    else if(min===policy.maxLines)preferred=minHeight;
    else preferred=Math.max(minHeight,Math.min(lineHeight*policy.maxLines,this.geometry(width)!.height));
    return Math.max(this.height,preferred);
  }
  /** Measured from the application's paragraph engine, independent of host caret observations. */
  set textBaselines(value:(Readonly<Record<TextBaseline,number>>&{readonly lineHeight:number})|null){if(value===null&&this.baselines===null||value&&this.baselines&&value.lineHeight===this.baselines.lineHeight&&value.alphabetic===this.baselines.alphabetic&&value.ideographic===this.baselines.ideographic)return;invariant(value===null||Object.values(value).every(v=>Number.isFinite(v)&&v>=0),'invalid-editor-baseline','Editor baselines must be finite and nonnegative');this.baselines=value;this.markNeedsLayout();}
  private baseline(width:number,height:number,baseline:TextBaseline):number|null{const geometry=this.geometry(width),distance=geometry?(baseline==='alphabetic'?geometry.alphabeticBaseline:geometry.ideographicBaseline):this.baselines?.[baseline];if(distance===undefined)return null;const lineHeight=geometry?.height??this.baselines!.lineHeight,top=this.layoutValue?.maxLines!==1&&this.layoutValue!==null?0:(height-lineHeight)/2;return Math.max(0,Math.min(height,top+distance));}
  protected override computeDryBaseline(constraints:BoxConstraints,baseline:TextBaseline):number|null{return this.baseline(constraints.maxWidth,this.computeDryLayout(constraints).height,baseline);}
  protected override computeDistanceToActualBaseline(baseline:TextBaseline):number|null{return this.baseline(this.size.width,this.size.height,baseline);}
  protected override computeMinIntrinsicWidth(_height:number):number{return this.geometry(Infinity)?.minIntrinsicWidth??0;}
  protected override computeMaxIntrinsicWidth(_height:number):number{return this.geometry(Infinity)?.maxIntrinsicWidth??0;}
  protected computeMinIntrinsicHeight(width:number):number{return this.preferredTextHeight(width);}
  protected computeMaxIntrinsicHeight(width:number):number{return this.preferredTextHeight(width);}
  protected computeDryLayout(constraints:BoxConstraints):Size{invariant(constraints.hasBoundedWidth,'unbounded-editor','EditableText needs bounded width');return constraints.constrain({width:constraints.maxWidth,height:this.layoutValue?.expands&&constraints.hasBoundedHeight?constraints.maxHeight:this.preferredTextHeight(constraints.maxWidth)});}
  protected performLayout(constraints:BoxConstraints):Size{
    invariant(!this.layoutValue?.expands||constraints.hasBoundedHeight,'unbounded-expanded-editor','Expanded editors require bounded height');const previousParagraph=this.paragraph,size=this.computeDryLayout(constraints);this.ensureParagraph(size.width);
    const reveal=this.caretRevealPending||previousParagraph!==this.paragraph||!this.hasSize||this.size.width!==size.width||this.size.height!==size.height;
    const multiline=this.layoutValue?.maxLines!==1,extent=multiline?size.height:size.width,maximum=this.paragraph?Math.max(0,multiline?this.paragraph.height-size.height:this.paragraph.maxIntrinsicWidth+(this.visual.cursorWidth??1)-size.width):0;
    this.offset.applyViewportDimension(extent);let accepted=false;for(let attempt=0;attempt<10;attempt++)if(this.offset.applyContentDimensions(0,maximum)){accepted=true;break;}invariant(accepted,'editable-scroll-dimension-correction','Editable scroll dimensions did not settle');
    this.caretRevealPending=reveal;return size;
  }
  override attach(owner:PipelineOwner):void{super.attach(owner);if(!this.observingOffset)try{this.offset.addListener(this.offsetChanged);this.observingOffset=true;}catch(error){super.detach();throw error;}}
  override detach():void{const errors:unknown[]=[];if(this.observingOffset){this.observingOffset=false;try{this.offset.removeListener(this.offsetChanged);}catch(error){errors.push(error);}}try{super.detach();}catch(error){errors.push(error);}if(!this.attached){this.paragraph=undefined;this.visualNavigation=undefined;this.textNavigationCache=undefined;try{this.measurements?._releaseLayoutResources();}catch(error){errors.push(error);}for(const leader of this.leaders)try{leader.dispose();}catch(error){errors.push(error);}}if(errors.length)throw new AggregateError(errors,'Editable detach failed');}
  override dispose():void{try{super.dispose();}finally{if(this.debugDisposed){this.visualNavigation=undefined;this.textNavigationCache=undefined;this.measurements?.dispose();this.measurements=undefined;this.paragraph=undefined;this.layoutValue=null;this.fixedOffset.dispose();for(const leader of this.leaders)leader.dispose();}}}
}
export class TextSelectionPoint {
  constructor(readonly point:Offset,readonly direction:'ltr'|'rtl'|null){protect(this,['point','direction']);}
  equals(other:unknown):boolean{return this===other||other instanceof TextSelectionPoint&&other.constructor===this.constructor&&other.point.equals(this.point)&&other.direction===this.direction;}
  get hashCode():number{return hashValues(this.point,this.direction);}
  toString():string{return this.direction===null?String(this.point):this.point+'-'+this.direction;}
}
