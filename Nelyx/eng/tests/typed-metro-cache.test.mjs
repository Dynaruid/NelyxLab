// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const timeout = 1_200_000,
  root = path.resolve(import.meta.dirname, '../../..'),
  runner = path.join(root, 'sample/nelyx-testbed-app-2/windows/runner'),
  load = createRequire(path.join(runner, 'package.json'));
const hash = (value) => createHash('sha256').update(value).digest('hex');
test(
  'the actual Metro cache reuses code and native evidence, and invalidates source, plan and worker changes',
  { timeout },
  async () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-metro-cache-'));
    let transformer;
    try {
      const { loadConfig } = load('metro'),
        config = await loadConfig({ cwd: runner, config: path.join(runner, 'metro.config.cjs') }),
        Transformer = load('metro/private/DeltaBundler/Transformer').default;
      const entries = new Map();
      let hits = 0,
        misses = 0,
        cacheVersion = config.cacheVersion;
      const store = {
        async get(key) {
          const result = entries.get(key.toString('hex'));
          result ? hits++ : misses++;
          return result ?? null;
        },
        async set(key, value) {
          entries.set(key.toString('hex'), value);
        },
        async clear() {
          entries.clear();
        },
      };
      const filename = path.join(folder, 'cache.js');
      let src = 'function scalar(x){return x+1;} globalThis.scalar=scalar;';
      fs.writeFileSync(filename, src);
      const moduleRoot = path.join(root, 'Nelyx/sdk/tooling/metro/src'),
        plan = JSON.stringify({
          schema: 'nelyx.typed-metro-plan/v1',
          files: [
            {
              file: filename,
              sha256: hash(src),
              bindings: [
                {
                  id: 'fixture#scalar',
                  name: 'scalar',
                  globalName: '__checked',
                  adapter: 'return globalThis.__checked(this,null,x);',
                },
              ],
            },
          ],
        });
      const options = {
        customTransformOptions: { nelyxTypedPlan: plan, nelyxTypedPlanSha256: hash(plan) },
        dev: false,
        experimentalImportSupport: false,
        inlinePlatform: true,
        inlineRequires: false,
        minify: false,
        nonInlinedRequires: [],
        platform: 'windows',
        type: 'module',
        unstable_transformProfile: 'default',
      };
      const make = () =>
        new Transformer(
          {
            ...config,
            cacheVersion,
            cacheStores: [store],
            maxWorkers: 1,
            transformerPath: path.join(moduleRoot, 'native-aot-worker.cjs'),
            transformer: {
              ...config.transformer,
              babelTransformerPath: path.join(moduleRoot, 'native-typed-transformer.cjs'),
            },
          },
          {
            getOrComputeSha1: async () => ({ sha1: createHash('sha1').update(src).digest('hex') }),
          },
        );
      transformer = make();
      const first = await transformer.transformFile(filename, options);
      await transformer.end();
      transformer = null;
      assert.equal(misses, 1);
      assert.equal(first.output[0].data.nelyxNativeEvidence.consumed.bindings[0], 'fixture#scalar');
      assert.match(first.output[0].data.code, /__checked/);
      transformer = make();
      const warm = await transformer.transformFile(filename, options);
      assert.equal(hits, 1);
      assert.deepEqual(warm.output, first.output);
      const nextPlan = JSON.stringify({ schema: 'nelyx.typed-metro-plan/v1', files: [] });
      const dynamic = {
        ...options,
        customTransformOptions: { nelyxTypedPlan: nextPlan, nelyxTypedPlanSha256: hash(nextPlan) },
      };
      const changed = await transformer.transformFile(filename, dynamic);
      assert.equal(misses, 2);
      assert.equal(changed.output[0].data.nelyxNativeEvidence.consumed, null);
      assert.doesNotMatch(changed.output[0].data.code, /__checked/);
      src = 'globalThis.scalar=7;';
      fs.writeFileSync(filename, src);
      const sourceChanged = await transformer.transformFile(filename, dynamic);
      assert.equal(misses, 3);
      assert.equal(
        sourceChanged.output[0].data.nelyxNativeEvidence.elimination.sourceSha256,
        hash(src),
      );
      await transformer.end();
      transformer = null;
      cacheVersion += '-changed-worker-policy';
      transformer = make();
      await transformer.transformFile(filename, dynamic);
      assert.equal(misses, 4);
      await transformer.end();
      transformer = null;
      assert.deepEqual(fs.readdirSync(folder), ['cache.js']);
    } finally {
      if (transformer) await transformer.end();
      assert.equal(path.dirname(folder), fs.realpathSync(os.tmpdir()));
      assert(!fs.lstatSync(folder).isSymbolicLink());
      fs.rmSync(folder, { recursive: true, force: true });
    }
  },
);
