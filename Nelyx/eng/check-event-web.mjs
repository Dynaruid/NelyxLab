// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import {
  createEngineV2Server,
  verifyEngineV2Application,
} from '../sdk/tooling/cli/src/engine-v2-runner.mjs';
const server = createEngineV2Server(
  verifyEngineV2Application('sample/nelyx-demo-app/engine-v2/dist/v2-web', 'web'),
);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true });
const timeout = setTimeout(() => {
  throw Error('Web integration exceeded 20 minutes');
}, 1200000);
try {
  for (const profile of ['isolated', 'plain']) {
    const context = await browser.newContext({ viewport: { width: 960, height: 720 } });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const info = () =>
      page.evaluate(() => {
        const d = globalThis.__nelyxV2?.surface?.diagnostics,
          s = d?.['render-stats']?.state;
        return {
          ready: globalThis.__nelyxV2?.ready,
          errors: globalThis.__nelyxV2?.errors,
          offset: d?.['render-stats']?.scrollOffsets,
          doc: String(s?.document),
          published: String(s?.publishedDocument),
          preparation: String(s?.preparation),
          pending: String(s?.pendingDocument),
          input: globalThis.__nelyxV2?.surface.inputStats,
          received: String(s?.received),
          consumed: String(s?.consumed),
          canceled: String(s?.canceled),
          rejected: String(s?.rejected),
          queued: s?.queued,
          layout: String(s?.layoutWork),
          measure: d?.['content-stats']?.counters.measurements,
        };
      });
    try {
      await page.goto(`http://127.0.0.1:${server.address().port}/${profile}/`);
      await page.waitForFunction(() => __nelyxV2?.ready || __nelyxV2?.errors.length);
      console.log(profile, 'ready');
      assert((await info()).ready);
      await page.mouse.click(202, 226);
      await page.waitForFunction(() => document.querySelector('[aria-label="Filled pressed"]'));
      console.log(profile, 'clicked');
      await page.mouse.move(800, 400);
      await page.mouse.wheel(0, 440);
      await page.waitForFunction(
        () => __nelyxV2.surface.diagnostics['render-stats'].scrollOffsets[0] >= 430,
      );
      console.log(profile, 'click-then-wheel admitted');
      await page.waitForTimeout(500);
      const before = await info();
      for (const delta of [20, -20, 20, -20]) {
        const old = (await info()).offset[0];
        await page.mouse.wheel(0, delta);
        await page.waitForFunction(
          (target) =>
            Math.abs(__nelyxV2.surface.diagnostics['render-stats'].scrollOffsets[0] - target) < 1,
          old + delta,
        );
      }
      const after = await info();
      console.log(profile, 'warm', { before, after });
      assert.equal(after.layout, before.layout);
      assert.equal(after.measure, before.measure);
      await page.mouse.wheel(0, 2000);
      await page.waitForFunction(
        () => __nelyxV2.surface.diagnostics['render-stats'].scrollOffsets[0] > 1000,
      );
      await page.mouse.wheel(0, -3500);
      await page.waitForFunction(
        () => __nelyxV2.surface.diagnostics['render-stats'].scrollOffsets[0] === 0,
      );
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.waitForFunction(() => {
        const s = __nelyxV2.surface.diagnostics['render-stats'].state;
        return s.viewport.width === 1280 && s.publishedMetrics === s.metrics;
      });
      assert.deepEqual((await info()).errors, []);
      assert.deepEqual(errors, []);
      const closed = await page.evaluate(() => __nelyxV2.close());
      assert.equal(closed.reservedBytes, 0);
      assert.equal(closed.workersStopped, true);
      console.log(profile, 'PASS', {
        reservedBytes: closed.reservedBytes,
        workersStopped: closed.workersStopped,
      });
    } catch (e) {
      console.log(profile, 'FAILED', await info());
      throw e;
    } finally {
      await context.close();
    }
  }
} finally {
  clearTimeout(timeout);
  await browser.close();
  await new Promise((r) => server.close(r));
}
