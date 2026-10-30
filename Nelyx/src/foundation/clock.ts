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
export interface FrameClock {
  request(callback: (timing?: FrameTiming) => void): Disposable;
}
