// SPDX-License-Identifier: BSD-3-Clause
import {registerDartValueSemantics} from '../../foundation/dart-value.ts';
import {hasCapturedDartType} from '../../foundation/dart-type-witness.ts';
import {registerDartMapValueSemantics} from '../../foundation/dart-map-string.ts';
import {isRegisteredWidgetStateConstraint,widgetStateConstraintEquals,widgetStateConstraintHash,widgetStateConstraintString} from './widget-state-constraint-source-adapter.ts';

type ConstraintOwner=Function&{readonly prototype:object};
interface PropertyValue {equals(other:{}):boolean;readonly hashCode:number;toString():string}
type PropertyOwner=Function&{readonly prototype:PropertyValue};
const constraintSemantics=Object.freeze({accepts:isRegisteredWidgetStateConstraint,equals:widgetStateConstraintEquals,hash:widgetStateConstraintHash,string:widgetStateConstraintString});
/** Module-owned exact generated tokens. All equality/hash algorithms continue to
 * execute the original generated members; the constraint domain stays closed. */
export function registerWidgetStateValueSemantics(constraints:readonly ConstraintOwner[],properties:readonly PropertyOwner[]):void{
    registerDartMapValueSemantics();
    for(const owner of constraints)registerDartValueSemantics(owner,constraintSemantics);
    for(const owner of properties)registerDartValueSemantics(owner,{
        accepts:(value:unknown):value is PropertyValue=>hasCapturedDartType(value,owner),
        equals:(value,other)=>value.equals(other),
        hash:value=>value.hashCode,
        string:value=>value.toString(),
    });
}
