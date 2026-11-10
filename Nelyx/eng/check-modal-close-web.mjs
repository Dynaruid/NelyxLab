// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import {
  createEngineV2Server,
  verifyEngineV2Application,
} from '../sdk/tooling/cli/src/engine-v2-runner.mjs';

const bundle = verifyEngineV2Application('sample/nelyx-demo-app/engine-v2/dist/v2-web', 'web');
const server = createEngineV2Server(bundle);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
const watchdog = setTimeout(() => {
  throw Error('Modal lifetime checks exceeded 20 minutes');
}, 1200000);
const cycles = Number(process.argv[process.argv.indexOf('--cycles') + 1]) || 4;
assert(cycles > 0 && cycles <= 12);
try {
  for (const profile of process.argv.includes('--plain') ? ['plain'] : ['isolated', 'plain']) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.setDefaultTimeout(15000);
    await page.route('**/application/app.js', async (route) => {
      const response = await route.fetch(),
        original = await response.text();
      const instrumented = original.replace(
        /hosts\.set\(view, (host\d*)\);/,
        'hosts.set(view, $1); globalThis.__modalHost=$1;',
      );
      assert.notEqual(original, instrumented);
      await route.fulfill({ response, body: instrumented });
    });
    try {
      await page.goto(`http://127.0.0.1:${server.address().port}/${profile}/`);
      await page.waitForFunction(() => __nelyxV2?.ready || __nelyxV2?.errors.length);
      const activate = (name) =>
        page
          .locator(
            `[aria-label=${JSON.stringify(name)}], [aria-description=${JSON.stringify(name)}]`,
          )
          .first()
          .evaluate((element) => element.click());
      await activate('Explore components');
      await activate('Selection');
      let year = new Date().getFullYear();
      for (let cycle = 0; cycle < cycles; ++cycle) {
        await activate('Choose date');
        const title = page.getByRole('button', { name: /^Select year/ });
        await title.waitFor();
        await title.evaluate((element) => element.click());
        await activate(String(++year));
        const day = page.getByRole('button', { name: new RegExp('^15, .*' + year + '$') }).first();
        await day.waitFor();
        // Deliberately confirm the first published selection, without waiting
        // for unrelated adjacent-month preparation or an idle animation clock.
        await day.evaluate((element) => element.click());
        await page.waitForFunction(() =>
          document.querySelector('[role="button"][aria-label^="15, "][aria-selected="true"]'),
        );
        await activate('OK');
        await page.getByRole('dialog').waitFor({ state: 'detached' });
        console.log(profile, 'year/day/confirm/reopen', cycle + 1, 'PASS');
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(await page.evaluate(() => __nelyxV2.errors), []);
    } catch (error) {
      for (const worker of page.workers()) {
        const diagnostic = await worker
          .evaluate(async () => {
            const h = globalThis.__modalHost;
            if (!h) return null;
            const routes = [];
            const visit = (element) => {
              const owner = element.state?.transitionOwner;
              if (owner)
                routes.push({
                  live: owner.live.length,
                  rendered: owner.rendered.length,
                  exiting: owner.exiting.size,
                  pending: owner.pendingRetirements.size,
                  motions: [...owner.motions.values()].map((motion) => ({
                    value: motion.primary.value,
                    status: motion.primary.status,
                    animating: motion.primary.isAnimating,
                  })),
                });
              for (const child of element.children) visit(child);
            };
            visit(h.root);
            const full = await h.view.request(33);
            const scheduler = h.scrolling.scheduler;
            const value = {
              running: !!h.running,
              rerun: h.rerun,
              scheduled: h.scheduled,
              scheduler: {
                phase: scheduler.phase,
                scheduled: scheduler.hasScheduledFrame,
                transient: scheduler.transientCallbackCount,
                post: scheduler.post.length,
                pendingPostFrame: scheduler.pendingPostFrame,
              },
              routes,
              samples: h.diagnostics().samples.slice(-8),
              full: {
                document: full.document,
                published: full.publishedDocument,
                dialogs: full.nodes
                  .filter((n) => n.semantics?.role === 13)
                  .map((n) => ({
                    node: n.node,
                    flags: n.flags,
                    opacity: n.opacity,
                    semantics: n.semantics,
                  })),
              },
            };
            return JSON.parse(
              JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? String(v) : v)),
            );
          })
          .catch(String);
        if (diagnostic) console.log(profile, 'MODAL_DIAGNOSTIC', JSON.stringify(diagnostic));
      }
      throw error;
    } finally {
      console.log(
        profile,
        'close',
        await page
          .evaluate(() => __nelyxV2.close())
          .then(
            (closed) => ({
              reservedBytes: String(closed.reservedBytes),
              workersStopped: closed.workersStopped,
            }),
            String,
          ),
      );
      await context.close();
    }
  }
} finally {
  clearTimeout(watchdog);
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
