// SPDX-License-Identifier: BSD-3-Clause
// Reviewed port: Doroti d8d1e179, Foundation/key.cs; see upstream/framework-imports.json.
/** Generic types erase at runtime. Supply a token when values of different API types can overlap. */
export abstract class Key {
  abstract equals(other: Key): boolean;
  /** Equal keys must share a hash. Custom keys may override this to avoid a shared fallback bucket. */
  get hashCode():unknown {return null;}
}
export abstract class LocalKey extends Key {}
export class UniqueKey extends LocalKey {
  equals(other: Key): boolean { return this === other; }
  override get hashCode():unknown {return this;}
}
const identityEqual=(a:unknown,b:unknown)=>a===b;
function keyToken(value:unknown):object|symbol{
  if(value!==null&&(typeof value==='object'||typeof value==='function'))return value.constructor??objectKey;
  return primitiveKeys[value===null?'null':typeof value]??objectKey;
}
/** Custom value equality/hash policies use a shared explicit type token. */
export class ValueKey<T> extends LocalKey {
  constructor(readonly value:T,readonly typeToken:object|symbol=keyToken(value),private readonly equal:(a:T,b:T)=>boolean=identityEqual,private readonly hash?:((value:T)=>unknown)){super();}
  equals(other: Key): boolean {
    return other instanceof ValueKey&&this.constructor===other.constructor&&this.typeToken===other.typeToken&&this.equal(this.value,other.value as T);
  }
  override get hashCode():unknown {return this.hash?this.hash(this.value):this.equal===identityEqual?this.value:null;}
}
export class ObjectKey extends LocalKey {
  constructor(readonly value:unknown){super();}
  equals(other:Key):boolean{return other instanceof ObjectKey&&this.constructor===other.constructor&&Object.is(this.value,other.value);}
  override get hashCode():unknown{return this.value;}
}
/** Hash buckets preserve Key.equals, including application-defined keys and runtime type tokens. */
export class KeyMap<V> {
  private readonly buckets=new Map<unknown,{key:Key;value:V}[]>();
  private readonly ordered=new Set<{key:Key;value:V}>();
  private count=0;
  get size():number{return this.count;}
  get(key:Key):V|undefined{return this.buckets.get(key.hashCode)?.find(entry=>sameKey(entry.key,key))?.value;}
  has(key:Key):boolean{return this.buckets.get(key.hashCode)?.some(entry=>sameKey(entry.key,key))??false;}
  set(key:Key,value:V):void{
    const hash=key.hashCode,bucket=this.buckets.get(hash)??[],entry=bucket.find(entry=>sameKey(entry.key,key));
    if(entry)entry.value=value;else{const entry={key,value};bucket.push(entry);this.ordered.add(entry);this.count++;this.buckets.set(hash,bucket);}
  }
  delete(key:Key):boolean{
    const hash=key.hashCode,bucket=this.buckets.get(hash),index=bucket?.findIndex(entry=>sameKey(entry.key,key))??-1;
    if(!bucket||index<0)return false;this.ordered.delete(bucket[index]!);bucket.splice(index,1);this.count--;if(!bucket.length)this.buckets.delete(hash);return true;
  }
  clear():void{this.buckets.clear();this.ordered.clear();this.count=0;}
  *values():IterableIterator<V>{for(const entry of this.ordered)yield entry.value;}
}
const objectKey=Symbol('object');
const primitiveKeys:Readonly<Record<string,symbol>>=Object.freeze(Object.fromEntries(['string','number','boolean','symbol','bigint','undefined','null'].map(type=>[type,Symbol(type)])));
export function sameKey(a: Key | null, b: Key | null): boolean { return a === b || a !== null && b !== null && a.equals(b); }
