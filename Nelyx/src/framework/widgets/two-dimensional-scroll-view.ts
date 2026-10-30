// SPDX-License-Identifier: BSD-3-Clause
// Finite Nelyx facade over the complete pinned source two-dimensional closure.
import { ChangeNotifier } from '../../foundation/notifier.ts';
import { invariant, NelyxError } from '../../foundation/errors.ts';
import { FlutterErrorDetails } from '../../foundation/assertions.ts';
import { Key, ValueKey, sameKey, KeyMap } from '../../foundation/key.ts';
import { Offset } from '../../ui/offset.ts';
import { StatefulWidget, State, Element } from './framework.ts';
import type { Widget, WidgetOptions, BuildContext } from './framework.ts';
import { BoxConstraints } from '../rendering/constraints.ts';
import { KeyedSubtree } from './basic.ts';
import { ScrollController } from './scroll-controller.ts';
import { ScrollPositionWithSingleContext } from './scroll-position-with-single-context.ts';
import type { ScrollContext } from './scroll-context.ts';
import type { ScrollPosition } from './scroll-position.ts';
import { ScrollPhysics, ClampingScrollPhysics } from './scroll-physics.ts';
import { NotificationListener } from './notification-listener.ts';
import { ScrollMetricsNotification } from './scroll-position.ts';
import type { ViewportAnimationOptions, ViewportOffset } from '../rendering/viewport-offset.ts';
import { Listener } from './listener.ts';
import { PointerScrollEvent, PointerScrollInertiaCancelEvent } from '../gestures/events.ts';
import type { PointerSignalEvent } from '../gestures/events.ts';
import { SourceTwoDimensionalScrollView } from './two-dimensional-scroll-view.generated.ts';
import { SourceTwoDimensionalScrollable } from './two-dimensional-scrollable.generated.ts';
import {
  SourceTwoDimensionalViewport,
  SourceTwoDimensionalViewportElement,
  SourceRenderTwoDimensionalViewport,
} from './two-dimensional-viewport.generated.ts';
import { SourceTwoDimensionalChildBuilderDelegate } from './two-dimensional-delegate.generated.ts';
import { SourceScrollableDetails } from './scrollable-details.generated.ts';
import { ChildVicinity } from './child-vicinity.generated.ts';
import {
  DiagonalDragBehavior,
  TwoAxisRestorationNames,
} from './two-dimensional-scrollable-adapter.ts';
import { ScrollViewKeyboardDismissBehavior } from './scroll-view.ts';

function safeOffset(value: Offset): void {
  invariant(
    value instanceof Offset &&
      [value.dx, value.dy].every(
        (n) => Number.isFinite(n) && Math.abs(n) <= Number.MAX_SAFE_INTEGER,
      ),
    'invalid-two-axis-offset',
    'Two-axis offset must contain safe finite pixels',
  );
}
type GridBinding = {
  readonly rows: number;
  readonly columns: number;
  readonly rowExtent: number;
  readonly columnExtent: number;
};
/** A single viewport owns both roles. Observe this controller for coalesced vector updates.
 * Role controllers expose ordinary per-axis ScrollPosition notifications (e.g. RawScrollbar). */
export class TwoDimensionalScrollController extends ChangeNotifier {
  readonly horizontal: ScrollController;
  readonly vertical: ScrollController;
  private binding: object | null = null;
  private model: GridBinding | null = null;
  private pending = false;
  private lastNotified: Offset | null = null;
  private retired = false;
  private delivering = false;
  private deferredDispose = false;
  private readonly lifetime: { current: TwoDimensionalScrollController | null } = { current: this };
  constructor({
    initialOffset = Offset.zero,
    keepScrollOffset = true,
  }: { readonly initialOffset?: Offset; readonly keepScrollOffset?: boolean } = {}) {
    super();
    safeOffset(initialOffset);
    this.horizontal = new _AxisController({
      initialScrollOffset: initialOffset.dx,
      keepScrollOffset,
    });
    this.vertical = new _AxisController({
      initialScrollOffset: initialOffset.dy,
      keepScrollOffset,
    });
    this.horizontal.addListener(this.changed);
    this.vertical.addListener(this.changed);
  }
  get hasClients(): boolean {
    return this.horizontal.hasClients && this.vertical.hasClients;
  }
  get offset(): Offset {
    this.ensureAlive();
    invariant(
      !this.retired && this.hasClients,
      'unattached-two-axis-controller',
      'Two-axis controller needs its mounted viewport',
    );
    return new Offset(this.horizontal.offset, this.vertical.offset);
  }
  private readonly changed = () => {
    if (this.retired || this.pending) return;
    this.pending = true;
    const token = this.lifetime;
    void Promise.resolve().then(() => {
      const controller = token.current;
      if (!controller) return;
      controller.pending = false;
      if (!controller.hasClients) return;
      const offset = controller.offset;
      if (controller.lastNotified?.equals(offset)) return;
      controller.lastNotified = offset;
      controller.delivering = true;
      try {
        controller.notifyListeners();
      } finally {
        controller.delivering = false;
        if (controller.deferredDispose) controller.finishDispose();
      }
    });
  };
  /** @internal Layout corrections also change the public vector snapshot. */
  _didUpdateMetrics(): void {
    this.changed();
  }
  /** @internal One immutable token fences replacement/late detach. */
  _bind(token: object, model: GridBinding): void {
    this.ensureAlive();
    invariant(
      !this.retired && (this.binding === null || this.binding === token),
      'two-axis-controller-in-use',
      'A two-axis controller can own only one mounted viewport',
    );
    this.binding = token;
    this.model = model;
  }
  /** @internal */ _unbind(token: object): void {
    if (this.binding === token) {
      this.binding = null;
      this.model = null;
    }
  }
  private target(value: Offset): Offset {
    safeOffset(value);
    this.ensureAlive();
    invariant(
      !this.retired && this.hasClients,
      'unattached-two-axis-controller',
      'Two-axis movement needs its mounted viewport',
    );
    const x = this.horizontal.position,
      y = this.vertical.position;
    invariant(
      x.hasContentDimensions && y.hasContentDimensions,
      'unlaid-two-axis-controller',
      'Lay out the viewport before moving it',
    );
    return new Offset(
      Math.max(x.minScrollExtent, Math.min(x.maxScrollExtent, value.dx)),
      Math.max(y.minScrollExtent, Math.min(y.maxScrollExtent, value.dy)),
    );
  }
  jumpTo(value: Offset): void {
    const target = this.target(value);
    this.horizontal.jumpTo(target.dx);
    this.vertical.jumpTo(target.dy);
  }
  async animateTo(value: Offset, options: ViewportAnimationOptions): Promise<void> {
    const target = this.target(value);
    await Promise.all([
      this.horizontal.animateTo(target.dx, options),
      this.vertical.animateTo(target.dy, options),
    ]);
  }
  revealCell(
    row: number,
    column: number,
    options: ViewportAnimationOptions | null = null,
  ): Promise<void> {
    const model = this.model;
    invariant(
      model &&
        Number.isSafeInteger(row) &&
        row >= 0 &&
        row < model.rows &&
        Number.isSafeInteger(column) &&
        column >= 0 &&
        column < model.columns,
      'invalid-two-axis-cell',
      'Cell coordinates must identify a current model cell',
    );
    const value = new Offset(column * model.columnExtent, row * model.rowExtent);
    if (options) return this.animateTo(value, options);
    this.jumpTo(value);
    return Promise.resolve();
  }
  override dispose(): void {
    if (this.retired) return;
    invariant(
      this.binding === null && !this.horizontal.hasClients && !this.vertical.hasClients,
      'attached-two-axis-dispose',
      'Unmount the two-axis viewport before disposing its controller',
    );
    this.retired = true;
    this.lifetime.current = null;
    if (this.delivering) {
      this.deferredDispose = true;
      return;
    }
    this.finishDispose();
  }
  private finishDispose(): void {
    this.horizontal.removeListener(this.changed);
    this.vertical.removeListener(this.changed);
    this.horizontal.dispose();
    this.vertical.dispose();
    super.dispose();
  }
}
class _AxisController extends ScrollController {
  override attach(position: ScrollPosition): void {
    invariant(
      !this.hasClients && position instanceof _GridPosition,
      'invalid-grid-axis-position',
      'Each grid role owns exactly one grid position',
    );
    super.attach(position);
  }
  override createScrollPosition(
    physics: ScrollPhysics,
    context: ScrollContext,
    oldPosition: ScrollPosition | null,
  ): ScrollPosition {
    return new _GridPosition({
      physics,
      context,
      oldPosition,
      initialPixels: this.initialScrollOffset,
      keepScrollOffset: this.keepScrollOffset,
    });
  }
}
class _GridPosition extends ScrollPositionWithSingleContext {
  override applyUserOffset(delta: number): void {
    for (let p: ScrollPhysics | null = this.physics; p; p = p.parent)
      if (!p.allowUserScrolling) return;
    if (this.physics.shouldAcceptUserOffset(this)) super.applyUserOffset(delta);
  }

  // Source Pan coordinates drag; the public vector resolver admits both wheel axes.
  override canScrollBy(_delta: number): boolean {
    return false;
  }
  canMove(delta: number): boolean {
    return super.canScrollBy(delta);
  }
}
export interface TwoDimensionalScrollViewOptions extends WidgetOptions {
  readonly rowCount: number;
  readonly columnCount: number;
  readonly rowExtent: number;
  readonly columnExtent: number;
  readonly cellBuilder: (context: BuildContext, row: number, column: number) => Widget;
  readonly controller?: TwoDimensionalScrollController | null;
  readonly physics?: ScrollPhysics | null;
  readonly horizontalPhysics?: ScrollPhysics | null;
  readonly verticalPhysics?: ScrollPhysics | null;
  readonly reverseHorizontal?: boolean;
  readonly reverseVertical?: boolean;
  readonly cacheExtent?: number;
  readonly restorationId?: string | null;
}
/** Fixed, finite cells; only the viewport/cache window is mounted. Cell keys identify
 * the application's model across row/column mutation; offscreen State is retired. */
export class TwoDimensionalScrollView extends StatefulWidget {
  readonly options: TwoDimensionalScrollViewOptions;
  constructor(options: TwoDimensionalScrollViewOptions) {
    super(options.key ?? null);
    const {
      rowCount,
      columnCount,
      rowExtent,
      columnExtent,
      cellBuilder,
      cacheExtent = 100,
    } = options;
    invariant(
      [rowCount, columnCount].every((n) => Number.isSafeInteger(n) && n >= 0) &&
        [rowExtent, columnExtent].every((n) => Number.isFinite(n) && n > 0) &&
        rowCount * rowExtent <= Number.MAX_SAFE_INTEGER &&
        columnCount * columnExtent <= Number.MAX_SAFE_INTEGER,
      'invalid-two-axis-model',
      'Grid counts and fixed extents must form finite safe ranges',
    );
    invariant(
      typeof cellBuilder === 'function' && Number.isFinite(cacheExtent) && cacheExtent >= 0,
      'invalid-two-axis-builder',
      'Grid requires a cell builder and finite nonnegative cache',
    );
    this.options = Object.freeze({ ...options, cacheExtent });
  }
  createState(): State<TwoDimensionalScrollView> {
    return new _GridState();
  }
}
const cellKeyType = Object.freeze({ twoAxisCell: true }),
  keyEqual = (a: Key, b: Key) => sameKey(a, b),
  keyHash = (a: Key) => a.hashCode;
/** Finite layout and public model policy; source owns Element reuse, selection,
 * viewport painting/hit testing and both Scrollable state machines. */
class _GridDelegate extends SourceTwoDimensionalChildBuilderDelegate {
  private readonly keys = new KeyMap<boolean>();
  constructor(
    readonly options: () => TwoDimensionalScrollViewOptions,
    private readonly pending: { key: Key | null } = { key: null },
  ) {
    super({
      addRepaintBoundaries: false,
      addAutomaticKeepAlives: true,
      maxXIndex: options().columnCount - 1,
      maxYIndex: options().rowCount - 1,
      builder: (context, vicinity) => {
        const child = options().cellBuilder(context, vicinity.yIndex, vicinity.xIndex);
        pending.key = child.key;
        return child;
      },
    });
  }
  beginLayout(): void {
    this.keys.clear();
  }
  override build(context: BuildContext, vicinity: ChildVicinity): Widget | null {
    this.pending.key = null;
    const child = super.build(context, vicinity);
    if (child === null) return null;
    const key =
      this.pending.key === null
        ? new ValueKey(`${vicinity.yIndex}:${vicinity.xIndex}`, cellKeyType)
        : new ValueKey(this.pending.key, cellKeyType, keyEqual, keyHash);
    invariant(
      !this.keys.has(key),
      'duplicate-two-axis-key',
      'Grid cell keys must be unique within the mounted window',
    );
    this.keys.set(key, true);
    return new KeyedSubtree({ key, child });
  }
}
class _GridState extends State<TwoDimensionalScrollView> {
  private owned: TwoDimensionalScrollController | null = null;
  private readonly token = {};
  private suspended = false;
  private delegate!: _GridDelegate;
  private get controller(): TwoDimensionalScrollController {
    return this.widget.options.controller ?? this.owned!;
  }
  private get live(): boolean {
    return this.mounted && !this.suspended && (this.context as Element).active;
  }
  override initState(): void {
    super.initState();
    if (this.widget.options.controller == null) this.owned = new TwoDimensionalScrollController();
    this.delegate = new _GridDelegate(() => this.widget.options);
    this.bind();
  }
  private bind(): void {
    const o = this.widget.options;
    this.controller._bind(this.token, {
      rows: o.rowCount,
      columns: o.columnCount,
      rowExtent: o.rowExtent,
      columnExtent: o.columnExtent,
    });
  }
  override didUpdateWidget(old: TwoDimensionalScrollView): void {
    super.didUpdateWidget(old);
    invariant(
      old.options.controller === this.widget.options.controller,
      'changed-two-axis-controller',
      'Use a new Widget key when changing the two-axis controller',
    );
    this.bind();
    this.delegate.maxXIndex = this.widget.options.columnCount - 1;
    this.delegate.maxYIndex = this.widget.options.rowCount - 1;
    this.delegate.notifyListeners();
  }
  private positions(): readonly [_GridPosition, _GridPosition] | null {
    return this.controller.hasClients
      ? [
          this.controller.horizontal.position as _GridPosition,
          this.controller.vertical.position as _GridPosition,
        ]
      : null;
  }
  private enabled(position: _GridPosition): boolean {
    for (let p: ScrollPhysics | null = position.physics; p; p = p.parent)
      if (!p.allowUserScrolling) return false;
    return position.physics.shouldAcceptUserOffset(position);
  }
  private signal(event: PointerSignalEvent): void {
    if (!this.live) return;
    const positions = this.positions();
    if (!positions) return;
    if (event instanceof PointerScrollInertiaCancelEvent) {
      for (const p of positions) {
        if (!this.live) break;
        p.pointerScroll(0);
      }
      return;
    }
    if (!(event instanceof PointerScrollEvent)) return;
    const dx = event.scrollDelta.dx * (this.widget.options.reverseHorizontal ? -1 : 1),
      dy = event.scrollDelta.dy * (this.widget.options.reverseVertical ? -1 : 1);
    if (!positions.some((p, i) => this.enabled(p) && p.canMove(i === 0 ? dx : dy))) return;
    (this.context as Element).owner.gestureBinding.pointerSignalResolver.register(
      event,
      (signal) => {
        if (!this.live || !this.controller.hasClients) {
          signal.respond({ allowPlatformDefault: true });
          return;
        }
        let consumed = false;
        for (const [i, p] of this.positions()!.entries()) {
          if (!this.live) break;
          const delta = i === 0 ? dx : dy;
          if (this.enabled(p) && p.canMove(delta)) {
            p.pointerScroll(delta);
            consumed = true;
          }
        }
        signal.respond({ allowPlatformDefault: !consumed });
      },
    );
  }
  build(_context: BuildContext): Widget {
    const child = new _FiniteGridScrollView(this.widget.options, this.controller, this.delegate);
    const input = new Listener(child, {
      onPointerSignal: (event) => this.signal(event),
      onPointerCancel: () => {
        for (const p of this.positions() ?? []) {
          if (!this.live) break;
          p.goIdle();
        }
      },
    });
    return new NotificationListener({
      notificationType: ScrollMetricsNotification,
      onNotification: () => {
        if (this.live) this.controller._didUpdateMetrics();
        return false;
      },
      child: input,
    });
  }
  override deactivate(): void {
    this.suspended = true;
    super.deactivate();
  }
  override activate(): void {
    super.activate();
    this.suspended = false;
  }
  override dispose(): void {
    this.suspended = true;
    this.controller._unbind(this.token);
    try {
      this.delegate.dispose();
      this.owned?.dispose();
    } finally {
      super.dispose();
    }
  }
}
class _FiniteGridScrollView extends SourceTwoDimensionalScrollView {
  constructor(
    readonly grid: TwoDimensionalScrollViewOptions,
    controller: TwoDimensionalScrollController,
    delegate: _GridDelegate,
  ) {
    super({
      delegate,
      primary: false,
      diagonalDragBehavior: DiagonalDragBehavior.free,
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.manual,
      cacheExtent: grid.cacheExtent ?? 100,
      horizontalDetails: SourceScrollableDetails.horizontal({
        controller: controller.horizontal,
        reverse: grid.reverseHorizontal ?? false,
        physics: grid.horizontalPhysics ?? grid.physics ?? new ClampingScrollPhysics(),
      }),
      verticalDetails: SourceScrollableDetails.vertical({
        controller: controller.vertical,
        reverse: grid.reverseVertical ?? false,
        physics: grid.verticalPhysics ?? grid.physics ?? new ClampingScrollPhysics(),
      }),
    });
  }
  override sourceBuild(context: BuildContext): Widget {
    const source = super.sourceBuild(context);
    invariant(
      source instanceof SourceTwoDimensionalScrollable,
      'invalid-finite-grid-source',
      'Non-primary manual-dismiss source view must return its Scrollable',
    );
    // The source abstract ScrollView omits restoration configuration. Supply the
    // public facade namespace without replacing source axis ownership or gestures.
    return new TwoAxisRestorationNames(
      new SourceTwoDimensionalScrollable({
        horizontalDetails: source.horizontalDetails,
        verticalDetails: source.verticalDetails,
        viewportBuilder: source.viewportBuilder,
        diagonalDragBehavior: source.diagonalDragBehavior,
        dragStartBehavior: source.dragStartBehavior,
        hitTestBehavior: source.hitTestBehavior,
        restorationId: this.grid.restorationId ?? null,
      }),
    );
  }
  override buildViewport(
    _context: BuildContext,
    verticalOffset: ViewportOffset,
    horizontalOffset: ViewportOffset,
  ): Widget {
    return new _FiniteGridViewport(this.grid, {
      verticalOffset,
      horizontalOffset,
      verticalAxisDirection: this.verticalDetails.direction,
      horizontalAxisDirection: this.horizontalDetails.direction,
      delegate: this.delegate,
      mainAxis: this.mainAxis,
      cacheExtent: this.cacheExtent,
    });
  }
}
class _FiniteGridViewport extends SourceTwoDimensionalViewport {
  constructor(
    readonly grid: TwoDimensionalScrollViewOptions,
    options: ConstructorParameters<typeof SourceTwoDimensionalViewport>[0],
  ) {
    super(options);
  }
  override createRenderObject(context: BuildContext): SourceRenderTwoDimensionalViewport {
    return new _RenderFiniteGrid(this, context as SourceTwoDimensionalViewportElement);
  }
  override updateRenderObject(
    _context: BuildContext,
    render: SourceRenderTwoDimensionalViewport,
  ): void {
    invariant(
      render instanceof _RenderFiniteGrid,
      'invalid-finite-grid-renderer',
      'Expected finite source viewport',
    );
    render.horizontalOffset = this.horizontalOffset;
    render.verticalOffset = this.verticalOffset;
    render.horizontalAxisDirection = this.horizontalAxisDirection;
    render.verticalAxisDirection = this.verticalAxisDirection;
    render.delegate = this.delegate;
    render.mainAxis = this.mainAxis;
    render.cacheExtent = this.cacheExtent;
    render.configure(this.grid);
  }
}
class _RenderFiniteGrid extends SourceRenderTwoDimensionalViewport {
  private grid: TwoDimensionalScrollViewOptions;
  private reportDensity: ((error: unknown) => void) | null;
  constructor(widget: _FiniteGridViewport, childManager: SourceTwoDimensionalViewportElement) {
    super({
      horizontalOffset: widget.horizontalOffset,
      verticalOffset: widget.verticalOffset,
      horizontalAxisDirection: widget.horizontalAxisDirection,
      verticalAxisDirection: widget.verticalAxisDirection,
      mainAxis: widget.mainAxis,
      delegate: widget.delegate,
      cacheExtent: widget.cacheExtent,
      childManager,
    });
    this.grid = widget.grid;
    this.reportDensity = (exception) =>
      childManager.owner.reportError(
        new FlutterErrorDetails({ exception, library: 'widgets library' }),
      );
  }
  override dispose(): void {
    this.reportDensity = null;
    super.dispose();
  }
  configure(grid: TwoDimensionalScrollViewOptions): void {
    if (this.grid === grid) return;
    this.grid = grid;
    this.markNeedsLayout({ withDelegateRebuild: true });
  }
  override layoutChildSequence(): void {
    const { width, height } = this.viewportDimension,
      o = this.grid;
    invariant(
      Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0,
      'unbounded-two-axis',
      'Two-axis viewport requires finite positive width and height',
    );
    for (const [position, extent] of [
      [this.horizontalOffset, Math.max(0, o.columnCount * o.columnExtent - width)],
      [this.verticalOffset, Math.max(0, o.rowCount * o.rowExtent - height)],
    ] as const) {
      if (position instanceof ScrollPositionWithSingleContext && !position.hasContentDimensions) {
        const target = Math.max(0, Math.min(extent, position.pixels));
        if (target !== position.pixels) position.correctBy(target - position.pixels);
      }
      let accepted = false;
      for (let tries = 0; tries < 8 && !accepted; tries++)
        accepted = position.applyContentDimensions(0, extent);
      invariant(
        accepted,
        'unstable-two-axis-dimensions',
        'Grid scroll dimensions did not converge',
      );
    }
    const x = this.horizontalOffset.pixels,
      y = this.verticalOffset.pixels,
      cache = o.cacheExtent ?? 100;
    const firstRow = Math.min(o.rowCount, Math.max(0, Math.floor((y - cache) / o.rowExtent))),
      lastRow = Math.max(
        firstRow,
        Math.min(o.rowCount, Math.ceil((y + height + cache) / o.rowExtent)),
      ),
      firstCol = Math.min(o.columnCount, Math.max(0, Math.floor((x - cache) / o.columnExtent))),
      lastCol = Math.max(
        firstCol,
        Math.min(o.columnCount, Math.ceil((x + width + cache) / o.columnExtent)),
      );
    if ((lastRow - firstRow) * (lastCol - firstCol) > 4096) {
      this.reportDensity?.(
        new NelyxError(
          'oversize-two-axis-density',
          'Grid viewport/cache would exceed4096 live cells; increase extents or reduce cache',
        ),
      );
      return;
    }
    (this.delegate as _GridDelegate).beginLayout();
    for (let row = firstRow; row < lastRow; row++)
      for (let col = firstCol; col < lastCol; col++) {
        const child = this.buildOrObtainChildFor(new ChildVicinity({ xIndex: col, yIndex: row }));
        if (!child) continue;
        child.layout(BoxConstraints.tight({ width: o.columnExtent, height: o.rowExtent }), {
          parentUsesSize: true,
        });
        this.parentDataOf(child).layoutOffset = new Offset(
          col * o.columnExtent - x,
          row * o.rowExtent - y,
        );
      }
  }
}
