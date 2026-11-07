// SPDX-License-Identifier: BSD-3-Clause
import { encodeUtf8 } from './utf8.ts';
/** Bounded portable caller headers. Validation precedes either Native WinHTTP
 * or browser fetch; a record cannot turn one value into injected header lines. */
export function httpHeaders(
  headers: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  const entries = Object.entries(headers),
    result = Object.create(null) as Record<string, string>,
    names = new Set<string>();
  let size = 0;
  if (entries.length > 32) throw Error('Network image header count exceeded');
  for (const [name, value] of entries) {
    if (
      !/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(name) ||
      typeof value !== 'string' ||
      names.has(name.toLowerCase())
    )
      throw Error('Invalid network image header');
    for (let i = 0; i < value.length; ++i) {
      const code = value.charCodeAt(i);
      if ((code < 32 && code !== 9) || code === 127)
        throw Error('Invalid network image header value');
    }
    names.add(name.toLowerCase());
    size += encodeUtf8(name, 4096).length + encodeUtf8(value, 4096).length + 4;
    if (size > 16384) throw Error('Network image header byte budget exceeded');
    result[name] = value;
  }
  return Object.freeze(result);
}
