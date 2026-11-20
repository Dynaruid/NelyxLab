// SPDX-License-Identifier: BSD-3-Clause
import type { SemanticsNode } from '../../ui/types.ts';

export interface AppFrameSample {
  readonly build: number;
  readonly layout: number;
  readonly paint: number;
  readonly refreshInterval?: number;
}

export interface AppDiagnosticsObserver {
  readonly measureFrames: () => boolean;
  beginFrame(): void;
  endFrame(nodes: readonly SemanticsNode[], sample: AppFrameSample | undefined): void;
}
