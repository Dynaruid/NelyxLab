// SPDX-License-Identifier: BSD-3-Clause
// Finite source Size type boundary for source generic properties; the owning Size class is unchanged.
import {Size} from './size.ts';import {OffsetBase} from './offset-base.ts';
import {applyDartType,captureDartType,hasCapturedDartType} from '../foundation/dart-type-witness.ts';import {registerDartValueSemantics} from '../foundation/dart-value.ts';
import {canonicalDartObject} from '../foundation/dart-const.ts';
export const sourceOffsetBaseType=applyDartType<OffsetBase>(OffsetBase,'OffsetBase',[],[]);
export const sourceSizeType=applyDartType<Size>(Size,'Size',[],[sourceOffsetBaseType]);
export function captureSourceSize(value:Size):Size{if(Object.getPrototypeOf(value)!==Size.prototype)throw new TypeError('Source Size requires the exact owning Core class');if(!hasCapturedDartType(value,OffsetBase))captureDartType(value,sourceOffsetBaseType);if(!hasCapturedDartType(value,Size))captureDartType(value,sourceSizeType);return value;}
export function sourceSizeLerp(a:Size|null,b:Size|null,t:number):Size|null{const value=Size.lerp(a,b,t);return value===null?null:captureSourceSize(value);}
captureSourceSize(Size.zero);captureSourceSize(Size.infinite);
registerDartValueSemantics(Size,{accepts:(value:unknown):value is Size=>value instanceof Size&&Object.getPrototypeOf(value)===Size.prototype,equals:(value,other)=>value.equals(other),hash:value=>value.hashCode,string:value=>value.toString()});
// The audited Core OffsetBase owns two immutable scalar slots; capture does not add own keys.
function canonical(create:()=>Size):Size{return canonicalDartObject(Size,sourceSizeType,[['horizontal','double'],['vertical','double']],()=>captureSourceSize(create()));}
export const sourceSizeZero=canonical(()=>Size.zero);
export const sourceSizeInfinite=canonical(()=>Size.infinite);
/** @dartParam width double
 * @dartParam height double */
export function constSourceSize(owner:typeof Size,width:number,height:number):Size{if(owner!==Size)throw new TypeError('Size factory requires the exact Core owner');return canonical(()=>width===0&&height===0&&!Object.is(width,-0)&&!Object.is(height,-0)?Size.zero:new Size(width,height));}
