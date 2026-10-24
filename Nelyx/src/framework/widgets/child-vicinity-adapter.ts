// SPDX-License-Identifier: BSD-3-Clause
import {ChildVicinity} from './child-vicinity.generated.ts';
import {checkedInteger} from '../../ui/value-math.ts';
export interface DartComparable<T>{compareTo(other:T):number;}
export function integerString(value:number):string{return String(checkedInteger(value));}
export function isChildVicinity(value:unknown):value is ChildVicinity{return value instanceof ChildVicinity;}
export function castChildVicinity(value:unknown):ChildVicinity{if(!isChildVicinity(value))throw new TypeError('Expected ChildVicinity');return value;}
