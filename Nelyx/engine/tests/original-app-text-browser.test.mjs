// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import './original-slider-label-browser.test.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { stop } from 'esbuild';
import { packet, response, protocol as p, appTextQuotaBytes } from '@nelyx/core/v2';
import { sourceIdentity, timeout, engineRoot } from '../tools/build.mjs';
import {
  createEngineV2Project,
  buildEngineV2Application,
  verifyEngineV2Application,
  createEngineV2Server,
} from '../../sdk/tooling/cli/src/engine-v2-runner.mjs';
import { originalAppTextFixture } from './original-app-text-fixture.mjs';
const owner = { session: 1, app: 1, view: 1, generation: 1 };
async function published(page) {
  for (let attempt = 0; attempt < 30; ++attempt) {
    const bytes = await page.evaluate(
        async (data) => Array.from(await __nelyxV2.surface.host.exchange(new Uint8Array(data))),
        Array.from(packet(p.opcodes.semanticsSnapshot, owner)),
      ),
      state = response(new Uint8Array(bytes));
    assert.equal(state.status, p.statuses.ok);
    if (
      state.publication &&
      state.document === state.publishedDocument &&
      state.metrics === state.publishedMetrics &&
      !state.queued
    )
      return state;
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  throw Error('App text Content publication did not settle');
}
async function ink(page, bounds) {
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const png = await page.screenshot();
  return page.evaluate(
    async ({ png, bounds }) => {
      const bitmap = await createImageBitmap(
        new Blob([Uint8Array.from(atob(png), (v) => v.charCodeAt(0))], { type: 'image/png' }),
      );
      try {
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height),
          context = canvas.getContext('2d');
        context.drawImage(bitmap, 0, 0);
        const pixels = context.getImageData(
          Math.round(bounds.x),
          Math.round(bounds.y),
          Math.ceil(bounds.width),
          Math.ceil(bounds.height),
        ).data;
        let count = 0;
        for (let i = 0; i < pixels.length; i += 4)
          if (pixels[i] === 23 && pixels[i + 1] === 32 && pixels[i + 2] === 51) ++count;
        return count;
      } finally {
        bitmap.close();
      }
    },
    { png: png.toString('base64'), bounds },
  );
}
test(
  'Original synchronous TextPainter matches final Content layout and pixels with host-owned App quota in both Web profiles',
  { timeout },
  async () => {
    const repo = path.resolve(engineRoot, '../..'),
      supply = path.join(engineRoot, 'dist'),
      parent = fs.realpathSync(os.tmpdir()),
      app = fs.mkdtempSync(path.join(parent, 'engine-app-text-web-'));
    let server, browser;
    try {
      assert.equal(
        JSON.parse(fs.readFileSync(path.join(supply, 'engine-manifest.json'))).sourceSha256,
        sourceIdentity(),
      );
      createEngineV2Project(app);
      fs.mkdirSync(path.join(app, 'node_modules/@nelyx'), { recursive: true });
      for (const [name, source] of [
        ['core', 'Nelyx'],
        ['sdk', 'Nelyx/sdk'],
      ])
        fs.symlinkSync(
          path.join(repo, source),
          path.join(app, 'node_modules/@nelyx', name),
          'junction',
        );
      fs.writeFileSync(path.join(app, 'src/app.ts'), originalAppTextFixture);
      const built = await buildEngineV2Application({ app, target: 'web', engineInputs: supply });
      assert.equal(built.routing.appModel, 'original-elements');
      server = createEngineV2Server(verifyEngineV2Application(built.directory, 'web'));
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      browser = await chromium.launch({ headless: true });
      console.log('App text browser: Chromium ' + browser.version());
      for (const [route, profile] of [
        ['plain', 'single-worker'],
        ['isolated', 'threaded'],
      ]) {
        const context = await browser.newContext({ viewport: { width: 360, height: 320 } }),
          page = await context.newPage(),
          errors = [];
        page.on('pageerror', (error) => errors.push(String(error)));
        try {
          await page.addInitScript(() => {
            const post = Worker.prototype.postMessage;
            Worker.prototype.postMessage = function (value, ...args) {
              if (value?.kind === 'start')
                this.addEventListener('message', (event) => {
                  if (event.data?.kind === 'app-text-geometry')
                    globalThis.__textGeometry = event.data;
                  if (event.data?.kind === 'app-execution')
                    globalThis.__textExecution = event.data.execution;
                });
              return Reflect.apply(post, this, [value, ...args]);
            };
          });
          await page.goto(`http://127.0.0.1:${server.address().port}/${route}/`);
          await page.waitForFunction(() => __nelyxV2?.ready || __nelyxV2?.errors.length, null, {
            timeout: 30000,
          });
          const initial = await page.evaluate(() => ({
            ready: __nelyxV2.ready,
            errors: __nelyxV2.errors,
            execution: __nelyxV2.receipt?.execution,
            geometry: __textGeometry,
          }));
          assert.deepEqual(initial.errors, []);
          assert.equal(initial.ready, true);
          for (let revision = 0; revision < 2; ++revision) {
            if (revision) {
              await page.evaluate(() => __nelyxV2.app.postMessage({ kind: 'app-text-update' }));
              await page.waitForFunction(
                () => __textGeometry?.revision === 1 && __textExecution?.appText?.sdkLayouts >= 2,
                null,
                { timeout: 15000 },
              );
            }
            const state = await published(page),
              geometry = await page.evaluate(() => __textGeometry),
              node = state.nodes.find((node) => node.kind === p.kinds.paragraph);
            assert.ok(node && geometry.boxes > 0);
            assert.ok(Math.abs(node.content.width - geometry.width) < 0.001);
            assert.ok(Math.abs(node.content.height - geometry.height) < 0.001);
            assert.ok(Math.abs(node.baseline - geometry.baseline) < 0.001);
            assert.equal(state.fontRevision, 1n);
            assert.ok(
              (await ink(page, node.bounds)) > 10,
              'Final C++ Content/Render painted actual text pixels',
            );
            const execution = await page.evaluate(
                () => __textExecution ?? __nelyxV2.receipt.execution,
              ),
              text = execution.appText;
            assert.equal(state.transactionWork, BigInt(execution.acknowledgedCommands));
            assert.equal(text.layouts, text.sdkLayouts);
            assert.equal(text.queries, text.sdkQueries);
            assert.ok(text.layouts > 0 && text.queries > 0);
            assert.equal(
              text.paragraphs,
              1,
              'The Source recording owns its paragraph after TextPainter.dispose',
            );
            assert.ok(text.sdkPaintCaptures > 0);
            assert.equal(node.paintPlacement.fontRevision, 1n);
            assert.deepEqual(node.fontBinding, { resource: null, fontRevision: 1n, pinned: true });
            assert.deepEqual([node.bounds.x, node.bounds.y], [4, 5]);
            assert.equal(text.tsFallbacks, 0);
            assert.equal(execution.tsLayoutFallbacks, 0);
            assert.equal(execution.rejectedFallbacks, 0);
            assert.ok(state.memory.total <= BigInt(p.limits.unifiedBytes));
          }
          const denied = await page.evaluate(async () => {
            const port = __nelyxV2.surface.createAppPort();
            port.start();
            try {
              return await new Promise((resolve) => {
                port.addEventListener(
                  'message',
                  (event) => {
                    if (event.data?.kind === 'app-text-reservation') resolve(event.data);
                  },
                  { once: true },
                );
                port.postMessage({ kind: 'app-text-reserve', version: 12 });
              });
            } finally {
              port.close();
            }
          });
          assert.match(denied.error, /host-owned App worker/);
          const exhausted = await page.evaluate(async () => {
            const source = URL.createObjectURL(
              new Blob(
                [
                  `onmessage=e=>{const p=e.data;p.start();p.onmessage=e=>postMessage(e.data);p.postMessage({kind:'app-text-reserve',version:12});};`,
                ],
                { type: 'text/javascript' },
              ),
            );
            try {
              const app = new Worker(source);
              globalThis.__secondTextApp = app;
              const port = __nelyxV2.surface.createAppPort(app);
              return await new Promise((resolve) => {
                app.addEventListener('message', (event) => resolve(event.data), { once: true });
                app.postMessage(port, [port]);
              });
            } finally {
              URL.revokeObjectURL(source);
            }
          });
          assert.match(exhausted.error, /Unified memory budget rejected/);
          await page.evaluate(() => __nelyxV2.app.postMessage({ kind: 'app-text-update' }));
          await page.waitForFunction(
            () => __textGeometry?.revision === 2 && __textExecution?.appText?.sdkLayouts >= 3,
            null,
            { timeout: 15000 },
          );
          const recovered = await published(page),
            recovery = await page.evaluate(() => ({
              geometry: __textGeometry,
              execution: __textExecution,
            })),
            recoveredText = recovered.nodes.find((node) => node.kind === p.kinds.paragraph);
          assert.ok(Math.abs(recoveredText.content.height - recovery.geometry.height) < 0.001);
          assert.equal(recovered.transactionWork, BigInt(recovery.execution.acknowledgedCommands));
          assert.equal(recovery.execution.appText.layouts, recovery.execution.appText.sdkLayouts);
          assert.equal(recovery.execution.appText.queries, recovery.execution.appText.sdkQueries);
          const reservation = await page.evaluate(() => __nelyxV2.surface.diagnostics.appText);
          assert.equal(reservation.reservations, 1);
          assert.equal(reservation.reservedBytes, appTextQuotaBytes);
          const closed = await page.evaluate(async () => {
            globalThis.__textCloseOrder = [];
            for (const app of [__nelyxV2.app, __secondTextApp]) {
              const terminate = app.terminate.bind(app);
              app.terminate = () => {
                __textCloseOrder.push('app');
                terminate();
              };
            }
            const post = Worker.prototype.postMessage;
            Worker.prototype.postMessage = function (value, ...args) {
              if (value?.kind === 'close' && this !== __nelyxV2.app) __textCloseOrder.push('host');
              return Reflect.apply(post, this, [value, ...args]);
            };
            const result = await __nelyxV2.close();
            return { result, order: __textCloseOrder, errors: __nelyxV2.errors };
          });
          assert.deepEqual(closed.errors, []);
          assert.deepEqual(closed.order, ['app', 'app', 'host']);
          assert.equal(closed.result.reservedBytes, 0);
          assert.equal(closed.result.workersStopped, true);
          assert.deepEqual(closed.result.appText, {
            reservations: 0,
            retired: 1,
            reservedBytes: 0,
          });
          assert.deepEqual(errors, []);
          console.log(
            profile + ' App text C++/SDK',
            JSON.stringify(await page.evaluate(() => __textExecution.appText)),
          );
        } finally {
          await context.close();
        }
      }
    } finally {
      await browser?.close();
      if (server) await new Promise((resolve) => server.close(resolve));
      stop();
      assert.equal(path.dirname(app), parent);
      fs.rmSync(app, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);
