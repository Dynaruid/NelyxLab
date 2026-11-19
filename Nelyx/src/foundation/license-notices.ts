// SPDX-License-Identifier: BSD-3-Clause
// Flutter: packages/flutter/lib/src/services/binding.dart (compressed NOTICES asset)
// Revision: 71e4717a61786faab4c7aa39825989305ed29e8a
import { decodeUtf8 } from '../services/json-serialization.ts';
import { invariant } from './errors.ts';

const lengthBases = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131,
  163, 195, 227, 258,
];
const lengthExtras = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
];
const distanceBases = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049,
  3073, 4097, 6145, 8193, 12289, 16385, 24577,
];
const codeLengthOrder = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

function requireGzip(condition: unknown): asserts condition {
  invariant(condition, 'invalid-license-archive', 'Invalid gzip-compressed NOTICES asset');
}

class DeflateBits {
  private buffer = 0;
  private buffered = 0;

  constructor(
    private readonly bytes: Uint8Array,
    private cursor: number,
    private readonly end: number,
  ) {}

  read(width: number): number {
    while (this.buffered < width) {
      requireGzip(this.cursor < this.end);
      this.buffer |= this.bytes[this.cursor++]! << this.buffered;
      this.buffered += 8;
    }
    const value = this.buffer & ((1 << width) - 1);
    this.buffer >>>= width;
    this.buffered -= width;
    return value;
  }

  align(): void {
    this.buffer = 0;
    this.buffered = 0;
  }

  get exhausted(): boolean {
    return this.cursor === this.end;
  }
}

class DeflateCodes {
  private readonly symbols: ReadonlyMap<number, number>[] = [];

  constructor(lengths: readonly number[]) {
    const counts = Array<number>(16).fill(0);
    for (const length of lengths) if (length > 0) counts[length] = counts[length]! + 1;
    let nextCode = 0;
    for (let width = 1; width <= Math.max(...lengths); width++) {
      nextCode = (nextCode + counts[width - 1]!) << 1;
      requireGzip(nextCode + counts[width]! <= 1 << width);
      const symbols = new Map<number, number>();
      for (let symbol = 0; symbol < lengths.length; symbol++)
        if (lengths[symbol] === width) symbols.set(nextCode + symbols.size, symbol);
      this.symbols.push(symbols);
    }
  }

  read(bits: DeflateBits): number {
    let code = 0;
    for (const symbols of this.symbols) {
      code = (code << 1) | bits.read(1);
      const symbol = symbols.get(code);
      if (symbol !== undefined) return symbol;
    }
    requireGzip(false);
  }
}

const fixedLiterals = new DeflateCodes(
  Array.from({ length: 288 }, (_, symbol) =>
    symbol < 144 ? 8 : symbol < 256 ? 9 : symbol < 280 ? 7 : 8,
  ),
);
const fixedDistances = new DeflateCodes(Array<number>(32).fill(5));

function readDynamicCodes(bits: DeflateBits): readonly [DeflateCodes, DeflateCodes] {
  const literalCount = 257 + bits.read(5);
  const distanceCount = 1 + bits.read(5);
  const codeLengthCount = 4 + bits.read(4);
  requireGzip(literalCount <= 286);
  const codeLengths = Array<number>(19).fill(0);
  for (let index = 0; index < codeLengthCount; index++)
    codeLengths[codeLengthOrder[index]!] = bits.read(3);
  const codes = new DeflateCodes(codeLengths);
  const lengths: number[] = [];
  const required = literalCount + distanceCount;
  while (lengths.length < required) {
    const code = codes.read(bits);
    if (code < 16) {
      lengths.push(code);
      continue;
    }
    const previous = code === 16 ? lengths.at(-1) : 0;
    const run = code === 16 ? 3 + bits.read(2) : code === 17 ? 3 + bits.read(3) : 11 + bits.read(7);
    requireGzip(previous !== undefined && lengths.length + run <= required);
    for (let index = 0; index < run; index++) lengths.push(previous);
  }
  requireGzip(lengths[256] !== 0);
  return [
    new DeflateCodes(lengths.slice(0, literalCount)),
    new DeflateCodes(lengths.slice(literalCount)),
  ];
}

function inflateMember(bits: DeflateBits, output: Uint8Array): void {
  let written = 0;
  let final = false;
  do {
    final = bits.read(1) === 1;
    const type = bits.read(2);
    if (type === 0) {
      bits.align();
      const length = bits.read(16);
      requireGzip((length ^ bits.read(16)) === 0xffff && written + length <= output.length);
      for (let index = 0; index < length; index++) output[written++] = bits.read(8);
      continue;
    }
    requireGzip(type <= 2);
    const [literals, distances] =
      type === 1 ? [fixedLiterals, fixedDistances] : readDynamicCodes(bits);
    for (;;) {
      const symbol = literals.read(bits);
      if (symbol === 256) break;
      if (symbol < 256) {
        requireGzip(written < output.length);
        output[written++] = symbol;
        continue;
      }
      const lengthIndex = symbol - 257;
      requireGzip(lengthIndex < lengthBases.length);
      const length = lengthBases[lengthIndex]! + bits.read(lengthExtras[lengthIndex]!);
      const distanceIndex = distances.read(bits);
      requireGzip(distanceIndex < distanceBases.length);
      const extra = Math.max(0, (distanceIndex >> 1) - 1);
      const distance = distanceBases[distanceIndex]! + bits.read(extra);
      requireGzip(distance <= written && written + length <= output.length);
      for (let index = 0; index < length; index++) {
        output[written] = output[written - distance]!;
        written++;
      }
    }
  } while (!final);
  requireGzip(bits.exhausted && written === output.length);
}

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) === 0 ? 0 : 0xedb88320);
  return value;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255]!;
  return (crc ^ 0xffffffff) >>> 0;
}

/** Reads the single gzip member emitted by the Flutter asset packager for NOTICES.Z. */
export function decodeCompressedNotices(bytes: Uint8Array): string {
  requireGzip(bytes.length >= 20 && bytes[0] === 0x1f && bytes[1] === 0x8b && bytes[2] === 8);
  const flags = bytes[3]!;
  requireGzip((flags & 0xe0) === 0);
  const footer = bytes.length - 8;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 10;
  if (flags & 4) {
    requireGzip(offset + 2 <= footer);
    offset += 2 + view.getUint16(offset, true);
    requireGzip(offset <= footer);
  }
  for (const flag of [8, 16]) {
    if ((flags & flag) === 0) continue;
    const terminator = bytes.indexOf(0, offset);
    requireGzip(terminator >= offset && terminator < footer);
    offset = terminator + 1;
  }
  if (flags & 2) {
    requireGzip(
      offset + 2 <= footer &&
        (crc32(bytes.subarray(0, offset)) & 0xffff) === view.getUint16(offset, true),
    );
    offset += 2;
  }
  const expectedSize = view.getUint32(footer + 4, true);
  // A length/distance pair consumes at least two bits and copies at most 258 bytes.
  requireGzip(offset < footer && expectedSize <= (footer - offset) * 1032);
  const contents = new Uint8Array(expectedSize);
  inflateMember(new DeflateBits(bytes, offset, footer), contents);
  requireGzip(crc32(contents) === view.getUint32(footer, true));
  return decodeUtf8(contents);
}
