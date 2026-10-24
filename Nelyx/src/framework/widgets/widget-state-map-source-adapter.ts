// SPDX-License-Identifier: BSD-3-Clause
import {DartMapHash} from '../../foundation/dart-map-equality.ts';
import {castDartType,describeDartType} from '../../foundation/dart-type-witness.ts';
import type {DartTypeWitness} from '../../foundation/dart-type-witness.ts';
import {DartSet,DartMap} from '../../foundation/dart-collections.ts';
import {dartMapString} from '../../foundation/dart-map-string.ts';
import {DiagnosticsProperty} from '../../foundation/diagnostics.ts';
import type {DiagnosticsStringOptions} from '../../foundation/diagnostics.ts';
import {isRegisteredWidgetState,isRegisteredWidgetStateConstraint,widgetStateConstraintString} from './widget-state-constraint-source-adapter.ts';

export function createWidgetStateMapHash<T>(type:DartTypeWitness<T>):DartMapHash<T>{return new DartMapHash(value=>castDartType(value,type));}
export function widgetStateSetString<T extends object>(states:DartSet<T>):string{
    if(!(states instanceof DartSet))throw new TypeError('Expected a source widget state Set');
    const values:string[]=[];
    for(const value of states){if(!isRegisteredWidgetState(value))throw new TypeError('Expected a registered widget state');values.push(widgetStateConstraintString(value));}
    return '{'+values.join(', ')+'}';
}

export function widgetStateMapString<K extends object,V>(map:DartMap<K,V>):string{
    return dartMapString(map,key=>{
        if(!isRegisteredWidgetStateConstraint(key))throw new TypeError('Expected a registered widget state constraint');
        return widgetStateConstraintString(key);
    });
}

/** Preserve value identity and defer conversion until diagnostics requests it. */
class WidgetStateMapDiagnostics<K extends object,V> extends DiagnosticsProperty<DartMap<K,V>>{
    constructor(type:DartTypeWitness<V>,name:string|null,value:DartMap<K,V>|null){
        super(name,value,{typeName:'Map<WidgetStatesConstraint, '+describeDartType(type)+'>'});
    }
    override valueToString(_options:DiagnosticsStringOptions={}):string{return this.value===null?'null':widgetStateMapString(this.value);}
}
export function createWidgetStateMapDiagnostics<K extends object,V>(type:DartTypeWitness<V>,name:string|null,value:DartMap<K,V>|null):DiagnosticsProperty<DartMap<K,V>>{
    return new WidgetStateMapDiagnostics(type,name,value);
}
