// SPDX-License-Identifier: BSD-3-Clause
import type { Clock } from '../foundation/clock.ts';
import type { FrameBuildToken } from './types.ts';

export type FrameDiagnosticStage =
  | 'animation'
  | 'build'
  | 'layout'
  | 'optional-work'
  | 'paint'
  | 'compose'
  | 'input-geometry'
  | 'semantics'
  | 'post-frame'
  | 'capture'
  | 'geometry-publish'
  | 'semantics-publish'
  | 'capture-transfer'
  | 'pending'
  | 'submit'
  | 'admission'
  | 'admission-rejected'
  | 'recording-begin'
  | 'packet'
  | 'native-replay'
  | 'recording-finish'
  | 'native-submit'
  | 'paint-visits'
  | 'boundary-visits'
  | 'boundary-recordings'
  | 'boundary-reuses'
  | 'dirty-layout'
  | 'input-queue'
  | 'input-dispatch';

/** Numeric CPU observations. No scene, commands, resources or frame leases. */
export interface FrameDiagnosticSample {
  readonly view: string;
  readonly owner: number;
  readonly viewport: number;
  readonly renderer: number;
  readonly context: number | null;
  readonly surface: number | null;
  readonly frame: number;
  readonly input: number;
  readonly stage: FrameDiagnosticStage;
  readonly begin: number;
  readonly end: number;
  readonly duration: number;
  readonly count: number;
  readonly bytes: number;
}

/** Explicitly enabled, bounded RAM sampling. The owner drains between frames;
 * overwrites are reported, never interpreted as missing frames or idle gaps.
 * Timestamps use the supplied Clock's epoch. These are not display receipts. */
export class FrameDiagnostics {
  private readonly entries: (FrameDiagnosticSample | undefined)[];
  private next = 0;
  private count = 0;
  private overwritten = 0;
  private invalid = 0;
  constructor(
    private readonly clock: Clock,
    readonly capacity = 1024,
  ) {
    if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 16384)
      throw new Error('Frame diagnostic capacity must be 1..16384');
    this.entries = Array.from({ length: capacity }, () => undefined);
  }
  now(): number {
    try {
      return this.clock.now();
    } catch {
      // A diagnostic clock must not turn an otherwise valid draw into failure.
      return NaN;
    }
  }
  record(
    token: FrameBuildToken,
    stage: FrameDiagnosticStage,
    begin: number,
    count = 0,
    bytes = 0,
  ): number {
    const end = this.now();
    if (
      ![begin, end, count, bytes].every(Number.isFinite) ||
      end < begin ||
      count < 0 ||
      bytes < 0
    ) {
      this.invalid++;
      return end;
    }
    const metrics = token.metrics;
    this.entries[this.next] = {
      view: token.owner.id,
      owner: token.owner.generation,
      viewport: metrics.viewportGeneration,
      renderer: metrics.rendererGeneration,
      context: metrics.nativeContextGeneration,
      surface: metrics.nativeSurfaceGeneration,
      frame: token.sequence,
      input: token.inputSequence ?? 0,
      stage,
      begin,
      end,
      duration: end - begin,
      count,
      bytes,
    };
    this.next = (this.next + 1) % this.capacity;
    if (this.count === this.capacity) this.overwritten++;
    else this.count++;
    return end;
  }
  drain(): {
    readonly samples: readonly FrameDiagnosticSample[];
    readonly overwritten: number;
    readonly invalid: number;
  } {
    const samples: FrameDiagnosticSample[] = [];
    for (let index = 0; index < this.count; index++) {
      const slot = (this.next + this.capacity - this.count + index) % this.capacity;
      samples.push(this.entries[slot]!);
      this.entries[slot] = undefined;
    }
    const result = { samples, overwritten: this.overwritten, invalid: this.invalid };
    this.count = this.overwritten = this.invalid = 0;
    return result;
  }
}
