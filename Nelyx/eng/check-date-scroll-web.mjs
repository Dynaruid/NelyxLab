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
const timer = setTimeout(() => {
  throw Error('Date scrolling exceeded 20 minutes');
}, 1200000);
try {
  for (const profile of process.argv.includes('--plain')
    ? ['plain']
    : process.argv.includes('--both')
      ? ['isolated', 'plain']
      : ['isolated']) {
    const context = await browser.newContext({ viewport: { width: 960, height: 720 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (message) => {
      if (message.text().startsWith('DATEPREP')) console.log(message.text());
    });
    await page.route('**/application/app.js', async (route) => {
      const response = await route.fetch();
      const original = await response.text();
      const instrumented = original
        .replace(
          'for (const event of state2.events) {',
          'for (const event of state2.events) { if(event.kind===3)console.error("DATEPREP", event.status, JSON.stringify(event.node));',
        )
        .replace(
          /hosts\.set\(view, (host\d*)\);/,
          'hosts.set(view, $1); globalThis.__dateScrollHost = $1;',
        );
      assert.notEqual(instrumented, original, 'Host instrumentation point missing');
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
          .evaluate((e) => e.click());
      await activate('Explore components');
      await activate('Selection');
      await activate('Choose date');
      await page.getByRole('button', { name: /^1, / }).waitFor();
      const idle = () =>
        page.waitForFunction(() => {
          const failure = __nelyxV2.surface.diagnostics['preparation-error'];
          if (failure) throw Error(JSON.stringify(failure));
          const s = __nelyxV2.surface.diagnostics['render-stats']?.state;
          if (s && s.failedDocument > s.publishedDocument)
            throw Error('Core preparation failed: ' + s.failedDocument);
          return (
            s &&
            !s.renderWake &&
            !s.preparation &&
            s.document === s.publishedDocument &&
            s.nextDeadline === null
          );
        });
      await idle();
      const worker = page.workers().find((w) => w.url().includes('/application/app.js'));
      assert(worker);
      if (process.argv.includes('--precision'))
        await worker.evaluate(() => {
          const h = globalThis.__dateScrollHost,
            original = h.rebuildFromContent.bind(h);
          h.rebuildFromContent = async (state) => {
            if (state?.layoutBuildRequest) await new Promise((resolve) => setTimeout(resolve, 60));
            return original(state);
          };
          const update = h.native.update.bind(h.native);
          h.native.update = async (scene) => {
            await new Promise((resolve) => setTimeout(resolve, 120));
            return update(scene);
          };
        });
      const settled = () =>
        worker.evaluate(async () => {
          const h = globalThis.__dateScrollHost,
            start = performance.now();
          while (performance.now() - start < 15000) {
            const s = await h.view.inspectState();
            if (
              !h.running &&
              !h.rerun &&
              !h.scheduled &&
              !h.native.observationRunning &&
              !h.native.observationPending &&
              !s.preparation &&
              s.document === s.publishedDocument &&
              h.native.layoutObservation?.property === s.property &&
              h.native.layoutObservation?.metrics === s.metrics &&
              h.native.layoutObservation?.activePreparation === s.activePreparation
            )
              return;
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          throw Error('Calendar App preparation did not settle');
        });
      await settled();
      const sample = async (step, elapsedMs) => {
        const value = await worker.evaluate(async () => {
          const h = globalThis.__dateScrollHost,
            s = await h.view.inspectState();
          let elements = 0;
          const lists = [];
          const ink = [];
          const visit = (e) => {
            ++elements;
            const t = e.stateObject;
            if (t?.entries instanceof Map)
              lists.push({
                kind: t.constructor.name,
                size: t.entries.size,
                begin: t.begin,
                end: t.end,
                focused: t.focused,
                retained:
                  t.controller?.initialPage === undefined
                    ? undefined
                    : [...t.entries.values()].map((e) => ({
                        index: e.index,
                        keepAlive: e.render?.children[0]?.parentData?.keepAlive,
                      })),
              });
            if (t?.highlights instanceof Map && t.highlights.size)
              ink.push({
                hovered: t.hovered,
                keepAlive: t.wantKeepAlive,
                highlights: [...t.highlights.keys()],
              });
            for (const child of e.children) visit(child);
          };
          visit(h.root);
          return JSON.parse(
            JSON.stringify(
              {
                elements,
                lists,
                ink,
                semantics: [...h.native.accepted.values()].filter((r) => r.node.options.semantics)
                  .length,
                accepted: h.native.accepted.size,
                builders: h.layoutBuilders.size,
                slivers: h.slivers.size,
                state: Object.fromEntries(
                  Object.entries(s).filter(
                    ([k, v]) =>
                      /node|memory|reserved|layoutWork|document|failed/i.test(k) &&
                      typeof v !== 'object',
                  ),
                ),
                scene: h.diagnostics().scene,
                capture: h.diagnostics().capture,
                retainedBuilderRebuilds: h.diagnostics().retainedBuilderRebuilds,
                samples: h.diagnostics().samples,
                samplesThrough: h.diagnostics().samplesThrough,
                samplesOverwritten: h.diagnostics().samplesOverwritten,
                transport: h.diagnostics().transport,
              },
              (k, v) => (typeof v === 'bigint' ? String(v) : v),
            ),
          );
        });
        console.log(
          JSON.stringify({
            profile,
            step,
            elapsedMs,
            nodes: value.accepted,
            elements: value.elements,
            builders: value.builders,
            bytes: value.state.reservedBytes,
            layout: value.state.layoutWork,
            transactions: value.scene.transactions,
            builds: value.scene.builds,
            retainedBuilderRebuilds: value.retainedBuilderRebuilds,
            captured: value.capture.captured,
            dynamic: value.capture.dynamic,
            recordVisits: value.scene.recordVisits,
            skippedSubtreeNodes: value.scene.skippedSubtreeNodes,
            journalRecords: value.scene.journalRecords,
            recordsMs: value.scene.recordsMs,
            diffMs: value.scene.diffMs,
            transport: value.transport,
            samplesThrough: value.samplesThrough,
            samplesOverwritten: value.samplesOverwritten,
          }),
        );
        if (value.elements > 6000)
          console.log(
            'GROWN_CALENDAR',
            JSON.stringify({ lists: value.lists, ink: value.ink, semantics: value.semantics }),
          );
        assert.deepEqual(await page.evaluate(() => __nelyxV2.errors), []);
        assert.equal(
          await page.evaluate(() => __nelyxV2.surface.diagnostics['preparation-error']),
          undefined,
        );
        return value;
      };
      const baseline = await sample(0, 0);
      let final = baseline;
      const gridPoint = await page.getByRole('button', { name: /^15, / }).first().boundingBox();
      assert(gridPoint);
      const burst = process.argv.includes('--burst');
      const keepAlive = process.argv.includes('--keep-alive');
      const pastOnly = process.argv.includes('--past-only');
      const steps = process.argv.includes('--resize-only') ? 0 : pastOnly ? 24 : 12;
      const initialMonth = await page
        .getByRole('button', { name: /^Select year/ })
        .getAttribute('aria-label');
      let burstStarted = 0;
      for (let step = 1; step <= steps; ++step) {
        if (keepAlive)
          await worker.evaluate(() => {
            const visit = (e) => {
              const t = e.stateObject;
              if (t?.controller?.initialPage !== undefined && t.entries instanceof Map)
                for (const entry of t.entries.values()) {
                  const data = entry.render?.children[0]?.parentData;
                  // Model persistent Source KeepAlive owners, including pages far
                  // outside the cache window. Their State must remain mounted,
                  // but their native geometry and semantics must not accumulate.
                  if (
                    data &&
                    Object.getOwnPropertyDescriptor(data, 'keepAlive')?.configurable !== false
                  )
                    Object.defineProperty(data, 'keepAlive', {
                      get: () => true,
                      set: () => {},
                      configurable: false,
                    });
                }
              for (const child of e.children) visit(child);
            };
            visit(globalThis.__dateScrollHost.root);
          });
        await page.mouse.move(
          gridPoint.x + gridPoint.width / 2,
          gridPoint.y + gridPoint.height / 2,
        );
        const before = await page
          .getByRole('button', { name: /^Select year/ })
          .getAttribute('aria-label');
        const started = performance.now();
        if (step % 6 === 1) burstStarted = started;
        if (process.argv.includes('--precision')) {
          await worker.evaluate(
            async ({ direction, x, y }) => {
              const h = globalThis.__dateScrollHost;
              let position;
              const visit = (e) => {
                if (e.stateObject?.controller?.initialPage !== undefined)
                  position = e.stateObject.position;
                for (const child of e.children) visit(child);
              };
              visit(h.root);
              if (!position?.node) throw Error('Page viewport unavailable');
              const send = async (phase, dx, velocity) => {
                const s = await h.view.inspectState(),
                  bytes = new Uint8Array(128),
                  v = new DataView(bytes.buffer);
                v.setBigUint64(0, s.lastInput + 1n, true);
                v.setBigUint64(8, s.metrics, true);
                v.setUint32(16, position.node.slot, true);
                v.setUint32(20, position.node.generation, true);
                v.setUint32(24, 2, true);
                v.setUint32(28, phase, true);
                v.setUint32(32, 1, true);
                v.setFloat64(40, performance.now() / 1000, true);
                v.setFloat64(56, x, true);
                v.setFloat64(64, y, true);
                v.setFloat64(72, dx, true);
                v.setFloat64(88, velocity, true);
                v.setUint32(96, 1, true);
                v.setUint32(108, 3, true);
                v.setUint32(112, 2, true);
                v.setBigUint64(120, 0n, true);
                const result = await h.view.request(8, bytes);
                if (result.status !== 0) throw Error('Precision packet rejected: ' + result.status);
              };
              await send(1, 0, 0);
              for (let i = 0; i < 6; ++i) {
                await send(2, direction * 100, direction * 1800);
                await new Promise((resolve) => setTimeout(resolve, 16));
              }
              await send(3, 0, direction * 1800);
            },
            {
              direction: pastOnly
                ? -1
                : process.argv.includes('--reverse')
                  ? step % 2
                    ? -1
                    : 1
                  : step <= 6
                    ? 1
                    : -1,
              x: gridPoint.x + gridPoint.width / 2,
              y: gridPoint.y + gridPoint.height / 2,
            },
          );
        } else await page.mouse.wheel(pastOnly ? -340 : step <= 6 ? 340 : -340, 0);
        if (burst && step % 6 !== 0) {
          await page.waitForTimeout(20);
          continue;
        }
        if (!burst)
          await page.waitForFunction((previous) => {
            const e = [...document.querySelectorAll('[aria-label]')].find((e) =>
              e.getAttribute('aria-label')?.startsWith('Select year'),
            );
            return e && e.getAttribute('aria-label') !== previous;
          }, before);
        await idle();
        // A spring's last publication can precede the next App preparation.
        await page.waitForTimeout(300);
        await idle();
        await settled();
        final = await sample(
          step,
          Math.round(performance.now() - (burst ? burstStarted : started)),
        );
        assert(final.accepted <= baseline.accepted + 100, 'Calendar nodes accumulated');
        assert(
          final.elements <= baseline.elements + (keepAlive ? 15000 : 300),
          'Calendar Elements accumulated',
        );
        assert(
          final.semantics <= baseline.semantics + 40,
          'Offscreen calendar semantics accumulated',
        );
        assert(final.builders <= baseline.builders + 1, 'Calendar builders accumulated');
        assert(
          BigInt(final.state.reservedBytes) <=
            BigInt(baseline.state.reservedBytes) + 16n * 1024n * 1024n,
          'Calendar Core reservations accumulated',
        );
      }
      assert(
        final.scene.transactions - baseline.scene.transactions <= Math.max(72, steps * 6),
        'Retained month rebuilds need too many transactions',
      );
      const monthBeforeResize = await page
        .getByRole('button', { name: /^Select year/ })
        .getAttribute('aria-label');
      if (pastOnly) {
        assert(
          new Date(monthBeforeResize.replace(/^Select year\s*/, '')) <
            new Date(initialMonth.replace(/^Select year\s*/, '')),
          'Past-only precision run did not move into earlier months',
        );
      }
      await page.setViewportSize({ width: 640, height: 900 });
      await page.waitForTimeout(300);
      await idle().catch(async (error) => {
        console.log(
          'RENDER_FAILURE',
          await page.evaluate(() => __nelyxV2.surface.diagnostics['render-stats']?.events),
        );
        console.log(
          'RESIZE_FAILURE',
          await worker.evaluate(async () => {
            const h = globalThis.__dateScrollHost;
            return JSON.stringify(
              {
                events: (await h.view.request(15)).events.filter((e) => e.kind === 3),
                state: await h.view.inspectState(),
                builder: h.diagnostics().layoutBuilder,
                scrolls: (await h.view.layoutSnapshot()).nodes
                  .filter((n) => n.list || n.kind === 11)
                  .map((n) => ({
                    node: n.node,
                    width: n.width,
                    height: n.height,
                    offset: n.offset,
                    requested: n.requestedOffset,
                    list: n.list,
                  })),
              },
              (k, v) => (typeof v === 'bigint' ? String(v) : v),
            );
          }),
        );
        throw error;
      });
      await page.getByRole('button', { name: /^15, / }).first().waitFor();
      assert.equal(
        await page.getByRole('button', { name: /^Select year/ }).getAttribute('aria-label'),
        monthBeforeResize,
        'Resize changed the logical month',
      );
      await sample('resized', 0);
      assert.deepEqual(errors, []);
    } catch (error) {
      const worker = page.workers().find((w) => w.url().includes('/application/app.js'));
      console.log(
        'CALENDAR_FAILURE',
        await worker
          ?.evaluate(async () => {
            const h = globalThis.__dateScrollHost;
            return JSON.stringify(
              {
                state: await h.view.inspectState(),
                running: !!h.running,
                rerun: h.rerun,
                scheduled: h.scheduled,
                diagnostics: h.diagnostics(),
                scrolls: (await h.view.layoutSnapshot()).nodes
                  .filter((n) => n.list || n.kind === 11)
                  .map((n) => ({
                    node: n.node,
                    offset: n.offset,
                    requested: n.requestedOffset,
                    list: n.list,
                  })),
              },
              (_, value) => (typeof value === 'bigint' ? String(value) : value),
            );
          })
          .catch(String),
      );
      throw error;
    } finally {
      console.log(
        profile,
        'closed',
        await page
          .evaluate(async () => {
            const r = await __nelyxV2?.close();
            return { reservedBytes: r?.reservedBytes, workersStopped: r?.workersStopped };
          })
          .catch(String),
      );
      await context.close();
    }
  }
} finally {
  clearTimeout(timer);
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
