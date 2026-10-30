// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from the pinned Flutter foundation/serialization.dart.
import { FoundationBuildMode } from './constants.ts';
export type Endian = 'little' | 'big';
export const hostEndian: Endian =
  new Uint8Array(new Uint16Array([1]).buffer)[0] === 1 ? 'little' : 'big';
export type BufferInteger = number | bigint;
class StateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StateError';
  }
  override toString(): string {
    return 'Bad state: ' + this.message;
  }
}
class _AssertionError extends Error {
  constructor() {
    super('WriteBuffer assertion failed');
    this.name = '_AssertionError';
  }
}
const little = (endian: Endian | null | undefined) =>
  endian === undefined || endian === null ? hostEndian === 'little' : endian === 'little';
function integer(value: BufferInteger): bigint {
  if (typeof value === 'bigint') return value;
  if (!Number.isSafeInteger(value))
    throw new RangeError('Buffer integer must be exact; use bigint outside the safe-number domain');
  return BigInt(value);
}
function smallInteger(value: BufferInteger, bits: number, signed = false): number {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value))
      throw new RangeError(
        'Buffer integer must be exact; use bigint outside the safe-number domain',
      );
    return value;
  }
  return Number(signed ? BigInt.asIntN(bits, value) : BigInt.asUintN(bits, value));
}
function length(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new RangeError('Buffer length must be a nonnegative safe integer');
  return value;
}
/** Single-use output owner. done() transfers a shared view of the written prefix. */
export class WriteBuffer {
  private _buffer: Uint8Array;
  private _currentSize = 0;
  private _isDone = false;
  private readonly _eightBytes = new DataView(new ArrayBuffer(8));
  private readonly _eightBytesAsList = new Uint8Array(this._eightBytes.buffer);
  private static readonly _zeroBuffer = new Uint8Array(8);
  constructor({ startCapacity = 8 }: { readonly startCapacity?: number } = {}) {
    if (FoundationBuildMode.debug && startCapacity <= 0) throw new _AssertionError();
    this._buffer = new Uint8Array(length(startCapacity));
  }
  private assertWritable(): void {
    if (FoundationBuildMode.debug && this._isDone) throw new _AssertionError();
  }
  private _add(byte: BufferInteger): void {
    if (this._currentSize === this._buffer.length) this._resize();
    if (this._currentSize < 0 || this._currentSize >= this._buffer.length)
      throw new RangeError('Buffer index out of range');
    this._buffer[this._currentSize] = smallInteger(byte, 8);
    this._currentSize++;
  }
  private _append(other: Uint8Array): void {
    const newSize = this._currentSize + other.length;
    if (newSize >= this._buffer.length) this._resize(newSize);
    this._buffer.set(other, this._currentSize);
    this._currentSize += other.length;
  }
  private _addAll(data: Uint8Array, start = 0, end: number | null = null): void {
    const newEnd = end ?? this._eightBytesAsList.length,
      count = newEnd - start,
      newSize = this._currentSize + count;
    if (newSize >= this._buffer.length) this._resize(newSize);
    if (count < 0 || this._currentSize < 0 || newSize > this._buffer.length)
      throw new RangeError('Invalid buffer range');
    if (data.length < count) throw new StateError('Too few elements');
    this._buffer.set(data.subarray(0, count), this._currentSize);
    this._currentSize = newSize;
  }
  private _resize(requiredLength: number | null = null): void {
    const newBuffer = new Uint8Array(
      length(Math.max(requiredLength ?? 0, this._buffer.length * 2)),
    );
    newBuffer.set(this._buffer);
    this._buffer = newBuffer;
  }
  putUint8(value: BufferInteger): void {
    this.assertWritable();
    this._add(value);
  }
  putUint16(value: BufferInteger, { endian }: { readonly endian?: Endian | null } = {}): void {
    this.assertWritable();
    this._eightBytes.setUint16(0, smallInteger(value, 16), little(endian));
    this._addAll(this._eightBytesAsList, 0, 2);
  }
  putUint32(value: BufferInteger, { endian }: { readonly endian?: Endian | null } = {}): void {
    this.assertWritable();
    this._eightBytes.setUint32(0, smallInteger(value, 32), little(endian));
    this._addAll(this._eightBytesAsList, 0, 4);
  }
  putInt32(value: BufferInteger, { endian }: { readonly endian?: Endian | null } = {}): void {
    this.assertWritable();
    this._eightBytes.setInt32(0, smallInteger(value, 32, true), little(endian));
    this._addAll(this._eightBytesAsList, 0, 4);
  }
  putInt64(value: BufferInteger, { endian }: { readonly endian?: Endian | null } = {}): void {
    this.assertWritable();
    this._eightBytes.setBigInt64(0, integer(value), little(endian));
    this._addAll(this._eightBytesAsList, 0, 8);
  }
  putFloat64(value: number, { endian }: { readonly endian?: Endian | null } = {}): void {
    this.assertWritable();
    this._alignTo(8);
    this._eightBytes.setFloat64(0, value, little(endian));
    this._addAll(this._eightBytesAsList);
  }
  /** Host extension used by the fixed-width frame wire; aligns to four bytes. */
  putFloat32(value: number, { endian }: { readonly endian?: Endian | null } = {}): void {
    this.assertWritable();
    this._alignTo(4);
    this._eightBytes.setFloat32(0, value, little(endian));
    this._addAll(this._eightBytesAsList, 0, 4);
  }
  putUint8List(list: Uint8Array): void {
    this.assertWritable();
    this._append(list);
  }
  putInt32List(list: Int32Array): void {
    this.assertWritable();
    this._alignTo(4);
    this._append(new Uint8Array(list.buffer, list.byteOffset, list.byteLength));
  }
  putInt64List(list: BigInt64Array): void {
    this.assertWritable();
    this._alignTo(8);
    this._append(new Uint8Array(list.buffer, list.byteOffset, list.byteLength));
  }
  putFloat32List(list: Float32Array): void {
    this.assertWritable();
    this._alignTo(4);
    this._append(new Uint8Array(list.buffer, list.byteOffset, list.byteLength));
  }
  putFloat64List(list: Float64Array): void {
    this.assertWritable();
    this._alignTo(8);
    this._append(new Uint8Array(list.buffer, list.byteOffset, list.byteLength));
  }
  private _alignTo(alignment: number): void {
    this.assertWritable();
    const mod = this._currentSize % alignment;
    if (mod !== 0) this._addAll(WriteBuffer._zeroBuffer, 0, alignment - mod);
  }
  done(): DataView {
    if (this._isDone)
      throw new StateError('done() must not be called more than once on the same WriteBuffer.');
    const result = new DataView(this._buffer.buffer, 0, this._currentSize);
    this._buffer = new Uint8Array(0);
    this._isDone = true;
    return result;
  }
}
/** Sequential reader. Typed-list reads intentionally share the underlying buffer. */
export class ReadBuffer {
  private _position = 0;
  constructor(readonly data: DataView) {}
  get hasRemaining(): boolean {
    return this._position < this.data.byteLength;
  }
  getUint8(): number {
    return this.data.getUint8(this._position++);
  }
  getUint16({ endian }: { readonly endian?: Endian | null } = {}): number {
    const value = this.data.getUint16(this._position, little(endian));
    this._position += 2;
    return value;
  }
  getUint32({ endian }: { readonly endian?: Endian | null } = {}): number {
    const value = this.data.getUint32(this._position, little(endian));
    this._position += 4;
    return value;
  }
  getInt32({ endian }: { readonly endian?: Endian | null } = {}): number {
    const value = this.data.getInt32(this._position, little(endian));
    this._position += 4;
    return value;
  }
  getInt64({ endian }: { readonly endian?: Endian | null } = {}): bigint {
    const value = this.data.getBigInt64(this._position, little(endian));
    this._position += 8;
    return value;
  }
  getFloat64({ endian }: { readonly endian?: Endian | null } = {}): number {
    this._alignTo(8);
    const value = this.data.getFloat64(this._position, little(endian));
    this._position += 8;
    return value;
  }
  /** Four-byte host extension corresponding to WriteBuffer.putFloat32. */
  getFloat32({ endian }: { readonly endian?: Endian | null } = {}): number {
    this._alignTo(4);
    const value = this.data.getFloat32(this._position, little(endian));
    this._position += 4;
    return value;
  }
  getUint8List(count: number): Uint8Array {
    const value = new Uint8Array(
      this.data.buffer,
      this.data.byteOffset + this._position,
      length(count),
    );
    this._position += count;
    return value;
  }
  getInt32List(count: number): Int32Array {
    this._alignTo(4);
    const value = new Int32Array(
      this.data.buffer,
      this.data.byteOffset + this._position,
      length(count),
    );
    this._position += 4 * count;
    return value;
  }
  getInt64List(count: number): BigInt64Array {
    this._alignTo(8);
    const value = new BigInt64Array(
      this.data.buffer,
      this.data.byteOffset + this._position,
      length(count),
    );
    this._position += 8 * count;
    return value;
  }
  getFloat32List(count: number): Float32Array {
    this._alignTo(4);
    const value = new Float32Array(
      this.data.buffer,
      this.data.byteOffset + this._position,
      length(count),
    );
    this._position += 4 * count;
    return value;
  }
  getFloat64List(count: number): Float64Array {
    this._alignTo(8);
    const value = new Float64Array(
      this.data.buffer,
      this.data.byteOffset + this._position,
      length(count),
    );
    this._position += 8 * count;
    return value;
  }
  private _alignTo(alignment: number): void {
    const mod = this._position % alignment;
    if (mod !== 0) this._position += alignment - mod;
  }
}
