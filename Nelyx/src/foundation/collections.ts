// SPDX-License-Identifier: BSD-3-Clause
// Reviewed against the pinned Flutter foundation/collections.dart; TS collections retain their own key equality.
import {invariant} from './errors.ts';
export type Comparator<T>=(a:T,b:T)=>number;
export type Equality<T>=(a:T,b:T)=>boolean;
export interface Comparable<T> {compareTo(other:T):number}
function isComparable<T>(value:unknown):value is Comparable<T>{return value!==null&&(typeof value==='object'||typeof value==='function')&&typeof (value as Partial<Comparable<T>>).compareTo==='function';}
function defaultCompare<T>(a:T,b:T):number {
  if(typeof a==='number'&&typeof b==='number'){
    if(Number.isNaN(a))return Number.isNaN(b)?0:1;if(Number.isNaN(b))return -1;
    if(a===0&&b===0)return Object.is(a,b)?0:Object.is(a,-0)?-1:1;
    return a<b?-1:a>b?1:0;
  }
  if(typeof a==='string'&&typeof b==='string')return a<b?-1:a>b?1:0;
  if(isComparable<T>(a))return a.compareTo(b);
  throw new TypeError('Values require number/string ordering, compareTo, or an explicit comparator');
}
function compare<T>(comparator:Comparator<T>,a:T,b:T):number{const value=comparator(a,b);invariant(Number.isFinite(value),'invalid-comparison','Comparator must return a finite number');return value;}
export function listEquals<T>(a:readonly T[]|null|undefined,b:readonly T[]|null|undefined,equal:Equality<T>=(a,b)=>a===b):boolean {
  if(a==null)return b==null;if(b==null||a.length!==b.length)return false;if(a===b)return true;
  for(let index=0;index<a.length;index++)if(!equal(a[index]!,b[index]!))return false;return true;
}
export function setEquals<T>(a:ReadonlySet<T>|null|undefined,b:ReadonlySet<T>|null|undefined):boolean {
  if(a==null)return b==null;if(b==null||a.size!==b.size)return false;if(a===b)return true;
  for(const value of a)if(!b.has(value))return false;return true;
}
export function mapEquals<K,V>(a:ReadonlyMap<K,V>|null|undefined,b:ReadonlyMap<K,V>|null|undefined,equal:Equality<V>=(a,b)=>a===b):boolean {
  if(a==null)return b==null;if(b==null||a.size!==b.size)return false;if(a===b)return true;
  for(const [key,value]of a)if(!b.has(key)||!equal(value,b.get(key)!))return false;return true;
}
export function binarySearch<T>(sortedList:readonly T[],value:T,comparator:Comparator<T>=defaultCompare):number {
  let min=0,max=sortedList.length;
  while(min<max){const mid=min+Math.floor((max-min)/2),order=compare(comparator,sortedList[mid]!,value);if(order===0)return mid;if(order<0)min=mid+1;else max=mid;}
  return -1;
}
export interface SortOptions<T> {readonly start?:number;readonly end?:number;readonly compare?:Comparator<T>}
/** Stable O(n log n) ordering; only the selected half-open range is replaced. */
export function mergeSort<T>(list:T[],options:SortOptions<T>={}):void {
  const start=options.start??0,end=options.end??list.length,comparator=options.compare??defaultCompare;
  invariant(Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=0&&end>=start&&end<=list.length,'invalid-sort-range','Sort range must be inside the list');
  const count=end-start;if(count<2)return;
  let source=list.slice(start,end),target=new Array<T>(count);
  for(let width=1;width<count;width*=2){
    for(let begin=0;begin<count;begin+=width*2){
      const middle=Math.min(begin+width,count),limit=Math.min(begin+width*2,count);let left=begin,right=middle,index=begin;
      while(left<middle&&right<limit)target[index++]=compare(comparator,source[left]!,source[right]!)<=0?source[left++]!:source[right++]!;
      while(left<middle)target[index++]=source[left++]!;while(right<limit)target[index++]=source[right++]!;
    }
    [source,target]=[target,source];
  }
  for(let index=0;index<count;index++)list[start+index]=source[index]!;
}
