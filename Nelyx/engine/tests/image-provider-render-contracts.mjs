// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { stop } from 'esbuild';
import { engineRoot, sourceIdentity, timeout } from '../tools/build.mjs';
import * as normalApi from '../../sdk/tooling/cli/src/engine-v2-runner.mjs';
import { runTypeScriptCompiler } from '../../sdk/tooling/metro/src/typescript-compiler.cjs';
import { imageFixture } from './app-images-probe.mjs';
import { imageProviderAppSource, providerHttpFixture } from './image-provider-fixture.mjs';

export function imageProviderRenderContracts() {
  test(
    'Original ImageProvider widgets display real cached/asset/network/resize/GIF frames through Core layout and stop/restart their actual Core clock in both Web profiles',
    { timeout },
    () => verifyImageProviderBrowser(),
  );
}

export async function verifyImageProviderBrowser(runner) {
  const api = runner
      ? await import(
          pathToFileURL(path.join(runner, 'node_modules/@nelyx/cli/src/engine-v2-runner.mjs'))
        )
      : normalApi,
    compile = runner
      ? createRequire(path.join(runner, 'package.json'))('@nelyx/metro/typescript-compiler')
          .runTypeScriptCompiler
      : runTypeScriptCompiler,
    parent = fs.realpathSync(os.tmpdir()),
    app = fs.mkdtempSync(path.join(parent, 'engine-provider-browser-')),
    repo = path.resolve(engineRoot, '../..'),
    supply = path.join(engineRoot, 'dist'),
    fixture = providerHttpFixture();
  let browser, server, bundleServer;
  try {
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(supply, 'engine-manifest.json'))).sourceSha256,
      sourceIdentity(),
    );
    server = createServer((request, response) => {
      if (!fixture.handle(request, response)) bundleServer?.emit('request', request, response);
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const origin = 'http://127.0.0.1:' + server.address().port;
    fixture.setCrossOrigin(origin);
    api.createEngineV2Project(app);
    if (runner)
      fs.symlinkSync(path.join(runner, 'node_modules'), path.join(app, 'node_modules'), 'junction');
    else {
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
    }
    fs.mkdirSync(path.join(app, 'assets'));
    fs.writeFileSync(path.join(app, 'assets/image.png'), Buffer.from(imageFixture.png, 'base64'));
    const configPath = path.join(app, 'nelyx.v2.json'),
      configuration = JSON.parse(fs.readFileSync(configPath));
    configuration.assets = { 'image.png': 'assets/image.png' };
    fs.writeFileSync(configPath, JSON.stringify(configuration));
    fs.writeFileSync(path.join(app, 'src/app.ts'), imageProviderAppSource(origin));
    for (const target of ['windows', 'web']) {
      const config = path.join(app, 'tsconfig.images.json');
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
      const checked = compile(
        runner ?? repo,
        ['-p', config, '--pretty', 'false'],
        runner ? 'typescript' : '@typescript/native',
      );
      assert.equal(checked.version, '7.0.2');
      assert.equal(checked.status, 0, checked.stdout + checked.stderr);
      const built = await api.buildEngineV2Application({ app, target, engineInputs: supply });
      if (target === 'web')
        bundleServer = api.createEngineV2Server(
          api.verifyEngineV2Application(built.directory, 'web'),
        );
    }
    browser = await chromium.launch({ headless: true });
    for (const profile of ['plain', 'isolated']) {
      const context = await browser.newContext({ viewport: { width: 320, height: 200 } }),
        page = await context.newPage(),
        pageErrors = [];
      try {
        page.on('pageerror', (error) => pageErrors.push(String(error)));
        await page.addInitScript(() => {
          const post = Worker.prototype.postMessage;
          Worker.prototype.postMessage = function (message, ...rest) {
            if (message?.kind === 'start') {
              globalThis.__providerWorker = this;
              globalThis.__providerStates = [];
              globalThis.__providerFrames = [];
              this.addEventListener('message', (event) => {
                const value = event.data;
                if (value.kind === 'provider-state') __providerStates.push(value);
                if (value.kind === 'provider-frame') __providerFrames.push(value);
                if (value.kind === 'provider-cache') globalThis.__providerCache = value;
                if (value.kind === 'provider-cleared') globalThis.__providerCleared = value;
                if (value.kind === 'provider-ready') globalThis.__providerReady = true;
                if (value.kind === 'provider-error' || value.kind === 'app-error')
                  globalThis.__providerError = value;
                if (value.kind === 'app-execution')
                  globalThis.__providerExecution = value.execution;
                if (value.kind === 'app-disposed') globalThis.__providerDisposed = value;
              });
            }
            return post.call(this, message, ...rest);
          };
        });
        await page.goto(origin + '/' + profile + '/');
        await page.waitForFunction(
          () =>
            (globalThis.__nelyxV2?.ready &&
              globalThis.__providerReady &&
              __providerFrames.some((value) => value.name === 'network') &&
              __providerFrames.some((value) => value.name === 'gif')) ||
            globalThis.__providerError,
        );
        const send = (kind, data = {}) =>
          page.evaluate(({ kind, data }) => __providerWorker.postMessage({ kind, ...data }), {
            kind,
            data,
          });
        const probe = async () => {
          const count = await page.evaluate(() => __providerStates.length);
          await send('provider-probe');
          await page.waitForFunction((count) => __providerStates.length > count, count);
          const state = await page.evaluate(() => __providerStates.at(-1));
          assert.equal(await page.evaluate(() => globalThis.__providerError), undefined);
          return state;
        };
        const pixels = async (points) => {
          const screenshot = await page.screenshot();
          return page.evaluate(
            async ({ png, points }) => {
              const bitmap = await createImageBitmap(
                new Blob([Uint8Array.from(atob(png), (c) => c.charCodeAt(0))], {
                  type: 'image/png',
                }),
              );
              try {
                const canvas = new OffscreenCanvas(bitmap.width, bitmap.height),
                  ctx = canvas.getContext('2d');
                ctx.drawImage(bitmap, 0, 0);
                return points.map(([x, y]) => Array.from(ctx.getImageData(x, y, 1, 1).data));
              } finally {
                bitmap.close();
              }
            },
            { png: screenshot.toString('base64'), points },
          );
        };
        const waitPixels = async (points, expected) => {
          let actual;
          for (let i = 0; i < 30; ++i) {
            actual = await pixels(points);
            if (JSON.stringify(actual) === JSON.stringify(expected)) return;
            await page.waitForTimeout(50);
          }
          assert.deepEqual(actual, expected);
        };
        const red = [255, 0, 0, 255],
          green = [0, 255, 0, 255],
          bg = [16, 32, 48, 255];
        await waitPixels(
          [
            [8, 8],
            [56, 8],
            [72, 8],
            [120, 8],
            [136, 8],
            [184, 8],
            [200, 8],
            [248, 8],
            [8, 72],
            [136, 72],
            [200, 72],
          ],
          [
            red,
            green,
            red,
            green,
            red,
            green,
            red,
            green,
            red,
            [0, 255, 255, 255],
            [255, 255, 0, 255],
          ],
        );
        const first = await probe();
        assert.deepEqual(first.frameSizes.resize, [1, 1]);
        assert.ok(
          first.progress.some(
            (value) =>
              value > 0 && value < 128 * 1024 + 12 + Buffer.from(imageFixture.png, 'base64').length,
          ),
          JSON.stringify(first.progress),
        );
        assert.ok(first.errors.some((value) => value.includes('404')));
        assert.ok(first.errors.some((value) => value.startsWith('corrupt:')));
        assert.equal(first.images.backend.readbacks, 0);
        assert.ok(first.images.clock.frameCallbacks > 0);
        await send('provider-direct');
        await page.waitForFunction(() => globalThis.__providerCache);
        const reuse = await page.evaluate(() => __providerCache);
        assert.equal(reuse.same, true);
        assert.equal(reuse.count, 2);
        assert.equal(reuse.syncs, 2);
        const beforeCache = (await probe()).images.descriptorCreates;
        assert.equal(beforeCache, first.images.descriptorCreates);
        await send('provider-phase', { phase: 0, enabled: true });
        await waitPixels([[8, 72]], [[0, 128, 0, 255]]);
        await send('provider-phase', { phase: 0, enabled: false });
        let paused;
        for (let i = 0; i < 30; ++i) {
          paused = await probe();
          if (paused.images.clock.pendingFrames === 0 && paused.images.clock.pendingTimers === 0)
            break;
          await page.waitForTimeout(20);
        }
        assert.equal(paused.images.clock.pendingFrames, 0);
        assert.equal(paused.images.clock.pendingTimers, 0);
        const frozen = await pixels([[8, 72]]);
        await page.waitForTimeout(950);
        const stable = await probe();
        assert.equal(stable.animationFrames, paused.animationFrames);
        assert.equal(stable.images.clock.timerCallbacks, paused.images.clock.timerCallbacks);
        assert.deepEqual(await pixels([[8, 72]]), frozen);
        await send('provider-phase', { phase: 0, enabled: true });
        await page.waitForFunction(
          (count) => __providerFrames.filter((value) => value.name === 'gif').length > count,
          await page.evaluate(
            () => __providerFrames.filter((value) => value.name === 'gif').length,
          ),
        );
        await send('provider-phase', { phase: 1, enabled: false });
        await waitPixels(
          [
            [8, 8],
            [56, 8],
            [136, 8],
            [8, 72],
          ],
          [red, green, bg, bg],
        );
        assert.equal((await probe()).images.descriptorCreates, beforeCache);
        await send('provider-phase', { phase: 2 });
        await waitPixels(
          [
            [8, 8],
            [136, 8],
          ],
          [bg, bg],
        );
        await send('provider-clear');
        await page.waitForFunction(() => globalThis.__providerCleared);
        let removed;
        for (let i = 0; i < 30; ++i) {
          removed = await probe();
          if (
            removed.images.backend.frames === 0 &&
            removed.images.sceneSnapshots === 0 &&
            removed.images.backend.codecs === 0
          )
            break;
          await page.waitForTimeout(20);
        }
        assert.equal(removed.images.backend.frames, 0);
        assert.equal(removed.images.backend.codecs, 0);
        assert.equal(removed.images.backend.descriptors, 0);
        assert.equal(removed.images.sceneSnapshots, 0);
        assert.equal(removed.images.backend.sceneBuffers, 0);
        for (const field of [
          'descriptorCreates',
          'codecCreates',
          'frameDecodes',
          'pixelReads',
          'pixelReadBytes',
        ])
          assert.equal(
            removed.images[field],
            removed.images.backend[field],
            'SDK/backend provider work: ' + field,
          );
        await page.waitForFunction(() => {
          const state = __nelyxV2.surface.diagnostics['render-stats']?.state;
          return (
            state &&
            globalThis.__providerExecution &&
            String(state.transactionWork) === String(__providerExecution.acknowledgedCommands)
          );
        });
        const final = await page.evaluate(() => ({
          core: String(__nelyxV2.surface.diagnostics['render-stats'].state.transactionWork),
          layout: String(__nelyxV2.surface.diagnostics['render-stats'].state.layoutWork),
          imagePaint: String(__nelyxV2.surface.diagnostics['render-stats'].state.imagePaintWork),
          frameWork: String(__nelyxV2.surface.diagnostics['render-stats'].state.appFrameWork),
          execution: __providerExecution,
          content:
            __nelyxV2.surface.diagnostics['content-stats']?.counters ??
            __nelyxV2.surface.diagnostics.content?.counters,
        }));
        assert.equal(final.core, String(final.execution.acknowledgedCommands));
        assert.ok(BigInt(final.layout) > 0n);
        assert.ok(BigInt(final.imagePaint) > 0n);
        assert.ok(BigInt(final.frameWork) > 0n);
        assert.ok(final.content.images > 0);
        assert.equal(final.execution.appGeometryNodes, 0);
        assert.equal(final.execution.rejectedFallbacks, 0);
        const before = fixture.calls.length;
        await send('provider-phase', { phase: 3 });
        for (
          let i = 0;
          i < 30 && !fixture.calls.slice(before).some((call) => call.path === '/provider/stall');
          ++i
        )
          await page.waitForTimeout(20);
        assert.ok(fixture.calls.slice(before).some((call) => call.path === '/provider/stall'));
        const closed = await page.evaluate(() => __nelyxV2.close()),
          disposed = await page.evaluate(() => __providerDisposed);
        assert.equal(closed.workersStopped, true);
        assert.equal(closed.reservedBytes, 0);
        assert.equal(disposed.assets.pending, 0);
        assert.equal(disposed.assets.networkCreditBytes, 0);
        assert.equal(disposed.images.backend.frames, 0);
        assert.equal(disposed.images.backend.codecs, 0);
        assert.equal(disposed.buffers.creditBytes, 0);
        assert.deepEqual(await page.evaluate(() => __nelyxV2.errors), []);
        assert.deepEqual(pageErrors, []);
        console.log(
          JSON.stringify({
            control: runner ? 'installed-ImageProvider' : 'normal-ImageProvider',
            profile,
            coreCommands: final.core,
            sdkCommands: final.execution.acknowledgedCommands,
            nativeLayout: final.layout,
            nativeImagePaint: final.imagePaint,
            coreFrameEvents: final.frameWork,
            contentImages: final.content.images,
            descriptorCreates: first.images.descriptorCreates,
            frameDecodes: removed.images.frameDecodes,
            clock: removed.images.clock,
            cacheShared: true,
            tickerPaused: true,
            streamProgress: first.progress,
            sceneBuffersAfterEvict: removed.images.backend.sceneBuffers,
            publicReadbacks: removed.images.backend.readbacks,
            workersStopped: true,
            closedReservation: 0,
          }),
        );
      } finally {
        await page.evaluate(() => globalThis.__nelyxV2?.close?.()).catch(() => {});
        await context.close();
      }
    }
  } finally {
    const cleanup = await Promise.allSettled([
      (async () => browser?.close())(),
      (async () => fixture.close())(),
      (async () => {
        if (server) {
          server.closeAllConnections();
          await new Promise((resolve) => server.close(resolve));
        }
      })(),
    ]);
    try {
      stop();
    } finally {
      assert.equal(path.dirname(path.resolve(app)), parent);
      assert.ok(path.basename(app).startsWith('engine-provider-browser-'));
      fs.rmSync(app, { recursive: true, force: true, maxRetries: 3 });
    }
    const errors = cleanup
      .filter((value) => value.status === 'rejected')
      .map((value) => value.reason);
    assert.deepEqual(errors, [], 'Image provider browser cleanup failed');
  }
}
