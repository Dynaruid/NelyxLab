// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from the pinned Flutter foundation/assertions.dart.
import {isException} from './errors.ts';
import {FlutterError} from './flutter-error.ts';
import {DiagnosticsNode,DiagnosticsProperty,DiagnosticsBlock,DiagnosticPropertiesBuilder,DiagnosticableNode,ErrorDescription,ErrorSummary,ErrorHint,ErrorSpacer} from './diagnostics.ts';
import type {Diagnosticable,DiagnosticsOptions,DiagnosticsStringOptions} from './diagnostics.ts';

export type InformationCollector=()=>Iterable<DiagnosticsNode>;

import type {IterableFilter} from './basic-types.ts';

export type FlutterExceptionHandler=(details:FlutterErrorDetails)=>void;

export type DiagnosticPropertiesTransformer=(properties:Iterable<DiagnosticsNode>)=>Iterable<DiagnosticsNode>;

export type StackTraceDemangler=(stack:string)=>string;

export interface FlutterErrorDetailsOptions {readonly exception:unknown;readonly stack?:string|null;readonly library?:string|null;readonly context?:DiagnosticsNode|null;readonly stackFilter?:IterableFilter<string>|null;readonly informationCollector?:InformationCollector|null;readonly silent?:boolean|null}

export class FlutterErrorDetails implements Diagnosticable {
  static readonly propertiesTransformers:DiagnosticPropertiesTransformer[]=[];
  readonly exception:unknown;readonly stack:string|null;readonly library:string|null;readonly context:DiagnosticsNode|null;readonly stackFilter:IterableFilter<string>|null;readonly informationCollector:InformationCollector|null;readonly silent:boolean;
  constructor(o:FlutterErrorDetailsOptions){this.exception=o.exception;this.stack=o.stack??null;this.library=o.library===undefined?'Flutter framework':o.library;this.context=o.context??null;this.stackFilter=o.stackFilter??null;this.informationCollector=o.informationCollector??null;this.silent=o.silent??false;}
  copyWith(o:Partial<FlutterErrorDetailsOptions>={}):FlutterErrorDetails{return new FlutterErrorDetails({exception:o.exception??this.exception,stack:o.stack??this.stack,library:o.library??this.library,context:o.context??this.context,stackFilter:o.stackFilter??this.stackFilter,informationCollector:o.informationCollector??this.informationCollector,silent:o.silent??this.silent});}
  exceptionAsString():string{let message:string;if(isAssertion(this.exception)){const full=String(this.exception),short=(this.exception as {message:unknown}).message;let reformatted:string|undefined;if(typeof short==='string'&&short!==full&&full.length>short.length){const position=full.lastIndexOf(short);if(position===full.length-short.length&&position>2&&full.slice(position-2,position)===': '){let body=full.slice(0,position-2);const split=body.indexOf(' Failed assertion:');if(split>=0)body=body.slice(0,split)+'\n'+body.slice(split+1);reformatted=short.trimEnd()+'\n'+body;}}message=reformatted??full;}else if(this.exception instanceof Error||isException(this.exception)||typeof this.exception==='string')message=String(this.exception);else message='  '+String(this.exception);message=message.trimEnd();return message||'  <no message available>';}
  private _exceptionToDiagnosticable():Diagnosticable|null{if(this.exception instanceof FlutterError)return this.exception;if(isAssertion(this.exception)&&(this.exception as {message:unknown}).message instanceof FlutterError)return (this.exception as unknown as {message:FlutterError}).message;return null;}
  get summary():DiagnosticsNode{const format=()=>this.exceptionAsString().split('\n')[0]!.trimStart();if(!FlutterError.debugMode)return DiagnosticsNode.message(format());if(this._exceptionToDiagnosticable()){const properties=new DiagnosticPropertiesBuilder();this.debugFillProperties(properties);const summary=properties.properties.find(n=>n.level==='summary');if(summary)return summary;}return new ErrorSummary(format());}
  debugFillProperties(properties:DiagnosticPropertiesBuilder):void{
    const verb=`thrown${this.context?' '+String(this.context):''}`,diagnosticable=this._exceptionToDiagnosticable();
    if(typeof this.exception==='number')properties.add(new ErrorDescription(`The number ${this.exception} was ${verb}.`));
    else{const name=typeof this.exception==='string'?'message':isAssertion(this.exception)?'assertion':this.exception instanceof Error||isException(this.exception)?runtimeType(this.exception):runtimeType(this.exception)+' object';properties.add(new ErrorDescription(`The following ${name} was ${verb}:`));if(diagnosticable)diagnosticable.debugFillProperties(properties);else{const prefix=runtimeType(this.exception)+': ';let message=this.exceptionAsString();if(message.startsWith(prefix))message=message.slice(prefix.length);properties.add(new ErrorSummary(message));}}
    if(this.stack!==null){properties.add(new ErrorSpacer());properties.add(new DiagnosticsStackTrace('When the exception was thrown, this was the stack',this.stack,{stackFilter:this.stackFilter}));}
    if(this.informationCollector){properties.add(new ErrorSpacer());for(const node of this.informationCollector())properties.add(node);}
  }
  toStringShort():string{return this.library!==null?'Exception caught by '+this.library:'Exception caught';}
  toString(o:DiagnosticsStringOptions={}):string{return this.toDiagnosticsNode({style:'error'}).toStringDeep({minLevel:o.minLevel??'info'});}
  toDiagnosticsNode(o:DiagnosticsOptions={}):DiagnosticsNode{return new _FlutterErrorDetailsNode(this,o);}
}

function runtimeType(value:unknown):string{if(value===null)return 'Null';if(value===undefined)return 'Undefined';if(typeof value==='string')return 'String';if(typeof value==='number')return Number.isInteger(value)?'int':'double';if(typeof value==='boolean')return 'bool';return (Object.getPrototypeOf(Object(value)) as {constructor?:{name?:string}}|null)?.constructor?.name??typeof value;}

function isAssertion(value:unknown):value is Error{return value instanceof Error&&(value instanceof FlutterError||value.name==='AssertionError'||value.name==='_AssertionError'||value.constructor.name==='AssertionError'||value.constructor.name==='_AssertionError');}

export class DiagnosticsStackTrace extends DiagnosticsBlock {constructor(name:string,stack:string|null,{stackFilter,showSeparator,frame}:{readonly stackFilter?:IterableFilter<string>|null;readonly showSeparator?:boolean;readonly frame?:string}={}){super({name,value:stack,style:frame===undefined?'flat':'whitespace',...(showSeparator!==undefined?{showSeparator}:{}),properties:frame===undefined?DiagnosticsStackTrace._applyStackFilter(stack,stackFilter??null):[DiagnosticsStackTrace._createStackFrame(frame)]});}static singleFrame(name:string,{frame,showSeparator}:{readonly frame:string;readonly showSeparator?:boolean}):DiagnosticsStackTrace{return new DiagnosticsStackTrace(name,null,{frame,...(showSeparator!==undefined?{showSeparator}:{})});}private static _applyStackFilter(stack:string|null,filter:IterableFilter<string>|null):DiagnosticsNode[]{return stack===null?[]:Array.from((filter??FlutterError.defaultStackFilter.bind(FlutterError))(FlutterError.demangleStackTrace(stack).trimEnd().split('\n')),this._createStackFrame);}private static _createStackFrame(frame:string):DiagnosticsNode{return DiagnosticsNode.message(frame,{allowWrap:false});}override get allowTruncate():boolean{return false;}}

class _FlutterErrorDetailsNode extends DiagnosticableNode<FlutterErrorDetails>{override get builder():DiagnosticPropertiesBuilder{const builder=super.builder;if(!builder)throw new Error('Error details diagnostic builder requires debug mode');let properties:Iterable<DiagnosticsNode>=builder.properties;for(const transformer of FlutterErrorDetails.propertiesTransformers)properties=transformer(properties);return DiagnosticPropertiesBuilder.fromProperties(Array.from(properties));}}
