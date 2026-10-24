// SPDX-License-Identifier: BSD-3-Clause
import {dartValueHash,registerDartValueSemantics} from './dart-value.ts';
import {applyDartType,captureDartType} from './dart-type-witness.ts';

/** Constructor-created Dart Symbol names. Private library symbol literals and
 * const canonicalization need their own explicit origin/identity boundary. */
export class DartSymbol {
    readonly #name:string;
    constructor(name:string){
        if(typeof name!=='string')throw new TypeError('Dart Symbol requires a name string');
        this.#name=name;
        captureDartType(this,dartSymbolType);
        Object.freeze(this);
    }
    static is(value:unknown):value is DartSymbol{return value!==null&&typeof value==='object'&&#name in value;}
    equals(other:unknown):boolean{return DartSymbol.is(other)&&this.#name===other.#name;}
    get hashCode():number{return dartValueHash(this.#name);}
    toString():string{return 'Symbol("'+this.#name+'")';}
}
export const dartSymbolType=applyDartType<DartSymbol>(DartSymbol,'Symbol',[],[]);
export function dartSymbolString(value:DartSymbol):string{if(!DartSymbol.is(value))throw new TypeError('Expected a represented Dart Symbol');return value.toString();}
registerDartValueSemantics(DartSymbol,{accepts:DartSymbol.is,equals:(value,other)=>value.equals(other),hash:value=>value.hashCode,string:dartSymbolString});
