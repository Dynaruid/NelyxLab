// SPDX-License-Identifier: BSD-3-Clause
export type MutableDetailsList<T>=T[];
export type HostType=Function;
/** In this source closure the only primitive Object passed to the diagnostic
 * helper is Core's string-backed Clip enum. Other fields are actual objects. */
export function detailsObjectString(value:{}):string{return typeof value==='string'?'Clip.'+value:value.toString();}
export function detailsRuntimeType(value:{}):Function{return value.constructor;}
export function detailsStringConcat(left:string,right:string):string{return left+right;}
