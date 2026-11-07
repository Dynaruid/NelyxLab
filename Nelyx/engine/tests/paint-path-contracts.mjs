// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { commands as c, protocol as p } from '../../runtime/engine-client/index.ts';
import { nativePaintBody, readNativePaint } from '../../runtime/engine-client/native-paint.ts';
const shape = {
  kind: 'rrect',
  radii: Array(8).fill(0),
  strokeWidth: 0,
  strokeColor: 0,
  strokeAlign: 0,
};
const width = { op: 'width', args: [] },
  height = { op: 'height', args: [] };
const path = (
  commands = [
    ['move', -10, -20],
    ['line', width, 0],
    ['quad', 20, 10, 0, height],
    ['close'],
    ['rrect', 5, 6, 40, 20, 4, 4, 4, 4, 4, 4, 4, 4],
  ],
  options = {},
) => ({
  kind: 'path',
  shape,
  color: 0x80284870,
  path: { fillRule: 'nonZero', commands },
  geometry: { kind: 'program', rect: [0, 0, width, height], ...options },
});
export function paintPathContracts({ using, timeout, h }) {
  for (const profile of ['native', 'single-worker', 'threaded'])
    test(
      `${profile}: compound path programs resolve final geometry, bound work and reject malformed input atomically`,
      { timeout },
      () =>
        using(profile, async (f) => {
          assert.deepEqual(readNativePaint(nativePaintBody([path()]))[0].path.commands[1], [
            'line',
            width,
            0,
          ]);
          await f.start([
            c.create(h(1), 'box'),
            c.properties(h(1), { width: 80, height: 40 }),
            c.layout(h(1), { preferredSize: true, expandPreferredWidth: true }),
            c.nativePaint(h(1), [path()]),
          ]);
          let published = await f.send(p.opcodes.semanticsSnapshot),
            entry = published.nodes[0].nativePaint[0];
          assert.equal(entry.kind, 'path');
          assert.deepEqual(entry.path.commands[1], ['line', 300, 0]);
          assert.deepEqual(entry.pathBounds, { x: -10, y: -20, width: 310, height: 60 });
          await f.resize(200, 100);
          await f.ready();
          await f.present();
          published = await f.send(p.opcodes.semanticsSnapshot);
          entry = published.nodes[0].nativePaint[0];
          assert.deepEqual(entry.path.commands[1], ['line', 200, 0]);
          assert.deepEqual(entry.pathBounds, { x: -10, y: -20, width: 210, height: 60 });
          const before = await f.inspect();
          for (const mutate of [
            (v, e, a) => v.setUint32(a, 99, true),
            (v, e, a) => v.setUint32(a + 4, 1, true),
            (v, e, a) => v.setUint32(a + 8, 0xffffffff, true),
            (v, e, a) => v.setUint32(a + 56, 1, true),
            (v, e) => v.setUint32(e + 464, 1, true),
            (v, e) => v.setUint32(e + 468, 4, true),
            (v, e) => v.setUint32(e + 472, 2, true),
            (v, e) => v.setFloat64(e + 480, 1, true),
            (v) => v.setUint32(20, 1, true),
          ]) {
            const bad = c.nativePaint(h(1), [path()]),
              v = new DataView(bad.buffer, bad.byteOffset + 16, bad.byteLength - 16),
              e = p.nativePaintHeaderBytes,
              a = e + p.nativePaintBytes + v.getUint32(8, true) * p.nativePaintExpressionBytes;
            mutate(v, e, a);
            assert.equal(
              (await f.commit([c.paint(h(1), 0xffabcdef), bad])).status,
              p.statuses.invalidValue,
            );
            assert.equal((await f.inspect()).document, before.document);
          }
          for (const [bad, status] of [
            [path([['rect', 1e12, 0, 1e12, 20]]), p.statuses.invalidValue],
            [path([['conic', 0, 0, 40, 40, 0]]), p.statuses.invalidValue],
            [path([['rrect', 0, 0, 40, 20, -1, 0, 0, 0, 0, 0, 0, 0]]), p.statuses.invalidValue],
            [path([['line', { op: 'divide', args: [1, 0] }, 0]]), p.statuses.invalidValue],
            [
              path(undefined, { repeat: Math.floor(p.limits.pathCommands / 5) + 1 }),
              p.statuses.budgetExceeded,
            ],
          ]) {
            const accepted = await f.commit([c.nativePaint(h(1), [bad])]);
            assert.equal(accepted.status, p.statuses.accepted);
            let state;
            for (let i = 0; i < 20; i++) {
              state = await f.step();
              if (state.failedDocument === accepted.resultEpoch) break;
            }
            assert.equal(state.failedDocument, accepted.resultEpoch);
            assert.ok(
              (await f.send(p.opcodes.pollEvents)).events.some(
                (e) => e.kind === p.events.preparationFailed && e.status === status,
              ),
            );
            assert.equal(
              (await f.send(p.opcodes.semanticsSnapshot)).publishedDocument,
              published.publishedDocument,
            );
          }
          await f.commit([
            c.nativePaint(h(1), [
              path([
                ['rect', 0, 0, 40, 40],
                ['rect', 10, 10, 20, 20],
              ]),
            ]),
          ]);
          await f.ready();
          await f.present();
          assert.equal((await f.inspect()).publishedDocument, f.epoch);
          const closed = await f.send(p.opcodes.closeSession, undefined, {
            owner: { session: 1, app: 1, view: 0, generation: 0 },
          });
          assert.equal(
            closed.reservedBytes,
            0n,
            'All command/expression/scratch and prepared path leases retire',
          );
        }),
    );
}
