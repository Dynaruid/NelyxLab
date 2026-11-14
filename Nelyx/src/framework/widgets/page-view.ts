// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Reviewed port: Flutter 71e4717a, widgets/page_view.dart. Time uses the owning TS scheduler.
import { invariant } from '../../foundation/errors.ts';
import { FoundationBuildMode, precisionErrorTolerance } from '../../foundation/constants.ts';
import { State, StatefulWidget } from './framework.ts';
import type { BuildContext, Widget, WidgetOptions } from './framework.ts';
import { ScrollController } from './scroll-controller.ts';
import type { ScrollControllerCallback } from './scroll-controller.ts';
import { ScrollPositionWithSingleContext } from './scroll-position-with-single-context.ts';
import type { ScrollPosition, EnsureVisibleOptions } from './scroll-position.ts';
import type { ScrollContext } from './scroll-context.ts';
import { ScrollPhysics } from './scroll-physics.ts';
import { FixedScrollMetrics } from './scroll-metrics.ts';
import type {
  ScrollMetrics,
  ScrollMetricsCopyOptions,
  FixedScrollMetricsOptions,
} from './scroll-metrics.ts';
import type { Simulation } from '../physics/simulation.ts';
import { ScrollSpringSimulation } from '../physics/spring-simulation.ts';
import {
  Axis,
  AxisDirection,
  textDirectionToAxisDirection,
  flipAxisDirection,
} from '../painting/basic-types.ts';
import { PageStorage } from './page-storage.ts';
import { Directionality } from './app-data.ts';
import { ScrollConfiguration } from './scroll-configuration.ts';
import type { ScrollBehavior } from './scroll-configuration.ts';
import { NotificationListener } from './notification-listener.ts';
import { ScrollNotification, ScrollUpdateNotification } from './scroll-notification.ts';
import { SliverChildBuilderDelegate, SliverChildListDelegate } from './scroll-delegate.ts';
import type {
  NullableIndexedWidgetBuilder,
  ChildIndexGetter,
  SliverChildDelegate,
} from './scroll-delegate.ts';
import type { ViewportAnimationOptions } from '../rendering/viewport-offset.ts';
import { ScrollCacheExtent } from '../rendering/viewport.ts';
import { Viewport } from './viewport.ts';
import { SliverFillViewport } from './sliver-fill.ts';
import { Scrollable } from './scrollable.ts';
import { DragStartBehavior } from '../gestures/recognizer.ts';
import { HitTestBehavior } from '../rendering/pointer-listener.ts';
import type { RenderObject } from '../rendering/object.ts';
import type { Clip } from '../../ui/clip.ts';
import { clampDouble } from '../../ui/math.ts';

const dartRound = (value: number): number => (value < 0 ? -Math.round(-value) : Math.round(value));
function checkPage(page: number): void {
  invariant(Number.isSafeInteger(page), 'invalid-page', 'Page index must be an integer');
}
function checkFraction(fraction: number): void {
  if (FoundationBuildMode.debug)
    invariant(fraction > 0, 'invalid-page-fraction', 'Viewport fraction must be positive');
}
export class PageController extends ScrollController {
  readonly initialPage: number;
  readonly keepPage: boolean;
  readonly viewportFraction: number;
  constructor({
    initialPage = 0,
    keepPage = true,
    viewportFraction = 1,
    onAttach = null,
    onDetach = null,
  }: {
    readonly initialPage?: number;
    readonly keepPage?: boolean;
    readonly viewportFraction?: number;
    readonly onAttach?: ScrollControllerCallback | null;
    readonly onDetach?: ScrollControllerCallback | null;
  } = {}) {
    super({ onAttach, onDetach });
    checkPage(initialPage);
    checkFraction(viewportFraction);
    this.initialPage = initialPage;
    this.keepPage = keepPage;
    this.viewportFraction = viewportFraction;
  }
  get page(): number | null {
    return (this.position as PagePosition).page;
  }
  override attach(position: ScrollPosition): void {
    invariant(
      position instanceof PagePosition,
      'invalid-page-position',
      'PageController requires a page scroll position',
    );
    super.attach(position);
    position.viewportFraction = this.viewportFraction;
  }
  jumpToPage(page: number): void {
    checkPage(page);
    const position = this.position as PagePosition;
    if (position.cachedPage !== null) position.cachedPage = page;
    else if (!position.hasViewportDimension) position.pageToUseOnStartup = page;
    else position.jumpTo(position.getPixelsFromPage(page));
  }
  animateToPage(page: number, options: ViewportAnimationOptions): Promise<void> {
    checkPage(page);
    const position = this.position as PagePosition;
    if (position.cachedPage !== null) {
      position.cachedPage = page;
      return Promise.resolve();
    }
    if (!position.hasViewportDimension) {
      position.pageToUseOnStartup = page;
      return Promise.resolve();
    }
    return position.animateTo(position.getPixelsFromPage(page), options);
  }
  nextPage(options: ViewportAnimationOptions): Promise<void> {
    return this.animateToPage(dartRound(this.page!) + 1, options);
  }
  previousPage(options: ViewportAnimationOptions): Promise<void> {
    return this.animateToPage(dartRound(this.page!) - 1, options);
  }
  override createScrollPosition(
    physics: ScrollPhysics,
    context: ScrollContext,
    oldPosition: ScrollPosition | null,
  ): ScrollPosition {
    return new PagePosition(physics, context, this, oldPosition);
  }
}
export interface PageMetricsCopyOptions extends ScrollMetricsCopyOptions {
  readonly viewportFraction?: number | null;
}
export class PageMetrics extends FixedScrollMetrics {
  readonly viewportFraction: number;
  constructor({
    viewportFraction,
    ...options
  }: FixedScrollMetricsOptions & { readonly viewportFraction: number }) {
    super(options);
    this.viewportFraction = viewportFraction;
  }
  override copyWith(options: PageMetricsCopyOptions = {}): PageMetrics {
    return new PageMetrics({
      minScrollExtent:
        options.minScrollExtent ?? (this.hasContentDimensions ? this.minScrollExtent : null),
      maxScrollExtent:
        options.maxScrollExtent ?? (this.hasContentDimensions ? this.maxScrollExtent : null),
      pixels: options.pixels ?? (this.hasPixels ? this.pixels : null),
      viewportDimension:
        options.viewportDimension ?? (this.hasViewportDimension ? this.viewportDimension : null),
      axisDirection: options.axisDirection ?? this.axisDirection,
      viewportFraction: options.viewportFraction ?? this.viewportFraction,
      devicePixelRatio: options.devicePixelRatio ?? this.devicePixelRatio,
    });
  }
  get page(): number | null {
    return (
      Math.max(0, clampDouble(this.pixels, this.minScrollExtent, this.maxScrollExtent)) /
      Math.max(1, this.viewportDimension * this.viewportFraction)
    );
  }
}
class PagePosition extends ScrollPositionWithSingleContext {
  // Dart subclass initializers precede super and super calls restore/absorb virtually.
  // Use declarations plus nullish initialization so those calls cannot be erased by JS fields.
  declare pageToUseOnStartup: number;
  declare cachedPage: number | null;
  declare private fraction: number;
  readonly initialPage: number;
  constructor(
    physics: ScrollPhysics,
    context: ScrollContext,
    controller: PageController,
    oldPosition: ScrollPosition | null,
  ) {
    super({
      physics,
      context,
      initialPixels: null,
      keepScrollOffset: controller.keepPage,
      oldPosition,
    });
    this.initialPage = controller.initialPage;
    this.fraction ??= controller.viewportFraction;
    this.pageToUseOnStartup ??= controller.initialPage;
    this.cachedPage ??= null;
  }
  get viewportFraction(): number {
    return this.fraction;
  }
  set viewportFraction(value: number) {
    if (this.fraction === value) return;
    const oldPage = this.page;
    this.fraction = value;
    if (oldPage !== null) this.forcePixels(this.getPixelsFromPage(oldPage));
  }
  private get initialPageOffset(): number {
    return Math.max(0, (this.viewportDimension * (this.viewportFraction - 1)) / 2);
  }
  getPageFromPixels(pixels: number, viewportDimension: number): number {
    if (FoundationBuildMode.debug)
      invariant(
        viewportDimension > 0,
        'zero-page-viewport',
        'Page conversion requires a positive viewport',
      );
    const actual =
      Math.max(0, pixels - this.initialPageOffset) / (viewportDimension * this.viewportFraction);
    const rounded = dartRound(actual);
    return Math.abs(actual - rounded) < precisionErrorTolerance ? rounded : actual;
  }
  getPixelsFromPage(page: number): number {
    return page * this.viewportDimension * this.viewportFraction + this.initialPageOffset;
  }
  get page(): number | null {
    if (!this.hasPixels) return null;
    return this.hasContentDimensions || this.haveDimensions
      ? (this.cachedPage ??
          this.getPageFromPixels(
            clampDouble(this.pixels, this.minScrollExtent, this.maxScrollExtent),
            this.viewportDimension,
          ))
      : null;
  }
  override ensureVisible(
    object: RenderObject,
    { targetRenderObject: _target, ...options }: EnsureVisibleOptions = {},
  ): Promise<void> {
    return super.ensureVisible(object, options);
  }
  protected override saveScrollOffset(): void {
    PageStorage.maybeOf(this.context.storageContext)?.writeState(
      this.context.storageContext,
      this.cachedPage ?? this.getPageFromPixels(this.pixels, this.viewportDimension),
    );
  }
  protected override restoreScrollOffset(): void {
    if (this.hasPixels) return;
    const value = PageStorage.maybeOf(this.context.storageContext)?.readState(
      this.context.storageContext,
    );
    if (value != null) {
      invariant(typeof value === 'number', 'invalid-stored-page', 'Stored page must be a number');
      this.pageToUseOnStartup = value;
    }
  }
  protected override saveOffset(): void {
    this.context.saveOffset(
      this.cachedPage ?? this.getPageFromPixels(this.pixels, this.viewportDimension),
    );
  }
  override restoreOffset(
    offset: number,
    { initialRestore = false }: { readonly initialRestore?: boolean } = {},
  ): void {
    if (initialRestore) this.pageToUseOnStartup = offset;
    else this.jumpTo(this.getPixelsFromPage(offset));
  }
  override applyViewportDimension(dimension: number): boolean {
    const oldDimension = this.hasViewportDimension ? this.viewportDimension : null;
    if (dimension === oldDimension) return true;
    const result = super.applyViewportDimension(dimension);
    const oldPixels = this.hasPixels ? this.pixels : null;
    const page =
      oldPixels === null
        ? this.pageToUseOnStartup
        : oldDimension === 0
          ? this.cachedPage!
          : this.getPageFromPixels(oldPixels, oldDimension!);
    const pixels = this.getPixelsFromPage(page);
    this.cachedPage = dimension === 0 ? page : null;
    if (pixels !== oldPixels) {
      this.correctPixels(pixels);
      return false;
    }
    return result;
  }
  override absorb(other: ScrollPosition): void {
    super.absorb(other);
    if (other instanceof PagePosition && other.cachedPage != null)
      this.cachedPage = other.cachedPage;
  }
  override applyContentDimensions(min: number, max: number): boolean {
    const minimum = min + this.initialPageOffset;
    return super.applyContentDimensions(minimum, Math.max(minimum, max - this.initialPageOffset));
  }
  override copyWith(options: PageMetricsCopyOptions = {}): PageMetrics {
    return new PageMetrics({
      minScrollExtent:
        options.minScrollExtent ?? (this.hasContentDimensions ? this.minScrollExtent : null),
      maxScrollExtent:
        options.maxScrollExtent ?? (this.hasContentDimensions ? this.maxScrollExtent : null),
      pixels: options.pixels ?? (this.hasPixels ? this.pixels : null),
      viewportDimension:
        options.viewportDimension ?? (this.hasViewportDimension ? this.viewportDimension : null),
      axisDirection: options.axisDirection ?? this.axisDirection,
      viewportFraction: options.viewportFraction ?? this.viewportFraction,
      devicePixelRatio: options.devicePixelRatio ?? this.devicePixelRatio,
    });
  }
}
class ForceImplicitScrollPhysics extends ScrollPhysics {
  constructor(
    private readonly implicit: boolean,
    parent: ScrollPhysics | null = null,
  ) {
    super({ parent });
  }
  override get allowImplicitScrolling(): boolean {
    return this.implicit;
  }
  override applyTo(ancestor: ScrollPhysics | null): ForceImplicitScrollPhysics {
    return new ForceImplicitScrollPhysics(this.implicit, this.buildParent(ancestor));
  }
  override shouldUpdate(old: ScrollPhysics): boolean {
    return (
      !(old instanceof ForceImplicitScrollPhysics) ||
      this.implicit !== old.implicit ||
      super.shouldUpdate(old)
    );
  }
}
export class PageScrollPhysics extends ScrollPhysics {
  override applyTo(ancestor: ScrollPhysics | null): PageScrollPhysics {
    return new PageScrollPhysics({ parent: this.buildParent(ancestor) });
  }
  override get allowSelectionEdgeScrolling(): boolean {
    return false;
  }
  override get allowImplicitScrolling(): boolean {
    return false;
  }
  override createBallisticSimulation(position: ScrollMetrics, velocity: number): Simulation | null {
    if (
      (velocity <= 0 && position.pixels <= position.minScrollExtent) ||
      (velocity >= 0 && position.pixels >= position.maxScrollExtent)
    )
      return super.createBallisticSimulation(position, velocity);
    const tolerance = this.toleranceFor(position);
    let page =
      position instanceof PagePosition
        ? position.page!
        : position.pixels / position.viewportDimension;
    if (velocity < -tolerance.velocity) page -= 0.5;
    else if (velocity > tolerance.velocity) page += 0.5;
    const target =
      position instanceof PagePosition
        ? position.getPixelsFromPage(dartRound(page))
        : dartRound(page) * position.viewportDimension;
    return target === position.pixels
      ? null
      : new ScrollSpringSimulation(this.spring, position.pixels, target, velocity, { tolerance });
  }
}
export interface PageViewOptions extends WidgetOptions {
  readonly controller?: PageController;
  readonly children?: readonly Widget[];
  readonly scrollDirection?: Axis;
  readonly reverse?: boolean;
  readonly physics?: ScrollPhysics;
  readonly pageSnapping?: boolean;
  readonly padEnds?: boolean;
  readonly onPageChanged?: (page: number) => void;
  readonly dragStartBehavior?: DragStartBehavior;
  readonly allowImplicitScrolling?: boolean;
  readonly scrollCacheExtent?: ScrollCacheExtent;
  readonly restorationId?: string | null;
  readonly clipBehavior?: Clip;
  readonly hitTestBehavior?: HitTestBehavior;
  readonly scrollBehavior?: ScrollBehavior;
}
export class PageView extends StatefulWidget {
  readonly childrenDelegate: SliverChildDelegate;
  readonly scrollCacheExtent: ScrollCacheExtent;
  constructor(
    readonly options: PageViewOptions = {},
    delegate?: SliverChildDelegate,
  ) {
    super(options.key ?? null);
    const implicit = options.allowImplicitScrolling ?? false;
    if (FoundationBuildMode.debug && options.scrollCacheExtent)
      invariant(
        options.scrollCacheExtent.value > 0 === implicit,
        'inconsistent-page-cache',
        'Page cache extent must agree with allowImplicitScrolling',
      );
    this.scrollCacheExtent =
      options.scrollCacheExtent ?? ScrollCacheExtent.viewport(implicit ? 1 : 0);
    this.childrenDelegate = delegate ?? new SliverChildListDelegate(options.children ?? []);
  }
  get itemCount(): number | null {
    return this.childrenDelegate.estimatedChildCount;
  }
  get itemBuilder(): NullableIndexedWidgetBuilder {
    return this.childrenDelegate instanceof SliverChildBuilderDelegate
      ? this.childrenDelegate.builder
      : (context, index) => this.childrenDelegate.build(context, index);
  }
  static builder({
    itemBuilder,
    itemCount = null,
    findChildIndexCallback = null,
    ...options
  }: Omit<PageViewOptions, 'children'> & {
    readonly itemBuilder: NullableIndexedWidgetBuilder;
    readonly itemCount?: number | null;
    readonly findChildIndexCallback?: ChildIndexGetter | null;
  }): PageView {
    return new PageView(
      options,
      new SliverChildBuilderDelegate(itemBuilder, {
        childCount: itemCount,
        findChildIndexCallback,
      }),
    );
  }
  static custom({
    childrenDelegate,
    ...options
  }: Omit<PageViewOptions, 'children'> & {
    readonly childrenDelegate: SliverChildDelegate;
  }): PageView {
    return new PageView(options, childrenDelegate);
  }
  createState(): State {
    return new PageViewState();
  }
}
class PageViewState extends State<PageView> {
  private controller!: PageController;
  private lastReportedPage = 0;
  override initState(): void {
    super.initState();
    this.controller = this.widget.options.controller ?? new PageController();
    this.lastReportedPage = this.controller.initialPage;
  }
  override didUpdateWidget(old: PageView): void {
    if (old.options.controller !== this.widget.options.controller) {
      if (!old.options.controller) this.controller.dispose();
      this.controller = this.widget.options.controller ?? new PageController();
    }
    super.didUpdateWidget(old);
  }
  override dispose(): void {
    if (!this.widget.options.controller) this.controller.dispose();
    super.dispose();
  }
  private reportPage(page: number): void {
    if (this.widget.options.onPageChanged && page !== this.lastReportedPage) {
      this.lastReportedPage = page;
      this.widget.options.onPageChanged(page);
    }
  }
  build(context: BuildContext): Widget {
    const options = this.widget.options;
    const axis = options.scrollDirection ?? Axis.horizontal;
    const direction =
      axis === Axis.horizontal
        ? textDirectionToAxisDirection(Directionality.of(context))
        : AxisDirection.down;
    const axisDirection = options.reverse ? flipAxisDirection(direction) : direction;
    const parent = options.physics ?? options.scrollBehavior?.getScrollPhysics(context) ?? null;
    const physics = new ForceImplicitScrollPhysics(options.allowImplicitScrolling ?? false).applyTo(
      options.pageSnapping === false ? parent : new PageScrollPhysics().applyTo(parent),
    );
    return new NotificationListener({
      notificationType: ScrollNotification,
      onNotification: (notification) => {
        if (
          notification.depth === 0 &&
          options.onPageChanged &&
          notification instanceof ScrollUpdateNotification
        ) {
          invariant(
            notification.metrics instanceof PageMetrics,
            'invalid-page-metrics',
            'PageView updates require PageMetrics',
          );
          this.reportPage(dartRound(notification.metrics.page!));
        }
        return false;
      },
      child: new Scrollable({
        dragStartBehavior: options.dragStartBehavior ?? DragStartBehavior.start,
        axisDirection,
        controller: this.controller,
        physics,
        restorationId: options.restorationId ?? null,
        hitTestBehavior: options.hitTestBehavior ?? HitTestBehavior.opaque,
        scrollBehavior:
          options.scrollBehavior ?? ScrollConfiguration.of(context).copyWith({ scrollbars: false }),
        viewportBuilder: (_context, position) =>
          new Viewport({
            scrollCacheExtent: this.widget.scrollCacheExtent,
            axisDirection,
            offset: position,
            clipBehavior: options.clipBehavior ?? 'hardEdge',
            slivers: [
              new SliverFillViewport({
                viewportFraction: this.controller.viewportFraction,
                delegate: this.widget.childrenDelegate,
                padEnds: options.padEnds ?? true,
                allowImplicitScrolling: options.allowImplicitScrolling ?? false,
              }),
            ],
          }),
      }),
    });
  }
}
