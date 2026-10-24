// SPDX-License-Identifier: BSD-3-Clause
/** Live native collection views; explicit casts replace erased Dart type arguments. */
export function castChannelList<T>(list:unknown[],cast:(value:unknown)=>T):T[]{return new Proxy(list,{get(target,key,receiver){const value=Reflect.get(target,key,receiver);return typeof key==='string'&&/^(0|[1-9]\d*)$/.test(key)&&Number(key)<target.length?cast(value):value;},set(target,key,value,receiver){if(typeof key==='string'&&/^(0|[1-9]\d*)$/.test(key))cast(value);return Reflect.set(target,key,value,receiver);}}) as T[];}
class _ChannelCastMap<K,V> extends Map<K,V>{
  constructor(private readonly source:Map<unknown,unknown>,private readonly keyCast:(value:unknown)=>K,private readonly valueCast:(value:unknown)=>V){super();}
  override get size():number{return this.source.size;}
  override get(key:K):V|undefined{return this.source.has(key)?this.valueCast(this.source.get(key)):undefined;}
  override has(key:K):boolean{return this.source.has(key);}
  override set(key:K,value:V):this{this.keyCast(key);this.valueCast(value);this.source.set(key,value);return this;}
  override delete(key:K):boolean{return this.source.delete(key);}
  override clear():void{this.source.clear();}
  override *entries():MapIterator<[K,V]>{for(const [key,value]of this.source)yield [this.keyCast(key),this.valueCast(value)];}
  override *keys():MapIterator<K>{for(const key of this.source.keys())yield this.keyCast(key);}
  override *values():MapIterator<V>{for(const value of this.source.values())yield this.valueCast(value);}
  override [Symbol.iterator]():MapIterator<[K,V]>{return this.entries();}
  override forEach(callback:(value:V,key:K,map:Map<K,V>)=>void,thisArg?:unknown):void{this.source.forEach((value,key)=>{const castKey=this.keyCast(key),castValue=this.valueCast(value);callback.call(thisArg,castValue,castKey,this);});}
}
export function castChannelMap<K,V>(source:Map<unknown,unknown>,key:(value:unknown)=>K,value:(value:unknown)=>V):Map<K,V>{return new _ChannelCastMap(source,key,value);}
