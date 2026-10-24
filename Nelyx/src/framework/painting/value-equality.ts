// SPDX-License-Identifier: BSD-3-Clause
import {hashDoubles} from '../../ui/value-math.ts';
export function valueEquals(a:unknown,b:unknown):boolean{return a===b||!!(a&&typeof (a as {equals?:unknown}).equals==='function'&&(a as {equals:(b:unknown)=>boolean}).equals(b));}
export function listEquals(a:readonly unknown[]|null,b:readonly unknown[]|null):boolean{return a===b||a!==null&&b!==null&&a.length===b.length&&a.every((value,index)=>valueEquals(value,b[index]));}
const identities=new WeakMap<object,number>();let next=0;
export function valueHash(value:unknown):number{if(value===null||value===undefined)return 0;if(typeof value==='number')return hashDoubles([value]);if(typeof value==='boolean')return value?1:0;if(typeof value==='string')return hashDoubles(Array.from(value,c=>c.charCodeAt(0)));if(typeof value==='object'||typeof value==='function'){if(Array.isArray(value))return hashDoubles(value.map(valueHash));const hash=(value as {hashCode?:unknown}).hashCode;if(typeof hash==='number')return hash;let id=identities.get(value);if(id===undefined)identities.set(value,id=++next);return id;}return 0;}
export function hashValues(...values:unknown[]):number{return hashDoubles(values.map(valueHash));}
