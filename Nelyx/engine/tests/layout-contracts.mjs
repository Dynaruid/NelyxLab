// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  commands as c,
  protocol as p,
  measurementBody,
  layoutQueryBody,
} from '../../runtime/engine-client/index.ts';

export function layoutContracts({ using, timeout, h }) {
  const node = (slot, kind, parent, props = {}, layout = {}) => [
    c.create(h(slot), kind),
    c.properties(h(slot), props),
    c.layout(h(slot), layout),
    ...(parent ? [c.attach(h(slot), h(parent), slot - parent - 1)] : []),
  ];
  const snapshot = async (f) => {
    const value = await f.send(p.opcodes.layoutSnapshot);
    assert.equal(value.status, p.statuses.ok);
    return value;
  };
  const prepare = async (f, measure) => {
    let state;
    for (let i = 0; i < 30; ++i) {
      state = await f.step();
      if (state.measureRequest) {
        const request = await f.send(p.opcodes.measureRequest);
        assert.equal(request.status, p.statuses.ok);
        assert.equal(
          (await f.send(p.opcodes.measureResult, measurementBody(request, measure(request))))
            .status,
          p.statuses.ok,
        );
      }
      if (state.preparationReady || !state.preparation) break;
    }
    return state;
  };
  for (const profile of ['native', 'single-worker', 'threaded']) {
    test(
      `${profile}: layout policies reject incompatible kinds, malformed factors and old payloads atomically`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([...node(1, 'box', 0, { width: 100, height: 80 })]);
          const before = await f.inspect();
          for (const [options, status] of [
            [{ reverseMain: true }, p.statuses.capabilityMissing],
            [{ alignmentSizing: true }, p.statuses.capabilityMissing],
            [{ alignment: { x: 0, y: 0 }, widthFactor: 2 }, p.statuses.invalidValue],
            [
              { alignment: { x: 0, y: 0 }, alignmentSizing: true, childConstraints: 'inherit' },
              p.statuses.capabilityMissing,
            ],
            [
              { alignment: { x: 0, y: 0 }, alignmentSizing: true, widthFactor: -0.5 },
              p.statuses.invalidValue,
            ],
            [{ expandEmpty: true }, p.statuses.capabilityMissing],
            [{ clipOverflow: true }, p.statuses.capabilityMissing],
            [{ paragraphSizing: true }, p.statuses.capabilityMissing],
          ])
            assert.equal((await f.commit([c.layout(h(1), options)])).status, status);
          const unknown = c.layout(h(1), {});
          new DataView(unknown.buffer, unknown.byteOffset, unknown.byteLength).setUint32(
            16 + p.layoutFields.constraintFlags,
            8192,
            true,
          );
          assert.equal((await f.commit([unknown])).status, p.statuses.invalidValue);
          const old = c.layout(h(1), {}).slice(0, 104);
          new DataView(old.buffer, old.byteOffset, old.byteLength).setUint32(
            4,
            old.byteLength,
            true,
          );
          assert.notEqual((await f.commit([old])).status, p.statuses.accepted);
          const after = await f.inspect();
          assert.equal(after.document, before.document);
          assert.equal(after.activeDocument, before.activeDocument);
          assert.equal(
            (
              await f.commit([
                c.layout(h(1), {
                  alignment: { x: 0.5, y: -0.5 },
                  alignmentSizing: true,
                  widthFactor: 2,
                  heightFactor: 3,
                }),
              ])
            ).status,
            p.statuses.accepted,
          );
          await f.ready();
          await f.present();
          assert.equal((await f.inspect()).failedDocument, 0n);
        }),
    );
    test(
      `${profile}: Box and Stack align within their padded native constraints`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([
            ...node(
              1,
              'stack',
              0,
              { width: 200, height: 100 },
              {
                mainAlign: 'center',
                crossAlign: 'end',
                padding: { left: 10, right: 20, top: 5, bottom: 15 },
              },
            ),
            ...node(2, 'box', 1, { width: 30, height: 20 }),
          ]);
          let layout = await snapshot(f);
          assert.equal(layout.nodes[1].x, 80);
          assert.equal(layout.nodes[1].y, 65);
          await f.commit([
            c.layout(h(1), {
              direction: 'vertical',
              mainAlign: 'end',
              crossAlign: 'stretch',
              padding: { left: 10, right: 20, top: 5, bottom: 15 },
            }),
          ]);
          await f.ready();
          layout = await snapshot(f);
          assert.equal(layout.nodes[1].x, 10);
          assert.equal(layout.nodes[1].y, 65);
          assert.equal(layout.nodes[1].width, 170);
        }),
    );
    test(
      `${profile}: Wrap and Grid stretch each run and Grid distributes finite row space`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([
            ...node(1, 'wrap', 0, { width: 120 }, { gap: 10, runGap: 5, crossAlign: 'stretch' }),
            ...node(2, 'box', 1, { width: 55, height: 20 }),
            ...node(3, 'box', 1, { width: 55, height: 30 }),
            ...node(4, 'box', 1, { width: 55, height: 40 }),
          ]);
          let layout = await snapshot(f);
          assert.equal(layout.nodes[0].height, 75);
          assert.equal(layout.nodes[1].height, 30);
          assert.equal(layout.nodes[2].x, 65);
          assert.equal(layout.nodes[3].y, 35);
          await f.commit([
            ...node(
              5,
              'grid',
              0,
              { width: 120, height: 150 },
              {
                columns: 2,
                gap: 10,
                runGap: 5,
                crossAlign: 'stretch',
                mainAlign: 'spaceBetween',
                mainSize: 'max',
              },
            ),
            c.move(h(2), h(5), 0),
            c.move(h(3), h(5), 1),
            c.move(h(4), h(5), 2),
          ]);
          await f.ready();
          layout = await snapshot(f);
          assert.equal(layout.nodes.find((n) => n.node.slot === 2).height, 30);
          assert.equal(layout.nodes.find((n) => n.node.slot === 4).y, 110);
          const previous = layout.layoutDocument;
          await f.commit([
            c.constraints(h(2), { kind: 'unbounded' }, { kind: 'finite', min: 0, max: 20 }),
          ]);
          const failed = await prepare(f);
          assert.equal(failed.failedDocument, failed.document);
          assert.equal((await snapshot(f)).layoutDocument, previous);
        }),
    );
    test(
      `${profile}: Wrap and Grid baseline share measured, padded paragraph geometry`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start();
          await f.commit([
            ...node(2, 'wrap', 0, { width: 200 }, { gap: 10, crossAlign: 'baseline' }),
            ...node(
              3,
              'paragraph',
              2,
              { width: 80 },
              { padding: { top: 4, bottom: 6, left: 3, right: 7 } },
            ),
            c.text(h(3), '한'),
            ...node(4, 'paragraph', 2, { width: 80 }),
            c.text(h(4), 'A'),
          ]);
          const metrics = (r) => ({
            width: r.nodes[0].width,
            height: 20,
            minimum: 8,
            maximum: 40,
            baseline: r.nodes[0].node.slot === 3 ? 15 : 10,
          });
          assert.equal((await prepare(f, metrics)).preparationReady, true);
          await f.tick();
          let rows = (await snapshot(f)).nodes;
          const a = rows.find((n) => n.node.slot === 3),
            b = rows.find((n) => n.node.slot === 4);
          assert.equal(a.height, 30);
          assert.equal(a.baseline, 19);
          assert.deepEqual(a.content, { x: 3, y: 4, width: 70, height: 20 });
          assert.equal(a.y + a.baseline, b.y + b.baseline);
          await f.commit([
            ...node(5, 'grid', 0, { width: 200 }, { columns: 2, gap: 10, crossAlign: 'baseline' }),
            c.move(h(3), h(5), 0),
            c.move(h(4), h(5), 1),
          ]);
          assert.equal((await prepare(f, metrics)).preparationReady, true);
          await f.tick();
          rows = (await snapshot(f)).nodes;
          const ga = rows.find((n) => n.node.slot === 3),
            gb = rows.find((n) => n.node.slot === 4);
          assert.equal(ga.y + ga.baseline, gb.y + gb.baseline);
          assert.equal(gb.y, 9);
          await f.commit([
            ...node(6, 'stack', 0, { width: 200 }, { crossAlign: 'baseline' }),
            c.properties(h(4), { width: 80, height: 40 }),
            c.move(h(3), h(6), 0),
            c.move(h(4), h(6), 1),
          ]);
          assert.equal((await prepare(f, metrics)).preparationReady, true);
          await f.tick();
          rows = (await snapshot(f)).nodes;
          assert.equal(
            rows.find((n) => n.node.slot === 6).height,
            49,
            'The natural box includes both maximum ascent and descent',
          );
          await f.send(
            p.opcodes.layoutQuery,
            layoutQueryBody(
              h(6),
              'maxHeight',
              { kind: 'finite', min: 0, max: 200 },
              { kind: 'unbounded' },
            ),
            { id: 1n },
          );
          let intrinsic;
          for (let i = 0; i < 30; ++i) {
            const state = await f.step();
            if (state.measureRequest) {
              const pending = await f.send(p.opcodes.measureRequest);
              await f.send(p.opcodes.measureResult, measurementBody(pending, metrics(pending)));
            }
            intrinsic = await f.send(p.opcodes.layoutQueryResult, undefined, { id: 1n });
            if (intrinsic.status !== p.statuses.pending) break;
          }
          assert.equal(intrinsic.status, p.statuses.ok);
          assert.equal(intrinsic.layoutQuery.value, 49);
          assert.equal(intrinsic.layoutQuery.baseline, 19);
        }),
    );
    test(
      `${profile}: C++ Flex owns child constraints, placement, shrink and expand failures`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([
            ...node(1, 'flex', 0, { width: 300, height: 100 }, { gap: 10, crossAlign: 'center' }),
            ...node(2, 'box', 1, { width: 40, height: 20 }),
            ...node(3, 'box', 1, { height: 40 }, { flex: 2 }),
            ...node(4, 'box', 1, { height: 60 }, { flex: 1 }),
          ]);
          const layout = await snapshot(f),
            rows = layout.nodes;
          assert.equal(rows[1].x, 0);
          assert.equal(rows[1].y, 40);
          assert.equal(rows[2].x, 50);
          assert.equal(rows[2].width, 160);
          assert.equal(rows[2].y, 30);
          assert.equal(rows[3].x, 220);
          assert.equal(rows[3].width, 80);
          const accepted = await f.commit([
            c.constraints(h(2), { kind: 'expand' }, { kind: 'unbounded' }),
          ]);
          assert.equal(accepted.status, p.statuses.accepted);
          assert.equal((await snapshot(f)).layoutDocument, layout.layoutDocument);
          const failed = await prepare(f);
          assert.equal(failed.failedDocument, accepted.document);
          assert.equal((await snapshot(f)).nodes[2].width, 160);
          await f.commit([c.constraints(h(2), { kind: 'unbounded' }, { kind: 'unbounded' })]);
          await f.ready();
          assert.equal((await snapshot(f)).layoutDocument, f.epoch);
        }),
    );
    test(
      `${profile}: Wrap and Grid compute row coverage and share unchanged layout branches`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([
            ...node(1, 'wrap', 0, { width: 120 }, { gap: 10, runGap: 5 }),
            ...node(2, 'box', 1, { width: 55, height: 20 }),
            ...node(3, 'box', 1, { width: 55, height: 30 }),
            ...node(4, 'box', 1, { width: 55, height: 40 }),
          ]);
          let layout = await snapshot(f);
          assert.equal(layout.nodes[0].height, 75);
          assert.equal(layout.nodes[2].x, 65);
          assert.equal(layout.nodes[3].y, 35);
          const before = await f.inspect();
          await f.commit([c.paint(h(3), 0xff123456)]);
          await f.ready();
          let state = await f.inspect();
          assert.equal(state.layoutReused - before.layoutReused, 1n);
          assert.equal((await snapshot(f)).nodes[2].color, 0xff123456);
          await f.commit([
            c.layout(h(1), { columns: 2, gap: 10, runGap: 5 }),
            c.properties(h(1), { width: 120 }),
          ]);
          // Changing a node's immutable kind requires replacement, so use a second root for Grid.
          await f.commit([
            c.create(h(5), 'grid'),
            c.properties(h(5), { width: 120 }),
            c.layout(h(5), { columns: 2, gap: 10, runGap: 5 }),
            c.move(h(2), h(5), 0),
            c.move(h(3), h(5), 1),
            c.move(h(4), h(5), 2),
          ]);
          await f.ready();
          layout = await snapshot(f);
          assert.equal(layout.nodes.find((n) => n.node.slot === 5).height, 75);
          assert.equal(layout.nodes.find((n) => n.node.slot === 4).y, 35);
          state = await f.send(p.opcodes.closeSession, undefined, {
            owner: { session: 1, app: 1, view: 0, generation: 0 },
          });
          assert.equal(state.reservedBytes, 0n);
        }),
    );
    test(
      `${profile}: provider metrics suspend layout, reject late revisions, and preserve active geometry`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start();
          const prior = await snapshot(f);
          await f.commit([
            c.create(h(2), 'paragraph'),
            c.properties(h(2), { width: 180 }),
            c.layout(h(2)),
            c.text(h(2), '한글 😀 e\u0301'),
          ]);
          let request;
          for (let i = 0; i < 10; ++i) {
            const state = await f.step();
            if (state.measureRequest) {
              request = await f.send(p.opcodes.measureRequest);
              break;
            }
          }
          assert.ok(request);
          assert.equal(request.nodes[0].width, 180);
          assert.equal((await snapshot(f)).layoutDocument, prior.layoutDocument);
          const result = measurementBody(request, {
            width: 180,
            height: 54,
            minimum: 20,
            maximum: 240,
            baseline: 20,
          });
          const bad = result.slice();
          new DataView(bad.buffer).setBigUint64(24, request.measureRequest + 1n, true);
          assert.equal((await f.send(p.opcodes.measureResult, bad)).status, p.statuses.stale);
          await f.commit([c.text(h(2), '새 문서')]);
          assert.equal((await f.send(p.opcodes.measureResult, result)).status, p.statuses.ok);
          assert.equal((await f.send(p.opcodes.measureResult, result)).status, p.statuses.stale);
          await f.ready();
          let layout = await snapshot(f);
          assert.equal(layout.nodes[1].height, 54);
          assert.equal(layout.nodes[1].baseline, 20);
          const completed = layout.layoutDocument;
          await prepare(f, () => ({
            width: 180,
            height: 81,
            minimum: 20,
            maximum: 300,
            baseline: 20,
          }));
          await f.tick();
          layout = await snapshot(f);
          assert.ok(layout.layoutDocument > completed);
          assert.equal(layout.nodes[1].height, 81);
          await f.resize(260, 180);
          assert.equal((await f.send(p.opcodes.measureResult, result)).status, p.statuses.stale);
          await prepare(f, () => ({
            width: 180,
            height: 81,
            minimum: 20,
            maximum: 300,
            baseline: 20,
          }));
          await f.tick();
          assert.equal((await snapshot(f)).layoutMetrics, (await f.inspect()).metrics);
        }),
    );
    test(
      `${profile}: baseline, image intrinsic size and scroll extent use completed native layout`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start();
          await f.commit([
            c.create(h(2), 'flex'),
            c.properties(h(2), { width: 220 }),
            c.layout(h(2), { crossAlign: 'baseline', gap: 10 }),
            c.create(h(3), 'paragraph'),
            c.properties(h(3), { width: 100 }),
            c.layout(h(3)),
            c.text(h(3), 'A'),
            c.attach(h(3), h(2), 0),
            c.create(h(4), 'paragraph'),
            c.properties(h(4), { width: 100 }),
            c.layout(h(4)),
            c.text(h(4), '한'),
            c.attach(h(4), h(2), 1),
            c.create(h(5), 'image'),
            c.layout(h(5)),
            c.acquireResource(h(1), new Uint8Array([1])),
            c.bindResource(h(5), h(1)),
          ]);
          const state = await prepare(f, (r) =>
            r.nodes[0].kind === p.kinds.image
              ? { width: 80, height: 60, minimum: 80, maximum: 80, baseline: -1 }
              : {
                  width: r.nodes[0].width,
                  height: r.nodes[0].node.slot === 3 ? 20 : 30,
                  minimum: 10,
                  maximum: 100,
                  baseline: r.nodes[0].node.slot === 3 ? 14 : 22,
                },
          );
          assert.equal(state.preparationReady, true);
          await f.tick();
          let layout = await snapshot(f);
          const a = layout.nodes.find((n) => n.node.slot === 3),
            b = layout.nodes.find((n) => n.node.slot === 4);
          assert.equal(a.y + a.baseline, b.y + b.baseline);
          assert.equal(layout.nodes.find((n) => n.node.slot === 5).height, 60);
          await f.commit([
            c.destroy(h(1)),
            c.create(h(1, 2), 'scrollViewport'),
            c.properties(h(1, 2), { width: 200, height: 100 }),
            c.layout(h(1, 2)),
            c.create(h(6), 'flex'),
            c.properties(h(6), { width: 200 }),
            c.layout(h(6), { direction: 'vertical', gap: 10 }),
            c.attach(h(6), h(1, 2), 0),
            c.create(h(7), 'box'),
            c.properties(h(7), { height: 80, width: 200 }),
            c.layout(h(7)),
            c.attach(h(7), h(6), 0),
            c.create(h(8), 'box'),
            c.properties(h(8), { height: 80, width: 200 }),
            c.layout(h(8)),
            c.attach(h(8), h(6), 1),
          ]);
          await f.ready();
          await f.present();
          await f.input('update', 1000, { source: 'wheelUnknown', target: h(1, 2) });
          await f.tick();
          assert.equal((await f.inspect()).nodes.find((n) => n.node.slot === 1).offset, 70);
          const validDocument = (await snapshot(f)).layoutDocument;
          const invalid = await f.commit([
            c.create(h(9), 'scrollViewport'),
            c.properties(h(9), { width: 200, height: 100 }),
            c.layout(h(9)),
            c.create(h(10), 'box'),
            c.properties(h(10), { y: 1e12, width: 200, height: 1e12 }),
            c.attach(h(10), h(9)),
          ]);
          assert.equal(
            invalid.status,
            p.statuses.invalidValue,
            'Out-of-range composed coordinates are rejected before preparation',
          );
          await f.tick();
          assert.equal((await snapshot(f)).layoutDocument, validDocument);
        }),
    );
  }
}
