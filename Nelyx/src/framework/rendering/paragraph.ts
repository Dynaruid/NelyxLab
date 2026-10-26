// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {ParentData,ContainerParentDataMixin,RelayoutWhenSystemFontsChangeMixin,RenderBox,assertParentDataOffsetMutation} from './object.ts';import type {RenderObject,HitTestEntry,TextBaseline} from './object.ts';import {BoxConstraints} from './constraints.ts';
import {setSemanticsTransportProperties,describeTransportActions} from './semantics-transport.ts';
import {ChildLayoutHelper} from './layout-helper.ts';import type {ChildLayouter,ChildBaselineGetter} from './layout-helper.ts';
import {Matrix4} from '../../math/matrix4.ts';
import {FlutterError} from '../../foundation/flutter-error.ts';
import {DiagnosticsProperty,ErrorSummary,ErrorDescription,ErrorHint} from '../../foundation/diagnostics.ts';import type {DiagnosticPropertiesBuilder,DiagnosticsNode} from '../../foundation/diagnostics.ts';
import {EnumProperty,FlagProperty,IntProperty,DoubleProperty} from '../../foundation/diagnostic-properties.ts';
import {RenderParagraph as TransportParagraph} from './boxes.ts';
import {TextPainter} from '../painting/text-painter.ts';import type {TextPainterOptions,TextOverflow,TextWidthBasis} from '../painting/text-painter.ts';import type {InlineSpan} from '../painting/inline-span.ts';import {PlaceholderDimensions} from '../painting/placeholder-dimensions.ts';import {Size as SizeValue} from '../../ui/size.ts';import {collectInlinePlaceholders} from '../painting/inline-layout.ts';import {textLimits} from '../../ui/text.ts';import {TextStyle} from '../painting/text-style.ts';import {TextScaler} from '../painting/text-scaler.ts';
import type {ParagraphContext} from '../../ui/paragraph.ts';import type {Locale} from '../../ui/locale.ts';import type {StrutStyle} from '../painting/strut-style.ts';import type {TextAlign,TextHeightBehavior,Hyphens} from '../../ui/typography.ts';import type {SelectionRegistrar} from './selection.ts';import {Offset as OffsetValue} from '../../ui/offset.ts';import type {TextBox,BoxHeightStyle,BoxWidthStyle} from '../../ui/text-box.ts';import {valueEquals} from '../painting/value-equality.ts';
import {FoundationBuildMode} from '../../foundation/constants.ts';
import {copyResourceId} from '../../ui/resource-retention.ts';
import {Gradient} from '../../ui/shader.ts';import type {Shader} from '../../ui/shader.ts';
import {FoundationPlatform} from '../../foundation/platform.ts';
import type {PaintingContext} from '../painting/context.ts';import type {ResourceId,TextLayout,TextLayoutGeometry,SemanticsNode,Rect} from '../../ui/types.ts';
import {paragraphHasOverflow,paintParagraphOverflow} from './paragraph-overflow.ts';
import type {ParagraphLayoutOptions} from './paragraph-overflow.ts';
import {RenderComparison} from '../painting/basic-types.ts';
import {TextSpan} from '../painting/text-span.ts';
import {combineSemanticsInfo} from '../painting/inline-span.ts';
import type {InlineSpanSemanticsInformation} from '../painting/inline-span.ts';
import {TextSelection} from '../../services/text-editing.ts';
import {TapGestureRecognizer} from '../gestures/tap.ts';
import {DoubleTapGestureRecognizer} from '../gestures/multitap.ts';
import {LongPressGestureRecognizer} from '../gestures/long-press.ts';
import type {HitTestTarget} from '../gestures/hit-test.ts';
import {TextPosition} from '../../ui/text-position.ts';
import type {PlaceholderSpan} from '../painting/placeholder-span.ts';
import {SemanticsTag,SemanticsConfiguration,SemanticsNode as SourceSemanticsNode,OrdinalSortKey,ChildSemanticsConfigurationsResultBuilder} from '../semantics/semantics.ts';
import type {ChildSemanticsConfigurationsResult} from '../semantics/semantics.ts';
import {AttributedString} from '../semantics/attributed-string.ts';
import {TextRange} from '../../ui/text-range.ts';
import type {StringAttribute} from '../../ui/string-attribute.ts';
import {Rect as RectValue} from '../../ui/rect.ts';
import {UniqueKey} from '../../foundation/key.ts';
import type {Key} from '../../foundation/key.ts';
import {hashValues} from '../painting/value-equality.ts';
import {protect,checkedInteger} from '../../ui/value-math.ts';
import type {Size,Offset,TransformMatrix} from '../../ui/geometry.ts';import {multiply,translate,identity,contains,inversePaintTransform,transform,bounds,intersect,captureTransform} from '../../ui/geometry.ts';import {invariant} from '../../foundation/errors.ts';
export class PlaceholderSpanIndexSemanticsTag extends SemanticsTag {
  constructor(readonly index:number){super(`PlaceholderSpanIndexSemanticsTag(${checkedInteger(index)})`);protect(this,['index']);}
  equals(other:unknown):boolean{return other instanceof PlaceholderSpanIndexSemanticsTag&&other.index===this.index;}
  get hashCode():number{return hashValues(PlaceholderSpanIndexSemanticsTag,this.index);}
}
export class TextParentData extends ContainerParentDataMixin(ParentData) {
  private _offset:OffsetValue|null=null;
  get offset():OffsetValue|null{return this._offset;}
  span:PlaceholderSpan|null=null;
  /** @internal Visibility is determined only by source nullable placement. */get visible():boolean{return this._offset!==null;}
  /** @internal Only the inline container positions its children. */
  _setOffset(value:Offset|null):void{assertParentDataOffsetMutation();if(value!==null)invariant(Number.isFinite(value.x)&&Number.isFinite(value.y),'invalid-render-offset','Child offsets must be finite');this._offset=value===null?null:new OffsetValue(value.x,value.y);}
  override detach():void{this.span=null;this._offset=null;super.detach();}
  override toString():string{return `widget: ${this.span}, ${this.offset===null?'not laid out':`offset: ${this.offset}`}`;}
}
export interface InlineChildrenContainerDefaults {
  layoutInlineChildren(maxWidth:number,layoutChild:ChildLayouter,getChildBaseline:ChildBaselineGetter):readonly PlaceholderDimensions[];
  positionInlineChildren(boxes:readonly TextBox[]):void;
  defaultApplyPaintTransform(child:RenderBox,matrix:Matrix4):void;
  paintInlineChildren(context:PaintingContext,offset:Offset):void;
  hitTestInlineChildren(result:HitTestEntry[],position:Offset,toLocal?:TransformMatrix):boolean;
}
export type InlineChildrenConstructor<Base extends abstract new (...args:any[])=>RenderBox> = abstract new (...args:ConstructorParameters<Base>)=>InstanceType<Base>&InlineChildrenContainerDefaults;
/** Source inline-child behavior, usable by paragraph and editing renderers. */
export function RenderInlineChildrenContainerDefaults<Base extends abstract new (...args:any[])=>RenderBox>(Base:Base):InlineChildrenConstructor<Base>{
  abstract class InlineChildrenRender extends Base {
    override setupParentData(child:RenderObject):void{if(!(child.parentData instanceof TextParentData))child.parentData=new TextParentData();}
    layoutInlineChildren(maxWidth:number,layoutChild:ChildLayouter,getChildBaseline:ChildBaselineGetter):readonly PlaceholderDimensions[]{
      const constraints=new BoxConstraints(0,maxWidth);
      return this.children.map(child=>{const span=(child.parentData as TextParentData).span;if(FoundationBuildMode.debug)invariant(span!==null,'missing-placeholder-span','Inline child requires its PlaceholderSpan');if(span===null)return PlaceholderDimensions.empty;const size=layoutChild(child,constraints);return new PlaceholderDimensions({size:new SizeValue(size.width,size.height),alignment:span.alignment,baseline:span.baseline,baselineOffset:span.alignment==='baseline'?getChildBaseline(child,constraints,span.baseline!):null});});
    }
    positionInlineChildren(boxes:readonly TextBox[]):void{
      let index=0;for(const box of boxes){const child=this.children[index++];if(!child){if(FoundationBuildMode.debug)throw FlutterError.fromParts([new ErrorSummary('Invalid number of boxes provided to positionInlineChildren.'),new ErrorDescription(`The number of boxes (${boxes.length}) exceeds the number of child render objects (${this.children.length}). Each box corresponds to a child, but there are not enough children to position all boxes.`),new ErrorHint('This error typically occurs when a custom InlineSpan implementation returns a list of boxes that is longer than the number of inline children. Ensure that the number of boxes returned by `computeLineMetrics` or similar methods does not exceed the number of children.'),new DiagnosticsProperty('The RenderParagraph receiving the boxes',this,{style:'errorProperty'})]);return;}(child.parentData as TextParentData)._setOffset({x:box.left,y:box.top});}
      while(index<this.children.length)(this.children[index++]!.parentData as TextParentData)._setOffset(null);
    }
    defaultApplyPaintTransform(child:RenderBox,matrix:Matrix4):void{const offset=(child.parentData as TextParentData).offset;if(offset===null)matrix.setZero();else matrix.translateByDouble(offset.x,offset.y,0,1);}
    paintInlineChildren(context:PaintingContext,offset:Offset):void{for(const child of this.children){const childOffset=(child.parentData as TextParentData).offset;if(childOffset===null)return;context.paintChild(child,multiply(translate(childOffset.x+offset.x,childOffset.y+offset.y),child.localTransform));}}
    hitTestInlineChildren(result:HitTestEntry[],position:Offset,toLocal:TransformMatrix=identity):boolean{for(const child of this.children){const offset=(child.parentData as TextParentData).offset;if(offset===null)return false;const inverse=inversePaintTransform(multiply(translate(offset.x,offset.y),child.localTransform));if(inverse&&child.hitTest(transform(inverse,position),result,multiply(inverse,toLocal)))return true;}return false;}
  }
  return InlineChildrenRender as unknown as InlineChildrenConstructor<Base>;
}
export interface RichParagraphConfiguration {readonly span:InlineSpan;readonly style:TextStyle;readonly scaler:TextScaler;readonly placeholderCount:number;readonly font:ResourceId;readonly scale:number;readonly paragraphOptions?:ParagraphLayoutOptions;readonly painterOptions?:TextPainterOptions}
const ownedConfigurations=new WeakSet<RichParagraphConfiguration>();
/** @internal Capture consumed source fields once without enumerating borrowed metadata. */
export function captureRichParagraphConfiguration(value:RichParagraphConfiguration):RichParagraphConfiguration{
  if(ownedConfigurations.has(value))return value;
  const {span,style,scaler,placeholderCount,font,scale,paragraphOptions,painterOptions}=value;
  invariant(Number.isSafeInteger(placeholderCount)&&placeholderCount>=0&&placeholderCount<=textLimits.placeholders,'invalid-inline-child-count','Inline placeholder count exceeds the paragraph budget');
  const options:TextPainterOptions|undefined=painterOptions===undefined?undefined:Object.freeze({textAlign:painterOptions.textAlign??'start',textDirection:painterOptions.textDirection??'ltr',maxLines:painterOptions.maxLines??null,ellipsis:painterOptions.ellipsis??null,locale:painterOptions.locale??null,strutStyle:painterOptions.strutStyle??null,textWidthBasis:painterOptions.textWidthBasis??'parent',textHeightBehavior:painterOptions.textHeightBehavior??null,hyphens:painterOptions.hyphens??'manual'});
  const paragraph=paragraphOptions===undefined?undefined:Object.freeze({softWrap:paragraphOptions.softWrap??true,overflow:paragraphOptions.overflow??'clip',textWidthBasis:paragraphOptions.textWidthBasis??options?.textWidthBasis??'parent'});
  const captured=Object.freeze({span,style,scaler,placeholderCount,font:copyResourceId(font),scale,...paragraph===undefined?{}:{paragraphOptions:paragraph},...options===undefined?{}:{painterOptions:options}});ownedConfigurations.add(captured);return captured;
}
/** One engine paragraph with inline RenderBox children and scaled shared geometry. */
export class RenderRichParagraph extends RenderInlineChildrenContainerDefaults(TransportParagraph) {
  protected override get childCountLimit():number{return Infinity;}
  private configuration:RichParagraphConfiguration;
  private paintWidth:number|null=null;private paintDimensions:readonly PlaceholderDimensions[]=[];
  private intrinsicPainter:TextPainter|undefined;private canonicalTextSize:Size|undefined;private canonicalFade:Shader|undefined;
  private sourceSemanticsInfo:readonly InlineSpanSemanticsInformation[]|null=null;
  private cachedCombinedSemanticsInfo:readonly InlineSpanSemanticsInformation[]|null=null;
  private cachedAttributedLabels:AttributedString[]|null=null;
  private cachedChildSemanticsNodes:Map<Key,SourceSemanticsNode>|null=null;
  private collectedSemanticsNode:SourceSemanticsNode|null=null;
  private collectedPlaceholderNodes=new Map<string,SourceSemanticsNode>();
  private readonly spanNodeConfigurations=new WeakMap<SourceSemanticsNode,SemanticsConfiguration>();
  private readonly hostSpanIds=new WeakMap<SourceSemanticsNode,number>();
  private nextHostSpanId=0;
  constructor(configuration:RichParagraphConfiguration,context:ParagraphContext){configuration=captureRichParagraphConfiguration(configuration);const painter=new TextPainter({},context);super(painter);painter.validateResources({font:configuration.font});this.configuration=configuration;this.configurePainter(painter);}
  get config():RichParagraphConfiguration{return this.configuration;}
  set config(value:RichParagraphConfiguration){
    this.assertCanMutateLayoutProperty();value=captureRichParagraphConfiguration(value);this.painter.validateResources({font:value.font});const old=this.configuration,span=old.span.compareTo(value.span),style=old.style.compareTo(value.style),damage=span.index>style.index?span:style;
    this.configuration=value;if(old.span!==value.span){this.cachedCombinedSemanticsInfo=null;if(damage!==RenderComparison.metadata)this.cachedAttributedLabels=null;}this.configurePainter(this.painter);
    const layout=damage===RenderComparison.layout||this.painter._needsLayout||old.paragraphOptions?.softWrap!==value.paragraphOptions?.softWrap||old.paragraphOptions?.overflow!==value.paragraphOptions?.overflow,paint=damage===RenderComparison.paint;
    // compareTo describes layout/paint damage and deliberately omits locale,
    // labels and hover callbacks. Keep the incoming metadata in the live owner.
    if(!layout&&!paint&&damage===RenderComparison.identical){if(old.span!==value.span)this.markNeedsSemanticsUpdate();return;}
    if(layout){if(damage===RenderComparison.layout)this.clearOverflowShader();this.markNeedsLayout();if(damage===RenderComparison.layout)this.replaceSelectionFragments();}
    else {if(paint)this.markNeedsPaint();this.markNeedsSemanticsUpdate();}
  }
  override get plainText():string{return this.painter.plainText;}
  override get paragraphOptions():ParagraphLayoutOptions{return this.configuration.paragraphOptions??{};}
  override set paragraphOptions(value:ParagraphLayoutOptions){this.config={...this.configuration,paragraphOptions:value};}
  private configurePainter(painter:TextPainter,measurement=false):void{
    const c=this.configuration,o=c.painterOptions??{};painter._updateContext({...painter._paragraphContext,font:c.font,scale:c.scale,transient:measurement});
    painter.text=new TextSpan({style:c.style.merge(c.span.style),children:[c.span]});painter.textAlign=o.textAlign??'start';painter.textDirection=o.textDirection??'ltr';painter.textScaler=c.scaler;painter.maxLines=o.maxLines??null;painter.ellipsis=o.ellipsis??null;painter.locale=o.locale??null;painter.strutStyle=o.strutStyle??null;painter.textWidthBasis=c.paragraphOptions?.textWidthBasis??o.textWidthBasis??'parent';painter.textHeightBehavior=o.textHeightBehavior??null;painter.hyphens=o.hyphens??'manual';
  }
  protected setSourceConfiguration(value:RichParagraphConfiguration,damage:'paint'|'layout',clearOverflow=false):void{this.assertCanMutateLayoutProperty();this.painter.validateResources({font:value.font});this.configuration=value;this.configurePainter(this.painter);if(clearOverflow)this.clearOverflowShader();if(damage==='layout')this.markNeedsLayout();else this.markNeedsPaint();}
  protected ensureTextLayout():void{if(FoundationBuildMode.debug)invariant(!this.debugNeedsLayout,'paragraph-needs-layout','RenderParagraph queries require current layout');if(this.paintWidth!==null)this.paragraph=this.layoutCanonical(this.constraints,this.paintDimensions);}
  protected get hasOverflowShader():boolean{return this.canonicalFade!==undefined;}
  protected clearOverflowShader():void{const previous=this.canonicalFade;this.canonicalFade=undefined;previous?.dispose();}
  private updateCanonicalOverflow(size:Size):void{
    this.clearOverflowShader();
    if(this.configuration.paragraphOptions?.overflow!=='fade'||!paragraphHasOverflow(this.paragraph,size,this.canonicalTextSize!.width))return;
    const painter=new TextPainter({text:new TextSpan({text:'\u2026',style:this.painter.text?.style??null}),textDirection:this.painter.textDirection,textScaler:this.painter.textScaler,locale:this.painter.locale},{...this.painter._paragraphContext,transient:true});
    try{painter.layout();const horizontal=this.canonicalTextSize!.width>size.width,start=horizontal?new OffsetValue(this.textDirection==='rtl'?painter.width:size.width-painter.width,0):new OffsetValue(0,size.height-painter.height/2),end=horizontal?new OffsetValue(this.textDirection==='rtl'?0:size.width,0):new OffsetValue(0,size.height);this.canonicalFade=Gradient.linear(start,end,[0xffffffff,0x00ffffff]);}finally{painter.dispose();}
  }
  override getPositionForOffset(offset:Offset):TextPosition{this.ensureTextLayout();return super.getPositionForOffset(offset);}
  override getBoxesForSelection(selection:TextSelection,options:{readonly boxHeightStyle?:BoxHeightStyle;readonly boxWidthStyle?:BoxWidthStyle}={}):readonly TextBox[]{this.ensureTextLayout();return super.getBoxesForSelection(selection,options);}
  override getOffsetForCaret(position:TextPosition,prototype:{readonly width:number}):OffsetValue{this.ensureTextLayout();return super.getOffsetForCaret(position,prototype);}
  override getFullHeightForCaret(position:TextPosition):number{this.ensureTextLayout();return super.getFullHeightForCaret(position);}
  override getWordBoundary(position:TextPosition){this.ensureTextLayout();return super.getWordBoundary(position);}
  private adjustedWidth(width:number):number{return this.configuration.paragraphOptions?.softWrap===false&&this.configuration.paragraphOptions.overflow!=='ellipsis'?Infinity:width;}
  private canonicalProbe(constraints:BoxConstraints,intrinsic:'min'|'max'|null=null):TextLayoutGeometry{
    const painter=this.intrinsicPainter??=new TextPainter({}, {...this.painter._paragraphContext,transient:true});this.configurePainter(painter,true);
    try{painter.setPlaceholderDimensions(this.dimensions(constraints.maxWidth,true,intrinsic));painter.layout({minWidth:constraints.minWidth,maxWidth:intrinsic===null?this.adjustedWidth(constraints.maxWidth):Infinity});const {resource:_resource,input:_input,indexUnit:_indexUnit,...geometry}=painter._layoutSnapshot();return {...geometry,width:painter.width};}
    finally{painter.markNeedsLayout();} // RenderBox caches query values; engine probes keep one transient producer at most.
  }
  private layoutCanonical(constraints:BoxConstraints,dimensions:readonly PlaceholderDimensions[]):TextLayout{this.painter.setPlaceholderDimensions(dimensions);this.painter.layout({minWidth:constraints.minWidth,maxWidth:this.adjustedWidth(constraints.maxWidth)});this.canonicalTextSize=this.painter.size;this.paintOffsetX=this.painter._paintOffset;return this.painter._layoutSnapshot();}
  private dimensions(width:number,dry:boolean,intrinsic:'min'|'max'|null=null):readonly PlaceholderDimensions[]{invariant(this.children.length===this.configuration.placeholderCount,'inline-child-count','RichText child count differs from WidgetSpans');return this.layoutInlineChildren(width,intrinsic!==null?(child=>({width:intrinsic==='min'?child.getMinIntrinsicWidth(Infinity):child.getMaxIntrinsicWidth(Infinity),height:0})):dry?ChildLayoutHelper.dryLayoutChild:ChildLayoutHelper.layoutChild,dry||intrinsic!==null?ChildLayoutHelper.getDryBaseline:ChildLayoutHelper.getBaseline);}
  private inlineIntrinsicGeometry(minimum=false):TextLayoutGeometry{return this.canonicalProbe(new BoxConstraints(),minimum?'min':'max');}
  private geometry(constraints:BoxConstraints,dry:boolean):TextLayout|TextLayoutGeometry{if(dry)return this.canonicalProbe(constraints);const dimensions=this.dimensions(constraints.maxWidth,false),layout=this.layoutCanonical(constraints,dimensions);this.paintWidth=constraints.maxWidth;this.paintDimensions=dimensions;return layout;}
  protected override computeMinIntrinsicWidth(_height:number):number{return this.inlineIntrinsicGeometry(true).minIntrinsicWidth;}
  protected override computeMaxIntrinsicWidth(_height:number):number{return this.inlineIntrinsicGeometry().maxIntrinsicWidth;}
  protected override computeMinIntrinsicHeight(width:number):number{return this.geometry(BoxConstraints.tightFor(width),true).height;}
  protected override computeMaxIntrinsicHeight(width:number):number{return this.computeMinIntrinsicHeight(width);}
  protected override computeDryLayout(constraints:BoxConstraints):Size{const p=this.geometry(constraints,true);return constraints.constrain({width:p.width,height:p.height});}
  protected override computeDryBaseline(constraints:BoxConstraints,_baseline:TextBaseline):number{return this.geometry(constraints,true).alphabeticBaseline;}
  protected override computeDistanceToActualBaseline(_baseline:TextBaseline):number|null{if(this.paragraph)this.paragraph=this.layoutCanonical(this.constraints,this.paintDimensions);return this.paragraph?.alphabeticBaseline??null;}
  protected override performLayout(constraints:BoxConstraints):Size{this.invalidateSelectionLayout();this.paragraph=this.geometry(constraints,false) as TextLayout;this.positionInlineChildren(this.painter.inlinePlaceholderBoxes??[]);const size=constraints.constrain(this.painter.size);this.updateCanonicalOverflow(size);return size;}
  protected override childTransform(child:RenderObject):TransformMatrix{const matrix=Matrix4.identity();this.defaultApplyPaintTransform(child as RenderBox,matrix);return multiply(captureTransform(matrix.storage),child.localTransform);}
  override get hasVisualOverflow():boolean{return paragraphHasOverflow(this.paragraph,this.size,this.canonicalTextSize?.width);}
  override get clips():boolean{return this.hasVisualOverflow&&this.configuration.paragraphOptions?.overflow!=='visible';}
  override paint(context:PaintingContext,offset:Offset=OffsetValue.zero):void{if(offset.x===0&&offset.y===0){this.paintLocal(context);return;}context.save();try{context.translate(offset.x,offset.y);this.paintLocal(context);}finally{context.restore();}}
  protected paintLocal(context:PaintingContext):void{if(!this.paragraph)return;this.paragraph=this.layoutCanonical(this.constraints,this.paintDimensions);this.paintSelections(context);paintParagraphOverflow(context,this.paragraph,this.size,this.configuration.paragraphOptions??{},()=>{this.painter.paint(context.canvas,OffsetValue.zero);this.paragraph=this.painter._layoutSnapshot();this.paintInlineChildren(context,OffsetValue.zero);},this.canonicalTextSize?.width,this.canonicalFade);this.paintSelectionHandles(context);}
  override detach():void{const errors:unknown[]=[];try{super.detach();}catch(error){errors.push(error);}if(!this.attached){try{this.intrinsicPainter?._releaseLayoutResources();}catch(error){errors.push(error);}try{this.clearOverflowShader();}catch(error){errors.push(error);}}if(errors.length)throw new AggregateError(errors,'Rich paragraph detach failed');}
  override dispose():void{const errors:unknown[]=[];try{super.dispose();}catch(error){errors.push(error);}if(this.debugDisposed){const painter=this.intrinsicPainter,shader=this.canonicalFade;this.intrinsicPainter=undefined;this.canonicalFade=undefined;try{painter?.dispose();}catch(error){errors.push(error);}try{shader?.dispose();}catch(error){errors.push(error);}}if(errors.length===1)throw errors[0];if(errors.length)throw new AggregateError(errors,'Rich paragraph retirement failed');}
  protected override hitTestSelf():boolean{return true;}
  override hitTest(position:Offset,result:HitTestEntry[],toLocal:TransformMatrix=identity):boolean{invariant(this.hasSize&&!this.needsLayout,'missing-hit-test-size','RichText requires current layout before hit test');if(!contains({x:0,y:0,...this.size},position))return false;
    this.hitTestChildren(position,result,toLocal);result.push({target:this,transform:toLocal});return true;
  }
  hitTestChildren(position:Offset,result:HitTestEntry[],toLocal:TransformMatrix=identity):boolean{
    const glyph=this.paragraph?this.painter.getClosestGlyphForOffset(position):null,span=glyph!==null&&contains(glyph.graphemeClusterLayoutBounds,position)?this.configuration.span.getSpanForPosition(new TextPosition({offset:glyph.graphemeClusterCodeUnitRange.start})):null;
    if(span!==null&&'handleEvent' in span&&typeof span.handleEvent==='function'){result.push({target:span as InlineSpan&HitTestTarget,transform:toLocal});return true;}return this.hitTestInlineChildren(result,position,toLocal);
  }
  protected override get hasSourceSemanticsConfiguration():boolean{return true;}
  override describeSemanticsConfiguration(config:SemanticsConfiguration):void{
    super.describeSemanticsConfiguration(config);if(this.semantics&&(this.semantics.focusable||this.semantics.activate||this.semantics.actions)){describeTransportActions(config,this.semantics,()=>this.showOnScreen());config.isFocused=this.semantics.focused??(this.semantics.focusable?false:null);}this.sourceSemanticsInfo=this.configuration.span.getSemanticsInformation();let assemble=false,delegate=false;
    for(const info of this.sourceSemanticsInfo){if(info.recognizer!==null||info.semanticsIdentifier!==null){assemble=true;break;}delegate||=info.isPlaceholder;}
    if(assemble){config.explicitChildNodes=true;config.isSemanticBoundary=true;}
    else if(delegate)config.childConfigurationsDelegate=this.childSemanticsConfigurationsDelegate;
    else{if(this.cachedAttributedLabels===null){let text='',offset=0;const attributes:StringAttribute[]=[];for(const info of this.sourceSemanticsInfo){const label=info.semanticsLabel??info.text;for(const attribute of info.stringAttributes)attributes.push(attribute.copy({range:new TextRange({start:offset+attribute.range.start,end:offset+attribute.range.end})}));text+=label;offset+=label.length;}this.cachedAttributedLabels=[new AttributedString(text,{attributes})];}config.attributedLabel=this.cachedAttributedLabels[0]!;config.textDirection=this.textDirection;}
  }
  private readonly childSemanticsConfigurationsDelegate=(configs:readonly SemanticsConfiguration[]):ChildSemanticsConfigurationsResult=>{
    const builder=new ChildSemanticsConfigurationsResultBuilder();let placeholder=0,child=0,label=0;this.cachedCombinedSemanticsInfo??=combineSemanticsInfo(this.sourceSemanticsInfo!);
    for(const info of this.cachedCombinedSemanticsInfo){if(info.isPlaceholder){while(child<configs.length&&RenderRichParagraph.childConfigBelongsToPlaceholder(configs[child]!,placeholder))builder.markAsMergeUp(configs[child++]!);placeholder++;}else builder.markAsMergeUp(this.createSemanticsConfigForTextInfo(info,label++));}return builder.build();
  };
  private static childConfigBelongsToPlaceholder(config:SemanticsConfiguration,index:number):boolean{for(const tag of config.tagsForChildren??[])if(tag instanceof PlaceholderSpanIndexSemanticsTag)return tag.index===index;return false;}
  private createSemanticsConfigForTextInfo(info:InlineSpanSemanticsInformation,index:number):SemanticsConfiguration{
    if(FoundationBuildMode.debug)invariant(!info.requiresOwnNode,'owned-inline-semantics','An independent semantics span cannot merge as text');const labels=this.cachedAttributedLabels??=[];if(FoundationBuildMode.debug)invariant(index<=labels.length,'invalid-semantics-label-cache','Invalid attributed-label cache index');
    let label:AttributedString;if(index<labels.length)label=labels[index]!;else{label=new AttributedString(info.semanticsLabel??info.text,{attributes:info.stringAttributes});labels.push(label);}const config=new SemanticsConfiguration();config.textDirection=this.textDirection;config.attributedLabel=label;return config;
  }
  override assembleSemanticsNode(node:SourceSemanticsNode,config:SemanticsConfiguration,children:SourceSemanticsNode[]):void{
    if(FoundationBuildMode.debug)invariant(this.sourceSemanticsInfo!==null&&this.sourceSemanticsInfo.length>0,'missing-paragraph-semantics','Describe paragraph semantics before assembly');const next:SourceSemanticsNode[]=[],cache=new Map<Key,SourceSemanticsNode>();let direction=this.textDirection,ordinal=0,start=0,placeholder=0,childIndex=0,renderIndex=0;
    this.cachedCombinedSemanticsInfo??=combineSemanticsInfo(this.sourceSemanticsInfo!);
    for(const info of this.cachedCombinedSemanticsInfo){const selection=new TextSelection({baseOffset:start,extentOffset:start+info.text.length});start+=info.text.length;if(info.isPlaceholder){invariant(this.children[renderIndex]!==undefined,'missing-inline-render-child','A placeholder requires its render child');while(children.length>childIndex&&children[childIndex]!.isTagged(new PlaceholderSpanIndexSemanticsTag(placeholder))){const child=children[childIndex++]!,parentData=this.children[renderIndex]!.parentData as TextParentData;if(parentData.offset!==null)next.push(child);}renderIndex++;placeholder++;continue;}
      const initialDirection=direction,boxes=this.getBoxesForSelection(selection);if(boxes.length===0)continue;let rect=boxes[0]!.toRect();direction=boxes[0]!.direction;for(const box of boxes.slice(1)){rect=rect.expandToInclude(box.toRect());direction=box.direction;}rect=RectValue.fromLTWH(Math.max(0,rect.left),Math.max(0,rect.top),Math.min(rect.width,this.constraints.maxWidth),Math.min(rect.height,this.constraints.maxHeight));const currentRect=RectValue.fromLTRB(Math.floor(rect.left)-4,Math.floor(rect.top)-4,Math.ceil(rect.right)+4,Math.ceil(rect.bottom)+4),configuration=new SemanticsConfiguration();configuration.sortKey=new OrdinalSortKey(ordinal++);configuration.textDirection=initialDirection;configuration.identifier=info.semanticsIdentifier??'';configuration.attributedLabel=new AttributedString(info.semanticsLabel??info.text,{attributes:info.stringAttributes});
      const recognizer=info.recognizer;if(recognizer instanceof TapGestureRecognizer||recognizer instanceof DoubleTapGestureRecognizer){const handler=recognizer instanceof TapGestureRecognizer?recognizer.onTap:recognizer.onDoubleTap;if(handler!==null){configuration.onTap=handler;configuration.isLink=true;}}else if(recognizer instanceof LongPressGestureRecognizer){if(recognizer.onLongPress!==null)configuration.onLongPress=recognizer.onLongPress;}else if(FoundationBuildMode.debug)invariant(recognizer===null,'unsupported-span-recognizer','Unsupported inline semantics recognizer');
      if(node.parentPaintClipRect!==null)configuration.isHidden=node.parentPaintClipRect.intersect(currentRect).isEmpty&&!currentRect.isEmpty;let child:SourceSemanticsNode;if(this.cachedChildSemanticsNodes?.size){const key=this.cachedChildSemanticsNodes.keys().next().value!;child=this.cachedChildSemanticsNodes.get(key)!;this.cachedChildSemanticsNodes.delete(key);}else{const key=new UniqueKey();child=new SourceSemanticsNode({key,showOnScreen:()=>{const current=this.cachedChildSemanticsNodes!.get(key)!;this.showOnScreen(current.rect,{descendant:this});}});}child.updateWith({config:configuration});child.rect=currentRect;this.spanNodeConfigurations.set(child,configuration);let transportId=this.hostSpanIds.get(child);if(transportId===undefined){transportId=this.nextHostSpanId++;this.hostSpanIds.set(child,transportId);}setSemanticsTransportProperties(child,{id:(this.semantics?.id??this.semanticsId)+'-span-'+transportId,role:configuration.onTap?'button':'text',name:configuration.label,enabled:this.semantics?.enabled??true,...(configuration.onTap?{isLink:true,focusable:true}:{})});cache.set(child.key!,child);next.push(child);
    }
    if(FoundationBuildMode.debug){invariant(childIndex===children.length,'unused-inline-semantics-child','Not all inline semantics children were consumed');invariant(renderIndex===this.children.length,'unused-inline-render-child','Not all inline render children were consumed');}
    this.cachedChildSemanticsNodes=cache;node.updateWith({config,childrenInInversePaintOrder:next});
  }
  override clearSemantics():void{super.clearSemantics();this.collectedSemanticsNode?.updateWith({config:null});this.collectedSemanticsNode=null;this.collectedPlaceholderNodes.clear();this.cachedChildSemanticsNodes=null;}
  /** Current View DTO boundary. Source assembly owns span geometry and identity;
   * legacy inline widgets retain their complete existing transport payloads. */
  private collectAssembledSemantics(config:SemanticsConfiguration,matrix:TransformMatrix,clip:Rect|undefined):SemanticsNode[]{
    const node=this.collectedSemanticsNode??=new SourceSemanticsNode();node.rect=RectValue.fromLTWH(0,0,this.size.width,this.size.height);const inverse=inversePaintTransform(matrix),localRect=(rect:Rect):RectValue=>{const local=inverse?bounds(multiply(inverse,translate(rect.x,rect.y)),{width:rect.width,height:rect.height}):rect;return RectValue.fromLTWH(local.x,local.y,local.width,local.height);};node.parentPaintClipRect=clip?localRect(clip):null;
    const children:SourceSemanticsNode[]=[],payloads=new Map<SourceSemanticsNode,SemanticsNode>(),nextPlaceholders=new Map<string,SourceSemanticsNode>();
    for(let index=0;index<this.children.length;index++){const child=this.children[index]!;if((child.parentData as TextParentData).offset===null)continue;const values:SemanticsNode[]=[];child.collectSemantics(values,multiply(matrix,this.childTransform(child)),clip);for(const value of values){const source=this.collectedPlaceholderNodes.get(value.id)??new SourceSemanticsNode(),childConfig=new SemanticsConfiguration();childConfig.attributedLabel=new AttributedString(value.name,{attributes:value.nameAttributes??[]});childConfig.textDirection=this.textDirection;childConfig.identifier=value.semanticsIdentifier??'';childConfig.isButton=value.role==='button';childConfig.isLink=value.isLink??false;if(value.activate)childConfig.onTap=value.activate;if(value.actions?.['long-press'])childConfig.onLongPress=value.actions['long-press'];source.updateWith({config:childConfig});source.rect=localRect(value.bounds);
        // The flattened transport may include ancestor placeholder tags. This
        // boundary knows the direct render child and supplies that ownership.
        source.tags=new Set([new PlaceholderSpanIndexSemanticsTag(index),...(value.tags??[]).filter((tag):tag is SemanticsTag=>tag instanceof SemanticsTag&&!(tag instanceof PlaceholderSpanIndexSemanticsTag))]);children.push(source);payloads.set(source,value);nextPlaceholders.set(value.id,source);
      }}
    this.assembleSemanticsNode(node,config,children);this.collectedPlaceholderNodes=nextPlaceholders;const result:SemanticsNode[]=[],base=this.semantics!;
    node.visitChildren(child=>{const payload=payloads.get(child);if(payload){result.push(payload);return true;}const data=child.getSemanticsData();if(data.flagsCollection.isHidden)return true;const rect=bounds(multiply(matrix,translate(child.rect.left,child.rect.top)),{width:child.rect.width,height:child.rect.height});if(![rect.x,rect.y,rect.width,rect.height].every(Number.isFinite))return true;const clipped=clip?intersect(clip,rect):rect;if(clipped.width<=0||clipped.height<=0)return true;let id=this.hostSpanIds.get(child);if(id===undefined){id=this.nextHostSpanId++;this.hostSpanIds.set(child,id);}const spanConfig=this.spanNodeConfigurations.get(child)!,activate=spanConfig.onTap,longPress=spanConfig.onLongPress;
      result.push({id:base.id+'-span-'+id,role:activate?'button':'text',name:data.label,nameAttributes:data.attributedLabel.attributes,enabled:base.enabled,bounds:clipped,...data.identifier?{semanticsIdentifier:data.identifier}:{},...activate?{activate,isLink:true,focusable:true}:{},...longPress?{actions:{'long-press':longPress}}:{}});return true;});return result;
  }
  override collectSemantics(output:SemanticsNode[],matrix:TransformMatrix=identity,clip?:Rect):void{
    const own=bounds(matrix,this.size);if(![own.x,own.y,own.width,own.height].every(Number.isFinite))return;
    const next=this.clips?(clip?intersect(clip,own):own):clip,visible=clip?intersect(clip,own):own,children:SemanticsNode[]=[],base=this.semantics;
    if(!base||!this.paragraph){for(const child of this.children)if((child.parentData as TextParentData).visible)child.collectSemantics(children,multiply(matrix,this.childTransform(child)),next);output.push(...children);return;}
    if(visible.width<=0||visible.height<=0)return;
    const config=new SemanticsConfiguration();this.describeSemanticsConfiguration(config);
    if(config.explicitChildNodes){output.push({...base,role:'group',name:'',bounds:visible,children:this.collectAssembledSemantics(config,matrix,next)});return;}
    this.collectedSemanticsNode?.updateWith({config:null});this.collectedPlaceholderNodes.clear();
    if(config.childConfigurationsDelegate===null){output.push({...base,name:config.label,nameAttributes:config.attributedLabel.attributes,bounds:visible});return;}
    // Child-configuration merging belongs to the pending full View pipeline.
    // Until those legacy widgets produce source configurations, preserve their
    // existing ordered transport groups and opaque action ownership.
    const infos=combineSemanticsInfo(this.configuration.span.getSemanticsInformation());
    if(!infos.some(info=>info.requiresOwnNode)){const info=infos[0]!;output.push({...base,name:info.semanticsLabel??info.text,nameAttributes:info.stringAttributes,bounds:visible});return;}
    let start=0,placeholder=0,ordinal=0;
    for(const info of infos){
      const id=base.id+'-span-'+ordinal++;
      const end=start+info.text.length,selection=new TextSelection({baseOffset:start,extentOffset:end});start=end;
      if(info.isPlaceholder){const child=this.children[placeholder++]!;if((child.parentData as TextParentData).visible)child.collectSemantics(children,multiply(matrix,this.childTransform(child)),next);continue;}
      const boxes=this.painter.getBoxesForSelection(selection);if(!boxes.length)continue;
      const left=Math.min(...boxes.map(box=>box.left)),top=Math.min(...boxes.map(box=>box.top)),right=Math.max(...boxes.map(box=>box.right)),bottom=Math.max(...boxes.map(box=>box.bottom));
      // Source padding keeps the accessibility target outside glyph edges.
      const x=Math.floor(Math.max(0,left))-4,y=Math.floor(Math.max(0,top))-4,width=Math.ceil(Math.max(0,left)+Math.min(right-left,this.constraints.maxWidth))+4-x,height=Math.ceil(Math.max(0,top)+Math.min(bottom-top,this.constraints.maxHeight))+4-y;
      const rect=bounds(multiply(matrix,translate(x,y)),{width,height});if(![rect.x,rect.y,rect.width,rect.height].every(Number.isFinite))continue;const clipped=next?intersect(next,rect):rect;if(clipped.width<=0||clipped.height<=0)continue;
      const recognizer=info.recognizer,activate=recognizer instanceof TapGestureRecognizer?recognizer.onTap:recognizer instanceof DoubleTapGestureRecognizer?recognizer.onDoubleTap:null,longPress=recognizer instanceof LongPressGestureRecognizer?recognizer.onLongPress:null;
      children.push({id,role:activate?'button':'text',name:info.semanticsLabel??info.text,nameAttributes:info.stringAttributes,enabled:base.enabled,bounds:clipped,...info.semanticsIdentifier!==null?{semanticsIdentifier:info.semanticsIdentifier}:{},...activate?{activate,isLink:true,focusable:true}:{},...longPress?{actions:{'long-press':longPress}}:{}});
    }
    output.push({...base,role:'group',name:'',bounds:visible,children});
  }
}

export interface RenderParagraphOptions extends Omit<TextPainterOptions,'text'|'textDirection'|'ellipsis'> {
  readonly textDirection:'ltr'|'rtl';readonly softWrap?:boolean;readonly overflow?:TextOverflow;
  readonly children?:readonly RenderBox[];readonly selectionColor?:number|null;readonly registrar?:SelectionRegistrar|null;readonly devicePixelRatio?:number;
  /** @internal Existing Text/RichText ambient style adaptation. */readonly baseStyle?:TextStyle;
}
function sourceConfiguration(span:InlineSpan,o:RenderParagraphOptions,context:ParagraphContext):RichParagraphConfiguration{
  if(FoundationBuildMode.debug){invariant(span.debugAssertIsValid(),'invalid-inline-span','RenderParagraph text must be valid');invariant(o.maxLines==null||o.maxLines>0,'invalid-max-lines','maxLines must be positive');}
  if(FoundationBuildMode.debug)invariant(o.textScaler===undefined||(o.textScaleFactor??1)===1,'conflicting-text-scale','Use textScaler instead of textScaleFactor');
  const style=o.baseStyle??new TextStyle(),scaler=o.textScaler??TextScaler.linear(o.textScaleFactor??1),overflow=o.overflow??'clip',locale=o.locale??null,maxLines=o.maxLines??null;
  const painterOptions:TextPainterOptions={...o,textScaler:scaler,textScaleFactor:1,locale,maxLines,ellipsis:overflow==='ellipsis'?'\u2026':null};
  return {span,style,scaler,placeholderCount:collectInlinePlaceholders(span,style).length,font:copyResourceId(context.font),scale:context.scale,painterOptions,paragraphOptions:{softWrap:o.softWrap??true,overflow,textWidthBasis:o.textWidthBasis??'parent'}};
}
/** Source RenderParagraph API with explicit application text-engine ownership. */
export class RenderParagraph extends RelayoutWhenSystemFontsChangeMixin(RenderRichParagraph) {
  private pixelRatio:number;
  constructor(text:InlineSpan,options:RenderParagraphOptions,context:ParagraphContext,/** @internal */ captured?:RichParagraphConfiguration){const config=captured??sourceConfiguration(text,options,context);super(config,context);this.pixelRatio=options.devicePixelRatio??1;if(options.children)this.setChildren(options.children);this.registrar=options.registrar??null;this.selectionColor=options.selectionColor??null;this.semantics={id:this.semanticsId,role:'group',name:text.toPlainText().replaceAll('\ufffc',' '),enabled:true};}
  /** @internal Preserve the host's captured font and ambient style resolution. */
  static _fromConfiguration(config:RichParagraphConfiguration,context:ParagraphContext):RenderParagraph{
    config=captureRichParagraphConfiguration(config);
    return new RenderParagraph(config.span,{...config.painterOptions,textDirection:config.painterOptions?.textDirection??'ltr',baseStyle:config.style,textScaler:config.scaler,...config.paragraphOptions,devicePixelRatio:config.scale},context,config);
  }
  private sourceOptions():RenderParagraphOptions{const p=this.selectionPainter;return {baseStyle:this.config.style,textAlign:p.textAlign,textDirection:p.textDirection!,textScaler:p.textScaler,maxLines:p.maxLines,locale:p.locale,strutStyle:p.strutStyle,textWidthBasis:p.textWidthBasis,textHeightBehavior:p.textHeightBehavior,hyphens:p.hyphens,softWrap:this.softWrap,overflow:this.overflow,devicePixelRatio:this.pixelRatio};}
  private change(options:Partial<RenderParagraphOptions>,damage:'paint'|'layout'='layout',clearOverflow=false):void{this.setSourceConfiguration(sourceConfiguration(this.text,{...this.sourceOptions(),...options},this.selectionPainter._paragraphContext),damage,clearOverflow);}
  get text():InlineSpan{return this.config.span;}set text(value:InlineSpan){if(this.text.compareTo(value)===RenderComparison.identical)return;this.config=sourceConfiguration(value,this.sourceOptions(),this.selectionPainter._paragraphContext);}
  get textAlign():TextAlign{return this.selectionPainter.textAlign;}set textAlign(value:TextAlign){if(value!==this.textAlign)this.change({textAlign:value},'paint');}
  override get textDirection():'ltr'|'rtl'{return this.selectionPainter.textDirection!;}set textDirection(value:'ltr'|'rtl'){if(value!==this.textDirection)this.change({textDirection:value});}
  get softWrap():boolean{return this.paragraphOptions.softWrap??true;}set softWrap(value:boolean){if(value!==this.softWrap)this.change({softWrap:value});}
  get overflow():TextOverflow{return this.paragraphOptions.overflow??'clip';}set overflow(value:TextOverflow){if(value!==this.overflow)this.change({overflow:value});}
  get textScaler():TextScaler{return this.selectionPainter.textScaler;}set textScaler(value:TextScaler){if(!valueEquals(value,this.textScaler))this.change({textScaler:value},'layout',true);}
  get textScaleFactor():number{return this.textScaler.textScaleFactor;}set textScaleFactor(value:number){this.textScaler=TextScaler.linear(value);}
  get maxLines():number|null{return this.selectionPainter.maxLines;}set maxLines(value:number|null){if(value!==this.maxLines)this.change({maxLines:value},'layout',true);}
  get locale():Locale|null{return this.selectionPainter.locale;}set locale(value:Locale|null){if(!valueEquals(value,this.locale))this.change({locale:value},'layout',true);}
  get strutStyle():StrutStyle|null{return this.selectionPainter.strutStyle;}set strutStyle(value:StrutStyle|null){if(!valueEquals(value,this.strutStyle))this.change({strutStyle:value},'layout',true);}
  get textWidthBasis():TextWidthBasis{return this.selectionPainter.textWidthBasis;}set textWidthBasis(value:TextWidthBasis){if(value!==this.textWidthBasis)this.change({textWidthBasis:value},'layout',true);}
  get textHeightBehavior():TextHeightBehavior|null{return this.selectionPainter.textHeightBehavior;}set textHeightBehavior(value:TextHeightBehavior|null){if(!valueEquals(value,this.textHeightBehavior))this.change({textHeightBehavior:value},'layout',true);}
  get hyphens():Hyphens{return this.selectionPainter.hyphens;}set hyphens(value:Hyphens){if(value!==this.hyphens)this.change({hyphens:value},'layout',true);}
  get devicePixelRatio():number{return this.pixelRatio;}set devicePixelRatio(value:number){if(value===this.pixelRatio)return;this.pixelRatio=value;if(FoundationPlatform.hostEnvironment.kind==='web')this.markNeedsPaint();}
  get textSize():SizeValue{if(FoundationBuildMode.debug)invariant(!this.debugNeedsLayout,'paragraph-needs-layout','RenderParagraph requires layout before textSize');return this.selectionPainter.size;}
  get didExceedMaxLines():boolean{if(FoundationBuildMode.debug)invariant(!this.debugNeedsLayout,'paragraph-needs-layout','RenderParagraph requires layout before didExceedMaxLines');return this.selectionPainter.didExceedMaxLines;}
  override applyPaintTransform(child:RenderBox,matrix:Matrix4):void{this.defaultApplyPaintTransform(child,matrix);}
  override debugDescribeChildren():readonly DiagnosticsNode[]{return [this.text.toDiagnosticsNode({name:'text',style:'transition'})];}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new EnumProperty('textAlign',this.textAlign));properties.add(new EnumProperty('textDirection',this.textDirection));properties.add(new FlagProperty('softWrap',this.softWrap,{ifTrue:'wrapping at box width',ifFalse:'no wrapping except at line break characters',showName:true}));properties.add(new EnumProperty('overflow',this.overflow));properties.add(new DiagnosticsProperty('textScaler',this.textScaler,{defaultValue:TextScaler.noScaling}));properties.add(new DiagnosticsProperty('locale',this.locale,{defaultValue:null}));properties.add(new IntProperty('maxLines',this.maxLines,{ifNull:'unlimited'}));properties.add(new DoubleProperty('devicePixelRatio',this.devicePixelRatio,{defaultValue:1}));}
  get preferredLineHeight():number{return this.selectionPainter.preferredLineHeight;}
  get alwaysNeedsCompositing():boolean{return !!this.selectionFragments?.length;}
  get debugHasOverflowShader():boolean{return this.hasOverflowShader;}
  getLineBoundary(position:TextPosition){this.ensureTextLayout();return this.selectionPainter.getLineBoundary(position);}
  override systemFontsDidChange():void{super.systemFontsDidChange();this.selectionPainter.markNeedsLayout();}
}
