// SPDX-License-Identifier: BSD-3-Clause
import {SourceScrollableDetails} from './scrollable-details.generated.ts';
export function isSourceScrollableDetails(value:unknown):value is SourceScrollableDetails{return value instanceof SourceScrollableDetails;}
export function castSourceScrollableDetails(value:unknown):SourceScrollableDetails{if(!isSourceScrollableDetails(value))throw new TypeError('Expected ScrollableDetails');return value;}
