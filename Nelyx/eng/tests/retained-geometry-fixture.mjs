// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { execute } from '../../sdk/tooling/cli/src/commands.mjs';
import { windowsCompilerEnvironment } from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
export const timeout = 1_200_000;
export async function withRetainedGeometryHarness(work) {
  const parent = fs.realpathSync(os.tmpdir()),
    directory = fs.mkdtempSync(path.join(parent, 'nelyx-retained-geometry-')),
    executable = path.join(directory, 'geometry.exe'),
    env = windowsCompilerEnvironment(),
    root = path.resolve(import.meta.dirname, '../../..');
  try {
    await execute(
      'cl.exe',
      [
        '/nologo',
        '/std:c++20',
        '/O2',
        '/MD',
        '/EHsc',
        '/fp:strict',
        '/I' + path.join(root, 'Nelyx/skia/native/core'),
        path.join(import.meta.dirname, 'input-geometry-native.cpp'),
        path.join(root, 'Nelyx/skia/native/core/input_geometry.cpp'),
        '/Fe' + executable,
      ],
      { cwd: directory, env, timeout },
    );
    // Replay this one bounded operation history through the ACTUAL C++ session.
    // spawnSync makes the transport compatible with synchronous JSI semantics.
    await work((generation = 7) => {
      const history = [];
      return (operation, packet = new Float64Array()) => {
        assert(history.length < 128, 'Fixture transaction bound');
        const header = Buffer.alloc(8);
        header.writeUInt32LE(operation);
        header.writeUInt32LE(packet.length, 4);
        history.push(
          Buffer.concat([header, Buffer.from(packet.buffer, packet.byteOffset, packet.byteLength)]),
        );
        const result = spawnSync(executable, [String(generation)], {
          cwd: directory,
          env,
          timeout,
          input: Buffer.concat(history),
          maxBuffer: 16 * 1024 * 1024,
        });
        if (result.error) throw result.error;
        assert.equal(result.status, 0, result.stderr?.toString());
        let at = 0,
          output;
        for (let index = 0; index < history.length; index++) {
          const count = result.stdout.readUInt32LE(at);
          at += 4;
          output = new Float64Array(
            Uint8Array.from(result.stdout.subarray(at, at + count * 8)).buffer,
          );
          at += count * 8;
        }
        assert.equal(at, result.stdout.length);
        return output;
      };
    });
  } finally {
    assert.equal(path.dirname(fs.realpathSync(directory)), parent);
    assert(
      path.basename(directory).startsWith('nelyx-retained-geometry-') &&
        !fs.lstatSync(directory).isSymbolicLink(),
    );
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}
export function retainedGeometryApi(createTransport, generation) {
  const sessions = [];
  return {
    sessions,
    nelyxRetainedInputGeometryVersion: () => 1,
    nelyxReportInputGeometryStatus() {},
    nelyxRetainedInputGeometrySession(session) {
      const run = createTransport(generation),
        info = { calls: 0, closed: false, packets: [] };
      sessions.push(info);
      const operation = (op, packet) => {
        const result = run(op, packet);
        if (!result.length) throw Error('Actual C++ rejected retained geometry transaction');
        return result;
      };
      return {
        prepare(buffer) {
          assert(++info.calls <= 30, 'Bounded native preparation count');
          const packet = new Float64Array(buffer).slice();
          info.packets.push(packet.slice());
          packet[2] = 1;
          const result = operation(3, packet);
          result[2] = session;
          return result.buffer;
        },
        commit: (revision) => {
          operation(4, Float64Array.of(revision));
        },
        discard: (revision) => {
          operation(5, Float64Array.of(revision));
        },
        stats: () => operation(6).buffer,
        close() {
          operation(7);
          info.closed = true;
        },
      };
    },
  };
}
