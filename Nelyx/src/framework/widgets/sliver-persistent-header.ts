// SPDX-License-Identifier: BSD-3-Clause
// Nelyx delegate API with Flutter-shaped selected compatibility; no implicit snap/stretch policy.
import { invariant } from '../../foundation/errors.ts';
import { AbstractLayoutBuilder } from './layout-builder.ts';
import type { BuildContext, Widget, WidgetOptions } from './framework.ts';
import { Widget as WidgetValue } from './framework.ts';
import { RenderSliverPersistentHeader } from '../rendering/sliver-persistent-header.ts';
import type { PersistentHeaderLayoutInfo } from '../rendering/sliver-persistent-header.ts';

export abstract class SliverPersistentHeaderDelegate {
  abstract get minExtent(): number;
  abstract get maxExtent(): number;
  abstract build(context: BuildContext, shrinkOffset: number, overlapsContent: boolean): Widget;
  abstract shouldRebuild(old: SliverPersistentHeaderDelegate): boolean;
}
export interface SliverPersistentHeaderOptions extends WidgetOptions {
  readonly delegate: SliverPersistentHeaderDelegate;
  readonly pinned?: boolean;
  readonly floating?: boolean;
}
/** Header State/keys belong to the actual layout Element; delegate builders run inside its bounded layout build scope. */
export class SliverPersistentHeader extends AbstractLayoutBuilder<PersistentHeaderLayoutInfo> {
  readonly delegate: SliverPersistentHeaderDelegate;
  readonly pinned: boolean;
  readonly floating: boolean;
  constructor(options: SliverPersistentHeaderOptions) {
    super(options);
    this.delegate = options.delegate;
    this.pinned = options.pinned ?? false;
    this.floating = options.floating ?? false;
    this.check();
  }
  private check(): void {
    invariant(
      this.delegate instanceof SliverPersistentHeaderDelegate,
      'invalid-header-delegate',
      'A SliverPersistentHeaderDelegate is required',
    );
    invariant(
      Number.isFinite(this.delegate.minExtent) &&
        this.delegate.minExtent >= 0 &&
        Number.isFinite(this.delegate.maxExtent) &&
        this.delegate.maxExtent >= this.delegate.minExtent,
      'invalid-header-extents',
      'Header extents must be finite and 0 <= minExtent <= maxExtent',
    );
    invariant(
      typeof this.pinned === 'boolean' && typeof this.floating === 'boolean',
      'invalid-header-mode',
      'Header modes must be booleans',
    );
  }
  readonly builder = (context: BuildContext, info: PersistentHeaderLayoutInfo): Widget => {
    const child = this.delegate.build(context, info.shrinkOffset, info.overlapsContent);
    invariant(
      child instanceof WidgetValue,
      'invalid-header-child',
      'Header delegate must synchronously return a box Widget',
    );
    return child;
  };
  override updateShouldRebuild(old: AbstractLayoutBuilder<PersistentHeaderLayoutInfo>): boolean {
    return (
      !(old instanceof SliverPersistentHeader) ||
      old.pinned !== this.pinned ||
      old.floating !== this.floating ||
      old.delegate.constructor !== this.delegate.constructor ||
      this.delegate.shouldRebuild(old.delegate)
    );
  }
  createRenderObject(_context: BuildContext): RenderSliverPersistentHeader {
    this.check();
    return new RenderSliverPersistentHeader({
      minExtent: this.delegate.minExtent,
      maxExtent: this.delegate.maxExtent,
      pinned: this.pinned,
      floating: this.floating,
    });
  }
  override updateRenderObject(_context: BuildContext, render: RenderSliverPersistentHeader): void {
    this.check();
    render.configure({
      minExtent: this.delegate.minExtent,
      maxExtent: this.delegate.maxExtent,
      pinned: this.pinned,
      floating: this.floating,
    });
  }
}
