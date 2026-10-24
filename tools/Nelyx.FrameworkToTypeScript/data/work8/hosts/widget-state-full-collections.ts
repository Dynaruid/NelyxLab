// SPDX-License-Identifier: BSD-3-Clause
// The enum is read only when a source constructor runs, after registration.
import {SourceWidgetState,SourceWidgetStatesConstraint,SourceAnyWidgetStates,SourceWidgetStateProperty} from './widget-state.generated.ts';
import {widgetStateSet,widgetStateConstraintKeyPolicy} from './widget-state-constraint-source-adapter.ts';
import {DartMap,type DartSet,type DartKeyPolicy} from '../../foundation/dart-collections.ts';
import {DartDouble} from '../../foundation/dart-numeric.ts';
import {applyDartType,captureDartType,dartDoubleType,nullableDartType,type DartTypeWitness} from '../../foundation/dart-type-witness.ts';
import {canonicalDartMap,registerDartConstSingletons} from '../../foundation/dart-const.ts';
export function emptyWidgetStateSet():DartSet<SourceWidgetState>{return widgetStateSet(SourceWidgetState);}
export function emptyDoubleWidgetStateMap():DartMap<SourceWidgetStatesConstraint,DartDouble>{return new DartMap(widgetStateConstraintKeyPolicy(SourceWidgetStatesConstraint),DartDouble.is);}
export function emptyNullableDoubleWidgetStateMap():DartMap<SourceWidgetStatesConstraint,DartDouble|null>{return new DartMap(widgetStateConstraintKeyPolicy(SourceWidgetStatesConstraint),(value):value is DartDouble|null=>value===null||DartDouble.is(value));}
export function widgetStateDoubleFromMap(map:DartMap<SourceWidgetStatesConstraint,DartDouble>):SourceWidgetStateProperty<DartDouble>{return SourceWidgetStateProperty.fromMap(dartDoubleType,map);}

let constantDomain:{readonly type:DartTypeWitness<SourceWidgetStatesConstraint>;readonly policy:DartKeyPolicy<SourceWidgetStatesConstraint>}|undefined;
function constDomain():NonNullable<typeof constantDomain>{
    if(constantDomain)return constantDomain;
    const type=applyDartType<SourceWidgetStatesConstraint>(SourceWidgetStatesConstraint,'WidgetStatesConstraint',[],[]);
    const policy=widgetStateConstraintKeyPolicy(SourceWidgetStatesConstraint);
    const state=applyDartType<SourceWidgetState>(SourceWidgetState,'WidgetState',[],[type]);
    const any=applyDartType<SourceAnyWidgetStates>(SourceAnyWidgetStates,'_AnyWidgetStates',[],[type]);
    registerDartConstSingletons(SourceWidgetState,SourceWidgetState.values);
    registerDartConstSingletons(SourceAnyWidgetStates,[SourceWidgetState.any]);
    for(const value of SourceWidgetState.values)captureDartType(value,state);
    captureDartType(SourceWidgetState.any,any);
    constantDomain=Object.freeze({type,policy});
    return constantDomain;
}
export function constDoubleWidgetStateMap(entries:readonly(readonly[SourceWidgetStatesConstraint,DartDouble])[]):DartMap<SourceWidgetStatesConstraint,DartDouble>{const domain=constDomain();return canonicalDartMap(domain.type,dartDoubleType,domain.policy,entries);}
export function constNullableDoubleWidgetStateMap(entries:readonly(readonly[SourceWidgetStatesConstraint,DartDouble|null])[]):DartMap<SourceWidgetStatesConstraint,DartDouble|null>{const domain=constDomain();return canonicalDartMap(domain.type,nullableDartType(dartDoubleType),domain.policy,entries);}
