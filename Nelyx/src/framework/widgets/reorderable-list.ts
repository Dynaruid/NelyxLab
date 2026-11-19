// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/widgets/reorderable_list.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { Key, KeyMap, ValueKey, sameKey } from '../../foundation/key.ts';
import { invariant } from '../../foundation/errors.ts';
import { FlutterError } from '../../foundation/flutter-error.ts';
import { FlutterErrorDetails } from '../../foundation/assertions.ts';
import {
  StatefulWidget,
  State,
  StatelessWidget,
  InheritedWidget,
  Element,
  LeafRenderObjectWidget,
} from './framework.ts';
import type { Widget, BuildContext, WidgetOptions } from './framework.ts';
import { GlobalKey } from './global-key.ts';
import { AnimationController } from '../animation/animation-controller.ts';
import type { Animation } from '../animation/animation.ts';
import { Curves } from '../animation/curves.ts';
import { TickerCanceled } from '../animation/ticker-future.ts';
import { TickerProviderStateMixin } from './ticker-provider.ts';
import { MediaQuery } from './app-data.ts';
import {
  ImmediateMultiDragGestureRecognizer,
  DelayedMultiDragGestureRecognizer,
} from '../gestures/multidrag.ts';
import type { MultiDragGestureRecognizer } from '../gestures/multidrag.ts';
import type { GestureRecognizerOptions } from '../gestures/recognizer.ts';
import { Drag } from '../gestures/drag.ts';
import type { DragUpdateDetails } from '../gestures/drag-details.ts';
import { InheritedTheme } from './inherited-theme.ts';
import type { CapturedThemes } from './inherited-theme.ts';
import { Overlay, OverlayEntry } from './overlay.ts';
import type { OverlayState } from './overlay.ts';
import { DragBoundary } from './drag-boundary.ts';
import type { DragBoundaryDelegate } from './drag-boundary.ts';
import { AutomaticKeepAliveClientMixin } from './automatic-keep-alive.ts';
import { ScrollController } from './scroll-controller.ts';
import { Scrollable } from './scrollable.ts';
import { CustomScrollView, ListView } from './scroll-view.ts';
import { SliverChildBuilderDelegate } from './scroll-delegate.ts';
import type { IndexedWidgetBuilder } from './scroll-delegate.ts';
import { SliverFixedExtentList, SliverList, SliverVariedExtentList } from './sliver.ts';
import { SliverPrototypeExtentList } from './sliver-prototype-extent-list.ts';
import type { ScrollPhysics } from './scroll-physics.ts';
import { EdgeDraggingAutoScroller } from './scrollable-helpers.ts';
import { Axis, axisDirectionIsReversed } from '../painting/basic-types.ts';
import { GestureDetector } from './gesture-detector.ts';
import type { GestureOptions } from './gesture-detector.ts';
import { Listener } from './listener.ts';
import { ListenableBuilder } from './listenable-builder.ts';
import { KeyedSubtree, Stack, Positioned, SizedBox } from './basic.ts';
import { IgnorePointer } from './pointer-blocking.ts';
import { RenderBox } from '../rendering/object.ts';
import type { BoxConstraints } from '../rendering/constraints.ts';
import type { ItemExtentBuilder } from '../rendering/sliver.ts';
import { MatrixUtils } from '../painting/matrix-utils.ts';
import { Matrix4 } from '../../math/matrix4.ts';
import { Rect } from '../../ui/rect.ts';
import { Offset } from '../../ui/offset.ts';
import type { Offset as Point, Size } from '../../ui/geometry.ts';
import { Paint } from '../../ui/paint.ts';
import type { PaintingContext } from '../painting/context.ts';
import { tickerScheduler } from './ticker-scheduler.ts';

interface ReorderableListOptions extends WidgetOptions {
  /** Insertion slot in the original list; when oldIndex < newIndex, subtract one after removal. */
  readonly onReorder: (oldIndex: number, newIndex: number) => void;
  readonly controller?: ScrollController | null;
  readonly scrollDirection?: Axis;
  readonly reverse?: boolean;
  readonly physics?: ScrollPhysics | null;
  readonly itemExtent?: number | null;
  readonly autoScrollVelocityScalar?: number;
  readonly feedbackColor?: number;
}
export interface ReorderableListViewOptions extends ReorderableListOptions {
  readonly children: readonly Widget[];
}
export type ReorderItemProxyDecorator = (
  child: Widget,
  index: number,
  animation: Animation<number>,
) => Widget;
export type ReorderDragBoundaryProvider = (
  context: BuildContext,
) => DragBoundaryDelegate<Rect> | null;
export interface ReorderableListViewBuilderOptions extends ReorderableListOptions {
  readonly itemCount: number;
  readonly itemBuilder: IndexedWidgetBuilder;
  readonly scrollViewBuilder?: (sliver: Widget) => Widget;
  readonly itemExtentBuilder?: ItemExtentBuilder | null;
  readonly prototypeItem?: Widget | null;
  readonly onReorderStart?: ((index: number) => void) | null;
  readonly onReorderEnd?: ((index: number) => void) | null;
  /** @internal Notifies the design wrapper on completion and cancellation. */
  readonly onDragStateChanged?: ((dragging: boolean) => void) | null;
  readonly proxyDecorator?: ReorderItemProxyDecorator | null;
  readonly dragBoundaryProvider?: ReorderDragBoundaryProvider | null;
}
export class ReorderableListView extends StatefulWidget {
  readonly children: readonly Widget[];
  readonly onReorder: ReorderableListViewOptions['onReorder'];
  readonly controller: ScrollController | null;
  readonly scrollDirection: Axis;
  readonly reverse: boolean;
  readonly physics: ScrollPhysics | null;
  readonly itemExtent: number | null;
  readonly autoScrollVelocityScalar: number;
  readonly feedbackColor: number;
  /** @internal */ readonly lazyOptions: ReorderableListViewBuilderOptions | null;
  constructor(options: ReorderableListViewOptions | ReorderableListViewBuilderOptions) {
    const {
      onReorder,
      controller = null,
      scrollDirection = Axis.vertical,
      reverse = false,
      physics = null,
      itemExtent = null,
      autoScrollVelocityScalar = 20,
      feedbackColor = 0x663367d6,
      key = null,
    } = options;
    super(key);
    const children = 'children' in options ? options.children : [];
    this.lazyOptions = 'itemBuilder' in options ? options : null;
    invariant(
      typeof onReorder === 'function',
      'missing-reorder-callback',
      'Reordering requires a model callback',
    );
    if (this.lazyOptions !== null) {
      invariant(
        Number.isSafeInteger(this.lazyOptions.itemCount) && this.lazyOptions.itemCount >= 0,
        'invalid-reorder-count',
        'Reorderable itemCount must be a nonnegative integer',
      );
      invariant(
        [itemExtent, this.lazyOptions.itemExtentBuilder, this.lazyOptions.prototypeItem].filter(
          (value) => value != null,
        ).length <= 1,
        'conflicting-reorder-extents',
        'Choose one reorderable item extent',
      );
    }
    invariant(
      scrollDirection === Axis.vertical || scrollDirection === Axis.horizontal,
      'invalid-reorder-axis',
      'Reorder axis must be horizontal or vertical',
    );
    invariant(
      Number.isFinite(autoScrollVelocityScalar) && autoScrollVelocityScalar > 0,
      'invalid-auto-scroll-velocity',
      'Edge scroll velocity must be positive',
    );
    invariant(
      itemExtent === null || (Number.isFinite(itemExtent) && itemExtent > 0),
      'invalid-reorder-extent',
      'Reorder extent must be positive',
    );
    const keys = new KeyMap<boolean>();
    for (const child of children) {
      invariant(
        child.key instanceof Key,
        'missing-reorder-key',
        'Every reorderable child needs a stable key',
      );
      invariant(
        !keys.has(child.key),
        'duplicate-reorder-key',
        'Reorderable child keys must be unique',
      );
      keys.set(child.key, true);
    }
    this.children = Object.freeze([...children]);
    this.onReorder = onReorder;
    this.controller = controller;
    this.scrollDirection = scrollDirection;
    this.reverse = reverse;
    this.physics = physics;
    this.itemExtent = itemExtent;
    this.autoScrollVelocityScalar = autoScrollVelocityScalar;
    this.feedbackColor = feedbackColor;
  }
  createState(): ReorderableListViewState {
    return new ReorderableListViewState();
  }
  static builder(options: ReorderableListViewBuilderOptions): ReorderableListView {
    return new ReorderableListView(options);
  }
}
interface DragProxy {
  readonly item: _ReorderItemState;
  readonly entry: OverlayEntry;
  readonly overlay: OverlayState;
  readonly animation: AnimationController;
  readonly themes: CapturedThemes;
  dropPosition: Point | null;
}
interface DragSession {
  readonly key: Key;
  readonly oldIndex: number;
  targetIndex: number;
  readonly grab: Point;
  readonly startPointer: Point;
  readonly size: Size;
  pointer: Point;
  readonly metrics: string;
  readonly reversed: boolean;
  readonly boundary: DragBoundaryDelegate<Rect> | null;
  proxy: DragProxy | null;
}
const itemKeyType = Object.freeze({ reorderItem: true });
const equalKeys = (a: Key, b: Key) => sameKey(a, b),
  hashKey = (key: Key) => key.hashCode;
export class ReorderableListViewState extends TickerProviderStateMixin<ReorderableListView> {
  private owned: ScrollController | null = null;
  private items = new KeyMap<_ReorderItemState>();
  private readonly contentKeys = new KeyMap<GlobalKey>();
  private content = new KeyMap<Widget>();
  private order: Key[] = [];
  private indices = new KeyMap<number>();
  private body: Widget | null = null;
  private drag: DragSession | null = null;
  private autoScroller: EdgeDraggingAutoScroller | null = null;
  private revision = 0;
  private scheduled = false;
  private readonly lifetime: { current: ReorderableListViewState | null } = { current: this };
  get isReordering(): boolean {
    return this.drag !== null;
  }
  get draggedKey(): Key | null {
    return this.drag?.key ?? null;
  }
  get previewOrder(): readonly Key[] {
    return Object.freeze([...this.order]);
  }
  get scrollController(): ScrollController {
    return this.widget.controller ?? (this.owned ??= new ScrollController());
  }
  private get count(): number {
    return this.widget.lazyOptions?.itemCount ?? this.order.length;
  }
  private get live(): boolean {
    return this.mounted && (this.context as Element).active;
  }
  override initState(): void {
    super.initState();
    this.resetContent();
  }
  private indexOrder(): void {
    this.indices.clear();
    this.order.forEach((key, index) => this.indices.set(key, index));
    this.body = null;
  }
  private resetContent(): void {
    this.content.clear();
    this.order = this.widget.children.map((child) => {
      this.content.set(child.key!, child);
      return child.key!;
    });
    this.indexOrder();
  }
  override didUpdateWidget(old: ReorderableListView): void {
    super.didUpdateWidget(old);
    if (old.controller !== this.widget.controller) {
      invariant(
        old.lazyOptions !== null,
        'changed-reorder-controller',
        'Use a new Widget key when changing a reorder controller',
      );
      this.clear(true);
      this.owned?.dispose();
      this.owned = null;
    }
    const sameOrder =
      old.children.length === this.widget.children.length &&
      old.lazyOptions?.itemCount === this.widget.lazyOptions?.itemCount &&
      old.children.every((child, index) => sameKey(child.key, this.widget.children[index]!.key));
    if (
      !sameOrder ||
      old.scrollDirection !== this.widget.scrollDirection ||
      old.reverse !== this.widget.reverse
    ) {
      this.clear(false);
      this.resetContent();
    } else {
      this.content.clear();
      for (const child of this.widget.children) this.content.set(child.key!, child);
      this.body = null;
    }
    if (
      old.autoScrollVelocityScalar !== this.widget.autoScrollVelocityScalar ||
      old.physics !== this.widget.physics
    ) {
      this.autoScroller?.stopAutoScroll();
      this.autoScroller = null;
    }
  }
  private metrics(): string {
    const m = this.context.services.readMetrics();
    return `${m.logicalWidth}/${m.logicalHeight}/${m.scale}/${m.viewportGeneration}`;
  }
  private axis(point: Point): number {
    return this.widget.scrollDirection === Axis.vertical ? point.y : point.x;
  }
  private rect(item: _ReorderItemState): Rect | null {
    if (!item.mounted || !(item.context as Element).active) return null;
    const box = item.context.findRenderObject();
    if (!(box instanceof RenderBox) || !box.attached || !box.hasSize) return null;
    const rect = MatrixUtils.transformRect(
      Matrix4.fromList(box.getTransformTo(null)),
      Rect.fromLTWH(0, 0, box.size.width, box.size.height),
    );
    return rect.isFinite && !rect.isEmpty ? rect : null;
  }
  _register(item: _ReorderItemState): void {
    this.items.set(item.widget.itemKey, item);
  }
  _unregister(item: _ReorderItemState): void {
    const key = item.widget.itemKey;
    if (this.items.get(key) !== item) return;
    this.items.delete(key);
    this.contentKeys.delete(key);
  }
  _contentKey(key: Key): GlobalKey {
    let value = this.contentKeys.get(key);
    if (value === undefined) {
      value = new GlobalKey('Reorderable item content');
      this.contentKeys.set(key, value);
    }
    return value;
  }
  _isDragged(key: Key): boolean {
    return this.drag !== null && sameKey(this.drag.key, key);
  }
  _start(item: _ReorderItemState, point: Point): boolean {
    if (!this.live || this.drag !== null) return false;
    const rect = this.rect(item),
      index = item.widget.modelIndex ?? this.indices.get(item.widget.itemKey);
    if (rect === null || index === undefined) return false;
    const scrollable = Scrollable.of(item.context);
    invariant(
      this.widget.lazyOptions?.scrollViewBuilder !== undefined ||
        ([...this.scrollController.positions].length === 1 &&
          scrollable.position === this.scrollController.position),
      'reorder-scroll-owner',
      'Reorder requires its one body Scrollable',
    );
    const options = this.widget.lazyOptions;
    const boundary =
      options === null
        ? null
        : options.dragBoundaryProvider
          ? options.dragBoundaryProvider(this.context)
          : DragBoundary.forRectMaybeOf(this.context);
    boundary?.nearestPositionWithinBoundary(rect);
    const drag: DragSession = {
      key: item.widget.itemKey,
      oldIndex: index,
      targetIndex: index,
      grab: new Offset(point.x - rect.left, point.y - rect.top),
      startPointer: point,
      size: rect.size,
      pointer: point,
      metrics: this.metrics(),
      reversed: axisDirectionIsReversed(scrollable.axisDirection),
      boundary,
      proxy: null,
    };
    if (options !== null) {
      const overlay = Overlay.of(item.context);
      const themes = InheritedTheme.capture(item.context, overlay.context);
      const animation = new AnimationController({ vsync: this, duration: 250 });
      const entry = new OverlayEntry({ builder: (context) => this.buildProxy(context, drag) });
      drag.proxy = { item, overlay, themes, animation, entry, dropPosition: null };
    }
    this.revision++;
    this.drag = drag;
    try {
      this.autoScroller = new EdgeDraggingAutoScroller(scrollable, {
        velocityScalar: this.widget.autoScrollVelocityScalar,
        onScrollViewScrolled: () => this.schedulePlacement(),
      });
      if (drag.proxy !== null) {
        const { overlay, entry, animation } = drag.proxy;
        overlay.insert(entry);
        void animation.forward();
      }
      item.dragChanged();
      this.setState(() => {});
      options?.onDragStateChanged?.(true);
      options?.onReorderStart?.(index);
      if (this.drag === drag) this.updatePlacement();
    } catch (failure) {
      if (this.drag === drag) this.clear(true);
      throw failure;
    }
    return this.drag === drag;
  }
  _move(point: Point): void {
    const drag = this.drag;
    if (!drag || drag.proxy?.dropPosition || !this.live) return;
    drag.pointer =
      drag.proxy === null
        ? point
        : this.widget.scrollDirection === Axis.vertical
          ? new Offset(drag.startPointer.x, point.y)
          : new Offset(point.x, drag.startPointer.y);
    this.updatePlacement();
  }
  private feedback(drag = this.drag): Rect | null {
    if (drag === null) return null;
    const rect = Rect.fromLTWH(
      drag.pointer.x - drag.grab.x,
      drag.pointer.y - drag.grab.y,
      drag.size.width,
      drag.size.height,
    );
    return drag.boundary?.nearestPositionWithinBoundary(rect) ?? rect;
  }
  private schedulePlacement(): void {
    if (!this.live || !this.drag || this.scheduled) return;
    this.scheduled = true;
    const token = this.lifetime,
      revision = this.revision;
    tickerScheduler(this.context).addPostFrameCallback(
      () => {
        const state = token.current;
        if (!state) return;
        state.scheduled = false;
        if (state.live && state.revision === revision && state.drag) state.updatePlacement();
      },
      { debugLabel: 'reorder placement' },
    );
    this.setState(() => {});
  }
  private updatePlacement(): void {
    const d = this.drag;
    if (!d || !this.live || d.proxy?.dropPosition) return;
    if (this.metrics() !== d.metrics) {
      this._cancel();
      return;
    }
    const feedback = this.feedback()!,
      center =
        this.widget.scrollDirection === Axis.vertical ? feedback.center.y : feedback.center.x,
      sign = d.reversed ? -1 : 1;
    let target = d.targetIndex;
    for (const item of this.items.values()) {
      if (sameKey(item.widget.itemKey, d.key)) continue;
      const index =
          item.widget.modelIndex === null
            ? this.indices.get(item.widget.itemKey)
            : this.visualIndex(item.widget.modelIndex),
        rect = this.rect(item);
      if (index === undefined || rect === null) continue;
      const value = this.widget.scrollDirection === Axis.vertical ? rect.center.y : rect.center.x;
      if (index > d.targetIndex && center * sign > value * sign) target = Math.max(target, index);
      else if (index < d.targetIndex && center * sign < value * sign)
        target = Math.min(target, index);
    }
    if (target !== d.targetIndex) {
      if (this.widget.lazyOptions === null) {
        const [key] = this.order.splice(d.targetIndex, 1);
        this.order.splice(target, 0, key!);
        this.indexOrder();
      } else {
        this.body = null;
      }
      d.targetIndex = target;
      this.schedulePlacement();
    }
    const scroller = this.autoScroller;
    if (scroller !== null) {
      const extent =
        this.widget.scrollDirection === Axis.vertical ? feedback.height : feedback.width;
      const position = scroller.scrollable.position;
      const target =
        d.proxy !== null && position.hasViewportDimension && extent < position.viewportDimension
          ? feedback
          : Rect.fromLTWH(d.pointer.x - 1, d.pointer.y - 1, 2, 2);
      scroller.startAutoScrollIfNecessary(target);
    }
    d.proxy?.entry.markNeedsBuild();
    this.setState(() => {});
  }
  private clear(notify: boolean): void {
    const drag = this.drag;
    const key = drag?.key;
    this.revision++;
    this.drag = null;
    this.scheduled = false;
    this.autoScroller?.stopAutoScroll();
    this.autoScroller = null;
    this.disposeProxy(drag?.proxy ?? null);
    this.resetContent();
    if (drag !== null) this.widget.lazyOptions?.onDragStateChanged?.(false);
    if (key && notify) this.items.get(key)?.dragChanged();
    if (notify && this.live) this.setState(() => {});
  }
  _cancel(): void {
    this.clear(true);
  }
  _end(): void {
    const drag = this.drag;
    if (!drag || drag.proxy?.dropPosition || !this.live) return;
    const old = drag.oldIndex,
      slot = drag.targetIndex > old ? drag.targetIndex + 1 : drag.targetIndex,
      changed = drag.targetIndex !== old,
      callback = this.widget.onReorder,
      report =
        this.context.services.reportError ??
        ((error) =>
          FlutterError.reportError(
            new FlutterErrorDetails({ exception: error, library: 'widgets reorder' }),
          ));
    const token = this.lifetime;
    if (drag.proxy !== null) {
      this.autoScroller?.stopAutoScroll();
      drag.proxy.dropPosition = this.rect(drag.proxy.item)?.topLeft ?? this.feedback(drag)!.topLeft;
      try {
        this.widget.lazyOptions?.onReorderEnd?.(slot);
      } catch (error) {
        if (this.drag === drag) this.clear(true);
        throw error;
      }
      if (this.drag !== drag) return;
      const settle = drag.proxy.animation.reverse().orCancel;
      void settle
        .then(() => {
          const state = token.current;
          if (!state?.live || state.drag !== drag) return;
          state.clear(true);
          if (changed) callback(old, slot);
        })
        .catch((error) => {
          if (!(error instanceof TickerCanceled)) report(error);
        });
    } else {
      this.clear(true);
      const revision = this.revision;
      // Raw PointerCancel in the same dispatch invalidates this admission.
      void Promise.resolve()
        .then(() => {
          const state = token.current;
          if (state?.live && state.revision === revision && changed) callback(old, slot);
        })
        .catch((error) => report(error));
    }
  }
  /** Same pre-removal insertion-slot convention as onReorder; useful for application keyboard actions. */
  reorder(oldIndex: number, newIndex: number): void {
    invariant(
      this.live && !this.drag,
      'reorder-admission',
      'Programmatic reorder needs an active idle list',
    );
    const count = this.count;
    invariant(
      Number.isSafeInteger(oldIndex) &&
        oldIndex >= 0 &&
        oldIndex < count &&
        Number.isSafeInteger(newIndex) &&
        newIndex >= 0 &&
        newIndex <= count,
      'invalid-reorder-index',
      'Invalid reorder index',
    );
    if (newIndex === oldIndex || newIndex === oldIndex + 1) return;
    this.widget.onReorder(oldIndex, newIndex);
  }
  private disposeProxy(proxy: DragProxy | null): void {
    if (!proxy) return;
    proxy.animation.dispose();
    if (proxy.entry.overlay !== null) proxy.entry.remove();
    proxy.entry.dispose();
  }
  private buildProxy(context: BuildContext, drag: DragSession): Widget {
    const proxy = drag.proxy!;
    if (this.drag !== drag) return new SizedBox();
    const overlayBox = proxy.overlay.context.findRenderObject();
    if (!(overlayBox instanceof RenderBox) || !overlayBox.hasSize) return new SizedBox();
    const mountedChild = new _ReorderScope(proxy.item, proxy.item.liveChild);
    const child =
      this.widget.lazyOptions?.proxyDecorator?.(
        mountedChild,
        drag.oldIndex,
        proxy.animation.view,
      ) ?? mountedChild;
    let content = proxy.themes.wrap(child);
    if (context.maybeDependOn(MediaQuery) !== undefined)
      content = MediaQuery.removePadding({ context, removeTop: true, child: content });
    return new ListenableBuilder({
      listenable: proxy.animation,
      child: new IgnorePointer(content),
      builder: (_context, child) => {
        const current = this.feedback(drag)!.topLeft;
        const drop = proxy.dropPosition;
        const t = Curves.easeOut.transform(proxy.animation.value);
        const point =
          drop === null
            ? current
            : new Offset(drop.x + (current.x - drop.x) * t, drop.y + (current.y - drop.y) * t);
        const origin = overlayBox.globalToLocal(point);
        return new Positioned(child!, {
          left: origin.x,
          top: origin.y,
          width: drag.size.width,
          height: drag.size.height,
        });
      },
    });
  }
  _proxyPlaceholder(itemKey: Key): Widget | null {
    const drag = this.drag;
    return drag !== null && drag.proxy !== null && sameKey(itemKey, drag.key)
      ? new SizedBox(drag.size.width, drag.size.height)
      : null;
  }
  private visualIndex(index: number): number {
    const drag = this.drag;
    if (drag === null) return index;
    if (index === drag.oldIndex) return drag.targetIndex;
    if (index > drag.oldIndex && index <= drag.targetIndex) return index - 1;
    if (index < drag.oldIndex && index >= drag.targetIndex) return index + 1;
    return index;
  }
  private modelIndex(slot: number): number {
    const drag = this.drag;
    if (drag === null) return slot;
    if (slot === drag.targetIndex) return drag.oldIndex;
    if (slot >= drag.oldIndex && slot < drag.targetIndex) return slot + 1;
    if (slot <= drag.oldIndex && slot > drag.targetIndex) return slot - 1;
    return slot;
  }
  private buildLazyList(options: ReorderableListViewBuilderOptions): Widget {
    const delegate = new SliverChildBuilderDelegate(
      (context, slot) => {
        const index = this.modelIndex(slot);
        const child = options.itemBuilder(context, index);
        invariant(
          child.key instanceof Key,
          'missing-reorder-key',
          'Every reorderable child needs a stable key',
        );
        return new _ReorderItem(
          this,
          child.key,
          child,
          new ValueKey(child.key, itemKeyType, equalKeys, hashKey),
          index,
        );
      },
      {
        childCount: options.itemCount,
        findChildIndexCallback: (key) => {
          if (this.drag === null || !(key instanceof ValueKey) || !(key.value instanceof Key))
            return null;
          const index = this.items.get(key.value)?.widget.modelIndex;
          return index == null ? null : this.visualIndex(index);
        },
      },
    );
    const sliver =
      this.widget.itemExtent !== null
        ? new SliverFixedExtentList({ delegate, itemExtent: this.widget.itemExtent })
        : options.itemExtentBuilder != null
          ? new SliverVariedExtentList({
              delegate,
              itemExtentBuilder: (index, dimensions) =>
                options.itemExtentBuilder!(this.modelIndex(index), dimensions),
            })
          : options.prototypeItem != null
            ? new SliverPrototypeExtentList({ delegate, prototypeItem: options.prototypeItem })
            : new SliverList({ delegate });
    return (
      options.scrollViewBuilder?.(sliver) ??
      new CustomScrollView({
        controller: this.scrollController,
        primary: false,
        scrollDirection: this.widget.scrollDirection,
        reverse: this.widget.reverse,
        physics: this.widget.physics,
        slivers: [sliver],
      })
    );
  }
  build(_context: BuildContext): Widget {
    if (this.widget.lazyOptions !== null)
      return (this.body ??= this.buildLazyList(this.widget.lazyOptions));
    this.body ??= new ListView({
      controller: this.scrollController,
      primary: false,
      scrollDirection: this.widget.scrollDirection,
      reverse: this.widget.reverse,
      physics: this.widget.physics,
      itemExtent: this.widget.itemExtent,
      children: this.order.map(
        (key) =>
          new _ReorderItem(
            this,
            key,
            this.content.get(key)!,
            new ValueKey(key, itemKeyType, equalKeys, hashKey),
          ),
      ),
    });
    return new Stack([
      this.body,
      new Positioned(
        new IgnorePointer(new _ReorderFeedback(this.feedback(), this.widget.feedbackColor)),
        { left: 0, top: 0, right: 0, bottom: 0 },
      ),
    ]);
  }
  override deactivate(): void {
    this.clear(false);
    super.deactivate();
  }
  override dispose(): void {
    this.lifetime.current = null;
    this.autoScroller?.stopAutoScroll();
    this.autoScroller = null;
    this.disposeProxy(this.drag?.proxy ?? null);
    this.drag = null;
    this.items.clear();
    this.contentKeys.clear();
    try {
      this.owned?.dispose();
    } finally {
      super.dispose();
    }
  }
}
class _ReorderItem extends StatefulWidget {
  constructor(
    readonly owner: ReorderableListViewState,
    readonly itemKey: Key,
    readonly child: Widget,
    key: Key,
    readonly modelIndex: number | null = null,
  ) {
    super(key);
  }
  createState(): _ReorderItemState {
    return new _ReorderItemState();
  }
}
class _ReorderItemState extends AutomaticKeepAliveClientMixin<_ReorderItem> {
  get liveChild(): Widget {
    return new KeyedSubtree({
      key: this.widget.owner._contentKey(this.widget.itemKey),
      child: this.widget.child,
    });
  }
  protected get wantKeepAlive(): boolean {
    return this.widget.owner._isDragged(this.widget.itemKey);
  }
  override initState(): void {
    super.initState();
    this.widget.owner._register(this);
  }
  override didUpdateWidget(old: _ReorderItem): void {
    super.didUpdateWidget(old);
    this.updateKeepAlive();
  }
  dragChanged(): void {
    if (this.mounted && (this.context as Element).active) {
      this.updateKeepAlive();
      this.setState(() => {});
    }
  }
  build(context: BuildContext): Widget {
    super.build(context);
    const owner = this.widget.owner;
    if (this.widget.modelIndex === null) return new _ReorderScope(this, this.widget.child);
    return new _ReorderScope(this, owner._proxyPlaceholder(this.widget.itemKey) ?? this.liveChild);
  }
  override dispose(): void {
    try {
      this.widget.owner._unregister(this);
    } finally {
      super.dispose();
    }
  }
}
class _ReorderScope extends InheritedWidget {
  constructor(
    readonly item: _ReorderItemState,
    child: Widget,
  ) {
    super(child);
  }
  updateShouldNotify(old: this): boolean {
    return old.item !== this.item;
  }
}
export interface ReorderableDragHandleOptions extends WidgetOptions {
  readonly child: Widget;
  readonly enabled?: boolean;
}
/** Place a handle inside each keyed child. Dragging elsewhere retains normal list/editor gestures. */
export class ReorderableDragHandle extends StatelessWidget {
  readonly child: Widget;
  readonly enabled: boolean;
  constructor({ child, enabled = true, key = null }: ReorderableDragHandleOptions) {
    super(key);
    this.child = child;
    this.enabled = enabled;
  }
  build(context: BuildContext): Widget {
    const scope = context.dependOn(_ReorderScope),
      owner = scope.item.widget.owner;
    if (!this.enabled) return this.child;
    const options: GestureOptions =
      owner.widget.scrollDirection === Axis.vertical
        ? {
            onVerticalDragStart: (details) => owner._start(scope.item, details.globalPosition),
            onVerticalDragUpdate: (details) => owner._move(details.globalPosition),
            onVerticalDragEnd: () => owner._end(),
            onVerticalDragCancel: () => owner._cancel(),
          }
        : {
            onHorizontalDragStart: (details) => owner._start(scope.item, details.globalPosition),
            onHorizontalDragUpdate: (details) => owner._move(details.globalPosition),
            onHorizontalDragEnd: () => owner._end(),
            onHorizontalDragCancel: () => owner._cancel(),
          };
    return new Listener(new GestureDetector(this.child, options), {
      onPointerCancel: () => owner._cancel(),
    });
  }
}
export interface ReorderableDragStartListenerOptions extends ReorderableDragHandleOptions {
  readonly index: number;
}

export class ReorderableDragStartListener extends StatefulWidget {
  readonly index: number;
  readonly child: Widget;
  readonly enabled: boolean;
  constructor({ index, child, enabled = true, key = null }: ReorderableDragStartListenerOptions) {
    super(key);
    this.index = index;
    this.child = child;
    this.enabled = enabled;
  }

  createState(): State<ReorderableDragStartListener> {
    return new ReorderableDragListenerState();
  }

  createRecognizer(options: GestureRecognizerOptions): MultiDragGestureRecognizer {
    return new ImmediateMultiDragGestureRecognizer(options);
  }
}

export class ReorderableDelayedDragStartListener extends ReorderableDragStartListener {
  override createRecognizer(options: GestureRecognizerOptions): MultiDragGestureRecognizer {
    return new DelayedMultiDragGestureRecognizer(options);
  }
}

class ReorderableDragListenerState extends State<ReorderableDragStartListener> {
  private recognizer!: MultiDragGestureRecognizer;

  override initState(): void {
    const context = this.context;
    invariant(
      context instanceof Element,
      'invalid-reorder-listener',
      'Reorderable listener requires its View gesture owner',
    );
    this.recognizer = this.widget.createRecognizer({
      binding: context.owner.gestureBinding,
      debugOwner: this.widget,
    });
    this.recognizer.onStart = (position) => {
      if (!this.mounted || !context.active) return null;
      const item = this.context.maybeDependOn(_ReorderScope)?.item;
      const widget = this.widget;
      if (!widget.enabled || item === undefined || item.widget.modelIndex !== widget.index)
        return null;
      const owner = item.widget.owner;
      return owner._start(item, position)
        ? new ReorderableItemDrag(owner, item.widget.itemKey)
        : null;
    };
  }

  override didChangeDependencies(): void {
    this.recognizer.gestureSettings = MediaQuery.maybeGestureSettingsOf(this.context);
  }

  build(): Widget {
    return this.widget.enabled
      ? new Listener(this.widget.child, {
          onPointerDown: (event) => this.recognizer.addPointer(event),
        })
      : this.widget.child;
  }

  override dispose(): void {
    this.recognizer.dispose();
    super.dispose();
  }
}

class ReorderableItemDrag extends Drag {
  constructor(
    private readonly owner: ReorderableListViewState,
    private readonly key: Key,
  ) {
    super();
  }
  override update(details: DragUpdateDetails): void {
    if (this.owner._isDragged(this.key)) this.owner._move(details.globalPosition);
  }
  override end(): void {
    if (this.owner._isDragged(this.key)) this.owner._end();
  }
  override cancel(): void {
    if (this.owner._isDragged(this.key)) this.owner._cancel();
  }
}
class _ReorderFeedback extends LeafRenderObjectWidget {
  constructor(
    readonly target: Rect | null,
    readonly color: number,
  ) {
    super();
  }
  createRenderObject(): _RenderReorderFeedback {
    return new _RenderReorderFeedback(this.target, this.color);
  }
  override updateRenderObject(_context: BuildContext, render: RenderBox): void {
    (render as _RenderReorderFeedback).configure(this.target, this.color);
  }
}
class _RenderReorderFeedback extends RenderBox {
  constructor(
    private target: Rect | null,
    private color: number,
  ) {
    super();
  }
  configure(target: Rect | null, color: number): void {
    this.target = target;
    this.color = color;
    this.markNeedsPaint();
  }
  protected override performLayout(constraints: BoxConstraints): Size {
    return constraints.constrain({ width: 0, height: 0 });
  }
  override paint(context: PaintingContext): void {
    if (this.target === null) return;
    const a = this.globalToLocal(this.target.topLeft),
      b = this.globalToLocal(this.target.bottomRight),
      rect = Rect.fromPoints(a, b).intersect(
        Rect.fromLTWH(0, 0, this.size.width, this.size.height),
      );
    if (rect.isEmpty || !rect.isFinite) return;
    context.drawRect(rect, new Paint({ color: this.color }));
  }
}
