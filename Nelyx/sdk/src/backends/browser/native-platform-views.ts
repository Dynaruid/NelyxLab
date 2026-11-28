// SPDX-License-Identifier: BSD-3-Clause
import type {
  PlatformViewHitRegion,
  PlatformViewPlacement,
  PlatformViewRegistry,
} from '@nelyx/core/hosting/platform-views';
import type { ViewRuntime } from '@nelyx/core/hosting/runtime';
import { encodePlatformViewForeground } from '@nelyx/core/ui/platform-view-scene';
import type {
  FrameBuildToken,
  PaintCommand,
  PaintFrame,
  ResourceId,
  ViewOwner,
} from '@nelyx/core/ui/types';
import type { TauriWindowConfig } from '../../runtime/config.ts';

export type WindowsPlatformViewType = NonNullable<
  TauriWindowConfig['windowsPlatformViews']
>[number];
export type NativePlatformViewType =
  | WindowsPlatformViewType
  | 'nelyx.android.edit'
  | 'nelyx.gtk.edit'
  | 'nelyx.apple.edit';

export interface NativeViewPointer {
  readonly kind: 'down' | 'move' | 'up' | 'cancel' | 'hover';
  readonly sequence: number;
  readonly viewportGeneration: number;
  readonly x: number;
  readonly y: number;
  readonly device?: 'touch' | 'mouse';
}

export type NativeViewEvent =
  | NativeViewPointer
  | { readonly kind: 'input'; readonly instanceId: number; readonly value: string }
  | { readonly kind: 'click'; readonly instanceId: number }
  | { readonly kind: 'tab'; readonly instanceId: number; readonly backwards: boolean }
  | { readonly kind: 'keyboard'; readonly instanceId: number; readonly bottom: number };

export interface NativePlatformViewSession {
  create(instanceId: number, viewType: NativePlatformViewType, text: string): Promise<void>;
  update(instanceId: number, text: string): Promise<void>;
  remove(instanceId: number): Promise<void>;
  focus(instanceId?: number): Promise<void>;
  hide(through: number): Promise<void>;
  present(packet: Uint8Array<ArrayBuffer>): Promise<void>;
  close(): Promise<void>;
}

export type OpenNativePlatformViews = (
  owner: ViewOwner,
  onEvent: (event: NativeViewEvent) => void,
) => Promise<NativePlatformViewSession>;

export interface NativeViewFrame {
  readonly token: FrameBuildToken;
  readonly placements: readonly PlatformViewPlacement[];
  readonly input: readonly PlatformViewHitRegion[];
  readonly packet?: Uint8Array<ArrayBuffer>;
}

const nativePointer = -1;

export class NativePlatformViews {
  private readonly instances = new Map<number, (event: unknown) => void>();
  private readonly placementFailures = new Map<number, string>();
  private session: Promise<NativePlatformViewSession> | undefined;
  private queued: NativeViewFrame | undefined;
  private submitted: NativeViewFrame | undefined;
  private drain: Promise<void> | undefined;
  private closed = false;
  private enabledThrough = 0;
  private hiddenThrough = 0;
  private pointer: NativeViewPointer | undefined;
  private view: ViewRuntime | undefined;
  private picture: (id: ResourceId) => readonly PaintCommand[] | undefined = () => undefined;

  constructor(
    private readonly viewport: HTMLElement,
    private readonly registry: PlatformViewRegistry,
    private readonly open: OpenNativePlatformViews | undefined,
    types: readonly NativePlatformViewType[],
    private readonly tabFromControl: (instanceId: number, backwards: boolean) => void,
  ) {
    for (const type of types) {
      registry.register(type, {
        unsupportedReason: () =>
          this.open ? undefined : 'This native control requires a configured Tauri window',
        create: async (request) => {
          const session = await (this.session ??= this.open!(registry.owner, this.onEvent));
          const id = request.instanceId;
          if (this.closed || request.signal.aborted) return { dispose() {} };
          await session.create(
            id,
            type,
            typeof request.creationParams === 'string' ? request.creationParams : '',
          );
          this.instances.set(id, request.emit);
          return {
            update: (value) => {
              if (typeof value === 'string') void session.update(id, value).catch(() => {});
            },
            dispose: () => {
              this.instances.delete(id);
              this.placementFailures.delete(id);
              if (!this.closed) void session.remove(id).catch(() => {});
            },
          };
        },
      });
    }
  }

  attach(view: ViewRuntime | undefined): void {
    this.cancelPointer();
    this.view = view;
  }

  bindPictures(picture: (id: ResourceId) => readonly PaintCommand[] | undefined): void {
    this.picture = picture;
  }

  owns(instanceId: number): boolean {
    return this.instances.has(instanceId);
  }

  isPresented(instanceId: number): boolean {
    return this.submitted?.placements.some((slot) => slot.instanceId === instanceId) === true;
  }

  async focus(instanceId?: number): Promise<boolean> {
    if (this.closed || !this.session || (instanceId !== undefined && !this.isPresented(instanceId)))
      return false;
    try {
      await (await this.session).focus(instanceId);
      return true;
    } catch {
      return false;
    }
  }

  prepare(frame: PaintFrame): NativeViewFrame | undefined {
    const scene = frame.platformViews;
    if (!scene) return;
    const placements = scene.parts.flatMap((part) => ('view' in part ? [part.view] : []));
    const native = placements.filter((view) => this.instances.has(view.instanceId));
    if (!native.length) return;
    const blank = { token: frame.token, input: [], placements: [] };
    const shown = native.filter((view) => view.visible);
    const showDom = placements.some((view) => view.visible && !this.owns(view.instanceId));
    for (const view of native)
      this.registry.placementSupport(
        view.instanceId,
        view.unsupportedReason ?? this.placementFailures.get(view.instanceId),
      );
    if (!shown.length) return showDom ? undefined : blank;
    if (shown.length !== 1 || showDom) {
      this.reject(shown, 'The native foreground accepts one visible control per frame');
      // Allow the ordinary DOM layer planner to continue showing its own views.
      return showDom ? undefined : blank;
    }
    const slot = shown[0]!;
    const afterSlot = scene.parts.slice(
      scene.parts.findIndex((part) => 'view' in part && part.view === slot) + 1,
    );
    if (afterSlot.some((part) => 'barrier' in part)) return blank;
    const draws = afterSlot.flatMap((part) => ('draw' in part ? [part.draw] : []));
    if (draws.length > 1) {
      this.reject(shown, 'The native foreground requires one topmost drawing range');
      return blank;
    }
    try {
      const wire = draws.length
        ? encodePlatformViewForeground(frame, draws[0]!, this.picture, slot.clip)
        : undefined;
      const { owner, sequence, metrics } = frame.token;
      const { x, y } = this.viewport.getBoundingClientRect();
      const input = scene.input.filter((region) => region.instanceId === slot.instanceId);
      const metadata = new TextEncoder().encode(
        JSON.stringify({
          owner,
          sequence,
          viewportGeneration: metrics.viewportGeneration,
          rendererGeneration: metrics.rendererGeneration,
          contextGeneration: metrics.nativeContextGeneration ?? 0,
          surfaceGeneration: metrics.nativeSurfaceGeneration ?? 0,
          origin: [x, y],
          scale: metrics.scale,
          width: metrics.physicalWidth,
          height: metrics.physicalHeight,
          placements: [{ instanceId: slot.instanceId, bounds: slot.bounds, clip: slot.clip }],
          input,
        }),
      );
      const packet = new Uint8Array(8 + metadata.length + (wire?.length ?? 0));
      const header = new DataView(packet.buffer);
      header.setUint32(0, 1, true);
      header.setUint32(4, metadata.length, true);
      packet.set(metadata, 8);
      if (wire) packet.set(wire, 8 + metadata.length);
      return { token: frame.token, placements: shown, input, packet };
    } catch (error) {
      this.reject(shown, String(error));
      return blank;
    }
  }

  commit(token: FrameBuildToken, frame: NativeViewFrame | undefined): void {
    if (this.closed || token.sequence <= this.hiddenThrough || !this.session) return;
    if (!frame?.packet) {
      this.hide(token.sequence);
      return;
    }
    this.enabledThrough = token.sequence;
    this.queued = frame;
    this.drain ??= this.flush(this.session).finally(() => {
      this.drain = undefined;
    });
  }

  invalidate(rendererReplaced: boolean): void {
    if (rendererReplaced) this.placementFailures.clear();
    this.hide(this.enabledThrough);
  }

  async dispose(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.cancelPointer();
    this.view = undefined;
    this.queued = undefined;
    await this.drain;
    const session = await this.session?.catch(() => undefined);
    if (session) await session.close();
  }

  private async flush(session: Promise<NativePlatformViewSession>): Promise<void> {
    const native = await session.catch(() => undefined);
    if (!native) return;
    while (!this.closed && this.queued) {
      const frame = this.queued;
      this.queued = undefined;
      if (
        frame.token.sequence <= this.hiddenThrough ||
        frame.placements.some((slot) => !this.instances.has(slot.instanceId))
      )
        continue;
      try {
        await native.present(frame.packet!);
        if (frame.token.sequence > this.hiddenThrough) this.submitted = frame;
      } catch (error) {
        if (this.closed || frame.token.sequence <= this.hiddenThrough) continue;
        this.hide(frame.token.sequence);
        this.reject(frame.placements, String(error));
      }
    }
  }

  private hide(through: number): void {
    if (this.enabledThrough <= this.hiddenThrough || through <= this.hiddenThrough) return;
    this.hiddenThrough = through;
    this.submitted = undefined;
    if (this.queued && this.queued.token.sequence <= through) this.queued = undefined;
    this.cancelPointer();
    void this.session?.then((session) => session.hide(through)).catch(() => {});
  }

  private reject(placements: readonly PlatformViewPlacement[], reason: string): void {
    for (const { instanceId } of placements) {
      if (!this.instances.has(instanceId)) continue;
      this.placementFailures.set(instanceId, reason);
      this.registry.placementSupport(instanceId, reason);
    }
  }

  private onEvent = (event: NativeViewEvent): void => {
    if (this.closed) return;
    if ('instanceId' in event) {
      if (event.kind === 'tab') {
        if (this.isPresented(event.instanceId))
          this.tabFromControl(event.instanceId, event.backwards);
      } else this.instances.get(event.instanceId)?.(event);
      return;
    }
    const current = this.submitted;
    if (!current || !this.view) return;
    if (event.kind === 'cancel') {
      this.cancelPointer();
      return;
    }
    if (
      event.viewportGeneration !== this.view.currentMetrics.viewportGeneration ||
      event.sequence !== current.token.sequence
    ) {
      if (event.kind === 'up') this.cancelPointer();
      return;
    }
    if (event.kind === 'down') {
      if (!this.registry.matchesInput(current.input)) return;
      this.pointer = event;
    } else if (event.kind !== 'hover' && !this.pointer) return;
    if (event.kind === 'up') this.pointer = undefined;
    else if (event.kind === 'move') this.pointer = event;
    this.dispatch(event);
  };

  private cancelPointer(): void {
    const pointer = this.pointer;
    this.pointer = undefined;
    if (pointer) this.dispatch({ ...pointer, kind: 'cancel' });
  }

  private dispatch(event: NativeViewPointer): void {
    this.view?.dispatchPointer({
      kind: event.kind,
      pointer: nativePointer,
      device: event.device ?? 'mouse',
      buttons: event.kind === 'down' || event.kind === 'move' ? 1 : 0,
      x: event.x,
      y: event.y,
      timestamp: this.viewport.ownerDocument.defaultView!.performance.now(),
      viewportGeneration: this.view.currentMetrics.viewportGeneration,
    });
  }
}
