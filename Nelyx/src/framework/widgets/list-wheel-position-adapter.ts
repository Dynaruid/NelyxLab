// SPDX-License-Identifier: BSD-3-Clause
import { invariant } from '../../foundation/errors.ts';
import type { ScrollContext } from './scroll-context.ts';
import type { SourceFixedExtentMetrics } from './list-wheel-position.generated.ts';

/** Dart implements uses the public metrics surface, not host private storage. */
export type WheelMetricsData = Pick<SourceFixedExtentMetrics, keyof SourceFixedExtentMetrics>;
const extents = new WeakMap<ScrollContext, number | (() => number)>();
/** Preserve the actual Scrollable context and its View/notification/ticker ownership. */
export function bindWheelContext(context: ScrollContext, itemExtent: number): void {
  invariant(
    Number.isFinite(itemExtent) && itemExtent > 0,
    'invalid-wheel-context-extent',
    'Wheel context needs a finite positive extent',
  );
  invariant(
    !extents.has(context) || wheelContextItemExtent(context) === itemExtent,
    'changed-wheel-context-extent',
    'A live wheel context cannot change extent',
  );
  if (!extents.has(context)) extents.set(context, itemExtent);
}
/** Source Scrollable state owns a live widget extent; the finite facade remains fixed. */
export function bindLiveWheelContext(context: ScrollContext, read: () => number): () => void {
  const value = read();
  invariant(
    Number.isFinite(value) && value > 0,
    'invalid-wheel-context-extent',
    'Wheel context needs a finite positive extent',
  );
  const prior = extents.get(context);
  invariant(
    prior === undefined || prior === read,
    'duplicate-wheel-context-owner',
    'A wheel context already has another extent owner',
  );
  extents.set(context, read);
  return () => {
    if (extents.get(context) === read) extents.delete(context);
  };
}
export function isWheelContext(value: unknown): value is ScrollContext {
  return typeof value === 'object' && value !== null && extents.has(value as ScrollContext);
}
export function castWheelContext(value: unknown): ScrollContext {
  invariant(
    isWheelContext(value),
    'invalid-wheel-context',
    'Fixed-extent position requires its registered wheel context',
  );
  return value;
}
export function wheelContextItemExtent(context: ScrollContext): number {
  castWheelContext(context);
  const entry = extents.get(context)!,
    value = typeof entry === 'function' ? entry() : entry;
  invariant(
    Number.isFinite(value) && value > 0,
    'invalid-wheel-context-extent',
    'Wheel context needs a finite positive extent',
  );
  return value;
}
