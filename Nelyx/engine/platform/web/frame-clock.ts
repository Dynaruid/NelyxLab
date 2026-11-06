// SPDX-License-Identifier: BSD-3-Clause
export interface FrameClockSample {
  source: 'worker-raf' | 'main-raf' | 'timer-fallback';
  fallbackReason: string | null;
  timeOriginMs: number;
  requestedAtMs: number;
  startedAtMs: number;
  callbackTimestampMs: number | null;
  callbackTimeOriginMs: number | null;
  predictedTargetMs: number | null;
  prediction: 'observed-callback-period' | 'unobserved';
  callbacks: number;
  cancellations: number;
  outstanding: number;
}

/** One demand, one deadline timer or animation callback. No continuous idle loop. */
export class DemandFrameClock {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private animation: number | undefined;
  private due: number | undefined;
  private closed = false;
  private previous: number | undefined;
  private previousOrigin: number | undefined;
  private proxy: MessagePort | undefined;
  private proxyTicket: number | undefined;
  private proxyTimeout: ReturnType<typeof setTimeout> | undefined;
  private nextTicket = 0;
  private mode: FrameClockSample['source'] =
    typeof requestAnimationFrame === 'function' && typeof cancelAnimationFrame === 'function'
      ? 'worker-raf'
      : 'timer-fallback';
  private reason: string | null = this.mode === 'worker-raf' ? null : 'worker-raf-unavailable';
  private callbacks = 0;
  private cancellations = 0;
  private last: FrameClockSample | undefined;
  constructor(
    private run: (sample: FrameClockSample) => void,
    private fail: (error: unknown) => void,
  ) {}
  get source(): FrameClockSample['source'] {
    return this.mode;
  }
  get snapshot(): FrameClockSample {
    return {
      source: this.mode,
      fallbackReason: this.reason,
      timeOriginMs: performance.timeOrigin,
      requestedAtMs: this.last?.requestedAtMs ?? 0,
      startedAtMs: this.last?.startedAtMs ?? 0,
      callbackTimestampMs: this.last?.callbackTimestampMs ?? null,
      callbackTimeOriginMs: this.last?.callbackTimeOriginMs ?? null,
      predictedTargetMs: this.last?.predictedTargetMs ?? null,
      prediction: this.last?.prediction ?? 'unobserved',
      callbacks: this.callbacks,
      cancellations: this.cancellations,
      outstanding: this.due === undefined ? 0 : 1,
    };
  }
  connect(port: MessagePort): void {
    if (this.proxy || this.closed) throw Error('Frame clock port already connected or closed');
    this.proxy = port;
    port.addEventListener('message', (event: MessageEvent) => {
      const value = event.data;
      if (this.closed || value.id !== this.proxyTicket) return;
      this.proxyTicket = undefined;
      if (this.proxyTimeout !== undefined) clearTimeout(this.proxyTimeout);
      this.proxyTimeout = undefined;
      if (
        value.kind !== 'frame' ||
        !Number.isFinite(value.time) ||
        !Number.isFinite(value.timeOrigin)
      ) {
        this.cancel();
        this.fail(Error('Invalid Main frame clock response'));
        return;
      }
      this.fire(value.time, value.timeOrigin);
    });
    port.start();
    if (this.mode === 'timer-fallback') this.mode = 'main-raf';
  }
  request(at = performance.now()): void {
    if (this.closed) return;
    if (this.due !== undefined && this.due <= at) return;
    this.due = Math.min(this.due ?? at, at);
    // An existing rAF is already the earliest display opportunity.
    if (this.animation !== undefined || this.proxyTicket !== undefined) return;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    const wait = this.due - performance.now();
    if (wait > 0)
      this.timer = setTimeout(() => {
        this.timer = undefined;
        this.schedule();
      }, wait);
    else this.schedule();
  }
  private schedule(): void {
    if (this.closed || this.due === undefined) return;
    if (this.mode === 'worker-raf') {
      try {
        this.animation = requestAnimationFrame((time) => {
          this.animation = undefined;
          this.fire(time);
        });
        return;
      } catch (error) {
        if (!(error instanceof Error) || error.name !== 'NotSupportedError') {
          this.cancel();
          this.fail(error);
          return;
        }
        this.mode = this.proxy ? 'main-raf' : 'timer-fallback';
        this.reason = 'worker-raf-not-supported';
      }
    }
    if (this.mode === 'main-raf') {
      this.proxyTicket = ++this.nextTicket;
      this.proxy!.postMessage({ kind: 'request', id: this.proxyTicket });
      this.proxyTimeout = setTimeout(() => {
        this.cancel();
        this.fail(Error('Main frame clock signal timed out'));
      }, 15000);
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.fire();
    }, 0);
  }
  private fire(time?: number, origin = performance.timeOrigin): void {
    if (this.closed || this.due === undefined) return;
    const requestedAtMs = this.due,
      startedAtMs = performance.now();
    this.due = undefined;
    const period =
      time === undefined || this.previous === undefined || this.previousOrigin !== origin
        ? null
        : time - this.previous;
    this.previous = time;
    this.previousOrigin = origin;
    this.last = {
      source: this.mode,
      fallbackReason: this.reason,
      timeOriginMs: performance.timeOrigin,
      requestedAtMs,
      startedAtMs,
      callbackTimestampMs: time ?? null,
      callbackTimeOriginMs: time === undefined ? null : origin,
      predictedTargetMs:
        time !== undefined && period !== null && period >= 1 && period <= 100
          ? origin - performance.timeOrigin + time + period
          : null,
      prediction:
        time !== undefined && period !== null && period >= 1 && period <= 100
          ? 'observed-callback-period'
          : 'unobserved',
      callbacks: ++this.callbacks,
      cancellations: this.cancellations,
      outstanding: 0,
    };
    this.run(this.last);
  }
  cancel(): void {
    if (this.due !== undefined) ++this.cancellations;
    if (this.timer !== undefined) clearTimeout(this.timer);
    if (this.animation !== undefined) cancelAnimationFrame(this.animation);
    if (this.proxyTicket !== undefined)
      this.proxy?.postMessage({ kind: 'cancel', id: this.proxyTicket });
    if (this.proxyTimeout !== undefined) clearTimeout(this.proxyTimeout);
    this.proxyTimeout = undefined;
    this.proxyTicket = undefined;
    this.timer = this.animation = undefined;
    this.due = undefined;
    this.previous = undefined;
    this.previousOrigin = undefined;
  }
  close(): void {
    this.closed = true;
    this.cancel();
    this.proxy?.close();
  }
}
