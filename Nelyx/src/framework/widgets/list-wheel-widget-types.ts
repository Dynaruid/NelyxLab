// SPDX-License-Identifier: BSD-3-Clause
// Source identity checks are separated from the base hosts to admit either import order.
import {SourceFixedExtentScrollable,SourceListWheelViewport,SourceListWheelElement} from './list-wheel-widget.generated.ts';
import {invariant} from '../../foundation/errors.ts';
export function castSourceFixedExtentScrollable(value:unknown):SourceFixedExtentScrollable{invariant(value instanceof SourceFixedExtentScrollable,'invalid-wheel-scrollable','Expected source wheel Scrollable');return value;}
export function castSourceListWheelElement(value:unknown):SourceListWheelElement{invariant(value instanceof SourceListWheelElement,'invalid-wheel-element','Expected source wheel Element');return value;}
export function castSourceListWheelViewport(value:unknown):SourceListWheelViewport{invariant(value instanceof SourceListWheelViewport,'invalid-wheel-widget','Expected source wheel Viewport');return value;}
