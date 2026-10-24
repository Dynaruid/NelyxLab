// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {InlineSpan,InlineSpanSemanticsInformation} from './inline-span.ts';
import type {Accumulator,InlineSpanVisitor} from './inline-span.ts';
import type {InlineSpanBuildOptions,PlainTextOptions} from './inline-span.ts';
import type {TextStyle} from './text-style.ts';
import {invariant} from '../../foundation/errors.ts';
import {FoundationBuildMode} from '../../foundation/constants.ts';
import {RenderComparison} from './basic-types.ts';
import {TextAffinity} from '../../ui/text-position.ts';import type {TextPosition} from '../../ui/text-position.ts';
import type {GestureRecognizer} from '../gestures/recognizer.ts';
import {PointerDownEvent} from '../gestures/events.ts';import type {PointerEvent} from '../gestures/events.ts';
import type {HitTestEntry,HitTestTarget} from '../gestures/hit-test.ts';
import {MouseCursor,SystemMouseCursors} from '../../services/mouse-cursor.ts';
import type {MouseTrackerAnnotation,PointerEnterEventListener,PointerExitEventListener} from '../../services/mouse-tracking.ts';
import {Locale} from '../../ui/locale.ts';
import {protect} from '../../ui/value-math.ts';
import {TextRange} from '../../ui/text-range.ts';
import {SpellOutStringAttribute,LocaleStringAttribute} from '../../ui/string-attribute.ts';
import type {StringAttribute} from '../../ui/string-attribute.ts';
import {DiagnosticsNode,DiagnosticsProperty,StringProperty} from '../../foundation/diagnostics.ts';
import type {DiagnosticPropertiesBuilder} from '../../foundation/diagnostics.ts';
import {FlagsSummary} from '../../foundation/diagnostic-properties.ts';
import {objectRuntimeType} from '../../foundation/object.ts';
import {listEquals,hashValues} from './value-equality.ts';
import type {ParagraphBuilder} from '../../ui/paragraph-builder.ts';
import {TextScaler} from './text-scaler.ts';
import {FlutterError} from '../../foundation/flutter-error.ts';
import {FlutterErrorDetails} from '../../foundation/assertions.ts';
import {ErrorDescription} from '../../foundation/diagnostics.ts';
export interface TextSpanOptions {readonly text?:string|null;readonly children?:readonly InlineSpan[]|null;readonly style?:TextStyle|null;readonly semanticsLabel?:string|null;readonly semanticsIdentifier?:string|null;readonly locale?:Locale|null;readonly spellOut?:boolean|null;readonly recognizer?:GestureRecognizer|null;readonly mouseCursor?:MouseCursor|null;readonly onEnter?:PointerEnterEventListener|null;readonly onExit?:PointerExitEventListener|null}
export class TextSpan extends InlineSpan implements HitTestTarget,MouseTrackerAnnotation {
  readonly text:string|null;readonly children:readonly InlineSpan[]|null;readonly semanticsLabel:string|null;
  readonly semanticsIdentifier:string|null;readonly locale:Locale|null;readonly spellOut:boolean|null;
  readonly recognizer:GestureRecognizer|null;readonly mouseCursor:MouseCursor;readonly onEnter:PointerEnterEventListener|undefined;readonly onExit:PointerExitEventListener|undefined;
  constructor({text=null,children=null,style=null,semanticsLabel=null,semanticsIdentifier=null,locale=null,spellOut=null,recognizer=null,mouseCursor=null,onEnter=null,onExit=null}:TextSpanOptions={}){super(style);invariant((text===null||typeof text==='string')&&(semanticsLabel===null||typeof semanticsLabel==='string')&&(semanticsIdentifier===null||typeof semanticsIdentifier==='string')&&(locale===null||locale instanceof Locale)&&(spellOut===null||typeof spellOut==='boolean')&&(!children||children.every(child=>child instanceof InlineSpan)),'invalid-text-span','TextSpan text/semantics/children have invalid types');if(FoundationBuildMode.debug)invariant(text!==null||semanticsLabel===null,'missing-span-text','A semanticsLabel requires text');this.text=text;this.children=children?Object.freeze([...children]):null;this.semanticsLabel=semanticsLabel;this.semanticsIdentifier=semanticsIdentifier;this.locale=locale;this.spellOut=spellOut;this.recognizer=recognizer;this.mouseCursor=mouseCursor??(recognizer===null?MouseCursor.defer:SystemMouseCursors.click);this.onEnter=onEnter??undefined;this.onExit=onExit??undefined;if(new.target===TextSpan)Object.freeze(this);else protect(this,['text','children','semanticsLabel','semanticsIdentifier','locale','spellOut','recognizer','mouseCursor','onEnter','onExit']);}
  get cursor():MouseCursor{return this.mouseCursor;}
  get validForMouseTracker():boolean{return true;}
  handleEvent(event:PointerEvent,_entry:HitTestEntry):void{if(event instanceof PointerDownEvent)this.recognizer?.addPointer(event);}
  build(builder:ParagraphBuilder,{textScaler=TextScaler.noScaling,dimensions=null}:InlineSpanBuildOptions={}):void{
    if(FoundationBuildMode.debug)this.debugAssertIsValid();if(this.style!==null)builder.pushStyle(this.style.getTextStyle({textScaler}));
    if(this.text!==null){try{builder.addText(this.text);}catch(error){if(!(error instanceof TypeError))throw error;FlutterError.reportError(new FlutterErrorDetails({exception:error,stack:error.stack??null,library:'painting library',context:new ErrorDescription('while building a TextSpan'),silent:true}));builder.addText('\ufffd');}}
    for(const child of this.children??[])child.build(builder,{textScaler,dimensions});if(this.style!==null)builder.pop();
  }
  visitDirectChildren(visitor:(span:InlineSpan)=>boolean):boolean{for(const child of this.children??[])if(!visitor(child))return false;return true;}
  visitChildren(visitor:InlineSpanVisitor):boolean{if(this.text!==null&&!visitor(this))return false;for(const child of this.children??[])if(!child.visitChildren(visitor))return false;return true;}
  protected getSpanForPositionVisitor(position:TextPosition,offset:Accumulator):InlineSpan|null{const text=this.text;if(text===null||text.length===0)return null;const target=position.offset,end=offset.value+text.length;if(offset.value===target&&position.affinity===TextAffinity.downstream||offset.value<target&&target<end||end===target&&position.affinity===TextAffinity.upstream)return this;offset.increment(text.length);return null;}
  protected codeUnitAtVisitor(index:number,offset:Accumulator):number|null{if(this.text===null)return null;const local=index-offset.value;if(FoundationBuildMode.debug)invariant(local>=0,'negative-span-index','Span local offset must be nonnegative');offset.increment(this.text.length);return local>=0&&local<this.text.length?this.text.charCodeAt(local):null;}
  compareTo(other:InlineSpan):RenderComparison{
    if(this===other)return RenderComparison.identical;if(other.constructor!==this.constructor)return RenderComparison.layout;const span=other as TextSpan;
    if(span.text!==this.text||span.children?.length!==this.children?.length||(span.style===null)!==(this.style===null))return RenderComparison.layout;
    let result=this.recognizer===span.recognizer?RenderComparison.identical:RenderComparison.metadata;
    if(this.style!==null){const candidate=this.style.compareTo(span.style!);if(candidate.index>result.index)result=candidate;if(result===RenderComparison.layout)return result;}
    if(this.children!==null)for(let i=0;i<this.children.length;i++){const candidate=this.children[i]!.compareTo(span.children![i]!);if(candidate.index>result.index)result=candidate;if(result===RenderComparison.layout)return result;}
    return result;
  }
  protected ownPlainText({includeSemanticsLabels=true}:PlainTextOptions):string{return includeSemanticsLabels&&this.semanticsLabel!==null?this.semanticsLabel:this.text??'';}
  computeSemanticsInformation(collector:InlineSpanSemanticsInformation[],{inheritedLocale=null,inheritedSpellOut=false}:{readonly inheritedLocale?:Locale|null;readonly inheritedSpellOut?:boolean}={}):void{
    if(FoundationBuildMode.debug)this.debugAssertIsValid();const locale=this.locale??inheritedLocale,spellOut=this.spellOut??inheritedSpellOut;
    if(this.text!==null){const length=(this.semanticsLabel??this.text).length,attributes:StringAttribute[]=[];if(spellOut&&length>0)attributes.push(new SpellOutStringAttribute({range:new TextRange({start:0,end:length})}));if(locale!==null&&length>0)attributes.push(new LocaleStringAttribute({range:new TextRange({start:0,end:length}),locale}));collector.push(new InlineSpanSemanticsInformation(this.text,{semanticsLabel:this.semanticsLabel,semanticsIdentifier:this.semanticsIdentifier,recognizer:this.recognizer,stringAttributes:attributes}));}
    for(const child of this.children??[])if(child instanceof TextSpan)child.computeSemanticsInformation(collector,{inheritedLocale:locale,inheritedSpellOut:spellOut});else child.computeSemanticsInformation(collector);
  }
  override debugAssertIsValid():boolean{if(FoundationBuildMode.debug)for(const child of this.children??[])invariant(child.debugAssertIsValid(),'invalid-child-span','Invalid child InlineSpan');return super.debugAssertIsValid();}
  override equals(other:unknown):boolean{return this===other||other instanceof TextSpan&&super.equals(other)&&this.text===other.text&&this.recognizer===other.recognizer&&this.semanticsLabel===other.semanticsLabel&&this.semanticsIdentifier===other.semanticsIdentifier&&this.onEnter===other.onEnter&&this.onExit===other.onExit&&this.mouseCursor.equals(other.mouseCursor)&&listEquals(this.children,other.children);}
  override get hashCode():number{return hashValues(super.hashCode,this.text,this.recognizer,this.semanticsLabel,this.semanticsIdentifier,this.onEnter,this.onExit,this.mouseCursor,this.children);}
  override toStringShort():string{return objectRuntimeType(this,'TextSpan');}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new StringProperty('text',this.text,{showName:false,defaultValue:null}));if(this.style===null&&this.text===null&&this.children===null)properties.add(DiagnosticsNode.message('(empty)'));properties.add(new DiagnosticsProperty('recognizer',this.recognizer,{defaultValue:null,...this.recognizer?{description:this.recognizer.constructor.name}:{}}));properties.add(new FlagsSummary('callbacks',new Map<string,unknown|null>([['enter',this.onEnter??null],['exit',this.onExit??null]])));properties.add(new DiagnosticsProperty('mouseCursor',this.cursor,{defaultValue:MouseCursor.defer}));if(this.semanticsLabel!==null)properties.add(new StringProperty('semanticsLabel',this.semanticsLabel));if(this.semanticsIdentifier!==null)properties.add(new StringProperty('semanticsIdentifier',this.semanticsIdentifier));}
  override debugDescribeChildren():readonly DiagnosticsNode[]{return this.children?.map(child=>child.toDiagnosticsNode())??[];}
}
