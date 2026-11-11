// SPDX-License-Identifier: BSD-3-Clause
import type { EngineNodeSnapshot, EngineResponse, NodeHandle } from './codec.ts';

const indexes = new WeakMap<EngineResponse, Map<number, EngineNodeSnapshot>>();
/** One immutable cohort index shared by geometry, focus and ancestor walks. */
export function observationNode(
  frame: EngineResponse,
  handle: NodeHandle,
): EngineNodeSnapshot | undefined {
  let index = indexes.get(frame);
  if (!index) {
    index = new Map();
    for (const node of frame.nodes) index.set(node.node.slot, node);
    indexes.set(frame, index);
  }
  const node = index.get(handle.slot);
  return node?.node.generation === handle.generation ? node : undefined;
}
