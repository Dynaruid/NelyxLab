// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stop } from 'esbuild';
import {
  createEngineV2Project,
  buildEngineV2Application,
} from '../../sdk/tooling/cli/src/engine-v2-runner.mjs';
const timeout = 1_200_000;

test(
  'Original Widget/controller/custom hook consumers fail explicitly before an unported native import can become a fallback',
  { timeout },
  async () => {
    const parent = fs.realpathSync(os.tmpdir()),
      app = fs.mkdtempSync(path.join(parent, 'nelyx-execution-model-')),
      repo = path.resolve(import.meta.dirname, '../../..');
    try {
      createEngineV2Project(app);
      fs.mkdirSync(path.join(app, 'node_modules/@nelyx'), { recursive: true });
      for (const [name, directory] of [
        ['core', 'Nelyx'],
        ['sdk', 'Nelyx/sdk'],
      ])
        fs.symlinkSync(
          path.join(repo, directory),
          path.join(app, 'node_modules/@nelyx', name),
          'junction',
        );
      for (const [module, name] of [
        ['framework/widgets/framework', 'StatefulWidget'],
        ['framework/widgets/scroll-controller', 'ScrollController'],
        ['framework/widgets/editable-text', 'TextEditingController'],
        ['framework/rendering/object', 'RenderBox'],
        ['framework/rendering/paragraph', 'RenderParagraph'],
        ['framework/painting/text-style', 'TextStyle'],
        ['hosting/resources', 'ResourceRegistry'],
      ]) {
        fs.writeFileSync(
          path.join(app, 'src/app.ts'),
          `import {${name}} from '@nelyx/core/${module}';import {defineEngineV2App} from '@nelyx/sdk/engine-v2';globalThis.originalConsumer=${name};export default defineEngineV2App({build(){throw Error('unreachable');}});`,
        );
        await assert.rejects(
          buildEngineV2Application({
            app,
            target: 'windows',
            engineInputs: path.join(repo, 'Nelyx/engine/dist'),
          }),
          /cannot import/,
        );
      }
    } finally {
      stop();
      assert.equal(path.dirname(app), parent);
      fs.rmSync(app, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);
