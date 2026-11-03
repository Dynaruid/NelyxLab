// SPDX-License-Identifier: BSD-3-Clause
import type { Disposable } from '../foundation/disposable.ts';
/** Numeric phases around ordinary child layout. No RenderObject or callback
 * crosses this boundary; dry/intrinsic/baseline work keeps its TS contract. */
export interface FlexLayoutService extends Disposable {
  run(packet: Float64Array): readonly number[];
  noteFallback(reason: string): void;
}
export const flexLayoutProtocol = Object.freeze({
  magic: 0x4e4c4658,
  version: 1,
  header: 16,
  maxChildren: 2048,
});
