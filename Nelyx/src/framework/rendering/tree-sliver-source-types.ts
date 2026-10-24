// SPDX-License-Identifier: BSD-3-Clause
// Candidate-only until the complete renderer passes actual Core acceptance.
// Keep lazy source identity reads separate from its superclass module.
import {SourceTreeSliverNodeParentData} from './sliver-tree.generated.ts';
export function isTreeParentData(value:unknown):value is SourceTreeSliverNodeParentData{return value instanceof SourceTreeSliverNodeParentData;}
export function castTreeParentData(value:unknown):SourceTreeSliverNodeParentData{
  if(!isTreeParentData(value))throw new TypeError('Expected actual source tree parent data');
  return value;
}
