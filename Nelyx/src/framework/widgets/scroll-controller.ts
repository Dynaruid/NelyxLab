// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { ChangeNotifier } from '../../foundation/notifier.ts';
import { invariant } from '../../foundation/errors.ts';
import { describeIdentity } from '../../foundation/diagnostics-identity.ts';
import { ScrollPositionWithSingleContext } from './scroll-position-with-single-context.ts';
import type { ScrollPosition } from './scroll-position.ts';
import type { ScrollContext } from './scroll-context.ts';
import type { ScrollPhysics } from './scroll-physics.ts';
import type { ViewportAnimationOptions } from '../rendering/viewport-offset.ts';
export type ScrollControllerCallback = (position: ScrollPosition) => void;
export interface ScrollControllerOptions {
  readonly initialScrollOffset?: number;
  readonly keepScrollOffset?: boolean;
  readonly debugLabel?: string | null;
  readonly onAttach?: ScrollControllerCallback | null;
  readonly onDetach?: ScrollControllerCallback | null;
}
export class ScrollController extends ChangeNotifier {
  private readonly initialOffset: number;
  readonly keepScrollOffset: boolean;
  readonly debugLabel: string | null;
  readonly onAttach: ScrollControllerCallback | null;
  readonly onDetach: ScrollControllerCallback | null;
  private readonly attached: ScrollPosition[] = [];
  private readonly positionChanged = () => this.notifyListeners();
  constructor(
    {
      initialScrollOffset = 0,
      keepScrollOffset = true,
      debugLabel = null,
      onAttach = null,
      onDetach = null,
    }: ScrollControllerOptions = {},
    /** @internal Generated hosts publish after derived initialization. */ deferCreationDispatch = false,
  ) {
    super();
    this.initialOffset = initialScrollOffset;
    this.keepScrollOffset = keepScrollOffset;
    this.debugLabel = debugLabel;
    this.onAttach = onAttach;
    this.onDetach = onDetach;
    if (!deferCreationDispatch) ChangeNotifier.maybeDispatchObjectCreation(this);
  }
  get initialScrollOffset(): number {
    return this.initialOffset;
  }
  get positions(): Iterable<ScrollPosition> {
    return this.attached.values();
  }
  get hasClients(): boolean {
    return this.attached.length > 0;
  }
  get position(): ScrollPosition {
    invariant(
      this.attached.length === 1,
      'invalid-scroll-controller-clients',
      'Reading position requires exactly one attached scroll view',
    );
    return this.attached[0]!;
  }
  get offset(): number {
    return this.position.pixels;
  }
  async animateTo(offset: number, options: ViewportAnimationOptions): Promise<void> {
    this.ensureAlive();
    invariant(
      this.hasClients,
      'unattached-scroll-controller',
      'animateTo requires an attached scroll view',
    );
    await Promise.all([...this.attached].map((position) => position.animateTo(offset, options)));
  }
  jumpTo(value: number): void {
    this.ensureAlive();
    invariant(
      this.hasClients,
      'unattached-scroll-controller',
      'jumpTo requires an attached scroll view',
    );
    const snapshot1 = [...this.attached];
    for (const position of snapshot1) position.jumpTo(value);
  }
  attach(position: ScrollPosition): void {
    this.ensureAlive();
    invariant(
      !this.attached.includes(position),
      'duplicate-scroll-controller-position',
      'A position can be attached only once',
    );
    this.attached.push(position);
    try {
      position.addListener(this.positionChanged);
      this.onAttach?.(position);
    } catch (error) {
      position.removeListener(this.positionChanged);
      this.attached.splice(this.attached.indexOf(position), 1);
      throw error;
    }
  }
  /** A closing scroll owner may detach after its application-owned controller was disposed. */
  detach(position: ScrollPosition): void {
    const index = this.attached.indexOf(position);
    invariant(
      index >= 0,
      'unattached-scroll-controller-position',
      'Cannot detach an unregistered position',
    );
    try {
      this.onDetach?.(position);
    } finally {
      position.removeListener(this.positionChanged);
      const current = this.attached.indexOf(position);
      if (current >= 0) this.attached.splice(current, 1);
    }
  }
  /** @internal Restore the pre-transfer registration without re-entering a failing application callback. */
  _restoreAttachmentAfterFailedTransfer(position: ScrollPosition, context: ScrollContext): void {
    this.ensureAlive();
    invariant(
      position.context === context && !this.attached.includes(position),
      'invalid-scroll-controller-rollback',
      'Rollback requires this scroll owner and a detached position',
    );
    position.addListener(this.positionChanged);
    this.attached.push(position);
  }
  createScrollPosition(
    physics: ScrollPhysics,
    context: ScrollContext,
    oldPosition: ScrollPosition | null,
  ): ScrollPosition {
    this.ensureAlive();
    return new ScrollPositionWithSingleContext({
      physics,
      context,
      initialPixels: this.initialScrollOffset,
      keepScrollOffset: this.keepScrollOffset,
      oldPosition,
      debugLabel: this.debugLabel,
    });
  }
  override dispose(): void {
    for (const position of this.attached) position.removeListener(this.positionChanged);
    super.dispose();
  }
  debugFillDescription(description: string[]): void {
    if (this.debugLabel !== null) description.push(this.debugLabel);
    if (this.initialScrollOffset !== 0)
      description.push(`initialScrollOffset: ${this.initialScrollOffset.toFixed(1)}, `);
    description.push(
      this.attached.length === 0
        ? 'no clients'
        : this.attached.length === 1
          ? `one client, offset ${this.offset.toFixed(1)}`
          : `${this.attached.length} clients`,
    );
  }
  override toString(): string {
    const description: string[] = [];
    this.debugFillDescription(description);
    return `${describeIdentity(this)}(${description.join(', ')})`;
  }
}
export class TrackingScrollController extends ScrollController {
  private readonly positionToListener = new Map<ScrollPosition, () => void>();
  private lastUpdated: ScrollPosition | null = null;
  private lastUpdatedOffset: number | null = null;
  private readonly detachedSnapshots = new Map<
    ScrollPosition,
    {
      readonly listener: (() => void) | undefined;
      readonly lastUpdated: ScrollPosition | null;
      readonly lastUpdatedOffset: number | null;
    }
  >();
  get mostRecentlyUpdatedPosition(): ScrollPosition | null {
    return this.lastUpdated;
  }
  override get initialScrollOffset(): number {
    return this.lastUpdatedOffset ?? super.initialScrollOffset;
  }
  override attach(position: ScrollPosition): void {
    super.attach(position);
    this.detachedSnapshots.delete(position);
    const listener = () => {
      this.lastUpdated = position;
      this.lastUpdatedOffset = position.pixels;
    };
    this.positionToListener.set(position, listener);
    try {
      position.addListener(listener);
    } catch (error) {
      this.positionToListener.delete(position);
      super.detach(position);
      throw error;
    }
  }
  override detach(position: ScrollPosition): void {
    const snapshot = {
      listener: this.positionToListener.get(position),
      lastUpdated: this.lastUpdated,
      lastUpdatedOffset: this.lastUpdatedOffset,
    };
    this.detachedSnapshots.set(position, snapshot);
    void Promise.resolve().then(() => {
      if (this.detachedSnapshots.get(position) === snapshot)
        this.detachedSnapshots.delete(position);
    });
    try {
      super.detach(position);
    } finally {
      const listener = this.positionToListener.get(position);
      if (listener) position.removeListener(listener);
      this.positionToListener.delete(position);
      if (this.lastUpdated === position) this.lastUpdated = null;
      if (!this.positionToListener.size) this.lastUpdatedOffset = null;
    }
  }
  override _restoreAttachmentAfterFailedTransfer(
    position: ScrollPosition,
    context: ScrollContext,
  ): void {
    super._restoreAttachmentAfterFailedTransfer(position, context);
    const snapshot = this.detachedSnapshots.get(position);
    this.detachedSnapshots.delete(position);
    const listener =
      snapshot?.listener ??
      (() => {
        this.lastUpdated = position;
        this.lastUpdatedOffset = position.pixels;
      });
    this.positionToListener.set(position, listener);
    position.addListener(listener);
    if (snapshot) {
      this.lastUpdated = snapshot.lastUpdated;
      this.lastUpdatedOffset = snapshot.lastUpdatedOffset;
    }
  }
  override dispose(): void {
    this.detachedSnapshots.clear();
    for (const [position, listener] of this.positionToListener) position.removeListener(listener);
    super.dispose();
  }
}
