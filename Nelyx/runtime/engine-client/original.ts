// SPDX-License-Identifier: BSD-3-Clause
import {
  BuildOwner,
  Widget as OriginalWidget,
  StatelessWidget,
} from '@nelyx/core/framework/widgets/framework';
import type { Element, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { MediaQuery, mediaFromView } from '@nelyx/core/framework/widgets/app-data';
import { RenderColoredBox } from '@nelyx/core/framework/widgets/basic';
import {
  RenderBox,
  claimNativeRenderObject,
  bindNativeSystemFonts,
  withNativeRenderConfiguration,
} from '@nelyx/core/framework/rendering/object';
import type { RenderObject, NativePaintEntry } from '@nelyx/core/framework/rendering/object';
import type { SystemFontsRelayoutContext } from '@nelyx/core/framework/rendering/object';
import { PaintingBinding, createSystemFontsNotifier } from '@nelyx/core/framework/painting/binding';
import type { NativePaintOptions } from './native-paint.ts';
import { RenderParagraph } from '@nelyx/core/framework/rendering/paragraph';
import { RenderImage } from '@nelyx/core/framework/rendering/image';
import { BoxConstraints as ImageConstraints } from '@nelyx/core/framework/rendering/constraints';
import type { ValueListenable } from '@nelyx/core/foundation/notifier';
import type { OriginalImageSource, OriginalImageSceneLease } from './original-images.ts';
export type {
  OriginalImageSource,
  OriginalImageSceneLease,
  OriginalImageClock,
} from './original-images.ts';
import { AppImageClock } from './app-image-clock.ts';
import type { AppImageClockSnapshot } from './app-image-clock.ts';
import { RenderRepaintBoundary } from '@nelyx/core/framework/rendering/repaint-boundary';
import { RenderIndexedSemantics } from '@nelyx/core/framework/rendering/indexed-semantics';
import {
  RenderClipRect,
  RenderClipRRect,
  RenderClipOval,
  RenderClipPath,
} from '@nelyx/core/framework/rendering/clip';
import { ResourceRegistry } from '@nelyx/core/hosting/resources';
import {
  RenderConstrainedBox,
  RenderPadding,
  RenderFlex,
  RenderStack,
  RenderPositionedBox,
  RenderAlign,
  RenderClip,
  RenderTransform,
  FlexParentData,
  StackParentData,
} from '@nelyx/core/framework/rendering/boxes';
import type { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import type { ViewControllerContext } from '@nelyx/core/hosting/runtime';
import type { ViewMetrics, ResourceId, TextLayoutService } from '@nelyx/core/ui/types';
import { GlobalKey, NodeWidget, Stack, WidgetHost } from './widgets.ts';
import type { EngineExecutionSnapshot, NodeOptions } from './widgets.ts';
import type { EngineViewClient } from './client.ts';
import { protocol as p } from './schema.ts';
import type { AxisBound, EngineResponse } from './codec.ts';
import { drainEngineOwners } from './lifecycle.ts';
import { installOriginalScrolling } from './original-scroll.ts';
import { OriginalNativeRender } from './original-native-node.ts';
import { installOriginalGestures } from './original-gesture.ts';
import { originalControlConfiguration } from './original-controls.ts';
import { OriginalFocusBridge } from './original-focus.ts';
import { OriginalGeometryBridge } from './original-geometry.ts';
import { OriginalLayers } from './original-layers.ts';
import { FlutterErrorDetails } from '@nelyx/core/foundation/assertions';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import type { FoundationPlatformEnvironment } from '@nelyx/core/foundation/platform';
import type { Disposable } from '@nelyx/core/foundation/disposable';
import { GestureBinding, SamplingClock } from '@nelyx/core/framework/gestures/binding';
import { restrictNativeGestureRecognition } from '@nelyx/core/framework/gestures/recognizer';
import { AppTextLayoutService } from './original-text.ts';
import type { AppParagraphFontLease } from './original-text.ts';
import { originalSpanInput } from './original-spans.ts';
export { AppTextLayoutService } from './original-text.ts';
import type { AppTextBackend, AppTextExecution } from './app-text.ts';
import { OriginalFontOwner } from './original-fonts.ts';
import { OriginalEditingBridge } from './original-editing.ts';

export interface OriginalWidgetHostOptions {
  readonly platform?: FoundationPlatformEnvironment;
  readonly onError?: (error: unknown) => void;
  readonly onExecution?: (execution: OriginalWidgetExecution) => void;
  readonly pollEvents?: boolean;
  /** Explicit App services. Missing native services fail when read. */
  readonly services?: ViewControllerContext;
  /** Host-owned synchronous C++ paragraph queries on this App owner. */
  readonly appText?: AppTextBackend;
  /** Shared App owner; canonical images and text use the same registry. */
  readonly appImages?: OriginalImageSource;
  /** The common SDK closes a shared App backend after every service drains. */
  readonly ownsAppText?: boolean;
}
export interface OriginalWidgetExecution extends EngineExecutionSnapshot {
  readonly imageClock?: AppImageClockSnapshot;
  readonly appModel: 'original-elements';
  readonly compatibility: 'partial';
  readonly tsLayoutFallbacks: 0;
  readonly synchronousGeometry: 'unavailable';
  readonly appText?: AppTextExecution;
  readonly fonts?: OriginalFontOwner['execution'];
}
function axis(min: number, max: number): AxisBound {
  if (min === Infinity && max === Infinity) return { kind: 'expand' };
  return max === Infinity ? { kind: 'unbounded', min } : { kind: 'finite', min, max };
}
function bounds(value: BoxConstraints): Pick<NodeOptions, 'horizontal' | 'vertical'> {
  return {
    horizontal: axis(value.minWidth, value.maxWidth),
    vertical: axis(value.minHeight, value.maxHeight),
  };
}
class AppRoot extends StatelessWidget {
  constructor(readonly child: OriginalWidget) {
    super();
  }
  build(context: BuildContext): OriginalWidget {
    return new MediaQuery(mediaFromView(context), this.child);
  }
}

/**
 * Canonical Element/State/GlobalKey work stays on App. Render objects carry
 * configuration only; Content performs every admitted layout in C++.
 * This bounded first bridge deliberately rejects unported render hooks/services.
 */
export class OriginalWidgetHost {
  private readonly native: WidgetHost;
  private readonly owner: BuildOwner;
  private readonly keys = new WeakMap<RenderObject, GlobalKey>();
  private readonly paintKeys = new WeakMap<RenderObject, [GlobalKey[], GlobalKey[]]>();
  private root: Element | undefined;
  private desired: OriginalWidget | undefined;
  private nativeMounted = false;
  private closed = false;
  private building = false;
  private scheduled = false;
  private rerun = false;
  private running: Promise<void> | undefined;
  private closing: Promise<void> | undefined;
  private rejected = 0;
  private bridgeFailure: Error | undefined;
  private metrics: ViewMetrics | undefined;
  private metricsEpoch = 0n;
  private deviceEpoch = 0n;
  private readonly resources: ResourceRegistry | undefined;
  private readonly defaultFont: ResourceId | undefined;
  private readonly textService: AppTextLayoutService | undefined;
  private readonly fontOwner: OriginalFontOwner | undefined;
  private readonly fontNotifications = createSystemFontsNotifier();
  private readonly fontScope: SystemFontsRelayoutContext | null;
  private readonly fontsLive = () => !this.closed;
  private sceneFonts = new Map<bigint, AppParagraphFontLease>();
  private pendingSceneFonts: Map<bigint, AppParagraphFontLease> | undefined;
  private capturingFonts: Map<bigint, AppParagraphFontLease> | undefined;
  private readonly imageLeases = new Map<string, OriginalImageSceneLease>();
  private readonly imageClock: AppImageClock | undefined;
  private readonly imageClockLease: Disposable | undefined;
  private desiredImages = new Set<string>();
  private capturingImages: Set<string> | undefined;
  private readonly imageOpacity = new Map<
    RenderImage,
    { value: ValueListenable<number>; release(): void }
  >();
  private capturingImageRenders: Set<RenderImage> | undefined;
  private readonly reasons: Record<string, number> = {};
  private readonly scrolling: ReturnType<typeof installOriginalScrolling>;
  private readonly focusing: OriginalFocusBridge;
  private readonly editing: OriginalEditingBridge;
  private readonly geometry: OriginalGeometryBridge;
  private readonly layers: OriginalLayers;
  private readonly appGestures: GestureBinding;
  private readonly gestureBindingLease: Disposable;

  constructor(
    readonly view: EngineViewClient,
    private readonly options: OriginalWidgetHostOptions = {},
  ) {
    if (options.services && (options.appText || options.appImages))
      throw Error(
        'Explicit App services and the default App paragraph backend are mutually exclusive',
      );
    if (options.platform) FoundationPlatform.configure(options.platform);
    this.native = new WidgetHost(view, {
      ...options,
      onState: (state) => {
        this.geometry.observeState(state);
        this.layers.observeState(state);
        this.observeMetrics(state);
        this.scrolling.visible(state.visible);
        this.focusing.observeState(state);
      },
      onPublication: (state) => {
        this.geometry.observePublication(state);
        this.layers.observePublication(state);
        this.focusing.observePublication(state);
        this.editing.observePublication(state);
      },
      onAfterEvents: () => this.focusing.finishPoll(),
      onExecution: () => options.onExecution?.(this.execution),
      onAppFrame: (at, serial) => {
        this.scrolling.frame(at);
        this.imageClock?.frame(at, serial);
      },
    });
    this.geometry = new OriginalGeometryBridge(
      this,
      (render) => this.keys.get(render)?.currentNode ?? null,
    );
    this.layers = new OriginalLayers(
      this,
      (reason) => this.unsupported(reason),
      (render) => this.keys.get(render)?.currentNode ?? null,
    );
    if (!options.services) {
      const resources = (this.resources = options.appImages?.resources ?? new ResourceRegistry()),
        owner = view.owner;
      // App's catalog descriptor starts bundled. Each measured paragraph keeps
      // its own immutable cohort binding; this descriptor owns no native face.
      const font = resources.allocateId(
        `engine-v2-fonts:${owner.session}:${owner.app}:${owner.view}:${owner.generation}`,
      );
      resources.register({ ...font, kind: 'font' }, () => {});
      this.defaultFont = resources.captureResource(font);
    }
    const unavailableText = (operation: string): never =>
      this.unsupported('synchronous-App-text-' + operation);
    if (options.appText)
      this.fontOwner = new OriginalFontOwner(view, options.appText, (revision) => {
        this.observeFonts(revision);
      });
    const text: TextLayoutService =
      options.appText && this.resources && this.defaultFont
        ? (this.textService = new AppTextLayoutService(
            options.appText,
            this.resources,
            this.defaultFont,
            (reason) => this.unsupported(reason),
            (revision) => this.fontOwner!.retain(revision),
            options.ownsAppText ?? true,
          ))
        : Object.freeze({
            layout: () => unavailableText('layout'),
            range: () => unavailableText('range'),
            hit: () => unavailableText('hit'),
            fontFamily: (font: ResourceId) => {
              if (!this.ownsDefaultFont(font)) return this.unsupported('foreign-provider-font');
              return 'NelyxDefault';
            },
          });
    this.editing = new OriginalEditingBridge(
      view,
      (render) => this.keys.get(render)?.currentNode ?? null,
      () => this.schedule(),
      (error) => options.onError?.(error),
      (reason) => this.unsupported(reason),
      (apply) => this.focusing.editingFocus(apply),
    );
    const available = {
      owner: this.editing.owner,
      clock: { now: () => this.scrolling.now() },
      editing: this.editing,
      platformServices: undefined,
      // ClipPath probes this optional service while creating configuration.
      // Custom path clippers remain rejected before any App query can run.
      paths: undefined,
      images: options.appImages?.service,
      binaryMessenger: undefined,
      resources: this.resources,
      defaultFont: this.defaultFont,
      text,
      requestFrame: () => this.schedule(),
      readStatus: () => (this.closed ? 'closed' : 'open'),
      readMetrics: () => {
        if (!this.metrics) return this.unsupported('unobserved-viewport');
        return this.metrics;
      },
      reportError: (error: unknown) =>
        options.onError?.(error instanceof FlutterErrorDetails ? error.exception : error),
    };
    const services =
      options.services ??
      (new Proxy(available, {
        get: (target, key) => {
          if (Reflect.has(target, key)) return Reflect.get(target, key);
          return this.unsupported('App-service:' + String(key));
        },
      }) as unknown as ViewControllerContext);
    const systemFonts = options.services
      ? options.services.platformServices instanceof PaintingBinding
        ? options.services.platformServices.systemFonts
        : null
      : this.fontNotifications.systemFonts;
    this.owner = new BuildOwner(
      services,
      () => this.schedule(),
      (callback) => this.scrolling.postFrame(callback),
      {},
      systemFonts,
    );
    this.editing.install(this.owner);
    installOriginalGestures(this.owner, (reason) => this.unsupported(reason));
    this.scrolling = installOriginalScrolling(
      this.owner,
      view,
      (reason) => this.unsupported(reason),
      (error) => options.onError?.(error),
    );
    this.fontScope = systemFonts ? { systemFonts, scheduler: this.scrolling.scheduler } : null;
    if (options.appImages) {
      this.imageClock = new AppImageClock(view, (error) => options.onError?.(error));
      this.imageClockLease = options.appImages.bindClock(this.imageClock);
    }
    this.appGestures = new GestureBinding({
      implicitViewId: view.owner.view,
      gestureArena: this.owner.gestures,
      scheduler: this.scrolling.scheduler,
      clock: new SamplingClock(this.scrolling.now, this.scrolling.now),
      devicePixelRatioForView: (id) =>
        id === view.owner.view && !this.closed ? (this.metrics?.scale ?? null) : null,
      beforeDispatch: () => this.unsupported('App-pointer-dispatch'),
      hitTestInView: () => this.unsupported('App-gesture-hit-test'),
    });
    restrictNativeGestureRecognition(this.appGestures, () =>
      this.unsupported('App-gesture-recognition'),
    );
    this.gestureBindingLease = this.owner.bindGestureBinding(this.appGestures);
    this.focusing = new OriginalFocusBridge(
      this.owner,
      view,
      (render) => this.keys.get(render)?.currentNode ?? null,
      () => !this.running && !this.building && !this.closed,
      (error) => this.options.onError?.(error),
      (peer) => this.native.notifyFocusPeer(peer),
    );
  }
  get counters(): WidgetHost['counters'] {
    return this.native.counters;
  }
  get execution(): OriginalWidgetExecution {
    const native = this.native.execution;
    return Object.freeze({
      ...native,
      appModel: 'original-elements',
      compatibility: 'partial',
      tsLayoutFallbacks: 0,
      synchronousGeometry: 'unavailable',
      ...(this.textService ? { appText: this.textService.execution } : {}),
      ...(this.fontOwner ? { fonts: this.fontOwner.execution } : {}),
      ...(this.imageClock ? { imageClock: this.imageClock.execution } : {}),
      rejectedFallbacks: native.rejectedFallbacks + this.rejected,
      rejectionReasons: Object.freeze({ ...native.rejectionReasons, ...this.reasons }),
    });
  }
  async mount(root: OriginalWidget): Promise<void> {
    this.ensure();
    if (!(root instanceof OriginalWidget)) this.unsupported('foreign-original-widget-identity');
    if (this.desired) throw Error('OriginalWidgetHost is already mounted');
    this.desired = root;
    await this.flush();
  }
  update(root: OriginalWidget): Promise<void> {
    this.ensure();
    if (!(root instanceof OriginalWidget)) this.unsupported('foreign-original-widget-identity');
    if (!this.desired) throw Error('OriginalWidgetHost is not mounted');
    this.desired = root;
    return this.flush();
  }
  /** Explicit bridge control. Public Source FontLoader integration is separate. */
  updateFontCatalog(catalog: Uint8Array | null): Promise<number> {
    this.ensure();
    if (!this.fontOwner) return Promise.reject(Error('Original App font service is unavailable'));
    return this.fontOwner.update(catalog).finally(() => this.options.onExecution?.(this.execution));
  }
  /** Canonical FontLoader backend; the coordinator owns bounded queued copies. */
  loadFont(bytes: Uint8Array, family?: string): Promise<void> {
    this.ensure();
    if (!this.fontOwner) return Promise.reject(Error('Original App font service is unavailable'));
    return this.fontOwner
      .loadFont(bytes, family)
      .finally(() => this.options.onExecution?.(this.execution));
  }
  cancelFontUpdate(): void {
    this.fontOwner?.cancel();
  }
  async recoverFontUpdate(): Promise<number | undefined> {
    this.ensure();
    return this.fontOwner?.recover();
  }
  private ensure(): void {
    if (this.closed) throw Error('OriginalWidgetHost is closed');
  }
  private observeMetrics(state: EngineResponse): void {
    if (this.closed || this.options.services) return;
    this.observeFonts(state.fontRevision);
    if (!state.viewport || state.status !== p.statuses.ok)
      throw Error('Original App viewport is unavailable');
    if (state.metrics < this.metricsEpoch || state.device < this.deviceEpoch) return;
    if (state.metrics === this.metricsEpoch && state.device === this.deviceEpoch) return;
    const generation = (value: bigint) => {
      if (value > BigInt(Number.MAX_SAFE_INTEGER))
        throw Error('Original App viewport generation exceeds its numeric API');
      return Number(value);
    };
    const previous = this.metrics,
      viewport = state.viewport;
    const physicalWidth = Math.round(viewport.width * viewport.scale),
      physicalHeight = Math.round(viewport.height * viewport.scale);
    if (!Number.isFinite(physicalWidth) || !Number.isFinite(physicalHeight))
      throw Error('Original App physical viewport is not finite');
    const next: ViewMetrics = Object.freeze({
      logicalWidth: viewport.width,
      logicalHeight: viewport.height,
      physicalWidth,
      physicalHeight,
      scale: viewport.scale,
      viewportGeneration: generation(state.metrics),
      rendererGeneration: generation(state.device),
      nativeContextGeneration: null,
      nativeSurfaceGeneration: null,
    });
    this.metrics = next;
    this.metricsEpoch = state.metrics;
    this.deviceEpoch = state.device;
    this.owner._viewMetricsChanged(previous, next);
  }
  private observeFonts(revision: bigint): void {
    const before = this.textService?.fontRevision;
    this.textService?.observeFontRevision(revision);
    if (before !== this.textService?.fontRevision) {
      this.fontNotifications.notify();
      if (this.desired) this.schedule();
    }
  }
  /** Explicit observation for hosts that disable automatic event polling. */
  pollEvents(): Promise<void> {
    return this.native.pollEvents();
  }
  private schedule(): void {
    if (this.closed || this.building) return;
    if (this.running) {
      this.rerun = true;
      return;
    }
    if (this.scheduled) return;
    this.scheduled = true;
    void Promise.resolve()
      .then(() => {
        this.scheduled = false;
        if (!this.closed) return this.flush();
      })
      .catch((error) => {
        if (!this.closed) this.options.onError?.(error);
      });
  }
  private unsupported(reason: string): never {
    ++this.rejected;
    this.reasons[reason] = (this.reasons[reason] ?? 0) + 1;
    const error = Error(
      `Original native bridge rejects ${reason}; TypeScript renderer fallback is forbidden`,
    );
    this.bridgeFailure ??= error;
    throw error;
  }
  private ownsDefaultFont(font: ResourceId): boolean {
    return (
      !!this.defaultFont &&
      font.id === this.defaultFont.id &&
      font.generation === this.defaultFont.generation &&
      this.resources?.has(font) === true
    );
  }
  private paragraph(render: RenderParagraph): ReturnType<typeof originalSpanInput> {
    if (!this.ownsDefaultFont(render.config.font)) return this.unsupported('foreign-provider-font');
    return originalSpanInput(render, (reason) => this.unsupported(reason));
  }
  private node(
    render: RenderObject,
    count: { value: number },
    depth = 0,
    semanticsSuppressed = false,
  ): NodeWidget {
    if (++count.value >= p.limits.nodes || depth >= p.limits.depth)
      return this.unsupported('render-tree-budget');
    if (!(render instanceof RenderBox)) return this.unsupported('non-box-render-object');
    const prototype: unknown = Object.getPrototypeOf(render),
      paragraph = prototype === RenderParagraph.prototype;
    const control = originalControlConfiguration(render, (reason) => this.unsupported(reason)),
      layer = this.layers.configuration(render);
    if (render.onPointer || (render.semantics && !paragraph && !control))
      return this.unsupported('render-pointer-or-semantics-hook');
    if (
      [
        'layout',
        'performLayout',
        'paint',
        'hitTest',
        'computeDryLayout',
        'computeMinIntrinsicWidth',
        'computeMaxIntrinsicWidth',
        'computeMinIntrinsicHeight',
        'computeMaxIntrinsicHeight',
      ].some((name) => Object.hasOwn(render, name))
    )
      return this.unsupported('instance-render-hook');
    let kind: NodeWidget['kind'] = 'box';
    let options: NodeOptions = { layout: { childConstraints: 'inherit' } };
    let text: NodeWidget['text'];
    let image: NodeWidget['image'];
    let editable: OriginalNativeRender['editable'];
    if (prototype === OriginalNativeRender.prototype) {
      const source = render as OriginalNativeRender;
      kind = source.kind;
      options = source.options;
      editable = source.editable;
      if (editable) text = editable.text;
    } else if (control) {
      kind = control.kind ?? 'box';
      options = { ...options, ...control.options };
      if (render instanceof RenderConstrainedBox)
        options = { ...options, ...bounds(render.additionalConstraints) };
    } else if (layer) {
      options = { ...options, ...layer };
    } else if (prototype === RenderRepaintBoundary.prototype) {
      options = {
        layout: { childConstraints: 'inherit', enforceBounds: true },
        ...bounds((render as RenderRepaintBoundary).additionalConstraints),
      };
    } else if (prototype === RenderIndexedSemantics.prototype) {
      let ancestor = render.parent;
      while (ancestor && !(ancestor instanceof OriginalNativeRender && ancestor.options.listItem))
        ancestor = ancestor.parent;
      if (
        !(ancestor instanceof OriginalNativeRender) ||
        ancestor.options.listItem?.index !== (render as RenderIndexedSemantics).index
      )
        return this.unsupported('custom-list-semantic-index');
    } else if (prototype === RenderConstrainedBox.prototype) {
      options = {
        layout: { childConstraints: 'inherit', enforceBounds: true },
        ...bounds((render as RenderConstrainedBox).additionalConstraints),
      };
    } else if (prototype === RenderColoredBox.prototype) {
      const box = render as RenderColoredBox;
      if (!box.isAntiAlias) return this.unsupported('colored-box-antialias-disabled');
      options = { ...options, color: box.color };
    } else if (
      prototype === RenderClipRect.prototype ||
      prototype === RenderClipRRect.prototype ||
      prototype === RenderClipOval.prototype ||
      prototype === RenderClipPath.prototype
    ) {
      const clip = render as RenderClipRect | RenderClipRRect | RenderClipOval | RenderClipPath;
      if (clip.clipper) return this.unsupported('custom-clipper');
      kind = 'clip';
      const style: NonNullable<NodeOptions['clipStyle']> = {
        behavior: clip.clipBehavior,
        shape:
          prototype === RenderClipOval.prototype
            ? 'oval'
            : prototype === RenderClipRRect.prototype
              ? 'rrect'
              : 'rect',
      };
      if (prototype === RenderClipRRect.prototype) {
        const rounded = clip as RenderClipRRect,
          border = rounded.borderRadius;
        if (typeof border === 'number') {
          options = {
            ...options,
            clipStyle: {
              ...style,
              radii: [border, border, border, border, border, border, border, border],
            },
          };
        } else {
          const radius = border.resolve(rounded.textDirection),
            corners = [radius.topLeft, radius.topRight, radius.bottomRight, radius.bottomLeft];
          options = {
            ...options,
            clipStyle: {
              ...style,
              radii: corners.flatMap((corner) => [
                Math.max(0, corner.x),
                Math.max(0, corner.y),
              ]) as unknown as NonNullable<typeof style.radii>,
            },
          };
        }
      } else options = { ...options, clipStyle: style };
    } else if (prototype === RenderClip.prototype) {
      kind = 'clip';
      options = {
        layout: { childConstraints: 'inherit', enforceBounds: true },
        ...bounds((render as RenderClip).additionalConstraints),
      };
    } else if (prototype === RenderTransform.prototype) {
      const transform = render as RenderTransform;
      if (!transform.transformHitTests) return this.unsupported('transform-hit-tests-disabled');
      if (transform.filterQuality !== null) return this.unsupported('transform-filter-quality');
      const matrix = transform.matrix;
      if (
        matrix.length === 16 &&
        (matrix[2] !== 0 ||
          matrix[3] !== 0 ||
          matrix[6] !== 0 ||
          matrix[7] !== 0 ||
          matrix[8] !== 0 ||
          matrix[9] !== 0 ||
          matrix[10] !== 1 ||
          matrix[11] !== 0 ||
          matrix[14] !== 0 ||
          matrix[15] !== 1)
      )
        return this.unsupported('transform-non-affine');
      const alignment = transform.alignment?.resolve(transform.textDirection);
      kind = 'transform';
      options = {
        layout: { childConstraints: 'inherit', enforceBounds: true },
        ...bounds(transform.additionalConstraints),
        graphics: {
          transform:
            matrix.length === 6
              ? [matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]]
              : [matrix[0], matrix[1], matrix[4], matrix[5], matrix[12], matrix[13]],
          ...(transform.origin ? { origin: transform.origin } : {}),
          ...(alignment ? { alignment: { x: alignment.x, y: alignment.y } } : {}),
        },
      };
    } else if (prototype === RenderPadding.prototype) {
      const padding = render as RenderPadding;
      options = {
        layout: {
          childConstraints: 'inherit',
          padding: padding.padding.resolve(padding.textDirection),
        },
      };
    } else if (prototype === RenderPositionedBox.prototype || prototype === RenderAlign.prototype) {
      const box = render as RenderPositionedBox;
      const resolved = box.alignment.resolve(box.textDirection ?? 'ltr');
      const widthFactor = box.widthFactor ?? (box.shrink ? 1 : undefined),
        heightFactor = box.heightFactor ?? (box.shrink ? 1 : undefined);
      options = {
        layout: {
          alignment: { x: resolved.x, y: resolved.y },
          alignmentSizing: true,
          ...(widthFactor === undefined ? {} : { widthFactor }),
          ...(heightFactor === undefined ? {} : { heightFactor }),
        },
      };
    } else if (prototype === RenderFlex.prototype) {
      const flex = render as RenderFlex;
      if (flex.items.length) return this.unsupported('flex-legacy-items');
      if (flex.crossAxisAlignment === 'baseline') return this.unsupported('flex-baseline');
      const horizontal = flex.direction === 'horizontal';
      if (
        flex.textDirection === null &&
        ((horizontal &&
          (render.children.length > 1 ||
            flex.mainAxisAlignment === 'start' ||
            flex.mainAxisAlignment === 'end')) ||
          (!horizontal &&
            (flex.crossAxisAlignment === 'start' || flex.crossAxisAlignment === 'end')))
      )
        return this.unsupported('flex-missing-text-direction');
      kind = 'flex';
      options = {
        layout: {
          direction: flex.direction,
          mainSize: flex.mainAxisSize,
          mainAlign: flex.mainAxisAlignment,
          crossAlign: flex.crossAxisAlignment,
          gap: flex.spacing,
          reverseMain: horizontal ? flex.textDirection === 'rtl' : flex.verticalDirection === 'up',
          reverseCross: horizontal ? flex.verticalDirection === 'up' : flex.textDirection === 'rtl',
          shrinkUnboundedMain: true,
          clipOverflow: flex.clipBehavior === 'hardEdge',
        },
      };
    } else if (prototype === RenderStack.prototype) {
      const stack = render as RenderStack;
      if (stack.clipBehavior !== 'none' && stack.clipBehavior !== 'hardEdge')
        return this.unsupported('stack-antialias-clip');
      if (
        render.children.some(
          (child) => child.parentData instanceof StackParentData && child.parentData.isPositioned,
        )
      )
        return this.unsupported('stack-positioned-child');
      const resolved = stack.alignment.resolve(stack.textDirection);
      kind = 'stack';
      options = {
        layout: {
          childConstraints:
            stack.fit === 'expand' ? 'expand' : stack.fit === 'passthrough' ? 'inherit' : 'loose',
          alignment: { x: resolved.x, y: resolved.y },
          expandEmpty: true,
          clipOverflow: stack.clipBehavior === 'hardEdge',
        },
      };
    } else if (prototype === RenderImage.prototype) {
      const source = render as RenderImage,
        value = source.image;
      if (!this.options.appImages) return this.unsupported('App-image-owner-unavailable');
      if (source.matchTextDirection && source.textDirection === null)
        return this.unsupported('image-missing-text-direction');
      this.observeImageOpacity(source);
      if (value) {
        // Validate every Image's exact registry and dimensions, even when an
        // immutable frame snapshot is already shared by other render nodes.
        const captured = this.options.appImages.capture(value),
          key = captured.key;
        let lease = this.imageLeases.get(key);
        if (lease) captured.release();
        else {
          lease = captured;
          this.imageLeases.set(key, lease);
        }
        this.capturingImages!.add(key);
        image = lease.resource;
      }
      const alignment = source.alignment.resolve(source.textDirection),
        center = source.centerSlice;
      kind = 'image';
      options = {
        ...bounds(ImageConstraints.tightFor(source.width, source.height)),
        pointerHitTest: 'self',
        layout: { enforceBounds: true },
        imageStyle: {
          width: value?.width ?? 0,
          height: value?.height ?? 0,
          widthSpecified: source.width !== null,
          heightSpecified: source.height !== null,
          scale: source.scale,
          opacity: source.opacity?.value ?? 1,
          fit: source.fit,
          alignment: { x: alignment.x, y: alignment.y },
          repeat: source.repeat,
          flip: source.matchTextDirection && source.textDirection === 'rtl',
          invert: source.invertColors,
          antialias: source.isAntiAlias,
          color: source.color,
          colorBlendMode: source.colorBlendMode ?? 'srcIn',
          blendMode: source.blendMode,
          filterQuality: source.filterQuality,
          centerSlice: center
            ? { left: center.left, top: center.top, right: center.right, bottom: center.bottom }
            : null,
        },
      };
    } else if (paragraph) {
      const source = render as RenderParagraph;
      const input = this.paragraph(source);
      const { height, ...paragraphOptions } = input.paragraph;
      text = {
        value: input.text,
        size: input.fontSize,
        color: input.color,
        direction: input.textDirection ? 'rtl' : 'ltr',
      };
      const semantics = source.semantics;
      if (
        semantics &&
        ((semantics.role !== 'text' && semantics.role !== 'group') ||
          semantics.name !== text.value.replaceAll('\ufffc', ' ') ||
          Object.keys(semantics).some((key) => !['id', 'role', 'name', 'enabled'].includes(key)))
      )
        return this.unsupported('paragraph-semantics');
      kind = 'paragraph';
      options = {
        paragraph: {
          ...paragraphOptions,
          ...(height === null ? {} : { height }),
          wrap:
            source.paragraphOptions.softWrap !== false ||
            source.paragraphOptions.overflow === 'ellipsis',
        },
        layout: {
          paragraphSizing: true,
          clipOverflow: source.paragraphOptions.overflow !== 'visible',
        },
        ...(semantics
          ? {
              semantics: {
                role: semantics.role === 'group' ? 'group' : 'text',
                label: semantics.name,
                flags: semantics.enabled === false ? p.semanticsFlags.disabled : 0,
              },
            }
          : {}),
      };
    } else return this.unsupported('custom-or-unported-render-object:' + render.constructor.name);
    claimNativeRenderObject(render, this, () => this.schedule());
    if (this.fontScope) bindNativeSystemFonts(render, this, this.fontScope, this.fontsLive);
    this.geometry.bind(render);
    let key = this.keys.get(render);
    if (!key) this.keys.set(render, (key = new GlobalKey()));
    const data = render.parentData;
    if (data instanceof FlexParentData)
      options = { ...options, layout: { ...options.layout, flex: data.flex, fit: data.fit } };
    let children = (control?.children ?? render.children).map((child) =>
      this.node(child, count, depth + 1, semanticsSuppressed || !!control?.suppressChildren),
    );
    const emptyShape = {
      kind: 'rrect' as const,
      radii: Array<number>(8).fill(0),
      strokeWidth: 0,
      strokeColor: 0,
      strokeAlign: 0,
    };
    let paintKeys = this.paintKeys.get(render);
    if (!paintKeys) this.paintKeys.set(render, (paintKeys = [[], []]));
    const sequence = (
      entries: readonly NativePaintEntry[],
      plane: 0 | 1,
    ): readonly NativePaintOptions[] => {
      let paragraphIndex = 0;
      return entries.map((entry) => {
        if (entry.kind !== 'paragraph') {
          const { reference, paragraph: _, ...paint } = entry;
          return {
            ...paint,
            ...(reference
              ? { reference: () => this.keys.get(reference)?.currentNode ?? null }
              : {}),
          };
        }
        if (
          !entry.paragraph ||
          !this.textService ||
          (entry.clip && entry.clip !== 'none') ||
          (entry.geometry && entry.geometry.kind !== 'program')
        )
          return this.unsupported('paragraph-paint-configuration');
        if (
          entry.geometry?.kind === 'program' &&
          (entry.geometry.radii ||
            entry.geometry.visible !== undefined ||
            entry.geometry.color !== undefined ||
            entry.geometry.repeat !== undefined)
        )
          return this.unsupported('paragraph-paint-program');
        if (++count.value >= p.limits.nodes) return this.unsupported('render-tree-budget');
        const captured = this.textService.capturePaint(entry.paragraph),
          { input, fontBinding, ...expected } = captured,
          { height, ...paragraph } = input.paragraph,
          key =
            paintKeys![plane][paragraphIndex] ??
            (paintKeys![plane][paragraphIndex] = new GlobalKey());
        if (fontBinding && !this.capturingFonts!.has(fontBinding.fontRevision)) {
          const lease = this.textService.retainPaintFont(entry.paragraph);
          if (lease) this.capturingFonts!.set(fontBinding.fontRevision, lease);
        }
        paragraphIndex++;
        children.push(
          new NodeWidget(
            'paragraph',
            [],
            {
              key,
              layout: { paintChild: true },
              pointerHitTest: 'deferToChild',
              horizontal: { kind: 'finite', min: captured.width, max: captured.width },
              paragraph: { ...paragraph, ...(height === null ? {} : { height }) },
              ...(fontBinding ? { paragraphFont: fontBinding } : {}),
              paintPlacement: {
                ...expected,
                ...(entry.reference
                  ? { reference: () => this.keys.get(entry.reference!)?.currentNode ?? null }
                  : {}),
                rect:
                  entry.geometry?.kind === 'program'
                    ? entry.geometry.rect
                    : [entry.x ?? 0, entry.y ?? 0, captured.width, captured.height],
              },
            },
            {
              value: input.text,
              size: input.fontSize,
              color: input.color,
              direction: input.textDirection ? 'rtl' : 'ltr',
            },
          ),
        );
        return { kind: 'paragraph', reference: () => key.currentNode, color: 0, shape: emptyShape };
      });
    };
    if (control?.paint || control?.foreground?.length)
      options = {
        ...options,
        nativePaint: [
          ...sequence(control.paint ?? [], 0),
          ...(control.foreground?.length
            ? [
                { kind: 'children' as const, color: 0, shape: emptyShape },
                ...sequence(control.foreground, 1),
              ]
            : []),
        ],
      };
    if (control?.mergeText && options.semantics) {
      const labels: string[] = [];
      let actions = options.semantics.actions ?? 0,
        flags = options.semantics.flags ?? 0;
      const parentAction = options.onAction,
        parentFocus = options.onFocusChanged,
        delegates = new Map<string, NonNullable<NodeOptions['onAction']>>(),
        focusCallbacks: NonNullable<NodeOptions['onFocusChanged']>[] = [];
      const absorb = (node: NodeWidget): NodeWidget => {
        const semantic = node.options.semantics;
        if (semantic && semantic.role !== 'text' && !node.options.semanticsMergeIntoParent)
          return node;
        if (semantic) {
          flags |= semantic.flags ?? 0;
          for (const [name, bit] of Object.entries(p.semanticsActions))
            if ((semantic.actions ?? 0) & bit) {
              if (!(actions & bit) && node.options.onAction)
                delegates.set(name, node.options.onAction);
              actions |= bit;
            }
          if (node.options.onFocusChanged) focusCallbacks.push(node.options.onFocusChanged);
        }
        if (node.options.semantics?.label) labels.push(node.options.semantics.label);
        const { semantics: _, ...remaining } = node.options;
        return new NodeWidget(
          node.kind,
          node.children.map((child) => absorb(child as NodeWidget)),
          remaining,
          node.text,
          node.image,
        );
      };
      children = children.map(absorb);
      options = {
        ...options,
        semantics: {
          ...options.semantics,
          actions,
          flags,
          label: [options.semantics.label, ...labels].filter(Boolean).join('\n'),
        },
        onAction: (action, event) => {
          const delegate = delegates.get(action);
          if (delegate) delegate(action, event);
          else parentAction?.(action, event);
        },
        onFocusChanged: (value) => {
          parentFocus?.(value);
          for (const callback of focusCallbacks) callback(value);
        },
      };
    }
    if (semanticsSuppressed) {
      const { semantics: _, ...remaining } = options;
      options = remaining;
    }
    return new NodeWidget(
      kind,
      children,
      {
        ...options,
        pointerHitTest:
          options.pointerHitTest ??
          (prototype === RenderColoredBox.prototype || paragraph ? 'self' : 'proxy'),
        key,
      },
      text,
      image,
      editable?.editor,
      editable?.flags,
      editable?.maximumLength,
    );
  }
  flush(): Promise<void> {
    this.ensure();
    if (this.running) {
      this.rerun = true;
      return this.running;
    }
    // Publish the owner promise before canonical App callbacks may reenter update.
    this.running = Promise.resolve()
      .then(() => this.perform())
      .finally(() => {
        this.running = undefined;
      });
    return this.running;
  }
  private async perform(): Promise<void> {
    do {
      this.rerun = false;
      if (!this.desired || this.closed) return;
      const state = await this.view.request(p.opcodes.inspect);
      if (this.closed) return;
      let scene: Stack;
      const capturedFonts = new Map<bigint, AppParagraphFontLease>();
      const capturedImages = new Set<string>(),
        previousImageObservers = new Set(this.imageOpacity.keys());
      this.capturingFonts = capturedFonts;
      this.capturingImages = capturedImages;
      this.capturingImageRenders = new Set();
      this.building = true;
      this.bridgeFailure = undefined;
      try {
        this.geometry.observeState(state);
        this.layers.observeState(state);
        this.observeMetrics(state);
        scene = withNativeRenderConfiguration(
          () => {
            const configuration = new AppRoot(this.desired!);
            if (this.root) this.root.update(configuration);
            else {
              this.root = configuration.createElement();
              this.root.mount(undefined, this.owner);
            }
            this.owner.flushBuild();
            this.root.syncRenderTree();
            // Canonical builders may catch their own exceptions and build an
            // ErrorWidget. An unported bridge operation still rejects admission.
            if (this.bridgeFailure) throw this.bridgeFailure;
            this.layers.prepare(this.root.renderObjects);
            const count = { value: 0 };
            return new Stack(
              this.root.renderObjects.map((render) => this.node(render, count)),
              {
                canonicalKeyboard: true,
                onKey: this.focusing.key,
              },
            );
          },
          (operation) => this.unsupported('synchronous-render-' + operation),
        );
      } catch (error) {
        this.capturingImageRenders = undefined;
        const errors: unknown[] = [error];
        for (const cleanup of [
          () => this.layers.reject(),
          () => this.releaseFontScenes(capturedFonts),
          () => this.pruneImageScenes(),
          () => this.pruneImageOpacity(previousImageObservers),
        ])
          try {
            cleanup();
          } catch (failure) {
            errors.push(failure);
          }
        if (errors.length === 1) throw error;
        throw new AggregateError(errors, 'Original image/font capture failed');
      } finally {
        this.building = false;
        this.capturingFonts = undefined;
        this.capturingImages = undefined;
      }
      this.pruneImageOpacity(this.capturingImageRenders!);
      this.capturingImageRenders = undefined;
      const previousFonts = this.sceneFonts,
        pendingFonts = this.pendingSceneFonts,
        builds = this.native.counters.builds;
      this.sceneFonts = capturedFonts;
      this.desiredImages = capturedImages;
      const errors: unknown[] = [];
      try {
        if (this.nativeMounted) await this.native.update(scene);
        else {
          this.nativeMounted = true;
          await this.native.mount(scene);
        }
        this.layers.accept(this.view.documentEpoch);
        await this.editing.finishBuild();
      } catch (error) {
        errors.push(error);
        try {
          this.layers.reject();
        } catch (failure) {
          errors.push(failure);
        }
      } finally {
        // Native may first resolve an older ambiguous document, or may already
        // be sending the previous root from an event-driven flush. Keep those
        // producers until that work reaches a known ACK/NACK. Only two scenes
        // survive between flushes: latest desired and (if different) pending.
        const pending = this.view.hasPendingTransaction || this.native.hasPendingImageResources;
        this.pendingSceneFonts = pending
          ? this.native.counters.builds > builds
            ? capturedFonts
            : (pendingFonts ?? previousFonts)
          : undefined;
        try {
          this.releaseFontScenes(
            ...[previousFonts, pendingFonts].filter(
              (fonts): fonts is Map<bigint, AppParagraphFontLease> =>
                !!fonts && fonts !== this.sceneFonts && fonts !== this.pendingSceneFonts,
            ),
          );
        } catch (error) {
          errors.push(error);
        }
        try {
          this.pruneImageScenes();
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length === 1) throw errors[0];
      if (errors.length)
        throw new AggregateError(errors, 'Original scene admission/retirement failed');
      // App desired values remain immediate on NACK. Inactive Elements are
      // finalized only after a known native ACK (or terminal close), never early.
      this.owner.finalizeTree();
      // Source addPostFrameCallback does not itself schedule a frame. Wake Core
      // only for pending lifecycle work; an ordinary ACK needs no extra frame.
      this.scrolling.finishBuild();
    } while (this.rerun && !this.closed);
  }
  private releaseFontScenes(...scenes: Map<bigint, AppParagraphFontLease>[]): void {
    const errors: unknown[] = [];
    for (const scene of new Set(scenes))
      for (const [revision, lease] of scene) {
        scene.delete(revision);
        try {
          lease.release();
        } catch (error) {
          errors.push(error);
        }
      }
    if (errors.length) throw new AggregateError(errors, 'Captured font retirement failed');
  }
  private observeImageOpacity(render: RenderImage): void {
    this.capturingImageRenders!.add(render);
    const value = render.opacity,
      previous = this.imageOpacity.get(render);
    if (previous?.value === value) return;
    if (previous) {
      previous.release();
      this.imageOpacity.delete(render);
    }
    if (!value) return;
    const changed = () => {
      if (!this.closed && this.imageOpacity.get(render)?.value === value) this.schedule();
    };
    try {
      value.addListener(changed);
    } catch (error) {
      try {
        value.removeListener(changed);
      } catch (cleanup) {
        throw new AggregateError([error, cleanup], 'Image opacity observation failed');
      }
      throw error;
    }
    this.imageOpacity.set(render, { value, release: () => value.removeListener(changed) });
  }
  private pruneImageOpacity(keep: ReadonlySet<RenderImage>): void {
    const errors: unknown[] = [];
    for (const [render, value] of this.imageOpacity)
      if (!keep.has(render)) {
        this.imageOpacity.delete(render);
        try {
          value.release();
        } catch (error) {
          errors.push(error);
        }
      }
    if (errors.length) throw new AggregateError(errors, 'Image opacity retirement failed');
  }
  private pruneImageScenes(closing = false): void {
    const errors: unknown[] = [];
    const retained = this.native.retainedImageResources;
    for (const [key, lease] of this.imageLeases)
      if ((closing || !this.desiredImages.has(key)) && !retained.has(lease.resource)) {
        this.imageLeases.delete(key);
        try {
          lease.release();
        } catch (error) {
          errors.push(error);
        }
      }
    if (closing && this.imageLeases.size)
      errors.push(Error('Captured images still have native App references'));
    if (errors.length) throw new AggregateError(errors, 'Captured image retirement failed');
  }
  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.closed = true;
    this.fontOwner?.cancel();
    this.focusing.close();
    this.geometry.close();
    this.closing = drainEngineOwners('OriginalWidgetHost close failed', [
      () => this.running,
      () => this.native.stop(),
      () => this.fontOwner?.stop(),
      () => this.layers.close(),
      () => this.root?.unmount(),
      () => this.editing.close(),
      () => this.pruneImageOpacity(new Set()),
      () => this.appGestures.dispose(),
      () => this.gestureBindingLease.dispose(),
      () => this.owner.dispose(),
      () => this.imageClockLease?.dispose(),
      () => this.imageClock?.close(),
      () => this.fontNotifications.dispose(),
      () => this.scrolling.close(),
      () => {
        if (this.options.appImages) {
          if (this.defaultFont) this.resources?.releaseProducer(this.defaultFont);
        } else this.resources?.dispose();
      },
      () => {
        if (
          (this.view.hasPendingTransaction || this.native.hasPendingImageResources) &&
          (this.sceneFonts.size || this.pendingSceneFonts?.size)
        )
          throw Error('Captured font ownership awaits the pending document terminal');
        this.releaseFontScenes(
          this.sceneFonts,
          ...(this.pendingSceneFonts ? [this.pendingSceneFonts] : []),
        );
        this.pendingSceneFonts = undefined;
      },
      () => this.fontOwner?.close(),
      () => this.textService?.close(),
      () => this.native.close(),
      () => {
        this.pruneImageScenes(true);
      },
      () => {
        this.root = undefined;
        this.desired = undefined;
      },
    ]);
    return this.closing;
  }
}
