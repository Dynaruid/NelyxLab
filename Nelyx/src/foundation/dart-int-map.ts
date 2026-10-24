// SPDX-License-Identifier: BSD-3-Clause
import {invariant} from './errors.ts';
/** Exact safe-integer key boundary for selected Dart Map/SplayTreeMap uses.
 * Hash iteration order is not a contract; ordered instances traverse numeric keys.
 * No claim of arbitrary Dart key equality, generic reification or unbounded ints. */
export class DartIntMap<K extends number,V> {
  private readonly values=new Map<K,V>();private revision=0;
  constructor(private readonly acceptValue:(value:unknown)=>value is V,private readonly ordered=false){}
  get isEmpty():boolean{return this.values.size===0;}
  get length():number{return this.values.size;}
  private validKey(key:unknown):key is K{return typeof key==='number'&&Number.isSafeInteger(key);}
  containsKey(key:unknown):boolean{return this.validKey(key)&&this.values.has(key);}
  get(key:unknown):V|null{return this.containsKey(key)?this.values.get(key as K)!:null;}
  set(key:K,value:V):void{invariant(this.validKey(key),'invalid-map-key','Expected a safe integer map key');invariant(this.acceptValue(value),'invalid-map-value','Value violates the specialized map contract');if(!this.values.has(key))this.revision++;this.values.set(key,value);}
  remove(key:unknown):V|null{if(!this.containsKey(key))return null;const value=this.values.get(key as K)!;this.values.delete(key as K);this.revision++;return value;}
  clear():void{if(this.values.size){this.values.clear();this.revision++;}}
  putIfAbsent(key:K,ifAbsent:()=>V):V{invariant(this.validKey(key),'invalid-map-key','Expected a safe integer map key');if(this.containsKey(key))return this.values.get(key)!;const value=ifAbsent();this.set(key,value);return value;}
  private orderedKeys():K[]{const keys=[...this.values.keys()];return this.ordered?keys.sort((a,b)=>a<b?-1:a>b?1:0):keys;}
  firstKey():K|null{return this.orderedKeys()[0]??null;}
  lastKey():K|null{return this.orderedKeys().at(-1)??null;}
  *getKeys():IterableIterator<K>{const revision=this.revision;for(const key of this.orderedKeys()){invariant(revision===this.revision,'concurrent-map-modification','Map keys changed during traversal');yield key;invariant(revision===this.revision,'concurrent-map-modification','Map keys changed during traversal');}}
  get keys():Iterable<K>{return this.getKeys();}
  forEach(action:(key:K,value:V)=>void):void{for(const key of this.keys)action(key,this.values.get(key)!);}
}
export function dartIntMapRead<K extends number,V>(map:DartIntMap<K,V>,key:unknown):V|null{return map.get(key);}
export function dartIntMapWrite<K extends number,V>(map:DartIntMap<K,V>,key:K,value:V):void{map.set(key,value);}
