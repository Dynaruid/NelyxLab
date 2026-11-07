// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { build, stop } from 'esbuild';
import { windowsCompilerEnvironment } from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
import { engineRoot, timeout } from '../tools/build.mjs';
import { canvasKitTestSupply } from './canvaskit-supply.mjs';
import { CanvasKitProvider } from '../render/canvaskit-web/provider.ts';
import { AppTextBudget, WebAppTextBackend } from '../platform/web/app-text.ts';
import { appTextQuotaBytes, nativeAppTextBackend } from '../../runtime/engine-client/app-text.ts';
import { imageFixture, appImagesProbe } from './app-images-probe.mjs';
import { imageResourceRenderContracts } from './image-resource-render-contracts.mjs';
import { rawImageRenderContracts } from './raw-image-render-contracts.mjs';
import { imageProviderRenderContracts } from './image-provider-render-contracts.mjs';
import { imageProviderNativeContracts } from './image-provider-native-contracts.mjs';
const bytes = (value) => new Uint8Array(Buffer.from(value, 'base64'));
imageResourceRenderContracts();
rawImageRenderContracts();
imageProviderRenderContracts();
imageProviderNativeContracts();
test('An older Native App service cannot silently substitute an image decoder', { timeout }, () => {
  for (const version of [undefined, 0, 1, 3]) {
    const backend = nativeAppTextBackend({
      appTextVersion: 12,
      appImageVersion: version,
      appText(operation) {
        assert.equal(operation, 'open');
        return 1;
      },
    });
    assert.equal(backend.images, undefined);
  }
});
test(
  'Canonical image descriptors/codecs decode actual owned CanvasKit PNG/GIF/raw pixels with independent backing and readback credit',
  { timeout },
  async () => {
    const supply = canvasKitTestSupply(),
      ck = await createRequire(import.meta.url)(supply.js)({
        wasmBinary: fs.readFileSync(supply.wasm),
      }),
      manifest = JSON.parse(fs.readFileSync(path.join(engineRoot, 'dist/engine-manifest.json'))),
      fonts = manifest.fonts.map((font) => ({
        id: font.path,
        family: font.family,
        bytes: new Uint8Array(fs.readFileSync(path.join(engineRoot, 'dist', font.path))),
      })),
      budget = new AppTextBudget(appTextQuotaBytes),
      provider = new CanvasKitProvider(ck, fonts, budget),
      backend = new WebAppTextBackend(provider, budget);
    try {
      const result = await appImagesProbe(
        backend,
        bytes(imageFixture.png),
        bytes(imageFixture.gif),
      );
      assert.equal(result.execution.frameDecodes, 10);
      assert.equal(result.execution.pixelReadBytes, 60);
      assert.equal(result.closed.reservedBytes, 128 * 1024 * 1024 + 7 * 65536 + 3 * 60);
      assert.equal(result.closed.closed, true);
      console.log('Web App image decoder control', JSON.stringify(result));
    } finally {
      if (!backend.snapshot().closed) backend.close();
    }
  },
);
test(
  'Canonical image descriptors/codecs decode actual SkCodec pixels in Windows Hermes and release the ledger at runtime termination',
  { timeout, skip: process.platform !== 'win32' },
  async () => {
    const repo = path.resolve(engineRoot, '../..'),
      parent = fs.realpathSync(os.tmpdir()),
      directory = fs.mkdtempSync(path.join(parent, 'engine-app-images-'));
    try {
      const env = windowsCompilerEnvironment(),
        hermes = path.join(repo, '.nelyx/windows-hermes'),
        supplier = path.join(repo, 'Nelyx/skia/vendor/inputs/windows-x64'),
        exe = path.join(directory, 'images.exe'),
        bundle = path.join(directory, 'images.js');
      await build({
        stdin: {
          contents: `import {appImagesProbe} from ${JSON.stringify(path.join(engineRoot, 'tests/app-images-probe.mjs'))};
import {nativeAppTextBackend} from '@nelyx/core/v2';
appImagesProbe(nativeAppTextBackend(globalThis.NelyxV2Native),new Uint8Array(${JSON.stringify([...bytes(imageFixture.png)])}),new Uint8Array(${JSON.stringify([...bytes(imageFixture.gif)])})).then(value=>{globalThis.__imageResult=JSON.stringify(value);},error=>{globalThis.__imageError=String(error)+'\\n'+error.stack;});`,
          resolveDir: repo,
        },
        outfile: bundle,
        bundle: true,
        format: 'iife',
        target: 'es2022',
        platform: 'browser',
        logLevel: 'silent',
      });
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
          ...[
            path.join(supplier, 'headers'),
            path.join(hermes, 'source/API'),
            path.join(hermes, 'source/API/jsi'),
            path.join(hermes, 'source/public'),
            path.join(repo, 'Nelyx/skia/native/core'),
          ].map((file) => '/I' + file),
          path.join(engineRoot, 'tests/windows-app-images.cpp'),
          path.join(repo, 'Nelyx/skia/native/platforms/windows/font_services.cpp'),
          path.join(repo, 'Nelyx/skia/native/core/paragraph_queries.cpp'),
          '/Fe' + exe,
          '/link',
          path.join(engineRoot, 'dist/native/nelyx_engine_v2.lib'),
          path.join(hermes, 'build/lib/hermesvm.lib'),
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
      fs.writeFileSync(path.join(directory, 'image.png'), bytes(imageFixture.png));
      const run = spawnSync(exe, [bundle, directory], {
        cwd: directory,
        env: { ...env, PATH: path.join(hermes, 'build/lib') + path.delimiter + env.PATH },
        encoding: 'utf8',
        timeout,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      });
      if (run.error) throw run.error;
      assert.equal(run.status, 0, run.stdout + run.stderr);
      const result = JSON.parse(run.stdout);
      assert.equal(result.probe.execution.frameDecodes, 10);
      assert.equal(result.probe.closed.immutableBufferFileReads, 1);
      assert.equal(result.probe.closed.immutableBufferFileBytes, bytes(imageFixture.png).length);
      assert.equal(result.probe.closed.reservedBytes, 7 * 65536 + 3 * 60);
      assert.equal(result.ledgerAfterTermination, 0);
      console.log('Native App image decoder control', JSON.stringify(result));
    } finally {
      stop();
      assert.equal(path.dirname(path.resolve(directory)), parent);
      assert.ok(path.basename(directory).startsWith('engine-app-images-'));
      fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);
