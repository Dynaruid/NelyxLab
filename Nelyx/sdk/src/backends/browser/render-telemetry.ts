// SPDX-License-Identifier: BSD-3-Clause
import type { FrameBuildToken } from '@nelyx/core/ui/types';
import type { RenderFailureStage, WebRenderMode, WebRenderPath } from './render-protocol.ts';

type Timing =
  | 'mainSubmit'
  | 'encode'
  | 'workerDecode'
  | 'workerReplay'
  | 'workerSubmit'
  | 'fence'
  | 'inputToSubmit';
export class WebRenderTelemetry {
  readonly started = performance.now();
  path: WebRenderPath | undefined;
  workerIsolated: boolean | undefined;
  reservedBytes = 0;
  resourceBytes = 0;
  peakResourceBytes = 0;
  accepted = 0;
  gpuRetired = 0;
  discarded = 0;
  firstGpuFrameMs: number | undefined;
  sharedPublished = 0;
  sharedConsumed = 0;
  buffersDetached = 0;
  buffersReturned = 0;
  buffersReused = 0;
  encodedBytes = 0;
  registrationBatches = 0;
  resourceUploadBytes = 0;
  private lastInputSequence = 0;
  maxPending = 0;
  private readonly timing = new Map<Timing, number[]>();
  private readonly failures: { stage: RenderFailureStage; reason: string }[] = [];

  constructor(
    readonly requested: WebRenderMode,
    readonly secureContext: boolean,
    readonly crossOriginIsolated: boolean,
  ) {}

  sample(name: Timing, value: number): void {
    if (!Number.isFinite(value) || value < 0) return;
    let samples = this.timing.get(name);
    if (!samples) {
      samples = [];
      this.timing.set(name, samples);
    }
    if (samples.length === 256) samples.shift();
    samples.push(value);
  }

  inputSubmitted(token: FrameBuildToken, inputTimeOrigin: number, submittedAt: number): void {
    const { inputSequence, inputTimestamp } = token;
    if (
      inputTimestamp === undefined ||
      inputSequence === undefined ||
      inputSequence <= this.lastInputSequence
    )
      return;
    this.lastInputSequence = inputSequence;
    this.sample('inputToSubmit', submittedAt - inputTimeOrigin - inputTimestamp);
  }

  retired(result: 'gpu-retired' | 'drained' | 'discarded'): void {
    if (result === 'gpu-retired') {
      this.gpuRetired++;
      this.firstGpuFrameMs ??= performance.now() - this.started;
    } else {
      this.discarded++;
    }
  }

  failure(stage: RenderFailureStage, error: unknown): void {
    if (this.failures.length === 8) this.failures.shift();
    const reason = error instanceof Error ? error.message : String(error);
    this.failures.push({ stage, reason: reason.slice(0, 512) });
  }

  snapshot() {
    const p95Ms: Partial<Record<Timing, number>> = {};
    for (const [name, values] of this.timing) {
      const sorted = [...values].sort((a, b) => a - b);
      p95Ms[name] = sorted[Math.ceil(sorted.length * 0.95) - 1]!;
    }
    return Object.freeze({
      requested: this.requested,
      path: this.path,
      secureContext: this.secureContext,
      crossOriginIsolated: this.crossOriginIsolated,
      workerIsolated: this.workerIsolated,
      failures: Object.freeze(this.failures.map((failure) => Object.freeze({ ...failure }))),
      firstGpuFrameMs: this.firstGpuFrameMs,
      accepted: this.accepted,
      gpuRetired: this.gpuRetired,
      discarded: this.discarded,
      sharedPublished: this.sharedPublished,
      sharedConsumed: this.sharedConsumed,
      buffersDetached: this.buffersDetached,
      buffersReturned: this.buffersReturned,
      buffersReused: this.buffersReused,
      encodedBytes: this.encodedBytes,
      registrationBatches: this.registrationBatches,
      resourceUploadBytes: this.resourceUploadBytes,
      maxPending: this.maxPending,
      reservedBytes: this.reservedBytes,
      resourceBytes: this.resourceBytes,
      peakResourceBytes: this.peakResourceBytes,
      p95Ms: Object.freeze(p95Ms),
    });
  }
}
export type WebRenderDiagnostics = ReturnType<WebRenderTelemetry['snapshot']>;
