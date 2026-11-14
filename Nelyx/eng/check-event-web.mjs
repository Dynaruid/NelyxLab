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
  for (const profile of process.argv.includes('--plain') ? ['plain'] : ['isolated', 'plain']) {
    const scale = process.argv.includes('--dpr2') ? 2 : 1;
    const context = await browser.newContext({
      viewport: { width: 960, height: 720 },
      deviceScaleFactor: scale,
    });
    const page = await context.newPage();
    // This Chromium/CDP runner emits half the requested wheel delta at DPR2.
    // Calibrated on an independent canvas: request logical CSS pixel motion.
    const wheel = (delta) => page.mouse.wheel(0, delta * scale);
    page.setDefaultTimeout(15000);
    const errors = [];
    const intercept = (pattern, handler) =>
      page.route(pattern, async (route) => {
        try {
          await handler(route);
        } catch (error) {
          errors.push(String(error));
          await route.abort().catch(() => {});
        }
      });
    if (process.argv.includes('--full-provider-frames'))
      await intercept(/\/(owner|coordinator)\.js$/, async (route) => {
        const fetched = await route.fetch(),
          original = await fetched.text(),
          marker = 'deltaEnabled = true;';
        assert.equal(original.split(marker).length, 2, 'Provider frame oracle hook missing');
        await route.fulfill({
          response: fetched,
          body: original.replace(marker, 'deltaEnabled = false;'),
        });
      });
    if (process.argv.includes('--diagnose'))
      await intercept('**/application/main.js', async (route) => {
        const fetched = await route.fetch(),
          original = await fetched.text(),
          marker = 'throw new Error("Engine input rejected: " + state.status);';
        assert.equal(original.split(marker).length, 2, 'Input diagnostic rejection hook missing');
        const start = original.indexOf('async dispatch(peer, action) {'),
          end = original.indexOf('    async customAction(', start);
        assert(start >= 0 && end > start, 'Semantic dispatch diagnostic hook missing');
        let method = original.slice(start, end);
        const current = method.match(/const (\w+) = scene\.nodes\.find\(/)?.[1];
        assert(current, 'Semantic target diagnostic hook missing');
        method = method.replace(
          'async dispatch(peer, action) {',
          `async dispatch(peer, action) {
          const audit={action,name:peer.element.getAttribute('aria-label')||peer.element.getAttribute('aria-description'),
            connected:peer.element.isConnected,node:peer.node.node,publication:String(peer.publication),attempts:[]},
            history=globalThis.__semanticAttempts??=[];
          if(history.length===64)history.shift();history.push(audit);`,
        );
        method = method.replace(
          new RegExp(`if \\(!${current}\\)\\s+return null;`),
          `if(!${current}){audit.attempts.push({missing:true,publication:String(scene.publication),
            matches:scene.nodes.filter(n=>(n.semantics?.label||n.semantics?.hint)===audit.name).slice(0,4)
              .map(n=>({node:n.node,actions:n.semantics.actions,flags:n.semantics.flags}))});return null;}`,
        );
        const result = 'const result = response(await this.exchange(packet(op, owner, data)));';
        assert.equal(method.split(result).length, 2, 'Semantic result diagnostic hook missing');
        method = method.replace(
          result,
          `${result}audit.attempts.push({status:result.status,
          publication:String(scene.publication),node:${current}.node,actions:${current}.semantics?.actions,
          flags:${current}.semantics?.flags});`,
        );
        const instrumented = original.slice(0, start) + method + original.slice(end);
        await route.fulfill({
          response: fetched,
          body: instrumented.replace(
            marker,
            `{
            const failures = globalThis.__engineInputFailures ??= [];
            if (failures.length === 32) failures.shift();
            failures.push({status:state.status,phase:value.phase,hover:value.hover,
              collectedPublication:String(value.publication),collectedMetrics:String(value.collectedMetrics),
              publication:String(state.publication),metrics:String(state.metrics),device:String(state.device),
              document:String(state.document),publishedDocument:String(state.publishedDocument),
              visible:state.visible,focused:state.focused,received:String(state.received),consumed:String(state.consumed)});
            ${marker}
          }`,
          ),
        });
      });
    if (process.argv.includes('--diagnose'))
      await intercept('**/application/app.js', async (route) => {
        const response = await route.fetch(),
          body = (await response.text()).replace(
            /hosts\.set\(view, (host\d*)\);/,
            'hosts.set(view, $1); globalThis.__diagnosticHost=$1;',
          );
        await route.fulfill({ response, body });
      });
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
          visible: s?.visible,
          focused: s?.focused,
          browserFocused: document.hasFocus(),
          input: globalThis.__nelyxV2?.surface.inputStats,
          inputFailures: globalThis.__engineInputFailures,
          semanticAttempts: globalThis.__semanticAttempts,
          clickTargets: globalThis.__clickTargets,
          interaction: d?.interaction,
          received: String(s?.received),
          consumed: String(s?.consumed),
          canceled: String(s?.canceled),
          rejected: String(s?.rejected),
          queued: s?.queued,
          layout: String(s?.layoutWork),
          measure: d?.['content-stats']?.counters.measurements,
          preparationError: d?.['preparation-error'],
          frameStream: d?.['render-stats']?.frameStream,
          preparationStream: d?.['content-stats']?.preparationStream,
        };
      });
    try {
      await page.goto(`http://127.0.0.1:${server.address().port}/${profile}/`);
      await page.waitForFunction(() => __nelyxV2?.ready || __nelyxV2?.errors.length);
      if (process.argv.includes('--diagnose'))
        for (const worker of page.workers())
          await worker.evaluate(() => {
            const h = globalThis.__diagnosticHost;
            if (!h) return;
            h.routeTrace = [];
            h.actionTrace = [];
            const action = h.native.options.onSemanticAction;
            h.native.options.onSemanticAction = (event, perform) => {
              const source = event.semanticSource ?? event.node;
              const record = [...h.native.accepted.values()].find(
                (candidate) =>
                  candidate.handle.slot === source.slot &&
                  candidate.handle.generation === source.generation,
              );
              const row = {
                node: event.node,
                source,
                label: record?.node.options.semantics?.label,
                detail: String(event.detail),
                publication: String(event.id),
                invoked: false,
              };
              if (h.actionTrace.length === 64) h.actionTrace.shift();
              h.actionTrace.push(row);
              action(event, () => {
                row.invoked = true;
                perform();
              });
            };
            h.routeTokens = new Map();
            h.routeId = (token) => {
              if (!h.routeTokens.has(token)) h.routeTokens.set(token, h.routeTokens.size + 1);
              return h.routeTokens.get(token);
            };
            const visit = (element) => {
              if (!element) return;
              const controller = element.state?.widget?.controller;
              if (element.state?.transitionOwner && controller)
                controller.observeTransitions((event) => {
                  if (h.routeTrace.length === 32) h.routeTrace.shift();
                  h.routeTrace.push({
                    direction: event.direction,
                    from: h.routeId(event.from),
                    to: h.routeId(event.to),
                    at: performance.now(),
                    routes: controller.routes.map((e) => ({
                      id: h.routeId(e.token),
                      name: e.name,
                    })),
                  });
                });
              for (const child of element.children) visit(child);
            };
            visit(h.root);
          });
      console.log(profile, 'ready');
      assert((await info()).ready);
      assert.equal(
        await page.evaluate(
          () => __nelyxV2.surface.diagnostics['render-stats'].state.viewport.scale,
        ),
        scale,
      );
      // This scenario sends OS-style pointer samples. Wait for the button's
      // publication and Core focus acknowledgement before collecting them.
      await page.bringToFront();
      await page.getByRole('button', { name: 'Filled', exact: true }).waitFor();
      await page.waitForFunction(
        () => document.hasFocus() && __nelyxV2.surface.diagnostics['render-stats']?.state.focused,
      );
      await page.mouse.click(202, 226);
      await page.waitForFunction(() => document.querySelector('[aria-label="Filled pressed"]'));
      console.log(profile, 'clicked');
      await page.mouse.move(800, 400);
      await wheel(440);
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
        await wheel(delta);
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
      if (process.argv.includes('--pressure')) {
        const stream = () =>
          page.evaluate(() => __nelyxV2.surface.diagnostics['render-stats'].frameStream);
        const retained = await stream();
        const preparation = (await info()).preparationStream;
        assert(retained.deltas > 0, 'Warm frames did not use the provider delta stream');
        assert(retained.reservedBytes > 0, 'Provider rows have no capacity credit');
        assert.equal(retained.fallbacks, 0);
        assert(preparation.scenes > 0, 'Content did not acquire a preparation scene');
        assert(preparation.reservedBytes > 0, 'Preparation rows have no capacity credit');
        assert.equal(preparation.fallbacks, 0);
        await page.evaluate(() => __nelyxV2.surface.setMemoryPressure(true));
        await page.waitForFunction(
          () => __nelyxV2.surface.diagnostics['memory-pressure']?.low === true,
        );
        const preparationEvicted = await page.evaluate(
          () =>
            __nelyxV2.surface.diagnostics['memory-pressure'].owners.find(
              (owner) => owner.preparationStream,
            ).preparationStream,
        );
        for (const key of [
          'retainedBytes',
          'decodeBytes',
          'reservedBytes',
          'retiredBytes',
          'readers',
        ])
          assert.equal(preparationEvicted[key], 0, 'Preparation pressure retained ' + key);
        const old = (await info()).offset[0];
        await wheel(20);
        await page.waitForFunction((target) => {
          const d = __nelyxV2.surface.diagnostics['render-stats'];
          return (
            Math.abs(d.scrollOffsets[0] - target) < 1 &&
            d.frameStream.reservedBytes === 0 &&
            d.frameStream.retiredBytes === 0 &&
            d.frameStream.readers === 0
          );
        }, old + 20);
        const evicted = await stream();
        assert.equal(evicted.retainedBytes, 0);
        await page.evaluate(() => __nelyxV2.surface.setMemoryPressure(false));
        await page.waitForFunction(
          () => __nelyxV2.surface.diagnostics['memory-pressure']?.low === false,
        );
        await wheel(-20);
        await page.waitForFunction(
          ({ target, fulls }) => {
            const d = __nelyxV2.surface.diagnostics['render-stats'];
            return (
              Math.abs(d.scrollOffsets[0] - target) < 1 &&
              d.frameStream.fulls > fulls &&
              d.frameStream.reservedBytes > 0 &&
              d.frameStream.retiredBytes === 0
            );
          },
          { target: old, fulls: retained.fulls },
        );
        const resumed = await stream();
        assert.equal(resumed.fallbacks, 0);
        console.log(profile, 'provider pressure eviction, live rendering and full resync PASS', {
          before: retained,
          evicted,
          resumed,
          preparationEvicted,
        });
      }
      await wheel(2000);
      await page.waitForFunction(
        () => __nelyxV2.surface.diagnostics['render-stats'].scrollOffsets[0] > 1000,
      );
      await wheel(-3500);
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
          // Gallery headings have the same labels before the drawer publishes.
          // Wait for its actionable peer rather than clicking the first text.
          await page.getByRole('button', { name: group, exact: true }).evaluate((el) => {
            const history = (globalThis.__clickTargets ??= []);
            if (history.length === 16) history.shift();
            history.push({
              name: el.getAttribute('aria-label'),
              node: el.getAttribute('data-nelyx-node'),
              connected: el.isConnected,
              disabled: el.getAttribute('aria-disabled'),
              tag: el.tagName,
            });
            el.click();
          });
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
            if (process.argv.includes('--date-confirm-only')) break;
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
        console.log(
          profile,
          process.argv.includes('--date-confirm-only')
            ? 'compound navigation and date confirmation PASS'
            : 'theme, route, image and editor lifetimes PASS',
        );
      }
      assert.deepEqual((await info()).errors, []);
      assert.equal((await info()).preparationError, undefined);
      assert.deepEqual(errors, []);
      const frameStream = (await info()).frameStream;
      const preparationStream = (await info()).preparationStream;
      assert(frameStream.resizeFrames >= 2, 'Initial and resized GPU backings were not exercised');
      assert.equal(frameStream.retiredBytes, 0);
      assert.equal(frameStream.readers, 0);
      assert(frameStream.fallbacks <= (scale === 1 ? 0 : 1), 'Frame fallback was not bounded');
      if (frameStream.fallbacks) {
        assert.equal(frameStream.reservedBytes, 0);
        assert.equal(frameStream.retainedBytes, 0);
        assert.equal(frameStream.decodeBytes, 0);
      }
      assert.equal(preparationStream.retiredBytes, 0);
      assert.equal(preparationStream.readers, 0);
      assert(
        preparationStream.resizeScenes >= 2,
        'Content was not suspended across surface replacement',
      );
      assert(
        preparationStream.fallbacks <= (scale === 1 ? 0 : 1),
        'Preparation fallback was not bounded',
      );
      if (preparationStream.fallbacks) {
        assert.equal(preparationStream.reservedBytes, 0);
        assert.equal(preparationStream.retainedBytes, 0);
        assert.equal(preparationStream.decodeBytes, 0);
      }
      if (process.argv.includes('--extended')) {
        assert(preparationStream.deltas > 0, 'Content did not use its delta dictionary');
        if (process.argv.includes('--pressure') && !preparationStream.fallbacks)
          assert(preparationStream.fulls > 1, 'Content did not fully resync after pressure');
      }
      const closed = await page.evaluate(() => __nelyxV2.close());
      assert.equal(closed.reservedBytes, 0);
      assert.equal(closed.workersStopped, true);
      console.log(profile, 'PASS', {
        reservedBytes: closed.reservedBytes,
        workersStopped: closed.workersStopped,
        scale,
        frameStream,
        preparationStream,
      });
    } catch (e) {
      console.log(profile, 'FAILED', JSON.stringify(await info()));
      if (process.argv.includes('--diagnose'))
        for (const worker of page.workers())
          console.log(
            'APP DIAGNOSTICS',
            JSON.stringify(
              await worker
                .evaluate(async () => {
                  const h = globalThis.__diagnosticHost;
                  if (!h) return null;
                  const routes = [];
                  const visit = (element) => {
                    if (!element) return;
                    const owner = element.state?.transitionOwner;
                    if (owner)
                      routes.push({
                        mounted: element.state.mounted,
                        controller: element.state.widget.controller.routes.map((e) => ({
                          name: e.name,
                          id: h.routeId?.(e.token),
                          kind: e.route.constructor.name,
                        })),
                        live: owner.live.map((e) => e.name),
                        rendered: owner.rendered.map((e) => e.name),
                        exiting: owner.exiting.size,
                        pending: owner.pendingRetirements.size,
                        motions: [...owner.motions.values()].map((m) => ({
                          value: m.primary.value,
                          status: m.primary.status,
                          animating: m.primary.isAnimating,
                        })),
                      });
                    for (const child of element.children) visit(child);
                  };
                  visit(h.root);
                  const full = await h.view.request(33);
                  return JSON.parse(
                    JSON.stringify(
                      {
                        diagnostics: {
                          ...h.diagnostics(),
                          samples: h.diagnostics().samples.slice(-8),
                        },
                        reasons: h.reasons,
                        closed: h.closed,
                        builders: h.layoutBuilders.size,
                        running: !!h.running,
                        rerun: h.rerun,
                        scheduled: !!h.scheduled,
                        ownerDirty: h.owner.hasDirty,
                        activeDirty: h.owner.hasDirtyInActiveLayout,
                        routes,
                        routeTrace: h.routeTrace,
                        actionTrace: h.actionTrace,
                        input: {
                          polling: h.native.polling,
                          eventRunning: h.native.eventRunning,
                          eventRequested: h.native.eventRequested,
                          focused: full.focused,
                          visible: full.visible,
                          interactionCount: full.interactionCount,
                          queue: h.focusing.queue.map((v) => ({ kind: v.kind, event: v.event })),
                        },
                        full: {
                          document: full.document,
                          published: full.publishedDocument,
                          dialogs: full.nodes
                            .filter((n) => n.semantics?.role === 13)
                            .map((n) => ({
                              node: n.node,
                              parent: n.parent,
                              flags: n.flags,
                              opacity: n.opacity,
                              semantics: n.semantics,
                            })),
                        },
                        latest: h.builderDiagnostic,
                        scheduler: {
                          phase: h.scrolling.scheduler.phase,
                          visible: h.scrolling.scheduler.visible,
                          scheduled: h.scrolling.scheduler.hasScheduledFrame,
                          transient: h.scrolling.scheduler.transientCallbackCount,
                          pendingPostFrame: h.scrolling.scheduler.pendingPostFrame,
                        },
                        retainedDialogs: [...h.native.accepted.values()]
                          .filter((record) => record.node.options.semantics?.role === 'dialog')
                          .map((record) => ({
                            handle: record.handle,
                            kind: record.node.kind,
                            children: record.node.children.length,
                          }))
                          .slice(0, 8),
                      },
                      (_, v) => (typeof v === 'bigint' ? String(v) : v),
                    ),
                  );
                })
                .catch(String),
            ),
          );
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
