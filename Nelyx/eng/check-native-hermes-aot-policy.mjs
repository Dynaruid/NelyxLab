import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';
import { windowsHermesPolicy } from '../sdk/tooling/cli/src/windows-hermes-policy.mjs';
import { windowsNativeAotPolicy } from '../sdk/tooling/cli/src/windows-native-aot-policy.mjs';
import { windowsTypedHermesPolicy } from '../sdk/tooling/cli/src/windows-typed-hermes-policy.mjs';
import { windowsNativeHermesCohort } from '@nelyx/sdk/runtime/cohorts';

const root = path.resolve(import.meta.dirname, '../..');
if (!process.argv.includes('--child')) {
  await execute(
    'pwsh.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "& node '" + import.meta.filename.replaceAll("'", "''") + "' --child",
    ],
    { cwd: root, timeout: 1_200_000 },
  );
} else {
  const { verifyNativeHermes } =
    await import('../sdk/tooling/cli/src/windows-native-hermes-toolchain.mjs');
  const { windowsCompilerEnvironment } =
    await import('../sdk/tooling/cli/src/windows-static-hermes.mjs');
  const { readNativeFunctionMap } = await import('../sdk/tooling/cli/src/native-function-map.mjs');
  const cohort = windowsNativeHermesCohort(),
    ordinary = windowsHermesPolicy('optimized', cohort),
    native = windowsNativeAotPolicy(cohort),
    typed = windowsTypedHermesPolicy(cohort);
  assert.deepEqual(ordinary.flags, ['-O'], 'Native audit policy changed ordinary bytecode');
  assert.deepEqual(native.flags, ['-O']);
  assert.deepEqual(typed.flags, ['-typed', '-parse-ts', ...native.flags]);
  const checked = verifyNativeHermes(path.join(root, '.nelyx/windows-hermes')),
    env = windowsCompilerEnvironment(),
    parent = path.join(root, '.tmp'),
    folder = fs.mkdtempSync(path.join(parent, 'native-aot-policy-'));
  try {
    const source = path.join(folder, 'typed.ts');
    // Match the partition emitter's kernel -> counted boundary -> global ABI.
    const sourceText =
      'function kernel0(receiver,environment,value:number):number{return value*2+1;}\n' +
      'let calls0:number=0;\n' +
      'function boundary0(receiver,environment,value):number{calls0++;return kernel0(receiver,environment,value);}\n' +
      'globalThis["test_kernel"]=boundary0;\n' +
      'function count0():number{return calls0;}\nglobalThis["test_count"]=count0;\n';
    fs.writeFileSync(source, sourceText);
    for (const [name, flags, expected, input] of [
      ['ordinary', ['-typed', '-parse-ts', ...ordinary.flags], 0, sourceText],
      ['audited', typed.flags, 1, sourceText.replace('{return value', '{"noinline";return value')],
    ]) {
      fs.writeFileSync(source, input);
      const output = path.join(folder, name + '.c');
      await execute(
        path.join(checked.directory, 'build/bin/shermes.exe'),
        [
          ...flags,
          '-sm-comment=off',
          '-emit-c',
          '-exported-unit=nelyx_typed',
          '-o',
          output,
          source,
        ],
        { cwd: root, env, timeout: 1_200_000 },
      );
      const mapping = await readNativeFunctionMap(output, source, 'nelyx_typed'),
        kernels = mapping.functions.filter((fn) => /^_\d+_kernel0$/.test(fn.symbol));
      assert.equal(kernels.length, expected, 'Compiler/audit kernel correspondence differs');
      if (expected) {
        const range = kernels[0].sourceRange;
        assert.ok(range, 'Retained kernel lacks source range evidence');
        assert.ok(
          range.start.offset <= input.indexOf('return') &&
            range.end.offset > input.indexOf('return'),
        );
      }
      console.log('NATIVE_AOT_POLICY ' + JSON.stringify({ name, kernels: kernels.length }));
    }
  } finally {
    /* oxlint-disable no-unsafe-finally -- Preserve a changed fixture owner instead of deleting it. */
    if (path.dirname(folder) !== parent || fs.lstatSync(folder).isSymbolicLink())
      throw Error('Native AOT fixture cleanup owner differs');
    /* oxlint-enable no-unsafe-finally */
    fs.rmSync(folder, { recursive: true, force: true });
  }
}
