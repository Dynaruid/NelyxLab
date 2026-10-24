// SPDX-License-Identifier: BSD-3-Clause
import {SourceVerticalOuterDimension,SourceHorizontalInnerDimension,SourceTwoDimensionalScrollableScope} from './two-dimensional-scrollable.generated.ts';
import type {BuildContext} from './framework.ts';
export function isSourceVerticalOuterDimension(value:unknown):value is SourceVerticalOuterDimension{return value instanceof SourceVerticalOuterDimension;}
export function castSourceVerticalOuterDimension(value:unknown):SourceVerticalOuterDimension{if(!isSourceVerticalOuterDimension(value))throw new TypeError('Expected vertical outer Scrollable');return value;}
export function isSourceHorizontalInnerDimension(value:unknown):value is SourceHorizontalInnerDimension{return value instanceof SourceHorizontalInnerDimension;}
export function castSourceHorizontalInnerDimension(value:unknown):SourceHorizontalInnerDimension{if(!isSourceHorizontalInnerDimension(value))throw new TypeError('Expected horizontal inner Scrollable');return value;}
export function dependOnSourceTwoAxis(context:BuildContext):SourceTwoDimensionalScrollableScope|null{return context.maybeDependOn(SourceTwoDimensionalScrollableScope)??null;}
