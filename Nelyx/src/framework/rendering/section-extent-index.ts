// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2026 phantom. All rights reserved.
// Adapted from Doroti SectionExtentIndex. See licenses/section-list-sources.json.
import { invariant } from '../../foundation/errors.ts';
import type { TextScaler } from '../painting/text-scaler.ts';
import { Axis } from '../painting/basic-types.ts';

export type SectionExtentMeasurement = 'unmeasured' | 'measured' | 'invalidated';
interface Configuration {
  readonly width: number;
  readonly revision: object | null;
  readonly axis: Axis;
  readonly environment: SectionExtentEnvironment | null;
  readonly extents: Float64Array;
  readonly tree: Float64Array;
  readonly states: Uint8Array;
}
export interface SectionAnchor {
  readonly index: number;
  readonly offset: number;
}
/** @internal Metric dependencies captured by the canonical sliver Widget. */
export interface SectionExtentEnvironment {
  readonly deviceScale: number;
  readonly textScale: number;
  readonly textScaler: TextScaler | null;
  readonly boldText: boolean;
  readonly direction: 'ltr' | 'rtl' | null;
  readonly locale: string | null;
}
function sameEnvironment(
  a: SectionExtentEnvironment | null,
  b: SectionExtentEnvironment | null,
): boolean {
  return (
    a === b ||
    (a !== null &&
      b !== null &&
      a.deviceScale === b.deviceScale &&
      a.textScale === b.textScale &&
      a.textScaler === b.textScaler &&
      a.boldText === b.boldText &&
      a.direction === b.direction &&
      a.locale === b.locale)
  );
}

/** Bounded height estimates for lazy, variable-height sections. Estimates only
 * locate work; the renderer always lays out visible children at their real size.
 * One index belongs to one mounted sliver. Width/revision caches are limited to
 * two configurations, and a revision uses object identity. */
export class SectionExtentIndex {
  readonly count: number;
  readonly estimatedExtent: number;
  private current: Configuration | null = null;
  private previous: Configuration | null = null;
  private observer: (() => void) | null = null;
  private request: SectionAnchor | null = null;
  private anchorValue: SectionAnchor = { index: 0, offset: 0 };
  constructor(
    count: number,
    { estimatedExtent = 300 }: { readonly estimatedExtent?: number } = {},
  ) {
    invariant(
      Number.isSafeInteger(count) && count >= 0 && count <= 4096,
      'invalid-section-count',
      'Section count must be between zero and 4096',
    );
    invariant(
      Number.isFinite(estimatedExtent) &&
        estimatedExtent > 0 &&
        Number.isFinite(estimatedExtent * count),
      'invalid-section-estimate',
      'Section estimate and total must be finite and positive',
    );
    this.count = count;
    this.estimatedExtent = estimatedExtent;
    Object.defineProperties(this, {
      count: { writable: false, configurable: false },
      estimatedExtent: { writable: false, configurable: false },
    });
  }
  get cachedConfigurations(): number {
    return this.current === null ? 0 : this.previous === null ? 1 : 2;
  }
  get numericStorageBytes(): number {
    return this.cachedConfigurations * (this.count * 17 + 8);
  }
  get totalExtent(): number {
    return this.prefix(this.count);
  }
  get anchor(): SectionAnchor {
    return Object.freeze({ ...this.anchorValue });
  }
  requestItem(index: number, { offset = 0 }: { readonly offset?: number } = {}): void {
    this.checkIndex(index);
    invariant(
      Number.isFinite(offset) && offset >= 0,
      'invalid-section-anchor',
      'Section anchor offset must be finite and nonnegative',
    );
    this.request = { index, offset };
    this.observer?.();
  }
  /** Invalidating a section keeps its old height as an estimate. The next
   * materialization measures it again, without creating offscreen children. */
  invalidate(index: number): void {
    this.checkIndex(index);
    if (this.current) this.current.states[index] = 2;
    if (this.previous) this.previous.states[index] = 2;
    this.observer?.();
  }
  measurement(index: number): SectionExtentMeasurement {
    this.checkIndex(index);
    const state = this.current?.states[index] ?? 0;
    return state === 1 ? 'measured' : state === 2 ? 'invalidated' : 'unmeasured';
  }
  prefix(count: number): number {
    invariant(
      Number.isSafeInteger(count) && count >= 0 && count <= this.count,
      'invalid-section-prefix',
      'Section prefix must be within the item count',
    );
    if (this.current === null) return count * this.estimatedExtent;
    // Match the rank search's left-to-right chunk order exactly. Summing the
    // same floating-point chunks in reverse can make prefix(i) sort just below
    // i, incorrectly anchoring a seek to the preceding section.
    let sum = 0,
      index = 0;
    for (let bit = 4096; bit !== 0; bit >>= 1)
      if (count & bit) {
        index += bit;
        sum += this.current.tree[index]!;
      }
    return sum;
  }
  indexAtOffset(offset: number): number {
    invariant(Number.isFinite(offset), 'invalid-section-offset', 'Section offset must be finite');
    if (this.count === 0) return 0;
    if (this.current === null) {
      let index = Math.max(0, Math.min(this.count - 1, Math.floor(offset / this.estimatedExtent)));
      if (index < this.count - 1 && (index + 1) * this.estimatedExtent <= offset) index++;
      else if (index > 0 && index * this.estimatedExtent > offset) index--;
      return index;
    }
    let index = 0,
      sum = 0;
    for (let bit = 4096; bit !== 0; bit >>= 1) {
      const next = index + bit;
      if (next <= this.count && sum + this.current.tree[next]! <= offset) {
        index = next;
        sum += this.current.tree[next]!;
      }
    }
    return Math.min(index, this.count - 1);
  }
  /** @internal Only the owning sliver may configure and measure this index. */
  _attach(observer: () => void): void {
    invariant(
      this.observer === null || this.observer === observer,
      'section-index-already-attached',
      'A SectionExtentIndex cannot be shared by mounted slivers',
    );
    this.observer = observer;
  }
  /** @internal */
  _detach(observer: () => void): void {
    if (this.observer === observer) this.observer = null;
  }
  /** @internal */
  _configure(
    width: number,
    revision: object | null,
    environment: SectionExtentEnvironment | null = null,
    axis: Axis = Axis.vertical,
  ): boolean {
    invariant(
      Number.isFinite(width) && width >= 0,
      'invalid-section-width',
      'Section width must be finite and nonnegative',
    );
    if (
      this.current?.width === width &&
      this.current.revision === revision &&
      this.current.axis === axis &&
      sameEnvironment(this.current.environment, environment)
    )
      return false;
    if (
      this.previous?.width === width &&
      this.previous.revision === revision &&
      this.previous.axis === axis &&
      sameEnvironment(this.previous.environment, environment)
    ) {
      [this.current, this.previous] = [this.previous, this.current];
      return true;
    }
    const next: Configuration = {
      width,
      revision,
      axis,
      environment: environment === null ? null : Object.freeze({ ...environment }),
      extents: new Float64Array(this.count),
      tree: new Float64Array(this.count + 1),
      states: new Uint8Array(this.count),
    };
    for (let i = 0; i < this.count; i++) {
      const extent = this.current?.extents[i] ?? this.estimatedExtent;
      next.extents[i] = extent;
      next.states[i] = this.current === null ? 0 : 2;
      this.add(next, i, extent);
    }
    this.previous = this.current;
    this.current = next;
    return true;
  }
  /** @internal */
  _measure(index: number, extent: number): void {
    this.checkIndex(index);
    invariant(
      this.current !== null && Number.isFinite(extent) && extent >= 0,
      'invalid-section-measurement',
      'Section measurement requires a configuration and a finite nonnegative extent',
    );
    invariant(
      Number.isFinite(this.totalExtent - this.current.extents[index]! + extent),
      'invalid-section-total',
      'Measured section total must remain finite',
    );
    this.add(this.current, index, extent - this.current.extents[index]!);
    this.current.extents[index] = extent;
    this.current.states[index] = 1;
  }
  /** @internal */
  _takeRequest(): SectionAnchor | null {
    const request = this.request;
    this.request = null;
    return request;
  }
  /** @internal */
  _didLayout(index: number, offset: number): void {
    this.anchorValue = { index, offset };
  }
  private checkIndex(index: number): void {
    invariant(
      Number.isSafeInteger(index) && index >= 0 && index < this.count,
      'invalid-section-index',
      'Section index must be within the item count',
    );
  }
  private add(config: Configuration, index: number, delta: number): void {
    for (let i = index + 1; i < config.tree.length; i += i & -i) config.tree[i]! += delta;
  }
}
