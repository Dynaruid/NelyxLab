// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { canvasKitTestSupply } from '../../engine/tests/canvaskit-supply.mjs';
import { CanvasKitProvider } from '../../engine/render/canvaskit-web/provider.ts';
import { AppTextBudget, WebAppTextBackend } from '../../engine/platform/web/app-text.ts';
import { EngineV2Assets, webAssetTransport } from '../../sdk/src/runtime/engine-v2-assets.ts';
import { EngineV2Buffers } from '../../sdk/src/runtime/engine-v2-buffers.ts';
import { bindAssetLoader } from '@nelyx/core/internal/services/asset-loader-binding';
import { bindImmutableBufferLoader } from '@nelyx/core/internal/ui/immutable-buffer-binding';
import { NetworkAssetBundle } from '@nelyx/core/services/asset-bundle';
import {
  networkAssetFixture,
  networkAssetProbe,
} from '../../engine/tests/network-assets-fixture.mjs';
const timeout = 1_200_000;
test(
  'The actual CanvasKit App owner streams canonical network bytes, admits growth and recovers after a preallocation quota refusal',
  { timeout },
  async () => {
    const fixture = networkAssetFixture(),
      server = createServer((request, response) => {
        if (!fixture.handle(request, response)) {
          response.writeHead(404);
          response.end();
        }
      });
    let binding, bufferBinding, backend, assets, buffers;
    try {
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      const origin = 'http://127.0.0.1:' + server.address().port,
        owned = canvasKitTestSupply(),
        ck = await createRequire(import.meta.url)(owned.js)({
          wasmBinary: fs.readFileSync(owned.wasm),
        }),
        root = path.resolve('Nelyx/engine/dist'),
        manifest = JSON.parse(fs.readFileSync(path.join(root, 'engine-manifest.json'))),
        budget = new AppTextBudget(320 * 1024 * 1024),
        provider = new CanvasKitProvider(
          ck,
          manifest.fonts.map((font) => ({
            id: font.path,
            family: font.family,
            bytes: new Uint8Array(fs.readFileSync(path.join(root, font.path))),
          })),
          budget,
        );
      backend = new WebAppTextBackend(provider, budget);
      assets = new EngineV2Assets(async () => backend, webAssetTransport(origin + '/'));
      buffers = new EngineV2Buffers(
        () => backend,
        async () => backend,
        assets,
      );
      binding = bindAssetLoader({
        load: (key) => assets.load(key),
        loadNetwork: (base, key) => assets.loadNetwork(base, key),
        loadNetworkBuffer: (base, key) => buffers.loadNetwork(base, key),
      });
      bufferBinding = bindImmutableBufferLoader(buffers);
      const result = await networkAssetProbe(NetworkAssetBundle, origin),
        before = assets.execution;
      assert.equal(before.networkReads, 14);
      assert.equal(before.networkBytes, 86);
      assert.equal(before.networkBufferBytes, 3);
      assert.equal(before.networkCreditBytes, 0);
      assert.equal(before.creditBytes, 917762);
      assert.equal(buffers.execution.copies, 1);
      assert.equal(buffers.execution.nativeCopyBytes, 3);
      assert.equal(buffers.execution.creditBytes, 0);
      const bundle = new NetworkAssetBundle(origin + '/network/');
      await assert.rejects(bundle.load('budget'), /budget|quota/);
      assert.equal(assets.execution.creditBytes, before.creditBytes);
      assert.equal(assets.execution.networkCreditBytes, 0);
      assert.equal(assets.execution.pending, 0);
      assert.equal(buffers.execution.copies, 1);
      const next = await bundle.loadBuffer('bytes');
      assert.equal(next.length, 3);
      next.dispose();
      assert.equal(buffers.execution.copies, 2);
      assert.equal(buffers.execution.nativeCopyBytes, 6);
      assert.equal(buffers.execution.creditBytes, 0);
      await assets.close();
      await buffers.close();
      backend.close();
      assert.equal(assets.execution.creditBytes, 917762);
      assert.equal(ck.HEAPU8.byteLength, 128 * 1024 * 1024);
      console.log(
        JSON.stringify({
          control: 'actual-CanvasKit-network-stream',
          result,
          quotaBeforeCapture: true,
          nextRequest: true,
          assets: assets.execution,
          buffers: buffers.execution,
          heap: ck.HEAPU8.byteLength,
          cppHttpDemand: 0,
        }),
      );
    } finally {
      binding?.dispose();
      bufferBinding?.dispose();
      await assets?.close().catch(() => {});
      await buffers?.close().catch(() => {});
      if (backend && !backend.snapshot().closed) backend.close();
      fixture.close();
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  },
);
