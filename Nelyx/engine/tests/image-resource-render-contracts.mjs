// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { spawnSync } from 'node:child_process';
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
import { largeImagePNG, imageResourceAppSource } from './image-resource-fixture.mjs';
import { windowsCompilerEnvironment } from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';

async function pixels(page) {
  const png = await page.screenshot();
  return page.evaluate(async (png) => {
    const bitmap = await createImageBitmap(
      new Blob([Uint8Array.from(atob(png), (c) => c.charCodeAt(0))], { type: 'image/png' }),
    );
    try {
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height),
        ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      return [
        [8, 8],
        [56, 8],
        [8, 56],
        [56, 56],
      ].map(([x, y]) => Array.from(ctx.getImageData(x, y, 1, 1).data));
    } finally {
      bitmap.close();
    }
  }, png.toString('base64'));
}
export function imageResourceRenderContracts() {
  test(
    'Native Content decodes large image resources and retained Pictures preserve exact CPU pixels after producer retirement',
    { timeout, skip: process.platform !== 'win32' },
    () => {
      const parent = fs.realpathSync(os.tmpdir()),
        directory = fs.mkdtempSync(path.join(parent, 'engine-native-images-')),
        repo = path.resolve(engineRoot, '../..'),
        supplier = path.join(repo, 'Nelyx/skia/vendor/inputs/windows-x64'),
        exe = path.join(directory, 'images.exe'),
        env = windowsCompilerEnvironment();
      try {
        const compiled = spawnSync(
          'cl.exe',
          [
            '/nologo',
            '/std:c++20',
            '/EHsc',
            '/MD',
            '/utf-8',
            '/DNOMINMAX',
            '/DWIN32_LEAN_AND_MEAN',
            ...[path.join(supplier, 'headers'), path.join(repo, 'Nelyx/skia/native/core')].map(
              (file) => '/I' + file,
            ),
            path.join(engineRoot, 'tests/windows-image-resources.cpp'),
            path.join(repo, 'Nelyx/skia/native/platforms/windows/font_services.cpp'),
            path.join(repo, 'Nelyx/skia/native/core/paragraph_queries.cpp'),
            '/Fe' + exe,
            '/link',
            path.join(engineRoot, 'dist/native/nelyx_engine_v2.lib'),
            ...fs
              .readdirSync(path.join(supplier, 'libraries'))
              .filter((file) => file.endsWith('.lib'))
              .map((file) => path.join(supplier, 'libraries', file)),
            'dwrite.lib',
            'gdi32.lib',
            'user32.lib',
            'advapi32.lib',
            'ole32.lib',
            'oleaut32.lib',
            'uuid.lib',
            'uiautomationcore.lib',
          ],
          {
            cwd: directory,
            env,
            encoding: 'utf8',
            timeout,
            windowsHide: true,
            maxBuffer: 1024 * 1024,
          },
        );
        if (compiled.error) throw compiled.error;
        assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
        fs.writeFileSync(path.join(directory, 'first.png'), largeImagePNG());
        fs.writeFileSync(path.join(directory, 'second.png'), largeImagePNG(true));
        const result = spawnSync(exe, [path.join(engineRoot, 'dist'), directory], {
          cwd: directory,
          env,
          encoding: 'utf8',
          timeout,
          windowsHide: true,
          maxBuffer: 1024 * 1024,
        });
        if (result.error) throw result.error;
        assert.equal(result.status, 0, result.stdout + result.stderr);
        const actual = JSON.parse(result.stdout);
        assert.equal(actual.measurements, 2);
        assert.equal(actual.images, 2);
        assert.equal(actual.pictures, 2);
        assert.equal(actual.rawPictures, 8);
        assert.equal(actual.rawRetainedBacking, true);
        assert.equal(actual.retainedPicturePixels, true);
        assert.equal(actual.ledgerAfterTermination, 0);
        console.log(JSON.stringify(actual));
      } finally {
        assert.equal(path.dirname(path.resolve(directory)), parent);
        assert.ok(path.basename(directory).startsWith('engine-native-images-'));
        fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3 });
      }
    },
  );
  test(
    'Normal SDK streams large image resources through actual Content/Render actors, swaps pixels and closes both Web profiles',
    { timeout },
    () => verifyLargeImageResourceBrowserControl(),
  );
}
export async function verifyLargeImageResourceBrowserControl(runner) {
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
    app = fs.mkdtempSync(path.join(parent, 'engine-image-resources-')),
    repo = path.resolve(engineRoot, '../..'),
    supply = path.join(engineRoot, 'dist');
  let browser, server;
  try {
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(supply, 'engine-manifest.json'))).sourceSha256,
      sourceIdentity(),
    );
    api.createEngineV2Project(app);
    fs.mkdirSync(path.join(app, 'assets'), { recursive: true });
    const first = largeImagePNG(),
      second = largeImagePNG(true);
    assert.ok(first.length > 1048576);
    fs.writeFileSync(path.join(app, 'assets/first.png'), first);
    fs.writeFileSync(path.join(app, 'assets/second.png'), second);
    const configFile = path.join(app, 'nelyx.v2.json'),
      config = JSON.parse(fs.readFileSync(configFile));
    config.assets = { 'first.png': 'assets/first.png', 'second.png': 'assets/second.png' };
    fs.writeFileSync(configFile, JSON.stringify(config));
    if (runner)
      fs.symlinkSync(path.join(runner, 'node_modules'), path.join(app, 'node_modules'), 'junction');
    else {
      fs.mkdirSync(path.join(app, 'node_modules/@nelyx'), { recursive: true });
      for (const [name, source] of [
        ['core', 'Nelyx'],
        ['sdk', 'Nelyx/sdk'],
      ])
        fs.symlinkSync(
          path.join(repo, source),
          path.join(app, 'node_modules/@nelyx', name),
          'junction',
        );
    }
    fs.writeFileSync(path.join(app, 'src/app.ts'), imageResourceAppSource);
    let built;
    for (const target of ['windows', 'web']) {
      const types = path.join(app, 'image-types.json');
      fs.writeFileSync(
        types,
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
        ['-p', types, '--pretty', 'false'],
        runner ? 'typescript' : '@typescript/native',
      );
      assert.equal(checked.version, '7.0.2');
      assert.equal(checked.status, 0, checked.stdout + checked.stderr);
      built = await api.buildEngineV2Application({ app, target, engineInputs: supply });
      api.verifyEngineV2Application(built.directory, target);
    }
    server = api.createEngineV2Server(api.verifyEngineV2Application(built.directory, 'web'));
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    browser = await chromium.launch({ headless: true });
    for (const profile of ['plain', 'isolated']) {
      const context = await browser.newContext({
          viewport: { width: 160, height: 120 },
          deviceScaleFactor: 1,
        }),
        page = await context.newPage(),
        errors = [];
      try {
        page.on('pageerror', (error) => errors.push(String(error)));
        await page.addInitScript(() => {
          const post = Worker.prototype.postMessage;
          Worker.prototype.postMessage = function (message, ...rest) {
            if (message?.kind === 'start') {
              globalThis.__imageApp = this;
              this.addEventListener('message', (event) => {
                if (event.data.kind === 'image-resource-loaded')
                  globalThis.__imageLoaded = event.data;
                if (event.data.kind === 'app-execution')
                  globalThis.__imageExecution = event.data.execution;
              });
            }
            return post.call(this, message, ...rest);
          };
        });
        await page.goto(`http://127.0.0.1:${server.address().port}/${profile}/`);
        await page.waitForFunction(() => globalThis.__nelyxV2?.ready && globalThis.__imageLoaded);
        const initial = await page.evaluate(() => __nelyxV2.receipt);
        assert.equal(initial.engineWork, String(initial.execution.acknowledgedCommands));
        assert.equal(await page.evaluate(() => __imageLoaded.length), first.length);
        const expected = [
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
          Array(4).fill([18, 52, 86, 255]),
        ];
        for (let phase = 0; phase < 3; ++phase) {
          if (phase)
            await page.evaluate(
              (phase) => __imageApp.postMessage({ kind: 'image-resource-phase', phase }),
              phase,
            );
          let actual;
          for (let attempt = 0; attempt < 30; ++attempt) {
            actual = await pixels(page);
            if (JSON.stringify(actual) === JSON.stringify(expected[phase])) break;
            await page.waitForTimeout(50);
          }
          assert.deepEqual(actual, expected[phase], `Actual ${profile} pixels for phase ${phase}`);
        }
        await page.waitForFunction((initial) => {
          const state = __nelyxV2.surface.diagnostics['render-stats']?.state,
            execution = globalThis.__imageExecution;
          return (
            state &&
            execution &&
            execution.acknowledgedCommands > initial &&
            String(state.transactionWork) === String(execution.acknowledgedCommands)
          );
        }, initial.execution.acknowledgedCommands);
        const final = await page.evaluate(() => ({
          engineWork: String(__nelyxV2.surface.diagnostics['render-stats'].state.transactionWork),
          layoutWork: String(__nelyxV2.surface.diagnostics['render-stats'].state.layoutWork),
          execution: __imageExecution,
          content:
            __nelyxV2.surface.diagnostics['content-stats']?.counters ??
            __nelyxV2.surface.diagnostics.content?.counters,
        }));
        assert.ok(BigInt(final.engineWork) > BigInt(initial.engineWork));
        assert.equal(final.engineWork, String(final.execution.acknowledgedCommands));
        assert.equal(final.execution.rejectedFallbacks, 0);
        assert.equal(final.execution.appGeometryNodes, 0);
        assert.ok(BigInt(final.layoutWork) > 0n);
        assert.equal(final.content.images, 2);
        const closed = await page.evaluate(() => __nelyxV2.close());
        assert.equal(closed.workersStopped, true);
        assert.equal(closed.reservedBytes, 0);
        assert.deepEqual(await page.evaluate(() => __nelyxV2.errors), []);
        assert.deepEqual(errors, []);
        console.log(
          JSON.stringify({
            control: runner ? 'installed-SDK-large-images' : 'normal-SDK-large-images',
            profile,
            bytes: first.length,
            phases: 3,
            coreCommands: final.engineWork,
            sdkCommands: final.execution.acknowledgedCommands,
            nativeLayoutWork: final.layoutWork,
            contentImages: final.content.images,
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
          assert.ok(path.basename(app).startsWith('engine-image-resources-'));
          fs.rmSync(app, { recursive: true, force: true, maxRetries: 3 });
        }
      }
    }
  }
}
