// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {
  MultiChildRenderObjectWidget,
  MultiChildRenderObjectElement,
  IndexedSlot,
  NotifiableElementMixin,
} from './framework.ts';
import { ViewportElementMixin } from './scroll-notification.ts';
import type { BuildContext, Widget } from './framework.ts';
import type { Key } from '../../foundation/key.ts';
import { sameKey } from '../../foundation/key.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';
import { protect } from '../../ui/value-math.ts';
import { AxisDirection, textDirectionToAxisDirection } from '../painting/basic-types.ts';
import { Directionality } from './app-data.ts';
import {
  RenderViewport,
  RenderShrinkWrappingViewport,
  ScrollCacheExtent,
  CacheExtentStyle,
  SliverPaintOrder,
} from '../rendering/viewport.ts';
import { RenderSliver } from '../rendering/sliver.ts';
import type { RenderObject } from '../rendering/object.ts';
import type { ViewportOffset } from '../rendering/viewport-offset.ts';
export interface ViewportOptions {
  readonly key?: Key | null;
  readonly axisDirection?: AxisDirection;
  readonly crossAxisDirection?: AxisDirection | null;
  readonly anchor?: number;
  readonly offset: ViewportOffset;
  readonly center?: Key | null;
  readonly cacheExtent?: number | null;
  readonly cacheExtentStyle?: CacheExtentStyle;
  readonly scrollCacheExtent?: ScrollCacheExtent | null;
  readonly paintOrder?: SliverPaintOrder;
  readonly clipBehavior?: 'none' | 'hardEdge';
  readonly slivers?: readonly Widget[];
}
export class Viewport extends MultiChildRenderObjectWidget {
  readonly axisDirection: AxisDirection;
  readonly crossAxisDirection: AxisDirection | null;
  readonly anchor: number;
  readonly offset: ViewportOffset;
  readonly center: Key | null;
  readonly cacheExtent: number | null;
  readonly cacheExtentStyle: CacheExtentStyle;
  readonly scrollCacheExtent: ScrollCacheExtent | null;
  readonly paintOrder: SliverPaintOrder;
  readonly clipBehavior: 'none' | 'hardEdge';
  constructor({
    key = null,
    axisDirection = AxisDirection.down,
    crossAxisDirection = null,
    anchor = 0,
    offset,
    center = null,
    cacheExtent = null,
    cacheExtentStyle = CacheExtentStyle.pixel,
    scrollCacheExtent = null,
    paintOrder = SliverPaintOrder.firstIsTop,
    clipBehavior = 'hardEdge',
    slivers = [],
  }: ViewportOptions) {
    super(slivers, { key });
    if (FoundationBuildMode.debug) {
      invariant(
        center === null || slivers.filter((child) => sameKey(child.key, center)).length === 1,
        'invalid-viewport-center-key',
        'Center key must identify exactly one sliver',
      );
      invariant(
        cacheExtent !== null || cacheExtentStyle === CacheExtentStyle.pixel,
        'missing-viewport-cache-extent',
        'Viewport-style cache requires an extent',
      );
    }
    this.axisDirection = axisDirection;
    this.crossAxisDirection = crossAxisDirection;
    this.anchor = anchor;
    this.offset = offset;
    this.center = center;
    this.cacheExtent = cacheExtent;
    this.cacheExtentStyle = cacheExtentStyle;
    this.scrollCacheExtent = scrollCacheExtent;
    this.paintOrder = paintOrder;
    this.clipBehavior = clipBehavior;
    protect(this, [
      'axisDirection',
      'crossAxisDirection',
      'anchor',
      'offset',
      'center',
      'cacheExtent',
      'cacheExtentStyle',
      'scrollCacheExtent',
      'paintOrder',
      'clipBehavior',
    ]);
  }
  static getDefaultCrossAxisDirection(
    context: BuildContext,
    axisDirection: AxisDirection,
  ): AxisDirection {
    return axisDirection === AxisDirection.left || axisDirection === AxisDirection.right
      ? AxisDirection.down
      : textDirectionToAxisDirection(Directionality.of(context));
  }
  private get _effectiveScrollCacheExtent(): ScrollCacheExtent | null {
    return (
      this.scrollCacheExtent ??
      (this.cacheExtent === null
        ? null
        : this.cacheExtentStyle === CacheExtentStyle.pixel
          ? ScrollCacheExtent.pixels(this.cacheExtent)
          : ScrollCacheExtent.viewport(this.cacheExtent))
    );
  }
  createRenderObject(context: BuildContext): RenderViewport {
    return new RenderViewport({
      axisDirection: this.axisDirection,
      crossAxisDirection:
        this.crossAxisDirection ??
        Viewport.getDefaultCrossAxisDirection(context, this.axisDirection),
      anchor: this.anchor,
      offset: this.offset,
      scrollCacheExtent: this._effectiveScrollCacheExtent,
      paintOrder: this.paintOrder,
      clipBehavior: this.clipBehavior,
    });
  }
  override updateRenderObject(context: BuildContext, object: RenderObject): void {
    invariant(
      object instanceof RenderViewport,
      'invalid-viewport-render-object',
      'Viewport requires RenderViewport',
    );
    object.axisDirection = this.axisDirection;
    object.crossAxisDirection =
      this.crossAxisDirection ?? Viewport.getDefaultCrossAxisDirection(context, this.axisDirection);
    object.anchor = this.anchor;
    object.offset = this.offset;
    object.scrollCacheExtent = this._effectiveScrollCacheExtent;
    object.paintOrder = this.paintOrder;
    object.clipBehavior = this.clipBehavior;
  }
  override createElement(): MultiChildRenderObjectElement {
    return new _ViewportElement(this);
  }
}
class _ViewportElement extends ViewportElementMixin(
  NotifiableElementMixin(MultiChildRenderObjectElement),
) {
  private _centerSlotIndex: number | null = null;
  override get renderObject(): RenderViewport {
    return super.renderObject as RenderViewport;
  }
  private _updateCenter(): void {
    const viewport = this.widget as Viewport,
      index =
        viewport.center === null
          ? this.children.length
            ? 0
            : -1
          : this.children.findIndex((child) => sameKey(child.widget.key, viewport.center));
    invariant(
      index >= 0 || viewport.center === null,
      'missing-viewport-center-key',
      'Center key must identify an actual sliver child',
    );
    const render = index < 0 ? null : this.children[index]!.renderObjects[0];
    invariant(
      render === null || render instanceof RenderSliver,
      'invalid-viewport-sliver',
      'Viewport children must produce one RenderSliver',
    );
    this.renderObject.center = render;
    this._centerSlotIndex = index < 0 ? null : index;
  }
  protected override synchronizeRenderObjectChildren(): void {
    super.synchronizeRenderObjectChildren();
    this._updateCenter();
  }
  override insertRenderObjectChild(child: RenderObject, slot: unknown): void {
    super.insertRenderObjectChild(child, slot);
    if (slot instanceof IndexedSlot && slot.index === this._centerSlotIndex) {
      invariant(
        child instanceof RenderSliver,
        'invalid-viewport-sliver',
        'Viewport child must be a RenderSliver',
      );
      this.renderObject.center = child;
    }
  }
  override removeRenderObjectChild(child: RenderObject, slot: unknown): void {
    super.removeRenderObjectChild(child, slot);
    if (this.renderObject.center === child) this.renderObject.center = null;
  }
}
export interface ShrinkWrappingViewportOptions extends Omit<ViewportOptions, 'anchor' | 'center'> {}
export class ShrinkWrappingViewport extends MultiChildRenderObjectWidget {
  readonly axisDirection: AxisDirection;
  readonly crossAxisDirection: AxisDirection | null;
  readonly offset: ViewportOffset;
  readonly paintOrder: SliverPaintOrder;
  readonly clipBehavior: 'none' | 'hardEdge';
  readonly cacheExtent: number | null;
  readonly cacheExtentStyle: CacheExtentStyle;
  readonly scrollCacheExtent: ScrollCacheExtent | null;
  constructor({
    key = null,
    axisDirection = AxisDirection.down,
    crossAxisDirection = null,
    offset,
    paintOrder = SliverPaintOrder.firstIsTop,
    clipBehavior = 'hardEdge',
    cacheExtent = null,
    cacheExtentStyle = CacheExtentStyle.pixel,
    scrollCacheExtent = null,
    slivers = [],
  }: ShrinkWrappingViewportOptions) {
    super(slivers, { key });
    this.axisDirection = axisDirection;
    this.crossAxisDirection = crossAxisDirection;
    this.offset = offset;
    this.paintOrder = paintOrder;
    this.clipBehavior = clipBehavior;
    this.cacheExtent = cacheExtent;
    this.cacheExtentStyle = cacheExtentStyle;
    this.scrollCacheExtent = scrollCacheExtent;
    protect(this, [
      'axisDirection',
      'crossAxisDirection',
      'offset',
      'paintOrder',
      'clipBehavior',
      'cacheExtent',
      'cacheExtentStyle',
      'scrollCacheExtent',
    ]);
  }
  private get effectiveCacheExtent(): ScrollCacheExtent | null {
    return (
      this.scrollCacheExtent ??
      (this.cacheExtent === null
        ? null
        : this.cacheExtentStyle === CacheExtentStyle.pixel
          ? ScrollCacheExtent.pixels(this.cacheExtent)
          : ScrollCacheExtent.viewport(this.cacheExtent))
    );
  }
  createRenderObject(context: BuildContext): RenderShrinkWrappingViewport {
    return new RenderShrinkWrappingViewport({
      axisDirection: this.axisDirection,
      crossAxisDirection:
        this.crossAxisDirection ??
        Viewport.getDefaultCrossAxisDirection(context, this.axisDirection),
      offset: this.offset,
      paintOrder: this.paintOrder,
      clipBehavior: this.clipBehavior,
      scrollCacheExtent: this.effectiveCacheExtent,
    });
  }
  override updateRenderObject(context: BuildContext, object: RenderObject): void {
    invariant(
      object instanceof RenderShrinkWrappingViewport,
      'invalid-shrink-viewport-renderer',
      'ShrinkWrappingViewport requires its actual renderer',
    );
    object.axisDirection = this.axisDirection;
    object.crossAxisDirection =
      this.crossAxisDirection ?? Viewport.getDefaultCrossAxisDirection(context, this.axisDirection);
    object.offset = this.offset;
    object.paintOrder = this.paintOrder;
    object.clipBehavior = this.clipBehavior;
    object.scrollCacheExtent = this.effectiveCacheExtent;
  }
}
