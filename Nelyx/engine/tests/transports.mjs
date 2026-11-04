// SPDX-License-Identifier: BSD-3-Clause
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createWasmTransport } from '../../runtime/engine-client/wasm.ts';

export async function wasmFactory(directory) {
  const { default: createModule } = await import(
    pathToFileURL(path.join(directory, 'engine.mjs')).href
  );
  const module = await createModule();
  return { module, create: () => createWasmTransport(module) };
}
export function nativeTransport(directory) {
  const child = spawn(
    path.join(directory, 'nelyx_engine_driver' + (process.platform === 'win32' ? '.exe' : '')),
    [],
    { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
  );
  let output = Buffer.alloc(0),
    failure,
    stderr = '';
  const pending = [];
  const fail = (error) => {
    failure = error;
    for (const p of pending.splice(0)) p.reject(error);
  };
  child.on('error', fail);
  child.stderr.on('data', (bytes) => {
    stderr = (stderr + bytes.toString()).slice(-8192);
  });
  child.on('exit', (code) => {
    if (code || pending.length) fail(new Error(`Native engine exited ${code}: ${stderr}`));
  });
  child.stdout.on('data', (bytes) => {
    output = Buffer.concat([output, bytes]);
    while (output.length >= 4 && output.length >= 4 + output.readUInt32LE()) {
      const length = output.readUInt32LE();
      const request = pending.shift();
      if (!request || length > 1_048_576) {
        fail(new Error('Invalid native engine framing'));
        child.kill();
        return;
      }
      request.resolve(new Uint8Array(output.subarray(4, 4 + length)));
      output = output.subarray(4 + length);
    }
  });
  return {
    exchange(bytes) {
      if (failure) return Promise.reject(failure);
      if (pending.length >= 32) return Promise.reject(new Error('Native test port queue full'));
      return new Promise((resolve, reject) => {
        pending.push({ resolve, reject });
        const prefix = Buffer.alloc(4);
        prefix.writeUInt32LE(bytes.length);
        child.stdin.write(prefix);
        child.stdin.write(bytes);
      });
    },
    async close() {
      if (child.exitCode !== null || child.killed) return;
      child.stdin.end();
      const timer = setTimeout(() => child.kill(), 2000);
      try {
        await once(child, 'exit');
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
