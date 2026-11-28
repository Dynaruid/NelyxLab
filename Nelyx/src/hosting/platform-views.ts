// SPDX-License-Identifier: BSD-3-Clause
import type { Disposable } from '../foundation/disposable.ts';
import { ErrorToConsoleDumper } from '../foundation/flutter-error.ts';
import type { Rect, ViewOwner } from '../ui/types.ts';

export interface PlatformViewIdentity {
  readonly owner: ViewOwner;
  readonly instanceId: number;
}

export interface PlatformViewCreation extends PlatformViewIdentity {
  readonly viewType: string;
  readonly creationParams: unknown;
  readonly signal: PlatformViewCancellation;
  readonly emit: (event: unknown) => void;
}

export interface PlatformViewCancellation {
  readonly aborted: boolean;
  onAbort(callback: () => void): Disposable;
}

export interface PlatformViewInstance extends Disposable {
  update?(value: unknown): void;
}

export interface PlatformViewFactory {
  /** Return a reason when this type cannot be created in the current host. */
  unsupportedReason?(): string | undefined;
  create(request: PlatformViewCreation): PlatformViewInstance | Promise<PlatformViewInstance>;
}

export interface PlatformViewController {
  readonly identity: PlatformViewIdentity;
  update(value: unknown): void;
}

export type PlatformViewStatus =
  | { readonly kind: 'pending' }
  | { readonly kind: 'ready'; readonly controller: PlatformViewController }
  | { readonly kind: 'unavailable'; readonly reason: string };

/** One registry belongs to one View generation. The platform adapter owns the
 * underlying controls and gets their geometry from submitted frames. */
export class PlatformViewRegistry implements Disposable {
  private readonly factories = new Map<string, PlatformViewFactory>();
  private readonly entries = new Map<number, PlatformViewReservation>();
  private nextId = 0;
  private closed = false;
  private preparedInput: readonly PlatformViewHitRegion[] = [];
  readonly owner: ViewOwner;

  constructor(
    owner: ViewOwner,
    private readonly reportError: (error: unknown) => void = (error) =>
      ErrorToConsoleDumper.dump(String(error)),
  ) {
    this.owner = Object.freeze({ ...owner });
  }

  register(viewType: string, factory: PlatformViewFactory): Disposable {
    if (this.closed || !viewType || this.factories.has(viewType))
      throw new Error('Invalid or duplicate platform view type: ' + viewType);
    this.factories.set(viewType, factory);
    return {
      dispose: () => {
        if (this.factories.get(viewType) === factory) this.factories.delete(viewType);
      },
    };
  }

  unsupportedReason(viewType: string): string | undefined {
    if (this.closed) return 'The platform view owner is closed';
    const factory = this.factories.get(viewType);
    return factory
      ? factory.unsupportedReason?.()
      : 'No platform view factory is registered for ' + viewType;
  }

  reserve(
    viewType: string,
    creationParams: unknown,
    changed: (status: PlatformViewStatus) => void,
    emit: (event: unknown) => void,
  ): PlatformViewReservation {
    if (this.closed) throw new Error('The platform view owner is closed');
    const instanceId = ++this.nextId;
    const reservation = new PlatformViewReservation(
      Object.freeze({ owner: this.owner, instanceId }),
      viewType,
      creationParams,
      this.factories.get(viewType),
      this.unsupportedReason(viewType),
      changed,
      emit,
      () => this.entries.delete(instanceId),
      this.reportError,
    );
    this.entries.set(instanceId, reservation);
    return reservation;
  }

  /** Only the host that applied a frame reports support for that placement. */
  placementSupport(instanceId: number, reason?: string): void {
    this.entries.get(instanceId)?.placementSupport(reason);
  }

  recordInput(input: readonly PlatformViewHitRegion[]): void {
    this.preparedInput = input;
  }

  matchesInput(presented: readonly PlatformViewHitRegion[]): boolean {
    const current = this.preparedInput;
    return (
      presented === current ||
      (current.length === presented.length &&
        current.every(({ instanceId, rect }, index) => {
          const previous = presented[index]!;
          return (
            instanceId === previous.instanceId &&
            rect.x === previous.rect.x &&
            rect.y === previous.rect.y &&
            rect.width === previous.rect.width &&
            rect.height === previous.rect.height
          );
        }))
    );
  }

  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    this.preparedInput = [];
    for (const reservation of this.entries.values()) reservation.dispose();
    this.factories.clear();
  }
}

export class PlatformViewReservation implements Disposable {
  private aborted = false;
  private readonly abortListeners = new Set<() => void>();
  private started = false;
  private instance: PlatformViewInstance | undefined;
  private creationReason: string | undefined;
  private placementReason: string | undefined;
  private published: PlatformViewStatus;
  readonly controller: PlatformViewController;

  constructor(
    readonly identity: PlatformViewIdentity,
    readonly viewType: string,
    private creationParams: unknown,
    private readonly factory: PlatformViewFactory | undefined,
    reason: string | undefined,
    private readonly changed: (status: PlatformViewStatus) => void,
    private readonly emit: (event: unknown) => void,
    private readonly forget: () => void,
    private readonly reportError: (error: unknown) => void,
  ) {
    this.creationReason = reason;
    this.published = reason ? { kind: 'unavailable', reason } : { kind: 'pending' };
    this.controller = Object.freeze({
      identity,
      update: (value: unknown) => {
        if (!this.aborted) this.instance?.update?.(value);
      },
    });
  }

  get status(): PlatformViewStatus {
    return this.published;
  }
  get created(): boolean {
    return this.instance !== undefined;
  }

  start(): void {
    if (this.started || this.aborted || !this.factory || this.creationReason) return;
    this.started = true;
    const creationParams = this.creationParams;
    this.creationParams = undefined;
    const reservation = this;
    const signal: PlatformViewCancellation = {
      get aborted() {
        return reservation.aborted;
      },
      onAbort(callback) {
        if (reservation.aborted) reservation.notify(callback);
        else reservation.abortListeners.add(callback);
        return {
          dispose: () => {
            reservation.abortListeners.delete(callback);
          },
        };
      },
    };
    // The first finite layout schedules creation without running application or
    // DOM callbacks in the render pipeline.
    void Promise.resolve()
      .then(() => {
        if (signal.aborted) return;
        return this.factory!.create({
          ...this.identity,
          viewType: this.viewType,
          creationParams,
          signal,
          emit: (event) => {
            if (!signal.aborted) this.notify(() => this.emit(event));
          },
        });
      })
      .then(
        (instance) => {
          if (!instance) return;
          if (signal.aborted) this.notify(() => instance.dispose());
          else {
            this.instance = instance;
            this.publish();
          }
        },
        (error: unknown) => {
          if (signal.aborted) return;
          this.creationReason = error instanceof Error ? error.message : String(error);
          this.publish();
        },
      );
  }

  placementSupport(reason?: string): void {
    this.placementReason = reason;
    this.publish();
  }

  private publish(): void {
    if (this.aborted) return;
    const reason = this.creationReason ?? this.placementReason;
    const next: PlatformViewStatus = reason
      ? { kind: 'unavailable', reason }
      : this.instance
        ? { kind: 'ready', controller: this.controller }
        : { kind: 'pending' };
    const previous = this.published;
    if (
      next.kind === previous.kind &&
      (next.kind !== 'unavailable' ||
        (previous.kind === 'unavailable' && next.reason === previous.reason))
    )
      return;
    this.published = next;
    this.notify(() => this.changed(next));
  }

  private notify(callback: () => void): void {
    try {
      callback();
    } catch (error) {
      this.reportError(error);
    }
  }

  dispose(): void {
    if (this.aborted) return;
    this.aborted = true;
    this.creationParams = undefined;
    this.forget();
    const instance = this.instance;
    this.instance = undefined;
    const callbacks = [...this.abortListeners];
    this.abortListeners.clear();
    for (const callback of callbacks) this.notify(callback);
    if (instance) this.notify(() => instance.dispose());
  }
}

interface PlatformViewSlotMarker {
  readonly rect: Rect;
  readonly instanceId: number;
  readonly visible: boolean;
}

export type PlatformViewMarker = PlatformViewSlotMarker | { readonly barrier: Rect };
export type RecordedPlatformView = PlatformViewMarker & {
  readonly index: number;
};

export interface PlatformViewPlacement {
  readonly instanceId: number;
  readonly bounds: Rect;
  readonly clip: Rect;
  readonly visible: boolean;
  readonly unsupportedReason?: string;
}

/** A range in the original immutable command stream. Prefix entries restore
 * active transform/clip/save state at the beginning of a new drawing surface. */
export interface PlatformViewDrawRange {
  readonly start: number;
  readonly end: number;
  readonly prefix: readonly number[];
  readonly restoreCount: number;
}

export type PlatformViewScenePart =
  | { readonly draw: PlatformViewDrawRange }
  | { readonly view: PlatformViewPlacement }
  | { readonly barrier: Rect };

export interface PlatformViewHitRegion {
  readonly instanceId: number;
  readonly rect: Rect;
}

export interface PlatformViewScene {
  readonly parts: readonly PlatformViewScenePart[];
  readonly input: readonly PlatformViewHitRegion[];
}

export const maxPlatformViewForegrounds = 4;
