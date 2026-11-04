// SPDX-License-Identifier: BSD-3-Clause
/** Numeric transactions over canonical Element accounting. Native owns no cache. */
export const sectionLifetimeProtocol = Object.freeze({
  magic: 0x4e4c534c,
  version: 1,
  header: 16,
  row: 8,
  maxRows: 17,
});
export interface SectionLifetimeService {
  run(packet: Float64Array): readonly number[];
  applied(retained: number, evicted: number, prepared: number): void;
  dispose(): void;
}
