// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2013, the Dart project authors. All rights reserved.
// Source MapBase.mapToString ordering and cycle handling over the Core Map ABI.
import {DartMap} from './dart-collections.ts';
import {dartIdentityHash,dartValueString,registerDartValueSemantics} from './dart-value.ts';

const visiting=new WeakSet<object>();
const mapSemantics=Object.freeze({
    accepts:(value:unknown):value is DartMap<unknown,unknown>=>DartMap.is(value)&&Object.getPrototypeOf(value)===DartMap.prototype,
    equals:(value:DartMap<unknown,unknown>,other:{})=>value===other,
    hash:dartIdentityHash,
    string:(value:DartMap<unknown,unknown>)=>dartMapString(value),
});
export function registerDartMapValueSemantics():void{registerDartValueSemantics(DartMap,mapSemantics);}

export function dartMapString<K,V>(map:DartMap<K,V>,keyString:(key:K)=>string=dartValueString):string{
    if(!DartMap.is(map)||Object.getPrototypeOf(map)!==DartMap.prototype)throw new TypeError('Expected the registered source DartMap representation');
    registerDartMapValueSemantics();
    if(visiting.has(map))return '{...}';
    visiting.add(map);
    try{
        const entries:string[]=[];
        map.forEach((key,value)=>{const renderedKey=keyString(key);entries.push(renderedKey+': '+dartValueString(value));});
        return '{'+entries.join(', ')+'}';
    }finally{visiting.delete(map);}
}
