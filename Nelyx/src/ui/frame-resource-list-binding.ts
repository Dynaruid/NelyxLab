// SPDX-License-Identifier: BSD-3-Clause
import type { ResourceId } from './types.ts';
// Only completed frame admission marks a list. Registry ownership checks can
// read this sidecar without importing Canvas/Path/Paint assembly.
const lists = new WeakSet<readonly ResourceId[]>();
export function captureFrameResourceList(resources: readonly ResourceId[]): void {
  lists.add(resources);
}
export function capturedFrameResourceList(resources: readonly ResourceId[]): boolean {
  return lists.has(resources);
}
