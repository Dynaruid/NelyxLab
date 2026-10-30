// SPDX-License-Identifier: BSD-3-Clause
const namedRecordBrand:unique symbol=Symbol('Dart named record');
type Fields<P extends readonly unknown[],N extends object>={readonly positional:Readonly<P>;readonly named:Readonly<N>};
export type DartNamedRecord<P extends readonly unknown[],N extends object>=Readonly<{[namedRecordBrand]:Fields<P,N>}>;

function shape(arity:number,names:readonly string[]):string[]{
  if(!Number.isSafeInteger(arity)||arity<0||names.length===0||names.some(name=>typeof name!=='string'||name.length===0)||new Set(names).size!==names.length)throw new TypeError('Invalid named record shape');
  return [...names].sort();
}
/** Entries are evaluated in source order before canonical shape construction.
 * Storage is shallow immutable: field objects retain their original identity. */
export function dartNamedRecord<P extends readonly unknown[],N extends object>(arity:number,names:readonly string[],entries:readonly (readonly [number|string,unknown])[]):DartNamedRecord<P,N>{
  // oxlint-disable-next-line unicorn/no-new-array -- The numeric argument is the required length; preserve preallocation and sparse storage semantics.
  const sorted=shape(arity,names),positional:unknown[]=new Array(arity),named:Record<string,unknown>=Object.create(null),seen=new Set<number|string>();
  if(entries.length!==arity+sorted.length)throw new TypeError('Expected the exact named record shape');
  for(const [key,value]of entries){
    if(seen.has(key))throw new TypeError('Duplicate named record field');seen.add(key);
    if(typeof key==='number'){
      if(!Number.isSafeInteger(key)||key<0||key>=arity)throw new RangeError('Record field index is out of range');positional[key]=value;
    }else{if(!sorted.includes(key))throw new TypeError('Unexpected named record field');named[key]=value;}
  }
  for(let i=0;i<arity;i++)if(!seen.has(i))throw new TypeError('Missing positional record field');
  for(const name of sorted)if(!seen.has(name))throw new TypeError('Missing named record field');
  const fields=Object.freeze({positional:Object.freeze(positional),named:Object.freeze(named)});
  return Object.freeze({[namedRecordBrand]:fields}) as DartNamedRecord<P,N>;
}
export function dartNamedRecordRead<P extends readonly unknown[],N extends object,I extends number>(value:DartNamedRecord<P,N>,key:I,arity:number,names:readonly string[]):P[I];
export function dartNamedRecordRead<P extends readonly unknown[],N extends object,K extends keyof N&string>(value:DartNamedRecord<P,N>,key:K,arity:number,names:readonly string[]):N[K];
export function dartNamedRecordRead(value:DartNamedRecord<readonly unknown[],object>,key:number|string,arity:number,names:readonly string[]):unknown{
  const sorted=shape(arity,names),fields=value?.[namedRecordBrand];
  if(!fields||fields.positional.length!==arity)throw new TypeError('Expected the exact named record shape');
  const actual=Object.keys(fields.named).sort();
  if(actual.length!==sorted.length||actual.some((name,index)=>name!==sorted[index]))throw new TypeError('Expected the exact named record shape');
  if(typeof key==='number'){
    if(!Number.isSafeInteger(key)||key<0||key>=arity)throw new RangeError('Record field index is out of range');return fields.positional[key];
  }
  if(!Object.hasOwn(fields.named,key))throw new TypeError('Unknown named record field');
  return (fields.named as Readonly<Record<string,unknown>>)[key];
}
