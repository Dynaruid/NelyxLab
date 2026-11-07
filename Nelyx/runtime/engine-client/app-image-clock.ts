// SPDX-License-Identifier: BSD-3-Clause
import type { Disposable } from '@nelyx/core/foundation/disposable';
import type { EngineViewClient } from './client.ts';
import { body } from './codec.ts';
import { protocol as p } from './schema.ts';

export interface AppImageClockSnapshot {
  readonly frameEvents: number;
  readonly frameRequests: number;
  readonly timerRequests: number;
  readonly frameCallbacks: number;
  readonly timerCallbacks: number;
  readonly pendingFrames: number;
  readonly pendingTimers: number;
  readonly now: number;
  readonly lastSerial: string;
  readonly closed: boolean;
}
/** The View's C++ clock owns deadlines. No JS timer or repeated frame polling
 * advances an image. Core timestamps are also the ImageService's clock epoch. */
export class AppImageClock {
  private time: number | undefined;
  private serial = 0n;
  private closed = false;
  private closing: Promise<void> | undefined;
  private readonly frames = new Set<() => void>();
  private readonly timers = new Set<{ callback: () => void; delay: number; at?: number }>();
  private tail = Promise.resolve();
  private readonly failures: unknown[] = [];
  private wakeRequested = false;
  private plannedAt = 0;
  private requested = false;
  private events = 0;
  private frameRequests = 0;
  private timerRequests = 0;
  private frameCallbacks = 0;
  private timerCallbacks = 0;
  constructor(
    private readonly view: EngineViewClient,
    private readonly report: (error: unknown) => void,
  ) {}
  now = (): number => this.time ?? 0;
  get execution(): AppImageClockSnapshot {
    return Object.freeze({
      frameEvents: this.events,
      frameRequests: this.frameRequests,
      timerRequests: this.timerRequests,
      frameCallbacks: this.frameCallbacks,
      timerCallbacks: this.timerCallbacks,
      pendingFrames: this.frames.size,
      pendingTimers: this.timers.size,
      now: this.now(),
      lastSerial: String(this.serial),
      closed: this.closed,
    });
  }
  private check(): void {
    if (this.closed) throw Error('App image frame clock is closed');
  }
  private send(at?: number): void {
    this.requested = true;
    const bytes =
      at === undefined ? undefined : body(8, (data) => data.setFloat64(0, at / 1000, true));
    // Absolute deadlines can be replayed without moving the due time. Serialize
    // retries with newer replacements/cancellation so an old ACK cannot re-arm
    // a superseded timer after its successor has been sent.
    this.tail = this.tail
      .then(async () => {
        let failure: unknown;
        for (let attempt = 0; attempt < 2; ++attempt)
          try {
            await this.view.request(p.opcodes.requestAppFrame, bytes);
            return;
          } catch (error) {
            failure = error;
          }
        this.failures.push(failure);
        if (!this.closed) this.report(failure);
      })
      .catch((error) => {
        this.failures.push(error);
      });
  }
  private wake(): void {
    if (!this.wakeRequested) {
      this.wakeRequested = true;
      this.send();
    }
  }
  private refresh(): void {
    let first = Infinity;
    for (const timer of this.timers) {
      if (timer.at === undefined) {
        this.wake();
        continue;
      }
      first = Math.min(first, timer.at);
    }
    if (first !== Infinity && first <= this.now()) this.wake();
    const at = first === Infinity || first <= this.now() ? 0 : first;
    if (at !== this.plannedAt) {
      this.plannedAt = at;
      this.send(at);
    }
  }
  requestFrame(callback: () => void): Disposable {
    this.check();
    if (this.frames.size >= p.limits.appImageCallbacks)
      throw Error('App image frame callback budget exceeded');
    // A registration owns its identity even if the same function is used twice.
    const invoke = () => callback();
    this.frames.add(invoke);
    ++this.frameRequests;
    this.wake();
    return {
      dispose: () => {
        this.frames.delete(invoke);
      },
    };
  }
  scheduleTimer(callback: () => void, milliseconds: number): Disposable {
    this.check();
    if (
      !Number.isFinite(milliseconds) ||
      milliseconds < 0 ||
      milliseconds > 1e12 ||
      this.timers.size >= p.limits.appImageCallbacks
    )
      throw Error('App image timer budget/value exceeded');
    const timer = {
      callback,
      delay: milliseconds,
      ...(this.time === undefined ? {} : { at: this.time + milliseconds }),
    };
    this.timers.add(timer);
    ++this.timerRequests;
    this.refresh();
    return {
      dispose: () => {
        if (this.timers.delete(timer) && !this.closed) this.refresh();
      },
    };
  }
  frame(atSeconds: number, serial: bigint): void {
    if (this.closed || serial <= this.serial) return;
    if (
      !Number.isFinite(atSeconds) ||
      atSeconds < 0 ||
      (this.time !== undefined && atSeconds * 1000 < this.time)
    )
      throw Error('Invalid Core image frame timestamp');
    this.time = atSeconds * 1000;
    this.serial = serial;
    ++this.events;
    this.wakeRequested = false;
    for (const timer of this.timers) if (timer.at === undefined) timer.at = this.time + timer.delay;
    const frames = [...this.frames],
      timers = [...this.timers]
        .filter((timer) => timer.at! <= this.time!)
        .sort((a, b) => a.at! - b.at!);
    for (const callback of frames)
      if (!this.closed && this.frames.delete(callback)) {
        ++this.frameCallbacks;
        try {
          callback();
        } catch (error) {
          this.report(error);
        }
      }
    for (const timer of timers)
      if (!this.closed && this.timers.delete(timer)) {
        ++this.timerCallbacks;
        try {
          timer.callback();
        } catch (error) {
          this.report(error);
        }
      }
    if (!this.closed) this.refresh();
  }
  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.closed = true;
    this.frames.clear();
    this.timers.clear();
    this.plannedAt = 0;
    if (this.requested) this.send(0);
    this.closing = this.tail.then(() => {
      if (this.failures.length)
        throw new AggregateError(this.failures, 'App image clock requests did not settle reliably');
    });
    return this.closing;
  }
}
