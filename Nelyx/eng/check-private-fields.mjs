// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import { privateFieldFixture } from './private-field-fixture.mjs';
import { windowsHermesSyntax } from '../sdk/tooling/cli/src/windows-hermes-policy.mjs';
import { windowsHermesSyntaxPolicy } from '../sdk/tooling/cli/src/windows-hermes-syntax.mjs';
import { windowsNativeHermesCohort } from '@nelyx/sdk/runtime/cohorts';

const watchdog = setTimeout(() => {
  throw Error('Private member checks exceeded 20 minutes');
}, 1_200_000);
try {
  const fixture = privateFieldFixture();
  let expected;
  for (const [name, supported] of [
    ['source', undefined],
    ['lowered', windowsHermesSyntax],
    ['native', windowsHermesSyntaxPolicy(windowsNativeHermesCohort()).supported],
  ]) {
    const code = supported ? transformSync(fixture, { target: 'es2015', supported }).code : fixture;
    const context = vm.createContext({ nativeFields: name !== 'lowered' });
    vm.runInContext(code, context, { timeout: 1_200_000 });
    assert.equal(await context.privateFieldPending, 37);
    const result = JSON.parse(JSON.stringify(context.privateFieldResult));
    if (expected) assert.deepEqual(result, expected, name);
    else expected = result;
    if (name === 'native') {
      // A class with lowered methods/accessors/static fields keeps esbuild's
      // whole-class lowering. A field-only class must use its own private slots.
      const first = code.indexOf('class FieldOnly'),
        end = code.indexOf('const fieldOnly =');
      assert(first >= 0 && end > first);
      assert(!/__private(?:Get|Set|Method)\(this,/.test(code.slice(first, end)));
      assert(/#value|#token/.test(code));
    }
  }
  assert.equal(windowsHermesSyntax['class-private-field'], undefined);
  console.log(
    'Private members: source/lowered/native data, reflection, freeze, Proxy, brand, methods/accessors, inheritance, initialization/error order, factory isolation, stamping, new.target, static interaction and async/generator checks PASS.',
    expected,
  );
} catch (error) {
  console.error(String(error.message ?? error).slice(0, 1800));
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
}
