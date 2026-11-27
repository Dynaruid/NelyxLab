// SPDX-License-Identifier: BSD-3-Clause
import type { FrameRequest, FrameTiming } from '@nelyx/core/foundation/clock';

interface Request {
  callback(timing: FrameTiming): void;
  inputDriven: boolean;
  earlyPending: boolean;
}

/** One display pulse per view. Touch and late viewport changes can use its work early. */
export class BrowserFrameClock {
  private readonly pending = new Set<Request>();
  private pulse: number | undefined;
  private usedEarly = false;
  private closed = false;

  constructor(
    private readonly window: Window,
    private readonly dispatch: (callback: () => void) => void,
    private readonly originOffset: number,
  ) {}

  request(callback: Request['callback'], inputDriven = false): FrameRequest {
    if (this.closed) throw new Error('Web clock closed');
    const request: Request = { callback, inputDriven, earlyPending: false };
    this.pending.add(request);
    this.schedule();
    return {
      afterInput: () => this.offerEarly(request),
      dispose: () => {
        this.pending.delete(request);
        if (!this.pending.size && !this.usedEarly) this.cancelPulse();
      },
    };
  }

  /** Use the shared early slot for resize work, including observations that arrive after rAF. */
  offerResize(): void {
    for (const request of this.pending) {
      if (!request.inputDriven) continue;
      this.offerEarly(request);
      break;
    }
  }

  private offerEarly(request: Request): void {
    if (!request.inputDriven || request.earlyPending || !this.pending.has(request)) return;
    request.earlyPending = true;
    if (this.usedEarly) return;
    queueMicrotask(() => {
      if (this.closed || this.usedEarly || !this.pending.delete(request)) return;
      this.usedEarly = true;
      this.run(request, performance.now());
    });
  }

  private run(request: Request, tick: number): void {
    this.dispatch(() => {
      const dispatch = performance.now();
      request.callback({
        tick,
        dispatch,
        queueDelay: Math.max(0, dispatch - tick),
        clockUncertainty: 0,
      });
    });
  }

  private schedule(): void {
    if (this.pulse !== undefined) return;
    this.pulse = this.window.requestAnimationFrame((timestamp) => {
      this.pulse = undefined;
      const usedEarly = this.usedEarly;
      this.usedEarly = false;
      try {
        // oxlint-disable-next-line unicorn/no-useless-spread -- Requests created by callbacks belong to the next refresh.
        for (const request of [...this.pending]) {
          if (usedEarly && request.inputDriven && !request.earlyPending) continue;
          if (this.pending.delete(request)) this.run(request, timestamp + this.originOffset);
        }
      } finally {
        if (this.pending.size) this.schedule();
      }
    });
  }

  private cancelPulse(): void {
    if (this.pulse !== undefined) this.window.cancelAnimationFrame(this.pulse);
    this.pulse = undefined;
  }

  dispose(): void {
    this.closed = true;
    this.pending.clear();
    this.cancelPulse();
  }
}
