// SPDX-License-Identifier: BSD-3-Clause
// Keep source runtime identity checks out of its superclass module. Both import
// orders must work: importing the base adapter cannot eagerly re-enter a class
// which still needs that adapter to initialize its superclass.
import {SourceListWheelParentData} from './list-wheel-viewport.generated.ts';
import {invariant} from '../../foundation/errors.ts';
export function isWheelParentData(value:unknown):value is SourceListWheelParentData{return value instanceof SourceListWheelParentData;}
export function castWheelParentData(value:unknown):SourceListWheelParentData{invariant(isWheelParentData(value),'invalid-wheel-parent-data','Expected actual source wheel parent data');return value;}
