// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fontCatalogBytes } from '../../runtime/engine-client/font-catalog.ts';

// Preserve the intrinsic family/style while changing the actual outline scale.
// Both fonts are valid SFNTs, including the changed table/file checksums.
export function scaledFont(input) {
  const bytes = input.slice(),
    data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let head = -1,
    record = -1,
    length = 0;
  for (let i = 0; i < data.getUint16(4); ++i) {
    const at = 12 + i * 16;
    if (data.getUint32(at) === 0x68656164) {
      record = at;
      head = data.getUint32(at + 8);
      length = data.getUint32(at + 12);
      break;
    }
  }
  assert.ok(head >= 0 && head + length <= bytes.length);
  const units = data.getUint16(head + 18);
  assert.ok(units >= 16 && units * 2 <= 16384);
  data.setUint16(head + 18, units * 2);
  data.setUint32(head + 8, 0);
  const checksum = (offset, size) => {
    let sum = 0;
    for (let i = 0; i < size; i += 4) {
      let word = 0;
      for (let j = 0; j < 4; ++j) word = ((word << 8) | (bytes[offset + i + j] ?? 0)) >>> 0;
      sum = (sum + word) >>> 0;
    }
    return sum;
  };
  data.setUint32(record + 4, checksum(head, length));
  data.setUint32(head + 8, (0xb1b0afba - checksum(0, bytes.length)) >>> 0);
  assert.equal(checksum(0, bytes.length), 0xb1b0afba);
  return bytes;
}
export function fontResourceFixture(root) {
  const font = new Uint8Array(fs.readFileSync(path.join(root, 'assets/NotoSansHebrew.ttf'))),
    changed = scaledFont(font),
    catalog = (bytes) =>
      fontCatalogBytes({
        fonts: [{ family: 'NelyxDefault', bytes }],
        fallback: ['NelyxDefault', 'NelyxArabic', 'NelyxHebrew', 'NelyxEmoji'],
      });
  return { font, changed, a: catalog(font), b: catalog(changed) };
}
