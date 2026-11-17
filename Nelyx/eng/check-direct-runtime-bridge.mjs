// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { transform } from 'esbuild';

const timer = setTimeout(() => {
  throw Error('Direct runtime bridge checks exceeded 20 minutes');
}, 1_200_000);
try {
  const source = fs.readFileSync(
    new URL('../sdk/src/backends/native-hermes/bridge.ts', import.meta.url),
    'utf8',
  );
  const compiled = await transform(source, { loader: 'ts', format: 'cjs', target: 'es2022' });
  const module = { exports: {} },
    context = vm.createContext({ module, exports: module.exports });
  vm.runInContext(compiled.code, context, { timeout: 1_200_000 });
  const read = module.exports.nativeHermesBridge;
  const legacy = {
    abi: 2,
    frameClockVersion: 2,
    mode: 'bytecode',
    assetRoot: 'owned-assets',
    capabilities: { vm: 1, services: 1, editing: 1, semantics: 1 },
  };
  for (const method of [
    'now',
    'metrics',
    'listen',
    'publishSemantics',
    'editor',
    'environment',
    'service',
    'requestClose',
    'pressedKeys',
    'setTimer',
    'clearTimer',
    'requestFrame',
    'cancelFrame',
    'queueMicrotask',
    'completeShutdown',
    'fail',
    'log',
  ])
    legacy[method] = () => {};
  const interpreter = {
    ...legacy,
    engine: 'jsc',
    mode: 'source',
    executionMode: 'interpreter',
    trackRejections() {},
  };
  for (const value of [
    legacy,
    { ...legacy, engine: 'hermes' },
    { ...legacy, mode: 'static-aot' },
    interpreter,
    { ...interpreter, executionMode: 'jit' },
  ]) {
    context.NelyxNativeHost = value;
    assert.equal(read(), value);
  }
  for (const value of [
    undefined,
    { ...legacy, mode: 'source' },
    { ...legacy, engine: 'v8' },
    { ...interpreter, mode: 'bytecode' },
    { ...interpreter, executionMode: undefined },
    { ...interpreter, trackRejections: undefined },
    { ...interpreter, executionMode: 'unknown' },
    { ...interpreter, capabilities: { ...interpreter.capabilities, semantics: 0 } },
    { ...interpreter, queueMicrotask: undefined },
  ]) {
    context.NelyxNativeHost = value;
    assert.throws(read, /Direct native host ABI|Missing direct native/);
  }
  console.log(
    'DIRECT_RUNTIME_BRIDGE_PASS legacy Hermes and explicit JSC modes; malformed VM, tracker, capabilities and ports rejected',
  );
} finally {
  clearTimeout(timer);
}
