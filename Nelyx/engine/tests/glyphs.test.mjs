// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { CanvasKitProvider } from '../render/canvaskit-web/provider.ts';
import { protocol as p, encodeUtf8 } from '../../runtime/engine-client/index.ts';
import { engineRoot, timeout } from '../tools/build.mjs';
const require = createRequire(import.meta.url),
  ckRoot = path.dirname(require.resolve('canvaskit-wasm/package.json'));
const init = require(path.join(ckRoot, 'bin/full/canvaskit.js'));
test(
  'Public glyph transfer matches the prepared Korean and Latin paragraph pixels',
  { timeout },
  async () => {
    const wasmBinary = fs.readFileSync(path.join(ckRoot, 'bin/full/canvaskit.wasm'));
    const contentKit = await init({ wasmBinary }),
      renderKit = await init({ wasmBinary });
    assert.notEqual(contentKit.HEAPU8.buffer, renderKit.HEAPU8.buffer);
    const font = fs.readFileSync(
      path.resolve(engineRoot, '../../sample/nelyx-testbed-app-2/assets/NotoSansKR.ttf'),
    );
    const content = new CanvasKitProvider(contentKit, new Uint8Array(font)),
      render = new CanvasKitProvider(renderKit, new Uint8Array(font));
    const surfaceA = contentKit.MakeSurface(480, 120),
      surfaceB = renderKit.MakeSurface(480, 120);
    try {
      for (const size of [15, 16, 17, 18, 21, 23, 30])
        for (const text of [
          'Nelyx Engine v2',
          '한국어 텍스트와 네이티브 입력',
          'C++ scene · Native / CanvasKit · 독립 스크롤',
        ]) {
          const scene = {
            preparation: 1n,
            preparationDocument: 1n,
            document: 1n,
            metrics: 1n,
            device: 1n,
            blobs: [{ type: 1, handle: { slot: 1, generation: 1 }, bytes: encodeUtf8(text) }],
            nodes: [
              {
                node: { slot: 1, generation: 1 },
                kind: p.kinds.paragraph,
                width: 470,
                height: 110,
                fontSize: size,
                color: 0xff172033,
                resource: { slot: 0, generation: 0 },
              },
            ],
          };
          content.prepare(scene, true);
          const streamed = content.prepare(scene, false);
          render.import(streamed);
          for (const [kit, surface, provider] of [
            [contentKit, surfaceA, content],
            [renderKit, surfaceB, render],
          ]) {
            const canvas = surface.getCanvas();
            canvas.clear(kit.WHITE);
            canvas.drawPicture(provider.tables.get(1n).get('1:1'));
            surface.flush();
          }
          const pixels = (kit, surface) => {
            const image = surface.makeImageSnapshot();
            try {
              return image.readPixels(0, 0, {
                width: 480,
                height: 120,
                colorType: kit.ColorType.RGBA_8888,
                alphaType: kit.AlphaType.Premul,
                colorSpace: kit.ColorSpace.SRGB,
              });
            } finally {
              image.delete();
            }
          };
          const a = pixels(contentKit, surfaceA),
            b = pixels(renderKit, surfaceB);
          let differing = 0;
          for (let i = 0; i < a.length; i += 4)
            if (
              a[i] !== b[i] ||
              a[i + 1] !== b[i + 1] ||
              a[i + 2] !== b[i + 2] ||
              a[i + 3] !== b[i + 3]
            )
              ++differing;
          assert.equal(
            differing,
            0,
            'Glyph paint differs for ' + text + ': ' + differing + ' pixels',
          );
          content.retireExcept(0n);
          render.retireExcept(0n);
        }
      assert.ok(content.counters.textPictureProbeBytes > font.length);
      assert.ok(content.counters.glyphBytes < 65536);
    } finally {
      surfaceA.delete();
      surfaceB.delete();
      content.close();
      render.close();
    }
    assert.equal(content.counters.livePictures, 0);
    assert.equal(render.counters.livePictures, 0);
  },
);
