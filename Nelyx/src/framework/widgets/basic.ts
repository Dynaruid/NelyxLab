// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {RenderParagraph as SourceRenderParagraph} from '../rendering/paragraph.ts';
import {TextSpan} from '../painting/text-span.ts';
import {invariant} from '../../foundation/errors.ts';
import {Key,ValueKey,sameKey,KeyMap} from '../../foundation/key.ts';
import {FoundationBuildMode} from '../../foundation/constants.ts';
import {DiagnosticsProperty} from '../../foundation/diagnostics.ts';
import type {DiagnosticPropertiesBuilder} from '../../foundation/diagnostics.ts';
import {protect} from '../../ui/value-math.ts';
import type {Insets,TransformMatrix} from '../../ui/geometry.ts';
import {captureTransform} from '../../ui/geometry.ts';
import type {Rect} from '../../ui/types.ts';
import type {Clip} from '../../ui/clip.ts';
import type {ResourceId,TextLayoutInput} from '../../ui/types.ts';
import {BoxConstraints} from '../rendering/constraints.ts';
import {RenderSliverToBoxAdapter} from '../rendering/sliver.ts';
import {RenderIndexedSemantics} from '../rendering/indexed-semantics.ts';
import {RenderSliverPadding} from '../rendering/sliver-padding.ts';
import {SingleChildRenderObjectWidget as SourceSingleChildRenderObjectWidget} from './framework.ts';
import {RenderMetaData} from '../rendering/meta-data.ts';
import {HitTestBehavior} from '../rendering/pointer-listener.ts';
import type {RenderBox,RenderObject,TextBaseline} from '../rendering/object.ts';
import {RenderConstrainedBox,RenderPadding,RenderPositionedBox,RenderFlex,RenderStack,RenderDecoratedBox,RenderClip,RenderTransform,RenderParagraph,RenderImage,FlexParentData,StackParentData,RenderLimitedBox,RenderAspectRatio,RenderIntrinsicWidth,RenderIntrinsicHeight,RenderBaseline,RenderIgnoreBaseline} from '../rendering/boxes.ts';
import type {StackFit,MainAxisAlignment,CrossAxisAlignment,RenderFlexOptions,RelativeRect,TransformOptions} from '../rendering/boxes.ts';
import type {TextOverflow,TextWidthBasis} from '../painting/text-painter.ts';
import type {TextScaler} from '../painting/text-scaler.ts';
import type {TextStyle} from '../painting/text-style.ts';import type {StrutStyle} from '../painting/strut-style.ts';import type {TextAlign} from '../../ui/typography.ts';import {TextHeightBehavior} from '../../ui/typography.ts';
import {resolveTextConfiguration} from './text-input.ts';
import type {InlineSpan} from '../painting/inline-span.ts';import {RichText} from './rich-text.ts';
import {Alignment,AlignmentDirectional,AlignmentGeometry} from '../painting/alignment.ts';
import {EdgeInsets,EdgeInsetsGeometry} from '../painting/edge-insets.ts';
import {Decoration} from '../painting/decoration.ts';
import type {DecorationPosition} from '../painting/decoration.ts';
import {BoxDecoration} from '../painting/box-decoration.ts';
import {BorderRadius} from '../painting/border-radius.ts';
import type {BoxShape} from '../painting/box-border.ts';import {RenderPhysicalModel,RenderPhysicalShape} from '../rendering/clip.ts';import type {CustomClipper} from '../rendering/clip.ts';import type {Path} from '../../ui/path.ts';
import {ImageConfiguration} from '../painting/image-configuration.ts';
import {textLimits} from '../../ui/text.ts';
import {RenderProxyBox} from '../rendering/boxes.ts';
import {Paint} from '../../ui/paint.ts';
import {SelectionContainer} from './selection-container.ts';
import type {SelectionRegistrar} from '../rendering/selection.ts';
import {SelectableTextContainer} from './text-selection-container.ts';
import {DefaultSelectionStyle} from './default-selection-style.ts';
import {MouseRegion} from './mouse-region.ts';
import {SystemMouseCursors} from '../../services/mouse-cursor.ts';
import type {PaintingContext} from '../painting/context.ts';
import {RenderObjectWidget,StatelessWidget,ParentDataWidget,LeafRenderObjectElement,SingleChildRenderObjectElement,MultiChildRenderObjectElement} from './framework.ts';
import type {Widget,BuildContext,WidgetOptions} from './framework.ts';
import {MediaQuery,Directionality,Localizations,AppTheme} from './app-data.ts';
import type {MediaData} from './app-data.ts';
import {Axis,AxisDirection,textDirectionToAxisDirection,flipAxisDirection} from '../painting/basic-types.ts';
export function getAxisDirectionFromAxisReverseAndDirectionality(context:BuildContext,axis:Axis,reverse:boolean):AxisDirection{switch(axis){case Axis.horizontal:{const direction=textDirectionToAxisDirection(Directionality.of(context));return reverse?flipAxisDirection(direction):direction;}case Axis.vertical:return reverse?AxisDirection.up:AxisDirection.down;default:throw new TypeError('Unknown scroll Axis');}}
/** Implementations use one persistent RenderBox per Element. */
abstract class BoxWidget<R extends RenderBox> extends RenderObjectWidget {
  constructor(readonly childWidgets:readonly Widget[],key:Key|null=null,private readonly kind:'leaf'|'single'|'multi'='single'){super(key);}
  override createElement():LeafRenderObjectElement|SingleChildRenderObjectElement|MultiChildRenderObjectElement{return this.kind==='leaf'?new LeafRenderObjectElement(this):this.kind==='single'?new SingleChildRenderObjectElement(this):new MultiChildRenderObjectElement(this);}
  abstract make(context:BuildContext):R;
  abstract configure(render:R,context:BuildContext):void;
  createRenderObject(context:BuildContext):RenderBox {return this.make(context);}
  updateRenderObject(context:BuildContext,render:RenderBox):void {this.configure(render as R,context);}
}
export class MetaData extends BoxWidget<RenderMetaData> {
  readonly metaData:unknown;readonly behavior:HitTestBehavior;
  constructor(child?:Widget,{metaData=null,behavior=HitTestBehavior.deferToChild,key=null}:{readonly metaData?:unknown;readonly behavior?:HitTestBehavior;readonly key?:Key|null}={}){super(child?[child]:[],key);this.metaData=metaData;this.behavior=behavior;}
  make():RenderMetaData{return new RenderMetaData({metaData:this.metaData,behavior:this.behavior});}
  configure(render:RenderMetaData):void{render.metaData=this.metaData;render.behavior=this.behavior;}
}
export class Builder extends StatelessWidget {
  constructor(readonly builder:(context:BuildContext)=>Widget,options:WidgetOptions={}){super(options.key??null);}
  build(context:BuildContext):Widget{return this.builder(context);}
}
export class SizedBox extends BoxWidget<RenderConstrainedBox> {
  constructor(readonly width?:number,readonly height?:number,child?:Widget,key:Key|null=null){super(child?[child]:[],key);}
  static expand(child?:Widget,options:WidgetOptions={}):SizedBox{return new SizedBox(Infinity,Infinity,child,options.key??null);}
  static shrink(child?:Widget,options:WidgetOptions={}):SizedBox{return new SizedBox(0,0,child,options.key??null);}
  static fromSize(size?:{readonly width:number;readonly height:number}|null,child?:Widget,options:WidgetOptions={}):SizedBox{return new SizedBox(size?.width,size?.height,child,options.key??null);}
  static square(dimension?:number,child?:Widget,options:WidgetOptions={}):SizedBox{return new SizedBox(dimension,dimension,child,options.key??null);}
  make():RenderConstrainedBox {return new RenderConstrainedBox();}
  configure(render:RenderConstrainedBox):void {render.additional=BoxConstraints.tightFor(this.width,this.height);}
}
export class Padding extends BoxWidget<RenderPadding> {
  readonly padding:EdgeInsetsGeometry;
  constructor(padding:Insets|EdgeInsetsGeometry,child?:Widget,key:Key|null=null){super(child?[child]:[],key);this.padding=padding instanceof EdgeInsetsGeometry?padding:new EdgeInsets(padding.left,padding.top,padding.right,padding.bottom);}
  make():RenderPadding {return new RenderPadding(this.padding);}
  configure(render:RenderPadding,context:BuildContext):void {render.padding=this.padding;render.textDirection=context.maybeDependOn(Directionality)?.direction??null;}
}
/** Hosts supply measured insets; keep layout composition outside inherited-data definitions. */
export function safeArea(child:Widget,data:MediaData):Widget{return new Padding({...data.safeArea,bottom:Math.max(data.safeArea.bottom,data.keyboardInset)},child);}
export interface AlignOptions extends WidgetOptions {readonly alignment?:AlignmentGeometry|{readonly x:number;readonly y:number};readonly widthFactor?:number;readonly heightFactor?:number}
export class Align extends BoxWidget<RenderPositionedBox> {
  readonly alignment:AlignmentGeometry;readonly shrink:boolean;readonly widthFactor:number|undefined;readonly heightFactor:number|undefined;
  constructor(child:Widget|undefined,xOrOptions:number|AlignOptions=0,y=0,shrink=false,key:Key|null=null){const options=typeof xOrOptions==='number'?undefined:xOrOptions;super(child?[child]:[],options?.key??key);const value=options?.alignment;this.alignment=value instanceof AlignmentGeometry?value:new Alignment(value?.x??(typeof xOrOptions==='number'?xOrOptions:0),value?.y??y);this.shrink=shrink;this.widthFactor=options?.widthFactor;this.heightFactor=options?.heightFactor;}
  get x():number{return this.alignment.resolve('ltr').x;}get y():number{return this.alignment.resolve('ltr').y;}
  make():RenderPositionedBox {return new RenderPositionedBox();}
  configure(render:RenderPositionedBox,context:BuildContext):void {render.alignment=this.alignment;render.textDirection=context.maybeDependOn(Directionality)?.direction??'ltr';render.shrink=this.shrink;render.widthFactor=this.widthFactor;render.heightFactor=this.heightFactor;}
}
export class Center extends Align {constructor(child?:Widget,options:Omit<AlignOptions,'alignment'>={}){super(child,{...options,alignment:{x:0,y:0}});}}
export class ConstrainedBox extends BoxWidget<RenderConstrainedBox>{constructor(child:Widget|undefined,readonly constraints:BoxConstraints,options:WidgetOptions={}){super(child?[child]:[],options.key??null);constraints.debugAssertIsValid();}make():RenderConstrainedBox{return new RenderConstrainedBox(this.constraints);}configure(render:RenderConstrainedBox):void{render.additionalConstraints=this.constraints;}}
abstract class SizingWidget<R extends RenderBox> extends RenderObjectWidget {
  readonly childWidgets:readonly Widget[];
  constructor(child:Widget|undefined,key:Key|null){super(key);this.childWidgets=Object.freeze(child?[child]:[]);}
  get child():Widget|undefined{return this.childWidgets[0];}
  override createElement():SingleChildRenderObjectElement{return new SingleChildRenderObjectElement(this);}
  abstract make():R;
  abstract configure(render:R):void;
  createRenderObject(_context?:BuildContext):R{return this.make();}
  override updateRenderObject(_context:BuildContext,render:RenderBox):void{this.configure(render as R);}
}
export interface LimitedBoxOptions extends WidgetOptions {readonly maxWidth?:number;readonly maxHeight?:number}
export class LimitedBox extends SizingWidget<RenderLimitedBox> {
  readonly maxWidth:number;readonly maxHeight:number;readonly options:Readonly<LimitedBoxOptions>;
  constructor(child?:Widget,{key=null,maxWidth=Infinity,maxHeight=Infinity}:LimitedBoxOptions={}){invariant(typeof maxWidth==='number'&&typeof maxHeight==='number'&&maxWidth>=0&&maxHeight>=0,'invalid-size-limit','Size limits must be nonnegative');super(child,key);this.maxWidth=maxWidth;this.maxHeight=maxHeight;this.options=Object.freeze({key,maxWidth,maxHeight});}
  make():RenderLimitedBox{return new RenderLimitedBox({maxWidth:this.maxWidth,maxHeight:this.maxHeight});}
  configure(render:RenderLimitedBox):void{render.maxWidth=this.maxWidth;render.maxHeight=this.maxHeight;}
}
export interface AspectRatioOptions extends WidgetOptions {readonly aspectRatio:number}
export class AspectRatio extends SizingWidget<RenderAspectRatio> {
  readonly aspectRatio:number;
  constructor(child:Widget|undefined,options:AspectRatioOptions);
  constructor(child:Widget|undefined,aspectRatio:number,options?:WidgetOptions);
  constructor(child:Widget|undefined,value:number|AspectRatioOptions,options:WidgetOptions={}){const {key=null,aspectRatio}=typeof value==='number'?{key:options.key,aspectRatio:value}:value;invariant(typeof aspectRatio==='number'&&aspectRatio>0,'invalid-aspect-ratio','Aspect ratio must be positive');super(child,key);this.aspectRatio=aspectRatio;}
  make():RenderAspectRatio{return new RenderAspectRatio({aspectRatio:this.aspectRatio});}
  configure(render:RenderAspectRatio):void{render.aspectRatio=this.aspectRatio;}
}
export interface IntrinsicWidthOptions extends WidgetOptions {readonly stepWidth?:number|null;readonly stepHeight?:number|null}
export class IntrinsicWidth extends SizingWidget<RenderIntrinsicWidth> {
  readonly stepWidth:number|null;readonly stepHeight:number|null;readonly options:Readonly<IntrinsicWidthOptions>;
  constructor(child?:Widget,{key=null,stepWidth=null,stepHeight=null}:IntrinsicWidthOptions={}){invariant((stepWidth===null||typeof stepWidth==='number'&&stepWidth>=0)&&(stepHeight===null||typeof stepHeight==='number'&&stepHeight>=0),'invalid-intrinsic-step','Widget intrinsic steps must be null or nonnegative');super(child,key);this.stepWidth=stepWidth;this.stepHeight=stepHeight;this.options=Object.freeze({key,stepWidth,stepHeight});}
  private get _stepWidth():number|null{return this.stepWidth===0?null:this.stepWidth;}
  private get _stepHeight():number|null{return this.stepHeight===0?null:this.stepHeight;}
  make():RenderIntrinsicWidth{return new RenderIntrinsicWidth({stepWidth:this._stepWidth,stepHeight:this._stepHeight});}
  configure(render:RenderIntrinsicWidth):void{render.stepWidth=this._stepWidth;render.stepHeight=this._stepHeight;}
}
export class IntrinsicHeight extends SizingWidget<RenderIntrinsicHeight> {
  constructor(child?:Widget,{key=null}:WidgetOptions={}){super(child,key);}
  make():RenderIntrinsicHeight{return new RenderIntrinsicHeight();}
  configure(_render:RenderIntrinsicHeight):void{}
}
export interface BaselineOptions extends WidgetOptions {readonly baseline:number;readonly baselineType:TextBaseline}
export class Baseline extends SizingWidget<RenderBaseline> {
  readonly baseline:number;readonly baselineType:TextBaseline;
  constructor(child:Widget|undefined,options:BaselineOptions);
  constructor(child:Widget|undefined,baseline:number,baselineType:TextBaseline,options?:WidgetOptions);
  constructor(child:Widget|undefined,value:number|BaselineOptions,type?:TextBaseline,options:WidgetOptions={}){const {key=null,baseline,baselineType}=typeof value==='number'?{key:options.key,baseline:value,baselineType:type!}:value;super(child,key);this.baseline=baseline;this.baselineType=baselineType;}
  make():RenderBaseline{return new RenderBaseline({baseline:this.baseline,baselineType:this.baselineType});}
  configure(render:RenderBaseline):void{render.baseline=this.baseline;render.baselineType=this.baselineType;}
}
export class IgnoreBaseline extends SizingWidget<RenderIgnoreBaseline> {
  constructor(child?:Widget,{key=null}:WidgetOptions={}){super(child,key);}
  make():RenderIgnoreBaseline{return new RenderIgnoreBaseline();}
  configure(_render:RenderIgnoreBaseline):void{}
}

export interface FlexOptions extends RenderFlexOptions {readonly spacing?:number;readonly mainSize?:'min'|'max';readonly mainAxisSize?:'min'|'max';readonly crossAlign?:CrossAxisAlignment;readonly crossAxisAlignment?:CrossAxisAlignment;readonly mainAxisAlignment?:MainAxisAlignment;readonly key?:Key}
export class Flex extends BoxWidget<RenderFlex> {
  constructor(readonly direction:'horizontal'|'vertical',children:readonly Widget[],readonly options:FlexOptions={}) {super(Object.freeze([...children]),options.key??null,'multi');}
  make():RenderFlex {return new RenderFlex(this.direction);}
  configure(render:RenderFlex,context:BuildContext):void {render.direction=this.direction;render.spacing=this.options.spacing??0;render.mainAxisSize=this.options.mainAxisSize??this.options.mainSize??'max';render.crossAxisAlignment=this.options.crossAxisAlignment??this.options.crossAlign??'center';render.mainAxisAlignment=this.options.mainAxisAlignment??'start';render.textDirection=this.options.textDirection===undefined?context.maybeDependOn(Directionality)?.direction??'ltr':this.options.textDirection;render.verticalDirection=this.options.verticalDirection??'down';render.textBaseline=this.options.textBaseline??null;render.clipBehavior=this.options.clipBehavior??'none';}
}
export class Row extends Flex {constructor(children:readonly Widget[],options:FlexOptions={}){super('horizontal',children,options);}}
export class Column extends Flex {constructor(children:readonly Widget[],options:FlexOptions={}){super('vertical',children,options);}}
export class Flexible extends ParentDataWidget<FlexParentData> {
  readonly parentDataType=FlexParentData;
  constructor(child:Widget,readonly flex=1,readonly fit:'tight'|'loose'='loose',key:Key|null=null){super(child,{key});invariant(Number.isSafeInteger(flex)&&flex>=0&&(fit==='tight'||fit==='loose'),'invalid-flex','Flexible requires a nonnegative integer flex and valid fit');}
  get debugTypicalAncestorWidgetClass():Function{return Flex;}
  applyParentData(render:RenderObject):void {const data=render.parentData;invariant(data instanceof FlexParentData,'invalid-parent-data','Flexible requires FlexParentData');if(data.flex!==this.flex||data.fit!==this.fit){data.flex=this.flex;data.fit=this.fit;render.parent?.markNeedsLayout();}}
}
export class Expanded extends Flexible {constructor(child:Widget,flex=1,key:Key|null=null){super(child,flex,'tight',key);}}
export interface StackOptions {readonly alignment?:AlignmentGeometry|{readonly x:number;readonly y:number};readonly fit?:StackFit;readonly clipBehavior?:Clip;readonly key?:Key}
export class Stack extends BoxWidget<RenderStack> {
  readonly options:Omit<StackOptions,'alignment'>&{readonly alignment:AlignmentGeometry};
  get alignment():AlignmentGeometry{return this.options.alignment;}
  get fit():StackFit{return this.options.fit??'loose';}
  get clipBehavior():Clip{return this.options.clipBehavior??'hardEdge';}
  constructor(children:readonly Widget[],optionsOrKey:StackOptions|Key|null=null){const options=optionsOrKey instanceof Key?{key:optionsOrKey}:optionsOrKey??{},key=options.key;super(Object.freeze([...children]),key??null,'multi');const value=options.alignment??AlignmentDirectional.topStart,fit=options.fit,clipBehavior=options.clipBehavior;this.options=Object.freeze({alignment:value instanceof AlignmentGeometry?value:new Alignment(value.x,value.y),...(fit===undefined?{}:{fit}),...(clipBehavior===undefined?{}:{clipBehavior}),...(key===undefined?{}:{key})});}
  make():RenderStack{return new RenderStack();}
  configure(render:RenderStack,context:BuildContext):void{render.fit=this.options.fit??'loose';render.alignment=this.alignment;render.textDirection=context.maybeDependOn(Directionality)?.direction??'ltr';render.clipBehavior=this.options.clipBehavior??'hardEdge';}
}
export interface PositionedOptions {readonly left?:number;readonly top?:number;readonly right?:number;readonly bottom?:number;readonly width?:number;readonly height?:number;readonly key?:Key}
export class Positioned extends ParentDataWidget<StackParentData> {
  readonly parentDataType=StackParentData;
  get left():number|undefined{return this.options.left;}get top():number|undefined{return this.options.top;}
  get right():number|undefined{return this.options.right;}get bottom():number|undefined{return this.options.bottom;}
  get width():number|undefined{return this.options.width;}get height():number|undefined{return this.options.height;}
  constructor(child:Widget,readonly options:PositionedOptions={}){super(child,{key:options.key??null});
    invariant(Object.entries(options).every(([name,value])=>name==='key'||value===undefined||typeof value==='number'&&Number.isFinite(value)&&(!['width','height'].includes(name)||value>=0)),'invalid-position','Positioned requires finite offsets and nonnegative extents');
    invariant(!(options.left!==undefined&&options.right!==undefined&&options.width!==undefined)&&!(options.top!==undefined&&options.bottom!==undefined&&options.height!==undefined),'invalid-position','Each positioned axis accepts at most two of its edges/extent');
  }
  get debugTypicalAncestorWidgetClass():Function{return Stack;}
  static fill(child:Widget,options:Omit<PositionedOptions,'width'|'height'>={}):Positioned{return new Positioned(child,{left:0,top:0,right:0,bottom:0,...options});}
  static fromRect(child:Widget,rect:Rect,options:WidgetOptions={}):Positioned{return new Positioned(child,{left:rect.x,top:rect.y,width:rect.width,height:rect.height,...(options.key?{key:options.key}:{})});}
  static fromRelativeRect(child:Widget,rect:RelativeRect,options:WidgetOptions={}):Positioned{return new Positioned(child,{left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,...(options.key?{key:options.key}:{})});}
  static directional(child:Widget,options:PositionedDirectionalOptions&{readonly textDirection:'ltr'|'rtl'}):Positioned{const {start,end,textDirection,...rest}=options;invariant(textDirection==='ltr'||textDirection==='rtl','invalid-text-direction','Positioned.directional requires ltr or rtl');return new Positioned(child,{...rest,...(start!==undefined?{[textDirection==='ltr'?'left':'right']:start}:{}),...(end!==undefined?{[textDirection==='ltr'?'right':'left']:end}:{})});}
  applyParentData(render:RenderObject):void {const data=render.parentData;invariant(data instanceof StackParentData,'invalid-parent-data','Positioned requires StackParentData');let changed=false;for(const name of ['left','top','right','bottom','width','height'] as const)if(data[name]!==this.options[name]){data[name]=this.options[name];changed=true;}if(changed)render.parent?.markNeedsLayout();}
}
export interface PositionedDirectionalOptions extends Omit<PositionedOptions,'left'|'right'> {readonly start?:number;readonly end?:number}
export class PositionedDirectional extends StatelessWidget {
  get start():number|undefined{return this.options.start;}get end():number|undefined{return this.options.end;}
  get top():number|undefined{return this.options.top;}get bottom():number|undefined{return this.options.bottom;}
  get width():number|undefined{return this.options.width;}get height():number|undefined{return this.options.height;}
  constructor(readonly child:Widget,readonly options:PositionedDirectionalOptions={}){super(options.key??null);}
  build(context:BuildContext):Widget{const {key:_key,...options}=this.options;return Positioned.directional(this.child,{...options,textDirection:context.dependOn(Directionality).direction});}
}
export interface DecoratedBoxOptions extends WidgetOptions {readonly decoration:Decoration;readonly position?:DecorationPosition}
export class DecoratedBox extends BoxWidget<RenderDecoratedBox> {
  readonly decoration:Decoration;readonly position:DecorationPosition;readonly color:number|null;readonly radius:number;
  constructor(child:Widget|undefined,options:DecoratedBoxOptions);
  constructor(child:Widget|undefined,color:number,radius?:number,key?:Key|null);
  constructor(child:Widget|undefined,value:number|DecoratedBoxOptions,radius=0,key:Key|null=null){const options=typeof value==='number'?null:value;super(child?[child]:[],options?.key??key);this.color=typeof value==='number'?value:null;this.radius=radius;this.decoration=options?.decoration??new BoxDecoration({color:this.color,borderRadius:radius>0?BorderRadius.circular(radius):null});this.position=options?.position??'background';this.decoration.debugAssertIsValid();}
  make():RenderDecoratedBox{return new RenderDecoratedBox(this.decoration);}
  configure(render:RenderDecoratedBox,context:BuildContext):void{render.decoration=this.decoration;render.position=this.position;render.configuration=new ImageConfiguration({images:context.services.images??null,textDirection:context.maybeDependOn(Directionality)?.direction??null,devicePixelRatio:context.services.readMetrics('scale').scale,locale:context.maybeDependOn(Localizations)?.locale??null});}
  override updateRenderObject(context:BuildContext,render:RenderBox):void{this.configure(render as RenderDecoratedBox,context);}
}
export class ClipRect extends BoxWidget<RenderClip> {
  constructor(child:Widget,key:Key|null=null){super([child],key);}
  make():RenderClip{return new RenderClip();}configure():void {}
}
export interface TransformFactoryOptions extends TransformOptions,WidgetOptions {}
export interface TransformScaleOptions extends TransformFactoryOptions {readonly scale?:number|null;readonly scaleX?:number|null;readonly scaleY?:number|null}
export interface TransformFlipOptions extends Omit<TransformFactoryOptions,'alignment'> {readonly flipX?:boolean;readonly flipY?:boolean}
export type TransformTranslateOptions=Omit<TransformFactoryOptions,'origin'|'alignment'>;
export class Transform extends BoxWidget<RenderTransform> {
  readonly matrix:TransformMatrix;readonly options:Omit<TransformOptions,'alignment'>&{readonly alignment?:AlignmentGeometry|null};
  constructor(child:Widget|undefined,matrix:readonly number[]|Float64Array,key:Key|null=null,options:TransformOptions={}){super(child?[child]:[],key);this.matrix=captureTransform(matrix);invariant(Object.keys(options).every(key=>['origin','alignment','textDirection','transformHitTests','filterQuality'].includes(key)),'unsupported-transform','Unknown transform option');const origin=options.origin,alignment=options.alignment,direction=options.textDirection;this.options=Object.freeze({origin:origin?Object.freeze({x:origin.x,y:origin.y}):null,alignment:alignment?alignment instanceof AlignmentGeometry?alignment:new Alignment(alignment.x,alignment.y):null,...(direction===undefined?{}:{textDirection:direction}),transformHitTests:options.transformHitTests??true,filterQuality:options.filterQuality??null});}
  static rotate(child:Widget|undefined,angle:number,options:TransformFactoryOptions={}):Transform {const {key,...rest}=options;return new Transform(child,Transform._computeRotation(angle),key??null,{...rest,alignment:rest.alignment===undefined?Alignment.center:rest.alignment});}
  static translate(child:Widget|undefined,offset:{readonly x:number;readonly y:number},options:TransformTranslateOptions={}):Transform {const {key,...rest}=options;return new Transform(child,[1,0,0,0,0,1,0,0,0,0,1,0,offset.x,offset.y,0,1],key??null,rest);}
  static scale(child:Widget|undefined,options:TransformScaleOptions):Transform {const {key,scale,scaleX,scaleY,...rest}=options;invariant(scale!=null||scaleX!=null||scaleY!=null,'invalid-transform-scale','At least one of scale, scaleX and scaleY must be non-null');invariant(scale==null||scaleX==null&&scaleY==null,'invalid-transform-scale','Uniform scale cannot be combined with scaleX or scaleY');return new Transform(child,[scale??scaleX??1,0,0,0,0,scale??scaleY??1,0,0,0,0,1,0,0,0,0,1],key??null,{...rest,alignment:rest.alignment===undefined?Alignment.center:rest.alignment});}
  static flip(child?:Widget,options:TransformFlipOptions={}):Transform {const {key,flipX=false,flipY=false,...rest}=options;invariant(typeof flipX==='boolean'&&typeof flipY==='boolean','invalid-transform-flip','Flip flags must be boolean');return new Transform(child,[flipX?-1:1,0,0,0,0,flipY?-1:1,0,0,0,0,1,0,0,0,0,1],key??null,{...rest,alignment:Alignment.center});}
  private static _computeRotation(radians:number):TransformMatrix {invariant(Number.isFinite(radians),'invalid-transform-angle','Rotation angle must be finite');if(radians===0)return captureTransform([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);const sin=Math.sin(radians);if(sin===1)return Transform._createZRotation(1,0);if(sin===-1)return Transform._createZRotation(-1,0);const cos=Math.cos(radians);if(cos===-1)return Transform._createZRotation(0,-1);return Transform._createZRotation(sin,cos);}
  private static _createZRotation(sin:number,cos:number):TransformMatrix {return captureTransform([cos,sin,0,0,-sin,cos,0,0,0,0,1,0,0,0,0,1]);}
  get transform():TransformMatrix{return this.matrix;}
  get origin():import('../../ui/geometry.ts').Offset|null{return this.options.origin??null;}
  get alignment():AlignmentGeometry|null{return this.options.alignment??null;}
  get transformHitTests():boolean{return this.options.transformHitTests??true;}
  get filterQuality():import('../../ui/paint-effects-data.ts').FilterQuality|null{return this.options.filterQuality??null;}
  make():RenderTransform{return new RenderTransform(this.matrix,this.options);}configure(render:RenderTransform,context:BuildContext):void{render.matrix=this.matrix;render.origin=this.options.origin??null;render.alignment=this.options.alignment??null;render.textDirection=this.options.textDirection===undefined?context.maybeDependOn(Directionality)?.direction??null:this.options.textDirection;render.transformHitTests=this.options.transformHitTests??true;render.filterQuality=this.options.filterQuality??null;}
  override updateRenderObject(context:BuildContext,render:RenderBox):void{this.configure(render as RenderTransform,context);}
}
export interface TextOptions {readonly font?:ResourceId;readonly fontId?:string;readonly fontSize?:number;readonly locale?:string;readonly direction?:'ltr'|'rtl';readonly textScale?:number;readonly textScaler?:TextScaler;readonly color?:number;readonly maxLines?:number;readonly softWrap?:boolean;readonly overflow?:TextOverflow;readonly textWidthBasis?:TextWidthBasis;readonly ellipsis?:string;readonly key?:Key;readonly style?:TextStyle;readonly textAlign?:TextAlign;readonly strutStyle?:StrutStyle;readonly textHeightBehavior?:TextHeightBehavior;readonly selectionColor?:number|null}
const plainTextSemantics=new WeakSet<object>();
export class Text extends StatelessWidget {
  constructor(readonly text:string,readonly options:TextOptions={}){super(options.key??null);}
  static rich(span:InlineSpan,options:TextOptions={}):Widget{return new RichTextFromText(span,options);}
  build(context:BuildContext):Widget{return buildTextSelection(context,this.options,(childContext,key,registrar,color)=>new PlainTextWidget(this,key,registrar,color));}
  make(context:BuildContext):RenderParagraph{const resolved=resolveTextConfiguration(context,this.options);return SourceRenderParagraph._fromConfiguration({...resolved,span:new TextSpan({text:this.text}),placeholderCount:0},{text:context.services.text,resources:context.services.resources,font:resolved.font,scale:resolved.scale});}
  configure(render:RenderParagraph,context:BuildContext):void{const resolved=resolveTextConfiguration(context,this.options);invariant(render instanceof SourceRenderParagraph,'invalid-text-renderer','Text requires a source RenderParagraph; custom Text renderers must override configure');render.config={...resolved,span:new TextSpan({text:this.text}),placeholderCount:0};render.devicePixelRatio=resolved.scale;const previous=render.semantics;if(Object.getPrototypeOf(render)===SourceRenderParagraph.prototype&&previous&&plainTextSemantics.has(previous)&&previous.id===render.semanticsId&&previous.name===this.text)return;const semantics=Object.freeze({id:render.semanticsId,role:'text' as const,name:this.text,enabled:true});plainTextSemantics.add(semantics);render.semantics=semantics;}
}
class PlainTextWidget extends BoxWidget<RenderParagraph> {
  constructor(readonly textWidget:Text,key:Key|null,readonly registrar:SelectionRegistrar|null,readonly selectionColor:number){super([],key,'leaf');}
  make(context:BuildContext):RenderParagraph{const render=this.textWidget.make(context);render.registrar=this.registrar;render.selectionColor=this.selectionColor;return render;}
  configure(render:RenderParagraph,context:BuildContext):void{this.textWidget.configure(render,context);render.registrar=this.registrar;render.selectionColor=this.selectionColor;}
}
function buildTextSelection(context:BuildContext,options:TextOptions,create:(context:BuildContext,key:Key|null,registrar:SelectionRegistrar|null,color:number)=>Widget):Widget{const style=DefaultSelectionStyle.of(context),color=options.selectionColor??style.selectionColor??DefaultSelectionStyle.defaultColor;if(SelectionContainer.maybeOf(context)!==null)return new MouseRegion(new SelectableTextContainer((childContext,key)=>create(childContext,key,SelectionContainer.maybeOf(childContext),color)),{cursor:style.mouseCursor??SystemMouseCursors.text});return create(context,null,null,color);}
export interface ColoredBoxOptions extends WidgetOptions {readonly color:number;readonly isAntiAlias?:boolean;readonly child?:Widget|null}
export interface PhysicalModelOptions extends WidgetOptions {readonly child?:Widget|null;readonly shape?:BoxShape;readonly clipBehavior?:Clip;readonly borderRadius?:BorderRadius|null;readonly elevation?:number;readonly color:number;readonly shadowColor?:number}
export class PhysicalModel extends SourceSingleChildRenderObjectWidget {
  readonly shape:BoxShape;readonly clipBehavior:Clip;readonly borderRadius:BorderRadius|null;readonly elevation:number;readonly color:number;readonly shadowColor:number;
  constructor({key=null,child=null,shape='rectangle',clipBehavior='none',borderRadius=null,elevation=0,color,shadowColor=0xff000000}:PhysicalModelOptions){super(child??undefined,{key});if(FoundationBuildMode.debug)invariant(elevation>=0,'invalid-elevation','PhysicalModel elevation must be nonnegative');this.shape=shape;this.clipBehavior=clipBehavior;this.borderRadius=borderRadius;this.elevation=elevation;this.color=color;this.shadowColor=shadowColor;protect(this,['shape','clipBehavior','borderRadius','elevation','color','shadowColor']);}
  createRenderObject(context:BuildContext):RenderPhysicalModel{return new RenderPhysicalModel({shape:this.shape,clipBehavior:this.clipBehavior,borderRadius:this.borderRadius,elevation:this.elevation,color:this.color,shadowColor:this.shadowColor,readDevicePixelRatio:()=>context.services.readMetrics('scale').scale});}
  override updateRenderObject(_context:BuildContext,render:RenderObject):void{invariant(render instanceof RenderPhysicalModel,'invalid-physical-render','PhysicalModel requires RenderPhysicalModel');render.shape=this.shape;render.clipBehavior=this.clipBehavior;render.borderRadius=this.borderRadius;render.elevation=this.elevation;render.color=this.color;render.shadowColor=this.shadowColor;}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new DiagnosticsProperty('shape',this.shape));properties.add(new DiagnosticsProperty('borderRadius',this.borderRadius));properties.add(new DiagnosticsProperty('elevation',this.elevation));properties.add(new DiagnosticsProperty('color',this.color));properties.add(new DiagnosticsProperty('shadowColor',this.shadowColor));}
}
export interface PhysicalShapeOptions extends WidgetOptions {readonly child?:Widget|null;readonly clipper:CustomClipper<Path>;readonly clipBehavior?:Clip;readonly elevation?:number;readonly color:number;readonly shadowColor?:number}
export class PhysicalShape extends SourceSingleChildRenderObjectWidget {
  readonly clipper:CustomClipper<Path>;readonly clipBehavior:Clip;readonly elevation:number;readonly color:number;readonly shadowColor:number;
  constructor({key=null,child=null,clipper,clipBehavior='none',elevation=0,color,shadowColor=0xff000000}:PhysicalShapeOptions){super(child??undefined,{key});if(FoundationBuildMode.debug)invariant(elevation>=0,'invalid-elevation','PhysicalShape elevation must be nonnegative');this.clipper=clipper;this.clipBehavior=clipBehavior;this.elevation=elevation;this.color=color;this.shadowColor=shadowColor;protect(this,['clipper','clipBehavior','elevation','color','shadowColor']);}
  createRenderObject(context:BuildContext):RenderPhysicalShape{return new RenderPhysicalShape({clipper:this.clipper,clipBehavior:this.clipBehavior,elevation:this.elevation,color:this.color,shadowColor:this.shadowColor,readDevicePixelRatio:()=>context.services.readMetrics('scale').scale,...context.services.paths?{paths:context.services.paths}:{}});}
  override updateRenderObject(_context:BuildContext,render:RenderObject):void{invariant(render instanceof RenderPhysicalShape,'invalid-physical-render','PhysicalShape requires RenderPhysicalShape');render.clipper=this.clipper;render.clipBehavior=this.clipBehavior;render.elevation=this.elevation;render.color=this.color;render.shadowColor=this.shadowColor;}
  override didUnmountRenderObject(render:RenderObject):void{invariant(render instanceof RenderPhysicalShape,'invalid-physical-render','PhysicalShape requires RenderPhysicalShape');render.clipper=null;}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new DiagnosticsProperty('clipper',this.clipper));properties.add(new DiagnosticsProperty('elevation',this.elevation));properties.add(new DiagnosticsProperty('color',this.color));properties.add(new DiagnosticsProperty('shadowColor',this.shadowColor));}
}
export class ColoredBox extends SourceSingleChildRenderObjectWidget {
  readonly color:number;readonly isAntiAlias:boolean;
  constructor({key=null,color,isAntiAlias=true,child=null}:ColoredBoxOptions){super(child??undefined,{key});this.color=color;this.isAntiAlias=isAntiAlias;protect(this,['color','isAntiAlias']);}
  createRenderObject(_context:BuildContext):RenderColoredBox{return new RenderColoredBox(this.color,this.isAntiAlias);}
  override updateRenderObject(_context:BuildContext,render:RenderObject):void{invariant(render instanceof RenderColoredBox,'invalid-colored-box-render','ColoredBox requires its own render object');render.color=this.color;render.isAntiAlias=this.isAntiAlias;}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new DiagnosticsProperty('color',this.color));properties.add(new DiagnosticsProperty('isAntiAlias',this.isAntiAlias));}
}
class RenderColoredBox extends RenderProxyBox {
  constructor(private currentColor:number,private antiAlias:boolean){super();}
  get color():number{return this.currentColor;}set color(value:number){if(value===this.currentColor)return;this.assertCanMutateLayoutProperty();this.currentColor=value;this.markNeedsPaint();}
  get isAntiAlias():boolean{return this.antiAlias;}set isAntiAlias(value:boolean){if(value===this.antiAlias)return;this.assertCanMutateLayoutProperty();this.antiAlias=value;this.markNeedsPaint();}
  protected override hitTestSelf(_position:import('../../ui/geometry.ts').Offset):boolean{return true;}
  override paint(context:PaintingContext):void{if(this.size.width>0&&this.size.height>0)context.drawRect({x:0,y:0,...this.size},new Paint({color:this.currentColor,isAntiAlias:this.antiAlias}));super.paint(context);}
}
class RichTextFromText extends StatelessWidget {
  constructor(readonly span:InlineSpan,readonly options:TextOptions){super(options.key??null);}
  build(context:BuildContext):Widget{const resolved=resolveTextConfiguration(context,this.options),{textScale:_scale,textScaler:_scaler,key:_key,...options}=this.options;return buildTextSelection(context,this.options,(_childContext,key,registrar,color)=>new RichText(this.span,{...options,...(key?{key}:{}),...resolved.paragraphOptions,...(resolved.painterOptions.maxLines!=null?{maxLines:resolved.painterOptions.maxLines}:{}),textAlign:resolved.painterOptions.textAlign!,...(resolved.painterOptions.textHeightBehavior?{textHeightBehavior:new TextHeightBehavior(resolved.painterOptions.textHeightBehavior)}:{}),style:resolved.style,textScaler:resolved.scaler,selectionRegistrar:registrar,selectionColor:color}));}
}
export class Image extends BoxWidget<RenderImage> {
  constructor(readonly asset:string|ResourceId,readonly width:number,readonly height:number,key:Key|null=null){super([],key,'leaf');}
  private resource(context:BuildContext):ResourceId {const resource=typeof this.asset==='string'?context.services.assets.get(this.asset):this.asset;invariant(resource,'missing-image','Image asset not declared');return resource;}
  make(context:BuildContext):RenderImage{return new RenderImage(this.resource(context),this.width,this.height);}
  configure(render:RenderImage,context:BuildContext):void{const resource=this.resource(context),layout=render.width!==this.width||render.height!==this.height,paint=resource!==render.resource;render.resource=resource;render.width=this.width;render.height=this.height;if(layout)render.markNeedsLayout();else if(paint)render.markNeedsPaint();}
}

/** Source transition from a box Widget subtree to the non-box sliver protocol. */
export class SliverToBoxAdapter extends SourceSingleChildRenderObjectWidget {
  constructor({child,key=null}:{readonly child?:Widget|null;readonly key?:Key|null}={}){super(child??undefined,{key});}
  createRenderObject(_context:BuildContext):RenderSliverToBoxAdapter{return new RenderSliverToBoxAdapter();}
}
export class SliverPadding extends SourceSingleChildRenderObjectWidget {
  readonly padding:EdgeInsetsGeometry;
  constructor({padding,sliver,key=null}:{readonly padding:EdgeInsetsGeometry;readonly sliver?:Widget|null;readonly key?:Key|null}){super(sliver??undefined,{key});this.padding=padding;protect(this,['padding']);}
  createRenderObject(context:BuildContext):RenderSliverPadding{return new RenderSliverPadding({padding:this.padding,textDirection:context.dependOn(Directionality).direction});}
  updateRenderObject(context:BuildContext,render:RenderSliverPadding):void{render.padding=this.padding;render.textDirection=context.dependOn(Directionality).direction;}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new DiagnosticsProperty('padding',this.padding));}
}
export class IndexedSemantics extends SourceSingleChildRenderObjectWidget {
  readonly index:number;
  constructor({index,child,key=null}:{readonly index:number;readonly child?:Widget;readonly key?:Key|null}){super(child,{key});this.index=index;protect(this,['index']);}
  createRenderObject(_context:BuildContext):RenderIndexedSemantics{return new RenderIndexedSemantics({index:this.index});}
  updateRenderObject(_context:BuildContext,render:RenderIndexedSemantics):void{render.index=this.index;}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new DiagnosticsProperty('index',this.index));}
}
export class KeyedSubtree extends StatelessWidget {
  readonly child:Widget;
  constructor({child,key=null}:{readonly child:Widget;readonly key?:Key|null}){super(key);this.child=child;protect(this,['child']);}
  static wrap(child:Widget,childIndex:number):KeyedSubtree{
    const value=child.key??childIndex;
    return new KeyedSubtree({child,key:new ValueKey<Key|number>(value,Object,(a,b)=>a instanceof Key&&b instanceof Key?sameKey(a,b):a===b,value=>value instanceof Key?value.hashCode:value)});
  }
  static ensureUniqueKeysForList(items:readonly Widget[],{baseIndex=0}:{readonly baseIndex?:number}={}):readonly Widget[]{
    if(items.length===0)return items;const result=items.map((item,index)=>KeyedSubtree.wrap(item,baseIndex+index));
    if(FoundationBuildMode.debug){const keys=new KeyMap<boolean>();for(const item of result){invariant(!keys.has(item.key!),'duplicate-keyed-subtree','Wrapped list contains duplicate keys');keys.set(item.key!,true);}}
    return Object.freeze(result);
  }
  build(_context:BuildContext):Widget{return this.child;}
}
