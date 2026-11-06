// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { commands as c, protocol as p, response } from '../../runtime/engine-client/index.ts';
import { nativePaintBody, readNativePaint } from '../../runtime/engine-client/native-paint.ts';

const shape = {
  kind: 'rrect',
  radii: Array(8).fill(0),
  strokeWidth: 0,
  strokeAlign: 0,
  strokeColor: 0,
};
const expression = (op, ...args) => ({ op, args });
const program = (rect, extra = {}) => ({
  kind: 'shape',
  shape,
  color: 0xff123456,
  geometry: { kind: 'program', rect, ...extra },
});
const globalOwner = { session: 1, app: 1, view: 0, generation: 0 };
export function paintProgramContracts({ using, timeout, h }) {
  for (const profile of ['native', 'single-worker', 'threaded']) {
    test(
      `${profile}: paint programs resolve final layout, repeated tick colors, lazy branches and scoped clips`,
      { timeout },
      () =>
        using(profile, async (f) => {
          const width = expression('width'),
            height = expression('height'),
            index = expression('index');
          const ticks = program(
            [
              expression(
                'multiply',
                index,
                expression('divide', expression('subtract', width, 20), 4),
              ),
              expression('subtract', expression('divide', height, 2), 2),
              4,
              4,
            ],
            {
              repeat: 5,
              radii: Array(8).fill(2),
              color: expression(
                'select',
                expression('lessEqual', index, 2),
                0xff00aa00,
                0xffaa0000,
              ),
            },
          );
          const entries = [
            { kind: 'save', shape, color: 0 },
            {
              ...program([10, 0, expression('max', 0, expression('subtract', width, 20)), height], {
                radii: Array(8).fill(expression('min', 20, expression('divide', height, 2))),
              }),
              kind: 'clip',
            },
            ticks,
            { kind: 'restore', shape, color: 0 },
            program([expression('clamp', 999, 0, width), 0, 2, 2], {
              visible: expression('equal', 1, 1),
              color: expression('select', 1, 0xffabcdef, expression('divide', 1, 0)),
            }),
            program([expression('divide', 1e300, 0), 0, 2, 2], { visible: 0, repeat: 1e20 }),
          ];
          const raw = readNativePaint(nativePaintBody(entries));
          assert.equal(raw[2].geometry.repeat, 5);
          assert.equal(raw[2].geometry.color.op, 'select');
          await f.start([
            c.create(h(1), 'box'),
            c.properties(h(1), { width: 160, height: 40 }),
            c.layout(h(1), { preferredSize: true, expandPreferredWidth: true }),
            c.nativePaint(h(1), entries),
          ]);
          let frame = await f.send(p.opcodes.semanticsSnapshot);
          assert.ok(frame.capabilities & p.capabilities.paintPrograms);
          let paint = frame.nodes[0].nativePaint;
          assert.deepEqual(
            paint.map((e) => e.kind),
            ['save', 'clip', 'shape', 'shape', 'shape', 'shape', 'shape', 'restore', 'shape'],
          );
          assert.deepEqual(
            paint
              .slice(2, 7)
              .map((e) => [e.transform[4], e.transform[5], e.width, e.height, e.color]),
            [
              [0, 18, 4, 4, 0xff00aa00],
              [70, 18, 4, 4, 0xff00aa00],
              [140, 18, 4, 4, 0xff00aa00],
              [210, 18, 4, 4, 0xffaa0000],
              [280, 18, 4, 4, 0xffaa0000],
            ],
          );
          assert.equal(paint[8].transform[4], 300);
          assert.equal(paint[8].color, 0xffabcdef);
          await f.resize(200, 200);
          await f.ready();
          await f.present();
          frame = await f.send(p.opcodes.semanticsSnapshot);
          paint = frame.nodes[0].nativePaint;
          assert.deepEqual(
            paint.slice(2, 7).map((e) => e.transform[4]),
            [0, 45, 90, 135, 180],
          );
          assert.equal(paint[1].width, 180);
          assert.equal(frame.nodes[0].control, null);
          assert.equal(
            (await f.send(p.opcodes.closeSession, undefined, { owner: globalOwner })).reservedBytes,
            0n,
          );
        }),
    );
    test(
      `${profile}: malformed paint expression DAGs and unbalanced scopes roll back transactions atomically`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          const paint = () => [program([expression('add', expression('width'), 1), 0, 4, 4])];
          await f.start([
            c.create(h(1), 'box'),
            c.properties(h(1), { width: 100, height: 40 }),
            c.nativePaint(h(1), paint()),
          ]);
          const before = await f.inspect();
          for (const mutate of [
            (v, at) => v.setUint32(at + 4, 1, true),
            (v, at) => v.setUint32(at, 99, true),
            (v, at) => v.setFloat64(at + 16, NaN, true),
            (v) => v.setUint32(p.nativePaintHeaderBytes + 400, 0xffffffff, true),
            (v) => v.setFloat64(p.nativePaintHeaderBytes + 456, 1.5, true),
            (v) => v.setUint32(12, 1, true),
          ]) {
            const bad = c.nativePaint(h(1), paint()),
              v = new DataView(bad.buffer, bad.byteOffset + 16, bad.byteLength - 16);
            const at = p.nativePaintHeaderBytes + p.nativePaintBytes;
            mutate(v, at);
            const rejected = await f.commit([c.paint(h(1), 0xffabcdef), bad]);
            assert.equal(rejected.status, p.statuses.invalidValue);
            assert.equal((await f.inspect()).document, before.document);
            assert.equal((await f.inspect()).nodes[0].color, before.nodes[0].color);
            assert.equal(
              response(await transport.exchange(rejected.bytes)).status,
              p.statuses.invalidValue,
            );
          }
          for (const scopes of [
            [{ kind: 'save', shape, color: 0 }],
            [{ kind: 'restore', shape, color: 0 }],
          ])
            assert.equal(
              (await f.commit([c.nativePaint(h(1), scopes)])).status,
              p.statuses.invalidValue,
            );
          const cyclic = expression('add', 1, 0);
          cyclic.args[1] = cyclic;
          assert.throws(() => nativePaintBody([program([cyclic, 0, 1, 1])]), /Cyclic/);
          assert.equal(
            (await f.send(p.opcodes.closeSession, undefined, { owner: globalOwner })).reservedBytes,
            0n,
          );
        }),
    );
    test(
      `${profile}: derived paint failures and repeat budgets preserve the last published frame and recover`,
      { timeout },
      () =>
        using(profile, async (f) => {
          const good = [program([0, 0, expression('width'), 10])];
          await f.start([
            c.create(h(1), 'box'),
            c.properties(h(1), { width: 100, height: 40 }),
            c.nativePaint(h(1), good),
          ]);
          let previous = await f.send(p.opcodes.semanticsSnapshot);
          let expensive = expression('index');
          for (let i = 0; i < 200; ++i) expensive = expression('add', expensive, 1);
          for (const [entry, status] of [
            [program([expression('divide', 1, 0), 0, 4, 4]), p.statuses.invalidValue],
            [
              program([0, 0, 4, 4], { repeat: p.limits.nativePaintDraws + 1 }),
              p.statuses.budgetExceeded,
            ],
            [
              program([expensive, 0, 4, 4], { repeat: p.limits.nativePaintDraws }),
              p.statuses.budgetExceeded,
            ],
          ]) {
            const accepted = await f.commit([c.nativePaint(h(1), [entry])]);
            assert.equal(accepted.status, p.statuses.accepted);
            let state;
            for (let i = 0; i < 20; ++i) {
              state = await f.step();
              if (state.failedDocument === accepted.resultEpoch) break;
            }
            assert.equal(state.failedDocument, accepted.resultEpoch);
            const events = (await f.send(p.opcodes.pollEvents)).events;
            assert.ok(
              events.some((e) => e.kind === p.events.preparationFailed && e.status === status),
            );
            const retained = await f.send(p.opcodes.semanticsSnapshot);
            assert.equal(retained.publishedDocument, previous.publishedDocument);
            assert.equal(retained.nodes[0].nativePaint[0].width, 100);
            await f.commit([c.nativePaint(h(1), good)]);
            await f.ready();
            await f.present();
            previous = await f.send(p.opcodes.semanticsSnapshot);
            assert.equal(previous.publishedDocument, previous.document);
          }
          assert.equal(
            (await f.send(p.opcodes.closeSession, undefined, { owner: globalOwner })).reservedBytes,
            0n,
          );
        }),
    );
  }
}
