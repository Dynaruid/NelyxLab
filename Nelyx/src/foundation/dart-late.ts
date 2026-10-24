// SPDX-License-Identifier: BSD-3-Clause
type LateEntry={value:unknown;readonly final:boolean};
const storage=new WeakMap<object,Map<string,LateEntry>>();
export class DartLateInitializationError extends Error {
  constructor(field:string,initialized:boolean){super(`Field '${field}' has ${initialized?'already been initialized':'not been initialized'}.`);this.name='LateInitializationError';}
}
/** Source-qualified field IDs keep inherited/imported fields distinct and do not
 * expose backing properties or require a constructor to initialize a late slot. */
export function dartLateRead<T>(owner:object,id:string,name:string):T {
  const entry=storage.get(owner)?.get(id);if(!entry)throw new DartLateInitializationError(name,false);return entry.value as T;
}
/** A successful initializer overwrites a reentrant mutable write; a failed
 * initializer leaves such a write in place. Without a write, failures retry.
 * Recursive initialization retains host stack behavior, like lazy statics. */
export function dartLateInitialize<T>(owner:object,id:string,name:string,initialize:()=>T,isFinal:boolean):T {
  const entry=storage.get(owner)?.get(id);if(entry)return entry.value as T;
  const value=initialize();dartLateWrite(owner,id,name,value,isFinal);return value;
}
/** A lexical cell lets captured closures observe one source late binding while
 * ordinary block/loop scope still owns its allocation. */
export function dartLateLocal<T>(name:string,isFinal:boolean,initialize?:()=>T):{value:T}{
  const owner={},id='local';
  return Object.freeze(Object.defineProperty({},'value',{
    enumerable:true,configurable:false,
    get:()=>initialize?dartLateInitialize(owner,id,name,initialize,isFinal):dartLateRead(owner,id,name),
    ...isFinal&&initialize?{}:{set:(value:T)=>dartLateWrite(owner,id,name,value,isFinal)},
  })) as {value:T};
}
export function dartLateWrite<T>(owner:object,id:string,name:string,value:T,isFinal:boolean):void {
  const fields=storage.get(owner),entry=fields?.get(id);
  if(entry?.final)throw new DartLateInitializationError(name,true);
  if(value===undefined)throw new TypeError('Dart late fields cannot store undefined');
  if(entry){if(entry.final!==isFinal)throw new TypeError('Late field policy changed');entry.value=value;}
  else{const target=fields??new Map<string,LateEntry>();target.set(id,{value,final:isFinal});if(!fields)storage.set(owner,target);}
}
