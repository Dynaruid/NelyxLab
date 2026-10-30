// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import { sha256 } from './files.mjs';
export function nativeImageDebugIdentity(file) {
  const bytes = fs.readFileSync(file),
    pe = bytes.readUInt32LE(0x3c);
  if (bytes.toString('ascii', pe, pe + 4) !== 'PE\0\0')
    throw Error('Native PC map requires a PE image');
  const count = bytes.readUInt16LE(pe + 6),
    size = bytes.readUInt16LE(pe + 20),
    optional = pe + 24;
  if (bytes.readUInt16LE(optional) !== 0x20b) throw Error('Native PC map requires PE32+');
  const sections = Array.from({ length: count }, (_, index) => {
    const at = optional + size + index * 40;
    return {
      rva: bytes.readUInt32LE(at + 12),
      size: Math.max(bytes.readUInt32LE(at + 8), bytes.readUInt32LE(at + 16)),
      raw: bytes.readUInt32LE(at + 20),
      executable: !!(bytes.readUInt32LE(at + 36) & 0x20000000),
    };
  });
  const raw = (rva) => {
    const section = sections.find(
      (section) => rva >= section.rva && rva < section.rva + section.size,
    );
    if (!section) throw Error('Native debug RVA outside image');
    return section.raw + rva - section.rva;
  };
  const directory = optional + 112 + 6 * 8,
    start = raw(bytes.readUInt32LE(directory)),
    length = bytes.readUInt32LE(directory + 4);
  let debug;
  for (let offset = start; offset < start + length; offset += 28)
    if (bytes.readUInt32LE(offset + 12) === 2) {
      const at = bytes.readUInt32LE(offset + 24);
      if (bytes.toString('ascii', at, at + 4) === 'RSDS') {
        const hex = bytes.subarray(at + 4, at + 20).toString('hex'),
          reverse = (value) => value.match(/../g).reverse().join('');
        debug = {
          guid: [
            reverse(hex.slice(0, 8)),
            reverse(hex.slice(8, 12)),
            reverse(hex.slice(12, 16)),
            hex.slice(16, 20),
            hex.slice(20),
          ]
            .join('-')
            .toUpperCase(),
          age: bytes.readUInt32LE(at + 20),
        };
      }
    }
  if (!debug) throw Error('Native CodeView identity missing');
  return { ...debug, sections };
}
/** PDB is build-owned temporary input. Only image-bound function ranges ship. */
export async function readNativePcMap(library, pdb, units, { env, signal } = {}) {
  signal?.throwIfAborted();
  const debug = nativeImageDebugIdentity(library),
    tool = path.join(process.env.ProgramFiles, 'LLVM/bin/llvm-pdbutil.exe');
  const child = spawn(tool, ['dump', '--summary', '--modules', '--symbols', pdb], {
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    signal,
  });
  let errorOutput = '',
    expired = false;
  child.stderr.on('data', (chunk) => {
    errorOutput = (errorOutput + chunk).slice(-65536);
  });
  const completed = new Promise((resolve) => {
    child.once('error', (error) => resolve({ error }));
    child.once('close', (code) => resolve({ code }));
  });
  const stop = () => child.kill(),
    timer = setTimeout(() => {
      expired = true;
      stop();
    }, 1_200_000);
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  const owners = new Map(
      units.map((unit) => [
        unit.unit,
        new Map(unit.nativeFunctions?.functions.map((fn) => [fn.symbol, fn]) ?? []),
      ]),
    ),
    functions = [];
  let unit = null,
    pending = null;
  let guid,
    age,
    bytes = 0;
  const input = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
  try {
    for await (const line of input) {
      bytes += Buffer.byteLength(line) + 1;
      if (bytes > 1024 ** 3) throw Error('Native PDB evidence byte bound exceeded');
      const guidLine = /^\s*GUID: \{([^}]+)\}/.exec(line),
        ageLine = /^\s*Age: (\d+)/.exec(line);
      if (guidLine) guid = guidLine[1];
      if (ageLine) age = Number(ageLine[1]);
      const module = /^\s*Mod \d+ \| `([^`]+)`/.exec(line);
      if (module) {
        const name = path.basename(module[1], '.obj');
        unit = owners.has(name) ? name : null;
        pending = null;
        continue;
      }
      const symbol = /\bS_[LG]PROC32(?:_ID)? \[.*?`([^`]+)`/.exec(line);
      if (symbol) {
        pending = unit && owners.get(unit).has(symbol[1]) ? symbol[1] : null;
        continue;
      }
      if (pending) {
        const address = /addr = (\d+):(\d+), code size = (\d+)/.exec(line);
        if (address) {
          const section = debug.sections[Number(address[1]) - 1],
            offset = Number(address[2]),
            size = Number(address[3]);
          if (!section?.executable || offset + size > section.size || !size)
            throw Error('Native function outside executable section');
          const source = owners.get(unit).get(pending);
          functions.push({
            unit,
            symbol: pending,
            rva: section.rva + offset,
            size,
            position: source.position,
            sourceRange: source.sourceRange ?? null,
          });
          pending = null;
        }
      }
    }
    const result = await completed;
    if (expired || result.error || result.code !== 0)
      throw Error('Native PDB inspection failed: ' + String(result.error ?? errorOutput));
  } finally {
    clearTimeout(timer);
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
    input.close();
    if (child.exitCode === null) stop();
    await completed;
  }
  if (guid !== debug.guid || age !== debug.age)
    throw Error('Native image/PDB debug identity differs');
  if (!functions.length) throw Error('Native PDB has no owned SH function ranges');
  return {
    schema: 'nelyx.native-pc-map/v1',
    imageSha256: sha256(library),
    debug: { guid, age },
    pdbSha256: sha256(pdb),
    precision: 'function-range',
    functions: functions.sort(
      (a, b) => a.rva - b.rva || a.unit.localeCompare(b.unit) || a.symbol.localeCompare(b.symbol),
    ),
  };
}
export function symbolizeNativePc(map, rva) {
  if (map.schema !== 'nelyx.native-pc-map/v1' || !Number.isSafeInteger(rva) || rva < 0)
    throw Error('Invalid native PC query');
  return map.functions.filter((fn) => rva >= fn.rva && rva < fn.rva + fn.size);
}
