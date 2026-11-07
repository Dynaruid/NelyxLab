// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  commands as c,
  protocol as p,
  rasterImageHeader,
  measurementBody,
} from '../../runtime/engine-client/index.ts';

export function imageStyleContracts({ using, timeout, h }) {
  const natural = { width: 40, height: 20, scale: 2, widthSpecified: true, heightSpecified: true };
  const close = (actual, expected) =>
    actual.forEach((value, i) =>
      assert.ok(Math.abs(value - expected[i]) < 1e-9, `${actual} != ${expected}`),
    );
  async function prepare(f) {
    let state;
    for (let i = 0; i < 30; ++i) {
      state = await f.step();
      if (state.measureRequest) {
        const request = await f.send(p.opcodes.measureRequest);
        await f.send(
          p.opcodes.measureResult,
          measurementBody(request, {
            width: 40,
            height: 20,
            minimum: 40,
            maximum: 40,
            baseline: -1,
          }),
        );
      }
      if (state.preparationReady || !state.preparation) break;
    }
    return state;
  }
  async function start(f) {
    await f.start([]);
    const bytes = new Uint8Array(32 + 40 * 20 * 4);
    bytes.set(rasterImageHeader(40, 20));
    assert.equal(
      (
        await f.commit([
          c.create(h(1), 'image'),
          c.layout(h(1), { enforceBounds: true }),
          c.constraints(
            h(1),
            { kind: 'finite', min: 80, max: 80 },
            { kind: 'finite', min: 60, max: 60 },
          ),
          c.acquireResource(h(1), bytes),
          c.bindResource(h(1), h(1)),
          c.imageStyle(h(1), natural),
        ])
      ).status,
      p.statuses.accepted,
    );
  }
  for (const profile of ['native', 'single-worker', 'threaded']) {
    test(
      `${profile}: canonical image fit, scale, alignment, repeat, flip and nine-patch placement are resolved in Core`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await start(f);
          const cases = [
            ['fill', [0, 0, 40, 20], [0, 0, 80, 60]],
            ['contain', [0, 0, 40, 20], [0, 10, 80, 40]],
            ['cover', [20 / 3, 0, 80 / 3, 20], [0, 0, 80, 60]],
            ['fitWidth', [0, 0, 40, 20], [0, 10, 80, 40]],
            ['fitHeight', [20 / 3, 0, 80 / 3, 20], [0, 0, 80, 60]],
            ['none', [0, 0, 40, 20], [30, 25, 20, 10]],
            ['scaleDown', [0, 0, 40, 20], [30, 25, 20, 10]],
          ];
          for (const [fit, source, destination] of cases) {
            await f.commit([c.imageStyle(h(1), { ...natural, fit })]);
            assert.equal((await prepare(f)).preparationReady, true);
            const scene = await f.send(p.opcodes.preparationScene),
              plan = scene.nodes[0].imagePaint;
            assert.equal(plan.tiles.length, 1);
            close(plan.tiles[0].source, source);
            close(plan.tiles[0].destination, destination);
            await f.tick();
            await f.present();
          }
          const beforeRepeat = (await f.inspect()).imagePaintWork;
          await f.commit([
            c.imageStyle(h(1), {
              ...natural,
              repeat: 'repeat',
              alignment: { x: -1, y: -1 },
              flip: true,
            }),
          ]);
          const state = await prepare(f),
            plan = (await f.send(p.opcodes.preparationScene)).nodes[0].imagePaint;
          assert.equal(plan.tiles.length, 24);
          assert.equal(plan.clip, true);
          assert.equal(plan.flip, true);
          close(plan.bounds, [0, 0, 80, 60]);
          assert.equal(
            state.imagePaintWork - beforeRepeat,
            25n,
            'Actual Core image placement work is counted',
          );
          await f.tick();
          await f.present();
          await f.commit([
            c.imageStyle(h(1), {
              ...natural,
              centerSlice: { left: 2, top: 2, right: 18, bottom: 8 },
            }),
          ]);
          assert.equal((await prepare(f)).preparationReady, true);
          const nine = (await f.send(p.opcodes.preparationScene)).nodes[0].imagePaint;
          assert.deepEqual(nine.center, [4, 4, 36, 16]);
          close(nine.tiles[0].destination, [0, 0, 80, 60]);
          await f.tick();
          await f.present();
          await f.commit([c.imageStyle(h(1), { ...natural, alignment: { x: 3, y: -3 } })]);
          assert.equal((await prepare(f)).preparationReady, true);
          const overflow = (await f.send(p.opcodes.preparationScene)).nodes[0].imagePaint;
          close(overflow.bounds, [120, -50, 20, 10]);
        }),
    );
    test(
      `${profile}: malformed raw images and an excessive tile plan cannot replace accepted image geometry`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await start(f);
          assert.equal((await prepare(f)).preparationReady, true);
          await f.tick();
          await f.present();
          const before = await f.send(p.opcodes.layoutSnapshot),
            bad = rasterImageHeader(40, 20);
          assert.equal(
            (await f.commit([c.acquireResource(h(2), bad), c.bindResource(h(1), h(2))])).status,
            p.statuses.invalidValue,
          );
          assert.equal((await f.inspect()).document, before.document);
          await f.commit([c.imageStyle(h(1), { ...natural, scale: 2000, repeat: 'repeat' })]);
          const failed = await prepare(f);
          assert.equal(failed.preparationReady, false);
          assert.equal(failed.failedDocument, f.epoch);
          assert.deepEqual((await f.send(p.opcodes.layoutSnapshot)).nodes, before.nodes);
          await f.commit([
            c.bindResource(h(1), null),
            c.imageStyle(h(1), {
              width: 0,
              height: 0,
              centerSlice: { left: 1, top: 1, right: 2, bottom: 2 },
            }),
          ]);
          assert.equal((await prepare(f)).preparationReady, true);
          const empty = (await f.send(p.opcodes.preparationScene)).nodes[0].imagePaint;
          assert.equal(empty.tiles.length, 0);
          close(empty.bounds, [0, 0, 0, 0]);
        }),
    );
  }
}
