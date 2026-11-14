// SPDX-License-Identifier: BSD-3-Clause
import type { EngineNodeSnapshot, EngineResponse, NodeHandle } from './codec.ts';

const indexes = new WeakMap<readonly EngineNodeSnapshot[], Map<number, EngineNodeSnapshot>>();
/** Immutable row arrays can be shared by unchanged observations with different
 * response metadata. Their geometry/focus index depends only on those rows. */
export function observationNode(
  frame: EngineResponse,
  handle: NodeHandle,
): EngineNodeSnapshot | undefined {
  const nodes = frame.nodes;
  let index = indexes.get(nodes);
  if (!index) {
    index = new Map();
    for (const node of nodes) index.set(node.node.slot, node);
    indexes.set(nodes, index);
  }
  const node = index.get(handle.slot);
  return node?.node.generation === handle.generation ? node : undefined;
}
