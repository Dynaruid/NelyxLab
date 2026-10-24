// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2013, the Dart project authors. All rights reserved.
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from collection 1.19.1 equality.dart and pinned foundation/collections.dart.
import {DartMap} from './dart-collections.ts';
import {dartValueEquals,dartValueHash} from './dart-value.ts';

/** Flutter foundation mapEquals over the actual ordered Core Map boundary.
 * Value comparison is receiver-directed: b[key] == a[key], as in the source. */
export function dartMapEquals<K,V>(a:DartMap<K,V>|null,b:DartMap<K,V>|null):boolean{
    if(a!==null&&!(a instanceof DartMap)||b!==null&&!(b instanceof DartMap))throw new TypeError('Expected source DartMap values');
    if(a===null)return b===null;
    if(b===null||a.length!==b.length)return false;
    if(a===b)return true;
    for(const key of a.keys)if(!b.containsKey(key)||!dartValueEquals(b.get(key),a.get(key)))return false;
    return true;
}

/** Selected package:collection 1.19.1 MapEquality.hash contract only. This is
 * not an implementation of MapEquality.equals/isValidKey or custom equalities.
 * The checked value conversion preserves the source `map[key] as V`, including
 * removal during a key hash callback. Hash integers use the local Object ABI. */
export class DartMapHash<V>{
    constructor(private readonly checkedValue:(value:unknown)=>V){}
    hash<K>(map:DartMap<K,V>|null):number{
        if(map===null)return dartValueHash(null);
        if(!(map instanceof DartMap))throw new TypeError('Expected a source DartMap');
        const mask=0x7fffffff;
        let hash=0;
        for(const key of map.keys){
            const keyHash=dartValueHash(key);
            const valueHash=dartValueHash(this.checkedValue(map.get(key)));
            // Reduce safe integer hashes before multiplication: the sum stays
            // below 2^35, and reduction modulo 2^31 preserves the Dart result.
            hash=(hash+3*(keyHash&mask)+7*(valueHash&mask))&mask;
        }
        hash=(hash+(hash<<3))&mask;
        hash^=hash>>11;
        return (hash+(hash<<15))&mask;
    }
}
