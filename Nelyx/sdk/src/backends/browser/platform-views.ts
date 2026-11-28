// SPDX-License-Identifier: BSD-3-Clause
import {
  PlatformViewRegistry,
  maxPlatformViewForegrounds,
} from '@nelyx/core/hosting/platform-views';
import type {
  PlatformViewCreation,
  PlatformViewDrawRange,
  PlatformViewHitRegion,
  PlatformViewPlacement,
  PlatformViewScene,
} from '@nelyx/core/hosting/platform-views';
import type { FrameBuildToken, PaintFrame, Rect, ViewOwner } from '@nelyx/core/ui/types';
import { NativePlatformViews } from './native-platform-views.ts';
import type {
  OpenNativePlatformViews,
  NativePlatformViewType,
  NativeViewFrame,
} from './native-platform-views.ts';

export interface DomPlatformView {
  readonly element: HTMLElement;
  /** Entry point for sequential keyboard navigation. Defaults to element. */
  readonly focusTarget?: HTMLElement;
  update?(value: unknown): void;
  dispose?(): void;
}

export interface DomPlatformViewFactory {
  unsupportedReason?(): string | undefined;
  create(
    request: Omit<PlatformViewCreation, 'signal'> & {
      readonly document: Document;
      readonly signal: AbortSignal;
    },
  ): DomPlatformView | Promise<DomPlatformView>;
}

export type DomPlatformViewFactories = Readonly<Record<string, DomPlatformViewFactory>>;

export interface DomDrawingLayer {
  readonly canvas: HTMLCanvasElement;
  readonly range: PlatformViewDrawRange;
}

export interface DomViewFrame {
  readonly scene: PlatformViewScene;
  readonly background: PlatformViewDrawRange;
  readonly layers: readonly DomDrawingLayer[];
  readonly native?: NativeViewFrame;
}

interface Slot {
  readonly container: HTMLDivElement;
  readonly focusTarget: HTMLElement;
}

interface Foreground {
  readonly canvas: HTMLCanvasElement;
  lastUsed: number;
}

interface SemanticsTarget {
  readonly element: HTMLElement;
  readonly platformViewId?: number;
}

interface TabTarget {
  readonly element: HTMLElement;
  readonly native: boolean;
  readonly nativeId?: number;
}

let nextSurface = 0;

function position(element: HTMLElement, { x, y, width, height }: Rect): void {
  const style = element.style;
  style.left = x + 'px';
  style.top = y + 'px';
  style.width = width + 'px';
  style.height = height + 'px';
}

export class DomPlatformViews {
  readonly registry: PlatformViewRegistry;
  readonly native?: NativePlatformViews;
  private readonly surfaceId = ++nextSurface;
  private readonly document: Document;
  private readonly slots = new Map<number, Slot>();
  private readonly foregrounds: Foreground[] = [];
  private readonly hitTargets = new WeakSet<EventTarget>();
  private readonly sensors: HTMLDivElement[] = [];
  private semantics: readonly SemanticsTarget[] = [];
  private shown = new Set<number>();
  private sequence = 0;
  private failure: string | undefined;
  private closed = false;
  private lastInput: readonly PlatformViewHitRegion[] = [];
  private configureCanvas: ((canvas: HTMLCanvasElement) => void) | undefined;
  private releaseCanvas: ((canvas: HTMLCanvasElement) => void) | undefined;
  private onLost: ((event: Event) => void) | undefined;
  private onRestored: ((event: Event) => void) | undefined;
  private cancelPointerStreams: (() => void) | undefined;

  constructor(
    private readonly viewport: HTMLElement,
    owner: ViewOwner,
    factories: DomPlatformViewFactories,
    reportError: ((error: unknown) => void) | undefined,
    nativeTypes?: readonly NativePlatformViewType[],
    openNative?: OpenNativePlatformViews,
  ) {
    this.document = viewport.ownerDocument;
    this.registry = new PlatformViewRegistry(owner, reportError);
    if (nativeTypes?.length)
      this.native = new NativePlatformViews(
        viewport,
        this.registry,
        openNative,
        nativeTypes,
        (instanceId, backwards) => this.tabFromNative(instanceId, backwards),
      );
    for (const [viewType, factory] of Object.entries(factories)) {
      this.registry.register(viewType, {
        unsupportedReason: () => this.failure ?? factory.unsupportedReason?.(),
        create: async (request) => {
          const controller = new AbortController();
          const abort = request.signal.onAbort(() => controller.abort());
          let instance: DomPlatformView;
          try {
            instance = await factory.create({
              ...request,
              signal: controller.signal,
              document: this.document,
            });
          } catch (error) {
            abort.dispose();
            throw error;
          }
          if (request.signal.aborted) return { dispose: () => instance.dispose?.() };
          const { element, focusTarget = element } = instance;
          if (
            element.ownerDocument !== this.document ||
            element.isConnected ||
            (focusTarget !== element && !element.contains(focusTarget))
          ) {
            abort.dispose();
            instance.dispose?.();
            throw new Error(
              'A platform view factory must provide a detached control in this document',
            );
          }
          const container = this.document.createElement('div');
          container.dataset.nelyxPlatformView = viewType;
          container.id = 'nelyx-platform-view-' + this.surfaceId + '-' + request.instanceId;
          container.style.cssText =
            'position:absolute;visibility:hidden;pointer-events:auto;user-select:text;overflow:hidden';
          container.inert = true;
          container.setAttribute('aria-hidden', 'true');
          element.style.width ||= '100%';
          element.style.height ||= '100%';
          element.style.boxSizing ||= 'border-box';
          container.appendChild(element);
          this.slots.set(request.instanceId, { container, focusTarget });
          this.viewport.appendChild(container);
          return {
            update: (value) => instance.update?.(value),
            dispose: () => {
              abort.dispose();
              this.slots.delete(request.instanceId);
              if (this.shown.delete(request.instanceId)) this.cancelPointerStreams?.();
              container.remove();
              instance.dispose?.();
            },
          };
        },
      });
    }
  }

  bindGraphics(
    configure: (canvas: HTMLCanvasElement) => void,
    release: (canvas: HTMLCanvasElement) => void,
    lost: (event: Event) => void,
    restored: (event: Event) => void,
  ): void {
    this.configureCanvas = configure;
    this.releaseCanvas = release;
    this.onLost = lost;
    this.onRestored = restored;
  }

  refitCanvases(): void {
    for (const { canvas } of this.foregrounds) this.configureCanvas?.(canvas);
  }

  bindInputCancellation(cancel: (() => void) | undefined): void {
    this.cancelPointerStreams = cancel;
  }

  inputMatchesPresentation = (): boolean => this.registry.matchesInput(this.lastInput);

  prepare(frame: PaintFrame): DomViewFrame | undefined {
    const scene = frame.platformViews;
    if (this.closed || !scene || this.failure) return;
    const draws = scene.parts.flatMap((part) => ('draw' in part ? [part.draw] : []));
    const native = this.native?.prepare(frame);
    if (native)
      return {
        scene: { parts: [], input: [] },
        background: { start: 0, end: frame.commands.length, prefix: [], restoreCount: 0 },
        layers: [],
        native,
      };
    if (!draws.length || draws.length > maxPlatformViewForegrounds + 1) {
      this.fail(frame, 'The platform view scene exceeds the available drawing surfaces');
      return;
    }
    const [background, ...foregrounds] = draws;
    const layers = foregrounds.map((range, index) => {
      let foreground = this.foregrounds[index];
      if (!foreground) {
        const canvas = this.document.createElement('canvas');
        canvas.dataset.nelyxPlatformForeground = '';
        canvas.style.cssText = 'display:block;visibility:hidden;pointer-events:none';
        canvas.setAttribute('aria-hidden', 'true');
        this.configureCanvas?.(canvas);
        canvas.addEventListener('webglcontextlost', this.onLost!);
        canvas.addEventListener('webglcontextrestored', this.onRestored!);
        this.viewport.appendChild(canvas);
        foreground = { canvas, lastUsed: 0 };
        this.foregrounds[index] = foreground;
      }
      foreground.lastUsed = frame.token.sequence;
      return { canvas: foreground.canvas, range };
    });
    return { scene, background: background!, layers };
  }

  commit(token: FrameBuildToken, prepared: DomViewFrame | undefined): void {
    if (this.closed || token.sequence <= this.sequence) return;
    this.sequence = token.sequence;
    this.native?.commit(token, prepared?.native);
    if (!prepared && !this.shown.size && !this.foregrounds.length) return;
    const shown = new Set<number>();
    const input = prepared?.scene.input ?? [];
    let drawing = 0;
    let zIndex = 0;
    let lostPointerTarget = false;
    for (const part of prepared?.scene.parts ?? []) {
      if ('draw' in part) {
        const layer = drawing++ === 0 ? undefined : prepared!.layers[drawing - 2];
        if (layer) {
          layer.canvas.style.zIndex = String(++zIndex);
          layer.canvas.style.visibility = 'visible';
        }
      } else if ('view' in part) {
        const { view } = part;
        if (this.native?.owns(view.instanceId)) continue;
        this.registry.placementSupport(view.instanceId, view.unsupportedReason);
        const slot = this.slots.get(view.instanceId);
        if (slot && view.visible) {
          ++zIndex;
          shown.add(view.instanceId);
          const interactive = this.shown.has(view.instanceId) && !slot.container.inert;
          this.show(slot, view, zIndex, input);
          lostPointerTarget ||= interactive && slot.container.inert;
        }
      }
    }
    for (const id of this.shown)
      if (!shown.has(id)) {
        this.hide(this.slots.get(id));
        lostPointerTarget = true;
      }
    this.shown = shown;
    this.applyInput(input, zIndex + 1);
    if (lostPointerTarget) this.cancelPointerStreams?.();
    this.syncSemantics(this.semantics);
    for (let index = prepared?.layers.length ?? 0; index < this.foregrounds.length; index++)
      this.foregrounds[index]!.canvas.style.visibility = 'hidden';
    const count = prepared?.layers.length ?? 0;
    while (this.foregrounds.length > count && this.foregrounds.at(-1)!.lastUsed <= token.sequence)
      this.removeCanvas(this.foregrounds.pop()!.canvas);
  }

  fail(frame: PaintFrame, reason: string): void {
    this.failure = reason;
    this.invalidate(false);
    for (const part of frame.platformViews?.parts ?? [])
      if ('view' in part && !this.native?.owns(part.view.instanceId))
        this.registry.placementSupport(part.view.instanceId, reason);
  }

  invalidate(replaceCanvases: boolean): void {
    if (this.closed) return;
    this.native?.invalidate(replaceCanvases);
    for (const id of this.shown) this.hide(this.slots.get(id));
    this.shown.clear();
    this.applyInput([], 0);
    this.cancelPointerStreams?.();
    this.syncSemantics(this.semantics);
    if (replaceCanvases) {
      this.failure = undefined;
      for (const foreground of this.foregrounds.splice(0)) this.removeCanvas(foreground.canvas);
    } else for (const { canvas } of this.foregrounds) canvas.style.visibility = 'hidden';
  }

  private show(
    slot: Slot,
    view: PlatformViewPlacement,
    zIndex: number,
    input: readonly PlatformViewHitRegion[],
  ): void {
    const { container } = slot;
    const { bounds, clip, instanceId } = view;
    position(container, bounds);
    const left = clip.x - bounds.x;
    const top = clip.y - bounds.y;
    container.style.clipPath =
      'inset(' +
      [top, bounds.width - left - clip.width, bounds.height - top - clip.height, left]
        .map((value) => Math.max(0, value) + 'px')
        .join(' ') +
      ')';
    container.style.visibility = 'visible';
    container.style.zIndex = String(zIndex);
    const covered = input
      .filter((region) => region.instanceId === instanceId)
      .reduce((area, region) => area + region.rect.width * region.rect.height, 0);
    const inert = covered + 1e-7 >= clip.width * clip.height;
    container.inert = inert;
    if (inert) container.setAttribute('aria-hidden', 'true');
    else container.removeAttribute('aria-hidden');
  }

  private hide(slot: Slot | undefined): void {
    if (!slot) return;
    slot.container.style.visibility = 'hidden';
    slot.container.inert = true;
    slot.container.setAttribute('aria-hidden', 'true');
  }

  private applyInput(input: readonly PlatformViewHitRegion[], zIndex: number): void {
    if (input === this.lastInput) return;
    this.lastInput = input;
    for (let index = 0; index < input.length; index++) {
      let sensor = this.sensors[index];
      if (!sensor) {
        sensor = this.document.createElement('div');
        sensor.dataset.nelyxPlatformInput = '';
        sensor.style.cssText = 'position:absolute;pointer-events:auto;touch-action:none';
        sensor.setAttribute('aria-hidden', 'true');
        this.hitTargets.add(sensor);
        this.sensors.push(sensor);
        this.viewport.appendChild(sensor);
      }
      position(sensor, input[index]!.rect);
      sensor.style.zIndex = String(zIndex);
    }
    while (this.sensors.length > input.length) this.sensors.pop()!.remove();
  }

  private removeCanvas(canvas: HTMLCanvasElement): void {
    if (this.onLost) canvas.removeEventListener('webglcontextlost', this.onLost);
    if (this.onRestored) canvas.removeEventListener('webglcontextrestored', this.onRestored);
    canvas.remove();
    this.releaseCanvas?.(canvas);
  }

  ownsHitTarget = (target: EventTarget | null): boolean => !!target && this.hitTargets.has(target);

  ownsNativeTarget = (target: EventTarget | null): boolean => {
    if (!target || !(target instanceof this.document.defaultView!.Node)) return false;
    for (const id of this.shown) if (this.slots.get(id)?.container.contains(target)) return true;
    return false;
  };

  syncSemantics(targets: readonly SemanticsTarget[]): void {
    this.semantics = targets;
    for (const { element, platformViewId } of targets) {
      if (platformViewId === undefined) continue;
      const slot = this.slots.get(platformViewId);
      if (slot && this.shown.has(platformViewId) && !slot.container.inert) {
        if (element.getAttribute('aria-owns') !== slot.container.id)
          element.setAttribute('aria-owns', slot.container.id);
        element.removeAttribute('aria-hidden');
      } else {
        // An OS-native view publishes its own accessibility node.
        element.removeAttribute('aria-owns');
        if (element.getAttribute('aria-hidden') !== 'true')
          element.setAttribute('aria-hidden', 'true');
      }
    }
  }

  handleTab = (event: KeyboardEvent): boolean => {
    // WebKitGTK can report Shift+Tab as Unidentified with the physical Tab code.
    const tab = event.key === 'Tab' || (event.key === 'Unidentified' && event.code === 'Tab');
    if (
      event.type !== 'keydown' ||
      !tab ||
      event.altKey ||
      event.metaKey ||
      event.ctrlKey ||
      event.isComposing
    )
      return false;
    const targets = this.tabTargets();
    if (!targets.some(({ native }) => native)) return false;
    const focused = this.document.activeElement;
    const exact = targets.findIndex(({ element }) => element === focused);
    const current =
      exact >= 0
        ? exact
        : targets.findIndex(({ element, native }) => native && element.contains(focused));
    const next = targets[current + (event.shiftKey ? -1 : 1)];
    if (!next || (!next.native && !targets[current]?.native)) return false;
    if (next.nativeId !== undefined) {
      void this.native?.focus(next.nativeId);
      return true;
    }
    next.element.focus({ preventScroll: true });
    return this.document.activeElement === next.element;
  };

  private tabTargets(): TabTarget[] {
    return this.semantics.flatMap<TabTarget>(({ element, platformViewId }) => {
      if (platformViewId === undefined)
        return element.tabIndex >= 0 &&
          !element.matches(':disabled') &&
          element.style.display !== 'none'
          ? [{ element, native: false }]
          : [];
      if (this.native?.isPresented(platformViewId))
        return [{ element, native: true, nativeId: platformViewId }];
      const slot = this.slots.get(platformViewId);
      return slot && this.shown.has(platformViewId) && !slot.container.inert
        ? [{ element: slot.focusTarget, native: true }]
        : [];
    });
  }

  private tabFromNative(instanceId: number, backwards: boolean): void {
    const targets = this.tabTargets();
    const current = targets.findIndex((target) => target.nativeId === instanceId);
    if (current < 0) return;
    const next = targets[current + (backwards ? -1 : 1)] ?? targets.at(backwards ? -1 : 0);
    if (!next || next.nativeId === instanceId) return;
    void this.native?.focus(next.nativeId).then((focused) => {
      if (focused && !this.closed && next.nativeId === undefined && next.element.isConnected)
        next.element.focus({ preventScroll: true });
    });
  }

  dispose(): void {
    if (this.closed) return;
    this.invalidate(true);
    this.closed = true;
    this.registry.dispose();
    this.semantics = [];
  }
}
