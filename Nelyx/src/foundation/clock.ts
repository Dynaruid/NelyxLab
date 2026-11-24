import type { Disposable } from './disposable.ts';
export interface Clock {
  now(): number;
}
export interface FrameTiming {
  readonly tick: number;
  readonly dispatch: number;
  readonly queueDelay: number;
  readonly clockUncertainty: number;
  /** Host-advertised work limit in this Clock's epoch, not a display receipt.
   * Absent for fallback, expired or uncertain predictions. Never synthesize
   * this from tick + an assumed refresh interval. */
  readonly observedDeadline?: number;
  readonly frameStart?: number;
  readonly frameTarget?: number;
  readonly refreshInterval?: number;
  readonly timingSource?: 'dwm-predicted' | 'timer-fallback';
  readonly timingRevision?: number;
}
export interface FrameRequest extends Disposable {
  /** Offer an outstanding view frame after a touch update has finished dispatching. */
  afterInput?(): void;
}
export interface FrameClock {
  request(callback: (timing?: FrameTiming) => void, inputDriven?: boolean): FrameRequest;
  /** A cancellable host idle callback with its own remaining time budget in milliseconds. */
  requestIdle?(callback: (timeRemaining: () => number) => void): Disposable;
  /** Admission changed. No animation tick or deadline is implied. */
  observeCredit?(callback: () => void): Disposable;
}
