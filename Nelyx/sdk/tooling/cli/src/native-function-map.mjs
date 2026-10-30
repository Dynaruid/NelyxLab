// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { createHash } from 'node:crypto';

/** Read the pinned SH backend's actual function definitions, not prototypes.
 * C and object intermediates stay with their one owning build and are removed.
 * Hermes columns count UTF-8 bytes; public source offsets count UTF-16 units. */
export async function readNativeFunctionMap(file, source, unit) {
  if (fs.statSync(file).size > 512 * 1024 ** 2)
    throw Error('Native C evidence byte bound exceeded');
  const text = fs.readFileSync(source, 'utf8'),
    lines = text.split('\n'),
    starts = [0];
  for (let i = 0; i < lines.length - 1; i++) starts.push(starts[i] + lines[i].length + 1);
  const functions = [],
    names = new Set(),
    digest = createHash('sha256');
  const stream = fs.createReadStream(file);
  stream.on('data', (chunk) => digest.update(chunk));
  const input = readline.createInterface({ input: stream, crlfDelay: Infinity });
  const coordinate = (value) => {
    const location = /^(.+):(\d+):(\d+)$/.exec(value);
    if (!location) return null;
    if (path.resolve(location[1]) !== path.resolve(source))
      throw Error('Native source owner differs: ' + location[1]);
    const row = Number(location[2]),
      column = Number(location[3]);
    if (row < 1 || row > lines.length || column < 1)
      throw Error('Native function location outside input');
    const bytes = Buffer.from(lines[row - 1]);
    if (
      column > bytes.length + 1 ||
      (column <= bytes.length && (bytes[column - 1] & 0xc0) === 0x80)
    )
      throw Error('Native UTF-8 column outside a character boundary');
    const position = {
      line: row,
      column: bytes.subarray(0, column - 1).toString('utf8').length + 1,
    };
    position.offset = starts[row - 1] + position.column - 1;
    return position;
  };
  let previous = '',
    range = null;
  try {
    for await (const line of input) {
      if (line.startsWith('// Nelyx SH range: ')) {
        const parts = line.slice('// Nelyx SH range: '.length).split(' ... ');
        if (parts.length !== 2) throw Error('Native source range marker differs');
        const start = coordinate(parts[0]),
          end = coordinate(parts[1]);
        range = start && end ? { start, end } : null;
      }
      const definition = /^static SHLegacyValue (\w+)\(SHRuntime \*shr\) \{$/.exec(line);
      if (definition) {
        if (functions.length >= 200_000 || names.has(definition[1]))
          throw Error('Native function identity bound/duplicate');
        names.add(definition[1]);
        const position = coordinate(previous.slice(3));
        if (!position && previous !== '// none:0,0')
          throw Error('Pinned SH function source marker differs');
        functions.push({
          symbol: definition[1],
          position,
          ...(range ? { sourceRange: range } : {}),
        });
        range = null;
      }
      previous = line;
    }
  } finally {
    input.close();
    stream.destroy();
  }
  if (!functions.length) throw Error('Native compiler emitted no function definitions');
  return { schema: 'nelyx.sh-native-functions/v1', unit, cSha256: digest.digest('hex'), functions };
}
