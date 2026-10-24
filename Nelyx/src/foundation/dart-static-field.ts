// SPDX-License-Identifier: BSD-3-Clause
const owners=new WeakMap<Function,Map<string,unknown>>();
function fields(owner:Function):Map<string,unknown>{let result=owners.get(owner);if(!result){result=new Map();owners.set(owner,result);}return result;}
/** Dart non-late statics initialize on first read; writes suppress unread
 * initializers. A throwing initializer leaves any explicit reentrant write in
 * place. Ordinary recursion uses the host stack, not Dart VM stack frames. */
export function dartStaticRead<T>(owner:Function,key:string,initialize:()=>T):T{
  const values=fields(owner);if(values.has(key))return values.get(key) as T;
  const value=initialize();values.set(key,value);return value;
}
export function dartStaticWrite<T>(owner:Function,key:string,value:T):void{fields(owner).set(key,value);}
/** Preserve getter-only final fields and mutable setters under RN Babel. */
export function dartStaticSeal(owner:Function,keys:readonly string[]):void{
  for(const key of keys){const descriptor=Object.getOwnPropertyDescriptor(owner,key);if(typeof descriptor?.get!=='function')throw new TypeError('Static field requires a generated accessor');Object.defineProperty(owner,key,{configurable:false});}
}
