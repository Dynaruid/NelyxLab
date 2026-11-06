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
  withNativeRenderConfiguration,
} from '@nelyx/core/framework/rendering/object';
import type { RenderObject } from '@nelyx/core/framework/rendering/object';
import { RenderParagraph } from '@nelyx/core/framework/rendering/paragraph';
import { RenderRepaintBoundary } from '@nelyx/core/framework/rendering/repaint-boundary';
import { RenderIndexedSemantics } from '@nelyx/core/framework/rendering/indexed-semantics';
import {
  RenderClipRect,
  RenderClipRRect,
  RenderClipOval,
  RenderClipPath,
} from '@nelyx/core/framework/rendering/clip';
import { TextSpan } from '@nelyx/core/framework/painting/text-span';
import { MouseCursor } from '@nelyx/core/services/mouse-cursor';
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
import type { AxisBound, EngineResponse, ParagraphOptions } from './codec.ts';
import { drainEngineOwners } from './lifecycle.ts';
import { installOriginalScrolling } from './original-scroll.ts';
import { OriginalNativeRender } from './original-native-node.ts';
import { installOriginalGestures } from './original-gesture.ts';
import { originalControlConfiguration } from './original-controls.ts';
import { OriginalFocusBridge } from './original-focus.ts';
import { TextDecoration } from '@nelyx/core/ui/typography';
import { FlutterErrorDetails } from '@nelyx/core/foundation/assertions';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import type { FoundationPlatformEnvironment } from '@nelyx/core/foundation/platform';

export interface OriginalWidgetHostOptions {
  readonly platform?: FoundationPlatformEnvironment;
  readonly onError?: (error: unknown) => void;
  readonly onExecution?: (execution: OriginalWidgetExecution) => void;
  readonly pollEvents?: boolean;
  /** Explicit App services. Missing native services fail when read. */
  readonly services?: ViewControllerContext;
}
export interface OriginalWidgetExecution extends EngineExecutionSnapshot {
  readonly appModel: 'original-elements';
  readonly compatibility: 'partial';
  readonly tsLayoutFallbacks: 0;
  readonly synchronousGeometry: 'unavailable';
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
  private readonly reasons: Record<string, number> = {};
  private readonly scrolling: ReturnType<typeof installOriginalScrolling>;
  private readonly focusing: OriginalFocusBridge;

  constructor(
    readonly view: EngineViewClient,
    private readonly options: OriginalWidgetHostOptions = {},
  ) {
    if (options.platform) FoundationPlatform.configure(options.platform);
    this.native = new WidgetHost(view, {
      ...options,
      onState: (state) => {
        this.observeMetrics(state);
        this.scrolling.visible(state.visible);
        this.focusing.observeState(state);
      },
      onPublication: (state) => this.focusing.observePublication(state),
      onAfterEvents: () => this.focusing.finishPoll(),
      onExecution: () => options.onExecution?.(this.execution),
      onAppFrame: (at) => this.scrolling.frame(at),
    });
    if (!options.services) {
      const resources = (this.resources = new ResourceRegistry()),
        owner = view.owner;
      // A configuration reference to the provider-owned, immutable bundled font
      // cohort. App owns this descriptor, never a typeface or measured paragraph.
      // Content still has to shape it and report actual geometry before activation.
      const font = resources.allocateId(
        `engine-v2-fonts:${owner.session}:${owner.app}:${owner.view}:${owner.generation}`,
      );
      resources.register({ ...font, kind: 'font' }, () => {});
      this.defaultFont = resources.captureResource(font);
    }
    const unavailableText = (operation: string): never =>
      this.unsupported('synchronous-App-text-' + operation);
    const text: TextLayoutService = Object.freeze({
      layout: () => unavailableText('layout'),
      range: () => unavailableText('range'),
      hit: () => unavailableText('hit'),
      fontFamily: (font: ResourceId) => {
        if (!this.ownsDefaultFont(font)) return this.unsupported('foreign-provider-font');
        return 'NelyxDefault';
      },
    });
    const available = {
      platformServices: undefined,
      // ClipPath probes this optional service while creating configuration.
      // Custom path clippers remain rejected before any App query can run.
      paths: undefined,
      images: undefined,
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
    this.owner = new BuildOwner(
      services,
      () => this.schedule(),
      (callback) => this.scrolling.postFrame(callback),
    );
    installOriginalGestures(this.owner, (reason) => this.unsupported(reason));
    this.scrolling = installOriginalScrolling(
      this.owner,
      view,
      (reason) => this.unsupported(reason),
      (error) => options.onError?.(error),
    );
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
  private ensure(): void {
    if (this.closed) throw Error('OriginalWidgetHost is closed');
  }
  private observeMetrics(state: EngineResponse): void {
    if (this.closed || this.options.services) return;
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
  private paragraph(render: RenderParagraph): NonNullable<NodeWidget['text']> {
    const config = render.config,
      span = config.span,
      style = config.style,
      painter = config.painterOptions ?? {},
      paragraph = config.paragraphOptions ?? {};
    if (!this.ownsDefaultFont(config.font)) return this.unsupported('foreign-provider-font');
    if (
      Object.getPrototypeOf(span) !== TextSpan.prototype ||
      !(span instanceof TextSpan) ||
      span.children !== null ||
      span.style !== null ||
      span.recognizer !== null ||
      span.semanticsLabel !== null ||
      span.semanticsIdentifier !== null ||
      span.locale !== null ||
      span.spellOut !== null ||
      span.mouseCursor !== MouseCursor.defer ||
      span.onEnter ||
      span.onExit ||
      config.placeholderCount ||
      render.registrar ||
      render.children.length
    )
      return this.unsupported('rich-or-selectable-paragraph');
    if (
      [
        style.backgroundColor,
        style.fontFamilyFallback,
        style.foreground,
        style.background,
        style.shadows,
        style.fontFeatures,
        style.fontVariations,
      ].some((value) => value !== null) ||
      (style.decoration !== null &&
        (!(style.decoration instanceof TextDecoration) || style.decoration.mask !== 0)) ||
      (style.fontWeight !== null &&
        (style.fontWeight.value < 100 || style.fontWeight.value > 900)) ||
      (style.fontStyle !== null && style.fontStyle !== 'normal') ||
      (style.textBaseline !== null && style.textBaseline !== 'alphabetic') ||
      painter.strutStyle != null ||
      (painter.hyphens !== undefined && !['manual', 'hidden'].includes(painter.hyphens)) ||
      (paragraph.overflow !== undefined &&
        !['clip', 'visible', 'ellipsis'].includes(paragraph.overflow)) ||
      (paragraph.textWidthBasis !== undefined && paragraph.textWidthBasis !== 'parent')
    )
      return this.unsupported('paragraph-style');
    const size = config.scaler.scale(style.fontSize ?? 18);
    if (!(Number.isFinite(size) && size > 0 && size <= 512))
      return this.unsupported('paragraph-font-size');
    return {
      value: span.text ?? '',
      size,
      color: style.color ?? 0xffe8eef8,
      direction: painter.textDirection ?? 'ltr',
    };
  }
  private paragraphOptions(render: RenderParagraph): ParagraphOptions {
    const config = render.config,
      style = config.style,
      painter = config.painterOptions ?? {},
      paragraph = config.paragraphOptions ?? {},
      behavior = painter.textHeightBehavior;
    return {
      hyphens: painter.hyphens ?? 'manual',
      textAlign: painter.textAlign ?? 'start',
      wrap: paragraph.softWrap !== false || paragraph.overflow === 'ellipsis',
      maxLines: painter.maxLines ?? 0,
      ellipsis: painter.ellipsis ?? '',
      locale: String(painter.locale ?? style.locale ?? 'en'),
      ...(style.fontFamily === null || style.fontFamily === 'CupertinoSystemText'
        ? {}
        : { fontFamily: style.fontFamily }),
      ...(style.fontWeight === null || style.fontWeight.value === 400
        ? {}
        : { fontWeight: style.fontWeight.value }),
      ...(style.height === null ? {} : { height: style.height }),
      letterSpacing: style.letterSpacing ?? 0,
      wordSpacing: style.wordSpacing ?? 0,
      halfLeading: (style.leadingDistribution ?? behavior?.leadingDistribution) === 'even',
      applyHeightToFirstAscent: behavior?.applyHeightToFirstAscent ?? true,
      applyHeightToLastDescent: behavior?.applyHeightToLastDescent ?? true,
    };
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
    const control = originalControlConfiguration(render, (reason) => this.unsupported(reason));
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
    if (prototype === OriginalNativeRender.prototype) {
      const source = render as OriginalNativeRender;
      kind = source.kind;
      options = source.options;
    } else if (control) {
      options = { ...options, ...control.options };
      if (render instanceof RenderConstrainedBox)
        options = { ...options, ...bounds(render.additionalConstraints) };
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
    } else if (paragraph) {
      const source = render as RenderParagraph;
      text = this.paragraph(source);
      const semantics = source.semantics;
      if (
        semantics &&
        (semantics.role !== 'text' ||
          semantics.name !== text.value ||
          Object.keys(semantics).some((key) => !['id', 'role', 'name', 'enabled'].includes(key)))
      )
        return this.unsupported('paragraph-semantics');
      kind = 'paragraph';
      options = {
        paragraph: this.paragraphOptions(source),
        layout: {
          paragraphSizing: true,
          clipOverflow: source.paragraphOptions.overflow !== 'visible',
        },
        ...(semantics
          ? {
              semantics: {
                role: 'text',
                label: semantics.name,
                flags: semantics.enabled === false ? p.semanticsFlags.disabled : 0,
              },
            }
          : {}),
      };
    } else return this.unsupported('custom-or-unported-render-object:' + render.constructor.name);
    claimNativeRenderObject(render, this, () => this.schedule());
    let key = this.keys.get(render);
    if (!key) this.keys.set(render, (key = new GlobalKey()));
    if (control?.paint)
      options = {
        ...options,
        nativePaint: control.paint.map(({ reference, ...entry }) => ({
          ...entry,
          ...(reference ? { reference: () => this.keys.get(reference)?.currentNode ?? null } : {}),
        })),
      };
    const data = render.parentData;
    if (data instanceof FlexParentData)
      options = { ...options, layout: { ...options.layout, flex: data.flex, fit: data.fit } };
    let children = render.children.map((child) =>
      this.node(child, count, depth + 1, semanticsSuppressed || !!control?.suppressChildren),
    );
    if (control?.foreground?.length) {
      kind = 'stack';
      children.push(
        new NodeWidget('box', [], {
          layout: false,
          pointerHitTest: 'deferToChild',
          nativePaint: control.foreground.map(({ reference: _, ...entry }) => ({
            ...entry,
            fillParent: true,
          })),
        }),
      );
    }
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
      this.building = true;
      this.bridgeFailure = undefined;
      try {
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
      } finally {
        this.building = false;
      }
      if (this.nativeMounted) await this.native.update(scene);
      else {
        this.nativeMounted = true;
        await this.native.mount(scene);
      }
      // App desired values remain immediate on NACK. Inactive Elements are
      // finalized only after a known native ACK (or terminal close), never early.
      this.owner.finalizeTree();
    } while (this.rerun && !this.closed);
  }
  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.closed = true;
    this.focusing.close();
    this.closing = drainEngineOwners('OriginalWidgetHost close failed', [
      () => this.running,
      () => this.root?.unmount(),
      () => this.owner.dispose(),
      () => this.scrolling.close(),
      () => this.native.close(),
      () => this.resources?.dispose(),
      () => {
        this.root = undefined;
        this.desired = undefined;
      },
    ]);
    return this.closing;
  }
}
