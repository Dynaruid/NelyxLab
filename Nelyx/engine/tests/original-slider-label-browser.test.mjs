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
import { sourceIdentity, timeout, engineRoot } from '../tools/build.mjs';
import {
  createEngineV2Project,
  buildEngineV2Application,
  verifyEngineV2Application,
  createEngineV2Server,
} from '../../sdk/tooling/cli/src/engine-v2-runner.mjs';
import {
  originalSliderLabelFixture,
  originalDropSliderLabelFixture,
} from './original-slider-label-fixture.mjs';
const owner = { session: 1, app: 1, view: 1, generation: 1 };
async function published(page, accepts = () => true) {
  for (let i = 0; i < 30; i++) {
    const bytes = await page.evaluate(
        async (bytes) => Array.from(await __nelyxV2.surface.host.exchange(new Uint8Array(bytes))),
        Array.from(packet(p.opcodes.semanticsSnapshot, owner)),
      ),
      state = response(new Uint8Array(bytes));
    assert.equal(state.status, p.statuses.ok);
    if (
      state.publication &&
      state.document === state.publishedDocument &&
      state.metrics === state.publishedMetrics &&
      !state.queued &&
      accepts(state)
    )
      return state;
    const errors = await page.evaluate(() => __nelyxV2.errors);
    assert.deepEqual(errors, []);
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  throw Error(
    'Labeled Slider did not publish its current Source recording: ' +
      JSON.stringify(
        await page.evaluate(() => ({
          execution: __labelExecution,
          diagnostics: __nelyxV2.surface.diagnostics,
          errors: __nelyxV2.errors,
        })),
        (key, value) => (typeof value === 'bigint' ? String(value) : value),
      ),
  );
}
const label = (state) => state.nodes.find((node) => node.paintPlacement),
  slider = (state) => state.nodes.find((node) => node.semantics?.role === p.semanticsRoles.slider);
async function colors(page) {
  const png = await page.screenshot();
  return page.evaluate(async (png) => {
    const image = await createImageBitmap(
      new Blob([Uint8Array.from(atob(png), (v) => v.charCodeAt(0))], { type: 'image/png' }),
    );
    try {
      const canvas = new OffscreenCanvas(image.width, image.height),
        ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let ink = 0,
        bubble = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] === 238 && data[i + 1] === 238 && data[i + 2] === 34) ink++;
        if (data[i] === 40 && data[i + 1] === 72 && data[i + 2] === 112) bubble++;
      }
      return { ink, bubble };
    } finally {
      image.close();
    }
  }, png.toString('base64'));
}
for (const [indicator, fixture] of [
  ['rounded', originalSliderLabelFixture],
  ['default Drop', originalDropSliderLabelFixture],
])
  test(
    `Original Slider ${indicator} indicator uses Source Overlay/State, C++ text/placement and real pixels in both Web profiles`,
    { timeout },
    async () => {
      const repo = path.resolve(engineRoot, '../..'),
        supply = path.join(engineRoot, 'dist'),
        parent = fs.realpathSync(os.tmpdir()),
        app = fs.mkdtempSync(path.join(parent, 'engine-slider-label-'));
      let server, browser;
      try {
        assert.equal(
          JSON.parse(fs.readFileSync(path.join(supply, 'engine-manifest.json'))).sourceSha256,
          sourceIdentity(),
        );
        createEngineV2Project(app, { designs: ['material', 'cupertino'] });
        fs.mkdirSync(path.join(app, 'node_modules/@nelyx'), { recursive: true });
        for (const [name, directory] of [
          ['core', 'Nelyx'],
          ['sdk', 'Nelyx/sdk'],
          ['material', 'packages/material'],
          ['cupertino', 'packages/cupertino'],
        ])
          fs.symlinkSync(
            path.join(repo, directory),
            path.join(app, 'node_modules/@nelyx', name),
            'junction',
          );
        fs.writeFileSync(path.join(app, 'src/app.ts'), fixture);
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
          const context = await browser.newContext({ viewport: { width: 640, height: 360 } }),
            page = await context.newPage(),
            errors = [];
          page.on('pageerror', (error) => errors.push(String(error)));
          try {
            await page.addInitScript(() => {
              const post = Worker.prototype.postMessage;
              Worker.prototype.postMessage = function (message, ...args) {
                if (message?.kind === 'start')
                  this.addEventListener('message', (event) => {
                    if (event.data?.kind === 'app-execution')
                      globalThis.__labelExecution = event.data.execution;
                    if (event.data?.kind === 'label-state') globalThis.__labelState = event.data;
                  });
                return Reflect.apply(post, this, [message, ...args]);
              };
            });
            await page.goto('http://127.0.0.1:' + server.address().port + '/' + route + '/');
            await page.waitForFunction(() => __nelyxV2?.ready || __nelyxV2?.errors.length, null, {
              timeout: 30000,
            });
            assert.deepEqual(await page.evaluate(() => __nelyxV2.errors), []);
            let frame = await published(page, (state) => !!label(state));
            assert.equal(slider(frame).semantics.range.value, 0.5);
            assert.equal(label(frame).paintPlacement.fontRevision, 1n);
            if (indicator === 'default Drop')
              assert.ok(
                frame.nodes.some((n) => n.nativePaint?.some((e) => e.kind === 'path')),
                'The default indicator is a Content compound path',
              );
            assert.equal(
              label(frame).paintPlacement.unbounded,
              true,
              'Content preserves the actual Source paragraph layout width',
            );
            assert.equal(
              label(frame).semantics,
              null,
              'An indicator adds no duplicate accessibility peer',
            );
            let painted = await colors(page);
            assert.ok(painted.ink > 10 && painted.bubble > 100, JSON.stringify(painted));
            const update = async (value, accepts) => {
              await page.evaluate(
                (value) => __nelyxV2.app.postMessage({ kind: 'label-control', ...value }),
                value,
              );
              return published(page, accepts);
            };
            frame = await update(
              { value: 0.75 },
              (state) => !!label(state) && slider(state).semantics.range.value === 0.75,
            );
            frame = await update(
              { rtl: true, value: 0.25 },
              (state) => !!label(state) && slider(state).semantics.range.value === 0.25,
            );
            const at = slider(frame).bounds;
            await page.mouse.move(at.x + at.width * 0.7, at.y + at.height / 2);
            await page.mouse.down();
            await page.mouse.move(at.x + at.width * 0.4, at.y + at.height / 2, { steps: 5 });
            await page.mouse.up();
            await page.waitForFunction(
              () => __labelState?.starts > 0 && __labelState?.ends > 0 && __labelState?.changes > 0,
              null,
              { timeout: 15000 },
            );
            frame = await published(page, (state) => !!label(state));
            frame = await update(
              { long: true, value: 0 },
              (state) =>
                !!label(state) &&
                label(state).paintPlacement.width > 200 &&
                slider(state).semantics.range.value === 0,
            );
            const old = label(frame).paintPlacement.width;
            await page.setViewportSize({ width: 420, height: 360 });
            frame = await published(
              page,
              (state) => !!label(state) && state.viewport.width === 420,
            );
            assert.equal(
              label(frame).paintPlacement.width,
              old,
              'A resize preserves the measured Source label and recomputes placement',
            );
            painted = await colors(page);
            assert.ok(painted.ink > 10 && painted.bubble > 100, JSON.stringify(painted));
            frame = await update({ disabled: true }, (state) => !label(state));
            const disabled = await colors(page);
            assert.equal(disabled.ink, 0);
            assert.equal(disabled.bubble, 0);
            frame = await update(
              { disabled: false, long: false, value: 0.5 },
              (state) =>
                !!label(state) &&
                label(state).paintPlacement.width < 100 &&
                slider(state).semantics.range.value === 0.5,
            );
            frame = await update({ dragOnly: true }, (state) => !label(state));
            const dragBounds = slider(frame).bounds;
            await page.mouse.move(
              dragBounds.x + dragBounds.width / 2,
              dragBounds.y + dragBounds.height / 2,
            );
            await page.mouse.down();
            await page.mouse.move(
              dragBounds.x + dragBounds.width * 0.7,
              dragBounds.y + dragBounds.height / 2,
              { steps: 4 },
            );
            await published(page, (state) => !!label(state));
            assert.ok((await colors(page)).ink > 0, 'Source onDrag policy paints its label');
            await page.mouse.up();
            await page.waitForTimeout(1000);
            await published(page, (state) => !label(state));
            frame = await update({ dragOnly: false }, (state) => !!label(state));
            let execution;
            // An animation/overlay ACK can arrive between the Core and App reads.
            // Compare a coherent sample instead of mixing two different turns.
            for (let sample = 0; sample < 30; sample++) {
              frame = await published(page, (state) => !!label(state));
              execution = await page.evaluate(
                () => __labelExecution ?? __nelyxV2.receipt.execution,
              );
              if (frame.transactionWork === BigInt(execution.acknowledgedCommands)) break;
              await page.evaluate(() => new Promise(requestAnimationFrame));
            }
            const appText = execution.appText;
            assert.equal(frame.transactionWork, BigInt(execution.acknowledgedCommands));
            assert.equal(appText.layouts, appText.sdkLayouts);
            assert.ok(appText.layouts > 0 && appText.sdkPaintCaptures > 0);
            assert.equal(appText.tsFallbacks, 0);
            assert.equal(execution.tsLayoutFallbacks, 0);
            assert.equal(execution.rejectedFallbacks, 0);
            const diagnostics = await page.evaluate(() => __nelyxV2.surface.diagnostics),
              content = diagnostics['content-stats']?.counters;
            assert.ok(
              content.paragraphLayouts > 0 && content.paragraphs > 0,
              'Actual Content paragraph layout and painting were observed',
            );
            const closed = await page.evaluate(() => __nelyxV2.close());
            assert.equal(closed.reservedBytes, 0);
            assert.equal(closed.workersStopped, true);
            assert.deepEqual(closed.appText, { reservations: 0, retired: 1, reservedBytes: 0 });
            assert.deepEqual(errors, []);
            console.log(
              JSON.stringify({
                profile,
                indicator,
                appText,
                content,
                painted,
                commands: String(frame.transactionWork),
                reservedBytes: closed.reservedBytes,
                workersStopped: closed.workersStopped,
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
        assert.equal(path.dirname(app), parent);
        assert.match(path.basename(app), /^engine-slider-label-/);
        fs.rmSync(app, { recursive: true, force: true, maxRetries: 3 });
      }
    },
  );
