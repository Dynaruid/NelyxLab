// SPDX-License-Identifier: BSD-3-Clause
import type { FrameClock, FrameTiming } from '@nelyx/core/foundation/clock';

export interface SurfaceFrameScheduler {
  request(callback: (timing?: FrameTiming) => void, onError?: (error: unknown) => void): number;
  cancel(id: number): void;
}
/** Frame and retirement polling belong to one surface owner, including late-callback suppression. */
export function createSurfaceFrameClock(
  options: { pending(): boolean; poll(): void; onError(error: unknown): void },
  scheduler: SurfaceFrameScheduler,
): FrameClock & { dispose(): void } {
  let live = true,
    notification: number | undefined,
    pollFailed = false;
  const frames = new Set<{ id: number; live: boolean }>();
  function schedule() {
    if (!live || pollFailed || notification !== undefined || !options.pending()) return;
    notification = scheduler.request(
      () => {
        notification = undefined;
        if (!live) return;
        try {
          options.poll();
          schedule();
        } catch (error) {
          pollFailed = true;
          options.onError(error);
        }
      },
      (error) => {
        notification = undefined;
        if (live) {
          pollFailed = true;
          options.onError(error);
        }
      },
    );
  }
  return {
    request(callback) {
      if (!live) throw new Error('Surface frame clock is closed');
      const frame = { id: 0, live: true };
      frames.add(frame);
      try {
        frame.id = scheduler.request(
          (timing) => {
            frames.delete(frame);
            if (!live || !frame.live) return;
            frame.live = false;
            let callbackFailed = false,
              callbackError: unknown;
            try {
              callback(timing);
            } catch (error) {
              callbackFailed = true;
              callbackError = error;
            }
            try {
              schedule();
            } catch (error) {
              if (callbackFailed)
                throw new AggregateError(
                  [callbackError, error],
                  'Frame callback and retirement scheduling failed',
                );
              throw error;
            }
            if (callbackFailed) throw callbackError;
          },
          (error) => {
            frames.delete(frame);
            if (live && frame.live) {
              frame.live = false;
              options.onError(error);
            }
          },
        );
      } catch (error) {
        frames.delete(frame);
        frame.live = false;
        throw error;
      }
      return {
        dispose() {
          if (!frame.live) return;
          frame.live = false;
          frames.delete(frame);
          scheduler.cancel(frame.id);
        },
      };
    },
    dispose() {
      if (!live) return;
      live = false;
      const polling = notification;
      notification = undefined;
      const pending = [...frames];
      frames.clear();
      for (const frame of pending) frame.live = false;
      const errors: unknown[] = [];
      if (polling !== undefined)
        try {
          scheduler.cancel(polling);
        } catch (error) {
          errors.push(error);
        }
      for (const frame of pending)
        try {
          scheduler.cancel(frame.id);
        } catch (error) {
          errors.push(error);
        }
      if (errors.length === 1) throw errors[0];
      if (errors.length) throw new AggregateError(errors, 'Surface frame cancellation failed');
    },
  };
}
