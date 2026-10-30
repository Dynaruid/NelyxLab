// SPDX-License-Identifier: BSD-3-Clause
// Nelyx refresh request/attachment lifetime; application async work keeps its own resources.
import { ChangeNotifier } from '../../foundation/notifier.ts';
import { invariant } from '../../foundation/errors.ts';

export type RefreshPhase = 'idle' | 'drag' | 'armed' | 'refresh' | 'error';
export interface RefreshSnapshot {
  readonly phase: RefreshPhase;
  readonly progress: number;
  readonly pending: boolean;
  readonly attached: boolean;
}
export type RefreshResult =
  | { readonly status: 'completed' }
  | { readonly status: 'cancelled'; readonly error?: unknown }
  | { readonly status: 'failed'; readonly error: unknown };
/** Host-neutral cancellation; SDK callers may connect onCancel to their own I/O abort API. */
export class RefreshCancellationSignal {
  private cancelled = false;
  private settled = false;
  private readonly listeners = new Set<() => void>();
  get aborted(): boolean {
    return this.cancelled;
  }
  onCancel(listener: () => void): () => void {
    invariant(
      typeof listener === 'function' && !this.settled,
      'settled-refresh-signal',
      'Cancellation subscription requires a function and an unsettled request',
    );
    if (this.cancelled) {
      listener();
      return () => {};
    }
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  /** @internal Cancel once and retire all registered cancellation callbacks, even after failure. */
  _cancel(): void {
    if (this.cancelled) return;
    this.cancelled = true;
    const callbacks = [...this.listeners],
      errors: unknown[] = [];
    this.listeners.clear();
    for (const listener of callbacks)
      try {
        listener();
      } catch (error) {
        errors.push(error);
      }
    if (errors.length) throw new AggregateError(errors, 'Refresh cancellation callbacks failed');
  }
  /** @internal The application callback settled; no late cancellation subscriptions remain. */
  _settle(): void {
    this.settled = true;
    this.listeners.clear();
  }
}
export type RefreshCallback = (signal: RefreshCancellationSignal) => void | Promise<void>;
export interface RefreshAttachment {
  update(callback: RefreshCallback): void;
  dispose(): void;
}
interface Lease {
  callback: RefreshCallback;
}
interface Request {
  readonly lease: Lease;
  readonly signal: RefreshCancellationSignal;
  readonly done: Promise<RefreshResult>;
  readonly resolve: (result: RefreshResult) => void;
  cancelled: boolean;
}

/** One mounted refresh owner; matching requests coalesce, and cancellation fences obsolete UI. */
export class RefreshController extends ChangeNotifier {
  private retired = false;
  private retiring = false;
  private lease: Lease | undefined;
  private request: Request | undefined;
  private phase: RefreshPhase = 'idle';
  private progress = 0;
  private published: RefreshSnapshot = Object.freeze({
    phase: 'idle',
    progress: 0,
    pending: false,
    attached: false,
  });
  get snapshot(): RefreshSnapshot {
    return this.published;
  }
  get isRefreshing(): boolean {
    return this.phase === 'refresh';
  }
  private publish(phase: RefreshPhase, progress: number): void {
    this.phase = phase;
    this.progress = progress;
    const next: RefreshSnapshot = Object.freeze({
        phase,
        progress,
        pending: this.request !== undefined,
        attached: this.lease !== undefined,
      }),
      old = this.published;
    if (
      old.phase === next.phase &&
      old.progress === next.progress &&
      old.pending === next.pending &&
      old.attached === next.attached
    )
      return;
    this.published = next;
    if (!this.retired) this.notifyListeners();
  }
  /** @internal Widget attachment token; stale disposal cannot remove a replacement. */
  _attach(callback: RefreshCallback): RefreshAttachment {
    this.ensureAlive();
    invariant(
      typeof callback === 'function' && this.lease === undefined,
      'live-refresh-owner',
      'RefreshController requires exactly one callback/Widget owner',
    );
    const lease: Lease = { callback };
    this.lease = lease;
    try {
      this.publish('idle', 0);
    } catch (error) {
      this.lease = undefined;
      this.published = Object.freeze({
        phase: this.phase,
        progress: this.progress,
        pending: this.request !== undefined,
        attached: false,
      });
      throw error;
    }
    let released = false;
    return Object.freeze({
      update: (next: RefreshCallback) => {
        this.ensureAlive();
        invariant(
          !released && this.lease === lease && typeof next === 'function',
          'stale-refresh-attachment',
          'Refresh callback update requires its live attachment',
        );
        lease.callback = next;
      },
      dispose: () => {
        if (released) return;
        released = true;
        if (this.lease !== lease) return;
        this.lease = undefined;
        this.cancel();
      },
    });
  }
  /** @internal Gesture adapter supplies logical leading-edge pull distance. */
  _setPull(distance: number, threshold: number): void {
    this.ensureAlive();
    invariant(
      this.lease !== undefined,
      'unattached-refresh-controller',
      'Pull requires a mounted refresh owner',
    );
    invariant(
      Number.isFinite(distance) && distance >= 0 && Number.isFinite(threshold) && threshold > 0,
      'invalid-refresh-pull',
      'Refresh distance must be finite/nonnegative and threshold finite/positive',
    );
    if (this.request) return;
    const progress = Math.min(1, distance / threshold);
    this.publish(progress === 0 ? 'idle' : progress === 1 ? 'armed' : 'drag', progress);
  }
  /** Explicit requests and an armed gesture share the same admitted callback/result. */
  refresh(): Promise<RefreshResult> {
    this.ensureAlive();
    const lease = this.lease;
    invariant(
      lease !== undefined,
      'unattached-refresh-controller',
      'Refresh requires a mounted callback owner',
    );
    if (this.request) {
      invariant(
        this.request.lease === lease,
        'refresh-context-pending',
        'Await the cancelled previous owner before starting a new refresh context',
      );
      return this.request.done;
    }
    let resolve!: (result: RefreshResult) => void;
    const done = new Promise<RefreshResult>((value) => {
        resolve = value;
      }),
      request: Request = {
        lease,
        signal: new RefreshCancellationSignal(),
        done,
        resolve,
        cancelled: false,
      },
      callback = lease.callback;
    this.request = request;
    try {
      this.publish('refresh', 1);
    } catch (error) {
      this.finish(request, { status: 'failed', error });
      return done;
    }
    // Admission happens after observers can cancel/detach; obsolete work never starts.
    void Promise.resolve().then(async () => {
      if (request.cancelled || this.retired || this.lease !== lease) {
        this.finish(request, { status: 'cancelled' });
        return;
      }
      let failure = false,
        error: unknown;
      try {
        await callback(request.signal);
      } catch (value) {
        failure = true;
        error = value;
      }
      const cancelled = request.cancelled || this.retired || this.lease !== lease;
      this.finish(
        request,
        cancelled
          ? failure
            ? { status: 'cancelled', error }
            : { status: 'cancelled' }
          : failure
            ? { status: 'failed', error }
            : { status: 'completed' },
      );
    });
    return done;
  }
  private finish(request: Request, result: RefreshResult): void {
    if (this.request !== request) return;
    this.request = undefined;
    request.signal._settle();
    try {
      this.publish(result.status === 'failed' ? 'error' : 'idle', 0);
    } catch (error) {
      result = { status: 'failed', error };
    }
    request.resolve(Object.freeze(result));
  }
  /** Abort is advisory for application work; its result settles when that work settles. */
  cancel(): void {
    this.ensureAlive();
    const request = this.request,
      errors: unknown[] = [];
    if (request && !request.cancelled) {
      request.cancelled = true;
      try {
        request.signal._cancel();
      } catch (error) {
        errors.push(error);
      }
    }
    try {
      this.publish('idle', 0);
    } catch (error) {
      errors.push(error);
    }
    if (errors.length) throw new AggregateError(errors, 'Refresh cancellation failed');
  }
  override dispose(): void {
    if (this.retired) return;
    invariant(
      !this.retiring && this.lease === undefined,
      'live-refresh-owner',
      'Detach the refresh Widget and avoid reentrant controller retirement',
    );
    const errors: unknown[] = [];
    this.retiring = true;
    try {
      try {
        this.cancel();
      } catch (error) {
        errors.push(error);
      }
      try {
        super.dispose();
        this.retired = true;
      } catch (error) {
        errors.push(error);
      }
      this.phase = 'idle';
      this.progress = 0;
      this.published = Object.freeze({
        phase: 'idle',
        progress: 0,
        pending: this.request !== undefined,
        attached: false,
      });
    } finally {
      this.retiring = false;
    }
    if (errors.length) throw new AggregateError(errors, 'Refresh controller retirement failed');
  }
}
