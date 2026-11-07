// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  commands as c,
  protocol as p,
  measurementBody,
} from '../../runtime/engine-client/index.ts';
const shape = {
  kind: 'rrect',
  radii: Array(8).fill(0),
  strokeWidth: 0,
  strokeColor: 0,
  strokeAlign: 0,
};
const entry = (kind, extra = {}) => ({ kind, shape, color: 0, ...extra });
export function orderedPaintContracts({ using, timeout, h }) {
  for (const profile of ['native', 'single-worker', 'threaded'])
    test(
      `${profile}: ordered paragraph references preserve child boundaries, frame geometry, ownership and atomic rejection`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([
            c.create(h(1), 'stack'),
            c.properties(h(1), { width: 200, height: 100 }),
            c.create(h(2), 'box'),
            c.attach(h(2), h(1)),
            c.properties(h(2), { width: 80, height: 80 }),
            c.paint(h(2), 0xff224466),
          ]);
          const paragraph = (node) => entry('paragraph', { reference: h(node) }),
            boundary = entry('children'),
            rect = entry('shape', {
              color: 0x8077bb22,
              geometry: { kind: 'program', rect: [0, 0, 90, 40] },
            }),
            stream = [
              paragraph(3),
              rect,
              boundary,
              entry('save'),
              entry('clip', { geometry: { kind: 'program', rect: [0, 0, 150, 80] } }),
              paragraph(4),
              paragraph(3),
              entry('restore'),
            ];
          const changes = [];
          for (const node of [3, 4])
            changes.push(
              c.create(h(node), 'paragraph'),
              c.attach(h(node), h(1), node - 2),
              c.text(h(node), 'recorded', 18, 0x80172033),
              c.layout(h(node), { paintChild: true }),
              c.constraints(h(node), { kind: 'finite', min: 120, max: 120 }, { kind: 'unbounded' }),
              c.eventPolicy(
                h(node),
                p.eventPolicies.canonicalHitTest | p.eventPolicies.deferToChild,
              ),
              c.paintPlacement(h(node), {
                fontRevision: 1n,
                width: 120,
                height: 24,
                baseline: 18,
                rect: [node * 10, 10, 120, 24],
              }),
            );
          changes.push(c.nativePaint(h(1), stream));
          assert.equal((await f.commit(changes)).status, p.statuses.accepted);
          let measured = 0;
          for (let i = 0; i < 30; i++) {
            const state = await f.step();
            if (state.measureRequest) {
              const request = await f.send(p.opcodes.measureRequest);
              measured++;
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
          assert.equal(measured, 2);
          await f.tick();
          const frame = await f.present(),
            parent = frame.nodes.find((n) => n.node.slot === 1);
          assert.equal(parent.width, 200);
          assert.equal(parent.height, 100);
          assert.equal(frame.framePaintNodes, 1n);
          assert.ok(frame.framePaintWork > 0n);
          assert.deepEqual(
            parent.nativePaint.map((e) => e.kind),
            stream.map((e) => e.kind),
          );
          for (const node of [3, 4]) {
            const resource = frame.nodes.find((n) => n.node.slot === node);
            assert.ok(resource.flags & p.nodeFlags.paintResource);
            assert.equal(resource.semantics, null);
          }
          assert.deepEqual(parent.nativePaint[0].transform, [1, 0, 0, 1, 30, 10]);
          const before = await f.inspect();
          for (const [bad, status] of [
            [[boundary, boundary], p.statuses.invalidValue],
            [[entry('save'), boundary, entry('restore')], p.statuses.invalidValue],
            [[boundary, entry('physical')], p.statuses.capabilityMissing],
            [[paragraph(2)], p.statuses.invalidGraph],
            [[entry('paragraph', { reference: h(3, 2) })], p.statuses.invalidHandle],
          ]) {
            assert.equal((await f.commit([c.nativePaint(h(1), bad)])).status, status);
            assert.equal((await f.inspect()).document, before.document);
          }
          assert.equal(
            (await f.commit([c.nativePaint(h(3), [rect])])).status,
            p.statuses.invalidGraph,
          );
          await f.commit([c.nativePaint(h(1), [])]);
          await f.ready();
          await f.present();
          const retired = await f.send(p.opcodes.semanticsSnapshot);
          assert.ok(
            retired.nodes
              .filter((n) => n.paintPlacement)
              .every((n) => !(n.flags & p.nodeFlags.paintResource)),
          );
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
