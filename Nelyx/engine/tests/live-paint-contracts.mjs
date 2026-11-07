// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  commands as c,
  protocol as p,
  measurementBody,
} from '../../runtime/engine-client/index.ts';
const e = (op, ...args) => ({ op, args }),
  worldX = e('worldX', 0, 0),
  shift = e('max', 0, e('subtract', 8, worldX));
const shape = {
  kind: 'rrect',
  radii: Array(8).fill(0),
  strokeWidth: 0,
  strokeColor: 0,
  strokeAlign: 0,
};
const path = (reference) => ({
  kind: 'path',
  shape,
  reference,
  color: 0xff284870,
  path: {
    commands: [
      ['move', 0, 0],
      ['line', -10, -10],
      ['line', 10, -10],
      ['close'],
      ['rrect', shift, -38, 60, 28, 14, 14, 14, 14, 14, 14, 14, 14],
    ],
  },
  geometry: { kind: 'program', rect: [0, 0, 40, 20] },
});
export function livePaintContracts({ using, timeout, h }) {
  for (const profile of ['native', 'single-worker', 'threaded'])
    test(
      `${profile}: frame paint and recorded paragraphs follow prepared scroll/layer links without App or Content work`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([
            c.create(h(1), 'scrollViewport'),
            c.properties(h(1), { width: 300, height: 200, maximum: 500, horizontal: true }),
            c.create(h(2), 'box'),
            c.attach(h(2), h(1)),
            c.properties(h(2), { x: 120, y: 100, width: 40, height: 20 }),
            c.layerLink(h(2), { kind: 'leader' }),
            c.create(h(3), 'box'),
            c.properties(h(3), { width: 40, height: 20 }),
            c.layerLink(h(3), {
              kind: 'follower',
              leader: h(2),
              leaderAnchor: { x: -1, y: -1 },
              followerAnchor: { x: -1, y: -1 },
            }),
            c.create(h(4), 'box'),
            c.properties(h(4), { width: 300, height: 200 }),
            c.nativePaint(h(4), [path(h(3))]),
          ]);
          assert.equal(
            (
              await f.commit([
                c.create(h(5), 'paragraph'),
                c.attach(h(5), h(4)),
                c.text(h(5), 'paint', 18, 0xffeeee22),
                c.layout(h(5), { paintChild: true }),
                c.constraints(h(5), { kind: 'finite', min: 120, max: 120 }, { kind: 'unbounded' }),
                c.eventPolicy(
                  h(5),
                  p.eventPolicies.canonicalHitTest | p.eventPolicies.deferToChild,
                ),
                c.paintPlacement(h(5), {
                  reference: h(3),
                  fontRevision: 1n,
                  width: 120,
                  height: 24,
                  baseline: 18,
                  rect: [e('add', shift, 10), -32, 60, 12],
                }),
              ])
            ).status,
            p.statuses.accepted,
          );
          for (let i = 0; i < 30; i++) {
            const state = await f.step();
            if (state.measureRequest) {
              const request = await f.send(p.opcodes.measureRequest);
              assert.equal(
                (
                  await f.send(
                    p.opcodes.measureResult,
                    measurementBody(request, {
                      width: 120,
                      height: 24,
                      minimum: 40,
                      maximum: 120,
                      baseline: 18,
                    }),
                  )
                ).status,
                p.statuses.ok,
              );
            }
            if (state.preparationReady) break;
          }
          await f.tick();
          await f.present();
          const before = await f.send(p.opcodes.semanticsSnapshot),
            node = (state, slot) => state.nodes.find((n) => n.node.slot === slot);
          assert.deepEqual(node(before, 5).matrix, [0.5, 0, 0, 0.5, 130, 68]);
          assert.ok(node(before, 4).flags & p.nodeFlags.livePaint);
          assert.deepEqual(node(before, 4).nativePaint[0].transform, [1, 0, 0, 1, 120, 100]);
          const commands = before.transactionWork,
            preparation = before.activePreparation;
          assert.equal(
            (
              await f.input('update', 0, {
                dx: 140,
                target: h(1),
                x: 10,
                y: 150,
                source: 'wheelUnknown',
              })
            ).status,
            p.statuses.ok,
          );
          await f.tick();
          const frame = await f.present();
          assert.equal(frame.transactionWork, commands);
          assert.equal(frame.activePreparation, preparation);
          assert.equal(frame.framePaintNodes, 1n);
          assert.equal(frame.framePlacementNodes, 1n);
          assert.ok(frame.framePaintWork > 0n);
          assert.deepEqual(node(frame, 3).matrix, [1, 0, 0, 1, -20, 100]);
          const paint = node(frame, 4).nativePaint[0];
          assert.deepEqual(paint.transform, [1, 0, 0, 1, -20, 100]);
          assert.deepEqual(paint.path.commands[0], ['move', 0, 0]);
          assert.equal(
            paint.path.commands[4][1],
            28,
            'Only the bubble is shifted back inside the screen; the tail follows the leader',
          );
          assert.deepEqual(node(frame, 5).matrix, [0.5, 0, 0, 0.5, 18, 68]);
          const snapshot = await f.send(p.opcodes.semanticsSnapshot);
          assert.deepEqual(node(snapshot, 5).matrix, node(frame, 5).matrix);
          assert.equal(snapshot.framePaintWork, frame.framePaintWork);
          // Reusing an immutable publication must not overwrite its resolved paint.
          assert.equal(node(before, 4).nativePaint[0].path.commands[4][1], 0);
          assert.equal(
            (
              await f.send(p.opcodes.closeSession, undefined, {
                owner: { session: 1, app: 1, view: 0, generation: 0 },
              })
            ).reservedBytes,
            0n,
          );
        }),
    );
  for (const profile of ['native', 'single-worker', 'threaded'])
    test(
      `${profile}: world paint visibility refreshes from empty preparation and invalid live expressions preserve publication`,
      { timeout },
      () =>
        using(profile, async (f) => {
          const program = (rect, visible) => ({
            kind: 'shape',
            shape,
            color: 0xff284870,
            geometry: { kind: 'program', rect, ...(visible ? { visible } : {}) },
          });
          await f.start([
            c.create(h(1), 'scrollViewport'),
            c.properties(h(1), { width: 300, height: 200, maximum: 500, horizontal: true }),
            c.create(h(2), 'box'),
            c.attach(h(2), h(1)),
            c.properties(h(2), { x: 100, y: 40, width: 80, height: 40 }),
            c.nativePaint(h(2), [program([0, 0, 20, 20], e('less', worldX, 50))]),
          ]);
          let before = await f.send(p.opcodes.semanticsSnapshot);
          assert.ok(before.nodes[1].flags & p.nodeFlags.livePaint);
          assert.equal(before.nodes[1].nativePaint.length, 0);
          await f.input('update', 0, { dx: 80, x: 10, y: 100, source: 'wheelUnknown' });
          await f.tick();
          let frame = await f.present();
          assert.equal(frame.nodes[1].nativePaint.length, 1);
          assert.equal(frame.framePaintNodes, 1n);
          assert.ok(frame.framePaintWork > 0n);
          assert.equal(frame.transactionWork, before.transactionWork);
          assert.equal(frame.activePreparation, before.activePreparation);
          assert.equal(
            (
              await f.commit([
                c.nativePaint(h(2), [program([e('divide', 100, worldX), 0, 20, 20])]),
              ])
            ).status,
            p.statuses.accepted,
          );
          await f.ready();
          await f.present();
          before = await f.send(p.opcodes.semanticsSnapshot);
          await f.input('update', 0, { dx: 20, x: 10, y: 100, source: 'wheelUnknown' });
          await f.tick();
          assert.equal(
            (await f.send(p.opcodes.takeFrame)).status,
            p.statuses.invalidValue,
            'Live arithmetic fails explicitly instead of drawing stale prepared paint',
          );
          const retained = await f.send(p.opcodes.semanticsSnapshot);
          assert.equal(retained.publication, before.publication);
          assert.equal(retained.nodes[1].nativePaint[0].transform[4], 5);
          await f.input('update', 0, { dx: -50, x: 10, y: 100, source: 'wheelUnknown' });
          await f.tick();
          frame = await f.present();
          assert.equal(frame.nodes[1].nativePaint[0].transform[4], 2);
          assert.equal(frame.nodes[1].matrix[4], 50);
          assert.equal(frame.transactionWork, before.transactionWork);
          assert.equal(frame.activePreparation, before.activePreparation);
          assert.equal(
            (
              await f.send(p.opcodes.closeSession, undefined, {
                owner: { session: 1, app: 1, view: 0, generation: 0 },
              })
            ).reservedBytes,
            0n,
          );
        }),
    );
}
