// SPDX-License-Identifier: BSD-3-Clause
import {
  StatefulWidget,
  State,
  registerNativeWidgetAdapter,
  unregisterNativeWidgetAdapters,
} from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext, BuildOwner } from '@nelyx/core/framework/widgets/framework';
import { SliverMultiBoxAdaptorParentData } from '@nelyx/core/framework/rendering/sliver-multi-box-adaptor';
import { ListView } from '@nelyx/core/framework/widgets/scroll-view';
import {
  SliverChildListDelegate,
  SliverChildBuilderDelegate,
} from '@nelyx/core/framework/widgets/scroll-delegate';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import { ScrollPositionWithSingleContext } from '@nelyx/core/framework/widgets/scroll-position-with-single-context';
import { ScrollContext } from '@nelyx/core/framework/widgets/scroll-context';
import {
  ClampingScrollPhysics,
  AlwaysScrollableScrollPhysics,
} from '@nelyx/core/framework/widgets/scroll-physics';
import type { ScrollPhysics } from '@nelyx/core/framework/widgets/scroll-physics';
import { ScrollActivity } from '@nelyx/core/framework/widgets/scroll-activity';
import { PrimaryScrollController } from '@nelyx/core/framework/widgets/primary-scroll-controller';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { Axis, AxisDirection } from '@nelyx/core/framework/painting/basic-types';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { DragStartBehavior } from '@nelyx/core/framework/gestures/recognizer';
import type { ViewportAnimationOptions } from '@nelyx/core/framework/rendering/viewport-offset';
import { FrameScheduler } from '@nelyx/core/framework/scheduler/scheduler';
import type { FrameCallback } from '@nelyx/core/framework/scheduler/scheduler';
import {
  registerTickerScheduler,
  unregisterTickerScheduler,
} from '@nelyx/core/internal/framework/widgets/ticker-scheduler';
import { ValueKey, KeyMap } from '@nelyx/core/foundation/key';
import type { Key } from '@nelyx/core/foundation/key';
import type { TickerProvider } from '@nelyx/core/framework/animation/ticker';
import type { SemanticsAction } from '@nelyx/core/ui/semantics-action';
import type {
  NodeHandle,
  EngineNodeSnapshot,
  EngineResponse,
  EngineEvent,
} from '../engine-client/codec.ts';
import type { EngineViewClient } from '../engine-client/client.ts';
import { protocol as p } from '../engine-client/schema.ts';
import { OriginalNativeRender, OriginalNativeNode } from './native-node.ts';
import { nativeSliverConfiguration } from '@nelyx/core/framework/rendering/object';

type Fail = (reason: string) => never;
/** Track passive Source callbacks only for this native configuration owner. */
class NativeFrameScheduler extends FrameScheduler {
  private pendingPostFrame = false;
  override addPostFrameCallback(
    callback: FrameCallback,
    options: { readonly debugLabel?: string } = {},
  ): void {
    super.addPostFrameCallback(callback, options);
    // Persistent callbacks still belong to the frame currently being drained.
    if (this.phase !== 'persistent') this.pendingPostFrame = true;
  }
  override endFrame(): void {
    this.pendingPostFrame = false;
    super.endFrame();
  }
  finishBuild(): void {
    if (this.pendingPostFrame) this.requestFrame();
  }
}
interface Host {
  view: EngineViewClient;
  fail: Fail;
  error(error: unknown): void;
}
class NativeActivity extends ScrollActivity {
  get shouldIgnorePointer(): boolean {
    return true;
  }
  get isScrolling(): boolean {
    return true;
  }
  get velocity(): number {
    return 0;
  }
}
interface Request {
  revision: number;
  target: number;
  duration: number;
  id?: bigint;
  seeking?: boolean;
  item?: { readonly index: number; readonly offset: number; resolved: boolean };
  prepared?: {
    readonly minimum: number;
    readonly maximum: number;
    readonly coverage: { readonly minimum: number; readonly maximum: number };
  };
  resolve(): void;
  reject(error: unknown): void;
}
class NativePosition extends ScrollPositionWithSingleContext {
  private request: Request | undefined;
  private node: NodeHandle | undefined;
  private list:
    | {
        node: NodeHandle;
        generation: bigint;
        extent: number | null;
        count: number;
        source: boolean;
      }
    | undefined;
  private coverage: { minimum: number; maximum: number } | undefined;
  private revision = 0;
  private sending = false;
  private stopped = false;
  private preserveDesired = false;
  constructor(
    readonly host: Host,
    context: ScrollContext,
    controller: ScrollController,
    physics: ScrollPhysics | null,
  ) {
    super({
      physics: physics ?? new ClampingScrollPhysics(),
      context,
      initialPixels: controller.initialScrollOffset,
      keepScrollOffset: controller.keepScrollOffset,
      debugLabel: controller.debugLabel,
    });
    if (this.pixels !== 0) this.enqueue(this.pixels, 0);
  }
  protected override forcePixels(value: number): void {
    this.correctPixels(value);
    this.notifyListeners();
  }
  override goBallistic(velocity: number): void {
    if (velocity !== 0) this.host.fail('App-scroll-ballistic');
    this.goIdle();
  }
  override applyUserOffset(_delta: number): void {
    this.host.fail('App-scroll-drag');
  }
  override drag(
    ..._args: Parameters<ScrollPositionWithSingleContext['drag']>
  ): ReturnType<ScrollPositionWithSingleContext['drag']> {
    return this.host.fail('App-scroll-drag');
  }
  override hold(
    ..._args: Parameters<ScrollPositionWithSingleContext['hold']>
  ): ReturnType<ScrollPositionWithSingleContext['hold']> {
    return this.host.fail('App-scroll-hold');
  }
  override jumpTo(value: number): void {
    this.validate(value);
    const revision = ++this.revision;
    this.finish();
    super.jumpTo(value);
    if (!this.stopped && revision === this.revision) this.enqueue(value, 0);
  }
  override jumpToWithoutSettling(value: number): void {
    this.jumpTo(value);
  }
  override pointerScroll(delta: number): void {
    this.jumpTo(this.pixels + delta);
  }
  override animateTo(value: number, options: ViewportAnimationOptions): Promise<void> {
    this.validate(value);
    if (options.curve !== Curves.linear) return this.host.fail('scroll-animation-curve');
    if (
      !Number.isFinite(options.duration) ||
      options.duration < 0 ||
      options.duration > p.limits.commandTimeoutMs - 100
    )
      return this.host.fail('scroll-animation-duration');
    if (!options.duration || value === this.pixels) {
      this.jumpTo(value);
      return Promise.resolve();
    }
    ++this.revision;
    this.finish();
    this.beginActivity(new NativeActivity(this));
    return new Promise<void>((resolve, reject) =>
      this.enqueue(value, options.duration, resolve, reject),
    );
  }
  private validate(value: number): void {
    this.ensureScrollAlive();
    if (!Number.isFinite(value) || Math.abs(value) > 1e12)
      throw RangeError('Invalid native scroll offset');
  }
  private enqueue(
    target: number,
    duration: number,
    resolve = () => {},
    reject = (error: unknown) => this.host.error(error),
  ): void {
    this.preserveDesired = false;
    this.request = { revision: this.revision, target, duration, resolve, reject };
    this.send();
  }
  seekItem(index: number, offset: number): void {
    this.ensureScrollAlive();
    ++this.revision;
    this.finish();
    this.preserveDesired = false;
    this.beginActivity(new NativeActivity(this));
    this.request = {
      revision: this.revision,
      target: 0,
      duration: 0,
      item: { index, offset, resolved: false },
      resolve: () => {},
      reject: (error) => this.host.error(error),
    };
    this.send();
  }
  private send(): void {
    if (
      this.sending ||
      !this.node ||
      !this.request ||
      this.request.id !== undefined ||
      this.stopped
    )
      return;
    this.sending = true;
    const request = this.request;
    if (this.list && !request.prepared) {
      const node = this.node,
        list = this.list;
      // Publication polling may lag a just-completed seek. Read Core coverage
      // for each command phase; absence or an old interval is not unlimited content.
      void this.host.view
        .layoutSnapshot()
        .then((snapshot) => {
          if (this.stopped || this.request !== request) return;
          const viewport = snapshot.nodes.find(
            (value) => value.node.slot === node.slot && value.node.generation === node.generation,
          );
          const sliver = snapshot.nodes.find(
            (value) =>
              value.node.slot === list.node.slot && value.node.generation === list.node.generation,
          );
          if (
            !viewport?.preparedCoverage ||
            !sliver?.list ||
            sliver.list.generation !== list.generation ||
            sliver.parent.slot !== node.slot ||
            sliver.parent.generation !== node.generation
          )
            throw Error('Native list coverage is unavailable');
          request.prepared = {
            minimum: viewport.scrollMinimum,
            maximum: viewport.scrollMaximum,
            coverage: viewport.preparedCoverage,
          };
          if (request.item?.resolved) {
            const row = sliver.list.items.find((row) => row.index === request.item!.index);
            if (!row) throw Error('Native section seek lost its measured row');
            request.target = sliver.y + row.offset + request.item.offset;
            delete request.item;
          }
        })
        .catch((error) => {
          if (!this.stopped && this.request === request) {
            this.request = undefined;
            this.preserveDesired = true;
            this.goIdle();
            request.reject(error);
          }
        })
        .finally(() => {
          this.sending = false;
          this.send();
        });
      return;
    }
    try {
      const target = Math.max(
        request.prepared?.minimum ?? this.minScrollExtent,
        Math.min(request.target, request.prepared?.maximum ?? this.maxScrollExtent),
      );
      const coverage = request.prepared?.coverage ?? this.coverage;
      const uncovered = coverage && (target < coverage.minimum || target > coverage.maximum);
      if (uncovered && request.duration > 0)
        this.host.fail('scroll-animation-outside-prepared-content');
      const item = request.item;
      request.seeking = !!(
        (item && !item.resolved) ||
        (uncovered && this.list && !this.list.source && this.list.count > 0)
      );
      const operation = request.seeking
        ? this.host.view.startListSeek(
            this.node,
            this.list!.node,
            this.list!.generation,
            item?.index ?? Math.min(this.list!.count - 1, Math.floor(target / this.list!.extent!)),
          )
        : uncovered && this.list?.source
          ? this.host.view.startListOffsetSeek(
              this.node,
              this.list.node,
              this.list.generation,
              target,
            )
          : this.host.view.startScroll(this.node, target, request.duration);
      request.id = operation.id;
      void operation.receipt
        .then(
          (result) => {
            if (
              !this.stopped &&
              this.request === request &&
              request.id === operation.id &&
              result.status === p.statuses.ok
            )
              this.completeOperation();
          },
          (error) => {
            if (!this.stopped && this.request === request) {
              this.request = undefined;
              this.preserveDesired = true;
              this.goIdle();
              request.reject(error);
            }
          },
        )
        .finally(() => {
          this.sending = false;
          this.send();
        });
    } catch (error) {
      this.sending = false;
      this.request = undefined;
      this.preserveDesired = true;
      this.goIdle();
      request.reject(error);
    }
  }
  terminal(event: EngineEvent): void {
    if (event.id !== this.request?.id) return;
    if (event.status === p.statuses.ok) this.completeOperation();
    else if (event.status === p.statuses.superseded || event.status === p.statuses.canceled)
      this.finish();
    else {
      const request = this.request;
      this.request = undefined;
      this.preserveDesired = true;
      this.goIdle();
      request.reject(Error('Native scroll failed (' + event.status + ')'));
    }
  }
  private completeOperation(): void {
    if (this.request?.seeking) {
      this.request.seeking = false;
      if (this.request.item) this.request.item.resolved = true;
      delete this.request.id;
      delete this.request.prepared;
      this.coverage = undefined;
      this.send();
    } else this.finish();
  }
  observe(viewport: EngineNodeSnapshot, sliver: EngineNodeSnapshot, extent: number | null): void {
    if (this.stopped) return;
    this.node = viewport.node;
    const list = sliver.list!;
    this.list = {
      node: sliver.node,
      generation: list.generation,
      extent,
      count: list.count,
      source: !!sliver.layoutBuilder,
    };
    this.coverage = viewport.preparedCoverage ?? undefined;
    this.applyViewportDimension(viewport.height);
    this.applyContentDimensions(viewport.scrollMinimum, viewport.scrollMaximum);
    if (
      !this.preserveDesired &&
      (!this.request || this.request.duration > 0) &&
      this.pixels !== viewport.offset
    ) {
      const previous = this.pixels;
      this.forcePixels(viewport.offset);
      this.didUpdateScrollPositionBy(this.pixels - previous);
    }
    this.send();
  }
  get desiredOffset(): number {
    return this.request?.target ?? this.pixels;
  }
  private finish(): void {
    const request = this.request;
    this.request = undefined;
    request?.resolve();
    if (!this.stopped && this.activity) this.goIdle();
  }
  override dispose(): void {
    this.stopped = true;
    this.request?.resolve();
    this.request = undefined;
    this.node = undefined;
    super.dispose();
  }
}
class NativeContext extends ScrollContext {
  constructor(
    readonly storageContext: BuildContext,
    readonly fail: Fail,
  ) {
    super();
  }
  get notificationContext(): BuildContext {
    return this.storageContext;
  }
  get axisDirection(): AxisDirection {
    return AxisDirection.down;
  }
  get devicePixelRatio(): number {
    return this.storageContext.services.readMetrics().scale;
  }
  get vsync(): TickerProvider {
    return { createTicker: () => this.fail('App-scroll-ticker') };
  }
  setIgnorePointer(_value: boolean): void {}
  setCanDrag(_value: boolean): void {}
  setSemanticsActions(_actions: Set<SemanticsAction>): void {}
  saveOffset(_offset: number): void {}
}
interface Entry {
  index: number;
  token: bigint;
  key: Key;
  child: Widget;
  render?: OriginalNativeRender;
}
class NativeList extends StatefulWidget {
  constructor(
    readonly list: ListView,
    readonly host: Host,
    readonly controller: ScrollController | null,
  ) {
    super();
  }
  createState(): NativeListState {
    return new NativeListState();
  }
}
class NativeListState extends State<NativeList> {
  private controller!: ScrollController;
  private position!: NativePosition;
  private ownsController = false;
  private generation = 1n;
  private token = 0n;
  private entries = new Map<number, Entry>();
  private begin = 0;
  private end = 0;
  private count = 0;
  private windowSize = 24;
  private anchor: { index: number; key: bigint } | undefined;
  private focused: number | undefined;
  private sourceViewport: OriginalNativeRender | undefined;
  private get sourceChildren(): boolean {
    return this.widget.list.childPolicy !== 'legacy' || this.widget.list.extentIndex !== null;
  }
  override initState(): void {
    this.controller = this.widget.controller ?? new ScrollController();
    this.ownsController = this.widget.controller === null;
    this.position = new NativePosition(
      this.widget.host,
      new NativeContext(this.context, this.widget.host.fail),
      this.controller,
      this.widget.list.physics,
    );
    this.controller.attach(this.position);
    this.reset();
  }
  override didUpdateWidget(old: NativeList): void {
    const requested = this.widget.controller;
    if (requested !== (this.ownsController ? null : this.controller))
      this.transferController(requested);
    if (old.list !== this.widget.list) {
      ++this.generation;
      this.reset();
    }
  }
  private transferController(requested: ScrollController | null): void {
    const previous = this.controller,
      owned = this.ownsController,
      next = requested ?? new ScrollController();
    let attached = false;
    try {
      previous.detach(this.position);
      next.attach(this.position);
      attached = true;
      this.controller = next;
      this.ownsController = requested === null;
      if (owned) previous.dispose();
    } catch (error) {
      const failures: unknown[] = [error];
      // Canonical detach removes the registration even when onDetach throws;
      // attach rolls itself back when onAttach fails. Restore without invoking
      // a failing application callback again, as the original Scrollable does.
      if (!attached) {
        try {
          previous._restoreAttachmentAfterFailedTransfer(this.position, this.position.context);
        } catch (failure) {
          failures.push(failure);
        }
        if (requested === null)
          try {
            next.dispose();
          } catch (failure) {
            failures.push(failure);
          }
      }
      if (failures.length === 1) throw error;
      throw new AggregateError(failures, 'Native ListView controller replacement failed');
    }
  }
  private reset(): void {
    this.anchor = undefined;
    if (this.sourceChildren) {
      this.entries.clear();
      return;
    }
    const delegate = this.widget.list.childrenDelegate;
    this.count =
      delegate instanceof SliverChildListDelegate
        ? delegate.children.length
        : (delegate as SliverChildBuilderDelegate).childCount!;
    const height = this.context.services.readMetrics().logicalHeight,
      extent = this.widget.list.itemExtent!;
    const size = (this.windowSize = Math.min(
      32,
      Math.max(8, Math.ceil((height * 3) / extent) + 4),
    ));
    this.begin =
      this.entries.size === 0
        ? 0
        : Math.max(
            0,
            Math.min(Math.floor(this.position.desiredOffset / extent) - 2, this.count - size),
          );
    this.end = Math.min(this.count, this.begin + size);
  }
  private fill(): void {
    const wanted = new Set<number>();
    for (let index = this.begin; index < this.end; ++index) wanted.add(index);
    for (const entry of this.entries.values())
      if (
        entry.index === this.focused ||
        (entry.render?.children[0]?.parentData instanceof SliverMultiBoxAdaptorParentData &&
          entry.render.children[0].parentData.keepAlive)
      )
        wanted.add(entry.index);
    if (wanted.size > p.limits.listChildren) this.widget.host.fail('list-keep-alive-budget');
    const previous = new KeyMap<Entry>();
    for (const entry of this.entries.values()) previous.set(entry.key, entry);
    const entries = new Map<number, Entry>();
    for (const index of [...wanted].sort((a, b) => a - b)) {
      const child = this.widget.list.childrenDelegate.build(this.context, index);
      if (!child) return this.widget.host.fail('list-builder-null-before-count');
      const key = child.key ?? new ValueKey(index),
        old = previous.get(key);
      entries.set(index, { index, key, token: old?.token ?? ++this.token, child });
    }
    this.entries = entries;
  }
  private observe = (node: EngineNodeSnapshot, snapshot: EngineResponse): void => {
    if (!this.mounted || node.list?.generation !== this.generation) return;
    const list = node.list,
      parent = snapshot.nodes.find(
        (value) =>
          value.node.slot === node.parent.slot && value.node.generation === node.parent.generation,
      );
    if (!parent) return;
    this.position.observe(parent, node, this.widget.list.itemExtent!);
    const anchor = list.items.find((row) => row.offset + row.extent > parent.offset - node.y);
    if (anchor) this.anchor = { index: anchor.index, key: anchor.key };
    this.focused = undefined;
    let focus = snapshot.focus
      ? snapshot.nodes.find(
          (value) =>
            value.node.slot === snapshot.focus!.node.slot &&
            value.node.generation === snapshot.focus!.node.generation,
        )
      : undefined;
    for (let depth = 0; focus && depth < p.limits.depth; ++depth) {
      const row = list.items.find(
        (value) =>
          value.node.slot === focus!.node.slot && value.node.generation === focus!.node.generation,
      );
      if (row) {
        this.focused = row.index;
        break;
      }
      focus = snapshot.nodes.find(
        (value) =>
          value.node.slot === focus!.parent.slot &&
          value.node.generation === focus!.parent.generation,
      );
    }
    if (list.demandBegin >= this.begin && list.demandEnd <= this.end) return;
    const begin = Math.min(list.demandBegin, Math.max(0, this.count - this.windowSize)),
      end = Math.min(this.count, begin + this.windowSize);
    if (list.demandEnd > end)
      this.widget.host.fail(
        'list-viewport-budget:' + list.demandBegin + ':' + list.demandEnd + ':' + begin + ':' + end,
      );
    this.setState(() => {
      this.begin = begin;
      this.end = end;
    });
  };
  override build(): Widget {
    if (this.sourceChildren) return this.buildSource();
    this.fill();
    const extent = this.widget.list.itemExtent!;
    return new OriginalNativeNode(
      'scrollViewport',
      [
        new OriginalNativeNode(
          'sliver',
          [...this.entries.values()].map(
            (entry) =>
              new OriginalNativeNode(
                'box',
                [entry.child],
                {
                  key: entry.key,
                  listItem: { index: entry.index, key: entry.token },
                  layout: { childConstraints: 'inherit', enforceBounds: true },
                  vertical: { kind: 'finite', min: extent, max: extent },
                },
                (render) => {
                  entry.render = render;
                },
              ),
          ),
          {
            layout: { direction: 'vertical' },
            list: {
              generation: this.generation,
              count: this.count,
              begin: this.begin,
              end: this.end,
              estimate: extent,
              ...(this.anchor
                ? { anchorIndex: this.anchor.index, anchorKey: this.anchor.key }
                : {}),
            },
            onLayout: this.observe,
          },
        ),
      ],
      {
        pointerHitTest: 'self',
        onScrollTerminal: (event) => this.position.terminal(event),
        layout: {},
      },
    );
  }
  private buildSource(): Widget {
    const list = this.widget.list;
    let child = list.buildChildLayout(this.context),
      padding = list.padding?.resolve(
        this.context.maybeDependOn(Directionality)?.direction ?? null,
      );
    const media = list.padding === null ? this.context.maybeDependOn(MediaQuery)?.data : undefined;
    if (media) {
      const source = MediaQuery.paddingOf(this.context),
        remaining = source.copyWith({ top: 0, bottom: 0 });
      padding = source.copyWith({ left: 0, right: 0 });
      child = new MediaQuery(
        {
          ...media,
          padding: remaining,
          viewPadding: MediaQuery.viewPaddingOf(this.context),
          safeArea: {
            left: remaining.left,
            top: remaining.top,
            right: remaining.right,
            bottom: remaining.bottom,
          },
        },
        child,
      );
    }
    return new OriginalNativeNode(
      'scrollViewport',
      [child],
      {
        pointerHitTest: 'self',
        layout: padding
          ? {
              padding: {
                left: padding.left,
                top: padding.top,
                right: padding.right,
                bottom: padding.bottom,
              },
            }
          : {},
        onLayout: this.observeSource,
        onScrollTerminal: (event) => this.position.terminal(event),
      },
      (render) => {
        this.sourceViewport = render;
      },
    );
  }
  private readonly observeSource = (
    viewport: EngineNodeSnapshot,
    snapshot: EngineResponse,
  ): void => {
    const render = this.sourceViewport?.children[0],
      config = render ? nativeSliverConfiguration(render, this.widget.host.fail) : undefined;
    if (
      !this.mounted ||
      !config ||
      !snapshot.visible ||
      snapshot.publishedMetrics !== snapshot.metrics ||
      snapshot.publishedDevice !== snapshot.device ||
      snapshot.publishedDocument !== snapshot.activeDocument
    )
      return;
    const node = snapshot.nodes.find(
      (value) =>
        value.parent.slot === viewport.node.slot &&
        value.parent.generation === viewport.node.generation &&
        value.list,
    );
    if (
      !node?.list ||
      node.list.generation !== config.generation ||
      node.layoutBuilder?.revision !== config.revision
    )
      return;
    this.position.observe(viewport, node, this.widget.list.itemExtent);
    const request = config.takeRequest?.();
    if (request) this.position.seekItem(request.index, request.offset);
  };
  override dispose(): void {
    const errors: unknown[] = [];
    for (const close of [
      () => this.controller.detach(this.position),
      () => this.position.dispose(),
      () => {
        if (this.ownsController) this.controller.dispose();
      },
      () => this.entries.clear(),
      () => {
        this.sourceViewport = undefined;
      },
    ])
      try {
        close();
      } catch (error) {
        errors.push(error);
      }
    super.dispose();
    if (errors.length) throw new AggregateError(errors, 'Native ListView disposal failed');
  }
}
export function installOriginalScrolling(
  owner: BuildOwner,
  view: EngineViewClient,
  fail: Fail,
  error: (error: unknown) => void,
): {
  readonly scheduler: FrameScheduler;
  now(): number;
  frame(at: number): void;
  visible(value: boolean): void;
  postFrame(callback: () => void): void;
  finishBuild(): void;
  close(): void;
} {
  let coreOrigin: number | undefined,
    appOrigin = 0;
  const now = () => (typeof performance === 'undefined' ? Date.now() : performance.now());
  const scheduler = new NativeFrameScheduler({ now }, () => {
    void view.request(p.opcodes.requestAppFrame).catch((cause) => {
      if (!scheduler.disposed) error(cause);
    });
  });
  registerTickerScheduler(owner, scheduler);
  registerNativeWidgetAdapter(owner, 'scroll-view', (widget, context) => {
    if (Object.getPrototypeOf(widget) !== ListView.prototype)
      return fail('custom-or-unported-scroll-view');
    const list = widget as ListView,
      delegate = list.childrenDelegate;
    if (
      list.childPolicy !== 'legacy' &&
      (list.childPolicy.mode !== 'bounded' || list.childPolicy.preparation !== 'disabled')
    )
      return fail('list-child-policy');
    if (
      (!(list.itemExtent && list.itemExtent > 0) && !list.extentIndex) ||
      list.itemExtentBuilder ||
      list.prototypeItem
    )
      return fail('list-requires-fixed-or-indexed-extent');
    if (list.buildChildLayout !== ListView.prototype.buildChildLayout)
      return fail('custom-list-child-layout');
    if (
      list.scrollDirection !== Axis.vertical ||
      list.reverse ||
      list.shrinkWrap ||
      list.center ||
      list.anchor !== 0 ||
      list.scrollBehavior ||
      list.restorationId ||
      list.keyboardDismissBehavior !== null ||
      list.paintOrder.index !== 0 ||
      list.hitTestBehavior.index !== 1 ||
      list.dragStartBehavior !== DragStartBehavior.start ||
      list.clipBehavior !== 'hardEdge'
    )
      return fail('list-scroll-options');
    // The native list owns its coverage window. Explicit Source cache geometry
    // requires a separate mapping; default legacy policy is not a cache request.
    if (list.cacheExtent !== null || list.scrollCacheExtent !== null)
      return fail('list-cache-extent');
    if (
      list.physics &&
      (![ClampingScrollPhysics.prototype, AlwaysScrollableScrollPhysics.prototype].includes(
        Object.getPrototypeOf(list.physics),
      ) ||
        list.physics.parent)
    )
      return fail('custom-scroll-physics');
    const padding = list.padding?.resolve(context.maybeDependOn(Directionality)?.direction ?? null);
    const sourceChildren = list.childPolicy !== 'legacy' || list.extentIndex !== null;
    if (
      !sourceChildren &&
      padding &&
      (padding.left || padding.right || padding.top || padding.bottom)
    )
      return fail('list-padding');
    const mediaPadding = list.padding === null ? MediaQuery.maybePaddingOf(context) : null;
    if (!sourceChildren && mediaPadding && (mediaPadding.top || mediaPadding.bottom))
      return fail('list-media-padding');
    if (
      !(delegate instanceof SliverChildListDelegate) &&
      !(delegate instanceof SliverChildBuilderDelegate && delegate.childCount !== null)
    )
      return fail('list-requires-finite-delegate');
    const count =
      delegate instanceof SliverChildListDelegate ? delegate.children.length : delegate.childCount!;
    if (
      !Number.isSafeInteger(count) ||
      count < 0 ||
      count > 1_000_000 ||
      count * (list.itemExtent ?? list.extentIndex!.estimatedExtent) > 1e12 ||
      (list.semanticChildCount !== null && list.semanticChildCount !== count)
    )
      return fail('list-count-or-semantics');
    const primary =
        list.primary ??
        (list.controller === null &&
          PrimaryScrollController.shouldInherit(context, list.scrollDirection)),
      controller = primary ? PrimaryScrollController.maybeOf(context) : list.controller;
    if (
      controller &&
      controller.createScrollPosition !== ScrollController.prototype.createScrollPosition
    )
      return fail('custom-scroll-position-factory');
    const result = new NativeList(list, { view, fail, error }, controller);
    return primary && controller ? PrimaryScrollController.none({ child: result }) : result;
  });
  return {
    scheduler,
    finishBuild: () => scheduler.finishBuild(),
    now,
    postFrame: (callback) => {
      scheduler.addPostFrameCallback(() => callback());
      scheduler.requestFrame();
    },
    frame: (at) => {
      if (scheduler.disposed) return;
      if (coreOrigin === undefined) {
        coreOrigin = at;
        appOrigin = typeof performance === 'undefined' ? Date.now() : performance.now();
      }
      scheduler.beginFrame(appOrigin + (at - coreOrigin) * 1000);
      scheduler.endFrame();
    },
    visible: (value) => scheduler.setVisible(value),
    close: () => {
      unregisterNativeWidgetAdapters(owner);
      unregisterTickerScheduler(owner);
      scheduler.dispose();
    },
  };
}
