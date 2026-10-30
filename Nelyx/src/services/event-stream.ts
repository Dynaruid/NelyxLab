// SPDX-License-Identifier: BSD-3-Clause
/** Portable asynchronous broadcast semantics used by the platform event channel. */
export interface StreamObserver<T> {
  readonly onData?: ((value: T) => void) | undefined;
  readonly onError?: ((error: unknown, stack: string | null) => void) | undefined;
  readonly onDone?: (() => void) | undefined;
  readonly cancelOnError?: boolean;
}
export interface BroadcastStreamRuntime {
  scheduleMicrotask(callback: () => void): void;
  uncaughtError(error: unknown): void;
}
const defaultRuntime: BroadcastStreamRuntime = {
  scheduleMicrotask: (callback) => {
    void Promise.resolve().then(callback);
  },
  uncaughtError: (error) => {
    void Promise.reject(error);
  },
};
type Event<T> =
  | { readonly kind: 'data'; readonly data: T }
  | { readonly kind: 'error'; readonly error: unknown; readonly stack: string | null }
  | { readonly kind: 'done' };
class StateError extends Error {
  constructor() {
    super('Cannot add new events after calling close');
    this.name = 'StateError';
  }
  override toString(): string {
    return 'Bad state: ' + this.message;
  }
}
export class StreamSubscription<T> {
  private observer: StreamObserver<T>;
  private queue: (Event<T> | undefined)[] = [];
  private head = 0;
  private pauses = 0;
  private cancelled = false;
  private scheduled = false;
  private firing = false;
  private cancellation: Promise<void> | undefined;
  constructor(
    private readonly controller: BroadcastStreamController<T>,
    observer: StreamObserver<T>,
    private readonly attached: boolean,
  ) {
    this.observer = observer;
  }
  get isPaused(): boolean {
    return this.pauses > 0;
  }
  onData(callback: ((value: T) => void) | null): void {
    this.observer = { ...this.observer, onData: callback ?? undefined };
  }
  onError(callback: ((error: unknown, stack: string | null) => void) | null): void {
    this.observer = { ...this.observer, onError: callback ?? undefined };
  }
  onDone(callback: (() => void) | null): void {
    this.observer = { ...this.observer, onDone: callback ?? undefined };
  }
  pause(resumeSignal?: PromiseLike<unknown>): void {
    if (this.cancelled) return;
    this.pauses++;
    if (resumeSignal)
      void Promise.resolve(resumeSignal).then(
        () => this.resume(),
        (error) => {
          this.resume();
          this.controller.runtime.uncaughtError(error);
        },
      );
  }
  resume(): void {
    if (this.cancelled || !this.pauses) return;
    this.pauses--;
    this.schedule();
  }
  cancel(): Promise<void> {
    if (!this.cancellation) {
      this.cancellation = new Promise<void>((resolve) => resolve());
      this.cancelled = true;
      this.queue = [];
      this.head = 0;
      if (this.attached) this.controller.remove(this);
    }
    return this.cancellation;
  }
  asFuture(): Promise<null>;
  asFuture<R>(value: R): Promise<R>;
  asFuture<R>(value: R | null = null): Promise<R | null> {
    return new Promise((resolve, reject) => {
      this.onDone(() => resolve(value));
      this.onError((error) => {
        void this.cancel();
        reject(error);
      });
    });
  }
  /** @internal */ enqueue(event: Event<T>): void {
    if (this.cancelled) return;
    this.queue.push(event);
    this.schedule();
  }
  private schedule(): void {
    if (
      this.cancelled ||
      this.isPaused ||
      this.scheduled ||
      this.firing ||
      this.head === this.queue.length
    )
      return;
    this.scheduled = true;
    this.controller.runtime.scheduleMicrotask(() => this.deliver());
  }
  private deliver(): void {
    this.scheduled = false;
    if (this.cancelled || this.isPaused || this.head === this.queue.length) return;
    const event = this.queue[this.head]!;
    this.queue[this.head++] = undefined;
    if (this.head === this.queue.length) {
      this.queue = [];
      this.head = 0;
    } else if (this.head >= 1024 && this.head * 2 >= this.queue.length) {
      this.queue = this.queue.slice(this.head);
      this.head = 0;
    }
    this.firing = true;
    try {
      if (event.kind === 'data') {
        const callback = this.observer.onData;
        if (callback) this.controller.guard(() => callback(event.data));
      } else if (event.kind === 'error') {
        if (this.observer.cancelOnError) void this.cancel();
        const callback = this.observer.onError;
        if (callback) this.controller.guard(() => callback(event.error, event.stack));
        else this.controller.runtime.uncaughtError(event.error);
      } else {
        void this.cancel();
        const callback = this.observer.onDone;
        if (callback) this.controller.guard(callback);
      }
    } finally {
      this.firing = false;
      this.schedule();
    }
  }
}
export class BroadcastStream<T> implements AsyncIterable<T> {
  constructor(private readonly controller: BroadcastStreamController<T>) {}
  get isBroadcast(): boolean {
    return true;
  }
  listen(observer: StreamObserver<T> = {}): StreamSubscription<T> {
    return this.controller.subscribe(observer);
  }
  [Symbol.asyncIterator](): AsyncIterator<T> {
    const buffered: ({ data: T } | { error: unknown } | { done: true })[] = [],
      waiters: {
        resolve: (result: IteratorResult<T>) => void;
        reject: (error: unknown) => void;
      }[] = [];
    let finished = false;
    const settle = () => {
      while (waiters.length && buffered.length) {
        const waiter = waiters.shift()!,
          event = buffered.shift()!;
        if ('error' in event) {
          finished = true;
          waiter.reject(event.error);
        } else if ('done' in event) {
          finished = true;
          waiter.resolve({ done: true, value: undefined });
        } else waiter.resolve({ done: false, value: event.data });
      }
      if (finished)
        for (const waiter of waiters.splice(0)) waiter.resolve({ done: true, value: undefined });
    };
    const subscription = this.listen({
      onData: (value) => {
        subscription.pause();
        buffered.push({ data: value });
        settle();
        if (waiters.length) subscription.resume();
      },
      onError: (error) => {
        buffered.push({ error });
        settle();
      },
      onDone: () => {
        buffered.push({ done: true });
        settle();
      },
      cancelOnError: true,
    });
    return {
      next: () => {
        if (finished) return Promise.resolve({ done: true, value: undefined });
        const result = new Promise<IteratorResult<T>>((resolve, reject) =>
          waiters.push({ resolve, reject }),
        );
        settle();
        if (waiters.length) subscription.resume();
        return result;
      },
      return: async () => {
        finished = true;
        buffered.length = 0;
        await subscription.cancel();
        settle();
        return { done: true, value: undefined };
      },
    };
  }
}
export interface BroadcastStreamCallbacks {
  readonly onListen?: () => void | PromiseLike<void>;
  readonly onCancel?: () => void | PromiseLike<void>;
}
export class BroadcastStreamController<T> {
  readonly stream = new BroadcastStream(this);
  private readonly subscriptions = new Set<StreamSubscription<T>>();
  private closed = false;
  private completion: Promise<void> | undefined;
  private complete: (() => void) | undefined;
  constructor(
    private readonly callbacks: BroadcastStreamCallbacks = {},
    readonly runtime: BroadcastStreamRuntime = defaultRuntime,
  ) {}
  get isClosed(): boolean {
    return this.closed;
  }
  get hasListener(): boolean {
    return this.subscriptions.size > 0;
  }
  get done(): Promise<void> {
    if (!this.completion)
      this.completion = new Promise((resolve) => {
        this.complete = resolve;
      });
    return this.completion;
  }
  guard(callback: () => unknown): void {
    try {
      const result = callback();
      if (
        result !== null &&
        typeof result === 'object' &&
        'then' in result &&
        typeof result.then === 'function'
      )
        void Promise.resolve(result).catch((error) => this.runtime.uncaughtError(error));
    } catch (error) {
      this.runtime.uncaughtError(error);
    }
  }
  /** @internal */ subscribe(observer: StreamObserver<T>): StreamSubscription<T> {
    const subscription = new StreamSubscription(this, observer, !this.closed);
    if (this.closed) subscription.enqueue({ kind: 'done' });
    else {
      this.subscriptions.add(subscription);
      if (this.subscriptions.size === 1 && this.callbacks.onListen)
        this.guard(this.callbacks.onListen);
    }
    return subscription;
  }
  /** @internal */ remove(subscription: StreamSubscription<T>): void {
    if (!this.subscriptions.delete(subscription) || this.subscriptions.size) return;
    if (this.closed) this.complete?.();
    if (this.callbacks.onCancel) this.guard(this.callbacks.onCancel);
  }
  add(value: T): void {
    if (this.closed) throw new StateError();
    for (const subscription of this.subscriptions)
      subscription.enqueue({ kind: 'data', data: value });
  }
  addError(error: unknown, stack: string | null = null): void {
    if (this.closed) throw new StateError();
    for (const subscription of this.subscriptions)
      subscription.enqueue({ kind: 'error', error, stack });
  }
  close(): Promise<void> {
    if (this.closed) return this.done;
    this.closed = true;
    const done = this.done;
    if (!this.subscriptions.size) this.complete?.();
    else for (const subscription of this.subscriptions) subscription.enqueue({ kind: 'done' });
    return done;
  }
  /** Embedding lifetime extension: cancel listeners before its transport is gated. */
  cancelListeners(): void {
    const snapshot = [...this.subscriptions];
    for (const subscription of snapshot) void subscription.cancel();
  }
}
