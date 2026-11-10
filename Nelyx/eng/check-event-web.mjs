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
          preparationError: d?.['preparation-error'],
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
      // Finish the click animation and initial prefetch before measuring reuse.
      await page.waitForFunction(() => {
        const s = __nelyxV2.surface.diagnostics['render-stats']?.state;
        if (
          !s ||
          s.preparation ||
          s.document !== s.publishedDocument ||
          s.renderWake ||
          s.nextDeadline !== null
        ) {
          delete globalThis.__warmObservation;
          return false;
        }
        const key = `${s.document}/${s.layoutWork}`;
        const previous = globalThis.__warmObservation;
        if (!previous || previous.key !== key) {
          globalThis.__warmObservation = { key, at: performance.now() };
          return false;
        }
        return performance.now() - previous.at >= 250;
      });
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
      if (process.argv.includes('--extended')) {
        // Exercise registration lifetimes under retained static ancestors.
        // These are semantic actions, separate from the physical-pointer smoke above.
        const named = (name) =>
          page
            .locator(
              `[aria-label=${JSON.stringify(name)}], [aria-description=${JSON.stringify(name)}]`,
            )
            .first();
        const activate = (name) => named(name).evaluate((el) => el.click());
        await activate('Switch to dark mode');
        await named('Switch to light mode').waitFor();
        await activate('Switch to light mode');
        await named('Switch to dark mode').waitFor();
        for (const group of ['Navigation', 'Selection', 'Images', 'Text inputs']) {
          await activate('Explore components');
          await activate(group);
          await page.getByRole('button', { name: 'Show all', exact: true }).waitFor();
          if (group === 'Navigation') {
            await activate('Favorites');
            await page.waitForFunction(() =>
              document.querySelector('[aria-label*="Favorites selected"]'),
            );
          }
          if (group === 'Selection') {
            const idle = () =>
              page.waitForFunction(() => {
                const s = __nelyxV2.surface.diagnostics['render-stats']?.state;
                return (
                  s &&
                  !s.renderWake &&
                  !s.preparation &&
                  s.document === s.publishedDocument &&
                  s.nextDeadline === null
                );
              });
            const year = new Date().getFullYear(),
              month = new Date().getMonth();
            const monthName = (year, month) =>
              new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
                new Date(year, month, 1),
              );
            const title = () => page.getByRole('button', { name: /^Select year/ });
            const day = (year, month, date) =>
              page.getByRole('button', {
                name: new RegExp(
                  '^' +
                    date +
                    ', ' +
                    new Intl.DateTimeFormat('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })
                      .format(new Date(year, month, date))
                      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                ),
              });
            const dateOpenStarted = performance.now();
            await activate('Choose date');
            await page.getByRole('dialog').waitFor();
            const dateDialogMs = performance.now() - dateOpenStarted;
            await title().waitFor();
            await day(year, month, new Date().getDate()).waitFor();
            console.log(profile, 'date first accessible grid', {
              dialogMs: Math.round(dateDialogMs),
              gridMs: Math.round(performance.now() - dateOpenStarted),
            });
            // Act on the first visible grid, including while neighbours prepare.
            await activate('Next month');
            await page
              .getByRole('button', {
                name: new RegExp('^Select year\\s+' + monthName(year, month + 1)),
              })
              .waitFor();
            await idle();
            await activate('Previous month');
            await page
              .getByRole('button', {
                name: new RegExp('^Select year\\s+' + monthName(year, month)),
              })
              .waitFor();
            await idle();
            await title().evaluate((el) => el.click());
            await activate(String(year + 1));
            await day(year + 1, month, 15).waitFor();
            await idle();
            const selected = `${year + 1}-${String(month + 1).padStart(2, '0')}-15`;
            await day(year + 1, month, 15).evaluate((el) => el.click());
            await page.waitForFunction(() =>
              document.querySelector('[role="button"][aria-label^="15, "][aria-selected="true"]'),
            );
            await activate('OK');
            await named('Selected date: ' + selected).waitFor();
            await page.getByRole('dialog').waitFor({ state: 'detached' });
            await activate('Choose date');
            await day(year + 1, month, 15).waitFor();
            await idle();
            assert.equal(await day(year + 1, month, 15).getAttribute('aria-selected'), 'true');
            await activate('Previous month');
            await idle();
            await activate('Cancel');
            await page.getByRole('dialog').waitFor({ state: 'detached' });
            await named('Choose date').waitFor();
            await activate('Choose date');
            await day(year + 1, month, 15).waitFor();
            await idle();
            assert.equal(await day(year + 1, month, 15).getAttribute('aria-selected'), 'true');
            await activate('Switch to input');
            const dateField = page.getByRole('textbox');
            const editDate = async (text) => {
              const before = await page.evaluate(
                () => __nelyxV2.surface.diagnostics.interaction.edits,
              );
              await dateField.fill(text);
              await page.waitForFunction(
                (previous) => __nelyxV2.surface.diagnostics.interaction.edits > previous,
                before,
              );
              await page.evaluate(() => {
                delete globalThis.__dateEditingSettled;
              });
              await page.waitForFunction(() => {
                const s = __nelyxV2.surface.diagnostics['render-stats'].state;
                if (s.preparation || s.document !== s.publishedDocument) {
                  delete globalThis.__dateEditingSettled;
                  return false;
                }
                const key = `${s.document}/${s.layoutWork}`,
                  previous = globalThis.__dateEditingSettled;
                if (!previous || previous.key !== key) {
                  globalThis.__dateEditingSettled = { key, at: performance.now() };
                  return false;
                }
                return performance.now() - previous.at >= 150;
              });
              assert.equal(await dateField.inputValue(), text);
            };
            await editDate('02/30/2024');
            await activate('OK');
            await named('Invalid format.').waitFor();
            await editDate('02/29/2024');
            await activate('OK');
            await named('Selected date: 2024-02-29').waitFor();
            await page.getByRole('dialog').waitFor({ state: 'detached' });
            console.log(
              profile,
              'original date picker month/year/day, confirm/cancel/reopen and input validation PASS',
            );
          }
          if (group === 'Images') {
            await page.waitForFunction(
              () => __nelyxV2.surface.diagnostics['content-stats']?.counters.images > 0,
            );
            await activate('Contain');
          }
          if (group === 'Text inputs') {
            const field = page.getByRole('textbox').first();
            await field.fill('capture');
            assert.equal(await field.inputValue(), 'capture');
          }
          await activate('Show all');
          await page.getByRole('button', { name: 'Filled', exact: true }).waitFor();
        }
        console.log(profile, 'theme, route, image and editor lifetimes PASS');
      }
      assert.deepEqual((await info()).errors, []);
      assert.equal((await info()).preparationError, undefined);
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
      console.log(
        'Current semantic labels',
        await page.locator('[aria-label]').evaluateAll((nodes) =>
          nodes
            .map((n) => ({
              role: n.getAttribute('role'),
              label: n.getAttribute('aria-label'),
              hint: n.getAttribute('aria-description'),
            }))
            .filter((n) => n.label || n.hint)
            .slice(0, 60),
        ),
      );
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
