// SPDX-License-Identifier: BSD-3-Clause
import type { PaintCommand, FrameBuildToken } from '../ui/types.ts';
import type { Disposable } from '../foundation/disposable.ts';
import type { FrameDiagnostics } from '../ui/frame-diagnostics.ts';
/** Internal immutable recordings, captured before flattening. No custom hook is
 * evaluated by the service. Native state stores numeric IDs/ranges only. */
export interface SceneCompositionSource {
  readonly commands: readonly PaintCommand[];
  /** Internal opaque retained Picture admission, evaluated at its original
   * position after native ordering. Never passed to or retained by C++. */
  readonly draw?: (canvas: import('../ui/canvas.ts').Canvas) => void;
  readonly scoped: boolean;
  readonly children: readonly { readonly mark: number; readonly source: SceneCompositionSource }[];
  onDispose(callback: () => void): void;
}
export type SceneCompositionRange =
  | { readonly scope: 'save' | 'restore' }
  | { readonly source: SceneCompositionSource; readonly begin: number; readonly end: number };
export interface SceneCompositionTransaction {
  compose(root: SceneCompositionSource | undefined): readonly SceneCompositionRange[] | undefined;
  commit(): void;
  discard(): void;
}
export interface SceneCompositionService extends Disposable {
  begin(token: FrameBuildToken, diagnostics?: FrameDiagnostics): SceneCompositionTransaction;
}
