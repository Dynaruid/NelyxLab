// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/carousel.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { precisionErrorTolerance } from '@nelyx/core/foundation/constants';
import { invariant } from '@nelyx/core/foundation/errors';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { Axis } from '@nelyx/core/framework/painting/basic-types';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import type { ShapeBorder } from '@nelyx/core/framework/painting/borders';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import type { Simulation } from '@nelyx/core/framework/physics/simulation';
import { ScrollSpringSimulation } from '@nelyx/core/framework/physics/spring-simulation';
import type { ItemExtentBuilder, SliverConstraints } from '@nelyx/core/framework/rendering/sliver';
import { RenderSliverFixedExtentBoxAdaptor } from '@nelyx/core/framework/rendering/sliver-fixed-extent-list';
import type { RenderSliverBoxChildManager } from '@nelyx/core/framework/rendering/sliver-multi-box-adaptor';
import { ScrollCacheExtent } from '@nelyx/core/framework/rendering/viewport';
import type { ViewportAnimationOptions } from '@nelyx/core/framework/rendering/viewport-offset';
import { Padding, Stack } from '@nelyx/core/framework/widgets/basic';
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import {
  BallisticScrollActivity,
  DrivenScrollActivity,
} from '@nelyx/core/framework/widgets/scroll-activity';
import type { ScrollActivity } from '@nelyx/core/framework/widgets/scroll-activity';
import { ScrollConfiguration } from '@nelyx/core/framework/widgets/scroll-configuration';
import type { ScrollContext } from '@nelyx/core/framework/widgets/scroll-context';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import { SliverChildBuilderDelegate } from '@nelyx/core/framework/widgets/scroll-delegate';
import type { NullableIndexedWidgetBuilder } from '@nelyx/core/framework/widgets/scroll-delegate';
import { FixedScrollMetrics } from '@nelyx/core/framework/widgets/scroll-metrics';
import type {
  FixedScrollMetricsOptions,
  ScrollMetrics,
  ScrollMetricsCopyOptions,
} from '@nelyx/core/framework/widgets/scroll-metrics';
import { ScrollPhysics } from '@nelyx/core/framework/widgets/scroll-physics';
import type { ScrollPosition } from '@nelyx/core/framework/widgets/scroll-position';
import { ScrollPositionWithSingleContext } from '@nelyx/core/framework/widgets/scroll-position-with-single-context';
import { CustomScrollView } from '@nelyx/core/framework/widgets/scroll-view';
import {
  SliverMultiBoxAdaptorElement,
  SliverMultiBoxAdaptorWidget,
} from '@nelyx/core/framework/widgets/sliver';
import { WidgetState } from '@nelyx/core/framework/widgets/widget-state';
import type { WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import type { Clip } from '@nelyx/core/ui/clip';
import type { Color } from '@nelyx/core/ui/color';
import { CarouselViewTheme } from './carousel-view-theme.ts';
import { Colors } from './colors.ts';
import { InkWell } from './ink-well.ts';
import { colorProperty } from './internal/button/style-properties.ts';
import { materialSchemeColor } from './internal/theme/default-color-schemes.ts';
import { Material } from './material.ts';
import { Theme } from './theme.ts';

interface CarouselCommonOptions extends WidgetOptions {
  readonly padding?: EdgeInsets | null;
  readonly backgroundColor?: Color | null;
  readonly elevation?: number | null;
  readonly shape?: ShapeBorder | null;
  readonly itemClipBehavior?: Clip | null;
  readonly overlayColor?: WidgetStateProperty<Color | null> | null;
  readonly itemSnapping?: boolean;
  readonly shrinkExtent?: number;
  readonly controller?: CarouselController | null;
  readonly scrollDirection?: Axis;
  readonly reverse?: boolean;
  readonly onTap?: ((index: number) => void) | null;
  readonly enableSplash?: boolean;
  readonly infinite?: boolean;
  readonly onIndexChanged?: ((index: number) => void) | null;
}
interface CarouselFixedOptions {
  readonly itemExtent: number;
}
interface CarouselWeightOptions {
  readonly flexWeights: readonly number[];
  readonly consumeMaxWeight?: boolean;
}
interface CarouselChildren {
  readonly children: readonly Widget[];
}
interface CarouselLazyChildren {
  readonly itemBuilder: NullableIndexedWidgetBuilder;
  readonly itemCount?: number | null;
}
export interface CarouselViewOptions
  extends CarouselCommonOptions, CarouselFixedOptions, CarouselChildren {}
export interface CarouselViewWeightedOptions
  extends CarouselCommonOptions, CarouselWeightOptions, CarouselChildren {}
export interface CarouselViewBuilderOptions
  extends CarouselCommonOptions, CarouselFixedOptions, CarouselLazyChildren {}
export interface CarouselViewWeightedBuilderOptions
  extends CarouselCommonOptions, CarouselWeightOptions, CarouselLazyChildren {}
type CarouselOptions =
  | CarouselViewOptions
  | CarouselViewWeightedOptions
  | CarouselViewBuilderOptions
  | CarouselViewWeightedBuilderOptions;

const defaultPadding = EdgeInsets.all(4);
const defaultShape = new RoundedRectangleBorder({ borderRadius: BorderRadius.circular(28) });
const zeroCache = ScrollCacheExtent.viewport(0);

function nearInteger(value: number): number {
  const round = Math.round(value);
  return Math.abs(value - round) < precisionErrorTolerance ? round : value;
}

class CarouselWeights {
  readonly prefix: readonly number[];
  readonly firstMax: number;
  readonly lastMax: number;
  readonly min: number;

  constructor(readonly values: readonly number[]) {
    invariant(
      values.length > 0 && values.every((weight) => Number.isSafeInteger(weight) && weight > 0),
      'invalid-carousel-weights',
      'Carousel weights must be positive integers',
    );
    const prefix = [0];
    let maximum = 0;
    let minimum = Infinity;
    let firstMax = 0;
    let lastMax = 0;
    for (const [index, weight] of values.entries()) {
      prefix.push(prefix[index]! + weight);
      minimum = Math.min(minimum, weight);
      if (weight > maximum) firstMax = index;
      if (weight >= maximum) lastMax = index;
      maximum = Math.max(maximum, weight);
    }
    this.prefix = prefix;
    this.firstMax = firstMax;
    this.lastMax = lastMax;
    this.min = minimum;
  }

  get total(): number {
    return this.prefix[this.values.length]!;
  }
}

/** A Material carousel with fixed or interpolated item extents. */
export class CarouselView extends StatefulWidget {
  readonly padding: EdgeInsets | null;
  readonly backgroundColor: Color | null;
  readonly elevation: number | null;
  readonly shape: ShapeBorder | null;
  readonly itemClipBehavior: Clip | null;
  readonly overlayColor: WidgetStateProperty<Color | null> | null;
  readonly itemSnapping: boolean;
  readonly shrinkExtent: number;
  readonly controller: CarouselController | null;
  readonly scrollDirection: Axis;
  readonly reverse: boolean;
  readonly onTap: ((index: number) => void) | null;
  readonly enableSplash: boolean;
  readonly infinite: boolean;
  readonly onIndexChanged: ((index: number) => void) | null;
  readonly itemExtent: number | null;
  readonly flexWeights: readonly number[] | null;
  readonly consumeMaxWeight: boolean;
  readonly children: readonly Widget[];
  readonly itemBuilder: NullableIndexedWidgetBuilder | null;
  readonly itemCount: number | null;
  /** @internal */ readonly weightLayout: CarouselWeights | null;

  constructor(options: CarouselOptions) {
    super(options.key ?? null);
    this.padding = options.padding ?? null;
    this.backgroundColor = options.backgroundColor ?? null;
    this.elevation = options.elevation ?? null;
    this.shape = options.shape ?? null;
    this.itemClipBehavior = options.itemClipBehavior ?? null;
    this.overlayColor = options.overlayColor ?? null;
    this.itemSnapping = options.itemSnapping ?? false;
    this.shrinkExtent = options.shrinkExtent ?? 0;
    this.controller = options.controller ?? null;
    this.scrollDirection = options.scrollDirection ?? Axis.horizontal;
    this.reverse = options.reverse ?? false;
    this.onTap = options.onTap ?? null;
    this.enableSplash = options.enableSplash ?? true;
    this.infinite = options.infinite ?? false;
    this.onIndexChanged = options.onIndexChanged ?? null;
    this.itemExtent = 'itemExtent' in options ? options.itemExtent : null;
    this.flexWeights = 'flexWeights' in options ? Object.freeze([...options.flexWeights]) : null;
    this.consumeMaxWeight = 'flexWeights' in options ? (options.consumeMaxWeight ?? true) : true;
    this.weightLayout = this.flexWeights === null ? null : new CarouselWeights(this.flexWeights);
    this.children = Object.freeze('children' in options ? [...options.children] : []);
    this.itemBuilder = 'itemBuilder' in options ? options.itemBuilder : null;
    this.itemCount = 'itemBuilder' in options ? (options.itemCount ?? null) : null;
    invariant(
      this.itemExtent === null || (Number.isFinite(this.itemExtent) && this.itemExtent >= 0),
      'invalid-carousel-extent',
      'Carousel itemExtent must be finite and nonnegative',
    );
    invariant(
      this.itemCount === null || (Number.isSafeInteger(this.itemCount) && this.itemCount >= 0),
      'invalid-carousel-count',
      'Carousel itemCount must be a nonnegative integer',
    );
  }

  static weighted(options: CarouselViewWeightedOptions): CarouselView {
    return new CarouselView(options);
  }

  static builder(options: CarouselViewBuilderOptions): CarouselView {
    return new CarouselView(options);
  }

  static weightedBuilder(options: CarouselViewWeightedBuilderOptions): CarouselView {
    return new CarouselView(options);
  }

  createState(): State<CarouselView> {
    return new CarouselViewState();
  }
}

function itemCount(view: CarouselView): number | null {
  return view.itemBuilder === null ? view.children.length : view.itemCount;
}

class CarouselViewState extends State<CarouselView> {
  private internalController: CarouselController | null = null;

  override initState(): void {
    if (this.widget.controller === null) this.internalController = new CarouselController();
  }

  override didUpdateWidget(old: CarouselView): void {
    for (const position of (old.controller ?? this.internalController!).positions)
      if (position instanceof CarouselPosition && position.owner === this)
        position.updateConfiguration(this.widget);
    if (old.controller === this.widget.controller) return;
    this.internalController?.dispose();
    this.internalController = this.widget.controller === null ? new CarouselController() : null;
  }

  override dispose(): void {
    this.internalController?.dispose();
    super.dispose();
  }

  build(context: BuildContext): Widget {
    const view = this.widget;
    const count = itemCount(view);
    const wrap = view.infinite && count !== null && count > 0;
    const builder = view.itemBuilder ?? this.eagerBuilder(context, view);
    const delegate = new SliverChildBuilderDelegate(
      wrap ? (context, index) => builder(context, index % count) : builder,
      { childCount: wrap ? null : count },
    );
    const sliver =
      view.weightLayout === null
        ? new SliverFixedCarousel(delegate, view.itemExtent!, view.shrinkExtent)
        : new SliverWeightedCarousel(
            delegate,
            view.weightLayout,
            view.consumeMaxWeight,
            view.shrinkExtent,
          );
    return new CustomScrollView({
      scrollDirection: view.scrollDirection,
      reverse: view.reverse,
      controller: view.controller ?? this.internalController!,
      physics: view.itemSnapping
        ? new CarouselScrollPhysics()
        : ScrollConfiguration.of(context).getScrollPhysics(context),
      clipBehavior: 'antiAlias',
      scrollCacheExtent: zeroCache,
      slivers: [sliver],
    });
  }

  private eagerBuilder(context: BuildContext, view: CarouselView): NullableIndexedWidgetBuilder {
    const theme = CarouselViewTheme.of(context);
    const scheme = Theme.of(context).colorScheme;
    const padding = view.padding ?? theme.padding ?? defaultPadding;
    const color =
      view.backgroundColor ?? theme.backgroundColor ?? materialSchemeColor(scheme, 'surface');
    const elevation = view.elevation ?? theme.elevation ?? 0;
    const shape = view.shape ?? theme.shape ?? defaultShape;
    const clipBehavior = view.itemClipBehavior ?? theme.itemClipBehavior ?? 'antiAlias';
    const onSurface = materialSchemeColor(scheme, 'onSurface');
    const overlayColor =
      view.overlayColor ??
      theme.overlayColor ??
      colorProperty((states) => {
        if (states.contains(WidgetState.pressed)) return onSurface.withOpacity(0.1);
        if (states.contains(WidgetState.hovered)) return onSurface.withOpacity(0.08);
        return states.contains(WidgetState.focused) ? onSurface.withOpacity(0.1) : null;
      });
    return (_context, index) => {
      let child = view.children[index];
      if (child === undefined) return null;
      if (view.enableSplash) {
        child = new Stack(
          [
            child,
            new Material({
              color: Colors.transparent,
              child: new InkWell({ onTap: () => this.widget.onTap?.(index), overlayColor }),
            }),
          ],
          { fit: 'expand' },
        );
      } else if (view.onTap !== null) {
        child = new GestureDetector(child, { onTap: () => this.widget.onTap?.(index) });
      }
      return new Padding(padding, new Material({ clipBehavior, color, elevation, shape, child }));
    };
  }
}

class SliverFixedCarousel extends SliverMultiBoxAdaptorWidget {
  constructor(
    delegate: SliverChildBuilderDelegate,
    readonly extent: number,
    readonly shrink: number,
  ) {
    super({ delegate });
  }

  createRenderObject(context: BuildContext): RenderFixedCarousel {
    invariant(
      context instanceof SliverMultiBoxAdaptorElement,
      'invalid-carousel-element',
      'Carousel requires a sliver adaptor element',
    );
    return new RenderFixedCarousel(context, this.extent, this.shrink);
  }

  override updateRenderObject(_context: BuildContext, render: RenderFixedCarousel): void {
    render.configure(this.extent, this.shrink);
  }
}

class RenderFixedCarousel extends RenderSliverFixedExtentBoxAdaptor {
  constructor(
    childManager: RenderSliverBoxChildManager,
    private extent: number,
    private shrink: number,
  ) {
    super({ childManager });
  }

  configure(extent: number, shrink: number): void {
    this.assertCanMutateLayoutProperty();
    if (this.extent === extent && this.shrink === shrink) return;
    this.extent = extent;
    this.shrink = shrink;
    this.markNeedsLayout();
  }

  private get maxExtent(): number {
    return Math.min(this.extent, this.constraints.viewportMainAxisExtent);
  }

  private get minExtent(): number {
    const extent = this.maxExtent;
    if (extent === 0) return 0;
    const paint = this.constraints.remainingPaintExtent;
    const partial = nearInteger(paint / extent) % 1;
    return Math.min(extent, Math.max(this.shrink, partial * extent));
  }

  get itemExtent(): null {
    return null;
  }

  override get itemExtentBuilder(): ItemExtentBuilder {
    return this.extentBuilder;
  }

  private readonly extentBuilder: ItemExtentBuilder = (index) => {
    const extent = this.maxExtent;
    if (extent === 0) return 0;
    const { scrollOffset, remainingPaintExtent } = this.constraints;
    if (index === this.getMinChildIndexForScrollOffset(scrollOffset))
      return Math.max(this.minExtent, Math.min(extent, (index + 1) * extent - scrollOffset));
    const end = scrollOffset + remainingPaintExtent;
    if (index === this.getMaxChildIndexForScrollOffset(end))
      return Math.min(extent, Math.max(this.minExtent, end - extent * index));
    return extent;
  };

  protected override indexToLayoutOffset(_extent: number, index: number): number {
    const { scrollOffset } = this.constraints;
    const extent = this.maxExtent;
    if (extent === 0) return 0;
    return index === this.getMinChildIndexForScrollOffset(scrollOffset)
      ? Math.min(scrollOffset, extent * (index + 1) - this.minExtent)
      : extent * index;
  }

  protected override getMinChildIndexForScrollOffset(offset: number): number {
    return this.maxExtent === 0 ? 0 : Math.max(0, Math.floor(nearInteger(offset / this.maxExtent)));
  }

  protected override getMaxChildIndexForScrollOffset(offset: number): number {
    return this.maxExtent === 0
      ? 0
      : Math.max(0, Math.ceil(nearInteger(offset / this.maxExtent) - 1));
  }

  protected override computeMaxScrollOffset(): number {
    return this.childManager.childCount * this.maxExtent;
  }
}

class SliverWeightedCarousel extends SliverMultiBoxAdaptorWidget {
  constructor(
    delegate: SliverChildBuilderDelegate,
    readonly weights: CarouselWeights,
    readonly consumeMaxWeight: boolean,
    readonly shrink: number,
  ) {
    super({ delegate });
  }

  createRenderObject(context: BuildContext): RenderWeightedCarousel {
    invariant(
      context instanceof SliverMultiBoxAdaptorElement,
      'invalid-carousel-element',
      'Carousel requires a sliver adaptor element',
    );
    return new RenderWeightedCarousel(context, this);
  }

  override updateRenderObject(_context: BuildContext, render: RenderWeightedCarousel): void {
    render.configure(this);
  }
}

class RenderWeightedCarousel extends RenderSliverFixedExtentBoxAdaptor {
  constructor(
    childManager: RenderSliverBoxChildManager,
    private configuration: SliverWeightedCarousel,
  ) {
    super({ childManager });
  }

  configure(configuration: SliverWeightedCarousel): void {
    this.assertCanMutateLayoutProperty();
    const old = this.configuration;
    this.configuration = configuration;
    if (
      old.weights !== configuration.weights ||
      old.consumeMaxWeight !== configuration.consumeMaxWeight ||
      old.shrink !== configuration.shrink
    )
      this.markNeedsLayout();
  }

  private get unit(): number {
    return this.constraints.viewportMainAxisExtent / this.configuration.weights.total;
  }

  /** Logic reserves slots ahead of item 0 so it can occupy the maximum weight. */
  private get logicalFirst(): number {
    if (this.unit === 0) return 0;
    const { weights, consumeMaxWeight } = this.configuration;
    const first = Math.floor(
      nearInteger(this.constraints.scrollOffset / (weights.values[0]! * this.unit)),
    );
    return first - (consumeMaxWeight ? weights.firstMax : 0);
  }

  private get progress(): number {
    const step = this.configuration.weights.values[0]! * this.unit;
    if (step === 0) return 0;
    return nearInteger(this.constraints.scrollOffset / step) % 1;
  }

  private get shrink(): number {
    return Math.min(
      Math.max(0, this.configuration.shrink),
      this.configuration.weights.min * this.unit,
    );
  }

  private precedingExtent(relativeIndex: number): number {
    const { weights } = this.configuration;
    const regular = Math.min(relativeIndex, weights.values.length);
    const extent =
      (weights.prefix[regular]! - this.progress * weights.values[regular - 1]!) * this.unit;
    if (relativeIndex === regular) return extent;
    const entering = Math.max(this.constraints.remainingPaintExtent - extent, this.shrink);
    return extent + entering + Math.max(0, relativeIndex - regular - 1) * this.shrink;
  }

  get itemExtent(): null {
    return null;
  }

  override get itemExtentBuilder(): ItemExtentBuilder {
    return this.extentBuilder;
  }

  private readonly extentBuilder: ItemExtentBuilder = (index) => {
    if (this.unit === 0) return 0;
    const { weights } = this.configuration;
    const relativeIndex = index - this.logicalFirst;
    if (relativeIndex === 0) return Math.max(this.shrink, this.precedingExtent(1));
    if (relativeIndex < 0) return weights.min * this.unit;
    if (relativeIndex >= weights.values.length) {
      return Math.max(
        this.shrink,
        this.constraints.remainingPaintExtent - this.precedingExtent(relativeIndex),
      );
    }
    const weight = weights.values[relativeIndex]!;
    return (weight + this.progress * (weights.values[relativeIndex - 1]! - weight)) * this.unit;
  };

  protected override get includesLeadingLayoutSpace(): boolean {
    return this.configuration.consumeMaxWeight;
  }

  protected override indexToLayoutOffset(_extent: number, index: number): number {
    const relativeIndex = index - this.logicalFirst;
    if (relativeIndex <= 0)
      return this.constraints.scrollOffset + Math.min(0, this.precedingExtent(1) - this.shrink);
    return this.constraints.scrollOffset + this.precedingExtent(relativeIndex);
  }

  protected override getMinChildIndexForScrollOffset(): number {
    return Math.max(0, this.logicalFirst);
  }

  protected override getMaxChildIndexForScrollOffset(offset: number): number {
    const first = this.getMinChildIndexForScrollOffset();
    const last = this.logicalFirst + this.configuration.weights.values.length;
    for (let index = first; index < last; index++)
      if (this.indexToLayoutOffset(-1, index + 1) >= offset - precisionErrorTolerance) return index;
    return Math.max(first, last);
  }

  protected override trailingLayoutOffset(lastIndex: number, exhausted: boolean): number {
    const offset = this.indexToLayoutOffset(-1, lastIndex + 1);
    const { weights, consumeMaxWeight } = this.configuration;
    if (!exhausted && this.childManager.estimatedChildCount !== lastIndex + 1) return offset;
    const reserved = consumeMaxWeight
      ? (weights.total - weights.prefix[weights.lastMax + 1]!) * this.unit
      : 0;
    const lastStart = this.indexToLayoutOffset(-1, lastIndex);
    const lastExtent = Math.max(
      weights.values.at(-1)! * this.unit,
      this.itemExtentBuilder(lastIndex, this.layoutDimensions)!,
    );
    return Math.max(offset, lastStart + lastExtent) + reserved;
  }

  protected override computeMaxScrollOffset(constraints: SliverConstraints): number {
    const count = this.childManager.childCount;
    if (count === 0) return 0;
    const { weights, consumeMaxWeight } = this.configuration;
    const terminalWeight = consumeMaxWeight
      ? weights.lastMax - weights.firstMax + 1
      : weights.values.length;
    return (
      constraints.viewportMainAxisExtent +
      Math.max(0, count - terminalWeight) * weights.values[0]! * this.unit
    );
  }
}

class CarouselMetrics extends FixedScrollMetrics {
  constructor(
    options: FixedScrollMetricsOptions,
    readonly itemExtent: number | null,
    readonly flexWeights: readonly number[] | null,
    readonly consumeMaxWeight: boolean,
  ) {
    super(options);
  }

  override copyWith(options: ScrollMetricsCopyOptions = {}): CarouselMetrics {
    return new CarouselMetrics(
      copyMetrics(this, options),
      this.itemExtent,
      this.flexWeights,
      this.consumeMaxWeight,
    );
  }
}

function copyMetrics(
  metrics: ScrollMetrics,
  options: ScrollMetricsCopyOptions,
): FixedScrollMetricsOptions {
  return {
    minScrollExtent:
      options.minScrollExtent ?? (metrics.hasContentDimensions ? metrics.minScrollExtent : null),
    maxScrollExtent:
      options.maxScrollExtent ?? (metrics.hasContentDimensions ? metrics.maxScrollExtent : null),
    pixels: options.pixels ?? (metrics.hasPixels ? metrics.pixels : null),
    viewportDimension:
      options.viewportDimension ??
      (metrics.hasViewportDimension ? metrics.viewportDimension : null),
    axisDirection: options.axisDirection ?? metrics.axisDirection,
    devicePixelRatio: options.devicePixelRatio ?? metrics.devicePixelRatio,
  };
}

class CarouselPosition extends ScrollPositionWithSingleContext {
  declare private activityScale: number;
  declare private activityOffset: number;
  declare private parkedItem: number | null;
  declare private lastLeadingItem: number | null;
  declare private pendingItem: { item: number; oldStep: number } | null;
  private clampForLayout = true;
  private view: CarouselView;

  constructor(
    physics: ScrollPhysics,
    context: ScrollContext,
    readonly owner: CarouselViewState,
    readonly initialItem: number,
    oldPosition: ScrollPosition | null,
  ) {
    super({ physics, context, initialPixels: null, oldPosition });
    this.view = owner.widget;
    this.activityScale ??= 1;
    this.activityOffset ??= 0;
    this.parkedItem ??= null;
    this.lastLeadingItem ??= null;
    this.pendingItem ??= null;
  }

  private stepFor(dimension: number): number {
    const weights = this.view.weightLayout;
    return weights === null
      ? Math.min(this.view.itemExtent!, dimension)
      : (dimension * weights.values[0]!) / weights.total;
  }

  get step(): number {
    return this.hasViewportDimension ? this.stepFor(this.viewportDimension) : 0;
  }

  private get cycle(): number {
    return this.view.infinite ? (itemCount(this.view) ?? 0) * this.step : 0;
  }

  private get firstMax(): number {
    return this.view.weightLayout?.firstMax ?? 0;
  }

  private get prominentItem(): number {
    if (this.pendingItem !== null) return this.pendingItem.item;
    if (!this.hasPixels || this.step === 0) return this.parkedItem ?? this.initialItem;
    return this.logicalSlot + (this.view.consumeMaxWeight ? 0 : this.firstMax);
  }

  private get logicalSlot(): number {
    return nearInteger(Math.max(0, this.pixels) / this.step);
  }

  get leadingItem(): number {
    const slot =
      this.step > 0 && this.hasPixels
        ? this.logicalSlot
        : this.prominentItem - (this.view.consumeMaxWeight ? 0 : this.firstMax);
    const leading = Math.floor(slot) - (this.view.consumeMaxWeight ? this.firstMax : 0);
    const count = itemCount(this.view);
    if (this.view.infinite && count !== null && count > 0)
      return ((leading % count) + count) % count;
    return Math.max(0, leading);
  }

  private pixelsFor(item: number): number {
    return Math.max(0, item - (this.view.consumeMaxWeight ? 0 : this.firstMax)) * this.step;
  }

  private cycleShift(pixels: number): number {
    const cycle = this.cycle;
    if (cycle <= 0) return 0;
    const floor = cycle + (this.view.consumeMaxWeight ? this.firstMax * this.step : 0);
    const missingCycles = (floor - pixels) / cycle;
    return missingCycles > precisionErrorTolerance
      ? Math.ceil(nearInteger(missingCycles)) * cycle
      : 0;
  }

  updateConfiguration(view: CarouselView): void {
    const old = this.view;
    const oldWeights = old.flexWeights;
    const weights = view.flexWeights;
    if (
      old.itemExtent === view.itemExtent &&
      old.consumeMaxWeight === view.consumeMaxWeight &&
      old.infinite === view.infinite &&
      itemCount(old) === itemCount(view) &&
      (oldWeights === weights ||
        (oldWeights !== null &&
          weights !== null &&
          oldWeights.length === weights.length &&
          oldWeights.every((weight, index) => weight === weights[index])))
    ) {
      this.view = view;
      return;
    }
    const previous = this.prominentItem;
    const count = itemCount(old);
    this.pendingItem = {
      item: old.infinite && count !== null && count > 0 ? previous % count : previous,
      oldStep: this.pendingItem?.oldStep ?? this.step,
    };
    this.view = view;
    this.clampForLayout = true;
  }

  override beginActivity(activity: ScrollActivity | null): void {
    if (activity !== null) {
      this.activityScale = 1;
      this.activityOffset = 0;
    }
    super.beginActivity(activity);
  }

  override absorb(other: ScrollPosition): void {
    super.absorb(other);
    if (other instanceof CarouselPosition) {
      this.activityScale = other.activityScale;
      this.activityOffset = other.activityOffset;
      this.parkedItem = other.parkedItem;
      this.lastLeadingItem = other.lastLeadingItem;
      this.pendingItem = other.pendingItem;
    }
  }

  override setPixels(value: number): number {
    const absolute =
      this.activity instanceof DrivenScrollActivity ||
      this.activity instanceof BallisticScrollActivity;
    const target = absolute ? value * this.activityScale + this.activityOffset : value;
    const shift = this.cycleShift(target);
    if (shift !== 0) {
      this.correctPixels(this.pixels + shift);
      if (absolute) this.activityOffset += shift;
    }
    return super.setPixels(target + shift);
  }

  override pointerScroll(delta: number): void {
    const shift = delta === 0 ? 0 : this.cycleShift(this.pixels + delta);
    if (shift !== 0) this.correctPixels(this.pixels + shift);
    super.pointerScroll(delta);
  }

  override applyViewportDimension(dimension: number): boolean {
    if (
      this.hasPixels &&
      this.hasViewportDimension &&
      this.viewportDimension === dimension &&
      this.pendingItem === null
    )
      return true;
    const oldPixels = this.hasPixels ? this.pixels : null;
    const oldStep = this.pendingItem?.oldStep ?? this.step;
    const newStep = this.stepFor(dimension);
    const restored =
      this.pendingItem === null && !this.hasViewportDimension && oldPixels !== null && newStep > 0;
    const selected = restored
      ? nearInteger(Math.max(0, oldPixels) / newStep) +
        (this.view.consumeMaxWeight ? 0 : this.firstMax)
      : this.prominentItem;
    const result = super.applyViewportDimension(dimension);
    const count = itemCount(this.view);
    const item =
      !this.view.infinite && count !== null ? Math.min(selected, Math.max(0, count - 1)) : selected;
    const pixels = this.pixelsFor(item);
    const target = pixels + this.cycleShift(pixels);
    this.parkedItem = this.step === 0 ? item : null;
    this.pendingItem = null;
    this.clampForLayout = true;
    if (target === oldPixels) return result;
    if (oldPixels === null) {
      this.correctPixels(target);
    } else {
      const scale = oldStep > 0 && this.step > 0 ? this.step / oldStep : 1;
      this.activityScale *= scale;
      this.activityOffset = this.activityOffset * scale + target - oldPixels * scale;
      this.correctBy(target - oldPixels);
    }
    return false;
  }

  override applyContentDimensions(minimum: number, maximum: number): boolean {
    const shift = maximum === Infinity ? this.cycleShift(this.pixels) : 0;
    if (shift !== 0) {
      this.activityOffset += shift;
      this.correctBy(shift);
      return false;
    }
    if (this.clampForLayout && maximum !== Infinity && this.pixels > maximum) {
      this.correctBy(maximum - this.pixels);
      return false;
    }
    const applied = super.applyContentDimensions(minimum, maximum);
    if (applied) {
      this.clampForLayout = false;
      this.lastLeadingItem ??= this.leadingItem;
    }
    return applied;
  }

  override didUpdateScrollPositionBy(delta: number): void {
    super.didUpdateScrollPositionBy(delta);
    if (this.scrollDisposed || !this.owner.mounted) return;
    const item = this.leadingItem;
    if (item === this.lastLeadingItem) return;
    this.lastLeadingItem = item;
    this.owner.widget.onIndexChanged?.(item);
  }

  offsetForItem(index: number): number {
    const count = itemCount(this.view);
    const item = count === null ? 0 : Math.max(0, Math.min(index, count - 1));
    const offset = this.pixelsFor(item);
    const cycle = this.cycle;
    if (cycle <= 0) return offset;
    const target = Math.floor(this.pixels / cycle) * cycle + offset;
    return target < this.pixels - precisionErrorTolerance ? target + cycle : target;
  }

  override copyWith(options: ScrollMetricsCopyOptions = {}): CarouselMetrics {
    return new CarouselMetrics(
      copyMetrics(this, options),
      this.view.itemExtent,
      this.view.flexWeights,
      this.view.consumeMaxWeight,
    );
  }
}

/** Snaps a carousel to its fixed extent or first weighted extent. */
export class CarouselScrollPhysics extends ScrollPhysics {
  override applyTo(ancestor: ScrollPhysics | null): CarouselScrollPhysics {
    return new CarouselScrollPhysics({ parent: this.buildParent(ancestor) });
  }

  override createBallisticSimulation(position: ScrollMetrics, velocity: number): Simulation | null {
    invariant(
      position instanceof CarouselPosition,
      'incompatible-carousel-physics',
      'CarouselScrollPhysics requires a CarouselController',
    );
    const step = position.step;
    if (
      step === 0 ||
      (velocity <= 0 && position.pixels <= position.minScrollExtent) ||
      (velocity >= 0 && position.pixels >= position.maxScrollExtent)
    )
      return super.createBallisticSimulation(position, velocity);
    const tolerance = this.toleranceFor(position);
    const item = nearInteger(Math.max(0, position.pixels) / step);
    const adjustment =
      velocity < -tolerance.velocity ? -0.5 : velocity > tolerance.velocity ? 0.5 : 0;
    const target = Math.max(
      position.minScrollExtent,
      Math.min(position.maxScrollExtent, Math.round(item + adjustment) * step),
    );
    return target === position.pixels
      ? null
      : new ScrollSpringSimulation(this.spring, position.pixels, target, velocity, { tolerance });
  }
}

export interface CarouselControllerOptions {
  readonly initialItem?: number;
}

export class CarouselController extends ScrollController {
  readonly initialItem: number;

  constructor({ initialItem = 0 }: CarouselControllerOptions = {}) {
    super();
    invariant(
      Number.isSafeInteger(initialItem) && initialItem >= 0,
      'invalid-carousel-initial-item',
      'Initial carousel item must be a nonnegative integer',
    );
    this.initialItem = initialItem;
  }

  get leadingItem(): number {
    return (this.position as CarouselPosition).leadingItem;
  }

  async animateToItem(
    index: number,
    { duration = 300, curve = Curves.ease }: Partial<ViewportAnimationOptions> = {},
  ): Promise<void> {
    invariant(
      Number.isSafeInteger(index),
      'invalid-carousel-item',
      'Carousel item index must be an integer',
    );
    await Promise.all(
      [...this.positions].map((position) => {
        const carousel = position as CarouselPosition;
        if (!carousel.hasContentDimensions) return;
        return carousel.animateTo(carousel.offsetForItem(index), { duration, curve });
      }),
    );
  }

  override attach(position: ScrollPosition): void {
    invariant(
      position instanceof CarouselPosition,
      'incompatible-carousel-controller',
      'CarouselController requires a CarouselView',
    );
    super.attach(position);
  }

  override createScrollPosition(
    physics: ScrollPhysics,
    context: ScrollContext,
    oldPosition: ScrollPosition | null,
  ): ScrollPosition {
    const owner = context.storageContext.findAncestorStateOfType(CarouselViewState);
    invariant(
      owner !== undefined,
      'missing-carousel-state',
      'CarouselController requires a CarouselView',
    );
    return new CarouselPosition(physics, context, owner, this.initialItem, oldPosition);
  }
}
