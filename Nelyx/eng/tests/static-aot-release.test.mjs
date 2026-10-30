// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { inventoryBody } from '../../sdk/tooling/static-aot/src/runtime-inventory.mjs';
const timeout = 1_200_000,
  releaseDefines = { __DEV__: false, NODE_ENV: 'production' };
test(
  'only qualified release constants can discharge bodies removed by the frontend',
  { timeout },
  () => {
    const source = `if(__DEV__){function debugOnly(){return 1;}}else{function live(){return 2;}} if(process.env.NODE_ENV!=='production'){const hidden=()=>3;} if(typeof null==='object'){function alsoLive(){return 4;}} __DEV__&&(()=>5)();`;
    const bodies = inventoryBody(source, { filename: 'runtime.js', releaseDefines }).bodies;
    for (const name of ['debugOnly', 'hidden']) {
      const body = bodies.find(
        (body) => body.name === name || (name === 'hidden' && body.name === '<closure>'),
      );
      assert.equal(body.frontendDisposition?.kind, 'proven-dead');
      assert(body.frontendDisposition.condition.sourceSha256);
    }
    assert(!bodies.find((body) => body.name === 'live').frontendDisposition);
    assert(!bodies.find((body) => body.name === 'alsoLive').frontendDisposition);
    const plain = inventoryBody(source, { filename: 'runtime.js' }).bodies;
    assert(!plain.find((body) => body.name === 'debugOnly').frontendDisposition);
    for (const shadow of [
      'function scope(__DEV__){if(__DEV__){function observed(){}}}',
      'const scope=function __DEV__(){if(__DEV__){function observed(){}}};',
      'class __DEV__{};if(__DEV__){function observed(){}}',
      'import __DEV__ from "flag";if(__DEV__){function observed(){}}',
    ]) {
      const observed = inventoryBody(shadow, {
        filename: 'runtime.js',
        releaseDefines,
      }).bodies.find((body) => body.name === 'observed');
      assert(observed);
      assert(
        !observed.frontendDisposition,
        'A shadowed runtime binding cannot be treated as a build define',
      );
    }
  },
);
