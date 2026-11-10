// SPDX-License-Identifier: BSD-3-Clause
import { SliverGridRegularTileLayout } from './sliver-grid.ts';
import type { SliverGridDelegate } from './sliver-grid.ts';
import type { SliverConstraints } from './sliver.ts';
const delegates = new WeakMap<
  object,
  {
    getLayout: SliverGridDelegate['getLayout'];
    shouldRelayout: SliverGridDelegate['shouldRelayout'];
  }
>();
/** @internal A generated source owner opts its exact regular-grid delegate in.
 * Core still measures children and places/scrolls rows. The source callback
 * derives the regular tile parameters from Content's actual constraints. */
export function registerNativeRegularGridDelegate(prototype: SliverGridDelegate): void {
  if (delegates.has(prototype)) throw Error('Native grid delegate already registered');
  delegates.set(prototype, {
    getLayout: prototype.getLayout,
    shouldRelayout: prototype.shouldRelayout,
  });
}
export function nativeRegularGridLayout(
  delegate: SliverGridDelegate,
  constraints: SliverConstraints,
): SliverGridRegularTileLayout {
  const owner = delegates.get(Object.getPrototypeOf(delegate));
  if (
    !owner ||
    delegate.getLayout !== owner.getLayout ||
    delegate.shouldRelayout !== owner.shouldRelayout
  )
    throw Error('Unregistered or overridden native grid delegate');
  const layout = delegate.getLayout(constraints);
  if (Object.getPrototypeOf(layout) !== SliverGridRegularTileLayout.prototype)
    throw Error('Native grid requires an original regular-tile layout');
  return layout as SliverGridRegularTileLayout;
}
