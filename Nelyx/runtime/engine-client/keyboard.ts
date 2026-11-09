// SPDX-License-Identifier: BSD-3-Clause
import { protocol as p } from './schema.ts';
import { encodeUtf8, decodeUtf8 } from './utf8.ts';

/** Copied host observations. Core admits their publication; Source owns key policy. */
export interface KeyIdentity {
  readonly key: string;
  readonly code: string;
  readonly location: number;
}
export function keyIdentityText(value: string): Uint8Array {
  if (typeof value !== 'string') throw Error('Invalid keyboard identity text');
  const bytes = encodeUtf8(value);
  if (
    !bytes.length ||
    bytes.length > p.keyIdentityTextBytes ||
    value.includes('\0') ||
    decodeUtf8(bytes) !== value
  )
    throw Error('Invalid keyboard identity text');
  return bytes;
}
export function keyIdentityLocation(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 3)
    throw Error('Invalid keyboard identity location');
  return value;
}
export function readKeyIdentity(bytes: Uint8Array, header: number, offset: number): KeyIdentity {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < header) throw Error('Truncated keyboard identity');
  const keyLength = view.getUint32(offset, true),
    codeLength = view.getUint32(offset + 4, true),
    location = keyIdentityLocation(view.getUint32(offset + 8, true));
  if (
    !keyLength ||
    !codeLength ||
    keyLength > p.keyIdentityTextBytes ||
    codeLength > p.keyIdentityTextBytes ||
    header + Math.ceil((keyLength + codeLength) / 8) * 8 !== bytes.length
  )
    throw Error('Invalid keyboard identity size');
  const key = decodeUtf8(bytes.subarray(header, header + keyLength)),
    code = decodeUtf8(bytes.subarray(header + keyLength, header + keyLength + codeLength));
  keyIdentityText(key);
  keyIdentityText(code);
  for (let index = header + keyLength + codeLength; index < bytes.length; ++index)
    if (bytes[index]) throw Error('Invalid keyboard identity padding');
  return Object.freeze({ key, code, location });
}
