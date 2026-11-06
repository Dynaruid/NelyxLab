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
import { originalLayerFixture } from './original-layer-fixture.mjs';

const owner = { session: 1, app: 1, view: 1, generation: 1 };
async function settled(page, accepts = () => true) {
  let state;
  for (let attempt = 0; attempt < 30; attempt++) {
    const bytes = await page.evaluate(
      async (bytes) => Array.from(await __nelyxV2.surface.host.exchange(new Uint8Array(bytes))),
      Array.from(packet(p.opcodes.semanticsSnapshot, owner)),
    );
    state = response(new Uint8Array(bytes));
    assert.equal(state.status, p.statuses.ok);
    if (
      state.publication &&
      state.document === state.publishedDocument &&
      state.metrics === state.publishedMetrics &&
      state.device === state.publishedDevice &&
      !state.queued &&
      !state.interactionCount &&
      accepts(state)
    )
      return state;
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  throw Error('Linked scene did not settle');
}
async function pixel(page, x, y) {
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const png = await page.screenshot();
  return page.evaluate(
    async ({ png, x, y }) => {
      const bitmap = await createImageBitmap(
        new Blob([Uint8Array.from(atob(png), (c) => c.charCodeAt(0))], { type: 'image/png' }),
      );
      try {
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0);
        return Array.from(ctx.getImageData(x, y, 1, 1).data);
      } finally {
        bitmap.close();
      }
    },
    { png: png.toString('base64'), x, y },
  );
}
test(
  'Original layer links move Web pixels, native pointer targets and semantic peers across Source State updates in both profiles',
  { timeout },
  async () => {
    const repo = path.resolve(import.meta.dirname, '../../..'),
      supply = path.join(repo, 'Nelyx/engine/dist'),
      parent = fs.realpathSync(os.tmpdir());
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(supply, 'engine-manifest.json'))).sourceSha256,
      sourceIdentity(),
    );
    const app = fs.mkdtempSync(path.join(parent, 'engine-layers-web-'));
    let server, browser;
    try {
      createEngineV2Project(app, { designs: ['cupertino'] });
      fs.mkdirSync(path.join(app, 'node_modules/@nelyx'), { recursive: true });
      for (const [name, folder] of [
        ['core', 'Nelyx'],
        ['sdk', 'Nelyx/sdk'],
        ['cupertino', 'packages/cupertino'],
      ])
        fs.symlinkSync(
          path.join(repo, folder),
          path.join(app, 'node_modules/@nelyx', name),
          'junction',
        );
      fs.writeFileSync(path.join(app, 'src/app.ts'), originalLayerFixture);
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
        const context = await browser.newContext({ viewport: { width: 360, height: 320 } }),
          page = await context.newPage(),
          errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        try {
          await page.goto('http://127.0.0.1:' + server.address().port + '/' + route + '/');
          await page.waitForFunction(() => __nelyxV2?.ready || __nelyxV2?.errors.length, null, {
            timeout: 30000,
          });
          assert.deepEqual(await page.evaluate(() => __nelyxV2.errors), []);
          assert.equal(await page.evaluate(() => __nelyxV2.surface.selectedProfile), profile);
          await page.evaluate(() => {
            globalThis.__layerEvents = [];
            __nelyxV2.app.addEventListener('message', (event) => {
              if (['link-state', 'app-execution', 'layer-probe'].includes(event.data.kind)) {
                __layerEvents.push(event.data);
                if (__layerEvents.length > 30) __layerEvents.shift();
              }
            });
          });
          const colored = (frame) => frame.nodes.find((n) => n.color === 0xffbb4466),
            red = [187, 68, 102, 255],
            background = [244, 246, 250, 255];
          let frame = await settled(page);
          let probeId = 0;
          const sourceLayer = async (x, y, linked = true) => {
            let probe;
            for (let attempt = 0; attempt < 30; attempt++) {
              const id = ++probeId;
              await page.evaluate(
                (id) => __nelyxV2.app.postMessage({ kind: 'probe-source-layer', id }),
                id,
              );
              await page.waitForFunction(
                (id) => __layerEvents.some((e) => e.kind === 'layer-probe' && e.id === id),
                id,
                { timeout: 15000 },
              );
              probe = await page.evaluate(
                (id) => __layerEvents.find((e) => e.kind === 'layer-probe' && e.id === id),
                id,
              );
              if (
                probe.follower &&
                probe.leader === linked &&
                (linked
                  ? probe.transform?.[12] === x && probe.transform?.[13] === y
                  : probe.transform === null)
              )
                break;
              await page.evaluate(() => new Promise(requestAnimationFrame));
            }
            assert.equal(probe.follower, true);
            assert.equal(probe.leader, linked);
            assert.deepEqual(probe.leaderSize, { width: 80, height: 40 });
            const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, 0, 1];
            assert.deepEqual(probe.transform, linked ? matrix : null);
            assert.deepEqual(
              probe.current,
              linked ? matrix : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
            );
            if (linked) assert.deepEqual(probe.linkedOffset, { x: 70, y: 40 });
          };
          assert.deepEqual(colored(frame).matrix, [1, 0, 0, 1, 100, 70]);
          await sourceLayer(-120, -90);
          assert.deepEqual(await pixel(page, 120, 80), red);
          assert.deepEqual(await pixel(page, 240, 170), background);
          const click = async (label) => {
            const bounds = await page
              .getByRole('group', { name: label, exact: true })
              .boundingBox();
            assert.ok(bounds);
            await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
          };
          await click('Linked target');
          await page.waitForFunction(() =>
            __layerEvents.some((e) => e.kind === 'link-state' && e.taps === 1),
          );
          frame = await settled(page, (frame) => colored(frame)?.matrix[4] === 140);
          assert.deepEqual(colored(frame).matrix, [1, 0, 0, 1, 140, 70]);
          await sourceLayer(-80, -90);
          assert.deepEqual(await pixel(page, 160, 80), red);
          assert.deepEqual(await pixel(page, 120, 80), background);
          await click('Linked target');
          await page.waitForFunction(() =>
            __layerEvents.some((e) => e.kind === 'link-state' && !e.linked),
          );
          frame = await settled(page, (frame) => colored(frame) && !(colored(frame).flags & 16));
          assert.equal(!!(colored(frame).flags & 16), false);
          await sourceLayer(0, 0, false);
          assert.deepEqual(await pixel(page, 240, 170), background);
          assert.equal(
            await page.getByRole('group', { name: 'Linked target', exact: true }).count(),
            0,
          );
          await click('Restore link');
          await page.waitForFunction(() =>
            __layerEvents.some((e) => e.kind === 'link-state' && e.action === 'restore'),
          );
          frame = await settled(
            page,
            (frame) => colored(frame)?.matrix[4] === 120 && colored(frame).flags & 16,
          );
          assert.deepEqual(colored(frame).matrix, [1, 0, 0, 1, 120, 70]);
          await sourceLayer(-100, -90);
          assert.deepEqual(await pixel(page, 140, 80), red);
          const execution = await page.evaluate(
            () => __layerEvents.filter((e) => e.kind === 'app-execution').at(-1)?.execution,
          );
          assert.ok(execution);
          assert.equal(frame.transactionWork, BigInt(execution.acknowledgedCommands));
          assert.ok(frame.gestureWork > 0n);
          assert.equal(frame.controlWork, 0n);
          assert.equal(execution.tsLayoutFallbacks, 0);
          assert.equal(execution.appGeometryNodes, 0);
          assert.equal(execution.rejectedFallbacks, 0);
          const input = await page.evaluate(() => __nelyxV2.surface.inputStats);
          assert.equal(input.rejected, 0, JSON.stringify(input));
          assert.equal(input.collected, input.dispatched);
          assert.deepEqual(errors, []);
          assert.deepEqual(await page.evaluate(() => __nelyxV2.errors), []);
          const closed = await page.evaluate(() => __nelyxV2.close());
          assert.equal(closed.workersStopped, true);
          assert.equal(closed.reservedBytes, 0);
          console.log(
            JSON.stringify({
              profile,
              commands: String(frame.transactionWork),
              gestureWork: String(frame.gestureWork),
              controlWork: String(frame.controlWork),
              input,
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
      assert.match(path.basename(app), /^engine-layers-web-/);
      fs.rmSync(app, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);
