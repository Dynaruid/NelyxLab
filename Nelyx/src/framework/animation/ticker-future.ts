// SPDX-License-Identifier: BSD-3-Clause
import { invariant } from '../../foundation/errors.ts';
import type { Ticker } from './ticker.ts';
export class TickerCanceled extends Error {
  constructor(readonly ticker?: Ticker) {
    super(ticker ? 'Ticker canceled' : 'Ticker canceled before orCancel was observed');
    this.name = 'TickerCanceled';
  }
}
/** Cancellation leaves the primary sequence pending; orCancel exposes the cancellation outcome. */
export class TickerFuture implements PromiseLike<void> {
  private state: 'pending' | 'complete' | 'canceled' = 'pending';
  private readonly primary: Promise<void>;
  private resolvePrimary!: () => void;
  private secondary:
    | { promise: Promise<void>; resolve: () => void; reject: (error: Error) => void }
    | undefined;
  constructor() {
    this.primary = new Promise<void>((resolve) => {
      this.resolvePrimary = resolve;
    });
  }
  static complete(): TickerFuture {
    const future = new TickerFuture();
    future.finish();
    return future;
  }
  get completed(): boolean {
    return this.state === 'complete';
  }
  get canceled(): boolean {
    return this.state === 'canceled';
  }
  get orCancel(): Promise<void> {
    if (!this.secondary) {
      let resolve!: () => void, reject!: (error: Error) => void;
      const promise = new Promise<void>((done, fail) => {
        resolve = done;
        reject = fail;
      });
      this.secondary = { promise, resolve, reject };
      if (this.state === 'complete') resolve();
      else if (this.state === 'canceled') reject(new TickerCanceled());
    }
    return this.secondary.promise;
  }
  whenCompleteOrCancel(callback: () => void | PromiseLike<void>): Promise<void> {
    return this.orCancel.then(callback, callback);
  }
  /* oxlint-disable unicorn/no-thenable -- TickerFuture deliberately implements the PromiseLike protocol. */
  then<T = void, E = never>(
    fulfilled?: ((value: void) => T | PromiseLike<T>) | null,
    rejected?: ((reason: unknown) => E | PromiseLike<E>) | null,
  ): Promise<T | E> {
    return this.primary.then(fulfilled, rejected);
  }
  /* oxlint-enable unicorn/no-thenable */
  catch<T = never>(rejected: (reason: unknown) => T | PromiseLike<T>): Promise<void | T> {
    return this.primary.catch(rejected);
  }
  finally(callback: () => void): Promise<void> {
    return this.primary.finally(callback);
  }
  /** Framework completion entry; applications stop their Ticker instead. */
  finish(): void {
    invariant(this.state === 'pending', 'ticker-future-settled', 'TickerFuture already settled');
    this.state = 'complete';
    this.resolvePrimary();
    this.secondary?.resolve();
  }
  cancel(ticker?: Ticker): void {
    invariant(this.state === 'pending', 'ticker-future-settled', 'TickerFuture already settled');
    this.state = 'canceled';
    this.secondary?.reject(new TickerCanceled(ticker));
  }
}
