// SPDX-License-Identifier: BSD-3-Clause
import type { FrameRequest, FrameTiming } from '@nelyx/core/foundation/clock';

interface Request {
  callback(timing: FrameTiming): void;
  inputDriven: boolean;
  inputPending: boolean;
}

/** One display pulse per view. Touch can use the upcoming pulse's work early. */
export class BrowserFrameClock {
  private readonly pending = new Set<Request>();
  private pulse: number | undefined;
  private usedInput = false;
  private closed = false;

  constructor(
    private readonly window: Window,
    private readonly dispatch: (callback: () => void) => void,
    private readonly originOffset: number,
  ) {}

  request(callback: Request['callback'], inputDriven = false): FrameRequest {
    if (this.closed) throw new Error('Web clock closed');
    const request: Request = { callback, inputDriven, inputPending: false };
    this.pending.add(request);
    this.schedule();
    return {
      afterInput: () => {
        if (!inputDriven || request.inputPending || !this.pending.has(request)) return;
        request.inputPending = true;
        if (this.usedInput) return;
        queueMicrotask(() => {
          if (this.closed || this.usedInput || !this.pending.delete(request)) return;
          this.usedInput = true;
          this.run(request, performance.now());
        });
      },
      dispose: () => {
        this.pending.delete(request);
        if (!this.pending.size && !this.usedInput) this.cancelPulse();
      },
    };
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
      const usedInput = this.usedInput;
      this.usedInput = false;
      try {
        // oxlint-disable-next-line unicorn/no-useless-spread -- Requests created by callbacks belong to the next refresh.
        for (const request of [...this.pending]) {
          if (usedInput && request.inputDriven && !request.inputPending) continue;
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
