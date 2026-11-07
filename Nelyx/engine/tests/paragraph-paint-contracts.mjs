// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  commands as c,
  protocol as p,
  measurementBody,
} from '../../runtime/engine-client/index.ts';
export function paragraphPaintContracts({ using, timeout, h }) {
  const expr = (op, ...args) => ({ op, args }),
    placement = (extra = {}) => ({
      fontRevision: 1n,
      width: 120,
      height: 24,
      baseline: 18,
      rect: [expr('subtract', expr('width'), 60), -30, 60, 12],
      ...extra,
    });
  async function prepare(f) {
    for (let i = 0; i < 30; i++) {
      const state = await f.step();
      if (state.measureRequest) {
        const request = await f.send(p.opcodes.measureRequest);
        assert.equal(request.nodes[0].width, 120, 'Paint paragraph ignores parent bounds');
        const result = await f.send(
          p.opcodes.measureResult,
          measurementBody(request, {
            width: 120,
            height: 24,
            minimum: 40,
            maximum: 120,
            baseline: 18,
          }),
        );
        assert.equal(result.status, p.statuses.ok);
      }
      if (state.preparationReady || !state.preparation) return state;
    }
    throw Error('Recorded paragraph preparation did not terminate');
  }
  for (const profile of ['native', 'single-worker', 'threaded'])
    test(
      `${profile}: recorded paragraphs verify font/metrics, preserve parent size and scale in Content with atomic rollback`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([
            c.create(h(1), 'box'),
            c.layout(h(1)),
            c.properties(h(1), { width: 40, height: 8 }),
          ]);
          const changes = [
            c.create(h(2), 'paragraph'),
            c.attach(h(2), h(1), 0),
            c.text(h(2), 'paint', 18, 0xff123456),
            c.layout(h(2), { paintChild: true }),
            c.constraints(h(2), { kind: 'finite', min: 120, max: 120 }, { kind: 'unbounded' }),
            c.eventPolicy(h(2), p.eventPolicies.canonicalHitTest | p.eventPolicies.deferToChild),
            c.paintPlacement(h(2), placement()),
          ];
          assert.equal((await f.commit(changes)).status, p.statuses.accepted);
          await prepare(f);
          await f.tick();
          await f.present();
          let frame = await f.send(p.opcodes.semanticsSnapshot),
            parent = frame.nodes.find((n) => n.node.slot === 1),
            text = frame.nodes.find((n) => n.node.slot === 2);
          assert.deepEqual(
            [parent.width, parent.height],
            [40, 8],
            'A paint resource must not resize its owner',
          );
          assert.deepEqual(text.matrix, [0.5, 0, 0, 0.5, -20, -30]);
          assert.deepEqual([text.content.width, text.content.height, text.baseline], [120, 24, 18]);
          assert.equal(text.paintPlacement.fontRevision, 1n);
          assert.equal(text.semantics, null);
          assert.equal(
            frame.surfaceCommit,
            null,
            'CPU publication does not claim displayed pixels',
          );
          const before = await f.inspect();
          assert.throws(
            () => c.paintPlacement(h(2), placement({ fontRevision: 0n })),
            /font\/geometry/,
          );
          for (const mutate of [
            (v) => v.setBigUint64(0, 0n, true),
            (v) => v.setFloat64(8, NaN, true),
            (v) => v.setUint32(40, 2, true),
            (v) => v.setFloat64(p.paintPlacementBytes + p.nativePaintHeaderBytes + 456, 2, true),
          ]) {
            const invalid = c.paintPlacement(h(2), placement());
            mutate(new DataView(invalid.buffer, invalid.byteOffset + 16, invalid.byteLength - 16));
            assert.equal((await f.commit([invalid])).status, p.statuses.invalidValue);
          }
          for (const invalid of [
            c.layout(h(2), {}),
            c.eventPolicy(h(2), 0),
            c.semantics(h(2), { role: 'text', label: 'Paint is not an extra semantic peer' }),
          ])
            assert.equal((await f.commit([invalid])).status, p.statuses.invalidValue);
          assert.equal((await f.inspect()).document, before.document);
          await f.commit([c.properties(h(1), { width: 80, height: 8 })]);
          await prepare(f);
          await f.tick();
          await f.present();
          frame = await f.send(p.opcodes.semanticsSnapshot);
          assert.deepEqual(
            frame.nodes.find((n) => n.node.slot === 2).matrix,
            [0.5, 0, 0, 0.5, 20, -30],
            'Placement follows the final resized owner',
          );
          const published = frame.publishedDocument;
          for (const invalid of [{ fontRevision: 2n }, { height: 25 }]) {
            const accepted = await f.commit([c.paintPlacement(h(2), placement(invalid))]);
            assert.equal(accepted.status, p.statuses.accepted);
            const failed = await prepare(f);
            assert.equal(
              failed.failedDocument,
              accepted.document,
              'A changed font or geometry fails preparation',
            );
            assert.equal(
              failed.publishedDocument,
              published,
              'A rejected preparation preserves the old displayed scene',
            );
          }
          await f.commit([c.paintPlacement(h(2), placement())]);
          await prepare(f);
          await f.tick();
          await f.present();
          assert.equal(
            (await f.inspect()).publishedDocument,
            f.epoch,
            'A later valid recording recovers',
          );
          await f.send(p.opcodes.closeView);
          const closed = await f.send(p.opcodes.closeSession, undefined, {
            owner: { session: 1, app: 1, view: 0, generation: 0 },
          });
          assert.equal(closed.reservedBytes, 0n, 'All paint program and paragraph records retire');
        }),
    );
}
