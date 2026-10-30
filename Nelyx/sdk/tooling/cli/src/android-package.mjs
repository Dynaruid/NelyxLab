// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import { inflateRawSync } from 'node:zlib';
/** Read the owning APK's central directory and Hermes payload, without a host zip tool. */
export function inspectAndroidApk(file, { architecture, bytecodeVersion }) {
  const bytes = fs.readFileSync(file);
  let end = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); --index)
    if (
      bytes.readUInt32LE(index) === 0x06054b50 &&
      index + 22 + bytes.readUInt16LE(index + 20) === bytes.length
    ) {
      end = index;
      break;
    }
  if (end < 0 || bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6))
    throw new Error('Invalid or split APK ZIP');
  const count = bytes.readUInt16LE(end + 10),
    offset = bytes.readUInt32LE(end + 16),
    size = bytes.readUInt32LE(end + 12);
  if (count === 65535 || offset + size > end) throw new Error('Unsupported APK ZIP64 or directory');
  const entries = new Map();
  let cursor = offset;
  for (let index = 0; index < count; ++index) {
    if (cursor + 46 > offset + size || bytes.readUInt32LE(cursor) !== 0x02014b50)
      throw new Error('Invalid APK central directory');
    const flags = bytes.readUInt16LE(cursor + 8),
      method = bytes.readUInt16LE(cursor + 10),
      compressed = bytes.readUInt32LE(cursor + 20),
      uncompressed = bytes.readUInt32LE(cursor + 24),
      length = bytes.readUInt16LE(cursor + 28),
      extra = bytes.readUInt16LE(cursor + 30),
      comment = bytes.readUInt16LE(cursor + 32),
      local = bytes.readUInt32LE(cursor + 42),
      name = bytes.subarray(cursor + 46, cursor + 46 + length).toString('utf8');
    if (
      flags & 1 ||
      !name ||
      name.startsWith('/') ||
      name.includes('\\') ||
      name.split('/').some((part) => part === '..') ||
      entries.has(name)
    )
      throw new Error('Invalid or duplicate APK entry');
    entries.set(name, { flags, method, compressed, uncompressed, local });
    cursor += 46 + length + extra + comment;
  }
  if (
    cursor !== offset + size ||
    !['arm64-v8a', 'x86_64'].includes(architecture) ||
    !Number.isSafeInteger(bytecodeVersion)
  )
    throw new Error('Invalid APK architecture or directory size');
  function read(name, limit) {
    const entry = entries.get(name);
    if (
      !entry ||
      entry.uncompressed > limit ||
      entry.local + 30 > bytes.length ||
      bytes.readUInt32LE(entry.local) !== 0x04034b50
    )
      throw new Error('APK entry absent or too large');
    const length = bytes.readUInt16LE(entry.local + 26),
      start = entry.local + 30 + length + bytes.readUInt16LE(entry.local + 28);
    if (
      start + entry.compressed > offset ||
      bytes.subarray(entry.local + 30, entry.local + 30 + length).toString('utf8') !== name
    )
      throw new Error('APK entry range/name invalid');
    const data = bytes.subarray(start, start + entry.compressed),
      result =
        entry.method === 0
          ? data
          : entry.method === 8
            ? inflateRawSync(data, { maxOutputLength: limit })
            : null;
    if (!result || result.length !== entry.uncompressed)
      throw new Error('APK entry size/compression invalid');
    return result;
  }
  const libraries = [...entries.keys()].filter(
    (name) => name.startsWith('lib/') && name.endsWith('.so'),
  );
  if (
    !libraries.length ||
    libraries.some((name) => name.split('/')[1] !== architecture) ||
    !['libhermesvm.so', 'libreactnative.so'].every((name) =>
      libraries.includes('lib/' + architecture + '/' + name),
    )
  )
    throw new Error('APK native architecture/Hermes library mismatch');
  for (const name of libraries) {
    const elf = read(name, 512 * 1024 * 1024);
    if (
      elf.length < 64 ||
      elf.readUInt32LE(0) !== 0x464c457f ||
      elf[4] !== 2 ||
      elf[5] !== 1 ||
      elf.readUInt16LE(18) !== (architecture === 'x86_64' ? 62 : 183)
    )
      throw new Error('APK native ELF ABI differs from its architecture');
  }
  const entry = entries.get('assets/index.android.bundle'),
    bundle = read('assets/index.android.bundle', 128 * 1024 * 1024);
  if (
    !bundle ||
    bundle.length !== entry.uncompressed ||
    bundle.length < 12 ||
    bundle.readBigUInt64LE(0) !== 0x1f1903c103bc1fc6n ||
    bundle.readUInt32LE(8) !== bytecodeVersion
  )
    throw new Error('APK Hermes bytecode differs from the owning native cohort');
  return {
    entries: entries.size,
    nativeLibraries: libraries.length,
    architecture,
    bytecodeVersion,
  };
}
