// SPDX-License-Identifier: BSD-3-Clause
import type { EngineResponse, NodeHandle } from '../engine-client/codec.ts';
import { observationNode } from '../engine-client/node-index.ts';

export interface SourcePreparationTarget {
  readonly owner: string;
  readonly node: NodeHandle;
  readonly document: string;
  readonly metrics: string;
  readonly device: string;
  readonly font: string;
  readonly revision: string;
  readonly input: string;
  readonly preparation?: string;
  readonly requestId?: string;
  readonly publication?: string;
  readonly range?: { readonly begin: number; readonly end: number; readonly generation: string };
}
type Terminal =
  | 'published-coverage'
  | 'declined'
  | 'failed'
  | 'rejected'
  | 'cohort-changed'
  | 'closed';
type SourceKind = 'sliver-request' | 'box-request' | 'observed-window' | 'retained-box';
export type SourceClockDomain =
  | 'date-milliseconds'
  | 'app-performance-milliseconds'
  | 'qpc-milliseconds'
  | 'monotonic-milliseconds';
export interface SourceDiagnosticClock {
  readonly domain: SourceClockDomain;
  readonly now: () => number;
  /** Present only when the host explicitly enables bounded heap profiling. */
  readonly profileActive?: () => boolean;
}
type Sample = {
  readonly sequence: number;
  readonly kind: SourceKind;
  readonly request: string;
  readonly target: SourcePreparationTarget;
  readonly started: number;
  readonly elapsedMs: number;
  readonly result: 'built' | 'declined' | 'failed';
  capturePass?: number;
  sealedAt?: number;
  acceptedDocument?: string;
  acceptedAt?: number;
  publication?: string;
  consumedThrough?: string;
  completedAt?: number;
  terminal?: Terminal;
};
/** The original 128 Source samples, linked explicitly to their sealed pass.
 * App timestamps describe observation, never native demand/layout/provider CPU.
 * Missing or overwritten chains remain visible in the denominator. */
export class SourcePreparationJournal {
  private readonly samples: Sample[] = [];
  private sequence = 0;
  private elapsedMs = 0;
  private maxMs = 0;
  private overwrittenPending = 0;
  private pendingCount = 0;
  private latest: EngineResponse | undefined;
  private latestAt = 0;
  private closedAt: number | undefined;
  private readonly terminals: Record<Terminal, number> = {
    'published-coverage': 0,
    declined: 0,
    failed: 0,
    rejected: 0,
    'cohort-changed': 0,
    closed: 0,
  };
  private readonly byKind: Record<SourceKind, { calls: number; elapsedMs: number; maxMs: number }> =
    {
      'sliver-request': { calls: 0, elapsedMs: 0, maxMs: 0 },
      'box-request': { calls: 0, elapsedMs: 0, maxMs: 0 },
      'observed-window': { calls: 0, elapsedMs: 0, maxMs: 0 },
      'retained-box': { calls: 0, elapsedMs: 0, maxMs: 0 },
    };
  get through(): number {
    return this.sequence;
  }
  constructor(
    private readonly enabled = true,
    private readonly domain: SourceClockDomain = 'date-milliseconds',
  ) {}
  record(
    kind: Sample['kind'],
    request: string,
    target: SourcePreparationTarget,
    started: number,
    elapsedMs: number,
    result: Sample['result'],
  ): void {
    if (!this.enabled) return;
    if (this.samples.length === 128) {
      if (!this.samples.shift()!.terminal) {
        ++this.overwrittenPending;
        --this.pendingCount;
      }
    }
    this.elapsedMs += elapsedMs;
    this.maxMs = Math.max(this.maxMs, elapsedMs);
    const costs = this.byKind[kind];
    ++costs.calls;
    costs.elapsedMs += elapsedMs;
    costs.maxMs = Math.max(costs.maxMs, elapsedMs);
    const sample: Sample = {
      sequence: ++this.sequence,
      kind,
      request,
      target,
      started,
      elapsedMs,
      result,
    };
    this.samples.push(sample);
    ++this.pendingCount;
    if (this.closedAt !== undefined) this.finish(sample, 'closed', this.closedAt);
    else if (result !== 'built') this.finish(sample, result, started + elapsedMs);
  }
  seal(pass: number, at: number): number[] {
    const sequences: number[] = [];
    if (!this.pendingCount) return sequences;
    for (const sample of this.samples)
      if (!sample.terminal && sample.capturePass === undefined) {
        sample.capturePass = pass;
        sample.sealedAt = at;
        sequences.push(sample.sequence);
      }
    return sequences;
  }
  accept(sequences: readonly number[], document: bigint, at: number): void {
    for (const sample of this.samples)
      if (sequences.includes(sample.sequence) && !sample.terminal) {
        sample.acceptedDocument = String(document);
        sample.acceptedAt = at;
      }
    // A publication can be observed before the awaiting App owner resumes ACK.
    if (this.latest) this.observe(this.latest, this.latestAt);
  }
  reject(sequences: readonly number[], at: number): void {
    for (const sample of this.samples)
      if (sequences.includes(sample.sequence) && !sample.terminal)
        this.finish(sample, 'rejected', at);
  }
  observe(state: EngineResponse, at: number): void {
    if (!this.enabled || this.closedAt !== undefined) return;
    this.latest = state;
    this.latestAt = at;
    if (!this.pendingCount) return;
    for (const sample of this.samples) {
      if (sample.terminal) continue;
      const target = sample.target;
      const owner = state.owner;
      if (`${owner.session}/${owner.app}/${owner.view}/${owner.generation}` !== target.owner)
        continue;
      if (
        String(state.metrics) !== target.metrics ||
        String(state.device) !== target.device ||
        String(state.fontRevision) !== target.font
      ) {
        this.finish(sample, 'cohort-changed', at);
        continue;
      }
      if (
        !sample.acceptedDocument ||
        !state.visible ||
        !state.publication ||
        state.publishedDocument !== state.activeDocument ||
        state.publishedDocument < BigInt(sample.acceptedDocument) ||
        state.publishedMetrics !== state.metrics ||
        state.publishedDevice !== state.device
      )
        continue;
      const published = state.observation?.cohorts.published;
      if (
        !published ||
        String(published.font) !== target.font ||
        published.publication !== state.publication
      )
        continue;
      const node = observationNode(state, target.node),
        range = target.range;
      if (!node || String(node.layoutBuilder?.revision) !== target.revision) continue;
      if (
        range &&
        (!node.list ||
          String(node.list.generation) !== range.generation ||
          node.list.begin > range.begin ||
          node.list.end < range.end)
      )
        continue;
      sample.publication = String(state.publication);
      sample.consumedThrough = String(state.consumedThrough);
      this.finish(sample, 'published-coverage', at);
    }
  }
  close(at: number): void {
    this.closedAt = at;
    this.latest = undefined;
    for (const sample of this.samples) if (!sample.terminal) this.finish(sample, 'closed', at);
  }
  private finish(sample: Sample, terminal: Terminal, at: number): void {
    --this.pendingCount;
    sample.terminal = terminal;
    sample.completedAt = at;
    ++this.terminals[terminal];
  }
  diagnostics(): Record<string, unknown> {
    return {
      calls: this.sequence,
      elapsedMs: this.elapsedMs,
      maxMs: this.maxMs,
      byKind: Object.fromEntries(
        Object.entries(this.byKind).map(([kind, costs]) => [kind, { ...costs }]),
      ),
      samplesThrough: this.sequence,
      samplesOverwritten: Math.max(0, this.sequence - this.samples.length),
      overwrittenPending: this.overwrittenPending,
      pending: this.pendingCount,
      terminals: { ...this.terminals },
      demandToCoverage: 'notVerified',
      contentProviderTiming: 'notVerified',
      clock: 'app-observation-only',
      clockDomain: this.domain,
      enabled: this.enabled,
      samples: this.samples.map((sample) => ({ ...sample })),
    };
  }
}
