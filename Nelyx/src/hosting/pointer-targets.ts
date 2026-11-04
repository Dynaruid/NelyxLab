// SPDX-License-Identifier: BSD-3-Clause
import type { Offset, TransformMatrix } from '../ui/geometry.ts';
/** Numeric rows: id,parent,width,height,dx,dy,behavior,self.
 * Closed reference: 0 ordinary, 1 opaque, 2 translucent, 3 deferToChild.
 * Linear prefix: 0 ordinary, 3 live behavior proxy, 4 opaque TS boundary. */
export interface PointerTargetsService {
  /** Pure single-child prefix; terminal remains an ordinary live TS hit call.
   * A missing terminal means a standard ancestor rejected the point. */
  prefix?(
    root: object,
    rows: readonly (readonly number[])[],
    x: number,
    y: number,
    toLocal: TransformMatrix,
  ):
    | {
        readonly terminal: number;
        readonly steps: readonly {
          readonly id: number;
          readonly position: Offset;
          readonly transform: TransformMatrix;
          readonly inverseTranslation: readonly [number, number];
        }[];
      }
    | undefined;
  query(
    root: object,
    rows: readonly (readonly number[])[],
    x: number,
    y: number,
    toLocal: TransformMatrix,
  ): {
    readonly hit: boolean;
    readonly path: readonly { readonly id: number; readonly transform: TransformMatrix }[];
  };
  noteFallback(reason: string): void;
  dispose(): void;
}
