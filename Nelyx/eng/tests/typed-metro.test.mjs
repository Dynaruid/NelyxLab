// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const load = createRequire(import.meta.url),
  transformer = load('../../sdk/tooling/metro/src/native-typed-transformer.cjs'),
  timeout = 1_200_000;
test(
  'typed Metro replaces only selected bodies before RN class lowering and rejects stale or missing selections',
  { timeout },
  async () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-typed-adapter-'));
    try {
      const filename = path.join(folder, 'body.js'),
        src = 'export class C { value(x) { return x*x; } other() { return this; } }',
        plan = path.join(folder, 'plan.json');
      const binding = {
        id: 'fixture#C.value',
        name: 'value',
        className: 'C',
        globalName: '__checked',
        adapter: 'return globalThis.__checked(this,null,x);',
      };
      const write = (
        bindings = [binding],
        sha256 = createHash('sha256').update(src).digest('hex'),
      ) =>
        fs.writeFileSync(
          plan,
          JSON.stringify({
            schema: 'nelyx.typed-metro-plan/v1',
            files: [{ file: filename, sha256, bindings, consumed: 'consumed-0.json' }],
          }),
        );
      write();
      const options = {
        platform: 'windows',
        dev: false,
        projectRoot: path.resolve(
          import.meta.dirname,
          '../../../sample/nelyx-testbed-app-2/windows/runner',
        ),
        enableBabelRCLookup: true,
        experimentalImportSupport: false,
        customTransformOptions: { nelyxTypedPlan: plan },
      };
      const transform = (inputFile = filename) =>
        transformer.transform({
          src,
          filename: inputFile,
          options: {
            ...options,
            customTransformOptions: {
              nelyxTypedPlan: fs.readFileSync(plan, 'utf8'),
              nelyxTypedPlanSha256: createHash('sha256')
                .update(fs.readFileSync(plan))
                .digest('hex'),
            },
          },
        });
      const { result, evidence } = await transformer.withEvidence(() => transform());
      const code = load('@babel/core').transformFromAstSync(result.ast, src, {
        configFile: false,
        babelrc: false,
      }).code;
      assert.match(code, /__checked/);
      assert.match(code, /other/);
      assert.doesNotMatch(code, /return x \* x/);
      assert.equal(evidence.consumed.bindings[0], binding.id);
      assert.equal(
        evidence.elimination.sourceSha256,
        createHash('sha256').update(src).digest('hex'),
      );
      assert.deepEqual(fs.readdirSync(folder), ['plan.json']);
      const relative = transform(path.relative(options.projectRoot, filename));
      assert(
        load('@babel/core')
          .transformFromAstSync(relative.ast, src, { configFile: false, babelrc: false })
          .code.includes('__checked'),
      );
      write([binding, { ...binding, id: 'fixture#C.absent', name: 'absent' }]);
      assert.throws(() => transform(), /every selected body/);
      write([binding], '0'.repeat(64));
      assert.throws(() => transform(), /source changed/);
      assert.throws(
        () =>
          transformer.transform({
            src,
            filename,
            options: {
              ...options,
              customTransformOptions: {
                nelyxTypedPlan: fs.readFileSync(plan, 'utf8'),
                nelyxTypedPlanSha256: '0'.repeat(64),
              },
            },
          }),
        /plan hash changed/,
      );
    } finally {
      assert.equal(path.dirname(folder), fs.realpathSync(os.tmpdir()));
      assert(!fs.lstatSync(folder).isSymbolicLink());
      fs.rmSync(folder, { recursive: true, force: true });
    }
  },
);
