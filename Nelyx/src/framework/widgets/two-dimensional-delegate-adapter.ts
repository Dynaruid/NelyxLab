// SPDX-License-Identifier: BSD-3-Clause
// Exact host boundaries for the complete pinned two-dimensional child delegates.
import { DartMap, DartSet } from '../../foundation/dart-collections.ts';
import type { Selectable } from '../rendering/selection.ts';
import { RepaintBoundary } from './repaint-boundary.ts';
import type { Widget } from './framework.ts';
export type HostStackTrace = string;
export function createTwoDimensionalRepaintBoundary({ child }: { child: Widget }): RepaintBoundary {
  return new RepaintBoundary(child);
}
const selectablePolicy = {
  accepts: (value: unknown): value is Selectable =>
    typeof value === 'object' &&
    value !== null &&
    'value' in value &&
    typeof (value as Selectable).addListener === 'function' &&
    typeof (value as Selectable).removeListener === 'function',
  hash: (value: unknown) => value,
  equals: (a: Selectable, b: unknown) => a === b,
};
/** Core Selectable instances use object identity for equality and hash keys. */
export function createSelectableSet(): DartSet<Selectable> {
  return new DartSet(selectablePolicy);
}
export function createSelectableMap(): DartMap<Selectable, () => void> {
  return new DartMap(selectablePolicy, (value): value is () => void => typeof value === 'function');
}
