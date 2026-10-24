// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
/** Mutable host adapter for the source debugDoublePrecision setting. */
export class DebugFormatting {static doublePrecision:number|null=null;}
export function debugFormatDouble(value:number|null):string{
  if(value===null)return 'null';
  const precision=DebugFormatting.doublePrecision;
  if(precision!==null&&(!Number.isInteger(precision)||precision<1||precision>21))throw new RangeError('Double precision must be between 1 and 21');
  const result=precision===null?value.toFixed(1):value.toPrecision(precision);
  return Object.is(value,-0)&&!result.startsWith('-')?'-'+result:result;
}
/** Dart double text is used by diagnostic metadata independently of display precision. */
export function diagnosticDoubleString(value:number):string{if(Object.is(value,-0))return '-0.0';const text=String(value);return Number.isFinite(value)&&Number.isInteger(value)&&Math.abs(value)<1e21?text+'.0':text;}
/** Collection descriptions follow Dart's diagnostic delimiters and cycle markers. */
export function diagnosticValueString(value:unknown,seen:Set<object>=new Set()):string{if(value!==null&&typeof value==='object'){const array=Array.isArray(value),set=value instanceof Set,map=value instanceof Map;if(array||set||map){const open=array?'[':'{',close=array?']':'}';if(seen.has(value))return open+'...'+close;seen.add(value);try{return open+(map?Array.from(value,([key,entry])=>diagnosticValueString(key,seen)+': '+diagnosticValueString(entry,seen)):Array.from(value as Iterable<unknown>,entry=>diagnosticValueString(entry,seen))).join(', ')+close;}finally{seen.delete(value);}}}return String(value);}
