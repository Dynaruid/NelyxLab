// SPDX-License-Identifier: BSD-3-Clause
import { SliverGridRegularTileLayout } from './sliver-grid.ts';
import type { SliverGridDelegate } from './sliver-grid.ts';
import type { SliverConstraints } from './sliver.ts';
/** Exact source policy for a finite grid whose complete contents fit its
 * viewport. Content evaluates min(maximumRowExtent, viewportHeight / rows).
 * This is an explicit module opt-in, never inferred from sampled layouts. */
export interface NativeViewportGridPolicy {
  readonly columns: number;
  readonly rows: number;
  readonly maximumRowExtent: number;
}
const delegates = new WeakMap<
  object,
  {
    getLayout: SliverGridDelegate['getLayout'];
    shouldRelayout: SliverGridDelegate['shouldRelayout'];
    viewport?: (delegate: SliverGridDelegate) => NativeViewportGridPolicy;
  }
>();
/** @internal A generated source owner opts its exact regular-grid delegate in.
 * Core still measures children and places/scrolls rows. The source callback
 * derives the regular tile parameters from Content's actual constraints. */
export function registerNativeRegularGridDelegate<T extends SliverGridDelegate>(
  prototype: T,
  viewport?: (delegate: T) => NativeViewportGridPolicy,
): void {
  if (delegates.has(prototype)) throw Error('Native grid delegate already registered');
  delegates.set(prototype, {
    getLayout: prototype.getLayout,
    shouldRelayout: prototype.shouldRelayout,
    ...(viewport
      ? { viewport: viewport as (delegate: SliverGridDelegate) => NativeViewportGridPolicy }
      : {}),
  });
}
export function nativeViewportGridPolicy(
  delegate: SliverGridDelegate,
  count: number,
): NativeViewportGridPolicy | undefined {
  const owner = delegates.get(Object.getPrototypeOf(delegate));
  if (
    !owner ||
    delegate.getLayout !== owner.getLayout ||
    delegate.shouldRelayout !== owner.shouldRelayout
  )
    throw Error('Unregistered or overridden native grid delegate');
  const policy = owner.viewport?.(delegate);
  if (!policy) return;
  if (
    !Number.isSafeInteger(policy.columns) ||
    policy.columns < 1 ||
    !Number.isSafeInteger(policy.rows) ||
    policy.rows < 1 ||
    !Number.isFinite(policy.maximumRowExtent) ||
    policy.maximumRowExtent <= 0
  )
    throw Error('Invalid native viewport grid policy');
  return count <= policy.columns * policy.rows ? policy : undefined;
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
