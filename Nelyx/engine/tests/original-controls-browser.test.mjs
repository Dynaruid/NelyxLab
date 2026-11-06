// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { stop } from 'esbuild';
import { packet, response, protocol as p } from '@nelyx/core/v2';
import { sourceIdentity, timeout } from '../tools/build.mjs';
import {
  createEngineV2Project,
  buildEngineV2Application,
  verifyEngineV2Application,
  createEngineV2Server,
} from '../../sdk/tooling/cli/src/engine-v2-runner.mjs';
import { originalControlFixture } from './original-control-fixture.mjs';

const owner = { session: 1, app: 1, view: 1, generation: 1 };
async function publication(page) {
  const bytes = await page.evaluate(
    async (bytes) => {
      const result = await globalThis.__nelyxV2.surface.host.exchange(new Uint8Array(bytes));
      return Array.from(result);
    },
    Array.from(packet(p.opcodes.semanticsSnapshot, owner)),
  );
  const state = response(new Uint8Array(bytes));
  assert.equal(state.status, p.statuses.ok);
  return state;
}
async function paintSample(page, commands) {
  await page.waitForFunction(
    (commands) => {
      const state = globalThis.__nelyxV2.surface.diagnostics['render-stats']?.state;
      return (
        state?.transactionWork === BigInt(commands) &&
        state.document === state.activeDocument &&
        state.publication > 0n
      );
    },
    commands,
    { timeout: 15000 },
  );
  const state = await publication(page),
    card = state.nodes.find((n) => n.color === 0xff4488cc && n.width === 420 && n.height === 120);
  assert.ok(card, 'Sample the native published card rather than infer App layout');
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const png = await page.screenshot();
  return page.evaluate(
    async ({ png, x, y, opacity }) => {
      const bytes = Uint8Array.from(atob(png), (value) => value.charCodeAt(0)),
        bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      try {
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext('2d');
        context.drawImage(bitmap, 0, 0);
        return {
          color: [...context.getImageData(Math.round(x + 8), Math.round(y + 8), 1, 1).data],
          background: [...context.getImageData(900, 600, 1, 1).data],
          opacity,
        };
      } finally {
        bitmap.close();
      }
    },
    { png: png.toString('base64'), x: card.bounds.x, y: card.bounds.y, opacity: card.opacity },
  );
}
async function report(page, which, count) {
  await page.waitForFunction(
    ({ which, count }) =>
      globalThis.__controlEvents.some(
        (e) => e.kind === 'original-gesture-state' && e[which] === count,
      ) || globalThis.__nelyxV2.errors.length,
    { which, count },
    { timeout: 15000 },
  );
  return page.evaluate(() => {
    const events = globalThis.__controlEvents;
    return {
      state: events.filter((e) => e.kind === 'original-gesture-state').at(-1),
      execution: events.filter((e) => e.kind === 'app-execution').at(-1)?.execution,
      errors: globalThis.__nelyxV2.errors,
    };
  });
}

test(
  'Original Cupertino controls preserve hover, activation, animation pixels and drain in both Web profiles',
  { timeout },
  async () => {
    const repo = path.resolve(import.meta.dirname, '../../..'),
      supply = path.join(repo, 'Nelyx/engine/dist'),
      manifest = JSON.parse(fs.readFileSync(path.join(supply, 'engine-manifest.json'), 'utf8')),
      parent = fs.realpathSync(os.tmpdir());
    assert.equal(manifest.sourceSha256, sourceIdentity(), 'Build the current supply first');
    const app = fs.mkdtempSync(path.join(parent, 'engine-controls-web-'));
    let server, browser;
    try {
      createEngineV2Project(app, { designs: ['cupertino'] });
      fs.mkdirSync(path.join(app, 'node_modules/@nelyx'), { recursive: true });
      for (const [name, directory] of [
        ['core', 'Nelyx'],
        ['sdk', 'Nelyx/sdk'],
        ['cupertino', 'packages/cupertino'],
      ])
        fs.symlinkSync(
          path.join(repo, directory),
          path.join(app, 'node_modules/@nelyx', name),
          'junction',
        );
      fs.writeFileSync(path.join(app, 'src/app.ts'), originalControlFixture);
      const built = await buildEngineV2Application({ app, target: 'web', engineInputs: supply });
      assert.equal(built.routing.appModel, 'original-elements');
      server = createEngineV2Server(verifyEngineV2Application(built.directory, 'web'));
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      browser = await chromium.launch({ headless: true });
      for (const [route, profile] of [
        ['plain', 'single-worker'],
        ['isolated', 'threaded'],
      ]) {
        const context = await browser.newContext({ viewport: { width: 960, height: 720 } }),
          page = await context.newPage(),
          errors = [];
        page.on('pageerror', (error) => errors.push(String(error)));
        try {
          await page.goto(`http://127.0.0.1:${server.address().port}/${route}/`);
          await page.waitForFunction(
            () => globalThis.__nelyxV2?.ready || globalThis.__nelyxV2?.errors.length,
            null,
            { timeout: 30000 },
          );
          const ready = await page.evaluate(() => ({
            ready: __nelyxV2.ready,
            errors: __nelyxV2.errors,
            profile: __nelyxV2.surface?.selectedProfile,
            receipt: __nelyxV2.receipt,
          }));
          assert.deepEqual(ready.errors, []);
          assert.equal(ready.ready, true);
          assert.equal(ready.profile, profile);
          await page.evaluate(() => {
            globalThis.__controlEvents = [];
            __nelyxV2.app.addEventListener('message', (event) => {
              if (
                ['original-gesture-state', 'control-hover', 'app-execution'].includes(
                  event.data.kind,
                )
              ) {
                __controlEvents.push(event.data);
                if (__controlEvents.length > 60) __controlEvents.shift();
              }
            });
          });
          const button = (label) => page.getByRole('button', { name: label, exact: true }),
            click = async (label) => {
              const bounds = await button(label).boundingBox();
              assert.ok(bounds);
              await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
            };
          await button('Plain + animate').waitFor({ state: 'visible', timeout: 30000 });
          const full = await paintSample(page, String(ready.receipt.commands));
          await click('Plain + animate');
          let current = await report(page, 'taps', 1);
          assert.deepEqual(current.errors, []);
          assert.equal(current.state.fade, 0.5);
          assert.equal(
            current.state.hovered,
            true,
            'DOM capture handoff keeps the same hovered control',
          );
          const half = await paintSample(page, current.state.commands);
          assert.deepEqual(full.color, [68, 136, 204, 255]);
          assert.ok(Math.abs(half.opacity - 0.5) < 1 / 255);
          for (let channel = 0; channel < 3; ++channel)
            assert.ok(
              Math.abs(
                half.color[channel] - (full.color[channel] + full.background[channel]) / 2,
              ) <= 2,
              'Opacity affects actual CanvasKit pixels',
            );
          await page.mouse.move(-10, -10);
          await page.waitForFunction(
            () =>
              __controlEvents.filter((e) => e.kind === 'control-hover').at(-1)?.hovered === false,
            null,
            { timeout: 15000 },
          );
          await click('Filled');
          await report(page, 'filled', 1);
          await click('Tinted');
          await report(page, 'tinted', 1);
          await click('Disabled');
          await button('Plain + animate').focus();
          await page.keyboard.press('Enter');
          current = await report(page, 'taps', 2);
          assert.deepEqual(current.errors, []);
          assert.deepEqual(errors, []);
          assert.equal(current.state.filled, 1);
          assert.equal(current.state.tinted, 1);
          assert.equal(current.state.fade, 1);
          const restored = await paintSample(page, current.state.commands),
            published = await publication(page);
          assert.deepEqual(restored.color, full.color);
          assert.equal(published.transactionWork, BigInt(current.execution.acknowledgedCommands));
          assert.equal(published.transactionWork, BigInt(current.state.commands));
          assert.ok(published.gestureWork > 0n);
          assert.equal(current.execution.tsLayoutFallbacks, 0);
          assert.equal(current.execution.appGeometryNodes, 0);
          assert.equal(current.execution.rejectedFallbacks, 0);
          const closed = await page.evaluate(() => __nelyxV2.close());
          assert.equal(closed.reservedBytes, 0);
          assert.equal(closed.workersStopped, true);
          console.log(
            JSON.stringify({
              profile,
              commands: current.state.commands,
              gestureWork: String(published.gestureWork),
              opacity: [full.color, half.color, restored.color],
              workersStopped: closed.workersStopped,
              reservedBytes: closed.reservedBytes,
            }),
          );
        } finally {
          await page.evaluate(() => globalThis.__nelyxV2?.close?.()).catch(() => {});
          await context.close();
        }
      }
    } finally {
      await browser?.close();
      if (server) await new Promise((resolve) => server.close(resolve));
      stop();
      assert.equal(path.dirname(path.resolve(app)), parent);
      assert.match(path.basename(app), /^engine-controls-web-/);
      fs.rmSync(app, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);
