// SPDX-License-Identifier: BSD-3-Clause
/** Portable to the native JS runtime, which need not provide DOM TextEncoder. */
export function encodeUtf8(value: string, maximum = 65536): Uint8Array {
  const bytes: number[] = [];
  for (const character of value) {
    const cp = character.codePointAt(0)!;
    if (cp >= 0xd800 && cp <= 0xdfff) throw new RangeError('Unpaired UTF-16 surrogate');
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x800) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else
      bytes.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 63),
        0x80 | ((cp >> 6) & 63),
        0x80 | (cp & 63),
      );
    if (bytes.length > maximum) throw new RangeError('UTF-8 byte budget exceeded');
  }
  return new Uint8Array(bytes);
}
export function decodeUtf8(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length;) {
    const first = bytes[i++]!;
    let cp = first,
      count = 0,
      minimum = 0;
    if (first < 128) {
      result += String.fromCodePoint(cp);
      continue;
    }
    if (first >= 0xc2 && first <= 0xdf) {
      cp = first & 31;
      count = 1;
      minimum = 128;
    } else if (first >= 0xe0 && first <= 0xef) {
      cp = first & 15;
      count = 2;
      minimum = 0x800;
    } else if (first >= 0xf0 && first <= 0xf4) {
      cp = first & 7;
      count = 3;
      minimum = 0x10000;
    } else throw new Error('Invalid UTF-8 lead');
    if (count > bytes.length - i) throw new Error('Truncated UTF-8');
    for (let j = 0; j < count; ++j) {
      const byte = bytes[i++]!;
      if ((byte & 0xc0) !== 0x80) throw new Error('Invalid UTF-8 continuation');
      cp = (cp << 6) | (byte & 63);
    }
    if (cp < minimum || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff))
      throw new Error('Invalid UTF-8 scalar');
    result += String.fromCodePoint(cp);
  }
  return result;
}
