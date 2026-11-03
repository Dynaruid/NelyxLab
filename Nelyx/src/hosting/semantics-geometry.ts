// SPDX-License-Identifier: BSD-3-Clause
import type { Disposable } from '../foundation/disposable.ts';
import type { FrameBuildToken } from '../ui/types.ts';
import type { FrameDiagnostics } from '../ui/frame-diagnostics.ts';
export type SemanticsRect = readonly [number, number, number, number];
/** Captured numeric suffix of a shared semantics ancestor path. TS retains
 * semantic meaning, hook evaluation, shared-edge caching and publication. */
export interface SemanticsGeometryQuery {
  readonly transform: readonly number[];
  readonly parentTransform: readonly number[] | null;
  readonly paint: SemanticsRect | null;
  readonly semantic: SemanticsRect | null;
  readonly parentPaint: SemanticsRect | null;
  readonly parentSemantic: SemanticsRect | null;
  readonly bounds: SemanticsRect;
}
export interface SemanticsGeometryResult {
  readonly transform: readonly number[];
  readonly paint: SemanticsRect | null;
  readonly semantic: SemanticsRect | null;
  readonly rect: SemanticsRect;
  readonly hidden: boolean;
}
export interface SemanticsGeometryService extends Disposable {
  /** Optional experiment accounting; does not change the TS fallback. */
  noteFallback?(): void;
  project(
    token: FrameBuildToken,
    queries: readonly SemanticsGeometryQuery[],
    diagnostics?: FrameDiagnostics,
  ): readonly SemanticsGeometryResult[];
}
