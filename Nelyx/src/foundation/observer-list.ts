// SPDX-License-Identifier: BSD-3-Clause
// Reviewed Flutter observer_list.dart; explicit equality/hash policies adapt Dart value equality to TS.
import {invariant} from './errors.ts';
import {KeyMap,ValueKey} from './key.ts';
export interface ObserverEquality<T>{readonly equal?:(a:T,b:T)=>boolean;readonly hash?:(value:T)=>unknown}
const sameValueZero=(a:unknown,b:unknown)=>a===b||Number.isNaN(a)&&Number.isNaN(b);
function copy<T>(items:Iterable<T>,options:{readonly growable?:boolean}={}):T[]{
  const result=[...items];if(options.growable===false){Object.seal(result);Object.defineProperty(result,'length',{writable:false});}return result;
}
export class ObserverList<T> implements Iterable<T> {
  private readonly list:T[]=[];
  private readonly membership=new KeyMap<boolean>();
  private readonly equal:(a:T,b:T)=>boolean;
  private readonly hash:((value:T)=>unknown)|undefined;
  private dirty=false;
  private version=0;
  constructor(options:ObserverEquality<T>={}){this.equal=options.equal??sameValueZero;this.hash=options.hash??(options.equal?undefined:value=>value);}
  get length():number{return this.list.length;}
  get isEmpty():boolean{return this.length===0;}
  get isNotEmpty():boolean{return !this.isEmpty;}
  add(item:T):void{this.list.push(item);this.dirty=true;this.version++;}
  remove(item:T):boolean {
    const index=this.list.findIndex(value=>this.equal(value,item));if(index<0)return false;
    this.list.splice(index,1);this.membership.clear();this.dirty=true;this.version++;return true;
  }
  clear():void{this.list.length=0;this.membership.clear();this.dirty=false;this.version++;}
  contains(item:T):boolean {
    if(this.list.length<3)return this.list.some(value=>this.equal(value,item));
    if(this.dirty){for(const value of this.list)this.membership.set(new ValueKey(value,this,this.equal,this.hash),true);this.dirty=false;}return this.membership.has(new ValueKey(item,this,this.equal,this.hash));
  }
  toList(options:{readonly growable?:boolean}={}):T[]{return copy(this.list,options);}
  [Symbol.iterator]():IterableIterator<T>{
    const version=this.version,owner=this;
    return (function*(){
      for(let index=0;index<owner.list.length;index++){invariant(version===owner.version,'observer-list-modified','ObserverList modified during iteration');yield owner.list[index]!;}
      invariant(version===owner.version,'observer-list-modified','ObserverList modified during iteration');
    })();
  }
}
export class HashedObserverList<T> implements Iterable<T> {
  private readonly counts=new KeyMap<{value:T;count:number}>();
  private readonly equal:(a:T,b:T)=>boolean;
  private readonly hash:((value:T)=>unknown)|undefined;
  private version=0;
  constructor(options:ObserverEquality<T>={}){this.equal=options.equal??sameValueZero;this.hash=options.hash??(options.equal?undefined:value=>value);}
  get length():number{return this.counts.size;}
  get isEmpty():boolean{return this.length===0;}
  get isNotEmpty():boolean{return !this.isEmpty;}
  add(item:T):void{const key=new ValueKey(item,this,this.equal,this.hash),entry=this.counts.get(key);if(entry)entry.count++;else{const entry={value:item,count:1};this.counts.set(key,entry);this.version++;}}
  remove(item:T):boolean {
    const key=new ValueKey(item,this,this.equal,this.hash),entry=this.counts.get(key);if(!entry)return false;
    if(entry.count===1){this.counts.delete(key);this.version++;}else entry.count--;return true;
  }
  clear():void{if(this.counts.size)this.version++;this.counts.clear();}
  contains(item:T):boolean{return this.counts.has(new ValueKey(item,this,this.equal,this.hash));}
  toList(options:{readonly growable?:boolean}={}):T[]{return copy(this,options);}
  [Symbol.iterator]():IterableIterator<T>{
    const version=this.version,owner=this;
    return (function*(){
      for(const entry of owner.counts.values()){invariant(version===owner.version,'observer-list-modified','HashedObserverList modified during iteration');yield entry.value;}
      invariant(version===owner.version,'observer-list-modified','HashedObserverList modified during iteration');
    })();
  }
}
