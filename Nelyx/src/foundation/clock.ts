import type { Disposable } from './disposable.ts';
export interface Clock {
  now(): number;
}
export interface FrameTiming {
  readonly tick: number;
  readonly dispatch: number;
  readonly queueDelay: number;
  readonly clockUncertainty: number;
  /** Optional host-advertised deadline in this Clock's epoch. Never synthesize
   * this from tick + an assumed refresh interval. Existing hosts omit it. */
  readonly observedDeadline?: number;
}
export interface FrameClock {
  request(callback: (timing?: FrameTiming) => void): Disposable;
}
