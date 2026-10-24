// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {applyDartType,captureDartType} from '../../foundation/dart-type-witness.ts';import {canonicalDartObject} from '../../foundation/dart-const.ts';import {registerDartValueSemantics} from '../../foundation/dart-value.ts';
import {DiagnosticsProperty} from '../../foundation/diagnostics.ts';import type {DiagnosticsPropertyOptions} from '../../foundation/diagnostics.ts';import {DiagnosticsSerializationDelegate} from '../../foundation/diagnostics-serialization.ts';import type {JsonDiagnosticsNode} from '../../foundation/diagnostics-serialization.ts';import {listEquals,hashValues} from '../painting/value-equality.ts';import {invariant} from '../../foundation/errors.ts';
export interface IconDataOptions {readonly fontFamily?:string|null;readonly fontPackage?:string|null;readonly matchTextDirection?:boolean;readonly fontFamilyFallback?:readonly string[]|null;}
export class IconData {
  /** @dartType int */
  readonly codePoint:number;readonly fontFamily:string|null;readonly fontPackage:string|null;readonly matchTextDirection:boolean;readonly fontFamilyFallback:readonly string[]|null;
  /** @dartParam codePoint int */
  constructor(codePoint:number,{fontFamily=null,fontPackage=null,matchTextDirection=false,fontFamilyFallback=null}:IconDataOptions={}){invariant(new.target===IconData,'final-icon-data','Source IconData is final');invariant(Number.isSafeInteger(codePoint),'invalid-icon-codepoint','Icon codePoint must be an exact integer');this.codePoint=codePoint;this.fontFamily=fontFamily;this.fontPackage=fontPackage;this.matchTextDirection=matchTextDirection;this.fontFamilyFallback=fontFamilyFallback;captureDartType(this,sourceIconDataType);Object.freeze(this);}
  equals(other:unknown):boolean{return other instanceof IconData&&other.constructor===this.constructor&&other.codePoint===this.codePoint&&other.fontFamily===this.fontFamily&&other.fontPackage===this.fontPackage&&other.matchTextDirection===this.matchTextDirection&&listEquals(other.fontFamilyFallback,this.fontFamilyFallback);}
  get hashCode():number{return hashValues(this.codePoint,this.fontFamily,this.fontPackage,this.matchTextDirection,hashValues(...this.fontFamilyFallback??[]));}
  toString():string{return 'IconData(U+'+this.codePoint.toString(16).toUpperCase().padStart(5,'0')+')';}
}
export const sourceIconDataType=applyDartType<IconData>(IconData,'IconData',[],[]);
/** Closed constant-data constructor: catalog constants have a null fallback list. */
export function constIconData(codePoint:number,{fontFamily=null,fontPackage=null,matchTextDirection=false}:Omit<IconDataOptions,'fontFamilyFallback'>={}):IconData{return canonicalDartObject(IconData,sourceIconDataType,[['codePoint','int'],['fontFamily','value'],['fontPackage','value'],['matchTextDirection','value'],['fontFamilyFallback','value']],()=>new IconData(codePoint,{fontFamily,fontPackage,matchTextDirection}));}
registerDartValueSemantics(IconData,{accepts:(value:unknown):value is IconData=>value instanceof IconData&&Object.getPrototypeOf(value)===IconData.prototype,equals:(value,other)=>value.equals(other),hash:value=>value.hashCode,string:value=>value.toString()});
export class IconDataProperty extends DiagnosticsProperty<IconData> {
  constructor(name:string,value:IconData|null,options:DiagnosticsPropertyOptions<IconData>={}){super(name,value,{...options,typeName:'IconData'});}
  override toJsonMap(delegate:DiagnosticsSerializationDelegate=new DiagnosticsSerializationDelegate()):JsonDiagnosticsNode{const json=super.toJsonMap(delegate);if(this.value!==null)json.valueProperties={codePoint:this.value.codePoint};return json;}
}
