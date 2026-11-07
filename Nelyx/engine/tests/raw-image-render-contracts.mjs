// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { stop } from 'esbuild';
import { engineRoot, sourceIdentity, timeout } from '../tools/build.mjs';
import {
  createEngineV2Project,
  buildEngineV2Application,
  verifyEngineV2Application,
  createEngineV2Server,
} from '../../sdk/tooling/cli/src/engine-v2-runner.mjs';
import { runTypeScriptCompiler } from '../../sdk/tooling/metro/src/typescript-compiler.cjs';
import { rawImageAppSource } from './raw-image-fixture.mjs';
const background = [16, 32, 48, 255],
  rgba = (r, g, b) => [r, g, b, 255];
const palettes = [
  [
    [255, 0, 0, 255],
    [0, 255, 0, 255],
    [0, 0, 255, 255],
    [255, 255, 255, 255],
  ],
  [
    [0, 255, 255, 255],
    [255, 0, 255, 255],
    [255, 255, 0, 255],
    [0, 0, 0, 255],
  ],
];
function samples(phase, opacity = 1) {
  const colors = palettes[phase],
    checks = [];
  for (let cell = 0; cell < 12; ++cell) {
    const x = (cell % 4) * 80,
      y = Math.floor(cell / 4) * 80;
    let points = [
        [8, 8],
        [56, 8],
        [8, 56],
        [56, 56],
      ],
      expected = colors;
    if (cell === 1) expected = [colors[1], colors[0], colors[3], colors[2]];
    if (cell === 2) expected = Array(4).fill(rgba(0, 255, 255));
    if (cell === 3)
      expected = colors.map((color) => rgba(255 - color[0], 255 - color[1], 255 - color[2]));
    if (cell === 4 && opacity !== 1)
      expected = colors.map((color) =>
        rgba(
          ...color
            .slice(0, 3)
            .map((value, i) => Math.round((value * 128 + background[i] * 127) / 255)),
        ),
      );
    if (cell === 5)
      points = [
        [4, 4],
        [12, 4],
        [4, 12],
        [12, 12],
      ];
    if (cell === 7)
      points = [
        [24, 24],
        [40, 24],
        [24, 40],
        [40, 40],
      ];
    if (cell === 8 || cell === 9) expected = Array(4).fill(background);
    if (cell === 10)
      expected = colors.map((color) =>
        rgba(...color.slice(0, 3).map((value, i) => Math.round((value * background[i]) / 255))),
      );
    for (let i = 0; i < 4; ++i)
      checks.push({ point: [x + points[i][0], y + points[i][1]], color: expected[i], cell });
  }
  for (let i = 0; i < 4; ++i)
    checks.push({
      point: [i % 2 ? 88 : 72, i / 2 >= 1 ? 152 : 136],
      color: colors[i],
      cell: 'overflow',
    });
  return checks;
}
async function pixels(page, checks) {
  const screenshot = await page.screenshot();
  return page.evaluate(
    async ({ png, points }) => {
      const bitmap = await createImageBitmap(
        new Blob([Uint8Array.from(atob(png), (c) => c.charCodeAt(0))], { type: 'image/png' }),
      );
      try {
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height),
          ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0);
        return points.map(([x, y]) => Array.from(ctx.getImageData(x, y, 1, 1).data));
      } finally {
        bitmap.close();
      }
    },
    { png: screenshot.toString('base64'), points: checks.map((check) => check.point) },
  );
}
async function verifyPixels(page, checks, label) {
  let actual;
  for (let attempt = 0; attempt < 30; ++attempt) {
    actual = await pixels(page, checks);
    if (JSON.stringify(actual) === JSON.stringify(checks.map((check) => check.color))) return;
    await page.waitForTimeout(50);
  }
  assert.deepEqual(
    actual,
    checks.map((check) => check.color),
    label +
      ' ' +
      JSON.stringify(
        checks.filter((check, i) => JSON.stringify(actual[i]) !== JSON.stringify(check.color)),
      ),
  );
}
export function rawImageRenderContracts() {
  test(
    'Canonical RawImage uses shared immutable Scene pixels and Core placement in both normal Web profiles, survives caller retirement and drains replacement/opacity owners',
    { timeout },
    () => verifyCanonicalRawImageBrowserControl(),
  );
}
export async function verifyCanonicalRawImageBrowserControl(runner) {
  const api = runner
    ? await import(
        pathToFileURL(path.join(runner, 'node_modules/@nelyx/cli/src/engine-v2-runner.mjs'))
      )
    : {
        createEngineV2Project,
        buildEngineV2Application,
        verifyEngineV2Application,
        createEngineV2Server,
      };
  const compiler = runner
    ? createRequire(path.join(runner, 'package.json'))('@nelyx/metro/typescript-compiler')
        .runTypeScriptCompiler
    : runTypeScriptCompiler;
  const parent = fs.realpathSync(os.tmpdir()),
    app = fs.mkdtempSync(path.join(parent, 'engine-raw-images-')),
    repo = path.resolve(engineRoot, '../..'),
    supply = path.join(engineRoot, 'dist');
  let browser, server;
  try {
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(supply, 'engine-manifest.json'))).sourceSha256,
      sourceIdentity(),
    );
    api.createEngineV2Project(app);
    if (runner)
      fs.symlinkSync(path.join(runner, 'node_modules'), path.join(app, 'node_modules'), 'junction');
    else {
      fs.mkdirSync(path.join(app, 'node_modules/@nelyx'), { recursive: true });
      for (const [name, relative] of [
        ['core', 'Nelyx'],
        ['sdk', 'Nelyx/sdk'],
      ])
        fs.symlinkSync(
          path.join(repo, relative),
          path.join(app, 'node_modules/@nelyx', name),
          'junction',
        );
    }
    fs.writeFileSync(path.join(app, 'src/app.ts'), rawImageAppSource);
    let built;
    for (const target of ['windows', 'web']) {
      const config = path.join(app, 'image-types.json');
      fs.writeFileSync(
        config,
        JSON.stringify({
          compilerOptions: {
            strict: true,
            noEmit: true,
            skipLibCheck: false,
            types: [],
            lib: target === 'web' ? ['ES2022', 'DOM'] : ['ES2022'],
            target: 'ES2022',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            customConditions: target === 'web' ? ['browser'] : [],
          },
          files: ['src/app.ts'],
        }),
      );
      const checked = compiler(
        runner ?? repo,
        ['-p', config, '--pretty', 'false'],
        runner ? 'typescript' : '@typescript/native',
      );
      assert.equal(checked.version, '7.0.2');
      assert.equal(checked.status, 0, checked.stdout + checked.stderr);
      built = await api.buildEngineV2Application({ app, target, engineInputs: supply });
    }
    server = api.createEngineV2Server(api.verifyEngineV2Application(built.directory, 'web'));
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    browser = await chromium.launch({ headless: true });
    for (const profile of ['plain', 'isolated']) {
      const context = await browser.newContext({ viewport: { width: 400, height: 320 } }),
        page = await context.newPage(),
        errors = [];
      try {
        page.on('pageerror', (error) => errors.push(String(error)));
        await page.addInitScript(() => {
          const post = Worker.prototype.postMessage;
          Worker.prototype.postMessage = function (message, ...rest) {
            if (message?.kind === 'start') {
              globalThis.__rawApp = this;
              globalThis.__rawStates = [];
              this.addEventListener('message', (event) => {
                if (event.data.kind === 'raw-ready') globalThis.__rawReady = event.data;
                if (event.data.kind === 'raw-state') __rawStates.push(event.data);
                if (event.data.kind === 'app-execution')
                  globalThis.__rawExecution = event.data.execution;
                if (event.data.kind === 'raw-error') globalThis.__rawError = event.data;
                if (event.data.kind === 'app-error') globalThis.__rawError = event.data;
              });
            }
            return post.call(this, message, ...rest);
          };
        });
        await page.goto(`http://127.0.0.1:${server.address().port}/${profile}/`);
        await page.waitForFunction(
          () =>
            (globalThis.__nelyxV2?.ready && globalThis.__rawReady) ||
            globalThis.__rawError ||
            globalThis.__nelyxV2?.errors?.length,
        );
        assert.equal(await page.evaluate(() => globalThis.__rawError), undefined);
        assert.deepEqual(await page.evaluate(() => __nelyxV2.errors), []);
        const initial = await page.evaluate(() => __nelyxV2.receipt);
        assert.equal(initial.engineWork, String(initial.execution.acknowledgedCommands));
        const probe = async (phase) => {
          const count = await page.evaluate(() => __rawStates.length);
          await page.evaluate(() => __rawApp.postMessage({ kind: 'raw-probe' }));
          await page.waitForFunction((count) => __rawStates.length > count, count);
          const value = await page.evaluate(() => __rawStates.at(-1));
          assert.equal(value.phase, phase);
          assert.equal(value.images.tsFallbacks, 0);
          return value.images;
        };
        await verifyPixels(
          page,
          samples(0),
          `${profile}: first frame after caller Image/clone/codec disposal`,
        );
        const first = await probe(0);
        assert.equal(first.frameDecodes, 1);
        assert.equal(first.sceneCaptures, 1);
        assert.equal(first.sceneLeases, 1);
        assert.equal(first.backend.sceneBuffers, 1);
        assert.equal(first.backend.sceneDataBytes, 256 * 256 * 4 + 32);
        assert.equal(first.backend.frames, 1);
        assert.equal(first.backend.readbacks, 0);
        await page.evaluate(() => __rawApp.postMessage({ kind: 'raw-opacity', value: 0.5 }));
        await verifyPixels(
          page,
          samples(0, 0.5),
          `${profile}: live opacity from a detached Source RenderImage`,
        );
        assert.equal((await probe(0)).sceneCaptures, 1);
        await page.evaluate(() => __rawApp.postMessage({ kind: 'raw-opacity', value: 1 }));
        await verifyPixels(page, samples(0), `${profile}: opacity restored`);
        await page.evaluate(() => __rawApp.postMessage({ kind: 'raw-phase', phase: 1 }));
        await verifyPixels(page, samples(1), `${profile}: replacement frame`);
        const second = await probe(1);
        assert.equal(second.sceneCaptures, 2);
        assert.equal(second.sceneSnapshots, 1);
        assert.equal(second.sceneLeases, 1);
        assert.equal(second.backend.sceneBuffers, 1);
        assert.equal(second.backend.frames, 1);
        assert.equal(second.pixelReadBytes, 2 * 256 * 256 * 4);
        assert.equal(second.backend.pixelReadBytes, second.pixelReadBytes);
        await page.evaluate(() => __rawApp.postMessage({ kind: 'raw-phase', phase: 2 }));
        await verifyPixels(
          page,
          samples(0).map((check) => ({ ...check, color: background })),
          `${profile}: removed scene`,
        );
        const removed = await probe(2);
        assert.equal(removed.sceneSnapshots, 0);
        assert.equal(removed.sceneLeases, 0);
        assert.equal(removed.backend.frames, 0);
        assert.equal(removed.backend.sceneBuffers, 0);
        assert.equal(removed.backend.reservedBytes, 0);
        await page.waitForFunction(() => {
          const state = __nelyxV2.surface.diagnostics['render-stats']?.state;
          return (
            state &&
            globalThis.__rawExecution &&
            String(state.transactionWork) === String(__rawExecution.acknowledgedCommands)
          );
        });
        const final = await page.evaluate(() => ({
          core: String(__nelyxV2.surface.diagnostics['render-stats'].state.transactionWork),
          layout: String(__nelyxV2.surface.diagnostics['render-stats'].state.layoutWork),
          imagePaint: String(__nelyxV2.surface.diagnostics['render-stats'].state.imagePaintWork),
          execution: __rawExecution,
          content:
            __nelyxV2.surface.diagnostics['content-stats']?.counters ??
            __nelyxV2.surface.diagnostics.content?.counters,
        }));
        assert.ok(BigInt(final.layout) > 0n);
        assert.ok(BigInt(final.imagePaint) > 0n);
        assert.ok(final.content.images >= 23);
        assert.equal(final.execution.rejectedFallbacks, 0);
        assert.equal(final.execution.appGeometryNodes, 0);
        assert.equal(final.core, String(final.execution.acknowledgedCommands));
        const closed = await page.evaluate(() => __nelyxV2.close());
        assert.equal(closed.workersStopped, true);
        assert.equal(closed.reservedBytes, 0);
        assert.deepEqual(await page.evaluate(() => __nelyxV2.errors), []);
        assert.equal(await page.evaluate(() => globalThis.__rawError), undefined);
        assert.deepEqual(errors, []);
        console.log(
          JSON.stringify({
            control: runner ? 'installed-canonical-RawImage' : 'normal-canonical-RawImage',
            profile,
            coreCommands: final.core,
            sdkCommands: final.execution.acknowledgedCommands,
            nativeLayout: final.layout,
            nativeImagePaint: final.imagePaint,
            contentImages: final.content.images,
            sceneCaptures: second.sceneCaptures,
            pixelReadBytes: second.pixelReadBytes,
            publicReadbackBytes: second.backend.readbackBytes,
            tsFallbacks: 0,
            workersStopped: true,
            closedReservation: 0,
          }),
        );
      } finally {
        await page.evaluate(() => globalThis.__nelyxV2?.close?.()).catch(() => {});
        await context.close();
      }
    }
  } finally {
    try {
      await browser?.close();
    } finally {
      try {
        if (server) await new Promise((resolve) => server.close(resolve));
      } finally {
        try {
          await stop();
        } finally {
          assert.equal(path.dirname(path.resolve(app)), parent);
          assert.ok(path.basename(app).startsWith('engine-raw-images-'));
          fs.rmSync(app, { recursive: true, force: true, maxRetries: 3 });
        }
      }
    }
  }
}
