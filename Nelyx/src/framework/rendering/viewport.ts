// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { RenderBox, RenderObject } from './object.ts';
import type {
  PipelineOwner,
  HitTestEntry as LegacyHitTestEntry,
  ShowOnScreenOptions,
} from './object.ts';
import { BoxConstraints } from './constraints.ts';
import {
  RenderSliver,
  SliverConstraints,
  SliverHitTestResult,
  SliverPhysicalParentData,
  SliverPhysicalContainerParentData,
  SliverLogicalParentData,
  SliverLogicalContainerParentData,
  GrowthDirection,
  applyGrowthDirectionToAxisDirection,
  applyGrowthDirectionToScrollDirection,
} from './sliver.ts';
import type { SliverGeometry } from './sliver.ts';
import { ViewportOffset } from './viewport-offset.ts';
import { Axis, AxisDirection, axisDirectionToAxis } from '../painting/basic-types.ts';
import { hashValues } from '../painting/value-equality.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';
import { diagnosticDoubleString } from '../../foundation/debug.ts';
import { clampDouble } from '../../ui/math.ts';
import { protect } from '../../ui/value-math.ts';
import { Offset } from '../../ui/offset.ts';
import {
  multiply,
  translate,
  identity,
  contains,
  inversePaintTransform,
  transform,
} from '../../ui/geometry.ts';
import type { Size, TransformMatrix, Offset as Point } from '../../ui/geometry.ts';
import type { PaintingContext } from '../painting/context.ts';
import { Matrix4 } from '../../math/matrix4.ts';
import { Rect } from '../../ui/rect.ts';
import type { Rect as RectGeometry } from '../../ui/types.ts';
import { MatrixUtils } from '../painting/matrix-utils.ts';
import { Curves } from '../animation/curves.ts';
import type { Curve } from '../animation/curves.ts';
import { FlutterError } from '../../foundation/flutter-error.ts';
import { FlutterErrorDetails } from '../../foundation/assertions.ts';
import { SemanticsTag } from '../semantics/semantics.ts';
import type { SemanticsConfiguration } from '../semantics/semantics.ts';

function valueRect(rect: RectGeometry): Rect {
  return rect instanceof Rect ? rect : Rect.fromLTWH(rect.x, rect.y, rect.width, rect.height);
}
export class RevealedOffset {
  constructor(
    readonly offset: number,
    readonly rect: Rect,
  ) {
    protect(this, ['offset', 'rect']);
  }
  static clampOffset({
    leadingEdgeOffset,
    trailingEdgeOffset,
    currentOffset,
  }: {
    readonly leadingEdgeOffset: RevealedOffset;
    readonly trailingEdgeOffset: RevealedOffset;
    readonly currentOffset: number;
  }): RevealedOffset | null {
    const inverted = leadingEdgeOffset.offset < trailingEdgeOffset.offset,
      smaller = inverted ? leadingEdgeOffset : trailingEdgeOffset,
      larger = inverted ? trailingEdgeOffset : leadingEdgeOffset;
    return currentOffset > larger.offset ? larger : currentOffset < smaller.offset ? smaller : null;
  }
  toString(): string {
    return `RevealedOffset(offset: ${this.offset}, rect: ${this.rect})`;
  }
}
export abstract class RenderAbstractViewport<
  Child extends RenderObject = RenderSliver,
> extends RenderBox<Child> {
  static maybeOf(object: RenderObject | null): RenderAbstractViewport<RenderObject> | null {
    for (let current: RenderObject | undefined | null = object; current; current = current.parent)
      if (current instanceof RenderAbstractViewport) return current;
    return null;
  }
  static of(object: RenderObject | null): RenderAbstractViewport<RenderObject> {
    const viewport = this.maybeOf(object);
    invariant(viewport, 'missing-render-viewport', 'No RenderAbstractViewport ancestor');
    return viewport;
  }
  abstract getOffsetToReveal(
    target: RenderObject,
    alignment: number,
    options?: { readonly rect?: RectGeometry | null; readonly axis?: Axis | null },
  ): RevealedOffset;
}

export class CacheExtentStyle {
  static readonly pixel = new CacheExtentStyle(0, 'pixel');
  static readonly viewport = new CacheExtentStyle(1, 'viewport');
  static readonly values = Object.freeze([CacheExtentStyle.pixel, CacheExtentStyle.viewport]);
  private constructor(
    readonly index: number,
    readonly name: string,
  ) {
    Object.freeze(this);
  }
  toString(): string {
    return 'CacheExtentStyle.' + this.name;
  }
}
export class SliverPaintOrder {
  static readonly firstIsTop = new SliverPaintOrder(0, 'firstIsTop');
  static readonly lastIsTop = new SliverPaintOrder(1, 'lastIsTop');
  static readonly values = Object.freeze([SliverPaintOrder.firstIsTop, SliverPaintOrder.lastIsTop]);
  private constructor(
    readonly index: number,
    readonly name: string,
  ) {
    Object.freeze(this);
  }
  toString(): string {
    return 'SliverPaintOrder.' + this.name;
  }
}
export abstract class ScrollCacheExtent {
  static pixels(pixels: number): ScrollCacheExtent {
    return new _PixelScrollCacheExtent(pixels);
  }
  static viewport(value: number): ScrollCacheExtent {
    return new _ViewportScrollCacheExtent(value);
  }
  abstract _calculateCacheOffset(mainAxisExtent: number): number;
  abstract get style(): CacheExtentStyle;
  abstract get value(): number;
  abstract equals(other: unknown): boolean;
  abstract get hashCode(): number;
}
class _PixelScrollCacheExtent extends ScrollCacheExtent {
  constructor(readonly pixels: number) {
    super();
    protect(this, ['pixels']);
  }
  _calculateCacheOffset(_mainAxisExtent: number): number {
    return this.pixels;
  }
  get style(): CacheExtentStyle {
    return CacheExtentStyle.pixel;
  }
  get value(): number {
    return this.pixels;
  }
  equals(other: unknown): boolean {
    return (
      this === other || (other instanceof _PixelScrollCacheExtent && other.pixels === this.pixels)
    );
  }
  get hashCode(): number {
    return hashValues(this.pixels);
  }
  toString(): string {
    return `ScrollCacheExtent.pixels(${diagnosticDoubleString(this.pixels)})`;
  }
}
class _ViewportScrollCacheExtent extends ScrollCacheExtent {
  constructor(readonly value: number) {
    super();
    protect(this, ['value']);
  }
  _calculateCacheOffset(mainAxisExtent: number): number {
    return this.value * mainAxisExtent;
  }
  get style(): CacheExtentStyle {
    return CacheExtentStyle.viewport;
  }
  equals(other: unknown): boolean {
    return (
      this === other || (other instanceof _ViewportScrollCacheExtent && other.value === this.value)
    );
  }
  get hashCode(): number {
    return hashValues(this.value);
  }
  toString(): string {
    return `ScrollCacheExtent.viewport(${diagnosticDoubleString(this.value)})`;
  }
}
export interface RenderViewportBaseOptions {
  readonly axisDirection?: AxisDirection;
  readonly crossAxisDirection: AxisDirection;
  readonly offset: ViewportOffset;
  readonly scrollCacheExtent?: ScrollCacheExtent | null;
  readonly cacheExtent?: number | null;
  readonly cacheExtentStyle?: CacheExtentStyle;
  readonly paintOrder?: SliverPaintOrder;
  readonly clipBehavior?: 'none' | 'hardEdge';
}
export interface SliverChildSequence {
  readonly child: RenderSliver | null;
  readonly scrollOffset: number;
  readonly overlap: number;
  readonly layoutOffset: number;
  readonly remainingPaintExtent: number;
  readonly mainAxisExtent: number;
  readonly crossAxisExtent: number;
  readonly growthDirection: GrowthDirection;
  readonly advance: (child: RenderSliver) => RenderSliver | null;
  readonly remainingCacheExtent: number;
  readonly cacheOrigin: number;
}
/** Source sequence and offset protocol; this host enforces a finite View boundary. */
export abstract class RenderViewportBase extends RenderAbstractViewport {
  protected override markNeedsPaintAfterLayout(): void {
    if (
      this.markNeedsPaint === RenderObject.prototype.markNeedsPaint &&
      this.describeSemanticsConfiguration ===
        RenderViewportBase.prototype.describeSemanticsConfiguration &&
      this.semanticsTransport === null
    )
      this.markNeedsPaintAfterGeometryLayout();
    else super.markNeedsPaintAfterLayout();
  }
  override describeSemanticsConfiguration(config: SemanticsConfiguration): void {
    super.describeSemanticsConfiguration(config);
    config.addTagForChildren(RenderViewport.useTwoPaneSemantics);
  }
  override visitChildrenForSemantics(visitor: (child: RenderObject) => void): void {
    for (const child of this.childrenInPaintOrder) {
      const geometry = child.geometry;
      invariant(
        geometry !== null,
        'missing-sliver-geometry',
        'Semantics requires laid out viewport children',
      );
      if (geometry.visible || geometry.cacheExtent > 0 || child.ensureSemantics) visitor(child);
    }
  }
  override describeApproximatePaintClip(child: RenderObject): Rect | null {
    const sliver = child as RenderSliver,
      geometry = sliver.geometry!;
    if (sliver.ensureSemantics && !(geometry.visible || geometry.cacheExtent > 0)) return null;
    if (this.clipBehavior === 'none') return null;
    const viewportClip = Rect.fromLTWH(0, 0, this.size.width, this.size.height),
      constraints = sliver.constraints;
    if (constraints.overlap === 0 || !Number.isFinite(constraints.viewportMainAxisExtent))
      return viewportClip;
    let { left, right, top, bottom } = viewportClip;
    const overlapCorrection =
      constraints.viewportMainAxisExtent - constraints.remainingPaintExtent + constraints.overlap;
    switch (applyGrowthDirectionToAxisDirection(this.axisDirection, constraints.growthDirection)) {
      case AxisDirection.down:
        top += overlapCorrection;
        break;
      case AxisDirection.up:
        bottom -= overlapCorrection;
        break;
      case AxisDirection.right:
        left += overlapCorrection;
        break;
      case AxisDirection.left:
        right -= overlapCorrection;
        break;
    }
    return Rect.fromLTRB(left, top, right, bottom);
  }
  override describeSemanticsClip(child: RenderObject | null): Rect | null {
    const sliver = child as RenderSliver | null;
    if (
      sliver !== null &&
      sliver.ensureSemantics &&
      !(sliver.geometry!.visible || sliver.geometry!.cacheExtent > 0)
    )
      return null;
    const bounds = valueRect(this.semanticBounds),
      cache = this._calculatedCacheExtent;
    if (cache === null) return bounds;
    return this.axis === Axis.vertical
      ? Rect.fromLTRB(bounds.left, bounds.top - cache, bounds.right, bounds.bottom + cache)
      : Rect.fromLTRB(bounds.left - cache, bounds.top, bounds.right + cache, bounds.bottom);
  }
  private _axisDirection: AxisDirection;
  private _crossAxisDirection: AxisDirection;
  private _offset: ViewportOffset;
  private _scrollCacheExtent: ScrollCacheExtent;
  private _paintOrder: SliverPaintOrder;
  private _clipBehavior: 'none' | 'hardEdge';
  protected _calculatedCacheExtent = 0;
  private observingOffset = false;
  private readonly offsetChanged = () => this.markNeedsLayout();
  constructor({
    axisDirection = AxisDirection.down,
    crossAxisDirection,
    offset,
    scrollCacheExtent,
    cacheExtent,
    cacheExtentStyle = CacheExtentStyle.pixel,
    paintOrder = SliverPaintOrder.firstIsTop,
    clipBehavior = 'hardEdge',
  }: RenderViewportBaseOptions) {
    super({ childType: RenderSliver });
    if (FoundationBuildMode.debug) {
      invariant(
        axisDirectionToAxis(axisDirection) !== axisDirectionToAxis(crossAxisDirection),
        'invalid-viewport-axes',
        'Viewport axes must be perpendicular',
      );
      invariant(
        cacheExtent != null || cacheExtentStyle === CacheExtentStyle.pixel,
        'missing-viewport-cache-extent',
        'Viewport-style cache requires an extent',
      );
    }
    this._axisDirection = axisDirection;
    this._crossAxisDirection = crossAxisDirection;
    this._offset = offset;
    this._scrollCacheExtent =
      scrollCacheExtent ??
      (cacheExtentStyle === CacheExtentStyle.pixel
        ? ScrollCacheExtent.pixels(cacheExtent ?? 250)
        : ScrollCacheExtent.viewport(cacheExtent!));
    this._paintOrder = paintOrder;
    this._clipBehavior = clipBehavior;
  }
  get axisDirection(): AxisDirection {
    return this._axisDirection;
  }
  set axisDirection(value: AxisDirection) {
    this.assertCanMutateLayoutProperty();
    if (value !== this._axisDirection) {
      this._axisDirection = value;
      this.markNeedsLayout();
    }
  }
  get crossAxisDirection(): AxisDirection {
    return this._crossAxisDirection;
  }
  set crossAxisDirection(value: AxisDirection) {
    this.assertCanMutateLayoutProperty();
    if (value !== this._crossAxisDirection) {
      this._crossAxisDirection = value;
      this.markNeedsLayout();
    }
  }
  get axis(): Axis {
    return axisDirectionToAxis(this.axisDirection);
  }
  get offset(): ViewportOffset {
    return this._offset;
  }
  set offset(value: ViewportOffset) {
    this.assertCanMutateLayoutProperty();
    if (value === this._offset) return;
    const previous = this._offset;
    if (this.observingOffset) {
      value.addListener(this.offsetChanged);
      try {
        previous.removeListener(this.offsetChanged);
      } catch (error) {
        value.removeListener(this.offsetChanged);
        throw error;
      }
    }
    this._offset = value;
    this.markNeedsLayout();
  }
  get scrollCacheExtent(): ScrollCacheExtent {
    return this._scrollCacheExtent;
  }
  set scrollCacheExtent(value: ScrollCacheExtent | null) {
    this.assertCanMutateLayoutProperty();
    const effective = value ?? ScrollCacheExtent.pixels(250);
    if (!effective.equals(this._scrollCacheExtent)) {
      this._scrollCacheExtent = effective;
      this.markNeedsLayout();
    }
  }
  get cacheExtent(): number {
    return this._scrollCacheExtent.value;
  }
  set cacheExtent(value: number | null) {
    this.scrollCacheExtent =
      value === null
        ? ScrollCacheExtent.pixels(250)
        : this.cacheExtentStyle === CacheExtentStyle.pixel
          ? ScrollCacheExtent.pixels(value)
          : ScrollCacheExtent.viewport(value);
  }
  get cacheExtentStyle(): CacheExtentStyle {
    return this._scrollCacheExtent.style;
  }
  set cacheExtentStyle(value: CacheExtentStyle) {
    if (value !== this.cacheExtentStyle)
      this.scrollCacheExtent =
        value === CacheExtentStyle.pixel
          ? ScrollCacheExtent.pixels(this.cacheExtent)
          : ScrollCacheExtent.viewport(this.cacheExtent);
  }
  get paintOrder(): SliverPaintOrder {
    return this._paintOrder;
  }
  set paintOrder(value: SliverPaintOrder) {
    this.assertCanMutateLayoutProperty();
    if (value !== this._paintOrder) {
      this._paintOrder = value;
      this.markNeedsPaint();
    }
  }
  get clipBehavior(): 'none' | 'hardEdge' {
    return this._clipBehavior;
  }
  set clipBehavior(value: 'none' | 'hardEdge') {
    this.assertCanMutateLayoutProperty();
    if (value !== this._clipBehavior) {
      this._clipBehavior = value;
      this.markNeedsPaint();
    }
  }
  abstract get hasVisualOverflow(): boolean;
  abstract scrollOffsetOf(child: RenderSliver, scrollOffsetWithinChild: number): number;
  abstract maxScrollObstructionExtentBefore(child: RenderSliver): number;
  getOffsetToReveal(
    target: RenderObject,
    alignment: number,
    { rect = null }: { readonly rect?: RectGeometry | null; readonly axis?: Axis | null } = {},
  ): RevealedOffset {
    invariant(
      target !== this && Number.isFinite(alignment),
      'invalid-viewport-reveal',
      'Reveal requires a descendant and finite alignment',
    );
    let leading = 0,
      child = target,
      pivot: RenderBox<RenderObject> | null = null,
      onlySlivers = target instanceof RenderSliver;
    while (child.parent !== this) {
      const parent = child.parent;
      invariant(parent, 'unrelated-viewport-reveal', 'Reveal target must belong to the viewport');
      if (child instanceof RenderBox) pivot = child;
      if (parent instanceof RenderSliver) {
        const offset = parent.childScrollOffset(child);
        invariant(
          offset !== null,
          'unlaid-reveal-child',
          'Reveal requires a laid-out sliver child',
        );
        leading += offset;
      } else {
        onlySlivers = false;
        leading = 0;
      }
      child = parent;
    }
    let local: Rect, pivotExtent: number, growth: GrowthDirection, effective: Rect;
    if (pivot !== null) {
      invariant(
        pivot.parent instanceof RenderSliver,
        'invalid-reveal-pivot',
        'Reveal pivot must have a sliver parent',
      );
      growth = pivot.parent.constraints.growthDirection;
      pivotExtent = this.axis === Axis.horizontal ? pivot.size.width : pivot.size.height;
      effective = valueRect(rect ?? target.paintBounds);
      local = MatrixUtils.transformRect(Matrix4.fromList(target.getTransformTo(pivot)), effective);
    } else if (onlySlivers) {
      const sliver = target as RenderSliver;
      growth = sliver.constraints.growthDirection;
      pivotExtent = sliver.geometry!.scrollExtent;
      effective = valueRect(
        rect ??
          Rect.fromLTWH(
            0,
            0,
            this.axis === Axis.horizontal ? pivotExtent : sliver.constraints.crossAxisExtent,
            this.axis === Axis.horizontal ? sliver.constraints.crossAxisExtent : pivotExtent,
          ),
      );
      local = effective;
    } else return new RevealedOffset(this.offset.pixels, valueRect(rect ?? target.paintBounds));
    invariant(
      child instanceof RenderSliver,
      'invalid-reveal-sliver',
      'Viewport reveal must enter through a sliver',
    );
    switch (applyGrowthDirectionToAxisDirection(this.axisDirection, growth)) {
      case AxisDirection.up:
        leading += pivotExtent - local.bottom;
        break;
      case AxisDirection.left:
        leading += pivotExtent - local.right;
        break;
      case AxisDirection.right:
        leading += local.left;
        break;
      case AxisDirection.down:
        leading += local.top;
        break;
      default:
        throw new TypeError('Unknown reveal direction');
    }
    const pinned = child.geometry!.maxScrollObstructionExtent > 0 && leading >= 0;
    leading = this.scrollOffsetOf(child, leading);
    let targetRect = MatrixUtils.transformRect(
      Matrix4.fromList(target.getTransformTo(this)),
      effective,
    );
    const obstruction = this.maxScrollObstructionExtentBefore(child),
      difference =
        (this.axis === Axis.horizontal
          ? this.size.width - local.width
          : this.size.height - local.height) - obstruction;
    let targetOffset: number;
    if (child.constraints.growthDirection === GrowthDirection.forward) {
      leading -= obstruction;
      targetOffset =
        pinned && alignment <= 0
          ? Math.max(this.offset.pixels, leading)
          : leading - difference * alignment;
    } else if (child.constraints.growthDirection === GrowthDirection.reverse) {
      if (pinned && alignment >= 1) targetOffset = Math.min(this.offset.pixels, leading);
      else {
        leading -= this.axis === Axis.horizontal ? targetRect.width : targetRect.height;
        targetOffset = leading - difference * alignment;
      }
    } else throw new TypeError('Unknown reveal growth direction');
    const delta = this.offset.pixels - targetOffset;
    switch (this.axisDirection) {
      case AxisDirection.up:
        targetRect = targetRect.translate(0, -delta);
        break;
      case AxisDirection.down:
        targetRect = targetRect.translate(0, delta);
        break;
      case AxisDirection.left:
        targetRect = targetRect.translate(-delta, 0);
        break;
      case AxisDirection.right:
        targetRect = targetRect.translate(delta, 0);
        break;
      default:
        throw new TypeError('Unknown viewport direction');
    }
    return new RevealedOffset(targetOffset, targetRect);
  }
  override showOnScreen(
    rect: RectGeometry = this.paintBounds,
    options: ShowOnScreenOptions = {},
  ): void {
    if (!this.offset.allowImplicitScrolling || !options.descendant) {
      super.showOnScreen(rect, options);
      return;
    }
    const revealed = RenderViewportBase.showInViewport({
      descendant: options.descendant,
      rect: options.targetRect ?? rect,
      viewport: this,
      offset: this.offset,
      duration: options.duration ?? 0,
      curve: options.curve ?? Curves.ease,
    });
    if (revealed)
      super.showOnScreen(revealed, {
        duration: options.duration ?? 0,
        curve: options.curve ?? Curves.ease,
      });
  }
  static showInViewport({
    descendant = null,
    rect = null,
    viewport,
    offset,
    duration = 0,
    curve = Curves.ease,
  }: {
    readonly descendant?: RenderObject | null;
    readonly rect?: RectGeometry | null;
    readonly viewport: RenderAbstractViewport;
    readonly offset: ViewportOffset;
    readonly duration?: number;
    readonly curve?: Curve;
  }): Rect | null {
    if (descendant === null) return rect === null ? null : valueRect(rect);
    const leadingEdgeOffset = viewport.getOffsetToReveal(descendant, 0, { rect }),
      trailingEdgeOffset = viewport.getOffsetToReveal(descendant, 1, { rect }),
      target = RevealedOffset.clampOffset({
        leadingEdgeOffset,
        trailingEdgeOffset,
        currentOffset: offset.pixels,
      });
    if (target === null)
      return MatrixUtils.transformRect(
        Matrix4.fromList(descendant.getTransformTo(viewport)),
        valueRect(rect ?? descendant.paintBounds),
      );
    // moveTo is owned by the position's activity/Ticker, including cancellation.
    void offset
      .moveTo(target.offset, { duration, curve })
      .catch((error) =>
        FlutterError.reportError(
          new FlutterErrorDetails({ exception: error, library: 'rendering library' }),
        ),
      );
    return target.rect;
  }
  get firstChild(): RenderSliver | null {
    return this.children[0] ?? null;
  }
  get lastChild(): RenderSliver | null {
    return this.children.at(-1) ?? null;
  }
  get childCount(): number {
    return this.children.length;
  }
  protected override get childCountLimit(): number {
    return 256;
  }
  readonly childBefore = (child: RenderSliver): RenderSliver | null => {
    const index = this.children.indexOf(child);
    invariant(index >= 0, 'invalid-viewport-child', 'Sliver must belong to this viewport');
    return this.children[index - 1] ?? null;
  };
  readonly childAfter = (child: RenderSliver): RenderSliver | null => {
    const index = this.children.indexOf(child);
    invariant(index >= 0, 'invalid-viewport-child', 'Sliver must belong to this viewport');
    return this.children[index + 1] ?? null;
  };
  private syncSiblings(): void {
    this.children.forEach((child, index) => {
      const data = child.parentData;
      if (
        data instanceof SliverPhysicalContainerParentData ||
        data instanceof SliverLogicalContainerParentData
      ) {
        data.previousSibling = this.children[index - 1] ?? null;
        data.nextSibling = this.children[index + 1] ?? null;
      }
    });
  }
  override insert(child: RenderObject, after?: RenderObject): void {
    try {
      super.insert(child, after);
    } finally {
      this.syncSiblings();
    }
  }
  override move(child: RenderObject, after?: RenderObject): void {
    try {
      super.move(child, after);
    } finally {
      this.syncSiblings();
    }
  }
  override remove(child: RenderObject): void {
    try {
      super.remove(child);
    } finally {
      this.syncSiblings();
    }
  }
  override setChildren(children: readonly RenderObject[]): void {
    invariant(
      children.length <= 256,
      'viewport-sliver-budget',
      'Viewport supports at most256 live slivers',
    );
    try {
      super.setChildren(children);
    } finally {
      this.syncSiblings();
    }
  }
  override attach(owner: PipelineOwner): void {
    super.attach(owner);
    if (!this.observingOffset)
      try {
        this._offset.addListener(this.offsetChanged);
        this.observingOffset = true;
      } catch (error) {
        try {
          super.detach();
        } catch (failure) {
          throw new AggregateError([error, failure], 'Viewport offset attachment rollback failed');
        }
        throw error;
      }
  }
  override detach(): void {
    const errors: unknown[] = [];
    if (this.observingOffset) {
      this.observingOffset = false;
      try {
        this._offset.removeListener(this.offsetChanged);
      } catch (error) {
        errors.push(error);
      }
    }
    try {
      super.detach();
    } catch (error) {
      errors.push(error);
    }
    if (errors.length) throw new AggregateError(errors, 'Viewport retirement failed');
  }
  debugThrowIfNotCheckingIntrinsics(): boolean {
    if (FoundationBuildMode.debug)
      invariant(
        RenderObject.debugCheckingIntrinsics,
        'unsupported-viewport-intrinsics',
        'Lazy viewports cannot return intrinsic dimensions without instantiating every child',
      );
    return true;
  }
  protected override computeMinIntrinsicWidth(_height: number): number {
    if (FoundationBuildMode.debug)
      invariant(
        this.debugThrowIfNotCheckingIntrinsics(),
        'invalid-viewport-intrinsic-check',
        'Viewport intrinsic diagnostics must succeed',
      );
    return 0;
  }
  protected override computeMaxIntrinsicWidth(_height: number): number {
    if (FoundationBuildMode.debug)
      invariant(
        this.debugThrowIfNotCheckingIntrinsics(),
        'invalid-viewport-intrinsic-check',
        'Viewport intrinsic diagnostics must succeed',
      );
    return 0;
  }
  protected override computeMinIntrinsicHeight(_width: number): number {
    if (FoundationBuildMode.debug)
      invariant(
        this.debugThrowIfNotCheckingIntrinsics(),
        'invalid-viewport-intrinsic-check',
        'Viewport intrinsic diagnostics must succeed',
      );
    return 0;
  }
  protected override computeMaxIntrinsicHeight(_width: number): number {
    if (FoundationBuildMode.debug)
      invariant(
        this.debugThrowIfNotCheckingIntrinsics(),
        'invalid-viewport-intrinsic-check',
        'Viewport intrinsic diagnostics must succeed',
      );
    return 0;
  }
  protected layoutChildSequence({
    child,
    scrollOffset,
    overlap,
    layoutOffset,
    remainingPaintExtent,
    mainAxisExtent,
    crossAxisExtent,
    growthDirection,
    advance,
    remainingCacheExtent,
    cacheOrigin,
  }: SliverChildSequence): number {
    if (FoundationBuildMode.debug)
      invariant(
        Number.isFinite(scrollOffset) && scrollOffset >= 0,
        'invalid-sliver-sequence-offset',
        'Sequence offset must be finite and nonnegative',
      );
    const initialLayoutOffset = layoutOffset,
      adjusted = applyGrowthDirectionToScrollDirection(
        this.offset.userScrollDirection,
        growthDirection,
      );
    let maxPaintOffset = layoutOffset + overlap,
      precedingScrollExtent = 0;
    while (child !== null) {
      const sliverScrollOffset = scrollOffset <= 0 ? 0 : scrollOffset,
        correctedCacheOrigin = Math.max(cacheOrigin, -sliverScrollOffset),
        cacheExtentCorrection = cacheOrigin - correctedCacheOrigin;
      child.layout(
        new SliverConstraints({
          axisDirection: this.axisDirection,
          growthDirection,
          userScrollDirection: adjusted,
          scrollOffset: sliverScrollOffset,
          precedingScrollExtent,
          overlap: maxPaintOffset - layoutOffset,
          remainingPaintExtent: Math.max(
            0,
            remainingPaintExtent - layoutOffset + initialLayoutOffset,
          ),
          crossAxisExtent,
          crossAxisDirection: this.crossAxisDirection,
          viewportMainAxisExtent: mainAxisExtent,
          remainingCacheExtent: Math.max(0, remainingCacheExtent + cacheExtentCorrection),
          cacheOrigin: correctedCacheOrigin,
        }),
        { parentUsesSize: true },
      );
      const geometry = child.geometry!;
      if (FoundationBuildMode.debug) geometry.debugAssertIsValid();
      if (geometry.scrollOffsetCorrection !== null) return geometry.scrollOffsetCorrection;
      const effectiveLayoutOffset = layoutOffset + geometry.paintOrigin;
      this.updateChildLayoutOffset(
        child,
        geometry.visible || scrollOffset > 0
          ? effectiveLayoutOffset
          : -scrollOffset + initialLayoutOffset,
        growthDirection,
      );
      maxPaintOffset = Math.max(effectiveLayoutOffset + geometry.paintExtent, maxPaintOffset);
      scrollOffset -= geometry.scrollExtent;
      precedingScrollExtent += geometry.scrollExtent;
      layoutOffset += geometry.layoutExtent;
      if (geometry.cacheExtent !== 0) {
        remainingCacheExtent -= geometry.cacheExtent - cacheExtentCorrection;
        cacheOrigin = Math.min(correctedCacheOrigin + geometry.cacheExtent, 0);
      }
      this.updateOutOfBandData(growthDirection, geometry);
      child = advance(child);
    }
    return 0;
  }
  protected abstract updateOutOfBandData(
    growthDirection: GrowthDirection,
    geometry: SliverGeometry,
  ): void;
  protected abstract updateChildLayoutOffset(
    child: RenderSliver,
    layoutOffset: number,
    growthDirection: GrowthDirection,
  ): void;
  protected abstract paintOffsetOf(child: RenderSliver): Offset;
  computeAbsolutePaintOffset(
    child: RenderSliver,
    layoutOffset: number,
    growthDirection: GrowthDirection,
  ): Offset {
    switch (applyGrowthDirectionToAxisDirection(this.axisDirection, growthDirection)) {
      case AxisDirection.up:
        return new Offset(0, this.size.height - layoutOffset - child.geometry!.paintExtent);
      case AxisDirection.left:
        return new Offset(this.size.width - layoutOffset - child.geometry!.paintExtent, 0);
      case AxisDirection.right:
        return new Offset(layoutOffset, 0);
      case AxisDirection.down:
        return new Offset(0, layoutOffset);
      default:
        throw new TypeError('Unknown axis');
    }
  }
  get childrenInPaintOrder(): readonly RenderSliver[] {
    return this.paintOrder === SliverPaintOrder.firstIsTop
      ? [...this.children].reverse()
      : this.children;
  }
  get childrenInHitTestOrder(): readonly RenderSliver[] {
    return this.paintOrder === SliverPaintOrder.firstIsTop
      ? this.children
      : [...this.children].reverse();
  }
  protected override childTransform(child: RenderObject): TransformMatrix {
    const data = child.parentData;
    return data instanceof SliverPhysicalParentData
      ? multiply(translate(data.paintOffset.dx, data.paintOffset.dy), child.localTransform)
      : super.childTransform(child);
  }
  override get clips(): boolean {
    return this.hasVisualOverflow && this.clipBehavior !== 'none';
  }
  protected override hitTestSelf(): boolean {
    return true;
  }
  override hitTest(
    position: Point,
    result: LegacyHitTestEntry[],
    toLocal: TransformMatrix = identity,
  ): boolean {
    invariant(this.hasSize, 'missing-hit-test-size', 'Viewport hit testing requires layout');
    if (!contains({ x: 0, y: 0, ...this.size }, position)) return false;
    let hit = false;
    for (const child of this.childrenInHitTestOrder) {
      if (!child.geometry || child.geometry.hitTestExtent <= 0) continue;
      const inverse = inversePaintTransform(this.childTransform(child));
      if (!inverse) continue;
      const local = transform(inverse, position),
        effective = applyGrowthDirectionToAxisDirection(
          child.constraints.axisDirection,
          child.constraints.growthDirection,
        ),
        main =
          effective === AxisDirection.up
            ? child.geometry.paintExtent - local.y
            : effective === AxisDirection.left
              ? child.geometry.paintExtent - local.x
              : this.axis === Axis.vertical
                ? local.y
                : local.x,
        cross = this.axis === Axis.vertical ? local.x : local.y,
        source = SliverHitTestResult._forLegacy();
      if (child.hitTest(source, { mainAxisPosition: main, crossAxisPosition: cross })) {
        result.push(...source._toLegacy(multiply(inverse, toLocal)));
        hit = true;
        break;
      }
    }
    if (this.hitTestSelf()) {
      result.push({ target: this, transform: toLocal });
      hit = true;
    }
    return hit;
  }
  override paint(context: PaintingContext): void {
    if (!this.children.length) return;
    context.save();
    try {
      if (this.clips) context.clip({ x: 0, y: 0, ...this.size });
      for (const child of this.childrenInPaintOrder)
        if (child.geometry?.visible) this.paintChild(context, child);
    } finally {
      context.restore();
    }
  }
}
export interface RenderViewportOptions extends RenderViewportBaseOptions {
  readonly anchor?: number;
  readonly children?: readonly RenderSliver[];
  readonly center?: RenderSliver | null;
}
export class RenderViewport extends RenderViewportBase {
  static readonly useTwoPaneSemantics = new SemanticsTag('RenderViewport.twoPane');
  static readonly excludeFromScrolling = new SemanticsTag('RenderViewport.excludeFromScrolling');
  private _anchor: number;
  private _center: RenderSliver | null;
  private _minScrollExtent = 0;
  private _maxScrollExtent = 0;
  private _hasVisualOverflow = false;
  private static readonly _maxLayoutCyclesPerChild = 10;
  constructor({ anchor = 0, children = [], center = null, ...options }: RenderViewportOptions) {
    super(options);
    if (FoundationBuildMode.debug)
      invariant(
        anchor >= 0 && anchor <= 1,
        'invalid-viewport-anchor',
        'Anchor must be within [0,1]',
      );
    this._anchor = anchor;
    this._center = center;
    this.setChildren(children);
    if (center === null) this._center = this.firstChild;
  }
  override setupParentData(child: RenderObject): void {
    if (!(child.parentData instanceof SliverPhysicalContainerParentData))
      child.parentData = new SliverPhysicalContainerParentData();
  }
  get anchor(): number {
    return this._anchor;
  }
  set anchor(value: number) {
    this.assertCanMutateLayoutProperty();
    if (FoundationBuildMode.debug)
      invariant(value >= 0 && value <= 1, 'invalid-viewport-anchor', 'Anchor must be within [0,1]');
    if (value !== this._anchor) {
      this._anchor = value;
      this.markNeedsLayout();
    }
  }
  get center(): RenderSliver | null {
    return this._center;
  }
  set center(value: RenderSliver | null) {
    this.assertCanMutateLayoutProperty();
    if (value !== this._center) {
      this._center = value;
      this.markNeedsLayout();
    }
  }
  override get sizedByParent(): boolean {
    return true;
  }
  protected override computeDryLayout(constraints: BoxConstraints): Size {
    invariant(
      constraints.hasBoundedWidth && constraints.hasBoundedHeight,
      'unbounded-viewport',
      'Viewport requires bounded dimensions',
    );
    return constraints.biggest;
  }
  protected override performLayout(_constraints: BoxConstraints): Size {
    const main = this.axis === Axis.vertical ? this.size.height : this.size.width,
      cross = this.axis === Axis.vertical ? this.size.width : this.size.height;
    this.offset.applyViewportDimension(main);
    if (this.center === null) {
      invariant(
        this.firstChild === null,
        'missing-viewport-center',
        'Nonempty viewport requires its actual center sliver',
      );
      this._minScrollExtent = 0;
      this._maxScrollExtent = 0;
      this._hasVisualOverflow = false;
      this.offset.applyContentDimensions(0, 0);
      return this.size;
    }
    invariant(
      this.center.parent === this,
      'invalid-viewport-center',
      'Center must belong to this viewport',
    );
    const adjustment = this.center.centerOffsetAdjustment,
      maxCycles = RenderViewport._maxLayoutCyclesPerChild * this.childCount;
    let count = 0;
    do {
      const correction = this._attemptLayout(main, cross, this.offset.pixels + adjustment);
      if (correction !== 0) this.offset.correctBy(correction);
      else if (
        this.offset.applyContentDimensions(
          Math.min(0, this._minScrollExtent + main * this.anchor),
          Math.max(0, this._maxScrollExtent - main * (1 - this.anchor)),
        )
      )
        return this.size;
      count++;
    } while (count < maxCycles);
    throw new Error('RenderViewport exceeded its maximum number of layout cycles');
  }
  private _attemptLayout(main: number, cross: number, correctedOffset: number): number {
    invariant(
      Number.isFinite(main) &&
        main >= 0 &&
        Number.isFinite(cross) &&
        cross >= 0 &&
        Number.isFinite(correctedOffset),
      'invalid-viewport-geometry',
      'Viewport and offset geometry must be finite',
    );
    this._minScrollExtent = 0;
    this._maxScrollExtent = 0;
    this._hasVisualOverflow = false;
    const centerOffset = main * this.anchor - correctedOffset,
      reversePaint = clampDouble(centerOffset, 0, main),
      forwardPaint = clampDouble(main - centerOffset, 0, main);
    this._calculatedCacheExtent = this.scrollCacheExtent._calculateCacheOffset(main);
    invariant(
      Number.isFinite(this._calculatedCacheExtent) && this._calculatedCacheExtent >= 0,
      'invalid-viewport-cache-extent',
      'Cache extent must be finite and nonnegative',
    );
    const fullCache = main + 2 * this._calculatedCacheExtent,
      centerCache = centerOffset + this._calculatedCacheExtent,
      reverseCache = clampDouble(centerCache, 0, fullCache),
      forwardCache = clampDouble(fullCache - centerCache, 0, fullCache),
      negative = this.childBefore(this.center!);
    if (negative !== null) {
      const result = this.layoutChildSequence({
        child: negative,
        scrollOffset: Math.max(main, centerOffset) - main,
        overlap: 0,
        layoutOffset: forwardPaint,
        remainingPaintExtent: reversePaint,
        mainAxisExtent: main,
        crossAxisExtent: cross,
        growthDirection: GrowthDirection.reverse,
        advance: this.childBefore,
        remainingCacheExtent: reverseCache,
        cacheOrigin: clampDouble(main - centerOffset, -this._calculatedCacheExtent, 0),
      });
      if (result !== 0) return -result;
    }
    return this.layoutChildSequence({
      child: this.center,
      scrollOffset: Math.max(0, -centerOffset),
      overlap: negative === null ? Math.min(0, -centerOffset) : 0,
      layoutOffset: centerOffset >= main ? centerOffset : reversePaint,
      remainingPaintExtent: forwardPaint,
      mainAxisExtent: main,
      crossAxisExtent: cross,
      growthDirection: GrowthDirection.forward,
      advance: this.childAfter,
      remainingCacheExtent: forwardCache,
      cacheOrigin: clampDouble(centerOffset, -this._calculatedCacheExtent, 0),
    });
  }
  get hasVisualOverflow(): boolean {
    return this._hasVisualOverflow;
  }
  protected updateOutOfBandData(growth: GrowthDirection, geometry: SliverGeometry): void {
    if (growth === GrowthDirection.forward) this._maxScrollExtent += geometry.scrollExtent;
    else this._minScrollExtent -= geometry.scrollExtent;
    if (geometry.hasVisualOverflow) this._hasVisualOverflow = true;
  }
  protected updateChildLayoutOffset(
    child: RenderSliver,
    layoutOffset: number,
    growth: GrowthDirection,
  ): void {
    (child.parentData as SliverPhysicalParentData).paintOffset = this.computeAbsolutePaintOffset(
      child,
      layoutOffset,
      growth,
    );
  }
  protected paintOffsetOf(child: RenderSliver): Offset {
    return (child.parentData as SliverPhysicalParentData).paintOffset;
  }
  scrollOffsetOf(child: RenderSliver, withinChild: number): number {
    invariant(
      child.parent === this && this.center,
      'invalid-viewport-scroll-child',
      'Scroll offset requires an owned child and center',
    );
    let total = 0,
      current: RenderSliver | null;
    if (child.constraints.growthDirection === GrowthDirection.forward) {
      current = this.center;
      while (current !== child) {
        invariant(current, 'unreachable-viewport-child', 'Forward child must follow center');
        total += current.geometry!.scrollExtent;
        current = this.childAfter(current);
      }
      return total + withinChild;
    }
    invariant(
      child.constraints.growthDirection === GrowthDirection.reverse,
      'invalid-viewport-growth',
      'Unknown growth direction',
    );
    current = this.childBefore(this.center);
    while (current !== child) {
      invariant(current, 'unreachable-viewport-child', 'Reverse child must precede center');
      total -= current.geometry!.scrollExtent;
      current = this.childBefore(current);
    }
    return total - withinChild;
  }
  maxScrollObstructionExtentBefore(child: RenderSliver): number {
    invariant(
      child.parent === this && this.center,
      'invalid-viewport-scroll-child',
      'Obstruction extent requires an owned child and center',
    );
    let total = 0;
    const forward = child.constraints.growthDirection === GrowthDirection.forward;
    invariant(
      forward || child.constraints.growthDirection === GrowthDirection.reverse,
      'invalid-viewport-growth',
      'Unknown growth direction',
    );
    let current: RenderSliver | null = forward ? this.center : this.childBefore(this.center);
    while (current !== child) {
      invariant(
        current,
        'unreachable-viewport-child',
        'Child must be reachable in its growth direction',
      );
      total += current.geometry!.maxScrollObstructionExtent;
      current = forward ? this.childAfter(current) : this.childBefore(current);
    }
    return total;
  }
  applyPaintTransform(child: RenderObject, transform: Matrix4): void {
    (child.parentData as SliverPhysicalParentData).applyPaintTransform(transform);
  }
  computeChildMainAxisPosition(child: RenderSliver, parentMainAxisPosition: number): number {
    const p = this.paintOffsetOf(child);
    switch (
      applyGrowthDirectionToAxisDirection(
        child.constraints.axisDirection,
        child.constraints.growthDirection,
      )
    ) {
      case AxisDirection.down:
        return parentMainAxisPosition - p.dy;
      case AxisDirection.right:
        return parentMainAxisPosition - p.dx;
      case AxisDirection.up:
        return child.geometry!.paintExtent - (parentMainAxisPosition - p.dy);
      case AxisDirection.left:
        return child.geometry!.paintExtent - (parentMainAxisPosition - p.dx);
      default:
        throw new TypeError('Unknown axis');
    }
  }
  get indexOfFirstChild(): number {
    invariant(this.center !== null, 'missing-viewport-center', 'Index requires center');
    return -this.children.indexOf(this.center);
  }
  labelForChild(index: number): string {
    return index === 0 ? 'center child' : 'child ' + index;
  }
}
export interface RenderShrinkWrappingViewportOptions extends RenderViewportBaseOptions {
  readonly children?: readonly RenderSliver[];
}
/** Source shrink-wrap algorithm, with bounded all-mode layout convergence and existing live-node budgets. */
export class RenderShrinkWrappingViewport extends RenderViewportBase {
  private maximumExtent = 0;
  private shrinkWrapExtent = 0;
  private visualOverflow = false;
  constructor({ children = [], ...options }: RenderShrinkWrappingViewportOptions) {
    super(options);
    this.setChildren(children);
  }
  override setupParentData(child: RenderObject): void {
    if (!(child.parentData instanceof SliverLogicalContainerParentData))
      child.parentData = new SliverLogicalContainerParentData();
  }
  override debugThrowIfNotCheckingIntrinsics(): boolean {
    if (FoundationBuildMode.debug)
      invariant(
        RenderObject.debugCheckingIntrinsics,
        'unsupported-shrink-viewport-intrinsics',
        'Give a shrink-wrapping viewport loose constraints instead of measuring all lazy intrinsic children',
      );
    return true;
  }
  protected override performLayout(constraints: BoxConstraints): Size {
    const vertical = this.axis === Axis.vertical;
    invariant(
      vertical ? constraints.hasBoundedWidth : constraints.hasBoundedHeight,
      'unbounded-viewport-cross-axis',
      'A shrink-wrapping viewport requires a bounded cross axis',
    );
    if (this.firstChild === null) {
      this.offset.applyViewportDimension(0);
      this.maximumExtent = 0;
      this.shrinkWrapExtent = 0;
      this.visualOverflow = false;
      this.offset.applyContentDimensions(0, 0);
      return vertical
        ? { width: constraints.maxWidth, height: constraints.minHeight }
        : { width: constraints.minWidth, height: constraints.maxHeight };
    }
    const main = vertical ? constraints.maxHeight : constraints.maxWidth,
      cross = vertical ? constraints.maxWidth : constraints.maxHeight,
      maxCycles = Math.max(10, this.childCount * 10);
    for (let cycle = 0; cycle < maxCycles; cycle++) {
      const correction = this.attemptLayout(main, cross, this.offset.pixels);
      if (correction !== 0) {
        this.offset.correctBy(correction);
        continue;
      }
      const effective = vertical
          ? constraints.constrainHeight(this.shrinkWrapExtent)
          : constraints.constrainWidth(this.shrinkWrapExtent),
        acceptViewport = this.offset.applyViewportDimension(effective),
        acceptContent = this.offset.applyContentDimensions(
          0,
          Math.max(0, this.maximumExtent - effective),
        );
      if (acceptViewport && acceptContent)
        return vertical
          ? constraints.constrainDimensions(cross, effective)
          : constraints.constrainDimensions(effective, cross);
    }
    throw new Error('RenderShrinkWrappingViewport exceeded its maximum number of layout cycles');
  }
  private attemptLayout(main: number, cross: number, correctedOffset: number): number {
    invariant(
      !Number.isNaN(main) &&
        main >= 0 &&
        Number.isFinite(cross) &&
        cross >= 0 &&
        Number.isFinite(correctedOffset),
      'invalid-shrink-viewport-geometry',
      'Shrink-wrap needs a nonnegative main extent, finite cross extent and offset',
    );
    this.maximumExtent = 0;
    this.shrinkWrapExtent = 0;
    this.visualOverflow = correctedOffset < 0;
    this._calculatedCacheExtent = Number.isFinite(main)
      ? this.scrollCacheExtent._calculateCacheOffset(main)
      : 0;
    invariant(
      Number.isFinite(this._calculatedCacheExtent) && this._calculatedCacheExtent >= 0,
      'invalid-viewport-cache-extent',
      'Cache extent must be finite and nonnegative',
    );
    return this.layoutChildSequence({
      child: this.firstChild,
      scrollOffset: Math.max(0, correctedOffset),
      overlap: Math.min(0, correctedOffset),
      layoutOffset: Math.max(0, -correctedOffset),
      remainingPaintExtent: main + Math.min(0, correctedOffset),
      mainAxisExtent: main,
      crossAxisExtent: cross,
      growthDirection: GrowthDirection.forward,
      advance: this.childAfter,
      remainingCacheExtent: main + 2 * this._calculatedCacheExtent,
      cacheOrigin: -this._calculatedCacheExtent,
    });
  }
  get hasVisualOverflow(): boolean {
    return this.visualOverflow;
  }
  protected updateOutOfBandData(growth: GrowthDirection, geometry: SliverGeometry): void {
    invariant(
      growth === GrowthDirection.forward,
      'invalid-shrink-viewport-growth',
      'Shrink-wrap children must grow forward',
    );
    this.maximumExtent += geometry.scrollExtent;
    this.shrinkWrapExtent += geometry.maxPaintExtent;
    if (geometry.hasVisualOverflow) this.visualOverflow = true;
  }
  protected updateChildLayoutOffset(
    child: RenderSliver,
    layoutOffset: number,
    growth: GrowthDirection,
  ): void {
    invariant(
      growth === GrowthDirection.forward,
      'invalid-shrink-viewport-growth',
      'Shrink-wrap children must grow forward',
    );
    (child.parentData as SliverLogicalParentData).layoutOffset = layoutOffset;
  }
  paintOffsetOf(child: RenderSliver): Offset {
    const data = child.parentData as SliverLogicalParentData;
    invariant(
      data.layoutOffset !== null,
      'unlaid-shrink-viewport-child',
      'Shrink-wrap paint requires its logical child layout offset',
    );
    return this.computeAbsolutePaintOffset(child, data.layoutOffset, GrowthDirection.forward);
  }
  protected override childTransform(child: RenderObject): TransformMatrix {
    invariant(
      child instanceof RenderSliver,
      'invalid-shrink-viewport-child',
      'Shrink-wrap children must be slivers',
    );
    const offset = this.paintOffsetOf(child);
    return multiply(translate(offset.dx, offset.dy), child.localTransform);
  }
  scrollOffsetOf(child: RenderSliver, scrollOffsetWithinChild: number): number {
    invariant(
      child.parent === this && child.constraints.growthDirection === GrowthDirection.forward,
      'invalid-shrink-viewport-child',
      'Scroll offsets require an owned forward child',
    );
    let total = 0;
    for (const current of this.children) {
      if (current === child) return total + scrollOffsetWithinChild;
      total += current.geometry!.scrollExtent;
    }
    throw new Error('Missing shrink-wrap child');
  }
  maxScrollObstructionExtentBefore(child: RenderSliver): number {
    invariant(
      child.parent === this && child.constraints.growthDirection === GrowthDirection.forward,
      'invalid-shrink-viewport-child',
      'Obstruction extents require an owned forward child',
    );
    let total = 0;
    for (const current of this.children) {
      if (current === child) return total;
      total += current.geometry!.maxScrollObstructionExtent;
    }
    throw new Error('Missing shrink-wrap child');
  }
  applyPaintTransform(child: RenderObject, transform: Matrix4): void {
    invariant(
      child instanceof RenderSliver,
      'invalid-shrink-viewport-child',
      'Paint transforms require a sliver',
    );
    const offset = this.paintOffsetOf(child);
    transform.translateByDouble(offset.dx, offset.dy, 0, 1);
  }
  computeChildMainAxisPosition(child: RenderSliver, parentMainAxisPosition: number): number {
    invariant(this.hasSize, 'unlaid-shrink-viewport', 'Child positions require current layout');
    const offset = (child.parentData as SliverLogicalParentData).layoutOffset!;
    switch (
      applyGrowthDirectionToAxisDirection(
        child.constraints.axisDirection,
        child.constraints.growthDirection,
      )
    ) {
      case AxisDirection.down:
      case AxisDirection.right:
        return parentMainAxisPosition - offset;
      case AxisDirection.up:
        return this.size.height - parentMainAxisPosition - offset;
      case AxisDirection.left:
        return this.size.width - parentMainAxisPosition - offset;
      default:
        throw new TypeError('Unknown viewport axis');
    }
  }
  get indexOfFirstChild(): number {
    return 0;
  }
  labelForChild(index: number): string {
    return 'child ' + index;
  }
}
