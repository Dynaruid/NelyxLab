// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { CanvasKitProvider } from '../render/canvaskit-web/provider.ts';
import { protocol as p, packet, response } from '../../runtime/engine-client/index.ts';
import { engineRoot, timeout } from '../tools/build.mjs';
import { wasmFactory } from './transports.mjs';
import { exchange, sessionOwner } from '../platform/web/common.ts';
import { ProviderBudget } from '../platform/web/memory.ts';
const require = createRequire(import.meta.url),
  ckRoot = path.dirname(require.resolve('canvaskit-wasm/package.json'));

test(
  'Real provider backing admission preserves its surface and drains unified reservations on rejection',
  { timeout },
  async () => {
    const { module } = await wasmFactory(path.join(engineRoot, 'dist/single-worker')),
      engine = module._nelyx_wasm_open(1, 1, p.schema, 15),
      budget = new ProviderBudget(module, engine, 2),
      ck = await require(path.join(ckRoot, 'bin/full/canvaskit.js'))({
        wasmBinary: fs.readFileSync(path.join(ckRoot, 'bin/full/canvaskit.wasm')),
      });
    let provider, cache;
    const state = () => response(exchange(module, engine, packet(p.opcodes.inspect, sessionOwner)));
    try {
      provider = new CanvasKitProvider(
        ck,
        new Uint8Array(
          fs.readFileSync(
            path.resolve(engineRoot, '../../sample/nelyx-testbed-app-2/assets/NotoSansKR.ttf'),
          ),
        ),
        budget,
      );
      const surface = ck.MakeSurface(64, 64),
        canvas = { width: 64, height: 64, getContext: () => null };
      assert.ok(surface);
      provider.surface = surface;
      provider.canvas = canvas;
      cache = budget.reserve(3, 32 * 1024 * 1024);
      const before = state();
      assert.ok(before.memory.engineHeap > 0n && before.memory.providerHeap > 0n);
      assert.throws(() => provider.resize(4096, 4096, 1), /Unified memory budget rejected/);
      const after = state();
      assert.equal(after.memory.total, before.memory.total);
      assert.equal(after.memory.gpu, before.memory.gpu);
      assert.equal(after.memory.rejected, before.memory.rejected + 1n);
      assert.equal(provider.surface, surface);
      assert.deepEqual([canvas.width, canvas.height], [64, 64]);
      surface.getCanvas().clear(ck.Color(20, 40, 60, 1));
      surface.flush();
      const image = surface.makeImageSnapshot();
      try {
        assert.equal(
          image.width(),
          64,
          'The retained surface remains usable after a rejected replacement',
        );
      } finally {
        image.delete();
      }
      cache();
      cache = undefined;
      provider.close();
      provider = undefined;
      const closed = response(
        exchange(module, engine, packet(p.opcodes.closeSession, sessionOwner)),
      );
      assert.equal(closed.status, p.statuses.ok);
      assert.equal(closed.reservedBytes, 0n);
      assert.equal(closed.memory.providerHeap, 0n);
      assert.equal(closed.memory.gpu, 0n);
      assert.equal(closed.memory.staging, 0n);
      assert.equal(
        closed.memory.total,
        closed.memory.engineHeap,
        'Only the still-live engine Wasm heap remains until worker teardown',
      );
      assert.ok(closed.memory.peak <= closed.memory.limit);
    } finally {
      cache?.();
      provider?.close();
      module._nelyx_engine_destroy(engine);
    }
  },
);
test(
  'Retained public Pictures preserve path/round clips, rotation, subtree opacity, shadow and blur pixels',
  { timeout },
  async () => {
    const ck = await require(path.join(ckRoot, 'bin/full/canvaskit.js'))({
      wasmBinary: fs.readFileSync(path.join(ckRoot, 'bin/full/canvaskit.wasm')),
    });
    const font = new Uint8Array(
        fs.readFileSync(
          path.resolve(engineRoot, '../../sample/nelyx-testbed-app-2/assets/NotoSansKR.ttf'),
        ),
      ),
      content = new CanvasKitProvider(ck, font),
      render = new CanvasKitProvider(ck, font),
      surface = ck.MakeSurface(180, 180);
    assert.ok(surface);
    render.surface = surface;
    render.resize = () => {};
    const h = (slot) => ({ slot, generation: 1 }),
      triangle = [['move', 0, 0], ['line', 100, 0], ['quad', 100, 100, 0, 100], ['close']];
    const node = (slot, kind, width, height, matrix, depth, color, extra = {}) => ({
      node: h(slot),
      parent: h(0),
      kind: p.kinds[kind],
      width,
      height,
      matrix,
      depth,
      color,
      flags: 16,
      clip: { x: 0, y: 0, width: 180, height: 180 },
      localOpacity: 1,
      opacity: 1,
      radius: 0,
      resource: h(0),
      ...extra,
    });
    const nodes = [
      node(1, 'clip', 100, 100, [1, 0, 0, 1, 10, 10], 0, 0, { radius: 24 }),
      node(2, 'path', 100, 100, [1, 0, 0, 1, 10, 10], 1, 0xffff0000, {
        graphics: { hasPath: true, path: triangle, fillRule: 'winding' },
      }),
      node(3, 'box', 30, 40, [0, 1, -1, 0, 160, 10], 0, 0xff0000ff),
      node(4, 'box', 50, 50, [1, 0, 0, 1, 85, 85], 0, 0, { localOpacity: 0.5 }),
      node(5, 'box', 40, 40, [1, 0, 0, 1, 85, 85], 1, 0xffff0000),
      node(6, 'box', 40, 40, [1, 0, 0, 1, 95, 95], 1, 0xff00ff00),
      node(7, 'effect', 20, 20, [1, 0, 0, 1, 10, 135], 0, 0, { graphics: { blur: 3 } }),
      node(8, 'box', 20, 20, [1, 0, 0, 1, 10, 135], 1, 0xff000000),
      node(9, 'box', 20, 20, [1, 0, 0, 1, 145, 115], 0, 0xffff0000, {
        graphics: {
          shadow: { x: 8, y: 0, sigma: 0, color: 0xff000000 },
          stroke: { color: 0xff00ff00, width: 2 },
        },
      }),
    ];
    try {
      const scene = {
        preparation: 1n,
        activePreparation: 1n,
        preparationDocument: 1n,
        metrics: 1n,
        device: 1n,
        blobs: [],
        nodes,
      };
      const packet = content.prepare(scene, false);
      assert.equal(packet.paths.length, 1);
      assert.ok(packet.pictures.every((record) => record.bytes.byteLength > 0));
      render.import(packet);
      render.draw(scene, 180, 180, 1);
      const snapshot = surface.makeImageSnapshot();
      let pixels;
      try {
        pixels = snapshot.readPixels(0, 0, {
          width: 180,
          height: 180,
          colorType: ck.ColorType.RGBA_8888,
          alphaType: ck.AlphaType.Premul,
          colorSpace: ck.ColorSpace.SRGB,
        });
      } finally {
        snapshot.delete();
      }
      const pixel = (x, y) => Array.from(pixels.slice((y * 180 + x) * 4, (y * 180 + x) * 4 + 3)),
        background = [244, 246, 250];
      assert.deepEqual(pixel(11, 11), background, 'Rounded ancestor removes the path corner');
      assert.deepEqual(pixel(35, 35), [255, 0, 0], 'Prepared quadratic path fills its interior');
      assert.deepEqual(
        pixel(108, 108),
        [122, 251, 125],
        'Subtree opacity composites the overlap once',
      );
      assert.deepEqual(
        pixel(130, 20),
        [0, 0, 255],
        'Rotation changes actual picture replay coordinates',
      );
      assert.deepEqual(
        pixel(169, 125),
        [0, 0, 0],
        'Shadow survives outside the local paint bounds',
      );
      assert.deepEqual(pixel(145, 125), [0, 255, 0], 'Declared stroke is retained in the Picture');
      assert.ok(
        pixel(8, 145)[0] < 244 && pixel(8, 145)[0] > 0,
        'Subtree blur expands beyond the child',
      );
      assert.deepEqual(pixel(0, 145), background, 'Blur remains spatially bounded');
      render.retireExcept(0n);
      assert.equal(render.tables.size, 0);
      assert.equal(render.pathTables.size, 0);
    } finally {
      content.close();
      render.close();
    }
  },
);
