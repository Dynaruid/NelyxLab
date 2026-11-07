// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { stop } from 'esbuild';
import { engineRoot, sourceIdentity, timeout } from '../tools/build.mjs';
import {
  createEngineV2Project,
  buildEngineV2Application,
  verifyEngineV2Application,
  createEngineV2Server,
} from '../../sdk/tooling/cli/src/engine-v2-runner.mjs';
import { runTypeScriptCompiler } from '../../sdk/tooling/metro/src/typescript-compiler.cjs';
import { imageAppSource } from './image-app-fixture.mjs';
import { imageFixture } from './app-images-probe.mjs';

test(
  'Both normal SDK App models use canonical descriptors/codecs with real PNG/GIF/raw decodes in both Web profiles',
  { timeout },
  async () => {
    const parent = fs.realpathSync(os.tmpdir()),
      app = fs.mkdtempSync(path.join(parent, 'engine-original-images-')),
      repo = path.resolve(engineRoot, '../..'),
      supply = path.join(engineRoot, 'dist');
    let browser, server;
    try {
      assert.equal(
        JSON.parse(fs.readFileSync(path.join(supply, 'engine-manifest.json'))).sourceSha256,
        sourceIdentity(),
      );
      createEngineV2Project(app);
      fs.mkdirSync(path.join(app, 'assets'), { recursive: true });
      fs.writeFileSync(path.join(app, 'assets/image.png'), Buffer.from(imageFixture.png, 'base64'));
      const appConfig = path.join(app, 'nelyx.v2.json'),
        configuration = JSON.parse(fs.readFileSync(appConfig));
      configuration.assets = { 'image.png': 'assets/image.png' };
      fs.writeFileSync(appConfig, JSON.stringify(configuration));
      fs.mkdirSync(path.join(app, 'node_modules/@nelyx'), { recursive: true });
      for (const [name, relative] of [
        ['core', 'Nelyx'],
        ['sdk', 'Nelyx/sdk'],
      ])
        fs.symlinkSync(
          path.join(repo, relative),
          path.join(app, 'node_modules/@nelyx', name),
          'junction',
        );
      browser = await chromium.launch({ headless: true });
      for (const model of ['v2-widgets', 'original-elements']) {
        fs.writeFileSync(path.join(app, 'src/app.ts'), imageAppSource(model));
        let built;
        for (const target of ['windows', 'web']) {
          const config = path.join(app, 'image-types.json');
          fs.writeFileSync(
            config,
            JSON.stringify({
              compilerOptions: {
                strict: true,
                noEmit: true,
                skipLibCheck: false,
                types: [],
                lib: target === 'web' ? ['ES2022', 'DOM'] : ['ES2022'],
                target: 'ES2022',
                module: 'NodeNext',
                moduleResolution: 'NodeNext',
                customConditions: target === 'web' ? ['browser'] : [],
              },
              files: ['src/app.ts'],
            }),
          );
          const checked = runTypeScriptCompiler(
            repo,
            ['-p', config, '--pretty', 'false'],
            '@typescript/native',
          );
          assert.equal(checked.version, '7.0.2');
          assert.equal(checked.status, 0, checked.stdout + checked.stderr);
          built = await buildEngineV2Application({ app, target, engineInputs: supply });
        }
        server = createEngineV2Server(verifyEngineV2Application(built.directory, 'web'));
        server.listen(0, '127.0.0.1');
        await once(server, 'listening');
        for (const profile of ['plain', 'isolated']) {
          const context = await browser.newContext({ viewport: { width: 400, height: 240 } }),
            page = await context.newPage(),
            errors = [];
          try {
            page.on('pageerror', (error) => errors.push(String(error)));
            await page.addInitScript(() => {
              const post = Worker.prototype.postMessage;
              Worker.prototype.postMessage = function (message, ...rest) {
                if (message?.kind === 'start')
                  this.addEventListener('message', (event) => {
                    if (event.data.kind === 'image-ready') globalThis.__imageReady = event.data;
                    if (event.data.kind === 'app-disposed') globalThis.__imageDisposed = event.data;
                  });
                return post.call(this, message, ...rest);
              };
            });
            await page.goto(`http://127.0.0.1:${server.address().port}/${profile}/`);
            await page.waitForFunction(
              () => globalThis.__nelyxV2?.ready && globalThis.__imageReady,
            );
            const receipt = await page.evaluate(() => __nelyxV2.receipt),
              image = await page.evaluate(() => __imageReady.images);
            assert.equal(receipt.engineWork, String(receipt.execution.acknowledgedCommands));
            assert.equal(image.frameDecodes, 10);
            assert.equal(image.backend.frameDecodes, 10);
            assert.equal(image.pixelReadBytes, 60);
            assert.equal(image.backend.pixelReadBytes, 60);
            assert.equal(image.descriptorCreates, 6);
            assert.equal(image.backend.descriptorCreates, 6);
            assert.equal(image.codecCreates, 6);
            assert.equal(image.backend.codecCreates, 6);
            assert.equal(image.tsFallbacks, 0);
            assert.equal(image.backend.descriptors, 0);
            assert.equal(image.backend.codecs, 0);
            assert.equal(image.backend.frames, 0);
            assert.equal(image.backend.reservedBytes, 458932);
            const closed = await page.evaluate(() => __nelyxV2.close()),
              disposed = await page.evaluate(() => __imageDisposed);
            assert.equal(closed.reservedBytes, 0);
            assert.equal(closed.workersStopped, true);
            assert.equal(disposed.images.backend.reservedBytes, 458932);
            assert.equal(disposed.buffers.creditBytes, 0);
            assert.deepEqual(await page.evaluate(() => __nelyxV2.errors), []);
            assert.deepEqual(errors, []);
            console.log(
              JSON.stringify({
                control: 'normal-SDK-image-decoders',
                model,
                profile,
                coreCommands: receipt.engineWork,
                sdkCommands: receipt.execution.acknowledgedCommands,
                images: image,
                workersStopped: true,
                closedReservation: 0,
              }),
            );
          } finally {
            await page.evaluate(() => globalThis.__nelyxV2?.close?.()).catch(() => {});
            await context.close();
          }
        }
        await new Promise((resolve) => server.close(resolve));
        server = undefined;
      }
      for (const module of ['image-descriptor-binding', 'immutable-buffer-binding']) {
        fs.writeFileSync(
          path.join(app, 'src/app.ts'),
          `import * as owner from '@nelyx/core/internal/ui/${module}';export default owner;`,
        );
        await assert.rejects(
          buildEngineV2Application({ app, target: 'web', engineInputs: supply }),
          /Engine v2 cannot import/,
        );
      }
    } finally {
      await browser?.close();
      if (server) await new Promise((resolve) => server.close(resolve));
      stop();
      assert.equal(path.dirname(path.resolve(app)), parent);
      assert.ok(path.basename(app).startsWith('engine-original-images-'));
      fs.rmSync(app, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);
