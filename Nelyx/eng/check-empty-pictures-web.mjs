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
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
const watchdog = setTimeout(() => {
  throw Error('Empty picture pixel oracle exceeded 20 minutes');
}, 1200000);
try {
  for (const profile of ['isolated', 'plain']) {
    const oracle = [];
    for (const elide of [false, true]) {
      const context = await browser.newContext({
        viewport: { width: 960, height: 720 },
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      let patched = 0;
      try {
        await page.route('**/*.js', async (route) => {
          const response = await route.fetch();
          let body = await response.text();
          if (route.request().url().endsWith('/application/app.js')) {
            const original = body;
            body = body.replace(
              /hosts\.set\(view, (host\d*)\);/,
              'hosts.set(view, $1); globalThis.__pictureHost=$1;',
            );
            assert.notEqual(body, original, 'App diagnostic owner missing');
          }
          if (
            !elide &&
            /\/(owner|coordinator)\.js$/.test(route.request().url()) &&
            body.includes('function emptyOwnPicture(node) {')
          ) {
            body = body.replace(
              'function emptyOwnPicture(node) {',
              'function emptyOwnPicture(node) { return false;',
            );
            ++patched;
          }
          await route.fulfill({ response, body });
        });
        await page.goto(`http://127.0.0.1:${server.address().port}/${profile}/`);
        await page.waitForFunction(() => __nelyxV2?.ready || __nelyxV2?.errors.length);
        assert.deepEqual(await page.evaluate(() => __nelyxV2.errors), []);
        const worker = page
          .workers()
          .find((worker) => worker.url().includes('/application/app.js'));
        assert(worker);
        const click = (label) =>
          page
            .locator(
              `[aria-label=${JSON.stringify(label)}], [aria-description=${JSON.stringify(label)}]`,
            )
            .first()
            .evaluate((element) => element.click());
        const settle = async () => {
          await worker.evaluate(async (viewport) => {
            const host = globalThis.__pictureHost,
              scheduler = host.scrolling.scheduler,
              start = performance.now();
            while (performance.now() - start < 15000) {
              const state = await host.view.inspectState();
              if (
                !host.running &&
                !host.scheduled &&
                !host.rerun &&
                !state.preparation &&
                state.document === state.publishedDocument &&
                state.metrics === state.publishedMetrics &&
                state.viewport?.width === viewport.width &&
                state.viewport?.height === viewport.height &&
                !host.native.observationRunning &&
                !host.native.observationPending &&
                scheduler.phase === 'idle' &&
                !scheduler.hasScheduledFrame &&
                !scheduler.transientCallbackCount &&
                !scheduler.pendingPostFrame &&
                state.nextDeadline === null
              )
                return;
              await new Promise((resolve) => setTimeout(resolve, 10));
            }
            const state = await host.view.inspectState();
            throw Error(
              'Picture oracle did not settle: ' +
                JSON.stringify(
                  {
                    document: state.document,
                    active: state.activeDocument,
                    published: state.publishedDocument,
                    preparation: state.preparation,
                    renderWake: state.renderWake,
                    nextDeadline: state.nextDeadline,
                    running: host.running,
                    scheduled: host.scheduled,
                    rerun: host.rerun,
                    phase: scheduler.phase,
                    scheduledFrame: scheduler.hasScheduledFrame,
                    transient: scheduler.transientCallbackCount,
                    post: scheduler.pendingPostFrame,
                  },
                  (_key, value) => (typeof value === 'bigint' ? String(value) : value),
                ),
            );
          }, page.viewportSize());
          assert.deepEqual(errors, []);
          assert.deepEqual(await page.evaluate(() => __nelyxV2.errors), []);
        };
        const capture = async (index) => {
          await settle();
          const pixels = await page.locator('canvas').first().screenshot();
          if (!elide) oracle.push(pixels);
          else
            assert(
              pixels.equals(oracle[index]),
              `${profile} canvas pixels changed at stage ${index}`,
            );
        };
        await click('Explore components');
        await capture(0);
        await click('Selection');
        await click('Choose date');
        await page.getByRole('button', { name: /^15, / }).waitFor();
        await capture(1);
        const title = await page
          .getByRole('button', { name: /^Select year/ })
          .getAttribute('aria-label');
        await click('Previous month');
        await page.waitForFunction((title) => {
          const header = [...document.querySelectorAll('[aria-label]')].find((node) =>
            node.getAttribute('aria-label')?.startsWith('Select year'),
          );
          return header && header.getAttribute('aria-label') !== title;
        }, title);
        await capture(2);
        await page.setViewportSize({ width: 720, height: 960 });
        await capture(3);
        const counters = await page.evaluate(
          () => __nelyxV2.surface.diagnostics['content-stats']?.counters,
        );
        if (elide) assert(counters.emptyPicturesSkipped > 0);
        else {
          assert(patched > 0, 'Full-recording oracle was not installed');
          assert.equal(counters.emptyPicturesSkipped, 0);
        }
        console.log(
          JSON.stringify({
            profile,
            elide,
            pictures: counters.pictures,
            reused: counters.reusedPictures,
            skipped: counters.emptyPicturesSkipped,
          }),
        );
      } finally {
        try {
          const closed = await page.evaluate(async () => {
            const result = await __nelyxV2.close();
            return { bytes: String(result.reservedBytes), workers: result.workersStopped };
          });
          assert.equal(closed.bytes, '0');
          assert.equal(closed.workers, true);
        } finally {
          await context.close();
        }
      }
    }
    console.log(
      profile +
        ' full-recording/empty-elision pixels equal at gallery, calendar, month and resize; close PASS',
    );
  }
} finally {
  clearTimeout(watchdog);
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
